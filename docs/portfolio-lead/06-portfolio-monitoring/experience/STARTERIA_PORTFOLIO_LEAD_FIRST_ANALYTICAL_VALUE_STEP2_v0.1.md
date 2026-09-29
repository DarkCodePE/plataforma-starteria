# STARTERIA — Portfolio Lead First Analytical Value — Step 2 v0.1

**Estado:** PROPUESTA PARA TESTING  
**Vertical:** Portfolio Lead → First Value → Setup → Monitoring  
**Depende de:** `STARTERIA_PORTFOLIO_LEAD_FIRST_VALUE_E2E_TEST_v0.1.md`  
**Objetivo:** Validar que Startería entregue una primera lectura útil de la situación del Portfolio Lead antes de exigir una configuración completa del workspace.

---

# 1. Punto de entrada

Este paso comienza después de que el usuario:

1. entra por primera vez;
2. elige `Preparar mi espacio de trabajo` o `Traer lo que ya tengo`;
3. activa la guía temporal de inicio;
4. llega a la pregunta:

> ¿Qué quieres conseguir o tener bajo control?

El usuario todavía NO necesita conocer:

- Frente Estratégico;
- Reto;
- Challenge;
- Initiative;
- Step;
- Sponsor;
- Contribution Contract.

---

# 2. Job del usuario

> Quiero explicar mi situación como la entiendo hoy y comprobar si Startería puede ayudarme a ordenarla.

Startería debe demostrar:

> Entendí qué intentas conseguir, qué trabajo ya existe y qué parte todavía necesita ordenarse.

---

# 3. Hipótesis de First Analytical Value

El primer valor NO es:

- crear un Frente;
- crear un Reto;
- cargar todas las iniciativas;
- mostrar un dashboard;
- completar cinco pasos de configuración.

El primer valor es:

> Startería devuelve una lectura estructurada y útil que conecta lo que el usuario quiere conseguir con el trabajo que ya tiene o quiere organizar.

---

# 4. Input de testing

Para el test se utilizará un `Portfolio Test Pack` ficticio.

El tester puede introducirlo de tres formas conceptuales:

## A. Describirlo

Textarea:

> Cuéntame qué quieres conseguir y qué trabajo tienes hoy relacionado.

## B. Pegar información

Ejemplos:

- lista de iniciativas;
- notas;
- resumen de seguimiento;
- texto copiado desde una hoja o documento.

## C. Subir información existente

Puede probarse visualmente como capacidad futura o prototipo si el test lo requiere.

Regla para v0.1:

> El test no debe depender técnicamente de extracción documental real.

El camino canónico de testing debe poder completarse con texto pegado.

---

# 5. Caso de test base — NovaGrowth

El Portfolio Lead recibe este contexto:

## Objetivo declarado

Dirección quiere conseguir **200 nuevas ventas de una nueva línea B2B durante Q4**.

## Trabajo existente

### Content Campaign
Campaña de contenidos para generar leads empresariales.
Owner: Laura.

### Lead Assistant
Asistente para responder y cualificar leads comerciales.
Owner: Ana.

### Pricing Pilot
Prueba de pricing para una nueva propuesta comercial.
Owner: Carlos.

### Channel Partners
Exploración de partners para captar nuevas oportunidades.
Owner: Marta.

### Checkout Optimizer
Prueba para reducir fricción durante la contratación.
Owner: pendiente.

### CRM Follow-up
Automatización de seguimiento de leads.
Owner: Luis.

### Webinar Series
Webinars para captar potenciales clientes.
Owner: pendiente.

## Información adicional

- Pricing Pilot tiene feedback inicial positivo.
- Lead Assistant está esperando acceso a datos del CRM.
- No existe todavía una lectura común de cómo cada iniciativa contribuye al objetivo.
- Dirección quiere revisar avance dentro de seis semanas.

---

# 6. Pantalla de entrada

```text
Tu guía de inicio · 0 de 5

○ Define qué quieres conseguir
○ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento


¿Qué quieres conseguir o tener bajo control?

[ textarea ]

Ej.
“Dirección quiere conseguir 200 nuevas ventas este trimestre
y tenemos varias iniciativas en marcha, pero no tengo claro
cómo se relacionan ni dónde deberíamos concentrarnos.”

[ Pegar información adicional ]

[ Añadir lo que ya tengo ]

CTA:
Ayúdame a ordenar esto
```

---

