# KAN-141 — 114F / 133F Governed Home and Bootstrap handoff

**State:** ready for review; read-only reviewer approved round 2. No commit, push or PR requested.  
**Branch:** `feat/KAN-141-114f-home-bootstrap-handoff`.  
**Base:** `origin/main` at `bffdca16a3c4aa67e67f132e3c94e45fe39c121a`.

## Authority and precondition

Authority was checked in the requested order: `docs/STARTERIA_AUTHORITY.md`, factual Core v0.2, accepted ADR-003/004/005, Portfolio Entry Logic Contract v0.1, accepted 114F Portfolio Setup Continuity Experience Contract, KAN-133 architecture, KAN-134/135/136/137/138/140/139 implementation reports, current consumers, and Jira KAN-141. Jira KAN-141 authorizes this bounded 133F backend/frontend consumer slice. `PORTFOLIO_BOOTSTRAP_HOME_LOGIC_CONTRACT_v0.1` and its Tech Spec remain supporting candidates. This change does not use them to supersede the accepted authority. No Core, Prisma schema, migration, grant provisioning, Organization, StrategicFront, Challenge, Initiative, Project or Step creation was needed.

`CURRENT_STATE.md` and `STARTERIA_V2_MANIFEST.md` still describe the full 114F journey as incomplete. Their slice status is reconciled in the governed post-merge closure, which this task does not authorize. Legacy continuation remains `LEGACY_COMPAT`; 114F boundaries are V2-owned.

