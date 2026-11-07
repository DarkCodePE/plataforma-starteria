# STARTERIA_V2_MANIFEST

**Versión:** v0.1  
**Estado:** Baseline de consolidación propuesto para reconciliación  
**Fecha:** 2026-09-18  
**Propósito:** establecer una única lectura verificable de Starteria V2 separando autoridad de producto, experiencia, IA, diseño, implementación y evidencia.

---

# 1. Regla principal

Starteria V2 no se define por un número de versión aislado ni por el archivo más reciente.

La baseline vigente se determina por:

```text
AUTORIDAD
+ ESTADO DEL ARTEFACTO
+ IMPLEMENTACIÓN REAL
+ TESTS / EVIDENCIA
+ MIGRACIÓN VISUAL
```

Nunca asumir:

```text
archivo más nuevo = autoridad
código existente = decisión aprobada
implementado = V2 visual
hallazgo = solución validada
documento presente = baseline activo
```

---

# 2. Taxonomía de estados V2

## Logic status

```text
STABLE_INVARIANT
ACTIVE_V2_BASELINE
SUPPORTED_FINDING
TESTABLE_HYPOTHESIS
CANDIDATE
SUPERSEDED
HISTORICAL
UNKNOWN
```

## Implementation status

```text
NOT_IMPLEMENTED
EXPERIMENTAL_IMPLEMENTATION
PARTIAL_IMPLEMENTATION
IMPLEMENTED_UNVERIFIED
IMPLEMENTED_VERIFIED
PRODUCTIVE
UNKNOWN
```

## Visual status

```text
V2_MIGRATED
V2_PILOT
V2_TARGET_DEFINED
V2_TARGET_UNRESOLVED
V1_LEGACY
MIXED
NOT_APPLICABLE
UNKNOWN
```

## Evidence status

```text
NO_EVIDENCE
OBSERVED
SUPPORTED
TESTING
VERIFIED
CONTRADICTED
UNKNOWN
```

---

# 2.1 Slice AI_HARNESS_INTERPRET_ADR031

**Registrado:** 2026-09-20 por instrucción explícita del responsable.

```text
slice_id: AI_HARNESS_INTERPRET_ADR031
logic_status: ACTIVE_V2_BASELINE (sólo la política acotada por ADR-031 Accepted)
implementation_status: IMPLEMENTED_VERIFIED (tests herméticos; despliegue externo no acreditado)
visual_status: NOT_APPLICABLE
evidence_status: TESTING (riesgo productivo y estabilidad no certificados)
authority: backend/docs/adr/ADR-027-methodology-agent-harness.md
           backend/docs/adr/ADR-031-confidence-threshold-for-human-escalation.md
entry_boundary: mode=harness / POST /ai/diagnose
exit_boundary: RouteProfile -> GateLadder -> route | confirm | escalate
implementation: ai-service/harness/stages/llm_stages.py
report: docs/analisis-jev/13-adr-031-activation.md
```

Jev es el backend por defecto de INTERPRET del harness; GROUND continúa en OpenRouter.
El corte 0.50 es una decisión operativa provisional aprobada, no una cota de riesgo.
La autoridad Core referenciada en CURRENT_STATE no está presente en este checkout;
esta aprobación sólo cubre la slice descrita y no certifica Starteria V2 completa.

---

## Slice PORTFOLIO_LEAD_SETUP_NAVIGATION_REENTRY_G1 (KAN-205 / KAN-207)

**Registrado:** 2026-11-02 por HU KAN-205 y aprobación funcional KAN-206 `RESUELTO`; implementación técnica acotada en KAN-207.

```text
slice_id: PORTFOLIO_LEAD_SETUP_NAVIGATION_REENTRY_G1
HU: KAN-205
functional_authority: KAN-206 (RESUELTO; CA-1..CA-8 y copy "Continuar a Incorporación")
technical_task: KAN-207
logic_status: ACTIVE_V2_BASELINE (solo navegación, sincronización con estado persistido y reentrada del setup)
implementation_status: IMPLEMENTED_UNVERIFIED
visual_status: V2_TARGET_DEFINED
evidence_status: TESTING
ca_8_status: BLOCKED (E2E autenticado no ejecutado; Docker Desktop/Linux Engine no disponible)
implementation_commits: fed90bb (registro documental G1); 6f036fa (implementación frontend y tests KAN-207)
semantic_owner: V2 Portfolio Lead frontend setup navigation
authority: Jira KAN-205 + KAN-206; docs/STARTERIA_AUTHORITY.md; docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md; baseline Portfolio Lead congelada v1.0 dentro del alcance aprobado
entry_boundary: /portfolio/inicio muestra PortfolioBootstrapHome con Objetivo/E2 visible y elegibilidad derivada de la proyección persistida
exit_boundary: CTA explícito "Continuar a Incorporación" muestra E3 solo después de confirmación backend exitosa
current_surface: front/src/features/portfolio-lead/bootstrap/components/PortfolioBootstrapHome.tsx; consumidor front/src/app/pages/PortfolioLeadHomePage.tsx
current_route_note: /portfolio/setup monta PortfolioLeadFirstValuePage y no pertenece a este slice
target: backend/proyección persistida gobierna elegibilidad; selectedStage es selección visual; revisión retrospectiva no altera datos ni bloquea la continuación; errores no simulan avance
legacy_dependencies: NONE (se reutilizan proyección y comandos V2 existentes sin adoptar semántica V1)
adapter_required: NO
tests_protecting_current_behavior: PortfolioBootstrapHome.test.tsx; PortfolioLeadHomePage.bootstrap.test.tsx; usePortfolioBootstrap.test.tsx; portfolio-bootstrap router/integration/scoped-authority tests; portfolio-setup-home-handoff-141.integration.spec.ts
tests_required: frontend CA-1..CA-6; regresiones CA-7; navegador autenticado CA-8 o BLOCKED explícito
core_impact: NONE
backend_impact: NONE
prisma_impact: NONE
step_impact: NONE
handoff_impact: NONE
ai_impact: NONE
excluded: Core; backend/API; Prisma/migraciones; Steps 0-4; Handoff; Briefs; asignaciones; Portfolio Home operativo; soporte; IA; etapas posteriores no autorizadas; merge/deploy
implementation_gate: V2_CHANGE_GUARDRAIL_CHECK must be YES before functional code changes
```

Este registro autoriza solamente la preparación del slice y su control previo. No acredita
implementación, E2E, despliegue ni cierre productivo y no cambia la autoridad de Core, Backend,
Handoff, Steps, Portfolio Home o IA.

---

## Slice PORTFOLIO_LEAD_G4_LAB_BRIEF_REQUEST (KAN-224 / KAN-225 / KAN-226)

**Registrado:** 2026-11-07 por ratificación funcional KAN-224#10674, auditoría técnica
KAN-225#10675 e instrucción de ejecución backend KAN-226#10676.

```text
slice_id: PORTFOLIO_LEAD_G4_LAB_BRIEF_REQUEST
functional_hu: KAN-224
functional_authority: KAN-224#10674
technical_audit: KAN-225#10675
technical_task: KAN-226
technical_scope_authority: KAN-226#10676
baseline: main@6ad4567559eb31caf3df37ddbffe40625abb64e8
logic_status: ACTIVE_V2_SLICE
implementation_status: AUTHORIZED_NOT_IMPLEMENTED
visual_status: NOT_APPLICABLE (KAN-227 frontend separado)
evidence_status: TESTING_REQUIRED
semantic_owner: solicitud manual de apoyo Startería Lab referida a Challenge y ChallengeActivationBriefVersion CONFIRMED
allowed: backend/API/Prisma aditivos; migración focal; tests unitarios/HTTP/PostgreSQL; reutilización de backend/shared/mail/mailer.ts; ajuste documental del Manifest
required_identity: organizationId + challengeId + briefId + briefVersionId inmutable + requesterId/actor + consentimiento explícito
required_limits: máximo 3 solicitudes abiertas por organizationId bajo concurrencia; una activa por organizationId+challengeId+briefVersionId; terminales liberan cupo y conservan historia
required_delivery_semantics: REQUESTED persistido != NOTIFIED/SMTP aceptado != MEETING_SCHEDULED; fallo/disabled del mailer conserva la solicitud y registra fallo reintentable
server_side_recipients: fabio.merino.97@gmail.com; orlandokuanb@gmail.com (nunca aceptados desde payload cliente)
required_security: owner/role scoped; tenant isolation; Brief/Version/Challenge de la misma organización; IDs ajenos no filtran existencia
required_reentry: idempotency key + payload fingerprint; retry devuelve receipt estable; historial inmutable y seguimiento GET
reuse_required: ChallengeActivationBrief/ChallengeActivationBriefVersion y validación CONFIRMED de ADR-008; patrones tenant/actor del handoff sin crear Assignment; backend/shared/mail/mailer.ts
preserves: rutas Equipo y Lab no excluyentes; PL-06/ADR-009 sin cambios; BriefVersion exacta e inmutable; confirmación humana; no falsificar lectura humana ni reunión
excluded: PortfolioSetupCompletionService.complete y gate setup 7/7; KAN-227/frontend; Project/Initiative/PortfolioHandoffAssignment/Step falsos; Core; Steps; Handoff; IA; Calendly API; infraestructura/proveedor/secretos nuevos; merge/deploy
adr_determination: NO ADR nuevo para el registro aditivo acotado; STOP si se cambia completion, autoridad/cardinalidad Core, PL-06, Steps o Handoff
stop_conditions: autoridad insuficiente para una superficie; consumidor desconocido que exija cambio no aditivo; ausencia de enforcement transaccional real; necesidad de infra/secretos; cualquier cambio a completeSetup
guardrail: V2_CHANGE_GUARDRAIL_CHECK reconciliado — Proceed YES sólo para el alcance allowed; Proceed NO para excluded
```

La solicitud Lab es un encargo manual trazable, no una asignación PL-06 ni una ejecución de
tecnología. La persistencia de la solicitud debe sobrevivir a un fallo de notificación; la aceptación
del transporte SMTP no prueba lectura humana y ningún enlace o clic de Calendly prueba una reunión.
El posible uso de un outcome Lab para completar el setup queda separado hasta una autorización y
determinación ADR específicas.

---

## Slice PORTFOLIO_LEAD_G4_LAB_REQUEST_UX (KAN-224 / KAN-227)

**Registrado:** 2026-11-07 por autoridad funcional KAN-224#10673/#10674 y autorización de
integración frontend KAN-227#10678, sobre el backend KAN-226 fusionado en PR #259.

```text
slice_id: PORTFOLIO_LEAD_G4_LAB_REQUEST_UX
functional_hu: KAN-224
functional_authority: KAN-224#10673/#10674
technical_task: KAN-227
technical_scope_authority: KAN-227#10678
depends_on: PORTFOLIO_LEAD_G4_LAB_BRIEF_REQUEST (KAN-226, PR #259 merged)
baseline: main@890464bc5fd0a1a1c15ea922fa45dfbcdc5c3822
logic_status: ACTIVE_V2_SLICE
implementation_status: KAN227_IMPLEMENTED_READY_FOR_REVIEW
visual_status: V2_TARGET_DEFINED
evidence_status: LOCAL_VERIFIED_INDEPENDENT_REVIEW_APPROVED_CI_PENDING
implementation_commits: 0858a30 (LAB-UX01..09 tests-first); 954b2ae (typed client + UX + authenticated E2E); 5cb7ae7 (independent-review findings closed)
local_evidence: LAB client/panel 11/11; PL-06 + Lab focal 30/30; frontend 1097/1097; authenticated PostgreSQL E2E 1/1; KAN-226 PostgreSQL regression 6/6; lint PASS; typecheck:front PASS; build PASS
independent_review: APPROVED after round 2; initial 3 MEDIUM findings closed in 5cb7ae7
semantic_owner: experiencia frontend de solicitud y seguimiento Startería Lab desde ChallengeActivationBriefVersion CONFIRMED
allowed: cliente frontend tipado para /api/v1/portfolio-lab/requests; sección Lab aditiva junto a Equipo en ChallengeAssignmentPreparationPanel o feature frontend propia; preview de Brief confirmado; consentimiento; stable Idempotency-Key; contador de abiertas; create/dedup/409; estado de notificación y retry; seguimiento/reentrada; CTA Calendly exacto; tests frontend y E2E autenticados; ajuste documental de este Manifest
required_api_reuse: GET /portfolio-lab/requests; GET /portfolio-lab/requests/:requestId; POST /portfolio-lab/requests; POST /portfolio-lab/requests/:requestId/notification-retry
required_identity: challengeId + briefId + briefVersionId CONFIRMED exactos recuperados del target; organizationId/actor derivados exclusivamente por backend
required_ux: Equipo Y/O Startería Lab coexistentes y no excluyentes; preview y consentimiento antes de POST; 0..3 abiertas; cuarto CTA deshabilitado y 409 comprensible; 200 deduplicado y 201 creado convergen sin duplicar; reentrada recupera estado durable
required_state_semantics: REQUESTED persistido != notificationStatus PENDING/FAILED/NOTIFIED != reunión humana; no mostrar emails server-side; fallo SMTP conserva contexto y permite retry idempotente
calendly_url: https://calendly.com/fabio-merino-97/new-meeting?month=2026-11
calendly_semantics: abrir el enlace no muta la solicitud ni marca MEETING_SCHEDULED, reserva o lectura humana
preserves: PL-06 Equipo y ChallengeAssignmentPreparationPanel existentes; E2/E5; slice KAN-207 sin cambios; BriefVersion confirmada; autoridad humana; no Project/Assignment/Step ficticios
excluded: backend/API/Prisma; PortfolioSetupCompletionService.complete y gate setup 7/7; cierre Lab-only del setup; transición MEETING_SCHEDULED u operación staff nueva; Core; Steps; Handoff; IA; Portfolio Home si requiere nueva proyección/API; Calendly API/auto-calendar; infraestructura; secretos; gastos IA; merge/deploy
stop_conditions: cualquier necesidad de backend/API/Prisma, Home read model nuevo, cambio de PL-06/KAN-207, completar setup con Lab, simular reunión/decisión de operador o introducir infraestructura/secretos
guardrail: V2_CHANGE_GUARDRAIL_CHECK requerido y debe ser Proceed YES antes de tests/código productivo
```

