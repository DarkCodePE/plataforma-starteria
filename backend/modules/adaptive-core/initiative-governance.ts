/**
 * Quién gobierna una iniciativa ligada a un Reto.
 *
 * Hasta acá ningún flujo creaba InitiativeGovernance: una iniciativa de Reto llegaba a Step 4,
 * se presentaba al portfolio y la decisión organizacional fallaba con DECISION_AUTHORITY_REQUIRED
 * (lo detectó la suite E2E Job-Driven, §23). Core: el Portfolio Lead "conduce decisiones" del
 * portafolio; la IA no tiene autoridad de decisión.
 *
 * Regla: una iniciativa creada desde un Reto queda `portfolio_governed`, con el owner del Reto o,
 * si no hay, el del Frente como Portfolio Lead. Sin ninguno, queda sin lead asignado (el resolver
 * de autoridad lo marca como `unassigned`) hasta que un lead lo asigne por API. Una iniciativa
 * independiente no recibe governance: sigue owner_governed por compatibilidad.
 */
export function governanceForChallengeInitiative(challenge: { ownerId?: string | null; strategicFront?: { ownerId?: string | null } | null }) {
  return {
    mode: 'portfolio_governed' as const,
    portfolioLeadUserId: challenge.ownerId ?? challenge.strategicFront?.ownerId ?? null,
  };
}

/**
 * Crea la governance de una iniciativa al ligarla a un Reto, por cualquiera de los caminos
 * (challengeLink, challengeId legado o meta del portfolio). Idempotente: si ya existe —por ejemplo
 * porque un lead la asignó explícitamente— no la toca.
 */
export async function ensureChallengeGovernanceTx(tx: any, projectId: string, challengeId: string) {
  if (!tx.initiativeGovernance?.upsert || !tx.challenge?.findUnique) return null;
  const challenge = await tx.challenge.findUnique({
    where: { id: challengeId },
    select: { ownerId: true, strategicFront: { select: { ownerId: true } } },
  });
  if (!challenge) return null;
  return tx.initiativeGovernance.upsert({
    where: { projectId },
    update: {},
    create: { projectId, ...governanceForChallengeInitiative(challenge) },
  });
}
