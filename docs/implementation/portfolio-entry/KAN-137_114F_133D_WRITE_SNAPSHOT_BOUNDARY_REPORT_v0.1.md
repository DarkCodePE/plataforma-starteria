# KAN-137 — 114F / 133D Write/Snapshot Boundary v0.1

**Estado:** implementación local verificada; sin commit, push ni PR.
**Base:** `origin/main` `1316b67609a7e906e31df604dd1f9d5cc538c72d`.
**Rama:** `feat/KAN-137-114f-write-snapshot-boundary`.

## Autoridad y precondición

Rige `docs/STARTERIA_AUTHORITY.md`: Core factual v0.2, ADR de producto 003/004/005 aceptados, Portfolio Entry Logic Contract v0.1 aprobado y Portfolio Setup Continuity Experience Contract v0.1 aceptado sólo para 114F. KAN-133 define la arquitectura. KAN-134/133A está desplegado; KAN-135/133B está mergeado; KAN-136/133C está mergeado en PR #200. Jira KAN-137 autoriza expresamente esta primera escritura durable 114F y prohíbe UI, Home, grants, Project/Steps, Core y Prisma. El HEAD de `origin/main` se verificó antes de crear la rama. `CURRENT_STATE.md` y `STARTERIA_V2_MANIFEST.md` aún describen el 114F completo como no implementado; se reconcilian al cierre post-merge, no como permiso de ampliar este slice.

## Auditoría de escritura actual

| Mecanismo | Clasificación | Tratamiento |
|---|---|---|
| POST `/sessions/:id/continue-portfolio`, `PortfolioEntryContinuationService` y su `sourceSnapshot` desde handoff/confirmación legacy | ISOLATE / LEGACY_COMPAT | Ruta y lectores intactos; no se llaman desde 114F. |
| `PortfolioEntryPortfolioContinuation` legacy, una fila por sesión con `snapshotFormat=null` | KEEP / LEGACY_COMPAT | Coexiste; el índice parcial legacy y sus JSON no participan en 114F. |
| Lectores legacy `/continuations/:id`, `/home-context`, `scoped-first-value-access` | KEEP / LEGACY_COMPAT | Ya filtran formato nulo; integración verifica que rechazan ID 114F. |
| `PortfolioEntryApiIdempotency`, replay de DTO por 24 h del servicio legacy | ADAPT | Se usa sólo la tabla como ledger por key hash, fingerprint y snapshot ID, con operación 114F distinta; no se reutiliza el replay de DTO ni su TTL. |
| `PortfolioEntrySession.revision`, CAS y lock `FOR UPDATE` de 114D/114E | REUSE | La sesión es el punto de serialización; nueva generación incrementa revision por CAS. |
| 114D `PortfolioEntryCriticalHandoff`, confirmación y parsers versionados | REUSE | Último artefacto, revisión, confirmación, actor, lifecycle y payload se comprueban en la transacción. |
| 114E Path derivado y constantes de versión | REUSE | Si el binding incluye Path, se exigen su referencia pública al 114D y versiones soportadas, y se reproyecta desde la fuente actual; no se persiste Path completo. |
| Resolver 133C y `revalidateReadableScope` | REUSE | Resolución 0/1/N y comprobación exacta de candidato dentro de la transacción; membresía y grant se bloquean hasta commit. |
| Adapter/parser 133A, fingerprint, índices únicos y check de formato | REUSE | Parser previo al insert, índice parcial de un `CURRENT`, unicidad generación y operación/key como última defensa. |
| `portfolio-scope.ts`, permiso global, `User.organizationId`, Home/Bootstrap, `/portfolio/setup`, conversión Project | DO_NOT_USE | Ninguno concede autoridad o destino 114F. |

## Ruta y contrato HTTP

`POST /api/v1/public/portfolio-entry/sessions/:sessionId/portfolio-setup-continuity/continue`, bajo `authenticate`. El controller exige `Idempotency-Key` de 8 a 256 caracteres y un body zod estricto: `expectedSessionRevision`, `sourceBinding` 114D (ID de sesión, context revision, artefacto ID/versión/schema y tiempo de confirmación), `organizationId?`. Si incluye `starteriaPath`, exige `projectionVersion`, `schemaVersion`, `boundaryVersion`, `criticalHandoffId`, `criticalHandoffVersion` y `sourceContextRevision`, tal como aparecen en el DTO público 114E. Rechaza propiedades adicionales, incluso usuario, perfil, grants, contexto bruto, generación, destino y Path completo. El ID de usuario se toma sólo del principal. Sesión inexistente, no claimed o de otro owner comparte 404 sin datos tenant.

