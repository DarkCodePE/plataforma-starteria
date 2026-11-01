import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const EMAIL = process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'portfolio-admin.e2e@starteria.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || PASSWORD;
const ARTIFACTS = path.resolve(process.cwd(), '../artifacts/KAN-204');
const prisma = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });

type Scenario = {
  projectId: string;
  cycleId: string;
  linked: boolean;
  checkpointStates: Array<{ id: string; status: string }>;
  linkedContext: null | { metaId: string; frontId: string; challengeId: string; organizationId: string };
};

async function loginApi(api: APIRequestContext, email = EMAIL, password = PASSWORD) {
  const response = await api.post('/api/v1/auth/login', {
    data: { email, password },
    failOnStatusCode: false,
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  return { token: body.data.accessToken as string, userId: body.data.user.id as string };
}

async function createScenario(
  api: APIRequestContext,
  token: string,
  userId: string,
  linked: boolean,
): Promise<Scenario> {
  const suffix = `${linked ? 'linked' : 'independent'}-${Date.now()}`;
  const response = await api.post('/api/v1/projects', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: linked ? 'Reducir retrabajo del reto sintético' : 'Validar onboarding sintético independiente',
      description: linked
        ? 'Iniciativa sintética vinculada a Portfolio Lead; no representa datos productivos.'
        : 'Iniciativa sintética independiente; no representa datos productivos.',
    },
    failOnStatusCode: false,
  });
  expect(response.status(), await response.text()).toBe(201);
  const projectId = (await response.json()).data.id as string;
  const actor = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { organizationId: true },
  });
  expect(actor.organizationId).toBeTruthy();
  const organizationId = actor.organizationId!;
  let linkedContext: Scenario['linkedContext'] = null;

  await prisma.project.update({
    where: { id: projectId },
    data: { organizationId, currentStep: 0 },
  });

  if (linked) {
    const frontId = `kan204-front-${suffix}`;
    const challengeId = `kan204-challenge-${suffix}`;
    const metaId = `kan204-meta-${suffix}`;
    await prisma.strategicFront.create({
      data: {
        id: frontId,
        name: 'Eficiencia operativa sintética',
        strategicObjective: 'Reducir retrabajo sin inventar impacto.',
        organizationId,
        ownerId: userId,
      },
    });
    await prisma.challenge.create({
      data: {
        id: challengeId,
        strategicFrontId: frontId,
        title: 'Disminuir retrabajo entre equipos',
        objective: 'Identificar una señal verificable antes de decidir.',
        ownerId: userId,
      },
    });
    await prisma.initiativePortfolioMeta.create({
      data: {
        id: metaId,
        projectId,
        challengeId,
        strategicFrontId: frontId,
        teamOwner: 'Cuenta sintética E2E',
        currentStep: '0',
      },
    });
    linkedContext = { metaId, frontId, challengeId, organizationId };
  }

  const activation = await api.post(`/api/v1/projects/${projectId}/adaptive-core/activation`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      idempotencyKey: `kan204-${suffix}`,
      expectedVersion: 0,
      origin: { kind: 'DIRECT_PROJECT' },
    },
    failOnStatusCode: false,
  });
  expect(activation.status(), await activation.text()).toBe(200);

  if (linked) {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { step0Data: true } });
    await prisma.project.update({
      where: { id: projectId },
      data: { step0Data: { ...((project.step0Data as Record<string, unknown> | null) ?? {}), mode: 'linked_to_challenge' } },
    });
  }

  const cycle = await prisma.initiativeCycle.findFirstOrThrow({
    where: { projectId, status: 'active' },
    orderBy: { cycleNumber: 'desc' },
  });
  const checkpointStates = await prisma.adaptiveCheckpointInstance.findMany({
    where: { projectId, cycleId: cycle.id },
    select: { id: true, status: true },
    orderBy: { sequence: 'asc' },
  });
  return { projectId, cycleId: cycle.id, linked, checkpointStates, linkedContext };
}

async function loginUi(page: Page) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page).not.toHaveURL(/\/auth/);
}

