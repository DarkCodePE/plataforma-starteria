# KAN-114 — Critical Situation Synthesis Fixture / Harness Specification

**Documento:** `KAN-114_CRITICAL_SITUATION_SYNTHESIS_FIXTURE_SPEC_v0.1.md`<br>
**Versión:** v0.1<br>
**Estado:** FROZEN FOR KAN-114 EVALUATION<br>
**HU:** KAN-114 — Portfolio Entry — Critical Situation Synthesis<br>
**Tipo:** Fixture / evaluation specification<br>
**Alcance:** diseño semántico; no modifica ni implementa Harness runtime

Esta especificación queda congelada como baseline de evaluación de KAN-114. No constituye evidencia de que el runtime ya pase los fixtures y no promueve Harness v0.2 ni otros documentos candidatos.

Este documento diseña los casos y criterios que una evaluación futura deberá usar para `entry-05-critical-situation-synthesis`. No modifica runner, adapters, schemas, prompts productivos, Agent, Question Planner ni ningún test runtime.

## 1. Autoridad y estado de la evidencia

La autoridad sigue el orden documentado en el [Skill Contract de KAN-114](../../agents/portfolio-entry/skills/entry-05-critical-situation-synthesis/SKILL_v0.1.md): Core v0.2, ADRs aceptados aplicables, Portfolio Entry Logic v0.1 y Critical Reasoning Experience Contract v0.1.

El inventario gobernado no contiene una Skill entry-05 ni una especificación de fixtures específica para KAN-114. El Manifest clasifica el stack Agent/Skills/Harness v0.2 como `CANDIDATE_RECONCILIATION`; los documentos de Harness v0.2 están propuestos para testing/implementación, no son autoridad normativa. Aquí se usan únicamente como evidencia de que existe una estructura de evaluación candidata. No se presupone ni se altera su runner.

KAN-114A sigue siendo un contrato de experiencia/razonamiento frozen, no evidencia de ejecución ni autorización runtime. KAN-114 proporciona una HU Jira válida; el alcance de esta iteración está limitado a estos dos documentos de diseño.

## 2. Objetivo de evaluación

Demostrar que la capacidad:

1. construye una lectura provisional, trazable y no canónica;
2. distingue tensión soportada de tensión `unresolved`;
3. prepara la decisión contextual sin decidir ni simplificarla artificialmente;
4. identifica contexto, evidencia, activos o trabajo ya disponibles antes de proponer trabajo nuevo;
5. incluye únicamente unknowns que podrían cambiar una decisión o el primer movimiento y conserva los seis campos requeridos, incluidos sus `impact_dimensions[]`;
6. produce un Candidate First Movement contextual cuando hay soporte y se abstiene cuando no lo hay;
7. preserva provenance y autoridad humana;
8. varía el patrón de razonamiento entre situaciones materialmente distintas;
9. deja el Material Decision Impact Test legible para un futuro consumidor como Question Planner, sin modificar ese componente.

El alcance excluye explícitamente Live Understanding UI, UI final, frontend, Portfolio Setup, Starteria Path completo, CTA, autenticación, conversión, canonicalización, entidades Core, Steps, scoring definitivo, thresholds, diseño completo de experimentos y Question Planner runtime. La información de esta Skill puede ser consumida por fases posteriores, pero esta suite no implementa esas fases.

## 3. Convención de fixtures

Cada contexto siguiente es un estímulo sintético. Solo los datos declarados en el estímulo cuentan como `USER_DECLARED` o como evidencia citada por el propio contexto. Las notas de expectativa describen semántica aceptable, no frases obligatorias.

Un evaluator debe aceptar redacciones distintas si conservan los hechos, límites y diferencias esperadas. Debe rechazar una salida pulida que invente causalidad o complete datos ausentes.

Las lentes listadas son expectativa interna para revisar adaptabilidad. No se muestran al usuario ni constituyen entidades o categorías canónicas.

Cada fixture declara `expected_lenses[]` y `forbidden_or_unnecessary_lenses[]` usando únicamente las familias de lentes del Skill Contract. El conjunto esperado es contextual, no una secuencia; una lente innecesaria no debe activarse solo por exhaustividad. `time pressure`, `timing`, `renewal proximity` y otras señales son datos contextuales, nunca familias de lentes.

Cada unknown material esperado especifica `uncertainty`, `why_it_matters`, `current_evidence`, `resolution_mode`, `related_decision` e `impact_dimensions[]`. Los modos distinguen reutilizar evidencia/trabajo, una acción autorizada, input organizacional y evidencia externa autorizada, según el caso. Gaps nice-to-have se omiten. Si existe `uncertainty_statement`, resume únicamente unknowns ya declarados y no añade hechos, inferencias ni gaps; sin unknowns materiales, es `null` o absent. Los bloques siguientes fijan propiedades semánticas y ejemplos de soporte, no texto exacto.

Las referencias como `CS-01.churn_series` son alias de evaluación para datos/claims descritos en `Context` o `Supported facts`; no crean entidades ni una fuente aparte. Cada referencia debe poder trazarse a lo expresamente aportado. Un alias sin soporte trazable no cuenta como evidencia.

## 4. Matriz de fixtures

### CS-01 — Laura: varias iniciativas, churn y horizonte trimestral

**Context**<br>
Laura coordina ocho iniciativas relacionadas con reducir churn. Los datos existentes muestran que el churn aumentó en dos segmentos durante los últimos dos trimestres, pero las cancelaciones se observan con retraso. La revisión de portafolio es en diez semanas y espera evidencia de progreso trimestral. Las iniciativas comparten capacidad limitada de análisis. No se ha establecido qué iniciativa causa o reduce churn.

**Expected lens family:** priority / allocation, diagnosis, evidence / learning, capacity y sequencing. La proximidad de la revisión es una señal contextual, no una lente.<br>
**Supported facts:** ocho iniciativas; intención declarada de reducir churn; aumento observado en dos segmentos y dos trimestres; demora de observación; revisión en diez semanas; capacidad analítica compartida y limitada.<br>
**Forbidden inference:** atribuir causalidad o eficacia a cualquier iniciativa; declarar qué segmento importa más; suponer que aumentar o reducir presupuesto resolverá el problema; tratar el indicador trimestral como resultado causal.

**Expected material tension:** `supported` si expresa la tensión entre necesitar progreso visible en el horizonte trimestral y disponer de un resultado de churn rezagado, junto con iniciativas que compiten por capacidad analítica. No debe afirmar qué apuesta gana.

**Expected decision frame:** preparar cómo secuenciar o enfocar la capacidad existente para la revisión próxima, qué evidencia intermedia presentar y qué decisiones de priorización podrían quedar abiertas hasta observar churn. No reducir a “seguir/parar” las ocho iniciativas.

**Expected usable_now:** inventario de iniciativas, series existentes de churn por segmento/periodo y horizonte/fecha de revisión en diez semanas. No afirma que exista una agenda. Las señales intermedias solo se reutilizan si ya existen y están disponibles; el fixture no afirma que existan. Debe marcar como desconocido cualquier vínculo causal no medido.

