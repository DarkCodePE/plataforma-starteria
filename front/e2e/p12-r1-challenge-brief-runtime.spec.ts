import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';
const evidenceDir = resolve(process.cwd(), '..', 'artifacts', 'e2e-goal', 'P12-R1', 'pl05-brief');

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerLead(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `pl05-runtime-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: `PL-05 runtime ${stamp}`, role: 'participante' }, failOnStatusCode: false });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({ data: { name: `PL-05 runtime ${stamp}`, slug: `pl05-runtime-${stamp}` } });
  await prisma.user.update({ where: { id: userId }, data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true } });
  await prisma.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'owner' } });
  await prisma.organizationPortfolioAccessGrant.createMany({ data: ['portfolio:read', 'portfolio:write'].map((capability) => ({ userId, organizationId: organization.id, capability })) });
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
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

async function prepareConfirmedOrganization(api: APIRequestContext, lead: Awaited<ReturnType<typeof registerLead>>) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: auth, data: {}, failOnStatusCode: false });
  expect(direct.status(), await direct.text()).toBe(200);
  const directData = (await direct.json()).data;
  const sessionId = directData.bootstrapSession.id as string;
  await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, { headers: auth, data: {
    contextSummary: 'La organización necesita reducir la fricción de activación sin perder trazabilidad.',
    outcomeStatement: 'Aumentar la activación de clientes B2B.',
    decisionToEnable: 'Decidir qué barrera de activación abordar primero.',
    businessSignalStatus: 'confirmed', businessSignalValue: 'Activación a 30 días.',
  } }).then(async (response) => expect(response.status(), await response.text()).toBe(200));
  await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, { headers: auth, data: {} }).then(async (response) => expect(response.status(), await response.text()).toBe(200));
  const added = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/work-items/manual`, { headers: auth, data: { label: 'Onboarding guiado', purpose: 'Reducir fricción durante la activación.', currentStateHint: 'active' } });
  expect(added.status(), await added.text()).toBe(200);
  const workItemId = ((await added.json()).data.items as Array<{ id: string; rawLabel: string }>).find((item) => item.rawLabel === 'Onboarding guiado')!.id;

  const front = await api.post('/api/v1/portfolio/strategic-fronts', { headers: auth, data: { name: 'Activación B2B sostenible', strategicObjective: 'Aumentar activación sin incrementar riesgo operativo.' } });
  expect(front.status(), await front.text()).toBe(201);
  const frontId = (await front.json()).data.id as string;
  const challenge = await api.post(`/api/v1/portfolio/strategic-fronts/${frontId}/challenges`, { headers: auth, data: { title: 'Reducir barreras de activación', objective: 'Entender y priorizar la principal barrera.', constraints: 'Mantener revisión legal.', openQuestions: 'La línea base todavía no es comparable.' } });
  expect(challenge.status(), await challenge.text()).toBe(201);
  const challengeId = (await challenge.json()).data.id as string;
  const frontCandidateId = `front-${lead.stamp}`;
  const challengeCandidateId = `challenge-${lead.stamp}`;
  const payload = {
    summary: 'Organización revisada para preparar el Brief.',
    fronts: [{ candidateId: frontCandidateId, name: 'Activación B2B sostenible', focus: 'Aumentar activación sin incrementar riesgo operativo.', rationale: 'Agrupa decisiones sobre la misma señal de negocio.', coverage: '1 de 1', challenges: [{ candidateId: challengeCandidateId, title: 'Reducir barreras de activación', problem: 'No sabemos qué barrera interrumpe la activación.', rationale: 'Permite priorizar una intervención sustentada.', relatedInitiativeIds: [workItemId], evidence: ['Registro manual: Onboarding guiado'], gaps: ['La línea base todavía no es comparable.'], overlaps: [] }] }],
    crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [],
  };
  const proposal = await prisma.portfolioOrganizationProposal.create({ data: { bootstrapSessionId: sessionId, organizationId: lead.organizationId, version: 1, status: 'materialized', sourceVersion: `pl05-runtime-${lead.stamp}`, payloadHash: `pl05-${lead.stamp}`, payload, sourceRefs: { source: 'runtime' }, provenance: { source: 'HUMAN_CONFIRMED' }, reviewedBy: lead.userId } });
  await prisma.portfolioOrganizationMaterialization.create({ data: { proposalId: proposal.id, bootstrapSessionId: sessionId, organizationId: lead.organizationId, proposalVersion: 1, approvalFingerprint: `approval-${lead.stamp}`, idempotencyKey: `materialize-${lead.stamp}`, canonicalMappings: { fronts: [{ candidateId: frontCandidateId, canonicalId: frontId }], challenges: [{ candidateId: challengeCandidateId, canonicalId: challengeId, relatedInitiativeIds: [workItemId] }], specialDestinations: { crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [] } }, confirmedBy: lead.userId } });
  return { challengeId };
}

