"""Eval de la revisión inicial con el proveedor real (auditoría E2E F-14 / F-22).

Para cada caso de `cases.json`:

1. F-14 (fidelidad): corre `generate_initial_review`, el mismo camino que usa producción, y
   lo mide con `scorers.score_case`: cifras conservadas, cifras y plazos sin fuente,
   abstención y frases que declaran la propuesta validada.
2. F-22 (valor): corre un baseline sencillo (el mismo modelo con un prompt de chat genérico)
   y un juez de otro proveedor compara las dos respuestas a ciegas y en orden aleatorio.

Uso (llama a OpenRouter y gasta saldo; con 8 casos son centavos):

    cd ai-service
    uv run --env-file ../.env python -m evals.initial_review.run [--cases id1,id2] [--no-judge]

Deja el resultado en `evals/initial_review/results/<fecha>.json` y `.md`.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from langchain_openai import ChatOpenAI  # noqa: E402

from agents import initial_reviewer  # noqa: E402
from evals.initial_review.scorers import review_text, score_case  # noqa: E402

HERE = Path(__file__).resolve().parent
JUDGE_MODEL = os.getenv("EVAL_JUDGE_MODEL", "anthropic/claude-sonnet-5.5")

_BASELINE_PROMPT = (
    "Eres un asistente útil. Una persona te comparte una propuesta de iniciativa para su "
    "empresa. Analízala y dale tu opinión: qué está bien, qué falta y qué debería hacer. "
    "Responde en español.\n\nPropuesta:\n{input}\n\nContexto adicional:\n{context}"
)

_JUDGE_PROMPT = """Evalúas dos respuestas (A y B) a la misma propuesta de iniciativa. La persona
necesita ayuda para decidir si y cómo avanzar. No sabes cuál respuesta es de qué sistema.

Propuesta (y contexto agregado):
<<<
{source}
>>>

Respuesta A:
<<<
{a}
>>>

Respuesta B:
<<<
{b}
>>>

Puntúa cada respuesta de 1 a 5 en:
- fidelidad: conserva las cifras y el alcance de la propuesta; no inventa datos, métricas ni plazos.
- incertidumbre: deja claro qué no se sabe y qué evidencia falta.
- decision: ayuda a ver qué decisión se puede tomar y cuál es el siguiente paso concreto.
- utilidad: en conjunto, le sirve a la persona más que un análisis genérico.

Lista además las afirmaciones de cada respuesta que no tienen respaldo en la propuesta.