## Gate transaccional, fuente y perfil

La operación usa Prisma `Serializable` y `FOR UPDATE` en `PortfolioEntrySession`. Dentro de la misma transacción comprueba owner/CLAIMED/vigencia/lifecycle; compara el binding solicitado con `contextRevision` y el último 114D por versión, identidad, schema, confirmación y actor; aplica los parsers 114D; exige perfil server-owned `PORTFOLIO_LEAD_ENTRY`, versión 1 y evidencia no vacía; y rechaza una conversión Project incompatible. Si se representa 114E, acepta su schema público `starteria-path-dto-v0.2` o la versión semántica canónica `starteria-path-v0.1`, verifica las otras dos versiones y compara los tres campos de referencia 114D presentados con la fuente actual. Después reproyecta Path desde el 114D actual dentro de la transacción y coteja `artifactId`, versión y revisión de contexto. Persiste y devuelve la versión semántica canónica. Un enum `INITIATIVE_ENTRY` no entra en esta ruta. No se infiere perfil de rol, Path, CTA, membresía ni snapshot.

La fuente material se reconstruye en servidor con `sessionId`, owner, revisión de contexto, identidad/versión/schema/tiempo de confirmación 114D, versiones 114E opcionales, perfil/versión/evidencia, organización validada y `PORTFOLIO_SETUP_CONTINUE_V1`. `sourceBindingFingerprint` de 133A produce `sourceBindingHash`. El cliente sólo presenta expectativa; no entrega verdad persistible.

## Scope y autorización

El resolver 133C se ejecuta de nuevo **dentro** de la transacción. Cero scopes devuelve `NO_AUTHORIZED_SCOPE` sin fila; error técnico devuelve `SCOPE_VALIDATION_FAILED`. Con un scope se puede omitir `organizationId`; con varios es obligatorio elegir uno actualmente listado. Todo candidato pasa además por `revalidateReadableScope` para usuario, organización existente, `OrganizationMember` y grant exacto `portfolio:read`. Un `SELECT ... FOR SHARE` retiene las filas de membresía y grant durante el commit; una revocación concurrente anterior obliga a reintentar y rechazar. `portfolio:write`, rol global y `User.organizationId` no sustituyen `read`.

## Persistencia, generación y supersesión

Se crea únicamente `PORTFOLIO_SETUP_114F_V1`. `handoffId`, `confirmationId`, `portfolioScope`, `sourceSnapshot`, `pendingItems`, `mappingVersion` y `destinationRoute` quedan nulos por omisión y por el check SQL 133A. `carriedProjection` y `openItems` se derivan de 114D, se acotan y se validan con los parsers estrictos 133A antes del insert. La proyección guarda lectura crítica, marco de decisión y sugerencia de primer movimiento con referencia/procedencia/clase; los unknowns se trasladan como `DOWNSTREAM_NON_BLOCKING`, no como verdad organizacional. No se persisten `rawEntry`, `semanticState`, transcripción, prompt, razonamiento oculto, metadata de proveedor, 114D interno íntegro ni 114E íntegro.

Las generaciones crecen por sesión desde el máximo histórico. Un `CURRENT` con el mismo binding material se reutiliza tras el gate. Un binding material nuevo requiere la revisión de sesión esperada; el CAS incrementa la revisión, marca el `CURRENT` anterior `SUPERSEDED` con `supersededAt`, crea la nueva generación `CURRENT` y completa `supersededById`, todo en la misma transacción. Un fallo de insert revierte también CAS y supersesión. El índice parcial 133A es la defensa final contra dos `CURRENT`. Una fila legacy sigue independiente. El estado físico `CURRENT` nunca se interpreta como permiso ni currentness por sí mismo.

## Idempotencia, fingerprint y concurrencia