Este slice hace visible una vía humana adicional sin convertirla en una asignación de Equipo ni
en evidencia de finalización. La solicitud Lab y PL-06 pueden coexistir para el mismo reto. El
seguimiento muestra únicamente estados durables del contrato KAN-226; Calendly es una salida
externa opcional y no constituye una reserva dentro de Starteria.

---

## Slice PORTFOLIO_LEAD_G4_SETUP_COMPLETION_OUTCOMES (KAN-228 / KAN-229 / KAN-230 / KAN-231)

**Registrado:** 2026-11-07 por decisión funcional KAN-228, auditoría KAN-229 y autorización
explícita de ejecución KAN-229/230/231 sobre `main@9d2b633013392e5cef1475e34ffda44d8b653c44`.

```text
slice_id: PORTFOLIO_LEAD_G4_SETUP_COMPLETION_OUTCOMES
functional_hu: KAN-228
technical_tasks: KAN-229; KAN-230; KAN-231
technical_audit: KAN-229#10682 (preliminar Proceed:NO) + KAN-229#10683 (ratificación humana prevalente y Proceed:YES) + auditoría Core/ADR/repositorio de 2026-11-07
baseline: main@9d2b633013392e5cef1475e34ffda44d8b653c44
logic_status: ACTIVE_V2_SLICE
implementation_status: IMPLEMENTED_READY_FOR_REVIEW
visual_status: V2_TARGET_DEFINED_BY_KAN-228
evidence_status: LOCAL_VERIFIED_INDEPENDENT_REVIEW_FINDINGS_RESOLVED_CI_PENDING
implementation_commits: c7ad3a1; 6118bf5; ac57fb4; 6f22bfe; 8e6b719; 34b63cb; f578d2f; e68354a; 47d69df
verified_suites: backend completo PASS; frontend completo PASS; focal backend 37/37; focal frontend 20/20 y accesibilidad 11/11; PostgreSQL KAN-226 6/6 + KAN-230 4/4; comando CI PostgreSQL KAN-221+KAN-230 9/9 con 0 skips; E2E autenticado Lab-only 1/1; typecheck frontend, lint, build, YAML y diff-check PASS
known_baseline_gate: typecheck backend global conserva TS2740 preexistente en critical-synthesis-reasoning.test.ts, archivo sin cambios respecto al baseline
depends_on: PORTFOLIO_LEAD_G4_LAB_BRIEF_REQUEST (KAN-226) + PORTFOLIO_LEAD_G4_LAB_REQUEST_UX (KAN-227)
semantic_owner: cierre humano de Portfolio Setup mediante outcomes independientes y factuales de Equipo y/o Startería Lab
completion_routes: TEAM_SENT | LAB_NOTIFIED | BOTH
completion_invariant: assignmentSentCount > 0 || validLabRequestCount > 0
valid_team_outcome: semántica PL-06 existente sin cambios; Assignment del Challenge canónico de la sesión con BriefVersion CONFIRMED y entrega SMTP acreditada
valid_lab_outcome: PortfolioLabRequest no terminal de la misma organizationId y requesterId que el actor propietario de la sesión, enlazada a un Challenge materializado por esa sesión y a su ChallengeActivationBriefVersion exacta en estado CONFIRMED, con notificationStatus=NOTIFIED y aceptación persistida de ambos destinatarios server-side
human_checkpoint: confirmed=true obligatorio; actor y tenant autorizados; no inferir confirmación desde SMTP, UI, Calendly ni estado de solicitud
required_concurrency: transacción serializable con retry + CAS sobre setupCompletedAt frente a cierre/terminalización concurrente; idempotencyKey durable; exactamente un audit portfolio_setup_completed
required_history: el audit único congela summary PL-06, labSummary, completionRoute e IDs Lab sin destinatarios; la reentrada devuelve ese snapshot aunque el request cambie después; no reetiquetar envío Lab como Assignment enviado
required_overview: Portfolio Overview proyecta la solicitud Lab owner/tenant-scoped con estado real; NOTIFIED se presenta como contacto pendiente, nunca como reunión, lectura o desarrollo confirmado
allowed_backend: PortfolioSetupCompletionService y sus contratos/DTO/router tests; lectura aditiva owner/tenant-scoped de PortfolioLabRequest en Portfolio Home; tests unitarios, HTTP y PostgreSQL
allowed_frontend: UX de finalización Lab-only/Equipo/BOTH y proyección factual en Portfolio Overview; cliente tipado; tests React y E2E autenticado
allowed_ci: invocación aditiva del test PostgreSQL KAN-230 en el job existente, reutilizando la base desechable ya migrada; sin servicios, secretos ni infraestructura nuevos
allowed_docs: reconciliación y cierre de este slice en STARTERIA_V2_MANIFEST.md; trazabilidad Jira/PR
reuse_required: PortfolioLabRequest KAN-226; PortfolioLabRequestPanel KAN-227; ChallengeActivationBrief/Version de ADR-008; materializaciones canónicas de la sesión; completion CAS/idempotencia/audit existentes
preserves: KAN-207 sin cambios; PL-06 y ADR-005/008/009 sin cambios; autoridad humana; tenant isolation; historial; openAdditionalFront sólo tras cierre real
excluded: cambios Prisma innecesarios; nuevos estados Lab; Calendar API; Project/Initiative/PortfolioHandoffAssignment/Step ficticios; Core; Steps; Handoff; IA productiva; infraestructura; secretos; gastos IA; merge/deploy
negative_guards: REQUESTED, notificationStatus PENDING/FAILED, intentos PENDING/FAILED/DISABLED, solicitudes CLOSED/NOT_PROCEEDING/CANCELLED, otro tenant, otro Challenge/sesión, BriefVersion no CONFIRMED y apertura de Calendly no habilitan cierre
adr_determination: NO ADR nuevo; Core v0.2 no define el checkpoint de cierre de Setup y la ampliación preserva, sin redefinir, las identidades/cardinalidades y límites aceptados por ADR-005/008/009
stop_conditions: necesidad de cambiar Core/Steps/Handoff/Prisma, inferir outcome sin evidencia durable, contar requests requester-scoped como autorización global, o crear entidades ficticias
guardrail: V2_CHANGE_GUARDRAIL_CHECK resuelto Proceed:YES en KAN-229#10683 antes de la implementación productiva; reemitido para la invocación CI aditiva sin infraestructura nueva
```

Este slice cambia exclusivamente el gate de aplicación que permite cerrar la configuración. No
convierte la solicitud Lab en Assignment ni en Initiative, y no interpreta aceptación SMTP como
lectura, reunión o aceptación del trabajo. Las dos rutas se conservan como outcomes independientes.

---

## Slice PORTFOLIO_LEAD_G5_HOME_E2E_CERTIFICATION (KAN-232)

**Registrado:** 2026-11-07 por G5_HOME_E2E_FINAL.md, KAN-232 y autoridad reconciliada
KAN-232#10690 sobre `main@e55934b79fca29007995aa9c8bb785ffda05d1c4`; #10689 se conserva
como preflight preliminar `Proceed:NO` previo a la reconciliación.

```text
slice_id: PORTFOLIO_LEAD_G5_HOME_E2E_CERTIFICATION
functional_hu: KAN-232
functional_authority: G5_HOME_E2E_FINAL.md + KAN-232 description
technical_scope_authority: KAN-232#10689 (preliminar Proceed:NO) -> KAN-232#10690 (reconciliación local Proceed:YES para allowed)
baseline: main@e55934b79fca29007995aa9c8bb785ffda05d1c4
logic_status: ACTIVE_V2_SLICE
implementation_status: G5_E2E_CERTIFIED_READY_FOR_MERGE_REVIEW
visual_status: V2_TARGET_DEFINED_BY_G5
evidence_status: LOCAL_PASS + INDEPENDENT_REVIEW_APPROVED + PR_262_CI_6_OF_6_PASS
depends_on: G1/G2/G3 integrados + PORTFOLIO_LEAD_G4_SETUP_COMPLETION_OUTCOMES (PR #261 merged)
semantic_owner: proyección read-only de Portfolio Home y certificación E2E del journey Portfolio Lead
authority_chain: Core v0.2 factual + ADR-005/008/009 + PH-0 frozen target/read-model contracts + G5/KAN-232 explicit runtime authorization
authority_reconciliation: PH-0 por sí solo no autorizaba runtime; KAN-232 autoriza exclusivamente la proyección/read-model, UI y pruebas G5 aquí delimitadas sin promover dependencias candidatas de Activation o Steps
current_route: GET /api/v1/portfolio/home -> /portfolio/inicio
current_gap: ninguno dentro del slice autorizado; queda exclusivamente la decisión humana de merge review, no ejecutada aquí
implementation_commits: 52d5834, 45fdda6, 1a2e102, a17f0b0, 56e1228, 2ca15c0, 33b8d71, 3e5faa5
local_evidence: backend focal 26/26; frontend focal 13/13; PL-06 delivery/invitation/response 32/32; suites front/back completas PASS; lint PASS; front typecheck PASS; build PASS; PostgreSQL disposable Playwright A/B/C 3/3 PASS sin skips
known_baseline: typecheck backend conserva TS2740 preexistente en portfolio-entry-runtime/__tests__/critical-synthesis-reasoning.test.ts, fuera del slice y sin cambios
smtp_fixture_boundary: el E2E G5 simula exclusivamente el receipt SMTP_ACCEPTED/SENT externo; claim/accept/reject son HTTP reales y la semántica/idempotencia de transporte queda certificada por la regresión PL-06 32/32
delivery_evidence: revisión independiente APPROVED sobre 476019b; PR #262; CI run 42391374524 con 6/6 checks SUCCESS; Jira KAN-232#10691
allowed_backend: lectura aditiva owner/tenant-scoped de WorkItems, BriefVersions y estados ya canónicos en PortfolioHomeReadService; DTO/router/tests read-only; sin comandos ni persistencia
allowed_frontend: tabla simple y filtrable Trabajo/Encargo | Destino/Owner | Estado real | Siguiente acción | Detalle; drilldown accesible; estados reales de WorkItem/Brief/Assignment/Initiative/Lab; Sin datos para KPI/ROI/impacto ausentes
allowed_tests: tests-first G5-CA01..CA08; PostgreSQL disposable; navegador autenticado A/B/C; seguridad tenant/roles 403/404; stale/retry/doble clic; refresh/logout/login; SMTP fallido; invitación rechazada; responsive/accesibilidad; regresiones G1-G4 y CI
allowed_ci: invocación aditiva de suites G5 en jobs y PostgreSQL desechable existentes, sin nuevos servicios, secretos ni infraestructura
human_authority: confirmaciones existentes permanecen obligatorias; Home sólo lee y enlaza a superficies autoritativas
state_separation: WorkItem provisional != Brief confirmado != Assignment created/sent/accepted/started != Initiative/Project canónico != Step activo != solicitud Lab/entrega software
negative_guards: Accept no implica Start; solicitud/SMTP/Calendly Lab no implican software, reunión ni impacto; ningún KPI/ROI/progreso inferido; ningún Step/Project/Assignment ficticio; sin leaks cross-tenant ni datos server-side sensibles
reuse_required: PortfolioOverviewHome; PortfolioHomeReadService; PortfolioBootstrapWorkItem; ChallengeActivationBrief/Version; PortfolioHandoffProjection; PortfolioLabRequest; KAN-221/222/223/226/227/229-231
legacy_dependencies: proyecciones V2 actuales y adapters read-only clasificados V2/LEGACY_COMPAT; ninguna semántica legacy puede definir estado nuevo
adapter_required: NO para comportamiento; sólo composición read-only de fuentes gobernadas existentes
preserves: PH-0 boundaries; ADR-005/008/009; tenant isolation; provenance; historial; autoridad humana; PL-06; KAN-207; Core v0.2; Steps 0-4
excluded: cambios Core/ADR/Steps/Handoff; comandos o side effects desde Home; Prisma/migraciones; IA productiva; nueva infraestructura/secretos; gastos IA; creación automática de Project/Assignment/Step; merge/deploy
stop_conditions: necesidad de decidir pre_start/Step materialization/ownership/cardinalidad candidata; nueva entidad o escritura; fuente de estado ambigua; cambio Prisma/Core/Steps/Handoff/IA/infra
guardrail: V2_CHANGE_GUARDRAIL_CHECK reconciliado Proceed:YES sólo para allowed; Proceed:NO para excluded
delivery_status: G5_E2E_CERTIFIED_READY_FOR_MERGE_REVIEW o G5_BLOCKED con evidencia verificable
```

