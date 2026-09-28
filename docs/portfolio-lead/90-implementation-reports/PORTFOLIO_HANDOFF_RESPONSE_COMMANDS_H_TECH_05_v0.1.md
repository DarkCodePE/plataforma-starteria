# Portfolio Handoff Response Commands — H-TECH-05

**Estado:** IMPLEMENTED — ready for PR review  
**Jira:** KAN-57  
**Slice:** H-TECH-05 only  
**Boundary:** Accept / Reject / Portfolio response. `Start` remains out of scope.

## 1. Scope

Implemented the canonical response commands for `PortfolioHandoffAssignment`:

- recipient Accept from `SENT` or `VIEWED`;
- recipient Reject from `SENT` or `VIEWED`, with a material reason;
- authorized Portfolio response to a `REJECTED` assignment.

No H-TECH-06 shell, reassignment, Start, projection, outbox, replay, or Core materialization was added.

## 2. Authority

Implementation was checked against:

- `docs/STARTERIA_AUTHORITY.md`;
- `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md`;
- ADR-003 Authentication, ADR-004 Authorization, ADR-005 API design;
- `PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md`;
- handoff acceptance, integration, and technical design contracts;
- H-TECH-02, H-TECH-03, and H-TECH-04 implementation reports;
- current auth middleware, permission derivation, Prisma schema, and handoff repositories.

The Technical Design invariant `Accept != Start` is preserved.

## 3. Current-state audit

H-TECH-02 owned bounded assignment persistence and target references. H-TECH-03 owned invitation access and invited-identity claiming. H-TECH-04 owned delivery lifecycle and delivery idempotency. Before this slice, assignment state stopped at `SENT`/`VIEWED`/`REVOKED`/`EXPIRED` and had no response audit fields or response command API.

## 4. Files changed

- `backend/modules/portfolio-handoff/domain/portfolio-handoff-assignment.types.ts`
- `backend/modules/portfolio-handoff/domain/portfolio-handoff-invitation.types.ts`
- `backend/modules/portfolio-handoff/application/portfolio-handoff-response.service.ts`
- `backend/modules/portfolio-handoff/application/portfolio-handoff-assignment.service.ts` (unchanged behavior; reused)
- `backend/modules/portfolio-handoff/infrastructure/in-memory-portfolio-handoff-assignment.repository.ts`
- `backend/modules/portfolio-handoff/infrastructure/in-memory-portfolio-handoff-invitation.repository.ts`
- `backend/modules/portfolio-handoff/infrastructure/in-memory-portfolio-handoff-response-command.repository.ts`
- `backend/modules/portfolio-handoff/infrastructure/prisma-portfolio-handoff-assignment.repository.ts`
- `backend/modules/portfolio-handoff/infrastructure/prisma-portfolio-handoff-invitation.repository.ts`
- `backend/modules/portfolio-handoff/infrastructure/prisma-portfolio-handoff-response-command.repository.ts`
- `backend/modules/portfolio-handoff/portfolio-handoff-invitation.router.ts`
- `backend/modules/portfolio-handoff/index.ts`
- `backend/app.ts`
- `backend/modules/portfolio-handoff/__tests__/portfolio-handoff-response.service.test.ts`
- `front/prisma/schema.prisma`
- `front/prisma/migrations/20260928170000_add_portfolio_handoff_response/migration.sql`
- this report.

## 5. Schema / migration changes

YES. The bounded migration adds `ACCEPTED` and `REJECTED` state values, accept/reject/Portfolio-response audit fields on `PortfolioHandoffAssignment`, and a unique command metadata table keyed by assignment, command type, and idempotency key. No Project, Step, TeamMember, InitiativePortfolioMeta, or Core tables were changed.

## 6. Accept command

`PortfolioHandoffResponseService.acceptHandoffAssignment` requires an assignment, authenticated actor, expected version, and idempotency key. It validates active invitation access, claimed user identity, Owner membership, state, and version. It persists `ACCEPTED`, `acceptedAt`, `acceptedBy`, and increments version exactly once. Duplicate equivalent requests return the prior logical result without a second transition or event.

Existing Initiative identity is not rewritten. Challenge assignments retain `initiativeId = null`.

## 7. Reject command

`rejectHandoffAssignment` trims and requires a material reason. It accepts only `SENT`/`VIEWED`, persists `REJECTED`, `rejectionReason`, `rejectedAt`, and `rejectedBy`, and increments version once. Accepted, revoked, expired, created, and future started assignments cannot be rejected. Equivalent retries are idempotent.

## 8. Portfolio response command

