import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';
import { mailer } from '../../../shared/mail/mailer';

const suite = process.env.P12_R1_BRIEF_HTTP_E2E === '1' ? describe : describe.skip;
// This suite is opt-in because it needs migrated PostgreSQL. Do not require a
// URL merely to discover a skipped suite in the normal unit command.
const prisma = new PrismaClient(process.env.E2E_DATABASE_URL
  ? { datasources: { db: { url: process.env.E2E_DATABASE_URL } } }
  : undefined);
const ids = { lead: 'p12r1-http-lead', otherLead: 'p12r1-http-other-lead', recipient: 'p12r1-http-recipient', front: 'p12r1-http-front', challenge: 'p12r1-http-challenge', pl05Challenge: 'p12r1-http-pl05-challenge', multiBriefChallenge: 'p12r1-http-multi-brief-challenge', initiative: 'p12r1-http-initiative', unlinkedInitiative: 'p12r1-http-unlinked-initiative' };
const token = () => generateAccessToken({ sub: ids.lead, email: 'p12r1-http-lead@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'] });
const completeBody = (intent = 'Validate a safe pilot') => ({
  intent, scope: 'One team and its related initiatives',
  strategicContextRefs: { objective: 'Improve activation', challengeId: ids.challenge },
  inheritedContext: { challengeProblem: 'Users stop early', expectedDeliverable: 'Prioritized recommendation', decisionToEnable: 'Choose the first barrier', horizon: null },
  constraintsSnapshot: ['legal'], knownGaps: ['baseline unknown'], sourceRefs: [{ source: 'test' }], provenance: { source: 'PL05_COPILOT' },
});

