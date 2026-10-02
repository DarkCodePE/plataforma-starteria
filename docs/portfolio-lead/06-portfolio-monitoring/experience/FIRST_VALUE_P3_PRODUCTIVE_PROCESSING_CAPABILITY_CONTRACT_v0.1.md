# First Value P3 — Productive Processing Capability Contract v0.1

**Status:** `CAPABILITY_CONTRACT_APPROVED`
**Initial proposal status:** `NEEDS_PRODUCT_DECISION` — retained as historical trace of the initial proposal.
**Decision record:** Jira KAN-85 — `Product Decision — APPROVED` (recorded after the initial proposal).
**Next authorized technical slice:** KAN-86 — First Value P3 — Runtime Processor Implementation.
**Product behavior authority:** Jira KAN-63 and its designated A.3.2 `DELTA IMPLEMENTATION SPEC`.
**Global authority:** [`docs/STARTERIA_AUTHORITY.md`](../../../STARTERIA_AUTHORITY.md), subordinate to Core v0.2 and approved product ADRs.
**Implementation evidence:** KAN-83 blocker report at commit `3f69d9a` on `feat/KAN-83-first-value-runtime-hardening`; evidence only, not product authority.

## 1. Decision and scope

The initial proposal requested approval of a First Value-specific P3 analysis capability and a separate technical implementation slice. Jira KAN-85 subsequently recorded the human product decision `APPROVED`, with the binding limits in this contract. Runtime implementation is authorized only through the separate technical slice KAN-86 and only within this contract's scope. Approval of KAN-85 does not mean runtime already exists, authorize database changes, or change KAN-63.

The initial proposal status was `NEEDS_PRODUCT_DECISION`. The subsequent human product decision is `CAPABILITY_CONTRACT_APPROVED`, recorded in Jira KAN-85 after the proposal. KAN-86 is the only authorized runtime implementation slice and remains bounded by this contract. Approval does not mean runtime already exists. KAN-83 remains blocked until KAN-86 is implemented, reviewed, and integrated into the governed baseline; only then may KAN-83 resume its own scope.

## 2. Authority and scope

The normative chain for this behavior is:

```text
Core v0.2 (factual baseline; status remains “Base fundacional revisada / Por validar”)
  → Jira KAN-63 (AC1–AC16)
    → A.3.2 Checkpoint-based Review & Inline Clarification
      → this P3 processing capability proposal
```

KAN-63/A.3.2 authorizes the P3 relationship-reading behavior and its human checkpoints. KAN-85 asks for a productive processing contract. Neither authorizes changes to Core, Steps 0–4, Portfolio Entry, canonical portfolio structure, or KAN-63 acceptance criteria. KAN-63 explicitly excludes a new backend from its own implementation slice; this contract therefore proposes a separate technical slice rather than folding infrastructure into KAN-63 or silently expanding KAN-83.

## 3. Purpose and invocation gate

P3 interprets how the Portfolio Lead's **P1-confirmed goal and context** relate to **P2 existing work that the user has confirmed or corrected**. It returns a provisional, explainable reading, highlights only material exceptions, and asks targeted clarification when an answer could change that reading.

The capability MUST NOT run until P2 has an explicit user confirmation. Any edit to P1, P2 work, or a material clarification invalidates the prior P3 result for the affected session; the client requests a fresh result using the updated confirmed state. P1/P2/P3 data remains associated with the same First Value session throughout.

## 4. Proposed contract types

The shapes below are logical contract types, not approved Node/Python schemas. Names and enum values are illustrative until accepted; no shared cross-front type is implied.

### `FirstValueP3Input`

Required:

- `sessionId`: opaque identifier scoped to the active First Value session; not an authorization credential.
- `p2Confirmed`: literal `true`; requests without it are rejected without analysis.
- `goal`: P1-confirmed goal text, with its user-confirmed horizon when present.
- `context`: only context the user supplied or confirmed at P1/P2; optional.
- `initiatives`: non-empty list of P2-confirmed items. Each contains a session-scoped stable item ID, user-confirmed name, and only the short description, owner mention, dependency, or correction actually provided by the user.
- `clarifications`: optional user answers from this session, linked to the affected item IDs and question IDs.
- `requestId`: caller-generated idempotency/correlation identifier for tracing and safe retry; contains no user content.

Do not send Portfolio Entry analysis state, an unconfirmed portfolio repository, unrelated organization records, credentials, or inferred owners/dependencies as if user-confirmed. Do not require NovaGrowth fixtures or any named demo dataset.

### `FirstValueP3AnalysisResult`

Required:

- `sessionId`, `requestId`, and `analysisId` for response correlation and session-local provenance.
- `relationships`: one item per submitted initiative, linked by item ID, with a business-facing disposition:
  - `DIRECT_CONTRIBUTION` — “Contribuye directamente”;
  - `NEEDS_CONTEXT` — “Necesita más contexto”;
  - `POSSIBLE_OTHER_PRIORITY` — “Podría responder mejor a otra prioridad”.
