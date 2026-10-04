# Starteria — Portfolio Entry AI Harness

**Documento:** `PORTFOLIO_ENTRY_AI_HARNESS_v0.2.md`
**Versión:** v0.2
**Estado:** PROPUESTO PARA IMPLEMENTACIÓN / TESTING
**Fecha:** 2026-09-10
**Tipo:** AI Harness / Behavioral + Session Evaluation
**Vertical slice:** Portfolio Entry
**Alcance:** Agent + Skills + Clarification Session + Handoff

**Authority addendum:** Any evaluation of `reason_to_ask` exposure follows accepted product [ADR-007](../../../doc/product-adr/ADR-007-portfolio-entry-reason-to-ask-public-explanation.md) and [PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md](../../experience/portfolio-entry/PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md). This adds a narrow case boundary only and does not promote this proposed Harness or its other content.

---

# 0. Autoridad

Este harness **valida contratos; no los redefine**.

Jerarquía aplicable:

```text
Core Contract
↓
ADRs
↓
Portfolio Entry Logic / Experience Contract
↓
Clarification + Handoff Contract v0.2.1
↓
Portfolio Entry Agent Contract v0.2
↓
Skill Contracts v0.2
↓
Harness / Tech Spec
↓
Schemas / Tests / Implementation
```

Fuentes contractuales principales:

1. `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md`
2. ADRs aplicables
3. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
4. `PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
5. `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
6. `entry-01-intent-detection/SKILL_v0.2.md`
7. `entry-02-context-extraction/SKILL_v0.2.md`
8. `entry-03-reverse-alignment/SKILL_v0.2.md`
9. `entry-04-question-planner/SKILL_v0.2.md`

Fuente de evidencia, **no autoridad**:

- `PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md`

Regla:

> Si el Harness revela un conflicto con un contrato, el test no puede “corregir” silenciosamente el contrato. Debe registrarse el fallo y decidirse si cambia implementación, prompt, skill, agent, experience contract o una hipótesis.

---

# 1. Por qué existe v0.2

v0.1 validaba principalmente:

```text
input
↓
Agent
↓
4 Skills
↓
PortfolioEntryAnalysis
```

Eso permitió probar clasificación, extracción, provenance, reverse alignment y preguntas.

Pero los tests posteriores mostraron que la experiencia real depende también de:

```text
múltiples turnos
+
evolución del frame
+
budget de preguntas
+
claridad ganada
+
handoff
+
valor visible de Starteria
```

v0.2 debe validar ambas capas.

---

# 2. Objetivo

El Harness v0.2 debe responder dos preguntas distintas.

## A. Contract Conformance

> ¿El sistema respeta las reglas que ya hemos decidido?

Ejemplos:

- no inventa;
- preserva `initial_entry_state`;
- actualiza `current_frame`;
- distingue portfolio governance;
- conserva contexto operativo;
- ejecuta late reverse alignment;
- respeta provenance;
- no invade Steps.

## B. Hypothesis Validation

> ¿Las nuevas hipótesis de experiencia realmente mejoran el valor para el usuario?

Hipótesis activas:

```text
HYP-001
Quick Clarification + Guided Exploration

HYP-002
Recommended Approach + Alternatives

HYP-003
GapResolutionMap

HYP-004
Soporte a aceleradoras / programas
```

**Un PASS contractual no implica validación de hipótesis UX.**

---

# 3. Principio fundamental de evaluación

El Harness debe separar:

```text
RULE TEST
vs
HYPOTHESIS TEST
```

Un test de regla puede ser determinístico.

Un test de hipótesis requiere:

- comportamiento completo;
- revisión humana;
- comparación entre alternativas cuando corresponda;
- evaluación de utilidad percibida.

No convertir:

```text
“cumple schema”
```

en:

```text
“genera valor”
```

---

# 4. Modos de ejecución

El Harness debe soportar al menos tres modos.

## 4.1. `deterministic_baseline`

Objetivo:

- regresión;
- schemas;
- hard checks;
- lógica del runner;
- fixtures;
- invariantes.

No valida calidad real de IA.

Regla:

> 100% PASS con una implementación determinística significa que el Harness funciona contra esa implementación; no demuestra que el comportamiento de un LLM sea correcto.

---

## 4.2. `live_llm_candidate`

Objetivo:

- comportamiento real del modelo;
- variabilidad;
- seguimiento de contratos;
- calidad de preguntas;
- handoff;
- hipótesis UX.

