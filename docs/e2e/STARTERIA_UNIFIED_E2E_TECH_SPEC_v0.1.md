# Starteria Unified E2E — Tech Spec v0.1

**Status:** `FROZEN_FOR_P6_IMPLEMENTATION`. **Date:** 2026-10-20. **Scope:** technical implementation plan for the P2 frozen experience, not a domain change. **Canonical checkout:** `starteria-KAN-153-recovery-ux`, `feat/KAN-153-recovery-ux@1e689ea5c54f7513e323e30f58e45e7168738c7c`.

## 1. Authority and planning boundary

| Authority | Exact evidence | Consequence for this plan |
|---|---|---|
| Core factual v0.2 | `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, INV-02: “Starteria no debe inferir silenciosamente el alineamiento estratégico.” | Confirmation and material alignment require an already-authorized human; this plan grants no authority. |
| Core factual v0.2 | INV-10: “No se sobrescribe silenciosamente la historia.” | Route B retains Project identity, sources, evidence and versions. |
| Core factual v0.2 | INV-11: “conservar el contenido existente” | Reconstruction exposes gaps and does not retroactively approve Steps. |
| Core factual v0.2 | §21 Step 4: “El output de Step 4 no es por sí mismo la decisión organizacional.” | Decision package, decision request and human decision remain separate. |
| ADR-005 | `doc/product-adr/ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md`, §1: “Accept does not create a Project/Initiative”; Start records `handoff_assignment_started`. | Keep Assignment separate; Route A never creates an Initiative from Accept or Start. |
| Frozen P2 | `STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md`, §§13–15 | Implement approved Route A/B/C experience without new cardinality, actor authority or Step semantics. |
| P3 contracts | `STARTERIA_E2E_REASONING_ENGINE_CONTRACT_v0.1.md` §§5–12; `STEPS_COPILOT_REASONING_AND_CARD_CONTRACT_v0.1.md` §§3–10 | Reuse audited services and make semantic Card updates versioned and reviewable. |

`docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` remains `CANDIDATE`; it is not used to authorize this plan. INT-01 is not used. This plan does not approve an ADR, an API, a schema change, a human role, or a runtime result.

## 2. AS-IS inventory and KEEP / ADAPT / REPAIR / NEW

| Area | AS-IS code evidence | Disposition | Planned outcome |
|---|---|---|---|
| Initiative identity | `front/prisma/schema.prisma:646` `Project`; `backend/modules/projects/project.service.ts` `createProject` | **KEEP / ADAPT** | `Project` remains the canonical Initiative identity; add only governed origin/link/snapshot data needed by routes. |
| Handoff assignment | `front/prisma/schema.prisma:1616`; `backend/modules/portfolio-handoff/portfolio-handoff-invitation.router.ts` | **ADAPT** | Preserve Assignment, Accept, Reject and Start; add controlled continuation/confirmation after Start. |
| Command idempotency | schema `PortfolioHandoffResponseCommand`, `@@unique([assignmentId,type,idempotencyKey])` | **KEEP / ADAPT** | Reuse durable command receipt semantics for confirm/retry; return original result for same fingerprint. |
| Core outputs / review | schema `AdaptiveStepOutput`, `InitiativeCycle`, `CriticalChange` | **KEEP / ADAPT** | P7 makes Step 0 use P3 delta/version/review rules without changing stable Step functions. |
| Truth / provenance | `backend/modules/truth/truth.service.ts` | **KEEP / ADAPT** | Reuse claim/source/evidence lifecycle; never use Card prose as evidence. |
| Help / attention | schema `HelpRequest` and `AttentionItem`; portfolio bootstrap attention projection | **KEEP / ADAPT** | P9 evaluates reuse first; no canonical `SupportRequest` is introduced by this plan. |
| Decision / return | schema `DecisionRequest`; existing decision and portfolio-return modules | **KEEP / ADAPT** | P10 connects a package to an authorized human decision and causal Portfolio projection. |
| Route A candidate formulation | no post-Start continuation implementation evidenced by P1 | **NEW** | Noncanonical candidate/snapshot and explicit confirmation checkpoint. |
| Route B reconstruction | no E2E evidence | **NEW / ADAPT** | Read-only recovery of same Project history plus explicit gaps/review. |
| Route C independent entry | current `createProjectSchema` permits optional Challenge fields | **ADAPT** | Confirmation flow that does not require fictitious corporate hierarchy. |
| Semantic Copilot/Card | existing outputs but no P3 compliant behavior observed | **ADAPT** | P7 golden slice first, then P8 extends it. |

## 3. Canonical ownership and IDs

| Object / ID | Canonical owner | References allowed | Rule |
|---|---|---|---|
| `PortfolioHandoffAssignment.id` | Handoff bounded context | Project/Challenge IDs, mandate snapshot version | Assignment lifecycle is not Initiative lifecycle. |
| `Project.id` (Initiative ID) | Project/Initiative Core | Assignment `initiativeId`, cycles, evidence, decisions | One existing Project is reused for Route B; Route A/C create one only at confirmation. |
| `Challenge.id` / Front refs | Portfolio/Core | Assignment and Project contextual references | Never fabricated by Route C. |
| `mandateSnapshotId` / versioned envelope | Assignment continuation record | SourceRefs / Challenge refs, never duplicate entities | Immutable after confirmation; later changes become a new version. |
| `InitiativeCycle.id` / Step output IDs | Adaptive Core | Project and output refs | No retroactive approval from reconstructed content. |
| `DecisionRequest.id` | Decision bounded context | Package, Project, Portfolio reading | Decision actor and effects must be causally linked. |
| `HelpRequest.id` / `AttentionItem.id` | Existing services | Project/Portfolio read model refs | P9 must reuse/adapt only if authority and semantics fit. |

## 4. State machines and conceptual commands

### 4.1 Assignment

`PENDING/INVITED → ACCEPTED | REJECTED`; `ACCEPTED → STARTED`. The existing routes remain the command boundary: `POST /portfolio-handoff/:assignmentId/accept`, `reject`, `start` with expected version and idempotency receipt. Each command checks recipient identity and current state; duplicate identical command returns the original result, and a mismatched replay conflicts. No command creates a Project before Route A confirmation.

### 4.2 Route A — Candidate formulation and confirmation

`STARTED assignment with no initiativeId → FORMULATION_DRAFT → PENDING_CONFIRMATION → CONFIRMED | REWORK_REQUIRED`.

Proposed P6 commands: `saveInitiativeFormulationDraft`, `submitInitiativeFormulation`, `confirmInitiativeFormulation`, `requestFormulationRework`.

* Drafts are noncanonical formulation state associated with the started Assignment and source/versioned mandate. They are not a Project.
* Confirmation checks an `InitiativeConfirmationAuthority` policy port. It must deny when it cannot establish authority from existing approved role/decision rules; it grants no default Portfolio Lead or Owner permission.
* The confirmation transaction locks/reloads the Assignment, checks that `initiativeId` is null, writes a command receipt, creates one `Project`, links that ID once, persists mandate snapshot/source references, and emits `initiative_confirmed_from_handoff`.
* Same idempotency key plus same payload returns the same Project ID. Any existing linked ID wins; a different payload/key is conflict, never a second Project.

### 4.3 Route B — Existing / inherited Initiative

`STARTED assignment with initiativeId → RECONSTRUCTION → CONTINUITY_REVIEW_REQUIRED → OVERVIEW → current governed Core state`.

The read model loads the linked Project, sources, evidence, claims, snapshots, cycles and outputs by the same `Project.id`. It calculates missing context as gaps; it does not mutate historical work or mark an inferred Step approved. If an active cycle exists, display its governed current state. If no safe active state is available, Overview is `continuity_review_required`; P6 must not autonomously choose, reopen or approve a Step. This is the technical expression of Core history/gating constraints, not a new stable Step rule.

### 4.4 Route C — Independent Initiative

`independent formulation draft → PENDING_CONFIRMATION → one Project → Overview → Core`.

Use the same confirmation policy and durable idempotency approach as Route A, with an explicit `origin=INDEPENDENT` (or compatible existing value). Challenge/Front references are nullable and no corporate context is synthesized. The existing project creation schema’s optional Challenge input is compatibility evidence, not authorization for bypassing confirmation.

### 4.5 Step and decision boundaries

P7 starts only after P6: `Step 0 input → semantic interpretation → proposed delta → authority/review gate → versioned structured output → checkpoint`. P8 extends the unchanged Core functions to Steps 1–4. P10: `Step 4 package → DecisionRequest/equivalent → authorized human decision → versioned Portfolio reading/effect`. No automatic decision or effect is permitted.

## 5. Permissions matrix

| Action | Permitted actor / predicate | Deny condition | Audit requirement |
|---|---|---|---|
| Assign | existing Portfolio authorization | unauthenticated or no Portfolio authority | actor, mandate version, target |
| Accept / Reject / Start | invited/assigned Initiative Owner under existing recipient check | identity mismatch or stale/invalid state | actor, expected version, command receipt |
| Save formulation | accepted/started assignee (Route A) or eligible independent initiator | no started assignment / invalid initiator | draft version, source refs |
| Confirm formulation | only `InitiativeConfirmationAuthority` result from existing approved authority | no affirmative policy evidence | confirmer, basis, snapshot, command receipt |
| Read/reconstruct Route B | Project access policy | cross-tenant/member denial | actor/project/assignment refs |
| Mutate Step state | Initiative Owner plus existing Core gate/validator | Portfolio-only signal or unmet gate | output/cycle/version/reviewer |
| Signal support | authorized Project participant | no Project access | signal source and resolver scope |
| Decide | existing decision authorization by decision type | recommendation, AI identity, or missing authority | decision actor/package/evidence/effect |

This matrix deliberately leaves exact existing role-to-policy mapping for P6/P11 code inspection. It cannot grant human authority by configuration default.

## 6. Persistence, migrations and idempotency

P6 may introduce the smallest additive persistence required for a candidate formulation/mandate snapshot/confirmation receipt, preferably reusing `PortfolioHandoffAssignment`, `PortfolioHandoffResponseCommand`, `Project`, semantic event storage and existing source relations. No separate Initiative identity, Corporate hierarchy, or `SupportRequest` table is approved.

| Concern | Strategy | Migration risk / control |
|---|---|---|
| Route A exactly once | durable receipt + Assignment-to-Project link checked in one transaction | concurrent confirmation; unique/link constraint and transactional re-read; migration tested against legacy rows |
| Route B same identity | reuse non-null `assignment.initiativeId`; read existing relations | orphan/invalid link; reject and surface gap, never create replacement |
| snapshots/history | append immutable version envelope with source refs | accidental overwrite; append-only/version checks and diff test |
| confirmation authority | policy adapter returns allow with basis or deny | accidental broad grant; deny-by-default authorization test |
| retries | idempotency key plus request fingerprint and result ID | reused key with changed payload; deterministic conflict |
| tenancy | scope every read/write through existing tenant/project policy | cross-tenant leak; P11 integration/E2E tests |
| Card deltas | persist structured version before rendering as current | partial update/duplicate; transaction and retry test |
| events/read models | append semantic event then project bounded Portfolio reading | duplicate/out-of-order event; idempotent projection keyed by event/version |

Migration must be additive, backfill only from source-backed data, reversible where possible, and validated on an isolated DB. Any needed change to Project cardinality, source-of-truth identity, human/AI authority, stable Step gates/functions, or impact maturity stops for ADR.

## 7. API / read-model plan

Names below are candidate implementation seams, not frozen public API.

| Phase | Command/read model | Inputs / result | Invariants / test level |
|---|---|---|---|
| P6 | continuation read after `start` | assignment ID → route kind, linked Project ID/null, snapshot/gaps | never infer Project from Start; unit + integration |
| P6 | formulation draft / submit / confirm | expected version, idempotency key, source refs → same/durable Project ID | Route A/C exactly one; integration + DB assertions |
| P6 | Route B reconstruction read | assignment + Project → history/gaps/current governed state | same ID/no historical writes; integration |
| P7 | semantic Card delta command | input, recovered refs, proposed typed delta → version/review | P3 adverse cases; unit + integration |
| P8 | Step handoff read | Project/cycle → prior outputs/evidence/gaps | no repeated confirmed-context question; integration |
| P9 | support/attention adapter | Project signal → existing HelpRequest/AttentionItem-compatible reading | Portfolio cannot mutate Step state; integration |
| P10 | decision return projection | DecisionRequest/human decision → Portfolio causal reading | recommendation differs from decision; integration |
| P11 | policy/idempotency endpoints | cross-tenant/role/retry requests | denied access/no duplicate effects; integration/E2E |
| P12 | deployed journey | actor actions and persisted IDs | runtime evidence only; browser/DB/log artifacts |

## 8. Event and read-model plan

Each event carries stable aggregate ID, tenant scope, actor/principal, causation/correlation ID, version, time, source/snapshot refs and idempotency identity where applicable. Candidate events: `handoff_assignment_accepted`, `handoff_assignment_rejected`, `handoff_assignment_started`, `initiative_formulation_submitted`, `initiative_confirmed_from_handoff`, `initiative_reconstruction_requested`, `step_output_versioned`, `support_signaled`, `decision_requested`, `human_decision_recorded`, `portfolio_reading_updated`. These are implementation candidates; the existing event conventions must be reused after P6 inspection.

Portfolio receives an intentionally narrow reading: Initiative state, cycle/Step, milestone, blocker/attention, evidence signal, expected/observed/attributed status, decision requested/recorded and causal reference. It never receives the full Steps workspace and cannot mutate `StepState` except through an authorized Core command.

## 9. Test plan and phase gates

| Requirement slice | Focused tests | Required evidence / gate |
|---|---|---|
| P6 A/B/C | state transition, authorization policy, idempotent confirm, same-ID reuse, DB transaction, browser boundary | unit + integration + DB assertions + isolated runtime E2E; no duplicate Project |
| P7 Step 0 | context recovery, unknown, irrelevant text, contradiction, new source, retry, AI unavailable, insufficient input | unit/integration plus runtime where environment restored; all P7 adverse tests pass |
| P8 Steps 1–4 | handoff/evidence/review/version tests by Step | functional and negative tests pass; no Step function change |
| P9 support | owner signal, Portfolio reading, no direct Step mutation | policy/integration tests |
| P10 decision/return | package→request→human actor→Portfolio effect, impact maturity | integration + causal audit assertion |
| P11 | tenants, roles, Accept/Start/confirm/upload/decision retries | integration plus isolated browser tests |
| P12 | 15 Master Goal scenarios | deployed browser/API/DB/log/HAR/screenshot evidence; all critical runtime scenarios pass |

After every vertical slice run focal tests, typecheck, lint, affected integration suite, `git diff --check`, and update the traceability matrix and ledger. P1’s Docker, bcrypt, DB/tenant, actor/session, AI runtime and deployment blockers remain unresolved and must be fixed or externally supplied before a runtime-required gate is passed.

## 10. ADR boundaries and implementation stop rules

No ADR blocker is created by this plan because it specifies deny-by-default and reuse/adaptation without changing Core invariants. Stop P6–P12 and request an ADR before implementing any change that:

1. changes Project/Initiative cardinality or canonical identity;
2. makes Start create a Project or bypasses human confirmation;
3. grants confirmation/decision authority to a role not already authorized;
4. changes a stable Step function, gate or retrospective approval rule;
5. grants AI organizational authority;
6. changes evidence/impact maturity or attribution rules; or
7. establishes a material canonical SupportRequest object.

## 11. P5 acceptance criteria

| AC | Evidence | Result |
|---|---|---|
| P5-AC01 | §§2, 4, 7 map every P2/P3 slice to a candidate seam | PASS |
| P5-AC02 | §2 KEEP/ADAPT/REPAIR/NEW inventory | PASS |
| P5-AC03 | §§4, 7 candidate commands/read models | PASS |
| P5-AC04 | §3 IDs and ownership | PASS |
| P5-AC05 | §4 state machines | PASS |
| P5-AC06 | §6 persistence/migration controls | PASS |
| P5-AC07 | §6 migration risks | PASS |
| P5-AC08 | §5 permission matrix | PASS |
| P5-AC09 | §§4, 6 idempotency strategy | PASS |
| P5-AC10 | §8 event/read-model plan | PASS |
| P5-AC11 | §9 requirement-linked tests | PASS |
| P5-AC12 | §10 ADR stop rules; no unresolved ADR required to begin P6 | PASS |

**P5 gate:** PASS for technical planning only. P6 may implement the approved post-Start vertical slice. This document does not clear P1 runtime blockers or certify any runtime behavior.