**Expected unknowns:** qué iniciativas ya tienen señal intermedia relevante; si alguna señal anticipa churn o solo actividad; cuánto análisis puede asignarse sin desplazar trabajo crítico. Cada unknown debe decir por qué su respuesta puede cambiar secuencia, lectura, riesgo o decisión; referir evidencia actual o `null`; describir modo de resolución; y enlazar con la decisión que prepara.

**Expected first movement characteristics:** usar inventario y datos ya existentes para relacionar iniciativas, segmentos y señales tempranas antes de redistribuir trabajo; explicitar qué puede aclarar para la revisión de diez semanas y que no prueba impacto causal.

**Prohibited outputs:** nuevas iniciativas como respuesta automática; ranking definitivo; “la iniciativa X reduce churn”; presupuesto o threshold; recomendación de cancelar/continuar sin análisis; experimento completo.

**expected_lenses[]:** [`priority / allocation`, `diagnosis`, `evidence / learning`, `capacity`, `sequencing`]. `diagnosis` sirve para separar churn rezagado de señales intermedias, no para atribuir causa.<br>
**forbidden_or_unnecessary_lenses[]:** [`governance`, `dependencies`, `alignment`, `system design`, `risk`]; no hay señal que las haga necesarias.<br>
**Expected epistemic behavior:** FACT para cifras, horizonte, capacidad declarada y datos observados; INTERPRETATION para la tensión entre señales rezagadas, horizonte y capacidad compartida; PROPOSAL para el movimiento; UNKNOWN para eficacia causal y valor predictivo de señales intermedias.<br>
**Expected decision status:** `framed` — secuenciar/enfocar capacidad y preparar evidencia para la revisión; no una decisión binaria por iniciativa.<br>
**Expected basis_status:** `partial`; permite preparar la lectura aunque no se conoce causalidad ni capacidad disponible en detalle.<br>
**Expected situation insight:** `status = supported`, `novelty_type = relationship_made_explicit`, `support[] = [CS-01.churn_series, CS-01.review_horizon, CS-01.shared_capacity]`; debe aclarar por qué esos elementos condicionan la secuencia, no solo repetirlos.<br>
**Expected tension record:** `MaterialTension { statement: tensión entre evidencia de churn rezagada, necesidad de progreso visible y capacidad analítica compartida; status: supported; support: [CS-01.churn_series, CS-01.review_horizon, CS-01.shared_capacity]; why_it_matters: cambia qué evidencia intermedia puede prepararse y cómo secuenciar capacidad; affected_decision: foco/secuencia para la revisión trimestral }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: qué iniciativas producen señales intermedias relevantes; `why_it_matters`: podría cambiar el foco para la revisión; `current_evidence`: inventario e indicadores existentes, sin relación iniciativa-señal confirmada; `resolution_mode`: reutilizar registros y señales existentes; `related_decision`: secuenciación/foco; `impact_dimensions`: [`situation_reading`, `decision_frame`, `first_movement`].
- `uncertainty`: si hay señales intermedias ya disponibles y si informan churn o solo actividad; `why_it_matters`: puede cambiar la interpretación del progreso; `current_evidence`: churn rezagado por segmento y periodo, sin señal intermedia descrita; `resolution_mode`: revisar artefactos existentes y reutilizar señales si existen; si no, input organizacional de owners sobre lo ya observado; `related_decision`: qué evidencia presentar; `impact_dimensions`: [`situation_reading`, `material_risk`, `decision_frame`].
- `uncertainty`: cuánta capacidad analítica puede usarse sin desplazar trabajo crítico; `why_it_matters`: puede cambiar una secuencia viable; `current_evidence`: capacidad compartida y limitada, cantidad/disponibilidad no aportada; `resolution_mode`: input organizacional de responsables de capacidad; `related_decision`: foco y secuencia; `impact_dimensions`: [`decision_frame`, `ability_to_act_now`, `first_movement`].

### CS-02 — Programa de innovación existente: progresión y gobernanza

**Context**<br>
Un programa tiene 46 ideas en su backlog. De tres cohortes, seis ideas pasaron la revisión inicial. No hay criterios de progresión documentados. El equipo del programa dice que las propuestas esperan decisiones de comité; dos patrocinadores dicen que no reciben evidencia suficiente de los responsables. Hay minutas de comité, un historial de cohortes y responsables registrados para parte de las ideas.

**Expected lens family:** system design, governance, sequencing y diagnosis.<br>
**Supported facts:** backlog de 46; tres cohortes; seis progresiones observadas; criterios no documentados; explicaciones distintas de equipo y patrocinadores; existen minutas, historial y ownership parcial.<br>
**Forbidden inference:** asumir que faltan ideas, que las ideas son malas, que el comité es la causa única, que los patrocinadores bloquean deliberadamente o que todo el programa debe rediseñarse.

**Expected material tension:** `supported` entre la progresión reportada, los criterios no documentados y explicaciones divergentes sobre dónde se detiene el avance. El fixture no establece que las seis ideas y las 46 del backlog compartan denominador. La causa del patrón permanece abierta.

**Expected decision frame:** preparar qué parte del mecanismo de progresión o gobernanza conviene aclarar o ajustar y quién debe resolverla, sin convertirlo en una decisión de generar más ideas o rediseñar todo el programa.

**Expected usable_now:** backlog, historiales de cohortes, minutas, estados y responsables que ya existan. Revisar evidencia de casos que progresaron y que no progresaron antes de plantear una nueva intervención.

**Expected unknowns:** en qué transición se detienen las propuestas; qué condiciones usan realmente los comités; qué evidencia/documentación consideran insuficiente los patrocinadores; quién tiene autoridad para cambiar criterios. Vincular cada gap a la decisión de progresión/gobernanza y proponer reutilizar registros o pedir input del dueño pertinente.

**Expected first movement characteristics:** trazar unos pocos casos existentes a través de sus decisiones y artefactos para localizar la transición problemática antes de diseñar cambios al programa; indicar qué decisión podría preparar y el límite de una muestra parcial.

**Prohibited outputs:** proponer más ideas como solución; concluir que el problema es la calidad de ideas o el comité; inventar una metodología universal de innovación; diseñar el programa entero o sus etapas; recomendar presupuesto.

**expected_lenses[]:** [`system design`, `governance`, `sequencing`, `diagnosis`, `evidence / learning`].<br>
**forbidden_or_unnecessary_lenses[]:** [`priority / allocation`, `dependencies`, `risk`, `alignment`, `capacity`]; no inferir competición por recursos ni riesgo a partir del volumen.<br>
**Expected epistemic behavior:** FACT para conteos, ausencia de criterios documentados y artefactos disponibles; mantener como claims atribuidos las explicaciones divergentes de equipo y patrocinadores; INTERPRETATION para la relación entre progresión reportada y mecanismo no documentado; PROPOSAL para trazar casos existentes; UNKNOWN para transición, criterios usados y autoridad de cambio.<br>
**Expected decision status:** `framed` — qué parte del mecanismo de progresión/gobernanza aclarar y quién puede resolverla.<br>
**Expected basis_status:** `partial`; hay registros y relatos, pero falta localizar transiciones y reconciliar explicaciones.<br>
**Expected situation insight:** `status = supported`, `novelty_type = tension_made_explicit`, `support[] = [CS-02.cohort_history, CS-02.criteria_not_documented, CS-02.stakeholder_accounts]`; no compara conteos con denominadores no aportados ni asigna causalidad al comité o responsables.<br>
**Expected tension record:** `MaterialTension { statement: la progresión reportada y las explicaciones divergentes no permiten localizar el mecanismo con criterios no documentados; status: supported; support: [CS-02.cohort_history, CS-02.criteria_not_documented, CS-02.stakeholder_accounts]; why_it_matters: no se puede escoger un cambio de mecanismo sin localizar la transición y reconciliar las explicaciones; affected_decision: dónde y quién debe aclarar/ajustar progresión }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: en qué transición se detienen casos que progresan/no progresan; `why_it_matters`: ubica el mecanismo que conviene revisar; `current_evidence`: historial de cohortes y minutas disponibles, cobertura por caso no especificada; `resolution_mode`: reutilizar registros y trazar casos existentes; `related_decision`: dónde intervenir en progresión; `impact_dimensions`: [`situation_reading`, `material_tension`, `first_movement`].
- `uncertainty`: qué condiciones usa realmente el comité; `why_it_matters`: puede cambiar la lectura de criterios y evidencia requerida; `current_evidence`: criterios no documentados y minutas existentes; `resolution_mode`: revisar minutas y pedir input organizacional al comité si no basta; `related_decision`: aclaración/ajuste de gobernanza; `impact_dimensions`: [`decision_frame`, `material_tension`, `ability_to_act_now`].
- `uncertainty`: qué evidencia/documentación consideran insuficiente los patrocinadores; `why_it_matters`: puede cambiar qué debe aclararse en el mecanismo y evitar asumir que el retraso es culpa del comité; `current_evidence`: afirmación de dos patrocinadores y responsables registrados solo para parte de las ideas; `resolution_mode`: input organizacional de patrocinadores/responsables y revisión de casos/artefactos existentes; `related_decision`: qué información o transición de progresión aclarar; `impact_dimensions`: [`situation_reading`, `decision_frame`, `first_movement`].
- `uncertainty`: quién tiene autoridad para cambiar criterios; `why_it_matters`: determina quién puede habilitar una decisión; `current_evidence`: comité y patrocinadores mencionados, autoridad no indicada; `resolution_mode`: input organizacional del owner correspondiente; `related_decision`: responsable y alcance del ajuste; `impact_dimensions`: [`decision_frame`, `critical_dependency`, `ability_to_act_now`].

