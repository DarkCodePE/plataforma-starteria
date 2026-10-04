// Helpers compartidos por los specs de e2e/job-driven/. Copiados de
// adaptive-core-prd03.spec.ts para no tocar los specs existentes.
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const BASE = process.env.E2E_BASE_URL || 'http://localhost';
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'portfolio-admin.e2e@starteria.test';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_USER_PASSWORD || 'demo123';

export type Session = { token: string; userId: string; email: string; password: string };

export function extractToken(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? body?.tokens?.accessToken ?? body?.accessToken ?? '';
}

function jwtSub(token: string): string {
  const part = token.split('.')[1];
  const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const payload = JSON.parse(json) as { sub?: string; userId?: string; id?: string };
  return payload.sub ?? payload.userId ?? payload.id ?? '';
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function login(api: APIRequestContext, email: string, password: string): Promise<Session> {
  const res = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(res.status(), `login ${email}: ${await res.text()}`).toBe(200);
  const token = extractToken(await res.json());
  expect(token).toBeTruthy();
  return { token, userId: jwtSub(token), email, password };
}

export async function registerAndLogin(api: APIRequestContext, tag: string): Promise<Session> {
  const stamp = Date.now() + Math.floor(Math.random() * 100000);
  const email = `e2e-job-${tag}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const reg = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `E2E Job ${tag} ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect([200, 201, 409], `register ${email}: ${await reg.text()}`).toContain(reg.status());
  return login(api, email, password);
}

export async function browserLogin(page: Page, email: string, password: string) {
  await page.goto('/auth');
  const result = await page.evaluate(
    async ({ email, password }) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { email, password },
  );
  expect(result.status, `browser login ${email}: ${JSON.stringify(result.body)}`).toBe(200);
}

export async function postOk(api: APIRequestContext, token: string, url: string, data: Record<string, unknown>) {
  const res = await api.post(url, { headers: auth(token), data, failOnStatusCode: false });
  expect(res.ok(), `${url}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

export async function patchOk(api: APIRequestContext, token: string, url: string, data: Record<string, unknown>) {
  const res = await api.patch(url, { headers: auth(token), data, failOnStatusCode: false });
  expect(res.ok(), `${url}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

export async function getOk(api: APIRequestContext, token: string, url: string) {
  const res = await api.get(url, { headers: auth(token), failOnStatusCode: false });
  expect(res.ok(), `${url}: ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

export async function createFromInitialReview(api: APIRequestContext, token: string, originalInput: string, companyContext?: Record<string, unknown>) {
  const review = await postOk(api, token, '/api/v1/initial-reviews', {
    originalInput,
    ...(companyContext ? { companyContext } : {}),
  });
  const confirmed = await postOk(api, token, `/api/v1/initial-reviews/${review.id}/confirm-route`, {});
  return confirmed.initiativeId as string;
}

export async function createCompany(api: APIRequestContext, token: string, name: string) {
  const res = await api.post('/api/v1/companies', {
    headers: auth(token),
    data: { name, sector: 'Servicios', country: 'Peru', areaName: 'Operaciones' },
    failOnStatusCode: false,
  });
  expect(res.status(), `create company: ${await res.text()}`).toBe(201);
  return (await res.json()).data;
}

export async function createFront(api: APIRequestContext, adminToken: string, data: Record<string, unknown>) {
  return postOk(api, adminToken, '/api/v1/portfolio/strategic-fronts', data);
}

export async function createChallenge(api: APIRequestContext, adminToken: string, frontId: string, data: Record<string, unknown>) {
  return postOk(api, adminToken, `/api/v1/portfolio/strategic-fronts/${frontId}/challenges`, data);
}

export async function createChallengeInitiative(api: APIRequestContext, adminToken: string, ownerToken: string, name: string) {
  const front = await createFront(api, adminToken, { name: `${name} Frente` });
  const challenge = await createChallenge(api, adminToken, front.id, { title: `${name} Reto` });
  const project = await postOk(api, ownerToken, '/api/v1/projects', { name: `${name} Iniciativa`, challengeId: challenge.id });
  return { frontId: front.id as string, challengeId: challenge.id as string, projectId: project.id as string };
}
