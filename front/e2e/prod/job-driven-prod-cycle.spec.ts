// Recorrido completo Portfolio Lead + participante en producción, con el tenant dedicado
// (docs/e2e-job-driven/prod-dedicated-user.md): Frente → Copilot separa → Reto con envelope →
// iniciativa del participante → Mission Review → Steps 0–4 → Decision Package → decisión del
// Portfolio Lead → la decisión vuelve al portafolio (cobertura, siguiente acción, aprendizaje).
// doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §7–§13, §15, §17–§23.
//
// A diferencia de job-driven-prod.spec.ts, NO limpia al terminar: deja el recorrido a la vista
// del lead de prueba. Decision y PortfolioLearning no se borran por API; se borran en cascada con
// `gh workflow run e2e-prod-tenant.yml -f command=cleanup -f apply=true`.
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { browserLogin, getOk, login, patchOk, postOk, type Session } from '../support/api';
import { completeStep0, completeStep1, completeStep2, completeStep3, completeStep4, confirmStep2, confirmStep3, confirmStep4 } from '../support/steps';

const BASE = process.env.E2E_PROD_BASE_URL;
const LEAD = { email: process.env.E2E_PROD_LEAD_EMAIL ?? 'e2e-lead@starteria.test', password: process.env.E2E_PROD_LEAD_PASSWORD ?? '' };
const PART = { email: process.env.E2E_PROD_PARTICIPANT_EMAIL ?? 'e2e-participante@starteria.test', password: process.env.E2E_PROD_PARTICIPANT_PASSWORD ?? '' };
const TAG = `[E2E-PROD] ${new Date().toISOString().slice(0, 16)}`;

test.skip(!BASE || !LEAD.password || !PART.password, 'Falta E2E_PROD_BASE_URL o las contraseñas del tenant de prueba.');
test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let lead: Session;
let part: Session;
const ctx = { frontId: '', challengeId: '', projectId: '' };

test.beforeAll(async () => {
  api = await pwRequest.newContext({ baseURL: BASE });
  lead = await login(api, LEAD.email, LEAD.password);
  part = await login(api, PART.email, PART.password);
});

test.afterAll(async () => {
  // Sin limpieza a propósito (ver cabecera). Deja los ids en el reporte.
  console.log(`[E2E-PROD] recorrido: frente=${ctx.frontId} reto=${ctx.challengeId} iniciativa=${ctx.projectId}`);
  await api.dispose();
});

test('Portfolio Lead: frente con restricciones en la organización de prueba (§7)', async () => {
  const front = await postOk(api, lead.token, '/api/v1/portfolio/strategic-fronts', {
    name: `${TAG} Frente`,
    strategicObjective: 'Reducir el costo de atención sin deteriorar calidad',
    description: 'Las iniciativas atacan dos momentos distintos: onboarding y uso recurrente, con owners y KPIs diferentes.',
    constraints: 'Prueba automatizada: no usar como dato real',
  });
  ctx.frontId = front.id;
  expect(front.organizationId).toBe('org-e2e-prod');
});

test('Portfolio Lead: el Copilot sugiere separar y sólo se crea el reto confirmado (§8–§11, §26)', async () => {
  const suggestion = await postOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${ctx.frontId}/challenge-split-suggestion`, {});
  expect(suggestion).toMatchObject({ recommendation: 'split', provenance: 'AI_SUGGESTED', reviewStatus: 'UNREVIEWED' });
  const [first] = suggestion.proposedChallenges;
  const confirmed = await postOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${ctx.frontId}/challenge-split-suggestion/confirm`, {
    challenges: [{ title: `${TAG} ${first.title}`, whatWeWantToMove: 'Bajar el costo por solicitud de 14.20 a 10.00' }],
  });
  expect(confirmed).toHaveLength(1);
  ctx.challengeId = confirmed[0].id;
});

