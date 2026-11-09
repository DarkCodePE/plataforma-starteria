# Goal 02 · Evidencia UX E2: descubrimiento del checkpoint final

**Fecha:** 2026-11-09. **Base:** main@59dfe8a59a54d192c2e7585c3728fe8eb2035d6d. **Estado:** slice implementado y sujeto a CI/QA, no implica Goal 02 DONE.

## Problema AS-IS comprobado en código
El planificador E2 puede devolver `activeQuestion:null` cuando las respuestas provisionales cubren las preguntas. La UI muestra el botón «Revisar objetivo completo», pero su sección empieza cerrada (`showGoalReview=false`). La persona puede quedar sin pregunta y sin orientación clara para finalizar. En una reentrada vuelve a quedar oculto.

## TO-BE codificado
- Cuando el servidor termina preguntas y hay propuestas activas aún no resueltas, abrir automáticamente la sección de revisión E2 **solamente** con ambas banderas frontend de multi-turn/checkpoint ON.
- Mostrar indicación concreta: revisar qué incorporar o dejar fuera. Nada se acepta automáticamente.
- Conservar la decisión humana por respuesta, operación de checkpoint separada, CAS/recibos, confirmación final de Anchor y permisos backend intactos.
- En reentrada aplicar la misma condición tras leer plan y ledger; excluir retractados, superseded y recibos aceptados/descartados.
- No autoabrir cuando continúan preguntas o no hay propuestas.

## Nielsen NN/g
- H1 Visibilidad: indicar «conversación lista para revisión» y próximo paso.
- H3 Control: ninguna aceptación/autoconfirmación.
- H5 Prevención de errores: botón aplicar deshabilitado sin decisiones para cada respuesta.
- H6 Reconocimiento: recuperación de revisión sin recordar donde se encuentra.
- H8 Minimalismo: se abre solo al converger, no durante preguntas activas.
- H9 Recuperación: reentrada recupera estado sin nuevo turno.

## AS-IS → TO-BE visual
AS-IS: Pregunta final → guardar → sin nueva pregunta → botón «Revisar objetivo completo» cerrado → usuario debe adivinar siguiente acción.

TO-BE: Pregunta final → guardar → plan sin pregunta + respuestas pendientes → revisión visible y texto «elige qué incorporar» → selección humana → checkpoint atómico → confirmación humana → E3.

## Tests agregados
- El servidor termina las preguntas y el resumen se abre sin mutaciones automáticas.
- Reentrada con turno pendiente y plan completo abre revisión sin guardar ni aplicar ninguna respuesta.
- Revisión no habilita `Aplicar decisiones` hasta elegir aceptación/rechazo.
- Regresión existente sobre modo legacy flags OFF se mantiene.

## Límites del Goal
- No afirma tests manuales reales ni validación visual de navegador.
- No activa banderas. ADR-010 continúa PROPUESTO hasta ratificación.
- El candidato semántico E2 B4-B sigue sin runtime LLM.
- Faltan pruebas reales de los 3 perfiles en Inicio/E1/E2/E3, accesibilidad y contraste/jerarquía visual, Nielsen H1–H10, reentrada multitab y errores de servidor.
- No cerrar G02 por este PR. Agrupar findings posteriores bajo issue #292.
