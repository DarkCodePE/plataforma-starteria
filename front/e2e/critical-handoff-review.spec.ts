import { expect, test, type Page, type Route } from '@playwright/test';

const SESSION_ID = 'session-kan-119d';
const SESSION_PATH = new RegExp(`/api/v1/public/portfolio-entry/sessions/${SESSION_ID}$`);
const CRITICAL_HANDOFF_PATH = new RegExp(`/api/v1/public/portfolio-entry/sessions/${SESSION_ID}/critical-handoff$`);
const MESSAGE_PATH = new RegExp(`/api/v1/public/portfolio-entry/sessions/${SESSION_ID}/messages$`);

type Scenario = {
  projection?: Record<string, unknown>;
  state?: 'current' | 'stale';
  absent?: boolean;
  failure?: boolean;
  marker?: boolean;
  criticalGate?: Promise<void>;
  onCriticalRead?: () => void;
};

function criticalProjection(overrides: Record<string, unknown> = {}) {
  return {
    conclusionStatus: 'supported',
    finalReading: 'El comité necesita comparar capacidad y urgencia antes de priorizar.',
    decisionInView: 'Qué iniciativas reciben capacidad durante este ciclo.',
    usableNow: [
      { item: 'Datos de capacidad', howItCanHelp: 'Permiten acotar las opciones disponibles.' },
      { item: 'Calendario del comité', howItCanHelp: 'Ayuda a ordenar el momento de la decisión.' },
    ],
    decisionChangingUnknowns: [
      { uncertainty: 'Falta confirmar una fecha.', whyItMatters: 'Puede cambiar la secuencia.' },
      { uncertainty: 'La disponibilidad del equipo no está cerrada.', whyItMatters: 'Puede cambiar qué opción es viable.' },
    ],
    firstMovement: {
      movement: 'Revisar el corte de capacidad actual.',
      whyNow: 'Ese corte ya existe y puede ayudar a acotar la conversación.',
      whatItMayClarify: 'Qué opciones caben en el ciclo que se está preparando.',
      boundary: 'No decide prioridades ni compromete al equipo por sí solo.',
      existingAssetsUsed: ['Informe actual de capacidad'],
    },
    ...overrides,
  };
}

function legacyHandoff() {
  return {
    id: 'legacy-handoff-1',
    version: 1,
    status: 'ready_with_uncertainty',
    reviewDisposition: 'UNREVIEWED',
    handoff: {
      understanding: { value: 'LEGACY_UNDERSTANDING_MARKER' },
      desired_outcome: { value: 'LEGACY_OUTCOME_MARKER' },
      decision_to_enable: { value: 'LEGACY_DECISION_MARKER' },
      recommended_approach: { description: 'LEGACY_RECOMMENDATION_MARKER' },
      alternative_approaches: [],
      known_context: [],
      unresolved_context: [],
      gap_resolution_map: [],
      evidence_or_clarity_needed: [],
      starteria_path: [{ action: 'legacy', description: 'LEGACY_PATH_MARKER' }],
      recommended_cta: 'LEGACY_CTA_MARKER',
      provenance_summary: [],
      handoff_status: 'ready_with_uncertainty',
    },
    createdAt: new Date().toISOString(),
  };
}

function sessionDto(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    lifecycleStatus: 'AWAITING_CONFIRMATION',
    executionStatus: 'ACTIVE',
    revision: 5,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ownership: { state: 'ANONYMOUS' },
    conversation: [],
    clarification: {
      interactionMode: 'guided_exploration',
      quickQuestionBudget: 3,
      quickQuestionsAsked: 1,
      explorationRound: 1,
      questionsAskedCurrentRound: 1,
      previousQuestions: [],
      answeredGaps: [],
      checkpoint: 'guided',
    },
    semanticProjection: {},
    nextAction: 'review_handoff',
    handoff: legacyHandoff(),
    ...overrides,
  };
}

