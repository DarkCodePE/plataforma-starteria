import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sessionId = '14514514-5145-4145-8145-145145145145';
const entryText = 'Necesito entender qué información falta para decidir dónde empezar.';
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;
const phase = process.env.KAN145_P2_CAPTURE_PHASE === 'before' ? 'before' : 'after';
const evidenceDir = resolve(process.cwd(), '../artifacts/KAN-145/P2/captures', phase);

function question(index: number, mode: 'quick_clarification' | 'guided_exploration' = 'quick_clarification') {
  return {
    id: `question-${index}`,
    question: [
      '¿Qué criterio cambiaría la decisión que necesitas preparar?',
      '¿Qué información tienes hoy para comprobar ese criterio?',
      '¿Quién puede confirmar si esa información es suficiente para la decisión?',
    ][index - 1],
    reason_to_ask: [
      'Puede cambiar si primero conviene aclarar criterios o comparar la información disponible.',
      'Ayuda a separar lo que ya se puede comparar de lo que sigue abierto.',
      'Permite saber qué evidencia falta confirmar antes de avanzar.',
    ][index - 1],
    resolves: [`gap-${index}`],
    turn_index: index - 1,
    interaction_mode: mode,
    asked_at_budget_remaining: Math.max(0, 3 - index),
  };
}

function session(count: number, mode: 'quick_clarification' | 'guided_exploration' = 'quick_clarification', checkpoint = false) {
  const conversation = Array.from({ length: Math.max(count, 1) }, (_, index) => ({
    id: `turn-${index + 1}`,
    turnIndex: index,
    userInput: index === 0 ? entryText : `Respuesta sintética ${index}.`,
    emittedQuestions: index < count ? [question(index + 1, mode)] : [],
    matchedQuestionIds: index === 0 ? [] : [`question-${index}`],
    respondedResolves: [],
    createdAt: '2026-10-15T00:00:00.000Z',
  }));
  return {
    id: sessionId,
    handoffExperience: 'none',
    lifecycleStatus: 'CLARIFYING',
    executionStatus: 'ACTIVE',
    revision: Math.max(count, 1),
    expiresAt: '2099-01-01T00:00:00.000Z',
    ownership: { state: 'ANONYMOUS' },
    conversation,
    clarification: {
      interactionMode: mode,
      quickQuestionBudget: 3,
      quickQuestionsAsked: mode === 'quick_clarification' ? count : 3,
      explorationRound: mode === 'guided_exploration' ? 1 : 0,
      questionsAskedCurrentRound: count,
      previousQuestions: [],
      answeredGaps: [],
      ...(checkpoint ? { checkpoint: 'quick' } : {}),
    },
    semanticProjection: {},
    nextAction: checkpoint ? 'offer_guided_exploration' : count ? 'answer_clarification' : 'submit_message',
  };
}

async function openScene(page: Page, response: ReturnType<typeof session>) {
  const submitted: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/public/portfolio-entry/sessions' && request.method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        success: true,
        data: { session: { ...session(0), revision: 0 }, publicAccessToken: 'synthetic-p2-token' },
      }) });
      return;
    }
    if (url.pathname.endsWith(`/public/portfolio-entry/sessions/${sessionId}/messages`) && request.method() === 'POST') {
      submitted.push(request.postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: response }) });
      return;
    }
    if (url.pathname.endsWith('/auth/refresh') || url.pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });
  await page.goto('/public/start');
  await page.getByLabel(/necesitas resolver, conseguir o entender/i).fill(entryText);
  await page.getByRole('button', { name: /analizar mi situ/i }).click();
  await expect(page.getByTestId('portfolio-entry-conversation-panel').or(page.getByRole('button', { name: 'Ver mi propuesta de abordaje' }))).toBeVisible();
  return submitted;
}