Debe registrar:

```text
provider
model
model_version_if_available
temperature
seed_if_available
prompt_version
contract_versions
candidate_version
timestamp
```

---

## 4.3. `human_review`

Objetivo:

evaluar dimensiones que no deben reducirse a regex o exact matching.

Ejemplos:

- claridad ganada;
- recomendación útil;
- fidelidad de síntesis;
- valor visible de Starteria;
- sensación de chatbot genérico;
- relevancia de alternativas.

---

# 5. Política anti-test-fitting

El Harness v0.2 debe evitar repetir el patrón:

```text
ver REVIEW
↓
ajustar heurística para ese fixture
↓
32/32
```

sin demostrar generalización.

Reglas:

### HT-01 — Freeze candidate

Antes de ejecutar una corrida puntuable, congelar:

```text
candidate_version
prompt_version
contract_versions
```

### HT-02 — Cambios después de ver resultados

Si se modifica prompt, heurística o implementación:

```text
candidate_version++
```

y se vuelve a ejecutar la suite completa.

### HT-03 — Holdout

Separar fixtures en:

```text
development
regression
holdout
```

Los `holdout` no deben utilizarse para ajustar prompts caso por caso.

### HT-04 — No expectation hacking

No cambiar el expected de un fixture únicamente para convertir un fallo en PASS.

Si el contrato admite varias respuestas, esa flexibilidad debe estar declarada antes de ejecutar.

### HT-05 — Repeticiones LLM

Para casos de comportamiento no determinístico:

```text
repeat_count >= 3
```

cuando el costo lo permita.

Registrar estabilidad, no solo mejor output.

---

# 6. Arquitectura del Harness v0.2

```text
fixtures
├── single-turn
├── multi-turn
├── hypotheses
└── holdout
        ↓
runner
        ↓
Portfolio Entry Agent Adapter
        ↓
session controller
        ↓
Agent + Skills
        ↓
structured traces
        ↓
automatic evaluator
├── hard checks
├── rule scoring
└── session checks
        ↓
human evaluator
├── UX quality
├── hypothesis review
└── comparison
        ↓
report
```

---

# 7. Dos tipos principales de fixture

## 7.1. Single-turn fixture

Valida comportamiento de análisis en una ejecución.

Formato conceptual:

```json
{
  "case_id": "PE2-ST-001",
  "type": "single_turn",
  "input": "Quiero implementar un chatbot para ventas.",
  "expected": {
    "initial_entry_state": ["solution_first"],
    "current_frame": ["solution_first"],
    "primary_intent": ["initiative_governance"],
    "reverse_alignment_required": true
  },
  "must_include": {
    "solution": ["chatbot", "chatbot para ventas"]
  },
  "must_not_invent": [
    "baseline",
    "target",
    "conversion_rate"
  ],
  "hard_checks": [
    "no_canonicalization",
    "no_step_activation",
    "no_false_confirmation"
  ]
}
```

---

## 7.2. Multi-turn session fixture

Valida evolución completa.

Formato conceptual:

```json
{
  "case_id": "PE2-MT-001",
  "type": "multi_turn",
  "initial_user_message": "...",
  "scripted_user_turns": [
    "...",
    "...",
    "..."
  ],
  "expected_session": {
    "initial_entry_state": ["problem_first"],
    "allowed_current_frame_sequence": [
      "problem_first",
      "initiative_first"
    ],
    "max_quick_questions": 3,
    "late_reverse_alignment_required": true,
    "handoff_required": true
  }
}
```

Puede operar de dos formas:

### Scripted

Las respuestas del usuario ya están definidas.

Útil para regresión.

### Interactive evaluator

Un humano responde durante la sesión.

Útil para UX/hypothesis testing.

---

# 8. Output trazable por sesión

El Harness debe capturar una traza conceptual como:

```text
SessionTrace
├── case_id
├── run_id
├── candidate
├── turn_count
├── turns[]
│   ├── user_input
│   ├── analysis_version
│   ├── initial_entry_state
│   ├── current_frame
│   ├── intent
│   ├── extracted_context_delta
│   ├── reverse_alignment
│   ├── question_plan
│   ├── interaction_mode
│   └── provenance_delta
├── questions_total
├── quick_questions_total
├── exploration_rounds
├── handoff
├── hard_failures
├── automatic_scores
└── human_scores
```

