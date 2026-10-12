import { expect, test, type Page, type Route } from '@playwright/test';
import { makeBootstrap } from '../src/features/portfolio-lead/bootstrap/testing/bootstrapFixtures';

const sessionId = 'session-141';
const snapshotId = 'snapshot-141';
const source = { sessionId, contextRevision: 4, criticalHandoffId: 'critical-141',
  criticalHandoffVersion: 1, criticalHandoffSchemaVersion: 'critical-handoff-v0.1',
  confirmedAt: '2026-10-12T10:00:00.000Z' };
const pathVersions = { projectionVersion: 'starteria-path-projection-v0.1',
  pathSchemaVersion: 'starteria-path-dto-v0.2', businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1' };
const organization = { id: 'org-141', name: 'Organización de prueba' };
const arrival = { dtoVersion: 'portfolio-setup-home-arrival-v0.1', snapshotId,
  snapshotGeneration: 1, sessionId, organization,
  source: { contextRevision: 4, criticalHandoffId: 'critical-141', criticalHandoffVersion: 1 },
  continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 },
  carriedContext: { criticalReading: { text: 'La capacidad necesita revisión.', sourceRef: 'critical-141',
    origin: 'AI_INFERRED', truthClass: 'CONFIRMED_REPRESENTATION' },
    decisionFrame: { text: 'Elegir el trabajo a revisar primero.', sourceRef: 'critical-141',
      origin: 'AI_SUGGESTED', truthClass: 'CONFIRMED_REPRESENTATION' },
    firstMoveSuggestion: { text: 'Inspeccionar carga.', sourceRef: 'critical-141',
      origin: 'AI_SUGGESTED', truthClass: 'PROVISIONAL_USER_CONTEXT' } },
  openItems: [{ sourceRef: 'critical-141', kind: 'DOWNSTREAM_NON_BLOCKING', description: 'Confirmar capacidad.' }],
  currentness: 'REVALIDATED_AT_HOME_ARRIVAL', bootstrapEligible: true };

type Scenario = 'valid' | 'revoked' | 'stale' | 'wrong-user' | 'global-only' | 'legacy' | 'ordinary';

