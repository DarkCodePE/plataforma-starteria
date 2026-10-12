# KAN-138 — 114F Productive Profile Evidence Establishment

**Estado:** implementación local verificada; sin commit, push ni PR.  
**Base:** `origin/main` = `2b21d2fb3727122fc2c8d94dd5cfde88de0d73b1`.  
**Rama:** `feat/KAN-138-114f-profile-evidence-establishment`.

## Autoridad y baseline

La jerarquía es `docs/STARTERIA_AUTHORITY.md`: Core factual v0.2 (`Base fundacional revisada / Por validar`), ADR-003/004/005 aceptados, Portfolio Entry Logic Contract v0.1 aprobado, y Portfolio Setup Continuity Experience Contract v0.1 aceptado para 114F. KAN-133 define la arquitectura; KAN-134/133A añadió las dos columnas nullable sin rellenar historia; KAN-135/133B y KAN-137/133D rechazan perfiles sin versión/evidencia; KAN-136/133C resuelve scope. Jira KAN-138 autoriza únicamente el establecimiento inicial en creación productiva. No se modifica Core, contrato, Prisma, migración, permisos ni UI.

El esquema Prisma ya contiene `PortfolioEntrySession.continuationProfileVersion Int?` y `continuationProfileEvidenceRef String?`. La migración 133A existente `20261011170000_add_114f_continuation_generations` es suficiente. El runtime 133B y 133D admite exactamente la versión `1` y exige evidencia no vacía. Antes de KAN-138, el servicio ponía `PORTFOLIO_LEAD_ENTRY`, pero el mapper insertaba versión/evidencia nulas.

## Auditoría de rutas de creación

| Ruta | Clase | Resultado |
|---|---|---|
| `POST /api/v1/public/portfolio-entry/sessions` → controller → experimental service → `PortfolioEntrySessionService.createAnonymousSession` → repositorio Prisma | PRODUCTIVE_CREATE | Única creación HTTP de `PortfolioEntrySession`; el mismo endpoint funciona con o sin autenticación y crea inicialmente una sesión anónima. |
| Llamadas directas al servicio desde composición productiva | PRODUCTIVE_CREATE | Comparten el mismo constructor de sesión y el mismo `repository.createSession`. Los orígenes `public_start`, `authenticated_portfolio_entry` e `imported_text` reciben igual establecimiento. No hay segundo inserter productivo. |
| `GET /sessions/:id`, provisional continuation y lectores 114F | READ_ONLY | No crean ni actualizan perfil/evidencia. |
| Resume con token público / lectura del propietario | READ_ONLY | Recarga el valor persistido; no repara. |
| `POST /sessions/:id/claim` | CLAIM | Sólo actualiza identidad, estado de propiedad, revisión y tiempos. |
| 114D y 114E | READ_ONLY respecto al perfil | Generan o leen sus propios artefactos sin establecer perfil. |
| Conversión/continuación y flujo piloto anteriores | LEGACY | No crean otra `PortfolioEntrySession` productiva; sus rutas conservan compatibilidad y no reciben establecimiento por lectura/conversión. |
| Fixtures Prisma y repositorio in-memory | TEST_ONLY | Pueden crear filas históricas explícitas; no definen política productiva. |

La búsqueda de `createAnonymousSession`, `repository.createSession` y `portfolioEntrySession.create` fuera de tests confirmó el único inserter de sesión en el repositorio Prisma. El servicio experimental es el único caller productivo HTTP. `PrismaPortfolioEntrySessionMapper.sessionMutableData` ya no incluye `continuationProfile`, de modo que los updates generales de sesión tampoco actúan como una transición de perfil. Claim conserva las tres columnas mediante un update limitado.

## Establecimiento y evidencia

`createAnonymousSession` genera el UUID de sesión en servidor y construye juntos:

```text
continuationProfile = PORTFOLIO_LEAD_ENTRY
continuationProfileVersion = 1
continuationProfileEvidenceRef = session-created:<sessionId>
```

Se reutiliza el formato `session-created:<sessionId>` ya empleado por los fixtures 133A/133B/133D. Significa: *el perfil Portfolio v1 se estableció por la política productiva de creación de esta sesión*. El UUID es la identidad durable de la fila, no un request ID; el prefijo no contiene PII, ruta, prompt ni inferencia de IA. La referencia prueba procedencia de establecimiento, no membresía, permiso ni autoridad organizacional. El repositorio ejecuta un único `portfolioEntrySession.create` con los tres campos en el mismo `data`; no hay UPDATE posterior. El mapper devuelve versión/evidencia persistidas, incluidas las nulas históricas.

`createSessionBodySchema` es estricto y no acepta campos top-level de perfil. Aunque `sourceMetadata` admite claves arbitrarias como metadatos, el servicio sólo toma `sourceMetadata` de ese objeto; no extrae perfil, versión ni evidencia. El test HTTP cubre rechazo de las tres claves top-level y un intento anidado en `sourceMetadata`. No cambió el DTO público.

## Claim, resume e historia

Claim conserva exactamente perfil, versión y evidencia, tanto para sesiones completas como históricas incompletas. Read/resume carga lo persistido; el mapper no inventa valores y ninguna de esas rutas escribe evidencia. La integración PostgreSQL comprueba valores antes/después del claim y nulos antes/después de read, resume y claim.

