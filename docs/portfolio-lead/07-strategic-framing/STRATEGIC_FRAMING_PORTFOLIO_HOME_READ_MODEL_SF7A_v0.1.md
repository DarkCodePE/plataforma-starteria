# Strategic Framing → Portfolio Home Read Model — SF-7A v0.1

**Document status:** `GO`
**Scope:** visibility/lifecycle gap closure only. No runtime, Prisma, Jira, commit, push or SF-7B.

## Decision

Strategic Framing has no approved persisted lifecycle status named `active`, `current`, `closed`, `archived` or `completed`. SF-7 does not infer one from timestamps, promotion count, sufficiency, ADDRESS NOW count, candidate count or promotion completeness.

Home visibility is a presentation/read policy, not domain lifecycle:

```text
organization-scoped StrategicFramingProvisionalState records
→ derive factual attention
→ attention-required first
→ updatedAt DESC
→ id ASC deterministic tie-breaker
→ bounded executive subset
→ preserve totalStateCount and hasMore
```

Therefore Home visibility is not active lifecycle, Home omission is not closed/archived, Home ordering is not strategic priority, and Portfolio Home is an executive projection rather than the complete historical inventory.

## Current-state map

| Area | Factual path/evidence |
| --- | --- |
| Home backend | `backend/modules/portfolio/portfolio-home.read-service.ts` — `PortfolioHomeReadService.getHome(userId)` |
| Home endpoint | `GET /api/v1/portfolio/home`, mounted in `backend/app.ts`, authenticated in `backend/modules/portfolio/portfolio.router.ts` |
| Home frontend | `front/src/app/pages/PortfolioLeadHomePage.tsx` |
| Home context | `front/src/features/portfolio-lead/context/PortfolioLeadContext.tsx` |
| SF state | `backend/modules/strategic-framing/strategic-framing.provisional-state.service.ts` / `StrategicFramingProvisionalState` |
| SF workspace | `/portfolio/framing/:stateId`, `front/src/features/portfolio-lead/strategic-framing/StrategicFramingWorkspacePage.tsx` |
| Promotion read | `backend/modules/strategic-framing/strategic-framing.promotion-read.service.ts` |
| Canonical roots | `StrategicFront` → `Challenge` → initiatives |

The current Home backend aggregates canonical Portfolio records and Portfolio Reading. The current frontend still loads Fronts, Challenges and Initiatives through multiple context requests; it does not yet consume a Strategic Framing Home projection.

## Chosen boundary

Choose **B**: Strategic Framing owns a dedicated server-side read projection consumed by `PortfolioHomeReadService`. The browser receives one Home source. This preserves SF ownership, server scope, bounded reads and testability.

Reject A (direct Home reads of SF tables) because it couples Portfolio to SF JSON internals and ownership rules. Reject C (separate frontend reads) because it duplicates scope, creates partial loading and undermines one Home source.

## Target contract

```ts
type StrategicFramingHomeSummary = {
  availability: 'available' | 'unavailable';
  totalStateCount: number;
  items: StrategicFramingHomeItem[];
  hasMore: boolean;
};

type StrategicFramingHomeItem = {
  stateId: string;
  updatedAt: string;
  sourceMode: 'public_entry' | 'enterprise_direct' | 'existing_portfolio';
  intendedMovement: string | null;
  sufficiency: { status: string; blockers: string[] };
  prioritization: {
    addressNow: number;
    observe: number;
    discard: number;
    undecided: number;
    focusSlots: number | null;
  };
  structuring: {
    confirmedCandidates: number;
    unpromotedConfirmedCandidates: number;
  };
  promotions: Array<{
    promotionId: string;
    challengeCandidateId: string;
    challengeId: string;
    challengeTitle: string;
    strategicFrontId: string;
    strategicFrontName: string;
    challengeHref: string;
  }>;
  attention: {
    required: boolean;
    reasons: Array<'insufficient_framing' | 'blockers_present' |
      'address_now_without_confirmed_candidate' | 'confirmed_candidate_not_promoted' |
      'durable_stale_or_conflict'>;
  };
  workspaceHref: string;
};
```

The MVP Home item limit is **5**. It is a replaceable presentation constraint, not business logic or a migration concern. `totalStateCount` is organization-scoped and independent of the five-item limit. `hasMore` is true when the durable total exceeds the returned item subset.

Unavailable is not zero: `availability: 'unavailable'` means the projection failed or could not be read. An available empty inventory is `availability: 'available'`, `totalStateCount: 0`, `items: []`, `hasMore: false`.

## Visibility, history and fully promoted states

No state is deleted because it falls outside the bounded Home subset. No state is marked closed, archived, completed or superseded. Promotion does not remove the source state. Existing durable states remain queryable through the system of record. SF-7 creates no archive policy; close/archive/reopen is a separate future lifecycle decision.

A state where every confirmed ADDRESS NOW candidate is promoted is not automatically complete or hidden. It receives no `confirmed_candidate_not_promoted` attention reason. It may appear because of recency or another factual attention reason, or fall outside the five-item subset naturally as newer/attention-required records exist. `updatedAt DESC` is only display ordering, never a canonical priority signal.

