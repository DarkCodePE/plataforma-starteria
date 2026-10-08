import { expect, test, type Page } from '@playwright/test';

const sessionId = '11111111-1111-4111-8111-111111111111';
const entryText = 'Necesito entender qué validar en una iniciativa antes del comité.';

type LiveUnderstanding = {
  state: 'supported_reading' | 'no_supported_insight' | 'insufficient_basis' | 'synthesis_unavailable';
  reading?: string;
  tensions?: Array<{ statement: string; whyItMatters: string }>;
  decision?: { decisionToPrepare: string };
  decisionChangingUnknowns: Array<{ uncertainty: string; whyItMatters: string }>;
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId,
    lifecycleStatus: 'ENTRY_CAPTURED',
    executionStatus: 'ACTIVE',
    revision: 1,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ownership: { state: 'ANONYMOUS' },
    conversation: [],
    clarification: {
      interactionMode: 'quick_clarification',
      quickQuestionBudget: 3,
      quickQuestionsAsked: 0,
      explorationRound: 0,
      questionsAskedCurrentRound: 0,
      previousQuestions: [],
      answeredGaps: [],
    },
    semanticProjection: {},
    nextAction: 'answer_clarification',
    ...overrides,
  };
}

function questionResponse(liveUnderstanding: LiveUnderstanding, overrides: Record<string, unknown> = {}) {
  return session({
    lifecycleStatus: 'CLARIFYING',
    conversation: [{
      id: 'turn-1',
      turnIndex: 0,
      userInput: entryText,
      emittedQuestions: [{
        id: 'question-1',
        question: '¿Qué necesita poder validar esta iniciativa?',
        reason_to_ask: 'Puede cambiar qué condición habilita el siguiente paso.',
        resolves: ['outcome'],
        turn_index: 0,
        interaction_mode: 'quick_clarification',
        asked_at_budget_remaining: 2,
      }],
      matchedQuestionIds: [],
      respondedResolves: [],
      createdAt: new Date().toISOString(),
    }],
    clarification: {
      interactionMode: 'quick_clarification',
      quickQuestionBudget: 3,
      quickQuestionsAsked: 1,
      explorationRound: 0,
      questionsAskedCurrentRound: 1,
      previousQuestions: [],
      answeredGaps: [],
    },
    liveUnderstanding,
    ...overrides,
  });
}

function checkpointResponse(liveUnderstanding: LiveUnderstanding) {
  return session({
    lifecycleStatus: 'CLARIFYING',
    nextAction: 'offer_guided_exploration',
    clarification: {
      interactionMode: 'quick_clarification',
      quickQuestionBudget: 3,
      quickQuestionsAsked: 1,
      explorationRound: 0,
      questionsAskedCurrentRound: 1,
      previousQuestions: [],
      answeredGaps: [],
      checkpoint: 'quick',
    },
    liveUnderstanding,
  });
}

async function mockPublicEntryApi(
  page: Page,
  initialResponse: ReturnType<typeof session>,
  correctionResponse?: ReturnType<typeof session>,
  correctionGate?: Promise<void>,
  onCorrectionStarted?: () => void,
) {
  const messages: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON?.() as Record<string, unknown> | undefined;

    if (url.pathname === '/api/v1/public/portfolio-entry/sessions' && request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { session: session({ revision: 0, nextAction: 'submit_message' }), publicAccessToken: 'test-entry-token' } }),
      });
      return;
    }

    if (url.pathname.endsWith(`/public/portfolio-entry/sessions/${sessionId}/messages`) && request.method() === 'POST') {
      messages.push(body ?? {});
      if (body?.intent === 'correction') {
        onCorrectionStarted?.();
        if (correctionGate) await correctionGate;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: correctionResponse ?? initialResponse }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: initialResponse }),
      });
      return;
    }

    if (url.pathname.endsWith('/auth/refresh') || url.pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });
  return messages;
}

async function startEntry(page: Page) {
  const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
  await page.goto(new URL('/public/start', baseUrl).toString());
  await page.getByLabel(/necesitas conseguir o entender/i).fill(entryText);
  await page.getByRole('button', { name: /analizar mi situ/i }).click();
}

const supportedTradeoff: LiveUnderstanding = {
  state: 'supported_reading',
  reading: 'La validación del prototipo depende del permiso para usar datos reales, mientras el comité necesita una señal útil pronto.',
  tensions: [{
    statement: 'El plazo del comité y el permiso para acceder a datos reales condicionan la validación.',
    whyItMatters: 'Una prueba sin datos autorizados puede no responder la pregunta que el comité necesita resolver.',
  }],
  decision: { decisionToPrepare: 'Si la iniciativa puede validar el prototipo a tiempo para el comité.' },
  decisionChangingUnknowns: [
    { uncertainty: 'Aún falta confirmar cuándo estará disponible el permiso.', whyItMatters: 'Ese plazo puede cambiar qué evidencia llega al comité.' },
    { uncertainty: 'No está claro qué señal considerará suficiente el equipo.', whyItMatters: 'La lectura puede cambiar al acordar qué resultado sería útil.' },
  ],
};