### CS-03 — Tecnología comprada: outcome y continuidad de inversión poco claros

**Context**<br>
La organización compró una plataforma de automatización hace nueve meses. Dos equipos la usan en un piloto. La renovación anual vence en siete semanas. El outcome esperado era reducir el tiempo de ciclo, pero no hay baseline confirmado ni una medida acordada. Existen contrato, registros de uso del piloto y descripción del proceso actual. La persona usuaria pregunta qué preparar antes de renovar.

**Expected lens family:** evidence / learning, risk, governance y sequencing. La fecha de renovación es una señal contextual.<br>
**Supported facts:** compra hace nueve meses; dos equipos en piloto; fecha de renovación; outcome esperado declarado; baseline y medida no confirmados; existen contrato, registros y proceso actual.<br>
**Forbidden inference:** concluir que la plataforma funciona, fracasó, se usa poco o es un sunk cost; atribuir ahorro; inferir adopción de toda la organización; recomendar renovar o cancelar automáticamente.

**Expected material tension:** `supported` entre una fecha de renovación próxima y una decisión de continuidad cuyo outcome esperado no tiene baseline/medida confirmados. El plazo no prueba el valor de la tecnología.

**Expected decision frame:** preparar alcance, condiciones y evidencia para decidir renovación, renegociación, extensión acotada o no continuidad; dejar las rutas como candidatas contextuales, no como lista cerrada ni recomendación.

**Expected usable_now:** contrato existente, logs del piloto, proceso actual de los dos equipos y definición declarada del outcome. Revisar el contrato para determinar si contiene condiciones útiles; no presumir que dichas condiciones ya están disponibles. Comprobar primero si las fuentes aportadas permiten caracterizar uso y comparación posible.

**Expected unknowns:** cambio observado de tiempo de ciclo; cobertura/calidad de los logs; condiciones o flexibilidad contractual; responsable de validar el outcome. Indicar qué opción o condición podría cambiar, con evidencia actual y modo de resolución.

**Expected first movement characteristics:** reunir contrato, uso existente y descripción del proceso para establecer qué puede verificarse antes de la fecha de renovación y qué seguirá desconocido; apoyar una decisión condicionada, sin prometer medir causalidad retrospectiva.

**Prohibited outputs:** “renovar porque ya se invirtió”; “cancelar porque no hay baseline”; ROI inventado; evaluación de proveedores externos no disponible; presupuesto asignado; plan de experimento completo.

