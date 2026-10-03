# KAN-98 — Portfolio Continuation Lifecycle v0.1

## Resultado

`PORTFOLIO_CONTINUATION_LIFECYCLE_READY`

La continuación hacia Portfolio Lead conserva la identidad del Brief confirmado. La conversión separada hacia Initiative/Project mantiene su comportamiento actual.

## Autoridad y alcance

- Jira KAN-98 autoriza preservar el lifecycle `CONFIRMED`, la revisión y la identidad exacta para `PORTFOLIO_LEAD_ENTRY`.
- Jira KAN-74 define “Trabajarlo con Starteria” como handoff a Portfolio Lead sin incorporación automática al portfolio.
- KAN-89/D1 conserva ownership, lifecycle confirmado y equality exacta de revisión/handoff/confirmación.
- KAN-97 transporta la identidad completa exacta; KAN-90 define cobertura de confirmación.
- Core v0.2 sigue declarado `Base fundacional revisada / Por validar`. No se modificó Core ni Steps 0–4.
- ADR-001 de Portfolio Entry continuation sigue `PROPOSED`; se trató como evidencia contextual, no como autoridad aprobada.
- No se encontraron reportes KAN-96 v0.1/v0.2 en el checkout ni en el historial Git disponible. No se reconstruyeron.

## CONTINUATION_VS_CONVERSION_MATRIX

| Propiedad | PATH A — `PORTFOLIO_LEAD_ENTRY` | PATH B — `INITIATIVE_ENTRY` |
|---|---|---|
| `continuationProfile` | `PORTFOLIO_LEAD_ENTRY` | `INITIATIVE_ENTRY` |
| Endpoint | `POST /api/v1/public/portfolio-entry/sessions/:sessionId/continue-portfolio` | `POST /api/v1/public/portfolio-entry/sessions/:sessionId/convert` |
| Crea fila de continuación | Sí; reutiliza la fila por `sessionId` cuando existe | No; escribe la fila de conversión por `sessionId` |
| Crea Project | No | Sí; Project es el registro canónico usado para la Initiative |
| Crea Initiative separada | No | No existe una escritura de entidad `Initiative` independiente en este servicio; la conversión persiste Project y el registro de conversión |
| Crea Steps | No | Sí; crea Steps 1–4 bloqueados y datos de Step 0 según el flujo actual |
| Cambia lifecycle | No; queda `CONFIRMED` | Sí; con origen `CONFIRMED`, pasa por `CONVERSION_ELIGIBLE` y llega a `CONVERTED` |
| Revisión | Sin cambio | Semántica existente: incrementa en cada actualización de lifecycle (dos incrementos cuando parte de `CONFIRMED`) |
| Destino | `/portfolio/inicio?portfolioEntryContinuationId=<id>` | `/initiatives/<projectId>/overview` |
| Escritura canónica | Ninguna | Project e infraestructura de Initiative/Steps por conversión explícita |
| Brief fuente reutilizable | Sí; mismo Brief confirmado y misma identidad D1 | No como sesión activa confirmada tras conversión; lifecycle `CONVERTED` |

## Causa raíz

Antes del cambio, `PortfolioEntryContinuationService.createContinuation()` hacía lo siguiente dentro de la transacción:

1. Creaba `PortfolioEntryPortfolioContinuation` con el source snapshot, referencias de handoff/confirmation, scope y ruta destino.
2. Ejecutaba `portfolioEntrySession.updateMany()` sobre la sesión Portfolio Lead.
3. Cambiaba `lifecycleStatus` a `CONVERTED` e incrementaba `revision` en uno.

El flujo observado era:

```text
KAN-97 identity: revision N / CONFIRMED / handoff H-v / confirmation C-v
    ↓ continue-portfolio
runtime:         revision N+1 / CONVERTED / handoff H-v / confirmation C-v
    ↓ D1 con el tuple exacto N, H-v, C-v
409
```

D1 no estaba defectuoso: su comparación exacta rechazaba correctamente una sesión que ya no estaba confirmada y cuya revisión ya no coincidía. KAN-98 corrige la mutación indebida en el límite de continuación; no altera D1.

## Regla aplicada y delta

`Portfolio continuation != Portfolio Entry conversion`.

En `PortfolioEntryContinuationService.createContinuation()` se eliminó únicamente el `updateMany()` que marcaba la sesión `CONVERTED`, incrementaba revisión y actualizaba timestamps. Se mantuvieron la transacción, la lectura y validación del perfil/lifecycle/revisión/owner, la comprobación de que no exista conversión incompatible, la comprobación scoped de `portfolio:read`, la creación durable del snapshot y la construcción de la ruta destino.

No se modificaron `PortfolioEntryConversionService`, schemas, persistencia, frontend runtime, D1 ni identidad KAN-97. La sesión fuente y el snapshot de continuación siguen siendo hechos separados: el primero prueba que el Brief está confirmado; la fila durable prueba que el usuario eligió continuar en Portfolio.

## Lifecycle, revisión e identidad

```text
Antes:   revision N / CONFIRMED / handoff H-v / confirmation C-v
Después: revision N / CONFIRMED / handoff H-v / confirmation C-v
```