# 7. Processing state

Después del CTA no mostrar un spinner vacío.

Mostrar:

> Startería está organizando tu contexto.

Checklist progresivo:

```text
✓ Entendiendo qué quieres conseguir
✓ Identificando trabajo existente
✓ Buscando relaciones entre iniciativas
✓ Detectando información que necesita revisión
○ Preparando una primera lectura
```

No utilizar todavía términos de dominio internos.

---

# 8. Primera respuesta de Startería

La primera salida debe caber en una sola pantalla y tener tres capas.

---

## 8.1 Lo que entendí

Ejemplo:

> Quieres entender si las iniciativas que ya están en marcha están ayudando realmente a conseguir 200 nuevas ventas durante Q4 y dónde hace falta ordenar o intervenir.

Mostrar de forma compacta:

```text
Meta declarada
200 nuevas ventas · Q4

Trabajo detectado
7 iniciativas

Responsables identificados
5 confirmados en la información
2 por revisar
```

Importante:

`detectado` o `identificado` no significa confirmado dentro de Startería.

---

## 8.2 Primera lectura Startería

No crear todavía Retos definitivos.

Ejemplo:

### Parece haber tres tipos de trabajo

**Generar oportunidades**
- Content Campaign
- Channel Partners
- Webinar Series

**Trabajar oportunidades**
- Lead Assistant
- CRM Follow-up

**Convertir oportunidades**
- Pricing Pilot
- Checkout Optimizer

Copy:

> Esta es una propuesta de organización, no una estructura confirmada.

---

## 8.3 Lo que merece revisar

Máximo 2–3 señales.

Ejemplo:

### 1. La mayor parte del trabajo está concentrada antes de la conversión

Startería detecta más iniciativas orientadas a generar y trabajar oportunidades que a convertirlas.

> Todavía no sabemos si esta distribución es intencional o si representa un gap.

### 2. Dos iniciativas todavía no tienen responsable claro

- Checkout Optimizer
- Webinar Series

### 3. Lead Assistant tiene una dependencia que puede afectar su avance

Acceso CRM pendiente.

No producir todavía:

- health score;
- coverage score;
- porcentaje de alineamiento;
- probabilidad de éxito;
- impacto estimado inventado.

---

# 9. CTA después del First Value

La acción principal no debe ser:

> Crear Frente.

Debe ser:

> **Revisar cómo se relaciona este trabajo**

Acciones:

```text
[ Revisar esta organización ]
[ Corregir lo que entendió Startería ]
[ Añadir más contexto ]
```

Acción secundaria:

> Continuar con esta lectura

---

# 10. Actualización de la guía

Después de que Startería devuelve la lectura:

```text
Tu guía de inicio · 2 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento
```

La guía muestra progreso porque Startería ya consiguió información suficiente para marcar los dos primeros jobs.

No obliga a que el usuario haya rellenado formularios independientes.

---

# 11. Copilot en Step 2

Contexto:

```text
role = portfolio_lead
workspace_state = SETUP
current_job = first_analytical_value
guide_progress = 2/5
```

Preguntas sugeridas:

- ¿Por qué agrupaste estas iniciativas así?
- ¿Qué parte del objetivo parece menos abordada?
- ¿Hay iniciativas que parecen estar haciendo algo parecido?
- ¿Qué información te falta para entender mejor el portafolio?
- ¿Puedo cambiar esta organización?

Ejemplo de respuesta:

> Agrupé las iniciativas por el cambio que parecen intentar producir dentro del objetivo. Esta lectura es provisional. Puedes corregirla antes de convertirla en estructura del workspace.

---

# 12. Regla de autoridad

Todo lo producido aquí es provisional.

Estados conceptuales:

```text
USER_DECLARED
EXTRACTED
AI_INFERRED
AI_SUGGESTED
```

No crear automáticamente:

- Frente canónico;
- Reto;
- Initiative nueva;
- owner assignment;
- decision;
- Step.

El objetivo de Step 2 es generar interpretación, no canonicalización.

---

# 13. Primer Aha Moment esperado

El tester debería poder expresar algo equivalente a:

> “Startería entendió qué estoy intentando conseguir y me está mostrando cómo se distribuye el trabajo que ya tengo.”

o:

> “Ahora puedo ver que tenemos muchas cosas en una parte del objetivo y menos en otra.”

No necesitamos todavía que diga:

> “Ya quiero comprar el producto.”

