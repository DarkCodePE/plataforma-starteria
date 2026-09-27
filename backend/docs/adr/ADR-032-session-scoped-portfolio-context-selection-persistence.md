# ADR-032 — Session-Scoped Portfolio Context Selection Persistence

- **Status:** Accepted
- **Date:** 2026-09-27
- **Decision:** `ACCEPT_DEDICATED_SESSION_SCOPED_CONTEXT_PERSISTENCE`
- **Scope:** Portfolio context selection persistence only
- **Related:** SF-7B.2, SF-7B.2A, SF-7B.2B, SF-7B.2C, ADR-028, ADR-029
- **Implementation:** Not authorized by this document alone

## 1. Status

This ADR is accepted as an architecture decision. Acceptance authorizes only
the explicitly bounded SF-7B.2D implementation scope in section 21. It does
not authorize KAN-41, unrelated runtime work, frontend changes, Step 0–4
changes, or Core/domain changes.

The product ADR index previously recorded approved canonical ADR-027 and
ADR-031; the backend ADR series reached ADR-031. This document uses the next
available number, ADR-032, and is now registered as an approved product ADR.

## 2. Context

SF-7B.2C concluded that Portfolio Context requires a dedicated server-owned
cross-request carrier scoped to an authenticated session/device. Existing
mechanisms do not match the required semantics:

- access JWTs are stateless bearer tokens;
- `RefreshToken` is a rotating authentication credential;
- `PortfolioBootstrapSession` is a user-owned bootstrap workflow;
- `PortfolioEntryPortfolioContinuation` is Entry handoff lineage;
- `User.organizationId` is a denormalized pointer;
- `ScopedPortfolioAccessService` validates a supplied organization but does not
  select one;
- no Express session, Redis store, or equivalent server session exists.

The current authority contract requires:

```text
selection != authorization
```

and requires membership plus global permission or scoped grant revalidation on
every protected Portfolio request.

## 3. Problem

Starteria needs to preserve a selected Portfolio organization across requests
without making that selection a grant, leaking context across sessions, or
silently selecting an organization for a multi-organization actor.

Storing the selection globally on `User` would create account-global context
bleed. Encoding it in JWT or refresh-token state would couple business context
to incompatible authentication credential lifecycles. Reusing Bootstrap or
Continuation would promote lineage into authority.

## 4. Authority affected

This ADR is subordinate to:

1. `docs/STARTERIA_AUTHORITY.md`;
2. factual Core v0.2:
   `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`;
3. approved product ADRs, including ADR-028 and ADR-029;
4. `PORTFOLIO_CONTEXT_AUTHORITY_CONTRACT_SF7B2B_v0.1.md`;
5. `PORTFOLIO_CONTEXT_RUNTIME_DESIGN_SF7B2C_v0.1.md`.

The requested `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` and the named SF-7B.2A
artifact are not materialized in this checkout. This ADR does not infer new
Core semantics from their absence.

## 5. Decision

Starteria will introduce a dedicated server-owned persistence carrier,
conceptually named `PortfolioContextSelection`, scoped to an authenticated
session/device rather than globally to `User`.

The persisted object represents only which organization the session intends to
operate against for Portfolio-scoped experiences. It does not represent or
replace any of the following:

```text
PortfolioContextSelection
≠ Organization
≠ OrganizationMember
≠ OrganizationPortfolioAccessGrant
≠ Permission
≠ Portfolio
≠ StrategicFront
≠ Challenge
≠ Initiative
```

The selection is usable only through this runtime chain:

```text
stored selection
  → actor/session ownership validation
  → current OrganizationMember validation
  → current global portfolio:read OR scoped portfolio:read validation
  → AuthorizedPortfolioContext
```

The final technical name, storage schema, session handle and endpoint shape are
deferred to the implementation slice after this ADR is accepted.

## 6. Semantic classification

`PortfolioContextSelection` is **technical/session authority state**, not a new
canonical business-domain entity.

It records selection intent and lifecycle metadata. It does not create an
Organization, membership, Portfolio, Strategic Front, Challenge, Initiative,
or any Core relation. It cannot grant access by existing in storage.

## 7. Session ownership

The selection belongs to an authenticated session/device context:

```text
User
├── Auth Session A → Org A
└── Auth Session B → Org B
```

A context switch in Session A must not change Session B. Account-global
selection is rejected because two devices or independent sessions may
legitimately work in different organizations.

