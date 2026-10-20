# STARTERIA — Unified E2E Experience Contract v0.1

## 1. Metadata / status

**Document:** STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md. **Version:** v0.1. **Date:** 2026-10-20. **Status:** FROZEN_TOBE_FOR_IMPLEMENTATION_PLANNING, following the explicit human approval recorded in [P2_HUMAN_APPROVAL_PACK.md](P2_HUMAN_APPROVAL_PACK.md) §Final disposition. **Scope:** Portfolio Entry when applicable → Portfolio Lead → Handoff → Initiative/Steps 0–4 → human decision → Portfolio/benefit continuity. **Canonical checkout:** C:/Users/User/proyect-starteria/starteria-KAN-153-recovery-ux, feat/KAN-153-recovery-ux@1e689ea5c54f7513e323e30f58e45e7168738c7c. **P2 gate:** PASS. This freeze approves the bounded E2E experience only; it is not a Core change, ADR, technical design, implementation authorization or runtime PASS.

## 2. Authority and source classification

**Source key / exact path / P0 classification:**

| Key | Exact path | Classification and scope |
|---|---|---|
| AUTH | docs/STARTERIA_AUTHORITY.md | APPROVED_AUTHORITY for hierarchy |
| CORE | doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md | APPROVED_AUTHORITY as factual/current Core; own status “Base fundacional revisada / Por validar” |
| CORE3 | docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md | CANDIDATE; no promotion |
| ADR3 | doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md | APPROVED_ADR; factual Core-v0.3 reference conflict remains P0 CONFLICT-05 |
| ADR4 | doc/product-adr/ADR-004-authenticated-continuation-access-and-initiative-handoff-authority.md | APPROVED_ADR, scoped design decision |
| ADR5 | doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md | APPROVED_ADR, scoped design decision |
| ADR6 | doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md | APPROVED_ADR, public boundary |
| ENTRY | doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md | APPROVED_AUTHORITY, public Entry only |
| ACT | docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md | FROZEN_EXPERIENCE through Start; P0 CONFLICT-01 Core3 reference |
| PLF | docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip!/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0/01_FROZEN_PORTFOLIO/01_FREEZE_DECLARATION.md | FROZEN_EXPERIENCE, Portfolio visual UX |
| PLB | docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip!/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0/01_FROZEN_PORTFOLIO/02_IMPLEMENTATION_BEHAVIOR_CONTRACT.md | FROZEN_EXPERIENCE, Portfolio behavior companion |
| PLH | docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip!/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0/04_REFERENCIA_VISUAL/STARTERIA_PORTFOLIO_LEAD_COPILOT_FIRST_v1.0.html | FROZEN_EXPERIENCE visual exact bytes, not runtime/domain |
| STF | docs/e2e/sources/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/STEPS_TARGET_DESIGN_FREEZE_v0.1.md | FROZEN_EXPERIENCE conditional target, integration/reconciliation pending |
| STH | docs/e2e/sources/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/Starteria_Steps_Conversacion_Card_Viva_v06.html | REFERENCE_ONLY mockup |
| STQ | docs/e2e/sources/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/Starteria_Steps_v06_QA_2_Perfiles.md | TEST_EVIDENCE of mockup, not product |
| CTX | docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md | APPROVED_AUTHORITY for Goal execution governance, subordinate to product authority |
| P0 | docs/e2e/P0_AUTHORITY_SNAPSHOT.md and docs/e2e/P0_SOURCE_MANIFEST.md | AS_IS_EVIDENCE of authority/provenance, not new product law |
| P1 | docs/e2e/P1_RUNTIME_BASELINE.md | AS_IS_EVIDENCE; 25 E2E scenarios BLOCKED |
| OD | docs/e2e/P2_OPEN_DECISION_REGISTER.md | CANDIDATE decision register |
| HAP | docs/e2e/P2_HUMAN_APPROVAL_PACK.md §Final disposition | Human approval record for this P2 experience freeze; no Core/ADR/technical approval |
| INT01 | C:/Users/User/proyect-starteria/starteria-int01-trial/STARTERIA_INT01_INTEGRATION_REPORT_v0.1.md | AS_IS_EVIDENCE only; unmerged INT-01 rules do not govern |
| PL01 | C:/Users/User/proyect-starteria/starteria-portfolio-lead-pl01/PORTFOLIO_LEAD_PL01_INTEGRATION_TECH_SPEC_v0.1.md | REFERENCE_ONLY for this Goal; local PL-01 slice, not unified E2E authority |

