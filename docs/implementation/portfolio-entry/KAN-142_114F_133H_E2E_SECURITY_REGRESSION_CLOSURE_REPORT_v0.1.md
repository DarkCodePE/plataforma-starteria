# KAN-142 — 114F / 133H E2E, security and regression closure

**Date:** 2026-10-12. **Base:** `origin/main` `057b5f4bb1582dbc4d735e9f609d2cb5db87f50d`. **Branch:** `feat/KAN-142-114f-e2e-security-closure`. This report is verification evidence for the Portfolio-first 114F path, not a new product rule or a claim that all Starteria is V2 migrated. No LIVE LLM, production fixture, product service change, schema change, commit, push or PR is part of KAN-142.

## Authority and scope

The governing order is factual Core v0.2 (`Base fundacional revisada / Por validar`), accepted product ADR-003/004/005, approved Portfolio Entry Logic v0.1 and accepted 114D/114E/114F experience authority, then KAN-133 architecture and KAN-134–141 implementation evidence. Core v0.3, Bootstrap/Home candidate contracts, the old proposed Post-Entry contract and code behavior were not promoted. Jira KAN-142 authorizes 133H verification; 133E/133F are merged. 133G is needed only for a positive Initiative exception and remains outside this path.

The evaluated path is actual 114D confirmation → current 114E → 114F GET/scope/POST → durable CURRENT snapshot → explicit continuation → governed Home GET → exact-scope Bootstrap create/reuse. The legacy `portfolioEntryContinuationId`, `home-context`, `from-continuation` and `/portfolio/setup` consumers keep their own namespace and semantics.

## Baseline and evidence classes

