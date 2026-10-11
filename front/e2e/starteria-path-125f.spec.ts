import { expect, test, type Page, type Route } from '@playwright/test';

const SESSION_ID = 'session-kan-125f';
const BASE = `/api/v1/public/portfolio-entry/sessions/${SESSION_ID}`;
const versions = {
  pathSchemaVersion: 'starteria-path-dto-v0.2',
  projectionVersion: 'starteria-path-projection-v0.1',
  businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
};
const decision = 'Decidir qué iniciativas reciben capacidad durante este ciclo.';

type DestinationType = 'DEMO' | 'EARLY_ACCESS';
type Scenario = {
  experienceState?: 'SUPPORTED' | 'BOUNDED' | 'STALE' | 'UNAVAILABLE_INSUFFICIENT_BASIS' | 'UNAVAILABLE_INVALID';
  confirmed?: boolean;
  criticalState?: 'current' | 'stale';
  invalidPath?: boolean;
  firstMovement?: boolean;
  destinations?: DestinationType[];
  submitStatus?: number;
  configChangeOnSubmit?: boolean;
  analyticsFailure?: boolean;
  longContent?: boolean;
};

function pathFixture(scenario: Scenario) {
  const state = scenario.experienceState ?? 'SUPPORTED';
  if (state !== 'SUPPORTED' && state !== 'BOUNDED') {
    return { experienceState: state, boundaryStatement: 'No hay una ruta sustentada.', versions };
  }
  const destinations = scenario.destinations ?? [];
  return {
    experienceState: state, starteriaPathStatus: state, versions,
    sourceBinding: {
      criticalHandoffId: 'critical-125f', criticalHandoffVersion: 2, sourceContextRevision: 4,
      current: true, confirmed: true, ...versions,
    },
    valueBridge: {
      currentState: scenario.longContent ? 'Hay que comparar capacidad antes de priorizar iniciativas. '.repeat(35)
        : 'Hay que comparar capacidad antes de priorizar iniciativas.',
      starteriaContribution: [{ statement: 'Starteria podría estructurar la comparación.',
        capabilityClass: 'CAN_SUPPORT', availabilityState: 'REQUIRES_IMPLEMENTATION' }],
      tangibleOutcome: { statement: 'Una lectura estructurada para revisar.',
        observableArtifact: 'Una vista con evidencia y dudas visibles.' },
      remainingDependency: [{ statement: 'La organización debe confirmar su capacidad.',
        dependencyType: 'REQUIRES_ORGANIZATIONAL_INPUT' }],
    },
    capabilityPath: [{ capabilityType: 'MAKE_VISIBLE', statement: 'Hacer visibles las dudas.',
      whyRelevant: 'La decisión depende de ellas.' }],
    dependencies: [{ dependencyType: 'REQUIRES_ORGANIZATIONAL_INPUT',
      statement: 'La organización debe confirmar su capacidad.', whyItMatters: 'Puede cambiar la secuencia.' }],
    firstSupportedMovement: scenario.firstMovement === false ? null : {
      movement: 'Revisar la evidencia disponible.', whyNow: 'Ya hay información para comparar.',
      whatItMayClarify: 'Qué opciones tienen base.', boundary: 'No decide por la organización.',
    },
    boundaryStatement: 'La lectura no sustituye la decisión humana.',
    conversionPresentation: {
      availability: destinations.length === 0 ? 'NO_VERIFIED_DESTINATION'
        : destinations.length === 2 ? 'EARLY_ACCESS_AND_DEMO'
          : destinations[0] === 'DEMO' ? 'DEMO_ONLY' : 'EARLY_ACCESS_ONLY',
      conversionConfigVersion: 9,
      destinations: destinations.map((type) => ({
        type, status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY', contextSharingSupported: true,
        label: type === 'DEMO' ? 'Solicitar una demo' : 'Solicitar acceso anticipado',
        availabilityDisclosure: type === 'DEMO'
          ? 'Envía una solicitud de contacto para una posible demostración. No reserva una cita.'
          : 'Envía una solicitud de interés en acceso anticipado. No garantiza acceso.',
      })),
    },
  };
}

