# KAN-64 Public Landing L1 Implementation Report

**HU:** KAN-64 — Public Landing — L1 Product Framing & Hero  
**Manifest slice:** `KAN-64_PUBLIC_LANDING_L1_PRODUCT_FRAMING_HERO`  
**Base SHA:** `26e2d76a2fce708ef4695bd9af631fcc1e3638d6`  
**Branch:** `feat/KAN-64-public-landing-l1-framing`  
**Guardrail:** `V2_CHANGE_GUARDRAIL_CHECK — Proceed: YES`

## Authority

Implemented under `docs/STARTERIA_AUTHORITY.md`, Core Logic Contract v0.2 (factual / pending validation), ADR-006, the Public Landing UX Spec v0.1, frontend current-state audit v0.1, Public Landing / Portfolio Entry continuation architecture v0.1, Portfolio Entry acceptance checklist v0.1, and the existing frontend design system. No product or contract authority was added.

## Scope implemented

- Updated the `/` hero to the UX Spec FINAL headline and supporting copy.
- Put the four-part platform model before Portfolio Entry in the document and visual flow.
- Presented Portfolio Entry below the model with its FINAL optional-orientation framing. The component and its existing props/runtime are unchanged.
- Added L1-specific component tests and updated one stale route-test expectation for the ADR-006 headline.
- No Early Access or Demo destination/runtime was added.

## Files changed

- `front/src/app/pages/LandingPage.tsx`
- `front/src/app/pages/__tests__/LandingPage.test.tsx`
- `front/src/app/routes.public-entry.test.tsx`
- `docs/implementation/public-landing/KAN-64_PUBLIC_LANDING_L1_IMPLEMENTATION_REPORT_v0.1.md`

## KEEP / ADAPT / NEW

- **KEEP:** Landing route, shared shell/navigation, existing design primitives, `PortfolioEntryExperience`, its props, `/public/start` redirect and journey logic.
- **ADAPT:** Existing `LandingPage` hero/framing, local `PlatformStructure` (now four ordered steps and responsive), and Portfolio Entry’s placement/presentation as optional orientation.
- **NEW:** LandingPage L1 test file and this implementation report. No new product component, shell, design system, route, API or domain object.

## Presentation details

- **Hero:** “Convierte estrategia e iniciativas en decisiones sustentadas.” Supporting copy is copied from the UX Spec FINAL baseline.
- **PlatformStructure:** Shows `Estrategia / necesidad → Iniciativas → Evidencia + avance → Decisiones` as an ordered list. At small widths it wraps into two columns; at wide widths it uses four columns.
- **Portfolio Entry:** Appears after the model with “¿Todavía no tienes claro por dónde empezar?” and the FINAL supporting copy. The existing interactive experience remains available beneath it.

## Intentionally not implemented

- Early Access runtime, Demo runtime, routes, forms, APIs, persistence, email, calendar, CRM, lead creation or scheduling.
- Changes to Portfolio Entry analysis, Agent, Skills, clarification, exploration, handoff, API calls or analytics.
- Changes to `/public/start`, backend, authentication semantics, Core, Steps 0–4, Adaptive Cycle, canonicalization or domain models.

## Verification

- **Frontend component and route tests:** PASS — 3 files, 29 tests. Command: `npm run test:front -- src/app/pages/__tests__/LandingPage.test.tsx src/app/routes.public-entry.test.tsx src/features/portfolio-entry/public/__tests__/PortfolioEntryExperience.test.tsx`.
- **Frontend typecheck:** PASS — `npm run typecheck:front`.
- **`git diff --check`:** PASS.
- **E2E:** NOT RUN TO COMPLETION. `npm run test:e2e -- e2e/public-start-access.spec.ts` could not start its isolated PostgreSQL container: Docker daemon pipe access was denied (`//./pipe/docker_engine: Access is denied`). Thus `/public/start` runtime behavior was not revalidated end-to-end in this environment.
- **Manual desktop/mobile QA:** NOT RUN. No browser session was available; responsive ordering and wrapping are covered by markup/classes and component assertions, not visual inspection.

## No-regression assessment

- Portfolio Entry implementation was not changed; its existing relevant tests pass (23 tests), and the route test still verifies explicit navigation to `/public/start`.
- No route, backend, API, persistence, auth, Core or Step files were changed.
- No functional Early Access or Demo controls/destinations were introduced.
- `/public/start` regression: **NOT RUN end-to-end** because Docker access prevented E2E setup. Static route and implementation files were untouched.
- Core/Steps regression: **NONE observed in the diff**; no affected files.

## Remaining gaps and next slice

