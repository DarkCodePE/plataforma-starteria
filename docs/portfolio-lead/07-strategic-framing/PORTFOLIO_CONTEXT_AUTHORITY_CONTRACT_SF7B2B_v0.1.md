# Starteria — Portfolio Context Authority Contract — SF-7B.2B

**Document status:** GO_WITH_GAPS  
**Contract type:** Authority / Experience Contract  
**Date:** 2026-09-27  
**Runtime implementation:** NOT IMPLEMENTED BY THIS SLICE  
**Prisma/schema change:** NONE  
**Scope:** governed Portfolio organization context for Portfolio Home and
Strategic Framing consumers.

This document defines semantics only. It does not implement a resolver, route,
controller, service, persistence model, Prisma migration, frontend behavior,
Jira change, or KAN-41.

## 0. Authority and current-state note

This contract is subordinate to the current factual Core contract and approved
product authority. The requested path `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md`
is not materialized in this checkout. The factual Core authority remains:

`doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`

The requested SF-7B.2A artifact is also not present in this checkout. Its
conclusions are preserved here as supplied by the SF-7B.2A decision:

- `ScopedPortfolioAccessService` validates a supplied organization but does not
  select one;
- `User.organizationId` is a denormalized pointer and is not authority;
- continuation/bootstrap records are context candidates or lineage, not grants;
- no durable server-owned selected Portfolio context currently exists;
- KAN-41 must not infer an organization from a user id or browser input.

This contract does not promote any current implementation into authority.

## Executive summary

Starteria separates three boundaries:

```text
authentication
  != Portfolio context selection
  != Portfolio scope authority
```

An actor may be authenticated without having a selected Portfolio context, and
may have a selected organization without current Portfolio authority. Protected
Portfolio and Strategic Framing reads require a server-resolved organization,
current membership validation, and either effective global `portfolio:read` or
validated organization-scoped Portfolio access.

The contract is intentionally persistence-neutral. SF-7B.2C may choose how a
selection is stored, but may not change these authority semantics.

## Problem discovered by SF-7B.2 / SF-7B.2A

SF-7B.2 selected server-side composition with compatible Home access and
explicit Strategic Framing availability semantics. SF-7B.2A found that the
repository can validate a supplied organization but cannot safely resolve the
organization context for every Home caller. In particular, the current
continuation/bootstrap organization values derive from `User.organizationId`,
and the current Home service accepts only `userId`.

Until a governed context boundary exists, KAN-41 remains blocked. This
contract defines that boundary; it does not implement it.

## 1. Purpose and invariant

An active Portfolio context is the server-confirmed organization scope in which
the authenticated actor may read or operate on Portfolio-owned experience data.
It is a scope boundary, not a role label, a user preference, an AI inference,
or a copy of Entry text.

The foundational distinction is:

```text
selection != authorization
```

A selection identifies the organization the actor intends to work in.
Authorization independently proves that the actor may use Portfolio capability
in that organization. A selected organization without current authorization is
not an active context.

The context contract must preserve:

```text
actor identity
+ selected organization
+ selection provenance
+ current authority validation
→ authorized Portfolio context
```

No downstream Portfolio read may use an organization scope until this chain has
completed.

## 2. Conceptual context shape

The semantic shape is intentionally conceptual and does not freeze a physical
table, session field, token claim, cookie, or TypeScript location.

```text
PortfolioContextReference {
  actorUserId: UserId
  organizationId: OrganizationId | null
  contextSource: ContextSource
  selectionState: SelectionState
  authorityState: AuthorityState
  selectedAt: Instant | null
  validatedAt: Instant | null
  contextId: OpaqueServerContextId | null
}
```

`contextId` is optional at contract level. If a runtime introduces one, it must
be opaque, server-owned, actor-bound, and unable to grant authority by itself.

## Core invariants

### PCA-INV-01 — Selection is not authorization

An organization selected by an actor does not prove that the actor remains
authorized to use Portfolio data in that organization.

### PCA-INV-02 — Server validates authority

Every Portfolio Context used by a protected operation must pass server-side
validation before downstream reads or writes occur.

### PCA-INV-03 — Client context is not authority

Browser-supplied `organizationId`, `portfolioScope`, or `workspaceId` is at most
a selection candidate. It never proves authorization.

### PCA-INV-04 — User.organizationId is not sufficient authority

`User.organizationId` is not proof of active membership, scoped Portfolio
authority, or selected Portfolio context.

