# STARTERIA — Portfolio Lead Relationship Review — Step 3 v0.1

**Estado:** PROPUESTA PARA TESTING  
**Vertical:** Portfolio Lead → First Value → Setup → Monitoring  
**Depende de:**
- `STARTERIA_PORTFOLIO_LEAD_FIRST_VALUE_E2E_TEST_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_FIRST_ANALYTICAL_VALUE_STEP2_v0.1.md`

**Objetivo:** Validar si un Portfolio Lead puede revisar, corregir y aceptar cómo se relacionan su objetivo y el trabajo existente antes de convertir esa interpretación en estructura gobernada de Startería.

---

# 1. Punto de entrada

Este paso comienza cuando el usuario ya recibió First Analytical Value.

Estado de la guía:

```text
Tu guía de inicio · 2 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento
```

Startería ya dispone provisionalmente de:

- objetivo / resultado deseado;
- horizonte cuando existe;
- iniciativas o trabajo detectado;
- owners mencionados;
- señales iniciales;
- una primera agrupación sugerida;
- provenance de lo declarado, extraído e inferido.

Todavía NO debe existir confirmación canónica de la estructura sugerida por IA.

---

# 2. Job del usuario

> Quiero comprobar si Startería entendió correctamente cómo se relaciona mi trabajo con lo que quiero conseguir, corregirlo si hace falta y adoptar una estructura que me ayude a seguirlo.

---

# 3. Principio de experiencia

Startería no pregunta:

> ¿Cuál es tu Frente Estratégico?  
> ¿Cuáles son tus Retos?

Primero muestra visualmente:

> Esto es lo que parece que estás intentando conseguir y así parece distribuirse el trabajo que ya tienes.

Después introduce la terminología únicamente cuando aporta comprensión.

---

# 4. Hipótesis a validar

## HYP-RR-01 — Relation-first

Una representación visual de:

```text
Objetivo
↓
espacios de trabajo
↓
iniciativas
```

es más comprensible que pedir al usuario configurar primero la ontología de Startería.

## HYP-RR-02 — Progressive Challenge

El concepto Reto gana valor cuando:

- el objetivo es amplio;
- existen varias iniciativas;
- las iniciativas atacan partes distintas;
- varias iniciativas necesitan ser comparadas bajo un mismo foco;
- existe un gap que merece seguimiento independiente.

## HYP-RR-03 — Human confirmation

El usuario confía más en la estructura si puede:

- entender por qué fue propuesta;
- mover iniciativas;
- renombrar agrupaciones;
- fusionar/separar;
- rechazar una agrupación;
- continuar sin subdividir cuando corresponde.

---

# 5. Caso de test — NovaGrowth

Objetivo declarado:

> Conseguir 200 nuevas ventas de una nueva línea B2B durante Q4.

Startería detectó:

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

Esta estructura sigue siendo:

```text
AI_SUGGESTED
UNREVIEWED
```

---

# 6. Pantalla propuesta

```text
Tu guía de inicio · 2 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
○ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento


Revisa cómo se relaciona tu trabajo

Objetivo
200 nuevas ventas B2B · Q4

Startería encontró tres grupos que podrían ayudarte
a seguir este objetivo por separado.

┌───────────────────────────────────────────────┐
│ Generar oportunidades                         │
│                                               │
│ Content Campaign                              │
│ Channel Partners                              │
│ Webinar Series                                │
│                                               │
│ 3 iniciativas                                 │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ Trabajar oportunidades                        │
│                                               │
│ Lead Assistant                                │
│ CRM Follow-up                                 │
│                                               │
│ 2 iniciativas                                 │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ Convertir oportunidades                       │
│                                               │
│ Pricing Pilot                                 │
│ Checkout Optimizer                            │
│                                               │
│ 2 iniciativas                                 │
└───────────────────────────────────────────────┘

Esta organización es una propuesta de Startería.

[Usar esta organización]
[Editar]
[Prefiero mantenerlo sin dividir]
```

---

# 7. No llamar “Retos” inmediatamente

