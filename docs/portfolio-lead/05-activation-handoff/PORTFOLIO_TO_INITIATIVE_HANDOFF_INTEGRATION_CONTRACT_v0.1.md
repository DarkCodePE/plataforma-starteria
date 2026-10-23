# STARTERIA — PORTFOLIO → INITIATIVE OWNER HANDOFF INTEGRATION CONTRACT v0.1

**Estado:** CANDIDATE FOR FREEZE  
**Versión:** v0.1  
**Fecha:** 2026-09-28  
**Enmienda acotada:** 2026-10-22 — PL-06A / KAN-160 y KAN-161  
**Vertical:** Portfolio Lead → Initiative Owner Handoff  
**Jira:** KAN-49  
**Scope:** integración semántica entre Portfolio/Handoff y el workstream downstream de Initiative/Steps  
**Hard boundary de ownership:** este contrato define la interfaz; no define lógica interna posterior a `Start`.

---

## 0. Propósito

Definir una interfaz estable y desacoplada para que:

1. Portfolio pueda gobernar el estado del handoff sin depender de UI interna;
2. el bounded context de Handoff pueda terminar en `Start` sin asumir que siempre existe una Initiative;
3. el workstream downstream pueda publicar progreso material hacia Portfolio posteriormente;
4. Assigned Challenge pueda correlacionarse con la Initiative que se formule después, sin crear una Initiative ficticia antes de tiempo;
5. Web, Copilot, API y futuros adapters operen sobre la misma verdad canónica y los mismos permisos.

Principio:

```text
Portfolio / Handoff
      ↓ commands + canonical state
Handoff Domain Boundary
      ↓ semantic events / read models
Downstream Initiative Core
      ↓ domain events / projections
Portfolio
```

Nunca:

```text
Portfolio
→ DOM / pathname / component state de Steps
→ inferir lifecycle
```

---

# 1. Autoridad

Este contrato está subordinado a:

1. `STARTERIA_CORE_LOGIC_CONTRACT.md`;
2. ADRs aprobados;
3. `PORTFOLIO_GOVERNANCE_INTERACTION_CONTRACT_v0.1.md`;
4. `PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.2.md`;
5. `PORTFOLIO_TO_INITIATIVE_HANDOFF_ACCEPTANCE_CHECKLIST_v0.1.md`.

Se integra visualmente con:

- `STARTERIA_DESIGN_SYSTEM_CONTRACT_v0.1.md`;
- `STARTERIA_PAGE_ANATOMY_SYSTEM_v0.1.md`;
- `STARTERIA_E2E_VISUAL_EXPERIENCE_ARCHITECTURE_v0.1.md`;
- `STARTERIA_DESIGN_SYSTEM_DS08_ACTIVATION_INVITATION_REPORT.md`;
- `PORTFOLIO_TO_INITIATIVE_HANDOFF_VISUAL_UX_WRITING_CONTRACT_v0.1.md`.

Este contrato gobierna sobre:

- Technical Design del boundary;
- schemas de integración;
- read models de Handoff;
- event adapters;
- tests contractuales de integración;
- wiring Portfolio ↔ downstream.

No redefine Step 0–4 ni Initiative Core.

## 1.1. Enmienda PL-06A — commands y guards de preparación

Esta enmienda conserva `v0.1` y su historial. Añade el contrato de integración anterior a
`Send` para una bandeja incremental de N Assignments por Challenge. No autoriza delivery,
Accept, Reject, Start ni creación de Initiative/Project/Step.

### Read capabilities

```text
listAssignableInitiatives(challengeId)
listHandoffAssignments(challengeId)
getHandoffAssignment(assignmentId)
```

`listAssignableInitiatives` devuelve únicamente Projects canónicos relacionados mediante
`InitiativePortfolioMeta(projectId, challengeId)` y dentro del mismo tenant autorizado. Debe
distinguir, sin convertirlos, los work records importados que carecen de `ProjectId`. Estos
registros pueden aparecer como contexto documental, nunca como targets `EXISTING_INITIATIVE`.

`listHandoffAssignments` devuelve N Assignments y conserva, por fila:

```text
assignment_id
target_kind
challenge_id
initiative_id?
brief_version_id?
recipient_identity
owner + execution team
context_note?
state + version
created_at + updated_at
```

