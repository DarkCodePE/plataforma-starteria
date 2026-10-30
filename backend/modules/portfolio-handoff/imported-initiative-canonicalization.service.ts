import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

export type ImportedInitiativeMode = 'LINK_EXISTING' | 'REGISTER_EXISTING';

export type CanonicalizeImportedInitiativeInput = {
  organizationId: string;
  challengeId: string;
  workItemId: string;
  mode: ImportedInitiativeMode;
  projectId?: string;
  expectedWorkItemUpdatedAt: string;
  identityConfirmed: true;
  alignmentConfirmed: true;
  name?: string;
  description?: string | null;
  actorId: string;
  idempotencyKey: string;
};

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((out, key) => {
      out[key] = normalize((value as Record<string, unknown>)[key]);
      return out;
    }, {});
  }
  return value;
}

export function importedInitiativeFingerprint(input: CanonicalizeImportedInitiativeInput): string {
  const { idempotencyKey: _ignored, ...semanticInput } = input;
  return createHash('sha256').update(JSON.stringify(normalize(semanticInput))).digest('hex');
}

function isRetryable(error: unknown): boolean {
  const value = error as { code?: unknown; meta?: { code?: unknown } } | null;
  return value?.code === 'P2034' || (value?.code === 'P2010' && value.meta?.code === '40001');
}

function projectView(project: any) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    ownerEmail: project.owner?.email ?? null,
    ownerName: project.owner?.name ?? null,
    activationStatus: project.activationStatus ?? null,
    retrospectiveAssessmentStatus: project.retrospectiveAssessmentStatus ?? null,
  };
}

function linkView(link: any) {
  return {
    id: link.id,
    organizationId: link.organizationId,
    workItemId: link.workItemId,
    projectId: link.projectId,
    challengeId: link.challengeId,
    mode: link.mode,
    status: link.status,
    decisionVersion: link.decisionVersion,
    confirmedAt: link.confirmedAt,
  };
}

export class ImportedInitiativeCanonicalizationService {
  constructor(private readonly prisma: any) {}

