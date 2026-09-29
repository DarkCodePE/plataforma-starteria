# STARTERIA — Portfolio Lead Slice A User Test Protocol v0.1

**Estado:** READY FOR USER TEST  
**Producto bajo prueba:** Portfolio Monitoring — Slice A First Value  
**Route:** `/portfolio/setup`  
**Objetivo:** Validar con Portfolio Leads reales si Startería puede llevarlos desde una intención estratégica y trabajo disperso hasta una primera lectura suficientemente útil, clara y confiable como para querer continuar estructurando el portafolio.

---

# 1. Qué estamos validando

No estamos validando si la UI "gusta".

Estamos validando si el usuario puede recorrer:

```text
Preparar mi espacio
↓
explicar qué quiere conseguir
↓
añadir lo que ya tiene
↓
recibir interpretación
↓
entender qué vio Startería
↓
confiar lo suficiente
↓
querer revisar cómo se relaciona
```

---

# 2. Pregunta central

> ¿Startería consigue generar valor antes de pedirle al Portfolio Lead que configure todo el portafolio?

---

# 3. Hipótesis principales

## H1 — Intent-first

El usuario entiende que debe comenzar desde lo que quiere conseguir y no desde la taxonomía de proyectos.

## H2 — Flexible input

El usuario siente que puede aportar información desordenada sin prepararla previamente.

## H3 — First Analytical Value

La primera lectura añade una relación, patrón o interpretación útil y no se percibe como un simple resumen.

## H4 — Trust

El usuario distingue:

```text
Declarado por ti
Encontrado en tu información
Lectura Startería
```

y percibe que puede corregir la interpretación.

## H5 — Continuation

Después de P3, el usuario entiende por qué tendría sentido pulsar:

> Revisar cómo se relaciona

---

# 4. Perfil de testers

Buscar 3–5 personas inicialmente.

Perfiles válidos:

- Innovation Lead
- Transformation Lead
- Strategy / Portfolio Lead
- Product Portfolio Lead
- PMO con responsabilidad sobre iniciativas
- Corporate Venture / Innovation Program Lead
- responsable de varias iniciativas internas

Priorizar personas que:

- gestionen varias iniciativas simultáneamente;
- tengan objetivos de negocio superiores a proyectos individuales;
- necesiten reportar o intervenir;
- hoy utilicen Excel, Jira, Notion, Power BI, PowerPoint, reuniones o combinaciones.

No es necesario que conozcan Startería.

---

# 5. Evitar sesgo de selección

No usar únicamente:

- amigos que conocen el producto;
- personas que participaron en su definición;
- perfiles puramente técnicos;
- usuarios que gestionan una sola iniciativa.

Ideal:

```text
2 usuarios cercanos al problema
+
2 usuarios externos
+
1 usuario más senior / ejecutivo
```

---

# 6. Duración

```text
35–45 minutos
```

Distribución recomendada:

```text
5 min  contexto
20 min task
10 min debrief
5 min cierre
```

---

# 7. Setup de sesión

Preparar:

- `/portfolio/setup`;
- build estable;
- instrumentation activa;
- fixture NovaGrowth;
- NovaGrowthExpanded disponible solo si se necesita stress test;
- grabación de pantalla si existe consentimiento;
- notas del moderador;
- cronómetro.

No explicar previamente:

- Frente;
- Reto;
- Initiative;
- First Value;
- estructura que esperamos.

---

# 8. Introducción del moderador

Decir:

> Estamos probando una experiencia, no evaluándote a ti. Algunas cosas pueden estar incompletas. Quiero que uses la plataforma como lo harías normalmente y que me cuentes qué entiendes mientras avanzas.

No explicar cómo debe completarse.

---

# 9. Contexto inicial

Dar únicamente:

> Imagina que eres responsable de varias iniciativas vinculadas a un objetivo estratégico y quieres tener una forma más clara de entender cómo se relacionan, quién está trabajando en qué y dónde podrías necesitar intervenir.

Después:

> Acabas de entrar por primera vez a Startería. Empieza como lo harías normalmente.

---

# 10. TASK 1 — Primera entrada

## Objetivo

Comprobar:

- comprensión de P0;
- CTA dominante;
- ausencia de distracción por navegación.

## Moderador

> ¿Qué harías aquí?

No dirigir a `Preparar mi espacio`.

## Registrar

```text
first_action
time_to_first_action
hesitation
unexpected_navigation
```

## PASS

El usuario identifica `Preparar mi espacio` como ruta coherente sin explicación.

---

# 11. TASK 2 — Strategic Intent

Cuando entra a P1:

> Piensa en algo que realmente querrías conseguir o tener bajo control en tu trabajo. Puedes utilizar el caso que te voy a dar si prefieres no compartir información propia.

Si usa NovaGrowth:

> Dirección quiere conseguir 200 nuevas ventas B2B durante Q4 y quieres entender cómo el trabajo existente contribuye a ese objetivo.

