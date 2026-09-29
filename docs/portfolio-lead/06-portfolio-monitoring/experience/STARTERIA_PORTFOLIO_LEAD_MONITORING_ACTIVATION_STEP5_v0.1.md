# STARTERIA — Portfolio Lead Monitoring Activation & First Active Home — Step 5 v0.1

**Estado:** PROPUESTA PARA TESTING  
**Vertical:** Portfolio Lead → First Value → Setup → Monitoring  
**Depende de:**
- `STARTERIA_PORTFOLIO_LEAD_FIRST_VALUE_E2E_TEST_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_FIRST_ANALYTICAL_VALUE_STEP2_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_RELATIONSHIP_REVIEW_STEP3_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_OWNERSHIP_CONFIRMATION_STEP4_v0.1.md`

**Consume:** vertical cerrado `Portfolio Lead → Initiative Owner Handoff`

**Objetivo:** Validar cómo Startería cierra el setup inicial, transiciona al seguimiento real y entrega una primera Home activa con valor inmediato sin confundir asignación, Handoff y Start.

---

# 1. Punto de entrada

Este paso comienza cuando el Portfolio Lead ya:

```text
✓ definió qué quiere conseguir
✓ incorporó trabajo existente
✓ revisó cómo se relaciona
✓ confirmó responsables
```

Estado de guía:

```text
Tu guía de inicio · 4 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
✓ Confirma responsables
○ Empieza a dar seguimiento
```

Existen iniciativas en distintos estados posibles:

```text
OWNER_CONFIRMED
HANDOFF_PENDING
HANDOFF_ACCEPTED
HANDOFF_REJECTED
START_READY
STARTED
```

El Paso 5 no redefine esos estados.

---

# 2. Regla fundamental

> Activar seguimiento NO inicia una Initiative.

Mantener:

```text
handoff_assignment_started != initiative_started
```

Una iniciativa solo entra en seguimiento de ejecución activo después del `Start` explícito gobernado por el Handoff existente.

---

# 3. Job del Portfolio Lead

> Ya organicé el trabajo y definí responsables. Quiero dejar el espacio funcionando y empezar a entender cómo avanzan las iniciativas sin revisar cada una manualmente.

---

# 4. Qué significa “Empieza a dar seguimiento”

No es un nuevo estado canónico de Initiative.

Es un **milestone de experiencia del workspace**:

```text
estructura confirmada
+
owners revisados
+
al menos una Initiative realmente STARTED
+
Startería ya puede construir una lectura Portfolio útil
```

Cuando esto ocurre:

```text
workspace_experience:
SETUP
→ ACTIVE
```

Esto es una hipótesis de experiencia para testing, no todavía un schema productivo.

---

# 5. Antes de que exista una Initiative STARTED

Si hay owners confirmados pero todavía ninguna iniciativa comenzó:

```text
Tu guía de inicio · 4 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
✓ Confirma responsables
○ Empieza a dar seguimiento
```

Mostrar una transición clara:

# Tu espacio ya está organizado

El siguiente paso es que las personas responsables reciban el contexto y comiencen las iniciativas que ya están listas.

Resumen:

```text
7 iniciativas

5 preparadas para Handoff
2 pendientes de responsable
```

CTA:

`Preparar asignaciones`

Esto deriva al Handoff existente.

No:

`Iniciar todas`

---

# 6. Mientras existen Handoffs pendientes

La guía permanece visible, pero no bloquea al Portfolio Lead.

Ejemplo:

```text
Empieza a dar seguimiento

2 iniciativas iniciadas
2 esperando respuesta
1 aceptada y lista para comenzar
2 pendientes de responsable
```

Acciones:

```text
[Ver asignaciones]
[Resolver pendientes]
```

Startería puede comenzar a mostrar información de las iniciativas `STARTED`, pero la guía no desaparece hasta que el usuario haya experimentado la primera lectura activa.

---

# 7. Criterio de cierre de la guía

Para el test v0.1, proponer:

```text
GUIDE COMPLETE =
estructura inicial confirmada
+
ownership mínimo revisado
+
>= 1 Initiative STARTED
+
first_active_home_rendered
```

No exigir:

- que todas las iniciativas hayan empezado;
- que no existan owners pendientes;
- que todos los Handoffs hayan sido aceptados;
- que existan resultados observados;
- que exista evidencia avanzada.

La guía debe ayudar a llegar al primer valor recurrente, no convertirse en checklist de completitud administrativa.

---

# 8. Momento de transición

Cuando la primera Initiative llega a `STARTED`, Startería muestra:

# Ya puedes empezar a dar seguimiento

> Tu espacio está listo para mostrar cómo el trabajo activo se relaciona con tus objetivos y cuándo necesita tu atención.

CTA:

`Ver mi seguimiento`

Al pulsar:

```text
SETUP
→ ACTIVE
```

La guía se completa.

---

# 9. Desaparición de la guía

Después de entrar por primera vez en la Home activa:

```text
Tu guía de inicio
✓ completada
```

Puede mostrarse una confirmación breve:

> Tu espacio está listo.

Y después desaparece de la Home.

No mantener:

- 5/5;
- celebraciones persistentes;
- onboarding permanente;
- widget de configuración ocupando espacio.

La configuración sigue siendo accesible desde una acción secundaria si el usuario necesita revisarla.

---

# 10. Primera Home activa

La Home debe generar valor con la información realmente disponible.

No esperar semanas para ser útil.

Layout conceptual:

```text
Inicio                                       Q4

Tus objetivos
────────────────────────────────────────────────

[Crecimiento nuevo negocio]
Meta
200 nuevas ventas

Q4 · faltan 42 días

En seguimiento

Iniciativas activas · 2
Esperando activación · 3

Ver frente →


Lecturas Startería
────────────────────────────────────────────────

Crecimiento nuevo negocio · Estructura

El trabajo que ya está activo se concentra en
generación y tratamiento de oportunidades.

Conversión todavía tiene menos trabajo iniciado.

Esta lectura cambiará a medida que las demás
iniciativas comiencen.

[Ver análisis →]


Necesita de ti
────────────────────────────────────────────────

Checkout Optimizer
Todavía no tiene responsable confirmado.
[Resolver →]


✦ Preguntar a Startería
```

---

# 11. Primera Home ≠ dashboard de resultados

En este momento Startería probablemente todavía NO conoce:

- ventas actuales;
- impacto;
- contribution observed;
- evidence strength avanzada;
- decision readiness.

Por tanto no mostrar:

```text
43% progreso
86 ventas actuales
impacto estimado
portfolio health score
cobertura suficiente
```

si no existe fuente defendible.

La primera Home puede generar valor desde:

```text
estructura
+
estado de activación
+
ownership
+
relaciones confirmadas
+
señales reales disponibles
```

---

# 12. Card de Frente — First Active State

Ejemplo:

```text
Crecimiento nuevo negocio

Meta
200 nuevas ventas · Q4

Trabajo
2 activas · 3 esperando activación

Pendiente
2 sin responsable

Ver frente →
```

Si existe una señal material:

```text
Alerta · 1
```

Siempre con label, no solo icono.

---

# 13. Insights permitidos inmediatamente

Aunque todavía no exista evidence avanzada, Startería puede generar Insights de estructura confirmada.

Ejemplos:

### Distribución

> Las iniciativas activadas hasta ahora están concentradas en generación de oportunidades.

### Ownership

> Dos iniciativas asociadas al objetivo todavía no tienen responsable confirmado.

### Activation

> Tres iniciativas tienen owner confirmado pero todavía no han comenzado.

### Structural gap

Solo si existe una estructura confirmada:

> Conversión es un Reto confirmado y todavía no tiene iniciativas iniciadas.

No afirmar:

> Esto impedirá conseguir la meta.

salvo evidencia adicional.

---

# 14. “Necesita de ti” en First Active Home

Puede contener únicamente acciones que realmente correspondan al Portfolio Lead.

Ejemplos:

```text
Owner pendiente
Handoff rechazado que requiere respuesta
dependencia escalada desde una Initiative STARTED
decisión pendiente
```

No incluir:

- Initiative aún sin empezar cuando simplemente espera al owner;
- tareas internas de Steps;
- evidencia pendiente que corresponde al equipo;
- cambios sin acción necesaria.

---

# 15. Pending Activation no es Alert

Diferenciar:

```text
WAITING
=
proceso normal todavía no completado

ATTENTION
=
necesita una acción Portfolio
```

Ejemplo:

```text
Ana aceptó y todavía no hizo Start
```

puede ser:

> Esperando inicio

No necesariamente:

> Alerta.

Si existe un deadline material y la espera empieza a afectar el objetivo, entonces puede elevarse posteriormente.

---

# 16. Copilot en primera Home activa

Contexto:

```text
role = portfolio_lead
workspace_state = ACTIVE
experience_maturity = newly_activated
```

El Copilot cambia desde onboarding a portfolio reasoning.

Preguntas sugeridas:

