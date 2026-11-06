import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerPortfolioLead(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `kan213-g2b-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-213 G2-B ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-213 G2-B ${stamp}`, slug: `kan213-g2b-${stamp}` },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true },
  });
  await prisma.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'owner' } });
  await prisma.organizationPortfolioAccessGrant.createMany({
    data: ['portfolio:read', 'portfolio:write'].map((capability) => ({ userId, organizationId: organization.id, capability })),
  });
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(login.status(), await login.text()).toBe(200);
  return { email, password, userId, token: accessToken(await login.json()) };
}

async function prepareAnalyzedSession(api: APIRequestContext, lead: Awaited<ReturnType<typeof registerPortfolioLead>>) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: auth, data: {}, failOnStatusCode: false });
  expect(direct.status(), await direct.text()).toBe(200);
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  const anchor = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
    headers: auth,
    data: {
      contextSummary: 'Revisar el trabajo existente antes de organizarlo.',
      outcomeStatement: 'Reducir abandono durante la activación B2B.',
      decisionToEnable: 'Decidir qué trabajo continuar este trimestre.',
      businessSignalStatus: 'confirmed',
      businessSignalValue: 'Activación a 30 días.',
    },
    failOnStatusCode: false,
  });
  expect(anchor.status(), await anchor.text()).toBe(200);
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, { headers: auth, data: {}, failOnStatusCode: false });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  const work = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/work-items/manual`, {
    headers: { ...auth, 'Idempotency-Key': `kan213-work-${sessionId}` },
    data: { label: 'Onboarding guiado', purpose: 'Reducir fricción de activación.', currentStateHint: 'active' },
    failOnStatusCode: false,
  });
  expect(work.status(), await work.text()).toBe(200);
  const analyzed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/analyze`, {
    headers: { ...auth, 'Idempotency-Key': `kan213-analysis-${sessionId}` },
    data: {},
    failOnStatusCode: false,
  });
  expect(analyzed.status(), await analyzed.text()).toBe(200);
  const mutation = ((await analyzed.json()).data.proposedMutations as Array<{
    id: string;
    targetType: string;
    proposedValue: unknown;
  }>).find((candidate) => candidate.targetType === 'advancement_condition');
  expect(mutation).toBeTruthy();
  return { sessionId, auth, mutation };
}

async function loginUi(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
  await expect(page.getByTestId('portfolio-bootstrap-material-review')).toBeVisible({ timeout: 20_000 });
}

test.describe('KAN-213 G2-B V2_CONFORMANCE', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('CA-05..CA-09 uses backend E5 eligibility for CTA/sidebar, denies API bypass, and recovers after audited resolution', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerPortfolioLead(api);
    const { sessionId, auth, mutation } = await prepareAnalyzedSession(api, lead);
    const proposedValue = mutation.proposedValue && typeof mutation.proposedValue === 'object' && !Array.isArray(mutation.proposedValue)
      ? mutation.proposedValue as Record<string, unknown>
      : {};
    await prisma.portfolioBootstrapProposedMutation.update({
      where: { id: mutation.id },
      data: { proposedValue: { ...proposedValue, severity: 'blocking', movementAffected: 'Organización' } },
    });
    const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/proposed-mutations/${mutation.id}/confirm`, {
      headers: auth,
      data: { reviewNote: 'Bloqueo confirmado para certificar el gate E5.' },
      failOnStatusCode: false,
    });
    expect(confirmed.status(), await confirmed.text()).toBe(200);

    const blockedEligibility = await api.get(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/e5-eligibility`, { headers: auth });
    const blockedEligibilityBody = await blockedEligibility.json();
    expect(blockedEligibilityBody).toMatchObject({
      data: { allowed: false, reasonCodes: expect.arrayContaining(['HARD_BLOCKERS_ACTIVE']) },
    });
    const condition = (blockedEligibilityBody.data.blockers as Array<{
      id: string;
      kind: string;
      dispositionVersion: number;
    }>).find((blocker) => blocker.kind === 'confirmed_condition');
    expect(condition).toBeTruthy();

    await loginUi(page, lead);
    const continueToOrganization = page.getByRole('button', { name: 'Continuar a organización' });
    await expect(continueToOrganization).toBeDisabled();
    await expect(page.getByRole('button', { name: /5 Organización/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /6 Briefs/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /7 Asignación/i })).toBeDisabled();
    await expect(page.getByTestId('portfolio-analysis-completion-gate')).toContainText('Bloqueo confirmado activo');

    const bypass = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/organization-proposal`, {
      headers: auth,
      data: {
        expectedVersion: 0,
        payload: {
          summary: 'Intento directo que debe ser denegado.',
          fronts: [{
            candidateId: 'front-1', name: 'Activación', focus: 'Reducir abandono', rationale: 'Coordinar decisiones', coverage: '1 iniciativa',
            challenges: [{ candidateId: 'challenge-1', title: 'Reducir fricción', problem: 'Abandono temprano', rationale: 'Mismo resultado', relatedInitiativeIds: [], evidence: [], gaps: [], overlaps: [] }],
          }],
          crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [],
        },
      },
      failOnStatusCode: false,
    });
    expect(bypass.status(), await bypass.text()).toBe(409);
    expect(await bypass.json()).toMatchObject({ error: { code: 'PORTFOLIO_E5_INELIGIBLE' } });

    const resolved = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/advancement-conditions/${condition!.id}/disposition`, {
      headers: { ...auth, 'Idempotency-Key': `kan213-resolve-${condition!.id}` },
      data: { disposition: 'resolved', expectedVersion: condition!.dispositionVersion, reason: 'Evidencia revisada por Portfolio Lead.', evidenceRefs: ['kan213-e2e-review'] },
      failOnStatusCode: false,
    });
    expect(resolved.status(), await resolved.text()).toBe(200);

    await page.reload();
    await expect(page.getByTestId('portfolio-bootstrap-material-review')).toBeVisible({ timeout: 20_000 });
    await expect(continueToOrganization).toBeEnabled({ timeout: 20_000 });
    await continueToOrganization.click();
    await expect(page.getByTestId('portfolio-organization-proposal')).toBeVisible();
    expect(await prisma.portfolioBootstrapWorkItem.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    expect(await prisma.portfolioBootstrapAnalysisRun.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    await api.dispose();
  });
});
