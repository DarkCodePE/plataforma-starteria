# KAN-139 - 114F / 133E Portfolio Setup Continuity UI

**State:** ready for review; read-only reviewer approved round 2. No commit, push or PR.
**Branch:** `feat/KAN-139-114f-portfolio-setup-ui`.
**Base:** `origin/main` and HEAD `5113b28af3fed0ea4da45cec8245db967c2c6385`.
**Backend recovery:** KAN-140 PR #204 merged at that SHA; CD #129 SUCCESS.

## Authority and precondition

The authority order is `docs/STARTERIA_AUTHORITY.md`: factual Core v0.2, accepted product ADR-003/004/005, active Portfolio Entry Logic Contract, accepted 114F Experience Contract v0.1, KAN-133 architecture and KAN-134 through KAN-138 boundaries. Jira KAN-139 authorizes frontend/UI 133E, including client DTOs, state machine, browser tests and this report. KAN-140 authorizes the merged backend stale snapshot correction. Home/Bootstrap consumer activation remains 133F and has no authority in this diff.

`CURRENT_STATE.md` and `STARTERIA_V2_MANIFEST.md` still describe full 114F as not implemented. The current UI stops at snapshot preparation. Their slice status is reconciled through the governed closure after merge, without declaring the complete 114F journey migrated here.

## V2_CHANGE_GUARDRAIL_CHECK

```text
Slice: Portfolio Entry 114F / 133E
Authority: Jira KAN-139 + accepted 114F Experience Contract + KAN-133 architecture
Manifest status: full 114F not yet implemented; UI 133E authorized
Current route: /public/start after claimed authenticated session, confirmed 114D and current 114E
Legacy dependencies: legacy continuation and conversion remain KEEP_COMPAT
Semantic owner: V2 for 114D/114E/114F; LEGACY_COMPAT for AuthenticatedProvisionalContinuationPage
Adapter: dedicated strict GET/POST 114F client, no legacy DTO reuse
Tests: focused DTO, UI, 114D/114E/legacy regression and browser cases
Authority conflict: prior stale loop resolved by merged KAN-140; no new conflict in 133E
Proceed: YES
```

## Frontend composition and boundaries

`PortfolioEntryExperience` mounts the dedicated `PortfolioSetupContinuityExperience` only for an authenticated, claimed session with current confirmed 114D and supported/bounded 114E Path. It reuses current Critical Handoff review, session CAS revision, and Path binding; it does not import or invoke the legacy provisional continuation page. The public 114F client validates strict GET and POST envelopes/DTOs. POST sends only `expectedSessionRevision`, current `sourceBinding`, optional server-listed `organizationId`, and the `Idempotency-Key` header. It sends no profile, grant, capability, carried context as authority, destination or owner override.

The UI represents LOADING_CONTEXT, READY_PROVISIONAL, READY_AUTHORIZED_SCOPE, SELECT_SCOPE, NO_AUTHORIZED_SCOPE, SCOPE_VALIDATION_FAILED, STALE_SOURCE, PROFILE_CONFLICT, BLOCKED_AUTHORITY, ERROR and CONTINUATION_READY. Zero scopes preserve own context without POST. One current scope needs no radio and omits `organizationId`. Multiple current scopes require accessible explicit selection and submit only a GET-listed organization. Technical resolver failure offers a retry and never claims that access is absent. A matching current snapshot with revoked scope remains NO_AUTHORIZED_SCOPE.

## KAN-140 recovery and source binding

KAN-140 changes only the 133B backend read semantics. A truly invalid or stale current 114D still returns STALE_SOURCE. A structurally valid, hash-valid persisted CURRENT snapshot from source A becomes non-effective when a valid confirmed 114D B is current. GET does not expose A's snapshot, scope, 114E binding, carried projection or next surface; it builds B's source binding and resolves current scopes. The stored A row remains CURRENT until 133D POST creates generation 2 and atomically supersedes generation 1.

133E uses the new GET binding. On binding change, it clears the old logical POST intent and scope selection. The next explicit continue action creates a new key and sends B's binding; a network retry with unchanged binding and selection reuses the key. Selecting another scope also creates a new key. A POST stale/conflict response refreshes GET and displays the recovered state when it is valid, with a review notice; it no longer forces STALE_SOURCE over a recovered GET. For a true stale GET, the UI offers 114D review, allows no POST and hides carried reading, Path contribution and open items while stale.

The browser fixture now separates two scenarios. TRUE SOURCE STALE starts with a current A 114D/114E render, then advances the mocked server session from revision/context 7/4 to 8/5 immediately before 114F GET. The old A handoff is genuinely stale against that session. GET returns STALE_SOURCE without a current binding; review reveals the stale 114D state, and no POST occurs. OLD SNAPSHOT A + CURRENT SOURCE B represents the post-KAN-140 GET: current 114D/114E B, B's reading and authorized scope, no old snapshot or old organization; POST sends B's binding, gets a generation 2 response and reaches CONTINUATION_READY without Home navigation.

