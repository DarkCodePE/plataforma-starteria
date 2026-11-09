import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';
const labRecipients = ['fabio.merino.97@gmail.com', 'orlandokuanb@gmail.com'];

function accessToken(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? '';
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function registerLead(api: APIRequestContext, scenario: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `kan240-${scenario}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-240 ${scenario}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-240 ${scenario} ${stamp}`, slug: `kan240-${scenario}-${stamp}` },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true },
  });
  await prisma.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'owner' } });
  await prisma.organizationPortfolioAccessGrant.createMany({
    data: ['portfolio:read', 'portfolio:write'].map((capability) => ({
      userId, organizationId: organization.id, capability,
    })),
  });
  const login = await api.post('/api/v1/auth/login', {
    data: { email, password }, failOnStatusCode: false,
  });
  expect(login.status(), await login.text()).toBe(200);
  return { email, password, userId, organizationId: organization.id, token: accessToken(await login.json()), stamp };
}

async function loginUi(page: Page, lead: { email: string; password: string }, expectedStep?: number) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
  if (expectedStep) {
    // No Bootstrap session exists yet: start only after a deliberate user click.
    await page.getByRole('button', { name: 'Preparar nueva oportunidad' }).click();
    await expect(page.getByText(`Configurar con Copilot · ${expectedStep} de 7`)).toBeVisible({ timeout: 20_000 });
  } else {
    // The distribuidora already has a persisted unfinished context.
    await page.getByRole('button', { name: 'Retomar este espacio' }).click();
  }
}

async function prepareConfirmedIntake(
  api: APIRequestContext,
  lead: Awaited<ReturnType<typeof registerLead>>,
) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', {
    headers: auth, data: {}, failOnStatusCode: false,
  });
  expect(direct.status(), await direct.text()).toBe(200);
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  const updated = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
    headers: auth,
    data: {
      contextSummary: 'Distribuidora de 35 personas con un MVP de portal de pedidos en uso y pedidos paralelos por WhatsApp.',
      outcomeStatement: 'Decidir el siguiente ciclo para aumentar adopción sin rehacer el MVP.',
      decisionToEnable: 'Elegir qué laguna validar antes de ampliar funcionalidades.',
      businessSignalStatus: 'confirmed',
      businessSignalValue: 'Uso y logs existentes; crecimiento todavía no demostrado.',
    },
    failOnStatusCode: false,
  });
  expect(updated.status(), await updated.text()).toBe(200);
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, {
    headers: auth, data: {}, failOnStatusCode: false,
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return sessionId;
}

