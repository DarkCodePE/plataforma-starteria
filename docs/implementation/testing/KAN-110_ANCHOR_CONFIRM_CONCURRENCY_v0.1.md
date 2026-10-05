# KAN-110 — Portfolio Anchor confirmation concurrency

Fecha de ejecución: 2026-10-05  
Resultado: `ANCHOR_CONFIRM_CONCURRENCY_SAFE`; `SAFE_TO_COMMIT = YES` tras clasificar la única falla residual como ajena a KAN-110. No se hizo commit.

## Alcance y precondition

- KAN-110 estaba `En curso` en Jira.
- `HEAD` y `origin/main` eran `00ba001b4766537932f1fa1efad786f531c184c8` al iniciar; el working tree estaba limpio.
- El cambio implementa únicamente idempotencia concurrente de `POST /api/v1/portfolio-bootstrap/sessions/:sessionId/anchor/confirm` y su evidencia. No cambia Core, Steps, la confirmación humana explícita ni el índice único de history.
- Se ejecutó `V2_CHANGE_GUARDRAIL_CHECK`: Proceed YES para el comportamiento de concurrencia pedido por KAN-110. Se preserva la autoridad de la confirmación humana y `portfolio:write`.

## Fixture de integración

El fixture de integración creaba la continuación con `portfolioScope.organizationId = null` y el kind `platform_portfolio_permission`. El servicio rechaza una continuación sin organización al ejecutar `createOrReuseFromContinuation`; por eso el flujo válido recibía 403 antes de ejercitar confirmación. No era un permiso de runtime que debiera relajarse.

El fixture ahora prepara una organización real descartable y usa su ID con `scoped_portfolio_grant`. El usuario titular conserva el rol existente `portfolio_lead`; no se agregaron permisos ni se debilitó autorización. La confirmación secuencial autorizada pasó después de corregirlo.

## Reproducción anterior al fix

En `starteria_e2e`, una barrera de test hizo que ambos POST leyeran `anchor_sufficient`, version 1 antes de continuar. Antes del fix se observó:

- Respuestas: una `200` y una `500` (el orden varió entre ejecuciones).
- Anchor: version 1 antes; `anchor_confirmed`, version 2 después.
- History: una sola fila, versiones `[1]`.
- Confirmaciones semánticas/auditoría: 1.
- Error del request perdedor: `PrismaClientKnownRequestError`, `P2002`, `meta.modelName = PortfolioAnchorHistory`, `meta.target = ["anchorId", "version"]`; `Unique constraint failed on the fields: (anchorId,version)`.

## Causa y alternativas

Ambas transacciones leen la misma versión confirmable. Cada una intentaba crear `PortfolioAnchorHistory(anchorId, version=1)`; la primera confirmaba y avanzaba el anchor, mientras la segunda chocaba contra `@@unique([anchorId, version])` y filtraba P2002 como HTTP 500.

Evaluación:

- **Conditional update / optimistic concurrency:** elegida. El update compara ID, estado confirmable y versión leída. PostgreSQL serializa la escritura de la fila y vuelve a evaluar el predicado; solo un request puede reclamar esa versión.
- **Row lock / serializable:** daría serialización, pero agrega una estrategia de locking o reintentos y no es necesaria para esta transición puntual.
- **Retry de transacción:** puede repetir trabajo que depende del estado ya cambiado y necesita política adicional; no aporta frente al compare-and-set.
- **Capturar P2002 y releer:** posible si se acota estrictamente al índice esperado y se vuelve a autorizar, pero deja la colisión como mecanismo normal de control. El compare-and-set evita intentar insertar la history duplicada.

## Fix y límite de autorización

Dentro de la transacción, el servicio hace `updateMany` condicionado a `{ id, version: versionLeida, status: 'anchor_sufficient' }`, y avanza a `anchor_confirmed`, `user_confirmed` y version +1. Solo si `count === 1` crea history, mueve la fase de sesión y escribe la auditoría de confirmación.

Si `count === 0`, relee la sesión en la transacción, vuelve a ejecutar `authorizeSessionCapability` con `portfolio:write` y devuelve el anchor solo si ya está `anchor_confirmed`. Si el estado no es confirmado, conserva el conflicto. No hay captura global de P2002 ni éxito sin ownership/scoped authorization. El índice único permanece intacto.

## Evidencia de integración

Base: Postgres descartable `starteria_e2e`; se ejecutó la suite de integración explícitamente con `PORTFOLIO_BOOTSTRAP_DB_INTEGRATION=1` y `DATABASE_URL` apuntando a esa base.

- Confirmación única: PASS.
- Doble confirmación secuencial: ambas HTTP 200; ambas devuelven `anchor_confirmed`, version 2; history `[1]`; una auditoría semántica.
- Doble confirmación concurrente: barrera determinística después de ambas lecturas; respuestas `[200, 200]`; ambos resultados `anchor_confirmed`, version 2; estado final version 2; history `[1]`; una auditoría; ningún error Prisma capturado.
- Caller concurrente de otro usuario: titular 200, usuario ajeno 403 `PORTFOLIO_BOOTSTRAP_FORBIDDEN`; una sola transición, history y auditoría.
- Flujo existente `updateAnchor`: incluido en la suite.
- Archivo de integración completo: 23/23 tests PASS.

