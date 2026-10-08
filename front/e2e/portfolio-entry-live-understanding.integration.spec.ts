import { expect, test, type Page, type Request, type Response } from '@playwright/test';

type TestStats = {
  analysisCalls: number;
  synthesisCalls: number;
  fakeModelCalls: number;
  turnIntents: string[];
  handoffCount: number;
  sessionRevision?: number;
  sessionLifecycleStatus?: string;
  clarificationStatus?: string;
};

const backendURL = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:4100';
const startText = 'Debo priorizar varias iniciativas.';

test('real browser, Portfolio Entry router and Prisma correction lifecycle use one synthesis per message', async ({ page }) => {
  let beforeStartClick = true;
  const preClickBrowserDiagnostics: string[] = [];
  page.on('console', (message) => {
    if (beforeStartClick && message.type() === 'error') {
      preClickBrowserDiagnostics.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    if (beforeStartClick) preClickBrowserDiagnostics.push(`pageerror: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    if (beforeStartClick) preClickBrowserDiagnostics.push(`requestfailed: ${request.method()} ${request.url()}`);
  });
  page.on('response', (response) => {
    if (beforeStartClick && response.status() >= 400) {
      preClickBrowserDiagnostics.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`);
    }
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/public/start');
  expect(await getStats(page)).toMatchObject({ analysisCalls: 0, synthesisCalls: 0 });

  const startInput = page.getByLabel(/necesitas conseguir o entender/i);
  const startButton = page.getByRole('button', { name: /analizar mi situ/i });
  await startInput.fill(startText);
  await expect(startInput).toHaveValue(startText);
  await expect(startButton).toBeVisible();
  await expect(page.getByText(/recuperando tu sesi[oó]n p[uú]blica|creando una sesi[oó]n segura/i)).toHaveCount(0);
  await expect(
    startButton,
    `Start form precondition failed: ${startText.trim().length} trimmed characters were entered, but the submit button is still disabled.`,
  ).toBeEnabled();
  console.log(`[E2E] Browser errors and failed requests before start click: ${JSON.stringify(preClickBrowserDiagnostics)}`);
  beforeStartClick = false;

  const firstMessageRequestPromise = page.waitForRequest((request) => (
    /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/messages$/.test(new URL(request.url()).pathname)
      && request.method() === 'POST'
  ));
  const firstMessageResponsePromise = page.waitForResponse((response) => (
    /^\/api\/v1\/public\/portfolio-entry\/sessions\/[^/]+\/messages$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'POST'
  ));
  const sessionCreatedPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/public/portfolio-entry/sessions'
      && response.request().method() === 'POST';
  });
  await startButton.click();
  const sessionCreatedResponse = await sessionCreatedPromise;
  expect(sessionCreatedResponse.status()).toBe(201);
  const created = await sessionCreatedResponse.json();
  const sessionId = created.data.session.id as string;
  const accessToken = created.data.publicAccessToken as string;
  const [firstMessageRequest, firstMessageResponse] = await Promise.all([
    firstMessageRequestPromise,
    firstMessageResponsePromise,
  ]);
  expect(firstMessageRequest.postDataJSON()).toEqual({ expectedRevision: 0, message: startText });
  expect(firstMessageResponse.status()).toBe(200);
  const firstMessage = await firstMessageResponse.json();
  expect(firstMessage.data).toMatchObject({
    revision: 2,
    lifecycleStatus: 'CLARIFYING',
    nextAction: 'answer_clarification',
  });
  expect(firstMessage.data.conversation[0].emittedQuestions).toHaveLength(1);
  expect(firstMessage.data.conversation[0].matchedQuestionIds).toEqual([]);

  const panel = page.getByTestId('portfolio-entry-live-understanding');
  await expect(panel).toContainText('Lectura de prueba 1 respaldada por el contexto recibido.');
  await expect(page.getByTestId('portfolio-entry-active-question-text')).toBeVisible();
  expect(await getStats(page, sessionId)).toMatchObject({
    analysisCalls: 1,
    synthesisCalls: 1,
    fakeModelCalls: 1,
    turnIntents: ['answer'],
    sessionRevision: 2,
    sessionLifecycleStatus: 'CLARIFYING',
    clarificationStatus: 'in_progress',
  });

  const normalAnswer = await submitAnswer(page, sessionId, 'Validar datos reales.');
  expect(normalAnswer.request.postDataJSON()).toMatchObject({
    expectedRevision: 2,
    message: 'Validar datos reales.',
    matchedQuestionIds: [firstMessage.data.conversation[0].emittedQuestions[0].id],
  });
  expect(normalAnswer.request.postDataJSON()).not.toHaveProperty('intent');
  expect(normalAnswer.response.status()).toBe(200);
  const normalAnswerDto = (await normalAnswer.response.json()).data;
  expect(normalAnswerDto).toMatchObject({
    revision: 4,
    lifecycleStatus: 'CLARIFYING',
    nextAction: 'offer_guided_exploration',
  });
  expect(normalAnswerDto.clarification.checkpoint).toBe('quick');
  expect(normalAnswerDto.conversation[1].matchedQuestionIds).toEqual(['decision_to_enable']);
  await expect(panel).toContainText('Lectura de prueba 2 respaldada por el contexto recibido.');
  await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /ver mi propuesta de abordaje/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /esto no refleja lo que quise decir/i })).toBeVisible();
  expect(await getStats(page, sessionId)).toMatchObject({
    analysisCalls: 2,
    synthesisCalls: 2,
    fakeModelCalls: 2,
    turnIntents: ['answer', 'answer'],
    sessionRevision: 4,
    sessionLifecycleStatus: 'CLARIFYING',
    clarificationStatus: 'exploration_offered',
  });

  const correctionRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith(`/sessions/${sessionId}/messages`)
      && request.method() === 'POST'
      && request.postDataJSON()?.intent === 'correction';
  });
  const correctionResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/v1/public/portfolio-entry/sessions/${sessionId}/messages`
      && response.request().method() === 'POST'
      && response.request().postDataJSON()?.intent === 'correction';
  });
  await page.getByRole('button', { name: /esto no refleja lo que quise decir/i }).click();
  await page.getByRole('textbox', { name: /tu corrección/i }).fill('No, revisaré el acceso después.');
  await page.getByRole('button', { name: /enviar corrección/i }).click();
  const [correction, correctionResponse] = await Promise.all([correctionRequest, correctionResponsePromise]);
  expect(correction.postDataJSON()).toMatchObject({ expectedRevision: 4, intent: 'correction' });
  expect(correction.postDataJSON()).not.toHaveProperty('matchedQuestionIds');
  expect(correctionResponse.status()).toBe(200);
  const corrected = (await correctionResponse.json()).data;
  expect(corrected).toMatchObject({
    revision: 6,
    lifecycleStatus: 'CLARIFYING',
    nextAction: 'answer_clarification',
    liveUnderstanding: { state: 'supported_reading' },
  });
  expect(corrected.clarification.checkpoint).toBeUndefined();
  expect(corrected.conversation[2].matchedQuestionIds).toEqual([]);
  expect(corrected.conversation[2].emittedQuestions).toHaveLength(1);
  await expect(panel).toContainText('Lectura de prueba 3 respaldada por el contexto recibido.');
  await expect(page.getByTestId('portfolio-entry-active-question-text'))
    .toContainText(corrected.conversation[2].emittedQuestions[0].question);
  await expect(page.getByRole('button', { name: /ver mi propuesta de abordaje/i })).toHaveCount(0);
  await expect(page.getByTestId('handoff-expanded-analysis')).toHaveCount(0);
  expect(await getStats(page, sessionId)).toMatchObject({
    analysisCalls: 3,
    synthesisCalls: 3,
    fakeModelCalls: 3,
    turnIntents: ['answer', 'answer', 'correction'],
    handoffCount: 0,
    sessionRevision: 6,
    sessionLifecycleStatus: 'CLARIFYING',
    clarificationStatus: 'in_progress',
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const checkpointButton = page.getByRole('button', { name: /ver mi propuesta de abordaje/i });
    if (await checkpointButton.isVisible().catch(() => false)) break;

    const before = await getStats(page, sessionId);
    const answer = await submitAnswer(page, sessionId, 'Comparar capacidad disponible.');
    expect(answer.response.status()).toBe(200);
    await expect(panel).toContainText(`Lectura de prueba ${before.synthesisCalls + 1} respaldada por el contexto recibido.`);
    const after = await getStats(page, sessionId);
    expect(after.analysisCalls).toBe(before.analysisCalls + 1);
    expect(after.synthesisCalls).toBe(before.synthesisCalls + 1);
    expect(after.fakeModelCalls).toBe(before.fakeModelCalls + 1);
  }

  await expect(page.getByRole('button', { name: /ver mi propuesta de abordaje/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /seguir aterrizando mi necesidad/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /esto no refleja lo que quise decir/i })).toBeVisible();
  await expect(page.getByTestId('handoff-expanded-analysis')).toHaveCount(0);

  expect((await getStats(page, sessionId)).handoffCount).toBe(0);
  const beforePassiveReads = await getStats(page, sessionId);
  const sessionURL = `${backendURL}/api/v1/public/portfolio-entry/sessions/${sessionId}`;
  const pageRead = await page.request.get(sessionURL, {
    headers: { 'X-Starteria-Entry-Token': accessToken },
  });
  expect(pageRead.status()).toBe(200);
  expect((await getStats(page, sessionId)).synthesisCalls).toBe(beforePassiveReads.synthesisCalls);

  const unauthorizedRead = await page.request.get(sessionURL, {
    headers: { Authorization: 'Bearer invalid-e2e-token' },
  });
  expect(unauthorizedRead.status()).toBe(401);
  expect((await getStats(page, sessionId)).synthesisCalls).toBe(beforePassiveReads.synthesisCalls);

  const checkpointChoiceResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith(`/sessions/${sessionId}/guided-exploration`)
      && response.request().method() === 'POST';
  });
  await page.getByRole('button', { name: /seguir aterrizando mi necesidad/i }).click();
  expect((await checkpointChoiceResponse).status()).toBe(200);
  const afterCheckpointChoice = await getStats(page, sessionId);
  expect(afterCheckpointChoice.analysisCalls).toBe(beforePassiveReads.analysisCalls + 1);
  expect(afterCheckpointChoice.synthesisCalls).toBe(beforePassiveReads.synthesisCalls);
  expect(afterCheckpointChoice.fakeModelCalls).toBe(beforePassiveReads.fakeModelCalls);
  expect(afterCheckpointChoice.handoffCount).toBe(0);
  await expect(page.getByTestId('handoff-expanded-analysis')).toHaveCount(0);

  await page.goto('/public/start');
  expect((await getStats(page, sessionId)).synthesisCalls).toBe(beforePassiveReads.synthesisCalls);
});

async function submitAnswer(page: Page, sessionId: string, answer: string): Promise<{ request: Request; response: Response }> {
  await page.getByRole('textbox', { name: /tu respuesta/i }).fill(answer);
  const requestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === `/api/v1/public/portfolio-entry/sessions/${sessionId}/messages`
      && request.method() === 'POST';
  });
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/v1/public/portfolio-entry/sessions/${sessionId}/messages`
      && response.request().method() === 'POST';
  });
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  const [request, response] = await Promise.all([requestPromise, responsePromise]);
  return { request, response };
}

async function getStats(page: Page, sessionId?: string): Promise<TestStats> {
  const url = new URL('/__test/portfolio-entry-stats', backendURL);
  if (sessionId) url.searchParams.set('sessionId', sessionId);
  const response = await page.request.get(url.toString());
  expect(response.status()).toBe(200);
  return response.json() as Promise<TestStats>;
}
