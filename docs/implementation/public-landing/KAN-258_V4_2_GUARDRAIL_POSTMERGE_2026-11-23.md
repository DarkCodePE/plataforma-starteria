# KAN-258 — Guardrail V2 post-merge para iniciar Landing V4.2 React

- **Fecha:** 2026-11-23
- **Checkout/base de autoridad verificado:** `main@b39edf41862b87bc026a878e0da2dec3728b3493` (PR #361 fusionado).
- **Rama de implementación preparada:** `feat/KAN-258-landing-v42-react`, creada desde ese commit.
- **Resultado:** `Proceed: YES` **únicamente para comenzar la implementación frontend acotada descrita en KAN-258**. No autoriza revisión final, merge, CD o claims adicionales.
- **Informe histórico anterior:** `KAN-258_V4_2_PREIMPLEMENTATION_GUARDRAIL_2026-11-23.md`, `Proceed:NO` previo a merge. Se conserva como registro cronológico, no como estado actual.

## Autoridad y verdad comprobadas

1. **Humanidad y producto:** KAN-257#10870 (dirección visual), KAN-259#10873 (ocho condiciones, hashes de referencia) y **KAN-259#10874 (ratificación expresa)**. Product ADR-012 en `doc/product-adr/ADR-012-public-landing-v4-ecosystem-narrative.md` está **ACCEPTED** en `main`; Product ADR Index lo reconoce.
2. **Manifest:** slice `KAN-257_PUBLIC_LANDING_V4_INTEGRATED_NARRATIVE` con `APPROVED_V2_TARGET_NOT_YET_RUNTIME`, `NOT_IMPLEMENTED`, alcance de `/` explícito. La autoridad de target no implica estado de runtime.
3. **Authority Map y Current State:** reconciliados en `main`; ADR-011/KAN-255 describe la **UI actual** de cuatro etapas; ADR-012 gobierna la **nueva narrativa aprobada** de tres perspectivas.
4. **Baseline visual:** PR #352 fusionado en `main`; el blob de `docs/design-references/landing-v4-2/Starteria_Landing_V4_2_Secciones.html` coincide **exactamente** en Git con PR #352 @ `74d6982503bfa2021db38b31e0e81993fe6899f7` (blob `122ee58415bd87490b06575f3563dfd2796f4938`). Hash SHA-256 declarado en KAN-259#10873: `A6450B24EB078AD3A6AA14FDA207AB64A3C7A90CC473EE74ECF16CBAFCEF7ADB`. QA, evidencia y capturas publicados, separados del código.
5. **Reglas V2:** `docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md` §20–21 y `docs/governance/STARTERIA_V2_IMPLEMENTATION_PLAYBOOK.md`; Core v0.2 continúa como fundamento no modificado. Design System y Page Anatomy v0.1 conservan su estado declarado de draft; se usan como dirección de diseño subordinada, no como nueva autoridad lógica.

## V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-257_PUBLIC_LANDING_V4_INTEGRATED_NARRATIVE / technical HU KAN-258
Authority: ACCEPTED Product ADR-012 (KAN-259#10874), with retained ADR-011 safety/conversion boundaries and Core v0.2
Manifest status: APPROVED_V2_TARGET_NOT_YET_RUNTIME; implementation_status NOT_IMPLEMENTED
Current route: / → RootLayout public index → LandingPage.tsx; /public/start remains a separate PublicLayout route
Legacy dependencies: KAN-255 four-stage StarteriaInteractiveStory.tsx; TransformationFlow.tsx; landing.css; configuration publicLanding.ts; original CTA/navigation tests
Semantic owner: Public Landing V2 for / exclusively
V1 assumptions detected: historical ADR-019/entry comments in routes.ts (do not touch); KAN-255 four-stage narrative tests require intentional rewrite under ADR-012; no implicit permissions/Portfolio Entry funnel accepted
Adapter required: frontend-only presentation migration; no adapter at domain/API/data level
Tests protecting current behavior: front/src/app/pages/__tests__/LandingPage.test.tsx; front/src/app/routes.public-entry.test.tsx; front/e2e/public-landing-l1.spec.ts; front/e2e/portfolio-entry-conversion.spec.ts
Tests required for V2: fresh 3-perspective semantics and keyboard; FAQ/mobile; CTA destination; no /public/start links; Fab external; KPI fiction+non-attribution; four-viewpoint visual parity; typecheck, lint, build, Vitest, Playwright and other CI gates
Authority conflict: NONE material on verified main@b39edf4 for the bounded frontend implementation; historical guardrail NO records pre-merge circumstances
Proceed: YES — START KAN-258 FRONTEND-ONLY WORK; NOT A MERGE OR DEPLOY APPROVAL
```

## Four-gate review

- **Contract Gate:** PASS — ADR-012 ratified and visible in main. Three perspectives are explanatory; the original Steps 0–4 contract is untouched.
- **Dependency Gate:** PASS for scope to begin — existing route/CTA, no API or schema change, old four-stage tests identified and their semantics explicitly retired only for `/`.
- **E2E Gate:** **PENDING IMPLEMENTATION** — reference QA applies only to static prototype. Before PR review and closure, run React E2E including negative path to `/public/start`.
- **Retirement Gate:** **KEEP_COMPAT** for routing and domain; replace only KAN-255 marketing composition and document any retired UI components and test changes.

## Bounded execution and acceptance

Permitted app paths: `front/src/app/pages/LandingPage.tsx`, `front/src/app/components/landing/StarteriaInteractiveStory.tsx`, `front/src/app/components/landing/TransformationFlow.tsx`, `front/src/app/components/landing/landing.css`, and **their direct frontend test surfaces**. Existing `PUBLIC_LANDING_CONFIG.demoBookingUrl` is reused and MUST NOT be modified without separate authority. Existing `/public/start`, `/auth`, and other app routes remain untouched.

Implementation goal: faithful editorial hero V4.1, single interactive demonstration Estrategia → Ejecución → Resultados, distinct business KPI versus initiative metric, 48 h → 24 h → 30 h visibly fictitious, human confirmation, Steps/Fab bounded statements, asymmetric audience cards, FAQ, purpose manifesto and inclusive CTA. No claims of verified connections, ROI, autonomous learning or certified Platform–Fab E2E.

**Tests-first:** update KAN-255 four-stage expectations to approved three perspectives; verify tests fail as intended, then implement. Preserve zero `/public/start` links and route regression. QA images to be generated in 1440/1024/768/390 and compared against exact baseline reference, plus tabs/keyboards/focus/touch/reduced motion, contrast. Record `VISUAL_DELTA.md` and unresolved deviations.

**Stop conditions:** if implementing reveals a change to routes, authenticated product UX, Core, Steps, backend, IA, new services, DB, claims beyond ADR-012, or a new unknown semantic owner, STOP and return to KAN-259 for scope/authority instead of adapting it silently.

**Handoff:** no merges or CD automatically. This guardrail authorizes code development **only**; a separate PR and independent review are required.
