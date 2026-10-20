# P7 — Step 0 Golden Slice Evidence

**Status:** PASS  
**Cut:** 2026-10-20  
**Checkout:** `C:/Users/User/proyect-starteria/starteria-KAN-153-recovery-ux`  
**Branch / HEAD:** `feat/KAN-153-recovery-ux` / `1e689ea5c54f7513e323e30f58e45e7168738c7c`

## 1. Scope and authority

**AUTHORITY**

- **Path:** `docs/e2e/STEPS_COPILOT_REASONING_AND_CARD_CONTRACT_v0.1.md`, §3.1.
- **Exact quote:** “Recover relevant confirmed/current context before requesting or writing a field.”
- **Interpretation:** Step 0 reads its inherited mandate, context and SourceRefs before proposing a semantic Card delta.

**AUTHORITY**

- **Path:** same, §3.1.
- **Exact quote:** “Interpret semantic meaning before proposing a delta; message order never decides field assignment.”
- **Interpretation:** the input command uses typed semantic classification and a proposed operation; it does not map transcript order to form fields.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_E2E_REASONING_ENGINE_CONTRACT_v0.1.md`, §7.1.
- **Exact quote:** “`no_change` is a valid result.”
- **Interpretation:** irrelevant input and repeated known information may preserve the Card without manufacturing completion.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_E2E_REASONING_ENGINE_CONTRACT_v0.1.md`, §8.
- **Exact quote:** “The engine may assess and explain sufficiency but cannot approve a Step”.
- **Interpretation:** readiness creates a human-only checkpoint; it does not activate Step 1 or approve Step 0.

**AUTHORITY**

- **Path:** `docs/e2e/STEPS_COPILOT_REASONING_AND_CARD_CONTRACT_v0.1.md`, §4.
- **Exact quote:** “frame the cycle against context, constraints and intended decision”.
- **Interpretation:** P7 implements only the Step 0 Card boundary. Steps 1–4 are not implemented or redefined in this phase.

## 2. Implementation classification and evidence

| Classification | Implementation evidence | Result |
|---|---|---|
| KEEP | `AdaptiveStepOutput` versioning, `requiresReview`, `AdaptiveAdaptationEvent` idempotency receipt and `SourceRef` are reused. | PASS |
| ADAPT | `backend/modules/adaptive-core/adaptive-core.service.ts` reads context/configuration and persists `Step0SemanticCard` output versions. `Step0Page.tsx` embeds the new Step 0-only surface. | PASS |
| NEW | `step0-semantic-card.ts` supplies typed semantic delta, contradictions, unknowns, sufficiency and a structured Step 1 handoff; `Step0SemanticCopilot.tsx` renders it. | PASS |
| NOT CHANGED | Step 1–4 product components and their stable functions. | PASS |

**CODE**

- **Path:** `backend/modules/adaptive-core/step0-semantic-card.ts`.
- **Observed behavior:** typed input yields `add`, `no_change`, `mark_unknown`, `mark_contradiction` or source-linked deltas. The Card retains fields, claims, sources, unknowns, contradictions, versions, hard/soft gaps, sufficiency, review state and structured handoff.

**CODE**

- **Path:** `backend/modules/adaptive-core/adaptive-core.service.ts`, `getStep0SemanticState` and `processStep0SemanticInput`.
- **Observed behavior:** a read before adaptive configuration exists falls back to the project master-context snapshot without mutating it; writes use the operational cycle, project-owned SourceRefs and durable idempotency receipts.

## 3. Semantic and Card findings

| Case | Verification evidence | Result |
|---|---|---|
| inherited Route A context | HTTP E2E reads `handoffMandate.constraints` before the first Step 0 mutation. | PASS |
| unknown / “No sé” | semantic unit and HTTP E2E retain an unmet `unknown`; no field is filled or made sufficient. | PASS |
| irrelevant text | semantic unit and HTTP E2E produce `no_change`; inherited state is preserved. | PASS |
| already known | semantic unit avoids a duplicate canonical claim. | PASS |
| contradiction | semantic unit, persistence test and HTTP E2E retain both values, append a contradiction and set `requiresReview`. | PASS |
| new source | persistence and HTTP E2E retain a SourceRef with `validationStatus: unvalidated`; a source is not asserted as validated evidence. | PASS |
| AI unavailable | `step0-semantic-card.test.ts` invokes the unavailable branch and asserts unchanged prior state plus recovery intervention. The slice uses a deterministic semantic capability; no external model is declared as runtime evidence. | PASS |
| retry | persistence and HTTP E2E replay one idempotency key without a new `AdaptiveStepOutput` version. | PASS |