En la primera visualización utilizar:

> grupos

o:

> espacios de trabajo

hasta que el usuario entienda por qué existen.

Después de aceptar una subdivisión, Startería puede introducir:

> Estos espacios se gestionarán en Startería como **Retos**.

Ayuda contextual:

> **Reto:** una parte concreta de un objetivo estratégico que quieres abordar y seguir por separado. Puede agrupar una o varias iniciativas relacionadas.

La terminología aparece después del valor, no antes.

---

# 8. Explicar por qué Startería propuso la estructura

Cada agrupación debe poder responder:

> ¿Por qué están juntas estas iniciativas?

Ejemplo:

### Generar oportunidades

Startería observa que:

- Content Campaign busca atraer potenciales clientes;
- Channel Partners busca abrir nuevas fuentes de oportunidades;
- Webinar Series busca captar potenciales clientes.

Por eso propone seguirlas dentro de un mismo espacio.

Acción:

`¿Por qué este grupo?`

Copilot:

> Las agrupé porque las tres parecen contribuir principalmente a generar nuevas oportunidades antes de la etapa de activación o conversión. Esta interpretación es provisional y puedes cambiarla.

No revelar chain-of-thought interno; mostrar únicamente señales de negocio auditables.

---

# 9. Edición de la propuesta

Al seleccionar `Editar`, permitir acciones simples.

## Sobre grupos

- renombrar;
- dividir;
- fusionar;
- eliminar agrupación;
- crear nuevo grupo.

## Sobre iniciativas

- mover entre grupos;
- dejar sin agrupar temporalmente;
- marcar interpretación incorrecta;
- indicar que dos iniciativas son la misma;
- mantener iniciativa independiente dentro del objetivo cuando el modelo de testing lo permita visualmente.

No pedir todavía configuración avanzada.

---

# 10. Caso: el usuario rechaza los grupos

Usuario:

> Para nosotros Lead Assistant y Pricing Pilot forman parte del mismo esfuerzo comercial.

Debe poder mover ambas iniciativas.

Startería actualiza la propuesta y mantiene trazabilidad:

```text
previous_relationship = AI_SUGGESTED
user_change = move initiative
new_relationship = USER_CONFIRMED candidate
```

No discutir con el usuario porque su clasificación difiera de la IA.

---

# 11. Caso: el usuario quiere mantener todo junto

Acción:

> Prefiero mantenerlo sin dividir.

Startería puede preguntar una sola vez:

> Puedes hacerlo. Seguirás viendo las iniciativas vinculadas al mismo objetivo. Si más adelante aparecen espacios distintos que convenga comparar por separado, Startería podrá proponerte organizarlos.

No bloquear el avance de UX.

IMPORTANTE:

Esto prueba únicamente progressive disclosure visual.

No modifica por sí mismo el modelo canónico corporativo vigente.

Si hacer Challenge opcional en dominio fuese necesario, debe resolverse posteriormente mediante ADR.

---

# 12. Caso: Startería detecta un posible gap

Supongamos que Strategic Frame confirmado posteriormente contiene:

- generación;
- activación;
- conversión.

Pero no existe trabajo asociado a conversión.

Startería puede mostrar:

```text
Convertir oportunidades

Sin iniciativas asociadas
```

Y decir:

> Todavía no existe trabajo relacionado con este espacio.

No:

> Cobertura insuficiente.

No:

> Debes crear una iniciativa.

Acciones:

- `Explorar este espacio`
- `Vincular trabajo existente`
- `Ahora no`

El Portfolio Lead decide si ese gap merece acción.

---

# 13. Caso: posible solapamiento

Si dos iniciativas parecen atacar:

- audiencia similar;
- mecanismo similar;
- cambio esperado similar;

Startería puede indicar:

> Posible solapamiento

No:

> Duplicadas.

Ejemplo:

```text
Content Campaign
AI Content Campaign

Startería observa similitud en audiencia,
mecanismo y cambio esperado.

[Comparar]
```

La decisión de fusionar, mantener o reformular pertenece al humano.

---

