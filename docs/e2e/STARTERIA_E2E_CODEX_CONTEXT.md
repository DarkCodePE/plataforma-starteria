# Starteria — Unified E2E Codex Execution Context

**Documento:** `STARTERIA_E2E_CODEX_CONTEXT.md`  
**Versión:** v0.1  
**Estado:** APPROVED FOR E2E GOAL EXECUTION  
**Fecha:** 2026-10-20  
**Tipo:** Goal Execution Context / Development Governance  
**Alcance:** Goal P0–P12 — Unificación E2E Portfolio Lead → Initiative → Steps 0–4 → Decision → Portfolio

---

# 0. Naturaleza y autoridad de este documento

Este documento gobierna **cómo debe ejecutarse el E2E Goal P0–P12**.

No es un Core Contract.

No es un ADR.

No es un Experience Contract.

No puede promover documentos candidatos, redefinir el dominio ni modificar autoridad humana o de IA.

Su función es:

- mantener la ejecución del Goal alineada con las fuentes de autoridad reales;
- impedir reconciliaciones silenciosas;
- exigir evidencia antes de declarar comportamiento;
- gobernar gates, verificación y trazabilidad durante P0–P12.

En caso de conflicto:

```text
Core vigente
→ ADR aprobado
→ Experience Contract vigente
→ Agent Contract
→ Skill Contract
→ Tech Spec aplicable
→ este Goal Execution Context
→ evidencias / PRDs / freezes / mockups según su clasificación
→ implementación
```

prevalece siempre la fuente de mayor autoridad.

---

# 1. Baseline factual conocido al iniciar el Goal

El snapshot P0 determinó provisionalmente y con evidencia que:

```text
Core factual/current:
doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md
```

```text
docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md
= candidate
```

La versión candidata no debe promoverse ni utilizarse para reemplazar silenciosamente el Core factual.

Si una fase posterior encuentra evidencia superior que cambie esta situación:

```text
STOP
→ registrar conflicto
→ volver a evaluar authority snapshot
→ no cambiar autoridad silenciosamente
```

---

# 2. Canonical Goal Repository

El Goal debe ejecutarse dentro del checkout fijado por P0.

El repo root, branch y SHA concreto pertenecen al `P0_AUTHORITY_SNAPSHOT.md` / `STARTERIA_E2E_GOAL_PROGRESS.md`.

No hardcodear en este archivo un SHA como verdad permanente.

En cada fase registrar:

```text
CANONICAL_GOAL_REPO_ROOT
BRANCH
HEAD_SHA
FRONT_SHA when applicable
BACK_SHA when applicable
AI/PROMPT VERSION when applicable
```

Todos los artefactos del Goal deben vivir bajo:

```text
<CANONICAL_GOAL_REPO_ROOT>/docs/e2e/
```

salvo runtime evidence que tenga una ubicación técnica explícitamente registrada.

---

# 3. Mission

Implementar y acreditar la experiencia E2E unificada de Starteria desde Portfolio Lead hasta Initiative Core, Steps 0–4, decisión y retorno al Portfolio.

El objetivo NO es hacer que cada pantalla renderice.

El objetivo es demostrar mediante evidencia que:

```text
Portfolio Lead
→ Assignment
→ Accept / Reject
→ Start
→ formulación o continuidad de Initiative
→ Overview
→ Step 0
→ Step 1
→ Step 2
→ Step 3
→ Step 4
→ Decision Package
→ decisión humana
→ retorno al Portfolio
```

funciona como un único sistema:

- lógico;
- funcional;
- visualmente coherente;
- gobernado;
- trazable;
- resistente a retries;
- sin duplicar entidades;
- sin inventar evidencia;
- sin crear autoridad ficticia.

---

# 4. Source Classification Rule

Toda fuente utilizada durante P0–P12 debe conservar la clasificación acordada en P0.

Clasificaciones permitidas:

