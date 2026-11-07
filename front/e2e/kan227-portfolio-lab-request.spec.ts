import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerLead(api: APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}-${label}`;
  const email = `kan227-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: `KAN-227 ${label}`, role: 'participante' } });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({ data: { name: `KAN-227 ${stamp}`, slug: `kan227-${stamp}` } });
  await prisma.user.update({ where: { id: userId }, data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true } });
  await prisma.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'owner' } });
  await prisma.organizationPortfolioAccessGrant.createMany({ data: ['portfolio:read', 'portfolio:write'].map((capability) => ({ userId, organizationId: organization.id, capability })) });
  const login = await api.post('/api/v1/auth/login', { data: { email, password } });
  expect(login.status(), await login.text()).toBe(200);
  return { email, password, userId, organizationId: organization.id, token: accessToken(await login.json()), stamp };
}

async function loginUi(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
}

async function confirmedBrief(api: APIRequestContext, lead: Awaited<ReturnType<typeof registerLead>>) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: auth, data: {} });
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, { headers: auth, data: {
    contextSummary: 'Contexto KAN-227 confirmado.', outcomeStatement: 'Aumentar activación B2B.',
    decisionToEnable: 'Elegir la primera barrera.', businessSignalStatus: 'confirmed', businessSignalValue: 'Activación a 30 días.',
  } });
  await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, { headers: auth, data: {} });
  const front = await api.post('/api/v1/portfolio/strategic-fronts', { headers: auth, data: { name: 'Activación sostenible', strategicObjective: 'Aumentar activación.' } });
  expect(front.status(), await front.text()).toBe(201);
  const frontId = (await front.json()).data.id as string;
  const challengeResponse = await api.post(`/api/v1/portfolio/strategic-fronts/${frontId}/challenges`, { headers: auth, data: { title: 'Reducir barreras de activación', objective: 'Priorizar la barrera principal.', constraints: 'Mantener revisión legal.', openQuestions: 'Falta línea base.' } });
  expect(challengeResponse.status(), await challengeResponse.text()).toBe(201);
  const challengeId = (await challengeResponse.json()).data.id as string;
  const frontCandidateId = `front-${lead.stamp}`;
  const challengeCandidateId = `challenge-${lead.stamp}`;
  const proposal = await prisma.portfolioOrganizationProposal.create({ data: {
    bootstrapSessionId: sessionId, organizationId: lead.organizationId, version: 1, status: 'materialized',
    sourceVersion: `kan227-${lead.stamp}`, payloadHash: `kan227-${lead.stamp}`,
    payload: { summary: 'Organización confirmada.', fronts: [{ candidateId: frontCandidateId, name: 'Activación sostenible', focus: 'Aumentar activación.', rationale: 'Agrupa decisiones.', coverage: '0 iniciativas', challenges: [{ candidateId: challengeCandidateId, title: 'Reducir barreras de activación', problem: 'No sabemos qué barrera priorizar.', rationale: 'Permite decidir.', relatedInitiativeIds: [], evidence: [], gaps: ['Falta línea base.'], overlaps: [] }] }], crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [] },
    sourceRefs: { source: 'runtime' }, provenance: { source: 'HUMAN_CONFIRMED' }, reviewedBy: lead.userId,
  } });
  await prisma.portfolioOrganizationMaterialization.create({ data: {
    proposalId: proposal.id, bootstrapSessionId: sessionId, organizationId: lead.organizationId, proposalVersion: 1,
    approvalFingerprint: `approval-${lead.stamp}`, idempotencyKey: `materialize-${lead.stamp}`,
    canonicalMappings: { fronts: [{ candidateId: frontCandidateId, canonicalId: frontId }], challenges: [{ candidateId: challengeCandidateId, canonicalId: challengeId, relatedInitiativeIds: [] }], specialDestinations: { crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [] } }, confirmedBy: lead.userId,
  } });
  const created = await api.post(`/api/v1/portfolio/challenges/${challengeId}/activation-briefs`, { headers: { ...auth, 'Idempotency-Key': `kan227-brief-${lead.stamp}` }, data: {
    intent: 'Reducir la principal barrera de activación.', scope: 'Contrastar onboarding y diagnóstico.',
    inheritedContext: { expectedDeliverable: 'Recomendación priorizada con evidencia.', decisionToEnable: 'Elegir la primera barrera.' },
    constraintsSnapshot: ['Revisión legal'], knownGaps: ['Falta línea base'], sourceRefs: ['E2E KAN-227'], provenance: { source: 'PL05_COPILOT' },
  } });
  expect(created.status(), await created.text()).toBe(201);
  const brief = (await created.json()).data.brief;
  const briefVersionId = brief.versions[0].id as string;
  const confirmed = await api.post(`/api/v1/portfolio/activation-brief-versions/${briefVersionId}/confirm`, { headers: { ...auth, 'Idempotency-Key': `kan227-confirm-${lead.stamp}` }, data: {} });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return { challengeId, briefId: brief.id as string, briefVersionId };
}

test.describe('KAN-227 LAB-UX09 authenticated runtime', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('persiste una sola solicitud owner-scoped, reentra y no finge Assignment/Project/Step ni reunión', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'owner');
    const other = await registerLead(api, 'other');
    const target = await confirmedBrief(api, lead);
    const before = {
      assignments: await prisma.portfolioHandoffAssignment.count(),
      projects: await prisma.project.count(),
      steps: await prisma.step.count(),
    };
    await loginUi(page, lead);
    const query = new URLSearchParams({ stage: 'assignment', ...target, challengeName: 'Reducir barreras de activación' });
    await page.goto(`/portfolio/inicio?${query.toString()}`);
    const panel = page.getByTestId('portfolio-lab-request-panel');
    await expect(panel.getByRole('heading', { name: 'Activa este reto con tu equipo, Startería Lab o ambos' })).toBeVisible({ timeout: 20_000 });
    await panel.getByRole('button', { name: 'Solicitar acompañamiento de Startería Lab' }).click();
    await expect(panel.getByText('Reducir la principal barrera de activación.')).toBeVisible();
    await panel.getByRole('checkbox', { name: /consiento compartir este Brief confirmado/i }).check();
    await panel.getByRole('button', { name: 'Enviar solicitud a Startería Lab' }).click();
    await expect(panel.getByText('Solicitud registrada')).toBeVisible();
    await expect(panel.getByText(/Abrir Calendly no confirma ni registra una reunión/)).toBeVisible();
    const persisted = await prisma.portfolioLabRequest.findMany({ where: { organizationId: lead.organizationId, challengeId: target.challengeId, briefVersionId: target.briefVersionId } });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].status).toBe('REQUESTED');
    await page.reload();
    await expect(panel.getByText('Ya existe una solicitud activa para esta versión confirmada.')).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByText('1 de 3 solicitudes abiertas')).toBeVisible();
    expect(await prisma.portfolioLabRequest.count({ where: { organizationId: lead.organizationId } })).toBe(1);
    const crossTenant = await api.get(`/api/v1/portfolio-lab/requests/${persisted[0].id}`, { headers: bearer(other.token), failOnStatusCode: false });
    expect(crossTenant.status()).toBe(404);
    expect(await prisma.portfolioHandoffAssignment.count()).toBe(before.assignments);
    expect(await prisma.project.count()).toBe(before.projects);
    expect(await prisma.step.count()).toBe(before.steps);
    await api.dispose();
  });
});
