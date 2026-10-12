import { expect, test, type Page, type Route } from '@playwright/test';

const id = 'session-139';
const base = `/api/v1/public/portfolio-entry/sessions/${id}`;
const confirmedAt = '2026-10-12T10:00:00.000Z';
const source = {
  sessionId: id, contextRevision: 4, criticalHandoffId: 'critical-139',
  criticalHandoffVersion: 2, criticalHandoffSchemaVersion: 'critical-handoff-v0.1', confirmedAt,
};
const sourceB = { ...source, contextRevision: 5, criticalHandoffId: 'critical-139-b', confirmedAt: '2026-10-12T11:00:00.000Z' };
const oldGeneration = { snapshotId: 'snapshot-old-139', organizationId: 'org-alpha', criticalHandoffId: source.criticalHandoffId };
const currentOrg = { organizationId: 'org-current', name: 'Organizacion Nueva' };
const alpha = { organizationId: 'org-alpha', name: 'Organización Alfa' };
const beta = { organizationId: 'org-beta', name: 'Organización Beta' };
type Scenario = 'one' | 'many' | 'zero' | 'resolver' | 'true-stale' | 'recovered';

function session(invalidated = false) {
  return {
    id, handoffExperience: 'critical', lifecycleStatus: 'AWAITING_CONFIRMATION', executionStatus: 'ACTIVE',
    revision: invalidated ? 8 : 7, contextRevision: invalidated ? 5 : 4, expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ownership: { state: 'CLAIMED', ownerUserId: 'user-139' }, conversation: [],
    clarification: { interactionMode: 'guided_exploration', quickQuestionBudget: 3, quickQuestionsAsked: 1,
      explorationRound: 1, questionsAskedCurrentRound: 1, previousQuestions: [], answeredGaps: [], checkpoint: 'guided' },
    semanticProjection: {}, nextAction: 'review_handoff',
  };
}
function path(scenario: Scenario, invalidated = false) {
  const activeSource = scenario === 'recovered' ? sourceB : source;
  const versions = { pathSchemaVersion: 'starteria-path-dto-v0.2', projectionVersion: 'starteria-path-projection-v0.1',
    businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1' };
  return {
    experienceState: 'SUPPORTED', starteriaPathStatus: 'SUPPORTED', versions,
    sourceBinding: { criticalHandoffId: activeSource.criticalHandoffId, criticalHandoffVersion: activeSource.criticalHandoffVersion, sourceContextRevision: activeSource.contextRevision,
      current: !(scenario === 'true-stale' && invalidated), confirmed: true, ...versions },
    valueBridge: { currentState: 'Necesitamos ordenar el contexto.',
      starteriaContribution: [{ statement: 'Starteria puede ordenar la información ya compartida.',
        capabilityClass: 'CAN_SUPPORT', availabilityState: 'REQUIRES_IMPLEMENTATION' }],
      tangibleOutcome: { statement: 'Una lectura compartida.', observableArtifact: 'Resumen revisable.' }, remainingDependency: [] },
    capabilityPath: [], dependencies: [], firstSupportedMovement: null,
    boundaryStatement: 'La decisión sigue siendo humana.',
    conversionPresentation: { availability: 'NO_VERIFIED_DESTINATION', conversionConfigVersion: 1, destinations: [] },
  };
}
function read(scenario: Scenario) {
  const activeSource = scenario === 'recovered' ? sourceB : source;
  const scopes = scenario === 'many' ? [alpha, beta] : scenario === 'recovered' ? [currentOrg] : scenario === 'one' || scenario === 'resolver' ? [alpha] : [];
  const status = scenario === 'true-stale' ? 'STALE_SOURCE'
    : scenario === 'resolver' ? 'SCOPE_VALIDATION_FAILED'
      : scenario === 'many' ? 'SELECT_SCOPE' : scenario === 'zero' ? 'READY_PROVISIONAL' : 'READY_AUTHORIZED_SCOPE';
  return {
    dtoVersion: 'portfolio-setup-continuity-read-v0.1', status,
    ...(scenario === 'true-stale' ? {} : { sourceBinding: activeSource, continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1, evidence: 'SERVER_OWNED_VERSIONED' } }),
    scopeState: scenario === 'many' ? 'MULTIPLE' : scenario === 'one' || scenario === 'recovered' ? 'ONE'
      : scenario === 'resolver' ? 'VALIDATION_FAILED' : scenario === 'true-stale' ? 'UNRESOLVED' : 'NONE',
    ...(status === 'READY_AUTHORIZED_SCOPE' || status === 'SELECT_SCOPE' ? { authorizedScopes: scopes } : {}),
    ...(status === 'READY_AUTHORIZED_SCOPE' ? { currentScope: scenario === 'recovered' ? currentOrg : alpha } : {}),
    portfolioAccess: { portfolioRead: status === 'READY_AUTHORIZED_SCOPE' },
    ...(scenario === 'true-stale' ? {} : { carriedContext: { criticalReading: scenario === 'recovered' ? 'Lectura actual B.' : 'El equipo necesita comparar capacidad.', truthClass: 'CONFIRMED_REPRESENTATION' } }),
    openItems: scenario === 'true-stale' ? [] : [{ sourceRef: activeSource.criticalHandoffId, kind: 'DOWNSTREAM_NON_BLOCKING', description: 'Confirmar la disponibilidad.' }],
  };
}

