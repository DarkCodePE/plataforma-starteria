import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';
import { mailer } from '../../../shared/mail/mailer';
import { PrismaPortfolioHandoffDeliveryAttemptRepository } from '../infrastructure/prisma-portfolio-handoff-delivery-attempt.repository';
import { PrismaPortfolioHandoffDeliveryBatchRepository } from '../infrastructure/prisma-portfolio-handoff-delivery-batch.repository';
import { PrismaPortfolioHandoffAssignmentRepository } from '../infrastructure/prisma-portfolio-handoff-assignment.repository';
import { PrismaPortfolioHandoffInvitationRepository } from '../infrastructure/prisma-portfolio-handoff-invitation.repository';
import { PortfolioHandoffDeliveryService } from '../application/portfolio-handoff-delivery.service';

const suite = process.env.PL06B_HTTP_E2E === '1' ? describe : describe.skip;
const prisma = new PrismaClient(process.env.E2E_DATABASE_URL ? { datasources: { db: { url: process.env.E2E_DATABASE_URL } } } : undefined);
const ids = {
  organization: 'pl06b-e2e-org', otherOrganization: 'pl06b-e2e-other-org', lead: 'pl06b-e2e-lead', otherLead: 'pl06b-e2e-other-lead', existingOwner: 'pl06b-e2e-existing-owner',
  front: 'pl06b-e2e-front', challenge: 'pl06b-e2e-challenge', brief: 'pl06b-e2e-brief', version: 'pl06b-e2e-brief-v1',
  project: 'pl06b-e2e-canonical-project', first: 'pl06b-e2e-assignment-1', second: 'pl06b-e2e-assignment-2', untouched: 'pl06b-e2e-assignment-3', crossKey: 'pl06b-e2e-assignment-4', ambiguous: 'pl06b-e2e-assignment-5', fenced: 'pl06b-e2e-assignment-6', raceFailure: 'pl06b-e2e-assignment-7',
};
const mailpitApi = process.env.PL06B_MAILPIT_API || 'http://127.0.0.1:8026/api/v1';
const tokenFor = (id: string, email: string) => generateAccessToken({ sub: id, email, role: 'portfolio_lead', roles: ['portfolio_lead'] });

