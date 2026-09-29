# STARTERIA — Portfolio Lead E2E Testing Harness v0.1

**Estado:** PROPUESTO PARA EJECUCIÓN DE TESTING  
**Vertical:** Portfolio Lead → First Value → Setup → Handoff → Monitoring → Results  
**Tipo:** Product / UX E2E Harness  
**Objetivo:** Validar si Startería genera valor desde la primera visita y evoluciona hacia una experiencia de seguimiento continuo que permite al Portfolio Lead entender qué ocurre, qué necesita atención y qué decisión se aproxima sin revisar iniciativa por iniciativa.

---

# 0. Fuentes de experiencia consolidadas

Este Harness consolida:

1. `STARTERIA_PORTFOLIO_LEAD_FIRST_VALUE_E2E_TEST_v0.1.md`
2. `STARTERIA_PORTFOLIO_LEAD_FIRST_ANALYTICAL_VALUE_STEP2_v0.1.md`
3. `STARTERIA_PORTFOLIO_LEAD_RELATIONSHIP_REVIEW_STEP3_v0.1.md`
4. `STARTERIA_PORTFOLIO_LEAD_OWNERSHIP_CONFIRMATION_STEP4_v0.1.md`
5. `STARTERIA_PORTFOLIO_LEAD_MONITORING_ACTIVATION_STEP5_v0.1.md`

Este Harness valida experiencia.  
No redefine Core, Handoff ni Steps.

---

# 1. Pregunta principal del test

> Si mañana tuvieras que gestionar 20–30 iniciativas, ¿Startería te ayudaría a entender qué necesita tu atención, qué falta abordar y qué decisión se aproxima sin revisar iniciativa por iniciativa?

---

# 2. Hipótesis de valor

La experiencia gana valor cuando el usuario percibe esta secuencia:

```text
Entiendo qué puedo hacer
        ↓
Empiezo desde mi realidad
        ↓
Startería interpreta
        ↓
Me ayuda a ordenar
        ↓
Yo confirmo
        ↓
Asigno responsables
        ↓
Las iniciativas comienzan
        ↓
Startería empieza a devolver contexto
        ↓
Vuelvo y sé dónde intervenir
        ↓
Puedo entender resultados y decisiones
```

---

# 3. Principio rector

> Portfolio Lead observes and intervenes; Initiative Owner executes.

El Harness debe detectar cualquier momento en que:

- Portfolio Lead empieza a ejecutar trabajo de Steps;
- Startería toma decisiones organizacionales;
- IA convierte sugerencias en verdad confirmada;
- el sistema obliga a completar estructura antes de entregar valor;
- monitoring se convierte en un dashboard genérico.

---

# 4. Modalidad de test

## 4.1 Tester

Perfil ideal:

- Innovation Lead;
- Transformation Lead;
- Product Lead;
- PMO / Strategy;
- Growth / Operations Lead;
- responsable de un programa de iniciativas.

No necesita conocer Startería.

---

## 4.2 Formato

Duración recomendada:

```text
45–60 minutos
```

Estructura:

```text
Acto 1 — First Value
Acto 2 — Build the workspace
Acto 3 — Activation
Acto 4 — Return / Monitoring
Acto 5 — Results / Decision
```

---

# 5. Caso de prueba base — NovaGrowth

El tester recibe únicamente este contexto general:

> Eres responsable de dar trazabilidad a varias iniciativas vinculadas al crecimiento de una nueva línea de negocio. Dirección quiere conseguir 200 nuevas ventas B2B durante Q4. La información está dispersa entre una hoja de seguimiento, notas y conversaciones. Quieres ordenar el trabajo, saber quién se hace cargo y poder detectar dónde intervenir sin revisar cada proyecto por separado.

No se le entrega una estructura de:

- Frente;
- Reto;
- Initiative;
- alerts;
- Insights.

Startería empieza vacía.

---

# 6. Portfolio Test Pack

El tester recibe información desestructurada que puede pegar o introducir.

## Objetivo declarado

Dirección quiere conseguir:

```text
200 nuevas ventas de una nueva línea B2B durante Q4.
```

## Iniciativas

### Content Campaign
Campaña de contenidos para generar leads empresariales.  
Owner mencionado: Laura.

