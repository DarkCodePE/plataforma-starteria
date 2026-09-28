# Portfolio Handoff Shell / Activation Overview — H-TECH-06

**Estado:** IMPLEMENTED — frontend slice; Start intentionally not wired
**Jira:** KAN-58
**Boundary:** Invitation Landing → Accepted / Activation Overview → Rejected state

## 1. Scope

Evolved the existing token-based `HandoffInvitationPage` into the shared `HandoffShell`. The shell keeps one outer anatomy while changing status, explanation, response controls, and pre-Start overview content. No H-TECH-07 Start mutation, Step behavior, Initiative creation, or workspace navigation was added.

## 2. Authority

Checked against `docs/STARTERIA_AUTHORITY.md`, the factual Core authority, ADR-003/004/005, the activation experience, handoff acceptance/integration/technical/UX contracts, DS-08 activation report, Design System contract, Page Anatomy system, E2E visual architecture, H-TECH-02/03/04/05 reports, current primitives, and `AGENTS.md`. The repository’s `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` remains a non-promoted reference as recorded by `CURRENT_STATE.md`; no Core authority was changed.

## 3. Current UI audit

H-TECH-03 provided a minimal invitation page responsible for token read, auth continuation, identity claim, MATCHED/MISMATCH handling, and safe read errors. H-TECH-05 provided backend Accept/Reject commands but no frontend response surface. The page has been evolved in place; there is no second invitation route.

## 4. KEEP / ADAPT / ADD

- **KEEP:** token read, pending-token auth continuation, identity claim, neutral mismatch behavior, lifecycle error handling, backend authority.
- **ADAPT:** invitation page into shell states and H-TECH-05 response integration.
- **ADD:** `HandoffShell`, safe response state fields in the invitation read model, frontend Accept/Reject client methods, accessible Reject Dialog, focused component tests.

## 5. Design System primitives reused

Reused `PageHeader`, `ContextSummary`, `Badge`, `Button`, and the existing Radix-backed `Dialog` composition. No new primitive or parallel Design System was created.

## 6. HandoffShell anatomy

Simple Starteria header, context/type label, assignment identity, supporting context, why it matters, expectations, progressive disclosure for framework/support, and one state-specific action area. Density is comfortable and the layout collapses naturally on small screens.

## 7. Invitation state

MATCHED `SENT`/`VIEWED` renders `Aceptar asignación` as the primary action and `Rechazar` as secondary. Start is absent. Mismatch and unauthenticated identities cannot respond; the invited email is never rendered.

## 8. Accept integration

Accept calls the H-TECH-05 route with `assignmentId`, `expectedVersion`, and a client-generated `Idempotency-Key`. The UI transitions `idle → processing → accepted`, disables duplicate submit, preserves the shell, and surfaces backend errors for retry. No Steps navigation occurs.

## 9. Reject Dialog

Reject opens the existing accessible Dialog primitive. The reason has a visible label, required trimmed validation, accessible inline error, cancel behavior, and submit via H-TECH-05. On success the same shell renders the rejected state. The Dialog warning observed in tests is an existing shared wrapper ref warning and is not altered here.

## 10. Accepted Overview

Accepted state removes Accept/Reject and renders a single primary `Empezar` CTA plus high-level explanation. `onStart` is an explicit unconnected port; the page does not provide it, so the CTA is disabled and cannot execute productive Start.

## 11. Assigned Initiative treatment

`EXISTING_INITIATIVE` keeps the target kind and `initiativeId` in the read model and describes an existing Initiative context. The shell does not become `InitiativeWorkspacePage`, create an Initiative, or display operational navigation.

## 12. Assigned Challenge treatment

`CHALLENGE` is explicitly labeled `Challenge Assignment`. The shell states that no Initiative is associated yet. It does not invent an Initiative title/status, Step status, progress, route map, or execution plan; `initiativeId = null` remains valid.

## 13. Rejected state

Rejected state shows the recorded reason and, when present, Portfolio Lead response as attributed context. It does not restore Accept or Start and does not reassign or reactivate the assignment.

## 14. Start CTA boundary

The string `Empezar` is visual-only in H-TECH-06. No `startAssignedWork`, `handoff_assignment_started`, `startedAt`, Start API call, route, or successful transition was added. Productive Start remains H-TECH-07.

## 15. Responsive

The shell uses a single responsive column by default, switches only supporting context to a two-column layout at medium widths, keeps action controls reachable, and uses native disclosure for secondary information. There is no sidebar or horizontal step map.

## 16. Accessibility

Semantic headings, labeled controls, visible focus styles, keyboard-operable Dialog, focus restoration through the existing Dialog primitive, `role=alert` validation/error messaging, `aria-invalid`/`aria-describedby`, busy button state, and non-color status text are covered.

## 17. Files changed

- `backend/modules/portfolio-handoff/domain/portfolio-handoff-invitation.types.ts`
- `backend/modules/portfolio-handoff/application/portfolio-handoff-invitation.service.ts`
- `front/src/features/portfolio-handoff/services/handoffInvitationService.ts`
- `front/src/features/portfolio-handoff/components/HandoffShell.tsx`
- `front/src/features/portfolio-handoff/components/__tests__/HandoffShell.test.tsx`
- `front/src/app/pages/HandoffInvitationPage.tsx`
- this report

## 18. Tests / results

- HandoffShell component suite: **PASS — 5 tests**.
- Frontend typecheck: **PASS**.
- Backend typecheck: **PASS**.
- Full frontend regression: **PASS** (Vitest suite).
- Full backend regression: **PASS** (Vitest suite; DB-backed integration tests skipped because `DATABASE_URL` is not set).
- Existing Dialog wrapper emits a non-failing React ref warning in the focused test.

## 19. BR / AC traceability

- BR-HO-031–035: shell anatomy, state-specific cognition, response visibility, existing Initiative preservation, and Challenge-without-Initiative treatment covered.
- BR-HO-036–038: rejection reason/visibility, Portfolio response presentation, and no silent reassignment covered.
- AC-HO-038: same shell for Invitation, Accepted, and Rejected.
- AC-HO-039: Accepted Overview presents pre-Start context and a single primary CTA.
- AC-HO-040: **visual CTA only; productive Start behavior is not covered until H-TECH-07**.
- AC-HO-041–043: target-kind treatment, no fictitious Initiative, no execution UI.
- AC-HO-044–046: rejection reason/dialog/state and Portfolio response presentation.
- AC-HO-047: responsive/accessibility shell behavior.
- AC-HO-073: applicable read/response integration and safe terminal behavior covered; downstream Start/projection execution remains out of scope.

## 20. Negative guards

No Start command, Start event, `startedAt`, Step route, Step map/progress, `ProjectService.createProject`, `createProjectFromPublicDraft`, `updateStep0`, Initiative creation, operational sidebar, persistent Copilot rail, or Initiative Workspace was added.

## 21. Conflicts

No product authority conflict observed. The current backend read model lacked presentation context beyond target references; this slice adds only safe state/audit fields already owned by Handoff. It does not expose invited email or change response semantics.

## 22. ADR required

No. Existing ADR-003/004/005 and the active Handoff contracts authorize this bounded adaptation. No Core, authority, cardinality, team, permission, or lifecycle semantic changed.

## 23. H-TECH-07 dependencies

H-TECH-07 must wire the existing `onStart` port to the authoritative Start command, handle optimistic concurrency/idempotency, and define post-Start downstream routing. It may consume the same shell without redesigning its anatomy.

## 24. Status

H-TECH-06 implementation is ready for PR review after the regression results in the handoff. It is not safe to merge to main while KAN-53 remains open.
