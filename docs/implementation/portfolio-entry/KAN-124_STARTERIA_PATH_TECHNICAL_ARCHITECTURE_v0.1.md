# KAN-124 — Starteria Path Technical Architecture & Implementation Shaping v0.1

**Status:** `PROPOSED_FOR_IMPLEMENTATION`  
**Type:** Technical architecture and source audit only  
**Baseline:** `origin/main` = `faebf5cd554c0fac6fd6141e53dfd1eea04a06c6`  
**Branch:** `audit/KAN-124-starteria-path-technical-architecture`  
**Runtime change authorized by this document:** No  
**Architecture is active authority:** No

This proposal shapes a future 114E implementation. It does not implement 114E, alter runtime behavior, create a route or migration, change UI or Landing, change Core or Steps, resolve ADR-003, or authorize 114F.

## 1. Status

This is a technical proposal for human review. It is subordinate to Core v0.2, accepted product ADRs, and the active Portfolio Entry Logic Contract. KAN-122 and KAN-123 are proposal inputs; neither is promoted to runtime authority here. An implementation task still needs its own accepted scope, guardrail check, tests, and closure evidence.

## 2. Authority and inputs

The requested authority order was checked against the repository and Jira:

1. [`docs/STARTERIA_AUTHORITY.md`](../../STARTERIA_AUTHORITY.md) names factual Core v0.2, accepted product ADRs, and the Portfolio Entry Logic Contract v0.1 as the governing order. It records the Critical Reasoning Experience Contract as frozen for implementation planning, without runtime authorization.
2. [`doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`](../../../doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES%281%29.md) remains `Base fundacional revisada / Por validar`; candidate Core v0.3 does not replace it. Core INV-03 retains human organizational authority and INV-05 requires traceable material claims.
3. [`doc/product-adr/ADR-INDEX.md`](../../../doc/product-adr/ADR-INDEX.md) is the product ADR index. ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, and ADR-007 are listed as accepted; ADR-001 is proposed. ADR-006 separates Landing, Portfolio Entry, and commercial conversion. ADR-003's state conflict remains open and is not resolved here.
4. [`doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`](../../../doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md) remains the only active Portfolio Entry Logic Contract. Its existing delegation conflict with candidate Clarification/Handoff v0.2.1 remains outside this architecture decision.
5. [`docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md`](../../experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md) is `FROZEN FOR IMPLEMENTATION PLANNING`, scoped to Critical Reasoning, and does not adopt candidate legacy `recommended_approach` or `starteria_path` semantics.
6. [`docs/ai-harness/portfolio-entry/KAN-114_CRITICAL_SITUATION_SYNTHESIS_SEMANTIC_ACCEPTANCE_v0.1.md`](../../ai-harness/portfolio-entry/KAN-114_CRITICAL_SITUATION_SYNTHESIS_SEMANTIC_ACCEPTANCE_v0.1.md) records `ACCEPTED` with `PASS_WITH_NON_BLOCKING_GAPS`. It does not claim product deployment.
7. [`docs/implementation/portfolio-entry/KAN-119_CRITICAL_HANDOFF_V01_IMPLEMENTATION_CLOSURE.md`](KAN-119_CRITICAL_HANDOFF_V01_IMPLEMENTATION_CLOSURE.md) records 114D as `IMPLEMENTED_VERIFIED` and integrated in the governed baseline. It excludes 114E, 114F, and ADR-003 reconciliation.
8. [`docs/implementation/portfolio-entry/KAN-121_STARTERIA_PATH_RUNTIME_AND_CONVERSION_AUDIT_v0.1.md`](KAN-121_STARTERIA_PATH_RUNTIME_AND_CONVERSION_AUDIT_v0.1.md) records the current runtime seams, legacy sidecar, and unverified commercial destination facts.
9. [`docs/contracts/STARTERIA_BUSINESS_CAPABILITY_BOUNDARY_v0.1.md`](../../contracts/STARTERIA_BUSINESS_CAPABILITY_BOUNDARY_v0.1.md) is `PROPOSED_FOR_114E_SHAPING`; it is proposal input, not active runtime authority.
10. [`docs/experience/portfolio-entry/PORTFOLIO_ENTRY_STARTERIA_PATH_EXPERIENCE_CONTRACT_v0.1.md`](../../experience/portfolio-entry/PORTFOLIO_ENTRY_STARTERIA_PATH_EXPERIENCE_CONTRACT_v0.1.md) is a proposal for implementation planning, not an active runtime contract.
11. [`CURRENT_STATE.md`](../../../CURRENT_STATE.md) records 114D integrated, 114E not started, 114F out of scope, commercial destinations pending, and ADR-003 open/deferred.
12. [`STARTERIA_V2_MANIFEST.md`](../../../STARTERIA_V2_MANIFEST.md) records 114D as the integrated baseline, legacy handoff consumers as `KEEP_COMPAT`, and 114E as `NOT_STARTED` pending its own scope.
13. Jira KAN-120 and KAN-124 were read. KAN-120 freezes D1–D14. KAN-124 asks for this architecture, explicitly excludes implementation, and gates an implementation ticket on preserving the 114D source gate, determinism, conversion boundary, consent, legacy isolation, and no Core/Steps leakage.

### Authority confirmations

- KAN-114 remains the sole business reasoning source. 114E adds no LLM and performs only a bounded deterministic projection.
- 114D is the current governed baseline: a current, source-bound Critical Handoff with explicit representativeness confirmation.
- 114E is not implemented. 114F is out of scope and unauthorized by this task.
- Legacy `PortfolioEntryHandoff.starteria_path`, `recommended_approach`, `recommended_cta`, `alternative_approaches`, and `suggestedRoute` are not 114E authority.
- `conversion != product continuation`. 114E ends at public conversion intent; it does not create or enter Portfolio Setup, Core, or Steps.
- KAN-122 Business Capability Boundary is proposal input, not active runtime authority. KAN-123 Experience Contract is a proposal for implementation planning.
- Early Access and Demo availability is a product/configuration fact. It must never be selected or inferred by reasoning output.

### Preserved conflict — ADR-003