test.describe('KAN-145 P2 — aplicación real con DTO sintético determinista', () => {
  for (const count of [1, 2, 3]) {
    for (const viewport of viewports) {
      test(`COP-${count === 1 ? '04' : count === 2 ? '06' : '08-QUESTION'} ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openScene(page, session(count));
        const active = page.getByTestId('portfolio-entry-active-question');
        await expect(active).toBeVisible();
        await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveText(question(count).question!);
        await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(question(count).reason_to_ask!);
        await expect(page.getByRole('textbox', { name: 'Tu respuesta' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Enviar respuesta' })).toBeVisible();

        mkdirSync(evidenceDir, { recursive: true });
        const scene = count === 1 ? 'COP-04' : count === 2 ? 'COP-06' : 'COP-08-QUESTION';
        const name = `${scene}-${viewport.width}x${viewport.height}`;
        await page.screenshot({ path: resolve(evidenceDir, `${name}.png`), animations: 'disabled' });
        if (phase === 'after' && count === 1) {
          await page.screenshot({ path: resolve(evidenceDir, `${name}-FULL.png`), animations: 'disabled', fullPage: true });
        }
        const geometry = await page.evaluate(() => {
          const box = (selector: string) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null;
          };
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth,
            question: box('[data-testid="portfolio-entry-active-question"]'),
            answer: box('#portfolio-entry-answer'),
            submit: box('[data-testid="portfolio-entry-conversation-panel"] button'),
            unknownAction: box('[data-testid="portfolio-entry-unknown-answer-action"]'),
            budgetNote: box('[data-testid="portfolio-entry-quick-question-budget-note"]'),
          };
        });
        writeFileSync(resolve(evidenceDir, `${name}.json`), JSON.stringify({
          source: 'REAL_APP_SYNTHETIC_API_DTO', phase, scene, viewport, geometry,
        }, null, 2));
        if (phase === 'after') {
          await expect(page.getByText('Aclaración breve')).toBeVisible();
          expect(await page.getByText(/\d de hasta 3/i).count()).toBe(0);
          const note = page.getByText('La aclaración inicial puede requerir hasta tres preguntas, solo si aportan valor. Si después se ofrece profundizar, tú decides; esa exploración es aparte');
          expect(await note.count()).toBe(count === 1 ? 1 : 0);
          expect(geometry.scrollWidth).toBeLessThanOrEqual(viewport.width);
          if (viewport.width < 400) {
            expect(geometry.question?.top).toBeGreaterThanOrEqual(0);
            expect(geometry.unknownAction?.right).toBeLessThanOrEqual(viewport.width);
            const unknown = page.getByTestId('portfolio-entry-unknown-answer-action');
            await unknown.scrollIntoViewIfNeeded();
            const reachable = await unknown.boundingBox();
            expect(reachable).not.toBeNull();
            expect(reachable!.y + reachable!.height).toBeLessThanOrEqual(viewport.height);
          }
        }
      });
    }
  }

  for (const rootFontSize of [16, 24, 32]) {
    test(`P2 robustez móvil 360x800 con razón extensa y fuente raíz ${rootFontSize}px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      const response = session(1);
      const longReason = 'Esta pregunta ayuda a distinguir qué información ya tienes, qué criterio usarías para comparar las opciones y qué dato necesitarías confirmar con otra persona antes de decidir el siguiente paso. Así puedes responder con lo que sabes hoy y señalar lo que todavía queda abierto.';
      response.conversation[0]!.emittedQuestions[0]!.reason_to_ask = longReason;
      const submitted = await openScene(page, response);
      await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, rootFontSize);
      await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(longReason);
      await page.getByTestId('portfolio-entry-active-question').evaluate((element) => element.scrollIntoView({ block: 'start' }));

      mkdirSync(evidenceDir, { recursive: true });
      const name = `COP-04-ROBUST-360x800-LONG-${rootFontSize}px`;
      await page.screenshot({ path: resolve(evidenceDir, `${name}.png`), animations: 'disabled' });
      await page.screenshot({ path: resolve(evidenceDir, `${name}-FULL.png`), fullPage: true, animations: 'disabled' });
      const geometry = await page.evaluate(() => {
        const bounds = (selector: string) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } : null;
        };
        return {
          viewport: { width: innerWidth, height: innerHeight },
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          question: bounds('[data-testid="portfolio-entry-active-question"]'),
          reason: bounds('[data-testid="portfolio-entry-active-question-reason"]'),
          submit: bounds('[data-testid="portfolio-entry-conversation-panel"] button'),
          unknown: bounds('[data-testid="portfolio-entry-unknown-answer-action"]'),
          overflowing: Array.from(document.querySelectorAll('body *'))
            .map((element) => ({ tag: element.tagName, testId: element.getAttribute('data-testid'), className: typeof element.className === 'string' ? element.className : '', text: element.textContent?.slice(0, 65), right: element.getBoundingClientRect().right }))
            .filter((element) => element.right > innerWidth + 1)
            .slice(0, 12),
          panelOverflowing: Array.from(document.querySelectorAll('[data-testid="portfolio-entry-conversation-panel"] *'))
            .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
            .map((element) => element.tagName),
        };
      });
      writeFileSync(resolve(evidenceDir, `${name}.json`), JSON.stringify({ source: 'REAL_APP_SYNTHETIC_API_DTO', phase, longReason, rootFontSize, geometry }, null, 2));

      if (phase === 'after') {
        if (rootFontSize < 32) expect(geometry.scrollWidth).toBeLessThanOrEqual(360);
        expect(geometry.panelOverflowing).toEqual([]);
        expect(geometry.submit?.height).toBeGreaterThanOrEqual(44);
        expect(geometry.unknown?.height).toBeGreaterThanOrEqual(44);
        expect(geometry.submit?.right).toBeLessThanOrEqual(360);
        expect(geometry.unknown?.right).toBeLessThanOrEqual(360);
        const unknown = page.getByTestId('portfolio-entry-unknown-answer-action');
        await unknown.scrollIntoViewIfNeeded();
        const reachable = await unknown.boundingBox();
        expect(reachable).not.toBeNull();
        expect(reachable!.y).toBeGreaterThanOrEqual(0);
        expect(reachable!.y + reachable!.height).toBeLessThanOrEqual(800);
        await unknown.click();
        await expect(page.getByRole('textbox', { name: 'Tu respuesta' })).toHaveValue('No lo se todavia.');
        await page.getByRole('button', { name: 'Enviar respuesta' }).click();
        await expect.poll(() => submitted.length).toBe(2);
        expect(submitted[1]?.matchedQuestionIds).toEqual(['question-1']);
      }
    });
  }

  test('Quick sin pregunta no inventa composer ni nota; Guided no hereda el límite Quick', async ({ page }) => {
    await openScene(page, session(0));
    await expect(page.getByTestId('portfolio-entry-inconsistent-state')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Tu respuesta' })).toHaveCount(0);
    await expect(page.getByText(/La aclaración inicial puede requerir/)).toHaveCount(0);

    await page.evaluate(() => sessionStorage.clear());
    await openScene(page, session(1, 'guided_exploration'));
    await expect(page.getByTestId('portfolio-entry-active-question')).toBeVisible();
    await expect(page.getByText(/La aclaración inicial puede requerir/)).toHaveCount(0);
  });

  test('la respuesta conserva el ID vigente y COP-09 conserva sus dos acciones', async ({ page }) => {
    const submitted = await openScene(page, session(3));
    await page.getByRole('button', { name: 'No lo se todavia' }).click();
    await expect(page.getByRole('textbox', { name: 'Tu respuesta' })).toHaveValue('No lo se todavia.');
    await page.getByText('Ver conversación').click();
    await expect(page.getByTestId('portfolio-entry-conversation-trace')).toContainText(entryText);
    await page.getByRole('textbox', { name: 'Tu respuesta' }).fill('Necesitamos confirmar la evidencia disponible.');
    await page.getByRole('button', { name: 'Enviar respuesta' }).click();
    await expect.poll(() => submitted.length).toBe(2);
    expect(submitted[1]?.matchedQuestionIds).toEqual(['question-3']);

    await page.evaluate(() => sessionStorage.clear());
    await openScene(page, session(0, 'quick_clarification', true));
    await expect(page.getByRole('button', { name: 'Ver mi propuesta de abordaje' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Seguir aterrizando mi necesidad' })).toBeVisible();
  });
});
