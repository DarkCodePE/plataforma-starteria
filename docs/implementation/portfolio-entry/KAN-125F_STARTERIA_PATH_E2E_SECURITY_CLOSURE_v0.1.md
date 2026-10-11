# KAN-125F — Starteria Path 114E E2E, security and closure v0.1

Status: local implementation verified on `feat/KAN-125-starteria-path-125F` from
`origin/main` `d52f86bc0605fedfec17b767397941e8eb9fca1b`. This document and
the status changes are pending integration. No production commercial activation
is authorized.

## 1. Scope and semantic freeze

125F adds bounded client analytics, deterministic browser coverage, focused
security/privacy tests and closure evidence. It preserves the accepted Path
projector, value bridge, capabilities, dependencies, first supported movement,
submission purpose, PII/consent schema, retention proposal, `VERIFIED_ACTIVE`
meaning, destination policy and 114D confirmation. It does not implement 114F,
Core or Steps changes or retire legacy compatibility.

## 2. Authority

The hierarchy is `docs/STARTERIA_AUTHORITY.md`; factual Core v0.2, accepted
product ADRs, active Portfolio Entry Logic Contract v0.1, frozen Critical
Reasoning Experience Contract v0.1, KAN-114, KAN-119, KAN-122 business
capability boundary, KAN-123 Starteria Path experience contract, KAN-124
Option C architecture, KAN-126 scoped adoption and KAN-127 conversion policy.
Jira KAN-120 and KAN-125 supply the parent and implementation criteria.
ADR-003 is still proposed and its 114F discrepancy remains open/deferred.

## 3. Integrated baseline and runtime audit

