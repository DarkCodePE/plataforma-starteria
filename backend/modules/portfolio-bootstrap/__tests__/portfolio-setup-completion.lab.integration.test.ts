import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';
import { PortfolioLabRequestService } from '../../portfolio-lab/portfolio-lab-request.service';

const suite =
  process.env.PORTFOLIO_SETUP_LAB_DB_INTEGRATION === '1' ||
  process.env.PORTFOLIO_BOOTSTRAP_DB_INTEGRATION === '1'
    ? describe
    : describe.skip;
const prisma = new PrismaClient(process.env.E2E_DATABASE_URL
  ? { datasources: { db: { url: process.env.E2E_DATABASE_URL } } }
  : undefined);

const ids = {
  organization: 'kan230-org',
  otherOrganization: 'kan230-other-org',
  actor: 'kan230-lead',
  otherActor: 'kan230-other-lead',
  front: 'kan230-front',
  otherFront: 'kan230-other-front',
  challenge: 'kan230-challenge',
  otherChallenge: 'kan230-other-challenge',
  session: 'kan230-session',
  proposal: 'kan230-proposal',
  materialization: 'kan230-materialization',
  brief: 'kan230-brief',
  briefVersion: 'kan230-brief-version',
  labRequest: 'kan230-lab-request',
  notificationAttempt: 'kan230-notification-attempt',
};

const auth = { Authorization: `Bearer ${generateAccessToken({
  sub: ids.actor, email: 'kan230-lead@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: ids.organization,
} as never)}` };
const otherAuth = { Authorization: `Bearer ${generateAccessToken({
  sub: ids.otherActor, email: 'kan230-other@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: ids.otherOrganization,
} as never)}` };
const endpoint = `/api/v1/portfolio-bootstrap/sessions/${ids.session}/complete-setup`;