async function installSessionMocks(page: Page, scenario: Scenario = {}) {
  await page.addInitScript(({ sessionId, marker }) => {
    window.sessionStorage.setItem('starteria.portfolioEntry.current', JSON.stringify({ sessionId, credential: 'browser-entry-token' }));
    if (marker) window.sessionStorage.setItem('starteria.portfolioEntry.criticalHandoffReviewSession', sessionId);
  }, { sessionId: SESSION_ID, marker: scenario.marker ?? true });

  await page.route('**/api/v1/**', async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/refresh') || pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 401, json: { success: false } });
      return;
    }
    await route.fulfill({ json: { success: true, data: {} } });
  });

  await page.route(SESSION_PATH, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { success: true, data: sessionDto() } });
      return;
    }
    await route.fallback();
  });

  let criticalReadCount = 0;
  await page.route(CRITICAL_HANDOFF_PATH, async (route: Route) => {
    criticalReadCount += 1;
    scenario.onCriticalRead?.();
    if (scenario.criticalGate) await scenario.criticalGate;
    if (scenario.failure) {
      await route.fulfill({ status: 503, json: { success: false, error: { code: 'UNAVAILABLE' } } });
      return;
    }
    if (scenario.absent) {
      await route.fulfill({ status: 404, json: { success: false, error: { code: 'NOT_FOUND' } } });
      return;
    }
    const state = scenario.state ?? (criticalReadCount > 1 ? 'stale' : 'current');
    await route.fulfill({
      json: {
        success: true,
        data: {
          id: 'critical-artifact-1',
          version: 2,
          schemaVersion: 'critical-handoff-projection-v0.1',
          sourceContextRevision: 4,
          sourceTurnId: 'turn-4',
          state,
          projection: scenario.projection ?? criticalProjection(),
          selected_lenses: ['LEAK_SELECTED_LENS'],
          reasoning_metadata: { private: 'LEAK_REASONING_METADATA' },
          provenance: ['LEAK_PROVENANCE'],
          source_refs: ['LEAK_SOURCE_REF'],
          raw_synthesis: { prompt: 'LEAK_RAW_SYNTHESIS' },
        },
      },
    });
  });

  await page.route(MESSAGE_PATH, async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: sessionDto({
          revision: 6,
          lifecycleStatus: 'CLARIFYING',
          nextAction: 'answer_clarification',
          conversation: [{
            id: 'turn-5',
            turnIndex: 4,
            userInput: 'La disponibilidad cambia antes del comité.',
            emittedQuestions: [{
              id: 'question-1',
              question: '¿Qué fecha de capacidad debemos considerar?',
              resolves: ['capacity_window'],
              turn_index: 4,
              interaction_mode: 'guided_exploration',
              asked_at_budget_remaining: 2,
            }],
            respondedResolves: [],
            createdAt: new Date().toISOString(),
          }],
          liveUnderstanding: {
            state: 'supported_reading',
            reading: 'La fecha de capacidad puede cambiar la decisión.',
            decisionChangingUnknowns: [],
          },
          handoff: undefined,
        }),
      },
    });
  });
}

async function openReview(page: Page, scenario?: Scenario) {
  await installSessionMocks(page, scenario);
  await page.goto('/public/start');
}

