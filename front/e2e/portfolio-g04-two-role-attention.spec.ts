/**
 * G04 two-role, real browser + HTTP + disposable PostgreSQL certification.
 * No intercepted endpoints, synthetic Step completions or hard-coded statuses.
 */
import { PrismaClient } from '@prisma/client';
import { expect, test, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';
type Identity = { userId: string; email: string; password: string; token: string };
const auth = (identity: Identity) => ({ Authorization: `Bearer ${identity.token}` });

async function createIdentity(api: APIRequestContext, prefix: string): Promise<Identity> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const email = `g04-${prefix}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `G04 ${prefix} ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const login = await api.post('/api/v1/auth/login', {
    data: { email, password }, failOnStatusCode: false,
  });
  expect(login.status(), await login.text()).toBe(200);
  const response = (await login.json()).data;
  const token = response.tokens?.accessToken ?? response.accessToken;
  expect(token).toBeTruthy();
  return { userId, email, password, token };
}

async function authenticateBrowser(page: Page, identity: Identity) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(identity.email);
  await page.locator('input[type="password"]').fill(identity.password);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page).not.toHaveURL(/\/auth(?:\?|$)/, { timeout: 20000 });
}

test.describe('G04 — certified two-role AttentionItem journey', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('equipo abre → Portfolio Lead responde y resuelve → equipo recupera historia; permisos, CAS e idempotencia', async ({ browser }) => {
    const api = await pwRequest.newContext({ baseURL });
    const owner = await createIdentity(api, 'owner');
    const lead = await createIdentity(api, 'lead');
    const outsider = await createIdentity(api, 'outsider');
    const stamp = `g04-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const org = await prisma.organization.create({ data: { name: `G04 ${stamp}`, slug: stamp } });
    await prisma.user.updateMany({
      where: { id: { in: [owner.userId, lead.userId] } },
      data: { organizationId: org.id, isActive: true },
    });
    await prisma.user.update({ where: { id: lead.userId },
      data: { role: 'portfolio_lead', roles: ['portfolio_lead'] },
    });
    await prisma.organizationMember.createMany({ data: [
      { userId: owner.userId, organizationId: org.id, role: 'member' },
      { userId: lead.userId, organizationId: org.id, role: 'owner' },
    ] });
    await prisma.organizationPortfolioAccessGrant.createMany({ data: [
      { userId: lead.userId, organizationId: org.id, capability: 'portfolio:read' },
      { userId: lead.userId, organizationId: org.id, capability: 'portfolio:write' },
    ] });
    // The first token was issued before granting Portfolio Lead authority.
    // Reauthenticate so direct API checks use the same current claims as the UI.
    const leadLogin = await api.post('/api/v1/auth/login', {
      data: { email: lead.email, password: lead.password }, failOnStatusCode: false,
    });
    expect(leadLogin.status(), await leadLogin.text()).toBe(200);
    const leadLoginData = (await leadLogin.json()).data;
    lead.token = leadLoginData.tokens?.accessToken ?? leadLoginData.accessToken;
    const project = await prisma.project.create({
      data: { name: `Integración oficinas ${stamp}`, ownerId: owner.userId, organizationId: org.id,
        status: 'IN_PROGRESS', currentStep: 1 },
    });
    // ProjectService.getProjectForRead requires an ACTIVE TeamMember record even
    // for its canonical owner. Mirror the normal assignment acceptance path.
    await prisma.teamMember.create({ data: {
      projectId: project.id, userId: owner.userId, role: 'OWNER',
      status: 'ACTIVE', modulePermissions: [], joinedAt: new Date(),
    } });
    const ownerContext = await browser.newContext();
    const leadContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const leadPage = await leadContext.newPage();
    try {
      // No user has global portfolio-write merely because of project ownership.
      const forbiddenPortfolio = await api.post(`/api/v1/portfolio/initiatives/${project.id}/attention-items`, {
        headers: { ...auth(owner), 'Idempotency-Key': `g04-owner-portfolio-${stamp}` },
        data: { category: 'bloqueo', reason: 'Falta aprobación de compras.',
          exitCondition: 'Aprobación documentada.', nextAction: 'Solicitar firma.' },
        failOnStatusCode: false,
      });
      expect([401, 403, 404]).toContain(forbiddenPortfolio.status());
      const crossTenant = await api.get(`/api/v1/projects/${project.id}/attention-items`, {
        headers: auth(outsider), failOnStatusCode: false,
      });
      expect([403, 404]).toContain(crossTenant.status());
      const outsiderWrite = await api.post(`/api/v1/projects/${project.id}/attention-items`, {
        headers: { ...auth(outsider), 'Idempotency-Key': `g04-foreign-${stamp}` },
        data: { category: 'bloqueo', reason: 'No debe escribirse',
          exitCondition: 'No aplica.', nextAction: 'No aplica.' }, failOnStatusCode: false,
      });
      expect([403, 404]).toContain(outsiderWrite.status());

      await authenticateBrowser(ownerPage, owner);
      await ownerPage.goto(`/initiatives/${project.id}/overview`);
      const ownerSection = ownerPage.getByRole('region', { name: 'Solicitudes y bloqueos de mi iniciativa' });
      await expect(ownerSection).toBeVisible({ timeout: 20000 });
      await expect(ownerSection.getByText('No hay solicitudes registradas.')).toBeVisible();
      await ownerSection.getByRole('button', { name: 'Comunicar un bloqueo' }).click();
      const reason = `La integración con el proveedor ${stamp} está bloqueada.`;
      await ownerSection.getByLabel('Qué está bloqueando el trabajo').fill(reason);
      await ownerSection.getByLabel('Qué debería ocurrir para resolverlo')
        .fill('Recibir validación técnica escrita y comprobar la conexión.');
      await ownerSection.getByLabel('Acción que propones')
        .fill('Revisar con el equipo responsable y desbloquear acceso.');
      const createdResponse = ownerPage.waitForResponse((res) =>
        res.request().method() === 'POST'
        && new URL(res.url()).pathname === `/api/v1/projects/${project.id}/attention-items`);
      await ownerSection.getByRole('button', { name: 'Enviar bloqueo a Portfolio Lead' }).click();
      const created = await createdResponse;
      expect(created.status(), await created.text()).toBe(201);
      const createdData = (await created.json()).data;
      const attentionId = createdData.id as string;
      expect(createdData.status).toBe('open');
      await expect(ownerSection.getByText(reason)).toBeVisible();
      expect(await prisma.attentionItem.count({ where: { projectId: project.id } })).toBe(1);
      expect(await prisma.portfolioAttentionEvent.count({ where: { attentionItemId: attentionId } })).toBe(1);

      // Identical request: a retry MUST NOT create a second alert.
      const retryKey = created.request().headers()['idempotency-key'];
      const retry = await api.post(`/api/v1/projects/${project.id}/attention-items`, {
        headers: { ...auth(owner), 'Idempotency-Key': retryKey },
        data: { category: 'bloqueo', reason,
          exitCondition: 'Recibir validación técnica escrita y comprobar la conexión.',
          nextAction: 'Revisar con el equipo responsable y desbloquear acceso.', severity: 'medium' },
        failOnStatusCode: false,
      });
      expect(retry.status(), await retry.text()).toBe(201);
      expect((await retry.json()).data.id).toBe(attentionId);
      expect(await prisma.attentionItem.count({ where: { projectId: project.id } })).toBe(1);

      await authenticateBrowser(leadPage, lead);
      await leadPage.goto('/portfolio/inicio');
      await expect(leadPage.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20000 });
      const operational = leadPage.getByRole('table', { name: 'Seguimiento operativo del portafolio' });
      const row = operational.getByRole('button', { name: `Ver detalle de ${project.name}` });
      await expect(row).toBeVisible({ timeout: 20000 });
      await row.click();
      const panel = leadPage.getByRole('region', { name: 'Alertas y solicitudes de la iniciativa' });
      await expect(panel).toBeVisible();
      const alert = panel.getByTestId('portfolio-attention-item').filter({ hasText: reason });
      await expect(alert).toBeVisible();

      await alert.getByLabel('Acción de Portfolio Lead').selectOption('respond');
      const responseNote = 'Hemos solicitado soporte técnico y autorizado una revisión.';
      await alert.getByLabel('Motivo y evidencia de la acción').fill(responseNote);
      const responseWrite = leadPage.waitForResponse((res) =>
        res.request().method() === 'POST'
        && new URL(res.url()).pathname === `/api/v1/portfolio/initiatives/${project.id}/attention-items/${attentionId}/actions`);
      await alert.getByRole('button', { name: 'Registrar acción e historial' }).click();
      expect((await responseWrite).status()).toBe(200);
      await expect.poll(async () => (await prisma.attentionItem.findUniqueOrThrow({
        where: { id: attentionId },
      })).version).toBe(1);

      // Owner can see actual human response on reentry, never just an inferred status.
      await ownerPage.reload();
      const ownerHistory = ownerPage.getByRole('region', { name: 'Solicitudes y bloqueos de mi iniciativa' });
      await expect(ownerHistory.getByText(reason)).toBeVisible({ timeout: 20000 });
      await ownerHistory.getByText(/Ver respuestas e historial/).click();
      await expect(ownerHistory.getByText(responseNote)).toBeVisible();

      // Stale update must fail without mutating version/events.
      const stale = await api.post(`/api/v1/portfolio/initiatives/${project.id}/attention-items/${attentionId}/actions`, {
        headers: { ...auth(lead), 'Idempotency-Key': `g04-stale-${stamp}` },
        data: { action: 'resolve', expectedVersion: 0, note: 'Intento antiguo no debe resolver este bloqueo.' },
        failOnStatusCode: false,
      });
      expect(stale.status()).toBe(409);
      expect(await prisma.portfolioAttentionEvent.count({ where: { attentionItemId: attentionId } })).toBe(2);

      await alert.getByLabel('Acción de Portfolio Lead').selectOption('resolve');
      const resolvedNote = 'Proveedor verificado, conexión restablecida y revisada.';
      await alert.getByLabel('Motivo y evidencia de la acción').fill(resolvedNote);
      const resolveWrite = leadPage.waitForResponse((res) =>
        res.request().method() === 'POST'
        && new URL(res.url()).pathname === `/api/v1/portfolio/initiatives/${project.id}/attention-items/${attentionId}/actions`);
      await alert.getByRole('button', { name: 'Registrar acción e historial' }).click();
      expect((await resolveWrite).status()).toBe(200);
      await expect.poll(async () => (await prisma.attentionItem.findUniqueOrThrow({
        where: { id: attentionId },
      })).status).toBe('resolved');
      expect(await prisma.portfolioAttentionEvent.count({ where: { attentionItemId: attentionId } })).toBe(3);

      await ownerPage.reload();
      await expect(ownerPage.getByText(resolvedNote)).toBeVisible({ timeout: 20000 });
      await leadPage.goto('/portfolio/inicio');
      await expect(leadPage.getByTestId('portfolio-overview-home')).toBeVisible();
      // Resolved alerts must no longer produce actionable project_attention.
      const homeRead = await api.get('/api/v1/portfolio/home', { headers: auth(lead), failOnStatusCode: false });
      expect(homeRead.status(), await homeRead.text()).toBe(200);
      const home = (await homeRead.json()).data;
      expect(home.attention.some((item: any) => item.entity?.id === project.id && item.summary === reason)).toBe(false);

      await ownerPage.reload();
      expect(await prisma.portfolioAttentionEvent.count({ where: { attentionItemId: attentionId } })).toBe(3);
    } finally {
      await ownerContext.close();
      await leadContext.close();
      await api.dispose();
    }
  });
});
