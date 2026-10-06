# PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1

**Referencia:** KAN-114A — Portfolio Entry Critical Reasoning Experience Contract (referencia local; no se encontró una HU Jira con esa clave)
**Estado:** FROZEN FOR IMPLEMENTATION PLANNING — revisión cerrada el 2026-10-06
**Superficie:** Public Portfolio Entry
**Tipo:** Experience / Reasoning Contract
**Implementación runtime autorizada por este documento:** NO
**Objetivo:** congelar el comportamiento cognitivo y user-facing previo a implementar Skills, UI o runtime.

---

# 0. Autoridad y relación contractual

Este contrato define, dentro de Portfolio Entry, cómo convertir el contexto disponible y las aclaraciones en una lectura crítica provisional para el usuario.

Está subordinado a:

1. `docs/STARTERIA_AUTHORITY.md`
2. Core v0.2 factual vigente: `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`
3. ADRs de producto aprobados
4. `doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`, único Experience Logic Contract activo para Pantalla 1

La relación de autoridad para este alcance es:

```text
Core v0.2 + ADRs aprobados
        ↓
Portfolio Entry Logic Contract v0.1
        ↓
Este contrato acotado de Critical Reasoning
        ↓
futura planificación de Skills / Tech Specs / schemas / tests / implementación
```

El contrato de Clarification + Handoff v0.2.1 y el Agent / Skills / Harness v0.2 son referencias candidatas, no autoridad aprobada. Este contrato no los promueve ni importa sus decisiones particulares de presupuesto, stopping rules o handoff. Se aplican únicamente las reglas ya aprobadas por las fuentes superiores.

La aprobación congela solo esta definición de experiencia y razonamiento. No redefine Core, Steps, provenance vigente, permisos, entidades canónicas ni el contrato general de Portfolio Entry.

```text
CONFLICT
Contract: PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md §22 / docs/STARTERIA_AUTHORITY.md §4
Requirement: La autoridad activa y los outputs de Portfolio Entry deben seguir la jerarquía declarada en el Authority Map.
Current document/code: El Logic Contract v0.1 delega recommended_approach, unresolved_context, gap_resolution_map, starteria_path y recommended_cta al Clarification + Handoff v0.2.1; el Authority Map clasifica ese contrato v0.2.1 como candidato no promovido.
Observed mismatch: La fuente activa referencia como gobernante un artefacto que el Authority Map mantiene fuera de la cadena de autoridad.
Risk: Una implementación podría adoptar accidentalmente semántica candidata como comportamiento aprobado.
Recommended treatment: KEEP el v0.2.1 como candidato y resolver la delegación / mapeo de outputs mediante una decisión funcional explícita antes de implementar esos outputs.
Requires ADR: no, salvo que la resolución cambie semántica de Core o de producto protegida por ADR.
```

Este conflicto queda fuera del alcance congelado aquí. Este documento no resuelve la delegación ni redefine esos outputs.

---

# 1. Problema que resuelve

El contrato activo de Portfolio Entry ya define captura provisional de contexto,
clasificación y extracción con provenance, preservación de ambigüedades, hasta
tres preguntas secuenciales y handoff sin canonicalización.

El candidato Clarification + Handoff v0.2.1 también describe outputs como
`recommended_approach`, `unresolved_context`, `gap_resolution_map`,
`starteria_path` y `recommended_cta`; por el conflicto de autoridad de §0,
este documento no trata esas definiciones como autoridad aprobada.

El problema de experiencia y razonamiento es que esa capacidad puede degradarse a:

```text
usuario aporta contexto
→ Starteria pregunta
→ Starteria devuelve un resumen mejor redactado
```

Eso no es suficiente.

Portfolio Entry debe producir:

```text
contexto
→ comprensión
→ tensión relevante
→ decisión a preparar
→ incertidumbres que importan
→ primer movimiento razonable
→ continuidad explícita hacia Starteria
```

El valor no está en repetir lo dicho.

El valor está en **reducir el espacio de decisión sin fingir certeza**.

---

