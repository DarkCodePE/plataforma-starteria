import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import type {
  AttachEvidenceInput,
  CreateAttentionItemInput,
  CreateClaimInput,
  CreateImpactAssertionInput,
  CreateSourceRefInput,
  RecordValidationInput,
  ResolveAttentionItemInput,
  TransitionImpactInput,
} from './truth.schemas';

type Actor = { id: string; role?: string; type?: 'human' | 'ai' | 'system' };

export interface ValidatedSupportBindingInput {
  claimId: string;
  evidenceIds: string[];
  sourceRefIds: string[];
}

export interface EvidenceReferenceBindingInput {
  evidenceIds: string[];
  sourceRefIds: string[];
}

const FINAL_VALIDATION_RESULTS = new Set(['supported', 'contradicted', 'insufficient']);

const CLAIM_STATE_BY_VALIDATION = {
  unvalidated: 'unvalidated',
  supported: 'supported',
  contradicted: 'contradicted',
  insufficient: 'insufficient',
} as const;

const EVIDENCE_STATUS_BY_VALIDATION = {
  supported: 'supports',
  contradicted: 'contradicts',
  insufficient: 'insufficient',
} as const;

export class TruthService {
  constructor(private prisma: PrismaClient) {}

  async createSourceRef(input: CreateSourceRefInput, actor: Actor) {
    return this.prisma.sourceRef.create({
      data: {
        project: input.projectId ? { connect: { id: input.projectId } } : undefined,
        sourceType: input.sourceType,
        reference: input.reference,
        location: input.location,
        originActorId: actor.id,
        originActorType: actor.type ?? 'human',
        contentHash: input.contentHash,
        version: input.version,
        metadataJson: input.metadataJson as Prisma.InputJsonValue,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : undefined,
      },
    });
  }

  async createClaim(input: CreateClaimInput, actor: Actor) {
    await this.ensureProject(input.projectId);
    if (input.sourceRefIds.length > 0) {
      await this.ensureSourceRefs(input.sourceRefIds, input.projectId);
    }

    return this.prisma.truthClaim.create({
      data: {
        projectId: input.projectId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        claimType: input.claimType,
        statement: input.statement,
        valueJson: input.valueJson === undefined ? undefined : input.valueJson as Prisma.InputJsonValue,
        createdById: actor.id,
        createdByType: actor.type ?? 'human',
        verificationState: 'unvalidated',
        sourceRefsJson: input.sourceRefIds as Prisma.InputJsonValue,
        sourceRefLinks: input.sourceRefIds.length > 0
          ? { create: input.sourceRefIds.map((sourceRefId) => ({ sourceRefId })) }
          : undefined,
      },
    });
  }

