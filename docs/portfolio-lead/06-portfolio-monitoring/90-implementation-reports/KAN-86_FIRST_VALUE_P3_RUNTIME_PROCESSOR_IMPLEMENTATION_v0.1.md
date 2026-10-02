# KAN-86 — First Value P3 Runtime Processor Implementation v0.1

**Status:** Implemented in the KAN-86 worktree; verification and integration evidence pending where noted below.
**Branch/baseline:** `feat/KAN-86-first-value-p3-runtime` from `origin/main` / `1add35c86f6c9fb991a9fdf3914dfadab90ba796`.
**Authority:** KAN-85 `CAPABILITY_CONTRACT_APPROVED`; KAN-63 and its A.3.2 delta spec.
**Scope:** synchronous, stateless, provisional First Value P3 processing only.

## Authority trace

1. `docs/STARTERIA_AUTHORITY.md`: implementation follows slice authority; Core v0.2 remains factual and unvalidated.
2. `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`: `INV-03` keeps organizational authority with people; no Core or Steps 0–4 change.
3. `STARTERIA_V2_MANIFEST.md`: First Value P3 registered as `FIRST_VALUE_P3_RUNTIME_PROCESSOR`, `IMPLEMENTED_UNVERIFIED`, `NOT_INTEGRATED`.
4. Jira KAN-86: En curso; runtime implementation scope and limits.
5. Jira KAN-85: RESUELTO; contract status `CAPABILITY_CONTRACT_APPROVED`.
6. Jira KAN-63: A.3.2 behavior authority, including global confirmation and no per-initiative confirmation.
7. `STARTERIA_PORTFOLIO_LEAD_A32_CHECKPOINT_INLINE_REVIEW_v0.1.md`: concrete clarification, relationship-language, and exception-first requirements.
8. `FIRST_VALUE_P3_PRODUCTIVE_PROCESSING_CAPABILITY_CONTRACT_v0.1.md`: fixed input/output, sync processing, provenance, failure, and no-persistence boundary.
9. `TESTING.md`: Node and AI verification matrix; dependencies required are not installed in this worktree environment.
10. `AGENTS.md`, V2 Guardrails §20–21, and Implementation Playbook: guardrail emitted before implementation; closure evidence and remaining unverified status recorded.

## Baseline and guardrail

Precondition evidence: worktree is `C:\Users\User\proyect-starteria\starteria-KAN-86`; branch is `feat/KAN-86-first-value-p3-runtime`; initial status was clean; `HEAD`, `origin/main`, and `1add35c` resolved to `1add35c86f6c9fb991a9fdf3914dfadab90ba796`. Jira read confirmed KAN-86 En curso, KAN-85 RESUELTO, and KAN-87 RESUELTO. The contract document states `CAPABILITY_CONTRACT_APPROVED`.

`V2_CHANGE_GUARDRAIL_CHECK`: `PROCEED: YES`. The P3 runtime has a distinct V2 semantic owner under KAN-85/KAN-63; no Core or canonical state changes are in scope. The Manifest lacked a First Value P3 entry, so only a minimal slice/status record was added, with a corresponding current-state pointer.

## KAN86_RUNTIME_CAPABILITY_AUDIT

