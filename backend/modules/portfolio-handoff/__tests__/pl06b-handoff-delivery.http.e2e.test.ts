import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';
import { mailer } from '../../../shared/mail/mailer';

const suite = process.env.PL06B_HTTP_E2E === '1' ? describe : describe.skip;
const prisma = new PrismaClient(process.env.E2E_DATABASE_URL ? { datasources: { db: { url: process.env.E2E_DATABASE_URL } } } : undefined);
const ids = {
  organization: 'pl06b-e2e-org', otherOrganization: 'pl06b-e2e-other-org', lead: 'pl06b-e2e-lead', otherLead: 'pl06b-e2e-other-lead', existingOwner: 'pl06b-e2e-existing-owner',
  front: 'pl06b-e2e-front', challenge: 'pl06b-e2e-challenge', brief: 'pl06b-e2e-brief', version: 'pl06b-e2e-brief-v1',
  project: 'pl06b-e2e-canonical-project', first: 'pl06b-e2e-assignment-1', second: 'pl06b-e2e-assignment-2', untouched: 'pl06b-e2e-assignment-3',
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
      if (smtpCalls === 2) throw new Error('simulated sandbox rejection');
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
    expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: { in: [ids.first, ids.second] } } })).toBe(3);
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

  afterAll(async () => { vi.restoreAllMocks(); await prisma.$disconnect(); });
});