async function installExplorationJourneyMocks(page: Page) {
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  let criticalReadCount = 0;
  const checkpoint = sessionDto({
    lifecycleStatus: 'CLARIFYING',
    revision: 1,
    nextAction: 'offer_guided_exploration',
    liveUnderstanding: {
      state: 'supported_reading',
      reading: 'La fecha de capacidad puede cambiar la decisión que se prepara.',
      decisionChangingUnknowns: [],
    },
  });
  const eligible = sessionDto({ lifecycleStatus: 'HANDOFF_ELIGIBLE', revision: 2, nextAction: 'generate_handoff' });
  const review = sessionDto({ lifecycleStatus: 'AWAITING_CONFIRMATION', revision: 3, nextAction: 'review_handoff' });
  const clarified = sessionDto({
    lifecycleStatus: 'CLARIFYING',
    revision: 4,
    nextAction: 'answer_clarification',
    handoff: undefined,
    conversation: [{
      id: 'turn-5',
      turnIndex: 4,
      userInput: 'La disponibilidad cambia antes del comité.',
      emittedQuestions: [{
        id: 'question-1',
        question: '¿Qué fecha de capacidad debemos considerar?',
        resolves: ['capacity_window'],
        turn_index: 4,
        interaction_mode: 'guided_exploration',
        asked_at_budget_remaining: 2,
      }],
      respondedResolves: [],
      createdAt: new Date().toISOString(),
    }],
    liveUnderstanding: {
      state: 'supported_reading',
      reading: 'La fecha de capacidad puede cambiar la decisión.',
      decisionChangingUnknowns: [],
    },
  });

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body: Record<string, unknown> | undefined;
    try { body = request.postDataJSON() as Record<string, unknown> | undefined; } catch { body = undefined; }
    requests.push({ path: pathname, method: request.method(), body });

    if (pathname.endsWith('/auth/refresh') || pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 401, json: { success: false } });
      return;
    }
    if (pathname === '/api/v1/public/portfolio-entry/sessions' && request.method() === 'POST') {
      await route.fulfill({ status: 201, json: { success: true, data: { session: sessionDto({ lifecycleStatus: 'ENTRY_CAPTURED', revision: 0, nextAction: 'submit_message' }), publicAccessToken: 'journey-entry-token' } } });
      return;
    }
    if (pathname === `/api/v1/public/portfolio-entry/sessions/${SESSION_ID}/messages` && request.method() === 'POST') {
      await route.fulfill({ json: { success: true, data: body?.intent === 'correction' ? clarified : checkpoint } });
      return;
    }
    if (pathname.endsWith(`/${SESSION_ID}/guided-exploration`) && request.method() === 'POST') {
      await route.fulfill({ json: { success: true, data: eligible } });
      return;
    }
    if (pathname.endsWith(`/${SESSION_ID}/handoff`) && request.method() === 'POST') {
      await route.fulfill({ json: { success: true, data: review } });
      return;
    }
    if (pathname === `/api/v1/public/portfolio-entry/sessions/${SESSION_ID}/critical-handoff` && request.method() === 'GET') {
      criticalReadCount += 1;
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: 'artifact-journey',
            version: 2,
            schemaVersion: 'critical-handoff-projection-v0.1',
            sourceContextRevision: 4,
            sourceTurnId: 'private-source-turn',
            state: criticalReadCount === 1 ? 'current' : 'stale',
            projection: criticalProjection(),
            selected_lenses: ['private-lens'],
            reasoning_metadata: { private: true },
            provenance: ['private-provenance'],
            source_refs: ['private-source-ref'],
            claim_ref: 'private-claim-ref',
            raw_synthesis: { private: true },
            candidate_first_movement: { raw: true },
            route_ranking: ['private-route'],
          },
        },
      });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });

  return requests;
}

test('supported Critical Handoff review renders on desktop without legacy or internal content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openReview(page);

  const review = page.getByTestId('critical-handoff-review');
  await expect(review).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Lectura final' })).toBeVisible();
  await expect(review.getByRole('heading', { name: 'La decisión que tienes delante' })).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Lo que ya puedes usar' })).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Qué podría cambiar la decisión' })).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Un posible primer movimiento' })).toBeVisible();
  await expect(review).not.toContainText(/LEGACY_|selected_lenses|reasoning_metadata|source_refs|raw_synthesis|starteria_path|recommended_approach|recommended_cta/i);
  const renderedDom = await page.locator('body').innerHTML();
  expect(renderedDom).not.toMatch(/LEAK_SELECTED_LENS|LEAK_REASONING_METADATA|LEAK_PROVENANCE|LEAK_SOURCE_REF|LEAK_RAW_SYNTHESIS/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveJSProperty('tagName', 'BUTTON');
});

test('Critical Handoff loading is announced until its currentness-qualified read completes', async ({ page }) => {
  let releaseRead = () => undefined;
  let signalRead = () => undefined;
  const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
  const readStarted = new Promise<void>((resolve) => { signalRead = resolve; });
  await openReview(page, { criticalGate: readGate, onCriticalRead: () => signalRead() });

  await readStarted;
  await expect(page.getByTestId('critical-handoff-loading')).toHaveAttribute('aria-busy', 'true');
  releaseRead();
  await expect(page.getByTestId('critical-handoff-review')).toBeVisible();
});