### Lead Assistant
Asistente para responder y cualificar leads comerciales.  
Owner mencionado: Ana.

### Pricing Pilot
Prueba de pricing para una nueva propuesta comercial.  
Owner mencionado: Carlos.

### Channel Partners
Exploración de partners para captar nuevas oportunidades.  
Owner mencionado: Marta.

### Checkout Optimizer
Prueba para reducir fricción durante la contratación.  
Owner: no claro.

### CRM Follow-up
Automatización de seguimiento de leads.  
Owner mencionado: Luis.

### Webinar Series
Webinars para captar potenciales clientes.  
Owner: no claro.

## Contexto adicional

- Pricing Pilot tiene feedback inicial positivo.
- Lead Assistant está esperando acceso a datos del CRM.
- No existe una lectura común de cómo cada iniciativa contribuye al objetivo.
- Dirección quiere revisar avance dentro de seis semanas.

---

# 7. ACTO 1 — First Value

## 7.1 Pantalla inicial

Objetivo:

> El usuario entiende rápidamente qué puede conseguir y cómo empezar.

Esperado:

```text
Preparar mi espacio de trabajo
Traer lo que ya tengo
Empezar una iniciativa

✦ Preguntar a Startería
```

No mostrar taxonomía interna.

---

## 7.2 Tarea

Moderador:

> Acabas de entrar por primera vez a Startería. Eres responsable de varias iniciativas y quieres empezar a ordenar cómo darles seguimiento. Utiliza la plataforma como lo harías normalmente.

No explicar qué CTA usar.

---

## 7.3 Qué observar

- primera acción;
- dudas;
- comprensión de promesa;
- descubrimiento del Copilot;
- expectativa de valor;
- percepción de carga.

---

# 8. ACTO 2 — Build the workspace

## 8.1 Activación de guía

Esperado:

```text
Tu guía de inicio

○ Define qué quieres conseguir
○ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Empieza a dar seguimiento
```

La guía:

- es finita;
- puede minimizarse;
- desaparece al completar setup;
- no se convierte en navegación permanente.

---

## 8.2 Entrada de información

El tester introduce el Portfolio Test Pack.

Startería procesa:

```text
Entendiendo qué quieres conseguir
Identificando trabajo existente
Buscando relaciones
Detectando información por revisar
Preparando primera lectura
```

---

## 8.3 First Analytical Value

Startería debe devolver:

### Lo que entendió

```text
Meta declarada
200 nuevas ventas · Q4

Trabajo detectado
7 iniciativas

Responsables identificados
5 detectados
2 por revisar
```

### Primera organización provisional

```text
Generar oportunidades
- Content Campaign
- Channel Partners
- Webinar Series

Trabajar oportunidades
- Lead Assistant
- CRM Follow-up

Convertir oportunidades
- Pricing Pilot
- Checkout Optimizer
```

### Máximo 2–3 señales

Por ejemplo:

- mayor concentración antes de conversión;
- dos responsables por revisar;
- Lead Assistant con dependencia CRM.

---

# 9. Checkpoint de First Value

Preguntar al tester:

> ¿Qué te está diciendo Startería que no veías tan claramente antes?

Registrar textual.

Failure crítico si responde:

> Solo me ordenó lo mismo que ya puse.

---

# 10. Relationship Review

La guía pasa a:

```text
✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Empieza a dar seguimiento
```

Startería muestra:

```text
Objetivo
↓
espacios propuestos
↓
iniciativas
```

---

## 10.1 Tareas

Pedir al tester:

1. explicar qué está viendo;
2. abrir el porqué de una agrupación;
3. mover una iniciativa;
4. corregir un grupo;
5. identificar si hay un gap;
6. confirmar o rechazar subdivisión.

---

## 10.2 Terminología

No introducir `Reto` antes de que aporte valor.

Después de aceptación:

> Estos espacios se gestionarán como Retos.

Definición contextual:

> Una parte concreta del objetivo que quieres abordar y seguir por separado.

---

# 11. Ownership Confirmation

La guía:

```text
✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
○ Confirma responsables
○ Empieza a dar seguimiento
```

Vista compacta:

```text
Content Campaign     Laura       Confirmar
Lead Assistant       Ana         Confirmar
Pricing Pilot        Carlos      Confirmar
Channel Partners     Marta       Confirmar
CRM Follow-up        Luis        Confirmar
Checkout Optimizer   Sin owner   Asignar
Webinar Series       Sin owner   Asignar
```