```text
APPROVED_AUTHORITY
APPROVED_ADR
FROZEN_EXPERIENCE
CANDIDATE
AS_IS_EVIDENCE
TEST_EVIDENCE
REFERENCE_ONLY
SUPERSEDED
UNKNOWN_AUTHORITY
```

Un número de versión superior NO implica mayor autoridad.

Un mockup NO modifica Core.

Un freeze UX NO resuelve automáticamente una decisión de dominio.

Una implementación existente NO es autoridad de producto.

Un documento `CANDIDATE` NO puede gobernar comportamiento hasta que exista evidencia de promoción.

---

# 5. Frozen Product Intent

No rediseñar desde cero experiencias ya congeladas.

## 5.1 Portfolio Lead

Preservar la experiencia congelada identificada por P0 como `FROZEN_EXPERIENCE`, dentro de los límites que su propio freeze declara.

La experiencia objetivo incluye conceptualmente:

- definición conversacional del objetivo de negocio;
- contexto relevante;
- frente/resultado estratégico;
- KPI o señal cuando exista soporte;
- baseline/meta/horizonte cuando existan;
- incorporación de iniciativas existentes;
- análisis de alineamiento;
- contribución;
- gaps;
- posibles duplicidades/solapamientos;
- cobertura;
- priorización;
- organización por retos cuando aporte estructura;
- briefs;
- asignación;
- Home ejecutivo;
- Portfolio;
- Decisions.

El freeze Portfolio Lead NO debe utilizarse para:

- aprobar un cambio Core;
- resolver una cardinalidad pendiente;
- ampliar autoridad de IA;
- sustituir un ADR requerido.

---

## 5.2 Initiative Owner / Steps

Preservar el target de experiencia Steps clasificado por P0 según su estado documental real.

El target UX incluye:

```text
Mis iniciativas
→ Overview
→ Step 0–4
```

y dentro de cada Step:

```text
conversación de Copilot
+
Card viva de resultado construido
+
evidencia/contexto
+
checkpoint/siguiente acción
```

No replicar como lógica productiva las respuestas preprogramadas o fallos funcionales detectados en el HTML/QA.

El HTML v0.6 es una referencia de experiencia; no prueba por sí mismo comportamiento IA o backend.

---

# 6. Strategic vs Execution Authority

Mantener separación entre:

## Portfolio Lead

Gobierna:

- intención estratégica;
- lectura del portafolio;
- cobertura;
- asignación;
- capacidad;
- señales;
- priorización;
- preparación y toma de decisiones dentro de su autoridad.

## Initiative Owner

Gobierna la ejecución de una iniciativa:

- contexto del ciclo;
- trabajo Step 0–4;
- evidencias;
- entregables;
- bloqueos;
- aprendizajes;
- recomendación.

Una misma persona puede ocupar más de un rol, pero el sistema no debe colapsar responsabilidades por esa razón.

---

# 7. Critical Identity Rules

Las siguientes operaciones NO son equivalentes:

```text
Assign
≠
Accept
≠
Start
≠
Create Initiative
≠
Activate Step
```

Start significa:

> comenzar a trabajar sobre el encargo aceptado.

Start NO debe significar silenciosamente:

- crear una Initiative final;
- aprobar su formulación;
- decidir alineamiento;
- decidir Step;
- crear evidencia;
- confirmar contexto.

Toda creación o cambio material debe respetar los checkpoints que correspondan según autoridad vigente.

---

# 8. Required Post-Start Paths

La implementación objetivo debe contemplar tres caminos de continuidad.

Su detalle definitivo debe quedar gobernado por los contratos/ADRs que se aprueben en las fases correspondientes.

## Route A — Assignment/Challenge sin Initiative confirmada

Objetivo candidato:

```text
Assignment
→ Accept
→ Start
→ formular Initiative candidata
→ revisión
→ confirmación humana requerida
→ una Initiative
→ Overview
→ Core
```

