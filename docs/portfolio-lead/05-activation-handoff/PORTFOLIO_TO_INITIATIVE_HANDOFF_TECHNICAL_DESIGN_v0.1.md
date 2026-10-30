# Portfolio Lead → Initiative Owner Handoff — Technical Design v0.1

**Modo:** technical design refresh + go/no-go only
**Fecha:** 2026-09-28
**Enmienda acotada:** 2026-10-22 — PL-06A / KAN-161 comentarios 10429 y 10431
**Vertical:** Portfolio Lead → Initiative Owner Handoff
**Hard boundary:** `Start / Empezar`
**Estado:** listo para planificación de implementación; no autoriza por sí mismo cambios de runtime.

Este documento no implementa runtime, no modifica Prisma/schema, no crea migraciones, no modifica frontend/backend, tests productivos ni Step 0–4.

## 0.1. Enmienda técnica PL-06A — bandeja de preparación

Esta enmienda conserva la versión `v0.1` y el audit histórico de 2026-09-28. Las secciones
anteriores continúan explicando la evolución del bounded context; para KAN-161, esta sección
registra el delta autorizado sobre la implementación actual ya existente. No autoriza PL-06B.

### Estado verificado que se reutiliza

- `PortfolioHandoffAssignment` es el único aggregate de Assignment.
- Prisma permite N Assignments por Challenge y contiene ambos `targetKind`.
- `ChallengeActivationBriefVersion.assignments[]` permite que una versión confirmada respalde N
  Assignments.
- el lifecycle existente contiene `CREATED`; no se añade `DRAFT`;
- create, delivery, recipient claim y response permanecen comandos separados;
- owner/team, tenant, BriefVersion e idempotency existentes se adaptan, no se duplican.

### Persistencia mínima

Añadir al aggregate existente únicamente el payload contextual editable requerido por PL-06A:

```text
context_note?       // texto del encargo; no es Brief ni contexto canónico de Initiative
```

La provenance de cada cambio se registra mediante evento durable
`assignment_preparation_updated` con actor, canal, timestamp, entity version y campos cambiados
redactados/fingerprinted. `createdByActorId`, `updatedAt` y `version` existentes completan la
trazabilidad. No se crea tabla/aggregate paralelo de Assignment.

La relación opcional `briefVersionId` existente se conserva:

- `CHALLENGE`: requerida, confirmada, mismo Challenge y tenant;
- `EXISTING_INITIATIVE`: opcional; cuando PL-05 la aporta debe ser confirmada, del mismo Challenge
  y tenant, y queda inmutable en la Assignment;
- editar `context_note`, Owner o team nunca sustituye `briefVersionId`.

### Create y duplicate guard

Generalizar el comando de creación actual para aceptar ambos targets. Dentro de una transacción
serializable se bloquea el Challenge, se valida el fingerprint/idempotency receipt, target lineage
y duplicate key antes de insertar:

```text
EXISTING_INITIATIVE duplicate key
  organizationId + challengeId + initiativeId + non-terminal state

CHALLENGE duplicate key
  organizationId + challengeId + briefVersionId + invitedEmailNormalized + non-terminal state
```

El duplicate guard es de aplicación/transacción porque Prisma no representa de forma portable el
índice parcial por lifecycle. Mismo command key + fingerprint recupera el resultado original;
misma key + payload distinto produce conflict. Otra key que viola el duplicate guard también
produce conflict, no una segunda fila.

Para `EXISTING_INITIATIVE`, `findInitiative` debe resolver además
`InitiativePortfolioMeta(projectId, challengeId)`. Comprobar solo Project + tenant es insuficiente.

### Update en `CREATED`

Agregar un command transaccional:

```text
updateCreatedHandoffAssignment(
  assignmentId,
  ownerAndMembers,
  contextNote,
  expectedVersion,
  idempotencyKey,
  fingerprint,
  actor
)
```