**expected_lenses[]:** [`evidence / learning`, `risk`, `governance`, `sequencing`].<br>
**forbidden_or_unnecessary_lenses[]:** [`priority / allocation`, `diagnosis`, `dependencies`, `alignment`, `system design`, `capacity`]; no activar portfolio allocation ni asumir capacidad insuficiente.<br>
**Expected epistemic behavior:** FACT para compra, piloto, renovación, outcome esperado y artefactos; UNKNOWN para baseline, cambio observado, cobertura de logs y condiciones contractuales no aportadas; INTERPRETATION para tensión de continuidad temporal con outcome poco definido; PROPOSAL para usar primero contrato, registros y proceso actual.<br>
**Expected decision status:** `framed` — condiciones/evidencia para preparar renovación, renegociación, extensión u otra continuidad, sin recomendar una ruta.<br>
**Expected basis_status:** `partial`; hay activos internos pero baseline, medición y términos relevantes no están caracterizados.<br>
**Expected situation insight:** `status = supported`, `novelty_type = decision_structure_clarified`, `support[] = [CS-03.renewal_date, CS-03.expected_outcome, CS-03.baseline_measurement]`; relaciona la fecha con el outcome aún no medido para aclarar qué debe conocerse o condicionarse.<br>
**Expected tension record:** `MaterialTension { statement: se aproxima la renovación y el outcome esperado carece de baseline confirmado y medida acordada; status: supported; support: [CS-03.renewal_date, CS-03.expected_outcome, CS-03.baseline_measurement]; why_it_matters: la continuidad requiere preparar evidencia/condiciones sin que el plazo demuestre valor; affected_decision: alcance y condiciones de renovación/continuidad }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: qué cambio de tiempo de ciclo puede observarse en los equipos piloto; `why_it_matters`: podría cambiar condiciones de continuidad, sin probar causalidad automáticamente; `current_evidence`: logs de uso y proceso actual disponibles, baseline no confirmado; `resolution_mode`: reutilizar registros existentes y compararlos con la definición del outcome; `related_decision`: evidencia/condiciones para renovar; `impact_dimensions`: [`situation_reading`, `decision_frame`, `material_risk`].
- `uncertainty`: si logs y medidas cubren el uso relevante para decidir; `why_it_matters`: puede cambiar cuánto peso dar a la evidencia; `current_evidence`: registros de dos equipos en piloto, cobertura no descrita; `resolution_mode`: inspeccionar evidencia existente y solicitar input del owner del piloto; `related_decision`: condiciones o alcance de continuidad; `impact_dimensions`: [`situation_reading`, `decision_frame`, `first_movement`].
- `uncertainty`: qué flexibilidad/condiciones de renovación establece el contrato; `why_it_matters`: podría abrir o limitar opciones de alcance y fecha; `current_evidence`: contrato existente, términos aún no extraídos; `resolution_mode`: revisar contrato existente y pedir input organizacional autorizado si hay interpretación contractual; `related_decision`: renovación, renegociación o extensión; `impact_dimensions`: [`decision_frame`, `material_risk`, `ability_to_act_now`].
- `uncertainty`: quién puede validar outcome y medida para esta decisión; `why_it_matters`: define qué evidencia es aceptable; `current_evidence`: outcome esperado declarado, responsable no identificado; `resolution_mode`: input organizacional de la persona con autoridad; `related_decision`: condiciones probatorias de continuidad; `impact_dimensions`: [`decision_frame`, `critical_dependency`, `ability_to_act_now`].

### CS-04 — Iniciativa bloqueada por dependencia organizacional externa

**Context**<br>
Una iniciativa de análisis de reclamaciones necesita acceso aprobado a un conjunto de datos controlado por otro departamento. La solicitud lleva cinco semanas pendiente y no tiene fecha de respuesta. El equipo ya documentó el flujo de reclamaciones y puede mapear campos usando muestras ficticias; la validación con datos reales depende del permiso. Existe una solicitud con número de seguimiento y un contacto del departamento dueño.

**Expected lens family:** dependencies, governance, sequencing y evidence / learning. El riesgo puede considerarse si el límite de acceso tiene consecuencias explícitas; no activarlo por defecto.<br>
**Supported facts:** acceso bajo autoridad de otro departamento; solicitud pendiente cinco semanas sin fecha; documentación existente del flujo; preparación parcial posible con muestras ficticias; validación real no puede ocurrir sin permiso; hay ticket y contacto.<br>
**Forbidden inference:** concluir que la otra área rechaza o bloquea intencionalmente; que la aprobación es segura o imposible; que datos ficticios validan resultados reales; que el equipo puede acceder por su cuenta.

**Expected material tension:** `supported` entre preparar trabajo independiente mientras se espera y no poder validar con datos reales hasta obtener autorización; una parte del trabajo puede avanzar, otra depende del permiso.

**Expected decision frame:** decidir qué preparación independiente merece avanzar, quién puede aclarar estado/autoridad y bajo qué condición se reanuda validación real, preservando el límite de acceso.

**Expected usable_now:** flujo ya documentado, ticket de solicitud y contacto del departamento dueño. El contexto permite mapear campos con muestras ficticias, pero no afirma que esas muestras estén disponibles ni que ese trabajo ya esté en marcha; usarlas queda condicionado a su disponibilidad.

**Expected unknowns:** estado y autoridad efectiva de la solicitud; plazo/condiciones del permiso; si el mapeo previo seguirá válido con los datos reales. Enlazar a la decisión de secuenciar preparación y validación; usar input de la persona dueña para la dependencia.

**Expected first movement characteristics:** consultar el ticket/contacto existente para confirmar responsable, estado y próximo punto de decisión, mientras se limita la preparación a tareas que no requieren datos protegidos; indicar qué aprendizaje no puede obtenerse sin permiso.

**Prohibited outputs:** evadir controles de acceso; tratar muestras ficticias como evidencia real; escalar automáticamente a una autoridad superior; parar todo el trabajo sin distinguir la parte independiente; diseñar el análisis final de datos.

**expected_lenses[]:** [`dependencies`, `governance`, `sequencing`, `evidence / learning`].<br>
**forbidden_or_unnecessary_lenses[]:** [`priority / allocation`, `alignment`, `system design`, `diagnosis`, `capacity`, `risk`]; no activar risk salvo que soporte contextual adicional la haga material.<br>
**Expected epistemic behavior:** FACT para permiso requerido, cinco semanas pendientes, trabajo/muestras existentes y ticket/contacto; UNKNOWN para intención, estado, autoridad efectiva y fecha de respuesta; INTERPRETATION para la separación entre preparación independiente y validación condicionada; PROPOSAL limitada a preparar lo que no requiere acceso.<br>
**Expected decision status:** `framed` — qué preparación independiente avanzar, quién aclara el permiso y cuándo podría secuenciarse validación real.<br>
**Expected basis_status:** `partial`; se distingue trabajo independiente, pero autorización/fecha y validez con datos reales siguen desconocidas.<br>
**Expected situation insight:** `status = supported`, `novelty_type = sequence_dependency_exposed`, `support[] = [CS-04.documented_flow, CS-04.synthetic_samples, CS-04.real_data_permission]`; explicita qué trabajo puede avanzar y qué depende de autorización, sin tratar el permiso como aprobado o imposible.<br>
**Expected tension record:** `MaterialTension { statement: preparación parcial posible mientras la validación con datos reales depende de permiso externo; status: supported; support: [CS-04.pending_request, CS-04.documented_flow, CS-04.synthetic_samples, CS-04.real_data_permission]; why_it_matters: define qué puede avanzar ahora y qué permanece bloqueado legítimamente; affected_decision: secuencia/límite de preparación y validación }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: estado, owner y autoridad efectivos de la solicitud; `why_it_matters`: determina el siguiente punto de coordinación y dependencia; `current_evidence`: ticket/contacto existentes y cinco semanas pendiente; `resolution_mode`: input organizacional del departamento dueño mediante canal existente; `related_decision`: quién puede aclarar/autorizar acceso; `impact_dimensions`: [`decision_frame`, `critical_dependency`, `ability_to_act_now`].
- `uncertainty`: condiciones y plazo del permiso; `why_it_matters`: cambia la secuencia y el alcance de trabajo dependiente; `current_evidence`: no hay fecha de respuesta; `resolution_mode`: input organizacional autorizado del owner de acceso; `related_decision`: cuándo preparar validación real; `impact_dimensions`: [`decision_frame`, `critical_dependency`, `first_movement`].
- `uncertainty`: si el mapeo con muestras ficticias será válido con datos reales; `why_it_matters`: podría limitar qué preparación se reutiliza; `current_evidence`: flujo y muestras ficticias, sin validación real; `resolution_mode`: revisión del owner técnico usando muestras/datos solo tras autorización; `related_decision`: qué preparación independiente conservar; `impact_dimensions`: [`situation_reading`, `first_movement`, `ability_to_act_now`].

### CS-05 — “Queremos innovar más” con muchas iniciativas