Re-entry se resuelve desde este read model. Ningún consumidor puede seleccionar una sola fila
mediante `find` por BriefVersion o sustituir la identidad solicitada por `latest`.

### Preparation commands

```text
createHandoffAssignment(input, idempotencyKey, fingerprint)
updateCreatedHandoffAssignment(assignmentId, patch, expectedVersion, idempotencyKey, fingerprint)
revokeCreatedHandoffAssignment(assignmentId, expectedVersion, idempotencyKey)
```

`createHandoffAssignment` requiere acción humana explícita y crea solamente estado `CREATED`.
`updateCreatedHandoffAssignment` puede cambiar recipient/Owner, execution team y `context_note`
sin mutar Challenge, Initiative, BriefVersion ni sus fuentes canónicas. Incrementa `version` y
registra actor/canal/timestamp mediante el audit/event boundary. Si el estado ya no es `CREATED`
o `expectedVersion` es stale, falla sin cambios parciales.

`revokeCreatedHandoffAssignment` preserva lineage mediante `REVOKED`; no hace hard-delete. El
nombre concreto de ruta puede variar, pero no se debe reutilizar una operación que presuponga
que ya existió delivery.

### Target guards

Para `EXISTING_INITIATIVE`:

```text
initiative_id required
Project exists
InitiativePortfolioMeta(projectId, challengeId) exists
Project + Challenge + optional BriefVersion belong to same tenant
brief_version_id optional
```

Cuando `brief_version_id` está presente debe ser `CONFIRMED`, pertenecer al mismo Challenge y
tenant y conservarse exactamente. Su presencia no se vuelve requisito universal, conforme a
ADR-008.

Para `CHALLENGE`:

```text
initiative_id = null
brief_version_id required + CONFIRMED
BriefVersion belongs to exact Challenge + tenant
```

### Duplicate guards

La creación se serializa por Challenge y rechaza duplicados no terminales:

- `EXISTING_INITIATIVE`: misma organización + Challenge + Initiative;
- `CHALLENGE`: misma organización + Challenge + BriefVersion + recipient normalizado.

Una resolución humana trazable de la Assignment anterior habilita una creación posterior. La
integración no sobrescribe silenciosamente la fila existente ni el Owner canónico de Project.

### Event delta

`handoff_assignment_created` añade `brief_version_id?` y una referencia/redacción de
`context_note` cuando corresponda. Una actualización material publica
`handoff_assignment_preparation_updated`; la revocación usa el evento canónico existente.
El payload no duplica texto sensible completo cuando basta una referencia o fingerprint.

### PL-06B reservado

La selección y el envío por lote, SMTP y los outcomes `sent/failed/skipped/no action` pertenecen
a KAN-162/KAN-163. No se implementan como un bucle de POST desde PL-06A.

---

# 2. Reconciliación con DS-08

DS-08 se considera evidencia de implementación previa, no autoridad superior al Experience Contract v0.2.

## KEEP

Reutilizar/auditar antes de crear equivalentes:

```text
PageHeader
ContextSummary
AISuggestionPanel
NextAction
EmptyState
DomainStatusBadge
Badge
Button
Progress
```

También se conserva como evidencia útil que:

- activation recommendation ya era presentation-only;
- invitation status era renderizado desde estado suministrado, no inferido;
- no se modificaron permisos, Core ni Steps en DS-08;
- no existía una landing frontend segura de invitation/accept/start en ese slice.

## ADAPT

El handoff legacy:

```text
Challenge
→ /projects/new?challengeId=...
```

no puede permanecer como ruta canónica para `Assigned Challenge`.

Razón:

```text
Assigned Challenge
→ Accept / Start
≠ crear Initiative ficticia o prematura
```

La creación/formulación posterior de Initiative pertenece al workstream downstream.

## KEEP AS LEGACY / AUDIT BEFORE REUSE

La familia:

```text
ChallengeActivationPanel
ChallengeActivationRecommendation
ChallengeActivationModeSelector
ChallengeActivationOwnerStatus
ChallengeActivationMessageDraft
```

puede contener piezas reutilizables, pero no se asume que sea el Handoff Shell activo.