test('Portfolio Lead: el reto lleva qué se sabe, qué está abierto, restricciones y decisión esperada (§15, Core §14.1)', async () => {
  await patchOk(api, lead.token, `/api/v1/portfolio/challenges/${ctx.challengeId}`, {
    whyNow: 'El presupuesto del año siguiente depende de esta mejora',
    successCriteria: 'Costo por solicitud bajo 12.00 en el piloto',
    knownFacts: 'El 40% de las solicitudes son repetidas',
    openQuestions: 'No sabemos si el canal digital reduce costo',
    constraints: 'Sin tocar el contrato con el proveedor actual',
    dependencies: 'Integración con el CRM',
    expectedDecision: 'Escalar o no el autoservicio a todas las sucursales',
  });
  const challenges = await getOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${ctx.frontId}/challenges`);
  expect(challenges.find((c: { id: string }) => c.id === ctx.challengeId)).toMatchObject({ constraints: 'Sin tocar el contrato con el proveedor actual' });
});

test('Participante: crea la iniciativa del reto y el lead queda con la autoridad de decisión (§15, §23)', async () => {
  const project = await postOk(api, part.token, '/api/v1/projects', { name: `${TAG} Iniciativa`, challengeId: ctx.challengeId });
  ctx.projectId = project.id;
  const governance = await getOk(api, lead.token, `/api/v1/portfolio/initiatives/${ctx.projectId}/governance`);
  expect(governance).toMatchObject({ mode: 'portfolio_governed', portfolioLeadUserId: lead.userId });
});

test('Participante: Mission Review hereda el reto y recién desde ahí abre Step 0 (§17–§18)', async ({ page }) => {
  await browserLogin(page, PART.email, PART.password);
  await page.goto(`/initiatives/${ctx.projectId}/overview`);
  await page.getByRole('button', { name: /Revisar mi misi[oó]n y empezar/i }).click();
  await expect(page).toHaveURL(/\/initiatives\/[^/]+\/mission/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /¿Qu[eé] estoy asumiendo exactamente\?/ })).toBeVisible();
  for (const inherited of ['Bajar el costo por solicitud de 14.20 a 10.00', 'Sin tocar el contrato con el proveedor actual', 'Integración con el CRM', 'Escalar o no el autoservicio a todas las sucursales']) {
    await expect(page.getByText(inherited).first()).toBeVisible();
  }
  await page.getByRole('button', { name: /Asumir y empezar Step 0/ }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/step\/0/, { timeout: 20_000 });
});

test('Participante: los Steps se presentan como preguntas de progreso (§19)', async ({ page }) => {
  await browserLogin(page, PART.email, PART.password);
  await page.goto(`/projects/${ctx.projectId}`);
  for (const question of [/¿Qu[eé] es razonable intentar ahora\?/i, /¿Qu[eé] sabemos realmente\?/i, /¿Qu[eé] podemos poner frente a la realidad/i, /¿Qu[eé] ocurri[oó] realmente\?/i, /¿Qu[eé] decisi[oó]n est[aá] suficientemente sustentada\?/i]) {
    await expect(page.getByText(question).first()).toBeVisible({ timeout: 20_000 });
  }
});

test('Participante: Steps 0–4 convergen en un Decision Package y la iniciativa queda presentada (§19–§21)', async () => {
  test.setTimeout(180_000);
  const suffix = `prod-${Date.now()}`;
  await completeStep0(api, part.token, ctx.projectId);
  await completeStep1(api, part.token, ctx.projectId);
  const step2 = await completeStep2(api, part.token, ctx.projectId);
  await confirmStep2(api, part.token, ctx.projectId, step2.output);
  const step3 = await completeStep3(api, part.token, ctx.projectId, { decision: 'scale_pilot', suffix });
  await confirmStep3(api, part.token, ctx.projectId, step3.output);
  const step4 = await completeStep4(api, part.token, ctx.projectId, { finalState: 'scaled', suffix, receiverOwner: 'Owner receptor de operaciones' });
  await confirmStep4(api, part.token, ctx.projectId, step4.output, `${suffix}-final`);

  expect(step4.output.decisionPackage).toBeTruthy();
  expect(step4.output.alternatives.length).toBeGreaterThan(0);
  expect(step4.output.sustainableClaims.length).toBeGreaterThan(0);
  // Ligada a un Reto: el owner no cierra, presenta. La decisión es del Portfolio Lead (§23).
  const state = await getOk(api, part.token, `/api/v1/projects/${ctx.projectId}/adaptive-core`);
  expect(state.progressSignal.finalState).toBe('presented');
  const meta = await getOk(api, lead.token, `/api/v1/portfolio/initiatives/${ctx.projectId}/meta`);
  expect(meta.progressSignal.challengeCoverage.status).toBe('ready_for_decision');
});

test('Portfolio Lead: decide y la decisión vuelve al reto, al frente y al portafolio (§22–§23, Core §30)', async ({ page }) => {
  const request = await postOk(api, part.token, `/api/v1/projects/${ctx.projectId}/adaptive-core/decision-requests`, { idempotencyKey: `${ctx.projectId}-request` });
  const readiness = await getOk(api, lead.token, `/api/v1/projects/${ctx.projectId}/adaptive-core/decision-readiness?decisionType=continue_experimenting`);
  const decision = await postOk(api, lead.token, `/api/v1/projects/${ctx.projectId}/adaptive-core/decision-requests/${request.id}/decide`, {
    idempotencyKey: `${ctx.projectId}-decide`,
    outcome: 'continue_experimenting',
    rationale: 'Queda una pregunta de aprendizaje: si el ahorro se sostiene en sucursales grandes.',
    acceptedConditionCodes: (readiness.conditions ?? []).map((condition: { code: string }) => condition.code),
  });
  expect(decision.id).toBeTruthy();

  const meta = await getOk(api, lead.token, `/api/v1/portfolio/initiatives/${ctx.projectId}/meta`);
  expect(meta.nextActionRecommended).toBe('Abrir un nuevo ciclo con la incertidumbre que quedó abierta.');
  const reading = await getOk(api, lead.token, `/api/v1/portfolio/challenges/${ctx.challengeId}/coverage-reading`);
  expect(reading.decisions).toEqual([expect.objectContaining({ projectId: ctx.projectId, outcome: 'continue_experimenting' })]);
  expect(reading.coverageStatus).toBe('cobertura_parcial');
  // Core §30: cambia la proyección de cobertura, no el texto del Reto.
  const challenges = await getOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${ctx.frontId}/challenges`);
  expect(challenges.find((c: { id: string }) => c.id === ctx.challengeId)).toMatchObject({ whatWeWantToMove: 'Bajar el costo por solicitud de 14.20 a 10.00' });

  await browserLogin(page, LEAD.email, LEAD.password);
  await page.goto('/portfolio/inicio');
  const panel = page.getByRole('region', { name: 'Lo que aprendió el portfolio' });
  await expect(panel.getByTestId('portfolio-learning').filter({ hasText: `${TAG} Iniciativa` }).first()).toContainText('Seguir experimentando', { timeout: 20_000 });
});

test('Portfolio Lead: capacidad y Copilot sobre el recorrido (§4/§24, §20)', async () => {
  const capacity = await getOk(api, lead.token, '/api/v1/portfolio/capacity');
  expect(JSON.stringify(capacity)).toContain(TAG);
  const orient = await getOk(api, part.token, `/api/v1/projects/${ctx.projectId}/copilot-mode/orient`);
  expect(orient.answer).toBeTruthy();
});
