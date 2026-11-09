# G04 · AttentionItem Workflow — contrato de implementación v0.1

Fecha: 2026-11-09. Base: main@99a0b543beb41c22c21e686a812b38c9d0faa449.

## Propósito
Implementar un circuito persistido de gestión de alertas del portafolio sin reutilizar indebidamente DecisionRequest (decisión al terminar Step 4), HelpRequest (mentoría) ni solicitudes de contacto a Startería Lab.

## AS-IS verificado
- Prisma ya posee AttentionItem con projectId, ownerId, severidad, estado open/acknowledged/resolved/cancelled, condición de cierre y campos de resolución.
- El backend todavía no exponía un flujo transaccional gobernado con historial inmutable para estas alertas.
- Portfolio Home ya lee atención e iniciativas, pero no permite gestionar todas las acciones.
- DecisionRequest tiene otro contrato y autoridad; no debe presentar «escalamiento de bloqueo» como una decisión corporativa de final de ciclo.

## TO-BE implementado en esta rama
1. Modelo aditivo PortfolioAttentionEvent con idempotencyKey único, payloadHash, actor, acción, estado y owner antes/después, explicación y fecha; AttentionItem.version (CAS).
2. Policy para reconocer, asignar, responder, escalar, resolver, cancelar y reabrir, con explicación requerida para decisiones relevantes.
3. Service transaccional Prisma: alta de alerta, scope de assignee a organización, CAS, evento atómico, detección de reintento duplicado y conflicto si cambia el contenido.
4. Rutas /portfolio/initiatives/:projectId/attention-items (GET y POST) y /portfolio/initiatives/:projectId/attention-items/:attentionId/actions (POST). Las escrituras requieren portfolio:write y guard de recurso de organización; la lectura exige portfolio:read.
5. Panel PortfolioAttentionPanel integrado en el detalle operativo de cada iniciativa, con listado real, formulario de alta, selector de acciones, explicación, responsable elegido solo de fuentes canónicas, respuesta a conflictos y eventos visibles.
6. Tests RTL del panel para lectura, escritura explícita, revisión/versión y prohibición de escalar sin assignee.
7. Tests de dominio y PostgreSQL real para ciclo completo, evento persistido, owner ajeno, idempotencia y versión antigua. CI obliga la ejecución en base aislada.

## AS-IS → TO-BE UX integrada en este PR
AS-IS: Atención visible en lectura o conteo → no hay acciones verificables y auditadas por alerta.
TO-BE: Tabla de iniciativas → expandir detalle → panel de alertas con GET persistido → crear, reconocer, responder, asignar, escalar o resolver → historial cronológico y actualización manual. Acciones con confirmación explícita y versión del servidor. El panel no atribuye métricas nuevas ni crea Steps.

## Guardrails
- No se modifica el modelo de Step0–4, no se crea Assignment ni se inventa un KPI.
- La API de Portfolio Lead usa portfolio:write. **El equipo OWNER/EDITOR activo puede abrir y consultar alertas por /projects/:id/attention-items**, protegido por project-team-access y organización; no recibe permiso de portafolio ni acceso a acciones de resolución. La interfaz de iniciativa muestra un formulario propio para comunicar bloqueos.
- No cerrar G04 con este avance: faltan permisos para rol equipo, coordinación de notificaciones/contador en Home, caso de dos pestañas, validación de UX en navegador y QA real Nielsen H1–H10.
- No fusionar ni desplegar migraciones productivas sin revisión y CI postmerge.

## Handoff del equipo y estado ejecutivo
- InitiativeOverviewPage integra `InitiativeAttentionReporter` para OWNER/EDITOR editables. El formulario exige motivo, condición de resolución, siguiente paso y prioridad, con idempotencia y recuperación; **no marca el Step como bloqueado automáticamente**.
- Portfolio Home lee `AttentionItem` del Project. Esta entrega garantiza que tanto `open` como `acknowledged` siguen apareciendo como atención no resuelta; `resolved` y `cancelled` dejan de contarse como activas.
- La notificación visual se basa en la proyección de atención de Home al recargar; no hay todavía push/email/notificación de campana en tiempo real.
- El control de versión y el evento transaccional registran todo cambio de estado/owner, además de la respuesta humana.
- Se añaden tests de la entrada de equipo y de la proyección de atención en Home. Persisten pendientes smoke autenticado navegando en ambos roles, accesibilidad con tres perfiles y validación de una solicitud real desde el equipo hasta su resolución en Portfolio Lead.
