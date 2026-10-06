# Starteria — Skill Contract: entry-05-critical-situation-synthesis

**Documento:** `SKILL_v0.1.md`<br>
**Skill ID:** `entry-05-critical-situation-synthesis`<br>
**Versión:** v0.1<br>
**Estado:** DRAFT FOR REVIEW — CONTRACT + TEST DESIGN ONLY<br>
**HU:** KAN-114 — Portfolio Entry — Critical Situation Synthesis<br>
**Tipo:** Skill Contract<br>
**Fase:** Diseño conceptual; sin runtime<br>
**Autoridad funcional:** subordinada a Core v0.2, ADRs aceptados aplicables, Portfolio Entry Logic v0.1 y Critical Reasoning Experience Contract v0.1.

Este documento define el comportamiento conceptual que deberá demostrar una implementación futura. No aprueba ni implementa runtime, prompts, schemas, UI, backend, Portfolio Setup, Steps ni cambios de Core. Su estado no promueve otros documentos.

## 1. Autoridad y referencias

Aplicar en este orden:

1. [Starteria Authority](../../../../STARTERIA_AUTHORITY.md).
2. [Core Contract v0.2](../../../../../doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md), factual vigente, `Base fundacional revisada / Por validar`.
3. ADRs aceptados aplicables: [ADR-002](../../../../../doc/product-adr/ADR-002-portfolio-entry-active-question-clarification-convergence.md) para la frontera futura de Quick Clarification; [ADR-006](../../../../../doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md) para mantener Portfolio Entry como orientación opcional; [ADR-007](../../../../../doc/product-adr/ADR-007-portfolio-entry-reason-to-ask-public-explanation.md) para separar explicación pública de razonamiento privado si un consumidor posterior usa preguntas.
4. [Portfolio Entry Logic Contract v0.1](../../../../../doc/experience/portfolio-entry/PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md), único contrato activo de Portfolio Entry.
5. [Critical Reasoning Experience Contract v0.1](../../../../experience/portfolio-entry/PORTFOLIO_ENTRY_CRITICAL_REASONING_EXPERIENCE_CONTRACT_v0.1.md), frozen para planificación dentro de su alcance.
6. Agent y Skills existentes, únicamente como referencias subordinadas y respetando su estado `PROPUESTO PARA TESTING`.
7. Harness existente, únicamente como evidencia o candidato.

`PORTFOLIO_ENTRY_CLARIFICATION_HANDOFF_CONTRACT_v0.2.1.md`, el Agent v0.2, Skills v0.2 y Harness v0.2 siguen siendo candidatos. Ninguna estructura, regla de handoff o decisión propia de esos documentos se importa como norma por este Skill. En particular, este documento no decide el mapeo futuro de la lectura crítica a un handoff.

ADR-003 trata registro y continuación; su discrepancia de estado está abierta y diferida. Esta capacidad termina antes de registro, conversión, continuación y Portfolio Setup, por lo que no la resuelve ni depende de ella.

## 2. Responsabilidad

Transformar el contexto de sesión y análisis disponible en una lectura provisional que ayude a preparar una decisión y un primer movimiento contextual:

```text
Session / Analysis Context
→ Situation Model
→ Material Tensions
→ Decision Frame
→ Usable Now
→ Decision-changing Unknowns
→ Candidate First Movement
```

La skill organiza lo que ya se sabe, qué relación está soportada, qué puede aprovecharse y qué información podría cambiar una decisión. Puede devolver una lectura parcial o `insufficient_basis`; no tiene que llenar cada campo.

La skill no es una entidad Core, un modelo canónico del portafolio, una decisión tomada ni una ejecución de trabajo.

## 3. Trigger e input conceptual

### Trigger

Usar cuando exista contexto de sesión suficiente para intentar preparar una lectura crítica, o cuando una respuesta material del usuario cambie la lectura. Un contexto escaso puede activar una salida parcial con incertidumbre; no habilita a completar los huecos mediante invención.

La ubicación de esta capacidad en el orquestador queda fuera de este contrato. No presupone que entry-04, sus preguntas o un handoff candidato tengan una integración aprobada.

### Input

`SessionAnalysisContext` puede contener, si están disponibles:

- objetivo, problema, oportunidad, decisión o cambio expresado por la persona;
- declaraciones, correcciones y contradicciones de la sesión;
- trabajo, iniciativas, activos, acciones o procesos existentes que la persona haya aportado;
- evidencia, señales, datos y aprendizajes existentes con la referencia de fuente disponible;
- restricciones, horizonte temporal y dependencias descritas;
- actores, roles y autoridad expresamente indicados;
- alternativas que ya se hayan considerado;
- contexto previo explícitamente autorizado para esta experiencia, con su procedencia y vigencia.

Ningún campo es obligatorio por defecto. La skill no inicia búsquedas web, consultas a sistemas conectados, lecturas organizacionales ni nuevas investigaciones. Si una fuente no está disponible, su contenido sigue siendo desconocido.

Si hay valores incompatibles, conserva la contradicción y su procedencia; no selecciona uno en silencio. Una inferencia previa no se convierte en una declaración del usuario por circular entre skills.

## 4. Operaciones de razonamiento

### 4.1 Situation Model provisional

La proyección conceptual es:

```text
SituationModel
├── desired_change
├── current_situation
├── existing_work_or_assets
├── known_evidence
├── constraints
├── actors_and_authority
├── dependencies
├── uncertainties
├── time_pressure
├── existing_alternatives
├── material_tensions
└── decision_to_enable?   [vista opcional compatible con KAN-114A]
```

Todos los campos son provisionales; pueden estar ausentes, ser parciales o conservar una contradicción. `desired_change` significa el cambio o resultado que busca la persona. No es alias de `decision_frame`, que describe la elección que necesita poder preparar mejor. `decision_to_enable`, incluido en el SituationModel del contrato KAN-114A, puede conservarse como input o referencia cuando esté disponible; no se sobrescribe ni se transforma silenciosamente. No se crea entidad Core.

`SituationModel.material_tensions` referencia la misma colección conceptual que `CriticalSituationSynthesis.material_tensions[]`; no es una segunda colección ni una segunda fuente de verdad. La colección admite 0..N tensiones. Solo se incluyen varias cuando cada una aporta una diferencia material; no se multiplican para completar el modelo.

### 4.2 Lentes adaptativas

Activar internamente solo lentes que puedan cambiar una parte material de la lectura:

- prioridad / allocation;
- diagnóstico;
- evidencia / aprendizaje;
- secuencia;
- dependencias;
- gobernanza;
- capacidad;
- riesgo;
- alineamiento;
- diseño de sistema.

La selección es contextual y puede combinar lentes o no activar ninguna familia dominante. Ejemplos: un bloqueo con autoridad externa puede requerir dependencia, gobernanza y secuencia; una iniciativa clara y única puede requerir evidencia sin razonamiento de portfolio. Una lente no demuestra que el problema exista.

Las lentes no son una taxonomía para el usuario, no son campos obligatorios de la síntesis y no se muestran como diagnóstico. No se aplica una plantilla universal.

La selección se registra únicamente como metadata interna y evaluable en `reasoning_metadata.selected_lenses[]`. Las señales de contexto —por ejemplo, time pressure, timing o proximidad de renovación— no son lentes ni familias nuevas: pueden activar, según el caso, sequencing, risk, governance, capacity u otra lente existente. No se exige activar todas las lentes ni seguir un orden fijo.

### 4.3 Material tension

Una tensión se representa conceptualmente así:

```text
MaterialTension
├── statement
├── status: supported | unresolved
├── support[]             [referencias a contexto o claims disponibles]
├── why_it_matters
└── affected_decision
```

`support[]` referencia contexto/claims disponibles que sostienen la tensión; no contiene private reasoning. Una tensión es `supported` únicamente si `support[]` contiene referencias suficientes y se cumplen estas condiciones:

1. hay al menos dos condiciones relevantes o una condición y una incertidumbre explícita, ambas trazables al contexto disponible;
2. su relación genera demandas, restricciones o cursos de acción que entran materialmente en tensión;
3. esa relación podría cambiar la lectura, la decisión a preparar o el primer movimiento;
4. la conclusión no requiere inventar causalidad, intención, autoridad, urgencia o datos faltantes.

