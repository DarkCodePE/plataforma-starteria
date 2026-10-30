import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';

const enabled = process.env.KAN189_DB_E2E === '1';
const databaseUrl = process.env.E2E_DATABASE_URL;

if (enabled) {
  const parsed = databaseUrl ? new URL(databaseUrl) : null;
  const databaseName = parsed?.pathname.replace(/^\//, '');
  if (!parsed || databaseName !== 'starteria_e2e' || !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('KAN-189 requires disposable local PostgreSQL database starteria_e2e.');
  }
}

const suite = enabled ? describe.sequential : describe.skip;
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
const ids = {
  orgA: 'kan189-scope-org-a',
  orgB: 'kan189-scope-org-b',
  orgC: 'kan189-scope-org-c',
  leadA: 'kan189-scope-lead-a',
  leadB: 'kan189-scope-lead-b',
  frontB: 'kan189-scope-front-b',
  frontC: 'kan189-scope-front-c',
  frontLegacy: 'kan189-scope-front-legacy',
  challengeB: 'kan189-scope-challenge-b',
  challengeC: 'kan189-scope-challenge-c',
  challengeLegacy: 'kan189-scope-challenge-legacy',
  briefB: 'kan189-scope-brief-b',
  versionB: 'kan189-scope-version-b',
};

const piiB = 'KAN189 B confidential owner';
const token = () => generateAccessToken({
  sub: ids.leadA,
  email: 'kan189-scope-lead-a@starteria.test',
  role: 'portfolio_lead',
  roles: ['portfolio_lead'],
});
const briefBody = {
  intent: 'Prepare a tenant-scoped handoff',
  scope: 'Organization B only',
  strategicContextRefs: { challengeId: ids.challengeB },
  inheritedContext: { challengeProblem: 'Scoped problem' },
  constraintsSnapshot: [],
  knownGaps: [],
  sourceRefs: [{ source: 'kan189-test' }],
  provenance: { source: 'KAN_189' },
};
const assignmentBody = {
  targetKind: 'CHALLENGE',
  initiativeId: null,
  briefId: ids.briefB,
  briefVersionId: ids.versionB,
  contextNote: 'Tenant B assignment',
  invitedEmailNormalized: 'kan189-owner-b@starteria.test',
  members: [{
    identityKey: 'kan189-owner-b@starteria.test',
    emailNormalized: 'kan189-owner-b@starteria.test',
    role: 'OWNER',
  }],
};

async function cleanup(): Promise<void> {
  const challengeIds = [ids.challengeB, ids.challengeC, ids.challengeLegacy];
  await prisma.portfolioHandoffDeliveryBatch.deleteMany({ where: { challengeId: { in: challengeIds } } });
  await prisma.portfolioActivationCommandReceipt.deleteMany({ where: { organizationId: { in: [ids.orgA, ids.orgB, ids.orgC] } } });
  await prisma.portfolioHandoffSemanticEvent.deleteMany({ where: { organizationId: { in: [ids.orgA, ids.orgB, ids.orgC] } } });
  await prisma.portfolioHandoffAssignment.deleteMany({ where: { challengeId: { in: challengeIds } } });
  await prisma.challengeActivationBriefVersion.deleteMany({ where: { challengeId: { in: challengeIds } } });
  await prisma.challengeActivationBrief.deleteMany({ where: { challengeId: { in: challengeIds } } });
  await prisma.challenge.deleteMany({ where: { id: { in: challengeIds } } });
  await prisma.strategicFront.deleteMany({ where: { id: { in: [ids.frontB, ids.frontC, ids.frontLegacy] } } });
  await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId: ids.leadA } });
  await prisma.organizationMember.deleteMany({ where: { userId: ids.leadA } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.leadA, ids.leadB] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ids.orgA, ids.orgB, ids.orgC] } } });
}

