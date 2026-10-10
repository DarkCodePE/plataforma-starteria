/**
 * Lectura de cobertura del Reto como conjunto.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §13: el Reto confirmado es la unidad de
 * cobertura. Responde, con lo que ya existe, a las preguntas de §13: ¿hay trabajo?, ¿qué está
 * cubierto y qué no?, ¿hay solapamientos?, ¿dependencia común?, ¿qué evidencia tenemos como
 * conjunto?, ¿hace falta más capacidad?, ¿estamos listos para decidir?
 *
 * Sólo lectura: no persiste coverageStatus (eso lo escriben Step 4 y la decisión). Lo que
 * devuelve es la cobertura efectiva de deriveChallengeCoverage, el mismo criterio que usa el
 * front (deriveChallengeCoverageStatus) en la tarjeta y el detalle del reto.
 */
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

const ACTIVE = new Set(['en_step_0', 'en_step_1', 'en_step_2', 'en_step_3', 'en_step_4', 'esperando_revision', 'lista_para_decision']);
const CLOSED = new Set(['closed', 'cerrada', 'implementation_approved', 'scaling_approved']);
const normalize = (value: string) => value.toLowerCase().trim();

// Decisiones explícitas sobre el Reto: las iniciativas no las pisan.
const EXPLICIT_COVERAGE = new Set(['reformular', 'resuelto', 'cerrar']);
const COVERAGE_RANK: Record<string, number> = { sin_cobertura: 0, cobertura_parcial: 1, cobertura_suficiente: 2 };

interface CoverageInitiativeLike {
  status: string;
  currentStep?: string | null;
  readyForDecision?: boolean | null;
  resolvedCorePart?: boolean | null;
}

/**
 * Cobertura efectiva del Reto. El valor persistido arranca en `sin_cobertura` y sólo lo mueven
 * Step 4 y la decisión, así que un reto con iniciativas en curso quedaba "Sin cobertura"
 * mientras la tarjeta decía "Cobertura parcial" (2026-10-10). Criterio único:
 * - `reformular`, `resuelto` y `cerrar` son decisiones explícitas y se respetan.
 * - Sin iniciativas no hay cobertura, diga lo que diga el valor persistido.
 * - Con iniciativas: parcial; suficiente si alguna llegó a decisión y resolvió la parte central.
 * - Nunca queda por debajo de lo que ya se persistió (Step 4 / decisión pueden declarar más).
 * Espejo de deriveChallengeCoverageStatus (front/src/features/portfolio-lead/domain/actions.ts).
 */
export function deriveChallengeCoverage(persisted: string | null | undefined, initiatives: CoverageInitiativeLike[]): string {
  const current = String(persisted ?? 'sin_cobertura');
  if (EXPLICIT_COVERAGE.has(current)) return current;
  if (initiatives.length === 0) return 'sin_cobertura';
  const sufficient = initiatives.some(
    (initiative) =>
      Boolean(initiative.resolvedCorePart)
      && (Boolean(initiative.readyForDecision)
        || initiative.status === 'lista_para_decision'
        || initiative.status === 'en_step_4'
        || initiative.currentStep === 'Step 4'),
  );
  const derived = sufficient ? 'cobertura_suficiente' : 'cobertura_parcial';
  return (COVERAGE_RANK[current] ?? 0) > COVERAGE_RANK[derived] ? current : derived;
}

export interface ChallengeCoverageReading {
  challengeId: string;
  coverageStatus: string;
  hasWork: boolean;
  initiatives: Array<{
    projectId: string;
    name: string;
    status: string;
    currentStep: string | null;
    readyForDecision: boolean;
    estimatedContribution: string;
    blocker: string | null;
  }>;
  overlaps: Array<{ initiativeAId: string; initiativeBId: string; level: string; recommendation: string }>;
  aggregateEvidence: { contributionByLevel: Record<'bajo' | 'medio' | 'alto', number>; partialSignals: number; withRecommendation: number };
  commonDependencies: string[];
  needsMoreCapacity: { value: boolean; reasons: string[] };
  readyToDecide: { value: boolean; reasons: string[] };
  uncovered: string | null;
  /** §23: decisiones ya tomadas sobre iniciativas del reto y lo que dejaron. */
  decisions: Array<{ projectId: string; outcome: string; learning: string | null; nextAction: string | null; suggestedReformulation: string | null; decidedAt: string }>;
}

export class ChallengeCoverageReadService {
  constructor(private prisma: PrismaClient) {}

