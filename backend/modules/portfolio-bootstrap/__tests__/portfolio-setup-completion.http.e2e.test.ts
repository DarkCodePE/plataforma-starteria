import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';

const suite = process.env.KAN171_HOME_E2E === '1' ? describe : describe.skip;
const prisma = new PrismaClient(process.env.E2E_DATABASE_URL ? { datasources: { db: { url: process.env.E2E_DATABASE_URL } } } : undefined);
const auth = { Authorization: `Bearer ${generateAccessToken({ sub: 'pl06b-e2e-lead', email: 'pl06b-lead@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'] })}` };
const otherAuth = { Authorization: `Bearer ${generateAccessToken({ sub: 'pl06b-e2e-other-lead', email: 'pl06b-other@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'] })}` };
const base = '/api/v1/portfolio-bootstrap';
const mailpitApi = process.env.PL06B_MAILPIT_API ?? 'http://127.0.0.1:8028/api/v1';

suite('KAN-171 contextual setup completion HTTP + PostgreSQL', () => {
  const app = createApp();

  beforeAll(async () => {
    expect(await prisma.portfolioBootstrapSession.findUnique({ where: { id: 'pl06b-e2e-bootstrap' } })).toBeTruthy();
    await prepareZeroDeliveryScope();
  });

  it('persists an idempotent human completion without sending another email', async () => {
    const messagesBefore = (await (await fetch(`${mailpitApi}/messages`)).json() as any).total;
    const first = await request(app)
      .post(`${base}/sessions/pl06b-e2e-bootstrap/complete-setup`)
      .set(auth)
      .set('Idempotency-Key', 'kan171-complete-primary')
      .send({ confirmed: true })
      .expect(200);
    const persisted = await prisma.portfolioBootstrapSession.findUniqueOrThrow({ where: { id: 'pl06b-e2e-bootstrap' } });
    // The acceptance seed deliberately keeps one SMTP-processed Assignment;
    // the browser journey creates the second SENT item later.
    expect(first.body.data).toMatchObject({ completed: true, summary: { sent: 1 } });
    expect(persisted.setupCompletedAt).toBeTruthy();
    expect(persisted.setupCompletedByActorId).toBe('pl06b-e2e-lead');

    const repeated = await request(app)
      .post(`${base}/sessions/pl06b-e2e-bootstrap/complete-setup`)
      .set(auth)
      .set('Idempotency-Key', 'kan171-complete-primary')
      .send({ confirmed: true })
      .expect(200);
    expect(repeated.body.data.completedAt).toBe(first.body.data.completedAt);
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(messagesBefore);
  });

  it('keeps a scope with zero successful deliveries in configuration', async () => {
    await request(app)
      .post(`${base}/sessions/kan171-zero-session/complete-setup`)
      .set(auth)
      .set('Idempotency-Key', 'kan171-zero-completion')
      .send({ confirmed: true })
      .expect(409);
    expect((await prisma.portfolioBootstrapSession.findUniqueOrThrow({ where: { id: 'kan171-zero-session' } })).setupCompletedAt).toBeNull();
    const current = await request(app).get(`${base}/sessions/current`).set(auth).expect(200);
    expect(current.body.data.bootstrapSession.id).not.toBe('kan171-zero-session');
    expect(current.body.data.bootstrapSession.setupCompletedAt).toBeTruthy();
  });

  it('fails closed across tenants and opens a second context without changing the first front', async () => {
    await request(app)
      .post(`${base}/sessions/pl06b-e2e-bootstrap/complete-setup`)
      .set(otherAuth)
      .set('Idempotency-Key', 'kan171-cross-tenant')
      .send({ confirmed: true })
      .expect(404);
    const frontsBefore = await prisma.strategicFront.count({ where: { organizationId: 'pl06b-e2e-org' } });
    const challengesBefore = await prisma.challenge.count({ where: { strategicFront: { organizationId: 'pl06b-e2e-org' } } });
    const projectsBefore = await prisma.project.count({ where: { organizationId: 'pl06b-e2e-org' } });
    const teamMembersBefore = await prisma.teamMember.count({ where: { project: { organizationId: 'pl06b-e2e-org' } } });
    const assignmentsBefore = await prisma.portfolioHandoffAssignment.count({ where: { organizationId: 'pl06b-e2e-org' } });
    const briefVersionsBefore = await prisma.challengeActivationBriefVersion.count({ where: { organizationId: 'pl06b-e2e-org' } });
    const stepsBefore = await prisma.step.count({ where: { project: { organizationId: 'pl06b-e2e-org' } } });
    const referenceSession = await prisma.portfolioBootstrapSession.findFirstOrThrow({
      where: {
        userId: 'pl06b-e2e-lead', organizationId: 'pl06b-e2e-org', setupCompletedAt: { not: null },
        organizationMaterializations: { some: {} },
      },
      orderBy: { setupCompletedAt: 'desc' },
    });
    const messagesBefore = (await (await fetch(`${mailpitApi}/messages`)).json() as any).total;
    const intent = `kan180-new-front-${process.pid}`;
    const opened = await request(app)
      .post(`${base}/sessions/additional-front`)
      .set(auth)
      .set('Idempotency-Key', intent)
      .send({})
      .expect(200);
    expect(opened.body.data.bootstrapSession.id).not.toBe('pl06b-e2e-bootstrap');
    expect(opened.body.data.bootstrapSession.bootstrapPhase).toBe('B1_ANCHOR');
    expect(opened.body.data.anchor).toMatchObject({
      status: 'anchor_insufficient', contextSummary: null, confirmedBy: null, confirmedAt: null,
      sourceRefs: { organizationalContextReference: { sourceBootstrapSessionId: referenceSession.id, reviewStatus: 'reference_only' } },
    });

    const replay = await request(app)
      .post(`${base}/sessions/additional-front`)
      .set(auth)
      .set('Idempotency-Key', intent)
      .send({})
      .expect(200);
    expect(replay.body.data.bootstrapSession.id).toBe(opened.body.data.bootstrapSession.id);

    const deliberateNext = await request(app)
      .post(`${base}/sessions/additional-front`)
      .set(auth)
      .set('Idempotency-Key', `${intent}-next`)
      .send({})
      .expect(200);
    expect(deliberateNext.body.data.bootstrapSession.id).not.toBe(opened.body.data.bootstrapSession.id);

    await request(app).get(`${base}/sessions/${opened.body.data.bootstrapSession.id}`).set(otherAuth).expect(403);
    expect(await prisma.strategicFront.count({ where: { organizationId: 'pl06b-e2e-org' } })).toBe(frontsBefore);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId: 'pl06b-e2e-org' } } })).toBe(challengesBefore);
    expect(await prisma.project.count({ where: { organizationId: 'pl06b-e2e-org' } })).toBe(projectsBefore);
    expect(await prisma.teamMember.count({ where: { project: { organizationId: 'pl06b-e2e-org' } } })).toBe(teamMembersBefore);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: 'pl06b-e2e-org' } })).toBe(assignmentsBefore);
    expect(await prisma.challengeActivationBriefVersion.count({ where: { organizationId: 'pl06b-e2e-org' } })).toBe(briefVersionsBefore);
    expect(await prisma.step.count({ where: { project: { organizationId: 'pl06b-e2e-org' } } })).toBe(stepsBefore);
    expect((await (await fetch(`${mailpitApi}/messages`)).json() as any).total).toBe(messagesBefore);
    expect((await prisma.portfolioBootstrapSession.findUniqueOrThrow({ where: { id: 'pl06b-e2e-bootstrap' } })).setupCompletedAt).toBeTruthy();
  });

  afterAll(async () => { await prisma.$disconnect(); });
});

