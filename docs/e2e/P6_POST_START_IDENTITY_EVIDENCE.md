# P6 — Post-Start + Identity + A/B/C Evidence

**Status:** `PASS`. **Cut:** 2026-10-20. **Checkout:** `feat/KAN-153-recovery-ux@1e689ea5c54f7513e323e30f58e45e7168738c7c`.

## Authority

**AUTHORITY**

- **Path:** `doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md`, §1.
  **Exact quote:** “Accept no crea Project/Initiative.”
  **Interpretation:** Accept and Start remain Assignment transitions; neither can create the Initiative.
- **Path:** `STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md`, §13.
  **Exact quote:** “Start no crea Initiative en el contexto Handoff.”
  **Interpretation:** Route A must formulate before a separate human confirmation creates exactly one Project.
- **Path:** `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, INV-10.
  **Exact quote:** “No se sobrescribe silenciosamente la historia.”
  **Interpretation:** Route B must retain the existing Project and its history.
- **Path:** same Core, INV-02.
  **Exact quote:** “Las iniciativas independientes o públicas pueden existir sin un Frente Estratégico o Reto corporativo.”
  **Interpretation:** Route C cannot synthesize a corporate hierarchy.

## Implemented P6 slice

| Requirement | Code evidence | Test evidence | Result |
|---|---|---|---|
| Assign, Accept and Start remain distinct and Start remains idempotent | `backend/modules/portfolio-handoff/application/portfolio-handoff-response.service.ts` validates state, owner identity and idempotency before `startAssignedWork` | focused Handoff response suite: 9/9 PASS | PASS at unit scope |
| Route A Start creates no Initiative | `front/src/app/pages/HandoffInvitationPage.tsx` sends a started CHALLENGE with no `initiativeId` to `/initiatives/new?handoffAssignmentId=…`; no Project command runs in Start handler | existing handoff response tests plus Route-A unit test | PASS at unit scope |
| Route A has a noncanonical formulation | `InitialReview.handoffAssignmentId` references the started assignment; `InitialReviewService.createReview` accepts it only for the assigned Owner and stores the inherited Challenge reference | `initial-review.service.test.ts`: OWNER/STARTED and denial cases PASS | PASS at unit scope |
| Route A confirmation creates one Project and links it once | `RouteConfirmationService` reuses `ProjectService.createProject`, then conditionally links `PortfolioHandoffAssignment.initiativeId` in a transaction; `RouteConfirmation.reviewId` and nullable unique `InitialReview.handoffAssignmentId` prevent duplicate formulation/confirmation paths | `route-confirmation.service.test.ts`: Route-A link and idempotent confirmation tests PASS | PASS at unit scope; DB assertion pending |
| Route B preserves identity, history and governed continuity | after Start with existing `initiativeId`, `HandoffInvitationPage` navigates to that same Overview ID. `PortfolioHandoffReconstructionService` authorizes the assigned Owner through `ProjectService.getProjectForRead`, then reads Sources, Evidence, Claims, Context Snapshots, outputs, events and only the persisted active cycle/configuration. `InitiativeOverviewPage` renders gaps and locks all Steps for `CONTINUITY_REVIEW_REQUIRED`; it never selects, reopens or approves a Step. | reconstruction service (3), endpoint (1), Overview (10) and focused boundary suite (42) PASS | PASS at unit/component scope; DB/runtime proof pending |
| Route C remains independent | existing InitialReview → RouteConfirmation creates a Project without requiring Challenge/Front; schema accepts an absent `challengeId` | existing InitialReview/confirmation focused tests PASS | PASS at unit scope; DB/runtime proof pending |
| Persistence migration | `front/prisma/migrations/20261020000000_add_handoff_initial_review_link/migration.sql` adds only nullable pre-Project reference and indexes | `npm run db:generate` PASS | BLOCKED — no DB available to apply/assert migration |

Owner confirmation above confirms only the owner’s formulation. It does **not** mark strategic alignment confirmed and grants no Portfolio/decision authority.

## Tests executed

| Command | Result |
|---|---|
| `rtk npm run db:generate` (`front`) | PASS — Prisma Client generated |
| foreground `rtk npm run typecheck:backend` / `typecheck:front` attempts (`front`) | superseded as completion evidence: the runner stopped foreground invocations at 30 seconds without an observable exit code; final completed evidence is recorded below |
| `rtk npx vitest run --config vitest.backend.config.ts backend/modules/initial-review/__tests__/route-confirmation.service.test.ts backend/modules/initial-review/__tests__/initial-review.service.test.ts backend/modules/portfolio-handoff/__tests__/portfolio-handoff-response.service.test.ts` (`front`) | PASS — 38 tests |
| `rtk npx vitest run --config vitest.front.config.ts src/features/initiative-review/__tests__/InitiativeReviewFlow.test.tsx src/features/portfolio-handoff/__tests__/legacy-route-quarantine.test.ts` (`front`) | PASS — 31 tests; pre-existing React `act(...)` warnings only |
| foreground `rtk npm run typecheck` attempt (`front`) | superseded as completion evidence: see the final detached execution below |
| `rtk npm run lint` (`front`) | PASS |
| `rtk npx vitest run --config vitest.backend.config.ts …route-confirmation.service.test.ts …initial-review.service.test.ts …portfolio-handoff-response.service.test.ts …portfolio-handoff-reconstruction.service.test.ts …portfolio-handoff-reconstruction.router.test.ts` (`front`) | PASS — 42 tests |
| `rtk npx vitest run --config vitest.front.config.ts …InitiativeReviewFlow.test.tsx …legacy-route-quarantine.test.ts …InitiativeOverviewPage.test.tsx` (`front`) | PASS — focused UI boundary suite; pre-existing React `act(...)` warnings only |
| `rtk npm run build` (`front`) | PASS — existing chunk-size/dynamic-import warnings only |
| `rtk git -c safe.directory=C:/Users/User/proyect-starteria/starteria-KAN-153-recovery-ux diff --check` | PASS |
| `rtk npx prisma validate` (`front`) | BLOCKED — `DATABASE_URL` is not supplied |
| `rtk docker version` | BLOCKED — Docker Desktop Linux daemon pipe unavailable |

## Blocking evidence

**RUNTIME**

- Environment: local canonical checkout.
- DB/tenant/actors: unavailable; no local `.env` and Prisma reports `Environment variable not found: DATABASE_URL`.
- Docker: CLI is installed, but the Docker Desktop Linux daemon pipe does not exist.
- Consequence: P6 DB assertions, migration application, isolated boundary E2E and persisted identity evidence cannot run.

## Route B completion at code/test scope

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_UNIFIED_E2E_TECH_SPEC_v0.1.md`, §4.3.
  **Exact quote:** “The read model loads the linked Project, sources, evidence, claims, snapshots, cycles and outputs by the same `Project.id`. It calculates missing context as gaps; it does not mutate historical work or mark an inferred Step approved.”
  **Interpretation:** Route B is a read-only recovery of the same Initiative, with visible gaps and no automatic continuity choice.