test('exploration close creates the legacy handoff, loads the Critical Handoff, and correction returns to clarification', async ({ page }) => {
  const requests = await installExplorationJourneyMocks(page);
  await page.goto('/public/start');
  await page.getByLabel(/necesitas conseguir o entender/i).fill('Necesito decidir qué iniciativa puede avanzar antes del comité.');
  await page.getByRole('button', { name: /analizar mi situaci[oó]n/i }).click();

  await page.getByRole('button', { name: /ver mi propuesta de abordaje/i }).click();
  const review = page.getByTestId('critical-handoff-review');
  await expect(review).toBeVisible();
  await expect(review.getByTestId('critical-handoff-final-reading')).toContainText('El comité necesita comparar capacidad');
  await expect(review.getByTestId('critical-handoff-first-movement')).toContainText('Un posible primer movimiento');

  await review.getByRole('button', { name: 'Esto no refleja suficientemente mi situación' }).click();
  const correction = page.getByRole('textbox', { name: '¿Qué deberíamos entender mejor?' });
  await expect(correction).toBeFocused();
  await correction.fill('La disponibilidad cambia antes del comité.');
  await page.getByRole('button', { name: 'Volver a aclarar' }).click();

  await expect(page.getByTestId('portfolio-entry-active-question-text')).toContainText('¿Qué fecha de capacidad debemos considerar?');
  await expect(page.getByTestId('portfolio-entry-live-understanding')).toContainText('La fecha de capacidad puede cambiar la decisión.');
  await expect(page.getByText(/La lectura anterior ya no está vigente/)).toBeVisible();
  const handoffPost = requests.findIndex((request) => request.method === 'POST' && request.path.endsWith('/handoff'));
  const firstCriticalRead = requests.findIndex((request) => request.method === 'GET' && request.path.endsWith('/critical-handoff'));
  expect(handoffPost).toBeGreaterThanOrEqual(0);
  expect(firstCriticalRead).toBeGreaterThan(handoffPost);
  expect(requests.filter((request) => request.method === 'POST' && request.path.endsWith('/handoff'))).toHaveLength(1);
  expect(requests.filter((request) => request.method === 'GET' && request.path.endsWith('/critical-handoff'))).toHaveLength(2);
  expect(requests.filter((request) => request.method === 'POST' && request.path.endsWith('/messages'))[1]?.body)
    .toMatchObject({ intent: 'correction', message: 'La disponibilidad cambia antes del comité.' });
  expect(requests.some((request) => /\/handoff\/confirmation|\/continue-portfolio|\/convert/.test(request.path))).toBe(false);
});

