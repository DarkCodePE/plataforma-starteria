# KAN-135 — 114F / 133B Read/status boundary v0.1

**Estado:** implementación local en `feat/KAN-135-114f-read-status-boundary`, sin commit, push ni PR.  
**Base:** `origin/main` `3d5fe68292ad99051dc14e70740ed4608d6eb60d`.  
**Alcance:** GET 114F de sólo lectura; ningún cambio Prisma, frontend, Core, Steps o Home.

## Autoridad y precondición

`docs/STARTERIA_AUTHORITY.md` mantiene Core v0.2 como base factual, los ADR de producto 003/004/005 aceptados, Portfolio Entry Logic Contract v0.1 y el Experience Contract 114F `ACCEPTED / FROZEN FOR IMPLEMENTATION PLANNING` para esta frontera. KAN-133 define la arquitectura; KAN-134 aporta el adapter y la migración 133A. Jira KAN-135 confirma 133A mergeado, aplicado en producción y autoriza expresamente backend read/status. KAN-134 registra `DATA_CONTRACT_READY: YES` y `NEXT_SLICE_READY: YES` para 133B.

`CURRENT_STATE.md` y `STARTERIA_V2_MANIFEST.md` aún muestran 114F `NOT_IMPLEMENTED` y una ficha previa a 133A. Son índices pendientes de reconciliación al cierre post-merge; no se usaron como permiso para ampliar esta subtarea. KAN-133 separaba resolución de scopes como 133C; Jira KAN-135 la incluye explícitamente en 133B. Se siguió el alcance acotado de Jira sin introducir selección persistida ni escritura.

## Ruta, autenticación y ownership

`GET /api/v1/public/portfolio-entry/sessions/:sessionId/portfolio-setup-continuity` está montado en el router Entry con `authenticate`. El controller acepta sólo `sessionId` y la identidad autenticada; query/body y un scope suministrado por cliente no participan. El servicio exige sesión `CLAIMED`, owner exacto y vigencia. Sesión ausente, no claimed o ajena comparten 404 para ocultar existencia. Lifecycle no apto/expiración se expresa como `STALE_SOURCE` sin datos tenant.

## Source gate y perfil

Cada GET toma una vista `RepeatableRead` de sólo lectura y un lock `FOR SHARE` sobre la fila de sesión, punto de serialización de las mutaciones de fuente. Dentro de esa vista lee la sesión y el último artefacto 114D por `artifactVersion`, compara `contextRevision`, verifica versión de schema soportada, confirmación explícita con actor owner y valida lifecycle/payload 114D con los parsers existentes. Una fuente ausente, obsoleta, no confirmada o de versión desconocida produce `STALE_SOURCE`. Una conclusión confirmada `insufficient_basis` queda `BLOCKED_AUTHORITY`.

El perfil se obtiene exclusivamente de la sesión. Se exige `PORTFOLIO_LEAD_ENTRY` o `INITIATIVE_ENTRY`, versión 1 y referencia no vacía de evidencia server-owned. Sesiones anteriores con sólo enum y sin evidencia resultan `PROFILE_CONFLICT`; no se hace backfill. `INITIATIVE_ENTRY` con evidencia de perfil sigue `BLOCKED_AUTHORITY`: faltan transición gobernada, target, Assignment e issuer comprobados conjuntamente. Nunca se emite `INITIATIVE_HANDOFF_AVAILABLE` por inferencia.

## Snapshot 133A

Se consultan sólo filas `CURRENT` con formato no nulo; las filas `LEGACY_UNBOUND` quedan fuera de la consulta. Cada fila se clasifica con `classifyContinuationRow` de 133A. Dos filas current, un formato o proyección inválidos, o un fingerprint material incorrecto producen `ERROR` con recuperación pública `INVALID_114F_SNAPSHOT`. La fila debe coincidir con sesión, owner, último 114D, confirmación, perfil y evidencia actuales. Si trae versiones 114E, éstas deben ser las soportadas y quedan ligadas al 114D corriente. Un mismatch de fuente devuelve `STALE_SOURCE`. El GET nunca crea ni supersede filas.

El snapshot sólo se proyecta si el scope almacenado aparece en la lista vigente de `portfolio:read`. Su ID y proyección no conceden permiso. Un scope revocado oculta inmediatamente el snapshot público. Los JSON legacy `sourceSnapshot`, `portfolioScope`, `pendingItems` y la ruta antigua ni siquiera se seleccionan desde Prisma para este GET.

## Scope y estados

Se reutiliza `ScopedPortfolioAccessService.listAccessibleOrganizations` dentro de la misma vista con capacidad exacta `portfolio:read`: user, organización, membresía y grant scoped. Los resultados se deduplican por `organizationId` porque el schema admite más de una fila `OrganizationMember` del mismo tenant. `portfolio:write`, rol global, perfil y `User.organizationId` no sustituyen el grant. Un fallo del resolver se trata como `SCOPE_VALIDATION_FAILED`, nunca como cero scopes.

