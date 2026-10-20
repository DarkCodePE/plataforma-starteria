from pathlib import Path
import re
import sys
import zipfile

sys.stdout.reconfigure(encoding="utf-8")
root = Path(__file__).resolve().parents[3]
document = (root / "docs/e2e/STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md").read_text(encoding="utf-8")
portfolio_zip = zipfile.ZipFile(root / "docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip")
steps_zip = zipfile.ZipFile(root / "docs/e2e/sources/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip")

sources = {
    "AGENTS": (root / "AGENTS.md").read_text(encoding="utf-8"),
    "AUTH": (root / "docs/STARTERIA_AUTHORITY.md").read_text(encoding="utf-8"),
    "CORE": (root / "doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md").read_text(encoding="utf-8"),
    "ENTRY": (root / "doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md").read_text(encoding="utf-8"),
    "ADR3": (root / "doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md").read_text(encoding="utf-8"),
    "ADR4": (root / "doc/product-adr/ADR-004-authenticated-continuation-access-and-initiative-handoff-authority.md").read_text(encoding="utf-8"),
    "ADR5": (root / "doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md").read_text(encoding="utf-8"),
    "ACT": (root / "docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md").read_text(encoding="utf-8"),
    "CTX": (root / "docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md").read_text(encoding="utf-8"),
    "P1": (root / "docs/e2e/P1_RUNTIME_BASELINE.md").read_text(encoding="utf-8"),
    "PLF": portfolio_zip.read(next(n for n in portfolio_zip.namelist() if n.endswith("01_FREEZE_DECLARATION.md"))).decode("utf-8-sig"),
    "PLB": portfolio_zip.read(next(n for n in portfolio_zip.namelist() if n.endswith("02_IMPLEMENTATION_BEHAVIOR_CONTRACT.md"))).decode("utf-8-sig"),
    "STF": steps_zip.read("STEPS_TARGET_DESIGN_FREEZE_v0.1.md").decode("utf-8-sig"),
}
sources["STQ"] = steps_zip.read("Starteria_Steps_v06_QA_2_Perfiles.md").decode("utf-8-sig")

rows = [line for line in document.splitlines() if re.match(r"^\| R\d\d \|", line)]
errors = []
for row in rows:
    cells = [cell.strip() for cell in row.split("|")]
    rule_id = cells[1]
    source_key = cells[4].split()[0]
    quotes = re.findall("“([^”]+)”", cells[5])
    if len(quotes) != 1 or source_key not in sources or quotes[0] not in sources[source_key]:
        errors.append((rule_id, source_key, quotes))

print(f"rule_count={len(rows)}")
print(f"quote_errors={errors}")
register = (root / "docs/e2e/P2_OPEN_DECISION_REGISTER.md").read_text(encoding="utf-8")
approval_pack = (root / "docs/e2e/P2_HUMAN_APPROVAL_PACK.md").read_text(encoding="utf-8")
register_errors = []
for line in register.splitlines():
    if "Current authority / exact quote" not in line and "Frozen/reference evidence" not in line:
        continue
    for quote in re.findall("“([^”]+)”", line):
        if not any(quote in source for source in sources.values()):
            register_errors.append(quote)
print(f"register_quote_errors={register_errors}")
corpus = list(sources.values())
document_quote_errors = [
    quote for quote in re.findall("“([^”]+)”", document)
    if not any(quote in source for source in corpus)
]
register_all_quote_errors = [
    quote for quote in re.findall("“([^”]+)”", register)
    if not any(quote in source for source in corpus)
]
print(f"document_quote_errors={document_quote_errors}")
print(f"register_all_quote_errors={register_all_quote_errors}")
headings = [int(value) for value in re.findall(r"^## (\d+)\.", document, flags=re.MULTILINE)]
criteria = [int(value) for value in re.findall(r"^\| P2-AC(\d\d) \|", document, flags=re.MULTILINE)]
criterion_results = re.findall(r"^\| P2-AC\d\d \|[^\n]*\| (PASS|FAIL|BLOCKED[^|]*) \|$", document, flags=re.MULTILINE)
gap_section = document.split("## 31. AS-IS → TO-BE gap summary", 1)[1].split("## 32.", 1)[0]
scenarios = set()
for start, end in re.findall(r"T(\d\d)(?:–T(\d\d))?", gap_section):
    scenarios.update(range(int(start), int(end or start) + 1))
decisions = re.findall(r"^## [A-Z][A-Z0-9/-]* — ", register, flags=re.MULTILINE)
print(f"sections={headings}")
print(f"criteria={criteria}")
print(f"criterion_results={criterion_results}")
print(f"gap_scenarios={sorted(scenarios)}")
print(f"decision_count={len(decisions)}")
valid = (
    len(rows) == 35
    and not errors
    and not register_errors
    and not document_quote_errors
    and not register_all_quote_errors
    and headings == list(range(1, 37))
    and criteria == list(range(1, 25))
    and scenarios == set(range(1, 26))
    and len(decisions) == 10
    # The prior candidate-status expectation is superseded by the user's explicit
    # 2026-10-20 approval of Option A and the v0.1 experience contract.
    and "**Status:** FROZEN_TOBE_FOR_IMPLEMENTATION_PLANNING" in document
    and "**P2 gate:** PASS" in document
    and len(criterion_results) == 24
    and all(result == "PASS" for result in criterion_results)
    and "P2-HUMAN-APPROVAL-2026-10-20" in approval_pack
    and "APPROVED_FOR_EXPERIENCE_FREEZE" in register
    and "P3 remains NOT_STARTED / NOT_AUTHORIZED" in document
)
raise SystemExit(0 if valid else 1)
