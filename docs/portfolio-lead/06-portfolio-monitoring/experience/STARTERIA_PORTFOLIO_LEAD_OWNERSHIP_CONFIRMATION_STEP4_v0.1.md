# STARTERIA — Portfolio Lead Ownership Confirmation — Step 4 v0.1

**Estado:** PROPUESTA PARA TESTING  
**Vertical:** Portfolio Lead → First Value → Setup → Monitoring  
**Depende de:**
- `STARTERIA_PORTFOLIO_LEAD_FIRST_VALUE_E2E_TEST_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_FIRST_ANALYTICAL_VALUE_STEP2_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_RELATIONSHIP_REVIEW_STEP3_v0.1.md`

**Consume:** vertical ya cerrado `Portfolio Lead → Initiative Owner Handoff`

**Objetivo:** Validar si el Portfolio Lead puede revisar y confirmar quién se hará cargo de cada iniciativa, resolver iniciativas sin responsable y dejar el trabajo listo para entrar al Handoff existente sin reabrir su lógica.

---

# 1. Punto de entrada

Este paso comienza cuando el usuario ya confirmó cómo se relaciona el trabajo con el objetivo.

Estado de guía:

```text
Tu guía de inicio · 3 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento
```

Startería ya dispone de:

- objetivo confirmado;
- estructura de relaciones revisada;
- iniciativas detectadas o incorporadas;
- posibles owners extraídos de la información original;
- iniciativas sin owner;
- Retos cuando fueron confirmados como estructura útil.

Todavía no debe tratar un owner detectado como asignación confirmada.

---

# 2. Job del usuario

> Quiero asegurarme de que cada iniciativa tenga una persona claramente responsable antes de activar su seguimiento.

---

# 3. Principio de experiencia

Startería debe distinguir:

```text
owner mencionado
≠
owner detectado
≠
owner propuesto
≠
owner confirmado
```

El Portfolio Lead debe revisar y confirmar la asignación material.

---

# 4. Caso base — NovaGrowth

Después del Paso 3:

```text
Content Campaign
Owner detectado: Laura

Lead Assistant
Owner detectado: Ana

Pricing Pilot
Owner detectado: Carlos

Channel Partners
Owner detectado: Marta

Checkout Optimizer
Sin owner confirmado

CRM Follow-up
Owner detectado: Luis

Webinar Series
Sin owner confirmado
```

---

# 5. Pantalla propuesta

```text
Tu guía de inicio · 3 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
○ Confirma responsables
○ Activa el seguimiento


Confirma quién se hará cargo

Cada iniciativa necesita una persona responsable
antes de activar su seguimiento.

────────────────────────────────────

Content Campaign
Responsable detectado
Laura Gómez

[Confirmar] [Cambiar]


Lead Assistant
Responsable detectado
Ana Pérez

[Confirmar] [Cambiar]


Pricing Pilot
Responsable detectado
Carlos Ruiz

[Confirmar] [Cambiar]


Checkout Optimizer
Sin responsable

[Asignar responsable]


Webinar Series
Sin responsable

[Asignar responsable]
```

---

# 6. Densidad visual

No mostrar una card pesada por iniciativa.

Usar una lista compacta agrupada por Frente/Reto cuando aporte orientación.

Ejemplo:

```text
Crecimiento nuevo negocio

Generar oportunidades
Content Campaign      Laura Gómez      Confirmar
Channel Partners      Marta Díaz       Confirmar
Webinar Series        Sin responsable  Asignar

Activar interés
Lead Assistant        Ana Pérez        Confirmar
CRM Follow-up         Luis Soto        Confirmar

Conversión
Pricing Pilot         Carlos Ruiz      Confirmar
Checkout Optimizer    Sin responsable  Asignar
```

La estructura debe hacer visible a qué parte del objetivo pertenece cada Initiative.

---

# 7. Estados conceptuales de ownership

```text
OWNER_UNKNOWN
OWNER_DETECTED
OWNER_PROPOSED
OWNER_CONFIRMED
HANDOFF_PENDING
HANDOFF_ACCEPTED
HANDOFF_REJECTED
START_READY
STARTED
```

Step 4 solo gobierna hasta:

```text
OWNER_CONFIRMED
```

y prepara la entrada al vertical Handoff existente.

No redefine sus estados internos.

---

# 8. Confirmar owner detectado

Cuando Startería detectó un nombre en la información original:

> Responsable detectado: Laura Gómez

El usuario debe poder:

- confirmar;
- cambiar;
- indicar que no es correcto;
- dejar pendiente temporalmente.

Al confirmar:

```text
OWNER_DETECTED
→ OWNER_CONFIRMED
```

Debe quedar trazabilidad de que la confirmación fue humana.

---

# 9. Asignar owner faltante

Para una iniciativa sin owner:

```text
Checkout Optimizer
Sin responsable
```

Acción:

`Asignar responsable`

La selección puede permitir:

- persona existente del workspace;
- email;
- invitación futura;
- dejar pendiente.

No exigir todavía crear equipo completo.

Regla ya cerrada del vertical Handoff:

> Initiative Owner explícito + hasta 2 integrantes adicionales.

Este Step no modifica esa regla.

---

# 10. Equipo adicional

Después de confirmar Initiative Owner, puede existir una acción secundaria:

> Añadir equipo

No convertirla en requisito para completar Step 4.

El mínimo para avanzar es:

```text
Initiative Owner confirmado
```

El owner podrá definir su equipo posteriormente según el Handoff ya aprobado.

---

# 11. Qué hace Startería con owners faltantes

Startería puede señalar:

> 2 iniciativas todavía no tienen responsable.

No debe:

- asignar automáticamente una persona;
- inferir responsabilidad por cargo;
- convertir autoría de un documento en ownership;
- bloquear todo el workspace si otras iniciativas ya están listas.

---

# 12. Activación parcial

La guía puede avanzar por iniciativa.

Ejemplo:

```text
5 iniciativas listas
2 pendientes de responsable
```

El Portfolio Lead puede activar seguimiento sobre las cinco listas sin esperar necesariamente a resolver las otras dos.

Hipótesis a testear:

> permitir activación parcial reduce fricción y refleja mejor la realidad del portafolio.

No convertir esta hipótesis en cambio del Handoff.

---

# 13. Resumen de readiness

Al finalizar revisión:

```text
Responsables

5 iniciativas listas
2 iniciativas pendientes

Listas
✓ Content Campaign — Laura
✓ Lead Assistant — Ana
✓ Pricing Pilot — Carlos
✓ Channel Partners — Marta
✓ CRM Follow-up — Luis

Pendientes
○ Checkout Optimizer
○ Webinar Series
```

CTA principal:

`Continuar con las iniciativas listas`

CTA secundario:

`Resolver pendientes`

---

# 14. Qué significa “lista”

En este Step:

```text
lista
=
relación de trabajo confirmada
+
Initiative Owner confirmado
```

NO significa:

- initiative_started;
- handoff accepted;
- Step activado;
- evidencia suficiente;
- alineamiento definitivo;
- lista para ejecutar automáticamente.

---

# 15. Boundary con Handoff

Una vez que una iniciativa está lista, el sistema deriva al flujo ya existente:

```text
Portfolio Lead
→ asignación / invitación
→ auth continuation si aplica
→ Accept / Reject + reason
→ Portfolio Lead response
→ Activation Overview
→ Start explícito
```

Mantener:

```text
handoff_assignment_started != initiative_started
```

Step 4 no altera:

- invitation;
- auth continuation;
- reject flow;
- Portfolio Lead response;
- HandoffShell;
- Activation Overview;
- explicit Start;
- semantic events durables;
- PortfolioHandoffProjection.

---

# 16. UX de transición hacia Handoff

No mostrar un salto abrupto.

Ejemplo:

```text
5 iniciativas tienen responsable confirmado.

El siguiente paso es enviar cada iniciativa
a la persona que se hará cargo para que pueda
aceptar el contexto y comenzar cuando esté lista.

[Preparar asignaciones]
```

Este CTA abre el Handoff existente.

---

# 17. Copilot durante Step 4

Contexto:

```text
role = portfolio_lead
workspace_state = SETUP
current_job = confirm_ownership
guide_progress = 3/5
```

Preguntas sugeridas:

- ¿Qué significa ser responsable de una iniciativa?
- ¿Puedo dejar una iniciativa sin responsable por ahora?
- ¿Qué pasa si alguien rechaza la asignación?
- ¿Puede una persona tener varias iniciativas?
- ¿Puedo añadir más personas al equipo después?

El Copilot responde con las reglas existentes del Handoff.

No inventa nuevas reglas de ownership.

---

# 18. UX copy para Initiative Owner

Ayuda contextual:

> **Responsable de iniciativa**  
> Es la persona que lidera su ejecución, coordina el equipo y hace avanzar el trabajo dentro de Startería.

No:

> dueño del proyecto.

No implica propiedad del Frente/Reto/portafolio.

---

# 19. Distinción Portfolio Lead vs Initiative Owner

Mostrar contextual si existe duda:

```text
Portfolio Lead
organiza, observa, habilita e interviene.

Initiative Owner
ejecuta la iniciativa y genera evidencia.
```

Este Step debe reforzar esa separación antes de activar el seguimiento.

---

# 20. Caso: misma persona Portfolio Lead + Initiative Owner

Permitido cuando corresponda.

Startería debe distinguir los contextos de autoridad.

Ejemplo:

> Tú serás responsable de esta iniciativa además de gestionar el portafolio.

