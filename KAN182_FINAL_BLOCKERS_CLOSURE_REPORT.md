# KAN182_FINAL_BLOCKERS_CLOSURE_REPORT

Fecha de verificación: 2026-10-25
Base de comparación: PR #222, HEAD publicado `98443b9b59cf8e3b4a0cf58f6074f6b971a61a4c`
Alcance: exclusivamente HIGH-02, HIGH-04 y MEDIUM-02
Modo Git: sin staging, commit, push, modificación del PR, merge ni deploy

## Resultado

**READY_FOR_PR_UPDATE** para publicar una nueva revisión de código, sujeto a una nueva autorización de staging/commit/push.

**Gate de producción/CD: BLOCKED.** Las seis bases persistentes locales ADR-009 autorizadas para inventario tienen checksums distintos del archivo publicado restaurado, y una de ellas conserva la migración sin `finished_at`. Antes de aprobar merge o un CD debe inventariarse el historial del destino real y aprobarse una reparación controlada por cohorte. Las pruebas en una base nueva no sustituyen ese gate.

No se declara exactamente una entrega SMTP. La garantía implementada es: una sola ejecución automática por intención mientras exista resultado conocido; un resultado potencialmente aceptado por SMTP pero no persistido queda `UNKNOWN` y no se reenvía automáticamente.

## Causa raíz y cierre por hallazgo

### HIGH-02 — entrega SMTP e idempotencia durable

**Causa raíz.** La reserva anterior se identificaba sólo por estado y tiempo. Un lease vencido podía ser reutilizado sin generación/propietario persistente; la finalización no comprobaba ownership. Además, el retry reemplazaba conceptualmente la clave activa sin conservar de forma durable todas las claves anteriores. Una excepción después de aceptación SMTP se clasificaba como fallo reintentable aunque el resultado externo fuera ambiguo.

**Corrección.**

- `portfolio-handoff-delivery.service.ts:52-205`: cada ejecución tiene UUID propietario, generación y lease. `completeOwned` debe conservar generación+owner+lease vigente. Una excepción de transporte o una finalización fuera de lease produce `DELIVERY_OUTCOME_UNKNOWN`; nunca reclama ni reenvía ese intento automáticamente. Una reserva creada antes del fencing se reconoce por `IDEMPOTENCY_RESERVED` y se concilia, no entra al retry de fallos confirmados.
- `portfolio-handoff-invitation.types.ts:63` y repositorios: toda clave que descubre una intención ya existente queda ligada antes del replay. Si una carrera muestra que ya estaba ligada a otro intento, se valida el fingerprint y se devuelve conflicto. El fallo confirmado conserva binding+claim en la misma transacción CAS.
- `prisma-portfolio-handoff-delivery-attempt.repository.ts:18-115`: reserva y binding de clave en una transacción; tras perder un `P2002` o CAS, la clave perdedora también se liga al intento vencedor; claim CAS sólo desde fallo confirmado; completion CAS con fencing completo; expiración y reservas pre-fencing pasan fail-closed a `UNKNOWN`.
- `20261025015000_add_kan182_delivery_attempt_keys/migration.sql:3-23`: tabla append-only con unicidad `(assignmentId, idempotencyKey)` y backfill de claves históricas. Un retry añade una clave; no borra la protección de claves previas.
- `20261025010000_add_kan182_delivery_guards/migration.sql:18-33`: estado `UNKNOWN`, generación/owner/lease e índices.
- `ChallengeAssignmentPreparationPanel.tsx:448-478` y contrato cliente: `UNKNOWN` se muestra como “resultado por conciliar”, no cuenta como enviado y no ofrece “Reintentar solo fallidas”.

**Semántica resultante.**

- `delivered: false` es fallo confirmado y admite retry explícito.
- Excepción/timeout sin recibo inequívoco es resultado desconocido; conserva un token activo para conciliación y no cambia Assignment a `SENT`.
- Aceptación SMTP seguida de pérdida de respuesta/persistencia es `UNKNOWN`; otra batch key obtiene el mismo resultado sin una segunda llamada SMTP.
- La aplicación no promete exactly-once externo porque SMTP/Mailpit no aporta una clave de deduplicación del proveedor.