```text
CONFLICT
Contract: doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md and the product ADR index say ACCEPTED.
Requirement: CURRENT_STATE.md says PROPOSED and OPEN / DEFERRED; reconcile before 114F.
Current document/code: these authority records still disagree.
Observed mismatch: ADR-003 status is inconsistent across the repository's authority records.
Risk: registration or Portfolio Setup continuation could be treated as settled when its boundary remains disputed.
Recommended treatment: KEEP the discrepancy open; defer reconciliation to its separately authorized boundary before 114F.
Requires ADR: no new ADR is proposed here; human authority reconciliation remains required.
```

This architecture neither changes ADR-003 nor depends on product continuation through the disputed boundary.

## 3. Current technical map

The paths below describe the current 114D seams, not proposed 114E files. KAN-121's source audit also found that current-critical materialization persists a legacy handoff sidecar before it creates the separate Critical Handoff artifact.

| Seam / file | Responsibility, input, output, persistence | Invariants and concurrency | 114E reuse and coupling risk |
|---|---|---|---|
| Critical Handoff model — `front/prisma/schema.prisma:3284` | `PortfolioEntryCriticalHandoff` stores `id`, `sessionId`, `artifactVersion`, `schemaVersion`, `sourceContextRevision`, optional `sourceTurnId`, JSON `payload`, confirmation state/evidence, and timestamps. It relates to the session and source turn. | Unique `(sessionId, artifactVersion)`; append-only versions; source turn deletion sets the relation null. The record itself does not calculate currentness. | Reuse only as 114E's read source. Never store an 114E path in this model or reuse the legacy JSON field. Reusing `payload` without its artifact/schema/revision gate would lose source binding. |
| Critical Handoff domain — `backend/modules/portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types.ts:4` | Strict v0.1 schema validates the six projected fields and lifecycle evidence. `isCriticalHandoffCurrent` compares artifact identity to latest and `sourceContextRevision` to current session revision. | Unsupported schema or malformed lifecycle fails closed. `insufficient_basis` has no final reading or first movement. | Reuse the invariant, not the generic payload type as an 114E DTO. Extending this schema with path or conversion data would couple two lifecycles. |
| Repository port and implementation — `backend/modules/portfolio-entry-sessions/application/portfolio-entry-session.repository.ts:43`; `.../infrastructure/prisma-portfolio-entry-session.repository.ts:152,222,240` | `createCriticalHandoff` validates source context/session revision and source-turn membership/latestness, then persists a new version. `getLatestCriticalHandoff` returns the highest artifact version plus the session revision. `confirmCriticalHandoff` persists confirmation. The in-memory repository mirrors the contract for unit/service use. | Creation and confirmation use serializable transactions. Creation checks latest turn and rejects a non-advancing version after a confirmed artifact. Confirmation locks the session row, checks owner/latest ID/version/context revision, then conditionally updates the provisional artifact. Same-owner repeat confirmation is idempotent. | Add a separate read-only source port/adapter for 114E. Do not reuse a generic `getHandoff` query that may return the legacy sidecar. The repository currently knows both artifacts, which makes untyped reuse risky. |
| Session service — `backend/modules/portfolio-entry-sessions/application/portfolio-entry-session.service.ts:413` | Validates Critical Handoff payload on create; returns latest artifact plus `isCurrent`; delegates confirmation after checking active session and immutable claimed owner. | On a confirmed retry after a conflict, it returns success only when ID, artifact version, context revision, currentness, and confirmer all still match. | Reuse the source/currentness service or a narrow adapter. Do not make a new Path service use legacy `PortfolioEntrySession.latestHandoff`. |
| Materialization service — `backend/modules/portfolio-entry/application/portfolio-entry-experimental-session.service.ts:379,468,624` | `materializeCriticalHandoffCurrent` uses the existing checkpoint and request idempotency, then `performHandoffMaterialization` writes the compatibility handoff and, when the critical checkpoint/source turn still match, calls the KAN-114-backed Critical Handoff projector and persists its result. Output is a Critical Handoff DTO. | Expected session revision and source context revision are checked; the source turn must still be the latest analyzed context turn. A KAN-114 materialization error does not undo the legacy compatibility write. | 114E must not call this materialization route or run synthesis again. Its input is the already persisted current+confirmed 114D artifact. The existing shared materialization side effect is the legacy-sidecar coupling flagged by KAN-121. |
| Critical projection — `backend/modules/portfolio-entry/presentation/critical-handoff-projection.ts:47` | Maps validated KAN-114 synthesis to an allowlisted reading, decision, usable context, unknowns, and optional first movement. | Deterministic projection; no unsupported conclusion or movement on insufficient basis. | Reuse the resulting persisted 114D projection as data only. Do not reuse its KAN-114 mapper to derive Starteria Path; 114E needs its own separately versioned mapping. |
| DTO — `backend/modules/portfolio-entry/portfolio-entry.dto.ts:100,328` | `toCriticalHandoffClientDto` returns `id`, artifact `version`, `sourceContextRevision`, current/stale state, confirmation state/time, and allowlisted projection. It excludes source turn ID, confirmer ID, provenance internals, and provider/model metadata. | Currentness is calculated before serialization. | This is a suitable source boundary to adapt server-side, but it is not itself proof of currentness at a later submit. A new Path DTO needs its own allowlist and version fields. |
| GET/materialize/confirm routes — `backend/modules/portfolio-entry/portfolio-entry.router.ts:134-136`; controller `backend/modules/portfolio-entry/portfolio-entry.controller.ts:113,159,173` | `POST /sessions/:sessionId/critical-handoff` materializes; `GET` reads the dedicated artifact; `POST /sessions/:sessionId/critical-handoff/:artifactId/confirmation` confirms. GET/materialize use optional auth plus session credentials; confirmation requires auth. | GET returns only the Critical Handoff surface, not the legacy `/handoff` DTO. Confirmation is bound to artifact ID/version/revision and claimed owner. | New 114E routes must be explicit and separate. Do not call `/handoff`, `/handoff/confirmation`, `/continue-portfolio`, or a generic legacy conversion service. |
| Claim and confirmation — `backend/modules/portfolio-entry/portfolio-entry.router.ts:136-138`; `.../application/portfolio-entry-experimental-session.service.ts:422` | Claim attaches an authenticated user as immutable session owner. Critical Handoff confirmation records that owner's representativeness confirmation. | Claim proves ownership, not that the reading is representative. Confirmation is a later explicit owner action and still does not validate every assertion as objective truth. | A confirmed Path source inherits claimed ownership. Neither claim nor 114D confirmation may be interpreted as conversion or product access. |
| Front service and loader — `front/src/features/portfolio-entry/public/portfolioEntryPublicService.ts:179,251,270`; `PortfolioEntryExperience.tsx:1392,1588` | The frontend calls the dedicated Critical Handoff endpoints, allowlists the DTO again, and loads it when `nextAction` is `review_handoff` or `claim_or_close` and the session discriminator is `critical`. It suppresses older in-flight loads with a sequence counter. | The public service maps 404 to absent; stale/current is server supplied. The loader does not treat a legacy handoff as Critical Handoff. | Reuse fetch/loading patterns, not the generic legacy service or DTO. Keep the 114E loader bound to a new endpoint and response type. |
| Review and post-confirm state — `front/src/features/portfolio-entry/public/CriticalHandoffReview.tsx:123,158,275`; `PortfolioEntryExperience.tsx:1924,2109` | Review renders current reading, decision, usable-now items, unknowns, and first movement. Confirm updates the artifact in place; the same review remains visible with “Lectura confirmada.” | Stale, conflict, error, insufficient-basis, provisional, and confirmed states are distinct. A confirmed artifact hides correction/confirmation actions. There is no post-confirmation CTA. | 114E would be a new read-only view after this state, not an extension of the confirmed Critical Handoff component's domain or lifecycle. |

