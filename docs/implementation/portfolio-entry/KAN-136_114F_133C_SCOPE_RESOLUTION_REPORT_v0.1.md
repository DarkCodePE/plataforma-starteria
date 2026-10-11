# KAN-136 — 114F / 133C Scope Resolution Hardening v0.1

**Estado:** implementación local verificada; sin commit, push ni PR. **Base:** `origin/main` `16e8a9ea9191740db6d91adc9fc70b49602a2c7b`; rama `feat/KAN-136-114f-scope-resolution`.

## Autoridad y precondición

La jerarquía aplicable es `docs/STARTERIA_AUTHORITY.md`: Core factual v0.2, ADR de producto 003/004/005 aceptados, Portfolio Entry Logic Contract v0.1 y Experience Contract 114F v0.1 `ACCEPTED / FROZEN FOR IMPLEMENTATION PLANNING`, en especial §§3–4, 8 y 12. KAN-133 define 133C; Jira KAN-136 autoriza expresamente backend scope resolution, revalidación y tests, sin escritura, UI, Home ni Prisma. KAN-134 registra 133A lista y migración; Jira KAN-135 indica 133A aplicada en producción. KAN-135/PR #199 está mergeado en la base y su informe declara `READ_BOUNDARY_READY: YES` y `SCOPE_RESOLUTION_READY: YES` para el alcance inicial de 133B. 133C completa y endurece ese alcance; no persiste la elección.

`CURRENT_STATE.md` y `STARTERIA_V2_MANIFEST.md` todavía consignan 114F como `NOT_IMPLEMENTED`; describen el journey completo y se reconciliarán en el cierre post-merge cuando corresponda. No se interpretaron como autoridad para ampliar KAN-136.

## Auditoría previa: resolver y consumidores

| Superficie / conducta observada antes | Clasificación | Tratamiento 133C |
|---|---|---|
| `ScopedPortfolioAccessService.canUserAccessPortfolio`: User existente + Organization existente + OrganizationMember + grant exacto de la capacidad solicitada; errores DB se propagan | KEEP / V2 | La política general y los callers existentes conservan firma y semántica. |
| `listAccessibleOrganizations`: enumera memberships, comprueba cada grant, ordena por nombre; memberships duplicadas podían repetir opciones y nombres iguales carecían de desempate explícito | ADAPT / V2 | Nuevo resultado 114F deduplica por ID y ordena por nombre e ID; el método anterior permanece para compatibilidad. |
| GET 133B: `[]` daba `READY_PROVISIONAL` o `NO_AUTHORIZED_SCOPE` si existía snapshot; uno daba `READY_AUTHORIZED_SCOPE`; varios `SELECT_SCOPE`; excepción daba `SCOPE_VALIDATION_FAILED` | ADAPT / V2 | Consume `ZERO_SCOPES`, `ONE_SCOPE`, `MULTIPLE_SCOPES`, `RESOLVER_FAILURE` tipados. |
| Snapshot 114F current se mostraba sólo si su organización estaba en los scopes revalidados; snapshot legacy se excluía | KEEP / V2 + LEGACY_COMPAT | Continúa sin usar el snapshot como grant ni leer `portfolioScope` legacy. |
| `portfolio-contexts` y `continue-portfolio` anteriores: lista y revalidación exacta antes de escritura legacy | OUT_OF_SCOPE / LEGACY_COMPAT | Sin cambios de endpoint ni de persistencia. Sus tests permanecen en la regresión backend. |
| `portfolio-scope.ts` general: rol admin, permiso global, `User.organizationId`, memberships y grants se unen para lecturas Portfolio generales | OUT_OF_SCOPE | No se usa para resolver 114F. Cambiar la política Home/global requiere otra autoridad. |
| Falla técnica del resolver anterior: la excepción se propagaba desde el servicio y 133B la capturaba | ADAPT / V2 | Resultado tipado `RESOLVER_FAILURE`, nunca lista vacía. |
| Candidato arbitrario, de otro tenant o revocado antes de uso | ADAPT / V2 | Helper server-side de revalidación directa; no acepta listas, query ni snapshot como autoridad. |

No se detectó un bypass de permiso global en el GET 114F. El bypass potencial de la política Home general descrito por KAN-133 sigue fuera de esta slice.

## Diseño y semántica de resolución

`ScopedPortfolioAccessService.resolveReadableScopes(userId)` devuelve `ZERO_SCOPES`, `ONE_SCOPE`, `MULTIPLE_SCOPES` o `RESOLVER_FAILURE`. La lista sale únicamente de organizaciones con membership y grant exacto `portfolio:read` del usuario, tras comprobar User y Organization existentes. Las opciones se deduplican por `organizationId` y se ordenan por `name` y luego `organizationId` mediante comparación estable. Sólo incluyen `{organizationId, name}`. El método de listado previo y `canUserAccessPortfolio` siguen disponibles sin cambio de política.

El tipo discriminado expresa también la cardinalidad: tupla vacía, tupla de uno o tupla de al menos dos scopes. Así un consumidor futuro no puede construir un estado ONE/MULTIPLE incoherente sin error de tipos.

**Cero:** fuente, sesión y perfil válidos, resolución exitosa sin scope legible. 133B devuelve `READY_PROVISIONAL` sin snapshot, o `NO_AUTHORIZED_SCOPE` cuando una fila 114F current apunta a scope ahora revocado; `scopeState: NONE`, `portfolioRead: false` y superficie provisional. No hay Home, fallback legacy ni escritura.

**Uno:** se devuelve el único scope server-owned y `READY_AUTHORIZED_SCOPE`; no se persiste elección. El futuro 133D podrá resolver la omisión de ID en servidor si sigue siendo único y válido.

