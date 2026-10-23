/**
 * ADR-008 bounded Portfolio API. Canonical Brief versions remain server-side;
 * this router deliberately does not expose mutation to an assignment recipient.
 */
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { AppError } from '../../shared/errors/AppError';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { resolvePortfolioScope } from '../portfolio/portfolio-scope';
import { challengeOrganization, scopeAllows } from '../portfolio/portfolio-resource-guard';
import { PortfolioHandoffAssignmentService } from './application/portfolio-handoff-assignment.service';
import { PortfolioHandoffAssignmentError } from './application/portfolio-handoff-assignment.errors';
import { DurableHandoffEventPort, PortfolioHandoffProjector } from './application/portfolio-handoff-semantic-event.projector';
import { PrismaPortfolioHandoffAssignmentRepository } from './infrastructure/prisma-portfolio-handoff-assignment.repository';
import { PrismaHandoffSemanticEventRepository, PrismaPortfolioHandoffProjectionRepository } from './infrastructure/prisma-portfolio-handoff-semantic-event.repository';
import { assertConfirmableActivationBriefVersion, isRetryableActivationBriefWriteConflict, normalizeActivationBriefEnvelope } from './challenge-activation-brief.service';
import { ImportedInitiativeCanonicalizationService } from './imported-initiative-canonicalization.service';
import {
  activationBriefChallengeParamsSchema,
  activationBriefDraftBodySchema,
  activationBriefParamsSchema,
  activationBriefVersionParamsSchema,
  emptyActivationBriefCommandBodySchema,
  handoffAssignmentParamsSchema,
  importedInitiativeParamsSchema,
  linkImportedInitiativeBodySchema,
  prepareChallengeAssignmentBodySchema,
  registerImportedInitiativeBodySchema,
  updateChallengeAssignmentBodySchema,
} from './challenge-activation-brief.schemas';

const write = requirePermission('portfolio:write');

function idem(req: any): string {
  const value = req.get('Idempotency-Key');
  if (typeof value !== 'string' || !value.trim()) throw AppError.badRequest('Idempotency key requerida', 'ACTIVATION_BRIEF_IDEMPOTENCY_REQUIRED');
  return value.trim();
}
function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}
function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out: any, key) => { out[key] = normalize(value[key]); return out; }, {});
  return value;
}
async function ownChallenge(req: any, challengeId: string): Promise<string> {
  const user = req.user!;
  const resolved = await challengeOrganization(prisma, challengeId);
  const scope = await resolvePortfolioScope(prisma, user);
  if (!resolved.found || !resolved.organizationId || !scopeAllows(scope, resolved)) throw AppError.notFound('Reto', 'PORTFOLIO_RESOURCE_NOT_FOUND');
  return resolved.organizationId;
}
async function ownVersion(req: any, versionId: string): Promise<any> {
  const version = await (prisma as any).challengeActivationBriefVersion.findUnique({ where: { id: versionId }, include: { brief: true } });
  if (!version) throw AppError.notFound('Version de Brief', 'ACTIVATION_BRIEF_VERSION_NOT_FOUND');
  const organizationId = await ownChallenge(req, version.challengeId);
  if (organizationId !== version.organizationId) throw AppError.notFound('Version de Brief', 'ACTIVATION_BRIEF_VERSION_NOT_FOUND');
  return version;
}
async function receipt(tx: any, input: { organizationId: string; commandType: 'CREATE_BRIEF'|'CREATE_VERSION'|'CONFIRM_VERSION'|'CREATE_ASSIGNMENT'|'UPDATE_ASSIGNMENT'; idempotencyKey: string; actorId: string; fingerprint: string }) {
  const existing = await tx.portfolioActivationCommandReceipt.findUnique({ where: { organizationId_commandType_idempotencyKey: { organizationId: input.organizationId, commandType: input.commandType, idempotencyKey: input.idempotencyKey } } });
  if (existing && existing.fingerprint !== input.fingerprint) throw AppError.conflict('La idempotency key ya se usó con otra solicitud', 'ACTIVATION_BRIEF_IDEMPOTENCY_CONFLICT');
  return existing;
}

async function withSerializableRetry<T>(operation: () => Promise<T>, options: { maxAttempts?: number; retryVersionSequenceConflict?: boolean } = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableActivationBriefWriteConflict(error, options.retryVersionSequenceConflict ?? false);
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }
  throw lastError;
}

