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
        headers: auth, data: { expectedVersion: 0, context, sourceCompanyContext: null },
        failOnStatusCode: false,
      });
      expect(draft.status(), await draft.text()).toBe(200);
      const confirmation = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/confirm`, {
        headers: auth, data: { expectedVersion: 1 }, failOnStatusCode: false,
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
