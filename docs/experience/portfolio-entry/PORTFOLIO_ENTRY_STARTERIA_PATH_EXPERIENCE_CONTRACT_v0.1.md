# Portfolio Entry — Starteria Path Experience Contract v0.1

- **Status:** PROPOSED_FOR_IMPLEMENTATION_PLANNING
- **Slice:** Portfolio Entry 114E — Starteria Path
- **Semantic owner:** Starteria V2 / Portfolio Entry
- **Baseline reviewed:** origin/main at 2691ee22e29cdc929ba66dc60437505a919f4810
**Authority state:** Proposal; not active and not implementation authorization

## 1. Purpose

114E answers, using the Critical Handoff the person just confirmed:

1. How can Starteria help in this situation?
2. What tangible change could the person obtain by continuing?
3. What would be addressed first?
4. What still depends on the organization or external evidence?
5. What can the person actually do today?

The experience translates:

**CONFIRMED READING → CONTEXTUAL VALUE → TANGIBLE OUTCOME → IMMEDIATE NEXT ACTION → TRANSPARENT CONVERSION**

114E is a bounded value and capability projection. It does not prescribe strategy, configure a portfolio, create an execution plan, rank routes, create Core objects, or enter Steps. Its public experience ends at a verified conversion action, if one exists. Conversion is not product continuation.

## 2. Authority relationship and verified preconditions

This proposal is subordinate to the authority order in [STARTERIA_AUTHORITY.md](../../STARTERIA_AUTHORITY.md), the factual Core v0.2 contract at [CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md](../../../doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES%281%29.md), accepted product ADRs, and the active [Portfolio Entry Logic Contract v0.1](../../../doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md). The [Critical Reasoning Experience Contract v0.1](PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md) is accepted/frozen for its scoped implementation planning and remains subordinate to Core v0.2 and accepted ADRs.

The authority and evidence reviewed for this proposal are:

- [KAN-114 semantic acceptance](../../ai-harness/portfolio-entry/KAN-114_CRITICAL_SITUATION_SYNTHESIS_SEMANTIC_ACCEPTANCE_v0.1.md): reasoning gate ACCEPTED, evaluation PASS_WITH_NON_BLOCKING_GAPS. KAN-114 remains the only business-reasoning source.
- [KAN-119 Critical Handoff closure](../../implementation/portfolio-entry/KAN-119_CRITICAL_HANDOFF_V01_IMPLEMENTATION_CLOSURE.md): 114D is IMPLEMENTED_VERIFIED and integrated in the governed baseline. Its durable artifact is revision-bound and requires explicit representativeness confirmation.
- [KAN-121 runtime and conversion audit](../../implementation/portfolio-entry/KAN-121_STARTERIA_PATH_RUNTIME_AND_CONVERSION_AUDIT_v0.1.md): audit permits 114E contract shaping, not implementation. It identifies legacy seams and unverified public conversion destinations.
- [Starteria Business Capability Boundary v0.1](../../contracts/STARTERIA_BUSINESS_CAPABILITY_BOUNDARY_v0.1.md): PROPOSED_FOR_114E_SHAPING only; it is a semantic design input, not active authority.
- [CURRENT_STATE.md](../../../CURRENT_STATE.md) and [STARTERIA_V2_MANIFEST.md](../../../STARTERIA_V2_MANIFEST.md): 114D is the current governed baseline; 114E is not started; 114F remains outside this slice.
- Jira KAN-120 supplies the parent scope and frozen experience decisions. Jira KAN-123 asks for this contract before a technical implementation HU.
- The product ADR index is [ADR-INDEX.md](../../../doc/product-adr/ADR-INDEX.md). Accepted [ADR-005](../../../doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md) preserves the bounded handoff and legacy-route boundary; [ADR-006](../../../doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md) keeps Landing, Portfolio Entry, and commercial conversion distinct. ADR-003 has a recorded status discrepancy and is not resolved here.

Verified preconditions carried into this contract:

- 114D is the current governed baseline; 114E is not implemented.
- KAN-114 is the sole business-reasoning source.
- 114E may start only from a current, explicitly confirmed Critical Handoff.
- Legacy PortfolioEntryHandoff starteria_path and related legacy recommendation or route fields are not 114E authority.
- Conversion intent is not product continuation.
- 114F, Portfolio Setup, Core, and Steps are outside scope.
- The Business Capability Boundary is proposed, not active authority.
- Early Access and Demo availability are not established by the reviewed evidence.

The factual Core v0.2 contract remains the authority even though it is marked “Base fundacional revisada / Por validar.” This proposal does not promote it, alter its invariants, or treat a candidate Core contract as approved.

### Open source conflicts

These conflicts are recorded and left open; this contract does not resolve them.

> **CONFLICT**
> - Contract: Jira KAN-120 describes public conversion as Early Access / Demo while access is closed.
> - Requirement: KAN-121 and the KAN-122 boundary require destination verification; this contract must not assume either destination is available.
> - Current document/code: CURRENT_STATE.md and STARTERIA_V2_MANIFEST.md record RUNTIME_PENDING / BLOCKED_BY_DESTINATION. KAN-121 found no first-party Early Access flow and did not verify the external Demo booking destination.
> - Observed mismatch: conversion choices are described conceptually, but operational destination availability is not established.
> - Risk: a CTA could imply available access, a working booking, or immediate product continuation.
> - Recommended treatment: KEEP the pending status; require a verified destination and approved commercial strategy before enabling a CTA.
> - Requires ADR: no for destination fact-checking; destination hierarchy and runtime require their own authorized decision and implementation scope.

> **CONFLICT**
> - Contract: KAN-120 requires a current confirmed Critical Handoff and excludes legacy starteria_path semantics.
> - Requirement: 114E must remain isolated from legacy handoff meanings.
> - Current implementation: KAN-121 found a legacy sidecar/API seam that can expose legacy handoff data for a current-critical session, although the current 114D browser path uses the Critical Handoff DTO.
> - Observed mismatch: browser-path isolation does not remove the API compatibility seam.
> - Risk: future implementation could accidentally consume legacy recommendations or routes as 114E authority.
> - Recommended treatment: KEEP_COMPAT for historical consumers and enforce 114D source binding in 114E; decide any runtime quarantine in a separate technical task.
> - Requires ADR: not determined by KAN-121; this proposal does not decide it.

ADR-003 is recorded as ACCEPTED in its product ADR document/index but PROPOSED and OPEN / DEFERRED in CURRENT_STATE.md. Keep that discrepancy open for its separately required reconciliation before 114F; this contract neither relies on nor resolves it.

## 3. Input gate

An input is eligible for 114E only if all of the following are true:

1. A dedicated 114D Critical Handoff artifact exists.
2. It is the latest artifact for its Portfolio Entry reasoning context and is current under 114D rules.
3. The artifact is explicitly confirmed by the person under the 114D confirmation semantics.
4. Its sourceContextRevision matches the current context revision.
5. Its conclusionStatus is supported or bounded.
6. Its identity, artifact version, and source binding are internally valid.

114E reads the 114D allowlisted projection. It does not read raw KAN-114 output, re-run KAN-114, infer missing fields, or fall back to a legacy handoff. Confirmation means the person considers the reading sufficiently representative to continue; it does not make every statement an objective fact.

An insufficient-basis, stale, unconfirmed, missing, or invalid source cannot produce a Starteria Path. Technical failure to read or project a source produces ERROR. The explicit states and recovery behavior are defined below.

For an eligible input, the conceptual output envelope is:

- **experience_state**
- **path_status:** SUPPORTED or BOUNDED
- **value_bridge**
- **capability_path**
- **dependencies**
- **first_supported_movement**, optional
- **boundary_statement**
- **continuation_intent**, optional
- **conversion**
- **source_binding**

Unavailable states do not carry a path_status or fabricated path. The boundary_statement names what this value projection can prepare and what remains a human, organizational, external-evidence, or product-availability responsibility.

## 4. Experience states

State selection is deterministic. A technical read/projection failure is ERROR; absent artifact is UNAVAILABLE_MISSING; malformed or unsupported artifact is UNAVAILABLE_INVALID; a source-currentness mismatch is STALE; an unconfirmed current source is UNAVAILABLE_UNCONFIRMED; a current confirmed insufficient-basis source is UNAVAILABLE_INSUFFICIENT_BASIS; only then can the source produce SUPPORTED or BOUNDED.

