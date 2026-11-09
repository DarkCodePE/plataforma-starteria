# Portfolio Lead UX Increment 01 — E2 Review Control

Estado: implementación candidata en PR, no aprobada para despliegue. Fecha: 2026-11-09.
Referencia visual: STARTERIA_PORTFOLIO_LEAD_COPILOT_FIRST_v1.0.html.
Base: main@8926e253546c59ef6004735bff1e80ca4bf215a9.

## AS-IS
B3 muestra pregunta de Objetivo, historial persistido, respuesta provisional y los botones de incorporación/corrección. El usuario debía decidir incorporar sin ver una comparación explícita del valor actual y el valor resultante. La edición de una respuesta pendiente no ofrecía cancelación específica; debía terminar escribiendo/guardando o salir del flujo.

## Heurísticas NN/g
- #3 User control and freedom: riesgo alto en una corrección sin salida contextual clara.
- #5 Error prevention: dificultad para predecir el efecto de incorporar una respuesta.
- #1 Visibility of system status: el objetivo confirmado, el borrador y el turno provisional son estados distintos.
- #6 Recognition rather than recall: comparar valores sin tener que recordarlos.

## TO-BE implementado en este incremento
1. Una respuesta pendiente presenta comparación explícita de Valor actual vs Después de incorporar para el campo correspondiente.
2. Unknown/not_applicable indica que conservará incertidumbre; no inventa una meta o KPI.
3. La vista explica que la incorporación afecta el borrador, nunca confirma automáticamente el objetivo.
4. Cancelar corrección regresa a la respuesta provisional sin registrar otro turno.
5. No cambia motor de preguntas, modelo canónico, CAS, idempotencia, E1, ni gating E2/E3.

## Validación requerida
- RTL: previsualización antes de escribir Anchor, cancelación sin escrituras, unknown sin sobrescribir resultado.
- Regresión de corrección, aceptación explícita, reentrada, fallback de flags.
- Typecheck frontend/backend, CI y QA navegador autenticado con ambas flags ON en entorno controlado.
- ADR-010 sigue PROPUESTO. Este PR no lo ratifica ni habilita flags/CD.

## Próximos incrementos propuestos
- UX-02: revisión de diferencias para respuestas de múltiples campos sin convertir chat en sistema de registro.
- UX-03: mejora de persistencia y salida del modo de corrección, error stale y reentrada.
- B4 separado: planificador semántico contextual, contract-first.

## Política de evaluación por incremento
AS-IS documentado → critique heurística → TO-BE visible → pruebas del control humano → PR → QA real → decisión de rollout.
