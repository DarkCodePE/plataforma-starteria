# ADR-008 — Challenge Activation Brief: versioned Portfolio-to-Handoff context

**Decision ID:** `ADR-008`  
**Date:** 2026-10-20  
**Status:** `ACCEPTED — HUMAN APPROVAL RECORDED 2026-10-20`  
**Slice:** Portfolio Lead PL-05 Briefs → PL-06 Assignment → existing Portfolio Handoff  
**Decides:** the canonical, versioned Portfolio context used to invite a person or team to address a Challenge before an Initiative exists.  
**Implementation authority:** P12-R1 may implement this approved boundary only through its Tech Spec and verification plan. This ADR does not authorize changes to Step 0–4, Initiative Core, human/AI authority, creation of an Initiative, or P12 certification.

## 1. Problem

The frozen Portfolio Lead v1.0 experience requires a reviewed, editable and versioned brief before Portfolio Lead creates or sends an Assignment for a Challenge. The current `PortfolioHandoffAssignment` preserves handoff lifecycle but has no durable, versioned brief reference, source/constraint snapshot or provenance.

A frontend-only brief would disappear from the governed Handoff boundary. A mutable payload copied into Assignment would make history, reused invitations and the source of truth ambiguous.

## 2. Authority affected

**AUTHORITY**

- **Path:** `docs/e2e/sources/STARTERIA_PORTFOLIO_STEPS_HANDOFF_v1.0.zip`, `01_FROZEN_PORTFOLIO/02_IMPLEMENTATION_BEHAVIOR_CONTRACT.md`, §5.
- **Exact quote:** “Brief versionado con resultado, contexto heredado, fuentes, riesgos, límites, trabajo/entregable esperado, decisión solicitada.”
- **What it establishes:** Portfolio Lead needs a versioned pre-assignment brief, distinct from the Decision Package produced by an Initiative.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md`, §11.
- **Exact quote:** “PLF/PLB freeze a revisable brief before assignment.”
- **What it establishes:** reviewable Brief precedes Assignment; it does not authorize a duplicate Initiative or automatic hierarchy creation.

**AUTHORITY**

- **Path:** `doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md`, §1.
- **Exact quote:** “Accept no crea Project/Initiative.”
- **What it establishes:** Assignment lifecycle remains separate from Initiative identity and Core activation.

**AUTHORITY**

- **Path:** `docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md`, §26.
- **Exact quote:** “Detener la parte afectada cuando el cambio … altere cardinalidad canónica … [o] requiera migración material de dominio.”
- **What it establishes:** this persistence and cardinality change needs an approved ADR before implementation.

## 3. Decision

Adopt **Option C**: a canonical Portfolio object named `ChallengeActivationBrief`, with immutable `ChallengeActivationBriefVersion` records, referenced by Challenge-targeted `PortfolioHandoffAssignment` records.

The object carries the governed context that Portfolio Lead has confirmed for inviting work on a Challenge. It is neither:

```text
ChallengeActivationBrief
≠ Initiative Step 0 brief
≠ Initiative Decision Package
≠ organizational decision
≠ Initiative identity
```

The selected conceptual model is:

```text
Challenge
  1
  ↓
  N
ChallengeActivationBrief
  1
  ↓
  N
ChallengeActivationBriefVersion
  1
  ↓
  N
