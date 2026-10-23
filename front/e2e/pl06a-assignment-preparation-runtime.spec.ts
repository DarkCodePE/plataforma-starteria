import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';
const evidenceDir = resolve(process.cwd(), '..', 'artifacts', 'e2e-goal', 'P12-R1', 'pl06a-assignment');

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerLead(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `pl06a-runtime-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: `PL-06A runtime ${stamp}`, role: 'participante' }, failOnStatusCode: false });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({ data: { name: `PL-06A runtime ${stamp}`, slug: `pl06a-runtime-${stamp}` } });
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

async function preparePortfolio(api: APIRequestContext, lead: Awaited<ReturnType<typeof registerLead>>) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: auth, data: {} });
  expect(direct.status(), await direct.text()).toBe(200);
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  const importedIds = Array.from({ length: 8 }, (_, index) => `pl06a-work-${lead.stamp}-${index + 1}`);
  const intake = await prisma.portfolioBootstrapWorkIntakeSource.create({ data: { bootstrapSessionId: sessionId, sourceType: 'manual_entry', rawInput: 'PL-06A coverage fixture', requestHash: `pl06a-coverage-${lead.stamp}`, createdBy: lead.userId } });
  await prisma.portfolioBootstrapWorkItem.createMany({ data: importedIds.map((id, index) => ({ id, bootstrapSessionId: sessionId, sourceId: intake.id, rawLabel: `Registro importado ${index + 1}`, proposedPurpose: index === 0 ? 'Reducir abandono durante el onboarding B2B.' : 'Aportar contexto al reto', currentStateHint: index === 0 ? 'active' : 'candidate', ownerCandidate: index === 0 ? 'Equipo de Activación' : null, sourceType: 'manual_entry', sourceRefs: { row: index + 1 }, createdBy: lead.userId })) });
  await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, { headers: auth, data: { contextSummary: 'Contexto PL-06A', outcomeStatement: 'Aumentar activación B2B.', decisionToEnable: 'Elegir la primera barrera.', businessSignalStatus: 'confirmed', businessSignalValue: 'Activación a 30 días.' } });
  await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, { headers: auth, data: {} });
  const front = await api.post('/api/v1/portfolio/strategic-fronts', { headers: auth, data: { name: 'Activación sostenible', strategicObjective: 'Aumentar activación.' } });
  const frontId = (await front.json()).data.id as string;
  const challenge = await api.post(`/api/v1/portfolio/strategic-fronts/${frontId}/challenges`, { headers: auth, data: { title: 'Reducir barreras de activación', objective: 'Priorizar la barrera principal.', constraints: 'Mantener revisión legal.', openQuestions: 'Falta línea base.' } });
  const challengeId = (await challenge.json()).data.id as string;
  const frontCandidateId = `front-${lead.stamp}`;
  const challengeCandidateId = `challenge-${lead.stamp}`;
  const payload = { summary: 'Organización confirmada.', fronts: [{ candidateId: frontCandidateId, name: 'Activación sostenible', focus: 'Aumentar activación.', rationale: 'Agrupa decisiones.', coverage: '5 registros relacionados', challenges: [{ candidateId: challengeCandidateId, title: 'Reducir barreras de activación', problem: 'No sabemos qué barrera priorizar.', rationale: 'Permite decidir.', relatedInitiativeIds: importedIds.slice(0, 5), evidence: [], gaps: ['Falta línea base.'], overlaps: [] }] }], crossCuttingInitiativeIds: [importedIds[5]], outsideObjectiveInitiativeIds: [importedIds[6]], ungroupedInitiativeIds: [importedIds[7]] };
  const proposal = await prisma.portfolioOrganizationProposal.create({ data: { bootstrapSessionId: sessionId, organizationId: lead.organizationId, version: 1, status: 'materialized', sourceVersion: `pl06a-${lead.stamp}`, payloadHash: `pl06a-${lead.stamp}`, payload, sourceRefs: { source: 'runtime' }, provenance: { source: 'HUMAN_CONFIRMED' }, reviewedBy: lead.userId } });
  await prisma.portfolioOrganizationMaterialization.create({ data: { proposalId: proposal.id, bootstrapSessionId: sessionId, organizationId: lead.organizationId, proposalVersion: 1, approvalFingerprint: `approval-${lead.stamp}`, idempotencyKey: `materialize-${lead.stamp}`, canonicalMappings: { fronts: [{ candidateId: frontCandidateId, canonicalId: frontId }], challenges: [{ candidateId: challengeCandidateId, canonicalId: challengeId, relatedInitiativeIds: importedIds.slice(0, 5) }], specialDestinations: { crossCuttingInitiativeIds: [importedIds[5]], outsideObjectiveInitiativeIds: [importedIds[6]], ungroupedInitiativeIds: [importedIds[7]] } }, confirmedBy: lead.userId } });
  const initiative = await prisma.project.create({ data: { name: 'Onboarding B2B asistido', ownerId: lead.userId } });
  await prisma.initiativePortfolioMeta.create({ data: { projectId: initiative.id, challengeId, teamOwner: lead.email } });
  return { challengeId, initiativeId: initiative.id };
}

async function createConfirmedBrief(api: APIRequestContext, token: string, challengeId: string, suffix: string) {
  const headers = { ...bearer(token), 'Idempotency-Key': `pl06a-create-${suffix}` };
  const created = await api.post(`/api/v1/portfolio/challenges/${challengeId}/activation-briefs`, { headers, data: {
    intent: `Resultado ${suffix}: reducir la barrera prioritaria.`, scope: `Contexto exacto ${suffix}.`,
    strategicContextRefs: { objective: 'Aumentar activación.' }, inheritedContext: { challengeProblem: 'No sabemos qué barrera interrumpe la activación.', expectedDeliverable: `Recomendación ${suffix} con evidencia.`, decisionToEnable: `Decisión ${suffix}: elegir la primera barrera.` },
    constraintsSnapshot: ['Mantener revisión legal.'], knownGaps: ['Falta línea base.'], sourceRefs: [{ source: `runtime-${suffix}` }], provenance: { source: 'PL05_COPILOT' },
  } });
  expect(created.status(), await created.text()).toBe(201);
  const brief = (await created.json()).data.brief;
  const version = brief.versions[0];
  const confirmed = await api.post(`/api/v1/portfolio/activation-brief-versions/${version.id}/confirm`, { headers: { ...bearer(token), 'Idempotency-Key': `pl06a-confirm-${suffix}` }, data: {} });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return { briefId: brief.id as string, briefVersionId: version.id as string };
}

test.describe('P12-R1 PL-06A Assignment preparation runtime', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('continues from the exact confirmed Brief, reviews and prepares CREATED without downstream actions', async ({ page }) => {
    await mkdir(evidenceDir, { recursive: true });
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api);
    const { challengeId, initiativeId } = await preparePortfolio(api, lead);
    const exact = await createConfirmedBrief(api, lead.token, challengeId, 'A');
    await createConfirmedBrief(api, lead.token, challengeId, 'B');
    const before = { assignments: await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId } }), invitations: await prisma.portfolioHandoffInvitation.count(), initiatives: await prisma.project.count(), steps: await prisma.step.count() };

    await loginUi(page, lead);
    const query = new URLSearchParams({ stage: 'assignment', challengeId, briefId: exact.briefId, briefVersionId: exact.briefVersionId, challengeName: 'Reducir barreras de activación' });
    await page.goto(`/portfolio/inicio?${query.toString()}`);
    const preparation = page.getByTestId('pl06a-assignment-preparation');
    await expect(preparation).toHaveAttribute('data-brief-version-id', exact.briefVersionId, { timeout: 20_000 });
    await expect(preparation.getByRole('heading', { name: 'Prepara las asignaciones de este reto' })).toBeVisible();
    await expect(preparation.getByText(/una persona responsable por encargo y hasta dos colaboradores/i)).toBeVisible();
    await expect(preparation.getByText('1 iniciativa asignable sin encargo')).toBeVisible();
    await expect(preparation.getByRole('button', { name: 'Agregar asignación' })).toBeVisible();
    await expect(preparation.getByText('Onboarding B2B asistido')).toHaveCount(0);
    await expect(preparation.getByRole('button', { name: /Revisar y asignar/i })).toHaveCount(0);
    await expect(preparation.getByRole('button', { name: /Vincular a una iniciativa/i })).toHaveCount(0);
    await expect(preparation.getByRole('button', { name: 'Ver contenido del Brief' })).toBeVisible();
    await expect(preparation.getByText('Resultado A: reducir la barrera prioritaria.', { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await preparation.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl06a-initiative-first-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await preparation.getByRole('heading', { name: 'Prepara las asignaciones de este reto' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl06a-initiative-first-390.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const viewport of [{ width: 768, height: 900 }, { width: 360, height: 800 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: resolve(evidenceDir, `pl06a-initiative-first-${viewport.width}.png`), fullPage: true });
    }

    const documentarySummary = preparation.getByText('Información sobre iniciativas documentales');
    await expect(documentarySummary.locator('xpath=..')).not.toHaveAttribute('open', '');
    await documentarySummary.click();
    await expect(preparation.getByText(/5 iniciativas relacionadas identificadas en documentos, por incorporar/i)).toBeVisible();
    await expect(preparation.getByText(/3 registros adicionales.*no se cuentan como relacionados ni asignables/i)).toBeVisible();
    await expect(preparation.getByText(/solo serán asignables cuando exista un Project y una InitiativePortfolioMeta válidos/i)).toBeVisible();
    await documentarySummary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl06a-documentary-note-360.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: resolve(evidenceDir, 'pl06a-documentary-note-desktop.png'), fullPage: true });
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId } })).toBe(before.assignments);
    expect(await prisma.project.count()).toBe(before.initiatives);
    expect(await prisma.step.count()).toBe(before.steps);

    await preparation.getByRole('button', { name: 'Ver contenido del Brief' }).click();
    await expect(preparation.getByText('Resultado A: reducir la barrera prioritaria.', { exact: true })).toBeVisible();
    await expect(preparation.getByText('Resultado B: reducir la barrera prioritaria.', { exact: true })).toHaveCount(0);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId } })).toBe(before.assignments);

    await page.setViewportSize({ width: 1440, height: 900 });
    await preparation.getByRole('button', { name: 'Agregar asignación' }).click();
    await preparation.getByRole('button', { name: 'Continuar una iniciativa existente' }).click();
    await preparation.getByLabel('Iniciativa a continuar').selectOption(initiativeId);
    await expect(preparation.getByRole('heading', { name: 'Asigna responsable y equipo' })).toBeVisible();
    await expect(preparation.getByLabel('Iniciativa a continuar')).toHaveValue(initiativeId);
    await expect(preparation.getByLabel('Persona responsable')).toHaveValue(lead.email);
    await expect(preparation.getByLabel('Adjuntar también este Brief confirmado')).not.toBeChecked();
    await preparation.getByLabel('Adjuntar también este Brief confirmado').check();
    await expect(preparation.getByRole('button', { name: 'Agregar otra asignación' })).toBeDisabled();
    await preparation.getByLabel('Colaborador 1').fill('collaborator.one@starteria.test');
    await preparation.getByLabel('Colaborador 2').fill('collaborator.two@starteria.test');
    await preparation.getByLabel('Contexto específico del encargo').fill('Contrastar primero el abandono observado en onboarding.');
    await preparation.getByRole('button', { name: 'Revisar asignación' }).click();
    await expect(preparation.getByRole('heading', { name: 'Revisa este encargo' })).toBeVisible();
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId } })).toBe(before.assignments);
    await expect(preparation.getByRole('button', { name: /enviar|aceptar|rechazar|iniciar/i })).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: resolve(evidenceDir, 'pl06a-canonical-review-desktop.png'), fullPage: true });
    await preparation.getByRole('button', { name: 'Guardar asignación' }).click();
    await expect(preparation.getByRole('heading', { name: 'Asignaciones preparadas' })).toBeVisible();
    await expect(preparation.getByText('Preparada, aún no enviada')).toBeVisible();
    await expect(preparation.getByText('0 iniciativas asignables sin encargo')).toBeVisible();
    const assignment = await prisma.portfolioHandoffAssignment.findFirstOrThrow({ where: { organizationId: lead.organizationId, initiativeId }, include: { members: true } });
    expect(assignment.state).toBe('CREATED');
    expect(assignment.challengeId).toBe(challengeId);
    expect(assignment.initiativeId).toBe(initiativeId);
    expect(assignment.briefVersionId).toBe(exact.briefVersionId);
    expect(assignment.members.filter((member) => member.role === 'OWNER')).toHaveLength(1);
    expect(assignment.members.filter((member) => member.role === 'EXECUTOR')).toHaveLength(2);
    expect(await prisma.portfolioHandoffInvitation.count()).toBe(before.invitations);
    expect(await prisma.project.count()).toBe(before.initiatives);
    expect(await prisma.step.count()).toBe(before.steps);

    await preparation.getByRole('button', { name: 'Agregar otra asignación' }).click();
    await preparation.getByLabel('Persona responsable').fill('second.owner@starteria.test');
    await preparation.getByRole('button', { name: 'Revisar asignación' }).click();
    await preparation.getByRole('button', { name: 'Guardar asignación' }).click();
    await expect(preparation.getByRole('button', { name: 'Editar asignación para second.owner@starteria.test' })).toBeVisible();
    await expect(preparation.getByText('0 iniciativas asignables sin encargo')).toBeVisible();
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId, briefVersionId: exact.briefVersionId } })).toBe(2);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId, initiativeId } })).toBe(1);
    const assignmentIdsBeforeReentry = (await prisma.portfolioHandoffAssignment.findMany({ where: { organizationId: lead.organizationId }, orderBy: { id: 'asc' }, select: { id: true } })).map((item) => item.id);

    await page.setViewportSize({ width: 1440, height: 900 });
    await preparation.getByRole('heading', { name: 'Asignaciones preparadas' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl06a-prepared-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await preparation.getByRole('heading', { name: 'Asignaciones preparadas' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDir, 'pl06a-prepared-390.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.reload();
    await expect(page.getByTestId('pl06a-assignment-preparation')).toContainText(lead.email, { timeout: 20_000 });
    await expect(page.getByTestId('pl06a-assignment-preparation')).toContainText('second.owner@starteria.test');
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId, briefVersionId: exact.briefVersionId } })).toBe(2);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId, initiativeId } })).toBe(1);
    const assignmentIdsAfterReentry = (await prisma.portfolioHandoffAssignment.findMany({ where: { organizationId: lead.organizationId }, orderBy: { id: 'asc' }, select: { id: true } })).map((item) => item.id);
    expect(assignmentIdsAfterReentry).toEqual(assignmentIdsBeforeReentry);
    await api.dispose();
  });
});