| Slice | Integrated evidence | Runtime seam |
| --- | --- | --- |
| 125A | [PR #180](https://github.com/DarkCodePE/plataforma-starteria/pull/180), `adb8104` | deterministic semantic projector |
| 125B | [PR #182](https://github.com/DarkCodePE/plataforma-starteria/pull/182), `1761c19` | owned, current, confirmed source GET |
| 125C | [PR #185](https://github.com/DarkCodePE/plataforma-starteria/pull/185), `848eda1` | 114E Path UI after 114D |
| 125D | [PR #187](https://github.com/DarkCodePE/plataforma-starteria/pull/187), `72782f6` | fail-closed conversion presentation |
| KAN-127 | [PR #189](https://github.com/DarkCodePE/plataforma-starteria/pull/189), `d184b80` | scoped submission policy authority |
| 125E | [PR #190](https://github.com/DarkCodePE/plataforma-starteria/pull/190), `d52f86b` | first-party form, submission, consent, migration |
| 125F | this local worktree; no PR/SHA yet | analytics, E2E, security regression and closure |

The integrated journey runs public Portfolio Entry → Critical Handoff generation
→ authentication/claim when required → review → explicit confirmation → owned
Starteria Path GET → Path UI → conversion presentation. Default config has
`destinations: []`, so the semantic Path remains visible but no commercial
action/form appears. A test-only endpoint in the deterministic E2E composition
selects `NONE`, `DEMO`, `EARLY_ACCESS` or `BOTH`; it never changes production
config. Verified fixture actions open the first-party form and post consent and
source/config bindings to the owned submission route. The service checks those
bindings under a transaction and returns a persisted receipt; a repeated
identical key replays it, while changed input conflicts.

## 4. Analytics implementation and privacy

The existing browser event convention dispatches the eight KAN-125 events:
`starteria_path_viewed`, `tangible_value_viewed`, `conversion_cta_viewed`,
`demo_clicked`, `early_access_clicked`, `context_share_opt_in`,
`context_share_declined`, `conversion_submitted`. Visibility events use
`IntersectionObserver` and a per-source/config dedupe key. CTA visibility is
limited to verified actions; click events mean action activation, not booking or
access. Decline fires once on explicit submission with sharing disabled;
conversion submission fires only after an accepted persisted receipt, not
notification delivery. Dispatch/provider exceptions are swallowed.

A positive allowlist admits only `destinationType`, `availabilityState`,
`experienceState`, `resultCategory`, `contextShared` and
`idempotentReplay`, with bounded values. Tests inspect emitted payloads and
exclude email, name, organization, decision text, raw conversation/Handoff,
Path, provenance, provider/model identifiers, idempotency keys, destination
URLs and error payloads. No new provider or server-side analytics store exists.
Under `NO_VERIFIED_DESTINATION`, only Path/tangible views can fire.

## 5. E2E matrix and results

The browser tests use route fixtures or the existing deterministic KAN-114
adapter, seeded sessions and a disposable PostgreSQL database. No live LLM,
calendar, SMTP or CRM is used.

| Matrix | Result and evidence |
| --- | --- |
| 114D → 114E, current confirmed, value bridge and tangible outcome | PASS: 6 CURRENT_114D full-stack Chromium cases, including Path after confirmation/reload; 125F route-fixture browser case |
| bounded/unsupported/unconfirmed/stale/invalid source, first movement present/absent | PASS: 125F browser cases and 125A/125B service tests |
| default no destination, no CTA/form/dead link/portfolio navigation or funnel events | PASS: 125F browser case; no writes or activation in full-stack 114D |
| Demo only, Early Access only, both; distinct copy/actions | PASS: three controlled browser fixtures |
| email required, optional name/organization, off-by-default consent, receipt only, no access | PASS: controlled browser tests; real PostgreSQL full-stack submission |
| explicit opt-in/reversal; persisted decision only | PASS: browser request assertions, real PostgreSQL full-stack and integration record assertions |
| stale source and destination change between view and submit | PASS: browser recovery and real PostgreSQL rejection/no-new-row checks |
| identical-key replay and changed-input conflict | PASS: PostgreSQL integration, one row/same receipt/no duplicate consent; service tests |
| analytics/provider dispatch failure | PASS: browser Path and accepted receipt remain usable |

The 125F controlled browser suite passed **17/17** after the final 503 and
accessibility assertions. The real 114E full-stack fixture passed **1/1**.
The existing 114D suite passed **6/6** and legacy suite **7/7**.

## 6. Security matrix

| Boundary | Evidence |
| --- | --- |
| anonymous/unclaimed/wrong owner/missing session | owned GET and POST route/service tests; missing and wrong owner masked consistently |
| stale/unconfirmed/invalid source and changed destination | service, route, PostgreSQL and browser rejection tests; no write |
| invalid purpose/body fields/oversized key | strict route schema tests; per-route write limiter test |
| unsafe URL/open redirect/secret config | 125D presentation tests require exact approved type-bound URL; first-party fixture has no redirect; default has no exposed secret |
| PII in logs | Pino redaction test covers auth, entry token, idempotency key and entire request body; notification/DB errors stay generic |
| provider/model metadata | Path DTO, submission record and analytics allowlist tests exclude it |

## 7. Privacy regression

Real PostgreSQL records contain contact fields, destination/purpose,
source/config binding, receipt state, and consent state only. With sharing off,
`sharedDecisionInView`, `consentedAt` and `consentScopeVersion` are null. With
explicit opt-in, only the shown `decisionInView` is stored. Tests reject or
exclude raw conversation, raw Critical Handoff, full Path, selected lenses,
reasoning/provenance internals, model/provider IDs, phone, role/title, notes
and unapproved profile data. Analytics payloads use the positive allowlist.

## 8. Legacy regression

Seven `LEGACY_COMPAT` Chromium journeys passed. Current 114E tests assert no
PilotLead write, `pilot-interest` call, legacy `starteria_path` or
`recommended_approach`/`recommended_cta`/`alternative_approaches`/
`suggestedRoute` dependency, `continue-portfolio` navigation or Portfolio
Setup route. Existing legacy behavior remains `KEEP_COMPAT`.

## 9. 114D regression

The six CURRENT_114D full-stack journeys cover deterministic generation,
review, claim/auth, confirmation, currentness and invalidation. Existing
backend and frontend suites also passed. 114E reads a confirmed source and
does not modify its confirmation; the stale-submit fixture verifies the
Critical Handoff confirmation and source revision remain unchanged.

## 10. Core, Steps and 114F isolation

The real submission fixture compares Organization, StrategicFront, Challenge,
Initiative and Step counts before and after accepted and rejected submissions;
all remain equal. PilotLead count remains equal. Browser requests and URL
assertions exclude `/portfolio/setup` and `continue-portfolio`. No Decision
canonicalization or Portfolio Setup continuity route is invoked.

## 11. Migration validation

Prisma validate/generate passed. All 52 migrations applied cleanly to a fresh
disposable `starteria_125f` PostgreSQL database; `migrate status` reported up
to date. The 125E SQL creates the conversion submission table, indexes,
foreign keys and constraints; it does not alter or drop PilotLead or Core
tables. The existing disposable E2E database also migrated/status-checked.

## 12. Failure and resilience

Service tests prove an injected DB create failure leaves zero rows, and an
injected notification failure leaves the accepted receipt/row intact.
Conversion config read failure closes the commercial presentation while Path
GET remains usable. Browser analytics/provider failure leaves Path and form
working without visible error. Browser API 503 displays an announced bounded
retry message, no fake receipt and no raw server payload. Retry uses a stable
idempotency key until the request changes.

## 13. Accessibility and responsive

Chromium mobile 390 px with long Path content has no horizontal overflow and
the verified action is keyboard activatable. The inline form focuses its
labeled email field, marks it required, exposes optional name/organization,
and returns focus to the action on cancel. Submission loading is a polite
status; retry errors use an alert, and stale/unavailable/receipt states use
status announcements. The browser 503 case checks bounded error text.

## 14. Performance and fetch audit

The confirmed 114D → 114E browser journey records a bounded Path GET after
confirmation and on reload, with no read loop. Route fixtures count Path
requests; analytics dispatch does not change rendering or trigger refetch.
Submission uses one POST per activation; idempotent replay is server-side.
Conversion presentation is included in Path GET, not fetched separately.

## 15. Commercial activation state

Production/default remains `NO_VERIFIED_DESTINATION`, with no real Demo or
Early Access action/form. Missing/disabled `STARTERIA_COMMERCIAL_OWNER` and
pending legal/retention approval continue to block commercial activation.
Fixtures are test-only. Demo is not booked, Early Access is not granted, and
receipt does not imply email delivery or follow-up.

## 16. Unresolved operational and legal blockers

No production commercial owner/destination is verified. Retention and legal
approval for production PII operations is pending. ADR-003 is unresolved and
deferred to 114F; this slice does not decide it or start 114F.

## 17. Final 114E status

`IMPLEMENTED_VERIFIED` applies to locally verified 114E runtime semantics
after the listed gates pass. Commercial activation separately remains
`DISABLED / NO_VERIFIED_DESTINATION`. `V2_MIGRATED` is withheld: Guardrails §17
requires no open authority conflict, and ADR-003 remains open/deferred for
114F. Legacy compatibility remains explicit.

## 18. Evidence links, PRs and merge SHAs

The 125A–125E/KAN-127 PRs and merge SHAs are listed in §3. 125F evidence is
this uncommitted branch, its deterministic E2E and PostgreSQL test results,
and a read-only review verdict of `approved` (round 1, base `d52f86b`). No
125F PR or merge SHA exists yet by user instruction.

## 19. Closure decision and validation record

The 114E runtime implementation is locally verified and reviewable. KAN-125F
has no commit, push or PR by request; Jira KAN-125/KAN-120 must not be
transitioned until this evidence is integrated and the responsible person
accepts closure. Production commercial activation is a separate decision.

- Focused 125A–125E backend tests: 140 passing; focused 125F frontend tests:
  30 passing after the final deduplication case. Full frontend and backend
  Vitest suites exited 0 before that last focused case. Database integration
  suites are opt-in and were run
  separately against disposable PostgreSQL.
- PostgreSQL conversion integration: 3 passing. Deterministic Chromium:
  CURRENT_114D 6, CURRENT_114E 1, LEGACY_COMPAT 7, 125F fixture 17.
- Prisma validate/generate, fresh migrate deploy/status, frontend/backend
  typecheck, lint, build and `git diff --check`: PASS. The build reports its
  existing chunk-size/dynamic-import warnings without failing.

```text
V2_CHANGE_CLOSURE_CHECK
V2 contract satisfied: YES, bounded 114E
V2 route active: YES, current Path read/UI route; commercial actions test-only
V1 consumer remaining: YES, documented LEGACY_COMPAT
Legacy compatibility documented: YES, KEEP_COMPAT
E2E passed: YES, deterministic browser and PostgreSQL fixtures
Manifest updated: YES, in this local 125F worktree
Retirement action: KEEP_COMPAT
Migration status: PARTIAL (IMPLEMENTED_VERIFIED for 114E runtime; not V2_MIGRATED)
```
