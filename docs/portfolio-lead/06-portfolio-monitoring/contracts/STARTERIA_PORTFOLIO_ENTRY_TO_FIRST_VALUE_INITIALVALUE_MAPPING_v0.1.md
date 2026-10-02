# Portfolio Entry → First Value Strategic Intent Projection Contract v0.1

**Status:** `MAPPING_CONTRACT_APPROVED` (Jira KAN-88 Product Decision — APPROVED)

**Slice:** KAN-88 / KAN-74 D2.0 — documentary contract only

**Runtime:** Not implemented. KAN-89 must promote D1 to governed `main` before D2 runtime starts.

**Decision record:** [KAN-88 D2 mapping decision](../90-implementation-reports/KAN-88_D2_INITIALVALUE_MAPPING_DECISION_v0.1.md)

## 1. Purpose

Define the deterministic projection of a confirmed Portfolio Entry into First Value. D2 carries structured strategic intent, not an opaque `initialValue` string and not `rawEntry` as the final Brief. The projection preserves the user's confirmed strategic clarification without adding generated interpretation.

## 2. Authority

The authority chain is `docs/STARTERIA_AUTHORITY.md` → Core v0.2 (factual baseline, “Base fundacional revisada / Por validar”) → Jira KAN-74/KAN-88 → KAN-63/A.3.2 and KAN-83 for the existing First Value experience. Jira KAN-88 comment “Product Decision — APPROVED” (2026-10-02) is the product decision for the field projection and continuation semantics.

KAN-79 D1 implementation commit `8713064` and its report were audited as implementation evidence, but are not present in governed `origin/main @ a2d9045`. KAN-89 is required to promote that already-reviewed resolver. This contract does not change D1 semantics, Portfolio Entry, First Value P1/P2/P3, Core, or Steps 0–4.

## 3. StrategicIntentProjection

Conceptual shape:

```ts
type StrategicIntentProjection = {
  goal: string;
  situation?: string;
  decisionToEnable?: string;
  knownContext?: string | string[];
  approachHypothesis?: string;
  openQuestions: string[];
  provenance: {
    source: 'portfolio_entry';
    sessionId: string;
    sessionRevision: number;
    handoffId: string;
    handoffVersion: number;
    confirmationId: string;
    confirmationVersion: number;
  };
};
```

The shape is semantic: even if the current First Value page serializes the secondary fields into one context control, consumers must retain the fields separately until that deterministic serialization boundary. `goal` is required for a usable projection. Optional fields with no eligible confirmed value are omitted; `openQuestions` is empty when no eligible question remains. Provenance is machine-readable and never part of user-visible text.

## 4. Field mapping

| Destination | Portfolio Entry source | Include when | Omit when |
|---|---|---|---|
| `goal` | `desired_outcome` | Effective confirmed/corrected value is non-empty | Rejected, unconfirmed, contradictory confirmation, or empty |
| `situation` | `understanding` | Effective confirmed/corrected value is non-empty | Rejected, unconfirmed, contradictory confirmation, or empty |
| `decisionToEnable` | `decision_to_enable` | Effective confirmed/corrected value is non-empty | Rejected, unconfirmed, contradictory confirmation, or empty |
| `knownContext` | `known_context` | Effective confirmed/corrected value contains non-empty user-confirmed content | Rejected, unconfirmed, contradictory confirmation, or empty |
| `openQuestions[]` | `unresolved_context` + `evidence_or_clarity_needed` | Each item is confirmed/corrected and non-empty; retain source order, then append the second field's items; remove exact duplicate normalized items while keeping first occurrence | Rejected/unconfirmed items, contradictions, empty items |
| `approachHypothesis` | `recommended_approach` | Explicitly accepted or corrected, non-empty; label as a hypothesis/approach worth exploring | Merely present in handoff, rejected, unconfirmed, contradictory, or empty |
| Visible projection | `alternative_approaches`, `starteria_path`, `recommended_cta`, technical provenance | Never included in visible hydration | Always |
| Source history | `rawEntry` | May remain source/history only where existing authorized storage supports it | Never use as final Brief text or hydration fallback |