## V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: Portfolio Entry 114F / 133F
Authority: Jira KAN-141 + accepted 114F + Core v0.2 + ADR-003/004/005
Manifest status: full 114F journey incomplete; 133F explicitly authorized
Current surface: 133E CONTINUATION_READY, then /portfolio/inicio
Legacy dependencies: home-context and from-continuation KEEP_COMPAT
Semantic owner: 114F consumer V2; legacy consumers LEGACY_COMPAT
Adapter: dedicated GET and POST, distinct 114F query identity
Tests: PostgreSQL authorization/currentness/reuse, frontend isolation, deterministic Playwright
Authority conflict: none found; no Core or Prisma change
Proceed: YES
```

## Current consumer audit and collision

| Consumer | Classification | Finding and treatment |
|---|---|---|
| 133E CONTINUATION_READY | ADAPT_FOR_114F_ONLY | Already has returned snapshot ID; add explicit Home action only after POST success. |
| `/portfolio/inicio` ordinary route | KEEP | Current Home and global `portfolio:read` behavior remain unchanged without 114F identity. |
| `portfolioEntryContinuationId` query | LEGACY_KEEP_COMPAT | Retains legacy home-context and legacy Bootstrap; it is never used for 114F. |
| `PortfolioLeadLayout` | ADAPT_FOR_114F_ONLY | Dispatch 114F gate before ordinary hooks and global permission check. |
| `PortfolioLeadHomePage` | ADAPT_FOR_114F_ONLY | Dispatch dedicated arrival composition before normal PortfolioLead/legacy state. |
| `PortfolioLeadProvider` in RootLayout | ADAPT_FOR_114F_ONLY | Route-aware suppression clears normal Portfolio data and prevents its fetches on the 114F arrival URL. |
| `AppProvider` project list in RootLayout | ADAPT_FOR_114F_ONLY | The 114F arrival URL suppresses `/projects`, clears cached projects and restores ordinary loading when leaving by SPA navigation. |
| Legacy home-context endpoint and `usePortfolioHomeEntryContext` | LEGACY_KEEP_COMPAT | Existing endpoint still rejects 114F; dedicated reader is separate. |
| Scoped first-value access and `/portfolio/setup` | DO_NOT_USE | No fallback from 114F Home. Existing behavior elsewhere remains. |
| Legacy Bootstrap `from-continuation` | LEGACY_KEEP_COMPAT | Existing format rejection and create/reuse semantics unchanged. |
| Legacy anchor derivation from `sourceSnapshot` | DO_NOT_USE | Dedicated 114F allowlist derivation added. |
| Bootstrap session reuse and capabilities | ADAPT_FOR_114F_ONLY | Exact 114F source is revalidated before reuse and before 114F session access/actions. |
| Organization, grant provisioning, canonical strategy and Core writes | OUT_OF_SCOPE | No implementation or migration. |

## Arrival identity, endpoint and allowlist

The explicit 133E action navigates to `/portfolio/inicio?portfolioSetupContinuationId=<snapshotId>`. It carries only the snapshot ID. A mixed legacy/114F query or duplicate/empty 114F ID fails closed. This distinct identity avoids format guessing: the 133E 114F action never invokes the legacy `home-context` reader. A manually forged legacy query with a 114F ID is rejected by the legacy server reader and has no cross-format fallback. A legacy ID remains on `portfolioEntryContinuationId` and retains its original route.

Authenticated `GET /api/v1/public/portfolio-entry/continuations/:snapshotId/portfolio-home-arrival` returns a strict `portfolio-setup-home-arrival-v0.1` DTO: snapshot ID/generation, session ID, organization ID/name, current 114D revision/ID/version, supported profile value/version, allowlisted carried projection/open items, `REVALIDATED_AT_HOME_ARRIVAL`, and `bootstrapEligible: true`. The DTO is parsed with strict schemas on both server and client. It contains no raw Prisma row, profile evidence reference, idempotency hash, request fingerprint, binding hash, membership/grant ID, raw conversation/Entry/semantic state, provider metadata, hidden reasoning, legacy sourceSnapshot, or full Path payload.

The server gate proves authenticated identity; exact 114F format and CURRENT lifecycle; row owner; successful classification and binding hash integrity; claimed, owned, active, unexpired session; matching context revision; supported current profile plus matching evidence; latest supported, confirmed 114D with exact ID/version/schema/owner/confirmation time; supported 114E version if bound; and the current organization, membership and exact scoped `portfolio:read` grant. A global `portfolio:read` capability cannot substitute for the scoped grant. A DB CURRENT row that lost effective currentness fails. An old snapshot ID is never regenerated at Home; recovery returns to current Entry review.

## Global hydration, layout and Home composition

`PortfolioLeadProvider` is mounted above Portfolio routes and formerly fetched strategic fronts, challenges and initiatives for any authenticated user. The RootLayout now recognizes only the dedicated 114F Home query, including a trailing slash or case-insensitive route form accepted by React Router. On that route the provider suppresses its normal Portfolio hydration, clears cached state and ignores an in-flight prior refresh result. `AppProvider` also suppresses its global `/projects` read on that route, clears cached projects and reloads them on return to an ordinary route by SPA navigation. Ordinary routes keep their existing loading. The Layout dispatches `PortfolioSetupArrivalGate` before calling `usePortfolioLead`, scoped first-value or legacy home-context hooks. It renders only a validation state until the server GET succeeds; even global permission users cannot bypass the gate.

After success, `PortfolioLeadHomePage` mounts `PortfolioSetupHomeArrivalPage` instead of the ordinary dashboard. The page shows bounded confirmed reading, decision frame, known context, representation, suggested first move and open items with explicit truth/provenance language. Provisional user context is not stated as approved organizational truth. A Bootstrap error hides carried context and requires Home revalidation before retry. The ordinary Home path and legacy arrival component are unchanged. The full-stack run exposed a KAN-139 client integration defect: its isolated Axios instance omitted the authentication bearer token. The 114F Entry GET/POST now use the shared authenticated API client; their strict DTO and request semantics are unchanged.

## Bootstrap gate, create/reuse and anchor provenance

Dedicated authenticated `POST /api/v1/portfolio-bootstrap/sessions/from-portfolio-setup-continuity` accepts only `{ snapshotId }`. The client never supplies organization or capability. The service repeats the exact Home consumer validation in the same serializable transaction before creating **or reusing** a Bootstrap session. It binds `sourceContinuationId` to that 114F snapshot and `organizationId` to its current scoped organization. A uniqueness-race recovery repeats validation. Existing 114F Bootstrap session reads and actions also revalidate current snapshot/source/scope in `authorizeSessionCapability`; an old active row is not proof of authorization. Legacy sessions retain their existing capability behavior.

The 114F anchor derives only from the allowlisted carried projection and open items. It remains `anchor_provisional` with `businessSignalStatus: unknown`, review required, source references, origin and truth class retained for each field. `firstMoveSuggestion` stays in provenance as a suggestion. It does not consume legacy `sourceSnapshot` or promote an AI suggestion to approved strategy. Bootstrap creates its own session and provisional anchor only; no Project, Step, StrategicFront, Challenge, Initiative, grant or membership is created.

## Failure and recovery

Missing/wrong-owner/cross-format IDs are masked as not found. Invalid/hash-broken snapshots fail closed. Superseded, source-changed and profile-conflicted snapshots deny Home and direct the user to current Entry review. Revoked grant, removed membership or missing organization deny tenant Home/Bootstrap. Resolver failure is a retryable validation error. Bootstrap failure hides the previously read context and starts retry at the Home gate. There is no legacy reader or `/portfolio/setup` fallback.

## Verification evidence

| Check | Result |
|---|---|
| New 114F Home PostgreSQL integration | PASS within 6-file/46-test integration batch and after explicit second-tenant/global-role additions in a focused rerun; covers valid DTO, privacy, missing/wrong owner, legacy/invalid/hash/superseded/stale 114D/profile/org/member/grant, global-only denial, Bootstrap create/reuse and revalidation, no Project/Step/grant writes. |
| Existing Bootstrap, 114F write/read, legacy Home and scoped auth PostgreSQL regressions | PASS in same 6-file/46-test batch. |
| Focused backend unit | PASS: 4 files, 43 tests. |
| Focused frontend and Layout/Home regressions | PASS: 7 files, 62 tests, including deferred gate, global permission bypass prevention, provider hydration suppression and dedicated Bootstrap client. |
| Full backend and frontend test suites | PASS, exit 0; existing warnings and truncated console output. |
| Backend and frontend typechecks | PASS. |
| Lint | PASS. |
| Backend and frontend builds | PASS; Vite emitted existing chunk/dynamic import warnings. |
| KAN-141 deterministic Playwright HTTP fixtures | PASS: 10 cases. Covers golden path, revoked scope, changed source, wrong user, global-only permission, legacy, ordinary Home, mobile width, trailing slash and ordinary route recovery; asserts no `/projects` or normal Portfolio fetch on 114F arrival. No LIVE LLM. |
| KAN-141 deterministic full-stack Playwright | PASS: 1 real browser/API/PostgreSQL case. Uses API-created session, confirmed 114D fixture, actual 114E and 114F GET/POST, actual dedicated Home GET and Bootstrap POST, persisted snapshot and Bootstrap binding, and no Project/Step creation. The runner uses only the KAN-114 deterministic test adapter. |
| KAN-139 deterministic Playwright regression | PASS: 12 cases. |
| `git diff --check` | PASS after final code edits. |
| Read-only reviewer | APPROVED, round 2; no findings. |
| BrowserSkill manual pass | Not run: BrowserSkill is unavailable in this environment; Playwright browser checks above ran. |
| Production Jev regression | Not run: no deploy/merge; existing runner requires LIVE LLM and a claimed-session fixture. |

The ten scenario cases use deterministic HTTP fixtures to prove navigation, transport ordering, denial handling and no Project/Step writes in the browser. The separate full-stack case proves the real browser → routers → PostgreSQL path. PostgreSQL service integration proves authorization/currentness/reuse denials. Mobile arrival/Bootstrap has no horizontal document overflow at the tested viewport. No Prisma migration was added.

## Security, remaining gaps and next slice

The trust boundary is server-side on both GET and POST, with repeat validation for 114F Bootstrap capabilities. The 114F path does not rely on a snapshot as a grant, a global permission, cached frontend state, or an existing Bootstrap row. Tenant A/B ownership and exact organization scope are checked in PostgreSQL. Ordinary Home policy and legacy continuation remain as they were; broader Home governance is outside KAN-141.

This is implementation and local verification evidence, not deploy evidence. Manifest/current-state reconciliation, production regression and Jira closure belong after human-reviewed merge. The next Portfolio-first closure is 133H. The 133G Initiative exception remains separately governed and has no implementation in this diff.

## V2_CHANGE_CLOSURE_CHECK and readiness

```text
V2 contract satisfied: YES for authorized 133F consumer handoff
V2 route active locally: dedicated 114F Home query plus dedicated GET/POST
V1 consumer remaining: YES, KEEP_COMPAT
Legacy compatibility documented: YES
E2E passed: YES, 10 new HTTP-fixture + 1 real full-stack + 12 KAN-139 deterministic browser cases
Manifest updated: NO, governed post-merge closure
Retirement action: KEEP_COMPAT
Migration status: 133F locally ready; 133H closure pending

HOME_114F_ARRIVAL_READY: YES
CONSUMER_SOURCE_REVALIDATION_READY: YES
CONSUMER_SCOPED_B_REVALIDATION_READY: YES
NO_GLOBAL_BYPASS_FOR_114F: YES
TENANT_PRELOAD_BLOCKED_BEFORE_GATE: YES, PortfolioLead tenant hydration on the 114F route
BOOTSTRAP_114F_CREATE_REUSE_READY: YES
BOOTSTRAP_REUSE_REVALIDATES: YES
ANCHOR_114F_PROVENANCE_SAFE: YES
LEGACY_HOME_COMPAT_PRESERVED: YES
GENERAL_HOME_POLICY_UNCHANGED: YES
ENTRY_TO_HOME_E2E_READY: YES, deterministic full-stack browser/API/PostgreSQL plus scenario fixtures
NO_PROJECT_STEPS_SIDE_EFFECTS: YES
NEXT_SLICE_READY: YES, 133H; 133G remains separate
SAFE_TO_COMMIT: YES, reviewer approved and final diff audit passed; no commit requested
```
