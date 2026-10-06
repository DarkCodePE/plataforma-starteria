# Starteria — Portfolio Entry Clarification + Handoff Contract

**Documento:** `PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`
**Versión:** v0.2.1
**Estado:** CANDIDATE / PROPOSED FOR TESTING
**Fecha:** 2026-09-10
**Tipo:** Experience / Orchestration Contract
**Vertical slice:** Portfolio Entry
**Responsabilidad:** aclaración breve, exploración guiada opcional y handoff previo a creación de workspace/contexto canónico

---

## 0. Autoridad

Este documento continúa siendo un **subcontrato candidato de experiencia de Portfolio Entry**, propuesto para testing. No gobierna por sí mismo el runtime activo. Su referencia desde Logic, Agent o Skills no equivale a promoción; únicamente las cláusulas adoptadas explícitamente por una autoridad superior pueden utilizarse como norma activa.

La autoridad factual de Core es:

`doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md` — Core v0.2, estado: `Base fundacional revisada / Por validar`.

`docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` v0.3 existe como candidato de gobernanza y no reemplaza ni promueve el Core v0.2. Este documento candidato no gobierna normativamente la sesión, aclaración, exploración guiada ni handoff activos.

La jerarquía objetivo propuesta por este candidato para validación —no vigente mientras conserve estado candidato— es:

```text
Core v0.2
↓
ADRs
↓
Portfolio Entry Logic / Experience Contract
↓
Clarification + Handoff Contract
↓
Portfolio Entry Agent Contract
↓
Skill Contracts
↓
Tech Spec
↓
Schemas / Tests / Implementation
```

### Contratos de implementación con los que se integra

Estos documentos **no son autoridad superior** de este contrato; son contratos subordinados o interfaces de ejecución:

- `PORTFOLIO_ENTRY_AGENT_CONTRACT_v0.2.md`
- `entry-01-intent-detection/SKILL_v0.2.md`
- `entry-02-context-extraction/SKILL_v0.2.md`
- `entry-03-reverse-alignment/SKILL_v0.2.md`
- `entry-04-question-planner/SKILL_v0.2.md`

### Evidencia de diseño

`PORTFOLIO_ENTRY_TEST_FINDINGS_REGISTER_v0.2.md` es una fuente de trazabilidad y evidencia de testing. **No forma parte de la cadena de autoridad.**

Este contrato no puede:

- redefinir el dominio canónico;
- contradecir el Core Contract o ADRs;
- redefinir la función estable de los Steps;
- convertir una hipótesis de UX en una regla de Core;
- autorizar a la IA a confirmar contexto organizacional sin intervención humana.

En caso de conflicto:

```text
contrato superior
→ prevalece

contrato inferior
→ debe adaptarse
```

---

## 0.0.1. Corrección de gobernanza documental

`v0.2.1` es una corrección de jerarquía documental sobre `v0.2`.

No modifica las hipótesis funcionales de Quick Clarification, Guided Exploration, Recommended Approach, Alternatives o GapResolutionMap.

Corrige únicamente que:

- Agent Contract y Skill Contracts no son autoridad superior de este documento;
- el Findings Register es evidencia, no autoridad;
- se propone ubicar este contrato entre el Portfolio Entry Logic Contract y los contratos de Agent/Skills para testing de las responsabilidades de sesión y handoff; esta propuesta no le concede autoridad activa.

---

## 0.1. Cambios desde v0.1

Esta versión refina cuatro hipótesis de experiencia que deben validarse en Harness v0.2:

1. el límite de tres preguntas se aplica al modo de **Quick Clarification**, no como prohibición absoluta de ayudar a un usuario que todavía no tiene claridad;
2. si continúa existiendo ambigüedad material, Starteria puede ofrecer **Guided Exploration** de forma explícita y voluntaria;
3. el handoff puede incluir una **ruta recomendada** y alternativas, siempre identificadas como propuesta de IA y no como verdad organizacional;
4. los gaps pueden mapearse a capacidades y momentos de Starteria para mostrar qué puede estructurar, guiar, seguir o qué requiere input/evidencia externa.

Además, se aclara que Starteria puede ayudar a estructurar o mejorar la lógica operativa de sistemas como una aceleradora o programa de innovación, siempre que preserve si esa estructura ya existe o todavía se desea crear.

