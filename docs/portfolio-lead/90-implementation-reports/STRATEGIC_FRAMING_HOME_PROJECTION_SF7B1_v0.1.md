# Strategic Framing Home Projection — SF-7B.1 / KAN-40

## Authority and scope

Implemented against `docs/STARTERIA_AUTHORITY.md`, Core v0.2, the approved Strategic Framing Experience Contract, SF-6D.1 hardening, and the SF-7A Portfolio Home read-model decision. This slice adds only the server-owned, read-only projection service. KAN-41, KAN-42, KAN-43 and KAN-44 are not implemented.

## Contract and source mapping

`StrategicFramingHomeProjectionService` returns a discriminated `available` / `unavailable` result. State identity, source mode, intended movement, sufficiency, prioritization JSON and structuring JSON come from `StrategicFramingProvisionalState`. Promotions come from `StrategicFramingPromotion`. Challenge title and canonical Front relation come only from `Challenge` and `Challenge.strategicFrontId` → `StrategicFront`.

Raw snapshots, audit fields, fingerprints, actor fields, history and AI reasoning are not exposed.

## Attention and coverage

Attention is derived only from insufficient sufficiency, persisted blockers, uncovered `address_now` source candidates, and confirmed ChallengeCandidates without a promotion. Coverage follows `address_now candidateId` → `ChallengeCandidate.sourceCandidateIds`; it is not reduced to a count-only check. Missing prioritization is represented by empty derived counts and `focusSlots: null`, without claiming unavailable data or inventing a health state.

## Canonical relation and navigation

The service resolves `Promotion → Challenge → Challenge.strategicFrontId → StrategicFront`. Missing Challenge or Front references remain null; no text, label, intended movement or AI inference creates a Front link. It emits `/portfolio/framing/:stateId` for every item and `/retos/:challengeId` only for an existing canonical Challenge.

## Query pattern and scope

The service performs one organization-scoped state count, one state `findMany`, one batched promotion `findMany`, one batched Challenge `findMany`, and one batched StrategicFront `findMany` when IDs exist. There are no per-state promotion queries, `challenge.findUnique` calls or per-Challenge Front queries. Organization scope is supplied by authenticated server context and the `portfolio:read` permission is required; authorization errors are propagated, not converted to unavailable.

Ordering is derived after attention: required first, `updatedAt` descending, stable state ID ascending, then limit 5. Total count and `hasMore` are preserved. No lifecycle status is invented and the service does not mutate provisional state or canonical records.

## Tests and Prisma impact

Focused tests cover empty and non-empty projections, ordering and limit, prioritization/null focus slots, factual attention and source-ID coverage, partial promotion, canonical missing references, batching/query count, organization isolation and unavailable-vs-forbidden semantics. No Prisma schema or migration was changed.

## Explicit boundary

`PortfolioHomeReadService`, `GET /api/v1/portfolio/home`, frontend, Home UI and E2E composition remain unchanged for later SF-7B slices.