export const challengeActivationBriefRouter = Router();
const importedInitiativeService = new ImportedInitiativeCanonicalizationService(prisma);

challengeActivationBriefRouter.post('/challenges/:challengeId/activation-briefs', authenticate, write, async (req: any, res, next) => {
  try {
    const { challengeId } = activationBriefChallengeParamsSchema.parse(req.params);
    const requestBody = activationBriefDraftBodySchema.parse(req.body ?? {});
    const organizationId = await ownChallenge(req, challengeId); const idempotencyKey = idem(req); const body = normalizeActivationBriefEnvelope(requestBody); const fp = fingerprint({ command: 'CREATE_BRIEF', challengeId, body, actorId: req.user.id });
    const data = await withSerializableRetry(() => prisma.$transaction(async (tx: any) => {
      const prior = await receipt(tx, { organizationId, commandType: 'CREATE_BRIEF', idempotencyKey, actorId: req.user.id, fingerprint: fp });
      if (prior) return { brief: await tx.challengeActivationBrief.findUnique({ where: { id: prior.resultBriefId }, include: { versions: true } }), idempotent: true };
      const brief = await tx.challengeActivationBrief.create({ data: { organizationId, challengeId, createdByActorId: req.user.id } });
      const version = await tx.challengeActivationBriefVersion.create({ data: { ...body, organizationId, briefId: brief.id, challengeId: brief.challengeId, versionNumber: 1, createdByActorId: req.user.id } });
      await tx.portfolioActivationCommandReceipt.create({ data: { organizationId, commandType: 'CREATE_BRIEF', idempotencyKey, fingerprint: fp, actorId: req.user.id, resultBriefId: brief.id, resultVersionId: version.id } });
      return { brief: { ...brief, versions: [version] }, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
    res.status(data.idempotent ? 200 : 201).json({ success: true, data });
  } catch (error) { next(error); }
});

// Portfolio Lead needs to recover the canonical brief history after refresh.
// This remains an owned projection: recipients only obtain the immutable Version
// through their authorized handoff invitation.
challengeActivationBriefRouter.get('/challenges/:challengeId/activation-briefs', authenticate, write, async (req: any, res, next) => {
  try {
    const { challengeId } = activationBriefChallengeParamsSchema.parse(req.params);
    const organizationId = await ownChallenge(req, challengeId);
    const briefs = await (prisma as any).challengeActivationBrief.findMany({
      where: { challengeId, organizationId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: briefs });
  } catch (error) { next(error); }
});

challengeActivationBriefRouter.get('/activation-briefs/:briefId', authenticate, write, async (req: any, res, next) => {
  try {
    const { briefId } = activationBriefParamsSchema.parse(req.params);
    const brief = await (prisma as any).challengeActivationBrief.findUnique({ where: { id: briefId }, include: { versions: { orderBy: { versionNumber: 'asc' } } } });
    if (!brief) throw AppError.notFound('Brief', 'ACTIVATION_BRIEF_NOT_FOUND'); await ownChallenge(req, brief.challengeId); res.json({ success: true, data: brief });
  } catch (error) { next(error); }
});

challengeActivationBriefRouter.post('/activation-briefs/:briefId/versions', authenticate, write, async (req: any, res, next) => {
  try {
    const { briefId } = activationBriefParamsSchema.parse(req.params);
    const requestBody = activationBriefDraftBodySchema.parse(req.body ?? {});
    const brief = await (prisma as any).challengeActivationBrief.findUnique({ where: { id: briefId } }); if (!brief) throw AppError.notFound('Brief', 'ACTIVATION_BRIEF_NOT_FOUND');
    const organizationId = await ownChallenge(req, brief.challengeId); const idempotencyKey = idem(req); const body = normalizeActivationBriefEnvelope(requestBody); const fp = fingerprint({ command: 'CREATE_VERSION', briefId: brief.id, body, actorId: req.user.id });
    const data = await withSerializableRetry(() => prisma.$transaction(async (tx: any) => {
      const prior = await receipt(tx, { organizationId, commandType: 'CREATE_VERSION', idempotencyKey, actorId: req.user.id, fingerprint: fp });
      if (prior) return { version: await tx.challengeActivationBriefVersion.findUnique({ where: { id: prior.resultVersionId } }), idempotent: true };
      // Serialize writers before MAX+1. The DB trigger remains the final
      // append-only guard, while this lock makes concurrent valid commands
      // wait and receive consecutive versions instead of a sequence error.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ChallengeActivationBrief" WHERE "id" = ${brief.id} FOR UPDATE`);
      const last = await tx.challengeActivationBriefVersion.findFirst({ where: { briefId: brief.id }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
      const version = await tx.challengeActivationBriefVersion.create({ data: { ...body, organizationId, briefId: brief.id, challengeId: brief.challengeId, versionNumber: (last?.versionNumber ?? 0) + 1, createdByActorId: req.user.id } });
      await tx.portfolioActivationCommandReceipt.create({ data: { organizationId, commandType: 'CREATE_VERSION', idempotencyKey, fingerprint: fp, actorId: req.user.id, resultBriefId: brief.id, resultVersionId: version.id } }); return { version, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }), { retryVersionSequenceConflict: true });
    res.status(data.idempotent ? 200 : 201).json({ success: true, data });
  } catch (error) { next(error); }
});

challengeActivationBriefRouter.post('/activation-brief-versions/:versionId/confirm', authenticate, write, async (req: any, res, next) => {
  try {
    const { versionId } = activationBriefVersionParamsSchema.parse(req.params);
    emptyActivationBriefCommandBodySchema.parse(req.body ?? {});
    const current = await ownVersion(req, versionId); assertConfirmableActivationBriefVersion(current); const idempotencyKey = idem(req); const fp = fingerprint({ command: 'CONFIRM_VERSION', versionId: current.id, actorId: req.user.id });
    const data = await withSerializableRetry(() => prisma.$transaction(async (tx: any) => {
      // Serialize confirmation attempts for the same immutable version. A
      // concurrent retry that started before the first commit is retried on
      // P2034 and then recovers the durable command receipt.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ChallengeActivationBriefVersion" WHERE "id" = ${current.id} FOR UPDATE`);
      const prior = await receipt(tx, { organizationId: current.organizationId, commandType: 'CONFIRM_VERSION', idempotencyKey, actorId: req.user.id, fingerprint: fp });
      if (prior) return { version: await tx.challengeActivationBriefVersion.findUnique({ where: { id: prior.resultVersionId } }), idempotent: true };
      const versionInTransaction = await tx.challengeActivationBriefVersion.findUnique({ where: { id: current.id } });
      if (!versionInTransaction || versionInTransaction.status !== 'DRAFT') throw AppError.conflict('La Version ya está confirmada', 'ACTIVATION_BRIEF_VERSION_NOT_DRAFT');
      const version = await tx.challengeActivationBriefVersion.update({ where: { id: versionInTransaction.id }, data: { status: 'CONFIRMED', confirmedByActorId: req.user.id, confirmedAt: new Date() } });
      await tx.portfolioActivationCommandReceipt.create({ data: { organizationId: current.organizationId, commandType: 'CONFIRM_VERSION', idempotencyKey, fingerprint: fp, actorId: req.user.id, resultBriefId: current.briefId, resultVersionId: version.id } }); return { version, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

challengeActivationBriefRouter.post('/challenges/:challengeId/handoff-assignments', authenticate, write, async (req: any, res, next) => {
  try {
    const { challengeId } = activationBriefChallengeParamsSchema.parse(req.params);
    const body = prepareChallengeAssignmentBodySchema.parse(req.body ?? {});
    const organizationId = await ownChallenge(req, challengeId); const idempotencyKey = idem(req);
    const members = body.members.map((member) => ({ ...member, identityKey: member.identityKey.trim().toLowerCase(), emailNormalized: member.emailNormalized?.toLowerCase() ?? null, role: member.role! }));
    const normalizedBody = { ...body, members };
    const fp = fingerprint({ command: 'CREATE_ASSIGNMENT', challengeId, body: normalizedBody, actorId: req.user.id });
    const data = await withSerializableRetry(() => prisma.$transaction(async (tx: any) => {
      // Serialize preparation for this Challenge before reading the durable
      // receipt so concurrent retries cannot create duplicate Assignments.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Challenge" WHERE "id" = ${challengeId} FOR UPDATE`);
      const prior = await receipt(tx, { organizationId, commandType: 'CREATE_ASSIGNMENT', idempotencyKey, actorId: req.user.id, fingerprint: fp });
      if (prior) return { assignment: await tx.portfolioHandoffAssignment.findUnique({ where: { id: prior.resultAssignmentId }, include: { members: true } }), idempotent: true };
      const version = body.briefVersionId ? await tx.challengeActivationBriefVersion.findUnique({ where: { id: body.briefVersionId } }) : null;
      if (body.briefVersionId && (!version || version.status !== 'CONFIRMED' || version.briefId !== body.briefId || version.challengeId !== challengeId || version.organizationId !== organizationId)) throw AppError.conflict('La Assignment requiere el Brief y la Version confirmada exactos del mismo Reto y tenant', 'ACTIVATION_BRIEF_VERSION_REQUIRED');
      const duplicate = await tx.portfolioHandoffAssignment.findFirst({ where: {
        challengeId,
        organizationId,
        targetKind: body.targetKind,
        state: { notIn: ['REJECTED', 'REVOKED', 'EXPIRED'] },
        ...(body.targetKind === 'EXISTING_INITIATIVE'
          ? { initiativeId: body.initiativeId }
          : { briefVersionId: body.briefVersionId, invitedEmailNormalized: body.invitedEmailNormalized }),
      } });
      if (duplicate) throw AppError.conflict('Ya existe una Assignment activa con la misma identidad de destino', 'HANDOFF_ASSIGNMENT_DUPLICATE');
      const assignmentRepository = new PrismaPortfolioHandoffAssignmentRepository(tx);
      const events = new DurableHandoffEventPort(
        new PrismaHandoffSemanticEventRepository(tx),
        new PortfolioHandoffProjector(new PrismaPortfolioHandoffProjectionRepository(tx)),
      );
      const service = new PortfolioHandoffAssignmentService(assignmentRepository, assignmentRepository, events);
      const assignment = await service.createHandoffAssignment({ organizationId, challengeId, targetKind: body.targetKind, initiativeId: body.initiativeId ?? null, briefVersionId: version?.id ?? null, contextNote: body.contextNote ?? null, invitedEmailNormalized: body.invitedEmailNormalized, invitedIdentityRef: body.invitedIdentityRef ?? null, createdByActorId: req.user.id, members });
      await tx.portfolioActivationCommandReceipt.create({ data: { organizationId, commandType: 'CREATE_ASSIGNMENT', idempotencyKey, fingerprint: fp, actorId: req.user.id, resultBriefId: version?.briefId ?? null, resultVersionId: version?.id ?? null, resultAssignmentId: assignment.id } }); return { assignment, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
    res.status(data.idempotent ? 200 : 201).json({ success: true, data });
  } catch (error) { next(error instanceof PortfolioHandoffAssignmentError ? AppError.badRequest(error.message, error.code) : error); }
});

challengeActivationBriefRouter.patch('/handoff-assignments/:assignmentId/preparation', authenticate, write, async (req: any, res, next) => {
  try {
    const { assignmentId } = handoffAssignmentParamsSchema.parse(req.params);
    const body = updateChallengeAssignmentBodySchema.parse(req.body ?? {});
    const current = await (prisma as any).portfolioHandoffAssignment.findUnique({ where: { id: assignmentId } });
    if (!current) throw AppError.notFound('Assignment', 'HANDOFF_ASSIGNMENT_NOT_FOUND');
    const organizationId = await ownChallenge(req, current.challengeId);
    if (current.organizationId !== organizationId) throw AppError.notFound('Assignment', 'HANDOFF_ASSIGNMENT_NOT_FOUND');
    const idempotencyKey = idem(req);
    const members = body.members.map((member) => ({ ...member, identityKey: member.identityKey.trim().toLowerCase(), emailNormalized: member.emailNormalized?.toLowerCase() ?? null, role: member.role! }));
    const normalizedBody = { ...body, members };
    const fp = fingerprint({ command: 'UPDATE_ASSIGNMENT', assignmentId, body: normalizedBody, actorId: req.user.id });
    const data = await withSerializableRetry(() => prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PortfolioHandoffAssignment" WHERE "id" = ${assignmentId} FOR UPDATE`);
      const prior = await receipt(tx, { organizationId, commandType: 'UPDATE_ASSIGNMENT', idempotencyKey, actorId: req.user.id, fingerprint: fp });
      if (prior) return { assignment: await tx.portfolioHandoffAssignment.findUnique({ where: { id: prior.resultAssignmentId }, include: { members: true, briefVersion: true } }), idempotent: true };
      const locked = await tx.portfolioHandoffAssignment.findUnique({ where: { id: assignmentId } });
      if (!locked || locked.organizationId !== organizationId || locked.state !== 'CREATED' || locked.version !== body.expectedVersion) throw AppError.conflict('La Assignment cambió o ya no se puede editar', 'HANDOFF_ASSIGNMENT_NOT_EDITABLE');
      if (locked.targetKind === 'CHALLENGE') {
        const duplicate = await tx.portfolioHandoffAssignment.findFirst({ where: { id: { not: assignmentId }, challengeId: locked.challengeId, targetKind: 'CHALLENGE', briefVersionId: locked.briefVersionId, invitedEmailNormalized: body.invitedEmailNormalized, state: { notIn: ['REJECTED', 'REVOKED', 'EXPIRED'] } } });
        if (duplicate) throw AppError.conflict('Ya existe una Assignment activa para este destinatario y Brief', 'HANDOFF_ASSIGNMENT_DUPLICATE');
      }
      const assignmentRepository = new PrismaPortfolioHandoffAssignmentRepository(tx);
      const events = new DurableHandoffEventPort(new PrismaHandoffSemanticEventRepository(tx), new PortfolioHandoffProjector(new PrismaPortfolioHandoffProjectionRepository(tx)));
      const service = new PortfolioHandoffAssignmentService(assignmentRepository, assignmentRepository, events);
      const assignment = await service.updateCreatedHandoffAssignment({ assignmentId, expectedVersion: body.expectedVersion, invitedEmailNormalized: body.invitedEmailNormalized, invitedIdentityRef: body.invitedIdentityRef ?? null, contextNote: body.contextNote ?? null, members, actorId: req.user.id });
      await tx.portfolioActivationCommandReceipt.create({ data: { organizationId, commandType: 'UPDATE_ASSIGNMENT', idempotencyKey, fingerprint: fp, actorId: req.user.id, resultBriefId: null, resultVersionId: locked.briefVersionId, resultAssignmentId: assignment.id } });
      return { assignment, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
    res.json({ success: true, data });
  } catch (error) { next(error instanceof PortfolioHandoffAssignmentError ? AppError.badRequest(error.message, error.code) : error); }
});

challengeActivationBriefRouter.post('/challenges/:challengeId/imported-initiatives/:workItemId/register', authenticate, write, async (req: any, res, next) => {
  try {
    const { challengeId, workItemId } = importedInitiativeParamsSchema.parse(req.params);
    const body = registerImportedInitiativeBodySchema.parse(req.body ?? {});
    const organizationId = await ownChallenge(req, challengeId);
    const data = await importedInitiativeService.execute({
      expectedWorkItemUpdatedAt: body.expectedWorkItemUpdatedAt!,
      identityConfirmed: true,
      alignmentConfirmed: true,
      name: body.name,
      description: body.description,
      organizationId,
      challengeId,
      workItemId,
      mode: 'REGISTER_EXISTING',
      actorId: req.user.id,
      idempotencyKey: idem(req),
    });
    res.status(data.idempotent ? 200 : 201).json({ success: true, data });
  } catch (error) { next(error); }
});

challengeActivationBriefRouter.post('/challenges/:challengeId/imported-initiatives/:workItemId/link', authenticate, write, async (req: any, res, next) => {
  try {
    const { challengeId, workItemId } = importedInitiativeParamsSchema.parse(req.params);
    const body = linkImportedInitiativeBodySchema.parse(req.body ?? {});
    const organizationId = await ownChallenge(req, challengeId);
    const data = await importedInitiativeService.execute({
      expectedWorkItemUpdatedAt: body.expectedWorkItemUpdatedAt!,
      identityConfirmed: true,
      alignmentConfirmed: true,
      projectId: body.projectId!,
      organizationId,
      challengeId,
      workItemId,
      mode: 'LINK_EXISTING',
      actorId: req.user.id,
      idempotencyKey: idem(req),
    });
    res.status(data.idempotent ? 200 : 201).json({ success: true, data });
  } catch (error) { next(error); }
});

challengeActivationBriefRouter.get('/challenges/:challengeId/assignable-initiatives', authenticate, write, async (req: any, res, next) => {
  try {
    const { challengeId } = activationBriefChallengeParamsSchema.parse(req.params);
    const organizationId = await ownChallenge(req, challengeId);
    const canonical = await (prisma as any).initiativePortfolioMeta.findMany({
      where: { challengeId, project: { organizationId } },
      include: { project: { include: { owner: { select: { email: true, name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const materializations = await (prisma as any).portfolioOrganizationMaterialization.findMany({ where: { organizationId }, select: { canonicalMappings: true } });
    const importedIds = new Set<string>();
    const otherImportedCategories = new Map<string, 'cross_cutting' | 'outside_objective' | 'ungrouped'>();
    for (const item of materializations) {
      const mappings = item.canonicalMappings as any;
      for (const challenge of Array.isArray(mappings?.challenges) ? mappings.challenges : []) {
        if (challenge?.canonicalId !== challengeId) continue;
        for (const id of Array.isArray(challenge.relatedInitiativeIds) ? challenge.relatedInitiativeIds : []) importedIds.add(String(id));
        const destinations = mappings?.specialDestinations ?? {};
        for (const id of Array.isArray(destinations.crossCuttingInitiativeIds) ? destinations.crossCuttingInitiativeIds : []) otherImportedCategories.set(String(id), 'cross_cutting');
        for (const id of Array.isArray(destinations.outsideObjectiveInitiativeIds) ? destinations.outsideObjectiveInitiativeIds : []) otherImportedCategories.set(String(id), 'outside_objective');
        for (const id of Array.isArray(destinations.ungroupedInitiativeIds) ? destinations.ungroupedInitiativeIds : []) otherImportedCategories.set(String(id), 'ungrouped');
      }
    }
    for (const id of importedIds) otherImportedCategories.delete(id);
    const documentaryIds = [...new Set([...importedIds, ...otherImportedCategories.keys()])];
    const documentaryRecords = documentaryIds.length ? await (prisma as any).portfolioBootstrapWorkItem.findMany({
      where: { id: { in: documentaryIds } },
      select: {
        id: true,
        rawLabel: true,
        proposedName: true,
        proposedPurpose: true,
        currentStateHint: true,
        ownerCandidate: true,
        updatedAt: true,
        sourceType: true,
        sourceRefs: true,
        importBatch: { select: { fileName: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) : [];
    const linkedWorkItems = documentaryIds.length ? new Set((await (prisma as any).portfolioImportedInitiativeLink.findMany({
      where: { organizationId, workItemId: { in: documentaryIds }, status: 'ACTIVE' },
      select: { workItemId: true },
    })).map((item: any) => item.workItemId)) : new Set<string>();
    const toDocumentaryRecord = (item: any) => ({
      id: item.id,
      label: item.proposedName || item.rawLabel,
      purpose: item.proposedPurpose,
      currentState: item.currentStateHint,
      ownerCandidate: item.ownerCandidate,
      sourceType: item.sourceType,
      sourceLabel: item.importBatch?.fileName || (item.sourceType === 'manual_entry' ? 'Registro incorporado manualmente' : 'Fuente documental del portafolio'),
      sourceRefs: item.sourceRefs,
      sourceVersion: item.updatedAt.toISOString(),
    });
    res.json({ success: true, data: {
      canonicalInitiatives: canonical.map((meta: any) => ({ id: meta.project.id, name: meta.project.name, description: meta.project.description, ownerEmail: meta.project.owner?.email ?? null, ownerName: meta.project.owner?.name ?? null, activationStatus: meta.project.activationStatus ?? null, retrospectiveAssessmentStatus: meta.project.retrospectiveAssessmentStatus ?? null })),
      importedRecords: documentaryRecords.filter((item: any) => importedIds.has(item.id) && !linkedWorkItems.has(item.id)).map((item: any) => ({ ...toDocumentaryRecord(item), reason: 'IMPORTED_RECORD_NOT_CANONICAL' })),
      otherImportedRecords: documentaryRecords.filter((item: any) => otherImportedCategories.has(item.id)).map((item: any) => ({ ...toDocumentaryRecord(item), category: otherImportedCategories.get(item.id), reason: 'NOT_RELATED_TO_CHALLENGE' })),
    } });
  } catch (error) { next(error); }
});

challengeActivationBriefRouter.get('/challenges/:challengeId/handoff-assignments', authenticate, write, async (req: any, res, next) => {
  try {
    const organizationId = await ownChallenge(req, req.params.challengeId);
    const assignments = await (prisma as any).portfolioHandoffAssignment.findMany({
      where: { challengeId: req.params.challengeId, organizationId },
      include: { members: true, briefVersion: true, initiative: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: assignments });
  } catch (error) { next(error); }
});