async function materializeNoWorkOrganization(
  api: APIRequestContext,
  lead: Awaited<ReturnType<typeof registerLead>>,
  sessionId: string,
) {
  const auth = bearer(lead.token);
  const eligibility = await api.get(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/e5-eligibility`, { headers: auth });
  expect(eligibility.status(), await eligibility.text()).toBe(200);
  expect((await eligibility.json()).data.allowed).toBe(true);
  const saved = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/organization-proposal`, {
    headers: auth,
    data: {
      expectedVersion: 0,
      payload: {
        summary: 'Un reto inicial para validar la demanda sin ampliar el local.',
        fronts: [{
          candidateId: `front-${lead.stamp}`,
          name: 'Nuevos servicios para oficinas cercanas',
          focus: 'Validar demanda antes de invertir.',
          rationale: 'La decisión requiere una prueba acotada y evidencia real.',
          coverage: 'Sin iniciativas existentes',
          challenges: [{
            candidateId: `challenge-${lead.stamp}`,
            title: 'Validar desayunos para oficinas sin ampliar el local',
            problem: 'No sabemos si existe demanda suficiente para este servicio.',
            rationale: 'Permite decidir con evidencia sin inventar un departamento o iniciativa previa.',
            relatedInitiativeIds: [], evidence: [], gaps: ['Falta observar demanda real.'], overlaps: [],
          }],
        }],
        crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [],
      },
    },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  const proposalVersion = (await saved.json()).data.version as number;
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/organization-proposal/confirm`, {
    headers: { ...auth, 'Idempotency-Key': `kan240-materialize-${lead.stamp}` },
    data: { proposalVersion },
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  const mappings = (await confirmed.json()).data.materialization.canonicalMappings;
  return mappings.challenges[0].canonicalId as string;
}

async function confirmBrief(
  api: APIRequestContext,
  lead: Awaited<ReturnType<typeof registerLead>>,
  challengeId: string,
) {
  const auth = bearer(lead.token);
  const created = await api.post(`/api/v1/portfolio/challenges/${challengeId}/activation-briefs`, {
    headers: { ...auth, 'Idempotency-Key': `kan240-brief-${lead.stamp}` },
    data: {
      intent: 'Validar demanda de desayunos para llevar sin ampliar el local.',
      scope: 'Contrastar interés de oficinas cercanas con una prueba acotada.',
      strategicContextRefs: { objective: 'Decidir si merece la pena probar el servicio.' },
      inheritedContext: {
        challengeProblem: 'No sabemos si existe demanda suficiente.',
        expectedDeliverable: 'Recomendación humana con evidencia.',
        decisionToEnable: 'Decidir si realizar una prueba acotada.',
      },
      constraintsSnapshot: ['No ampliar el local.'],
      knownGaps: ['No hay KPI numérico confirmado.'],
      sourceRefs: [{ source: 'KAN-240 delta E2E' }],
      provenance: { source: 'PL05_COPILOT', actorId: lead.userId },
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const brief = (await created.json()).data.brief;
  const briefVersionId = brief.versions[0].id as string;
  const confirmed = await api.post(`/api/v1/portfolio/activation-brief-versions/${briefVersionId}/confirm`, {
    headers: { ...auth, 'Idempotency-Key': `kan240-confirm-brief-${lead.stamp}` }, data: {},
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return { briefId: brief.id as string, briefVersionId };
}

async function requestLabAndComplete(
  api: APIRequestContext,
  lead: Awaited<ReturnType<typeof registerLead>>,
  sessionId: string,
  challengeId: string,
  brief: { briefId: string; briefVersionId: string },
) {
  const requested = await api.post('/api/v1/portfolio-lab/requests', {
    headers: { ...bearer(lead.token), 'Idempotency-Key': `kan240-lab-${lead.stamp}` },
    data: {
      challengeId, briefId: brief.briefId, briefVersionId: brief.briefVersionId,
      consentAccepted: true,
      consentPurpose: 'Compartir este Brief confirmado para solicitar contacto humano de Startería Lab.',
    },
  });
  expect([200, 201]).toContain(requested.status());
  const requestId = (await requested.json()).data.request.id as string;
  await prisma.portfolioLabNotificationAttempt.create({
    data: {
      requestId, actorId: lead.userId, idempotencyKeyHash: `kan240-accepted-${lead.stamp}`,
      payloadHash: `kan240-payload-${lead.stamp}`, status: 'ACCEPTED', acceptedRecipients: labRecipients,
      providerMessageRef: `kan240-smtp-${lead.stamp}`, completedAt: new Date(),
    },
  });
  await prisma.portfolioLabRequest.update({
    where: { id: requestId },
    data: { notificationStatus: 'NOTIFIED', providerMessageRef: `kan240-smtp-${lead.stamp}`, lastNotificationError: null },
  });
  const completed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/complete-setup`, {
    headers: { ...bearer(lead.token), 'Idempotency-Key': `kan240-complete-${lead.stamp}` },
    data: { confirmed: true },
  });
  expect(completed.status(), await completed.text()).toBe(200);
  expect((await completed.json()).data.completionRoute).toBe('LAB_NOTIFIED');
}

test.describe('KAN-240 delta E1→E7 sobre PostgreSQL desechable', () => {
  test.beforeAll(() => {
    expect(process.env.SEMANTIC_E1_ENABLED).toBe('false');
    expect(process.env.PORTFOLIO_ENTRY_RUNTIME_MODE).toBe('deterministic');
    expect(process.env.SMTP_HOST ?? '').toBe('');
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('A · cafetería: reutiliza negación explícita sin repreguntar por el piloto', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'cafeteria');
    await loginUi(page, lead, 1);

    await page.getByLabel('Tu respuesta').fill(
      'Somos una cafetería de 4 personas. Nunca hemos probado desayunos para llevar ni pedidos a oficinas.',
    );
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await page.getByRole('button', { name: 'No aplica en este caso' }).click();
    await page.getByLabel('Tu respuesta').fill(
      'La responsable sería la dueña y comprarían personas de las oficinas cercanas.',
    );
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();

    await expect(page.getByText('Esto ya aparece en lo que contaste')).toBeVisible();
    await expect(page.getByText(/habéis probado algo parecido/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Sí, conservar esta información' }).click();
    await expect(page.getByText(/ya podemos revisar el contexto/i)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('cafeteria-e1-pilot-sourced.png'), fullPage: true });
    expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(0);
    expect(await prisma.step.count()).toBe(0);
    await api.dispose();
  });

  test('C · distribuidora: el MVP y sus logs llegan a E4 sin crear ni aprobar Steps', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'distribuidora');
    const sessionId = await prepareConfirmedIntake(api, lead);
    const projectsBefore = await prisma.project.count({ where: { organizationId: lead.organizationId } });
    const stepsBefore = await prisma.step.count();

    await loginUi(page, lead);
    await expect(page.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Anadir manualmente' }).click();
    await page.getByLabel('Nombre o descripcion breve').fill('MVP de portal de pedidos B2B');
    await page.getByLabel('Que intenta conseguir').fill(
      'Ya tiene uso y logs, mientras algunos clientes continúan enviando pedidos por WhatsApp.',
    );
    await page.getByRole('button', { name: 'Agregar trabajo' }).click();
    await page.getByRole('button', { name: 'Analizar 1 iniciativas' }).click();

    await expect(page.getByTestId('portfolio-bootstrap-material-review')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: testInfo.outputPath('distribuidora-e4-mvp-review.png'), fullPage: true });
    await expect.poll(async () => prisma.portfolioBootstrapSession.findUnique({ where: { id: sessionId } }))
      .toMatchObject({ bootstrapPhase: 'B4_MATERIAL_REVIEW', existingWorkStatus: 'has_work' });
    const persistedWorkItem = await prisma.portfolioBootstrapWorkItem.findFirstOrThrow({
      where: { bootstrapSessionId: sessionId },
    });
    expect(persistedWorkItem).toMatchObject({
      rawLabel: 'MVP de portal de pedidos B2B',
      proposedName: 'MVP de portal de pedidos B2B',
      proposedPurpose: 'Ya tiene uso y logs, mientras algunos clientes continúan enviando pedidos por WhatsApp.',
      sourceType: 'manual_entry',
    });
    expect(await prisma.portfolioBootstrapAnalysisRun.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(projectsBefore);
    expect(await prisma.step.count()).toBe(stepsBefore);
    await expect(page.getByTestId('portfolio-bootstrap-material-review')).toContainText('MVP de portal de pedidos B2B');
    await expect(page.getByTestId('portfolio-bootstrap-material-review')).not.toContainText(/Step aprobado/i);
    await api.dispose();
  });

  test('A · continuidad: la misma sesión alcanza E1→E7 y Home sin repregunta piloto', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'cafeteria-continuidad');
    const projectsBefore = await prisma.project.count({ where: { organizationId: lead.organizationId } });
    const stepsBefore = await prisma.step.count();
    await loginUi(page, lead, 1);
    const session = await prisma.portfolioBootstrapSession.findFirstOrThrow({ where: { userId: lead.userId } });

    await page.getByLabel('Tu respuesta').fill(
      'Somos una cafetería de 4 personas. Nunca hemos probado desayunos para llevar ni pedidos a oficinas.',
    );
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await page.getByRole('button', { name: 'No aplica en este caso' }).click();
    await page.getByLabel('Tu respuesta').fill('La responsable sería la dueña y comprarían personas de oficinas cercanas.');
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await expect(page.getByText('Esto ya aparece en lo que contaste')).toBeVisible();
    await expect(page.getByText(/habéis probado algo parecido/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Sí, conservar esta información' }).click();
    await expect(page.getByText(/ya podemos revisar el contexto/i)).toBeVisible();
    await page.getByRole('button', { name: 'Revisar contexto' }).click();
    await page.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' }).click();
    await page.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' }).click();

    const objectiveAnswers = [
      {
        prompt: /qué resultado de negocio quieres mover/i,
        answer: 'Validar si existe demanda de desayunos para llevar en oficinas cercanas sin ampliar el local.',
      },
      {
        prompt: /qué contexto explica/i,
        answer: 'Somos cuatro personas y todavía no hemos probado ese servicio.',
      },
      {
        prompt: /qué te gustaría poder decidir mejor/i,
        answer: 'Decidir si merece la pena realizar una prueba acotada.',
      },
    ];
    const objectiveConversation = page.getByTestId('portfolio-objective-conversation');
    for (const { prompt, answer } of objectiveAnswers) {
      await expect(objectiveConversation.getByText(prompt)).toBeVisible();
      const response = objectiveConversation.getByLabel('Tu respuesta');
      await response.fill(answer);
      await expect(response).toHaveValue(answer);
      const send = objectiveConversation.getByRole('button', { name: 'Enviar respuesta' });
      await expect(send).toBeEnabled();
      await send.click();
    }
    await expect(objectiveConversation.getByText(/cómo sabrás que el resultado está mejorando/i)).toBeVisible();
    await objectiveConversation.getByRole('button', { name: /No lo s/i }).click();
    await page.getByRole('button', { name: 'Confirmar este punto de partida y continuar' }).click();
    await page.getByRole('button', { name: 'Continuar a Incorporación' }).click();
    await page.getByRole('button', { name: /Todavia no tenemos iniciativas/i }).click();
    await page.getByRole('button', { name: /Todavia no tenemos iniciativas activas/i }).click();
    await page.getByRole('button', { name: 'Continuar sin iniciativas', exact: true }).click();

    const challengeId = await materializeNoWorkOrganization(api, lead, session.id);
    const brief = await confirmBrief(api, lead, challengeId);
    await requestLabAndComplete(api, lead, session.id, challengeId, brief);
    // Completion occurred through the API in this test; the Bootstrap UI has
    // not received a navigation event. Explicitly revisit Inicio to verify
    // the persisted portfolio projection, rather than expecting reload of
    // the still-open Bootstrap route to redirect on its own.
    await page.goto('/portfolio/inicio');
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Brief confirmado', { exact: true })).toBeVisible();
    await expect(page.getByText('Contacto pendiente', { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('cafeteria-e1-e7-home.png'), fullPage: true });
    expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(projectsBefore);
    expect(await prisma.step.count()).toBe(stepsBefore);
    await api.dispose();
  });
});