suite('P12-R1 ADR-008 HTTP lifecycle', () => {
  const app = createApp();
  beforeAll(async () => {
    await prisma.portfolioActivationCommandReceipt.deleteMany({ where: { organizationId: 'p12r1-http-org' } });
    await prisma.portfolioHandoffAssignment.deleteMany({ where: { challengeId: { in: [ids.challenge, ids.pl05Challenge, ids.multiBriefChallenge] } } });
    await prisma.initiativePortfolioMeta.deleteMany({ where: { projectId: { in: [ids.initiative, ids.unlinkedInitiative] } } });
    await prisma.project.deleteMany({ where: { id: { in: [ids.initiative, ids.unlinkedInitiative] } } });
    await prisma.challengeActivationBriefVersion.deleteMany({ where: { challengeId: { in: [ids.challenge, ids.pl05Challenge, ids.multiBriefChallenge] } } });
    await prisma.challengeActivationBrief.deleteMany({ where: { challengeId: { in: [ids.challenge, ids.pl05Challenge, ids.multiBriefChallenge] } } });
    await prisma.challenge.deleteMany({ where: { id: { in: [ids.challenge, ids.pl05Challenge, ids.multiBriefChallenge] } } });
    await prisma.strategicFront.deleteMany({ where: { id: ids.front } });
    await prisma.organization.upsert({ where: { id: 'p12r1-http-org' }, update: {}, create: { id: 'p12r1-http-org', name: 'P12 HTTP organization', slug: 'p12r1-http-org' } });
    await prisma.organization.upsert({ where: { id: 'p12r1-http-other-org' }, update: {}, create: { id: 'p12r1-http-other-org', name: 'P12 HTTP other organization', slug: 'p12r1-http-other-org' } });
    await prisma.user.upsert({ where: { id: ids.lead }, update: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: 'p12r1-http-org' }, create: { id: ids.lead, email: 'p12r1-http-lead@starteria.test', name: 'P12 HTTP Lead', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'PH', skills: [], organizationId: 'p12r1-http-org' } });
    await prisma.user.upsert({ where: { id: ids.otherLead }, update: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: 'p12r1-http-other-org' }, create: { id: ids.otherLead, email: 'p12r1-http-other-lead@starteria.test', name: 'P12 HTTP Other Lead', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'PO', skills: [], organizationId: 'p12r1-http-other-org' } });
    await prisma.user.upsert({ where: { id: ids.recipient }, update: { role: 'participante', roles: ['participante'], organizationId: 'p12r1-http-org' }, create: { id: ids.recipient, email: 'p12r1-http-recipient@starteria.test', name: 'P12 HTTP Recipient', role: 'participante', roles: ['participante'], initials: 'PR', skills: [], organizationId: 'p12r1-http-org' } });
    await prisma.strategicFront.create({ data: { id: ids.front, name: 'P12 HTTP front', organizationId: 'p12r1-http-org' } });
    await prisma.challenge.create({ data: { id: ids.challenge, strategicFrontId: ids.front, title: 'P12 HTTP challenge' } });
    await prisma.challenge.create({ data: { id: ids.pl05Challenge, strategicFrontId: ids.front, title: 'P12 HTTP PL05 challenge' } });
    await prisma.challenge.create({ data: { id: ids.multiBriefChallenge, strategicFrontId: ids.front, title: 'P12 HTTP multi-Brief challenge' } });
  });

  it('prepares multiple targets, guards canonical identity and edits CREATED idempotently', async () => {
    const auth = { Authorization: `Bearer ${token()}` };
    const otherTenantToken = generateAccessToken({ sub: ids.otherLead, email: 'p12r1-http-other-lead@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'] });
    const otherTenantAuth = { Authorization: `Bearer ${otherTenantToken}` };
    const createdBrief = await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/activation-briefs`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-brief').send(completeBody('Prepare several independent assignments')).expect(201);
    const brief = createdBrief.body.data.brief;
    const version = brief.versions[0];
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${version.id}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-confirm').send({}).expect(200);
    await prisma.project.createMany({ data: [
      { id: ids.initiative, name: 'Canonical related initiative', ownerId: ids.recipient, organizationId: 'p12r1-http-org' },
      { id: ids.unlinkedInitiative, name: 'Canonical but unrelated initiative', ownerId: ids.recipient, organizationId: 'p12r1-http-org' },
    ] });
    await prisma.initiativePortfolioMeta.create({ data: { projectId: ids.initiative, challengeId: ids.challenge, teamOwner: 'p12r1-http-recipient@starteria.test' } });

    await request(app).get(`/api/v1/portfolio/challenges/${ids.challenge}/assignable-initiatives`).set(auth).expect(200).expect(({ body }) => {
      expect(body.data.canonicalInitiatives).toEqual([expect.objectContaining({ id: ids.initiative })]);
      expect(body.data.canonicalInitiatives).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.unlinkedInitiative })]));
    });
    await request(app).get(`/api/v1/portfolio/challenges/${ids.challenge}/assignable-initiatives`).set(otherTenantAuth).expect(404);

    const challengeBody = {
      targetKind: 'CHALLENGE', initiativeId: null, briefId: brief.id, briefVersionId: version.id,
      contextNote: 'Contrastar la fricción de activación.', invitedEmailNormalized: 'second-owner@starteria.test',
      members: [{ identityKey: 'second-owner@starteria.test', emailNormalized: 'second-owner@starteria.test', role: 'OWNER' }],
    };
    const created = await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-challenge-2').send(challengeBody).expect(201);
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-challenge-duplicate').send(challengeBody).expect(409);
    const nextVersion = await request(app).post(`/api/v1/portfolio/activation-briefs/${brief.id}/versions`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-next-version').send(completeBody('A later confirmed context')).expect(201);
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${nextVersion.body.data.version.id}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-next-version-confirm').send({}).expect(200);
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-cross-version-duplicate').send({
      ...challengeBody,
      briefVersionId: nextVersion.body.data.version.id,
    }).expect(409);

    const assignmentId = created.body.data.assignment.id as string;
    const updateBody = { expectedVersion: 1, contextNote: 'Priorizar las dos primeras semanas.', invitedEmailNormalized: 'second-owner@starteria.test', members: challengeBody.members };
    const updated = await request(app).patch(`/api/v1/portfolio/handoff-assignments/${assignmentId}/preparation`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-update').send(updateBody).expect(200);
    expect(updated.body.data.assignment).toMatchObject({ id: assignmentId, version: 2, state: 'CREATED', contextNote: 'Priorizar las dos primeras semanas.' });
    await request(app).patch(`/api/v1/portfolio/handoff-assignments/${assignmentId}/preparation`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-update').send(updateBody).expect(200).expect(({ body }) => expect(body.data).toMatchObject({ idempotent: true, assignment: { version: 2 } }));
    await request(app).patch(`/api/v1/portfolio/handoff-assignments/${assignmentId}/preparation`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-stale-update').send(updateBody).expect(409);

    const existingBody = { targetKind: 'EXISTING_INITIATIVE', initiativeId: ids.initiative, briefId: null, briefVersionId: null, contextNote: 'Aplicar el aprendizaje al onboarding existente.', invitedEmailNormalized: 'p12r1-http-recipient@starteria.test', members: [{ identityKey: 'p12r1-http-recipient@starteria.test', emailNormalized: 'p12r1-http-recipient@starteria.test', role: 'OWNER' }] };
    const existing = await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-existing').send(existingBody).expect(201).expect(({ body }) => expect(body.data.assignment).toMatchObject({ targetKind: 'EXISTING_INITIATIVE', initiativeId: ids.initiative, briefVersionId: null }));
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-existing-duplicate').send({ ...existingBody, invitedEmailNormalized: 'another@starteria.test', members: [{ identityKey: 'another@starteria.test', emailNormalized: 'another@starteria.test', role: 'OWNER' }] }).expect(409);
    await prisma.portfolioHandoffAssignment.update({ where: { id: existing.body.data.assignment.id }, data: { state: 'REJECTED', rejectedAt: new Date(), rejectedBy: ids.recipient, portfolioResponse: null } });
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-existing-rejected-pending').send({ ...existingBody, invitedEmailNormalized: 'pending@starteria.test', members: [{ identityKey: 'pending@starteria.test', emailNormalized: 'pending@starteria.test', role: 'OWNER' }] }).expect(409);
    await prisma.portfolioHandoffAssignment.update({
      where: { id: existing.body.data.assignment.id },
      data: {
        portfolioResponse: 'Prepararemos un encargo alternativo.',
        portfolioResponseRecordedAt: new Date(),
        portfolioResponseRecordedBy: ids.lead,
      },
    });
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-existing-after-response').send({ ...existingBody, invitedEmailNormalized: 'after-response@starteria.test', members: [{ identityKey: 'after-response@starteria.test', emailNormalized: 'after-response@starteria.test', role: 'OWNER' }] }).expect(201);
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-pl06a-unlinked').send({ ...existingBody, initiativeId: ids.unlinkedInitiative }).expect(400);

    expect(await prisma.portfolioHandoffInvitation.count({ where: { assignment: { id: { in: [assignmentId] } } } })).toBe(0);
    expect(await prisma.portfolioHandoffSemanticEvent.findFirst({ where: { entityId: assignmentId, eventType: 'assignment_preparation_updated' } })).toBeTruthy();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('creates, recovers, confirms and assigns one immutable Brief Version through authenticated HTTP', async () => {
    const auth = { Authorization: `Bearer ${token()}` };
    const key = 'p12r1-http-create-brief';
    const body = completeBody();
    const created = await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/activation-briefs`).set(auth).set('Idempotency-Key', key).send(body).expect(201);
    const repeated = await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/activation-briefs`).set(auth).set('Idempotency-Key', key).send(body).expect(200);
    const brief = created.body.data.brief;
    const version = brief.versions[0];
    expect(repeated.body.data.brief.id).toBe(brief.id);
    await request(app).get(`/api/v1/portfolio/challenges/${ids.challenge}/activation-briefs`).set(auth).expect(200).expect(({ body }) => expect(body.data[0].versions[0].id).toBe(version.id));
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${version.id}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-http-confirm').send({}).expect(200);
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${version.id}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-http-confirm').send({}).expect(200);
    const assignmentBody = {
      briefId: brief.id,
      briefVersionId: version.id,
      invitedEmailNormalized: 'p12r1-http-recipient@starteria.test',
      members: [
        { identityKey: 'p12r1-http-recipient@starteria.test', emailNormalized: 'p12r1-http-recipient@starteria.test', role: 'OWNER' },
        { identityKey: 'p12r1-http-collaborator@starteria.test', emailNormalized: 'p12r1-http-collaborator@starteria.test', role: 'EXECUTOR' },
      ],
    };
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-http-wrong-brief').send({ ...assignmentBody, briefId: 'another-brief' }).expect(409);
    const concurrentAssignments = await Promise.all([0, 1].map(() => request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-http-create-assignment').send(assignmentBody)));
    expect(concurrentAssignments.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(concurrentAssignments[0].body.data.assignment.id).toBe(concurrentAssignments[1].body.data.assignment.id);
    const assignment = concurrentAssignments.find((response) => response.status === 201)!;
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-http-create-assignment').send(assignmentBody).expect(200).expect(({ body }) => expect(body.data.assignment.id).toBe(assignment.body.data.assignment.id));
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).set('Idempotency-Key', 'p12r1-http-create-assignment').send({ ...assignmentBody, invitedEmailNormalized: 'different-owner@starteria.test', members: [{ identityKey: 'different-owner@starteria.test', emailNormalized: 'different-owner@starteria.test', role: 'OWNER' }] }).expect(409);
    expect(assignment.body.data.assignment.briefVersionId).toBe(version.id);
    expect(assignment.body.data.assignment.state).toBe('CREATED');
    expect(assignment.body.data.assignment.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ emailNormalized: 'p12r1-http-recipient@starteria.test', role: 'OWNER' }),
      expect.objectContaining({ emailNormalized: 'p12r1-http-collaborator@starteria.test', role: 'EXECUTOR' }),
    ]));
    expect(await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.challenge, briefVersionId: version.id } })).toBe(1);
    await expect(prisma.portfolioHandoffSemanticEvent.findFirst({ where: { entityId: assignment.body.data.assignment.id, eventType: 'assignment_created' } })).resolves.toBeTruthy();
    await request(app).get(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(auth).expect(200).expect(({ body }) => expect(body.data[0].briefVersion.id).toBe(version.id));
    const otherTenantToken = generateAccessToken({ sub: ids.otherLead, email: 'p12r1-http-other-lead@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'] });
    const otherTenantAuth = { Authorization: `Bearer ${otherTenantToken}` };
    await request(app).get(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(otherTenantAuth).expect(404);
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/handoff-assignments`).set(otherTenantAuth).set('Idempotency-Key', 'p12r1-http-other-assignment').send(assignmentBody).expect(404);

    // The P6 delivery router and recipient projection run against the real
    // disposable database. Only the external SMTP transport is intercepted.
    const send = vi.spyOn(mailer, 'send').mockResolvedValue(true);
    try {
      await request(app).post(`/api/v1/portfolio/handoff-assignments/${assignment.body.data.assignment.id}/invitation`).set(auth).set('Idempotency-Key', 'p12r1-http-send-assignment').send({}).expect(200).expect(({ body }) => expect(body.data).toMatchObject({ state: 'SENT', attemptStatus: 'SUCCEEDED' }));
      await request(app).post(`/api/v1/portfolio/handoff-assignments/${assignment.body.data.assignment.id}/invitation`).set(auth).set('Idempotency-Key', 'p12r1-http-send-assignment').send({}).expect(200).expect(({ body }) => expect(body.data).toMatchObject({ state: 'SENT', attemptStatus: 'IDEMPOTENT' }));
      const text = send.mock.calls[0]?.[0]?.text ?? '';
      const token = text.match(/\/handoff\/invitations\/([a-f0-9]{64})/)?.[1];
      expect(token).toBeTruthy();
      const recipientToken = generateAccessToken({ sub: ids.recipient, email: 'p12r1-http-recipient@starteria.test', role: 'participante', roles: ['participante'] });
      await request(app).post('/api/v1/public/handoff-invitations/claim').set('Authorization', `Bearer ${recipientToken}`).send({ token }).expect(200).expect(({ body }) => {
        expect(body.data.briefVersion).toMatchObject({ id: version.id, status: 'CONFIRMED' });
      });
    } finally {
      send.mockRestore();
    }
  });

  it('persists, versions, retries, confirms and re-enters PL-05 without creating downstream entities', async () => {
    const auth = { Authorization: `Bearer ${token()}` };
    const before = {
      assignments: await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.pl05Challenge } }),
      invitations: await prisma.portfolioHandoffInvitation.count(),
      initiatives: await prisma.project.count(),
      steps: await prisma.step.count(),
    };
    const firstBody = { ...completeBody('Prepare the first reviewed mandate'), strategicContextRefs: { objective: 'Improve activation', challengeId: ids.pl05Challenge } };
    await request(app).post(`/api/v1/portfolio/challenges/${ids.pl05Challenge}/activation-briefs`).set(auth).set('Idempotency-Key', 'p12r1-pl05-invalid-envelope').send({ intent: 42, sourceRefs: 'not-an-array' }).expect(400);
    expect(await prisma.portfolioActivationCommandReceipt.count({ where: { idempotencyKey: 'p12r1-pl05-invalid-envelope' } })).toBe(0);
    const created = await request(app).post(`/api/v1/portfolio/challenges/${ids.pl05Challenge}/activation-briefs`).set(auth).set('Idempotency-Key', 'p12r1-pl05-create').send(firstBody).expect(201);
    const briefId = created.body.data.brief.id as string;
    const incomplete = await request(app).post(`/api/v1/portfolio/activation-briefs/${briefId}/versions`).set(auth).set('Idempotency-Key', 'p12r1-pl05-incomplete').send({ intent: 'Incomplete', scope: 'Still a Draft' }).expect(201);
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${incomplete.body.data.version.id}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-pl05-incomplete-confirm').send({}).expect(409);
    expect(await prisma.portfolioActivationCommandReceipt.count({ where: { idempotencyKey: 'p12r1-pl05-incomplete-confirm' } })).toBe(0);

    const refinedBody = { ...completeBody('Prepare the refined reviewed mandate'), strategicContextRefs: { objective: 'Improve activation', challengeId: ids.pl05Challenge } };
    const version = await request(app).post(`/api/v1/portfolio/activation-briefs/${briefId}/versions`).set(auth).set('Idempotency-Key', 'p12r1-pl05-version').send(refinedBody).expect(201);
    await request(app).post(`/api/v1/portfolio/activation-briefs/${briefId}/versions`).set(auth).set('Idempotency-Key', 'p12r1-pl05-version').send(refinedBody).expect(200).expect(({ body }) => expect(body.data.version.id).toBe(version.body.data.version.id));
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${version.body.data.version.id}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-pl05-confirm').send({}).expect(200);
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${version.body.data.version.id}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-pl05-confirm').send({}).expect(200);

    const concurrentBodies = [
      { ...completeBody('Concurrent reviewed mandate A'), strategicContextRefs: { objective: 'Improve activation', challengeId: ids.pl05Challenge } },
      { ...completeBody('Concurrent reviewed mandate B'), strategicContextRefs: { objective: 'Improve activation', challengeId: ids.pl05Challenge } },
    ];
    const concurrent = await Promise.all(concurrentBodies.map((body, index) => request(app)
      .post(`/api/v1/portfolio/activation-briefs/${briefId}/versions`)
      .set(auth)
      .set('Idempotency-Key', `p12r1-pl05-concurrent-${index}`)
      .send(body)
      .expect(201)));
    expect(concurrent.map((response) => response.body.data.version.versionNumber).sort()).toEqual([4, 5]);
    for (const [index, body] of concurrentBodies.entries()) {
      await request(app).post(`/api/v1/portfolio/activation-briefs/${briefId}/versions`).set(auth).set('Idempotency-Key', `p12r1-pl05-concurrent-${index}`).send(body).expect(200).expect(({ body: responseBody }) => {
        expect(responseBody.data.version.id).toBe(concurrent[index].body.data.version.id);
      });
    }

    const confirmCandidate = await request(app)
      .post(`/api/v1/portfolio/activation-briefs/${briefId}/versions`)
      .set(auth)
      .set('Idempotency-Key', 'p12r1-pl05-concurrent-confirm-version')
      .send({ ...completeBody('Concurrent confirmation mandate'), strategicContextRefs: { objective: 'Improve activation', challengeId: ids.pl05Challenge } })
      .expect(201);
    const concurrentConfirmKey = 'p12r1-pl05-concurrent-confirm';
    const concurrentConfirm = await Promise.all([0, 1].map(() => request(app)
      .post(`/api/v1/portfolio/activation-brief-versions/${confirmCandidate.body.data.version.id}/confirm`)
      .set(auth)
      .set('Idempotency-Key', concurrentConfirmKey)
      .send({})
      .expect(200)));
    expect(concurrentConfirm[0].body.data.version.id).toBe(concurrentConfirm[1].body.data.version.id);
    expect(concurrentConfirm[0].body.data.version.status).toBe('CONFIRMED');
    expect(await prisma.portfolioActivationCommandReceipt.count({ where: { idempotencyKey: concurrentConfirmKey } })).toBe(1);

    const reentry = await request(app).get(`/api/v1/portfolio/challenges/${ids.pl05Challenge}/activation-briefs`).set(auth).expect(200);
    expect(reentry.body.data).toHaveLength(1);
    expect(reentry.body.data[0].versions.map((item: { versionNumber: number; status: string }) => [item.versionNumber, item.status])).toEqual([[1, 'DRAFT'], [2, 'DRAFT'], [3, 'CONFIRMED'], [4, 'DRAFT'], [5, 'DRAFT'], [6, 'CONFIRMED']]);
    const otherTenantToken = generateAccessToken({ sub: ids.otherLead, email: 'p12r1-http-other-lead@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'] });
    const otherTenantAuth = { Authorization: `Bearer ${otherTenantToken}` };
    await request(app).get(`/api/v1/portfolio/challenges/${ids.pl05Challenge}/activation-briefs`).set(otherTenantAuth).expect(404);
    await request(app).post(`/api/v1/portfolio/activation-briefs/${briefId}/versions`).set(otherTenantAuth).set('Idempotency-Key', 'p12r1-pl05-other-write').send(refinedBody).expect(404);
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${version.body.data.version.id}/confirm`).set(otherTenantAuth).set('Idempotency-Key', 'p12r1-pl05-other-confirm').send({}).expect(404);

    expect(await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.pl05Challenge } })).toBe(before.assignments);
    expect(await prisma.portfolioHandoffInvitation.count()).toBe(before.invitations);
    expect(await prisma.project.count()).toBe(before.initiatives);
    expect(await prisma.step.count()).toBe(before.steps);
  });

  it('keeps two Brief identities and their local version histories isolated on the same Challenge', async () => {
    const auth = { Authorization: `Bearer ${token()}` };
    const before = {
      assignments: await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.multiBriefChallenge } }),
      invitations: await prisma.portfolioHandoffInvitation.count(),
      initiatives: await prisma.project.count(),
      steps: await prisma.step.count(),
    };
    const bodyA = { ...completeBody('Mandate A confirmed'), strategicContextRefs: { objective: 'Improve activation', challengeId: ids.multiBriefChallenge } };
    const bodyB = { ...completeBody('Mandate B draft'), strategicContextRefs: { objective: 'Improve activation', challengeId: ids.multiBriefChallenge } };
    const createdA = await request(app).post(`/api/v1/portfolio/challenges/${ids.multiBriefChallenge}/activation-briefs`).set(auth).set('Idempotency-Key', 'p12r1-multi-create-a').send(bodyA).expect(201);
    const briefAId = createdA.body.data.brief.id as string;
    const versionAId = createdA.body.data.brief.versions[0].id as string;
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${versionAId}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-multi-confirm-a').send({}).expect(200);

    const createdB = await request(app).post(`/api/v1/portfolio/challenges/${ids.multiBriefChallenge}/activation-briefs`).set(auth).set('Idempotency-Key', 'p12r1-multi-create-b').send(bodyB).expect(201);
    const briefBId = createdB.body.data.brief.id as string;
    const versionBId = createdB.body.data.brief.versions[0].id as string;
    expect(briefBId).not.toBe(briefAId);

    const collection = await request(app).get(`/api/v1/portfolio/challenges/${ids.multiBriefChallenge}/activation-briefs`).set(auth).expect(200);
    expect(new Set(collection.body.data.map((brief: { id: string }) => brief.id))).toEqual(new Set([briefAId, briefBId]));
    await request(app).get(`/api/v1/portfolio/activation-briefs/${briefAId}`).set(auth).expect(200).expect(({ body }) => {
      expect(body.data.id).toBe(briefAId);
      expect(body.data.versions).toEqual([expect.objectContaining({ id: versionAId, versionNumber: 1, status: 'CONFIRMED' })]);
    });
    await request(app).get(`/api/v1/portfolio/activation-briefs/${briefBId}`).set(auth).expect(200).expect(({ body }) => {
      expect(body.data.id).toBe(briefBId);
      expect(body.data.versions).toEqual([expect.objectContaining({ id: versionBId, versionNumber: 1, status: 'DRAFT' })]);
    });

    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${versionBId}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-multi-confirm-b').send({}).expect(200);
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${versionBId}/confirm`).set(auth).set('Idempotency-Key', 'p12r1-multi-confirm-b').send({}).expect(200).expect(({ body }) => expect(body.data.version.id).toBe(versionBId));
    expect(await prisma.challengeActivationBriefVersion.findUniqueOrThrow({ where: { id: versionAId }, select: { briefId: true, status: true } })).toEqual({ briefId: briefAId, status: 'CONFIRMED' });
    expect(await prisma.challengeActivationBriefVersion.findUniqueOrThrow({ where: { id: versionBId }, select: { briefId: true, status: true } })).toEqual({ briefId: briefBId, status: 'CONFIRMED' });

    const reentry = await request(app).get(`/api/v1/portfolio/challenges/${ids.multiBriefChallenge}/activation-briefs`).set(auth).expect(200);
    const identities = reentry.body.data.flatMap((brief: { id: string; versions: Array<{ id: string }> }) => brief.versions.map((version) => [brief.id, version.id]));
    expect(identities).toEqual(expect.arrayContaining([[briefAId, versionAId], [briefBId, versionBId]]));
    expect(await prisma.portfolioActivationCommandReceipt.count({ where: { idempotencyKey: 'p12r1-multi-confirm-b' } })).toBe(1);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.multiBriefChallenge } })).toBe(before.assignments);
    expect(await prisma.portfolioHandoffInvitation.count()).toBe(before.invitations);
    expect(await prisma.project.count()).toBe(before.initiatives);
    expect(await prisma.step.count()).toBe(before.steps);
  });

  it('does not let a recipient confirm the Portfolio Lead Brief', async () => {
    const brief = await prisma.challengeActivationBrief.findFirstOrThrow({ where: { challengeId: ids.challenge }, include: { versions: true } });
    const recipientToken = generateAccessToken({ sub: ids.recipient, email: 'p12r1-http-recipient@starteria.test', role: 'participante', roles: ['participante'] });
    const recipientAuth = { Authorization: `Bearer ${recipientToken}` };
    await request(app).post(`/api/v1/portfolio/challenges/${ids.challenge}/activation-briefs`).set(recipientAuth).set('Idempotency-Key', 'p12r1-http-recipient-create').send(completeBody()).expect(403);
    await request(app).post(`/api/v1/portfolio/activation-briefs/${brief.id}/versions`).set(recipientAuth).set('Idempotency-Key', 'p12r1-http-recipient-version').send(completeBody()).expect(403);
    await request(app).post(`/api/v1/portfolio/activation-brief-versions/${brief.versions[0].id}/confirm`).set(recipientAuth).set('Idempotency-Key', 'p12r1-http-recipient-confirm').send({}).expect(403);
  });
});