| Capability | Classification | Evidence and treatment |
|---|---|---|
| `backend/modules/ai/bridge.service.ts` internal transport, request ID, bounded retries, timeout, circuit breaker | `REUSABLE_AS_IS` | Used only to call the dedicated AI P3 endpoint; P3 validates returned semantics itself. |
| `backend/shared/utils/logger.ts`, `pino-http` | `REUSABLE_AS_IS` | Structured metadata only; goal, descriptions, answers, and session ID are omitted. |
| `backend/modules/auth/auth.middleware.ts`, `backend/shared/authz/permissions.ts` | `REUSABLE_AS_IS` | Existing `authenticate` and `requirePermission('portfolio:read')`; the permission is granted to Portfolio Lead and platform admin roles. |
| FastAPI, Pydantic, LangChain `ChatOpenAI.with_structured_output` | `REUSABLE_WITH_THIN_ADAPTER` | Dedicated P3 schema, prompt, model call, and typed failure mapping. No other agent's domain contract is imported. |
| `ai-service/harness/llm.py` | `NOT_APPLICABLE` | Harness-stage routing/model policy and usage semantics are not the P3 productive boundary. |
| Portfolio Entry agents, prompts, analyzers, endpoints, and state | `FORBIDDEN_SEMANTIC_REUSE` | Separate product domain and prohibited by KAN-85/KAN-86. |
| `backend/modules/portfolio-bootstrap/*` including `/sessions/:sessionId/analyze` | `FORBIDDEN_SEMANTIC_REUSE` | This baseline path is bootstrap-specific and persists analysis runs/proposed mutations; it uses a deterministic analyzer option and a different output vocabulary. It is not the approved P3 capability and was not changed or called. |
| Portfolio and Core repositories/entities | `FORBIDDEN_SEMANTIC_REUSE` | Not injected into the P3 service or processor. |

## Chosen boundary and rejected alternatives

Chosen: backend `FirstValueP3Service` validates caller input and provider output; a dedicated authenticated backend endpoint uses the existing AI bridge; an internal FastAPI endpoint invokes a dedicated structured-output P3 processor. This is the smallest boundary that keeps AI-service behind the backend and lets the backend reject invalid model output.

Rejected: routing through Portfolio Entry (wrong semantics); extending Portfolio Bootstrap (durable session, analysis-run, and proposed-mutation semantics); calling AI-service from the frontend (violates the single backend door); reusing the methodology harness stage caller (not the approved P3 runtime boundary); and adding a P3 database repository, migration, entity, or background job (forbidden and unnecessary).

## Input and result implementation

The backend Zod input accepts `sessionId`, `requestId`, boolean `p2Confirmed`, confirmed `goal`, optional `context`, nonempty initiatives with unique stable session-scoped `itemId`, and optional session clarification answers. Additional keys are rejected. Credential-named fields and common bearer/API-key credential patterns are rejected. Clarification item references must belong to submitted work. `p2Confirmed: false` returns `P3_INPUT_NOT_CONFIRMED` before provider invocation.

The result returns `sessionId`, `requestId`, generated `analysisId`, exactly one validated relationship per submitted item, grouped clarifications, an exception-first summary with derived disposition counts, provenance, and the literal `resultState: PROVISIONAL`. Dispositions are limited to `DIRECT_CONTRIBUTION`, `NEEDS_CONTEXT`, and `POSSIBLE_OTHER_PRIORITY`. There is no score, per-item confirmation flag, structural command, owner assignment, or submission action.

Backend validation rejects missing/duplicate/unknown IDs, unsupported dispositions, unbounded/empty rationale, evidence references not present in this request, unidentifiable grouped clarification items, extra command-like fields, and missing processor metadata. It does not repair or fill invalid output. Provenance marks submitted goal/context/work as `USER_DECLARED_CONFIRMED`, clarification answers as `USER_CLARIFICATION`, and every relationship rationale as `AI_INFERENCE`; source refs are limited to input refs. The model cannot mark its own inference as user-confirmed.

## AI processor, prompt, timeout, retry

`ai-service/agents/first_value_p3.py` uses a new prompt and strict Pydantic structured output. It instructs the model to use only supplied confirmed context, not invent owners/dependencies, produce one relationship for every item, separate inference from declared evidence, group material clarifications, leave uncertainty uncertain, and emit no scores or structural actions. It does not import Portfolio Entry prompts or state. The provider call is synchronous within a 25-second model timeout; the backend bridge applies its bounded request timeout and one retry for transient failures. Retry repeats a stateless request with the same request ID; it has no canonical side effects.

Failures map to `P3_INPUT_NOT_CONFIRMED`, `P3_INVALID_INPUT`, `P3_PROCESSOR_UNAVAILABLE`, `P3_PROCESSOR_TIMEOUT`, or `P3_INVALID_ANALYSIS`. There is no empty-success, fixture, deterministic-analysis, stale-result, or stale-session fallback.