No asumir que por ser Portfolio Lead es automáticamente owner.

Requiere confirmación explícita.

---

# 21. Caso: owner detectado incorrecto

Usuario:

> Laura aparece porque presentó la iniciativa, pero quien la lidera es Pedro.

Startería debe:

- reemplazar propuesta;
- preservar corrección;
- confirmar Pedro;
- no mantener a Laura como owner.

La procedencia anterior queda superseded.

---

# 22. Caso: owner rechaza posteriormente

No resolver aquí.

Eso pertenece al Handoff cerrado.

La experiencia debe simplemente anticipar:

> La persona podrá aceptar o rechazar la asignación. Si la rechaza, volverá a ti con su motivo para resolverlo.

---

# 23. Actualización de guía

Después de resolver todos los owners deseados:

```text
Tu guía de inicio · 4 de 5

✓ Define qué quieres conseguir
✓ Añade el trabajo que ya existe
✓ Revisa cómo se relaciona
✓ Confirma responsables
○ Activa el seguimiento
```

CTA:

`Activar seguimiento`

Esto abre Paso 5.

---

# 24. Acceptance Criteria

## AC-P4-01 — Ownership clarity

El usuario entiende que cada Initiative necesita un Initiative Owner explícito.

## AC-P4-02 — Detection vs confirmation

El usuario distingue owner detectado de owner confirmado.

## AC-P4-03 — Relationship context

Puede ver a qué objetivo/Reto pertenece cada iniciativa mientras revisa owners.

## AC-P4-04 — Missing owner visibility

Iniciativas sin owner son visibles sin bloquear innecesariamente las demás.

## AC-P4-05 — No automatic assignment

Startería no convierte inferencias en ownership.

## AC-P4-06 — Partial readiness

El usuario entiende qué iniciativas están listas y cuáles siguen pendientes.

## AC-P4-07 — Handoff boundary

El usuario entiende que confirmar owner no significa que la iniciativa haya empezado.

## AC-P4-08 — Role distinction

Distingue Portfolio Lead de Initiative Owner.

## AC-P4-09 — Existing Handoff preserved

Accept/Reject/Start siguen perteneciendo al vertical existente.

## AC-P4-10 — Clear continuation

El usuario entiende que el siguiente paso es activar seguimiento / preparar Handoff.

---

# 25. Test Script

Moderador:

> Ya tienes una estructura que representa cómo quieres organizar el trabajo. Revisa ahora quién debería hacerse cargo de cada iniciativa y deja listas las que quieras activar.

No explicar:

- qué significa owner;
- cuáles deben activarse;
- si debe resolver todos los pendientes;
- cómo funciona el Handoff.

---

# 26. Tareas observables

Pedir al tester:

1. Confirmar un owner detectado.
2. Corregir un owner incorrecto.
3. Asignar owner a una iniciativa pendiente.
4. Dejar otra pendiente.
5. Identificar cuáles están listas.
6. Explicar qué ocurrirá al continuar.
7. Preparar las iniciativas listas para Handoff.

---

# 27. Preguntas post-task

1. ¿Qué significa para ti “responsable de iniciativa”?
2. ¿Qué diferencia existe entre tu rol y el del responsable?
3. ¿Qué crees que ocurrirá después de confirmar a una persona?
4. ¿Te resultó claro que la iniciativa todavía no empezó?
5. ¿Esperabas tener que resolver todas las iniciativas antes de continuar?
6. ¿Qué harías con las que siguen sin responsable?
7. ¿La estructura objetivo → Reto → Initiative siguió siendo comprensible mientras asignabas personas?

---

# 28. Success metrics

- owner_confirmation_success;
- owner_correction_success;
- missing_owner_resolution;
- role_comprehension;
- handoff_expectation_accuracy;
- false_start_assumption rate;
- perceived_control 1–5;
- setup_burden 1–5;
- willingness_to_continue 1–5.

---

# 29. Failure signals

Revisar Step 4 si:

- el usuario cree que owner = Portfolio Lead;
- cree que confirmar owner inicia automáticamente la Initiative;
- no entiende qué pasa con owners pendientes;
- la lista pierde contexto de Frente/Reto;
- se siente obligado a completar todo antes de continuar;
- el Copilot inventa reglas de equipo;
- aparece lógica nueva de Accept/Reject;
- se duplica la experiencia de Handoff existente.

---

# 30. Salida hacia Paso 5

```text
Paso 4
Confirmar responsables
        ↓
Initiatives ready for handoff
        ↓
Paso 5
Activar seguimiento
        ↓
consume Handoff existente
        ↓
Start explícito
        ↓
primera Home activa
```

Paso 5 debe definir únicamente cómo la guía de setup se cierra y cómo el usuario aterriza en la primera experiencia de monitoring.

No debe reimplementar Handoff.
