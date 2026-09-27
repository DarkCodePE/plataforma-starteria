# Starteria — Portfolio Context Runtime & Persistence Design — SF-7B.2C

**Document status:** GO_WITH_GAPS
**Design type:** Technical design / ADR assessment
**Date:** 2026-09-27
**Runtime implementation:** NOT IMPLEMENTED
**Prisma/schema change:** NONE IN THIS SLICE
**KAN-41:** BLOCKED / NOT IMPLEMENTED

This document selects the smallest secure runtime direction for Portfolio
Context Authority. It defines no production code, endpoint, cookie contract,
Prisma model, migration, frontend behavior, or Home composition.

## 1. Executive summary

The current authentication system does not provide a reusable server-side
session in which Portfolio context can safely live:

- access JWTs are stateless, client-carried bearer tokens with a 15-minute TTL;
- the persisted refresh-token family is an authentication credential, not a
  selected work context and does not identify a Portfolio organization;
- `PortfolioBootstrapSession` and
  `PortfolioEntryPortfolioContinuation` are owned workflow/lineage records,
  not context authority;
- `User.organizationId` is explicitly denormalized and insufficient authority;
- no Redis or Express server-session store is present.

The recommended runtime model is therefore:

```text
dedicated server-owned Portfolio Context persistence
  + session/device scope
  + actor binding
  + request-time membership and permission/grant revalidation
  + lazy invalidation
```

This is `PERSISTENCE_C`: new dedicated persistence is required for a durable,
server-owned, session/device-specific selected context. It should not be
implemented until the persistence/authority ADR assessment is resolved.

The next implementation slice must stop at:

```text
authenticated actor
→ Portfolio Context Authority
→ AuthorizedPortfolioContext
```

It must not integrate KAN-41 or change Portfolio Home composition.

## 2. Inputs from SF-7B.2B

The active contract establishes:

```text
selection != authorization
authentication != Portfolio context
Portfolio context != Portfolio scope authority
```

The runtime must be server-owned, actor-bound, organization-scoped,
revalidated on context establishment and every protected request, safe after
revocation, explicit under multi-organization ambiguity, and independent from
browser authority.

The proposed single-organization product policy for this design is:

```text
0 valid authorized organizations → no automatic context
1 valid authorized organization  → server may auto-establish it
>1 valid authorized organizations → explicit selection required
```

The single-organization auto-establishment is based only on the server-computed
authorized organization set. It must never use `User.organizationId` alone or a
browser organization identifier.

The factual Core authority remains
`doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`; the requested
`docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` and the named SF-7B.2A artifact are
not materialized in this checkout. This design does not infer additional Core
semantics from that absence.

## 3. Existing runtime/session inventory

### 3.1 Authentication and session mechanisms

