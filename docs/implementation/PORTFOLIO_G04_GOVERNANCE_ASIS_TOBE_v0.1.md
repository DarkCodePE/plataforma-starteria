# G04 — Auditoría inicial de gobierno operativo y búsqueda por responsable

Fecha: 2026-11-09. Base: main@49d4aed90d74b28c7a6c5d990422a61bb3c4a54e.

## AS-IS comprobado en código
Portfolio Overview ya tiene tabla operativa de WorkItems, briefs, Assignments, Projects y Lab requests. Las pruebas G5 comprueban estados de handoff, ausencia de KPI/ROI inventados y disponibilidad parcial. El campo de búsqueda dice «Nombre, owner o estado», pero su implementación solo indexaba título, destino, estado y siguiente acción; **no incluía el actor persistido que se muestra en detalle**.

## TO-BE implementado
Añadir el actor persistido (`row.actor`) al filtro local, manteniendo todos los demás campos. Pruebas RTL con fixture de dos WorkItems y un Brief: buscar `lead-a` encuentra filas cuyos actores coinciden; búsqueda sin coincidencia las excluye. No introduce owners inferidos, no cambia la lectura backend ni atribuye actor del WorkItem al Project.

## Nielsen
H1 visibilidad: la búsqueda devuelve filas congruentes con el detalle de responsable; H2 lenguaje del usuario; H4 consistencia entre placeholder y comportamiento; H6 reconocimiento sin recordar nombres de iniciativas; H7 eficiencia para carteras grandes.

## Inventario de cobertura y brechas G04
- **Existe** Home autenticado real con escenarios 0/3/25 iniciativas: `front/e2e/kan232-g5-home-final.spec.ts`, ya ejecutado por CI.
- **Existe** distinción factual entre WorkItem, Brief, Assignment, Project y Lab request en `PortfolioOverviewHome` y tests; estados no prueban el circuito completo de decisiones.
- **Pendiente** verificación real de owner de iniciativas canónicas y equipo/Step desde backend, sin etiqueta genérica «Owner canónico» cuando hay ausencia de dato.
- **Pendiente** flujo de solicitud de ejecución: crear, asignar, responder, escalar, resolver, historial de eventos y autoridad; no confundir una decisión pendiente con una operación de gestión habilitada.
- **Pendiente** observaciones KPI reales con evidencia/fecha, diferenciación de hipótesis vs medición, tres perfiles y aceptación visual Nielsen H1–H10.
- **Pendiente** trazabilidad y permisos sobre nuevas mutaciones, reentrada, conflicto concurrente, duplicados y no exposición cross-tenant.

## Límites
Este PR abre G04 con una corrección factual que impacta a la tabla; **no certifica** el circuito alertas→decisión→resolución ni cierra G04. No habilita features experimentales ni crea entidades. CI, review y merge pendientes.

## G04 · Gate de solicitudes y autoridad (misma entrega)

Se integra como **CI obligatorio** `backend/modules/adaptive-core/__tests__/decision-request.e2e.test.ts` con `R2_PERSISTENCE_E2E=1` sobre PostgreSQL desechable, no contra producción. Valida creación de DecisionRequest desde iniciativa terminada y gobernada, petición repetida idempotente, persistencia/reentrada tras nuevo cliente Prisma, autoridad Portfolio Lead, snapshot de evidencia, y rechazo de casos auto-iniciados, incompletos o sin autoridad resuelta.

**Límite fundamental:** este es un circuito de solicitud de decisión al completar una iniciativa, **no** es todavía el workflow general de bloqueos/alertas de equipo (responder, asignar, escalar, resolver). No se modifican por este gate los modelos de negocio ni se hace pasar actor que registró un WorkItem por owner de ejecución.

**Hallazgo estructural corregido:** el backend `portfolio-home.read-service.ts` **sí** incluye `initiative.owner` (con `source: canonical`) para iniciativas vinculadas e independientes. La omisión estaba en el tipo TypeScript de frontend y en el mapeo de la tabla. Esta entrega enlaza el owner real de la proyección cuando `source === 'canonical'`, con fallback «Owner no disponible» para fuente ausente o derivada; no se inventan responsables ni se sustituye `actorId` por owner. Prueba de UI verifica nombre/filtrado canónico y rechazo de fuente `legacy-derived`.