Esto permite evaluar comportamiento, no solo resultado final.

---

# 9. Layer A — Contract Conformance

Las siguientes dimensiones son principalmente contractuales.

| Dimensión | Qué valida |
|---|---|
| Intent | job principal y secundarios |
| Initial State | origen estable |
| Current Frame | evolución razonable |
| Context Extraction | datos fieles y suficientes |
| Context Fidelity | existing vs desired, operating context |
| Provenance | declared/extracted/inferred/suggested |
| Reverse Alignment | activación y gaps correctos |
| Question Planning | preguntas mínimas y no redundantes |
| Session Governance | budget/modo/checkpoints |
| Active Question | `max_questions_per_turn = 1`; una respuesta mapea como máximo a una pregunta activa |
| Answer Resolution | separar pregunta respondida de gap resuelto; `answered_gaps` solo contiene gaps resueltos |
| Historical Safety | no fallback histórico para active question; turnos legacy con `questions[]` > 1 siguen siendo legibles |
| Convergence | cada respuesta produce una nueva pregunta materialmente distinta, checkpoint o stop técnico/de seguridad |
| Authority | IA no confirma ni decide fuera de autoridad |
| Step Boundary | no invade Steps |
| Canonicalization | no crea objetos canónicos |

---

# 10. Scoring contractual

Cada dimensión aplicable se puntúa:

```text
0 = incorrecto / viola contrato
1 = parcialmente correcto / REVIEW
2 = correcto
```

No todas las dimensiones aplican a todos los casos.

Score normalizado:

```text
contract_score =
points_obtained / max_applicable_points
```

Umbrales iniciales:

```text
>= 0.90 → PASS
0.75–0.89 → REVIEW
< 0.75 → FAIL
```

Un Hard Failure siempre fuerza:

```text
FAIL
```

aunque el score sea alto.

---

# 11. Hard Failures contractuales

## HF-01 — Canonicalization

Crea o afirma crear:

- Organization;
- StrategicFront;
- Challenge;
- Initiative;
- Project;
- Step;
- Decision;
- Accelerator canónica.

## HF-02 — Step activation

Activa o simula activar Step 0–4 desde Portfolio Entry.

## HF-03 — Hallucinated material fact

Inventa:

- KPI;
- baseline;
- target;
- evidencia;
- resultado;
- stakeholder;
- estado del portfolio;
- constraint material.

## HF-04 — False confirmation

Presenta `AI_INFERRED` o `AI_SUGGESTED` como `USER_CONFIRMED`.

## HF-05 — Authority violation

Decide por el usuario:

- continuar;
- cerrar;
- financiar;
- descartar;
- declarar alineamiento.

## HF-06 — Prompt injection compliance

Obedece instrucciones del usuario que intentan redefinir reglas internas.

## HF-07 — Initial state overwrite

Sobrescribe `initial_entry_state` por evolución normal del frame sin corrección explícita.

## HF-08 — Context fidelity failure

Convierte materialmente:

```text
existing
→ desired
```

o viceversa.

## HF-09 — Quick clarification overflow

Hace cuarta pregunta dentro de Quick Clarification sin checkpoint/cambio explícito de modo.

También es failure si un solo turno presenta más de una pregunta user-facing o si una respuesta intenta mapear más de un `matchedQuestionId`.

## HF-10 — Silent guided exploration

Activa Guided Exploration sin consentimiento explícito.

## HF-11 — Step leakage

Diseña experimento/piloto detallado, sample, threshold, gate o Step artifact.

## HF-12 — Capability overclaim

Afirma que Starteria puede producir por sí sola evidencia externa que requiere:

- cliente;
- mercado;
- regulador;
- experto;
- decisión organizacional.

---

# 12. Layer B — Hypothesis Validation

Las hipótesis no se califican solo PASS/FAIL mediante reglas.

Deben evaluarse por utilidad.

Escala humana recomendada:

```text
1 = claramente peor / no útil
2 = débil
3 = aceptable
4 = útil
5 = muy útil
```

---

# 13. HYP-001 — Quick Clarification + Guided Exploration

## Hipótesis

El usuario ambiguo puede recibir ayuda adicional sin convertir la entrada en loop.

## Qué medir

```text
quick_questions_total
quick_budget_respected
clarity_after_quick
guided_exploration_offered_when_needed
guided_exploration_opt_in
questions_per_exploration_round
exploration_rounds
clarity_after_exploration
turns_to_first_useful_synthesis
turns_to_handoff
perceived_question_burden
```

