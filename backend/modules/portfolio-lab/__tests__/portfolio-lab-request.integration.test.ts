import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';
import {
  PortfolioLabRequestService,
  type PortfolioLabNotifier,
} from '../portfolio-lab-request.service';

const suite = process.env.PORTFOLIO_LAB_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient(process.env.E2E_DATABASE_URL
  ? { datasources: { db: { url: process.env.E2E_DATABASE_URL } } }
  : undefined);

const ids = {
  organization: 'kan226-org',
  otherOrganization: 'kan226-other-org',
  actor: 'kan226-lead',
  sameTenantActor: 'kan226-same-tenant-lead',
  otherActor: 'kan226-other-lead',
  participant: 'kan226-participant',
  front: 'kan226-front',
  otherFront: 'kan226-other-front',
  challenges: ['kan226-challenge-1', 'kan226-challenge-2', 'kan226-challenge-3', 'kan226-challenge-4'],
  otherChallenge: 'kan226-other-challenge',
};

type NotificationOutcome =
  | { acceptedByTransport: true; providerMessageRef: string; acceptedRecipients?: string[]; rejectedRecipients?: string[] }
  | { acceptedByTransport: false; acceptedRecipients?: string[]; rejectedRecipients?: string[] }
  | Error;

class FakeNotifier implements PortfolioLabNotifier {
  enabled = true;
  outcomes: NotificationOutcome[] = [{ acceptedByTransport: true, providerMessageRef: 'smtp-default' }];
  calls: Array<{ to: string[]; subject: string; text: string }> = [];

