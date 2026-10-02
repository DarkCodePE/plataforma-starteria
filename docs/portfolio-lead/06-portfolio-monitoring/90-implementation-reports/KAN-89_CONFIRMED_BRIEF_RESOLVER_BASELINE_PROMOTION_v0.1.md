# KAN-89 — Confirmed Brief Resolver Baseline Promotion v0.1

**Status:** `READY_FOR_INTEGRATION` — focused and prescribed backend validation passed after installing declared dependencies and generating the local Prisma Client.
**Scope:** KAN-74 D1.1 only. No D2 or Portfolio Entry behavior change.

## Source recovery and delta

Recovered KAN-79 from local commit `87130647b7439ac1335998c831a3f906f0c93e9d`, branch `feat/KAN-74-brief-to-portfolio-lead`, and existing worktree `C:/Users/User/proyect-starteria/starteria-KAN-74`. The historical worktree is at that exact commit. Its report is `docs/implementation/portfolio-entry/KAN-79_D1_SERVER_SIDE_BRIEF_RESOLVER_IMPLEMENTATION_REPORT_v0.1.md`.

Exact KAN-79 paths:

- `backend/modules/portfolio-entry/__tests__/portfolio-entry.router.test.ts` — resolver behavior tests.
- `backend/modules/portfolio-entry/application/portfolio-entry-experimental-session.service.ts` — read-only resolver use case.
- `backend/modules/portfolio-entry/portfolio-entry.controller.ts` — request parsing and delegation.
- `backend/modules/portfolio-entry/portfolio-entry.dto.ts` — confirmed Brief DTO.
- `backend/modules/portfolio-entry/portfolio-entry.errors.ts` — safe 404, 409, 410 mapping.
- `backend/modules/portfolio-entry/portfolio-entry.router.ts` — authenticated route.
- `backend/modules/portfolio-entry/portfolio-entry.schemas.ts` — strict identity query schema.
- `docs/implementation/portfolio-entry/KAN-79_D1_SERVER_SIDE_BRIEF_RESOLVER_IMPLEMENTATION_REPORT_v0.1.md` — historical evidence.

`KAN79_REQUIRED`: those eight paths. `TRANSITIVE_DEPENDENCY`: current session repository/service/types and existing auth middleware, unchanged. `UNRELATED_HISTORICAL_CHANGE`: all other changes in the KAN-74 branch, including B1/B2/B3/C1, KAN-80, First Value/P3 removal and calibration changes; none were cherry-picked.

## Current-main reconciliation

The core service, router, controller, DTO, errors, schema, and router test files still exist at the same paths but have diverged with the current Portfolio Entry runtime refactor. They were reconciled narrowly in place. No repository, schema persistence, migration, or Frontend change was needed. The report path is new. KAN-79's historical implementation report remains at its original path in the KAN-74 worktree and is referenced as evidence; it is not copied into the unrelated `docs/implementation` namespace as a duplicate.

## Contract and guards

Route: `GET /api/v1/public/portfolio-entry/sessions/:sessionId/confirmed-brief`, protected by existing `auth` middleware.

Resolver order: authenticated principal; session existence; claimed ownership (foreign and missing normalize to the same 404); abandoned/expired/confirmed lifecycle eligibility; exact `session.revision === identity.sessionRevision`; handoff ID/version; confirmation ID/version/status/link to handoff.

Identity remains strict and includes `source`, `sessionRevision`, `handoffId`, `handoffVersion`, `confirmationId`, and `confirmationVersion`. No `+1`, latest fallback, or implicit refresh is introduced.

Errors preserve 401 unauthenticated, masked 404 missing/foreign, 409 lifecycle-ineligible confirmation or invalid/stale identity, and 410 abandoned/expired. The DTO retains source/session/revision and handoff/confirmation identity, `brief.rawEntry`, unchanged handoff payload, and confirmation status/accepted/corrected/rejected fields. It performs no StrategicIntentProjection mapping.

The GET calls only `findSessionById` and DTO mapping. `D1_CANONICAL_WRITES = 0`; `D1_DOMAIN_WRITES = 0`. It does not mutate Entry, ownership, revision, confirmation, Portfolio, StrategicFront, Challenge, Initiative, Step, First Value, or P3.

## Test and regression evidence

Historical KAN-79 report records additional runtime `+1/+2/-1`, post-claim revision, and revision precedence coverage. Those results are historical and do not establish this reconciled current-main result.

Current evidence:

- Focused router/API suite: **25/25 PASS**, including exact owner resolution, provenance, repeated read's zero session writes, 401, safe missing/foreign 404, revision/handoff/confirmation identity errors, abandoned/expired 410, and unconfirmed 409.
- `npm run test:backend`: **PASS** (exit 0; integration-marked tests skipped by the normal environment).
- `npm run typecheck:backend`: **PASS** after `npx prisma generate`.
- `npm run lint`: **PASS**.
- `npm run build`: **PASS** (Vite frontend build; emitted existing dynamic-import/chunk-size warnings).
- `npm run build:backend`: **PASS**.
- `git diff --check`: **PASS**.
- Prisma schema unchanged; no migration or database test required for this read-only addition.
- Frontend E2E: **NOT RUN**; no frontend or visible behavior changed.

## KAN-88 field coverage audit

The approved KAN-88 mapping is consumer logic. D1 contains a raw handoff plus accepted/corrected/rejected provenance, but the historical confirmation command only accepts/confirms `understood_need`/`understanding`, `desired_outcome`, and `known_context`; it excludes `decision_to_enable` and `unresolved_context` as organizational fields and does not offer confirmation for `evidence_or_clarity_needed` or `recommended_approach`.

| Projection field | Source handoff field | Accepted proof | Corrected proof | Rejected proof | D1 payload sufficient |
|---|---|---|---|---|---|
| goal | `desired_outcome` | YES | YES | YES | YES |
| situation | `understanding` (`understood_need` confirmation alias) | YES | YES | YES | YES |
| decisionToEnable | `decision_to_enable` | NO | NO | YES | NO |
| knownContext | `known_context` | YES | YES | YES | YES |
| approachHypothesis | `recommended_approach` | NO | NO | YES | NO |
| openQuestions | `unresolved_context` + `evidence_or_clarity_needed` | NO | NO | YES | NO |

`rejectedFields` is an unrestricted string list in the existing confirmation request and can record rejection for these fields. The allowed accepted/corrected sets remain limited to user-owned fields. For unsupported projection fields, D1 cannot establish accepted/corrected proof even though it can preserve a rejection; handoff presence alone is not confirmation. D2 must omit them or fail closed under KAN-88. This does not authorize changing D1 or confirmation semantics. No new D1 fields or identifiers are proposed.

## Readiness

Promotion source is recovered and the narrow service/API/DTO/error implementation is present in this branch. Integration readiness is established for the narrow D1 promotion. The D2 field coverage limitations above are explicit and handled by KAN-88 omission/fail-closed rules. `D2_BASELINE_READY_AFTER_MERGE = YES` once this change is integrated into governed main; this does not authorize D2 implementation in KAN-89.
