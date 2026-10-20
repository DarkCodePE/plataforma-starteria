# P2 — Open Decision Register

**Status:** P2_HUMAN_DISPOSITION_RECORDED. **Cut:** 2026-10-20. **Checkout:** C:/Users/User/proyect-starteria/starteria-KAN-153-recovery-ux, feat/KAN-153-recovery-ux@1e689ea5c54f7513e323e30f58e45e7168738c7c. The user approved post-Start A/B/C Option A as bounded P2 experience and froze the P2 contract; Codex approved no option. P1 T01–T25 remain BLOCKED. See [P2_HUMAN_APPROVAL_PACK.md](P2_HUMAN_APPROVAL_PACK.md) §Final disposition.

**Source paths:** CORE = doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md; ACT = docs/portfolio-lead/05-activation-handoff/PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md; ADR5 = doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md; PLF = docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip!/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0/01_FROZEN_PORTFOLIO/01_FREEZE_DECLARATION.md; STF = docs/e2e/sources/STARTERIA_E2E_AUDITORIA_SEGUNDA_PASADA_v02.zip!/STEPS_TARGET_DESIGN_FREEZE_v0.1.md; P1 = docs/e2e/P1_RUNTIME_BASELINE.md. ZIP paths are unaltered mirror entries per P0_SOURCE_MANIFEST.md.

## D-03 — Challenge/Initiative state and coverage

- **Decision ID:** D-03.
- **Question:** Which states and coverage rules are canonical, and may corporate work omit Challenge?
- **Why it matters:** changes Portfolio reading, assignment eligibility and cardinality.
- **Current authority / exact quote:** CORE §18: “Cobertura no prueba impacto de negocio.” CORE §INV-02: “Starteria no debe inferir silenciosamente el alineamiento estratégico.”
- **Frozen/reference evidence:** PLF: “retos o líneas de trabajo solo si ayudan.” This is visual, not Core permission.
- **AS-IS evidence:** P1 §§15–16, T02–T04/T08 BLOCKED.
- **Candidate options:** preserve Core corporate hierarchy with optional visual grouping; propose governed exception via ADR; defer unsupported states. None selected.
- **Core impact:** possible. **Domain/cardinality impact:** YES if Challenge is omitted or relation count changes. **AI authority impact:** cannot infer alignment. **Human authority impact:** confirmation retained. **Step impact:** inherited context may vary.
- **ADR required:** YES for changed invariant/cardinality. **Earliest phase requiring resolution:** P2 boundary; P5 before design; P6 before implementation.
- **Recommendation, if allowed:** keep Core v0.2 semantics until approved change. **P2 disposition:** RESOLVED_BY_EXISTING_AUTHORITY for alignment/coverage principle; calculation and constraints DEFER_TO_P5. No new cardinality approved.

## B-01 — Post-Start command and creation boundary

- **Decision ID:** B-01.
- **Question:** What action, actor, event and confirmation connect a started Challenge Assignment to a confirmed Initiative?
- **Why it matters:** creation count, ownership and retries.
- **Current authority / exact quote:** ACT §CHANGE-06: “No define la pantalla, Step, ruta ni comportamiento posterior.” ADR5 §1: “La futura formulación/materialización de una Initiative pertenece al workstream downstream.”
- **Frozen/reference evidence:** STF §3 Route A; PLF Assignment table. Neither approves downstream domain command.
- **AS-IS evidence:** P1 §§9–11, T08 BLOCKED; inspected frontend handler only updates preview.
- **Candidate options:** separate post-Start formulation and human confirmation; governed alternative after domain review; pause at handoff. None selected.
- **Core impact:** possible. **Domain/cardinality impact:** YES. **AI authority impact:** suggestion only. **Human authority impact:** confirming actor open. **Step impact:** activation follows separate gate.
- **ADR required:** YES if identity/cardinality/Core changes; otherwise assess at P5. **Earliest phase requiring resolution:** P2 candidate boundary, P5 approval, P6 execution.
- **Recommendation, if allowed:** preserve Start hard boundary. **P2 disposition:** DEFER_TO_P5 for downstream command, actor, persistence and idempotency. Human Option A approval freezes only the experience sequence; Start remains distinct from creation.

