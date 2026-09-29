# STARTERIA — Portfolio Lead First Value E2E Test v0.1

**Estado:** PROPUESTA PARA TESTING  
**Journey:** Primera visita → First Value → Setup → Monitoring → Resultados  
**Foco de esta versión:** Arquitectura completa del test + especificación detallada de Paso 1  
**Usuario:** Portfolio Lead funcional

---

# 1. Hipótesis principal

Startería debe generar valor antes de pedir al Portfolio Lead que aprenda su taxonomía o configure exhaustivamente su workspace.

La experiencia debe demostrar progresivamente:

```text
Primera visita
→ entiendo qué puedo conseguir
→ empiezo desde mi realidad
→ Startería interpreta
→ me ayuda a estructurar
→ confirmo
→ el espacio queda preparado
→ Startería empieza a devolver seguimiento e insights
```

---

# 2. Caso de test base

El tester representa a un Portfolio Lead de una empresa ficticia.

Contexto inicial que recibe:

> Eres responsable de dar trazabilidad a varias iniciativas vinculadas al crecimiento de una nueva línea de negocio. La información está dispersa entre una hoja de seguimiento, notas y conversaciones. Quieres entender cómo organizar el trabajo, quién se hará cargo y, después, saber dónde intervenir sin revisar proyecto por proyecto.

El tester NO recibe una estructura ya creada de:

- Frentes;
- Retos;
- Iniciativas;
- alerts;
- Insights.

Startería comienza vacía.

Más adelante se le entregará un `Portfolio Test Pack` con información deliberadamente desestructurada.

---

# 3. Journey E2E a probar

## PASO 1 — Primera visita / orientación

Objetivo:

> El usuario entiende qué puede conseguir en Startería y encuentra una forma natural de empezar.

## PASO 2 — Entrada de información / First Analytical Value

Objetivo:

> El usuario introduce información realista y Startería devuelve una primera interpretación útil antes de pedir configuración exhaustiva.

## PASO 3 — Guía de estructuración

Objetivo:

> Startería ayuda a organizar objetivo, trabajo existente y posibles agrupaciones sin imponer su ontología.

## PASO 4 — Confirmación de entorno

Objetivo:

> El usuario revisa y confirma estructura, responsables y relaciones materiales.

## PASO 5 — Handoff / Start

Objetivo:

> Las iniciativas que requieren ejecución quedan correctamente asignadas e iniciadas usando el vertical ya existente.

## PASO 6 — Primera Home activa

Objetivo:

> Startería devuelve inmediatamente una lectura del portafolio recién estructurado.

## PASO 7 — Segunda visita / Monitoring

Objetivo:

> Después de simular el paso del tiempo, el usuario entiende qué cambió, qué necesita atención y qué decisión se aproxima.

## PASO 8 — Resultados

Objetivo:

> El usuario comprende contribución, evidencia, decisiones y resultados sin revisar iniciativa por iniciativa.

---

# 4. Guía temporal de configuración

La guía NO aparece como un wizard obligatorio desde el primer segundo.

Se activa después de que el usuario elige preparar/ordenar su espacio.

Formato conceptual:

```text
Tu guía de inicio

○ Define qué quieres conseguir
○ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento
```

Propiedades:

- puede completarse en distinto orden cuando el contexto lo justifique;
- siempre muestra un siguiente paso recomendado;
- puede minimizarse;
- conserva el progreso si el usuario sale;
- desaparece al completarse;
- no permanece como widget de Home después del setup.

Ejemplo después de avanzar:

```text
Tu guía de inicio · 3 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento
```

---

# 5. Copilot durante setup

El Copilot tiene un modo contextual `SETUP`.

No funciona como un chat genérico.

Debe saber:

```text
role = portfolio_lead
workspace_state = first_visit / setup
current_setup_progress
available_context
last_user_action
```

Jobs principales:

- explicar qué puede hacer el usuario;
- ayudar cuando no sabe por dónde empezar;
- interpretar lenguaje natural;
- explicar sugerencias de Startería;
- orientar al siguiente paso;
- reducir taxonomía innecesaria;
- nunca confirmar estructura material sin acción humana.

Ejemplos:

> Cuéntame qué tienes hoy y te ayudo a decidir por dónde empezar.

> Ya tienes claro qué quieres conseguir. El siguiente paso es incorporar el trabajo que actualmente intenta mover ese resultado.

> Detecté iniciativas que parecen abordar partes distintas del objetivo. Puedo ayudarte a revisarlas antes de organizarlas.

