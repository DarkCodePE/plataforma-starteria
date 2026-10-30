import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function accessToken(body: any): string {
  return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? '';
}

async function registerLead(api: APIRequestContext) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `pl04-runtime-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `PL-04 runtime ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const registered = await registration.json();
  const userId = registered.data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `PL-04 runtime ${stamp}`, slug: `pl04-runtime-${stamp}` },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: { userId, organizationId: organization.id, role: 'owner' },
  });
  await prisma.organizationPortfolioAccessGrant.createMany({
    data: ['portfolio:read', 'portfolio:write'].map((capability) => ({
      userId, organizationId: organization.id, capability,
    })),
  });
  const login = await api.post('/api/v1/auth/login', {
    data: { email, password }, failOnStatusCode: false,
  });
  expect(login.status(), await login.text()).toBe(200);
  const token = accessToken(await login.json());
  expect(token).toBeTruthy();
  const { cookies } = await api.storageState();
  return { email, password, userId, organizationId: organization.id, token, cookies };
}

async function restoreUiSession(page: Page, lead: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
}

async function prepareReviewedBootstrap(api: APIRequestContext, lead: Awaited<ReturnType<typeof registerLead>>) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', {
    headers: auth, data: {}, failOnStatusCode: false,
  });
  expect(direct.status(), await direct.text()).toBe(200);
  const directData = (await direct.json()).data;
  const sessionId = directData.bootstrapSession.id as string;
  const anchorId = directData.anchor.id as string;

  const anchor = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
    headers: auth,
    data: {
      contextSummary: 'Ocho iniciativas compiten por capacidad y necesitan una organización explicable.',
      outcomeStatement: 'Aumentar la activación y la recurrencia de clientes B2B.',
      decisionToEnable: 'Decidir qué barreras abordar juntas y qué trabajo queda fuera.',
      businessSignalStatus: 'confirmed',
      businessSignalValue: 'Activación a 30 días y recurrencia trimestral.',
    },
    failOnStatusCode: false,
  });
  expect(anchor.status(), await anchor.text()).toBe(200);
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, {
    headers: auth, data: {}, failOnStatusCode: false,
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);

  const labels = [
    'Onboarding guiado', 'Activación en producto', 'Educación contextual',
    'Alertas de abandono', 'Seguimiento de adopción', 'Programa de recurrencia',
    'Migración del CRM', 'Investigación de canales',
  ];
  const workItemIds: string[] = [];
  for (const [index, label] of labels.entries()) {
    const added = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/work-items/manual`, {
      headers: auth,
      data: { label, purpose: `Aportar evidencia de negocio para ${label.toLowerCase()}.`, currentStateHint: index < 5 ? 'active' : 'candidate' },
      failOnStatusCode: false,
    });
    expect(added.status(), await added.text()).toBe(200);
    const items = (await added.json()).data.items as Array<{ id: string; rawLabel: string }>;
    workItemIds.push(items.find((item) => item.rawLabel === label)!.id);
  }

  const analysis = await prisma.portfolioBootstrapAnalysisRun.create({
    data: {
      bootstrapSessionId: sessionId,
      status: 'completed',
      analyzerMode: 'deterministic',
      inputVersion: `pl04-runtime-${sessionId}`,
      outputVersion: 'portfolio-bootstrap-analysis-output-v0.1',
      createdBy: lead.userId,
      completedAt: new Date(),
    },
  });
  for (const [index, workItemId] of workItemIds.slice(0, 7).entries()) {
    const status = index === 6 ? 'out_of_current_priority' : 'confirmed_alignment';
    const mutation = await prisma.portfolioBootstrapProposedMutation.create({
      data: {
        bootstrapSessionId: sessionId,
        analysisRunId: analysis.id,
        targetType: 'strategic_connection',
        targetId: workItemId,
        mutationType: 'link',
        proposedValue: { status },
        originalProposedValue: { status },
        rationale: index === 6
          ? 'La migración habilita datos, pero no mueve directamente el objetivo actual.'
          : 'Contribuye a reducir fricción y sostener la adopción.',
        sourceRefs: { workItemId, anchorId },
        provenanceStatus: 'ai_suggested',
        uncertainty: 'low',
        materiality: 'material',
        confirmationRequired: true,
        status: 'confirmed',
        reviewedBy: lead.userId,
        reviewedAt: new Date(),
      },
    });
    await prisma.portfolioStrategicConnection.create({
      data: {
        bootstrapSessionId: sessionId,
        workItemId,
        anchorId,
        sourceMutationId: mutation.id,
        status,
        rationale: mutation.rationale,
        provenanceStatus: 'user_confirmed',
        sourceRefs: { mutationId: mutation.id },
        confirmedBy: lead.userId,
        confirmedAt: new Date(),
      },
    });
  }
  await prisma.portfolioBootstrapSession.update({
    where: { id: sessionId },
    data: { status: 'awaiting_first_reading', bootstrapPhase: 'B5_FIRST_READING' },
  });
  return { sessionId, workItemIds };
}

test.describe('P12-R1 PL-04 confirmed organization runtime', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('reviews a typed proposal, materializes exactly once, projects it, and stays at the PL-05 boundary', async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api);
    const { sessionId, workItemIds } = await prepareReviewedBootstrap(api, lead);

    await expect.poll(async () => prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(0);
    await expect.poll(async () => prisma.challenge.count({ where: { strategicFront: { organizationId: lead.organizationId } } })).toBe(0);
    const downstreamBefore = await Promise.all([
      prisma.project.count(),
      prisma.portfolioHandoffAssignment.count(),
      prisma.portfolioHandoffInvitation.count(),
      prisma.challengeActivationBrief.count(),
      prisma.challengeActivationBriefVersion.count(),
      prisma.initiativeCycle.count(),
      prisma.adaptiveStepConfiguration.count(),
      prisma.adaptiveStepOutput.count(),
      prisma.cycleStepState.count(),
    ]);

    await restoreUiSession(page, lead);
    await expect(page.getByRole('heading', { name: 'Define la estructura estratégica del objetivo' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Aquí estás definiendo la estructura estratégica con la que darás seguimiento al objetivo.')).toBeVisible();
    const proposal = page.getByTestId('portfolio-organization-proposal');
    await expect(proposal).toBeVisible({ timeout: 20_000 });
    await expect(proposal.getByText(/Startería propone esta organización a partir de las 8 iniciativas revisadas/)).toBeVisible();
    await expect(proposal.getByText('FRENTE ESTRATÉGICO PROPUESTO')).toBeVisible();
    await expect(proposal.getByText('RETO PROPUESTO', { exact: true })).toBeVisible();
    await expect(proposal.getByText('INICIATIVAS EN ESTE RETO')).toBeVisible();
    await expect(proposal.getByText('FRONT CANDIDATE')).toHaveCount(0);
    await expect(proposal.getByText('CHALLENGE CANDIDATE')).toHaveCount(0);
    await expect(proposal.getByText('6 iniciativas', { exact: true })).toBeVisible();
    await expect(proposal.getByText(/Problema o incertidumbre/i)).toBeVisible();
    await expect(proposal.getByText(/Por qué estas iniciativas están juntas/i)).toBeVisible();
    const transition = proposal.getByTestId('front-challenge-transition');
    await expect(transition.getByText('Dentro de este frente Startería identificó 1 reto principal.')).toBeVisible();
    await expect(transition.getByText(/Las iniciativas parecen concentrarse en un único problema principal/)).toBeVisible();
    await expect(transition).toContainText('Objetivo');
    await expect(transition).toContainText('Frente estratégico');
    await expect(transition).toContainText('Reto');
    await expect(transition).toContainText('Iniciativas');
    await expect(proposal.getByText('Posibles solapamientos', { exact: true })).toHaveCount(0);
    await expect(proposal.getByText('Evidencia relevante', { exact: true })).toHaveCount(0);
    await expect(proposal.getByText(/Decisión que ayuda a tomar/i).first()).toBeVisible();
    await expect(proposal.getByText('KPI / señal')).toBeVisible();
    await expect(proposal.getByText('Activación a 30 días y recurrencia trimestral.')).toBeVisible();
    const firstInitiative = proposal.locator('[data-testid^="organization-initiative-"]').first();
    await expect(firstInitiative).toContainText('Relación directa con el objetivo');
    await expect(firstInitiative).toContainText('Etapa no determinada');
    await expect(firstInitiative).toContainText('Estimación basada en la información disponible. No significa que el Step esté aprobado.');
    await expect(firstInitiative).toContainText('Procedencia: Registro manual');
    await expect(firstInitiative).not.toContainText('Posible solapamiento dentro de este reto');
    await expect(proposal.getByText('No se detectan vacíos críticos para organizar este reto.')).toBeVisible();
    await expect(proposal.locator('[data-testid^="challenge-summary-"]')).toContainText('6 iniciativas');
    await expect(proposal.getByRole('heading', { name: 'Apoyo transversal' })).toBeVisible();
    await expect(proposal.getByRole('heading', { name: 'Sin agrupar' })).toBeVisible();
    await expect(proposal.getByRole('heading', { name: 'Fuera del objetivo actual' })).toBeVisible();
    await expect(proposal.getByText('REVISAR UBICACIÓN DE INICIATIVAS')).toHaveCount(0);
    await expect(proposal.getByRole('heading', { name: '¿Qué aporta organizar estas iniciativas?' })).toBeVisible();
    await expect(proposal.getByText(/comparar iniciativas que atacan el mismo problema/i)).toBeVisible();
    await expect(proposal.getByText(/detectar posibles solapamientos/i)).toBeVisible();
    await expect(proposal.getByText(/ver cobertura y gaps/i)).toBeVisible();
    await expect(proposal.getByText(/priorizar dónde dedicar atención y capacidad/i)).toBeVisible();
    await expect(proposal.getByText(/preparar decisiones de Portfolio/i)).toBeVisible();
    await expect(proposal.getByRole('heading', { name: 'Sin organizar' })).toBeVisible();
    await expect(proposal.getByRole('heading', { name: 'Con organización' })).toBeVisible();
    await expect(proposal.getByText(/Las iniciativas siguen disponibles individualmente y no se pierde información/i)).toBeVisible();
    await expect(proposal.getByText(/puedes volver a organizarlas más adelante/i)).toBeVisible();

    const evidenceDirectory = resolve(process.cwd(), '../artifacts/e2e-goal/P12-R1/pl04-agency');
    await mkdir(evidenceDirectory, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('heading', { name: 'Define la estructura estratégica del objetivo' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('heading', { name: 'Define la estructura estratégica del objetivo' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });

    const strategicFront = proposal.locator('[data-testid^="organization-front-"]').first();
    await strategicFront.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-cascade-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await strategicFront.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-cascade-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });

    const challengeGroup = proposal.locator('[data-testid^="organization-challenge-"]').first();
    await challengeGroup.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-challenge-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await challengeGroup.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-challenge-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });

    const reviewProposal = () => proposal.getByRole('button', { name: /^Revisar propuesta:/ }).first();
    await expect(reviewProposal()).toBeVisible();
    await reviewProposal().click();
    const proposalReview = page.getByRole('dialog', { name: 'Revisar propuesta de reto' });
    await expect(proposalReview).toBeVisible();
    await expect(proposalReview.getByRole('button', { name: 'Entender por qué Startería lo propone' })).toBeVisible();
    await expect(proposalReview.getByRole('button', { name: 'Editar reto' })).toBeVisible();
    await expect(proposalReview.getByRole('button', { name: '+ Añadir otro reto' })).toBeVisible();
    await expect(proposalReview.getByRole('button', { name: 'Separar en dos retos' })).toBeVisible();
    await expect(proposalReview.getByRole('button', { name: 'Combinar con otro reto' })).toBeDisabled();
    await expect(proposalReview.getByRole('button', { name: 'Quitar este reto de la propuesta' })).toBeVisible();
    await expect(proposalReview.getByRole('button', { name: 'No estoy de acuerdo con esta propuesta' })).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-review-proposal-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-review-proposal-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });

    await proposalReview.getByRole('button', { name: 'Entender por qué Startería lo propone' }).click();
    await expect(proposalReview.getByRole('heading', { name: 'Por qué Startería propone este reto' })).toBeVisible();
    await expect(proposalReview).toContainText('Patrón detectado');
    await expect(proposalReview).toContainText('Iniciativas que sustentan la propuesta');
    await expect(proposalReview.getByText('Evidencia disponible', { exact: true })).toHaveCount(0);
    await expect(proposalReview).toContainText('Procedencia');
    await expect(proposalReview).toContainText('Vacíos relevantes');
    await expect(proposalReview).toContainText('Decisión que ayuda a tomar');
    await expect(proposalReview).toContainText('Por qué tratarlo como un reto separado');
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-business-rationale-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-business-rationale-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await proposalReview.getByRole('button', { name: 'Volver a opciones de revisión' }).click();
    await proposalReview.getByRole('button', { name: 'Editar reto' }).click();
    await proposalReview.getByLabel('Nombre del reto').fill('Barreras de adopción sostenible');
    await proposalReview.getByLabel('Problema o incertidumbre del reto').fill('La activación se interrumpe antes de producir valor recurrente.');
    await proposalReview.getByLabel('Decisión que ayuda a tomar').fill('Qué barrera de adopción atender primero.');
    await proposalReview.getByRole('button', { name: 'Aplicar cambios al reto' }).click();
    await expect(proposalReview).toHaveCount(0);
    await expect(proposal.getByRole('heading', { name: 'Barreras de adopción sostenible' })).toBeVisible();

    await reviewProposal().click();
    await proposalReview.getByRole('button', { name: '+ Añadir otro reto' }).click();
    await proposalReview.getByLabel('Nombre del nuevo reto').fill('Validar señales de recurrencia');
    await proposalReview.getByLabel('Problema o incertidumbre del nuevo reto').fill('No sabemos qué señal anticipa una recurrencia sostenible.');
    await proposalReview.getByLabel('Decisión que ayudaría a tomar').fill('Qué señal usar para priorizar el seguimiento.');
    await proposalReview.getByRole('checkbox', { name: 'Relacionar Programa de recurrencia' }).check();
    await proposalReview.getByRole('button', { name: 'Añadir reto a la propuesta' }).click();
    await expect(proposal.getByRole('button', { name: /^Revisar propuesta:/ })).toHaveCount(2);
    expect(await prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(0);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId: lead.organizationId } } })).toBe(0);

    await proposal.getByRole('button', { name: 'Revisar propuesta: Validar señales de recurrencia' }).click();
    await proposalReview.getByRole('button', { name: 'Combinar con otro reto' }).click();
    await expect(proposalReview.getByText(/iniciativas, fuentes, gaps y comparaciones/i)).toBeVisible();
    await proposalReview.getByRole('button', { name: 'Combinar retos' }).click();
    await expect(proposal.getByRole('button', { name: /^Revisar propuesta:/ })).toHaveCount(1);

    await reviewProposal().click();
    await proposalReview.getByRole('button', { name: 'Separar en dos retos' }).click();
    const splitReview = page.getByRole('dialog', { name: 'Revisar separación del reto' });
    await expect(splitReview).toBeVisible();
    await expect(splitReview.getByRole('heading', { name: '¿Cuándo puede tener sentido separar este reto?' })).toBeVisible();
    await expect(splitReview).toContainText('No necesitas crear más retos por completar estructura.');
    await expect(splitReview).toContainText('Requieren decisiones diferentes.');
    await expect(splitReview).toContainText('Una parte puede avanzar independientemente de la otra.');
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-guided-split-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-guided-split-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await splitReview.getByRole('button', { name: 'Proponer una separación' }).click();
    await expect(splitReview.getByTestId('challenge-split-preview')).toContainText('Vista previa:');
    await splitReview.getByRole('button', { name: 'Cancelar / volver sin cambios' }).click();
    await expect(splitReview).toHaveCount(0);
    await expect(proposal.getByText('RETO PROPUESTO', { exact: true })).toHaveCount(1);

    await reviewProposal().click();
    await proposalReview.getByRole('button', { name: 'Separar en dos retos' }).click();
    await splitReview.getByRole('button', { name: 'Crear segundo reto' }).click();
    await expect(proposal.getByRole('button', { name: /^Revisar propuesta:/ })).toHaveCount(2);
    await proposal.getByRole('button', { name: /Revisar propuesta: .*segunda hipótesis/i }).click();
    await proposalReview.getByRole('button', { name: 'Quitar este reto de la propuesta' }).click();
    await expect(proposalReview.getByRole('heading', { name: 'Quitar reto de la propuesta' })).toBeVisible();
    await expect(proposalReview).toContainText('No se borrará ninguna iniciativa, fuente, procedencia ni análisis.');
    await proposalReview.getByRole('radio', { name: 'Mantener iniciativas sin agrupar' }).check();
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-safe-remove-1440x900.png') });
    await proposalReview.getByRole('button', { name: 'Quitar reto' }).click();
    await expect(proposal.getByRole('button', { name: /^Revisar propuesta:/ })).toHaveCount(1);
    const ungrouped = proposal.getByRole('heading', { name: 'Sin agrupar' }).locator('xpath=ancestor::section[1]');
    await expect(ungrouped).toContainText('Alertas de abandono');
    await expect(ungrouped).toContainText('Seguimiento de adopción');
    await expect(ungrouped).toContainText('Programa de recurrencia');

    await reviewProposal().click();
    await proposalReview.getByRole('button', { name: 'No estoy de acuerdo con esta propuesta' }).click();
    await expect(proposalReview.getByRole('radio', { name: 'El problema planteado no es correcto.' })).toBeVisible();
    await expect(proposalReview.getByRole('radio', { name: 'Hay más de un problema.' })).toBeVisible();
    await expect(proposalReview.getByRole('radio', { name: 'Estas iniciativas no deberían estar juntas.' })).toBeVisible();
    await expect(proposalReview.getByRole('radio', { name: 'Falta un reto que Startería no detectó.' })).toBeVisible();
    await proposalReview.getByRole('radio', { name: 'Prefiero no organizar todavía.' }).check();
    await proposalReview.getByRole('button', { name: 'Mantener todo sin organizar' }).click();
    const optedOut = proposal.getByTestId('organization-opt-out-state');
    await expect(optedOut.getByRole('heading', { name: 'Has decidido no organizar todavía' })).toBeVisible();
    await expect(optedOut).toContainText('No se creará ningún Frente ni Reto canónico.');
    await expect(proposal.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeDisabled();
    expect(await prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(0);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId: lead.organizationId } } })).toBe(0);
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-whole-proposal-opt-out-1440x900.png') });
    await optedOut.getByRole('button', { name: 'Volver a revisar una organización' }).click();
    await expect(proposal.getByRole('heading', { name: 'Barreras de adopción sostenible' })).toBeVisible();

    await proposal.getByRole('button', { name: 'Mover Alertas de abandono' }).click();
    const alertDestination = proposal.getByLabel('Nuevo destino para Alertas de abandono');
    const retainedChallengeOption = await alertDestination.locator('option').filter({ hasText: /^Reto 1 ·/ }).getAttribute('value');
    expect(retainedChallengeOption).toBeTruthy();
    await alertDestination.selectOption(retainedChallengeOption!);
    for (const initiative of ['Seguimiento de adopción', 'Programa de recurrencia']) {
      await proposal.getByRole('button', { name: `Mover ${initiative}` }).click();
      await proposal.getByLabel(`Nuevo destino para ${initiative}`).selectOption(retainedChallengeOption!);
    }

    await proposal.getByText('Editar frente estratégico').click();
    await proposal.getByLabel('Nombre del frente estratégico').fill('Activación y recurrencia B2B');
    await proposal.getByRole('button', { name: 'Mover Onboarding guiado' }).click();
    const destination = proposal.getByLabel('Nuevo destino para Onboarding guiado');
    await expect(destination.getByRole('option', { name: 'Reto 1 · Barreras de adopción sostenible' })).toBeAttached();
    await expect(destination.getByRole('option', { name: 'Apoyo transversal' })).toBeAttached();
    await expect(destination.getByRole('option', { name: 'Sin agrupar' })).toBeAttached();
    await expect(destination.getByRole('option', { name: 'Fuera del objetivo actual' })).toBeAttached();
    await destination.selectOption('cross-cutting');
    await expect(proposal.getByRole('heading', { name: 'Apoyo transversal' }).locator('..')).toContainText('1 iniciativa');
    await expect(proposal.getByRole('button', { name: 'Mover Onboarding guiado' })).toBeVisible();
    const confirmationSummary = proposal.getByTestId('organization-confirmation-summary');
    await expect(confirmationSummary.getByRole('heading', { name: 'Lista para revisión final' })).toBeVisible();
    await expect(confirmationSummary).toContainText('Tienes cambios sin guardar.');
    await expect(proposal.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeEnabled();
    await confirmationSummary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-unsaved-review-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await confirmationSummary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-unsaved-review-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });

    await proposal.getByRole('button', { name: 'Guardar y continuar después' }).click();
    await expect(confirmationSummary.getByRole('heading', { name: 'Estructura estratégica lista para confirmar' })).toBeVisible({ timeout: 20_000 });
    await expect(confirmationSummary).toContainText('Revisión guardada. Ya puedes confirmar.');
    await expect(proposal.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeEnabled();
    await confirmationSummary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-saved-review-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await confirmationSummary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-saved-review-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(0);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId: lead.organizationId } } })).toBe(0);

    await reviewProposal().click();
    await proposalReview.getByRole('button', { name: 'Editar reto' }).click();
    await proposalReview.getByLabel('Nombre del reto').fill('Eliminar barreras de adopción sostenida');
    await proposalReview.getByRole('button', { name: 'Aplicar cambios al reto' }).click();
    await expect(confirmationSummary.getByRole('heading', { name: 'Lista para revisión final' })).toBeVisible();
    await expect(confirmationSummary).toContainText('guardaremos esta revisión y confirmaremos exactamente esa versión');
    await expect(proposal.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeEnabled();
    await expect(confirmationSummary).toContainText('Confirmar refleja esta estructura en Portfolio.');
    await expect(confirmationSummary).toContainText('No inicia iniciativas, no asigna equipos y no activa Steps.');
    await proposal.getByRole('button', { name: 'Confirmar estructura estratégica' }).click();
    await expect(page.getByText('PL-05 · Briefs').first()).toBeVisible({ timeout: 20_000 });
    const briefBoundary = page.getByTestId('pl05-brief-boundary');
    await expect(briefBoundary).toBeVisible();
    await expect(page.getByText('Configurar con Copilot · 6 de 7')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Eliminar barreras de adopción sostenida' })).toBeVisible();
    await expect(page.getByText('Todavía no preparaste un Brief para este reto.', { exact: true })).toBeVisible();
    await expect(briefBoundary.getByRole('button', { name: 'Preparar primer Brief', exact: true })).toBeEnabled();
    await briefBoundary.getByRole('button', { name: 'Preparar primer Brief', exact: true }).click();
    await expect(briefBoundary.getByRole('heading', { name: 'Prepara el Brief que recibirá tu equipo' })).toBeVisible();
    await expect(briefBoundary.getByText('Propuesta sin guardar', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/portfolio\/inicio$/);
    await expect(page.getByLabel('Tu avance').getByRole('button', { name: /Asignación/ })).toBeDisabled();
    await expect(page.getByLabel('Tu avance')).toContainText('Disponible al continuar desde una versión de Brief confirmada');

    await page.screenshot({ path: resolve(evidenceDirectory, 'desktop-pl05-boundary-1440x900.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText('PL-05 · Briefs').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(evidenceDirectory, 'mobile-pl05-boundary-390x844.png') });
    await page.setViewportSize({ width: 1440, height: 900 });

    const stored = await prisma.portfolioOrganizationMaterialization.findUniqueOrThrow({
      where: { bootstrapSessionId: sessionId },
    });
    const mappings = stored.canonicalMappings as any;
    expect(mappings.fronts).toHaveLength(1);
    expect(mappings.challenges).toHaveLength(1);
    expect(mappings.challenges[0].relatedInitiativeIds).toEqual(workItemIds.slice(1, 6));
    expect(mappings.specialDestinations).toEqual({
      crossCuttingInitiativeIds: [workItemIds[0]],
      outsideObjectiveInitiativeIds: [workItemIds[6]],
      ungroupedInitiativeIds: [workItemIds[7]],
    });
    expect(await prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(1);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId: lead.organizationId } } })).toBe(1);
    expect(await prisma.strategicFront.findMany({
      where: { organizationId: lead.organizationId },
      select: { name: true, strategicObjective: true },
    })).toEqual([{
      name: 'Activación y recurrencia B2B',
      strategicObjective: 'Aumentar la activación y la recurrencia de clientes B2B.',
    }]);
    expect(await prisma.challenge.findMany({
      where: { strategicFront: { organizationId: lead.organizationId } },
      select: { title: true, description: true, status: true },
    })).toEqual([{
      title: 'Eliminar barreras de adopción sostenida',
      description: 'La activación se interrumpe antes de producir valor recurrente.',
      status: 'draft',
    }]);
    expect(await Promise.all([
      prisma.project.count(),
      prisma.portfolioHandoffAssignment.count(),
      prisma.portfolioHandoffInvitation.count(),
      prisma.challengeActivationBrief.count(),
      prisma.challengeActivationBriefVersion.count(),
      prisma.initiativeCycle.count(),
      prisma.adaptiveStepConfiguration.count(),
      prisma.adaptiveStepOutput.count(),
      prisma.cycleStepState.count(),
    ])).toEqual(downstreamBefore);

    const current = await api.get(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/organization-proposal`, {
      headers: bearer(lead.token),
    });
    const proposalVersion = (await current.json()).data.version as number;
    const retried = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/organization-proposal/confirm`, {
      headers: { ...bearer(lead.token), 'Idempotency-Key': `pl04-runtime-retry-${sessionId}` },
      data: { proposalVersion }, failOnStatusCode: false,
    });
    expect(retried.status(), await retried.text()).toBe(200);
    expect((await retried.json()).data.materialization.canonicalMappings).toEqual(mappings);
    expect(await prisma.strategicFront.count({ where: { organizationId: lead.organizationId } })).toBe(1);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId: lead.organizationId } } })).toBe(1);

    await page.goto('/portfolio/frentes-estrategicos');
    await expect(page.getByText('Activación y recurrencia B2B')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Retos asociados')).toBeVisible();
    await page.goto('/portfolio/retos');
    await expect(page.getByText('Eliminar barreras de adopción sostenida')).toBeVisible();

    await api.dispose();
  });
});
