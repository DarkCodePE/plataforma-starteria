# P12-R1 Challenge Activation Brief — Technical Specification v0.1

**Status:** IMPLEMENTATION-READY — ADR-008 ACCEPTED  
**Date:** 2026-10-20  
**Scope:** P12-R1 PL-05 Briefs → PL-06 Assignment → existing Portfolio Handoff.  
**Out of scope:** Initiative identity, Route A/B/C semantics, Step 0–4, Decision Package, P12 certification.

## 1. Authority and implementation boundary

**AUTHORITY**

- **Path:** `doc/product-adr/ADR-008-challenge-activation-brief-versioned-handoff.md`, sections 3–12.
- **Exact quote:** “a Challenge-targeted Assignment must reference exactly one `briefVersionId` before it may be sent”.
- **Interpretation:** the Assignment retains the immutable mandate version used for Send; it is not a mutable payload copy.

**AUTHORITY**

- **Path:** `doc/product-adr/ADR-008-challenge-activation-brief-versioned-handoff.md`, section 5.
- **Exact quote:** “AI may propose or modify a draft proposal. AI cannot confirm a Brief version.”
- **Interpretation:** only a Portfolio Lead with `portfolio:write` may execute `Confirm Version`.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md`, R05.
- **Exact quote:** “frozen PL interaction sequence is preserved visually”.
- **Interpretation:** this slice supplies governed PL-05/PL-06 persistence; it does not alter the frozen sequence or Step behavior.

The present repository calls the tenant boundary `organizationId`. In this specification, **tenant = organization**. A Challenge’s effective tenant is `Challenge.strategicFront.organizationId`, as implemented by `challengeOrganization` in `backend/modules/portfolio/portfolio-resource-guard.ts`.

## 2. Keep / adapt / new

| Area | Disposition | Reason |
|---|---|---|
| `PortfolioHandoffAssignment` lifecycle | ADAPT | Add an optional immutable `briefVersionId`; preserve Send/Accept/Reject/Start behavior. |
| `PortfolioHandoffDeliveryAttempt` | KEEP | Existing `(assignmentId, idempotencyKey)` durable delivery retry continues to govern Send. |
| `PortfolioHandoffResponseCommand` | KEEP | It continues to govern Accept/Reject/Start only. |
| `requirePortfolioResource` / `portfolio:write` | ADAPT | Add Brief/Version resource resolution while retaining scope semantics. |
| `ChallengeActivationBrief` / Version | NEW | ADR-008 approved the canonical boundary. |
| durable pre-assignment command receipt | NEW, bounded | Existing response receipt requires an Assignment ID and cannot govern creation before one exists. Its key/fingerprint pattern is reused. |
| recipient Handoff projection | ADAPT | Read immutable referenced Version; do not duplicate it as canonical Assignment payload. |

## 3. Persistence model

### 3.1 Prisma models

`ChallengeActivationBrief`

| Column | Type / constraint | Purpose |
|---|---|---|
| `id` | `String @id @default(cuid())` | Canonical Brief identity. |
| `organizationId` | `String` indexed | Effective tenant; checked against the Challenge’s Front. |
| `challengeId` | `String` FK `Challenge(id)` RESTRICT | Exactly one semantic Challenge. |
| `createdByActorId` | `String` FK `User(id)` RESTRICT | Author of Brief identity. |
| `createdAt`, `updatedAt` | timestamps | Audit timing only. |

Indexes: `@@index([organizationId])`, `@@index([challengeId])`, `@@unique([id, organizationId])`.

`ChallengeActivationBriefVersion`

| Column | Type / constraint | Purpose |
|---|---|---|
| `id` | `String @id @default(cuid())` | Immutable version identity. |
| `organizationId` | `String` | Tenant scope retained with the Version. |
| `briefId` | `String` | Composite FK `(briefId, organizationId)` to Brief. |
| `challengeId` | `String` FK `Challenge(id)` RESTRICT | Required Challenge reference and scope check. |
| `versionNumber` | `Int` | Monotonic version sequence per Brief. |
| `status` | enum `DRAFT | CONFIRMED` | Confirmation is the only permitted state transition. |
| `intent`, `scope` | nullable `String` | ADR fields, no fabricated required content. |
| `strategicContextRefs`, `inheritedContext`, `constraintsSnapshot`, `knownGaps`, `sourceRefs`, `provenance` | `Json` | Structured envelope for only ADR-required context, refs, gaps and provenance. |
| `createdByActorId`, `confirmedByActorId` | `String`, nullable `String` FKs to User | Draft source and human confirmer. |
| `createdAt`, `confirmedAt` | timestamps | History. |

Constraints: `@@unique([briefId, versionNumber])`, `@@unique([id, organizationId, challengeId])`, indexes for `organizationId`, `challengeId`, `[briefId, versionNumber]`, `status`.

`PortfolioHandoffAssignment`

| Column | Change | Purpose |
|---|---|---|
| `briefVersionId` | nullable `String`, FK Version `id`, `onDelete: Restrict` | Historical assignments stay null; Challenge assignments require a confirmed, matching Version before Send. |

No mutable Brief document is copied into the Assignment. Assignment holds the durable reference; UI uses a read projection only.

`PortfolioActivationCommandReceipt`

| Column | Constraint | Purpose |
|---|---|---|
| `id` | PK | Receipt identity. |
| `organizationId` | indexed | Tenant-scoped key. |
| `commandType` | enum `CREATE_BRIEF`, `CREATE_VERSION`, `CONFIRM_VERSION`, `CREATE_ASSIGNMENT` | Bounded command namespace. |
| `idempotencyKey` | required | Retry key. |
| `fingerprint` | required | Rejects different payload under same key. |
| `actorId` | required | Audit. |
| `resultBriefId`, `resultVersionId`, `resultAssignmentId` | nullable refs | Durable original result. |
| `createdAt` | timestamp | Audit. |

Constraint: `@@unique([organizationId, commandType, idempotencyKey])`. This is the same durable key/fingerprint/result pattern as `PortfolioHandoffResponseCommand`, specialized because Brief creation has no Assignment ID yet. It is not a second product-level idempotency framework.

### 3.2 PostgreSQL constraints beyond Prisma

The migration must install these named trigger functions, tested directly in integration tests:

1. `assert_challenge_activation_brief_tenant()` on Brief INSERT/UPDATE: joins Challenge → StrategicFront and rejects unless `NEW.organization_id = strategic_front.organization_id`; rejects a Challenge whose effective organization is null for this new scoped object.
2. `assert_challenge_activation_brief_version_scope()` on Version INSERT/UPDATE: validates Version tenant and Challenge equal its Brief’s tenant and Challenge.
3. `enforce_challenge_activation_brief_version_immutability()` on Version UPDATE/DELETE:
   - permits only the one DRAFT → CONFIRMED transition, writing `confirmedByActorId` and `confirmedAt`;
   - rejects any content, provenance, Challenge, tenant or order change after creation;
   - rejects a second confirmation and status reversal;
   - rejects DELETE when a governed Assignment references the Version. Application exposes no delete command.
4. `assert_challenge_activation_brief_version_sequence()` on Version INSERT:
   - locks the owning Brief and requires `versionNumber = MAX(existing versionNumber) + 1`;
   - makes the per-Brief sequence append-only and monotonic while the unique index remains the final race guard.
5. `assert_challenge_assignment_brief_before_send()` on `PortfolioHandoffAssignment` INSERT/UPDATE of `state`, `briefVersionId`, `challengeId`, `organizationId`:
   - when target kind is `CHALLENGE` and state becomes `SENT`, requires non-null Version;
   - requires `Version.status = CONFIRMED`;
   - requires `Version.challengeId = Assignment.challengeId`;
   - requires `Version.organizationId = COALESCE(Assignment.organizationId, Challenge effective organization)` and the Assignment’s effective organization equals Challenge effective organization.

These DB checks supplement service validation so a direct SQL or future code path cannot create cross-tenant, cross-Challenge, unconfirmed or mutable governed references.

## 4. Commands and APIs

All write commands require authentication, `portfolio:write`, and resource scope ownership through the existing resolver. Command paths may follow repository conventions, but their semantics are fixed:

| Command | Request / result | Required behavior |
|---|---|---|
| Create ChallengeActivationBrief | `challengeId`, Idempotency-Key → Brief + first Draft Version or explicit no-content Draft Version | Validates Challenge tenant and creates exactly one Brief result for retry key. |
| Create/Edit Draft Version | `briefId`, payload, Idempotency-Key → new Draft Version | “Edit” creates a newly ordered Version; never updates existing payload. |
| Confirm Version | `versionId`, Idempotency-Key → CONFIRMED Version | Portfolio Lead human checkpoint; no AI route can invoke it. |
| Create Challenge Assignment | `challengeId`, `briefVersionId`, recipient, Idempotency-Key → CREATED Assignment | Validates confirmed matching Version before Assignment creation. Existing-Initiative target follows existing service and may use null. |
| Send Assignment | existing delivery route + Idempotency-Key | Reuses `PortfolioHandoffDeliveryAttempt`; performs scope/confirmed-version validation immediately before Send and DB trigger validates transition. |
| Read Brief / Version | resource-scoped | Portfolio Lead sees history; recipient only sees projection of Version referenced by an authorized Assignment. |
| Read Assignment projection | existing Handoff reader adapted | Includes immutable referenced Version projection, never a mutable Brief canonical document. |

The application service wraps each pre-assignment command and receipt insertion in one transaction. Existing durable delivery retry continues to be the sole receipt for Send.

## 5. Permissions and projections

- A scoped Portfolio Lead (`portfolio:write`) may create a Brief, create a Version, confirm a Version, create a Challenge Assignment and send it only for its organization’s Challenge.
- A recipient may read only the immutable Version through an Assignment they are authorized to read/claim. Recipient routes expose neither Brief editing nor confirmation.
- Existing `Accept`, `Reject` and `Start` permission and identity checks remain unchanged.
- Read projection fields are the referenced Version’s ADR fields plus its `id`, `versionNumber`, status and timestamps. `projection ≠ canonical source`; the Version remains the canonical record.

## 6. Transaction, idempotency and concurrency strategy

1. Calculate a canonical request fingerprint over actor, tenant, command type and normalized payload.
2. In a serializable transaction, look up the bounded receipt by `(organizationId, commandType, idempotencyKey)`.
3. Same fingerprint returns the original result; different fingerprint returns `409 IDEMPOTENCY_CONFLICT`.
4. For new Version, lock the Brief and compute `MAX(versionNumber) + 1`; unique constraint is a final race guard. Retry a serialization collision.
5. Confirm locks the Version, validates DRAFT, performs only DRAFT → CONFIRMED and records the receipt.
6. Create Challenge Assignment validates the confirmed matching Version and stores its ID in the same transaction as the receipt.
7. Send uses the existing delivery-attempt key and revalidates the Version immediately before state transition.

## 7. Migration plan

1. Add Prisma enum/models/relations and nullable `briefVersionId` to Assignment.
2. Generate additive Prisma migrations; append reviewed PostgreSQL trigger SQL, including the per-Brief version-sequence guard.
3. Do not backfill Briefs, Versions, provenance or assignment references.
4. Historical rows retain `briefVersionId = null`.
5. Apply only with `prisma migrate deploy`; verify `migrate status`; never `db push`.
6. Rollback uses code compatibility and leaves additive tables/references intact; no destructive migration is permitted in this slice.

## 8. Required verification

| Requirement | Verification |
|---|---|
| cross-tenant impossible | integration inserts/read requests across two organizations; DB trigger and API return rejection/not-found. |
| cross-Challenge Version impossible | attempt assignment using confirmed Version from another Challenge; API and trigger reject. |
| confirmed immutability | update/delete direct SQL attempts rejected; edit command produces a new version. |
| monotonic version numbers | concurrent version creation and retry leave unique ordered versions. |
| historical null retained | migration fixture existing Assignment with null remains readable. |
| new Challenge assignment Send rule | null and DRAFT version reject; matching CONFIRMED Version sends. |
| immutable recipient handoff | later Version does not alter prior Assignment projection. |
| idempotency | each command replay returns original entity and row counts stay stable. |
| authorization | recipient cannot create/edit/confirm; foreign tenant cannot read or use Version. |

## 9. Traceability and non-goals

This spec implements ADR-008 only. It does not add a new Initiative, alter Initiative cardinality, activate a Step, change Step 0–4 function, expand AI authority, create an organizational decision, or alter P12 criteria.
