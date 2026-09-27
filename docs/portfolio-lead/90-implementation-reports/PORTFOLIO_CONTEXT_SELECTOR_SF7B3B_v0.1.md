# PORTFOLIO CONTEXT SELECTOR & SWITCH UX — SF-7B.3B

## 1. Base SHA

`5d7d5c24c62d509da006cc9cec2baf81539fef64`

## 2. Branch

`design/KAN-41-sf7b2-home-authority-composition`

## 3. Existing HTTP boundary audit

| Capability | Route | Method | Auth | Server authority | Response | Usable before SF-7B.3B |
|---|---|---|---|---|---|---|
| Current Portfolio context | `/api/v1/portfolio/home` (indirect state only) | GET | `authenticate` | `PortfolioContextAuthorityService.resolve` | Home plus `strategicFraming.status`; no current organization summary | Partial |
| Authorized context options | None | — | — | — | — | No |
| Select context | None | — | — | — | — | No |
| Clear context | None | — | — | — | — | No |

## 4. APIs added

- `GET /api/v1/portfolio/context`: authenticated server-computed status, current organization summary when available, and minimal authorized `{ organizationId, name }` options.
- `PUT /api/v1/portfolio/context`: authenticated candidate selection. The controller passes the candidate to `PortfolioContextAuthorityService.select`; it does not implement membership or permission rules.
- `DELETE /api/v1/portfolio/context`: lifecycle clear for the current auth session. It is not exposed as a primary visible UX action.
- `GET /api/v1/portfolio/home` now includes the same server-computed `portfolioContext` view so Home/header can render the authoritative current context without inferring it from a menu click.

## 5. Authority and data handling

- **Current-context source:** `PortfolioContextAuthorityService.resolve`, revalidated on the request; the display name is matched against the same server-authorized option set.
- **Options source:** `listAuthorizedOrganizations` inside `PortfolioContextAuthorityService`, using current membership plus global `portfolio:read` or scoped `portfolio:read` through `ScopedPortfolioAccessService`.
- **Selection authority:** `PortfolioContextAuthorityService.select`, including active `authSessionId`, membership, and current grant/permission validation before persistence.
- Grants, membership internals, auth session identity, and persistence internals are not exposed to the frontend.

## 6. UX behavior

- **Selector placement:** compact context affordance above the Portfolio Home header; it uses the existing accessible Dialog and real buttons.
- **Single organization:** server auto-establishment remains unchanged. The UI shows the organization name without forcing selector interaction.
- **Multiple organizations:** explicit `Seleccionar espacio` / current-name switch affordance. Only server-returned authorized options render; selected state is semantic via `aria-selected` and a visible check.
- **Selection required:** the SF-7B.3A placeholder now opens the functional selector. No automatic choice is made.
- **Switch:** selection shows a loading/disabled state, then refetches Portfolio Home. Canonical Home and Strategic Framing are not patched locally.
- **Not authorized:** the server keeps `not_authorized`; if the server reports other options, the selector remains available and does not silently switch context.
- **No context/options:** no empty selector is rendered. Existing neutral Home/SF state remains authoritative.
- **Selection failure:** 403 is localized as `Ya no tienes acceso a este espacio.` and technical failures as `No pudimos cambiar de espacio. Inténtalo nuevamente.` No optimistic context/data change occurs.
- **Technical option failure:** localized retry is shown and is not mapped to `no_context` or `not_authorized`.
- **Clear:** no visible clear action was added; switching is the user-value path. DELETE exists for lifecycle completeness.

## 7. Authority safeguards

15. Local organization authority storage: **NO**. No `localStorage`, `sessionStorage`, organization cookie, or account-global preference was added.

- Browser organization candidates are untrusted input only.
- `User.organizationId` is not used.
- Home requests do not require a browser-supplied organization id.
- The server revalidates session activity, membership, and global/scoped permission on context operations and Home resolution.
- ADR-032 two-session semantics remain intact because persistence is keyed by the verified JWT `sid` / `authSessionId`.

## 8. Files changed

- `backend/modules/portfolio/portfolio.controller.ts`
- `backend/modules/portfolio/portfolio.router.ts`
- `backend/modules/portfolio/portfolio.schemas.ts`
- `backend/shared/portfolio-context/portfolio-context-authority.service.ts`
- `backend/shared/portfolio-context/portfolio-context.types.ts`
- `front/src/app/services/portfolioService.ts`
- `front/src/app/components/portfolio/PortfolioContextSelector.tsx`
- `front/src/app/components/portfolio/StrategicFramingHomeSection.tsx`
- `front/src/app/pages/PortfolioLeadHomePage.tsx`
- `front/src/app/components/portfolio/__tests__/PortfolioContextSelector.test.tsx`

Pre-existing untracked SF-7B.3A test files were preserved and remain included in validation; they were not rewritten by this slice.

## 9. Verification

- **Backend context/security:** PASS — 32 focused tests across Portfolio Context Authority, Portfolio Home read composition, and Portfolio router authorization. Existing authority tests cover authorized options, global/scoped paths, unauthorized organizations, candidate validation, membership/grant revocation, session isolation, and no `User.organizationId` fallback.
- **Frontend selector:** PASS — 3 tests covering open/options, server selection/refetch, no optimistic Home change, and localized forbidden selection.
- **Strategic Framing regression:** PASS — 8 tests.
- **Portfolio Home regression:** PASS — 3 tests.
- **Typecheck:** PASS — `npm.cmd run typecheck:backend`; `npm.cmd run typecheck:front`.
- **Lint:** PASS — `npm.cmd run lint` (`Baseline lint passed`).
- **Diff check:** PASS — `git diff --check`.
- Known non-blocking test warnings: existing `act(...)` diagnostics, the deliberate unknown-state exhaustive test, and an existing MSW unmatched request warning in the legacy Home regression.

## 10. Schema and authority scope

- **Prisma changed:** NO. SF-7B.2D's existing `PortfolioContextSelection` migration/model is reused.
- **Core changed:** NO.
- **Step 0–4 changed:** NO.
- **Strategic Framing projection semantics changed:** NO. Context switching causes Home refetch; the backend projection remains the authority for the selected organization.

## 11. Remaining UX gaps

- Full browser E2E with two real organizations and two independent auth sessions remains release/runtime validation work.
- Manual visual QA at mobile/tablet widths remains a follow-up; the selector uses the existing responsive Dialog primitive.
- The existing Home regression emits an unmatched MSW warning because its fixture predates the composed Home request; it does not fail the test.

## 12. SF-7B.3C readiness

**READY**. The selector boundary, server-authorized options, session-scoped selection, Home refetch, and failure semantics are implemented without Core, Step, Prisma, or local browser authority changes.
