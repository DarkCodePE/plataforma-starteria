# STARTERIA_V2_MANIFEST

**Versión:** v0.1  
**Estado:** Baseline de consolidación propuesto para reconciliación  
**Fecha:** 2026-09-18  
**Propósito:** establecer una única lectura verificable de Starteria V2 separando autoridad de producto, experiencia, IA, diseño, implementación y evidencia.

---

# 1. Regla principal

Starteria V2 no se define por un número de versión aislado ni por el archivo más reciente.

La baseline vigente se determina por:

```text
AUTORIDAD
+ ESTADO DEL ARTEFACTO
+ IMPLEMENTACIÓN REAL
+ TESTS / EVIDENCIA
+ MIGRACIÓN VISUAL
```

Nunca asumir:

```text
archivo más nuevo = autoridad
código existente = decisión aprobada
implementado = V2 visual
hallazgo = solución validada
documento presente = baseline activo
```

---

# 2. Taxonomía de estados V2

## Logic status

```text
STABLE_INVARIANT
ACTIVE_V2_BASELINE
SUPPORTED_FINDING
TESTABLE_HYPOTHESIS
CANDIDATE
SUPERSEDED
HISTORICAL
UNKNOWN
```

## Implementation status

```text
NOT_IMPLEMENTED
EXPERIMENTAL_IMPLEMENTATION
PARTIAL_IMPLEMENTATION
IMPLEMENTED_UNVERIFIED
IMPLEMENTED_VERIFIED
PRODUCTIVE
UNKNOWN
```

## Visual status

```text
V2_MIGRATED
V2_PILOT
V2_TARGET_DEFINED
V2_TARGET_UNRESOLVED
V1_LEGACY
MIXED
NOT_APPLICABLE
UNKNOWN
```

## Evidence status

```text
NO_EVIDENCE
OBSERVED
SUPPORTED
TESTING
VERIFIED
CONTRADICTED
UNKNOWN
```

---

# 2.1 Slice AI_HARNESS_INTERPRET_ADR031

**Registrado:** 2026-09-20 por instrucción explícita del responsable.

```text
slice_id: AI_HARNESS_INTERPRET_ADR031
logic_status: ACTIVE_V2_BASELINE (sólo la política acotada por ADR-031 Accepted)
implementation_status: IMPLEMENTED_VERIFIED (tests herméticos; despliegue externo no acreditado)
visual_status: NOT_APPLICABLE
evidence_status: TESTING (riesgo productivo y estabilidad no certificados)
authority: backend/docs/adr/ADR-027-methodology-agent-harness.md
           backend/docs/adr/ADR-031-confidence-threshold-for-human-escalation.md
entry_boundary: mode=harness / POST /ai/diagnose
exit_boundary: RouteProfile -> GateLadder -> route | confirm | escalate
implementation: ai-service/harness/stages/llm_stages.py
report: docs/analisis-jev/13-adr-031-activation.md
```

Jev es el backend por defecto de INTERPRET del harness; GROUND continúa en OpenRouter.
El corte 0.50 es una decisión operativa provisional aprobada, no una cota de riesgo.
La autoridad Core referenciada en CURRENT_STATE no está presente en este checkout;
esta aprobación sólo cubre la slice descrita y no certifica Starteria V2 completa.

---

## Slice FIRST_VALUE_P3_RUNTIME_PROCESSOR (KAN-86)

```text
slice_id: FIRST_VALUE_P3_RUNTIME_PROCESSOR
logic_status: ACTIVE_V2_BASELINE (solo el boundary CAPABILITY_CONTRACT_APPROVED de KAN-85 y comportamiento KAN-63/A.3.2)
implementation_status: IMPLEMENTED_VERIFIED (local KAN-86 validation; live provider/deployment unverified)
visual_status: NOT_APPLICABLE
evidence_status: TESTING
authority: KAN-85 + KAN-63 + docs/portfolio-lead/06-portfolio-monitoring/experience/FIRST_VALUE_P3_PRODUCTIVE_PROCESSING_CAPABILITY_CONTRACT_v0.1.md
scope: processor síncrono stateless, relaciones provisionales, aclaraciones agrupadas, sin escrituras canónicas ni persistencia durable
exclusions: KAN-83 UI/setup, D2/prefill, Portfolio Entry, Core, Steps 0-4
implementation_report: docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-86_FIRST_VALUE_P3_RUNTIME_PROCESSOR_IMPLEMENTATION_v0.1.md
integration_status: INTEGRATED_IN_GOVERNED_BASELINE (origin/main @ 1b44bc1 / PR #98)
```

## Slice FIRST_VALUE_RUNTIME_HARDENING_PROMOTION (KAN-83)

```text
slice_id: FIRST_VALUE_RUNTIME_HARDENING_PROMOTION
logic_status: ACTIVE_V2_BASELINE (KAN-63/A.3.2 checkpoints; P3 capability bounded by KAN-85)
implementation_status: IMPLEMENTED_VERIFIED (integrated in governed baseline; KAN-99 focused local regression revalidated 2026-10-04)
visual_status: V2_PILOT
evidence_status: SUPPORTED_LOCAL_VALIDATION (real provider and deployed network not verified)
authority: Jira KAN-83 + KAN-63; docs/portfolio-lead/06-portfolio-monitoring/experience/STARTERIA_PORTFOLIO_LEAD_A32_CHECKPOINT_INLINE_REVIEW_v0.1.md; KAN-85 P3 contract
entry_boundary: authenticated /portfolio/setup under PortfolioLeadLayout
exit_boundary: provisional P3 reading and local-only global confirmation; no canonical writes
implementation: front/src/features/portfolio-lead/first-value/PortfolioLeadFirstValuePage.tsx
backend_capability: POST /api/v1/first-value/p3/analyze (KAN-86; integrated)
implementation_report: docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-83_FIRST_VALUE_RUNTIME_HARDENING_PROMOTION_v0.2.md
integration_status: INTEGRATED_IN_GOVERNED_BASELINE (KAN-83/KAN-96 runtime present on current origin/main)
exclusions: D1/D2, Portfolio Entry, Core, Steps 0-4, canonical portfolio writes
```