No crear una Initiative vacía únicamente porque ocurrió Start.

---

## Route B — Existing / inherited Initiative

Objetivo:

```text
Existing Initiative
→ Assignment / handoff
→ Accept when applicable
→ Start
→ misma Initiative identity
→ recuperar contexto + fuentes + evidencia + historia
→ reconstruir gaps
→ determinar continuidad válida
→ Core
```

Reglas:

- no duplicar Initiative;
- no borrar historia;
- no obligar a rehacer trabajo válido únicamente para satisfacer secuencia visual;
- no considerar automáticamente aprobado un Step porque exista contenido equivalente.

---

## Route C — Independent Initiative

Objetivo:

```text
entrada independiente
→ formulación
→ confirmación
→ una Initiative
→ Overview
→ Adaptive Core
```

No fabricar:

- StrategicFront;
- Challenge;
- sponsor corporativo;

cuando la iniciativa realmente no pertenece a ese contexto.

---

# 9. Shared Reasoning Architecture

No crear desde cero un nuevo superagente sin auditar primero:

- agents;
- skills;
- orchestrators;
- prompts;
- services;
- schemas;
- read models;
- persistence;
- event flows;

ya existentes.

La arquitectura TO-BE debe distinguir tres capas.

---

## 9.1 Shared Reasoning Engine

Para cada input relevante:

```text
RECEIVE INPUT
↓
RECOVER RELEVANT CONTEXT
↓
INTERPRET
↓
CLASSIFY KNOWLEDGE
↓
DETECT CHANGE / GAP / CONTRADICTION / UNKNOWN
↓
IDENTIFY CURRENT DECISION OR UNCERTAINTY
↓
SELECT NEXT INTERVENTION
↓
PROPOSE STRUCTURED DELTA
↓
EVALUATE SUFFICIENCY / RISK / AUTHORITY
↓
HUMAN CONFIRMATION WHEN REQUIRED
↓
PERSIST VERSIONED STRUCTURED STATE
↓
HANDOFF
```

No es obligatorio que cada nodo corresponda a una llamada LLM independiente.

---

## 9.2 Specialized Capabilities

Cada experiencia mantiene responsabilidad especializada.

Ejemplos:

```text
Portfolio Entry
Portfolio Lead
Handoff
Post-Start formulation/reconstruction
Step 0
Step 1
Step 2
Step 3
Step 4
Decision
Portfolio Return
```

No crear duplicación de lógica cuando una capability existente pueda reutilizarse compatible con los contratos.

---

## 9.3 Governance

Mantener explícitamente:

```text
conversation ≠ system of record

AI_INFERRED ≠ USER_CONFIRMED

AI_SUGGESTED ≠ organizational decision

hypothesis ≠ fact

claim ≠ evidence

uploaded source ≠ validated evidence

semantic similarity ≠ confirmed duplication

expected impact ≠ observed impact ≠ attributed impact

documented progress ≠ approved Step

recommendation ≠ decision
```

---

# 10. Knowledge Classification

Cuando sea material, Starteria debe poder distinguir al menos:

- user-declared fact;
- extracted claim;
- observation;
- hypothesis;
- assumption;
- AI inference;
- AI suggestion;
- unknown;
- ambiguity;
- contradiction;
- constraint;
- dependency;
- blocker;
- source;
- evidence;
- recommendation;
- decision.

No inventar dato para evitar `unknown`.

---

# 11. Context Recovery

Antes de preguntar al usuario, comprobar si la respuesta ya existe en:

- estado canónico;
- snapshots;
- mandate/brief;
- conversación vigente;
- Cards anteriores;
- evidence repository;
- SourceRefs;
- outputs de Steps anteriores;
- decisiones;
- contexto organizacional permitido.

No repetir preguntas únicamente porque un campo visual está vacío.

No usar información histórica obsoleta como actual sin revisar currentness cuando sea material.

---

# 12. Intervention Selection

