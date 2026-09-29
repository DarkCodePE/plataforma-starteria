# Portfolio Handoff Identity Continuation — H-TECH-03

**Jira:** KAN-54
**Branch:** `feat/KAN-54-handoff-identity-continuation`
**Status:** IMPLEMENTED — invitation access, authentication continuation, and identity claim only

## Scope

Implemented the bounded flow:

```text
opaque invitation token → safe public read → existing auth → same invitation restored
→ normalized authenticated identity match → idempotent invited-user association
```

The canonical lifecycle remains `PortfolioHandoffAssignment`. The new
`PortfolioHandoffInvitation` record stores only bearer-access metadata and does
not duplicate assignment target, team, or business state.

No Accept, Reject, Portfolio response, Start, Project, TeamMember, Initiative
Core, or Step behavior was added.

## Implementation

- 32-byte random invitation credentials are returned only at issuance time.
- SHA-256 hashes are persisted; raw credentials and invited email are not in the public preview.
- Public `GET /api/v1/public/handoff-invitations/:token` returns minimal assignment context.
- Authenticated `POST /api/v1/public/handoff-invitations/claim` returns explicit identity results and requires the existing JWT middleware.
- Matching uses normalized authenticated email versus `PortfolioHandoffAssignment.invitedEmailNormalized`.
- Matching associates the unresolved owner member only after a successful match.
- Mismatch, invalid, expired, and revoked credentials do not mutate assignment identity or create downstream state.
- Repeated matching claims are idempotent.
- Frontend route `/handoff/invitations/:token` preserves an opaque session-storage return context through the existing `/auth` page.

## Evidence

- H-TECH-03 focused suite: **5 tests passed**.
- H-TECH-02 regression suite: **8 tests passed**.
- Backend TypeScript check: **passed**.
- Frontend TypeScript check: **passed**.
- Prisma schema validation: **passed** with a local placeholder `DATABASE_URL`.

## Persistence / ADR treatment

ADR-005 explicitly allows a narrow invitation/access representation while keeping
`PortfolioHandoffAssignment` as lifecycle owner. No new ADR is required.
