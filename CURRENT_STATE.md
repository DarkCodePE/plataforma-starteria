# Current State

Estado del repositorio al aplicar el file plan de continuidad Portfolio Entry v0.3.

## Naturaleza

Este repositorio debe leerse actualmente como repositorio mixto de Starteria.

Conserva contratos, auditorias, trazabilidad, reportes de estado y referencias de gobernanza. Tambien contiene implementacion frontend/backend, tests y E2E que han sido modificados por commits y slices recientes.

No debe leerse como runtime productivo certificado por defecto. La presencia de carpetas como `front/`, `backend/`, `tests`, `prisma`, `ai-service` o equivalentes no autoriza por si sola a incorporar ni evolucionar producto.

La autoridad actual permite cambios frontend de producto solo cuando exista decision explicita y documentada de slice, con alcance acotado y sin modificar Core, AI, permisos, esquemas, rutas ni semantica de producto salvo autorizacion especifica. DS-05 y DS-06 son evidencia documental de pilotos frontend autorizados por slice.

## Starteria V2 — baseline de reconciliación

Starteria se encuentra actualmente en proceso explicito de consolidacion hacia V2.

El indice operativo de esta migracion es:

`STARTERIA_V2_MANIFEST.md`

El Manifest separa para cada slice:

- `logic_status`;
- `implementation_status`;
- `visual_status`;
- `evidence_status`.

La presencia de codigo legacy no implica que dicho comportamiento siga siendo autoridad de producto.

### Politica V2-only

A partir de esta consolidacion:

```text
V1 ACTIVE PRODUCT
→ en retirada progresiva

V1 AUTHORITY
→ no permitida para comportamiento nuevo

V1 INFRASTRUCTURE
→ reutilizable unicamente cuando sea compatible con V2

V1 LEGACY
→ debe clasificarse, aislarse y retirarse por slice
```

Los documentos obligatorios para cualquier migracion son:

- `STARTERIA_V2_MANIFEST.md`;
- `docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md`;
- `docs/governance/STARTERIA_V2_IMPLEMENTATION_PLAYBOOK.md`.

No debe declararse un slice como `V2_MIGRATED` solo porque haya cambiado visualmente.

La migracion requiere:

```text
V2 authority
+
V2 active behavior
+
V2 tests
+
no undocumented V1 consumers
```

### Boundary visual actual

La migracion visual V2 alcanzo conceptualmente:

```text
Portfolio Entry
→ Handoff
→ Portfolio Home
→ Strategic Front / Challenge
→ Activation / Invitation
```

La superficie:

```text
Initiative Overview
→ Step 0
→ Step 1
→ Step 2
→ Step 3
→ Step 4
```

NO debe considerarse automaticamente V2.

Su logica existente debe auditarse antes de cualquier rediseno o limpieza.

## E2E

El E2E de producto fue originalmente validado en un checkout productivo/autorizado. Este repositorio ahora conserva harness, estado documental y una superficie ejecutable de tests/E2E bajo `front/`.

No debe presentarse como runtime productivo certificado. Los resultados E2E en este checkout son evidencia de validacion de slice, no certificacion global de producto.

## Autoridad vigente

- Authority map: `docs/STARTERIA_AUTHORITY.md`.
- Core Contract: `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`.
  - Estado factual real: `v0.2`, `Base fundacional revisada / Por validar`.
  - `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` no esta materializado ni promovido.
  - Core v0.3 es un candidate externo no autoritativo; requiere ADR, evidencia original y re-test antes de promocionarse.
  - Evidencia: `docs/reconciliation/CORE_0_CANDIDATE_RECONCILIATION.md`.
  - Su presencia aqui no lo convierte en aprobado.
- Portfolio Entry Experience Contract aprobado:
  - `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`.
  - Este es el unico `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md` que debe usarse como autoridad activa para Pantalla 1.
  - SHA-256 observado: `D34FDEA9A5E5BE843105DDC2A3CED4970144AE2596AC8BF5AB897A95B2A54E8A`.
