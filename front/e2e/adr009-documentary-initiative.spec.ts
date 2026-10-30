import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5188';
const evidenceDir = resolve(process.cwd(), '..', 'artifacts', 'e2e-goal', 'P12-R1', 'adr009', 'screenshots');

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerLead(api: APIRequestContext) {
  const stamp = 'visual-acceptance';
  const email = 'adr009.visual@starteria.test';
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: `ADR009 Lead ${stamp}`, role: 'participante' }, failOnStatusCode: false });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({ data: { name: `ADR009 Disposable ${stamp}`, slug: `adr009-${stamp}` } });
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

async function prepareDocumentaryPortfolio(api: APIRequestContext, lead: Awaited<ReturnType<typeof registerLead>>) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: auth, data: {} });
  expect(direct.status(), await direct.text()).toBe(200);
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  const workItemIds = Array.from({ length: 8 }, (_, index) => `adr009-work-${lead.stamp}-${index + 1}`);
  const source = await prisma.portfolioBootstrapWorkIntakeSource.create({ data: { bootstrapSessionId: sessionId, sourceType: 'manual_entry', rawInput: 'Portfolio documental ADR-009', requestHash: `adr009-${lead.stamp}`, createdBy: lead.userId } });
  await prisma.portfolioBootstrapWorkItem.createMany({ data: workItemIds.map((id, index) => ({
    id, bootstrapSessionId: sessionId, sourceId: source.id,
    rawLabel: index === 0 ? 'Onboarding B2B guiado' : `Registro documental ${index + 1}`,
    proposedPurpose: index === 0 ? 'Reducir abandono durante los primeros siete días.' : 'Evidencia documental del portafolio.',
    ownerCandidate: index === 0 ? 'Equipo de Activación' : null,
    sourceType: 'manual_entry', sourceRefs: [{ sheet: 'Iniciativas', row: index + 2 }], createdBy: lead.userId,
  })) });
  const front = await api.post('/api/v1/portfolio/strategic-fronts', { headers: auth, data: { name: 'Activación sostenible', strategicObjective: 'Aumentar activación B2B.' } });
  expect(front.status(), await front.text()).toBe(201);
  const frontId = (await front.json()).data.id as string;
  const challenge = await api.post(`/api/v1/portfolio/strategic-fronts/${frontId}/challenges`, { headers: auth, data: { title: 'Reducir barreras de activación', objective: 'Priorizar la barrera principal.' } });
  expect(challenge.status(), await challenge.text()).toBe(201);
  const challengeId = (await challenge.json()).data.id as string;
  const proposal = await prisma.portfolioOrganizationProposal.create({ data: { bootstrapSessionId: sessionId, organizationId: lead.organizationId, version: 1, status: 'materialized', sourceVersion: `adr009-${lead.stamp}`, payloadHash: `adr009-${lead.stamp}`, payload: {}, sourceRefs: { source: 'e2e' }, provenance: { source: 'HUMAN_CONFIRMED' }, reviewedBy: lead.userId } });
  await prisma.portfolioOrganizationMaterialization.create({ data: {
    proposalId: proposal.id, bootstrapSessionId: sessionId, organizationId: lead.organizationId, proposalVersion: 1,
    approvalFingerprint: `approval-${lead.stamp}`, idempotencyKey: `materialize-${lead.stamp}`,
    canonicalMappings: { challenges: [{ canonicalId: challengeId, relatedInitiativeIds: workItemIds.slice(0, 5) }], specialDestinations: { crossCuttingInitiativeIds: [workItemIds[5]], outsideObjectiveInitiativeIds: [workItemIds[6]], ungroupedInitiativeIds: [workItemIds[7]] } },
    confirmedBy: lead.userId,
  } });
  return { sessionId, challengeId, workItemIds };
}

async function createConfirmedBrief(api: APIRequestContext, token: string, challengeId: string, suffix: string) {
  const created = await api.post(`/api/v1/portfolio/challenges/${challengeId}/activation-briefs`, { headers: { ...bearer(token), 'Idempotency-Key': `adr009-brief-${suffix}` }, data: {
    intent: `Resultado ${suffix}: reducir abandono.`, scope: `Contexto exacto ${suffix}.`, strategicContextRefs: { objective: 'Aumentar activación.' },
    inheritedContext: { challengeProblem: 'No sabemos qué barrera explica el abandono inicial.', expectedDeliverable: `Recomendación ${suffix} con evidencia.`, decisionToEnable: `Decisión ${suffix}.`, horizon: null },
    constraintsSnapshot: ['Revisión legal'], knownGaps: ['Falta línea base'], sourceRefs: [{ source: suffix }], provenance: { source: 'PL05_COPILOT' },
  } });
  expect(created.status(), await created.text()).toBe(201);
  const brief = (await created.json()).data.brief;
  const version = brief.versions[0];
  const confirmed = await api.post(`/api/v1/portfolio/activation-brief-versions/${version.id}/confirm`, { headers: { ...bearer(token), 'Idempotency-Key': `adr009-confirm-${suffix}` }, data: {} });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return { briefId: brief.id as string, briefVersionId: version.id as string };
}

