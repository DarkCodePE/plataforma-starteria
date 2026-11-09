# Startería Portfolio Lead — B4-C2C · UI consecutiva con checkpoint de revisión

Fecha: 2026-11-09
Base: rama PR #284 @49eb2d1161cda8123f3c76ec173d07afa65f657c (incluye PR #287)
Estado: implementación experimental en PR; sin merge a main ni CD.

## AS-IS real
- E2 muestra la pregunta server-owned y guarda un turno provisional con idempotencia.
- El frontend bloquea escribir otra respuesta cuando existe un turno pendiente; exige incorporación al Anchor antes de avanzar.
- B4-C2B ya planifica pregunta siguiente sobre turnos provisionales bajo flag backend OFF por defecto, pero la UI no lo consume como secuencia.
- B4-C1/C2A muestra resumen completo con acciones por campo, apto solo para respuestas individuales.

## Nielsen NN/g
1. Visibilidad de estado: claridad entre respuesta guardada, pregunta siguiente y objetivo en borrador.
3. Control y libertad: continuar conversando sin aceptar; inspeccionar propuestas.
5. Prevención de errores: la aceptación de un campo modifica versión de Anchor y podría invalidar otras respuestas provisionales.
6. Reconocimiento: el servidor recuerda las respuestas anteriores y decide la pregunta siguiente.
7. Flexibilidad y eficiencia: menos interrupciones de confirmación mientras se aclara el objetivo.
8. Minimalismo: resumen bajo demanda, no confirmación por cada turno.

## TO-BE implementado en este slice
- Nueva bandera FRONT `VITE_PORTFOLIO_GOAL_E2_MULTI_TURN_UI_ENABLED=true`, OFF por defecto; debe utilizarse exclusivamente junto con `PORTFOLIO_GOAL_E2_LEDGER_ENABLED=true` y `PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED=true` en backend.
- Al guardar un turno provisional, E2 pide el plan nuevo al backend (nunca inventa la siguiente pregunta).
- El bloqueo por turno pendiente se omite únicamente en modo experimental, manteniendo bloqueo de versión obsoleta, sesión y estado.
- Aparece número de respuestas pendientes y CTA `Revisar respuestas acumuladas` que abre la comparación de los cuatro campos.
- La revisión experimental es sólo lectura: no ofrece incorporación individual desde la ficha. La respuesta sigue provisional y `confirmAnchor` no se habilita con pendientes.
- Si guardar funcionó, pero la lectura de pregunta falla, no se reenvía el turno: se conserva, se comunica la situación y existe `Recuperar conversación`.
- Modo legacy (flag OFF) preservado.
- Pruebas React simuladas de continuidad sin Anchor writes y fallo recuperable.

## AS-IS → TO-BE
AS-IS: Pregunta → respuesta provisional → incorporar → siguiente.
TO-BE: Pregunta → respuesta provisional → siguiente pregunta del servidor → más turnos → revisión completa (sin escritura).

## Riesgo bloqueante para activar UX en producción
Este slice NO implementa la adopción conjunta. Los turnos se registran y son revisables, pero no se pueden incorporar en una sola transacción aún. La UI muestra el estado experimental para no dar una falsa sensación de finalización.
Además, en modo multi-turno, la corrección de una respuesta anterior requiere una operación propia en backend (la pregunta activa evoluciona). No simular corrección de turnos anteriores con un questionId stale.

## Próximo B4-C2D
- Contrato de commit por selección de campos/turnos y snapshot CAS de Anchor + ledger + E1.
- Mismo tenant, owner, provenance, resultados de unknown, exclusiones retractadas, chequeo de duplicate receipt e idempotencia.
- Corrección de respuestas previas con nuevo turno versionado, no alteración de hecho canónico.
- Rehidratación después de cambios de contexto y múltiples pestañas.
- El cierre y avance E2→E3 se habilitará solo tras aceptar formalmente un borrador suficiente.

## Gates
Typecheck, CI, QA navegador con flags ON en entorno controlado y revisión independiente. ADR-010 aún pendiente. No CD ni merge automático.
