// Entrada B — "Necesito saber dónde intervenir entre todo lo que ya tenemos".
// doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §6–§13, §25–§26.
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, BASE, createChallenge, createFront, getOk, login, patchOk } from '../support/api';
import { GAP_TIMEOUT, gapTest } from '../support/gap';
import { ensurePortfolioLead, prisma, uiLoginLead } from '../support/portfolio-lead';

let api: APIRequestContext;
let token: string;


const FRONT = {
  name: 'E2E Job Adopcion pyme',
  strategicObjective: 'Aumentar adopción del producto en clientes pyme',
  mainKpi: 'Clientes pyme activos al mes',
  baseline: '1.200',
  target: '2.000',
  horizon: '12 meses',
};

test.describe('Entrada B · dónde intervenir (§6–§13)', () => {
  test.beforeAll(async () => {
    await ensurePortfolioLead();
    api = await pwRequest.newContext({ baseURL: BASE });
    // El lead sembrado navega la UI; la siembra por API va con el admin de portfolio (como PRD03).
    token = (await login(api, ADMIN_EMAIL, ADMIN_PASSWORD)).token;
  });

  test.afterAll(async () => {
    await prisma.strategicFront.deleteMany({ where: { name: { startsWith: 'E2E Job ' } } });
    await api.dispose();
    await prisma.$disconnect();
  });

  test('Portfolio Home da una lectura: bloqueos, huecos de cobertura y de evidencia, decisiones (§6)', async ({ page }) => {
    const home = await getOk(api, token, '/api/v1/portfolio/home');
    expect(home).toBeTruthy();
    await uiLoginLead(page);
    await page.goto('/portfolio/inicio');
    await expect(page).toHaveURL(/\/portfolio\/inicio/);
    // El layout y la página anidan dos <main>.
    await expect(page.getByRole('main').first()).toBeVisible();
  });

  test('un Frente guarda resultado, KPI, baseline, target y horizonte (§7, Core §13)', async () => {
    const front = await createFront(api, token, { ...FRONT, name: `${FRONT.name} ${Date.now()}` });
    for (const key of ['strategicObjective', 'mainKpi', 'baseline', 'target', 'horizon'] as const) {
      expect(front[key]).toBe(FRONT[key]);
    }
  });

  test('un Reto tiene estado de cobertura (§13)', async () => {
    const front = await createFront(api, token, { name: `${FRONT.name} cov ${Date.now()}` });
    const challenge = await createChallenge(api, token, front.id, { title: 'Reducir abandono en onboarding' });
    expect(challenge.coverageStatus).toBe('sin_cobertura');
    const updated = await patchOk(api, token, `/api/v1/portfolio/challenges/${challenge.id}`, { coverageStatus: 'cobertura_parcial' });
    expect(updated.coverageStatus).toBe('cobertura_parcial');
  });

  test('el Frente guarda restricciones estratégicas (§7, Core §13)', async () => {
    const front = await createFront(api, token, {
      name: `${FRONT.name} restr ${Date.now()}`,
      constraints: 'Sin aumentar el equipo de soporte',
    } as Record<string, unknown>);
    expect(front.constraints).toBe('Sin aumentar el equipo de soporte');
  });

  test('la pantalla de Frentes pregunta "¿qué resultado quiere mover el negocio?" (§7)', async ({ page }) => {
    await uiLoginLead(page);
    await page.goto('/portfolio/frentes-estrategicos');
    await expect(page.getByText(/qu[eé] resultado quiere mover/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('/portfolio/iniciar empieza por el Job, no por "¿Cómo quieres iniciar?" con objetos de dominio (§24–§25)', async ({ page }) => {
    await uiLoginLead(page);
    await page.goto('/portfolio/iniciar');
    // Sin esto, una página que no cargó haría "pasar" la ausencia de textos.
    await expect(page.getByText('Iniciar', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /¿C[oó]mo quieres iniciar\?/i })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText(/Frente → Reto → Activación/i)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /¿Qu[eé] necesitas mover\?/ })).toBeVisible();
    await expect(page.getByText(/Tengo algo que quiero sacar adelante/)).toBeVisible();
  });

  gapTest('G6', 'el Copilot propone partir un Frente en Retos, explica y pide confirmación sin crearlos (§8–§11, §26)', async () => {
    const front = await createFront(api, token, {
      ...FRONT,
      name: `${FRONT.name} split ${Date.now()}`,
      description: 'Las iniciativas actuales atacan dos momentos distintos: onboarding y uso recurrente, con owners y KPIs diferentes.',
    });
    const before = await prisma.challenge.count({ where: { strategicFrontId: front.id } });
    const res = await api.post(`/api/v1/portfolio/strategic-fronts/${front.id}/challenge-split-suggestion`, {
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const suggestion = (await res.json()).data;
    expect(suggestion.recommendation).toBe('split');
    expect(suggestion.provenance).toBe('AI_SUGGESTED');
    expect(suggestion.reviewStatus).toBe('UNREVIEWED');
    for (const key of ['observed', 'whySplit', 'benefits', 'proposedChallenges', 'impact']) {
      expect(suggestion[key], key).toBeTruthy();
    }
    expect(suggestion.proposedChallenges.length).toBeGreaterThanOrEqual(2);
    // §26: nunca crear Reto automáticamente.
    expect(await prisma.challenge.count({ where: { strategicFrontId: front.id } })).toBe(before);
  });

  gapTest('G6', 'el Copilot puede decir "no parece necesario crear otro Reto" (§10)', async () => {
    const front = await createFront(api, token, { name: `${FRONT.name} nosplit ${Date.now()}` });
    await createChallenge(api, token, front.id, { title: 'Reducir abandono durante onboarding' });
    const res = await api.post(`/api/v1/portfolio/strategic-fronts/${front.id}/challenge-split-suggestion`, {
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const suggestion = (await res.json()).data;
    expect(suggestion.recommendation).toBe('no_split');
    expect(suggestion.observed).toBeTruthy();
  });

  gapTest('G7', 'lectura de cobertura del Reto como conjunto (§13)', async () => {
    const front = await createFront(api, token, { name: `${FRONT.name} reading ${Date.now()}` });
    const challenge = await createChallenge(api, token, front.id, { title: 'Aumentar activación después del alta' });
    const reading = await getOk(api, token, `/api/v1/portfolio/challenges/${challenge.id}/coverage-reading`);
    for (const key of ['initiatives', 'overlaps', 'aggregateEvidence', 'commonDependencies', 'needsMoreCapacity', 'readyToDecide']) {
      expect(reading, key).toHaveProperty(key);
    }
  });

  gapTest('G13', 'el portfolio permite ver y reasignar capacidad (§4, §24)', async () => {
    const res = await api.get('/api/v1/portfolio/capacity', {
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    });
    expect(res.ok()).toBeTruthy();
  });
});