suite('PL-06B HTTP + durable PostgreSQL + SMTP sandbox', () => {
  const app = createApp();
  const auth = { Authorization: `Bearer ${tokenFor(ids.lead, 'pl06b-lead@starteria.test')}` };
  let projectsBefore = 0;
  let stepsBefore = 0;

  beforeAll(async () => {
    await fetch(`${mailpitApi}/messages`, { method: 'DELETE' });
    await prisma.portfolioHandoffDeliveryBatch.deleteMany({ where: { organizationId: { in: [ids.organization, ids.otherOrganization] } } });
    await prisma.portfolioHandoffAssignment.deleteMany({ where: { challengeId: ids.challenge } });
    await prisma.challengeActivationBriefVersion.deleteMany({ where: { id: ids.version } });
    await prisma.challengeActivationBrief.deleteMany({ where: { id: ids.brief } });
    await prisma.organization.upsert({ where: { id: ids.organization }, update: {}, create: { id: ids.organization, name: 'PL06B Acceptance', slug: ids.organization } });
    await prisma.organization.upsert({ where: { id: ids.otherOrganization }, update: {}, create: { id: ids.otherOrganization, name: 'PL06B Other Tenant', slug: ids.otherOrganization } });
    await prisma.user.upsert({ where: { id: ids.lead }, update: { organizationId: ids.organization, role: 'portfolio_lead', roles: ['portfolio_lead'] }, create: { id: ids.lead, email: 'pl06b-lead@starteria.test', name: 'PL06B Lead', initials: 'PL', skills: [], organizationId: ids.organization, role: 'portfolio_lead', roles: ['portfolio_lead'] } });
    await prisma.user.upsert({ where: { id: ids.otherLead }, update: { organizationId: ids.otherOrganization, role: 'portfolio_lead', roles: ['portfolio_lead'] }, create: { id: ids.otherLead, email: 'pl06b-other@starteria.test', name: 'PL06B Other Lead', initials: 'PO', skills: [], organizationId: ids.otherOrganization, role: 'portfolio_lead', roles: ['portfolio_lead'] } });
    await prisma.user.upsert({ where: { id: ids.existingOwner }, update: { organizationId: ids.organization }, create: { id: ids.existingOwner, email: 'pl06b-existing-owner@starteria.test', name: 'PL06B Existing Owner', initials: 'EO', skills: [], organizationId: ids.organization, role: 'colaborador', roles: ['colaborador'] } });
    await prisma.strategicFront.upsert({ where: { id: ids.front }, update: { name: 'PL06B Front', organizationId: ids.organization }, create: { id: ids.front, name: 'PL06B Front', organizationId: ids.organization } });
    await prisma.challenge.upsert({ where: { id: ids.challenge }, update: { strategicFrontId: ids.front, title: 'Reducir friccion de activacion' }, create: { id: ids.challenge, strategicFrontId: ids.front, title: 'Reducir friccion de activacion' } });
    await prisma.project.upsert({ where: { id: ids.project }, update: { organizationId: ids.organization, ownerId: ids.existingOwner }, create: { id: ids.project, name: 'Onboarding guiado canónico', description: 'Iniciativa existente vinculada al reto.', organizationId: ids.organization, ownerId: ids.existingOwner, activationStatus: 'OWNER_CONFIRMED', retrospectiveAssessmentStatus: 'ASSESSED' } });
    await prisma.initiativePortfolioMeta.upsert({ where: { projectId_challengeId: { projectId: ids.project, challengeId: ids.challenge } }, update: { strategicFrontId: ids.front }, create: { id: 'pl06b-e2e-canonical-meta', projectId: ids.project, challengeId: ids.challenge, strategicFrontId: ids.front, teamOwner: 'pl06b-existing-owner@starteria.test' } });
    await prisma.challengeActivationBrief.create({ data: { id: ids.brief, organizationId: ids.organization, challengeId: ids.challenge, createdByActorId: ids.lead } });
    await prisma.challengeActivationBriefVersion.create({ data: {
      id: ids.version, organizationId: ids.organization, briefId: ids.brief, challengeId: ids.challenge, versionNumber: 1, status: 'CONFIRMED',
      intent: 'Priorizar la primera barrera', scope: 'Onboarding inicial', strategicContextRefs: {}, inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: { source: 'PL06B_E2E' },
      createdByActorId: ids.lead, confirmedByActorId: ids.lead, confirmedAt: new Date(),
    } });
    for (const [id, email, context, targetKind] of [
      [ids.first, 'pl06b-recipient-1@starteria.test', 'Contrastar abandono inicial.', 'CHALLENGE'],
      [ids.second, 'pl06b-existing-owner@starteria.test', 'Continuar la iniciativa canónica.', 'EXISTING_INITIATIVE'],
      [ids.untouched, 'pl06b-recipient-3@starteria.test', 'Debe permanecer preparada.', 'CHALLENGE'],
      [ids.crossKey, 'pl06b-recipient-4@starteria.test', 'Una intención bajo dos claves HTTP.', 'CHALLENGE'],
      [ids.ambiguous, 'pl06b-recipient-5@starteria.test', 'Resultado SMTP ambiguo.', 'CHALLENGE'],
      [ids.fenced, 'pl06b-recipient-6@starteria.test', 'Fencing persistente.', 'CHALLENGE'],
      [ids.raceFailure, 'pl06b-recipient-7@starteria.test', 'Fallo concurrente confirmado.', 'CHALLENGE'],
    ] as const) await prisma.portfolioHandoffAssignment.create({ data: {
      id, organizationId: ids.organization, challengeId: ids.challenge, targetKind, initiativeId: targetKind === 'EXISTING_INITIATIVE' ? ids.project : null, briefVersionId: ids.version,
      contextNote: context, invitedEmailNormalized: email, createdByActorId: ids.lead,
      members: { create: [{ identityKey: email, emailNormalized: email, role: 'OWNER' }, { identityKey: `collab-${id}@starteria.test`, emailNormalized: `collab-${id}@starteria.test`, role: 'EXECUTOR' }] },
    } });
    projectsBefore = await prisma.project.count();
    stepsBefore = await prisma.step.count();
  });

  it('sends a selected batch, records a partial failure, retries safely and projects VIEWED without duplicates', async () => {
    const realSend = mailer.send.bind(mailer);
    let smtpCalls = 0;
    const send = vi.spyOn(mailer, 'send').mockImplementation(async (message) => {
      smtpCalls += 1;
      if (smtpCalls === 2) return false;
      return realSend(message);
    });
    const body = { challengeId: ids.challenge, items: [{ assignmentId: ids.first, expectedVersion: 1 }, { assignmentId: ids.second, expectedVersion: 1 }] };
    const first = await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations').set(auth).set('Idempotency-Key', 'pl06b-e2e-batch-1').send(body).expect(207);
    expect(first.body.data).toMatchObject({ status: 'PARTIAL', succeededCount: 1, failedCount: 1 });
    expect(await prisma.portfolioHandoffAssignment.findUnique({ where: { id: ids.first } })).toMatchObject({ state: 'SENT' });
    expect(await prisma.portfolioHandoffAssignment.findUnique({ where: { id: ids.second } })).toMatchObject({ state: 'CREATED' });
    expect(await prisma.portfolioHandoffAssignment.findUnique({ where: { id: ids.second } })).toMatchObject({ targetKind: 'EXISTING_INITIATIVE', initiativeId: ids.project, briefVersionId: ids.version });
    expect(await prisma.portfolioHandoffAssignment.findUnique({ where: { id: ids.untouched } })).toMatchObject({ state: 'CREATED' });

    const inboxAfterFirst = await (await fetch(`${mailpitApi}/messages`)).json() as any;
    expect(inboxAfterFirst.total).toBe(1);
    const repeated = await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations').set(auth).set('Idempotency-Key', 'pl06b-e2e-batch-1').send(body).expect(207);
    expect(repeated.body.data.id).toBe(first.body.data.id);
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(1);
    await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations').set(auth).set('Idempotency-Key', 'pl06b-e2e-batch-1').send({ challengeId: ids.challenge, items: [{ assignmentId: ids.untouched, expectedVersion: 1 }] }).expect(409);

    const retry = await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations').set(auth).set('Idempotency-Key', 'pl06b-e2e-retry-1').send({ challengeId: ids.challenge, retryOfBatchId: first.body.data.id, items: [{ assignmentId: ids.second, expectedVersion: 1 }] }).expect(200);
    expect(retry.body.data).toMatchObject({ status: 'COMPLETED', succeededCount: 1, failedCount: 0, retryOfBatchId: first.body.data.id });
    const retriedAttempt = await prisma.portfolioHandoffDeliveryAttempt.findFirstOrThrow({ where: { assignmentId: ids.second } });
    expect(await prisma.portfolioHandoffDeliveryAttemptKey.count({ where: { attemptId: retriedAttempt.id } })).toBe(2);
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(2);
    await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations').set(auth).set('Idempotency-Key', 'pl06b-e2e-invalid-retry').send({ challengeId: ids.challenge, retryOfBatchId: first.body.data.id, items: [{ assignmentId: ids.first, expectedVersion: 2 }] }).expect(409);

    const inbox = await (await fetch(`${mailpitApi}/messages`)).json() as any;
    const allMessages = await Promise.all(inbox.messages.map((item: any) => fetch(`${mailpitApi}/message/${item.ID}`).then((response) => response.json())));
    expect(JSON.stringify(allMessages)).toContain('Onboarding guiado canónico');
    expect(JSON.stringify(allMessages)).toContain('Reducir friccion de activacion');
    const message = await (await fetch(`${mailpitApi}/message/${inbox.messages[0].ID}`)).json() as any;
    const serialized = JSON.stringify(message);
    expect(serialized).toContain('Starteria');
    expect(serialized).toContain('Brief confirmado v1');
    const invitationToken = serialized.match(/handoff\\?\/invitations\\?\/([a-f0-9]{64})/)?.[1];
    expect(invitationToken).toBeTruthy();
    await request(app).get(`/api/v1/public/handoff-invitations/${invitationToken}`).expect(200);
    expect(await prisma.portfolioHandoffAssignment.findUnique({ where: { id: inbox.messages[0].To[0].Address.includes('recipient-1') ? ids.first : ids.second } })).toMatchObject({ state: 'VIEWED' });
    expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: { in: [ids.first, ids.second] } } })).toBe(2);
    expect(await prisma.project.count()).toBe(projectsBefore);
    expect(await prisma.step.count()).toBe(stepsBefore);
    send.mockRestore();
  });

  it('fails closed across tenants before sending', async () => {
    const otherAuth = { Authorization: `Bearer ${tokenFor(ids.otherLead, 'pl06b-other@starteria.test')}` };
    const before = (await (await fetch(`${mailpitApi}/messages`)).json() as any).total;
    await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations').set(otherAuth).set('Idempotency-Key', 'pl06b-other-tenant').send({ challengeId: ids.challenge, items: [{ assignmentId: ids.untouched, expectedVersion: 1 }] }).expect(404);
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(before);
  });

  it('replays two concurrent requests for the same batch without 500 or duplicate SMTP', async () => {
    const before = (await (await fetch(`${mailpitApi}/messages`)).json() as any).total;
    const body = { challengeId: ids.challenge, items: [{ assignmentId: ids.untouched, expectedVersion: 1 }] };
    const send = () => request(app)
      .post('/api/v1/portfolio/handoff-assignments/batch/invitations')
      .set(auth)
      .set('Idempotency-Key', 'pl06b-e2e-concurrent-batch')
      .send(body);

    const [first, second] = await Promise.all([send(), send()]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(first.body.data.status).toBe('COMPLETED');
    expect(second.body.data.status).toBe('COMPLETED');
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(before + 1);
  });

  it('sends one email and keeps one active token for concurrent batches with different keys', async () => {
    const before = (await (await fetch(`${mailpitApi}/messages`)).json() as any).total;
    const realSend = mailer.send.bind(mailer);
    let releaseDelivery!: () => void;
    const gate = new Promise<void>((resolve) => { releaseDelivery = resolve; });
    const sendSpy = vi.spyOn(mailer, 'send').mockImplementation(async (message) => {
      await gate;
      return realSend(message);
    });
    const body = { challengeId: ids.challenge, items: [{ assignmentId: ids.crossKey, expectedVersion: 1 }] };
    const send = (key: string) => request(app)
      .post('/api/v1/portfolio/handoff-assignments/batch/invitations')
      .set(auth)
      .set('Idempotency-Key', key)
      .send(body);

    const first = send('pl06b-e2e-cross-key-a').then((response) => response);
    const second = send('pl06b-e2e-cross-key-b').then((response) => response);
    await vi.waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));
    releaseDelivery();
    const responses = await Promise.all([first, second]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0].body.data.id).not.toBe(responses[1].body.data.id);
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(before + 1);
    expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: ids.crossKey } })).toBe(1);
    expect(await prisma.portfolioHandoffInvitation.count({ where: { assignmentId: ids.crossKey, revokedAt: null } })).toBe(1);
    sendSpy.mockRestore();
  });

  it('rejects stale attempt and batch writes after a durable lease claim', async () => {
    const attempts = new PrismaPortfolioHandoffDeliveryAttemptRepository(prisma);
    const batches = new PrismaPortfolioHandoffDeliveryBatchRepository(prisma);
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 30_000);
    const reservedAttempt = await attempts.reserve({
      assignmentId: ids.fenced, channel: 'EMAIL', status: 'UNKNOWN', attemptedAt: now,
      providerMessageRef: null, errorCategory: 'IDEMPOTENCY_RESERVED', idempotencyKey: 'pl06b-fenced-attempt',
      requestFingerprint: 'pl06b-fenced-intent', executionGeneration: 2, executionOwnerId: 'current-attempt-worker', leaseUntil,
    });
    const staleAttempt = await attempts.completeOwned({
      attemptId: reservedAttempt.attempt.id, executionGeneration: 1, executionOwnerId: 'stale-attempt-worker',
      status: 'SUCCEEDED', providerMessageRef: 'must-not-persist', errorCategory: null, attemptedAt: now,
    });
    expect(staleAttempt).toMatchObject({ completed: false, attempt: { status: 'UNKNOWN', executionGeneration: 2, executionOwnerId: 'current-attempt-worker', providerMessageRef: null } });

    const legacyReservation = await attempts.reserve({
      assignmentId: ids.fenced, channel: 'EMAIL', status: 'FAILED', attemptedAt: now,
      providerMessageRef: null, errorCategory: 'IDEMPOTENCY_RESERVED', idempotencyKey: 'pl06b-legacy-reservation',
      requestFingerprint: 'pl06b-legacy-intent', executionGeneration: 0, executionOwnerId: null, leaseUntil: null,
    });
    expect(await attempts.markExpiredUnknown({ attemptId: legacyReservation.attempt.id, observedAt: now }))
      .toMatchObject({ status: 'UNKNOWN', errorCategory: 'DELIVERY_OUTCOME_UNKNOWN', executionGeneration: 0 });

    const reservedBatch = await batches.reserve({
      organizationId: ids.organization, challengeId: ids.challenge, actorId: ids.lead,
      idempotencyKey: 'pl06b-fenced-batch', requestFingerprint: 'pl06b-fenced-batch-intent', retryOfBatchId: null,
      assignmentIds: [ids.fenced], status: 'PROCESSING', results: [], succeededCount: 0, failedCount: 0,
      processingLeaseUntil: new Date(now.getTime() - 1), processingGeneration: 1, processingOwnerId: 'stale-batch-worker', completedAt: null,
    });
    const reclaimed = await batches.reclaimProcessing({ batchId: reservedBatch.batch.id, staleBefore: now, leaseUntil, executionOwnerId: 'current-batch-worker' });
    const staleBatch = await batches.saveProgress({
      batchId: reservedBatch.batch.id, executionGeneration: 1, executionOwnerId: 'stale-batch-worker', observedAt: now,
      results: [{ assignmentId: ids.fenced, status: 'SUCCEEDED', state: 'SENT', errorCategory: null, providerMessageRef: 'must-not-persist' }],
      status: 'COMPLETED', completedAt: now, processingLeaseUntil: null,
    });
    expect(reclaimed).toMatchObject({ reclaimed: true, batch: { processingGeneration: 2, processingOwnerId: 'current-batch-worker' } });
    expect(staleBatch).toMatchObject({ saved: false, batch: { status: 'PROCESSING', results: [], processingGeneration: 2, processingOwnerId: 'current-batch-worker' } });
  });

  it('binds both concurrent keys to a confirmed failed intent and prevents either key from being reused', async () => {
    const attempts = new PrismaPortfolioHandoffDeliveryAttemptRepository(prisma);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let transportCalls = 0;
    const service = new PortfolioHandoffDeliveryService(
      new PrismaPortfolioHandoffAssignmentRepository(prisma),
      new PrismaPortfolioHandoffInvitationRepository(prisma),
      attempts,
      { send: async () => { transportCalls += 1; await gate; return { delivered: false }; } },
    );
    const base = { assignmentId: ids.raceFailure, title: 'Misma intención', whyItMatters: 'Fallo confirmado' };
    const first = service.sendHandoffInvitation({ ...base, idempotencyKey: 'pl06b-failed-race-a' });
    const second = service.sendHandoffInvitation({ ...base, idempotencyKey: 'pl06b-failed-race-b' });
    await vi.waitFor(() => expect(transportCalls).toBe(1));
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ attemptStatus: 'FAILED', state: 'CREATED' }),
      expect.objectContaining({ attemptStatus: 'FAILED', state: 'CREATED' }),
    ]);
    const attempt = await prisma.portfolioHandoffDeliveryAttempt.findFirstOrThrow({ where: { assignmentId: ids.raceFailure } });
    expect(await prisma.portfolioHandoffDeliveryAttemptKey.count({ where: { attemptId: attempt.id } })).toBe(2);
    await expect(service.sendHandoffInvitation({ ...base, title: 'Contenido distinto', idempotencyKey: 'pl06b-failed-race-a' }))
      .rejects.toMatchObject({ code: 'HANDOFF_IDEMPOTENCY_CONFLICT' });
    await expect(service.sendHandoffInvitation({ ...base, title: 'Contenido distinto', idempotencyKey: 'pl06b-failed-race-b' }))
      .rejects.toMatchObject({ code: 'HANDOFF_IDEMPOTENCY_CONFLICT' });
    expect(transportCalls).toBe(1);
  });

  it('does not resend after SMTP accepted but the transport response was lost', async () => {
    const before = (await (await fetch(`${mailpitApi}/messages`)).json() as any).total;
    const realSend = mailer.send.bind(mailer);
    const sendSpy = vi.spyOn(mailer, 'send').mockImplementationOnce(async (message) => {
      await realSend(message);
      throw new Error('simulated crash after SMTP acceptance');
    });
    const body = { challengeId: ids.challenge, items: [{ assignmentId: ids.ambiguous, expectedVersion: 1 }] };

    const first = await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations')
      .set(auth).set('Idempotency-Key', 'pl06b-e2e-ambiguous-a').send(body).expect(207);
    expect(first.body.data).toMatchObject({ status: 'RECONCILIATION_REQUIRED', succeededCount: 0, failedCount: 0 });
    expect(first.body.data.results).toEqual([expect.objectContaining({ assignmentId: ids.ambiguous, status: 'UNKNOWN', errorCategory: 'DELIVERY_OUTCOME_UNKNOWN' })]);
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(before + 1);

    const second = await request(app).post('/api/v1/portfolio/handoff-assignments/batch/invitations')
      .set(auth).set('Idempotency-Key', 'pl06b-e2e-ambiguous-b').send(body).expect(207);
    expect(second.body.data).toMatchObject({ status: 'RECONCILIATION_REQUIRED' });
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(before + 1);
    const attempt = await prisma.portfolioHandoffDeliveryAttempt.findFirstOrThrow({ where: { assignmentId: ids.ambiguous } });
    expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: ids.ambiguous } })).toBe(1);
    expect(await prisma.portfolioHandoffDeliveryAttemptKey.count({ where: { attemptId: attempt.id } })).toBe(2);
    expect(await prisma.portfolioHandoffInvitation.count({ where: { assignmentId: ids.ambiguous, revokedAt: null } })).toBe(1);
    expect(await prisma.portfolioHandoffAssignment.findUnique({ where: { id: ids.ambiguous } })).toMatchObject({ state: 'CREATED' });
    let unexpectedTransportCalls = 0;
    const directService = new PortfolioHandoffDeliveryService(
      new PrismaPortfolioHandoffAssignmentRepository(prisma),
      new PrismaPortfolioHandoffInvitationRepository(prisma),
      new PrismaPortfolioHandoffDeliveryAttemptRepository(prisma),
      { send: async () => { unexpectedTransportCalls += 1; return { delivered: true }; } },
    );
    await expect(directService.sendHandoffInvitation({
      assignmentId: ids.ambiguous,
      idempotencyKey: `pl06b-e2e-ambiguous-b:${ids.ambiguous}`,
      title: 'Contenido distinto tras UNKNOWN',
    })).rejects.toMatchObject({ code: 'HANDOFF_IDEMPOTENCY_CONFLICT' });
    expect(unexpectedTransportCalls).toBe(0);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    sendSpy.mockRestore();
  });

  afterAll(async () => { vi.restoreAllMocks(); await prisma.$disconnect(); });
});
