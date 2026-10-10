# Starteria Business Capability Boundary v0.1

**Status:** `ACCEPTED_FOR_114E`
**Slice:** KAN-122 / Portfolio Entry 114E
**Semantic owner:** Starteria V2 product semantics
**Authority state:** Accepted only for 114E capability/claim semantics; not global product-marketing authority, proof of capability availability, or authority for 114F, Core, or Steps
**Adoption record:** KAN-126 scoped adoption; originated as the KAN-122 proposal
**Baseline reviewed:** `origin/main` at `c756309407ac6b372d2e8317852c3552877bd671`

## 1. Status and purpose

This contract defines the boundary for claims about what Starteria does, what it can help a person or organization prepare, which conditions depend on organizational input or external evidence, and what Starteria must not promise.

It is intended to constrain future:

- KAN-123 `value_bridge`, tangible outcomes, `capability_path`, and immediate-next-action wording;
- 114E Starteria Path explanations;
- Early Access and Demo CTA framing;
- public Landing capability and value claims;
- Copilot explanations of Starteria's value.

This document originated as a KAN-122 semantic proposal and is accepted by KAN-126 only to govern 114E capability and claim semantics. It is not global product-marketing authority and does not establish that any capability or destination is available. This acceptance does not by itself authorize runtime work; KAN-125A and the bounded KAN-125B authorization are recorded separately. It does not authorize Landing-copy, Copilot, Early Access, Demo, 114F, Core, Steps, or other runtime work outside those explicit slices.

## 2. Authority relationship and verified preconditions

This contract is subordinate to the authority order in [`docs/STARTERIA_AUTHORITY.md`](../STARTERIA_AUTHORITY.md), with the current record in [`CURRENT_STATE.md`](../../CURRENT_STATE.md) and [`STARTERIA_V2_MANIFEST.md`](../../STARTERIA_V2_MANIFEST.md):

1. Factual Core authority remains [`CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`](../../doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES%281%29.md), status `Base fundacional revisada / Por validar`. Candidate Core v0.3 is not promoted. Core INV-03 keeps organizational authority with people; INV-05 requires provenance for material claims.
2. Accepted product ADRs remain above this proposal. Their index is [`ADR-INDEX.md`](../../doc/product-adr/ADR-INDEX.md). Relevant boundaries include [ADR-006](../../doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md)'s separation of Landing, Portfolio Entry and commercial conversion, and [ADR-003](../../doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md)'s registration/continuation boundary. The ADR-003 status mismatch recorded below remains open.
3. The active [Portfolio Entry Logic Contract v0.1](../../doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md) remains in force. The [Critical Reasoning Experience Contract v0.1](../experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md) remains `FROZEN FOR IMPLEMENTATION PLANNING`, subordinate to Core v0.2 and accepted ADRs.
4. The accepted [KAN-114 semantic record](../ai-harness/portfolio-entry/KAN-114_CRITICAL_SITUATION_SYNTHESIS_SEMANTIC_ACCEPTANCE_v0.1.md) remains the sole business-reasoning source. Its accepted result is `PASS_WITH_NON_BLOCKING_GAPS`; it does not certify production deployment.
5. [KAN-119 closure](../implementation/portfolio-entry/KAN-119_CRITICAL_HANDOFF_V01_IMPLEMENTATION_CLOSURE.md) records 114D as `IMPLEMENTED_VERIFIED` and integrated in the governed baseline. It defines the current Critical Handoff as a durable, revision-bound artifact that requires explicit representativeness confirmation.
6. Jira KAN-120 provides the parent scope and frozen D1-D14 inputs. In particular: 114E uses no new LLM; starts only from a current, confirmed 114D handoff; is a capability/value projection; ends at `continuation_intent`; legacy `starteria_path` is not 114E; and value is an observable user change, not a business-result guarantee.
7. [KAN-121 audit](../implementation/portfolio-entry/KAN-121_STARTERIA_PATH_RUNTIME_AND_CONVERSION_AUDIT_v0.1.md)'s result is `AUDIT_RESULT: READY_WITH_BLOCKERS`. At audit time it enabled contract shaping, not implementation, and recorded 114D as integrated with no 114E runtime yet. 114F remains unauthorized here.

Verified boundaries carried into this accepted 114E scope:

- KAN-114 remains the sole business-reasoning source. 114E must not imply another reasoning model or a second LLM.
- 114D is integrated. Its current path ends at a confirmed Critical Handoff; KAN-125A adds only a deterministic projector, with no 114E API or UI yet.
- 114E remains a partial implementation. Acceptance of this boundary does not establish capability availability to users.
- This boundary is accepted only for 114E capability/claim semantics; its review of Landing and other surface claims does not make it global marketing authority.
- 114F, Portfolio Setup continuity, Core creation, and Steps are outside this authority.
- Legacy `PortfolioEntryHandoff.starteria_path`, `recommended_approach`, `recommended_cta`, and `suggestedRoute` are compatibility evidence only, not sources of 114E semantics.
- Public conversion intent is not product continuation. A Demo URL is not proof that booking works; no first-party Early Access flow is currently evidenced by KAN-121.
- Current State and the Manifest mark Early Access/Demo destinations `RUNTIME_PENDING / BLOCKED_BY_DESTINATION`; KAN-121 did not reproduce the external Demo destination in a browser.

### Open authority and runtime conflicts

These are recorded and remain unresolved; the KAN-126 scoped adoption does not resolve them.

```text
CONFLICT
Contract: ADR-003 document and product ADR index say ACCEPTED.
Requirement: CURRENT_STATE.md says PROPOSED and OPEN / DEFERRED; reconcile before 114F.
Current document/code: those sources continue to report different ADR-003 states.
Observed mismatch: accepted status is not consistent across the authority records.
Risk: registration or Portfolio Setup continuation could be treated as settled when its boundary remains disputed.
Recommended treatment: KEEP the discrepancy open and out of 114E; reconcile before 114F.
Requires ADR: no new ADR is inferred here; human authority reconciliation is required.
```

```text
CONFLICT
Contract: KAN-120 D9-D10 describe public conversion as Early Access / Demo while access is closed.
Requirement: conversion must be transparent and must not be presented as product continuation.
Current document/code: CURRENT_STATE.md and STARTERIA_V2_MANIFEST.md say RUNTIME_PENDING / BLOCKED_BY_DESTINATION; Landing has a configured external Demo link, no first-party Early Access flow, and no KAN-121 browser evidence that the Demo destination works.
Observed mismatch: conceptual conversion options exist, but operational destination availability is not established.
Risk: a CTA may imply a working booking, available access, or a product workspace that the visitor will not receive.
Recommended treatment: KEEP the pending status; require a destination fact check before copy describes an available conversion.
Requires ADR: no for factual destination verification; destination hierarchy and runtime need their own authorized decision/slice.
```

```text
CONFLICT
Contract: KAN-120 D2/D5 require 114E to use the current confirmed Critical Handoff and exclude legacy starteria_path semantics.
Requirement: 114E must remain isolated from legacy handoff meanings.
Current implementation: KAN-121 found a legacy sidecar/API seam can expose legacy handoff data for a current-critical session, although the current 114D browser path uses the Critical Handoff DTO.
Observed mismatch: browser-path isolation does not remove the API compatibility seam.
Risk: a later implementation could accidentally read legacy recommendations or routes as 114E authority.
Recommended treatment: KEEP_COMPAT and preserve strict 114E source binding; any runtime restriction requires a separate technical task.
Requires ADR: not determined by KAN-121; this proposal does not decide it.
```

## 3. Core principle

> **VALUE MUST BE EXPRESSED AS AN OBSERVABLE CHANGE IN USER CLARITY, STRUCTURE, TRACEABILITY, OR DECISION PREPARATION — NOT AS A GUARANTEED BUSINESS RESULT.**

Examples:

| Allowed when the cited capability and input exist | Not allowed as a Starteria promise |
|---|---|
| “Starteria ayuda a hacer visibles la evidencia disponible y lo que todavía no sabemos.” | “Starteria reduce churn.” |
| “Starteria ayuda a estructurar iniciativas conocidas alrededor de una decisión.” | “Starteria identifica qué iniciativa va a ganar.” |
| “Starteria ayuda a preparar una decisión con evidencia trazable.” | “Starteria garantiza mejores decisiones.” |

“Observable” means a person can inspect the changed artifact or state: for example, a decision frame, a source-linked evidence view, a visible gap, or a traceable handoff. A hoped-for business result is not an observable Starteria output merely because it follows in a value-flow diagram.

## 4. Capability taxonomy

The five class names below are exact and normative for this boundary within 114E. A claim belongs to a class based on what it says Starteria does, not on the verb alone. A claim may have a capability class and separately name one or more dependencies.