async function prepareZeroDeliveryScope() {
  const challengeId = 'kan171-zero-challenge';
  const sessionId = 'kan171-zero-session';
  const proposalId = 'kan171-zero-proposal';
  await prisma.challenge.upsert({
    where: { id: challengeId },
    update: {},
    create: { id: challengeId, strategicFrontId: 'pl06b-e2e-front', title: 'Reto todavía sin envío' },
  });
  await prisma.portfolioBootstrapSession.upsert({
    where: { id: sessionId },
    update: { setupCompletedAt: null, setupCompletedByActorId: null, setupCompletionIdempotencyKey: null },
    create: { id: sessionId, userId: 'pl06b-e2e-lead', organizationId: 'pl06b-e2e-org', status: 'reading_published', bootstrapPhase: 'B5_FIRST_READING', existingWorkStatus: 'no_existing_work' },
  });
  const payload = { summary: 'Scope sin envío', fronts: [{ candidateId: 'zero-front', name: 'PL06B Front', focus: 'Validar gate', rationale: 'Gate', coverage: '0', challenges: [{ candidateId: 'zero-challenge', title: 'Reto todavía sin envío', problem: 'Sin envío', rationale: 'Gate', relatedInitiativeIds: [], evidence: [], gaps: [], overlaps: [] }] }], crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [] };
  await prisma.portfolioOrganizationProposal.upsert({
    where: { id: proposalId }, update: {},
    create: { id: proposalId, bootstrapSessionId: sessionId, organizationId: 'pl06b-e2e-org', version: 1, status: 'materialized', sourceVersion: 'kan171-zero-v1', payloadHash: 'kan171-zero', payload, sourceRefs: [], provenance: {}, reviewedBy: 'pl06b-e2e-lead' },
  });
  await prisma.portfolioOrganizationMaterialization.upsert({
    where: { proposalId }, update: {},
    create: { id: 'kan171-zero-materialization', proposalId, bootstrapSessionId: sessionId, organizationId: 'pl06b-e2e-org', proposalVersion: 1, approvalFingerprint: 'kan171-zero', idempotencyKey: 'kan171-zero-materialize', canonicalMappings: { fronts: [{ candidateId: 'zero-front', canonicalId: 'pl06b-e2e-front' }], challenges: [{ candidateId: 'zero-challenge', canonicalId: challengeId }] }, confirmedBy: 'pl06b-e2e-lead' },
  });
  if (!await prisma.portfolioHandoffAssignment.findUnique({ where: { id: 'kan171-zero-assignment' } })) {
    await prisma.portfolioHandoffAssignment.create({ data: { id: 'kan171-zero-assignment', organizationId: 'pl06b-e2e-org', challengeId, targetKind: 'CHALLENGE', contextNote: 'Guardado sin envío', invitedEmailNormalized: 'zero@starteria.test', createdByActorId: 'pl06b-e2e-lead' } });
  }
}