**Authority evidence:** AUTH §2 names CORE v0.2 first; AGENTS.md §2 says “El Core Contract vigente es” and “es candidato.” PLF says “publicación en GitHub, aprobación de Core/ADRs, implementación productiva, pruebas E2E ni autorización de despliegue.” STF says “pendiente de aprobación de integración en el repositorio y de reconciliación con las autoridades superiores.” Interpretation: Core3, INT-01, PL-01 and frozen visuals cannot silently create domain authority.

### Rule traceability ledger

Every substantive statement in §§3–34 is indexed here. The quote is a literal excerpt of the listed source; source keys resolve to exact paths above. The P2 human experience checkpoint is now approved as recorded by HAP; a separate domain/actor checkpoint remains pending where stated. Conditional ADR means only if the proposed behavior changes a Core invariant, canonical relation/cardinality, human/AI authority, stable Step function or gating.

| Rule ID | Rule | Classification | Source / heading | Exact quote | Interpretation | Conflict | Human approval | ADR required |
|---|---|---|---|---|---|---|---|---|
| R01 | strategy and Initiative execution remain distinct | REQUIRED_BY_AUTHORITY | CORE INV-01 | “Una capa no reemplaza a la otra.” | Portfolio governs strategy; Owner develops Initiative | none | no new | no |
| R02 | public Entry is optional/provisional | REQUIRED_BY_AUTHORITY | ENTRY §1 | “Portfolio Entry es una experiencia pública opcional de orientación.” | upstream when used, not a PL screen | none | no new | no |
| R03 | default public continuation is Portfolio-oriented after identity/checks | REQUIRED_BY_APPROVED_ADR | ADR3 §3 | “Portfolio continuation by default” | direct Initiative needs explicit exception | P0 CONFLICT-05 factual reference | no new | no for boundary |
| R04 | authentication alone grants no Portfolio authority | REQUIRED_BY_APPROVED_ADR | ADR4 §1 | “Registration never grants organizational authority automatically.” | tenant/role checks remain separate | none | no new | no |
| R05 | frozen PL interaction sequence is preserved visually | REQUIRED_BY_FROZEN_EXPERIENCE | PLF “Se congela” | “aprueba la experiencia Portfolio Lead v1.0 y pide que se implemente sin rediseño ni variación silenciosa” | preserve within UX scope | P0 CONFLICT-04 cardinality | yes for visible change | conditional |
| R06 | Portfolio Home, Portfolio and Decisions have separate jobs | REQUIRED_BY_FROZEN_EXPERIENCE | PLB §6 | “Home, Portafolio y Decisiones: trabajos distintos” | do not collapse three surfaces | none | yes for change | no unless domain change |
| R07 | existing work/history is retained | REQUIRED_BY_AUTHORITY | CORE INV-11 | “conservar el contenido existente” | retroactive reconstruction without erasure | B-02 | no for principle | conditional |
| R08 | alignment is human-confirmed when material | REQUIRED_BY_AUTHORITY | CORE INV-02 | “Starteria no debe inferir silenciosamente el alineamiento estratégico.” | suggested relation is not confirmed | B-03 | yes for alignment | yes if authority changes |
| R09 | Assignment has its own identity | REQUIRED_BY_APPROVED_ADR | ADR5 §1 | “source of truth exclusivo del lifecycle de transferencia entre Portfolio Lead e Initiative Owner.” | separate from Initiative and Step | none | no new | no for identity |
| R10 | Accept never creates Initiative in Assigned Challenge | REQUIRED_BY_FROZEN_EXPERIENCE | ACT CHANGE-01 | “La formulación/creación posterior de una Initiative pertenece a otro workstream.” | pre-Start creation excluded | B-01 | no new | conditional downstream |
| R11 | Accept is distinct from Start | REQUIRED_BY_FROZEN_EXPERIENCE | ACT HC-PR-03 | “Accept no inicia ejecución” | ownership response, no Step | none | owner acts | no |
| R12 | Reject requires reason and does not silently reactivate | REQUIRED_BY_FROZEN_EXPERIENCE | ACT CHANGE-05 | “Reject requiere justificación.” | response and PL follow-up distinct | none | owner acts | no |
| R13 | Start ends Handoff boundary | REQUIRED_BY_FROZEN_EXPERIENCE | ACT CHANGE-06 | “No define la pantalla, Step, ruta ni comportamiento posterior.” | no downstream rule may be inferred from ACT | B-01 | owner acts | conditional downstream |
| R14 | post-Start Route A formulation and human confirmation precede one Initiative | REQUIRED_BY_FROZEN_EXPERIENCE | STF §3 | “persona confirma creación” | P2 human approval freezes the experience; no domain command is approved | B-01 technical detail remains | P2 approved; downstream confirmation still required | conditional |
| R15 | existing Initiative keeps identity/history | REQUIRED_BY_AUTHORITY | CORE INV-10 | “No se sobrescribe silenciosamente la historia.” | Route B cannot duplicate or erase | B-02 | review may apply | conditional |
| R16 | independent Initiative needs no corporate Front/Challenge | REQUIRED_BY_AUTHORITY | CORE INV-02 | “Las iniciativas independientes o públicas pueden existir sin un Frente Estratégico o Reto corporativo.” | Route C remains outside fictitious hierarchy | A/B/C | human creation checkpoint candidate | no if compatible |
| R17 | Overview as pre-Core bridge | REQUIRED_BY_FROZEN_EXPERIENCE | STF §3 | “Invitación → aceptar → overview → Start” | P2 approval retains pre-Start Activation Overview and freezes post-confirmation/continuity Overview without adding a Step | B-01/B-02 technical detail remains | P2 approved | conditional |
| R18 | inherited Challenge constraints are visible | REQUIRED_BY_AUTHORITY | CORE INV-08 | “Una iniciativa asociada al Reto hereda este contexto.” | handoff references/snapshot, not duplicate truth | D-09 | no new | no |
| R19 | Step 0 frames current cycle | REQUIRED_BY_AUTHORITY | CORE §21 Step 0 | “aclarar resultado esperado del ciclo” | expected impact not validated here | none | checkpoint per gate | no |
| R20 | Step 1 establishes truth/focus | REQUIRED_BY_AUTHORITY | CORE §21 Step 1 | “separar hechos, supuestos e hipótesis” | preserve and test prior frame | none | checkpoint per gate | no |
| R21 | Step 2 prepares execution-ready work and measurement | REQUIRED_BY_AUTHORITY | CORE §21 Step 2 | “definir métricas y plan de medición” | distinguish proxy/capacity limits | none | checkpoint per gate | no |
| R22 | Step 3 executes/observes; negative evidence valid | REQUIRED_BY_AUTHORITY | CORE §21 Step 3 | “La evidencia negativa sigue siendo evidencia válida.” | observation does not equal success | none | checkpoint per gate | no |
| R23 | Step 4 prepares package, not organizational decision | REQUIRED_BY_AUTHORITY | CORE §21 Step 4 | “El output de Step 4 no es por sí mismo la decisión organizacional.” | recommendation requires human decision | decision authority | yes | yes if authority changed |
| R24 | conversation not system of record | REQUIRED_BY_AUTHORITY | CORE INV-04 | “el estado confirmado debe vivir en objetos estructurados y versionados.” | Card is a candidate visual representation of state | P3 detail open | checkpoint for material state | no for principle |
| R25 | Copilot + live Card shell | REQUIRED_BY_FROZEN_EXPERIENCE | STF §5 | “UX transversal congelada: conversación + Card viva + herramientas contextuales” | conditional UX target, not proven semantics | STF integration | yes before freeze | conditional |
| R26 | claims require source and review status | REQUIRED_BY_AUTHORITY | CORE INV-05 | “Un resumen generado por IA no se convierte automáticamente en fuente de verdad.” | source, claim, validation, inference differ | none | when required | no |
| R27 | blockers may need external capability | REQUIRED_BY_AUTHORITY | CORE §21 Step 2 | “identificar qué puede hacer el equipo y qué requiere IT, Data, Seguridad, proveedor u otra capacidad externa” | Owner surfaces dependency | SupportRequest object open | resolver authority open | conditional |
| R28 | SupportRequest as governed object | CANDIDATE_TOBE | STF §5.1 | “Usuario bloqueado: propone solicitud contextual al Portfolio Lead/actor adecuado” | object identity/lifecycle require P5 approval | SUPPORT-REQUEST | yes | conditional |
| R29 | AI cannot make organizational decision | REQUIRED_BY_AUTHORITY | CORE INV-03 | “La IA no decide autónomamente” | human decision boundary | decision authority | human decision | yes if changed |
| R30 | Portfolio learns from evidence/decision without rewriting history | REQUIRED_BY_AUTHORITY | CORE INV-10 | “se conserva el estado anterior” | causal return requires version/history | B-03, D-09 | material changes | conditional |
| R31 | L5 observed and L6 attributed require evidence/method | REQUIRED_BY_AUTHORITY | CORE INV-12 | “Para promoverlo a **L6 ATTRIBUTED**, además debe existir un método de atribución defendible y el validador requerido.” | expected/observed/attributed are not interchangeable | D-08 | L6 validator | yes if weakened |
| R32 | benefit tracking can follow Step 4 | REQUIRED_BY_AUTHORITY | CORE INV-12 | “La iniciativa no necesita permanecer abierta en Step 4 durante meses.” | later record linked to decision | D-08 | decision owner | no for concept |
| R33 | shared reasoning placement across journey | CANDIDATE_TOBE | CTX §9 | “La arquitectura TO-BE debe distinguir tres capas.” | P2 placement only; P3 defines operation | P3 open | yes for target | conditional |
| R34 | change review preserves snapshots | REQUIRED_BY_AUTHORITY | CORE §19.1 | “conservar el snapshot utilizado” | no blind upstream overwrite | D-09 | material review | no for principle |
| R35 | runtime E2E unverified | AS_IS_OBSERVED_ONLY | P1 §1 | “25/25 audit journeys remain BLOCKED.” | no product PASS inferred | ENV-01…06 | no | no |