# 2. Principio central

Portfolio Entry debe mover al usuario desde:

> “Tengo información, trabajo o problemas abiertos y no sé bien qué hacer con ellos.”

hacia:

> “Entiendo mejor qué hace difícil mi situación, qué decisión necesito preparar, con qué puedo avanzar ya, qué incertidumbres realmente importan y cuál sería un primer movimiento razonable.”

Portfolio Entry no necesita resolver completamente la situación.

Debe producir:

```text
Insight
↓
Decision
↓
Action
↓
Continuity
```

## 2.1. Quality gates

Un handoff útil debe poder responder:

### Insight
¿La lectura hace explícita una tensión, relación o estructura que antes estaba dispersa?

### Decision
¿Está más claro qué decisión necesita prepararse?

### Action
¿Existe un primer movimiento contextual y razonable?

### Continuity
¿Se entiende cómo Starteria desarrollará el trabajo después?

Si alguno falta materialmente, el output no debe considerarse plenamente logrado.

---

# 3. Copilot de entrada ≠ producto completo

Portfolio Entry Copilot es una capacidad de Starteria.

No es Starteria completo.

La experiencia debe mantener esta percepción durante todo el recorrido.

## 3.1. Durante aclaración

La UI debe comunicar de forma sutil que el Copilot está:

- entendiendo;
- aclarando;
- sintetizando;
- orientando.

No debe dar la impresión de que ya está:

- ejecutando el trabajo;
- creando un portfolio;
- priorizando canónicamente;
- ejecutando Steps;
- tomando decisiones;
- completando todo el producto.

Framing conceptual permitido:

> Starteria te está ayudando a aclarar el punto de partida.

> El trabajo en profundidad continúa dentro de Starteria cuando decides avanzar.

No es obligatorio usar este copy literal.

Sí es obligatoria esta semántica.

## 3.2. En la conclusión

La separación debe volverse explícita:

```text
Lo que hizo el Copilot
→ entender
→ aclarar
→ detectar tensión
→ encuadrar decisión
→ proponer primer movimiento

Lo que Starteria desarrolla después
→ estructurar
→ conectar trabajo y objetivo
→ hacer visible evidencia y gaps
→ acompañar aprendizaje
→ preparar decisiones
```

---

# 4. Prohibición de framing taxonómico user-facing

Las taxonomías internas pueden existir para routing, reasoning, clasificación y ejecución.

No pueden ser la lectura principal del usuario.

## 4.1. Prohibido como síntesis principal

Ejemplos:

```text
Portafolio: entendí que...
Iniciativa: entendí que...
Estrategia: entendí que...
```

```text
primary_intent = portfolio_governance
current_frame = initiative
```

```text
Portfolio
Initiative
Strategy
```

si se presentan como forma principal de “lo que Starteria entendió”.

## 4.2. Permitido

Una síntesis natural e integrada:

> Quieres reducir churn en SMB y utilizar este trimestre para entender dónde merece la pena concentrar el siguiente esfuerzo. Ya existen varias iniciativas relacionadas, pero todavía no está claro cuáles pueden generar evidencia útil a tiempo para apoyar esa decisión.

La taxonomía sirve al sistema.

El usuario no debe tener que pensar con la taxonomía interna del sistema.

---

# 5. Live Understanding durante la conversación

Durante Quick Clarification y Guided Exploration debe existir una comprensión viva visible.

User-facing label recomendado:

```text
Esto estoy entendiendo
```

## 5.1. Reglas

La síntesis debe:

- estar en lenguaje natural;
- integrar información material previa;
- evolucionar después de respuestas útiles;
- distinguir implícitamente lo entendido de lo incierto;
- no inventar causalidad;
- no copiar toda la conversación;
- no convertirse en lista de campos;
- no mostrar taxonomía interna;
- no presentar recomendaciones como hechos.

## 5.2. Loop perceptual

La experiencia debe sentirse así:

```text
RESPONDO
↓
STARTERIA ENTIENDE ALGO NUEVO
↓
LA LECTURA CAMBIA
↓
LA SIGUIENTE PREGUNTA TIENE UNA RAZÓN
```

