import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { devices, expect, test, type APIRequestContext, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123';
const ARTIFACTS = path.resolve(process.cwd(), '../artifacts/steps-ux02a/regression-ai02');

async function loginApi(api: APIRequestContext) {
  const response = await api.post('/api/v1/auth/login', { data: { email: EMAIL, password: PASSWORD }, failOnStatusCode: false });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  return { token: body.data.accessToken as string, userId: body.data.user.id as string };
}

async function createProject(api: APIRequestContext, token: string): Promise<string> {
  const response = await api.post('/api/v1/projects', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `AI Step 0 Synthetic ${Date.now()}`, description: 'Caso sintético: retrabajo entre operaciones y ventas.' },
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
}

async function send(page: Page, message: string) {
  await page.getByLabel(/Cuéntale a Starteria/i).fill(message);
  await page.getByRole('button', { name: /^Enviar mensaje$/ }).click();
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByText(/Respuesta no generada · puedes reintentar/i).last()).toBeVisible({ timeout: 15_000 });
}

test('Step 0 reasoning QA: three durable turns, explicit fallback, desktop and Pixel 5', async ({ page, request, browser }) => {
  mkdirSync(ARTIFACTS, { recursive: true });
  const session = await loginApi(request);
  expect(session.userId).toBe(process.env.STEP_REASONING_QA_USER_ID);
  const projectId = await createProject(request, session.token);

  await loginUi(page);
  await openStepReasoning(page, projectId);
  await send(page, 'Sabemos que existe retrabajo entre operaciones y ventas.');
  await send(page, 'Todavía no sabemos en qué parte del proceso comienza.');
  await send(page, 'No lo sé aún; propón una señal concreta que podamos observar.');
  await expect(page.getByText(/no confirma checkpoints ni cambia el progreso/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText('Sabemos que existe retrabajo entre operaciones y ventas.')).toBeVisible();
  await expect(page.getByText('No lo sé aún; propón una señal concreta que podamos observar.')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'step0-reasoning-desktop.png'), fullPage: true });

  const storageState = await page.context().storageState();
  const mobileContext = await browser.newContext({ ...devices['Pixel 5'], storageState });
  const mobile = await mobileContext.newPage();
  await openStepReasoning(mobile, projectId);
  await expect(mobile.getByRole('textbox', { name: /Cuéntale a Starteria/i })).toBeVisible();
  const mobilePanel = mobile.locator('section[aria-labelledby="step-reasoning-title"]');
  await mobilePanel.scrollIntoViewIfNeeded();
  await mobilePanel.screenshot({ path: path.join(ARTIFACTS, 'step0-reasoning-pixel5.png') });
  const mobileInput = mobilePanel.getByRole('textbox');
  await mobileInput.scrollIntoViewIfNeeded();
  await mobileInput.fill('Dato sintético preparado para el siguiente turno.');
  await expect(mobileInput).toHaveValue('Dato sintético preparado para el siguiente turno.');
  await mobile.screenshot({ path: path.join(ARTIFACTS, 'step0-reasoning-pixel5-input.png') });
  await mobileContext.close();
});
