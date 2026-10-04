# Starteria — Portfolio Entry Harness Execution Spec

**Documento:** `PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2.md`
**Versión:** v0.2
**Estado:** PROPUESTO PARA IMPLEMENTACIÓN
**Fecha:** 2026-09-10
**Tipo:** Execution Spec / AI Harness Infrastructure
**Vertical slice:** Portfolio Entry experimental
**Alcance:** laboratorio aislado, sin integración productiva

---

# 0. Objetivo

Evolucionar la infraestructura experimental existente del Portfolio Entry Harness para ejecutar `PORTFOLIO_ENTRY_AI_HARNESS_v0.2` sin convertir todavía las hipótesis de experiencia en arquitectura productiva.

El Harness v0.2 debe poder ejecutar y evaluar:

```text
single-turn analysis
+
multi-turn clarification sessions
+
late reverse alignment
+
Quick Clarification
+
Guided Exploration
+
PortfolioEntryHandoff
+
hypothesis review
```

contra:

```text
deterministic baseline
o
live LLM candidate
```

y producir resultados separados para:

```text
CONTRACT CONFORMANCE
vs
HYPOTHESIS VALIDATION
```

---

# 1. Principio de continuidad con v0.1

La implementación v0.1 existente es un baseline histórico útil.

No debe borrarse ni reinterpretarse retrospectivamente.

Estado actual conocido:

```text
tests/ai-harness/portfolio-entry/**
```

incluye:

- fixtures JSON;
- schemas Zod;
- agent adapter;
- implementación determinística experimental;
- hard checks;
- scorer;
- failure taxonomy;
- runner;
- report;
- unit tests.

Existe además el script:

```text
harness:portfolio-entry
```

en `front/package.json`.

La evolución v0.2 debe reutilizar esa base siempre que siga siendo válida.

Regla:

> Extender el laboratorio; no reescribirlo solo para acomodar la nueva versión.

---

# 2. Aislamiento obligatorio

La implementación v0.2 sigue siendo experimental.

NO modificar:

- `/public/start`
- `PublicStartPage`
- `PublicProposalEditorPage`
- `/api/v1/public/refine-field`
- PublicDraft legacy
- PilotLead
- PilotClaimService
- `ProjectService`
- `ProjectService.createProject`
- `updateStep0`
- `AutofillContext`
- Step PDF DTO/extractor
- Step 0–4 productivos
- Prisma schema productivo
- rutas productivas
- lógica legacy de conversión
- Docker/CD

Regla:

```text
Harness
�
product runtime
```

Si para ejecutar el Harness parece necesario tocar producción:

```text
STOP
→ documentar dependencia
→ no modificar
→ solicitar revisión
```

---

# 3. Autoridad

El código del Harness implementa y valida esta jerarquía:

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
AI Harness v0.2
↓
Execution Spec v0.2
↓
Schemas / Fixtures / Runner / Evaluators
```

Documentos principales:

1. `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md`
2. ADRs aplicables
3. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
4. `PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
5. `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
6. `entry-01-intent-detection/SKILL_v0.2.md`
7. `entry-02-context-extraction/SKILL_v0.2.md`
8. `entry-03-reverse-alignment/SKILL_v0.2.md`
9. `entry-04-question-planner/SKILL_v0.2.md`
10. `PORTFOLIO_ENTRY_AI_HARNESS_v0.2.md`

`PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md` aporta evidencia y trazabilidad, pero no es autoridad superior.

---

# 4. Qué cambia técnicamente respecto a v0.1

v0.1:

```text
fixture
→ analyze(raw_input)
→ output
→ evaluate
```

v0.2:

```text
fixture
→ fixture router
   ├── single-turn executor
   └── session executor
          ↓
     session controller
          ↓
     analyze turn
          ↓
     scripted user responder / human input
          ↓
     re-analysis
          ↓
     checkpoint / handoff