**Context**<br>
La persona dice: “Queremos innovar más”. El portfolio ya contiene 23 iniciativas activas con nombres, responsables y estado actual. No aporta una definición de “más”, objetivos, resultados, obstáculos, horizonte o evidencia sobre la progresión de esas iniciativas.

**Expected lens family:** evidence / learning solo para delimitar qué significa “más”. No forzar priority / allocation por el mero recuento.

**Supported facts:** petición de “innovar más”; 23 iniciativas activas; hay inventario de nombres, responsables y estados.<br>
**Forbidden inference:** que hagan falta más ideas; que las iniciativas actuales sean demasiadas, redundantes, de baja calidad o sin impacto; que haya un problema de capacidad, gobernanza o alineamiento.

**Expected material tension:** `unresolved`. La coexistencia de una aspiración amplia y muchas iniciativas no demuestra una tensión operativa ni explica qué cambio se busca.

**Expected decision frame:** `decision_frame.status = not_yet_identifiable`. Aclarar primero qué resultado significa “innovar más”; no inventar una decisión concreta. Posibles significados son ejemplos de ambigüedad, no rutas soportadas ni una taxonomía user-facing.

**Expected usable_now:** inventario existente de iniciativas y sus estados para concretar qué quiere decir “más”; no asumir que el inventario contiene resultados o calidad si solo tiene nombres, responsables y estados.

**Expected unknowns:** solo qué resultado concreto significa “innovar más”. Los outcomes/progresión de las iniciativas no son un unknown crítico hasta que se aclare si esa dimensión es relevante. Explicar cómo la definición cambiaría la lectura, el frame o la posibilidad de actuar antes de recomendar trabajo.

**Expected first movement characteristics:** revisar el inventario ya disponible junto con la persona para precisar qué resultado o cambio espera de “más” antes de generar nuevas ideas. Debe ser exploratorio y no concluir cuál es el problema.

**Prohibited outputs:** más ideación como respuesta predeterminada; “el cuello de botella es gobernanza”; tensión entre cantidad y calidad no expresada; priorización; programa nuevo; ranking; diagnóstico cerrado.

**expected_lenses[]:** [`evidence / learning`].<br>
**forbidden_or_unnecessary_lenses[]:** [`priority / allocation`, `dependencies`, `governance`, `capacity`, `risk`, `alignment`, `system design`, `sequencing`, `diagnosis`]; no hay evidencia que sostenga un diagnóstico de portfolio.<br>
**Expected epistemic behavior:** FACT para la aspiración expresada y el inventario limitado a nombres, responsables y estados; UNKNOWN para el significado de “más” y resultados no aportados; INTERPRETATION no debe convertir el recuento en problema; PROPOSAL puede usar el inventario para aclarar la aspiración.<br>
**Expected decision status:** `not_yet_identifiable`; no crear ni inferir una decisión.<br>
**Expected basis_status:** `partial`; existe una aspiración e inventario limitado, pero no un resultado o decisión concreta.<br>
**Expected situation insight:** `status = no_supported_insight`, `novelty_type = no_supported_insight`, `support[] = []`; la aspiración y el inventario actual no prueban una relación material ni una causa.<br>
**Expected tension record:** `MaterialTension { statement: no se identifica tensión material soportada; status: unresolved; support: []; why_it_matters: el recuento y la aspiración no bastan para afirmar un conflicto operativo; affected_decision: not_yet_identifiable }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: qué cambio o resultado concreto significa “innovar más”; `why_it_matters`: sin ello no se identifica la decisión ni un movimiento de portfolio justificable; `current_evidence`: frase “Queremos innovar más” e inventario con nombres/responsables/estados, sin outcome; `resolution_mode`: aclaración directa de contexto con la persona; `related_decision`: `not_yet_identifiable` hasta precisar el cambio; `impact_dimensions`: [`situation_reading`, `decision_frame`, `ability_to_act_now`].

No incluir como unknown crítico si las 23 iniciativas tienen progresión/outcomes hasta que la persona aclare que esa lectura es relevante; hoy sería un gap nice-to-have.

### CS-06 — Caso altamente ambiguo: base insuficiente

**Context**<br>
La única entrada es: “Algo en el trabajo necesita mejorar y todos dicen que es estratégico. No sé qué más añadir”. No hay un resultado deseado concreto, situación descrita, decisión, actores, evidencia, activo o restricción.

**Expected lens family:** evidencia / aprendizaje, sin lente dominante ni diagnóstico.<br>
**Supported facts:** la persona percibe algo por mejorar y refiere que otros lo llaman estratégico; no hay detalles sobre quién lo dijo ni qué significa.<br>
**Forbidden inference:** inferir desalineamiento, mala estrategia, baja capacidad, conflicto de autoridad, urgencia o una iniciativa concreta.

**Expected material tension:** `unresolved`; no hay dos condiciones con soporte que permitan afirmar qué hace difícil una decisión.

**Expected decision frame:** `not_yet_identifiable`. Un único unknown puede preguntar qué cambio o decisión concreta necesita preparar la persona, explicando que ello determina si existe un frame accionable.

**Expected usable_now:** ninguna fuente, activo o trabajo existente con utilidad demostrada. Puede conservarse la declaración amplia como contexto, no como evidencia de un problema específico.

**Expected unknowns:** solo gaps cuya aclaración pueda determinar el objeto de una lectura o si se puede actuar; por ejemplo, qué resultado/situación concreta quiere cambiar. Referir `current_evidence` al único enunciado y marcar lo demás como no disponible; `resolution_mode` es aclaración de contexto; `related_decision` indica que aún no es identificable y que esa respuesta determina si se puede preparar.

**Expected first movement characteristics:** `null`; la siguiente acción no debe disfrazarse de insight o de plan de trabajo. La salida puede indicar brevemente qué contexto mínimo permitiría reanudar la lectura.

**Prohibited outputs:** insight, tensión o recomendación fabricados; diagnóstico estratégico; framework genérico; plan de innovación; pregunta múltiple; falsa certeza por lenguaje convincente.

**expected_lenses[]:** [`evidence / learning`] solo para identificar qué contexto falta; ninguna lente dominante.<br>
**forbidden_or_unnecessary_lenses[]:** [`priority / allocation`, `diagnosis`, `dependencies`, `governance`, `capacity`, `risk`, `alignment`, `system design`, `sequencing`].<br>
**Expected epistemic behavior:** FACT para el enunciado amplio y el reporte de que otros lo llaman estratégico; no convertir esta atribución en validación externa; UNKNOWN para resultado, situación, decisión, actores y evidencia; `situation_insight` no apoyado; no emitir propuesta de trabajo como si fuera un movimiento contextual.<br>
**Expected decision status:** `not_yet_identifiable`.<br>
**Expected basis_status:** `insufficient_basis`; no hay situación concreta, activo o decisión que permita una lectura material.<br>
**Expected situation insight:** `status = no_supported_insight`, `novelty_type = no_supported_insight`, `support[] = []`.<br>
**Expected tension record:** `MaterialTension { statement: no puede establecerse una tensión material a partir del contexto disponible; status: unresolved; support: []; why_it_matters: falta una situación/elección concreta para explicar una tensión; affected_decision: not_yet_identifiable }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: qué resultado/situación concreta desea cambiar o qué decisión necesita preparar; `why_it_matters`: determina si existe una lectura y acción posibles; `current_evidence`: el único enunciado aportado, sin soporte específico; `resolution_mode`: aclaración directa de contexto con la persona; `related_decision`: `not_yet_identifiable`, la aclaración determina si puede enmarcarse; `impact_dimensions`: [`situation_reading`, `decision_frame`, `ability_to_act_now`].

