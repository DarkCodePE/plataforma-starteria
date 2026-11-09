# KAN-253 B3 — UX E2 conversacional basada en ledger, con incorporación humana

**Fecha:** 2026-11-09  
**Baseline:** `main@82f06c1cf7a8fb30d5fa6c4ed6a5bcb583c32dbb`.  
**Estado:** Implementación en PR, no fusionada, sin CD.  
**Autoridad:** Core factual v0.2, Authority Map, KAN-253, ADR-010 (todavía **PROPUESTO**, aunque B2 se fusionó), reglas V2 de migración y human review.

## Decisión de experiencia

Portfolio Lead / Inicio permanece como Overview-first (KAN-250). Solo al abrir un proceso E2 se muestra el modo alternativo, **si se habilitan dos banderas**:
- Backend: `PORTFOLIO_GOAL_E2_LEDGER_ENABLED=true`, por defecto false.
- Frontend: `VITE_PORTFOLIO_GOAL_E2_LEDGER_UI_ENABLED=true`, por defecto false.

Con cualquiera deshabilitada, no hay nuevo flujo end-to-end; con UI ON y backend OFF el panel falla cerrado, ofrece reintento y la posibilidad explícita de volver a la guía histórica. No se habilitan por este PR ni se compra inferencia.

### Secuencia funcional en B3

1. **Reentrada:** lectura autenticada y sin escrituras de `GET objective/plan` y `GET objective/turns`; aparecen pregunta singular, recap, razón y cita E1 confirmada cuando disponible. Sin prometer IA: el plan sigue `deterministic_preview`.
2. **Responder:** una respuesta libre o `No lo sé todavía` se envía bajo acción explícita a `POST objective/turns` con idempotency key estable por intento, versión del ledger, versión Anchor y versión E1. Devuelve turno provisional.
3. **Revisar:** la respuesta guardada se representa como **pendiente**, no modifica Anchor. Se puede corregir mediante nuevo turno con `supersedesTurnId` sin borrar historial. No hay avance ni falsa confirmación automática.
4. **Incorporar al borrador:** CTA humano separado construye un patch con `sourceRefs.objectiveConversation.goalLedgerAcceptedTurnIds`, preserva historial pre-B2 y mapea únicamente el campo/dato que el usuario declaró; unknown conserva un gap explícito.
5. **Verificación servidor:** `updateAnchor(expectedVersion)` introduce CAS atómico opcional para la nueva UI, sin romper llamadas legacy. El backend comprueba que el recibo pertenece a la misma sesión y versión, que la cita/payload corresponde a ese turno, que no se ha retractado y que los IDs aceptados solo aumentan de uno en uno.
6. **Confirmar:** `confirmAnchor` humano permanece separado y sujeto a `anchor_sufficient`; no se crea Front/Challenge/Initiative/Step.

### Reconciliación con E2 legado

Los turnos de `sourceRefs.objectiveConversation.turns` previos a KAN-253 se muestran **como historial anterior**, no se migran silenciosamente ni se cuentan como turnos del ledger. Al aceptar una respuesta B3, se añade un registro compatible con `ledgerTurnId` y se preservan los datos existentes. Los recibos confirmados se detectan al recargar mediante `goalLedgerAcceptedTurnIds`. Se evita duplicar esos recibos en la sección de histórico previo.

El modo nuevo **no elimina** el `ObjectiveConversation` existente ni modifica `nextObjectiveQuestion` del fallback. No se ha añadido `StructuredModelAdapter`, nuevas prompts IA, memoria generativa o cálculo de KPIs.

## V2_CHANGE_GUARDRAIL_CHECK

```text
slice_id: PORTFOLIO_E2_LEDGER_CONVERSATION_UI_B3
owner: PortfolioBootstrap E2 frontend + CAS opcional backend
authority: Core v0.2, KAN-253, Authority Map, ADR-010 proposed
baseline: main@82f06c1cf7a8fb30d5fa6c4ed6a5bcb583c32dbb
new_ui: PortfolioGoalLedgerConversation
preserves: Inicio Overview-first, E1 confirmation, PortfolioAnchor, E2/E3 gate, CAS/history, no auto Step/Project
flags: PORTFOLIO_GOAL_E2_LEDGER_ENABLED=false; VITE_PORTFOLIO_GOAL_E2_LEDGER_UI_ENABLED=false
legacy: Existing ObjectiveConversation unchanged when frontend flag OFF
new_write: POST goalTurn provisional, PATCH Anchor with expectedVersion after explicit incorporation
source_protection: E2 receipt id + same session + same anchorVersion + literal quote
prohibited: auto Anchor confirmation, live IA, cost provider, secrets, migrations, CD
acceptance: CI, targeted PostgreSQL tests for both CAS and forged receipt, reentry/fallback UX tests, human review
```

## Casos de test

- Unidad `goal-ledger-anchor-proposal.test.ts`: un solo campo de resultado, KPI unknown, revisión/corrección append-only, session mismatch y retractación.
- React `PortfolioGoalLedgerConversation.test.tsx`: rehidratación, motivo y fuente, respuesta provisional, doble acción humana, reentrada, recibo ya aceptado, fallo cerrado y legado visible.
- React `PortfolioBootstrapHome.goal-ledger-flag.test.tsx`: OFF conserva E2 actual, ON abre ledger, CTA retorna a guía.
- PostgreSQL `portfolio-bootstrap-goal-turn.integration.test.ts`: CAS de Anchor, origen idéntico y rechazo de ID/cita ajenos; usa Postgres desechable del job Node de CI.
- Suite regresión KAN-240 y QA real de Inicio→E1→E2 todavía requeridas antes de activar la bandera para usuarios.

## Riesgos abiertos y límites

- El gate de `PORTFOLIO_GOAL_E2_LEDGER_ENABLED` se administra en despliegue; no intentar sustituirlo por bandera cliente.
- B3 no es todavía un motor generativo ni decide prioridades contextuales mediante modelo. El planner B1/B2 sigue determinista.
- ADR-010 continúa con estado textual PROPUESTO y necesita ratificación formal para eliminar el gap de autoridad, incluso tras haber fusionado B2.
- La UI no sustituye una prueba productiva: revisión de navegación, accesibilidad, reentrada multi-tab, permisos y salida a E3 siguen pendientes antes de CD.
- La consistencia final entre ledger y Anchor pasa por el nuevo PATCH CAS y validación de recibo; una actualización externa conflictiva exige recarga.