No rule from CORE3, INT01 or PL01 is used as governing authority. R25 and R33 remain candidate as product behavior despite source freeze/execution context: R25 has conditional visual freeze only, and CTX governs Goal procedure, not product semantics. R35 is observation only.

## 3. Purpose

Connect the entire journey at a product-experience level while preserving R01–R34 boundaries. This candidate names the handoffs and open decisions; it does not grant authority to any unresolved path.

## 4. Scope / non-scope

In scope: Entry when applicable, PL frozen setup/Home/Portfolio/Decisions, Handoff to Start, candidate A/B/C continuity, Initiative Overview, Core Steps, evidence, human Decision and causal Portfolio return. Out of scope: API/schema/state-machine technical design, prompts/reasoning details, ADR approval, runtime fixes, deployment and legacy removal. See R02–R06, R13–R17, R33.

## 5. E2E principles

R01 strategy/execution separation; R08 human alignment; R09–R13 distinct transfer states; R15/R26/R34 preserved identity/provenance/history; R23/R29 human decision; R31/R32 honest impact. Candidate connective UX is labeled rather than made canonical.

## 6. Roles and authority boundaries

**Portfolio Lead:** strategic intent, Front/Challenge/coverage, assignment and Portfolio reading (R01, CORE §5 “Gobernar el portafolio estratégico”). **Initiative Owner:** develops Initiative, evidence, Steps and recommendation (CORE §5 “Desarrollar la iniciativa”). **Decision Authority:** human actor authorized for a particular decision; exact actor by type remains OD DECISION-AUTHORITY (CORE §5 “La autoridad debe asociarse a un tipo de decisión”). **Mentor/Reviewer:** methodological/evidence review only when required (CORE §5 “Revisar razonamiento/evidencia cuando sea requerido”). A person may hold multiple roles; the actions retain separate authority checks. AI is assistance only (R29).

