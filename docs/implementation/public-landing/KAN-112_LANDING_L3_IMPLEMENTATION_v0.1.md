# KAN-112 — Landing L3 Implementation v0.1

| Campo | Valor |
|---|---|
| Fecha | 2026-10-05 |
| HU | KAN-112 — Public Landing L3 — Visual Product Preview & Conversion Polish |
| Rama | `feat/KAN-112-landing-l3-visual` |
| HEAD de partida | `90c44cf084b7035f128843f3cb56d0f141e581bd` |
| Alcance | Frontend de `/`, composición visual, preview ilustrativa, rutas actuales y QA local |

## A. Recovery audit

- **IMPLEMENTED:** copy congelado del Hero y CTA `/auth`; modelo L2 y value flow; preview estática con contenido ficticio; framing de problema y autoridad humana; Portfolio Entry separado en `/public/start`; footer con destinos existentes.
- **PARTIAL:** el WIP tenía una superficie de atención anidada, flechas ausentes al apilar el value flow y no tenía evidencia responsive. El ancla `Producto` tampoco compensaba el header sticky.
- **MISSING:** validación final a tablet y móvil, capturas revisables y reporte de implementación.
- **TESTS_ALREADY_ADAPTED:** tests de Landing, rutas públicas y E2E cubrían copy, orden, preview, rutas y optional Entry; se ampliaron con límites de composición y viewports.
- **RISKS:** sin backend local no se valida la creación de sesión ni el formulario interactivo de `/public/start`. No se añadieron claims, datos reales ni destinos comerciales.
- **FREEZE_CONFLICTS:** la caja anidada de “Atención por revisar” contradecía el shell único indicado por el freeze. Se sustituyó por una banda neutral con divisor.

## B. Precondition

Al iniciar, la rama era `feat/KAN-112-landing-l3-visual`, HEAD coincidía exactamente con el SHA esperado y el árbol contenía únicamente las seis rutas autorizadas. `git diff --check` estaba limpio. El ref `refs/recovery/KAN-112-before-codex-resume` permaneció intacto (`c9277c099e3549c3bf9d8a38e74f9c8927925cef`). No se hizo reset, stash, rebase ni commit.

## C. Guardrail

`V2_CHANGE_GUARDRAIL_CHECK`: **Proceed YES** para la adaptación visual de la Landing KAN-112. Owner semántico: Public Landing V2 para `/`; Portfolio Entry V2 para `/public/start`. Sin cambios a Core, Steps, API, persistencia, rutas ni lógica de Entry. La UX Spec consultada continúa `DOCUMENTAL ONLY`; la autoridad visual del trabajo es la HU KAN-112 y el freeze L3.

`V2_CHANGE_CLOSURE_CHECK`: copy y composición congelados preservados; rutas actuales activas; sin consumers legacy nuevos; Manifest se mantiene en `V2_PILOT`. Cierre incompleto porque el E2E oficial no pudo arrancar sin Docker.

## D. Files changed

- `front/e2e/public-landing-l1.spec.ts`
- `front/src/app/pages/LandingPage.tsx`
- `front/src/app/pages/__tests__/LandingPage.test.tsx`
- `front/src/app/routes.public-entry.test.tsx`
- `front/src/app/components/landing/StarteriaProductPreview.tsx`
- `docs/implementation/public-landing/KAN-112_LANDING_L3_VISUAL_FREEZE_v0.1.md` (freeze recuperado)
- Este reporte.

No se modificaron `STARTERIA_V2_MANIFEST.md` ni `CURRENT_STATE.md`.

## E–H. Product content and order

- **Hero:** mantiene literalmente el headline y los dos apoyos congelados; CTA existente a `/auth` claro y dominante.
- **Product Preview:** shell `Card` único con bandas divisorias: prioridad, frente/reto/iniciativas conectados, señales/evidencia, bloqueo y gap, decisión a preparar y autoridad humana. La ilustración y su procedencia permanecen visibles y asociados semánticamente.
- **Section order:** Hero → L2/value flow → Product Preview → problema/valor → confianza/autoridad humana → slot comercial omitido hasta tener destino → Portfolio Entry opcional → footer.
- **Portfolio Entry:** conserva literalmente copy/CTA y `/public/start`; está después de la explicación y la confianza, usa botón secundario y no embebe el formulario.

No hay porcentajes, métricas, Steps, kanban, chatbot ni controles en la preview. Demo/Early Access no tienen CTA ni URL inventados.

## I–K. Design system, responsive and accessibility

- Reutiliza tokens y primitives existentes (`Card`, `Button`, `Badge`, colores, bordes y radios). **NEW TOKEN REQUIRED: NO. NEW PRIMITIVE REQUIRED: NO.**
- Playwright visual revisado en 1440, 1280, tablet 1024/768 y 390 px: sin overflow horizontal; Hero y CTA se conservan; relaciones y señales apilan antes de comprimir tipografía; el flujo muestra conectores verticales en pantallas pequeñas; Entry queda al final. El ancla “Producto” coloca el heading bajo el header sticky.
- Se conservan `header`, `nav`, `main`, `footer`, heading hierarchy y skip link. El value flow tiene nombre accesible de grupo. La preview no añade elementos tabbables y su `figure` asocia disclaimer y procedencia.
- BrowserSkill: **NOT RUN**; `bsk` no está disponible en este entorno. Las capturas y recorridos Playwright son evidencia secundaria. No se ejecutó una auditoría automatizada WCAG.

## L–N. Tests, E2E and visual QA

| Verificación | Resultado |
|---|---|
| `npm run test:front` | PASS |
| `npm run typecheck:front` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; warnings de import dinámico/estático de `api.ts` y chunk principal >500 kB |
| `npm run test:e2e -- e2e/public-landing-l1.spec.ts` | BLOCKED antes de ejecutar tests: Docker no expone `dockerDesktopLinuxEngine` en este entorno |
| Playwright local: viewports + Landing → `/public/start` | PASS para jerarquía, ausencia de overflow, ancla de producto, navegación a la ruta y heading de Entry |

Las capturas se generaron en `front/test-results/kan112-visual/`: full page en 1440, 1280, 1024, 768 y 390; Hero/Preview/Entry en 1440, 1280 y 390; además, ancla de producto a 1440 y preview móvil con el disclaimer visible. El Vite aislado produjo errores de red/API 500 porque el backend no estaba levantado (`localhost:3001` no disponible); por ello no se valida la sesión ni el textbox de Entry en navegador.

## O–R. Manifest, comercial and remaining findings

- **Manifest:** Public Landing permanece en `V2_PILOT`. Una mejora visual no justifica `V2_MIGRATED` ni estado `PRODUCTIVE`; no se actualizó Manifest/CURRENT_STATE.
- **Commercial destinations:** siguen `RUNTIME_PENDING / BLOCKED_BY_DESTINATION`; no se renderizan destinos o CTAs falsos.
- **Findings remaining:** levantar Docker/backend y completar el E2E oficial, incluida la interacción disponible en `/public/start`; BrowserSkill ausente. Los warnings del build siguen pendientes de evaluación aparte de KAN-112.
- **Report path:** `docs/implementation/public-landing/KAN-112_LANDING_L3_IMPLEMENTATION_v0.1.md`.

## S–T. Status

**STATUS: BLOCKED** — la composición y la QA visual local están listas, pero el AC8 no queda completamente acreditado mientras el E2E oficial no pueda ejecutarse en un entorno con Docker/backend.

**SAFE_TO_COMMIT: NO** — completar el E2E requerido antes de declarar la subtarea lista para review. No se creó commit.