## Grouped clarifications and human authority

A clarification must identify every affected submitted item by stable item ID or name and include a reason. A single question may cover multiple initiatives; clear relationships are returned without an individual confirmation requirement. P3 does not implement global confirmation: that later First Value UI boundary is outside KAN-86. All returned relationships remain provisional.

## Auth, observability, persistence, and side effects

The backend route is `POST /api/v1/first-value/p3/analyze`, protected by existing `authenticate` plus `requirePermission('portfolio:read')`. The AI-service route requires the existing `X-Internal-Token` bridge boundary and fails closed with `P3_PROCESSOR_UNAVAILABLE` when `AI_SERVICE_INTERNAL_TOKEN` is not configured. The deployment already maps the existing AI token secret to this variable; local processing requires the same configuration. `sessionId` is not treated as a credential. Request telemetry contains request ID, duration, status, counts, clarification count, and processor ID only; session ID, user text, and clarification answers are not logged.

The processor is stateless. Inputs, results, clarification answers, and global confirmation are not persisted by this capability. There are no canonical repository dependencies, migrations, P3 repositories, or writes.

```text
CANONICAL_WRITES = 0
DURABLE_P3_WRITES = 0
```

## Tests and validation evidence

Written tests cover P2 gating before provider invocation, single invocation for valid input, one relationship per initiative, invented IDs, unsupported dispositions, grouped clarifications, no per-item confirmation, provisional state, timeout/unavailable typed failures, invalid/incomplete output, no fallback, separation from Portfolio Entry, no canonical repository dependency, telemetry redaction, and backend auth/permission behavior.

| Evidence | Result |
|---|---|
| Python syntax compilation (`python -m py_compile` on changed AI Python files) | PASS |
| Focused backend tests | PASS: 23 tests total — service (17), router (3), provider (1), dependency boundary (2). |
| Backend full suite | PASS: 1,154 passed, 55 skipped (`npm run test:backend`; 142 files passed, 14 skipped). |
| Backend typecheck / lint / build | PASS: `typecheck:backend`, baseline `lint`, and `build:backend`. |
| Focused AI P3 tests | PASS: 10 tests, including FastAPI boundary with a fake provider, timeout, unavailable, invalid output, P2 gate, wrong/missing internal-token protection. |
| AI unit suite / coverage | PASS: 456 passed, 16 deselected; total coverage 83.53% (75% required). |
| AI Ruff | PASS: `ruff check .`. |
| Local validation status | `LOCAL_VALIDATION = PASS` (focused/backend suites, backend typecheck/lint/build, AI unit suite/coverage, Ruff, and Python syntax compilation listed above). |
| Real provider E2E status | `REAL_PROVIDER_E2E = NOT VERIFIED` (no live provider request was made; AI endpoint tests used a fake provider). |
| Deployed network status | `DEPLOYED_NETWORK = NOT VERIFIED` (deployment network path and secrets have not been exercised). |
| Runtime AI/provider integration | NOT RUN: no real provider request was made. Local FastAPI integration used a fake provider; it is not E2E. |
| Frontend tests | NOT APPLICABLE: frontend was not modified. |
| `git diff --check` | PASS for tracked worktree changes; new files reviewed by formatter/linter and focused tests. |

## Remaining risks and KAN-83 assessment

The configured OpenRouter model and deployment secrets have not been exercised against a live provider. End-to-end behavior is not verified. The backend bridge's shared transient retry is safe under the processor's no-side-effect guarantee, but provider latency/cost still requires runtime integration evidence. The endpoint uses the existing platform `portfolio:read` permission, which is role-derived and not session-owner scoped; the P3 operation consumes only caller-supplied data and reads no session record.

KAN-83 must not resume from this unintegrated worktree. It can rerun its own guardrail only after KAN-86 is reviewed and integrated into the governed baseline. Implementation is `READY_FOR_INTEGRATION`; provider credentials/model availability and production network behavior remain unverified, and this report does not claim provider E2E.