| State | Eligibility | Rendered | Hidden | CTA behavior | Conversion and context sharing | Recovery |
|---|---|---|---|---|---|---|
| SUPPORTED | All input-gate checks pass and conclusionStatus is supported. | Source-grounded value bridge, eligible capability nodes, dependencies, optional 114D first movement, tangible outcome, and truthful availability disclosure. | Raw conversation, private reasoning, hidden provenance, provider data, and unrelated history. | After value is shown, render only an action backed by a verified destination. | Conversion is allowed only when a destination is verified. Context sharing is optional and requires explicit consent. | Continue within the verified conversion flow, or remain on the value view if no destination is verified. |
| BOUNDED | All input-gate checks pass and conclusionStatus is bounded. | Same sections as SUPPORTED, with the bounded scope, uncertainty, and dependencies kept visible. | Same exclusions as SUPPORTED; no wording may turn bounded support into certainty. | Same verified-destination gate; copy must preserve the limits of the confirmed reading. | Same as SUPPORTED. | Same as SUPPORTED; do not try to remove uncertainty by inventing detail. |
| UNAVAILABLE_INSUFFICIENT_BASIS | Current and confirmed artifact has insufficient_basis. | A concise explanation that this reading does not support a contextual path; safe 114D information may remain visible. | Capability path, value promise, tangible outcome, conversion CTA, and context-sharing option. | No 114E CTA. A source-flow recovery may be offered only if separately supported by 114D. | Not allowed. | Use a fresh, separately authorized 114D reasoning flow if the person wants to add context. Do not reopen or mutate the confirmed artifact under current 114D semantics. |
| UNAVAILABLE_UNCONFIRMED | Artifact exists and is current, but has not been confirmed. | 114D review status and the existing 114D confirm/correct options where available. | All 114E value, capability, outcome, conversion, and sharing content. | No 114E CTA. Any confirm or correction action belongs to 114D. | Not allowed. | Return to the existing 114D review; require explicit confirmation before evaluating 114E again. |
| UNAVAILABLE_MISSING | No 114D Critical Handoff artifact exists. | A neutral message that no confirmed reading is available to ground this experience. | All 114E path and conversion content. | No CTA to Early Access or Demo from 114E. | Not allowed. | Start or resume the authorized Portfolio Entry flow that can produce 114D. |
| UNAVAILABLE_INVALID | Artifact or binding is malformed, unsupported, contradictory, or fails a required version/shape check. | Safe unavailable/error explanation without exposing internal details. | All path content, claims derived from the invalid source, CTA, and sharing option. | No CTA. | Not allowed. | Return to the source flow or support path to obtain a valid 114D artifact; never repair it by inference. |
| STALE | The source is no longer current, is no longer confirmed as the latest matching source, or its identifier/version/revision does not match this path. | A stale notice and, where safe, a link back to the authorized source flow. | The old path as current value, current CTA, and context sharing. An old path may be retained only as historical data outside this public current view. | No CTA from the stale path. | Not allowed. | Obtain a new current 114D artifact, confirm it, then project a new path. Never silently mutate the old path. |
| ERROR | The source cannot be read or a projection operation fails before a valid state can be determined. | A neutral recoverable failure message. | Any unverified or cached path content, CTA, and sharing option. | No CTA. | Not allowed. | Retry the same safe read/projection if the source remains current; otherwise return to 114D. Do not present stale cached output. |

No unavailable state may be relabeled SUPPORTED or BOUNDED to make conversion possible. For eligible states, a missing commercial destination still means no conversion action and no context-sharing option.

## 5. Value bridge

The required semantic structure is:

**value_bridge**

- **current_state**
- **starteria_contribution**
- **tangible_outcome**
- **remaining_dependency**
- **immediate_next_action**

Field rules:

- **current_state** is taken from the confirmed Critical Handoff: its supported reading, decision in view, usable context, and decision-changing unknowns as needed. Preserve whether input is a user statement, supported interpretation, or unknown when that distinction is present. Do not add a diagnosis.
- **starteria_contribution** maps to one or more allowed capability nodes in the proposed Business Capability Boundary. Each contribution carries its capability class and surface-specific availability state. It describes a bounded product contribution, not a business result.
- **tangible_outcome** names an inspectable artifact or state change a person could review, such as a structured decision view or a visible evidence-and-unknowns map. It states how the outcome would be observed. It is not a KPI, target, business result, or guarantee.
- **remaining_dependency** names dependencies that remain outside Starteria or depend on an unavailable product surface. It identifies what is missing, why it matters, who or what must provide it, and what Starteria could do with it once available. If no dependency is identified in the source, say that none was identified; do not imply that none exists.
- **immediate_next_action** is one contextual, bounded action taken from the 114D first movement when it exists. If 114D has no first movement, this field remains absent; a conversion CTA may still describe its verified commercial request, but it is not a substitute movement. It must not become a list, plan, experiment, KPI, threshold, timeline, budget, or ownership assignment.

The value bridge may be absent for every ineligible experience state. A missing field is not permission to synthesize it.

## 6. Value delta

The experience makes four distinct points legible:

1. **Before:** what the confirmed reading says about the current situation.
2. **With Starteria:** the specific, permitted contribution for this situation.
3. **What the person could have:** the observable artifact or state change.
4. **What remains outside Starteria:** organizational decisions, execution, capacity, external evidence, and unverified product availability.

These are semantic slots, not fixed runtime copy. A “with Starteria” statement must be conditional when its availability state requires it. A tangible outcome describes an artifact, not a guaranteed downstream business effect.

## 7. Capability path

The capability path is a contextual sequence of Starteria capabilities that explains how the permitted contribution relates to this confirmed case. It is not Steps, a roadmap, project plan, experiment design, strategy, route ranking, or workflow execution.

Candidate capability types are STRUCTURE, MAKE_VISIBLE, SYSTEMATIZE, GUIDE_OR_TRACK_UNCERTAINTY, PREPARE_DECISION, and SUPPORTED_FIRST_MOVEMENT. These are a vocabulary, not a checklist. Include only nodes supported by the source and boundary.

Every node has:

- **capability_type**
- **contextual_statement**
- **why_it_matters_here**
- **source_basis**
- **capability_class**
- **availability_state**
- **dependency**, when applicable

Rules:

- **source_basis** identifies the relevant confirmed 114D projection fields and the specific Business Capability Boundary clause that permits or limits the statement. It does not expose raw reasoning or hidden provenance to the user.
- Affirmative capability nodes use **CAN_DO** or **CAN_SUPPORT** from the boundary. **REQUIRES_ORGANIZATIONAL_INPUT** and **REQUIRES_EXTERNAL_EVIDENCE** describe dependencies, not affirmative Starteria capability. **CANNOT_PROMISE** must never appear as an affirmative node.
- Every node carries an exact availability state from the boundary: CURRENTLY_EVIDENCED, GOVERNED_NOT_YET_AVAILABLE, REQUIRES_IMPLEMENTATION, ASPIRATIONAL_UNVALIDATED, or PROHIBITED. Class and availability answer different questions and neither implies the other.
- Availability is evaluated for the exact audience and 114E surface. A capability evidenced in 114D is not automatically available in 114E.
- CURRENTLY_EVIDENCED permits bounded present-tense wording only when current authority and runtime evidence cover that exact capability on that surface.
- GOVERNED_NOT_YET_AVAILABLE permits future or conditional wording only, with transparent disclosure of the actual conversion path.
- REQUIRES_IMPLEMENTATION is not presented as working product behavior. ASPIRATIONAL_UNVALIDATED is not presented as a product capability. PROHIBITED is never rendered affirmatively.
- A path may contain fewer than all candidate types, or no nodes when there is no supported contextual contribution. Never fill a path with generic capability cards.

## 8. First supported movement

The optional **first_supported_movement** is reused from the 114D projection only:

- **movement**
- **why_now**
- **what_it_may_clarify**
- **boundary**

It may be shortened for presentation only if its meaning and boundary remain intact. It must not be expanded into multiple steps, a plan, experiment design, KPI, threshold, timeline, budget, owner assignment, or additional decision. If 114D has no first movement, this field remains absent. No replacement is synthesized.

## 9. Dependencies