- Complete desktop/mobile browser review and `/public/start` E2E when Docker access is available.
- Early Access and Demo remain out of runtime scope. Recommended next slice: separately authorized runtime/destination implementation for Early Access and Demo after the target routes and technical contracts are approved; no destination is implied by this L1 implementation.

**Session status:** implementation is prepared for review, with E2E and manual visual QA still outstanding.

## Validation closeout follow-up

**Date:** 2026-09-30  
**Product changes:** none.

- Preflight confirms the only tracked/untracked worktree changes are the four KAN-64 files listed above. `git diff --check` passes.
- Targeted tests repeated: **PASS**, 29/29 across the LandingPage, route and PortfolioEntryExperience test files.
- Frontend typecheck repeated: **PASS** (`npm run typecheck:front`).
- Docker daemon access was authorized and became available. PostgreSQL started and migrations/seeding succeeded on the second attempt. The E2E runner then reached Playwright, but both `/public/start` cases were blocked before browser launch because Playwright Chromium is not installed at `C:\Users\User\AppData\Local\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe`. The runner also logged ports 4100 and 5176 already in use. No route assertion ran; `/public/start` remains **NOT VERIFIED** by E2E. No Docker configuration was changed.
- E2E for `/` was not run: the same missing Playwright Chromium binary prevents browser execution.
- A local Vite preview started at `http://127.0.0.1:5173/` and was stopped after confirming no Chromium executable was available. Desktop and mobile visual inspection are **BLOCKED**, not passed.
- Product mental model: **REVIEW**. The rendered-component tests and DOM order show the approved headline/supporting copy and platform model precede the Portfolio Entry input. Without a browser, their actual visual prominence cannot be confirmed.
- Product preview: **PRODUCT_PREVIEW_PARTIAL**. The page communicates initiatives, evidence/gaps, attention and decisions through the four-step model, static illustrative cue cards, and value-support sections. It does not show a tangible workspace with operational progress/status or blocked initiative state; a product/workspace preview remains a later slice.

**Closeout classification:** `VALIDATION_BLOCKED` pending browser installation and browser-based desktop/mobile plus `/` and `/public/start` E2E validation. No implementation defect was found and no product code or test expectation was changed in this validation run.

## Browser validation follow-up

**Date:** 2026-09-30  
**Product changes:** none.

- The standard E2E runner was retried with Docker access. PostgreSQL provisioning, migration and seed completed. The two tests in `front/e2e/public-start-access.spec.ts` did not reach their assertions because Playwright 1.63 requested `chromium_headless_shell-1243`, which is absent. The runner also logged ports 4100/5176 in use. Standard E2E suite status remains **BLOCKED**, not failed on product assertions.
- A frontend-only Vite preview was started on `127.0.0.1:5173`. A temporary Playwright browser smoke used the already cached Chromium 1223 executable (no install or repository config change) to inspect `/` at 1440×1000 and 390×844, and direct `/public/start` at desktop width. The temporary script was removed after the run.
- **Desktop QA: PASS.** The approved headline and supporting copy are visible before the four ordered model steps. The optional-orientation heading follows the model, and the textarea follows its framing. All four steps are visible; no Early Access/Demo controls appear; document width is 1440px with no horizontal overflow. Measured element geometry remained unchanged across a one-second settling interval.
- **Mobile QA: PASS.** At 390px, headline precedes the model and optional-orientation/input; all four steps remain visible in a two-column layout; document width equals viewport width (390px); Portfolio Entry remains present and reachable. No Early Access/Demo controls appear. Measured geometry remained unchanged across a one-second settling interval.
- **Mental model: PASS.** Visible evidence is the headline that names strategy, initiatives and supported decisions, supporting copy describing the work, and the four-step model before the Portfolio Entry input.
- **Product preview: PRODUCT_PREVIEW_PARTIAL.** The page communicates initiatives, evidence gaps, blocking signals and decisions through its text and illustrative cards, but does not present a workspace view with initiative-by-initiative operational progress/status.
- **Direct route smoke: PASS for basic `/public/start` availability.** Browser URL stayed at `/public/start` and one textarea rendered. This is a browser smoke, not a passing run of the repository's official `public-start-access.spec.ts`; the latter remains blocked before assertions.
- The frontend-only preview logged a 500 for `/api/v1/auth/refresh` because no backend was started. The public Landing and initial `/public/start` content rendered; no authenticated or submission journey was exercised.

**Updated closeout classification:** `VALIDATION_BLOCKED` for the standard E2E suite; desktop/mobile visual QA and direct route smoke completed. No product regression was found. The official E2E assertions remain outstanding until the expected Playwright browser is available.
