# Portfolio Monitoring — Slice A.3 First-Value Narrative Refinement

## Alcance

Implementación front-only de la refinación narrativa P0–P3 definida por `STARTERIA_PORTFOLIO_LEAD_SLICE_A3_FIRST_VALUE_NARRATIVE_REFINEMENT_v0.2.md`. Se conservaron routing, role gating, continuidad de Portfolio Entry y navegación focused de A.2.

## Cambios

- P0: CTA orientado al beneficio y drawer reutilizado con modo first-time y explicación breve del asistente.
- P1: se mantuvo la pregunta abierta y se añadió un checkpoint contextual opcional con como máximo dos preguntas adaptativas.
- P2: guía sobre qué aportar, ejemplos discretos, upload secundario no disponible y continuación explícita sin archivo.
- P3: lectura reordenada como contexto entendido, distribución, señales, relación iniciativa–objetivo y siguiente paso.
- Provenance: se muestra de forma compacta como “Basado en lo que compartiste”; no se repite en cada bloque.
- Relationship states: `Relación clara`, `Relación probable`, `Por revisar`, `Posible mejor encaje` y `Sin contexto suficiente`.
- “Posible mejor encaje” se presenta como señal para decisión humana; no mueve, crea ni reasigna iniciativas automáticamente.
- Reconciliation: cada iniciativa detectada aparece en la relación iniciativa–objetivo; la lectura ampliada contabiliza las 24 entradas.
- Boundary P4: el CTA termina en un mensaje de primera parte completada; no se implementó Relationship Review.

## Fuente y límites

La lectura continúa usando el fixture/read model determinista existente de First Value. No se creó dominio, schema, endpoint ni fuente de usuario nueva. La ruta autenticada sigue entregando el nombre real al componente y usa fallback seguro sin email.

El camino sin archivo no inventa iniciativas: muestra una lectura con cero iniciativas hasta que el Portfolio Lead aporte contexto adicional.

## Verificación

- Tests de First Value y continuidad Entry: 7 tests pass.
- Suite front: pass.
- Typecheck front y backend: pass.
- Playwright `portfolio-lead-first-value.spec.ts`: 2 tests pass.
- Se conserva la cobertura A.2 de role routing, focused navigation, loading/error y Entry continuation.

## Desviaciones y deuda conocida

- El estado “Posible mejor encaje” se deriva de la información disponible en el fixture actual; la revisión humana posterior queda fuera de P4.
- El upload sigue siendo un affordance informativo (“Disponible próximamente”), sin backend ni persistencia.
- Quedan funciones legacy no alcanzables por el flujo A.3 para preservar compatibilidad con A.2; no se muestran al usuario.

## Fuera de alcance confirmado

P4, Slice B, backend, Core, Steps, Portfolio Handoff, migrations, IA productiva, scoring de alignment y reasignación automática.
