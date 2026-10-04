/**
 * Mission Review — "¿Qué estoy asumiendo exactamente?" antes de empezar el ciclo.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §18: Start no abre directamente Step 0.
 *
 * Sólo lectura: reúne lo que la iniciativa hereda de su Reto y su Frente (Core §14.1,
 * Challenge Constraint Envelope) y del prefill de la revisión inicial. No persiste nada y
 * no inventa: lo que no existe vuelve como lista vacía o null, y la UI lo muestra como
 * "Sin definir" para que la persona sepa qué falta antes de empezar.
 */
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

export interface MissionReviewView {
  projectId: string;
  initiativeName: string;
  /** Iniciativa independiente (§16): no hereda Frente ni Reto. */
  independent: boolean;
  whatToMove: string | null;
  inheritedContext: {
    strategicFront: { id: string; name: string; desiredResult: string | null; kpi: string | null; target: string | null; horizon: string | null } | null;
    challenge: { id: string; title: string; whyNow: string | null; successCriteria: string | null } | null;
    initiativeContext: string | null;
  };
  expectedContribution: string | null;
  constraints: string[];
  capacity: string[];
  dependencies: string[];
  whoCanHelp: string[];
  decisionToEnable: string | null;
  openQuestions: string[];
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const list = (...values: unknown[]): string[] =>
  values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => (typeof value === 'string' ? value : (value as { question?: unknown })?.question))
    .map(text)
    .filter((value): value is string => value !== null);

const CAPACITY_LABEL: Record<string, string> = {
  timeAvailable: 'Tiempo disponible',
  estimatedEffort: 'Esfuerzo estimado',
  internalCapacity: 'Capacidad interna',
  technicalNeed: 'Necesidad técnica',
};

export class MissionReviewReadService {
  constructor(private prisma: PrismaClient) {}

  async get(projectId: string, userId: string, role: string): Promise<MissionReviewView> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        teamMembers: { include: { user: { select: { name: true } } } },
        portfolioMeta: {
          include: {
            challenge: {
              include: {
                strategicFront: true,
                challengeTeam: { include: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
    // Mismo criterio que AdaptiveCoreService.getAccessibleProject.
    if (role !== 'admin' && role !== 'mentor' && !project.teamMembers.some((member) => member.userId === userId)) {
      throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED');
    }

    const prefill = (project.step0Data ?? {}) as Record<string, unknown>;
    const meta = project.portfolioMeta[0];
    const challenge = meta?.challenge ?? null;
    const front = challenge?.strategicFront ?? null;
    const activation = (challenge?.activationInputs ?? {}) as Record<string, unknown>;

    const helpers = [
      ...project.teamMembers.filter((member) => member.userId !== project.ownerId).map((member) => member.user?.name),
      ...(challenge?.challengeTeam ?? []).map((member) => member.user?.name ?? member.label),
      challenge?.challengeOwner,
      meta?.mentor,
    ];

    return {
      projectId: project.id,
      initiativeName: project.name,
      independent: !challenge,
      whatToMove: text(challenge?.whatWeWantToMove) ?? text(front?.strategicObjective) ?? text(prefill.quePasaQueQuieres) ?? text(prefill.initialFocus),
      inheritedContext: {
        strategicFront: front
          ? {
              id: front.id,
              name: front.name,
              desiredResult: text(front.strategicObjective),
              kpi: text(front.mainKpi),
              target: text(front.target),
              horizon: text(front.horizon),
            }
          : null,
        challenge: challenge
          ? { id: challenge.id, title: challenge.title, whyNow: text(challenge.whyNow), successCriteria: text(challenge.successCriteria) }
          : null,
        initiativeContext: text(prefill.contextInitial),
      },
      expectedContribution: text(meta?.hypothesisCovered) ?? text(challenge?.successCriteria) ?? text(prefill.expectedImpact),
      constraints: list(prefill.restrictions, prefill.mainRisk),
      capacity: Object.entries(CAPACITY_LABEL)
        .filter(([key]) => text(activation[key]))
        .map(([key, label]) => `${label}: ${String(activation[key]).replaceAll('_', ' ')}`),
      dependencies: list(prefill.dependencies, meta?.mainBlocker),
      whoCanHelp: [...new Set(list(...helpers))],
      decisionToEnable: text(prefill.decisionRequested) ?? text(prefill.nextRecommendedStep),
      openQuestions: list(prefill.pendingQuestions),
    };
  }
}
