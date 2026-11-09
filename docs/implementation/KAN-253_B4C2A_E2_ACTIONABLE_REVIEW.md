# KAN-253 B4-C2A — Revisión integrada accionable E2

**Fecha:** 2026-11-09
**Base:** feat/portfolio-e2-b4b-semantic-question-candidate@5e27ad1e1c73d798355a8e98007068368bea624d
**Alcance:** interfaz E2, sin cambio de contratos ni backend.
**Dependencias:** PR #281 abierto contra main; PR #284 abierto contra UX-02; PR #285 merged en #284.

## AS-IS confirmado
B4-C1 permite desplegar cuatro campos del objetivo y observar las respuestas que podrían modificarlos. Pero para actuar sobre un cambio la persona debía regresar a la conversación, localizar la respuesta y pulsar allí «Incorporar al borrador» o «Corregir respuesta».

## Nielsen critique
- H3 Control y libertad: revisión con acciones contextualizadas.
- H6 Reconocer antes que recordar: no obligar a volver a localizar la respuesta en historial.
- H7 Flexibilidad y eficiencia: reducir navegación innecesaria.
- H5 Prevención de errores: adoptar un campo concreto con una operación explícita.
- H1 Visibilidad de estado: cambios pendientes siguen distintos del Anchor.

## TO-BE implementado
Dentro de «Revisar objetivo completo», cada fila con una respuesta provisional vigente ofrece:
1. **Incorporar este cambio:** usa exactamente `incorporate(pending)`, pasando por `createGoalLedgerAnchorProposal` y `onSave`, con recibo y CAS existentes.
2. **Corregir propuesta:** abre edición con el texto/disposición original y cierra el panel de resumen, sin escribir todavía.
3. La acción no se muestra para respuestas stale, incorporadas, rechazadas/retractadas o campos sin propuesta.
4. Confirmar objetivo permanece independiente y bajo suficiencia del Anchor.

## Visualización
AS-IS:
[Resumen con actual/propuesto] → volver al chat → buscar respuesta → incorporar/corregir.

TO-BE:
[Resumen con actual/propuesto]
    ↳ [Incorporar este cambio] → updateAnchor humano y verificado
    ↳ [Corregir propuesta] → editar sin escritura → guardar nuevo turno versionado

## Lo que sigue pendiente (B4-C2B)
La conversación multirespuesta antes de incorporar requiere extender el modelo servidor: plan activo, versionado de turnos, presupuesto de preguntas, elección semántica y operación CAS para revisar varias respuestas. No se simula en frontend porque hoy `appendGoalTurn` valida cada turno contra la pregunta activa que deriva del Anchor, y exige `supersedesTurnId` en una corrección.

Contrato previo:
- las respuestas nuevas continúan `UNREVIEWED`;
- ninguna interpretación IA se eleva automáticamente a hecho, KPI o objetivo;
- los turnos concurrentes quedan gobernados por CAS, permisos e idempotencia;
- las preguntas tienen stopping rule y no repiten datos;
- checkpoint permite aceptar/corregir/rechazar por campo;
- no Steps, proyectos o decisiones automáticas.

## Criterios de QA
- Desde resumen, incorporar solo la respuesta elegida y comprobar `onSave` una vez.
- Desde resumen, corregir y cancelar sin escrituras.
- Con respuesta antigua/no vigente no ofrecer incorporación.
- Regresión de UX-01/02/03 y B4-C1.
- Typecheck, Vitest/CI, QA navegador y revisión independiente antes de merge.
- Flags por defecto OFF, ADR-010 propuesto, sin CD.