suite('KAN-189 target-scoped write authorization with PostgreSQL', () => {
  const app = createApp();

  beforeAll(async () => {
    await cleanup();
    await prisma.organization.createMany({ data: [
      { id: ids.orgA, name: 'KAN189 Scope A', slug: ids.orgA },
      { id: ids.orgB, name: 'KAN189 Scope B', slug: ids.orgB },
      { id: ids.orgC, name: 'KAN189 Scope C', slug: ids.orgC },
    ] });
    await prisma.user.createMany({ data: [
      {
        id: ids.leadA,
        email: 'kan189-scope-lead-a@starteria.test',
        name: 'KAN189 Lead A',
        role: 'portfolio_lead',
        roles: ['portfolio_lead'],
        initials: 'KA',
        skills: [],
        organizationId: ids.orgA,
      },
      {
        id: ids.leadB,
        email: 'kan189-scope-lead-b@starteria.test',
        name: piiB,
        role: 'portfolio_lead',
        roles: ['portfolio_lead'],
        initials: 'KB',
        skills: [],
        organizationId: ids.orgB,
      },
    ] });
    await prisma.organizationMember.create({ data: { organizationId: ids.orgB, userId: ids.leadA, role: 'member' } });
    await prisma.strategicFront.createMany({ data: [
      { id: ids.frontB, name: 'KAN189 Scope Front B', organizationId: ids.orgB },
      { id: ids.frontC, name: 'KAN189 Scope Front C', organizationId: ids.orgC },
      { id: ids.frontLegacy, name: 'KAN189 Scope Legacy', organizationId: null },
    ] });
    await prisma.challenge.createMany({ data: [
      { id: ids.challengeB, strategicFrontId: ids.frontB, title: 'KAN189 Scope Challenge B' },
      { id: ids.challengeC, strategicFrontId: ids.frontC, title: 'KAN189 Scope Challenge C' },
      { id: ids.challengeLegacy, strategicFrontId: ids.frontLegacy, title: 'KAN189 Scope Legacy Challenge' },
    ] });
    await prisma.challengeActivationBrief.create({
      data: { id: ids.briefB, organizationId: ids.orgB, challengeId: ids.challengeB, createdByActorId: ids.leadB },
    });
    await prisma.challengeActivationBriefVersion.create({
      data: {
        id: ids.versionB,
        organizationId: ids.orgB,
        briefId: ids.briefB,
        challengeId: ids.challengeB,
        versionNumber: 1,
        status: 'CONFIRMED',
        intent: 'Tenant B confirmed brief',
        scope: null,
        strategicContextRefs: [],
        inheritedContext: {},
        constraintsSnapshot: [],
        knownGaps: [],
        sourceRefs: [],
        provenance: {},
        createdByActorId: ids.leadB,
        confirmedByActorId: ids.leadB,
        confirmedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('denies secondary membership and explicit grants outside the canonical organization', async () => {
    const auth = { Authorization: `Bearer ${token()}` };
    const beforeBriefs = await prisma.challengeActivationBrief.count({ where: { challengeId: ids.challengeB } });
    const beforeAssignments = await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.challengeB } });

    const deniedBrief = await request(app)
      .post(`/api/v1/portfolio/challenges/${ids.challengeB}/activation-briefs`)
      .set(auth)
      .set('Idempotency-Key', 'kan189-secondary-brief-denied')
      .send(briefBody)
      .expect(404);
    await request(app)
      .post(`/api/v1/portfolio/challenges/${ids.challengeB}/handoff-assignments`)
      .set(auth)
      .set('Idempotency-Key', 'kan189-secondary-assignment-denied')
      .send(assignmentBody)
      .expect(404);
    expect(JSON.stringify(deniedBrief.body)).not.toContain(piiB);
    expect(JSON.stringify(deniedBrief.body)).not.toContain(ids.orgB);
    expect(await prisma.challengeActivationBrief.count({ where: { challengeId: ids.challengeB } })).toBe(beforeBriefs);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.challengeB } })).toBe(beforeAssignments);

    await prisma.organizationPortfolioAccessGrant.create({
      data: {
        userId: ids.leadA,
        organizationId: ids.orgB,
        capability: 'portfolio:write',
        grantedByUserId: ids.leadB,
      },
    });

    await request(app)
      .post(`/api/v1/portfolio/challenges/${ids.challengeB}/activation-briefs`)
      .set(auth)
      .set('Idempotency-Key', 'kan189-granted-brief')
      .send(briefBody)
      .expect(404);
    await request(app)
      .post(`/api/v1/portfolio/challenges/${ids.challengeB}/handoff-assignments`)
      .set(auth)
      .set('Idempotency-Key', 'kan189-granted-assignment')
      .send(assignmentBody)
      .expect(404);
    expect(await prisma.challengeActivationBrief.count({ where: { challengeId: ids.challengeB } })).toBe(beforeBriefs);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.challengeB } })).toBe(beforeAssignments);

    await request(app)
      .post(`/api/v1/portfolio/challenges/${ids.challengeC}/activation-briefs`)
      .set(auth)
      .set('Idempotency-Key', 'kan189-c-denied')
      .send({ ...briefBody, strategicContextRefs: { challengeId: ids.challengeC } })
      .expect(404);

    await request(app)
      .post(`/api/v1/portfolio/challenges/${ids.challengeLegacy}/activation-briefs`)
      .set(auth)
      .set('Idempotency-Key', 'kan189-legacy-denied')
      .send({ ...briefBody, strategicContextRefs: { challengeId: ids.challengeLegacy } })
      .expect(404);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { challengeId: ids.challengeB } })).toBe(beforeAssignments);
  });
});
