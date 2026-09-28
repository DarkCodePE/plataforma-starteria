# Portfolio Handoff Start Boundary — H-TECH-07

## 1. Scope

Implemented the bounded `startAssignedWork(assignmentId, actor, expectedVersion, idempotencyKey)` command for the Portfolio Lead → Initiative Owner Handoff vertical. The only material transition is `ACCEPTED → STARTED`. This slice ends after successful Start; H-TECH-08+ behavior is not implemented.

The invariant `handoff_assignment_started != initiative_started` is explicit and tested.

## 2. Authority

Read and applied the requested authority set: `docs/STARTERIA_AUTHORITY.md`, the Core contract references, ADR-003/004/005, the activation experience, acceptance checklist, integration, technical-design and visual/UX-writing contracts, H-TECH-02 through H-TECH-06 reports, current HandoffShell, Handoff services/repositories/routes, event port, and `AGENTS.md`.

`CURRENT_STATE.md` records `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` as non-promoted; the factual Core authority remains unchanged. No authority or Core semantic was redefined.

## 3. Current-state audit

H-TECH-05 already owned Accept/Reject/Portfolio response, claimed invitation identity checks, optimistic versioning, command idempotency records, and the no-op/narrow Handoff event port. H-TECH-06 rendered `Empezar` as a disabled visual-only CTA. The assignment model had no Start audit fields and its persisted enum/command type had no `STARTED`/`START` values.

## 4. Files changed

- `backend/modules/portfolio-handoff/domain/portfolio-handoff-assignment.types.ts`
- `backend/modules/portfolio-handoff/application/portfolio-handoff-response.service.ts`
- `backend/modules/portfolio-handoff/infrastructure/in-memory-portfolio-handoff-assignment.repository.ts`
- `backend/modules/portfolio-handoff/infrastructure/prisma-portfolio-handoff-assignment.repository.ts`
- `backend/modules/portfolio-handoff/portfolio-handoff-invitation.router.ts`
- `backend/modules/portfolio-handoff/__tests__/portfolio-handoff-response.service.test.ts`
- `front/prisma/schema.prisma`
- `front/prisma/migrations/20260928190000_add_portfolio_handoff_start/migration.sql`
- `front/src/features/portfolio-handoff/services/handoffInvitationService.ts`
- `front/src/app/pages/HandoffInvitationPage.tsx`
- `front/src/features/portfolio-handoff/components/HandoffShell.tsx`
- `front/src/features/portfolio-handoff/components/__tests__/HandoffShell.test.tsx`

## 5. Schema/migration changes

Yes, bounded to Handoff. Added `PortfolioHandoffState.STARTED`, `startedAt`, `startedBy`, and `PortfolioHandoffResponseCommandType.START`. No Project, Step, InitiativePortfolioMeta, TeamMember, or Core tables were modified.

## 6. Start command

`PortfolioHandoffResponseService.startAssignedWork` is the canonical application command. The route is authenticated `POST /api/v1/handoff/assignments/:assignmentId/start` and accepts `expectedVersion` plus `idempotencyKey`; clients cannot set arbitrary state.

## 7. State guards

Only `ACCEPTED → STARTED` is accepted. `CREATED`, `SENT`, `VIEWED`, `REJECTED`, `REVOKED`, `EXPIRED`, and repeated `STARTED` are rejected as bounded invalid/revoked/expired outcomes, except an equivalent command retry is idempotent.

## 8. Identity/authz guards

Start requires an authenticated actor, active claimed invitation access, and the canonical assignment `OWNER` member with the same resolved `userId`. Challenge membership, Project ownership, display labels, first member, and Portfolio role are not used to infer Owner authority. Wrong identity returns `IDENTITY_MISMATCH`; a non-owner returns `FORBIDDEN`.

## 9. Optimistic concurrency

`expectedVersion` is required and validated. The repository performs a conditional update on assignment id, `ACCEPTED` state, and expected version. A stale version returns `STALE_VERSION`; the first successful Start increments version exactly once.

## 10. Idempotency

Start uses the existing Handoff command metadata pattern with command type `START`, assignment scope, idempotency key, actor fingerprint, and resulting version. The same equivalent command returns the same logical assignment without a second transition or logical event. A reused key with a different command fingerprint returns `IDEMPOTENCY_CONFLICT`.

## 11. Audit persistence