→ automatic evaluator
→ human review package
→ contract result
→ hypothesis result
→ report
```

---

# 5. Estructura recomendada

Extender la estructura existente con una organización equivalente a:

```text
tests/
└── ai-harness/
    └── portfolio-entry/
        ├── fixtures/
        │   ├── regression/
        │   │   └── single-turn/
        │   ├── v0.2/
        │   │   ├── single-turn/
        │   │   ├── multi-turn/
        │   │   └── hypotheses/
        │   └── holdout/
        │       ├── single-turn/
        │       └── multi-turn/
        │
        ├── schemas/
        │   ├── fixture.schema.ts
        │   ├── single-turn-fixture.schema.ts
        │   ├── session-fixture.schema.ts
        │   ├── analysis.schema.ts
        │   ├── session-trace.schema.ts
        │   ├── handoff.schema.ts
        │   └── human-review.schema.ts
        │
        ├── prompts/
        │   └── v0.2/
        │       ├── manifest.json
        │       ├── agent.md
        │       ├── entry-01-intent-detection.md
        │       ├── entry-02-context-extraction.md
        │       ├── entry-03-reverse-alignment.md
        │       └── entry-04-question-planner.md
        │
        ├── adapters/
        │   ├── portfolio-entry-agent-adapter.ts
        │   ├── deterministic-adapter.ts
        │   └── live-llm-adapter.ts
        │
        ├── agent/
        │   ├── experimental-portfolio-entry-agent.ts
        │   └── portfolio-entry-session-controller.ts
        │
        ├── session/
        │   ├── scripted-user-responder.ts
        │   ├── question-budget.ts
        │   └── session-safety-limits.ts
        │
        ├── evaluator/
        │   ├── hard-checks.ts
        │   ├── contract-scorer.ts
        │   ├── session-checks.ts
        │   ├── hypothesis-evaluator.ts
        │   └── failure-taxonomy.ts
        │
        ├── review/
        │   ├── human-review-template.ts
        │   └── merge-human-review.ts
        │
        ├── reporting/
        │   ├── report.ts
        │   └── compare-runs.ts
        │
        ├── types.ts
        └── runner.ts
```

La estructura exacta puede adaptarse a lo que ya existe.

No mover archivos estables solo para coincidir visualmente con este árbol.

---

# 6. Versionado de fixtures

Todo fixture v0.2 debe declarar:

```json
{
  "fixture_version": "0.2",
  "case_id": "PE2-...",
  "case_type": "single_turn"
}
```

o:

```json
{
  "fixture_version": "0.2",
  "case_id": "PE2-...",
  "case_type": "multi_turn"
}
```

Los fixtures v0.1 existentes pueden mantenerse en su formato original mediante:

- loader backward-compatible; o
- migración explícita a `regression/`.

No destruir el historial anterior.

---

# 7. Schema base de fixture

Union conceptual:

```ts
type PortfolioEntryFixture =
  | SingleTurnFixture
  | MultiTurnFixture;