**Varios:** se devuelven sólo opciones autorizadas en orden estable y `SELECT_SCOPE` sin elección automática, salvo un scope de snapshot 114F current que vuelva a pasar el resolver vigente. Esto conserva la lectura 133B; el snapshot nunca concede permiso. La elección humana y su persistencia pertenecen a 133D/133E.

## Candidato, tenant isolation y revocación

`revalidateReadableScope({userId, organizationId})` devuelve `AUTHORIZED` con metadatos mínimos, `REJECTED` o `RESOLVER_FAILURE`. Reconsulta User, Organization, OrganizationMember y grant exacto `portfolio:read` para el usuario y candidato recibidos. No usa una lista previa, rol global, `User.organizationId`, permisos del cliente, query, `portfolioScope` legacy ni scope de snapshot como autorización. El caller de una mutación futura debe invocarlo en su propia transacción, con source/owner/currentness y CAS de 133D. Un ID arbitrario, de otro tenant, sin grant, sólo con `portfolio:write`, con membership retirada, con grant eliminado o con organización borrada devuelve `REJECTED`. El schema no modela un flag de organización inactiva ni vigencia/revocación de grant; la ausencia de fila es la revocación efectiva actual.

El GET 133B mantiene su lectura `RepeatableRead` y el lock de sesión de 133B. Un snapshot current de otro tenant o revocado no se proyecta aunque el usuario tenga otro scope válido. La consulta 114F no crea ni supersede filas y no llama a Project ni Steps.

## Fallo técnico e integración 133B

Un error de consulta de memberships, grants u organización produce `RESOLVER_FAILURE` sin detalles internos. 133B lo mapea a `SCOPE_VALIDATION_FAILED`, `scopeState: VALIDATION_FAILED` y `RETRY_SCOPE_VALIDATION`. Cero scopes se conserva como resolución exitosa. El DTO público y la ruta GET no cambian de firma; el controller sólo pasa `sessionId` e identidad autenticada y descarta `organizationId` de query. Un fallo inesperado del adaptador también se mapea de forma segura a `SCOPE_VALIDATION_FAILED`.

## Tests y validación

Los tests nuevos del servicio compartido se ejecutaron primero y fallaron por los métodos aún ausentes; tras implementarlos pasaron. Los tests de 133B se ejecutaron primero con el nuevo contrato y fallaron por falta de integración; tras adaptar el GET pasaron. Una corrección de nombre de campo en el fixture PostgreSQL resolvió el primer error de typecheck.

| Comando / evidencia | Resultado |
|---|---|
| Focal: scoped access + 133B read/status | PASS, 32/32 |
| PostgreSQL desechable `starteria_kan136_133c_20261011`; 53 migraciones existentes aplicadas | PASS |
| Integración PostgreSQL: resolver 114F, read/status 133B, data contract 133A y Home context legacy | PASS, 4/4 |
| `npm run test:backend` | PASS; tests con flag DB se corrieron aparte |
| `npm run typecheck:backend` | PASS |
| `npm run lint` | PASS |
| `npm run build:backend` | PASS |
| `git diff --check` | PASS |

El revisor de sólo lectura emitió `approved` en ronda 1, sin bloqueantes. Su única observación menor fue precisar la cardinalidad del tipo discriminado; se aplicó esa mejora y se repitieron los tests focales (32/32) y el typecheck backend (PASS). El resto de la matriz anterior corresponde al mismo comportamiento runtime.

La integración cubre dos usuarios, rol global sin grant, memberships duplicadas, 0/1/N, empate de nombres, `portfolio:write` sin read, candidato arbitrario/de otro tenant, grant y membership retirados, organización eliminada, snapshot current/legacy y ausencia de writes/Project/Steps. Las unitarias cubren error DB separado de cero y el mapeo público seguro. No hubo validación de navegador: no se modificó frontend ni ruta visible.

## Límites y siguiente slice

133D debe llamar `revalidateReadableScope` en su transacción de escritura, volver a comprobar source/owner/currentness, resolver uno u obligar selección entre varios, aplicar idempotencia/CAS y crear/superseder snapshot según su autorización propia. Ninguna de esas escrituras está implementada aquí. La emisión/vigencia de grants, cambio de perfil, Home/Bootstrap y la excepción Initiative siguen bajo sus dependencias/autoridades separadas. No se modificó Prisma, Core, Steps, frontend, routers legacy, Manifest ni `CURRENT_STATE.md`.

```text
SCOPE_RESOLUTION_HARDENED: YES
ZERO_ONE_MANY_DISTINGUISHED: YES
TENANT_ISOLATION_GUARD: YES
SCOPE_INJECTION_GUARD: YES
RESOLVER_FAILURE_DISTINGUISHED: YES
NEXT_SLICE_READY: YES — 133D, sujeto a su autorización propia
114F_WRITE_AUTHORIZED: NO
114F_UI_AUTHORIZED: NO
```

## V2_CHANGE_CLOSURE_CHECK

```text
V2 contract satisfied: YES para 133C / KAN-136
V2 route active: GET read/status de 133B; sin nuevo POST o ruta UI
V1 consumer remaining: portfolio-contexts, continue-portfolio y Home legacy
Legacy compatibility documented: KAN-133 y esta auditoría; KEEP_COMPAT, sin promoción
E2E passed: NO CORRIDO; no cambia ruta ni experiencia navegador
Manifest updated: NO; cierre post-merge del slice completo pendiente
Retirement action: KEEP_COMPAT
Migration status: PARTIAL; 114F completo requiere 133D/133E y gates posteriores
```
