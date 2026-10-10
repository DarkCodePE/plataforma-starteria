# KAN-121 — Starteria Path legacy, continuity and public conversion audit v0.1

**Audit type:** source and contract audit; no implementation
**Baseline:** `origin/main` = `7a9cd5b5e6f15e0e4b1e66cd252caa97d8c4d2e0`
**Branch:** `audit/KAN-121-starteria-path-runtime`
**Jira:** KAN-120 parent; KAN-121 audit subtask
**Browser evidence:** `SOURCE_AUDITED / NOT_RUNTIME_REPRODUCED` where an observation requires a browser or third-party destination.

## 1. Authority and scope

### Authority checked

The requested order was reviewed:

1. `docs/STARTERIA_AUTHORITY.md` identifies Core v0.2 as the factual Core authority, ADRs as the next authority tier, and `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` as the active Portfolio Entry Logic Contract.
2. `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md` remains **Base fundacional revisada / Por validar**. The candidate Core v0.3 does not replace it.
3. Product ADR status is read from `doc/product-adr/ADR-INDEX.md`. Relevant accepted decisions include ADR-002, ADR-004 (design only), ADR-005 (design only), ADR-006 and ADR-007. ADR-001 remains proposed. ADR-003 has an unresolved repository-state discrepancy: its ADR and index say accepted while `CURRENT_STATE.md` says proposed and `OPEN / DEFERRED`. This audit does not reconcile ADR-003.
4. The active Portfolio Entry Logic Contract is v0.1. It contains an existing open conflict where §22 references outputs delegated to the unpromoted Clarification/Handoff v0.2.1 candidate. That candidate and the related Agent/Harness documents are treated here as evidence only.
5. `PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md` is frozen for planning, subordinate to Core v0.2 and accepted ADRs; it authorizes no runtime changes. It explicitly says its freeze does not adopt candidate `recommended_approach` or `starteria_path` semantics.
6. KAN-114 semantic acceptance is `PASS_WITH_NON_BLOCKING_GAPS`; KAN-114 reasoning remains the accepted semantic source.
7. KAN-119 closure says `IMPLEMENTED_VERIFIED` and `INTEGRATED_IN_GOVERNED_BASELINE`; merge SHA `82ab8710b6e5a8e35514c70529ef8b5621e4c4eb` is an ancestor of the audited `origin/main` baseline. The closure explicitly excludes 114E, 114F and ADR-003 reconciliation.
8. `CURRENT_STATE.md` records that KAN-119/114D is integrated, KAN-114 remains the sole reasoning source, 114E is not started, 114F is not authorized, and ADR-003 remains open/deferred.
9. `STARTERIA_V2_MANIFEST.md` records 114D as integrated, legacy handoff consumers as `KEEP_COMPAT`, and 114E as `NOT_STARTED` pending its own scope.
10. Jira KAN-120 and KAN-121 were read. KAN-120 freezes D1–D14 below; KAN-121 requests this runtime audit.

### Frozen decisions retained without amendment

This audit treats KAN-120 decisions as immutable inputs:

- D1 no new LLM; D2 current and confirmed Critical Handoff only; D3 capability/value projection rather than strategy or plan.
- D4 end at `continuation_intent`; organizational destination belongs to 114F; D5 legacy `PortfolioEntryHandoff.starteria_path` is not 114E Starteria Path.
- D6 tangible value explicit; D7 immediate action contextual; D8 value is observable user capability/state change, not a business guarantee.
- D9 while platform access is closed, public 114E does not enter 114F; D10 public continuation today is Early Access/Demo conversion; D11 CTA contextual; D12 value before data request.
- D13 sharing Portfolio Entry context requires explicit consent; D14 claims must fit a future Business Capability Boundary.

No Core, Steps, Prisma, runtime, tests, routes, persistence, CI/CD, Manifest or `CURRENT_STATE.md` changes are in scope. The audit does not authorize 114E implementation or 114F. ADR-003 reconciliation remains outside KAN-121.

## 2. Current runtime map

```text
Landing `/`
  ├─ “Quiero alinear mi objetivo primero” → `/public/start`
  ├─ sign-in → `/auth`
  └─ “Reservar demo” / related labels → configured external Calendly URL

Current Portfolio Entry (114C)
  → current checkpoint
  → POST `/sessions/:id/critical-handoff`
  → current Critical Handoff artifact (allowlisted projection, source-bound)
  → anonymous user chooses sign-in to confirm
  → `/auth` → authenticated claim → `/public/start`
  → GET current Critical Handoff → explicit representativeness confirmation
  → remains on the Critical Handoff review; no post-confirmation CTA

Legacy compatibility branch
  → `/sessions/:id/handoff` and `/handoff/confirmation`
  → legacy HandoffReview / confirmed Brief actions
  → authenticated provisional continuation and context selection
  → POST `/sessions/:id/continue-portfolio`
  → `/portfolio/setup`
```

The browser uses the `critical` discriminator and the dedicated Critical Handoff DTO for current 114D. It does not issue an HTTP request to the legacy `/handoff` endpoint in that branch. The backend does, however, retain and expose a legacy sidecar as described in §§3, 4 and 10.

## 3. Legacy semantic map

`PortfolioEntryHandoff` is the older handoff shape, not the Critical Handoff artifact. Its Zod schema and provider schema contain `recommended_approach`, `alternative_approaches`, `starteria_path` and `recommended_cta`. The deterministic materializer can emit these fields; the live legacy materializer/prompt can also generate the legacy handoff. The record is stored as JSON on `PortfolioEntryHandoff` in `front/prisma/schema.prisma`.