## B-02 — Existing Initiative and retroactive continuity

- **Decision ID:** B-02.
- **Question:** How is an advanced existing Initiative received, and which cycle/Step may be resumed?
- **Why it matters:** same ID, history and valid prior work must survive without retroactive approval.
- **Current authority / exact quote:** CORE §INV-11: “conservar el contenido existente”; “evitar obligar al usuario a rehacer trabajo válido solo para satisfacer una secuencia estética.” CORE §INV-10: “No se sobrescribe silenciosamente la historia.”
- **Frozen/reference evidence:** STF §3 Route B and §5.1 inherited-user target; conditional only.
- **AS-IS evidence:** P1 §§11–12, T09 BLOCKED.
- **Candidate options:** reconstruct gaps and review continuity; retain documentary work pending validation; defer Step selection. None selected.
- **Core impact:** compatible if history preserved. **Domain/cardinality impact:** same Initiative identity required. **AI authority impact:** no automatic approval. **Human authority impact:** validator open. **Step impact:** legitimate Step/cycle OPEN.
- **ADR required:** YES if Step function/gating or cycle identity changes. **Earliest phase requiring resolution:** P2 candidate, P5 exact rule, P6 runtime.
- **Recommendation, if allowed:** distinguish documented work from approved Step state. **P2 disposition:** RESOLVED_BY_EXISTING_AUTHORITY for same identity/history and retroactive reconstruction; exact cycle/Step and validator DEFER_TO_P5.

## B-03 — Contribution and mandate confirmation

- **Decision ID:** B-03.
- **Question:** Which person confirms contribution, realignment and material mandate changes?
- **Why it matters:** similarity and AI suggestion cannot become strategic truth.
- **Current authority / exact quote:** CORE §INV-02: “Un Portfolio Lead o una persona autorizada confirma el alineamiento estratégico cuando sea materialmente relevante.” CORE §5: “La autoridad debe asociarse a un tipo de decisión, no suponerse únicamente por acceso al sistema.”
- **Frozen/reference evidence:** PLF: “confirmar, posponer, dejar sin vínculo, comparar duplicidades.”
- **AS-IS evidence:** P1 T03/T21/T22/T23 BLOCKED.
- **Candidate options:** Portfolio Lead for strategic alignment; configured actor by decision type; sponsor with explicit authority. None universally selected.
- **Core impact:** possible. **Domain/cardinality impact:** none proven. **AI authority impact:** no confirmation. **Human authority impact:** exact matrix OPEN. **Step impact:** upstream review.
- **ADR required:** YES if human authority changes. **Earliest phase requiring resolution:** P2 boundary, P5 matrix, P9/P10 runtime.
- **Recommendation, if allowed:** require explicit decision type and actor. **P2 disposition:** DEFER_TO_P5 for actor-by-decision permission matrix; Core v0.2 human confirmation remains binding.

## D-08 — Expected, observed, attributed and ROI

- **Decision ID:** D-08.
- **Question:** Which claim maturity and ROI display rules go beyond Core?
- **Why it matters:** estimated value must not appear realized or attributed.
- **Current authority / exact quote:** CORE §INV-12: “Para promover un claim a **L5 REALIZED**, Starteria debe contar con un resultado observado en operación y una fuente trazable.” Also: “Para promoverlo a **L6 ATTRIBUTED**, además debe existir un método de atribución defendible y el validador requerido.”
- **Frozen/reference evidence:** PLF Home KPI/time-series; PL behavior contract warns against invented attribution.
- **AS-IS evidence:** P1 T20/T21 BLOCKED.
- **Candidate options:** apply Core L0–L6; define UI labels/calculation later; defer ROI if method missing. No extension selected.
- **Core impact:** current distinction REQUIRED_BY_AUTHORITY; changes may affect Core. **Domain/cardinality impact:** none proven. **AI authority impact:** no attribution assertion. **Human authority impact:** L6 validator. **Step impact:** Step 4 comparison, later Benefit Tracking.
- **ADR required:** YES to weaken/change L5/L6. **Earliest phase requiring resolution:** P2 distinction; P5 policy; P10 runtime.
- **Recommendation, if allowed:** preserve Core maturity rules. **P2 disposition:** RESOLVED_BY_EXISTING_AUTHORITY for expected/observed/attributed and Benefit Tracking; ROI display/calculation DEFER_TO_P5/P10.

