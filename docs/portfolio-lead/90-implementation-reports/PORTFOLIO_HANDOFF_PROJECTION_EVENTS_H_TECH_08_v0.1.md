# Portfolio Handoff Projection and Semantic Events — H-TECH-08

## 1. Scope

Implemented the bounded semantic-event persistence boundary, the derived
`PortfolioHandoffProjection`, deterministic projector/rebuild path, and the
Portfolio Home read adapter. H-TECH-09 and Step 0–4 behavior are out of scope.

## 2. Authority

Read: `docs/STARTERIA_AUTHORITY.md`, `CURRENT_STATE.md`,
`STARTERIA_V2_MANIFEST.md`, ADR-003/004/005, the v0.2 activation experience
contract, handoff acceptance checklist, integration contract, technical design,
and H-TECH-02 through H-TECH-07 reports. The requested
`docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` is not materialized in this
checkout; `CURRENT_STATE.md` identifies the factual Core v0.2 contract under
`doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`.

## 3. Current-state audit

H-TECH-05/07 exposed a narrow logical `HandoffEventPort`; no durable semantic
event record or handoff projection existed. Handoff assignment state and its
version remain canonical. Existing Initiative/Step read models remain separate.

## 4. Mechanism decision

Selected mechanism: bounded Option A, a Prisma transaction owned by the
handoff command repository. For Accept, Reject, Portfolio response and Start,
the transaction contains the canonical `PortfolioHandoffAssignment` mutation,
the command idempotency record, and the durable semantic event append. The
projector runs after commit and remains read-only/rebuildable. No broker,
generic event platform, or cross-domain transaction was introduced.

The event ID is deterministic from `(assignmentId, commandType,
idempotencyKey)`. This is event idempotency, not command idempotency: the
command record still owns request replay/fingerprint validation, while the
semantic event repository owns duplicate event safety. A same-key retry also
re-enters event publication, so a committed command whose projection failed is
recoverable rather than silently returned.

## 5. Schema/migrations

Added `PortfolioHandoffSemanticEvent` and `PortfolioHandoffProjection` in
`front/prisma/schema.prisma`, with migration
`20260928210000_add_portfolio_handoff_semantic_events`.

## 6–8. Event model, envelope, durable persistence

`HandoffSemanticEvent` carries stable `eventId`, event/entity identity,
`entityVersion`, actor metadata, `interactionChannel`, bounded scope/correlation
references, redacted payload, `occurredAt`, and `recordedAt`. Prisma uses
`eventId` as the primary key and `upsert` for duplicate delivery safety.
Existing H-TECH-05/07 logical events are adapted through
`DurableHandoffEventPort`; invitation sent/viewed and assignment creation are
also supported by the same adapter when the service is supplied with it.

## 9–11. Idempotency, ordering, stale handling

Command idempotency remains owned by H-TECH-05/07 response command records.
Event idempotency is separate: duplicate event IDs are ignored by persistence,
and duplicate source references are ignored by the projector. The reducer sorts
rebuild input by entity version, occurrence time, and event ID. A lower version
cannot roll back a projection; `STARTED v4` therefore remains `STARTED` when
`ACCEPTED v3` arrives later.

If event append fails inside the transaction, the transaction rolls back the
canonical mutation and command record, so the command cannot falsely complete.
If projection fails after commit, canonical state and event history remain
successful; a same-key retry or explicit rebuild retries projection.

## 12–13. PortfolioHandoffProjection/projector

The projection contains assignment, organization/scope, challenge and target
identity, optional Initiative identity, safe invited identity, owner/team/
observers, handoff state/timestamps, rejection and Portfolio response,
resulting Initiative correlation, last material event, source event references,
projection version, and generation time. It contains no `currentStep`.
`PortfolioHandoffProjector.apply(event)` is deterministic and only writes the
derived repository; lifecycle commands never mutate this model directly.

## 14. Replay/rebuild

`PortfolioHandoffProjector.rebuild(assignmentId, events)` deletes only the
derived row and replays canonical persisted events in deterministic order.
Tests prove equivalent state after rebuild without a lifecycle command.
The projection is never part of the command's canonical write and is never
used to authorize or decide lifecycle transitions.

## 15–18. Initiative, Challenge, rejection, Start

Existing-Initiative assignments retain `initiativeRef` and may coexist with a
separate Portfolio Initiative projection. Challenge assignments retain
`initiativeRef = null` and do not create an Initiative or Project. Rejection
projects `REJECTED`, timestamp, reason, and Portfolio response without changing
target or owner. Start projects `STARTED` and `startedAt`; it never emits or
infers `initiative_started`, `currentStep`, or delivery progress.

## 19–20. Downstream correlation and Portfolio adapter

`initiative_linked_to_handoff_assignment` populates
`resultingInitiativeRef` while preserving the original `targetKind` and event
history. It does not create the Initiative. `PortfolioHomeReadService` exposes
the projection through a bounded `handoffAssignments` adapter and does not read
DOM, pathname, HandoffShell, Step components, or duplicated manual state.

## 21–23. Security and prohibited coupling

Payload redaction removes token/secret/hash keys; invitation bearer tokens are
not event data. No Project/Step mutation, Project creation, `currentStep`, or
`initiative_started` inference was added. No H-TECH-09 route quarantine work
was performed.

## 24. Files changed

- Handoff semantic event domain types, projector, in-memory repositories, and Prisma repositories.
- Handoff assignment/delivery/response event-port adaptation and runtime wiring.
- Portfolio Home read adapter.
- Prisma schema and migration.
- Focused H-TECH-08 tests.
- This implementation report.

## 25. Tests/results

- Focused H-TECH-08 atomicity/recovery plus H-TECH-05 response and semantic-event tests: **17 passed**.
- Focused failure coverage includes Accept rollback, Start rollback, same-key
  projection recovery, duplicate event recovery, deterministic replay, and
  separate Reject/Portfolio-response events.
- Backend typecheck: **passed**.
- `prisma generate`: **passed**.
- `prisma validate`: **passed** with a syntactically valid disposable `DATABASE_URL`; no database connection was made.
- `git diff --check`: **passed**.

## 26. BR/AC traceability

BR-HO-043/044/045/046/047/048 are covered by the event envelope, durable
records, projection, adapter, downstream vocabulary types, and correlation
tests. AC-HO-054 through AC-HO-063 and AC-HO-074 are covered by persistence,
projection, ordering, replay, read-adapter, Challenge, rejection, Start, and
negative-guard tests. The checklist's broader AC-HO-064–066 remain outside this
slice unless exercised by the existing H-TECH-05/07 suites.

## 27. Negative guards

No `currentStep` in the handoff projection; no Project creation; no Step
mutation; no Step logic; no `initiative_started` inferred from Handoff Start;
no fake `PortfolioInitiativeProjection` for a Challenge assignment.

## 28–30. Conflicts, ADR, dependency

Conflict: the requested `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` path is
absent while repository authority points to the factual v0.2 Core path. This is
documented, not silently resolved. No new ADR is required; the implementation
is within accepted ADR-005/H-TECH-08 boundaries. H-TECH-09 remains a future
dependency for legacy-route quarantine only.

No new ADR is required. This is an implementation-boundary hardening of the
already accepted ADR-005 event/projection design: it preserves Assignment as
the lifecycle authority, keeps the projection derived, and changes neither
lifecycle semantics nor Core/Project/Steps behavior.

## 31. Final status

H-TECH-08 implementation is complete and safe for PR review. It is not a
request to merge to main while KAN-53 remains open.