- Each relationship includes a concise rationale grounded in supplied goal/work/context, the evidence references it used, and whether a grouped clarification could materially change the reading.
- `clarifications`: zero or more concrete questions, each linked to every affected item ID, stating what distinction is unclear and what answer could change. One question may resolve uncertainty across multiple items. Do not ask for item-by-item confirmation of clear relationships.
- `summary`: counts and concise exception-first narrative. It must not imply certainty beyond the evidence or expose a technical alignment/confidence score.
- `provenance`: per material statement, distinguish user-declared/confirmed input from AI inference and user clarification/correction. Include processor/model identifier and contract version where available; do not claim an unobserved source.
- `resultState`: `PROVISIONAL` until the user confirms the overall reading in the First Value UI.

The result does not contain canonical Challenge, Initiative, Step, ownership, reassignment, or alignment-score commands. A missing/empty relationship is not to be silently filled from fixtures or hidden data.

## 5. Uncertainty, clarification, and human authority

- The processor proposes interpretations; it does not decide business truth.
- Uncertainty is expressed in plain business language, with the specific affected items and missing distinction. Internal model confidence may be used by an approved implementation to decide whether a result is sufficiently grounded, but numeric confidence is not a product output and must not be used as an alignment score.
- Ask a clarification only when plausible answers could materially change one or more relationships. Group affected items where one answer can resolve them. The user may answer or continue without answering; unanswered uncertainty stays visible.
- A clarification response updates only this session's interpretation and provenance. It is not a canonical business record.
- Clear relationships need no individual confirmation. The user reviews exceptions inline and confirms or continues adjusting at the whole-reading level, as KAN-63 requires.
- Global confirmation records the user's choice in session state only. It does not create, publish, submit, assign, reassign, or promote business structure.

## 6. Execution, state, and persistence

**Proposed interaction:** one bounded request/response operation. The caller awaits a result and exposes a loading state; this contract does not require a background job, polling API, or timer-simulated completion. A technical implementation may stream internally only if the externally visible result preserves the same contract and failure guarantees.

**Proposed persistence policy:** the processing service is stateless. It does not persist inputs, analysis results, clarification answers, or confirmation. The First Value session owner retains working state for the active session and supplies the relevant confirmed state on each analysis request. No durable retention, analytics event containing session content, or cross-session reuse is authorized here. Any persistence beyond active session state requires a separate explicit decision and scope.

**Side effects before and after global confirmation:** zero canonical/domain side effects. Processing is read-only with respect to Portfolio/Core data. Confirmation is not a write authorization. This is stricter than the UI's ability to update its own session state and preserves KAN-63's “no automatic structural mutation” boundary.

## 7. Failure, loading, and retry

The caller presents an explicit loading state while awaiting processing. It keeps P1, confirmed P2 work, prior user corrections, and clarifications intact if processing fails or is cancelled.

Return a typed failure that distinguishes at least invalid/unconfirmed input, temporary processor unavailability/timeout, and unusable or incomplete analysis. A failure MUST NOT be rendered as “no exceptions” or as a valid empty analysis. Do not silently fall back to a fixture, local deterministic analysis, Portfolio Entry analysis endpoint, or stale result.

Offer an explicit retry against the same confirmed session state and request identity, or let the user edit/continue without analysis. Retry is safe because the operation is stateless and has no domain side effects. If a previous result exists, label it stale after relevant input changes and do not present it as the current reading.

## 8. Processing engine and service boundary

The current-state evidence in KAN-83 classifies First Value P3 processing as `MISSING` for this product: no First Value service, endpoint, repository, or approved P3 processing contract was found on the governed baseline. Portfolio Entry has its own model-backed interpretation, but its APIs and semantics are not an eligible substitute. Prototype fixtures, `analyzeNovaGrowth()`, timers, and instrumentation are not productive engines.

**Proposed technical boundary:** a First Value-owned application capability accepts `FirstValueP3Input`, invokes a replaceable analysis processor, validates the result, attaches provenance, and returns `FirstValueP3AnalysisResult`. The processor may use a generic model/provider runtime only after the implementation slice verifies that it is reusable without importing Portfolio Entry domain prompts, state, endpoints, or semantics. No particular model/provider is selected or certified by KAN-85 evidence.

**Endpoint decision:** a new First Value backend service/API is required unless a later current-state audit identifies an already authorized application service with this exact boundary. No such service was found in KAN-83's baseline audit. Do not route through Portfolio Entry to avoid creating this boundary.

## 9. Product and technical non-goals

This capability does not:

- implement D2/prefill, connect D1, change Portfolio Entry, or introduce a second First Value experience;
- create or modify Core entities, Steps 0–4, Challenges, Initiatives, owners, assignments, or canonical relationships;
- write to Portfolio repositories, persist First Value session content durably, or emit semantic events;
- submit automatically, reassign automatically, score alignment, or confirm individual initiatives;
- infer that an absent owner/dependency exists, use unconfirmed work, or turn an AI observation into confirmed business truth;
- resolve P4 or later Relationship Review behavior.

## 10. Authority trace and V2_CHANGE_GUARDRAIL_CHECK (documentary)

```text
SLICE: KAN-85 — First Value P3 productive processing capability contract
GOAL: Define the bounded, productive P3 input/output and authority boundary
USER/JOB: Portfolio Lead reviews how confirmed existing work relates to a confirmed goal
AUTHORITY: KAN-85 (contract decision); KAN-63 + A.3.2 (behavior); Authority Map; Core v0.2 factual baseline
MANIFEST: No promoted First Value A.3.2 runtime slice; this document does not change runtime status
CURRENT FLOW: No governed /portfolio/setup route or productive First Value P3 processor on baseline
V2 TARGET: Confirmed P1/P2 → session-only request/response interpretation → inline exception review → global human confirmation
LEGACY: Prototype fixture/local analysis/timers are excluded; Portfolio Entry runtime is a separate domain boundary
SEMANTIC OWNER: V2 for the bounded KAN-63 reading; capability contract approved by Jira KAN-85; runtime implementation only in KAN-86
CORE / STEPS: No change; no canonical writes
PERSISTENCE: Active-session state only; no durable persistence authorized
TESTS: No product code changed; contract validation is documentary. Future technical slice needs contract, negative-side-effect, failure/retry, provenance, and KAN-63 conformance tests.
ADR: Not indicated for this bounded proposal while Core, canonical structure, and Steps remain unchanged; revisit if implementation changes those invariants or adds durable domain effects.
PROCEED: KAN-85 capability contract approved. Runtime implementation authorized only within KAN-86 scope and this contract. KAN-86 runtime implementation: NO (not yet implemented).
```

## 11. Decision register and implementation gate

| Question | Approved capability boundary | Technical status / evidence |
|---|---|---|
| Reuse an existing AI runtime? | Reuse only generic provider/runtime infrastructure if verified; never reuse Portfolio Entry analysis APIs, prompts, or state. | KAN-85 capability approved; verification and implementation are limited to KAN-86. |
| New endpoint or existing service? | First Value-owned application service and backend boundary; prefer an existing exact-authority service only if a new audit proves one exists. | KAN-86 technical slice; no such service found on baseline. |
| Session-only or durable persistence? | Active-session state only; processor stores nothing. | Approved binding limit; durable storage is not authorized. |
| Minimal input? | P1-confirmed goal/context + P2-confirmed user-provided work and corrections + session clarifications. | Defined in §4; exclude unconfirmed/external data. |
| Forbidden before confirmation? | All canonical/domain writes, submissions, structural changes, assignment changes, and promotion; global confirmation remains session-only. | Explicit zero-side-effect boundary in §5–6. |
| Sync or async? | Bounded request/response with visible loading; no background job/polling requirement. | Approved capability contract; KAN-86 implementation must enforce timeout/failure behavior. |
| Is a separate technical slice required? | Yes: implement and verify the First Value service/processor boundary independently of KAN-63 and KAN-83's frontend promotion scope. | KAN-86 is the next authorized technical slice; KAN-83 remains blocked until KAN-86 is implemented, reviewed, and integrated. |

**Acceptance mapping:** AC1 §§1–3; AC2, AC4 §§4, 8; AC3 §§2, 5; AC5–6 §§5–6; AC7 §7; AC8 §§4, 10; AC9–10 §11.

**Reconciliation result:** `KAN85_CAPABILITY_STATUS = CAPABILITY_CONTRACT_APPROVED` (Jira KAN-85; decision recorded after the initial `NEEDS_PRODUCT_DECISION` proposal).

**Implementation gate:** KAN-85 product capability contract is approved. Runtime implementation is authorized only within the separate technical slice KAN-86 and only under this contract; KAN-85 approval does not mean the runtime already exists and does not grant open-ended backend authorization.

**Next authorized technical slice:** KAN-86 — First Value P3 — Runtime Processor Implementation. KAN-86 remains limited by this KAN-85 contract.

```text
KAN85_CAPABILITY_STATUS = CAPABILITY_CONTRACT_APPROVED
KAN86_RUNTIME_AUTHORIZED = YES, ONLY WITHIN KAN-86 SCOPE
KAN86_RUNTIME_IMPLEMENTED = NO
KAN83_CAN_RESUME_NOW = NO
KAN83_CAN_RESUME_AFTER_KAN86_INTEGRATION = YES
```