| Class | Semantic meaning | Eligibility rule | Allowed verbs | Disallowed verbs | Evidence/source required | 114E | Public Landing | CTA |
|---|---|---|---|---|---|---|---|---|
| `CAN_DO` | Starteria directly transforms or presents supplied, supported information into a visible structure or artifact. The product action is within Starteria's control. | A governed capability exists for the named surface; the input is available and source-bound; result is inspectable; no organizational or external outcome must become true. | `ordenar`, `estructurar`, `hacer visible`, `conectar` (non-causal), `preparar` (a frame), `seguir` (only an implemented state). | `garantizar`, `decidir`, `aprobar`, `validar` external reality, `ejecutar` organizational work, or any result verb without evidence. | Approved contract plus product/runtime evidence for the exact surface; source/provenance for material claims. A design or legacy UI alone is insufficient. | Yes, after this boundary is adopted for 114E, only with capability mapping and current 114D source binding. | Yes only for a current, demonstrated capability; this 114E-scoped boundary does not establish Landing authority. | Only to name the supported next interaction, with a verified destination. |
| `CAN_SUPPORT` | Starteria can help a person prepare, compare, clarify, or track decision conditions; the organization retains the decision and action. | State the human/organizational owner and expose the evidence, criteria, or input dependency. The claim must not make Starteria the decision maker. | `ayudar a preparar`, `aclarar`, `comparar` (with criteria), `apoyar`, `hacer seguimiento` (when implemented), `proponer` (provisional and grounded). | `priorizar` or `recomendar` as an unqualified authority; `asignar`, `aprobar`, `decidir`, `garantizar`, `optimizar` without objective and evidence. | Governed support semantics; named dependency; source/evidence for the compared items and criteria; human decision authority. | Yes, conditionally, with dependency and proposal status visible. | Yes only when the support capability exists and the dependency is clear. | Yes when it states a supported next step or asks for an input; it cannot imply result or access. |
| `REQUIRES_ORGANIZATIONAL_INPUT` | A fact, authority, constraint, or decision belongs to the organization and cannot be inferred into truth by Starteria. | The claim depends on information or a decision that only an authorized person/system in the organization can provide or confirm. | `necesitar`, `aportar`, `confirmar`, `declarar`, `documentar`, `aclarar`. | `inventar`, `asignar`, `aprobar`, `decidir por`, `dar por confirmado`, `inferir como hecho`. | Identified organizational owner or authorized source; record whether it is declared, documented, inferred, or confirmed. | Yes, as an explicit dependency or unresolved input. | Only when the dependency materially qualifies a capability claim. | Yes, to request a real input or intent without suggesting it is already available. |
| `REQUIRES_EXTERNAL_EVIDENCE` | A fact about users, markets, product behavior, technical/delivery feasibility, operations, or business impact that reasoning alone cannot establish. | The claim is about external reality or an outcome; cite direct evidence with scope and limits, or preserve it as unknown. | `observar`, `medir`, `contrastar`, `registrar`, `rastrear`, `validar con evidencia externa`. | `demostrar`, `confirmar`, `validar el mercado`, `atribuir`, `predecir`, or `asegurar` by reasoning alone. | A traceable source, method, population/scope, date, metric definition, and limitations appropriate to the claim. | Yes, to expose what evidence exists or is missing; no as a substitute for evidence. | Only as a dependency or as a narrowly evidenced past observation; not as a generic result claim. | Yes, to explain what must be observed or supplied; not to imply the evidence already exists. |
| `CANNOT_PROMISE` | A prohibited guarantee, authority transfer, fabricated fact, unsupported capability, or certain business outcome. | Always applies to generic promises that exceed Starteria's authority. External evidence may support a bounded statement about an observed past result; it cannot turn that observation into a guarantee. | `no puede garantizar`, `requiere validación`, `permanece por decidir`, `todavía no hay evidencia suficiente`. | `garantizar`, `asegurar`, `decidir por`, `aprobar`, `crear evidencia`, `validar por razonamiento`, `ejecutar automáticamente`, `predecir con certeza`. | To state a bounded past outcome, use external evidence and disclose context, period, population, method, and limitations. No evidence can justify a universal guarantee. | Never as an affirmative promise; may appear as a concise boundary or uncertainty statement. | Never as an affirmative promise; a boundary statement may clarify the limit. | Never as an affirmative promise; the CTA may describe only the next interaction. |

### 4.1 Surface rule

The surface column describes eligibility after scoped human adoption and after the capability is evidenced on that surface. This boundary governs capability/claim semantics only within 114E; it is not global product-marketing authority and does not prove capability or destination availability. It does not adopt Landing or Copilot claims or activate a commercial CTA; any 114E CTA remains subject to the verified-destination and accurate-next-interaction rules.

### 4.2 Capability availability

`CAPABILITY_CLASS != AVAILABILITY_STATE`.

`CAPABILITY_CLASS` answers what kind of product truth the claim expresses: a direct capability, supported work, an organizational dependency, an external-evidence dependency, or a prohibited promise. `AVAILABILITY_STATE` answers whether that exact capability is usable now by the stated audience on the stated surface. One does not imply the other. A capability can be semantically legitimate for Starteria while unavailable to a public user.

| Availability state | Meaning and eligibility | Public claim rule |
|---|---|---|
| `CURRENTLY_EVIDENCED` | The exact capability is supported by active authority and current product/runtime evidence on the named surface for the named audience. A concept, test-only adapter, link, mockup, or implementation in another surface is insufficient. | Present-tense capability wording is allowed when bounded to the evidenced surface, input, and result. |
| `GOVERNED_NOT_YET_AVAILABLE` | The capability is explicitly governed or approved as a product target, but is not currently available to the public audience. This scoped adoption does not establish availability on any surface. | Use only future, conditional, or transparent Early Access/Demo wording. State that it is not current public access. |
| `REQUIRES_IMPLEMENTATION` | The capability may be semantically allowed, but the required runtime, route, data source, consent flow, or product operation is not implemented or verified. | Must not be marketed as currently available. Keep it in shaping/roadmap language; public future wording also requires an authorized, transparent conversion path. |
| `ASPIRATIONAL_UNVALIDATED` | The statement is a product aspiration or hypothesis without approved capability semantics or adequate supporting evidence. | Must not be stated as a product capability. If mentioned as an aspiration, label it explicitly and do not attach it to an available CTA as an expected result. |
| `PROHIBITED` | A higher authority or this boundary disallows the claim or capability, regardless of implementation. | Never allowed as a product or public claim. Do not promote through copy, implementation, or a different availability state. |

Availability is surface-specific and time-sensitive. The same `CAN_DO` may be `CURRENTLY_EVIDENCED` for the existing 114D handoff and `REQUIRES_IMPLEMENTATION` for a broader Landing or portfolio-wide experience. Organizational or external inputs can still be required even when the product operation itself is `CURRENTLY_EVIDENCED`.

Example:

```text
CAN_SUPPORT + GOVERNED_NOT_YET_AVAILABLE
= Starteria may legitimately be designed to support this job,
  but public copy cannot present it as operational today.
```

The candidate audit in §5.2 evaluates capability truth only; it does not assign public availability. Apply this section separately to every claim and surface.

### 4.3 Public availability decision table

| State | Present-tense public capability claim | Future/conditional wording | Public CTA |
|---|---|---|---|
| `CURRENTLY_EVIDENCED` | Allowed when bounded and evidenced. | Allowed. | Allowed only to a verified next interaction/destination. |
| `GOVERNED_NOT_YET_AVAILABLE` | Not allowed. | Allowed only when clearly future/conditional and the user is told the continuation is Early Access/Demo, not immediate product access. | Only if the conversion flow and destination are verified; disclose the actual availability state. |
| `REQUIRES_IMPLEMENTATION` | Not allowed. | Do not market as available; internal shaping language only unless an authorized conversion flow truthfully explains the status. | Do not present an unavailable product action as a CTA. |
| `ASPIRATIONAL_UNVALIDATED` | Not allowed as a capability. | Only as an explicitly labeled aspiration, without an expected product result. | Not as an expected product outcome or an available action. |
| `PROHIBITED` | Never allowed. | Never allowed. | Never allowed. |

## 5. `CAN_DO`

### 5.1 Eligibility

Use `CAN_DO` only for a bounded operation Starteria can perform on information it has actually received or on a state the product actually maintains. A missing input may prevent the operation from being useful; that does not let Starteria invent the input. `CAN_DO` describes the product operation, not whether its downstream recommendation or business result is correct.

Capability classifications in §5.2 are independent of availability states. For example, a future initiative-structuring capability can be `CAN_SUPPORT` without being `CURRENTLY_EVIDENCED` or publicly available.

### 5.2 Candidate capability audit

