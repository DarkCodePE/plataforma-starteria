# KAN-88 — Final Strategic Intent Projection Mapping Decision v0.1

**Status:** `MAPPING_CONTRACT_APPROVED`

**Product decision:** `APPROVED` — Jira KAN-88 comment 10146, 2026-10-02

**D2 runtime readiness:** `WAITING_FOR_KAN89`

**Baseline audited:** `origin/main @ a2d9045f33f8a889128d1feb1a9a58cdb7f44c21`

**Scope:** reconcile documentary contract only; no runtime changes and no commit.

## 1. Decision and authority

Jira KAN-88's later human Product Decision supersedes the earlier documentary `NEEDS_PRODUCT_DECISION` result. Portfolio Entry's confirmed strategic reading continues as a structured `StrategicIntentProjection`, not as `rawEntry` and not as an opaque copy/paste string. Portfolio Lead retains responsibility for organizational execution context through its existing First Value stages.

Authority inspected: `docs/STARTERIA_AUTHORITY.md`; Core v0.2 (`Base fundacional revisada / Por validar`); `STARTERIA_V2_MANIFEST.md`; KAN-88/KAN-74/KAN-79/KAN-80/KAN-78/KAN-83 Jira; KAN-88 approved decision comment; KAN-79 implementation report and commit `8713064`; KAN-83 report v0.2; First Value A.3.2/P3 contracts; D1 schema/service/DTO/error/router/tests; current First Value page; governance guardrails/playbook, `TESTING.md`, and `AGENTS.md`.

## 2. Approved projection

```text
Confirmed Portfolio Entry
→ StrategicIntentProjection
  goal                 ← desired_outcome
  situation            ← understanding
  decisionToEnable     ← decision_to_enable
  knownContext         ← known_context
  openQuestions[]      ← unresolved_context + evidence_or_clarity_needed
  approachHypothesis   ← recommended_approach only if accepted/corrected
  provenance           ← exact D1 source/session/revision/handoff/confirmation identity
```

Each semantic field stays distinct even if the remaining fields are serialized deterministically to the existing context control. `goal` hydrates the existing goal control. The existing `/portfolio/setup` experience and normal P1 checkpoint remain; no intermediate screen is created.

## 3. Confirmation precedence

For each field/item independently:

1. Contradictory or impossible terminal states, including accepted + rejected or corrected + rejected, produce `INVALID_CONFIRMATION_FOR_D2`; do not choose or partially hydrate silently.
2. Else, if `correctedFields[field]` exists, use the corrected user value.
3. Else, if `acceptedFields` contains the field, use its handoff value.
4. Otherwise omit it. Handoff presence alone is not confirmation.
5. Rejected and unconfirmed values never enter visible hydration.

`recommended_approach` enters `approachHypothesis` only after explicit acceptance or correction; it is presented as a hypothesis/approach worth exploring, never as a decided plan. `alternative_approaches`, `starteria_path`, `recommended_cta`, technical provenance, and `rawEntry` are excluded from visible hydration.

## 4. Raw Entry and content rules

`RAW_ENTRY_EQUIVALENT_TO_FINAL_BRIEF = NOT_PROVEN`. Keep `rawEntry` as source/history only where existing authorized storage supports it. It is not the final Brief and never a hydration fallback.

Mapping is deterministic and performs no AI generation, summary, paraphrase, or inferred reconciliation. Omit empty optional values; preserve source order in open questions, append `evidence_or_clarity_needed` after `unresolved_context`, normalize only outer whitespace/line endings, and remove exact duplicate normalized questions while keeping first occurrence. If `goal` lacks an eligible value, do not hydrate; show a recoverable empty/error state. Contradictory confirmation fails closed.

## 5. First Value hydration and provenance

```text
valid D1 response
→ derive projection
→ hydrate once
→ user sees Strategic Intent and may edit/delete
→ explicit submit
→ normal P1 checkpoint
→ existing P2
→ existing P3
```

