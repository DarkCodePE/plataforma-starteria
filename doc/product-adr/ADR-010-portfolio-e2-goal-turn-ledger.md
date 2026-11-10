# ADR-010 — Ledger provisional y separado de turnos de Objetivo E2

- **Estado:** ACCEPTED
- **Fecha:** 2026-11-09
- **Aprobado por:** Fabio Augusto Merino Becerra — Product Decision Owner para KAN-253 / Product ADR-010
- **Aprobado en:** 2026-11-10
- **Ratificación registrada:** Jira `KAN-253`, comentario `10835`, 2026-11-10T12:03:19.457-05:00
- **Evidencia revisada:** PR #307; `main@07ffb81abf687739bb198c14fae08498f3e8a409`; CI postmerge #42849908644; integración KAN-253 B2 con PostgreSQL desechable
- **Core vigente:** v0.2, sin promoción del candidato v0.3
- **Ámbito:** Portfolio Bootstrap E2, *no* Portfolio Entry ni Step 0–4

## Problema
El flujo actual de E2 guarda algunas respuestas en `PortfolioAnchor.sourceRefs.objectiveConversation.turns`, con máximo histórico de UI y sin una frontera independiente de idempotencia, orden de turnos, CAS y procedencia. Usarlo como ledger semántico autoritativo expondría a pérdida de historial ante modificaciones del Anchor y confundiría un borrador con una decisión confirmada.

## Decisión aceptada
Agregar una **única tabla de turnos provisionales E2**, `PortfolioBootstrapGoalTurn`, asociada a `PortfolioBootstrapSession`, aditiva y sin migrar ni reemplazar la estructura histórica. Cada turno:
- requiere sesión del actor, permiso `portfolio:write`, vínculo tenant/owner;
- referencia el Anchor exacto, su versión y, si se utilizó, la versión del ContextReview E1 confirmado;
- almacena `questionId`, `field` resuelto en servidor, respuesta literal, disposición declarada y referencia `user_input`;
- conserva `turnVersion` monotónica, único por sesión, y `idempotencyKeyHash` único por sesión; duplicados idénticos reejecutan la misma respuesta, payload distinto bajo la misma clave falla;
- no convierte citas en hechos de negocio confirmados, no sustituye `PortfolioAnchor`, no propone meta/medición ni desbloquea E3;
- nunca llama a un proveedor IA. `SEMANTIC_E1_ENABLED` no se toca.

La primera versión del endpoint adjunta el turno a la pregunta `GoalQuestionPlan` determinista server-owned del B1; no cambia la UX E2 del usuario. Posteriores versiones podrán almacenar hipótesis y respuestas estructuradas evaluadas bajo contrato adicional, sin mutar registros previos.

## Modelo y autoridad
`PortfolioBootstrapGoalTurn` guarda `bootstrapSessionId`, `turnVersion`, `actorUserId`, `organizationId`, `anchorVersion`, `contextReviewId/version`, `questionId`, `field`, `inputText`, `disposition`, `evidenceJson`, `idempotencyKeyHash`, `payloadHash`, `createdAt`. No se agregan FKs a User ni Organization para no expandir la cardinalidad de esas entidades; la autoridad se comprueba en cada operación y el actor se audita. FK `bootstrapSessionId` con delete cascade igual que el ledger E1.

La versión se obtiene por máximo `turnVersion` en sesión, con índices únicos para detectar una escritura concurrente. El POST valida `expectedVersion` y `expectedAnchorVersion` y fuente E1, ejecuta transacción SERIALIZABLE con reintento acotado P2034 y replay por clave. Una escritura tras confirmación de Anchor falla cerrada.

## Reglas de convergencia
No hay autorización para que una respuesta del ledger produzca un cambio en Anchor o para que una hipótesis sea adoptada. Una futura UI de B3 deberá presentar la propuesta y exigir `updateAnchor` explícito y `confirmAnchor` humano, con versión y fuente. El ledger es **provisional, no canónico**.

## Alternativas descartadas
- Reutilizar `sourceRefs.objectiveConversation.turns` como único historial: mutable, limitado y sin CAS propio.
- Reusar `PortfolioBootstrapSemanticState` E1: mezclaría autoridades y gates E1/E2.
- Crear directamente una iniciativa/Step para cada conversación: viola Portfolio-first y requiere autorización de negocio.

## Alcance y límites de la ratificación

La decisión `RATIFY` registrada en [KAN-253, comentario 10835](https://stateria.atlassian.net/browse/KAN-253?focusedCommentId=10835) acepta exclusivamente el ledger provisional E2 y la migración aditiva `20261109100000_kan253_e2_goal_turn_ledger`. No cambia las invariantes Core INV-03, INV-04, INV-05 ni INV-10. Preserva `sourceRefs.objectiveConversation.turns` sin backfill ni reconciliación destructiva.

`PORTFOLIO_GOAL_E2_LEDGER_ENABLED` y todos los feature flags experimentales relacionados permanecen **OFF**. Esta ratificación no autoriza CD, migraciones productivas, IA live, habilitar E3, crear automáticamente Initiative/Project, activar Steps, cambiar Step 0–4, configurar SMTP ni enviar correos reales.

## Condiciones antes de producción
1. La ratificación de producto queda acreditada por KAN-253#10835; la aprobación de una PR o un CI verde no la sustituye ni amplía.
2. Typecheck backend, Prisma validation/migration diff, tests unit y PostgreSQL desechable con concurrencia, idempotencia y reentrada, seguridad owner/tenant, E2E regresión KAN-240.
3. Revisión independiente; CI completo; no activar CD ni migraciones productivas hasta aprobación específica.
4. Tras B2, definir contract B3 de proyección explícita a Anchor y mecanismos para confrontar datos E2 legado con nuevos turnos, sin migraciones destructivas.

## Fuentes de autoridad
`docs/STARTERIA_AUTHORITY.md`, `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, `docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md`, `STARTERIA_V2_MANIFEST.md`, KAN-253 y su comentario 10835.