### MEDIUM-02 — recuperación durable de lotes PROCESSING

**Causa raíz.** La reclamación del batch tenía CAS sobre el lease, pero `saveProgress` actualizaba sólo por `batchId`; un worker obsoleto podía sobrescribir progreso persistido por el nuevo propietario.

**Corrección.**

- `portfolio-handoff-batch-delivery.service.ts:63-171`: owner y generación al reservar/reclamar; cada progreso renueva lease; un resultado desconocido termina en `RECONCILIATION_REQUIRED`; sólo resultados `FAILED` son seleccionables para retry.
- `prisma-portfolio-handoff-delivery-batch.repository.ts:28-67`: reclamación incrementa generación; `saveProgress` exige batch `PROCESSING`, generación, owner y lease vigente. Si el CAS falla devuelve el estado durable sin sobrescribirlo.
- La recuperación omite ítems ya persistidos. Si el envío terminó pero el batch no guardó progreso, el intento durable decide entre replay exitoso y conciliación; no se vuelve a enviar por inferencia.

### HIGH-04 — compatibilidad histórica ADR-009

**Causa raíz.** La remediación anterior había editado `20261023090000_add_adr009_imported_initiative_canonicalization` después de que distintas variantes ya se aplicaran en bases persistentes. Una base nueva sólo demostraba el historial nuevo y no la compatibilidad con historias existentes. El preflight tampoco comparaba directamente `Project.organizationId` con la organización canónica del `StrategicFront` relacionado.

**Corrección.**

- La migración publicada `20261023090000...` se restauró byte a byte. SHA-256 local: `576354695820ce8de70ae9c089ac9c7ed125a3dc2a6db1765598631ed6e39285`.
- `20261025020000_add_kan182_adr009_forward_guard/migration.sql:1-63` es forward-only y aditiva: detecta owner inválido, Project multiorganización, falta de organización canónica y diferencia directa Project↔StrategicFront. No ejecuta ningún `UPDATE`, no elige tenant por inferencia y supera el patrón de rechazo de migraciones no aditivas de `scripts/ci/prod-db-migrate.sh:82-94`.
- Las reservas antiguas quedan en cuarentena al primer acceso mediante CAS runtime; los batches `PROCESSING` antiguos se reclaman incrementando generación. Así no se necesita una mutación masiva en la migración.
- `scripts/preflight/kan182-adr009-production-readonly.sql:1-160` usa `BEGIN TRANSACTION READ ONLY`, incluye el gate `project_front_tenant_mismatch`, nulos, owners, multiorganización y colisiones.
- `scripts/preflight/kan182-adr009-migration-history-readonly.sql` clasifica checksum publicado, checksum distinto, migración incompleta y base sin historial, sin escrituras.
- `scripts/preflight/tests/kan182-adr009-inconsistent-fixture.sql` demuestra en PostgreSQL desechable que el preflight devuelve `owner_front_tenant_mismatch` y `project_front_tenant_mismatch`; todo se revierte.

## Inventario READ-ONLY de historial ADR-009

No se consultó producción. Se consultaron únicamente contenedores locales cuyo nombre declara finalidad ADR-009, dentro de transacciones `READ ONLY`.

| Base local | Checksum aplicado | Estado |
|---|---|---|
| `starteria-adr009-postgres` | `155045d9d30412a47727641200f63d3cdd7da076a990570e8501ccfc9f12e0f3` | finalizada |
| `starteria-p12r1-adr009-runtime-db-20261023` | `155045d9d30412a47727641200f63d3cdd7da076a990570e8501ccfc9f12e0f3` | **sin `finished_at`** |
| `starteria-p12r1-adr009-runtime-db-clean-20261023` | `ae472002b0862a3b608e82abc6b6d2bdf1c50c12bd4a3411039fa383c6b990d8` | finalizada |
| `starteria-p12r1-adr009-tests-db-20261023` | `ae472002b0862a3b608e82abc6b6d2bdf1c50c12bd4a3411039fa383c6b990d8` | finalizada |
| `starteria-p12r1-adr009-visual-db-20261023` | `ae472002b0862a3b608e82abc6b6d2bdf1c50c12bd4a3411039fa383c6b990d8` | finalizada |
| `starteria-p12r1-adr009-visual-clean-db-20261023` | `ae472002b0862a3b608e82abc6b6d2bdf1c50c12bd4a3411039fa383c6b990d8` | finalizada |

