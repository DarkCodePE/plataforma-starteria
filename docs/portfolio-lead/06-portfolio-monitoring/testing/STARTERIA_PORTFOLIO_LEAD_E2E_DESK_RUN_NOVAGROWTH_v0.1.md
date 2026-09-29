# STARTERIA — Portfolio Lead E2E Desk Run — NovaGrowth v0.1

**Estado:** DESK SIMULATION / NO ES EVIDENCIA DE USUARIO  
**Harness:** `STARTERIA_PORTFOLIO_LEAD_E2E_TESTING_HARNESS_v0.1.md`  
**Caso:** NovaGrowth  
**Objetivo:** Detectar contradicciones, fricción potencial, repetición y gaps de producto antes de construir un prototipo para testing con Portfolio Leads reales.

---

# 1. Regla de interpretación

Este documento NO valida hipótesis UX.

Los resultados se clasifican como:

- `DESK-PASS` — el flujo es coherente internamente;
- `DESK-REVIEW` — existe una fricción o ambigüedad que debe probarse;
- `DESK-FAIL` — existe una contradicción evidente con el modelo o con la experiencia pretendida.

Los findings resultantes son hipótesis para testing, no findings confirmados.

---

# 2. ACTO 1 — Primera visita

## Experiencia propuesta

Opciones:

1. Preparar mi espacio de trabajo.
2. Traer lo que ya tengo.
3. Empezar una iniciativa.
4. Preguntar a Startería.

## Simulación

Usuario NovaGrowth:

> Ya tengo siete iniciativas y necesito ordenarlas alrededor de un objetivo de ventas.

### Problema potencial

Dos opciones pueden parecer correctas simultáneamente:

- `Preparar mi espacio de trabajo`;
- `Traer lo que ya tengo`.

Para un Portfolio Lead con iniciativas existentes, ambas expresan parte del mismo job.

### Lectura

El usuario podría preguntar:

> Si traigo lo que ya tengo, ¿no estoy también preparando mi espacio?

## Resultado

`DESK-REVIEW`

## Hipótesis de ajuste

Mantener un CTA principal orientado al resultado:

### Preparar mi espacio de trabajo

Y dentro de esa experiencia permitir:

```text
Empezar desde:
- lo que ya tengo
- un objetivo
- explicándole mi situación a Startería
```

`Empezar una iniciativa` puede permanecer como ruta secundaria claramente distinta.

No congelar el ajuste hasta probarlo con usuarios.

---

# 3. Guía de inicio

## Propuesta

```text
○ Define qué quieres conseguir
○ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Empieza a dar seguimiento
```

## Simulación

El checklist comunica:

- finitud;
- progreso;
- siguiente paso;
- relación entre configuración y valor posterior.

No parece necesario convertir cada punto en página separada.

## Riesgo

`Añade el trabajo que ya existe` podría sonar como carga manual extensa.

El copy o Copilot debería dejar claro:

> Puedes pegar, importar o describir lo que ya tienes; no necesitas ordenarlo antes.

## Resultado

`DESK-PASS`, con copy a testear.

---

# 4. ACTO 2 — Entrada + First Analytical Value

## Input NovaGrowth

Objetivo:

> 200 nuevas ventas B2B durante Q4.

7 iniciativas desestructuradas.

## Salida propuesta

Startería sintetiza:

```text
Meta declarada
200 nuevas ventas · Q4

Trabajo detectado
7 iniciativas

Responsables detectados
5
2 por revisar
```

Y propone tres grupos:

```text
Generar oportunidades
Trabajar oportunidades
Convertir oportunidades
```

## Valor potencial

La salida ya supera un mero inventario porque conecta trabajo con diferentes momentos del objetivo.

## Riesgo 1 — modelo impuesto

La agrupación reproduce un funnel comercial razonable, pero el usuario nunca declaró explícitamente que ése sea su modelo estratégico.

Debe quedar visualmente claro:

> Propuesta Startería basada en lo que describiste.

Y cada grupo debe permitir:

> ¿Por qué lo agrupaste así?

## Riesgo 2 — provenance de owners

`5 responsables identificados` puede interpretarse como confirmados.

Preferir:

> 5 responsables mencionados en la información.

Hasta Step 4.

## Resultado

`DESK-PASS` con dos guardrails de UX.

---

# 5. Primer Aha Moment

Pregunta:

> ¿Qué aporta Startería que no estaba explícito en el input?

Respuesta esperada del caso:

- relación entre iniciativas;
- concentración del trabajo;
- posibles espacios distintos;
- ownership incompleto;
- dependencia relevante.

## Riesgo

Si la primera lectura solo muestra:

```text
7 iniciativas
5 owners
2 sin owner
```

no existe First Analytical Value.

El valor debe residir principalmente en:

> cómo se distribuye el trabajo respecto al objetivo.

## Resultado

`DESK-PASS` siempre que el Insight aparezca por encima del inventario.

---

# 6. ACTO 2 → 3 — Progression de guía

La guía avanza:

```text
✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Empieza a dar seguimiento
```

## Pregunta

¿Es legítimo marcar los dos primeros como completos si el sistema solo interpretó información?

Sí para la experiencia, siempre que:

- el objetivo tenga suficiente soporte;
- el trabajo haya sido realmente detectado;
- se mantenga como provisional donde corresponda.

No significa canonicalización.

## Resultado

`DESK-PASS`.

---

# 7. ACTO 2/3 — Copilot

## Preguntas útiles

- ¿Por qué agrupaste esto así?
- ¿Qué parece menos abordado?
- ¿Hay iniciativas similares?
- ¿Qué falta para ordenar mejor esto?

## Riesgo

Si Copilot responde directamente:

> Deberías crear un Reto de conversión.

sería demasiado prescriptivo.

Secuencia correcta:

```text
Observación
→ interpretación
→ incertidumbre
→ alternativa
```

Ejemplo:

> La información actual muestra menos trabajo relacionado con conversión. No sé todavía si eso representa un gap deliberado. Podemos revisarlo antes de crear trabajo nuevo.

## Resultado

`DESK-PASS`.

---

# 8. ACTO 3 — Relationship Review

## Vista

```text
Objetivo
200 nuevas ventas B2B

Propuesta:

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

## Lectura

La correlación visual es clara.

La Initiative mantiene contexto superior.

## Reto

Antes de confirmar:

> grupos / espacios de trabajo.

Después:

> Estos espacios se gestionarán como Retos.

## Resultado

`DESK-PASS`.

---

# 9. Caso simple dentro del mismo modelo

Si existiera:

```text
Objetivo
Reducir aprobaciones a ≤2 días

Initiative
Approval Flow Automation
```

mostrar:

```text
Objetivo
└ Approval Flow Automation
```

es más claro visualmente que:

```text
Objetivo
└ Reto casi idéntico
   └ Approval Flow Automation
```

## Boundary

Esto es progressive disclosure visual.

No cambia el dominio canónico.

## Resultado

`DESK-PASS`.

---

# 10. Gap sin trabajo

Supongamos que el usuario confirma:

```text
Generación
Activación
Conversión
```

y Conversión no tiene Initiative.

Correcto:

> Conversión no tiene trabajo asociado actualmente.

Incorrecto:

> 67% de cobertura.

Incorrecto:

> Cobertura insuficiente.

## Copilot

Puede preguntar:

> ¿Quieres revisar si este espacio necesita trabajo ahora?

## Resultado

`DESK-PASS`.

---

# 11. Posible solapamiento

Dos iniciativas:

```text
Content Campaign
AI Content Campaign
```

muestran:

- audiencia similar;
- mecanismo similar;
- cambio esperado similar.

Correcto:

> Posible solapamiento.

Acción:

`Comparar`

Incorrecto:

> Duplicadas.

## Resultado

`DESK-PASS`.

---

# 12. ACTO 3 → 4 — Confirmación de estructura

Checkpoint:

```text
Objetivo
200 nuevas ventas B2B