**CODE**

- **Path:** `backend/modules/portfolio-handoff/application/portfolio-handoff-reconstruction.service.ts`.
  **Observed behavior:** requires a `STARTED` existing-Initiative Assignment and its assigned Owner, applies existing Project read authorization, then only performs scoped reads. Missing sources, evidence, history, or active persisted Core state become explicit gaps. It never writes or chooses a Step.
- **Path:** `front/src/app/pages/InitiativeOverviewPage.tsx`.
  **Observed behavior:** with `handoffAssignmentId`, reads the reconstruction model; when it returns `CONTINUITY_REVIEW_REQUIRED`, shows recovered counts and gaps and locks every Step/CTA.

**TEST**

- **Command:** focused Route B service, endpoint, Handoff, Initial Review and Overview suites.
  **Relevant output:** 42 backend tests passed; focused frontend boundary suite passed.

The remaining P6 limit is runtime verification only: no DB-backed assertion or isolated E2E can be run while Docker, `DATABASE_URL`, tenant and authenticated actors remain unavailable.

## Historical acceptance assessment — superseded by runtime resumption

| AC | Result | Evidence / reason |
|---|---|---|
| P6-AC01 Assign/Accept/Reject/Start distinct and idempotent | SUPERSEDED | Replaced by the final runtime acceptance assessment below. |
| P6-AC02–05 Route A formulation, review, one Initiative, inherited mandate | SUPERSEDED | Replaced by database and HTTP runtime evidence below. |
| P6-AC06–10 Route B same ID/history/gaps/no rewrite/cycle rule | SUPERSEDED | Replaced by database and HTTP runtime evidence below. |
| P6-AC11–12 Route C independent formulation/confirmation | SUPERSEDED | Replaced by database and HTTP runtime evidence below. |
| P6-Gate three routes converge without duplication | SUPERSEDED | Replaced by database and HTTP runtime evidence below. |

