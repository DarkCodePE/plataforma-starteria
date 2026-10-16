"""Scorers deterministas del eval de la revisión inicial (auditoría E2E F-14).

F-14 pide comprobar que la revisión conserva cifras, unidades y alcance del input, que no
agrega plazos sin fuente y que se abstiene cuando falta información. Estas funciones no
llaman a ningún modelo: reciben el texto del input y la salida y miden.

- `numbers_in`: cifras de un texto, normalizadas ("1.200" = "1200" = "1,200"; "30 %" = "30%").
- `durations_in`: plazos ("4–6 semanas", "tres meses").
- `unsourced_numbers` / `unsourced_durations`: lo que la salida afirma y el input no trae.
- `preserved`: cuáles de las cifras clave del caso siguen en la salida.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

_WORD_NUMBERS = {
    "un": 1, "una": 1, "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6,
    "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "doce": 12, "quince": 15, "veinte": 20,
    "treinta": 30,
}
_UNITS = r"(?:d[ií]as?|semanas?|mes(?:es)?|años?|horas?|trimestres?|sprints?)"
_NUM = r"\d+(?:[.,]\d+)*"
_WORD = "|".join(sorted(_WORD_NUMBERS, key=len, reverse=True))
_DURATION = re.compile(
    rf"\b(?P<a>{_NUM}|{_WORD})(?:\s*(?:-|–|—|a|y)\s*(?P<b>{_NUM}|{_WORD}))?\s+{_UNITS}\b",
    re.IGNORECASE,
)
# Números que no son datos del negocio: "Step 0", "paso 2", ids de preguntas "q1".
_NOT_DATA = re.compile(r"\b(?:step|paso|steps|q|cp-?)\s*\d+(?:\s*[-–a]\s*\d+)?", re.IGNORECASE)
_NUMBER = re.compile(rf"(?<![\w.,]){_NUM}(?![\w])")


def _canonical(token: str) -> float | None:
    token = token.strip().lower()
    if token in _WORD_NUMBERS:
        return float(_WORD_NUMBERS[token])
    # "1.200" y "1,200" con grupos de 3 son miles; "3,5" / "3.5" son decimales.
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", token):
        return float(re.sub(r"[.,]", "", token))
    try:
        return float(token.replace(",", "."))
    except ValueError:
        return None


def numbers_in(text: str) -> set[float]:
    cleaned = _NOT_DATA.sub(" ", text or "")
    values = {_canonical(m.group(0)) for m in _NUMBER.finditer(cleaned)}
    return {v for v in values if v is not None}


def durations_in(text: str) -> list[str]:
    cleaned = _NOT_DATA.sub(" ", text or "")
    return [m.group(0) for m in _DURATION.finditer(cleaned)]


def _duration_values(text: str) -> set[float]:
    values: set[float] = set()
    for m in _DURATION.finditer(_NOT_DATA.sub(" ", text or "")):
        for key in ("a", "b"):
            if m.group(key):
                v = _canonical(m.group(key))
                if v is not None:
                    values.add(v)
    return values


def unsourced_numbers(source: str, output: str) -> list[float]:
    """Cifras de la salida que no están en el input. 1–3 se ignoran: aparecen como conteo
    natural ("tres preguntas", "1 frase") y no son datos del negocio."""
    known = numbers_in(source) | _duration_values(source)
    return sorted(v for v in numbers_in(output) if v not in known and v not in {1.0, 2.0, 3.0})


def unsourced_durations(source: str, output: str) -> list[str]:
    """Plazos de la salida cuyo número no aparece en el input (el caso "4–6 semanas" de Bere)."""
    known = numbers_in(source) | _duration_values(source)
    offenders = []
    for m in _DURATION.finditer(_NOT_DATA.sub(" ", output or "")):
        values = [_canonical(m.group(k)) for k in ("a", "b") if m.group(k)]
        if any(v is not None and v not in known for v in values):
            offenders.append(m.group(0))
    return offenders


def preserved(must_preserve: Iterable[str], output: str) -> dict[str, bool]:
    """Cada cifra clave del caso ("1.200 clientes" → 1200) sigue apareciendo en la salida."""
    found = numbers_in(output)
    result = {}
    for item in must_preserve:
        values = numbers_in(item)
        result[item] = bool(values) and values <= found
    return result


_OVERCLAIM = re.compile(
    r"\b(?:est[aá] validad[ao]|queda validad[ao]|aprobad[ao] para|garantiza(?:do|da)?|"
    r"lista para escalar|éxito asegurado|sin riesgos?)\b",
    re.IGNORECASE,
)


_NEGATION = re.compile(r"\b(?:no|ni|nunca|todav[ií]a no|a[uú]n no|sin que)\b[^.;:]{0,40}$", re.IGNORECASE)


def overclaims(output: str) -> list[str]:
    """Frases que declaran validada, aprobada o garantizada la propuesta (prohibido por el prompt).
    No cuenta las negadas en la misma frase: "no se declara lista para escalar" es lo correcto."""
    text = output or ""
    return [m.group(0) for m in _OVERCLAIM.finditer(text) if not _NEGATION.search(text[max(0, m.start() - 60): m.start()])]


def review_text(review: dict[str, Any]) -> str:
    """Todo el texto visible de una revisión inicial, en un solo string."""
    parts: list[str] = []

    def walk(value: Any) -> None:
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, dict):
            for key, item in value.items():
                if key in {"id", "suggestedChallengeType", "informationReadiness"}:
                    continue
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(review)
    return "\n".join(parts)


def score_case(case: dict[str, Any], review: dict[str, Any]) -> dict[str, Any]:
    """Métricas F-14 de un caso. `source` es todo lo que el modelo recibió como dato."""
    source = "\n".join([case["input"], *case.get("added_context", [])])
    text = review_text(review)
    kept = preserved(case.get("must_preserve", []), text)
    expect_low = case.get("expect_low_readiness", False)
    readiness = review.get("informationReadiness")
    missing = (review.get("critique") or {}).get("missingEvidence") or []
    return {
        "preserved": kept,
        "preservation": (sum(kept.values()) / len(kept)) if kept else None,
        "unsourced_numbers": unsourced_numbers(source, text),
        "unsourced_durations": unsourced_durations(source, text),
        "overclaims": overclaims(text),
        "abstains": (readiness in {"very_low", "low"} and len(missing) > 0) if expect_low else None,
        "readiness": readiness,
    }
