# Portfolio Handoff — Legacy Route Consumer Inventory v0.1

Status: implementation evidence for H-TECH-09. The inventory is intentionally bounded to active code consumers and the compatibility boundary they exercise.

## Classification

`/projects/new?challengeId=...` is `NOT_CANONICAL`, `COMPATIBILITY_ONLY`, and `DEPRECATION_TARGET`. It is not a Handoff route. The canonical Handoff route is `/handoff/invitations/:token`.

## Active consumer inventory

| Consumer ID | File / route | Current behavior | Domain / workstream | New Handoff dependency? | Classification | Replacement | Owner | Retirement trigger | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| LR-01 | `front/src/app/pages/PortfolioLeadChallengesPage.tsx` → `/projects/new?challengeId=` | Portfolio Lead's existing “Crear iniciativa” action opens Project creation pre-linked to a Challenge. | Portfolio Lead / legacy initiative creation | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | Explicit replacement entry point plus regression evidence for this consumer. | `PortfolioLeadActivationInvitation.ds08.test.tsx`; route helper guard |
| LR-02 | `front/src/app/pages/ParticipantChallengeDetailPage.tsx` → `/projects/new?challengeId=` | Participant can create a Project inside a Challenge. | Challenge participation / legacy Project creation | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | Explicit replacement and proof that participant access remains equivalent. | Participant page call site; route helper guard |
| LR-03 | `front/src/app/pages/ParticipantChallengeDetailPage.tsx` → `/projects/new` | Participant can create an unrelated Project. | Challenge participation / unrelated Project creation | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | Explicit replacement or confirmed retirement of standalone Project creation. | Participant page call site |
| LR-04 | `front/src/app/pages/CreateProjectPage.tsx`, route `/projects/new` | Shared Project creation screen accepts optional `challengeId` and sends `challengeLink` to the Project API. | Project / Core compatibility surface | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | All active callers migrated and compatibility regression is green. | `projectService` tests; Project creation implementation |
| LR-05 | `front/src/app/pages/AuthPage.tsx` → `createProjectFromPublicDraft` | Authenticated Public Draft continuation creates Project and opens Step 0. | Public Entry / pilot compatibility | NO | `REMOVE_LATER` | `NOT_YET_DEFINED` | TBD | Approved Public Entry replacement, consumer audit, and migration evidence. | `AuthPage.portfolio-entry-claim.test.tsx`; ADR-003 boundary |
| LR-06 | `backend/modules/pilot-leads/pilot-lead.router.ts` → `ProjectService.createProject` + `updateStep0` | Authenticated pilot claim materializes a Project and optionally pre-fills Step 0. | Public pilot / legacy Project + Steps | NO | `REMOVE_LATER` | `NOT_YET_DEFINED` | TBD | Replacement for pilot claim is approved and active-consumer evidence is complete. | Pilot claim implementation and existing pilot tests |
| LR-07 | `backend/modules/initial-review/route-confirmation.service.ts` → `ProjectService.createProject` | Confirming an Initial Review creates the canonical existing Project/Initiative surface and applies Step 0 data. | Initial Review / Core-compatible materialization | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | Explicit Initial Review migration decision and regression evidence. | Route confirmation service and ADR-025 comments |
| LR-08 | `front/src/app/routes.ts` → `/projects/new` | Declares the shared Project creation route. | Routing / Project creation | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | No active compatibility consumer remains and retirement is explicitly authorized. | Route declaration; route tests |
| LR-09 | `backend/modules/projects/project.service.ts` | Shared Project service creates Project, team, Steps and legacy portfolio metadata when invoked by its callers. | Core / Project and Steps | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | Consumer-by-consumer migration evidence and explicit authority for retirement. | Project service tests; Core authority |
| LR-10 | `backend/modules/portfolio/portfolio-home.read-service.ts` | Reads `InitiativePortfolioMeta` as legacy-derived Portfolio metadata; it does not materialize Project state. | Portfolio read adapter | NO | `KEEP_COMPAT` | `NOT_YET_DEFINED` | TBD | Replacement read model covers all consumers and read regression is green. | Portfolio read-model report; H-TECH-08 projection tests |

## Handoff consumer audit

The following canonical surfaces were checked and have no legacy-route or Project/Step materialization dependency:

- invitation email CTA and invitation landing: `/handoff/invitations/:token`;
- authenticated claim, Accept, Reject and Start commands;
- shared `HandoffShell` and Activation Overview states;
- Assigned Challenge Start terminal state;
- `PortfolioHandoffProjection` projector and Portfolio read adapter consumption.

The inventory deliberately does not delete the unrelated consumers above. The Handoff route and the Project creation route remain separate workflows.

## Retirement evidence required

Retirement is not authorized by this slice. Before removing the route or any consumer, the owning workstream must provide: a named replacement, an active-consumer audit, passing compatibility/regression tests, and explicit authority for that consumer's migration. Existing repository telemetry conventions may be used if available; no new telemetry platform is introduced here.
