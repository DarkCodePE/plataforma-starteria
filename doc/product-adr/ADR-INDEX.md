# Product ADR Index

Serie separada de decisiones de producto de Starteria.

Este indice no reemplaza `docs/adr/`, que queda reservado para ADRs del harness. No mezclar la serie de producto con `docs/adr/ADR-001...007`.

## Estado de la serie

| ID | Titulo | Ruta | Estado | Notas |
|---|---|---|---|---|
| ADR-001 | Portfolio Entry continuation to Portfolio | `ADR-001-portfolio-entry-continuation-to-portfolio.md` | Propuesto / no aprobado | Candidato de producto; no implementa runtime. |
| ADR-002 | Portfolio Entry active question, answer resolution and clarification convergence | `ADR-002-portfolio-entry-active-question-clarification-convergence.md` | Aceptado | Formaliza interacción secuencial y convergencia; no implementa runtime. |

| ADR-003 | Public Entry registration continuation boundary | `ADR-003-public-entry-registration-continuation-boundary.md` | Aceptado | Registro no canoniza negocio; Portfolio-first; excepción Initiative explícita. |
| ADR-004 | Authenticated continuation access and Initiative handoff authority | `ADR-004-authenticated-continuation-access-and-initiative-handoff-authority.md` | Aceptado | Selecciona contexto provisional autenticado; define evidencia Initiative/Steps e issuer condicional. |
| ADR-005 | Portfolio Handoff Assignment persistence and legacy route boundary | `ADR-005-portfolio-handoff-assignment-persistence-and-legacy-route-boundary.md` | Accepted, 2026-09-28 | Define persistencia bounded del handoff y cuarentena de `/projects/new?challengeId=...`; no autoriza implementación. |
| ADR-006 | Separation between Starteria Landing and Portfolio Entry | `ADR-006-landing-and-portfolio-entry-separation.md` | ACCEPTED | Separa framing de Landing, Portfolio Entry opcional, early access y demo; supersede parcialmente ADR-019. No autoriza runtime. |

## Reglas

- Registrar aqui solo ADRs de producto.
- Conservar el estado factual real de cada ADR.
- No promover un ADR por estar presente en el repositorio.
- Si un ADR de producto vive temporalmente fuera de `doc/product-adr/`, indexarlo con su ruta real y estado real antes de moverlo.