Dependencies are explicit constraints or inputs, not recommendations. They do not become facts merely because the path lists them.

Each dependency states:

- **category**
- **what_is_missing**
- **why_it_matters**
- **provider** — the person, organizational role, system, or external source that must supply it
- **what_starteria_can_do_once_available**

Allowed categories:

- **STARTERIA_CAN_HELP_STRUCTURE** — relevant information or an existing user-provided artifact is needed before Starteria can structure it. Name the input and its provider; do not imply Starteria already has it.
- **REQUIRES_ORGANIZATIONAL_INPUT** — a decision, authority, constraint, capacity fact, or organizational commitment must come from the organization. Starteria may organize what is supplied; it may not decide or assign it.
- **REQUIRES_EXTERNAL_EVIDENCE** — evidence about customers, markets, product behavior, economics, regulation, or other external reality must come from an appropriate source. Starteria may make supplied evidence and gaps visible; it may not invent or infer a conclusion from absence.

Capability availability is carried by **availability_state** on each node. A separate NOT_YET_AVAILABLE dependency category is not required; if a future implementation needs such a dependency, it must still name the missing product surface, why it matters, who must provide it, and what becomes possible once available.

Do not turn dependencies into recommendations automatically or use them to rank routes.

## 10. Availability disclosure

**Value promise** and **current availability** are separate facts. Every public value or capability statement in 114E is bound to both a capability_class and an availability_state. User-facing wording need not expose enum labels, but it must tell the truth those labels represent.

The availability definitions and public wording rules are the ones in the proposed Business Capability Boundary. In particular:

- CURRENTLY_EVIDENCED supports bounded present tense only for the exact evidenced audience and surface.
- GOVERNED_NOT_YET_AVAILABLE requires future or conditional language and a truthful disclosure of what the available next interaction is.
- REQUIRES_IMPLEMENTATION cannot be described as working product behavior.
- ASPIRATIONAL_UNVALIDATED cannot be described as a product capability.
- PROHIBITED is never presented affirmatively.

Because 114E is not implemented and the boundary is not active authority, this proposal makes no present-tense claim that 114E capabilities are available. Adoption and later runtime evidence are separate gates.

## 11. Conversion model

Conversion is a commercial request or interaction, separate from continuing the product. It does not create a user workspace, select an organization, create an initiative, or enter 114F.

**conversion**

- **conversion_status**
- **primary_action**, optional
- **secondary_action**, optional
- **disclosure**
- **value_summary**
- **context_share_option**, optional

The path may also include **continuation_intent**, which exists only after a person chooses a verified conversion action. It records an intent to request Early Access or a Demo interaction; it is not authenticated product continuation, a workspace, portfolio setup, context selection, or permission to enter 114F. With no verified destination, continuation_intent is absent.

The allowed conversion status values are product/configuration facts, never reasoning outputs:

- **NO_VERIFIED_DESTINATION**
- **DEMO_ONLY**
- **EARLY_ACCESS_ONLY**
- **EARLY_ACCESS_AND_DEMO**

A destination is verified only when its receiving flow is operational, its actual next interaction is known, its audience and availability are approved, and it does what its disclosure says. A configured URL or a label in current Landing copy is not sufficient evidence.

The conversion object is evaluated only after an eligible value bridge has been shown. With NO_VERIFIED_DESTINATION, primary_action and secondary_action are absent, no conversion CTA is rendered, and context_share_option is absent. With one verified destination, it may be the primary action. With both verified destinations, the approved commercial destination strategy determines their hierarchy; 114E reasoning must not rank them. Until that strategy is decided, they may only be presented as peers if the verified UI can do so truthfully.

**value_summary** is a concise, source-grounded restatement of the value already shown. **disclosure** explains the destination, what starts after the action, and whether the person is requesting access or a demo rather than entering the product immediately.

**boundary_statement** stays with the value explanation and states that Starteria may prepare or structure the described artifact while the organization retains decisions and execution, external evidence remains external, and product access depends on the verified destination.

## 12. CTA semantics

A CTA says what starts next and preserves the current problem context. It appears only after the contextual value, tangible outcome, dependencies, and availability disclosure.