| Mechanism | Path / storage | Lifecycle / owner | Browser-controllable | Server-validated | Org-aware | Revocation-aware | Auditable | Portfolio Context use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Access JWT | `backend/modules/auth/token.service.ts`; client-held bearer token | 15 minutes; issued for authenticated user | Yes, as bearer credential | Signature, issuer, audience and expiry | No organization/context claim | Not before expiry; role/permission token state can be stale within TTL | Request logs redact token; token itself is not an audit record | Do not store context here |
| Refresh token family | `RefreshToken` in `front/prisma/schema.prisma`; raw value HTTP-only `starteria_rt` cookie | 7 days; family owned by user login/device lineage | Cookie is sent by browser but HTTP-only | Hash lookup, expiry, rotation and reuse detection | No organization/context field | Yes, `revokedAt`, family revocation and logout | Auth logs plus token timestamps; no context audit semantics | Do not overload with Portfolio context |
| Express session / Redis | No implementation found; `cookie-parser` only | None | N/A | N/A | N/A | N/A | N/A | Not available |
| Portfolio Entry session | `PortfolioEntrySession`; DB-backed pre-canonical workflow | TTL/expiry and lifecycle; actor/session owner | Public token is client-carried for public Entry flow | Token hash, ownership and lifecycle checks | No authoritative Portfolio org scope | Expiry/abandonment; not Portfolio grant revocation | Session metadata and execution records | Candidate/lineage only |
| Entry continuation | `PortfolioEntryPortfolioContinuation` | Created after validated handoff/confirmation; owned by `continuedByUserId` | Continuation id appears in destination route | Ownership and permission checks on reads | Stores JSON `portfolioScope`, currently from `User.organizationId` | No independent selected-context lifecycle | Continuation timestamps and related records | Candidate/lineage, not authority |
| Bootstrap session | `PortfolioBootstrapSession` | Workflow session owned by `userId`; status/phase/abandonment | Session id is addressable by client routes | Owner checks and Portfolio permission checks | Nullable organization snapshot, currently from `User.organizationId` | Abandonment/workflow lifecycle, not grant revocation | `AuditLog` events and session timestamps | Candidate/lineage, not authority |
| User organization pointer | `User.organizationId` | Denormalized convenience pointer | Not directly a browser input, but exposed through server reads | Scalar lookup only | Yes as a hint, not membership authority | No | User update/audit behavior is not context audit | Never sole authority |
| Organization membership | `OrganizationMember` | Durable membership relation | No | Server DB query | Organization-aware | Removal/cascade changes access | Row timestamps; domain audit may exist | Required validation input |
| Scoped Portfolio grant | `OrganizationPortfolioAccessGrant` | Durable unique `(userId, organizationId, capability)` row | No | Server DB query through `ScopedPortfolioAccessService` | Organization-aware | Row absence/deletion means no current grant; no `revokedAt` field | Row timestamps; grant lifecycle audit is separate | Required validation input |
| Browser UI cookies | Sidebar/UI cookies in frontend; no Portfolio authority cookie | UI preference | Yes | Not authority-validated for Portfolio | No | No | No | Not usable |

The inventory shows no existing mechanism that simultaneously provides a
server-owned selected context, session/device isolation, actor ownership,
multi-org selection, and revocation-safe restoration.

### 3.2 Relevant implementation evidence

- `authenticate` verifies a JWT and derives permissions from token roles; it
  does not load a server session or Portfolio context.
- `RefreshToken` rotation is server-backed, but the access request does not
  carry the refresh-token family identity.
- `ScopedPortfolioAccessService` accepts `userId + organizationId + capability`
  and answers whether access exists; it does not choose an organization.
- `PortfolioHomeReadService.getHome(userId)` currently queries Home data without
  an `AuthorizedPortfolioContext` boundary.
- Bootstrap creation copies `user.organizationId` into the bootstrap session.
- Continuation creation copies `user.organizationId` into JSON `portfolioScope`.

## 4. Persistence options

Scores use `HIGH`, `MEDIUM`, or `LOW` for suitability; `schema impact` and
`migration impact` describe cost/risk, not desirability.

| Option | Security | Server ownership | Multi-org | Cross-request | Revocation | Auditability | Complexity | Semantic fit | Schema impact | Migration impact | ADR risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. Existing authenticated session | LOW | LOW/MEDIUM | LOW | MEDIUM | LOW/MEDIUM | LOW | MEDIUM | LOW | LOW initially | MEDIUM | MEDIUM |
| B. Existing server-side context/session model | MEDIUM | MEDIUM | MEDIUM | HIGH | MEDIUM | MEDIUM | MEDIUM | LOW/MEDIUM | MEDIUM | MEDIUM | MEDIUM/HIGH |
| C. Adapt bootstrap/continuation | LOW/MEDIUM | MEDIUM | LOW | HIGH | LOW/MEDIUM | MEDIUM | LOW | LOW | LOW initially | HIGH semantic migration | HIGH |
| D. New dedicated Portfolio Context persistence | HIGH | HIGH | HIGH | HIGH | HIGH with request checks | HIGH | MEDIUM/HIGH | HIGH | HIGH | MEDIUM | HIGH if domain authority |
| E. Request-only resolution | HIGH per request | MEDIUM | HIGH with explicit candidate | LOW | HIGH | LOW | LOW | LOW for durable selection | NONE | NONE | LOW |

### Option A — Existing authenticated session

No existing server-side authenticated session exists. Putting an organization
claim in the access JWT would make context account/token scoped rather than
session/device scoped, would require token issuance/refresh coupling, and would
not provide immediate revocation. Reject.