Estas decisiones son hipótesis de diseño a validar. No deben promocionarse todavía como findings confirmados sin nueva evidencia.

---

# 1. Propósito

Gobernar la experiencia entre:

```text
PortfolioEntryAnalysis
↓
Quick Clarification
↓
¿hay claridad suficiente?
├── sí → Handoff
└── no → opción de Guided Exploration
              ↓
        nueva síntesis
              ↓
        Handoff / continuar exploración
```

El objetivo es que Starteria pueda:

- entender suficientemente la necesidad;
- ayudar al usuario a ganar claridad cuando todavía no sabe bien qué abordar;
- proponer una forma razonable de avanzar;
- hacer visible qué falta resolver;
- mostrar qué parte de ese trabajo puede desarrollarse dentro de Starteria.

---

# 2. Principio de experiencia

Portfolio Entry no es un formulario ni una entrevista ilimitada.

Debe sentirse como:

```text
entender
↓
aclarar lo crítico
↓
orientar
↓
mostrar opciones
↓
hacer visible el camino
```

Principio:

> Starteria debe reducir ambigüedad sin obligar al usuario a llegar con el problema perfectamente formulado.

---

# 3. Modos de interacción

La sesión puede operar en dos modos:

```text
QUICK_CLARIFICATION
GUIDED_EXPLORATION
```

## 3.1. Quick Clarification

Modo por defecto.

Objetivo:

> Conseguir suficiente claridad con mínima fricción.

Budget contractual:

```text
quick_question_budget = 3
```

Este budget aplica a la fase completa de Quick Clarification.

Puede terminar antes.

Tres es el máximo de este modo, no el objetivo.

La salida user-facing por turno es siempre `0..1` active question. El planner puede detectar varios gaps internamente, pero no puede presentarlos agrupados.

## 3.2. Guided Exploration

Modo opcional cuando, después de la aclaración rápida, todavía existe ambigüedad material y el usuario quiere profundizar.

Solo puede activarse con elección explícita del usuario.

No debe iniciarse silenciosamente.

Ejemplo conceptual:

> Todavía hay dos puntos que cambian bastante cómo conviene abordar esto. Puedo mostrarte una ruta provisional ahora o explorar un poco más contigo.

Opciones:

```text
Ver una ruta provisional
Explorar un poco más
Reformular mi necesidad
```

---

# 4. Guided Exploration no significa preguntas ilimitadas

Cada ronda de Guided Exploration debe:

1. tener un propósito visible;
2. usar un nuevo Question Plan de máximo 0–1 pregunta user-facing;
3. detenerse para sintetizar lo aprendido;
4. mostrar qué incertidumbre se redujo;
5. permitir al usuario decidir si quiere continuar.

No se permite:

```text
pregunta
→ pregunta
→ pregunta
→ pregunta...
```

sin puntos de control.

---

# 5. Estado conceptual de sesión

```text
ClarificationSession
├── session_id
├── entry_id
├── analysis_version
├── interaction_mode
├── quick_question_budget
├── quick_questions_asked
├── exploration_round
├── questions_asked_current_round
├── questions_answered
├── previous_questions
├── answered_gaps
├── current_question_plan
├── stop_reason
├── unresolved_critical_context
├── unresolved_noncritical_context
├── clarification_status
└── handoff_ready
```

### `interaction_mode`

- `quick_clarification`
- `guided_exploration`

### `clarification_status`

- `not_started`
- `in_progress`
- `exploration_offered`
- `guided_exploration`
- `ready_for_handoff`
- `ended_with_uncertainty`
- `abandoned`

---

# 6. Regla de progreso

Durante Quick Clarification la UI debe comunicar que se trata de una interacción breve.

Ejemplos conceptuales:

```text
1 de hasta 3 aclaraciones
```

o:

```text
Quedan hasta 2 aclaraciones rápidas
```

En Guided Exploration debe cambiar el lenguaje.

Ejemplo:

```text
Exploración guiada · ronda 1
```

El usuario debe saber que eligió profundizar.

`quick_questions_asked` cuenta preguntas efectivamente presentadas, no candidatos del planner ni preguntas almacenadas en un batch legacy. Una pregunta respondida se retira aunque su gap permanezca sin resolver.

---

# 7. Actualización después de cada respuesta

Después de cada respuesta:

```text
respuesta del usuario
↓
Skill 01 puede actualizar current_frame / intent
↓
Skill 02 actualiza contexto
↓
Skill 03 reevalúa reverse alignment
↓
Skill 04 replantea preguntas
↓
session controller decide:
   continuar
   ofrecer exploración
   sintetizar
   cerrar
```

`initial_entry_state` se preserva.

La respuesta debe identificar como máximo una pregunta mediante `matchedQuestionIds`. `respondedResolves` puede ser vacío: `QUESTION ANSWERED != GAP RESOLVED`. Solo los resolve targets validados se incorporan a `answered_gaps`.

---

# 8. Regla de stopping en Quick Clarification

Quick Clarification debe detenerse cuando ocurra cualquiera:

### CH-QSTOP-01 — Sufficient context

Existe suficiente contexto para un handoff útil.

### CH-QSTOP-02 — Quick budget exhausted

```text
quick_questions_asked = 3
```

No hacer una cuarta pregunta dentro de Quick Clarification.

Si quedan gaps materiales:

```text
clarification_status = exploration_offered
```

y el usuario elige:

- handoff provisional;
- Guided Exploration;
- reformulación.

Si la ronda no puede producir una pregunta nueva materialmente distinta, debe converger a checkpoint o stop técnico/de seguridad. Nunca se reactiva una pregunta presentada ni se busca una pregunta activa en turnos históricos cuando el latest turn no tiene ninguna.

### CH-QSTOP-03 — Noncritical gaps only

Los gaps restantes no cambian materialmente la comprensión.

### CH-QSTOP-04 — Step boundary

La siguiente pregunta invadiría trabajo posterior.

### CH-QSTOP-05 — User chooses to continue

El usuario puede pedir avanzar con lo ya entendido.

---

# 9. Regla de stopping en Guided Exploration

Una ronda de Guided Exploration debe detenerse cuando:

### CH-ESTOP-01

El propósito de la ronda quedó suficientemente aclarado.

### CH-ESTOP-02

El Question Plan de la ronda se agotó.

### CH-ESTOP-03

Los gaps restantes pertenecen a etapas posteriores.

### CH-ESTOP-04

El usuario prefiere avanzar.

Después de cada ronda Starteria debe sintetizar antes de ofrecer otra.

Esta slice congela una única ronda de Guided Exploration; no se permite una tercera ronda.

---

# 10. No perseguir completitud

Portfolio Entry puede terminar con:

```text
contexto suficiente
+
incertidumbre explícita
```

No necesita:

- KPI formal;
- baseline;
- target;
- ROI;
- ownership detallado;
- presupuesto;
- evidencia validada;
- experimento diseñado;
- todos los stakeholders.

---

# 11. Handoff ready

`handoff_ready = true` cuando Starteria puede producir una salida útil que responda:

1. ¿Qué entendió?
2. ¿Qué quiere conseguir el usuario?
3. ¿Qué decisión o resultado necesita habilitar?
4. ¿Qué sabemos ya?
5. ¿Qué sigue faltando?
6. ¿Qué forma de abordarlo parece más razonable?
7. ¿Qué otras rutas podrían existir, si son materialmente distintas?
8. ¿Qué parte de los gaps puede resolver o acompañar Starteria?
9. ¿Cómo continuaría el trabajo dentro de la plataforma?

No requiere eliminar toda ambigüedad.

---

# 12. PortfolioEntryHandoff

Output conceptual:

```text
PortfolioEntryHandoff
├── understanding
├── desired_outcome
├── decision_to_enable
├── recommended_approach
├── alternative_approaches
├── known_context
├── unresolved_context
├── gap_resolution_map
├── evidence_or_clarity_needed
├── starteria_path
├── recommended_cta
├── provenance_summary
└── handoff_status
```

### `handoff_status`

- `ready`
- `ready_with_uncertainty`
- `insufficient_input`

---

# 13. `understanding`

Debe sintetizar el problema o necesidad en lenguaje natural.

Debe ser:

- breve;
- fiel;
- específico;
- sin taxonomía interna.

Ejemplo:

> Necesitas mejorar cómo un programa interno ya existente convierte oportunidades en decisiones de inversión y avance.

No:

> `primary_intent = portfolio_governance`.

---

# 14. `desired_outcome`

