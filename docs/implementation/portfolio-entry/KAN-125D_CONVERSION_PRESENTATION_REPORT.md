# KAN-125D — Conversion configuration and presentation

Status: local implementation evidence, uncommitted and not integrated. This report
does not promote authority, activate a destination or certify production.
Base: `848eda179494f5a8b9b05c837d5cbc5d9c021f54`, branch
`feat/KAN-125-starteria-path`. No commit, push, PR or migration is authorized.

## Authority and precondition

Jira KAN-125 explicitly defines 125D after integrated 125A (PR #180), 125B
(PR #182) and 125C (PR #185). KAN-126 adoption is integrated in PR #181.
Authority follows `docs/STARTERIA_AUTHORITY.md`: factual Core v0.2 (its own
status remains “Base fundacional revisada / Por validar”), accepted product
ADRs including ADR-005/006, active Portfolio Entry Logic v0.1, frozen Critical
Reasoning v0.1, KAN-114 semantic acceptance, KAN-119 closure, scoped Business
Capability Boundary, frozen Starteria Path Experience §§11–13, KAN-124 §11,
KAN-126 and Jira KAN-125. The explicit task limits this work to 125D.

KAN-114 remains the sole business-reasoning source. Path remains DERIVED.
Commercial availability is a PRODUCT/CONFIG FACT. Conversion is neither
product continuation nor product access. 114F, Core and Steps remain excluded.

```text
CONFLICT
Contract: Jira KAN-125 implementation sequence and scoped KAN-126 adoption
Requirement: account for integrated 125B/125C before implementing authorized 125D
Current document/code: CURRENT_STATE/Manifest retained the 125A adoption snapshot
Observed mismatch: indices said no API/UI although PR #182/#185 are integrated
Risk: interpreting historical scope as the current implementation boundary
Recommended treatment: UPDATE operational indices with Git evidence and explicit 125D scope
Requires ADR: no
```

The indices are updated with scoped facts, not full 114E completion. The
pre-existing ADR-003 discrepancy remains OPEN / DEFERRED to 114F.

## Current conversion audit

| Element | Classification | Finding / treatment |
|---|---|---|
| `front/src/app/config/publicLanding.ts`, `VITE_DEMO_BOOKING_URL` | UNVERIFIED | Env or fallback Calendly URL; no explicit operational verification. Not consumed by 125D. |
| `LandingPage.tsx` demo links/labels | OUT_OF_SCOPE | “Reservar demo”, “Verlo con el equipo de Starteria”, “Agendar una demo”; external links do not prove availability. Unchanged. |
| `/auth/continue/:draftId`, `ContinuePilotPage`, `publicPilotLeadService` | LEGACY | Draft/pilot-interest semantics, PII/contact consent, proposal snapshot and local cache. Not 114E Early Access. |
| `/api/v1/public/pilot-leads`, claim/consume routes, `PilotLead` | LEGACY | Durable lead and draft/initiative continuation model; no 114D source-bound conversion contract. KEEP_COMPAT, untouched. |
| `PILOT_LEAD_NOTIFY_FROM/TO`, SMTP config and k8s notification config | OUT_OF_SCOPE | Notification transport for legacy lead data; not availability evidence. No secret values read or exposed. |
| First-party Early Access or demo-request route | UNVERIFIED | No separately verified 114E receiving flow exists. Internal destinations remain unsupported, including existing legacy routes. |
| Destination verification convention | UNVERIFIED | No runtime verified commercial config found before 125D. KAN-124 requires explicit facts plus HTTPS/approved host and path. |
| `backend/config/index.ts` | ADAPT | Existing server configuration entrypoint now owns a dedicated conversion facts source. |
| 125A projector / 125B ownership/source gates | KEEP | No semantic change. Configuration is read independently, after source eligibility. |
| Strict DTO and 125C value UI | ADAPT | Versioned commercial presentation and peer actions after all existing value sections. |

No deployed environment or receiving destination is claimed operational. No new
environment variables are introduced, so `.env.example`, k8s and CI need no
new values or secrets. Landing config is not copied into the server source.

## Configuration and verification

The source is `backend/config/starteria-path-conversion.ts`, exposed through
`config.starteriaPathConversion`. It is a deployment-owned, versioned facts
file, with both destination arrays empty by default. Activation requires a
reviewed config change and deployment; 125D does not provide an admin endpoint.

Bounded config contains:

- `version`: positive safe integer, incremented when destinations or verified behavior change;
- `approvedExternalDestinations`: at most two exact `{ type, href }` approvals;
- `destinations`: at most two entries with `type` (DEMO/EARLY_ACCESS), `status`
  (UNVERIFIED/DISABLED/VERIFIED_ACTIVE), `destinationKind` (EXTERNAL), optional
  `href`, and `contextSharingSupported: false`.

Before adding `VERIFIED_ACTIVE`, the product owner must verify receiving-flow
operation, audience/availability and that its actual next interaction matches
the fixed disclosure. A URL in the allowlist alone is insufficient; both an
explicit verified/active entry and exact type-bound approval must match. Do not
copy the synthetic URLs from tests into production. No production destination
is added by this change. No automatic network probe establishes verification.

No internal commercial flow is evidenced, so internal routes fail closed.
Context sharing is false until separately implemented and authorized; this
slice does not offer a checkbox, collect context or persist consent.

## Normalization, API and DTO versions

`readConversionPresentation` takes only a zero-argument server config reader.
It accepts no session, reasoning, selected capabilities, user input or initiative
context. Invalid/unverified/disabled destinations cannot emit a URL. Duplicate
types or invalid top-level config fail closed. Reader exceptions return an
empty presentation with a null config version, without exposing the error.

| Verified facts | Public availability | Destinations |
|---|---|---|
| None | NO_VERIFIED_DESTINATION | Empty tuple |
| Demo | DEMO_ONLY | Demo only |
| Early Access | EARLY_ACCESS_ONLY | Early Access only |
| Both | EARLY_ACCESS_AND_DEMO | Demo, Early Access as peers |

Only SUPPORTED/BOUNDED read DTOs include `conversionPresentation`:
`availability`, `conversionConfigVersion`, `destinations`. Each destination
contains `type`, `status: VERIFIED_ACTIVE`, fixed `label`,
`destinationKind: EXTERNAL`, verified `href`, `contextSharingSupported: false`
and bounded `availabilityDisclosure`. No submission/consent status, intent ID,
PII, credentials, internal config keys, allowlist or routing metadata is public.

The transport version is explicitly `starteria-path-dto-v0.2` in `versions`
and `sourceBinding`. The domain schema, projection and capability boundary
versions remain unchanged. Backend and frontend Zod contracts are independently
strict. Discriminated unions with bounded tuples reject contradictory state/action
combinations, duplicates, missing fields and extra nested data. Old v0.1 clients
fail safely instead of accepting v0.2 permissively; deploy front/back together.
Unavailable Path states still contain no commercial presentation.

## UI, safe default and security

The order is confirmed 114D, Path value, tangible outcome, dependencies/first
movement, boundary and then commercial presentation. Both destinations use the
same outline-link treatment; no hierarchy is inferred. Labels are fixed:
“Solicitar una demo” and “Solicitar acceso anticipado”. Each disclosure explains
the external request and avoids booking completion or immediate product access.
NO_VERIFIED_DESTINATION renders no CTA, disabled button or email substitute.

URLs must be HTTPS, canonical, exact type-bound approved host/path targets.
The policy rejects credentials, ports, query strings, fragments, encoded or dot
paths, protocol-relative URLs, javascript/data schemes, local/IP and reserved
placeholder hosts. No URL is assembled from Portfolio Entry content or request
parameters. Links use `_blank`, `noopener noreferrer` and `no-referrer`.
Clicking only navigates; there are no submission/analytics handlers or storage
writes. This code cannot certify the future behavior of an external operator;
that belongs to product-owned destination verification.

Commercial config failure retains the same semantic Path and suppresses CTAs.
125A remains unchanged; legacy Landing, PilotLead, conversion and continuation
consumers remain untouched and semantically isolated.

## Evidence and closure

Before implementation: projector/service baseline 41/41 PASS; new behavior tests
failed as expected (5 backend presentation assertions, 3 UI action assertions).
Focused post-change tests cover all four states, missing config/status, disabled
destinations, unsafe URLs and allowlists, source independence, config exceptions,
strict DTO versioning, unavailable states, value-before-CTA, external attributes,
no submission/context/consent writes and legacy isolation.

Validation from `front/`:

| Check | Result |
|---|---|
| Focused config / Path service / read API | PASS: 37 + 25 + 38 = 100 tests; rerun after review correction |
| Focused Path UI / frontend DTO | PASS: 17 + 6 = 23 tests |
| `npm run test:backend` | PASS, exit 0 before the duplicate-config review correction; affected config/service/API suites rerun afterwards; existing DB-gated tests skipped |
| `npm run test:front` | PASS, exit 0; full suite including 125C service/experience, 114D and legacy regressions |
| `npm run typecheck:backend` | PASS, exit 0 |
| `npm run typecheck:front` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `npm run build` | PASS, exit 0; bundle-size and mixed dynamic/static import warnings |
| `git diff --check` | PASS |

Full frontend output includes act/MSW warnings in tests outside this diff;
backend output includes expected simulated-error logs. Neither suite failed.
No skips were added by 125D.

Test matrix trace:

| Requested cases | Evidence |
|---|---|
| 1–6, 23: defaults, four states, verification and URL validation | `conversion-presentation.service.test.ts` |
| 7–9: config failure and reasoning independence | `starteria-path.service.test.ts`, `portfolio-entry.router.test.ts` |
| 10–16, 24: CTA types, no CTA default, value order, no product continuation, external attributes | `StarteriaPathExperience.test.tsx` |
| 17–20: no submit/consent/intent writes or PilotLead reuse | UI click transport/storage spies; API GET snapshot/POST 404; strict DTO rejection; diff/import review |
| 21–22: strict backend/frontend DTO and versioning | config/service tests, `starteriaPath.types.test.ts` |
| 25: unchanged unavailable states | existing 125C experience tests and frontend DTO unavailable-state matrix |

Read-only `revisor-starteria` review: round 1 `changes_required` for an active
and disabled duplicate type being filtered before uniqueness validation. Two
new failing tests reproduced the problem; uniqueness now precedes filtering.
Round 2: `approved`, no findings. The reviewer independently reproduced the
correct fail-closed result. Backend typecheck and lint subsequently passed again.
Browser E2E is intentionally deferred per the explicit task. No Prisma change,
DB integration, live provider call or deployed-destination test is part of 125D.

125E is not cleared for implementation by this report: no receiving flow is
verified, and durable commercial retention/ownership and the exact submission
consent purpose/scope still require their own decisions and authorized task.

```text
SERVER_OWNED_CONFIG: PASS
EXPLICIT_VERIFICATION: PASS
SAFE_DEFAULT: PASS
FOUR_AVAILABILITY_STATES: PASS
REASONING_INDEPENDENCE: PASS
VALUE_BEFORE_CTA: PASS
NO_FAKE_DESTINATION: PASS
NO_PRODUCT_ACCESS_IMPLICATION: PASS
NO_SUBMISSION: PASS
NO_CONSENT_PERSISTENCE: PASS
NO_LEGACY_SEMANTIC_REUSE: PASS
NO_114F: PASS
NO_CORE_STEPS: PASS
SECURITY: PASS
TESTS: PASS
TYPECHECK: PASS
SAFE_TO_COMMIT: YES (not performed; user explicitly prohibited it)
SAFE_TO_CONTINUE_125E: NO (receiving-flow and commercial write gates remain)

V2_CHANGE_CLOSURE_CHECK
V2 contract satisfied: YES, bounded 125D configuration/presentation
V2 route active: existing 125B read route; 125D changes local, not deployed
V1 consumer remaining: Landing/PilotLead/legacy conversion remain unchanged
Legacy compatibility documented: YES, audit above; KEEP_COMPAT
E2E passed: NOT_RUN, explicitly deferred by user
Manifest updated: YES; local state distinguished from integrated evidence
Retirement action: KEEP_COMPAT
Migration status: PARTIAL; not V2_MIGRATED or full 114E completion
Session handoff: ready for human review; independent reviewer approved
Next step: review the uncommitted 125D diff; activate no destination without verified facts
```

## Changed files

20 files total: 10 backend, 7 frontend and 3 documentation files.

- `backend/config/index.ts`
- `backend/config/starteria-path-conversion.ts` (new)
- `backend/modules/portfolio-entry-starteria-path/application/conversion-presentation.service.ts` (new)
- `backend/modules/portfolio-entry-starteria-path/application/starteria-path.service.ts`
- `backend/modules/portfolio-entry-starteria-path/presentation/conversion-presentation.dto.ts` (new)
- `backend/modules/portfolio-entry-starteria-path/presentation/starteria-path.dto.ts`
- `backend/modules/portfolio-entry-starteria-path/__tests__/conversion-presentation.service.test.ts` (new)
- `backend/modules/portfolio-entry-starteria-path/__tests__/starteria-path.service.test.ts`
- `backend/modules/portfolio-entry/portfolio-entry.router.ts`
- `backend/modules/portfolio-entry/__tests__/portfolio-entry.router.test.ts`
- `front/src/features/portfolio-entry/public/conversionPresentation.types.ts` (new)
- `front/src/features/portfolio-entry/public/starteriaPath.types.ts`
- `front/src/features/portfolio-entry/public/StarteriaPathExperience.tsx`
- `front/src/features/portfolio-entry/public/__tests__/starteriaPath.types.test.ts` (new)
- `front/src/features/portfolio-entry/public/__tests__/StarteriaPathExperience.test.tsx`
- `front/src/features/portfolio-entry/public/__tests__/portfolioEntryPublicService.test.ts`
- `front/src/features/portfolio-entry/public/__tests__/PortfolioEntryExperience.test.tsx`
- `CURRENT_STATE.md`
- `STARTERIA_V2_MANIFEST.md`
- `docs/implementation/portfolio-entry/KAN-125D_CONVERSION_PRESENTATION_REPORT.md` (new)