  async execute(input: CanonicalizeImportedInitiativeInput) {
    if (input.mode === 'REGISTER_EXISTING') {
      throw AppError.conflict(
        'Registrar una iniciativa documental permanece bloqueado hasta disponer de un consumidor downstream autorizado para resolver su owner.',
        'IMPORTED_INITIATIVE_REGISTER_EXISTING_BLOCKED',
      );
    }
    const fingerprint = importedInitiativeFingerprint(input);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx: any) => this.executeTx(tx, input, fingerprint),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
        );
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === 3) throw error;
      }
    }
    throw lastError;
  }

  private async executeTx(tx: any, input: CanonicalizeImportedInitiativeInput, fingerprint: string) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PortfolioBootstrapWorkItem" WHERE "id" = ${input.workItemId} FOR UPDATE`);
    const workItem = await tx.portfolioBootstrapWorkItem.findUnique({
      where: { id: input.workItemId },
      include: {
        bootstrapSession: { select: { id: true, organizationId: true } },
        importBatch: { select: { id: true, fileName: true } },
      },
    });
    if (!workItem || workItem.bootstrapSession?.organizationId !== input.organizationId) {
      throw AppError.notFound('Iniciativa documental', 'IMPORTED_INITIATIVE_NOT_FOUND');
    }
    if (workItem.updatedAt.toISOString() !== new Date(input.expectedWorkItemUpdatedAt).toISOString()) {
      throw AppError.conflict('La iniciativa documental cambió; recarga antes de confirmar', 'IMPORTED_INITIATIVE_SOURCE_VERSION_CONFLICT');
    }

    const materializations = await tx.portfolioOrganizationMaterialization.findMany({
      where: { organizationId: input.organizationId, bootstrapSessionId: workItem.bootstrapSessionId },
      select: { canonicalMappings: true },
    });
    const related = materializations.some((row: any) => {
      const mappings = row.canonicalMappings as any;
      return (Array.isArray(mappings?.challenges) ? mappings.challenges : []).some((challenge: any) =>
        challenge?.canonicalId === input.challengeId
        && Array.isArray(challenge.relatedInitiativeIds)
        && challenge.relatedInitiativeIds.map(String).includes(input.workItemId));
    });
    if (!related) {
      throw AppError.conflict('El registro documental no está confirmado como relacionado con este reto', 'IMPORTED_INITIATIVE_ALIGNMENT_REQUIRED');
    }

    const activeWorkItemKey = `${input.organizationId}:${input.workItemId}`;
    const active = await tx.portfolioImportedInitiativeLink.findUnique({
      where: { activeWorkItemKey },
      include: { project: { include: { owner: { select: { email: true, name: true } } } } },
    });
    if (active) {
      if (active.fingerprint !== fingerprint) {
        throw AppError.conflict('La iniciativa documental ya tiene otra correspondencia canónica activa', 'IMPORTED_INITIATIVE_CORRESPONDENCE_CONFLICT');
      }
      return { link: linkView(active), project: projectView(active.project), idempotent: true };
    }

    const priorKey = await tx.portfolioImportedInitiativeLink.findUnique({
      where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } },
      include: { project: { include: { owner: { select: { email: true, name: true } } } } },
    });
    if (priorKey) {
      if (priorKey.fingerprint !== fingerprint) {
        throw AppError.conflict('La idempotency key ya se usó con otra decisión', 'IMPORTED_INITIATIVE_IDEMPOTENCY_CONFLICT');
      }
      return { link: linkView(priorKey), project: projectView(priorKey.project), idempotent: true };
    }

    let project: any;
    if (input.mode === 'LINK_EXISTING') {
      project = await tx.project.findUnique({
        where: { id: input.projectId },
        include: {
          owner: { select: { organizationId: true, email: true, name: true } },
          portfolioMeta: { select: { challengeId: true } },
        },
      });
      if (!project?.organizationId || project.organizationId !== input.organizationId) {
        throw AppError.notFound('Iniciativa canónica', 'IMPORTED_INITIATIVE_PROJECT_NOT_FOUND');
      }
    } else {
      project = await tx.project.create({
        data: {
          name: input.name?.trim() || workItem.proposedName || workItem.rawLabel,
          description: input.description === undefined ? workItem.proposedPurpose : input.description,
          organizationId: input.organizationId,
          ownerId: null,
          origin: 'imported',
          status: 'DRAFT',
          activationStatus: 'OWNER_PENDING',
          retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT',
        },
        include: { owner: { select: { email: true, name: true } } },
      });
    }

    const existingMeta = await tx.initiativePortfolioMeta.findUnique({
      where: { projectId_challengeId: { projectId: project.id, challengeId: input.challengeId } },
    });
    if (!existingMeta) {
      const linkedStatus = `en_step_${Math.max(0, Math.min(4, Number(project.currentStep ?? 0)))}`;
      await tx.initiativePortfolioMeta.create({
        data: {
          projectId: project.id,
          challengeId: input.challengeId,
          status: input.mode === 'REGISTER_EXISTING' ? 'pending_retroactive_assessment' : linkedStatus,
          currentStep: input.mode === 'REGISTER_EXISTING' ? null : `Step ${Math.max(0, Math.min(4, Number(project.currentStep ?? 0)))}`,
          alignmentNotes: 'Alineamiento confirmado por Portfolio Lead durante incorporación documental ADR-009.',
        },
      });
    }

    const link = await tx.portfolioImportedInitiativeLink.create({
      data: {
        organizationId: input.organizationId,
        bootstrapSessionId: workItem.bootstrapSessionId,
        workItemId: workItem.id,
        projectId: project.id,
        challengeId: input.challengeId,
        mode: input.mode,
        activeWorkItemKey,
        sourceVersion: workItem.updatedAt,
        fingerprint,
        idempotencyKey: input.idempotencyKey,
        identitySnapshot: {
          rawLabel: workItem.rawLabel,
          proposedName: workItem.proposedName,
          proposedPurpose: workItem.proposedPurpose,
          ownerCandidate: workItem.ownerCandidate,
        },
        sourceSnapshot: {
          sourceType: workItem.sourceType,
          sourceRefs: workItem.sourceRefs,
          importBatchId: workItem.importBatchId,
          sourceLabel: workItem.importBatch?.fileName ?? null,
        },
        alignmentDecision: { challengeId: input.challengeId, confirmed: true },
        confirmedByActorId: input.actorId,
      },
      include: { project: { include: { owner: { select: { email: true, name: true } } } } },
    });
    return { link: linkView(link), project: projectView(link.project), idempotent: false };
  }
}