## D-09 — Versioning and directed review

- **Decision ID:** D-09.
- **Question:** What exact triggers/owners apply when mandate or evidence changes during a cycle?
- **Why it matters:** no historical overwrite or blanket invalidation.
- **Current authority / exact quote:** CORE §30: “revalidar únicamente lo materialmente afectado”; CORE §INV-10: “No se sobrescribe silenciosamente la historia.”
- **Frozen/reference evidence:** STF §9 directed review and snapshots.
- **AS-IS evidence:** P1 T22 BLOCKED.
- **Candidate options:** dependency-directed review; explicit human disposition; preserve unaffected work. Trigger matrix deferred.
- **Core impact:** base rule mandatory, detail open. **Domain/cardinality impact:** possible new objects. **AI authority impact:** identify, not approve. **Human authority impact:** material confirmation. **Step impact:** targeted review.
- **ADR required:** YES if Core review/gating changes. **Earliest phase requiring resolution:** P3 semantics, P5 design, P7/P10 runtime.
- **Recommendation, if allowed:** inherit Core preservation. **P2 disposition:** RESOLVED_BY_EXISTING_AUTHORITY for version/history/directed review; semantic triggers DEFER_TO_P3 and technical dependencies DEFER_TO_P5.

## POST-START-A/B/C — Three-route adoption

- **Decision ID:** POST-START-A/B/C.
- **Question:** Which downstream contract approves A formulation, B reconstruction and C independent entry?
- **Why it matters:** ACT ends at Start.
- **Current authority / exact quote:** ACT §2: “cómo se formula una Initiative desde un Challenge Assignment;”; ACT §CHANGE-06: “No define la pantalla, Step, ruta ni comportamiento posterior.”
- **Frozen/reference evidence:** STF §3 A/B/C pending integration and reconciliation.
- **AS-IS evidence:** P1 T08–T10 BLOCKED.
- **Candidate options at P2 review:** approve compatible A/B/C after review; revise individual path under Core/ADR; defer affected route. The user selected the compatible A/B/C Option A for experience only; no technical or domain alternative was selected.
- **Core impact:** possible. **Domain/cardinality impact:** A/C creation. **AI authority impact:** no auto-confirmation. **Human authority impact:** actor/context open. **Step impact:** exact cycle selection open.
- **ADR required:** conditional on domain/identity/Step change. **Earliest phase requiring resolution:** P2 approval checkpoint, P5/P6.
- **Recommendation, if allowed:** the user selected Option A on 2026-10-20. **P2 disposition:** APPROVED_FOR_EXPERIENCE_FREEZE for A/B/C exactly as bounded in the human approval message and [P2_HUMAN_APPROVAL_PACK.md](P2_HUMAN_APPROVAL_PACK.md) §Final disposition. Commands, permissions, persistence, cycle/Step and any Core/ADR change remain unapproved.

## CARDINALITY/COVERAGE — Corporate structure