El motor puede recomendar intervenciones distintas.

## ASK

Cuando falta información material que no puede recuperarse.

## ANALYZE

Cuando ya existe información/fuentes suficientes pero aún no han sido interpretadas.

## INVESTIGATE / GATHER

Cuando hace falta nueva información antes de decidir.

## ACT / PREPARE

Cuando seguir conversando aporta menos que construir o ejecutar una acción permitida.

## EXPERIMENT

Solo cuando la función del Step y la autoridad aplicable lo permiten.

## UNBLOCK

Cuando el gap depende de:

- acceso;
- persona;
- permiso;
- dependencia;
- recurso;
- decisión externa.

## REFRAME

Cuando evidencia nueva altera materialmente el frame vigente.

## STOP / CHECKPOINT

Cuando:

- existe suficiencia;
- los gaps restantes son no críticos;
- se alcanzó un límite de autoridad;
- falta evidencia externa;
- la siguiente decisión pertenece a una persona;
- seguir preguntando invadiría otra etapa;
- hay evidencia para recomendar pausa/cierre.

No convertir Starteria en chat infinito.

---

# 13. Copilot + Card Semantics

La conversación es un espacio de trabajo.

La Card representa estado estructurado/versionado.

No llenar Card por orden de mensajes.

Pipeline esperado:

```text
input
→ semantic interpretation
→ knowledge classification
→ proposed delta
→ authority/review check
→ Card version update
```

Ejemplo:

```text
User:
"No sé todavía quién utiliza este proceso."
```

Correcto:

```text
actor = UNKNOWN
```

o equivalente estructurado.

Incorrecto:

```text
proposal = "No sé todavía quién utiliza este proceso."
```

Una respuesta irrelevante no puede satisfacer automáticamente un requirement.

---

# 14. Evidence & Provenance

Toda afirmación material utilizada para análisis o decisión debe poder rastrearse.

Como mínimo:

```text
claim
source
origin
review disposition
created/observed time
evidence reference when applicable
version
```

Una síntesis IA no debe convertirse en fuente de sí misma.

Una evidencia nueva no debe sobrescribir silenciosamente una evidencia anterior.

---

# 15. Versioning and Currentness

Nueva información no elimina historia.

Ante un cambio material:

```text
preserve previous version
→ record new version
→ record source/reason
→ evaluate downstream impact
→ mark requires_review where applicable
```

No reescribir retroactivamente Steps completados como si el nuevo contexto siempre hubiera existido.

---

# 16. Sufficiency

No utilizar:

```text
number of turns
=
Step completion
```

Un Step o checkpoint puede considerarse suficiente solo según la definición vigente del Core/Experience correspondiente.

Conceptualmente deben considerarse elementos como:

- variables críticas resueltas;
- output mínimo;
- evidencia requerida;
- coherencia con contexto actual;
- validador requerido;
- hard gates.

Soft gaps pueden permanecer.

No convertir la completitud visual de un formulario en suficiencia metodológica.

---

# 17. Step Stability

No modificar las funciones estables de Step 0–4 únicamente para acomodar UI o implementación existente.

Cuando una propuesta dependa de una definición presente solo en el Core v0.3 candidato y contradiga el Core factual v0.2:

```text
CONFLICT
→ no implementar silenciosamente
→ determinar si requiere ADR / promoción / re-test
```

---

# 18. Decision Authority

IA puede:

- analizar;
- criticar;
- comparar;
- recomendar;
- explicar incertidumbre.

IA no puede asumir autoridad organizacional para:

- aprobar estrategia;
- aprobar alineamiento;
- aprobar inversión;
- confirmar evidencia cuando se requiere validador;
- cerrar una iniciativa;
- autorizar escalamiento;
- afirmar atribución sin sustento.

El actor autorizado debe quedar explícito cuando exista una decisión material.

---

# 19. Portfolio ↔ Initiative Knowledge Transfer

