# P8 — Steps 1–4 + Evidence Flow

**Status:** PASS  
**Cut:** 2026-10-20  
**Phase focus completed in this round:** governed Step 0 → Step 1 boundary and baseline verification of existing Step 1–4 persistence.

## Authority

**AUTHORITY**

- **Path:** `docs/e2e/STEPS_COPILOT_REASONING_AND_CARD_CONTRACT_v0.1.md`, §4.
- **Exact quote:** “Step 1 … establish defensible truth/focus”; “Step 2 … prepare execution-ready work and measurement”; “Step 3 … execute/observe and distinguish observation from interpretation”; “Step 4 … consolidate learning and prepare Decision Package”.
- **Interpretation:** the P8 change carries governed context forward without changing the existing Step functions.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_E2E_REASONING_ENGINE_CONTRACT_v0.1.md`, §99.
- **Exact quote:** “Material changes preserve the prior version, record source/reason, assess downstream impact”.
- **Interpretation:** directed review is selective and must not reset all Steps.

## Governed Step 0 → Step 1 handoff

The human-confirmed `Step0AlignmentBrief` remains the canonical input to Step 1. P8 adds `step0SemanticHandoff` only as a bounded reference envelope in Step 1 `sourceContextJson`:

- `cardVersion` and persistence output version;
- material field values;
- claim IDs and SourceRef IDs;
- inherited constraints;
- unresolved gaps;
- contradiction field/status/source references;
- `requiresReview`.

It does not copy the transcript, does not replace the confirmed Brief, does not activate Step 1 automatically, and does not approve the semantic Card.

**CODE:** `backend/modules/adaptive-core/adaptive-core.service.ts`, `confirmStep0Brief`; `backend/modules/adaptive-core/step0-semantic-card.ts`.

## Defect corrected

`confirmStep0Brief` previously queried an untyped latest Step 0 draft. After P7 introduced `Step0SemanticCard`, that query could select the Card instead of `Step0AlignmentBrief`. It now filters `outputKey: 'Step0AlignmentBrief'`. The focused service test proves the confirmed object remains the Brief and the Card remains a contextual handoff.

## Executed evidence

| Verification | Result |
|---|---|
| P8 governed handoff + adaptive regression: `adaptive-core.service.test.ts`, `cycle-projection.test.ts`, `step0-semantic-card.test.ts` | 103/103 PASS |
| P7 semantic regression/persistence | 12/12 PASS |
| P7 pages and component regression | 40/40 PASS |
| PostgreSQL Step 0–4 persistence, provenance, transitions, idempotency and negative evidence paths | 4/4 PASS |
| PostgreSQL critical-change directed-review transitions | 8/8 PASS |

The initial PostgreSQL command lacked `DATABASE_URL`; it was rerun against the isolated P7 test database with the variable supplied and then passed. This is an execution-environment correction, not a product failure.

## Completed P8 scope

## Shared semantic implementation

`backend/modules/adaptive-core/step-semantic-engine.ts` is the single deterministic semantic engine for Steps 1–4. It supplies typed deltas, context projection, provenance, unvalidated SourceRefs, history/versioning, contradictions, `requiresReview`, idempotency, criteria-based sufficiency and bounded handoffs. Each specialization supplies only its critical fields and successor:

| Step | Critical information | Bounded successor | Authority boundary |
|---|---|---|---|
| 1 | focus, fact, hypothesis, evidence | Step 2 | fact, hypothesis and evidence stay distinct |
| 2 | selected work, measurement plan, capacity boundary | Step 3 | prepared work is not an observed result |
| 3 | execution, observation, interpretation | Step 4 | observation and interpretation have distinct types |
| 4 | learning, recommendation, decision request | Decision | recommendation does not create an organizational Decision |

The Cards are stored as `Step{n}SemanticCard` draft outputs alongside, never in place of, established human-confirmed output/checkpoint. `semanticHandoffEnvelope` transfers only card/output versions, values, SourceRef IDs, gaps, contradictions and review state into the next canonical configuration after a human confirms that canonical output. It does not transfer transcripts or create/confirm a checkpoint.

**CODE:** `backend/modules/adaptive-core/step-semantic-engine.ts`; `adaptive-core.service.ts` (`getSemanticStepState`, `processSemanticStepInput`, `semanticHandoffEnvelope`); schemas/controller/routes under the same module.

## Directed review and adverse input

Step 3 contradiction preserves earlier Card history and the new version. It marks only dependent Step 1/2 canonical outputs `requiresReview`; it neither deletes outputs nor creates a cycle. Unknown remains unknown and cannot satisfy a critical field. A new SourceRef is `unvalidated`, rather than validated evidence. Replayed idempotency keys return the durable receipt and create no extra output version.

## Runtime focal flow

**RUNTIME**

- **Environment:** official repository E2E runner, isolated local PostgreSQL database, ephemeral backend/frontend.
- **Command:** `E2E_SKIP_DOCKER=true npm run test:e2e -- e2e/p8-steps-semantic-runtime.spec.ts`.
- **Exit code:** 0. **Duration:** 20.828 seconds. **Artifact:** `artifacts/e2e-goal/P8/runtime-e2e-result.json` and `runtime-e2e.log`.
- **Observed:** one Initiative identity traversed Step 0 then semantic Cards 1→4; unknown remained non-sufficient; SourceRef provenance stayed unvalidated; Step 3 contradiction preserved history and directed review to Steps 1/2; Step 4 emitted a Decision handoff without a Decision row; retry added no version; one cycle remained.

## Final verification

| Verification | Result |
|---|---|
| P8 unit + PostgreSQL persistence | 8/8 PASS: `P8_SEMANTIC_E2E=1 ... step-semantic-engine.test.ts step-semantic.persistence.e2e.test.ts` |
| Adaptive core persistence and selective review regression | 12/12 PASS: `R2_PERSISTENCE_E2E=1 ... r2-persistence.e2e.test.ts critical-change-transition.e2e.test.ts` |
| P7 backend semantic/persistence/hand-off regression | 107/107 PASS |
| P7 pages/component regression | 40/40 PASS |
| configured full typecheck | PASS, exit 0, 66.214 s: `artifacts/e2e-goal/P8/typecheck-result.json` |
| repository lint | PASS: `npm run lint` |
| production frontend build | PASS: `npm run build` |
| isolated runtime Step 0→4 API E2E | PASS, exit 0, 20.828 s |

The isolated runner emitted existing caught Prisma legacy-backfill diagnostics while initializing a newly-created cycle. The command completed with exit 0 and all assertions passed; no P8 semantic operation depends on or changes that legacy backfill path.

## P8 Acceptance Criteria

All P8 acceptance criteria are PASS. Runtime, DB and focused test evidence above demonstrates shared-engine reuse, governed handoffs, Step-specific semantics, context recovery, provenance/SourceRefs, unknown, contradiction history, selective review, human authority, idempotency and P7 regression. No Core v0.3-only rule, domain/cardinality change, human-authority expansion or ADR blocker was introduced.
