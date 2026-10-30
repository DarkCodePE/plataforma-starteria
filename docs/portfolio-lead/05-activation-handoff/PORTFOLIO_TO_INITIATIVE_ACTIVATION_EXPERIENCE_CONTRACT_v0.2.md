# STARTERIA — PORTFOLIO → INITIATIVE OWNER HANDOFF EXPERIENCE CONTRACT v0.2

**Estado:** ACTIVE / FROZEN FOR IMPLEMENTATION PLANNING  
**Versión:** v0.2  
**Fecha:** 2026-09-28  
**Enmienda acotada:** 2026-10-22 — PL-06A / KAN-160 comentarios 10428 y 10430  
**Vertical:** Portfolio Lead → Initiative Owner Handoff  
**Scope:** Portfolio Lead Assignment → Email → Invitation Landing → Accept / Reject → Activation Overview → Start  
**Hard boundary:** `Start / Empezar`  
**Fuera de alcance:** cualquier experiencia, lógica o UI posterior a `Start`; Step 0–4; lógica interna de Initiative Core; diseño de experimentación; gating posterior; outputs posteriores de Steps.

---

## 0. Autoridad y propósito

Este documento actualiza y reemplaza, para este vertical, la semántica de experiencia definida en:

- `PORTFOLIO_TO_INITIATIVE_ACTIVATION_EXPERIENCE_CONTRACT_v0.1.md`.

Se encuentra subordinado a:

1. `STARTERIA_CORE_LOGIC_CONTRACT.md`;
2. ADRs aprobados;
3. contratos de gobernanza transversales aplicables.

Y gobierna, para este vertical, sobre:

- Delivery Translation;
- HUs / Business Rules / Acceptance Criteria;
- Experience Design Translation;
- Tech Specs;
- schemas / tests;
- frontend / backend de este bounded context.

Principio:

> El handoff debe transferir responsabilidad y contexto sin activar silenciosamente la ejecución ni fabricar una Initiative para soportar la experiencia.

---

## 0.1. Cambios materiales desde v0.1

### CHANGE-01 — Challenge Assignment no crea Initiative al aceptar

Se elimina la regla anterior:

```text
Challenge
→ Accept
→ create Initiative pre_start
```

La nueva regla es:

```text
Challenge
→ Challenge Assignment
→ Accept
→ Accepted Challenge Assignment
→ Activation Overview
→ Start
→ HARD BOUNDARY
```

La formulación/creación posterior de una Initiative pertenece a otro workstream.

### CHANGE-02 — `pre_start` deja de ser requisito universal del handoff

`pre_start` puede seguir existiendo en otros contextos del producto si corresponde, pero este contrato **no lo utiliza para fabricar una Initiative en Assigned Challenge**.

### CHANGE-03 — Start deja de asumir que siempre existe una Initiative

El comando semántico de este bounded context se expresa conceptualmente como:

```text
startAssignedWork(assignmentId, expectedVersion)
```

No como un `startInitiative()` universal.

### CHANGE-04 — Handoff Shell

Invitation Landing, post-Accept Overview y pre-Start Overview deben compartir una misma gramática visual y estructural.

### CHANGE-05 — Reject endurecido

Reject requiere justificación. Portfolio Lead puede ver y responder al rechazo, pero responder no modifica ownership ni reactiva silenciosamente el assignment.

### CHANGE-06 — hard boundary real

Este contrato termina al registrarse exitosamente `Start`. No define la pantalla, Step, ruta ni comportamiento posterior.

## 0.2. Enmienda PL-06A — preparación múltiple e incremental

Esta enmienda conserva la versión `v0.2` y el historial anterior. No sustituye las
modalidades, lifecycle o hard boundary ya definidos; cierra la semántica de preparación
anterior a `Send` autorizada por KAN-160 comentarios 10428 y 10430.

### Cardinalidad y cobertura

```text
Challenge 1 → 0..N Handoff Assignments
Handoff Assignment 1 → exactamente 1 target
```

Cada Assignment representa un encargo independiente. Portfolio Lead puede preparar una,
varias o ninguna Assignment en una sesión, dejar Initiatives sin asignar y reanudar más
tarde. La cobertura parcial no es error y no crea estados sintéticos sobre las Initiatives.

