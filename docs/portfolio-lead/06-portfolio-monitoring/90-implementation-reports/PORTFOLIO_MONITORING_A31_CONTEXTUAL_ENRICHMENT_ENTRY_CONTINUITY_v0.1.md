# Portfolio Monitoring — A.3.1 Contextual Enrichment & Entry Continuity

**Estado:** IMPLEMENTED LOCALLY / PENDING REVIEW  
**Branch:** `feat/portfolio-monitoring-product-definition`  
**Base SHA:** `d6c2091`

## Resultado

Se conserva A.3 y se refina el primer valor de Portfolio Lead para pedir solo contexto
material, mantener la continuidad de Portfolio Entry y escalar la lectura de relaciones.

## Archivos modificados

- `front/src/features/portfolio-lead/first-value/PortfolioLeadFirstValuePage.tsx`
- `front/src/features/portfolio-lead/first-value/__tests__/PortfolioLeadFirstValuePage.test.tsx`
- `front/src/features/portfolio-lead/first-value/__tests__/PortfolioLeadFirstValuePage.entry.test.tsx`
- `front/src/features/portfolio-entry/home/portfolioHomeEntryContextClient.ts`
- este implementation report

## Entry directo

Conserva la secuencia objetivo → contexto opcional → trabajo existente → análisis. P1 usa
orientación específica y empática, permite continuar sin responder y no comunica carencia de
información antes de analizar el trabajo.

## Portfolio Entry path

Cuando la continuación trae un outcome o necesidad suficiente, setup precompleta ese objetivo y
converge directamente en P2. No vuelve a preguntar “¿Qué quieres conseguir?”. La pantalla muestra
el contexto heredado y, si existe un extracto de trabajo, permite revisarlo, añadir información o
continuar. Se añadió `arrival.existingWork` como campo opcional de lectura; no se cambió backend.

## Contextual enrichment

Antes de P2 no se creó un formulario. La orientación permite aportar producto, área/proceso,
situación de partida y áreas involucradas. La implementación no agrega preguntas obligatorias;
por tanto queda dentro del presupuesto máximo de 1–2 preguntas antes de P2.

Después de P2, cuando hay más de una excepción, aparece una única pregunta ad hoc que puede
aclarar varias iniciativas sobre si pertenecen a la estrategia actual o a otra prioridad.

## Strategic Framing

La lectura sigue siendo progresiva: intención, resultado/horizonte disponible, contexto,
señales y drivers implícitos en el trabajo. No se introduce Balanced Scorecard ni una taxonomía
obligatoria, y no se crean Retos automáticamente.

## Relationship summary / exception-first

P3 resume primero el total y separa relaciones claras, por revisar y posible mejor encaje. Las
relaciones claras no generan acción. El primer detalle solo muestra excepciones; el inventario
completo se abre bajo demanda. “Posible mejor encaje” solo sugiere que la iniciativa puede
responder más directamente a otra necesidad: no mueve, reasigna ni crea Frentes.

## 20+ initiatives

El fixture ampliado de 24 iniciativas renderiza inicialmente 2 excepciones y no 24 cards. La
acción secundaria “Ver las 24 iniciativas” permite explorar todo el detalle. No hay ranking,
porcentaje ni alignment score.

## Tests

Actualizados:

- entry directo y convergencia a P2;
- continuidad de Portfolio Entry y no-repeat de intención;
- contexto opcional y ausencia del copy anterior;
- relationship summary y exception-first;
- comportamiento de 24 iniciativas bajo demanda;
- ausencia de confirmación iniciativa por iniciativa;
- ausencia de alignment score y reasignación automática;
- frontera limpia antes de P4.

## Verificación

- `rtk npm run typecheck:front`: PASS.
- Tests focales de First Value y Entry: PASS tras actualizar la expectativa al resumen
  exception-first (6 tests + 1 test de continuidad).
- E2E: intentado con `rtk npx playwright test e2e/portfolio-lead-first-value.spec.ts --project=chromium`;
  no pudo ejecutarse porque `http://localhost/portfolio/setup` devolvió `ERR_CONNECTION_REFUSED`
  (no había servidor Vite escuchando).

## Deviations

- La relación concreta sigue siendo determinista sobre el fixture A.3; no se creó un analizador
  backend ni un contrato nuevo.
- El contexto heredado de trabajo es opcional porque el endpoint actual no lo expone siempre.

## Remaining gaps

- Persistencia real de respuestas a preguntas ad hoc queda fuera de este prototipo.
- P4 Relationship Review completo permanece fuera de alcance.

## Scope confirmation

```text
P4 implemented: NO
Balanced Scorecard made mandatory: NO
individual initiative confirmation required: NO
alignment scoring added: NO
automatic reassignment added: NO
backend changed: NO
Core changed: NO
Steps changed: NO
Portfolio Handoff changed: NO
```
