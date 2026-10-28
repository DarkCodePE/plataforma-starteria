import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { generateAccessToken } from '../../auth/token.service';

const run = process.env.RUN_SEC02B_DB_E2E === '1';
if (run) {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) || databaseUrl.port !== '55438' || databaseUrl.pathname !== '/postgres') {
    throw new Error('SEC-02B E2E refuses to run outside disposable localhost:55438/postgres.');
  }
}

const prisma = new PrismaClient();
const app = createApp();
const ids = {
  org: 'sec02b-org',
  owner: 'sec02b-owner',
  mentor: 'sec02b-mentor',
  sponsor: 'sec02b-sponsor',
  project: 'sec02b-project',
  advanced: 'sec02b-advanced',
};

const auth = (id: string, role: 'participante' | 'mentor' | 'sponsor') => ({
  Authorization: `Bearer ${generateAccessToken({ sub: id, email: `${id}@starteria.test`, role, roles: [role] })}`,
});

async function snapshot(projectId: string) {
  const [project, cycles, states, configs, checkpoints, responses, signals, events] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { currentStep: true, lastModified: true } }),
    prisma.initiativeCycle.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.cycleStepState.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } }),
    prisma.adaptiveStepConfiguration.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveCheckpointInstance.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveCheckpointResponse.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveProgressSignal.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
    prisma.adaptiveAdaptationEvent.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
  ]);
  return JSON.stringify({ project, cycles, states, configs, checkpoints, responses, signals, events });
}

