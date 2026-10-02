"""Regresión exploratoria de Starteria con jev-ultrafast (KAN-71 / KAN-73).

Cada caso: URL inicial, objetivo en lenguaje natural y una verificación independiente
(la ruta final debe ser `expect`). El DONE de Jev no cuenta como evidencia: su propia
documentación lo dice, y en la primera versión un link roto salió verde porque el agente
volvió solo por el menú.

Solo navega. Corre sobre la sesión logueada del Chrome del usuario, en una pestaña propia
en segundo plano, así que la cuenta tiene que estar logueada en ese Chrome.

Requisitos:
  - jev-ultrafast clonado en ./jev-ultrafast (no versionado) con su .env:
      TYPESAFE_API_KEY=<JEV_API_KEY>   TEXT_MODEL_API_KEY=<OPENROUTER_API_KEY>
  - Chrome con chrome://inspect/#remote-debugging habilitado.

Casos: scripts/jev-regresion.cases.json (o JEV_REGRESION_CASES). Cada HU con cambios
visibles agrega ahí su recorrido; ver TESTING.md §9.

Uso:
  uv run --project jev-ultrafast --env-file jev-ultrafast/.env python scripts/jev-regresion.py
  ... python scripts/jev-regresion.py "Admin roles" "PL retos"   # solo esos casos
  ... python scripts/jev-regresion.py --hu KAN-nnn                # solo los casos de una HU
  STARTERIA_URL=http://localhost:5173 ... python scripts/jev-regresion.py

Salida: 0 si todo pasa, 1 si algún caso falla.
"""
import json, os, sys, time
from jev_ultrafast import Agent

BASE = os.environ.get("STARTERIA_URL", "https://starter-ia.com").rstrip("/")
NO_WRITE = " Only navigate: do not create, edit, submit or delete anything."
CASES_FILE = os.environ.get("JEV_REGRESION_CASES", os.path.join(os.path.dirname(os.path.abspath(__file__)), "jev-regresion.cases.json"))
_cases = json.load(open(CASES_FILE, encoding="utf-8"))
CASES = [(c["name"], c["start"], c["goal"], c["expect"]) for c in _cases["journeys"]]
DEEP_LINKS = [d["path"] for d in _cases["deep_links"]]

class NotRendered(Exception):
    pass


def wait_rendered(agent, timeout=12, settle=1.5):
    """El SPA pinta antes de restaurar la sesión (primero 'Iniciar sesion', luego 'Ir al panel').
    Esperar a que haya controles y a que la página quede quieta `settle` segundos."""
    deadline = time.monotonic() + timeout
    labels, since = None, time.monotonic()
    while time.monotonic() < deadline:
        now = [a["label"] for a in agent.state["page"].get("actions", []) if a["kind"] != "wait"]
        if now != labels:
            labels, since = now, time.monotonic()
        elif now and time.monotonic() - since >= settle:
            return True
        time.sleep(0.3)
        agent.state["page"] = agent.browser.observe(screenshot=False)
    return False


args = sys.argv[1:]
hu = args[args.index("--hu") + 1] if "--hu" in args else None
if hu:
    names = {c["name"] for c in _cases["journeys"] if c.get("hu") == hu}
    CASES = [c for c in CASES if c[0] in names]
    DEEP_LINKS = [d["path"] for d in _cases["deep_links"] if d.get("hu") == hu]
    args = [a for a in args if a not in ("--hu", hu)]
    if not CASES and not DEEP_LINKS:
        sys.exit(f"no hay casos con hu={hu} en {CASES_FILE}")
only = set(args)
results = []
for name, start, goal, expect in CASES:
    if only and name not in only:
        continue
    t0 = time.perf_counter()
    try:
        with Agent(BASE + start, goal + NO_WRITE) as agent:
            if not wait_rendered(agent):
                results.append((name, "FALLA", "la página no terminó de renderizar", agent.state["page"]["url"], [], 0))
                raise NotRendered
            state = None
            for state in agent.run():
                pass
            url = agent.browser.evaluate("location.href")
            path = url.replace(BASE, "").split("?")[0].rstrip("/") or "/"
            ok = path == expect
            steps = [h["action"] for h in state["history"]]
            detail = f"jev={state['status']}, url={path}"
            results.append((name, "PASA" if ok else "FALLA", detail, url, steps, len(state["decisions"])))
    except NotRendered:
        pass
    except Exception as e:
        results.append((name, "ERROR", repr(e)[:200], "", [], 0))
    results[-1] += (round((time.perf_counter() - t0) * 1000),)

# Links directos: se abre la URL y NO se deja actuar a Jev. Si la app redirige, es bug,
# aunque el agente pudiera volver por el menú (eso tapó el bug en la primera versión).
for path in DEEP_LINKS if not only else []:
    t0 = time.perf_counter()
    with Agent(BASE + path, "noop") as agent:
        seen, end = [], time.monotonic() + 6
        while time.monotonic() < end:
            u = agent.browser.evaluate("location.pathname")
            if not seen or seen[-1] != u:
                seen.append(u)
            time.sleep(0.3)
    ok = seen[-1] == path
    results.append((f"link {path}", "PASA" if ok else "FALLA", " → ".join(seen), seen[-1], [], 0,
                    round((time.perf_counter() - t0) * 1000)))

print(f"\n{'caso':34} {'resultado':9} {'ms':>6} {'llamadas':>8}  detalle / acciones")
for name, res, detail, url, steps, calls, ms in results:
    print(f"{name:34} {res:9} {ms:>6} {calls:>8}  {detail} | {' → '.join(steps)}")
passed = sum(r[1] == "PASA" for r in results)
print(f"\n{passed}/{len(results)} pasan")
sys.exit(0 if passed == len(results) else 1)
