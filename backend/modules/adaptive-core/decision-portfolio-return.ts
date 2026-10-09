/**
 * Retorno al Portfolio después de una decisión organizacional.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §23: Initiative → Challenge coverage →
 * Strategic Front → Portfolio, actualizando estado, cobertura, decisiones, aprendizajes y
 * siguiente acción.
 *
 * Core §30 ("no propagación ciega"): sólo se recalculan proyecciones. La cobertura del Reto
 * se deriva de la decisión; el texto del Reto y del Frente no se toca. Si la decisión pide
 * reformular el Reto, queda como `suggestedReformulation` en el aprendizaje, no se aplica.
 */
import type { DecisionOutcome } from '@prisma/client';

// Cuánto cubre la iniciativa decidida según la decisión corporativa. Step 4 ya escribió la
// cobertura que declaró el owner al presentar; la decisión es la que tiene autoridad (§23).
const COVERAGE_BY_OUTCOME: Record<DecisionOutcome, 'cobertura_parcial' | 'cobertura_suficiente' | 'reformular' | null> = {
  implement: 'cobertura_suficiente',
  scale: 'cobertura_suficiente',
  continue_experimenting: 'cobertura_parcial',
  pause: null,
  close_with_learning: 'reformular',
};

const COVERAGE_RANK: Record<string, number> = {
  sin_cobertura: 0,
  reformular: 1,
  cobertura_parcial: 2,
  cobertura_suficiente: 3,
  resuelto: 4,
  cerrar: 4,
};

const NEXT_ACTION: Record<DecisionOutcome, string> = {
  implement: 'Preparar el handoff a implementación con su owner receptor.',
  scale: 'Planificar el escalamiento y quién lo opera.',
  continue_experimenting: 'Abrir un nuevo ciclo con la incertidumbre que quedó abierta.',
  pause: 'Revisar la iniciativa cuando cambien las condiciones que motivaron la pausa.',
  close_with_learning: 'Revisar si el Reto necesita reformularse o activar otra iniciativa.',
};

export function nextCoverage(current: string, outcome: DecisionOutcome, activeSiblings: number): string {
  const proposed = COVERAGE_BY_OUTCOME[outcome];
  if (!proposed) return current;
  // Si otras iniciativas activas trabajan el Reto, esta decisión no baja lo que ellas sostienen.
  if (activeSiblings > 0) return (COVERAGE_RANK[proposed] ?? 0) > (COVERAGE_RANK[current] ?? 0) ? proposed : current;
  // Si es la única, la decisión manda sobre lo que el owner declaró en Step 4. `resuelto` y
  // `cerrar` son decisiones explícitas sobre el Reto y no se pisan.
  if (current === 'resuelto' || current === 'cerrar') return current;
  return proposed;
}

function learningFrom(packageSnapshot: unknown, rationale: string): string | null {
  const pkg = (packageSnapshot ?? {}) as Record<string, any>;
  const candidates = [
    pkg.narrative?.learnings?.text,
    pkg.narrative?.learnings,
    pkg.learnings,
    pkg.recommendation,
    rationale,
  ];
  const found = candidates.find((value) => typeof value === 'string' && value.trim());
  return found ? String(found).trim() : null;
}

export async function propagateDecisionToPortfolioTx(
  tx: any,
  decision: { id: string; projectId: string; outcome: DecisionOutcome; rationale: string; decidedAt: Date; packageSnapshotJson: unknown },
) {
  // Mismo criterio que el resto de adaptive-core con delegados opcionales (`tx.challenge?.update`):
  // un cliente sin estos modelos (tests de unidad con mocks parciales) no propaga.
  if (!tx.initiativePortfolioMeta?.findFirst || !tx.portfolioLearning?.upsert) return null;
  const meta = await tx.initiativePortfolioMeta.findFirst({
    where: { projectId: decision.projectId },
    include: { challenge: { select: { id: true, coverageStatus: true, strategicFrontId: true } } },
  });
  const challenge = meta?.challenge ?? null;

  let coverageBefore: string | null = null;
  let coverageAfter: string | null = null;
  if (challenge) {
    const activeSiblings = await tx.initiativePortfolioMeta.count({
      where: {
        challengeId: challenge.id,
        projectId: { not: decision.projectId },
        status: { notIn: ['closed', 'cerrada', 'paused'] },
      },
    });
    coverageBefore = String(challenge.coverageStatus);
    coverageAfter = nextCoverage(coverageBefore, decision.outcome, activeSiblings);
    if (coverageAfter !== coverageBefore) {
      await tx.challenge.update({ where: { id: challenge.id }, data: { coverageStatus: coverageAfter } });
    }
  }
  if (meta) {
    // Decidida, la iniciativa sale de "lista para decisión" y queda cerrada en el portafolio:
    // lo que sigue (handoff, nuevo ciclo, pausa) lo lleva la siguiente acción y el aprendizaje.
    await tx.initiativePortfolioMeta.updateMany({
      where: { projectId: decision.projectId },
      data: {
        status: 'closed',
        readyForDecision: false,
        nextActionRecommended: NEXT_ACTION[decision.outcome],
        decisionNotes: decision.rationale,
        lastActivity: new Date().toISOString(),
      },
    });
  }

  return tx.portfolioLearning.upsert({
    where: { decisionId: decision.id },
    update: {},
    create: {
      decisionId: decision.id,
      projectId: decision.projectId,
      challengeId: challenge?.id ?? null,
      strategicFrontId: challenge?.strategicFrontId ?? null,
      outcome: decision.outcome,
      rationale: decision.rationale,
      learning: learningFrom(decision.packageSnapshotJson, decision.rationale),
      nextAction: NEXT_ACTION[decision.outcome],
      coverageBefore,
      coverageAfter,
      suggestedReformulation:
        coverageAfter === 'reformular'
          ? 'La iniciativa se cerró sin cubrir el Reto y no hay otra activa: revisar si el Reto debe reformularse.'
          : null,
      decidedAt: decision.decidedAt,
    },
  });
}