async function open(page: Page, scenario: Scenario) {
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown>; key?: string }> = [];
  const activeSource = scenario === 'recovered' ? sourceB : source;
  let reads = 0;
  let invalidated = false;
  await page.addInitScript((sessionId) => {
    window.sessionStorage.setItem('starteria.portfolioEntry.claimedSession', JSON.stringify({ sessionId }));
    window.sessionStorage.setItem('starteria.portfolioEntry.criticalHandoffReviewSession', sessionId);
  }, id);
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body: Record<string, unknown> | undefined;
    try { body = request.postDataJSON() as Record<string, unknown>; } catch { body = undefined; }
    requests.push({ path: pathname, method: request.method(), body, key: request.headers()['idempotency-key'] });
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (pathname.endsWith('/auth/refresh')) return fulfill({ accessToken: 'fixture-token' });
    if (pathname.endsWith('/auth/me')) return fulfill({ id: 'user-139', name: 'Persona', email: 'person@example.test', role: 'participante', initials: 'P', permissions: [] });
    if (pathname === base && request.method() === 'GET') return fulfill(session(invalidated));
    if (pathname === `${base}/critical-handoff`) return fulfill({
      id: activeSource.criticalHandoffId, version: activeSource.criticalHandoffVersion, sourceContextRevision: activeSource.contextRevision, state: scenario === 'true-stale' && invalidated ? 'stale' : 'current', confirmationState: 'confirmed',
      confirmedAt: activeSource.confirmedAt, projection: { conclusionStatus: 'supported', finalReading: scenario === 'recovered' ? 'Lectura actual B.' : 'El equipo necesita comparar capacidad.',
        decisionInView: 'Qué trabajo atender primero.', usableNow: [], decisionChangingUnknowns: [], firstMovement: null },
    });
    if (pathname === `${base}/starteria-path`) return fulfill(path(scenario, invalidated));
    if (pathname === `${base}/portfolio-setup-continuity` && request.method() === 'GET') {
      reads += 1;
      // The session advances to revision/context B after the initial 114D/114E render, before 114F GET.
      if (scenario === 'true-stale') invalidated = true;
      return fulfill(read(scenario === 'resolver' && reads > 1 ? 'one' : scenario));
    }
    if (pathname === `${base}/portfolio-setup-continuity/continue` && request.method() === 'POST') {
      const selected = scenario === 'recovered' ? currentOrg : body?.organizationId === beta.organizationId ? beta : alpha;
      return fulfill({ dtoVersion: 'portfolio-setup-continuity-write-v0.1', snapshotId: scenario === 'recovered' ? 'snapshot-new-139' : 'snapshot-139',
        snapshotGeneration: scenario === 'recovered' ? 2 : 1, snapshotState: 'CURRENT', sessionRevision: 8,
        sourceBinding: body?.sourceBinding, continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 },
        organizationScopeId: selected.organizationId, nextAuthorizedSurface: 'PORTFOLIO_HOME_BOOTSTRAP',
        currentness: 'REVALIDATED_AT_WRITE', createdAt: confirmedAt });
    }
    return fulfill([]);
  });
  await page.goto('/public/start');
  return requests;
}

