# STARTERIA — Portfolio Lead E2E Prototype Spec v0.1

**Estado:** PROPUESTA PARA PROTOTIPADO Y TESTING  
**Vertical:** Portfolio Lead → First Value → Portfolio Setup → Monitoring  
**Tipo:** Prototype Spec / UX Validation  
**Objetivo:** Definir el prototipo mínimo necesario para probar si Startería puede llevar a un Portfolio Lead funcional desde cero hasta una estructura de portafolio clara y un seguimiento continuo útil, fácil y confiable.

---

# 1. Decisión de producto consolidada

La entrada principal se mantiene como:

## Preparar mi espacio

Startería no empieza preguntando:

- qué Frente existe;
- qué Reto existe;
- qué Initiative existe;
- qué herramienta usa;
- cuántos proyectos tiene.

Empieza preguntando:

> ¿Qué quieres conseguir o tener bajo control?

Luego contrasta ese objetivo con:

- trabajo ya existente;
- iniciativas;
- owners;
- documentos;
- notas;
- estructura actual.

Principio:

```text
entender intención estratégica
↓
contrastar con trabajo existente
↓
organizar
↓
confirmar
↓
asignar
↓
activar
↓
seguir
```

---

# 2. Hipótesis principal

Un Portfolio Lead percibirá mayor valor y confianza si Startería:

1. empieza desde lo que quiere lograr;
2. acepta información desordenada;
3. interpreta antes de pedir configuración;
4. propone estructura sin imponerla;
5. mantiene al humano en control;
6. conserva contexto estratégico al navegar;
7. muestra solo lo que merece atención;
8. evoluciona de setup a monitoring sin cambiar de modelo mental.

---

# 3. Qué debe demostrar el prototipo

El prototipo debe permitir observar si el usuario puede llegar a:

```text
0
↓
entiendo qué puedo hacer
↓
explico qué quiero lograr
↓
traigo lo que ya tengo
↓
Startería lo interpreta
↓
reviso relaciones
↓
confirmo responsables
↓
activo trabajo
↓
veo una Home útil
↓
vuelvo después
↓
entiendo qué cambió
↓
sé dónde intervenir
```

---

# 4. Alcance del prototipo

## In scope

- primera visita;
- CTA `Preparar mi espacio`;
- guía temporal;
- definición del objetivo;
- entrada de información existente;
- First Analytical Value;
- propuesta de relaciones;
- introducción progresiva de Retos;
- confirmación de owners;
- transición a Handoff;
- primera Home activa;
- segunda visita;
- monitoring;
- Resultados/Decisión;
- Copilot contextual.

## Out of scope

- backend real;
- ingestión documental real;
- invitations reales;
- auth real;
- semantic events productivos;
- read models;
- persistence;
- integrations;
- AI productiva;
- dashboards finales;
- permisos enterprise definitivos.

---

# 5. Caso base

Usar:

## NovaGrowth

Objetivo:

> 200 nuevas ventas B2B durante Q4.

Trabajo existente:

- Content Campaign
- Lead Assistant
- Pricing Pilot
- Channel Partners
- Checkout Optimizer
- CRM Follow-up
- Webinar Series

Owners parciales.

Señales:

- Pricing Pilot con feedback positivo.
- Lead Assistant bloqueada por CRM.
- 2 iniciativas sin owner.
- Dirección revisará avance en 6 semanas.

---

# 6. Prototype Map

El prototipo debe incluir estas superficies:

```text
P0 — Primera visita
P1 — Definir qué quiere conseguir
P2 — Añadir lo que ya tiene
P3 — First Analytical Value
P4 — Revisar relaciones
P5 — Confirmar responsables
P6 — Handoff transition
P7 — First Active Home
P8 — Second Visit / Monitoring
P9 — Front Detail
P10 — Challenge Detail
P11 — Initiative Executive Overview
P12 — Results / Decision
P13 — Copilot Drawer contextual
```

No todas requieren igual fidelidad.

---

# 7. P0 — Primera visita

## Pregunta principal

> ¿Cómo quieres preparar tu espacio?

## CTA dominante

### Preparar mi espacio

Subcopy:

> Empieza por lo que quieres conseguir. Después puedes incorporar las iniciativas y el trabajo que ya tienes.

## Acción secundaria

### Empezar una iniciativa

Para quien llega con una Initiative concreta.

## Copilot

> ¿No sabes por dónde empezar? Cuéntame tu situación.

## No mostrar

