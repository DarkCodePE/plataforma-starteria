# KAN-107 — Portfolio Entry transitioning timeout classification v0.3

## Resultado

`HARNESS_CONTAMINATION_RESOLVED` para los timeouts `transitioning`: el runner anterior compartía el proyecto Docker y puertos fijos entre invocaciones. Con corridas aisladas, el timeout no reapareció en main ni en KAN-106 (0/10 full specs), ni en las cuatro corridas finales aisladas. No se encontró evidencia de defecto runtime para este patrón.

El spec completo conserva fallas visuales ajenas a `transitioning`, presentes en ambas variantes; KAN-106 no se considera desbloqueado para cierre integral. No se modificó producto ni se hizo commit.

## A. PRECONDITION

| Comprobación | Resultado |
|---|---|
| Jira KAN-107 | En curso |
| `HEAD == origin/main` | Sí: `b5966abb82919b71ed33e2309f5f223c41bdc3d2` |
| Árbol al reanudar | No limpio: contenía el reporte KAN-107 propio de la sesión anterior. No había cambios de terceros. |
| Reporte KAN-103 | Leído: `KAN-103_PORTFOLIO_ENTRY_E2E_STABILITY_v0.1.md` |
| Reporte KAN-106 | Leído desde su worktree: `KAN-106_CONFIRMED_BRIEF_CAPTURE_NAVIGATION_RACE_v0.1.md` |
| Reporte KAN-107 anterior | Leído y actualizado en este mismo archivo |
| Wrapper y Compose | Leídos: `front/scripts/run-e2e.ts`, `docker-compose.e2e.yml` |