## Slice KAN74_PORTFOLIO_ENTRY_TO_FIRST_VALUE (KAN-74 / KAN-99)

```text
slice_id: KAN74_PORTFOLIO_ENTRY_TO_FIRST_VALUE
HU: KAN-74; final closure: KAN-99
logic_status: ACTIVE_V2_BASELINE (Portfolio Entry confirmed Brief; exact KAN-97 identity; D1/D2; KAN-63 First Value)
implementation_status: IMPLEMENTED_VERIFIED (KAN-99 full regression and real exit-action journey verified 2026-10-04)
visual_status: V2_PILOT
evidence_status: LOCAL_REGRESSION_PASS (KAN-99 baseline; KAN-109 auth recovery: DELETE x10, Portfolio-first continuation/reload x10, full conversion spec x5 and frontend matrix PASS locally)
semantic_owner: Portfolio Entry through confirmed Brief; Portfolio Lead interprets organizational context; KAN-63 governs P1/P2/P3
authority: Jira KAN-74/KAN-99/KAN-109; KAN-88/89/90/96/97/98/100/101; KAN-63; approved Portfolio Entry Logic Contract
entry_boundary: /public/start → final strategic reading → confirmed Brief
target_exit_boundary: Download | Delete | Work with Starteria → auth/claim if needed → /portfolio/setup → exact D1 → Strategic Intent hydration → explicit P1
canonical_write_boundary: zero StrategicFront/Challenge/Initiative/Step/canonical Portfolio writes before governed Portfolio Lead action
implementation_report: docs/implementation/testing/KAN-109_AUTH_RECOVERY_STABILIZATION_v0.1.md; historical closure: docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-99_KAN74_FINAL_ALIGNMENT_REGRESSION_CLOSURE_v0.1.md
closure_status: KAN74_READY_TO_RESOLVE (real final-action reachability, scoped auth, full E2E wrapper, and quality matrix pass)
```

# 2.2 Slice KAN-64_PUBLIC_LANDING_L1_PRODUCT_FRAMING_HERO

**Registrado:** 2026-09-30 por HU autorizada KAN-64; habilitaciÃ³n sujeta a guardrail.

```text
slice_id: KAN-64_PUBLIC_LANDING_L1_PRODUCT_FRAMING_HERO
HU: KAN-64
slice: Public Landing - L1 Product Framing & Hero
surface: /
logic_status: ACTIVE_V2_BASELINE (framing aprobado por ADR-006; sin cambio de lÃ³gica Core o Portfolio Entry)
implementation_status: IMPLEMENTED_VERIFIED (KAN-64 resolved; baseline revalidated by KAN-102 focused tests)
visual_status: V2_PILOT
evidence_status: LOCAL_REGRESSION_PASS (KAN-102 frontend suite and Landing E2E; no production certification)
semantic_owner: Public Landing V2
portfolio_entry_semantic_owner: UNCHANGED (Portfolio Entry V2)
authority: doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md
           docs/experience/public-landing/STARTERIA_PUBLIC_LANDING_UX_SPEC_v0.1.md
           docs/implementation/public-landing/STARTERIA_PUBLIC_LANDING_FRONTEND_CURRENT_STATE_AUDIT_v0.1.md
           docs/design-system/STARTERIA_PUBLIC_LANDING_PORTFOLIO_ENTRY_CONTINUATION_ARCHITECTURE_v0.1.md
           docs/experience/portfolio-entry/PORTFOLIO_ENTRY_ACCEPTANCE_CHECKLIST_v0.1.md
core_impact: NONE
step_impact: NONE (Steps 0-4 and Adaptive Cycle unchanged)
public_start_runtime_impact: NONE (/public/start runtime unchanged)
early_access_demo_runtime: NOT_AUTHORIZED
implementation_status_note: KAN-64 is RESUELTO in Jira; KAN-102 separately extends the Landing with L2 and convergence framing
scope: Hero and above-the-fold framing; headline/subcopy; basic illustrative Starteria platform model; Portfolio Entry repositioned as an option; reuse PlatformStructure when compatible per audit; strictly necessary L1 tests
excluded: Early Access/Demo runtime or routes; Pilot; backend/API/persistence; Email/Calendar/CRM; commercial routes; /public/start internals; Clarification; Handoff; Agent/Skills; Auth; Core; Steps 0-4; Adaptive Cycle
entry_boundary: public route /
exit_boundary: existing Portfolio Entry entry path only; no new commercial destination
legacy_dependencies: LandingPage currently embeds PortfolioEntryExperience; retain its domain behavior and preserve /public/start; local PlatformStructure is presentation-only and requires audit-confirmed compatibility
adapter_required: NO (presentation-only adaptation; no domain/API adapter authorized)
tests_protecting_current_behavior: PortfolioEntryExperience.test.tsx; routes.public-entry.test.tsx; public-start E2E coverage (see frontend current-state audit)
```

