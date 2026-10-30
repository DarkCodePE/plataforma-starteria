import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import axe from 'axe-core';

const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:4110/api/v1';
const upstreamAi = 'http://127.0.0.1:8004';
const proxyPort = 8005;
const projectId = 'steps-ux03-continuous';
const email = 'mvp-chat01.owner@starteria.test';
const password = 'demo123';
const artifactsRoot = path.resolve(process.cwd(), '../artifacts/steps-ux03b');
const screenshotRoot = path.join(artifactsRoot, 'screenshots', 'hva-chatfix-01');
const evidenceFile = path.join(artifactsRoot, 'UX03B_CHATFIX_BROWSER_EVIDENCE.json');
const prisma = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });

let proxy: Server;
let failRemaining = 0;
let delayNextMs = 0;

const messages = [
  'Quiero diseñar una prueba acotada para reducir el retrabajo del equipo.',
  'El supuesto principal es que el retrabajo nace en criterios de entrada ambiguos.',
  'También debemos comprobar si la causa real es la falta de capacidad y no la ambigüedad.',
  'Alternativa uno: checklist manual antes de empezar cada tarea.',
  'Alternativa dos: revisión por pares de una muestra pequeña.',
  'Mediremos porcentaje de tareas reabiertas y tiempo medio de corrección.',
  'La restricción es no usar datos personales ni cambiar producción.',
  'El piloto debe durar dos semanas y poder detenerse sin coste material.',
  'Riesgo: que el equipo cambie su conducta sólo por sentirse observado.',
  'Compararemos con una línea base sintética y registraremos excepciones.',
  'El criterio go será una reducción consistente sin aumentar el tiempo de ciclo.',
  'Resume los supuestos, alternativas, métricas, restricciones y riesgos pendientes.',
] as const;

async function login(page: Page) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const responsePromise = page.waitForResponse(response => response.url().includes('/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  await expect(page).not.toHaveURL(/\/auth/);
  return body.data.accessToken as string;
}

async function getCore(page: Page, accessToken: string) {
  const response = await page.request.get(`${apiBase}/projects/${projectId}/adaptive-core`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data as any;
}

async function getSession(page: Page, accessToken: string) {
  const response = await page.request.get(`${apiBase}/projects/${projectId}/steps/2/copilot/session`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data as any;
}

async function historyMetrics(page: Page) {
  return page.getByRole('log', { name: 'Historial de conversación' }).evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    maxScrollTop: element.scrollHeight - element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
}

async function canonicalDatabaseState() {
  const [cycle, checkpoint, project, steps, responses, outputs, truthClaims, truthValidations, progressSignals] = await Promise.all([
    prisma.initiativeCycle.findFirst({ where: { projectId }, orderBy: { cycleNumber: 'desc' } }),
    prisma.adaptiveCheckpointInstance.findFirst({ where: { projectId, status: 'in_progress' } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { currentStep: true, step0Status: true, status: true } }),
    prisma.step.findMany({ where: { projectId }, orderBy: { number: 'asc' }, select: { number: true, status: true, progress: true } }),
    prisma.adaptiveCheckpointResponse.count({ where: { projectId } }),
    prisma.adaptiveStepOutput.count({ where: { projectId } }),
    prisma.truthClaim.count({ where: { projectId } }),
    prisma.truthValidation.count({ where: { projectId } }),
    prisma.adaptiveProgressSignal.count({ where: { projectId } }),
  ]);
  return { cycle, checkpoint, project, steps, responses, outputs, truthClaims, truthValidations, progressSignals };
}

async function axeViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const result = await (window as any).axe.run(document.querySelector('main') ?? document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map((item: any) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
  });
}

test.beforeAll(async () => {
  proxy = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (delayNextMs > 0) {
      const delay = delayNextMs;
      delayNextMs = 0;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    if (failRemaining > 0) {
      failRemaining -= 1;
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ detail: { code: 'QA_INJECTED_FAILURE', message: 'Fallo sintético descartable.' } }));
      return;
    }
    const headers = new Headers();
    Object.entries(request.headers).forEach(([name, value]) => {
      if (value != null && name !== 'host' && name !== 'content-length') headers.set(name, Array.isArray(value) ? value.join(',') : value);
    });
    const upstream = await fetch(`${upstreamAi}${request.url}`, {
      method: request.method,
      headers,
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    });
    response.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
    response.end(Buffer.from(await upstream.arrayBuffer()));
  });
  await new Promise<void>((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(proxyPort, '127.0.0.1', () => resolve());
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
  await new Promise<void>(resolve => proxy.close(() => resolve()));
});

