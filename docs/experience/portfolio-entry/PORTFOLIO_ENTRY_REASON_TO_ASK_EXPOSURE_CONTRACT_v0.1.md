# Portfolio Entry `reason_to_ask` Exposure Contract v0.1

**Status:** Normative decision contract authorized by accepted product ADR-007; runtime implementation is not authorized by this document alone.
**Authority:** [ADR-007](../../../doc/product-adr/ADR-007-portfolio-entry-reason-to-ask-public-explanation.md), subordinate to Core and read with [ADR-002](../../../doc/product-adr/ADR-002-portfolio-entry-active-question-clarification-convergence.md).
**Scope:** Optional explanation attached to the one active Portfolio Entry clarification question.

## 1. Field meaning

`reason_to_ask` means:

> Concise user-facing explanation of why answering the current active question may materially improve the understanding, decision framing, or next recommended movement.

It does not mean “reason why the model selected this question internally.” Classification is `PUBLIC_EXPLANATION`, not `INTERNAL_RATIONALE` or `MIXED`. If a separate internal rationale concept is required, it must have a separate name and access boundary; it is outside this contract and must not be copied into `reason_to_ask`.

## 2. Normative content and presentation

For each active question:

- `user-facing = YES` and there is at most one explanation.
- Show it subordinate to the question, in short, plain language.
- Explain only why answering this question may matter to understanding, decision framing, or the next movement.
- Do not introduce another question, a new recommendation/decision, new facts, or confirm organizational context.
- Do not expose prompts/instructions, scores, secrets/tokens, provider/model metadata, internal orchestration, or internal reasoning.
- The client does not generate, rewrite, or paraphrase this content. It displays only the governed value it receives.
- Missing, null, or empty content means render no explanation.
- Only the current active question may have an active explanation. No active question means no explanation. Retired/history questions do not retain an active explanation.

The explanation cannot increase the question count, consume another question-budget slot, or alter the active question, its identity, priority, `resolves`, answer semantics, planner selection, or convergence. ADR-002 governs those behaviors.

## 3. Security statement

**PUBLIC_EXPLANATION != PRIVATE_REASONING.** Starteria never uses `reason_to_ask` to expose:

- chain-of-thought or hidden deliberation;
- prompt content or instructions;
- model/provider internals or metadata;
- security/safety rationale;
- internal scoring or question-selection rationale;
- secrets, credentials, or tokens.

If content contains or depends on any excluded material, it fails this contract and must not be exposed. Transport and presentation layers must preserve, not infer or manufacture, the explanation boundary.

## 4. Testable acceptance contract

These cases are normative for a future authorized implementation and are not evidence that runtime behavior currently passes:

| Case | Input/state | Required result |
|---|---|---|
| A — valid reason | A concise, plain-language relevance explanation on the active question | It may be shown once, subordinate to that question. |
| B — absent reason | `null`, missing, or empty/whitespace value | Show no explanation; do not synthesize a fallback. |
| C — internal rationale | Content contains hidden deliberation, prompt text, scores, secret/security rationale, or provider/model internals | Do not expose it; the value fails the contract and must be rejected/quarantined before user display. |
| D — no active question | Current turn has no active question | There is no active reason to render, regardless of history. |
| E — refresh | Refresh/reload of the same active question | The same governed reason remains associated with that question and appears at most once; no duplicate is introduced. |
| F — previous question/history | A question has been answered, retired, or exists only in history | Its reason is not active or displayed as the current reason. |

## 5. Implementation boundary

Once ADR-007 is merged and an implementation task separately authorizes it, the permitted transport path is:

```text
planner -> QuestionRecord -> API -> frontend DTO -> active-question UI
```

This path may carry the existing value without changing planner selection logic. Every hop is subject to Cases A–F and the security boundary. This contract does not authorize changes to backend, DTO, UI, planner runtime, Core, or Steps.

## 6. Reconciliation status

ADR-007 is the accepted authority for this field boundary. The existing v0.2 Clarification/Handoff, Agent, Skill, and Harness artifacts remain candidates under `docs/STARTERIA_AUTHORITY.md`; this contract does not promote them or adopt unrelated candidate clauses. Any references added to them must identify ADR-007 as the source of this narrow rule.