No:

```text
RESPONDO
↓
OTRA PREGUNTA
↓
OTRA PREGUNTA
```

---

# 6. Modelo provisional de situación

El motor puede mantener internamente un `SituationModel`.

No es una nueva entidad canónica.

Es una proyección cognitiva provisional.

```text
SituationModel
├── desired_change
├── current_situation
├── existing_work_or_assets
├── decision_to_enable
├── known_evidence
├── constraints
├── actors_and_authority
├── dependencies
├── uncertainties
├── time_pressure
├── existing_alternatives
└── material_tensions
```

No todos los campos deben existir en todos los casos.

No todos deben mostrarse al usuario.

---

# 7. Lentes adaptativas de razonamiento

El Copilot no debe aplicar un framework único a todas las situaciones.

Puede activar una o varias lentes según contexto:

| Lente | Pregunta crítica |
|---|---|
| Prioridad / allocation | ¿Dónde merece concentrarse tiempo, capacidad o presupuesto? |
| Diagnóstico | ¿Qué explica realmente el problema observado? |
| Evidencia / aprendizaje | ¿Qué sabemos y qué podría cambiar la decisión? |
| Secuencia | ¿Qué debe ocurrir antes que qué? |
| Dependencias | ¿Qué bloquea realmente el avance? |
| Gobernanza | ¿Quién decide, con qué criterio y cuándo? |
| Capacidad | ¿Qué puede ejecutarse realmente con los recursos actuales? |
| Riesgo | ¿Qué podría invalidar o encarecer el siguiente movimiento? |
| Alineamiento | ¿Qué trabajo contribuye realmente al objetivo? |
| Diseño de sistema | ¿Qué estructura todavía no existe y necesita construirse? |

Las lentes son internas.

No deben aparecer como taxonomía obligatoria para el usuario.

---

# 8. Material Decision Impact Test

Una pregunta solo debe consumir un slot de Quick Clarification si su respuesta podría cambiar materialmente al menos uno de estos elementos:

- la lectura de la situación;
- la decisión a preparar;
- la tensión principal;
- el primer movimiento;
- una dependencia crítica;
- un riesgo material;
- la ruta dentro de Starteria;
- la posibilidad de actuar ya.

Regla de decisión:

```text
¿La respuesta puede cambiar materialmente al menos uno de los elementos anteriores?
├── no → no preguntar
└── sí → candidata válida
```

El primer movimiento es uno de los elementos posibles, no la única prueba de impacto. Esta regla no cambia el presupuesto ni los stopping rules definidos por contratos aprobados.

---

# 9. Tensión material

El motor debe buscar qué hace difícil la decisión.

No debe limitarse a categorizar el caso.

Ejemplo:

```text
más churn conocido ocurre tarde
VS
puedo aprender más rápido actuando temprano
VS
dirección exige avance trimestral
VS
hay varias iniciativas compitiendo por recursos
```

La tensión puede involucrar:

- horizontes temporales;
- impacto vs aprendizaje;
- urgencia vs evidencia;
- ejecución vs dependencia;
- autonomía vs autoridad;
- oportunidad vs riesgo;
- capacidad vs demanda;
- corto vs largo plazo.

No es obligatorio que siempre exista una tensión clara.

Si no existe soporte suficiente:

```text
material_tension = unresolved
```

No fabricar un insight.

---

# 10. Actuar para aprender vs aprender para actuar

El motor no debe asumir:

```text
falta información
→ investigar
→ actuar después
```

Antes debe evaluar:

```text
¿Existe trabajo, evidencia o una acción en marcha
que pueda ayudar a resolver esta incertidumbre?
```

Clasificación conceptual:

### CAN_ACT_NOW
Existe suficiente contexto para avanzar.

### CAN_LEARN_BY_ACTING
Una acción existente o reversible puede producir aprendizaje relevante.

### NEEDS_CLARITY_BEFORE_ACTION
La falta de información bloquea materialmente el avance.

