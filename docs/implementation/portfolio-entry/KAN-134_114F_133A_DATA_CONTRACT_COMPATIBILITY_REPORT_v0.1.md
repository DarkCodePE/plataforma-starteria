# KAN-134 — 114F / 133A Data Contract + Compatibility Baseline v0.1

**Estado:** implementación local verificada; sin commit, push ni PR.  
**Base:** `origin/main` `6ef95c761ccd9a64c3c1b0489ed3363a96c6d06e`.  
**Rama:** `feat/KAN-134-114f-data-contract`.

## 1. Autoridad y precondición

La jerarquía aplicable es `docs/STARTERIA_AUTHORITY.md`: Core factual v0.2; ADR de producto 003, 004 y 005 aceptados; Portfolio Entry Logic Contract v0.1; Portfolio Setup Continuity Experience Contract v0.1 `ACCEPTED / FROZEN FOR IMPLEMENTATION PLANNING` sólo para 114F. KAN-133, integrado en el commit base, selecciona adaptar `PortfolioEntryPortfolioContinuation` y ordena 133A antes de los boundaries de lectura y escritura. Jira KAN-134 autoriza expresamente schema, migración, contrato de datos, compatibilidad y tests de esta slice. No autoriza ruta ni runtime 114F.

```text
TECHNICAL_ARCHITECTURE_READY: YES
IMPLEMENTATION_SLICE_READY: YES
PRISMA_CHANGE: REQUIRED
```

`STARTERIA_V2_MANIFEST.md` aún registra 114F `NOT_IMPLEMENTED` y una ficha anterior a la integración de KAN-133 (`technical_audit_status: NOT_YET_COMPLETED`). El dato factual de KAN-133 integrado y la autorización acotada KAN-134 gobiernan esta tarea; el estado global 114F sigue sin ruta runtime. La reconciliación de Manifest/Current State corresponde al cierre de la fase h, tras review/merge.

## 2. Modelo anterior: auditoría exacta

`PortfolioEntryPortfolioContinuation` tenía `id`, `sessionId @unique`, `handoffId`, `confirmationId`, `continuedByUserId`, `portfolioScope Json`, `sourceSnapshot Json`, `pendingItems Json`, `mappingVersion`, `status` con default `CONTINUED`, `destinationRoute`, `continuedAt`, `createdAt`, `updatedAt`. Relaciones: `session` con `PortfolioEntrySession`, `continuedByUser` con `User` y `bootstrapSessions` desde `PortfolioBootstrapSession.sourceContinuationId`. Índices adicionales: `continuedByUserId`, `continuedAt`, `status`. La sesión exponía una relación singular `portfolioContinuation`.

`handoffId` y `confirmationId` son referencias al Handoff/Confirmation **legacy**, no a Critical Handoff 114D. El JSON `sourceSnapshot` legacy contiene `rawEntry`, `semanticState`, handoff completo y confirmación. `portfolioScope` guarda la organización seleccionada, pero la autoridad de acceso reside en membresía y grant scoped. El `continuationProfile` de sesión era nullable, sin versión ni referencia de evidencia. No había source context revision, Critical Handoff versionado, Path binding, generación, supersesión, operation fingerprint ni idempotency key en esta tabla. `sessionId @unique` impedía historial de generaciones.

Consumidores constatados: servicio legacy `continue-portfolio`, lecturas `continuations/:id` y `home-context`, autorización `scoped-first-value-access`, Home arrival, `PortfolioBootstrapService`, derivación de anchor, y sus pruebas de continuación/conversión/Bootstrap. La escritura legacy busca cualquier fila por sesión y conserva su JSON; se clasifica `KEEP_COMPAT`, sin convertirla en fuente 114F.

| Tratamiento | Campos/superficie |
|---|---|
| KEEP | `id`, `sessionId`, `continuedByUserId`, `continuedAt`, timestamps, FKs a sesión/usuario y referencias Bootstrap |
| KEEP_COMPAT | `handoffId`, `confirmationId`, `portfolioScope`, `sourceSnapshot`, `pendingItems`, `mappingVersion`, `status`, `destinationRoute`; son requeridos para filas legacy y nulos en 114F |
| ADAPT | relación sesión singular a plural; `sessionId @unique` a índice parcial para legacy y generación/currentness independientes |
| ADD | formato, fuente 114D/114E, perfil y evidencia, scope de referencia, generación, operación, fingerprint, lifecycle y proyección acotada |
| DO_NOT_REINTERPRET | `handoffId` legacy como 114D; JSON legacy como verdad de negocio; `portfolioScope` como grant; enum de perfil como evidencia suficiente |

