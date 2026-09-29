# STARTERIA — Portfolio Lead Slice A.1 — Test Readiness Hardening v0.1

**Estado:** IMPLEMENTATION FIX SPEC  
**Vertical:** Portfolio Lead → Portfolio Monitoring  
**Base:** Slice A — First Value  
**Objetivo:** Corregir únicamente los findings del Acceptance Review necesarios para que Slice A pueda ponerse delante de Portfolio Leads reales sin contaminar el test con navegación legacy, ambigüedad de provenance o fricciones evitables.

---

# 1. Fuente

Basado en:

- `PORTFOLIO_MONITORING_SLICE_A_ACCEPTANCE_REVIEW_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_SLICE_A_FIRST_VALUE_IMPLEMENTATION_SPEC_v0.1.md`
- `STARTERIA_PORTFOLIO_LEAD_E2E_PROTOTYPE_SPEC_v0.1.md`

Acceptance actual:

```text
READY_WITH_FIXES
First Value: STRONG_FIRST_VALUE
14 PASS
1 REVIEW
0 FAIL
```

No abre Slice B.

---

# 2. Alcance

Corregir exclusivamente:

1. aislamiento de navegación heredada;
2. comunicación del upload no disponible;
3. separación visual de provenance;
4. validación de jerarquía con mayor volumen;
5. instrumentación mínima de prototipo;
6. auditoría automatizada de accesibilidad.

No añadir nuevas capacidades funcionales.

---

# 3. FIX A1 — Navigation Isolation

## Problema

La navegación heredada puede exponer demasiado pronto el modelo:

```text
Frentes
→ Retos
→ Iniciativas
```

mientras el nuevo journey intenta comenzar desde:

```text
intención estratégica
→ contexto
→ interpretación
```

Esto puede contaminar el test aunque la pantalla central sea correcta.

## Objetivo

Durante `/portfolio/setup`, la navegación debe comportarse como contexto de setup y no como invitación a saltar al modelo ontology-first.

## Opción preferida

Reutilizar `PortfolioLeadLayout`, pero permitir un modo:

```text
setup / focused
```

que:

- preserve identidad y shell;
- oculte o desactive navegación no necesaria;
- mantenga salida segura;
- no cree un layout paralelo permanente.

## No hacer

- borrar navegación productiva;
- cambiar rutas legacy;
- crear un segundo design system;
- cambiar permisos.

## Acceptance

El tester puede completar P0–P3 sin que la navegación lateral compita con el CTA principal.

---

# 4. FIX A2 — Upload Disabled

## Problema

Upload visible pero deshabilitado puede percibirse como:

- feature rota;
- falta de permisos;
- error técnico.

## Ajuste

Mostrar explícitamente:

```text
Subir información
Próximamente en este prototipo
```

o:

```text
Subir archivo
No disponible durante esta prueba
```

Debe quedar claramente secundario frente a:

```text
Pegar información
```

## Acceptance

El usuario entiende que:

- no es un error;
- puede continuar;
- pegar información es suficiente.

---

# 5. FIX A3 — Provenance Hierarchy

## Problema

Los niveles existen conceptualmente pero deben distinguirse mejor visualmente.

## Capas mínimas

### Declarado por ti

Ejemplo:

```text
Meta
200 nuevas ventas B2B · Q4
```

### Encontrado en tu información

Ejemplo:

```text
7 iniciativas
5 responsables mencionados
```

### Lectura Startería

Ejemplo:

```text
El trabajo parece concentrarse en tres momentos...
```

## Regla

No convertir esto en sistema pesado de badges.

La diferencia debe surgir por:

- heading;
- copy;
- agrupación;
- micro-label;
- jerarquía visual.

## Acceptance

En test de 5 segundos, una persona puede distinguir:

```text
qué dijo ella
vs
qué encontró Startería
vs
qué interpretó Startería
```

---

# 6. FIX A4 — Volume Stress Validation

## Objetivo

Validar que P3 no funcione solo con siete iniciativas.

Crear fixture alternativo únicamente para dev/test:

```text
NovaGrowthExpanded
```

con aproximadamente:

```text
24 iniciativas
```

distribuidas en:

```text
3–5 agrupaciones
```

y:

```text
owners completos + incompletos
```

## Importante

