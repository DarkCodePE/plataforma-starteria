import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123';
const ARTIFACTS = path.resolve(process.cwd(), '../artifacts/steps-ux02a');

type Viewport = { width: number; height: number };

async function loginApi(api: APIRequestContext) {
  const response = await api.post('/api/v1/auth/login', { data: { email: EMAIL, password: PASSWORD }, failOnStatusCode: false });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  return { token: body.data.accessToken as string, userId: body.data.user.id as string };
}

async function createProject(api: APIRequestContext, token: string): Promise<string> {
  const response = await api.post('/api/v1/projects', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: `UX-02A Synthetic ${Date.now()}`,
      description: 'Contexto sintético autorizado: reducir el retrabajo entre ventas y operaciones.',
    },
    failOnStatusCode: false,
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data.id;
}

async function loginUi(page: Page) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page).toHaveURL(/\/(dashboard|projects|portfolio|app)/i);
}

async function openStepReasoning(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/step/0`);
  await expect(page.getByRole('heading', { name: 'Aclara el trabajo conversando' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Punto de partida autorizado')).toBeVisible();
  await expect(page.getByText('Qué cambia cada acción')).toBeVisible();
  await expect(page.getByText(/Revisión canónica · separada del chat/i)).toBeVisible();
}

async function send(page: Page, message: string) {
  await page.getByLabel(/Cuéntale a Starteria/i).fill(message);
  await page.getByRole('button', { name: /^Enviar mensaje$/ }).click();
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByText(/Respuesta no generada · puedes reintentar/i).last()).toBeVisible({ timeout: 15_000 });
}

async function createAuthenticatedContext(browser: Browser, storageState: Awaited<ReturnType<BrowserContext['storageState']>>, viewport: Viewport) {
  return browser.newContext({ storageState, viewport, deviceScaleFactor: 1 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function accessibilitySmoke(page: Page) {
  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="step-reasoning-panel"]');
    if (!panel) return { missingPanel: true, duplicateIds: [], unnamedButtons: [], unlabeledFields: [] };
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map(element => element.id).filter(Boolean);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const unnamedButtons = [...panel.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => !(button.getAttribute('aria-label') || button.title || button.textContent?.trim()))
      .map(button => button.outerHTML.slice(0, 120));
    const unlabeledFields = [...panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')]
      .filter(field => {
        const id = field.id;
        return !(field.getAttribute('aria-label') || field.getAttribute('aria-labelledby') || field.closest('label') || (id && document.querySelector(`label[for="${id}"]`)));
      })
      .map(field => field.outerHTML.slice(0, 120));
    return { missingPanel: false, duplicateIds: [...new Set(duplicateIds)], unnamedButtons, unlabeledFields };
  });
  expect(result).toEqual({ missingPanel: false, duplicateIds: [], unnamedButtons: [], unlabeledFields: [] });
}

test('UX-02A: mission-first hierarchy, distinct actions and responsive composer', async ({ page, request, browser }) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  const criticalConsoleErrors: string[] = [];
  const recoverableAuthWarnings: string[] = [];
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (message.text().includes('401 (Unauthorized)')) {
      recoverableAuthWarnings.push(message.text());
      return;
    }
    criticalConsoleErrors.push(message.text());
  });

  const session = await loginApi(request);
  expect(session.userId).toBe(process.env.STEP_REASONING_QA_USER_ID);
  const projectId = await createProject(request, session.token);

  await loginUi(page);
  await openStepReasoning(page, projectId);
  await expect(page.getByTestId('step-reasoning-panel').getByText(/UX-02A Synthetic/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Enviar mensaje$/ })).toBeVisible();
  await expect(page.getByText('Revisión del checkpoint')).toBeVisible();
  await expect(page.getByRole('button', { name: /Revisar pregunta pendiente/i })).toBeVisible();

  await send(page, 'Sabemos que existe retrabajo entre operaciones y ventas.');
  await send(page, 'Todavía no sabemos en qué parte del proceso comienza.');
  await send(page, 'No lo sé aún; necesitamos una señal observable.');

  const panel = page.getByTestId('step-reasoning-panel');
  await expect(panel.getByText(/LLM no disponible/i)).toHaveCount(0);
  await expect(panel.getByText(/CP-0\.1/i)).toHaveCount(0);
  await expect(page.getByText(/0\/3 checkpoints revisados/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText('Sabemos que existe retrabajo entre operaciones y ventas.')).toBeVisible();
  await expect(page.getByText('No lo sé aún; necesitamos una señal observable.')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await accessibilitySmoke(page);
  await page.screenshot({ path: path.join(ARTIFACTS, 'ux02a-desktop-1440x900.png') });
  await panel.screenshot({ path: path.join(ARTIFACTS, 'ux02a-desktop-panel-1440.png') });

  const storageState = await page.context().storageState();

  const tabletContext = await createAuthenticatedContext(browser, storageState, { width: 768, height: 1024 });
  const tablet = await tabletContext.newPage();
  await openStepReasoning(tablet, projectId);
  await expectNoHorizontalOverflow(tablet);
  await tablet.screenshot({ path: path.join(ARTIFACTS, 'ux02a-tablet-768x1024.png') });
  const mobileStorageState = await tabletContext.storageState();
  await tabletContext.close();

  const mobileContext = await createAuthenticatedContext(browser, mobileStorageState, { width: 390, height: 844 });
  const mobile = await mobileContext.newPage();
  await openStepReasoning(mobile, projectId);
  await expectNoHorizontalOverflow(mobile);
  await accessibilitySmoke(mobile);
  await mobile.screenshot({ path: path.join(ARTIFACTS, 'ux02a-mobile-top-390x844.png') });

  const mobileInput = mobile.getByLabel(/Cuéntale a Starteria/i);
  await mobileInput.scrollIntoViewIfNeeded();
  await mobileInput.fill('Dato sintético preparado para continuar la conversación.');
  await mobileInput.focus();
  await expect(mobileInput).toBeFocused();
  await mobile.keyboard.press('Tab');
  await expect(mobile.getByRole('button', { name: /^Enviar mensaje$/ })).toBeFocused();

  const composerBox = await mobile.getByTestId('step-reasoning-composer').boundingBox();
  const actionBarBox = await mobile.getByTestId('step0-canonical-action-bar').boundingBox();
  expect(composerBox).not.toBeNull();
  expect(actionBarBox).not.toBeNull();
  expect((composerBox?.y ?? 0) + (composerBox?.height ?? 0)).toBeLessThanOrEqual((actionBarBox?.y ?? 0) + 1);
  await mobile.screenshot({ path: path.join(ARTIFACTS, 'ux02a-mobile-composer-390x844.png') });
  await mobileContext.close();

  expect(criticalConsoleErrors).toEqual([]);
  expect(recoverableAuthWarnings.length).toBeLessThanOrEqual(1);
});
