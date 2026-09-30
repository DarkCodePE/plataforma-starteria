# STARTERIA_E2E_VISUAL_EXPERIENCE_ARCHITECTURE_v0.1

> Reconciliación ADR-006: para Landing pública, Portfolio Entry y Continuation, consultar
> `STARTERIA_PUBLIC_LANDING_PORTFOLIO_ENTRY_CONTINUATION_ARCHITECTURE_v0.1.md`. Sus reglas adaptan
> los ejemplos anteriores de funnel único hacia `/public/start`; no modifican las foundations ni los
> patrones generales de este documento.

**Estado:** Draft para validación de producto/diseño
**Propósito:** Congelar la arquitectura visual y experiencial E2E de Starteria antes de convertirla en Design System e implementación.
**Ámbito:** Portfolio Lead + Initiative Owner + Sponsor + Mentor + Copilot + comunicación + retorno al portafolio.
**Regla:** Este documento define superficies, roles, jobs, anatomías y presencia del Copilot. No redefine lógica Core, autoridad humana/IA, Steps ni reglas de negocio.

---

## 0. Principios rectores

1. **Una sola experiencia Starteria.** Landing, Portfolio, invitaciones, iniciativas, Steps, revisiones y decisiones deben sentirse parte del mismo producto.
2. **Conversación para entender; estructura para recordar; portfolio para decidir.**
3. **El Copilot es contextual, no un chat genérico permanente.** Su job cambia según la superficie.
4. **La IA propone; el humano confirma o decide cuando existe autoridad organizacional.**
5. **El frontend representa estado; no inventa lógica de negocio.**
6. **MVP flexible.** Copy, orden de bloques y variantes de experiencia pueden cambiar sin rehacer foundations ni primitives.
7. **La arquitectura visual debe soportar trazabilidad, evidencia, decisiones y aprendizaje.**
8. **La landing puede ser más editorial/premium; el producto interno debe ser más sobrio, estructurado y operativo.**

---

# 1. Mapa E2E maestro

```text
01 Landing pública
â†“
02 Portfolio Entry
â†“
03 Quick Clarification / Guided Exploration
â†“
04 Handoff pre-registro
â†“
05 Registro / acceso
â†“
06 Portfolio Home
â†“
07 Frente estratégico
â†“
08 Crear reto
â†“
09 Detalle de reto
â†“
10 Activación del reto
â†“
11 Email de invitación
â†“
12 Landing de invitación
â†“
13 Aceptación / Start
â†“
14 Initiative Overview
â†“
15 Step 0
â†“
16 Step 1
â†“
17 Step 2
â†“
18 Step 3
â†“
19 Step 4
â†“
20 Revisión IA / Mentor / Sponsor
â†“
21 Initiative / Decision Brief
â†“
22 Copilot Strategic Questions
â†“
23 Decisión humana
â†“
24 Retorno al Portfolio
â†“
25 Learning retained
```

---

# 2. Superficie 01 â€” Landing pública

**Rol principal:** Portfolio Lead potencial
**Job:** Entender qué problema resuelve Starteria y comenzar sin aprender la ontología del producto.
**Modo visual:** Editorial / premium / limpio.
**Copilot:** Implícito; no panel lateral.

### Anatomía

```text
TOP NAV
Starteria       Cómo funciona       Para empresas       Entrar

HERO
Convierte tus iniciativas en decisiones conectadas al negocio.

Subcopy breve.

[Empieza con tu situación]

Visual / ambient graphic

CAPACIDADES
ALINEAR | ENTENDER | SEGUIR | DECIDIR

CÓMO FUNCIONA
01 Cuéntanos qué quieres mover
02 Starteria ordena el contexto
03 Estructura tu portafolio
04 Desarrolla iniciativas
05 Decide con evidencia

CTA FINAL
[Analizar mi situación]
```

### Dirección visual
- mucho espacio;
- tipografía protagonista;
- gradiente/luz suave como recurso puntual;
- cards grandes y limpias;
- no parecer dashboard desde el primer segundo.

---

# 3. Superficie 02 â€” Portfolio Entry

**Rol:** Portfolio Lead potencial
**Job:** Expresar en lenguaje natural qué necesita conseguir o entender.
**Copilot:** La propia interfaz representa a Starteria.

### Anatomía

```text
¿Qué necesitas conseguir o entender de tus iniciativas?

[Textarea]

[Analizar mi situación]

Ejemplos:
Alinear iniciativas
Entender bloqueos
Preparar comité
Decidir prioridades
```

### Reglas
- sin ontología interna obligatoria;
- sin formularios largos;
- sin dashboards;
- una acción principal.

---

# 4. Superficie 03 â€” Clarification