Una incertidumbre puede limitar una opción; no demuestra por sí sola que esa opción sea buena o mala. La ausencia de evidencia, un número alto de iniciativas o la presencia de una solución no son tensiones automáticas. Si una tensión candidata carece de soporte suficiente —incluido `support[]` vacío—, devolver `status = unresolved`, precisar por qué importa no poder afirmarla y señalar la decisión afectada si es identificable; también puede omitirse si no hay una tensión material candidata que registrar. No fabricar ni multiplicar tensiones o insights.

### 4.4 Decision Frame

Preparar la decisión real que el usuario podría necesitar considerar, incluyendo cuando haya base:

- `status`: `framed` o `not_yet_identifiable`;
- `decision_to_prepare`: qué necesita poder decidir o encaminar;
- `decision_authority`: actor/autoridad expresamente conocidos o `unknown`;
- `materially_distinct_paths`: cursos de acción realmente distintos que estén soportados, opcionales y no exhaustivos;
- `distinguishing_conditions`: evidencia, dependencia, restricción o criterio que podría hacer preferible una ruta;
- `timing_or_constraints`: horizonte y límites que ya consten;
- `unresolved_basis`: incertidumbres que impiden un frame más definido.

El frame no decide por la persona ni la obliga a escoger. No reduce por defecto una decisión compleja a `seguir / parar`; puede describir una decisión de secuencia, gobernanza, reasignación, alcance, condiciones, aprendizaje o revisión cuando el contexto lo soporte. `desired_change` es el cambio/resultado buscado; `decision_frame` es la elección que la persona necesita preparar. No son aliases. Si todavía no se identifica una decisión concreta, usar `decision_frame.status = not_yet_identifiable`. Una referencia `decision_to_enable` recibida como input se conserva y no se sobrescribe silenciosamente.

### 4.5 Usable Now

Antes de proponer trabajo nuevo, preguntar internamente: **¿Algo que ya existe puede ayudarnos a reducir esta incertidumbre?**

`usable_now[]` puede incluir contexto, evidencia, acciones, activos, decisiones anteriores, pilotos, procesos, datos o iniciativas existentes aportados o explícitamente autorizados, además de restricciones que ya orientan una acción. No es una lista de todo lo conocido: cada elemento indica qué es, su procedencia disponible y cómo puede aprovecharse razonablemente para leer la situación, reducir un gap o avanzar con prudencia. No presume acceso a información no aportada/autorizada ni atribuye resultados que la evidencia no demuestre.

Una lista vacía es válida. No recomendar research nuevo por defecto ni tratar contexto mencionado como verificado por Starteria.

### 4.6 Decision-changing Unknowns

Incluir solo incertidumbres cuya resolución plausible podría cambiar al menos uno de estos elementos: lectura, decisión a preparar, tensión, primer movimiento, dependencia, riesgo o posibilidad de actuar.

Cada elemento conceptual incluye:

```text
DecisionChangingUnknown
├── uncertainty
├── why_it_matters
├── current_evidence       [referencia o null si no hay evidencia disponible]
├── resolution_mode
├── related_decision
└── impact_dimensions[]
```

`why_it_matters` nombra qué parte de una decisión o movimiento podría cambiar; no basta decir que la respuesta sería “útil”. `resolution_mode` describe una vía compatible con la situación, como reutilizar evidencia/trabajo existente, realizar una acción ya autorizada, aclarar contexto con una persona, obtener input organizacional de quien tenga autoridad u obtener evidencia externa autorizada. Distinguir estos modos cuando aplique; no convertir cada unknown automáticamente en research. No afirma que la resolución ya ocurrió. `impact_dimensions[]` señala las dimensiones del Material Decision Impact Test que podrían cambiar por esta incertidumbre. Un gap nice-to-have o sin impacto decisional queda fuera de la lista.

### 4.7 Candidate First Movement

Solo proponerlo si hay base para identificar un movimiento contextual y proporcionado:

```text
CandidateFirstMovement
├── movement
├── why_now
├── existing_assets_used[]
├── what_it_may_clarify
├── decision_supported
└── boundary
```