| Field / surface | Producer and runtime owner | Persistence and API/DTO | Consumer / UI | Tests and status | Semantic meaning and 114E collision |
|---|---|---|---|---|---|
| `PortfolioEntryHandoff.starteria_path` | `backend/modules/portfolio-entry-runtime/domain/handoff.schema.ts`; `handoff-materializer.ts` and `live-handoff-materializer.ts`; legacy handoff generation in `portfolio-entry-experimental-session.service.ts` | `PortfolioEntryHandoff.handoff` JSON; explicit `GET/POST /api/v1/public/portfolio-entry/sessions/:id/handoff`; legacy authenticated provisional DTO also copies it into `laterWorkItems` and `decisionMetadata.starteriaPath`; conversion mapper snapshots it | Legacy `Vh1ApproachSection`, `ExpandedAnalysis`, confirmed Brief summary and provisional continuation | Runtime cognition tests, DTO/repository tests, router and conversion tests; current 114D UI does not consume it. Legacy sessions use it; current critical sessions can have a hidden sidecar | A legacy sequence of actions, potentially model-authored. It is not authority for D5, is not a value/capability projection, and can imply structure or organizational destination. Never use as 114E input semantics. |
| `recommended_approach` | Same legacy handoff producer; schema treats it as a suggested approach, with `AI_SUGGESTED` / `UNREVIEWED` semantics | Same JSON, explicit legacy API, legacy provisional DTO as `continuationSummary`, and conversion mapper | Legacy “Qué haría Starteria primero,” “Propuesta de Starteria,” and provisional continuation review; may be accepted/edited/rejected in that legacy review | `value-handoff-cognition.test.ts`, `portfolio-entry-conversion.mapper.test.ts`, session/router/integration tests and frontend Handoff tests | Legacy proposed approach. It is not the frozen contract’s `recommended_first_movement` and not 114E’s `value_bridge` or capability path. It can be mistaken for strategy/plan. |
| `alternative_approaches` | Legacy deterministic/live handoff producer; live prompt permits alternatives when materially useful | Legacy JSON and explicit handoff DTO | Legacy recommended-approach section and expanded analysis render alternatives when present | Legacy materializer/UI tests; KAN-119 explicitly excludes distinct alternative ranking | Legacy alternatives, not a 114E option ranking. Reuse would import an unapproved semantic and ranking surface. |
| `recommended_cta` | Legacy handoff producer; deterministic default is “Continuar con mi portafolio” | Legacy JSON/DTO; `portfolio-entry-conversion.mapper.ts` maps it to `nextRecommendedStep` | Confirmed Brief shows it as “Siguiente paso conceptual”; it is descriptive text, not the active button handler | Conversion mapper/integration and frontend Brief tests | A generic legacy next-step string. It does not encode a contextual public CTA, consent, destination availability or `continuation_intent`. |
| `suggestedRoute` / `deriveSuggestedRoute` | `front/src/features/portfolio-entry/public/suggestedRoute.ts`, deriving a local label from legacy status, gaps, outcome provenance and `starteria_path` actions | No persistence or API field of its own | `SuggestedRouteSection` inside legacy `HandoffReview`; displays title/reason and says it is guidance; no navigation handler | `suggestedRoute.test.ts`; not used by CriticalHandoffReview | A legacy internal destination taxonomy (`not_now`, `explore`, `portfolio_analysis`, `portfolio_setup`). It is not `continuation_intent`; its `portfolio_setup` result collides directly with D4/D9 if treated as a route choice. |
| `/handoff` | Backend routes in `portfolio-entry.router.ts`; legacy materializer and reader | `POST` materializes; `GET` returns legacy handoff DTO. Generic session DTO normally omits legacy payload; explicit reader includes it | Legacy `HandoffReview`; no SPA route exactly named `/handoff` (the unrelated SPA `/handoff/invitations/:token` is a different feature) | Legacy contract tests plus current-critical sidecar test described in §4 | Compatibility API, not 114E. It is still callable for sessions whose backend discriminator resolves to `critical`; that API exposure is an audit finding, not a request to alter it here. |
| `/handoff/confirmation` | Backend `confirmOrCorrectHandoff`, auth-required | Stores a legacy `PortfolioEntryConfirmation` against the latest legacy handoff; shares endpoint shape with older authenticated provisional confirmation | Legacy HandoffReview and `AuthenticatedProvisionalContinuationPage`; not called by current critical browser path | Router/integration tests include the legacy confirmation contract; current Critical confirmation has a separate endpoint | Field-level Brief confirm/correct semantics. It does not mean the Critical Handoff is a confirmed Brief. Its API can be invoked directly for a session that also has a current Critical Handoff sidecar. |
| `HandoffReview` and legacy `EarlyAccessCard` | `PortfolioEntryExperience.tsx`, rendered only when `handoffExperience === 'legacy'` | Uses explicit legacy handoff DTO; no Early Access API call | Shows legacy reading, suggested route, approach, gaps and a “Trabajarlo con Starteria” action. The button confirms the legacy handoff; it is not a first-party Early Access request | `PortfolioEntryExperience.test.tsx`; reachable for legacy discriminator sessions | Legacy compatibility UI, not current 114D. An unused `LegacyEarlyAccessCard` function also contains “Acceso anticipado al MVP” copy, but has no caller and is not rendered. |
| Confirmed Brief actions | `ConfirmedSummary` in `PortfolioEntryExperience.tsx` | Legacy session/confirmation DTO; download serializes a local Markdown file; delete invokes abandon; “Trabajarlo con Starteria” invokes auth or `continue-portfolio` | “Descargar”, “Eliminar”, “Trabajarlo con Starteria” | Frontend tests cover download/delete and CTA; these are legacy Brief actions, not current Critical Handoff actions | Explicitly confirmed legacy Brief lifecycle. Current 114D confirmation does not render these actions, does not create a `PortfolioEntryBriefIdentity`, and does not choose a continuation destination. |

### Field-level occurrence inventory

- `starteria_path`: schema/provider schema; deterministic and live materializers; prompt; evidence scorer; session/repository mapper; Prisma JSON payload; session and provisional DTO mappings; conversion mapper; legacy UI; tests across `portfolio-entry-runtime`, `portfolio-entry-sessions`, `portfolio-entry`, `portfolio-entry-conversion`, and `front/src/features/portfolio-entry/public`.
- `recommended_approach`: same schema/materializer/persistence/DTO chain; displayed in the legacy approach section, summary, and authenticated provisional review; passed through legacy conversion mapping; tested in cognition, service, router, conversion and UI tests.
- `recommended_cta`: schema/provider schema and deterministic materializer; legacy DTO and conversion `nextRecommendedStep`; shown in confirmed Brief as copy; no dedicated current 114D action or CTA consumer.
- `alternative_approaches`: schema/provider schema, live prompt and handoff JSON; legacy expanded UI; tests cover the shape. The deterministic producer emits an empty array. No current Critical Handoff field or UI equivalent exists.
- `suggestedRoute`: helper plus its UI section and unit tests; not persisted, not sent in DTO, and not tracked as an analytics event.

## 4. Current 114D exit boundary