# 14. Estructura simple

No todos los objetivos requieren subdivisión visual.

Caso:

```text
Objetivo
Reducir tiempo de aprobación a ≤2 días

Initiative
Approval Flow Automation
```

Vista:

```text
Reducir tiempo de aprobación
Meta: ≤2 días · Q4

Trabajo relacionado

Approval Flow Automation
Owner: Ana
```

No mostrar una card artificial:

> Reto: Reducir tiempo de aprobación.

El modelo visual debe evitar duplicar el objetivo como un Reto sin valor cognitivo.

---

# 15. Estructura compleja

Caso:

```text
Objetivo
200 nuevas ventas B2B

7 iniciativas
3 mecanismos diferenciados
```

Vista después de confirmación:

```text
Crecimiento nuevo negocio
Meta: 200 nuevas ventas · Q4

Retos

Generar oportunidades
3 iniciativas

Trabajar oportunidades
2 iniciativas

Convertir oportunidades
2 iniciativas
```

Aquí sí el término Reto aporta orientación.

---

# 16. Confirmación

Al pulsar `Usar esta organización`, mostrar un checkpoint breve:

```text
Así quedará organizado tu trabajo

Objetivo
200 nuevas ventas B2B · Q4

3 Retos
7 iniciativas relacionadas

Puedes cambiar esta estructura más adelante.
Los cambios materiales quedarán trazados.

[Confirmar organización]
[Volver a revisar]
```

Este checkpoint convierte:

```text
AI_SUGGESTED
→ USER_CONFIRMED
```

para las relaciones aceptadas.

---

# 17. Qué se confirma y qué NO

El usuario puede confirmar:

- objetivo interpretado;
- agrupación;
- relación iniciativa ↔ grupo;
- naming;
- que desea utilizar esa estructura para seguimiento.

Todavía NO confirma automáticamente:

- calidad de cada iniciativa;
- alineamiento definitivo;
- impacto;
- cobertura suficiente;
- owner formal cuando no ha sido validado;
- evidencia;
- decisión de continuidad.

---

# 18. Actualización de la guía

Tras confirmar:

```text
Tu guía de inicio · 3 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento
```

Startería muestra:

> Ya tienes una estructura inicial. Ahora revisemos quién se hará cargo de cada iniciativa.

CTA:

`Revisar responsables`

Esto abre Paso 4.

---

# 19. Copilot durante Step 3

Contexto:

```text
role = portfolio_lead
workspace_state = SETUP
current_job = relationship_review
guide_progress = 2/5 → 3/5
```

Preguntas sugeridas:

- ¿Por qué propusiste estos grupos?
- ¿Tiene sentido separar este objetivo?
- ¿Qué iniciativas parecen similares?
- ¿Hay alguna iniciativa que no encaje?
- ¿Puedo cambiarlo después?
- ¿Por qué convertir esto en un Reto?

Ejemplo:

> Un Reto es útil cuando quieres seguir una parte concreta del objetivo por separado o cuando varias iniciativas necesitan compararse dentro de un mismo espacio. Si esa separación no te aporta valor, no necesitas verla como una capa adicional en este momento.

---

# 20. Data semantics de Step 3

Distinguir:

```text
ProposedRelationship
ConfirmedRelationship
RejectedRelationship
UnclassifiedWork
PossibleOverlap
UnaddressedArea
```

No introducir todavía:

```text
coverage_score
portfolio_health
alignment_score
success_probability
```

---

# 21. Acceptance Criteria

## AC-P3-01 — Relation comprehension

El usuario puede explicar qué relación existe entre el objetivo, las agrupaciones y las iniciativas.

## AC-P3-02 — Challenge purpose

Si aparece un Reto, el usuario puede explicar para qué sirve sin repetir una definición memorizada.

## AC-P3-03 — No forced ontology

Un caso simple puede entenderse sin mostrar una capa Reto visualmente redundante.

## AC-P3-04 — AI proposal clarity

El usuario distingue claramente entre estructura propuesta y estructura confirmada.

## AC-P3-05 — Editability