test('supported review remains readable on mobile with long content and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const longText = `${'Contexto extenso para una lectura que debe envolver sin desbordar. '.repeat(16)}`;
  await openReview(page, {
    projection: criticalProjection({
      finalReading: longText,
      usableNow: Array.from({ length: 4 }, (_, index) => ({ item: `Activo ${index + 1} ${longText}`, howItCanHelp: longText })),
      decisionChangingUnknowns: Array.from({ length: 4 }, (_, index) => ({ uncertainty: `Incertidumbre ${index + 1} ${longText}`, whyItMatters: longText })),
      firstMovement: {
        movement: longText,
        whyNow: longText,
        whatItMayClarify: longText,
        boundary: longText,
        existingAssetsUsed: [longText, longText],
      },
    }),
  });

  await expect(page.getByTestId('critical-handoff-final-reading')).toContainText('Contexto extenso');
  await expect(page.getByTestId('critical-handoff-usable-now').getByRole('listitem')).toHaveCount(4);
  await expect(page.getByTestId('critical-handoff-unknowns').getByRole('listitem')).toHaveCount(4);
  await expect(page.getByTestId('critical-handoff-first-movement')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('bounded conclusion communicates remaining uncertainty', async ({ page }) => {
  await openReview(page, { projection: criticalProjection({ conclusionStatus: 'bounded' }) });
  await expect(page.getByTestId('critical-handoff-bounded-notice')).toContainText('incertidumbre importante');
  await expect(page.getByTestId('critical-handoff-final-reading')).toBeVisible();
});

test('insufficient basis does not fabricate a reading, decision, or first movement', async ({ page }) => {
  await openReview(page, {
    projection: criticalProjection({
      conclusionStatus: 'insufficient_basis',
      finalReading: null,
      decisionInView: null,
      firstMovement: null,
    }),
  });
  await expect(page.getByTestId('critical-handoff-insufficient-basis')).toContainText('no hay base suficiente');
  await expect(page.getByTestId('critical-handoff-final-reading')).toHaveCount(0);
  await expect(page.getByTestId('critical-handoff-decision')).toHaveCount(0);
  await expect(page.getByTestId('critical-handoff-first-movement')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Volver a aclarar' })).toBeVisible();
});

test('correction returns to reasoning, marks the artifact stale, and does not auto-regenerate it', async ({ page }) => {
  const requests: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/public/portfolio-entry/')) {
      requests.push({ url: request.url(), method: request.method(), body: request.postDataJSON() as Record<string, unknown> | undefined });
    }
  });
  await openReview(page);
  await page.getByRole('button', { name: 'Esto no refleja suficientemente mi situación' }).click();
  const correction = page.getByRole('textbox', { name: '¿Qué deberíamos entender mejor?' });
  await expect(correction).toBeFocused();
  await correction.fill('La disponibilidad cambia antes del comité.');
  await page.getByRole('button', { name: 'Volver a aclarar' }).click();

  await expect(page.getByTestId('portfolio-entry-active-question-text')).toContainText('¿Qué fecha de capacidad debemos considerar?');
  await expect(page.getByText(/La lectura anterior ya no está vigente/)).toBeVisible();
  expect(requests.filter((request) => request.method === 'POST' && request.url.endsWith('/messages')).map((request) => request.body)).toContainEqual(expect.objectContaining({ intent: 'correction' }));
  expect(requests.some((request) => request.url.endsWith('/handoff/confirmation'))).toBe(false);
  expect(requests.some((request) => request.url.endsWith('/continue-portfolio'))).toBe(false);
  expect(requests.some((request) => request.url.endsWith('/convert'))).toBe(false);
  expect(requests.some((request) => request.method === 'POST' && request.url.endsWith('/handoff'))).toBe(false);
});

test('stale Critical Handoff is never rendered as the current conclusion', async ({ page }) => {
  await openReview(page, { state: 'stale' });
  await expect(page.getByTestId('critical-handoff-stale')).toBeVisible();
  await expect(page.getByText('El comité necesita comparar capacidad y urgencia antes de priorizar.')).toHaveCount(0);
});

test('absent and failed Critical Handoff stay bounded and do not fall back to legacy recommendations', async ({ page }) => {
  await openReview(page, { absent: true, marker: true });
  await expect(page.getByTestId('critical-handoff-absent')).toBeVisible();
  await expect(page.getByText('LEGACY_RECOMMENDATION_MARKER')).toHaveCount(0);
  await expect(page.getByText('LEGACY_PATH_MARKER')).toHaveCount(0);
});

test('Critical Handoff fetch failure exposes retry without rendering legacy content', async ({ page }) => {
  await openReview(page, { failure: true, marker: true });
  await expect(page.getByTestId('critical-handoff-error')).toBeVisible();
  await expect(page.getByText('LEGACY_RECOMMENDATION_MARKER')).toHaveCount(0);
  await page.getByRole('button', { name: 'Intentar de nuevo' }).click();
  await expect(page.getByTestId('critical-handoff-error')).toBeVisible();
});

test('historical legacy session without a Critical Handoff keeps its compatibility review', async ({ page }) => {
  await openReview(page, { absent: true, marker: false });
  await expect(page.getByTestId('handoff-first-view')).toBeVisible();
  await expect(page.getByTestId('handoff-first-view').getByTestId('handoff-approach-step').getByText('LEGACY_PATH_MARKER')).toBeVisible();
  await expect(page.getByTestId('critical-handoff-review')).toHaveCount(0);
});

