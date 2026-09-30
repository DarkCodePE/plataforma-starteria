# Portfolio Monitoring — Slice A.2 Runtime Entry Alignment

**Estado:** IMPLEMENTED LOCALLY / PENDING REVIEW  
**Branch:** `feat/portfolio-monitoring-product-definition`  
**Base SHA:** `e73dc69a4cad1058ee3cfdf133e0fde3c58990bd`

## Resultado

Se conserva la implementación A.2 existente y se completa el alineamiento del runtime:

- Portfolio Lead vacío redirige de `/portfolio/inicio` a `/portfolio/setup`.
- Portfolio Lead activo permanece en `/portfolio/inicio`.
- Admin y otros roles con `portfolio:read` no reciben el redirect de setup.
- Una continuación de Portfolio Entry converge a setup y conserva
  `portfolioEntryContinuationId`.
- Setup mantiene shell focused y no expone navegación ontology-first.

## Criterio EMPTY / ACTIVE

La condición final de `EMPTY` es:

```text
role === portfolio_lead
AND portfolioDataStatus === ready
AND no Strategic Front has a meaningful active/tracking status
```

`ACTIVE` es la existencia de un Strategic Front con estado `active`, `tracking`,
`with_active_challenges` o `in_tracking`.

## Fuente de verdad y limitación

Se utiliza el read path existente de `PortfolioLeadContext`, que hidrata Strategic Fronts desde
`portfolioService.listStrategicFronts()`. Portfolio Bootstrap/read model no expone todavía una
señal global suficiente para decidir la entrada directa sin una continuation de Entry; por eso no
se crea una nueva señal ni schema. Esta deuda queda documentada para una futura reconciliación del
read model.

## Loading / error

- `idle` y `loading`: no redirect.
- `ready` sin front significativo: redirect a setup.
- `error`: no redirect automático; se conserva el comportamiento seguro existente.

## Role gating

El redirect de EMPTY/Entry continuation a setup requiere exactamente `user.role ===
'portfolio_lead'`. El permiso `portfolio:read` sigue siendo el guard de acceso al workspace, pero
no altera el entry de admin u otros roles.

## Portfolio Entry continuation

`AuthenticatedProvisionalContinuationPage` normaliza `/portfolio/inicio` recibido del servicio a
`/portfolio/setup`, manteniendo la query. Setup recupera el contexto mediante
`usePortfolioHomeEntryContext` y muestra:

> Trajimos el contexto que compartiste al entrar.

La información se presenta con procedencia y no se rellenan datos ausentes.

## Welcome y Copilot

El route wrapper usa el `user.name` autenticado y saluda con el primer nombre; si no existe,
renderiza `Hola.` sin mostrar email. El Drawer existente recibe `setupMode` y muestra orientación
intent-first, sin selector inicial de Frentes/Retos/Iniciativas.

## Tests

Ejecutados:

- `PortfolioLeadLayout.access.test.tsx`: 17 tests passed.
- `PortfolioLeadFirstValuePage.test.tsx`: 5 tests passed.
- `AuthenticatedProvisionalContinuationPage.test.tsx`: 5 tests passed.
- Front typecheck: passed.
- `npx playwright test e2e/portfolio-lead-first-value.spec.ts --project=chromium`: 2 passed.

También se conserva la cobertura previa de Slice A/A.1 en los archivos no modificados.

## Deviations / known gaps

- El nombre visible usa el primer token de `user.name`; no se añadió un perfil nuevo.
- El criterio ACTIVE sigue dependiendo del read path de Strategic Fronts hasta que Bootstrap
  exponga una señal global equivalente.
- El test del Drawer emite un warning existente de Radix sobre refs en `SheetOverlay`; no falla.
- El E2E se ejecutó con Vite en `localhost:80`; el spec mockea autenticación y APIs. No se acredita
  un entorno productivo externo.

## Scope confirmation

```text
P4 implemented: NO
Backend changed: NO
Core changed: NO
Steps changed: NO
Portfolio Handoff changed: NO
```