  async sendWithReceipt(message: { to: string[]; subject: string; text: string }) {
    this.calls.push(message);
    const outcome = this.outcomes.shift() ?? { acceptedByTransport: true, providerMessageRef: 'smtp-fallback' };
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
}

function actorToken(actorId = ids.actor, role = 'portfolio_lead', organizationId = ids.organization) {
  return generateAccessToken({
    sub: actorId,
    email: `${actorId}@starteria.test`,
    role,
    roles: [role],
    organizationId,
  } as never);
}

async function cleanupRequests() {
  await (prisma as any).portfolioLabNotificationAttempt.deleteMany({
    where: { request: { organizationId: { in: [ids.organization, ids.otherOrganization] } } },
  });
  await (prisma as any).portfolioLabRequestHistory.deleteMany({
    where: { request: { organizationId: { in: [ids.organization, ids.otherOrganization] } } },
  });
  await (prisma as any).portfolioLabRequest.deleteMany({
    where: { organizationId: { in: [ids.organization, ids.otherOrganization] } },
  });
}

async function seedBrief(
  challengeId: string,
  organizationId = ids.organization,
  status: 'DRAFT' | 'CONFIRMED' = 'CONFIRMED',
) {
  const suffix = `${challengeId}-${status.toLowerCase()}`;
  const briefId = `kan226-brief-${suffix}`;
  const briefVersionId = `kan226-version-${suffix}`;
  await prisma.challengeActivationBrief.upsert({
    where: { id: briefId },
    update: {},
    create: { id: briefId, organizationId, challengeId, createdByActorId: organizationId === ids.organization ? ids.actor : ids.otherActor },
  });
  await prisma.challengeActivationBriefVersion.upsert({
    where: { id: briefVersionId },
    update: {},
    create: {
      id: briefVersionId,
      organizationId,
      briefId,
      challengeId,
      versionNumber: 1,
      status,
      intent: `Resolver ${challengeId}`,
      scope: 'Solicitud manual Startería Lab',
      strategicContextRefs: { objective: 'KAN-226' },
      inheritedContext: { challengeId },
      constraintsSnapshot: [],
      knownGaps: [],
      sourceRefs: [{ source: 'KAN-226' }],
      provenance: { source: 'HUMAN_CONFIRMED' },
      createdByActorId: organizationId === ids.organization ? ids.actor : ids.otherActor,
      confirmedByActorId: status === 'CONFIRMED' ? (organizationId === ids.organization ? ids.actor : ids.otherActor) : null,
      confirmedAt: status === 'CONFIRMED' ? new Date() : null,
    },
  });
  return { challengeId, briefId, briefVersionId };
}

function createInput(
  target: { challengeId: string; briefId: string; briefVersionId: string },
  idempotencyKey: string,
) {
  return {
    organizationId: ids.organization,
    actorId: ids.actor,
    ...target,
    consentAccepted: true,
    consentPurpose: 'Compartir este Brief confirmado para solicitar una reunión humana con Startería Lab.',
    idempotencyKey,
  };
}

suite('KAN-226 PortfolioLabRequest PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.organization.upsert({
      where: { id: ids.organization }, update: {},
      create: { id: ids.organization, name: 'KAN-226 organization', slug: ids.organization },
    });
    await prisma.organization.upsert({
      where: { id: ids.otherOrganization }, update: {},
      create: { id: ids.otherOrganization, name: 'KAN-226 other organization', slug: ids.otherOrganization },
    });
    for (const [id, organizationId, role] of [
      [ids.actor, ids.organization, 'portfolio_lead'],
      [ids.sameTenantActor, ids.organization, 'portfolio_lead'],
      [ids.otherActor, ids.otherOrganization, 'portfolio_lead'],
      [ids.participant, ids.organization, 'participante'],
    ] as const) {
      await prisma.user.upsert({
        where: { id },
        update: { organizationId, role, roles: [role] },
        create: { id, organizationId, email: `${id}@starteria.test`, name: id, role, roles: [role], initials: 'K2', skills: [] },
      });
    }
    await prisma.strategicFront.upsert({
      where: { id: ids.front }, update: { organizationId: ids.organization },
      create: { id: ids.front, name: 'KAN-226 front', organizationId: ids.organization },
    });
    await prisma.strategicFront.upsert({
      where: { id: ids.otherFront }, update: { organizationId: ids.otherOrganization },
      create: { id: ids.otherFront, name: 'KAN-226 other front', organizationId: ids.otherOrganization },
    });
    for (const challengeId of ids.challenges) {
      await prisma.challenge.upsert({
        where: { id: challengeId }, update: { strategicFrontId: ids.front },
        create: { id: challengeId, title: challengeId, strategicFrontId: ids.front },
      });
    }
    await prisma.challenge.upsert({
      where: { id: ids.otherChallenge }, update: { strategicFrontId: ids.otherFront },
      create: { id: ids.otherChallenge, title: ids.otherChallenge, strategicFrontId: ids.otherFront },
    });
  });

  beforeEach(async () => { await cleanupRequests(); });
  afterAll(async () => { await cleanupRequests(); await prisma.$disconnect(); });

  it('LAB01 persists the exact confirmed Challenge + BriefVersion with actor and consent, then records SMTP acceptance separately', async () => {
    const target = await seedBrief(ids.challenges[0]);
    const notifier = new FakeNotifier();
    notifier.outcomes = [{ acceptedByTransport: true, providerMessageRef: 'smtp-kan226-1' }];
    const service = new PortfolioLabRequestService(prisma as any, notifier);

    const result = await service.create(createInput(target, 'kan226-lab01'));

    expect(result.idempotent).toBe(false);
    expect(result.request).toMatchObject({
      organizationId: ids.organization,
      challengeId: target.challengeId,
      briefId: target.briefId,
      briefVersionId: target.briefVersionId,
      requesterId: ids.actor,
      status: 'REQUESTED',
      notificationStatus: 'NOTIFIED',
      providerMessageRef: 'smtp-kan226-1',
    });
    expect(result.request.consentAt).toBeTruthy();
    expect(notifier.calls).toHaveLength(1);
    expect(notifier.calls[0].to).toEqual([
      'fabio.merino.97@gmail.com',
      'orlandokuanb@gmail.com',
    ]);
    expect(await (prisma as any).portfolioLabRequestHistory.count({ where: { requestId: result.request.id } })).toBeGreaterThanOrEqual(2);
    expect(await (prisma as any).portfolioLabNotificationAttempt.count({ where: { requestId: result.request.id, status: 'ACCEPTED' } })).toBe(1);
  });

  it('LAB02 enforces 0→1→2→3 open requests, rejects the fourth, and a terminal request releases capacity without fake work', async () => {
    const notifier = new FakeNotifier();
    const service = new PortfolioLabRequestService(prisma as any, notifier);
    const targets = await Promise.all(ids.challenges.map((challengeId) => seedBrief(challengeId)));
    const before = {
      projects: await prisma.project.count(),
      assignments: await prisma.portfolioHandoffAssignment.count(),
      steps: await prisma.step.count(),
    };

    const first = await service.create(createInput(targets[0], 'kan226-limit-1'));
    await service.create(createInput(targets[1], 'kan226-limit-2'));
    await service.create(createInput(targets[2], 'kan226-limit-3'));
    await expect(service.create(createInput(targets[3], 'kan226-limit-4'))).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_LAB_OPEN_LIMIT' });
    expect(await (prisma as any).portfolioLabRequest.count({ where: { organizationId: ids.organization } })).toBe(3);

    await service.transitionStatus({
      organizationId: ids.organization,
      actorId: ids.actor,
      requestId: first.request.id,
      status: 'CLOSED',
      idempotencyKey: 'kan226-close-1',
    });
    await expect(service.create(createInput(targets[3], 'kan226-limit-4-after-close'))).resolves.toMatchObject({ idempotent: false });
    expect(await prisma.project.count()).toBe(before.projects);
    expect(await prisma.portfolioHandoffAssignment.count()).toBe(before.assignments);
    expect(await prisma.step.count()).toBe(before.steps);
  });

  it('LAB03 serializes the third slot and deduplicates both idempotent retries and the same active Challenge + BriefVersion', async () => {
    const notifier = new FakeNotifier();
    const service = new PortfolioLabRequestService(prisma as any, notifier);
    const targets = await Promise.all(ids.challenges.map((challengeId) => seedBrief(challengeId)));
    await service.create(createInput(targets[0], 'kan226-race-1'));
    await service.create(createInput(targets[1], 'kan226-race-2'));

    const raced = await Promise.allSettled([
      service.create(createInput(targets[2], 'kan226-race-3a')),
      service.create(createInput(targets[3], 'kan226-race-3b')),
    ]);
    expect(raced.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(raced.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await (prisma as any).portfolioLabRequest.count({ where: { organizationId: ids.organization, status: { notIn: ['CLOSED', 'NOT_PROCEEDING', 'CANCELLED'] } } })).toBe(3);

    await cleanupRequests();
    const [sameA, sameB] = await Promise.all([
      service.create(createInput(targets[0], 'kan226-same-command')),
      service.create(createInput(targets[0], 'kan226-same-command')),
    ]);
    expect(sameA.request.id).toBe(sameB.request.id);
    expect([sameA.idempotent, sameB.idempotent].sort()).toEqual([false, true]);
    const deduplicated = await service.create(createInput(targets[0], 'kan226-same-target-new-key'));
    expect(deduplicated.request.id).toBe(sameA.request.id);
    expect(deduplicated.deduplicated).toBe(true);
    expect(await (prisma as any).portfolioLabRequest.count({ where: { organizationId: ids.organization } })).toBe(1);
  });

  it('LAB04 keeps a request after disabled/failed email and retries safely until SMTP accepts it without claiming human receipt', async () => {
    const target = await seedBrief(ids.challenges[0]);
    const disabled = new FakeNotifier();
    disabled.enabled = false;
    const disabledService = new PortfolioLabRequestService(prisma as any, disabled);
    const created = await disabledService.create(createInput(target, 'kan226-mail-disabled'));
    expect(created.request).toMatchObject({ status: 'REQUESTED', notificationStatus: 'FAILED', providerMessageRef: null });
    expect(disabled.calls).toHaveLength(0);

    const retryNotifier = new FakeNotifier();
    retryNotifier.outcomes = [new Error('smtp unavailable'), { acceptedByTransport: true, providerMessageRef: 'smtp-retry-ok' }];
    const retryService = new PortfolioLabRequestService(prisma as any, retryNotifier);
    const failed = await retryService.retryNotification({ organizationId: ids.organization, actorId: ids.actor, requestId: created.request.id, idempotencyKey: 'kan226-retry-failed' });
    expect(failed.request.notificationStatus).toBe('FAILED');
    const sameFailed = await retryService.retryNotification({ organizationId: ids.organization, actorId: ids.actor, requestId: created.request.id, idempotencyKey: 'kan226-retry-failed' });
    expect(sameFailed.idempotent).toBe(true);
    expect(retryNotifier.calls).toHaveLength(1);
    const accepted = await retryService.retryNotification({ organizationId: ids.organization, actorId: ids.actor, requestId: created.request.id, idempotencyKey: 'kan226-retry-ok' });
    expect(accepted.request).toMatchObject({ status: 'REQUESTED', notificationStatus: 'NOTIFIED', providerMessageRef: 'smtp-retry-ok' });
    expect(accepted.request.status).not.toBe('MEETING_SCHEDULED');
    expect(retryNotifier.calls).toHaveLength(2);
  });

  it('LAB04b claims one concurrent retry, never degrades NOTIFIED, and retries only recipients still pending', async () => {
    const target = await seedBrief(ids.challenges[0]);
    const partial = new FakeNotifier();
    partial.outcomes = [{
      acceptedByTransport: false,
      acceptedRecipients: ['fabio.merino.97@gmail.com'],
      rejectedRecipients: ['orlandokuanb@gmail.com'],
    }];
    const service = new PortfolioLabRequestService(prisma as any, partial);
    const created = await service.create(createInput(target, 'kan226-partial-initial'));
    expect(created.request.notificationStatus).toBe('FAILED');

    let release!: () => void;
    const deliveryGate = new Promise<void>((resolve) => { release = resolve; });
    const retryNotifier: PortfolioLabNotifier & { calls: string[][] } = {
      enabled: true,
      calls: [],
      async sendWithReceipt(message) {
        this.calls.push(message.to);
        await deliveryGate;
        return {
          acceptedByTransport: true,
          acceptedRecipients: [...message.to],
          rejectedRecipients: [],
          providerMessageRef: 'smtp-concurrent-ok',
        };
      },
    };
    const retryService = new PortfolioLabRequestService(prisma as any, retryNotifier);
    const first = retryService.retryNotification({
      organizationId: ids.organization, actorId: ids.actor,
      requestId: created.request.id, idempotencyKey: 'kan226-concurrent-retry-a',
    });
    while (retryNotifier.calls.length === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await retryService.retryNotification({
      organizationId: ids.organization, actorId: ids.actor,
      requestId: created.request.id, idempotencyKey: 'kan226-concurrent-retry-b',
    });
    expect(second.idempotent).toBe(true);
    expect(retryNotifier.calls).toEqual([['orlandokuanb@gmail.com']]);
    release();
    const accepted = await first;
    expect(accepted.request.notificationStatus).toBe('NOTIFIED');
    expect(await (prisma as any).portfolioLabNotificationAttempt.count({
      where: { requestId: created.request.id, status: 'PENDING' },
    })).toBe(0);
  });

  it('LAB05 rejects missing consent, draft/foreign versions and cross-tenant or wrong-role access; GET re-enters owner-scoped history', async () => {
    const confirmed = await seedBrief(ids.challenges[0]);
    const draft = await seedBrief(ids.challenges[1], ids.organization, 'DRAFT');
    const foreign = await seedBrief(ids.otherChallenge, ids.otherOrganization);
    const service = new PortfolioLabRequestService(prisma as any, new FakeNotifier());
    await expect(service.create({ ...createInput(confirmed, 'kan226-no-consent'), consentAccepted: false })).rejects.toMatchObject({ statusCode: 400, code: 'PORTFOLIO_LAB_CONSENT_REQUIRED' });
    await expect(service.create(createInput(draft, 'kan226-draft'))).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.create(createInput(foreign, 'kan226-foreign'))).rejects.toMatchObject({ statusCode: 404 });

    const app = createApp();
    const auth = { Authorization: `Bearer ${actorToken()}` };
    const otherAuth = { Authorization: `Bearer ${actorToken(ids.otherActor, 'portfolio_lead', ids.otherOrganization)}` };
    const participantAuth = { Authorization: `Bearer ${actorToken(ids.participant, 'participante', ids.organization)}` };
    const sameTenantAuth = { Authorization: `Bearer ${actorToken(ids.sameTenantActor, 'portfolio_lead', ids.organization)}` };
    const body = {
      challengeId: confirmed.challengeId,
      briefId: confirmed.briefId,
      briefVersionId: confirmed.briefVersionId,
      consentAccepted: true,
      consentPurpose: 'Solicitar apoyo humano a Startería Lab con este Brief confirmado.',
    };
    await request(app).post('/api/v1/portfolio-lab/requests').set(auth).set('Idempotency-Key', 'kan226-http-client-recipients').send({
      ...body,
      recipients: ['attacker@example.test'],
    }).expect(400);
    const created = await request(app).post('/api/v1/portfolio-lab/requests').set(auth).set('Idempotency-Key', 'kan226-http-create').send(body).expect(201);
    await request(app).get('/api/v1/portfolio-lab/requests').set(auth).expect(200).expect(({ body: responseBody }) => {
      expect(responseBody.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.data.request.id, challengeId: confirmed.challengeId })]));
    });
    await request(app).get(`/api/v1/portfolio-lab/requests/${created.body.data.request.id}`).set(auth).expect(200).expect(({ body: responseBody }) => {
      expect(responseBody.data.history.length).toBeGreaterThanOrEqual(2);
      expect(responseBody.data.notificationAttempts.length).toBeGreaterThanOrEqual(1);
      expect(responseBody.data.notificationAttempts[0]).not.toHaveProperty('acceptedRecipients');
      expect(responseBody.data.notificationAttempts[0]).not.toHaveProperty('rejectedRecipients');
      const serialized = JSON.stringify(responseBody.data);
      expect(serialized).not.toContain('acceptedRecipients');
      expect(serialized).not.toContain('rejectedRecipients');
      expect(serialized).not.toContain('fabio.merino.97@gmail.com');
      expect(serialized).not.toContain('orlandokuanb@gmail.com');
    });
    await request(app).get(`/api/v1/portfolio-lab/requests/${created.body.data.request.id}`).set(otherAuth).expect(404);
    await request(app).get('/api/v1/portfolio-lab/requests').set(sameTenantAuth).expect(200).expect(({ body: responseBody }) => {
      expect(responseBody.data).toEqual([]);
    });
    await request(app).get(`/api/v1/portfolio-lab/requests/${created.body.data.request.id}`).set(sameTenantAuth).expect(404);
    await request(app).post(`/api/v1/portfolio-lab/requests/${created.body.data.request.id}/notification-retry`)
      .set(sameTenantAuth).set('Idempotency-Key', 'kan226-same-tenant-retry').expect(404);
    await request(app).patch(`/api/v1/portfolio-lab/requests/${created.body.data.request.id}/status`)
      .set(sameTenantAuth).set('Idempotency-Key', 'kan226-same-tenant-close').send({ status: 'CLOSED' }).expect(404);
    await request(app).post('/api/v1/portfolio-lab/requests').set(otherAuth).set('Idempotency-Key', 'kan226-http-cross-tenant').send(body).expect(404);
    await request(app).post('/api/v1/portfolio-lab/requests').set(participantAuth).set('Idempotency-Key', 'kan226-http-role').send(body).expect(403);
  });
});
