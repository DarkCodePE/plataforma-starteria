import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PilotClaimService, type PilotClaimStore } from '../pilot-claim.service';
import { derivePilotCode, hashPilotCode } from '../pilot-code';
import { createPilotProject } from '../pilot-project-creator';

const enabled = process.env.KAN193_DB_E2E === '1';
const run = enabled ? describe : describe.skip;

run('KAN-193 pilot claim concurrency (PostgreSQL)', () => {
  const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const suffix = `kan193-${Date.now()}`;
  const userId = `user-${suffix}`;
  const leadId = `lead-${suffix}`;
  const draftId = `draft-${suffix}`;
  const email = `${suffix}@example.test`;
  const secret = 'kan193-test-secret-with-more-than-32-characters';
  const pilotCode = derivePilotCode(draftId, secret);

  const service = new PilotClaimService(
    prisma as unknown as PilotClaimStore,
    createPilotProject,
  );

  beforeAll(async () => {
    if (!/starteria_e2e/i.test(databaseUrl)) {
      throw new Error('KAN193_DB_E2E requires an explicitly disposable starteria_e2e database');
    }
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'KAN-193 User',
        role: 'participante',
        roles: ['participante'],
        initials: 'K1',
        skills: [],
      },
    });
    await prisma.pilotLead.create({
      data: {
        id: leadId,
        draftId,
        pilotCode: hashPilotCode(pilotCode),
        name: 'KAN-193 Lead',
        email,
        consentAccepted: true,
        consentAt: new Date(),
        retentionUntil: new Date(Date.now() + 60_000),
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId }, { resourceId: { contains: suffix } }] } });
    await prisma.pilotClaimToken.deleteMany({ where: { pilotLeadId: leadId } });
    await prisma.project.deleteMany({ where: { pilotLeadId: leadId } });
    await prisma.pilotLead.deleteMany({ where: { id: leadId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('allows exactly one of 24 simultaneous consumes and rejects replay without project disclosure', async () => {
    const issued = await service.issue(pilotCode);
    const attempts = await Promise.allSettled(
      Array.from({ length: 24 }, () =>
        service.consume(issued.claimToken, { id: userId, role: 'participante', email }),
      ),
    );

    const fulfilled = attempts.filter((result): result is PromiseFulfilledResult<{ projectId: string; alreadyExisted: boolean }> => result.status === 'fulfilled');
    const rejected = attempts.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(23);
    expect(rejected.every((result) => result.reason?.code === 'PILOT_CLAIM_ALREADY_CONSUMED')).toBe(true);
    expect(await prisma.project.count({ where: { pilotLeadId: leadId } })).toBe(1);

    await expect(
      service.consume(issued.claimToken, { id: userId, role: 'participante', email }),
    ).rejects.toMatchObject({ code: 'PILOT_CLAIM_ALREADY_CONSUMED' });
    const replayError = await service
      .consume(issued.claimToken, { id: userId, role: 'participante', email })
      .catch((error) => error);
    expect(JSON.stringify(replayError)).not.toContain(fulfilled[0].value.projectId);
  }, 30_000);

  it('supersedes an older claim and still creates at most one project across two claim tokens', async () => {
    await prisma.pilotClaimToken.deleteMany({ where: { pilotLeadId: leadId } });
    await prisma.project.deleteMany({ where: { pilotLeadId: leadId } });
    const older = await service.issue(pilotCode);
    const current = await service.issue(pilotCode);

    const attempts = await Promise.allSettled([
      ...Array.from({ length: 12 }, () =>
        service.consume(older.claimToken, { id: userId, role: 'participante', email })),
      ...Array.from({ length: 12 }, () =>
        service.consume(current.claimToken, { id: userId, role: 'participante', email })),
    ]);

    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.project.count({ where: { pilotLeadId: leadId } })).toBe(1);
  }, 30_000);
});
