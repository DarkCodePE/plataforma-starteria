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
    challenge: { id: string; title: string; whyNow: string | null; successCriteria: string | null; knownFacts: string | null } | null;
    initiativeContext: string | null;
  };
  expectedContribution: string | null;
  constraints: string[];
  capacity: string[];
  dependencies: string[];
  whoCanHelp: string[];
  decisionToEnable: string | null;
  openQuestions: string[];
  /**
   * Contexto de Aplicación (E2E Job-Driven §16; Core: "Contexto del usuario / organización objetivo
   * [opcional]", envolvente contextual que no prueba alineamiento). Sale del último snapshot de
   * empresa de la iniciativa. null si la persona no eligió empresa.
   */
  applicationContext: {
    companyName: string;
    area: string | null;
    coverage: number;
    lowCoverage: boolean;
    restrictions: string[];
    actors: string[];
  } | null;
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

// Mismo criterio que AdaptiveCoreService.extractCompanyDimension: busca por palabra clave en el
// snapshot de empresa sin asumir una forma fija.
function companyDimension(json: any, keywords: string[]): string[] {
  const found: string[] = [];
  const visit = (value: unknown, key = '') => {
    if (found.length >= 5 || value == null) return;
    if (typeof value === 'string') {
      if (keywords.some((keyword) => key.toLowerCase().includes(keyword)) && value.trim()) found.push(value.trim());
      return;
    }
    if (Array.isArray(value)) return value.forEach((item) => visit(item, key));
    if (typeof value === 'object') Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => visit(child, `${key}.${childKey}`));
  };
  visit(json);
  return [...new Set(found)];
}

function applicationContextFrom(snapshot: any): MissionReviewView['applicationContext'] {
  if (!snapshot) return null;
  const json = (snapshot.snapshotJson ?? {}) as Record<string, any>;
  const coverage = Number(snapshot.contextScore ?? json.contextScore ?? 0);
  return {
    companyName: String(json.company?.name ?? 'Empresa seleccionada'),
    area: json.areas?.[0]?.name ?? null,
    coverage,
    lowCoverage: coverage < 50,
    restrictions: companyDimension(json, ['restriction', 'restriccion', 'guardrail']),
    actors: companyDimension(json, ['actor', 'stakeholder', 'sponsor']),
  };
}

export class MissionReviewReadService {
  constructor(private prisma: PrismaClient) {}

  async get(projectId: string, userId: string, role: string): Promise<MissionReviewView> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        teamMembers: { include: { user: { select: { name: true } } } },
        contextSnapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
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
    // Mismo criterio que AdaptiveCoreService.getAccessibleProject: equipo, o el Portfolio Lead
    // asignado en InitiativeGovernance (lectura, §23).
    if (role !== 'admin' && role !== 'mentor' && !project.teamMembers.some((member) => member.userId === userId)) {
      const governance = await (this.prisma as any).initiativeGovernance.findUnique({ where: { projectId } });
      if (governance?.portfolioLeadUserId !== userId) {
        throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED');
      }
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
          ? {
              id: challenge.id,
              title: challenge.title,
              whyNow: text(challenge.whyNow),
              successCriteria: text(challenge.successCriteria),
              knownFacts: text(challenge.knownFacts),
            }
          : null,
        initiativeContext: text(prefill.contextInitial),
      },
      expectedContribution: text(meta?.hypothesisCovered) ?? text(challenge?.successCriteria) ?? text(prefill.expectedImpact),
      // INV-08 (Core): las restricciones del Reto y del Frente las hereda la iniciativa.
      constraints: list(challenge?.constraints, front?.constraints, prefill.restrictions, prefill.mainRisk),
      capacity: Object.entries(CAPACITY_LABEL)
        .filter(([key]) => text(activation[key]))
        .map(([key, label]) => `${label}: ${String(activation[key]).replaceAll('_', ' ')}`),
      dependencies: list(challenge?.dependencies, prefill.dependencies, meta?.mainBlocker),
      whoCanHelp: [...new Set(list(...helpers))],
      decisionToEnable: text(challenge?.expectedDecision) ?? text(prefill.decisionRequested) ?? text(prefill.nextRecommendedStep),
      openQuestions: list(challenge?.openQuestions, prefill.pendingQuestions),
      applicationContext: applicationContextFrom(project.contextSnapshots?.[0]),
    };
  }
}