Evitar duplicación de objetos.

Preferir referencias, snapshots o envelopes versionados.

## Portfolio → Initiative

Transportar únicamente contexto necesario, por ejemplo:

- refs a frente/reto cuando aplique;
- objetivo/resultados;
- KPI/señal;
- restricciones;
- horizonte;
- decisión esperada;
- brief;
- SourceRefs;
- versión del mandato.

## Step → Step

Transportar contexto confirmado y material:

- síntesis;
- claims;
- evidence refs;
- assumptions;
- contradictions;
- gaps;
- constraints;
- next uncertainty;
- Card version.

## Initiative → Portfolio

Exponer read model necesario para gobernar:

- state;
- current cycle/Step;
- next milestone;
- blockers;
- support required;
- evidence signal;
- expected contribution;
- observed signal where available;
- risk;
- decision requested;
- resource/capacity information where governed.

No duplicar indiscriminadamente todo el workspace de Steps.

---

# 20. Decision Causality

El sistema debe conservar una cadena explicable:

```text
Initiative
→ Cycle
→ Step output
→ Decision Package
→ Decision Request
→ authorized human decision
→ Portfolio update
```

Debe poder responder:

> ¿Por qué cambió este estado?

sin inferirlo únicamente a partir del estado actual.

---

# 21. Impact Claims

Cuando la implementación llegue a esa fase, mantener separados:

```text
EXPECTED
OBSERVED
ATTRIBUTED
```

No presentar:

- ROI;
- ahorro;
- ingreso incremental;
- impacto;

como observado o atribuido sin fuente y método compatibles con la autoridad vigente.

---

# 22. Evidence Doctrine for Codex

Toda afirmación material realizada por Codex durante P0–P12 debe estar soportada.

Usar estas categorías.

## AUTHORITY

```text
AUTHORITY
Path:
Heading / Requirement ID:
Exact quote:
Interpretation:
```

La cita textual breve es obligatoria para conclusiones materiales sobre autoridad o requerimiento.

---

## CODE

```text
CODE
Path:
Lines:
Observed behavior:
```

---

## TEST

```text
TEST
Command:
Exit code:
Relevant output:
Artifact:
```

---

## RUNTIME

```text
RUNTIME
Environment:
Front SHA:
Back SHA:
AI/prompt version:
Route / API:
Actor:
Observed result:
Artifact:
```

No afirmar comportamiento runtime basándose únicamente en inspección de código.

---

# 23. Evidence Pair Rule

Para cada Acceptance Criterion, cuando aplique, demostrar:

```text
WHAT SHOULD HAPPEN
→ authority / frozen target evidence
```

y:

```text
WHAT ACTUALLY HAPPENS
→ code / test / runtime evidence
```

No marcar `PASS` solo porque existe código.

No marcar `PASS` solo porque un test mockeado devuelve verde.

No marcar `PASS` solo porque la UI se ve correcta.

---

# 24. Unsupported Claims

No utilizar sin evidencia:

- implemented;
- working;
- fixed;
- verified;
- E2E passes;
- no regression;
- compatible;
- production-ready;
- secure;
- idempotent.

Si no puede demostrarse:

```text
BLOCKED
```

o:

```text
NOT VERIFIED
```

según el caso.

---

# 25. Conflict Protocol

Si implementación y autoridad no coinciden:

```text
CONFLICT

ID:
Higher authority:
Exact quote:
Current implementation:
Code evidence:
Observed mismatch:
Risk:
Recommended treatment:
KEEP / ADAPT / REPAIR / REMOVE / NEW
Requires ADR: YES / NO / UNKNOWN
Earliest phase requiring resolution:
```

No reconciliar silenciosamente.

---

# 26. ADR Rule

Detener la parte afectada cuando el cambio:

- modifique un Core invariant;
- altere cardinalidad canónica;
- cambie autoridad humana;
- amplíe autoridad organizacional de IA;
- cambie función estable de Steps;
- cambie Adaptive Cycle/gating;
- canonicalice automáticamente inferencias;
- requiera migración material de dominio.