## 4. Sufficiency, checkpoint and handoff

The Card evaluates explicit critical fields (`objective`, `scope`, `owner`, `priorityHypothesis`, `decisionCriteria`), hard gaps and visible soft gaps. It does not use turn count or visual-field completion. Once sufficient it exposes `ready_for_human_confirmation`, still requires human confirmation and emits a Step 1 handoff with only fields, claims, source references, unknowns, contradictions and Card version.

**CODE:** `backend/modules/adaptive-core/step0-semantic-card.ts`, `finalize` and `buildHandoff`.

## 5. Route A/B/C and persistence

| Route | Runtime / DB observation | Result |
|---|---|---|
| A | inherited `handoffMandate` survives first read; Card becomes sufficient only after the required typed inputs; human confirmation remains required. | PASS |
| B | recovered history and project-owned inherited SourceRef are reused; project count remains one. | PASS |
| C | no Challenge/Front is fabricated; `challengeSnapshot` is null and no portfolio metadata is created. | PASS |

## 6. Verification record

| Type | Command | Result / artifact |
|---|---|---|
| semantic unit | `npx vitest run --config vitest.backend.config.ts ../backend/modules/adaptive-core/__tests__/step0-semantic-card.test.ts` | 8/8 PASS |
| persistence integration | `npx cross-env P7_SEMANTIC_E2E=1 vitest run --config vitest.backend.config.ts ../backend/modules/adaptive-core/__tests__/step0-semantic.persistence.e2e.test.ts` | 4/4 PASS against isolated `starteria_e2e` |
| UI focused | `npx vitest run --config vitest.front.config.ts src/features/adaptive-core/components/__tests__/Step0SemanticCopilot.test.tsx src/features/adaptive-core/components/__tests__/AdaptiveCheckpointWorkspace.test.tsx` | 11/11 PASS |
| regression focused | `npx vitest run --config vitest.backend.config.ts ../backend/modules/adaptive-core/__tests__/adaptive-core.service.test.ts ../backend/modules/adaptive-core/__tests__/cycle-initialization.test.ts ../backend/modules/adaptive-core/__tests__/cycle-state-loading.test.ts ../backend/modules/adaptive-core/__tests__/step0-semantic-card.test.ts` | 106/106 PASS |
| runtime HTTP E2E | `E2E_SKIP_DOCKER=true npm run test:e2e -- e2e/p7-step0-semantic-runtime.spec.ts` | 2/2 PASS; `artifacts/e2e-goal/P7/runtime-e2e-result.json`, exit 0, 26.646 s |
| lint | `npm run lint` | exit 0, `Baseline lint passed.` |
| build | `npm run build` | exit 0, Vite production build complete |
| complete typecheck | `npm run typecheck` | exit 0, 62.616 s; `artifacts/e2e-goal/P7/typecheck-final-result.json` |
| diff integrity | `git diff --check` | exit 0 |

The runtime runner provisions and seeds its isolated PostgreSQL database at `localhost:55433/starteria_e2e`; it is not a deployed-runtime claim. Its backend log contains pre-existing, caught nullable-cycle backfill diagnostics from `cycle.service.ts`; both P7 tests completed successfully and P7 does not modify that service.

## 7. Acceptance criteria

| P7 criterion | Evidence | Result |
|---|---|---|
| inherited context and no needless repetition | semantic state read, Route A/B runtime tests | PASS |
| semantic interpretation, structured/versioned Card and provenance | engine unit tests, persistence output/source assertions | PASS |
| unknown, irrelevant, contradiction and new source behavior | adverse unit, integration and HTTP tests | PASS |
| review, sufficiency, gaps and human checkpoint | semantic unit and Route A HTTP assertions | PASS |
| structured Step 0 → Step 1 handoff | semantic unit and Card handoff type | PASS |
| retry and AI-failure preservation | idempotency integration/HTTP assertions; unavailable-engine unit | PASS |
| Routes A/B/C | DB integration and HTTP E2E | PASS |
| tests, integration, typecheck, lint, build and runtime | §6 command record | PASS |
| traceability and stable Step scope | updated matrix; Step 1–4 unchanged | PASS |

## 8. Phase status

All P7 acceptance criteria are PASS. No Core conflict, frozen-experience conflict or ADR trigger was introduced. P8 is authorized by the phase gate.
