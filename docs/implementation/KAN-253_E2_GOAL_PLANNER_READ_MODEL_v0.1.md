# KAN-253 — E2 Goal Question Planner: contrato de lectura provisional

**Fecha:** 2026-11-09  
**Base:** `main@ea2b8c82d98c48824570cd8b68024a66e9e54bc5` (PR #276 merged; CI #42540652194 SUCCESS).  
**Estado:** Implementado en rama, sin merge ni CD.

## Decisión de arquitectura

E1 y E2 son contextos distintos. No reaprovechar el prompt E1 `SEMANTIC_E1_SYSTEM_PROMPT` como motor E2 sin una autoridad nueva. KAN-253 B1 introduce solo un **contrato server-owned de plan de pregunta E2**, de solo lectura, con datos verificables del Anchor y del `PortfolioBootstrapContextReview.effectiveContext` confirmado y vigente. No genera una respuesta IA, no escribe nada y no sustituye `confirmAnchor`.

## V2_CHANGE_GUARDRAIL_CHECK

- Slice: `PORTFOLIO_E2_GOAL_QUESTION_PLAN_READ_MODEL_KAN253_B1`.
- Autoridad: Core factual v0.2, `docs/STARTERIA_AUTHORITY.md`, Manifest V2, KAN-252 y KAN-253.
- Owner: backend Portfolio Bootstrap (E2). Dependencias existentes: `getSession` y `getContext`, ambas tenant/owner-scoped. `getCurrent` y endpoints de escritura no se modifican.
- Gap: faltaba un contrato de selección de pregunta E2 independiente de `nextObjectiveQuestion()` en React.
- Cambios: función pura `buildGoalQuestionPlan`; endpoint GET `/sessions/:sessionId/objective/plan`; cliente tipado; unit tests y HTTP router tests.
- **Proceed: YES** limitado a read model provisional sin efectos de escritura. **Proceed: NO** para activar modelos live, introducir tabla/ledger E2, sustituir un gate, escribir Anchor, crear Project/Step o publicar a producción.
- Sin nuevo clone/worktree, migraciones, secretos ni compras de tokens.

## Contrato de salida

`GoalQuestionPlan` incluye `sessionId`, `anchorVersion`, `contextReviewVersion`, `mode:'deterministic_preview'`, `status`, `activeQuestion` y `unknownFields`. Pregunta singular con `id/field/question/recap/reasonToAsk/resolves/provenance`. La procedencia E1 contiene `reviewId`, `reviewVersion`, `fieldPath` y cita textual del snapshot confirmado; nunca se confunde una inferencia no confirmada con esa fuente.

Un E1 no confirmado o con corrección pendiente no alimenta la recapitulación. Las disposiciones `unknown` saltan campos sin convertirlos en hechos; estado de conflicto o Anchor confirmado bloquea nuevas preguntas. Si faltan datos se pregunta por un campo material, priorizando la decisión por delante de pedir otra vez contexto que E1 ya describió. El planner es determinista y tiene preguntas predefinidas; esto **no certifica aún comprensión semántica por modelo**.

## Pruebas de aceptación

| CA | Evidencia inicial | Estado |
| --- | --- | --- |
| CAF-01 cafetería sin piloto → resultado de negocio sin inventar cifra | goal-question-planner.test.ts | Escrita; ejecución pendiente |
| MVP-02 distribuidora con usos/logs → decisión pendiente, no repregunta piloto | goal-question-planner.test.ts | Escrita |
| CORP-03 E1 confirmado → pregunta decisión antes de repetir contexto | goal-question-planner.test.ts | Escrita |
| NOWORK-04 unknown no se convierte en KPI/objetivo, ni activa E3 | goal-question-planner.test.ts | Escrita |
| SEC-05 E1 draft/corrección pendiente no se proyecta; sesión con auth y read-scope | router.test.ts + goal-question-planner.test.ts | Escrita, integración real pendiente |
| CAS-06 endpoint GET sin write, refresh estable, versión anclada | router.test.ts | Escrita, DB E2E pendiente |
| REG-07 KAN-240/252: confirmación humana y navegación intactas | suites existentes | Pendiente |

## Próxima fase dentro de KAN-253

B2: definir mecanismo E2 de turnos y evidencia con CAS/idempotencia y versionado, con `StructuredModelAdapter` fake/determinístico, contrato de pregunta/hipótesis/convergencia y revisiones contra E1. No asumir que `sourceRefs.objectiveConversation.turns` es suficiente como ledger irreversible. Obtener validación de autoridad y, si requiere esquema de datos, ADR separado antes de mutar Prisma.

B3: UI opt-in con bandera OFF por defecto, que consuma el planner backend únicamente después de B2, con tests Playwright PostgreSQL de los cuatro perfiles. B4: evaluación/activación controlada de proveedor live solo bajo consentimiento y control de costes, no cubierta por este PR.

## Estado de publicación

No se ha ejecutado `typecheck:backend` ni Playwright dirigido en un checkout local desde este chat; GitHub CI y revisión independiente son gates obligatorios. La versión desplegada en producción no queda acreditada por un merge.