| Hecho revalidado | Estado 114F | Siguiente superficie propuesta |
|---|---|---|
| 0 scopes, sin snapshot 114F | `READY_PROVISIONAL` | `PROVISIONAL_CONTEXT_ESTABLISHMENT` |
| 0 scopes, snapshot con scope revocado | `NO_AUTHORIZED_SCOPE` | `PROVISIONAL_CONTEXT_ESTABLISHMENT` |
| 1 scope válido, o scope de snapshot revalidado | `READY_AUTHORIZED_SCOPE` | `PORTFOLIO_HOME_BOOTSTRAP` candidato |
| Varios scopes, sin scope de snapshot revalidado | `SELECT_SCOPE` | `SCOPE_SELECTION_REQUIRED` |
| Fallo técnico del resolver | `SCOPE_VALIDATION_FAILED` | ninguna |
| Fuente/versión/binding viejo | `STALE_SOURCE` | ninguna |
| Perfil ausente/incompatible | `PROFILE_CONFLICT` | ninguna |
| Evidencia de continuación insuficiente o excepción Initiative incompleta | `BLOCKED_AUTHORITY` | ninguna |
| Snapshot inválido o fallo inesperado de lectura de fuente/snapshot | `ERROR` | ninguna |

`nextAuthorizedSurface` es informativo: esta slice no navega, no crea continuación y no habilita Home. La llegada 114F a Home/Bootstrap requiere los gates propios de la futura subtarea.

## DTO y privacidad

`portfolio-setup-continuity-read-v0.1` se valida mediante zod `.strict()` en la salida. Expone sólo estado, binding público de 114D y versiones 114E cuando corresponda, perfil/version con indicador de evidencia, scopes autorizados y scope actual, lectura Portfolio comprobada, resumen acotado de 114D, open items, referencia/proyección 133A validada y recuperación segura. No expone conversación cruda, `rawEntry`, `semanticState`, razonamiento oculto, metadata de modelo, provenance interno, payload legacy, grant interno ni fila Prisma.

## Seguridad, legacy y efectos

Tests cubren anónimo 401, owner ajeno/no claimed/ausente 404, fuente stale, versión no soportada, perfil sin evidencia, fallo del resolver, 0/1/N scopes, membresías duplicadas, grant revocado, aislamiento tenant, fila legacy, snapshot inválido, fingerprint, DTO allowlist y ausencia de side effects. La integración PostgreSQL intercala una actualización de `contextRevision` con la lectura: la actualización espera al lock de lectura, y el siguiente GET devuelve `STALE_SOURCE`. La ruta 114F no llama a `/handoff`, `continue-portfolio`, `/portfolio/setup`, Project ni Steps. Los consumidores legacy conservan `KEEP_COMPAT`; ningún comportamiento legacy se promueve a autoridad 114F.

## VERIFICACION

| Gate | Resultado |
|---|---|
| Test primero | Se observó fallo por módulo de servicio 114F ausente antes de implementar. |
| Focal servicio + router | PASS: 22 casos de servicio más ruta HTTP; el test inicial falló antes del módulo. |
| 114D/114E/continuación/legacy focal | PASS: 89 tests; 10 pruebas PostgreSQL omitidas en esa corrida por flag no configurado. |
| PostgreSQL aislado | `starteria_kan135_133b_20261011`, 53 migraciones aplicadas; 12/12 pruebas de adapter 114F, contrato 133A y conversión legacy pasaron. La primera ejecución del nuevo test falló por un nombre de variable del fixture; corregido y reejecutado. La base desechable se eliminó tras verificar. |
| `npm run typecheck:backend` | PASS. |
| `npm run lint` | PASS. |
| `npm run test:backend` | PASS final: 1542 tests, 101 omitidos por flags de integración. |
| `git diff --check` | PASS. |
| `revisor-starteria` | Ronda 2 `approved`, sin hallazgos pendientes; la ronda 1 detectó lectura no transaccional y membresías duplicadas, ambas corregidas y verificadas. |

No se ejecutó navegador: no hay UI 114F ni recorrido visible autorizado en esta slice. No hubo llamada LIVE LLM.

## Gaps, cierre y siguiente slice

La creación productiva de evidencia de perfil todavía no existe; sesiones históricas sin ella seguirán en `PROFILE_CONFLICT`. El GET no persiste selección, no implementa CAS/supersesión, no emite grants y no provee el gate de llegada Home. El estado read es una propuesta por solicitud: cualquier POST futuro y cada lectura Home deben revalidar fuente, perfil y grant. La excepción Initiative requiere autoridad externa. El índice Manifest/Current State se actualiza tras merge si cambia el estado global del slice.

V2_CHANGE_CLOSURE_CHECK

```text
V2 contract satisfied: YES, dentro del alcance read/status de KAN-135
V2 route active: YES, GET 114F backend; sin UI ni navegación
V1 consumer remaining: YES, rutas de continuación anteriores
Legacy compatibility documented: YES, KEEP_COMPAT y aislamiento por formato
E2E passed: NO APLICA a UI 114F; integración PostgreSQL y router backend verificadas
Manifest updated: NO, cierre post-merge pendiente
Retirement action: KEEP_COMPAT
Migration status: PARTIAL
```

```text
READ_BOUNDARY_READY: YES
SOURCE_CURRENTNESS_GUARD: YES
SCOPE_RESOLUTION_READY: YES
LEGACY_ISOLATION_PRESERVED: YES
NEXT_SLICE_READY: YES — 133C, selección de scope/preparación de escritura según arquitectura y HU futura
114F_WRITE_AUTHORIZED: NO
114F_UI_AUTHORIZED: NO
```