No hacer que P3 liste las 24 iniciativas.

P3 debe seguir mostrando:

```text
interpretación
→ agrupaciones
→ máximo tres señales
```

y permitir explorar detalle después.

## Qué validar

- no desborda layout;
- no aparecen 24 cards;
- agrupaciones siguen siendo legibles;
- counts sirven como resumen;
- máximo tres señales;
- CTA principal permanece visible.

## No convertir este fixture en comportamiento productivo.

---

# 7. FIX A5 — Prototype Instrumentation

## Objetivo

Poder observar comportamiento durante testing sin introducir analytics productivo.

Eventos mínimos:

```text
portfolio_setup_started
portfolio_goal_submitted
portfolio_existing_work_submitted
portfolio_first_value_rendered
portfolio_rationale_opened
portfolio_interpretation_corrected
portfolio_relationship_review_clicked
```

## Implementación

Preferencia:

```text
prototype analytics adapter
```

o:

```text
local test callbacks
```

según capacidades existentes.

Puede escribir a:

- test hooks;
- console estructurada solo en dev;
- adapter no-op.

No añadir proveedor analytics.

## Acceptance

E2E puede verificar al menos eventos clave sin backend.

---

# 8. FIX A6 — Automated Accessibility Audit

Ejecutar auditoría automática sobre:

```text
P0
P1
P2
P3
```

Puede reutilizar tooling existente.

Si no existe:

- preferir herramienta ya compatible con stack;
- no añadir una dependencia pesada sin necesidad.

Comprobar al menos:

- labels;
- headings;
- landmarks;
- buttons;
- contrast detectable por tooling;
- textarea;
- focus;
- disabled state;
- drawer/rationale if aplica.

Documentar violations.

Corregir únicamente issues directamente relacionados con Slice A.

---

# 9. Prioridad

```text
P0
Navigation isolation
Provenance
Accessibility critical violations

P1
Upload explanation
Volume fixture
Prototype instrumentation
```

Todos deben quedar resueltos o explícitamente aceptados antes de test externo.

---

# 10. Tests requeridos

Mantener existentes:

```text
component/unit PASS
E2E P0→P3 PASS
typecheck PASS
```

Añadir:

```text
navigation focused mode test
provenance rendering test
expanded fixture render test
instrumentation event test
accessibility audit
```

No exigir Docker para cerrar A.1 si el entorno sigue sin daemon, siempre que quede registrado.

---

# 11. Acceptance Criteria

## AC-A1-01
La navegación legacy no compite con setup.

## AC-A1-02
No se modifica navegación productiva fuera de setup.

## AC-A1-03
Upload deshabilitado comunica claramente su estado.

## AC-A1-04
Declarado / encontrado / interpretación son distinguibles.

## AC-A1-05
Fixture ~24 iniciativas no degrada la jerarquía de First Value.

## AC-A1-06
P3 no intenta listar todas las iniciativas del fixture expandido.

## AC-A1-07
Máximo tres señales se mantiene.

## AC-A1-08
Instrumentación mínima permite seguir el journey.

## AC-A1-09
No se introduce analytics backend.

## AC-A1-10
Accessibility audit no deja violations críticas conocidas del slice.

## AC-A1-11
Slice B sigue sin implementarse.

---

# 12. Implementation Report

Crear:

```text
docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/
PORTFOLIO_MONITORING_SLICE_A1_TEST_READINESS_HARDENING_v0.1.md
```

Debe incluir:

- base SHA;
- branch;
- fixes aplicados;
- archivos;
- navegación;
- provenance;
- expanded fixture;
- instrumentación;
- accessibility;
- tests;
- deviations;
- remaining risks.

---

# 13. Exit

Slice A.1 queda listo cuando:

```text
Acceptance Review
→ fixes
→ regression tests
→ accessibility
→ manual check
```

y puede clasificarse:

```text
READY_FOR_USER_TEST
```

Solo después:

```text
User testing de Slice A
```

o, si el equipo decide avanzar en paralelo:

```text
Slice B implementation
```

pero los resultados de testing deben poder modificar B antes de congelarlo.

---

# 14. Principio

> Hardening no debe enriquecer el producto.

Debe eliminar ruido del test para que lo que midamos sea la propuesta de valor de First Value, no problemas evitables del prototipo.
