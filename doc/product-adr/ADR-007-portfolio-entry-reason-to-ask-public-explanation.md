# ADR-007: Portfolio Entry `reason_to_ask` public explanation boundary

> ACCEPTED: explicit product decision for the Portfolio Entry clarification surface. This ADR does not authorize runtime implementation by itself.

Estado: Aceptado
Fecha: 2026-10-04
Relaciona: ADR-002; `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md`; `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`; `docs/agents/portfolio-entry/PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`; `docs/agents/portfolio-entry/skills/entry-04-question-planner/SKILL_v0.2.md`

## 1. Context

The question planner already emits `reason_to_ask`, but KAN-104 found that it is dropped before the persisted/runtime `QuestionRecord`; the API and UI do not receive it. Existing authority governs one active user-facing question and its convergence, but does not say whether this field is safe to expose or define its content boundary. See the KAN-104 finding recorded on Jira and the repository's KAN-102 DTO-gap note.

## 2. Decision

For the one active Portfolio Entry clarification question, `reason_to_ask` means:

> Concise user-facing explanation of why answering the current active question may materially improve the understanding, decision framing, or next recommended movement.

Classification: **PUBLIC_EXPLANATION**. It explains relevance to the user. It does not mean why a model internally selected the question. There is no `MIXED` interpretation of this field. Any internal rationale, if separately required by an independently authorized system, is a distinct private concept and must never be mapped to this field or exposed through this contract.

This decision is limited to explanation metadata attached to the active question. It does not change question selection, priority, `resolves`, answer semantics, question budget, active-question cardinality, clarification convergence, handoff, Core or Steps. ADR-002 remains authoritative for active-question identity/cardinality and convergence.

## 3. Normative exposure rules

The complete normative content and acceptance contract is `PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md`. In brief, an explanation is user-facing, at most one per active question, short/plain, visually subordinate, and only about why that question matters. It may not introduce a question, recommendation, new fact, organizational confirmation, prompt, score, secret, provider/model metadata, or internal reasoning. The client must not create, rewrite, or paraphrase it. Missing, null, or empty content renders nothing. A retired/history question has no active explanation.

## 4. Security boundary

**PUBLIC_EXPLANATION != PRIVATE_REASONING.** Starteria must never use `reason_to_ask` to expose chain-of-thought, hidden deliberation, prompt content/instructions, model/provider internals, security rationale, or scoring. Content that contains or depends on such material fails the field contract and must not be exposed.

## 5. ADR-002 relationship

This is a new accepted product ADR, not a silent edit to accepted ADR-002. ADR-002 continues to govern one active question, identity, answer resolution, history and convergence. This ADR adds only the previously undecided semantic/security boundary for optional explanation attached to that active question.

## 6. Implementation boundary and consequences

After this decision is merged, a separately authorized implementation slice may transport the already-produced explanation through:

```text
planner -> QuestionRecord -> API -> frontend DTO -> active-question UI
```

without changing planner selection logic. Each transport boundary must preserve this ADR's content boundary and acceptance cases. This ADR itself makes no backend, DTO, UI, prompt-runtime, Core, or Steps change and is not runtime implementation authorization.

The v0.2 Agent/Skill/Harness reconciliation stack retains its existing candidate status. Referencing this accepted decision does not promote those documents or validate their unrelated content.
