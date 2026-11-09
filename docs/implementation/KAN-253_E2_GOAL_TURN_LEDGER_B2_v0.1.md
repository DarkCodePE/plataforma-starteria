# KAN-253 B2 — Ledger durable de respuestas E2 (propuesta de implementación)

**Base:** `main@f9c093255be7d901ccc1bce6689e08532df05b53`, CI `42543901999` SUCCESS.  
**Autoridad:** Core factual v0.2 + Authority Map, KAN-253 + ADR-010 **propuesto, no ratificado**.  
**Estado:** Código en PR, feature flag OFF, sin aceptación DB real ni CD.

## Objetivo

Conservar las respuestas de la conversación E2 en un historial provisional de solo lectura/escritura explícita, separado del Anchor. Esta infraestructura es el requisito previo para experimentar con preguntas adaptativas, sin convertir hechos inferidos en decisiones de negocio.

## Implementación

1. `PortfolioBootstrapGoalTurn` (Prisma aditivo) + migración `20261109100000_kan253_e2_goal_turn_ledger`: índice único por `(bootstrapSessionId,turnVersion)` para orden/CAS, y por `(bootstrapSessionId,idempotencyKeyHash)` para replay.
2. `PORTFOLIO_GOAL_E2_LEDGER_ENABLED` **false por defecto**. GET/POST en `/api/v1/portfolio-bootstrap/sessions/:sessionId/objective/turns` responden 503 mientras está OFF. El frontend E2 de producción no llama a estos endpoints.
3. `appendTurn` valida siempre identidad, ownership, permiso Portfolio, versión del Anchor, versión del ContextReview E1 confirmado y pregunta B1 exacta, antes de escribir. La respuesta tiene origen `user_input` literal y estado `provisional`, nunca `confirmed`. 
4. Clave de idempotencia estable por intención: mismo payload = mismo ID de turno; payload distinto = 409. Una pregunta ya respondida exige `supersedesTurnId`, por lo que ninguna corrección borra el pasado. `unknown`, `not_applicable` y `retracted` exigen marcadores explícitos.
5. Transacciones `SERIALIZABLE` con retries P2034 acotados y conflicto P2002 convertido en replay o 409. GET rehidrata todos los turnos en orden y no crea sesiones.
6. `POST` no llama a IA ni escribe en `PortfolioAnchor`; por tanto los turnos no afectan `nextObjectiveQuestion`, `confirmAnchor`, `E3`, `Project`, `Step`, portafolios ni KPI.

## Pruebas y evidencia

| Validación | Archivo | Gate |
| --- | --- | --- |
| Input sin hechos ni confirmado por cliente | `portfolio-bootstrap-goal-turn.schemas.test.ts` | Vitest |
| CAS, replay, corrección, permisos, no Canon | `portfolio-bootstrap-goal-turn.service.test.ts` | Vitest |
| HTTP autenticado y flag OFF | `portfolio-bootstrap.router.test.ts` | Vitest |
| PostgreSQL real: reentrada, dos POST same-key, CAS, cross-owner | `portfolio-bootstrap-goal-turn.integration.test.ts` | Ejecutar en DB desechable con `PORTFOLIO_GOAL_DB_INTEGRATION=1` |
| Prisma schema + SQL expand-only | `front/prisma/schema.prisma` y migración | Prisma validate y migrate deploy en DB desechable |
| Main regresión E1/E2/Portfolio | KAN-240/246 y typecheck backend/frontend | CI y checkout Codex |

**No declarar PASS** de DB o typecheck sin ejecución y registro exactos. Los nuevos tests de integración están condicionados a `PORTFOLIO_GOAL_DB_INTEGRATION=1` para evitar tocar una base desconocida.

## Condiciones de adopción

1. Ratificar ADR-010 y confirmar que se autoriza la migración aditiva en la ventana CD, después de probar en PostgreSQL descartable.
2. Revisión independiente de límites de fuente E1, de autenticar todas las lecturas/replays y del diseño CAS/idempotency.
3. Comprobar `npx prisma validate`, `npm run typecheck:backend`, `npm run test:backend -- portfolio-bootstrap-goal-turn` y E2E dirigidos. No instalar proveedores AI nuevos.
4. Mantener la bandera OFF en producción hasta QA específico. La activación de la bandera para pruebas en un entorno controlado requerirá decisión aparte.
5. B3 conectará UX a este ledger, reconciliará con `sourceRefs.objectiveConversation.turns` histórico y pedirá aceptación explícita antes de escribir Anchor. No inferir que los turnos del ledger ya son canónicos.

## Estado real de los gaps
- Este PR instala persistencia y reglas de integridad; NO convierte aún E2 en conversación guiada por un modelo.
- No incluye `StructuredModelAdapter` E2, control de costes, evaluación automática ni preguntas generadas.
- No existe una migración reversible automática de antiguos `sourceRefs`; el legado sigue siendo una fuente separada, sin backfill destructivo.
- El modelo E2 B1 sigue siendo `deterministic_preview` hasta una fase adicional.

## V2_CHANGE_GUARDRAIL_CHECK

```text
slice_id: PORTFOLIO_E2_GOAL_TURN_LEDGER_B2
task: KAN-253 B2
semantic_owner: V2_PORTFOLIO_BOOTSTRAP_E2
authority: Core v0.2 + Authority Map + proposed ADR-010 (requires ratification)
scope: additive DB model, API, explicit typed client, CAS replay, tests and docs
legacy: sourceRefs.objectiveConversation.turns preserved, not trusted as immutable ledger
tests: goal-turn.schemas, goal-turn.service, router, disposable DB integration
blocked_for_merge: ADR-010 approval + disposable DB tests + independent review + backend typecheck
do_not_change: confirmAnchor, ContextReview human gate, E3/Step, E1 semantic mode, production flags
rollout: PORTFOLIO_GOAL_E2_LEDGER_ENABLED=false
```
