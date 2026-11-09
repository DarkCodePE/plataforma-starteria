# B4-C2B — Planificación de preguntas a partir de turnos provisionales

Fecha: 2026-11-09.
Base: rama #284 @14ed997b129fe486969c78c96db5cc1fd80181ec, incorpora #285 y #286.
Dependencias: PR #281 y #284 aún abiertos contra sus ramas base. #286 merged en #284.

## AS-IS confirmado
El GET objective/plan y POST objective/turns usan el planner determinista sobre el Anchor, y cada respuesta provisional requiere incorporación antes de que cambie la pregunta activa. Esto causa demasiados clics e interrumpe el flujo de conversación. La UI B4-C2A mejora la revisión por campo pero NO resuelve la restricción de secuenciación.

## Nielsen
H1: visibilidad de respuestas provisionales vs aceptadas;
H3: control humano, sin incorporación automática;
H5: validar versiones y preguntas vigentes;
H6: no repreguntar datos ya declarados;
H7: secuencia más eficiente antes de checkpoint.

## TO-BE implementado (backend opt-in)
- Helper puro buildProvisionalGoalQuestionPlan usa únicamente turnos de misma sesión, versión Anchor, no retractados/sustituidos ni incorporados.
- Projection temporal para seleccionar la siguiente pregunta: ningún dato se escribe en Anchor.
- Unknown/not_applicable produce incertidumbre declarada en el plan, no un hecho ni un KPI.
- El ID de la pregunta incluye versión ledger para invalidar clientes stale.
- Con PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED=true y el ledger habilitado, GET objective/plan y POST objective/turns usan el mismo mecanismo de planificación.
- POST sigue bajo transacción Serializable, permisos, CAS esperado, idempotencia y pregunta servidor vigente.
- La bandera está OFF por defecto y el comportamiento legado permanece intacto cuando está OFF.
- No nueva tabla, migración ni proveedor de IA.

## Visual AS-IS → TO-BE
AS-IS:
Pregunta 1 → guardar provisional → incorporar al Anchor → pregunta 2 → guardar provisional → incorporar...

TO-BE de este backend:
Pregunta 1 → guardar provisional → planner lee turno vigente → pregunta 2 → guardar provisional → ...
                                  ↓
                          revisión humana final por campos

## Límites y validaciones pendientes
- La UI B3 todavía bloquea nuevas respuestas cuando hay una pendiente. La conexión UI y un checkpoint con operaciones explícitas son el siguiente slice B4-C2C.
- El planner de este slice es determinista enriquecido por turnos, NO LLM semántico live. El candidato B4-B continúa aislado.
- No hay aceptación en lote ni corrección de un turno anterior desde el nuevo modo todavía.
- La respuesta provisional sigue etiquetada como tal; las respuestas no aceptadas no son hechos canónicos.
- El contrato ADR-010 sigue PROPUESTO; no activar el nuevo modo en producción hasta su ratificación, revisión de seguridad y QA E2E autenticado.
- Necesaria revisión de consistencia entre GET y POST durante cambios de E1 y multi-tab, más pruebas de regresión.
- No merge/CD automático.

## Tests
Unit: siguiente pregunta basada en provisional, unknown, supersede/retract, stale, stop, sesión ajena.
PostgreSQL HTTP: dos respuestas consecutivas sin mutar Anchor, rechazo pregunta antigua, acceso con flag y CAS.
CI completo y revisión independiente pendientes.