## Observar

- lenguaje utilizado;
- si busca campos KPI;
- si pregunta qué formato debe usar;
- si teme escribir "mal";
- si entiende objetivo vs proyecto.

## Pregunta posterior

> ¿Qué crees que hará Startería con esto?

Registrar expectativa antes de avanzar.

---

# 12. TASK 3 — Existing Work

Entregar el NovaGrowth Test Pack si no usa información propia.

Instrucción:

> Esta es la información que tienes hoy. Incorpórala de la forma que te resulte más natural.

No decir:

> pégala aquí.

## Observar

- si encuentra textarea;
- si intenta upload;
- reacción al upload no disponible;
- si entiende que puede pegar información desordenada;
- si reorganiza manualmente antes de pegar.

## Critical signal

Si el usuario siente que debe ordenar los datos antes de dárselos a Startería:

```text
FAIL H2
```

---

# 13. TASK 4 — Processing

No explicar qué significa el processing state.

Preguntar después:

> ¿Qué esperas recibir cuando termine?

Registrar:

- resumen;
- estructura;
- recomendación;
- dashboard;
- preguntas;
- otra expectativa.

Esto permite comparar expectativa con First Value real.

---

# 14. TASK 5 — First Analytical Value

Dejar al usuario explorar P3 sin intervención.

Cronometrar:

```text
time_first_value_rendered
↓
time_to_first_meaningful_statement
```

El moderador no debe preguntar inmediatamente.

Esperar reacción espontánea.

---

# 15. Pregunta crítica

Después de explorar:

> ¿Qué te está diciendo Startería aquí que no veías tan claramente antes?

Registrar literalmente.

## Señales fuertes

- "veo dónde se concentra el trabajo";
- "entiendo cómo se distribuyen las iniciativas";
- "veo que hay una parte con menos trabajo";
- "veo responsables faltantes";
- "veo una dependencia que afecta una parte del objetivo".

## Señal débil

> "Me ordenó lo que puse."

## Señal de fallo

> "No me está diciendo nada nuevo."

---

# 16. Trust / Provenance test

Preguntar:

> ¿Qué parte de esta pantalla viene de lo que tú dijiste y qué parte está interpretando Startería?

No señalar labels.

## PASS

Puede distinguir aproximadamente:

```text
declarado
detectado
interpretado
```

sin ayuda.

---

# 17. Grouping test

Abrir o permitir que descubra rationale.

Preguntar:

> ¿Por qué crees que Startería agrupó estas iniciativas así?

Después:

> ¿Qué harías si no estuvieras de acuerdo?

## PASS

Entiende que:

- es propuesta;
- existe rationale;
- puede corregirse.

## FAIL

Percibe los grupos como estructura impuesta.

---

# 18. Signal test

Preguntar:

> De todo lo que aparece, ¿qué revisarías primero?

Observar si identifica:

- distribución;
- owner faltante;
- dependencia CRM.

No existe respuesta única.

El objetivo es saber si las señales se sienten accionables o ruido.

---

# 19. Next-action test

No mencionar el CTA.

Preguntar:

> ¿Qué harías ahora?

## Strong signal

El usuario busca espontáneamente:

> Revisar cómo se relaciona.

o expresa intención equivalente:

> Quiero revisar esos grupos / cómo está organizado.

## Weak signal

Busca dashboard, settings o crear proyecto.

---

# 20. Stress Test — NovaGrowthExpanded

No ejecutar necesariamente con todos.

Usar con 1–2 testers.

Contexto:

> Imagina que en vez de siete iniciativas tienes unas veinte o treinta.

Cargar `NovaGrowthExpanded`.

Observar:

- legibilidad;
- sensación de overwhelm;
- utilidad de agrupaciones;
- necesidad de drill-down;
- visibilidad del CTA;
- confianza en counts.

Preguntar:

> ¿Esta lectura sigue siendo útil o ya necesitarías otra forma de verla?

---

# 21. Debrief — valor

Preguntar:

1. ¿Qué parte te aportó más valor?
2. ¿Qué parte parecía obvia?
3. ¿Qué parte te generó dudas?
4. ¿Confiarías en seguir estructurando el portafolio desde esta lectura?
5. ¿Qué necesitarías ver para confiar más?
6. ¿Qué esperarías encontrar después de “Revisar cómo se relaciona”?

---

# 22. Debrief — comparación

Preguntar:

> ¿Cómo harías esto hoy?

Después:

> ¿Qué diferencia encuentras entre lo que acabas de hacer y hacerlo con tus herramientas actuales?

No mencionar herramientas específicas hasta que responda.

Si necesita ayuda:

> Excel, Jira, Notion, PowerPoint, Power BI o reuniones, por ejemplo.

---

# 23. Pregunta de valor decisiva

> Si tuvieras 20–30 iniciativas, ¿usarías una experiencia como esta para empezar a entender cómo se relacionan con tus objetivos?

