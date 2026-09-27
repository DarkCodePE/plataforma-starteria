# PORTFOLIO CONTEXT AUTHORITY RUNTIME — SF-7B.2D

## 1. Base SHA

`24ae64df6d7cf60d6bf8368d0034249c4cc4a0f6`

## 2. Branch

`design/KAN-41-sf7b2-home-authority-composition`

## 3. ADR-032

Accepted. Dedicated, server-owned, auth-session-scoped selection persistence
implemented within the bounded SF-7B.2D scope.

## 4. ADR-033

Accepted. The runtime consumes `authSessionId` from the verified JWT `sid`; it
does not create an AuthSession model or substitute `userId`.

## 5. AUTH-SID-1 dependency

Present on the implementation base. `auth.middleware.ts` exposes
`payload.sid` as `authSessionId`, and `AuthSessionService.isAuthSessionActive`
validates the refresh-token family activity for the actor.

## 6. Prisma model

`PortfolioContextSelection` is technical/session authority state. It stores
`authSessionId`, `actorUserId`, `organizationId`, `selectedAt`, `updatedAt`,
and soft-invalidation metadata. It is not a Portfolio, Organization,
membership, grant, or domain entity.

## 7. Migration

`front/prisma/migrations/20260927120000_add_portfolio_context_selection/migration.sql`

Creates an empty table, foreign keys to the existing User and Organization
models, indexes, and a unique `authSessionId` key. No business data is
backfilled.

## 8. Session ownership

The active-selection uniqueness key is `authSessionId`. `actorUserId` is
persisted for integrity/audit and is never used as the ownership key.

## 9. Persistence store

`PortfolioContextSelectionStore` provides `getActiveSelection`, `setSelection`,
`invalidateSelection`, `clearSelection`, and an internal invalidated-row check.
It performs persistence only; membership, grants, fallback, and auto-selection
remain outside the store.

## 10. Authority service

`PortfolioContextAuthorityService` provides `resolve`, `select`, and `clear`.
It validates session activity first, then current membership and current global
or scoped Portfolio read authority.

## 11. Resolution states

The implementation exposes exactly `available`, `no_context`,
`context_selection_required`, and `not_authorized`. It does not use
`unavailable` for context or authorization failures.

## 12. Single-org auto-establish

One organization from the current server-computed authorized set is persisted
with an atomic `upsert`, then revalidated before returning `available`.

## 13. Multi-org behavior

More than one currently authorized organization returns
`context_selection_required`; no first-row or historical organization is
selected.

## 14. Explicit selection

The candidate organization is treated as untrusted input. The service validates
current membership and global/scoped `portfolio:read` authority before writing.

## 15. Context switch

Selecting another authorized organization updates the one row for the current
`authSessionId`. Other sessions belonging to the same user are untouched.

## 16. Clear

`clear` deletes only the current session's selection. It does not mutate
`User.organizationId`, memberships, grants, or authentication state.

## 17. Membership revalidation

Every establishment and every resolution of an existing selection queries the
current `OrganizationMember` relation. The service does not recreate or infer
membership rules.

## 18. Grant revalidation

Scoped access delegates to the existing `ScopedPortfolioAccessService`; its
membership-plus-grant behavior remains unchanged.

## 19. Auth session validation

Every protected `resolve` and `select` checks
`AuthSessionService.isAuthSessionActive({ actorUserId, authSessionId })` before
trusting or querying an organization selection.

## 20. Revocation

Membership, grant, or global authority loss soft-invalidates the stored row and
returns `not_authorized`. An inactive auth session also invalidates the row.
No invalidated selection is restored automatically.

## 21. Two-session isolation

Covered by focused tests: the same user can resolve Org A in Session A and Org
B in Session B; clearing or switching A leaves B unchanged.

## 22. Race protection

The unique `authSessionId` constraint plus Prisma `upsert` ensures at most one
stored/active row per authenticated session. Concurrent selection tests verify
convergence to one row.

## 23. Legacy/development behavior

Actors without `authSessionId` return `no_context`. No user id, random id,
static development id, browser state, or `User.organizationId` is substituted.

## 24. Files changed

- `front/prisma/schema.prisma`
- `front/prisma/migrations/20260927120000_add_portfolio_context_selection/migration.sql`
- `backend/shared/portfolio-context/portfolio-context.types.ts`
- `backend/shared/portfolio-context/portfolio-context-selection.store.ts`
- `backend/shared/portfolio-context/portfolio-context-authority.service.ts`
- `backend/shared/portfolio-context/__tests__/portfolio-context-authority.service.test.ts`
- this implementation report

No frontend behavior, Portfolio Home composition, Strategic Framing Home
projection, KAN-41, or Step 0–4 files were modified.

## 25. Tests

Focused context/authz tests: passed, 23 tests.

Covered: missing sid, inactive session, zero/one/multiple organizations,
existing selection, global/scoped authority, explicit selection,
cross-organization denial, membership revocation, grant revocation, session
revocation, no fallback, switch, clear, two-session isolation, and concurrent
selection.

## 26. Prisma validation

`prisma validate --schema prisma/schema.prisma`: passed.
`prisma generate`: passed.

## 27. Migration validation

`prisma migrate status`: migration is detected and pending on the configured
`starteria_e2e` database. The migration is empty-initial-store SQL with no
backfill. It was not applied to the shared database during this slice.

## 28. Typecheck

`npm.cmd run typecheck:backend`: passed.

## 29. Diff check

`git diff --check`: passed.

## 30. ADR-032 conformance

PASS. Dedicated session-owned persistence, current membership/authority
revalidation, explicit multi-org selection, soft invalidation, no fallback,
empty migration, and isolation are implemented.

## 31. ADR-033 conformance

PASS. The service requires verified `authSessionId`, validates family activity,
and does not add an AuthSession model or user-id fallback.

## 32. Remaining risks

- Global `portfolio:read` follows the repository's current actor permission
  derivation (`permissionsForRoles` from the verified token roles); role-change
  refresh-token revocation remains the existing mechanism for session freshness.
- Full backend regression had 1 unrelated integration failure caused by an
  existing unique grant in the shared database; 1150 tests passed and 84 were
  skipped.
- Migration deployment to a clean disposable database remains a release-side
  validation step; the configured shared database was intentionally left
  unchanged.

## 33. KAN-41 readiness

READY for a later KAN-41 consumer boundary, subject to its own implementation
scope and tests. KAN-41 was not implemented here.
