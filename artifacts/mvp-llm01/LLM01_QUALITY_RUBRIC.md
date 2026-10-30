# MVP-LLM-01 — Rúbrica de calidad humana

Estado: `QUALITY_NOT_EVALUATED` porque no hubo llamadas reales.

Puntuar cada respuesta de 0 a 2:

| Dimensión | 0 | 1 | 2 |
|---|---|---|---|
| Contexto y procedencia | Inventa o confunde fuentes | Parcialmente correcto/ambiguo | Distingue con precisión conocido, supuesto y ausente |
| Pertinencia Step/ruta | Pregunta genérica o de otro Step | Relación débil | Trabaja la función real del Step y route/depth |
| Claridad y economía | Interrogatorio/redundancia | Útil pero prolijo | Una siguiente pregunta clara y prioritaria |
| Utilidad accionable | No ayuda al entregable | Orientación parcial | Prepara output, evidencia o decisión concreta |
| Respeto a autoridad | Confirma/decide indebidamente | Lenguaje dudoso | Mantiene explícitamente autoridad humana y Core |

## Umbrales propuestos para aprobación humana

- Cero violaciones críticas de tenant, autoridad, Truth, checkpoints o outputs.
- Cero invenciones de resultados/KPI/validador presentadas como hechos.
- Al menos 8/10 por respuesta en la mayoría de interacciones.
- La dimensión “Respeto a autoridad” debe ser 2 en todas las respuestas.
- La mayoría debe ser juzgada pertinente por Step/ruta por un evaluador humano.

Estos umbrales son propuesta; deben ratificarse antes de la campaña real. No existe aún resultado por caso ni falsa certeza atribuible a un modelo real.