Precondiciones: actor Portfolio autorizado, mismo tenant, estado `CREATED`, versión exacta,
exactamente un Owner, máximo tres ejecutores e identidades únicas. El target, `challengeId`,
`initiativeId` y `briefVersionId` son inmutables. Assignment y members se actualizan atómicamente,
`version` aumenta una vez y el evento durable se persiste en la misma transacción. Stale/non-CREATED
no produce cambios parciales.

Retirar una preparación usa una transición explícita `CREATED → REVOKED` con expected version y
evento; nunca hard-delete. KAN-161 puede exponerla solo como acción secundaria de la bandeja y no
debe invocar delivery/invitation.

### Read model de preparación

El read de Challenge devuelve separadamente:

```text
canonicalInitiatives[]  // Project + InitiativePortfolioMeta exactos y tenant-safe
importedWorkRecords[]   // contexto documental, nunca target seleccionable
assignments[]           // N filas, incluida identidad y version exactas
```

La API no presenta el número de work records como “Initiatives disponibles”. Si una fuente
importada carece de `ProjectId`, informa `IMPORTED_RECORD_NOT_CANONICAL` sin crear Project ni
InitiativePortfolioMeta.

La ruta legacy `GET /portfolio/challenges/:challengeId/initiatives` no se reutiliza sin añadir el
resource guard del Challenge. El nuevo/adaptado read debe aplicar permiso `portfolio:write`, tenant
y protección contra enumeración cross-tenant.

### API PL-06A

Las formas concretas pueden conservar las rutas existentes, pero deben exponer estas capacidades:

```text
GET   /portfolio/challenges/:challengeId/handoff-assignments
GET   /portfolio/challenges/:challengeId/assignable-initiatives
POST  /portfolio/challenges/:challengeId/handoff-assignments
PATCH /portfolio/handoff-assignments/:assignmentId/preparation
POST  /portfolio/handoff-assignments/:assignmentId/revoke-preparation
```

POST generaliza el body con `targetKind`, `initiativeId?`, `briefId?`, `briefVersionId?`,
recipient/Owner, members y `contextNote?`. PATCH exige `expectedVersion`. Ninguna de estas rutas
crea acceso de Invitation, DeliveryAttempt, Project, InitiativePortfolioMeta o Step.

### Frontend PL-06A

Adaptar `ChallengeAssignmentPreparationPanel` como controlador de bandeja:

1. recuperar BriefVersion exacta, canonical Initiatives y N Assignments;
2. presentar contexto confirmado inmutable;
3. `Agregar asignación` abre editor focal de target, Owner, equipo y `contextNote`;
4. Guardar crea una Assignment; Editar usa expected version;
5. la lista usa `map`, nunca `find` por BriefVersion;
6. la revisión resume múltiples Assignments sin activar Send;
7. re-entry recompone la bandeja desde servidor y permite cobertura parcial.

El editor no crea un formulario de Initiative ni ofrece como Initiative los registros importados.
La conversación Copilot-first y la jerarquía visual aprobada en PL-05 permanecen intactas.

### Gate de identidad del tenant visual

Antes de habilitar `EXISTING_INITIATIVE`, enumerar read-only los ocho registros visibles y registrar
por elemento `recordType`, `sourceId`, `projectId?`, relación `InitiativePortfolioMeta` y provenance.

- Con Project + meta válidos: el target puede probarse e implementarse.
- Sin ProjectId: marcar `IMPORTED_RECORD_NOT_CANONICAL`; no fabricar identidad, no degradar a
  CHALLENGE y no declarar PASS de Existing Initiative.
- El camino CHALLENGE puede continuar de forma independiente con la BriefVersion confirmada.

La conversión/vinculación de un work record a Project requiere otro boundary con confirmación
humana, validación de identidad/provenance y autoridad funcional/backend explícita. No es un
side-effect de Agregar, Guardar, Editar, Re-entry o Send.

