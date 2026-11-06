import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerLead(api: APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `kan222-${label}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-222 ${label}`, role: 'participante' }, failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-222 ${label} ${stamp}`, slug: `kan222-${label}-${stamp}` },
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

async function loginUi(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
  await expect(page.getByLabel('Situación actual')).toBeVisible({ timeout: 20_000 });
}

const apiContext = (situation: string) => ({
  situation: { value: situation, provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
  area: { value: null, provenance: 'unknown' },
  stakeholder: { value: null, provenance: 'unknown' },
  pilotExperience: { value: null, provenance: 'unknown' },
  constraints: [], assumptions: [], gaps: [],
});

test.describe('KAN-222 G1 contextual Copilot V2_CONFORMANCE', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('CA01..CA08 persists, confirms, corrects and re-enters E1 without bypassing E2/E3', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'journey');
    await loginUi(page, lead);
    const session = await prisma.portfolioBootstrapSession.findFirstOrThrow({ where: { userId: lead.userId } });
    const anchorBefore = await prisma.portfolioAnchor.findUnique({ where: { bootstrapSessionId: session.id } });

    await page.getByLabel('Situación actual').fill('El abandono aumentó durante la activación de clientes nuevos.');
    await page.getByLabel('Área o proceso').fill('Operaciones');
    const saveResponse = page.waitForResponse((response) => response.request().method() === 'PUT'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/draft`));
    await page.getByRole('button', { name: 'Guardar síntesis' }).click();
    const saved = await saveResponse;
    expect(saved.status(), await saved.text()).toBe(200);
    expect(saved.request().headers()['idempotency-key']).toMatch(/^portfolio-context-draft:/);
    expect(saved.request().postDataJSON()).toMatchObject({ expectedVersion: 0, sourceCompanyContext: null });

    const confirmResponse = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/confirm`));
    await page.getByRole('button', { name: 'Confirmar contexto' }).click();
    const confirmed = await confirmResponse;
    expect(confirmed.status(), await confirmed.text()).toBe(200);
    expect(confirmed.request().headers()['idempotency-key']).toMatch(/^portfolio-context-confirm:/);
    expect(confirmed.request().postDataJSON()).toEqual({ expectedVersion: 1 });
    await expect(page.getByRole('button', { name: /3 Incorporación/i })).toBeDisabled();
    expect(await prisma.portfolioAnchor.findUnique({ where: { bootstrapSessionId: session.id } })).toEqual(anchorBefore);

    await page.reload();
    await expect(page.getByText('El abandono aumentó durante la activación de clientes nuevos.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continuar al objetivo' }).click();
    await expect(page.getByTestId('portfolio-objective-conversation')).toBeVisible();
    await expect(page.getByRole('button', { name: /3 Incorporación/i })).toBeDisabled();

    const auth = bearer(lead.token);
    const anchor = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${session.id}/anchor`, {
      headers: auth,
      data: {
        contextSummary: 'El abandono aumentó durante la activación.',
        outcomeStatement: 'Reducir abandono durante la activación.',
        decisionToEnable: 'Decidir dónde intervenir este trimestre.',
        businessSignalStatus: 'confirmed',
        businessSignalValue: 'Activación a 30 días.',
      }, failOnStatusCode: false,
    });
    expect(anchor.status(), await anchor.text()).toBe(200);
    const anchorConfirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${session.id}/anchor/confirm`, {
      headers: auth, data: {}, failOnStatusCode: false,
    });
    expect(anchorConfirmed.status(), await anchorConfirmed.text()).toBe(200);
    await page.reload();
    await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /1 Contexto/i }).click();
    await page.getByLabel('Situación actual').fill('Corrección pendiente del contexto');
    await page.getByRole('button', { name: 'Guardar síntesis' }).click();
    await expect(page.getByText('Corrección pendiente de reconfirmación')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Corrección pendiente de reconfirmación')).toBeVisible();
    const review = await (prisma as any).portfolioBootstrapContextReview.findUniqueOrThrow({ where: { bootstrapSessionId: session.id } });
    expect(review.draftJson.situation.value).toBe('Corrección pendiente del contexto');
    expect(review.confirmedSnapshotJson.situation.value).toBe('El abandono aumentó durante la activación de clientes nuevos.');
    expect(review.version).toBe(3);
    await api.dispose();
  });

  test('CA05/CA08 keeps Company optional, returns owner-scoped 404 and rejects stale CAS', async () => {
    const api = await pwRequest.newContext({ baseURL });
    const tenantA = await registerLead(api, 'tenant-a');
    const tenantB = await registerLead(api, 'tenant-b');
    const authA = bearer(tenantA.token);
    const authB = bearer(tenantB.token);
    const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: authA, data: {}, failOnStatusCode: false });
    expect(direct.status(), await direct.text()).toBe(200);
    const sessionId = (await direct.json()).data.bootstrapSession.id as string;

    const first = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/draft`, {
      headers: { ...authA, 'Idempotency-Key': `kan222-a-${sessionId}` },
      data: { expectedVersion: 0, context: apiContext('Contexto privado tenant A'), sourceCompanyContext: null },
      failOnStatusCode: false,
    });
    expect(first.status(), await first.text()).toBe(200);
    const foreign = await api.get(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context`, { headers: authB, failOnStatusCode: false });
    expect(foreign.status(), await foreign.text()).toBe(404);
    expect(await foreign.text()).not.toContain('Contexto privado tenant A');
    const stale = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/draft`, {
      headers: { ...authA, 'Idempotency-Key': `kan222-stale-${sessionId}` },
      data: { expectedVersion: 0, context: apiContext('Intento stale'), sourceCompanyContext: null },
      failOnStatusCode: false,
    });
    expect(stale.status(), await stale.text()).toBe(409);
    await api.dispose();
  });
});
