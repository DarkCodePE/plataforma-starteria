import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import axe from 'axe-core';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';
const mailpitURL = process.env.E2E_MAILPIT_URL ?? '';
const password = 'E2eTest!1234';

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerUser(api: APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}-${label}`;
  const email = `kan254-${stamp}@starteria.test`;
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-254 ${label}`, role: 'participante' },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const login = await api.post('/api/v1/auth/login', { data: { email, password } });
  expect(login.status(), await login.text()).toBe(200);
  return { email, password, userId, token: accessToken(await login.json()), stamp };
}

async function registerLead(api: APIRequestContext, label: string) {
  const user = await registerUser(api, label);
  const organization = await prisma.organization.create({
    data: { name: `KAN-254 ${label} ${user.stamp}`, slug: `kan254-${user.stamp}` },
  });
  await prisma.user.update({
    where: { id: user.userId },
    data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true },
  });
  await prisma.organizationMember.create({ data: { userId: user.userId, organizationId: organization.id, role: 'owner' } });
  await prisma.organizationPortfolioAccessGrant.createMany({
    data: ['portfolio:read', 'portfolio:write'].map((capability) => ({ userId: user.userId, organizationId: organization.id, capability })),
  });
  const login = await api.post('/api/v1/auth/login', { data: { email: user.email, password } });
  return { ...user, organizationId: organization.id, token: accessToken(await login.json()) };
}

async function loginUi(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });
}

async function createCanonicalMandate(lead: Awaited<ReturnType<typeof registerLead>>, suffix: string) {
  const front = await prisma.strategicFront.create({
    data: {
      organizationId: lead.organizationId,
      ownerId: lead.userId,
      name: `Frente canónico ${suffix}`,
      description: `Contexto estratégico verificable ${suffix}.`,
      strategicObjective: `Reducir abandono ${suffix}.`,
      whyNow: 'La señal operativa requiere una decisión humana.',
      constraints: 'No iniciar Steps automáticamente.',
      horizon: 'Q1 2027',
      status: 'active',
    },
  });
  const challenge = await prisma.challenge.create({
    data: {
      strategicFrontId: front.id,
      title: `Reto canónico ${suffix}`,
      description: `El owner debe revisar el contexto ${suffix}.`,
      objective: 'Transferir la responsabilidad con trazabilidad.',
      whatWeWantToMove: 'Continuidad responsable.',
      successCriteria: 'Respuesta humana explícita y recuperable.',
      knownFacts: 'El Brief fue confirmado por Portfolio Lead.',
      openQuestions: 'Capacidad real del owner.',
      constraints: 'No autoactivar proyectos.',
      dependencies: 'Disponibilidad del equipo.',
      expectedDecision: 'Aceptar o rechazar el encargo.',
      status: 'publicado',
    },
  });
  const brief = await prisma.challengeActivationBrief.create({
    data: { organizationId: lead.organizationId, challengeId: challenge.id, createdByActorId: lead.userId },
  });
  const version = await prisma.challengeActivationBriefVersion.create({
    data: {
      organizationId: lead.organizationId,
      briefId: brief.id,
      challengeId: challenge.id,
      versionNumber: 1,
      status: 'CONFIRMED',
      intent: `Objetivo confirmado ${suffix}.`,
      scope: `Alcance confirmado ${suffix}.`,
      strategicContextRefs: { objective: `Reducir abandono ${suffix}.` },
      inheritedContext: { challengeProblem: `Problema heredado ${suffix}.`, expectedDeliverable: `Recomendación verificable ${suffix}.` },
      constraintsSnapshot: ['No iniciar Steps automáticamente.'],
      knownGaps: ['Capacidad semanal por confirmar.'],
      sourceRefs: [{ source: 'KAN-254 E2E', ref: suffix }],
      provenance: { source: 'Portfolio Lead', actorId: lead.userId },
      createdByActorId: lead.userId,
      confirmedByActorId: lead.userId,
      confirmedAt: new Date(),
    },
  });
  return { front, challenge, brief, version };
}