async function fixture(page: Page, scenario: Scenario) {
  const calls: Array<{ path: string; method: string; body?: unknown }> = [];
  await page.addInitScript((id) => {
    window.sessionStorage.setItem('starteria.portfolioEntry.claimedSession', JSON.stringify({ sessionId: id }));
    window.sessionStorage.setItem('starteria.portfolioEntry.criticalHandoffReviewSession', id);
  }, sessionId);
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown;
    try { body = request.postDataJSON(); } catch { body = undefined; }
    calls.push({ path, method: request.method(), body });
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    const fail = (status: number, code: string) => route.fulfill({ status,
      json: { success: false, error: { code, message: 'Acceso no disponible.' } } });
    if (path.endsWith('/auth/refresh')) return ok({ accessToken: 'fixture-token' });
    if (path.endsWith('/auth/me')) return ok({ id: scenario === 'wrong-user' ? 'other-141' : 'user-141',
      name: 'Persona', email: 'person@example.test', role: scenario === 'ordinary' || scenario === 'legacy' || scenario === 'global-only'
        ? 'portfolio_lead' : 'owner', initials: 'P',
      permissions: ['ordinary', 'legacy', 'global-only'].includes(scenario) ? ['portfolio:read'] : [] });
    const base = `/api/v1/public/portfolio-entry/sessions/${sessionId}`;
    if (path === base) return ok({ id: sessionId, handoffExperience: 'critical', lifecycleStatus: 'AWAITING_CONFIRMATION',
      executionStatus: 'ACTIVE', revision: 7, contextRevision: 4,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      ownership: { state: 'CLAIMED', ownerUserId: 'user-141' }, conversation: [], semanticProjection: {},
      clarification: { interactionMode: 'guided_exploration', quickQuestionBudget: 3, quickQuestionsAsked: 1,
        explorationRound: 1, questionsAskedCurrentRound: 1, previousQuestions: [], answeredGaps: [], checkpoint: 'guided' },
      nextAction: 'review_handoff' });
    if (path === `${base}/critical-handoff`) return ok({ id: 'critical-141', version: 1, sourceContextRevision: 4,
      state: 'current', confirmationState: 'confirmed', confirmedAt: source.confirmedAt,
      projection: { conclusionStatus: 'supported', finalReading: 'La capacidad necesita revisión.',
        decisionInView: 'Elegir el trabajo a revisar primero.', usableNow: [], decisionChangingUnknowns: [], firstMovement: null } });
    if (path === `${base}/starteria-path`) return ok({ experienceState: 'SUPPORTED', starteriaPathStatus: 'SUPPORTED',
      versions: pathVersions, sourceBinding: { criticalHandoffId: 'critical-141', criticalHandoffVersion: 1,
        sourceContextRevision: 4, current: true, confirmed: true, ...pathVersions },
      valueBridge: { currentState: 'Necesitamos revisar capacidad.',
        starteriaContribution: [{ statement: 'Starteria puede ordenar la lectura.', capabilityClass: 'CAN_SUPPORT',
          availabilityState: 'REQUIRES_IMPLEMENTATION' }],
        tangibleOutcome: { statement: 'Lectura compartida.', observableArtifact: 'Resumen revisable.' }, remainingDependency: [] },
      capabilityPath: [], dependencies: [], firstSupportedMovement: null,
      boundaryStatement: 'La decisión sigue siendo humana.',
      conversionPresentation: { availability: 'NO_VERIFIED_DESTINATION', conversionConfigVersion: 1, destinations: [] } });
    if (path === `${base}/portfolio-setup-continuity` && request.method() === 'GET') return ok({
      dtoVersion: 'portfolio-setup-continuity-read-v0.1', status: 'READY_AUTHORIZED_SCOPE', sourceBinding: source,
      continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1, evidence: 'SERVER_OWNED_VERSIONED' },
      scopeState: 'ONE', authorizedScopes: [{ organizationId: organization.id, name: organization.name }],
      currentScope: { organizationId: organization.id, name: organization.name }, portfolioAccess: { portfolioRead: true },
      carriedContext: { criticalReading: 'La capacidad necesita revisión.', truthClass: 'CONFIRMED_REPRESENTATION' }, openItems: [] });
    if (path === `${base}/portfolio-setup-continuity/continue`) return ok({
      dtoVersion: 'portfolio-setup-continuity-write-v0.1', snapshotId, snapshotGeneration: 1, snapshotState: 'CURRENT',
      sessionRevision: 8, sourceBinding: (body as { sourceBinding: unknown }).sourceBinding,
      continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 }, organizationScopeId: organization.id,
      nextAuthorizedSurface: 'PORTFOLIO_HOME_BOOTSTRAP', currentness: 'REVALIDATED_AT_WRITE', createdAt: source.confirmedAt });
    if (path.endsWith(`/continuations/${snapshotId}/portfolio-home-arrival`)) {
      if (scenario === 'revoked' || scenario === 'global-only') return fail(403, 'PORTFOLIO_SETUP_ARRIVAL_SCOPE_REVOKED');
      if (scenario === 'stale') return fail(409, 'PORTFOLIO_SETUP_ARRIVAL_STALE_SOURCE');
      if (scenario === 'wrong-user') return fail(404, 'PORTFOLIO_SETUP_ARRIVAL_NOT_FOUND');
      return ok(arrival);
    }
    if (path.endsWith('/portfolio-bootstrap/sessions/from-portfolio-setup-continuity')) {
      const bootstrap = makeBootstrap('anchor_provisional');
      return ok({ ...bootstrap, sourceContinuation: { id: snapshotId, sessionId },
        bootstrapSession: { ...bootstrap.bootstrapSession, userId: 'user-141', organizationId: organization.id,
          sourceContinuationId: snapshotId }, anchor: bootstrap.anchor && { ...bootstrap.anchor,
          outcomeStatement: 'La capacidad necesita revisión.', businessSignalStatus: 'unknown', businessSignalValue: null,
          sourceRefs: { source: 'PORTFOLIO_SETUP_114F_V1', reviewRequired: true } } });
    }
    if (path.endsWith('/continuations/legacy-141/home-context')) return ok({ continuationId: 'legacy-141',
      sessionId, organization, arrival: { understoodNeed: 'Legacy need', desiredOutcome: null,
        confirmedContext: [], openItems: [], laterWork: [], organizationalUnknowns: [], nextStep: 'Continue' } });
    if (path.endsWith('/portfolio-bootstrap/sessions/from-continuation')) return ok(makeBootstrap('anchor_provisional'));
    if (path.endsWith('/portfolio/capacity')) return ok({ fronts: [], signals: [], note: '' });
    if (path.endsWith('/portfolio/home')) return ok({ learnings: [] });
    return ok([]);
  });
  return calls;
}

