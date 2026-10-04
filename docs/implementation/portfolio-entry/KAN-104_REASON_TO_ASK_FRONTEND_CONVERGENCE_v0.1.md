# KAN-104 — `reason_to_ask` frontend convergence v0.1

## KAN-104 FINAL RESULT

### A. PRECONDITION

| Check | Result |
|---|---|
| Jira KAN-104 | `En curso` |
| Jira KAN-105 | `RESUELTO` |
| `HEAD == origin/main` | Yes: `b5966abb82919b71ed33e2309f5f223c41bdc3d2` |
| Branch | `feat/KAN-104-reason-to-ask` |
| Initial working tree | Not clean: this report directory was untracked. Its existing report was inspected and updated in place. |
| Commit | None created, as requested |

Read and applied: product ADR-007, the `reason_to_ask` Exposure Contract v0.1, product ADR-002, Portfolio Entry Logic Contract v0.1, V2 Authority Map, Migration Guardrails, Implementation Playbook, current `QuestionRecord`, session persistence/serializer, API DTO, frontend types/service, `PortfolioEntryExperience`, and the earlier KAN-104 blocked report. Jira is the status source for KAN-104/KAN-105.

### B. TRANSPORT_MATRIX

| Hop | Before | After | Evidence |
|---|---|---|---|
| Planner output | PRESENT | PRESENT | Analysis schema and provider schema already require `reason_to_ask`. No planner-selection changes. |
| Domain schema | PRESENT | PRESENT | `questionItemV2Schema` already carries the string. |
| Provider schema | PRESENT | PRESENT | Provider JSON schema already declares it. |
| `QuestionRecord` projection | DROPPED | PRESENT | `applyQuestionBudget` now copies the exact value into the emitted record. |
| Persisted/session turn | DROPPED on projection; JSON persistence available | PRESENT | Turn JSON carries the record; Prisma mapper accepts legacy missing/null and stores the field when present. |
| API response | MISSING | PRESENT for active question only | Existing DTO serializer passes the latest turn's first question through unchanged; it omits reasons from older turns and `previousQuestions`. |
| Frontend service DTO | MISSING | PRESENT | Typed `reason_to_ask?: string | null`; service returns API payload unchanged. |
| Frontend state/model | MISSING | PRESENT | Active question is still derived from latest-turn DTO; its field is not recomputed. |
| Active-question UI | MISSING | PRESENT | Exact value is shown once, subordinate to the question. |

### C. BACKEND_PROJECTION

`QuestionRecord` now has optional nullable `reason_to_ask` for compatibility with old persisted records. `applyQuestionBudget` copies `question.reason_to_ask` directly. Selection order, wording, type, `resolves`, priority, expected answer type, budget, and question identity were not changed.

The session DTO exposes the reason only on the first question of the latest turn, matching the existing frontend active-question projection. Other turn questions and `previousQuestions` omit the field in the client projection. No reason is inferred from other fields.

### D. PERSISTENCE

Turn persistence serializes `QuestionRecord` in `emittedQuestions`; no new model or migration was needed. The Prisma JSON mapper now accepts the optional nullable property while old records without it remain valid. Runtime/service and isolated-database E2E coverage exercise persistence and reload with the same question/reason. Once answered, the API does not return the retired reason as active metadata.

### E. API

The existing session API response carries `reason_to_ask` on its current active question without transformation. A router test confirms the exact returned value survives a session GET/refresh and that the answered question's reason is omitted from the subsequent active projection.

### F. FRONTEND_DTO

`PortfolioEntryQuestion` accepts optional nullable `reason_to_ask`. The public service unwraps the response without parsing away or rewriting this field. `previousQuestions` are typed without a reason because they are not active questions.

### G. UX

The reason appears below the question in subdued text inside the same active-question panel. It remains one explanation, not a message or card. The UI displays the backend string exactly. Missing, null, empty, and whitespace-only values render nothing. The latest-turn rule still yields zero active questions when the newest turn has none.

### H. SECURITY

Applied `PUBLIC_EXPLANATION != PRIVATE_REASONING` from ADR-007. The API only projects the governed public field on the active question and does not map chain-of-thought, hidden deliberation, prompts/instructions, scoring, provider/model metadata, secrets, security rationale, or orchestration rationale. No client-side chain-of-thought heuristics were added. Content meaning remains governed by ADR-007 and the field producer; live-provider content quality was not independently evaluated by this implementation.

### I. EMPTY_CASES

