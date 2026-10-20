# Starteria E2E — Steps Copilot Reasoning and Card Contract

**Version:** v0.1  
**Status:** FROZEN_FOR_P4_AND_P5_PLANNING  
**Phase:** P3  
**Scope:** the Steps 0–4 conversation, live Card, evidence/context and checkpoint pattern.  
**Non-scope:** a new Step, automatic Step approval, model/prompt/API/schema selection, organizational decisions or runtime certification.

## 1. Authority

| Source | Exact quote | Effect |
|---|---|---|
| Core v0.2, INV-04 | “La conversación puede utilizarse para” | Conversation is working interaction, not the record. |
| Core v0.2, INV-06 | “Las cinco funciones de los Steps permanecen estables.” | The Card adapts to each function; it does not redefine it. |
| Core v0.2, INV-09 | “cero hard gates abiertos” | Visible completion never replaces hard gates. |
| Core v0.2, INV-10 | “los outputs dependientes se marcan como `requires_review` cuando corresponda.” | Material updates preserve history and expose review. |
| P2 frozen contract, R25 | “UX transversal congelada: conversación + Card viva + herramientas contextuales” | Preserve the Steps shell within higher authority. |
| P3 Reasoning Engine Contract §§4–9 | Shared typed delta, review and provenance behavior | This contract applies that behavior to each Step. |

## 2. Experience pattern

Each Step presents four coordinated surfaces:

```text
conversation workspace
+ live Card of structured result
+ relevant evidence/context
+ checkpoint / next permitted action
```

Conversation may explain, ask and propose. The Card is the versioned representation of the current structured result. Evidence/context shows why a Card item exists. The checkpoint exposes sufficiency, hard/soft gaps, review needs and the next actor. None of the four surfaces alone means a Step is approved.

## 3. Card state contract

Each Card element conceptually carries `field/result`, typed value, knowledge classification, status (`proposed`, `confirmed`, `unknown`, `contradicted`, `requires_review`, `superseded`), source/evidence references, origin, currentness/version, and reviewer disposition when required. The exact schema belongs to P5.

### 3.1 Card update rules

1. Recover relevant confirmed/current context before requesting or writing a field.
2. Interpret semantic meaning before proposing a delta; message order never decides field assignment.
3. Render `unknown` as unknown. An irrelevant answer cannot satisfy a required field.
4. Preserve competing claims and show a contradiction; a new source does not erase an older one.
5. An AI-proposed value is visibly proposed until a required confirmation occurs.
6. Each material change creates a new version/reference and evaluates only affected downstream work for `requires_review`.
7. Failure/retry cannot duplicate a confirmed Card version or silently convert a proposal into confirmation.

## 4. Step functions and Card boundaries

| Step | Stable Core function | Card must make visible | Card must not do |
|---|---|---|---|
| 0 | frame the cycle against context, constraints and intended decision | inherited mandate/context, expected result, constraints, known evidence, open unknowns and initial gaps | validate expected impact, erase inherited conflict or complete from turn count |
| 1 | establish defensible truth/focus | facts, assumptions, hypotheses, source-backed claims, contradictions, focus and critical unknowns | overwrite Step 0 or present hypothesis as fact |
| 2 | prepare execution-ready work and measurement | selected work, execution/measurement plan, capacity boundaries, dependencies and evidence needs | claim execution happened or solve external dependencies silently |
| 3 | execute/observe and distinguish observation from interpretation | protocol/action, observations, evidence/source, deviations and interpretation separately | treat a negative result as no evidence or claim success without support |
| 4 | consolidate learning and prepare Decision Package | learning, limits, recommendation, decision request, expected/observed/attributed maturity and evidence gaps | make the organizational decision or assert attribution without method/validator |

## 5. Checkpoint behavior

| Condition | Card/checkpoint behavior |
|---|---|
| hard gate open | show blocking condition and permitted intervention; no progression indication |
| soft gap | show gap, impact and owner; may allow continuation only under the applicable Core gate |
| material new evidence/constraint | show changed item, preserved prior version, source/reason and affected output review status |
| contradiction | show both positions/source links, unresolved status and required analysis/validator |
| human confirmation required | distinguish AI proposal from pending human disposition; record the disposition separately |
| sufficient | state the criteria/evidence that support readiness, remaining soft gaps and the next checkpoint; never derive it from number of turns |

## 6. Negative and recovery contract

| Case | Required UI/semantic result |
|---|---|
| “No sé” | preserve an explicit unknown and offer a relevant question, investigation or blocker route |
| irrelevant answer | show no false completion; retain Card state and redirect only when relevant |
| repeated known information | avoid asking again and do not create a duplicate claim; show/attach confirmation/source only when material |
| contradictory source | preserve previous claim, show conflict and request analysis/review rather than overwrite |
| insufficient input | explain unmet criterion/gap and select next intervention without false progress |
| AI unavailable | preserve user input, no invented Card delta, clear recoverable failure/pending state and deterministic next action where available |
| retry | same logical action is safe to repeat; UI must not show duplicate state as confirmation |

## 7. Existing UI/runtime audit

**CODE evidence:** `front/src/features/adaptive-core/components/CopilotIntentModes.tsx` contains a Copilot intent surface; `backend/modules/copilot/application/copilot-orchestration.service.ts` persists conversation messages; `backend/modules/adaptive-core/adaptive-core.service.ts` implements checkpoint/sufficiency logic; `front/prisma/schema.prisma` has versioned `AdaptiveStepOutput` with `requiresReview`. These are candidates to reuse/adapt, not evidence that the P3 Card contract is implemented.

**AS-IS evidence:** P1 T11–T13 and T25 remain BLOCKED. This contract makes no runtime-PASS claim.

## 8. P5 and implementation handoff

P5 must map Card fields to existing or new read/write contracts, decide source-of-truth ownership, establish authorization, idempotency and audit events, and identify how current Copilot/Truth/Adaptive Core components are adapted. P7 must first implement and test this whole pattern in Step 0, including every §6 case, before applying it to Steps 1–4.

## 9. P3 acceptance evidence

| Requirement | Evidence | Result |
|---|---|---|
| Copilot/Card boundary | §§2–3 | PASS |
| stable Step functions | §4 | PASS |
| semantic delta and provenance | §§3–3.1 | PASS |
| sufficiency/gates/checkpoint | §5 | PASS |
| unknown/irrelevant/contradiction/retry/AI failure | §6 | PASS |
| existing capability audit and no runtime claim | §7 | PASS |
| P5/P7 handoff | §8 | PASS |

## 10. Freeze statement

This P3 contract freezes the Copilot/Card experience semantics within the approved P2 E2E experience. It does not approve a schema, command, technical cycle/Step selection, Card implementation or any expansion of human/AI authority.