- **Decision ID:** CARDINALITY/COVERAGE.
- **Question:** May a corporate Challenge lack linked Initiatives; may a corporate Initiative bypass Challenge; how are links/coverage computed?
- **Why it matters:** visual grouping can conflict with Core hierarchy.
- **Current authority / exact quote:** CORE §18: “Cobertura no prueba impacto de negocio.” CORE §12 models corporate Front→Challenge→Activation→Initiative.
- **Frozen/reference evidence:** PLF contextual grouping; STF Route C applies to independent Initiative only.
- **AS-IS evidence:** P1 T02/T04/T08/T10 BLOCKED.
- **Candidate options:** preserve corporate hierarchy with zero Initiatives allowed on a Challenge; governed exception; independent entry separate. None selected as new cardinality.
- **Core impact:** YES if hierarchy changes. **Domain/cardinality impact:** YES. **AI authority impact:** cannot infer link. **Human authority impact:** alignment confirmation. **Step impact:** inherited context.
- **ADR required:** YES for canonical change. **Earliest phase requiring resolution:** P2 boundary, P5 design, P6.
- **Recommendation, if allowed:** no domain permission from PL visual grouping. **P2 disposition:** RESOLVED_BY_EXISTING_AUTHORITY for the in-scope Core v0.2 cases; physical cardinality/coverage detail DEFER_TO_P5; new canonical relationship requires ADR.

## DECISION-AUTHORITY — Actor and Portfolio return

- **Decision ID:** DECISION-AUTHORITY.
- **Question:** Which person decides each outcome, and which Portfolio state may change?
- **Why it matters:** Step 4 recommendation is not organizational decision.
- **Current authority / exact quote:** CORE §Step 4: “El output de Step 4 no es por sí mismo la decisión organizacional.” CORE §5: “La autoridad debe asociarse a un tipo de decisión”
- **Frozen/reference evidence:** PLF “Centro de decisiones” and “decisión humana explícita.”
- **AS-IS evidence:** P1 T19–T21/T23 BLOCKED.
- **Candidate options:** actor/role by decision type; Portfolio Lead within explicit authority; configured sponsor. None universally selected.
- **Core impact:** YES if authority shifts. **Domain/cardinality impact:** none proven. **AI authority impact:** recommendation only. **Human authority impact:** central OPEN item. **Step impact:** request, not decision.
- **ADR required:** YES for authority change. **Earliest phase requiring resolution:** P2 boundary, P5 matrix, P10.
- **Recommendation, if allowed:** explicit actor/type before outcome. **P2 disposition:** DEFER_TO_P5 for permission/effect matrix; Core v0.2 human decision principle remains binding.

## SUPPORT-REQUEST — Governed unblock object

- **Decision ID:** SUPPORT-REQUEST.
- **Question:** Is SupportRequest a new object, existing workflow specialization, or only a candidate signal?
- **Why it matters:** Portfolio attention without Portfolio writing StepState.
- **Current authority / exact quote:** CORE §Step 2: “identificar qué puede hacer el equipo y qué requiere IT, Data, Seguridad, proveedor u otra capacidad externa”; ACT §HC-PR-05: “Portfolio consume estado/eventos posteriores. No controla DOM, rutas, componentes o StepState interno.”
- **Frozen/reference evidence:** STF §5.1 and ST-07 propose contextual request, pending integration.
- **AS-IS evidence:** P1 T17 BLOCKED; prior audit search did not locate equivalent circuit.
- **Candidate options:** governed SupportRequest; existing compatible request workflow; status signal pending decision. None selected.
- **Core impact:** possible. **Domain/cardinality impact:** possible. **AI authority impact:** draft only. **Human authority impact:** authorized resolver. **Step impact:** Owner governs Step.
- **ADR required:** conditional on domain/authority change. **Earliest phase requiring resolution:** P2 candidate, P5 model, P9.
- **Recommendation, if allowed:** keep SupportRequest CANDIDATE_TOBE. **P2 disposition:** DEFER_TO_P5 for mechanism and reuse/adaptation of HelpRequest/AttentionItem; no new canonical SupportRequest approved.

## Approval rule

**Human decision:** the user's 2026-10-20 message explicitly approves Option A of post-Start A/B/C and the unified P2 contract v0.1 within its stated limits. This closes the P2 experience checkpoint only. It does not resolve any question that changes Core, cardinality, human/AI authority, Step function or gating; these require their own applicable authority/ADR. P3/P5 details above remain deferred. Technical P1 blockers remain in the Goal ledger; P1 T01–T25 remain BLOCKED. P3 is not authorized by this closure.

