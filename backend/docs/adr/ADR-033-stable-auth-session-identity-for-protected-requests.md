# ADR-033 — Stable Auth Session Identity for Protected Requests

- **Status:** Accepted
- **Date:** 2026-09-27
- **Decision:** `ACCEPT_REFRESH_FAMILY_AS_SID`
- **Scope:** authentication/session identity binding only
- **Related:** ADR-003, ADR-004, ADR-028, ADR-029, ADR-032, SF-7B.2D
- **Implementation:** AUTH-SID-1 authorized; downstream Portfolio work remains blocked

## 1. Status and scope

This ADR is accepted as an architecture decision. It authorizes only the
bounded `AUTH-SID-1` implementation slice in section 15. It does not implement
JWT changes, Prisma changes, migrations, SF-7B.2D, KAN-41, Home composition,
frontend behavior, or Step 0–4 behavior.

It evaluates whether the existing persisted `RefreshToken.family` can become a
stable authenticated-session identity exposed as the signed JWT `sid` claim.

## 2. Context

ADR-032 accepts session/device-scoped Portfolio Context selection. SF-7B.2D
could not begin because protected requests currently expose only `sub = userId`
from a stateless access JWT. The refresh-token family is persisted and stable
across rotation, but its identity is not currently carried into the access JWT.

The required distinction is:

```text
User
├── Session A → Portfolio Context Org A
└── Session B → Portfolio Context Org B
```

Binding Portfolio Context to `userId` would violate ADR-032. Inventing a
pseudo-session id at request time would not remain stable across access-token
refresh and would not identify the refresh lineage that logout revokes.

## 3. Refresh family audit

```text
generated when:
  issueTokenPair() creates a new family when existingFamily is absent.

generation mechanism:
  crypto.randomUUID(), stored on each RefreshToken row.

stable during rotation:
  YES. refreshTokens() passes storedToken.family to issueTokenPair().

new login creates new family:
  YES. login, register and Google sign-in call issueTokenPair() without
  existingFamily on the normal persisted-auth path.

same user can have multiple families:
  YES. Each independent login creates a separate family.

different devices/sessions isolated:
  YES in the current refresh-family model, assuming independent login/family
  issuance; the family is not currently exposed on protected requests.

persisted:
  YES, on RefreshToken.family.

globally unique:
  UUID-generated and collision-resistant; no database @unique constraint exists.
  It is suitable as an opaque identifier, not as a database uniqueness proof.

logout revokes family:
  YES. logoutUser() updates all rows matching the family.

security/password flows revoke family:
  Role/permission changes revoke all non-revoked refresh rows for the target
  user, which revokes every family for that user. Refresh-token reuse revokes
  the detected family. No separate password-reset family flow was found.

family can remain active after logout:
  NO for refresh capability: all family rows are revoked. YES for already-issued
  access JWT cryptographic validity until its normal expiry, because ordinary
  middleware does not currently query refresh-family state.
```

An individual refresh token is revoked during normal rotation while the newly
issued token in the same family remains active. That is different from family
revocation, which marks all family rows revoked and prevents further refresh.

## 4. Access-token issuance audit

### Normal persisted issuers

`AuthService.issueTokenPair()` is the single normal production access-token
issuer. It is reached by:

| Path | Trigger | Family available before signing | `sid` compatibility |
| --- | --- | --- | --- |
| `registerUser` | successful active registration path | New family generated inside issuer | Compatible |
| `loginUser` | password login | New family generated inside issuer | Compatible |
| `googleSignInOrCreate` | Google SSO login | New family generated inside issuer | Compatible |
| `refreshTokens` | refresh-token rotation | Existing stored family passed explicitly | Compatible; must preserve `sid` |

The family must be generated before `generateAccessToken()` is called. The
current implementation generates the family after constructing the payload, so
the follow-up implementation slice must reorder that local operation without
changing the family semantics.

### Development fallback issuer

`issueDevTokenPair()` is used only by the development database-unavailable
fallback. It creates an access token and an unpersisted raw refresh token but no
persisted family. It cannot safely issue a session-bound `sid`.

Required behavior:

```text
development fallback token without persisted family
→ may remain compatible for existing development endpoints
→ cannot establish or use ADR-032 Portfolio Context
```

It must not invent `sid = userId` or a random per-request value.

It must also not use a static development `sid`. Such tokens may remain valid
for existing development-compatible endpoints, but cannot establish or restore
ADR-032 session-scoped Portfolio Context.

### Test-only issuers

Direct `generateAccessToken()` calls in auth, copilot and middleware tests are
test fixtures, not production issuers. Tests that cover session-sensitive
behavior must provide explicit `sid`; legacy compatibility tests may omit it.

No admin impersonation or service/system access-token issuer was found in the
production code search.

## 5. Decision: RefreshToken.family as `sid`

