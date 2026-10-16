import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const sessionId = '11111111-1111-4111-8111-111111111111';
const phase = process.env.KAN150_CAPTURE_PHASE ?? 'after';
const evidenceDirectory = path.resolve(process.cwd(), '../artifacts/KAN-150/captures', phase);

const question = {
  id: 'question-1',
  question: '¿Qué necesita poder decidir el comité?',
  reason_to_ask: 'La respuesta puede cambiar qué evidencia hace falta.',
  resolves: ['decision'],
  turn_index: 0,
  interaction_mode: 'quick_clarification',
  asked_at_budget_remaining: 2,
};

function session(liveUnderstanding: Record<string, unknown> | undefined) {
  return {
    id: sessionId,
    lifecycleStatus: 'CLARIFYING',
    executionStatus: 'ACTIVE',
    revision: 2,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ownership: { state: 'ANONYMOUS' },
    conversation: [{
      id: 'turn-1', turnIndex: 0,
      userInput: 'Tenemos 31 iniciativas con reportes de avance dispares. Necesito preparar una conversación con dirección.',
      emittedQuestions: [question], matchedQuestionIds: [], respondedResolves: [],
      createdAt: new Date().toISOString(),
    }],
    clarification: {
      interactionMode: 'quick_clarification', quickQuestionBudget: 3,
      quickQuestionsAsked: 1, explorationRound: 0, questionsAskedCurrentRound: 0,
      previousQuestions: [], answeredGaps: [],
    },
    semanticProjection: {
      understanding: {
        value: 'Así estoy entendiendo lo que me dices: portafolio: 31; iniciativas: reportes de avance dispares; decisión: conversación con dirección.',
        source: 'latestAnalysis.extracted_context',
      },
    },
    nextAction: 'answer_clarification',
    ...(liveUnderstanding ? { liveUnderstanding } : {}),
  };
}

async function startWithFixture(page: Page, response: ReturnType<typeof session>) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/public/portfolio-entry/sessions' && request.method() === 'POST') {
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {
          session: { ...response, revision: 0, conversation: [], nextAction: 'submit_message', liveUnderstanding: undefined },
          publicAccessToken: 'synthetic-entry-token',
        } }),
      });
      return;
    }
    if (url.pathname.endsWith(`/public/portfolio-entry/sessions/${sessionId}/messages`) && request.method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: response }) });
      return;
    }
    if (url.pathname.endsWith(`/public/portfolio-entry/sessions/${sessionId}`) && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...response, liveUnderstanding: undefined } }) });
      return;
    }
    if (url.pathname.endsWith('/auth/refresh') || url.pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });

  await page.goto('/public/start');
  await page.getByLabel(/necesitas resolver, conseguir o entender/i).fill('Necesito preparar una conversación con dirección sobre 31 iniciativas y sus reportes de avance.');
  await page.getByRole('button', { name: /analizar mi situ/i }).click();
  await expect(page.getByTestId('portfolio-entry-active-question')).toBeVisible();
}