---

# 6. PASO 1 — Primera visita / orientación

## 6.1 Job del usuario

> Acabo de entrar. Necesito entender rápidamente para qué me sirve este espacio y cómo empezar desde mi situación actual.

La pantalla no debe pedir todavía:

- crear Frente;
- crear Reto;
- seleccionar Challenge type;
- configurar Sponsor;
- definir KPI formal;
- asignar owners;
- aprender Steps.

---

# 7. Pantalla propuesta

```text
┌─────────────────────────────────────────────────────────────┐
│ Startería                                                   │
│                                                             │
│ Organiza tus iniciativas alrededor de lo que quieres        │
│ conseguir.                                                  │
│                                                             │
│ Empieza desde lo que ya tienes. Startería te ayuda a        │
│ ordenar el trabajo, conectar responsables y saber después   │
│ dónde necesitas intervenir.                                 │
│                                                             │
│ ¿Cómo quieres empezar?                                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Preparar mi espacio de trabajo                         │ │
│ │ Quiero ordenar objetivos, trabajo y responsables.      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌───────────────────────┐ ┌──────────────────────────────┐ │
│ │ Traer lo que ya tengo │ │ Empezar una iniciativa      │ │
│ │ Tengo trabajo activo. │ │ Tengo algo concreto.        │ │
│ └───────────────────────┘ └──────────────────────────────┘ │
│                                                             │
│ ✦ ¿No sabes por dónde empezar?                              │
│   Cuéntame cómo gestionas hoy tus iniciativas.              │
│   [Preguntar a Startería]                                   │
└─────────────────────────────────────────────────────────────┘
```

---

# 8. Jerarquía de acciones

## Acción principal

### Preparar mi espacio de trabajo

Promesa:

> Quiero organizar lo que quiero conseguir, el trabajo relacionado y quién se hará cargo.

No utilizar:

- Frente Estratégico;
- Reto;
- Challenge;
- portfolio architecture.

---

## Acción secundaria A

### Traer lo que ya tengo

Promesa:

> Ya tengo iniciativas, proyectos o información en marcha y quiero empezar desde ahí.

El siguiente paso permitirá introducir/subir el `Portfolio Test Pack`.

---

## Acción secundaria B

### Empezar una iniciativa

Promesa:

> Quiero trabajar sobre una iniciativa concreta.

Esta acción deriva posteriormente hacia la experiencia correspondiente, sin convertir la Home Portfolio en Initiative Core.

---

## Escape cognitivo

### Preguntar a Startería

Para usuarios que no saben cuál de las tres opciones representa su situación.

Copilot:

> Cuéntame brevemente qué intentas conseguir o qué tienes hoy. Te ayudaré a decidir la forma más sencilla de empezar.

---

# 9. Qué ocurre al pulsar “Preparar mi espacio de trabajo”

No abrir un dashboard.

No abrir un formulario largo.

Se produce la primera transición de estado:

```text
workspace_state:
EMPTY
→ SETUP
```

Aparece la guía temporal:

```text
Tu guía de inicio · 0 de 5

○ Define qué quieres conseguir
○ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento
```

Y la acción central pasa a:

> **¿Qué quieres conseguir o tener bajo control?**

Input en lenguaje natural.

Ejemplos editables:

- Necesito entender cómo nuestras iniciativas están contribuyendo al crecimiento.
- Tenemos varios proyectos y no sé dónde debería intervenir.
- Dirección nos pidió aumentar ventas y quiero ordenar el trabajo relacionado.

CTA:

> **Ayúdame a ordenar esto**

Este CTA dará entrada al Paso 2.

---

# 10. Comportamiento del Copilot después de activar la guía

El Copilot ya conoce:

```text
workspace_state = SETUP
guide_progress = 0/5
current_job = define_desired_outcome
```

Puede decir:

> Empecemos por el resultado que necesitas mover o entender. No hace falta que esté perfectamente formulado.

Si el usuario escribe algo ambiguo:

> Dirección quiere que innovemos más.

El Copilot no rellena automáticamente métricas o estructura.

Puede hacer una aclaración mínima o permitir avanzar con incertidumbre explícita.

---

# 11. Qué NO se muestra en Paso 1

No mostrar:

- 0 iniciativas;
- 0 bloqueos;
- 0 decisiones;
- gráficos vacíos;
- cards de Frente vacías;
- navegación profunda de Retos;
- Resultados sin datos;
- porcentajes;
- dashboards de ejemplo que parezcan reales.