## 3. Delta de schema y migración

La migración `20261011170000_add_114f_continuation_generations` agrega columnas nullable para preservar filas anteriores. En `PortfolioEntrySession` agrega `continuationProfileVersion` y `continuationProfileEvidenceRef`; no les asigna valores inventados. En continuación agrega `snapshotFormat`, `snapshotGeneration`, `snapshotState`, `sourceContextRevision`, `criticalHandoffId`, `criticalHandoffVersion`, `criticalHandoffSchemaVersion`, `criticalHandoffConfirmedAt`; opcionalmente las tres versiones de Path 114E (`projection`, `schema`, `business capability boundary`); `continuationProfile`, `continuationProfileVersion`, `profileEvidenceRef`; `organizationScopeId`; `snapshotOperation`, `idempotencyKeyHash`, `requestFingerprint`, `sourceBindingHash`; `supersededAt`, `supersededById`; `carriedProjection` y `openItems`.

Las columnas legacy que una fila 114F no usa pasan a nullable sin borrar ni reescribir valores. El único objeto retirado es el **índice de unicidad global** de `sessionId`, necesario para generaciones. Lo reemplazan un índice único parcial por `sessionId` para filas `snapshotFormat IS NULL` y otro por sesión para formato 114F en estado `CURRENT`. Hay unicidad por `(sessionId, snapshotGeneration)` y `(sessionId, snapshotOperation, idempotencyKeyHash)`, más índice de búsqueda por sesión/formato/estado. Un `CHECK` exige la forma completa legacy o la forma 114F: versiones/evidencia presentes, tres versiones de Path juntas cuando se usa, JSON y ruta legacy nulos para 114F, y fecha para una generación superseded. No hay backfill de autoridad ni eliminación de datos.

Prisma no expresa los índices parciales ni el `CHECK`; están en `migration.sql` y su intención consta aquí. Las futuras migraciones deben conservarlos expresamente.

## 4. Generaciones, binding e idempotencia

Una sesión puede tener una fila `LEGACY_UNBOUND` y generaciones 114F `1..N`. Una sola generación 114F puede estar marcada `CURRENT`; las anteriores pueden quedar `SUPERSEDED` con `supersededAt` y `supersededById`. Estos campos describen el ciclo de vida **almacenado**: currentness efectiva sigue requiriendo comparar sesión, último Critical Handoff, confirmación, perfil y scope en el boundary futuro. El adaptador no convierte `snapshotState=CURRENT` en autorización.

El binding material tipado incluye sesión, owner, revisión de contexto, ID/versión/schema y confirmación 114D, versiones 114E cuando se usa, perfil/version/evidence, scope y operación. `sourceBindingFingerprint` serializa claves de forma estable y calcula SHA-256. `idempotencyKeyHash` identifica la operación y `requestFingerprint` permite distinguir replay de conflicto. La unicidad de DB evita duplicar la misma key por sesión/operación; la comparación del fingerprint, CAS, revalidación del grant y la transacción de supersesión pertenecen a 133D. No se implementa idempotencia HTTP aquí.

## 5. Perfil, scope y acceso

El valor de perfil está separado de su versión y referencia de evidencia, tanto en sesión como en snapshot. Una fila 114F sin versión/evidencia se rechaza por constraint y por adaptador. Las sesiones preexistentes conservan `NULL`: ningún `PORTFOLIO_LEAD_ENTRY` o `INITIATIVE_ENTRY` antiguo se promueve por su enum. La provisión de evidencia de creación para sesiones nuevas y una transición gobernada requieren autoridad/runtime posteriores.

`organizationScopeId` es una referencia nullable. La ausencia de scope admite representación provisional en el contrato de datos; según 114F §8, el boundary de escritura futuro sólo debe crear snapshot de transferencia a Home al superar B, y puede conservar provisional sin fila. No se persiste `hasAccess`, grant materializado ni capacidad durable. El adaptador declara `REVALIDATE_SCOPED_ACCESS`: un ID almacenado nunca concede lectura. La base de datos no define FK al grant; éste puede revocarse independientemente.

