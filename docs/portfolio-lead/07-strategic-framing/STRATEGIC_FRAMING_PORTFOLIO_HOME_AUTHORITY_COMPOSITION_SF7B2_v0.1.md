# Strategic Framing → Portfolio Home Authority Composition — SF-7B.2 / KAN-41

**Document status:** GO_WITH_GAPS  
**Decision scope:** server-side authority/context composition only.  
**Date:** 2026-09-27

This decision does not implement runtime, frontend, Prisma, Jira, commits or
pushes. It defines the contract that KAN-41 may implement.

## 1. Current authority map

| Surface | Current fact | Authority/classification |
| --- | --- | --- |
| Home route | `GET /api/v1/portfolio/home` is mounted behind `authenticate` only. | Current compatibility behavior; authorization debt is documented. |
| Home controller | `PortfolioController.getHome` calls `getHome(req.user.id)`. | Current implementation; insufficient input for SF composition. |
| Home read service | `PortfolioHomeReadService.getHome(userId)` reads canonical Portfolio/Home data and the latest Bootstrap reading. | Server-owned read model; current Home source. |
| Existing Home auth test | An authenticated `participante` receives HTTP 200 and Home is called with the user id. | Compatibility regression (`V1_REGRESSION`/current behavior), not SF authority. |
| Platform permissions | `portfolio:read` is derived from effective platform roles. `portfolio_lead` and `admin` currently receive it. | Active permission catalog / ADR-029 implementation. |
| SF Home projection | `StrategicFramingHomeProjectionService.getProjection({ actorUserId, organizationId, permissions })` requires `portfolio:read`; it scopes state reads by `organizationId`. | SF-7B.1 active read projection. |
| SF authorization errors | Missing `portfolio:read` raises `SF_HOME_FORBIDDEN`; dependency failures return `{ availability: 'unavailable', reason: 'read_failed' }`. | Active projection contract; must remain distinct. |
| Scoped Portfolio authority | `ScopedPortfolioAccessService` validates user existence, organization existence, `OrganizationMember`, and `OrganizationPortfolioAccessGrant` for a requested capability. | Active reusable server-side authority service. |
| User organization pointer | `User.organizationId` is explicitly a denormalized convenience pointer; authoritative membership is `OrganizationMember`. | Selector hint only; insufficient alone. |
| Continuation | A validated Portfolio Entry continuation is owned by the authenticated user and records a server-created Portfolio scope/context. | Context selector/lineage; its JSON payload is not authority by itself. |
| Bootstrap context | `PortfolioBootstrapSession` is server-owned and stores `userId`, optional `organizationId`, and source continuation. | Candidate server context; requires ownership and current access revalidation. |
| Frontend layout | `PortfolioLeadLayout` already gates the Portfolio workspace by `portfolio:read`, but KAN-41 does not change frontend behavior. | Existing frontend behavior; not a second composition source. |

## 2. Conflict

The exact mismatch is:

```text
authenticated user
  → existing Home route accepted
  → getHome(userId)

Strategic Framing Home projection
  → portfolio:read required
  → organizationId required for scoped reads
  → server-owned actor/context required
```

This cannot be composed safely without an explicit authority contract. A naive
composition would either leak organization-scoped SF data to a generic
authenticated participant or catch a forbidden/scope result and mislabel it as
a technical `unavailable` result. Both outcomes are prohibited.

The browser is never an authority source. An arbitrary query parameter,
localStorage value, browser-selected organization, Entry/SF text, or AI
inference cannot establish `organizationId`.

## 3. Evaluated options

### Option A — Harden the entire Home route now

Rejected for KAN-41. Adding a route-level `requirePermission('portfolio:read')`
would convert an existing compatibility route into a different authorization
contract and would make the existing authenticated-participant behavior fail.
It would also conflate the separately documented global Home authorization debt
with SF composition. Scoped Portfolio Entry arrivals do not justify silently
hardening all Home callers. This remains separate authorization debt unless a
future decision selects it explicitly.

