import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerLead(api: APIRequestContext, suffix: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `kan212-${suffix}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-212 ${suffix} ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-212 ${suffix} ${stamp}`, slug: `kan212-${suffix}-${stamp}` },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true },
  });
  await prisma.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'owner' } });
  await prisma.organizationPortfolioAccessGrant.createMany({
    data: ['portfolio:read', 'portfolio:write'].map((capability) => ({ userId, organizationId: organization.id, capability })),
  });
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(login.status(), await login.text()).toBe(200);
  return { email, password, userId, organizationId: organization.id, token: accessToken(await login.json()) };
}

async function prepareConfirmedIntake(api: APIRequestContext, lead: Awaited<ReturnType<typeof registerLead>>) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', {
    headers: auth,
    data: {},
    failOnStatusCode: false,
  });
  expect(direct.status(), await direct.text()).toBe(200);
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  const updated = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
    headers: auth,
    data: {
      contextSummary: 'El equipo necesita revisar trabajo existente sin perder trazabilidad.',
      outcomeStatement: 'Reducir el abandono durante la activación B2B.',
      decisionToEnable: 'Decidir qué trabajo continuar durante el trimestre.',
      businessSignalStatus: 'confirmed',
      businessSignalValue: 'Activación a 30 días.',
    },
    failOnStatusCode: false,
  });
  expect(updated.status(), await updated.text()).toBe(200);
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, {
    headers: auth,
    data: {},
    failOnStatusCode: false,
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return sessionId;
}

async function loginUi(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
  await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });
}

async function canonicalCounts() {
  const [fronts, challenges, projects, steps, decisions, initiativePortfolioMetas] = await Promise.all([
    prisma.strategicFront.count(),
    prisma.challenge.count(),
    prisma.project.count(),
    prisma.step.count(),
    prisma.decision.count(),
    prisma.initiativePortfolioMeta.count(),
  ]);
  return { fronts, challenges, projects, steps, decisions, initiativePortfolioMetas };
}

test.describe('KAN-212 G2-A V2_CONFORMANCE', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('no-work persists B3, skips analysis, requires the CTA, and asks again after refresh', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'no-work');
    const sessionId = await prepareConfirmedIntake(api, lead);
    const before = await canonicalCounts();
    await loginUi(page, lead);

    await page.getByRole('button', { name: /Todavia no tenemos iniciativas/i }).click();
    await page.getByRole('button', { name: /Todavia no tenemos iniciativas activas/i }).click();
    await expect.poll(async () => prisma.portfolioBootstrapSession.findUnique({ where: { id: sessionId } }))
      .toMatchObject({ bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING', existingWorkStatus: 'no_existing_work' });
    expect(await prisma.portfolioBootstrapWorkItem.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
    expect(await prisma.portfolioBootstrapAnalysisRun.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
    await expect(page.getByRole('button', { name: /4 Análisis/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /5 Organización/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /7 Asignación/i })).toBeDisabled();

    const continueWithoutWork = page.getByRole('button', { name: 'Continuar sin iniciativas', exact: true });
    await expect(continueWithoutWork).toBeEnabled();
    await continueWithoutWork.click();
    await expect(page.getByTestId('portfolio-organization-cascade')).toBeVisible();
    await expect(page.getByRole('button', { name: /6 Briefs/i })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('g2a-no-work-organization.png'), fullPage: true });

    await page.reload();
    await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Continuar sin iniciativas', exact: true })).toBeVisible();
    await expect(page.getByTestId('portfolio-organization-cascade')).toHaveCount(0);
    expect(await canonicalCounts()).toEqual(before);
    await api.dispose();
  });

  test('work remains in E3 until persisted B4 and re-enters the material review without duplicates', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'with-work');
    const sessionId = await prepareConfirmedIntake(api, lead);
    const before = await canonicalCounts();
    await loginUi(page, lead);

    await page.getByRole('button', { name: 'Anadir manualmente' }).click();
    await page.getByLabel('Nombre o descripcion breve').fill('Onboarding guiado');
    await page.getByLabel('Que intenta conseguir').fill('Reducir fricción durante la activación.');
    await page.getByRole('button', { name: 'Agregar trabajo' }).click();
    await expect(page.getByText(/1 iniciativas detectadas/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '¿Qué está haciendo hoy tu organización?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /4 Análisis/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /5 Organización/i })).toBeDisabled();
    await expect.poll(async () => prisma.portfolioBootstrapSession.findUnique({ where: { id: sessionId } }))
      .toMatchObject({ bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING', existingWorkStatus: 'has_work' });

    await page.getByRole('button', { name: 'Analizar 1 iniciativas' }).click();
    await expect(page.getByTestId('portfolio-bootstrap-material-review')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => prisma.portfolioBootstrapSession.findUnique({ where: { id: sessionId } }))
      .toMatchObject({ bootstrapPhase: 'B4_MATERIAL_REVIEW', existingWorkStatus: 'has_work' });
    expect(await prisma.portfolioBootstrapWorkItem.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    expect(await prisma.portfolioBootstrapAnalysisRun.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    await expect(page.getByRole('button', { name: /5 Organización/i })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('g2a-b4-material-review.png'), fullPage: true });

    await page.reload();
    await expect(page.getByTestId('portfolio-bootstrap-material-review')).toBeVisible({ timeout: 20_000 });
    expect(await prisma.portfolioBootstrapWorkItem.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    expect(await prisma.portfolioBootstrapAnalysisRun.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    expect(await canonicalCounts()).toEqual(before);
    await api.dispose();
  });
});
