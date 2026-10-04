# Starteria — Skill Contract: entry-04-question-planner

**Documento:** `SKILL_v0.2.md`
**Skill ID:** `entry-04-question-planner`
**Versión:** v0.2
**Estado:** PROPUESTO PARA TESTING
**Fecha:** 2026-09-10
**Tipo:** Skill Contract
**Agente padre:** Portfolio Entry Agent / Orchestrator
**Vertical slice:** Portfolio Entry

---

## 0. Autoridad

Este skill está subordinado a:

1. `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md`
2. ADRs aprobados
3. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
4. `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
5. `entry-01-intent-detection/SKILL_v0.2.md`
6. `entry-02-context-extraction/SKILL_v0.2.md`
7. `entry-03-reverse-alignment/SKILL_v0.2.md`

Además, este skill puede recibir **contexto de sesión** desde:

`PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`

Ese contrato gobierna modo, budget acumulado, checkpoints y handoff.
Este skill gobierna únicamente **qué preguntas conviene hacer en la ejecución actual**.

---

## 0.1. Cambios desde v0.1

Esta versión incorpora hallazgos derivados del testing de Portfolio Entry.

Cambios contractuales:

- mantiene `questions[]` por compatibilidad, pero retorna `0..1` pregunta user-facing por turno;
- deja explícito que el skill debe respetar el budget disponible que le entregue el session controller;
- soporta dos contextos de uso:
  - `quick_clarification`;
  - `guided_exploration`;
- Quick Clarification prioriza únicamente aclaraciones críticas;
- Guided Exploration puede profundizar, pero solo sobre un objetivo explícito aceptado por el usuario;
- evita repetir preguntas ya realizadas o gaps ya respondidos;
- refuerza el stopping rule;
- mantiene la frontera con Step 0 / Step 2;
- permite devolver 0 preguntas incluso dentro de Guided Exploration si el propósito de la ronda ya quedó suficientemente resuelto.

### Trazabilidad de findings

- `FND-004` — términos de éxito/calidad relevantes pueden quedar subdefinidos;
- `FND-006` — el límite de preguntas puede interpretarse erróneamente por turno en una conversación extensa;
- `FND-008` — riesgo de Step leakage al profundizar demasiado;
- `FND-009` — riesgo de mezclar inferencia/recomendación con contexto declarado.

La hipótesis `quick_clarification + guided_exploration` se define en:

`PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`

y debe validarse en Harness v0.2 antes de congelarse como comportamiento estable.

---

## 1. Propósito

Seleccionar las **mínimas preguntas de mayor valor** para la ejecución actual, respetando:

- el modo de interacción;
- el objetivo de la ronda;
- el budget disponible;
- lo ya preguntado;
- lo ya respondido;
- la frontera de Portfolio Entry.

Debe responder:

> ¿Qué conviene preguntar ahora para reducir la incertidumbre más importante, con la menor fricción posible y sin repetir trabajo?

El skill no busca maximizar información.

Busca maximizar:

```text
valor de información
÷
fricción
```

---

## 2. Input

Input recomendado:

```text
raw_input
initial_entry_state
current_frame
primary_intent
secondary_intents
extracted_context
ambiguities
contradictions
missing_obvious_context
reverse_alignment_result
provenance