### REQUIRES_ORGANIZATIONAL_INPUT
Depende de autoridad o contexto organizacional.

### REQUIRES_EXTERNAL_EVIDENCE
Depende de mercado, cliente, experto, regulador u otra fuente externa.

---

# 11. Incertidumbres que cambian decisiones

No todo gap merece atención.

Cada incertidumbre material debe responder:

```text
qué no sabemos
+
por qué importa
```

Estructura conceptual:

```text
DecisionChangingUnknown
├── uncertainty
├── why_it_matters
├── current_evidence
├── resolution_mode
└── related_decision
```

Ejemplo:

> Todavía no sabemos si churn temprano y tardío comparten causas. Esto importa porque podría cambiar qué iniciativas merece la pena priorizar.

No mostrar gaps como errores.

---

# 12. Aprovechar primero trabajo y evidencia existente

Antes de proponer nueva investigación o nuevo trabajo, Starteria debe revisar, dentro de esta sesión:

- iniciativas existentes;
- pilotos;
- experimentos ya activos;
- documentos;
- señales;
- procesos actuales;
- decisiones anteriores;
- restricciones conocidas;
- datos existentes;
- aprendizajes previos.

Principio:

> No crear nuevo trabajo si el trabajo existente puede producir la claridad necesaria.

Solo cuenta la información que el usuario aportó en la sesión o que ya está disponible mediante un contexto explícitamente autorizado para esta experiencia. Portfolio Entry no inicia búsquedas web, consultas a sistemas conectados ni lecturas de datos organizacionales. Si una fuente no está disponible, se conserva como desconocida y no se afirma que Starteria la haya comprobado.

---

# 13. Primer movimiento recomendado

El output debe incluir, cuando exista suficiente contexto, un `recommended_first_movement`.

No es una entidad canónica.

Es una proyección del handoff.

Este concepto no renombra, reemplaza ni sobrescribe ningún campo gobernado por el Portfolio Entry Logic Contract o por un ADR. La futura especificación de implementación deberá declarar el mapeo a los outputs de handoff que tengan autoridad vigente; este contrato no adopta por sí solo el mapeo del Clarification + Handoff v0.2.1 candidato.

```text
RecommendedFirstMovement
├── movement
├── why_now
├── existing_assets_used[]
├── what_it_may_clarify
├── decision_supported
└── boundary
```

## 13.1. Reglas

Debe:

- ser específico al caso;
- aprovechar contexto real;
- explicar por qué ahora;
- indicar qué puede aclarar;
- conectar con una decisión;
- mantenerse provisional.

No debe:

- definir scoring definitivo;
- definir thresholds sin autoridad;
- diseñar experimento completo;
- asignar presupuesto;
- priorizar canónicamente;
- crear entities;
- ejecutar Steps.

---

# 14. Alternativas

El motor debe comprobar si existe una ruta alternativa materialmente distinta que encaje mejor con los datos disponibles.

Solo debe mostrar una alternativa cuando sea materialmente diferente y útil.

La presentación puede explicar la suposición que cambia y el trade-off relevante. No expone deliberación privada, chain-of-thought, scores internos ni trazas del modelo.

Conceptualmente:

```text
AlternativeMovement
├── movement
├── when_it_makes_more_sense
├── assumption_that_changes
└── tradeoff
```

No mostrar alternativas cosméticas.

---

# 15. CriticalEntryReading

Output conceptual del reasoning engine:

```text
CriticalEntryReading
├── desired_change
├── situation_insight
├── decision_to_enable
├── usable_now[]
├── decision_changing_unknowns[]
│   ├── uncertainty
│   └── why_it_matters
├── recommended_first_movement
│   ├── movement
│   ├── why_now
│   ├── existing_assets_used[]
│   └── expected_clarity
├── alternative_movement?
├── starteria_continuation
│   ├── structure
│   ├── make_visible
│   ├── resolve_or_guide
│   ├── follow
│   └── prepare_decision
├── uncertainty_statement
└── provenance
```

