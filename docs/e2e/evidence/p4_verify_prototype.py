"""Static behavioral/fixture checks for the P4 standalone prototype."""

from html.parser import HTMLParser
from pathlib import Path


class Parser(HTMLParser):
    pass


ROOT = Path(__file__).resolve().parents[3]
path = ROOT / "docs/e2e/STARTERIA_UNIFIED_E2E_TO_BE_v0.1.html"
html = path.read_text(encoding="utf-8")
Parser().feed(html)
required = [
    "TO-BE SIMULATION — NOT RUNTIME",
    "Portfolio Entry",
    "Set the strategic frame",
    "Read the portfolio",
    "Prepare a revisable brief",
    "Assign an accountable owner",
    "Owner accepts responsibility",
    "Reject with a reason",
    "Start accepted work",
    "Formulate a candidate Initiative",
    "Continue the existing Initiative",
    "Formulate an independent Initiative",
    "Step 0 · Frame this cycle",
    "Step 1 · Establish truth and focus",
    "Step 2 · Prepare execution",
    "Step 3 · Observe execution",
    "Step 4 · Consolidate learning",
    "Human decision",
    "Return a governed signal to Portfolio",
    "Track benefit after development when applicable",
    "All names, metrics, sources and outcomes are simulated fixtures.",
    "Start ≠ Create Initiative ≠ Activate Step.",
    "No StrategicFront, Challenge or corporate sponsor is invented.",
    "does not assert deployed APIs",
]
missing = [value for value in required if value not in html]
routes = ["routeA", "routeB", "routeC", "step0", "step1", "step2", "step3", "step4", "decision", "return"]
missing_routes = [route for route in routes if f"{route}:" not in html]
print(f"html_parse=PASS")
print(f"missing_required={missing}")
print(f"missing_routes={missing_routes}")
raise SystemExit(1 if missing or missing_routes else 0)
