import { PrismaClient } from '@prisma/client';
import { test, expect, request as pwRequest, type APIRequestContext, type Browser, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const EMAIL = process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123';
const prisma = new PrismaClient();

type Fixture = {
  userId: string;
  organizations: { a: string; b: string; c: string };
  states: { a: string; b: string };
};

function tokenFrom(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? body?.tokens?.accessToken ?? body?.accessToken ?? '';
}

async function login(api: APIRequestContext): Promise<string> {
  const response = await api.post('/api/v1/auth/login', { data: { email: EMAIL, password: PASSWORD }, failOnStatusCode: false });
  expect(response.status(), await response.text()).toBe(200);
  const token = tokenFrom(await response.json());
  expect(token).toBeTruthy();
  return token;
}

async function browserLogin(page: Page): Promise<unknown> {
  await page.goto('/auth');
  const result = await page.evaluate(async ({ email, password }) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { email: EMAIL, password: PASSWORD });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  const homeResponse = page.waitForResponse(response => response.url().includes('/api/v1/portfolio/home') && response.status() === 200);
  await page.goto('/portfolio/inicio');
  await expect(page.getByRole('heading', { name: /qué requiere atención hoy/i })).toBeVisible();
  return (await homeResponse).json();
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createFixture(): Promise<Fixture> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  const ids = {
    a: `ctx-e2e-a-${suffix}`,
    b: `ctx-e2e-b-${suffix}`,
    c: `ctx-e2e-c-${suffix}`,
  };
  await prisma.organization.createMany({ data: [
    { id: ids.a, name: `Context E2E A ${suffix}`, slug: `context-e2e-a-${suffix}`, seatLimit: 5 },
    { id: ids.b, name: `Context E2E B ${suffix}`, slug: `context-e2e-b-${suffix}`, seatLimit: 5 },
    { id: ids.c, name: `Context E2E C ${suffix}`, slug: `context-e2e-c-${suffix}`, seatLimit: 5 },
  ] });
  await prisma.organizationMember.createMany({ data: [
    { userId: user.id, organizationId: ids.a, role: 'member' },
    { userId: user.id, organizationId: ids.b, role: 'member' },
  ] });

  const stateIds = { a: `ctx-e2e-state-a-${suffix}`, b: `ctx-e2e-state-b-${suffix}` };
  for (const [key, organizationId] of [['a', ids.a], ['b', ids.b]] as const) {
    await prisma.strategicFramingProvisionalState.create({ data: {
      id: stateIds[key], userId: user.id, organizationId, sourceMode: 'enterprise_direct',
      logicalContextKey: stateIds[key], sourceRefs: [`e2e:sf7b3b1:${key}:${suffix}`], provenance: [],
      intendedMovement: `SF context marker ${key.toUpperCase()} ${suffix}`,
      whyItMatters: `La lectura pertenece exclusivamente a la organización ${key.toUpperCase()}.`,
      subjectLevel: 'challenge_like', scopeAssessment: { level: 'challenge_like', confidence: 'high', rationale: ['E2E fixture'], provenance: [] },
      parentStatus: 'unresolved', parentContext: { sourceRefs: [] }, sufficiencyStatus: 'sufficient', blockers: [], softGaps: [], optionalContext: [],
      version: 1, prioritizationState: { schemaVersion: 1, nonCanonical: true, focusSlots: null, focusRationale: null, candidates: [] },
      challengeStructuringState: { schemaVersion: 1, nonCanonical: true, candidates: [] },
    } as any });
  }
  return { userId: user.id, organizations: ids, states: stateIds };
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.portfolioContextSelection.deleteMany({ where: { actorUserId: fixture.userId } });
  await prisma.strategicFramingProvisionalState.deleteMany({ where: { id: { in: Object.values(fixture.states) } } });
  await prisma.organizationMember.deleteMany({ where: { userId: fixture.userId, organizationId: { in: Object.values(fixture.organizations) } } });
  await prisma.organization.deleteMany({ where: { id: { in: Object.values(fixture.organizations) } } });
}

async function selectOption(page: Page, name: string, selectorAlreadyOpen = false) {
  if (!selectorAlreadyOpen) {
    await page.locator('div.flex.justify-end').getByRole('button', { name: /seleccionar espacio|cambiar espacio|Context E2E/i }).click();
  }
  await expect(page.getByRole('option', { name })).toBeVisible();
  const contextPut = page.waitForResponse(response => response.url().includes('/api/v1/portfolio/context') && response.request().method() === 'PUT' && response.status() === 200);
  const homeGet = page.waitForResponse(response => response.url().includes('/api/v1/portfolio/home') && response.request().method() === 'GET' && response.status() === 200);
  await page.getByRole('option', { name }).click();
  await contextPut;
  await homeGet;
}

function currentContext(page: Page) {
  return page.locator('div.flex.justify-end').getByRole('button', { name: /Context E2E|Cambiar espacio/i });
}

test.describe('SF-7B.3B.1 Portfolio Context browser validation', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('E2E-CTX-01 single org auto context has no mandatory selector', async ({ page }) => {
    const home = await browserLogin(page) as any;
    await expect(page.getByText('Starteria E2E Portfolio', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /seleccionar espacio/i })).not.toBeVisible();
    const data = home.data;
    expect(data.portfolioContext.status).toBe('available');
    expect(data.strategicFraming.status).toBe('empty');
  });

  test('E2E-CTX-02..05 multi-org selection switches Home and SF data', async ({ page }) => {
    const fixture = await createFixture();
    try {
      await browserLogin(page);
      await expect(page.getByText('Tienes acceso a más de un espacio.', { exact: true })).toBeVisible();
      await expect(page.locator('div.flex.justify-end').getByRole('button', { name: 'Seleccionar espacio' })).toBeVisible();

      await page.locator('div.flex.justify-end').getByRole('button', { name: 'Seleccionar espacio' }).click();
      await expect(page.getByRole('option').filter({ hasText: 'Context E2E A' })).toBeVisible();
      await expect(page.getByRole('option').filter({ hasText: 'Context E2E B' })).toBeVisible();
      await expect(page.getByText(new RegExp(`Context E2E C`))).not.toBeVisible();
      await selectOption(page, 'Context E2E B', true);

      await expect(currentContext(page)).toContainText('Context E2E B');
      await expect(page.getByText(/SF context marker B/)).toBeVisible();
      await expect(page.getByText(new RegExp('SF context marker A'))).not.toBeVisible();
    } finally { await cleanupFixture(fixture); }
  });

  test('E2E-CTX-06 reload preserves the server-owned selection', async ({ page }) => {
    const fixture = await createFixture();
    try {
      await browserLogin(page);
      await selectOption(page, 'Context E2E B');
      const homeAfterReload = page.waitForResponse(response => response.url().includes('/api/v1/portfolio/home') && response.request().method() === 'GET' && response.status() === 200);
      await page.reload();
      await expect(currentContext(page)).toContainText('Context E2E B');
      const homeBody = await (await homeAfterReload).json();
      expect(homeBody.data.portfolioContext.current.name).toContain('Context E2E B');
      expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
    } finally { await cleanupFixture(fixture); }
  });

  test('E2E-CTX-07 two browser sessions remain isolated', async ({ browser }: { browser: Browser }) => {
    const fixture = await createFixture();
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      await Promise.all([browserLogin(pageA), browserLogin(pageB)]);
      await selectOption(pageA, 'Context E2E A');
      await selectOption(pageB, 'Context E2E B');
      await expect(currentContext(pageA)).toContainText('Context E2E A');
      await expect(currentContext(pageB)).toContainText('Context E2E B');
      await selectOption(pageA, 'Context E2E B');
      await expect(currentContext(pageA)).toContainText('Context E2E B');
      await expect(currentContext(pageB)).toContainText('Context E2E B');
    } finally { await contextA.close(); await contextB.close(); await cleanupFixture(fixture); }
  });

  test('E2E-CTX-08 unauthorized org is absent and direct selection is denied', async ({ page }) => {
    const fixture = await createFixture();
    const api = await pwRequest.newContext({ baseURL: BASE });
    try {
      await browserLogin(page);
      const token = await login(api);
      const denied = await api.put('/api/v1/portfolio/context', { headers: auth(token), data: { organizationId: fixture.organizations.c }, failOnStatusCode: false });
      expect(denied.status()).toBe(403);
      await page.reload();
      await page.locator('div.flex.justify-end').getByRole('button', { name: /seleccionar espacio|cambiar espacio|Context E2E/i }).click();
      await expect(page.getByText(/Context E2E C/)).not.toBeVisible();
    } finally { await api.dispose(); await cleanupFixture(fixture); }
  });

  test('E2E-CTX-09..10 uses composed Home only and no parallel SF fetch', async ({ page }) => {
    const fixture = await createFixture();
    try {
      const sfRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/v1/portfolio/strategic-framing/')) sfRequests.push(request.url());
      });
      await browserLogin(page);
      await selectOption(page, 'Context E2E B');
      expect(sfRequests).toEqual([]);
      expect(await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(key => /org|organization|context/i.test(key)))).toEqual([]);
    } finally { await cleanupFixture(fixture); }
  });

  test('E2E-CTX-11 membership revocation produces not_authorized without fallback', async ({ page }) => {
    const fixture = await createFixture();
    try {
      await browserLogin(page);
      await selectOption(page, 'Context E2E A');
      await prisma.organizationMember.deleteMany({ where: { userId: fixture.userId, organizationId: fixture.organizations.a } });
      await page.reload();
      await expect(page.getByText(/Tu acceso a este portafolio cambió/i)).toBeVisible();
      await expect(page.getByText('Context E2E A', { exact: true })).not.toBeVisible();
      await expect(page.locator('div.flex.justify-end').getByRole('button', { name: 'Cambiar espacio' })).toBeVisible();
      await selectOption(page, 'Context E2E B');
      await expect(currentContext(page)).toContainText('Context E2E B');
      await expect(page.getByText(/SF context marker B/)).toBeVisible();
    } finally { await cleanupFixture(fixture); }
  });

  test('E2E-CTX-13 selector remains operable at desktop, tablet, and mobile widths', async ({ page }) => {
    const fixture = await createFixture();
    try {
      await browserLogin(page);
      for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.locator('div.flex.justify-end').getByRole('button', { name: /seleccionar espacio|cambiar espacio|Context E2E/i }).click();
        await expect(page.getByRole('option').filter({ hasText: 'Context E2E A' })).toBeVisible();
        await page.keyboard.press('Escape');
      }
    } finally { await cleanupFixture(fixture); }
  });
});