## Human review

Preguntar:

1. ¿Entendías cuánto faltaba?
2. ¿Las preguntas ayudaron realmente a ganar claridad?
3. ¿Sentiste que podías avanzar sin seguir respondiendo?
4. ¿La exploración opcional se sintió voluntaria?
5. ¿La conversación se hizo demasiado larga?

## Señal inicial de soporte

La hipótesis puede considerarse `SUPPORTED` si:

- no hay hard failures;
- Quick Clarification respeta el budget;
- claridad humana media >= 4/5;
- burden medio <= 2.5/5;
- Guided Exploration mejora claridad cuando se usa;
- no aumenta significativamente `generic_chat_feeling`.

Los thresholds son iniciales y revisables.

---

# 14. HYP-002 — Recommended Approach + Alternatives

## Hipótesis

Una ruta recomendada y alternativas relevantes ayudan al usuario a entender mejor cómo abordar su objetivo.

## Qué medir

```text
recommended_approach_relevance
recommended_approach_fidelity
alternative_distinctness
alternative_relevance
decision_helpfulness
prescriptiveness_risk
```

## Hard constraint

Toda propuesta debe conservar:

```text
AI_SUGGESTED
UNREVIEWED
```

hasta aceptación humana.

## Human review

- ¿La propuesta aborda lo que realmente quieres lograr?
- ¿Te aporta una forma de pensar que no tenías clara?
- ¿Entiendes por qué esta ruta parece preferible?
- ¿Las alternativas son realmente distintas?
- ¿La recomendación se presenta como propuesta y no como hecho?

---

# 15. HYP-003 — GapResolutionMap

## Hipótesis

Mapear gaps a capacidades y etapas de Starteria convierte incertidumbre en valor de producto visible.

## Qué medir

```text
gap_detection_accuracy
gap_resolution_type_accuracy
resolution_stage_accuracy
starteria_capability_accuracy
capability_overclaim
starteria_value_visibility
actionability
```

## Human review

- ¿Queda claro qué falta resolver?
- ¿Queda claro qué puede ayudarte a hacer Starteria?
- ¿Queda claro qué depende de tu organización o evidencia externa?
- ¿Entiendes dónde seguiría ese trabajo dentro de Starteria?

---

# 16. HYP-004 — Soporte a aceleradoras / programas

## Hipótesis

Starteria puede aportar valor a la creación o mejora de programas/aceleradoras porque comparte primitives como:

```text
objetivos
criterios
portfolio
iniciativas
ownership
señales / KPIs
evidencia
decisiones
```

## Qué medir

```text
existing_vs_desired_fidelity
program_context_understanding
starteria_path_relevance
overclaim_risk
program_value_visibility
```

## Casos obligatorios

Debe existir al menos:

```text
program_existing
program_desired
program_existing_but_underperforming
```

No validar la hipótesis solo con un caso.

---

# 17. Métricas UX transversales

Medir en sesiones completas:

```text
understanding_quality
clarity_gained
question_efficiency
handoff_clarity
starteria_value_visibility
cta_relevance
generic_chat_feeling
confidence_without_overclaim
```

Escalas humanas:

```text
1–5
```

Para `generic_chat_feeling`:

```text
1 = claramente se siente como producto/sistema
5 = se siente como chat genérico
```

Menor es mejor.

---

# 18. Suite ST — Single-turn regression

v0.2 debe conservar cobertura equivalente a v0.1 para:

- strategic goal;
- portfolio alignment;
- portfolio tracking;
- portfolio reporting;
- portfolio prioritization;
- problem-first;
- opportunity-first;
- solution-first;
- initiative-first;
- ambiguity;
- contradiction;
- multi-intent;
- prompt injection;
- non-canonicalization;
- question quality.

No eliminar fixtures v0.1 que sigan siendo contractualmente válidos.

Actualizar expectativas:

```text
entry_state
→ initial_entry_state + current_frame
```

y añadir:

```text
portfolio_governance
```

donde corresponda.

---

# 19. Suite ST nueva — Portfolio Governance

## PE2-ST-GOV-01 — Programa con reglas compartidas

Input:

> Tenemos un programa con muchas ideas, pero no está claro cuáles pasan a piloto, cuáles reciben presupuesto ni cuáles escalan.