Respuesta:

```text
Sí
Tal vez
No
```

Preguntar:

> ¿Por qué?

La explicación importa más que el Sí/No.

---

# 24. Ratings

Solicitar 1–5.

## R1 — Clarity

> Entendí rápidamente cómo empezar.

## R2 — Input flexibility

> Sentí que podía aportar información sin prepararla demasiado.

## R3 — First Value

> La primera lectura me mostró algo útil.

## R4 — Trust

> Entendí qué estaba interpretando Startería y confié en poder corregirlo.

## R5 — Continuation

> Querría continuar al siguiente paso.

---

# 25. Instrumentation

Capturar:

```text
portfolio_setup_started
portfolio_goal_submitted
portfolio_existing_work_submitted
portfolio_first_value_rendered
portfolio_rationale_opened
portfolio_interpretation_corrected
portfolio_relationship_review_clicked
```

Cruzar eventos con observación.

No interpretar evento como éxito por sí solo.

Ejemplo:

```text
relationship_review_clicked = true
```

no prueba valor si el usuario hizo clic porque no sabía qué más hacer.

---

# 26. Session Record

Por tester:

```text
TESTER ID:
Profile:
Company type:
Approx initiatives managed:
Current tools:

TASK 1
Result:
Time:
Notes:

TASK 2
Result:
Notes:

TASK 3
Result:
Notes:

TASK 4
Expected output:

TASK 5
First spontaneous reaction:
Time to insight:
Critical quote:

PROVENANCE
PASS / REVIEW / FAIL

GROUPING
PASS / REVIEW / FAIL

NEXT ACTION
PASS / REVIEW / FAIL

RATINGS
R1:
R2:
R3:
R4:
R5:

Would continue:
YES / MAYBE / NO

Biggest value:
Biggest confusion:

Moderator notes:
```

---

# 27. Findings format

```text
FND-PM-UXXX

Observed behavior:
...

Tester evidence:
T01 / T02 / ...

Frequency:
1/5
2/5
...

Affected hypothesis:
H1 / H2 / H3 / H4 / H5

Impact:
LOW / MEDIUM / HIGH

Interpretation:
...

Recommended change:
...

Status:
OBSERVED
SUPPORTED
CONFIRMED
REJECTED
```

---

# 28. Regla de evidencia

No cambiar producto porque un tester diga:

> "Yo lo pondría azul."

Priorizar:

- comportamiento;
- confusión repetida;
- expectativas;
- task failure;
- lenguaje espontáneo;
- decisiones.

Una preferencia aislada no constituye finding de producto.

---

# 29. Threshold inicial

Con 3–5 testers, Slice A puede considerarse suficientemente soportado para avanzar si:

```text
>=80% completa P0→P3 sin ayuda crítica
>=80% distingue propuesta vs verdad confirmada
>=80% identifica al menos un insight útil
R3 First Value promedio >=4/5
R4 Trust promedio >=4/5
R5 Continuation promedio >=4/5
```

Además:

> no debe existir un failure sistemático de modelo mental o autoridad.

Estos thresholds son criterios de discovery, no contratos de producto.

---

# 30. Casos que bloquean Slice B

No avanzar si aparece repetidamente cualquiera de estos:

## BLOCK-01

Los usuarios no entienden qué introducir como objetivo.

## BLOCK-02

Sienten que deben estructurar la información antes de usar Startería.

## BLOCK-03

First Value se percibe como resumen genérico.

## BLOCK-04

No distinguen dato de interpretación.

## BLOCK-05

Las agrupaciones parecen arbitrarias o definitivas.

## BLOCK-06

No entienden por qué continuar a relationship review.

---

# 31. Casos que NO bloquean Slice B necesariamente

- copy menor;
- spacing;
- iconografía;
- preference de layout;
- upload mock;
- analytics no persistente;
- ausencia de backend real.

Registrar, pero no confundir con validación del modelo.

---

# 32. Gate después de testing

```text
3–5 sesiones
↓
Findings Register
↓
Review
```

Resultado:

```text
A — SUPPORTED
→ avanzar Slice B

B — SUPPORTED_WITH_FIXES
→ corregir Slice A
→ regression test
→ Slice B

C — NOT_SUPPORTED
→ iterar modelo de First Value
→ repetir test
```

---

# 33. Qué NO hacer durante sesiones

No:

- vender Startería;
- explicar por qué una decisión de UX es correcta;
- enseñarles dónde hacer click;
- defender la agrupación;
- preguntar "¿te gusta?";
- enseñarles Slice B;
- contarles cómo funcionará todo el producto.

Queremos observar la experiencia actual, no convencerlos.

---

# 34. Principio final

> El test de Slice A está ganado cuando el Portfolio Lead siente que Startería entendió suficiente de su intención y de su trabajo como para devolverle una lectura que merece seguir explorando.

No cuando termina el wizard.

