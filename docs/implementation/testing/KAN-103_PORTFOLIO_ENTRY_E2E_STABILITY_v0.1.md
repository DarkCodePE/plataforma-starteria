# KAN-103 — Portfolio Entry E2E response-body stability v0.1

## Resultado

`E2E_STABILIZED`

La captura del cuerpo D1 deja de depender del recurso CDP efímero de Chromium. Se conserva la respuesta HTTP original que consume la aplicación y se mantiene intacta la validación funcional de KAN-96 y KAN-100.

## A. PRECONDITION

| Comprobación | Resultado |
|---|---|
| Jira KAN-103 | `En curso` |
| `HEAD == origin/main` | Sí, `a8b3bc60495256e1e3ab1cf4a1514ff55aab7e7d` |
| Working tree inicial | Limpio |
| Evidencia KAN-96 | Leída: `KAN-96_STRATEGIC_INTENT_HYDRATION_D2_v0.2.md` |
| Evidencia KAN-100 | Leída: `KAN-100_CONTINUATION_TO_FIRST_VALUE_v0.1.md` |
| Cierre KAN-99 | Leído: `KAN-99_KAN74_FINAL_ALIGNMENT_REGRESSION_CLOSURE_v0.1.md` |
| Informe KAN-102 | Leído: `KAN-102_LANDING_ENTRY_CONVERGENCE_v0.1.md` |
| Spec y wrapper E2E | Leídos: `front/e2e/portfolio-entry-conversion.spec.ts`, `front/scripts/run-e2e.ts` |