- Portfolio Post-Entry Continuation:
  - El contrato presente es `doc/experience/portfolio-entry/PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT_v0.1.md`.
  - Estado del contrato: `PROPOSED FOR REVIEW`; no es autoridad aprobada ni autoriza runtime productivo.
  - La continuación Portfolio es un `APPROVED_TARGET` de ADR-003 todavía `PROPOSED`, no una afirmación de que el flujo productivo canónico ya exista.
  - La implementación observada en este checkout es mixta: existe una superficie candidata de continuación Portfolio y permanecen rutas legacy de pilot/public-draft que pueden crear Project/Steps.
  - La slice `AUTHENTICATED_PORTFOLIO_CONTEXT_ESTABLISHMENT` está implementada sobre autoridad scoped: resuelve y selecciona contextos existentes sin crear autoridad ni entidades de negocio. Ver `docs/portfolio-entry/implementation/PORTFOLIO_ENTRY_AUTHENTICATED_PORTFOLIO_CONTEXT_ESTABLISHMENT_v0.1.md`.

## ADR-003 — estado reconciliado

`doc/product-adr/ADR-003-public-entry-registration-continuation-boundary.md` mantiene estado `PROPOSED`.

La lectura activa para esta frontera es:

```text
IMPLEMENTED_TODAY:
  - Public Entry, auth y rutas legacy Project/Steps coexisten en el checkout.
  - Existe una rama candidata de continuación Portfolio y tests de sus límites.

PROPOSED_TARGET (ADR-003; pendiente de aceptación e integración):
  Public Entry → handoff provisional → registration/login →
  restaurar contexto → Portfolio context por defecto.

LEGACY_COMPATIBILITY:
  - /auth/continue/:draftId → pilot lead.
  - /public/continuar → claim de piloto.
  - /continuar-piloto → Project + Steps.
  - createProjectFromPublicDraft → Project / Step 0.

DEPRECATION_TARGET:
  - Cualquier ruta pública por defecto que convierta directamente a Project/Steps.
  - createProjectFromPublicDraft dentro de la frontera Public Entry.

NOT_YET_IMPLEMENTED:
  - La integración canónica ADR-003 de registro → handoff Portfolio.
  - El contrato productivo Public Entry → Product Handoff.
```

Invariantes de esta frontera: `AUTHENTICATION != BUSINESS CANONICALIZATION`,
`PUBLIC_ENTRY_CONTINUATION != PROJECT_CREATION` y
`PUBLIC_ENTRY_CONTINUATION != STEPS_ENTRY`.

- Portfolio Home Governance: PH-0 target freeze at `docs/portfolio-lead/06-portfolio-home-governance/`; runtime not certified.
- PH-2 read-model implementation evidence is present on this branch, including
  the read-only `GET /api/v1/portfolio/home` integration; current-main
  compatibility and runtime certification remain pending.
- PH-3A is design/evidence only at
  `docs/portfolio-lead/90-implementation-reports/PORTFOLIO_HOME_UX_RECONCILIATION_PH3A_v0.1.md`;
  PH-3B frontend implementation is not present.
- Strategic Framing SF-0 documentation is materialized under
  `docs/portfolio-lead/07-strategic-framing/` and human-approved on
  2026-09-24. SF-1 current-state audit is completed, SF-2 read model is
  implemented, SF-3A provisional-state decision is approved, and SF-3B
  provisional persistence/application state is implemented but unverified.
  SF-3C editable workspace is implemented on the dedicated feature branch with
  GET/PATCH state routes and `/portfolio/framing/:stateId`; SF-3D initiation and
  canonical promotion remain out of scope. See
  `docs/portfolio-lead/90-implementation-reports/STRATEGIC_FRAMING_EDITABLE_WORKSPACE_SF3C_v0.1.md`.