  async get(challengeId: string): Promise<ChallengeCoverageReading> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        initiativeMetas: { include: { project: { select: { id: true, name: true } } } },
        overlaps: true,
        portfolioLearnings: { orderBy: { decidedAt: 'desc' } },
      },
    });
    if (!challenge) throw AppError.notFound('Reto', 'CHALLENGE_NOT_FOUND', { hint: 'Confirma el ID del reto.' });

    const metas = challenge.initiativeMetas;
    const initiatives = metas.map((meta) => ({
      projectId: meta.projectId,
      name: meta.project?.name ?? meta.projectId,
      status: String(meta.status),
      currentStep: meta.currentStep,
      readyForDecision: meta.readyForDecision || meta.status === 'lista_para_decision',
      estimatedContribution: String(meta.estimatedContribution),
      blocker: meta.mainBlocker?.trim() || null,
    }));

    const contributionByLevel = { bajo: 0, medio: 0, alto: 0 };
    metas.forEach((meta) => {
      contributionByLevel[meta.estimatedContribution as 'bajo' | 'medio' | 'alto'] += 1;
    });

    // Dependencia común: un bloqueo que se repite en más de una iniciativa, o la del propio Reto.
    const blockerCounts = new Map<string, { text: string; count: number }>();
    initiatives.forEach((initiative) => {
      if (!initiative.blocker) return;
      const key = normalize(initiative.blocker);
      const current = blockerCounts.get(key) ?? { text: initiative.blocker, count: 0 };
      blockerCounts.set(key, { ...current, count: current.count + 1 });
    });
    const commonDependencies = [
      ...(challenge.dependencies?.trim() ? [challenge.dependencies.trim()] : []),
      ...[...blockerCounts.values()].filter((entry) => entry.count > 1).map((entry) => entry.text),
    ];

    const active = initiatives.filter((initiative) => ACTIVE.has(initiative.status));
    const blocked = initiatives.filter((initiative) => initiative.status === 'bloqueada');
    const activation = (challenge.activationInputs ?? {}) as Record<string, unknown>;

    const capacityReasons: string[] = [];
    if (initiatives.length === 0) capacityReasons.push('Ninguna iniciativa está abordando este reto.');
    if (initiatives.length > 0 && active.length === 0 && !initiatives.some((initiative) => CLOSED.has(initiative.status))) {
      capacityReasons.push('Ninguna iniciativa está activa.');
    }
    if (blocked.length > 0 && blocked.length >= active.length) capacityReasons.push(`${blocked.length} iniciativa(s) bloqueada(s).`);
    if (activation.internalCapacity === 'baja') capacityReasons.push('La capacidad interna declarada para el reto es baja.');
    if (metas.some((meta) => meta.requiresExternalCapability)) capacityReasons.push('Hay iniciativas que requieren capacidad externa.');

    const ready = initiatives.filter((initiative) => initiative.readyForDecision);
    const coverageStatus = deriveChallengeCoverage(String(challenge.coverageStatus), metas.map((meta) => ({ ...meta, status: String(meta.status) })));
    const coverageEnough = ['cobertura_suficiente', 'resuelto'].includes(coverageStatus);
    const readyReasons: string[] = [];
    if (ready.length > 0) readyReasons.push(`${ready.length} iniciativa(s) lista(s) para decisión.`);
    if (coverageEnough) readyReasons.push('La cobertura del reto ya es suficiente.');
    if (readyReasons.length === 0) readyReasons.push(initiatives.length === 0 ? 'Todavía no hay trabajo que evaluar.' : 'Ninguna iniciativa llegó a decisión todavía.');

    return {
      challengeId: challenge.id,
      coverageStatus,
      hasWork: initiatives.length > 0,
      initiatives,
      overlaps: challenge.overlaps.map((overlap) => ({
        initiativeAId: overlap.initiativeAId,
        initiativeBId: overlap.initiativeBId,
        level: String(overlap.level),
        recommendation: String(overlap.recommendation),
      })),
      aggregateEvidence: {
        contributionByLevel,
        partialSignals: metas.filter((meta) => meta.partialSignal).length,
        withRecommendation: metas.filter((meta) => Boolean(meta.executiveSummary?.trim())).length,
      },
      commonDependencies,
      needsMoreCapacity: { value: capacityReasons.length > 0, reasons: capacityReasons },
      readyToDecide: { value: ready.length > 0 || coverageEnough, reasons: readyReasons },
      // Lo que el reto pide mover y ninguna iniciativa atiende todavía.
      uncovered: initiatives.length === 0 ? challenge.whatWeWantToMove?.trim() || challenge.title : null,
      decisions: (challenge.portfolioLearnings ?? []).map((learning) => ({
        projectId: learning.projectId,
        outcome: String(learning.outcome),
        learning: learning.learning,
        nextAction: learning.nextAction,
        suggestedReformulation: learning.suggestedReformulation,
        decidedAt: learning.decidedAt.toISOString(),
      })),
    };
  }
}
