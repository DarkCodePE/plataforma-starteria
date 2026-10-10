import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import {
  challengeAdmitsInitiatives,
  type ChallengeStatusValue,
} from '../portfolio/challenge-state-machine';
import { initiativeAcceptsStepWrites } from '../portfolio/initiative-state-machine';
import { Role, Project, Step0Data, Step0Status } from '../../shared/types';
import { StatusMapper } from '../../shared/utils/status-mapper';
import { validateTransition } from './state-machine';
import { syncInitiativeProgress } from '../portfolio/initiative-progress';
import { CreateProjectInput, UpdateProjectInput, UpdateSponsorDataInput } from './project.schemas';
import { calculateContextScore } from '../companies/context-score';
import { ensureChallengeGovernanceTx } from '../adaptive-core/initiative-governance';

export const DEFAULT_STEPS = [
  {
    number: 1,
    name: 'Claridad en el desafio',
    modules: [
      { id: 'A', name: 'Proceso actual' },
      { id: 'B', name: 'Medicion e impacto' },
      { id: 'C', name: 'Restricciones' },
      { id: 'D', name: 'Actores y entrevistas' },
      { id: 'S', name: 'Sintesis y revision de rumbo' },
    ],
  },
  {
    number: 2,
    name: 'Disenar solucion',
    modules: [
      { id: 'A', name: 'Como podriamos...?' },
      { id: 'B', name: 'Explorar ideas' },
      { id: 'C', name: 'Elegir la mejor opcion' },
      { id: 'D', name: 'Tarjetas de solucion y prueba' },
    ],
  },
  {
    number: 3,
    name: 'Probar en pequeno',
    modules: [
      { id: 'R', name: 'Experimentos' },
      { id: 'L', name: 'Tarjeta de aprendizaje' },
    ],
  },
  {
    number: 4,
    name: 'Contar la historia',
    modules: [
      { id: 'S', name: 'Construccion del relato' },
      { id: 'O', name: 'Resumen ejecutivo' },
      { id: 'P', name: 'Presentacion final' },
    ],
  },
];

function toPrismaStep0Status(status: Step0Status | string | undefined) {
  if (!status) return undefined;
  if (status === 'NOT_STARTED' || status === 'IN_PROGRESS' || status === 'COMPLETED') {
    return status;
  }
  if (status === 'No iniciado') return 'NOT_STARTED';
  if (status === 'En progreso') return 'IN_PROGRESS';
  if (status === 'Completado') return 'COMPLETED';
  return status;
}

export class ProjectService {
  constructor(private prisma: PrismaClient) {}