Este slice no declara Portfolio Home completamente V2_MIGRATED por anticipado. La promoción depende
de que A/B/C y los adversariales pasen sin mocks ni skips sobre PostgreSQL desechable y navegador
autenticado, y de que la revisión independiente confirme que no se incorporó semántica candidata.

---

## Slice RELEASE_G1_G5_STAGING_CERTIFICATION (KAN-236 / KAN-237)

**Registrado:** 2026-11-07 por KAN-236/KAN-237 y los hallazgos de preparación operativa
KAN-235#10698 y KAN-233#10699 sobre `main@3038dc688965bd6dcd080a69e2587e3a9eba8867`.

```text
slice_id: RELEASE_G1_G5_STAGING_CERTIFICATION
technical_tasks: KAN-236; KAN-237
authority: Jira KAN-236 + KAN-237; KAN-235#10698; KAN-233#10699; docs/STARTERIA_AUTHORITY.md; docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md
baseline: main@3038dc688965bd6dcd080a69e2587e3a9eba8867
logic_status: ACTIVE_V2_RELEASE_EVIDENCE_SLICE
implementation_status: IMPLEMENTED_READY_FOR_REVIEW
visual_status: NOT_APPLICABLE
evidence_status: LOCAL_PASS_REMOTE_BLOCKED_CONFIG
implementation_commits: b2df66d (Manifest + contrato tests-first RED); fee7d9f (selector/spec/workflow/runbook); 7462dbc (A/B/C trazan G1-G5); 3e52fc0 (reentrada gobernada + reason codes + cierre de hallazgos)
independent_review: R1 CHANGES_REQUIRED; R2 APPROVED at 3e52fc0 with all material findings resolved
local_evidence: contrato/seguridad 7/7 PASS; selector Playwright lista 3 tests exactos; backend 1911/1911 PASS con 195 skips environment-gated; frontend 1104/1104 PASS; front typecheck/lint/build/YAML/diff-check PASS
known_baseline: backend typecheck conserva TS2740 preexistente en critical-synthesis-reasoning.test.ts, archivo sin cambios respecto a main@3038dc688965bd6dcd080a69e2587e3a9eba8867
remote_evidence: NOT_EXECUTED; e2e-staging Environment ausente según KAN-235#10698; configuración/RBAC/DB/tunnel siguen UNKNOWN hasta autorización operativa
delivery_status: STAGING_BLOCKED_CONFIG (repositorio listo para revisión; no equivale a certificación ejecutada)
semantic_owner: selector fail-closed, contrato de equivalencia y evidencia de certificación E2E G1-G5 en staging aislado
classification_required: local_disposable_db | staging_remote_api_browser | staging_synthetic_provisioning
local_disposable_boundary: las suites KAN-222/KAN-212/KAN-213/KAN-223/KAN-227/KAN-232 que importan PrismaClient permanecen sobre PostgreSQL desechable local y nunca reciben DATABASE_URL productiva
remote_boundary: la certificación desplegada usa exclusivamente API/browser autenticados contra el tenant sintético de starteria-e2e; ningún spec remoto puede importar PrismaClient, leer DATABASE_URL, omitir credenciales mediante skip ni apuntar a producción
required_scenarios: A (0 trabajo -> E5 -> Brief -> Lab -> Home); B (3 iniciativas -> E4 -> 1 frente/2 Briefs -> Equipo+Lab -> tercero no activado -> Home); C (25 CSV/XLSX -> revisión -> 1 frente -> Briefs selectivos -> Home)
required_traceability: goal -> scenario -> environment -> test -> evidence -> CI; selector exacto; target full SHA; 0 skips
allowed: STARTERIA_V2_MANIFEST.md; tests/fixtures/scripts E2E; front/e2e/prod specs API/browser; contrato estático de seguridad; invocación aditiva en .github/workflows/e2e-staging.yml; docs/e2e/E2E_STAGING_RUNBOOK.md; trazabilidad Jira/PR
allowed_workflow_change: ejecutar el selector G1-G5 dentro del workflow e2e-staging existente y su Mailpit local; conservar sus preflights de namespace/RBAC, bootstrap/drift 77/77, SHA inmutable, tenant sintético y artefactos
preserves: slices G1-G5; KAN-207; Core v0.2; ADR-005/008/009; PL-06; confirmación humana; tenant isolation; trazabilidad; suites locales con Prisma
excluded: añadir KAN-232 ingenuamente a npm run test:e2e:prod; conectar PrismaClient o DATABASE_URL del runner a producción; backend/API/Prisma/runtime productivo; Core; Steps; Handoff; IA; entornos/DNS/secretos/infraestructura; ejecutar workflow_dispatch, staging o CD; merge/deploy; gastos IA
stop_conditions: necesidad de cambiar runtime/backend/API/Prisma/semántica; acceso cross-namespace o productivo; credencial remota de base de datos fuera del port-forward aislado usado únicamente para provisionar el tenant sintético; escenario omitido o skip tolerado
guardrail: V2_CHANGE_GUARDRAIL_CHECK reconciliado Proceed:YES sólo para allowed; Proceed:NO para excluded
```

Este slice certifica equivalencia observable, no reemplaza las suites locales con acceso directo a
Prisma. Un `PASS` remoto sólo es válido con Environment autorizado, SHA completo, namespace y base
aislados, Mailpit, RBAC fail-closed, A/B/C completos y cero skips; no acredita producción.

---

## Slice PORTFOLIO_LEAD_G3_ORGANIZATION_SELECTIVE_BRIEFS (KAN-223)

**Registrado:** 2026-11-07 por HU KAN-223 y auditoría técnica acotada KAN-223#10670.

```text
slice_id: PORTFOLIO_LEAD_G3_ORGANIZATION_SELECTIVE_BRIEFS
functional_hu: KAN-223
functional_authority: KAN-223 + G3_ORGANIZACION_BRIEFS.md
technical_scope_authority: KAN-223#10670
depends_on: PL-04 KAN-154/KAN-155; PL-05 KAN-156/KAN-157; PORTFOLIO_LEAD_E5_ELIGIBILITY_BACKEND_G2B KAN-215/KAN-217; PORTFOLIO_LEAD_G1_ADAPTIVE_CONTEXT_BRIDGE KAN-219/KAN-222
logic_status: ACTIVE_V2_SLICE
implementation_status: G3_IMPLEMENTED_READY_FOR_REVIEW
visual_status: V2_TARGET_DEFINED
evidence_status: LOCAL_VERIFIED_INDEPENDENT_REVIEW_APPROVED
product_code_delta: NONE_REQUIRED_AFTER_GAP_AUDIT
implementation_commits: 8c2bf76 (Manifest + tests-first 0/1/3/25); 731ce00 (E2E PL-04 respeta continuación explícita E5)
independent_review: APPROVED at 731ce001a2e27d02a78e9a161c32c27f597c5142; no material findings
test_evidence: frontend 1069/1069 PASS; PostgreSQL KAN-221 5/5 + PL-04 11/11 + PL-05 3/3 PASS; authenticated E2E KAN-213/PL-04/PL-05 4/4 PASS; lint/build/Prisma validate/frontend typecheck PASS
known_baseline: backend typecheck conserva TS2740 preexistente fuera del diff en critical-synthesis-reasoning.test.ts
semantic_owner: Portfolio Lead setup E5 Organización y E6 Briefs selectivos sobre PL-04/PL-05 existentes
allowed: frontend V2 de FrozenOrganizationStage/FrozenBriefStage y pruebas focales/E2E autenticadas; correcciones mínimas de gaps demostrados por CA 0/1/3/25; ajuste documental del Manifest
reuse_required: PortfolioOrganizationService.confirmAndMaterialize; ChallengeActivationBrief/ChallengeActivationBriefVersion; KAN-217 eligibility; KAN-154/155/156/157
preserves: confirmación humana; snapshot/version; CAS; idempotencia; tenant; reentrada; destinos ungrouped/cross-cutting/outside; frontera PL05→PL06; slice KAN-207 sin cambios
excluded: backend/API/Prisma productivos nuevos; nueva materialización canónica; WorkItems o AnalysisRun inventados; Briefs masivos; Brief sin Challenge canónico; Core; ADR; Steps; Handoff; IA/model/provider/runtime; infraestructura; secretos; merge/deploy
stop_conditions: cualquier gap que requiera backend/API/Prisma productivos, cambiar cardinalidad/Core/ADR, reinterpretar opt-out como materialización o certificar multifrente
baseline: main@9b616df24eee269698b08b4848479233ed215dc2
guardrail: V2_CHANGE_GUARDRAIL_CHECK requerido antes de editar código productivo
```

Este slice reduce la complejidad del primer setup sin cambiar el modelo canónico. La propuesta
inicial mantiene un frente de trabajo y retos revisables; sólo `confirmAndMaterialize` puede crear
las identidades canónicas tras confirmación humana. Guardar un opt-out conserva una revisión
provisional y no habilita E6. E6 recupera y prepara Briefs de forma selectiva exclusivamente para
Challenges canónicos, sin crear Assignment, Initiative, WorkItem, AnalysisRun o Step.

---

## Slice PORTFOLIO_LEAD_G1_ADAPTIVE_CONTEXT_BRIDGE (KAN-219 / KAN-220 / KAN-221)

**Registrado:** 2026-11-06 por aprobación funcional KAN-219, autorización técnica acotada para
KAN-221 y revisión independiente de KAN-220 en tres rondas.

```text
slice_id: PORTFOLIO_LEAD_G1_ADAPTIVE_CONTEXT_BRIDGE
functional_hu: KAN-219
functional_authority: KAN-219#10650
technical_scope_authority: KAN-219#10653 + KAN-221#10654 + KAN-222#10667 (frontend V2 + tests/E2E)
technical_audit: KAN-220#10651, #10652, #10655, #10656, #10657 + revisión independiente R1/R2/R3 APPROVED
technical_task: KAN-221
frontend_task: KAN-222
frontend_authority: KAN-222#10667 (APPROVED; alcance limitado a frontend V2, tests focales y E2E autenticado)
frontend_implementation_status: IMPLEMENTED_READY_FOR_REVIEW
logic_status: ACTIVE_V2_BASELINE (solo semántica funcional aprobada)
implementation_status: IMPLEMENTED_UNVERIFIED
visual_status: V2_TARGET_DEFINED
evidence_status: VERIFIED
runtime_verification: LOCAL_UNIT_REGRESSION_PRISMA_LINT_BUILD_PASS; KAN-221_POSTGRESQL_5_OF_5_PASS; CI_5_OF_5_PASS_PR_257_RUN_42316275972
implementation_commits: ace7855 (KAN-221 tests-first); 433eec1 (KAN-221 backend/API/Prisma); 6572118 + b944c01 (KAN-221 independent-review fixes); e5393a7 (KAN-222 tests-first); c39327f (KAN-222 frontend); 760cb33 + e69bcd5 (KAN-222 hardening/independent-review fixes); c95faf5 (KAN-222 E2E reentry fix)
independent_review: R1 CHANGES_REQUIRED; R2 CHANGES_REQUIRED; R3 APPROVED
frontend_independent_review: KAN-222 R1 CHANGES_REQUIRED; R2 APPROVED at e69bcd5; final scope/E2E review APPROVED at c95faf5
implementation_surfaces: portfolio-bootstrap context schemas/router/controller/service; additive Prisma review/history/operation models and migration; KAN-222 frontend E1 client/hook/conversation wiring; focused/unit/HTTP/DB-integration/authenticated E2E tests
test_evidence: KAN-221 focused 37/37 PASS; KAN-222 focused + Bootstrap regression 61/61 PASS; authenticated KAN-222/KAN-212 combined E2E 5/5 PASS; frontend full regression/build/lint/front typecheck PASS; CI run 42316275972 5/5 jobs PASS; backend KAN-221 non-DB 17/17 PASS; backend typecheck retains pre-existing TS2740 only
postgresql_evidence: 5/5 KAN-221 integration scenarios PASS, 0 skipped, under PORTFOLIO_BOOTSTRAP_DB_INTEGRATION=1 in CI runs 42306134658 / PR #256 and 42316275972 / PR #257
semantic_owners: CompanyContextVersion PUBLISHED = fuente opcional; Bootstrap E1 = revisión/snapshot confirmado; PortfolioAnchor E2 = objetivo independiente
preserves: PORTFOLIO_LEAD_SETUP_NAVIGATION_REENTRY_G1 KAN-205/207 sin cambios
allowed: backend/API/Prisma aditivos y tests KAN-221 ya fusionados; frontend V2, tests focales y E2E autenticado KAN-222; ajuste documental mínimo del Manifest
excluded: Core; backend/API/Prisma adicionales; Steps; Handoff; canonicalización; Company obligatoria; cambio de bootstrapPhase/existingWorkStatus/E5; IA/model/provider/prompt/runtime; infra; secretos; merge/deploy
adr_required: NO — mientras la relación sea opcional, provisional y de procedencia; STOP y ADR si se vuelve canónica/obligatoria o cambia autoridad/cardinalidad Core
guardrail: KAN-221 cerrado por PR #255 y certificado por PR #256; KAN-222 V2_CHANGE_GUARDRAIL_CHECK emitido Proceed YES antes de editar código frontend productivo
baseline_evidence: front 1065/1065 PASS; backend 1872/1872 PASS + 180 environment-gated SKIPPED; lint/typecheck front/Prisma validate PASS; typecheck backend conserva TS2740 preexistente en blob origin/main 93bee03d5133bed32ea7ce949e168e621d5a4476
```