### Option B — Existing server-side context/session model

The closest model is `RefreshToken`, but it represents refresh credentials. It
has no context lifecycle, organization scope, selected-at/validated-at fields,
or request-visible family identifier. Reusing it would couple auth credential
semantics to Portfolio work context and risk account/device ambiguity. Do not
reuse silently.

### Option C — Adapt bootstrap/continuation

Both records represent a user journey and its source lineage. They are not
general-purpose context selectors, do not support multi-org selection, and
currently carry organization values derived from `User.organizationId`. Adapting
them would turn workflow lineage into authority and would require semantic
migration. Reject for the MVP.

### Option D — New dedicated persistence

A dedicated server-owned context store can be actor-bound and session/device
scoped, can preserve selected organization and lifecycle, and can be restored
only after current access validation. It is the best semantic fit. It requires
an explicit persistence/ADR decision before schema work.

### Option E — Request-only resolution

Request-only resolution is safe for authorization if every request supplies a
candidate and the server validates it, but it does not provide a durable
server-owned selected context across requests. It also makes the browser carry
selection state and cannot satisfy the selected-context UX without adding an
external session carrier. It is insufficient as the Portfolio Context runtime
model, though it remains a safe fallback for a future explicitly stateless
selection flow.

## 5. Semantic reuse matrix

### Model: `PortfolioBootstrapSession`

```text
CURRENT SEMANTICS: Portfolio bootstrap workflow and derived Portfolio reading
CURRENT OWNER: userId / bootstrap workflow
CURRENT LIFECYCLE: status + bootstrapPhase + abandonment
CURRENT AUTHORITY: owner/workflow access; organizationId is a snapshot
CURRENT EXPIRY: no dedicated context expiry; workflow lifecycle applies

PORTFOLIO CONTEXT REQUIREMENTS:
actor-bound selected organization, multi-org selection, current revalidation,
revocation safety, session/device isolation, explicit invalidation

semantic match: partial
ownership match: partial
lifecycle match: no
authority match: no
revocation match: no

DECISION: DO NOT REUSE as Portfolio Context persistence
```

### Model: `PortfolioEntryPortfolioContinuation`

```text
CURRENT SEMANTICS: validated Entry continuation and handoff lineage
CURRENT OWNER: continuedByUserId
CURRENT LIFECYCLE: created after confirmation; tied to Entry session/conversion
CURRENT AUTHORITY: continuation access; portfolioScope is JSON lineage
CURRENT EXPIRY: inherited Entry/session lifecycle; no context lifecycle

PORTFOLIO CONTEXT REQUIREMENTS:
selected server-owned context and independent current organization authority

semantic match: partial
ownership match: partial
lifecycle match: no
authority match: no
revocation match: no

DECISION: DO NOT REUSE as Portfolio Context persistence; retain as candidate /
lineage input
```

### Model: `RefreshToken`

```text
CURRENT SEMANTICS: rotating authentication refresh credential
CURRENT OWNER: authenticated user and refresh-token family
CURRENT LIFECYCLE: issued, rotated, expired, revoked, reuse-detected
CURRENT AUTHORITY: proves refresh capability, not Portfolio scope
CURRENT EXPIRY: 7 days

PORTFOLIO CONTEXT REQUIREMENTS:
session/device context, organization selection, explicit switch, request-time
membership/grant revalidation, context auditability

semantic match: no
ownership match: partial
lifecycle match: partial
authority match: no
revocation match: partial

DECISION: DO NOT REUSE as the context record; a future implementation may
associate a context session with an auth family only through an explicit design
and ADR review
```

### Field: `User.organizationId`

```text
CURRENT SEMANTICS: denormalized convenience pointer
CURRENT OWNER: User record
CURRENT LIFECYCLE: user/profile data lifecycle
CURRENT AUTHORITY: explicitly not membership authority
CURRENT EXPIRY: none

PORTFOLIO CONTEXT REQUIREMENTS:
selected context and current scoped authority

semantic match: no
ownership match: no
lifecycle match: no
authority match: no
revocation match: no

DECISION: DO NOT REUSE as Portfolio Context authority
```