| Case | Result |
|---|---|
| A. Valid reason | Visible once in active-question UX; backend exact-value projection covered. |
| B. Empty string | Hidden. |
| C. Null | Hidden. |
| D. Undefined/missing | Hidden. |
| E. No active question | No active reason rendered. |
| F. Previous/retired question | API omits historical reason; UI does not render it as active. |
| G. Refresh | Isolated Chromium E2E checks same question and same reason after reload, without duplication. |

### J. TESTS

- `npm run test:backend` — passed.
- `npm run typecheck:backend` — passed.
- `npm run build:backend` — passed.
- `npm run test:front` — passed.
- `npm run typecheck:front` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (existing bundle-size/dynamic-import warnings only).
- Focused rerun after final DTO/type and whitespace-case edits: 62 backend tests and 39 frontend tests passed; both frontend/backend typechecks passed.
- Prisma repository integration tests are present but the default backend suite skips them unless its integration flag/database is enabled. The E2E runner used its isolated Postgres database.

### K. E2E

`npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts` — passed through the repository's isolated Postgres/Chromium harness. The existing KAN-103-stabilized Portfolio Entry conversion journey now checks exactly one active question, one visible reason, question/reason stability after refresh, and no reason attached to retired turns after answering. The existing journey continues through the handoff/confirmed Brief and final actions.

### L. REGRESSION

No planner selection, question wording, lifecycle, D1/D2, KAN-74 continuation, Core, or Steps behavior was changed. The conversion E2E passed through Portfolio Entry and the existing final Brief/action flow; the KAN-102 Landing → Entry Chromium E2E also passed. Backend and frontend suites passed. No separate production/deployed run was performed.

### M. DOC_RECONCILIATION

Updated `STARTERIA_V2_MANIFEST.md` and `CURRENT_STATE.md` because the DTO gap and runtime status changed. KAN-102 landing and Portfolio Entry semantic behavior remain unchanged; Demo/Early Access remain blocked by destination. The candidate Portfolio Entry v0.2 Agent/Skill/Harness stack remains candidate.

### N. FILES_CHANGED

- `backend/modules/portfolio-entry-runtime/domain/session.types.ts`
- `backend/modules/portfolio-entry-runtime/session/question-budget.ts`
- `backend/modules/portfolio-entry-runtime/__tests__/value-handoff-cognition.test.ts`
- `backend/modules/portfolio-entry-sessions/infrastructure/prisma-portfolio-entry-session.mapper.ts`
- `backend/modules/portfolio-entry-sessions/__tests__/portfolio-entry-session.service.test.ts`
- `backend/modules/portfolio-entry-sessions/__tests__/prisma-portfolio-entry-session.repository.integration.test.ts`
- `backend/modules/portfolio-entry/portfolio-entry.dto.ts`
- `backend/modules/portfolio-entry/__tests__/portfolio-entry.router.test.ts`
- `front/src/features/portfolio-entry/public/types.ts`
- `front/src/features/portfolio-entry/public/PortfolioEntryExperience.tsx`
- `front/src/features/portfolio-entry/public/__tests__/PortfolioEntryExperience.test.tsx`
- `front/src/features/portfolio-entry/public/__tests__/portfolioEntryPublicService.test.ts`
- `front/e2e/portfolio-entry-conversion.spec.ts`
- `STARTERIA_V2_MANIFEST.md`
- `CURRENT_STATE.md`
- `docs/implementation/portfolio-entry/KAN-104_REASON_TO_ASK_FRONTEND_CONVERGENCE_v0.1.md`

### O. REPORT_PATH

`docs/implementation/portfolio-entry/KAN-104_REASON_TO_ASK_FRONTEND_CONVERGENCE_v0.1.md`

### P. FINDINGS_REMAINING

1. Real-provider content was not independently evaluated. Runtime transport relies on the producer conforming to ADR-007; no client-side content heuristic was introduced.
2. No deployed/production regression was run.
3. Initial precondition was not a clean working tree because this report directory was already untracked. Its contents were retained and reconciled into this result.

### Q. STATUS

```text
STATUS = REASON_TO_ASK_READY
SAFE_TO_COMMIT = YES
COMMIT_CREATED = NO
```

### V2_CHANGE_CLOSURE_CHECK

- Authorized transport/presentation scope implemented; no planner selection, lifecycle, D1/D2, KAN-74, Core, Steps, or canonical model changes.
- Backend/frontend suites, typechecks, builds, lint, and the isolated Portfolio Entry E2E have recorded results above; production/live-provider validation remains open.
- Manifest, `CURRENT_STATE.md`, and this implementation report reflect the changed runtime state.
- No commit, Jira transition, merge, or deployment was performed. KAN-104 remains `En curso`, with the implementation ready for review.