| Candidate | Decision in this proposal | Supported scope and evidence | Safe boundary |
|---|---|---|---|
| Organize information around a decision | `CAN_DO`, bounded | KAN-114 produces a provisional decision frame; 114D presents the current confirmed Critical Handoff. KAN-119 and the accepted KAN-114 record support this scope. | Organize the supplied context around a decision to prepare; do not claim to find the correct decision. |
| Structure initiatives around a decision | `CAN_SUPPORT`, conditional | KAN-120 allows a capability/value projection, but current 114D does not establish an initiative portfolio or create Core objects. A user-provided list and an authorized product surface are prerequisites. | Help structure known initiatives for discussion; do not imply Portfolio Setup, canonical initiative creation, or an implemented 114F path. |
| Make evidence visible | `CAN_DO`, bounded | 114D exposes supported/usable context through an allowlisted, source-bound projection. Only evidence actually supplied or referenced may be shown. | Show available evidence and its provenance; never generate missing evidence. |
| Make uncertainties visible | `CAN_DO`, bounded | KAN-114's accepted semantics include decision-changing unknowns and insufficient-basis abstention; 114D carries the current reading. | Show an unknown and why it could change a decision; do not convert absence into a confident answer. |
| Make restrictions visible | `CAN_DO`, bounded to supplied restrictions | Portfolio Entry can preserve supplied constraints/context. Regulatory or policy meaning still needs an authoritative source and owner. | Show a declared or sourced restriction as such; do not infer a complete policy or legal conclusion. |
| Connect existing information | `CAN_DO`, bounded to supported relationships | KAN-114 evaluation supports relating supplied evidence, time horizons, capacity, and sequencing without inventing causal attribution. | Connect facts and explain the supported relationship; do not claim causation unless external evidence establishes it. |
| Systematize learning | `CAN_SUPPORT`, conditional | No accepted 114D authority establishes an ongoing learning system or experiment lifecycle. Real observations and organizational follow-through are required. | Help organize recorded learning and gaps once evidence exists; do not claim Starteria runs or completes experiments. |
| Maintain traceability | `CAN_DO` only within the bound artifact | 114D's durable artifact is bound to `sourceContextRevision`; KAN-119 records source binding and currentness. This does not establish ongoing portfolio-wide traceability. | Preserve the source link and revision for the current handoff; do not claim indefinite tracking of initiatives. |
| Surface decision-changing unknowns | `CAN_DO`, bounded | This is an accepted KAN-114 reasoning output and appears in the current 114D Critical Handoff. | Surface supported unknowns; do not fill them with synthetic confidence. |
| Prepare a decision frame | `CAN_DO`, bounded | KAN-114 defines `decision_to_enable`; KAN-119 integrates the confirmed handoff. | Prepare context for a human decision; do not make, approve, or certify the decision. |
| Preserve context over time | `CAN_DO` only for the persisted, revision-bound handoff | 114D stores a dedicated artifact and detects currentness against context revision. No broad 114F continuity is authorized. | Preserve the confirmed handoff in its supported lifecycle; do not imply that Starteria maintains a live organization-wide memory. |
| Make initiative status understandable | Not established as a current 114E `CAN_DO` | KAN-114/114D do not prove an ongoing portfolio status tracker. Current initiative status needs organizational data and a separately evidenced product capability. | Do not claim status tracking through 114E. Treat status as organizational input; revisit only under a separately authorized capability and implementation. |

The evaluated list above is not a blanket capability inventory. A candidate marked `CAN_SUPPORT` or “not established” must not be upgraded to `CAN_DO` based on a mockup, old UI, Landing diagram, or legacy `starteria_path`.

### 5.3 Examples and counterexamples

**Allowed:** “Starteria organiza la información que compartiste alrededor de una decisión y deja visibles sus fuentes y dudas abiertas.”

**Not allowed:** “Starteria sabe cuál es la decisión correcta para tu empresa.”

The first claim names a bounded product operation and an inspectable output. The second transfers organizational authority and implies certainty.

## 6. `CAN_SUPPORT`

`CAN_SUPPORT` means the product can help prepare conditions for a decision. It does not make the decision, supply missing organizational authority, or prove a business outcome. Each support claim must expose its owner and dependency.

| Candidate | SAFE phrasing | UNSAFE phrasing | Dependency to expose |
|---|---|---|---|
| Prioritize work | “Starteria puede ayudar a ordenar criterios y evidencia para que el equipo priorice.” | “Starteria prioriza el trabajo correcto.” | Organizational priorities, explicit criteria, available evidence, human decision. |
| Compare initiatives | “Starteria puede ayudar a comparar iniciativas con la evidencia y restricciones disponibles.” | “Starteria identifica la iniciativa ganadora.” | Comparable descriptions, criteria, constraints, and evidence; disclose gaps. |
| Allocate capacity | “Starteria puede ayudar a preparar una conversación sobre capacidad usando la disponibilidad que confirme el equipo.” | “Starteria asigna la capacidad óptima.” | Real capacity, budget, decision rights, and leadership choice. |
| Prepare investment decisions | “Starteria puede ayudar a preparar una decisión de inversión con evidencia, supuestos y límites visibles.” | “Starteria garantiza que la inversión tendrá retorno.” | Financial data, source quality, risk tolerance, authority, and future outcome evidence. |
| Coordinate stakeholders | “Starteria puede ayudar a aclarar quién debe aportar contexto y qué dependencias siguen abiertas.” | “Starteria alinea a los equipos.” | Named stakeholders, ownership, governance, consent, and actual coordination capability. |
| Identify where to focus learning | “Starteria puede señalar qué duda podría cambiar la decisión y qué evidencia falta.” | “Starteria valida la hipótesis y diseña el experimento correcto.” | External evidence and human/organizational choice of learning action. 114E does not authorize full experiment design. |
| Clarify what happens next | “Con lo que compartiste, un primer paso posible sería confirmar la capacidad disponible.” | “Starteria te llevará por el plan correcto.” | Distinguish a proposed user action from a Starteria action; state missing inputs and uncertainty. |
| Support portfolio-level decisions | “Starteria puede ayudar a preparar una revisión del portafolio con datos y criterios que la organización aporte.” | “Starteria decide el portafolio y asigna la inversión.” | Portfolio data, executive priorities, capacity, governance rights, and a separately authorized product surface. 114E is not 114F. |

### 6.1 Recommendation rule

A proposal may be shown only when KAN-114 supports it from the current confirmed handoff. Label it as a proposal, state why it is relevant, preserve provenance, and show what could change it. No recommendation may become a hidden ranking, a prescribed strategy, or a definitive organizational priority.

## 7. `REQUIRES_ORGANIZATIONAL_INPUT`

Starteria cannot infer these values into organizational truth. It may organize, compare, or expose them after an authorized source supplies them. If they are absent, the result is an explicit dependency or unknown.

| Input | Why Starteria cannot own or infer it | What Starteria may do once provided | 114E dependency wording |
|---|---|---|---|
| Available budget | Budget is a controlled organizational commitment and may be confidential or conditional. | Display the declared amount, period, source, and uncertainty; compare scenarios only with explicit criteria. | “Para avanzar necesitaremos conocer el presupuesto realmente disponible y el periodo al que aplica.” |
| Real capacity and availability | Nominal team size does not reveal committed workload, skills, leave, or competing work. | Organize confirmed availability and show capacity assumptions. | “Necesitaremos confirmar qué capacidad está realmente disponible.” |
| Executive priorities | Priority is a leadership choice, not a universal ranking derivable from text. | Show stated priorities and where initiatives relate to them, with provenance. | “La prioridad ejecutiva debe confirmarla la organización.” |
| Strategic constraints | Constraints depend on strategy, commitments, or policy set by authorized people. | Make a supplied constraint visible and show which decision it affects. | “¿Qué límites estratégicos debemos tener en cuenta?” |
| Risk appetite | Tolerance for downside is a decision-rights and context question. | Compare options against a risk tolerance the organization states. | “La tolerancia al riesgo debe definirla quien tiene esa autoridad.” |
| Ownership | A named person/team accepts responsibility; Starteria cannot appoint them by inference. | Record declared owners and unresolved ownership gaps where an authorized feature exists. | “Necesitamos confirmar quién es responsable de esta decisión o iniciativa.” |
| Governance and decision rights | Approval authority, escalation paths, and quorum are organizational rules. | Represent supplied roles and decision gates without inventing them. | “¿Quién puede decidir o aprobar este paso en tu organización?” |
| Timing commitments | Dates and deadlines are commitments made by responsible parties. | Track dates supplied by the owner and flag missing/overdue information only if the product supports it. | “La fecha objetivo debe confirmarla la persona responsable.” |
| Regulatory or policy constraints | The applicable rule, jurisdiction, interpretation, and compliance authority require authoritative sources and qualified review. | Surface a cited rule and request authorized Compliance/legal review; do not determine legal status. | “Necesitamos la fuente normativa aplicable y la revisión autorizada de Compliance.” |
| Internal political or organizational constraints | Informal power, conflicts, and sensitivities are contextual and cannot safely be inferred as fact. | Preserve a person's declared dependency or unknown without treating it as verified. | “Si hay una dependencia organizacional relevante, necesitaremos que la describas o confirme alguien autorizado.” |

**Counterexample:** “Starteria asignará la capacidad óptima.”

**Allowed dependency:** “Starteria puede ayudar a comparar escenarios cuando el equipo confirme la capacidad disponible; la asignación la decide la organización.”