### PCA-INV-05 — No silent multi-org selection

When multiple organizations are authorized, Starteria must not choose
`organizations[0]`, the most recent organization, or any equivalent implicit
fallback.

### PCA-INV-06 — Revocation wins over historical selection

Membership, grant, or permission revocation invalidates the effective context
for the next protected request, regardless of historical selection.

### PCA-INV-07 — Security failures are not data emptiness

`not_authorized`, `forbidden`, and `invalid_context` must not be converted to
`empty` or `unavailable` data.

### PCA-INV-08 — Downstream services receive authorized context

Scope-dependent Portfolio services consume an authorized context. They do not
derive organization authority again from `userId`.

### 2.1 Context source

The source identifies how a candidate or selection entered the server boundary;
it does not itself prove authority.

```text
server_context
validated_continuation
validated_bootstrap
explicit_server_selection
single_authorized_organization
restored_server_session
```

`browser_proposal` may be recorded as an input event or request candidate, but
it is never an authority source and must not be returned as an authorized
context source.

Source semantics:

| Source | May propose | May establish selection | Requires revalidation | Sufficient alone for protected operations |
| --- | --- | --- | --- | --- |
| `explicit_server_selection` | Yes | Yes, after server confirmation | Yes | No |
| `validated_continuation` | Yes | Only as a server-confirmed selection | Yes | No |
| `validated_bootstrap` | Yes | Only as a server-confirmed selection | Yes | No |
| `single_authorized_organization` | Yes | Only if explicitly approved as product policy | Yes | No |
| `restored_server_session` | Yes | Only if actor-bound and current | Yes | No |
| `server_context` | Yes | Yes, within its governed lifecycle | Yes | No |
| `browser_proposal` | Yes | No | Yes | No |

No source bypasses membership and permission/grant validation.

### 2.2 Selection state

```text
no_context
context_selection_required
selected
stale
invalid
```

Selection state describes whether a context has been identified and whether the
selection remains usable as a candidate. It does not answer whether access is
currently permitted.

### 2.3 Authority state

```text
not_authorized
pending_validation
authorized
revoked
```

Only `authorized` may produce an `AuthorizedPortfolioContext`. `revoked` is a
terminal result for the current request and must not be represented as an empty
Portfolio or Strategic Framing result.

## 3. Server ownership and selection

The server owns the authoritative context decision.

An actor may initiate context establishment only through an authenticated
server boundary. The actor may propose an organization identifier, for example
through a future organization picker or a continuation/bootstrap request, but
that proposal is untrusted input.

The server must:

1. identify the actor from authenticated identity;
2. resolve the proposed or existing server-owned candidate;
3. verify that the candidate belongs to the actor or was established for the
   actor by an allowed server flow;
4. revalidate organization membership and Portfolio capability;
5. return or persist only the resulting server-owned selection state.

Browser state, query parameters, request body fields, localStorage, Entry text,
SF text, and AI inference may propose or describe a context. None can establish
an active context or alter the organization scope of a protected read.

The confirmation boundary is the server response or server-owned state after
the validation chain succeeds. A client acknowledgement does not create
authority.

## Portfolio context lifecycle

The semantic lifecycle is:

```text
candidate
  → server_selection_pending
  → selected
  → validated / available
  → stale or invalid
  → revoked
```

`candidate` and `selected` are selection states. `validated / available` is the
only state that authorizes a protected organization-scoped operation. `stale`,
`invalid`, and `revoked` preserve useful history when applicable but cannot be
used as authority. A new selection must be established after invalidation; the
resolver must not silently substitute another organization.

## 4. Authority revalidation

The required chain is:

```text
selected context
  → actor ownership / context integrity
  → OrganizationMember validation
  → global portfolio:read OR scoped Portfolio grant validation
  → AuthorizedPortfolioContext
```

Validation is required at both points:

- **context establishment:** before a selection becomes active;
- **every relevant protected request:** immediately before Portfolio or
  Strategic Framing data is read or mutated.

Caching may optimize lookups only when it cannot permit stale authority. A
cached selection or permission result must not survive a known revocation or
replace the required request-time authorization decision.

`ScopedPortfolioAccessService` remains the reusable validation boundary for a
resolved organization and capability. It does not select an organization and
does not replace context resolution.

Global `portfolio:read` is a capability source, not an organization selector.
Even a globally authorized actor must receive one explicit server-resolved
organization before organization-scoped Strategic Framing data is queried.