`recordPortfolioRejectionResponse` requires an authenticated route actor with existing `portfolio:write` permission, a `REJECTED` assignment with a rejection reason, a material response, and an idempotency key. It persists response text and actor/time audit fields without changing state, owner, recipient, target kind, initiative identity, or version.

## 9. Authz / identity guards

Accept and Reject use `authenticate`, active non-revoked/non-expired invitation access, claimed invited user identity, and the `OWNER` member identity. They do not infer authority from display labels, global role alone, project ownership, Challenge membership, or current session alone. Portfolio response uses the existing `requirePermission('portfolio:write')` guard; no global role model was introduced.

## 10. State guards

Valid material transitions are only `SENT → ACCEPTED`, `VIEWED → ACCEPTED`, `SENT → REJECTED`, and `VIEWED → REJECTED`. No rejected/revoked/expired assignment is reactivated.

## 11. Optimistic concurrency

Accept and Reject require `expectedVersion`. In Prisma the response update is an atomic conditional update on assignment id, allowed state, and version. A mismatch returns `STALE_VERSION`; no silent overwrite occurs. Version increments once per successful Accept/Reject. Portfolio response does not alter lifecycle state or version.

## 12. Idempotency

Backend-owned `PortfolioHandoffResponseCommand` metadata records command type, assignment, idempotency key, actor, fingerprint, resulting version, and creation time. Equivalent replay returns the same logical result. Reuse of a key with a different actor/reason/response returns `IDEMPOTENCY_CONFLICT`. Delivery-attempt idempotency remains separate.

## 13. Audit fields

Accept: `acceptedBy`, `acceptedAt`, version. Reject: `rejectedBy`, `rejectedAt`, `rejectionReason`, version. Portfolio response: `portfolioResponseRecordedBy`, `portfolioResponseRecordedAt`, `portfolioResponse`. The command table supplies replay/idempotency evidence.

## 14. Event port boundary

Added the narrow `HandoffEventPort` and semantic events `handoff_assignment_accepted`, `handoff_assignment_rejected`, and `handoff_rejection_response_recorded`. The default adapter is a no-op until H-TECH-08 supplies durable event infrastructure. No event store, outbox, projection, replay, or bus was added.

## 15. Negative Core guards

The response service has no calls to Project creation, public-draft conversion, Step 0, Step creation, TeamMember materialization, InitiativePortfolioMeta creation, Start, or target-kind mutation. Accept only records acceptance.

## 16. Tests / results

- Prisma generate: PASS.
- Prisma validate: NOT RUNNABLE in the current checkout because `DATABASE_URL` is not set; schema generation and backend typecheck pass.
- Backend typecheck: PASS.
- Portfolio Handoff suites H-TECH-02/03/04 plus H-TECH-05: **4 files, 23 tests passed**.
- H-TECH-05 covers valid SENT/VIEWED Accept, audit/version, idempotency, stale version, identity mismatch, revoked state, reason validation, rejection audit, Portfolio response persistence, no lifecycle mutation, and Challenge/Initiative identity preservation.
- Auth/permission middleware regression suite and full backend suite remain recommended before merge review; no frontend code changed.

## 17. BR / AC traceability

- BR-HO-017–021: covered by Accept command, guards, target identity assertions, and no-Start tests.
- BR-HO-022–023: covered by material reason validation, rejection audit, and persisted rejected state.
- BR-HO-024–025: covered by Portfolio permission route, response audit, and no ownership/state mutation.
- BR-HO-026: explicitly not implemented; reassignment remains a separate command/slice.
- AC-HO-019–024: covered by Accept behavior and tests.
- AC-HO-025–031: covered by Reject and Portfolio response behavior and tests.
- AC-HO-067–072: applicable persistence/concurrency/idempotency/event-boundary portions are covered; projection, replay, outbox, and shell portions are not claimed because they belong to later slices.

## 18. Conflicts

No authority conflict was observed. The technical design's future `Start` boundary is represented only as a rejected state guard in the domain type; no Start command, route, event, or persistence transition was implemented.

## 19. ADR required

No. Existing ADR-003/004/005 and the active handoff Technical Design provide sufficient authority. H-TECH-08 may decide the durable event adapter separately.

## 20. H-TECH-06/07/08 dependencies

- H-TECH-06: consumes the response routes; no Shell/UI was added.
- H-TECH-07: may consume the persisted rejection/response data; no reassignment was added.
- H-TECH-08: supplies durable event delivery/projection infrastructure; the current event port is intentionally replaceable.

## 21. Implementation status

H-TECH-05 implemented and tested. Safe for PR review after the standard full backend/auth regression gate. Not safe to merge to main while KAN-53 operational gate remains open.