async function openPath(page: Page, scenario: Scenario = {}) {
  const requests: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const pathReads: string[] = [];
  let currentScenario = scenario;
  await page.addInitScript(({ sessionId, analyticsFailure }) => {
    window.sessionStorage.setItem('starteria.portfolioEntry.current', JSON.stringify({ sessionId, credential: 'fixture-token' }));
    window.sessionStorage.setItem('starteria.portfolioEntry.criticalHandoffReviewSession', sessionId);
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer = [];
    if (analyticsFailure) {
      const originalDispatch = window.dispatchEvent.bind(window);
      window.dispatchEvent = (event) => {
        if (/^(starteria_path|tangible_value|conversion_cta|demo_clicked|conversion_submitted)/.test(event.type)) {
          throw new Error('fixture analytics failure');
        }
        return originalDispatch(event);
      };
      (window as unknown as { dataLayer: unknown }).dataLayer = { push: () => { throw new Error('fixture provider failure'); } };
    }
  }, { sessionId: SESSION_ID, analyticsFailure: scenario.analyticsFailure ?? false });
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body: Record<string, unknown> | undefined;
    try { body = request.postDataJSON() as Record<string, unknown>; } catch { body = undefined; }
    requests.push({ method: request.method(), path: pathname, body });
    if (pathname.endsWith('/auth/refresh') || pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 401, json: { success: false } });
    } else if (pathname === BASE && request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: {
        id: SESSION_ID, lifecycleStatus: 'AWAITING_CONFIRMATION', executionStatus: 'ACTIVE', revision: 5,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(), ownership: { state: 'CLAIMED', ownerUserId: 'fixture-user' },
        conversation: [], clarification: { interactionMode: 'guided_exploration', quickQuestionBudget: 3,
          quickQuestionsAsked: 1, explorationRound: 1, questionsAskedCurrentRound: 1,
          previousQuestions: [], answeredGaps: [], checkpoint: 'guided' },
        semanticProjection: {}, nextAction: 'review_handoff', handoffExperience: 'critical',
      } } });
    } else if (pathname === `${BASE}/critical-handoff` && request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: {
        id: 'critical-125f', version: 2, sourceContextRevision: 4,
        state: currentScenario.criticalState ?? 'current',
        confirmationState: currentScenario.confirmed === false ? 'provisional' : 'confirmed',
        confirmedAt: currentScenario.confirmed === false ? null : '2026-10-10T12:00:00.000Z',
        projection: {
          conclusionStatus: 'supported', finalReading: 'La capacidad debe compararse antes de priorizar.',
          decisionInView: decision, usableNow: [{ item: 'Capacidad actual', howItCanHelp: 'Acota opciones.' }],
          decisionChangingUnknowns: [{ uncertainty: 'Disponibilidad', whyItMatters: 'Cambia prioridades.' }],
          firstMovement: null,
        },
      } } });
    } else if (pathname === `${BASE}/starteria-path` && request.method() === 'GET') {
      pathReads.push(pathname);
      await route.fulfill({ json: { success: true, data: currentScenario.invalidPath ? { invalid: true } : pathFixture(currentScenario) } });
    } else if (pathname === `${BASE}/conversion-submissions` && request.method() === 'POST') {
      if (currentScenario.configChangeOnSubmit) {
        currentScenario = { ...currentScenario, destinations: [] };
        await route.fulfill({ status: 503, json: { success: false,
          error: { code: 'CONVERSION_DESTINATION_UNAVAILABLE', message: 'No disponible.' } } });
      } else if (currentScenario.submitStatus) {
        await route.fulfill({ status: currentScenario.submitStatus, json: { success: false,
          error: { code: currentScenario.submitStatus === 503 ? 'CONVERSION_SUBMISSION_FAILED' : 'CONVERSION_SOURCE_STALE',
            message: currentScenario.submitStatus === 503 ? 'private server payload'.repeat(100) : 'La lectura cambió.' } } });
      } else {
        await route.fulfill({ status: 201, json: { success: true, data: {
          submissionId: 'fixture-receipt', destinationType: body?.destinationType,
          purpose: body?.purpose, submittedAt: '2026-10-10T12:00:00.000Z',
          receiptStatus: 'RECEIVED', contextShared: body?.contextSharingMode === 'SHARE_CONTEXT_WITH_CONVERSION',
          idempotentReplay: false,
        } } });
      }
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });
  await page.goto('/public/start');
  return { requests, pathReads };
}