| Class | Evidence | Limit |
|---|---|---|
| LOCAL | Both typechecks, lint, both builds, backend 1,565 passed / 113 normally skipped, frontend 897 passed | Executed on the KAN-142 worktree; not a deployment result. |
| INTEGRATION_DB | Disposable PostgreSQL on port 56544, 53 migrations current, 8 files / 74 tests passed; added Bootstrap revoked-write check passed again | Uses fixtures and actual Prisma/service boundaries. |
| BROWSER + DB | New `[114F_133H]` Playwright test passed on real frontend/backend/PostgreSQL with deterministic KAN-114 adapter; prior 141 full-stack test also passed | No live model. The new test performs actual 114D confirmation rather than inserting a confirmed artifact. |
| BROWSER fixtures | Critical Handoff 13/13, CURRENT_114D + LEGACY_COMPAT 13/13 in full-stack mode, 114E/133E/133F 39/39 | HTTP fixture tests prove UI sequencing/recovery; server denials are independently covered by PostgreSQL tests. |
| CI | [PR #206](https://github.com/DarkCodePE/plataforma-starteria/pull/206) merged at expected SHA; all six recorded CI checks succeeded, including E2E light and migration guard | CI covers the merged 133F baseline, not this uncommitted KAN-142 diff. |
| DEPLOYMENT | [CD #131](https://github.com/DarkCodePE/plataforma-starteria/actions/runs/38239861828) `SUCCESS`, head SHA `057b5f4...` | Successful rollout workflow, not production journey proof. |
| PRODUCTION_SMOKE | Read-only `GET https://starter-ia.com/api/health` returned HTTP 200, `status: ok` on 2026-10-12 | Health endpoint does not exercise tenant, 114F or Bootstrap data. |

The first combined Critical Handoff run failed 13 fixture cases because its old session DTO omitted the now-required server-owned `handoffExperience` discriminator and its legacy handoff reader returned no fixture. This was a test fixture defect: the captured UI showed the safe “no reading experience” state. Only the fixture was updated; no expectation or runtime code was relaxed. The dedicated suite then passed 13/13. Initial build/Vitest attempts hit Windows sandbox `EPERM` on the shared `node_modules` cache; reruns with writable execution passed. Initial E2E port 55433 was occupied; isolated port 56543 passed.

## KAN-133 §19 evidence matrix

`PASS` means the named layers ran in this session. Browser fixture evidence and PostgreSQL authorization evidence are distinguished; they are not presented as the same test.

| Case | Result | Executed evidence |
|---|---|---|
| 1. Owned, valid source, zero scopes | PASS | 133B PostgreSQL zero-scope read; 133D no-scope/no-row; 133E browser provisional/no POST. |
| 2. Exactly one scope | PASS | 133B PostgreSQL one scope; new browser/DB golden path writes one exact-scope snapshot. |
| 3. Multiple scopes/injection | PASS | 133B PostgreSQL many scopes/injected ID; 133D PostgreSQL explicit selection/rejection; 133E browser selection. |
| 4. Revocation after GET/POST/at Home/Bootstrap | PASS | 133B/133D PostgreSQL revoked grants and CAS; 133F PostgreSQL Home/create/reuse/read/action; new real browser/DB test revokes grant after Bootstrap creation and denies Home before recovery. |
| 5. Wrong owner | PASS | 133B/133D owner masking, 133F PostgreSQL Home 404, 133F browser wrong-user denial; Bootstrap ownership regression suite. |
| 6. Stale source and recovery | PASS | KAN-140 133B/133D PostgreSQL A→B regeneration; 133F PostgreSQL stale Home/Bootstrap; new real browser/DB test changes `contextRevision` and denies Home. An explicitly supplied old Home snapshot ID remains invalid. |
| 7. Unsupported 114D/Path/DTO version | PASS | 133B unit, 133D PostgreSQL version gates, 114E browser invalid/stale Path, client strict DTO tests; no legacy continuation route invoked. |
| 8. Missing/unsupported/Initiative profile | PASS | KAN-138 profile establishment and historical no-backfill tests; 133B unit `PROFILE_CONFLICT`/`BLOCKED_AUTHORITY`; 133D PostgreSQL; new real browser/DB profile-version denial. |
| 9. Valid Portfolio path | PASS | New actual-confirmation browser → API → DB 114D→114E→114F→Home→Bootstrap; 114F GET asserts version, current source and exact authorized scope before POST; CURRENT snapshot count 1 and exact source/scope/Bootstrap binding. |
| 10. No Project/Steps/canonical writes | PASS | New golden test compares Organization, Project, Step, OrganizationMember, grant, StrategicFront, Challenge, Decision, Initiative metadata, Assignment and Invitation counts after fixture setup, after successful Home/Bootstrap and after adversarial denials; 133D/133F DB tests also assert bounded writes. |
| 11. Legacy compatibility | PASS | LEGACY_COMPAT 7 browser cases, legacy PostgreSQL conversion/Home/Bootstrap integration, 133F browser legacy identity and ordinary Home. |
| 12. No fallback | PASS | New real browser request audit excludes `/convert`, `/portfolio/setup`, legacy `home-context`, Projects and tenant preload; 133E/133F denied browser fixtures show no Bootstrap/fallback. |
| 13. Initiative without authority | PASS | 133B unit `BLOCKED_AUTHORITY`, 133D profile refusal; no 133G route or Assignment/Invitation/Project/Step side effect in golden counts. |
| 14. Positive Initiative exception | BLOCKED_BY_AUTHORITY / NOT_APPLICABLE | No accepted target-scoped issuer policy, governed profile transition, Entry→Assignment/provisioning evidence or complete explicit Initiative routing authority. No positive fixture was fabricated. |
| 15. Home exact scope/context | PASS | 133F PostgreSQL exact organization, 404/403/409 denials and allowlist; 133F browser no global-only bypass. |
| 16. Idempotent retry/conflict | PASS | 133D PostgreSQL same key/material returns ID after revalidation; changed material conflicts; revoked scope rejects replay. |
| 17. Concurrency | PASS | 133D PostgreSQL serializes identical writes, session CAS races and correction/revoke before waiting POST. |
| 18. Tenant isolation | PASS | 133B/133D PostgreSQL other-tenant and injected scope, 133F PostgreSQL other owner/organization; global permission cannot replace exact B. |
| 19. Browser recovery | PASS | 133E 12 browser states including zero/many/503/stale/mobile; 133F 10 browser states including revoked/stale/wrong/global/mobile and preload; new real browser mutation/recovery sequence. |
| 20. 114D/114E regression | PASS | CURRENT_114D full-stack 6 cases; Critical Handoff 13 fixture cases; 114E Starteria Path 17 fixture cases; commercial destination remains separate. |

## Security, tenant isolation and currentness

| Boundary | Result and evidence |
|---|---|
| Authentication, ownership, unclaimed session | PASS: 133B/133D unit and DB masking; wrong-owner Home 404; existing Bootstrap owner tests. Anonymous and unclaimed cannot progress. |
| Exact tenant B | PASS: membership **and** exact `portfolio:read` grant required. PostgreSQL rejects injected org B, write-only/global-only substitutes and removed member/read grant. Browser Home denies global-only. |
| Source/versions/profile | PASS: 133B GET, 133D POST, Home GET, Bootstrap create/reuse and subsequent `getSession`/`updateAnchor` repeat validation. New real browser test mutates source/profile and denies Home; DB test verifies revoked Bootstrap write leaves anchor unchanged. |
| Snapshot integrity | PASS: invalid/legacy format, malformed carried projection, broken binding hash and SUPERSEDED ID fail at consumer. KAN-140 ignores only a structurally valid old stored row while recovering at Entry; explicit old Home ID remains rejected. |
| Idempotency/replay | PASS: DB retry returns the same logical snapshot only after fresh source/scope/profile validation; material mismatch 409, revoked/stale replay rejected, CAS and transaction rollback covered. |
| Tenant preload | PASS: browser request audit shows no strategic-fronts, challenges, initiatives, `/projects`, normal Home hydration or Bootstrap POST before successful 114F Home gate. Ordinary Home loading resumes after leaving the 114F route. |
| Fallback | PASS: no 114F denial calls `/convert`, pilot claim, `/portfolio/setup`, legacy Path, Project or Step 0. Legacy continues only through its explicit identity. |

## Provenance and canonical side effects

The 114F carried projection retains `origin`, `truthClass` and `sourceRef`; `AI_SUGGESTED` remains suggested, `PROVISIONAL_USER_CONTEXT` remains provisional, and `CONFIRMED_REPRESENTATION` records a user-confirmed representation, not validated company truth. The Bootstrap derivation carries `openItems`, sets `reviewRequired: true`, and creates an `anchor_provisional` with unknown business signal. This is covered by the 133F anchor derivation test, DTO tests and the browser/DB golden path. No automatic StrategicFront, Challenge, Initiative/Project, Step, membership, grant, Assignment, Invitation, Accept or Start is observed. Only 114F snapshot and Bootstrap-owned session/anchor/audit state is expected. Canonical counts are measured after explicit fixture setup and remain identical through the golden path and subsequent consumer denials.

## Adversarial E2E disposition

The new real browser/DB test exercises revocation after successful POST/Bootstrap, member removal, corrupt binding hash, supersession, profile version conflict and changed context revision. The existing browser fixtures exercise zero/many scopes, resolver 503, wrong owner, global-only permission and no preload. PostgreSQL integration independently exercises unlisted tenant scope, GET→POST revocation/CAS, cross-tenant source, wrong-owner snapshot, unsupported source/Path, Bootstrap reuse/read/action after revoke and old idempotency replay. All denials failed closed in the executed layers. **Coverage limit:** these attacks are distributed across browser fixtures and real PostgreSQL tests; a single browser/DB test does not run each attack. The golden path and six consumer mutations do run against real browser/DB. The complete scenario mapping is the §19 table above and the named test files below.

## Regression files executed

- `portfolio-entry-conversion.integration.test.ts`, `portfolio-entry-context-establishment.test.ts`, `portfolio-home-entry-context.integration.test.ts`, `portfolio-bootstrap.integration.test.ts`, `portfolio-bootstrap.scoped-authority.test.ts`, `legacy-route-quarantine.test.ts`: PASS in backend full suite and/or the explicit 8-file PostgreSQL batch.
- 133A–133F focused tests: read/write/data-contract/Home integration in the 74-test DB batch; unit/component tests in both full suites; 133E/133F browser 22 cases.
- `portfolio-entry-conversion.spec.ts`: CURRENT_114D 6, LEGACY_COMPAT 7, new 133H 1 real full-stack; `critical-handoff-review.spec.ts`: 13; `starteria-path-125f.spec.ts`: 17. All PASS on final runs.

## Jev regression cases and production limit

`JEV_REGRESSION_STATUS: NO_CHANGE_NEEDED`. The existing JSON schema admits static navigation `start`, natural-language `goal`, fixed `expect` and optional text; the runner is navigation-only, uses a logged-in personal Chrome plus model-backed Jev, and cannot deterministically create/claim/confirm a session, issue scoped grants or carry a dynamic 114F snapshot ID. Adding a static `/portfolio/inicio` case would test ordinary Home, not the governed 114F journey. The deterministic Playwright cases above are the correct executable regression for this boundary. Jev was not run: it requires LIVE model credentials and a production session fixture, excluded by KAN-142. No production business fixture was seeded.

## Governance reconciliation and 133G

`CURRENT_STATE.md` and only directly related Manifest text now record **Portfolio-first 114F `IMPLEMENTED_VERIFIED`** with `migration_status: PARTIAL`. This status refers to the locally verified 114F route on the deployed PR #206 baseline; it does not certify all Starteria, a production 114F E2E, Core v0.3, retirement of legacy, or Initiative exception. The Manifest evidence uses its `VERIFIED` vocabulary with a bounded `E2E_SECURITY_REGRESSION_VERIFIED` note. The accepted 114F contract remains frozen: its historical Current State/Manifest `NOT_IMPLEMENTED` sentence describes the pre-implementation acceptance stage. No factual addendum is needed because Current State, Manifest and this report carry lifecycle status without changing semantic contract text.

133G Initiative exception is `DEFERRED / BLOCKED_BY_EXTERNAL_AUTHORITY`: target-scoped issuer policy, governed profile transition, Assignment/provisioning evidence and full explicit Initiative routing authority are missing. This does not block Portfolio-first closure; Case 14 is deliberately not executed.

## Closure checks, limitations and KAN-128 recommendation

`V2_CHANGE_CLOSURE_CHECK`: V2 contract satisfied for Portfolio-first = YES; V2 route active = YES; V1 consumers remaining = YES (`KEEP_COMPAT`); legacy compatibility documented/tested = YES; E2E passed = YES; Manifest updated = YES; retirement action = KEEP_COMPAT; migration = PARTIAL.

The designated read-only reviewer requested three test-evidence corrections in round 1: assert the 114F GET response, include `/api/v1/portfolio/home` in the pre-gate request audit, and recheck canonical counts after adversarial denials. All three were added; the real browser/DB test and final typecheck/lint/diff check passed again. Round 2 verdict: `approved`, no remaining finding.

Known limits: production smoke is health-only; the uncommitted KAN-142 diff is not yet CI-tested, merged or deployed; BrowserSkill manual inspection and model-backed Jev were not run; the positive 133G exception has no authority. The explicitly required local suites and deterministic Playwright/PostgreSQL evidence above pass. Recommend KAN-128 for human closure **after** human-approved KAN-142 merge and post-deploy verification; do not move Jira state automatically.