- dashboard vacío;
- Frentes;
- Retos;
- KPIs;
- alertas;
- porcentajes;
- taxonomía interna.

---

# 8. P1 — Definir qué quiere conseguir

Activar guía:

```text
Tu guía de inicio

○ Define qué quieres conseguir
○ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Empieza a dar seguimiento
```

Pregunta:

> ¿Qué quieres conseguir o tener bajo control?

Input natural.

Ejemplo NovaGrowth:

> Dirección quiere conseguir 200 nuevas ventas B2B este trimestre y necesito entender cómo el trabajo que ya tenemos contribuye a ese objetivo.

CTA:

> Continuar

---

# 9. P2 — Añadir lo que ya tiene

Después del objetivo:

> Ahora añade el trabajo que ya existe relacionado con esto.

Opciones:

### Pegar información
Textarea grande.

### Subir información
Visible como acción de prototipo.

### Contárselo a Startería
Abrir Copilot.

Importante:

> No necesitas ordenar la información antes.

---

# 10. Variante a testear — upload desde el inicio

En P1 puede existir:

> ¿Ya tienes información sobre este objetivo?

`Añadir ahora`

Pero no debe desplazar la pregunta estratégica.

Secuencia:

```text
qué quiero conseguir
+
qué tengo hoy
```

No:

```text
subir archivo
→ IA decide qué quiero conseguir
```

Testing debe observar si:

- el upload temprano reduce fricción;
- o hace que el usuario salte demasiado rápido a datos sin aclarar intención.

---

# 11. P3 — First Analytical Value

Esta pantalla debe ser el primer momento fuerte de valor.

## Bloque A — Lo que entendí

> Quieres entender cómo el trabajo existente está ayudando a conseguir 200 nuevas ventas B2B durante Q4 y dónde necesitas intervenir.

## Bloque B — Trabajo detectado

Compacto:

```text
7 iniciativas
5 responsables mencionados
2 por revisar
```

## Bloque C — Primera lectura

Debe dominar visualmente.

Ejemplo:

> El trabajo parece concentrarse en tres momentos diferentes:

```text
Generar oportunidades
3 iniciativas

Trabajar oportunidades
2 iniciativas

Convertir oportunidades
2 iniciativas
```

## Bloque D — Qué merece revisar

Máximo 2–3:

- concentración;
- owners faltantes;
- dependencia material.

CTA principal:

> Revisar cómo se relaciona

---

# 12. Regla visual de First Value

Jerarquía:

```text
Insight
> estructura
> inventario
```

Nunca:

```text
7 iniciativas
5 owners
2 pendientes
```

como elemento dominante.

---

# 13. P4 — Revisar relaciones

Visual:

```text
Objetivo
200 nuevas ventas B2B

↓
Espacios propuestos

Generar oportunidades
├ Content Campaign
├ Channel Partners
└ Webinar Series

Trabajar oportunidades
├ Lead Assistant
└ CRM Follow-up

Convertir oportunidades
├ Pricing Pilot
└ Checkout Optimizer
```

Acciones:

- mover;
- renombrar;
- dividir;
- fusionar;
- dejar sin agrupar;
- rechazar propuesta.

---

# 14. Introducción de Reto

Antes de confirmar:

> espacio / agrupación

Después de confirmar:

> Estos espacios se gestionarán como Retos.

Ayuda:

> Un Reto es una parte concreta del objetivo que quieres abordar y seguir por separado.

No obligar a mostrar Reto si visualmente no aporta valor en un caso simple.

---

# 15. Rationale accesible

Cada agrupación debe permitir:

> ¿Por qué están juntas?

Ejemplo:

> Las tres iniciativas parecen orientadas a generar nuevas oportunidades antes de activación o conversión.

No mostrar chain-of-thought.

Mostrar señales comprensibles.

---

# 16. P5 — Confirmar responsables

Vista compacta y jerárquica.

```text
Generar oportunidades

Content Campaign      Laura      Confirmar responsable
Channel Partners      Marta      Confirmar responsable
Webinar Series        —          Asignar responsable
```

Wording:

> Responsable mencionado

antes de confirmación.

Después:

> Responsable confirmado

No usar `Confirmar` solo.

Usar:

> Confirmar como responsable

---

# 17. Distinción owner vs assignment

Antes de continuar:

> Confirmar quién se hará cargo no envía todavía la asignación.

CTA:

> Preparar asignaciones

Luego consume Handoff existente.

---

