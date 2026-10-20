import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const db = new PrismaClient();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const tokenFrom = (body: any) => body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? body?.tokens?.accessToken ?? body?.accessToken ?? '';

async function registerOwner(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `p7-runtime-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: 'P7 Runtime Owner', role: 'participante' }, failOnStatusCode: false });
  expect([200, 201], `register: ${await registration.text()}`).toContain(registration.status());
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(login.status(), `login: ${await login.text()}`).toBe(200);
  const token = tokenFrom(await login.json());
  expect(token).toBeTruthy();
  return { token, user: await db.user.findUniqueOrThrow({ where: { email } }) };
}

async function makeProject(ownerId: string, name: string, context: Record<string, unknown>) {
  const project = await db.project.create({ data: { name, ownerId, step0Status: 'IN_PROGRESS', step0Data: { adaptiveCore: { masterContext: context } } } });
  await db.teamMember.create({ data: { projectId: project.id, userId: ownerId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } });
  return project;
}

async function semantic(api: APIRequestContext, token: string, projectId: string, key: string, fieldHint: string, content: string, extra: Record<string, unknown> = {}) {
  const response = await api.post(`/api/v1/projects/${projectId}/adaptive-core/step0/semantic-input`, {
    headers: auth(token), data: { idempotencyKey: key, fieldHint, content, ...extra }, failOnStatusCode: false,
  });
  expect(response.status(), `semantic ${fieldHint}: ${await response.text()}`).toBe(200);
  return (await response.json()).data;
}

test.describe('P7 Step 0 semantic Card runtime', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await pwRequest.newContext({ baseURL: BASE }); });
  test.afterAll(async () => { await api.dispose(); await db.$disconnect(); });

  test('Route A retains context, interprets adverse input, versions Card state, and requires human confirmation', async () => {
    const owner = await registerOwner(api);
    const project = await makeProject(owner.user.id, 'Reducir retrabajo comercial.', {
      handoffMandate: { constraints: ['No modificar datos personales'], sourceRefs: ['brief-a'] },
      challengeSnapshot: { id: 'p7-challenge', title: 'Reducir retrabajo' },
    });
    const initial = await api.get(`/api/v1/projects/${project.id}/adaptive-core/step0/semantic-card`, { headers: auth(owner.token) });
    expect(initial.status()).toBe(200);
    const initialCard = (await initial.json()).data.card;
    expect(initialCard.inheritedContext).toMatchObject({ handoffMandate: { constraints: ['No modificar datos personales'] } });

    const unknown = await semantic(api, owner.token, project.id, 'p7-unknown-owner', 'owner', 'No sé');
    expect(unknown.card.unknowns).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'owner' })]));
    const irrelevant = await semantic(api, owner.token, project.id, 'p7-irrelevant', 'objective', 'Me gusta la pizza y el fútbol.');
    expect(irrelevant.card.fields.objective).toEqual(initialCard.fields.objective);

    await semantic(api, owner.token, project.id, 'p7-objective', 'objective', 'Reducir retrabajo comercial.');
    await semantic(api, owner.token, project.id, 'p7-scope', 'scope', 'Equipo comercial de Madrid.');
    await semantic(api, owner.token, project.id, 'p7-owner', 'owner', 'Ana, responsable comercial.');
    await semantic(api, owner.token, project.id, 'p7-hypothesis', 'priorityHypothesis', 'Si simplificamos el tablero, aumentará el uso.', { newSource: { reference: 'Entrevista con Ana' } });
    const ready = await semantic(api, owner.token, project.id, 'p7-criteria', 'decisionCriteria', 'Tres entrevistas y la métrica base permiten decidir.');
    expect(ready.card.sufficiency.sufficient).toBe(true);
    expect(ready.card.checkpoint).toMatchObject({ state: 'ready_for_human_confirmation', humanConfirmationRequired: true });
    expect(ready.card.handoff).toMatchObject({ toStep: 1, structured: true });
    expect(ready.card.sources).toEqual(expect.arrayContaining([expect.objectContaining({ reference: 'Entrevista con Ana', validationStatus: 'unvalidated' })]));

    const versionsBeforeRetry = await db.adaptiveStepOutput.count({ where: { projectId: project.id, outputKey: 'Step0SemanticCard' } });
    const replay = await semantic(api, owner.token, project.id, 'p7-criteria', 'decisionCriteria', 'Este texto no debe aplicarse por retry.');
    expect(replay.card.fields.decisionCriteria.value).toBe('Tres entrevistas y la métrica base permiten decidir.');
    expect(await db.adaptiveStepOutput.count({ where: { projectId: project.id, outputKey: 'Step0SemanticCard' } })).toBe(versionsBeforeRetry);

    const contradiction = await semantic(api, owner.token, project.id, 'p7-contradiction', 'scope', 'Toda la compañía.');
    expect(contradiction.card.requiresReview).toBe(true);
    expect(contradiction.card.contradictions).toEqual(expect.arrayContaining([expect.objectContaining({ previous: 'Equipo comercial de Madrid.', proposed: 'Toda la compañía.' })]));
  });

  test('Route B preserves recovered context and Route C adds no fictional hierarchy', async () => {
    const owner = await registerOwner(api);
    const routeB = await makeProject(owner.user.id, 'P7 Route B', { routeType: 'reconstruct_existing', recoveredHistory: { outputs: 2, gaps: ['Criterio pendiente'] }, handoffMandate: { constraints: ['Conservar la historia'] } });
    const source = await db.sourceRef.create({ data: { projectId: routeB.id, sourceType: 'CONTEXT_SOURCE', reference: 'Historia heredada', originActorId: owner.user.id, originActorType: 'system' } });
    const b = await semantic(api, owner.token, routeB.id, 'p7-b-objective', 'objective', 'P7 Route B', { sourceRefIds: [source.id] });
    expect(b.card.inheritedContext).toMatchObject({ routeType: 'reconstruct_existing', recoveredHistory: { outputs: 2 } });
    expect(b.card.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: source.id })]));
    expect(await db.project.count({ where: { id: routeB.id } })).toBe(1);

    const routeC = await makeProject(owner.user.id, 'P7 Route C', { routeType: 'lightweight_plan' });
    const c = await semantic(api, owner.token, routeC.id, 'p7-c-objective', 'objective', 'P7 Route C');
    expect(c.card.inheritedContext.challengeSnapshot).toBeNull();
    expect(await db.initiativePortfolioMeta.count({ where: { projectId: routeC.id } })).toBe(0);
  });
});