Ninguna coincide con `57635469…39285`. No se modificó `_prisma_migrations`, no se ejecutó `migrate resolve` y no se aplicó reparación.

### Estrategia compatible propuesta

1. Ejecutar los dos preflights READ-ONLY en cada destino autorizado, incluido staging y, sólo con autoridad explícita, producción.
2. Separar destinos por checksum/estado: publicado, `155045…`, `ae472…`, incompleto o ausente.
3. Obtener y revisar el SQL exacto que generó cada checksum divergente; comparar esquema y datos reales con el contrato ADR-009 y los gates forward.
4. Si hay filas reportadas, reconciliarlas mediante plan humano por Project; nunca mediante inferencia del owner ni actualización masiva automática.
5. Sólo tras evidencia equivalente y backup validado, aprobar una reparación de historial específica por cohorte. Cualquier cambio a `_prisma_migrations` requiere runbook, doble revisión y rollback; este trabajo no lo ejecuta.
6. Ejecutar `prisma migrate deploy` primero en una copia desechable de cada cohorte y comprobar que aplica `0100`, `0150` y `0200` sin drift ni pérdida.

## Pruebas ejecutadas

| Verificación | Resultado |
|---|---|
| Unit: delivery + batch fencing + SQL (`24` tests) | PASS |
| Front: panel de preparación/conciliación (`19` tests) | PASS |
| HTTP + PostgreSQL + Mailpit (`7` tests) | PASS |
| ADR-009 integración + fixture histórica (`4` tests) | PASS |
| `npm run typecheck` front+backend | PASS |
| `npm run lint` (baseline/guard de arquitectura) | PASS |
| `prisma validate` | PASS |
| `prisma migrate deploy` desde cero (`66` migraciones, incluida alineación metadata-only del índice) | PASS |
| Preflight de base limpia | PASS, cero gates |
| Preflight con fixture inconsistente | PASS, detecta ambos mismatches y hace rollback |
| `git diff --check` | PASS |
| búsqueda focal de secretos/llaves privadas en el diff | PASS, sin coincidencias |

Cobertura focal demostrada:

- SMTP lento que excede TTL, dos workers superpuestos y una sola llamada (`portfolio-handoff-delivery.service.test.ts:176`).
- Reserva expirada a resultado desconocido, sin reenvío (`:114`).
- Reserva histórica pre-fencing puesta en cuarentena runtime, sin SMTP (`:145`).
- Excepción de transporte a `UNKNOWN`, sin retry automático (`:201`).
- Retry de fallo confirmado con nueva clave y preservación de la clave anterior (`:217`).
- Worker con generación obsoleta no completa el intento (`:242`).
- Dos batch keys distintas generan un solo intento, correo y token (`pl06b-handoff-delivery.http.e2e.test.ts:134`).
- Fencing PostgreSQL de intento y batch contra escrituras obsoletas, incluida cuarentena de reserva histórica (`:170`).
- Las dos claves concurrentes de un fallo confirmado quedan ligadas al intento y no pueden reutilizarse (`:210`).
- SMTP aceptado y respuesta perdida: `UNKNOWN`, segunda clave queda ligada, no reenvía y no puede reutilizarse con otro fingerprint (`:240-279`).
- Recuperación tras crash entre intento `FAILED` durable y progreso de batch conserva `FAILED`, sin falso éxito (`portfolio-handoff-batch-delivery.service.test.ts:159`).
- Fixture histórica Project↔StrategicFront hace fallar el guard forward y revierte (`adr009-imported-initiative.integration.test.ts:124`).

No se repitió la suite global: no había razón técnica tras limitar cambios y regresión a los módulos afectados. Una invocación inicial accidental de `npm test` alcanzó suites ajenas y mostró un fallo temporal preexistente de billing por cálculo de fecha; no se usa como evidencia de esta remediación.

## Riesgos residuales y CD

