/**
 * Lectura de cobertura del Reto como conjunto.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §13: el Reto confirmado es la unidad de
 * cobertura. Responde, con lo que ya existe, a las preguntas de §13: ¿hay trabajo?, ¿qué está
 * cubierto y qué no?, ¿hay solapamientos?, ¿dependencia común?, ¿qué evidencia tenemos como
 * conjunto?, ¿hace falta más capacidad?, ¿estamos listos para decidir?
 *
 * Sólo lectura; no recalcula coverageStatus (eso lo escribe Step 4).
 */
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

const ACTIVE = new Set(['en_step_0', 'en_step_1', 'en_step_2', 'en_step_3', 'en_step_4', 'esperando_revision', 'lista_para_decision']);
const CLOSED = new Set(['closed', 'cerrada', 'implementation_approved', 'scaling_approved']);
const normalize = (value: string) => value.toLowerCase().trim();

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
    const coverageEnough = ['cobertura_suficiente', 'resuelto'].includes(String(challenge.coverageStatus));
    const readyReasons: string[] = [];
    if (ready.length > 0) readyReasons.push(`${ready.length} iniciativa(s) lista(s) para decisión.`);
    if (coverageEnough) readyReasons.push('La cobertura del reto ya es suficiente.');
    if (readyReasons.length === 0) readyReasons.push(initiatives.length === 0 ? 'Todavía no hay trabajo que evaluar.' : 'Ninguna iniciativa llegó a decisión todavía.');

    return {
      challengeId: challenge.id,
      coverageStatus: String(challenge.coverageStatus),
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
