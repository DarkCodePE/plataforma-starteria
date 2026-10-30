# KAN-180 — Reporte de integración de Portfolio Lead

Fecha: 2026-10-24  
Estado: `READY_FOR_HUMAN_VISUAL_ACCEPTANCE_PORTFOLIO_LEAD`

## Resultado

Se integró el WIP local PL06-D1-D10 en un worktree nuevo y aislado, conservando la configuración guiada existente y completando el cierre contextual y el Portfolio Overview ejecutivo sin rediseñar Portfolio Lead ni duplicar PL-06.

- Worktree de implementación: `C:\Users\User\proyect-starteria\starteria-KAN-180-portfolio-lead-integration`
- Rama local sin commits: `feat/KAN-180-portfolio-lead-integration`
- Base reconciliada: `d72223150fffa2b54082c2496f1f1b854334b090`
- URL de aceptación: `http://127.0.0.1:5198/portfolio/inicio`
- Credenciales efímeras: `C:\Users\User\proyect-starteria\kan180-runtime\credentials.env`
- Mailpit: `http://127.0.0.1:8030`
- No se hizo staging, commit, push, PR, merge ni deploy.

Jira KAN-180 no pudo leerse porque el entorno no tiene credenciales Jira. La autorización funcional usada fue la petición humana actual y el Goal/paquete KAN-180 suministrado, contrastados con Core v0.2, autoridad V2, guardrails, ADR-005/008/009 y contratos vigentes.

## Reconciliación KEEP / ADAPT / NEW

El inventario detallado está en `KAN180_KEEP_ADAPT_NEW.md`.

### KEEP

- Bootstrap persistido de 7 etapas: Contexto, Objetivo, Incorporación, Análisis, Organización, Briefs y Asignación.
- PL-06 como formulario único para `CHALLENGE` y `EXISTING_INITIATIVE`, con responsable, hasta dos colaboradores, guardado `CREATED`, envío explícito, batch, retry e idempotencia.
- Cierre contextual humano 7/7, persistido y sin envío de correo al completar.
- Navegación existente de Inicio, Frentes estratégicos, Retos, Iniciativas, Actores clave y Reportes/decisiones.
- Creación de un nuevo frente mediante una sesión contextual independiente, preservando el primero.

### ADAPT

- `GET /api/v1/portfolio/home` expone baseline, meta, horizonte y fuente declarada del frente.
- El Home consume `PortfolioCapacityReadService` como señal real de capacidad; horas y coste no se inventan.
- Contadores ejecutivos separados: Projects canónicos, Assignments y alertas/decisiones.
- Estados de Handoff distinguen guardado, SMTP procesado, enlace abierto, aceptación, rechazo y fallo.
- La idempotencia de delivery reserva el intento antes de SMTP, reclama reservas abandonadas y resuelve carreras concurrentes sin duplicar mensajes.
- El batch también se reserva de forma atómica: dos requests simultáneos esperan y devuelven el mismo resultado terminal, sin `P2002` visible ni segundo envío.
- Una reserva técnica `IDEMPOTENCY_RESERVED` nunca se presenta en Portfolio Home como fallo SMTP.
- Un rechazo sin respuesta de Portfolio aparece como intervención humana pendiente.
- Links contextuales reales conectan frente, reto e iniciativa sin convertir un encargo `CHALLENGE` en Project.
- Copilot aparece únicamente si su feature flag real está activa.

### NEW

- Lectura consultiva determinista `Qué vemos / Qué falta / Próxima intervención`, compuesta sólo con hechos del read model.
- Zona ejecutiva de capacidad, tiempo y recursos con ausencia honesta cuando no existe una métrica canónica.

No existe en el contrato vigente una serie KPI canónica fechada, con unidad y fuente. Por eso última lectura, distancia y gráfico muestran `Sin datos`; no se creó schema, write model ni dato sintético.

## Cambios principales

- Backend: extensión del read model de Portfolio Home, lectura parcial segura de capacidad y trazabilidad de BriefVersion/email en Assignments.
- Frontend: nuevo Overview ejecutivo en siete zonas, integración condicionada de Copilot y servicios tipados actualizados.
- Bootstrap/Handoff reconciliado: persistencia del cierre, batch delivery durable, SMTP configurable y migraciones asociadas.
- La invitación reutiliza las variables desplegadas `CORS_ORIGIN` y `PILOT_LEAD_NOTIFY_FROM`; no introduce configuración nueva en Kubernetes/CD.
- Pruebas de cuarentena actualizadas para reflejar que Portfolio Lead ya no usa la ruta legacy Challenge → Project; el consumidor Participant conserva compatibilidad.

## Entorno desechable real

| Recurso | Identidad | Puerto |
|---|---|---:|
| PostgreSQL 16 | `starteria-kan180-db-20261024` / DB `starteria_kan180` | 55452 |
| Mailpit SMTP | `starteria-kan180-mailpit-20261024` | 1030 |
| Mailpit UI/API | `starteria-kan180-mailpit-20261024` | 8030 |
| Backend Express | proceso local KAN-180 | 4118 |
| Frontend Vite | proceso local KAN-180 | 5198 |

Las 62 migraciones están aplicadas y `prisma migrate status` informa que el esquema está al día.