Do not use generic navigation labels such as “Continuar,” “Seguir,” or “Empezar” as the primary CTA. Contextual intent may resemble “Aterrizarlo con Starteria,” “Trabajar este frente con Starteria,” or “Solicitar acceso para trabajar este frente,” but these examples do not freeze final copy. Wording must match the verified destination:

- An Early Access action requests access; it must not imply immediate full product access unless that is true and verified.
- A Demo action clearly requests a demo or meeting; it must not imply that the demo is already booked.

The primary CTA must reflect actual destination availability, name the next interaction, avoid guaranteed business outcomes, and follow the value disclosure. No CTA is rendered for an unverified destination. No fallback link is invented.

## 13. Early Access and Demo transparency

If Early Access is verified, the experience says access is limited or early and describes the actual next interaction. It does not imply immediate access to the full product unless the verified flow provides it.

If Demo is verified, the experience clearly says that the action requests a demo or meeting and accurately describes what happens next.

If neither destination is verified, render neither CTA and do not ask for an email as a substitute for showing value. Do not infer availability from an external link, a Landing label, a proposed contract, or an intended commercial strategy.

## 14. Context sharing consent

The default is **NO_ENTRY_CONTEXT_SHARED**. A person may explicitly opt into **SHARE_CONTEXT_WITH_CONVERSION** for the stated conversion purpose.

**context_share_consent**

- **status:** not_requested, declined, or granted
- **scope:** the exact permitted fields
- **purpose:** the conversion interaction for which they will be shared

The optional share scope is limited to:

- a concise summary of the confirmed Critical Handoff;
- the decision in view;
- the value context already shown to the person.

Do not share by default or include in this scope the full raw conversation, internal reasoning metadata, provider/model metadata, hidden provenance structures, or unrelated session history.

Consent is explicit, purpose-bound, and revocable at least until submission. Declining or not being asked does not silently grant consent. If consent is absent or declined, no Entry context is included in the conversion request. Consent behavior is a product semantic boundary; this contract does not define legal or GDPR policy.

Context sharing may be offered only for an eligible SUPPORTED or BOUNDED experience with a verified conversion destination. No unavailable state can collect this consent.

## 15. Source binding and currentness

A Starteria Path binds to the specific Critical Handoff and projection basis that produced it:

**starteria_path**

- **critical_handoff_id**
- **critical_handoff_version** — the artifact version, not only its schema version
- **source_context_revision**
- **path_schema_version**
- **projection_version**
- **business_capability_boundary_version**

A path is current only when:

1. its source Critical Handoff is current and confirmed;
2. its Critical Handoff ID and artifact version match that source;
3. its source_context_revision matches the source artifact and current context revision;
4. its boundary and projection versions identify the versions used to produce it; and
5. it is the latest path for that source artifact and projection basis.

When the source artifact, source context revision, boundary version, or projection version changes, the prior path is no longer current. Mark it stale or superseded according to the owning implementation; never silently mutate its content or binding. A fresh confirmed source is required before a new current path is projected.

## 16. Determinism

The same confirmed Critical Handoff plus the same Business Capability Boundary version plus the same projector version produces the same semantic Starteria Path.

114E uses deterministic projection and bounded presentation mapping. It adds no second LLM, freeform reinterpretation, new business claim, route ranking, missing evidence, or unsupported causal statement. Any copy variation must preserve the same semantics and source bindings; it cannot alter the path decision.

## 17. Experience flow

1. 114D produces a current Critical Handoff.
2. The person reviews and confirms it.
3. The 114E input gate validates identity, version, currentness, confirmation, sourceContextRevision, and conclusionStatus.
4. 114E projects the contextual value bridge.
5. 114E shows only source-grounded capability nodes.
6. It exposes organizational, evidence, and availability dependencies.
7. It reuses the optional 114D first supported movement without expansion.
8. It names the tangible outcome and discloses current availability.
9. It renders a conversion CTA only when a destination is verified, and offers context sharing only with explicit consent.
10. If selected, Early Access or Demo receives the user according to its verified flow. 114E ends at that conversion boundary.

The flow does not continue to portfolio setup, context selection, initiative creation, Steps, or Core creation.

## 18. Recommended public UX composition

The information priority is:

