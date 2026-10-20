# Starteria Unified E2E — Traceability Matrix v0.1

**Status:** `FROZEN_FOR_P6_IMPLEMENTATION`. **Basis:** P2 frozen experience, P3 reasoning/Card contracts, P4 simulated prototype, P5 technical plan. Runtime evidence is intentionally `BLOCKED` where P1 could not execute it.

| ID | Requirement / authority quote | Classification | AS-IS evidence | Candidate implementation / owner | Tests / runtime evidence | Phase / status |
|---|---|---|---|---|---|---|
| TR-01 | Core INV-01: “Una capa no reemplaza a la otra.” | REQUIRED_BY_AUTHORITY | P1 T02–T03 BLOCKED | Portfolio reading separated from Project/Steps owner commands | P6–P12 policy and runtime flow | P6/P9/P11 pending |
| TR-02 | ADR5: “Accept does not create a Project/Initiative.” | REQUIRED_BY_APPROVED_ADR | P6 DB + HTTP runtime retries PASS | Preserve response command and reject Project creation from Accept | P6 persistence and HTTP retry tests PASS; full configured typecheck exits 0 | P6 PASS |
| TR-03 | ACT: “Accept no inicia ejecución”. | FROZEN_EXPERIENCE | P1 route code only | Keep discrete Accept state and UI | P6 state/e2e boundary | P6 pending |
| TR-04 | ACT: “Reject requiere justificación.” | FROZEN_EXPERIENCE | P1 T06 BLOCKED | Existing Reject command retains mandatory reason | P6 targeted route tests | P6 pending |
| TR-05 | ADR5 Start: `handoff_assignment_started`. | REQUIRED_BY_APPROVED_ADR | start route/service exists; P1 T07 BLOCKED | Start only advances Assignment | P6 idempotent Start integration | P6 pending |
| TR-06 | P2 §13 approved Route A: Start does not create Initiative. | FROZEN_EXPERIENCE | P6 DB + HTTP runtime PASS | `InitialReview.handoffAssignmentId` + `RouteConfirmation` link to one Project and mandate snapshot | focused, DB and HTTP retry evidence PASS; full configured typecheck exits 0 | P6 PASS |
| TR-07 | Core INV-10: “No se sobrescribe silenciosamente la historia.” | REQUIRED_BY_AUTHORITY | P6 Route B runtime PASS | Route B reuses the existing Project ID; read model only recovers relations | service/endpoint/component, DB before/after, HTTP evidence and full configured typecheck PASS | P6 PASS |
| TR-08 | Core INV-11: “conservar el contenido existente”. | REQUIRED_BY_AUTHORITY | P6 live reconstruction PASS | explicit recovery gaps and Overview review gate; no retroactive Step approval | DB/E2E P6 evidence and full configured typecheck PASS; P8 regression remains future | P6 PASS |
| TR-09 | Core INV-02: independent Initiatives may exist without Front/Challenge. | REQUIRED_BY_AUTHORITY | P6 Route C runtime PASS | InitialReview confirmation with nullable corporate refs | DB/HTTP replay and full configured typecheck evidence PASS | P6 PASS |
| TR-10 | Core §21 Step 0: “aclarar resultado esperado del ciclo”. | REQUIRED_BY_AUTHORITY | P1 T11–T13 BLOCKED; P7 isolated runtime now observed | P7 semantic Card versioned Step-0 delta | semantic unit, DB persistence and HTTP E2E PASS; `P7_STEP0_GOLDEN_SLICE_EVIDENCE.md` | P7 PASS |
| TR-11 | Core INV-04: “estado confirmado ... objetos estructurados y versionados.” | REQUIRED_BY_AUTHORITY | P7 versioned output behavior observed | typed delta, version and review gate | unit/integration/runtime retries PASS; complete typecheck PASS | P7 PASS |
| TR-12 | Core INV-05: “no se convierte automáticamente en fuente de verdad.” | REQUIRED_BY_AUTHORITY | P7 source behavior observed | Source/claim/review provenance preservation | new SourceRef is `unvalidated`; no automatic validation; integration/runtime PASS | P7 PASS |
| TR-13 | Core §21 Step 1: “separar hechos, supuestos e hipótesis”. | REQUIRED_BY_AUTHORITY | P1 T14–T15 BLOCKED | shared semantic Card specialization retains typed fact/hypothesis/evidence/unknown and bounded handoff | P8 unit + PostgreSQL + isolated runtime PASS | P8 PASS |
| TR-14 | Core §21 Step 2: “definir métricas y plan de medición”. | REQUIRED_BY_AUTHORITY | P1 T16–T17 BLOCKED | Step 2 semantic specialization carries selected work, measurement plan and capacity boundary to Step 3 | P8 unit + PostgreSQL + isolated runtime PASS | P8 PASS |
| TR-15 | Core §21 Step 3: “La evidencia negativa sigue siendo evidencia válida.” | REQUIRED_BY_AUTHORITY | P1 T18–T19 BLOCKED | execution, observation and interpretation are typed separately; contradiction performs selective review | P8 unit + PostgreSQL + isolated runtime PASS | P8 PASS |
| TR-16 | Core §21 Step 4: “no es por sí mismo la decisión organizacional.” | REQUIRED_BY_AUTHORITY | P1 T20 BLOCKED | learning/recommendation/Decision request handoff only; no Decision created | P8 unit + PostgreSQL + isolated runtime PASS | P8 PASS; P10 decision chain pending |
| TR-17 | P2 §24: Portfolio does not directly mutate StepState. | FROZEN_EXPERIENCE | P1 no live support trace | `AttentionItem` support-signal adapter and bounded Portfolio attention read model | isolated DB replay/no-Step-mutation + Portfolio Home unit PASS | P9 PASS |
| TR-18 | Core INV-03: “La IA no decide autónomamente”. | REQUIRED_BY_AUTHORITY | isolated decision authority observed | Decision authority policy and audit event | P10/P11 PostgreSQL decision authority and organizational-decision suite PASS | P10/P11 PASS; deployed proof remains P12 |
| TR-19 | Core INV-12: expected/observed/attributed stay distinct. | REQUIRED_BY_AUTHORITY | P1 T21 BLOCKED | causal Portfolio reading; later Benefit Tracking | P10 PostgreSQL truth/decision suite PASS | P10 PASS; deployed proof remains P12 |
| TR-20 | P3 adverse inputs: unknown/irrelevant/contradiction/retry/AI unavailable. | FROZEN_FOR_P4_AND_P5_PLANNING | P1 T24–T25 BLOCKED; P7 focused cases observed | P7 shared reasoning/Card slice | 8 semantic, 4 DB persistence and 2 HTTP E2E tests PASS; deterministic unavailable-engine branch preserves state | P7 PASS |
| TR-21 | P3 version/currentness and `requires_review`. | FROZEN_FOR_P4_AND_P5_PLANNING | P7 behavior observed | versioned outputs/CriticalChange reuse | contradiction preserves prior state and sets review in unit, DB and HTTP evidence | P7 PASS |
| TR-22 | P2 §26 causal Portfolio return. | FROZEN_EXPERIENCE | P1 T21 BLOCKED | event/replay-safe Portfolio projection | P10 causal test/runtime | P10 pending |
| TR-23 | Core / P2 security boundaries. | REQUIRED_BY_AUTHORITY | isolated scope/role behavior observed | tenant/project scope and team policy | P11 1/1 isolated HTTP E2E + 70 policy/persistence tests PASS | P11 PASS; P12 deployed proof pending |
| TR-24 | Master retry requirements. | REQUIRED_BY_AUTHORITY | isolated retries observed | durable receipt/fingerprint/transaction strategy | P6/P7/P11 tests; PDF upload now replays by fingerprint | P11 PASS |
| TR-25 | Master deployed certification. | GOAL_EXECUTION_AUTHORITY | deployed target unavailable: required runner variables and deployed identity are absent | full deployed journey | P12 requires browser/API/DB/HAR/log artifacts; preflight records no request was possible | P12 BLOCKED — `RUNTIME_BLOCKER_CRITICAL_FOR_FINAL_ACCEPTANCE` |

## Evidence chain and current limitations

`Authority → P2/P3 frozen requirement → P5 candidate seam → test → runtime` is required before an implementation slice can be PASS. Existing code names and unit tests are discovery evidence only; they do not mark any E2E requirement as PASS. P1’s T01–T25 retain their `BLOCKED` classifications until P12 executes them against a deployable isolated environment.

## Deferred technical decisions

| Item | Deferred boundary | Required phase |
|---|---|---|
| semantic classification, context recovery, delta/sufficiency policy | P3 contracts now frozen; implement only in Step 0 first | P7 |
| concrete API, schema, migration, idempotency receipt and event names | P5 plan only | P6 |
| effective existing cycle/Step after reconstruction | no autonomous selection; continuity review | P6 |
| HelpRequest / AttentionItem reuse vs adaptation | no new SupportRequest authority | P9 |
| decision effect and benefit measurement | preserve human decision / impact levels | P10 |
| deployed identities, actors, tenant, AI service and DB | P1 runtime blocker | P12 (or earlier when environment restored) |

## Integrity check

No P2/P3 candidate rule is reclassified as Core authority. No candidate implementation seam is an approved API contract. No P1 BLOCKED scenario is treated as runtime PASS.