First successful Start persists `startedAt`, `startedBy`, `state = STARTED`, and the incremented entity version. The audit is reconstructable from the assignment row and is not log-only.

## 12. Existing Initiative behavior

`EXISTING_INITIATIVE` preserves the existing `initiativeId`. Start does not create, duplicate, rename, or otherwise mutate the Initiative identity, Project, Steps, Step 0, or downstream workspace.

## 13. Challenge behavior

`CHALLENGE` Start succeeds with `initiativeId = null`. It does not require or create a Project, Initiative, Step 0, workspace, or `InitiativePortfolioMeta`.

## 14. `handoff_assignment_started` event

The existing narrow event port now accepts `handoff_assignment_started` with `assignmentId`, `targetKind`, optional `initiativeId`, `actorId`, `occurredAt`, and entity `version`. The default no-op adapter remains in place; no outbox, event store, projection, replay, or consumer ordering was added.

## 15. Negative `initiative_started` guard

Start emits no `initiative_started`, `step_entered`, or `step_completed` event. Tests assert that `initiative_started` is absent for Existing Initiative Start. The implementation-scope search found no Start emission; textual mentions are limited to negative tests and authority/contract documentation.

## 16. Frontend Start integration

The Handoff invitation page calls the authenticated Start endpoint with the current canonical version and a client idempotency key. The HandoffShell CTA is wired to the command, disables duplicate clicks through the loading state, exposes `aria-busy`, retains the shell during processing, and renders bounded recoverable errors.

## 17. Terminal Handoff state

Successful `STARTED` renders calm `Trabajo iniciado` confirmation. Accept, Reject, and Start actions are absent after success. No Step route, InitiativeWorkspace route, ProjectHome route, fake progress, or downstream destination is introduced.

## 18. No Core materialization

No Start path calls `ProjectService.createProject`, `createProjectFromPublicDraft`, `updateStep0`, Step creation, `InitiativePortfolioMeta` creation, TeamMember materialization, or Initiative creation. Existing Initiative identity is read/preserved only.

## 19. Tests/results

- Focused H-TECH-07 backend suite: **9 tests passed**.
- Handoff backend regression (H-TECH-02/03/04/05): **26 tests passed across 4 files**.
- Focused HandoffShell suite: **7 tests passed**.
- Full frontend Vitest suite: **passed**.
- Frontend and backend TypeScript typecheck: **passed**.
- Prisma generate: **passed**.
- Prisma validate with placeholder `DATABASE_URL`: **passed**.
- Existing non-failing Radix Dialog ref warning remains in the focused Shell test, as documented by H-TECH-06.

## 20. BR/AC traceability

- BR-HO-039 / AC-HO-048: explicit Start command; Start before Accept rejected.
- BR-HO-040 / AC-HO-050–051: Existing Initiative preserves identity; Challenge starts with null Initiative.
- BR-HO-041 / AC-HO-049, 052: identity/state/revocation/expiry guards, optimistic concurrency, audit persistence, idempotent command and single event.
- BR-HO-042 / AC-HO-053: vertical terminates at successful Start.
- AC-HO-068–071: applicable command, persistence, version/idempotency, narrow event-port and no-premature-materialization protections covered.
- Protected invariant: `handoff_assignment_started != initiative_started`.

## 21. Conflicts

No product-authority conflict was introduced. The repository’s `CURRENT_STATE.md` status for `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` differs from the requested reading list by identifying it as non-promoted; this was preserved and no Core behavior was changed. The current event port is intentionally no-op/in-memory-capable pending H-TECH-08, consistent with the technical design.

## 22. ADR required

No. Existing ADR-003/004/005 and the active Handoff contracts authorize this bounded Start boundary. No Core identity, permission model, team cardinality, Initiative lifecycle, or authority changed.

## 23. H-TECH-08 dependency

H-TECH-08 owns durable event delivery/projection infrastructure and any downstream semantic consumers. This slice supplies only the semantic event through the existing narrow port; it does not implement `PortfolioHandoffProjection`, outbox/event store, replay, ordering, or downstream navigation.

## 24. Final vertical status

**H-TECH-07 implemented and verified for PR review.** The vertical is complete at `ACCEPTED → STARTED → handoff_assignment_started`. It intentionally stops before `initiative_started`, Steps, Project creation, workspace navigation, and all H-TECH-08+ behavior. It is not safe to merge to main while KAN-53 remains open.