Puede corregir relaciones sin reiniciar el setup.

## AC-P3-06 — Human authority

La IA no publica la estructura material sin checkpoint humano.

## AC-P3-07 — Gap honesty

Una zona sin trabajo se muestra como hecho observable, no como insuficiencia automática.

## AC-P3-08 — Overlap honesty

La IA puede señalar posible solapamiento, no duplicidad definitiva.

## AC-P3-09 — Progressive terminology

La palabra Reto aparece cuando aporta comprensión.

## AC-P3-10 — Clear continuation

Después de confirmar entiende que el siguiente trabajo es validar responsables.

---

# 22. Test Script

Moderador:

> Startería te propone una forma de organizar el trabajo que introdujiste. Revísala como lo harías normalmente y déjala de una manera que te resulte útil para hacer seguimiento.

No explicar:

- qué agrupación es la correcta;
- que esperamos tres Retos;
- dónde debe mover cada iniciativa;
- qué significa Challenge.

---

# 23. Tareas observables

Pedir al tester:

1. Explicar qué está viendo.
2. Identificar qué iniciativas están relacionadas con cada parte.
3. Revisar una agrupación.
4. Cambiar una iniciativa de grupo.
5. Identificar un posible gap.
6. Decidir si mantener la subdivisión.
7. Confirmar la estructura.

---

# 24. Preguntas post-task

1. ¿Para qué crees que sirven estas agrupaciones?
2. ¿Qué diferencia ves entre el objetivo y un Reto?
3. ¿Te ayuda esta estructura o preferirías ver todas las iniciativas juntas?
4. ¿Entendiste por qué Startería agrupó cada iniciativa?
5. ¿Sentiste que Startería estaba decidiendo por ti?
6. ¿Te resultó fácil corregirla?
7. ¿Qué esperarías hacer ahora?
8. ¿Usarías esta estructura para revisar el portafolio en unas semanas?

---

# 25. Success metrics

- task success rate;
- tiempo hasta comprender jerarquía;
- errores objetivo ↔ Reto;
- errores Reto ↔ Initiative;
- número de correcciones;
- ability_to_explain_challenge_purpose;
- perceived_structure_value 1–5;
- trust_in_ai_proposal 1–5;
- perceived_control 1–5;
- willingness_to_use_structure 1–5.

---

# 26. Critical question

Preguntar:

> Si tuvieras 20 iniciativas, ¿esta forma de organizarlas te ayudaría a entender mejor cómo se relacionan con tus objetivos o añadiría complejidad innecesaria?

Registrar la respuesta textual.

---

# 27. Failure signals

Revisar Step 3 si:

- usuario no distingue objetivo y Reto;
- percibe agrupaciones como etiquetas arbitrarias;
- pregunta por qué necesita Retos;
- siente que la IA decidió la estructura;
- mover iniciativas es difícil;
- la jerarquía ocupa demasiado espacio;
- todos los casos terminan necesitando Retos;
- todos los casos terminan evitando Retos;
- no puede explicar dónde pertenece una iniciativa;
- no ve ventaja frente a una lista plana.

---

# 28. Boundary con Core

Este Step 3 prueba:

```text
progressive disclosure de UX
+
propuesta de relaciones
+
confirmación humana
```

No decide:

```text
Challenge opcional en dominio corporativo
```

El modelo canónico actual no se modifica durante este test.

Si los resultados muestran que una relación directa Frente → Initiative debería existir canónicamente, crear ADR antes de implementar ese cambio.

---

# 29. Salida hacia Paso 4

Después de confirmar organización:

```text
Paso 3
Revisar relaciones
        ↓
estructura aceptada
        ↓
Paso 4
Confirmar responsables
```

Paso 4 debe resolver:

- owner detectado vs confirmado;
- iniciativas sin owner;
- responsabilidad Portfolio vs execution;
- preparación del Handoff;
- cuándo una iniciativa está lista para activar seguimiento.

No reabrir la lógica ya cerrada de Portfolio Lead → Initiative Owner Handoff salvo dependencia real.