## 6. Selected runtime model

### 6.1 Selection storage

Use **dedicated server-side Portfolio Context persistence**, scoped to an
authenticated session/device context rather than globally to the user account.
The storage mechanism remains a SF-7B.2D/ADR decision; this document does not
freeze a table or exact schema.

The server-side record must be actor-bound and contain, conceptually:

```text
contextId
actorUserId
authSessionOrDeviceBinding
selectedOrganizationId
selectionState
authorityState
selectedAt
validatedAt
invalidatedAt / invalidationReason
createdAt / updatedAt
```

`selectedOrganizationId` is selection state. It is never a substitute for a
current membership/grant query.

### 6.2 Why session/device scope

Selection should be session/device-specific for the MVP:

- two tabs may intentionally work in different organizations;
- two devices may legitimately maintain different work contexts;
- account-global selection creates surprising cross-device switches;
- account-global state would make context switching in one session affect other
  active work without an explicit user action there.

The server may use an opaque, actor-bound context handle carried by an
authenticated session boundary. The handle is only a lookup key; possession of
it never grants organization access.

### 6.3 Ownership

The authenticated actor owns the selected context. A context must not be
readable, restorable, or switchable by another actor, even if its identifier is
known. The auth-session/device binding prevents accidental account-global
reuse; request-time actor checks remain mandatory.

## 7. Context lifecycle

```text
authenticated request
        ↓
load actor-bound selected context
        ↓
if none:
  compute current authorized organization set
        ↓
  0 → no_context / not_authorized
  1 → server auto-establish selected context
  >1 → context_selection_required
        ↓
if selected context exists:
  validate ownership/integrity
  validate membership
  validate global portfolio:read OR scoped grant
        ↓
valid → AuthorizedPortfolioContext
invalid/revoked → invalidate stored selection
                     → stale / not_authorized
```

No invalidation path silently selects a replacement organization. A replacement
requires a new explicit selection flow or a newly approved single-org
auto-establishment decision based on a fresh authorized set.

## 8. Single-organization policy

The proposed policy is accepted for runtime design:

- **zero:** do not auto-establish; return `no_context` or
  `not_authorized` according to whether a candidate existed;
- **one:** server may atomically establish the only organization in the
  authorized set as session/device selection;
- **more than one:** require explicit selection.

Auto-establishment must use the result of server-side enumeration through
membership plus global permission or scoped grant validation. It must not read
`User.organizationId` as the answer and must not consume a browser candidate.

The single-org operation must be idempotent under concurrent requests: two
requests may establish the same sole organization, but neither may establish an
organization outside the computed authorized set.

## 9. Multi-org policy

For more than one currently authorized organization:

```text
status: context_selection_required
options: server-computed authorized organization summaries only
```

Options may expose stable organization identifiers/names only after the server
has computed that the actor is authorized for each option. The options list is
not itself a grant, and the final selection must revalidate the chosen option.

No first-row, most-recent, `User.organizationId`, or merged-organization
fallback is permitted.

## 10. Explicit selection

The future backend interface is conceptually:

```text
selectPortfolioContext(actor, proposedOrganizationId, authSession/device)
        ↓
server validates organization exists
        ↓
server validates OrganizationMember
        ↓
server validates global portfolio:read OR scoped portfolio:read grant
        ↓
server persists actor/session-bound selection
        ↓
returns selected state or AuthorizedPortfolioContext boundary result
```

The browser may propose `organizationId`; it cannot establish it. An explicit
selection of another actor's organization, a revoked organization, or a
non-member organization is a forbidden/invalid scope attempt, not
`context_selection_required` and not `unavailable`.

No endpoint is implemented or frozen by this design.

## 11. Revalidation

Revalidation is **selection + every protected request**:

1. context establishment validates actor binding, organization existence,
   membership and global/scoped Portfolio read authority;
2. every protected Portfolio request reloads or safely resolves the selected
   context and repeats membership and permission/grant validation;
3. only then does it create an `AuthorizedPortfolioContext` for downstream
   reads;
4. permission or grant caches may reduce query cost but must not extend
   authority beyond current revocation semantics.

