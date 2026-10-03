# KAN-97 — Continuation Identity Transport v0.1

**Estado:** `IDENTITY_TRANSPORT_READY`
**Slice:** KAN-74 C1.2 — browser-side transport de identidad del Brief confirmado
**Alcance:** solo transporte; no implementa D2 hydration ni cambia semántica de Portfolio Entry, D1 o First Value.

## A. Preconditions and authority

- Worktree: `C:\Users\User\proyect-starteria\starteria-KAN-97`; branch `feat/KAN-97-identity-transport`.
- Inicialmente limpio; `HEAD == origin/main == 29dccaac001ea7f99ef0f6e3cf1b432526069804`.
- Jira: KAN-97 EN CURSO; KAN-78, KAN-80, KAN-89 y KAN-90 RESUELTO; KAN-96 EN CURSO.
- Autoridad consultada: instrucciones de `AGENTS.md`, `TESTING.md`, `.claude/skills/implementar/SKILL.md`, Jira indicado, tipos/storage actuales, `AuthPage`, `AuthenticatedProvisionalContinuationPage`, flujo de continuación y esquema D1 `confirmedBriefIdentitySchema`.
- KAN-80 gobierna la revisión: durante claim, usar exactamente `claimResponse.revision`; preservar source, session, handoff y confirmation. No se calcula `+1`.

