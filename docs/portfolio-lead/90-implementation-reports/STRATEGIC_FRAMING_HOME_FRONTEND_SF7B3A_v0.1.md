# Strategic Framing Home Frontend Consumption — SF-7B.3A

**Status:** GO_WITH_GAPS  
**Date:** 2026-09-27

## 1. Baseline

- **Base SHA:** `6ed92ccfb0cd440739e30c2a0826fb3b5ad6dbe6`
- **Branch:** `design/KAN-41-sf7b2-home-authority-composition`
- **Working tree clean:** YES at start of implementation.

## 2. Home surface consumed

- **Home API:** `GET /api/v1/portfolio/home` through the existing Axios client.
- **Response type:** `PortfolioHomeResponse` with the backend discriminated `strategicFraming.status` union.
- **Hook:** `usePortfolioHome`, including the existing Home `refetch` path.
- **Component:** `StrategicFramingHomeSection`, rendered additively inside `PortfolioLeadHomePage`.

The canonical Home continues to render from the existing Portfolio Lead state and layout. This slice does not replace metrics, navigation, permissions, alerts, onboarding, or Steps 0–4.

## 3. Strategic Framing states

- **Available:** renders the backend projection fields, including total count, pagination signal, intended movement, prioritization values, structuring values, attention state, and workspace links. No frontend authority or derived priority/coverage logic is introduced.
- **Empty:** shows a legitimate empty reading: “Todavía no hay una lectura estratégica estructurada.” No error or fake zero metrics.
- **No context:** explains that there is no active portfolio context for the session. It does not claim that there are zero initiatives.
- **Context selection required:** explains that more than one space is available and shows the placeholder CTA “Seleccionar espacio”. The CTA does not select or infer an organization.
- **Not authorized:** explains that access to the portfolio changed and does not map the state to empty or unavailable.
- **Unavailable:** localizes the technical failure and provides a real “Reintentar” button that calls the Home hook refetch. Canonical Home remains rendered.

Loading uses an inline strategic section state; it does not add a second full-page loader or fake strategic metrics.

## 4. Authority and request boundaries

- **Parallel Strategic Framing request:** NO. The frontend consumes Strategic Framing only from the composed Home response.
- **Client organization authority introduced:** NO.
- **`User.organizationId` used:** NO.
- **Browser auto-selection:** NO.
- **Final Portfolio Context selector:** NOT IMPLEMENTED; deferred to SF-7B.3B as requested.

## 5. Files changed

- `front/src/app/services/portfolioService.ts`
- `front/src/app/hooks/usePortfolioHome.ts`
- `front/src/app/hooks/__tests__/usePortfolioHome.test.tsx`
- `front/src/app/components/portfolio/StrategicFramingHomeSection.tsx`
- `front/src/app/components/portfolio/__tests__/StrategicFramingHomeSection.test.tsx`
- `front/src/app/pages/PortfolioLeadHomePage.tsx`
- `docs/portfolio-lead/90-implementation-reports/STRATEGIC_FRAMING_HOME_FRONTEND_SF7B3A_v0.1.md`

## 6. Verification

- **Focused frontend tests:** PASS — 13 tests across the state matrix, exhaustive handling, retry, disabled Bootstrap path, and existing Home bootstrap regression.
- **Existing Portfolio Home test:** PASS — `PortfolioLeadHomePage.bootstrap.test.tsx` (3 tests).
- **Full frontend regression:** PASS — `npm run test:front`.
- **Frontend typecheck:** PASS — `npm run typecheck:front`.
- **Lint:** PASS — `npm run lint` (`Baseline lint passed`).
- **Diff check:** PASS — `git diff --check`.

The focused test run reports expected test-environment warnings for the intentionally thrown unknown-state exhaustive branch, React async `act` diagnostics in the hook retry test, and an existing MSW unmatched-request warning for the new Home call in the legacy page test. They do not fail the suite.

## 7. Remaining UX gaps

- SF-7B.3B must provide the actual server-governed context discovery/selection interaction.
- The current canonical Home still hydrates its legacy Portfolio Lead context through its existing data path; this slice adds the composed Home read for Strategic Framing without redesigning that unrelated surface.
- Runtime visual QA at mobile/tablet widths remains a follow-up; the section uses the current responsive card/container primitives.

## 8. SF-7B.3B readiness

**READY** for the next slice to add an authorized server-backed context selection flow. The current UI already represents `context_selection_required` without auto-selecting, but it intentionally has no selector data endpoint or mutation.