test('114D → 114E → 114F snapshot → explicit Home → dedicated Bootstrap, without Project or Steps', async ({ page }) => {
  const calls = await fixture(page, 'valid');
  await page.goto('/public/start');
  await expect(page.getByRole('heading', { name: 'Retomamos lo que ya entendimos' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar con este contexto' }).click();
  const action = page.getByRole('link', { name: 'Continuar al portafolio' });
  await expect(action).toHaveAttribute('href', `/portfolio/inicio?portfolioSetupContinuationId=${snapshotId}`);
  calls.length = 0;
  await action.click();
  await expect(page.getByTestId('portfolio-setup-home-arrival')).toBeVisible();
  await expect(page.getByLabel('Contexto traído desde Entrada').getByText('La capacidad necesita revisión.', { exact: true })).toBeVisible();
  await expect(page.getByText('Confirmar capacidad.')).toBeVisible();
  await expect(page.getByText('Lectura de Portfolio pendiente de revisión.')).toHaveCount(0);
  await expect(page.getByTestId('portfolio-bootstrap-home-a').getByText('La capacidad necesita revisión.', { exact: true })).toBeVisible();
  await expect.poll(() => calls.some((call) => call.path.endsWith('/from-portfolio-setup-continuity'))).toBe(true);
  expect(calls.findIndex((call) => call.path.endsWith('/portfolio-home-arrival')))
    .toBeLessThan(calls.findIndex((call) => call.path.endsWith('/from-portfolio-setup-continuity')));
  expect(calls.filter((call) => /\/portfolio\/(strategic-fronts|challenges|initiatives)|\/portfolio\/setup|\/home-context/.test(call.path))).toHaveLength(0);
  expect(calls.filter((call) => call.path === '/api/v1/projects')).toHaveLength(0);
  expect(calls.filter((call) => call.method !== 'GET' && /\/projects|\/steps/.test(call.path))).toHaveLength(0);
});

for (const [scenario, label] of [
  ['revoked', 'scope revoked'], ['stale', 'source changed'], ['wrong-user', 'wrong user'], ['global-only', 'global only'],
] as const) {
  test(`${label} blocks 114F Home and Bootstrap`, async ({ page }) => {
    const calls = await fixture(page, scenario);
    await page.goto(`/portfolio/inicio?portfolioSetupContinuationId=${snapshotId}`);
    await expect(page.getByTestId('portfolio-setup-arrival-denied')).toBeVisible();
    await expect(page.getByTestId('portfolio-setup-home-arrival')).toHaveCount(0);
    expect(calls.some((call) => call.path.endsWith('/from-portfolio-setup-continuity'))).toBe(false);
    expect(calls.some((call) => call.path.endsWith('/home-context'))).toBe(false);
    expect(calls.some((call) => call.path === '/api/v1/projects')).toBe(false);
    expect(calls.some((call) => /\/portfolio\/(strategic-fronts|challenges|initiatives)/.test(call.path))).toBe(false);
    if (scenario === 'stale') {
      await page.getByRole('button', { name: 'Revisar lectura actual' }).click();
      await expect(page).toHaveURL(/\/public\/start/);
    }
  });
}

test('legacy identity continues through legacy Home context and Bootstrap', async ({ page }) => {
  const calls = await fixture(page, 'legacy');
  await page.goto('/portfolio/inicio?portfolioEntryContinuationId=legacy-141');
  await expect.poll(() => calls.some((call) => call.path.endsWith('/continuations/legacy-141/home-context'))).toBe(true);
  await expect.poll(() => calls.some((call) => call.path.endsWith('/from-continuation'))).toBe(true);
  expect(calls.some((call) => call.path.endsWith('/portfolio-home-arrival'))).toBe(false);
});

test('ordinary Home uses the unchanged path without 114F identity', async ({ page }) => {
  const calls = await fixture(page, 'ordinary');
  await page.goto('/portfolio/inicio');
  await expect(page.getByRole('heading', { name: /Qué requiere atención hoy/ })).toBeVisible();
  expect(calls.some((call) => call.path.endsWith('/portfolio-home-arrival'))).toBe(false);
  expect(calls.some((call) => call.path.endsWith('/from-portfolio-setup-continuity'))).toBe(false);
});

test('114F arrival and Bootstrap fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await fixture(page, 'valid');
  await page.goto(`/portfolio/inicio?portfolioSetupContinuationId=${snapshotId}`);
  await expect(page.getByTestId('portfolio-setup-home-arrival')).toBeVisible();
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
});

test('trailing slash still uses the 114F gate and suppresses tenant preload', async ({ page }) => {
  const calls = await fixture(page, 'valid');
  await page.goto(`/portfolio/inicio/?portfolioSetupContinuationId=${snapshotId}`);
  await expect(page.getByTestId('portfolio-setup-home-arrival')).toBeVisible();
  expect(calls.some((call) => call.path.endsWith('/portfolio-home-arrival'))).toBe(true);
  expect(calls.some((call) => call.path === '/api/v1/projects')).toBe(false);
  expect(calls.some((call) => /\/portfolio\/(strategic-fronts|challenges|initiatives)/.test(call.path))).toBe(false);
});

test('leaving 114F by SPA navigation restores ordinary Home project loading', async ({ page }) => {
  const calls = await fixture(page, 'ordinary');
  await page.goto(`/portfolio/inicio?portfolioSetupContinuationId=${snapshotId}`);
  await expect(page.getByTestId('portfolio-setup-home-arrival')).toBeVisible();
  expect(calls.some((call) => call.path === '/api/v1/projects')).toBe(false);
  await page.evaluate(() => {
    window.history.pushState({}, '', '/portfolio/inicio');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: /Qué requiere atención hoy/ })).toBeVisible();
  await expect.poll(() => calls.some((call) => call.path === '/api/v1/projects')).toBe(true);
});