## B. V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-97 — restore Portfolio Entry confirmed-Brief identity transport
Authority: Jira KAN-78/KAN-80/KAN-97, KAN-89 D1 identity schema, KAN-90 confirmation; no product-semantic change
Manifest status: D1 and First Value promoted; identity transport regression in current frontend
Current route: auth claim → /public/provisional-continuation → backend destination /portfolio/inicio
Legacy dependencies: existing sessionStorage claim flow and authenticated continuation DTOs; reused
Semantic owner: V2 transport; Portfolio Entry confirmation and D1 response semantics unchanged
V1 assumptions detected: none accepted
Adapter required: typed identity extraction from authorized backend DTOs to existing browser storage
Tests protecting current behavior: Portfolio Entry auth/confirmation/conversion component and E2E tests
Tests required for V2: storage/identity, AuthPage claim, authenticated continuation, conversion refresh, directed E2E
Authority conflict: none; exact claim revision comes from claim response; no inferred revision/latest resolver
Proceed: YES
```

## C. CURRENT_IDENTITY_TRANSPORT_MAP

| Journey step | `source` | `sessionId` | `sessionRevision` | `handoffId/version` | `confirmationId/version` |
|---|---|---|---|---|---|
| Portfolio Entry confirmed DTO | Contract literal `portfolio_entry` | `sessionDto.id` | `sessionDto.revision` | `sessionDto.handoff.id/version` | `sessionDto.confirmation.id/version` |
| Before auth / pending claim | Kept when a full confirmed identity is available | Existing `sessionRef.sessionId` | Existing DTO revision only when identity is confirmed | Existing confirmed DTO IDs | Existing confirmed DTO IDs |
| Claim response | Contract literal | `claimResponse.id` | Exact `claimResponse.revision` | Exact IDs in the claim DTO; when a pending identity exists, mismatch fails closed | Exact IDs in the claim DTO; pending identity mismatch fails closed |
| Claimed browser storage | `portfolio_entry` | Exact session | Exact backend response | Exact backend response | Exact backend response |
| Authenticated continuation read | Contract literal | Same claimed session | Authorized session DTO revision | Session DTO handoff | Session DTO confirmation |
| Final confirmation response | Contract literal | Exact response session | Exact response revision | Exact response handoff | Exact response confirmation |
| Continue to Portfolio / navigation | Unchanged from stored identity | Unchanged | Not derived from navigation or continuation ID | Unchanged | Unchanged |
| `/portfolio/setup` after refresh | Read by `readClaimedPortfolioEntryBriefIdentity()` | Same stored identity | Same stored identity | Same stored identity | Same stored identity |

## D. LOSS_POINT and ROOT_CAUSE

The current path lost fields at four points:

1. **Pending auth record — `REDUCED_TO_SESSION_ID`:** `continueToSignup` saved only the anonymous `{sessionId, credential}`. It now also saves the full confirmed identity when the current DTO contains an explicitly confirmed Brief.
2. **Auth claim — `NOT_PERSISTED` / `REDUCED_TO_SESSION_ID`:** `AuthPage` awaited claim and discarded its DTO, then wrote `{sessionId}`. It now uses the claim response DTO, sets revision from its exact `revision`, and preserves/validates the other tuple values.
3. **Storage schema — `STORAGE_SCHEMA_TOO_NARROW`:** `ClaimedPortfolioEntrySessionRef` represented only `sessionId`. The existing name now accepts the complete `PortfolioEntryBriefIdentity`; old session-only records remain incomplete.
4. **Authenticated continuation and conversion — `NOT_PERSISTED` / `OTHER (cleared)`:** confirmation returned a current backend DTO without updating claimed storage, and conversion cleanup removed the claimed record. The authenticated confirmation response now refreshes the stored tuple before continuing; conversion cleanup preserves a valid complete identity and removes incomplete legacy records.

Navigation did not carry an identity in route state. The implementation does not add navigation-state dependence; same-tab `sessionStorage` survives the existing route change and page refresh.

## E. RESTORED_IDENTITY_CONTRACT

The sole full identity model is `PortfolioEntryBriefIdentity`:

```ts
{
  source: 'portfolio_entry';
  sessionId: string;
  sessionRevision: number;
  handoffId: string;
  handoffVersion: number;
  confirmationId: string;
  confirmationVersion: number;
}
```

`portfolioEntryBriefIdentityFromSession` creates it only from a confirmed session, handoff, and confirmation in an authorized backend DTO. `isPortfolioEntryBriefIdentity` validates all fields. No rawEntry or synthetic identifier participates.

## F. CLAIM_PATH

`AuthPage` continues using the existing authorized session read to provide `expectedRevision` to claim. After successful claim, identity revision comes from the returned claim DTO, never from arithmetic. When a pending confirmed identity exists, session/handoff/confirmation identifiers must match the claim DTO; a mismatch does not create a full identity. If the response has no complete confirmed identity and no valid pending one, storage remains session-only so the existing authenticated continuation can recover safely.

## G. AUTHENTICATED_PATH

The existing `/public/provisional-continuation` route loads the same claimed session through its authenticated endpoint. After the existing explicit confirmation operation returns, the page stores the exact returned session revision and handoff/confirmation identifiers before `continuePortfolioEntryToPortfolio` and navigation. Product confirmation behavior is unchanged.

For the already-authenticated conversion path, `PortfolioEntryExperience` extracts the tuple from its current confirmed session DTO and restores it after conversion cleanup. The continue endpoint's route/continuation ID is not used to reconstruct D1 identity.

## H–K. STORAGE, NAVIGATION, REFRESH, BACKWARD COMPATIBILITY

- The existing `starteria.portfolioEntry.claimedSession` sessionStorage slot holds the complete flat identity once confirmed.
- `readClaimedPortfolioEntryBriefIdentity()` returns `null` for absent, malformed, or incomplete records.
- Legacy `{ sessionId }` remains readable by the authenticated recovery page, but it is never promoted to D1 identity. That page may obtain exact data only from its already-authorized same-session read/confirmation responses.
- Conversion cleanup preserves a valid full identity and removes incomplete claim references.
- No route state or query parameter is required. Same-tab navigation and refresh retain the browser sessionStorage value.
- Limitation: sessionStorage is tab-scoped; a new tab does not inherit this identity automatically.

## L. ZERO_WRITE_BOUNDARY

No backend or canonical product writes were added. This change only persists frontend continuation metadata. It creates/modifies no Portfolio, StrategicFront, Challenge, Initiative, Step, First Value, or P3 state. No D1 lookup, latest lookup, D1 response change, rawEntry fallback, or D2 hydration was added.

## M–N. TESTS and REGRESSION

- Test-first storage tests initially failed (2 expected failures): full identity was reduced to `{sessionId}`, and legacy session-only data was indistinguishable from a valid identity. Both passed after implementation.
- Focused tests: **5 files, 42 tests passed** — storage, identity extraction, AuthPage claim, authenticated continuation, and Portfolio Entry conversion.
- Frontend regression suite: `npm run test:front` — **PASS** (exit 0).
- `npm run typecheck:front` — **PASS**.
- `npm run lint` — **PASS** (`Baseline lint passed`).
- `npm run build` — **PASS**; Vite emitted existing dynamic-import and chunk-size advisories.
- No backend files changed; backend tests were not required.

## O. Directed E2E

`npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts` — **PASS, 8 tests** on the local Docker-backed E2E stack. The continuation helper checks the browser-stored tuple against the exact confirmation response, then reloads and verifies the identity remains unchanged. This is `LOCAL_E2E`; no external identity provider or deployed network was exercised.

## P. KAN-96 readiness

The future D2 adapter can call `readClaimedPortfolioEntryBriefIdentity()` on `/portfolio/setup` after refresh and receive the full validated identity, without navigation state, revision guessing, or a latest lookup. KAN-96's D1 runtime call itself remains unimplemented in this slice.

```text
KAN96_IDENTITY_READY = YES
IDENTITY_TRANSPORT_READY = YES
```

## Q. Remaining limitations

- Session-only legacy records require the existing authorized same-session continuation before becoming a complete identity; no values are fabricated.
- Browser sessionStorage is tab-scoped and intentionally does not establish cross-device or new-tab continuity.
- The `/portfolio/setup` consumer is a later KAN-96 change; this report proves that its reader can obtain the identity, not that D1 hydration runs.

```text
NO_D1_SEMANTIC_CHANGE = YES
NO_PRODUCT_CONFIRMATION_CHANGE = YES
NO_CANONICAL_PORTFOLIO_WRITES = YES
```