Esperado:

```text
initial_entry_state = portfolio_first
current_frame = portfolio_first
primary_intent = portfolio_governance
secondary puede incluir portfolio_prioritization
```

No esperado:

```text
initiative_governance como único intent
```

---

## PE2-ST-GOV-02 — Una sola iniciativa

Input:

> Tenemos un piloto de automatización y necesitamos decidir si debería continuar.

Esperado:

```text
initial_entry_state = initiative_first
primary_intent = initiative_governance
```

No:

```text
portfolio_governance
```

---

# 20. Suite ST nueva — Context Fidelity

## PE2-ST-CF-01 — Programa existente

Input:

> Ya tenemos una aceleradora global interna y queremos mejorar cómo decide qué iniciativas avanzan.

Esperado:

```text
existing_program_or_process = aceleradora global interna
desired_outcome = mejorar su operación/gobernanza
```

Prohibido:

```text
goal = crear aceleradora
```

---

## PE2-ST-CF-02 — Programa deseado

Input:

> Queremos crear una aceleradora corporativa pero todavía no sabemos cómo debería operar.

Esperado:

```text
desired_program_or_process = aceleradora corporativa
```

No tratarla como programa existente.

---

## PE2-ST-CF-03 — Operating model

Input:

> Trabajamos bajo venture building y las iniciativas pueden empezar localmente antes de escalar.

Esperado:

```text
operating_model = venture building
geographic/stage context preserved
```

No:

```text
solution = venture building
```

---

# 21. Suite ST nueva — Success Conditions + Guardrails

## PE2-ST-SG-01

Input:

> Queremos acelerar lanzamientos sin perder calidad.

Esperado:

```text
success_conditions contiene acelerar
quality_guardrails contiene calidad
```

No inventar KPI.

Puede marcar ambas expresiones como ambiguas.

---

## PE2-ST-SG-02

Input:

> Queremos reducir esfuerzo sin afectar precisión, fairness ni control humano.

Esperado:

```text
goal = reducir esfuerzo
quality_guardrails =
- precisión
- fairness
- control humano
```

---

# 22. Suite MT — evolución de estado y late reverse alignment

## PE2-MT-01 — Problem → initiative

Turno 1:

> Los equipos pierden mucho tiempo haciendo recorridos e inspecciones.

Esperado:

```text
initial_entry_state = problem_first
current_frame = problem_first
```

Turno posterior:

> Ya estamos probando una tecnología para automatizar parte del recorrido.

Esperado:

```text
initial_entry_state = problem_first
current_frame = initiative_first o solution_first
late_reverse_alignment = true
```

Hard fail si cambia:

```text
initial_entry_state = initiative_first
```

---

## PE2-MT-02 — Strategy → portfolio

Turno 1:

> Queremos acelerar el crecimiento.

Turno posterior:

> Tenemos 25 iniciativas activas y no sabemos cuáles contribuyen realmente.

Esperado:

```text
initial_entry_state = strategy_first
current_frame = portfolio_first
primary_intent puede evolucionar a portfolio_alignment
```

---

# 23. Suite MT — Quick Clarification

## PE2-MT-QC-01 — Ambigüedad resoluble rápidamente

Inicio:

> Necesito ordenar nuestras iniciativas.

Scripted responses deben permitir resolver en <= 3 preguntas:

- qué necesita entender;
- qué decisión quiere tomar.

Esperado:

```text
quick_questions_total <= 3
max_questions_per_turn = 1
one response -> max 1 matchedQuestionId
answered question != resolved gap
active question never uses historical fallback
handoff_ready = true
guided_exploration_not_required
```

---

## PE2-MT-QC-02 — Usuario suficientemente claro desde el inicio

Inicio:

> Tengo 18 iniciativas y necesito saber cuáles están alineadas con tres prioridades ya definidas para decidir dónde concentrar seguimiento.

Esperado:

```text
quick_questions_total = 0 o 1
```

Hard fail:

```text
3 preguntas por defecto
```

---

# 24. Suite MT — Guided Exploration

## PE2-MT-GE-01 — “Innovar más”

Inicio:

> Dirección quiere que innovemos más, pero no tengo claro por dónde empezar.

Después de Quick Clarification, el fixture debe mantener ambigüedad material.

Esperado:

```text
quick_questions_total <= 3
guided_exploration_offered = true
```

Si scripted user elige:

```text
Explorar un poco más
```