test('confirmed 114D shows bounded 114E value with no destination, funnel or product navigation', async ({ page }) => {
  const { requests, pathReads } = await openPath(page);
  await expect(page.getByTestId('critical-handoff-review')).toBeVisible();
  await expect(page.getByTestId('starteria-path-supported')).toBeVisible();
  await page.getByTestId('starteria-path-supported').scrollIntoViewIfNeeded();
  await expect.poll(async () => page.evaluate(() =>
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer
      .some((item) => item.event === 'starteria_path_viewed'))).toBe(true);
  await expect(page.getByTestId('starteria-path-value-bridge')).toContainText('estructurar la comparación');
  await expect(page.getByTestId('starteria-path-tangible-outcome')).toContainText('vista con evidencia');
  await page.getByTestId('starteria-path-tangible-outcome').scrollIntoViewIfNeeded();
  await expect.poll(async () => page.evaluate(() =>
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer
      .some((item) => item.event === 'tangible_value_viewed'))).toBe(true);
  await expect(page.getByTestId('starteria-path-first-movement')).toBeVisible();
  await expect(page.getByTestId('starteria-path-boundary')).toContainText('decisión humana');
  await expect(page.getByRole('button', { name: /Solicitar una demo|Solicitar acceso anticipado/ })).toHaveCount(0);
  await expect(page.locator('form')).toHaveCount(0);
  expect(pathReads).toHaveLength(1);
  expect(requests.some(({ path }) => /continue-portfolio|portfolio\/setup|pilot-interest/.test(path))).toBe(false);
  const events = await page.evaluate(() => (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer);
  expect(events.some(({ event }) => event === 'starteria_path_viewed')).toBe(true);
  expect(events.some(({ event }) => event === 'tangible_value_viewed')).toBe(true);
  expect(events.some(({ event }) => event === 'conversion_cta_viewed')).toBe(false);
  expect(JSON.stringify(events)).not.toMatch(/Decidir qué|Capacidad actual|fixture-token/);
  await expect(page).not.toHaveURL(/portfolio\/setup|continue-portfolio/);
});

test('Path states fail closed and only show a first movement when supported by the fixture', async ({ page }) => {
  await openPath(page, { experienceState: 'BOUNDED', firstMovement: false });
  await expect(page.getByTestId('starteria-path-supported')).toBeVisible();
  await expect(page.getByTestId('starteria-path-first-movement')).toHaveCount(0);
  await expect(page.getByText(/incertidumbres que podrían cambiar/)).toBeVisible();
});

for (const [name, scenario, expected] of [
  ['insufficient', { experienceState: 'UNAVAILABLE_INSUFFICIENT_BASIS' }, 'starteria-path-unavailable_insufficient_basis'],
  ['stale Path', { experienceState: 'STALE' }, 'starteria-path-stale'],
  ['invalid source', { experienceState: 'UNAVAILABLE_INVALID' }, 'starteria-path-unavailable_invalid'],
  ['invalid response', { invalidPath: true }, 'starteria-path-invalid'],
] as const) {
  test(`${name} shows no supported Path or commercial action`, async ({ page }) => {
    await openPath(page, scenario);
    await expect(page.getByTestId(expected)).toBeVisible();
    await expect(page.getByTestId('starteria-path-supported')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Solicitar una demo|Solicitar acceso anticipado/ })).toHaveCount(0);
  });
}

test('unconfirmed 114D never requests or presents 114E', async ({ page }) => {
  const { pathReads } = await openPath(page, { confirmed: false });
  await expect(page.getByTestId('critical-handoff-review')).toBeVisible();
  await expect(page.getByTestId('starteria-path-supported')).toHaveCount(0);
  expect(pathReads).toHaveLength(0);
});

for (const [name, destinations] of [
  ['Demo only', ['DEMO']], ['Early Access only', ['EARLY_ACCESS']],
  ['both', ['DEMO', 'EARLY_ACCESS']],
] as Array<[string, DestinationType[]]>) {
  test(`${name} fixture shows only its verified actions`, async ({ page }) => {
    await openPath(page, { destinations });
    await expect(page.getByTestId('starteria-path-supported')).toBeVisible();
    for (const type of ['DEMO', 'EARLY_ACCESS'] as const) {
      const label = type === 'DEMO' ? 'Solicitar una demo' : 'Solicitar acceso anticipado';
      await expect(page.getByRole('button', { name: label })).toHaveCount(destinations.includes(type) ? 1 : 0);
    }
    await expect(page.locator('form')).toHaveCount(0);
    await page.getByRole('button', { name: destinations[0] === 'DEMO' ? 'Solicitar una demo' : 'Solicitar acceso anticipado' }).scrollIntoViewIfNeeded();
    await expect.poll(async () => page.evaluate(() =>
      (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer
        .filter((item) => item.event === 'conversion_cta_viewed').length)).toBe(1);
  });
}

test('first-party receipt uses no context by default and never grants access', async ({ page }) => {
  const { requests } = await openPath(page, { destinations: ['DEMO'] });
  await page.getByRole('button', { name: 'Solicitar una demo' }).click();
  await expect(page.getByTestId('conversion-submission-form-DEMO')).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByLabel(/Correo electr/i).fill('person@example.org');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByTestId('conversion-submission-success')).toContainText('Recibimos tu solicitud');
  const submit = requests.find(({ path, method }) => path.endsWith('/conversion-submissions') && method === 'POST')?.body;
  expect(submit).toMatchObject({ destinationType: 'DEMO', purpose: 'DEMO_REQUEST',
    contextSharingMode: 'NO_ENTRY_CONTEXT_SHARED' });
  expect(submit).not.toHaveProperty('decisionInViewPreview');
  expect(JSON.stringify(submit)).not.toMatch(/rawConversation|selected_lenses|provenance|model|provider|fullPath/);
  await expect(page).not.toHaveURL(/portfolio\/setup|continue-portfolio/);
});