La continuación no crea un estado nuevo, no consume el Brief y no reescribe la identidad. El source snapshot mantiene `session.id/revision`, `handoffRef.id/version` y `confirmation.id/version/status`, junto con payload, provenance y campos confirmados/corregidos/rechazados.

## Idempotencia y snapshot

- La repetición con la misma clave reproduce el mismo resultado idempotente.
- Un retry de la misma sesión con otra clave obtiene el mismo `continuationId` mediante el lookup por `sessionId`; la cuenta continúa siendo uno.
- La revisión de la sesión permanece idéntica antes y después de ambas llamadas.
- El snapshot durable contiene el tuple de origen, el payload de handoff y la confirmation final. No se reemplaza con datos reconstruidos.

## Acceso scoped y destino

Las verificaciones conservaron el comportamiento existente:

- Contextos se resuelven para la identidad autenticada con capacidad `portfolio:read`.
- Sin contexto autorizado, el endpoint falla con `PORTFOLIO_ENTRY_CONTINUATION_NO_AUTHORIZED_CONTEXT`.
- Con varios contextos, exige selección explícita (`PORTFOLIO_ENTRY_CONTINUATION_CONTEXT_SELECTION_REQUIRED`).
- La organización elegida se valida contra grants preexistentes; no hay escalamiento de rol ni grants nuevos.
- Owner extranjero devuelve 403; revisión esperada obsoleta devuelve 409; sesión vencida devuelve 410.
- `readContinuation` y `readPortfolioHomeEntryContext` validan fila, usuario dueño/claim y scoped Portfolio access; ninguno exige lifecycle `CONVERTED`.
- La ruta de destino `/portfolio/inicio?portfolioEntryContinuationId=...` no cambia.

## Compatibilidad histórica

No se necesita migración ni corrección retroactiva. Las filas históricas con continuación durable y sesión en `CONVERTED` siguen siendo legibles: ambos métodos de lectura comprueban la fila, el owner/claim y el scope, sin una condición sobre lifecycle. Las referencias y el snapshot de esas filas permanecen como evidencia válida de continuación. La nueva implementación sólo cambia sesiones creadas hacia adelante.

## Conversión Initiative/Project

`POST .../convert` y `PortfolioEntryConversionService` no cambiaron. El test de integración confirma que `INITIATIVE_ENTRY` todavía llega a `CONVERTED`, crea un Project canónico con Steps y mantiene su idempotencia y trazabilidad. La conversión de un perfil Portfolio hacia Project continúa rechazada.

## Cero escrituras canónicas de continuación

La prueba de continuación compara los conteos canónicos antes/después y confirma que no hay cambios en Projects, Steps, Adaptive Core, asignación de Initiative Owner, Challenge, StrategicFront ni metadatos canónicos. Tampoco existe una fila `PortfolioEntryConversion` para esa sesión. La metadata de continuación y el scope de lectura preexistentes son los únicos artefactos permitidos.

## Verificación

- **Test-first, reproducción del fallo anterior:** con la mutación restaurada temporalmente, el test integrado de continuación recibió `409` al resolver D1 con el tuple exacto; esperado `200`. Se quitó de nuevo la mutación y se restauró la regresión completa.
- **Integración backend aislada:** `portfolio-entry-conversion.integration.test.ts` — 10/10 PASS en PostgreSQL E2E desechable. Incluye continuación, retry, snapshot, D1, scope, selección de contexto, expiración, owner/revisión y conversión Initiative.
- **D1 enfocado:** `portfolio-entry.router.test.ts -t D1` — 5 PASS.
- **Backend completo:** `npm run test:backend` — PASS con integraciones DB no activadas; éstas se ejecutaron en separado sobre base aislada.
- **Frontend completo:** `npm run test:front` — PASS.
- **Typecheck backend/frontend:** ambos PASS.
- **Lint:** PASS.
- **Build frontend/backend:** ambos PASS. Vite conserva warnings preexistentes de chunk grande/import dinámico.
- **E2E dirigido:** `npm run test:e2e -- e2e/portfolio-entry-conversion.spec.ts` — PASS (exit code 0) con Postgres aislado. Demuestra confirmación explícita → continuación autenticada → destino → identidad persistida/refrescada → D1 exacto 200 y ausencia de conversión.
- **Diff whitespace:** `git diff --check` PASS.
- Un intento inicial sobre la base compartida falló durante cleanup por `Project_ownerId_fkey` sobre fixtures/Projects preexistentes; no se borraron ni modificaron esos datos. La integración se repitió y pasó en la base desechable.

## Limitaciones restantes

- Los informes referenciados como KAN-96 v0.1/v0.2 no están disponibles en este checkout/historial; la validación se apoyó en Jira KAN-96/KAN-98 y evidencia gobernada disponible.
- No se implementó ni validó la hidratación D2 de KAN-96.
- La suite E2E recorre el runtime ya existente de Portfolio; este slice sólo añade la assertion D1 exacta, sin assertions de hidratación.
- No se creó PR ni commit. KAN-96 queda desbloqueable después del merge de KAN-98.