# 18. P6 — Handoff transition

No prototipar nuevamente toda la experiencia Handoff.

Mostrar únicamente una transición:

```text
5 iniciativas tienen responsable confirmado.

El siguiente paso es enviarlas a las personas
responsables para que acepten el contexto y
comiencen cuando estén listas.

[Preparar asignaciones]
```

Después simular estados del Handoff existente.

---

# 19. P7 — First Active Home

Una vez al menos una Initiative está `STARTED`:

> Tu espacio está listo.

La guía desaparece después de esta primera Home.

---

# 20. First Active Home — jerarquía

## A. Frentes compactos

Ejemplo:

```text
Crecimiento nuevo negocio

Meta
200 nuevas ventas · Q4

En seguimiento

Pendiente · 2

Ver frente →
```

No mostrar todos los counts como elementos grandes.

---

## B. Lecturas Startería

Ejemplo:

> El trabajo iniciado se concentra en generación y tratamiento de oportunidades. Conversión todavía tiene menos trabajo activo.

`Ver análisis →`

---

## C. Necesita de ti

Solo:

- owners faltantes que necesita resolver;
- Handoff rejected;
- blocker escalado;
- decision ready.

---

## D. Copilot

> ¿Qué debería revisar primero?

---

# 21. P8 — Segunda visita

Simular 2 semanas.

Cambios:

- Content Campaign avanzó;
- Lead Assistant bloqueada;
- Pricing Pilot nueva evidence;
- Webinar Series Handoff rejected;
- Channel Partners estable;
- Checkout Optimizer owner pendiente.

---

# 22. Second Home

Jerarquía:

## Tus objetivos

Cards compactas.

## Qué cambió

Solo cambios materiales.

NO incluir estados estables.

## Lecturas Startería

Ejemplo:

> Lead Assistant es la única Initiative STARTED en Activación y está bloqueada. Mientras siga así, ese Reto no tiene trabajo ejecutable avanzando.

## Necesita de ti

- Lead Assistant
- Webinar Series
- Pricing Pilot

---

# 23. P9 — Front Detail

Pregunta:

> ¿Cómo estamos intentando mover este objetivo?

Mostrar:

- meta;
- horizonte;
- Strategic Frame resumido;
- Retos;
- iniciativas;
- evidencia agregada;
- signals;
- Startería analysis.

---

# 24. P10 — Challenge Detail

Pregunta:

> ¿Cómo estamos abordando esta parte del objetivo?

Mostrar:

- Front padre;
- objetivo del Reto;
- Initiatives;
- coverage facts;
- possible gaps;
- possible overlap;
- evidence agregada;
- decisions.

No mostrar:

- coverage score;
- sufficient coverage automático.

---

# 25. P11 — Initiative Executive Overview

Portfolio Lead ve:

- Front;
- Challenge;
- owner;
- Step;
- next milestone;
- timing;
- changes;
- evidence summary;
- blocker;
- support request;
- decision target.

No editar Steps.

---

# 26. P12 — Results

Tabs:

```text
Resumen
Objetivos
Decisiones
Aprendizajes
```

Si no existe impacto:

> Todavía no existe suficiente evidencia para afirmar impacto.

No dashboard vacío.

---

# 27. Decision Detail

Pricing Pilot:

```text
Decisión
Ampliar piloto a dos regiones

Evidence
3 señales favorables
1 incertidumbre

Equipo recomienda
...

Startería recomienda
...

Autoridad
Director Comercial
```

---

# 28. P13 — Copilot Drawer

Persistente pero discreto.

Trigger:

> ✦ Preguntar a Startería

No ocupar permanentemente un tercio del layout.

---

# 29. Copilot modes

## SETUP

- orienta;
- explica;
- reduce taxonomía;
- ayuda a interpretar.

## STRUCTURE REVIEW

- explica agrupaciones;
- señala gaps;
- compara propuestas.

## ACTIVE

- explica qué cambió;
- prioriza atención;
- conecta señales.

## FRONT

- analiza cobertura y distribución.

## CHALLENGE

- analiza iniciativas dentro del Reto.

## INITIATIVE

- explica contexto ejecutivo.

## RESULTS

- distingue evidence, result e impact.

## EXECUTIVE

- resume y prepara decisiones.

---

# 30. Confianza y provenance

Cuando Startería afirma algo, el prototipo debe distinguir visualmente:

### Dato proporcionado

> Declarado por ti

### Información detectada