1. “Así puede ayudarte Starteria” — contextual value statement.
2. Capability path — only the supported capabilities relevant to this case.
3. “Qué obtendrías” — observable tangible outcome.
4. Remaining dependencies — what still depends on the organization or external evidence.
5. “Qué haríamos primero” — only the 114D first movement, if present.
6. Availability disclosure — what is and is not available today.
7. Conversion panel — verified destination and accurate next interaction, if any.
8. Optional context-sharing consent — exact scope and purpose, before submission.

This hierarchy defines information priority and behavior, not final copy, layout, visual styling, or UI implementation.

## 19. Illustrative example — churn case

**ILLUSTRATIVE / NON-NORMATIVE.** This example does not prescribe runtime copy or capability availability. Assume the person supplied the figures and six initiatives below, and that the current 114D artifact is confirmed with conclusionStatus bounded. The figures are not independently verified.

### 114D input

- Current state: the person reports SMB churn of 18% and a target of 12%.
- Usable context: six retention initiatives with uneven evidence.
- Decision in view: where to concentrate organizational capacity.
- Material tension: early-churn and late-churn concerns may point to different work.
- Decision-changing unknowns: churn drivers and comparable evidence are not established.
- Optional first movement: in this illustrative source only, 114D explicitly supplies a bounded movement to review which existing evidence distinguishes early from late churn. If that field were absent, 114E would leave first_supported_movement absent.

### 114E value bridge

- **current_state:** preserve the reported churn figures as user-supplied, retain the uneven evidence across six initiatives, and show the early/late tension and unknown drivers from the confirmed handoff.
- **starteria_contribution:** conditionally help organize supplied initiatives and make known evidence and unknowns visible around the capacity decision. Capability classes are CAN_SUPPORT for preparing the discussion and CAN_DO for making supplied information visible. Each 114E capability has availability_state REQUIRES_IMPLEMENTATION until the 114E surface is implemented and verified.
- **tangible_outcome:** a reviewable decision view showing the supplied initiatives, the evidence actually available for each, what remains uncertain, and which organizational capacity facts are still needed. This is an artifact, not a prediction of churn reduction.
- **remaining_dependency:** the organization must provide actual capacity and retain the decision authority; an appropriate data source must provide comparable churn definitions, periods, segments, and evidence about drivers. Starteria can organize those inputs once supplied, but cannot determine the causes from the figures alone.
- **immediate_next_action:** if the 114D movement is present, review the evidence already available for early versus late churn in the decision view. This is one bounded review action, not an experiment or allocation plan.

### Capability path and disclosure

| Capability type | Contextual statement | Why it matters here | Source basis | Class | Availability | Dependency |
|---|---|---|---|---|---|---|
| MAKE_VISIBLE | Make the evidence and unknowns already present in the handoff visible together. | The decision depends on whether early and late churn can be distinguished from supplied evidence. | Confirmed 114D usable context and decision-changing unknowns; boundary rule for showing supplied evidence without inventing it. | CAN_DO | REQUIRES_IMPLEMENTATION | External churn evidence remains required. |
| PREPARE_DECISION | Help prepare a human discussion about where capacity might be concentrated. | The handoff identifies a capacity decision but does not settle it. | Confirmed 114D decision in view; boundary rule that people retain decision authority. | CAN_SUPPORT | REQUIRES_IMPLEMENTATION | The organization supplies actual capacity and makes the decision. |

No other candidate capability type is forced into this example.

### Conversion disclosure

For the reviewed current baseline, use **NO_VERIFIED_DESTINATION**: KAN-121 did not verify the external Demo destination and found no first-party Early Access flow. Therefore primary_action and secondary_action are absent, no CTA is rendered, and context_share_option is absent. The disclosure states that the contextual view is illustrative of the proposed 114E experience and that no Early Access or Demo destination is currently verified. This does not claim Starteria will reduce churn or reach the 12% target.

## 20. Anti-patterns

114E must not:

- show generic capability lists unrelated to the confirmed case;
- say “Starteria will solve” or guarantee a business result;
- claim a “best path” or rank routes;
- hide assumptions, uncertainty, or the source of a statement;
- generate a plan, multiple execution steps, or an experiment design;
- leak Steps or create Core objects;
- jump to Portfolio Setup or 114F;
- reuse legacy starteria_path semantics as input or authority;
- show a CTA before explaining the value and outcome;
- ask for an email before showing the contextual value;
- imply Early Access or Demo is available when it is unverified;
- share Entry context without explicit, scoped consent;
- convert organizational dependencies into facts or assignments;
- convert external evidence gaps into AI conclusions;
- present an unavailable capability as current product behavior.

## 21. Acceptance criteria

- **AC01** — A current, explicitly confirmed 114D artifact with matching sourceContextRevision is required.
- **AC02** — KAN-114 remains the sole business-reasoning source.
- **AC03** — 114E adds no LLM call.
- **AC04** — The same confirmed source, Business Capability Boundary version, and projector version yield the same semantic path.
- **AC05** — Every value_bridge field is grounded in the confirmed source or explicitly names an external/organizational dependency.
- **AC06** — Every capability node has a capability_class.
- **AC07** — Every capability node has an availability_state.
- **AC08** — Every tangible outcome is an observable artifact or state change.
- **AC09** — No business result is guaranteed.
- **AC10** — Organizational and external dependencies are explicit and identify their provider.
- **AC11** — A 114D first movement is not expanded; if absent, no replacement is created.
- **AC12** — insufficient_basis produces no fabricated or generic path.
- **AC13** — A changed or non-current source makes the prior path stale.
- **AC14** — Conversion remains separate from product continuation.
- **AC15** — 114E does not enter 114F, Core, Portfolio Setup, or Steps.
- **AC16** — Legacy starteria_path is not reused as 114E semantic authority.
- **AC17** — Contextual value and tangible outcome precede any CTA.
- **AC18** — A CTA requires a verified destination and accurate next-interaction disclosure.
- **AC19** — Sharing Entry context requires explicit, purpose-bound consent.
- **AC20** — Raw conversation, internal reasoning, provider metadata, hidden provenance, and unrelated history are not shared by default.
- **AC21** — Current availability is stated truthfully for the specific surface and audience.
- **AC22** — No CTA is rendered when no destination is verified.
- **AC23** — Illustrative examples are marked non-normative and cannot be treated as runtime copy or evidence.
- **AC24** — Missing, invalid, unconfirmed, stale, error, and insufficient-basis inputs each resolve to an explicit state with no fabricated path.

## 22. Open questions

1. Human approval or rejection of the KAN-122 Business Capability Boundary proposal.
2. Human approval or revision of this KAN-123 contract.
3. The verified commercial destination strategy: whether Early Access, Demo, both, or neither will be operational; the actual next interaction; and the hierarchy if both are available.
4. The disposition and technical quarantine, if any, of the legacy sidecar/API seam identified by KAN-121.
5. The source-binding architecture for artifact identity/version, context revision, projector version, boundary version, and latest-path currentness.
6. The consent architecture if conversion context sharing is enabled, including how the user reviews, declines, and revokes consent before submission.
7. The authorized behavior for starting a fresh 114D reasoning flow when an already-confirmed source has insufficient basis; current 114D semantics do not authorize mutating that artifact.
8. ADR-003 remains OPEN / DEFERRED for its separate reconciliation before 114F.

## 23. Implementation gate

Completing this contract does not authorize implementation. Before any 114E runtime work begins, require:

- human approval of the KAN-122 Business Capability Boundary;
- human approval of this KAN-123 contract;
- a verified commercial destination strategy and verified destination behavior;
- a recorded disposition for the legacy sidecar seam;
- a separate technical implementation HU with explicit scope and acceptance criteria;
- an approved source-binding architecture for currentness and deterministic projection; and
- an approved consent architecture if context sharing is enabled.

The implementation must preserve the explicit 114E exclusions in this contract. A technical HU cannot silently resolve the open conflicts or expand into Landing, Early Access, Demo, 114F, Core, or Steps.

## 24. Implementation planning readiness

This proposal is complete enough for human review and implementation planning after its approval gates are satisfied. Its status remains PROPOSED_FOR_IMPLEMENTATION_PLANNING. It is not ACTIVE and does not authorize runtime, routes, APIs, persistence, Prisma, Landing changes, Early Access, Demo, Core, Steps, or ADR-003 resolution.