Necesitamos detectar valor cognitivo real.

---

# 14. Acceptance Criteria

## AC-P2-01 — Input flexible
El usuario puede describir su situación sin aprender taxonomía.

## AC-P2-02 — First value before setup completion
Startería devuelve una lectura útil antes de pedir todos los campos de configuración.

## AC-P2-03 — Fidelity
La síntesis no cambia materialmente el significado de lo declarado.

## AC-P2-04 — No false confirmation
La agrupación propuesta se entiende como propuesta.

## AC-P2-05 — No false coverage
Startería no declara `cobertura suficiente` o scores no definidos.

## AC-P2-06 — Useful interpretation
La salida aporta al menos una relación o patrón que no sea mera repetición del input.

## AC-P2-07 — Limited attention
La primera lectura muestra máximo 2–3 señales prioritarias.

## AC-P2-08 — Guide progression
El usuario entiende por qué la guía avanzó de 0/5 a 2/5.

## AC-P2-09 — Clear next step
El usuario entiende que ahora debe revisar cómo se relaciona el trabajo.

## AC-P2-10 — Copilot grounding
Las respuestas del Copilot se basan en el contexto ingresado y distinguen hechos de sugerencias.

---

# 15. Test script

Moderador:

> Ahora tienes información sobre varias iniciativas que ya existen. Introduce esa información en Startería de la forma que te resulte más natural y continúa hasta que sientas que la plataforma te está ayudando a entenderla.

No explicar:

- qué agrupación esperamos;
- qué significa Reto;
- dónde debería aparecer un gap;
- qué CTA utilizar.

---

# 16. Qué observar

1. ¿Introduce primero el objetivo o las iniciativas?
2. ¿Entiende que puede pegar información desordenada?
3. ¿Tiene miedo de “hacerlo mal”?
4. ¿La respuesta de Startería le parece fiel?
5. ¿Detecta inmediatamente una lectura nueva?
6. ¿Pregunta de dónde salió una agrupación?
7. ¿Confunde propuesta con verdad confirmada?
8. ¿Entiende qué significa “responsables por revisar”?
9. ¿Usa Copilot para profundizar?
10. ¿Quiere corregir antes de continuar?
11. ¿Comprende el siguiente paso?
12. ¿El checklist se siente como progreso o carga?

---

# 17. Preguntas post-task

1. ¿Qué te aportó esta primera lectura?
2. ¿Hay algo que Startería haya interpretado de forma incorrecta?
3. ¿Qué parte te resultó más útil?
4. ¿Qué parte parecía obvia o innecesaria?
5. ¿Entendiste qué era información tuya y qué era interpretación de Startería?
6. ¿Confiarías en continuar estructurando el portafolio desde esta propuesta?
7. ¿Qué esperarías hacer ahora?
8. ¿Seguirías aportando información para obtener este tipo de lectura?

---

# 18. Success metrics

## First Analytical Value

- tiempo hasta primera lectura;
- tiempo hasta primer insight comprendido;
- % testers que identifican correctamente el objetivo;
- % testers que entienden la agrupación como provisional;
- número de correcciones necesarias;
- perceived usefulness 1–5;
- trust in interpretation 1–5;
- willingness to continue 1–5.

## Señal especialmente importante

Pregunta:

> ¿Qué te está diciendo Startería que no veías tan claramente antes?

Una respuesta vacía o equivalente a:

> “Solo me ordenó lo mismo que puse”

es una señal de riesgo.

---

# 19. Failure signals

Revisar Step 2 si:

- la primera salida se siente como resumen genérico;
- Startería simplemente repite los nombres de las iniciativas;
- el usuario no entiende por qué se agruparon;
- la IA inventa objetivos o relaciones;
- aparecen demasiados hallazgos;
- se introducen Retos como hechos;
- pide demasiada configuración antes del primer insight;
- el usuario no sabe qué hacer después;
- el checklist parece una obligación administrativa;
- Copilot responde como chat genérico.

---

# 20. Salida hacia Paso 3

Si el usuario acepta revisar la organización:

```text
Paso 2
First Analytical Value
        ↓
Paso 3
Revisar cómo se relaciona
        ↓
propuesta Frente / Retos / Iniciativas
        ↓
confirmación humana
```

Paso 3 será responsable de decidir cómo la interpretación provisional se convierte en una estructura revisable del workspace.

No canonicalizar en Step 2.