- `.github/workflows/cd.yml:1-15` se activa con push a `main`; el job productivo tiene aprobación humana en `environment: production` (`:176-182`) y aplica migraciones antes del rollout (`:287-295`). Un merge inicia el pipeline, aunque la migración productiva espera el gate humano.
- Un destino con checksum divergente puede hacer fallar `prisma migrate deploy` antes de la migración forward. Por eso merge/CD sigue condicionado al inventario y reparación aprobada del historial real.
- El guard `0200` puede detener correctamente el deploy si detecta datos ambiguos. Eso es fail-closed, no una regresión; requiere reconciliación humana y nuevo intento.
- Las migraciones KAN-182 finales no coinciden con los patrones no aditivos que `prod-db-migrate.sh` rechaza; aun así, ese hecho no resuelve el checksum ADR-009 divergente del destino.
- SMTP sigue sin deduplicación provider-side. `UNKNOWN` evita duplicados automáticos, pero requiere un procedimiento operativo de conciliación antes de un eventual reenvío manual.
- Las pruebas limpias demuestran instalabilidad del historial nuevo, no compatibilidad automática con datos productivos existentes.

## Preservación de alcance

- No se reabrieron HIGH-01, HIGH-03, MEDIUM-01 ni MEDIUM-03.
- No se modificaron rutas de REGISTER_EXISTING, cierre contextual ni factorías de Project en esta ronda.
- No se incorporó KAN-178/179.
- No se tocaron worktrees protegidos, backups ni artefactos locales excluidos.
- No hubo staging, commits, push, modificación del PR, merge, deploy ni migraciones productivas.

## V2_CHANGE_CLOSURE_CHECK

- Slice y autoridad: remediación técnica KAN-182 limitada por la instrucción aprobada a HIGH-02, HIGH-04 y MEDIUM-02.
- Core/ADR/Handoff: no cambia autoridad humana, semántica de aceptación/start ni ownership; refuerza idempotencia durable y conserva ADR-009 sin reescribir historia.
- Contratos y consumidores: puerto, repositorios, servicio, UI de conciliación y esquema Prisma permanecen alineados; `UNKNOWN` no se presenta como envío confirmado.
- Datos: migraciones aditivas y guard fail-closed; no hubo ejecución ni consulta productiva.
- Evidencia: suites focales, PostgreSQL desechable, Mailpit sandbox, migración limpia, fixtures históricas, typecheck, lint y revisión independiente completados.
- Documentación de estado: no cambia el estado del slice, por lo que no corresponde modificar Manifest ni `CURRENT_STATE.md` en esta ronda.
- Conflicto abierto: historial ADR-009 divergente en bases persistentes; dueño humano debe aprobar inventario y reparación por cohorte antes de producción.
- Closure: **YES para PR update; NO para producción/CD**.

## Condiciones antes de publicar un nuevo HEAD

1. Conservar junto a la evidencia el dictamen `APPROVED_FOR_PR_UPDATE` de la revisión independiente READ-ONLY.
2. Autorizar explícitamente staging/commit/push; esta ejecución no los realiza.
3. Incluir sólo el diff KAN-182 autorizado y mantener fuera artefactos, helpers, backups y temporales.
4. Mantener en el PR el gate visible: **producción/CD bloqueado** hasta inventario del destino real y runbook de reparación aprobado.

## Revisión independiente

La ronda 2 detectó un último camino incompleto: una key nueva que encontraba directamente una intención `UNKNOWN` recibía el replay sin persistir su binding. Se corrigió haciendo obligatorio `bindIdempotencyKey` antes de todo replay, manteniendo el binding atómico dentro del claim para fallos confirmados, y se añadieron regresiones unitarias y PostgreSQL.

La ronda 3 READ-ONLY concluyó:

- HIGH-02: **PASS**.
- HIGH-04: **PASS** para preparar nuevo HEAD; producción permanece **BLOCKED**.
- MEDIUM-02: **PASS**.
- Decisión independiente: **APPROVED_FOR_PR_UPDATE**.

La aprobación habilita técnicamente preparar un nuevo HEAD cuando exista autorización Git; no aprueba merge, CD ni producción.