Technical Design debe auditar uso real antes de consolidar o retirar.

---

# 3. Boundaries de ownership

## 3.1 Portfolio / Handoff posee

Dentro de este vertical:

- creación del Handoff Assignment;
- target kind;
- invited identity;
- Initiative Owner propuesto/aceptado;
- proposed execution team;
- invitation lifecycle;
- Accept / Reject;
- rejection reason;
- Portfolio Lead response al rejection;
- Start del assignment;
- audit/versioning del assignment;
- `PortfolioHandoffProjection`.

## 3.2 Initiative Core posee

Después del boundary:

- Initiative lifecycle activo;
- InitiativeCycle;
- StepState 0–4;
- evidence;
- blockers/issues operativos;
- validations;
- decision packages;
- downstream progress semantics;
- resulting Initiative cuando un Assigned Challenge se formule posteriormente.

## 3.3 Portfolio no posee

Portfolio/Handoff no escribe:

- `currentStep`;
- StepState;
- cycle state;
- evidence state;
- blocker resolution state interno;
- validation result interno;
- decision package interno.

Portfolio consume read models/eventos derivados.

---

# 4. Distinción crítica: `Start` de Handoff vs `Initiative Started`

Estas semánticas son distintas.

```text
handoff_assignment_started
!=
initiative_started
```

## `handoff_assignment_started`

Significa:

> El Initiative Owner aceptó el encargo y ejecutó explícitamente `Start / Empezar`; el bounded context de Handoff terminó correctamente.

Puede ocurrir para:

```text
existing_initiative
challenge
```

No garantiza por sí solo:

- que exista un nuevo InitiativeCycle;
- que Step 0 esté activo;
- que exista Initiative en modalidad Assigned Challenge;
- que Initiative Core haya terminado su bootstrap downstream.

## `initiative_started`

Pertenece al downstream.

Significa:

> Initiative Core reconoce una Initiative concreta como iniciada según sus propias reglas canónicas.

Para Assigned Challenge solo puede emitirse cuando exista una Initiative real.

---

# 5. Handoff-owned semantic commands

Technical Design puede mapear nombres concretos distintos, pero debe preservar estas capacidades semánticas:

```text
createHandoffAssignment()
updateCreatedHandoffAssignment(expectedVersion)
revokeCreatedHandoffAssignment(expectedVersion)
sendHandoffInvitation()
acceptHandoffAssignment()
rejectHandoffAssignment(reason)
respondToHandoffRejection()
revokeHandoffAssignment()
startAssignedWork()
```

`expireHandoffAssignment()` puede ser system-driven.

Reglas:

- command != event;
- commands pasan por backend/domain guards;
- mutaciones materiales son idempotentes;
- mutaciones materialmente versionadas soportan expected version o mecanismo equivalente;
- ningún canal tiene bypass propio.

---

# 6. Handoff domain events

Eventos semánticos mínimos:

```text
handoff_assignment_created
handoff_assignment_preparation_updated
handoff_invitation_sent
handoff_invitation_viewed
handoff_assignment_accepted
handoff_assignment_rejected
handoff_rejection_response_recorded
handoff_assignment_revoked
handoff_assignment_expired
handoff_assignment_started
```

Eventos opcionales de auditoría que no forman parte del lifecycle principal:

```text
handoff_identity_verified
handoff_identity_mismatch_detected
handoff_invitation_delivery_failed
handoff_invitation_delivery_retried
```

Regla:

> Auth/identity verification puede producir audit events, pero no introduce estados de negocio artificiales como `auth_pending` dentro del lifecycle del assignment.

---

# 7. Event envelope común

Todo evento material debe ser compatible con el envelope de gobernanza existente.

Base:

```text
event_id
event_type
entity_type
entity_id
entity_version
actor_id?
actor_role?
interaction_channel
organization_id?
portfolio_scope_ref?
challenge_id?
initiative_id?
cycle_id?
step_number?
before_ref?
after_ref?
source_refs[]
occurred_at
recorded_at
```

Extensión de correlación para este boundary:

```text
origin_assignment_id?
correlation_id?
causation_event_id?
```

Reglas:

- para eventos de Handoff, `entity_type = handoff_assignment` y `entity_id = assignment_id`;
- downstream puede incluir `origin_assignment_id` para conservar lineage;
- `interaction_channel` describe el canal, no la autoridad;
- `entity_version` permite detectar eventos stale/out-of-order;
- consumers deben tolerar entrega duplicada sin duplicar estado material.

Canales candidatos:

```text
web
starteria_copilot
external_assistant
api
import
connector
system
```

---

# 8. Payload mínimo de eventos Handoff

## 8.1 `handoff_assignment_created`

```text
assignment_id
target_kind
challenge_id
initiative_id?          // solo existing_initiative
invited_identity
initiative_owner_ref?   // si ya existe user
proposed_execution_team[]
inviter_ref
```

## 8.2 `handoff_invitation_sent`

```text
assignment_id
recipient_identity
delivery_ref?
```

No transportar información sensible innecesaria.

## 8.3 `handoff_assignment_accepted`

```text
assignment_id
accepted_by
accepted_at
```

No incluir ni inferir:

```text
step = 0
cycle_started = true
initiative_created = true
```

## 8.4 `handoff_assignment_rejected`

```text
assignment_id
rejected_by
rejection_reason
rejected_at
```

## 8.5 `handoff_rejection_response_recorded`

```text
assignment_id
portfolio_actor_ref
response
recorded_at
```

No cambia ownership ni assignment state automáticamente.

## 8.6 `handoff_assignment_started`

```text
assignment_id
target_kind
challenge_id
initiative_id?          // puede ser null para Assigned Challenge
started_by
started_at
```

Es el último evento owned por este vertical.

---

# 9. PortfolioHandoffProjection

Definir un read model derivado y read-only para representar handoffs antes de que necesariamente exista una Initiative.

Conceptualmente:

```text
PortfolioHandoffProjection
├── assignment_id
├── organization_id?
├── portfolio_scope_ref?
├── strategic_front_ref?
├── challenge_ref
├── challenge_version_ref?
├── target_kind
│   ├── existing_initiative
│   └── challenge
├── initiative_ref?
├── invited_identity
├── initiative_owner_ref?
├── execution_team[]
├── observers[]
├── inviter_ref
├── handoff_state
├── accepted_at?
├── rejected_at?
├── rejection_reason?
├── portfolio_response?
├── started_at?
├── resulting_initiative_ref?   // downstream correlation; optional
├── last_material_event
├── source_event_refs[]
├── projection_version
└── generated_at
```

Regla:

```text
PortfolioHandoffProjection != source of truth
```

No se utiliza para mutar lifecycle.

---

# 10. Relación con PortfolioInitiativeProjection

## Assigned Initiative

Puede coexistir:

```text
PortfolioHandoffProjection
→ referencia Initiative existente
→ PortfolioInitiativeProjection existente
```

El Handoff Projection gobierna lectura del traspaso.

La Initiative Projection gobierna lectura de la Initiative.

No duplicar lifecycle entre ambas.

## Assigned Challenge antes de Initiative

Existe:

```text
PortfolioHandoffProjection
```

No debe fabricarse:

```text
PortfolioInitiativeProjection
```

## Assigned Challenge después de formulación downstream

Cuando downstream crea/formula una Initiative real:

```text
assignment_id
→ resulting initiative_id
```

Entonces puede existir:

```text
PortfolioInitiativeProjection
```

mientras el Handoff Projection conserva historial/audit del assignment.

---

# 11. Correlation contract para Assigned Challenge

El workstream downstream debe poder informar que una Initiative real deriva de un Challenge Assignment previo.

Evento candidato:

```text
initiative_linked_to_handoff_assignment
```

Payload mínimo:

```text
origin_assignment_id
challenge_id
initiative_id
linked_at
```

Este evento:

- no significa `initiative_started`;
- no significa Step 0 activo;
- no modifica retroactivamente el meaning del Accept/Start anterior;
- permite a Portfolio reconstruir lineage.

Si Technical Design decide persistir la correlación dentro de Initiative metadata en lugar de un objeto independiente, debe conservar la misma semántica observable.

---

# 12. Downstream event vocabulary consumible por Portfolio

El downstream debe poder publicar, como mínimo:

```text
initiative_started
step_entered
step_completed
blocker_raised
blocker_resolved
support_requested
decision_requested
relevant_progress_recorded
```