### Current source binding facts

- `sourceContextRevision` binds the Critical Handoff to `PortfolioEntrySession.contextRevision`.
- `sourceTurnId` is optional at the model boundary; creation verifies it belongs to the session and is the latest analyzed context turn when supplied. It is internal traceability, not a public 114E field.
- `artifactVersion` is monotonically allocated per session through append-only rows; latest is selected by descending version.
- Current means **latest artifact ID plus matching current session context revision**. Confirmation is separate and must also be `confirmed`.
- Context advancement makes the previous artifact stale. Current 114D semantics do not provide a generalized post-confirmation edit/reopen action; a stale Path must not mutate or repair that confirmed artifact.

## 4. A/B/C representation comparison

### Option A — deterministic projection on read

For each eligible read, load the latest confirmed current Critical Handoff, validate its source/version, project a DTO deterministically, and return it. Persist no Path artifact. This minimizes semantic duplication and schema work. History can be reconstructed from the retained Critical Handoff plus the pinned boundary/projector versions. It requires the read path to be carefully source-bound and deterministic.

### Option B — dedicated persisted Starteria Path

After 114D confirmation, create an append-only Path artifact and serve that snapshot. This gives a directly inspectable historical Path, but adds stored semantic content, migration and lifecycle state. Source invalidation must mark old Paths stale/superseded, new projector/boundary versions need re-materialization policy, and snapshots can preserve a Path that was never current or can drift from the current 114D source.

### Option C — hybrid

Derive the semantic Path on read as in A. Persist a separate conversion-intent record only when a user submits a real commercial request; bind it to source Critical Handoff identity, revision, destination/config version, and submission-only consent. Clicks and views remain analytics events. Do not persist a Path snapshot in v0.1. A later snapshot is justified only if an approved destination or audit requirement cannot be met by source/version replay.

## 5. Required decision matrix

| Criterion | Option A | Option B | Option C | Best fit |
|---|---|---|---|---|
| Deterministic semantics | Same source and pinned versions produce the same DTO. | Stored output can be deterministic at creation; regeneration can differ unless versions are pinned. | Path remains the same deterministic read projection as A. | A / C |
| Durable Path history | No Path copy; reconstruct from source and historic code/config versions. | Strongest direct Path snapshot history. | No Path snapshot; durable conversion intent only. | B, only if Path snapshots are a real audit need |
| Replayability | High if source artifact and boundary/projector versions remain available. | Snapshot is inspectable; replay still needs old projector and boundary versions. | High for Path; conversion records retain the exact source/config versions used. | A / C |
| Source binding | Recheck source on every read. | Store source IDs/revision and maintain invalidation state. | Recheck source on every read and submit; intent stores the source binding. | C |
| Currentness / stale handling | Derived from current source each read; stale output is not generated. | Must update or interpret persisted stale state when source changes. | Same fail-closed read rule as A; submit repeats CAS checks. | A / C |
| Migration cost | No schema migration. | New semantic artifact model and migration. | One small intent/consent record migration if durable submits are enabled; no Path table. | A |
| Duplicated semantic data | None beyond DTO in transit. | Duplicates much of 114D semantics in Path storage. | No durable Path copy; only conversion metadata and optional consent-scoped payload. | A / C |
| Privacy footprint | Lowest. | Highest due stored summary/path duplication and retention. | Low to medium; intent metadata is durable, context remains excluded by default. | A for pure privacy; C with conversion audit |
| Event attribution | Can emit view/click events, but no durable submission identity by itself. | Path artifact does not attribute a commercial action. | Durable intent links a real submission to source and destination; clicks remain events. | C |
| Conversion audit trail | Requires an additional persistence design. | Path history alone does not show intent or consent. | Intent and consent are recorded at submit with source and config binding. | C |
| Operational complexity | Lowest; GET must remain deterministic and uncached across source changes. | Highest; materialization, invalidation, migration, replay, cleanup, and repair. | Medium; derived read plus a narrowly scoped submit transaction. | A for read-only; C for conversion-ready architecture |
| Auth coupling | One owned-source read. | Read and artifact lifecycle need ownership and materialization authorization. | Owned-source read plus owner-checked submit. | A |
| Failure modes | Projection/read failure only; conversion can be handled separately. | Adds partial materialization, stale persisted record, and migration/backfill failures. | Conversion failures remain separate and cannot corrupt 114D or derived Path. | C |
| Future migration flexibility | Highest semantic flexibility; no Path storage to migrate. | Lowest; stored Path schema becomes a compatibility burden. | High; conversion records are independent of future product continuation. | A / C |
| Compatibility with future 114F | Clear boundary if 114E ends at conversion intent. | Risk of treating stored Path as a canonical product continuation object. | Keeps Path and commercial conversion distinct; 114F must get its own source/authority contract. | C |