Este contrato no exige todavía crear una tabla, schema persistente o entity con este nombre.

La lectura es una proyección provisional adicional y no reemplaza el input, el análisis, los campos ni las reglas de confirmación del Experience Logic Contract activo. La implementación futura puede mapearla sobre estructuras existentes si preserva ambas semánticas y documenta el mapeo bajo autoridad aprobada.

---

# 16. Presentación user-facing del output

La conclusión debe poder representarse con estos bloques:

## 1. Lo que quieres conseguir

Dirección / cambio buscado.

## 2. Lo que cambia cómo vemos tu situación

Insight, tensión o relación material.

Si no existe soporte suficiente:

> Todavía no hay base suficiente para distinguir qué explicación pesa más.

No inventar.

## 3. La decisión que necesitas preparar

Decisión real, no simplificación artificial.

## 4. Con qué podemos avanzar ya

Contexto, activos, trabajo o evidencia que ya puede utilizarse.

## 5. Lo que todavía puede cambiar la decisión

Cada item:

```text
incertidumbre
+
por qué importa
```

## 6. Primer movimiento recomendado

Qué hacer primero y por qué.

## 7. Otra ruta posible

Solo si es material.

## 8. Así continuaría dentro de Starteria

Forma del camino, no profundidad completa.

---

# 17. Starteria Continuation

Debe mostrar explícitamente que el Copilot prepara el punto de partida y Starteria desarrolla el trabajo.

```text
starteria_continuation
├── structure
├── make_visible
├── resolve_or_guide
├── follow
└── prepare_decision
```

Ejemplo conceptual:

```text
Estructurar objetivo e iniciativas
↓
hacer visible evidencia, restricciones y gaps
↓
resolver o acompañar lo que realmente cambia una decisión
↓
seguir aprendizaje y avance
↓
preparar siguiente decisión
```

---

# 18. Frontera con Portfolio Setup

Portfolio Entry entrega:

- dirección;
- tensión;
- decisión;
- contexto usable;
- incertidumbres;
- primer movimiento.

Portfolio Setup puede profundizar en:

- baseline;
- métricas;
- objetivos organizacionales;
- iniciativas reales;
- ownership;
- restricciones;
- capacidad;
- evidencia real.

Portfolio Setup debe complementar la lectura confirmada.

No debe tratarla como si no existiera.

Esta lista es orientativa y queda subordinada al contrato vigente de Portfolio Setup. No autoriza nuevas fuentes, integraciones, permisos ni lecturas automáticas.

---

# 19. Provenance y certeza

El motor debe preservar al menos:

### FACT
Respaldado directamente por usuario o fuente válida.

### INTERPRETATION
Lectura razonable del contexto.

### PROPOSAL
Movimiento sugerido por Starteria.

La UI puede expresarlo con lenguaje natural:

```text
Sabemos...
Parece que...
Por eso propondría...
```

No es obligatorio mostrar badges técnicos.

Sí es obligatorio preservar la separación semántica.

FACT / INTERPRETATION / PROPOSAL son clases conceptuales para expresar una lectura; no sustituyen las dimensiones de provenance ya aprobadas por Portfolio Entry:

- origin: `USER_DECLARED`, `EXTRACTED_FROM_USER_TEXT`, `AI_INFERRED` o `AI_SUGGESTED`;
- review disposition: `UNREVIEWED`, `USER_CONFIRMED`, `USER_REJECTED` o `SUPERSEDED`.

La lectura crítica queda `UNREVIEWED` por defecto. Una interpretación o propuesta nunca pasa a `USER_CONFIRMED` sin una acción explícita de la persona. Si una afirmación no puede conservar su origin y review disposition, se mantiene provisional y no se presenta como hecho confirmado.

---

# 20. No insight > fake insight

Starteria no debe buscar una conclusión ingeniosa a toda costa.

Si no hay soporte suficiente:

```text
NO INSIGHT
>
FAKE INSIGHT
```

Debe poder decir:

> Todavía no tengo base suficiente para distinguir entre estas dos explicaciones.

---