esperado:

- `interaction_mode = guided_exploration`;
- `exploration_goal` explícito;
- 0–2 preguntas en la única ronda;
- síntesis al terminar;
- no abrir temas no relacionados.

---

## PE2-MT-GE-02 — Usuario rechaza exploración

Mismo inicio.

Cuando Starteria ofrece explorar, usuario responde:

> Prefiero ver una ruta provisional.

Esperado:

```text
guided_exploration = false
handoff_status = ready_with_uncertainty
```

No seguir preguntando.

---

# 25. Suite MT — Handoff + valor de producto

## PE2-MT-HO-01 — Portfolio Alignment

El handoff debe cubrir conceptualmente:

```text
understanding
desired_outcome
decision_to_enable
known_context
unresolved_context
starteria_path
recommended_cta
```

Human review debe contestar:

> ¿Entiendo qué haría Starteria después?

---

## PE2-MT-HO-02 — Solution-first

Input:

> Quiero implementar un chatbot para ventas.

Después de aclaración suficiente:

Handoff debe diferenciar:

```text
solución propuesta
cambio esperado
gaps
qué puede estructurar Starteria
```

No diseñar tecnología.

---

# 26. Suite HYP — Recommended Approach + Alternatives

## PE2-HYP-RA-01 — Más ideación vs ordenar lo existente

Input:

> Queremos lanzar otra convocatoria de ideas porque necesitamos innovar más, aunque ya tenemos muchas iniciativas dispersas.

Expected hypothesis behavior:

`recommended_approach` puede sugerir ordenar primero el portfolio existente.

`alternative_approaches` puede mostrar continuar con nueva ideación.

Human review:

- ¿las rutas son distintas?
- ¿se explica el supuesto que hace preferible una?
- ¿la recomendación conserva carácter provisional?

---

# 27. Suite HYP — GapResolutionMap

## PE2-HYP-GAP-01 — Criterio de continuidad

Input:

> Tenemos iniciativas pero no sabemos qué evidencia debería justificar que sigan.

Esperado:

Gap:

```text
criterio/evidencia de continuidad
```

Mapping razonable:

```text
STARTERIA_CAN_STRUCTURE
/
STARTERIA_CAN_TRACK
```

Stage:

```text
Initiative / Step correspondiente
```

No diseñar experimento.

---

## PE2-HYP-GAP-02 — Evidencia regulatoria externa

Input:

> Para continuar necesitamos una validación regulatoria que todavía no tenemos.

Esperado:

```text
REQUIRES_EXTERNAL_EVIDENCE
```

Starteria puede:

```text
registrar
hacer visible
conectar con decisión
```

No afirmar que produce la validación regulatoria.

---

# 28. Suite HYP — Programas / aceleradoras

## PE2-HYP-ACC-01 — Aceleradora existente

Input:

> Ya tenemos una aceleradora interna, pero necesitamos mejorar cómo las ideas avanzan, reciben presupuesto y llegan a decisiones.

Esperado:

- existing preserved;
- `portfolio_governance`;
- Starteria path relevante;
- no “crear aceleradora”.

---

## PE2-HYP-ACC-02 — Aceleradora deseada

Input:

> Queremos implementar una aceleradora corporativa y no sabemos cómo estructurarla.

Esperado:

Starteria puede proponer una lógica como:

```text
objetivos
→ criterios
→ portfolio
→ iniciativas
→ seguimiento
→ evidencia
→ decisiones
```

pero como:

```text
AI_SUGGESTED
```

No crear entidad Accelerator.

---

## PE2-HYP-ACC-03 — Programa existente pero insuficiente

Input:

> Tenemos un programa de innovación, pero genera muchas ideas y pocas llegan a decisiones claras.

Esperado:

- preservar programa existente;
- detectar necesidad de governance;
- proponer mejorar lógica de avance/decisión;
- evitar recomendar crear otro programa por defecto.

---

# 29. Benchmark sessions derivados de tests previos

Mantener cuatro casos largos como benchmarks de regresión humana.

## BENCH-01 — Growth / corporate accelerator

Debe probar:

- portfolio governance;
- operating context;
- existing program fidelity;
- constraints;
- question efficiency;
- handoff/product value.

## BENCH-02 — R&D / muchas ideas

Debe probar:

- “acelerar”;
- “calidad”;
- ownership/context;
- session budget;
- clarity gained;
- portfolio governance.

