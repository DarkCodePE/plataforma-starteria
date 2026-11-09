# KAN-252 — E2 Objetivo: conversación trazable y ficha provisional

**Estado:** Implementado en PR #276, apilado sobre PR #274. **Sin merge ni CD.**  
**Referencia:** `STARTERIA_PORTFOLIO_LEAD_COPILOT_FIRST_v1.0.html` aportado por el usuario (HTML de demostración, sin IA real).  
**Autoridad:** Core factual v0.2, Portfolio Bootstrap Anchor y Jira KAN-252.

## Diferencias verificadas

| UX deseada | Situación anterior | KAN-252 |
| --- | --- | --- |
| Inicio en Overview | PR #274 pendiente de main | Reutiliza base PR #274 |
| Turnos visibles de Objetivo | `sourceRefs.objectiveConversation.turns` persistidos sin render en chat | Reconstruye solo entries válidas de turns ya guardados, con campo, disposición y fecha |
| Recap y pregunta | `nextObjectiveQuestion` por campo pendiente (no IA) | Pregunta enfocada visible con semántica del planner existente |
| Ayuda ¿Por qué? | Falta explicación de propósito | Muestra explicación veraz estática por campo, no inference |
| Ver contexto | Anchor mostrado como si fuese mensaje de usuario nuevo | Lo muestra como referencia del Anchor, con estado/procedencia no confirmada |
| Ficha | Tarjeta always-on de datos | Diseño «Ficha estratégica provisional» + claridad ganada; no meta numérica inventada |
| Confirmar | Comando `confirmAnchor`, gates separados | Se preservan totalmente |

## Alcance técnico
- `front/src/features/portfolio-lead/bootstrap/components/PortfolioBootstrapHome.tsx`: ayuda de interpretación `objectiveQuestionReason`, lector acotado `objectiveTurnHistory`, estilos navy/violeta/lavanda, contexto referenciado sin atribución falsa.
- `front/src/features/portfolio-lead/bootstrap/components/__tests__/PortfolioBootstrapHome.test.tsx`: pruebas KAN-252 tests-first de historial, ayuda sin escrituras, unknown y gates.
- Sin cambios en servicio/Prisma/IA/estado Core. `SEMANTIC_E1_ENABLED=false` sigue default y E2 no dispone aún de orquestador semántico generativo.

## Gaps de producto NO cubiertos
- Planner E2 es determinista, no decide autónomamente el número/orden de preguntas por inferencia model-driven.
- El sourceRef de cada turno E2 tiene campo y timestamp, no un esquema fuerte de evidencia y validación equivalente al ledger semántico E1.
- Metadata de baseline/meta/horizonte no está en un contrato E2 específico comparable al mock HTML; mostrar esos valores en UI sin fuente sería invención.
- Continuidad E2→E7 por UI completa y Startería Fab siguen fuera del alcance.

## Gate de aceptación
Tests frontend, typecheck, CI, Playwright PostgreSQL dirigido, refresh/reentrada, revisión independiente, merge secuenciado de PR #274 y #276. Sin CD automático ni inferencia live de pago.
