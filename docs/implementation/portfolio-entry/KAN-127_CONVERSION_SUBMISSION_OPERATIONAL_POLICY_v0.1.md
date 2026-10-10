# KAN-127 — Conversion submission operational policy v0.1

**Status:** `PROPOSED_FOR_125E_IMPLEMENTATION_GATE`

**Scope:** 114E / KAN-125E first-party submission shaping only. This document changes no runtime, schema, route, UI, destination status, or legal policy.

**Baseline:** `origin/main` at `72782f68bf23926ea37c368a76867fdf2917e5ac` (PR #187 includes 125D).

**Decision class:** proposed product operating model; human acceptance is required before it authorizes 125E implementation.

## 1. Authority and precondition

The authority order is the [Authority Map](../../STARTERIA_AUTHORITY.md): factual [Core v0.2](../../../doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES%281%29.md) (`Base fundacional revisada / Por validar`), accepted product ADRs, the sole active [Portfolio Entry Logic Contract v0.1](../../../doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md), and the accepted/frozen [Critical Reasoning Experience Contract v0.1](../../experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md). KAN-126 adopts the [Business Capability Boundary](../../contracts/STARTERIA_BUSINESS_CAPABILITY_BOUNDARY_v0.1.md), [Starteria Path Experience Contract](../../experience/portfolio-entry/PORTFOLIO_ENTRY_STARTERIA_PATH_EXPERIENCE_CONTRACT_v0.1.md), and [KAN-124 architecture](KAN-124_STARTERIA_PATH_TECHNICAL_ARCHITECTURE_v0.1.md) only for bounded 114E. Jira [KAN-120](https://stateria.atlassian.net/browse/KAN-120), [KAN-125](https://stateria.atlassian.net/browse/KAN-125), [KAN-126](https://stateria.atlassian.net/browse/KAN-126), and [KAN-127](https://stateria.atlassian.net/browse/KAN-127) supply task scope. [CURRENT_STATE](../../../CURRENT_STATE.md), the [V2 Manifest](../../../STARTERIA_V2_MANIFEST.md), and the [125D report](KAN-125D_CONVERSION_PRESENTATION_REPORT.md) are status/evidence, not higher product authority.

**REPO_FACT:** Git history at this baseline integrates 125A (#180), 125B (#182), 125C (#185), and 125D (#187, commit `2e2c27d`). The 125D report still says “local/uncommitted”; CURRENT_STATE and Manifest still describe the earlier 125A-only snapshot. Those labels are stale relative to Git and executable files. This policy records the mismatch without silently promoting the full 114E slice to `IMPLEMENTED_VERIFIED`. The merged configuration has no destinations and normalizes to `NO_VERIFIED_DESTINATION`; Calendly is `UNVERIFIED`; PilotLead is `LEGACY_COMPAT`; 125E has no submission route. Consent semantics are already governed. 125E remains blocked until this proposed operating policy is accepted. ADR-003 remains open/deferred for 114F, outside this decision.

```text
CONFLICT
Contract: KAN-125 implementation sequence / KAN-126 scoped adoption
Requirement: read the integrated state before shaping 125E
Current document/code: CURRENT_STATE, Manifest and 125D report describe pre-merge/local snapshots; origin/main includes PR #187
Observed mismatch: the indices understate 125B–125D while runtime has read API, value UI and presentation
Risk: mistaking a historical snapshot for current implementation or certifying all 114E
Recommended treatment: UPDATE the indices in a separately authorized closure change; keep this policy scoped to 125E
Requires ADR: no
```

This is a governance/shaping task. The V2 change guardrail applies before **productive code**, which this task does not change. No 114F, Core, Steps, Landing, PilotLead, or destination activation follows from this document.

## 2. Commercial infrastructure audit

Classification describes suitability for 114E; `REUSE` means infrastructure only, never inherited commercial semantics.

| Mechanism / evidence | Class | Repo fact and treatment |
|---|---|---|
| Postgres/Prisma transaction pattern in `backend/modules/portfolio-entry-conversion/portfolio-entry-conversion.service.ts` | `ADAPT` | Atomic writes, idempotency and owner checks exist, but this legacy conversion creates Project/Core. Only the transaction technique is reusable. The service and route are not 114E receivers. |
| `backend/modules/pilot-leads/*`, `PilotLead` in `front/prisma/schema.prisma`, `/api/v1/public/pilot-leads` | `LEGACY` | Anonymous pilot-interest capture stores name, email, optional phone, proposal snapshot, pilot code, consent, and `retentionUntil`; claim/consume can create a Project. Its draft idempotency, pilot consent and continuation semantics do not apply to 114E. Keep compatible, do not import. |
| `backend/shared/mail/mailer.ts` and SMTP config | `REUSE` | Existing Nodemailer transport can deliver a secondary internal notice. It is disabled without SMTP host/from; it is not a durable receiver. |
| `pilot-lead.notifier.ts`, `PILOT_LEAD_NOTIFY_TO`, k8s backend notification settings | `ADAPT` | Shows best-effort email and non-PII event logging. Existing recipient/config is pilot-specific and does not designate an 114E owner. New bounded config and a privacy-reviewed template would be required. |
| Admin/contact inbox for 114E | `INSUFFICIENT` | No dedicated restricted 114E review surface or operational runbook was found. A tested restricted database review procedure is required if no inbox UI exists. |
| `backend/modules/portfolio-entry/portfolio-entry.router.ts` and 125B Path service | `REUSE` | 114E reads require Bearer auth, claimed session ownership and latest current/confirmed 114D source. A submit must recheck these in its own transaction. |
| `backend/modules/portfolio-entry/portfolio-entry-rate-limit.ts` | `ADAPT` | Per actor/IP and session in-memory limits exist; submit requires a distinct bounded limit. Multi-replica effectiveness must be assessed before activation. |
| `front/src/features/portfolio-entry/public/analytics.ts` | `INSUFFICIENT` | Current sanitizer is a denylist plus string length. 125E events require a positive field allowlist; email, contact, consent detail and semantic text must never enter analytics. |
| `AuditLog` and pilot capture audit events | `ADAPT` | IDs/enum metadata can provide traceability; `AuditLog` has free JSON, IP and user-agent fields, so 125E must explicitly suppress PII/context and apply its approved retention rule. |
| PilotLead retention / deletion | `LEGACY` | ADR-015 is `Proposed` and calls 180 days a proposal. Code sets `RETENTION_DAYS = 180` and `retentionUntil`; claim checks expiration. No production purge job for PilotLead was found. This is not an approved commercial PII policy for 125E. |
| CRM or external commercial webhook | `OUT_OF_SCOPE` | No 114E CRM receiver/integration was found. Existing webhooks serve AI/billing, not commercial submissions. No CRM architecture is required. |
| `backend/config/starteria-path-conversion.ts`, 125D DTO/UI | `ADAPT` | Versioned server-owned facts currently accept `EXTERNAL` targets only, default empty, with `contextSharingSupported: false`. They cannot assert first-party submission availability until 125E changes the config contract and tests the actual flow. |
| User identity (`req.user.email`, `User.email/name`) | `REUSE` for authentication only | Identity can help prefill a reviewed form, but claim/confirmation is not marketing opt-in. Do not silently copy profile fields into a commercial row. |

## 3. Existing consent boundary — preserve

**GOVERNED:** `NO_ENTRY_CONTEXT_SHARED` is the default; `SHARE_CONTEXT_WITH_CONVERSION` is an explicit opt-in. The maximum initial shared Entry context is **only `decisionInView` when present**. Its exact text must be previewed before opt-in. No raw conversation, hidden reasoning, provenance internals, provider/model metadata, full Critical Handoff, `finalReading`, or Path snapshot may be shared. The choice is bound to the exact purpose, destination, source and scope; it remains changeable/revocable until submit; it is written atomically with an accepted submission. Decline/absence leaves shared context empty. This policy does not reopen these semantics or turn ordinary contact submission into consent to share Entry context.

## 4. Receiver and purpose — recommended operating model

**PRODUCT_DECISION (proposed):** A first-party, access-controlled Postgres submission is the authoritative receiver. A separate SMTP notice to the configured commercial mailbox is secondary and best-effort. The accepted transaction determines user success; SMTP failure does not roll it back or justify a second submission. The notice contains submission ID, destination type and contact email only, not Entry context. The operational owner must have a restricted review/reconciliation procedure to find persisted submissions when mail fails. No CRM, external webhook, scheduler callback or third-party API is required to accept a first-party request.

| Option | Decision |
|---|---|
| Internal record only | Durable but currently no proven 114E review surface/owner; insufficient by itself for activation. |
| Internal record + email notification | **Preferred**: existing database and SMTP primitives, durable receipt plus actionable alert and retry/reconciliation path. |
| Direct email only | Reject: delivery failure loses the request and there is no authoritative idempotent receipt. |
| External CRM/webhook | Defer: no verified integration or need in this slice. |
| PilotLead | Reject: purpose, PII, retention and product continuation differ. |

Purpose identifiers are stable enums, not free text from the client:

| Destination | `purpose` machine ID | User-facing disclosure at submit |
|---|---|---|
| `DEMO` | `REQUEST_DEMO_CONTACT_V1` | “Usaremos tu correo para contactar contigo sobre una posible demostración de Starteria. Enviar la solicitud no reserva una cita.” |
| `EARLY_ACCESS` | `REQUEST_EARLY_ACCESS_CONSIDERATION_V1` | “Usaremos tu correo para valorar y responder a tu interés en acceso anticipado a Starteria. Enviar la solicitud no garantiza acceso.” |

The submit action confirms a **request to be contacted for that purpose**. It does not create an account, book a demo, accept someone into a pilot, grant access, or continue the product. A future third-party destination needs a separate verified receiving-flow and disclosure decision; it cannot be inferred from these first-party purposes.

## 5. Minimum PII and owner

**PRODUCT_DECISION (proposed):** `contact.email` is required. `contact.name` and `contact.organization` are optional. No phone, title/role, notes, free-form business context, profile snapshot, or automatic user-profile persistence. The authenticated email may be offered as a prefill only after the person can inspect/edit it; submission stores the **explicitly submitted** contact values. The server does not derive a contact address from the session when the field is absent.

| Field | Validation and normalization |
|---|---|
| email | Trim surrounding whitespace, lowercase the domain, validate email syntax, maximum 254 characters; reject control characters and CR/LF. Preserve the reviewed local part and compare the normalized full address for duplicate/fingerprint checks. |
| name | Optional; trim/collapse surrounding whitespace, 1–120 characters if provided; reject control characters. Empty becomes absent. |
| organization | Optional; same normalization, 1–160 characters if provided. Empty becomes absent. |

All fields use a strict server allowlist and bounded request body; the UI mirrors but does not replace server validation. No contact PII is returned in the public receipt.

**PRODUCT_DECISION (proposed):** `STARTERIA_COMMERCIAL_OWNER` is a deployment-owned role/config key, not a named employee or an authenticated Starteria product role. The accountable operator reviews accepted submissions, resolves mail failures, handles follow-up for the stated purpose, and executes deletion requests/expiry procedures. Configuration must identify a controlled mailbox or equivalent contact point plus an access-controlled review procedure and an explicit accountable person/team in the deployment runbook. No configured/tested owner means `VERIFIED_ACTIVE` is forbidden. `PILOT_LEAD_NOTIFY_TO` and the user's Portfolio Entry owner are not substitutes.

## 6. Narrow persistence boundary

**PRODUCT_DECISION (proposed):** One logical accepted `ConversionSubmission` is recorded only after all submit gates pass. To preserve KAN-124's prohibition on contact PII in `ConversionIntent`, implement it as narrow transactional metadata plus a protected contact payload/child record (physical schema chosen in 125E); the two are accepted/deleted together. An access-controlled operator retrieves contact by submission ID. No separate checkbox/consent row exists before an accepted submission.

```text
ConversionSubmission metadata
  submissionId; sessionId (ownership reference, no duplicate user ID)
  destinationType; destinationConfigVersion; purposeId; submittedAt
  status = ACCEPTED (delivery/review status is not a sales stage)
  criticalHandoffId; criticalHandoffVersion; sourceContextRevision
  projectionVersion; businessCapabilityBoundaryVersion; pathDtoVersion
  idempotencyKey or scoped digest; canonicalRequestFingerprint
  contextSharingMode; consentPurposeId; consentDestinationType
  consentedAt?; consentScopeVersion? (only for opt-in)
Protected contact payload, tied 1:1 to submission
  email; name?; organization?
  decisionInView? (only if present, previewed and opted in)
  retentionUntil (only after accepted retention policy is configured)
```

Do not store a semantic Path snapshot, raw conversation, complete 114D payload, hidden provenance, provider metadata, CRM history, sales stage, scoring, owner comments, engagement tracking, or click as durable intent. An accepted submission is a receipt, not proof of booking/contact/access. The owner-facing view must be restricted; the user-facing receipt exposes only opaque `submissionId`, `destinationType`, `status: RECEIVED`, and `submittedAt`. Any audit event contains opaque IDs, enums, versions and outcome only.

```text
CONFLICT
Contract: accepted KAN-124 §12, first-party 125E architecture baseline
Requirement: ConversionIntent must not duplicate contact email/PII
Current document/code: KAN-127 requires a usable first-party submission with an email contact; no 114E contact store exists
Observed mismatch: the conceptual contact field cannot be placed directly into the existing Intent shape without narrowing §12
Risk: silently broadening ConversionIntent into PilotLead/CRM or losing a contactable receiver
Recommended treatment: ADD a protected, minimal submission contact payload atomically linked to the Intent; keep Intent metadata PII-free; obtain explicit product acceptance of this bounded 125E design
Requires ADR: no Core/domain invariant change identified; revisit if 125E changes canonical domain relations
```

## 7. Retention and expiry

**REPO_FACT:** PilotLead has `retentionUntil` and code sets 180 days. ADR-015 calls 180 days a **proposal** and requests a purge process. No approved 114E commercial PII retention duration or PilotLead purge implementation was found. Session expiry and idempotency TTLs serve different purposes and do not determine contact retention.

**PRODUCT_DECISION (proposal only):** use a bounded **90-day** contact/optional-context retention clock from `submittedAt`, with `retentionUntil` and a tested purge that removes contact, `decisionInView`, and associated consent detail by that date. The operator may close follow-up earlier and erase sooner on a valid deletion request. Idempotency lookup and non-identifying audit metadata must have a separately approved expiry and must not preserve contact/context by another path. A backup deletion/expiry schedule and documented operator procedure are required; setting `retentionUntil` without a purge is insufficient.

**LEGAL/PRIVACY_DEPENDENCY:** 90 days is a product proposal, **not** a statement of legal retention, lawful basis, notice wording, or deletion sufficiency. Human product/privacy/legal owners must accept the duration, disclosure, access/deletion procedure, audit/backups treatment and any regional obligations before live PII persistence or a destination becomes `VERIFIED_ACTIVE`. Until then 125E may implement/test only behind disabled destination configuration with synthetic data and no production commercial writes.

## 8. Post-submit behavior

| Situation | Deterministic user-visible result | Write effect |
|---|---|---|
| Transaction committed | “Recibimos tu solicitud.” Show opaque receipt ID; no response-time, acceptance, access, pilot, onboarding or booked-demo promise. | One accepted submission plus consent choice/contact atomically. |
| Transient server/database error before commit | “No pudimos registrar la solicitud. Inténtalo de nuevo.” Preserve the same client idempotency key for retry. | No accepted submission. |
| Exact idempotent retry while source/config still valid | Return the original receipt; explain that the request was already received. | No second write/notification. |
| Same key, different canonical payload | Conflict; ask the person to review and submit a fresh request/key. | No write. |
| Source changed or Critical Handoff stale/unconfirmed | Conflict; return to current 114D/Path review. | No write. |
| Destination disabled, unverified, or config version changed | Unavailable/conflict; refresh Path and disclosure before a new choice. | No write. |
| Consent changed, revoked, or bound purpose/destination/scope/source changed before submit | Require the current explicit choice/preview; reject a stale opt-in. | No write. |
| Email notice fails after commit | The receipt remains valid; log a PII-free delivery failure for owner reconciliation. | Do not roll back or duplicate the accepted row. |

Commercial errors never alter 114D or the derived Starteria Path and never route into 114F/Core/Steps.

## 9. `VERIFIED_ACTIVE` gate and 125D config evolution

A destination may move to `VERIFIED_ACTIVE` only if **all** are evidenced for that exact destination and config version:

1. Valid, server-owned destination config and explicit product approval of type, audience, availability, next interaction and disclosure.
2. A tested operational first-party receiver, restricted review/reconciliation access and configured accountable `STARTERIA_COMMERCIAL_OWNER`.
3. Accepted destination-specific purpose copy, contact PII schema and existing context-sharing consent scope/preview.
4. Accepted metadata/contact persistence boundary, approved retention/deletion policy and privacy notice.
5. End-to-end tested owned-session submit, idempotent retry, stale/conflict rejection, atomic consent, storage, secondary notification failure and owner review path.
6. Security checks for auth, rate limits, logging/redaction, no PII analytics and no redirects controlled by the requester.

**REPO_FACT / implementation dependency:** 125D currently models only exact approved `EXTERNAL` HTTPS destinations with `contextSharingSupported: false`. A first-party submit target needs an explicit versioned config/DTO evolution under KAN-125E authority. Do not encode an internal route as an approved external URL, reuse Calendly, change a status flag alone, or interpret test URLs as verification. The config must still default to no destinations and fail closed. Existing external CTA behavior remains click/navigation only; a first-party receipt cannot prove an external booking. Demo and Early Access remain unavailable in this task.

## 10. Idempotency and transactional recheck

The client creates one opaque, unpredictable idempotency key per deliberate submit and reuses it for transport retries. The server scopes uniqueness to authenticated owner/session, destination type, **current source binding** (`criticalHandoffId`, artifact version, `sourceContextRevision`, projection/boundary versions) and key; it stores a canonical request fingerprint covering destination config version, purpose, normalized contact, consent mode/scope and optional `decisionInView`. A duplicate key with the same canonical body returns the original receipt only while the current source/config gates still pass. A changed body, source revision, handoff, destination version/status or consent binding yields a conflict with **no write**. A new deliberate request uses a new key. A database uniqueness constraint and one transaction resolve concurrent duplicate submits; a pre-read alone is insufficient. Never disclose contact data in conflict responses.

At submit time, in the write transaction and without trusting the previously rendered Path DTO, recheck:

1. Bearer-authenticated actor owns the claimed, unexpired session.
2. Latest Critical Handoff identity/version, `isCurrent`, `confirmationState: confirmed`, supported schema/conclusion state, and `sourceContextRevision == session.contextRevision`.
3. Current server-owned destination is `VERIFIED_ACTIVE`, receiver and owner gate hold, and `destinationConfigVersion` matches the viewed choice.
4. Purpose/destination/consent mode, exact optional field scope and preview binding match the submitted choice; derive shared `decisionInView` from the current server source, not arbitrary client text.
5. Idempotency uniqueness and canonical payload fingerprint, with no competing accepted write.

The transaction must prevent a concurrent source/config change from passing a stale check and committing. 125E must specify and test the database lock/compare-and-swap or equivalent isolation mechanism; reading outside the transaction is insufficient. If config cannot be read consistently with the transaction, compare its version again immediately before commit and fail closed on change. No independent consent write, email send, analytics event or notification occurs before acceptance commits.

## 11. Privacy and security boundary

- Collect only the stated contact fields and optional previewed `decisionInView`; no hidden Entry context, raw transcript, secrets, provider/model data or provenance internals.
- Authenticate with the current Bearer-token `authenticate` path and enforce `SESSION_OWNERSHIP` in the submit transaction. A session ID, anonymous token or 114D confirmation alone is not authorization. The current Bearer-protected Path flow does not authorize cookie-only submission. If 125E introduces cookie-authenticated writes, it requires a separate CSRF design; keep same-origin/CORS restrictions for the present model.
- Apply a distinct, bounded submit rate limit using the existing Portfolio Entry pattern, and assess cross-replica enforcement before activation. Validate strict body size/schema. Reject user-supplied receiver URLs, redirects, arbitrary purpose/scope and destination IDs.
- Log only opaque submission/session/source IDs, enum outcome, config version and request ID. Redact email, name, organization, `decisionInView`, consent payload, body, tokens and exception details that may echo them. Keep PII out of `AuditLog.details`, generic request logs, email subject if possible, analytics/dataLayer and telemetry; use a positive analytics allowlist.
- Restrict DB/contact and mailbox access to the operational owner. Encrypt at rest according to the approved infrastructure/privacy design; verify actual deployment controls before activation. No third-party context transfer is implicit in SMTP delivery.

## 12. Unresolved dependencies and authorization decision

| Type | Required resolution / owner |
|---|---|
| `PRODUCT_DECISION` | Human acceptance of this proposed receiver, purposes, PII limits, owner abstraction, protected contact split, retention proposal and user copy. KAN-127 is currently a proposal, not self-approval. |
| `LEGAL/PRIVACY_DEPENDENCY` | Approve lawful basis/notice, 90-day proposal or replacement, erasure and backup/audit treatment before production PII writes. |
| `OPERATIONAL_FACT` | Configure/verify accountable owner, controlled recipient, SMTP or equivalent alert, restricted review/reconciliation procedure, and actual receiving-flow test. |
| `IMPLEMENTATION_DEPENDENCY` | KAN-125E authority for narrow schema/write/config/DTO changes; retain `NO_VERIFIED_DESTINATION` by default, add transaction isolation and tests, then separately verify each destination for activation. |
| `GOVERNANCE_INDEX` | Reconcile stale CURRENT_STATE/Manifest/125D report labels in an authorized closure change; do not treat their snapshot as current runtime truth. |

**125E_IMPLEMENTATION_READY: `YES_WITH_DISABLED_ACTIVATION` — recommended conditional decision.** Once the human product owner accepts this policy and the KAN-125E technical scope, the write boundary may be implemented and tested with disabled configuration and synthetic data. This document alone does not grant that acceptance. Demo and Early Access remain `NO_VERIFIED_DESTINATION`; production PII persistence and `VERIFIED_ACTIVE` require the privacy/legal and operational facts above, plus tested submission. If the protected-contact split or retention proposal is rejected, return to shaping before coding that part. No CRM, 114F, Core or Steps authority is conferred.