### CS-07 — Caso regulatorio: hace falta evidencia externa

**Context**<br>
Un equipo de producto de una entidad financiera planea lanzar una funcionalidad en catorce semanas. Existen un brief de producto y un memo interno de riesgos. El memo dice “requiere revisión regulatoria”, pero no identifica la norma aplicable ni si cubre la funcionalidad. La persona dueña de Compliance todavía no responde. El plan de lanzamiento ya tiene fecha.

**Expected lens family:** risk, evidence / learning, governance, dependencies y sequencing. La falta de fuente regulatoria no crea una familia de lente nueva.<br>
**Supported facts:** tipo de organización declarado; fecha planificada; brief y memo existentes; memo no especifica norma ni aplicabilidad; no hay respuesta de Compliance.<br>
**Forbidden inference:** nombrar una regulación o declarar cumplimiento/incumplimiento; concluir que el lanzamiento es ilegal, seguro o imposible; tratar el memo interno como verificación externa; afirmar que Starteria consultó fuentes públicas.

**Expected material tension:** `supported` entre la fecha planeada y la incertidumbre explícita sobre aplicabilidad/revisión regulatoria. La dirección de la obligación queda sin resolver.

**Expected decision frame:** preparar si la fecha, alcance o secuencia del lanzamiento necesita condiciones de revisión, sujeto a evidencia externa autorizada y autoridad de Compliance. No recomendar lanzar o bloquear sin esa base.

**Expected usable_now:** brief, memo interno, plan de lanzamiento con fecha declarada y owner de Compliance mencionado. No se presume un calendario ni un canal de contacto disponible. Estos elementos delimitan qué debe validarse; no sustituyen evidencia externa.

**Expected unknowns:** qué norma oficial aplica y cómo; qué revisión/aprobación exige y su plazo; quién puede confirmar la interpretación y autorizar el release. `resolution_mode` debe pedir evidencia externa autoritativa o input del dueño designado, no una búsqueda automática de Portfolio Entry.

**Expected first movement characteristics:** preparar brief y memo existentes para que la persona autorizada en Compliance obtenga/valide la fuente oficial aplicable, aclarando qué decisión de fecha/alcance depende de esa validación.

**Prohibited outputs:** consejo legal o conclusión regulatoria; fuente citada como consultada si no fue proporcionada; lookup web automático; lanzamiento autorizado o prohibido; experimento detallado.

