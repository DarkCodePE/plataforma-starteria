# KAN-140 — 114F stale snapshot recovery (133B)

## Authority and baseline

Base: `origin/main` at `3fa498e04a8eed72528c194da612d5ebefa01544`.
Branch: `feat/KAN-140-114f-stale-snapshot-recovery`.

The factual Core v0.2, accepted ADR-003/004/005, accepted 114F Experience Contract, KAN-133 architecture and KAN-134 through KAN-138 boundary reports govern this slice. KAN-140 explicitly authorizes adapting the 133B read/status boundary. KAN-139 recorded the stale recovery loop after a refreshed, confirmed 114D. This change does not authorize Home/Bootstrap or a change to 133D, schema, grants, legacy continuation, or the KAN-139 UI.

## Root cause and currentness model

133B validated the current session, latest confirmed 114D and profile, then classified a stored `snapshotState=CURRENT` 114F row. It called `snapshotMatchesSource` before checking the stored binding hash and returned `STALE_SOURCE` on mismatch. A valid snapshot from an older 114D therefore blocked the newly valid source before scope resolution; 133D could not receive a fresh continuation request.

`snapshotState` records the persisted lifecycle (`CURRENT` or `SUPERSEDED`). Effective currentness is separate: the row must be a valid 114F snapshot, have a valid source binding hash, match the current session/114D/profile and survive current scope authorization. A structurally valid, hash-valid older row may remain persisted as `CURRENT` until a new POST. It is not effective for GET.

## Read behavior

133B still returns `STALE_SOURCE` with `REVIEW_CRITICAL_HANDOFF` when the current source cannot be trusted: invalid session lifecycle or expiry; missing, mismatched, unsupported, unconfirmed or invalid latest 114D; or an unsafe confirmation owner/payload. Profile and insufficient-basis gates remain ahead of snapshot handling.

For a stored `CURRENT` row, 133B now classifies its structure, rejects invalid 114F rows, verifies `sourceBindingHash`, and only then compares the material binding to the current source. An invalid shape or hash returns `ERROR` with `INVALID_114F_SNAPSHOT`, even when the row also belongs to an older source. A valid older row is ignored as effective current: no public `snapshot`, stored scope selection, old 114E binding, carried projection or tenant authority is taken from it. No DTO expansion was needed.

The source binding in the DTO is built from the latest valid 114D and current session: session ID, context revision, 114D ID/version/schema and confirmation time. Current server-authorized scopes are resolved normally after ignoring the old row. Zero scopes yield the existing safe `READY_PROVISIONAL` behavior; one yields `READY_AUTHORIZED_SCOPE`; multiple yield `SELECT_SCOPE` without a preselected old scope; resolver failure yields `SCOPE_VALIDATION_FAILED`. A matching snapshot whose scope has been revoked still follows the existing `NO_AUTHORIZED_SCOPE` behavior. The GET adapter uses a repeatable-read transaction with a session `FOR SHARE` lock and only read operations; it does not supersede the old row, increment revisions, create snapshots or write idempotency rows.

## 133D regeneration and idempotency

The PostgreSQL sequence creates generation 1 from confirmed 114D A, advances the session context and confirms 114D B, then calls 133B. GET exposes B's source binding, omits generation 1 and leaves it persisted as `CURRENT`. POST 133D with that fresh binding, current revision, current scope and a fresh idempotency key creates generation 2. The existing serializable write transaction marks generation 1 `SUPERSEDED`, fills `supersededAt` and `supersededById`, and leaves exactly one DB `CURRENT`. The old key still fails against the changed source; replay with changed material still conflicts. No 133D idempotency code changed.

The integration sequence also checks that GET leaves session revision and snapshot count untouched, and that GET/POST do not create Project, Step, grant or Bootstrap state. Legacy `LEGACY_UNBOUND` rows remain isolated, including their `/portfolio/setup` destination; 114F is not returned through the legacy reader.

## Tests and validation

- Unit tests cover no snapshot, matching snapshot, valid old snapshot with zero/one/multiple current scopes, resolver failure, fresh 114D binding, omitted old snapshot and scope, invalid stored shape/hash, truly stale and unconfirmed latest 114D, profile conflict, and read-only dependency surface. The new recovery tests failed with `STALE_SOURCE` before the service change and passed after it.
- PostgreSQL 133B/133D integration: 11 tests passed against the disposable `starteria_e2e` database at port 55433. The regeneration test verifies A → B → GET → POST and atomic supersession, including no GET idempotency write. No Prisma migration was made.
- Backend full suite: 175 files and 1,564 tests passed; 22 files and 112 tests were skipped by their normal feature/database gates. Backend typecheck, lint, backend build and `git diff --check` passed. The normal full-suite run skips DB integration by design; the focused PostgreSQL run above executes it.
- No LIVE LLM was used.

The required read-only `revisor-starteria` review returned `approved` with no blocking findings. The reviewer did not independently rerun the full suite and relied on the recorded execution evidence.

## KAN-139 unblock status

The backend condition that trapped the KAN-139 stale UI is removed: after confirming a new valid 114D, a fresh GET can return the current scope state and permit a new POST. KAN-139 still needs to rebase/update its deterministic stale E2E fixture to assert this recovered GET and successful new snapshot; its existing fixture models the pre-fix stale response and does not automatically prove the combined journey. No KAN-139 frontend file was edited here. Home/Bootstrap handoff remains unauthorized.

## Remaining gap and closure

This branch has no commit, push or PR by request. The cross-branch KAN-139 browser rerun remains after integration of this backend change. `V2_CHANGE_CLOSURE_CHECK`: 114F read contract satisfied for this recovery; V2 route already exists; legacy consumer remains `KEEP_COMPAT`; PostgreSQL recovery passed; Manifest/Current State await the governed merge closure; migration remains `PARTIAL` because Home/Bootstrap handoff is separate.