Una fila histórica con `PORTFOLIO_LEAD_ENTRY` pero versión o evidencia nula permanece incompleta. 133B devuelve `PROFILE_CONFLICT`; 133D rechaza con `PROFILE_CONFLICT` sin snapshot. No hay backfill, inferencia por fecha, propietario, rol, 114D/114E, handoff, membresía ni Starteria Path. Una UX futura podrá pedir iniciar una Entry nueva o diseñar una reparación con procedencia bajo autoridad separada; KAN-138 no repara filas existentes.

## Prueba de gates y efectos laterales

La integración PostgreSQL crea una sesión **mediante el servicio productivo**, la reclama, prepara un 114D confirmado y verifica 133B: sin grant devuelve `READY_PROVISIONAL`, con un grant de lectura creado explícitamente por el fixture devuelve `READY_AUTHORIZED_SCOPE`. 133D, con source binding, scope y revisión válidos, crea un snapshot 114F sin `PROFILE_CONFLICT` y conserva la misma referencia de evidencia. Otra prueba elimina versión y luego evidencia de una fila fixture y confirma `PROFILE_CONFLICT` en ambos gates, sin reparación ni snapshot.

La creación de sesión sólo inserta la fila `PortfolioEntrySession`. Una prueba compara grants, Projects, Steps y Bootstrap inmediatamente antes/después de crearla; otra los compara tras el write 114F. El único grant observado en esta última es el que el fixture crea expresamente para satisfacer el gate. No se crea Assignment, Invitation ni autoridad Initiative. Ningún código establece `INITIATIVE_ENTRY` o una transición desde Portfolio.

## Tests y validación

| Comprobación | Resultado |
|---|---|
| Test dirigido de servicio previo al código | Falló correctamente: versión/evidencia `undefined`. |
| Servicio + router (creación anónima, origen autenticado, payload malicioso, claim) | PASS: 74 tests, incluida la comprobación final de metadatos anidados. |
| Repositorio Prisma + 133D PostgreSQL | PASS: 38 tests. |
| 133B PostgreSQL, data contract, Home legacy, 114E submission y conversión legacy | PASS: 17 tests. |
| Backend completo sin flag DB | PASS, exit 0; los archivos DB se ejecutaron aparte. |
| `npm run typecheck:backend` | PASS. |
| `npm run lint` | PASS. |
| `npm run build:backend` | PASS. |
| `git diff --check` | PASS al cierre. |

Revisión de sólo lectura `revisor-starteria`, ronda 1: `approved`, sin hallazgos. Contrastó Jira KAN-138, autoridad, diff, pruebas y reporte; no repitió personalmente las suites.

La base de integración fue `starteria_e2e` local y desechable en `localhost:55433`. Estaba una migración atrás; se aplicó únicamente la migración **existente** 133A con `prisma migrate deploy`. No se generó ni modificó esquema o migración. No se usó LLM LIVE. No se requiere navegador: ningún contrato frontend ni UI cambió.

## Gaps y 133E

La recuperación UX de sesiones históricas incompletas sigue sin implementar. La UI 133E podrá usar el estado `PROFILE_CONFLICT` y ofrecer un comienzo nuevo sólo bajo su propia autoridad. Home/Bootstrap 133F requiere revalidación separada del snapshot. Este reporte y los tests de backend hacen que el bloqueador de establecimiento productivo esté resuelto localmente; el estado global de 114F continúa parcial hasta 133E/133F y merge. `CURRENT_STATE.md` y Manifest se actualizan sólo en el cierre autorizado posterior al merge, si cambia el estado factual del slice.

```text
PRODUCTIVE_PROFILE_EVIDENCE_READY: YES
NEW_SESSION_PROFILE_ATOMIC: YES
CLIENT_OVERRIDE_BLOCKED: YES
CLAIM_PRESERVES_PROFILE_EVIDENCE: YES
READ_DOES_NOT_BACKFILL: YES
HISTORICAL_NO_BACKFILL_PRESERVED: YES
133B_PROFILE_GATE_UNBLOCKED: YES
133D_PROFILE_GATE_UNBLOCKED: YES
NO_INITIATIVE_TRANSITION: YES
NO_PROJECT_STEPS_SIDE_EFFECTS: YES
NEXT_SLICE_READY: YES — 133E puede planificarse tras merge, bajo autoridad separada
114F_UI_AUTHORIZED: NO
HOME_HANDOFF_AUTHORIZED: NO
```

## V2_CHANGE_CLOSURE_CHECK

```text
V2 contract satisfied: YES, para el establecimiento inicial de perfil de sesiones nuevas
V2 route active: YES, la creación productiva de Portfolio Entry; 114F sigue parcial
V1 consumer remaining: YES, rutas piloto, conversión y continuación legacy
Legacy compatibility documented: YES, KEEP_COMPAT; historia incompleta falla cerrada
E2E passed: NO APLICA a UI; PostgreSQL y backend verificados
Manifest updated: NO, cierre post-merge pendiente
Retirement action: KEEP_COMPAT
Migration status: PARTIAL
```