### Verified source path

1. Current sessions resolve `handoffExperience: 'critical'`. The browser calls `POST /sessions/:sessionId/critical-handoff`; it then reads `GET /sessions/:sessionId/critical-handoff`. The legacy semantic handoff is omitted from the generic session DTO and from the critical response.
2. The endpoint creates a dedicated `PortfolioEntryCriticalHandoff` payload through `toCriticalHandoffProjection`, bound to the source `contextRevision` and source turn. `current` is computed from the latest artifact and matching context revision.
3. **Backend compatibility side effect:** `materializeCriticalHandoffCurrent` calls `performHandoffMaterialization`. That method first runs the legacy `handoffMaterializer`, persists `PortfolioEntryHandoff`, then synthesizes and persists the Critical Handoff from KAN-114. The critical response contains only the critical DTO, but the legacy JSON sidecar exists and is readable through the explicit legacy endpoint.
4. For an anonymous session the current review shows “Iniciar sesión para confirmar esta lectura.” Clicking it stores `{sessionId, credential, criticalHandoffReview: true}` in `sessionStorage`, tracks `signup_gate_reached`, and navigates to `/auth`.
5. After authentication, `AuthPage` reads the pending claim, reads the current session with the anonymous credential to obtain its revision, calls the auth-required claim endpoint, clears the anonymous/pending markers, stores only `{sessionId}` for the critical review, stores a claimed notice, and returns to `/public/start`. Because the critical-review flag is true, this does **not** navigate to `/public/provisional-continuation`.
6. The recovered page fetches the claimed generic session and the Critical Handoff DTO. The confirmation action calls `POST /sessions/:sessionId/critical-handoff/:artifactId/confirmation`, authenticated as the claimed owner and bound to artifact version and source context revision.
7. The confirmation response updates the local Critical Handoff artifact. The same route remains visible. The page shows “Lectura confirmada” and the representativeness message, followed by the same allowlisted reading sections. The correction and confirmation actions are hidden once confirmed. **No CTA is shown after current 114D confirmation.**

### Exact boundary and DTOs

```text
114D exit = current, source-bound Critical Handoff artifact with
            confirmationState = confirmed, displayed in place.

It ends before continuation_intent, public conversion, auth-to-portfolio
selection, `/portfolio/setup`, and any 114F organizational destination.
```

At that point the server supplies a generic session DTO with session/revision/ownership/routing metadata and conversation state, plus the dedicated `PortfolioEntryCriticalHandoffClientDto`: `id`, `version`, `sourceContextRevision`, `state`, `confirmationState`, `confirmedAt`, and the allowlisted `projection` (`conclusionStatus`, `finalReading`, `decisionInView`, `usableNow`, `decisionChangingUnknowns`, optional `firstMovement`). It does not expose the legacy `handoff` in this current DTO. The critical confirmation response contains no destination route, accepted legacy fields, or Brief identity.

### Reachability findings

- **Current browser:** does not call the legacy `/handoff` endpoint, `continue-portfolio`, or `/portfolio/setup`; it does not render a conversion CTA after critical confirmation.
- **Backend/API:** current Critical Handoff materialization persists the legacy handoff sidecar. A test in `live-understanding-session.integration.test.ts` explicitly reads that legacy handoff from a current critical session. The auth-required legacy `/handoff/confirmation` endpoint does not check `handoffExperience`; it accepts the session’s latest legacy handoff. `continue-portfolio` likewise validates legacy session/handoff/confirmation state and scoped organization access, not the critical artifact discriminator. Therefore an authenticated direct API client can reach legacy semantic/confirmation seams from a current-critical session; the supported browser flow does not do this. A complete manual direct-API conversion is not claimed as browser-reproduced.
- This is a collision to preserve in the audit. KAN-121 does not change or close those APIs. 114E must not consume their payload or route into the continuation service.

### Browser state and markers

The portfolio-entry public feature uses `sessionStorage`, not `localStorage`, for `starteria.portfolioEntry.current`, `pendingClaim`, `claimedNotice`, `claimedSession`, and `criticalHandoffReviewSession`. The current confirm-to-auth path uses the first four as described; the critical-review marker is a presentation discriminator. After claim the anonymous credential is cleared and the current critical `claimedSession` stores only the session ID. The server remains authoritative for ownership and artifact currentness.

### Evidence limit

The route/component/service/API behavior above is source-audited and covered by existing focused tests. This environment has no browser/Playwright tool, so a fresh browser execution is `SOURCE_AUDITED / NOT_RUNTIME_REPRODUCED`. KAN-119’s recorded CI evidence is separate prior CI evidence, not a browser run performed for KAN-121.

## 5. Auth, claim and continuation map

| Component | Current behavior and owner | Data / destination | Classification for 114E |
|---|---|---|---|
| Claim endpoint | `POST /sessions/:id/claim`; auth required; verifies anonymous access token, expected revision, and sets owner to the authenticated principal. Claim is ownership, not confirmation. | Session ownership and revision persist server-side. | Ownership/auth plumbing; does not itself authorize public conversion. |
| Auth recovery | `AuthPage.tsx` claims after auth hydration. Critical review marker returns to `/public/start`; non-critical legacy identity returns to `/public/provisional-continuation`. | Pending anonymous credential and mode live briefly in `sessionStorage`; claimed critical storage is session ID only. | Reuse only as explicitly authorized auth plumbing; not a 114E destination. |
| Claimed session storage | Critical path stores `{sessionId}`; the legacy path can store a `PortfolioEntryBriefIdentity` containing session/revision/handoff/version/confirmation/version. | Browser `sessionStorage`; identity is derived only from a confirmed legacy Brief. | Critical identity and legacy Brief identity are different. Do not manufacture a Brief identity for 114D. |
| Provisional continuation endpoint/DTO | Authenticated `GET /sessions/:id/provisional-continuation` returns a legacy handoff projection with raw public context, `starteriaPath`, `recommended_approach`, and unconfirmed/confirmed field metadata. Current critical discriminator suppresses this DTO. | Legacy session and handoff JSON. | Legacy continuation, not 114E. |
| `AuthenticatedProvisionalContinuationPage` | `/public/provisional-continuation`; auth required. It reads the provisional DTO and available organizations; user may edit/confirm legacy fields and accept/edit/omit the legacy approach. It then calls `continue-portfolio`. | Reads the claimed session and legacy handoff; selects an existing authorized organization. | Legacy continuation; unsafe to reuse for public conversion. |
| Context selection | `GET /sessions/:id/portfolio-contexts` lists organizations already accessible to the authenticated owner; page requires a choice when there are multiple. | `organizationId` is sent to continuation endpoint. It is not a public destination selector. | 114F candidate boundary; not 114E. |
| `continue-portfolio` | Auth-required `POST /sessions/:id/continue-portfolio`. Server requires claimed owner, unexpired session, expected revision, Portfolio Lead profile, legacy lifecycle `CONFIRMED`/`CONVERSION_ELIGIBLE`, latest legacy handoff plus matching legacy confirmation, and scoped portfolio access. It persists `PortfolioEntryPortfolioContinuation` with source snapshot and selected scope. | Returns `destinationRoute: '/portfolio/setup'`; continuation row and idempotency state are persisted. | Current legacy implementation. Organizational destination belongs to future 114F; not authorized/reusable by this audit. |
| `/portfolio/setup` | Existing protected Portfolio Lead route; reached by the old continuation response after authenticated scope resolution. | `/portfolio/setup` under the Portfolio Lead route/layout. | Destination surface belongs to 114F in the 114E boundary; the existing legacy route does not make 114F authorized. |
| `/convert` and conversion mapper | A separate auth-required conversion API and legacy mapper exist; mapper copies legacy `recommended_cta`, `starteria_path`, and approach data. Current Critical Handoff browser branch does not call this API. | `PortfolioEntryConversion` and related project conversion behavior are separate from the 114D artifact. | Legacy; unsafe to reuse for 114E. |