### Exclusiones

KAN-161 termina en preparación/revisión `CREATED`. No implementa Send por lote, SMTP, Overview de
delivery, Accept, Reject, Start, Initiative, Project, InitiativePortfolioMeta o Steps. KAN-162/163
gobiernan PL-06B.

## 1. Decisión ejecutiva

**GO.** No queda una decisión de autoridad o arquitectura que deba resolverse antes de comenzar H-TECH-02.

ADR-005 se reconoce como **ACCEPTED** para este refresh y resuelve los blockers anteriores:

- la persistencia acotada `PortfolioHandoffAssignment` es requerida;
- `/projects/new?challengeId=...` es solo compatibilidad y objetivo de deprecación, no la ruta canónica.

Se conservan estas invariantes:

```text
PortfolioHandoffAssignment ≠ Initiative Core
Project = identidad actual de Initiative
Assigned Challenge puede existir sin Initiative
Accept ≠ Start
handoff_assignment_started ≠ initiative_started
PortfolioHandoffProjection = read model derivado/read-only
```

El vertical termina al registrar correctamente `handoff_assignment_started`. No define la ruta, pantalla, Steps, Cycle ni comportamiento posterior.

## 2. Autoridad y reconciliación

Se revisaron `docs/STARTERIA_AUTHORITY.md`, `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md`, ADR-003, ADR-004, ADR-005, el Experience Contract v0.2, Acceptance Checklist, Visual + UX Writing Contract, Integration Contract y la implementación actual.

### Decisiones cerradas

ADR-005 deja decididos el bounded persistence model, sus límites de ownership, el equipo máximo, la continuidad de identidad invitada, la separación Accept/Start, la proyección derivada, los eventos semánticos mínimos y la cuarentena del legacy route. No son ADR blockers de los slices siguientes.

### Conflicto documental restante

El archivo de ADR-005 conserva en su encabezado `PROPOSED — ADR DESIGN ONLY`, mientras la autoridad actualizada del pedido lo declara ACCEPTED. Es inconsistencia de metadata documental, no incertidumbre de arquitectura para este diseño. Este refresh no modifica el ADR.

### Conflictos de implementación restantes

```text
CONFLICT
Contract: Experience v0.2 / Integration Contract / ADR-005
Requirement: Assigned Challenge no crea Project, Initiative, TeamMember de Core, Steps ni Step 0 al aceptar o iniciar.
Current document/code: frontend mantiene CTAs a /projects/new?challengeId=...; ProjectService materializa Project, equipo, Steps e InitiativePortfolioMeta.
Observed mismatch: la ruta legacy y sus consumers siguen presentes.
Risk: un consumer puede volver a canonicalizar el handoff como Initiative.
Recommended treatment: KEEP como compatibilidad explícita; ADAPT/quarantine y DEPRECATE mediante H-TECH-09.
Requires ADR: no; ADR-005 ya decide el boundary.
```

```text
CONFLICT
Contract: Integration Contract
Requirement: Portfolio consume estado semántico de handoff mediante una proyección derivada.
Current document/code: PortfolioHomeReadService deriva visibilidad desde invitaciones y metadatos de Initiative; no existe PortfolioHandoffProjection verificada.
Observed mismatch: faltan assignment identity, response/reason, started state y versionado de proyección.
Risk: Portfolio mezcla handoff con lifecycle de Initiative.
Recommended treatment: ADD bounded projection/read adapter en H-TECH-08.
Requires ADR: no.
```

```text
CONFLICT
Contract: accountless recipient / ADR-004
Requirement: abrir → register/login → volver a la misma invitación → validar identidad.
Current document/code: ChallengeInvitation tiene campos de token/claim, pero no se verificó un servicio/router canónico de recipient continuation.
Observed mismatch: la persistencia parcial no demuestra un flujo ejecutable.
Risk: claim o return context pueden quedar acoplados al cliente o permitir mismatch.
Recommended treatment: ADD y verificar dentro de H-TECH-03, con adapter sobre auth/session existente.
Requires ADR: no, mientras no cambie la autoridad de identidad.
```