```

Campos comunes:

```ts
type FixtureBase = {
  fixture_version: "0.2";
  case_id: string;
  name: string;
  suite: string;
  tags: string[];

  evidence_role:
    | "regression"
    | "contract"
    | "hypothesis"
    | "benchmark"
    | "holdout";

  linked_findings?: string[];
  linked_hypotheses?: string[];

  human_review_required?: boolean;
};
```

---

# 8. Single-turn fixture

Formato recomendado:

```ts
type SingleTurnFixture = FixtureBase & {
  case_type: "single_turn";

  input: string;

  expected: {
    initial_entry_state?: string[];
    current_frame?: string[];
    primary_intent?: string[];
    secondary_intents_any_of?: string[];
    reverse_alignment_required?: boolean;
    subject_type?: string[];
    max_questions?: number;
  };

  context_expectations?: {
    must_include?: ContextExpectation[];
    must_not_invent?: string[];
    ambiguities_expected?: string[];
  };

  prohibited_behaviors?: string[];

  scoring_dimensions?: string[];
};
```

No exigir wording exacto cuando el contrato permite varias formulaciones válidas.

---

# 9. Multi-turn fixture

Formato recomendado:

```ts
type MultiTurnFixture = FixtureBase & {
  case_type: "multi_turn";

  initial_user_message: string;

  session: {
    initial_mode: "quick_clarification";
    quick_question_budget: 3;

    exploration_policy:
      | "accept_if_offered"
      | "reject_if_offered"
      | "not_expected";
  };

  response_rules: ScriptedResponseRule[];

  expected_session: {
    initial_entry_state?: string[];
    allowed_frame_transitions?: FrameTransition[];
    late_reverse_alignment_required?: boolean;
    max_quick_questions?: number;
    handoff_required?: boolean;
    allowed_handoff_status?: string[];
  };

  hard_assertions?: string[];
};
```

---

# 10. No usar un simple array ciego de respuestas

Evitar:

```json
"scripted_user_turns": [
  "respuesta 1",
  "respuesta 2",
  "respuesta 3"
]
```

como única estrategia.

Problema:

> Si el agente hace una pregunta equivocada, el runner podría entregarle igualmente la respuesta que necesitaba y ocultar el fallo.

Preferir reglas de respuesta ligadas al gap que la pregunta declara resolver.

---

# 11. Scripted User Responder

Las preguntas del Question Planner deben conservar:

```text
question.id
question_type
resolves[]
```

El fixture puede definir:

```ts
type ScriptedResponseRule = {
  when_resolves_any: string[];
  response: string;
  once?: boolean;
};
```

Ejemplo:

```json
{
  "when_resolves_any": [
    "decision_to_enable",
    "decision_need"
  ],
  "response": "Necesitamos decidir cuáles iniciativas reciben presupuesto."
}
```

Fallback:

```json
{
  "when_resolves_any": ["*"],
  "response": "No tengo más claridad sobre eso por ahora."
}
```

Esto permite penalizar preguntas irrelevantes en vez de recompensarlas accidentalmente.

---

# 12. Respuesta a múltiples preguntas simultáneas

Si un Question Plan contiene 2–3 preguntas, el scripted responder debe:

1. evaluar cada `resolves`;
2. componer una sola respuesta de usuario coherente;
3. registrar qué reglas fueron consumidas.

Debe guardar:

```text
response_rule_ids_used
unmatched_questions
```

Si una pregunta no coincide con ningún gap esperado:

```text
unmatched_question = true
```

y puede contribuir a:

```text
F-QUESTION_WEAK
```

---

# 13. Portfolio Entry Agent Adapter v0.2

Mantener una interfaz única.

Conceptualmente:

```ts
export interface PortfolioEntryAgentAdapter {
  analyzeTurn(input: {
    entryId: string;
    sessionId?: string;

    rawInput: string;

    priorAnalysis?: PortfolioEntryAnalysisV2;
    sessionContext?: SessionContext;

    candidate: CandidateMetadata;
  }): Promise<PortfolioEntryTurnResult>;
}
```

El runner nunca debe depender directamente del SDK del proveedor.

---

# 14. Output por turno

Conceptualmente:

```ts
type PortfolioEntryTurnResult = {
  analysis: PortfolioEntryAnalysisV2;

  question_plan: QuestionPlan;

  handoff_candidate?: PortfolioEntryHandoff;

  execution: {
    adapter_mode: "deterministic_baseline" | "live_llm_candidate";
    duration_ms: number;
    retries: number;
  };
};
```

El Agent no decide silenciosamente canonicalización.

---

# 15. Analysis v0.2 mínimo

El schema experimental debe representar:

```ts
type PortfolioEntryAnalysisV2 = {
  entry_id: string;
  analysis_version: string;

  primary_intent: string;
  secondary_intents: string[];

  initial_entry_state: string;
  current_frame: string;

  extracted_context: Record<string, unknown>;

  ambiguities: unknown[];
  contradictions: unknown[];

  reverse_alignment: {
    required: boolean;
    subject_type?: string;
    present_links?: unknown[];
    missing_links?: unknown[];
    activation_reason?: string;
  };

  provenance: unknown;

  status:
    | "pending"
    | "ready"
    | "insufficient_input"
    | "failed"
    | "superseded";
};
```

No fijar en Harness el schema productivo definitivo.

---

# 16. Session Context

Conceptualmente:

```ts
type SessionContext = {
  interaction_mode:
    | "quick_clarification"
    | "guided_exploration";

  quick_question_budget: number;
  quick_questions_asked: number;

  exploration_round: number;
  questions_asked_current_round: number;

  previous_questions: QuestionRecord[];
  answered_gaps: string[];

  exploration_goal?: string;

  user_exploration_choice?:
    | "accept"
    | "reject"
    | "not_offered";

  stop_reason?: string;
};
```

---

# 17. Session Controller

Crear una capa experimental:

```text
portfolio-entry-session-controller
```

Responsabilidades:

1. iniciar `quick_clarification`;
2. entregar budget disponible al Question Planner;
3. acumular preguntas;
4. aplicar respuestas;
5. volver a ejecutar análisis;
6. decidir si existe suficiente contexto;
7. ofrecer Guided Exploration cuando corresponde;
8. respetar choice explícita del usuario;
9. iniciar una ronda de exploration;
10. cerrar en handoff;
11. registrar toda transición.

No puede:

- canonicalizar;
- activar Steps;
- definir experimentos;
- modificar contratos.

---

# 18. Budget Quick Clarification

Regla contractual:

```text
quick_question_budget = 3
```

Cálculo:

```ts
availableQuestionBudget =
  Math.max(
    0,
    quickQuestionBudget - quickQuestionsAsked
  );
