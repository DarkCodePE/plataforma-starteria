import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import type { Role } from '../../shared/types/user.types';
import { assertProjectTeamAccess, type ProjectTeamNeed } from '../projects/project-team-access';

export type StepReasoningStepNumber = 0 | 1 | 2 | 3 | 4;

export interface BuildStepContextInput {
  projectId: string;
  actorId: string;
  actorRole: Role;
  expectedCycleId?: string;
  stepNumber: StepReasoningStepNumber;
}

export interface StepReasoningContext {
  schemaVersion: 'step-reasoning-context.v2';
  project: { id: string; organizationId: string; name: string; description: string | null; status: string };
  cycle: { id: string; cycleNumber: number; currentStep: number; status: string };
  step: {
    number: StepReasoningStepNumber;
    stableFunction: string;
    configVersion: number;
    routeType: string | null;
    depthLevel: string | null;
  };
  checkpoint: { key: string | null; title: string | null; status: string | null; questions: unknown[] };
  mandate: string | null;
  masterContext: Record<string, unknown>;
  confirmedResponses: Record<string, unknown>;
  previousConfirmedOutputs: Array<{ stepNumber: number; outputKey: string; version: number; output: unknown }>;
  evidenceInventory: Array<Record<string, unknown>>;
  sourceInventory: Array<Record<string, unknown>>;
  truthInventory: Array<Record<string, unknown>>;
  allowedOperations: readonly ['reason', 'suggest'];
  sourceContextHash: string;
}

const MAX_STRING = 8_000;
const MAX_ARRAY = 50;
const STEP_FUNCTIONS: Record<StepReasoningStepNumber, string> = {
  0: 'Aclarar el marco, el alcance y la decisión que debe habilitar el ciclo.',
  1: 'Comprender la realidad, contrastar supuestos y definir el foco.',
  2: 'Diseñar un entregable ejecutable y cómo medirlo.',
  3: 'Ejecutar, observar y aprender con evidencia trazable.',
  4: 'Sintetizar resultados y preparar una decisión humana.',
};

function bounded(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limited]';
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => bounded(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 80)
        .map(([key, item]) => [key, bounded(item, depth + 1)]),
    );
  }
  return value;
}