El bridge autorizado fija una versión `PUBLISHED` de Company Context como fuente opcional y
congela su evidencia/procedencia dentro del checkpoint E1 de Bootstrap. E1 puede existir sin
Company y no reutiliza la confirmación E2 de `PortfolioAnchor`. Guardar, corregir o confirmar E1
no modifica `bootstrapPhase`, `status`, `existingWorkStatus`, WorkItems, análisis, mutaciones,
elegibilidad E5 ni entidades canónicas. La persistencia futura debe ser aditiva, sin backfill, con
CAS, receipts idempotentes, autorización dual y aislamiento tenant conforme al Tech Spec aprobado
en KAN-220#10655/#10656/#10657.

KAN-221 implementa el contrato E1 de forma aditiva; PR #256 certificó sus cinco escenarios sobre
PostgreSQL desechable. KAN-222#10667 autoriza e implementa el incremento frontend en revisión:
conversación guiada determinista, síntesis editable y conexión al API E1 existente, sin modificar
Core, backend, Prisma, Steps, Handoff, IA productiva o infraestructura. La
concurrencia preexistente de creación de versiones de Company Context queda fuera de alcance; el
bridge sólo fija, revalida y congela una versión ya publicada.

---

## Slice PORTFOLIO_LEAD_G1_ADAPTIVE_CONTEXT_UX_REMEDIATION (KAN-240 / KAN-241)

**Registrado:** 2026-11-07 por QA productivo KAN-240#10732 y autorización explícita de
implementación KAN-241 sobre `main@4837e82f41439b75fdc41ab9d6621998b602643c`.

```text
slice_id: PORTFOLIO_LEAD_G1_ADAPTIVE_CONTEXT_UX_REMEDIATION
qa_source: KAN-240#10732
technical_task: KAN-241
technical_scope_authority: KAN-241 description + instrucción explícita del responsable
depends_on: PORTFOLIO_LEAD_G1_ADAPTIVE_CONTEXT_BRIDGE (KAN-219/220/221/222)
baseline: main@4837e82f41439b75fdc41ab9d6621998b602643c
logic_status: ACTIVE_V2_SLICE
implementation_status: AUTHORIZED_NOT_IMPLEMENTED
visual_status: V2_TARGET_DEFINED_BY_KAN_241
evidence_status: TESTING_REQUIRED
semantic_owner: conversación frontend E1 de contexto empresarial y transición explícita E1→E2→E3
allowed: frontend Portfolio Bootstrap E1/E2 navigation; preguntas deterministas adaptadas a hechos declarados; intención unknown/not_applicable persistida mediante el payload E1 existente; síntesis editable plegable; guardado y confirmación explícitos; errores/timeout/retry visibles; tests React y E2E autenticado sobre PostgreSQL desechable; ajuste documental del Manifest
required_scenarios: cafetería sin área/equipo/experiencia formal; empresa con procesos formales; desconocidos/no aplica; reentrada; guardar/confirmar sin pérdida; transición explícita E1→E2→E3; errores y timeout visibles
required_persistence: reutilizar GET/PUT draft/POST confirm de KAN-221; expectedVersion CAS; Idempotency-Key estable por retry; snapshots/provenance y confirmedSnapshot conservados; ninguna respuesta incorporada queda sólo en estado local
required_conversation: preguntas concisas con propósito; no repetir campos resueltos; no inferir capacidades de IA, métricas, departamentos, equipos o hechos; vocabulario proporcional al contexto declarado
required_progress: separar etapa revisada de avance persistido; CTA «Estoy de acuerdo, continuar al objetivo» sólo tras persistencia y confirmación efectiva; E2 confirmado habilita E3 sin alterar gates posteriores
reuse_required: PortfolioBootstrapContextConversation; FrozenContextConversation; FrozenObjectiveConversation; PortfolioBootstrapHome; API/hook E1 existente
preserves: relación Company opcional; versionado/provenance; CAS; idempotencia; tenant/owner guards backend; KAN-207; bootstrapPhase/existingWorkStatus/E5; confirmación humana
excluded: backend/API/Prisma; Core; Steps; Handoff; IA/model/provider/prompt/runtime; infraestructura; secretos; gastos IA; datos productivos; merge/deploy
stop_conditions: cualquier necesidad de ampliar el contrato backend/Prisma, cambiar autoridad/cardinalidad Core, crear una inferencia productiva o alterar gates E5+
tests_required: KAN241-CA01..CA08 tests-first; regresiones KAN-221/222 y G1/G2; E2E autenticado con DB desechable; lint; typecheck; build; revisión independiente; CI
guardrail: V2_CHANGE_GUARDRAIL_CHECK Proceed YES sólo para allowed; Proceed NO para excluded
```

Esta remediación cambia la interacción y la navegación frontend, no el contrato E1. Las decisiones
«desconocido» y «no aplica» se conservan de forma explícita dentro del payload versionado existente
y nunca se convierten en hechos inventados. El snapshot confirmado sólo cambia mediante la orden
de confirmación ya autorizada; revisar E1 no altera el avance persistido ni habilita etapas posteriores.

---

## Slice PORTFOLIO_LEAD_INTAKE_NAVIGATION_G2A (KAN-209 / KAN-212)

**Registrado:** 2026-11-03 por HU KAN-209 y aprobación funcional KAN-210 `RESUELTO`; preparación técnica acotada en KAN-212.

```text
slice_id: PORTFOLIO_LEAD_INTAKE_NAVIGATION_G2A
HU: KAN-209
functional_authority: KAN-210 (RESUELTO; CA-01..CA-04 y copy "Continuar sin iniciativas")
technical_task: KAN-212
depends_on: PORTFOLIO_LEAD_SETUP_NAVIGATION_REENTRY_G1 (sin modificar su estado, alcance ni evidencia)
logic_status: ACTIVE_V2_BASELINE (solo E3 Incorporación, transición explícita a E4 y camino sin iniciativas a E5)
implementation_status: IMPLEMENTED_UNVERIFIED
visual_status: V2_TARGET_DEFINED
evidence_status: TESTING (unit/integration/build PASS; authenticated V2 E2E BLOCKED by unavailable Docker engine)
implementation_commits: 8611bfd (frontend + unit tests); 2a528dd (V2 E2E + LEGACY_COMPAT regression); 43b7748 (independent-review fix for no-work integrity and lost-response reconciliation)
independent_review: APPROVED after two rounds; first round found and second round verified the no_existing_work + WorkItems guard
semantic_owner: V2 Portfolio Lead frontend setup navigation and intake recovery
authority: Jira KAN-209 + KAN-210; docs/STARTERIA_AUTHORITY.md; docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md; doc/product-adr/ADR-009-canonicalizacion-gobernada-iniciativas-documentales.md; baseline Portfolio Lead congelada v1.0 dentro de CA-01..CA-04 aprobados
current_state_evidence: STARTERIA_G2_E3_E4_AUDITORIA_Y_HANDOFF_v0.1.md (AUDIT_ONLY; evidencia, no autoridad autónoma)
entry_boundary: /portfolio/inicio muestra E3 después del CTA explícito de G1 y consume PortfolioBootstrapSession persistida
exit_boundary_has_work: E3 permanece visible en B3_PROVISIONAL_STRUCTURING; E4 se habilita solo después de analyze exitoso y recarga persistida en B4_MATERIAL_REVIEW
exit_boundary_no_work: POST work-items/none persiste existingWorkStatus=no_existing_work y B3_PROVISIONAL_STRUCTURING; CTA explícito "Continuar sin iniciativas" permite E5 sin AnalysisRun, WorkItem, Project, Initiative o Step ficticio
lateral_navigation_boundary: el máximo seleccionable se deriva de bootstrapPhase, existingWorkStatus y resultados backend; G2-A no autoriza saltar a E5/E6 para has_work ni a E6 para no_existing_work; E4→E5 con trabajo pertenece a G2-B
backend_capabilities_reused: confirmAnchor persiste B2_WORK_INTAKE; paste/manual/import/none persisten B3 + existingWorkStatus; analyze rechaza no_existing_work y, con trabajo válido, persiste B4; operaciones usan portfolio:read/write, ownership, auditoría e idempotencia existentes
backend_authority_gap: paste/manual/import/none no exigen anchor_confirmed ni bootstrapPhase=B2; analyze exige anchor presente + has_work + items, pero no exige anchor_confirmed ni fase B3. Una llamada API directa puede adelantar estado fuera del recorrido UI
backend_gap_disposition: BLOCKED / OUT_OF_SCOPE_FOR_KAN-212. No modificar backend/API/Prisma; no afirmar enforcement secuencial server-side completo. Si KAN-212 necesita ese enforcement, STOP y volver a aprobación funcional con autoridad backend explícita
current_surfaces: front/src/features/portfolio-lead/bootstrap/components/PortfolioBootstrapHome.tsx; front/src/features/portfolio-lead/bootstrap/state/usePortfolioBootstrap.ts; front/src/features/portfolio-lead/bootstrap/projection/bootstrapHomeProjection.ts; front/src/features/portfolio-lead/bootstrap/services/portfolioBootstrapClient.ts
direct_consumer: front/src/app/pages/PortfolioLeadHomePage.tsx on /portfolio/inicio
backend_providers_read_only: backend/modules/portfolio-bootstrap/portfolio-bootstrap.router.ts; portfolio-bootstrap.controller.ts; portfolio-bootstrap.service.ts; front/prisma/schema.prisma
keep: persisted BootstrapSession states; provisional WorkItems; idempotency; scoped authority; audit events; explicit analyzer command; no canonical writes
adapt: E3/E4 composition and selected/progress/available stage projection; explicit no-work CTA; intake error/retry/saving recovery; truthful PDF copy
legacy_dependencies: LEGACY_COMPAT E2E only as regression evidence; it does not define G2-A semantics
adapter_required: NO
tests_v2_conformance_existing: PortfolioBootstrapHome.test.tsx (G1 persisted navigation baseline); usePortfolioBootstrap.test.tsx (server-response state/reload); bootstrapHomeProjection.test.ts (no-work/provisional projection); portfolio-bootstrap router/integration/scoped-authority tests (persistence, idempotency, permissions, no canonical writes)
tests_legacy_compat: front/e2e/portfolio-entry-conversion.spec.ts scenarios tagged LEGACY_COMPAT for no-existing-work and CSV/XLSX analysis
tests_unknown_or_missing: no backend test rejects intake before anchor confirmation/B2; no authenticated E2E classified as G2-A V2_CONFORMANCE yet
tests_required: CA-01..CA-04 test-first frontend coverage; negative lateral-jump coverage; intake failure/retry coverage; reentry/reload; G1 regression; backend regression read-only; authenticated G2-A V2 E2E or explicit BLOCKED
verification_local: focused frontend 57/57 PASS; complete frontend 1063/1063 PASS; backend router/scoped-authority 24/24 PASS; frontend typecheck PASS; lint PASS; build PASS; git diff --check PASS
verification_limitations: authenticated G2-A V2_CONFORMANCE and LEGACY_COMPAT E2E BLOCKED because Docker Desktop Linux engine pipe is unavailable; backend integration tests requiring DATABASE_URL skipped; combined typecheck remains FAIL on unchanged baseline file critical-synthesis-reasoning.test.ts (identical blob at origin/main@e78241e)
backend_enforcement_status: UNVERIFIED / NOT IMPLEMENTED by KAN-212; backend_authority_gap remains open and out of scope
core_impact: NONE
backend_impact: NONE AUTHORIZED (read-only provider; authority gap above remains blocked)
api_impact: NONE
prisma_impact: NONE
step_impact: NONE
handoff_impact: NONE
portfolio_home_impact: NONE
ai_impact: NONE
excluded: Core; backend/API changes; Prisma/migrations; productive AI; Steps 0-4; Handoff; G1 modifications; Portfolio Home; G2-B review/gates; canonical Project/Initiative/Step writes; PDF extraction/custody; semantic deduplication; estimatedStep/maturity; merge/deploy
implementation_gate_frontend: V2_CHANGE_GUARDRAIL_CHECK Proceed YES for KAN-212 frontend and authorized tests only
implementation_gate_backend: Proceed NO; separate functional and backend authority required
```

Este registro no promociona el handoff de auditoría a contrato ni amplía KAN-212. La brecha de
enforcement backend queda visible y bloqueada; el frontend reutiliza únicamente estados y respuestas
persistidas existentes. `CURRENT_STATE.md` no cambia: la implementación permanece sin merge, el E2E
autenticado está bloqueado y no existe despliegue G2-A.

---

## Slice PORTFOLIO_LEAD_E5_ELIGIBILITY_BACKEND_G2B (KAN-215 / KAN-217)

**Registrado:** 2026-11-03 por HU KAN-215 y contrato funcional KAN-216 `RESUELTO`; preflight técnico acotado en KAN-217.