### Bandeja de preparación

PL-06A presenta una bandeja por Challenge con:

- `Agregar asignación` como acción explícita;
- modalidad `EXISTING_INITIATIVE` o `CHALLENGE`;
- exactamente un Initiative Owner y hasta dos ejecutores adicionales por Assignment;
- contexto editable propio del encargo, separado del Brief y de la Initiative;
- Guardar, editar, retirar preparación y revisar varias Assignments;
- re-entry que recupera todas las Assignments por su identidad, no una sola por
  `briefVersionId` ni la versión más reciente del Challenge.

Abrir la bandeja, agregar una tarjeta provisional o revisar no persiste por sí solo. Guardar
crea una `PortfolioHandoffAssignment` en el estado canónico existente `CREATED`. No se añade
un estado `DRAFT` de Assignment. Guardar nunca ejecuta `Send` ni crea Invitation, Initiative,
Project o Step.

### Edición y retirada en `CREATED`

Owner, execution team y contexto propio del encargo solo pueden modificarse mientras la
Assignment permanece `CREATED`. Toda actualización requiere `expectedVersion`, incrementa
la versión y conserva actor, timestamp y provenance/audit. El contexto editable no muta ni
reescribe el Brief confirmado o el contexto canónico de una Initiative existente.

Retirar una preparación persistida no hace hard-delete: usa la transición trazable a
`REVOKED`. Una Assignment `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `REVOKED` o
`STARTED` no se edita desde PL-06A.

### Modalidad `EXISTING_INITIATIVE`

Solo es seleccionable una identidad canónica que cumpla simultáneamente:

```text
Project existente
+ InitiativePortfolioMeta(projectId, challengeId)
+ mismo tenant autorizado
```

Un registro importado, mención documental o work record sin `ProjectId` no es una Initiative
canónica, no aparece como target seleccionable y no se materializa como Project como efecto
de Agregar, Guardar o re-entry. Su conversión o vinculación requiere una acción humana
gobernada en otro boundary.

Cuando PL-06A se abre desde PL-05, una Existing Initiative puede asociar opcionalmente la
`briefVersionId` confirmada exacta del mismo Challenge y tenant. Si existe la referencia, es
inmutable para esa Assignment. Fuera de esa ruta, `briefVersionId` puede ser `null`, conforme
a la excepción de ADR-008. El Brief aporta contexto de encargo y nunca reemplaza la identidad,
historia, fuentes o estado canónico de la Initiative.

### Modalidad `CHALLENGE`

Requiere la `briefVersionId` confirmada exacta. `initiativeId` permanece `null`. Distintos
destinatarios pueden recibir Assignments independientes para proponer una Initiative más
tarde; Create, Save, Send, Accept o Start no fabrican Initiative ni Step.

### Duplicados y resolución humana

- `EXISTING_INITIATIVE`: no puede coexistir más de una Assignment no terminal para el mismo
  `organizationId + challengeId + initiativeId`. Una nueva asignación requiere resolver de
  forma humana y trazable la anterior según el lifecycle vigente.
- `CHALLENGE`: no puede coexistir más de una Assignment no terminal para
  `organizationId + challengeId + briefVersionId + recipientIdentityNormalized`. Distintos
  destinatarios continúan permitidos.
- Un retry con la misma idempotency key y fingerprint devuelve el resultado original; la
  misma key con payload distinto produce conflicto.

Estas reglas son guards de aplicación/transacción sobre el aggregate existente; no autorizan
un segundo modelo de Assignment ni una cardinalidad nueva de Core.

### Boundary con PL-06B

`Revisar invitaciones` puede presentar una selección, pero `Send`, delivery por lote, SMTP y
Overview de estados pertenecen exclusivamente a PL-06B (KAN-162/KAN-163). PL-06A termina con
Assignments guardadas/revisables en `CREATED`.

---

# 1. Business Need

Portfolio Lead necesita transferir un trabajo estratégico a una persona responsable de ejecutarlo sin perder:

- trazabilidad con el Challenge;
- claridad de ownership;
- contexto suficiente para que la persona decida si acepta;
- visibilidad del estado del handoff;
- separación entre aceptar responsabilidad e iniciar ejecución;
- capacidad de continuar el seguimiento desde Portfolio sin depender de la UI interna de Steps.

Initiative Owner necesita poder responder, con mínima fricción:

```text
¿Qué recibí?
¿Por qué importa?
¿Qué esperan de mí?
¿Con qué marco cuento?
¿Quién me ayuda?
¿Qué hago ahora?
```

---

# 2. Bounded context

El bounded context comienza cuando Portfolio Lead confirma una asignación válida.

```text
Portfolio Lead Assignment
→ Email
→ Invitation Landing
→ Authentication / Identity Validation cuando corresponda
→ Accept | Reject
→ Portfolio Lead status update
→ Activation Overview
→ Start
================ HARD BOUNDARY ================
```

No se diseña ni implementa en este contrato:

- qué ocurre visualmente después de `Start`;
- cómo se formula una Initiative desde un Challenge Assignment;
- cómo se entra a Step 0;
- Step 0–4;
- Adaptive Cycle;
- evidencia, gates o outputs posteriores.

---

# 3. Principios no negociables

## HC-PR-01 — Assign ≠ Accept ≠ Start

```text
ASSIGN ≠ ACCEPT ≠ START
```

Cada evento expresa una decisión humana distinta.

## HC-PR-02 — Invitation ≠ Assignment target

Una Invitation comunica un Assignment.

No es:

- Challenge;
- Initiative;
- prueba de aceptación;
- prueba de inicio.

## HC-PR-03 — Accept no inicia ejecución

Accept expresa:

> “Acepto asumir la responsabilidad propuesta en este encargo.”

No abre Steps ni registra trabajo como iniciado.

## HC-PR-04 — Assigned Challenge no fabrica Initiative

Un Challenge Assignment puede existir, aceptarse e iniciarse como handoff sin que exista todavía una Initiative.

## HC-PR-05 — Portfolio no escribe StepState

Portfolio consume estado/eventos posteriores. No controla DOM, rutas, componentes o StepState interno.

## HC-PR-06 — mismo lifecycle en todos los canales

Web, Copilot, API o futuros adapters deben operar sobre los mismos commands, permisos y estado persistido.

---

# 4. Modalidades canónicas

## 4.1. Modalidad A — Assigned Initiative

Portfolio Lead asigna una Initiative existente vinculada a un Challenge.

```text
Existing Initiative
      ↓
