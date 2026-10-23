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
import { assertConfirmableActivationBriefVersion, normalizeActivationBriefEnvelope } from './challenge-activation-brief.service';
import {
  activationBriefChallengeParamsSchema,
  activationBriefDraftBodySchema,
  activationBriefParamsSchema,
  activationBriefVersionParamsSchema,
  emptyActivationBriefCommandBodySchema,
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
async function receipt(tx: any, input: { organizationId: string; commandType: 'CREATE_BRIEF'|'CREATE_VERSION'|'CONFIRM_VERSION'; idempotencyKey: string; actorId: string; fingerprint: string }) {
  const existing = await tx.portfolioActivationCommandReceipt.findUnique({ where: { organizationId_commandType_idempotencyKey: { organizationId: input.organizationId, commandType: input.commandType, idempotencyKey: input.idempotencyKey } } });
  if (existing && existing.fingerprint !== input.fingerprint) throw AppError.conflict('La idempotency key ya se usÃ³ con otra solicitud', 'ACTIVATION_BRIEF_IDEMPOTENCY_CONFLICT');
  return existing;
}

async function withSerializableRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const prismaCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
      const meta = error && typeof error === 'object' && 'meta' in error && error.meta && typeof error.meta === 'object'
        ? error.meta as { code?: unknown }
        : null;
      const retryable = prismaCode === 'P2034' || (prismaCode === 'P2010' && meta?.code === '40001');
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }
  throw lastError;
}

export const challengeActivationBriefRouter = Router();

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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
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
      if (!versionInTransaction || versionInTransaction.status !== 'DRAFT') throw AppError.conflict('La Version ya estÃ¡ confirmada', 'ACTIVATION_BRIEF_VERSION_NOT_DRAFT');
      const version = await tx.challengeActivationBriefVersion.update({ where: { id: versionInTransaction.id }, data: { status: 'CONFIRMED', confirmedByActorId: req.user.id, confirmedAt: new Date() } });
      await tx.portfolioActivationCommandReceipt.create({ data: { organizationId: current.organizationId, commandType: 'CONFIRM_VERSION', idempotencyKey, fingerprint: fp, actorId: req.user.id, resultBriefId: current.briefId, resultVersionId: version.id } }); return { version, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