## 8. `REQUIRES_EXTERNAL_EVIDENCE`

### 8.1 What counts as external evidence

External evidence is information grounded outside the model's reasoning itself: for example, source-linked customer research, usage records, support data, a completed experiment, technical assessment, delivery estimate from the responsible team, operational telemetry, audited financial data, or a documented market source. A sentence generated by Copilot, a plan, an illustrative preview, a user aspiration, or a plausible causal story is not external evidence.

Evidence should be traceable to a source and, when relevant, record its date, method, scope/population, metric definition, limitations, and responsible owner. The required detail should match the claim: a user quote may evidence that one user said something; it does not establish market demand.

### 8.2 Candidate facts and dependencies

| Fact or outcome | Why reasoning cannot create it | What Starteria may structure or track | 114E language when missing |
|---|---|---|---|
| Customer demand | Demand must be observed in customer behavior, research, or commitments. | Source, segment, date, sample, signal, and limits. | “La demanda de clientes todavía necesita evidencia externa.” |
| User behavior | Actual behavior must come from observation or reliable telemetry. | Observed event, population, period, and missing coverage. | “Con la información actual no podemos confirmar cómo actúan los usuarios.” |
| Adoption | Adoption requires actual use over a defined population and period. | Adoption definition, cohort, denominator, time window, and source. | “La adopción aún no está medida con una base comparable.” |
| Conversion | Conversion requires a working, measured funnel and defined event. | Funnel stages, observed counts/rates, denominator, period, and source. | “No hay una conversión medida que permita afirmar ese resultado.” |
| Technical feasibility | Feasibility depends on architecture, constraints, access, and technical review. | Assumptions, test results, unresolved dependencies, and review owner. | “La viabilidad técnica requiere revisión de las personas responsables.” |
| Delivery feasibility | Delivery depends on scope, capacity, dependencies, and estimates from owners. | Supplied estimates, dependencies, uncertainty, and status. | “La viabilidad de entrega depende de confirmar alcance, capacidad y dependencias.” |
| Experiment outcome | A result exists only after a real experiment is run and analyzed. | Protocol/source, result, population, limitations, and next decision. | “Todavía no existe un resultado observado de ese experimento.” |
| Operational performance | Performance requires production/operational observations and definitions. | Source-linked metric, time window, affected service/process, and known gaps. | “El desempeño operativo requiere datos del periodo y proceso relevantes.” |
| Business impact | Impact and attribution require measured outcomes and a defensible method. | Outcome metric, baseline, comparison, period, method, and limitations. | “El impacto de negocio sigue pendiente de validación externa.” |
| Market response | Market response must be observed; reasoning cannot validate the market. | Source, segment, date, method, and limits of the signal. | “La respuesta del mercado todavía no está demostrada por evidencia.” |
| Financial impact | Financial effect requires actual finance data and attribution/measurement. | Source, baseline, period, assumptions, and finance-owner review. | “El impacto financiero necesita datos y revisión financiera.” |

### 8.3 Missing evidence and uncertainty

The governing rule is:

```text
NO EVIDENCE
>
FABRICATED CONFIDENCE
```

**Example:** “No hay datos suficientes para afirmar si existe demanda; esa señal debe observarse.”

**Counterexample:** “La solución parece útil, así que el mercado está validado.”

When evidence is missing, Starteria may:

- label the fact as unknown or unmeasured;
- say why it could change the decision;
- point to the evidence/source or organizational input still needed;
- preserve a proposed next observation as a proposal, if supported and in scope.

It must distinguish “no evidence available” from “evidence shows no effect.” It must not fill gaps with synthetic values, market norms, causal attribution, confidence scores, targets, or thresholds unless a separately approved source defines them.

## 9. `CANNOT_PROMISE`

Starteria must not state these as guaranteed, certain, or generally achieved outcomes. A bounded report of a measured past result is a different claim and must cite its evidence; it still cannot promise the result will recur.

| Prohibited promise | Boundary / safer support statement |
|---|---|
| Guaranteed ROI or financial return | May help prepare an investment decision; return remains externally measured. |
| Guaranteed growth or revenue increase | May help structure assumptions and evidence; growth/revenue remain external outcomes. |
| Guaranteed churn reduction | May help make churn evidence and unknowns visible; reduction requires measured external evidence. |
| Guaranteed product-market fit (PMF) | May help organize customer evidence; PMF cannot be declared by reasoning alone. |
| Guaranteed implementation or delivery success | May help expose dependencies and prepare decisions; delivery depends on people, capacity, and events outside Starteria. |
| Guaranteed correct prioritization or “the right initiative” | May help compare explicit criteria and evidence; the organization prioritizes. |
| Guaranteed better decisions or decision quality | May help prepare a traceable decision frame; quality and consequences require human judgment and evidence. |
| Deciding for leadership or the organization | May propose or structure; authorized people decide. |
| Approving or assigning budgets/capacity | May compare scenarios using supplied values; authorized people approve and assign. |
| Creating evidence or validating markets by reasoning alone | May organize sources and identify missing evidence; actual validation is external. |
| Automatically executing initiatives or strategy | May support documented work where a verified feature exists; 114E does not execute initiatives. |
| Removing organizational, market, technical, or delivery risk | May expose known risks and unknowns; it cannot remove them by claim. |
| Replacing governance, leadership, or qualified review | May make decision rights and review needs visible; it cannot take their place. |
| Predicting outcomes with certainty | May describe scenarios or uncertainty under separately governed semantics; no certain prediction is authorized here. |
| Reducing silos, wasted investment, or time as a generic promise | These are organizational/business outcomes; they require an evidenced, scoped, measured claim and remain non-guaranteed. |

## 10. Verb governance

`SAFE` describes a bounded operation on supplied material. `CONDITIONAL` requires a named object, criteria, evidence, owner, or implementation proof. `UNSAFE` is not permitted with Starteria as the actor for the stated claim. The verb label alone never approves a sentence.

| Verb | Class | Context rule | Safe example | Unsafe example |
|---|---|---|---|---|
| `ordenar` | SAFE | Order supplied information without implying its truth, priority, or completeness. | “Ordena el contexto compartido por decisión y evidencia.” | “Starteria ordena la empresa.” |
| `estructurar` | SAFE | Structure information or a frame; a real initiative/portfolio object requires a supplied source and authorized surface. | “Estructura la información disponible alrededor de una decisión.” | “Starteria crea y formaliza tu cartera de iniciativas.” |
| `hacer visible` | SAFE | Show sourced facts, constraints, gaps, and uncertainty with provenance. | “Hace visibles las fuentes y dudas abiertas.” | “Hace visible la demanda real” when no demand evidence exists. |
| `conectar` | SAFE / CONDITIONAL | SAFE for explicit relationships between supplied items; CONDITIONAL when it implies causal, strategic, or live integration links. | “Conecta una iniciativa con la evidencia que el equipo aportó.” | “Conecta el trabajo con impacto probado” without impact evidence. |
| `sistematizar` | CONDITIONAL | Name the records/process being organized; do not imply an operational learning loop unless implemented. | “Ayuda a sistematizar aprendizajes ya registrados.” | “Starteria aprende del mercado y optimiza automáticamente.” |
| `seguir` | CONDITIONAL | Requires an implemented tracking surface, source, owner, and time boundary. | “Permite seguir el estado que el equipo registra en este espacio.” | “Starteria sigue el avance de toda la organización” without that capability. |
| `preparar` | SAFE / CONDITIONAL | SAFE for preparing a decision frame; CONDITIONAL for any plan, implementation, funding, or readiness outcome. | “Ayuda a preparar una decisión con evidencia trazable.” | “Prepara la estrategia correcta para crecer.” |
| `comparar` | CONDITIONAL | Requires comparable inputs, explicit criteria, and evidence; no hidden universal score or winner. | “Compara estas iniciativas con los criterios acordados.” | “Compara y determina cuál iniciativa ganará.” |
| `priorizar` | CONDITIONAL | The organization is the subject/decision maker; Starteria may organize criteria and evidence. | “Ayuda al equipo a priorizar con restricciones visibles.” | “Starteria prioriza lo correcto.” |
| `recomendar` | CONDITIONAL | Must be provisional, grounded in KAN-114, source-bound, and open to human correction; no prescribed strategy. | “Propone un primer movimiento posible y explica qué lo haría cambiar.” | “Recomienda la iniciativa que debes ejecutar.” |
| `decidir` | UNSAFE with Starteria as subject | The human/organization may decide with support. | “Ayuda a preparar la decisión que tomará el equipo.” | “Starteria decide por liderazgo.” |
| `validar` | CONDITIONAL | May check a claim against cited source/criteria; market, user, legal, or technical validation needs external evidence and an authorized owner. | “Contrasta esta afirmación con la fuente aportada.” | “Starteria valida el mercado con razonamiento.” |
| `demostrar` | CONDITIONAL | Requires a defined, bounded proposition and adequate external evidence; cannot turn a past observation into a guarantee. | “Estos datos muestran el resultado observado en este periodo.” | “Starteria demuestra que la estrategia funcionará.” |
| `optimizar` | CONDITIONAL / HIGH RISK | Requires an explicit objective, baseline, constraints, method, and measured evidence; 114E does not authorize optimization. | “Compara alternativas respecto del objetivo que definió el equipo.” | “Starteria optimiza el portafolio.” |
| `acelerar` | CONDITIONAL / HIGH RISK | A speed claim needs baseline, measured time window, scope, comparison, and external evidence; no general promise. | “En el piloto medido, el tiempo observado cambió de X a Y en este contexto.” | “Starteria acelera la innovación.” |
| `reducir` | CONDITIONAL / HIGH RISK | Requires a measured quantity, baseline, period, scope, and credible attribution; never a generic outcome guarantee. | “El informe registra una reducción medida en esta cohorte.” | “Starteria reduce churn/silos/costes.” |
| `mejorar` | CONDITIONAL / HIGH RISK | Name the measured dimension, baseline, population, and evidence; “better decisions” is not self-proving. | “Ayuda a mejorar la trazabilidad del marco de decisión” only if that artifact is demonstrably changed. | “Starteria mejora tus resultados.” |
| `garantizar` | UNSAFE | No business, decision, access, or execution guarantee is authorized. | “La decisión y el resultado siguen dependiendo de la organización y de evidencia externa.” | “Starteria garantiza ROI.” |
| `ejecutar` | UNSAFE as an 114E business claim | It implies action in the organization. Only literal, separately evidenced product operations may be described in their own authorized scope. | “El producto guarda el artefacto confirmado” if that operation is evidenced. | “Starteria ejecuta tu estrategia.” |
| `escalar` | CONDITIONAL / HIGH RISK | May describe a human-approved process expansion only with explicit criteria and evidence; not automatic business growth. | “El equipo puede decidir si amplía el piloto tras revisar sus resultados.” | “Starteria escala lo que funciona.” |