test.describe('P12-R1 PL-05 ChallengeActivationBrief runtime', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('Copilot prepares, versions, confirms and re-enters a Brief without creating PL-06/Core entities', async ({ page }) => {
    await mkdir(evidenceDir, { recursive: true });
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api);
    const { challengeId } = await prepareConfirmedOrganization(api, lead);
    const before = { assignments: await prisma.portfolioHandoffAssignment.count(), invitations: await prisma.portfolioHandoffInvitation.count(), initiatives: await prisma.project.count(), steps: await prisma.step.count() };

    await loginUi(page, lead);
    await expect(page.getByText(/Configurar con Copilot · 6 de 7/)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('pl05-brief-boundary').getByRole('button', { name: 'Preparar primer Brief' }).click();
    let panel = page.getByTestId('challenge-activation-brief-panel');
    await expect(panel.getByRole('heading', { name: 'Prepara el Brief que recibirá tu equipo' })).toBeVisible();
    await expect(panel.getByText('Propuesta sin guardar', { exact: true })).toBeVisible();
    const inheritedContextSummary = panel.locator('summary');
    await expect(inheritedContextSummary).toContainText('Lo que Startería ya recuperó');
    await inheritedContextSummary.focus();
    await page.keyboard.press('Enter');
    await expect(panel.getByText('Aumentar la activación de clientes B2B.', { exact: true })).toBeVisible();
    await expect(panel.getByText('Registro manual: Onboarding guiado', { exact: true })).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.setViewportSize({ width: 1440, height: 900 });
    await panel.getByRole('heading', { name: 'Prepara el Brief que recibirá tu equipo' }).evaluate((heading) => {
      heading.scrollIntoView({ block: 'start' });
      let scrollParent = heading.parentElement;
      while (scrollParent) {
        const style = window.getComputedStyle(scrollParent);
        if (/(auto|scroll)/.test(style.overflowY) && scrollParent.scrollHeight > scrollParent.clientHeight) {
          scrollParent.scrollBy({ top: -88 });
          break;
        }
        scrollParent = scrollParent.parentElement;
      }
    });
    await page.screenshot({ path: resolve(evidenceDir, 'pl05-hva-after-editor-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl05-hva-after-editor-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await panel.getByLabel('Qué buscamos conseguir').fill('Mandato A confirmado');
    await panel.getByLabel('Qué esperamos que entregue').fill('Recomendación A priorizada con evidencia.');
    await panel.getByRole('button', { name: 'Guardar borrador' }).click();
    await panel.getByRole('button', { name: 'Confirmar esta versión' }).click();
    await expect(panel.getByText('Versión 1 confirmada', { exact: true })).toBeVisible();
    const briefA = await prisma.challengeActivationBrief.findFirstOrThrow({ where: { challengeId }, include: { versions: true } });
    const versionA = briefA.versions[0];

    await page.getByTestId('pl05-brief-boundary').getByRole('button', { name: 'Preparar nuevo Brief' }).click();
    panel = page.getByTestId('challenge-activation-brief-panel');
    await expect(panel).toHaveAttribute('data-brief-id', 'new');
    await panel.getByLabel('Qué buscamos conseguir').fill('Mandato B en revisión');
    await panel.getByLabel('Qué esperamos que entregue').fill('Recomendación B priorizada con evidencia.');
    await panel.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByTestId('pl05-brief-boundary').getByText('2 Briefs · 1 confirmado · 1 borrador', { exact: true })).toBeVisible();
    const briefs = await prisma.challengeActivationBrief.findMany({ where: { challengeId }, include: { versions: true } });
    const briefB = briefs.find((brief) => brief.id !== briefA.id)!;
    const versionB = briefB.versions[0];
    expect(briefB.id).toBeTruthy();

    await page.getByRole('button', { name: 'Abrir Brief: Mandato A confirmado' }).click();
    panel = page.getByTestId('challenge-activation-brief-panel');
    await expect(panel).toHaveAttribute('data-brief-id', briefA.id);
    await expect(panel.getByText('Versión 1 confirmada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir Brief: Mandato B en revisión' }).click();
    panel = page.getByTestId('challenge-activation-brief-panel');
    await expect(panel).toHaveAttribute('data-brief-id', briefB.id);
    await expect(panel.getByText(/Borrador guardado.*Versión 1/)).toBeVisible();
    await panel.getByRole('button', { name: 'Confirmar esta versión' }).click();
    await expect(page.getByTestId('pl05-brief-boundary').getByText('2 Briefs · 2 confirmados · 0 borradores', { exact: true })).toBeVisible();
    expect(await prisma.challengeActivationBriefVersion.findUniqueOrThrow({ where: { id: versionA.id }, select: { briefId: true, status: true } })).toEqual({ briefId: briefA.id, status: 'CONFIRMED' });
    expect(await prisma.challengeActivationBriefVersion.findUniqueOrThrow({ where: { id: versionB.id }, select: { briefId: true, status: true } })).toEqual({ briefId: briefB.id, status: 'CONFIRMED' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId('brief-summary-challenge-' + lead.stamp).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl05-hva-after-multi-brief-desktop.png') });
    await page.reload();
    await expect(page.getByText(/Configurar con Copilot · 6 de 7/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('2 Briefs · 2 confirmados · 0 borradores', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir Brief: Mandato A confirmado' }).click();
    panel = page.getByTestId('challenge-activation-brief-panel');
    await expect(panel).toHaveAttribute('data-brief-id', briefA.id);
    await expect(panel.getByText('Brief confirmado', { exact: true })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Listo para preparar la asignación' })).toBeVisible();
    await expect(panel.getByText(/El siguiente paso es elegir quién recibirá este encargo/i)).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Continuar a asignación' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Revisar en nueva versión' })).toBeEnabled();
    await expect(panel.getByText(/PL-06 habilitado/i)).toHaveCount(0);
    const assignmentStage = page.getByRole('button', { name: /7 Asignación/ });
    await expect(assignmentStage).toBeDisabled();
    await expect(assignmentStage).toContainText('Disponible al continuar desde una versión de Brief confirmada');

    await page.setViewportSize({ width: 1440, height: 900 });
    await panel.getByTestId('pl06-boundary-enabled').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl05-hva-continuity-after-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByTestId('pl06-boundary-enabled').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl05-hva-continuity-after-mobile.png'), fullPage: true });
    await page.getByLabel('Tu avance').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl05-hva-continuity-progress-mobile.png'), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Abrir Brief: Mandato B en revisión' }).click();
    await expect(page.getByTestId('challenge-activation-brief-panel')).toHaveAttribute('data-brief-id', briefB.id);
    expect((await prisma.challengeActivationBriefVersion.findUniqueOrThrow({ where: { id: versionA.id } })).briefId).toBe(briefA.id);
    expect((await prisma.challengeActivationBriefVersion.findUniqueOrThrow({ where: { id: versionB.id } })).briefId).toBe(briefB.id);
    await expect(page.getByRole('button', { name: /7 Asignación/ })).toBeDisabled();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('brief-collection-challenge-' + lead.stamp).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl05-hva-after-multi-brief-mobile.png'), fullPage: true });
    expect(await prisma.portfolioHandoffAssignment.count()).toBe(before.assignments);
    expect(await prisma.portfolioHandoffInvitation.count()).toBe(before.invitations);
    expect(await prisma.project.count()).toBe(before.initiatives);
    expect(await prisma.step.count()).toBe(before.steps);
    await api.dispose();
  });
});