The current refresh-token family is the closest existing session concept, but
the current access request does not expose that family identifier and the
refresh token has incompatible credential semantics. A later implementation may
associate a context handle with an auth session only through an explicit design;
it must not overload `RefreshToken` silently.

## 8. Selection versus authorization

Persisted selection is never sufficient to authorize a protected request.

The following are mandatory:

- selection establishment validates actor/session ownership and current access;
- every protected Portfolio request revalidates membership;
- every protected Portfolio request revalidates global permission or scoped
  Portfolio grant;
- downstream services receive `AuthorizedPortfolioContext`, not a raw selection;
- stored `validatedAt` metadata, if retained, is historical/debug information
  and cannot replace current validation.

## 9. Single-organization behavior

The ADR accepts the SF-7B.2C proposed policy, subject to product acceptance:

```text
authorized organizations = 0
→ no automatic selection

authorized organizations = 1
→ server may automatically establish selected Portfolio context

authorized organizations > 1
→ context_selection_required
```

Single-organization auto-establishment must derive from the server-computed set
of organizations authorized by membership plus global `portfolio:read` or a
scoped `portfolio:read` grant. It must not derive solely from
`User.organizationId` or browser input.

Concurrent requests may establish the same sole organization idempotently; no
request may establish an organization outside the current authorized set.

## 10. Multi-organization behavior

When more than one valid Portfolio organization exists, the resolver returns
`context_selection_required` and may expose only server-computed authorized
organization summaries.

The browser may submit a candidate organization id. The server must independently
verify:

```text
actor
→ OrganizationMember
→ global portfolio:read OR scoped portfolio:read grant
→ session-owned selection persistence
```

The implementation must not use:

- `organizations[0]`;
- last or most recent membership;
- `User.organizationId` fallback;
- an organization from localStorage, request body or query string as authority;
- a merged multi-organization projection.

## 11. Revalidation

Revalidation is required at context establishment and on every protected
Portfolio request.

Caching may optimize lookups but cannot extend authority past current membership
or permission/grant state. A cached `validatedAt` value is not authorization.

Global `portfolio:read` supplies capability, but does not select an organization.
Scoped `portfolio:read` requires the selected organization to pass membership
and grant validation through the existing scoped-access boundary.

## 12. Revocation and invalidation

The MVP uses lazy request-time invalidation with explicit lifecycle operations:

```text
T0 context selected
T1 membership/grant valid
T2 membership/grant revoked
T3 next protected Portfolio request
T4 current validation fails
T5 selection invalidated/cleared
T6 authority failure; no organization fallback
```

Triggers include membership revocation, grant revocation, removal of the
required global permission, organization inaccessibility, explicit context
switch, logout/session termination, and any later approved expiry policy.

### Physical invalidation model

The smallest compatible model is **soft invalidation with minimal metadata**:

- retain the selection row long enough to support audit/debugging and race-safe
  invalidation;
- mark it invalidated with a reason and timestamp;
- make invalidated rows unusable immediately;
- permit cleanup/expiry deletion later as maintenance, not as the security
  mechanism.

This aligns with existing `AuditLog`-oriented repository patterns while keeping
the persisted object from becoming a historical authorization grant. If the
approved storage design cannot support safe soft invalidation without adding
unnecessary retention, deletion is acceptable only if the invalidation event is
audited separately and no request can restore the deleted selection.

No silent fallback to another organization is allowed after invalidation.

## 13. Persistence requirements

The conceptual carrier may relate to:

```text
auth session/device identity
actor User identity for audit/query support
selected Organization identity
selected/updated timestamps
optional invalidation metadata
```

The authoritative owner is the authenticated session. A `userId` may support
querying or audit but must not make the selection account-global.

Membership or PermissionGrant rows must not be copied into the selection as
authority snapshots. At most, an implementation may retain minimal historical
metadata for diagnostics; runtime authorization always queries current state.

Minimum conceptual data:

```text
session identity
organization identity
selected_at
updated_at
```

Add invalidation timestamp/reason only if required by the chosen soft-
invalidation/audit behavior. Do not persist full permission snapshots.

## 14. Existing model reuse analysis