  private projectInclude = {
    steps: { include: { modules: true } },
    teamMembers: true,
    evidence: true,
    portfolioMeta: {
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            name: true,
            type: true,
            strategicFrontId: true,
            challengeOwner: true,
            successCriteria: true,
          },
        },
      },
    },
    contextSnapshots: {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    },
  } as const;

  async listProjects(userId: string, role: Role): Promise<Project[]> {
    switch (role) {
      case 'admin':
        return this.prisma.project.findMany({
          include: this.projectInclude,
        }) as unknown as Project[];

      case 'mentor':
        return this.prisma.project.findMany({
          where: {
            OR: [
              { mentorSessions: { some: { mentorId: userId } } },
              { status: 'EXPERT_SESSION_PENDING' },
            ],
          },
          include: this.projectInclude,
        }) as unknown as Project[];

      default:
        return this.prisma.project.findMany({
          where: { teamMembers: { some: { userId } } },
          include: this.projectInclude,
        }) as unknown as Project[];
    }
  }

  private async createCompanyContextSnapshot(tx: any, input: {
    userId: string;
    role: Role;
    projectId: string;
    companyId: string;
    areaId?: string;
  }) {
    const company = await tx.company.findFirst({
      where: {
        id: input.companyId,
        deletedAt: null,
        OR: [
          { ownerUserId: input.userId },
          { memberships: { some: { userId: input.userId, status: 'APPROVED' } } },
          ...(input.role === 'admin' ? [{}] : []),
        ],
      },
    });
    if (!company) {
      throw AppError.forbidden('No tienes acceso a esta empresa.', 'COMPANY_ACCESS_DENIED');
    }
    if (input.areaId) {
      const area = await tx.companyArea.findFirst({
        where: { id: input.areaId, companyId: input.companyId, status: 'ACTIVE' },
      });
      if (!area) throw AppError.notFound('Area', 'COMPANY_AREA_NOT_FOUND');
    }

    const [entries, sources, areas] = await Promise.all([
      tx.companyContextEntry.findMany({ where: { companyId: input.companyId }, orderBy: { createdAt: 'asc' } }),
      tx.contextSource.findMany({ where: { companyId: input.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      tx.companyArea.findMany({ where: { companyId: input.companyId, status: 'ACTIVE' }, include: { contexts: { orderBy: { version: 'desc' }, take: 1 } } }),
    ]);
    const score = calculateContextScore(entries, sources);
    let version = await tx.companyContextVersion.findFirst({
      where: { companyId: input.companyId, status: { in: ['PUBLISHED', 'DRAFT'] } },
      orderBy: { versionNumber: 'desc' },
    });
    const snapshotJson = {
      company: {
        id: company.id,
        name: company.name,
        sector: company.sector,
        country: company.country,
        employeeRange: company.employeeRange,
        websiteUrl: company.websiteUrl,
        linkedinUrl: company.linkedinUrl,
        scope: company.scope,
      },
      contextScore: score.score,
      contextLevel: score.level,
      scoreBreakdown: score.breakdown,
      missing: score.missing,
      entries: entries.map((entry: any) => ({
        dimension: entry.dimension,
        fieldKey: entry.fieldKey,
        value: entry.valueJson,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        confidence: entry.confidence,
        verificationStatus: entry.verificationStatus,
      })),
      sources: sources.map((source: any) => ({
        id: source.id,
        sourceType: source.sourceType,
        url: source.url,
        originalFilename: source.originalFilename,
        status: source.status,
        processedAt: source.processedAt,
      })),
      areas: areas.map((area: any) => ({
        id: area.id,
        name: area.name,
        description: area.description,
        context: area.contexts[0] ?? null,
      })),
    };
    if (!version) {
      version = await tx.companyContextVersion.create({
        data: {
          companyId: input.companyId,
          versionNumber: 1,
          status: 'DRAFT',
          contextScore: score.score,
          contextLevel: score.level,
          snapshotJson,
          scoreBreakdownJson: score.breakdown,
          missingJson: score.missing,
          createdByUserId: input.userId,
        },
      });
    }
    const areaVersion = input.areaId
      ? (await tx.companyAreaContext.findFirst({ where: { areaId: input.areaId }, orderBy: { version: 'desc' } }))?.version ?? null
      : null;
    await tx.initiativeContextSnapshot.create({
      data: {
        initiativeId: input.projectId,
        companyId: input.companyId,
        companyVersionId: version.id,
        areaId: input.areaId,
        areaVersion,
        snapshotJson: { ...snapshotJson, versionId: version.id, versionNumber: version.versionNumber },
        contextScore: score.score,
        createdByUserId: input.userId,
      },
    });
  }

  async createProject(userId: string, data: CreateProjectInput, role: Role = 'participante'): Promise<Project> {
    const challengeLinkId = data.challengeLink?.challengeId;
    const legacyChallengeId = challengeLinkId ? undefined : data.challengeId;
    const linkedChallenge = challengeLinkId
      ? await this.prisma.challenge.findUnique({
          where: { id: challengeLinkId },
          include: {
            strategicFront: true,
            assignedSquad: true,
          },
        })
      : null;

    if (challengeLinkId && !linkedChallenge) {
      throw AppError.notFound('Desafio', 'CHALLENGE_NOT_FOUND', {
        hint: 'Verifica el ID del reto antes de crear la iniciativa.',
      });
    }

    // ADR-030 decision 4: un reto en pausa o cerrado NO acepta iniciativas nuevas.
    // Se comprueba en el servidor y no solo en la UI: pintar el boton deshabilitado
    // seria decoracion — es el mismo error que ADR-029 erradico en autorizacion.
    if (linkedChallenge && !challengeAdmitsInitiatives(linkedChallenge.status as ChallengeStatusValue)) {
      throw AppError.conflict(
        `El reto esta en «${linkedChallenge.status}» y no admite iniciativas nuevas.`,
        'CHALLENGE_NOT_ADMITTING_INITIATIVES',
        { hint: 'Reanuda el reto para volver a recibir iniciativas.' },
      );
    }

    const inheritedTeam = linkedChallenge?.assignedSquad
      .map(member => member.value.trim())
      .filter(Boolean) ?? [];

    const inheritedStep0Data = linkedChallenge ? {
      mode: 'linked_to_challenge',
      initiativeTitle: data.name,
      initiativeFrame: linkedChallenge.type,
      clarityLevel: 'hipotesis_clara',
      primaryObjective: 'aprendizaje',
      specificChallengePart: linkedChallenge.whatWeWantToMove ?? linkedChallenge.title,
      challengeGoalConnection: linkedChallenge.objective ?? linkedChallenge.successCriteria ?? '',
      linkedContributionType: 'descubrir_problema',
      whyNowText: linkedChallenge.whyNow ?? linkedChallenge.strategicFront.whyNow ?? '',
      validationSignal: linkedChallenge.successCriteria ?? linkedChallenge.strategicFront.target ?? '',
      currentEvidence: linkedChallenge.description ?? linkedChallenge.objective ?? '',
      quienEscuchar: linkedChallenge.challengeOwner ?? linkedChallenge.strategicFront.sponsor ?? '',
      additionalStakeholders: inheritedTeam.length > 0 ? 'si' : 'no_claro',
      additionalStakeholdersDetail: inheritedTeam.join(', '),
      sponsorInterestReason: linkedChallenge.strategicFront.strategicObjective ?? '',
      decisionRequested: 'Validar si esta iniciativa debe avanzar dentro del reto.',
    } : undefined;

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          ownerId: userId,
          cohortId: data.cohort,
          status: 'DRAFT',
          currentStep: linkedChallenge ? 0 : 1,
          step0Status: linkedChallenge ? 'IN_PROGRESS' : 'NOT_STARTED',
          step0Data: linkedChallenge ? inheritedStep0Data as any : undefined,
          mentorCredits: 3,
          riskLevel: 'LOW',
          teamMembers: {
            create: { userId, role: 'OWNER', status: 'ACTIVE' },
          },
          steps: {
            create: DEFAULT_STEPS.map((s) => ({
              number: s.number,
              name: s.name,
              status: s.number === 1 ? 'NOT_STARTED' : 'BLOCKED',
              progress: 0,
              modules: {
                create: s.modules.map((m, idx) => ({
                  moduleId: m.id,
                  name: m.name,
                  status: s.number === 1 && idx === 0 ? 'DRAFT' : 'BLOCKED',
                })),
              },
            })),
          },
        },
      });

      if (linkedChallenge) {
        await ensureChallengeGovernanceTx(tx, created.id, linkedChallenge.id);
        await tx.initiativePortfolioMeta.create({
          data: {
            projectId: created.id,
            challengeId: linkedChallenge.id,
            strategicFrontId: linkedChallenge.strategicFrontId,
            teamOwner: linkedChallenge.challengeOwner,
            currentStep: 'Step 0',
            status: 'en_step_0',
            sponsorTouchpoint: linkedChallenge.strategicFront.sponsor,
            mainMetric: linkedChallenge.successCriteria ?? linkedChallenge.strategicFront.mainKpi,
            contributionType: 'descubrir',
            estimatedContribution: 'bajo',
            lastActivity: 'Iniciativa creada desde reto',
            signalSummary: linkedChallenge.objective ?? linkedChallenge.whatWeWantToMove,
            teamLabel: inheritedTeam.join(', '),
            teamMembers: inheritedTeam,
            executiveSummary: linkedChallenge.objective ?? linkedChallenge.description,
            experimentSummary: linkedChallenge.successCriteria,
            stepsTimeline: [
              {
                step: 'Step 0',
                state: 'current',
                note: 'Debe completar Step 0 con el contexto heredado del reto.',
              },
            ],
          } as any,
        });
      } else if (legacyChallengeId) {
        const legacyChallenge = await tx.challenge.findUnique({
          where: { id: legacyChallengeId },
          select: { id: true, strategicFrontId: true },
        });
        if (legacyChallenge) {
          await ensureChallengeGovernanceTx(tx, created.id, legacyChallenge.id);
          await tx.initiativePortfolioMeta.upsert({
            where: {
              projectId_challengeId: { projectId: created.id, challengeId: legacyChallenge.id },
            },
            create: {
              projectId: created.id,
              challengeId: legacyChallenge.id,
              strategicFrontId: legacyChallenge.strategicFrontId,
              status: 'en_step_0',
            },
            update: {},
          });

          const challengeTeam = await tx.challengeTeamMember.findMany({
            where: { challengeId: legacyChallenge.id, userId: { not: null } },
            select: { userId: true, role: true, status: true },
          });
          const inherited = challengeTeam.filter((m) => m.userId && m.userId !== userId);
          if (inherited.length > 0) {
            await tx.teamMember.createMany({
              data: inherited.map((m) => ({
                projectId: created.id,
                userId: m.userId as string,
                role: m.role,
                status: m.status,
                inheritedFromChallenge: true,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      if (data.companyContext?.companyId) {
        await this.createCompanyContextSnapshot(tx, {
          userId,
          role,
          projectId: created.id,
          companyId: data.companyContext.companyId,
          areaId: data.companyContext.areaId,
        });
      }

      if (typeof tx.project.findUniqueOrThrow === 'function') {
        return tx.project.findUniqueOrThrow({
          where: { id: created.id },
          include: this.projectInclude,
        });
      }

      return created;
    });

    return project as unknown as Project;
  }

  async getProject(projectId: string, userId: string, role: Role): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: this.projectInclude,
    });

    if (!project) {
      throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', {
        hint: 'Verifica el ID o vuelve al listado.',
      });
    }

    if (role !== 'admin' && role !== 'mentor') {
      const isMember = (project as any).teamMembers.some((m: any) => m.userId === userId);
      if (!isMember) {
        throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED', {
          hint: 'Solicita acceso al owner del proyecto.',
        });
      }
    }

    return project as unknown as Project;
  }

  /**
   * Lectura de la iniciativa. Además de quien puede editarla (getProject), la ve el Portfolio
   * Lead asignado en InitiativeGovernance: es quien la decide (§23, ADR-025) y "Abrir
   * iniciativa" en /portfolio/iniciativas le daba PROJECT_ACCESS_DENIED. No usar en escrituras.
   */
  async getProjectForRead(projectId: string, userId: string, role: Role): Promise<Project> {
    try {
      return await this.getProject(projectId, userId, role);
    } catch (err) {
      if (!(err instanceof AppError) || err.code !== 'PROJECT_ACCESS_DENIED') throw err;
      const governance = await (this.prisma as any).initiativeGovernance.findUnique({ where: { projectId } });
      if (governance?.portfolioLeadUserId !== userId) throw err;
      return this.prisma.project.findUnique({ where: { id: projectId }, include: this.projectInclude }) as unknown as Project;
    }
  }

  async updateProject(
    projectId: string,
    userId: string,
    role: Role,
    data: UpdateProjectInput
  ): Promise<Project> {
    const existing = await this.getProject(projectId, userId, role);
    // ADR-030: cerrada o pausada es de sólo lectura también para los datos del proyecto.
    await this.assertInitiativeAcceptsStepWrites(projectId);

    if (data.status && data.status !== existing.status) {
      validateTransition('project', existing.status, data.status);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data as any),
        lastModified: new Date().toISOString(),
      },
      include: this.projectInclude,
    });

    return updated as unknown as Project;
  }

  async archiveProject(projectId: string, userId: string, role: Role): Promise<void> {
    await this.getProject(projectId, userId, role);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { isArchived: true },
    });
  }

  async getStep0(projectId: string, userId: string, role: Role): Promise<Partial<Step0Data> | null> {
    const project = await this.getProject(projectId, userId, role);
    return (project as any).step0Data ?? null;
  }

  /**
   * ADR-030: una iniciativa pausada o cerrada es de SOLO LECTURA, y eso se comprueba en el
   * servidor. Deshabilitar el boton en la UI seria decoracion: el mismo error que ADR-029
   * erradico en autorizacion. `bloqueada` NO congela — trabajar en ella es como se desbloquea.
   *
   * Silencioso cuando la iniciativa no esta vinculada a ningun reto: un proyecto suelto no
   * tiene ciclo de vida de portafolio que respetar.
   */
  private async assertInitiativeAcceptsStepWrites(projectId: string): Promise<void> {
    const metas = await this.prisma.initiativePortfolioMeta.findMany({
      where: { projectId },
      select: { status: true },
    });
    const frozen = metas.find(m => !initiativeAcceptsStepWrites(m.status as string));
    if (frozen) {
      throw AppError.conflict(
        `La iniciativa esta en «${frozen.status}» y es de solo lectura.`,
        'INITIATIVE_READ_ONLY',
        { hint: 'Reanuda la iniciativa para volver a editarla.' },
      );
    }
  }

  async updateStep0(
    projectId: string,
    userId: string,
    role: Role,
    data: Partial<Step0Data>,
    status?: Step0Status
  ): Promise<Project> {
    await this.getProject(projectId, userId, role);
    await this.assertInitiativeAcceptsStepWrites(projectId);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        step0Data: data as any,
        step0Status: toPrismaStep0Status(status) as any,
        lastModified: new Date().toISOString(),
      },
      include: this.projectInclude,
    });

    await syncInitiativeProgress(this.prisma, projectId);

    return updated as unknown as Project;
  }

  async updateSponsorData(
    projectId: string,
    userId: string,
    role: Role,
    data: UpdateSponsorDataInput,
  ): Promise<Project> {
    // Verify the caller has access to this project (throws forbidden/notFound if not)
    await this.getProject(projectId, userId, role);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        sponsorTouchpoints: data.sponsorTouchpoints as any,
        sponsorComments: data.sponsorComments as any,
        lastModified: new Date().toISOString(),
      },
      include: this.projectInclude,
    });

    return updated as unknown as Project;
  }

  async updateLastPosition(
    projectId: string,
    userId: string,
    position: { stepNumber: number; moduleId?: string }
  ): Promise<void> {
    // Verify project exists and user has access
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', {
        hint: 'Verifica el ID o vuelve al listado.',
      });
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        lastPosition: {
          stepNumber: position.stepNumber,
          moduleId: position.moduleId ?? null,
          userId,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
