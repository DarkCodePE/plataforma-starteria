import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

function accessToken(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? '';
}

async function registerLead(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `kan241-cafe-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: 'KAN-241 Cafetería', role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-241 Cafetería ${stamp}`, slug: `kan241-cafe-${stamp}` },
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
  return { email, password, userId, token: accessToken(await login.json()) };
}

async function loginUi(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Preparar nueva oportunidad' }).click();
  await expect(page.getByText('Configurar con Copilot · 1 de 7')).toBeVisible({ timeout: 20_000 });
}

test.describe('KAN-241 G1 adaptive context with disposable PostgreSQL', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('CA01..CA08 persists a small-business conversation and re-enters E2 without repetition or loss', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api);
    await loginUi(page, lead);
    const session = await prisma.portfolioBootstrapSession.findFirstOrThrow({ where: { userId: lead.userId } });

    await page.getByLabel('Tu respuesta').fill('Somos una cafetería con dos años de actividad y queremos probar desayunos para llevar para oficinas cercanas sin ampliar el local.');
    const firstSave = page.waitForResponse((response) => response.request().method() === 'PUT'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/draft`));
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    expect((await firstSave).status()).toBe(200);

    await expect(page.getByText(/parte de la actividad/i)).toBeVisible();
    await page.getByRole('button', { name: 'No aplica en este caso' }).click();
    await expect(page.getByText(/quién atendería este cambio y quién compraría/i)).toBeVisible();

    await page.getByLabel('Tu respuesta').fill('Yo atendería los pedidos y los comprarían personas de oficinas cercanas.');
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await expect(page.getByText(/habéis probado algo parecido/i)).toBeVisible();
    await page.getByRole('button', { name: 'No aplica en este caso' }).click();

    await page.getByRole('button', { name: 'Revisar contexto' }).click();
    await expect(page.getByLabel('Situación actual')).toHaveValue(/cafetería/i);
    await expect(page.getByText('No aplica en este caso').first()).toBeVisible();

    const confirm = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/confirm`));
    await page.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' }).click();
    expect((await confirm).status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' })).toBeVisible();
    await page.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' }).click();
    await expect(page.getByTestId('portfolio-objective-conversation')).toBeVisible();
    await expect(page.getByText('Configurar con Copilot · 2 de 7')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('portfolio-objective-conversation')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Contexto Revisado o completado/i }).click();
    await expect(page.getByText(/quién atendería este cambio/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' })).toBeVisible();

    const persisted = await prisma.portfolioBootstrapContextReview.findUniqueOrThrow({
      where: { bootstrapSessionId: session.id },
    });
    expect(persisted.status).toBe('confirmed');
    expect(persisted.confirmedSnapshotJson).toMatchObject({
      situation: { provenance: 'user_declared' },
      area: { value: null, provenance: 'unknown' },
      gaps: expect.arrayContaining([
        'context-disposition:area:not_applicable',
        'context-disposition:pilotExperience:not_applicable',
      ]),
    });
    await api.dispose();
  });
});
