import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const enabled = process.env.PORTFOLIO_ENTRY_E2E_TEST === 'true';
test.skip(!enabled, 'requires the deterministic Portfolio Entry full-stack runner');

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/auth$/);
}

test('real browser, Entry routers and PostgreSQL carry 114F snapshot into governed Home and Bootstrap', async ({ page, request }) => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const email = `handoff-141-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registered = await request.post('/api/v1/auth/register', { data: {
    email, password, name: 'Portfolio Setup 141', role: 'participante',
  }, failOnStatusCode: false });
  expect(registered.status(), await registered.text()).toBe(201);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const org = await db.organization.create({ data: { name: `114F ${stamp}`, slug: `handoff-141-${stamp}` } });
  await db.organizationMember.create({ data: { userId: user.id, organizationId: org.id } });
  await db.organizationPortfolioAccessGrant.create({ data: {
    userId: user.id, organizationId: org.id, capability: 'portfolio:read',
  } });
  const now = new Date();
  const created = await request.post('/api/v1/public/portfolio-entry/sessions', { data: {
    sourceMetadata: { channel: 'public_start_frontend' },
  }, failOnStatusCode: false });
  expect(created.status(), await created.text()).toBe(201);
  const createdId = (await created.json()).data.session.id as string;
  const session = await db.portfolioEntrySession.update({ where: { id: createdId }, data: {
    ownerUserId: user.id, ownershipState: 'CLAIMED', rawEntry: 'PRIVATE_ENTRY',
    lifecycleStatus: 'HANDOFF_READY', revision: 3, contextRevision: 1,
    continuationProfile: 'PORTFOLIO_LEAD_ENTRY', continuationProfileVersion: 1,
    continuationProfileEvidenceRef: `session-created:${createdId}`,
    lastActivityAt: now, expiresAt: new Date(now.getTime() + 600_000),
  } });
  await db.portfolioEntryCriticalHandoff.create({ data: {
    sessionId: session.id, artifactVersion: 1, schemaVersion: 'critical-handoff-projection-v0.1',
    sourceContextRevision: 1, payload: { conclusionStatus: 'supported',
      finalReading: 'Lectura real para revisar capacidad.', decisionInView: 'Elegir qué trabajo revisar.',
      usableNow: [], decisionChangingUnknowns: [], firstMovement: null },
    confirmationState: 'confirmed', confirmedAt: new Date(now.getTime() - 1000), confirmedByUserId: user.id,
  } });
  const projectsBefore = await db.project.count({ where: { ownerId: user.id } });
  const stepsBefore = await db.step.count();
  await login(page, email, password);
  await page.evaluate((sessionId) => {
    window.sessionStorage.setItem('starteria.portfolioEntry.claimedSession', JSON.stringify({ sessionId }));
    window.sessionStorage.setItem('starteria.portfolioEntry.criticalHandoffReviewSession', sessionId);
  }, session.id);
  const requests: string[] = [];
  page.on('request', (req) => requests.push(`${req.method()} ${new URL(req.url()).pathname}`));
  await page.goto('/public/start');
  await expect(page.getByRole('heading', { name: 'Retomamos lo que ya entendimos' })).toBeVisible();
  const writePromise = page.waitForResponse((res) => res.request().method() === 'POST'
    && new URL(res.url()).pathname.endsWith(`/sessions/${session.id}/portfolio-setup-continuity/continue`));
  await page.getByRole('button', { name: 'Continuar con este contexto' }).click();
  const write = await writePromise;
  expect(write.status(), await write.text()).toBe(200);
  const snapshotId = (await write.json()).data.snapshotId as string;
  const action = page.getByRole('link', { name: 'Continuar al portafolio' });
  await expect(action).toHaveAttribute('href', `/portfolio/inicio?portfolioSetupContinuationId=${snapshotId}`);
  requests.length = 0;
  await action.click();
  await expect(page.getByTestId('portfolio-setup-home-arrival')).toBeVisible();
  await expect(page.getByText('Lectura real para revisar capacidad.', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('portfolio-bootstrap-home-a')).toBeVisible();
  expect(requests).toContain(`GET /api/v1/public/portfolio-entry/continuations/${snapshotId}/portfolio-home-arrival`);
  expect(requests).toContain('POST /api/v1/portfolio-bootstrap/sessions/from-portfolio-setup-continuity');
  expect(requests).not.toContain('GET /api/v1/projects');
  expect(requests.some((path) => /\/portfolio\/(strategic-fronts|challenges|initiatives)|\/home-context/.test(path))).toBe(false);
  expect(await db.portfolioEntryPortfolioContinuation.findUniqueOrThrow({ where: { id: snapshotId } }))
    .toMatchObject({ snapshotFormat: 'PORTFOLIO_SETUP_114F_V1', snapshotState: 'CURRENT',
      organizationScopeId: org.id });
  expect(await db.portfolioBootstrapSession.findFirstOrThrow({ where: { sourceContinuationId: snapshotId } }))
    .toMatchObject({ userId: user.id, organizationId: org.id });
  expect(await db.project.count({ where: { ownerId: user.id } })).toBe(projectsBefore);
  expect(await db.step.count()).toBe(stepsBefore);
  await db.$disconnect();
});