## 6. Recommended architecture

**Recommend Option C:** the semantic Starteria Path is derived on read; durable data is limited to a submitted conversion intent and the consent choice attached to that submission. This selects the simplest read model while meeting the separate need to attribute an actual commercial request and prove whether context was shared.

Option C does **not** mean persist the Path. It does not assume more persistence is safer. The 114D artifact remains the sole durable semantic input. No conversion or analytics failure may write back to, invalidate, or change the Critical Handoff.

The same source plus the same `businessCapabilityBoundaryVersion` and `projectionVersion` must yield the same semantic Path. A changed conversion config may alter only the conversion presentation and availability disclosure, never the business reasoning or value bridge.

## 7. Projector architecture

### Input

`ConfirmedCurrentCriticalHandoff` is a server-created, read-only typed value containing:

- Critical Handoff `id`, `artifactVersion`, `sourceContextRevision`, supported `schemaVersion`, `confirmationState`, and allowlisted projection fields;
- the session's current `contextRevision` and latest-artifact identity used to prove currentness;
- `BusinessCapabilityBoundaryVersion` (only after its human adoption);
- `StarteriaPathProjectionVersion`;
- server-owned `ConversionConfigFacts` and `conversionConfigVersion`.

It is not a generic `handoff` object and never contains the raw synthesis, legacy sidecar, conversation history, model metadata, or client-selected availability.

### Conceptual module flow

```text
loadConfirmedCurrentCriticalHandoff
  → validatePathInputGateAndVersions
  → criticalHandoffToValueBridge
  → criticalHandoffToCapabilityPath
  → criticalHandoffToDependencies
  → criticalHandoffToFirstMovement
  → applyCapabilityBoundary
  → applyAvailabilityFacts
  → buildConversionPresentation
  → serializeStarteriaPathDtoAllowlist
```

- `criticalHandoffToValueBridge` maps the confirmed final reading, decision, usable-now items, unknowns, and optional first movement into user-facing slots. It does not diagnose, add evidence, or promise business outcomes.
- `criticalHandoffToCapabilityPath` selects only boundary-approved capability nodes whose source basis is present. It does not rank organizational routes.
- `criticalHandoffToDependencies` preserves organizational-input and external-evidence dependencies explicitly.
- `criticalHandoffToFirstMovement` copies the optional 114D first movement without expanding it; absent stays absent.
- `applyCapabilityBoundary` filters and labels claims against the adopted capability boundary. A missing/unavailable boundary fails closed.
- `applyAvailabilityFacts` evaluates whether the exact capability is available on the public 114E surface. This is a product/runtime fact, never reasoning output.
- `buildConversionPresentation` adds only availability disclosure and verified CTA actions. Conversion destination availability does not affect `valueBridge`, `capabilityPath`, dependencies, or first movement.

`insufficient_basis` produces no generic Path, capability list, tangible-value promise, CTA, or context-share option.

## 8. DTO boundary

The public DTO is a strict positive allowlist. Example shape:

```ts
type StarteriaPathResponse = {
  pathSchemaVersion: 'starteria-path-dto-v0.1';
  experienceState:
    | 'SUPPORTED' | 'BOUNDED'
    | 'UNAVAILABLE_MISSING' | 'UNAVAILABLE_INVALID'
    | 'UNAVAILABLE_UNCONFIRMED' | 'UNAVAILABLE_INSUFFICIENT_BASIS'
    | 'STALE' | 'ERROR';
  starteriaPathStatus?: 'SUPPORTED' | 'BOUNDED';
  valueBridge?: {
    currentState: string;
    starteriaContribution: Array<{ statement: string; capabilityClass: string; availabilityState: string }>;
    tangibleOutcome: { statement: string; observableArtifact: string };
    remainingDependency: Array<{ statement: string; dependencyType: string }>;
    immediateNextAction?: { statement: string; boundary: string };
  };
  capabilityPath: Array<{ capabilityType: string; statement: string; whyRelevant: string }>;
  dependencies: Array<{ dependencyType: string; statement: string }>;
  firstSupportedMovement?: { movement: string; whyNow: string; whatItMayClarify: string; boundary: string };
  availabilityDisclosure: { state: string; statement: string };
  conversion: {
    availability: 'NO_VERIFIED_DESTINATION' | 'DEMO_ONLY' | 'EARLY_ACCESS_ONLY' | 'EARLY_ACCESS_AND_DEMO';
    configState?: 'available' | 'unavailable';
    configVersion?: string;
    actions: Array<{ destinationType: 'EARLY_ACCESS' | 'DEMO'; label: string; href: string }>;
  };
  sourceBinding: {
    criticalHandoffId: string;
    criticalHandoffVersion: number;
    sourceContextRevision: number;
    current: true;
    confirmed: true;
    projectionVersion: string;
    businessCapabilityBoundaryVersion: string;
  };
};
```

Unavailable responses carry a state and safe recovery explanation, but no Path fields or CTA. `href` is present only for server-verified destinations and is validated against the server allowlist. The client cannot submit a URL to choose a destination.

Explicit exclusions from this DTO: raw KAN-114 synthesis; provenance internals; `selected_lenses`; reasoning metadata; provider/model metadata; raw legacy handoff; legacy `starteria_path`; `recommended_approach`; `recommended_cta`; `alternative_approaches`; legacy `suggestedRoute`; internal consent/security metadata; `sourceTurnId`; confirmer identity; raw conversation; and unrelated session history.

The serializer constructs every field explicitly and uses a strict schema. It never spreads a Prisma record or stored JSON into a public response. Adding a public field requires an explicit allowlist and privacy/test review.

## 9. Source binding and currentness

A Path is renderable only if all of the following are true at the server read point:

- a Critical Handoff exists;
- it is the latest artifact for the session;
- its state is current and `confirmationState` is `confirmed`;
- `sourceContextRevision == session.contextRevision`;
- its Critical Handoff schema and required Path/boundary versions are supported;
- conclusion status is `supported` or `bounded`.

The 114D `sourceTurnId` remains an internal trace; it is not required as a public Path field. The source binding returned for a valid read is the Critical Handoff ID, artifact version, source context revision, and the exact Path projection/boundary versions.