Este contrato define integración, no la lógica que produce esos eventos.

---

# 13. Payload mínimo downstream

## 13.1 `initiative_started`

```text
initiative_id
origin_assignment_id?
challenge_id?
cycle_id?
started_at
```

Regla:

> `origin_assignment_id` debe estar disponible cuando la Initiative nació o fue activada desde este Handoff.

## 13.2 `step_entered`

```text
initiative_id
cycle_id
step_number
entered_at
```

Portfolio puede proyectar el Step actual desde eventos/estado canónico.

Portfolio no mantiene `currentStep` manual independiente.

## 13.3 `step_completed`

```text
initiative_id
cycle_id
step_number
completed_at
completion_ref?
```

No obliga a Portfolio a interpretar artefactos internos del Step.

## 13.4 `blocker_raised`

```text
blocker_id
initiative_id
cycle_id?
summary
severity?
operational_owner?
support_or_decision_required?
opened_at
```

## 13.5 `blocker_resolved`

```text
blocker_id
initiative_id
resolved_at
resolution_ref?
```

## 13.6 `support_requested`

```text
request_id
initiative_id
summary
request_type?
requested_from_role?
requested_at
```

No requiere construir un ServiceNow/Jira-like workflow dentro de Handoff.

## 13.7 `decision_requested`

```text
decision_request_id
initiative_id
summary
decision_type?
requested_from_role?
due_at?
requested_at
```

No implica que Portfolio Lead sea automáticamente Decision Authority.

## 13.8 `relevant_progress_recorded`

```text
initiative_id
progress_type
summary
source_refs[]
recorded_at
```

Usar solo para progreso material que no esté mejor representado por un evento específico.

No emitir por:

- page view;
- tab click;
- scroll;
- formulario parcialmente visitado;
- actividad puramente cosmética.

---

# 14. Ordering, versioning e idempotency

## 14.1 Duplicates

Consumers deben poder recibir el mismo `event_id` más de una vez sin duplicar efectos.

## 14.2 Ordering

No asumir que todos los eventos llegan estrictamente en orden de red.

Usar:

```text
entity_version
occurred_at
```

para reconciliar estado.

## 14.3 Stale updates

Una proyección no debe retroceder silenciosamente por un evento con versión anterior.

## 14.4 Mutations

Commands materiales deben soportar:

```text
expected_version
```

o mecanismo equivalente de optimistic concurrency cuando aplique.

---

# 15. Delivery mechanism — no overengineering P0

Este contrato no obliga a implementar un event bus completo.

Implementaciones P0 válidas pueden incluir:

```text
Domain service
→ DB transaction
→ persisted domain event / outbox-like record
→ projection update
```

O una variante equivalente que preserve:

- semántica;
- auditabilidad;
- idempotencia;
- versioning;
- posibilidad de desacoplar consumers después.

No crear infraestructura distribuida compleja únicamente para cumplir naming contractual.

---

# 16. Channel independence

Todos los canales utilizan los mismos application/domain services.

```text
Web
Starteria Copilot
External Assistant
API
Connector
        ↓
same commands / guards
        ↓
canonical state + events
```

Reglas:

- external assistant no obtiene autoridad propia;
- actor/role determina permisos;
- channel solo queda como metadata/audit;
- ningún canal puede saltar identity matching de invitation;
- Accept/Reject/Start tienen la misma semántica en cualquier canal autorizado.

---

# 17. Permissions boundary

El contrato de integración presupone guards backend/domain-driven.

Mínimos:

```text
create assignment
→ actor con permiso Portfolio correspondiente

accept/reject
→ invited identity verificada + assignment vigente

respond to rejection
→ Portfolio actor autorizado

start
→ accepted Initiative Owner autorizado + assignment vigente
```

El frontend nunca es autoridad suficiente para estas transiciones.

---

# 18. Projection update rules

## Handoff events

Actualizan `PortfolioHandoffProjection`.

## Downstream Initiative events

Actualizan `PortfolioInitiativeProjection` y/o Attention read models según corresponda.

## Correlation event

Actualiza linkage:

```text
assignment_id
→ resulting_initiative_ref
```