| Existing mechanism | Semantic fit | Ownership fit | Lifecycle fit | Authority fit | Final decision |
| --- | --- | --- | --- | --- | --- |
| `User.organizationId` | None; denormalized pointer | Account-global | No invalidation lifecycle | Not membership/grant authority | Reject |
| Access JWT | None; stateless auth token | Token/bearer scope | 15-minute expiry, no context switch lifecycle | Not revocation-safe context authority | Reject |
| `RefreshToken` | Low; auth credential | User/family, not context | Rotation/reuse/7-day expiry | Refresh authority, not Portfolio scope | Reject reuse |
| `PortfolioBootstrapSession` | Partial workflow overlap | User-owned workflow | Bootstrap status/phase/abandonment | Organization snapshot only | Reject reuse; candidate/lineage only |
| `PortfolioEntryPortfolioContinuation` | Partial lineage overlap | Continued user | Entry confirmation/conversion lifecycle | JSON scope is not current authority | Reject reuse; candidate/lineage only |
| Express/Redis session | Not present | N/A | N/A | N/A | Not available |
| Dedicated session-scoped carrier | High | Auth session/device | Designed for selection/invalidation | Selection only; revalidation required | Accept with conditions |

## 15. Alternatives considered

### Alternative A — Store selected organization on `User`

**Advantages:** no new table; easy lookup.  
**Disadvantages:** account-global; cannot isolate sessions/devices; changes one
session's context for all sessions.  
**Security:** creates cross-device context bleed and invites pointer-as-authority
use.  
**Semantic mismatch:** User profile/convenience pointer is not session selection.  
**Decision:** Reject.

### Alternative B — Encode selected organization in JWT or refresh token

**Advantages:** no separate selection lookup; natural cross-request transport.  
**Disadvantages:** JWT is client-carried and stale until expiry; refresh tokens
are authentication credentials; token rotation and revocation become coupled to
Portfolio context.  
**Security:** difficult immediate revocation and unclear multi-session scope.  
**Semantic mismatch:** auth credential is not selected work context.  
**Decision:** Reject.

### Alternative C — Reuse Bootstrap/Continuation persistence

**Advantages:** existing rows and lineage available.  
**Disadvantages:** workflow-specific lifecycle; organization snapshots currently
derive from `User.organizationId`; no general multi-org selection.  
**Security:** promotes lineage into authority and risks stale scope reuse.  
**Semantic mismatch:** handoff/bootstrap state is not active session context.  
**Decision:** Reject.

### Alternative D — Request-only context without persistence

**Advantages:** no schema, immediate request-time validation, simple revocation.  
**Disadvantages:** no durable server-owned cross-request selection; browser must
carry a candidate each request; poor fit for restored session context.  
**Security:** can be safe only if every candidate is independently validated,
but does not satisfy the selected-context requirement.  
**Lifecycle:** no established/switch/clear persistence lifecycle.  
**Decision:** Reject as the primary model; retain only as a possible future
stateless mode if separately approved.

### Alternative E — Dedicated auth-session-scoped Portfolio Context persistence

**Advantages:** session isolation, explicit multi-org selection, durable
cross-request continuity, revocation-safe revalidation, reusable boundary.  
**Disadvantages:** new persistence, migration, authority service, selection
boundary, additional authz reads and cleanup.  
**Security:** strongest fit when selection never substitutes for validation.  
**Lifecycle:** can model established, switched, invalidated and cleared states.  
**Decision:** Accepted under the bounded implementation conditions in section
21.

## 16. Security consequences

The decision guarantees, subject to implementation tests:

- no client-controlled organization authority;
- no `User.organizationId` authority;
- no cross-organization reads through a stale selection;
- no stale membership or grant authority;
- no silent multi-org selection;
- no fallback to another organization after revocation;
- no context bleed between independent auth sessions/devices;
- security failures remain authority/scope errors, never empty/unavailable data.

## 17. Core/domain impact

The proposed object is technical/session authority state. It does not:

```text
change Organization domain cardinality: NO
change Portfolio domain semantics: NO
change human authority: NO
expand AI authority: NO
change Step 0–4 semantics: NO
create a new business-domain canonical entity: NO
```

If implementation evidence requires a new canonical Organization-to-Portfolio
relation, changes grant meaning, or promotes selection into business truth,
implementation must stop and this ADR must be superseded or amended before
continuing.

## 18. Migration impact

A future implementation is expected to require a persistence/schema migration
because no compatible existing carrier exists.

Expected blast radius is limited to:

- new context persistence and repository;
- auth/session context binding;
- context selection/resolution services and focused tests;
- future Portfolio consumers that opt into the boundary.

No existing business rows require backfill. The migration can begin with an
empty table/store because there is no canonical selected Portfolio context to
reconstruct safely from `User.organizationId`, Bootstrap, or Continuation.

Rollback implications:

- before activation, roll back the empty persistence structure and resolver;
- after activation, disable new context writes and preserve or clear selection
  rows according to the approved invalidation policy;
