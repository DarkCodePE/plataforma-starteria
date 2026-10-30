# MVP-LLM-01 — Evaluación humana

Estado: `HUMAN_EVALUATION_NOT_RUN / LLM01_GATES_BLOCKED`.

No existe salida de modelo real que pueda evaluarse de forma honesta. La HVA técnica previa de UX-03B permanece pendiente de ratificación formal y el teclado virtual físico no fue probado.

## Evidencia disponible sin LLM real

- Persistencia y orden de conversación con stub.
- Retry/fallback explícito sin texto inventado.
- Reentrada, reload y viewport móvil automatizado.
- Ausencia de cambios en checkpoints, Truth, outputs, Cycle y progreso por conversar.
- Aislamiento Project/tenant y actor derivado por servidor.

## Revisión futura requerida

Tras aprobar L0, dos personas deben revisar transcripciones anonimizadas: una responsable de producto y otra con responsabilidad de seguridad/autoridad. Deben aplicar `LLM01_QUALITY_RUBRIC.md`, registrar violaciones críticas por separado y no usar el propio LLM como único juez.

`REAL_MOBILE_KEYBOARD_NOT_RUN` debe mantenerse como limitación hasta probar Android/iOS real en un entorno seguro.