## 11. Value delta model

Every future `value_bridge` should use this sequence:

```text
CURRENT STATE
→ STARTERIA CONTRIBUTION
→ OBSERVABLE OUTCOME
→ BUSINESS OUTCOME REMAINS EXTERNAL
```

| Field | Required content |
|---|---|
| `current_state` | A source-bound description of the user's current situation; preserve what is known and unknown. |
| `starteria_contribution` | A capability mapped to this contract; name the product operation and the supplied object/input. |
| `tangible_outcome` | A view, frame, trace, or state the user can inspect. Do not use a KPI or business result as a substitute. |
| `business_outcome_boundary` | State which organizational choice, execution condition, or external result is still undecided or unvalidated. |

**Illustrative example; not evidence of current runtime capability:**

| Delta | Example |
|---|---|
| Current state | “Hay 20 iniciativas y la evidencia está fragmentada.” This statement must come from supplied information. |
| Starteria contribution | “Puede ayudar a ordenar las iniciativas aportadas alrededor de una decisión y hacer visibles sus fuentes y vacíos.” |
| Observable outcome | “Una vista común de decisión con evidencia trazable y preguntas abiertas.” This is the tangible artifact, not a promise that 114E currently creates it. |
| Business outcome remains external | “Qué iniciativa producirá impacto, si lo produce, queda por decidir y validar con evidencia externa.” |

## 12. 114E claim boundary

114E may, after its own authorization and implementation, say:

- what the projection can structure or make visible from the current confirmed Critical Handoff;
- what decision frame or other tangible artifact/state is proposed;
- what the person or organization may prepare next;
- what first supported movement is possible, with its source and proposal status;
- what organizational input or external evidence remains missing.

114E must distinguish the **VALUE PROMISE** from **CURRENT AVAILABILITY**. It may explain governed future value only when that value is classified separately from availability and its wording does not imply public operation. For `GOVERNED_NOT_YET_AVAILABLE`, use future/conditional language and state that current continuation is an Early Access/Demo conversion, not direct access to a product workspace. The actual option and destination must also be described truthfully; a configured but unverified destination cannot be presented as operational.

Allowed future-value example, only after the capability is governed and a truthful conversion path is available:

> “Con Starteria podremos convertir esta lectura en una estructura de trabajo donde puedas ordenar iniciativas, evidencia e incertidumbres alrededor de la decisión.”
>
> Adjacent disclosure: “Continuar significa solicitar Early Access o una Demo; no es acceso inmediato al producto.” State which option is actually available.

Not allowed when product continuation does not exist:

> “Empieza ahora a gestionar estas iniciativas con Starteria.”

114E must not say or imply:

- that a business goal will be achieved, that a particular strategy is correct, or that an initiative should definitely win;
- that the product will reduce churn, increase revenue, deliver ROI, improve PMF, save time, or create impact as a guaranteed/general result;
- that something has been validated when the evidence has not been observed and cited;
- that Starteria decides, prioritizes definitively, approves budgets, assigns real capacity, coordinates people in the organization, or executes initiatives;
- that a new LLM/Copilot analysis is producing the value bridge. 114E is a bounded projection of the current confirmed 114D/KAN-114 result; KAN-114 remains the sole business-reasoning source;
- that 114E creates Core objects, enters Portfolio Setup, activates Steps, or crosses into 114F;
- that legacy `starteria_path` or its related recommendations/routes define the capability path;
- a generic path when the handoff has insufficient basis or is no longer current.

Each 114E capability statement must name its supporting capability and source. When the output is a proposal, say so; when a dependency could change the action, show it. Distinguish clearly between an action the user/organization takes and an action the product performs.

## 13. Landing and commercial claim boundary

### 13.1 Claim types

| Type | Meaning | Use rule | Example |
|---|---|---|---|
| Product capability claim | Says what an evidenced product surface does. | Name actor, action, object, visible result, surface, and evidence. Do not describe a future mockup as current. | “Starteria hace visibles la evidencia aportada y las dudas abiertas alrededor de una decisión.” |
| Support claim | Says how Starteria helps a person prepare or compare while the person/organization retains authority. | State the owner and relevant input/evidence dependency. | “Starteria ayuda a preparar decisiones de inversión con evidencia y restricciones visibles.” |
| Outcome claim | Says that business, team, user, or decision performance changes. | Requires fit-for-purpose external measurement and a bounded context. It remains non-guaranteed; no generic public promise. | “Starteria mejora la calidad de las decisiones” is an outcome claim and is not safe without a defined measure and evidence. |
| Aspirational claim | Describes the intended direction or brand ambition. | Label as aspiration or write it so it cannot be mistaken for a present-tense product result. It cannot replace a capability claim. | “De la estrategia al impacto real” is aspirational but reads as an outcome promise in a headline; review before reuse. |

“Starteria makes evidence and uncertainty visible” is a product-capability claim only for a surface that demonstrably does this with supplied/sourced information. “Starteria helps teams prepare investment decisions with traceability” is a support claim and must expose the input and human decision boundary. “Starteria reduces wasted investment” and “Starteria reduces churn” are business outcome claims and are not safe generic promises.

### 13.2 Public copy and CTA rules

- This contract does not rewrite the Landing or authorize a copy change.
- A capability claim may appear publicly only after that capability is current, evidenced, and authorized for the named surface. This proposal is not that evidence.
- A support claim must identify what the team provides or decides. “Helps” does not make an unsupported outcome claim safe.
- A public preview with fictional data must keep its illustrative/fictitious label adjacent and legible; it must not imply a visitor-specific analysis or typical result.
- Public copy must not imply that Early Access is available until its actual destination and operating flow are verified. A configured URL is not availability evidence.
- Public copy must not imply Demo booking works merely because a URL exists. Verify the destination before describing it as an operational booking.
- A CTA can be contextual (“solicita una conversación sobre cómo estructurar esta decisión”) only if the next interaction exists and its destination is verified. It cannot promise access, onboarding, a workspace, a result, or product continuation when the action records only commercial intent.
- Sharing Portfolio Entry context with a commercial destination requires explicit consent that names the context, purpose, and recipient. No automatic context transfer is implied.
- Copilot explanations of value follow the same claim rules. This boundary gives Copilot no additional reasoning authority and does not authorize a second LLM for 114E.
- Every public value claim must carry both a `capability_class` and an `availability_state` for the exact audience and surface. A correct capability classification does not establish that a public user can use it now.

## 14. Testable claim rules

Every allowed claim must be representable by this record. A missing required field makes the claim ineligible.

```yaml
claim_id: stable identifier
capability_class: CAN_DO | CAN_SUPPORT | REQUIRES_ORGANIZATIONAL_INPUT | REQUIRES_EXTERNAL_EVIDENCE | CANNOT_PROMISE
availability_state: CURRENTLY_EVIDENCED | GOVERNED_NOT_YET_AVAILABLE | REQUIRES_IMPLEMENTATION | ASPIRATIONAL_UNVALIDATED | PROHIBITED
subject: who acts
action: governed action verb and its context
object: what the action applies to
observable_result: inspectable artifact or state change
dependency: organizational input, external evidence, human decision, or "none" with reason
evidence_ref: contract/runtime/source reference supporting this exact capability claim
surface_scope: 114E | Landing | CTA | Copilot (one or more)
runtime_status: current verified capability | proposed | unavailable | unknown
business_outcome_boundary: what remains outside Starteria's control
```

