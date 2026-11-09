# Startería Portfolio Lead — UX-04 / B4-C1 Revisión del objetivo completo

Fecha: 2026-11-09.
Base: PR #284 HEAD 9b2bf382155d4ef02f37c9f589e429fdcc2fa530.
Estado: candidato en PR apilado. PR #281 y #284 aún abiertos contra sus respectivas bases; no en main.

## AS-IS
B3/UX-01 visualiza diferencias de una respuesta pendiente. UX-02 mejora corrección y recuperación; UX-03 permite historial completo. B4-A proyecta contexto y B4-B crea candidato semántico aislado, aún no vinculado a la interfaz. Para revisar el objetivo en conjunto, el usuario debía leer la ficha y localizar por separado la respuesta provisional en la conversación.

## Critique Nielsen
- #1 Visibilidad: dispersión entre la ficha, turnos y estados de adopción.
- #3 Control y libertad: se necesita revisar el conjunto antes de confirmar.
- #5 Prevención de errores: separar propuesta vs dato actual.
- #6 Reconocimiento: mostrar contexto, resultado, decisión y señal juntos.
- #8 Minimalismo: detalle completo bajo demanda en panel expandible.

## TO-BE implementado
- CTA accesible «Revisar objetivo completo» en ficha provisional de E2.
- Cuatro bloques: resultado, situación/contexto, decisión, indicador.
- Cada bloque distingue valor actual, cambio pendiente y respuesta antigua.
- Disposiciones unknown/not_applicable no se muestran como hechos, y outcome unknown no destruye el resultado actual.
- Alternancia expandir/ocultar con aria-expanded, sin escribir Anchor ni confirmar E2.
- Propuestas antiguas y reemplazadas quedan fuera del conjunto actual, manteniéndose en el ledger.

## Visual conceptual
AS-IS:
[Conversación: respuesta pendiente con diff aislado]  [Ficha: cuatro valores actuales]
TO-BE:
[Conversación] [Ficha: cuatro valores actuales]
               [Revisar objetivo completo]
               [Resultado: valor actual / propuesta]
               [Contexto: valor actual / propuesta]
               [Decisión: valor actual / propuesta]
               [Señal: valor actual / propuesta]
               [Confirmación humana permanece independiente]

## Limitación técnica actual
Este incremento NO hace batch writes ni activa conversación IA continua. El backend valida cada turno contra la pregunta/Anchor y versión; permitir varias respuestas independientes sin incorporación requiere un contrato de sesión, CAS de lote y tests concurrentes. B4-B candidato semántico sigue aislado de runtime/UI, no se representa como IA activa.

## Tests
- Puro: propuesta pendiente, turnos incorporados, reemplazados, stale y unknown.
- RTL: abrir/cerrar revisión sin POST/PATCH ni confirmación.
- Pendiente CI/QA autenticada, revisión independiente, pruebas de teclado y comparación visual con referencia HTML.

## No-regression
Inicio overview-first, E1 humano, esquema de Anchor, sourceRefs, idempotencia, E2/E3 gates, Step 0–4, flags OFF, ADR-010 pendiente y sin CD.