## Runtime resumption — 2026-10-20

**RUNTIME**

- **Environment:** local isolated E2E runtime, Docker Desktop Engine 29.1.3, compose project `starteria-p6-runtime`.
- **Database:** `starteria_e2e` on `localhost:55433`; credentials were checked without output and redacted. `front/scripts/database/test-database-utils.ts` allow-lists this disposable database and rejects protected/non-disposable names.
- **Provisioning:** `rtk npm run db:e2e:provision` completed migration deployment/status and seed on the isolated database. It applied 55 migrations including `20261020000000_add_handoff_initial_review_link`.
- **Runtime artifact:** `artifacts/e2e-goal/P6/RUNTIME_EVIDENCE.md`; Playwright result mirror `artifacts/e2e-goal/P6/p6-runtime-e2e.last-run.json`.

### Observed defects and bounded repair

1. The real Route B query used `InitiativeCycle.status = 'ACTIVE'`; Prisma rejected it because the database enum value is `active`. The read model now queries the persisted enum value and still makes no write or Step choice.
2. Route A stored only a generic Challenge context. The frozen P2 contract R18 and P5 §4.2 require inherited constraints/references. Confirmation now snapshots the existing Challenge and StrategicFront envelope into `Project.step0Data`; no new entity, role, decision authority, cardinality or Step rule was introduced.

### Runtime tests

| Command | Runtime result |
|---|---|
| `rtk npx cross-env P6_PERSISTENCE_E2E=1 vitest run --config vitest.backend.config.ts ../backend/modules/portfolio-handoff/__tests__/p6-post-start.persistence.e2e.test.ts` | PASS — 3/3 against Postgres: Route A pre/post state and mandate snapshot; Route B same ID/history/read-only gaps; Route C independent confirmation. |
| `rtk npx cross-env E2E_SKIP_DOCKER=true npm run test:e2e -- e2e/p6-post-start-runtime.spec.ts` | PASS — official runner provisioned the isolated database and ran backend/frontend; `front/test-results/.last-run.json` says `passed`. It exercised HTTP Accept/Start/confirmation retries, Route B reconstruction and Route C. |
| focused P6 backend suite | PASS — 42/42. |
| `rtk npm run lint` | PASS. |
| `rtk npm run build` | PASS; pre-existing chunk warnings only. |
| `rtk git diff --check` | PASS. |

### Updated acceptance assessment

| AC | Result | Runtime evidence |
|---|---|---|
| P6-AC01 Assign/Accept/Reject/Start distinct and idempotent | PASS | Route A/Postgres and HTTP retries persist one Accept and Start receipt each. |
| P6-AC02–05 Route A formulation, review, one Initiative, inherited mandate | PASS | Pre-confirmation Project count is zero; replayed confirmation has one ID; Assignment link and Challenge/Front constraint snapshot are asserted in DB. |
| P6-AC06–10 Route B same ID/history/gaps/no rewrite/cycle rule | PASS | HTTP reconstruction returned the same ID/recovered history and `CONTINUITY_REVIEW_REQUIRED`; DB before/after Project row did not change. |
| P6-AC11–12 Route C independent formulation/confirmation | PASS | HTTP confirmation/replay returned one Project with no Challenge context snapshot or Portfolio meta record. |
| P6-Gate three routes converge without duplication | PASS | The persisted Route A/C confirmation and Route B reconstruction all use one `Project` identity; retries do not create a second row. |
| Required project typecheck | PASS | The detached, repository-defined script sequence completed with exit code 0. See the final typecheck evidence below. |

## Final typecheck evidence — 2026-10-20

