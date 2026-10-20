# P3 Verification Evidence

**Phase:** P3 — AI Reasoning + Card Contract  
**Checkout:** C:/Users/User/proyect-starteria/starteria-KAN-153-recovery-ux  
**Branch / HEAD:** feat/KAN-153-recovery-ux / 1e689ea5c54f7513e323e30f58e45e7168738c7c

## Authority

- `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, INV-04: “el estado confirmado debe vivir en objetos estructurados y versionados.”
- same, INV-05: “Un resumen generado por IA no se convierte automáticamente en fuente de verdad.”
- same, INV-09: “Suficiencia no equivale a completar formularios”.
- `docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md`, §9.1 defines the shared flow; §§10–16 define classification, recovery, intervention, Card, provenance, versioning and sufficiency.

## Code audit evidence

| Area | CODE evidence | P3 result |
|---|---|---|
| Truth/provenance | `backend/modules/truth/truth.service.ts:27–40` maps support/contradiction/insufficiency; `front/prisma/schema.prisma` has SourceRef/TruthClaim/Evidence models | candidate reuse, not proof of unified semantics |
| Version/review | `front/prisma/schema.prisma:837–853` provides versioned AdaptiveStepOutput and `requiresReview`; `backend/modules/adaptive-core/critical-change-dependency.resolver.ts` maps affected steps | candidate reuse, technical design deferred P5 |
| Copilot | `backend/modules/copilot/application/copilot-orchestration.service.ts:40–52` persists conversation input | candidate adaptation, conversation is not claimed as state record |
| Harness/agents/skills | `ai-service/harness/*`, `ai-service/agents/*`, `ai-service/skills/*` were inventoried | reusable candidates only; P0 found no approved unified Steps Agent/Skill Contract |

## Test

**Command:** `rtk proxy python docs/e2e/evidence/p3_verify_contracts.py`  
**Exit:** 0. **Output:** `missing_quotes=[]`, `engine_missing_headings=[]`, `card_missing_headings=[]`, `adverse_missing=[]`, `wrong_status_count=0`. Both contracts are frozen for P4/P5 planning.  
**Runtime:** not applicable to P3 documentary contracts. P1 T01–T25 remain BLOCKED and are not relabeled.

## Gate conclusion

The two P3 contracts define behavior without changing Core, domain identity/cardinality, human/AI authority or Step function/gating. P3 has no unresolved ADR blocker required for P4. P4 may use the contracts as frozen behavior, subject to its own visual/behavioral checks.