## 5. Zero, one and multiple authorized organizations

The resolver must first determine the set of organizations for which the actor
currently has valid Portfolio read authority. It must not use
`User.organizationId` as a substitute for this set.

### Zero organizations

Return:

```text
selectionState: no_context
authorityState: not_authorized
reason: no_authorized_portfolio_organization
```

No organization-scoped Portfolio or Strategic Framing query may run.

### Exactly one organization

The contract permits auto-selection of the sole currently authorized
organization as a product behavior, but this is an explicit product decision,
not an implementation convenience. Until that decision is ratified for the
runtime slice, the safe contract behavior is:

```text
selectionState: context_selection_required
authorityState: not_authorized
reason: context_selection_required
```

If product approval later selects auto-selection, it must be server-side,
observable, actor-bound, and independently revalidated on every protected
request. It must not be implemented as “use the first row” or as a fallback to
`User.organizationId`.

### More than one organization

Return:

```text
selectionState: context_selection_required
authorityState: not_authorized
reason: multiple_organizations_require_selection
```

The server must not choose the first, most recent, alphabetically first, or
`User.organizationId` organization. It must not merge organizations into one
Portfolio projection.

### Previously selected organization

A previous selection may be reused only as a candidate. The server must verify:

- the selection belongs to the current actor;
- the organization still exists;
- the actor remains a member;
- the actor still has global or scoped Portfolio read authority;
- the selection has not expired, been superseded, or been invalidated by the
  governing context mechanism.

If all checks pass, the context becomes `available`. If any check fails, it is
`stale` or `invalid` and must not be used for a read.

### Stale selection

Return:

```text
selectionState: stale
authorityState: not_authorized
reason: stale_portfolio_context
```

The caller may enter a new selection flow. The stale organization must not be
silently substituted with another organization.

### Revoked access

Return `revoked` as the authority result when a previously valid selection no
longer satisfies membership or grant validation. See the revocation invariant
below.

## 6. Stable context result taxonomy

The externally meaningful result taxonomy is:

```text
no_context
context_selection_required
available
not_authorized
stale
invalid
```

These states have distinct meanings:

| State | Meaning | Organization-scoped read allowed? |
| --- | --- | --- |
| `no_context` | No candidate or selection is available. | No |
| `context_selection_required` | The actor has a candidate set requiring an explicit server-confirmed selection. | No |
| `available` | One selected context passed current ownership, membership and capability validation. | Yes |
| `not_authorized` | The actor cannot establish Portfolio authority for the selected/candidate organization(s). | No |
| `stale` | A prior selection cannot be trusted as current context. | No |
| `invalid` | The candidate is malformed, cross-actor, cross-organization, or otherwise fails context integrity. | No |

`unavailable` is not a context state. It is reserved for an authorized
downstream technical read failure. `empty` is a valid result of an authorized
read with zero records, never a substitute for any context failure.

## 7. Error semantics

The context layer and downstream read layer must preserve these distinctions:

| Situation | Contract result | HTTP/error treatment |
| --- | --- | --- |
| No selection exists | `no_context` | May be a compatible response for a non-SF Home caller; no SF query |
| Multiple authorized organizations without selection | `context_selection_required` | Selection-required response; never silent choice |
| No valid membership/grant/global authority | `not_authorized` | Explicit authority result; never `read_failed` |
| Explicit cross-actor or cross-organization context attempt | `invalid` / forbidden scope | HTTP 403 or repository-equivalent scope error |
| Previously selected context loses access | `stale` or `revoked` | Next protected request must reject or return explicit not-authorized context |
| Authorized downstream read fails technically | Context remains `available` | Downstream may return `unavailable/read_failed` |
| Canonical Home read fails | Not a context failure | Existing whole-Home error behavior remains observable |

Security and scope errors must never be caught and relabeled as empty data,
unavailable data, or a technical `read_failed` result.

## 8. Revocation invariant

```text
Previously selected organization
+ membership or grant revoked
→ next protected request cannot use that context
```

A previously selected organization never preserves access by virtue of prior
selection, a continuation, a bootstrap session, a browser cookie, a cached
permission result, or a prior successful Home response.

On the next protected request the server must revalidate membership and the
required Portfolio capability. If either is absent, it must invalidate or mark
the selection stale/revoked and prevent organization-scoped reads. It must not
fall back to another organization without a new governed selection.

## 9. Continuation and Bootstrap semantics