test('reload keeps the conversation and question without implying a recovered reading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startWithFixture(page, session({
    state: 'supported_reading',
    reading: 'La conversación con dirección necesita una base común para comparar los reportes.',
    decisionChangingUnknowns: [],
  }));
  await expect(page.getByTestId('portfolio-entry-live-understanding')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('portfolio-entry-active-question')).toBeVisible();
  await expect(page.getByText('Ver conversación')).toBeVisible();
  await expect(page.getByTestId('portfolio-entry-live-understanding')).toHaveCount(0);
  await expect(page.getByText('Contexto de la conversación')).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  for (const state of ['supported', 'unavailable'] as const) {
    test(`${state} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await startWithFixture(page, session(state === 'supported'
        ? {
          state: 'supported_reading',
          reading: 'Los reportes de avance de distintos equipos existen, pero aún falta una base común para preparar la conversación con dirección.',
          decisionChangingUnknowns: [{ uncertainty: 'No están acordados los criterios de comparación.', whyItMatters: 'Pueden cambiar la decisión.' }],
        }
        : { state: 'synthesis_unavailable', decisionChangingUnknowns: [] }));

      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: path.join(evidenceDirectory, `${state}-${viewport.width}x${viewport.height}.png`) });
      if (phase === 'after') {
        await page.screenshot({ path: path.join(evidenceDirectory, `${state}-${viewport.width}x${viewport.height}-full.png`), fullPage: true });
      }

      if (phase === 'after') {
        await expect(page.getByText('Contexto de la conversación')).toHaveCount(0);
        await expect(page.getByText(/portafolio: 31/)).toHaveCount(0);
        await expect(page.getByTestId('portfolio-entry-active-question')).toBeVisible();
        await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveText(question.question);
        await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(question.reason_to_ask);
        await expect(page.getByTestId('portfolio-entry-quick-question-budget-note')).toHaveCount(1);
        await expect(page.getByTestId('portfolio-entry-live-understanding')).toHaveCount(1);
        await expect(page.getByText('Ver conversación')).toBeVisible();
        const questionBox = await page.getByTestId('portfolio-entry-active-question').boundingBox();
        const readingBox = await page.getByTestId('portfolio-entry-live-understanding').boundingBox();
        expect(questionBox && readingBox && questionBox.y < readingBox.y).toBeTruthy();
        if (viewport.width <= 390) {
          const submitBox = await page.getByRole('button', { name: 'Enviar respuesta' }).boundingBox();
          expect(submitBox && submitBox.y + submitBox.height <= viewport.height).toBeTruthy();
          const unknownBox = await page.getByTestId('portfolio-entry-unknown-answer-action').boundingBox();
          expect(submitBox && submitBox.height >= 44).toBeTruthy();
          expect(unknownBox && unknownBox.height >= 44 && unknownBox.x + unknownBox.width <= viewport.width).toBeTruthy();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        }
        if (state === 'supported') {
          await expect(page.getByTestId('portfolio-entry-live-understanding')).toContainText('Los reportes de avance');
          await expect(page.getByRole('button', { name: /esto no refleja lo que quise decir/i })).toBeVisible();
        } else {
          await expect(page.getByText('Tu mensaje se recibió. La aclaración puede continuar.')).toHaveCount(0);
          await expect(page.getByText('Lectura provisional')).toHaveCount(0);
          await expect(page.getByTestId('portfolio-entry-live-understanding')).toContainText('La lectura no está disponible ahora.');
          await expect(page.getByRole('button', { name: /esto no refleja lo que quise decir/i })).toHaveCount(0);
        }
        await page.getByTestId('portfolio-entry-unknown-answer-action').click();
        await expect(page.getByRole('textbox', { name: 'Tu respuesta' })).toHaveValue('No lo se todavia.');
        await page.getByText('Ver conversación').click();
        await expect(page.getByTestId('portfolio-entry-conversation-trace')).toContainText('31 iniciativas');
      }
    });
  }
}

test('combined supported reading and actions remain reachable at 200% root text on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await startWithFixture(page, session({
    state: 'supported_reading',
    reading: 'Los reportes existen, pero falta una base común para preparar la conversación con dirección.',
    decisionChangingUnknowns: [{ uncertainty: 'Faltan criterios de comparación.', whyItMatters: 'Pueden cambiar la decisión.' }],
  }));
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.getByTestId('portfolio-entry-active-question').evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, 'supported-360x800-200pct.png') });
  await page.screenshot({ path: path.join(evidenceDirectory, 'supported-360x800-200pct-full.png'), fullPage: true });

  if (phase === 'after') {
    await expect(page.getByTestId('portfolio-entry-live-understanding')).toHaveCount(1);
    await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(question.reason_to_ask);
    const geometry = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="portfolio-entry-conversation-panel"]');
      const rightOverflow = Array.from(panel?.querySelectorAll('*') ?? [])
        .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
        .map((element) => element.tagName);
      const height = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
      return {
        rightOverflow,
        submitHeight: height('[data-testid="portfolio-entry-conversation-panel"] button'),
        unknownHeight: height('[data-testid="portfolio-entry-unknown-answer-action"]'),
      };
    });
    expect(geometry.rightOverflow).toEqual([]);
    expect(geometry.submitHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.unknownHeight).toBeGreaterThanOrEqual(44);
    await page.getByTestId('portfolio-entry-unknown-answer-action').click();
    await expect(page.getByRole('textbox', { name: 'Tu respuesta' })).toHaveValue('No lo se todavia.');
    const correction = page.getByRole('button', { name: /esto no refleja lo que quise decir/i });
    await correction.scrollIntoViewIfNeeded();
    await expect(correction).toBeVisible();
    const correctionBox = await correction.boundingBox();
    expect(correctionBox && correctionBox.height >= 44 && correctionBox.x + correctionBox.width <= 360).toBeTruthy();
    await correction.click();
    await expect(page.getByRole('textbox', { name: 'Tu corrección' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDirectory, 'correction-360x800-200pct-full.png'), fullPage: true });
  }
});