The access JWT's role-derived permissions are not a substitute for scoped grant
validation. Global `portfolio:read` provides capability, while the resolver
still supplies one server-selected organization scope.

## 12. Revocation and invalidation

The MVP uses **hybrid invalidation**:

- **lazy security invalidation:** every protected request discovers membership,
  grant, permission, organization, or context-integrity revocation and marks
  the selected context stale/revoked;
- **explicit invalidation:** context switch and logout/session end invalidate
  the current selection;
- **no event architecture:** no eager event bus is introduced without existing
  infrastructure and a separate design decision.

Triggers:

| Trigger | Required result |
| --- | --- |
| Membership revoked | Next protected request rejects context and prevents scoped read |
| Scoped grant revoked | Next protected request rejects context and prevents scoped read |
| Global permission removed | Next protected request rejects context if no scoped grant remains |
| Organization inaccessible/deleted | Context becomes invalid; no fallback |
| Explicit context switch | Old context is invalidated for that session/device before new selection is stored |
| Logout / auth session end | Context is invalidated or made unreachable with the auth session |
| Context expiry, if introduced | Context is stale; new selection required |

Normative sequence:

```text
T0 actor selects Org A
T1 membership/grant is valid
T2 membership or grant is revoked
T3 actor requests Portfolio Home
T3 → selected context is loaded but fails current validation
T3 → context is invalidated/stale
T3 → no Strategic Framing access and no cross-org fallback
```

## 13. AuthorizedPortfolioContext

Recommended runtime boundary, adjusted to repository permission conventions:

```ts
type AuthorizedPortfolioContext = {
  actorUserId: string;
  organizationId: string;
  permissions: ReadonlySet<Permission>;
  authoritySource:
    | 'global_permission'
    | 'validated_scoped_access'
    | 'server_context';
  contextId: string;
  validatedAt: Date;
};
```

Downstream requires actor identity, one non-null organization scope, effective
permissions, source of validated authority, context identity and validation
timestamp. It does not require raw browser candidates, continuation payloads,
bootstrap source text, or User profile pointers.

`PortfolioHomeReadService` should consume this boundary when its organization
scoped behavior is implemented. `StrategicFramingHomeProjectionService` needs
the actor id, organization id and effective permissions for its existing
organization-scoped projection contract. Neither service should derive scope
from `userId`.

## 14. PortfolioContextResolution

The resolver result is separate from authorized success:

```ts
type PortfolioContextResolution =
  | { status: 'available'; context: AuthorizedPortfolioContext }
  | { status: 'no_context'; reason: 'no_authorized_organization' | 'no_selection' }
  | {
      status: 'context_selection_required';
      options: ReadonlyArray<{ organizationId: string; name: string }>;
    }
  | { status: 'not_authorized'; reason: string };
  | { status: 'invalid_context'; reason: string };
```

Organization options are computed from current server-side authorization. A
browser-supplied list is never accepted. `available` is the only result that
can cross the downstream scope boundary.

## 15. Proposed components

### PortfolioContextAuthorityService

```text
responsibility: resolve, establish, restore, revalidate and invalidate context
inputs: actor identity, effective permissions, server context handle, optional
        untrusted organization candidate
outputs: PortfolioContextResolution
dependencies: context store, organization membership queries,
              ScopedPortfolioAccessService, permission catalog
forbidden responsibilities: Home composition, browser trust, deriving authority
                            from User.organizationId, choosing first org
```

### PortfolioContextSelectionStore

```text
responsibility: persist/retrieve actor- and session/device-bound selection state
inputs: server-owned context identity and lifecycle state
outputs: stored selection record or no record
dependencies: selected persistence mechanism, audit/invalidation support
forbidden responsibilities: deciding membership/grants, granting access,
                            interpreting Entry or Bootstrap lineage
```

### ScopedPortfolioAccessService

```text
responsibility: answer whether actor may access a specified organization and
                capability
inputs: userId, organizationId, capability
outputs: boolean / future explicit validation result
dependencies: User, Organization, OrganizationMember,
              OrganizationPortfolioAccessGrant
forbidden responsibilities: selecting organization, storing active context,
                            choosing a fallback, interpreting browser input
```