The corrected human value maps to the destination value as supplied; the mapping does not paraphrase, summarize, or infer. For array/object values, preserve supported user-facing values and order; ignore metadata and provenance properties. Do not stringify arbitrary objects into visible content.

## 5. Confirmation precedence and invalid states

Apply independently to each source field or item:

1. If terminal states contradict (including `accepted + rejected`, `corrected + rejected`, or another impossible combination), return `INVALID_CONFIRMATION_FOR_D2`. Do not choose a value or partially hydrate.
2. Else, if `correctedFields[field]` exists, use that corrected user value.
3. Else, if `acceptedFields` contains `field`, use the matching `handoff[field]` value.
4. Otherwise omit it. Presence in the handoff alone is not confirmation.
5. A rejected value never enters the visible projection. Rejected and unconfirmed values remain excluded even if present in `rawEntry` or another unconfirmed projection field.

Do not apply precedence across different fields. `corrected > accepted` applies only after confirming that the same field has no contradictory terminal state.

## 6. Deterministic presentation

No AI or generative rewrite runs during D2 hydration. The projection is the source of truth; a visual/serialization layer may render non-empty optional values using fixed labels, for example:

```text
Situación actual:
{situation}

Decisión que quiero preparar:
{decisionToEnable}

Contexto conocido:
{knownContext}

Una vía que merece explorar:
{approachHypothesis}

Todavía necesitamos aclarar:
{openQuestions, one per line}
```

Omit a whole labeled section when its value is absent. Preserve user text except trimming outer whitespace and normalizing line endings; do not rewrite punctuation or wording. Do not duplicate exact normalized questions. `goal` is hydrated separately into the existing goal control. Any serialization of the remaining fields uses this stable field order and the labels above; it must not merge `goal` into the shared context text.

## 7. Empty and partial projection

- A missing optional field is omitted; no placeholder or inferred content is inserted.
- `rawEntry` alone does not qualify as a projection and is never a fallback.
- `approachHypothesis` is omitted unless accepted or corrected.
- If `goal` has no eligible non-empty confirmed/corrected value, no valid projection exists: do not hydrate any part of the projection; present a recoverable empty/error state.
- A contradiction in any field needed for projection invalidates the D2 confirmation payload; fail closed with `INVALID_CONFIRMATION_FOR_D2` and do not hydrate.

Retrying resolution or deriving the projection cannot erase local First Value edits.

## 8. Provenance

Keep `source = portfolio_entry`, `sessionId`, `sessionRevision`/response `revision`, `handoffId`, `handoffVersion`, `confirmationId`, and `confirmationVersion` separate from visible editable content. Preserve exact D1 values; do not compute a revision locally. D1 has no separate Brief ID; do not invent one. `rawEntry` may be source/history only and is not included in the visible projection.

## 9. Hydrate once and First Value boundary

Journey:

```text
/portfolio/setup
→ valid D1 response
→ derive StrategicIntentProjection
→ hydrate once
→ user sees Strategic Intent and may edit/delete
→ explicit submit
→ normal P1 checkpoint
→ existing P2
→ existing P3
```

Use the existing page and controls; create no intermediate screen. Hydrate `goal` into the current goal control. The remaining semantic fields may be serialized deterministically into the current context control, while retaining the distinct projection fields in consumer state. The existing P1 checkpoint remains the normal user confirmation step after hydration.

Hydration occurs once for the page session, after D1 identity validation and successful projection derivation. Any subsequent refetch must not overwrite. If the user edits before a refetch returns, local edits win. A different identity/revision must not silently replace the projection or local edits; fail closed and offer recovery without looking up latest. Same identity/revision refetch is a no-op. No automatic refresh is allowed to overwrite the page session.

## 10. Revision and error behavior