## 3. Current-state truth audit

Evidencia observada:

```text
frontend CTA
  → /projects/new?challengeId=...
  → CreateProjectPage / POST project
  → ProjectService.createProject
  → Project + TeamMember + Steps + InitiativePortfolioMeta
```

Consumers observados incluyen `front/src/app/routes.ts`, `front/src/app/pages/PortfolioLeadChallengesPage.tsx`, `front/src/app/pages/ParticipantChallengeDetailPage.tsx` y tests DS-07/DS-08 que esperan la ruta legacy. En backend, `backend/modules/projects/project.service.ts` y sus tests materializan la superficie Initiative/Steps.

Existe `ChallengeInvitation` en `front/prisma/schema.prisma` con `targetType`, `existingProjectId`, `recipientEmailNormalized`, `invitationStatus`, `claimedByUserId`, `claimTokenHash`, timestamps y expiración. Es infraestructura existente y evidencia de migración, no prueba de que sea el aggregate canónico del nuevo handoff.

`backend/modules/portfolio/portfolio-home.read-service.ts` deriva actualmente estados desde invitaciones y proyectos/metadatos. No se verificaron módulos canónicos `HandoffAssignment`, recipient continuation, `PortfolioHandoffProjection` ni persistencia durable de eventos del handoff.

| Superficie | Tratamiento | Semantic owner | Puede definir comportamiento nuevo |
|---|---|---|---|
| `Project` y Core Initiative existentes | KEEP | V2/Core actual | Solo semántica vigente |
| `ChallengeInvitation` | ADAPT como delivery/compatibility source | LEGACY_COMPAT hasta adapter | No sin bounded handoff boundary |
| `ProjectService.createProject(challengeLink)` | KEEP para consumers no relacionados; excluir del handoff | LEGACY_COMPAT | No para Assigned Challenge |
| `/projects/new?challengeId=...` | KEEP_COMPAT + DEPRECATE | LEGACY_COMPAT | No como handoff canónico |
| PortfolioHomeReadService actual | ADAPT | V2 read adapter target | No lifecycle writes paralelos |
| DS-08 primitives | KEEP | V2 visual infrastructure | Solo presentación |
| Initiative Workspace / Step routes | DO NOT USE pre-Start | Core/downstream | No |

## 4. Target bounded-context architecture

```text
Web / email / Copilot / API adapter
              │
              ▼
Handoff application layer
  assignment commands + invitation access + reads
              │
              ├─ PortfolioHandoffAssignment repository/aggregate boundary
              ├─ invitation delivery + claim adapter
              ├─ identity/resource/permission guards
              ├─ transactional state + audit + semantic event writer
              └─ PortfolioHandoffProjection projector/read adapter
                              │
                              ▼
                     Portfolio Lead read surface

Start(existing initiative) ── handoff event ──► existing Initiative context
Start(challenge) ─────────── handoff event ──► later formulation workstream
```

Handoff owns assignment, invitation response and handoff start. Project/Initiative Core owns Initiative lifecycle, Steps, evidence and downstream work. Portfolio consumes derived handoff/downstream state; it does not read DOM, pathname, component state or manually maintained Step state.

## 5. HandoffAssignment persistence boundary

The canonical handoff record is a bounded `PortfolioHandoffAssignment`. Exact Prisma/table names remain implementation detail; the domain boundary is no longer unresolved.

Minimum conceptual state:

```text
assignment_id
organization/portfolio scope
challenge_id
target_kind: EXISTING_INITIATIVE | CHALLENGE
initiative_id?                 // required only for EXISTING_INITIATIVE
initiative_owner_identity
execution_members[]            // exactly 1 owner + 0..2 additional
observers[]                    // outside execution cap
invited_email_normalized
invited_identity_ref?
handoff_state
accepted_at? rejected_at? started_at?
rejection_reason?
portfolio_response?
version
audit/event references
created_at / updated_at
```