Agrupado por contexto cuando aporte orientación.

---

## 11.1 Tareas

- confirmar owner;
- corregir owner incorrecto;
- asignar owner;
- dejar uno pendiente;
- explicar qué significa owner;
- identificar qué ocurre después.

---

# 12. Boundary Handoff

El tester debe entender:

```text
owner confirmado
≠
initiative started
```

Después:

```text
Portfolio Lead
→ Handoff existente
→ Accept / Reject
→ Activation Overview
→ explicit Start
```

El Harness no redefine este flujo.

---

# 13. ACTO 3 — Activation

## 13.1 Estado intermedio

Ejemplo:

```text
5 iniciativas listas para Handoff
2 pendientes de responsable
```

El usuario puede continuar con las listas.

---

## 13.2 Guide completion rule

Para testing:

```text
GUIDE COMPLETE =
estructura confirmada
+
ownership mínimo revisado
+
>= 1 Initiative STARTED
+
first active home rendered
```

No exigir que todo el portafolio esté completo.

---

# 14. First Active Home

Pregunta principal:

> ¿Cómo quedó preparado mi sistema de trabajo?

Home esperada:

```text
Tus objetivos
─────────────────────────────

Crecimiento nuevo negocio

Meta
200 nuevas ventas · Q4

Trabajo
2 activas · 3 esperando activación

Pendiente
2 sin responsable

Ver frente →


Lecturas Startería
─────────────────────────────

El trabajo iniciado hasta ahora se concentra
en generación y tratamiento de oportunidades.

Conversión tiene menos trabajo iniciado.

Ver análisis →


Necesita de ti
─────────────────────────────

Checkout Optimizer
Sin responsable confirmado

Resolver →


✦ Preguntar a Startería
```

No mostrar métricas no trazables.

---

# 15. Checkpoint A — Valor después del setup

Preguntar:

> ¿Qué valor crees que te está dando Startería hasta ahora?

No sugerir respuestas.

Registrar si menciona espontáneamente:

- claridad;
- organización;
- relación objetivo–trabajo;
- gaps;
- ownership;
- priorización;
- control.

---

# 16. ACTO 4 — Return / Monitoring

El moderador simula paso del tiempo:

> Han pasado dos semanas. Mañana tienes una reunión de seguimiento y vuelves a Startería.

Actualizar datos.

---

# 17. Estado simulado después de dos semanas

### Content Campaign
STARTED.  
Avanzó de Step 1 a Step 2.  
Sin atención requerida.

### Lead Assistant
STARTED.  
Bloqueada por acceso CRM.  
Solicita apoyo Portfolio.

### Pricing Pilot
STARTED.  
Nueva evidencia observada.  
Decisión próxima.

### Channel Partners
STARTED.  
Avance normal.

### Checkout Optimizer
Owner pendiente.

### CRM Follow-up
STARTED.  
Sin cambios materiales.

### Webinar Series
Handoff rechazado con motivo.  
Requiere respuesta Portfolio.

---

# 18. Segunda Home

Pregunta principal:

> ¿Qué cambió y dónde necesito intervenir?

Esperado:

```text
Tus objetivos
────────────────────────────

Crecimiento nuevo negocio
Meta: 200 nuevas ventas · Q4

Alerta · 1
Bloqueo · 1
Decisión próxima · 1


Qué cambió
────────────────────────────

Content Campaign avanzó.
Pricing Pilot registró nueva evidencia.
Channel Partners sigue sin incidencias.


Lecturas Startería
────────────────────────────

Crecimiento nuevo negocio · Activación

Lead Assistant es actualmente la única Initiative
STARTED dentro de este Reto y está bloqueada.

Mientras siga así, ese espacio no tiene trabajo
ejecutable avanzando.

Ver análisis →


Necesita de ti
────────────────────────────

Lead Assistant
Apoyo solicitado · Acceso CRM
Abrir →

Webinar Series
Asignación rechazada
Resolver →

Pricing Pilot
Decisión próxima
Revisar →


✦ Preguntar a Startería
```

---

# 19. Tareas de Monitoring

Pedir al tester:

1. identificar qué necesita su atención;
2. explicar por qué Lead Assistant aparece en Home;
3. encontrar qué cambió;
4. revisar un Insight;
5. abrir una intervención;
6. encontrar una decisión próxima;
7. ignorar señales que no requieren acción.

---

# 20. Signal Relevance — expectativa

## No llega a Home

- cambio operativo menor;
- evidence añadida sin cambio material;
- avance normal;
- espera normal de Start sin deadline material.

## Llega a Home

- Portfolio action required;
- decisión;
- bloqueo material que necesita Portfolio;
- Handoff rechazado;
- patrón transversal;
- cambio estratégico relevante.

---

# 21. ACTO 5 — Results / Decision

El tester entra a:

```text
Resultados
```

La navegación interna:

```text
Resumen
Objetivos
Decisiones
Aprendizajes
```

---

## 21.1 Resultados tempranos

Si no existe impacto defendible:

> Tus iniciativas están generando evidencia, pero todavía no existe suficiente información para afirmar impacto.

Mostrar:

```text
5 iniciativas activas
1 señal observada
1 decisión próxima
```

No inventar ROI ni resultado actual.

---

## 21.2 Decisión

Pricing Pilot:

```text
Decisión solicitada
Ampliar prueba a dos regiones

Evidencia
3 señales favorables
1 incertidumbre material

Recomendación equipo
Ampliar controladamente

Recomendación Startería
La evidencia permite considerar ampliación,
pero no respalda rollout completo.

Autoridad requerida
Director Comercial
```

Portfolio Lead prepara/escala/decide según su autoridad.

---

# 22. Checkpoint B — Valor recurrente

Preguntar:

> ¿Qué cambió ahora respecto a lo que podrías hacer con tu herramienta actual?

Registrar espontáneamente si aparece:

- sé dónde mirar;
- no necesito perseguir a todos;
- entiendo relación con objetivo;
- puedo detectar gaps;
- veo decisiones;
- veo qué me necesita;
- puedo explicar mejor a dirección.

---

# 23. Métricas de First Value

Registrar:

```text
time_to_first_action
time_to_first_understanding
time_to_first_useful_insight
setup_burden
trust_in_interpretation
willingness_to_continue
```

Escala recomendada 1–5 para las tres últimas.

---

# 24. Métricas de Structure Value

Registrar:

```text
objective_relationship_comprehension
challenge_purpose_comprehension
initiative_context_comprehension
editability
perceived_control
structure_value
```

---

# 25. Métricas de Monitoring Value

Registrar:

```text
time_to_identify_attention
number_of_initiatives_opened
attention_accuracy
noise_perception
redundancy_perception
insight_usefulness
copilot_context_value
monitoring_value
```

---

# 26. Métricas de Decision Value

Registrar:

```text
decision_context_comprehension
evidence_comprehension
authority_comprehension
recommendation_trust
executive_readiness
```

---

# 27. Rubric de valor 1–5

Después de la sesión:

## V1 — Orientation

> Entendí rápidamente cómo empezar.

## V2 — First Value

> Startería me devolvió una lectura útil antes de pedirme demasiada configuración.

## V3 — Structure

> La estructura objetivo → trabajo → iniciativas me ayudó a comprender mejor mi portafolio.

## V4 — Attention

> Startería me ayudó a saber dónde mirar.

## V5 — Reasoning

> Startería me ayudó a entender por qué algo importaba.

## V6 — Intervention

> Entendí claramente qué necesitaba de mí.

## V7 — Decision

> Startería me ayudó a preparar una decisión mejor sustentada.

## V8 — Efficiency

> Esta experiencia reduciría trabajo manual de seguimiento.

## V9 — Trust

> Las conclusiones de Startería parecían sustentadas y corregibles.

## V10 — Recurrence

> Usaría esta Home de forma recurrente.

---

# 28. Pregunta de diferenciación

Preguntar textualmente:

> ¿Qué obtienes aquí que hoy no obtienes fácilmente con Excel, Jira, Notion, Power BI o reuniones de seguimiento?

No ofrecer opciones.

---

# 29. Pregunta decisiva final

> Si mañana tuvieras que gestionar 20–30 iniciativas, ¿usarías Startería para saber qué necesita tu atención, qué falta abordar y qué decisión se aproxima? ¿Por qué?