Accept:

```text
sid = RefreshToken.family
```

The claim means:

> Stable identifier for the authenticated login/session lineage represented by
> the access token.

`sid` is:

- server-generated;
- opaque and non-secret;
- signed inside the access JWT;
- stable across access-token refresh;
- different across independent login/session families;
- not an organization, permission, membership, device fingerprint, or grant;
- not sufficient authorization by itself.

Normatively:

```text
sid
≠ permission
≠ membership
≠ organization context
≠ authorization
```

This reuses an already persisted stable lineage rather than creating an
`AuthSession` table only for abstraction cleanliness. The coupling is accepted
because the family already defines refresh rotation and logout lineage, and
ADR-032 needs exactly that stable authenticated-session boundary.

## 6. Candidate B — distinct auth session id

A separate opaque session id associated with each refresh family would provide
cleaner conceptual separation, but it would add another persisted identity and
association without solving a demonstrated repository problem. It would also
require deciding whether logout/reuse revokes the separate id or only the
family.

Decision:

```text
Candidate A: ACCEPT
Candidate B: REJECT FOR NOW
```

A future ADR may introduce a distinct id if refresh-family semantics change or
if authentication requires multiple independent sessions within one family.

Therefore no new canonical or persisted `AuthSession` entity is required for
this ADR. `RefreshToken.family` is sufficient as the technical session lineage
for `AUTH-SID-1`.

## 7. Protected-request contract

The verified JWT is the only source for the session identity:

```text
verified access JWT
        ↓
auth middleware
        ↓
AuthenticatedActor {
  userId,
  authSessionId,
  roles,
  permissions,
  ...
}
```

`authSessionId` is derived from verified `sid`. It must never come from request
body, query parameters, custom client headers, localStorage, cookies on
Portfolio routes, or `User.organizationId`.

An arbitrary client-supplied `sid` is ignored because the client cannot forge a
valid signed JWT containing it.

## 8. Refresh invariant

```text
family = F
access.sid = F

refresh
  → current refresh token row revoked
  → new refresh token family = F
  → new access token sid = F
```

Refreshing must never change authenticated session identity. A new login, even
for the same user, creates a new family and therefore a new `sid`.

## 9. Revocation model

Choose **Model B**:

```text
ordinary endpoints
→ existing JWT validation behavior preserved

session-sensitive Portfolio Context
→ validate sid/family activity before using session-owned context
```

Global refresh-family lookup in every authenticated request would make the
entire auth runtime stateful, expand latency and change existing logout
semantics. ADR-032 only requires a stable identity and session activity checks
for context-sensitive operations.

The required primitive is conceptually:

```ts
isAuthSessionActive({
  userId: string;
  authSessionId: string;
}): Promise<boolean>
```

Its repository query must treat a family as active when at least one row for
that user/family is unrevoked and unexpired. It must not treat the normal
revocation of one rotated refresh token as family revocation. Reuse detection,
logout, role changes and equivalent family-wide revocation make the family
inactive.

This primitive is an auth infrastructure dependency for SF-7B.2D; it is not
implemented by this ADR. It must correctly distinguish individual refresh-token
rotation from family-wide revocation.

## 10. Legacy access tokens

Access JWTs without `sid` remain valid for existing compatible endpoints under
current JWT rules. They cannot establish or use session-scoped Portfolio
Context.

Required behavior:

```text
legacy JWT without sid
→ authenticate existing compatible endpoint
→ no authSessionId
→ Portfolio Context operation denied or unresolved
→ no userId fallback
```

The actor must obtain a newly issued token containing `sid`, normally through
refresh or re-login, before using session-scoped Portfolio Context. The refresh
cookie path remains unchanged.

## 11. Logout and refresh-cookie semantics

The refresh cookie remains:

```text
starteria_rt
Path=/api/v1/auth/refresh
```

It must not be exposed to Portfolio routes merely to recover session identity.

Logout revokes the refresh family. Existing access JWTs may remain
cryptographically valid until expiry for ordinary endpoints. Session-sensitive
Portfolio Context must call the family-active primitive, so a logged-out family
cannot continue using its selected context.

## 12. Security analysis

`sid` visibility to the client is not secret exposure because:

- it is opaque;
- it is not a credential by itself;
- it is carried inside a signed access JWT;
- the server ignores unsigned/client-supplied alternatives;
- Portfolio authorization still validates current membership and
  global/scoped Portfolio authority.

Logs and telemetry must treat `sid` as a correlatable identifier, not as a
secret or bearer credential. Raw refresh tokens remain redacted.

## 13. Alternatives