**Rol:** Portfolio Lead potencial
**Job:** Reducir ambigÃ¼edad material con mínima fricción.
**Copilot:** Conversacional estructurado.

### Anatomía

```text
Starteria está ordenando tu situación

Tú:
...

âœ¦ Starteria:
Esto es lo que entendí...

Pregunta crítica

[respuesta]

Aclaración 1 de hasta 3
```

### Estados
- Quick Clarification
- Guided Exploration opt-in
- Sufficient context
- Ready for handoff

### Regla
No convertirse en chat abierto infinito.

---

# 5. Superficie 04 â€” Handoff pre-registro

**Rol:** Portfolio Lead potencial
**Job:** Mostrar valor ya generado y convertir ese valor en motivo para crear workspace.
**Modo visual:** Dos columnas; referencia editorial con bloque de conversión destacado.

### Columna izquierda â€” Lectura Starteria

```text
TU LECTURA STARTERIA

Lo que entendimos
...

Qué quieres conseguir
...

Qué decisión necesitas habilitar
...

Lo que ya sabemos
âœ“ ...

Lo que todavía falta
â—‹ ...

Cómo lo abordaríamos
1.
2.
3.
```

### Columna derecha â€” Conversión

```text
CONTINÚA CON STARTERIA

Con Starteria podrás:
âœ“ estructurar prioridades
âœ“ conectar iniciativas
âœ“ detectar gaps
âœ“ seguir evidencia
âœ“ preparar decisiones

Tu ruta:
Portfolio
â†’ Retos
â†’ Iniciativas
â†’ Evidencia
â†’ Decisión

[Crear mi espacio]
```

### Copilot
No chat. La recomendación aparece integrada como `Starteria Suggested`.

---

# 6. Superficie 05 â€” Registro / acceso

**Job:** Guardar el valor obtenido y continuar sin romper contexto.

```text
Guarda tu análisis

Ya hiciste la primera parte.
Crea tu espacio para seguir trabajando sobre esta misma información.

[Google]
[Email]

No perderás lo que acabas de estructurar.
```

---

# 7. Superficie 06 â€” Portfolio Home

**Rol:** Portfolio Lead
**Job:** Responder â€œ¿qué requiere atención hoy?â€
**Copilot:** Panel contextual persistente.

### Anatomía

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ NAV          â”‚ MAIN                          â”‚ COPILOT        â”‚
â”‚ Inicio       â”‚ ¿Qué requiere atención hoy?  â”‚ âœ¦ Starteria    â”‚
â”‚ Portafolio   â”‚                               â”‚                â”‚
â”‚ Decisiones   â”‚ resumen ejecutivo             â”‚ prioriza       â”‚
â”‚              â”‚ attention queue               â”‚ explica        â”‚
â”‚              â”‚ frentes                       â”‚ orienta        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Copilot job
- priorizar atención;
- explicar por qué importa;
- sugerir dónde entrar;
- no decidir por el Portfolio Lead.

---

# 8. Superficie 07 â€” Frente estratégico

**Rol:** Portfolio Lead
**Job:** Entender si una prioridad está suficientemente cubierta por retos/iniciativas.
**Copilot:** Lectura de cobertura.

### Anatomía

```text
Frente estratégico
KPI / señal | baseline | target | horizonte | sponsor

Retos asociados

Cobertura general

Alertas

Próxima acción
```

### Copilot
- identificar gaps de cobertura;
- señalar ambigÃ¼edad;
- proponer foco/revisión;
- no confirmar alineamiento automáticamente.

---

# 9. Superficie 08 â€” Crear reto

**Rol:** Portfolio Lead
**Job:** Convertir prioridad en unidad accionable.
**Copilot:** Estructurador contextual.

### Anatomía

```text
Crear reto

¿Qué quieres mover?
[ ]

Tipo
Corrección | Crecimiento | Exploración

Por qué importa ahora
[ ]

KPI / señal
[ ]

Restricciones
[ ]

âœ¦ Starteria
Observación / propuesta / acotación

[Guardar borrador]
[Continuar]
```

---

# 10. Superficie 09 â€” Detalle de reto

**Rol:** Portfolio Lead
**Job:** Entender cobertura, iniciativas, bloqueos y decisiones.
**Copilot:** Analista de cobertura.

### Anatomía

```text
Frente > Reto

Header
tipo | KPI | estado | sponsor | challenge owner

Activación

Cobertura

Pipeline de iniciativas

Alertas

Acciones
```

### Copilot
- cobertura;
- solapamientos;
- gaps;
- bloqueos;
- siguiente acción.

---

# 11. Superficie 10 â€” Activación del reto