La clave HTTP cruda se convierte a SHA-256 en servidor. La tabla de idempotencia existente se usa con operación separada `PORTFOLIO_SETUP_CONTINUE_V1`, scope=sessionId, key hash, request hash y sólo `{snapshotId}` como puntero. El campo obligatorio `expiresAt` usa el sentinela `9999-12-31`; no hay replay de DTO ni expiración de 24 h. La fila snapshot también guarda operación, key hash y fingerprint de la primera creación. La unicidad SQL de 133A permanece como última defensa. Una segunda key sobre el mismo binding puede apuntar al mismo ID mediante el ledger sin crear generación.

**Material exacto del fingerprint:** la serialización canónica ordenada de `SnapshotMaterialBinding` 133A: `sessionId`, `ownerUserId`, `sourceContextRevision`, `criticalHandoffId`, `criticalHandoffVersion`, `criticalHandoffSchemaVersion`, `criticalHandoffConfirmedAt`, las tres versiones 114E o `null`, `continuationProfile`, `continuationProfileVersion`, `profileEvidenceRef`, `organizationScopeId` resuelto y `operation=PORTFOLIO_SETUP_CONTINUE_V1`; SHA-256. No incluye headers, key, `expectedSessionRevision` ni otros datos de transporte. Así, omitir `organizationId` cuando hay uno y explicitar el mismo ID tienen el mismo fingerprint.

El gate de fuente, perfil y scope corre antes de buscar o devolver una key repetida. Misma key y fingerprint sólo retorna la fila si aún es el `CURRENT` con ese binding; key y material distinto devuelve `IDEMPOTENCY_CONFLICT`; key vieja con fuente/scope inválidos no reproduce. Una nueva generación requiere CAS de `revision`. El replay válido de **la misma key** puede reutilizar el snapshot tras revalidación aunque porte la revisión previa; una **key nueva** debe llevar la revisión vigente incluso cuando reutiliza el mismo material. Así, dos keys nuevas contra el mismo material pueden apuntar al mismo ID sin incrementar revisión después de refrescarla. Dos elecciones distintas con la misma revisión tienen un ganador y un `STALE_SESSION_REVISION`; después de refrescar revisión, una nueva elección puede crear generación. PostgreSQL `40001` entregado por Prisma como `P2010`, `P2034` y colisión única se reintentan hasta tres veces; agotamiento da `CONCURRENCY_CONFLICT`.

## DTO y errores

La respuesta zod estricta `portfolio-setup-continuity-write-v0.1` contiene ID/generación/estado `CURRENT`, `sessionRevision` actualizado, binding público, perfil Portfolio/version 1, scope ID, `currentness=REVALIDATED_AT_WRITE`, `createdAt` y `nextAuthorizedSurface=PORTFOLIO_HOME_BOOTSTRAP`. No retorna Prisma ni ruta libre. La superficie siguiente es información de handoff; 133F debe revalidar antes de Home/Bootstrap.