```text
slice_id: PORTFOLIO_LEAD_E5_ELIGIBILITY_BACKEND_G2B
HU: KAN-215
functional_authority: KAN-216 (RESUELTO; FA-01..FA-07, hard/soft, disposiciones humanas y anti-bypass PL-04)
technical_task: KAN-217 (Por hacer)
depends_on: KAN-216 RESUELTO; KAN-217 bloquea KAN-213; KAN-154/KAN-155 se preservan como autoridad PL-04 sin duplicar alcance
logic_status: ACTIVE_V2_POLICY / ADDITIVE_PERSISTENCE_AUTHORIZED
implementation_status: IMPLEMENTED_UNVERIFIED / READY_FOR_REVIEW
visual_status: NOT_APPLICABLE
evidence_status: TESTING (local PostgreSQL, backend regression, frontend regression, lint and build PASS; CI/PR and productive migration unverified)
semantic_owner: backend-authoritative E5 eligibility and PL-04 anti-bypass boundary
authority: Jira KAN-215 + KAN-216; KAN-217 comment 10637 authorizes the minimum additive Prisma/migration/backend/API perimeter; Jira KAN-154/KAN-155 for PL-04; docs/STARTERIA_AUTHORITY.md; docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md; doc/product-adr/ADR-009-canonicalizacion-gobernada-iniciativas-documentales.md
preserved_slices: PORTFOLIO_LEAD_SETUP_NAVIGATION_REENTRY_G1 and PORTFOLIO_LEAD_INTAKE_NAVIGATION_G2A remain unchanged
target_contract: server returns allowed/blocked, reason codes, blocker references and a stable source version; the same evaluator guards navigation plus PL-04 saveReviewedProposal and confirmAndMaterialize
material_review_separation: materialReviewComplete/B5 remains independent from E5 eligibility; a reviewed pending hard mutation does not become resolved by acknowledgement
existing_persistence_no_work: PortfolioBootstrapSession.existingWorkStatus=no_existing_work plus zero non-rejected WorkItems can authorize E5 without AnalysisRun, fake E4 completion or E6 access
existing_persistence_proposed_reviewed: ProposedMutation status, proposedValue.severity, reviewNote, reviewed/corrected actor and timestamps, sourceRefs and audit events can classify proposed/reviewed/rejected/corrected findings and preserve provenance
existing_persistence_confirmed_active: PortfolioAdvancementCondition persists severity, finding status, source mutation, provenance, confirmer and timestamp; confirmed hard conditions can therefore fail closed as active
authority_gap_confirmed_resolution: RESOLVED FOR IMPLEMENTATION by KAN-217 comment 10637. Add a separate durable disposition to PortfolioAdvancementCondition; never reuse the free-form finding status or infer permission from movementAffected
authorized_persistence_extension: additive disposition active/resolved/dismissed, actor, timestamp, reason, evidence refs, optimistic version and idempotency marker; historical rows remain active/fail-closed; AuditLog records every transition including reopen
pl04_current_guard: saveReviewedProposal and confirmAndMaterialize now share the backend E5 evaluator under session/evidence locks and SERIALIZABLE transactions; active/pending hard blockers deny both commands and stale eligibility invalidates the reviewed proposal
segments_derivable_without_schema: no-work eligibility; hard/soft proposed and reviewed classification; rejected proposal with explicit review note; stale/tenant/permission fail-closed; confirmed hard active fail-closed; shared read-only eligibility projection
segment_authorized: durable resolution/dismissal/reactivation of a confirmed hard condition with actor, reason, evidence, versioned lineage and same-session serialization
authorized_migration: additive PostgreSQL migration only; conservative active default/backfill; disposable database execution only; no productive migration
consumers_keep: PortfolioBootstrap session/read APIs; G2-A no-work path; G1 setup navigation; PL-04 proposal/materialization authority; ADR-009 human confirmation and no pre-confirmation canonical writes
consumers_adapted: portfolio-bootstrap backend eligibility evaluator/DTO/controller/router; durable hard-blocker disposition command; portfolio-organization save/confirm anti-bypass guards; focused unit/router/PostgreSQL tests
consumers_pending_separate_gate: frontend client/projection/navigation and authenticated G2-B E2E remain under KAN-213 after its dependencies are satisfied
tests_existing: portfolio-bootstrap router/integration/scoped-authority suites; portfolio-organization materialization integration suite; frontend hard/soft projection tests; G1/G2-A regressions
tests_required: PostgreSQL cases for proposed/reviewed/rejected/corrected/confirmed-active/confirmed-resolved hard blockers, soft pending, no-work, mixtures and stale versions; direct API bypass denial for save/confirm/materialize; tenant/role/idempotency/concurrency/audit; authenticated V2 E2E without replacing G2-A or LEGACY_COMPAT evidence
tests_evidence_local: 36/36 focused PASS; 1883/1883 backend PASS with 169 environment-gated skips; 1063/1063 frontend PASS; disposable PostgreSQL provision/migrate PASS with 73 migrations; lint/build/git diff check PASS; independent review APPROVED
implementation_commit: 8330709 (local only; no push/PR/merge/deploy)
typecheck_status: BLOCKED by pre-existing TS2740 in unchanged critical-synthesis-reasoning.test.ts; KAN-217 files add no typecheck diagnostics
core_impact: NONE AUTHORIZED
backend_impact: AUTHORIZED within KAN-217 for one shared E5 evaluator, disposition command and PL-04 anti-bypass guards
api_impact: AUTHORIZED within KAN-217 for allowed/blocked, reason codes, same-tenant blocker refs, snapshot version and human disposition command
prisma_impact: AUTHORIZED additive extension and migration for confirmed-hard disposition lifecycle only
step_impact: NONE
handoff_impact: NONE
portfolio_home_impact: NONE
ai_impact: NONE
excluded: Core/ADR changes; productive AI; Steps 0-4; Handoff; G1/G2-A rewrites; PL-04 redesign; automatic canonicalization; merge/deploy
implementation_gate_derivable_segments: Proceed YES; implement together so read eligibility and PL-04 commands cannot diverge
implementation_gate_full: V2_CHANGE_GUARDRAIL_CHECK Proceed YES for the exact KAN-217 comment 10637 perimeter
overall_proceed: YES
```

Este registro deja la implementación local del perímetro aditivo de KAN-217 preparada para revisión,
sin promoverla todavía a `IMPLEMENTED_VERIFIED`. Mantiene fail-closed los estados ambiguos y no
autoriza Core, ADR, ontología nueva, cambios PL-04 fuera de anti-bypass, migraciones productivas,
push, PR, merge ni despliegue. `CURRENT_STATE.md` no cambia.

---

## Slice FIRST_VALUE_P3_RUNTIME_PROCESSOR (KAN-86)

```text
slice_id: FIRST_VALUE_P3_RUNTIME_PROCESSOR
logic_status: ACTIVE_V2_BASELINE (solo el boundary CAPABILITY_CONTRACT_APPROVED de KAN-85 y comportamiento KAN-63/A.3.2)
implementation_status: IMPLEMENTED_VERIFIED (local KAN-86 validation; live provider/deployment unverified)
visual_status: NOT_APPLICABLE
evidence_status: TESTING
authority: KAN-85 + KAN-63 + docs/portfolio-lead/06-portfolio-monitoring/experience/FIRST_VALUE_P3_PRODUCTIVE_PROCESSING_CAPABILITY_CONTRACT_v0.1.md
scope: processor síncrono stateless, relaciones provisionales, aclaraciones agrupadas, sin escrituras canónicas ni persistencia durable
exclusions: KAN-83 UI/setup, D2/prefill, Portfolio Entry, Core, Steps 0-4
implementation_report: docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-86_FIRST_VALUE_P3_RUNTIME_PROCESSOR_IMPLEMENTATION_v0.1.md
integration_status: INTEGRATED_IN_GOVERNED_BASELINE (origin/main @ 1b44bc1 / PR #98)
```

## Slice FIRST_VALUE_RUNTIME_HARDENING_PROMOTION (KAN-83)

```text
slice_id: FIRST_VALUE_RUNTIME_HARDENING_PROMOTION
logic_status: ACTIVE_V2_BASELINE (KAN-63/A.3.2 checkpoints; P3 capability bounded by KAN-85)
implementation_status: IMPLEMENTED_VERIFIED (integrated in governed baseline; KAN-99 focused local regression revalidated 2026-10-04)
visual_status: V2_PILOT
evidence_status: SUPPORTED_LOCAL_VALIDATION (real provider and deployed network not verified)
authority: Jira KAN-83 + KAN-63; docs/portfolio-lead/06-portfolio-monitoring/experience/STARTERIA_PORTFOLIO_LEAD_A32_CHECKPOINT_INLINE_REVIEW_v0.1.md; KAN-85 P3 contract
entry_boundary: authenticated /portfolio/setup under PortfolioLeadLayout
exit_boundary: provisional P3 reading and local-only global confirmation; no canonical writes
implementation: front/src/features/portfolio-lead/first-value/PortfolioLeadFirstValuePage.tsx
backend_capability: POST /api/v1/first-value/p3/analyze (KAN-86; integrated)
implementation_report: docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-83_FIRST_VALUE_RUNTIME_HARDENING_PROMOTION_v0.2.md
integration_status: INTEGRATED_IN_GOVERNED_BASELINE (KAN-83/KAN-96 runtime present on current origin/main)
exclusions: D1/D2, Portfolio Entry, Core, Steps 0-4, canonical portfolio writes
```

## Slice KAN74_PORTFOLIO_ENTRY_TO_FIRST_VALUE (KAN-74 / KAN-99)

```text
slice_id: KAN74_PORTFOLIO_ENTRY_TO_FIRST_VALUE
HU: KAN-74; final closure: KAN-99
logic_status: ACTIVE_V2_BASELINE (Portfolio Entry confirmed Brief; exact KAN-97 identity; D1/D2; KAN-63 First Value)
implementation_status: IMPLEMENTED_VERIFIED (KAN-99 full regression and real exit-action journey verified 2026-10-04)
visual_status: V2_PILOT
evidence_status: LOCAL_REGRESSION_PASS (KAN-99 baseline; KAN-109 auth recovery: DELETE x10, Portfolio-first continuation/reload x10, full conversion spec x5 and frontend matrix PASS locally)
semantic_owner: Portfolio Entry through confirmed Brief; Portfolio Lead interprets organizational context; KAN-63 governs P1/P2/P3
authority: Jira KAN-74/KAN-99/KAN-109; KAN-88/89/90/96/97/98/100/101; KAN-63; approved Portfolio Entry Logic Contract
entry_boundary: /public/start → final strategic reading → confirmed Brief
target_exit_boundary: Download | Delete | Work with Starteria → auth/claim if needed → /portfolio/setup → exact D1 → Strategic Intent hydration → explicit P1
canonical_write_boundary: zero StrategicFront/Challenge/Initiative/Step/canonical Portfolio writes before governed Portfolio Lead action
implementation_report: docs/implementation/testing/KAN-109_AUTH_RECOVERY_STABILIZATION_v0.1.md; historical closure: docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/KAN-99_KAN74_FINAL_ALIGNMENT_REGRESSION_CLOSURE_v0.1.md
closure_status: KAN74_READY_TO_RESOLVE (real final-action reachability, scoped auth, full E2E wrapper, and quality matrix pass)
```

# 2.2 Slice KAN-64_PUBLIC_LANDING_L1_PRODUCT_FRAMING_HERO

**Registrado:** 2026-09-30 por HU autorizada KAN-64; habilitaciÃ³n sujeta a guardrail.

```text
slice_id: KAN-64_PUBLIC_LANDING_L1_PRODUCT_FRAMING_HERO
HU: KAN-64
slice: Public Landing - L1 Product Framing & Hero
surface: /
logic_status: ACTIVE_V2_BASELINE (framing aprobado por ADR-006; sin cambio de lÃ³gica Core o Portfolio Entry)
implementation_status: IMPLEMENTED_VERIFIED (KAN-64 resolved; baseline revalidated by KAN-102 focused tests)
visual_status: V2_PILOT
evidence_status: LOCAL_REGRESSION_PASS (KAN-102 frontend suite and Landing E2E; no production certification)
semantic_owner: Public Landing V2
portfolio_entry_semantic_owner: UNCHANGED (Portfolio Entry V2)
authority: doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md
           docs/experience/public-landing/STARTERIA_PUBLIC_LANDING_UX_SPEC_v0.1.md
           docs/implementation/public-landing/STARTERIA_PUBLIC_LANDING_FRONTEND_CURRENT_STATE_AUDIT_v0.1.md
           docs/design-system/STARTERIA_PUBLIC_LANDING_PORTFOLIO_ENTRY_CONTINUATION_ARCHITECTURE_v0.1.md
           docs/experience/portfolio-entry/PORTFOLIO_ENTRY_ACCEPTANCE_CHECKLIST_v0.1.md
core_impact: NONE
step_impact: NONE (Steps 0-4 and Adaptive Cycle unchanged)
public_start_runtime_impact: NONE (/public/start runtime unchanged)
early_access_demo_runtime: NOT_AUTHORIZED
implementation_status_note: KAN-64 is RESUELTO in Jira; KAN-102 separately extends the Landing with L2 and convergence framing
scope: Hero and above-the-fold framing; headline/subcopy; basic illustrative Starteria platform model; Portfolio Entry repositioned as an option; reuse PlatformStructure when compatible per audit; strictly necessary L1 tests
excluded: Early Access/Demo runtime or routes; Pilot; backend/API/persistence; Email/Calendar/CRM; commercial routes; /public/start internals; Clarification; Handoff; Agent/Skills; Auth; Core; Steps 0-4; Adaptive Cycle
entry_boundary: public route /
exit_boundary: existing Portfolio Entry entry path only; no new commercial destination
legacy_dependencies: LandingPage currently embeds PortfolioEntryExperience; retain its domain behavior and preserve /public/start; local PlatformStructure is presentation-only and requires audit-confirmed compatibility
adapter_required: NO (presentation-only adaptation; no domain/API adapter authorized)
tests_protecting_current_behavior: PortfolioEntryExperience.test.tsx; routes.public-entry.test.tsx; public-start E2E coverage (see frontend current-state audit)
```