describe.skipIf(!run)('SEC-02B authority, CAS and explicit activation on PostgreSQL', () => {
  beforeAll(async () => {
    await prisma.organization.create({ data: { id: ids.org, name: 'SEC02B tenant', slug: 'sec02b-tenant', seatLimit: 10 } });
    await prisma.user.createMany({ data: [
      { id: ids.owner, email: 'sec02b-owner@starteria.test', name: 'Owner', role: 'participante', roles: ['participante'], initials: 'SO', skills: [], organizationId: ids.org },
      { id: ids.mentor, email: 'sec02b-mentor@starteria.test', name: 'Mentor', role: 'mentor', roles: ['mentor'], initials: 'SM', skills: [], organizationId: ids.org },
      { id: ids.sponsor, email: 'sec02b-sponsor@starteria.test', name: 'Sponsor', role: 'sponsor', roles: ['sponsor'], initials: 'SS', skills: [], organizationId: ids.org },
    ] });
    await prisma.organizationMember.createMany({ data: [ids.owner, ids.mentor, ids.sponsor].map((userId) => ({
      id: `sec02b-org-member-${userId}`,
      organizationId: ids.org,
      userId,
    })) });
    for (const projectId of [ids.project, ids.advanced]) {
      await prisma.project.create({ data: {
        id: projectId,
        name: projectId,
        organizationId: ids.org,
        ownerId: ids.owner,
        currentStep: projectId === ids.advanced ? 2 : 0,
        step0Status: 'IN_PROGRESS',
        teamMembers: { create: [
          { id: `${projectId}-owner`, userId: ids.owner, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] },
          { id: `${projectId}-mentor`, userId: ids.mentor, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
          { id: `${projectId}-sponsor`, userId: ids.sponsor, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
        ] },
      } });
    }
    await prisma.initiativeCycle.create({ data: {
      id: 'sec02b-advanced-cycle', projectId: ids.advanced, cycleNumber: 1, startStep: 0, currentStep: 2, status: 'active',
    } });
    await prisma.cycleStepState.createMany({ data: [0, 1, 2, 3, 4].map((stepNumber) => ({
      id: `sec02b-advanced-state-${stepNumber}`,
      cycleId: 'sec02b-advanced-cycle',
      stepNumber,
      state: stepNumber < 2 ? 'confirmed' : stepNumber === 2 ? 'active' : 'pending',
    })) });
  });

  afterAll(async () => prisma.$disconnect());

  it('fails closed for Mentor and Sponsor, while Owner activation is atomic and replayable', async () => {
    const command = { idempotencyKey: 'sec02b-activate-1', expectedVersion: 0, origin: { kind: 'DIRECT_PROJECT' } };
    await request(app).post(`/api/v1/projects/${ids.project}/adaptive-core/activation`).set(auth(ids.mentor, 'mentor')).send(command).expect(403);
    await request(app).post(`/api/v1/projects/${ids.project}/adaptive-core/activation`).set(auth(ids.sponsor, 'sponsor')).send(command).expect(403);
    expect(await prisma.initiativeCycle.count({ where: { projectId: ids.project } })).toBe(0);

    const [first, retry] = await Promise.all([
      request(app).post(`/api/v1/projects/${ids.project}/adaptive-core/activation`).set(auth(ids.owner, 'participante')).send(command),
      request(app).post(`/api/v1/projects/${ids.project}/adaptive-core/activation`).set(auth(ids.owner, 'participante')).send(command),
    ]);
    expect([first.status, retry.status]).toEqual([200, 200]);
    expect(new Set([first.body.data.activation.status, retry.body.data.activation.status])).toEqual(new Set(['activated', 'replayed']));
    expect(await prisma.initiativeCycle.count({ where: { projectId: ids.project } })).toBe(1);
    expect(await prisma.adaptiveStepConfiguration.count({ where: { projectId: ids.project } })).toBe(1);
    expect(await prisma.adaptiveCheckpointInstance.count({ where: { projectId: ids.project } })).toBe(1);
    expect(await prisma.adaptiveAdaptationEvent.count({ where: { projectId: ids.project, eventType: 'initiative_cycle_activated' } })).toBe(1);

    const reused = await request(app)
      .post(`/api/v1/projects/${ids.project}/adaptive-core/activation`)
      .set(auth(ids.owner, 'participante'))
      .send({ ...command, origin: { kind: 'DIRECT_PROJECT', refId: 'different-intent' } })
      .expect(409);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('preserves an existing advanced cycle and Step with zero writes', async () => {
    const before = await snapshot(ids.advanced);
    const response = await request(app)
      .post(`/api/v1/projects/${ids.advanced}/adaptive-core/activation`)
      .set(auth(ids.owner, 'participante'))
      .send({ idempotencyKey: 'sec02b-advanced-continuity', expectedVersion: 0, origin: { kind: 'DIRECT_PROJECT' } })
      .expect(200);
    expect(response.body.data.activation).toMatchObject({ cycleId: 'sec02b-advanced-cycle', status: 'already_active', step: 2 });
    expect(await snapshot(ids.advanced)).toBe(before);
  });

  it('serializes concurrent checkpoint commands with expectedVersion and supports exact retry only', async () => {
    const base = {
      expectedVersion: 0,
      checkpointKey: 'CP-0.1',
      responses: { objective: 'Reducir retrabajo', challengeType: 'growth' },
    };
    const commands = ['sec02b-checkpoint-a', 'sec02b-checkpoint-b'].map((idempotencyKey) =>
      request(app).post(`/api/v1/projects/${ids.project}/adaptive-core/checkpoints/confirm`)
        .set(auth(ids.owner, 'participante')).send({ ...base, idempotencyKey })
    );
    const results = await Promise.all(commands);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const winnerKey = results[0].status === 200 ? 'sec02b-checkpoint-a' : 'sec02b-checkpoint-b';
    expect(await prisma.adaptiveCheckpointResponse.count({ where: { projectId: ids.project, checkpointKey: 'CP-0.1' } })).toBe(1);

    await request(app).post(`/api/v1/projects/${ids.project}/adaptive-core/checkpoints/confirm`)
      .set(auth(ids.owner, 'participante')).send({ ...base, idempotencyKey: winnerKey }).expect(200);
    const reuse = await request(app).post(`/api/v1/projects/${ids.project}/adaptive-core/checkpoints/confirm`)
      .set(auth(ids.owner, 'participante'))
      .send({ ...base, idempotencyKey: winnerKey, responses: { ...base.responses, objective: 'Otra intencion' } })
      .expect(409);
    expect(reuse.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await prisma.adaptiveCheckpointResponse.count({ where: { projectId: ids.project, checkpointKey: 'CP-0.1' } })).toBe(1);
  });

  it('keeps GET pure after activation and does not expose internal receipt metadata', async () => {
    const before = await snapshot(ids.project);
    const response = await request(app).get(`/api/v1/projects/${ids.project}/adaptive-core`).set(auth(ids.owner, 'participante')).expect(200);
    expect(JSON.stringify(response.body.data)).not.toContain('__sec02bCommand');
    expect(await snapshot(ids.project)).toBe(before);
  });
});