Hydrate `goal` into the current goal control. Serialize other eligible fields in fixed semantic/label order into the existing context control while preserving their separate projection fields in consumer state. The user can edit/delete. Refetch is a no-op; a different identity/revision never silently overwrites. Local edits win for the page session. No auto-submit, P3 call, or auto-confirmation occurs during hydration.

Keep machine provenance outside visible text: `source=portfolio_entry`, `sessionId`, `sessionRevision`/`revision`, `handoffId`, `handoffVersion`, `confirmationId`, `confirmationVersion`. No separate Brief ID exists; none is invented.

## 6. Errors and side effects

- `401`: continue auth and retry same identity.
- `404`: unavailable/foreign without disclosure; no fallback.
- `409`: stale/invalid identity or confirmation; no local `+1`, latest lookup, or alternate Brief.
- `410`: abandoned/expired; no fallback.
- Network/unavailable: recoverable retry; never clear or overwrite local edits.
- No eligible projection or contradictory confirmation: recoverable empty/error; no fabricated content or partial hydration.

```text
HYDRATION_CANONICAL_WRITES = 0
AUTO_SUBMIT = NO
P3_INVOCATION_DURING_HYDRATION = NO
```

Hydration does not create StrategicFront, Challenge, Initiative, or Step and does not mutate Portfolio.

## 7. D1 evidence and KAN-89 dependency

D1 commit `8713064` adds authenticated `GET /api/v1/public/portfolio-entry/sessions/:sessionId/confirmed-brief`, with strict exact identity in the query and DTO fields for source, session/revision, handoff/version, confirmation/version, rawEntry, handoff, and accepted/corrected/rejected confirmation data. The resolver requires exact revision equality and has no local `+1` or latest fallback. Its error model is 401/404/409/410 as described in the contract.

That commit is not in governed `origin/main @ a2d9045`; Jira KAN-88 and the earlier KAN-79 closure evidence identify KAN-89 as the promotion dependency. D2 runtime must wait until KAN-89 promotes D1 into governed main.

**Compatibility finding for D2:** audited D1 confirmation write validation recognizes `understood_need`/`understanding`, `desired_outcome`, and `known_context`; the approved projection additionally names `decision_to_enable`, `unresolved_context`, `evidence_or_clarity_needed`, and `recommended_approach`. KAN-89 is to promote D1 unchanged. Before D2 runtime, verify that the governed response contains valid confirmation evidence for each requested field. If evidence is absent, omit the field or fail with `INVALID_CONFIRMATION_FOR_D2`; never equate handoff presence with confirmation. This finding does not reopen the product mapping decision or authorize D1/Portfolio Entry semantic changes in D2.

## 8. Alternatives rejected

- **Opaque Brief string / `rawEntry` as fallback:** rejected by the approved product decision and lack of semantic equivalence.
- **Include every handoff field:** rejected; only explicitly mapped, confirmed/corrected fields enter the projection.
- **Choose corrected over accepted even with contradiction:** rejected; invalid confirmation must fail closed first.
- **Display `recommended_approach` without explicit user acceptance/correction:** rejected.
- **Create an intermediate reconciliation page or change P1/P2/P3:** rejected; reuse current First Value flow and checkpoints.
- **Resolve latest revision or another Brief after stale identity:** rejected by D1/KAN-80 exact identity rule.

## 9. Final status

```text
MAPPING_CONTRACT_STATUS = MAPPING_CONTRACT_APPROVED
PRODUCT_MAPPING_AMBIGUITY = RESOLVED
D2_RUNTIME_CAN_START_NOW = NO
D2_RUNTIME_CAN_START_AFTER_KAN89 = YES
NEXT_DEPENDENCY = KAN-89
```

Remaining work is technical baseline promotion through KAN-89 and D2's verification of available confirmed field coverage. No product mapping ambiguity remains. No runtime work, Jira state change, or commit was performed in this reconciliation.