Assignment owns target refs, owner/team for the handoff, lifecycle, Accept/Reject, rejection reason, Portfolio response, Start state and version. Invitation infrastructure owns token, claim/access verification, delivery status and expiration mechanics. Project/Initiative Core owns actual Initiative and Step lifecycle. `PortfolioHandoffProjection` is derived/read-only and never a command target.

Existing materialized Projects remain valid and are not migrated or rewritten by this workstream.

Canonical lifecycle:

```text
created → sent → viewed → accepted → started
                    ├────→ rejected
created/sent/viewed ├────→ revoked
created/sent/viewed └────→ expired
```

Legacy values map only where evidenced: `pendiente → created`, `notificado → sent`, `confirmado → accepted`, `declinado → rejected`. Authentication is not a handoff lifecycle state.

## 6. Team invariant enforcement

At creation and every material team mutation, enforce transactionally:

```text
exactly 1 Initiative Owner
+ 0..2 additional executing members
= 1..3 executing people
```

Observers do not count and do not receive execution authority. Reject missing owner, duplicate owner, duplicate identities, more than three executors, unknown/inactive identities and owner changes hidden inside a rejection response. Use the existing authorization framework as an adapter; do not infer authority from legacy labels alone.

## 7. Identity continuation and claim

Required flow:

```text
opaque invitation token
  → public/minimal invitation read
  → register or login
  → restore the same invitation/assignment
  → authenticated normalized email matches invited identity
  → Accept / Reject enabled
```

Store only an opaque token hash. Return context must be short-lived and server-bound, not an arbitrary redirect. A valid session does not bypass recipient matching; a valid invitation does not bypass organization/resource permissions. A mismatch cannot claim, replace recipient or mutate owner.

The absence of verified recipient services/routes is implementation discovery in H-TECH-03, not a blocker to the overall plan or H-TECH-02.

## 8. Invitation lifecycle and delivery

Lifecycle state belongs to the assignment boundary; delivery attempts belong to invitation infrastructure.

- `send` is explicit, idempotent and records delivery attempt/result separately from business response.
- `viewed` requires view evidence; it is never inferred from `sent`.
- delivery failure is retryable and does not accept/reject/expire the assignment automatically.
- expiry/revocation is checked transactionally before response.
- SMTP/mailer may be reused as transport only; lifecycle remains in handoff services.
- email has one primary `Revisar asignación` CTA and cannot Accept/Reject directly.

## 9. Accept, Reject and Portfolio response

**Accept** is explicit, authenticated, invited-identity-matched, permission-checked, version-aware and idempotent. It transitions only `sent/viewed → accepted`. Assigned Initiative preserves its existing `initiative_id`; Assigned Challenge must not create Project, Initiative, Core TeamMember, Steps, Step 0 or InitiativePortfolioMeta. Accept never starts work.

**Reject** requires a non-empty reason, matching identity, current version and audit event. It transitions to `rejected`; retry is idempotent. A rejected assignment cannot silently become accepted or started.

An authorized Portfolio actor may record `portfolio_response_recorded`. The response preserves rejection history and does not accept, reassign, reactivate or change owner implicitly. Any new assignment or owner change is an explicit command with separate lineage.

## 10. Handoff Shell and Activation Overview

Invitation Landing, post-Accept Overview and pre-Start Overview share one Handoff Shell, using existing DS primitives before creating new equivalents. The shell has no operational sidebar, Step navigation, persistent Initiative Workspace/Copilot or fabricated progress.

```text
Invitation      → ¿Quiero asumir este encargo?       → Accept primary / Reject secondary
Accepted state  → ¿Qué he aceptado?                   → continuar hacia Overview
Pre-Start       → ¿Estoy listo para empezar?          → Start primary
Rejected        → ¿Qué ocurrió y qué queda registrado? → no silent recovery
```

