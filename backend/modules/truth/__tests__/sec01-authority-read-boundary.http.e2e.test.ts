import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';

const run = process.env.RUN_SEC01_DB_E2E === '1';
if (run) {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  const localHost = databaseUrl.hostname === '127.0.0.1' || databaseUrl.hostname === 'localhost';
  if (!localHost || databaseUrl.port !== '55438' || databaseUrl.pathname !== '/postgres') {
    throw new Error('SEC-01 E2E refuses to run outside the disposable localhost:55438/postgres database.');
  }
}
const prisma = new PrismaClient();
const app = createApp();

const ids = {
  orgA: 'sec01-org-a',
  orgB: 'sec01-org-b',
  ownerA: 'sec01-owner-a',
  ownerB: 'sec01-owner-b',
  mentorAssigned: 'sec01-mentor-assigned',
  mentorGlobal: 'sec01-mentor-global',
  sponsorA: 'sec01-sponsor-a',
  projectA: 'sec01-project-a',
  projectB: 'sec01-project-b',
  projectUninitialized: 'sec01-project-uninitialized',
  claimA: 'sec01-claim-a',
  claimB: 'sec01-claim-b',
  sourceA: 'sec01-source-a',
  sourceB: 'sec01-source-b',
  evidenceA: 'sec01-evidence-a',
  sponsorCheckpointA: 'sec01-sponsor-checkpoint-a',
};

const tokenFor = (id: string, role: 'participante' | 'mentor' | 'sponsor') => ({
  Authorization: `Bearer ${generateAccessToken({ sub: id, email: `${id}@starteria.test`, role, roles: [role] })}`,
});

const ownerAAuth = tokenFor(ids.ownerA, 'participante');
const ownerBAuth = tokenFor(ids.ownerB, 'participante');
const mentorAssignedAuth = tokenFor(ids.mentorAssigned, 'mentor');
const mentorGlobalAuth = tokenFor(ids.mentorGlobal, 'mentor');
const sponsorAAuth = tokenFor(ids.sponsorA, 'sponsor');

async function adaptiveSnapshot(projectId: string) {
  const [project, cycles, states, configs, checkpoints, outputs, signals, events, claims, validations, sessions] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { currentStep: true, lastModified: true } }),
    prisma.initiativeCycle.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.cycleStepState.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } }),
    prisma.adaptiveStepConfiguration.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveCheckpointInstance.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveStepOutput.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveProgressSignal.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveAdaptationEvent.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.truthClaim.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.truthValidation.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.stepReasoningSession.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
  ]);
  return JSON.stringify({ project, cycles, states, configs, checkpoints, outputs, signals, events, claims, validations, sessions });
}