Portfolio Entry conserva su autoridad semÃ¡ntica y comportamiento; esta slice cambia el framing de
la superficie `/` y no altera la ruta directa `/public/start`. Los caminos de Early Access y Demo,
incluida cualquier ruta o comportamiento runtime, no estÃ¡n autorizados por KAN-64.

## KAN-102 — PUBLIC_LANDING_L2_PORTFOLIO_ENTRY_CONVERGENCE

```text
slice_id: PUBLIC_LANDING_L2_PORTFOLIO_ENTRY_CONVERGENCE
HU: KAN-102
logic_status: ACTIVE_V2_BASELINE (ADR-006; Portfolio Entry logic unchanged)
implementation_status: IMPLEMENTED_VERIFIED (local frontend, route and Chromium E2E validation)
visual_status: V2_PILOT (focused Landing adaptation using current Design System primitives)
evidence_status: VERIFIED (623 frontend tests; typecheck/lint/build; focused Chromium journeys)
semantic_owner: Public Landing V2 for /; Portfolio Entry V2 for /public/start
authority: Jira KAN-102; ADR-006; public Landing UX Spec v0.1; Portfolio Entry Logic Contract v0.1;
           Portfolio Entry Clarification/Handoff Contract v0.2.1; Design System Contract v0.1
entry_boundary: / → existing /auth primary Starteria path | optional /public/start strategic clarity path
exit_boundary: existing Portfolio Entry handoff and KAN-74 continuation unchanged
implementation_report: docs/implementation/public-landing/KAN-102_LANDING_ENTRY_CONVERGENCE_v0.1.md
core_impact: NONE
step_impact: NONE (Steps 0–4 unchanged)
continuation_impact: NONE (KAN-74, D1/D2 and P1/P2/P3 unchanged)
reason_to_ask: transported unchanged from planner QuestionRecord through persisted turn/API/frontend DTO; rendered once only for the active question; missing/null/empty omitted
reason_to_ask_authority: REASON_TO_ASK_AUTHORIZED by accepted ADR-007; PUBLIC_EXPLANATION only; no private/model rationale exposure
reason_to_ask_implementation: IMPLEMENTED_VERIFIED locally by backend/frontend suites, typechecks, builds, lint and isolated Portfolio Entry Chromium E2E; see docs/implementation/portfolio-entry/KAN-104_REASON_TO_ASK_FRONTEND_CONVERGENCE_v0.1.md
commercial_destinations: RUNTIME_PENDING / BLOCKED_BY_DESTINATION (Demo/Early Access routes not invented)
```

# 2.3 Slice DEV_CYCLE_HU_TOOLING (KAN-91)

**Registrado:** 2026-10-02 por instrucción explícita del responsable (Orlando), HU KAN-91,
subtarea KAN-92, brief `estado/hu/ciclo-hu-spec.brief.md`.

```text
slice_id: DEV_CYCLE_HU_TOOLING
HU: KAN-91 (HU-0 Spec del ciclo)
logic_status: CANDIDATE (decisiones del brief; la Tech Spec de KAN-95 las fija)
implementation_status: NOT_IMPLEMENTED
visual_status: NOT_APPLICABLE
evidence_status: NO_EVIDENCE
semantic_owner: harness productor (ADR-009), no el producto
authority: AGENTS.md §3 (ciclo de vida de una tarea)
           docs/adr/ADR-009-dos-harnesses-el-producto-y-el-productor.md
           docs/adr/ADR-012-el-ciclo-de-hu-se-paga-por-ruta.md (KAN-93, proposed)
           docs/adr/ADR-013-el-ciclo-de-desarrollo-se-distribuye-como-plugin-aparte.md (KAN-94, proposed)
           docs/governance/ciclo-hu/DEV_CYCLE_HU_TECH_SPEC_v0.1.md (KAN-95; manda desde que se mergea su PR)
scope: triage por rutas R0/R1/R2/Q; skill /spec y corte de HU desde la spec; capa de negocio (scorecard C1 a C4, "Por qué importa", Resumen ejecutivo); calibración de Jev con registro en estado/; plugin starteria-desarrollo con init idempotente; revisión y PR (puerta y radio con Jev, revisor en dos ejes, /retro) y el job typecheck de .github/workflows/ci.yml, que también es gate de CD (ampliado por Orlando el 2026-10-04)
exclusions: plugin de producto starteria-harness y sus skills starteria*; ajuste automático de umbrales de Jev; priorización del backlog por scorecard; código de front, backend, Prisma, ai-service y Core (el job de CI no cambia código: sólo lo verifica)
core_impact: NONE
step_impact: NONE
registered_by: Orlando (responsable), instrucción explícita en la entrevista /hu del 2026-10-02
```

Es tooling del ciclo de desarrollo, no una capacidad de producto: no autoriza cambios en runtime de
Starteria. Mientras la Tech Spec no esté aprobada, este registro sólo habilita los documentos de
KAN-93, KAN-94 y KAN-95.

# 3. Jerarquía de autoridad objetivo

```text
STARTERIA_AUTHORITY
        ↓
CORE v0.2 FACTUAL
        ↓
APPROVED ADRs
        ↓
EXPERIENCE LOGIC CONTRACTS
        ↓
EXPERIENCE / ORCHESTRATION SUBCONTRACTS
        ↓
AGENT CONTRACTS
        ↓
SKILL CONTRACTS
        ↓
TECH SPECS
        ↓
SCHEMAS + TESTS + HARNESS
        ↓
IMPLEMENTATION
```

The external Core v0.3 candidate remains outside this authority chain until
ratified:

```text
Core v0.3 candidate
        ↓
External / reconciliation candidate
        ↓
Not current authority; requires ADR / evidence / re-test before promotion
```

El Design System no redefine esta jerarquía funcional.

Su relación es:

```text
EXPERIENCE CONTRACT
        +
DESIGN SYSTEM V2
        ↓
IMPLEMENTATION SPEC
        ↓
SCREEN / FRONTEND
```

---

# 4. Referencias transversales

## Crazy 8s E2E

`STARTERIA_CRAZY8S_E2E_BASE_LOGIC_v0.1.md`

- north star E2E;
- protege orientación Portfolio Lead;
- conecta intención → iniciativas → evidencia → decisión;
- Steps no es puerta de entrada automática del Portfolio Lead.

## Design System V2

`STARTERIA_DESIGN_SYSTEM_V2_RESTRUCTURE_BASELINE.md`

Clasificación:

```text
logic_status: ACTIVE_V2_BASELINE
implementation_status: PARTIAL_IMPLEMENTATION
visual_status: V2_TARGET_DEFINED
evidence_status: SUPPORTED
```

Gobierna foundations, semantic states, primitives, patterns y semántica visual AI/Human. No contiene autoridad de negocio.

## Landing V4

`STARTERIA_LANDING_V4_IMPLEMENTATION_SPEC.md`

Clasificación:

```text
logic_status: ACTIVE_V2_BASELINE (visual/experience implementation)
implementation_status: VERIFY_IN_REPO
visual_status: V2_TARGET_DEFINED
evidence_status: SUPPORTED
```

Representa y activa Portfolio Entry, pero no redefine su lógica.

## Step Design System Standby Audit

`STARTERIA_STEP_DESIGN_SYSTEM_STANDBY_AUDIT_PROMPT.md`

Clasificación:

```text
logic_status: HISTORICAL / EXECUTION_AID
implementation_status: NOT_APPLICABLE
visual_status: NOT_APPLICABLE
evidence_status: SUPPORTED_BOUNDARY_REFERENCE
```

Sirve para auditar el boundary de migración y no es contrato funcional.

---

# 5. Portfolio Entry — baseline V2 consolidada

```text
STARTERIA_CORE_LOGIC_CONTRACT
        ↓
Approved ADRs
        ↓
PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1
        ↓
PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1
        ↓
PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2
        ↓
entry-01-intent-detection v0.2
entry-02-context-extraction v0.2
entry-03-reverse-alignment v0.2
entry-04-question-planner v0.2
        ↓
PORTFOLIO_ENTRY_AI_HARNESS_v0.2
        ↓
PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2
```
## Reconciliation status

```text
installation_status: PRESENT_IN_REPO
promotion_status: CANDIDATE_RECONCILIATION
```

The v0.2/v0.2.1 Portfolio Entry stack is physically present in the repository.

This does NOT mean that all v0.1 documents are superseded.

Current interpretation:

- `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
  - remains the active approved Experience Contract;
- `PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
  - candidate orchestration/experience subcontract;
- `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
  - candidate Agent Contract;
- Skill 01–04 v0.2
  - candidate Skill Contracts;
- `PORTFOLIO_ENTRY_AI_HARNESS_v0.2.md`
  - candidate test baseline;
- `PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2.md`
  - candidate test baseline;
- `PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md`
  - evidence only.

```text
PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2

