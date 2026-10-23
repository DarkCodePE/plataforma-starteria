import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { PortfolioService } from '../portfolio/portfolio.service';
import type { PortfolioOrganizationPayload } from './portfolio-bootstrap.schemas';

type Authority = {
  authenticatedUserId: string;
  roles?: ReadonlySet<string> | readonly string[];
  permissions?: ReadonlySet<string> | readonly string[];
};

type SaveInput = Authority & {
  sessionId: string;
  expectedVersion: number;
  payload: PortfolioOrganizationPayload;
};

type ConfirmInput = Authority & {
  sessionId: string;
  proposalVersion: number;
  idempotencyKey: string;
};

export type PortfolioOrganizationProposalDto = {
  id: string;
  version: number;
  status: string;
  sourceVersion: string;
  payload: PortfolioOrganizationPayload;
  sourceRefs: unknown;
  provenance: unknown;
  reviewedBy: string;
  reviewedAt: string;
  materialization: PortfolioOrganizationMaterializationDto | null;
};

export type PortfolioOrganizationMaterializationDto = {
  id: string;
  proposalVersion: number;
  canonicalMappings: unknown;
  confirmedBy: string;
  confirmedAt: string;
};

export class PortfolioOrganizationService {
  constructor(private readonly prisma: PrismaClient) {}

  async getProposal(input: Authority & { sessionId: string }): Promise<PortfolioOrganizationProposalDto | null> {
    const session = await this.loadAuthorizedSession(input);
    const proposal = await this.prisma.portfolioOrganizationProposal.findFirst({
      where: { bootstrapSessionId: session.id, organizationId: session.organizationId! },
      orderBy: { version: 'desc' },
      include: { materialization: true },
    });
    return proposal ? toProposalDto(proposal) : null;
  }

  async saveReviewedProposal(input: SaveInput): Promise<PortfolioOrganizationProposalDto> {
    const session = await this.loadAuthorizedSession(input);
    const organizationId = session.organizationId!;
    this.assertPayloadReferencesSession(input.payload, session.workItems.map((item) => item.id));
    const sourceVersion = sourceFingerprint(session);
    const payloadHash = hash(input.payload);
    const sourceRefs = {
      anchor: { id: session.anchor?.id, version: session.anchor?.version, sourceRefs: session.anchor?.sourceRefs },
      workItems: session.workItems.map((item) => ({ id: item.id, sourceRefs: item.sourceRefs })),
      analysisRunId: session.analysisRuns[0]?.id ?? null,
    };

    return this.prisma.$transaction(async (tx) => {
      const materialized = await tx.portfolioOrganizationMaterialization.findUnique({ where: { bootstrapSessionId: session.id } });
      if (materialized) {
        throw AppError.conflict(
          'La organización ya fue confirmada y no se reescribe silenciosamente.',
          'PORTFOLIO_ORGANIZATION_ALREADY_MATERIALIZED',
        );
      }
      const latest = await tx.portfolioOrganizationProposal.findFirst({
        where: { bootstrapSessionId: session.id },
        orderBy: { version: 'desc' },
      });
      const currentVersion = latest?.version ?? 0;
      if (input.expectedVersion !== currentVersion) {
        throw AppError.conflict(
          'La propuesta cambió mientras la revisabas. Recarga antes de sobrescribir.',
          'PORTFOLIO_ORGANIZATION_VERSION_CONFLICT',
          { hint: `Versión esperada ${input.expectedVersion}; versión vigente ${currentVersion}.` },
        );
      }
      if (latest?.payloadHash === payloadHash && latest.sourceVersion === sourceVersion) {
        return toProposalDto({ ...latest, materialization: null });
      }
      if (latest) {
        await tx.portfolioOrganizationProposal.update({ where: { id: latest.id }, data: { status: 'superseded' } });
      }
      const proposal = await tx.portfolioOrganizationProposal.create({
        data: {
          bootstrapSessionId: session.id,
          organizationId,
          version: currentVersion + 1,
          status: 'reviewed',
          sourceVersion,
          payloadHash,
          payload: input.payload as Prisma.InputJsonValue,
          sourceRefs: sourceRefs as Prisma.InputJsonValue,
          provenance: {
            proposalAuthority: 'AI_PROPOSES_ONLY',
            reviewAuthority: 'PORTFOLIO_LEAD',
            decision: 'HUMAN_REVIEWED',
            authorityRefs: ['KAN-29', 'KAN-154', 'KAN-155'],
          },
          reviewedBy: input.authenticatedUserId,
        },
      });
      return toProposalDto({ ...proposal, materialization: null });
    });
  }