3 Retos
7 iniciativas relacionadas

[Confirmar organización]
```

## Riesgo de wording

`Confirmar organización` puede confundirse con crear/configurar una Organization empresarial.

Preferir en UX:

> `Usar esta estructura`

o:

> `Confirmar estructura`

## Resultado

`DESK-REVIEW` de copy.

---

# 13. ACTO 4 — Ownership Confirmation

Vista jerárquica compacta:

```text
Generar oportunidades
Content Campaign     Laura       Confirmar
Channel Partners     Marta       Confirmar
Webinar Series       —           Asignar

Trabajar oportunidades
Lead Assistant       Ana         Confirmar
CRM Follow-up        Luis        Confirmar

Convertir oportunidades
Pricing Pilot        Carlos      Confirmar
Checkout Optimizer   —           Asignar
```

## Valor

Mantiene contexto.

Permite resolver ownership sin perder relación estratégica.

## Riesgo

Botón `Confirmar` podría significar:

- confirmar que el dato extraído es correcto;
- asignar formalmente a la persona.

Son acciones semánticamente diferentes.

## Recomendación para test

Probar wording:

> `Confirmar como responsable`

y mostrar antes del Handoff:

> Todavía no se enviará nada hasta que continúes con las asignaciones.

## Resultado

`DESK-REVIEW`.

---

# 14. Partial readiness

5 iniciativas con owner.
2 pendientes.

Permitir continuar con las 5:

```text
Continuar con las iniciativas listas
```

es coherente y evita que una cartera real quede bloqueada por incompletitud.

## Resultado

`DESK-PASS`.

---

# 15. Boundary con Handoff

Debe ser extremadamente visible:

```text
responsable confirmado
≠
asignación aceptada
≠
initiative started
```

La experiencia existente resuelve después:

```text
invitation
→ accept/reject
→ Portfolio response
→ Activation Overview
→ Start
```

## Resultado

`DESK-PASS`.

---

# 16. ACTO 3 — Monitoring Activation

## Hipótesis

Guide complete cuando:

```text
estructura confirmada
+
ownership mínimo revisado
+
>=1 Initiative STARTED
+
first active home rendered
```

## Simulación

Tiene sentido que la guía desaparezca antes de que todas las iniciativas estén activas.

Los pendientes pasan a governance normal.

## Riesgo

El texto:

> Activar seguimiento

puede sugerir que un botón activa una capacidad técnica o inicia todas las iniciativas.

Preferir posiblemente:

> `Empezar a dar seguimiento`

como descripción del milestone, no como acción masiva.

## Resultado

`DESK-REVIEW` de copy, lógica `DESK-PASS`.

---

# 17. Primera Home activa

## Contenido propuesto

Frente:

```text
Crecimiento nuevo negocio

Meta
200 nuevas ventas · Q4

2 activas
3 esperando activación
2 pendientes de responsable
```

Insight:

> El trabajo iniciado se concentra en generación y tratamiento de oportunidades. Conversión tiene menos trabajo iniciado.

Attention:

> Checkout Optimizer — sin responsable.

## Problema detectado

La gran oportunidad de valor de Home es razonamiento, pero esta primera versión corre el riesgo de dedicar demasiado espacio a **inventario de setup**:

- 2 activas;
- 3 esperando;
- 2 pendientes.

## Hipótesis de mejora para testing

Card de Frente:

```text
Crecimiento nuevo negocio
Meta: 200 nuevas ventas · Q4

En seguimiento

