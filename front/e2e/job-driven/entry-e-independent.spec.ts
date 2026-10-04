// Entrada E — "Tengo algo que quiero sacar adelante": iniciativa independiente.
// doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §16, §20.
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { BASE, browserLogin, createCompany, createFromInitialReview, getOk, registerAndLogin } from '../support/api';
import { GAP_TIMEOUT, gapTest } from '../support/gap';

let api: APIRequestContext;

test.describe('Entrada E · iniciativa independiente (§16)', () => {
  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('se puede crear una iniciativa sin inventar Frente ni Reto (§16)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'e-indep');
    const projectId = await createFromInitialReview(api, owner.token, 'Quiero crear una herramienta para que mi equipo cotice mas rapido.');
    const project = await getOk(api, owner.token, `/api/v1/projects/${projectId}`);
    expect(project.challengeId ?? null).toBeNull();
    await browserLogin(page, owner.email, owner.password);
    await page.goto(`/initiatives/${projectId}/overview`);
    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByText(/Frente estrat[eé]gico obligatorio|Debes elegir un reto/i)).toHaveCount(0);
  });

  test('la iniciativa independiente construye un Contexto de Aplicación (§16)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'e-appctx');
    const company = await createCompany(api, owner.token, 'Empresa E2E Job E');
    const projectId = await createFromInitialReview(api, owner.token, 'Quiero automatizar cotizaciones en mi empresa.', { companyId: company.id });
    const review = await getOk(api, owner.token, `/api/v1/projects/${projectId}/mission-review`);
    expect(review.independent).toBe(true);
    expect(review.applicationContext).toMatchObject({ companyName: 'Empresa E2E Job E' });

    await browserLogin(page, owner.email, owner.password);
    await page.goto(`/initiatives/${projectId}/overview`);
    await expect(page.getByRole('region', { name: 'Contexto de aplicación' })).toContainText('Empresa E2E Job E');
    await page.goto(`/initiatives/${projectId}/mission`);
    await expect(page.getByRole('region', { name: 'Contexto de aplicación' })).toContainText('Empresa E2E Job E');
  });

  test('el Copilot ofrece Orientarme / Trabajar conmigo / Desbloquearme (§20)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'e-copilot');
    const projectId = await createFromInitialReview(api, owner.token, 'Quiero validar si un bot reduce consultas repetidas.');
    // La misma respuesta por API que en la UI: la lógica vive en el backend (§20, consistente entre canales).
    const orient = await getOk(api, owner.token, `/api/v1/projects/${projectId}/copilot-mode/orient`);
    expect(orient.answer).toMatch(/^Estás en el Step \d: ¿/);
    await browserLogin(page, owner.email, owner.password);
    await page.goto(`/projects/${projectId}`);
    for (const mode of [/Orientarme/i, /Trabajar conmigo/i, /Desbloquearme/i]) {
      await expect(page.getByRole('button', { name: mode }).first()).toBeVisible({ timeout: 15_000 });
    }
    await page.getByRole('button', { name: /Orientarme/ }).click();
    await expect(page.getByTestId('copilot-mode-response')).toContainText(orient.answer);
  });
});