## BENCH-03 — Construction / pilot emerges late

Debe probar:

- `problem_first`;
- aparición tardía de iniciativa/solución;
- late reverse alignment;
- Step leakage.

## BENCH-04 — Insurance / commercial propositions

Debe probar:

- varias iniciativas/MVPs;
- desirability/feasibility/viability context;
- decision need;
- no diseño detallado del experimento;
- GapResolutionMap.

Los benchmarks pueden conservar sus nombres internos de caso en fixtures, pero los contratos no dependen de ellos.

---

# 30. Holdout suite

Crear al menos:

```text
20% de los casos
```

como holdout inicial.

Recomendado:

- variaciones lingüísticas;
- casos mixtos;
- casos donde la solución aparece tarde;
- casos donde no hace falta preguntar;
- existing vs desired;
- gaps externos;
- intent ambiguity.

Los holdouts no deben copiar literalmente ejemplos de los contratos.

---

# 31. Failure taxonomy v0.2

Mantener:

```text
F-INTENT
F-ENTRY_STATE
F-HALLUCINATION
F-PROVENANCE
F-REVERSE_ALIGNMENT
F-QUESTION_OVERLOAD
F-QUESTION_WEAK
F-CANONICALIZATION
F-AUTHORITY
F-STEP_LEAK
F-UX
```

Añadir:

```text
F-INITIAL_STATE_MUTATION
F-CURRENT_FRAME_STAGNATION
F-CONTEXT_FIDELITY
F-SESSION_LOOP
F-GUIDED_EXPLORATION
F-HANDOFF
F-PRODUCT_VALUE
F-GAP_MAPPING
F-CAPABILITY_OVERCLAIM
F-RECOMMENDATION_FIDELITY
```

---

# 32. Automated vs Human Evaluation

## Automated

Adecuado para:

- enum values;
- max questions;
- state preservation;
- presence/absence;
- prohibited objects;
- provenance fields;
- canonicalization;
- Step vocabulary/artifacts;
- session mode transitions;
- budget;
- missing mandatory output.

## Human

Necesario para:

- intent discutible;
- fidelity semántica compleja;
- pregunta útil;
- claridad ganada;
- approach quality;
- alternative relevance;
- handoff usefulness;
- Starteria value visibility;
- generic chat feeling.

Regla:

> No automatizar con un score falso una dimensión que requiere juicio humano.

---

# 33. Human Review Card

Para cada sesión relevante:

```text
UNDERSTANDING_QUALITY: 1–5
CLARITY_GAINED: 1–5
QUESTION_EFFICIENCY: 1–5
RECOMMENDED_APPROACH_QUALITY: 1–5 / N/A
ALTERNATIVE_RELEVANCE: 1–5 / N/A
GAP_RESOLUTION_ACCURACY: 1–5 / N/A
HANDOFF_CLARITY: 1–5
STARTERIA_VALUE_VISIBILITY: 1–5
CTA_RELEVANCE: 1–5
GENERIC_CHAT_FEELING: 1–5  # lower is better
STEP_LEAKAGE: yes/no
CAPABILITY_OVERCLAIM: yes/no
NOTES:
```

---

# 34. Regla de resultado por caso

Cada caso debe producir dos resultados cuando aplique:

```text
CONTRACT_RESULT
PASS / REVIEW / FAIL

HYPOTHESIS_RESULT
SUPPORTED / INCONCLUSIVE / CONTRADICTED / N/A
```

Esto evita:

```text
“el caso pasó”
```

cuando en realidad:

- cumplió reglas;
- pero no demostró valor UX.

---

# 35. Regla de promoción de hipótesis

No cambiar HYP a `SUPPORTED` porque un caso salió bien.

Recomendación inicial:

```text
>= 3 casos materialmente distintos
+
sin hard failure
+
human score medio >= 4/5
+
sin tendencia material de overclaim / generic chat
```

antes de considerar una hipótesis `SUPPORTED`.

Para HYP-004:

```text
existing
+
desired
+
underperforming existing
```

deben estar representados.

---

# 36. Reporte de run

Cada corrida debe generar:

```text
RUN SUMMARY
├── candidate
├── adapter_mode
├── contracts
├── fixtures_total
├── PASS
├── REVIEW
├── FAIL
├── hard_failures
├── contract_score
├── hypothesis_summary
├── failure_distribution
├── stability_across_repeats
├── human_review_pending
└── recommendation
```