Describe qué quiere lograr el usuario.

Ejemplos:

- acelerar decisiones;
- reducir riesgo;
- entender alineamiento;
- mejorar seguimiento;
- diseñar una forma más clara de gobernar iniciativas.

No inventar métricas.

---

# 15. `decision_to_enable`

Cuando exista, expresa la decisión que Starteria debería ayudar a mejorar.

Ejemplos:

- qué iniciativas entran;
- cuáles siguen;
- cuáles reciben presupuesto;
- cuáles escalan;
- qué presentar a dirección.

Si no existe soporte suficiente:

```text
decision_to_enable = unresolved
```

---

# 16. `recommended_approach`

Starteria puede proponer una forma razonable de abordar el objetivo cuando exista suficiente contexto.

Debe mantenerse como:

```text
origin = AI_SUGGESTED
review_disposition = UNREVIEWED
```

hasta aceptación humana.

Ejemplo:

> Antes de generar más ideas, parece más útil hacer visible qué iniciativas ya existen, cómo se conectan con tus prioridades y qué evidencia tiene cada una.

No permitido:

> Esta es objetivamente la forma más eficiente.

La recomendación puede ser comparativa, pero no debe presentar superioridad como hecho sin evidencia.

---

# 17. `alternative_approaches`

Puede mostrar otras rutas cuando sean realmente diferentes y útiles para decidir.

Ejemplo:

```text
Approach A
→ ordenar y evaluar portfolio existente

Approach B
→ abrir nueva convocatoria de ideas
```

Debe explicar brevemente:

- qué resuelve mejor cada ruta;
- qué supuesto cambia;
- por qué una parece preferible con la información actual.

No convertir el handoff en consultoría exhaustiva.

---

# 18. `known_context`

Debe mostrar lo que ya sabemos y es material.

Puede incluir:

- operating context;
- success conditions;
- quality guardrails;
- restricciones;
- solución/iniciativa existente;
- portfolio size;
- audiencias relevantes.

Debe preservar provenance.

---

# 19. `unresolved_context`

Muestra qué sigue siendo incierto.

No debe presentarse como error.

Ejemplo:

> Todavía no está claro qué señal mínima justificaría continuar.

Si el usuario eligió no profundizar, Starteria debe respetarlo.

---

# 20. `GapResolutionMap`

Los gaps no deben mostrarse únicamente como “información faltante”.

Starteria debe poder expresar si puede ayudar a estructurarlos, guiarlos, seguirlos o si requieren información externa.

Estructura conceptual:

```text
GapResolution
├── gap_description
├── resolution_type
├── starteria_capability
├── resolution_stage
└── note
```

### `resolution_type`

- `STARTERIA_CAN_STRUCTURE`
- `STARTERIA_CAN_GUIDE`
- `STARTERIA_CAN_TRACK`
- `REQUIRES_ORGANIZATIONAL_INPUT`
- `REQUIRES_EXTERNAL_EVIDENCE`
- `OUT_OF_SCOPE`

### `resolution_stage`

- `PORTFOLIO`
- `INITIATIVE_SETUP`
- `STEP_0`
- `STEP_1`
- `STEP_2`
- `STEP_3`
- `STEP_4`
- `EXTERNAL`

---

# 21. Regla de mapping de gaps

Ejemplo:

```text
Gap:
No está claro cómo medir contribución de una iniciativa.

resolution_type:
STARTERIA_CAN_STRUCTURE

starteria_capability:
Ayudar a conectar iniciativa, señal y criterio de seguimiento.

resolution_stage:
INITIATIVE_SETUP / STEP correspondiente
```

Ejemplo:

```text
Gap:
No existe validación regulatoria externa.

resolution_type:
REQUIRES_EXTERNAL_EVIDENCE

starteria_capability:
Registrar, hacer visible y conectar esa evidencia con la decisión.

resolution_stage:
EXTERNAL + STEP correspondiente
```

Starteria no debe afirmar que puede producir por sí misma evidencia que depende del mercado, clientes, expertos o reguladores.

---

# 22. `evidence_or_clarity_needed`

Debe expresar **qué necesita quedar claro o demostrarse**, sin diseñar todavía el método completo.

Permitido:

> Necesitas demostrar que la iniciativa reduce esfuerzo sin degradar precisión.

No permitido:

> Haz 10 pruebas manuales y 10 automatizadas y compara tiempos.

Permitido:

> Necesitas una señal real de intención de compra.

No permitido:

> Lanza una landing y usa 5% de conversión como threshold.

---

# 23. `starteria_path`

Debe mostrar cómo Starteria convertiría la necesidad en trabajo gestionable.

Estructura conceptual:

```text
starteria_path
├── structure
├── make_visible
├── compare_or_follow
├── resolve_gaps
└── prepare_decision
```

Ejemplo:

```text
1. Estructurar las iniciativas y el objetivo que intentan mover.
2. Hacer visible qué contexto, evidencia y restricciones tiene cada una.
3. Identificar gaps que deben aclararse o demostrarse.
4. Resolver o acompañar esos gaps en el nivel adecuado de Portfolio, Initiative o Steps.
5. Preparar decisiones de continuar, iterar, pausar, detener o escalar.
```

---

# 24. `recommended_cta`

Debe conectar directamente con el job y con la ruta recomendada.

Ejemplos:

```text
Estructurar mi portfolio
```

```text
Definir cómo gobernar mis iniciativas
```

```text
Preparar esta iniciativa para decisión
```

```text
Explorar cómo implementar mi programa
```

No usar un CTA genérico si el contexto permite uno específico.

---

# 25. Caso de uso: aceleradoras y programas de innovación

La regla contractual correcta es:

> Starteria no debe asumir que el usuario necesita crear una aceleradora. Pero si esa es realmente su necesidad, puede ayudarle a estructurar y operar la lógica con la que esa aceleradora convierte oportunidades en iniciativas, evidencia y decisiones.

## 25.1. Si la aceleradora ya existe

Preservar:

```text
existing_program_or_process = existing
```

Starteria puede ayudar a:

- clarificar criterios de entrada;
- estructurar portfolio;
- definir ownership;
- hacer visibles KPIs/señales;
- seguir evidencia;
- gobernar progresión;
- preparar decisiones.

No decir:

> Vamos a crear una aceleradora.

## 25.2. Si la aceleradora todavía se quiere crear

Preservar:

```text
desired_program_or_process = accelerator
```

Starteria puede proponer un camino para estructurar:

```text
objetivos
→ criterios
→ iniciativas
→ ownership
→ seguimiento
→ evidencia
→ decisiones
```

No implica crear automáticamente una entidad canónica llamada Accelerator.

---

# 26. Forma del camino vs profundidad del camino

Portfolio Entry puede mostrar:

> cómo podría abordarse.

Pero la profundidad debe ocurrir dentro de Starteria.

Principio:

```text
Portfolio Entry
→ muestra la forma del camino

Starteria workspace / initiatives / steps
→ desarrolla la profundidad del camino
```

Esto evita que la entrada se convierta en una consultoría completa antes de que el usuario continúe.

---

# 27. Regla de propuesta de valor

El handoff debe hacer visible que Starteria no solo aconseja.

Starteria ayuda a:

```text
estructurar
↓
hacer visible
↓
guiar o resolver gaps
↓
comparar / seguir
↓
preparar decisiones
```

No prometer:

- éxito;
- ROI;
- viabilidad;
- aprobación;
- evidencia externa inexistente.

---

# 28. Provenance visible

Cuando sea material, el handoff debe distinguir conceptualmente:

```text
Lo que dijiste
Lo que Starteria interpretó
Lo que Starteria recomienda
Lo que todavía falta confirmar
```

No es obligatorio mostrar etiquetas técnicas.

Sí es obligatorio preservar su separación lógica.

---

# 29. Frontera con canonicalización

El handoff sigue siendo provisional.

No crea:

- Organization;
- StrategicFront;
- Challenge;
- Initiative;
- Project;
- Step;
- Decision;
- Accelerator canónica.

El CTA puede iniciar posteriormente un flujo de workspace/context confirmation.

---

# 30. Frontera con Step 0 / Step 2

Portfolio Entry puede mostrar:

```text
qué necesita aclararse
qué necesita demostrarse
en qué parte de Starteria podría trabajarse
```

pero no debe:

- formular hipótesis completas;
- diseñar experimentos detallados;
- definir evidence plan completo;
- crear success criteria canónicos;
- definir gates;
- ejecutar cycle.

Si la conversación llega a ese nivel:

```text
stop_reason = step_boundary
```

---

# 31. Handoff con incertidumbre

Si Quick Clarification termina y el usuario no quiere Guided Exploration:

```text
handoff_status = ready_with_uncertainty
```

Debe mostrar:

```text
Lo que entendí
Lo que parece más razonable hacer
Lo que todavía no está claro
Qué puede ayudarte a resolver Starteria
```

No ocultar gaps.

---

# 32. Handoff insuficiente

Si incluso después de explorar no existe base suficiente:

```text
handoff_status = insufficient_input
```

La experiencia debe:

- explicar qué falta;
- ofrecer reformulación;
- mostrar posibles marcos de exploración sin fingir precisión;
- no canonicalizar automáticamente.

---

# 33. Casos mínimos de aceptación

Los siguientes son ejemplos normativos del contrato, no evidencia de testing.

### Caso A — suficiente desde el inicio

Input:

> Tengo 18 iniciativas y necesito saber cuáles están alineadas con tres prioridades ya definidas.

Esperado:

```text
quick_questions_asked = 0 o 1
handoff_ready = true
```

---

### Caso B — usuario todavía ambiguo

Input:

> Dirección quiere que innovemos más pero no tengo claro por dónde empezar.

Después de Quick Clarification todavía existe ambigüedad.

Esperado:

```text
clarification_status = exploration_offered
```

Starteria ofrece:

- ruta provisional;
- Guided Exploration;
- reformulación.

No fuerza handoff ni sigue preguntando silenciosamente.

---

### Caso C — Guided Exploration

El usuario elige:

> Explorar un poco más.

Esperado:

- nuevo Question Plan;
- máximo 0–1 pregunta user-facing por turno;
- propósito visible;
- síntesis al final;
- opción de continuar o avanzar.

---

### Caso D — alternativa de abordaje

Input:

> Queremos lanzar un nuevo programa de ideación porque necesitamos innovar más, pero ya tenemos muchas iniciativas dispersas.

Esperado:

Starteria puede sugerir:

> Antes de generar más ideas, parece razonable ordenar primero las iniciativas existentes y detectar gaps reales.

Debe quedar marcado como propuesta, no como verdad.

---

### Caso E — gaps conectados a producto

Input:

> Tenemos iniciativas pero no sabemos qué evidencia debería justificar que sigan.

Handoff puede mostrar:

```text
Gap:
criterios/evidencia de continuidad

Starteria:
puede ayudar a estructurar y seguir ese criterio

Stage:
Initiative / Steps
```

No diseñar todavía el experimento.

---

### Caso F — aceleradora existente

Input:

> Ya tenemos una aceleradora interna pero necesitamos mejorar cómo las ideas avanzan y reciben presupuesto.

Esperado:

- preservar que ya existe;
- Starteria puede ayudar a estructurar gobernanza, portfolio, KPIs/señales, evidencia y decisiones;
- no decir que creará la aceleradora.

---

### Caso G — aceleradora deseada

Input:

> Queremos implementar una aceleradora corporativa pero no sabemos cómo estructurarla.

Esperado:

- reconocer que la aceleradora todavía es deseada;
- proponer una forma de estructurar su lógica de operación;
- mostrar qué parte puede desarrollarse dentro de Starteria;
- no crear una entidad canónica Accelerator automáticamente.

---

### Caso H — Step boundary

Input:

> ¿Qué muestra y threshold deberíamos usar para validar este piloto?

Esperado:

- reconocer que es trabajo posterior;
- mapear el gap al stage correspondiente;
- no diseñar el experimento completo desde Portfolio Entry.

---

# 34. Hard failures

Considerar FAIL si ocurre cualquiera:

### HF-CH-01
Se hace una cuarta pregunta dentro de Quick Clarification sin ofrecer cambio de modo.

### HF-CH-02
Guided Exploration se activa sin consentimiento explícito.

### HF-CH-03
Se encadenan rondas de exploración sin síntesis/punto de control.

### HF-CH-04
Se crea objeto canónico.

### HF-CH-05
Se activa Step.

### HF-CH-06
Se diseña experimento/piloto detallado desde Portfolio Entry.

### HF-CH-07
Una sugerencia IA se presenta como hecho declarado.

### HF-CH-08
El handoff pierde una corrección explícita del usuario.