  async attachEvidence(input: AttachEvidenceInput, actor: Actor) {
    await this.ensureProject(input.projectId);
    await this.ensureSourceRefs([input.sourceRefId], input.projectId);
    if (input.targetClaimId) await this.ensureClaim(input.projectId, input.targetClaimId);

    return this.prisma.evidence.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        type: input.evidenceType,
        url: input.url,
        storageKey: input.storageKey,
        stepRef: input.stepRef,
        moduleRef: input.moduleRef,
        ownerId: actor.id,
        status: 'UPLOADED',
        sourceRefId: input.sourceRefId,
        targetClaimId: input.targetClaimId,
        truthStatus: input.truthStatus,
        capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
        excerpt: input.excerpt,
        provenance: input.provenance as Prisma.InputJsonValue,
        metadataJson: input.metadataJson as Prisma.InputJsonValue,
      },
      include: { sourceRef: true, targetClaim: true },
    });
  }

  async recordValidation(input: RecordValidationInput, actor: Actor) {
    const db = this.prisma as any;
    if (typeof db.$transaction === 'function') {
      return db.$transaction((tx: PrismaClient) => new TruthService(tx).recordValidationInCurrentClient(input, actor));
    }
    if (process.env.NODE_ENV !== 'test') {
      throw AppError.internal('La persistencia de validaciones requiere una transaccion disponible.');
    }
    return this.recordValidationInCurrentClient(input, actor);
  }

  private async recordValidationInCurrentClient(input: RecordValidationInput, actor: Actor) {
    await this.ensureProject(input.projectId);
    const claim = input.claimId ? await this.ensureClaim(input.projectId, input.claimId) : null;
    if (input.sourceRefId) await this.ensureSourceRefs([input.sourceRefId], input.projectId);
    const evidence = input.evidenceId
      ? await this.ensureEvidenceForValidation(input.projectId, input.evidenceId, input.claimId)
      : null;

    const validatorType = actor.type ?? 'human';
    if (validatorType === 'ai' && FINAL_VALIDATION_RESULTS.has(input.result)) {
      throw AppError.forbidden(
        'La IA no puede cambiar la validacion autorizada de una afirmacion.',
        'AI_CANNOT_VALIDATE_CLAIM',
        { hint: 'Registra el analisis IA como assessment no autoritativo o usa una validacion humana/regla.' },
      );
    }
    if (FINAL_VALIDATION_RESULTS.has(input.result) && validatorType !== 'human' && validatorType !== 'system') {
      throw AppError.forbidden('ValidatorType no autorizado para validacion final.', 'VALIDATOR_NOT_AUTHORIZED');
    }
    if (input.result === 'supported') {
      this.ensureSupportedValidationInput({ claim, evidence, input });
    }
    if (
      FINAL_VALIDATION_RESULTS.has(input.result)
      && validatorType === 'human'
      && (claim?.createdById === actor.id || (!claim && evidence?.ownerId === actor.id))
    ) {
      throw AppError.forbidden(
        'La validacion final debe realizarla una persona distinta de quien creo el material.',
        'VALIDATOR_INDEPENDENCE_REQUIRED',
      );
    }

    const validationSourceRefId = evidence?.sourceRefId ?? input.sourceRefId;
    if (input.sourceRefId && evidence?.sourceRefId && input.sourceRefId !== evidence.sourceRefId) {
      throw AppError.badRequest('La validacion debe usar el SourceRef de la evidencia.', 'VALIDATION_SOURCE_REF_MISMATCH');
    }

    const db = this.prisma as any;
    if (typeof db.$queryRawUnsafe === 'function') {
      if (input.claimId) {
        await db.$queryRawUnsafe('SELECT id FROM "TruthClaim" WHERE id = $1 FOR UPDATE', input.claimId);
      } else if (input.evidenceId) {
        await db.$queryRawUnsafe('SELECT id FROM "Evidence" WHERE id = $1 FOR UPDATE', input.evidenceId);
      }
    } else if (process.env.NODE_ENV !== 'test') {
      throw AppError.internal('La persistencia de validaciones requiere bloqueo del recurso.');
    }

    const versionScope = input.claimId
      ? { claimId: input.claimId }
      : input.evidenceId
        ? { evidenceId: input.evidenceId }
        : null;
    const latest = versionScope
      ? await this.prisma.truthValidation.findFirst({
          where: versionScope,
          orderBy: { version: 'desc' },
          select: { version: true },
        })
      : null;
    const currentVersion = latest?.version ?? 0;
    if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
      throw AppError.conflict(
        `La validacion cambio: esperabas la version ${input.expectedVersion} y la vigente es ${currentVersion}.`,
        'STALE_VERSION',
      );
    }

    const validation = await this.prisma.truthValidation.create({
      data: {
        projectId: input.projectId,
        claimId: input.claimId,
        evidenceId: input.evidenceId,
        sourceRefId: validationSourceRefId,
        result: input.result,
        validatedById: actor.id,
        validatorType: validatorType === 'system' ? 'system_rule' : validatorType,
        validatorRole: actor.role,
        rationale: input.rationale,
        version: currentVersion + 1,
      },
    });

    if (input.claimId) {
      await this.prisma.truthClaim.update({
        where: { id: input.claimId },
        data: {
          verificationState: CLAIM_STATE_BY_VALIDATION[input.result],
          currentValidationId: validation.id,
        },
      });
    }

    if (input.evidenceId && input.result !== 'unvalidated') {
      await this.prisma.evidence.update({
        where: { id: input.evidenceId },
        data: { truthStatus: EVIDENCE_STATUS_BY_VALIDATION[input.result] },
      });
    }

    return validation;
  }

  async getClaimReadiness(projectId: string, claimId: string) {
    const claim = await this.ensureClaim(projectId, claimId);
    return {
      claimId,
      verificationState: claim.verificationState,
      satisfiesValidatedSupport: claim.verificationState === 'supported',
    };
  }

  async evaluateValidatedSupportBinding(projectId: string, input: ValidatedSupportBindingInput) {
    if (!input.claimId) {
      throw AppError.badRequest('Validated support requiere un Claim persistente.', 'TRUTH_BINDING_CLAIM_REQUIRED');
    }
    if (!input.evidenceIds?.length) {
      throw AppError.badRequest('Validated support requiere Evidence persistente.', 'TRUTH_BINDING_EVIDENCE_REQUIRED');
    }
    if (!input.sourceRefIds?.length) {
      throw AppError.badRequest('Validated support requiere SourceRef persistente.', 'TRUTH_BINDING_SOURCE_REF_REQUIRED');
    }

    const readiness = await this.getClaimReadiness(projectId, input.claimId);
    const evidence = await this.prisma.evidence.findMany({
      where: { id: { in: input.evidenceIds }, projectId },
      select: { id: true, targetClaimId: true, sourceRefId: true, truthStatus: true },
    });
    const foundEvidenceIds = new Set(evidence.map((item: { id: string }) => item.id));
    const missingEvidenceIds = input.evidenceIds.filter((id) => !foundEvidenceIds.has(id));
    if (missingEvidenceIds.length > 0) {
      throw AppError.badRequest('Evidence no encontrada para el proyecto.', 'TRUTH_BINDING_EVIDENCE_NOT_FOUND', {
        details: missingEvidenceIds.map((id) => ({ field: 'evidenceIds', code: 'EVIDENCE_NOT_FOUND', message: id })),
      });
    }

    const sourceRefs = await this.prisma.sourceRef.findMany({
      where: { id: { in: input.sourceRefIds }, projectId },
      select: { id: true, projectId: true },
    });
    const foundSourceRefIds = new Set(sourceRefs.map((item: { id: string }) => item.id));
    const missingSourceRefIds = input.sourceRefIds.filter((id) => !foundSourceRefIds.has(id));
    if (missingSourceRefIds.length > 0) {
      throw AppError.badRequest('SourceRef no encontrado para el proyecto.', 'TRUTH_BINDING_SOURCE_REF_NOT_FOUND', {
        details: missingSourceRefIds.map((id) => ({ field: 'sourceRefIds', code: 'SOURCE_REF_NOT_FOUND', message: id })),
      });
    }

    const boundSourceRefIds = new Set(input.sourceRefIds);
    for (const item of evidence as { id: string; targetClaimId: string | null; sourceRefId: string | null; truthStatus: string | null }[]) {
      if (item.targetClaimId !== input.claimId) {
        throw AppError.badRequest('Evidence no corresponde al Claim del checkpoint.', 'TRUTH_BINDING_EVIDENCE_CLAIM_MISMATCH');
      }
      if (!item.sourceRefId || !boundSourceRefIds.has(item.sourceRefId)) {
        throw AppError.badRequest('Evidence debe estar ligada a uno de los SourceRef persistentes del binding.', 'TRUTH_BINDING_EVIDENCE_SOURCE_MISMATCH');
      }
      if (readiness.satisfiesValidatedSupport && item.truthStatus !== 'supports') {
        throw AppError.badRequest('Evidence no esta marcada como soporte persistente.', 'TRUTH_BINDING_EVIDENCE_NOT_SUPPORTING');
      }
    }

    return {
      ...readiness,
      evidenceIds: input.evidenceIds,
      sourceRefIds: input.sourceRefIds,
    };
  }

  async evaluateEvidenceReferenceBinding(projectId: string, input: EvidenceReferenceBindingInput) {
    if (!input.evidenceIds?.length) {
      throw AppError.badRequest('Evidence reference requiere Evidence persistente.', 'TRUTH_REFERENCE_EVIDENCE_REQUIRED');
    }
    if (!input.sourceRefIds?.length) {
      throw AppError.badRequest('Evidence reference requiere SourceRef persistente.', 'TRUTH_REFERENCE_SOURCE_REF_REQUIRED');
    }

    const evidence = await this.prisma.evidence.findMany({
      where: { id: { in: input.evidenceIds }, projectId },
      select: { id: true, sourceRefId: true },
    });
    const foundEvidenceIds = new Set(evidence.map((item: { id: string }) => item.id));
    const missingEvidenceIds = input.evidenceIds.filter((id) => !foundEvidenceIds.has(id));
    if (missingEvidenceIds.length > 0) {
      throw AppError.badRequest('Evidence no encontrada para el proyecto.', 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND', {
        details: missingEvidenceIds.map((id) => ({ field: 'evidenceIds', code: 'EVIDENCE_NOT_FOUND', message: id })),
      });
    }

    const sourceRefs = await this.prisma.sourceRef.findMany({
      where: { id: { in: input.sourceRefIds }, projectId },
      select: { id: true },
    });
    const foundSourceRefIds = new Set(sourceRefs.map((item: { id: string }) => item.id));
    const missingSourceRefIds = input.sourceRefIds.filter((id) => !foundSourceRefIds.has(id));
    if (missingSourceRefIds.length > 0) {
      throw AppError.badRequest('SourceRef no encontrado para el proyecto.', 'TRUTH_REFERENCE_SOURCE_REF_NOT_FOUND', {
        details: missingSourceRefIds.map((id) => ({ field: 'sourceRefIds', code: 'SOURCE_REF_NOT_FOUND', message: id })),
      });
    }

    const boundSourceRefIds = new Set(input.sourceRefIds);
    for (const item of evidence as { id: string; sourceRefId: string | null }[]) {
      if (!item.sourceRefId || !boundSourceRefIds.has(item.sourceRefId)) {
        throw AppError.badRequest('Evidence debe estar ligada a uno de los SourceRef persistentes del binding.', 'TRUTH_REFERENCE_EVIDENCE_SOURCE_MISMATCH');
      }
    }

    return {
      evidenceIds: input.evidenceIds,
      sourceRefIds: input.sourceRefIds,
    };
  }

  async createAttentionItem(input: CreateAttentionItemInput) {
    await this.ensureProject(input.projectId);
    if (input.sourceRefId) await this.ensureSourceRefs([input.sourceRefId], input.projectId);
    return this.prisma.attentionItem.create({
      data: {
        project: { connect: { id: input.projectId } },
        objectType: input.objectType,
        objectId: input.objectId,
        category: input.category,
        reason: input.reason,
        severity: input.severity,
        sourceRef: input.sourceRefId ? { connect: { id: input.sourceRefId } } : undefined,
        ownerId: input.ownerId,
        exitCondition: input.exitCondition,
        nextAction: input.nextAction,
      },
    });
  }

  async listAttentionItems(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.attentionItem.findMany({
      where: { projectId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async resolveAttentionItem(projectId: string, id: string, input: ResolveAttentionItemInput, actor: Actor) {
    const existing = await this.prisma.attentionItem.findFirst({ where: { id, projectId } });
    if (!existing) throw AppError.notFound('Bloqueo', 'ATTENTION_ITEM_NOT_FOUND');
    if (existing.status === 'resolved' || existing.status === 'cancelled') {
      throw AppError.conflict('El bloqueo ya tiene un cierre explicito.', 'ATTENTION_ITEM_ALREADY_CLOSED');
    }
    return this.prisma.attentionItem.update({
      where: { id },
      data: {
        status: input.status,
        resolutionNote: input.resolutionNote,
        resolvedById: actor.id,
        resolvedAt: new Date(),
      },
    });
  }

  async createImpactAssertion(input: CreateImpactAssertionInput, actor: Actor) {
    await this.ensureProject(input.projectId);
    if (input.claimId) await this.ensureClaim(input.projectId, input.claimId);
    if (input.sourceRefId) await this.ensureSourceRefs([input.sourceRefId], input.projectId);
    return this.prisma.impactAssertion.create({
      data: {
        projectId: input.projectId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        claimId: input.claimId,
        metric: input.metric,
        valueJson: input.valueJson === undefined ? undefined : input.valueJson as Prisma.InputJsonValue,
        status: input.status,
        sourceRefId: input.sourceRefId,
        createdById: actor.id,
      },
    });
  }

  async transitionImpact(projectId: string, id: string, input: TransitionImpactInput, actor: Actor) {
    const current = await this.prisma.impactAssertion.findFirst({ where: { id, projectId } });
    if (!current) throw AppError.notFound('Impacto', 'IMPACT_ASSERTION_NOT_FOUND');

    const requestedValidationId = input.validationId ?? current.validationId ?? undefined;
    if (input.status === 'realized') {
      if (current.status !== 'validated') {
        throw AppError.conflict(
          'El impacto no puede pasar directo a realizado sin una transicion validada previa.',
          'IMPACT_REALIZED_REQUIRES_VALIDATED',
        );
      }
      await this.ensureImpactValidation(projectId, current, requestedValidationId);
    }
    if (input.status === 'validated') {
      await this.ensureImpactValidation(projectId, current, input.validationId);
    }

    return this.prisma.impactAssertion.update({
      where: { id },
      data: {
        status: input.status,
        validationId: requestedValidationId,
        transitionedById: actor.id,
        transitionedAt: new Date(),
      },
    });
  }

  private async ensureProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
    return project;
  }

  private async ensureClaim(projectId: string, id: string) {
    const claim = await this.prisma.truthClaim.findFirst({ where: { id, projectId } });
    if (!claim) throw AppError.notFound('Claim', 'TRUTH_CLAIM_NOT_FOUND');
    return claim;
  }

  private async ensureEvidence(projectId: string, id: string) {
    const evidence = await this.prisma.evidence.findFirst({ where: { id, projectId } });
    if (!evidence) throw AppError.notFound('Evidencia', 'EVIDENCE_NOT_FOUND');
    return evidence;
  }

  private async ensureEvidenceForValidation(projectId: string, id: string, claimId?: string) {
    const evidence = await this.prisma.evidence.findFirst({
      where: { id, projectId },
      include: { sourceRef: true, targetClaim: true },
    });
    if (!evidence) throw AppError.notFound('Evidencia', 'EVIDENCE_NOT_FOUND');
    if (claimId && evidence.targetClaimId !== claimId) {
      throw AppError.badRequest('La evidencia no esta ligada al Claim validado.', 'EVIDENCE_CLAIM_MISMATCH');
    }
    if (evidence.sourceRefId && !evidence.sourceRef) {
      throw AppError.badRequest('La evidencia no tiene SourceRef real.', 'EVIDENCE_SOURCE_REF_NOT_FOUND');
    }
    if (evidence.sourceRef?.projectId && evidence.sourceRef.projectId !== projectId) {
      throw AppError.badRequest('La evidencia usa SourceRef de otro proyecto.', 'EVIDENCE_SOURCE_PROJECT_MISMATCH');
    }
    return evidence;
  }

  private async ensureSourceRefs(ids: string[], projectId: string) {
    const found = await this.prisma.sourceRef.findMany({
      where: { id: { in: ids }, OR: [{ projectId }, { projectId: null }] },
      select: { id: true },
    });
    const foundIds = new Set(found.map((item: { id: string }) => item.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw AppError.badRequest('SourceRef no encontrado para el proyecto.', 'SOURCE_REF_NOT_FOUND', {
        details: missing.map((id) => ({ field: 'sourceRefId', code: 'SOURCE_REF_NOT_FOUND', message: id })),
      });
    }
  }

  private ensureSupportedValidationInput({
    claim,
    evidence,
    input,
  }: {
    claim: Awaited<ReturnType<TruthService['ensureClaim']>> | null;
    evidence: Awaited<ReturnType<TruthService['ensureEvidenceForValidation']>> | null;
    input: RecordValidationInput;
  }) {
    if (!input.claimId || !claim) {
      throw AppError.badRequest('Supported requiere un Claim real del proyecto.', 'SUPPORTED_CLAIM_REQUIRED');
    }
    if (!input.evidenceId || !evidence) {
      throw AppError.badRequest('Supported requiere Evidence real.', 'SUPPORTED_EVIDENCE_REQUIRED');
    }
    if (evidence.targetClaimId !== input.claimId) {
      throw AppError.badRequest('Supported requiere Evidence ligada al Claim.', 'SUPPORTED_EVIDENCE_CLAIM_MISMATCH');
    }
    if (!evidence.sourceRefId || !evidence.sourceRef) {
      throw AppError.badRequest('Supported requiere Evidence con SourceRef real.', 'SUPPORTED_SOURCE_REF_REQUIRED');
    }
    if (evidence.truthStatus !== 'supports') {
      throw AppError.badRequest('Supported requiere Evidence marcada como supports.', 'SUPPORTED_EVIDENCE_STATUS_INVALID');
    }
  }

  private async ensureImpactValidation(
    projectId: string,
    impact: { claimId: string | null; subjectType: string; subjectId: string | null },
    validationId?: string | null,
  ) {
    if (!validationId) {
      throw AppError.badRequest('ImpactStatus validated/realized requiere validationId real.', 'IMPACT_VALIDATION_REQUIRED');
    }
    const validation = await this.prisma.truthValidation.findFirst({
      where: { id: validationId, projectId },
      include: { claim: true, evidence: { include: { sourceRef: true } } },
    });
    if (!validation) throw AppError.notFound('TruthValidation', 'IMPACT_VALIDATION_NOT_FOUND');
    if (validation.result !== 'supported') {
      throw AppError.badRequest('ImpactStatus validated requiere una validacion supported.', 'IMPACT_VALIDATION_RESULT_INVALID');
    }
    if (impact.claimId && validation.claimId !== impact.claimId) {
      throw AppError.badRequest('La validacion no corresponde al Claim del impacto.', 'IMPACT_VALIDATION_CLAIM_MISMATCH');
    }
    if (!validation.claimId || !validation.claim) {
      throw AppError.badRequest('La validacion no tiene Claim real.', 'IMPACT_VALIDATION_CLAIM_REQUIRED');
    }
    if (!validation.evidenceId || !validation.evidence) {
      throw AppError.badRequest('La validacion no tiene Evidence real.', 'IMPACT_VALIDATION_EVIDENCE_REQUIRED');
    }
    if (validation.evidence.targetClaimId !== validation.claimId) {
      throw AppError.badRequest('La Evidence de la validacion no corresponde al Claim.', 'IMPACT_VALIDATION_EVIDENCE_CLAIM_MISMATCH');
    }
    if (!validation.evidence.sourceRefId || !validation.evidence.sourceRef) {
      throw AppError.badRequest('La Evidence de la validacion no tiene SourceRef real.', 'IMPACT_VALIDATION_SOURCE_REQUIRED');
    }
    if (validation.evidence.truthStatus !== 'supports') {
      throw AppError.badRequest('La Evidence de la validacion no soporta el Claim.', 'IMPACT_VALIDATION_EVIDENCE_STATUS_INVALID');
    }
    return validation;
  }
}
