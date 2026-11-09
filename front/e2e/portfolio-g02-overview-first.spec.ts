/**
 * G02 browser gate: Inicio must be overview-first, with an explicit action to
 * create/resume E1. Uses a real tenant and the persisted Bootstrap API.
 * No screenshots/mock assertions are accepted as evidence of backend state.
 */
import { PrismaClient } from '@prisma/client';
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5176';

async function registerLead(api: APIRequestContext, scenario: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const email = `g02-${scenario}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const register = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `G02 ${scenario} ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(register.status(), await register.text()).toBe(201);
  const userId = (await register.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `G02 ${scenario} ${stamp}`, slug: `g02-${scenario}-${stamp}` },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { userId, organizationId: organization.id, role: 'owner' },
  });
  await prisma.organizationPortfolioAccessGrant.createMany({
    data: ['portfolio:read', 'portfolio:write'].map((capability) => ({
      userId, organizationId: organization.id, capability,
    })),
  });
  const login = await api.post('/api/v1/auth/login', {
    data: { email, password }, failOnStatusCode: false,
  });
  expect(login.status(), await login.text()).toBe(200);
  const loginBody = await login.json();
  const token = loginBody?.data?.tokens?.accessToken ?? loginBody?.data?.accessToken;
  expect(token).toBeTruthy();
  return { email, password, userId, organizationId: organization.id, token: token as string };
}

async function loginBrowser(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20000 });
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
}

