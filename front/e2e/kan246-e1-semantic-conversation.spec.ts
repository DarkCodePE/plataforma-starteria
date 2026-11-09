import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

function accessToken(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? '';
}

async function registerLead(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `kan246-cafe-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: 'KAN-246 Cafetería', role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-246 Cafetería ${stamp}`, slug: `kan246-cafe-${stamp}` },
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
  return {
    email,
    password,
    userId,
    organizationId: organization.id,
    token: accessToken(await login.json()),
  };
}

async function loginUi(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Preparar nueva oportunidad' }).click();
  await expect(page.getByTestId('portfolio-semantic-conversation')).toBeVisible({ timeout: 20_000 });
}

async function answerObjective(page: Page, answer: string) {
  const objective = page.getByTestId('portfolio-objective-conversation');
  await objective.getByLabel('Tu respuesta').fill(answer);
  const persisted = page.waitForResponse((response) => response.request().method() === 'PATCH'
    && /\/portfolio-bootstrap\/sessions\/[^/]+\/anchor$/.test(new URL(response.url()).pathname));
  await objective.getByRole('button', { name: 'Enviar respuesta' }).click();
  expect((await persisted).status()).toBe(200);
}

test.describe('KAN-246 semantic E1 with authenticated disposable PostgreSQL', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('CA01..CA10 persists the narrative, reviews canonical context and preserves E1→E2→E3', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api);
    await loginUi(page, lead);
    const session = await prisma.portfolioBootstrapSession.findFirstOrThrow({ where: { userId: lead.userId } });
    const semanticPosts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith(`/sessions/${session.id}/context/semantic/turns`)) {
        semanticPosts.push(request.url());
      }
    });

    const narrative = 'Somos una cafetería de 4 personas. Nunca hemos probado desayunos para llevar ni pedidos a oficinas y queremos validar la oportunidad sin ampliar el local.';
    await page.getByTestId('portfolio-semantic-conversation').getByLabel('Tu respuesta').fill(narrative);
    const firstTurn = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/semantic/turns`));
    await page.getByTestId('portfolio-semantic-conversation').getByRole('button', { name: 'Enviar respuesta' }).dblclick();
    expect((await firstTurn).status()).toBe(200);
    await expect(page.getByRole('region', { name: 'Hechos observados' })).toContainText('situation');
    await expect(page.getByRole('region', { name: 'Hechos observados' })).toContainText('pilot experience: false');
    await expect(page.getByRole('region', { name: 'Pregunta activa' })).toContainText('resultado concreto');
    await expect(page.getByRole('region', { name: 'Pregunta activa' })).toContainText('Para qué:');
    await expect(page.getByRole('region', { name: 'Pregunta activa' })).not.toContainText(/piloto|departamento|área formal/i);
    expect(semanticPosts).toHaveLength(1);

    await page.reload();
    await expect(page.getByText(narrative, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('region', { name: 'Pregunta activa' })).toContainText('resultado concreto');

    const direction = 'Queremos validar si podemos conseguir veinte pedidos recurrentes por semana antes de invertir en equipamiento.';
    await page.getByTestId('portfolio-semantic-conversation').getByLabel('Tu respuesta').fill(direction);
    const secondTurn = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/semantic/turns`));
    await page.getByTestId('portfolio-semantic-conversation').getByRole('button', { name: 'Enviar respuesta' }).click();
    expect((await secondTurn).status()).toBe(200);
    await expect(page.getByRole('region', { name: 'Convergencia semántica' })).toBeVisible();

    const canonical = page.getByRole('region', { name: 'Síntesis canónica editable' });
    await canonical.getByLabel('Situación actual').fill(narrative);
    await canonical.getByLabel('Área o proceso').fill('Preparación y reparto de desayunos');
    await canonical.getByLabel('Personas implicadas').fill('La propietaria y las personas de oficinas cercanas');
    await canonical.getByLabel('Experiencia previa o piloto').fill('Todavía no se ha realizado un piloto formal');
    await canonical.getByLabel('Restricciones conocidas').fill('No ampliar el local durante la prueba');
    const saveDraft = page.waitForResponse((response) => response.request().method() === 'PUT'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/draft`));
    await canonical.getByRole('button', { name: 'Guardar síntesis editable' }).click();
    expect((await saveDraft).status()).toBe(200);

    const confirmContext = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/context/confirm`));
    await canonical.getByRole('button', { name: 'Confirmar contexto revisado' }).click();
    expect((await confirmContext).status()).toBe(200);
    await canonical.getByRole('button', { name: 'Continuar al objetivo' }).click();
    await expect(page.getByTestId('portfolio-objective-conversation')).toBeVisible();
    await expect(page.getByText('Configurar con Copilot · 2 de 7')).toBeVisible();

    await answerObjective(page, 'Validar una línea recurrente de desayunos para oficinas cercanas.');
    await answerObjective(page, 'La cafetería necesita validar demanda sin ampliar el local.');
    await answerObjective(page, 'Decidir si invertir en equipamiento y reparto.');
    await answerObjective(page, 'Número de pedidos recurrentes por semana.');
    const confirmObjective = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/sessions/${session.id}/anchor/confirm`));
    await page.getByTestId('portfolio-objective-conversation')
      .getByRole('button', { name: 'Confirmar este punto de partida y continuar' }).click();
    expect((await confirmObjective).status()).toBe(200);
    await page.getByRole('button', { name: 'Continuar a Incorporación' }).click();
    await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Configurar con Copilot · 3 de 7')).toBeVisible();

    const turns = await prisma.portfolioBootstrapSemanticTurn.findMany({
      where: { actorUserId: lead.userId },
      orderBy: { semanticVersion: 'asc' },
    });
    expect(turns).toHaveLength(2);
    expect(turns.map((turn) => turn.status)).toEqual(['completed', 'completed']);
    expect(turns.every((turn) => turn.provider === 'deterministic_test_adapter')).toBe(true);
    expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(0);
    expect(await prisma.step.count({ where: { project: { organizationId: lead.organizationId } } })).toBe(0);
    await api.dispose();
  });
});