The Path itself needs three separate versions:

- `pathSchemaVersion`: public response shape, e.g. `starteria-path-dto-v0.1`;
- `projectionVersion`: deterministic mapping rules;
- `businessCapabilityBoundaryVersion`: semantic boundary used by the mapping.

On-read, these versions live in the server's pinned projector/boundary configuration and are echoed in `sourceBinding`; no Path row is written. A submitted conversion intent stores these versions along with source identity. `conversionConfigVersion` is separate because it affects only availability/presentation. A persisted Path under a later architecture would store all source and version fields in the same row, but that is not recommended for v0.1.

On stale source, return `STALE` with no old Path, CTA, or context-sharing option. Do not render cached Path content as current. The user must return through an authorized 114D flow and obtain a fresh current confirmed source; 114E does not reopen or edit the confirmed artifact.

## 10. Legacy isolation

KAN-121 found that current Critical Handoff materialization can coexist with a legacy sidecar and that legacy APIs are still directly reachable for compatibility. 114E must remain isolated even while that seam remains.

Smallest safe mechanical set:

1. Create a dedicated `ConfirmedCurrentCriticalHandoff` application type from `PortfolioEntryCriticalHandoff` only. Do not accept `PortfolioEntryHandoff`, a generic `{ handoff }`, or an untyped JSON object in the projector.
2. Add a dedicated repository/service read method for the Critical Handoff artifact and currentness snapshot. Do not call the legacy repository getter or conversion mapper.
3. Keep a dedicated 114E endpoint and strict DTO allowlist; do not add Path fields to `/handoff` or the generic session DTO.
4. Use no shared semantic mapper between legacy handoff and 114E. A capability mapper may read only the typed Critical Handoff projection.
5. Add negative tests with a current 114D session that also has a sidecar: the projector/DTO must not read or emit `starteria_path`, `recommended_approach`, `recommended_cta`, `alternative_approaches`, or `suggestedRoute`.

No destructive sidecar cleanup or legacy endpoint change is needed for this isolation. The remaining API seam needs an explicit disposition before implementation, but a separate legacy retirement task is not part of 114E.

## 11. Conversion configuration

Conversion availability is server-owned product/configuration fact data, not reasoning output. The allowed normalized states are:

- `NO_VERIFIED_DESTINATION`
- `DEMO_ONLY`
- `EARLY_ACCESS_ONLY`
- `EARLY_ACCESS_AND_DEMO`

The backend owns a versioned `ConversionConfigFacts` source containing destination identity, explicit verified/enabled status, approved host/route, interaction type, and config version. The current verified baseline is `NO_VERIFIED_DESTINATION`: KAN-121 found a configured Calendly URL but did not verify that booking works, and no first-party Early Access flow was evidenced.

The frontend may receive the normalized state and verified actions in the Path DTO. It may not choose the state, mark a destination verified, or invent a fallback. A config read failure fails closed: keep value content if available, show a neutral “availability could not be verified” disclosure, and return no CTA.

Validation requires a product-owned fact check of the destination's actual next step and availability, plus HTTPS, allowlisted host/path, no placeholder target, and no user-supplied URL. A non-empty environment variable or external link is not evidence that a destination is available. The config version increments when the destination or verified behavior changes. The submit endpoint revalidates that version and enabled state.

## 12. Conversion intent persistence

Persist only an actual first-party conversion submission, not exposure or navigation. A future `PortfolioEntryConversionIntent` could contain:

- `id`, `sessionId`, `criticalHandoffId`, source artifact version and `sourceContextRevision`;
- `destinationType`, `destinationConfigVersion`, and submitted action;
- `projectionVersion` and `businessCapabilityBoundaryVersion` used for the displayed Path;
- idempotency key/hash and `createdAt` (the submission time);
- `contextShareConsentState`, and, only if granted, consent scope version, purpose, and timestamp;
- optional external destination reference only if it is a non-sensitive provider reference required for reconciliation.

Do not store `finalReading`, the Path DTO, email/contact fields, raw source text, provider URLs with query data, or a duplicate user ID. The session relation is the ownership boundary; retrieve the claimed owner from the session when needed. Do not store a separate anonymous identity.

Persist on completed first-party submit, not CTA click. A click to an external scheduler is only `demo_clicked`; it is not a completed booking or a durable conversion intent. Emit `conversion_submitted` only after a first-party request is accepted or a trusted destination callback confirms a submission. Do not claim a booking occurred from a redirect.

Use a stable idempotency key across retries of one submit and enforce uniqueness by session/key. A repeated request with the same key and body returns the original result; same key with a different body is a conflict. A new user-initiated submission may create a new intent. Persist consent and intent in one transaction so neither can exist without the other. Do not write a conversion record for `NO_VERIFIED_DESTINATION`.

## 13. Consent architecture

Default state is `NO_ENTRY_CONTEXT_SHARED`. Offer `SHARE_CONTEXT_WITH_CONVERSION` only after the contextual value and tangible outcome are visible, for an eligible Path and a verified destination. Show destination, purpose, and an exact preview of fields before submit. The user can withdraw or change the choice until submission; before submission it is client state only. Persist the choice atomically with the conversion intent, not on a checkbox change.

Consent binds to the exact destination/action, purpose, source Critical Handoff ID/version/revision, and a versioned field scope. If any of those change before submit, require a new explicit choice. A declined or absent choice sends no Entry context. This is a product-level mechanism, not a legal policy.

Payload candidates:

| Candidate | Assessment |
|---|---|
| `criticalHandoffId` | Keep internally as source binding; do not send it to a third party. An internal destination may use a separate opaque intent ID for access-controlled lookup. |
| `finalReading` | Exclude from minimum sharing. It may contain sensitive situation detail and duplicates the 114D semantic artifact. |
| `decisionInView` | Smallest useful contextual field when present. Recommend this one-sentence, user-visible field as the v0.1 shareable payload after explicit preview/consent. If absent, share no context. |
| `valueBridge` summary | Exclude from minimum. It is derived, may add product claims, duplicates Path semantics, and adds a larger privacy footprint. Add only after a verified destination demonstrates need and the user sees a separately versioned scope. |

Never share raw conversation, hidden reasoning, provider/model data, unrelated session history, or internal provenance structures. A conversion without context remains valid if its destination accepts it.