async function waitForInvitationToken(email: string, briefVersionId: string) {
  if (!mailpitURL) throw new Error('E2E_MAILPIT_URL is required; productive email is not claimed by this test.');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const listing = await fetch(`${mailpitURL}/api/v1/messages?limit=100`);
    if (listing.ok) {
      const body = await listing.json() as { messages?: Array<Record<string, unknown>>; Messages?: Array<Record<string, unknown>> };
      for (const summary of body.messages ?? body.Messages ?? []) {
        const id = summary.ID ?? summary.Id ?? summary.id;
        if (!id) continue;
        const detail = await fetch(`${mailpitURL}/api/v1/message/${encodeURIComponent(String(id))}`);
        if (!detail.ok) continue;
        const serialized = JSON.stringify(await detail.json());
        if (!serialized.toLowerCase().includes(email.toLowerCase()) || !serialized.includes(briefVersionId)) continue;
        const token = serialized.match(/\/handoff\/invitations\/([a-f0-9]{64})/i)?.[1];
        if (token) return token;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Mailpit did not capture the invitation for ${email}.`);
}

async function createAndSend(
  api: APIRequestContext,
  lead: Awaited<ReturnType<typeof registerLead>>,
  mandate: Awaited<ReturnType<typeof createCanonicalMandate>>,
  email: string,
  suffix: string,
) {
  const created = await api.post(`/api/v1/portfolio/challenges/${mandate.challenge.id}/handoff-assignments`, {
    headers: { ...bearer(lead.token), 'Idempotency-Key': `kan254-create-${lead.stamp}-${suffix}` },
    data: {
      targetKind: 'CHALLENGE',
      briefId: mandate.brief.id,
      briefVersionId: mandate.version.id,
      contextNote: `Contexto específico del encargo ${suffix}.`,
      invitedEmailNormalized: email,
      members: [{ identityKey: email, emailNormalized: email, role: 'OWNER', label: 'Owner principal' }],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const assignment = (await created.json()).data.assignment as { id: string; version: number };

  const duplicate = await api.post(`/api/v1/portfolio/challenges/${mandate.challenge.id}/handoff-assignments`, {
    headers: { ...bearer(lead.token), 'Idempotency-Key': `kan254-duplicate-${lead.stamp}-${suffix}` },
    data: {
      targetKind: 'CHALLENGE', briefId: mandate.brief.id, briefVersionId: mandate.version.id,
      contextNote: 'Duplicado que debe rechazarse.', invitedEmailNormalized: email,
      members: [{ identityKey: email, emailNormalized: email, role: 'OWNER' }],
    },
    failOnStatusCode: false,
  });
  expect(duplicate.status()).toBe(409);

  const sendBody = { challengeId: mandate.challenge.id, items: [{ assignmentId: assignment.id, expectedVersion: assignment.version }], retryOfBatchId: null };
  const headers = { ...bearer(lead.token), 'Idempotency-Key': `kan254-send-${lead.stamp}-${suffix}` };
  const first = await api.post('/api/v1/portfolio/handoff-assignments/batch/invitations', { headers, data: sendBody });
  expect(first.status(), await first.text()).toBe(200);
  const replay = await api.post('/api/v1/portfolio/handoff-assignments/batch/invitations', { headers, data: sendBody });
  expect(replay.status(), await replay.text()).toBe(200);
  expect((await replay.json()).data.id).toBe((await first.json()).data.id);
  const token = await waitForInvitationToken(email, mandate.version.id);
  expect(await prisma.portfolioHandoffInvitation.count({ where: { assignmentId: assignment.id } })).toBe(1);
  expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: assignment.id } })).toBe(1);
  return { assignmentId: assignment.id, token };
}

async function assertWcagAA(page: Page, selector: string) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async (target) => {
    const root = document.querySelector(target);
    if (!root) return [{ id: 'missing-target', impact: 'critical' }];
    const result = await (window as typeof window & { axe: typeof axe }).axe.run(root, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map((node) => node.target) }));
  }, selector);
  expect(violations).toEqual([]);
}

async function captureResponsiveEvidence(page: Page, testInfo: TestInfo, prefix: string) {
  for (const [name, width, height] of [['mobile', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 1000]] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: testInfo.outputPath(`${prefix}-${name}-${width}.png`), fullPage: true });
  }
}

test.afterAll(async () => { await prisma.$disconnect(); });

test('KAN-254 · owner existente/nuevo, mismatch, rechazo, expiración, reentrada y trazabilidad Lead', async ({ browser, page }, testInfo) => {
  const api = await pwRequest.newContext({ baseURL });
  const lead = await registerLead(api, 'lead');
  const otherLead = await registerLead(api, 'other-tenant');
  const owner = await registerUser(api, 'existing-owner');
  const wrongUser = await registerUser(api, 'wrong-identity');

  const rejectMandate = await createCanonicalMandate(lead, 'rechazo');
  const sent = await createAndSend(api, lead, rejectMandate, owner.email, 'reject');
  const forbidden = await api.get(`/api/v1/portfolio/challenges/${rejectMandate.challenge.id}/handoff-assignments`, {
    headers: bearer(otherLead.token), failOnStatusCode: false,
  });
  expect(forbidden.status()).toBe(404);

  await loginUi(page, wrongUser);
  await page.goto(`/handoff/invitations/${sent.token}`);
  await expect(page.getByText('Esta cuenta no coincide con la identidad invitada.')).toBeVisible();
  await expect(page.getByText(`Frente canónico rechazo`)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aceptar asignación' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cambiar de cuenta' }).click();
  await expect(page).toHaveURL(/\/auth/);
  await page.getByPlaceholder('tu@empresa.com').fill(owner.email);
  await page.locator('input[type="password"]').fill(owner.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(`/handoff/invitations/${sent.token}`), { timeout: 20_000 });

  const shell = page.getByTestId('handoff-shell');
  await expect(shell).toContainText('Frente canónico rechazo');
  await expect(shell).toContainText('Reto canónico rechazo');
  await expect(shell).toContainText('Objetivo confirmado rechazo.');
  await expect(shell).toContainText('Alcance confirmado rechazo.');
  await expect(shell).toContainText('Recomendación verificable rechazo.');
  await expect(shell).toContainText('No iniciar Steps automáticamente.');
  await expect(shell).toContainText(`KAN-254 lead`);
  await expect(shell).toContainText('Brief confirmado · versión 1');
  await expect(page.getByRole('button', { name: 'Empezar' })).toHaveCount(0);
  await assertWcagAA(page, '[data-testid="handoff-shell"]');
  await captureResponsiveEvidence(page, testInfo, 'owner-pending');

  const rejectButton = page.getByRole('button', { name: 'Rechazar' });
  await rejectButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Rechazar asignación' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(/Indica por qué/);
  await dialog.getByLabel('Motivo del rechazo').fill('No dispongo de capacidad durante el horizonte indicado.');
  await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(page.getByTestId('handoff-status')).toHaveText('Rechazada');
  await page.reload();
  await expect(page.getByText('No dispongo de capacidad durante el horizonte indicado.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('owner-rejected-reentry.png'), fullPage: true });
  expect(await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: sent.assignmentId } })).toMatchObject({
    state: 'REJECTED', rejectedBy: owner.userId, startedAt: null, startedBy: null,
  });

  const newOwnerEmail = `kan254-new-${Date.now()}@starteria.test`;
  const newMandate = await createCanonicalMandate(lead, 'usuario-nuevo');
  const newSent = await createAndSend(api, lead, newMandate, newOwnerEmail, 'new-user');
  const newContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const newPage = await newContext.newPage();
  await newPage.goto(`/handoff/invitations/${newSent.token}`);
  await newPage.getByRole('button', { name: 'Iniciar sesión o registrarme' }).click();
  await newPage.getByRole('button', { name: 'Regístrate' }).click();
  await newPage.getByText('Nombre completo').locator('..').getByRole('textbox').fill('Nora Nueva Owner');
  await newPage.getByPlaceholder('tu@empresa.com').fill(newOwnerEmail);
  await newPage.locator('input[type="password"]').fill(password);
  await newPage.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(newPage).toHaveURL(new RegExp(`/handoff/invitations/${newSent.token}`), { timeout: 20_000 });
  await expect(newPage.getByTestId('handoff-shell')).toContainText('Reto canónico usuario-nuevo');
  await newPage.getByRole('button', { name: 'Aceptar asignación' }).click();
  await expect(newPage.getByTestId('handoff-status')).toHaveText('Aceptada');
  await expect(newPage.getByRole('button', { name: 'Empezar' })).toBeEnabled();
  await newPage.screenshot({ path: testInfo.outputPath('new-owner-accepted-mobile.png'), fullPage: true });
  const newOwner = await prisma.user.findUniqueOrThrow({ where: { email: newOwnerEmail } });
  expect(await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: newSent.assignmentId } })).toMatchObject({
    organizationId: lead.organizationId, state: 'ACCEPTED', acceptedBy: newOwner.id, startedAt: null, startedBy: null,
  });
  await newContext.close();

  const expiredMandate = await createCanonicalMandate(lead, 'expirada');
  const expired = await createAndSend(api, lead, expiredMandate, owner.email, 'expired');
  await prisma.portfolioHandoffInvitation.updateMany({
    where: { assignmentId: expired.assignmentId }, data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  await page.goto(`/handoff/invitations/${expired.token}`);
  await expect(page.getByRole('heading', { name: 'Invitación no disponible' })).toBeVisible();
  await expect(page.getByText(/expiró/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aceptar asignación' })).toHaveCount(0);
  expect(await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: expired.assignmentId } })).toMatchObject({
    state: 'EXPIRED', startedAt: null, startedBy: null,
  });
  expect(await prisma.portfolioHandoffSemanticEvent.count({
    where: { originAssignmentId: expired.assignmentId, eventType: 'assignment_expired' },
  })).toBe(1);

  await loginUi(page, lead);
  await page.goto('/portfolio/inicio');
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
  const detail = page.getByRole('button', { name: `Ver detalle de Assignment ${sent.assignmentId}` });
  await detail.click();
  const history = page.getByRole('region', { name: `Historial del encargo ${sent.assignmentId}` });
  await expect(history).toContainText('Brief confirmado');
  await expect(history).toContainText('Correo aceptado por SMTP');
  await expect(history).toContainText('Encargo rechazado por el owner');
  await expect(history).toContainText('Respuesta humana');
  await expect(history).toContainText('No dispongo de capacidad durante el horizonte indicado.');
  await page.getByRole('button', { name: `Ver detalle de Assignment ${newSent.assignmentId}` }).click();
  const acceptedHistory = page.getByRole('region', { name: `Historial del encargo ${newSent.assignmentId}` });
  await expect(acceptedHistory).toContainText('Correo aceptado por SMTP');
  await expect(acceptedHistory).toContainText('Encargo aceptado por el owner');
  await expect(acceptedHistory).toContainText('Nora Nueva Owner');
  await page.reload();
  const reentryDetail = page.getByRole('button', { name: `Ver detalle de Assignment ${sent.assignmentId}` });
  await expect(reentryDetail).toBeVisible();
  await reentryDetail.click();
  const reentryHistory = page.getByRole('region', { name: `Historial del encargo ${sent.assignmentId}` });
  await expect(reentryHistory).toContainText('Correo aceptado por SMTP');
  await expect(reentryHistory).toContainText('Encargo rechazado por el owner');
  await expect(reentryHistory).toContainText('No dispongo de capacidad durante el horizonte indicado.');
  await page.screenshot({ path: testInfo.outputPath('portfolio-lead-trace-reentry.png'), fullPage: true });

  const evidence = {
    emailEnvironment: 'Mailpit sandbox; no productive delivery asserted',
    leadOrganizationId: lead.organizationId,
    rejectedAssignmentId: sent.assignmentId,
    acceptedAssignmentId: newSent.assignmentId,
    expiredAssignmentId: expired.assignmentId,
    noStepsStarted: true,
  };
  await testInfo.attach('kan254-certification.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  await api.dispose();
});