```

El Question Planner recibe ese valor.

Hard fail si:

```text
quick_questions_asked > 3
```

sin cambio explícito de modo.

---

# 19. Guided Exploration

Solo activar si:

```text
clarification_status = exploration_offered
+
user_exploration_choice = accept
```

Cada ronda recibe:

```text
available_question_budget = 3
```

como máximo local de la ronda.

Esto **no significa** que el contrato de producto ya haya congelado una cantidad máxima de rondas.

---

# 20. Safety limits del laboratorio

Como el contrato no congela todavía un máximo absoluto de rondas, el runner necesita límites técnicos solo para evitar procesos infinitos.

Definir defaults de laboratorio:

```text
MAX_EXPLORATION_ROUNDS = 3
MAX_TOTAL_USER_TURNS = 12
MAX_TOTAL_MODEL_CALLS = 20
```

Estos valores:

- NO son product contract;
- NO deben presentarse como regla UX;
- solo protegen el Harness.

Si se alcanzan:

```text
execution_guard_triggered = true
failure_code = F-SESSION_LOOP
```

y la corrida se detiene.

---

# 21. Checkpoint obligatorio

Después de cada ronda de Guided Exploration, el Session Controller debe registrar:

```text
exploration_goal
questions_asked
clarity_delta
remaining_uncertainties
handoff_ready
```

y simular/solicitar la decisión:

```text
continue_exploration
or
show_handoff
```

No iniciar otra ronda silenciosamente.

---

# 22. Deterministic baseline

La implementación determinística v0.1 debe congelarse como baseline.

No seguir modificándola caso por caso para mejorar scores v0.2.

Opciones válidas:

### Opción preferida

Mantenerla intacta y crear:

```text
experimental-portfolio-entry-agent-v0.2.ts
```

para la lógica determinística necesaria de sesión.

### Opción aceptable

Si el runner actual ya separa claramente adapter y implementation, envolver el baseline v0.1 sin modificar sus heurísticas.

Regla:

> El baseline sirve para validar infraestructura, no para demostrar inteligencia.

---

# 23. Live LLM Adapter

Crear un adapter aislado y provider-agnostic.

Conceptualmente:

```ts
interface StructuredModelAdapter {
  generate<T>(input: {
    systemPrompt: string;
    userPayload: unknown;
    schema: unknown;
    metadata: CandidateMetadata;
  }): Promise<T>;
}
```

El Harness puede implementar un provider concreto solo detrás de esta interfaz.

No acoplar:

```text
runner
→ provider SDK
```

---

# 24. Configuración live

Variables conceptuales:

```text
PORTFOLIO_ENTRY_HARNESS_PROVIDER
PORTFOLIO_ENTRY_HARNESS_MODEL
PORTFOLIO_ENTRY_HARNESS_API_KEY
PORTFOLIO_ENTRY_HARNESS_TEMPERATURE
```

Los nombres exactos pueden adaptarse al repo.

Nunca:

- hardcodear API keys;
- guardar keys en runs;
- reutilizar secrets productivos sin autorización;
- enviar PII innecesaria.

---

# 25. Candidate Manifest

Cada run puntuable debe fijar:

```ts
type CandidateMetadata = {
  candidate_id: string;
  adapter_mode: string;

  provider?: string;
  model?: string;
  temperature?: number;
  seed?: string | number;

  prompt_manifest_hash: string;
  contract_manifest_hash: string;

  code_commit?: string;
};
```

Esto permite responder:

> ¿Exactamente qué versión produjo este resultado?

---

# 26. Prompt Manifest

Crear:

```text
prompts/v0.2/manifest.json
```

con:

```json
{
  "prompt_version": "0.2",
  "files": {
    "agent": "...",
    "skill_01": "...",
    "skill_02": "...",
    "skill_03": "...",
    "skill_04": "..."
  }
}
```

El runner debe calcular o guardar un hash de los prompts.

No leer contratos arbitrariamente en runtime y construir prompts de forma no reproducible.

---

# 27. Contract Manifest

Registrar para cada run:

```json
{
  "clarification_handoff": "0.2.1",
  "agent": "0.2",
  "skill_01": "0.2",
  "skill_02": "0.2",
  "skill_03": "0.2",
  "skill_04": "0.2",
  "harness": "0.2",
  "execution_spec": "0.2"
}
```

Idealmente incluir hashes de contenido.

---

# 28. Runner CLI v0.2

Mantener el comando actual si es posible y extenderlo.

Soportar:

```text
--adapter deterministic
--adapter live
```

Filtros:

```text
--case <id>
--suite <name>
--tag <tag>
--type single_turn
--type multi_turn
```

Repetición:

```text
--repeat 3
```

Holdout:

```text
--holdout
```

Human review:

```text
--prepare-human-review
```

No ejecutar holdout por defecto durante loops de desarrollo.

---

# 29. Ejemplos conceptuales de CLI

Regression determinística:

```bash
npm run harness:portfolio-entry -- \
  --adapter deterministic \
  --suite regression
```

Single-turn live:

```bash
npm run harness:portfolio-entry -- \
  --adapter live \
  --type single_turn \
  --repeat 3
```

Caso session:

```bash
npm run harness:portfolio-entry -- \
  --adapter live \
  --case PE2-MT-GE-01
```

Holdout:

```bash
npm run harness:portfolio-entry -- \
  --adapter live \
  --holdout \
  --repeat 3