> Encontrado en la información añadida

### Lectura Startería

> Interpretación de Startería

### Recomendación Startería

> Sugerencia para revisar

No usar badges técnicos constantes.

Debe sentirse natural.

---

# 31. Qué debe ser clickable

Obligatorio:

- Preparar mi espacio;
- guía;
- añadir información;
- continuar;
- revisar organización;
- abrir rationale;
- mover Initiative;
- confirmar estructura;
- confirmar owner;
- dejar owner pendiente;
- preparar Handoff;
- ver First Active Home;
- entrar a Frente;
- entrar a Reto;
- abrir Initiative;
- abrir Attention;
- abrir Insight;
- abrir Resultados;
- abrir Decision;
- abrir Copilot.

---

# 32. Qué puede ser mock

- extracción de texto;
- clasificación IA;
- suggestions;
- Handoff states;
- semantic events;
- passage of time;
- evidence levels;
- metric sources;
- Decision Brief;
- Copilot responses.

El prototipo necesita reproducibilidad, no inteligencia real todavía.

---

# 33. Escenarios testables

## Scenario A — path principal

Preparar espacio
→ objetivo
→ añadir trabajo
→ First Value
→ confirmar estructura
→ owners
→ Handoff
→ First Home
→ Second Visit

## Scenario B — upload temprano

Objetivo
→ añadir archivo desde P1/P2
→ First Value

## Scenario C — corrección IA

Mover Initiative
→ renombrar grupo
→ rechazar suggestion

## Scenario D — incomplete setup

Dejar 2 owners pendientes
→ activar otras iniciativas
→ Home sigue funcionando

## Scenario E — recurrent monitoring

Volver 2 semanas después
→ resolver attention
→ revisar decision

---

# 34. Findings del desk run incorporados

## D01 — entrada

**Decisión:** mantener `Preparar mi espacio` como CTA principal.

`Traer lo que ya tengo` pasa a ser una forma de comenzar dentro de esa ruta, no un job competitivo.

## D02 — First Value

Insight domina sobre inventario.

## D03 — rationale

Agrupaciones siempre explicables.

## D04 — ownership provenance

`Responsable mencionado` → `Responsable confirmado`.

## D05 — owner vs assignment

Separar confirmación de owner de Handoff.

## D06 — tracking copy

Usar:

> Empieza a dar seguimiento

como milestone.

Evitar CTA masivo ambiguo:

> Activar seguimiento.

## D07 — First Home

Minimizar setup inventory.

## D08 — signal reuse

Una señal puede reutilizarse solo si cada superficie añade una función cognitiva distinta.

## D09 — What changed

Solo cambios.

## D10 — Results language

Usar lenguaje de negocio.

---

# 35. Métricas del prototipo

## First Value

- time_to_first_value;
- clarity 1–5;
- insight usefulness 1–5;
- trust 1–5.

## Setup

- setup burden 1–5;
- relation comprehension;
- owner comprehension;
- completion confidence.

## Monitoring

- time_to_attention;
- unnecessary clicks;
- perceived noise;
- insight usefulness;
- copilot value.

## Decision

- evidence comprehension;
- decision clarity;
- authority clarity.

---

# 36. Critical Success Test

Después del journey completo:

> Si tuvieras 20–30 iniciativas, ¿te sentirías capaz de usar esta experiencia para saber qué necesita tu atención sin revisar cada iniciativa?

Registrar:

```text
Sí
Tal vez
No
```

y motivo textual.

---

# 37. Prototype DoD

El prototipo está listo cuando:

- el journey principal es clicable de principio a fin;
- la guía desaparece;
- First Value aparece antes de setup completo;
- estructura puede corregirse;
- owners pueden confirmarse;
- Handoff no se reimplementa;
- First Home es útil sin resultados inventados;
- Second Visit muestra monitoring realista;
- Results distingue evidence/result/impact;
- Copilot cambia de comportamiento por contexto;
- NovaGrowth puede ejecutarse reproduciblemente.

---

# 38. Qué ocurre después

```text
Prototype
↓
Portfolio Lead testing
↓
Findings Register
↓
Iteración
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

No saltar a Tech Design antes de probar el prototipo.

---

# 39. Principio final

> Startería debe llevar al Portfolio Lead de “tengo objetivos e iniciativas dispersas” a “entiendo cómo se conectan, quién debe actuar y qué merece mi atención” con la menor fricción posible y sin quitarle control sobre la estructura ni las decisiones.