## Verificación

| Nivel | Comando / recorrido | Resultado |
|---|---|---|
| Backend unitario/contrato | `npm run test:backend` | PASS — matriz completa; las suites E2E condicionadas por flags se ejecutaron aparte sobre infraestructura real |
| Frontend unitario/componente | `npm run test:front` | PASS — 303 suites, 963 tests |
| PL-06B real | test HTTP con PostgreSQL + SMTP Mailpit | PASS — 3/3, incluida doble petición concurrente con un solo correo |
| Cierre contextual real | test HTTP con PostgreSQL + Mailpit | PASS — 3/3 |
| Lint | `npm run lint` | PASS |
| Tipos | `npm run typecheck` | PASS front + backend |
| Build front | `npm run build` | PASS; conserva warnings conocidos de tamaño/chunk dinámico |
| Build backend | `npm run build:backend` | PASS |
| Prisma | `npx prisma validate` + `npx prisma migrate status` | PASS; 62 migraciones al día |
| Estado persistido de aceptación | `verify-kan180-acceptance-runtime.ts` sobre PostgreSQL | PASS — 2 `SENT`, 2 `CREATED`, 4 proyecciones, 2 Projects, cierre persistido y 2 deliveries exitosos |
| Diff | `git diff --check` | PASS |
| Navegador | Chromium headless con DB/SMTP reales | PASS — 19 checks, 15 capturas, 0 fallos API relevantes, 0 errores de consola relevantes |

Los dos `401` registrados corresponden al refresh inicial sin sesión antes de login y están clasificados como esperados. Guardar las Assignments no generó correo; el envío confirmado generó exactamente uno; cancelar/finalizar la configuración no generó correos adicionales. El Overview mostró los cuatro encargos persistidos y conservó el estado exacto `2 SENT + 2 CREATED` después del cierre, reload, logout/login y acceso por URL directa.

La revisión de solo lectura se ejecutó en tres rondas. La primera detectó la reserva posterior a SMTP, configuración no cableada y evidencia de estados insuficiente; la segunda confirmó esas correcciones y detectó la carrera de creación del batch y la falsa presentación de una reserva técnica como fallo. Ambos bloqueos se cerraron con pruebas rojas/verdes, test HTTP concurrente sobre PostgreSQL/Mailpit y regeneración de la evidencia visual. La tercera ronda terminó `approved`, sin hallazgos, y confirmó CA-1…CA-12.

## Evidencia visual

- `artifacts/KAN-180/portfolio-lead-integration/04-portfolio-overview-desktop-1440.png`
- `artifacts/KAN-180/portfolio-lead-integration/07-portfolio-overview-mobile-390.png`
- `artifacts/KAN-180/portfolio-lead-integration/03-confirmacion-humana-de-cierre.png`
- `artifacts/KAN-180/portfolio-lead-integration/05-segundo-frente-contextual-desktop.png`
- `artifacts/KAN-180/portfolio-lead-integration/nav-frentes-estrategicos.png`
- `artifacts/KAN-180/portfolio-lead-integration/nav-retos.png`
- `artifacts/KAN-180/portfolio-lead-integration/nav-iniciativas.png`
- `artifacts/KAN-180/portfolio-lead-integration/nav-sponsors.png`
- `artifacts/KAN-180/portfolio-lead-integration/nav-decisiones.png`
- Evidencia estructurada: `artifacts/KAN-180/portfolio-lead-integration/kan180-portfolio-lead-evidence.json`
- Resultado completo frontend: `artifacts/KAN-180/front-tests.json`

## Integridad y recuperación

Antes de reconciliar el WIP se guardaron dos snapshots fuera de todos los repositorios:

- `tracked-wip.patch` — SHA-256 `D056E3BE928F7A28BF484F5E135205D2564E7148CA57EFD14205BB8C5BA2DEDF`
- `untracked-wip.tar.gz` — SHA-256 `BACD4C9F457952070237FADF711528647955244DF7285395BF820EDC276E0962`

Ubicación: `C:\Users\User\proyect-starteria\kan180-snapshots\20261024-pl06-d1-d10`.

El worktree fuente PL06-D1-D10 y los worktrees protegidos KAN-153, KAN-163 y KAN-178 sólo se inspeccionaron; no se escribieron. Todo el código integrado permanece sin staging ni commit en el worktree KAN-180.

## V2_CHANGE_CLOSURE_CHECK — preaceptación

- Slice y autoridad: coherentes con KAN-180 y el Goal suministrado.
- Core/ADRs/contratos: sin cambios de semántica Core ni edición de `doc/`.
- Contratos entre frentes: Prisma, migraciones, backend, cliente frontend y tests reconciliados.
- Evidencia: backend, frontend, DB, SMTP y navegador verdes.
- Revisión: ronda 3 `approved`, sin hallazgos.
- Manifest/CURRENT_STATE: no actualizados porque el usuario prohibió commit/PR/merge y todavía no hubo aceptación humana ni transición oficial del slice.
- Cierre de delivery/merge: no ejecutado por diseño.
- Resultado de integración: `READY_FOR_HUMAN_VISUAL_ACCEPTANCE_PORTFOLIO_LEAD`.