## 6. Landing Early Access / Demo map

### Landing calls and destinations

The source is `front/src/app/pages/LandingPage.tsx`; the URL is configured in `front/src/app/config/publicLanding.ts`.

| Visible label | Placement | Destination | App route exists? | Capture / integration evidence |
|---|---|---|---:|---|
| “Reservar demo” | Sticky header and Hero | `PUBLIC_LANDING_CONFIG.demoBookingUrl`; env override `VITE_DEMO_BOOKING_URL`, otherwise default `https://calendly.com/fabio-merino-97/new-meeting`; opens a new tab | No app `/demo` route; external Calendly URL is configured | No app form, API, persistence or analytics call on click. The target booking page and availability were not runtime-verified. |
| “Verlo con el equipo de Starteria” | Mid-page value section | Same configured Calendly URL | No app route | External link only; no Portfolio Entry data or query parameters are added. |
| “Agendar una demo” | Footer | Same configured Calendly URL | No app route | External link only; no app capture or consent step. |
| “Quiero alinear mi objetivo primero” | Hero | `/public/start` | Yes | Starts optional Portfolio Entry, not commercial conversion. |
| “Empezar por la entrada pública” / “Analizar mi situación” / “Entrada pública” | Value section, closing panel and footer | `/public/start` | Yes | No lead form on Landing; this is the separate public entry journey. |
| “Iniciar sesión” (or “Ir al panel” when authenticated) | Header/footer | `/auth` or `/dashboard` | Yes | Account auth/panel path; not Early Access/Demo. |

No Early Access CTA, waitlist CTA, `/early-access` route, demo-request route, email-capture widget or first-party demo form was found on Landing. `LandingPage.test.tsx` asserts the demo URL/target and explicitly asserts that no Early Access CTA is rendered. That test proves link wiring, not a functioning Calendly booking. The KAN-112 report and current authority still describe commercial destinations as `RUNTIME_PENDING / BLOCKED_BY_DESTINATION`; the current source has a configured Calendly link. This discrepancy is recorded in §14 and is not silently resolved here.

### Separate legacy pilot-interest form

There is an existing first-party **pilot-interest** form at `/auth/continue/:draftId` (`ProgressiveSignupPage.tsx`), backed by `POST /api/v1/public/pilot-leads`. It is reached from the legacy public proposal/pilot flow, not from the current Landing CTAs or current 114D Critical Handoff. It says “Postúlala al primer piloto…” and asks for consent to contact about that pilot. It is not the KAN-120 Early Access/Demo destination.

The form and `publicPilotLeadService` have tests for request shape and persistence. The Landing test does not link to this form. The route and form are source-audited; this audit did not submit a lead.

## 7. Data, privacy and consent findings

| Question | Implemented fact |
|---|---|
| Is there a lead/waitlist model? | There is a `PilotLead` Prisma model, not an Early Access or DemoRequest model. It records `draftId`, name, email, optional phone/organization, consent boolean/time, status/source, retention date and optional proposal JSON. |
| Is there a first-party contact/demo API? | `/api/v1/public/pilot-leads` exists for pilot interest. No DemoRequest API or Early Access API was found. |
| Exact pilot form fields | Required: name, email, `consentAccepted`; optional: phone and organization. The request also includes the legacy `draftId` and an optional `proposal` snapshot with `inputText`, `sourceType`, `title`, and `aiOutput`. |
| Pilot consent and persistence | UI says “Acepto que Starteria me contacte sobre el primer piloto.” The service requires true and persists `consentAccepted` plus `consentAt`; schema/service define a 180-day retention date. Purpose copy refers to contact about the first pilot and notifying the submitter when slots open. |
| Can Portfolio Entry IDs be sent there? | The PilotLead request schema has a public proposal `draftId`, not a Portfolio Entry session ID, Critical Handoff artifact ID/version, or Brief identity. The demo link contains no Entry query parameters. No Entry-to-lead transport was found. |
| Is Entry context sent automatically? | No automatic transfer of Portfolio Entry conversation, Brief, Critical Handoff, session ID or artifact ID to Calendly or PilotLead was found. The legacy pilot form automatically includes its own public proposal snapshot when its user submits and accepts the pilot-contact checkbox; that snapshot is not a Portfolio Entry artifact. |
| Is explicit consent for sharing Portfolio Entry context implemented? | No. There is no consent control, field, persistence, or purpose text for sharing Entry semantic context with a commercial destination. This is not a current sharing violation because no such transfer is wired; it becomes a D13 blocker if a future adapter sends that context without explicit consent. |
| PII fields | PilotLead stores contact name and email, with optional phone and organization. The demo link itself captures no data in Starteria; any Calendly form fields are external and unknown from repository source. |
| Analytics / notification handling | PilotLead emits metadata events (see §8); service audit logs contain identifiers/metadata rather than the contact payload. Optional email notifiers receive contact data to follow up; repository code does not forward Portfolio Entry context to them. |