  async confirmAndMaterialize(input: ConfirmInput): Promise<PortfolioOrganizationProposalDto> {
    const idempotencyKey = input.idempotencyKey?.trim();
    if (!idempotencyKey) throw AppError.badRequest('Falta Idempotency-Key.', 'PORTFOLIO_ORGANIZATION_IDEMPOTENCY_REQUIRED');
    const session = await this.loadAuthorizedSession(input);
    const organizationId = session.organizationId!;
    const proposal = await this.prisma.portfolioOrganizationProposal.findUnique({
      where: { bootstrapSessionId_version: { bootstrapSessionId: session.id, version: input.proposalVersion } },
      include: { materialization: true },
    });
    if (!proposal || proposal.organizationId !== organizationId) {
      throw AppError.notFound('Propuesta de organización', 'PORTFOLIO_ORGANIZATION_PROPOSAL_NOT_FOUND');
    }
    const approvalFingerprint = hash({
      organizationId,
      bootstrapSessionId: session.id,
      proposalId: proposal.id,
      proposalVersion: proposal.version,
      payloadHash: proposal.payloadHash,
    });
    const existing = proposal.materialization
      ?? await this.prisma.portfolioOrganizationMaterialization.findUnique({ where: { bootstrapSessionId: session.id } });
    if (existing) return this.assertExactMaterialization(existing, proposal, approvalFingerprint);
    const latest = await this.prisma.portfolioOrganizationProposal.findFirst({ where: { bootstrapSessionId: session.id }, orderBy: { version: 'desc' } });
    if (latest?.id !== proposal.id || proposal.status !== 'reviewed') {
      throw AppError.conflict('La propuesta confirmada ya no es la revisión vigente.', 'PORTFOLIO_ORGANIZATION_VERSION_CONFLICT');
    }
    if (proposal.sourceVersion !== sourceFingerprint(session)) {
      throw AppError.conflict(
        'Las iniciativas o el objetivo cambiaron después de la revisión. Actualiza la propuesta antes de confirmar.',
        'PORTFOLIO_ORGANIZATION_STALE',
      );
    }
    const payload = proposal.payload as unknown as PortfolioOrganizationPayload;
    this.assertPayloadReferencesSession(payload, session.workItems.map((item) => item.id));

    try {
      const materialization = await this.prisma.$transaction(async (tx) => {
        const conflictingKey = await tx.portfolioOrganizationMaterialization.findUnique({
          where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
        });
        if (conflictingKey && conflictingKey.approvalFingerprint !== approvalFingerprint) {
          throw AppError.conflict('La idempotency key ya corresponde a otra confirmación.', 'PORTFOLIO_ORGANIZATION_IDEMPOTENCY_CONFLICT');
        }
        if (conflictingKey) return conflictingKey;

        const portfolio = new PortfolioService(tx as unknown as PrismaClient);
        const frontMappings: Array<{ candidateId: string; canonicalId: string }> = [];
        const challengeMappings: Array<{ candidateId: string; canonicalId: string; relatedInitiativeIds: string[] }> = [];
        for (const frontCandidate of payload.fronts) {
          const front = await portfolio.createStrategicFront({
            name: frontCandidate.name,
            description: frontCandidate.rationale,
            strategicObjective: frontCandidate.focus,
            whyNow: `Cobertura revisada: ${frontCandidate.coverage}`,
            organizationId,
            status: 'draft',
          });
          frontMappings.push({ candidateId: frontCandidate.candidateId, canonicalId: front.id });
          for (const challengeCandidate of frontCandidate.challenges) {
            const challenge = await portfolio.createChallenge(front.id, {
              title: challengeCandidate.title,
              name: challengeCandidate.title,
              description: challengeCandidate.problem,
              whatWeWantToMove: challengeCandidate.rationale,
              knownFacts: challengeCandidate.evidence.join('\n') || undefined,
              openQuestions: challengeCandidate.gaps.join('\n') || undefined,
              dependencies: challengeCandidate.overlaps.join('\n') || undefined,
              status: 'draft',
            });
            challengeMappings.push({
              candidateId: challengeCandidate.candidateId,
              canonicalId: challenge.id,
              relatedInitiativeIds: challengeCandidate.relatedInitiativeIds,
            });
          }
        }
        const created = await tx.portfolioOrganizationMaterialization.create({
          data: {
            proposalId: proposal.id,
            bootstrapSessionId: session.id,
            organizationId,
            proposalVersion: proposal.version,
            approvalFingerprint,
            idempotencyKey,
            canonicalMappings: {
              fronts: frontMappings,
              challenges: challengeMappings,
              specialDestinations: {
                crossCuttingInitiativeIds: payload.crossCuttingInitiativeIds,
                outsideObjectiveInitiativeIds: payload.outsideObjectiveInitiativeIds,
                ungroupedInitiativeIds: payload.ungroupedInitiativeIds,
              },
            },
            confirmedBy: input.authenticatedUserId,
          },
        });
        await tx.portfolioOrganizationProposal.update({ where: { id: proposal.id }, data: { status: 'materialized' } });
        return created;
      });
      return toProposalDto({ ...proposal, status: 'materialized', materialization });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const recovered = await this.prisma.portfolioOrganizationMaterialization.findUnique({ where: { bootstrapSessionId: session.id } });
        if (recovered) return this.assertExactMaterialization(recovered, proposal, approvalFingerprint);
      }
      throw error;
    }
  }

  private assertExactMaterialization(materialization: any, proposal: any, fingerprint: string): PortfolioOrganizationProposalDto {
    if (materialization.proposalId !== proposal.id || materialization.approvalFingerprint !== fingerprint) {
      throw AppError.conflict(
        'La sesión ya materializó otra versión de la propuesta.',
        'PORTFOLIO_ORGANIZATION_MATERIALIZATION_CONFLICT',
      );
    }
    return toProposalDto({ ...proposal, status: 'materialized', materialization });
  }

  private async loadAuthorizedSession(input: Authority & { sessionId: string }) {
    if (!hasAuthority(input.permissions, 'portfolio:write') || !hasAuthority(input.roles, 'portfolio_lead')) {
      throw AppError.forbidden('Solo Portfolio Lead puede revisar y confirmar esta organización.', 'PORTFOLIO_ORGANIZATION_AUTHORITY_REQUIRED');
    }
    const session = await this.prisma.portfolioBootstrapSession.findUnique({
      where: { id: input.sessionId },
      include: {
        anchor: true,
        workItems: { orderBy: { id: 'asc' } },
        strategicConnections: { orderBy: { id: 'asc' } },
        analysisRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!session || session.userId !== input.authenticatedUserId) {
      throw AppError.notFound('Sesión Bootstrap', 'PORTFOLIO_ORGANIZATION_SESSION_NOT_FOUND');
    }
    if (!session.organizationId) {
      throw AppError.conflict('La sesión no tiene tenant resuelto.', 'PORTFOLIO_ORGANIZATION_TENANT_REQUIRED');
    }
    const actor = await this.prisma.user.findUnique({ where: { id: input.authenticatedUserId }, select: { organizationId: true } });
    if (actor?.organizationId !== session.organizationId) {
      throw AppError.forbidden('La sesión pertenece a otro tenant.', 'PORTFOLIO_ORGANIZATION_TENANT_MISMATCH');
    }
    return session;
  }

  private assertPayloadReferencesSession(payload: PortfolioOrganizationPayload, sessionWorkItemIds: string[]) {
    const allowed = new Set(sessionWorkItemIds);
    const referenced = [
      ...payload.fronts.flatMap((front) => front.challenges.flatMap((challenge) => challenge.relatedInitiativeIds)),
      ...payload.crossCuttingInitiativeIds,
      ...payload.outsideObjectiveInitiativeIds,
      ...payload.ungroupedInitiativeIds,
    ];
    if (referenced.some((id) => !allowed.has(id))) {
      throw AppError.forbidden(
        'La propuesta contiene una iniciativa ajena a esta sesión o tenant.',
        'PORTFOLIO_ORGANIZATION_CROSS_TENANT_REFERENCE',
      );
    }
  }
}

function hasAuthority(values: ReadonlySet<string> | readonly string[] | undefined, expected: string): boolean {
  if (!values) return false;
  return 'has' in values ? values.has(expected) : values.includes(expected);
}

function sourceFingerprint(session: any): string {
  return hash({
    anchor: session.anchor ? { id: session.anchor.id, version: session.anchor.version, updatedAt: session.anchor.updatedAt } : null,
    workItems: session.workItems.map((item: any) => ({ id: item.id, updatedAt: item.updatedAt })),
    strategicConnections: session.strategicConnections.map((connection: any) => ({ id: connection.id, updatedAt: connection.updatedAt })),
    analysisRun: session.analysisRuns[0] ? {
      id: session.analysisRuns[0].id,
      inputVersion: session.analysisRuns[0].inputVersion,
      outputVersion: session.analysisRuns[0].outputVersion,
    } : null,
  });
}

function hash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function toProposalDto(proposal: any): PortfolioOrganizationProposalDto {
  return {
    id: proposal.id,
    version: proposal.version,
    status: proposal.status,
    sourceVersion: proposal.sourceVersion,
    payload: proposal.payload,
    sourceRefs: proposal.sourceRefs,
    provenance: proposal.provenance,
    reviewedBy: proposal.reviewedBy,
    reviewedAt: proposal.reviewedAt.toISOString(),
    materialization: proposal.materialization ? {
      id: proposal.materialization.id,
      proposalVersion: proposal.materialization.proposalVersion,
      canonicalMappings: proposal.materialization.canonicalMappings,
      confirmedBy: proposal.materialization.confirmedBy,
      confirmedAt: proposal.materialization.confirmedAt.toISOString(),
    } : null,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