test.describe('ADR-009 documentary initiative to CREATED Assignment', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('imports, human-confirms, assigns and re-enters with exact durable identities', async ({ page }) => {
    await mkdir(evidenceDir, { recursive: true });
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api);
    const { sessionId, challengeId, workItemIds } = await prepareDocumentaryPortfolio(api, lead);
    const exact = await createConfirmedBrief(api, lead.token, challengeId, 'A');
    await createConfirmedBrief(api, lead.token, challengeId, 'B');
    const existingProject = await prisma.project.create({
      data: {
        id: 'adr009-preexisting-project',
        name: 'Iniciativa canónica preexistente',
        ownerId: lead.userId,
        organizationId: lead.organizationId,
        currentStep: 2,
        status: 'IN_PROGRESS',
      },
    });
    await prisma.initiativePortfolioMeta.create({
      data: { projectId: existingProject.id, challengeId, currentStep: 'Step 2', status: 'en_step_2', teamOwner: lead.email },
    });
    const canonicalCountAtEntry = await prisma.project.count({ where: { organizationId: lead.organizationId } });

    await loginUi(page, lead);
    const query = new URLSearchParams({ stage: 'assignment', challengeId, briefId: exact.briefId, briefVersionId: exact.briefVersionId, challengeName: 'Reducir barreras de activación' });
    await page.goto(`/portfolio/inicio?${query.toString()}`);
    const preparation = page.getByTestId('pl06a-assignment-preparation');
    await expect(preparation).toHaveAttribute('data-brief-version-id', exact.briefVersionId);
    const primary = preparation.getByRole('button', { name: 'Agregar asignación' });
    await expect(primary).toBeVisible();
    primary.focus();
    await expect(primary).toBeFocused();
    await page.keyboard.press('Enter');
    await preparation.getByRole('button', { name: 'Continuar una iniciativa existente' }).click();
    await expect(preparation.getByRole('heading', { name: 'Elige una iniciativa existente' })).toBeVisible();
    await preparation.getByRole('button', { name: 'Revisar iniciativa documental Onboarding B2B guiado' }).click();
    await expect(preparation.getByRole('region', { name: 'Revisión de iniciativa documental' })).toContainText('Iniciativas, fila 2');
    expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(canonicalCountAtEntry);
    expect(await prisma.portfolioImportedInitiativeLink.count({ where: { organizationId: lead.organizationId } })).toBe(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: resolve(evidenceDir, 'adr009-01-documentary-review-1440.png'), fullPage: true });
    await preparation.getByRole('button', { name: 'Incorporar como iniciativa existente' }).click();
    await expect(preparation.getByText(/Project con responsable operativo pendiente.*cero Steps/i)).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, 'adr009-02-human-confirmation-1440.png'), fullPage: true });
    await preparation.getByRole('button', { name: 'Confirmar incorporación' }).click();
    await expect(preparation.getByRole('heading', { name: 'Asigna responsable y equipo' })).toBeVisible();
    await expect(preparation.getByText(/responsable operativo pendiente/i)).toBeVisible();

    const link = await prisma.portfolioImportedInitiativeLink.findFirstOrThrow({ where: { organizationId: lead.organizationId, workItemId: workItemIds[0], status: 'ACTIVE' } });
    const project = await prisma.project.findUniqueOrThrow({ where: { id: link.projectId }, include: { steps: true, teamMembers: true, initiativeCycles: true, portfolioMeta: true } });
    expect(project).toMatchObject({ ownerId: null, organizationId: lead.organizationId, origin: 'imported', activationStatus: 'OWNER_PENDING', retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT' });
    expect(project.steps).toHaveLength(0);
    expect(project.teamMembers).toHaveLength(0);
    expect(project.initiativeCycles).toHaveLength(0);
    expect(project.portfolioMeta).toEqual([expect.objectContaining({ challengeId, status: 'pending_retroactive_assessment' })]);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { initiativeId: project.id } })).toBe(0);

    await preparation.getByLabel('Persona responsable').fill('responsable.previsto@starteria.test');
    await preparation.getByLabel('Colaborador 1').fill('colaborador.one@starteria.test');
    await preparation.getByLabel('Colaborador 2').fill('colaborador.two@starteria.test');
    await preparation.getByLabel('Adjuntar también este Brief confirmado').check();
    await preparation.getByLabel('Contexto específico del encargo').fill('Conservar evidencia importada y validar gaps antes de activar Steps.');
    await preparation.getByRole('button', { name: 'Revisar asignación' }).click();
    await expect(preparation.getByRole('heading', { name: 'Revisa este encargo' })).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, 'adr009-03-assignment-review-1440.png'), fullPage: true });
    const assignmentCreated = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes(`/api/v1/portfolio/challenges/${challengeId}/handoff-assignments`),
    );
    await preparation.getByRole('button', { name: 'Guardar asignación' }).click();
    expect((await assignmentCreated).status()).toBe(201);
    await expect(preparation.getByRole('region', { name: 'Bandeja de asignaciones' }).getByText('Preparada, aún no enviada')).toBeVisible();

    const recoveredAssignments = await api.get(`/api/v1/portfolio/challenges/${challengeId}/handoff-assignments`, {
      headers: bearer(lead.token),
      failOnStatusCode: false,
    });
    expect(recoveredAssignments.status(), await recoveredAssignments.text()).toBe(200);
    const recoveredAssignment = ((await recoveredAssignments.json()).data as Array<{ id: string; invitedEmailNormalized: string }>).find(
      (candidate) => candidate.invitedEmailNormalized === 'responsable.previsto@starteria.test',
    );
    expect(recoveredAssignment).toBeDefined();
    const assignment = await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: recoveredAssignment!.id }, include: { members: true } });
    expect(assignment).toMatchObject({ organizationId: lead.organizationId, state: 'CREATED', targetKind: 'EXISTING_INITIATIVE', challengeId, initiativeId: project.id, briefVersionId: exact.briefVersionId, invitedEmailNormalized: 'responsable.previsto@starteria.test' });
    expect(assignment.members).toHaveLength(3);
    expect(await prisma.step.count({ where: { projectId: project.id } })).toBe(0);
    expect(await prisma.portfolioHandoffInvitation.count({ where: { assignmentId: assignment.id } })).toBe(0);
    expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: assignment.id } })).toBe(0);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId, state: { not: 'CREATED' } } })).toBe(0);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
      await page.setViewportSize(viewport);
      await preparation.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: resolve(evidenceDir, `adr009-04-created-${viewport.width}.png`), fullPage: true });
    }

    const identitiesBefore = { projectId: project.id, linkId: link.id, assignmentId: assignment.id };
    await page.reload();
    await expect(page.getByTestId('pl06a-assignment-preparation')).toContainText('responsable.previsto@starteria.test', { timeout: 20_000 });
    const reloadedLink = await prisma.portfolioImportedInitiativeLink.findFirstOrThrow({ where: { workItemId: workItemIds[0], status: 'ACTIVE' } });
    const reloadedAssignment = await prisma.portfolioHandoffAssignment.findFirstOrThrow({ where: { organizationId: lead.organizationId, initiativeId: project.id } });
    expect({ projectId: reloadedLink.projectId, linkId: reloadedLink.id, assignmentId: reloadedAssignment.id }).toEqual(identitiesBefore);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: resolve(evidenceDir, 'adr009-05-reentry-1440.png'), fullPage: true });

    const canonicalCountBeforeLink = await prisma.project.count({ where: { organizationId: lead.organizationId } });
    await page.getByRole('button', { name: /Agregar (otra )?asignación/ }).click();
    await preparation.getByRole('button', { name: 'Continuar una iniciativa existente' }).click();
    await preparation.getByRole('button', { name: 'Revisar iniciativa documental Registro documental 2' }).click();
    await preparation.getByRole('button', { name: 'Vincular a iniciativa existente' }).click();
    await preparation.getByLabel('Project canónico para vincular').selectOption(existingProject.id);
    const linkCreated = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes(`/api/v1/portfolio/challenges/${challengeId}/imported-initiatives/${workItemIds[1]}/link`),
    );
    await preparation.getByRole('button', { name: 'Confirmar vínculo' }).click();
    expect((await linkCreated).status()).toBe(201);
    await expect(preparation.getByRole('heading', { name: 'Asigna responsable y equipo' })).toBeVisible();
    await preparation.getByRole('button', { name: 'Cancelar' }).click();

    const linked = await prisma.portfolioImportedInitiativeLink.findFirstOrThrow({ where: { workItemId: workItemIds[1], status: 'ACTIVE' } });
    expect(linked.projectId).toBe(existingProject.id);
    expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(canonicalCountBeforeLink);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: existingProject.id } })).toMatchObject({
      ownerId: lead.userId,
      currentStep: 2,
      status: 'IN_PROGRESS',
    });
    expect(await prisma.portfolioHandoffAssignment.count({ where: { initiativeId: existingProject.id } })).toBe(0);

    const linkedWorkItem = await prisma.portfolioBootstrapWorkItem.findUniqueOrThrow({ where: { id: workItemIds[1] } });
    const idempotentRetry = await api.post(`/api/v1/portfolio/challenges/${challengeId}/imported-initiatives/${workItemIds[1]}/link`, {
      headers: { ...bearer(lead.token), 'Idempotency-Key': 'adr009-link-retry-e2e' },
      data: {
        expectedWorkItemUpdatedAt: linkedWorkItem.updatedAt.toISOString(),
        identityConfirmed: true,
        alignmentConfirmed: true,
        projectId: existingProject.id,
      },
      failOnStatusCode: false,
    });
    expect(idempotentRetry.status(), await idempotentRetry.text()).toBe(200);
    expect((await idempotentRetry.json()).data).toMatchObject({ idempotent: true, project: { id: existingProject.id }, link: { id: linked.id } });

    await page.getByRole('button', { name: /Agregar (otra )?asignación/ }).click();
    await preparation.getByRole('button', { name: 'Continuar una iniciativa existente' }).click();
    await preparation.getByRole('button', { name: 'Revisar iniciativa documental Registro documental 3' }).click();
    await preparation.getByRole('button', { name: 'Volver' }).click();
    await preparation.getByRole('button', { name: 'Cancelar' }).click();
    expect(await prisma.portfolioImportedInitiativeLink.count({ where: { workItemId: workItemIds[2] } })).toBe(0);

    await page.getByRole('button', { name: /Agregar (otra )?asignación/ }).click();
    await preparation.getByRole('button', { name: 'Continuar una iniciativa existente' }).click();
    await preparation.getByRole('button', { name: 'Revisar iniciativa documental Registro documental 4' }).click();
    await preparation.getByRole('button', { name: 'Incorporar como iniciativa existente' }).click();
    const abandonedRegistration = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes(`/api/v1/portfolio/challenges/${challengeId}/imported-initiatives/${workItemIds[3]}/register`),
    );
    await preparation.getByRole('button', { name: 'Confirmar incorporación' }).click();
    expect((await abandonedRegistration).status()).toBe(201);
    await expect(preparation.getByRole('heading', { name: 'Asigna responsable y equipo' })).toBeVisible();
    await preparation.getByRole('button', { name: 'Cancelar' }).click();
    const abandonedLink = await prisma.portfolioImportedInitiativeLink.findFirstOrThrow({ where: { workItemId: workItemIds[3], status: 'ACTIVE' } });
    expect(await prisma.project.findUnique({ where: { id: abandonedLink.projectId } })).toMatchObject({ ownerId: null, activationStatus: 'OWNER_PENDING' });
    expect(await prisma.portfolioHandoffAssignment.count({ where: { initiativeId: abandonedLink.projectId } })).toBe(0);
    await page.screenshot({ path: resolve(evidenceDir, 'adr009-06-link-and-abandon-1440.png'), fullPage: true });
    await writeFile(resolve(evidenceDir, '..', 'scenario-evidence.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      database: 'starteria_e2e@127.0.0.1:55439 (disposable)',
      visualAccess: { url: `${baseURL}/auth`, email: lead.email, password: lead.password },
      identities: {
        organizationId: lead.organizationId,
        bootstrapSessionId: sessionId,
        challengeId,
        briefId: exact.briefId,
        briefVersionId: exact.briefVersionId,
        registeredWorkItemId: workItemIds[0],
        registeredProjectId: project.id,
        registeredLinkId: link.id,
        assignmentId: assignment.id,
        linkedWorkItemId: workItemIds[1],
        linkedProjectId: linked.projectId,
        linkedLineageId: linked.id,
        abandonedWorkItemId: workItemIds[3],
        abandonedProjectId: abandonedLink.projectId,
        abandonedLineageId: abandonedLink.id,
      },
      invariants: {
        assignmentState: assignment.state,
        assignmentTargetKind: assignment.targetKind,
        assignmentMemberCount: assignment.members.length,
        registeredProjectStepCount: await prisma.step.count({ where: { projectId: project.id } }),
        assignmentInvitationCount: await prisma.portfolioHandoffInvitation.count({ where: { assignmentId: assignment.id } }),
        assignmentDeliveryAttemptCount: await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: assignment.id } }),
        linkedProjectOwnerId: lead.userId,
        linkedProjectCurrentStep: 2,
        cancelledReviewLinkCount: await prisma.portfolioImportedInitiativeLink.count({ where: { workItemId: workItemIds[2] } }),
        abandonedAssignmentCount: await prisma.portfolioHandoffAssignment.count({ where: { initiativeId: abandonedLink.projectId } }),
      },
    }, null, 2), 'utf8');
    await api.dispose();
  });
});