No legal/GDPR policy assessment is made here. The concrete gap is that the existing pilot consent is purpose-specific and is not consent to share a Portfolio Entry context with a different commercial flow.

## 8. Analytics audit

`trackPortfolioEntryEvent` dispatches a browser `CustomEvent` and pushes to `window.dataLayer` only if one is present. A repository search found no Landing CTA event calls and no dataLayer/provider initialization in frontend source. No backend analytics persistence was found for these events. Events below are therefore instrumentation plumbing, not evidence of durable funnel analytics.

| Event | Trigger and payload | Provider/persistence | Current 114D? / funnel value |
|---|---|---|---|
| Landing CTA viewed/clicked; `early_access_*`; `demo_*` | No event exists in `LandingPage.tsx` for these CTAs. | None found | No. Cannot measure Landing CTA or EA-vs-Demo conversion as implemented. |
| `public_entry_started`, `portfolio_entry_session_created`, `portfolio_entry_first_message_submitted` | Entry start/session/message; payload is event-specific and may include session ID. | `CustomEvent` + optional `dataLayer` | Entry funnel, not commercial funnel. |
| `clarification_displayed`, `clarification_answered`, `guided_exploration_offered`, `guided_exploration_accepted`, `guided_provisional_route_selected` | UI turn/choice; payload includes session ID, count/revision/choice metadata where provided. | Same | Current Entry; no 114E semantics. |
| `handoff_generated` | Frontend finishes materialization; emitted after either critical or legacy branch. | Same | Yes, current 114D materialization is represented by this generic event, but event name does not distinguish the legacy sidecar from Critical Handoff. |
| `handoff_corrected`, `handoff_confirmed` | Legacy correction or legacy confirmation path. | Same | No for current Critical Handoff; legacy only. |
| `critical_handoff_confirmed` | Successful current Critical Handoff confirmation; payload is session ID. | Same | Yes, current 114D completion/confirmation event. No separate “viewed” event exists. |
| `signup_gate_reached`, `portfolio_entry_claimed` | User chooses auth gate; successful claim after auth. Payload uses session ID. | Same | Current 114D can emit both. Claim is ownership, not public conversion. |
| `portfolio_entry_conversion_cta_viewed` | Effect fires when generic session lifecycle is `CONFIRMED` and owner is `CLAIMED`. | Same | Legacy Brief signal. Current critical confirmation updates the artifact rather than the generic session lifecycle; the current CriticalHandoffReview itself renders no CTA. Do not treat this as an 114E CTA-view event. |
| `portfolio_entry_conversion_started`, `portfolio_entry_conversion_completed`, `portfolio_entry_conversion_failed`, `portfolio_entry_overview_opened` | Legacy confirmed Brief continuation: start, result IDs, error kind/status, and overview continuation ID. | Same | Legacy continuation only; not a public EA/Demo conversion event. |
| Download/delete | No dedicated event in the download or abandon handlers. | None | No measurement for those actions. |
| Suggested route | No event in `deriveSuggestedRoute` or `SuggestedRouteSection`. | None | No route-suggestion measurement. |
| `pilot_interest_started`, `pilot_interest_submitted`, `pilot_interest_failed` | Legacy pilot form started/submitted/failed; payload includes draft/lead IDs or error kind/status, not form text. | Separate `CustomEvent` + optional `dataLayer` in `publicPilotLeadService.ts`; lead data itself persists in PilotLead. | Not a Landing CTA event and not a KAN-120 EA/Demo outcome event. |

The sanitizer removes named token/raw-text/provider keys and long strings, but the audit does not treat that as a future 114E payload contract. No events are added by this task.

## 9. Classification matrix

Every row has exactly one primary classification from the KAN-121 list.