## Source ownership and canonical relationship

| Field/group | Source of truth | Status |
| --- | --- | --- |
| state identity, source mode, movement, sufficiency | `StrategicFramingProvisionalState` | provisional |
| prioritization counts and `focusSlots` | `prioritizationState` JSON, server-derived counts | provisional/non-canonical |
| confirmed candidates | `challengeStructuringState.candidates` | provisional/non-canonical |
| promotion identity | `StrategicFramingPromotion` | trace |
| Challenge title/id | `Challenge` through promotion | canonical |
| Front id/name | `StrategicFront` through `Challenge.strategicFrontId` | canonical |
| workspace/challenge links | existing frontend routes | derived navigation |

The only allowed canonical chain is:

```text
StrategicFramingPromotion
→ Challenge
→ Challenge.strategicFrontId
→ StrategicFront
```

Text similarity, labels, `parentContext`, `parentStatus`, `subjectLevel` and semantic proximity never infer a Front relationship. Promotion does not mutate provisional structuring or disposition.

## Attention and prioritization

Counts are server-derived from `humanDisposition`: `address_now`, `observe`, `discard`, `undecided`; missing prioritization remains non-available/empty with `focusSlots: null` and does not become a completed zero-state.

Attention is factual only: insufficient framing, persisted blockers, ADDRESS NOW without a confirmed candidate, confirmed candidate not promoted, and durable stale/conflict when actually observable. No `urgent`, `at risk`, `healthy`, RAG or health score is invented. Human disposition never maps to Challenge lifecycle.

Use one server-owned Home attention projection. Sort attention-required first, then `updatedAt DESC`, then persisted `id ASC`. This is not a Portfolio priority decision.

## Auth and scope

Home currently requires authentication only; no new permission policy is authorized here. SF reads require `portfolio:read`. Organization scope comes from server-owned actor/state data and must constrain canonical lookups. Browser-provided organization identifiers are not authoritative.

## Query/performance plan

1. Count all organization-scoped SF states and select minimum fields for summary/attention.
2. Fetch an explicit organization-scoped candidate set sufficient for factual attention derivation; no invented lifecycle predicate.
3. Batch promotions for candidate state IDs.
4. Batch Challenges by promotion `challengeId`.
5. Batch Fronts by canonical `strategicFrontId`.
6. Derive counts/attention server-side, stable-sort, return five items plus `totalStateCount` and `hasMore`.

There must be no per-state Challenge query or per-promotion Front query. The existing promotion reader's per-row Challenge lookup is an N+1 risk and must not be copied. If JSON attention fields prevent safe database ordering under current Prisma/PostgreSQL access, derive and sort in service after an explicit candidate-set bound; keep total count as a separate organization-scoped count. No index or migration work is part of SF-7A.

## Partial data, navigation and freshness

If Portfolio succeeds and SF fails, preserve Portfolio Home and return SF as unavailable; do not render SF zero counts or attention. A normal Home mount, retry, and return from the workspace refetch the projection. No realtime/WebSocket is required.

Existing routes only:

- workspace: `/portfolio/framing/:stateId`
- Challenge: `/retos/:challengeId`

Home has no edit, promote, create, split, merge, group, activate or publish action.

## Prisma and KAN-32

```text
schema change: NO
migration: NO
PRISMA DECISION REQUIRED: NO
```

KAN-32 review state: **review pending / no blocking or major finding known**. No result is fabricated. This does not block committing the SF-7A decision document, but it blocks SF-7B while the agreed post-merge technical review remains pending.

## SF-7B test matrix

Backend: no state, one/multiple same-org states, other-org isolation, permission denial, missing prioritization, null focus slots, mixed dispositions, confirmed/unpromoted/promoted candidates, multiple promotions, canonical missing/deleted semantics, projection failure, zero vs unavailable, bounded-query/N+1 evidence, and read-only mutation guards.

Frontend: no framing, provisional framing, each factual attention reason, confirmed unpromoted, promoted Challenge link, unavailable projection, no mutation controls, workspace navigation/refetch, and no inferred Front relationship.

E2E is required in SF-7B for server-to-Home composition/navigation; broader lifecycle journey can remain SF-7C. SF-7A does not implement or add E2E.

## Recommended SF-7B slices

1. Projection owner, scope and explicit bounded visibility policy.
2. Batched promotions/Challenges/Fronts and canonical-chain enforcement.
3. Home composition under `strategicFraming`.
4. Front adapter, factual attention and unavailable handling.
5. Refetch/freshness and focused backend/frontend/E2E tests.

## Final status

```text
SF-7A DOCUMENT STATUS: GO
ACTIVE/CURRENT SEMANTIC GAP: CLOSED
PRISMA DECISION REQUIRED: NO
READY TO COMMIT DOC: YES
READY FOR SF-7B: NO (KAN-32 review pending)
```

This is the sole file changed in this turn. No runtime, Prisma, Jira, commit, push or SF-7B implementation is included.
