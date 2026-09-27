# Strategic Framing Promotion Hardening SF-6D.1

## Scope

- Jira references: KAN-32 findings; KAN-36 slice; KAN-37 and KAN-38 corrections.
- Branch: `fix/KAN-37-KAN-38-sf6d1-promotion-hardening`.
- SF-7B: not started.
- Core, Prisma and schema: unchanged.

## V2 change guardrail

- Authority: Core v0.2 factual authority plus the existing Strategic Framing SF-6C/SF-6D implementation and its frozen promotion invariants.
- Current route: authenticated Strategic Framing promotion read and POST routes.
- Semantic owner: V2.
- Preserved: human promotion, ChallengeCandidate distinction, organization scope, authorization, idempotency/exact retry, stale/conflict behavior, atomic Challenge creation, draft status, and promotion trace.
- No authority conflict or ADR required.

## KAN-32 findings addressed

### KAN-37 / F1 — promotion read

Before: one `strategicFramingPromotion.findMany` query followed by one `challenge.findUnique` per promotion.

After: one promotion query, one batched `challenge.findMany` using unique Challenge IDs and a lookup map, with output order preserved. Empty results skip the Challenge query. Missing canonical references remain `challengeTitle: null`.

No Front query was added because this read model did not resolve Front names. No per-promotion Front lookup was introduced.

### KAN-38 / F2 — promotion DTO

Before: the HTTP response exposed the internal `{ promotion, challenge, retry }` persistence-shaped result.

After: the controller emits only:

```text
promotionId
challengeCandidateId
challengeId
challengeTitle
strategicFrontId
challengeStatus: 'draft'
retry
```

The public response does not expose persistence `id`, input fingerprint, candidate snapshot, promotion input snapshot, timestamps, actor audit fields, or raw record spreads. First success and exact retry use the same public shape; only `retry` differs.

Frontend now consumes `promotionId`, `challengeId`, `challengeTitle`, and `challengeStatus` directly from the DTO. The existing success UI remains unchanged.

## Tests and validation

- Focused promotion-read: PASS — 3 tests; zero/one/multiple promotions, bounded query count, ordering, and unresolved reference behavior.
- Focused response contract: PASS — 3 tests; stable first/retry shape, no persistence/audit leakage, auth and scope identity preserved.
- Focused promotion service regression: PASS — 26 tests.
- Strategic Framing backend: PASS — 104 passed, 6 integration tests skipped when the DB variable is unset; DB-backed invocation failed at `localhost:5433` because PostgreSQL was unreachable.
- Strategic Framing frontend: PASS — 3 SF-6D focused tests; full frontend PASS — 563 tests.
- Backend typecheck: PASS.
- Frontend typecheck: PASS.
- Backend full suite: 1123 passed, 84 skipped; command exits non-zero only because the SF-6C integration suite attempts `localhost:5433` and cannot connect.
- Frontend full suite: PASS.
- Integration promotion tests: PASS — 6/6 against disposable PostgreSQL at `localhost:5433`; first promotion, atomicity, exact retry, changed retry conflict, stale behavior, auth/scope, revoked-grant reauthorization, uniqueness and duplicate prevention all passed.
- Browser E2E: PASS — 3/3 with system Microsoft Edge, backend `4102`, frontend `5178`; happy path/idempotent reload, no-Front negative and stale handling passed.

## Fixture collision

The reported unique-grant fixture collision was not reproduced in the real DB-backed run. Classification: no collision; no fixture correction was needed and no uniqueness constraint was weakened. The temporary Playwright config initially omitted `baseURL`; it was corrected for local execution and deleted afterward.

The browser run also logged an unrelated pre-existing schema mismatch on the dashboard challenge-list request: Prisma reports missing `ChallengeInvitation.recipientEmail` although the disposable database reports all 42 repository migrations applied. It did not affect the three SF-6D assertions and no schema/product change was made in this slice.

## Prisma impact

None. No Prisma schema, migration, generated client, persistence algorithm, or transaction boundary changed.

## Readiness

Final validation is GO_WITH_GAPS: SF-6D.1 DB-backed integration and browser E2E pass. The unrelated `ChallengeInvitation.recipientEmail` schema drift remains a nonblocking environment/product follow-up. No SF-7B work was started.