async function openScenario(page: Page, scenario: Scenario) {
  await page.goto(`/projects/${scenario.projectId}/step/0`);
  await expect(page.getByRole('heading', { name: 'Conversa con Startería' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('step-reasoning-composer')).toBeVisible();
  await expect(page.getByText(scenario.linked ? 'Iniciativa dentro de reto' : 'Proyecto independiente')).toBeVisible();
}

async function sendSyntheticTurn(page: Page, message: string) {
  await page.getByLabel(/Cuéntale a Starteria/i).fill(message);
  await page.getByRole('button', { name: /^Enviar mensaje$/ }).click();
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByText(/Respuesta de integración QA · no es razonamiento de un LLM/i).last()).toBeVisible();
  await expect(page.getByText(/Simulación QA: he registrado tu aportación/i).last()).toBeVisible();
}

async function assertCanonicalContinuity(scenario: Scenario) {
  const cycle = await prisma.initiativeCycle.findUniqueOrThrow({ where: { id: scenario.cycleId } });
  expect(cycle.currentStep).toBe(0);
  expect(cycle.status).toBe('active');
  expect(await prisma.initiativeCycle.count({ where: { projectId: scenario.projectId } })).toBe(1);
  expect(await prisma.adaptiveStepOutput.count({ where: { projectId: scenario.projectId } })).toBe(0);
  const checkpoints = await prisma.adaptiveCheckpointInstance.findMany({
    where: { projectId: scenario.projectId, cycleId: scenario.cycleId },
    select: { id: true, status: true },
    orderBy: { sequence: 'asc' },
  });
  expect(checkpoints).toEqual(scenario.checkpointStates);
  if (scenario.linkedContext) {
    const { metaId, frontId, challengeId, organizationId } = scenario.linkedContext;
    const [meta, front, challenge] = await Promise.all([
      prisma.initiativePortfolioMeta.findUnique({ where: { id: metaId } }),
      prisma.strategicFront.findUnique({ where: { id: frontId } }),
      prisma.challenge.findUnique({ where: { id: challengeId } }),
    ]);
    expect(meta).toMatchObject({ projectId: scenario.projectId, strategicFrontId: frontId, challengeId });
    expect(front).toMatchObject({ id: frontId, organizationId });
    expect(challenge).toMatchObject({ id: challengeId, strategicFrontId: frontId });
  }
}

test.afterAll(async () => prisma.$disconnect());

test('KAN-204: Copilot simulado conserva continuidad en iniciativa independiente y vinculada', async ({ page, request, browser }) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  const apiSession = await loginApi(request);
  expect(apiSession.userId).toBe(process.env.STEP_REASONING_QA_USER_ID);
  const independent = await createScenario(request, apiSession.token, apiSession.userId, false);
  const linked = await createScenario(request, apiSession.token, apiSession.userId, true);
  const secondActor = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  expect(secondActor.userId).not.toBe(apiSession.userId);
  const denied = await request.get(`/api/v1/projects/${independent.projectId}/steps/0/copilot/session`, {
    headers: { Authorization: `Bearer ${secondActor.token}` },
    failOnStatusCode: false,
  });
  expect(denied.status()).toBe(403);
  expect(await denied.json()).toMatchObject({ error: { code: 'STEP_REASONING_QA_ACCOUNT_REQUIRED' } });

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginUi(page);
  const domainPosts: string[] = [];
  page.on('request', requestEvent => {
    if (requestEvent.method() === 'POST' && !requestEvent.url().includes('/auth/')) {
      domainPosts.push(new URL(requestEvent.url()).pathname);
    }
  });
  await openScenario(page, independent);
  await sendSyntheticTurn(page, 'Dato sintético: necesitamos observar dónde empieza el retrabajo.');
  await expect(page.getByText(/no confirma checkpoints ni cambia el progreso/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText('Dato sintético: necesitamos observar dónde empieza el retrabajo.')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'independent-desktop-1440x900.png'), fullPage: true });
  await assertCanonicalContinuity(independent);

  await openScenario(page, linked);
  const contextButton = page.getByRole('button', { name: /Ver contexto y fuentes/i });
  await contextButton.click();
  await expect(page.getByText('Reto vinculado en Adaptive Core')).toBeVisible();
  await expect(page.getByText('Disminuir retrabajo entre equipos').first()).toBeVisible();
  await sendSyntheticTurn(page, 'Dato sintético: la señal del reto debe revisarse con la persona responsable.');
  await page.reload();
  await expect(page.getByText('Dato sintético: la señal del reto debe revisarse con la persona responsable.')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'portfolio-linked-desktop-1440x900.png'), fullPage: true });
  await assertCanonicalContinuity(linked);

  const storageState = await page.context().storageState();
  const mobileContext = await browser.newContext({ storageState, viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  await openScenario(mobile, linked);
  await expect(mobile.getByTestId('step-reasoning-composer')).toBeVisible();
  const dimensions = await mobile.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await mobile.screenshot({ path: path.join(ARTIFACTS, 'portfolio-linked-mobile-390x844.png'), fullPage: true });
  await mobileContext.close();

  expect(domainPosts).toEqual([
    `/api/v1/projects/${independent.projectId}/steps/0/copilot/turn`,
    `/api/v1/projects/${linked.projectId}/steps/0/copilot/turn`,
  ]);

  const observedTurns = await prisma.stepReasoningTurn.findMany({
    where: { session: { projectId: { in: [independent.projectId, linked.projectId] } } },
    select: { providerModel: true, tokensUsed: true, costUsd: true },
  });
  expect(observedTurns).toHaveLength(2);
  expect(observedTurns).toEqual(expect.arrayContaining([
    expect.objectContaining({ providerModel: 'qa-stub/kan-204-step-reasoning', tokensUsed: 0, costUsd: 0 }),
    expect.objectContaining({ providerModel: 'qa-stub/kan-204-step-reasoning', tokensUsed: 0, costUsd: 0 }),
  ]));
  const observedProviderModels = [...new Set(observedTurns.map(turn => turn.providerModel))];

  const evidence = {
    generatedAt: new Date().toISOString(),
    dataClassification: 'synthetic-disposable',
    provider: 'qa-stub/kan-204-step-reasoning',
    observedProviderModels,
    liveProviderObserved: observedProviderModels.some(model => model !== 'qa-stub/kan-204-step-reasoning'),
    secondAuthenticatedActorDenied: true,
    scenarios: [
      { kind: 'independent', projectId: independent.projectId, cycleId: independent.cycleId, continuity: 'PASS' },
      { kind: 'portfolio-linked', projectId: linked.projectId, cycleId: linked.cycleId, continuity: 'PASS' },
    ],
    domainPosts,
    assertions: [
      'Copilot is the primary interaction for the allow-listed synthetic actor.',
      'Progress/output card and official checkpoint remain separate human-review surfaces.',
      'Conversation persistence does not advance, restart or duplicate the Adaptive Cycle.',
      'No checkpoint or AdaptiveStepOutput is confirmed from a Copilot message.',
    ],
  };
  writeFileSync(path.join(ARTIFACTS, 'KAN204_BROWSER_EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
});