PortfolioHandoffAssignment
```

## 4. Domain model and cardinality

### 4.1 `ChallengeActivationBrief`

- belongs semantically to exactly one `Challenge`;
- may have zero or more `ChallengeActivationBriefVersion` records while it is being prepared and used;
- is the canonical owner of the Brief identity, not a second Challenge and not an Initiative.

### 4.2 `ChallengeActivationBriefVersion`

- belongs to exactly one `ChallengeActivationBrief`;
- is immutable once created;
- has a monotonically ordered version identity within its Brief;
- may support zero or more Assignments;
- preserves, at minimum:
  - Challenge reference;
  - applicable strategic/context references;
  - intent / expected outcome;
  - scope;
  - constraints;
  - material inherited context;
  - relevant known gaps / unknowns;
  - SourceRefs;
  - provenance;
  - `createdBy` / `confirmedBy`;
  - timestamps.

The required lifecycle state is limited to `draft` and `confirmed`. A later version does not mutate or erase an earlier version; its currency is derived by ordered version history, not by rewriting history.

### 4.3 `PortfolioHandoffAssignment`

- a Challenge-targeted Assignment must reference exactly one `briefVersionId` before it may be sent;
- one confirmed brief version may back multiple Assignments/invitations;
- a sent Assignment retains its referenced version even after a newer Brief version is created;
- an Assignment for an existing Initiative may have `briefVersionId = null` under the exception in §8.

## 5. Human and AI authority

AI may propose or modify a draft proposal. AI cannot confirm a Brief version.

Portfolio Lead performs the human checkpoint that confirms a version as suitable for Assignment. Confirmation does not create an Initiative, activate a Step, accept an Assignment, or start work.

The following operations remain distinct:

```text
Create Brief
≠ Confirm Brief
≠ Create Assignment
≠ Send
≠ Accept
≠ Reject
≠ Start
≠ Create Initiative
```

## 6. Lifecycle and version policy

```text
Challenge
→ create ChallengeActivationBrief
→ create draft version
→ Portfolio Lead review/correction
→ human confirms version
→ create Challenge Assignment referencing confirmed version
→ Send
→ recipient Accept / Reject
→ Start
→ downstream Route A formulation and human Initiative confirmation when applicable
```

Editing produces a new immutable version; it never overwrites the previous one. Provenance and history remain available across versions. A confirmed version remains valid historical evidence for an Assignment that already references it, even if the Brief subsequently gains another version.

## 7. Assignment relation

For a Challenge invitation, the server must reject Create/Send when no confirmed `briefVersionId` is present. The referenced version is the Assignment's durable mandate reference for that invitation.

The reference does not collapse Handoff transitions:

- Create or confirm Brief does not create or send Assignment.
- Create Assignment does not send it.
- Send does not accept it.
- Accept does not Start work and does not create an Initiative.
- Start does not create an Initiative or activate a Step.

The existing P6 Route A/B/C rules remain unchanged.

## 8. Existing-Initiative exception

The existing-Initiative path remains distinct:

```text
Existing Initiative
→ owner/team
→ Assignment
```

It does not require `ChallengeActivationBrief` by default. Its governed Initiative identity, sources, history and existing mandate/context remain authoritative. This ADR does not prohibit an explicit future Brief association where separately approved; it does not add one.

## 9. Provenance and history

Each version retains the minimum fields in §4.2 and never deletes the source/provenance/history of an earlier version. SourceRef remains distinct from validated evidence. A version carries user-confirmed versus AI-proposed provenance; AI output cannot promote itself to human confirmation.

## 10. Idempotency

The implementation must provide idempotency for:

- create Brief;
- create version;
- confirm version;
- create Assignment;
- send Assignment.

For the same command type, idempotency key and command fingerprint, retry returns the original durable result. A fingerprint mismatch for the same key conflicts. A retry must not create an extra Brief, version, Assignment or invitation.

This ADR requires the behavior but does not choose its physical receipt table or command API. The implementation must reuse existing durable-command conventions where compatible or propose the smallest additive mechanism in the subsequent Tech Spec.

## 11. Migration

Migration is additive:

1. add the `ChallengeActivationBrief` and `ChallengeActivationBriefVersion` persistence required by §4;
2. add nullable `briefVersionId` to `PortfolioHandoffAssignment` with its scoped foreign-key relation;
3. preserve historical Assignments with `briefVersionId = null`;
4. require a confirmed `briefVersionId` only for newly created Challenge-targeted Assignments before Send;
5. do not backfill invented Briefs or provenance for historical Assignments.

No migration in this ADR changes Project/Initiative identity, Step state, existing Initiative history, or existing Assignment state.

## 12. Security and tenant isolation

Every command must validate:

- Portfolio Lead authority to act on the Challenge;
- same organization/tenant scope among Brief, BriefVersion, Challenge and Assignment;
- scoped access to inherited context and SourceRefs;
- recipient identity and existing Assignment authorization rules;
- no cross-tenant discovery through version IDs or assignment references.

Read models may expose only the Brief version appropriate to the viewer's existing Handoff/Portfolio permissions. A Brief reference must not bypass Challenge, Initiative, evidence or tenant authorization.

## 13. Alternatives considered

### A. Brief stored only in frontend

**Decision:** REJECTED.

It cannot provide governed persistence, immutable versioning, provenance, Assignment reuse, retry safety or recipient-visible mandate continuity.

### B. Mutable Brief payload copied directly into Assignment

**Decision:** REJECTED.

It could only preserve history by duplicating canonical truth per Assignment. A mutable copy creates divergence between invitations and cannot support one version backing multiple Assignments without another source of truth.

### C. Canonical versioned `ChallengeActivationBrief` plus Assignment reference

**Decision:** SELECTED / ACCEPTED.

It keeps a single Brief identity per Challenge context, preserves immutable version history, permits one version to support multiple invitations, and preserves Assignment as the owner of Send/Accept/Reject/Start.

### D. Reuse end-of-cycle Initiative Decision Brief

**Decision:** REJECTED.

The Decision Brief/Package is produced from Initiative learning after execution; `ChallengeActivationBrief` is Portfolio context delivered before an Initiative exists. Their lifecycle, authority and semantic purpose differ.

## 14. Consequences

### Positive

- frozen PL-05 and PL-06 gain a governed persistence boundary;
- Assignment can retain the exact confirmed mandate used at Send;
- later edits preserve history rather than rewrite past invitations;
- reusing a version avoids copying mutable payloads into every Assignment;
- Route A retains its human confirmation boundary before Initiative creation.

### Costs and risks

- additive persistence, migration, authorization and idempotency work are required;
- version ordering and confirmation race conditions need transactional tests;
- UI must not imply that a confirmed Brief is an Initiative, Step or decision;
- legacy Challenge assignments with null reference require explicit compatibility handling.

## 15. Out of scope

- Step 0–4 and Initiative Core;
- changing Route A/B/C;
- automatic Front, Challenge or Initiative creation;
- decision authority or Decision Package semantics;
- ROI, impact attribution or Benefit Tracking;
- the detailed UI, endpoint paths, event schema, receipt storage or migration SQL;
- P12 staging deployment or final certification.

## 16. Acceptance implications for P12-R1

If approved, P12-R1 may plan and implement the smallest vertical slice that proves:

1. a Portfolio Lead creates, edits and human-confirms an immutable ChallengeActivationBriefVersion;
2. a new Challenge Assignment references a confirmed version before Send;
3. the recipient sees the correct referenced mandate through Handoff;
4. later Brief versions do not alter already-sent Assignment references;
5. retries do not duplicate Briefs, versions, Assignments or invitations;
6. legacy/existing-Initiative Assignment remains compatible with `briefVersionId = null`;
7. tenant and permission boundaries hold.

This accepted ADR authorizes P12-R1 technical planning and implementation of this boundary. It does not mark any P12 scenario as passed or authorize final certification.

## 17. Open implementation questions after approval

These questions do not alter the selected domain boundary and must be answered in the subsequent technical plan:

1. whether the smallest idempotency receipt adaptation can reuse an existing durable receipt convention or needs additive storage;
2. the exact database constraint/index strategy for Challenge-targeted Assignment plus `briefVersionId`;
3. the API command shapes and permission policy that expose only confirmed versions to assignment creation/send;
4. the exact read projection for recipient Handoff without copying a mutable canonical Brief payload.