Assigned Challenge must be visibly a Challenge assignment, not an Initiative preview. The Overview explains what Start records without designing or promising Steps after the boundary.

Expected frontend areas are new handoff routes/components composed from DS-08 primitives; `InitiativeWorkspacePage` and Step route maps are excluded before Start. H-TECH-06 owns concrete route/component discovery.

## 11. Start boundary

Canonical command:

```text
startAssignedWork(assignmentId, expectedVersion, idempotencyKey)
```

Preconditions: accepted, not revoked/expired, eligible authenticated actor, Owner permission, current version. Effects:

- persist `started` and `started_at` once;
- persist/dispatch `handoff_assignment_started` once;
- for Assigned Initiative, reference existing Initiative;
- for Assigned Challenge, allow `initiative_id = null`;
- stop this vertical.

It must not assert `initiative_started`, initialize Step 0, create Project/Steps, prescribe downstream route or read downstream DOM. Delivery to a later workstream must be distinguishable from the canonical assignment transition.

## 12. PortfolioHandoffProjection

Add a derived/read-only projection or semantically equivalent read model with at least:

```text
assignment_id, target_kind, challenge_id, initiative_id?
initiative_owner, execution_team, observers
handoff_state, accepted_at?, rejected_at?, rejection_reason?
portfolio_response?, started_at?
last_material_event, source_event_refs
projection_version, generated_at
```

Before a downstream Initiative exists, Portfolio reads this projection and does not fabricate a `PortfolioInitiativeProjection`. For Assigned Initiative, it coexists with the existing Initiative projection. Later `initiative_linked_to_handoff_assignment` adds lineage without rewriting prior handoff history.

Current PortfolioHomeReadService must consume this via an adapter rather than deriving handoff visibility only from invitation status plus `InitiativePortfolioMeta`.

Sync update in the same transaction versus a narrow durable outbox-like record is an implementation choice inside H-TECH-08, bounded by idempotency, version ordering and replay safety. It is not an ADR blocker.

## 13. Semantic event persistence

Minimum handoff-owned events:

```text
assignment_created
invitation_sent
invitation_viewed
assignment_accepted
assignment_rejected
portfolio_response_recorded
handoff_assignment_started
```

Also support `assignment_revoked`, `assignment_expired` and `initiative_linked_to_handoff_assignment` where applicable. Each durable event needs event id, type, assignment/entity, actor/role, channel, correlation/causation, timestamp, entity version and redacted payload.

Do not add a full distributed event bus. Reuse verified envelope/in-process conventions plus a narrow transactional persisted event/outbox-like record, or an equivalent that preserves auditability, retry, idempotency and future decoupling. Duplicate event IDs are harmless; stale versions cannot move a projection backwards.

The lack of currently verified event persistence/projection is implementation scope for H-TECH-08, not an ADR blocker.

## 14. Legacy-route quarantine

`/projects/new?challengeId=...` is:

```text
NOT_CANONICAL
COMPATIBILITY_ONLY
DEPRECATION_TARGET
```

Quarantine requires: no new handoff CTA/invitation/Overview/Start link to it; no Handoff service may call `ProjectService.createProject(challengeLink)` for Assigned Challenge; existing unrelated consumers must be inventoried and marked with replacement, owner and retirement trigger; negative tests must prove Assigned Challenge Accept/Start do not create Project/Steps; deprecation telemetry/evidence must precede retirement.

This is a bounded implementation slice, not an unresolved ADR decision.

## 15. Technical uncertainty re-evaluation