sin convertir el Handoff Projection en Initiative source of truth.

---

# 19. Attention boundary

Eventos downstream pueden producir/actualizar Portfolio Attention cuando exista una situación material.

Ejemplos:

```text
blocker_raised
support_requested
decision_requested
```

No crear atención por:

- una página no visitada;
- falta de click;
- formulario incompleto sin significado de dominio;
- ausencia de actividad UI sin regla material.

Attention continúa siendo event/state-driven.

---

# 20. Failure / retry semantics

## Invitation delivery failure

```text
assignment state
!= automáticamente rejected/expired
```

Debe registrarse fallo de entrega y permitir retry según política.

## Accept/Reject retry

No duplica transición.

## Start retry

No duplica:

```text
handoff_assignment_started
```

ni inicia múltiples downstream handoffs.

## Downstream unavailable after Start

`Start` debe distinguir, en Technical Design, entre:

- transición canónica de assignment;
- delivery/dispatch hacia downstream.

No se permite fingir éxito downstream si no ocurrió.

La estrategia exacta de transaction/outbox/retry pertenece al Technical Design.

---

# 21. Observability mínima

Debe ser posible reconstruir:

```text
quién
hizo qué
sobre qué assignment
con qué rol
por qué canal
qué versión cambió
qué evento resultó
cuándo ocurrió
```

Y para Assigned Challenge:

```text
qué assignment
originó qué Initiative
```

cuando la Initiative exista.

---

# 22. No-regression rules

La integración no puede:

1. crear Initiative por enviar Invitation;
2. crear Initiative por Accept de Assigned Challenge;
3. activar Step 0 por Accept;
4. afirmar `initiative_started` solo porque se pulsó Start en Handoff;
5. mantener lifecycle privado por canal;
6. hacer Portfolio dependiente de pathname/DOM/component state;
7. convertir `PortfolioHandoffProjection` en source of truth;
8. duplicar Initiative lifecycle dentro de Portfolio;
9. convertir observers en execution team para satisfacer schema;
10. cambiar ownership por responder a un rejection;
11. tratar Sponsor como Decision Authority universal;
12. modificar Step 0–4 desde este workstream.

---

# 23. ADR triggers

Detener Technical Design y marcar `ADR REQUIRED` si se propone:

- cambiar Invariantes Core;
- redefinir cardinalidad Challenge ↔ Initiative;
- hacer que Challenge Assignment sea una Initiative canónica;
- crear un nuevo aggregate `Initiative` separado de `Project` por naming;
- ampliar autoridad de IA;
- modificar autoridad humana;
- modificar Step lifecycle/gating;
- convertir eventos AI-inferred en estado confirmado automáticamente;
- introducir una migración material de dominio que cambie identidad canónica.

No requiere ADR por defecto:

- añadir read model derivado;
- añadir event metadata;
- crear adapter de integración;
- añadir correlation id/origin assignment ref;
- implementar idempotency/version guards;
- sustituir el CTA legacy `/projects/new?challengeId=...` por el Handoff boundary definido, siempre que no cambie Core.

---

# 24. Acceptance mapping

Este contrato implementa principalmente:

```text
BR-HO-043 — Portfolio has handoff projection
BR-HO-044 — Projection is not source of truth
BR-HO-045 — Minimum projection
BR-HO-046 — Portfolio consumes semantic events
BR-HO-047 — Downstream event vocabulary
BR-HO-048 — Challenge Assignment correlation
BR-HO-049 — Same lifecycle across channels
BR-HO-050 — Authority belongs to actor/role
```

Y debe permitir verificar:

```text
AC-HO-054
AC-HO-055
AC-HO-056
AC-HO-057
AC-HO-058
AC-HO-059
AC-HO-060
AC-HO-061
AC-HO-062
AC-HO-063
AC-HO-064
AC-HO-065
AC-HO-066
```

---

# 25. Contract test scenarios

## INT-HO-001 — Challenge assignment before Initiative

```text
Given Assigned Challenge accepted
And user presses Start
When Handoff completes
Then handoff_assignment_started exists
And initiative_id may be null
And initiative_started has NOT been inferred
```

## INT-HO-002 — Existing Initiative assignment