test('explicit opt-in can be reversed before submit; only decision preview is sent when enabled', async ({ page }) => {
  const { requests } = await openPath(page, { destinations: ['EARLY_ACCESS'] });
  await page.getByRole('button', { name: 'Solicitar acceso anticipado' }).click();
  await page.getByLabel(/Correo electr/i).fill('person@example.org');
  await page.getByRole('checkbox').check();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByTestId('conversion-submission-success')).toBeVisible();
  const submit = requests.find(({ path, method }) => path.endsWith('/conversion-submissions') && method === 'POST')?.body;
  expect(submit).toMatchObject({ destinationType: 'EARLY_ACCESS', purpose: 'EARLY_ACCESS_REQUEST',
    contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION', explicitContextConsent: true,
    decisionInViewPreview: decision });
  expect(JSON.stringify(submit)).not.toMatch(/rawConversation|selected_lenses|provenance|model|provider|fullPath/);
});

test('stale source between view and submit returns bounded recovery without success', async ({ page }) => {
  const { requests } = await openPath(page, { destinations: ['DEMO'], submitStatus: 409 });
  await page.getByRole('button', { name: 'Solicitar una demo' }).click();
  await page.getByLabel(/Correo electr/i).fill('person@example.org');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByTestId('conversion-submission-stale')).toBeVisible();
  await expect(page.getByTestId('conversion-submission-success')).toHaveCount(0);
  await expect(page.getByTestId('critical-handoff-review')).toBeVisible();
  expect(requests.filter(({ path, method }) => path.endsWith('/conversion-submissions') && method === 'POST')).toHaveLength(1);
});

test('destination change rejects submit and refresh removes the action', async ({ page }) => {
  await openPath(page, { destinations: ['DEMO'], configChangeOnSubmit: true });
  await page.getByRole('button', { name: 'Solicitar una demo' }).click();
  await page.getByLabel(/Correo electr/i).fill('person@example.org');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByTestId('conversion-destination-unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.getByTestId('starteria-path-supported')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Solicitar una demo' })).toHaveCount(0);
  await expect(page.getByTestId('conversion-submission-success')).toHaveCount(0);
});

test('mobile long Path remains readable and keyboard can reach the verified action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPath(page, { destinations: ['DEMO'], longContent: true });
  await expect(page.getByTestId('starteria-path-supported')).toBeVisible();
  await page.getByTestId('starteria-path-supported').evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { dataLayer?: Array<{ event?: string }> }).dataLayer
      ?.filter((item) => item.event === 'starteria_path_viewed').length ?? 0)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Solicitar una demo' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('conversion-submission-form-DEMO')).toBeVisible();
  const email = page.getByLabel(/Correo electr/i);
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('required', '');
  await expect(page.getByLabel(/Nombre \(opcional\)/i)).toBeVisible();
  await expect(page.getByLabel(/Organización \(opcional\)/i)).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('button', { name: 'Solicitar una demo' })).toBeFocused();
});

test('API 503 gives a bounded announced retry without exposing the server payload', async ({ page }) => {
  await openPath(page, { destinations: ['DEMO'], submitStatus: 503 });
  await page.getByRole('button', { name: 'Solicitar una demo' }).click();
  await page.getByLabel(/Correo electr/i).fill('person@example.org');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos registrar la solicitud');
  await expect(page.getByText('private server payload')).toHaveCount(0);
  await expect(page.getByTestId('conversion-submission-success')).toHaveCount(0);
});

test('analytics dispatch and provider failures do not interrupt Path or first-party receipt', async ({ page }) => {
  await openPath(page, { destinations: ['DEMO'], analyticsFailure: true });
  await expect(page.getByTestId('starteria-path-supported')).toBeVisible();
  await page.getByRole('button', { name: 'Solicitar una demo' }).click();
  await page.getByLabel(/Correo electr/i).fill('person@example.org');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByTestId('conversion-submission-success')).toBeVisible();
  await expect(page.getByText('fixture analytics failure')).toHaveCount(0);
});