## Evidencia E2E y regresión

- Caso enfocado de anchor confirm ejecutado en 10 invocaciones separadas del wrapper; 10/10 PASS. La aserción E2E verifica dos POST, ambos 200, versión final 2 e history `[1]`.
- `portfolio-entry-conversion.spec.ts` completo ejecutado en cinco wrappers aislados con logs y artifacts conservados: cuatro PASS (13/13 cada uno); uno terminó exit 1 (12 PASS, 1 FAIL). La falla se clasificó como ajena a KAN-110; detalles y evidencia abajo. La corrida diagnóstica anterior también pasó 13/13.
- Backend: `npm run typecheck:backend` PASS; `npm run test:backend` PASS; `npm run build:backend` PASS. La integración Postgres anterior se corrió aparte porque el comando backend normal no habilita esas suites.
- Front: `npm run test:front -- --reporter=dot` PASS; `npm run typecheck:front` PASS; `npm run lint` PASS; `npm run build` PASS. El build mostró warnings existentes de división de chunks y tamaño de chunk >500 kB.
- Prisma: `npx prisma validate` PASS.
- `git diff --check` PASS.

## Archivos y findings

Archivos cambiados:

- `backend/modules/portfolio-bootstrap/portfolio-bootstrap.service.ts`
- `backend/modules/portfolio-bootstrap/__tests__/portfolio-bootstrap.integration.test.ts`
- `front/e2e/portfolio-entry-conversion.spec.ts`

Finding restante: una ejecución de la spec completa falló en la expectativa de disponibilidad de las acciones del Brief confirmado de KAN-101. Se clasifica como `UNRELATED_EXISTING_FLAKE` (timing/recuperación de la vista de acciones confirmadas): el timeout ocurrió en `getByTestId('portfolio-entry-confirmed-brief-actions')` tras volver a `/public/start`; el intervalo fallido no hizo POST a `anchor/confirm`. Las cuatro llamadas `anchor/confirm` observadas en ese run respondieron 200; stdout/stderr no muestran P2002 ni HTTP 500. La prueba enfocada de concurrencia pasó 10/10 y la integración Postgres 23/23. No se hizo commit.

## V2_CHANGE_CLOSURE_CHECK

- V2 contract satisfied: sí, dentro del comportamiento autorizado por KAN-110.
- V2 route active: sí; permanece el endpoint y su autorización actuales.
- V1 consumer remaining: sin cambio de consumidores en esta tarea.
- Legacy compatibility documented: no hubo cambios de compatibilidad legacy.
- E2E passed: caso enfocado 10/10; en la matriz final completa, cuatro wrappers 13/13 PASS y un fallo KAN-101 clasificado ajeno a KAN-110.
- Manifest updated: no; el estado del slice no cambió.
- Retirement action: KEEP_COMPAT.
- Migration status: PARTIAL (sin cambio en el estado general del slice); KAN-110 validado y el fallo de KAN-101 queda clasificado fuera del slice.

## FINAL FULL-SPEC CLASSIFICATION

Los cinco comandos fueron invocaciones independientes de `npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts`, cada una mediante `run-e2e.ts`, con `E2E_RUN_ID` y proyecto Docker propios, base Postgres y backend nuevos. Se usaron directorios Playwright distintos con `--output`; stdout, stderr, exit code, resumen y artifacts se retuvieron bajo `docs/implementation/testing/KAN-110-full-spec-reruns/run-N/`.

| Run | Result | Failed test | Classification | KAN-110 impact |
|---|---|---|---|---|
| 1 | exit 0; 13 passed, 0 failed | — | PASS | Ninguno |
| 2 | exit 0; 13 passed, 0 failed | — | PASS | Ninguno |
| 3 | exit 0; 13 passed, 0 failed | — | PASS | Ninguno |
| 4 | exit 0; 13 passed, 0 failed | — | PASS | Ninguno |
| 5 | exit 1; 12 passed, 1 failed | `KAN-101 DOWNLOAD exports the confirmed Brief without lifecycle or Portfolio writes` (`front/e2e/portfolio-entry-conversion.spec.ts:1007:3`) | `UNRELATED_EXISTING_FLAKE` — la vista `portfolio-entry-confirmed-brief-actions` no apareció dentro del timeout de 15 s tras navegar a `/public/start` | Ninguno: el fallo sucede en la recuperación/visibilidad de acciones del Brief; no hay llamada `anchor/confirm` durante ese intervalo. Las cuatro llamadas del endpoint registradas en Run 5 devolvieron 200; no hay P2002 ni respuesta HTTP 500 en sus logs. |

La evidencia exacta de Run 5 está en `run-5/stdout.log`, `run-5/stderr.log` y `run-5/artifacts/portfolio-entry-conversion-28d3d-fecycle-or-Portfolio-writes-chromium/error-context.md` (expectativa fallida y locator). Todos los runs tienen `invocation.json`, `summary.json`, `exit-code.txt`, los dos logs y su propio directorio `artifacts/`.

Decision: `ANCHOR_CONFIRM_CONCURRENCY_SAFE`; `KAN110_REGRESSION_FOUND = NO`; `SAFE_TO_COMMIT = YES`. No se cambió código adicional ni se hizo commit.
