// Portfolio lead sembrado por prisma/seed.e2e.ts con Role.portfolio_lead (ADR-028), más una
// organización propia. No se le cambia el rol: portfolio-copilot-create-front.spec.ts lo pisa a
// mentor y por eso cae en el dashboard de mentor (es uno de los fallos conocidos de TESTING.md §6).
import { expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const LEAD_EMAIL = process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test';
export const LEAD_PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123';
const ORG_ID = 'org-e2e-job-driven';

export async function ensurePortfolioLead() {
  const user = await prisma.user.update({ where: { email: LEAD_EMAIL }, data: { isActive: true } });
  const organization = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: 'Starteria E2E Job Driven', slug: 'starteria-e2e-job-driven', seatLimit: 5 },
  });
  await prisma.user.update({ where: { id: user.id }, data: { organizationId: organization.id } });
  await prisma.organizationMember.createMany({
    data: [{ organizationId: organization.id, userId: user.id, role: 'admin' }],
    skipDuplicates: true,
  });
  return { userId: user.id, organizationId: organization.id };
}

export async function uiLoginLead(page: Page) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(LEAD_EMAIL);
  await page.locator('input[type="password"]').fill(LEAD_PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  // ADR-029: el login lleva a /dashboard aunque el usuario tenga acceso al portafolio.
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });
}