- ¿Qué debería revisar primero?
- ¿Cómo está distribuido el trabajo?
- ¿Qué iniciativas todavía no comenzaron?
- ¿Hay algo que necesite de mí?
- ¿Qué información falta para poder evaluar resultados?
- ¿Qué cambiará cuando las iniciativas empiecen a generar evidencia?

Ejemplo:

> Ahora mismo la principal lectura disponible es estructural: qué trabajo está activo, qué sigue pendiente y cómo se distribuye respecto al objetivo. A medida que las iniciativas generen evidencia, podré ayudarte a analizar contribución, riesgos y decisiones.

Esta respuesta debe calibrar expectativas.

---

# 17. Primera visita activa vs segunda visita

## Primera Home activa

Startería responde:

> ¿Cómo quedó preparado mi sistema de trabajo?

Predominan:

- estructura;
- activación;
- ownership;
- primeros gaps;
- próximas acciones.

## Segunda visita

Startería responde:

> ¿Qué cambió y dónde necesito intervenir?

Predominan:

- cambios;
- evidence;
- blockers;
- attention;
- Insights;
- decisiones.

No diseñar ambas Homes como experiencias idénticas.

---

# 18. Simulación temporal para testing

Después de que el tester vea la primera Home activa:

> Han pasado dos semanas. Algunas iniciativas avanzaron y ahora vuelves a Startería antes de una reunión de seguimiento.

Actualizar el caso NovaGrowth:

### Content Campaign
STARTED.
Avanzó de Step 1 a Step 2.
Sin atención necesaria.

### Lead Assistant
STARTED.
Bloqueada por acceso CRM.
Solicita apoyo Portfolio.

### Pricing Pilot
STARTED.
Nueva evidencia observada.
Está preparando decisión.

### Channel Partners
STARTED.
Avance normal.

### Checkout Optimizer
Owner todavía pendiente.

### CRM Follow-up
STARTED.
Sin cambios materiales.

### Webinar Series
Handoff rechazado con motivo.
Requiere respuesta Portfolio.

---

# 19. Segunda Home — Monitoring real

```text
Inicio                                      Q4

Tus objetivos
──────────────────────────────────────────

[Crecimiento nuevo negocio]
Meta: 200 nuevas ventas
Q4 · faltan 28 días

Alerta · 1
Bloqueo · 1
Decisión próxima · 1

Ver frente →


Qué cambió
──────────────────────────────────────────

Content Campaign avanzó a Step 2.
Pricing Pilot añadió una señal observada.
Channel Partners continúa sin incidencias.


Lecturas Startería
──────────────────────────────────────────

Crecimiento nuevo negocio · Activación

Lead Assistant es actualmente la única Initiative
STARTED dentro de este Reto y está bloqueada.

Mientras siga así, este espacio no tiene trabajo
ejecutable avanzando.

[Ver análisis →]


Necesita de ti
──────────────────────────────────────────

Lead Assistant
Apoyo solicitado · Acceso CRM
[Abrir →]

Webinar Series
Asignación rechazada · requiere respuesta
[Resolver →]

Pricing Pilot
Decisión próxima
[Revisar →]


✦ Preguntar a Startería
```

---

# 20. Evitar repetición

La misma señal se representa según nivel.

Ejemplo:

```text
Lead Assistant bloqueada
```

## Initiative
Detalle completo.

## Reto
`Bloqueo · 1`

## Frente
`Bloqueo · 1`

## Home
Aparece solo porque necesita Portfolio action.

## Insight
Aparece adicionalmente solo porque cambia materialmente la lectura del Reto.

No repetir el mismo texto en varios widgets dentro de Home.

---

# 21. Resultados todavía pueden estar vacíos

Si el usuario entra a Resultados demasiado pronto:

No mostrar un dashboard vacío.

Ejemplo:

# Resultados

> Tus iniciativas ya están activas, pero todavía no existe suficiente evidencia para mostrar resultados defendibles.

Lo que sí sabemos:

```text
5 iniciativas activas
1 señal observada
1 decisión próxima
```

CTA:

`Ver evidencia disponible`

Copilot:

> Puedo explicarte qué información todavía falta antes de poder hablar de impacto.

---

# 22. Qué activa valor posterior

Con el paso del tiempo:

```text
semantic signals
+
evidence
+
context
+
history
```

permiten que Startería evolucione desde:

```text
structural insights
```

hacia:

```text
execution insights
evidence insights
decision insights
impact insights
```

La experiencia debe ganar profundidad a medida que el sistema aprende del portafolio.

---

# 23. Acceptance Criteria

## AC-P5-01 — No false Start

