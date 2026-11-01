import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TEST_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'demo123';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? TEST_PASSWORD;
export const E2E_ORG_ID = process.env.E2E_ORGANIZATION_ID ?? 'org-e2e-portfolio-adaptive';
export const E2E_OTHER_ORG_ID = 'org-e2e-other';
const AUTHORIZED_ROLE = process.env.E2E_USER_ROLE === 'participante'
  ? Role.participante
  : Role.portfolio_lead;

async function upsertUser(input: {
  email: string;
  name: string;
  role: Role;
  initials: string;
  organizationId: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.role,
      roles: [input.role],
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
      organizationId: input.organizationId,
    },
    create: {
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
      roles: [input.role],
      initials: input.initials,
      skills: ['E2E'],
      isActive: true,
      organizationId: input.organizationId,
    },
  });
  await prisma.organizationMember.createMany({
    data: [{ organizationId: input.organizationId, userId: user.id, role: input.role === Role.admin ? 'admin' : 'member' }],
    skipDuplicates: true,
  });
  return user;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run E2E seed in production.');
  }

  const organization = await prisma.organization.upsert({
    where: { id: E2E_ORG_ID },
    update: { name: 'Starteria E2E Portfolio', slug: 'starteria-e2e-portfolio', seatLimit: 8 },
    create: {
      id: E2E_ORG_ID,
      name: 'Starteria E2E Portfolio',
      slug: 'starteria-e2e-portfolio',
      seatLimit: 8,
    },
  });
  const otherOrganization = await prisma.organization.upsert({
    where: { id: E2E_OTHER_ORG_ID },
    update: { name: 'Starteria E2E Other Org', slug: 'starteria-e2e-other', seatLimit: 3 },
    create: {
      id: E2E_OTHER_ORG_ID,
      name: 'Starteria E2E Other Org',
      slug: 'starteria-e2e-other',
      seatLimit: 3,
    },
  });

  const authorized = await upsertUser({
    email: process.env.E2E_USER_EMAIL ?? 'portfolio.e2e@starteria.test',
    name: 'Portfolio E2E',
    // ADR-028: era `Role.mentor` porque `portfolio_lead` no existía y el front lo
    // suplía con VITE_PORTFOLIO_LEAD_EMAIL. Ahora es el rol de verdad — sin esto las
    // escrituras de portafolio de la suite responden 403.
    role: AUTHORIZED_ROLE,
    initials: 'PE',
    organizationId: organization.id,
    password: TEST_PASSWORD,
  });
  const admin = await upsertUser({
    email: process.env.E2E_ADMIN_EMAIL ?? 'portfolio-admin.e2e@starteria.test',
    name: 'Portfolio Admin E2E',
    role: Role.admin,
    initials: 'PA',
    organizationId: organization.id,
    password: ADMIN_PASSWORD,
  });
  const unauthorized = await upsertUser({
    email: process.env.E2E_UNAUTHORIZED_USER_EMAIL ?? 'viewer.e2e@starteria.test',
    name: 'Viewer E2E',
    role: Role.viewer,
    initials: 'VE',
    organizationId: organization.id,
    password: TEST_PASSWORD,
  });
  const otherOrgUser = await upsertUser({
    email: process.env.E2E_OTHER_ORG_USER_EMAIL ?? 'other-org.e2e@starteria.test',
    name: 'Other Org E2E',
    role: Role.mentor,
    initials: 'OE',
    organizationId: otherOrganization.id,
    password: TEST_PASSWORD,
  });

  await prisma.strategicFront.upsert({
    where: { id: 'front-e2e-existing' },
    update: {
      name: 'E2E Existing Strategic Front',
      organizationId: organization.id,
      ownerId: authorized.id,
    },
    create: {
      id: 'front-e2e-existing',
      name: 'E2E Existing Strategic Front',
      strategicObjective: 'Base portfolio data for E2E.',
      mainKpi: 'Cycle time',
      baseline: '10',
      target: '5',
      horizon: '3 months',
      sponsor: 'E2E Sponsor',
      priority: 'Media',
      organizationId: organization.id,
      ownerId: authorized.id,
    },
  });

  console.log('[seed:e2e] Seed completed.');
  console.log(`[seed:e2e] admin=${admin.email}`);
  console.log(`[seed:e2e] authorized=${authorized.email}`);
  console.log(`[seed:e2e] unauthorized=${unauthorized.email}`);
  console.log(`[seed:e2e] otherOrg=${otherOrgUser.email}`);
  console.log('[seed:e2e] password configured from E2E_USER_PASSWORD/E2E_ADMIN_PASSWORD');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