The following checks are normative for future human reviews and implementation tests:

1. **Subject:** identify who acts. Reject sentences that hide whether the actor is Starteria, a person, or the organization.
2. **Action:** check the verb against §10 in the sentence's context. Reject an unsafe verb with Starteria as subject.
3. **Object:** name the information, evidence, decision frame, or state acted on. Reject an unbounded object such as “your business” when the capability is only a current handoff.
4. **Observable result:** point to an inspectable artifact/state. Reject business impact, “better decisions,” or user confidence as the only result.
5. **Dependency:** name the organizational input, human authority, external evidence, currentness, or destination prerequisite. Reject an unstated material dependency.
6. **Evidence:** link the exact claim to a governed contract and surface evidence. A candidate contract, illustrative mockup, legacy runtime, or URL existence does not pass.
7. **Availability:** assign exactly one `availability_state` independently of `capability_class`. Apply the public rules in §4.2-§4.3; the same capability may have different states on different surfaces.
8. **Scope:** reject a claim that implies Core, Steps, 114F, portfolio-wide execution, an unimplemented flow, or a second LLM.
9. **Uncertainty:** reject a claim that turns missing evidence into a fact, causal explanation, confidence, recommendation, or guarantee.
10. **Conversion:** reject a CTA that implies product continuation or a working Early Access/Demo destination without verified availability; reject context sharing without explicit consent.
11. **Value delta:** reject a `value_bridge` that lacks a tangible artifact/state or presents a business outcome as if Starteria produced it.

Reject any public value claim missing either classification. `CANNOT_PROMISE` or `PROHIBITED` cannot be made eligible by assigning a more favorable availability state.

Example passing shape, once the capability is evidenced on the relevant surface:

```yaml
claim_id: visible-evidence-and-unknowns
capability_class: CAN_DO
subject: Starteria
action: makes visible
object: supplied evidence and uncertainty around the current decision
observable_result: a common decision view with source links and open gaps
dependency: the user supplies the context; business impact remains externally validated
evidence_ref: KAN-114 accepted semantics + current/confirmed 114D source binding + surface evidence
surface_scope: 114E
runtime_status: proposed
business_outcome_boundary: which action creates business impact remains for people to decide and external evidence to validate
```

`runtime_status: proposed` is not eligible for present-tense Landing copy.

## 15. Current claim audit

### 15.1 Method and scope

The audit searched current Landing source (`LandingPage.tsx`, `StarteriaProductPreview.tsx`, `ConceptMap.tsx`, and public Landing config) and the governed public-Landing UX spec, KAN-112 visual-freeze record, and KAN-121 audit §12. Search terms included the requested Spanish/English variants for clarity, alignment, better decisions, silos, acceleration, impact, value, evidence, prioritization, scale, and execution. This is a representative claim review, not a rewrite or a global certification of copy in legacy Steps or unrelated product surfaces.

The public-Landing UX spec is marked `DOCUMENTAL ONLY / LISTA PARA REVISIÓN DE PRODUCTO Y DISEÑO`, with implementation unauthorized. KAN-112 is an audit/visual-freeze record. These documents are evidence of wording and status; neither silently upgrades a claim to current runtime capability.

### 15.2 Claim register

The `Classification` column in this source register describes wording type. Normative `capability_class` and `availability_state` dispositions for each actual claim are in §15.3.

| Claim | Location | Classification | Safe? | Why | Recommended treatment |
|---|---|---|---|---|---|
| “Más claridad en menos tiempo” | `front/src/app/pages/LandingPage.tsx:34` | Comparative outcome claim | No, not generically | “En menos tiempo” implies measured speed improvement; no baseline or evidence was found in the reviewed authority. | Do not carry into 114E. Any future public use needs scoped time evidence; prefer an observable clarity artifact. |
| “Equipos alineados de verdad” / “Alinea el trabajo” | `LandingPage.tsx:35, 41` | Organizational outcome claim | No as a result promise | Alignment depends on people, authority, and organizational decisions. The product can expose context or dependencies but cannot make teams align. | If reused later, state what Starteria structures and who owns alignment; do not promise the state. |
| “Decisiones con evidencia” / “preparar mejores decisiones” | `LandingPage.tsx:36, 228`; public-Landing UX spec §4.2 | Mixed capability/support and outcome claim | Conditional | Making cited evidence visible and preparing a frame can be supported; “better” decision quality is an outcome that needs definition and evidence. | Describe the traceable preparation capability; treat decision quality as unproven external outcome. |
| “Cómo te ayuda Starteria” / “cerrar el ciclo con evidencia para decidir” | `LandingPage.tsx:236-238` | Support/value claim with implied process-completion reading | Conditional | The title is neutral; “close the cycle” can imply a complete execution/learning lifecycle beyond current 114D. | Name the bounded decision-preparation contribution; do not imply end-to-end execution or ongoing learning. |
| “Reduce silos” | `LandingPage.tsx:189`; KAN-121 audit §12 | Organizational outcome claim | No as a generic promise | Silo reduction requires organizational behavior change and has no measure in the reviewed evidence. | Do not claim reduction. If there is later evidence, describe a bounded observed result, not a guarantee. |
| “Acelerar / accelerate” | Search of the scoped current Landing source and audited Landing copy | No matching current claim found | Not applicable | Absence in this scan does not establish capability. Acceleration is a measured outcome verb under §10. | Do not add as a generic claim; require a baseline and external measurement for any bounded past result. |
| “De la estrategia al impacto real”; “Haz que la estrategia se haga realidad”; “Mayor impacto”; “para que la estrategia llegue a resultados” | `LandingPage.tsx:178-182, 345, 530` | Aspirational claim with business-outcome reading | Not safe as a factual promise | It suggests Starteria produces impact or realizes strategy, which remains external and unverified. | If retained in future copy, label/reframe as an ambition and pair it with a concrete capability; do not reuse as a 114E result. |
| “Starteria cierra esa brecha con contexto, conexión y evidencia” | `LandingPage.tsx:334` | Outcome claim attached to capability nouns | No as written | “Cierra esa brecha” asserts that the business/strategy-to-execution gap is solved; context/evidence alone does not prove that outcome. | State which context or evidence artifact Starteria structures; leave execution and impact external. |
| “Evidencia necesaria para lograrlo” / “conecta … trabajo, personas y evidencia” | `LandingPage.tsx:186`; KAN-121 audit §12 | Capability claim with implied sufficiency/causality | Conditional, current wording is risky | Connecting supplied context can be supported; saying evidence is sufficient to achieve the goal implies causal sufficiency. | Bound the object to supplied information and say it helps prepare/inspect the decision; do not imply achievement. |
| “Ejecuta con visibilidad, colaboración y evidencia” / “Hazlas realidad” | `LandingPage.tsx:52` and value-flow step title | Execution/outcome claim | No for 114E | It implies Starteria or its flow executes initiatives and achieves the goal; execution belongs to organizational actors and is outside 114E. | Do not reuse in 114E. Any current product claim needs a separate capability and runtime audit. |
| “Starteria mantiene contexto” | `LandingPage.tsx:189`; KAN-121 audit §12 | Product capability claim | Only narrowly | KAN-119 supports persisted, revision-bound 114D handoff context; it does not establish continuous organization-wide context maintenance. | Restrict any future claim to the current bound artifact and lifecycle; do not generalize to ongoing portfolio memory. |
| “La IA estructura y propone; las decisiones siguen siendo humanas” | `LandingPage.tsx:109`; KAN-121 audit §12 | Product/human-authority boundary claim | Yes when scoped; not proof of all AI surfaces | It aligns with human decision authority, but a general platform statement does not authorize a second LLM or expand KAN-114 reasoning. | Keep any future 114E explanation explicitly sourced to the existing KAN-114/114D projection and preserve human authority. |
| “Convierte la lectura en iniciativas, equipos y evidencia dentro de la plataforma” | `LandingPage.tsx:92` | Product-continuation / 114F implication | No for current 114E | KAN-120 ends 114E at `continuation_intent`; 114F is not authorized and public conversion does not equal product continuation. | Do not reuse for KAN-123/114E. Keep the mismatch visible for a separately authorized Landing change. |
| “30% menos tiempo operativo” with “Caso ilustrativo” and “datos ficticios” | `StarteriaProductPreview.tsx:34-103`; KAN-121 audit §12 | Outcome example / illustrative mockup | Only while unmistakably illustrative | The displayed label and caption say the data are fictitious; it is not measured evidence or a typical result. | Keep labels adjacent and legible in any future visual; never use the number as an observed Starteria result. |
| “Ordena y prioriza tus iniciativas”; “Da seguimiento al portafolio…” | Legacy handoff cards, KAN-121 audit §12 | Legacy claim; not current 114D evidence | No as 114E evidence | The audit identifies these as legacy UI claims; `starteria_path` and related fields are explicitly not 114E authority. | Do not promote or reuse. Retain only as compatibility/history evidence. |
| “Reservar demo” / “Agendar una demo” | `LandingPage.tsx` header, hero, and footer; KAN-121 audit §§12, 14 | CTA / availability claim | Availability not established | The configured external link proves wiring only; KAN-121 did not verify booking. No first-party Early Access flow exists. | Do not infer availability from URL existence. A destination fact check and authorized conversion flow must precede availability wording. |
| “Demo es el mejor primer paso para la audiencia prioritaria” | Public-Landing UX spec §4.2 (documental only) | Commercial recommendation / aspirational hierarchy | Not established | The spec is not implemented authority, and the Demo destination has not been verified as operational or appropriate for that audience. | Do not assume this hierarchy in CTA copy; verify destination and audience evidence in the authorized conversion work. |
| “Escalar / scale” | Search of scoped current Landing source and audited Landing copy | No matching current scale claim found | Not applicable | No current public claim was identified; scaling remains conditional and cannot mean guaranteed growth. | Do not add a generic scaling promise. Apply §10 if a future bounded process claim is proposed. |
| “Priorizar / prioritize” | Current Landing scan: none; legacy handoff wording is recorded in KAN-121 audit §12 | Legacy-only claim in audited material | No as 114E claim | Current 114D does not make a definitive priority decision; legacy wording is not authority. | Use only support framing with explicit criteria and organizational decision owner. |