test('confirmed 114D and current 114E prepare one-scope snapshot without Home', async ({ page }) => {
  const requests = await open(page, 'one');
  await expect(page.getByRole('heading', { name: 'Retomamos lo que ya entendimos' })).toBeVisible();
  await expect(page.getByText(alpha.name, { exact: true })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar con este contexto' }).click();
  await expect(page.getByText(/La continuidad quedó preparada/)).toBeVisible();
  expect(requests.filter((entry) => entry.path.endsWith('/portfolio-setup-continuity/continue'))).toHaveLength(1);
  expect(requests.some((entry) => /\/portfolio\/inicio|\/portfolio\/setup|\/convert|\/continue-portfolio/.test(entry.path))).toBe(false);
  expect(new URL(page.url()).pathname).toBe('/public/start');
});

test('multiple scopes require explicit selection', async ({ page }) => {
  const requests = await open(page, 'many');
  const button = page.getByRole('button', { name: 'Continuar con este contexto' });
  await expect(button).toBeDisabled();
  await page.getByRole('radio', { name: alpha.name }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: beta.name })).toBeChecked();
  await button.click();
  await expect(page.getByText(/La continuidad quedó preparada/)).toBeVisible();
  expect(requests.find((entry) => entry.path.endsWith('/continue'))?.body?.organizationId).toBe(beta.organizationId);
});

test('zero scopes preserve context without POST', async ({ page }) => {
  const requests = await open(page, 'zero');
  await expect(page.getByText(/Tu avance está guardado/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar con este contexto' })).toHaveCount(0);
  expect(requests.filter((entry) => entry.path.endsWith('/continue'))).toHaveLength(0);
});

test('resolver failure retries GET and recovers', async ({ page }) => {
  const requests = await open(page, 'resolver');
  await expect(page.getByText(/no pudo verificar tus espacios/)).toBeVisible();
  await page.getByRole('button', { name: 'Volver a comprobar' }).click();
  await expect(page.getByText(alpha.name, { exact: true })).toBeVisible();
  expect(requests.filter((entry) => entry.path.endsWith('/portfolio-setup-continuity') && entry.method === 'GET')).toHaveLength(2);
});

test('true stale source after session revision advances offers review and does not POST', async ({ page }) => {
  const requests = await open(page, 'true-stale');
  await expect(page.getByText(/lectura que confirmó este camino cambió/)).toBeVisible();
  await page.getByRole('button', { name: 'Revisar lectura actual' }).click();
  await expect.poll(() => requests.filter((entry) => entry.path === `${base}/critical-handoff` && entry.method === 'GET').length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('heading', { name: /Esta lectura ya no/ })).toBeVisible();

  expect(new URL(page.url()).pathname).toBe('/public/start');
  expect(requests.filter((entry) => entry.path.endsWith('/continue'))).toHaveLength(0);
});

test('valid source B recovers from old stored generation A and prepares generation 2', async ({ page }) => {
  // HTTP fixture models the post-KAN-140 GET. KAN-140 PostgreSQL integration proves the persisted A -> B sequence.
  const requests = await open(page, 'recovered');
  await expect(page.getByTestId('portfolio-setup-continuity').getByText('Lectura actual B.')).toBeVisible();
  await expect(page.getByText(currentOrg.name, { exact: true })).toBeVisible();
  await expect(page.getByText(oldGeneration.organizationId)).toHaveCount(0);
  await expect(page.getByText(oldGeneration.snapshotId)).toHaveCount(0);
  await expect(page.getByText(/El equipo necesita comparar capacidad/)).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar con este contexto' }).click();
  await expect(page.getByText(/La continuidad qued/)).toBeVisible();
  const post = requests.find((entry) => entry.path === `${base}/portfolio-setup-continuity/continue`);
  expect(post?.body?.sourceBinding).toMatchObject({ criticalHandoffId: sourceB.criticalHandoffId,
    contextRevision: sourceB.contextRevision, confirmedAt: sourceB.confirmedAt });
  expect(post?.key).toBeTruthy();
  expect(post?.body?.organizationId).toBeUndefined();
  expect(new URL(page.url()).pathname).toBe('/public/start');
  expect(requests.some((entry) => /\/portfolio\/inicio|\/portfolio\/setup|\/convert|\/continue-portfolio/.test(entry.path))).toBe(false);
});
for (const width of [320, 375, 390]) {
  test(`mobile scope selection at ${width}px has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await open(page, 'many');
    await page.getByRole('radio', { name: alpha.name }).check();
    await expect(page.getByRole('button', { name: 'Continuar con este contexto' })).toBeEnabled();
    const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  });
  test(`mobile stale recovery copy at ${width}px remains usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    const requests = await open(page, 'true-stale');
    await expect(page.getByText(/La lectura que confirm/)).toBeVisible();
    const review = page.getByRole('button', { name: 'Revisar lectura actual' });
    await expect(review).toBeVisible();
    await review.click();
    await expect.poll(() => requests.filter((entry) => entry.path === `${base}/critical-handoff`).length).toBeGreaterThanOrEqual(2);
    const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  });
}