## 14. Auth and claim architecture

| Action | Requirement | Rationale |
|---|---|---|
| View Path | `SESSION_OWNERSHIP`: require the claimed session owner for a confirmed source. | 114D confirmation is owner-bound; a session ID alone must not expose contextual reading. The existing anonymous token may authorize pre-claim 114D reads, but a 114E source cannot be confirmed until the owner claim/confirmation path has completed. |
| Click CTA | Same owned Path session; no additional auth gate. | A click records intent to navigate only. It does not grant destination access or prove submission. |
| Submit Early Access | Same session ownership and source CAS. Authenticate only if the separately verified Early Access destination requires account identity. Any contact detail belongs to its own explicit form/consent boundary. | Claim is not a marketing opt-in and the Path intent row should not duplicate contact PII. |
| Book Demo | Same session ownership for source-bound interaction. External scheduler may impose its own identity requirements. | A click does not prove a booking; no 114F or product access follows. |
| Share context | Current owner, current source binding, exact destination/purpose, explicit scoped consent at submit. | Prevents cross-session disclosure and unconsented context transfer. |

`claim != confirmation`; `confirmation != conversion`; `conversion != product access`. 114D confirmation means the reading is sufficiently representative to continue, not that every claim is objectively true or that the user selected a route.

## 15. API shape

Use two 114E boundaries, mounted under the existing public Portfolio Entry API namespace but separately typed:

1. `GET /api/v1/public/portfolio-entry/sessions/:sessionId/starteria-path`
   - Authenticates session ownership and reads the latest Critical Handoff/current session revision in a consistent snapshot.
   - Runs the deterministic projector on read; has no write side effect.
   - Returns an allowlisted Path DTO or an explicit unavailable state. Conversion config is normalized into the same response, so a separate `/public/conversion-config` endpoint is not required for 114E.
2. `POST /api/v1/public/portfolio-entry/sessions/:sessionId/conversion-intents`
   - Used only for a completed first-party Early Access/Demo request.
   - Requires idempotency key, destination/action, Path source binding, and explicit consent choice/scope if any context will be sent.
   - Revalidates owner, current/confirmed/latest source, revision, supported versions, destination config version, and current destination availability in the write transaction.
   - Persists intent and submission-only consent together.

Do not add a separate context-consent endpoint. A standalone consent write can outlive or detach from the source, destination, and submitted purpose. Do not add `/public/conversion-config` solely for 114E; the path response already includes normalized availability. Landing's direct commercial routes are a different slice. Direct external Demo navigation records a click only unless a verified callback/first-party submit exists.

## 16. Analytics architecture

Use an explicit event allowlist, adapting existing `trackPortfolioEntryEvent` plumbing only if its behavior remains bounded. Events contain opaque session/source identifiers, versions, enum values, and action IDs only. No semantic text, raw context, consent payload, email, provider metadata, or external URL parameters.

| Event | Trigger and required IDs | Scope / storage | Deduplication |
|---|---|---|---|
| `starteria_path_viewed` | Eligible Path rendered; session, Critical Handoff ID/version/revision, projection and boundary versions. | Session-scoped; analytics only. | Once per event ID and source binding; repeated page views may be counted as separate visits only with a new event ID. |
| `tangible_value_viewed` | Tangible-outcome block becomes visible; same source IDs and projection version. | Session-scoped; analytics only. | Once per source binding per view instance. |
| `conversion_cta_viewed` | Verified CTA is rendered/visible; source IDs, destination type, config version. No event when no destination is verified. | Session-scoped; analytics only. | Once per destination/source/view instance. |
| `early_access_clicked` | Explicit Early Access action; source IDs, config version, action ID. | Session-scoped; analytics only. | Deduplicate transport retry by action ID; distinct deliberate clicks may count separately. |
| `demo_clicked` | Explicit Demo action; source IDs, config version, action ID. | Session-scoped; analytics only. | Same rule as Early Access. |
| `context_share_opt_in` | User explicitly selects share; source IDs, purpose and scope version, no payload. | Session-scoped; analytics only; consent itself remains transient until submit. | Once per source/purpose/state transition. |
| `context_share_declined` | User explicitly declines or chooses continue-without-sharing; no inference from silence. | Session-scoped; analytics only. | Once per source/purpose/state transition. |
| `conversion_submitted` | First-party request accepted after DB commit; intent ID, source IDs, destination/config, consent mode. | Durable conversion-intent row plus analytics event; omit user identity unless a separate approved need exists. | Intent ID is the deduplication key. |

No analytics database table is required for the first slice. Provider durability and analytics retention are not established by this architecture.

## 17. Failure model

| Failure | API behavior | UI behavior / retry | Value and CTA |
|---|---|---|---|
| Handoff not found | `404 CRITICAL_HANDOFF_NOT_FOUND`. | `UNAVAILABLE_MISSING`; return to authorized 114D flow. Not retryable until a source exists. | No Path, conversion CTA, or sharing. |
| Handoff stale / not latest | `200` explicit `STALE` state for GET; `409 SOURCE_STALE` on submit. | Stale notice and source-flow recovery. Retry only after a fresh current confirmed source. | Do not show old Path; no CTA or sharing. |
| Handoff unconfirmed | `200` explicit `UNAVAILABLE_UNCONFIRMED` state. | Return to 114D review/confirmation. | No 114E value Path or CTA. |
| Unsupported source/projection/boundary version | `503 PATH_VERSION_UNSUPPORTED` (or explicit `UNAVAILABLE_INVALID` if represented in a successful response). | Safe unavailable message; retry after compatible server/boundary version is deployed. | No Path or CTA; do not coerce to an older version. |
| Capability boundary unavailable | Path read returns `503 CAPABILITY_BOUNDARY_UNAVAILABLE`. | Safe retryable error. | Do not show capability claims; 114D remains intact. |
| Conversion config unavailable | GET may still return valid Path with conversion `configState: unavailable` and no actions. | Show neutral “availability could not be verified”; allow retry of config/read. | Value remains visible; CTA and consent option hidden. |
| Destination disabled after render | Submit returns `409 DESTINATION_DISABLED` after fresh config check. | Refresh conversion block; explain destination is unavailable. | Keep Path; hide action; no intent write. |
| Consent/intent transaction failure | `503 CONVERSION_SUBMISSION_FAILED`; transaction writes neither record. | Stay on view; retry same idempotency key. If UI state was lost, ask again before re-sharing. | Path remains visible; do not redirect or forward context. |
| Auth/ownership mismatch | `401` when authentication is missing for a claimed source; return `404` for a non-owned session to avoid existence disclosure. | Generic access/recovery state. | No Path, CTA, or sharing. |
| Projector/read failure | `503 PATH_PROJECTION_FAILED`; never serve stale cached DTO. | Retry safe read if source remains current. | Do not show unverified Path or CTA. |

