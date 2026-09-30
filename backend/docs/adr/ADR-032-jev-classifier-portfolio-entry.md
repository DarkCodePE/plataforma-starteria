# ADR-032: Jev como único clasificador de Portfolio Entry

## Status

Proposed — 2026-09-30. Implementado detrás de `PORTFOLIO_ENTRY_CLASSIFIER` (valor por defecto
`llm`, que deja todo como estaba). Pasa a Accepted cuando el responsable funcional apruebe la
regla de `unknown` y los umbrales se validen con casos reales ([KAN-75](https://stateria.atlassian.net/browse/KAN-75)).

Extiende a Portfolio Entry el criterio de ADR-031 (`Accepted — 2026-09-20`), que hoy solo rige
en el `ai-service`.

## Contexto

Portfolio Entry vive en el backend (`backend/modules/portfolio-entry-runtime`) y un solo LLM
(`openai/gpt-5.6-luna`) hace todo: clasifica `entry_state` e intent, extrae contexto, planea
preguntas y resume. Jev no participaba.

Clasificar es elegir dentro de un vocabulario cerrado, que es lo que Jev hace bien
(`docs/analisis-jev/99-donde-no-aplica.md`). Extraer, preguntar y resumir no lo es.

## Decisión

1. Con `PORTFOLIO_ENTRY_CLASSIFIER=jev`, **Jev es el único que clasifica**, en cada turno.
   Si clasificaran los dos, habría dos respuestas que pueden no coincidir y ninguna regla para
   decidir cuál manda.
2. El LLM recibe la clasificación en `classification` como dato fijo. Los cuatro campos
   (`initial_entry_state`, `current_frame`, `primary_intent`, `secondary_intents`) no están en
   su esquema de salida: no puede devolverlos aunque quiera. La instrucción de clasificar
   (skill 01) se reemplaza por `prompts/v0.2/classification-provided.md`.
3. Debajo del umbral, el campo queda `unknown` y el LLM pregunta en vez de adivinar
   (doc/entry-01 ID-02 "no forzar precisión", ID-03 "`unknown` es válido").
4. Intents secundarios: una pregunta sí/no por intent en la misma llamada; se aceptan con
   puntaje ≥ 0,9.
5. En turnos de seguimiento `initial_entry_state` no cambia. Si Jev no alcanza el umbral con
   una respuesta corta ("unidades"), se conserva la clasificación anterior.
6. Si Jev falla (red, cuota, clave), el turno sigue con la clasificación en `unknown`. Si falta
   `JEV_API_KEY` al arrancar, el backend lo registra y clasifica el LLM.

Umbrales (`agent/jev-classifier.ts`, `JEV_THRESHOLDS`): `entry_state` 0,5 · intent 0,7 ·
secundario 0,9. **Sin calibrar**: salen de los 26 casos del AI Harness.

## Evidencia (2026-09-30)

Los 26 casos de `doc/PORTFOLIO_ENTRY_AI_HARNESS_v0.1.md`, corridos localmente con el runtime
de producción. Solo cuentan los casos donde el contrato dice qué etiqueta espera.

| | Solo Luna | Jev + Luna |
|---|---|---|
| `entry_state` correcto | 12/16 | **14/16** |
| Intent correcto | 10/14 | 10/14 |
| Intent equivocado con confianza | 4 (B02, B03, C01, F02) | **1** (D01) |
| Latencia mediana del turno | 10,3 s | **8,4 s** |
| Violaciones del controlador | 0 | 0 |

## Consecuencias

- **Muchos más `unknown`.** 14 de 26 casos terminan con `entry_state` o intent en `unknown`.
  En los casos de solución (B03, B04, F01, F02, G01) Luna antes acertaba a veces
  `initiative_governance`; ahora queda `unknown`. En todos, la pregunta que hace Luna sigue
  siendo la correcta (pide el problema o resultado de negocio), pero la clasificación que se
  guarda y se muestra es menos específica.
- **E02 pierde el intent principal** (quedó `unknown`; Luna sola decía `portfolio_reporting`).
- **D01** ("Necesito ordenar esto") sigue siendo un error dicho con confianza alta (0,93).
- **No determinismo cerca del umbral.** G03 dio `decision_first` con 0,52 en una corrida y
  `unknown` en otra.
- Todo lo anterior se corrige con **casos nuevos**, no ajustando criterios contra estos 26:
  si se ajusta contra la suite, el puntaje sube y deja de medir.

## Rollback

`PORTFOLIO_ENTRY_CLASSIFIER=llm` (o quitar la variable) y reiniciar el backend. No hay
migración de datos: la clasificación se guarda igual en los dos modos.