Existing Portfolio Entry continuation and Portfolio Bootstrap records may be
used as:

- a context candidate;
- context lineage;
- a selection proposal;
- evidence of how the actor arrived at Portfolio work.

They are not automatic authority. Their organization values must be treated as
server-originated but independently revalidated against current actor ownership,
membership and Portfolio capability.

Specifically:

- `PortfolioEntryPortfolioContinuation.portfolioScope` is lineage/candidate
  data, not a grant;
- `PortfolioBootstrapSession.organizationId` is a candidate context field, not
  proof of current access;
- `User.organizationId` may help locate legacy context candidates, but is never
  sufficient authority;
- continuation or bootstrap ownership does not override revoked membership or
  grant state.

No continuation/bootstrap flow may silently create a multi-organization
selection policy. If the candidate is ambiguous, context selection remains
required.

## 10. Downstream authorized context contract

Services that read organization-scoped Portfolio or Strategic Framing data must
receive an already authorized context, conceptually:

```text
AuthorizedPortfolioContext {
  actorUserId: UserId
  organizationId: OrganizationId
  permissions: EffectivePermissionSet
  authoritySource:
    'global_permission'
    | 'validated_scoped_access'
    | 'server_context'
  contextId: OpaqueServerContextId | null
  validatedAt: Instant
}
```

`authoritySource` describes the validated authority path, not a browser source.
The organization id must be non-null and must be the same organization checked
by membership and capability validation.

`PortfolioHomeReadService` and the Strategic Framing Home projection must
consume this object. They must not derive organization authority from
`userId`, `User.organizationId`, Entry text, request body, query parameters, or
AI output.

A non-authorized or no-context result is not an `AuthorizedPortfolioContext`
and must not be passed to an organization-scoped read service.

## 11. Controller and service responsibilities

### Controller / request boundary

- require authenticated identity;
- obtain only server-visible context candidates and untrusted client proposals;
- derive effective platform permissions from authenticated identity;
- request context resolution from the authority layer;
- preserve explicit scope/auth errors;
- pass only `AuthorizedPortfolioContext` to protected Portfolio services;
- keep compatibility behavior separate from Strategic Framing authority.

### Context authority layer

- establish or resolve a server-owned selection;
- distinguish selection from authorization;
- validate actor ownership and context integrity;
- validate organization membership;
- validate global permission or scoped Portfolio grant;
- reject ambiguous, stale, revoked, cross-actor and cross-organization context;
- never silently select an organization;
- expose stable context states and reasons.

### Portfolio domain/read service

- consume `AuthorizedPortfolioContext`;
- scope every organization-owned query to its organization id;
- preserve authorized empty results as empty;
- preserve technical failures as unavailable/read_failed only when authorized;
- never resolve authority from a user id or legacy pointer;
- never convert security failures into empty or unavailable data.

## Portfolio Home compatibility

The existing compatibility decision remains in force:

```text
authenticated generic participant
  → canonical Home may remain compatible
  → Strategic Framing is independently governed
```

Conceptually, the composed Home response may contain:

```text
Canonical Home: success

Strategic Framing:
  available
  empty
  no_context
  context_selection_required
  not_authorized
  unavailable
```

`no_context`, `context_selection_required`, and `not_authorized` mean that no
Strategic Framing records, counts, or organization-scoped links are exposed.
`empty` is allowed only after an authorized projection returns zero records.
`unavailable` is reserved for an authorized technical dependency/read failure.
An authentication failure, explicit forbidden scope, stale selection, or
invalid context must not be represented as `unavailable`.

## Persistence requirements without implementation

This contract does not choose database, Redis, session store, signed server
session, existing model, or another persistence mechanism. SF-7B.2C must choose
an implementation that provides, where the product requires cross-request
selection:

- durability appropriate to the selected-context UX;
- actor ownership and organization isolation;
- explicit lifecycle and invalidation semantics;
- request-time revocation safety;
- expiry or supersession behavior;
- sufficient auditability to explain selection and invalidation;
- no authority inferred merely from storage presence.

Persistence is a carrier of selection state, not a grant. A persisted selection
must still pass current membership and capability validation before use.

## 12. Security invariants

The runtime conforming to this contract must guarantee:

- no cross-organization data leakage;
- no browser organization authority;
- no use of a stale grant or membership;
- no silent first-organization selection;
- no use of `User.organizationId` as sole authority;
- no merging of multiple organizations into one projection;
- no continuation/bootstrap authority without independent revalidation;
- no authorization or scope error converted to empty/unavailable data;
- no Strategic Framing query when context is absent, ambiguous, stale or
  unauthorized;