| Area | Planning status | Resolution |
|---|---|---|
| Assignment persistence boundaries | Concrete | ADR-005 selects bounded persistence; exact schema is H-TECH-02 implementation work. |
| Team invariant enforcement | Concrete | Exactly one owner and max three executors are fixed; transaction/guard discovery is H-TECH-02. |
| Invitation identity continuation/claim | Bounded, route discovery open | Semantics are fixed; absent services/routes are H-TECH-03, not a global blocker. |
| Invitation lifecycle/delivery | Concrete | Assignment state is separate from delivery attempts; H-TECH-04. |
| Accept / Reject / Portfolio response | Concrete | Commands, guards, idempotency and no implicit ownership mutation are fixed; H-TECH-05. |
| Handoff Shell | Concrete | Shared shell, CTA hierarchy and pre-Start exclusions are fixed; route/component mapping is H-TECH-06. |
| Start boundary | Concrete | `startAssignedWork` ends the vertical and emits handoff event only; H-TECH-07. |
| PortfolioHandoffProjection | Concrete with mechanism choice | Boundary and minimum fields are fixed; sync vs narrow outbox is H-TECH-08. |
| Semantic event persistence | Bounded, mechanism discovery open | Vocabulary/envelope/idempotency are fixed; durable implementation is H-TECH-08, no ADR. |
| Legacy-route quarantine | Concrete | Compatibility/deprecation classification is fixed; inventory and retirement evidence are H-TECH-09. |

Conclusion: the design is sufficiently concrete for implementation planning. Remaining discovery is ordinary work inside bounded slices, not unresolved product architecture.

## 16. Traceability to BR/AC and tests

| Technical boundary | BR/AC coverage | Test layer |
|---|---|---|
| Assignment modes/persistence | BR-HO-001, 004–007; AC-HO-004–008, 067, 070, 075–076 | domain/contract + repository integration |
| Owner/team invariant | BR-HO-008–011; AC-HO-009–012 | unit/domain + integration |
| Identity continuation/claim | BR-HO-012–016; AC-HO-013–018, 064–066 | auth/application integration + E2E |
| Accept | BR-HO-017–021; AC-HO-019–024, 068–071 | command contract + negative integration |
| Reject/Portfolio response | BR-HO-022–026; AC-HO-025–031, 072 | command/integration + audit |
| Lifecycle/delivery | BR-HO-027–030, 036–038; AC-HO-032–047 | state machine + delivery retry |
| Shell/Overview/UX | BR-HO-031–035; AC-HO-038–047, 073 | component/accessibility + route |
| Start | BR-HO-039–042; AC-HO-048–053, 068–071 | integration + boundary E2E |
| Projection/events | BR-HO-043–048; AC-HO-054–063, 074 | replay/order/stale/duplicate |
| Channels/permissions | BR-HO-049–050; AC-HO-064–066 | authorization + channel equivalence |
| Legacy quarantine | AC-HO-069–078 | negative route/consumer regression |

Do not modify Step 0–4 tests in this workstream. Existing legacy tests remain compatibility evidence until consumers are classified.

## 17. Final implementation slices