| Component | Current role | Reachable from current 114D? | Classification | Why | 114E reuse? | Risk |
|---|---|---:|---|---|---|---|
| Legacy `starteria_path` | Legacy action sequence in persisted handoff JSON and legacy DTOs | API-only sidecar; not current UI | LEGACY | D5 explicitly separates it from new Starteria Path | No | Imports legacy plan/routing assumptions. |
| `recommended_approach` | Legacy AI-suggested approach, displayed in legacy UI | API-only sidecar; not current UI | LEGACY | Candidate mapping is not approved; not equal to Critical Reasoning’s first movement | No | Could become strategy/plan or create new claims. |
| `alternative_approaches` | Legacy optional alternatives | API-only sidecar; not current UI | LEGACY | KAN-119 excludes distinct alternative ranking from 114D | No | Imports unsupported ranking/choice behavior. |
| `recommended_cta` | Legacy descriptive next-step string | API-only sidecar; not a current button | LEGACY | Not a contextual public conversion CTA | No | Can imply `/portfolio/setup` or auth continuation. |
| `suggestedRoute` helper | Legacy label/reason derived from legacy handoff | Not current 114D | LEGACY | It is a UI suggestion, not server route or `continuation_intent` | No | Includes `portfolio_setup` destination semantics. |
| `POST/GET /handoff` | Legacy generation/read API | Yes as direct API because current materialization persists sidecar; not called by 114D browser | KEEP_COMPAT | KAN-119 preserves legacy readers; current UI uses dedicated endpoint | No semantic reuse | Sidecar can be read even from current-critical sessions. |
| `/handoff/confirmation` | Legacy field-level confirm/correct API | Direct API only; not current UI | KEEP_COMPAT | Preserves explicit legacy Brief behavior | No | Can create legacy confirmation semantics alongside Critical Handoff. |
| Legacy `HandoffReview` | Legacy handoff presentation | No current critical UI; visible for `handoffExperience=legacy` | KEEP_COMPAT | Existing compatibility surface and tests | No | Confusion with current Critical Handoff if discriminator is bypassed. |
| Legacy confirmed Brief actions | Download, abandon/delete, and “Trabajarlo con Starteria” | No current 114D UI | KEEP_COMPAT | Actions belong to the legacy Brief lifecycle | No, except generic UI primitives | Download/delete and continuation identity are not Critical Handoff actions. |
| Critical Handoff artifact | Dedicated, durable, source-bound 114D projection | Yes | KEEP | Accepted 114D artifact, allowlisted and currentness-checked | With server-side adapter only | Client must enforce current + confirmed source and not infer Entry semantics beyond the allowlist. |
| Critical Handoff confirmation | Authenticated representativeness confirmation | Yes | KEEP | Current 114D explicit human action; separate from Brief confirmation | No as CTA; source state only | Must not be reinterpreted as route/destination choice. |
| Claim/auth | Authenticated ownership and recovery | Yes, between review and confirmation | KEEP | Ownership plumbing; claim is not confirmation | Only if a distinct authorized flow needs identity | Do not turn authentication into commercial conversion or 114F. |
| Provisional continuation DTO/page | Authenticated legacy session restoration and field review | No via current discriminator; direct route is auth-only | LEGACY | Explicitly includes legacy payload and confirmation controls | No | Carries legacy raw context and old handoff semantics. |
| `AuthenticatedProvisionalContinuationPage` | Legacy authenticated review + org selection | No supported 114D route | LEGACY | Calls old confirmation and `continue-portfolio` | No | Auth-gated organizational continuation conflicts with D9/D4 for public 114E. |
| `continue-portfolio` endpoint | Persisted, authenticated legacy Portfolio continuation | API-only possible after legacy confirm and scoped access | LEGACY | Current implementation consumes legacy handoff + confirmation, not Critical Handoff | No | Crosses 114E exit into an org destination. |
| Future 114F organizational destination | Future Portfolio Setup continuity boundary | Not authorized by KAN-121 | BELONGS_TO_114F | D4 assigns organizational destination to 114F | No | ADR-003 remains open/deferred; do not treat current code as 114F authority. |
| `/portfolio/setup` | Existing protected Portfolio Lead route | Not current 114D UI; legacy continuation destination | BELONGS_TO_114F | In this journey it is the organizational destination side of the boundary | No | Would make public 114E appear to grant product access. |
| Landing Early Access CTA | Not present | No | OUT_OF_SCOPE | No current Landing CTA or first-party EA route | No | Inventing one would violate scope. |
| Landing Demo CTA | External link labeled “Reservar demo” and related labels | Not from current 114D | ADAPT | Source points to configured Calendly URL; operating status unverified | With verified destination and contextual wrapper only | Generic CTA, no consent/data adapter, authority status conflict. |
| Pilot interest form / `PilotLead` | Legacy public pilot application form/API | Not from Landing’s current CTAs or 114D | LEGACY | It captures a legacy public proposal and pilot-contact consent | No | Different purpose, payload and lifecycle from D13 context-sharing. |
| Demo booking destination | Default external Calendly URL, env-overridable | No | ADAPT | URL is configured but booking functionality is not runtime-proven | With destination verification; do not attach Entry context | Could be broken, stale or unavailable; source alone cannot prove booking. |
| Portfolio Entry analytics helper | Browser custom events and optional `dataLayer` | Yes for selected 114D events | KEEP_COMPAT | Existing observability plumbing | With an allowlisted event/payload adapter | No Landing/EA/Demo events and no proven durable provider. |
| Landing CTA analytics | No implementation found | No | OUT_OF_SCOPE | No source events or persistence | No | Cannot infer funnel support from link rendering. |

## 10. Collision map

| Collision | Current behavior | Desired 114E boundary | Risk if reused directly | Safe treatment |
|---|---|---|---|---|
| 1. Legacy `starteria_path` vs new 114E Starteria Path | Legacy generated path is stored alongside the current artifact; current materializer can create it as a sidecar. | D2/D3/D5: project only from current + confirmed Critical Handoff; capability/value projection, no legacy path/plan. | Old actions may smuggle sequence, strategy or `/portfolio/setup` assumptions into 114E. | Keep compatibility isolated; new adapter reads only the current Critical Handoff DTO and produces a separately governed projection. |
| 2. `recommended_cta` vs contextual conversion CTA | Legacy string is displayed as “Siguiente paso conceptual”; the actual legacy button has separate auth/continuation behavior. | D7/D10/D11/D12: contextual intent to Early Access/Demo, tangible value first, real destination. | A generic string can be mistaken for a functioning CTA or product continuation. | Do not map the field. Resolve the actual commercial destination and contextual CTA semantics in KAN-123. |
| 3. `suggestedRoute` vs `continuation_intent` | Helper derives internal `not_now`/`explore`/`portfolio_analysis`/`portfolio_setup`; it only renders copy. | 114E ends with an explicit intention to continue; it does not select an organizational route. | “Route” taxonomy could be treated as ranking, destination choice or 114F authorization. | Do not invoke helper or persist its `destination`; keep the boundary before 114F. |
| 4. Legacy continuation vs public Early Access/Demo conversion | Legacy “Trabajarlo con Starteria” runs auth, legacy confirmation and possibly Portfolio continuation. | D9/D10: public continuation while access is closed terminates at Early Access/Demo. | User is sent into an unavailable or semantically different product flow. | Do not reuse `continue-portfolio`, `/auth` or `/public/provisional-continuation` for public 114E conversion. |
| 5. `continue-portfolio` vs future 114F | Current endpoint persists a legacy continuation after owner/context/Brief confirmation and returns `/portfolio/setup`. | D4: destination selection and organizational continuity belong to future 114F, which this audit does not authorize. | Reusing it silently implements the future destination, asks for organizational selection and crosses access boundary. | Treat as legacy; KAN-122/123 keep destination out of 114E. ADR-003 reconciliation is separate. |
| 6. Landing CTA vs context-aware 114E CTA | Landing’s demo link is generic and uses one external Calendly URL; no Entry context or click analytics is attached. | D6/D7/D10–D13: value first, CTA contextual, disclose EA/Demo, explicit consent before sharing Entry context. | A generic destination can look contextual without being so; adding Entry payload to the URL would share context without consent. | Reuse only the URL plumbing after status verification; place a separately governed contextual adapter in front and send no Entry context absent explicit consent. |
| 7. Confirmed Brief vs confirmed Critical Handoff | Legacy Brief confirmation records accepted/corrected/rejected fields; Critical Handoff confirmation records representativeness only. | 114D confirms “this represents my situation sufficiently”; it does not validate every assertion or select a route. | A Critical Handoff could be treated as a Brief, or its confirmation as authority to continue. | Preserve separate artifact, DTO, identity and confirmation state. No Brief identity from Critical Handoff. |
| 8. 114D endpoint vs legacy sidecar | Critical materialization runs the legacy handoff materializer, persists legacy JSON, then returns the KAN-114 projection. A separate legacy GET can read the sidecar. | 114D’s visible reasoning remains KAN-114; 114E must consume only the current, confirmed Critical Handoff. | Direct clients can access a second legacy semantic payload or invoke legacy confirmation seams. | Do not call legacy endpoints from 114E; record the API seam as an implementation blocker to resolve only under a separate authorized change if needed. |