- actor identity and organization scope remain bound through the full request.

## 13. ADR assessment

**ADR_DEPENDS_ON_PERSISTENCE_DESIGN**

The semantic contract does not require changing a Core invariant, canonical
domain relation, AI authority, or Step 0–4 behavior. Therefore this document
does not itself require an ADR to define the contract.

An ADR is required if the later runtime design introduces or changes any of the
following:

- a durable selected-context record or new context lifecycle;
- a new authority or grant semantic;
- a permission meaning or role-to-permission mapping;
- a cross-request session/token/cookie authority mechanism;
- automatic single-organization selection as a product rule;
- migration of existing continuation/bootstrap records into canonical authority;
- a Core/domain relation or organization ownership invariant.

If runtime can use an existing server-owned mechanism without changing those
semantics, an ADR is not required, but the implementation must still satisfy
this contract and add focused security tests.

## 14. Prisma assessment

```text
NO_SCHEMA_CHANGE_REQUIRED_FOR_CONTRACT
```

This slice makes no Prisma or migration change.

Later runtime design may force a schema decision if it needs durable
cross-request selection, explicit context lifecycle/status, revocation
invalidation records, audit history, multi-context ownership, or a relation
that cannot be represented by existing server-owned records. Reusing a model
by name similarity is not sufficient; lifecycle, ownership, provenance,
expiration, permissions and downstream consumers must be audited first.

## Required future test matrix

The later runtime design must define tests for at least:

1. global `portfolio:read`;
2. valid organization-scoped grant;
3. revoked grant;
4. revoked membership;
5. other-organization attempt;
6. browser organization ignored as authority;
7. zero authorized organizations;
8. exactly one organization, including the explicitly selected auto-selection
   or selection-required product policy;
9. multi-org without selection;
10. multi-org with valid selected context;
11. stale selected context;
12. technical context-authority resolver failure;
13. technical downstream Strategic Framing read failure;
14. canonical Home failure;
15. Strategic Framing security error not swallowed;
16. empty authorized Strategic Framing projection;
17. no cross-organization leakage;
18. no SF query when context is absent, ambiguous, stale, invalid, or
   unauthorized;
19. continuation/bootstrap candidate with current revalidation;
20. `User.organizationId` pointing to an unauthorized organization;
21. no silent organization merge or first-row choice.

## Open questions

These are intentionally deferred to SF-7B.2C or an explicit product/ADR
decision:

- Is auto-selection of the sole authorized organization desired, or must every
  actor explicitly select even when only one organization is available?
- Does the existing product have a suitable server-owned cross-request context
  carrier, or is a new persistence mechanism required?
- What exact event or lifecycle operation invalidates a restored selection in
  addition to request-time membership/grant revalidation?
- Is a durable selected context a product/domain authority change requiring an
  ADR, or can it remain an infrastructure-level selection carrier?
- What user-facing selection flow should resolve
  `context_selection_required` without changing Portfolio Home composition?

## 16. Final decision

```text
SF-7B.2B STATUS: GO_WITH_GAPS

Contract defined: YES
Context states: no_context / context_selection_required / available /
                not_authorized / stale / invalid
Multi-org behavior: explicit server selection required; no silent choice
Revocation invariant: request-time revalidation blocks access after revocation
Downstream authorized context: AuthorizedPortfolioContext
User.organizationId authoritative: NO
Browser org authoritative: NO

ADR: ADR_DEPENDS_ON_PERSISTENCE_DESIGN
Prisma: NO_SCHEMA_CHANGE_REQUIRED_FOR_CONTRACT

READY FOR SF-7B.2C RUNTIME DESIGN: YES
READY FOR RUNTIME IMPLEMENTATION: NO
```

The remaining gaps are intentionally bounded: product approval of the
single-organization auto-selection policy, selection/invalidity persistence
strategy, and whether that strategy requires an ADR. These gaps do not permit
KAN-41 to infer or consume organization authority.

## 17. Readiness for SF-7B.2C

```text
READY FOR SF-7B.2C RUNTIME DESIGN: YES
READY FOR KAN-41: NO
```

SF-7B.2C may design the resolver and persistence-neutral integration against
this contract. It may not implement KAN-41 until the open product and
persistence decisions are resolved and the required security tests are
defined.