| Slice | Dependencies | Primary files/modules expected | BR/AC coverage | Test layer | Independent? |
|---|---|---|---|---|---|
| **H-TECH-02 — Assignment persistence and team invariants** | ADR-005 accepted; current authz; Challenge/Project references | New bounded handoff domain/application/repository modules; `front/prisma/schema.prisma` only in a later authorized implementation; adapters around `backend/modules/portfolio/portfolio.service.ts` and invitation persistence | BR-HO-001, 004–011; AC-HO-004–012, 067, 075–076 | domain/unit, repository integration, negative side-effect integration | **Yes; first slice** |
| **H-TECH-03 — Identity continuation and claim** | H-TECH-02 boundary; existing auth/session | auth/session continuation adapter; token/claim service and routes; frontend return-context client/route | BR-HO-012–016; AC-HO-013–018, 064–066 | auth integration, mismatch tests, E2E | Yes after 02; interface-based parallel work possible |
| **H-TECH-04 — Invitation lifecycle and delivery** | H-TECH-02; H-TECH-03 access contract; SMTP transport | delivery adapter/service; retry/idempotency policy; email template/route integration | BR-HO-027–030, 036–038; AC-HO-032–037, 044–047 | state machine, mailer/delivery integration, retry | Yes after 02; can parallel 03 |
| **H-TECH-05 — Accept, Reject and Portfolio response** | H-TECH-02 guards/version; H-TECH-03 identity; H-TECH-08 event port | handoff commands/services; authz guards; Portfolio response API; no ProjectService call for Challenge | BR-HO-017–026; AC-HO-019–031, 067–072 | command contract, concurrency/idempotency integration, audit | No; depends on 02/03 |
| **H-TECH-06 — Handoff Shell and Activation Overview** | H-TECH-03 reads; H-TECH-05 states; UX/DS contracts | new handoff pages/routes/components under `front/src`; DS-08 primitives; API client | BR-HO-031–038; AC-HO-038–047, 073 | component/accessibility, route, visual contract | Partial; completion depends on 03/05 |
| **H-TECH-07 — Start boundary** | H-TECH-02 lifecycle/version; H-TECH-03 identity; H-TECH-05 accepted state; event port | `startAssignedWork`; downstream adapter; start handler; no-Project/Step guard | BR-HO-039–042; AC-HO-048–053, 068–071 | integration, concurrency/idempotency, boundary E2E | No; depends on 02/03/05 and event interface |
| **H-TECH-08 — Portfolio projection and semantic events** | H-TECH-02 identity; H-TECH-05/07 commands; Portfolio read model | event envelope/persistence adapter; projector; `PortfolioHandoffProjection`; PortfolioHomeReadService adapter | BR-HO-043–048; AC-HO-054–063, 074 | replay/order/stale/duplicate integration; read contract | Projection can start after 02; consumers depend on 07 vocabulary |
| **H-TECH-09 — Legacy route quarantine** | H-TECH-05/06 canonical paths; H-TECH-07 boundary; consumer inventory | `front/src/app/routes.ts`, challenge pages/tests, legacy adapter/telemetry; backend compatibility call sites | AC-HO-069–076, 078 | negative route/consumer regression, migration evidence | Inventory independent; completion depends on replacement |

No H-TECH-01 ADR gate remains. ADR-005 supplied that decision; do not create a duplicate persistence or legacy-route ADR.

## 18. GO / NO-GO

```text
GO
```

`GO` applies to implementation planning and the first bounded slice only. It does not authorize code, schema, migration, frontend/backend runtime, production tests or Step 0–4 changes in this document.

**Exact first slice:** `H-TECH-02 — Assignment persistence and team invariants`.

**Remaining ADR blockers:** none.

**Remaining implementation conflicts:** legacy route consumers, missing recipient continuation services/routes, and missing projection/event persistence. Each has a bounded owner slice above and does not require another ADR unless implementation proposes changing Core identity, authority, team semantics or Step lifecycle.

### GO acotado PL-06A / KAN-161

```text
GO: CHALLENGE preparation tray
CONDITIONAL GO: EXISTING_INITIATIVE preparation
NO-GO: PL-06B Send/delivery
```

`EXISTING_INITIATIVE` pasa a GO únicamente para Projects canónicos que tengan
`InitiativePortfolioMeta(projectId, challengeId)` real en el tenant visual. Un work record
importado sin esa identidad queda bloqueado como `IMPORTED_RECORD_NOT_CANONICAL`; esta condición no
bloquea el target `CHALLENGE` ni autoriza materialización automática.

## 19. Handoff for implementation

Before code, the implementing agent must produce the normal `V2_CHANGE_GUARDRAIL_CHECK` for H-TECH-02, classify exact current consumers, and obtain the explicit implementation authorization required by repository governance. This Technical Design refresh is not that authorization.

No Jira ticket is created by this refresh.