## 7. Unified E2E spine — frozen P2 experience

**REQUIRED boundaries:** Entry optional/provisional → Portfolio-oriented continuation by default; PL strategy distinct from Initiative; Assignment→Accept or Reject→Start; Core Initiative→cycle→Steps 0–4→Decision Package→human decision→benefit continuity when applicable (R01–R13, R19–R23, R32). **FROZEN P2 experience spine:** post-Start A/B/C → Overview → governed handoff/read model → causal Portfolio return (R14–R18, R30). The experience freeze does not approve a new canonical domain path, command, actor matrix or Step/cycle rule; those remain subject to Core, applicable ADRs and the P3/P5 boundaries below.

## 8. Portfolio Entry boundary

R02: optional public upstream orientation, not a PL setup moment. R03/ADR3 default: provisional handoff, authentication/claim, restore context, explicit checks, then Portfolio-oriented continuation. ADR4 prevents authentication from granting Portfolio membership or authority (R04). Direct Initiative continuation remains the explicit ADR3 exception with required profile/authority; it is not the default. Exact UX connection from provisional context into PL frozen prompt is **CANDIDATE_TOBE** pending approval; PLF says the prompt is external to PL, so this contract does not insert Entry into its seven setup moments.

## 9. Portfolio Lead journey

Preserve PLF/PLB within their actual visual/experience authority (R05–R06): external context prompt; guided multi-turn objective; provisional result/KPI/signal with unknowns; optional files/text/CSV/zero initiatives; contextual initiative analysis; human review of links/overlap; grouping by Challenge when useful without altering corporate domain; editable brief; assignment table; executive Home; granular Portfolio; Decisions. PLB §2 explicitly says the seven setup moments “No son nuevos objetos canónicos ni equivalen a Steps 0–4 del Core.” Any UX variation requires the freeze change-control checkpoint; any domain/cardinality issue goes to OD D-03/CARDINALITY, not the HTML.

## 10. Existing initiative intake and analysis

R07/R08: preserve source, identity and valid history; show estimated documentary Step separately from actual approved Step, potential duplicate separately from confirmed duplicate, contribution proposal separately from alignment. PLB §4: “Un Step estimado no es progreso real; solapamiento no equivale a duplicado confirmado.” Confirmation is human when material. Intake/import behavior beyond the freeze is CANDIDATE_TOBE until P5 defines ownership and tests; P1 T03/T09 remain BLOCKED.