## 11. Safe reuse map

| Candidate | Treatment | Constraint |
|---|---|---|
| Design System `Button`, `Card`, `Badge`, layout primitives and auth-independent public shell | `REUSE_AS_IS` | Reuse only presentation; they do not carry product semantics. |
| Critical Handoff read service / DTO | `REUSE_WITH_ADAPTER` | Server-side adapter must recheck currentness, confirmation and source binding. Do not use client-side copy as a new reasoning source. |
| Landing external URL configuration | `REUSE_WITH_ADAPTER` | First verify the URL is the intended, available destination. A contextual CTA wrapper must not append Entry context by default. |
| Existing CTA/button primitive | `REUSE_AS_IS` | Label, hierarchy, destination and consent semantics must come from KAN-123. |
| `trackPortfolioEntryEvent` / optional `dataLayer` plumbing | `REUSE_WITH_ADAPTER` | Use an explicit event allowlist and payload; do not emit raw Entry content or semantic projection. Provider persistence is not established. |
| `sessionStorage` API as a browser mechanism | `REUSE_WITH_ADAPTER` | Use new purpose-specific keys/schema; do not reuse legacy Brief identity or claim markers as conversion consent. |
| Legacy `starteria_path`, `recommended_approach`, `recommended_cta`, `alternative_approaches`, `suggestedRoute` | `DO_NOT_REUSE` | They carry legacy semantics and/or destination hints. |
| Legacy `/handoff`, `/handoff/confirmation`, provisional continuation DTO/page | `DO_NOT_REUSE` | Current critical sessions can expose the sidecar; these APIs encode Brief and authenticated continuation semantics. |
| `continue-portfolio`, context selection, `/portfolio/setup`, Brief identity | `DO_NOT_REUSE` | These cross into the organizational continuation boundary assigned to 114F. |
| PilotLead model/API/form/notifier | `DO_NOT_REUSE` | It stores a legacy proposal snapshot and pilot-specific contact consent, not the KAN-120 commercial conversion contract. |
| Calendly URL as a destination | `REUSE_WITH_ADAPTER` | Source wiring is present but destination operation is unverified. Reuse cannot include silent context transfer. |

No semantic payload is labeled reusable as-is merely because a UI/service can technically transport it.

## 12. Inputs for KAN-122 Business Capability Boundary

### Claims already present

| Claim/source | Audit input |
|---|---|
| Landing: “Conecta lo que tu empresa quiere mover con el trabajo, las personas y la evidencia necesarias para lograrlo.” | Capability of connecting context/work/evidence is asserted; “necesarias para lograrlo” can sound outcome-assuring. Decide its bounded wording. |
| Landing: “Starteria reduce silos, mantiene contexto y convierte avance en decisiones más claras.” | “Mantiene contexto” is mechanically supported by the platform’s stored/session context; “reduce silos” and “decisiones más claras” are outcome-like and need explicit capability framing. |
| Landing benefits: “Más claridad en menos tiempo”, “Equipos alineados de verdad”, “Decisiones con evidencia.” | Comparative or strong outcome claims; no measurement/guarantee contract was found in this audit. Boundary must say what Starteria can do versus what an organization achieves. |
| Landing trust copy: “La IA estructura y propone; las decisiones siguen siendo de las personas”, “Nada se convierte en trabajo formal sin revisión”, “Tu entrada pública no crea iniciativas automáticamente.” | These are consistent with the current Entry review/confirmation boundary; keep scope explicit (public Entry/current slice) rather than generalizing to every product flow. |
| Landing product preview: 30% time reduction, 5 initiatives, 12 tasks, 3 blockers, decision brief | The preview labels itself “Caso ilustrativo” and “datos ficticios”; safe only while the illustrative status remains visible and the numbers are not implied to be measured visitor results. |
| Legacy handoff cards: “Ordena y prioriza tus iniciativas”, “Da seguimiento al portafolio desde un mismo contexto”, “Guarda esta lectura”, “Acceso anticipado al MVP” | The first three are legacy UI claims, not current 114D capability evidence. “Acceso anticipado al MVP” appears only in an unused component. Do not promote them to 114E claims. |
| Pilot form: “trabajarla con IA, mentoría y próximos pasos claros” and notice when slots open | Pilot-specific old flow copy; does not prove current EA availability or support the KAN-120 capability boundary. |

### Recommended boundary decisions for KAN-122

- The current 114D runtime supports a provisional, traceable reading; displays supported insight, decision, usable context, decision-changing unknowns and optional first movement; allows correction before confirmation; and records human confirmation of representativeness. These are bounded, already evidenced capabilities.
- “Organize”, “make visible”, “structure”, “follow uncertainty/learning” may be candidates for `CAN_DO` / `CAN_SUPPORT`, but require explicit boundary wording in KAN-122 and must not imply complete organizational execution.
- No source in this audit supports guarantees of business results, ROI, churn reduction, budget approval, organization decisions, invented evidence, or automated initiative execution. Those should be stated as `CANNOT_PROMISE` if KAN-122 adopts the KAN-120 examples.
- Capability statements that imply Portfolio Setup, active work, ongoing portfolio tracking, or Early Access availability require separation from the public 114D runtime and from the unverified Landing destination.

## 13. Inputs for KAN-123 Experience Contract

No runtime behavior is chosen here. The following decisions remain for the contract:

| Contract topic | Evidence / unresolved decision |
|---|---|
| `value_bridge` | Current Critical Handoff exposes situation/decision/usable-now/unknowns/first movement, but no Starteria contribution or value projection. Define which verified capability connects the current state to an observable user change. |
| `capability_path` | Legacy `starteria_path` is explicitly not the source. Define a path of user-visible capabilities without turning it into a plan, strategy, experiment or org route. |
| Tangible outcome wording | D6/D8 require an explicit observable capability/state change before data capture. Decide user-facing language and how to avoid business guarantees. |
| Immediate next action | D7 requires context. Decide whether the immediate action is the user's next step, what Starteria would do first, or both, and bind it to available evidence. |
| CTA semantics | D4/D9/D10/D11: intent to continue to EA/Demo while access is closed, not product continuation. Define primary/secondary CTA hierarchy and how the CTA explains what begins after selection. |
| Early Access vs Demo hierarchy | Landing currently has Demo links and no EA CTA, while authority marks commercial destinations pending. Decide which option is primary, what each destination actually does, and whether the current Calendly URL is retained. |
| Consent | D13 requires explicit consent for sharing Entry context. Decide the consent moment, exact data scope, purpose, destination, persistence and non-consent path. Existing pilot-contact consent does not cover this. |
| `insufficient_basis` behavior | KAN-120 says no generic path for insufficient basis. Decide whether the view abstains entirely or shows only a bounded explanation/available conversion options; no generic promise should be inferred. |
| Stale behavior | Current artifact state is revision-bound. Decide how 114E behaves if the artifact becomes stale before display or submission; do not project a stale source. |
| Source binding | Decide binding fields/versioning from current confirmed artifact and source context revision, including how to make the same source + projector version deterministic. |
| Public conversion payload | No current Demo/Early Access API accepts Entry context. Define what is sent, whether any Entry semantic content is sent only after consent, and how the external destination behaves when consent is declined. |
| Platform access | D9 says no 114F while access is closed. Define a truthful public continuation boundary that cannot be read as account/workspace access. |

## 14. Blockers and open conflicts

### CONFLICT — commercial destination status

```text
Contract / authority: CURRENT_STATE.md and STARTERIA_V2_MANIFEST.md mark
  Early Access / Demo `RUNTIME_PENDING / BLOCKED_BY_DESTINATION`; KAN-112
  records no commercial destination authorized by that slice.
Requirement: KAN-120 D10 names Early Access / Demo as today's public
  continuation options.
Current document/code: LandingPage.tsx renders three Demo/booking links that
  use VITE_DEMO_BOOKING_URL or a default Calendly URL; LandingPage tests assert
  those links. No Early Access CTA or first-party EA API is present.
Observed mismatch: source has an external Demo destination configured, but the
  authority/runtime status says the commercial destination is pending. Code
  proves link wiring, not that Calendly is available or that a booking works.
Risk: KAN-123 could design around a destination that is stale/unavailable, or
  repeat an unverified claim that Demo is functional.
Recommended treatment: KEEP the authority status until a human verifies the
  destination; reconcile the factual record after that evidence. Do not add a
  route or claim functionality in this audit.
Requires ADR: no for factual reconciliation; product destination hierarchy
  remains a KAN-123 decision.
```

### CONFLICT — current 114D API sidecar and legacy compatibility reach

```text
Contract: KAN-119 closure says current 114D uses Critical Handoff and legacy
  readers remain KEEP_COMPAT for historical consumers; KAN-120 D2/D5 make the
  confirmed Critical Handoff the only 114E input and reject legacy Starteria Path.
Requirement: Current 114D/114E must use KAN-114 reasoning and must not treat
  legacy recommendation/path semantics as current.
Current implementation: POST `/critical-handoff` runs the shared handoff
  materializer and persists a legacy PortfolioEntryHandoff sidecar before
  returning the Critical Handoff DTO. `GET /handoff` can read that sidecar on
  a current critical session. The auth-required legacy confirmation route does
  not check the critical discriminator; `continue-portfolio` validates legacy
  handoff/confirmation and scoped access but not the critical discriminator.
Observed mismatch: the supported current browser is isolated from legacy UI,
  but the API sidecar/legacy confirmation seams are not restricted to historic
  sessions. A focused integration test reads the sidecar from a current
  critical session and exercises legacy confirmation against a session that
  also has a Critical Handoff.
Risk: a direct API client can observe legacy semantics and may compose the old
  authenticated continuation path, even though the current 114D UI has no CTA.
Recommended treatment: KEEP_COMPAT for explicit legacy consumers; do not reuse
  these APIs in 114E. If the compatibility boundary must be narrowed, decide
  and authorize that as a separate runtime task.
Requires ADR: no conclusion in this audit; this is a runtime boundary finding.
```

Other blockers before implementation: no Early Access route/form/API exists on current Landing; no consent for sharing Entry context exists; no 114E output type/endpoint/persistence exists; access is closed by KAN-120; the legacy organizational continuation is not 114F authority; and browser/Calendly behavior was not reproduced. These facts do not prevent KAN-122/123 from shaping the contract if they remain explicit inputs.

## 15. Recommended next order

1. **KAN-122:** define the Business Capability Boundary using the supported claims and unsupported/ambiguous claims in §12. Keep the Landing Demo mismatch visible rather than treating the URL as proof of capability.
2. **Destination fact check:** a product owner verifies the configured Calendly destination and reconciles the `RUNTIME_PENDING / BLOCKED_BY_DESTINATION` record. This establishes whether Demo can be an actual destination choice in KAN-123.
3. **KAN-123:** define `value_bridge`, capability path, tangible outcome, immediate action, CTA hierarchy, consent, insufficient-basis/stale behavior, source binding and public payload, constrained by KAN-120 D1–D14 and KAN-122.
4. Only after those contracts and a separate technical authorization should architecture/implementation be planned. Keep 114F and ADR-003 reconciliation as separate authority gates.

## 16. Audit conclusion

The repo provides enough source, DTO, persistence, route, test, Jira and authority evidence to begin KAN-122 and KAN-123 contract shaping. It confirms KAN-119/114D is in the governed baseline, KAN-114 remains the accepted reasoning source for current Critical Handoff, 114E has no runtime implementation, and the current 114D browser exit is a confirmed Critical Handoff with no post-confirmation CTA. It also finds two material collisions: the current backend exposes a legacy handoff sidecar/API seam from current-critical sessions, and Landing source contains a configured Calendly link while authority still marks commercial destinations pending.

The Calendly destination was not browser-tested, so it is not called functional. The conflicts are recorded for decision and are not resolved by this audit. No 114E implementation or 114F authorization follows from this conclusion.

Enough verified repository evidence exists to proceed with KAN-122/123 shaping, with the demo-destination status and legacy API seam carried as explicit blockers. This result does not authorize implementation.

**AUDIT_RESULT: READY_WITH_BLOCKERS**