Portfolio Entry conserva su autoridad semÃ¡ntica y comportamiento; esta slice cambia el framing de
la superficie `/` y no altera la ruta directa `/public/start`. Los caminos de Early Access y Demo,
incluida cualquier ruta o comportamiento runtime, no estÃ¡n autorizados por KAN-64.

## KAN-102 — PUBLIC_LANDING_L2_PORTFOLIO_ENTRY_CONVERGENCE

```text
slice_id: PUBLIC_LANDING_L2_PORTFOLIO_ENTRY_CONVERGENCE
HU: KAN-102
logic_status: ACTIVE_V2_BASELINE (ADR-006; Portfolio Entry logic unchanged)
implementation_status: IMPLEMENTED_VERIFIED (local frontend, route and Chromium E2E validation)
visual_status: V2_PILOT (focused Landing adaptation using current Design System primitives)
evidence_status: VERIFIED (623 frontend tests; typecheck/lint/build; focused Chromium journeys)
semantic_owner: Public Landing V2 for /; Portfolio Entry V2 for /public/start
authority: Jira KAN-102; ADR-006; public Landing UX Spec v0.1; Portfolio Entry Logic Contract v0.1;
           Portfolio Entry Clarification/Handoff Contract v0.2.1; Design System Contract v0.1
entry_boundary: / → existing /auth primary Starteria path | optional /public/start strategic clarity path
exit_boundary: existing Portfolio Entry handoff and KAN-74 continuation unchanged
implementation_report: docs/implementation/public-landing/KAN-102_LANDING_ENTRY_CONVERGENCE_v0.1.md
core_impact: NONE
step_impact: NONE (Steps 0–4 unchanged)
continuation_impact: NONE (KAN-74, D1/D2 and P1/P2/P3 unchanged)
reason_to_ask: transported unchanged from planner QuestionRecord through persisted turn/API/frontend DTO; rendered once only for the active question; missing/null/empty omitted
reason_to_ask_authority: REASON_TO_ASK_AUTHORIZED by accepted ADR-007; PUBLIC_EXPLANATION only; no private/model rationale exposure
reason_to_ask_implementation: IMPLEMENTED_VERIFIED locally by backend/frontend suites, typechecks, builds, lint and isolated Portfolio Entry Chromium E2E; see docs/implementation/portfolio-entry/KAN-104_REASON_TO_ASK_FRONTEND_CONVERGENCE_v0.1.md
commercial_destinations: RUNTIME_PENDING / BLOCKED_BY_DESTINATION (Demo/Early Access routes not invented)
```

# 2.3 Slice DEV_CYCLE_HU_TOOLING (KAN-91)

**Registrado:** 2026-10-02 por instrucción explícita del responsable (Orlando), HU KAN-91,
subtarea KAN-92, brief `estado/hu/ciclo-hu-spec.brief.md`.

```text
slice_id: DEV_CYCLE_HU_TOOLING
HU: KAN-91 (HU-0 Spec del ciclo)
logic_status: CANDIDATE (decisiones del brief; la Tech Spec de KAN-95 las fija)
implementation_status: NOT_IMPLEMENTED
visual_status: NOT_APPLICABLE
evidence_status: NO_EVIDENCE
semantic_owner: harness productor (ADR-009), no el producto
authority: AGENTS.md §3 (ciclo de vida de una tarea)
           docs/adr/ADR-009-dos-harnesses-el-producto-y-el-productor.md
           docs/adr/ADR-012-el-ciclo-de-hu-se-paga-por-ruta.md (KAN-93, proposed)
           docs/adr/ADR-013-el-ciclo-de-desarrollo-se-distribuye-como-plugin-aparte.md (KAN-94, proposed)
           docs/governance/ciclo-hu/DEV_CYCLE_HU_TECH_SPEC_v0.1.md (KAN-95; manda desde que se mergea su PR)
scope: triage por rutas R0/R1/R2/Q; skill /spec y corte de HU desde la spec; capa de negocio (scorecard C1 a C4, "Por qué importa", Resumen ejecutivo); calibración de Jev con registro en estado/; plugin starteria-desarrollo con init idempotente; revisión y PR (puerta y radio con Jev, revisor en dos ejes, /retro) y el job typecheck de .github/workflows/ci.yml, que también es gate de CD (ampliado por Orlando el 2026-10-04)
exclusions: plugin de producto starteria-harness y sus skills starteria*; ajuste automático de umbrales de Jev; priorización del backlog por scorecard; código de front, backend, Prisma, ai-service y Core (el job de CI no cambia código: sólo lo verifica)
core_impact: NONE
step_impact: NONE
registered_by: Orlando (responsable), instrucción explícita en la entrevista /hu del 2026-10-02
```

Es tooling del ciclo de desarrollo, no una capacidad de producto: no autoriza cambios en runtime de
Starteria. Mientras la Tech Spec no esté aprobada, este registro sólo habilita los documentos de
KAN-93, KAN-94 y KAN-95.

# 3. Jerarquía de autoridad objetivo

```text
STARTERIA_AUTHORITY
        ↓
CORE v0.2 FACTUAL
        ↓
APPROVED ADRs
        ↓
EXPERIENCE LOGIC CONTRACTS
        ↓
EXPERIENCE / ORCHESTRATION SUBCONTRACTS
        ↓
AGENT CONTRACTS
        ↓
SKILL CONTRACTS
        ↓
TECH SPECS
        ↓
SCHEMAS + TESTS + HARNESS
        ↓
IMPLEMENTATION
```