```text
Given Assigned Initiative accepted
When user presses Start
Then handoff_assignment_started references existing initiative_id
And no duplicate Initiative is created
```

## INT-HO-003 — Resulting Initiative correlation

```text
Given a started Challenge Assignment
When downstream later formulates a real Initiative
Then origin_assignment_id can be correlated to initiative_id
And Portfolio can traverse Assignment → Initiative
```

## INT-HO-004 — Step projection without UI coupling

```text
Given downstream emits step_entered
When Portfolio projection refreshes
Then current step can be derived
And no pathname/DOM/component state is read
```

## INT-HO-005 — Duplicate event

```text
Given an event_id already consumed
When the same event arrives again
Then no duplicate material projection effect occurs
```

## INT-HO-006 — Channel independence

```text
Given the same authorized actor
When Accept is invoked via Web or another authorized channel
Then guards and state transition semantics are the same
And interaction_channel differs only as audit metadata
```

## INT-HO-007 — Rejection response safety

```text
Given assignment rejected
When Portfolio Lead records a response
Then rejection history remains
And Initiative Owner does not change
And assignment does not become accepted
```

## INT-HO-008 — Multiple preparation and re-entry

```text
Given a Challenge with several saved Assignments
When Portfolio Lead re-enters PL-06A
Then every Assignment is returned with its exact target, BriefVersion and version
And no Assignment or Invitation is created by the read
```

## INT-HO-009 — Existing Initiative canonical identity

```text
Given a work record without canonical ProjectId
When assignable initiatives are listed
Then the record is not selectable as EXISTING_INITIATIVE
And no Project or InitiativePortfolioMeta is fabricated
```

## INT-HO-010 — Existing Initiative optional Brief

```text
Given a canonical Initiative linked to the Challenge
When an Assignment is created from PL-05 with a confirmed BriefVersion
Then the exact optional brief_version_id is retained
And the Initiative identity and canonical context remain authoritative
```

## INT-HO-011 — CREATED-only edit

```text
Given a CREATED Assignment at version N
When an authorized actor updates owner, team or context with expectedVersion N
Then version becomes N+1 and audit provenance is recorded
And BriefVersion and target identity do not change
But a stale version or non-CREATED state changes nothing
```

## INT-HO-012 — Duplicate guard

```text
Given a non-terminal Assignment with the same target duplicate key
When create is requested again with a different command key
Then the command conflicts without creating another Assignment
But an idempotent retry with the same key and fingerprint returns the original result
```

---

# 26. Definition of Done — Integration Contract

Este contrato puede pasar a `FROZEN FOR TECHNICAL DESIGN` cuando:

- [ ] Experience Contract v0.2 está aceptado como baseline;
- [ ] `handoff_assignment_started != initiative_started` está aceptado;
- [ ] `PortfolioHandoffProjection` se acepta como read model separado cuando no exista Initiative;
- [ ] correlation `assignment_id → resulting initiative_id` está aceptada;
- [ ] downstream event vocabulary es suficiente para Portfolio;
- [ ] no existe dependencia de DOM/rutas/componentes de Steps;
- [ ] channel independence queda preservada;
- [ ] DS-08 legacy handoff `/projects/new?challengeId=...` queda clasificado como ADAPT/legacy, no ruta canónica;
- [ ] no existe ADR blocker abierto;
- [ ] Technical Design puede decidir storage, API, outbox/projection mechanism sin reinterpretar producto.

---

# 27. Siguiente artefacto

Después del freeze de este contrato:

```text
PORTFOLIO_TO_INITIATIVE_HANDOFF_TECHNICAL_DESIGN_v0.1.md
```

debe auditar el repo y traducir estas semánticas a:

- modelos existentes;
- services/commands;
- routes/API;
- auth claim continuation;
- projection implementation;
- event persistence/dispatch;
- migration strategy si aplica;
- technical slices Jira;
- unit/integration/E2E tests.

Technical Design no puede utilizar este contrato como autorización para crear nuevas entidades sin auditar primero los modelos existentes.

---

# 28. Regla final

> Handoff transfiere responsabilidad. Initiative Core desarrolla trabajo. Portfolio observa estado gobernado. La integración entre ambos se hace mediante contracts, events y projections, nunca mediante acoplamiento a UI.