D1 identity is `sessionId` in the path plus exact `source`, `sessionRevision`, `handoffId`, `handoffVersion`, `confirmationId`, and `confirmationVersion` query values. Require exact revision equality. No local `+1`, latest lookup, or alternate Brief fallback.

| Result | Consumer behavior |
|---|---|
| `401` | Continue existing auth flow; retry the same identity. Preserve edits. |
| `404` | Show unavailable without disclosing missing vs foreign; no fallback. |
| `409` | Treat identity/confirmation as stale or invalid; no `+1` and no latest lookup. Preserve edits and require explicit same-source recovery if supported. |
| `410` | Show abandoned/expired state; no fallback. Preserve local edits. |
| Network/unavailable | Recoverable retry; do not clear or overwrite local edits. |
| No eligible projection / `INVALID_CONFIRMATION_FOR_D2` | Recoverable empty/error state; do not fabricate or partially hydrate content. |

## 11. Side-effect boundary

`HYDRATION_CANONICAL_WRITES = 0` and `AUTO_SUBMIT = NO`. Hydration must not create StrategicFront, Challenge, Initiative, or Step; mutate Portfolio; invoke P3; submit P1; or auto-confirm anything. P1/P2/P3 retain their existing semantics and are reached only through the user's normal explicit actions.

## 12. D1 payload compatibility dependency

The audited D1 commit's confirmation write validation recognizes `understood_need`/`understanding`, `desired_outcome`, and `known_context`; KAN-88's approved projection also names `decision_to_enable`, `unresolved_context`, `evidence_or_clarity_needed`, and `recommended_approach`. The product decision authorizes mapping those fields only when their confirmation state and value are actually present and valid in the governed D1 response. D2 must not treat mere handoff presence as confirmation. KAN-89 must promote D1 unchanged; D2 implementation must verify actual DTO payload coverage and return `INVALID_CONFIRMATION_FOR_D2` or omit a field where confirmation evidence is absent. This compatibility check does not authorize changing Portfolio Entry or D1 semantics in D2.

## 13. Non-goals

- Implement D2 runtime, frontend, backend, or a new screen in KAN-88.
- Change D1, KAN-79, KAN-80, KAN-89, Portfolio Entry, or the accepted product mapping.
- Change First Value P1/P2/P3 semantics, Core, or Steps 0–4.
- Generate, summarize, or infer Strategic Intent during hydration.
- Create canonical entities, mutate Portfolio, invoke P3, auto-submit, or auto-confirm.

## 14. Acceptance criteria

- AC1: Mapping produces a structured `StrategicIntentProjection`, not an opaque Brief string.
- AC2: Field mapping and per-field confirmation precedence follow §§4–5; contradictions fail closed.
- AC3: `rawEntry` is source/history only, never final Brief or fallback.
- AC4: `recommended_approach` appears only when explicitly accepted/corrected and remains an approach hypothesis.
- AC5: rejected and unconfirmed values never enter visible hydration; excluded fields remain excluded.
- AC6: presentation is deterministic, preserves user text, omits empty sections, and adds no generated content.
- AC7: existing `/portfolio/setup`, goal/context controls, and P1→P2→P3 journey are reused without semantic changes.
- AC8: hydration occurs once; refetch, retry, or changed identity cannot overwrite local edits.
- AC9: provenance is exact, machine-readable, and separate from visible text; no Brief ID is invented.
- AC10: errors and empty projections fail closed with recoverable behavior and no fallback.
- AC11: hydration causes zero canonical writes, no P3 invocation, no auto-submit, and no auto-confirm.
- AC12: KAN-89 promotes D1 into governed main before D2 runtime begins; D2 verifies the available D1 confirmation payload without changing D1 semantics.

```text
MAPPING_CONTRACT_STATUS = MAPPING_CONTRACT_APPROVED
PRODUCT_MAPPING_AMBIGUITY = RESOLVED
D2_RUNTIME_CAN_START_NOW = NO
D2_RUNTIME_CAN_START_AFTER_KAN89 = YES
```