No additional resolver abstraction is justified until SF-7B.2D confirms the
store and authority service boundaries.

## 16. Session/device semantics

The recommended scope is **auth-session/device-specific**, not account-global.

The current refresh-token family is the nearest auth-session concept, but the
existing request path does not expose its family identifier to authenticated
requests. SF-7B.2D must therefore either introduce a server-owned context
handle associated with the auth session or explicitly choose another
session/device carrier. It must not assume the current JWT alone provides this
identity.

Implications:

- two sessions for one actor may select different organizations;
- two tabs sharing one browser session may share the same context unless a
  later product design introduces tab-level isolation;
- two devices can maintain different selections;
- logout invalidates the context reachable through that auth session;
- account-wide permission revocation still wins through request-time checks.

## 17. Race and consistency considerations

### Concurrent context switch

The store must use an atomic version/updated-at or equivalent compare-and-set
when replacing a selection. Last-write-wins is acceptable for the selection
record if each request revalidates the final stored organization; no request may
use a context that failed authorization.

### Grant revoked immediately after selection

The selection transaction may complete before revocation. The next protected
request revalidates and denies access. A database transaction is not assumed to
span future requests.

### Membership changed between context load and data query

The resolver validates before handing off the authorized context. The MVP
guarantee is request-bound validation, not serializable locking across all
subsequent reads. Data queries must still include the resolved organization
scope; no cross-org fallback is permitted.

### Two tabs selecting different organizations

With session/device scope, the selected context is shared if both tabs share the
same auth session. A later selection may replace the shared selection. Tab-level
parallel contexts are out of scope for the MVP and would require a separate
client/session identity design.

## 18. Security analysis

The design protects:

- browser organization input is only a candidate;
- `User.organizationId` is never sole authority;
- every organization read receives one validated organization id;
- multi-org contexts never fall back to first row or merge data;
- stale selections cannot produce `AuthorizedPortfolioContext`;
- revocation wins on the next protected request;
- continuation/bootstrap cannot transfer authority transitively;
- security exceptions remain context/auth errors and are not `empty` or
  `unavailable`;
- global permission and scoped grant paths are both revalidated;
- options exposed for multi-org selection come from current server authority.

## 19. Test plan

SF-7B.2D must add focused tests for:

- zero authorized organizations;
- single authorized organization auto-establishment;
- multi-org requiring selection;
- valid explicit selection;
- browser-provided invalid organization ignored/rejected;
- other-organization selection attempt;
- revoked membership;
- revoked grant;
- stale stored context;
- cross-org isolation;
- explicit context switch;
- context clear/logout;
- protected-request revalidation;
- global `portfolio:read` authority;
- scoped `portfolio:read` authority;
- two session/device contexts with independent selections;
- concurrent same-org auto-establishment;
- concurrent context switch compare-and-set behavior;
- technical resolver failure;
- no security error swallowed as `read_failed`.

KAN-41 must later add composition tests for empty authorized SF projection,
technical downstream SF failure, canonical Home failure, and no SF query when
context resolution is not available.

## 20. Persistence decision

```text
PERSISTENCE_C — new dedicated Portfolio Context persistence required
```

Evidence:

- no existing server session store exists;
- JWT is stateless and unsuitable for revocation-safe selected context;
- RefreshToken is an auth credential with incompatible semantics;
- Bootstrap and continuation are lineage/workflow records;
- request-only resolution cannot provide durable server-owned selection;
- session/device scope and explicit invalidation need a dedicated lifecycle.

No schema, table, cookie, endpoint, or migration is selected by this document.

## 21. Prisma decision

```text
PRISMA_REQUIRED_LATER
```

The recommended dedicated persistence cannot be safely represented by the
current models without semantic overloading. A later implementation may require
a new model or an explicitly approved session/context persistence extension.
No Prisma edit or migration is authorized in SF-7B.2C.

## 22. ADR decision

```text
ADR_REQUIRED_ONLY_IF_NEW_PERSISTED_DOMAIN_MODEL
```