- do not roll back by promoting `User.organizationId`, Bootstrap, or
  Continuation to authority;
- keep the authority contract and audit evidence so rollback cannot silently
  restore unsafe semantics.

## 19. Positive consequences

- explicit and deterministic multi-organization behavior;
- cross-request continuity without account-global context bleed;
- independent contexts across sessions/devices;
- safe request-time revocation handling;
- reusable authority boundary for future Portfolio endpoints;
- clear separation between selection, membership and grants;
- no business-data backfill or canonical domain migration.

## 20. Negative consequences

- new persistence/table or equivalent server-side storage;
- likely migration and deployment coordination;
- selection and clear boundaries must be designed and secured;
- every protected request adds membership/grant validation work;
- soft invalidation requires cleanup and audit policy;
- current JWT/refresh infrastructure must expose or associate a session/device
  handle without overloading auth credential semantics;
- SF-7B.2D remains bounded by the accepted ADR and must specify the persistence
  carrier before applying schema changes.

## 21. Implementation authorization

Acceptance authorizes the bounded SF-7B.2D implementation scope below. It does
not authorize implementation outside that scope.

After explicit acceptance and completion of the conditions below, SF-7B.2D may
implement only:

- the context persistence carrier;
- the context selection store;
- the Portfolio Context Authority resolver;
- select/clear boundaries;
- request-time membership and grant/permission revalidation;
- focused security and race-condition tests.

It does not authorize:

- KAN-41 Home plus Strategic Framing composition;
- frontend organization selector or frontend context authority;
- unrelated Home authorization hardening;
- Step 0–4 changes;
- Core/domain relation changes;
- promotion of Bootstrap/Continuation/User pointers into authority.

Conditions governing SF-7B.2D implementation:

1. use an exact auth-session/device binding, not account-global User state;
2. specify the physical persistence and soft-invalidation policy before schema
   changes;
3. review migration and rollback plans before applying them;
4. implement or commit the test matrix below as an agreed test plan;
5. stop if implementation reveals a conflict with higher authority or changes
   Core/domain semantics.

## 22. Required test invariants

Future implementation must protect:

1. zero authorized organizations;
2. single authorized organization auto-establishment;
3. multi-org selection required;
4. valid explicit selection;
5. cross-org attempt denied;
6. browser organization not authoritative;
7. `User.organizationId` ignored as authority;
8. stale selection revalidated;
9. membership revocation;
10. grant revocation;
11. invalidation without fallback;
12. two sessions selecting different organizations;
13. session termination makes selection unusable;
14. global `portfolio:read` path;
15. scoped `portfolio:read` path;
16. security failures are not swallowed or converted to empty/unavailable;
17. concurrent same-org auto-establishment;
18. context switch race does not authorize an unvalidated organization.

## 23. Rollback / reversal

This accepted decision can be superseded before implementation by a later ADR
while keeping KAN-41 blocked. No data or schema rollback is then required.

After implementation, reversal must disable the context resolver/store path,
invalidate or delete context selections according to the approved audit policy,
and preserve request-time authorization. Reversal must not restore any of the
rejected alternatives as authority.

If later evidence shows that session/device persistence changes Core/domain
semantics, this ADR is superseded by a new ADR rather than amended silently.

## 24. Final decision

```text
PORTFOLIO CONTEXT ADR STATUS: ACCEPTED

DECISION: ACCEPT_DEDICATED_SESSION_SCOPED_CONTEXT_PERSISTENCE

Persistence carrier: dedicated PortfolioContextSelection persistence
Session scoped: YES
Server owned: YES
Account global: NO
Canonical business entity: NO

Selection persisted: YES, as selection state only
Authorization persisted: NO
Membership revalidated: YES, on every protected request
Grant revalidated: YES, on every protected request
Browser org authoritative: NO
User.organizationId authoritative: NO

0 org: no automatic selection
1 org: server may auto-establish from server-computed authorized set
>1 org: explicit selection required
Silent selection: NO

Revocation model: lazy request-time invalidation with soft invalidation metadata
Silent fallback: NO
Historical selection retained: MAY be retained for audit/debugging, never authority

New persistence required: YES
Backfill required: NO
Migration expected: YES, later; empty initial store

Organization domain cardinality changed: NO
Portfolio domain semantics changed: NO
AI authority changed: NO
Human authority changed: NO
Step semantics changed: NO

SF-7B.2D: AUTHORIZED within the bounded scope and conditions in section 21
KAN-41: BLOCKED
```
