import { expect, request as pwRequest, test, type APIRequestContext, type Frame, type Page, type TestInfo } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

type CapturedJsonResponse<T = any> = {
  status: number;
  url: string;
  body: T;
};

type CapturedResponseMeta = {
  status: number;
  url: string;
};

async function readPortfolioEntryIdentity(page: Page) {
  return page.evaluate(() => {
    const raw = window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession');
    if (!raw) return null;
    const identity = JSON.parse(raw);
    return {
      source: identity.source,
      sessionId: identity.sessionId,
      sessionRevision: identity.sessionRevision,
      handoffId: identity.handoffId,
      handoffVersion: identity.handoffVersion,
      confirmationId: identity.confirmationId,
      confirmationVersion: identity.confirmationVersion,
    };
  }).catch(() => null);
}

async function captureJsonResponse<T = any>(page: Page, label: string) {
  const bindingName = `__starteriaConfirmedBriefCapture_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let resolveCapture!: (capture: { status: number; url: string; body?: T; bodyError?: string }) => void;
  const capturePromise = new Promise<{ status: number; url: string; body?: T; bodyError?: string }>(resolve => {
    resolveCapture = resolve;
  });

  await page.exposeBinding(bindingName, (_source, capture: { status: number; url: string; body?: T; bodyError?: string }) => {
    resolveCapture(capture);
  });

  const responsePromise = capturePromise.then(async capture => {
    if (capture.bodyError || capture.body === undefined) {
      const identity = await readPortfolioEntryIdentity(page);
      throw new Error(
        `${label} response body capture failed; url=${capture.url}; status=${capture.status}; ` +
        `pageURL=${page.url()}; identity=${JSON.stringify(identity)}; ` +
        `cause=${capture.bodyError ?? 'response body was not captured'}`,
      );
    }
    return { status: capture.status, url: capture.url, body: capture.body };
  });

  const installCapture = (exposedBindingName: string) => {
    const captureWindow = window as Window & {
      __starteriaConfirmedBriefCaptureInstalled?: boolean;
      __starteriaConfirmedBriefCaptureSink?: string;
    };
    captureWindow.__starteriaConfirmedBriefCaptureSink = exposedBindingName;
    if (captureWindow.__starteriaConfirmedBriefCaptureInstalled) return;
    captureWindow.__starteriaConfirmedBriefCaptureInstalled = true;

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      (this as XMLHttpRequest & { __starteriaMethod?: string }).__starteriaMethod = method;
      return originalOpen.call(this, method, url, ...rest);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args: Parameters<XMLHttpRequest['send']>) {
      this.addEventListener('loadend', () => {
        const method = (this as XMLHttpRequest & { __starteriaMethod?: string }).__starteriaMethod;
        let url: URL;
        try {
          url = new URL(this.responseURL);
        } catch {
          return;
        }
        if (method !== 'GET' || !/^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/confirmed-brief$/.test(url.pathname)) return;
        const capture: { status: number; url: string; body?: unknown; bodyError?: string } = {
          status: this.status,
          url: this.responseURL,
        };
        try {
          capture.body = JSON.parse(this.responseText);
        } catch {
          capture.bodyError = 'response body was not valid JSON';
        }
        const sinkName = captureWindow.__starteriaConfirmedBriefCaptureSink;
        const sink = sinkName && (window as unknown as Record<string, (payload: typeof capture) => Promise<void>>)[sinkName];
        if (sink) void sink(capture);
      }, { once: true });
      return originalSend.apply(this, args);
    };
  };

  await page.addInitScript(installCapture, bindingName);
  await page.evaluate(installCapture, bindingName);
  return { response: responsePromise };
}

function captureResponseMeta(page: Page, label: string, predicate: Parameters<Page['waitForResponse']>[0]) {
  return page.waitForResponse(predicate).then((response): CapturedResponseMeta => {
    return { status: response.status(), url: response.url() };
  }).catch(async (error) => {
    const identity = await readPortfolioEntryIdentity(page);
    throw new Error(
      `${label} response capture failed; pageURL=${page.url()}; ` +
      `identity=${JSON.stringify(identity)}; cause=${error instanceof Error ? error.message : String(error)}`,
    );
  });
}

type Scenario = {
  id: string;
  input: string;
  answer: string;
  continueToPortfolio?: boolean;
  exerciseGuidedExploration?: boolean;
};

type LegacyHandoffFixture = {
  sessionId: string;
  publicAccessToken: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'portfolio-first',
    input: 'Tengo 18 iniciativas y necesito decidir cuales continuar.',
    answer: 'Necesito comparar contribucion, evidencia y esfuerzo antes del proximo comite.',
    continueToPortfolio: true,
    exerciseGuidedExploration: true,
  },
  {
    id: 'solution-first',
    input: 'Compramos un asistente de IA para ventas y no se si esta generando valor.',
    answer: 'Todavia no tenemos claro que resultado comercial deberia justificar la inversion.',
  },
  {
    id: 'reporting-first',
    input: 'Tengo comite y necesito saber que iniciativas estan bloqueadas.',
    answer: 'El comite necesita ver bloqueos, pendientes y decisiones que destraben avance.',
  },
  {
    id: 'strategy-first',
    input: 'Necesitamos reducir costes 15% y no sabemos que priorizar.',
    answer: 'Queremos entender que iniciativas pueden contribuir a la reduccion sin inventar evidencia.',
  },
];

function extractToken(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? body?.tokens?.accessToken ?? body?.accessToken ?? '';
}

async function registerPortfolioUser(api: APIRequestContext) {
  const stamp = Date.now() + Math.floor(Math.random() * 100000);
  const email = `e2e-entry-portfolio-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const reg = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `E2E Portfolio Entry ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(reg.status(), `register ${email}: ${await reg.text()}`).toBe(201);
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(login.status(), `login ${email}: ${await login.text()}`).toBe(200);
  const loginBody = await login.json();
  expect(extractToken(loginBody)).toBeTruthy();
  expect(loginBody.data.user).toMatchObject({
    role: 'participante',
    roles: ['participante'],
  });
  expect(loginBody.data.user.permissions).not.toContain('portfolio:read');
  return { email, password, userId: loginBody.data.user.id };
}

async function provisionScopedPortfolioAccess(userId: string) {
  const stamp = Date.now() + Math.floor(Math.random() * 100000);
  const organization = await prisma.organization.create({
    data: {
      name: `E2E Portfolio Organization ${stamp}`,
      slug: `e2e-portfolio-${stamp}`,
    },
  });

  await prisma.organizationMember.create({
    data: {
      userId,
      organizationId: organization.id,
      role: 'member',
    },
  });

  await prisma.organizationPortfolioAccessGrant.create({
    data: {
      userId,
      organizationId: organization.id,
      capability: 'portfolio:read',
    },
  });
  await prisma.organizationPortfolioAccessGrant.create({
    data: {
      userId,
      organizationId: organization.id,
      capability: 'portfolio:write',
    },
  });

  return organization;
}

async function expectScopedPortfolioAccess(
  page: Page,
  api: APIRequestContext,
  user: { email: string; password: string; userId: string },
  organizationId: string,
) {
  // Verify the browser can rehydrate the same scoped Portfolio context from
  // the refresh cookie, rather than relying only on the in-memory access token.
  await page.reload();
  await expect(page).toHaveURL(/\/portfolio\/inicio\?portfolioEntryContinuationId=/);

  const persisted = await prisma.user.findUniqueOrThrow({
    where: { id: user.userId },
    select: { role: true, roles: true },
  });
  expect(persisted).toEqual({
    role: 'participante',
    roles: ['participante'],
  });
  expect(await prisma.organizationMember.count({ where: { userId: user.userId, organizationId } })).toBe(1);
  expect(await prisma.organizationPortfolioAccessGrant.count({
    where: { userId: user.userId, organizationId, capability: 'portfolio:read' },
  })).toBe(1);
  expect(await prisma.organizationPortfolioAccessGrant.count({
    where: { userId: user.userId, organizationId, capability: 'portfolio:write' },
  })).toBe(1);
  expect(await prisma.organizationPortfolioAccessGrant.count({
    where: { userId: user.userId },
  })).toBe(2);

  const login = await api.post('/api/v1/auth/login', {
    data: { email: user.email, password: user.password },
    failOnStatusCode: false,
  });
  expect(login.status(), `post-grant login ${user.email}: ${await login.text()}`).toBe(200);
  const loginBody = await login.json();
  const accessToken = extractToken(loginBody);
  expect(loginBody.data.user).toMatchObject({
    role: 'participante',
    roles: ['participante'],
  });
  expect(loginBody.data.user.permissions).not.toContain('portfolio:read');

  const me = await api.get('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    failOnStatusCode: false,
  });
  expect(me.status(), `post-grant /auth/me ${user.email}: ${await me.text()}`).toBe(200);
  const meBody = await me.json();
  expect(meBody.data).toMatchObject({
    role: 'participante',
    roles: ['participante'],
  });
  expect(meBody.data.permissions).not.toContain('portfolio:read');
}

async function loginThroughUi(page: Page, email: string, password: string) {
  await expect(page.getByRole('heading', { name: /Bienvenido de vuelta/i })).toBeVisible();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
}

/**
 * LEGACY_COMPAT fixture: this inserts a historical-format handoff without running
 * the current Portfolio Entry reasoning or creating a Critical Handoff sidecar.
 * Keep it isolated from reachCriticalHandoff so old consumers cannot silently
 * become the current 114D journey again.
 */
async function seedLegacyHandoff(api: APIRequestContext, rawEntry: string): Promise<LegacyHandoffFixture> {
  const created = await api.post('/api/v1/public/portfolio-entry/sessions', {
    data: { sourceMetadata: { channel: 'public_start_frontend' } },
    failOnStatusCode: false,
  });
  const createdText = await created.text();
  expect(created.status(), `legacy fixture session creation: ${createdText}`).toBe(201);
  expect(created.headers()['x-ratelimit-limit']).toBe('500');
  const createdBody = JSON.parse(createdText);
  const sessionId = createdBody?.data?.session?.id;
  const publicAccessToken = createdBody?.data?.publicAccessToken;
  expect(sessionId).toEqual(expect.any(String));
  expect(publicAccessToken).toEqual(expect.any(String));

  const now = new Date();
  const handoffPayload = {
    understanding: { value: 'La persona necesita ordenar prioridades del portafolio.' },
    desired_outcome: { value: 'Preparar una comparación de iniciativas para el comité.' },
    decision_to_enable: { value: 'Qué iniciativas reciben capacidad durante este ciclo.' },
    recommended_approach: {
      description: 'Comparar las iniciativas con la evidencia y la capacidad disponibles.',
      rationale: 'La comparación permite preparar una conversación de priorización.',
      assumption: 'El comité conserva la decisión final.',
      origin: 'AI_SUGGESTED',
      review_disposition: 'UNREVIEWED',
      provenance: [],
    },
    alternative_approaches: [],
    known_context: [],
    unresolved_context: [{ gap_id: 'capacity_window', description: 'La capacidad disponible todavía debe confirmarse.' }],
    gap_resolution_map: [{
      gap_id: 'capacity_window',
      gap_description: 'La capacidad disponible todavía debe confirmarse.',
      resolution_type: 'REQUIRES_ORGANIZATIONAL_INPUT',
      resolution_stage: 'PORTFOLIO',
    }],
    evidence_or_clarity_needed: [],
    starteria_path: [{ action: 'structure', description: 'Ordenar la comparación antes de decidir.' }],
    recommended_cta: 'Trabajarlo con Starteria',
    provenance_summary: [],
    handoff_status: 'ready_with_uncertainty',
  };

  await prisma.portfolioEntrySession.update({
    where: { id: sessionId },
    data: { rawEntry, lifecycleStatus: 'AWAITING_CONFIRMATION', revision: 2, lastActivityAt: now },
  });
  await prisma.portfolioEntryHandoff.create({
    data: {
      sessionId,
      version: 1,
      handoffPayload,
      handoffStatus: 'ready_with_uncertainty',
      schemaVersion: 'portfolio-entry-handoff-v2',
      runtimeVersion: 'legacy-e2e-fixture',
      createdAt: now,
      updatedAt: now,
    },
  });
  expect(await prisma.portfolioEntryCriticalHandoff.count({ where: { sessionId } })).toBe(0);
  expect(await prisma.portfolioEntryHandoff.count({ where: { sessionId } })).toBe(1);
  return { sessionId, publicAccessToken };
}

async function openLegacyHandoff(page: Page, fixture: LegacyHandoffFixture) {
  const backendUrl = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:4100';
  const genericResponse = await fetch(`${backendUrl}/api/v1/public/portfolio-entry/sessions/${fixture.sessionId}`, {
    headers: { 'X-Starteria-Entry-Token': fixture.publicAccessToken },
  });
  expect(genericResponse.status).toBe(200);
  const genericSession = (await genericResponse.json()).data;
  expect(genericSession.handoffExperience).toBe('legacy');
  expect(genericSession).not.toHaveProperty('handoff');
  expect(JSON.stringify(genericSession)).not.toMatch(/recommended_approach|starteria_path|recommended_cta|provenance|selected_lenses|reasoning_metadata|source_refs|confirmedByUserId|provider|model|raw_synthesis/i);

  const handoffReads: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') return;
    const pathname = new URL(request.url()).pathname;
    if (/\/sessions\/[^/]+\/(?:handoff|critical-handoff)$/.test(pathname)) {
      handoffReads.push(`${request.method()} ${pathname}`);
    }
  });
  await page.goto('/public/start');
  await page.evaluate(({ sessionId, credential }) => {
    window.sessionStorage.setItem('starteria.portfolioEntry.current', JSON.stringify({ sessionId, credential }));
    window.sessionStorage.removeItem('starteria.portfolioEntry.criticalHandoffReviewSession');
  }, { sessionId: fixture.sessionId, credential: fixture.publicAccessToken });
  await page.reload();
  await expect(page.getByTestId('handoff-first-view')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('handoff-understanding')).toContainText('Esto estoy entendiendo');
  await expect(page.getByText('Comparar las iniciativas con la evidencia y la capacidad disponibles.')).toBeVisible();
  await expect(page.getByTestId('critical-handoff-review')).toHaveCount(0);
  expect(handoffReads.some((read) => read.endsWith('/handoff'))).toBe(true);
  expect(handoffReads.some((read) => read.endsWith('/critical-handoff'))).toBe(false);
}

async function continueThroughAuthenticatedLegacyPortfolioEntry(
  page: Page,
  user: { email: string; password: string },
  organization: { name: string },
  fixture: LegacyHandoffFixture,
  options: { openPortfolioHomeForHomeCoverage?: boolean; alreadyAuthenticated?: boolean } = {},
): Promise<string> {
  const storedSessionId = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('starteria.portfolioEntry.current');
    return raw ? JSON.parse(raw).sessionId : null;
  });
  expect(storedSessionId).toBe(fixture.sessionId);
  await expect(page.getByTestId('handoff-first-view')).toBeVisible();
  await page.getByRole('button', { name: /Trabajarlo con Starteria/i }).click();
  if (options.alreadyAuthenticated) {
    await expect(page).toHaveURL(/\/public\/provisional-continuation/, { timeout: 30_000 });
  } else {
    await expect(page).toHaveURL(/\/auth/);
    await loginThroughUi(page, user.email, user.password);
  }
  await expect(page).toHaveURL(/\/public\/provisional-continuation/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Esto es lo que entendimos/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('single-authorized-context')).toContainText(organization.name);
  await expect(page.getByTestId('strategic-intent-review')).toBeVisible();
  await expect(page.getByTestId('recommended-approach-review')).toContainText(/hipótesis, no plan decidido/i);

  const confirmationResponse = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST') return false;
    try {
      return /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/handoff\/confirmation$/.test(new URL(response.url()).pathname);
    } catch {
      return false;
    }
  });
  const continuationResponse = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST') return false;
    try {
      return /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/continue-portfolio$/.test(new URL(response.url()).pathname);
    } catch {
      return false;
    }
  });
  await page.getByRole('button', { name: /Incluir como hipótesis/i }).click();
  await page.getByRole('button', { name: /Confirmar esta lectura y continuar/i }).click();

  const confirmed = await confirmationResponse;
  const confirmedBodyText = await confirmed.text();
  let confirmedBody: any;
  try {
    confirmedBody = JSON.parse(confirmedBodyText);
  } catch {
    confirmedBody = null;
  }
  expect(confirmed.status(), `handoff confirmation response body: ${confirmedBodyText}`).toBe(200);
  expect(confirmedBody?.data?.lifecycleStatus, `handoff confirmation response body: ${confirmedBodyText}`).toBe('CONFIRMED');
  const confirmationPayload = confirmed.request().postDataJSON();
  expect(confirmationPayload.acceptedFields).toEqual(expect.arrayContaining([
    'understood_need', 'desired_outcome', 'decision_to_enable', 'known_context',
    'unresolved_context', 'evidence_or_clarity_needed', 'recommended_approach',
  ]));
  expect(confirmationPayload.rejectedFields ?? []).not.toContain('recommended_approach');

  const continued = await continuationResponse;
  const continuedBodyText = await continued.text();
  let continuedBody: any;
  try {
    continuedBody = JSON.parse(continuedBodyText);
  } catch {
    continuedBody = null;
  }
  expect(continued.status(), `continue-portfolio response body: ${continuedBodyText}`).toBe(200);
  expect(continuedBody?.data?.continuationId, `continue-portfolio response body: ${continuedBodyText}`).toBeTruthy();
  await expect(page).toHaveURL(/\/portfolio\/setup$/, { timeout: 30_000 });

  const transportedIdentity = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession');
    return raw ? JSON.parse(raw) : null;
  });
  expect(transportedIdentity).toEqual({
    source: 'portfolio_entry',
    sessionId: confirmedBody.data.id,
    sessionRevision: confirmedBody.data.revision,
    handoffId: confirmedBody.data.handoff.id,
    handoffVersion: confirmedBody.data.handoff.version,
    confirmationId: confirmedBody.data.confirmation.id,
    confirmationVersion: confirmedBody.data.confirmation.version,
  });

  await page.reload();
  await expect(page).toHaveURL(/\/portfolio\/setup$/);
  const identityAfterRefresh = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession');
    return raw ? JSON.parse(raw) : null;
  });
  expect(identityAfterRefresh).toEqual(transportedIdentity);
  const continuationId = continuedBody.data.continuationId as string;
  if (options.openPortfolioHomeForHomeCoverage) {
    await page.goto(`/portfolio/inicio?portfolioEntryContinuationId=${encodeURIComponent(continuationId)}`);
  }
  return continuationId;
}

async function visible(locator: ReturnType<Page['getByText']>): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

async function canonicalCounts() {
  const [organizations, strategicFronts, challenges, projects, steps, decisions, initiativePortfolioMetas] = await Promise.all([
    prisma.organization.count(),
    prisma.strategicFront.count(),
    prisma.challenge.count(),
    prisma.project.count(),
    prisma.step.count(),
    prisma.decision.count(),
    prisma.initiativePortfolioMeta.count(),
  ]);
  return { organizations, strategicFronts, challenges, projects, steps, decisions, initiativePortfolioMetas };
}

function watchForbiddenPortfolioEntryNavigation(page: Page) {
  const forbiddenUrls: string[] = [];
  const forbiddenRoutes = [
    /^\/public\/draft\/[^/]+\/edit$/,
    /^\/projects\/[^/]+$/,
    /^\/projects\/[^/]+\/step\/0$/,
    /^\/step\/0$/,
  ];
  const onFrameNavigated = (frame: Frame) => {
    if (frame !== page.mainFrame()) return;
    try {
      const url = new URL(frame.url());
      if (forbiddenRoutes.some((route) => route.test(url.pathname))) {
        forbiddenUrls.push(url.pathname);
      }
    } catch {
      // Ignore transient about:blank or browser-internal URLs.
    }
  };
  page.on('framenavigated', onFrameNavigated);
  return {
    expectClean() {
      expect(forbiddenUrls, `Portfolio Entry navigated to legacy routes: ${forbiddenUrls.join(', ')}`).toEqual([]);
    },
    dispose() {
      page.off('framenavigated', onFrameNavigated);
    },
  };
}

async function bootstrapStateForContinuation(continuationId: string) {
  const sessions = await (prisma as any).portfolioBootstrapSession.findMany({
    where: { sourceContinuationId: continuationId },
    include: {
      anchor: true,
      workItems: { orderBy: { createdAt: 'asc' } },
      analysisRuns: { orderBy: { createdAt: 'asc' } },
      proposedMutations: { orderBy: { createdAt: 'asc' } },
      strategicConnections: true,
      advancementConditions: true,
      readings: { orderBy: { version: 'asc' } },
      importBatches: { orderBy: { createdAt: 'asc' } },
    },
  });
  return { sessions, session: sessions[0] ?? null };
}

async function expectOneBootstrapSession(continuationId: string) {
  await expect.poll(async () => {
    const state = await bootstrapStateForContinuation(continuationId);
    return state.sessions.length;
  }).toBe(1);
  const state = await bootstrapStateForContinuation(continuationId);
  expect(state.session?.anchor).toBeTruthy();
  return state;
}

async function reachCriticalHandoff(page: Page, scenario: Scenario, testInfo: TestInfo, viaLanding = false): Promise<string> {
  const handoffMaterialization = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST') return false;
    return /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/critical-handoff$/.test(new URL(response.url()).pathname);
  });
  const criticalHandoffRead = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET' || response.status() !== 200) return false;
    return /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/critical-handoff$/.test(new URL(response.url()).pathname);
  });
  if (viaLanding) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Haz que la estrategia se haga realidad.' })).toBeVisible();
    await expect(page.getByLabel('Modelo conceptual de Starteria')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page
      .locator('section[aria-labelledby="landing-closing-title"]')
      .getByRole('link', { name: 'Analizar mi situación' })
      .click();
    await expect(page).toHaveURL(/\/public\/start$/);
    await page.setViewportSize({ width: 1280, height: 900 });
  } else {
    await page.goto('/public/start');
  }
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto('/public/start');

  if (scenario.id === 'portfolio-first') {
    await page.screenshot({ path: testInfo.outputPath('portfolio-entry-landing.png'), fullPage: true });
  }

  await page.getByLabel(/necesitas conseguir/i).fill(scenario.input);
  await page.getByRole('button', { name: /Analizar mi situaci[oó]n/i }).click();


  let clarificationAnswers = 0;
  let guidedAnswers = 0;
  let guidedOptedIn = false;
  const activeQuestionWording = new Set<string>();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await visible(page.getByTestId('critical-handoff-review'))) break;

    const provisionalRoute = page.getByRole('button', { name: /Ver mi propuesta de abordaje/i });
    if (await provisionalRoute.isVisible().catch(() => false)) {
      const deepen = page.getByRole('button', { name: /Seguir aterrizando mi necesidad/i });
      if (scenario.exerciseGuidedExploration && !guidedOptedIn && await deepen.isVisible().catch(() => false)) {
        const guidedResponse = page.waitForResponse((response) =>
          response.request().method() === 'POST' && /\/guided-exploration$/.test(response.url()),
        );
        await deepen.click();
        await guidedResponse;
        guidedOptedIn = true;
        continue;
      }
      const checkpointResponse = page.waitForResponse((response) =>
        response.request().method() === 'POST' && /\/guided-exploration$/.test(response.url()),
      );
      await provisionalRoute.click();
      await checkpointResponse;
      continue;
    }


    const activeQuestion = page.getByTestId('portfolio-entry-active-question');
    if (await activeQuestion.isVisible().catch(() => false)) {
      const answer = page.getByLabel(/Tu respuesta/i);
      const activeQuestionText = page.getByTestId('portfolio-entry-active-question-text');
      await expect(activeQuestion).toHaveCount(1);
      await expect(activeQuestionText).toHaveCount(1);
      await expect(answer).toBeVisible();
      await expect(answer).toBeEnabled();
      await expect(page.getByTestId('portfolio-entry-understanding')).toBeVisible();
      const understandingBeforeAnswer = (await page.getByTestId('portfolio-entry-understanding').innerText()).trim();
      const activeReason = activeQuestion.getByTestId('portfolio-entry-active-question-reason');
      if (scenario.id === 'portfolio-first' && attempt === 0) {
        await expect(activeReason).toBeVisible();
        await expect(activeQuestion.getByTestId('portfolio-entry-active-question-reason')).toHaveCount(1);
        const reasonBeforeRefresh = await activeReason.innerText();
        const questionBeforeRefresh = await activeQuestionText.innerText();
        await page.reload();
        await expect(page.getByTestId('portfolio-entry-active-question')).toHaveCount(1);
        await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveText(questionBeforeRefresh);
        await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveCount(1);
        await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(reasonBeforeRefresh);
      }
      const guidedMode = await page.getByText(/Exploración guiada/i).isVisible().catch(() => false);
      if (scenario.id === 'portfolio-first' && attempt === 0) {
        await page.screenshot({ path: testInfo.outputPath('portfolio-entry-clarification.png'), fullPage: true });
      }
      const wording = (await activeQuestionText.innerText()).trim();
      expect(
        activeQuestionWording.has(wording),
        `Repeated active question: ${wording}`,
      ).toBe(false);
      activeQuestionWording.add(wording);
      clarificationAnswers += 1;
      if (guidedMode) {
        guidedAnswers += 1;
        expect(guidedAnswers).toBeLessThanOrEqual(2);
      } else {
        expect(clarificationAnswers - guidedAnswers).toBeLessThanOrEqual(3);
      }
      expect(clarificationAnswers).toBeLessThanOrEqual(5);
      await answer.fill(scenario.answer);
      const clarificationResponse = page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        /\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/messages$/.test(response.url()),
      );
      await page.getByRole('button', { name: /Enviar respuesta/i }).click();
      const answerResponse = await clarificationResponse;
      const answerPayload = await answerResponse.json();
      if (scenario.id === 'portfolio-first' && clarificationAnswers === 1) {
        expect(answerPayload.data.liveUnderstanding?.reading).toEqual(expect.any(String));
        await expect.poll(async () => (await page.getByTestId('portfolio-entry-understanding').innerText()).trim())
          .not.toBe(understandingBeforeAnswer);
      }
      const returnedTurns = answerPayload.data.conversation as Array<{ emittedQuestions: Array<Record<string, unknown>> }>;
      expect(returnedTurns.at(-1)?.emittedQuestions.length ?? 0).toBeLessThanOrEqual(1);
      expect(returnedTurns.slice(0, -1).flatMap((turn) => turn.emittedQuestions)
        .every((question) => !Object.hasOwn(question, 'reason_to_ask'))).toBe(true);
      expect((returnedTurns.at(-1)?.emittedQuestions ?? [])
        .filter((question) => typeof question.reason_to_ask === 'string' && question.reason_to_ask.trim()).length)
        .toBeLessThanOrEqual(1);
      if (guidedMode && guidedAnswers === 2) {
        await expect(page.getByTestId('portfolio-entry-active-question')).toHaveCount(0);
        await expect(page.getByLabel(/Tu respuesta/i)).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Enviar respuesta/i })).toHaveCount(0);
        await expect(page.getByText(/Con lo que acabamos de profundizar/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /Seguir aterrizando mi necesidad/i })).toHaveCount(0);
      }
      continue;
    }

    await expect
      .poll(async () => {
        if (await page.getByTestId('critical-handoff-review').isVisible().catch(() => false)) return 'handoff';
        if (await provisionalRoute.isVisible().catch(() => false)) return 'guided-offer';
        if (await activeQuestion.isVisible().catch(() => false)) return 'active-question';
        return 'transitioning';
      })
      .not.toBe('transitioning');
  }

  await expect(page.getByTestId('critical-handoff-review')).toBeVisible({ timeout: 30_000 });
  const [materializationResponse, criticalResponse] = await Promise.all([handoffMaterialization, criticalHandoffRead]);
  expect(materializationResponse.status(), `Critical Handoff materialization response: ${materializationResponse.url()}`).toBe(200);
  const materializationBody = await materializationResponse.json();
  expect(Object.keys(materializationBody.data).sort()).toEqual(['criticalHandoff', 'sessionRevision']);
  expect(JSON.stringify(materializationBody.data)).not.toMatch(/handoffPayload|provenance_summary|provenance|recommended_approach|starteria_path|recommended_cta|reasoning_metadata|selected_lenses|source_refs|sourceTurnId|provider|model|raw_synthesis|confirmedByUserId/i);
  expect(criticalResponse.status(), `Critical Handoff read response: ${criticalResponse.url()}`).toBe(200);
  const sessionId = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('starteria.portfolioEntry.current');
    return raw ? JSON.parse(raw).sessionId : null;
  });
  expect(sessionId).toEqual(expect.any(String));
  const credential = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('starteria.portfolioEntry.current');
    return raw ? JSON.parse(raw).credential : null;
  });
  const genericSessionResponse = await fetch(
    `${process.env.E2E_BACKEND_URL || 'http://127.0.0.1:4100'}/api/v1/public/portfolio-entry/sessions/${sessionId}`,
    { headers: { 'X-Starteria-Entry-Token': credential } },
  );
  expect(genericSessionResponse.status).toBe(200);
  const genericSession = (await genericSessionResponse.json()).data;
  expect(genericSession.handoffExperience).toBe('critical');
  expect(genericSession).not.toHaveProperty('handoff');
  expect(genericSession).not.toHaveProperty('provisionalContinuation');
  expect(JSON.stringify(genericSession)).not.toMatch(/recommended_approach|starteria_path|recommended_cta|provenance|selected_lenses|reasoning_metadata|source_refs|confirmedByUserId|provider|model|raw_synthesis/i);
  return sessionId as string;
}

async function closeCriticalHandoffAfterCorrection(page: Page, answerText: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await page.getByTestId('critical-handoff-review').isVisible().catch(() => false)) break;

    const activeQuestion = page.getByTestId('portfolio-entry-active-question');
    if (await activeQuestion.isVisible().catch(() => false)) {
      const response = page.waitForResponse((candidate) => candidate.request().method() === 'POST'
        && /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/messages$/.test(new URL(candidate.url()).pathname));
      await page.getByLabel(/Tu respuesta/i).fill(answerText);
      await page.getByRole('button', { name: /Enviar respuesta/i }).click();
      expect((await response).status()).toBe(200);
      continue;
    }

    const closeExploration = page.getByRole('button', { name: /Ver mi propuesta de abordaje/i });
    if (await closeExploration.isVisible().catch(() => false)) {
      const guidedResponse = page.waitForResponse((candidate) => candidate.request().method() === 'POST'
        && /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/guided-exploration$/.test(new URL(candidate.url()).pathname));
      const handoffResponse = page.waitForResponse((candidate) => candidate.request().method() === 'POST'
        && /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/critical-handoff$/.test(new URL(candidate.url()).pathname));
      const criticalRead = page.waitForResponse((candidate) => candidate.request().method() === 'GET'
        && candidate.status() === 200
        && /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/critical-handoff$/.test(new URL(candidate.url()).pathname));
      await closeExploration.click();
      expect((await guidedResponse).status()).toBe(200);
      const [materialized, read] = await Promise.all([handoffResponse, criticalRead]);
      expect(materialized.status()).toBe(200);
      const materializedBody = await materialized.json();
      expect(Object.keys(materializedBody.data).sort()).toEqual(['criticalHandoff', 'sessionRevision']);
      expect(JSON.stringify(materializedBody.data)).not.toMatch(/handoffPayload|provenance_summary|provenance|recommended_approach|starteria_path|recommended_cta|reasoning_metadata|selected_lenses|source_refs|sourceTurnId|provider|model|raw_synthesis|confirmedByUserId/i);
      expect(read.status()).toBe(200);
      break;
    }

    await expect.poll(async () => {
      if (await activeQuestion.isVisible().catch(() => false)) return 'question';
      if (await closeExploration.isVisible().catch(() => false)) return 'close';
      if (await page.getByTestId('critical-handoff-review').isVisible().catch(() => false)) return 'review';
      return 'transitioning';
    }).not.toBe('transitioning');
  }
  await expect(page.getByTestId('critical-handoff-review')).toBeVisible({ timeout: 30_000 });
}

async function expectNoCriticalHandoffLegacyFallback(page: Page) {
  const review = page.getByTestId('critical-handoff-review');
  await expect(review).toBeVisible();
  await expect(page.getByTestId('handoff-first-view')).toHaveCount(0);
  await expect(review).not.toContainText(/recommended_approach|starteria_path|recommended_cta|Cómo lo abordaría Starteria|Ruta completa en Starteria|route recommendation/i);
  await expect(page.getByText('Esto estoy entendiendo', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Decisión que necesitas habilitar', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Cómo lo abordaría Starteria', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('handoff-first-view')).toHaveCount(0);
}

function watchForbiddenCriticalHandoffNavigation(page: Page) {
  const forbidden: string[] = [];
  const onFrameNavigated = (frame: Frame) => {
    if (frame !== page.mainFrame()) return;
    try {
      const path = new URL(frame.url()).pathname;
      if (/^\/public\/provisional-continuation$|^\/portfolio\/setup$|^\/portfolio\/inicio$/.test(path)) forbidden.push(path);
    } catch {
      // Ignore transient about:blank and browser-internal URLs.
    }
  };
  page.on('framenavigated', onFrameNavigated);
  return {
    expectClean() {
      expect(forbidden, `114D navigated beyond Critical Handoff: ${forbidden.join(', ')}`).toEqual([]);
    },
    dispose() {
      page.off('framenavigated', onFrameNavigated);
    },
  };
}

async function continueAndReturnToLegacyConfirmedEntryActions(
  page: Page,
  user: { email: string; password: string },
  organization: { name: string },
  fixture: LegacyHandoffFixture,
) {
  await continueThroughAuthenticatedLegacyPortfolioEntry(page, user, organization, fixture);
  await expect(page).toHaveURL(/\/portfolio\/setup$/);
  const identity = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession') || 'null'));
  expect(identity).toMatchObject({ source: 'portfolio_entry', sessionId: expect.any(String) });
  await page.goto('/public/start');
  const actions = page.getByTestId('portfolio-entry-confirmed-brief-actions');
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Descargar', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Eliminar', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Trabajarlo con Starteria', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: /Crear mi portafolio/i })).toHaveCount(0);
  return identity.sessionId as string;
}

test.describe('Portfolio Entry 114D Critical Handoff and explicit legacy compatibility', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('[CURRENT_114D] renders quick clarification as a guided pre-handoff state', async ({ page }, testInfo) => {
    await page.goto('/public/start');
    await page.evaluate(() => window.sessionStorage.clear());
    await page.goto('/public/start');

    await page.getByLabel(/necesitas conseguir/i).fill('Necesito ordenar mis iniciativas ya.');
    await page.getByRole('button', { name: /Analizar mi situaci[oó]n/i }).click();

    await expect(page.getByRole('heading', { name: /Aclaraci[oó]n breve/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('portfolio-entry-active-question')).toBeVisible();
    await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveCount(1);

    await expect(page.getByText(/Ver conversación/i)).toBeVisible();
    await expect(page.getByLabel(/Tu respuesta/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar respuesta/i })).toBeVisible();
    await expect(page.getByText(/Qué haría Starteria primero/i)).toHaveCount(0);

    await page.screenshot({ path: testInfo.outputPath('portfolio-entry-clarification.png'), fullPage: true });
  });

  // CURRENT_114D: this browser journey stops after the confirmed Critical Handoff.
  test('[CURRENT_114D] KAN-102 Landing → Entry → clarification → confirmed Critical Handoff', async ({ page }, testInfo) => {
    const currentBoundary = watchForbiddenCriticalHandoffNavigation(page);
    const entryRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/v1/public/portfolio-entry/')) {
        entryRequests.push(`${request.method()} ${url.pathname}`);
      }
    });

    const api = await pwRequest.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5176' });
    const user = await registerPortfolioUser(api);
    const before = await canonicalCounts();
    const scenario = SCENARIOS[0];
    const sessionId = await reachCriticalHandoff(page, scenario, testInfo, true);
    await expectNoCriticalHandoffLegacyFallback(page);

    const credential = await page.evaluate(() => {
      const raw = window.sessionStorage.getItem('starteria.portfolioEntry.current');
      return raw ? JSON.parse(raw).credential : null;
    });
    expect(credential).toEqual(expect.any(String));
    const firstResponse = await api.get(`/api/v1/public/portfolio-entry/sessions/${sessionId}/critical-handoff`, {
      headers: { 'X-Starteria-Entry-Token': credential },
      failOnStatusCode: false,
    });
    const firstResponseText = await firstResponse.text();
    expect(firstResponse.status(), firstResponseText).toBe(200);
    const firstBody = JSON.parse(firstResponseText);
    const firstArtifact = firstBody.data;
    expect(firstArtifact).toMatchObject({ confirmationState: 'provisional', confirmedAt: null, state: 'current' });
    expect(JSON.stringify(firstArtifact)).not.toMatch(/provenance|selected_lenses|reasoning_metadata|source_refs|sourceTurnId|confirmedByUserId|prompt|provider|model|raw_synthesis/i);
    expect(await prisma.portfolioEntryHandoff.count({ where: { sessionId } })).toBeGreaterThan(0);
    const firstPersisted = await prisma.portfolioEntryCriticalHandoff.findFirst({
      where: { sessionId }, orderBy: { artifactVersion: 'desc' },
    });
    expect(firstPersisted).toMatchObject({ confirmationState: 'provisional', confirmedAt: null, confirmedByUserId: null });

    await page.getByRole('button', { name: 'Esto no refleja suficientemente mi situación' }).click();
    const correction = page.getByRole('textbox', { name: '¿Qué deberíamos entender mejor?' });
    await correction.fill('La disponibilidad del equipo cambia antes del comité y puede cambiar la decisión.');
    const correctionResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
      && /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/messages$/.test(new URL(response.url()).pathname));
    await page.getByRole('button', { name: 'Volver a aclarar' }).click();
    expect((await correctionResponsePromise).status()).toBe(200);
    await expect(page.getByText(/La lectura anterior ya no está vigente/i)).toBeVisible();
    const stalePersisted = await prisma.portfolioEntryCriticalHandoff.findUniqueOrThrow({ where: { id: firstPersisted!.id } });
    const afterCorrectionSession = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(afterCorrectionSession.contextRevision).toBeGreaterThan(firstPersisted!.sourceContextRevision);
    expect(stalePersisted.confirmationState).toBe('provisional');
    const staleRead = await api.get(`/api/v1/public/portfolio-entry/sessions/${sessionId}/critical-handoff`, {
      headers: { 'X-Starteria-Entry-Token': credential },
      failOnStatusCode: false,
    });
    const staleReadText = await staleRead.text();
    expect(staleRead.status(), staleReadText).toBe(200);
    const staleArtifact = JSON.parse(staleReadText).data;
    expect(staleArtifact).toMatchObject({ id: firstPersisted!.id, state: 'stale', confirmationState: 'provisional' });
    expect(JSON.stringify(staleArtifact)).not.toMatch(/recommended_approach|starteria_path|recommended_cta|provenance|provider|model|raw_synthesis/i);
    await closeCriticalHandoffAfterCorrection(page, scenario.answer);
    await expectNoCriticalHandoffLegacyFallback(page);

    const freshPersisted = await prisma.portfolioEntryCriticalHandoff.findFirst({
      where: { sessionId }, orderBy: { artifactVersion: 'desc' },
    });
    expect(freshPersisted).toBeTruthy();
    expect(freshPersisted!.id).not.toBe(firstPersisted!.id);
    expect(freshPersisted!.artifactVersion).toBeGreaterThan(firstPersisted!.artifactVersion);
    expect(freshPersisted!.sourceContextRevision).toBe(afterCorrectionSession.contextRevision);
    const freshResponse = await api.get(`/api/v1/public/portfolio-entry/sessions/${sessionId}/critical-handoff`, {
      headers: { 'X-Starteria-Entry-Token': credential },
      failOnStatusCode: false,
    });
    const freshResponseText = await freshResponse.text();
    expect(freshResponse.status(), freshResponseText).toBe(200);
    const freshArtifact = JSON.parse(freshResponseText).data;
    expect(freshArtifact).toMatchObject({ id: freshPersisted!.id, confirmationState: 'provisional', confirmedAt: null, state: 'current' });

    await page.getByRole('button', { name: /iniciar sesi.*para confirmar esta lectura/i }).click();
    await expect(page).toHaveURL(/\/auth$/);
    const pendingClaim = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.pendingClaim') || '{}'));
    expect(pendingClaim).toMatchObject({ sessionId, criticalHandoffReview: true });
    expect(pendingClaim).not.toHaveProperty('identity');
    const claimResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/v1/public/portfolio-entry/sessions/${sessionId}/claim`);
    await loginThroughUi(page, user.email, user.password);
    const claimResponse = await claimResponsePromise;
    expect(claimResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/public\/start$/);
    await expect(page.getByRole('button', { name: 'Confirmar esta lectura' })).toBeVisible();
    const claimedSession = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: sessionId } });
    const afterClaimArtifact = await prisma.portfolioEntryCriticalHandoff.findUniqueOrThrow({ where: { id: freshPersisted!.id } });
    expect(claimedSession.ownershipState).toBe('CLAIMED');
    expect(claimedSession.ownerUserId).toBe(user.userId);
    expect(afterClaimArtifact).toMatchObject({ confirmationState: 'provisional', confirmedAt: null, confirmedByUserId: null });
    expect(entryRequests.some((request) => request.startsWith('POST ') && /\/critical-handoff\/[^/]+\/confirmation$/.test(request))).toBe(false);

    const confirmationResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === `/api/v1/public/portfolio-entry/sessions/${sessionId}/critical-handoff/${freshPersisted!.id}/confirmation`);
    await page.getByRole('button', { name: 'Confirmar esta lectura' }).click();
    const confirmationResponse = await confirmationResponsePromise;
    expect(confirmationResponse.status()).toBe(200);
    const confirmedBody = await confirmationResponse.json();
    expect(confirmedBody.data).toMatchObject({
      id: freshPersisted!.id,
      confirmationState: 'confirmed',
      state: 'current',
      confirmedAt: expect.any(String),
    });
    expect(confirmedBody.data).not.toHaveProperty('confirmedByUserId');
    await expect(page.getByTestId('critical-handoff-confirmed')).toContainText(/representa suficientemente tu situaci.n/i);
    await expect(page).toHaveURL(/\/public\/start$/);

    const confirmedPersisted = await prisma.portfolioEntryCriticalHandoff.findUniqueOrThrow({ where: { id: freshPersisted!.id } });
    expect(confirmedPersisted.confirmationState).toBe('confirmed');
    expect(confirmedPersisted.confirmedByUserId).toBe(user.userId);
    expect(confirmedPersisted.confirmedAt?.toISOString()).toBe(confirmedBody.data.confirmedAt);
    expect(confirmedPersisted.payload).toEqual(freshPersisted!.payload);

    // Hydration follows the server-owned experience discriminator even when
    // the optional browser marker has been cleared.
    await page.evaluate(() => sessionStorage.removeItem('starteria.portfolioEntry.criticalHandoffReviewSession'));
    const finalResponsePromise = page.waitForResponse((response) => response.request().method() === 'GET'
      && new URL(response.url()).pathname === `/api/v1/public/portfolio-entry/sessions/${sessionId}/critical-handoff`);
    await page.reload();
    const finalResponse = await finalResponsePromise;
    expect(finalResponse.status()).toBe(200);
    const finalArtifact = (await finalResponse.json()).data;
    expect(finalArtifact.projection).toEqual(freshArtifact.projection);
    expect(finalArtifact.confirmedAt).toBe(confirmedBody.data.confirmedAt);
    expect(finalArtifact).not.toHaveProperty('confirmedByUserId');
    await expectNoCriticalHandoffLegacyFallback(page);

    const browserStorage = await page.evaluate(() => JSON.stringify({
      local: Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index);
        return key ? [key, localStorage.getItem(key)] : null;
      }),
      session: Array.from({ length: sessionStorage.length }, (_, index) => {
        const key = sessionStorage.key(index);
        return key ? [key, sessionStorage.getItem(key)] : null;
      }),
    }));
    const renderedDom = await page.locator('body').innerHTML();
    for (const serialized of [browserStorage, renderedDom]) {
      expect(serialized).not.toMatch(/selected_lenses|reasoning_metadata|source_refs|sourceTurnId|confirmedByUserId|prompt_manifest|providerReportedModel|raw_synthesis|raw KAN-114 output/i);
    }
    expect(entryRequests.some((request) => request.startsWith('GET ') && request.endsWith('/critical-handoff'))).toBe(true);
    expect(entryRequests.some((request) => request.startsWith('GET ') && request.endsWith('/handoff'))).toBe(false);
    expect(entryRequests.some((request) => request.startsWith('POST ') && request.endsWith('/critical-handoff'))).toBe(true);
    expect(entryRequests.some((request) => request.startsWith('POST ') && request.endsWith('/handoff'))).toBe(false);
    expect(entryRequests.some((request) => /\/continue-portfolio$|\/convert$|\/handoff\/confirmation$/.test(request))).toBe(false);
    expect(entryRequests.some((request) => /\/critical-handoff\/[^/]+\/confirmation$/.test(request))).toBe(true);
    expect(await canonicalCounts()).toEqual(before);
    currentBoundary.expectClean();
    currentBoundary.dispose();
    await api.dispose();
  });

  // CURRENT_114D: adaptive examples all end at the Critical Handoff review.
  for (const scenario of SCENARIOS) {
    test(`[CURRENT_114D] ${scenario.id} reaches Critical Handoff without legacy semantic fallback`, async ({ page }, testInfo) => {
      const currentBoundary = watchForbiddenCriticalHandoffNavigation(page);
      const sessionId = await reachCriticalHandoff(page, scenario, testInfo);
      await expectNoCriticalHandoffLegacyFallback(page);
      const artifact = await prisma.portfolioEntryCriticalHandoff.findFirst({
        where: { sessionId }, orderBy: { artifactVersion: 'desc' },
      });
      expect(artifact).toMatchObject({ confirmationState: 'provisional', confirmedAt: null, confirmedByUserId: null });
      expect(await prisma.portfolioEntryHandoff.count({ where: { sessionId } })).toBeGreaterThan(0);
      expect(await prisma.portfolioEntryCriticalHandoff.count({ where: { sessionId } })).toBeGreaterThan(0);
      if (scenario.id === 'portfolio-first') {
        await page.screenshot({ path: testInfo.outputPath('portfolio-entry-critical-handoff-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 900 });
        await page.screenshot({ path: testInfo.outputPath('portfolio-entry-critical-handoff-mobile.png'), fullPage: true });
      }
      currentBoundary.expectClean();
      currentBoundary.dispose();
    });
  }

  // LEGACY_COMPAT: all continuation readers below use a separately seeded historical handoff.
  test('[LEGACY_COMPAT] KAN-96 hydrates the exact confirmed Brief after continuation and refresh before explicit P1 action', async ({ page }) => {
    const legacyNavigation = watchForbiddenPortfolioEntryNavigation(page);
    const api = await pwRequest.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5176' });
    const user = await registerPortfolioUser(api);
    // Keep this user at the base participant role. The continuation grants only
    // scoped access; the setup route must authorize that exact handoff without
    // granting global portfolio:read.
    const organization = await provisionScopedPortfolioAccess(user.userId);
    const legacyFixture = await seedLegacyHandoff(api, SCENARIOS[0].input);
    await openLegacyHandoff(page, legacyFixture);
    const beforeHydration = await canonicalCounts();
    const d1Capture = await captureJsonResponse(page, 'KAN-96 D1');

    await continueThroughAuthenticatedLegacyPortfolioEntry(page, user, organization, legacyFixture);
    const identity = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession') || 'null'));
    expect(identity).toMatchObject({ source: 'portfolio_entry', sessionId: expect.any(String), sessionRevision: expect.any(Number), handoffId: expect.any(String), handoffVersion: expect.any(Number), confirmationId: expect.any(String), confirmationVersion: expect.any(Number) });
    await expect(page).toHaveURL(/\/portfolio\/setup$/);
    await expect(page.getByTestId('portfolio-lead-first-value')).toBeVisible();

    const d1Response = await d1Capture.response;
    expect(d1Response.status, `KAN-96 D1 ${d1Response.url}; pageURL=${page.url()}; identity=${JSON.stringify(identity)}`).toBe(200);
    const d1Url = new URL(d1Response.url);
    expect(d1Url.pathname).toBe(`/api/v1/public/portfolio-entry/sessions/${identity.sessionId}/confirmed-brief`);
    expect(Object.fromEntries(d1Url.searchParams)).toEqual({
      source: identity.source,
      sessionRevision: String(identity.sessionRevision),
      handoffId: identity.handoffId,
      handoffVersion: String(identity.handoffVersion),
      confirmationId: identity.confirmationId,
      confirmationVersion: String(identity.confirmationVersion),
    });
    const d1 = d1Response.body;
    expect(d1.data.sessionId).toBe(identity.sessionId);
    expect(d1.data.revision).toBe(identity.sessionRevision);
    expect(d1.data.handoffId).toBe(identity.handoffId);
    expect(d1.data.handoffVersion).toBe(identity.handoffVersion);
    expect(d1.data.confirmationId).toBe(identity.confirmationId);
    expect(d1.data.confirmationVersion).toBe(identity.confirmationVersion);
    expect(d1.data.brief.confirmation.status).toBe('CONFIRMED');
    expect(d1.data.brief.confirmation.acceptedFields).toContain('recommended_approach');
    // D2 must hydrate only from the confirmed projection; rawEntry is not a fallback source.
    const expectedGoal = d1.data.brief.confirmation.correctedFields.desired_outcome ?? d1.data.brief.handoff.desired_outcome;
    await expect(page.getByLabel(/qué quieres conseguir/i)).toHaveValue(expectedGoal.value ?? expectedGoal);
    await expect(page.getByLabel(/contexto adicional/i)).not.toHaveValue(/rawEntry/i);
    await expect(page.getByTestId('p3-processing')).toHaveCount(0);
    await expect(page.getByTestId('p1-intent-checkpoint')).toHaveCount(0);

    const refreshedD1Promise = captureResponseMeta(page, 'KAN-96 refreshed D1', response => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/confirmed-brief'));
    await page.reload();
    await expect(page).toHaveURL(/\/portfolio\/setup/);
    expect(await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession') || 'null'))).toEqual(identity);
    const refreshedD1 = await refreshedD1Promise;
    expect(refreshedD1.status, `KAN-96 refreshed D1 ${refreshedD1.url}; pageURL=${page.url()}; identity=${JSON.stringify(identity)}`).toBe(200);
    expect(new URL(refreshedD1.url).search).toBe(d1Url.search);
    await expect(page.getByLabel(/qué quieres conseguir/i)).toHaveValue(expectedGoal.value ?? expectedGoal);

    await page.getByLabel(/qué quieres conseguir/i).fill('Objetivo editado por la persona');
    await page.getByLabel(/contexto adicional/i).fill('Contexto editado por la persona');
    await page.getByRole('button', { name: /Mostrar lo que entendió/i }).click();
    await expect(page.getByTestId('p1-confirmed-summary')).toContainText('Objetivo editado por la persona');
    await expect(page.getByTestId('p1-confirmed-summary')).toContainText('Contexto editado por la persona');
    await expect(page.getByTestId('p3-processing')).toHaveCount(0);
    expect(await canonicalCounts()).toEqual(beforeHydration);
    await expect(page.getByText(/rawEntry/i)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/initiatives\/|\/overview|\/step\/0/);
    legacyNavigation.expectClean();
    legacyNavigation.dispose();
    await api.dispose();
  });

  test('[LEGACY_COMPAT] KAN-100 already-authenticated Entry continues with the same identity to First Value', async ({ page }, testInfo) => {
    const legacyNavigation = watchForbiddenPortfolioEntryNavigation(page);
    const api = await pwRequest.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5176' });
    const user = await registerPortfolioUser(api);
    const organization = await provisionScopedPortfolioAccess(user.userId);
    const legacyFixture = await seedLegacyHandoff(api, SCENARIOS[0].input);
    await openLegacyHandoff(page, legacyFixture);
    await page.goto('/auth');
    await loginThroughUi(page, user.email, user.password);
    await expect(page).toHaveURL(/\/(dashboard|portfolio\/inicio)/, { timeout: 20_000 });
    await page.goto('/public/start');
    await expect(page.getByRole('button', { name: /Trabajarlo con Starteria/i })).toBeVisible();
    const d1Capture = await captureJsonResponse(page, 'KAN-100 D1');

    await continueThroughAuthenticatedLegacyPortfolioEntry(page, user, organization, legacyFixture, { alreadyAuthenticated: true });
    await expect(page).toHaveURL(/\/portfolio\/setup$/);
    await expect(page.getByTestId('portfolio-lead-first-value')).toBeVisible();
    const identity = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession') || 'null'));
    expect(identity).toMatchObject({ source: 'portfolio_entry', sessionId: expect.any(String), sessionRevision: expect.any(Number), handoffId: expect.any(String), handoffVersion: expect.any(Number), confirmationId: expect.any(String), confirmationVersion: expect.any(Number) });
    const d1 = await d1Capture.response;
    expect(d1.status, `KAN-100 D1 ${d1.url}; pageURL=${page.url()}; identity=${JSON.stringify(identity)}`).toBe(200);
    const d1Url = new URL(d1.url);
    expect(d1Url.pathname).toBe(`/api/v1/public/portfolio-entry/sessions/${identity.sessionId}/confirmed-brief`);
    expect(Object.fromEntries(d1Url.searchParams)).toEqual({
      source: identity.source,
      sessionRevision: String(identity.sessionRevision),
      handoffId: identity.handoffId,
      handoffVersion: String(identity.handoffVersion),
      confirmationId: identity.confirmationId,
      confirmationVersion: String(identity.confirmationVersion),
    });
    const d1Body = d1.body;
    expect(d1Body.data.sessionId).toBe(identity.sessionId);
    expect(d1Body.data.revision).toBe(identity.sessionRevision);
    expect(d1Body.data.handoffId).toBe(identity.handoffId);
    expect(d1Body.data.handoffVersion).toBe(identity.handoffVersion);
    expect(d1Body.data.confirmationId).toBe(identity.confirmationId);
    expect(d1Body.data.confirmationVersion).toBe(identity.confirmationVersion);
    await page.screenshot({ path: testInfo.outputPath('portfolio-entry-first-value-setup.png'), fullPage: true });
    expect(await page.getByLabel(/qué quieres conseguir/i).inputValue()).toBeTruthy();
    legacyNavigation.expectClean();
    legacyNavigation.dispose();
    await api.dispose();
  });

  test('[LEGACY_COMPAT] KAN-101 DOWNLOAD exports the confirmed Brief without lifecycle or Portfolio writes', async ({ page }, testInfo) => {
    const legacyNavigation = watchForbiddenPortfolioEntryNavigation(page);
    const api = await pwRequest.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5176' });
    const user = await registerPortfolioUser(api);
    const organization = await provisionScopedPortfolioAccess(user.userId);
    const legacyFixture = await seedLegacyHandoff(api, SCENARIOS[0].input);
    await openLegacyHandoff(page, legacyFixture);
    const sessionId = await continueAndReturnToLegacyConfirmedEntryActions(page, user, organization, legacyFixture);
    const before = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: sessionId } });
    const portfolioBefore = await canonicalCounts();
    await page.screenshot({ path: testInfo.outputPath('portfolio-entry-confirmed-brief-actions.png'), fullPage: true });
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar', exact: true }).click();
    const download = await downloadReady;
    expect(download.suggestedFilename()).toMatch(/^starteria-brief-r\d+\.md$/);
    const stream = await download.createReadStream();
    expect(stream).toBeTruthy();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const markdown = Buffer.concat(chunks).toString('utf8');
    expect(markdown).toContain('# Brief confirmado');
    expect(markdown).not.toContain('rawEntry');
    const after = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: sessionId } });
    expect({ lifecycleStatus: after.lifecycleStatus, revision: after.revision }).toEqual({ lifecycleStatus: before.lifecycleStatus, revision: before.revision });
    expect(await canonicalCounts()).toEqual(portfolioBefore);
    legacyNavigation.expectClean();
    legacyNavigation.dispose();
    await api.dispose();
  });

  test('[LEGACY_COMPAT] KAN-101 DELETE confirms abandonment, blocks continuation and performs zero Portfolio writes', async ({ page }, testInfo) => {
    const legacyNavigation = watchForbiddenPortfolioEntryNavigation(page);
    const sessionReadResponses: Array<Promise<{ sessionId: string; status: number; authorization?: string }>> = [];
    page.on('response', (response) => {
      const request = response.request();
      const sessionPath = new URL(response.url()).pathname.match(/\/public\/portfolio-entry\/sessions\/([^/]+)$/);
      if (request.method() !== 'GET' || !sessionPath) return;
      sessionReadResponses.push(request.allHeaders().then((headers) => ({
        sessionId: decodeURIComponent(sessionPath[1]),
        status: response.status(),
        authorization: headers.authorization ? 'Bearer [redacted]' : undefined,
      })));
    });
    const api = await pwRequest.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5176' });
    const user = await registerPortfolioUser(api);
    const organization = await provisionScopedPortfolioAccess(user.userId);
    const legacyFixture = await seedLegacyHandoff(api, SCENARIOS[0].input);
    await openLegacyHandoff(page, legacyFixture);
    let sessionId: string;
    try {
      sessionId = await continueAndReturnToLegacyConfirmedEntryActions(page, user, organization, legacyFixture);
    } catch (error) {
      const claimed = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession') || 'null'));
      const observations = await Promise.all(sessionReadResponses);
      const recoveryReads = claimed ? observations.filter((read) => read.sessionId === claimed.sessionId) : observations;
      expect(
        recoveryReads.filter((read) => read.status === 401 && !read.authorization?.startsWith('Bearer ')),
        `GET claimed sin Bearer → 401 antes de panel: ${JSON.stringify(recoveryReads)}`,
      ).toHaveLength(0);
      throw error;
    }
    const sessionReads = (await Promise.all(sessionReadResponses)).filter((read) => read.sessionId === sessionId);
    expect(sessionReads, 'La recuperación debe leer la sesión reclamada').not.toHaveLength(0);
    expect(
      sessionReads.filter((read) => read.status === 401 && !read.authorization?.startsWith('Bearer ')),
      `GET claimed sin Bearer → 401: ${JSON.stringify(sessionReads)}`,
    ).toHaveLength(0);
    const briefIdentity = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession') || 'null'));
    const before = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: sessionId } });
    const portfolioBefore = await canonicalCounts();
    await page.screenshot({ path: testInfo.outputPath('portfolio-entry-delete-confirmation.png'), fullPage: true });
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByText(/Si eliminas esta lectura/i)).toBeVisible();
    await page.getByRole('button', { name: 'Sí, eliminar', exact: true }).click();
    await expect(page.getByText('Lectura eliminada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trabajarlo con Starteria' })).toHaveCount(0);
    const after = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(after.lifecycleStatus).toBe('ABANDONED');
    expect(after.revision).toBe(before.revision + 1);
    const login = await api.post('/api/v1/auth/login', { data: { email: user.email, password: user.password } });
    const authorization = `Bearer ${extractToken(await login.json())}`;
    const d1Query = new URLSearchParams({
      source: briefIdentity.source,
      sessionRevision: String(briefIdentity.sessionRevision),
      handoffId: briefIdentity.handoffId,
      handoffVersion: String(briefIdentity.handoffVersion),
      confirmationId: briefIdentity.confirmationId,
      confirmationVersion: String(briefIdentity.confirmationVersion),
    });
    const d1 = await api.get(`/api/v1/public/portfolio-entry/sessions/${sessionId}/confirmed-brief?${d1Query}`, {
      headers: { Authorization: authorization },
      failOnStatusCode: false,
    });
    expect(d1.status()).toBe(410);
    const blocked = await api.post(`/api/v1/public/portfolio-entry/sessions/${sessionId}/continue-portfolio`, {
      headers: { Authorization: authorization, 'Idempotency-Key': `kan101-blocked-${sessionId}` },
      data: { expectedRevision: after.revision, organizationId: organization.id }, failOnStatusCode: false,
    });
    expect(blocked.status()).toBe(410);
    expect(await canonicalCounts()).toEqual(portfolioBefore);
    legacyNavigation.expectClean();
    legacyNavigation.dispose();
    await api.dispose();
  });

  test('[LEGACY_COMPAT] portfolio-first persists explicit no-existing-work state through reload', async ({ page }) => {
    const legacyNavigation = watchForbiddenPortfolioEntryNavigation(page);
    const scenario = SCENARIOS[0];
    const api = await pwRequest.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5176' });
    const user = await registerPortfolioUser(api);
    const organization = await provisionScopedPortfolioAccess(user.userId);
    const legacyFixture = await seedLegacyHandoff(api, scenario.input);
    await openLegacyHandoff(page, legacyFixture);

    await continueThroughAuthenticatedLegacyPortfolioEntry(page, user, organization, legacyFixture, { openPortfolioHomeForHomeCoverage: true });
    await expectScopedPortfolioAccess(page, api, user, organization.id);

    const confirmAnchor = page.getByRole('button', { name: /Confirmar punto de partida/i });
    if (await confirmAnchor.isVisible().catch(() => false)) {
      await confirmAnchor.click();
      await expect(page.getByText('Confirmado', { exact: true })).toBeVisible({ timeout: 15_000 });
    }
    const beforeNoWork = await canonicalCounts();
    await page.getByRole('button', { name: /Incorporar trabajo existente/i }).click();
    await page.getByRole('button', { name: /Todavia no tenemos iniciativas/i }).click();
    await page.getByRole('button', { name: /Todavia no tenemos iniciativas activas/i }).click();

    await expect(page.getByText(/Perfecto. Starteria puede conservar este punto de partida/i)).toBeVisible({ timeout: 15_000 });
    expect(await canonicalCounts()).toEqual(beforeNoWork);

    await page.reload();
    await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible();
    await expect(page.getByText(/Perfecto. Starteria puede conservar este punto de partida/i)).toBeVisible();
    await expect(page.getByText(/Crear frente estrategico|Crear reto|Step 0|HMW|Test Card|experiment|prototype/i)).toHaveCount(0);
    legacyNavigation.expectClean();
    legacyNavigation.dispose();
  });

  for (const format of ['csv', 'xlsx'] as const) {
    test(`[LEGACY_COMPAT] portfolio-first imports ${format.toUpperCase()} through B5 without canonical writes`, async ({ page }, testInfo) => {
      const legacyNavigation = watchForbiddenPortfolioEntryNavigation(page);
      const { continuationId, bootstrapSessionId, anchorId } = await startPortfolioBootstrapFromLegacyEntry(page);
      const beforeImport = await canonicalCounts();
      const importFile = createPortfolioImportFixture(format, testInfo);

      await page.getByRole('button', { name: /Incorporar trabajo existente/i }).click();
      await page.getByRole('button', { name: /Subir Excel o CSV/i }).click();
      await page.getByLabel(/Subir Excel o CSV/i).setInputFiles(importFile);
      await expect(page.getByText(importFile.split(/[\\/]/).pop() ?? '')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Nuevo onboarding digital')).toBeVisible();

      let dbState = await expectOneBootstrapSession(continuationId);
      expect(dbState.session.importBatches).toHaveLength(1);
      expect(dbState.session.workItems).toHaveLength(0);
      expect(await canonicalCounts()).toEqual(beforeImport);

      await page.reload();
      await expect(page.getByRole('button', { name: /Incorporar trabajo existente/i })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /Incorporar trabajo existente/i }).click();
      await page.getByRole('button', { name: /Subir Excel o CSV/i }).click();
      await expect(page.getByText(importFile.split(/[\\/]/).pop() ?? '')).toBeVisible();
      await page.getByRole('button', { name: /Incorporar como trabajo provisional/i }).dblclick();
      await expect(page.getByText(/4 elementos detectados/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Provisional - importado desde archivo/i).first()).toBeVisible();

      dbState = await expectOneBootstrapSession(continuationId);
      expect(dbState.session.id).toBe(bootstrapSessionId);
      expect(dbState.session.anchor.id).toBe(anchorId);
      expect(dbState.session.importBatches).toHaveLength(1);
      expect(dbState.session.importBatches[0].status).toBe('imported');
      expect(dbState.session.workItems).toHaveLength(4);
      expect(dbState.session.workItems[0].importBatchId).toBe(dbState.session.importBatches[0].id);
      expect(dbState.session.workItems[0].sourceRefs).toMatchObject({
        importBatchId: dbState.session.importBatches[0].id,
        rowNumber: 2,
        rawRow: { Initiative: 'Nuevo onboarding digital' },
      });
      expect(await canonicalCounts()).toEqual(beforeImport);

      await page.reload();
      await expect(page.getByText(/4 elementos detectados/i)).toBeVisible({ timeout: 15_000 });
      dbState = await expectOneBootstrapSession(continuationId);
      expect(dbState.session.workItems).toHaveLength(4);
      expect(dbState.session.importBatches).toHaveLength(1);
      expect(await canonicalCounts()).toEqual(beforeImport);

      await page.getByRole('button', { name: /Analizar trabajo detectado/i }).dblclick();
      await expect(page.getByTestId('portfolio-bootstrap-proposed-structure').getByText(/Pendiente de tu revision/i)).toBeVisible({ timeout: 15_000 });
      dbState = await expectOneBootstrapSession(continuationId);
      expect(dbState.session.analysisRuns).toHaveLength(1);
      expect(dbState.session.proposedMutations.length).toBeGreaterThan(0);
      const proposedMutationCount = dbState.session.proposedMutations.length;
      expect(await canonicalCounts()).toEqual(beforeImport);

      await page.getByRole('button', { name: /Revisar propuesta/i }).click();
      await expect(page.getByTestId('portfolio-bootstrap-material-review')).toBeVisible();
      await page.getByTestId('portfolio-bootstrap-material-review').getByRole('button', { name: /^Confirmar$/i }).first().dblclick();
      await expect(page.getByText(/1 confirmadas/i)).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /Dejar pendientes restantes/i }).click();
      await expect(page.getByRole('button', { name: /Generar primera lectura del portafolio/i })).toBeEnabled({ timeout: 15_000 });
      dbState = await expectOneBootstrapSession(continuationId);
      expect(dbState.session.proposedMutations).toHaveLength(proposedMutationCount);
      expect(await canonicalCounts()).toEqual(beforeImport);

      await page.getByRole('button', { name: /Generar primera lectura del portafolio/i }).dblclick();
      await expect(page.getByTestId('portfolio-first-reading')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Nuevo onboarding digital')).toBeVisible();
      await expect(page.getByTestId('portfolio-reading-provenance')).toBeVisible();
      dbState = await expectOneBootstrapSession(continuationId);
      expect(dbState.session.status).toBe('reading_published');
      expect(dbState.session.bootstrapPhase).toBe('B5_FIRST_READING');
      expect(dbState.session.readings).toHaveLength(1);
      expect(dbState.session.workItems).toHaveLength(4);
      expect(await canonicalCounts()).toEqual(beforeImport);
      await expect(page.getByText(/Crear frente estrategico|Crear reto|Crear iniciativa y continuar|Step 0|HMW|Test Card|experiment|prototype/i)).toHaveCount(0);
      await expect(page).not.toHaveURL(/\/initiatives\/|\/overview|\/step\/0/);
      legacyNavigation.expectClean();
      legacyNavigation.dispose();
    });
  }
});

