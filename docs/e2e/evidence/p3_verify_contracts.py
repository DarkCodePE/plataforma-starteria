"""Documentary verifier for the P3 reasoning and Steps Card contracts."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
ENGINE = (ROOT / "docs/e2e/STARTERIA_E2E_REASONING_ENGINE_CONTRACT_v0.1.md").read_text(encoding="utf-8")
CARD = (ROOT / "docs/e2e/STEPS_COPILOT_REASONING_AND_CARD_CONTRACT_v0.1.md").read_text(encoding="utf-8")
CORE = (ROOT / "doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md").read_text(encoding="utf-8")
CTX = (ROOT / "docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md").read_text(encoding="utf-8")
P2 = (ROOT / "docs/e2e/STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md").read_text(encoding="utf-8")

source_quotes = {
    "CORE": [
        "el estado confirmado debe vivir en objetos estructurados y versionados.",
        "Un resumen generado por IA no se convierte automáticamente en fuente de verdad.",
        "Suficiencia no equivale a completar formularios",
        "No se sobrescribe silenciosamente la historia.",
        "Las cinco funciones de los Steps permanecen estables.",
        "cero hard gates abiertos",
        "los outputs dependientes se marcan como `requires_review` cuando corresponda.",
    ],
    "CTX": ["RECEIVE INPUT", "PERSIST VERSIONED STRUCTURED STATE"],
    "P2": ["conversation not system of record", "UX transversal congelada: conversación + Card viva + herramientas contextuales"],
}
sources = {"CORE": CORE, "CTX": CTX, "P2": P2}
missing_quotes = [(key, quote) for key, quotes in source_quotes.items() for quote in quotes if quote not in sources[key]]

engine_required = [
    "## 3. Three-layer architecture",
    "## 4. Shared reasoning flow",
    "## 5. Knowledge classification",
    "## 6. Intervention selection",
    "## 7. Proposed delta and review protocol",
    "## 8. Sufficiency, gates and human checkpoints",
    "## 9. Provenance, versioning and currentness",
    "## 10. Existing capability audit",
    "## 12. P3 acceptance evidence",
]
card_required = [
    "## 2. Experience pattern",
    "## 3. Card state contract",
    "## 4. Step functions and Card boundaries",
    "## 5. Checkpoint behavior",
    "## 6. Negative and recovery contract",
    "## 8. P5 and implementation handoff",
    "## 9. P3 acceptance evidence",
]
adverse_terms = ["No sé", "irrelevant", "contradiction", "AI unavailable", "retry", "insufficient input"]
engine_missing = [heading for heading in engine_required if heading not in ENGINE]
card_missing = [heading for heading in card_required if heading not in CARD]
adverse_missing = [term for term in adverse_terms if term not in ENGINE and term not in CARD]
wrong_status = [
    value
    for value in (ENGINE, CARD)
    if "**Status:** FROZEN_FOR_P4_AND_P5_PLANNING" not in value
]

print(f"missing_quotes={missing_quotes}")
print(f"engine_missing_headings={engine_missing}")
print(f"card_missing_headings={card_missing}")
print(f"adverse_missing={adverse_missing}")
print(f"wrong_status_count={len(wrong_status)}")
raise SystemExit(1 if missing_quotes or engine_missing or card_missing or adverse_missing or wrong_status else 0)
