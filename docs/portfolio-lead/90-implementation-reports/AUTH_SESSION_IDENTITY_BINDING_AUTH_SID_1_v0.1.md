# AUTH-SID-1 — Stable Auth Session Identity Binding

## 1. Base SHA

`89bbf1f173cdacfd206a148962789c6eaf5242eb`

## 2. Branch

`design/KAN-41-sf7b2-home-authority-composition`

The worktree was not clean before this slice because the previously authorized ADR and
Strategic Framing contract/design documents were present as scoped working changes.

## 3. ADR-033

ADR-033 is `ACCEPTED` and authorizes AUTH-SID-1 only. No Portfolio Context persistence,
Home composition, frontend, Prisma, or Core changes are included here.

## 4. Session identity

The authenticated-session identity is the persisted `RefreshToken.family`. A new normal
login establishes a new family; refresh rotation reuses the existing family. The family
is matched to the actor at session-sensitive validation time.

## 5. JWT claim

Normal persisted access tokens contain signed `sid = RefreshToken.family`. `sid` is opaque
session lineage identity only; it is not a permission, membership, organization, refresh
credential, or authorization decision.

## 6. Login issuance

`AuthService.issueTokenPair` now establishes the family before signing the access token,
then persists the refresh row with that same family. Independent login calls therefore
receive independent families and matching `sid` values.

## 7. Refresh preservation

The existing refresh path passes `storedToken.family` into token issuance. The resulting
refresh row and access token preserve the same family/`sid`; rotation does not create a
new session identity.

## 8. Multiple-login isolation

The existing `crypto.randomUUID()` family creation remains per new login. No
user-level deduplication was introduced. Session A and Session B can therefore carry
different Portfolio contexts in the later ADR-032 slice.

## 9. Middleware exposure

After signature and issuer/audience verification, `authenticate` maps the verified JWT
`sid` to `req.user.authSessionId`. No request body, query parameter, custom header, or
`User.organizationId` participates in this mapping. Missing `sid` remains absent.

## 10. Family-active validator

`AuthSessionService.isAuthSessionActive({ actorUserId, authSessionId })` queries for at
least one refresh row matching both actor and family that is not revoked and has not
expired. This is rotation-safe: a revoked historical token does not make the family
inactive while a replacement row remains active. A family with no active row, or a
family presented for another user, is inactive.

The global authentication middleware remains JWT-only. Session-sensitive consumers are
responsible for invoking this primitive.

## 11. Logout/revocation behavior

Existing logout behavior is unchanged: all rows in the refresh family are revoked.
Consequently, the family-active validator returns `false` after logout while an already
issued access JWT may remain cryptographically valid until its normal expiry.

## 12. Legacy-token behavior

`TokenPayload.sid` is optional at the verification boundary for compatibility with
already-issued access JWTs. A token without `sid` remains usable by ordinary compatible
endpoints, but middleware does not invent `authSessionId`; session-sensitive Portfolio
runtime must treat the binding as unavailable.

## 13. Development fallback behavior

`issueDevTokenPair` continues to issue the existing development fallback token without
`sid`, because it has no persisted refresh-family lineage. No user ID, static value, or
per-request random value is used as a substitute.

## 14. Cookie behavior

The refresh cookie remains `starteria_rt` with path `/api/v1/auth/refresh`. No refresh
credential was exposed to Portfolio routes.

## 15. Other token issuers

| Issuer | Real persisted family | `sid` behavior |
|---|---:|---|
| Password login | Yes | Emits family as `sid` |
| Normal refresh | Yes, existing family | Preserves family as `sid` |
| Google sign-in for active users | Yes | Emits new family as `sid` |
| Development database-unavailable fallback | No | No `sid`; no session binding |
| Test/direct `generateAccessToken` helpers | Caller-defined | No production session semantics; tests may model legacy or bound tokens |

No other production access-token issuer was found. Waitlisted registration/Google
branches do not issue access tokens.

## 16. Files changed

Implementation files:

- `backend/modules/auth/token.service.ts`
- `backend/modules/auth/auth.service.ts`
- `backend/modules/auth/auth.middleware.ts`
- `backend/modules/auth/auth-session.service.ts`
- `backend/modules/auth/__tests__/token.service.test.ts`
- `backend/modules/auth/__tests__/auth.middleware.test.ts`
- `backend/modules/auth/__tests__/auth-session.service.test.ts`
- `backend/modules/auth/__tests__/auth.session-issuance.test.ts`
- this report

No Prisma schema or migration was changed.

## 17. Tests

Focused AUTH-SID tests pass:

- token claim and verification;
- login-family issuance;
- refresh-family preservation;
- independent login families;
- middleware exposure;
- client override ignored;
- legacy token without `sid`;
- active, revoked/expired, wrong-user, and absent-family validation.

The complete auth test directory passed: **9 files, 78 tests**.

## 18. Typecheck

`npm.cmd run typecheck:backend` passed.

## 19. Diff check

`git diff --check` passed. Git emitted only existing line-ending/config-ignore warnings.

## 20. ADR deviations

None. The implementation preserves Model B: ordinary auth remains stateless at request
middleware level; family-active lookup is an explicit session-sensitive capability.

## 21. Remaining risks

- Legacy and development tokens intentionally have no session binding and cannot support
  the later session-scoped Portfolio Context.
- Family activity is evaluated lazily by the consuming session-sensitive operation; no
  global database lookup was added to every authenticated request.
- Cookie-path regression was verified against the unchanged controller contract; no
  cookie behavior was modified in this slice.

## 22. SF-7B.2D readiness

The auth binding prerequisite is implemented and tested. SF-7B.2D may be considered
for a separate authorized implementation slice, but it was not resumed here. KAN-41
remains blocked until that later Portfolio Context runtime is implemented and verified.