```

La sintaxis final debe respetar PowerShell/npm del repo actual.

---

# 30. Holdout discipline

Los fixtures holdout deben:

- vivir en directorio separado;
- no cargarse por default;
- requerir flag explícito;
- aparecer separados en report;
- no utilizarse para ajuste iterativo prompt por prompt.

Regla:

```text
development failure
→ ajustar

holdout failure
→ investigar generalización
```

No:

```text
holdout failure
→ editar prompt para ese caso
→ rerun solo ese caso
```

---

# 31. Hard Checks v0.2

Mantener checks v0.1 aplicables y añadir:

### HC-11 — Initial state mutation

Detectar cambio no autorizado de:

```text
initial_entry_state
```

### HC-12 — Existing / desired fidelity

Detectar inversión material:

```text
existing → desired
desired → existing
```

### HC-13 — Quick budget

```text
quick_questions_total <= 3
```

### HC-14 — Guided exploration consent

No entrar a:

```text
guided_exploration
```

sin user choice explícita.

### HC-15 — Exploration checkpoint

No abrir otra ronda sin checkpoint.

### HC-16 — Capability overclaim

No afirmar que Starteria produce evidencia externa no disponible.

### HC-17 — Step leakage

Detectar patrones/outputs estructurados de:

- sample;
- threshold;
- detailed pilot;
- experiment card;
- canonical success criteria;
- gate;
- Step activation.

### HC-18 — Handoff provenance

`recommended_approach` y alternatives deben conservar:

```text
AI_SUGGESTED
UNREVIEWED
```

### HC-19 — Schema conformance

Turn result, session trace y handoff deben pasar Zod.

---

# 32. Step leakage detection

No depender solo de keywords.

Combinar:

1. structural checks;
2. prohibited fields;
3. fixture expectations;
4. human review cuando el wording sea ambiguo.

Ejemplo:

```text
“falta demostrar intención de compra”
```

es válido.

```text
“lanza landing, compra tráfico y usa 5%”
```

es leakage.

No marcar como FAIL la mera aparición de palabras como “piloto” si el usuario las declaró.

---

# 33. Contract scoring

Reutilizar escala:

```text
0 = incorrecto
1 = parcial / review
2 = correcto
```

Dimensiones aplicables:

```text
Intent
Initial State
Current Frame
Context Extraction
Context Fidelity
Provenance
Reverse Alignment
Question Planning
Session Governance
Authority
Step Boundary
Canonicalization
```

Calcular:

```text
contract_score =
sum(points) / sum(max_applicable_points)
```

Thresholds iniciales:

```text
>= 0.90 PASS
0.75–0.89 REVIEW
< 0.75 FAIL
```

Hard failure siempre fuerza FAIL.

---

# 34. Current frame evaluation

No exigir secuencia exacta cuando varias evoluciones sean válidas.

Fixture puede declarar:

```json
{
  "allowed_frame_transitions": [
    ["problem_first", "initiative_first"],
    ["problem_first", "solution_first"]
  ]
}
```

El evaluator debe aceptar cualquiera si está soportada por el contenido.

---

# 35. Question quality checks

Automático:

- count;
- budget;
- repeated question IDs;
- identical normalized wording;
- `resolves` vacío;
- question type inválido.

Humano:

- si la pregunta era realmente necesaria;
- si reduce incertidumbre;
- si introduce recomendación disfrazada;
- si es fácil de responder.

---

# 36. Handoff schema

Schema conceptual:

```ts
type PortfolioEntryHandoff = {
  understanding: string;
  desired_outcome: string;

  decision_to_enable?:
    | string
    | "unresolved";

  recommended_approach?: SuggestedApproach;
  alternative_approaches?: SuggestedApproach[];

  known_context: unknown[];
  unresolved_context: unknown[];

  gap_resolution_map: GapResolution[];

  evidence_or_clarity_needed: unknown[];
  starteria_path: unknown[];

  recommended_cta?: string;

  provenance_summary: unknown;

  handoff_status:
    | "ready"
    | "ready_with_uncertainty"
    | "insufficient_input";
};
```

Este schema es experimental.

No convertirlo todavía en product DTO.

---

# 37. GapResolution schema

Conceptualmente:

```ts
type GapResolution = {
  gap_id: string;
  gap_description: string;

  resolution_type:
    | "STARTERIA_CAN_STRUCTURE"
    | "STARTERIA_CAN_GUIDE"
    | "STARTERIA_CAN_TRACK"
    | "REQUIRES_ORGANIZATIONAL_INPUT"
    | "REQUIRES_EXTERNAL_EVIDENCE"
    | "OUT_OF_SCOPE";

  starteria_capability?: string;

  resolution_stage:
    | "PORTFOLIO"
    | "INITIATIVE_SETUP"
    | "STEP_0"
    | "STEP_1"
    | "STEP_2"
    | "STEP_3"
    | "STEP_4"
    | "EXTERNAL";

  provenance?: unknown;
};
```

El `resolution_stage` es una referencia de routing conceptual para testing.

No activa ningún Step.

---

# 38. Hypothesis evaluator

No debe transformar automáticamente scores humanos en una verdad contractual.

Output conceptual:

```ts
type HypothesisEvaluation = {
  hypothesis_id: string;

  result:
    | "SUPPORTED"
    | "INCONCLUSIVE"
    | "CONTRADICTED"
    | "N/A";

  automatic_signals: Record<string, unknown>;
  human_signals?: Record<string, unknown>;

  rationale_summary: string[];
};
```

No actualizar automáticamente el Findings Register.

---

# 39. Human Review Package

Cada run que incluya sesiones/hypotheses debe generar:

```text
HUMAN_REVIEW.md
human-review.json
```

`HUMAN_REVIEW.md` debe listar:

- case id;
- conversation trace;
- final handoff;
- rating fields;
- reviewer notes.

No mostrar chain-of-thought.

---

# 40. Human review schema

Conceptualmente:

```ts
type HumanReview = {
  run_id: string;
  case_id: string;
  reviewer_id?: string;

  understanding_quality: 1 | 2 | 3 | 4 | 5;
  clarity_gained: 1 | 2 | 3 | 4 | 5;
  question_efficiency: 1 | 2 | 3 | 4 | 5;

  recommended_approach_quality?: 1 | 2 | 3 | 4 | 5;
  alternative_relevance?: 1 | 2 | 3 | 4 | 5;
  gap_resolution_accuracy?: 1 | 2 | 3 | 4 | 5;

  handoff_clarity: 1 | 2 | 3 | 4 | 5;
  starteria_value_visibility: 1 | 2 | 3 | 4 | 5;
  cta_relevance: 1 | 2 | 3 | 4 | 5;

  generic_chat_feeling: 1 | 2 | 3 | 4 | 5;

  step_leakage: boolean;
  capability_overclaim: boolean;

  notes?: string;
};
```

---

# 41. Merge de human review

Crear un comando o función que:

1. lea `human-review.json`;
2. valide schema;
3. lo una con `evaluated-results.json`;
4. regenere `REPORT.md`;
5. genere hypothesis results actualizados.

No modificar raw output.

---

# 42. Resultados por caso

Guardar separadamente:

```ts
{
  contract_result: "PASS" | "REVIEW" | "FAIL",
  hypothesis_result:
    | "SUPPORTED"
    | "INCONCLUSIVE"
    | "CONTRADICTED"
    | "N/A"
}
```

Un caso puede:

```text
contract_result = PASS
hypothesis_result = CONTRADICTED
```

y eso es válido.

---

# 43. Repeat mode live LLM

Cuando:

```text
--adapter live
```

y:

```text
--repeat N
```

registrar estabilidad de:

- intent;
- initial state;
- final current frame;
- reverse alignment;
- question count;
- handoff status;
- hard failures.

No elegir automáticamente “el mejor” de N.

Cada repetición cuenta.

---

# 44. Stability summary

Ejemplo:

```text
PE2-MT-01

