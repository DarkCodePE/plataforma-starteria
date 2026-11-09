# KAN-253 B4-B — Candidato semántico E2, sin activación de runtime

**Fecha:** 2026-11-09
**Base:** rama UX-02 @ a33e2a0bffa8cf982216a502ff715d01d863381e, donde #282 y #283 están merged. PR #281 permanece abierto contra main.
**Estado:** implementación aislada en revisión; no integrada en producto ni en endpoints.

## AS-IS
- E1 confirmado, Anchor en borrador y ledger E2 tienen una proyección verificable en B4-A.
- La pregunta visible procede de `buildGoalQuestionPlan`, determinista y dependiente de la versión de Anchor.
- El usuario todavía necesita incorporar turnos uno a uno; no existe multi-turno provisional con un planner semántico gobernado.
- UX-01/02/03 mejoran comparación, recuperación e historial, pero no razonamiento cognitivo adaptativo.

## Critique UX Nielsen
- H1 Estado visible: el modelo no debe parecer haber validado contexto u objetivos.
- H3 Control y libertad: pregunta sugerida nunca modifica Anchor.
- H5 Prevención de errores: referencias a fuentes inexistentes o stale provocan fallback, no pregunta aplicada.
- H6 Reconocimiento: el razonador recibe contexto E1, Anchor y turnos actuales, evitando pedir al humano repetir respuestas.
- H7 Flexibilidad: puede terminar sin pregunta cuando ya existe claridad o se agota el budget.

## TO-BE implementado (B4-B1)
- Interfaz `proposeE2SemanticQuestion` sobre `StructuredModelAdapter` existente, con prompt EXCLUSIVO para E2 (no reutiliza E1).
- Output Zod estricto: pregunta singular contextual o stop/checkpoint. Permite estados `question_required`, `ready_for_human_review`, `insufficient_context`.
- Evidencia referenciada mediante ID y cita literal verificable de E1 confirmado, Anchor draft o turnos no stale.
- Budget de entrada explícito, máximo tres; cero obliga handoff humano sin consulta al modelo.
- El motor falla cerrado cuando el modelo está indisponible, no respeta schema o inventa una cita.
- Sin acceso a DB, no endpoints nuevos, no persistencia, no mutación de Anchor ni procesamiento productivo de tokens.
- Las pruebas se ejecutan con fake estructurado, no llamadas reales a un proveedor.

## AS-IS → TO-BE visual
AS-IS: [E1] + [Anchor] → planner fijo → pregunta → respuesta → incorporar → siguiente
TO-BE fase actual: [E1 confirmado] + [Anchor borrador] + [turnos vigentes] → planner E2 especializado + validación de procedencia → [pregunta candidata o checkpoint].
TO-BE posterior: pregunta candidata → controlador de sesión + versión + ledger → respuesta provisional → revisión acumulada → aceptación humana → Anchor.

## Criterios antes de activar B4-B2
1. Ratificación ADR-010, revisión de jerarquía Core y contrato de sesión E2.
2. Snapshot/versiones consistente en una transacción server-side para evitar mezclar lecturas concurrenciales.
3. Modelo de pregunta/answer nuevo compatible con appendTurn actualmente ligado al plan determinista.
4. Budget total de preguntas gobernado por backend, no contador cliente.
5. Fallback explícito y coste/timeout/circuit breaker con flag OFF.
6. Harness semántico con casos de cafetería, startup, corporativo, solución ya existente, no-work, unknown, corrección y reentrada.
7. Comportamiento UX: pregunta natural, recap breve, ficha provisional, ver propuesta de cambios, aceptación humana, recuperar conflicto.
8. CI completo, revisión independiente, QA navegador E1→E2 con ambas flags controladas.

## Limitaciones explícitas
- Este PR no cambia la UI ni autoriza afirmar que Copilot E2 ya conversa por IA.
- No compra tokens, no crea secretos ni habilita proveedor.
- No automatiza uptake del Anchor, decisiones, Front, Reto, Initiative o Step.
- No CD y no merge automático.