### V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: KAN-107, aislamiento del harness E2E Portfolio Entry
Authority: Jira KAN-107, límites explícitos del pedido, docs/STARTERIA_AUTHORITY.md y Manifest vigente
Manifest status: Portfolio Entry ACTIVE_V2_BASELINE
Current route: unchanged; E2E wrapper only
Legacy dependencies: Playwright/Chromium, Docker Compose y PostgreSQL aislado
Semantic owner: V2 para lo observado; cambios sólo de harness
V1 assumptions detected: none
Adapter required: no
Tests protecting current behavior: full spec, KAN-96/KAN-100 asserts y persistencia existente
Tests required for V2: main x5, KAN-106 x5, aislamiento secuencial/paralelo y regresión front
Authority conflict: none
Proceed: YES — sólo wrapper de pruebas; no runtime/producto
```

## B. ISOLATION_ROOT_CAUSE

El wrapper fijaba el proyecto `starteria-e2e`, backend `4100`, frontend `5176`, PostgreSQL `55433` y storage `storage/e2e`. No comprobaba ownership ni ocupación antes de conectarse a esos recursos. El cleanup sólo conocía procesos hijos de su invocación; con `shell:true` en Windows podía terminar el shim `cmd.exe` sin terminar el proceso Node que escuchaba en el puerto.

Así, una siguiente invocación podía chocar con servicios anteriores o probar contra ellos. En la primera reproducción de KAN-107 aparecieron seis `transitioning` en esa situación contaminada.

## C. HARNESS_CHANGE

Sólo se modificó `front/scripts/run-e2e.ts`:

- `E2E_RUN_ID` identifica cada invocación; si falta, el wrapper genera uno aleatorio.
- El proyecto Compose predeterminado es `starteria-e2e-${runId}`; se puede fijar con `E2E_DOCKER_PROJECT_NAME`.
- Los puertos backend/frontend/Postgres siguen configurables con `E2E_BACKEND_PORT`, `E2E_FRONTEND_PORT` y `E2E_POSTGRES_PORT`.
- Antes de iniciar, valida que los puertos elegidos sean distintos y estén libres. Rechaza proyectos Compose que ya tengan contenedores.
- El storage queda bajo `<LOCAL_STORAGE_DIR o storage/e2e>/<runId>`.
- El cleanup sólo baja un proyecto que esta invocación reclamó tras pasar el preflight.
- Backend, Vite y Playwright se lanzan directamente por Node, sin shell; el cierre espera a los procesos hijos y usa `taskkill /T` como último recurso en Windows.
- El log inicial imprime ID, proyecto, puertos y storage de la corrida.

No cambiaron Docker Compose, semántica de negocio, D1/D2, razón de pregunta, Core, Steps ni asserts.

## D. ISOLATION_PROOF

| Ejecución | ID / Proyecto | Backend / Front / PG | Storage | DB / resultado |
|---|---|---|---|---|
| Secuencial A | `kan107-proof-b` / `starteria-e2e-kan107-proof-b` | 4202 / 5278 / 56435 | `storage/e2e/kan107-proof-b` | DB nueva aplicó migraciones; 13/13 PASS |
| Secuencial B | `kan107-main-2` / `starteria-e2e-kan107-main-2` | 4203 / 5279 / 56436 | `storage/e2e/kan107-main-2` | DB nueva aplicó migraciones; 13/13 PASS |
| Paralelo A | `kan107-parallel-a` / `starteria-e2e-kan107-parallel-a` | 4221 / 5301 / 56451 | `storage/e2e/kan107-parallel-a` | DB nueva, output dir propio; 13/13 PASS |
| Paralelo B | `kan107-parallel-b` / `starteria-e2e-kan107-parallel-b` | 4222 / 5302 / 56452 | `storage/e2e/kan107-parallel-b` | DB nueva, output dir propio; 13/13 PASS |

Cada log mostró `Applying migrations` en PostgreSQL del puerto asignado. Los proyectos eran distintos y Compose retiró los proyectos creados al terminar. Las dos ejecuciones paralelas acabaron sin colisiones.

Una prueba preliminar `kan107-proof-a` encontró un proyecto viejo y abortó. Esto confirmó el preflight; también detectó que el cleanup inicial podía bajar un proyecto que no debía reclamar. Se añadió el guard de ownership, y las cuatro pruebas válidas de la tabla se hicieron después de esa corrección.

## E. MAIN_X5

Resultado: **2/5 full spec PASS**, y **0/5** reprodujo el timeout `transitioning`.

| Run | Resultado | Fallo, si hubo |
|---|---|---|
| `kan107-proof-b` | 13/13 PASS | — |
| `kan107-main-2` | 13/13 PASS | — |
| `kan107-main-3` | 12 PASS / 1 FAIL | KAN-101 DELETE: `getByTestId('portfolio-entry-confirmed-brief-actions')` no encontrado; espera de visibilidad 15 s |
| `kan107-main-4` | 11 PASS / 2 FAIL | Portfolio-first handoff: `toHaveURL(/\/portfolio\/inicio\?portfolioEntryContinuationId=/)` agotó 15 s, URL final `/auth`. KAN-101 DELETE: panel de acciones no encontrado en 15 s. |
| `kan107-main-5` | 12 PASS / 1 FAIL | Portfolio-first handoff: mismo `toHaveURL` agotó 15 s, URL final `/auth` |

Esos fallos no llegaron al poll `transitioning`. No se atribuyen a la clasificación objetivo.

## F. KAN106_X5

Se aplicó temporalmente sólo el diff no comprometido de KAN-106 en `front/e2e/portfolio-entry-conversion.spec.ts`; el blob base fue restaurado después.

Resultado: **4/5 full spec PASS**, y **0/5** reprodujo el timeout `transitioning`.

| Run | Resultado | Fallo, si hubo |
|---|---|---|
| 1–4 | 13/13 PASS cada uno | — |
| 5 | 11 PASS / 2 FAIL | KAN-101 DOWNLOAD y DELETE: `getByTestId('portfolio-entry-confirmed-brief-actions')` no encontrado; timeout de visibilidad 15 s |

## G. TRANSITIONING_TRACE

No reapareció `transitioning` en las diez ejecuciones aisladas main/KAN-106. Por ello no hubo test fallido al que correlacionar `POST /messages`, estado persistido, último turn, respuesta HTTP o estado UI. Las fallas restantes terminaron en UI `/auth` o en ausencia del panel de acciones confirmadas; no son evidencia de sesión persistida en `transitioning`.

El helper observado permanece sin cambios: `reachHandoff` espera la respuesta de `POST /api/v1/public/portfolio-entry/sessions/:sessionId/messages`; su `expect.poll` devuelve `transitioning` cuando no reconoce handoff, oferta guiada ni pregunta activa. No se aumentó su timeout.

## H. ROOT_CAUSE_CLASSIFICATION

`HARNESS_CONTAMINATION` para el patrón original. Los timeouts descritos cuando se compartían proyecto y puertos desaparecieron con recursos aislados, tanto en main como con KAN-106 aplicado. No hubo evidencia de estado persistido defectuoso ni de regresión introducida por el cambio de captura.

Las fallas de UI citadas en E/F son independientes y quedan sin clasificar dentro de KAN-107.

## I. KAN106_UNBLOCKED

**No para cierre integral:** su full spec aislado fue 4/5, con dos tests KAN-101 fallidos en un run. Sí queda resuelto el bloqueo específico de los timeouts `transitioning`; no hay base para atribuirlo a la captura Node-side de KAN-106.

## J. FILES_CHANGED

- `front/scripts/run-e2e.ts`
- `docs/implementation/testing/KAN-107_TRANSITIONING_TIMEOUT_CLASSIFICATION_v0.1.md`

El diff KAN-106 de `front/e2e/portfolio-entry-conversion.spec.ts` se retiró tras la comparación.

## K. REPORT_PATH

`docs/implementation/testing/KAN-107_TRANSITIONING_TIMEOUT_CLASSIFICATION_v0.1.md`

## Regresión del harness

| Comando | Resultado |
|---|---|
| `npm run test:front` | PASS |
| `npm run typecheck:front` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Backend tests | No ejecutados; no hubo cambios backend |

## L. FINDINGS_REMAINING

- Resolver las fallas intermitentes de KAN-101 DOWNLOAD/DELETE y Portfolio-first que terminan en `/auth`, en su propio alcance.
- KAN-106 requiere decidir cómo cerrar con su full spec aislado 4/5, aunque el bloqueo `transitioning` ya no se reproduce.
- No se ejecutaron focused KAN-96/KAN-100/combined x5 durante esta reanudación.

```text
STATUS = HARNESS_CONTAMINATION_RESOLVED
SAFE_TO_COMMIT = NO
COMMIT_CREATED = NO
```

## Cierre KAN-107 — evidencia final

### Alcance resuelto

- **RESOLVED:** contaminación entre invocaciones E2E por proyecto Docker/puertos compartidos.
- **RESOLVED:** evidencia inválida de timeouts `transitioning` causada por esa contaminación.
- No se declara estable globalmente el full spec. Los fallos visuales residuales se mantienen separados.

### OUT OF SCOPE / MOVED TO KAN-108

- Flake del panel `confirmed-brief-actions` en los recorridos KAN-101/KAN-102.
- Flake del redirect de Portfolio-first hacia `/portfolio/inicio` que termina en `/auth`.
- No se tocaron esos recorridos ni su lógica de producto en KAN-107.

### Prueba de aislamiento repetida

| Corrida | ID / proyecto Compose | Backend / frontend / PG | Storage | Resultado | Limpieza observada en log |
|---|---|---|---|---|---|
| Secuencial A | `kan107-final-seq-a` / `starteria-e2e-kan107-final-seq-a` | 4231 / 5311 / 56461 | `storage/e2e/kan107-final-seq-a` | 13/13 PASS | Compose retiró contenedor y proyecto |
| Secuencial B | `kan107-final-seq-b` / `starteria-e2e-kan107-final-seq-b` | 4232 / 5312 / 56462 | `storage/e2e/kan107-final-seq-b` | 13/13 PASS | Compose retiró contenedor y proyecto |
| Paralelo A | `kan107-final-par-a` / `starteria-e2e-kan107-final-par-a` | 4241 / 5321 / 56471 | `storage/e2e/kan107-final-par-a` | 13/13 PASS | Compose retiró contenedor y proyecto |
| Paralelo B | `kan107-final-par-b` / `starteria-e2e-kan107-final-par-b` | 4242 / 5322 / 56472 | `storage/e2e/kan107-final-par-b` | 11 PASS / 2 FAIL ajenos al target | Compose retiró contenedor y proyecto |

En las cuatro corridas el log confirmó proyecto/puertos/storage propios, `Applying migrations` con 45 migraciones y seed E2E nuevo. Las corridas en paralelo compartieron el intervalo de ejecución sin colisión de recursos. La consulta local de listeners no encontró los puertos asignados aún abiertos después de terminar. La inspección directa posterior de Docker Compose no estuvo disponible por `Access is denied` al daemon; la evidencia de limpieza es el `down` de cada wrapper/log, no una inspección del daemon.

Fallos del paralelo B, firmas observadas:

1. KAN-102 `Landing → optional Entry → clarification → confirmed Strategic Intent → final actions`: `expect(locator).toBeVisible()` agotó 15 s porque no encontró el panel de acciones confirmadas.
2. KAN-101 DELETE: el mismo helper falló al no encontrar el panel de acciones confirmadas dentro de 15 s.

En ese log apareció además `POST /api/v1/portfolio-bootstrap/sessions/:sessionId/anchor/confirm` con HTTP 500 por Prisma `P2002` (`PortfolioAnchorHistory`, clave `(anchorId, version)`). Se registra como hallazgo de la corrida y queda fuera de la remediación KAN-107; no se modificó backend. Este error no produjo el patrón `transitioning` objetivo.

### Clasificación final y regresión

- El patrón `transitioning` asociado al KAN-106 no reapareció después del aislamiento: 10 full-spec runs aislados comparativos (main/KAN-106) sin ese patrón, más estas cuatro corridas main; no se observó estado persistido incorrecto `transitioning`.
- Clasificación: `HARNESS_CONTAMINATION`; no `KAN106_REGRESSION` ni evidencia de `RUNTIME_DEFECT` para la transición investigada.
- Regresión ejecutada en esta sesión: `npm run test:front` PASS (87 archivos, 623 tests); `npm run typecheck:front` PASS; `npm run lint` PASS; `npm run build` PASS (avisos preexistentes de chunks/import dinámico, build completado).
- Backend tests no ejecutados; no hubo cambio backend.
- KAN-106 queda desbloqueado respecto del bloqueo específico `transitioning`; los fallos residuales de acciones/auth pertenecen al alcance separado KAN-108. Esto no afirma estabilidad integral del full spec.
- Archivos del alcance: `front/scripts/run-e2e.ts` y este reporte. Sin cambios de producto y sin commit.

```text
KAN-107 STATUS = HARNESS_CONTAMINATION_RESOLVED
SAFE_TO_COMMIT = YES (alcance KAN-107; commits siguen prohibidos en esta tarea)
COMMIT_CREATED = NO
```