Portfolio Lead Assignment
      ↓
Invitation
      ↓
Accept / Reject
      ↓
Accepted Assignment
      ↓
Activation Overview
      ↓
Start
      ↓
================ HARD BOUNDARY ================
```

Reglas:

- la Initiative ya existe;
- el assignment debe referenciarla;
- Accept no duplica Initiative;
- Accept no abre Steps;
- ownership solo se considera aceptado después de la acción explícita del invitado;
- Start es la frontera con el workstream posterior.

---

## 4.2. Modalidad B — Assigned Challenge

Portfolio Lead asigna un Challenge a una persona para que posteriormente formule una Initiative.

```text
Challenge
   ↓
Portfolio Lead Assignment
   ↓
Invitation
   ↓
Accept / Reject
   ↓
Accepted Challenge Assignment
   ↓
Activation Overview
   ↓
Start
   ↓
================ HARD BOUNDARY ================
```

Reglas:

- no existe obligación de que haya Initiative al asignar;
- no se crea Initiative al enviar la invitación;
- no se crea Initiative al abrirla;
- no se crea Initiative al aceptar;
- este contrato tampoco exige crearla en `Start`;
- la formulación/materialización de la Initiative pertenece al workstream posterior;
- mientras no exista Initiative, Portfolio no debe contar este assignment como Initiative activa.

---

# 5. Concepto semántico de Assignment

Este contrato utiliza `Handoff Assignment` como concepto de dominio de experiencia.

**No autoriza por sí solo crear una nueva tabla o aggregate canónico.** Technical Design debe primero evaluar si puede mapearse/adaptarse sobre modelos existentes.

Estructura conceptual mínima:

```text
HandoffAssignment
├── assignment_id
├── target_kind
│   ├── existing_initiative
│   └── challenge
├── challenge_ref
├── initiative_ref?             // solo Assigned Initiative
├── initiative_owner_identity
├── proposed_execution_team[]
├── observers[]
├── inviter_ref
├── assignment_state
├── accepted_at?
├── rejected_at?
├── rejection_reason?
├── portfolio_response?
├── started_at?
├── version
└── audit/event refs
```

Regla:

```text
HandoffAssignment ≠ Challenge ≠ Initiative
```

---

# 6. Team policy — MVP

## 6.1. Initiative Owner obligatorio

Todo assignment debe identificar exactamente un:

```text
Initiative Owner
```

No puede enviarse una asignación ambigua a un grupo sin owner explícito.

## 6.2. Execution team

```text
1 Initiative Owner
+ 0–2 integrantes adicionales
= máximo 3 personas ejecutoras
```

## 6.3. Observers

Otros usuarios pueden observar según permisos.

Los observers:

- no cuentan dentro del límite de 3;
- no reemplazan al Initiative Owner;
- no obtienen permisos de ejecución por estar visibles en el assignment.

## 6.4. Portfolio Lead y equipo

Portfolio Lead puede proponer/asignar inicialmente:

- Initiative Owner;
- hasta 2 integrantes adicionales.

Siempre debe identificar explícitamente al Initiative Owner.

La capacidad futura del owner para modificar/invitar miembros debe gobernarse por permisos/configuración; no altera el límite MVP de ejecución.

---

# 7. Invitation semantics

Una Invitation comunica:

> “Starteria te está mostrando un encargo que Portfolio Lead propone que asumas.”

Debe preservar como mínimo:

- invited identity / recipient;
- inviter;
- assignment id;
- target kind;
- Challenge reference;
- Initiative reference cuando aplique;
- proposed Initiative Owner role;
- proposed team cuando aplique;
- state;
- timestamps;
- expiration/revocation cuando aplique.

La Invitation no prueba que el usuario haya aceptado.

---

# 8. Invitation lifecycle

Lifecycle conceptual mínimo:

```text
created
→ sent
→ viewed
→ accepted
→ started
```

Rutas alternativas:

```text
viewed / sent
→ rejected

