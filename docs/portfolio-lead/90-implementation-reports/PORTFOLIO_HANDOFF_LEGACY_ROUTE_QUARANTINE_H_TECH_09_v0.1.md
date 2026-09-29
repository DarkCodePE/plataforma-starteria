# H-TECH-09 — Legacy Route Quarantine

## 1. Scope

Quarantine the legacy Challenge → Project path from the canonical Portfolio Lead → Initiative Owner Handoff. This slice does not delete the route or change Core, Steps, Initiative identity, Adaptive Cycle, permissions, or unrelated Project creation flows.

## 2. Authority

Applied authority: `docs/STARTERIA_AUTHORITY.md`; factual Core authority `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`; product ADR-003, ADR-004 and ADR-005; `PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md`; Handoff acceptance, integration and technical-design contracts; H-TECH-02 through H-TECH-08 reports; and `AGENTS.md`.

No authority conflict was found. ADR-005 explicitly fixes the legacy-route boundary, so no new ADR is required.

## 3. Legacy classification

`/projects/new?challengeId=...` = `NOT_CANONICAL` / `COMPATIBILITY_ONLY` / `DEPRECATION_TARGET`.

The classification is centralized in `front/src/app/routes/legacy-route-boundary.ts` and exercised by the H-TECH-09 route test. Existing consumers use the helper only as an explicit compatibility boundary.

## 4. Search methodology and inventory

Searched tracked repository code and reports for `/projects/new`, `challengeId=`, `ProjectService.createProject`, `createProjectFromPublicDraft`, `updateStep0`, `InitiativePortfolioMeta`, `PortfolioHandoffProjection`, and equivalent Project/Steps materialization. Active behavioral matches were classified in `PORTFOLIO_HANDOFF_LEGACY_ROUTE_CONSUMER_INVENTORY_v0.1.md`; tests, reports and authority references were treated as evidence rather than runtime consumers.

## 5. Canonical paths and frontend findings

Canonical Handoff path: `/handoff/invitations/:token`. Invitation authentication continuation returns to that path. Accept, Reject and Start call Handoff services; `HandoffShell` has no Step navigation or `currentStep`. The route map still exposes `/projects/new` for compatibility and unrelated Project creation. The two existing Challenge → Project UI consumers remain intentionally untouched in behavior and are marked `KEEP_COMPAT`.

## 6. Backend findings

The Handoff application and router contain no calls to `ProjectService.createProject`, `createProjectFromPublicDraft`, `updateStep0`, Step creation, or `InitiativePortfolioMeta` materialization. Assigned Challenge Accept and Start preserve `initiativeId = null`; Start records the bounded Handoff event only. `PortfolioHandoffProjection` is derived/read-only and Portfolio reads it through the existing adapter. Existing Project service and Public Entry/Pilot materializers remain outside Handoff and are inventoried, not removed.

## 7. Consumer status

- `KEEP_COMPAT`: LR-01, LR-02, LR-03, LR-04, LR-07, LR-08, LR-09, LR-10.
- `REPLACE`: none evidenced in this repository.
- `REMOVE_LATER`: LR-05 and LR-06, subject to replacement evidence and explicit migration authority.

Unknown replacement/owner values are recorded as `NOT_YET_DEFINED` / `TBD`; no architecture or owner was invented.

## 8. Retirement triggers and evidence

Retirement requires a replacement, an active-consumer audit, compatibility/regression evidence, and explicit authority. Static route guards and existing consumer tests are the evidence added by this slice. No runtime telemetry platform or noisy warning was introduced.

## 9. Negative guards and tests

Added frontend and backend static quarantine tests. They prove the Handoff route/components/services and backend Handoff module do not reference the legacy route or Project/Step materialization. Existing H-TECH-05 response tests prove Challenge Accept keeps `initiativeId = null`; H-TECH-07 tests prove Challenge Start keeps `initiativeId = null`, emits only `handoff_assignment_started`, and does not emit `initiative_started`. H-TECH-06 shell tests prove the shared shell has no Step/Workspace navigation. Existing legacy consumer tests remain unchanged.

## 10. Acceptance traceability

| AC | Evidence |
|---|---|
| AC-HO-069 | H-TECH-05 Accept test and no materialization in Handoff module |
| AC-HO-070 | Challenge projection/UI tests show no fabricated Initiative |
| AC-HO-071 | Accept and Start are separate commands/states; H-TECH-05/07 tests |
| AC-HO-072 | Reject keeps rejection ownership/state; H-TECH-05 tests |
| AC-HO-073 | Shared `HandoffShell` retained; H-TECH-06 tests |
| AC-HO-074 | No `currentStep` in Handoff/Projection implementation |
| AC-HO-075 | No new Initiative aggregate/table; existing Project identity preserved |
| AC-HO-076 | Core and Steps files/tests were not modified |
| AC-HO-077 | No authority conflict observed; no ADR required |
| AC-HO-078 | Quarantine is bounded; no hidden ADR-triggering refactor |

## 11. Unresolved migration gaps

Replacement and owner for legacy Project/Public Entry/Pilot consumers are `NOT_YET_DEFINED` / `TBD`. The route remains active for compatibility. Retirement telemetry beyond static evidence is not added because no existing trivial convention was identified.

## 12. Final vertical status

H-TECH-09 is technically complete when the focused tests and relevant regression pass: canonical Handoff is free of the legacy route, compatibility consumers are explicit and controlled, and migration debt is documented. This does not authorize merge to main while KAN-53 remains open.
