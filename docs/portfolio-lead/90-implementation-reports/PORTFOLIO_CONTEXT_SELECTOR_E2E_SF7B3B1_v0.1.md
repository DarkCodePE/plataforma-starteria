# PORTFOLIO CONTEXT SELECTOR BROWSER E2E — SF-7B.3B.1

## 1. Base SHA

`5d7d5c24c62d509da006cc9cec2baf81539fef64`

## 2. Branch

`design/KAN-41-sf7b2-home-authority-composition`

## 3. E2E capability audit

- **Framework:** Playwright, existing `front/e2e` suite and `front/scripts/run-e2e.ts` runner.
- **Browser contexts:** supported by Playwright; the spec creates two independent `browser.newContext()` instances.
- **Login helper:** existing API login conventions plus browser cookie login through `/api/v1/auth/login` and the existing refresh-cookie flow.
- **Two isolated sessions:** supported in the spec; each browser context logs in independently.
- **Organizations/membership:** seeded directly through the existing E2E Prisma database connection inside the spec.
- **Scoped grants:** existing Prisma model and authority tests support them; this browser fixture uses the seeded `portfolio_lead` global `portfolio:read` permission, so no grant semantics are invented.
- **Strategic Framing data:** seeded through the existing `StrategicFramingProvisionalState` model with organization-specific markers.
- **Live revocation:** supported for membership; the spec deletes the selected organization membership before reload.

## 4. Coverage added

The new `portfolio-context-selector-sf7b3b1.spec.ts` contains 8 Playwright scenarios:

- `E2E-CTX-01`: single-org auto context and no mandatory selector.
- `E2E-CTX-02..05`: multi-org required state, authorized options, explicit switch, and organization-specific Strategic Framing marker.
- `E2E-CTX-06`: reload persistence from server-owned context.
- `E2E-CTX-07`: two independent browser sessions and isolation after switching one session.
- `E2E-CTX-08`: unauthorized organization absent and direct API selection rejected.
- `E2E-CTX-09..10`: no organization storage and no parallel Strategic Framing request.
- `E2E-CTX-11`: membership revocation produces `not_authorized` without silent fallback.
- `E2E-CTX-13`: selector smoke at desktop, tablet, and mobile widths.

## 5. Execution result

The E2E runner successfully completed:

- disposable PostgreSQL availability;
- all 43 Prisma migrations, including the existing SF-7B.2D migration;
- E2E seed;
- backend startup and `/api/health` 200 response;
- Vite frontend startup.

Playwright could not launch because the environment lacks:

`C:\Users\User\AppData\Local\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell.exe`

`npx playwright install chromium` was attempted, including an escalated network attempt, but the CDN download timed out. Therefore all 8 browser scenarios are **blocked at browser launch**, before test setup or assertions. No browser behavior is claimed as passed.

## 6. Scenario status

| Scenario | Result |
|---|---|
| Single-org | Not executed: Chromium unavailable |
| Multi-org | Not executed: Chromium unavailable |
| Explicit select | Not executed: Chromium unavailable |
| Home refetch | Not executed: Chromium unavailable |
| Strategic Framing isolation | Not executed: Chromium unavailable |
| Reload persistence | Not executed: Chromium unavailable |
| Two-session isolation | Not executed: Chromium unavailable |
| Unauthorized org | Not executed: Chromium unavailable |
| Client authority storage | Covered by assertions, not executed |
| Parallel SF fetch | Covered by request assertions, not executed |

## 7. Revocation

- **Membership:** browser scenario authored for live membership deletion and reload; not executed because Chromium was unavailable.
- **Scoped grant:** not duplicated as browser data because the current fixture uses the existing global `portfolio:read` path. Lower-layer SF-7B.2D tests cover scoped grant revocation. A browser scoped-grant case remains deferred until a runnable browser is available and the fixture is needed.

## 8. Responsive smoke

Desktop, tablet, and mobile viewport assertions are present in the spec. They were not executed because the browser executable was unavailable.

## 9. Product changes

- **Product bugs found:** none confirmed.
- **Product fixes made:** none.
- **ADR/Core/Step/Prisma changes:** none.

## 10. Files changed

- `front/e2e/portfolio-context-selector-sf7b3b1.spec.ts`
- `docs/portfolio-lead/90-implementation-reports/PORTFOLIO_CONTEXT_SELECTOR_E2E_SF7B3B1_v0.1.md`

## 11. Verification

- **Portfolio Context E2E:** 8 tests discovered; execution blocked at Chromium launch.
- **Home E2E:** existing suite not changed; no new browser result claimed.
- **Backend context:** PASS — 19 focused tests for authority and router behavior.
- **Frontend regression:** PASS — 13 focused selector/Strategic Framing/Home tests.
- **Typecheck:** PASS — backend and frontend.
- **Lint:** PASS — baseline lint.
- **Diff check:** PASS — `git diff --check`.

Existing non-blocking warnings remain documented: React `act(...)` diagnostics, the intentional exhaustive-state test warning, Radix test ref warning, and Playwright/Prisma environment deprecation notices. They did not cause the E2E block.

## 12. SF-7B.3C readiness

**NOT_READY** for final progression: SF-7B.3B.1 browser execution must be rerun in an environment with the required Playwright Chromium executable. No SF-7B.3C work was started.

## 13. SF-7B.3B.1A assertion hardening

### Initial executable run

`2 PASS / 6 FAIL`.

### Failure classification

- **CTX-01:** `TEST_ASSERTION_ERROR` / `TEST_INSTRUMENTATION_ERROR`. `page.request` did not carry the SPA's in-memory Bearer token. Replaced with the authenticated browser Home response.
- **CTX-02..05:** `TEST_ASSERTION_ERROR`. The global button locator matched both Portfolio Home and Strategic Framing CTAs; the test now scopes the canonical header selector. The fixture also contained the seeded authorized organization, so exact option cardinality was removed.
- **CTX-06:** `TEST_INSTRUMENTATION_ERROR`. Direct browser `fetch` omitted the SPA Bearer token; reload now observes the authenticated Home response and UI.
- **CTX-07:** `TEST_ASSERTION_ERROR`. Current-context checks assumed a nonexistent `aria-label`; they now observe the canonical selector button.
- **CTX-09..10:** `TEST_INSTRUMENTATION_ERROR`. The request assertion matched Vite module URLs containing `strategic-framing`; it now filters the API path and waits for PUT 200 followed by Home GET 200.
- **CTX-11:** `TEST_ASSERTION_ERROR`. The test required Org B to appear active immediately after revocation, contradicting no-fallback semantics. It now checks access-changed, no Org A data, explicit Org B availability, and only then switches explicitly.

### Product bugs confirmed

None.

### Test defects confirmed

All six initial failure groups were test assertion/instrumentation defects. Fixed in `front/e2e/portfolio-context-selector-sf7b3b1.spec.ts`.

### Accessibility gaps confirmed

None. The current DOM already exposes the selected context through the selector button or existing accessible current-context span; no production accessibility change was required.

### Final targeted E2E

`8 passed` using the repository runner and local Edge project. No fixed sleeps were added.

### Second stability run

`8 passed` on the repeat targeted run.

### SF-7B.3C readiness

`READY` for progression from the SF-7B.3B.1A validation gate. SF-7B.3C was not implemented in this work.