The browser case is **HTTP fixture proof of frontend behavior**, not PostgreSQL integration. The **external merged backend evidence** is KAN-140's disposable PostgreSQL run: 11 integration tests, including source A -> generation 1 -> confirmed B -> GET ignores A -> POST generation 2 -> generation 1 SUPERSEDED, with no GET write or Project/Step/grant/Bootstrap creation. No new DB integration test is claimed for KAN-139.

## Success, isolation and accessibility

Successful POST shows only bounded continuity preparation, a safe organization label when returned, preservation of Entry work and future Portfolio intent. There is no navigation to `/portfolio/inicio`, no Portfolio Bootstrap or PortfolioLeadContext activation, and no `/portfolio/setup`, legacy query parameter, `/continue-portfolio` or `/convert` call in the 133E journey. Grant provisioning, Initiative exception, Project/Steps, Core and legacy retirement remain outside this slice. 133F owns actual Home handoff and consumer-side source/scope revalidation.

The UI has semantic headings, native radio controls inside a labelled fieldset, keyboard selection and visible focus, live loading/recovery status, named review/retry actions and textual errors. Playwright checked scope selection and stale recovery copy at 320, 375 and 390 px with no horizontal document overflow. This is not an automated WCAG audit. The deterministic Playwright journey supplies browser evidence while BrowserSkill is unavailable. The Jev case file was not extended with an unconditional 114F case because the runner has no claimed-session setup: such a case would be invalid in the global production suite, and its LLM execution is explicitly forbidden in this turn.

## Verification

| Check | Result |
|---|---|
| Frontend focused 114F + 114D/114E/legacy regression | PASS: 7 files, 119 tests |
| Full npm run test:front suite | PASS, exit 0; existing MSW/React warnings in output |
| Backend current-main read/write service tests | PASS: 2 files, 30 tests |
| `npm run typecheck:front` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; existing Vite bundle/dynamic import warnings |
| Deterministic KAN-139 Playwright | PASS: 12 cases, including true stale, recovered B and 320/375/390 px |
| `git diff --check` | PASS before final diff audit |
| PostgreSQL A -> B runtime | KAN-140 external merged evidence: 11 tests PASS; not rerun as KAN-139 browser proof |
| Live LLM | Not used |
| BrowserSkill (bsk) local manual browser | NO CORRIDO: bsk command unavailable in this environment |
| Jev regression | NO CORRIDO: user forbids LIVE LLM; runner requires Jev/OpenRouter and an authenticated claimed session fixture that it cannot provision |
| Read-only reviewer | APPROVED: round 2 at 5113b28, no blocking findings |

The first Playwright attempt could not bind port 55433, which was already occupied. The isolated rerun used 55434 and passed. One fixture assertion initially matched two current-B readings; it was scoped to the 114F region. The true-stale case then modeled a real session-context invalidation; review correctly returns to stale 114D. The final full run passed. Build emitted existing bundle size and mixed dynamic import warnings.

## Readiness and V2_CHANGE_CLOSURE_CHECK

```text
UI_114F_READY: YES
READ_BOUNDARY_UI_INTEGRATED: YES
WRITE_BOUNDARY_UI_INTEGRATED: YES
ZERO_ONE_MANY_UX_READY: YES
RECOVERY_STATES_READY: YES
STALE_SNAPSHOT_RECOVERY_UI_PROVEN: YES, HTTP fixture plus cited KAN-140 PostgreSQL evidence
TRUE_STALE_SOURCE_UI_PRESERVED: YES
FRESH_SOURCE_RESETS_IDEMPOTENCY: YES
IDEMPOTENT_RETRY_UX_READY: YES
LEGACY_UI_ISOLATION_PRESERVED: YES
NO_HOME_ACTIVATION_IN_133E: YES
ACCESSIBILITY_MOBILE_READY: YES, bounded checks; no WCAG audit
KAN_140_INTEGRATED: YES
NEXT_SLICE_READY: YES, 133F requires its own authority and implementation
HOME_HANDOFF_AUTHORIZED: NO
SAFE_TO_COMMIT: YES, after approved read-only review and final diff audit; no commit requested

V2 contract satisfied: YES for 133E UI, full 114F handoff pending 133F
V2 route active: /public/start for the guarded authenticated journey
V1 consumer remaining: YES, KEEP_COMPAT
Legacy compatibility documented: YES
E2E passed: YES, 12 deterministic fixtures
Manifest updated: NO, governed post-merge closure
Retirement action: KEEP_COMPAT
Migration status: PARTIAL, 133F pending
```