### Option B — Global permission OR validated scoped access

Selected as the authority capability model. `portfolio:read` may come from the
effective global permission set or from a server-validated
`ScopedPortfolioAccessService` grant for the resolved organization. In both
cases, an organization context still has to be resolved server-side before SF
data is read. Permission grants capability; it does not select an organization.

The current platform provides validation of a supplied organization and the
server-owned Bootstrap/continuation records provide possible context selectors,
but no current Home-wide resolver proves that exactly one context exists for
every caller. That is the gap carried into KAN-41.

### Option C — Preserve Home and explicitly discriminate SF authorization

Selected as the response compatibility model. The Home route remains
authenticated-only. The composed response explicitly distinguishes
`available`, `unavailable/read_failed`, and `not_authorized`/`no_context` for
the SF portion. Lack of SF authority is never represented as an empty or
technical result.

An explicitly supplied but invalid, revoked, or cross-organization context is a
scope/auth error and must remain an HTTP auth/scope error; it must not be
localized as `unavailable`.

### Option D — Optional/missing `strategicFraming` field

Rejected. Absence is ambiguous: it cannot distinguish no authority, no context,
an empty authorized projection, and a failed dependency. The field must always
be present with a discriminated availability value.

### Option E — Frontend fetches Strategic Framing separately

Rejected. It would create a second Home composition path, duplicate scope and
partial-loading/error decisions in the browser, and weaken the server-owned
read-model boundary established by SF-7A and SF-7B.1.

## 4. Selected model

KAN-41 selects **B + C**:

```text
authenticate
  → resolve actor permissions
  → resolve server-owned Portfolio context
  → validate global portfolio:read OR scoped portfolio:read for that context
  → compose canonical Home
  → compose SF projection with actor + validated context + effective permissions
  → return explicit SF availability semantics
```

The route gate remains authentication-only for compatibility. The SF projection
does not weaken its `portfolio:read` requirement and does not receive a
browser-owned organization id. A generic authenticated participant may still
receive the existing Home response, but receives no SF data unless SF authority
and context are both established.

This is `GO_WITH_GAPS`, not `GO`, because the repository has the scoped access
primitive but does not yet expose one approved Home-wide context resolver that
handles context selection, ownership, revocation, and multi-organization
ambiguity for every caller.

## 5. Organization-context rule

### Authoritative sources

The runtime may use a resolved organization only when it is server-owned and
validated for the current actor:

1. an already-established server Portfolio context whose owner is the actor;
2. a server-owned continuation or Bootstrap session used as a context selector,
   after ownership validation and fresh membership/grant validation;
3. an organization selected by an existing server context mechanism, again
   revalidated through membership and the required Portfolio capability.

`OrganizationMember` plus an active `OrganizationPortfolioAccessGrant` for
`portfolio:read` is authoritative scoped access for a resolved organization.
`ScopedPortfolioAccessService` is the reusable validation boundary.

### Insufficient or forbidden sources

- `User.organizationId` alone is insufficient. It is a denormalized convenience
  pointer, not membership authority and not proof of Portfolio access.
- `PortfolioEntryPortfolioContinuation.portfolioScope` is a selector/lineage
  record, not a grant. Its organization value must not be trusted without
  ownership and current access revalidation.
- `PortfolioBootstrapSession.organizationId` is a server context candidate,
  not an unconditional grant. Validate session ownership and current access.
- Query `organizationId`, request body, localStorage, browser-selected org,
  Entry/SF text, and AI inference are forbidden as authority.

If no validated context exists, the runtime must not query SF with `null` as a
wildcard or infer the actor's organization. It returns explicit
`not_authorized`/`no_context` for the SF field while preserving compatible Home
behavior, unless the caller explicitly attempted an invalid protected context,
which is an HTTP scope error.

## 6. Multi-organization rule

KAN-41 must not silently choose the first, most recent, or
`User.organizationId` organization. When more than one organization is
authorized, selection belongs to a prior server-owned context-establishment
flow. Home composition consumes that selected context; it does not infer one.