Commercial destination failure is isolated from 114D: it cannot change source confirmation, path currentness, session revision, or Core/Steps state.

## 18. Concurrency and idempotency

- Repeated GET is side-effect free and deterministic. Read source artifact, latest identity, and session revision from one consistent database snapshot. Do not cache across session/source versions.
- CTA clicks are events, not writes. Disable a button while its navigation/submission is pending and use a stable action ID to suppress transport duplicates.
- A conversion POST uses an idempotency key stable across retries. Same key/same body returns the original intent; same key/different body conflicts.
- Consent is not independently updated in the database before submit. The user's transient choice can be changed/withdrawn until the single intent+consent transaction commits.
- A concurrent context revision or new Critical Handoff between GET and POST makes the source stale. The POST rechecks latest artifact ID/version, `sourceContextRevision == session.contextRevision`, confirmation, and source ID under a transaction/row lock or serializable CAS. On mismatch it returns `409` and writes nothing.
- Recheck destination enabled/config version inside the submit transaction. A config change between render and submit returns `409 DESTINATION_DISABLED` or `409 CONFIG_VERSION_CHANGED` and requires a fresh read.
- A confirmed 114D artifact is immutable under its current lifecycle. The conversion transaction never mutates it or advances `contextRevision`.

## 19. Privacy and data minimization

Option A stores no new semantic copy. Option B duplicates a potentially sensitive 114D-derived Path and adds a long-lived retention surface. Option C retains no Path copy; it stores only source-bound conversion metadata and consent required to explain a real submission. Any user-facing summaries are returned in a derived DTO and are not copied into analytics.

Minimum footprint:

- no duplicated final reading or Path in the conversion-intent row;
- no email/contact detail in that row; destination intake owns its own fields and permissions;
- no external destination URL with session/context query parameters;
- consent metadata only for a submitted request and exact scope/purpose;
- no raw semantic context in analytics;
- no duplicate authenticated user ID when the session relation can resolve ownership;
- retain an external reference only when necessary and non-sensitive.

Commercial request/consent retention must be defined by the responsible product/data owner before durable submission goes live. This document does not define legal policy or retention duration.

## 20. Test strategy

These are proposed future test layers; no tests are added or run by this architecture audit.

### Unit

- Deterministic projector: same source and pinned versions produce identical semantic output.
- Supported/bounded mapping and allowed capability boundary mapping.
- `insufficient_basis` produces no generic Path or first movement.
- Availability application changes only disclosure/CTA, never business reasoning.
- All four conversion-state mappings; invalid/empty destination config fails closed.
- DTO strict allowlist excludes internal fields and legacy semantics.
- Legacy-leakage negative tests include a sidecar populated with every prohibited field.

### Integration

- Current + confirmed + latest gate; unconfirmed, stale, old-artifact, revision mismatch, and unsupported-version gates.
- Source binding returned by GET and rechecked by POST.
- Session owner/auth checks for view and submit.
- Destination config normalization and disabled/config-version change behavior.
- Conversion-intent idempotency and same-key conflict behavior.
- Consent default/decline/grant persisted atomically only with an accepted submission; transaction failure stores neither.
- Concurrent context revision between read and submit returns conflict and creates no intent.
- A current 114D session with a legacy sidecar still yields a Path derived only from the Critical Handoff repository.

### E2E

- Confirmed 114D → 114E; value appears before any CTA.
- `NO_VERIFIED_DESTINATION` renders no CTA; also cover Demo only, Early Access only, and both once those states are authorized and verified.
- Consent declined sends no context; consent granted sends only the exact previewed allowed field(s).
- Source becoming stale between view and submit suppresses CTA/intent and shows recovery.
- No `/portfolio/setup`, `continue-portfolio`, Core, Step, or 114F side effect.

### Legacy compatibility

- Existing legacy handoff journeys remain compatible.
- 114E never reads `PortfolioEntryHandoff.starteria_path`, `recommended_approach`, `recommended_cta`, `alternative_approaches`, or `suggestedRoute`.

Normal CI uses deterministic KAN-114 fixtures/adapters and does not call a live LLM.

## 21. Proposed implementation slices

These are proposed implementation successors, not Jira tickets created by this audit. Each vertical slice carries its own unit/API/browser regression evidence; E2E is not postponed into a test-only final phase.

| Proposed slice | Scope / layers | Dependency and gate | Migration / rollback |
|---|---|---|---|
| `124A` — derived 114E read vertical slice | Dedicated source adapter/repository read, strict typed projector and DTO, GET boundary, and user-facing value Path with `NO_VERIFIED_DESTINATION`. | Requires human adoption of KAN-122/KAN-123, accepted source/version architecture, and recorded disposition of KAN-121 sidecar seam. Gate on 114D current+confirmed, no legacy fields, no 114F/Core/Steps. | No migration. Disable the 114E route/feature flag to roll back; no semantic data to backfill. |
| `124B` — verified conversion configuration/presentation | Server-owned versioned config facts, normalized conversion block, validated destination actions, availability disclosure, CTA-view/click events. | Requires a product owner to verify each destination's actual behavior. `NO_VERIFIED_DESTINATION` is the safe default and does not block 124A. | No migration. Disable destination config to hide CTAs; Path remains available. |
| `124C` — first-party submit, intent, and consent | Combined submit endpoint, idempotency, `PortfolioEntryConversionIntent`, submission-only consent, and narrowly scoped delivery to the verified first-party flow. | Requires a verified destination contract and retention owner/purpose. Context sharing remains disabled until the exact field scope and consent copy are approved. | One additive migration if durable intent is adopted. Roll back by disabling submit; preserve rows for authorized retention/deletion handling; do not drop submitted records as a runtime rollback. |