The runtime wrapper cuts foreground commands after 30 seconds. The repository's configured command was therefore run unchanged in a detached local process that writes its final state only after both configured subcommands finish. No script, tsconfig, compiler option, include/exclude, or TypeScript source was changed for this verification.

| Script | Exact underlying command | tsconfig | Scope | Started / completed | Duration | Exit code | Diagnostics | Artifact |
|---|---|---|---|---|---:|---:|---|---|
| `npm run typecheck` | `npm run typecheck:front && npm run typecheck:backend` | both below | repository-defined full sequence | 2026-10-20T13:58:00.0859072+02:00 / 2026-10-20T13:59:27.6237640+02:00 | 87.538 s | 0 | none | `artifacts/e2e-goal/P6/typecheck-full-results.json`, `typecheck-full.exitcode`, `typecheck-full.log` |
| `npm run typecheck:front` | `tsc -p tsconfig.front.json --noEmit` | `front/tsconfig.front.json` | `front/src/**/*.ts`, `front/src/**/*.tsx` | 2026-10-20T13:53:50.7696485+02:00 / 2026-10-20T13:54:40.6129625+02:00 | 49.843 s | 0 | none | independent completed command evidence: `artifacts/e2e-goal/P6/typecheck-persistent-front.log` |
| `npm run typecheck:backend` | `tsc -p tsconfig.backend.json --noEmit` | `front/tsconfig.backend.json` | `backend/**/*.ts` | 2026-10-20T13:54:40.6347618+02:00 / 2026-10-20T13:55:23.6774144+02:00 | 43.043 s | 0 | none | independent completed command evidence: `artifacts/e2e-goal/P6/typecheck-persistent-backend.log` |

`build` remains separate evidence only: `package.json` defines it as `vite build`, so it was not used to satisfy this typecheck gate. Both tsconfigs already contained `skipLibCheck: true`; that pre-existing setting was neither changed nor relied on to reduce scope.

## Final P6 acceptance assessment

| AC | Result | Evidence |
|---|---|---|
| P6-AC01 Assign, Accept, Reject and Start have distinct states | PASS | P6 focused response tests plus Route A/Postgres and HTTP traces; ADR5/ACT evidence in this pack. |
| P6-AC02 Retries are idempotent | PASS | Route A database assertions and HTTP E2E persist one Accept and one Start receipt after replay. |
| P6-AC03 Route A Start does not create an Initiative | PASS | Database count is zero before human confirmation. |
| P6-AC04 Route A has a candidate formulation and human review | PASS | `InitialReview.handoffAssignmentId` is created for the started Owner assignment; confirmation is the human checkpoint. |
| P6-AC05 Route A confirmation creates exactly one Initiative | PASS | DB and HTTP confirmation/replay return one Project identity. |
| P6-AC06 Route A inherits the mandate snapshot | PASS | DB asserts Challenge/Front constraints and references in the immutable handoff mandate snapshot. |
| P6-AC07 Route B preserves the existing Initiative ID | PASS | HTTP reconstruction and DB before/after use the same Project ID. |
| P6-AC08 Route B recovers context, evidence and history | PASS | Runtime reconstruction returns persisted history/source relations and gaps. |
| P6-AC09 Route B reconstructs gaps without overwriting valid history | PASS | Runtime returns `CONTINUITY_REVIEW_REQUIRED`; DB Project row is unchanged before/after. |
| P6-AC10 Route B selects cycle/Step only through the approved rule | PASS | It does not select or approve a Step; the governed continuation is `CONTINUITY_REVIEW_REQUIRED`. |
| P6-AC11 Route C can formulate and confirm an independent Initiative | PASS | Route C DB/HTTP confirmation and replay create one Project. |
| P6-AC12 Route C does not fabricate corporate hierarchy | PASS | Runtime assertions show no Challenge context snapshot or Portfolio meta record. |
| P6-Gate All three routes converge without duplication | PASS | Route A/C create exactly one Project only after confirmation; Route B reuses its existing Project. DB plus official HTTP E2E cover the boundary. |
| Required full project typecheck | PASS | Final, completed exit-code evidence above: configured front and backend commands both exit 0. |

**Phase result:** `PASS`. Runtime environment is no longer a P6 blocker. P7 remains `NOT_STARTED` under the explicit instruction for this closure.
