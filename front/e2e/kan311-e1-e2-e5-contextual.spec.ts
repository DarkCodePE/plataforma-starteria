import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

type Lead = Awaited<ReturnType<typeof registerLead>>;

function accessToken(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? '';
}

async function registerLead(api: APIRequestContext, scenario: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}-${scenario}`;
  const email = `kan311-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-311 ${scenario}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-311 ${scenario} ${stamp}`, slug: `kan311-${stamp}` },
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
  return { email, password, userId, organizationId: organization.id, token: accessToken(await login.json()), stamp };
}

async function loginUi(page: Page, lead: Lead) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
}

async function captureViewports(page: Page, testInfo: TestInfo, stage: string) {
  for (const [label, width, height] of [['mobile', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 1000]] as const) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: testInfo.outputPath(`kan311-${stage}-${label}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function answerGuidedContext(page: Page, value: string) {
  await page.getByLabel('Tu respuesta').fill(value);
  const persisted = page.waitForResponse((response) => response.request().method() === 'PUT'
    && /\/portfolio-bootstrap\/sessions\/[^/]+\/context\/draft$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  expect((await persisted).status()).toBe(200);
}

async function answerObjective(page: Page, value: string) {
  const objective = page.getByTestId('portfolio-objective-conversation');
  await objective.getByLabel('Tu respuesta').fill(value);
  const persisted = page.waitForResponse((response) => response.request().method() === 'PATCH'
    && /\/portfolio-bootstrap\/sessions\/[^/]+\/anchor$/.test(new URL(response.url()).pathname));
  await objective.getByRole('button', { name: 'Enviar respuesta' }).click();
  expect((await persisted).status()).toBe(200);
}

async function prepareConfirmedSession(api: APIRequestContext, lead: Lead, initiativeCount: number) {
  const auth = { Authorization: `Bearer ${lead.token}` };
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: auth, data: {} });
  expect([200, 201]).toContain(direct.status());
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  const context = {
    situation: { value: `${initiativeCount} iniciativas requieren una lectura conjunta.`, provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
    area: { value: null, provenance: 'unknown' },
    stakeholder: { value: null, provenance: 'unknown' },
    pilotExperience: { value: null, provenance: 'unknown' },
    constraints: [], assumptions: [], gaps: ['context-disposition:area:unknown', 'context-disposition:stakeholder:unknown', 'context-disposition:pilotExperience:unknown'],
  };
  const draft = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/draft`, {
    headers: { ...auth, 'Idempotency-Key': `kan311-context-${lead.stamp}` },
    data: { expectedVersion: 0, context, sourceCompanyContext: null },
  });
  expect(draft.status(), await draft.text()).toBe(200);
  const contextConfirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/confirm`, {
    headers: { ...auth, 'Idempotency-Key': `kan311-context-confirm-${lead.stamp}` }, data: { expectedVersion: 1 },
  });
  expect(contextConfirmed.status(), await contextConfirmed.text()).toBe(200);
  const anchor = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
    headers: auth,
    data: {
      contextSummary: `${initiativeCount} iniciativas declaradas por el Portfolio Lead.`,
      outcomeStatement: `Mejorar el resultado del portafolio con ${initiativeCount} iniciativas trazables.`,
      decisionToEnable: 'Elegir qué trabajo priorizar sin inventar evidencia.',
      businessSignalStatus: 'unknown',
      businessSignalValue: null,
    },
  });
  expect(anchor.status(), await anchor.text()).toBe(200);
  const anchorVersion = (await anchor.json()).data.anchor.version as number;
  const anchorConfirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, { headers: auth, data: { expectedVersion: anchorVersion } });
  expect(anchorConfirmed.status(), await anchorConfirmed.text()).toBe(200);
  return sessionId;
}

async function seedAnalyzedWork(lead: Lead, sessionId: string, initiativeCount: number) {
  const source = await prisma.portfolioBootstrapWorkIntakeSource.create({
    data: { bootstrapSessionId: sessionId, sourceType: 'pasted_text', rawInput: `${initiativeCount} iniciativas KAN-311`, requestHash: `kan311-${lead.stamp}`, createdBy: lead.userId },
  });
  await prisma.portfolioBootstrapWorkItem.createMany({
    data: Array.from({ length: initiativeCount }, (_, index) => ({
      id: `kan311-${lead.stamp}-work-${index + 1}`,
      bootstrapSessionId: sessionId,
      sourceId: source.id,
      rawLabel: `Iniciativa ${index + 1}`,
      proposedName: `Iniciativa ${index + 1}`,
      proposedPurpose: `Propósito declarado ${index + 1}`,
      sourceType: 'pasted_text' as const,
      sourceRefs: { line: index + 1 },
      createdBy: lead.userId,
    })),
  });
  await prisma.portfolioBootstrapAnalysisRun.create({
    data: {
      id: `kan311-${lead.stamp}-analysis`, bootstrapSessionId: sessionId, status: 'completed', analyzerMode: 'deterministic',
      inputVersion: `kan311-${initiativeCount}-input`, outputVersion: `kan311-${initiativeCount}-output`, createdBy: lead.userId, completedAt: new Date(),
    },
  });
  await prisma.portfolioBootstrapSession.update({
    where: { id: sessionId }, data: { existingWorkStatus: 'has_work', bootstrapPhase: 'B4_MATERIAL_REVIEW' },
  });
}

