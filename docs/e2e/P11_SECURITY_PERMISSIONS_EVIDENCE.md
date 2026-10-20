# P11 — Security, Permissions, Idempotency & Isolation Evidence

**Status:** `PASS`  
**Runtime identity:** isolated local E2E PostgreSQL `starteria_e2e` at `localhost:55433`; source `1e689ea5c54f7513e323e30f58e45e7168738c7c`. This is not deployed-runtime evidence.

## Authority

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_UNIFIED_E2E_TECH_SPEC_v0.1.md`, §6.
- **Exact quote:** “`retries | idempotency key plus request fingerprint and result ID | reused key with changed payload; deterministic conflict`”.
- **Interpretation:** a retry must return its durable original result; key reuse with a different payload must fail deterministically.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_UNIFIED_E2E_TECH_SPEC_v0.1.md`, §7.
- **Exact quote:** “`P11 | policy/idempotency endpoints | cross-tenant/role/retry requests | denied access/no duplicate effects; integration/E2E`”.
- **Interpretation:** P11 requires actual role/scope and retry verification, not inspection alone.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md`, §6.
- **Exact quote:** “Portfolio Lead” governs portfolio work, while “Initiative Owner” governs execution.
- **Interpretation:** a Portfolio Lead can have bounded access but cannot mutate the Owner’s Step work without an authorized command.

## Implementation

| Scope | Code evidence | Behavior |
|---|---|---|
| Project scope and roles | `backend/modules/projects/project-team-access.ts`, `backend/modules/steps/step.access.ts` | Team owner/editor write; viewer reads only; unassigned actor is denied; assigned Portfolio Lead reads only; mentor has only the existing permitted scope. |
| Step/semantic commands | `backend/modules/projects/project.router.ts:82-97` | Mutating commands use `canWrite`; read services still make scoped access checks. |
| P6 commands | `backend/modules/portfolio-handoff/application/*` and `PortfolioHandoffResponseCommand` | Accept/Start and confirmation retain durable replay semantics. |
| P9 support | `backend/modules/adaptive-core/adaptive-core.service.ts#signalSupport` | Owner signal is replay-safe and never mutates cycle/Step state. |
| PDF retry | `backend/modules/initiative-pdfs/pdf.service.ts`, `pdf.controller.ts`, `front/prisma/schema.prisma`, migration `20261020180000_add_initiative_pdf_idempotency` | Optional `Idempotency-Key` uses SHA-256 request fingerprint; identical retry returns one `InitiativePdf`, changed payload conflicts. |
| Decision retry | `AdaptiveCoreService.decideDecisionRequest` | An authorized decision request produces one immutable Decision; replay returns the existing decision and concurrent second decision is rejected. |

## Executed evidence

### Isolated HTTP/runtime

**RUNTIME**

- **Environment:** local isolated runner with migrated/seeded `starteria_e2e`, backend on `127.0.0.1:4100`, front on `127.0.0.1:5176`.
- **Command:** `E2E_SKIP_DOCKER=true npm run test:e2e -- e2e/p11-security-runtime.spec.ts`.
- **Result:** exit `0`, 1/1 Playwright scenario; [result](../../artifacts/e2e-goal/P11/runtime-e2e-result.json), [log](../../artifacts/e2e-goal/P11/runtime-e2e.log).
- **Observed:** viewer reads semantic state but receives `403` for mutation; an unrelated authenticated user receives `403` reading the same Initiative; semantic and support retries write one output/item; identical PDF retry returns one persistent `InitiativePdf`.

### Focused policy, persistence and replay suite

**TEST**

- **Command:** `R2_PERSISTENCE_E2E=1 P6_PERSISTENCE_E2E=1 P9_SUPPORT_E2E=1 DATABASE_URL=<isolated> E2E_DATABASE_URL=<isolated> vitest run --config vitest.backend.config.ts …`.
- **Result:** exit `0`; 12 files, 70 tests passed.
- **Coverage:** owner/viewer/mentor/Portfolio Lead policies; role revocation; route A/B/C Accept/Start/confirm replays; support replay; decision authority/request/effects and decision replay; PDF service conflict/retry behavior.

### Repository gates

**TEST**

- **Typecheck:** literal `npm run typecheck`; front and backend `tsc --noEmit`; exit `0`, 67.171 s; [artifact](../../artifacts/e2e-goal/P11/typecheck-result.json).
- **Lint:** `npm run lint`; exit `0` (“Baseline lint passed”).
- **Build:** `npm run build`; exit `0`; existing bundle-size warnings only.
- **Migration:** `npm run db:e2e:migrate`; exit `0`; applied `20261020180000_add_initiative_pdf_idempotency` to the isolated DB.

## Acceptance criteria

| ID | Result | Evidence |
|---|---|---|
| P11-AC01 tenant A cannot access tenant B | PASS | isolated HTTP other-user `403`; project/team scope policy tests |
| P11-AC02 Portfolio Lead permissions | PASS | `portfolio-lead-project-access.test.ts`; no checkpoint mutation |
| P11-AC03 Initiative Owner permissions | PASS | P11 HTTP owner writes and P6 persistence suite |
| P11-AC04 Viewer permissions | PASS | P11 HTTP read `200`, write `403`; step access tests |
| P11-AC05 Mentor/reviewer where applicable | PASS | `project-team-access.test.ts` validates current mentor scope and deny-by-default manage boundary |
| P11-AC06 decision authority | PASS | PostgreSQL decision authority/organizational-decision tests |
| P11-AC07–09 Accept, Start, Confirm retries | PASS | P6 PostgreSQL Route A replay/one Initiative assertions |
| P11-AC10 Upload retry | PASS | P11 HTTP PDF replay plus unit conflict/replay tests |
| P11-AC11 Decision retry | PASS | organizational decision PostgreSQL test: one immutable Decision under retry/concurrency |
| P11-AC12 retries preserve consistency | PASS | runtime Card/support/PDF and persistence route/decision tests |
| P11-AC13 unauthorized commands fail | PASS | runtime `403`, project/step/PDF access suites |

## Result

P11 closes against the isolated local runtime. It does not satisfy P12’s deployed-runtime requirement.