### V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-103, harness E2E de Portfolio Entry
Authority: Jira KAN-103 y límites explícitos del pedido; autoridad Portfolio Entry y Manifest vigentes
Manifest status: Portfolio Entry ACTIVE_V2_BASELINE; First Value usa /portfolio/setup
Current route: continuación real hasta /portfolio/setup
Legacy dependencies: Playwright Response/CDP y wrapper con Postgres E2E aislado
Semantic owner: V2 para el comportamiento probado; este cambio solo altera observación del test
V1 assumptions detected: none
Adapter required: no
Tests protecting current behavior: KAN-96, KAN-100 y asserts existentes de D1, hidratación, P1 y cero escrituras
Tests required for V2: KAN-96/KAN-100 repetidos, combinados, spec completo y regresión front
Authority conflict: none
Proceed: YES
```

## B. REPRODUCTION

Antes del cambio, contra el Postgres aislado del wrapper:

| Grupo | Resultado |
|---|---:|
| KAN-96 enfocado | 3/3 PASS |
| KAN-100 enfocado | 3/3 PASS |
| Spec completo | 3/3 PASS |
| KAN-96 + KAN-100 combinados | No ejecutados en esa línea base: el wrapper de Windows interpretó `|` como tubería antes de lanzar Playwright. |

Después de probar la captura inmediata con `waitForResponse(...).then(async response => response.json())`, las tres repeticiones completas fallaron por `Network.getResponseBody: No resource with given identifier found`: dos en KAN-100 y una en KAN-96. Las respuestas tenían status 200 y el tuple de identidad estaba presente. No hubo evidencia de respuesta funcional incorrecta. Este fue el repro que confirmó el fallo del harness; no se clasificó como defecto runtime.

## C. ROOT_CAUSE

La lectura tardía mediante `Response.json()` depende de que Chromium aún conserve el recurso asociado al identificador CDP de esa respuesta. En ejecuciones completas, ese recurso desapareció incluso cuando el parseo empezó en la continuación inmediata de `waitForResponse`. El cuerpo HTTP seguía siendo válido y el navegador ya lo había consumido para hidratar First Value.

Por tanto, la causa observada es la vida útil del cuerpo expuesto por Playwright/CDP durante el journey, no D1, D2, autorización o persistencia.

## D. RESPONSE_LIFETIME

Antes, KAN-96 y KAN-100 conservaban un `Response` y llamaban a `json()` después de navegar/renderizar; el refresh KAN-96 también esperaba navegación antes de leer metadatos. La captura `.then(response => response.json())` redujo la ventana, pero el fallo se reprodujo en el spec completo.

El spec ahora observa la XHR GET de `confirmed-brief` en `loadend` y copia sincrónicamente status, URL y JSON del `responseText` disponible en el navegador. Esa copia ocurre cuando el cuerpo está disponible al consumidor HTTP de la app; las aserciones posteriores usan la copia, no `Network.getResponseBody`. Para refresh se capturan URL/status con `waitForResponse` sin pedir el cuerpo.

La instrumentación se limita a GET cuyo path termina en `/confirmed-brief`. No registra headers, cookies, tokens ni otros cuerpos y no altera el request ni la respuesta.

## E. CHANGE

- Añadido un capturador de prueba para la respuesta XHR confirmada, con captura de status, URL y JSON en `loadend`.
- Añadidos mensajes de diagnóstico con URL, status, URL actual de la página e identity tuple (source, session/revision, handoff/version y confirmation/version); sin credenciales.
- KAN-96 ahora comprueba también los campos de identidad del body: sessionId, revision, handoffId/version y confirmationId/version.
- KAN-100 conserva las aserciones del tuple y añade pathname exacto y las versiones de handoff/confirmation del body.
- El selector de runs combinados usa `-g KAN- --grep-invert KAN-10[12]`; evita el pipe que PowerShell/CMD interpretaba como operador y selecciona KAN-96 y KAN-100 solamente.

## F. ASSERTIONS_PRESERVED

Siguen verificándose status 200; query D1 exacta; sessionId, revision, handoffId, confirmationId y sus versiones; identidad persistida común; respuesta CONFIRMED y approach aceptado; hidratación desde Brief confirmado; refresh con el mismo tuple; edición local; acción P1 explícita; ausencia de P3, `rawEntry` como fallback y escrituras canónicas prematuras. No se relajó ningún assert.

## G–J. REPEATED E2E RUNS

Con la implementación final:

| Grupo | Resultado |
|---|---:|
| KAN-96 enfocado | 3/3 PASS |
| KAN-100 enfocado | 3/3 PASS |
| KAN-96 + KAN-100 combinados | 3/3 PASS |
| `npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts` | 3/3 PASS |

Cada ejecución usó Chromium y el PostgreSQL aislado administrado por `front/scripts/run-e2e.ts`. El wrapper terminó con exit 0 y retiró el contenedor y la red.

## K. FRONT_REGRESSION

| Comando | Resultado |
|---|---|
| `npm run test:front` | PASS |
| `npm run typecheck:front` | PASS |
| Typecheck directo del spec E2E con `tsc --noEmit` | PASS |
| `npm run lint` | PASS (`Baseline lint passed`) |
| `npm run build` | PASS; permanecen avisos existentes de import mixto y tamaño del chunk |
| Backend tests | No ejecutados; no hubo cambios backend |

## L. POSTGRES_CLEANUP_CLASSIFICATION

No se observó PostgreSQL `57P01` en las ejecuciones finales. Si aparece durante Docker teardown después de un fallo Playwright, se clasifica como **cleanup fallout** y no como root cause; solo evidencia de base anterior al fallo Playwright podría cambiar esa clasificación.

## M. FILES_CHANGED

- `front/e2e/portfolio-entry-conversion.spec.ts`
- `docs/implementation/testing/KAN-103_PORTFOLIO_ENTRY_E2E_STABILITY_v0.1.md`

## N. FINDINGS_REMAINING

No apareció flake en la matriz final de doce ejecuciones. El fallo CDP quedó reproducido durante la etapa de validación y la captura final lo evita en las tres repeticiones del spec completo. No se encontró defecto runtime ni cambio de producto.

## V2_CHANGE_CLOSURE_CHECK

```text
V2 contract satisfied: YES — behavior unchanged; test capture only
V2 route active: /portfolio/setup, unchanged
V1 consumer remaining: none introduced
Legacy compatibility documented: not applicable to this harness-only change
E2E passed: YES — focused, combined and full repetition matrix
Manifest updated: NO — product/slice implementation state did not change
Retirement action: KEEP_COMPAT
Migration status: PARTIAL — not a product migration
```

```text
STATUS = E2E_STABILIZED
SAFE_TO_COMMIT = YES
COMMIT_CREATED = NO
```
