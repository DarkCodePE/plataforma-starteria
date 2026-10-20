import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const db = new PrismaClient();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const tokenFrom = (body: any) => body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? '';

async function register(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `p8-runtime-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: 'P8 Runtime Owner', role: 'participante' }, failOnStatusCode: false });
  expect([200, 201], await registration.text()).toContain(registration.status());
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(login.status(), await login.text()).toBe(200);
  const token = tokenFrom(await login.json());
  expect(token).toBeTruthy();
  return { token, user: await db.user.findUniqueOrThrow({ where: { email } }) };
}

async function semantic(api: APIRequestContext, token: string, projectId: string, step: number, key: string, field: string, content: string, sourceRefIds: string[] = []) {
  const response = await api.post(`/api/v1/projects/${projectId}/adaptive-core/steps/${step}/semantic-input`, {
    headers: auth(token), data: { idempotencyKey: `${projectId}-${key}`, field, content, sourceRefIds }, failOnStatusCode: false,
  });
  expect(response.status(), `${step}:${field}: ${await response.text()}`).toBe(200);
  return (await response.json()).data;
}

test.describe('P8 Steps 1–4 governed semantic runtime', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await pwRequest.newContext({ baseURL: BASE }); });
  test.afterAll(async () => { await api.dispose(); await db.$disconnect(); });

  test('runs Step 0 through 4 with persisted handoffs, provenance, contradiction review and retry safety', async () => {
    const owner = await register(api);
    const project = await db.project.create({ data: { name: 'P8 runtime governed cycle', ownerId: owner.user.id, step0Status: 'IN_PROGRESS', step0Data: { adaptiveCore: { masterContext: { handoffMandate: { constraints: ['No data personal'] } } } } } });
    await db.teamMember.create({ data: { projectId: project.id, userId: owner.user.id, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } });
    const step0 = await api.post(`/api/v1/projects/${project.id}/adaptive-core/step0/semantic-input`, { headers: auth(owner.token), data: { idempotencyKey: `p8-s0-${project.id}`, fieldHint: 'objective', content: 'Reducir retrabajo comercial' } });
    expect(step0.status()).toBe(200);
    const cycle = await db.initiativeCycle.findFirstOrThrow({ where: { projectId: project.id, status: 'active' } });
    for (const step of [1, 2, 3, 4]) await db.adaptiveStepConfiguration.create({ data: {
      projectId: project.id, cycleId: cycle.id, stepNumber: step, version: 1, status: 'active', routeType: 'explore_validate', depthLevel: 'standard', maturity: 'problem',
      configurationJson: { p8Runtime: true, step }, sourceContextJson: { step0SemanticHandoff: { version: 1, fields: ['objective'], gaps: ['scope'] } },
    } });
    await db.adaptiveStepOutput.createMany({ data: [
      { projectId: project.id, cycleId: cycle.id, stepNumber: 1, version: 1, status: 'confirmed', outputKey: 'ProblemFocusBrief', outputJson: { focus: 'original' } },
      { projectId: project.id, cycleId: cycle.id, stepNumber: 2, version: 1, status: 'confirmed', outputKey: 'ExperimentDesign', outputJson: { work: 'original' } },
    ] });
    const source = await db.sourceRef.create({ data: { projectId: project.id, sourceType: 'USER_INPUT', reference: 'P8 runtime measurement', originActorId: owner.user.id, originActorType: 'human' } });

    const unknown = await semantic(api, owner.token, project.id, 1, 'p8-s1-unknown', 'focus', 'No se');
    expect(unknown.card.unknowns).toContain('focus');
    await semantic(api, owner.token, project.id, 1, 'p8-s1-focus', 'focus', 'Reducir retrabajo');
    await semantic(api, owner.token, project.id, 1, 'p8-s1-fact', 'fact', 'Se registran 12 casos', [source.id]);
    await semantic(api, owner.token, project.id, 1, 'p8-s1-hypothesis', 'hypothesis', 'Una plantilla reduce casos');
    const step1 = await semantic(api, owner.token, project.id, 1, 'p8-s1-evidence', 'evidence', 'Entrevista confirmada', [source.id]);
    expect(step1.card.handoff).toMatchObject({ toStep: 2, sourceRefIds: [source.id] });
    await semantic(api, owner.token, project.id, 2, 'p8-s2-work', 'selectedWork', 'Piloto de plantilla');
    await semantic(api, owner.token, project.id, 2, 'p8-s2-measure', 'measurementPlan', 'Medir casos semanales');
    const step2 = await semantic(api, owner.token, project.id, 2, 'p8-s2-capacity', 'capacityBoundary', 'Equipo comercial ejecuta');
    expect(step2.card.handoff).toMatchObject({ toStep: 3 });
    await semantic(api, owner.token, project.id, 3, 'p8-s3-execution', 'execution', 'Ejecutamos dos semanas');
    await semantic(api, owner.token, project.id, 3, 'p8-s3-observation', 'observation', '7 usuarios usaron la plantilla', [source.id]);
    await semantic(api, owner.token, project.id, 3, 'p8-s3-interpretation', 'interpretation', 'Adopcion inicial positiva');
    await semantic(api, owner.token, project.id, 4, 'p8-s4-learning', 'learning', 'Onboarding requiere acompanamiento');
    await semantic(api, owner.token, project.id, 4, 'p8-s4-recommendation', 'recommendation', 'Iterar con soporte');
    const step4 = await semantic(api, owner.token, project.id, 4, 'p8-s4-request', 'decisionRequest', 'Sponsor decide siguiente horizonte');
    expect(step4.card.handoff).toMatchObject({ toStep: 'Decision' });
    expect(await db.decision.count({ where: { projectId: project.id } })).toBe(0);
    const beforeRetry = await db.adaptiveStepOutput.count({ where: { projectId: project.id, outputKey: 'Step3SemanticCard' } });
    const contradiction = await semantic(api, owner.token, project.id, 3, 'p8-s3-contradiction', 'observation', 'Solo 2 usuarios usaron la plantilla', [source.id]);
    expect(contradiction.card.requiresReview).toBe(true);
    expect((await db.adaptiveStepOutput.findFirstOrThrow({ where: { projectId: project.id, outputKey: 'ProblemFocusBrief' } })).requiresReview).toBe(true);
    await semantic(api, owner.token, project.id, 3, 'p8-s3-contradiction', 'observation', 'no aplicar por retry', [source.id]);
    expect(await db.adaptiveStepOutput.count({ where: { projectId: project.id, outputKey: 'Step3SemanticCard' } })).toBe(beforeRetry + 1);
    expect(await db.initiativeCycle.count({ where: { projectId: project.id } })).toBe(1);
  });
});