**expected_lenses[]:** [`risk`, `evidence / learning`, `governance`, `dependencies`, `sequencing`].<br>
**forbidden_or_unnecessary_lenses[]:** [`priority / allocation`, `capacity`, `alignment`, `system design`, `diagnosis`]; no inferir restricciones de recursos o desalineamiento.<br>
**Expected epistemic behavior:** FACT para plan/fecha, brief, memo y falta de respuesta; UNKNOWN para norma aplicable, obligación y autorización; el memo es evidencia interna, no confirmación regulatoria; INTERPRETATION expone dependencia de fecha/alcance respecto de revisión autorizada; PROPOSAL prepara la consulta con artefactos existentes.<br>
**Expected decision status:** `framed` — preparar condiciones de fecha/alcance/secuencia sujetas a validación externa, sin dictamen legal.<br>
**Expected basis_status:** `partial`; falta evidencia externa y confirmación de autoridad para resolver aplicabilidad/revisión.<br>
**Expected situation insight:** `status = supported`, `novelty_type = sequence_dependency_exposed`, `support[] = [CS-07.launch_date, CS-07.internal_risk_memo, CS-07.no_compliance_response]`; la fecha del plan queda condicionada por revisión no confirmada, sin afirmar qué exige la norma.<br>
**Expected tension record:** `MaterialTension { statement: fecha planeada de lanzamiento convive con incertidumbre explícita sobre aplicabilidad y revisión regulatoria; status: supported; support: [CS-07.launch_date, CS-07.internal_risk_memo, CS-07.no_compliance_response]; why_it_matters: el alcance/secuencia pueden depender de evidencia externa y autoridad aún pendientes; affected_decision: condiciones de fecha, alcance y secuencia del release }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: qué fuente/regla oficial aplica a la funcionalidad; `why_it_matters`: puede cambiar el marco de decisión y riesgo; `current_evidence`: memo interno solicita revisión pero no identifica fuente ni aplicabilidad; `resolution_mode`: obtener evidencia externa autoritativa mediante Compliance/persona autorizada; `related_decision`: condiciones de fecha/alcance; `impact_dimensions`: [`situation_reading`, `decision_frame`, `material_risk`, `starteria_continuation_shape`].
- `uncertainty`: qué revisión o aprobación se exige y cuánto tarda; `why_it_matters`: cambia la secuencia frente a la fecha planificada; `current_evidence`: memo interno y fecha del plan, requisitos/plazo no especificados; `resolution_mode`: evidencia externa autorizada más input organizacional de Compliance; `related_decision`: secuencia y condiciones de release; `impact_dimensions`: [`decision_frame`, `critical_dependency`, `material_risk`, `first_movement`].
- `uncertainty`: quién puede confirmar interpretación y autorizar el release; `why_it_matters`: determina la dependencia crítica y posibilidad de actuar; `current_evidence`: owner de Compliance identificado pero no ha respondido; `resolution_mode`: input organizacional del owner designado y autoridad aplicable; `related_decision`: decisión de release, aún condicionada; `impact_dimensions`: [`decision_frame`, `critical_dependency`, `ability_to_act_now`].

### CS-08 — Una sola iniciativa clara; no forzar reasoning de portfolio

**Context**<br>
Una clínica quiere elevar la tasa de reservas completadas en su sitio del 24% al 30% al cierre del trimestre. Una prueba A/B de dos variantes de la pantalla de reserva ya está activa y termina en dos semanas. Hay una persona responsable de revisar el resultado. No se mencionan otras iniciativas ni dependencias.

**Expected lens family:** evidence / learning y secuencia del checkpoint existente. No exigir priority / allocation, alignment o diseño de portfolio.

**Supported facts:** una iniciativa; objetivo y baseline/target declarados; horizonte trimestral; prueba ya activa con fecha de cierre; responsable identificado.<br>
**Forbidden inference:** que una variante ganará; que el cambio causó conversión; que 30% es alcanzable; que hace falta una cartera, nueva investigación o más iniciativas.

**Expected material tension:** `unresolved` salvo que la salida identifique otra condición explícita del contexto que enfrente cursos de acción. Objetivo más prueba en curso no constituyen por sí solos una tensión.

**Expected decision frame:** en el checkpoint existente, preparar si mantener, ajustar o usar una variante según los resultados de reservas completadas y los límites de la prueba. No crear decisión de priorización de portfolio.

**Expected usable_now:** baseline/target declarados, prueba activa, sus dos variantes, fecha de cierre y responsable. Usar el resultado ya planificado antes de proponer otro estudio.

**Expected unknowns:** resultado de reservas completadas al cierre; si la prueba observa el outcome declarado. Cada unknown explica cómo puede cambiar la decisión contextual y cita el test como evidencia pendiente o disponible, sin atribuir causalidad de antemano. No inventar limitaciones del test.

**Expected first movement characteristics:** aprovechar el checkpoint ya programado para revisar la métrica de reservas completadas y preparar una decisión de mantener/ajustar; no iniciar un flujo de portfolio ni diseñar otro experimento.

**Prohibited outputs:** inventario de portfolio; alineamiento estratégico; presupuesto o ranking; conclusión antes del resultado; causalidad no demostrada; plan experimental completo.

**expected_lenses[]:** [`evidence / learning`, `sequencing`].<br>
**forbidden_or_unnecessary_lenses[]:** [`priority / allocation`, `diagnosis`, `dependencies`, `governance`, `capacity`, `risk`, `alignment`, `system design`]; no forzar un análisis de portfolio por existir una iniciativa.<br>
**Expected epistemic behavior:** FACT para objetivo declarado, iniciativa única, prueba activa, fecha y responsable; UNKNOWN para resultado pendiente y correspondencia exacta de la métrica; INTERPRETATION puede aclarar cómo el checkpoint habilita preparar una decisión, sin atribuir efecto causal; PROPOSAL reutiliza la revisión existente.<br>
**Expected decision status:** `framed` — decisión contextual del checkpoint sobre cómo usar el resultado disponible, no priorización de cartera.<br>
**Expected basis_status:** `partial`; la prueba está activa y su resultado/ajuste métrico aún no están disponibles.<br>
**Expected situation insight:** `status = supported`, `novelty_type = decision_structure_clarified`, `support[] = [CS-08.goal, CS-08.active_test, CS-08.review_owner]`; explicita que hay una decisión de checkpoint posible, sin afirmar el resultado.<br>
**Expected tension record:** `MaterialTension { statement: no se demuestra una tensión material entre objetivo y prueba activa; status: unresolved; support: [CS-08.goal, CS-08.active_test]; why_it_matters: no inferir conflicto solo por coexistir objetivo y prueba; affected_decision: decisión contextual del checkpoint }`.<br>
**Expected decision-changing unknowns:**
- `uncertainty`: qué resultado arrojará la métrica de reservas completadas al cierre; `why_it_matters`: puede cambiar el uso de variantes en el checkpoint; `current_evidence`: prueba activa con cierre en dos semanas, resultado pendiente; `resolution_mode`: observar/reutilizar el resultado del trabajo ya activo en el checkpoint previsto; `related_decision`: decisión contextual de variante; `impact_dimensions`: [`decision_frame`, `first_movement`, `ability_to_act_now`].
- `uncertainty`: si la medición de la prueba corresponde al outcome de reservas completadas; `why_it_matters`: si no corresponde, el resultado puede no informar la decisión buscada; `current_evidence`: objetivo de reservas completadas y dos variantes de pantalla, definición de métrica del test no aportada; `resolution_mode`: revisar el diseño/métrica ya existente con la persona responsable; `related_decision`: cómo interpretar y usar el checkpoint; `impact_dimensions`: [`situation_reading`, `decision_frame`, `first_movement`].

No elevar a unknown crítico tamaño de muestra, causalidad o limitaciones no señaladas: no hay base en el fixture para tratarlas como gaps materiales.

## 5. Aserciones semánticas comunes

Revisar en todos los fixtures:

- **Grounding / epistemic role:** distinguir `FACT`, `INTERPRETATION`, `PROPOSAL` y `UNKNOWN`. FACT enlaza a declaración/evidencia; INTERPRETATION a su soporte; PROPOSAL sigue sin decidir por la persona; UNKNOWN nombra explícitamente algo no resuelto. `epistemic_role` describe la naturaleza de la afirmación, no su origen.
- **Provenance:** conservar separadamente origen/autoría (`origin`), review disposition, fuente/evidence y fecha disponible; no reemplazar esas dimensiones por `epistemic_role`.
- **Contradicciones:** conservar posiciones o datos incompatibles, y no elegir silenciosamente una versión.
- **Material tension:** `CriticalSituationSynthesis.material_tensions[]` admite 0..N items; `SituationModel.material_tensions` representa la misma colección, no otra fuente de verdad. Una expectativa singular por fixture no fija máximo: solo incluir varias si cada una aporta una diferencia material. Cada item conserva `statement`, `status`, `support[]`, `why_it_matters` y `affected_decision`. `support[]` referencia contexto/claims disponibles, nunca private reasoning. Si `support[]` está vacío no puede ser `supported`; sin soporte, usar `unresolved` o ausencia. CS-05, CS-06 y CS-08 esperan `unresolved`.
- **Situation insight:** debe tener `statement`, `support[]`, `novelty_type`, `epistemic_role = INTERPRETATION` y `status`; debe explicitar una relación, tensión, estructura de decisión o dependencia útil. Una paráfrasis elegante no cuenta. Se acepta `no_supported_insight` donde cada fixture lo espera.
- **Decision frame:** refleja una decisión real, autoridad conocida/desconocida y alternativas condicionales si las soporta el caso; no decide por la persona ni cae por defecto en seguir/parar. `desired_change` (cambio/resultado buscado) no es alias del frame (elección a preparar); el frame puede ser `not_yet_identifiable`.
- **Usable now:** referencia activos o trabajo ya declarado y explica el uso posible antes de abrir trabajo nuevo.
- **Unknowns:** cada item material contiene `uncertainty`, `why_it_matters`, `current_evidence`, `resolution_mode`, `related_decision` e `impact_dimensions[]`. Distinguir acción/reutilización, input organizacional y evidencia externa autorizada cuando corresponda. Los gaps nice-to-have se omiten.
- **Candidate first movement:** cuando exista, indica `movement`, `why_now`, `existing_assets_used[]`, `what_it_may_clarify`, `decision_supported` y `boundary`; cuando no exista soporte, devuelve `null`.
- **Material Decision Impact:** `impact_dimensions[]` usa `situation_reading`, `decision_frame`, `material_tension`, `first_movement`, `critical_dependency`, `material_risk`, `ability_to_act_now` y `starteria_continuation_shape`. Esta última dimensión solo indica que una respuesta podría cambiar forma/nivel de continuación posterior; no genera Starteria Path. Esto prepara una superficie futura de consumo, no selecciona preguntas ni modifica Question Planner.
- **Uncertainty statement:** es condicional; si se emite, resume solo los unknowns materiales ya declarados y no añade hechos, inferencias ni gaps. Si no hay unknowns materiales, es `null` o absent.
- **Boundaries:** no implementar Live Understanding UI, UI final, frontend, Portfolio Setup, Starteria Path completo, CTA, autenticación/conversión, canonicalización, entidades Core, Steps, scoring definitivo, thresholds, diseño completo de experimentos ni Question Planner runtime. El output puede ser consumido por fases posteriores, pero estos documentos no implementan esas fases.

## 6. Anti-template / adaptabilidad

### Comparación de patrones esperados

| Fixture | Expected reasoning difference | Failure if same as | Key contrast |
|---|---|---|---|
| CS-01 Laura | Allocation/secuencia de capacidad ante señales de churn rezagadas y revisión próxima; insight/tensión soportados, sin atribución causal. | CS-02 si se convierte en un problema de gobernanza; CS-03 si se reduce a preparar renovación; CS-05 si el mero número de iniciativas produce diagnóstico. | Horizonte trimestral y capacidad analítica compartida con evidencia de outcome rezagada. |
| CS-02 Aceleradora | Diagnosticar progresión/gobernanza con historial y explicaciones divergentes; localizar transición antes de rediseñar, sin comparar conteos con denominador desconocido. | CS-05 si ambos se tratan como “muchas iniciativas = gobernanza”; CS-01 si se vuelve asignación de capacidad sin soporte. | Existen cohortes, transiciones, minutas y relatos conflictivos; faltan criterios documentados. |
| CS-03 Tecnología comprada | Preparar decisión de continuidad/condiciones con contrato, piloto y outcome sin baseline. | CS-07 si la respuesta se vuelve búsqueda regulatoria externa; CS-01 si se convierte en portfolio ranking. | Activo tecnológico existente, uso interno y renovación cercana; no se conoce outcome. |
| CS-04 Dependencia externa | Separar preparación independiente de validación real condicionada por permiso y autoridad organizacional. | CS-07 si se afirma obligación regulatoria; CS-03 si se trata como decisión de inversión. | Existe trabajo que puede avanzar con muestras ficticias; acceso real requiere aprobación organizacional. |
| CS-05 “Innovar más” | Abstenerse de insight/tensión y dejar decision frame `not_yet_identifiable`; aclarar significado antes de priorizar. | CS-01/CS-02 si el inventario por sí solo activa allocation, diagnóstico o gobernanza; CS-06 si se ignora el inventario utilizable. | Hay inventario limitado a nombres/owners/estados, pero no un objetivo operacional ni evidencia de progresión. |
| CS-06 Ambigüedad | Insufficient basis, no insight, tensión ni movimiento; un unknown material puede precisar el objeto. | CS-05 si no se aprovecha ni conserva el inventario existente; cualquier caso concreto si inventa lente dominante. | No hay resultado, iniciativa, actor, evidencia ni activo específico. |
| CS-07 Regulatorio | Preparar decisión dependiente de fuente externa y autoridad Compliance; no emitir conclusión normativa. | CS-03 si solo se usa deadline y documentos internos; CS-04 si se trata como permiso de datos. | La incertidumbre central exige evidencia oficial externa y validación autorizada. |
| CS-08 Una iniciativa | Usar prueba/checkpoint ya activo para preparar decisión local, sin portfolio reasoning ni tensión forzada. | CS-01/02/05 si activa allocation, gobernanza o ranking; CS-06 si ignora prueba/objetivo existentes. | Una iniciativa clara, objetivo y checkpoint próximo con owner; no se declara dependencia de portfolio. |

Una coincidencia de lente no implica plantilla: cada fixture debe diferir en soporte, decisión, activos aprovechables, unknowns y modo de resolución.

### Firma semántica a comparar

El reviewer compara, sin exact-match textual, la firma de cada salida:

1. qué consideración soportada activa las lentes relevantes;
2. `material_tension.status` y las condiciones que forman (o no forman) la tensión;
3. objeto, autoridad y amplitud de la decisión que se prepara;
4. qué activo existente se usa primero y qué incertidumbre puede reducir;
5. unknowns prioritarios y modos de resolución;
6. propósito, assets usados y boundary del primer movimiento;
7. qué puede cambiar según el Material Decision Impact Test.

Coincidencias de estilo, esquema, vocabulario o una lente común no cuentan como repetición del razonamiento.

### Pares de contraste obligatorios

- **CS-01 vs CS-05:** ambas tienen muchas iniciativas; CS-01 soporta una decisión de secuencia/capacidad ante horizonte y señales rezagadas; CS-05 no sabe aún qué significa “innovar más” y no puede diagnosticar el portfolio.
- **CS-02 vs CS-05:** CS-02 tiene hechos de progresión y gobernanza que permiten localizar un mecanismo; CS-05 no tiene evidencia de un cuello de botella.
- **CS-03 vs CS-07:** ambos tienen un deadline y una incertidumbre; CS-03 prepara continuidad de inversión con uso/outcome internos existentes, CS-07 depende de fuente regulatoria externa y autoridad de Compliance.
- **CS-04 vs CS-07:** ambos tienen dependencia; CS-04 distingue trabajo preparatorio independiente de permiso organizacional; CS-07 debe validar aplicabilidad externa antes de decidir release.
- **CS-08 vs CS-01/CS-02/CS-05:** una iniciativa con prueba vigente no debe producir la misma lectura de allocation, gobernanza o portfolio que casos multi-iniciativa.

### Criterio de fallo

La capacidad falla adaptabilidad si dos fixtures de contraste, conceptualmente distintos en sus hechos o decisión material, terminan con esencialmente el mismo patrón de razonamiento y recomendación: misma tensión/estado sin justificar, mismo objeto decisional, mismo uso de activos, mismo tipo de unknown y mismo primer movimiento, aunque cambie el wording. También falla si fuerza tensión o un movimiento equivalente en los tres casos `unresolved`.

El evaluator debe nombrar qué diferencias del fixture fueron borradas y qué cláusula del contrato no se cumplió. Si una salida activa todas las lentes o aplica una cadena fija, también falla. Un parecido textual aislado no es fallo; una receta universal que ignore diferencias materiales sí lo es. No se fija un score final ni un umbral numérico en esta fase.

## 7. Protocolo de revisión futura

Cuando exista autorización e implementación por separado:

1. congelar versión del Skill y esta suite como baseline antes de evaluar una candidate;
2. pasar cada fixture por separado y conservar outputs y provenance para revisión;
3. completar las aserciones comunes y la firma semántica por fixture;
4. revisar explícitamente los pares de contraste;
5. reportar hallazgos por grounding, no-insight, decisiones, usable-now, unknowns, movement, provenance, autoridad y adaptabilidad;
6. corregir contratos o fixtures con trazabilidad; no ajustar una respuesta para coincidir con texto exacto;
7. no presentar el resultado como runtime/product evidence hasta ejecutar el harness autorizado y declarar la evidencia real.

Este protocolo no especifica runner, adapter, schema ejecutable, prompt, modelo, scoring ni threshold. No se ejecutaron runtime tests en esta iteración.