If more than one authorized organization exists and no selected context exists,
SF composition is `not_authorized` with `reason: 'no_portfolio_context'` (or the
equivalent named contract value). The runtime must not merge organizations into
one SF projection and must not expose cross-organization totals.

## 7. Response semantics

The Home response always includes a `strategicFraming` discriminated field:

```ts
type StrategicFramingHomeComposition =
  | { availability: 'available'; totalStateCount: number; hasMore: boolean; items: StrategicFramingHomeItem[] }
  | { availability: 'empty'; totalStateCount: 0; hasMore: false; items: [] }
  | { availability: 'unavailable'; reason: 'read_failed' }
  | { availability: 'not_authorized'; reason: 'forbidden' | 'no_portfolio_context' };
```

- **Available:** the actor is authorized, a validated context exists, and the
  SF projection succeeds with one organization scope.
- **Empty:** the actor is authorized and the projection succeeds with zero
  states. This is not an error and is not equivalent to unavailable.
- **Unavailable:** the actor is authorized and a dependency/read operation
  fails technically. This is the only localized technical failure state.
- **Not authorized / no context:** the compatibility Home caller has no SF
  authority or no established server context. No SF records, counts, or links
  are returned.

The existing SF projection may continue to represent a successful zero-state
read as `available` with zero totals; the composition adapter may normalize that
to `empty` for the explicit Home contract. It must never manufacture zero from
`unavailable`, `not_authorized`, or missing context. Therefore false zero is
not possible under this contract.

## 8. Error semantics

- Missing/invalid authentication remains an HTTP 401.
- An explicitly selected context owned by another actor, a revoked grant, or a
  cross-organization attempt remains an HTTP 403 (or the repository's existing
  equivalent scope error). It is not caught as `unavailable`.
- A passive legacy Home request from an authenticated actor without SF
  authority/context may remain HTTP 200 for Home compatibility, with explicit
  `strategicFraming: { availability: 'not_authorized', ... }`.
- An authorized SF dependency/read failure may be localized to
  `strategicFraming: { availability: 'unavailable', reason: 'read_failed' }`
  if canonical Home data succeeded.
- If canonical Home itself fails, the whole Home error follows the existing
  controller/error-handler behavior; KAN-41 does not invent a new whole-Home
  fallback.
- `SF_HOME_FORBIDDEN` and equivalent scope errors must never be caught and
  relabeled as `read_failed`.

## 9. `PortfolioHomeReadService` input contract

Current:

```ts
getHome(userId: string)
```

Target conceptual contract:

```ts
type PortfolioHomeActorContext = {
  actorUserId: string;
  permissions: ReadonlySet<Permission>;
  portfolioContext: {
    organizationId: string;
    source: 'global_permission' | 'validated_scoped_access' | 'server_context';
    contextId?: string;
  } | null;
};

getHome(input: PortfolioHomeActorContext): Promise<PortfolioHomeReadModel>
```

The exact type may follow repository conventions, but the information boundary
is mandatory: actor identity, effective permissions, and an already resolved
server-owned Portfolio context must travel together.

Controller responsibility:

- require authentication;
- derive actor id and effective permissions from `req.user`;
- invoke the context resolver with server-owned request/session context;
- preserve explicit HTTP auth/scope errors;
- pass the resolved actor/context object to the Home service.

Service responsibility:

- compose canonical Home data;
- invoke the SF projection once with the actor, validated organization, and
  permissions;
- preserve available vs empty vs unavailable vs not-authorized semantics;
- localize only authorized technical SF failures when canonical Home succeeded.

Context/authority responsibility:

- resolve or reject the Portfolio context server-side;
- validate ownership, membership, grant status, and organization match;
- use `ScopedPortfolioAccessService` for scoped capability checks;
- never derive authority from browser organization input or SF/Entry text.

The context resolver must not silently select among multiple organizations.

## 10. Exact KAN-41 runtime scope