test('UX03B-CHATFIX-01 — conversación larga, scroll condicionado y alturas responsive', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(screenshotRoot, { recursive: true });
  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText}`));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.setViewportSize({ width: 1440, height: 900 });
  let accessToken = await login(page);
  const canonicalBeforeApi = await getCore(page, accessToken);
  const canonicalBeforeDb = await canonicalDatabaseState();
  await page.goto(`/projects/${projectId}/step/2`);
  const history = page.getByRole('log', { name: 'Historial de conversación' });
  await expect(history).toBeVisible();

  let olderPosition: { before: Awaited<ReturnType<typeof historyMetrics>>; after: Awaited<ReturnType<typeof historyMetrics>> } | undefined;
  let bottomFollow: { before: Awaited<ReturnType<typeof historyMetrics>>; after: Awaited<ReturnType<typeof historyMetrics>> } | undefined;
  let retryObserved = false;

  for (let index = 0; index < messages.length; index += 1) {
    const ordinal = index + 1;
    if (ordinal === 10) {
      await history.evaluate(element => {
        element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) * 0.25);
        element.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      olderPosition = { before: await historyMetrics(page), after: await historyMetrics(page) };
    }
    if (ordinal === 12) {
      await history.evaluate(element => {
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      bottomFollow = { before: await historyMetrics(page), after: await historyMetrics(page) };
    }

    await page.getByRole('textbox').fill(messages[index]);
    if (ordinal === 1) delayNextMs = 450;
    if (ordinal === 6) failRemaining = 1;
    const turnResponse = page.waitForResponse(response => response.url().includes('/copilot/turn') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    if (ordinal === 1) await expect(history.getByText(/Preparando una respuesta/)).toBeVisible();
    const response = await turnResponse;
    expect([200, 201]).toContain(response.status());

    if (ordinal === 6) {
      const retry = page.getByRole('button', { name: 'Reintentar mensaje' });
      await expect(retry).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: path.join(screenshotRoot, 'fallback-reintento-1440x900.png'), fullPage: true });
      const retryResponse = page.waitForResponse(item => item.url().includes('/copilot/turn') && item.request().method() === 'POST');
      await retry.click();
      expect([200, 201]).toContain((await retryResponse).status());
      await expect(retry).toHaveCount(0);
      retryObserved = true;
    }

    await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeVisible();
    await expect(history.getByText(messages[index], { exact: true })).toHaveCount(1);

    if (ordinal === 10 && olderPosition) {
      olderPosition.after = await historyMetrics(page);
      const latestButton = page.getByRole('button', { name: 'Ir al mensaje más reciente' });
      await expect(latestButton).toBeVisible();
      expect(Math.abs(olderPosition.after.scrollTop - olderPosition.before.scrollTop)).toBeLessThanOrEqual(2);
      await latestButton.focus();
      await page.keyboard.press('Enter');
      await expect(latestButton).toHaveCount(0);
      const returned = await historyMetrics(page);
      expect(Math.abs(returned.scrollTop - returned.maxScrollTop)).toBeLessThanOrEqual(2);
    }
    if (ordinal === 12 && bottomFollow) {
      bottomFollow.after = await historyMetrics(page);
      expect(Math.abs(bottomFollow.after.scrollTop - bottomFollow.after.maxScrollTop)).toBeLessThanOrEqual(2);
      await expect(page.getByRole('button', { name: 'Ir al mensaje más reciente' })).toHaveCount(0);
    }
    if ([1, 6, 12].includes(ordinal)) {
      await page.screenshot({ path: path.join(screenshotRoot, `conversacion-${String(ordinal).padStart(2, '0')}-1440x900.png`), fullPage: true });
    }
  }

  const sessionAfterConversation = await getSession(page, accessToken);
  expect(sessionAfterConversation.turns).toHaveLength(12);
  expect(new Set(sessionAfterConversation.turns.map((turn: any) => turn.clientTurnId)).size).toBe(12);
  expect(sessionAfterConversation.turns.every((turn: any) => turn.status === 'SUCCEEDED')).toBe(true);
  expect(sessionAfterConversation.turns.map((turn: any) => turn.inputText)).toEqual(messages);

  await page.reload();
  await expect(history.getByText(messages[11], { exact: true })).toHaveCount(1);
  const sessionAfterReload = await getSession(page, accessToken);
  expect(sessionAfterReload.turns).toHaveLength(12);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/auth/);
  accessToken = await login(page);
  await page.goto(`/projects/${projectId}/step/2`);
  await expect(page.getByRole('log', { name: 'Historial de conversación' }).getByText(messages[11], { exact: true })).toHaveCount(1);
  const sessionAfterRelogin = await getSession(page, accessToken);
  expect(sessionAfterRelogin.turns).toHaveLength(12);

  const responsive: Array<Record<string, unknown>> = [];
  for (const viewport of [
    { width: 1440, height: 900, minimum: 320 },
    { width: 768, height: 1024, minimum: 320 },
    { width: 390, height: 844, minimum: 240 },
    { width: 360, height: 800, minimum: 240 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/projects/${projectId}/step/2`);
    const viewportHistory = page.getByRole('log', { name: 'Historial de conversación' });
    await expect(viewportHistory).toBeVisible();
    const metrics = await historyMetrics(page);
    expect(metrics.clientHeight).toBeGreaterThanOrEqual(viewport.minimum);
    const overflow = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    await viewportHistory.focus();
    await expect(viewportHistory).toBeFocused();
    const axeResults = await axeViolations(page);
    expect(axeResults).toEqual([]);

    let composer: Record<string, unknown> | undefined;
    if (viewport.width <= 390) {
      const shortcut = page.getByRole('button', { name: 'Escribir a Startería' });
      await shortcut.click();
      const textbox = page.getByRole('textbox');
      await expect(textbox).toBeFocused();
      await expect(page.getByLabel('Preguntas sugeridas para el Copilot')).toBeVisible();
      await page.waitForTimeout(700);
      const textareaBox = await textbox.boundingBox();
      const sendButton = page.getByRole('button', { name: 'Enviar mensaje' });
      let sendBox = await sendButton.boundingBox();
      let additionalScroll = 0;
      if (sendBox && sendBox.y + sendBox.height > viewport.height) {
        additionalScroll = Math.ceil(sendBox.y + sendBox.height - viewport.height + 12);
        await page.mouse.wheel(0, additionalScroll);
        await page.waitForTimeout(150);
        sendBox = await sendButton.boundingBox();
      }
      expect(textareaBox).not.toBeNull();
      expect(sendBox).not.toBeNull();
      expect(sendBox!.y).toBeGreaterThanOrEqual(0);
      expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(viewport.height);
      const hitTarget = await page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return { tag: element?.tagName, text: element?.textContent?.trim() };
      }, { x: sendBox!.x + sendBox!.width / 2, y: sendBox!.y + sendBox!.height / 2 });
      expect(hitTarget.tag).toBe('BUTTON');

      const documentScrollBefore = await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
      const historyBeforeWheel = await historyMetrics(page);
      await viewportHistory.hover();
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(100);
      const documentScrollAfter = await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
      const historyAfterWheel = await historyMetrics(page);
      expect(documentScrollAfter).toBe(documentScrollBefore);
      expect(historyAfterWheel.scrollTop).toBeLessThan(historyBeforeWheel.scrollTop);
      composer = {
        textareaBox,
        sendBox,
        shortcutVisible: await shortcut.isVisible(),
        additionalScroll,
        hitTarget,
        independentHistoryScroll: {
          documentScrollBefore,
          documentScrollAfter,
          historyBefore: historyBeforeWheel.scrollTop,
          historyAfter: historyAfterWheel.scrollTop,
        },
      };
      await page.screenshot({ path: path.join(screenshotRoot, `compositor-enfocado-${viewport.width}x${viewport.height}.png`), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(screenshotRoot, `historial-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }
    responsive.push({ viewport: { width: viewport.width, height: viewport.height }, metrics, overflow, axeResults, composer });
  }

  const canonicalAfterApi = await getCore(page, accessToken);
  const canonicalAfterDb = await canonicalDatabaseState();
  expect(canonicalAfterApi.cycle).toEqual(canonicalBeforeApi.cycle);
  expect(canonicalAfterApi.activeCheckpoint).toEqual(canonicalBeforeApi.activeCheckpoint);
  expect(canonicalAfterApi.stepOutputs).toEqual(canonicalBeforeApi.stepOutputs);
  expect(canonicalAfterApi.progressSignal).toEqual(canonicalBeforeApi.progressSignal);
  expect(canonicalAfterDb).toEqual(canonicalBeforeDb);
  expect(retryObserved).toBe(true);
  expect(failedRequests).toEqual([]);

  writeFileSync(evidenceFile, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    state: 'UX03B_CHATFIX_TECH_PASS / HVA_PENDING / LIVE_LLM_PENDING',
    environment: {
      frontend: process.env.E2E_BASE_URL,
      backend: apiBase,
      database: '127.0.0.1:55433/starteria_e2e descartable; migraciones 1-67; migración 68 ausente',
      ai: 'stub determinista QA por proxy descartable de fallo controlado',
    },
    conversation: {
      sent: 12,
      recovered: sessionAfterConversation.turns.length,
      uniqueClientTurnIds: new Set(sessionAfterConversation.turns.map((turn: any) => turn.clientTurnId)).size,
      retryObserved,
      afterReload: sessionAfterReload.turns.length,
      afterRelogin: sessionAfterRelogin.turns.length,
    },
    scroll: { olderPosition, bottomFollow },
    responsive,
    canonicalBefore: canonicalBeforeDb,
    canonicalAfter: canonicalAfterDb,
    failedRequests,
    consoleErrors,
    realMobileKeyboard: 'REAL_MOBILE_KEYBOARD_NOT_RUN',
    caveat: 'La emulación de viewport Playwright no sustituye el teclado virtual real de Android o iOS.',
  }, null, 2)}\n`, 'utf8');
});