- The Portfolio Lead reconciliation plan, glossary/context map and PH-2
  revalidation report are indexed evidence/reference artifacts, not new
  authority.
- First Value P3 runtime from KAN-86 is integrated in `origin/main` at PR #98
  (`1b44bc1`) under KAN-85/KAN-63 authority. It is stateless, provisional, and
  has no canonical or durable P3 writes; live provider and deployed network
  remain unverified. See
  `docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-86_FIRST_VALUE_P3_RUNTIME_PROCESSOR_IMPLEMENTATION_v0.1.md`.
- KAN-83 First Value and KAN-96 D2 hydration are integrated in the current
  governed baseline at `/portfolio/setup`. KAN-100 aligns the confirmed
  Portfolio Entry continuation to that route; scoped setup access is validated
  without global `portfolio:read`. KAN-101 restores Download/Delete behavior
  for a confirmed Brief. KAN-99's final closure was revalidated on governed
  main. KAN-109 then stabilized claimed-session recovery by waiting for auth
  hydration: baseline DELETE reproduced the missing actions panel in 5/10;
  after the fix DELETE x10, Portfolio-first continuation/reload x10, and five
  complete conversion E2E invocations passed locally. The change preserves the
  exact claimed identity and scoped server authorization; review/merge and Jira
  transition remain pending. See
  `docs/implementation/testing/KAN-109_AUTH_RECOVERY_STABILIZATION_v0.1.md`.

## Public Landing / KAN-102

KAN-102 aligns `/` with the frozen Landing Hero, an illustrative L2 model
(`Objetivos / Necesidades / Iniciativas / Equipos → Starteria → Foco /
Coordinación / Evidencia / Decisión`), and the conceptual value flow
`Define la meta → Alinea el trabajo → Hazlas realidad → Decide`. The primary
existing Starteria path remains `/auth`; Portfolio Entry is optional and links
to the existing `/public/start`. Its framing promises a provisional strategic
reading before action. Portfolio Entry logic, confirmed final actions and the
KAN-74 continuation remain unchanged.

Demo/Early Access remain `RUNTIME_PENDING / BLOCKED_BY_DESTINATION`; no
commercial route is authorized by this slice. KAN-104 transports the governed
`reason_to_ask` unchanged through the persisted active-question turn, API and
frontend DTO, and renders it only alongside that active question. Local suites,
builds and the isolated Portfolio Entry Chromium E2E passed; see
`docs/implementation/portfolio-entry/KAN-104_REASON_TO_ASK_FRONTEND_CONVERGENCE_v0.1.md`.

KAN-105 resolves the semantic/security authority gap through accepted product
ADR-007 and `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md`:
`reason_to_ask` is a concise `PUBLIC_EXPLANATION` for the active question, never
private/model rationale. KAN-104 implements the separately authorized
transport path without changing question selection logic, lifecycle, D1/D2,
KAN-74 continuation, Core or Steps. The Portfolio Entry v0.2 Agent/Skill/Harness
reconciliation stack remains candidate.

On 2026-10-06, the user froze
`docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md`
for implementation planning as a narrow experience/reasoning supplement to
the active Portfolio Entry Logic Contract.

The subsequent authority reconciliation aligned Portfolio Entry Logic section 0
with the factual Core v0.2 authority and removed the normative dependency of
Logic section 22 on the candidate Clarification/Handoff v0.2.1 contract for
Critical Reasoning outputs.

`PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md` remains
`CANDIDATE / PROPOSED FOR TESTING` and is not promoted by this reconciliation.

The Critical Reasoning contract authorizes no runtime change by itself.
Technical implementation still requires a valid implementation HU and explicit
slice authorization.

The ADR-003 status discrepancy remains OPEN / DEFERRED and must be reconciled
before Portfolio Setup Continuity. It does not block the Critical Situation
Synthesis phase because that phase excludes continuation, authentication,
conversion and Portfolio Setup.