Use the existing event adapter for the allowlisted analytics catalog as the relevant read/config/submit slice is implemented. Provider durability can be a later operational choice. Do not make a separate E2E ticket a substitute for acceptance evidence in each slice.

## 22. Blockers

| Candidate | Classification | Treatment |
|---|---|---|
| Human approval of proposed KAN-122 boundary and KAN-123 Experience Contract | `BLOCKING` for runtime implementation | Both documents remain proposals. Architecture cannot promote them. |
| Separate implementation HU and implementation guardrail | `BLOCKING` for code | KAN-124 is architecture/audit only. |
| Demo destination verification | `BLOCKING` for a Demo CTA; `NON_BLOCKING` for derived Path | Keep `NO_VERIFIED_DESTINATION` and render no CTA until behavior is verified. A URL alone is insufficient. |
| Early Access destination design/verification | `BLOCKING` for an Early Access CTA; `NON_BLOCKING` for derived Path | No first-party Early Access flow is currently evidenced. Do not invent one here. |
| Consent architecture | `BLOCKING` for sharing context; `NON_BLOCKING` for Path and conversion without context | Use `NO_ENTRY_CONTEXT_SHARED` by default; no context goes to a destination without explicit scoped consent. |
| KAN-121 legacy sidecar/API seam disposition | `BLOCKING` until the implementation owner accepts the dedicated typed read boundary and negative leakage tests; legacy retirement is `OUT_OF_SCOPE` | Isolate 114E by construction; do not modify compatibility endpoints in this task. |
| ADR-003 discrepancy | `DEFER_TO_114F` | Preserve `ACCEPTED` vs `PROPOSED / OPEN / DEFERRED` conflict. 114E ends before product continuation. |
| 114F | `DEFER_TO_114F` / `OUT_OF_SCOPE` | No Portfolio Setup, organizational destination, Core, or Steps work. |
| Commercial intent/consent retention owner and purpose | `BLOCKING` for durable conversion submission | Define before persistent commercial submissions go live. This is not needed for a path-only read slice. |
| Analytics provider durability | `NON_BLOCKING` | Events may use existing optional adapter or be omitted until provider/retention is chosen; no raw semantics are required. |

An unverified commercial destination does not block the read-only Path slice if the UI discloses unavailable conversion and shows no CTA or consent control.

## 23. Risks

- The active Logic Contract has an existing delegation conflict with candidate Clarification/Handoff semantics. The projector must use only the accepted Critical Handoff projection and KAN-122/123 claims after approval.
- `CURRENT_STATE.md` and ADR-003 disagree with the accepted ADR index/document. This proposal leaves the conflict open.
- Current 114D materialization writes the legacy sidecar first. A generic handoff reader or mapper could leak legacy semantics unless the new source type, endpoint, and negative tests remain separate.
- A configured Demo URL can look verified even when the booking flow is unavailable. The server config must require an explicit destination fact check.
- A deterministic projector can still make an unsupported claim if the mapping table is too broad. Each node needs an allowed capability class, source basis, and explicit dependency.
- Even a short `decisionInView` may be sensitive. Context sharing is opt-in, previewed, purpose-bound, and absent by default.
- Conversion-intent metadata remains commercial data even without contact PII; retention and access ownership remain open until assigned.
- A Path generated before 114D becomes stale can be replayed by a client unless the GET and POST both recheck currentness and the client discards cached data.

## 24. Rollback strategy

- Option C writes no Path rows, so disabling 114E requires no semantic data migration or reversion of Critical Handoff artifacts.
- The read slice can be disabled at its route/feature boundary. Current 114D remains the last visible state; no fallback to legacy `starteria_path` is allowed.
- Conversion config rolls back by disabling the affected destination and returning `NO_VERIFIED_DESTINATION`; it must not modify the source artifact.
- A durable submit slice rolls back by disabling new submissions while preserving already accepted intent/consent rows for the approved retention process. Do not delete records as part of application rollback.
- Projection/boundary version changes create a new derived DTO. Old clients must receive a safe unsupported-version state rather than silently using a newer mapper against cached data.
- No rollback path creates Portfolio Setup, Core entities, Steps, or 114F state.

## 25. Architecture decision summary and implementation gate

This proposal selects a derived Path read model and a separate conversion submission record. It preserves 114D as the only semantic source, avoids a duplicated Path artifact, makes destination availability server-owned and keeps context sharing off unless a person explicitly opts in at submission. The choice is reversible for the read model and contains commercial write failures outside 114D.

Before runtime implementation, require human approval of KAN-122 and KAN-123; an implementation HU with scope and acceptance criteria; acceptance of the 114E typed source boundary and KAN-121 sidecar disposition; server-owned verified conversion facts for every enabled CTA; approved purpose/scope and retention ownership for durable conversion/consent data; implementation-level guardrail checks; and the unit, integration, E2E, and legacy-compat evidence listed above. The no-destination read Path may proceed without commercial destinations once its contract and source-boundary gates are accepted.

```text
RECOMMENDED_ARCHITECTURE: OPTION_C

SEMANTIC_PATH_PERSISTENCE: DERIVED
The Path is projected on read from the latest current confirmed Critical Handoff and pinned projector/boundary versions. No semantic Path row is written.

CONVERSION_INTENT_PERSISTENCE: PERSISTED
Persist only an accepted first-party conversion submission, bound to source and destination config versions. Clicks remain analytics events.

CONSENT_PERSISTENCE: SUBMISSION_ONLY
Keep consent transient and revocable until submit; atomically persist its exact scope/purpose with the accepted intent. Default is no context shared.

AUTH_FOR_PATH_VIEW: SESSION_OWNERSHIP
Only the claimed session owner may view a Path derived from the confirmed source. This uses the existing 114D ownership boundary without adding a general product-access grant.

IMPLEMENTATION_READY: YES_WITH_BLOCKERS
The architecture is ready for human review and implementation shaping. Runtime code remains blocked on proposal adoption, a separate implementation HU, accepted legacy isolation, and destination/retention gates for any commercial write. A read-only Path can use NO_VERIFIED_DESTINATION and omit all CTAs.
```
