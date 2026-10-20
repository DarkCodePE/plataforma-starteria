import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const db = new PrismaClient();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const tokenFrom = (body: any) => body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? '';

async function register(api: APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `p11-${label}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: `P11 ${label}`, role: 'participante' }, failOnStatusCode: false });
  expect([200, 201], await registration.text()).toContain(registration.status());
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(login.status(), await login.text()).toBe(200);
  const token = tokenFrom(await login.json());
  expect(token).toBeTruthy();
  return { token, user: await db.user.findUniqueOrThrow({ where: { email } }) };
}

test.describe('P11 runtime access isolation and retries', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await pwRequest.newContext({ baseURL: BASE }); });
  test.afterAll(async () => { await api.dispose(); await db.$disconnect(); });

  test('enforces scoped read/write roles and makes semantic, support and PDF retries durable', async () => {
    const owner = await register(api, 'owner');
    const viewer = await register(api, 'viewer');
    const otherTenant = await register(api, 'other-tenant');
    const project = await db.project.create({ data: { name: 'P11 security runtime', ownerId: owner.user.id, step0Status: 'IN_PROGRESS' } });
    await db.teamMember.createMany({ data: [
      { projectId: project.id, userId: owner.user.id, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] },
      { projectId: project.id, userId: viewer.user.id, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
    ] });

    const card = await api.get(`/api/v1/projects/${project.id}/adaptive-core/step0/semantic-card`, { headers: auth(viewer.token), failOnStatusCode: false });
    expect(card.status(), await card.text()).toBe(200);
    const outsiderRead = await api.get(`/api/v1/projects/${project.id}/adaptive-core/step0/semantic-card`, { headers: auth(otherTenant.token), failOnStatusCode: false });
    expect(outsiderRead.status(), await outsiderRead.text()).toBe(403);

    const deniedWrite = await api.post(`/api/v1/projects/${project.id}/adaptive-core/step0/semantic-input`, {
      headers: auth(viewer.token), data: { idempotencyKey: `${project.id}-viewer-denied`, fieldHint: 'objective', content: 'No debe escribirse' }, failOnStatusCode: false,
    });
    expect(deniedWrite.status(), await deniedWrite.text()).toBe(403);

    const semanticInput = { idempotencyKey: `${project.id}-semantic-retry`, fieldHint: 'objective', content: 'Reducir retrabajo comercial' };
    const firstSemantic = await api.post(`/api/v1/projects/${project.id}/adaptive-core/step0/semantic-input`, { headers: auth(owner.token), data: semanticInput, failOnStatusCode: false });
    const replaySemantic = await api.post(`/api/v1/projects/${project.id}/adaptive-core/step0/semantic-input`, { headers: auth(owner.token), data: { ...semanticInput, content: 'No debe aplicarse por retry' }, failOnStatusCode: false });
    expect(firstSemantic.status(), await firstSemantic.text()).toBe(200);
    expect(replaySemantic.status(), await replaySemantic.text()).toBe(200);
    expect(await db.adaptiveStepOutput.count({ where: { projectId: project.id, outputKey: 'Step0SemanticCard' } })).toBe(1);

    const supportInput = { idempotencyKey: `${project.id}-support-retry`, category: 'access', reason: 'Necesitamos acceso a datos.', severity: 'high', exitCondition: 'Acceso concedido.', nextAction: 'Portfolio identifica al responsable.' };
    const supportFirst = await api.post(`/api/v1/projects/${project.id}/adaptive-core/support-signals`, { headers: auth(owner.token), data: supportInput, failOnStatusCode: false });
    const supportReplay = await api.post(`/api/v1/projects/${project.id}/adaptive-core/support-signals`, { headers: auth(owner.token), data: { ...supportInput, reason: 'No debe duplicarse' }, failOnStatusCode: false });
    expect([200, 201], await supportFirst.text()).toContain(supportFirst.status());
    expect([200, 201], await supportReplay.text()).toContain(supportReplay.status());
    expect(await db.attentionItem.count({ where: { projectId: project.id, objectType: 'initiative_support' } })).toBe(1);

    const pdfHeaders = { ...auth(owner.token), 'Content-Type': 'application/pdf', 'X-File-Name': 'p11-retry.pdf', 'Idempotency-Key': `${project.id}-pdf-retry` };
    const pdfBytes = Buffer.from('%PDF-1.4\nP11\n');
    const firstUpload = await api.post(`/api/v1/initiatives/${project.id}/pdfs`, { headers: pdfHeaders, data: pdfBytes, failOnStatusCode: false });
    const replayUpload = await api.post(`/api/v1/initiatives/${project.id}/pdfs`, { headers: pdfHeaders, data: pdfBytes, failOnStatusCode: false });
    expect(firstUpload.status(), await firstUpload.text()).toBe(201);
    expect(replayUpload.status(), await replayUpload.text()).toBe(201);
    expect((await replayUpload.json()).data.pdfId).toBe((await firstUpload.json()).data.pdfId);
    expect(await db.initiativePdf.count({ where: { projectId: project.id, idempotencyKey: `${project.id}-pdf-retry` } })).toBe(1);
  });
});