KAN-41 may change only the server composition boundary and its focused tests:

- `backend/modules/portfolio/portfolio-home.read-service.ts`: accept the actor
  context, compose the SF projection, and expose explicit discriminated SF
  availability semantics.
- `backend/modules/portfolio/portfolio.controller.ts`: pass authenticated actor
  and effective permissions/context into the Home service and preserve error
  boundaries.
- `backend/modules/portfolio/portfolio.router.ts`: wire only the context/auth
  dependency required by the selected contract; do not broadly harden all Home
  reads.
- The smallest server-side Portfolio context resolver/adapter needed to
  validate an existing server-owned context, if one is required by current
  wiring.
- Focused Portfolio Home, projection-composition, authority/context, and route
  regression tests.

KAN-41 must not:

- change frontend Home adoption, UI, layout, or browser fetching;
- create a parallel frontend SF request;
- change Prisma schema or migrations;
- change Core/domain semantics;
- weaken SF `portfolio:read` or organization scoping;
- fix unrelated global Home authorization debt;
- create or change Jira issues;
- implement KAN-42 or later slices.

## 11. Required runtime tests

The implementation must define and pass at least:

1. global `portfolio:read` actor with one validated organization context;
2. scoped `portfolio:read` actor with membership plus active grant;
3. authenticated `participante` without Portfolio authority: Home remains
   compatible and SF is explicitly `not_authorized`, with no SF query/data;
4. revoked scoped grant: explicit scope failure, never `unavailable`;
5. other-organization attempt: rejected and no cross-org read;
6. null/no server context: explicit `no_portfolio_context`, not null-scope data;
7. multiple authorized organizations without selected context: no silent choice;
8. selected server context with multiple organizations: only selected org is
   queried;
9. SF technical projection failure after canonical Home success: localized
   `unavailable/read_failed`;
10. empty authorized projection: explicit empty/available-zero, not unavailable;
11. canonical Home failure: whole-Home error remains observable;
12. `SF_HOME_FORBIDDEN` and scope errors are not swallowed;
13. arbitrary query/body organization ids, localStorage values, and client
    selectors cannot alter the resolved organization;
14. no frontend parallel fetch or second Home source is introduced by the
    backend contract.

## 12. Prisma impact

```text
schema change: NO
migration: NO
decision required: NO
```

KAN-41 may read existing server-owned User, OrganizationMember,
OrganizationPortfolioAccessGrant, Portfolio Entry continuation, and Bootstrap
session data through current repositories/services. Adding a context table,
changing relations, or changing grant semantics is out of scope and would
require a separate decision.

## 13. Decision outcome

**GO_WITH_GAPS**

The authority model is decided: preserve compatible Home access, compose SF on
the server, require `portfolio:read` plus a validated server-owned organization
context, and expose explicit SF authorization/availability semantics. Runtime
implementation is ready only after the context resolver gap is closed in the
KAN-41 implementation and the required negative/security tests pass.

### Blocking open questions

- Which existing server-owned context is the canonical selected Portfolio
  context for a Home request when the actor has multiple authorized
  organizations?
- Does the current continuation/bootstrap flow establish a durable selected
  context for all Home callers, or must KAN-41 add a resolver adapter around an
  existing record?
- For a scoped actor without global `portfolio:read`, which existing flow issues
  and revokes the `OrganizationPortfolioAccessGrant` used by Home?

### Nonblocking open questions

- Whether the public response names the successful zero-state variant
  `available` or normalizes it to `empty`; both must retain zero-vs-unavailable
  distinction.
- Whether the context source enum uses `server_context` or a more specific
  existing repository term.
- Whether the final typed composition is placed in the existing Home types file
  or a dedicated Portfolio Home contract file.

## 14. Files changed by this decision turn

Only this decision artifact is authorized for the decision turn:

`docs/portfolio-lead/07-strategic-framing/STRATEGIC_FRAMING_PORTFOLIO_HOME_AUTHORITY_COMPOSITION_SF7B2_v0.1.md`