test('continue action only enters identity and claim flow', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${new URL(request.url()).pathname}`));
  await openReview(page);
  await page.getByRole('button', { name: 'Continuar con esta lectura' }).click();

  await expect(page).toHaveURL(/\/auth$/);
  const pendingClaim = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.pendingClaim') ?? '{}'));
  expect(pendingClaim).toMatchObject({ sessionId: SESSION_ID, criticalHandoffReview: true });
  expect(pendingClaim).not.toHaveProperty('identity');
  expect(requests.some((request) => /\/handoff\/confirmation|\/continue-portfolio|\/convert/.test(request))).toBe(false);
});

test('auth claims ownership and returns to the same review without confirming the artifact', async ({ page }) => {
  await page.addInitScript(({ sessionId }) => {
    window.sessionStorage.setItem('starteria.portfolioEntry.current', JSON.stringify({ sessionId, credential: 'browser-entry-token' }));
    window.sessionStorage.setItem('starteria.portfolioEntry.criticalHandoffReviewSession', sessionId);
  }, { sessionId: SESSION_ID });

  const requests: Array<{ path: string; method: string; body?: Record<string, unknown>; entryToken?: string | null }> = [];
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body: Record<string, unknown> | undefined;
    try { body = request.postDataJSON() as Record<string, unknown> | undefined; } catch { body = undefined; }
    const entryToken = request.headers()['x-starteria-entry-token'] ?? null;
    requests.push({ path: pathname, method: request.method(), body, entryToken });

    if (pathname.endsWith('/auth/refresh') || pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 401, json: { success: false } });
      return;
    }
    if (pathname === '/api/v1/auth/login' && request.method() === 'POST') {
      await route.fulfill({ json: { success: true, data: { user: { id: 'user-119d', name: 'Review User', email: 'review@example.com', role: 'participante', permissions: [] }, accessToken: 'auth-token-119d' } } });
      return;
    }
    if (pathname === `/api/v1/public/portfolio-entry/sessions/${SESSION_ID}` && request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: sessionDto({ ownership: entryToken ? { state: 'ANONYMOUS' } : { state: 'CLAIMED' } }) } });
      return;
    }
    if (pathname === `/api/v1/public/portfolio-entry/sessions/${SESSION_ID}/claim` && request.method() === 'POST') {
      await route.fulfill({ json: { success: true, data: sessionDto({ revision: 6, ownership: { state: 'CLAIMED' } }) } });
      return;
    }
    if (pathname === `/api/v1/public/portfolio-entry/sessions/${SESSION_ID}/critical-handoff` && request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: { state: 'current', projection: criticalProjection() } } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });

  await page.goto('/public/start');
  await expect(page.getByTestId('critical-handoff-review')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar con esta lectura' }).click();
  await expect(page).toHaveURL(/\/auth$/);

  await page.locator('input[type="email"]').fill('review@example.com');
  await page.locator('input[type="password"]').fill('test-password');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/public\/start$/);
  await expect(page.getByTestId('critical-handoff-review')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Esto no refleja suficientemente mi situación' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar con esta lectura' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession') ?? '{}')))
    .toEqual({ sessionId: SESSION_ID });
  expect(requests.some((request) => request.path.endsWith('/claim') && request.method === 'POST')).toBe(true);
  expect(requests.some((request) => /\/handoff\/confirmation|\/continue-portfolio|\/convert/.test(request.path))).toBe(false);
  const browserStorage = await page.evaluate(() => Array.from({ length: window.sessionStorage.length }, (_, index) => {
    const key = window.sessionStorage.key(index);
    return key ? `${key}=${window.sessionStorage.getItem(key)}` : '';
  }).join('\n'));
  expect(browserStorage).toContain(`criticalHandoffReviewSession=${SESSION_ID}`);
  expect(browserStorage).not.toMatch(/El comit[eé] necesita comparar|selected_lenses|reasoning_metadata|provenance|source_refs|claim_ref|raw_synthesis/i);
});