The external Core v0.3 candidate remains outside this authority chain until
ratified:

```text
Core v0.3 candidate
        ↓
External / reconciliation candidate
        ↓
Not current authority; requires ADR / evidence / re-test before promotion
```

El Design System no redefine esta jerarquía funcional.

Su relación es:

```text
EXPERIENCE CONTRACT
        +
DESIGN SYSTEM V2
        ↓
IMPLEMENTATION SPEC
        ↓
SCREEN / FRONTEND
```

---

# 4. Referencias transversales

## Crazy 8s E2E

`STARTERIA_CRAZY8S_E2E_BASE_LOGIC_v0.1.md`

- north star E2E;
- protege orientación Portfolio Lead;
- conecta intención → iniciativas → evidencia → decisión;
- Steps no es puerta de entrada automática del Portfolio Lead.

## Design System V2

`STARTERIA_DESIGN_SYSTEM_V2_RESTRUCTURE_BASELINE.md`

Clasificación:

```text
logic_status: ACTIVE_V2_BASELINE
implementation_status: PARTIAL_IMPLEMENTATION
visual_status: V2_TARGET_DEFINED
evidence_status: SUPPORTED
```

Gobierna foundations, semantic states, primitives, patterns y semántica visual AI/Human. No contiene autoridad de negocio.

## Landing V4

`STARTERIA_LANDING_V4_IMPLEMENTATION_SPEC.md`

Clasificación:

```text
logic_status: ACTIVE_V2_BASELINE (visual/experience implementation)
implementation_status: VERIFY_IN_REPO
visual_status: V2_TARGET_DEFINED
evidence_status: SUPPORTED
```

Representa y activa Portfolio Entry, pero no redefine su lógica.

## Step Design System Standby Audit

`STARTERIA_STEP_DESIGN_SYSTEM_STANDBY_AUDIT_PROMPT.md`

Clasificación:

```text
logic_status: HISTORICAL / EXECUTION_AID
implementation_status: NOT_APPLICABLE
visual_status: NOT_APPLICABLE
evidence_status: SUPPORTED_BOUNDARY_REFERENCE
```

Sirve para auditar el boundary de migración y no es contrato funcional.

---

# 5. Portfolio Entry — baseline V2 consolidada

```text
STARTERIA_CORE_LOGIC_CONTRACT
        ↓
Approved ADRs
        ↓
PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1
        ↓
PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1
        ↓
PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2
        ↓
entry-01-intent-detection v0.2
entry-02-context-extraction v0.2
entry-03-reverse-alignment v0.2
entry-04-question-planner v0.2
        ↓
PORTFOLIO_ENTRY_AI_HARNESS_v0.2
        ↓
PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2
```
## Reconciliation status

```text
installation_status: PRESENT_IN_REPO
promotion_status: CANDIDATE_RECONCILIATION
```

The v0.2/v0.2.1 Portfolio Entry stack is physically present in the repository.

This does NOT mean that all v0.1 documents are superseded.

Current interpretation:

- `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
  - remains the active approved Experience Contract;
- `PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
  - candidate orchestration/experience subcontract;
- `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
  - candidate Agent Contract;
- Skill 01–04 v0.2
  - candidate Skill Contracts;
- `PORTFOLIO_ENTRY_AI_HARNESS_v0.2.md`
  - candidate test baseline;
- `PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2.md`
  - candidate test baseline;
- `PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md`
  - evidence only.

```text
PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2

