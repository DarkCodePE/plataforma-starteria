# Portfolio Lead UX-02 — Control de respuesta y recuperación E2

Fecha: 2026-11-09
Base: main@dfd1ac44bf6e21ff56f2c5de14326e0b687a5358
Estado: candidato para revisión, NO CD ni activación productiva.

## AS-IS
- B3 y UX-01 presentan ledger persistido y comparación antes/después.
- Al elegir «No lo sé todavía» o «No aplica» y luego editar manualmente el texto, la disposición seguía marcada como desconocida/no aplicable salvo pulsar «Respuesta propia».
- La respuesta pendiente de otra versión mostraba una advertencia sin CTA de recuperación contextual.
- La ficha mostraba el número de turnos pero no un estado de revisión resumido.

## Nielsen Norman heurísticas y problema
- #3 Control y libertad: recuperar una discrepancia de versión y corregir sin rutas ocultas.
- #1 Visibilidad del estado: el estado de revisión debe ser legible sin interpretar el ledger.
- #5 Prevención de errores: editar manualmente una respuesta desconocida no puede enviarse de forma silenciosa como unknown.
- #6 Reconocimiento antes que recuerdo: la ficha debe mostrar si existe un turno pendiente, una versión anterior o revisión final.

## TO-BE implementado
- La edición manual cambia la disposición local a user_declared; unknown/not applicable deben seleccionarse explícitamente de nuevo.
- La clasificación exacta de la respuesta se anuncia como estado visible antes de guardar.
- Las versiones stale conservan historial y ofrecen «Recuperar estado actual» (lectura sin escritura) o volver a preparación guiada.
- La ficha resume si hay respuesta pendiente, discrepancia de versión, cambio incorporado o confirmación disponible.

## Límites intencionales
- No permitir encadenar preguntas con respuestas aún no incorporadas: el planner de B1 sigue vinculado a versión de Anchor.
- No crear API de descarte/retractación ni escritura compuesta sin contrato.
- No alterar persistencia, CAS, idempotencia, gates E2/E3, flags (OFF), Step 0–4.
- ADR-010 pendiente ratificación; no merge/CD automático.

## Verificación
- RTL: unknown seguido de edición → user_declared; stale → rutas de recuperación sin escritura.
- CI TypeScript, Vitest, regresión B3/UX-01, PostgreSQL y navegador autenticado por verificar.
- QA interactivo: retomar, responder, corregir, modo unknown, reentrada stale, doble pestaña, confirmación humana.

## Siguiente UX-03 / B4
Para una conversación que acumule varias respuestas provisionales sin adoptarlas una por una, primero se necesita definir contract de plan/contexto E2 sobre el ledger y prueba de CAS en backend. B4 semántico podrá razonar con respuestas provisionales sin convertirlas en Anchor por inferencia. Visualizar propuesta de cambios acumulados antes de un único checkpoint humano.