Pendiente · 2
```

Y mover detalle:

```text
2 activas / 3 esperando
```

a Frente o tooltip/context detail.

Home debe priorizar:

> qué debería entender o hacer ahora.

## Resultado

`DESK-REVIEW`.

---

# 18. Guía desaparece

Una vez renderizada primera Home útil:

> Tu espacio está listo.

Después desaparece.

Los pendientes pasan a:

`Necesita de ti`.

## Resultado

`DESK-PASS`.

---

# 19. ACTO 4 — Segunda visita

Después de dos semanas:

- Lead Assistant bloqueada;
- Pricing Pilot tiene evidence nueva y decisión próxima;
- Webinar Series rechazó Handoff;
- Content Campaign avanzó normalmente.

## Home

Este es el momento donde la propuesta gana más fuerza.

Puede responder inmediatamente:

```text
Qué cambió
Lecturas Startería
Necesita de ti
```

## Resultado

`DESK-PASS FUERTE`.

---

# 20. Repetición potencial: Lead Assistant

Puede aparecer:

## Frente
`Bloqueo · 1`

## Insight
> Es la única Initiative STARTED del Reto y está bloqueada.

## Needs you
> Solicita apoyo para CRM.

Esto NO necesariamente es repetición porque cada aparición responde algo diferente.

Pero dentro de Home:

- la card solo señala;
- el Insight debe explicar consecuencia estratégica;
- Attention debe explicar la acción necesaria.

Regla:

> Si dos superficies usan la misma señal, cada una debe añadir una función cognitiva distinta.

Si no, eliminar una.

## Resultado

`DESK-PASS` con nueva regla UX.

---

# 21. Qué cambió

Propuesta:

```text
Content Campaign avanzó a Step 2.
Pricing Pilot registró nueva evidencia.
Channel Partners continúa sin incidencias.
```

## Finding

`Channel Partners continúa sin incidencias` no es realmente un cambio.

No debería ocupar `Qué cambió`.

`Qué cambió` debe contener únicamente cambios materiales.

Eliminar estados estables.

## Resultado

`DESK-FAIL` del ejemplo actual; regla corregible.

---

# 22. Needs You

```text
Lead Assistant
Apoyo solicitado

Webinar Series
Asignación rechazada

Pricing Pilot
Decisión próxima
```

Los tres requieren Portfolio action/decision.

La jerarquía es coherente.

## Resultado

`DESK-PASS`.

---

# 23. ACTO 5 — Results

Si todavía no existe impacto:

Correcto:

> Todavía no existe suficiente evidencia para afirmar impacto.

Mostrar:

- Initiatives generando evidence;
- señales observadas;
- decisiones preparadas.

## Riesgo de lenguaje

`1 señal observada` puede ser demasiado interno.

Preferir lenguaje visible como:

> 1 iniciativa ya registra un resultado observado.

o equivalente validado con testing.

## Resultado

`DESK-REVIEW` de UX writing.

---

# 24. Decision view

Pricing Pilot:

```text
Decisión
Ampliar piloto

Evidence
3 señales favorables
1 incertidumbre

Recomendación equipo
...

Recomendación Startería
...

Autoridad
Director Comercial
```

La separación entre:

- recommendation;
- evidence;
- decision authority;

es clara.

## Resultado

`DESK-PASS`.

---

# 25. Copilot recurrente

En segunda visita ya no debe decir:

> Vamos a configurar tu espacio.

Debe poder responder:

- qué cambió;
- por qué importa;
- qué depende del Portfolio Lead;
- dónde hay gaps;
- qué evidencia soporta una recomendación.

## Resultado

`DESK-PASS`.

---

# 26. Findings provisionales de desk simulation

## FND-PM-D01 — Las dos primeras entradas pueden solaparse

**Status:** PROPOSED FOR USER TESTING

`Preparar mi espacio de trabajo` y `Traer lo que ya tengo` pueden representar simultáneamente la realidad de un Portfolio Lead existente.

Testear si conviene:

```text
CTA principal:
Preparar mi espacio