### HF-CH-09
Starteria afirma poder producir evidencia que requiere organización, mercado, cliente, experto o regulador.

### HF-CH-10
Se afirma que Starteria “creará” una estructura organizacional sin distinguir diseño/operación de canonicalización o ejecución organizacional real.

---

# 35. Métricas para Harness v0.2

Medir:

```text
quick_questions_total
quick_budget_respected
guided_exploration_offered_when_needed
guided_exploration_opt_in
exploration_rounds
questions_per_exploration_round
turns_to_first_useful_synthesis
turns_to_handoff
initial_entry_state_stability
current_frame_evolution
context_fidelity
provenance_fidelity
recommended_approach_quality
alternative_approach_relevance
gap_resolution_accuracy
starteria_value_visibility
cta_relevance
step_leakage
generic_chat_feeling
```

---

# 36. Revisión humana

La revisión humana debe evaluar:

### Understanding quality

¿Representa realmente lo que el usuario quiso decir?

### Clarity gained

¿El usuario obtiene más claridad aunque llegara con un problema ambiguo?

### Question efficiency

¿Las preguntas fueron necesarias?

### Recommendation quality

¿La ruta recomendada es útil, explícitamente provisional y coherente con lo declarado?

### Gap-resolution honesty

¿Starteria distingue lo que puede estructurar/seguir de lo que requiere evidencia o input externo?

### Product value visibility

¿Queda claro qué podrá hacer el usuario dentro de Starteria?

### Generic-chat feeling

¿La salida se siente como entrada a un sistema de trabajo o solo como consejo?

---

# 37. Decisiones reservadas para testing

No congelar todavía:

- cantidad máxima de rondas de Guided Exploration;
- wording exacto del cambio de modo;
- número de alternativas a mostrar;
- detalle visible del GapResolutionMap;
- mapping definitivo entre gaps y Steps;
- layout del handoff;
- copy exacto del CTA;
- persistencia productiva;
- modelo IA.

---

# 38. Definition of Done

Antes de pasar a Harness v0.2:

- [ ] Quick Clarification aceptado;
- [ ] budget de hasta 3 preguntas rápidas aceptado;
- [ ] Guided Exploration opt-in aceptado;
- [ ] segundo checkpoint después de Guided Exploration aceptado;
- [ ] Guided Exploration tiene una única ronda y máximo 2 preguntas;
- [ ] una sola active question por turno;
- [ ] answer identity 0..1 y separación entre pregunta respondida y gap resuelto;
- [ ] `answered_gaps` contiene solo gaps resueltos;
- [ ] no existe fallback histórico para active question;
- [ ] cada respuesta converge a nueva pregunta, checkpoint o stop técnico/de seguridad;
- [ ] recommended approach aceptado;
- [ ] alternative approaches aceptado;
- [ ] GapResolutionMap aceptado;
- [ ] caso de aceleradora existente/deseada aceptado;
- [ ] forma del camino vs profundidad aceptada;
- [ ] frontera con canonicalización aceptada;
- [ ] frontera con Steps aceptada;
- [ ] métricas de Harness actualizadas.

---

# 39. Principio final

> Starteria no debe exigir que el usuario llegue con claridad; debe ayudarle a construirla sin atraparlo en una conversación infinita.

Y:

> La entrada muestra una forma razonable de avanzar y qué puede resolverse dentro de Starteria; la plataforma desarrolla la profundidad de ese camino.

## Guided Exploration convergence amendment

For this slice: Quick Clarification is limited to 0..3 user-facing questions; Guided Exploration is one explicit round limited to 0..2 additional questions; total questions before proposal is 0..5. Normal Guided completion converges to a second checkpoint exposing only `Ver mi propuesta de abordaje`; it never offers another Guided Exploration opt-in.

## `reason_to_ask` authority addendum (ADR-007)

For the narrow meaning and exposure boundary of `reason_to_ask`, apply accepted product [ADR-007](../../../doc/product-adr/ADR-007-portfolio-entry-reason-to-ask-public-explanation.md) and its [v0.1 exposure contract](PORTFOLIO_ENTRY_REASON_TO_ASK_EXPOSURE_CONTRACT_v0.1.md). It is a short public explanation for the active question, not model selection rationale. This citation does not promote this proposed v0.2.1 contract or its other clauses.