La pantalla debe comunicar posibilidad de valor, no ausencia de datos.

---

# 12. Uso de navegación durante setup

Navegación mínima:

```text
Inicio
```

Opcionalmente:

```text
+ Crear / importar
```

`Portafolio` y `Resultados` pueden existir visualmente deshabilitados o no aparecer hasta que exista contexto suficiente.

Hipótesis a testear:

A. ocultarlos hasta que tengan contenido;
B. mostrarlos con estado vacío explicativo.

No congelar aún cuál es mejor.

---

# 13. Acceptance Criteria — Paso 1

## AC-P1-01 — Comprensión de valor

Sin explicación del moderador, el usuario puede describir en sus propias palabras que Startería sirve para organizar y dar seguimiento a iniciativas alrededor de objetivos/resultados.

## AC-P1-02 — No taxonomía

El usuario puede comenzar sin conocer Frente, Reto, Initiative o Steps.

## AC-P1-03 — Path selection

El usuario identifica una forma de empezar que representa razonablemente su situación.

## AC-P1-04 — Guide activation

Después de seleccionar preparar/ordenar el espacio, aparece una guía clara y finita.

## AC-P1-05 — Guide purpose

El usuario entiende que la guía desaparecerá después de completar el setup y no es navegación permanente.

## AC-P1-06 — Copilot discoverability

El usuario identifica que puede pedir ayuda a Startería si no sabe cómo empezar.

## AC-P1-07 — Low cognitive load

El usuario no percibe la primera pantalla como dashboard, formulario administrativo o configuración corporativa.

## AC-P1-08 — Next action clarity

Después de activar setup, entiende qué debe hacer a continuación.

---

# 14. Test script — Paso 1

## Instrucción del moderador

Decir únicamente:

> Acabas de entrar por primera vez a Startería. Eres responsable de varias iniciativas y quieres empezar a ordenar cómo darles seguimiento. Utiliza la plataforma como lo harías normalmente.

No explicar:

- navegación;
- qué botón pulsar;
- qué es un Frente;
- qué es un Reto;
- qué hace el Copilot.

---

## Observación

Registrar:

1. Primer elemento que mira.
2. Primer CTA que intenta usar.
3. Si duda entre opciones.
4. Palabras que no entiende.
5. Si abre Copilot.
6. Tiempo hasta primera acción.
7. Si interpreta que debe preparar datos antes de empezar.
8. Si espera un dashboard o un asistente.
9. Si entiende el propósito de la guía.
10. Si sabe qué ocurrirá después.

---

# 15. Preguntas posteriores al Paso 1

No hacer durante la interacción.

Después:

1. ¿Qué crees que puedes conseguir aquí?
2. ¿Por qué elegiste esa opción?
3. ¿Qué esperas que pase a continuación?
4. ¿Qué entiendes que hará la guía?
5. ¿Qué crees que ocurrirá cuando la completes?
6. ¿Para qué utilizarías “Preguntar a Startería”?
7. ¿Hubo algún término o acción que no te resultara clara?

---

# 16. Señales de PASS

Paso 1 tiene soporte si la mayoría de testers:

- entiende el propósito sin explicación;
- encuentra una entrada natural;
- no pregunta qué significa la taxonomía interna;
- entiende el checklist;
- percibe el Copilot como ayuda disponible;
- sabe qué hacer después;
- no describe la pantalla como “un dashboard vacío”;
- no siente que debe configurar un sistema antes de recibir ayuda.

---

# 17. Señales de FAIL

Revisar Paso 1 si:

- pregunta “¿qué es un Frente?” antes de empezar;
- no sabe cuál opción seleccionar;
- interpreta “Preparar espacio” como configuración técnica;
- el checklist se percibe como onboarding largo;
- espera completar cinco formularios;
- no descubre el Copilot;
- cree que “Empezar iniciativa” y “Preparar espacio” son lo mismo;
- no entiende qué valor recibirá después;
- piensa que debe tener todos sus datos perfectamente organizados antes de continuar.

---

# 18. Decisión al cerrar Paso 1

No avanzar a Step 2 del prototipo hasta decidir:

```text
¿La promesa se entiende?
¿Las entradas son claras?
¿La guía ayuda o abruma?
¿El Copilot es descubrible?
¿El usuario sabe qué hará después?
```

Solo después se diseña en detalle:

**Paso 2 — Entrada de información + First Analytical Value.**