Errores tipados: `AUTH_REQUIRED`, `SESSION_NOT_AVAILABLE` (404 enmascarado), `STALE_SESSION_REVISION`, `STALE_SOURCE`, `UNSUPPORTED_SOURCE_VERSION`, `PROFILE_CONFLICT`, `NO_AUTHORIZED_SCOPE`, `SCOPE_SELECTION_REQUIRED`, `SCOPE_NOT_AUTHORIZED`, `SCOPE_VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `CONCURRENCY_CONFLICT`, `INVALID_114F_SNAPSHOT`, `UNEXPECTED_ERROR`; el borde añade `IDEMPOTENCY_KEY_REQUIRED` y zod valida payload. Ningún error cae a una ruta legacy.

## Aislamiento legacy y efectos laterales

El POST nuevo no lee/escribe vía `continue-portfolio`, ni `/portfolio/setup`, ni conversión Project, ni ruta piloto. 114D es fuente; handoff/confirmación legacy no lo son. La integración conserva la fila legacy y comprueba que un lector legacy rechaza el ID 114F. El único agregado durable autorizado es el lifecycle de snapshot y su ledger de idempotencia más el CAS de revisión de sesión. Pruebas verifican cero Project, Step, grants, OrganizationMember, Assignment, Invitation y Bootstrap nuevos.

## Tests y validación

El test HTTP/DTO se escribió antes del servicio y falló por módulo inexistente. Después pasaron el test de ruta (auth, key, DTO estricto) y el test de esquema. Se aplicaron las 53 migraciones **existentes** a una base PostgreSQL desechable `starteria_kan137_133d`; no se creó migración.

| Verificación | Resultado |
|---|---|
| Integración PostgreSQL 133D | PASS: 9 pruebas; 0/1/N scopes, tenant, revocación, fuente/perfil/Path 114E anterior frente a 114D actual, key nueva con revisión obsoleta y replay original, fingerprint, generaciones, legacy, carreras y rollback. |
| PostgreSQL 133A/133B/133C + 114E + legacy focal | PASS: 27 pruebas en 7 archivos tras las correcciones finales. Antes, 36 pruebas focales en 7 archivos también habían pasado. |
| Backend completo sin flag DB | PASS (exit 0) tras las correcciones finales; los tests marcados DB se ejecutaron aparte. |
| `npm run typecheck:backend` | PASS tras las correcciones finales. |
| `npm run lint` | PASS tras las correcciones finales. |
| `npm run build:backend` | PASS tras las correcciones finales. |
| `git diff --check` | PASS al cierre. |

La integración Prisma de sesión 114D con guarda de nombre de base exige `starteria_e2e` y no corrió en la base desechable `starteria_kan137_133d`; un intento del grupo focal falló sólo por esa guarda antes de ejecutar casos. La suite backend sin flag DB sí ejecutó las regresiones unitarias de currentness 114D. No hay UI 114F autorizada para validación en navegador. No se llamó a un LLM real. Revisión de sólo lectura `revisor-starteria`, ronda 3: `approved`.

## Gaps y preparación 133E

La creación productiva de sesión fija el enum `PORTFOLIO_LEAD_ENTRY`, pero todavía **no** escribe `continuationProfileVersion` ni `continuationProfileEvidenceRef`; la búsqueda de usos backend muestra sólo lectores 133B/133D y fixtures de test. Por eso, sesiones productivas actuales quedan en `PROFILE_CONFLICT` y el POST falla cerrado. KAN-137 no autorizó inicialización/transición de perfil en creación de sesión; no se hizo backfill ni cambio Prisma. 133E UI no debe prometer avance hasta que una subtarea con autoridad explícita establezca esa evidencia server-owned para sesiones nuevas y defina recuperación de las anteriores. Para obtener `expectedSessionRevision`, 133E puede leer `GET /sessions/:sessionId`, cuyo DTO existente expone `revision`, y usar `sessionRevision` devuelto por este POST tras una generación nueva; GET 133B no expone esa revisión. Home/Bootstrap sigue sin handoff 133F y no debe consumir el snapshot sin su revalidación. Tampoco se cambió `CURRENT_STATE.md` ni Manifest antes de merge.

```text
WRITE_BOUNDARY_READY: YES
TRANSACTIONAL_SOURCE_GUARD: YES
SCOPE_REVALIDATED_IN_TRANSACTION: YES
CAS_CONCURRENCY_GUARD: YES
IDEMPOTENCY_REVALIDATION_READY: YES
SNAPSHOT_GENERATIONS_READY: YES
SUPERSESSION_ATOMIC: YES
PRIVACY_ALLOWLIST_PRESERVED: YES
LEGACY_COMPAT_PRESERVED: YES
NO_PROJECT_STEPS_SIDE_EFFECTS: YES
NEXT_SLICE_READY: NO — falta evidencia de perfil productiva server-owned
114F_UI_AUTHORIZED: NO
HOME_HANDOFF_AUTHORIZED: NO
```

## V2_CHANGE_CLOSURE_CHECK

```text
V2 contract satisfied: YES para el límite POST 133D, con gap de perfil productivo documentado
V2 route active: YES, POST 114F backend; sin UI ni navegación
V1 consumer remaining: YES, continue-portfolio y lectores/Home legacy
Legacy compatibility documented: YES, KEEP_COMPAT y aislamiento por snapshotFormat
E2E passed: NO APLICA a UI; PostgreSQL, concurrencia y router backend verificados
Manifest updated: NO, cierre post-merge pendiente
Retirement action: KEEP_COMPAT
Migration status: PARTIAL, 114F completo requiere perfil productivo, 133E y 133F
```