created / sent / viewed
→ revoked

created / sent / viewed
→ expired
```

Reglas:

- `started` solo puede derivar de `accepted`;
- `rejected` no puede convertirse silenciosamente en `accepted`;
- `revoked` o `expired` no pueden aceptarse sin una nueva decisión válida;
- reintentos técnicos no deben duplicar el assignment ni sus transiciones.

---

# 9. Email-first invitation

## 9.1. Persona con cuenta Starteria

```text
Assignment
→ Email / notification
→ Open invitation
→ authenticated invitation
```

## 9.2. Persona sin cuenta Starteria

```text
Assignment
→ Email
→ Open invitation
→ authenticate / register
→ validate invited identity
→ return to same invitation
```

Reglas:

- una persona puede recibir el email sin cuenta existente;
- abrir el enlace no requiere haber aceptado;
- Accept/Reject requiere autenticación;
- el contexto del assignment debe sobrevivir registro/login;
- después del registro/login debe volver a la misma invitación;
- el sistema debe validar que la identidad autenticada corresponde a la identidad invitada;
- si no coincide, las acciones materiales permanecen bloqueadas;
- el sistema no reasigna la invitación automáticamente a la cuenta incorrecta.

---

# 10. Response semantics

## 10.1. Accept

`Accept` significa:

> “Acepto asumir este encargo en el rol de Initiative Owner.”

Debe ser:

- explícito;
- autenticado;
- permission/identity checked;
- idempotente;
- auditable;
- version-aware cuando corresponda.

### Assigned Initiative

Al aceptar:

- se registra la aceptación del ownership propuesto;
- no se crea otra Initiative;
- no se activa Step/Cycle;
- se preserva Challenge/Portfolio lineage.

### Assigned Challenge

Al aceptar:

- se registra la aceptación del Challenge Assignment;
- no se crea Initiative;
- no se activa Step/Cycle;
- se preserva Challenge/Portfolio lineage.

---

## 10.2. Reject

`Reject` significa:

> “No acepto asumir este encargo en las condiciones actuales.”

Reglas:

- requiere justificación obligatoria;
- la razón se registra y se proyecta a Portfolio Lead;
- el rejection es auditable;
- Portfolio Lead puede responder al rechazo;
- la respuesta del Portfolio Lead no cambia ownership automáticamente;
- la respuesta no convierte el assignment en accepted;
- cualquier nueva asignación, cambio de owner o reintento debe ser una acción explícita y trazable.

---

# 11. Portfolio Lead status update

Portfolio Lead debe poder distinguir como mínimo:

```text
invited
viewed
accepted
rejected
started
expired
revoked
```

Debe poder conocer:

- Challenge;
- assignment type;
- Initiative cuando aplique;
- Initiative Owner propuesto/aceptado;
- execution team;
- handoff state;
- accepted/rejected;
- rejection reason;
- Portfolio response al rechazo cuando exista;
- started;
- last material event / timestamp.

Una invitación pendiente no cuenta como Initiative activa.

Un Challenge Assignment aceptado tampoco cuenta como Initiative mientras no exista una Initiative real.

---

# 12. Activation Overview

Después de Accept, la experiencia evoluciona a un Overview de activación dentro del mismo Handoff Shell.

Su pregunta cognitiva principal es:

> **¿Entiendo lo necesario para empezar?**

Debe responder progresivamente:

1. qué recibí;
2. por qué importa;
3. qué esperan de mí;
4. con qué marco cuento;
5. quién me ayuda;
6. qué hago ahora.

## 12.1. Assigned Initiative

Puede mostrar, cuando exista en fuente canónica:

- Initiative identity;
- Challenge / strategic context;
- expected outcome / contribution;
- known constraints/horizon;
- inherited context/evidence summary;
- Initiative Owner + execution team;
- Portfolio Lead / relevant support context;
- qué ocurrirá al pulsar Start, descrito sin diseñar Steps.

## 12.2. Assigned Challenge

Puede mostrar:

- Challenge identity;
- strategic context;
- expected challenge outcome;
- constraints/horizon;
- contexto conocido;
- Initiative Owner + execution team;
- Portfolio Lead / relevant support context;
- que la Initiative se formulará posteriormente, sin presentarla como ya existente.

No debe mostrar una Initiative ficticia, nombre inventado, estado Step o progreso falso.

---

# 13. Start semantics

`Start` es una acción explícita posterior a Accept.

Conceptualmente:

```text
startAssignedWork(assignmentId, expectedVersion)
```

Debe ser:

- permission-checked;
- identity/role checked;
- idempotente;
- auditable;
- channel-independent;
- seguro ante double-click / retry;
- version-aware;
- válido solo para un assignment accepted y no revoked/expired.

## 13.1. Assigned Initiative

`Start` registra que el Initiative Owner comienza el trabajo asignado sobre la Initiative existente y entrega control al siguiente bounded context.

Este contrato **no define** qué ruta, Step, Cycle o pantalla se abre después.

## 13.2. Assigned Challenge

`Start` registra que el Initiative Owner comienza el trabajo sobre el Challenge Assignment y entrega control al siguiente bounded context.

No presupone que ya exista una Initiative.

## 13.3. Hard boundary

Tras `Start` exitoso:

```text
STOP
```

Este workstream no diseña ni implementa el comportamiento posterior.

---

# 14. Handoff Shell — regla visual

Invitation Landing, post-Accept Overview y pre-Start Overview reutilizan una misma estructura visual.

```text
HandoffShell
├── Starteria / simple header
├── context label
├── assignment identity / title
├── supporting context
├── why it matters
├── what is expected
├── relevant framework/context
├── team / support
├── progressive disclosure
└── action area
```

Reglas:

- no crear un layout independiente por estado;
- cambiar contenido/CTA sin romper la gramática;
- default `comfortable` density;
- no sidebar operacional obligatoria;
- no dashboard overload;
- no nested-card proliferation;
- accesibilidad y responsive heredados del Design System.

Antes de crear nuevos componentes se deben auditar primitives/patterns existentes.

---

# 15. UX Writing contract

El lenguaje debe ser:

- claro;
- conciso;
- cordial;
- humano;
- específico;
- orientado a acción;
- calmado;
- no burocrático;
- no artificialmente motivacional.

Evitar:

- “¡Felicidades!” sin valor informativo;
- innovación-jargon innecesario;
- copy legalista cuando no es requerido;
- estados internos/enums como texto principal;
- promesas que Starteria no puede sostener.

---

# 16. Pregunta cognitiva por momento

## Email

```text
¿Quiero saber más?
```

El email debe comunicar suficiente contexto para motivar la revisión, no para ejecutar la aceptación.

CTA primario conceptual:

```text
Revisar asignación
```

## Invitation

```text
¿Quiero asumir este encargo?
```

CTA primario conceptual:

```text
Aceptar
```

Reject permanece disponible como acción secundaria.

## Activation Overview

```text
¿Entiendo lo necesario para empezar?
```

CTA primario conceptual:

```text
Empezar
```

Regla transversal:

> normalmente existe un único CTA visual primario.

---

# 17. Information priority

Toda superficie debe priorizar progresivamente:

```text
1. Qué recibí
2. Por qué importa
3. Qué esperan de mí
4. Con qué marco cuento
5. Quién me ayuda
6. Qué hago ahora
```

Esta lista define **prioridad cognitiva**, no seis cards obligatorias.

El resto se resuelve mediante progressive disclosure.

No crear una landing tipo Project Charter.

---

# 18. Email pattern

El email sigue la gramática del Design System:

```text
brand
context label
title
what happened
why it matters
minimal context
primary CTA
why you received this
```

Reglas:

- un CTA principal;
- mínima información sensible;
- contexto ampliado después del click;
- el email no permite Accept/Reject sin pasar por identidad/autenticación gobernada.

---

# 19. Portfolio handoff projection

Antes de que exista una Initiative, no debe forzarse `PortfolioInitiativeProjection` para representar Challenge Assignment.

Este bounded context necesita conceptualmente un read model/projection equivalente a:

```text
PortfolioHandoffProjection
├── assignment_id
├── target_kind
├── challenge_ref
├── initiative_ref?
├── initiative_owner
├── execution_team
├── handoff_state
├── accepted_at?
├── rejected_at?
├── rejection_reason?
├── portfolio_response?
├── started_at?
├── last_material_event
├── projection_version
└── generated_at
```

Regla:

```text
PortfolioHandoffProjection != source of truth
```

Una vez que exista Initiative downstream, esta puede correlacionarse con la proyección canónica de Initiative sin reescribir el historial del handoff.

---

# 20. Domain events del handoff

Eventos candidatos del bounded context:

```text
handoff_assignment_created
handoff_invitation_sent
handoff_invitation_viewed
handoff_assignment_accepted
handoff_assignment_rejected
handoff_rejection_response_recorded
handoff_assignment_revoked
handoff_assignment_expired
handoff_started
```

Cada evento material debe ser trazable con actor, rol, canal, entidad, versión y timestamps según el envelope común de gobernanza.

---

# 21. Downstream integration contract boundary

Este workstream no implementa Steps, pero debe dejar una interfaz desacoplada para que el siguiente workstream publique hacia Portfolio.

Eventos/capacidades posteriores que Portfolio deberá poder consumir:

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

Para Assigned Challenge, cuando el workstream posterior formule una Initiative, debe existir una correlación explícita entre:

```text
assignment_id
→ resulting initiative_id
```

Puede expresarse mediante un evento equivalente a:

```text
initiative_linked_to_assignment
```

sin que este contrato defina cómo se formula esa Initiative.

Portfolio no depende de:

- DOM;
- route pathname;
- component names;
- frontend local state;
- un `currentStep` duplicado manualmente.

---

# 22. Channel-independent capabilities

Target conceptual común:

```text
getHandoffAssignment()
getInvitationOverview()
acceptHandoffAssignment()
rejectHandoffAssignment(reason)
recordPortfolioRejectionResponse()
startAssignedWork()
```

Futuros canales externos deben invocar los mismos services/commands y respetar los mismos guards.

No crear lifecycle alterno para Web, Copilot o API.

---

# 23. KEEP / ADAPT / ADD

## KEEP

- Strategic Front / Challenge domain;
- Initiative Core como source of truth después del boundary correspondiente;
- backend/domain permission direction;
- Project como identidad práctica actual de Initiative salvo ADR;
- sponsor como contexto, no autoridad universal;
- Portfolio event/projection direction;
- Design System foundations/primitives/patterns válidos;
- principio de una acción primaria dominante.

## ADAPT

- `ChallengeInvitation` o equivalente para soportar ambos target kinds;
- claim/auth + invited identity;
- existing Initiative ownership acceptance;
- team enforcement;
- rejection semantics;
- existing Overview patterns hacia Handoff Shell;
- Portfolio projection de handoff;
- `ProjectService.createProject(challengeLink)` fuera del camino canónico de Accept;
- status copy/semantics.

## ADD

- semántica explícita de Handoff Assignment;
- Assigned Challenge sin Initiative ficticia;
- rejection reason obligatorio;
- Portfolio response al rejection;
- Handoff Shell;
- `startAssignedWork()` como boundary semántico;
- `PortfolioHandoffProjection` o read model semánticamente equivalente;
- eventos de handoff;
- integration contract downstream independiente de UI;
- correlación assignment → resulting Initiative para modalidad B.

---

# 24. Explicitly prohibited shortcuts

La implementación de este vertical MUST NOT:

1. tratar Invitation como Initiative;
2. tratar Accept como Start;
3. crear Initiative al aceptar Assigned Challenge;
4. crear Initiative vacía para aumentar coverage;
5. activar Step 0 en Accept;
6. diseñar Step 0–4 dentro de este workstream;
7. cambiar ownership silenciosamente después de Reject;
8. permitir Reject sin reason;
9. permitir Accept/Reject sin validar invited identity;
10. perder invitation context durante auth/register;
11. crear un layout distinto para cada estado del handoff;
12. mostrar todo el Portfolio metadata por defecto;
13. construir un Project Charter como Invitation Landing;
14. crear lifecycle diferente por canal;
15. hacer que Portfolio dependa del DOM/rutas internas de Steps;
16. crear un nuevo aggregate/table `Initiative` solo para acomodar naming sin ADR;
17. modificar Core, Step 0–4 o AI/human authority desde este vertical;
18. convertir un registro importado en Project como side-effect de preparar o guardar una Assignment;
19. colapsar N Assignments a una mediante `find` por BriefVersion;
20. enviar invitaciones desde Guardar o desde la navegación de PL-06A;
21. sobrescribir BriefVersion o contexto canónico de Initiative con el texto editable del encargo.

---

# 25. Acceptance criteria — Experience Contract

## Assignment

- [ ] Portfolio Lead puede asignar una existing Initiative vinculada a Challenge.
- [ ] Portfolio Lead puede asignar un Challenge sin crear Initiative.
- [ ] Un Challenge puede tener N Assignments independientes y cobertura parcial.
- [ ] Re-entry recupera todas las Assignments con target, BriefVersion y versión exactos.
- [ ] Un work record importado sin Project + InitiativePortfolioMeta no puede seleccionarse como Existing Initiative.
- [ ] Guardar materializa únicamente bajo acción explícita y deja la Assignment en `CREATED` sin enviar.
- [ ] Owner, equipo y contexto por encargo solo se editan en `CREATED`, con optimistic concurrency y audit/provenance.
- [ ] El contexto editable por Assignment no muta BriefVersion ni Initiative.
- [ ] Retirar una preparación preserva historial mediante `REVOKED`; no hace hard-delete.
- [ ] Duplicados no terminales se rechazan según target kind y requieren resolución humana explícita.
- [ ] Existing Initiative puede asociar opcionalmente la BriefVersion confirmada exacta desde PL-05, sin volverla universal.
- [ ] Todo assignment tiene exactamente un Initiative Owner propuesto.
- [ ] Execution team tiene máximo 3 personas incluyendo owner.
- [ ] Observers no cuentan en ese límite.

## Invitation / Identity

- [ ] Puede invitarse un email que todavía no tiene cuenta Starteria.
- [ ] Invitation puede abrirse antes del registro/login.
- [ ] Accept/Reject requiere identidad autenticada y validada contra invited identity.
- [ ] Registro/login devuelve a la misma Invitation.
- [ ] Cuenta incorrecta no puede asumir silenciosamente la invitación.

## Response

- [ ] Accept es explícito e idempotente.
- [ ] Accept no activa ejecución.
- [ ] Assigned Initiative Accept no duplica Initiative.
- [ ] Assigned Challenge Accept no crea Initiative.
- [ ] Reject exige reason.
- [ ] Portfolio Lead ve rejection reason.
- [ ] Portfolio Lead puede responder al rechazo.
- [ ] La respuesta no cambia ownership ni acceptance silenciosamente.

## Overview / Start

- [ ] Invitation y Activation Overview comparten Handoff Shell.
- [ ] Overview responde qué recibí / por qué importa / qué esperan / marco / ayuda / siguiente acción.
- [ ] Existe normalmente un solo CTA visual primario.
- [ ] Assigned Challenge no muestra Initiative ficticia.
- [ ] Start solo es posible después de Accept.
- [ ] Start es idempotente y auditable.
- [ ] Start soporta ambos target kinds.
- [ ] El contrato termina en Start.

## Portfolio projection

- [ ] Portfolio ve Challenge.
- [ ] Portfolio ve assignment type.
- [ ] Portfolio ve Initiative cuando existe.
- [ ] Portfolio ve Initiative Owner.
- [ ] Portfolio ve handoff state.
- [ ] Portfolio ve accepted/rejected.
- [ ] Portfolio ve rejection reason.
- [ ] Portfolio ve started.
- [ ] Challenge Assignment sin Initiative no se cuenta como Initiative activa.

## Downstream boundary

- [ ] Portfolio no depende del DOM/rutas/componentes de Steps.
- [ ] Existe contrato de eventos/read model para estados posteriores.
- [ ] Modalidad B puede correlacionar resulting Initiative con assignment cuando esta exista.
- [ ] No se modifica Step 0–4 en este workstream.

---

# 26. ADR triggers

Este contrato por sí solo no requiere un ADR si puede implementarse adaptando el bounded context actual sin cambiar invariantes Core.

Detener y elevar ADR si Technical Design propone:

- `Project ≠ Initiative` como nuevo modelo canónico;
- nueva cardinalidad Core;
- cambio de autoridad humana/IA;
- cambio de función estable Step 0–4;
- permitir que Portfolio escriba StepState;
- considerar Challenge Assignment como Initiative canónica;
- redefinir canónicamente qué significa Challenge `active` de forma incompatible con Core;
- una migración material de dominio.

---

# 27. No-regression

Este vertical debe preservar:

- Portfolio Bootstrap;
- Strategic Front / Challenge semantics salvo adaptación explícita del handoff;
- Initiative Core;
- Step 0–4;
- Adaptive Cycle;
- permissions backend-driven;
- human decision authority;
- provenance/audit direction;
- existing Initiative history;
- distinction expected / observed / attributed contribution.

---

# 28. Próximos artefactos antes de Technical Design

Después de congelar este contrato, producir en este orden:

```text
1. PORTFOLIO_TO_INITIATIVE_HANDOFF_ACCEPTANCE_CHECKLIST_v0.1.md
2. PORTFOLIO_TO_INITIATIVE_HANDOFF_VISUAL_UX_WRITING_CONTRACT_v0.1.md
3. PORTFOLIO_TO_INITIATIVE_HANDOFF_INTEGRATION_CONTRACT_v0.1.md
4. Delivery Translation
5. HUs / Business Rules / AC detallados
6. Technical Design
7. Implementation slices
8. Harness / E2E
```

No empezar Technical Design mientras la experiencia y sus invariantes sigan abiertos.

---

# 29. Definition of Done de este contrato

Este Experience Contract puede congelarse cuando:

- las dos modalidades A/B están aceptadas;
- Challenge Assignment no crea Initiative ficticia;
- Team rule está aceptada;
- invitation/auth/identity semantics están aceptadas;
- Accept/Reject semantics están aceptadas;
- rejection handling está aceptado;
- Handoff Shell está aceptado;
- Start semantics están aceptadas;
- Portfolio projection mínima está aceptada;
- hard boundary con Steps está aceptado;
- no queda conflicto Core silencioso.

---

# 30. Regla final

> Portfolio Lead transfiere un encargo. Initiative Owner decide si lo asume, entiende el marco y decide cuándo empezar. Starteria conserva trazabilidad entre ambos sin inventar una Initiative ni iniciar Steps antes de tiempo.