No utilizar HTML, PRD o prototype para saltar esta regla.

---

# 27. Test Integrity

Prohibido:

- cambiar expectations solo para obtener PASS;
- borrar tests que exponen una regresión;
- sustituir runtime por mocks en criterios E2E;
- utilizar la implementación como definición de comportamiento;
- modificar fixture hasta que coincida con un bug;
- considerar output generado como evidencia de sí mismo.

Cuando un test debe cambiar legítimamente:

1. citar requirement superior;
2. demostrar que la expectativa anterior quedó obsoleta;
3. actualizar test;
4. verificar nueva conducta.

---

# 28. Runtime Rule

El estado final `DONE` exige runtime desplegado para escenarios E2E críticos.

Si un E2E no puede ejecutarse por:

- falta de tenant;
- credenciales;
- sesiones;
- deployment;
- browser;
- API;
- environment;
- fixture real;

debe permanecer:

```text
BLOCKED
```

No convertirlo en PASS documental.

---

# 29. Goal Progress Ledger

Mantener:

```text
docs/e2e/STARTERIA_E2E_GOAL_PROGRESS.md
```

Como mínimo:

```text
Current phase
Goal version
Canonical repo
Branch
HEAD SHA

Authority snapshot version
TO-BE freeze version

Front SHA
Back SHA
AI/prompt version

P0 status
P1 status
...
P12 status

Open conflicts
ADR blockers
Blocked tests
Last verified command
Last verified deployed E2E
```

Solo una fase puede estar `IN_PROGRESS`.

Estados:

```text
NOT_STARTED
IN_PROGRESS
PASS
FAIL
BLOCKED
```

---

# 30. Phase Gate Rule

No avanzar a la fase siguiente cuando la fase actual tenga:

- FAIL crítico;
- BLOCKED crítico;
- Acceptance Criterion obligatorio sin evidencia;
- conflicto de autoridad necesario para la siguiente fase;
- ADR blocker necesario para la siguiente fase.

Una decisión pendiente que pertenece explícitamente a una fase posterior NO bloquea por sí sola una fase anterior de inventario o baseline.

Debe registrarse con:

```text
EARLIEST_PHASE_REQUIRED
```

---

# 31. Scope Discipline

Implementar únicamente lo autorizado por la fase actual.

No mezclar:

- refactors no relacionados;
- upgrades de dependencias;
- cambios CI/CD;
- rediseños visuales;
- migrations no requeridas;
- limpieza legacy prematura.

Legacy solo puede eliminarse cuando:

1. replacement está verificado;
2. consumers están inventariados;
3. E2E nuevo pasa;
4. rollback está comprendido.

---

# 32. Completion Principle

Starteria E2E solo puede marcarse:

```text
DONE
```

si:

1. P0–P12 cumplen sus gates;
2. los criterios críticos tienen evidencia;
3. no existen conflictos ocultos;
4. no existe ADR blocker aplicable al E2E final;
5. los E2E críticos pasan en runtime desplegado;
6. permissions/tenant isolation están verificadas;
7. retries/idempotencia están verificadas;
8. no existen entidades duplicadas por los flows;
9. no existe evidencia inventada;
10. IA conserva la autoridad definida;
11. Portfolio Lead e Initiative Owner conservan responsabilidades separadas;
12. Initiative/Steps producen retorno trazable al Portfolio;
13. requirements → implementation → tests → runtime permanecen trazables;
14. el AS-IS final puede contrastarse contra el TO-BE congelado.

---

# 33. Final Principle

> Codex implementa contratos; no redefine Starteria.

Y:

> Una fase no está terminada porque Codex crea que el cambio es correcto. Está terminada cuando sus Acceptance Criteria están acreditados mediante evidencia compatible con la autoridad vigente.