## 6. Compatibilidad y privacidad

`snapshotFormat=NULL` clasifica exclusivamente como `LEGACY_UNBOUND`; `PORTFOLIO_SETUP_114F_V1` exige binding completo. Formatos desconocidos o incompletos son `INVALID_114F_SNAPSHOT`. El servicio legacy busca sólo `snapshotFormat=NULL` y sus lecturas, así como el consumidor Bootstrap legacy, rechazan explícitamente IDs 114F. Se conserva el comportamiento/ruta legacy `/portfolio/setup` y la derivación anterior del anchor. Se ajustó una expectativa de test que en `origin/main` pedía `/portfolio/inicio?...` aunque el servicio ya devolvía `/portfolio/setup`; no cambió la ruta productiva.

El `CHECK` obliga a los nuevos snapshots 114F a dejar nulos `sourceSnapshot`, `portfolioScope`, `pendingItems`, `handoffId`, `confirmationId`, `mappingVersion` y `destinationRoute` legacy. La proyección 114F nueva es opcional y el adaptador valida una forma estricta: campos de lectura/decisión acotados a 500 caracteres, referencia de fuente, origen y clase de verdad; contexto conocido acotado a 10 campos; hasta 20 open items con categoría y descripción acotada. Rechaza claves adicionales incluso anidadas, incluido `rawEntry`. No necesita conversación cruda, `semanticState`, metadata del proveedor, razonamiento oculto ni Path entero. El boundary de escritura 133D deberá ejecutar estos mismos parsers antes de persistir JSON; 133A no introduce un escritor 114F.

## 7. Pruebas y validación

- Se escribió primero el test del adaptador y se observó el fallo por módulo ausente.
- Unitarias: legacy no actual, binding completo, perfil sin evidencia, Path opcional atómico, scope nullable diagnóstico, generaciones/supersesión, fingerprint estable y rechazo de raw context en campos anidados o demasiado largos.
- Integración Prisma: una fila legacy y dos generaciones de la misma sesión; unicidad de fila legacy, una sola generación `CURRENT`, supersesión, conflicto de key, rechazo de perfil sin evidencia, JSON legacy nulo en 114F, ningún grant creado.
- `npx prisma validate`: PASS. `npx prisma generate`: PASS. `prisma migrate deploy` desde cero sobre `starteria_kan134_verified`: 53 migraciones PASS. `prisma migrate status`: actualizado.
- Suite focal final sobre la base `starteria_kan134_release`: 15/15 PASS. Suite ampliada de continuación, conversión legacy y Bootstrap en base de prueba: 58/58 PASS. `npm run test:backend`: PASS; integración DB gated no incluida en ese comando, ejecutada aparte. `npm run typecheck:backend`: PASS. `npm run lint`: PASS. `git diff --check`: PASS.

Primer intento de migración en una base de prueba distinta falló porque el objeto de unicidad previo era índice, no constraint; se corrigió y se repitió la cadena completa en una base nueva. No se ejecutó una actualización sobre una base poblada **antes** de la migración; la integración confirmó convivencia y restricciones de filas legacy tras aplicar la migración. No hubo validación de navegador porque 133A no cambia UI ni ruta 114F.

## 8. Gaps y siguiente slice

133B debe implementar sólo el read/status boundary 114F: leer source/profile con evidencia, clasificar ausencia o stale, derivar un DTO allowlist y revalidar scope sin interpretar un snapshot almacenado como permiso. Las sesiones existentes sin evidencia de perfil deberán resultar `PROFILE_CONFLICT` hasta que una operación gobernada establezca esa evidencia; no se infiere ni se backfillea. 133D implementará la escritura transaccional, CAS, comparación de fingerprint, supersesión y allowlist de persistencia. Grant issuer, transición Initiative, Home/Bootstrap 114F y runtime de rutas permanecen fuera de 133A.

```text
DATA_CONTRACT_READY: YES
PRISMA_MIGRATION_READY: YES
LEGACY_COMPAT_PRESERVED: YES
NEXT_SLICE_READY: YES — 133B, read/status boundary
RUNTIME_114F_ROUTE_AUTHORIZED: NO
SAFE_TO_COMMIT: YES — revisor-starteria approved en ronda 1; esta sesión no commiteó
```