function hashContext(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(bounded(value))).digest('hex')}`;
}

function checkpointTitle(instance: any): string | null {
  const questions = Array.isArray(instance?.materializedQuestionsJson) ? instance.materializedQuestionsJson : [];
  const first = questions[0];
  return typeof first?.checkpointTitle === 'string'
    ? first.checkpointTitle
    : typeof first?.title === 'string'
      ? first.title
      : instance?.checkpointKey ?? null;
}

export class StepContextBuilder {
  constructor(private readonly prisma: PrismaClient) {}

  async build(input: BuildStepContextInput, need: ProjectTeamNeed): Promise<StepReasoningContext> {
    const db = this.prisma as any;
    const project = await db.project.findUnique({
      where: { id: input.projectId },
      include: {
        teamMembers: { select: { userId: true, role: true, status: true } },
        portfolioMeta: { include: { challenge: { include: { strategicFront: true } } } },
        contextSnapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');

    const member = (project.teamMembers ?? []).find((item: any) => item.userId === input.actorId)
      ?? (project.ownerId === input.actorId ? { userId: input.actorId, role: 'OWNER', status: 'ACTIVE' } : null);
    const governance = !member
      ? await db.initiativeGovernance.findUnique({ where: { projectId: input.projectId } })
      : null;
    assertProjectTeamAccess({
      platformRole: input.actorRole,
      teamRole: member?.role ?? null,
      teamStatus: member?.status ?? null,
      isAssignedPortfolioLead: governance?.portfolioLeadUserId === input.actorId,
      need,
    });

    const organizationId = project.organizationId;
    if (!organizationId) {
      throw AppError.conflict('El proyecto no tiene una organización canónica para la sesión IA.', 'STEP_REASONING_ORGANIZATION_REQUIRED');
    }
    const organizationMember = await db.organizationMember.findFirst({
      where: { organizationId, userId: input.actorId },
      select: { id: true },
    });
    if (!organizationMember) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');

    const cycle = await db.initiativeCycle.findFirst({
      where: { projectId: input.projectId, status: 'active' },
      orderBy: { cycleNumber: 'desc' },
    });
    if (!cycle) {
      throw AppError.conflict('El proyecto no tiene un ciclo operativo activo.', 'STEP_REASONING_OPERATIONAL_CYCLE_REQUIRED');
    }
    if (input.expectedCycleId && input.expectedCycleId !== cycle.id) {
      throw AppError.conflict('El ciclo cambió. Recarga el contexto antes de continuar.', 'STEP_REASONING_CYCLE_CONFLICT');
    }

    const [configuration, checkpoint, responses, outputs, evidence, sources, claims] = await Promise.all([
      db.adaptiveStepConfiguration.findFirst({
        where: { projectId: input.projectId, cycleId: cycle.id, stepNumber: input.stepNumber, status: 'active' },
        orderBy: { version: 'desc' },
      }),
      db.adaptiveCheckpointInstance.findFirst({
        where: { projectId: input.projectId, cycleId: cycle.id, stepNumber: input.stepNumber, status: { in: ['ready', 'in_progress'] } },
        orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
      }),
      db.adaptiveCheckpointResponse.findMany({
        where: { projectId: input.projectId, checkpointInstance: { cycleId: cycle.id, stepNumber: input.stepNumber } },
        orderBy: { createdAt: 'asc' },
      }),
      db.adaptiveStepOutput.findMany({
        where: { projectId: input.projectId, cycleId: cycle.id, status: 'confirmed', stepNumber: { lt: input.stepNumber } },
        orderBy: [{ stepNumber: 'asc' }, { version: 'desc' }],
      }),
      db.evidence.findMany({ where: { projectId: input.projectId }, select: { id: true, name: true, type: true, status: true, stepRef: true, sourceRefId: true, targetClaimId: true, truthStatus: true, capturedAt: true, updatedAt: true }, orderBy: { createdAt: 'asc' }, take: 100 }),
      db.sourceRef.findMany({ where: { projectId: input.projectId }, select: { id: true, sourceType: true, reference: true, location: true, contentHash: true, version: true, capturedAt: true, updatedAt: true }, orderBy: { createdAt: 'asc' }, take: 100 }),
      db.truthClaim.findMany({ where: { projectId: input.projectId }, select: { id: true, subjectType: true, claimType: true, statement: true, verificationState: true, sourceRefsJson: true, updatedAt: true }, orderBy: { createdAt: 'asc' }, take: 100 }),
    ]);

    const legacyStep0 = input.stepNumber === 0 && Number(cycle.currentStep) === 1 && Boolean(configuration && checkpoint);
    const historicalRead = need === 'read' && input.stepNumber < Number(cycle.currentStep);
    if (Number(cycle.currentStep) !== input.stepNumber && !legacyStep0 && !historicalRead) {
      throw AppError.conflict('El Copilot sólo está disponible en el Step operativo actual.', 'STEP_REASONING_STEP_CONFLICT');
    }
    if (!configuration) {
      throw AppError.conflict('El Step operativo no tiene una configuración activa.', 'STEP_REASONING_STEP_NOT_CONFIGURED');
    }

    const confirmedResponses = responses.reduce(
      (acc: Record<string, unknown>, response: any) => Object.assign(acc, bounded(response.responseJson) as Record<string, unknown>),
      {},
    );
    const questionList = Array.isArray(checkpoint?.materializedQuestionsJson)
      ? bounded(checkpoint.materializedQuestionsJson) as unknown[]
      : [];
    const sourceContext = {
      schemaVersion: 'step-reasoning-context.v2' as const,
      project: {
        id: project.id,
        organizationId,
        name: String(project.name).slice(0, 300),
        description: project.description ? String(project.description).slice(0, MAX_STRING) : null,
        status: String(project.status),
        step0Data: bounded(project.step0Data ?? {}),
        inheritedContext: bounded(project.contextSnapshots?.[0]?.snapshotJson ?? null),
        portfolioContext: bounded(project.portfolioMeta ?? []),
        lastModified: project.lastModified?.toISOString?.() ?? String(project.lastModified ?? ''),
      },
      cycle: { id: cycle.id, cycleNumber: cycle.cycleNumber, currentStep: cycle.currentStep, status: cycle.status },
      step: {
        number: input.stepNumber,
        stableFunction: STEP_FUNCTIONS[input.stepNumber],
        configVersion: configuration.version,
        routeType: configuration.routeType ?? null,
        depthLevel: configuration.depthLevel ?? null,
      },
      checkpoint: { key: checkpoint?.checkpointKey ?? null, title: checkpointTitle(checkpoint), status: checkpoint?.status ?? null, questions: questionList },
      mandate: typeof configuration.sourceContextJson?.mandate === 'string' ? configuration.sourceContextJson.mandate.slice(0, 2_000) : null,
      masterContext: bounded(configuration.sourceContextJson ?? {}) as Record<string, unknown>,
      confirmedResponses,
      previousConfirmedOutputs: outputs.map((item: any) => ({ stepNumber: item.stepNumber, outputKey: item.outputKey, version: item.version, output: bounded(item.outputJson) })),
      evidenceInventory: bounded(evidence) as Array<Record<string, unknown>>,
      sourceInventory: bounded(sources) as Array<Record<string, unknown>>,
      truthInventory: bounded(claims) as Array<Record<string, unknown>>,
      allowedOperations: ['reason', 'suggest'] as const,
    };

    return { ...sourceContext, sourceContextHash: hashContext(sourceContext) };
  }
}