role: EVIDENCE
authority: NO
```

Promotion requires:

```text
repository reconciliation
+
reference validation
+
harness validation
+
explicit authority update
```

Evidence, not authority:

```text
PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2
```

CONFLICT
Contract: docs/STARTERIA_AUTHORITY.md section 4 / STARTERIA_V2_MANIFEST.md section 5
Requirement: The v0.2/v0.2.1 Portfolio Entry stack remains candidate until explicit promotion.
Current document/code: The section 5 hierarchy diagram places Clarification/Handoff v0.2.1 beneath the active Logic Contract, while the reconciliation status below it calls the stack candidate.
Observed mismatch: The diagram can be read as an authority chain even though the status says no promotion occurred.
Risk: Implementers may treat candidate orchestration and handoff rules as approved product behavior.
Recommended treatment: KEEP the stack candidate and treat the diagram as dependency/tracing structure only; reconcile the diagram in a separate authority update.
Requires ADR: no, unless product semantics change.

## Supported findings to preserve

- FND-001: `portfolio_governance ≠ initiative_governance`.
- FND-002: preserve `initial_entry_state`, allow `current_frame` to evolve.
- FND-003: preserve `operating_context` and `existing ≠ desired`.
- FND-004: support `success_conditions` and `quality_guardrails` when material.
- FND-005: support late reverse alignment.
- FND-006: session governance is needed above Question Planner.
- FND-007: handoff must show Starteria-specific value.
- FND-008: Portfolio Entry identifies what needs clarification/evidence but must not design detailed Step experiments.
- FND-009: keep `USER_DECLARED`, `EXTRACTED_FROM_USER_TEXT`, `AI_INFERRED`, `AI_SUGGESTED` separate.

## Active hypotheses — not validated rules yet

```text
HYP-001 Quick Clarification + Guided Exploration
HYP-002 Recommended Approach + Alternatives
HYP-003 GapResolutionMap
HYP-004 Program / accelerator support experience
```

## KAN-114A — Critical Reasoning Experience Contract

```text
logic_status: ACTIVE_V2_BASELINE (scoped frozen experience/reasoning contract)
implementation_status: NOT_IMPLEMENTED
visual_status: V2_TARGET_DEFINED
evidence_status: NO_EVIDENCE (contract approval is not runtime evidence)
authority: explicit user instruction 2026-10-06; subordinate to active Portfolio Entry Logic v0.1, Core v0.2 and approved ADRs
scope: provisional critical reading and its user-facing reasoning boundaries
exclusions: runtime, prompts, Skills, schemas, backend, frontend, Portfolio Setup, Core, Steps
treatment: KEEP scoped contract; candidate stack remains unpromoted; Critical Reasoning authority mapping reconciled for planning; runtime implementation still requires a valid implementation HU
traceability: KAN-114A is a local label; no Jira issue with that key was found
```

The frozen contract is `docs/experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md`. It establishes no runtime or implementation evidence.

---

## KAN-115 / KAN-116 — Portfolio Entry Live Understanding (114C)

```text
slice_id: PORTFOLIO_ENTRY_LIVE_UNDERSTANDING_114C
HU: KAN-115 — Portfolio Entry — Live Understanding; KAN-116 — 114C integration
dependency: KAN-114 Critical Situation Synthesis (PR #151 merged; reasoning semantic gate ACCEPTED, PASS_WITH_NON_BLOCKING_GAPS)
logic_status: ACTIVE_V2_BASELINE (bounded 114C surface, subordinate to Core v0.2 and the approved Portfolio Entry Logic Contract v0.1)
implementation_status: IMPLEMENTED_VERIFIED (KAN-116 merged in PR #156)
visual_status: V2_PILOT
evidence_status: VERIFIED (PR #156 CI, PostgreSQL integration and full-stack deterministic browser E2E)
semantic_owner: Portfolio Entry V2; KAN-114 supplies the existing Critical Situation Synthesis
merge_commit: be3c494b3980a9fafa67fe613c4a077a863eeffa
feature_head: de2a59beabf49072429ad279d7a8bed3de3c8866
ci: run 37847682123 — all required jobs SUCCESS
db_evidence: PostgreSQL session repository integration step SUCCESS; additive inputIntent migration applied; answer/correction round-trip and legacy default answer verified
browser_evidence: E2E light job SUCCESS; the full-stack Live Understanding Playwright spec completed SUCCESS using the deterministic synthesis test adapter
regression_evidence: Node backend/frontend tests with coverage SUCCESS; focused Live Understanding backend, presentation-boundary and frontend regressions are included
capability: user message -> existing analysis -> persisted turn -> KAN-114 Critical Situation Synthesis -> deterministic presentation allowlist -> response-ephemeral Live Understanding -> explicit correction -> normal clarification lifecycle -> fresh synthesis / Live Understanding
presentation_boundary: provisional, correctable and non-taxonomic; public-safe allowlist excludes raw KAN-114 reasoning metadata
persistence: PortfolioEntryTurn.inputIntent is an additive migration with DEFAULT 'answer' and KEEP_COMPAT; Live Understanding itself is response-ephemeral, is not stored as session/Core truth, and may be absent after full reload
integration_note: KAN-116 adds turn_index ordering to the synthesis input assembly for persisted user messages/corrections; it does not change KAN-114 prompt, output schema or accepted reasoning semantics
exclusions: 114D final handoff/conclusion; candidate_first_movement as recommendation; Starteria Path; Portfolio Setup continuity; Steps; Core canonicalization; persistence of Live Understanding as Core truth; KAN-114 reasoning-semantic changes
migration_status: PARTIAL (this closes the bounded 114C capability, not the broader Portfolio Entry migration)
legacy_treatment: KEEP_COMPAT; no retirement action is authorized or required by 114C
next_authorized_slice: 114D final handoff/conclusion — KAN-119 implementation verified on PR #161; merge pending
```

PR #156 CI evidence: `https://github.com/DarkCodePE/plataforma-starteria/actions/runs/37847682123`. The PostgreSQL integration and full-stack E2E steps completed successfully and were not skipped. This is scoped slice evidence, not global production certification.

## KAN-117 / KAN-119 — Critical Handoff (114D), PR #161

```text
slice_id: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_114D
HU: KAN-117 semantic acceptance; KAN-119 implementation and regression/closure
logic_status: ACTIVE_V2_BASELINE
implementation_status: IMPLEMENTED_VERIFIED
visual_status: V2_PILOT
evidence_status: VERIFIED
semantic_owner: Portfolio Entry V2 for the 114D Critical Handoff; historical legacy handoff consumers remain KEEP_COMPAT
authority: active Portfolio Entry Logic Contract v0.1; accepted/frozen Critical Reasoning Experience Contract v0.1; KAN-114 semantic acceptance; KAN-117/KAN-119 scoped implementation authority
reasoning_source: KAN-114 remains the sole reasoning source
entry_boundary: current Portfolio Entry reasoning / explicit close checkpoint
exit_boundary: confirmed Critical Handoff only
persistence: dedicated durable Portfolio Entry Critical Handoff artifact; sourceContextRevision binds the artifact to current session reasoning context
currentness: latest artifact whose sourceContextRevision matches contextRevision is current; context advance invalidates prior currentness
correction: returns through the existing reasoning/clarification cycle
confirmation: explicit representativeness confirmation; claim != confirmation; it does not certify each claim as objective fact
exclusions: Starteria Path 114E; Portfolio Setup continuity 114F; ADR-003 reconciliation; Core; Steps; scoring; experiment design; distinct alternative ranking
legacy_treatment: KEEP_COMPAT for explicitly historical legacy sessions
feature_head: f1bf4223b7aa14e9abcd91978ea9ecb0070e987a
evidence: PR #161 (https://github.com/DarkCodePE/plataforma-starteria/pull/161); GitHub CI run #220 / 37995220187 (https://github.com/DarkCodePE/plataforma-starteria/actions/runs/37995220187) SUCCESS at run HEAD b16dc03e04b8f3c419bfa5df565914b6613b7112; PostgreSQL repository integration 26/26; CURRENT_114D 6/6; LEGACY_COMPAT 7/7; Live Understanding full-stack E2E 1/1; Node coverage, Prisma schema/migrations, lint/build, Python and CI summary PASS
integration_status: INTEGRATED_IN_GOVERNED_BASELINE
merge_evidence: PR #161 merged; merge_commit 82ab8710b6e5a8e35514c70529ef8b5621e4c4eb
pre_merge_ci: #220 / 37995220187 / SUCCESS
post_merge_cd: #96 / 38000189145 / SUCCESS on merge_commit 82ab8710b6e5a8e35514c70529ef8b5621e4c4eb
known_non_blocking_limitation: post-confirmation reopen/correction policy is not generalized as a future reopen feature; confirmed artifact remains immutable under current v0.1 semantics
next_authorized_slice_at_114D_closure: 114E — NOT_STARTED; required its own authorized scope (historical closure snapshot)
```

PR #161 is integrated into the governed baseline at merge commit `82ab8710b6e5a8e35514c70529ef8b5621e4c4eb`. CI run #220 verifies the bounded 114D implementation; its run HEAD is recorded above. CD run #96 confirms the governed main workflow completed successfully, but does not certify production runtime or all Portfolio Entry, and does not reconcile ADR-003.

## KAN-120 / KAN-126 — Starteria Path (114E), scoped adoption

```text
slice_id: PORTFOLIO_ENTRY_STARTERIA_PATH_114E
HU: KAN-120 parent scope; KAN-121 audit; KAN-122 boundary; KAN-123 experience contract; KAN-124 architecture; KAN-125 implementation; KAN-126 scoped adoption
logic_status: ACTIVE_V2_BASELINE (bounded 114E semantics only)
implementation_status: IMPLEMENTED_VERIFIED (125F local evidence; PR #192 integrated)
visual_status: V2_PILOT (not V2_MIGRATED; 114F Portfolio-first is now implemented, while legacy consumers remain)
evidence_status: SUPPORTED (125A–125E integrated; 125F local E2E, security and regression evidence)
semantic_owner: Portfolio Entry V2 for 114E; KAN-114 remains the sole business-reasoning source
authority: factual Core v0.2; accepted product ADRs; active Portfolio Entry Logic Contract v0.1; accepted/frozen Critical Reasoning Experience Contract v0.1; KAN-114 semantic acceptance; KAN-119 governed 114D baseline; KAN-122 Business Capability Boundary (114E scoped); KAN-123 Starteria Path Experience Contract (114E scoped); KAN-124 architecture; KAN-120/KAN-125/KAN-126 scoped authority
source_gate: latest current, explicitly confirmed 114D Critical Handoff
architecture: OPTION_C
semantic_path: DERIVED
conversion_intent: PERSISTED_ON_ACCEPTED_SUBMISSION
consent: SUBMISSION_ONLY
path_view_auth: SESSION_OWNERSHIP
completed_slices: 125A, 125B, 125C, 125D, 125E, 125F; PR #192 integrated 125F
completed_artifact: deterministic projector; owned read API; Path UI; conversion presentation; first-party submission and consent; bounded analytics and regression E2E
125A_evidence: PR #180 merged at adb810475fffbedf3015820babceecaa1cd30e35; 23 focused tests; backend typecheck PASS; no I/O; no persistence; no API/UI; no legacy semantics; no 114F/Core/Steps leakage
125B_evidence: PR #182 merged at 1761c19; owned GET Path boundary and source/DTO gates
125C_evidence: PR #185 merged at 848eda1; bounded Path UI
125D_evidence: PR #187 merged at 72782f6; fail-closed conversion presentation
KAN-127_evidence: PR #189 merged at d184b80; scoped conversion submission policy adoption
125E_evidence: PR #190 merged at d52f86bc0605fedfec17b767397941e8eb9fca1b; first-party submission, consent and migration
125F_evidence: local test evidence in docs/implementation/portfolio-entry/KAN-125F_STARTERIA_PATH_E2E_SECURITY_CLOSURE_v0.1.md; merged as PR #192 at bf5547cf06e67ea929e1c37fbe44b2155ab454df; the report's no-commit/push/PR statement describes its earlier local snapshot
commercial_activation: DISABLED / NO_VERIFIED_DESTINATION (production/default; Demo and Early Access unavailable)
current_boundaries: semantic Path DERIVED, not persisted; conversion submission only under VERIFIED_ACTIVE first-party fixture; no verified production Early Access/Demo destination
legacy_treatment: KEEP_COMPAT; legacy starteria_path, recommended_approach, and recommended_cta are not 114E semantic authority
exclusions: 114F; Portfolio Setup continuity; ADR-003 reconciliation; Core; Steps; legacy semantic reuse; production Early Access/Demo activation or destination availability; open product access; Landing claims beyond adopted boundary; semantic Path persistence
non_promoted: 114F; Portfolio Setup continuity; ADR-003 resolution; Core; Steps; legacy starteria_path/recommended_approach/recommended_cta; Early Access destination availability; Demo destination availability; Landing claims beyond the adopted boundary; open product access
```

`IMPLEMENTED_VERIFIED` records bounded 114E runtime semantics, not commercial
activation or completion of the wider V2 journey. The historical 114E exclusions
above record that KAN-125/KAN-126 did not reconcile ADR-003. KAN-129 reconciles
its current status as `ACCEPTED`; this does not change the 114E visual state or
promote 114F. Legacy consumers remain explicit `KEEP_COMPAT`. PR #192 merged
125F at `bf5547cf06e67ea929e1c37fbe44b2155ab454df`.

## KAN-128 / KAN-132 — Portfolio Setup Continuity (114F), scoped authority adoption

```text
slice_id: PORTFOLIO_SETUP_CONTINUITY_114F
HU: KAN-128; KAN-129 ADR-003 reconciliation; KAN-130 decision package; KAN-131 contract; KAN-132 scoped adoption; KAN-133 architecture; KAN-134–142 implementation and verification
logic_status: ACCEPTED / FROZEN (114F Experience Contract v0.1, implementation planning only)
implementation_status: IMPLEMENTED_VERIFIED (Portfolio-first 114F only; 133G Initiative exception deferred)
visual_status: V2_PILOT (114F UI and governed arrival verified; not platform-wide V2 migration)
evidence_status: VERIFIED (KAN-142 E2E_SECURITY_REGRESSION_VERIFIED locally; CI/deployment baseline and health smoke separated)
authority: Core v0.2 factual; ADR-003/004/005 ACCEPTED; Portfolio Entry Logic Contract v0.1; governed 114D; accepted 114E where relevant; Portfolio Setup Continuity Experience Contract v0.1 ACCEPTED for 114F only. KAN-130 remains shaping evidence/decision baseline below accepted ADRs and contract
technical_audit_status: COMPLETED (KAN-133)
technical_audit_authorized: YES
implementation_planning_authorized: YES
runtime_implementation_authorized: YES (bounded 133A–133F technical slices only; no authority for 133G)
next_gate: KAN-142 read-only review and human-approved merge; KAN-128 closure after merge/deploy verification
blockers: none for Portfolio-first; 133G requires external target-scoped issuer policy, governed profile transition, Assignment/provisioning evidence and explicit Initiative routing authority
legacy_treatment: KEEP_COMPAT pending repository-wide consumer evidence and separate retirement authority
old_post_entry_disposition: SUPERSEDED_IN_PART for the overlapping 114F boundary; documentary status remains PROPOSED FOR REVIEW
migration_status: PARTIAL (legacy KEEP_COMPAT and 133G deferred)
report: docs/implementation/portfolio-entry/KAN-142_114F_133H_E2E_SECURITY_REGRESSION_CLOSURE_REPORT_v0.1.md
```

ADR-003's former status conflict is no longer a 114F blocker. KAN-132 accepted
the 114F logic; KAN-133 completed the audit and KAN-134–141 supplied specific
runtime authority for the bounded Portfolio-first path. KAN-142 verifies that
path. Grant/issuer provisioning, 133G, Core, Steps and route retirement remain
outside these slices. See
`docs/implementation/portfolio-entry/KAN-129_ADR003_114F_AUTHORITY_RECONCILIATION_v0.1.md`.

# 6. V2 E2E slice map

| Slice | Logic status | Implementation status | Visual status | Evidence status | Treatment |
|---|---|---|---|---|---|
| Authority / Governance | ACTIVE_V2_BASELINE but stale index | IMPLEMENTED | NOT_APPLICABLE | SUPPORTED | UPDATE |
| Core | v0.2 factual current / v0.3 external reconciliation candidate | PARTIAL / PRODUCTIVE dependencies | NOT_APPLICABLE | REQUIRES_RETEST | KEEP v0.2 + ADR/re-test candidate |
| Crazy 8s E2E | ACTIVE_V2_BASELINE / reference | NOT_APPLICABLE | NOT_APPLICABLE | SUPPORTED | KEEP |
| Public Landing - L1 Product Framing & Hero (KAN-64) | ACTIVE_V2_BASELINE (ADR-006) | IMPLEMENTED_VERIFIED; KAN-64 RESUELTO | V2_PILOT | LOCAL_REGRESSION_PASS (KAN-102 revalidation) | KEEP; Early Access/Demo runtime excluded |
| Public Landing L2 + Portfolio Entry Convergence (KAN-102) | ACTIVE_V2_BASELINE (ADR-006) | IMPLEMENTED_VERIFIED (local) | V2_PILOT | VERIFIED (frontend + focused Chromium) | KEEP; commercial destinations pending authority |
| Landing V4 | ACTIVE_V2_BASELINE visual spec | VERIFY_IN_REPO | V2_TARGET_DEFINED | SUPPORTED | RECONCILE |
| Portfolio Entry logic | ACTIVE_V2_BASELINE | PARTIAL_IMPLEMENTATION; KAN-114 + 114C integrated; 114D IMPLEMENTED_VERIFIED | V2_PILOT | VERIFIED for 114C and 114D scoped CI | KEEP bounded slices; PR #161 integrated in governed baseline |
| Clarification | CANDIDATE + hypotheses | EXPERIMENTAL / VERIFY | V2_PILOT | TESTING | TEST |
| Handoff / Value Handoff Cognition | CANDIDATE + hypotheses | EXPERIMENTAL / VERIFY | V2_PILOT | TESTING | TEST |
| Registration / continuation | CANDIDATE | IMPLEMENTED_UNVERIFIED | MIXED | TESTING | VERIFY grant and full E2E |
| Portfolio Setup Continuity 114F | ACCEPTED / FROZEN | IMPLEMENTED_VERIFIED (Portfolio-first only) | V2_PILOT | VERIFIED (KAN-142 local E2E/security/regression) | KEEP_COMPAT legacy; 133G deferred; migration PARTIAL |
| Portfolio Bootstrap | CANDIDATE | IMPLEMENTED_VERIFIED reported | V2_MIGRATED / VERIFY | VERIFIED reported | RECONCILE |
| Portfolio Home | TARGET AUTHORITY FROZEN PH-0 / CANDIDATE | PH-2 read-model implementation evidence; post-merge `GO_WITH_GAPS`; runtime not certified | V2_TARGET_DEFINED; PH-3A evidence only | REQUIRES_RETEST | RECONCILE; PH-3B not implemented |
| Strategic Framing | ACTIVE_V2_BASELINE / APPROVED EXPERIENCE BASELINE (SF-0) | PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED (SF-1, SF-2, SF-3A, SF-3B) | V2_TARGET_DEFINED | TESTING | SF-3C+ not implemented; no end-to-end runtime, UI, Copilot or canonical promotion |
| Strategic Front | CANDIDATE/Core-related | PARTIAL/IMPLEMENTED | V2_MIGRATED DS-07 | SUPPORTED | RECONCILE |
| Challenge | CANDIDATE/Core-related | PARTIAL/IMPLEMENTED | V2_MIGRATED DS-07 | SUPPORTED | RECONCILE |
| Activation / Invitation | TARGET CONTRACT | PARTIAL / PILOT | V2_PILOT DS-08 | SUPPORTED | VERIFY |
| Initiative Overview | CANDIDATE / unresolved | EXISTING LEGACY RUNTIME | V2_TARGET_UNRESOLVED | UNKNOWN | AUDIT FIRST |
| Step 0 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 1 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 2 | STABLE CORE FUNCTION / candidate refinements | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 3 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step 4 | STABLE CORE FUNCTION | PRODUCTIVE / VERIFY | V1_LEGACY | MIXED | DO NOT MIGRATE YET |
| Step Workspace V2 | TESTABLE_HYPOTHESIS | NOT_IMPLEMENTED | V2_TARGET_UNRESOLVED | NO_EVIDENCE | EXPLORE |
| Harness V2 | ACTIVE TEST BASELINE candidate | VERIFY_REAL_TREE | NOT_APPLICABLE | TESTING | RECONCILE |
| Findings | SUPPORTED_FINDING + hypotheses | NOT_APPLICABLE | NOT_APPLICABLE | SUPPORTED | KEEP / INDEX |
| Design System | ACTIVE_V2_BASELINE | PARTIAL_IMPLEMENTATION | V2_MIGRATED THROUGH DS-08 BOUNDARY | SUPPORTED | PROMOTE / INDEX |

---

# 7. Visual migration boundary

```text
Landing / Portfolio Entry
        ↓
Handoff
        ↓
Portfolio Home
        ↓
Strategic Front
        ↓
Challenge
        ↓
Activation / Invitation
        ↓
==============================
CURRENT V2 VISUAL BOUNDARY
==============================
        ↓
Initiative Overview
        ↓
Step 0
        ↓
Step 1
        ↓
Step 2
        ↓
Step 3
        ↓
Step 4
```

Interpretation:

```text
ABOVE BOUNDARY
= V2 visual direction exists and has been migrated/piloted to varying degrees

BELOW BOUNDARY
= runtime/domain may exist
= UI is not V2 visual authority
= target workspace architecture is exploratory
```

---

# 8. Step platform rule

Until the Step audit is completed:

```text
CORE LOGIC = preserve
DOMAIN LOGIC = inspect before changes
LEGACY UI = not visual authority
STEP WORKSPACE CONCEPT = hypothesis
DESIGN SYSTEM = available building blocks
```

Working principle only:

```text
conversation for work
structure for memory
```

`Step/Nav | Workspace | Copilot` is a conceptual target, not frozen architecture.

---

# 9. Version cleanup rules

## PROMOTE / INDEX

- `STARTERIA_DESIGN_SYSTEM_V2_RESTRUCTURE_BASELINE.md`
- `STARTERIA_LANDING_V4_IMPLEMENTATION_SPEC.md`
- `PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
- `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
- canonical Skill 01 v0.2
- canonical Skill 02 v0.2
- canonical Skill 03 v0.2
- canonical Skill 04 v0.2
- `PORTFOLIO_ENTRY_AI_HARNESS_v0.2.md`
- `PORTFOLIO_ENTRY_HARNESS_EXECUTION_SPEC_v0.2.md`
- `PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md`

## KEEP

- `STARTERIA_CRAZY8S_E2E_BASE_LOGIC_v0.1.md`
- `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`
- Core candidate pending explicit decision
- relevant approved ADRs
- implementation reports as evidence

## SUPERSEDE / HISTORICAL

- Agent v0.1
- Skills v0.1 after canonical v0.2 promotion
- Clarification/Handoff v0.2 after v0.2.1 installation
- Harness v0.1 as regression/history
- Findings v0.1 after v0.2 installation
- obsolete public Initiative-first PRDs as authority

Do not delete historical documents. Add status banners and replacement links.

---

# 10. Non-authority artefacts

These may be evidence/reference/execution aids only:

```text
audit prompts
Codex prompts
current-state audits
implementation reports
mockups
old PRDs
code behavior
test output
```

---

# 11. V2 change governance

## Experimental UX change

```text
hypothesis
→ experiment
→ evidence
→ supported/rejected
→ update baseline if supported
```

## Contract change

```text
supported finding
→ version contract
→ tests
→ implementation
→ manifest update
```

## Structural/Core change

```text
new evidence
→ ADR
→ Core decision
→ subordinate contracts
→ implementation
```

---

# 12. Definition of consolidated V2

Starteria V2 is reconciled when:

- one active authority tree is documented;
- every active document has one canonical repo path;
- no v0.1 file is silently consumed when a promoted v0.2 exists;
- findings and hypotheses are separated;
- implementation does not grant authority;
- visual migration state is explicit;
- Portfolio Lead remains the initial corporate user orientation;
- Initiative Owner begins only after the appropriate handoff;
- Landing V4 represents Portfolio Entry without redefining it;
- Design System is canonical through the Portfolio/Activation boundary;
- Initiative Overview / Steps are not falsely labeled V2;
- every active slice links authority → implementation → tests/evidence;
- legacy removal is dependency-driven, not name-driven.

---

# 13. Execution checklist

## Phase 0 — Freeze and snapshot

- [ ] Freeze new product feature work temporarily.
- [ ] Record product repo, harness repo, default branches and current commit SHAs.
- [ ] List open PRs touching contracts, Portfolio, DS or Steps.
- [ ] Confirm no unmerged branch contains the only copy of candidate authority docs.

## Phase 1 — Document reconciliation

- [ ] Verify `STARTERIA_AUTHORITY.md`.
- [ ] Verify Core version/status.
- [ ] Verify approved ADR index.
- [ ] Verify Crazy 8s canonical path.
- [ ] Install/index Portfolio Entry v0.2 stack.
- [ ] Select exactly one canonical Skill 04 v0.2.
- [ ] Install/index Findings v0.2.
- [ ] Install/index Harness v0.2 + Execution Spec v0.2.
- [ ] Install/index Design System V2 Baseline.
- [ ] Install/index Landing V4 Implementation Spec.
- [ ] Index Step DS Standby Audit Prompt as execution aid only.
- [ ] Mark superseded documents with explicit banners.
- [ ] Do not delete historical versions.

## Phase 2 — Authority index

- [ ] Create/update `STARTERIA_V2_MANIFEST.md`.
- [ ] Add canonical path for every active document.
- [ ] Add `logic_status`.
- [ ] Add `implementation_status`.
- [ ] Add `visual_status`.
- [ ] Add `evidence_status`.
- [ ] Add supersedes/superseded_by links.
- [ ] Add affected slice.
- [ ] Add linked findings/hypotheses.
- [ ] Update `STARTERIA_AUTHORITY.md` only after canonical paths exist.

## Phase 3 — Product/runtime truth reconciliation

- [ ] Audit Landing `/`.
- [ ] Audit `/public/start`.
- [ ] Compare Landing V4 vs current implementation.
- [ ] Compare Portfolio Entry contracts vs runtime.
- [ ] Verify provisional vs canonical persistence.
- [ ] Verify registration/continuation behavior.
- [ ] Verify Portfolio Bootstrap implementation reports against code.
- [ ] Verify Portfolio Home reports against code.
- [ ] Verify Strategic Front / Challenge runtime against contracts.
- [ ] Verify Activation / Invitation against handoff contract.
- [ ] Classify every mismatch: KEEP / ADAPT / CONSOLIDATE / DEPRECATE / REMOVE / UNKNOWN.

## Phase 4 — Design System reconciliation

- [ ] Verify DS-01 Foundations.
- [ ] Verify DS-02 Primitives.
- [ ] Verify DS-03 AI/Human/Review patterns.
- [ ] Verify DS-04 Page patterns.
- [ ] Verify DS-05 Portfolio Entry/Handoff consumers.
- [ ] Verify DS-06 Portfolio Home consumers.
- [ ] Verify DS-07 Strategic Front/Challenge consumers.
- [ ] Verify DS-08 Activation/Invitation consumers.
- [ ] Identify duplicate primitives/patterns.
- [ ] Mark actual visual state per route.
- [ ] Confirm Initiative Overview and Steps are outside migrated V2 boundary.

## Phase 5 — Harness and evidence reconciliation

- [ ] Verify actual Harness v0.2 code exists where indexes claim.
- [ ] Verify fixtures version.
- [ ] Verify session controller.
- [ ] Verify late reverse alignment tests.
- [ ] Verify `initial_entry_state` preservation.
- [ ] Verify `portfolio_governance`.
- [ ] Verify `operating_context`.
- [ ] Verify provenance separation.
- [ ] Verify Step boundary.
- [ ] Run Contract Conformance separately from Hypothesis Validation.
- [ ] Do not mark HYP-001..004 supported without new evidence.

## Phase 6 — Portfolio Lead E2E check

- [ ] Landing starts from business/portfolio reality.
- [ ] Portfolio Entry does not drift to Initiative Owner.
- [ ] `solution_first` triggers reverse alignment, not Step activation.
- [ ] Handoff can lead to portfolio work, governance, alignment, import or initiative analysis.
- [ ] Registration does not silently force `create Initiative → Step 0`.
- [ ] Portfolio Home answers “what needs attention?”.
- [ ] Portfolio → Initiative activation has an explicit boundary.
- [ ] Initiative Owner starts only after invitation/acceptance/handoff where applicable.

## Phase 7 — Step Platform truth audit

- [ ] Run `STARTERIA_STEP_DESIGN_SYSTEM_STANDBY_AUDIT_PROMPT.md`.
- [ ] Produce `STARTERIA_STEP_PLATFORM_V2_CURRENT_STATE_TRUTH_MAP.md`.
- [ ] Map routes.
- [ ] Map domain actions.
- [ ] Map persistence.
- [ ] Map Step gating.
- [ ] Map evidence/reviews.
- [ ] Map AI/Copilot.
- [ ] Map files/MCP if present.
- [ ] Map invitation/pre-start/overview.
- [ ] Identify legacy UI vs reusable domain logic.
- [ ] Do not redesign yet.

## Phase 8 — Step V2 exploration

- [ ] Compare Guided Workspace.
- [ ] Compare Conversation-First Workspace.
- [ ] Compare Hybrid Workspace.
- [ ] Evaluate structured memory.
- [ ] Evaluate evidence capture.
- [ ] Evaluate Copilot usefulness.
- [ ] Evaluate enterprise traceability.
- [ ] Evaluate implementation complexity.
- [ ] Produce DS gap analysis.
- [ ] Human selects target architecture.
- [ ] Only then create Step Experience Contract.

## Phase 9 — Cleanup plan

- [ ] Classify legacy as SAFE_NOW.
- [ ] AFTER_ADAPTER.
- [ ] AFTER_ROUTE_MIGRATION.
- [ ] AFTER_DB_MIGRATION.
- [ ] KEEP_FOR_COMPATIBILITY.
- [ ] DO_NOT_TOUCH.
- [ ] Remove only after consumer/test evidence.
- [ ] Avoid big-bang deletion.

## Phase 10 — Implementation readiness gate

Do not resume feature implementation until:

- [ ] Authority tree is canonical.
- [ ] Manifest is current.
- [ ] Product/runtime truth map is current.
- [ ] Design System boundary is verified.
- [ ] Harness baseline is verified.
- [ ] Findings vs hypotheses are separated.
- [ ] No unresolved authority conflict affects the next slice.
- [ ] Next implementation slice has a named authority source.
- [ ] Acceptance tests are defined before implementation.

---

# 14. Recommended implementation sequence after reconciliation

```text
1. reconcile Landing V4
2. reconcile Portfolio Entry V2 runtime
3. reconcile Handoff / registration continuation
4. validate Bootstrap / Portfolio Home
5. validate Activation / Invitation
6. only then decide Initiative Overview / Step Workspace V2
```

This preserves the Portfolio Lead journey and prevents Initiative Owner drift.