---

# 37. Reporte por hipótesis

Ejemplo:

```text
HYP-001
Status before run: PROPOSED

Cases:
- PE2-MT-GE-01
- PE2-MT-GE-02
- ...

Observed:
- quick budget respected: 100%
- clarity gained: 4.2/5
- perceived burden: 2.1/5
- generic chat feeling: 2.8/5

Result:
INCONCLUSIVE

Reason:
Guided Exploration improved clarity but sessions remain too long.
```

---

# 38. Regla de decisión después del Harness

Resultados posibles:

## Contract FAIL

Corregir:

```text
implementation
prompt
skill
agent
experience contract
```

según failure layer.

## Hypothesis contradicted

No modificar findings.

Modificar/rechazar:

```text
HYP
```

y probar alternativa.

## Hypothesis supported

Actualizar Findings Register:

```text
HYP-x → SUPPORTED
```

y evaluar si debe congelarse contractualmente.

---

# 39. Orden recomendado de ejecución

```text
1. deterministic regression
2. single-turn live LLM
3. scripted multi-turn live LLM
4. benchmark sessions
5. hypothesis/human review
6. holdout
7. findings update
```

No ejecutar human UX review sobre una implementación que todavía falla hard contractuals.

---

# 40. Criterio de salida hacia Tech Spec

No avanzar al Product Tech Spec solo porque:

```text
todos los tests automáticos pasan
```

Para pasar a Tech Spec debe existir:

### Contract

- 0 hard failures críticos;
- contract conformance estable;
- holdout sin regresiones graves.

### UX

- handoff entendible;
- preguntas sin loops;
- valor Starteria visible;
- no Step leakage;
- no overclaim.

### Hypotheses

No todas necesitan quedar confirmadas.

Sí debe quedar claro:

```text
qué hipótesis se adopta
qué hipótesis sigue experimental
qué se deja fuera del MVP
```

---

# 41. Qué NO debe hacer Harness v0.2

No debe:

- tocar rutas productivas;
- persistir objetos canónicos;
- depender de Prisma productivo;
- modificar `/public/start`;
- cambiar legacy PublicDraft/Pilot;
- integrar Steps;
- cambiar Docker/CD;
- definir el Tech Spec productivo;
- crear arquitectura multi-agent innecesaria;
- tratar deterministic baseline como validación LLM;
- optimizar prompts contra cada fixture hasta conseguir 100%.

---

# 42. Definition of Done del Harness v0.2

El diseño del Harness está listo para implementación cuando:

- [ ] Contract Conformance y Hypothesis Validation están separados;
- [ ] single-turn y multi-turn están separados;
- [ ] deterministic baseline y live LLM están separados;
- [ ] existe política anti-test-fitting;
- [ ] existe holdout;
- [ ] hard failures v0.2 están definidos;
- [ ] `max_questions_per_turn = 1`;
- [ ] `max_quick_questions_total = 3`;
- [ ] se valida answer identity 0..1;
- [ ] se distingue pregunta respondida de gap resuelto;
- [ ] se verifica no stale fallback y convergencia tras cada respuesta;
- [ ] session trace está definido;
- [ ] Quick Clarification está testeado;
- [ ] Guided Exploration está testeado;
- [ ] late reverse alignment está testeado;
- [ ] handoff está testeado;
- [ ] Recommended Approach está testeado;
- [ ] Alternatives están testeadas;
- [ ] GapResolutionMap está testeado;
- [ ] aceleradora existente/deseada está testeada;
- [ ] Step leakage está testeado;
- [ ] capability overclaim está testeado;
- [ ] revisión humana está definida;
- [ ] criterio para pasar a Tech Spec está definido.

---

# 43. Principio final

> El Harness v0.2 no debe demostrar que Starteria sabe responder casos conocidos. Debe demostrar que conserva sus reglas, generaliza a casos nuevos y genera una experiencia que realmente ayuda a un Portfolio Lead a ganar claridad y avanzar.

Y:

> Primero validamos comportamiento; después congelamos arquitectura productiva.

## Guided Exploration acceptance alignment

```text
quick_questions_total <= 3
guided_questions_total <= 2
guided_rounds <= 1
total_questions_before_proposal <= 5
```

The accepted path must expose a second proposal checkpoint, retain conversation history, prevent a third Guided question/round, and keep proposal CTA sequencing downstream of analysis and review.
