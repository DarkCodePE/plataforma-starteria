# KAN-253 B4-C2D — Checkpoint E2 atómico y gobernado por la persona

**Fecha:** 2026-11-09
**Base real:** rama PR #284, HEAD `6aef9622daa7f5ba155b887e6403fbab33253478` (incluye PR #288).
**Estado:** candidato sujeto a CI/revisión/QA. **No integrado en main ni activado en producción.**

## AS-IS verificado
- La UI experimental B4-C2C permite responder varias preguntas provisionales sin incorporar cada turno al Anchor.
- El resumen E2 muestra campos y respuestas, pero no puede cerrar la revisión acumulada.
- El PATCH heredado de Anchor valida solamente un nuevo recibo por operación. Encadenar cuatro PATCH desde la UI generaría cambios de versión que invalidan las respuestas restantes.
- Los turnos tienen ledger CAS + idempotencia y vínculo con Anchor/E1, pero no existe una operación humana atómica que acepte y descarte el conjunto.

## Nielsen critique
- H1 Estado del sistema: diferenciar conversado, pendiente, descartado, incorporado y confirmado.
- H3 Control y libertad: aceptar o rechazar **cada respuesta** y confirmar después.
- H5 Prevención de errores: no aceptar una versión antigua ni decisiones incompletas.
- H6 Reconocimiento: comparar y resolver varias respuestas en el mismo panel.
- H7 Eficiencia: una revisión grupal en lugar de PATCH repetidos.
- H9 Recuperación: conflicto 409 deja datos intactos y solicita recuperar versión.

## TO-BE implementado
- Nuevo contrato estricto `PortfolioGoalCheckpoint`:
  `expectedAnchorVersion`, `expectedLedgerVersion`, `expectedContextReviewVersion` y `decisions[{turnId,action:'accept'|'reject'}]`.
- POST autenticado `/sessions/:sessionId/objective/checkpoint` habilitado **solo si**:
  `PORTFOLIO_GOAL_E2_LEDGER_ENABLED=true`, `PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED=true`, `PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED=true`.
- El servidor deriva campos de texto desde el ledger, no del request; valida cobertura exacta de todos los turnos activos, misma sesión, versiones y rechazo de duplicados. Una sola transacción Serializable registra historia, aplica CAS de Anchor, registra accepted/rejected receipts y audita.
- El Anchor resultante continúa provisional. `confirmAnchor` permanece un acto humano independiente. `unknown` conserva incertidumbre; no inventa KPI.
- Los recibos rechazados quedan identificados en `goalLedgerRejectedTurnIds`, visibles en historial y excluidos de pendientes/planificador. Se impide falsificarlos por PATCH legado.
- Frontend opt-in `VITE_PORTFOLIO_GOAL_E2_CHECKPOINT_UI_ENABLED=true` junto con bandera multi-turn. La persona debe elegir aceptar o no incorporar para **cada** turno vigente. Solo entonces se habilita «Aplicar decisiones al borrador».
- Tras aplicar se solicita refresco del Portfolio Bootstrap. La interfaz no declara el objetivo confirmado.
- Test unitario para rechazos, superposición, unknown, versión, selecciones incompletas; test React de un solo request/fallo; test PostgreSQL HTTP de dos respuestas con decisiones mixtas y CAS.

## Visual AS-IS → TO-BE
AS-IS:
Conversación (N turnos provisionales) → resumen sin posibilidad de cerrar → no puede avanzar E2/E3.

TO-BE:
Conversación (N turnos provisionales)
           ↓
Checkpoint: objetivo actual versus propuestas
  ├── Turno A: [Incorporar] / [No incorporar]
  ├── Turno B: [Incorporar] / [No incorporar]
  └── Turno C: [Incorporar] / [No incorporar]
           ↓ acción humana explícita
POST checkpoint (1 transacción, un CAS, E1/ledger/Anchor verificados)
           ↓
Borrador actualizado + registro de aceptados/descartados
           ↓
Confirmar objetivo (separado, solo si suficiente)
           ↓
E3 Incorporación, bajo gates existentes.

## Límites
- B4-B candidato semántico todavía NO está conectado al runtime. Las preguntas consecutivas siguen determinísticas.
- No se permite reescribir turnos ya respondidos desde el checkpoint: la corrección histórica versionada sigue pendiente.
- Para más de 30 turnos pendientes, este comando falla cerrado y requiere revisión de contrato/capacidad.
- No autoriza autoaceptación, autoasignación, Front/Challenge/Step ni creación de iniciativa.
- ADR-010 sigue pendiente de ratificación, flags OFF por defecto y sin CD.
- Aún falta QA E2E navegador autenticado, reentrada multi-tab, accesibilidad, testing de concurrencia y ratificación de autoridad antes del rollout.

## Secuencia de integración
PR #281 contra main → PR #284 sobre UX-02 → este PR (B4-C2D) sobre #284 → pruebas E1→E2→E3 con flags y confirmaciones. No hacer merges cruzados sin rebase/revisión.

## Evidencia pendiente
CI completo / TypeScript / Vitest / PostgreSQL / Playwright autenticado; ver estado de PR.