## 11. Challenge/brief/assignment

CORE §14 gives Challenge result, constraints, decision expected and version; R18 requires associated Initiative to inherit context. PLF/PLB freeze a revisable brief before assignment. ADR5 R09 gives Assignment separate identity, target Challenge or existing Initiative, with no second Initiative source of truth. The brief transfers a mandate, not a Decision Package; no Challenge/Front is created solely because a grouping is useful in the visual flow. D-03/CARDINALITY remain open.

## 12. Accept/Reject/Start

ACT/ADR5 govern through Start (R09–R13). This conceptual transition register is not an API/schema design. “Event” means an auditable semantic fact, not a chosen transport. Candidate rows are expressly non-approved.

| Transition / class | Actor; precondition; before → after | Allowed mutation | Forbidden creation/mutation | Evidence/audit; conceptual retry |
|---|---|---|---|---|
| Assign / R09, R05 | authorized PL; valid target and reviewed brief; unassigned → Assignment pending/invited | Assignment/invitation/brief reference | Initiative, StepState, confirmation of alignment by inference | who assigned, target, brief version; retry must not duplicate Assignment (exact policy P5) |
| Accept / R10–R11 | invited Owner with identity match; sent/viewed → accepted | Assignment acceptance/owner response | new Initiative, StepState, evidence approval | actor/time/version; same-command retry no second acceptance |
| Reject / R12 | invited Owner with reason; sent/viewed → rejected | Assignment response/reason | Initiative deletion, silent reassignment/reactivation | reason/actor/time; retry no duplicate rejection |
| Start / R13, ADR5 | accepted Owner; accepted → started | Assignment state, start audit/event | automatic final Initiative, Step activation, alignment decision | started actor/time/version/event; retry no duplicate transition/event |
| Create Initiative / CANDIDATE_TOBE R14/R16 | authorized confirmer after formulation; candidate → one confirmed Initiative | new Initiative identity and governed link/context | creation merely from Start; fictitious corporate Front/Challenge | confirmation/source/snapshot; same-command retry one Initiative; actor/command open B-01 |
| Activate Step / CANDIDATE_TOBE R17/R19–R23 | authorized Owner/validator under Core gates; reviewed cycle context → active Step | cycle/Step state after checkpoint | retroactive auto-approval, bypass of hard gate | reviewer/gate/evidence/version; retry no duplicate Step; exact selection open B-02/P5 |

For Assign, ACT §2 says its bounded context starts when Portfolio Lead confirms a valid assignment. ADR5 §1 says Accept does not create Project/Initiative and Start registers handoff_assignment_started. Exact event schema and idempotency keys belong to P5.

## 13. Post-Start Route A

**FROZEN P2 EXPERIENCE R14/B-01:** before Start, Challenge + Assignment exist and initiative_ref may be null (ADR5 §1). After Start, Assignment is started; no final Initiative is implied. Approved experience continuity: formulate candidate Initiative from mandate → human review/confirmation → create exactly one Initiative at that checkpoint → Overview → governed Core cycle. Inherit Challenge/Front references, constraints, objective, KPI/signal, horizon, brief/source refs and mandate version when available (R18); do not fabricate evidence, alignment or Step. Exact confirming actor, command, persistence, retry strategy and any proposed cardinality change remain OD B-01/D-03 for P5/ADR as applicable. This approval does not make Start an Initiative creation command.

## 14. Post-Start Route B

**REQUIRED_BY_AUTHORITY identity/history R07/R15, FROZEN P2 EXPERIENCE bridge:** existing Initiative arrives by Assignment/handoff when applicable and retains its ID, sources, evidence, snapshots and work history. Reconstruct known content and critical gaps; expose documentary work and validation status; do not force redo or retrospectively approve a Step. Overview points to the same Initiative. Which cycle/Step can resume and who validates equivalence remain OD B-02 for P5/P6.

## 15. Post-Start Route C

**REQUIRED_BY_AUTHORITY R16, FROZEN P2 EXPERIENCE entry/checkpoint:** independent user Initiative is formulated and human-confirmed before one Initiative identity and Overview; no StrategicFront, Challenge or corporate sponsor is fabricated. It uses Core cycle/Steps with context/authority appropriate to independence. Exact command, confirming actor and persistence remain for P5; no corporate Portfolio return is invented where none applies.

## 16. Initiative Overview