Runs: 3

Initial state stable:
3/3

Late reverse alignment:
3/3

Quick budget:
3/3

Handoff:
2 ready
1 ready_with_uncertainty

Hard fails:
0

STABILITY:
PASS
```

---

# 45. Retry policy

Retry solo por error técnico transitorio.

No usar retry para conseguir una respuesta semánticamente mejor.

Defaults:

```text
MAX_TECHNICAL_RETRIES = 1
```

Registrar:

```text
retry_reason
retry_count
```

No self-reflection loop.

---

# 46. Persistencia de runs

Mantener:

```text
tmp/ai-harness/portfolio-entry/runs/<run-id>/
```

Contenido recomendado:

```text
run.json
candidate.json
contract-manifest.json
prompt-manifest.json

raw-results.jsonl
session-traces.jsonl
evaluated-results.json

HUMAN_REVIEW.md
human-review.json

REPORT.md
HYPOTHESES.md
```

No sobreescribir runs anteriores.

---

# 47. `run.json`

Debe incluir:

```text
run_id
timestamp
fixture_version
adapter
candidate_id
cases
suite
tags
repeat
holdout_mode
human_review_required
git_commit_if_available
```

---

# 48. `session-traces.jsonl`

Una línea por ejecución de sesión.

Debe incluir:

```text
case_id
run_index
turns
interaction_mode_transitions
questions_total
quick_questions_total
exploration_rounds
stop_reason
handoff
hard_failures
execution_guard_triggered
```

No guardar chain-of-thought.

---

# 49. Report v0.2

`REPORT.md` debe separar:

```text
A. CONTRACT CONFORMANCE
B. HYPOTHESIS VALIDATION
C. STABILITY
D. HUMAN REVIEW STATUS
E. FAILURE DISTRIBUTION
F. HOLDOUT RESULTS
```

No producir un único porcentaje global que mezcle reglas y UX.

---

# 50. `HYPOTHESES.md`

Formato recomendado:

```text
HYP-001
Status before run:
Cases:
Automatic signals:
Human signals:
Result:
Reason:
Next decision:
```

Lo mismo para HYP-002, HYP-003 y HYP-004.

---

# 51. Candidate comparison

Añadir una utilidad ligera para comparar dos runs.

Input:

```text
run A
run B
```

Output:

```text
contract regressions
hard failure delta
question burden delta
handoff clarity delta
starteria value delta
generic chat delta
hypothesis delta
```

No declarar ganador automáticamente si falta human review.

---

# 52. Regression v0.1 → v0.2

Antes de nuevos hypotheses:

1. cargar fixtures v0.1;
2. adaptar `entry_state` a:
   - `initial_entry_state`
   - `current_frame`;
3. ejecutar deterministic baseline;
4. comprobar que la infraestructura sigue detectando hard fails;
5. documentar diferencias esperadas por cambio contractual.

No intentar preservar un 32/32 exacto si las expectativas v0.2 cambiaron legítimamente.

---

# 53. Fixtures v0.2 mínimos

Implementar al menos:

## Single-turn

- `PE2-ST-GOV-01`
- `PE2-ST-GOV-02`
- `PE2-ST-CF-01`
- `PE2-ST-CF-02`
- `PE2-ST-CF-03`
- `PE2-ST-SG-01`
- `PE2-ST-SG-02`

## Multi-turn

- `PE2-MT-01`
- `PE2-MT-02`
- `PE2-MT-QC-01`
- `PE2-MT-QC-02`
- `PE2-MT-GE-01`
- `PE2-MT-GE-02`
- `PE2-MT-HO-01`
- `PE2-MT-HO-02`

## Hypothesis

- `PE2-HYP-RA-01`
- `PE2-HYP-GAP-01`
- `PE2-HYP-GAP-02`
- `PE2-HYP-ACC-01`
- `PE2-HYP-ACC-02`
- `PE2-HYP-ACC-03`

Además de regresión válida v0.1.

---

# 54. Benchmark fixtures

Crear cuatro fixtures benchmark largos y separados de la suite normal.

Tags recomendados:

```text
benchmark
human-review
multi-turn
```

No exigir exact matching.

Deben evaluar:

```text
BENCH-01
growth / corporate accelerator