role: EVIDENCE
authority: NO
```

Promotion requires:

```text
repository reconciliation
+
reference validation
+
harness validation
+
explicit authority update
```

Evidence, not authority:

```text
PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2
```

CONFLICT
Contract: docs/STARTERIA_AUTHORITY.md section 4 / STARTERIA_V2_MANIFEST.md section 5
Requirement: The v0.2/v0.2.1 Portfolio Entry stack remains candidate until explicit promotion.
Current document/code: The section 5 hierarchy diagram places Clarification/Handoff v0.2.1 beneath the active Logic Contract, while the reconciliation status below it calls the stack candidate.
Observed mismatch: The diagram can be read as an authority chain even though the status says no promotion occurred.
Risk: Implementers may treat candidate orchestration and handoff rules as approved product behavior.
Recommended treatment: KEEP the stack candidate and treat the diagram as dependency/tracing structure only; reconcile the diagram in a separate authority update.
Requires ADR: no, unless product semantics change.

## Supported findings to preserve

- FND-001: `portfolio_governance ≠ initiative_governance`.
- FND-002: preserve `initial_entry_state`, allow `current_frame` to evolve.
- FND-003: preserve `operating_context` and `existing ≠ desired`.
- FND-004: support `success_conditions` and `quality_guardrails` when material.
- FND-005: support late reverse alignment.
- FND-006: session governance is needed above Question Planner.
- FND-007: handoff must show Starteria-specific value.
- FND-008: Portfolio Entry identifies what needs clarification/evidence but must not design detailed Step experiments.
- FND-009: keep `USER_DECLARED`, `EXTRACTED_FROM_USER_TEXT`, `AI_INFERRED`, `AI_SUGGESTED` separate.

## Active hypotheses — not validated rules yet

```text
HYP-001 Quick Clarification + Guided Exploration
HYP-002 Recommended Approach + Alternatives
HYP-003 GapResolutionMap
HYP-004 Program / accelerator support experience
```

## KAN-114A — Critical Reasoning Experience Contract

```text
logic_status: ACTIVE_V2_BASELINE (scoped frozen experience/reasoning contract)
implementation_status: NOT_IMPLEMENTED
visual_status: V2_TARGET_DEFINED
evidence_status: NO_EVIDENCE (contract approval is not runtime evidence)
authority: explicit user instruction 2026-10-06; subordinate to active Portfolio Entry Logic v0.1, Core v0.2 and approved ADRs
scope: provisional critical reading and its user-facing reasoning boundaries
exclusions: runtime, prompts, Skills, schemas, backend, frontend, Portfolio Setup, Core, Steps
treatment: KEEP scoped contract; candidate stack remains unpromoted; Critical Reasoning authority mapping reconciled for planning; runtime implementation still requires a valid implementation HU
traceability: KAN-114A is a local label; no Jira issue with that key was found
```

The frozen contract is `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md`. It establishes no runtime or implementation evidence.

---

## KAN-115 / KAN-116 — Portfolio Entry Live Understanding (114C)

```text
slice_id: PORTFOLIO_ENTRY_LIVE_UNDERSTANDING_114C
HU: KAN-115 — Portfolio Entry — Live Understanding; KAN-116 — 114C integration
dependency: KAN-114 Critical Situation Synthesis (PR #151 merged; reasoning semantic gate ACCEPTED, PASS_WITH_NON_BLOCKING_GAPS)
logic_status: ACTIVE_V2_BASELINE (bounded 114C surface, subordinate to Core v0.2 and the approved Portfolio Entry Logic Contract v0.1)
implementation_status: IMPLEMENTED_VERIFIED (KAN-116 merged in PR #156)
visual_status: V2_PILOT
evidence_status: VERIFIED (PR #156 CI, PostgreSQL integration and full-stack deterministic browser E2E)
semantic_owner: Portfolio Entry V2; KAN-114 supplies the existing Critical Situation Synthesis
merge_commit: be3c494b3980a9fafa67fe613c4a077a863eeffa
feature_head: de2a59beabf49072429ad279d7a8bed3de3c8866
ci: run 37847682123 — all required jobs SUCCESS
db_evidence: PostgreSQL session repository integration step SUCCESS; additive inputIntent migration applied; answer/correction round-trip and legacy default answer verified
browser_evidence: E2E light job SUCCESS; the full-stack Live Understanding Playwright spec completed SUCCESS using the deterministic synthesis test adapter
regression_evidence: Node backend/frontend tests with coverage SUCCESS; focused Live Understanding backend, presentation-boundary and frontend regressions are included
capability: user message -> existing analysis -> persisted turn -> KAN-114 Critical Situation Synthesis -> deterministic presentation allowlist -> response-ephemeral Live Understanding -> explicit correction -> normal clarification lifecycle -> fresh synthesis / Live Understanding
presentation_boundary: provisional, correctable and non-taxonomic; public-safe allowlist excludes raw KAN-114 reasoning metadata
persistence: PortfolioEntryTurn.inputIntent is an additive migration with DEFAULT 'answer' and KEEP_COMPAT; Live Understanding itself is response-ephemeral, is not stored as session/Core truth, and may be absent after full reload
integration_note: KAN-116 adds turn_index ordering to the synthesis input assembly for persisted user messages/corrections; it does not change KAN-114 prompt, output schema or accepted reasoning semantics
exclusions: 114D final handoff/conclusion; candidate_first_movement as recommendation; Starteria Path; Portfolio Setup continuity; Steps; Core canonicalization; persistence of Live Understanding as Core truth; KAN-114 reasoning-semantic changes
migration_status: PARTIAL (this closes the bounded 114C capability, not the broader Portfolio Entry migration)
legacy_treatment: KEEP_COMPAT; no retirement action is authorized or required by 114C
next_authorized_slice: 114D final handoff/conclusion — KAN-119 implementation verified on PR #161; merge pending
```

PR #156 CI evidence: `https://github.com/DarkCodePE/plataforma-starteria/actions/runs/37847682123`. The PostgreSQL integration and full-stack E2E steps completed successfully and were not skipped. This is scoped slice evidence, not global production certification.

## KAN-117 / KAN-119 — Critical Handoff (114D), PR #161

```text
slice_id: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_114D
HU: KAN-117 semantic acceptance; KAN-119 implementation and regression/closure
logic_status: ACTIVE_V2_BASELINE
implementation_status: IMPLEMENTED_VERIFIED
visual_status: V2_PILOT
evidence_status: VERIFIED
semantic_owner: Portfolio Entry V2 for the 114D Critical Handoff; historical legacy handoff consumers remain KEEP_COMPAT
authority: active Portfolio Entry Logic Contract v0.1; accepted/frozen Critical Reasoning Experience Contract v0.1; KAN-114 semantic acceptance; KAN-117/KAN-119 scoped implementation authority
reasoning_source: KAN-114 remains the sole reasoning source
entry_boundary: current Portfolio Entry reasoning / explicit close checkpoint
exit_boundary: confirmed Critical Handoff only
persistence: dedicated durable Portfolio Entry Critical Handoff artifact; sourceContextRevision binds the artifact to current session reasoning context
currentness: latest artifact whose sourceContextRevision matches contextRevision is current; context advance invalidates prior currentness
correction: returns through the existing reasoning/clarification cycle
confirmation: explicit representativeness confirmation; claim != confirmation; it does not certify each claim as objective fact
exclusions: Starteria Path 114E; Portfolio Setup continuity 114F; ADR-003 reconciliation; Core; Steps; scoring; experiment design; distinct alternative ranking
legacy_treatment: KEEP_COMPAT for explicitly historical legacy sessions
evidence: PR #161 (https://github.com/DarkCodePE/plataforma-starteria/pull/161); GitHub CI run #220 / 37995220187 (https://github.com/DarkCodePE/plataforma-starteria/actions/runs/37995220187) at HEAD b16dc03e04b8f3c419bfa5df565914b6613b7112; PostgreSQL repository integration 26/26; CURRENT_114D 6/6; LEGACY_COMPAT 7/7; Live Understanding full-stack E2E 1/1; Node coverage, Prisma schema/migrations, lint/build, Python and CI summary PASS
integration_status: PENDING_MERGE
known_non_blocking_limitation: post-confirmation reopen/correction policy is not generalized as a future reopen feature; confirmed artifact remains immutable under current v0.1 semantics
next_authorized_slice: 114E — NOT_STARTED; requires its own authorized scope
```

PR #161 is not yet integrated into the governed baseline. CI run #220 verifies this bounded 114D implementation on the feature PR; it does not certify all Portfolio Entry or reconcile ADR-003.

# 6. V2 E2E slice map

| Slice | Logic status | Implementation status | Visual status | Evidence status | Treatment |
|---|---|---|---|---|---|
| Authority / Governance | ACTIVE_V2_BASELINE but stale index | IMPLEMENTED | NOT_APPLICABLE | SUPPORTED | UPDATE |
| Core | v0.2 factual current / v0.3 external reconciliation candidate | PARTIAL / PRODUCTIVE dependencies | NOT_APPLICABLE | REQUIRES_RETEST | KEEP v0.2 + ADR/re-test candidate |
| Crazy 8s E2E | ACTIVE_V2_BASELINE / reference | NOT_APPLICABLE | NOT_APPLICABLE | SUPPORTED | KEEP |
| Public Landing - L1 Product Framing & Hero (KAN-64) | ACTIVE_V2_BASELINE (ADR-006) | IMPLEMENTED_VERIFIED; KAN-64 RESUELTO | V2_PILOT | LOCAL_REGRESSION_PASS (KAN-102 revalidation) | KEEP; Early Access/Demo runtime excluded |
| Public Landing L2 + Portfolio Entry Convergence (KAN-102) | ACTIVE_V2_BASELINE (ADR-006) | IMPLEMENTED_VERIFIED (local) | V2_PILOT | VERIFIED (frontend + focused Chromium) | KEEP; commercial destinations pending authority |
| Landing V4 | ACTIVE_V2_BASELINE visual spec | VERIFY_IN_REPO | V2_TARGET_DEFINED | SUPPORTED | RECONCILE |
| Portfolio Entry logic | ACTIVE_V2_BASELINE | PARTIAL_IMPLEMENTATION; KAN-114 + 114C integrated; 114D IMPLEMENTED_VERIFIED_ON_PR #161 | V2_PILOT | VERIFIED for 114C and 114D scoped CI | KEEP bounded slices; PR #161 pending merge |
| Clarification | CANDIDATE + hypotheses | EXPERIMENTAL / VERIFY | V2_PILOT | TESTING | TEST |
| Handoff / Value Handoff Cognition | CANDIDATE + hypotheses | EXPERIMENTAL / VERIFY | V2_PILOT | TESTING | TEST |
| Registration / continuation | CANDIDATE | IMPLEMENTED_UNVERIFIED | MIXED | TESTING | VERIFY grant and full E2E |
| Portfolio Bootstrap | CANDIDATE | IMPLEMENTED_VERIFIED reported | V2_MIGRATED / VERIFY | VERIFIED reported | RECONCILE |
| Portfolio Home | TARGET AUTHORITY FROZEN PH-0 / CANDIDATE | PH-2 read-model implementation evidence; post-merge `GO_WITH_GAPS`; runtime not certified | V2_TARGET_DEFINED; PH-3A evidence only | REQUIRES_RETEST | RECONCILE; PH-3B not implemented |
| Strategic Framing | ACTIVE_V2_BASELINE / APPROVED EXPERIENCE BASELINE (SF-0) | PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED (SF-1, SF-2, SF-3A, SF-3B) | V2_TARGET_DEFINED | TESTING | SF-3C+ not implemented; no end-to-end runtime, UI, Copilot or canonical promotion |
| Strategic Front | CANDIDATE/Core-related | PARTIAL/IMPLEMENTED | V2_MIGRATED DS-07 | SUPPORTED | RECONCILE |
| Challenge | CANDIDATE/Core-related | PARTIAL/IMPLEMENTED | V2_MIGRATED DS-07 | SUPPORTED | RECONCILE |
| Activation / Invitation | TARGET CONTRACT | PARTIAL / PILOT | V2_PILOT DS-08 | SUPPORTED | VERIFY |
| Initiative Overview | CANDIDATE / unresolved | EXISTING LEGACY RUNTIME | V2_TARGET_UNRESOLVED | UNKNOWN | AUDIT FIRST |
| Step 0 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 1 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 2 | STABLE CORE FUNCTION / candidate refinements | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 3 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 4 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step Workspace V2 | TESTABLE_HYPOTHESIS | NOT_IMPLEMENTED | V2_TARGET_UNRESOLVED | NO_EVIDENCE | EXPLORE |
| Harness V2 | ACTIVE TEST BASELINE candidate | VERIFY_REAL_TREE | NOT_APPLICABLE | TESTING | RECONCILE |
| Findings | SUPPORTED_FINDING + hypotheses | NOT_APPLICABLE | NOT_APPLICABLE | SUPPORTED | KEEP / INDEX |
| Design System | ACTIVE_V2_BASELINE | PARTIAL_IMPLEMENTATION | V2_MIGRATED THROUGH DS-08 BOUNDARY | SUPPORTED | PROMOTE / INDEX |

---

# 7. Visual migration boundary

```text
Landing / Portfolio Entry
        ↓
Handoff
        ↓
Portfolio Home
        ↓
Strategic Front
        ↓
Challenge
        ↓
Activation / Invitation
        ↓
==============================
CURRENT V2 VISUAL BOUNDARY
==============================
        ↓
Initiative Overview
        ↓
Step 0
        ↓
Step 1
        ↓
Step 2
        ↓
Step 3
        ↓
Step 4
```

Interpretation:

```text
ABOVE BOUNDARY
= V2 visual direction exists and has been migrated/piloted to varying degrees

BELOW BOUNDARY
= runtime/domain may exist
= UI is not V2 visual authority
= target workspace architecture is exploratory
```

---

# 8. Step platform rule

Until the Step audit is completed:

```text
CORE LOGIC = preserve
DOMAIN LOGIC = inspect before changes
LEGACY UI = not visual authority
STEP WORKSPACE CONCEPT = hypothesis
DESIGN SYSTEM = available building blocks
```

Working principle only:

```text
conversation for work
structure for memory
```

`Step/Nav | Workspace | Copilot` is a conceptual target, not frozen architecture.

---

# 9. Version cleanup rules

## PROMOTE / INDEX

- `STARTERIA_DESIGN_SYSTEM_V2_RESTRUCTURE_BASELINE.md`
- `STARTERIA_LANDING_V4_IMPLEMENTATION_SPEC.md`
- `PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
- `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
- canonical Skill 01 v0.2
- canonical Skill 02 v0.2
- canonical Skill 03 v0.2
- canonical Skill 04 v0.2
- `PORTFOLIO_ENTRY_AI_HARNESS_v0.2.md`
- `PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2.md`
- `PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md`

## KEEP

- `STARTERIA_CRAZY8S_E2E_BASE_LOGIC_v0.1.md`
- `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
- Core candidate pending explicit decision
- relevant approved ADRs
- implementation reports as evidence

## SUPERSEDE / HISTORICAL

- Agent v0.1
- Skills v0.1 after canonical v0.2 promotion
- Clarification/Handoff v0.2 after v0.2.1 installation
- Harness v0.1 as regression/history
- Findings v0.1 after v0.2 installation
- obsolete public Initiative-first PRDs as authority

Do not delete historical documents. Add status banners and replacement links.

---

# 10. Non-authority artefacts

These may be evidence/reference/execution aids only:

```text
audit prompts
Codex prompts
current-state audits
implementation reports
mockups
old PRDs
code behavior
test output
```

---

# 11. V2 change governance

## Experimental UX change

```text
hypothesis
→ experiment
→ evidence
→ supported/rejected
→ update baseline if supported
```

## Contract change

```text
supported finding
→ version contract
→ tests
→ implementation
→ manifest update
```

## Structural/Core change

```text
new evidence
→ ADR
→ Core decision
→ subordinate contracts
→ implementation
```

---

# 12. Definition of consolidated V2

Starteria V2 is reconciled when:

- one active authority tree is documented;
- every active document has one canonical repo path;
- no v0.1 file is silently consumed when a promoted v0.2 exists;
- findings and hypotheses are separated;
- implementation does not grant authority;
- visual migration state is explicit;
- Portfolio Lead remains the initial corporate user orientation;
- Initiative Owner begins only after the appropriate handoff;
- Landing V4 represents Portfolio Entry without redefining it;
- Design System is canonical through the Portfolio/Activation boundary;
- Initiative Overview / Steps are not falsely labeled V2;
- every active slice links authority → implementation → tests/evidence;
- legacy removal is dependency-driven, not name-driven.

---

# 13. Execution checklist

## Phase 0 — Freeze and snapshot

- [ ] Freeze new product feature work temporarily.
- [ ] Record product repo, harness repo, default branches and current commit SHAs.
- [ ] List open PRs touching contracts, Portfolio, DS or Steps.
- [ ] Confirm no unmerged branch contains the only copy of candidate authority docs.

## Phase 1 — Document reconciliation

- [ ] Verify `STARTERIA_AUTHORITY.md`.
- [ ] Verify Core version/status.
- [ ] Verify approved ADR index.
- [ ] Verify Crazy 8s canonical path.
- [ ] Install/index Portfolio Entry v0.2 stack.
- [ ] Select exactly one canonical Skill 04 v0.2.
- [ ] Install/index Findings v0.2.
- [ ] Install/index Harness v0.2 + Execution Spec v0.2.
- [ ] Install/index Design System V2 Baseline.
- [ ] Install/index Landing V4 Implementation Spec.
- [ ] Index Step DS Standby Audit Prompt as execution aid only.
- [ ] Mark superseded documents with explicit banners.
- [ ] Do not delete historical versions.

## Phase 2 — Authority index

- [ ] Create/update `STARTERIA_V2_MANIFEST.md`.
- [ ] Add canonical path for every active document.
- [ ] Add `logic_status`.
- [ ] Add `implementation_status`.
- [ ] Add `visual_status`.
- [ ] Add `evidence_status`.
- [ ] Add supersedes/superseded_by links.
- [ ] Add affected slice.
- [ ] Add linked findings/hypotheses.
- [ ] Update `STARTERIA_AUTHORITY.md` only after canonical paths exist.

## Phase 3 — Product/runtime truth reconciliation

- [ ] Audit Landing `/`.
- [ ] Audit `/public/start`.
- [ ] Compare Landing V4 vs current implementation.
- [ ] Compare Portfolio Entry contracts vs runtime.
- [ ] Verify provisional vs canonical persistence.
- [ ] Verify registration/continuation behavior.
- [ ] Verify Portfolio Bootstrap implementation reports against code.
- [ ] Verify Portfolio Home reports against code.
- [ ] Verify Strategic Front / Challenge runtime against contracts.
- [ ] Verify Activation / Invitation against handoff contract.
- [ ] Classify every mismatch: KEEP / ADAPT / CONSOLIDATE / DEPRECATE / REMOVE / UNKNOWN.

## Phase 4 — Design System reconciliation

- [ ] Verify DS-01 Foundations.
- [ ] Verify DS-02 Primitives.
- [ ] Verify DS-03 AI/Human/Review patterns.
- [ ] Verify DS-04 Page patterns.
- [ ] Verify DS-05 Portfolio Entry/Handoff consumers.
- [ ] Verify DS-06 Portfolio Home consumers.
- [ ] Verify DS-07 Strategic Front/Challenge consumers.
- [ ] Verify DS-08 Activation/Invitation consumers.
- [ ] Identify duplicate primitives/patterns.
- [ ] Mark actual visual state per route.
- [ ] Confirm Initiative Overview and Steps are outside migrated V2 boundary.

## Phase 5 — Harness and evidence reconciliation

- [ ] Verify actual Harness v0.2 code exists where indexes claim.
- [ ] Verify fixtures version.
- [ ] Verify session controller.
- [ ] Verify late reverse alignment tests.
- [ ] Verify `initial_entry_state` preservation.
- [ ] Verify `portfolio_governance`.
- [ ] Verify `operating_context`.
- [ ] Verify provenance separation.
- [ ] Verify Step boundary.
- [ ] Run Contract Conformance separately from Hypothesis Validation.
- [ ] Do not mark HYP-001..004 supported without new evidence.

## Phase 6 — Portfolio Lead E2E check

- [ ] Landing starts from business/portfolio reality.
- [ ] Portfolio Entry does not drift to Initiative Owner.
- [ ] `solution_first` triggers reverse alignment, not Step activation.
- [ ] Handoff can lead to portfolio work, governance, alignment, import or initiative analysis.
- [ ] Registration does not silently force `create Initiative → Step 0`.
- [ ] Portfolio Home answers “what needs attention?”.
- [ ] Portfolio → Initiative activation has an explicit boundary.
- [ ] Initiative Owner starts only after invitation/acceptance/handoff where applicable.

## Phase 7 — Step Platform truth audit

- [ ] Run `STARTERIA_STEP_DESIGN_SYSTEM_STANDBY_AUDIT_PROMPT.md`.
- [ ] Produce `STARTERIA_STEP_PLATFORM_V2_CURRENT_STATE_TRUTH_MAP.md`.
- [ ] Map routes.
- [ ] Map domain actions.
- [ ] Map persistence.
- [ ] Map Step gating.
- [ ] Map evidence/reviews.
- [ ] Map AI/Copilot.
- [ ] Map files/MCP if present.
- [ ] Map invitation/pre-start/overview.
- [ ] Identify legacy UI vs reusable domain logic.
- [ ] Do not redesign yet.

## Phase 8 — Step V2 exploration

- [ ] Compare Guided Workspace.
- [ ] Compare Conversation-First Workspace.
- [ ] Compare Hybrid Workspace.
- [ ] Evaluate structured memory.
- [ ] Evaluate evidence capture.
- [ ] Evaluate Copilot usefulness.
- [ ] Evaluate enterprise traceability.
- [ ] Evaluate implementation complexity.
- [ ] Produce DS gap analysis.
- [ ] Human selects target architecture.
- [ ] Only then create Step Experience Contract.

## Phase 9 — Cleanup plan

- [ ] Classify legacy as SAFE_NOW.
- [ ] AFTER_ADAPTER.
- [ ] AFTER_ROUTE_MIGRATION.
- [ ] AFTER_DB_MIGRATION.
- [ ] KEEP_FOR_COMPATIBILITY.
- [ ] DO_NOT_TOUCH.
- [ ] Remove only after consumer/test evidence.
- [ ] Avoid big-bang deletion.

## Phase 10 — Implementation readiness gate

Do not resume feature implementation until:

- [ ] Authority tree is canonical.
- [ ] Manifest is current.
- [ ] Product/runtime truth map is current.
- [ ] Design System boundary is verified.
- [ ] Harness baseline is verified.
- [ ] Findings vs hypotheses are separated.
- [ ] No unresolved authority conflict affects the next slice.
- [ ] Next implementation slice has a named authority source.
- [ ] Acceptance tests are defined before implementation.

---

# 14. Recommended implementation sequence after reconciliation

```text
1. reconcile Landing V4
2. reconcile Portfolio Entry V2 runtime
3. reconcile Handoff / registration continuation
4. validate Bootstrap / Portfolio Home
5. validate Activation / Invitation
6. only then decide Initiative Overview / Step Workspace V2
```

This preserves the Portfolio Lead journey and prevents Initiative Owner drift.