**FROZEN P2 EXPERIENCE R17:** bridge between assignment/formulation/reconstruction and Core work. Show when present: Initiative ID/origin, owner, mandate snapshot/version, Front/Challenge refs or independent status, current lifecycle/cycle/Step, source refs, known gaps, constraints and next permitted action. Display unknown as unknown. It does not execute Step 0, approve retroactive work or decide alignment. P1 reports route declaration but no runtime observation.

## 17. Portfolio → Initiative knowledge handoff

**R18/R26/R34 required boundary; candidate representation:** references remain pointers to canonical Front, Challenge, source and brief; snapshot records the mandate and restrictions used by the cycle; a copy is only a view or frozen excerpt with origin/version, never a second canonical owner. Transfer result/goal, KPI/signal, constraints, horizon, expected decision, brief, SourceRefs, organization context when allowed, and alignment status separately. CORE §14.2 says “Cada ciclo conserva el snapshot del Reto que heredó al comenzar.” Exact envelope/schema belongs to P5; no duplicate entity is authorized here.

## 18. Step 0 function/boundary

**Core function R19:** frame current cycle against inherited/independent context, constraints, resources and intended decision. **Input:** Initiative identity, mandate/snapshot when applicable, known sources and current uncertainty. **Minimum output/handoff:** intelligible current-cycle intent/context and open gaps; exact Card type is CANDIDATE_TOBE/P3. **Human checkpoint:** Core sufficiency/required validator before Step transition. **Evidence:** expected claims may be L0, not validated. **Must not:** rewrite PL goal, ignore inherited constraints, validate expected impact. CORE §Step 0: “Step 0 puede contener claims de impacto esperado L0.”; “No los valida.”

## 19. Step 1 function/boundary

**Core function R20:** establish defensible current truth and focus; facts/suppositions/hypotheses and contradictions separated. **Input:** Step 0 output plus available sources. **Minimum output/handoff:** evidenced focus, critical unknowns and review state; exact Card type candidate/P3. **Human checkpoint:** confirm material reframing/required validation. **Evidence:** existing evidence may satisfy work; provenance retained. **Must not:** erase Step 0 or manufacture certainty. CORE §Step 1: “Step 1 puede cambiar materialmente el framing de Step 0.”

## 20. Step 2 function/boundary

**Core function R21:** design/prepare/build the execution-ready artifact plus Measurement Plan suitable to route/capacity. **Input:** Step 1 focus, constraints, team capability and dependencies. **Minimum output/handoff:** prepared artifact/action, comparator/metric, limits and readiness; exact Card type candidate/P3. **Human checkpoint:** readiness/gates and dependency disposition. **Evidence:** proxy is labeled as proxy. **Must not:** claim a Figma/mockup proves business conversion or force unavailable capability. CORE §Boundary Step 2→3: “Step 2 termina cuando existe algo suficientemente preparado para ser confrontado con la realidad.”

## 21. Step 3 function/boundary

**Core function R22:** execute in defined context, observe, compare expected versus actual and learn. **Input:** Step 2 prepared action/measurement plan. **Minimum output/handoff:** execution record, observations, limitations, supported/refuted/mixed/inconclusive interpretation; exact Card type candidate/P3. **Human checkpoint:** review before claiming validation/advance. **Evidence:** source and time of observations. **Must not:** equate negative evidence with methodological failure or convert interpretation to observation. CORE §Step 3: “La evidencia negativa sigue siendo evidencia válida.”

## 22. Step 4 function/boundary

**Core function R23:** consolidate learning and prepare Decision Package. **Input:** Step 0–3 outputs, evidence/claims, limits, resources, risks. **Minimum output/handoff:** traceable package with requested decision, recommendation, options, evidence and next actor; exact Card type candidate/P3. **Human checkpoint:** authorized organizational decision is separate. **Evidence:** expected versus observed and claim maturity explicit. **Must not:** execute decision or assert L5/L6 without Core criteria. CORE §Step 4: “Prepara el Decision Package.”

## 23. Evidence/provenance boundary

R26 and CORE §8/§29 distinguish source, extraction/claim, evidence status, AI interpretation and human confirmation. The SourceRef follows handoffs; a new source never silently overwrites prior versions (R15/R34). This is conceptual only; P3 handles semantic typing/deltas and P5 schemas. STF/HTML may illustrate Cards but cannot validate evidence.

## 24. Support/blocking boundary

Owner retains Step state. Core Step 2 recognizes missing IT/Data/Security/external capacity (R27); ACT HC-PR-05 says “Portfolio consume estado/eventos posteriores. No controla DOM, rutas, componentes o StepState interno.” Portfolio needs a bounded attention signal with reason, affected work, responsible resolver and state. A separate SupportRequest object/lifecycle is **CANDIDATE_TOBE R28** and OD SUPPORT-REQUEST; no canonical object is approved here. Portfolio may respond within its authority, never directly mutate StepState for convenience.

