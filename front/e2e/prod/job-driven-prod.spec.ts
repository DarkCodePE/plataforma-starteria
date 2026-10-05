// E2E Job-Driven contra un entorno real (producción) con usuario y organización dedicados.
// Runbook: docs/e2e-job-driven/prod-dedicated-user.md. Sólo API y navegador: nada de Prisma.
//
// Todo lo que crea lleva el prefijo [E2E-PROD] y queda en la organización org-e2e-prod, que desde
// fix/portfolio-org-scope no se ve desde otras organizaciones. Al final borra los frentes que creó
// (los retos caen en cascada) y archiva el proyecto; lo que no se puede borrar por API (Decision,
// PortfolioLearning) se limpia con `e2e-prod-tenant.ts cleanup`.
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { auth, browserLogin, getOk, login, patchOk, postOk, type Session } from '../support/api';

const BASE = process.env.E2E_PROD_BASE_URL;
const LEAD = { email: process.env.E2E_PROD_LEAD_EMAIL ?? 'e2e-lead@starteria.test', password: process.env.E2E_PROD_LEAD_PASSWORD ?? '' };
const PART = { email: process.env.E2E_PROD_PARTICIPANT_EMAIL ?? 'e2e-participante@starteria.test', password: process.env.E2E_PROD_PARTICIPANT_PASSWORD ?? '' };
const TAG = `[E2E-PROD] ${new Date().toISOString().slice(0, 16)}`;

test.skip(!BASE || !LEAD.password || !PART.password, 'Falta E2E_PROD_BASE_URL o las contraseñas del tenant de prueba.');
test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let lead: Session;
let part: Session;
const created = { fronts: [] as string[], projects: [] as string[] };

test.beforeAll(async () => {
  api = await pwRequest.newContext({ baseURL: BASE });
  lead = await login(api, LEAD.email, LEAD.password);
  part = await login(api, PART.email, PART.password);
});

test.afterAll(async () => {
  for (const id of created.projects) await api.delete(`/api/v1/projects/${id}`, { headers: auth(part.token), failOnStatusCode: false });
  for (const id of created.fronts) await api.delete(`/api/v1/portfolio/strategic-fronts/${id}`, { headers: auth(lead.token), failOnStatusCode: false });
  await api.dispose();
});

test('el frente de prueba queda en la organización de prueba (precondición de aislamiento)', async () => {
  const front = await postOk(api, lead.token, '/api/v1/portfolio/strategic-fronts', {
    name: `${TAG} Frente`,
    strategicObjective: 'Aumentar adopción del producto en clientes pyme',
    description: 'Las iniciativas atacan dos momentos distintos: onboarding y uso recurrente, con owners y KPIs diferentes.',
    constraints: 'Prueba automatizada: no usar como dato real',
  });
  created.fronts.push(front.id);
  expect(front.organizationId).toBe('org-e2e-prod');
});

test('el Copilot sugiere separar el frente y sólo crea el reto confirmado (§8–§11, §26)', async () => {
  const frontId = created.fronts[0];
  const suggestion = await postOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${frontId}/challenge-split-suggestion`, {});
  expect(suggestion).toMatchObject({ recommendation: 'split', provenance: 'AI_SUGGESTED', reviewStatus: 'UNREVIEWED' });
  const [first] = suggestion.proposedChallenges;
  const confirmed = await postOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${frontId}/challenge-split-suggestion/confirm`, {
    challenges: [{ title: `${TAG} ${first.title}`, whatWeWantToMove: first.whatWeWantToMove }],
  });
  expect(confirmed).toHaveLength(1);
});

test('el participante toma el reto, pasa por Mission Review y el lead queda con autoridad (§15, §18, §23)', async ({ page }) => {
  const challenges = await getOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${created.fronts[0]}/challenges`);
  const challenge = challenges[0];
  await patchOk(api, lead.token, `/api/v1/portfolio/challenges/${challenge.id}`, {
    knownFacts: 'Dato de prueba', constraints: 'Sin efectos reales', expectedDecision: 'Decisión de prueba',
  });
  const project = await postOk(api, part.token, '/api/v1/projects', { name: `${TAG} Iniciativa`, challengeId: challenge.id });
  created.projects.push(project.id);

  const governance = await getOk(api, lead.token, `/api/v1/portfolio/initiatives/${project.id}/governance`);
  expect(governance).toMatchObject({ mode: 'portfolio_governed', portfolioLeadUserId: lead.userId });

  await browserLogin(page, PART.email, PART.password);
  await page.goto(`/initiatives/${project.id}/overview`);
  await page.getByRole('button', { name: /Revisar mi misi[oó]n y empezar/i }).click();
  await expect(page.getByRole('heading', { name: /¿Qu[eé] estoy asumiendo exactamente\?/ })).toBeVisible();
  await expect(page.getByText('Sin efectos reales')).toBeVisible();
});

test('lecturas del portafolio sobre los datos de prueba (§13, §4/§24)', async () => {
  const challenges = await getOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${created.fronts[0]}/challenges`);
  const reading = await getOk(api, lead.token, `/api/v1/portfolio/challenges/${challenges[0].id}/coverage-reading`);
  expect(reading.hasWork).toBe(true);
  const capacity = await getOk(api, lead.token, '/api/v1/portfolio/capacity');
  expect(JSON.stringify(capacity)).toContain(TAG);
});

test('reconstrucción y modos del Copilot no escriben nada (§14, §20)', async () => {
  const res = await api.post('/api/v1/initiatives/reconstruction', {
    headers: auth(part.token),
    data: { name: `${TAG} Piloto`, summary: 'Piloto de prueba', evidence: [{ summary: 'Bajó 18%', classification: 'supports' }] },
  });
  expect(res.ok()).toBeTruthy();
  const orient = await getOk(api, part.token, `/api/v1/projects/${created.projects[0]}/copilot-mode/orient`);
  expect(orient.answer).toMatch(/^Estás en el Step/);
});