El usuario entiende que activar seguimiento no inicia automáticamente una Initiative.

## AC-P5-02 — Guide closure

La guía desaparece después de que el workspace produce la primera Home activa.

## AC-P5-03 — Partial activation

El Portfolio puede empezar seguimiento aunque existan iniciativas todavía pendientes.

## AC-P5-04 — Immediate value

La primera Home produce al menos una lectura útil basada en estructura real sin inventar resultados.

## AC-P5-05 — Pending vs Attention

El usuario distingue espera normal de algo que requiere su intervención.

## AC-P5-06 — First vs recurrent Home

La segunda visita prioriza cambios y atención, no configuración.

## AC-P5-07 — Signal relevance

Solo señales materiales alcanzan Home.

## AC-P5-08 — No repetition

Una misma situación no se repite varias veces con wording distinto en Home.

## AC-P5-09 — Copilot mode change

El Copilot deja de orientar setup y comienza a razonar sobre el portafolio.

## AC-P5-10 — Results honesty

Resultados no muestra impacto sin evidencia defendible.

---

# 24. Test Script — transición

Moderador:

> Ya has organizado el trabajo y confirmado responsables. Continúa hasta sentir que el espacio está listo para que puedas volver en unos días a revisar cómo va.

Observar:

- si cree que `Activar seguimiento` inicia las iniciativas;
- si entiende Handoff;
- cuándo espera que desaparezca la guía;
- si la primera Home aporta valor;
- si identifica pendientes sin sentirse bloqueado.

---

# 25. Test Script — segunda visita

Moderador:

> Han pasado dos semanas. Mañana tienes una reunión y quieres entender rápidamente qué ha cambiado y si hay algo que necesite de ti.

No indicar:

- qué iniciativa está bloqueada;
- qué card abrir;
- qué decisión revisar.

Medir comportamiento espontáneo.

---

# 26. Preguntas post-task

1. ¿Qué te dijo la primera Home después del setup?
2. ¿Qué diferencia viste al volver dos semanas después?
3. ¿Qué necesita realmente de ti ahora?
4. ¿Qué cosas pudiste ignorar?
5. ¿Por qué Startería mostró Lead Assistant en Inicio?
6. ¿Entendiste qué parte era dato y qué parte era interpretación?
7. ¿Te ayudó a evitar abrir Initiative por Initiative?
8. ¿Volverías a esta Home para una reunión semanal?
9. ¿Qué buscarías en Resultados?
10. ¿Qué esperarías que el Copilot supiera ahora?

---

# 27. Success Metrics

## Activation

- guide_completion_comprehension;
- false_start_rate;
- time_to_first_active_home;
- first_home_usefulness 1–5.

## Recurrent monitoring

- time_to_identify_attention;
- number_of_initiatives_opened_before_correct_action;
- signal_relevance_accuracy;
- perceived_noise 1–5;
- perceived_redundancy 1–5;
- copilot_context_value 1–5;
- monitoring_value 1–5.

## Critical metric

> ¿Pudo saber qué necesitaba su atención sin revisar Initiative por Initiative?

---

# 28. Failure Signals

Revisar si:

- la guía desaparece demasiado pronto;
- nunca desaparece;
- `Activar seguimiento` parece Start;
- la Home inicial parece vacía;
- muestra resultados inventados;
- pendientes normales se convierten en alertas;
- la segunda Home repite setup;
- el usuario abre todas las iniciativas para entender qué pasó;
- los Insights son obvios;
- Copilot sigue comportándose como onboarding;
- Resultados parece roto por falta de datos.

---

# 29. Boundary técnico

Este documento NO define todavía:

- nuevo estado persistido `workspace_experience`;
- evento `monitoring_activated`;
- read model;
- endpoint;
- polling;
- websocket;
- cache;
- schema productivo.

Esos elementos pertenecen al futuro Technical Design.

El test valida la experiencia antes de elegir implementación.

---

# 30. Cierre del Setup Journey

Con este Paso 5 queda testeable el journey:

```text
Paso 1
Primera visita
        ↓
Paso 2
First Analytical Value
        ↓
Paso 3
Relationship Review
        ↓
Paso 4
Ownership Confirmation
        ↓
Handoff existente
        ↓
Paso 5
First Active Home
        ↓
segunda visita
        ↓
Continuous Monitoring
```

El siguiente artefacto ya no debe añadir otro paso de setup.

Debe consolidar los cinco pasos en un único **Portfolio Lead E2E Testing Harness v0.1** ejecutable con casos, observaciones, findings y criterios de decisión.