## 25. Decision boundary

R23/R29: Step 4 output → Decision Package → candidate Decision Request/equivalent → authorized human decision. CORE §25 requires “decisor” and “evidencia relevante” in a decision. AI/team recommendation is separate from organizational choice. Exact actor by decision type, permission and effect remain OD DECISION-AUTHORITY; no universal Portfolio Lead decision authority is invented. P1 decision route existence is AS_IS_OBSERVED_ONLY, not proof of operation.

## 26. Portfolio return

**Candidate connective behavior under R01/R30:** transmit only relevant Initiative state, current cycle/Step, blocker/support, source-linked evidence/claim signal, contribution status, requested/actual decision and next action to Portfolio. Decision references its package and human actor; Portfolio read model may change coverage/attention/status only under confirmed authority, while prior snapshots and decisions remain. CORE §17 asks “¿Qué decisiones requieren atención?” and CORE §30 says “No eliminar automáticamente trabajo posterior.” Exact event/read model, causal identifiers and state changes belong to P5/P10 and OD DECISION-AUTHORITY/D-09. Independent Initiative receives only context-compatible continuity; no corporate Portfolio is fabricated.

## 27. Impact/benefit boundary

Core v0.2 itself has L0 expected/asserted, L3 observed, L5 realized and L6 attributed; R31/R32 are REQUIRED_BY_AUTHORITY. CORE §L3 says “OBSERVED / OBSERVADO”; §INV-12 requires source for L5 and method+validator for L6. Distinct labels expected/observed/attributed are a faithful conceptual reading, not a promotion from CORE3. Exact ROI display and calculation policy remain OD D-08. Benefit Tracking may continue after Step 4 linked to Initiative and authorizing decision; it is not a months-long Step 4.

## 28. Shared reasoning placement

**CANDIDATE_TOBE R33:** shared reasoning may serve Entry, PL, Handoff, Initiative, Steps, Decision and return, alongside specialized capabilities and governance. No new superagent, agent routing, prompt or semantic algorithm is frozen in P2. CTX §9 requires audit of existing agents/skills/services first; P3 owns context recovery, knowledge typing, intervention selection, deltas, sufficiency and checkpoints.

## 29. Governance principles

R08/R24/R26/R29/R31/R34: conversation ≠ system of record; proposed relation ≠ confirmed alignment; claim ≠ evidence; AI recommendation ≠ human decision; expected ≠ observed ≠ attributed; documented progress ≠ approved Step. These distinctions follow CORE INV-02–05, INV-09–12 and are not proof of current implementation.

## 30. Visual continuity rules

PLH exact HTML hash and PLF freeze govern Portfolio visual continuity only (R05–R06); PLF requires change control for altered visible sequence. STF conditionally freezes a Copilot conversation, live Card, contextual evidence and checkpoint shell for Steps (R25), subject to higher authority and P2 approval. STH v0.6 is REFERENCE_ONLY; STQ says “la información se asigna por orden de turno, no por su significado.” That defect is not a product rule or production failure. Preserve Starteria’s conceptual continuity while leaving responsive layout/copy detail to later UX review, never making a visual choice a Core invariant.

## 31. AS-IS → TO-BE gap summary

P1 reports **25/25 E2E scenarios BLOCKED**; no current runtime behavior is promoted to TO-BE authority. Each prior scenario maps to a requirement or open decision:

| Boundary / TO-BE rule | AS-IS current evidence | Gap / decision |
|---|---|---|
| Entry continuation R02–R04 | P1 T01 BLOCKED; route code only | runtime identity/continuity unknown |
| PL Home/intake R05–R08 | P1 T02–T03 BLOCKED | coverage/import behavior unknown; D-03 |
| Assignment→Start R09–R13 | P1 T04–T07 BLOCKED; local 14/14 Handoff tests | live state/retries unknown |
| A/B/C R14–R17 | P1 T08–T10 BLOCKED; static Start handler updates preview | post-Start UX/identity unverified; B-01/B-02 |
| Step 0/Copilot R19/R24–R26 | P1 T11–T13/T25 BLOCKED | semantic Card/unknown/contradiction unverified; P3 |
| Step 1 R20 | P1 T14–T15 BLOCKED | evidence reuse/reframe unverified |
| Step 2/support R21/R27–R28 | P1 T16–T17 BLOCKED | proxy/support unverified; SUPPORT-REQUEST |
| Step 3 R22 | P1 T18–T19 BLOCKED | negative/mixed observation unverified |
| Step 4 R23 | P1 T20 BLOCKED | package/AI failure/credits unverified |
| Decision/return R29–R32 | P1 T21 BLOCKED | human decision and causal Portfolio update unverified |
| Upstream review R34 | P1 T22 BLOCKED | version/review propagation unverified; D-09 |
| Security/authority R04/R08/R29 | P1 T23 BLOCKED | cross-tenant/role runtime unverified; B-03 |
| AI retry/recovery R24/R26 | P1 T24 BLOCKED | recovery/idempotency runtime unverified |