test.describe('G02 authenticated overview-first and resumable Bootstrap', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('sin proceso: Inicio presenta overview y no crea una sesión al abrir o recargar', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    try {
      const lead = await registerLead(api, 'empty');
      const before = await prisma.portfolioBootstrapSession.count({
        where: { userId: lead.userId },
      });
      expect(before).toBe(0);
      await loginBrowser(page, lead);
      await expect(page.getByRole('heading', { name: '¿Qué necesita tu atención para mover el negocio?' })).toBeVisible();
      await expect(page.getByTestId('portfolio-resumable-workspaces')).toBeVisible();
      await expect(page.getByText('No hay preparaciones pendientes')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Preparar nueva oportunidad' })).toBeVisible();
      expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(0);

      await page.reload();
      await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
      expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(0);
    } finally { await api.dispose(); }
  });

  test('E1 confirmado retoma directamente en E2 sin crear otra sesión ni confirmar el objetivo', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    try {
      const lead = await registerLead(api, 'e1-e2');
      const auth = { Authorization: `Bearer ${lead.token}` };
      const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', {
        headers: auth, data: {}, failOnStatusCode: false,
      });
      expect(direct.status(), await direct.text()).toBe(200);
      const sessionId = (await direct.json()).data.bootstrapSession.id as string;
      const context = {
        situation: { value: 'Somos una cafetería que quiere entender la demanda de desayunos para oficinas.', provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
        area: { value: null, provenance: 'unknown' },
        stakeholder: { value: null, provenance: 'unknown' },
        pilotExperience: { value: null, provenance: 'unknown' },
        constraints: [], assumptions: [], gaps: [],
      };
      const draft = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/draft`, {
        headers: { ...auth, 'Idempotency-Key': `g02-context-draft:${sessionId}:v0` }, data: { expectedVersion: 0, context, sourceCompanyContext: null },
        failOnStatusCode: false,
      });
      expect(draft.status(), await draft.text()).toBe(200);
      const confirmation = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/confirm`, {
        headers: { ...auth, 'Idempotency-Key': `g02-context-confirm:${sessionId}:v1` }, data: { expectedVersion: 1 }, failOnStatusCode: false,
      });
      expect(confirmation.status(), await confirmation.text()).toBe(200);

      const before = await prisma.portfolioAnchor.findUniqueOrThrow({ where: { bootstrapSessionId: sessionId } });
      await loginBrowser(page, lead);
      await expect(page.getByTestId('portfolio-resumable-session')).toHaveCount(1);
      await page.getByRole('button', { name: 'Retomar este espacio' }).click();
      await expect(page.getByTestId('portfolio-objective-conversation')).toBeVisible({ timeout: 20000 });
      await expect(page.getByRole('button', { name: /3 Incorporación/i })).toBeDisabled();
      expect(await prisma.portfolioAnchor.findUnique({ where: { bootstrapSessionId: sessionId } })).toEqual(before);

      await page.reload();
      await expect(page.getByTestId('portfolio-objective-conversation')).toBeVisible({ timeout: 20000 });
      const review = await prisma.portfolioBootstrapContextReview.findUniqueOrThrow({
        where: { bootstrapSessionId: sessionId },
      });
      expect(review.status).toBe('confirmed');
      expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(1);
      expect(await prisma.portfolioAnchor.findUnique({ where: { bootstrapSessionId: sessionId } })).toEqual(before);
    } finally { await api.dispose(); }
  });

  test('E1 confirmado → conversación E2 → checkpoint humano → E3 sin iniciativas', async ({ page }) => {
    test.skip(process.env.G02_E2_CHECKPOINT_BROWSER_TEST !== 'true', 'Solo en runner aislado con flags E2 explícitas');
    const api = await pwRequest.newContext({ baseURL });
    try {
      const lead = await registerLead(api, 'e2-checkpoint');
      const auth = { Authorization: `Bearer ${lead.token}` };
      const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', {
        headers: auth, data: {}, failOnStatusCode: false,
      });
      expect(direct.status(), await direct.text()).toBe(200);
      const sessionId = (await direct.json()).data.bootstrapSession.id as string;
      const context = {
        situation: { value: 'Cafetería pequeña, sin iniciativas ni equipo de innovación. Queremos probar un servicio para oficinas.', provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
        area: { value: null, provenance: 'unknown' },
        stakeholder: { value: null, provenance: 'unknown' },
        pilotExperience: { value: null, provenance: 'unknown' },
        constraints: [], assumptions: [], gaps: [],
      };
      const draft = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/draft`, {
        headers: { ...auth, 'Idempotency-Key': `g02-e2-draft:${sessionId}:v0` },
        data: { expectedVersion: 0, context, sourceCompanyContext: null },
        failOnStatusCode: false,
      });
      expect(draft.status(), await draft.text()).toBe(200);
      const confirmedE1 = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/confirm`, {
        headers: { ...auth, 'Idempotency-Key': `g02-e2-confirm:${sessionId}:v1` },
        data: { expectedVersion: 1 }, failOnStatusCode: false,
      });
      expect(confirmedE1.status(), await confirmedE1.text()).toBe(200);

      const before = await prisma.portfolioAnchor.findUniqueOrThrow({ where: { bootstrapSessionId: sessionId } });
      await loginBrowser(page, lead);
      await page.getByRole('button', { name: 'Retomar este espacio' }).click();
      const conversation = page.getByTestId('portfolio-goal-ledger-conversation');
      await expect(conversation).toBeVisible({ timeout: 20000 });

      const answers = [
        { field: 'outcomeStatement', value: 'Validar pedidos de desayuno para oficinas cercanas.' },
        { field: 'decisionToEnable', value: 'Decidir si hacer un piloto pagado con tres oficinas.' },
        { field: 'contextSummary', value: 'Somos una cafetería de barrio, sin iniciativas en marcha.' },
        { field: 'businessSignalValue', value: 'Número de oficinas que realizan pedidos.' },
      ];
      for (let index = 0; index < answers.length; index++) {
        const plan = await api.get(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/objective/plan`, {
          headers: auth, failOnStatusCode: false,
        });
        expect(plan.status(), await plan.text()).toBe(200);
        expect((await plan.json()).data.activeQuestion?.field).toBe(answers[index].field);
        await expect(conversation.getByRole('region', { name: 'Pregunta de Objetivo' })).toBeVisible();
        await conversation.getByLabel('Tu respuesta de Objetivo').fill(answers[index].value);
        const response = page.waitForResponse((res) =>
          res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith(`/sessions/${sessionId}/objective/turns`));
        await conversation.getByRole('button', { name: 'Guardar respuesta provisional' }).click();
        const saved = await response;
        expect(saved.status(), await saved.text()).toBe(200);
        await expect.poll(async () => prisma.portfolioBootstrapGoalTurn.count({
          where: { bootstrapSessionId: sessionId },
        })).toBe(index + 1);
        expect((await prisma.portfolioAnchor.findUnique({ where: { bootstrapSessionId: sessionId } }))?.version)
          .toBe(before.version);
      }
      await expect(conversation.getByRole('region', { name: 'Revisión completa del objetivo' })).toBeVisible();
      const review = conversation.getByRole('region', { name: 'Revisión completa del objetivo' });
      for (const field of ['Resultado esperado', 'Decisión a habilitar', 'Contexto', 'KPI o señal']) {
        await review.getByRole('group', { name: field }).getByRole('radio', { name: 'Incorporar' }).check();
      }
      const checkpointResponse = page.waitForResponse((res) =>
        res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith(`/sessions/${sessionId}/objective/checkpoint`));
      await review.getByRole('button', { name: 'Aplicar decisiones al borrador' }).click();
      const checkpoint = await checkpointResponse;
      expect(checkpoint.status(), await checkpoint.text()).toBe(200);
      await expect.poll(async () => (await prisma.portfolioAnchor.findUnique({
        where: { bootstrapSessionId: sessionId },
      }))?.status).toBe('anchor_sufficient');

      const applied = await prisma.portfolioAnchor.findUniqueOrThrow({ where: { bootstrapSessionId: sessionId } });
      expect(applied.confirmedBy).toBeNull();
      expect(applied.version).toBe(before.version + 1);
      await expect(conversation.getByRole('button', { name: 'Confirmar objetivo y continuar' })).toBeVisible();
      const finalConfirmResponse = page.waitForResponse((res) =>
        res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith(`/sessions/${sessionId}/anchor/confirm`));
      await conversation.getByRole('button', { name: 'Confirmar objetivo y continuar' }).click();
      const finalConfirm = await finalConfirmResponse;
      expect(finalConfirm.status(), await finalConfirm.text()).toBe(200);
      await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20000 });
      expect((await prisma.portfolioAnchor.findUniqueOrThrow({
        where: { bootstrapSessionId: sessionId },
      })).status).toBe('anchor_confirmed');
      expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(1);
    } finally { await api.dispose(); }
  });

  test('con proceso: Inicio muestra reentrada y solo abre el Bootstrap por acción explícita', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    try {
      const lead = await registerLead(api, 'resume');
      const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', {
        headers: { Authorization: `Bearer ${lead.token}` },
        data: {}, failOnStatusCode: false,
      });
      expect(direct.status(), await direct.text()).toBe(200);
      const sessionId = (await direct.json()).data.bootstrapSession.id as string;
      const before = await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } });
      await loginBrowser(page, lead);
      await expect(page.getByTestId('portfolio-resumable-session')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Retomar este espacio' })).toBeVisible();
      expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(before);
      await page.reload();
      await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
      await page.getByRole('button', { name: 'Retomar este espacio' }).click();
      await expect(page.getByTestId('portfolio-bootstrap-home-a')).toBeVisible({ timeout: 20000 });
      expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(before);
      const session = await prisma.portfolioBootstrapSession.findUnique({ where: { id: sessionId } });
      expect(session?.userId).toBe(lead.userId);
    } finally { await api.dispose(); }
  });
});