# 21. Guardrails

Portfolio Entry nunca debe:

- inventar causalidad;
- convertir correlación en driver;
- introducir criterios universales sin soporte;
- recomendar investigación por defecto;
- crear trabajo nuevo si lo existente puede producir aprendizaje suficiente;
- confundir inferencia con hecho;
- priorizar definitivamente por el usuario;
- definir thresholds sin autoridad;
- diseñar experimentos completos;
- definir gates;
- entrar en Steps;
- ocultar incertidumbre;
- prometer éxito;
- convertir Entry en consultoría exhaustiva;
- convertir Copilot en “todo Starteria”;
- canonicalizar automáticamente.

---

# 22. Casos de adaptabilidad

## A. Portfolio congestionado

Contexto:
varias iniciativas compiten por atención.

Lentes probables:

```text
priority
evidence
learning
capacity
```

Output posible:

> comparar trabajo existente antes de abrir nuevas iniciativas.

No es una regla universal.

## B. Programa de innovación existente

Lentes:

```text
governance
flow
decision-rights
evidence
```

Insight posible:

> el problema puede estar menos en generar ideas y más en cómo pasan de evaluación a ownership y decisión.

## C. Tecnología ya comprada

Lentes:

```text
outcome
evidence
investment-decision
```

Insight posible:

> antes de optimizar la solución, puede ser necesario aclarar qué resultado justificaría seguir invirtiendo.

## D. Iniciativa bloqueada

Lentes:

```text
dependencies
authority
execution
```

Insight posible:

> continuar tareas puede no reducir el riesgo principal si la siguiente decisión depende de un tercero.

## E. Ambigüedad estratégica

Lentes:

```text
strategic-ambiguity
existing-work
portfolio
```

Si ya existe mucho trabajo:

> no asumir que hacen falta más ideas.

Si no existe estructura:

> puede ser razonable estructurar un mecanismo de entrada.

---

# 23. Acceptance contract de KAN-114A

KAN-114A queda satisfecho cuando existe un contrato que obliga a que futuras implementaciones:

1. prohíban framing taxonómico como síntesis principal;
2. produzcan Live Understanding natural;
3. actualicen la lectura después de respuestas materiales;
4. usen Material Decision Impact Test para gobernar preguntas futuras;
5. construyan Situation Model provisional;
6. detecten tensión material sin inventarla;
7. distingan contexto usable de incertidumbre decisional;
8. evalúen actuar para aprender antes de abrir research nuevo;
9. produzcan recommended first movement cuando haya soporte;
10. mantengan provenance FACT / INTERPRETATION / PROPOSAL;
11. expliquen Starteria Continuation;
12. preserven la frontera con Portfolio Setup, Core y Steps;
13. mantengan Copilot de entrada claramente como parte de Starteria y no como todo el producto.

---

# 24. Límite de la autorización

El freeze de este contrato NO autoriza:

- cambiar runtime;
- añadir Skill 05;
- añadir Skill 06;
- cambiar prompts;
- cambiar schemas;
- cambiar frontend;
- cambiar backend;
- cambiar Portfolio Setup;
- cambiar Core;
- cambiar Steps.

Es una decisión de experiencia y razonamiento, no una autorización técnica. El Authority Map, Manifest y CURRENT_STATE pueden registrar este alcance y su estado; ese registro no certifica ni autoriza una implementación.

Una implementación posterior requiere una HU Jira válida, alcance técnico explícito y los guardrails/checks de su propia subtarea.

---

# 25. Próxima fase

La siguiente fase propuesta es:

```text
KAN-114B
Critical Situation Synthesis Skill
```

`KAN-114B` es una etiqueta de planificación local, no una HU Jira verificada. No autoriza trabajo técnico hasta que exista una subtarea Jira válida y una autorización separada.

Objetivo:

```text
Session context
→ Situation Model
→ Material Tensions
→ Decision Frame
→ Usable Now
→ Decision-changing Unknowns
→ Candidate First Movement
```

con fixtures variados y evaluación antes de tocar UI.