P1 technical blockers remain Docker, bcrypt binding, isolated tenant/actors, AI runtime and deployment identity. P2 does not fix them.

## 32. Open decisions

The full register is OD; HAP records its refined disposition. Post-Start A/B/C Option A is approved **as P2 experience only**. D-03, B-02, D-08, D-09 and cardinality/coverage retain the principles already governed by CORE v0.2, with only their documented P3/P5 details pending. B-01, B-03, DECISION-AUTHORITY and SUPPORT-REQUEST remain pending at their technical/authority boundary. No domain, cardinality, human/AI authority, Step/gating, ROI or new SupportRequest option is silently approved.

## 33. ADR candidates

AUTH §10 says “Detener la implementacion y proponer ADR si el cambio:” and lists “modifica un Invariante Core;”. Candidate ADR triggers: omit/change corporate Challenge relation or cardinality (D-03/CARDINALITY); change Initiative identity/creation authority (B-01); redefine cycle/Step selection or stable Step functions (B-02); widen human/AI decision authority (B-03/DECISION-AUTHORITY); weaken evidence maturity/attribution (D-08); change Core review/gates (D-09); introduce a material canonical SupportRequest model. No ADR is drafted/approved by this document.

## 34. P3 handoff

The approved P2 experience leaves Copilot/Card reasoning to P3 under CORE. P3 must audit existing agents/skills/services before proposing shared reasoning; specify context recovery, knowledge classes, semantic deltas, sufficiency, provenance, versioning, review and negative cases. P3 is not authorized now.

## 35. Acceptance Criteria

| AC | Evidence in this candidate | Result |
|---|---|---|
| P2-AC01 | §2 rule ledger R01–R35 with source/classification/quote | PASS |
| P2-AC02 | §2 CORE3/INT01/PL01 exclusions | PASS |
| P2-AC03 | §§9,30 PLF/PLB bounds | PASS |
| P2-AC04 | §8 Entry optional and separate | PASS |
| P2-AC05 | §6 roles | PASS |
| P2-AC06 | §12 transition table | PASS |
| P2-AC07 | §13 Route A experience frozen by HAP; domain command deferred | PASS |
| P2-AC08 | §14 Route B same ID/history | PASS |
| P2-AC09 | §15 Route C no fictitious hierarchy | PASS |
| P2-AC10 | §17 reference/snapshot/copy/ownership | PASS |
| P2-AC11 | §16 Overview, not Step | PASS |
| P2-AC12 | §§18–22 Core-only stable functions; output shape candidate | PASS |
| P2-AC13 | §§23,28–30 Copilot/Card boundary, P3 deferred | PASS |
| P2-AC14 | §§17,23 provenance | PASS |
| P2-AC15 | §24 Support boundary | PASS |
| P2-AC16 | §§6,25 human decision | PASS |
| P2-AC17 | §26 causal return in frozen experience; technical contract deferred | PASS |
| P2-AC18 | §27 Core v0.2 L0–L6; only ROI presentation/calculation deferred | PASS |
| P2-AC19 | §31 maps T01–T25 | PASS |
| P2-AC20 | §32 and OD register | PASS |
| P2-AC21 | §33 ADR triggers | PASS |
| P2-AC22 | docs/e2e only; git diff --exit-code -- front backend ai-service = 0; HEAD unchanged | PASS |
| P2-AC23 | initial candidate reviewed; §1 metadata and §36 record authorized freeze | PASS |
| P2-AC24 | §36 explicit user approval and HAP disposition, not self-approved | PASS |

## 36. Human approval checkpoint

**Human decision recorded:** in the user's 2026-10-20 approval message, the user explicitly approved Option A of post-Start A/B/C and STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md with the limits in OD, HAP and [evidence/P2_VERIFICATION.md](evidence/P2_VERIFICATION.md). HAP §Final disposition preserves the exact decision and exclusions. The initial candidate was promoted to **FROZEN_TOBE_FOR_IMPLEMENTATION_PLANNING** without adding a domain, technical or runtime rule. P2 = **PASS** after P2-AC01–P2-AC24 documentary verification. P3 remains NOT_STARTED / NOT_AUTHORIZED, and P1 T01–T25 remain BLOCKED. Implementation, ADR approval, new SupportRequest identity, ROI model, actor/permission matrix and cycle/Step selection are not granted by this freeze.