---

# 30. Failure taxonomy

## F-ENTRY
No entiende qué hacer al entrar.

## F-FIRST-VALUE
La primera lectura no aporta nada nuevo.

## F-TAXONOMY
La ontología interna bloquea comprensión.

## F-STRUCTURE
No comprende objetivo → Reto → Initiative.

## F-AI-TRUST
No entiende por qué Startería propone algo.

## F-AUTHORITY
IA o sistema parece decidir por el humano.

## F-OWNERSHIP
No distingue Portfolio Lead de Initiative Owner.

## F-HANDOFF
Confunde owner confirmado con Start.

## F-HOME-NOISE
Home tiene demasiada información.

## F-REPETITION
La misma señal aparece repetida.

## F-ATTENTION
No distingue lo que necesita acción.

## F-INSIGHT
Insight parece dato obvio o arbitrario.

## F-COPILOT
Copilot se siente genérico.

## F-RESULTS
Confunde actividad/evidence con impacto.

## F-DECISION
No entiende qué decisión espera ni quién decide.

---

# 31. Findings Register format

Cada hallazgo debe registrarse:

```text
FND-PM-XXX

Observed behavior:
...

Evidence:
- tester
- task
- timestamp / step

Impact:
...

Current hypothesis affected:
...

Recommendation:
...

Status:
OBSERVED / SUPPORTED / CONFIRMED / REJECTED
```

No actualizar contratos directamente por una observación aislada.

---

# 32. Session Result

Por tester:

```text
Tester:
Profile:
Date:

ACTO 1
PASS / REVIEW / FAIL
Notes:

ACTO 2
PASS / REVIEW / FAIL
Notes:

ACTO 3
PASS / REVIEW / FAIL
Notes:

ACTO 4
PASS / REVIEW / FAIL
Notes:

ACTO 5
PASS / REVIEW / FAIL
Notes:

VALUE SCORES
V1:
V2:
...
V10:

Top value perceived:
Biggest confusion:
Would reuse:
Yes / Maybe / No

Critical quote:
...
```

---

# 33. Criterio inicial de soporte

La experiencia puede pasar a Contract Definition si:

1. no aparecen fallos sistemáticos de autoridad;
2. mayoría entiende la primera entrada sin explicación;
3. First Value no se percibe como resumen genérico;
4. estructura ayuda más de lo que complica;
5. usuario identifica atención sin abrir todas las iniciativas;
6. Insights obtienen >=4/5 de utilidad promedio;
7. Copilot contextual obtiene >=4/5;
8. Monitoring reduce carga percibida;
9. recomendaciones se perciben sustentadas;
10. intención de uso recurrente es >=4/5 en mayoría de testers.

Estos thresholds son hipótesis iniciales, no Core.

---

# 34. Qué NO se valida todavía

No evaluar todavía:

- performance técnico;
- backend final;
- arquitectura de events;
- persistencia definitiva;
- conectores;
- SSO;
- permisos enterprise finales;
- exactitud de un modelo LLM productivo;
- diseño visual pixel-perfect;
- escalabilidad de infraestructura.

---

# 35. Decisión posterior al test

```text
TEST
↓
Observaciones
↓
Findings Register
↓
¿La hipótesis tiene soporte?
├─ NO → iterar experiencia
└─ SÍ
   ↓
Experience Contract
↓
Data Semantics Contract
↓
Signal Relevance Contract
↓
Insight Contract
↓
Copilot Recommendation Contract
↓
Technical Design
```

---

# 36. Definition of Done del Harness

El Harness v0.1 está listo cuando:

- el caso NovaGrowth puede ejecutarse de principio a fin;
- existe un guion de moderador;
- existen tareas observables;
- existen métricas;
- existe failure taxonomy;
- existe formato de findings;
- First Value y Monitoring se evalúan por separado;
- la experiencia puede iterarse sin tocar Core;
- existe criterio claro para decidir si avanzar a contratos.

---

# 37. Principio final

> El test no debe demostrar que Startería puede almacenar un portafolio.

Debe demostrar que:

> Startería entiende el contexto suficiente para devolver una lectura útil, ayuda a organizarlo sin quitar autoridad al usuario y, con el tiempo, reduce el esfuerzo necesario para saber qué merece atención y qué decisión se aproxima.