async function expectConfirmedAnchor(sessionId: string) {
  const persisted = await prisma.portfolioBootstrapSession.findUniqueOrThrow({
    where: { id: sessionId }, include: { anchor: true },
  });
  expect(persisted).toMatchObject({ status: 'awaiting_work_intake', bootstrapPhase: 'B2_WORK_INTAKE' });
  expect(persisted.anchor).toMatchObject({ status: 'anchor_confirmed', provenanceStatus: 'user_confirmed' });
}

test.describe('KAN-311 E1→E2→E5 contextual journey', () => {
  test.beforeAll(() => {
    expect(process.env.SEMANTIC_E1_ENABLED).toBe('false');
    expect(process.env.PORTFOLIO_ENTRY_RUNTIME_MODE).toBe(process.env.KAN311_EXPECTED_RUNTIME_MODE ?? 'deterministic');
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('cafetería sin equipo completa el flujo, confirma E5 y reentra con procedencia', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    try {
      const lead = await registerLead(api, 'cafeteria');
      await loginUi(page, lead);
      await page.getByRole('button', { name: 'Preparar nueva oportunidad' }).click();
      await expect(page.getByText('Guía estructurada · sin IA de pago')).toBeVisible();
      await captureViewports(page, testInfo, 'e1-cafeteria');

      await answerGuidedContext(page, 'Somos una cafetería pequeña sin equipo de innovación y queremos validar desayunos para oficinas cercanas.');
      await answerGuidedContext(page, 'Preparación y reparto de desayunos.');
      await answerGuidedContext(page, 'La propietaria y las personas que trabajan en oficinas cercanas.');
      const noPilot = page.waitForResponse((response) => response.request().method() === 'PUT'
        && /\/portfolio-bootstrap\/sessions\/[^/]+\/context\/draft$/.test(new URL(response.url()).pathname));
      await page.getByRole('button', { name: 'No aplica en este caso' }).click();
      expect((await noPilot).status()).toBe(200);
      await page.getByRole('button', { name: 'Revisar contexto' }).click();
      const contextConfirm = page.waitForResponse((response) => response.request().method() === 'POST'
        && /\/portfolio-bootstrap\/sessions\/[^/]+\/context\/confirm$/.test(new URL(response.url()).pathname));
      await page.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' }).click();
      expect((await contextConfirm).status()).toBe(200);
      await page.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' }).click();

      const e1Bridge = page.getByRole('region', { name: 'Contexto confirmado en E1' });
      await expect(e1Bridge).toContainText('cafetería pequeña');
      await expect(e1Bridge).toContainText('Declarado por ti');
      await expect(e1Bridge).toContainText('No aplica en este caso');
      await expect(page.getByText('Guía estructurada · sin IA de pago')).toBeVisible();
      await captureViewports(page, testInfo, 'e2-cafeteria');

      await answerObjective(page, 'Validar pedidos recurrentes de desayunos para oficinas cercanas.');
      await answerObjective(page, 'La cafetería necesita validar demanda sin ampliar el local.');
      await answerObjective(page, 'Decidir si invertir en equipamiento y reparto.');
      await answerObjective(page, 'Número de oficinas que repiten pedido cada semana.');
      const objectiveConfirm = page.waitForResponse((response) => response.request().method() === 'POST'
        && /\/portfolio-bootstrap\/sessions\/[^/]+\/anchor\/confirm$/.test(new URL(response.url()).pathname));
      await page.getByRole('button', { name: 'Confirmar este punto de partida y continuar' }).click();
      expect((await objectiveConfirm).status()).toBe(200);
      const confirmedSession = await prisma.portfolioBootstrapSession.findFirstOrThrow({ where: { userId: lead.userId } });
      await expectConfirmedAnchor(confirmedSession.id);
      const continueToE3 = page.getByRole('button', { name: 'Continuar a Incorporación' });
      await expect(continueToE3).toBeVisible();
      await expect(continueToE3).toBeEnabled();
      await continueToE3.click();
      await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible();
      await captureViewports(page, testInfo, 'e3-cafeteria');
      await page.reload();
      await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });
      await expectConfirmedAnchor(confirmedSession.id);

      await page.getByRole('button', { name: 'Todavia no tenemos iniciativas' }).click();
      const noWork = page.waitForResponse((response) => response.request().method() === 'POST'
        && /\/portfolio-bootstrap\/sessions\/[^/]+\/work-items\/none$/.test(new URL(response.url()).pathname));
      await page.getByRole('button', { name: 'Todavia no tenemos iniciativas activas' }).click();
      expect((await noWork).status()).toBe(200);
      await expect(page.getByRole('button', { name: 'Continuar sin iniciativas' })).toBeEnabled();
      await page.getByRole('button', { name: 'Continuar sin iniciativas' }).click();

      const proposal = page.getByTestId('portfolio-organization-proposal');
      await expect(proposal).toBeVisible();
      await expect(page.getByRole('region', { name: 'Procedencia de la propuesta estratégica' })).toContainText('No se han inferido sponsor, KPI, baseline ni área');
      await page.getByText('Editar frente estratégico', { exact: true }).click();
      await page.getByLabel('Horizonte estratégico del frente').fill('2027-12-31');
      await page.getByRole('button', { name: /Revisar propuesta:/ }).click();
      await page.getByRole('button', { name: 'Editar reto' }).click();
      await page.getByLabel('Plazo propio del reto').fill('2027-06-30');
      await page.getByRole('button', { name: 'Aplicar cambios al reto' }).click();
      await captureViewports(page, testInfo, 'e5-cafeteria');

      const confirmOrganization = page.waitForResponse((response) => response.request().method() === 'POST'
        && /\/portfolio-bootstrap\/sessions\/[^/]+\/organization-proposal\/confirm$/.test(new URL(response.url()).pathname));
      await page.getByRole('button', { name: 'Confirmar estructura estratégica' }).click();
      expect((await confirmOrganization).status()).toBe(200);
      await expect(page.getByText('Convertir necesidades en encargos claros')).toBeVisible();

      const canonicalFront = await prisma.strategicFront.findFirstOrThrow({ where: { organizationId: lead.organizationId } });
      expect(canonicalFront).toMatchObject({ horizon: '2027-12-31', sponsor: null, mainKpi: null, baseline: null });
      expect(canonicalFront).not.toHaveProperty('area');
      const canonicalChallenge = await prisma.challenge.findFirstOrThrow({ where: { strategicFrontId: canonicalFront.id } });
      expect(canonicalChallenge.whyNow).toBeNull();
      expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(0);
      expect(await prisma.step.count({ where: { project: { organizationId: lead.organizationId } } })).toBe(0);
      const originalSession = await prisma.portfolioBootstrapSession.findFirstOrThrow({
        where: { organizationId: lead.organizationId, organizationMaterializations: { some: {} } },
        include: { anchor: true },
      });

      await page.reload();
      await expect(page.getByText('Convertir necesidades en encargos claros')).toBeVisible({ timeout: 20_000 });
      expect(await prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(1);

      // Opening an additional front is available only after the prior setup is
      // closed. E6/E7 delivery is already certified by KAN-232; this spec keeps
      // its scope on the KAN-311 contextual creation boundary.
      await prisma.portfolioBootstrapSession.update({
        where: { id: originalSession.id },
        data: { setupCompletedAt: new Date(), setupCompletedByActorId: lead.userId },
      });

      await page.goto('/portfolio/frentes-estrategicos');
      const createFront = page.getByRole('button', { name: 'Crear frente estrategico' });
      await expect(createFront).toBeVisible({ timeout: 20_000 });
      await createFront.click();
      await expect(page.getByRole('dialog', { name: 'Crear un frente estratégico' })).toBeVisible();
      const additionalOpened = page.waitForResponse((response) => response.request().method() === 'POST'
        && new URL(response.url()).pathname.endsWith('/portfolio-bootstrap/sessions/additional-front'));
      await page.getByRole('button', { name: 'Guiarme desde mi necesidad' }).click();
      const additionalResponse = await additionalOpened;
      expect(additionalResponse.status()).toBe(200);
      const additionalSessionId = (await additionalResponse.json()).data.bootstrapSession.id as string;
      expect(additionalSessionId).not.toBe(originalSession.id);
      await expect(page).toHaveURL(new RegExp(`bootstrapSessionId=${additionalSessionId}`));
      await expect(page.getByText('Cuéntame qué está ocurriendo')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByLabel('Tu respuesta')).toHaveValue('');

      const additionalSession = await prisma.portfolioBootstrapSession.findUniqueOrThrow({
        where: { id: additionalSessionId }, include: { anchor: true, contextReview: true, workItems: true },
      });
      expect(additionalSession.anchor).toMatchObject({
        contextSummary: null,
        outcomeStatement: '',
        decisionToEnable: null,
        businessSignalStatus: 'unknown',
        businessSignalValue: null,
        status: 'anchor_insufficient',
      });
      expect(additionalSession.contextReview).toBeNull();
      expect(additionalSession.workItems).toHaveLength(0);
      expect((additionalSession.anchor!.sourceRefs as any).organizationalContextReference).toMatchObject({
        sourceBootstrapSessionId: originalSession.id,
        outcomeStatement: originalSession.anchor!.outcomeStatement,
        reviewStatus: 'reference_only',
      });

      await page.reload();
      await expect(page.getByText('Cuéntame qué está ocurriendo')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByLabel('Tu respuesta')).toHaveValue('');
      expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(2);
      await testInfo.attach('nielsen-h1-h10-kan311.json', {
        body: Buffer.from(JSON.stringify({
          H1: 'avance y modo visibles', H2: 'lenguaje de cafetería y sin jerga interna', H3: 'reentrada persistida',
          H4: 'terminología consistente E1/E2/E5', H5: 'fechas opcionales y no inferidas', H6: 'procedencia visible',
          H7: 'disclosure progresivo', H8: 'edición contextual mínima', H9: 'errores reintentables', H10: 'ayuda junto a cada horizonte',
          humanVisualBaseline: 'required-before-CD',
        }, null, 2)),
        contentType: 'application/json',
      });
    } finally {
      await api.dispose();
    }
  });

  for (const profile of [{ name: 'pyme', count: 3 }, { name: 'corporate', count: 25 }] as const) {
    test(`${profile.name} con ${profile.count} iniciativas persiste E3 y llega a E5 sin inventar campos`, async ({ page }, testInfo) => {
      const api = await pwRequest.newContext({ baseURL });
      try {
        const lead = await registerLead(api, profile.name);
        const sessionId = await prepareConfirmedSession(api, lead, profile.count);
        await loginUi(page, lead);
        await page.getByRole('button', { name: 'Retomar este espacio' }).click();
        await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });
        await expectConfirmedAnchor(sessionId);
        await page.screenshot({ path: testInfo.outputPath(`kan311-e3-${profile.name}-reentry.png`), fullPage: true });
        await page.reload();
        await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });
        await expectConfirmedAnchor(sessionId);

        await seedAnalyzedWork(lead, sessionId, profile.count);
        await page.reload();
        const analyzed = page.waitForResponse((response) => response.request().method() === 'POST'
          && /\/portfolio-bootstrap\/sessions\/[^/]+\/analyze$/.test(new URL(response.url()).pathname));
        await page.getByRole('button', { name: `Analizar ${profile.count} iniciativas` }).click();
        expect((await analyzed).status()).toBe(200);
        await prisma.portfolioBootstrapProposedMutation.updateMany({
          where: { bootstrapSessionId: sessionId },
          data: { status: 'rejected', reviewedBy: lead.userId, reviewedAt: new Date(), reviewNote: 'Revisión humana KAN-311: conservar como no vinculada.' },
        });
        await page.reload();
        await expect(page.getByRole('button', { name: 'Continuar a organización' })).toBeEnabled({ timeout: 20_000 });
        await page.getByRole('button', { name: 'Continuar a organización' }).click();
        const proposal = page.getByTestId('portfolio-organization-proposal');
        await expect(proposal).toContainText(`las ${profile.count} iniciativas revisadas`);
        await expect(page.getByRole('region', { name: 'Procedencia de la propuesta estratégica' })).toContainText(`${profile.count} iniciativas conservando sus fuentes`);
        await expect(page.getByLabel('Horizonte estratégico del frente')).toHaveValue('');
        await expect(proposal).toContainText('KPI / señal');
        await expect(proposal).toContainText('Por confirmar');
        expect(await prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(0);
        await page.screenshot({ path: testInfo.outputPath(`kan311-e5-${profile.name}-provenance.png`), fullPage: true });

        await page.reload();
        await expect(page.getByTestId('portfolio-bootstrap-material-review')).toBeVisible({ timeout: 20_000 });
        expect(await prisma.portfolioBootstrapSession.count({ where: { userId: lead.userId } })).toBe(1);
      } finally {
        await api.dispose();
      }
    });
  }
});
