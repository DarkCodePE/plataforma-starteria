# ADR-010 — Ledger provisional y separado de turnos de Objetivo E2

- **Estado:** PROPUESTO / PENDIENTE DE RATIFICACIÓN (KAN-253 B2)
- **Fecha:** 2026-11-09
- **Core vigente:** v0.2, sin promoción del candidato v0.3
- **Ámbito:** Portfolio Bootstrap E2, *no* Portfolio Entry ni Step 0–4

## Problema
El flujo actual de E2 guarda algunas respuestas en `PortfolioAnchor.sourceRefs.objectiveConversation.turns`, con máximo histórico de UI y sin una frontera independiente de idempotencia, orden de turnos, CAS y procedencia. Usarlo como ledger semántico autoritativo expondría a pérdida de historial ante modificaciones del Anchor y confundiría un borrador con una decisión confirmada.

## Decisión propuesta
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

## Condiciones antes de merge y producción
1. Validación humana de este ADR candidato y revisión de migración SQL expand-only. **La presencia del ADR en el repo no lo aprueba**.
2. Typecheck backend, Prisma validation/migration diff, tests unit y PostgreSQL desechable con concurrencia, idempotencia y reentrada, seguridad owner/tenant, E2E regresión KAN-240.
3. Revisión independiente; CI completo; no activar CD ni migraciones productivas hasta aprobación específica.
4. Tras B2, definir contract B3 de proyección explícita a Anchor y mecanismos para confrontar datos E2 legado con nuevos turnos, sin migraciones destructivas.

## Fuentes de autoridad
`docs/STARTERIA_AUTHORITY.md`, `doc/CONTRATO_LOGICA_CORE_STARTERIA_MVP_v0.2_ES(1).md`, `docs/governance/STARTERIA_V2_MIGRATION_GUARDRAILS.md`, `STARTERIA_V2_MANIFEST.md`, KAN-253.
