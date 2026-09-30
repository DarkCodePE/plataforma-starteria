# STARTERIA — Portfolio Lead Slice A.2 — Runtime Entry Alignment v0.1

**Estado:** IMPLEMENTATION SPEC  
**Vertical:** Portfolio Lead → Portfolio Monitoring  
**Slice:** A.2 — Runtime Entry Alignment

## Objetivo

Hacer que un Portfolio Lead con workspace vacío entre por la experiencia intent-first de
`/portfolio/setup`, sin exponer antes la Home V1 ontology-first. Los usuarios con un portfolio
activo conservan `/portfolio/inicio`.

## Alcance

- Routing de Portfolio Lead vacío/activo.
- Protección manual de `/portfolio/inicio` vacío.
- Navegación focused durante setup.
- Welcome, checklist y entrada visible al Copilot.
- Continuidad desde Portfolio Entry hacia setup preservando el contexto.
- Sin cambios de backend, Core, Steps, Handoff, migrations ni P4 Relationship Review.

## Estado runtime

```text
EMPTY  → /portfolio/setup
ACTIVE → /portfolio/inicio
```

La decisión se realiza solo para `user.role === 'portfolio_lead'`. El permiso
`portfolio:read` continúa gobernando el acceso, pero no decide la experiencia inicial de otros
roles.

## Criterio de estado

`ACTIVE` requiere al menos un Strategic Front con estado significativo (`active`, `tracking`,
`with_active_challenges` o `in_tracking`). En este checkout, Portfolio Bootstrap/read model solo
se carga para continuaciones de Entry; para una entrada directa se reutiliza el read path existente
de Strategic Fronts. No se inventa un nuevo schema de dominio.

`loading` no equivale a `EMPTY`. Un error de carga no redirige automáticamente a setup: conserva
el comportamiento seguro existente.

## Continuidad de Entry

La continuación autenticada normaliza un destino legado `/portfolio/inicio` a
`/portfolio/setup`, preservando `portfolioEntryContinuationId`. Setup recupera y muestra el
contexto disponible con procedencia visible y no inventa información faltante.

## First-time experience

Debe mostrar saludo personalizado, promesa intent-first, `Preparar mi espacio`, checklist de cinco
pasos y `Preguntar a Startería`. Durante setup no se muestran Frentes estratégicos, Retos,
Iniciativas, Actores clave, Reportes y decisiones, ni widgets o CTAs legacy vacíos.

## Copilot

Se reutiliza `PortfolioCopilotDrawer` con modo `setupMode`. Su orientación inicial es:

> Cuéntame qué quieres conseguir y te ayudo a ordenarlo.

No introduce IA productiva ni presenta Frentes, Retos o Steps antes de que aporten contexto.

## Acceptance criteria

- AC-A2-01: Portfolio Lead vacío → `/portfolio/setup`.
- AC-A2-02: Portfolio Lead activo → `/portfolio/inicio`.
- AC-A2-03: `/portfolio/inicio` manual vacío → setup.
- AC-A2-04: otros roles no afectados.
- AC-A2-05/06/07/08: saludo, CTA, checklist y Copilot visibles.
- AC-A2-09/10: navegación legacy y dashboard vacío ausentes durante setup.
- AC-A2-11/12: Entry context preservado y entrada directa funcional.
- AC-A2-13/14: P4 y contratos Core/Steps/Handoff fuera de alcance.