**Rol:** Portfolio Lead
**Job:** Elegir cómo movilizar personas/capacidades.
**Copilot:** Recomendador de modalidad.

### Anatomía

```text
Activar reto

Modalidad:
â—‹ Convocatoria abierta
â—‹ Personas seleccionadas
â— Squad asignado
â—‹ Equipo core

âœ¦ Starteria recomienda:
Squad asignado

Porque:
â€¢ urgencia
â€¢ dependencia
â€¢ ventana temporal

[Usar esta modalidad]
```

### Regla
Starteria recomienda; Portfolio Lead confirma.

---

# 12. Superficie 11 â€” Sistema estándar de Emails

**Roles:** Initiative Owner, Mentor, Sponsor, Portfolio Lead
**Job:** Comunicar evento + contexto + acción.

### Anatomy universal

```text
STARTERIA

Context label

Título

Qué ocurrió

Por qué importa

Contexto mínimo relevante

CTA

¿Por qué recibes este correo?
```

### Familia mínima
- Invitation
- Invitation reminder
- Sponsor touchpoint
- Mentor review request
- Review completed
- Decision required
- Initiative blocked
- Initiative ready for decision
- Decision registered

---

# 13. Superficie 12 â€” Invitation Landing

**Rol:** Invitado
**Job:** Entender contexto, rol y responsabilidad antes de aceptar.

```text
Starteria

Has sido invitado a participar

Reto
...

Frente
...

Tu rol
Initiative Owner

Qué implica
â€¢ ...
â€¢ ...

Invitado por
...

[Aceptar invitación]
[No puedo participar]
```

---

# 14. Superficie 13 â€” Acceptance / Start

**Rol:** Initiative Owner
**Job:** Crear transición entre invitación y workspace.

```text
Tu iniciativa está lista

Contexto heredado

Frente
Reto
Objetivo
Restricciones

Tu ruta
Step 0 â†’ Step 1 â†’ Step 2 â†’ Step 3 â†’ Step 4

[Ir al Overview]
```

---

# 15. Superficie 14 â€” Initiative Overview

**Rol:** Initiative Owner
**Job:** Entender qué intenta conseguir la iniciativa, qué sabemos, qué falta y qué sigue.
**Copilot:** Contextualizador.

### Anatomía

```text
Frente > Reto > Iniciativa

Nombre
Estado / Step

Siguiente acción

Ruta Step 0â€“4

Contexto heredado

Evidencia

Bloqueos

Copilot
```

---

# 16. Superficies 15â€“19 â€” Step Workspace

**Rol:** Initiative Owner
**Job:** Ejecutar el Core Step 0â€“4.
**Copilot:** Guía contextual.

### Anatomía estable

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ STEP NAV     â”‚ WORK AREA                     â”‚ COPILOT       â”‚
â”‚ âœ“ Step 0     â”‚ título                        â”‚ âœ¦ Starteria   â”‚
â”‚ â— Step 1     â”‚ contexto ancla                â”‚               â”‚
â”‚ â—‹ Step 2     â”‚ trabajo guiado                â”‚ explica       â”‚
â”‚ â—‹ Step 3     â”‚ evidencia                     â”‚ cuestiona     â”‚
â”‚ â—‹ Step 4     â”‚ output                        â”‚ sugiere       â”‚
â”‚              â”‚                               â”‚ revisa        â”‚
â”‚              â”‚ [Enviar a revisión]           â”‚               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Regla
La anatomía permanece; cambian contenido, profundidad, evidencia y job cognitivo.

---

# 17. Superficie 20 â€” Review

### AI Review

```text
Revisión Starteria

Resultado
Requiere ajustes

Qué está bien
âœ“

Qué falta
â—‹

Por qué importa

Siguiente acción

[Volver al Step]
```

### Mentor Review

```text
Revisión Mentor

Mentor
Resultado
Comentario
Observaciones

[Aprobar]
[Solicitar ajuste]
```

### Regla
AI Review, Human Review y Sponsor Decision deben ser visualmente distinguibles.

---

# 18. Superficie 21 â€” Initiative / Decision Brief

**Rol:** Portfolio Lead / Sponsor / autoridad de decisión
**Job:** Convertir el trabajo del equipo en una lectura ejecutiva accionable.

### Anatomía

```text
INITIATIVE BRIEF

Qué buscábamos conseguir

Qué hicimos

Qué aprendimos

Evidencia principal

Resultado obtenido

Qué cambió respecto al inicio

Riesgos / límites

Recomendación del equipo

âœ¦ Mirada Starteria
```

---

# 19. Superficie 22 â€” Copilot Strategic Questions

**Job del Copilot:** Preparar mejor la decisión.