BENCH-02
R&D / many ideas

BENCH-03
construction / pilot emerges late

BENCH-04
insurance / commercial propositions
```

---

# 55. Holdout mínimo

Reservar al menos 20% de casos v0.2 nuevos.

No copiar literalmente ejemplos contractuales.

El holdout debe incluir, como mínimo:

- 1 ambiguous-first;
- 1 no-question-needed;
- 1 late-solution;
- 1 existing-vs-desired;
- 1 external-evidence gap;
- 1 mixed intent.

---

# 56. Failure taxonomy v0.2

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
F-SCHEMA
F-EXECUTION
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

# 57. Tests unitarios del Harness

Sin llamar a modelo real, cubrir:

### Fixture / schema

- cargar union single/multi-turn;
- rechazar fixture inválido;
- separar holdout.

### Session controller

- Quick budget inicia en 3;
- consume correctamente;
- no hace cuarta pregunta;
- Guided Exploration requiere accept;
- reject produce handoff/checkpoint;
- safety guard detiene loop.

### Scripted responder

- responde por `resolves`;
- detecta unmatched question;
- no reutiliza rule `once`.

### Hard checks

- initial state mutation;
- existing/desired inversion;
- capability overclaim structured flag;
- canonicalization;
- Step activation;
- quick overflow.

### Reporting

- contract/hypothesis separados;
- human review pending;
- compare runs;
- repeat stability.

---

# 58. No usar LLM-as-judge en primera implementación

v0.2 puede usar automatización para checks estructurados.

No añadir todavía otro modelo como juez de:

- claridad;
- recomendación;
- UX;
- valor de Starteria.

Razón:

> primero necesitamos una referencia humana estable antes de automatizar juicio semántico.

Un LLM judge puede evaluarse posteriormente como una hipótesis separada.

---

# 59. Orden de implementación

Implementar secuencialmente.

## Fase 1 — Compatibilidad

- schemas v0.2;
- fixture union;
- v0.1 regression loader;
- contract manifest;
- candidate manifest.

## Fase 2 — Session engine

- SessionContext;
- Question Budget;
- Scripted User Responder;
- Session Controller;
- session trace.

## Fase 3 — Evaluation

- hard checks v0.2;
- contract scorer;
- failure taxonomy;
- hypothesis result structure.

## Fase 4 — Handoff

- handoff schema;
- GapResolution schema;
- provenance checks.

## Fase 5 — Live candidate

- live LLM adapter;
- prompt manifest;
- repeat/stability.

## Fase 6 — Human review

- review package;
- merge review;
- hypotheses report.

## Fase 7 — Holdout / compare

- holdout execution;
- compare runs.

No saltar a live LLM antes de que Fases 1–4 pasen unit tests.

---

# 60. Orden recomendado de corridas

Cuando la infraestructura esté lista:

```text
1. unit tests
2. deterministic regression
3. deterministic v0.2 session smoke
4. live single-turn
5. live scripted multi-turn
6. benchmark human review
7. hypotheses human review
8. holdout
9. findings update
```

---

# 61. Criterios técnicos de implementación completada

La infraestructura v0.2 está lista cuando:

- fixtures v0.1 siguen cargando o están migrados con trazabilidad;
- fixtures single-turn v0.2 cargan;
- fixtures multi-turn v0.2 cargan;
- session controller ejecuta sesión completa;
- Quick Clarification respeta budget;
- Guided Exploration requiere opt-in;
- safety guard funciona;
- late reverse alignment puede observarse en trace;
- handoff se persiste;
- hard checks v0.2 funcionan;
- report separa contract/hypotheses;
- human review package se genera;
- repeat mode sigue funcionando;
- holdout requiere flag explícito;
- unit tests pasan;
- cero side effects productivos.

---

# 62. Criterio para ejecutar live LLM

No conectar modelo real hasta que:

- schemas pasen;
- deterministic adapter corra;
- session controller pase tests;
- hard checks estén activos;
- run metadata se persista;
- secrets estén aislados.

Si falta alguno:

```text
NO LIVE RUN
```

---

# 63. Criterio de salida hacia Product Tech Spec

No avanzar por un simple:

```text
tests green
```

Se requiere evidencia de:

### Contract

- 0 hard failures críticos recurrentes;
- state/provenance/context fidelity estable;
- no canonicalization;
- no Step leakage;
- Quick budget respetado.

### Experience

- handoff comprensible;
- Starteria value visible;
- Guided Exploration no genera loops graves;
- recommendations no sobreafirman;
- gaps se mapean con honestidad.

### Decision

Debe documentarse:

```text
ADOPT FOR MVP
KEEP EXPERIMENTAL
DEFER
REJECT
```

para cada HYP-001…HYP-004.

---

# 64. No hacer durante esta implementación

No:

- tocar producto;
- crear endpoint productivo;
- persistir PortfolioEntryDraft productivo;
- integrar con Prisma;
- crear nueva arquitectura multi-agent;
- añadir vector DB/RAG;
- crear UI;
- resolver Docker/CD;
- “optimizar” el deterministic agent hasta 100%;
- usar holdout como development suite;
- auto-promover hipótesis a findings.

---

# 65. Definition of Done

- [ ] v0.1 baseline preservado;
- [ ] fixture schemas v0.2;
- [ ] single-turn executor;
- [ ] multi-turn executor;
- [ ] Session Controller;
- [ ] Scripted User Responder;
- [ ] Quick Clarification budget;
- [ ] Guided Exploration opt-in;
- [ ] laboratory safety guards;
- [ ] Analysis v0.2 schema;
- [ ] Handoff schema;
- [ ] GapResolution schema;
- [ ] Agent Adapter v0.2;
- [ ] deterministic adapter;
- [ ] live adapter boundary;
- [ ] candidate manifest;
- [ ] prompt manifest;
- [ ] contract manifest;
- [ ] hard checks v0.2;
- [ ] contract scoring;
- [ ] hypothesis result structure;
- [ ] human review package;
- [ ] merge human review;
- [ ] repeat/stability;
- [ ] holdout mode;
- [ ] compare runs;
- [ ] unit tests;
- [ ] report v0.2;
- [ ] cero cambios productivos.

---

# 66. Principio final

> El Execution Spec v0.2 debe convertir las nuevas hipótesis en experimentos reproducibles, no en arquitectura productiva anticipada.

Y:

> La infraestructura debe hacer visible cuándo Starteria cumple sus contratos, cuándo genera valor y cuándo simplemente aprendió a pasar un fixture conocido.

**Authority addendum:** Any execution-spec case that evaluates reason_to_ask exposure follows accepted product ADR-007 (../../../doc/product-adr/ADR-007-portfolio-entry-reason-to-ask-public-explanation.md) and PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md (../../experience/portfolio-entry/PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md). This adds a narrow case boundary only and does not promote this proposed Execution Spec or authorize productive integration.