This register classifies wording; it does not change, approve, deprecate, or rewrite the cited copy. No current copy is made safe merely by adopting this 114E-scoped boundary.

### 15.3 Current public claim dispositions

This matrix assigns both dimensions to every actual public/Landing claim represented in §15.2. The capability and availability states apply to the exact claim for a Landing visitor. A bounded alternative is a wording ceiling only; it does not grant publication authority or assert Early Access/Demo availability. The neutral heading “Cómo te ayuda Starteria” is not itself a value claim; the disposition below applies to “cerrar el ciclo con evidencia para decidir.”

| Claim | Location | Capability class | Availability state | Current-safe? | Allowed framing | Treatment |
|---|---|---|---|---|---|---|
| “Más claridad en menos tiempo” (the audited clarity claim) | `front/src/app/pages/LandingPage.tsx:34` | `CANNOT_PROMISE` | `PROHIBITED` | No; it asserts an unmeasured speed improvement. | Reframe around an inspectable contribution, such as making supplied evidence and uncertainty visible; do not claim faster clarity. | `REFRAME_BEFORE_USE` — no time baseline or outcome evidence. |
| “Equipos alineados de verdad” | `LandingPage.tsx:35` | `CANNOT_PROMISE` | `PROHIBITED` | No; Starteria does not own team alignment. | Describe information or dependencies the team can review; leave alignment to people and organizational decisions. | `REFRAME_BEFORE_USE` — organizational outcome. |
| “Alinea el trabajo” | `LandingPage.tsx:41` | `CANNOT_PROMISE` | `PROHIBITED` | No; it states an organizational result. | At most, describe how supplied work and evidence could be structured for human discussion, subject to the actual available surface. | `REFRAME_BEFORE_USE` — structuring does not make teams align. |
| “Decisiones con evidencia” | `LandingPage.tsx:36`; public-Landing UX spec §4.2 | `CAN_SUPPORT` | `GOVERNED_NOT_YET_AVAILABLE` | No as a currently available capability for Landing visitors. | Future/conditional wording may say Starteria can help prepare a human decision using supplied, traceable evidence; disclose the actual continuation path if one is verified. | `FUTURE_ONLY` — bounded evidence preparation is supported; public continuation is not established. |
| “Preparar mejores decisiones” | `LandingPage.tsx:228`; public-Landing UX spec §4.2 | `CANNOT_PROMISE` | `PROHIBITED` | No; “mejores” asserts unmeasured decision quality. | Say “ayudar a preparar una decisión con evidencia trazable”; do not assert better decisions. | `REFRAME_BEFORE_USE` — decision quality needs a defined measure and external evidence. |
| “Cerrar el ciclo con evidencia para decidir” | `LandingPage.tsx:236-238` | `CAN_SUPPORT` | `REQUIRES_IMPLEMENTATION` | No; the wording implies an ongoing learning/execution loop not established by 114D. | After authorized implementation, describe organizing recorded learning and available evidence for a decision; do not say the full cycle is closed. | `REFRAME_BEFORE_USE` — the current handoff does not implement an end-to-end cycle. |
| “Reduce silos” | `LandingPage.tsx:189`; KAN-121 audit §12 | `CANNOT_PROMISE` | `PROHIBITED` | No; it promises organizational change without measurement. | Describe a concrete information relationship or traceable view only where that exact capability is evidenced. | `DO_NOT_USE_AS_PRODUCT_CLAIM` — silo reduction is an external organizational outcome. |
| “De la estrategia al impacto real” | `LandingPage.tsx:178-182` | `CANNOT_PROMISE` | `ASPIRATIONAL_UNVALIDATED` | Only if expressly labeled as an aspiration, never as a factual product result. | If retained as brand ambition, label it as such and pair it with a separately evidenced capability; do not imply Starteria produces impact. | `REFRAME_BEFORE_USE` — no validated impact evidence. |
| “Haz que la estrategia se haga realidad” | `LandingPage.tsx:178-182` | `CANNOT_PROMISE` | `PROHIBITED` | No as a Starteria result; it implies the product realizes strategy. | Describe only a bounded preparation step; organizational execution and results remain external. | `DO_NOT_USE_AS_PRODUCT_CLAIM` — execution is outside Starteria's governed scope. |
| “Mayor impacto” | `LandingPage.tsx:345` | `CANNOT_PROMISE` | `PROHIBITED` | No; reviewed sources provide no measured impact evidence. | Name an observable artifact or state change; leave business impact for external measurement. | `DO_NOT_USE_AS_PRODUCT_CLAIM` — generic business outcome. |
| “Para que la estrategia llegue a resultados” | `LandingPage.tsx:530` | `CANNOT_PROMISE` | `PROHIBITED` | No; it implies Starteria causes execution or results. | Describe decision preparation and keep execution and resulting impact with the organization and external evidence. | `DO_NOT_USE_AS_PRODUCT_CLAIM` — outcome and execution are not owned by the product. |
| “Starteria cierra esa brecha con contexto, conexión y evidencia” | `LandingPage.tsx:334` | `CANNOT_PROMISE` | `PROHIBITED` | No as written; it claims the strategy-to-execution gap is solved. | Name the exact context or evidence artifact structured; do not say the gap is closed. | `REFRAME_BEFORE_USE` — capability nouns do not substantiate the claimed outcome. |
| “Evidencia necesaria para lograrlo” | `LandingPage.tsx:186` | `CANNOT_PROMISE` | `PROHIBITED` | No; it implies evidence is sufficient to achieve the goal. | Say available evidence can be organized and gaps made visible; achievement remains externally unvalidated. | `REFRAME_BEFORE_USE` — evidence sufficiency and causality are not established. |
| “Conecta … trabajo, personas y evidencia” | `LandingPage.tsx:186`; KAN-121 audit §12 | `CAN_SUPPORT` | `REQUIRES_IMPLEMENTATION` | No as a current cross-organizational connection capability; that operation is not evidenced. | After authorization, implementation, and verification, name the supplied items linked and the resulting view; do not imply coordination or causality. | `FUTURE_ONLY` — the broad work/people connection exceeds the current handoff. |
| “Ejecuta con visibilidad, colaboración y evidencia” | `LandingPage.tsx:52` | `CANNOT_PROMISE` | `PROHIBITED` | No; it implies Starteria executes initiatives. | The organization executes; a future product statement may describe only a separately evidenced preparation or tracking operation. | `DO_NOT_USE_AS_PRODUCT_CLAIM` — execution is not authorized by 114E. |
| “Hazlas realidad” | LandingPage value-flow step title | `CANNOT_PROMISE` | `PROHIBITED` | No as a Starteria result claim. | Do not attribute realization to Starteria; name only an evidenced preparation artifact. | `DO_NOT_USE_AS_PRODUCT_CLAIM` — the result remains organizational and external. |
| “Starteria mantiene contexto” | `LandingPage.tsx:189`; KAN-121 audit §12 | `CAN_DO` | `GOVERNED_NOT_YET_AVAILABLE` | No as an unbounded present-tense claim to Landing visitors; only the persisted, revision-bound 114D handoff is evidenced. | Future/conditional wording must be limited to preserving context in the confirmed 114D handoff and must not imply public continuation or organization-wide memory. | `FUTURE_ONLY` — broad continuity exceeds the evidenced artifact and public access is unestablished. |
| “La IA estructura y propone; las decisiones siguen siendo humanas” | `LandingPage.tsx:109`; KAN-121 audit §12 | `CAN_DO` | `GOVERNED_NOT_YET_AVAILABLE` | No as a general, currently available Landing capability; bounded KAN-114/114D behavior is evidenced, but Landing continuation is not. | Refer only to the existing KAN-114/114D projection, preserve the human decision boundary, and disclose the actual continuation status if publicly presented. | `FUTURE_ONLY` — does not authorize another reasoning source or imply public access. |
| “Convierte la lectura en iniciativas, equipos y evidencia dentro de la plataforma” | `LandingPage.tsx:92` | `CANNOT_PROMISE` | `PROHIBITED` | No; it implies product continuation, initiative creation, and 114F semantics. | At 114E, describe only continuation intent or a verified commercial request; do not promise in-platform conversion. | `DO_NOT_USE_AS_PRODUCT_CLAIM` — 114F is unauthorized and public conversion is not product continuation. |
| “30% menos tiempo operativo” with “Caso ilustrativo” and “datos ficticios” | `StarteriaProductPreview.tsx:34-103`; KAN-121 audit §12 | `CANNOT_PROMISE` | `ASPIRATIONAL_UNVALIDATED` | Only as an unmistakably fictitious illustration; never as an observed or typical Starteria result. | Keep “caso ilustrativo” and “datos ficticios” adjacent and legible; do not present the number as a measured product effect. | `ILLUSTRATIVE_ONLY` — the metric is not external evidence. |
| “Ordena tus iniciativas” | Legacy handoff cards; KAN-121 audit §12 | `CAN_SUPPORT` | `REQUIRES_IMPLEMENTATION` | No as current 114D evidence; legacy `starteria_path` is not authority. | Only after authorized implementation, say Starteria may help structure user-provided initiatives around a decision; state that the team decides. | `FUTURE_ONLY` — candidate support semantics do not establish an available feature. |
| “Prioriza tus iniciativas” | Legacy handoff cards; KAN-121 audit §12 | `CAN_SUPPORT` | `REQUIRES_IMPLEMENTATION` | No; definitive product prioritization is not evidenced and legacy wording is not authority. | After authorization and implementation, say it can help the team compare supplied evidence, criteria, and constraints so people can prioritize. | `FUTURE_ONLY` — the organizational decision remains with the team. |
| “Da seguimiento al portafolio” | Legacy handoff cards; KAN-121 audit §12 | `CAN_SUPPORT` | `REQUIRES_IMPLEMENTATION` | No; ongoing portfolio tracking is not evidenced by 114D. | Describe tracking only after an authorized surface, source, owner, and time boundary exist. | `FUTURE_ONLY` — current handoff persistence does not establish portfolio tracking. |
| “Reservar demo” / “Agendar una demo” | `LandingPage.tsx` header, hero, and footer; KAN-121 audit §§12, 14 | `REQUIRES_ORGANIZATIONAL_INPUT` | `REQUIRES_IMPLEMENTATION` | No; the configured URL does not verify an operating booking or available Demo. | Describe booking only after the organization verifies the destination and actual flow; do not state that a Demo is available before that. | `REFRAME_BEFORE_USE` — operational availability and the next interaction are unverified. |
| “Demo es el mejor primer paso para la audiencia prioritaria” | Public-Landing UX spec §4.2 (documental only) | `REQUIRES_EXTERNAL_EVIDENCE` | `ASPIRATIONAL_UNVALIDATED` | No; neither audience fit nor Demo availability is established. | Treat as an internal hypothesis until audience evidence and organizational approval exist; do not use as public CTA framing. | `REFRAME_BEFORE_USE` — “best” requires evidence and a verified operating destination. |