async function startPortfolioBootstrapFromLegacyEntry(page: Page) {
  const scenario = SCENARIOS[0];
  const api = await pwRequest.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5176' });
  const user = await registerPortfolioUser(api);
  const organization = await provisionScopedPortfolioAccess(user.userId);
  const legacyFixture = await seedLegacyHandoff(api, scenario.input);
  await openLegacyHandoff(page, legacyFixture);

  const continuationId = await continueThroughAuthenticatedLegacyPortfolioEntry(page, user, organization, legacyFixture, { openPortfolioHomeForHomeCoverage: true });
  await expectScopedPortfolioAccess(page, api, user, organization.id);

  let dbState = await expectOneBootstrapSession(continuationId);
  const bootstrapSessionId = dbState.session.id;
  const anchorId = dbState.session.anchor.id;
  const confirmAnchor = page.getByRole('button', { name: /Confirmar punto de partida/i });
  if (await confirmAnchor.isVisible().catch(() => false)) {
    await confirmAnchor.click();
    await expect(page.getByText('Confirmado', { exact: true })).toBeVisible({ timeout: 15_000 });
  }
  await page.reload();
  await expect(page.getByRole('button', { name: /Incorporar trabajo existente/i })).toBeVisible({ timeout: 15_000 });
  dbState = await expectOneBootstrapSession(continuationId);
  expect(dbState.session.id).toBe(bootstrapSessionId);
  expect(dbState.session.anchor.id).toBe(anchorId);
  return { continuationId, bootstrapSessionId, anchorId };
}

function createPortfolioImportFixture(format: 'csv' | 'xlsx', testInfo: TestInfo): string {
  const rows = [
    ['Initiative', 'Owner', 'Status', 'Objective', 'KPI', 'Notes'],
    ['Nuevo onboarding digital', 'Ana', 'Active', 'Reducir abandono', 'Activation rate', 'solution-first'],
    ['Chatbot de soporte', '', 'Paused', 'Reducir tickets repetitivos', '', 'missing owner and KPI'],
    ['Programa loyalty', 'Bruno', 'Candidate', 'Aumentar recurrencia', 'Repeat purchase', 'ambiguous KPI'],
    ['Migracion CRM', 'Carla', 'Idea', 'Unificar datos comerciales', 'Data quality', ''],
  ];
  const path = testInfo.outputPath(`portfolio-bootstrap-import.${format}`);
  if (format === 'csv') {
    fs.writeFileSync(path, rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n'));
    return path;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Portfolio');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  fs.writeFileSync(path, bytes);
  return path;
}