Starteria produce 3 preguntas estratégicas, por ejemplo:

1. ¿La evidencia obtenida responde al riesgo que justificó crear la iniciativa?
2. ¿Qué condición tendría que cumplirse para ampliar la inversión?
3. ¿Qué debería cambiar en ownership si deja de ser experimental?

### Output adicional
Una conclusión breve y razonada:

> La evidencia respalda mantener viva la iniciativa, pero todavía no permite justificar una implementación completa.

### Regla
No decide. Prepara la decisión.

---

# 20. Superficie 23 â€” Decisión humana

```text
Decisión

â—‹ Iterar
â—‹ Pivotear
â—‹ Ampliar prueba
â—‹ Escalar
â—‹ Transferir
â—‹ Cerrar con aprendizaje

Justificación
[ ]

[Registrar decisión]
```

### Autoridad
Humano autorizado.

---

# 21. Superficie 24 â€” Retorno al Portfolio

**Job:** Actualizar contexto del reto/portfolio con la decisión y aprendizaje.

```text
Reto
Reducir abandono

3 iniciativas

1 transferida a operación
1 continúa iteración
1 cerrada con aprendizaje

Cobertura
Suficiente

Última decisión
Automatización onboarding
â†’ Escalar prueba
```

El brief queda accesible.

---

# 22. Superficie 25 â€” Learning Retained

**Job:** Evitar que cerrar una iniciativa equivalga a perder conocimiento.

### Learning Record

```text
qué probamos
qué ocurrió
qué aprendimos
qué decisión tomamos
qué no repetir
qué puede reutilizarse
```

No necesita ser una gran pantalla MVP; puede comenzar como objeto consultable.

---

# 23. Jobs del Copilot por superficie

| Superficie | Job |
|---|---|
| Landing | implícito / promesa |
| Portfolio Entry | entender |
| Clarification | aclarar |
| Handoff | orientar / proponer |
| Portfolio Home | priorizar atención |
| Frente | leer cobertura |
| Crear reto | estructurar |
| Reto | analizar cobertura |
| Activation | recomendar modalidad |
| Initiative Overview | contextualizar |
| Steps | guiar trabajo |
| Review | criticar / señalar gaps |
| Decision Brief | sintetizar |
| Strategic Questions | preparar decisión |
| Return to Portfolio | explicar impacto de la decisión |

---

# 24. Anatomías de página derivadas

La arquitectura E2E anterior debería reducirse después a estas familias:

1. `PublicLandingPage`
2. `ConversationEntryPage`
3. `HandoffConversionPage`
4. `PortfolioWorkspacePage`
5. `GuidedCreationPage`
6. `InvitationPage`
7. `InitiativeWorkspacePage`
8. `ReviewDecisionPage`
9. `EmailCommunicationPattern`

Estas familias serán definidas en `STARTERIA_PAGE_ANATOMY_SYSTEM_v0.1.md`.

---

# 25. Dirección visual transversal

### Landing / Handoff
- editorial;
- premium;
- aire;
- grandes bloques;
- luz/gradiente sutil;
- visualmente inspirada en las referencias compartidas.

### Producto interno
- Strategic Calm + Intelligent Momentum;
- neutralidad dominante;
- índigo como brand;
- color usado con semántica;
- densidad adaptativa;
- Copilot integrado.

### Emails / Invitations
- mismos tokens y lenguaje;
- máxima claridad;
- contexto + acción.

---

# 26. Qué queda explícitamente fuera de este documento

Este documento NO define todavía:
- HEX definitivos;
- escala tipográfica final;
- spacing tokens;
- componentes React;
- API del Copilot;
- feature flags;
- Storybook;
- nombres técnicos finales de folders;
- implementación de rutas.

Eso pertenece al Design System Contract y Tech/Implementation Specs posteriores.

---

# 27. Próximos artefactos

Orden recomendado:

```text
STARTERIA_E2E_VISUAL_EXPERIENCE_ARCHITECTURE_v0.1
â†“
STARTERIA_PAGE_ANATOMY_SYSTEM_v0.1
â†“
STARTERIA_COPILOT_INTERACTION_SYSTEM_v0.1
â†“
STARTERIA_DESIGN_SYSTEM_CONTRACT_v0.1
â†“
Implementation slices for Codex
```

---

# 28. Estado de decisión

Esta v0.1 se considera lista para revisión de producto/diseño cuando:

- todas las superficies E2E están identificadas;
- cada superficie tiene rol, job y transición;
- el Copilot tiene un job contextual definido;
- email/invitation/brief/return-to-portfolio están incluidos;
- no se introduce lógica que contradiga Core;
- queda claro qué se define ahora y qué se difiere al Design System.