test('desktop clarification shows supported Live Understanding and submits a correction', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const corrected = questionResponse({
    ...supportedTradeoff,
    reading: 'En esta iniciativa, la validación depende de contar con acceso autorizado a datos reales.',
    tensions: [],
    decision: { decisionToPrepare: 'Si esta iniciativa puede validar su prototipo con datos reales.' },
    decisionChangingUnknowns: [],
  }, { revision: 2 });
  const messages = await mockPublicEntryApi(page, questionResponse(supportedTradeoff), corrected);

  await startEntry(page);

  const panel = page.getByTestId('portfolio-entry-live-understanding');
  await expect(panel).toContainText('Esto es lo que Starteria está entendiendo hasta ahora');
  await expect(panel).toContainText(supportedTradeoff.reading!);
  await expect(panel).toContainText('Lo que puede estar en juego');
  await expect(panel).toContainText('La decisión que parece estar en juego');
  await expect(panel).toContainText('Qué todavía podría cambiar esta lectura');
  await expect(page.getByTestId('portfolio-entry-active-question')).toBeVisible();

  await page.getByRole('button', { name: /esto no refleja lo que quise decir/i }).click();
  const correction = page.getByRole('textbox', { name: /tu corrección/i });
  await expect(correction).toBeFocused();
  await correction.fill('Me refiero a esta iniciativa concreta y a su permiso de datos.');
  await correction.press('Enter');

  await expect(page.getByText('En esta iniciativa, la validación depende de contar con acceso autorizado a datos reales.')).toBeVisible();
  await expect(page.getByText(supportedTradeoff.reading!)).toHaveCount(0);
  expect(messages[1]).toMatchObject({ intent: 'correction', expectedRevision: 1 });
  expect(messages[1]).not.toHaveProperty('matchedQuestionIds');
});

test('mobile clarification wraps long readings and unknowns without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const longReading: LiveUnderstanding = {
    ...supportedTradeoff,
    reading: 'La iniciativa necesita validar una relación entre los permisos de datos, el calendario del comité y la disponibilidad del equipo sin dar por resuelto ninguno de esos puntos. '.repeat(3),
  };
  await mockPublicEntryApi(page, questionResponse(longReading));

  await startEntry(page);

  const panel = page.getByTestId('portfolio-entry-live-understanding');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/aún falta confirmar cuándo estará disponible el permiso/i)).toBeVisible();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(390);
});

test('no-supported-insight keeps the clarification question as the main next action', async ({ page }) => {
  await mockPublicEntryApi(page, questionResponse({ state: 'no_supported_insight', decisionChangingUnknowns: [] }));

  await startEntry(page);

  await expect(page.getByTestId('portfolio-entry-live-understanding')).toContainText(/todavía no tiene suficiente base/i);
  await expect(page.getByTestId('portfolio-entry-active-question-text')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /tu respuesta/i })).toBeVisible();
  await expect(page.getByTestId('portfolio-entry-live-understanding')).not.toContainText(/tensión|decisión|cartera/i);
});

test('insufficient basis shows only a brief context note beside the active question', async ({ page }) => {
  await mockPublicEntryApi(page, questionResponse({
    state: 'insufficient_basis',
    reading: 'No debe aparecer.',
    tensions: [{ statement: 'No debe aparecer.', whyItMatters: 'No debe aparecer.' }],
    decision: { decisionToPrepare: 'No debe aparecer.' },
    decisionChangingUnknowns: [],
  }));

  await startEntry(page);

  const panel = page.getByTestId('portfolio-entry-live-understanding');
  await expect(panel).toContainText('Todavía falta contexto para ofrecer una lectura útil.');
  await expect(panel).not.toContainText('No debe aparecer.');
  await expect(page.getByTestId('portfolio-entry-active-question-text')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /tu respuesta/i })).toBeVisible();
});

test('checkpoint correction hides the checkpoint while processing and reopens clarification', async ({ page }) => {
  let releaseCorrection = () => undefined;
  let signalCorrectionStarted = () => undefined;
  const correctionGate = new Promise<void>((resolve) => { releaseCorrection = resolve; });
  const correctionStarted = new Promise<void>((resolve) => { signalCorrectionStarted = resolve; });
  const reopened = questionResponse({
    ...supportedTradeoff,
    reading: 'La lectura corregida conserva el foco en esta iniciativa.',
    tensions: [],
    decision: { decisionToPrepare: 'Qué validar primero en esta iniciativa.' },
    decisionChangingUnknowns: [],
  }, { revision: 2 });
  await mockPublicEntryApi(page, checkpointResponse(supportedTradeoff), reopened, correctionGate, () => signalCorrectionStarted());

  await startEntry(page);

  await expect(page.getByRole('button', { name: /ver mi propuesta de abordaje/i })).toBeVisible();
  await page.getByRole('button', { name: /esto no refleja lo que quise decir/i }).click();
  await page.getByRole('textbox', { name: /tu corrección/i }).fill('Retomemos la aclaración de esta iniciativa.');
  await page.getByRole('button', { name: /enviar corrección/i }).click();
  await correctionStarted;

  await expect(page.getByTestId('portfolio-entry-checkpoint-correction-pending')).toBeVisible();
  await expect(page.getByRole('button', { name: /ver mi propuesta de abordaje/i })).toHaveCount(0);
  releaseCorrection();

  await expect(page.getByTestId('portfolio-entry-active-question-text')).toContainText('¿Qué necesita poder validar esta iniciativa?');
  await expect(page.getByText('La lectura corregida conserva el foco en esta iniciativa.')).toBeVisible();
  await expect(page.getByTestId('portfolio-entry-checkpoint-correction-pending')).toHaveCount(0);
});

test('synthesis failure is non-fatal and leaves clarification available', async ({ page }) => {
  await mockPublicEntryApi(page, questionResponse({ state: 'synthesis_unavailable', decisionChangingUnknowns: [] }));

  await startEntry(page);

  const panel = page.getByTestId('portfolio-entry-live-understanding');
  await expect(panel).toContainText('Tu mensaje se recibió. La aclaración puede continuar.');
  await expect(panel).not.toContainText(/provider|model|openrouter|error|reintentar/i);
  await expect(page.getByRole('textbox', { name: /tu respuesta/i })).toBeVisible();
  await expect(page.getByTestId('portfolio-entry-active-question-text')).toBeVisible();
});
