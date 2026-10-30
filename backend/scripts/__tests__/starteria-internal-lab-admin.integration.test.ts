import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  INTERNAL_LAB_AUDIT_ACTION,
  INTERNAL_LAB_NAME,
  INTERNAL_LAB_SLUG,
  provisionStarteriaInternalLab,
} from '../starteria-internal-lab-admin.service';

const run = process.env.INTERNAL_LAB_ADMIN_DB_E2E === '1';
if (run) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const allowedDatabase = ['/starteria_e2e', '/starteria_e2e_internal_lab'].includes(url.pathname);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !allowedDatabase) {
    throw new Error('Internal Lab integration test refuses to run outside its disposable localhost database.');
  }
}

const suite = run ? describe.sequential : describe.skip;
const prisma = new PrismaClient();
const ids = { custodian: 'internal-lab-db-custodian', approver: 'internal-lab-db-approver' };
const command = {
  custodianUserId: ids.custodian,
  approvedByUserId: ids.approver,
  approvalReference: 'ADR009-INTERNAL-LAB-DB-E2E-01',
};

suite('Startería Internal Lab administrative transaction on PostgreSQL', () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.user.createMany({ data: [
      {
        id: ids.custodian,
        email: 'internal-lab-custodian@starteria.test',
        name: 'Internal Lab Custodian',
        role: 'participante',
        roles: ['participante'],
        initials: 'IL',
        skills: [],
      },
      {
        id: ids.approver,
        email: 'internal-lab-approver@starteria.test',
        name: 'Internal Lab Approver',
        role: 'admin',
        roles: ['admin'],
        initials: 'IA',
        skills: [],
      },
    ] });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('creates one tenant atomically and replays without duplicate authority or audit rows', async () => {
    const first = await provisionStarteriaInternalLab(prisma, command);
    const replay = await provisionStarteriaInternalLab(prisma, command);

    expect(first).toMatchObject({ created: true, replayed: false });
    expect(replay).toMatchObject({ created: false, replayed: true, organizationId: first.organizationId });
    expect(await prisma.organization.count({ where: { OR: [{ name: INTERNAL_LAB_NAME }, { slug: INTERNAL_LAB_SLUG }] } })).toBe(1);
    expect(await prisma.organizationMember.count({ where: { organizationId: first.organizationId, userId: ids.custodian } })).toBe(1);
    expect(await prisma.organizationPortfolioAccessGrant.findMany({
      where: { organizationId: first.organizationId, userId: ids.custodian },
      orderBy: { capability: 'asc' },
      select: { capability: true, grantedByUserId: true },
    })).toEqual([
      { capability: 'portfolio:read', grantedByUserId: ids.approver },
      { capability: 'portfolio:write', grantedByUserId: ids.approver },
    ]);
    expect(await prisma.auditLog.count({
      where: { action: INTERNAL_LAB_AUDIT_ACTION, resource: 'Organization', resourceId: first.organizationId },
    })).toBe(1);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.custodian }, select: { organizationId: true, roles: true } }))
      .toEqual({ organizationId: first.organizationId, roles: ['participante', 'portfolio_lead'] });
  });
});

async function cleanup() {
  const organizations = await prisma.organization.findMany({
    where: { OR: [{ name: INTERNAL_LAB_NAME }, { slug: INTERNAL_LAB_SLUG }] },
    select: { id: true },
  });
  const organizationIds = organizations.map((row) => row.id);
  await prisma.auditLog.deleteMany({ where: { action: INTERNAL_LAB_AUDIT_ACTION, userId: ids.approver } });
  await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.custodian, ids.approver] } } });
}