interaction_mode
available_question_budget
previous_questions
answered_gaps
exploration_goal
```

### Campos de sesión

`interaction_mode`:

- `quick_clarification`
- `guided_exploration`

`available_question_budget`:

```text
0..3
```

El presupuesto total puede ser 0..3, pero el output productivo de un turno nunca supera una pregunta.

Lo calcula y entrega el session controller.

`previous_questions`:

preguntas ya realizadas en la sesión/ronda para evitar repetición.

`answered_gaps`:

gaps que el usuario ya aclaró.

`exploration_goal`:

solo aplica a `guided_exploration`.

Ejemplo:

```text
clarificar qué significa “innovar más”
```

o:

```text
entender qué decisión debe habilitar el programa
```

---

## 3. Output conceptual

```text
QuestionPlan
├── questions
│   ├── id
│   ├── question
│   ├── question_type
│   ├── reason_to_ask
│   ├── resolves
│   ├── priority
│   └── expected_answer_type
├── question_count
├── stop_reason
├── unresolved_but_noncritical
└── status
```

### `status`

- `questions_required`
- `no_questions_required`
- `insufficient_input`

### `question_type`

- `clarification`
- `disambiguation`
- `critical_gap`
- `reverse_alignment`
- `guided_deepening`

`guided_deepening` solo puede utilizarse cuando:

```text
interaction_mode = guided_exploration
```

y existe un `exploration_goal` explícito.

---

## 4. Regla de budget

El skill nunca puede producir más preguntas que el budget recibido.

Regla:

```text
question_count <= min(1, available_question_budget)
```

Ejemplos:

```text
available_question_budget = 3
→ output posible: 0 o 1
```

```text
available_question_budget = 1
→ output posible: 0 o 1
```

```text
available_question_budget = 0
→ question_count = 0
```

El skill no aumenta ni renueva el budget.

---

## 5. Quick Clarification

Cuando:

```text
interaction_mode = quick_clarification
```

las preguntas deben limitarse a:

- contradicciones materiales;
- ambigüedades que cambien intent/frame;
- gaps críticos de reverse alignment;
- condiciones de éxito/guardrails realmente materiales;
- decisión que se necesita habilitar.

No utilizar Quick Clarification para:

- profundizar por curiosidad;
- obtener completitud metodológica;
- diseñar el proceso completo;
- explorar todas las alternativas.

Principio:

> Quick Clarification busca suficiente claridad para orientar, no comprensión exhaustiva.

La pregunta elegida debe ser la única de mayor prioridad entre los gaps materiales no resueltos y debe poder cambiar materialmente el recommended approach, el decision framing, la Starteria path o la work sequence. No hacer batching.

---

## 6. Guided Exploration

Cuando:

```text
interaction_mode = guided_exploration
```

el skill puede profundizar sobre un `exploration_goal` explícito.

Ejemplo:

```text
exploration_goal =
entender qué quiere conseguir realmente el usuario cuando dice “innovar más”
```

Preguntas permitidas pueden explorar:

- qué cambio quiere provocar;
- dónde siente la fricción;
- qué decisiones necesita tomar;
- qué alternativas ya considera;
- qué restricciones cambian el abordaje.

Pero Guided Exploration no autoriza:

- consultoría ilimitada;
- diseño detallado de experimentos;
- business case completo;
- definición de Steps.

---

## 7. Regla de foco en Guided Exploration

Toda pregunta debe poder responder:

> ¿Cómo ayuda esta pregunta a resolver el `exploration_goal` de esta ronda?

Si no existe respuesta clara:

```text
no preguntar
```

No usar Guided Exploration para abrir nuevas líneas sin relación con el propósito aceptado.

---

## 8. No repetición

Antes de generar una pregunta, revisar:

```text
previous_questions
answered_gaps
extracted_context
```

No volver a preguntar:

- lo ya declarado;
- lo ya respondido;
- la misma pregunta reformulada;
- un gap ya suficientemente resuelto.

Una respuesta explícita como “No lo sé todavía” cuenta como pregunta respondida, no como gap resuelto, y no habilita repetir la misma pregunta.

Si una respuesta anterior fue ambigua, puede reformularse solo si la ambigüedad sigue siendo material.

---

## 9. Prioridad de información

Orden conceptual:

```text
1. contradicción material
2. ambigüedad que puede cambiar intent/frame
3. gap crítico de reverse alignment
4. decisión que el usuario necesita habilitar
5. condición de éxito o guardrail materialmente ambiguo
6. contexto operativo necesario para interpretar correctamente
7. profundización vinculada al exploration_goal
8. información nice-to-have
```

La categoría 8 normalmente no debe preguntarse.

---

## 10. Clarification vs Guided Deepening

### `clarification`

Evita interpretar mal algo que el usuario ya expresó.

Ejemplo:

> Cuando dices “acelerar”, ¿te refieres principalmente a llegar antes a prueba, a mercado o a decisión?

### `guided_deepening`

Ayuda al usuario a descubrir o estructurar algo que todavía no tenía claro.

Ejemplo:

> Si dirección dice “innovar más”, ¿qué cambio esperaría notar en seis meses para considerar que realmente mejoró algo?

La segunda no debería aparecer en Quick Clarification salvo que sea imprescindible.

---

## 11. Términos vagos de éxito

Términos como:

- acelerar;
- mejorar;
- reducir riesgo;
- éxito;
- calidad;
- eficiencia;
- simplicidad;
- innovar más;

solo deben generar pregunta si su significado cambia materialmente:

- la decisión;
- el frame;
- la ruta de Starteria;
- el criterio de suficiencia;
- el exploration goal.

No convertir un término vago automáticamente en KPI.

---

## 12. Reverse Alignment

Cuando Skill 03 devuelve un gap material, puede transformarse en pregunta.

Ejemplo:

```text
missing_link = expected_change
```

Pregunta:

> Si esta solución funciona, ¿qué tendría que cambiar para justificarla?

No preguntar cada link por separado si una sola pregunta puede resolver varios.

---

## 13. Combinar gaps

Preferir preguntas que reduzcan dos gaps relacionados sin ser confusas.

Ejemplo:

> Si esto funcionara, ¿qué cambio concreto esperarías ver y por qué sería importante?

Evitar preguntas artificialmente largas para “ahorrar budget”.

Una pregunta que contiene cuatro subpreguntas independientes debe tratarse como mal diseño.

---

## 14. No preguntar para llenar campos

La skill no funciona como checklist:

```text
goal missing → preguntar
metric missing → preguntar
baseline missing → preguntar
target missing → preguntar
horizon missing → preguntar
```

Los campos vacíos son aceptables.

Solo preguntar si el gap es material para el momento actual.

---

## 15. Contradicciones

Una contradicción puede:

- preguntarse;
- mantenerse visible;
- diferirse.

Depende de si cambia materialmente el análisis.

Ejemplo:

> Tenemos 12 iniciativas, aunque quizá son unas 20.

Si el número exacto no cambia el handoff:

```text
no preguntar
```

---

## 16. Operating Context

No preguntar contexto organizacional por curiosidad.

Puede ser crítico si evita una interpretación equivocada.

Ejemplo:

> ¿Ese programa ya existe o lo que quieres es estructurarlo desde cero?

Esto sí puede cambiar materialmente el starteria path.

---

## 17. Decision Need

Cuando la necesidad es difusa, puede priorizarse la decisión.

Ejemplo:

> ¿Qué decisión necesitas poder tomar mejor al final de este proceso?

En Guided Exploration esta pregunta puede ser especialmente útil para convertir ambigüedad en una ruta concreta.

---

## 18. Stopping rule

El plan debe devolver 0 preguntas cuando:

### QP-STOP-01 — Sufficient context

Ya existe contexto suficiente para el propósito actual.

### QP-STOP-02 — Budget unavailable

```text
available_question_budget = 0
```

### QP-STOP-03 — Noncritical gaps only

Los gaps restantes no cambian materialmente la comprensión.

### QP-STOP-04 — Exploration goal satisfied

En Guided Exploration, el objetivo de la ronda ya fue suficientemente resuelto.

### QP-STOP-05 — Later-stage detail

La siguiente información pertenece a una etapa posterior.

### QP-STOP-06 — Step boundary

La siguiente pregunta invadiría diseño de experimento, piloto, gate o Step.

---

## 19. Stop reason

Valores conceptuales:

- `sufficient_context`
- `budget_unavailable`
- `noncritical_gaps_only`
- `exploration_goal_satisfied`
- `later_stage_detail`
- `step_boundary`
- `no_supported_question`

El session controller utiliza este resultado para decidir:

- handoff;
- checkpoint;
- oferta de Guided Exploration;
- final de ronda.

La skill no toma esa decisión final.

---

## 20. Frontera con Step 0 / Step 2

Permitido:

> ¿Qué tendría que demostrar esta iniciativa para que tenga sentido seguir?

No permitido:

> ¿Qué muestra usarás, qué canal probarás y cuál será tu threshold?

Permitido:

> ¿Qué dimensión de calidad no puede degradarse?

No permitido:

> ¿Cómo medirás esa dimensión y cuál será el valor mínimo aceptable?

cuando eso implica diseñar el experimento.

---

## 21. Frontera con recomendaciones

Question Planner no debe esconder recomendaciones dentro de preguntas.

Incorrecto:

> ¿No crees que sería mejor priorizar primero las iniciativas existentes?

Correcto:

> ¿Tu prioridad ahora es generar más iniciativas o decidir mejor sobre las que ya existen?

La recomendación posterior pertenece al handoff.

---

## 22. Provenance

Las preguntas pueden explorar inferencias, pero no asumirlas como hechos.

Incorrecto:

> Dado que el problema es falta de demanda, ¿qué segmento quieres probar?

Mejor:

> ¿El principal riesgo que quieres reducir está en demanda, operación o en otra dimensión?

---

## 23. Boundary con Clarification + Handoff

El session controller entrega:

```text
interaction_mode
available_question_budget
previous_questions
answered_gaps
exploration_goal
```

Question Planner devuelve:

```text
questions
question_count
stop_reason
unresolved_but_noncritical
```

Question Planner no decide:

- cuándo activar Guided Exploration;
- si el usuario aceptó profundizar;
- si abrir una nueva ronda;
- cuándo canonicalizar;
- qué CTA mostrar.

---

## 24. Casos mínimos de aceptación

Los siguientes son ejemplos normativos del contrato, no evidencia de testing.

### Caso A — Quick Clarification suficiente

Input:

> Tengo 18 iniciativas y necesito saber cuáles están alineadas con tres prioridades definidas.

Session:

```text
interaction_mode = quick_clarification
available_question_budget = 3
```

Esperado:

```text
question_count = 0 o 1
```

---

### Caso B — budget restante de 1

Session:

```text
available_question_budget = 1
```

Esperado:

```text
question_count <= 1
```

Nunca devolver 2–3 preguntas.

---

### Caso C — ambigüedad profunda en Quick Clarification

Input:

> Dirección quiere que innovemos más.

Después de preguntas rápidas todavía falta claridad.

Esperado:

- usar solo budget disponible;
- no encadenar nuevas preguntas;
- devolver stop reason cuando corresponda;
- dejar que el session controller ofrezca Guided Exploration.

---

### Caso D — Guided Exploration opt-in

Session:

```text
interaction_mode = guided_exploration
exploration_goal = clarificar qué resultado debería producir “innovar más”
available_question_budget = 2
```

Esperado:

0–2 preguntas centradas exclusivamente en ese objetivo.

No abrir temas de presupuesto, KPIs, governance y experimentación si no son necesarios.

---

### Caso E — Guided Exploration ya suficiente

Si la respuesta anterior ya aclaró el exploration goal:

```text
question_count = 0
stop_reason = exploration_goal_satisfied
```

---

### Caso F — solución sin conexión

Input:

> Quiero implementar un chatbot para ventas.

Pregunta posible:

> Si funciona, ¿qué tendría que cambiar en el negocio para justificarlo?

No preguntar proveedor, stack o presupuesto.

---

### Caso G — programa existente vs deseado

Input:

> Queremos mejorar una aceleradora interna.

Si no está claro si existe:

> ¿La aceleradora ya opera hoy o todavía están definiendo cómo implementarla?

Pregunta válida porque cambia el starteria path.

---

### Caso H — recomendación disfrazada

Input:

> Tenemos muchas ideas y pensamos abrir otra convocatoria.

No preguntar:

> ¿No sería mejor ordenar primero las que ya tienen?

Sí puede preguntar:

> ¿El problema principal hoy es falta de ideas o dificultad para decidir qué hacer con las que ya existen?

---

### Caso I — Step leakage

Input:

> Tenemos un piloto y queremos saber si ampliarlo.

Permitido:

> ¿Qué tendría que demostrar para justificar una ampliación?

No permitido:

> ¿Qué tamaño de muestra y threshold usarán?

---

## 25. Operaciones prohibidas

Este skill no puede:

- superar el `available_question_budget`;
- renovar budget;
- activar Guided Exploration;
- iniciar una nueva ronda por sí solo;
- diseñar experimento;
- diseñar piloto;
- definir threshold;
- construir business case;
- crear Project;
- activar Step;
- formular CTA;
- decidir continuidad;
- recomendar tecnología;
- exigir completitud metodológica.

---

## 26. Criterios de aceptación

El skill cumple si:

- respeta `interaction_mode`;
- respeta `available_question_budget`;
- devuelve 0–1 pregunta user-facing;
- evita repetir preguntas;
- Quick Clarification mantiene foco crítico;
- Guided Exploration mantiene foco en `exploration_goal`;
- diferencia clarification de guided deepening;
- no pregunta datos ya declarados;
- no intenta llenar todos los campos;
- emite `stop_reason`;
- puede devolver 0 preguntas en cualquier modo;
- no esconde recomendaciones en preguntas;
- no invade Step 0 / Step 2;
- conserva provenance.

---

## 27. Anti-patterns

No implementar:

- cuestionario fijo;
- wizard encubierto;
- tres preguntas por defecto;
- ignorar el budget restante;
- Guided Exploration como chat infinito;
- abrir nuevos temas fuera del exploration goal;
- volver a preguntar lo ya respondido;
- recomendación disfrazada de pregunta;
- diseño de experimento;
- llenar campos por completitud.

---

## 28. Decisiones reservadas para testing

No congelar todavía:

- la ronda única de Guided Exploration y su máximo de 2 preguntas;
- score exacto de information value;
- threshold de criticality;
- wording final;
- si las preguntas aparecen una por una o agrupadas;
- cómo representar `exploration_goal`;
- modelo IA;
- prompt final.

---

## 29. Definition of Done

Antes de Harness v0.2:

- [ ] Quick Clarification soportado;
- [ ] Guided Exploration soportado;
- [ ] respeto de budget externo aceptado;
- [ ] `guided_deepening` aceptado;
- [ ] no repetición aceptada;
- [ ] stopping rules aceptadas;
- [ ] `exploration_goal` aceptado;
- [ ] boundary con session controller aceptada;
- [ ] recomendaciones no ocultas en preguntas;
- [ ] frontera con Step 0 / Step 2 aceptada.

---

## 30. Principio final

> Question Planner decide qué vale la pena preguntar ahora; no cuánto debe durar la conversación.

Y:

> En exploración guiada, cada pregunta debe acercar al usuario a claridad sobre un propósito explícito, no abrir otra conversación sin fin.

## Guided Exploration budget alignment

When `interaction_mode = guided_exploration`, the available budget is `0..2` for the single accepted round. The skill emits at most one user-facing question per turn, never renews budget, and leaves convergence to the session controller.

## `reason_to_ask` authority addendum (ADR-007)

The field is a concise `PUBLIC_EXPLANATION` of why answering the active question may materially improve understanding, decision framing, or next movement. It is not a reason why the model selected the question. Follow accepted product [ADR-007](../../../../../doc/product-adr/ADR-007-portfolio-entry-reason-to-ask-public-explanation.md) and the [v0.1 exposure contract](../../../../experience/portfolio-entry/PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md), including its security and no-client-rewrite rules. This narrow citation does not promote the proposed skill or its other clauses.