KAN-114A remains a local planning/traceability label rather than a Jira issue
found in the connected Jira site.

## Portfolio Entry — KAN-114 / KAN-115 / KAN-116 post-merge 114C state

KAN-114 Critical Situation Synthesis is merged into `main` by PR #151
(`c4dc035`) and semantically accepted as `PASS_WITH_NON_BLOCKING_GAPS` in
`docs/ai-harness/portfolio-entry/KAN-114_CRITICAL_SITUATION_SYNTHESIS_SEMANTIC_ACCEPTANCE_v0.1.md`.
The accepted reasoning semantic gate is the dependency for 114C; this does not
promote candidate Portfolio Entry contracts or certify the whole product.

KAN-115 Live Understanding is integrated by KAN-116 PR #156. The merge commit
is `be3c494b3980a9fafa67fe613c4a077a863eeffa`; the final feature HEAD is
`de2a59beabf49072429ad279d7a8bed3de3c8866`. Its CI run
[`37847682123`](https://github.com/DarkCodePE/plataforma-starteria/actions/runs/37847682123)
passed all required jobs: Node tests with coverage, PostgreSQL integration,
Python unit tests, Prisma migration alignment, lint/build, Portfolio Entry
E2E, and CI summary.

- The PostgreSQL `PortfolioEntryTurn.inputIntent` integration step completed
  successfully against the CI disposable database after applying migrations.
  It round-tripped `answer` and `correction`, and verified that a legacy turn
  without the field reads as `answer`. The step was executed, not skipped.
- The full-stack Playwright Live Understanding spec completed successfully in
  the Portfolio Entry E2E job. It exercised browser → backend → Prisma →
  deterministic synthesis adapter → browser, including correction and the
  normal clarification lifecycle. The step was executed, not skipped; this is
  deterministic test evidence, not a LIVE/OpenRouter run.
- Deterministic backend/frontend regression suites passed in the Node coverage
  job, including the Live Understanding session integration, presentation
  allowlist, and public UI tests.

The bounded 114C capability is:

```text
user message
→ existing analysis
→ persisted turn
→ KAN-114 Critical Situation Synthesis
→ deterministic presentation allowlist
→ Live Understanding
→ explicit user correction
→ normal clarification lifecycle
→ fresh synthesis / Live Understanding
```

Live Understanding is provisional, correctable, non-taxonomic and safe for the
public UI. Its deterministic allowlist excludes raw KAN-114 reasoning metadata.
The correction turn is persisted with `inputIntent=correction`; the additive
Prisma migration defaults existing turns to `answer` and remains
`KEEP_COMPAT`. Live Understanding itself remains response-ephemeral: it is not
persisted in the session or as Core truth and may be absent after a full reload.

114C does not implement 114D final handoff/conclusion, a recommendation from
`candidate_first_movement`, Starteria Path, Portfolio Setup continuity, Steps,
Core canonicalization, or durable/Core persistence of Live Understanding. It
does not change KAN-114's prompt, output schema or accepted reasoning
semantics. KAN-116 only adds chronological `turn_index` ordering at the
synthesis input assembly boundary for persisted user messages and corrections.
### KAN-117 / KAN-119 - Critical Handoff (114D), post-CI PR #161

KAN-119 Critical Handoff v0.1 is `IMPLEMENTED_VERIFIED_ON_PR` on [PR #161](https://github.com/DarkCodePE/plataforma-starteria/pull/161) at
HEAD `b16dc03e04b8f3c419bfa5df565914b6613b7112`; it is open and not merged. KAN-114
remains the sole reasoning source. The implementation stores a dedicated durable
Portfolio Entry Critical Handoff artifact bound to its source `contextRevision`.
Currentness is invalidated when the reasoning context advances, and a
pre-confirmation correction returns through the existing clarification/reasoning
cycle. Confirmation is an explicit representativeness action: a claim is not a confirmation, and
confirmation does not certify every statement as objective fact.

The 114D close point is the confirmed Critical Handoff only. This slice does not
implement Starteria Path 114E, Portfolio Setup continuity 114F, ADR-003
reconciliation, Core, Steps, scoring, experiment design, or distinct alternative
ranking. Legacy handoff/confirmation readers remain `KEEP_COMPAT` for explicitly
historical sessions. This is bounded slice evidence, not certification of all
Portfolio Entry.

The completed [GitHub CI run #220](https://github.com/DarkCodePE/plataforma-starteria/actions/runs/37995220187) for PR #161 at the HEAD above passed: CI summary,
Prisma schema/migration alignment, Node tests with coverage, PostgreSQL repository
integration (26/26), CURRENT_114D browser E2E (6/6), LEGACY_COMPAT browser E2E
(7/7), Live Understanding full-stack E2E (1/1), lint/build, and Python. The
CURRENT_114D and LEGACY_COMPAT journeys are separate regression compositions.
The closure report is
`docs/implementation/portfolio-entry/KAN-119_CRITICAL_HANDOFF_V01_IMPLEMENTATION_CLOSURE.md`.

Post-confirmation reopen/correction is not generalized as a future reopen
feature; the confirmed artifact remains immutable under current v0.1 semantics.
ADR-003 remains `PROPOSED` with its discrepancy `OPEN / DEFERRED`; it must be
reconciled before Portfolio Setup Continuity.

No generalized post-confirmation reopen/correction feature is part of v0.1; the
confirmed artifact remains immutable. The broader future policy remains open.
114E is not started; the ADR-003 discrepancy remains open before any Portfolio
Setup Continuity work.

This closure does not alter the unresolved ADR-003 status recorded above.
ADR-003 remains `PROPOSED` in `CURRENT_STATE.md` and its discrepancy remains
`OPEN / DEFERRED`; it is still to be reconciled before Portfolio Setup
Continuity.

## ADRs

- ADRs de harness/documentacion: `docs/adr/`.
- ADRs de producto: `docs/product-adr/`.
- La serie de producto se mantiene separada de `docs/adr/ADR-001...007`.

### AI Harness / INTERPRET — ADR-031

El responsable aprobó ADR-031 el 2026-09-20 y autorizó la slice
`AI_HARNESS_INTERPRET_ADR031`, registrada en `STARTERIA_V2_MANIFEST.md`.
El código de `ai-service` usa Jev por defecto en INTERPRET de `mode=harness` y
`POST /ai/diagnose`; GROUND sigue en OpenRouter. `HARNESS_INTERPRET_BACKEND=llm`
restaura la ruta anterior. El corte provisional sigue en 0.50 por pregunta.
La implementación está verificada con pruebas herméticas; este checkout no acredita
despliegue externo ni riesgo productivo. En este entorno no hay `JEV_API_KEY` configurada,
por lo que una llamada real al path Jev falla cerrada hasta instalarla en el entorno
de ejecución. CD exige ahora el secreto `JEV_API_KEY`; la lista de secretos de
`DarkCodePE/harness-starteria` no lo contiene todavía y el despliegue queda
bloqueado hasta configurarlo. Ver `docs/analisis-jev/13-adr-031-activation.md`.

## Legacy e historico

Los documentos legacy o historicos deben abrir con banner `DEPRECATED`, `SUPERSEDED` o `HISTORICAL` y enlazar a este archivo y al reemplazo vigente si existe.

Si un documento no tiene banner todavia, no debe asumirse vigente por defecto. Verificar su estado declarado, fecha, ruta y reemplazo antes de usarlo como autoridad.

## Guardrail publico

Antes de cada commit:

- revisar secretos y datos sensibles;
- excluir runtime productivo nuevo;
- excluir dumps, credenciales, tokens, archivos `.env` reales y artefactos con datos privados;
- confirmar que README y AGENTS no prometen ejecucion productiva desde este repositorio.