The search terms “acelerar / accelerate” and “escalar / scale” produced no matching current Landing claim in the audited sources. They are absence findings, not claims, so this matrix assigns no classes to them and does not invent claim text. The “Prioriza tus iniciativas” row above records prioritization wording found only in legacy handoff material. The standalone word “claridad” was not audited as a separate sentence; its existing claim is covered by “Más claridad en menos tiempo.”

## 16. Examples and counterexamples

| Situation | Allowed boundary expression | Counterexample |
|---|---|---|
| Supplied evidence and unknowns | “Starteria ayuda a hacer visibles la evidencia disponible y las dudas que todavía pueden cambiar esta decisión.” | “Starteria sabe qué está causando el problema.” |
| Initiatives around a decision | “Con la lista y los criterios que aporte el equipo, Starteria puede ayudar a preparar una comparación.” | “Starteria selecciona la iniciativa ganadora.” |
| Investment preparation | “Podemos organizar fuentes, supuestos, restricciones y preguntas para la revisión de inversión.” | “Esta inversión generará retorno.” |
| No external evidence | “No hay datos suficientes para afirmar si la demanda existe; esa señal debe observarse.” | “El mercado validará la solución.” |
| Organizational capacity missing | “Para avanzar necesitaremos conocer la capacidad realmente disponible.” | “Starteria asignará la capacidad óptima.” |
| Human authority | “Starteria prepara el marco; el equipo decide qué priorizar.” | “Starteria decide por el equipo.” |
| Next step proposal | “Un primer paso posible es confirmar la restricción que más podría cambiar la decisión.” | “Este es el plan correcto para conseguir el resultado.” |
| Conversion | “Solicitar información sobre una posible demo” only if that request flow exists and is verified. | “Reserva tu demo ahora” when the destination has not been validated. |

## 17. Known gaps and unresolved items

1. **Scope adoption:** KAN-126 accepts this boundary only for 114E capability/claim semantics. That acceptance does not make any capability available or authorize global marketing claims, 114F, Core, or Steps.
2. **Commercial destination:** KAN-120's conceptual Early Access/Demo framing conflicts with the pending/unverified runtime status. KAN-123 needs a fact-checked destination before describing a CTA as operational.
3. **Context consent:** current commercial forms do not establish consent to share Portfolio Entry context. The exact scope, purpose, recipient, and decline path need separate definition before any transfer.
4. **Legacy sidecar seam:** KAN-121 found legacy handoff data can be read for a current-critical session through compatibility APIs. This contract forbids using it as 114E semantics; runtime quarantine is a separate task.
5. **Portfolio-wide capabilities:** current 114D does not prove active initiative tracking, organizational coordination, portfolio status management, capacity allocation, or an ongoing learning loop. These require their own contracts and product evidence.
6. **Outcome claims:** no reviewed source supplies validated, general evidence for ROI, growth, churn, PMF, speed, reduced silos, reduced wasted investment, or better decision quality.
7. **ADR-003:** index/document and `CURRENT_STATE.md` disagree; keep `OPEN / DEFERRED` until reconciled before 114F.
8. **Active Logic Contract cross-reference:** its §22 contains a documented open relationship to the unpromoted Clarification/Handoff v0.2.1 candidate. This boundary does not inherit candidate semantics.
9. **Current Landing copy:** the claims in §15 need a separately authorized copy/experience task if product owners choose to revise them. This KAN-122 artifact does not do so.

## 18. Acceptance checklist

- [x] Every value claim is framed as observable clarity, structure, traceability, or decision preparation, not a guaranteed business result.
- [x] No new Core or Steps capability is implied.
- [x] No second LLM or new business-reasoning source is implied; KAN-114 remains sole source.
- [x] No 114F or Portfolio Setup semantics are authorized.
- [x] Legacy `starteria_path` is excluded as authority and as an 114E input source.
- [x] Each accepted `CAN_DO` candidate maps to governed semantics and has a bounded scope; unsupported candidates are held or moved to `CAN_SUPPORT` / dependency classes.
- [x] Every `CAN_SUPPORT` example exposes an organizational, evidence, or human-decision dependency.
- [x] Every audited public value claim in §15.3 has both a capability classification and an availability classification.
- [x] The representative Landing and public claims covered by §15.3 are dispositioned under both dimensions; copy migration remains outside KAN-122 and requires its own authorized task.
- [x] External evidence remains external; missing evidence remains visible as unknown.
- [x] Organizational inputs, decision rights, and commitments remain owned by the organization.
- [x] Public copy is not allowed to imply unavailable Early Access.
- [x] Demo availability is not inferred from a configured URL.
- [x] Tangible outcomes are inspectable artifacts/states, not business KPIs or promised results.
- [x] The value delta model maps to KAN-123 `value_bridge` without prescribing strategy or execution.
- [x] CTA copy may be contextual only when the destination and next interaction are verified; conversion intent is not product continuation.
- [x] The audit records representative current claims without rewriting Landing copy.
- [x] KAN-126 records scoped acceptance for 114E capability/claim semantics; the acceptance does not establish capability availability or global marketing authority.

## 19. Revision rule

Changes that expand Starteria's product authority, create a new reasoning source, alter human decision rights, claim external outcomes, define commercial availability, or cross into Core/Steps/114F require explicit product authority and the applicable ADR/contract work. A future implementation must bind each user-visible claim to this accepted boundary, its source evidence, and the runtime surface that actually performs it.
