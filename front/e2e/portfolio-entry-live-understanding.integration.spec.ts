import { expect, test, type Page } from '@playwright/test';

type TestStats = {
  analysisCalls: number;
  synthesisCalls: number;
  fakeModelCalls: number;
  turnIntents: string[];
  handoffCount: number;
};

const backendURL = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:4100';
const startText = 'Iniciativa para comité.';

test('real browser, Portfolio Entry router and Prisma correction lifecycle use one synthesis per message', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/public/start');
  expect(await getStats(page)).toMatchObject({ analysisCalls: 0, synthesisCalls: 0 });

  await page.getByLabel(/necesitas conseguir o entender/i).fill(startText);
  const sessionCreatedPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/public/portfolio-entry/sessions'
      && response.request().method() === 'POST';
  });
  await page.getByRole('button', { name: /analizar mi situ/i }).click();
  const sessionCreatedResponse = await sessionCreatedPromise;
  expect(sessionCreatedResponse.status()).toBe(201);
  const created = await sessionCreatedResponse.json();
  const sessionId = created.data.session.id as string;
  const accessToken = created.data.publicAccessToken as string;

  const panel = page.getByTestId('portfolio-entry-live-understanding');
  await expect(panel).toContainText('Lectura de prueba 1 respaldada por el contexto recibido.');
  await expect(page.getByTestId('portfolio-entry-active-question-text')).toBeVisible();
  expect(await getStats(page, sessionId)).toMatchObject({
    analysisCalls: 1,
    synthesisCalls: 1,
    fakeModelCalls: 1,
    turnIntents: ['answer'],
  });

  await submitAnswer(page, 'Validar datos reales.');
  await expect(panel).toContainText('Lectura de prueba 2 respaldada por el contexto recibido.');
  expect(await getStats(page, sessionId)).toMatchObject({
    analysisCalls: 2,
    synthesisCalls: 2,
    fakeModelCalls: 2,
    turnIntents: ['answer', 'answer'],
  });

  const correctionRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith(`/sessions/${sessionId}/messages`)
      && request.method() === 'POST'
      && request.postDataJSON()?.intent === 'correction';
  });
  await page.getByRole('button', { name: /esto no refleja lo que quise decir/i }).click();
  await page.getByRole('textbox', { name: /tu corrección/i }).fill('No, revisaré el acceso después.');
  await page.getByRole('button', { name: /enviar corrección/i }).click();
  const correction = await correctionRequest;
  expect(correction.postDataJSON()).toMatchObject({ intent: 'correction' });
  await expect(panel).toContainText('Lectura de prueba 3 respaldada por el contexto recibido.');
  await expect(page.getByTestId('portfolio-entry-active-question-text')).toBeVisible();
  expect(await getStats(page, sessionId)).toMatchObject({
    analysisCalls: 3,
    synthesisCalls: 3,
    fakeModelCalls: 3,
    turnIntents: ['answer', 'answer', 'correction'],
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const checkpointButton = page.getByRole('button', { name: /ver mi propuesta de abordaje/i });
    if (await checkpointButton.isVisible().catch(() => false)) break;

    const before = await getStats(page, sessionId);
    await submitAnswer(page, 'Comparar capacidad disponible.');
    await expect(panel).toContainText(`Lectura de prueba ${before.synthesisCalls + 1} respaldada por el contexto recibido.`);
    const after = await getStats(page, sessionId);
    expect(after.analysisCalls).toBe(before.analysisCalls + 1);
    expect(after.synthesisCalls).toBe(before.synthesisCalls + 1);
    expect(after.fakeModelCalls).toBe(before.fakeModelCalls + 1);
  }

  await expect(page.getByRole('button', { name: /ver mi propuesta de abordaje/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /seguir aterrizando mi necesidad/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /esto no refleja lo que quise decir/i })).toBeVisible();

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

  await page.goto('/public/start');
  expect((await getStats(page, sessionId)).synthesisCalls).toBe(beforePassiveReads.synthesisCalls);
});

async function submitAnswer(page: Page, answer: string) {
  await page.getByRole('textbox', { name: /tu respuesta/i }).fill(answer);
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/messages') && response.request().method() === 'POST';
  });
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  expect((await responsePromise).status()).toBe(200);
}

async function getStats(page: Page, sessionId?: string): Promise<TestStats> {
  const url = new URL('/__test/portfolio-entry-stats', backendURL);
  if (sessionId) url.searchParams.set('sessionId', sessionId);
  const response = await page.request.get(url.toString());
  expect(response.status()).toBe(200);
  return response.json() as Promise<TestStats>;
}