describe.skipIf(!run)('SEC-01 authority, tenant and pure-read HTTP/PostgreSQL', () => {
  beforeAll(async () => {
    await prisma.organization.createMany({
      data: [
        { id: ids.orgA, name: 'SEC01 Tenant A', slug: 'sec01-tenant-a', seatLimit: 10 },
        { id: ids.orgB, name: 'SEC01 Tenant B', slug: 'sec01-tenant-b', seatLimit: 10 },
      ],
    });
    await prisma.user.createMany({
      data: [
        { id: ids.ownerA, email: 'sec01-owner-a@starteria.test', name: 'Owner A', role: 'participante', roles: ['participante'], initials: 'OA', skills: [], organizationId: ids.orgA },
        { id: ids.ownerB, email: 'sec01-owner-b@starteria.test', name: 'Owner B', role: 'participante', roles: ['participante'], initials: 'OB', skills: [], organizationId: ids.orgB },
        { id: ids.mentorAssigned, email: 'sec01-mentor-assigned@starteria.test', name: 'Mentor Assigned', role: 'mentor', roles: ['mentor'], initials: 'MA', skills: [], organizationId: ids.orgA },
        { id: ids.mentorGlobal, email: 'sec01-mentor-global@starteria.test', name: 'Mentor Global', role: 'mentor', roles: ['mentor'], initials: 'MG', skills: [], organizationId: ids.orgB },
        { id: ids.sponsorA, email: 'sec01-sponsor-a@starteria.test', name: 'Sponsor A', role: 'sponsor', roles: ['sponsor'], initials: 'SA', skills: [], organizationId: ids.orgA },
      ],
    });
    await prisma.organizationMember.createMany({ data: [
      { id: 'sec01-org-member-owner-a', organizationId: ids.orgA, userId: ids.ownerA },
      { id: 'sec01-org-member-owner-b', organizationId: ids.orgB, userId: ids.ownerB },
      { id: 'sec01-org-member-mentor-a', organizationId: ids.orgA, userId: ids.mentorAssigned },
      { id: 'sec01-org-member-mentor-global', organizationId: ids.orgB, userId: ids.mentorGlobal },
      { id: 'sec01-org-member-sponsor-a', organizationId: ids.orgA, userId: ids.sponsorA },
    ] });
    await prisma.project.create({
      data: {
        id: ids.projectA,
        name: 'SEC01 Project A',
        organizationId: ids.orgA,
        ownerId: ids.ownerA,
        status: 'IN_PROGRESS',
        currentStep: 1,
        teamMembers: { create: [
          { id: 'sec01-member-owner-a', userId: ids.ownerA, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] },
          { id: 'sec01-member-mentor-a', userId: ids.mentorAssigned, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
        ] },
      },
    });
    await prisma.project.create({
      data: {
        id: ids.projectB,
        name: 'SEC01 Project B',
        organizationId: ids.orgB,
        ownerId: ids.ownerB,
        teamMembers: { create: { id: 'sec01-member-owner-b', userId: ids.ownerB, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } },
      },
    });
    await prisma.project.create({
      data: {
        id: ids.projectUninitialized,
        name: 'SEC01 Uninitialized',
        organizationId: ids.orgA,
        ownerId: ids.ownerA,
        teamMembers: { create: { id: 'sec01-member-owner-uninitialized', userId: ids.ownerA, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } },
      },
    });
    await prisma.initiativeCycle.create({
      data: { id: 'sec01-cycle-a', projectId: ids.projectA, cycleNumber: 1, startStep: 0, currentStep: 1, status: 'active' },
    });
    await prisma.sourceRef.createMany({ data: [
      { id: ids.sourceA, projectId: ids.projectA, sourceType: 'USER_INPUT', reference: 'SEC01 source A', originActorId: ids.ownerA, originActorType: 'human' },
      { id: ids.sourceB, projectId: ids.projectB, sourceType: 'USER_INPUT', reference: 'SEC01 source B', originActorId: ids.ownerB, originActorType: 'human' },
    ] });
    await prisma.truthClaim.createMany({ data: [
      { id: ids.claimA, projectId: ids.projectA, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Claim A', createdById: ids.ownerA, createdByType: 'human', sourceRefsJson: [] },
      { id: ids.claimB, projectId: ids.projectB, subjectType: 'initiative', claimType: 'hypothesis', statement: 'Claim B', createdById: ids.ownerB, createdByType: 'human', sourceRefsJson: [] },
    ] });
    await prisma.evidence.create({
      data: {
        id: ids.evidenceA,
        projectId: ids.projectA,
        name: 'SEC01 evidence A',
        type: 'OTHER',
        stepRef: 1,
        ownerId: ids.ownerA,
        sourceRefId: ids.sourceA,
        targetClaimId: ids.claimA,
        truthStatus: 'supports',
      },
    });
    await prisma.sponsorCheckpoint.create({
      data: {
        id: ids.sponsorCheckpointA,
        projectId: ids.projectA,
        stepNumber: 0,
        sponsorId: ids.sponsorA,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('requires a session and rejects another tenant without any effects', async () => {
    const before = await adaptiveSnapshot(ids.projectA);
    await request(app).get(`/api/v1/truth/projects/${ids.projectA}/claims/${ids.claimA}/readiness`).expect(401);
    await request(app).get(`/api/v1/truth/projects/${ids.projectA}/claims/${ids.claimA}/readiness`).set(ownerBAuth).expect(404);
    await request(app).get(`/api/v1/projects/${ids.projectA}/adaptive-core`).set(ownerBAuth).expect(404);
    expect(await adaptiveSnapshot(ids.projectA)).toBe(before);
  });

  it('rejects public SourceRef creation without a canonical Project scope', async () => {
    const before = await prisma.sourceRef.count();
    const response = await request(app)
      .post('/api/v1/truth/source-refs')
      .set(ownerAAuth)
      .send({ sourceType: 'USER_INPUT', reference: 'must not become global' })
      .expect(400);
    expect(response.body.error.code).toBe('PROJECT_ID_REQUIRED');
    expect(await prisma.sourceRef.count()).toBe(before);
  });

  it('does not reveal an indirect Claim from another Project', async () => {
    const response = await request(app)
      .get(`/api/v1/truth/projects/${ids.projectA}/claims/${ids.claimB}/readiness`)
      .set(ownerAAuth)
      .expect(404);
    expect(response.body.error.code).toBe('TRUTH_CLAIM_NOT_FOUND');
    expect(response.text).not.toContain('Claim B');
  });

  it('rejects a global mentor and grants the assigned Mentor only its validation capability', async () => {
    await request(app).get(`/api/v1/projects/${ids.projectA}/adaptive-core`).set(mentorGlobalAuth).expect(404);
    await request(app).get(`/api/v1/projects/${ids.projectA}/adaptive-core`).set(mentorAssignedAuth).expect(200);
    const response = await request(app)
      .post('/api/v1/truth/validations')
      .set(mentorAssignedAuth)
      .send({ projectId: ids.projectA, claimId: ids.claimA, evidenceId: ids.evidenceA, result: 'supported', validatorType: 'human', validatorRole: 'mentor', rationale: 'No debe elevar VIEWER.', expectedVersion: 0 })
      .expect(201);
    expect(response.body.data).toMatchObject({
      validatedById: ids.mentorAssigned,
      validatorType: 'human',
      validatorRole: 'mentor',
      version: 1,
    });
    expect(await prisma.truthValidation.count({ where: { projectId: ids.projectA } })).toBe(1);
  });

  it('allows the assigned Sponsor to read only its checkpoint and protects project listings', async () => {
    await request(app).get(`/api/v1/sponsor/checkpoints/${ids.sponsorCheckpointA}`).set(sponsorAAuth).expect(200);
    await request(app).get(`/api/v1/sponsor/checkpoints/${ids.sponsorCheckpointA}`).set(ownerBAuth).expect(404);
    await request(app).get(`/api/v1/sponsor/projects/${ids.projectA}/checkpoints`).set(ownerAAuth).expect(200);
    await request(app).get(`/api/v1/sponsor/projects/${ids.projectA}/checkpoints`).set(mentorGlobalAuth).expect(404);
  });

  it('rejects spoofed final validation from the Owner instead of elevating payload authority', async () => {
    const response = await request(app)
      .post('/api/v1/truth/validations')
      .set(ownerAAuth)
      .send({
        projectId: ids.projectA,
        claimId: ids.claimA,
        evidenceId: ids.evidenceA,
        result: 'supported',
        validatorType: 'ai',
        validatorRole: 'admin',
        validatedById: ids.mentorGlobal,
        rationale: 'Payload deliberadamente falsificado.',
        expectedVersion: 1,
      })
      .expect(403);
    expect(response.body.error.code).toBe('TRUTH_VALIDATOR_REQUIRED');
    expect(await prisma.truthValidation.count({ where: { projectId: ids.projectA } })).toBe(1);
  });

  it('serializes concurrent validations into distinct versions', async () => {
    const payload = { projectId: ids.projectA, claimId: ids.claimA, evidenceId: ids.evidenceA, result: 'supported', validatorType: 'human', rationale: 'Concurrent validation.', expectedVersion: 1 };
    const responses = await Promise.all([
      request(app).post('/api/v1/truth/validations').set(mentorAssignedAuth).send(payload),
      request(app).post('/api/v1/truth/validations').set(mentorAssignedAuth).send(payload),
    ]);
    expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
    expect(responses.find((item) => item.status === 409)?.body.error.code).toBe('STALE_VERSION');
    const rows = await prisma.truthValidation.findMany({ where: { claimId: ids.claimA }, orderBy: { version: 'asc' } });
    expect(rows.map((row) => row.version)).toEqual([1, 2]);
    expect(rows.every((row) => row.validatedById === ids.mentorAssigned && row.validatorType === 'human')).toBe(true);
  });

  it('serializes evidence-only validation versions under the Evidence lock', async () => {
    const payload = { projectId: ids.projectA, evidenceId: ids.evidenceA, result: 'insufficient', validatorType: 'human', rationale: 'Evidence-only concurrent validation.', expectedVersion: 2 };
    const responses = await Promise.all([
      request(app).post('/api/v1/truth/validations').set(mentorAssignedAuth).send(payload),
      request(app).post('/api/v1/truth/validations').set(mentorAssignedAuth).send(payload),
    ]);
    expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
    expect(responses.find((item) => item.status === 409)?.body.error.code).toBe('STALE_VERSION');
    const rows = await prisma.truthValidation.findMany({ where: { evidenceId: ids.evidenceA }, orderBy: { version: 'asc' } });
    expect(rows.map((row) => row.version)).toEqual([1, 2, 3]);
  });

  it('keeps initialized and uninitialized Adaptive reads byte-stable', async () => {
    const initializedBefore = await adaptiveSnapshot(ids.projectA);
    const reads = await Promise.all([
      request(app).get(`/api/v1/projects/${ids.projectA}/adaptive-core`).set(ownerAAuth),
      request(app).get(`/api/v1/projects/${ids.projectA}/adaptive-core`).set(mentorAssignedAuth),
      request(app).get(`/api/v1/projects/${ids.projectA}/copilot-mode/orient`).set(ownerAAuth),
    ]);
    expect(reads.map((item) => item.status)).toEqual([200, 200, 200]);
    expect(await adaptiveSnapshot(ids.projectA)).toBe(initializedBefore);

    const uninitializedBefore = await adaptiveSnapshot(ids.projectUninitialized);
    const missing = await Promise.all([
      request(app).get(`/api/v1/projects/${ids.projectUninitialized}/adaptive-core`).set(ownerAAuth),
      request(app).get(`/api/v1/projects/${ids.projectUninitialized}/adaptive-core`).set(ownerAAuth),
      request(app).get(`/api/v1/projects/${ids.projectUninitialized}/copilot-mode/orient`).set(ownerAAuth),
    ]);
    expect(missing.map((item) => item.status)).toEqual([409, 409, 409]);
    expect(missing.every((item) => item.body.error.code === 'NO_OPERATIONAL_CYCLE')).toBe(true);
    expect(await adaptiveSnapshot(ids.projectUninitialized)).toBe(uninitializedBefore);
  });
});