suite('KAN-230 Lab-only setup completion HTTP + PostgreSQL', () => {
  const app = createApp();

  beforeAll(seedScope);
  beforeEach(async () => {
    await resetCompletion();
    await seedLabRequest({
      status: 'REQUESTED',
      notificationStatus: 'NOTIFIED',
      acceptedRecipients: ['fabio.merino.97@gmail.com', 'orlandokuanb@gmail.com'],
    });
  });

  it('CA02/06 completes Lab-only once, preserves an audit snapshot and creates no Assignment, Project or Step', async () => {
    const before = await fakeWorkCounts();
    const [first, second] = await Promise.all([
      request(app).post(endpoint).set(auth).set('Idempotency-Key', 'kan230-concurrent').send({ confirmed: true }),
      request(app).post(endpoint).set(auth).set('Idempotency-Key', 'kan230-concurrent').send({ confirmed: true }),
    ]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.data).toMatchObject({
      completed: true,
      completionRoute: 'LAB_NOTIFIED',
      summary: { sent: 0 },
      labSummary: { notified: 1 },
    });
    expect(second.body.data.completedAt).toBe(first.body.data.completedAt);
    expect(await prisma.auditLog.count({
      where: { action: 'portfolio_setup_completed', resource: 'portfolio_setup', resourceId: ids.session },
    })).toBe(1);
    expect(await fakeWorkCounts()).toEqual(before);
  });

  it('CA04 fails closed for terminal, pending or incomplete SMTP evidence', async () => {
    for (const invalid of [
      { status: 'CLOSED' as const, notificationStatus: 'NOTIFIED' as const, acceptedRecipients: ['fabio.merino.97@gmail.com', 'orlandokuanb@gmail.com'] },
      { status: 'REQUESTED' as const, notificationStatus: 'PENDING' as const, acceptedRecipients: ['fabio.merino.97@gmail.com', 'orlandokuanb@gmail.com'] },
      { status: 'REQUESTED' as const, notificationStatus: 'NOTIFIED' as const, acceptedRecipients: ['fabio.merino.97@gmail.com'] },
    ]) {
      await resetCompletion();
      await seedLabRequest(invalid);
      const response = await request(app)
        .post(endpoint)
        .set(auth)
        .set('Idempotency-Key', `kan230-invalid-${invalid.status}-${invalid.notificationStatus}-${invalid.acceptedRecipients.length}`)
        .send({ confirmed: true });
      expect(response.status, JSON.stringify(response.body)).toBe(409);
      expect(response.body.error.code).toBe('PORTFOLIO_SETUP_DELIVERY_REQUIRED');
    }
  });

  it('CA04 keeps the completion endpoint owner and tenant scoped', async () => {
    await request(app)
      .post(endpoint)
      .set(otherAuth)
      .set('Idempotency-Key', 'kan230-cross-tenant')
      .send({ confirmed: true })
      .expect(404);
    expect((await prisma.portfolioBootstrapSession.findUniqueOrThrow({ where: { id: ids.session } })).setupCompletedAt).toBeNull();
  });

  it('CA06 linearizes completion against terminalization without a false positive', async () => {
    const labService = new PortfolioLabRequestService(prisma as any);
    const [completion, terminal] = await Promise.allSettled([
      request(app).post(endpoint).set(auth).set('Idempotency-Key', 'kan230-terminal-race').send({ confirmed: true }),
      labService.transitionStatus({
        organizationId: ids.organization, actorId: ids.actor, requestId: ids.labRequest,
        status: 'CLOSED', idempotencyKey: 'kan230-terminal-race-close',
      }),
    ]);

    expect(terminal.status).toBe('fulfilled');
    expect(completion.status).toBe('fulfilled');
    if (completion.status === 'fulfilled') {
      expect([200, 409]).toContain(completion.value.status);
      const persisted = await prisma.portfolioBootstrapSession.findUniqueOrThrow({ where: { id: ids.session } });
      if (completion.value.status === 200) expect(persisted.setupCompletedAt).toBeTruthy();
      else expect(persisted.setupCompletedAt).toBeNull();
    }
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
});

async function seedScope() {
  await cleanup();
  await prisma.organization.createMany({
    data: [
      { id: ids.organization, name: 'KAN-230 organization', slug: ids.organization },
      { id: ids.otherOrganization, name: 'KAN-230 other organization', slug: ids.otherOrganization },
    ],
    skipDuplicates: true,
  });
  for (const [id, organizationId] of [[ids.actor, ids.organization], [ids.otherActor, ids.otherOrganization]]) {
    await prisma.user.upsert({
      where: { id },
      update: { organizationId, role: 'portfolio_lead', roles: ['portfolio_lead'] },
      create: { id, organizationId, email: `${id}@starteria.test`, name: id, role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'K4', skills: [] },
    });
  }
  await prisma.strategicFront.upsert({
    where: { id: ids.front }, update: { organizationId: ids.organization },
    create: { id: ids.front, name: 'KAN-230 front', organizationId: ids.organization },
  });
  await prisma.strategicFront.upsert({
    where: { id: ids.otherFront }, update: { organizationId: ids.otherOrganization },
    create: { id: ids.otherFront, name: 'KAN-230 other front', organizationId: ids.otherOrganization },
  });
  await prisma.challenge.upsert({
    where: { id: ids.challenge }, update: { strategicFrontId: ids.front },
    create: { id: ids.challenge, title: 'KAN-230 canonical challenge', strategicFrontId: ids.front },
  });
  await prisma.challenge.upsert({
    where: { id: ids.otherChallenge }, update: { strategicFrontId: ids.otherFront },
    create: { id: ids.otherChallenge, title: 'KAN-230 foreign challenge', strategicFrontId: ids.otherFront },
  });
  await prisma.portfolioBootstrapSession.create({
    data: { id: ids.session, userId: ids.actor, organizationId: ids.organization, status: 'reading_published', bootstrapPhase: 'B5_FIRST_READING', existingWorkStatus: 'no_existing_work' },
  });
  await prisma.portfolioOrganizationProposal.create({
    data: {
      id: ids.proposal, bootstrapSessionId: ids.session, organizationId: ids.organization,
      version: 1, status: 'materialized', sourceVersion: 'kan230-v1', payloadHash: 'kan230-payload',
      payload: { summary: 'KAN-230 organization', fronts: [] }, sourceRefs: [], provenance: {}, reviewedBy: ids.actor,
    },
  });
  await prisma.portfolioOrganizationMaterialization.create({
    data: {
      id: ids.materialization, proposalId: ids.proposal, bootstrapSessionId: ids.session,
      organizationId: ids.organization, proposalVersion: 1, approvalFingerprint: 'kan230-approved',
      idempotencyKey: 'kan230-materialize',
      canonicalMappings: { fronts: [{ candidateId: 'front', canonicalId: ids.front }], challenges: [{ candidateId: 'challenge', canonicalId: ids.challenge }] },
      confirmedBy: ids.actor,
    },
  });
  await prisma.challengeActivationBrief.create({
    data: { id: ids.brief, organizationId: ids.organization, challengeId: ids.challenge, createdByActorId: ids.actor },
  });
  await prisma.challengeActivationBriefVersion.create({
    data: {
      id: ids.briefVersion, organizationId: ids.organization, briefId: ids.brief, challengeId: ids.challenge,
      versionNumber: 1, status: 'CONFIRMED', intent: 'Resolver el reto KAN-230', scope: 'Lab-only',
      strategicContextRefs: {}, inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [],
      provenance: { source: 'HUMAN_CONFIRMED' }, createdByActorId: ids.actor,
      confirmedByActorId: ids.actor, confirmedAt: new Date(),
    },
  });
}

async function seedLabRequest(input: {
  status: 'REQUESTED' | 'CLOSED';
  notificationStatus: 'PENDING' | 'NOTIFIED';
  acceptedRecipients: string[];
}) {
  await prisma.portfolioLabNotificationAttempt.deleteMany({ where: { requestId: ids.labRequest } });
  await prisma.portfolioLabRequestHistory.deleteMany({ where: { requestId: ids.labRequest } });
  await prisma.portfolioLabRequest.deleteMany({ where: { id: ids.labRequest } });
  await prisma.portfolioLabRequest.create({
    data: {
      id: ids.labRequest, organizationId: ids.organization, challengeId: ids.challenge,
      briefId: ids.brief, briefVersionId: ids.briefVersion, requesterId: ids.actor,
      consentAt: new Date(), consentPurpose: 'Solicitar contacto humano.', status: input.status,
      notificationStatus: input.notificationStatus, idempotencyKeyHash: 'kan230-key', payloadHash: 'kan230-payload',
      terminalAt: input.status === 'CLOSED' ? new Date() : null,
    },
  });
  await prisma.portfolioLabNotificationAttempt.create({
    data: {
      id: ids.notificationAttempt, requestId: ids.labRequest, actorId: ids.actor,
      idempotencyKeyHash: 'kan230-attempt-key', payloadHash: 'kan230-attempt-payload',
      status: 'ACCEPTED', acceptedRecipients: input.acceptedRecipients, completedAt: new Date(),
    },
  });
}

async function resetCompletion() {
  await prisma.portfolioBootstrapSession.update({
    where: { id: ids.session },
    data: { setupCompletedAt: null, setupCompletedByActorId: null, setupCompletionIdempotencyKey: null },
  });
  await prisma.auditLog.deleteMany({
    where: { action: 'portfolio_setup_completed', resource: 'portfolio_setup', resourceId: ids.session },
  });
}

async function fakeWorkCounts() {
  return {
    assignments: await prisma.portfolioHandoffAssignment.count({ where: { organizationId: ids.organization } }),
    projects: await prisma.project.count({ where: { organizationId: ids.organization } }),
    steps: await prisma.step.count({ where: { project: { organizationId: ids.organization } } }),
  };
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { resourceId: ids.session } });
  await prisma.portfolioLabNotificationAttempt.deleteMany({ where: { requestId: ids.labRequest } });
  await prisma.portfolioLabRequestHistory.deleteMany({ where: { requestId: ids.labRequest } });
  await prisma.portfolioLabRequest.deleteMany({ where: { id: ids.labRequest } });
  await prisma.portfolioOrganizationMaterialization.deleteMany({ where: { id: ids.materialization } });
  await prisma.portfolioOrganizationProposal.deleteMany({ where: { id: ids.proposal } });
  await prisma.portfolioBootstrapSession.deleteMany({ where: { id: ids.session } });
  await prisma.challengeActivationBriefVersion.deleteMany({ where: { id: ids.briefVersion } });
  await prisma.challengeActivationBrief.deleteMany({ where: { id: ids.brief } });
  await prisma.challenge.deleteMany({ where: { id: { in: [ids.challenge, ids.otherChallenge] } } });
  await prisma.strategicFront.deleteMany({ where: { id: { in: [ids.front, ids.otherFront] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.actor, ids.otherActor] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ids.organization, ids.otherOrganization] } } });
}