| Option | Decision | Reason |
| --- | --- | --- |
| `userId` as session id | REJECT | Account-global; violates ADR-032 session isolation |
| Refresh cookie on all routes | REJECT | Expands credential exposure and bypasses signed access-token boundary |
| Independent browser/device cookie | REJECT FOR NOW | Adds an unbound client carrier and new lifecycle; unnecessary when family is stable |
| New `AuthSession` persistence | REJECT FOR NOW | No demonstrated semantic need beyond existing family lineage |
| Refresh family → signed JWT `sid` | ACCEPT | Existing stable persisted lineage; preserves rotation/logout relationship |
| Separate `sid` associated with family | REJECT FOR NOW | Extra state and association without current requirement |

## 14. Core impact

```text
Organization cardinality changed: NO
Portfolio semantics changed: NO
AI authority changed: NO
Human authority changed: NO
Step 0–4 changed: NO
Adaptive Cycle changed: NO
```

This ADR governs authentication/session infrastructure only. It does not make
session identity a Portfolio domain object or alter any
StrategicFront → Challenge → Initiative relationship.

## 15. Implementation authorization — AUTH-SID-1

This accepted ADR authorizes the next auth-binding implementation slice:

```text
AUTH-SID-1
```

`AUTH-SID-1` may implement only:

- `sid` claim in access JWT payload/types;
- family-aware login, registration and Google issuance;
- family-preserving refresh issuance;
- auth middleware exposure as `authSessionId`;
- family-active validation primitive for session-sensitive consumers;
- legacy-token handling;
- focused auth/session tests.

The slice must explicitly test missing-`sid` legacy behavior, development
fallback protection, family-active validation after logout/revocation, and
family preservation during refresh rotation.

It does not authorize:

- PortfolioContextSelection persistence;
- SF-7B.2D;
- KAN-41;
- Portfolio Home changes;
- frontend changes;
- Step/Core changes;
- unrelated authorization redesign.

## 16. Required future test matrix

1. Login JWT contains `sid`.
2. Refresh preserves `sid`.
3. A second login receives a different `sid`.
4. One user supports simultaneous distinct sessions.
5. Middleware exposes `authSessionId` from verified `sid`.
6. Client cannot override `sid` through body, query, header or cookie.
7. Invalid signature/token cannot forge session identity.
8. Logout/family revocation behavior is correct.
9. Refresh rotation preserves session identity while revoking only the old
   individual refresh token.
10. Legacy JWT without `sid` remains compatible for ordinary endpoints but is
    rejected/unresolved for Portfolio Context.
11. Refresh cookie path remains `/api/v1/auth/refresh`.
12. Existing authentication tests remain green.
13. Unrelated authorization semantics do not change.
14. Development fallback tokens without persisted family cannot use
    session-scoped Portfolio Context.

## 17. Rollback / reversal

Before implementation, reject or supersede this ADR without data migration.

After implementation, a rollback must preserve compatibility for legacy tokens,
remove session-sensitive use of `sid`, and not fall back to `userId` as a
session identity. Any persisted Portfolio Context carrier must remain
unusable until a replacement stable session binding is approved.

## 18. Final decision

```text
AUTH SESSION ADR STATUS: ACCEPTED

ADR: ADR-033 — Stable Auth Session Identity for Protected Requests
Number: ADR-033

SELECTED MODEL:
Session identity: RefreshToken.family
JWT claim: sid
Derived from: server-generated refresh-token family
Stable across refresh: YES
Different across sessions: YES
Different across devices: YES, for independent login families
Server generated: YES
Opaque: YES
Client authoritative: NO

ACCESS TOKEN:
Login issuance: compatible after family is generated before signing
Refresh issuance: preserves existing family as sid
Other issuers compatible: normal persisted issuers YES; development fallback
                         without persisted family NO for Portfolio Context

REQUEST ACTOR:
authSessionId available: YES after auth-binding implementation
Source: verified signed JWT sid
Client override possible: NO

REVOCATION:
Selected model: Model B, session-sensitive family-active validation
Global auth lookup: NO
Session-sensitive lookup: YES
Logout behavior: family revoked; Portfolio Context rejected even if access JWT
                 has not expired

LEGACY TOKENS:
Without sid: ordinary compatible endpoints continue; Portfolio Context denied
             or unresolved; no userId fallback
Portfolio context behavior: requires refresh/re-login for sid-bearing token

COOKIE:
Refresh cookie path changed: NO

CORE IMPACT:
Organization cardinality: NO
Portfolio semantics: NO
AI authority: NO
Human authority: NO
Steps: NO
Adaptive Cycle: NO

IMPLEMENTATION:
AUTH BINDING SLICE: AUTHORIZED — AUTH-SID-1
SF-7B.2D: BLOCKED UNTIL AUTH BINDING IMPLEMENTED
KAN-41: BLOCKED

Remaining blockers:
- implement and test sid issuance/preservation;
- implement and test family-active validation for session-sensitive consumers;
- resolve development fallback-token behavior for Portfolio Context.
```