El movimiento debe reutilizar primero lo existente cuando ello pueda reducir la incertidumbre; debe indicar por qué ahora y qué decisión apoya. `what_it_may_clarify` describe aprendizaje posible, no un resultado garantizado. `boundary` dice qué no queda resuelto, confirmado o autorizado por el movimiento. Si ningún movimiento está suficientemente soportado, devolver `null` con su razón de insuficiencia.

Es suficientemente accionable cuando identifica qué hacer primero, sobre qué contexto/trabajo existente, por qué ahora y qué decisión o incertidumbre ayuda a preparar, sin fijar el método detallado de ejecución. “Revisar evidencia” es demasiado vago. Comparar iniciativas existentes contra el objetivo y la evidencia que ya producen para identificar cuáles podrían reducir primero la incertidumbre relevante es específico en sentido conceptual. “Ejecutar una prueba durante 14 días usando threshold X” excede el límite y es Step/experiment leakage.

Sigue siendo una propuesta. No decide por el usuario, asigna presupuesto, crea puntuaciones o thresholds, prioriza canónicamente, diseña un experimento completo, activa Steps ni ejecuta la acción.

### 4.8 Material Decision Impact Test para consumo futuro

Cada unknown debe declarar `impact_dimensions[]` usando las dimensiones del Material Decision Impact Test reconciliado con KAN-114A:

- `situation_reading`;
- `decision_frame`;
- `material_tension`;
- `first_movement`;
- `critical_dependency`;
- `material_risk`;
- `ability_to_act_now`;
- `starteria_continuation_shape`.

Las dimensiones se asignan solo cuando una respuesta plausible puede cambiarlas y se vinculan al unknown, decisión y soporte correspondientes. `starteria_continuation_shape` solo indica que una respuesta podría cambiar la forma o nivel de una continuación posterior; no genera un Starteria Path. Esta información permite a un consumidor futuro —incluido Question Planner— aplicar el test, pero esta skill no formula, prioriza ni selecciona preguntas, no consume budgets/slots, no decide stopping, no cambia entry-04 ni modifica Question Planner. La pregunta candidata y su explicación pública pertenecen a límites posteriores; conforme ADR-007, una explicación pública no es razonamiento privado.

## 5. Output conceptual

```text
CriticalSituationSynthesis
├── basis_status: sufficient | partial | insufficient_basis
├── situation_model: provisional fields from §4.1
├── reasoning_metadata.selected_lenses[]
├── situation_insight: SituationInsight
├── material_tensions[]: MaterialTension
├── decision_frame: framed | not_yet_identifiable + fields from §4.4
├── usable_now[]
├── decision_changing_unknowns[]
├── candidate_first_movement: CandidateFirstMovement | null
├── uncertainty_statement?: string | null
└── provenance: claim-level provenance from §6
```

`SituationInsight` se representa conceptualmente como `statement`, `support[]`, `novelty_type`, `epistemic_role = INTERPRETATION` y `status`. Los `novelty_type` permitidos son `relationship_made_explicit`, `tension_made_explicit`, `decision_structure_clarified`, `sequence_dependency_exposed` y `no_supported_insight`. Un insight debe hacer explícita una relación, tensión, estructura decisional o dependencia útil; una reformulación elegante no cuenta. Si no hay soporte, `status = no_supported_insight` y `novelty_type = no_supported_insight`.

`uncertainty_statement` es condicional y, cuando existe, resume únicamente `decision_changing_unknowns[]`; no incorpora hechos, inferencias ni gaps nuevos. Si no hay unknowns materiales, su valor es `null` o el campo está ausente. No se genera una frase artificial para llenar el output. Los `impact_dimensions[]` de cada unknown hacen trazable su relación con el Material Decision Impact Test; no se añade un mapa separado que seleccione preguntas.

El output es interno y conceptual en esta iteración de diseño. No determina el formato de una pantalla ni sustituye la lectura CriticalEntryReading completa, el handoff vigente o una interacción user-facing.

## 6. Provenance y autoridad humana

Cada afirmación material mantiene dimensiones semánticas separadas:

1. `epistemic_role`: `FACT`, `INTERPRETATION`, `PROPOSAL` o `UNKNOWN`. `UNKNOWN` marca explícitamente algo no resuelto; no es un hecho negativo ni una inferencia.
2. `provenance`: origen/autoría, preservando `origin` (`USER_DECLARED`, `EXTRACTED_FROM_USER_TEXT`, `AI_INFERRED`, `AI_SUGGESTED`) y `review disposition` (`UNREVIEWED`, `USER_CONFIRMED`, `USER_REJECTED`, `SUPERSEDED`) vigentes.
3. `source/evidence`: referencias a la fuente y evidencia disponible, con fecha cuando exista.

`provenance` significa origen/autoría; `epistemic_role` significa naturaleza de la afirmación. Ninguna sustituye, renombra ni degrada otra capa o la procedencia vigente. `FACT` requiere soporte directo de la persona o una fuente válida; `INTERPRETATION` expresa lectura inferida; `PROPOSAL` expresa movimiento sugerido; `UNKNOWN` conserva una cuestión explícitamente sin resolver. La salida de razonamiento se mantiene `UNREVIEWED` por defecto. Una inferencia o propuesta no pasa a `USER_CONFIRMED` sin una acción explícita de una persona con autoridad. La similitud con información pública no prueba prioridades, capacidades ni problemas internos.

No exponer chain-of-thought, instrucciones internas, scores o trazas de modelo. La salida estructurada explica la lectura y sus límites, no la deliberación privada.

## 7. Suficiencia y regla NO INSIGHT

Aplicar explícitamente:

```text
NO INSIGHT > FAKE INSIGHT
```

Cuando la evidencia no soporte una tensión, una decisión o un movimiento, marcar ese elemento como `unresolved`, `not_yet_identifiable` o `null`, según corresponda. `situation_insight` siempre puede declarar `no_supported_insight`; no se rellena con una paráfrasis. `uncertainty_statement` solo resume unknowns materiales ya declarados. Se puede devolver información parcial sin presentar una explicación preferida. No usar completitud del schema, tono convincente ni número de datos como sustituto de suficiencia.

## 8. Límites explícitos

Esta Skill no produce, implementa ni autoriza:

- Live Understanding UI, UI final, frontend ni explicación pública del razonamiento;
- Portfolio Setup, Starteria Path completo ni CTA;
- autenticación ni conversión;
- canonicalización, entidades Core ni escritura de evidencia Core;
- Steps, ejecución de iniciativa o activación;
- scoring definitivo, thresholds ni asignación presupuestaria;
- diseño completo de experimentos;
- decisiones o runtime de Question Planner, ni cambios en entry-04;
- nuevas búsquedas, fuentes o integraciones.

La información de esta Skill puede ser consumida por fases posteriores, pero Skill 05 no implementa esas fases.

El output no es una recomendación de inversión ni priorización definitiva del portfolio.

## 9. Fallos que debe prevenir

- fabricar una tensión porque una plantilla espera una;
- inferir causalidad entre churn, iniciativa, tecnología u outcome sin evidencia;
- asumir que muchas ideas implican falta de ideas, o que muchas iniciativas implican progreso, duplicidad o baja calidad;
- tratar una dependencia externa como bloqueo absoluto sin comprobar el trabajo independiente posible;
- proponer trabajo nuevo sin revisar activos, evidencia y acciones existentes;
- mostrar gaps irrelevantes que no podrían cambiar una decisión;
- reemplazar provenance por etiquetas FACT/INTERPRETATION/PROPOSAL;
- comprimir una decisión rica a seguir/parar;
- convertir una propuesta en decisión humana, autorización o hecho confirmado;
- aplicar el mismo primer movimiento a contextos cuya evidencia, decisión o restricción material difieren.

## 10. Rúbrica conceptual para revisión

La especificación de fixtures de [KAN-114](../../../../ai-harness/portfolio-entry/KAN-114_CRITICAL_SITUATION_SYNTHESIS_FIXTURE_SPEC_v0.1.md) define los casos y la comparación semántica. Una evaluación futura debe revisar grounding y provenance, validez de tensiones, calidad del frame, reutilización de lo existente, relevancia de unknowns, contextualidad de movimiento, límites de autoridad y adaptabilidad entre casos. No usar exact-match textual como criterio.

Esta rúbrica no fija puntuación final, thresholds de producto ni criterios de activación runtime.