Responde SOLO con JSON:
{{"A": {{"fidelidad": n, "incertidumbre": n, "decision": n, "utilidad": n, "sin_respaldo": ["..."]}},
  "B": {{...}}, "preferida": "A" | "B" | "empate", "motivo": "una frase"}}"""


def _chat(model: str, temperature: float) -> ChatOpenAI:
    return ChatOpenAI(
        base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        model=model,
        api_key=os.environ["OPENROUTER_API_KEY"],
        temperature=temperature,
        max_tokens=4000,
        max_retries=2,
    )


def _source(case: dict[str, Any]) -> str:
    return "\n".join([case["input"], *case.get("added_context", [])])


def run_review(case: dict[str, Any]) -> tuple[dict[str, Any] | None, float, str | None]:
    started = time.perf_counter()
    try:
        review = initial_reviewer.generate_initial_review(case["input"], case.get("added_context"))
        return review.model_dump(), time.perf_counter() - started, None
    except Exception as exc:  # noqa: BLE001
        return None, time.perf_counter() - started, f"{type(exc).__name__}: {exc}"


def run_baseline(case: dict[str, Any], model: str) -> str:
    prompt = _BASELINE_PROMPT.format(input=case["input"], context="\n".join(case.get("added_context", [])) or "(ninguno)")
    return str(_chat(model, 0.3).invoke(prompt).content)


def judge(case: dict[str, Any], starteria: str, baseline: str, rng: random.Random) -> dict[str, Any]:
    starteria_is_a = rng.random() < 0.5
    a, b = (starteria, baseline) if starteria_is_a else (baseline, starteria)
    raw = str(_chat(JUDGE_MODEL, 0).invoke(_JUDGE_PROMPT.format(source=_source(case), a=a, b=b)).content)
    data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
    sides = {"starteria": data["A" if starteria_is_a else "B"], "baseline": data["B" if starteria_is_a else "A"]}
    pref = data.get("preferida")
    winner = "empate" if pref not in {"A", "B"} else ("starteria" if (pref == "A") == starteria_is_a else "baseline")
    return {**sides, "winner": winner, "reason": data.get("motivo"), "starteria_was": "A" if starteria_is_a else "B"}


def _summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    ok = [r for r in results if r["review"] is not None]
    pres = [r["f14"]["preservation"] for r in ok if r["f14"]["preservation"] is not None]
    abst = [r["f14"]["abstains"] for r in ok if r["f14"]["abstains"] is not None]
    judged = [r["f22"] for r in ok if r.get("f22")]
    summary: dict[str, Any] = {
        "cases": len(results),
        "errors": len(results) - len(ok),
        "preservation_mean": round(sum(pres) / len(pres), 3) if pres else None,
        "cases_with_unsourced_durations": sum(1 for r in ok if r["f14"]["unsourced_durations"]),
        "cases_with_unsourced_numbers": sum(1 for r in ok if r["f14"]["unsourced_numbers"]),
        "cases_with_overclaims": sum(1 for r in ok if r["f14"]["overclaims"]),
        "abstention_rate": round(sum(abst) / len(abst), 3) if abst else None,
        "latency_p50_s": round(sorted(r["latency_s"] for r in ok)[len(ok) // 2], 1) if ok else None,
    }
    if judged:
        summary["judge"] = {
            "model": JUDGE_MODEL,
            "starteria_wins": sum(1 for j in judged if j["winner"] == "starteria"),
            "baseline_wins": sum(1 for j in judged if j["winner"] == "baseline"),
            "ties": sum(1 for j in judged if j["winner"] == "empate"),
            **{
                f"{side}_{dim}": round(sum(j[side][dim] for j in judged) / len(judged), 2)
                for side in ("starteria", "baseline")
                for dim in ("fidelidad", "incertidumbre", "decision", "utilidad")
            },
        }
    return summary


def _markdown(meta: dict[str, Any], summary: dict[str, Any], results: list[dict[str, Any]]) -> str:
    lines = [
        f"# Eval revisión inicial — {meta['date']}",
        "",
        f"Modelo revisado: `{meta['model']}` · juez: `{meta['judge']}` · prompt: `agents/initial_reviewer.py@{meta['commit']}`",
        "",
        "## Resumen",
        "",
        *[f"- **{k}**: {v}" for k, v in summary.items() if k != "judge"],
    ]
    if "judge" in summary:
        lines += ["", "### Comparación a ciegas contra baseline", "", *[f"- **{k}**: {v}" for k, v in summary["judge"].items()]]
    lines += ["", "## Por caso", "", "| caso | conserva | cifras sin fuente | plazos sin fuente | se abstiene | sobreafirma | juez |", "|---|---|---|---|---|---|---|"]
    for r in results:
        if r["review"] is None:
            lines.append(f"| {r['id']} | ERROR: {r['error']} | | | | | |")
            continue
        f = r["f14"]
        lost = [k for k, v in f["preserved"].items() if not v]
        conserva = "—" if f["preservation"] is None else f"{f['preservation']:.0%}" + (f" (pierde: {', '.join(lost)})" if lost else "")
        j = r.get("f22") or {}
        lines.append(
            f"| {r['id']} | {conserva} | {f['unsourced_numbers'] or '—'} | {f['unsourced_durations'] or '—'} | "
            f"{'—' if f['abstains'] is None else ('sí' if f['abstains'] else 'NO')} | {f['overclaims'] or '—'} | {j.get('winner', '—')} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", help="ids separados por coma")
    parser.add_argument("--no-judge", action="store_true")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    corpus = json.loads((HERE / "cases.json").read_text())["cases"]
    if args.cases:
        wanted = set(args.cases.split(","))
        corpus = [c for c in corpus if c["id"] in wanted]
    model = os.getenv("OPENROUTER_MODEL", initial_reviewer._DEFAULT_MODEL)  # noqa: SLF001
    rng = random.Random(args.seed)

    results = []
    for case in corpus:
        review, latency, error = run_review(case)
        result: dict[str, Any] = {"id": case["id"], "review": review, "latency_s": round(latency, 2), "error": error}
        if review is not None:
            result["f14"] = score_case(case, review)
            if not args.no_judge:
                try:
                    result["baseline"] = run_baseline(case, model)
                    result["f22"] = judge(case, review_text(review), result["baseline"], rng)
                except Exception as exc:  # noqa: BLE001
                    result["f22_error"] = f"{type(exc).__name__}: {exc}"
        print(f"{case['id']}: {'ERROR ' + error if error else 'ok'} ({latency:.1f}s)", flush=True)
        results.append(result)

    commit = os.popen("git rev-parse --short HEAD 2>/dev/null").read().strip() or "?"
    meta = {"date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ"), "model": model, "judge": None if args.no_judge else JUDGE_MODEL, "commit": commit}
    summary = _summary(results)
    out = HERE / "results"
    out.mkdir(exist_ok=True)
    (out / f"{meta['date']}.json").write_text(json.dumps({"meta": meta, "summary": summary, "results": results}, ensure_ascii=False, indent=2))
    (out / f"{meta['date']}.md").write_text(_markdown(meta, summary, results))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"→ {out / (meta['date'] + '.md')}")


if __name__ == "__main__":
    main()