Dentro:
- empezar desde objetivo
- traer trabajo existente
- contar mi situación
```

---

## FND-PM-D02 — First Analytical Value debe dominar sobre inventario

**Status:** PROPOSED FOR USER TESTING

El primer aha moment depende de mostrar una relación/patrón, no de contar iniciativas y owners.

---

## FND-PM-D03 — Agrupaciones necesitan rationale accesible

**Status:** PROPOSED FOR USER TESTING

El usuario debe poder entender por qué Startería propuso cada grupo sin recibir razonamiento interno extenso.

---

## FND-PM-D04 — Owners detectados necesitan wording de provenance

**Status:** PROPOSED FOR USER TESTING

`Responsable detectado/mencionado` debe distinguirse claramente de `Responsable confirmado`.

---

## FND-PM-D05 — Confirmar owner y formalizar asignación pueden confundirse

**Status:** PROPOSED FOR USER TESTING

El CTA necesita distinguir corrección del dato vs preparación del Handoff.

---

## FND-PM-D06 — “Activar seguimiento” puede confundirse con Start

**Status:** PROPOSED FOR USER TESTING

La experiencia debe expresar seguimiento como milestone del workspace y no como acción masiva sobre Initiatives.

---

## FND-PM-D07 — First Active Home corre riesgo de mostrar demasiado setup inventory

**Status:** PROPOSED FOR USER TESTING

Home debe priorizar lectura y atención. El detalle 2 activas / 3 esperando / 2 pendientes puede vivir a menor jerarquía.

---

## FND-PM-D08 — Una señal puede aparecer varias veces solo si cambia su función cognitiva

**Status:** PROPOSED FOR USER TESTING

Ejemplo:

```text
Frente → señal
Insight → significado
Needs You → acción
```

No repetir el mismo mensaje con wording diferente.

---

## FND-PM-D09 — “Qué cambió” no debe contener estados estables

**Status:** DESK-SUPPORTED

Eliminar items como:

> continúa sin incidencias.

`Qué cambió` contiene únicamente cambios.

---

## FND-PM-D10 — Results necesita lenguaje de negocio, no semántica interna

**Status:** PROPOSED FOR USER TESTING

Expresiones como `1 señal observada` deben traducirse a una lectura comprensible para Portfolio Lead.

---

# 27. Resultados por Acto

| Acto | Resultado desk |
|---|---|
| First Entry | REVIEW |
| First Analytical Value | PASS con guardrails |
| Relationship Review | PASS |
| Ownership | REVIEW |
| Activation | REVIEW de copy |
| First Active Home | REVIEW |
| Recurrent Monitoring | PASS FUERTE |
| Results / Decision | PASS con UX writing por validar |

---

# 28. Principal conclusión

La propuesta parece más fuerte **después de que existe actividad**, especialmente en:

```text
Qué cambió
+
Insight
+
Necesita de ti
+
Decision readiness
```

El mayor riesgo está antes:

> ¿Es suficientemente rápido y sencillo llegar desde primera visita hasta ese valor recurrente?

Por tanto, el prototipo debe prestar especial atención a:

1. entrada;
2. First Analytical Value;
3. transición de setup a Home.

No solo al dashboard final.

---

# 29. Qué testear primero con humanos

Prioridad:

## P0

- FND-PM-D01 — entrada inicial;
- FND-PM-D02 — first insight;
- FND-PM-D03 — agrupaciones;
- FND-PM-D05 — ownership;
- FND-PM-D07 — First Active Home.

## P1

- FND-PM-D06;
- FND-PM-D08;
- FND-PM-D10.

## Corrección directa del prototipo

- FND-PM-D09.

No necesitamos testear si un estado estable pertenece a “Qué cambió”: conceptualmente no pertenece.

---

# 30. Decisión de salida

La desk simulation NO autoriza todavía:

- Experience Contract final;
- Technical Design;
- implementación productiva.

Sí autoriza:

> construir un prototipo E2E de baja/media fidelidad enfocado en los puntos P0 y ejecutarlo con Portfolio Leads reales.

---

# 31. Próximo artefacto recomendado

`STARTERIA_PORTFOLIO_LEAD_E2E_PROTOTYPE_SPEC_v0.1.md`

Debe definir únicamente:

- pantallas necesarias para ejecutar el test;
- estados simulados;
- interacciones clicables;
- copy provisional;
- datos NovaGrowth;
- qué debe ser real vs mock;
- qué NO vale la pena implementar todavía.

Objetivo:

> probar comportamiento y valor, no construir producto final.
