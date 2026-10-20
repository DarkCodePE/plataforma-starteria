# Starteria E2E — Reasoning Engine Contract

**Version:** v0.1  
**Status:** FROZEN_FOR_P4_AND_P5_PLANNING  
**Phase:** P3 — AI Reasoning + Card Contract  
**Scope:** shared reasoning behavior for Portfolio Entry, Portfolio Lead, Handoff, post-Start formulation/reconstruction, Initiative Core, Steps 0–4, Decision and Portfolio return.  
**Not an authority to:** change Core v0.2, create a canonical entity, select a cycle/Step for an inherited Initiative, decide organizational outcomes, grant permissions, approve an ADR, or authorize implementation.

## 1. Authority and contract boundary

| Source | Classification | Exact quote | Contract consequence |
|---|---|---|---|
| `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, INV-04 | APPROVED_AUTHORITY | “el estado confirmado debe vivir en objetos estructurados y versionados.” | Conversation is interaction, never the confirmed record on its own. |
| same, INV-05 | APPROVED_AUTHORITY | “Un resumen generado por IA no se convierte automáticamente en fuente de verdad.” | An AI summary is an interpretation with provenance, never its own evidence. |
| same, INV-09 | APPROVED_AUTHORITY | “Suficiencia no equivale a completar formularios” | Sufficiency is criteria/gate based, never a turn count. |
| same, INV-10 | APPROVED_AUTHORITY | “No se sobrescribe silenciosamente la historia.” | Material information preserves history and may trigger review. |
| `docs/e2e/STARTERIA_E2E_CODEX_CONTEXT.md`, §§9–16 | APPROVED_AUTHORITY for Goal execution | “RECEIVE INPUT” → “PERSIST VERSIONED STRUCTURED STATE” | Defines the governing shared flow, knowledge classes, context recovery, intervention and Card semantics. |
| `docs/e2e/STARTERIA_UNIFIED_E2E_EXPERIENCE_CONTRACT_v0.1.md`, R24/R26/R33 | FROZEN_TOBE_FOR_IMPLEMENTATION_PLANNING | “conversation not system of record” | P3 completes reasoning details without changing the frozen E2E spine. |

**Core status:** Core v0.2 remains factual/current. `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` v0.3, INT-01 and Entry-specific candidate Agent/Skill Contracts do not govern this contract.

## 2. Purpose and non-scope

The engine turns a relevant input into a proposed, typed and reviewable state delta. Specialized capabilities decide the Step or surface-specific content. A human or existing Core gate confirms material state where required.

This contract does not define JSON/DB/API shapes, prompt templates, model routing, idempotency storage, a new agent, automatic progression, or a new authority. Those are P5 design decisions and later implementation work.

## 3. Three-layer architecture

| Layer | Responsibility | Must not do |
|---|---|---|
| Shared Reasoning Engine | recover allowed context; interpret input; classify knowledge; detect change/gap/contradiction/unknown; choose a proposed intervention; emit a proposed delta and sufficiency/review assessment | become organizational decision-maker or canonical source of truth |
| Specialized capability | apply the engine to Entry, Portfolio Lead, Handoff, formulation/reconstruction, each Step, Decision or Portfolio return | duplicate shared provenance, classification or versioning logic incompatibly |
| Governance | enforce source/claim/evidence/review distinction, human authority, Step gates, versioning and access boundaries | infer approval from a conversation, model confidence or visual completion |

## 4. Shared reasoning flow

Every relevant input follows this ordered logical flow. Nodes may share one implementation call, but none may be skipped semantically.

```text
RECEIVE INPUT
→ RECOVER ALLOWED RELEVANT CONTEXT
→ INTERPRET INPUT
→ CLASSIFY KNOWLEDGE
→ DETECT CHANGE / GAP / CONTRADICTION / UNKNOWN
→ IDENTIFY CURRENT DECISION OR UNCERTAINTY
→ SELECT INTERVENTION
→ PROPOSE STRUCTURED DELTA
→ EVALUATE SUFFICIENCY / RISK / AUTHORITY
→ REQUIRE HUMAN CONFIRMATION WHEN REQUIRED
→ PERSIST VERSIONED STRUCTURED STATE
→ HAND OFF WITH PROVENANCE
```

### 4.1 Input envelope

Conceptually, an input is `content + actor + channel + time + context reference + source references when supplied`. It may be a user answer, imported evidence, system event, existing structured state, or a human decision. The engine labels missing metadata as `unknown`; it does not manufacture it.

### 4.2 Context recovery order

Before asking, recover only context the actor is allowed to use, in this order: canonical current state; mandate/brief and current snapshots; prior confirmed Card/output; linked SourceRefs/evidence; current conversation; prior decisions; permitted organizational context. A stale item is context, not current truth, until currentness is assessed.

If the answer is already confirmed and current, do not ask it again. If it is present but conflicting or stale, surface the conflict/currentness question rather than replacing it.

## 5. Knowledge classification

The minimum semantic types are below. A capability may add display labels but may not collapse these types into one another.

| Type | Meaning | May satisfy a required fact/evidence field? | Required handling |
|---|---|---:|---|
| user-declared fact | statement asserted by a user | only when authority/rules permit | retain actor/time/source and review state |
| extracted claim | statement extracted from a source | no, until validation rules say otherwise | link source and extraction provenance |
| observation | recorded result of execution/measurement | only with source/method as applicable | retain observed time and source |
| hypothesis / assumption | provisional explanatory or planning statement | no | display as provisional; do not render as fact |
| AI inference / suggestion | model interpretation or recommended action | no | retain model/provenance; never auto-confirm |
| unknown / ambiguity | material absence or unresolved meaning | no | keep explicitly unknown; select ASK/INVESTIGATE/STOP as appropriate |
| contradiction | incompatible claims/evidence/context | no | preserve both sides, sources and resolution status |
| constraint / dependency / blocker | bound or external condition affecting action | no | expose owner/impact/next handling where known |
| source / evidence | origin or support object | evidence only when its status/validation qualifies | do not equate upload with validated evidence |
| recommendation / decision | proposed option versus authorized outcome | decision only when authorized human decision exists | preserve actor, authority and time |

## 6. Intervention selection

| Intervention | Use when | Must not do |
|---|---|---|
| ASK | material information cannot be recovered | ask already-known confirmed context |
| ANALYZE | sufficient information/sources exist but need interpretation | present an inference as evidence |
| INVESTIGATE / GATHER | a source or measurement is needed | treat a missing source as support |
| ACT / PREPARE | a permitted concrete preparation is more useful than more chat | execute an organizational decision |
| EXPERIMENT | the relevant Step and authority allow it | bypass Step function/gate |
| UNBLOCK | progress depends on access, actor, permission, resource or external decision | mutate Step state from Portfolio convenience |
| REFRAME | new information materially changes the current frame | erase history or invalidate unrelated work blindly |
| STOP / CHECKPOINT | sufficient; unresolved authority; external evidence needed; a human decision is next; or further chat has no value | use a checkpoint to silently approve a material change |

## 7. Proposed delta and review protocol

A proposed delta must identify: target result/Card section; operation (`add`, `amend`, `supersede`, `mark_unknown`, `mark_contradiction`, `link_source`, `request_review`, or `no_change`); typed content; source/origin; reason; confidence as a non-authoritative signal; previous version/reference; and review disposition.

`no_change` is a valid result. A delta is never committed merely because a model returned it. The responsible capability evaluates authority and required checkpoint. Material changes preserve the prior version, record source/reason, assess downstream impact and set `requires_review` only for affected outputs where applicable.

### 7.1 Required adverse-input behavior

| Input / event | Required semantic outcome |
|---|---|
| “No sé” | classify the material field as `unknown`; retain it as unmet; do not fill the Card with the literal response or mark sufficient |
| irrelevant text | classify as irrelevant to the current requirement; emit `no_change` or a separately relevant item; do not satisfy a field |
| known information repeated | recover prior claim; avoid duplicate canonical claim; attach the new source/confirmation only when material |
| contradiction | create/retain contradiction relationship and its sources; do not overwrite either claim; select review/analysis/ask |
| new contradictory source | preserve prior source/claim, create a new version or contradictory support, assess affected outputs and `requires_review` where applicable |
| insufficient input | retain gap/unknown and choose ASK, INVESTIGATE, UNBLOCK or STOP; no completion by conversation count |
| AI unavailable/invalid output | persist no AI-created truth; preserve user/source input and a recoverable pending/failure outcome; offer deterministic next action where available |
| retry | the same logical request must resolve to the same pending/proposed/committed operation without duplicate confirmed state; storage/idempotency mechanism is P5 |

## 8. Sufficiency, gates and human checkpoints

Sufficiency is evaluated against the applicable Step/experience criteria: critical variables resolved; minimum output; required evidence; coherence with canonical current context; required validator; and zero hard gates. Soft gaps remain visible and do not automatically block.

The engine may assess and explain sufficiency but cannot approve a Step, validate evidence where a human is required, confirm alignment, decide investment, close an Initiative or authorize escalation. A required human checkpoint receives the proposed delta, evidence/provenance, known gaps, contradictions, recommendation and applicable decision type; the human disposition becomes a separate record.

## 9. Provenance, versioning and currentness

Every material claim/delta must preserve claim/source/origin, created or observed time, review disposition, evidence reference when applicable and version. An AI synthesis is an interpretation whose origin is AI; it cannot cite itself as source. A new source adds/revises knowledge through a versioned relation; it never silently deletes an older source or retroactively makes prior Step work wrong.

## 10. Existing capability audit

| Existing component | Observed evidence | P3 disposition |
|---|---|---|
| `backend/modules/truth/truth.service.ts` | claim validation states include `supported`, `contradicted`, `insufficient`; SourceRef/Evidence/validation services exist | KEEP as candidate truth/provenance substrate; P5 checks API/schema compatibility |
| `backend/modules/adaptive-core/adaptive-core.service.ts` and `critical-change-dependency.resolver.ts` | checkpoint sufficiency, versioned outputs and targeted dependency assessment exist | KEEP/ADAPT candidate; no claim of unified semantic input behavior |
| `front/prisma/schema.prisma` | `AdaptiveStepOutput.version`, `requiresReview`, cycles and CriticalChange exist | KEEP as AS-IS persistence evidence only; no P3 schema approval |
| `backend/modules/copilot/*` | conversation, orchestration, action plan and capability registry exist | ADAPT candidate; current scope is not proof of Steps reasoning |
| `ai-service/harness/*` | contracts, epistemic layer, state machine, gates and trace modules exist | REUSE/AUDIT candidate; harness is not product authority |
| `ai-service/agents/*`, `ai-service/skills/*` | specialized legacy agents/skills exist | REUSE only after capability fit review; no existing approved unified Steps Agent/Skill Contract was found in P0 |

## 11. P5 implementation constraints

P5 must specify contracts for context retrieval authorization, typed delta persistence, provenance/version relationships, human-review commands, idempotency keys, failure/retry, audit events and read models. It must retain the distinct sources of truth above and must not alter Step functions, domain cardinality or authority without the applicable ADR.

## 12. P3 acceptance evidence

| P3 AC | Evidence in this contract | Result |
|---|---|---|
| AC01 shared reasoning flow | §§3–4 | PASS |
| AC02 existing reuse audit | §10 | PASS |
| AC03 shared engine / specialization | §3 | PASS |
| AC04 context recovery | §4.2 | PASS |
| AC05 knowledge classifications | §5 | PASS |
| AC06 intervention selection | §6 | PASS |
| AC07 delta to Card/Portfolio | §7; Card contract §§4–6 | PASS |
| AC08 sufficiency | §8 | PASS |
| AC09 human checkpoint | §8 | PASS |
| AC10 provenance | §9 | PASS |
| AC11 versioning / requires_review | §§7, 9 | PASS |
| AC12–AC15 adverse cases | §7.1 | PASS |

## 13. Freeze statement

This contract freezes P3 reasoning behavior for P4 prototype and P5 planning. It introduces no product-domain rule beyond Core v0.2, the approved P2 experience and the approved Goal execution context. Runtime behavior remains unverified until its later phase evidence.