Creating a service alone is not an ADR trigger. An ADR becomes necessary if
SF-7B.2D introduces a new persisted entity that is treated as canonical
Portfolio authority, changes grant/permission meaning, creates a new Core/domain
relation, or defines durable account/session authority semantics beyond existing
infrastructure.

Because the recommended option is dedicated persistence and its ownership and
lifecycle are not represented by an existing compatible model, SF-7B.2D must
complete the ADR assessment before schema implementation. If the approved
design classifies the store as non-domain infrastructure and changes no product
authority semantics, the ADR may be narrowed accordingly, but that decision
must be explicit.

## 23. Implementation slice SF-7B.2D

The smallest next slice is **Portfolio Context Persistence & Authority
Resolver**, not KAN-41:

1. approve the persistence/authority ADR assessment;
2. define the session/device context carrier and ownership boundary;
3. define the persistence contract and, only after approval, schema/migration
   if required;
4. implement the selection store;
5. implement context resolution and request-time revalidation;
6. implement explicit selection/clear interfaces as contract-compatible
   backend boundaries;
7. add the focused security/race tests in this document;
8. expose only `PortfolioContextResolution` /
   `AuthorizedPortfolioContext` to future consumers.

Exit criterion:

```text
actor
→ Portfolio Context Authority
→ AuthorizedPortfolioContext
```

No Portfolio Home composition, Strategic Framing Home query, frontend
consumption, Prisma migration, or KAN-41 work belongs in the slice unless
separately authorized by the resulting ADR and implementation plan.

## 24. KAN-41 impact

KAN-41 remains blocked until SF-7B.2D produces a validated
`AuthorizedPortfolioContext` boundary and its negative/security tests pass.
KAN-41 must then consume that boundary; it must not become the context selector,
membership validator, grant resolver, or persistence owner.

## 25. Open questions

- What exact server-owned handle binds the context store to the current auth
  session/device, given that current access JWTs do not carry refresh-family
  identity?
- Should the selected context be shared across tabs in one browser session, or
  is a tab-specific context required later?
- What audit event vocabulary is required for selection, switch, clear, stale,
  and revocation?
- Does the single-org auto-establishment require explicit product ADR approval
  before it becomes active behavior?
- Is the new persistence treated as domain authority or infrastructure session
  state for ADR classification?
- What existing route or future endpoint should expose authorized organization
  options to an actor without creating a second Home composition path?

## 26. Final decision

```text
SF-7B.2C STATUS: GO_WITH_GAPS

RUNTIME MODEL:
Selected mechanism: dedicated server-owned Portfolio Context persistence
Server-owned: YES
Cross-request: YES
Session or account scoped: auth-session/device scoped
Single-org auto establishment: YES, from server-computed authorized set only
Multi-org explicit selection: YES
Revocation behavior: lazy request-time invalidation; no silent fallback

PERSISTENCE:
Decision: PERSISTENCE_C
Existing model reused: NO; existing records remain candidates/lineage
New persistence required: YES, subject to ADR/design approval

AUTHORIZED CONTEXT:
Runtime boundary defined: YES
Membership revalidated: YES
Grant revalidated: YES
Every protected request: YES

SECURITY:
Browser org authority: NO
User.organizationId authority: NO
Silent multi-org fallback: NO
Cross-org protection: YES

ADR:
Decision: ADR_REQUIRED_ONLY_IF_NEW_PERSISTED_DOMAIN_MODEL
Reason: a new canonical/persisted authority lifecycle would change durable
       context semantics; a service alone does not trigger ADR

PRISMA:
Decision: PRISMA_REQUIRED_LATER
Migration required now: NO

NEXT:
READY FOR SF-7B.2D IMPLEMENTATION: NO — ADR/persistence carrier approval first
READY FOR KAN-41: NO

Files expected in SF-7B.2D:
- approved ADR or explicit ADR disposition;
- context persistence contract/store;
- Portfolio Context Authority resolver;
- selection/clear boundary contract;
- focused authority, revocation, multi-org and race tests;
- no Home composition changes.

Tests required: the SF-7B.2D matrix in section 19
Remaining blockers: persistence carrier, ADR classification, audit vocabulary,
                  and exact session/device handle
```
