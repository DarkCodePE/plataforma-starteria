// Entrada D — "Me han encargado abordar algo" y la convergencia hasta la decisión.
// doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §15, §17–§23.
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, BASE, browserLogin, createChallenge, createFromInitialReview, createFront, getOk, login, patchOk, postOk, registerAndLogin, type Session } from '../support/api';
import { ensurePortfolioLead, prisma, uiLoginLead } from '../support/portfolio-lead';
import { completeStep0, completeStep1, completeStep2, completeStep3, completeStep4, confirmStep2, confirmStep3, confirmStep4 } from '../support/steps';

let api: APIRequestContext;
let admin: Session;

async function assignedInitiative(owner: Session, tag: string) {
  const front = await createFront(api, admin.token, {
    name: `E2E Job D ${tag} Frente`,
    strategicObjective: 'Reducir el costo de atención sin deteriorar calidad',
  });
  const challenge = await createChallenge(api, admin.token, front.id, {
    title: `E2E Job D ${tag} Reto`,
    whatWeWantToMove: 'Bajar el costo por solicitud de 14.20 a 10.00',
    whyNow: 'El presupuesto del año siguiente depende de esta mejora',
    successCriteria: 'Costo por solicitud bajo 12.00 en el piloto',
  });
  const project = await postOk(api, owner.token, '/api/v1/projects', { name: `E2E Job D ${tag} Iniciativa`, challengeId: challenge.id });
  return { frontId: front.id as string, challengeId: challenge.id as string, projectId: project.id as string };
}

async function runCycle(owner: Session, projectId: string, finalState: string, suffix: string) {
  // Las rutas de transferencia u operación (incluido benefit tracking, INV-12) exigen owner receptor.
  const receiverOwner = ['scaled', 'transferred', 'integrated_to_roadmap', 'completed', 'benefit_tracking'].includes(finalState)
    ? 'Owner receptor de operaciones'
    : undefined;
  await completeStep0(api, owner.token, projectId);
  await completeStep1(api, owner.token, projectId);
  const step2 = await completeStep2(api, owner.token, projectId);
  await confirmStep2(api, owner.token, projectId, step2.output);
  const step3 = await completeStep3(api, owner.token, projectId, { decision: 'scale_pilot', suffix });
  await confirmStep3(api, owner.token, projectId, step3.output);
  const step4 = await completeStep4(api, owner.token, projectId, { finalState, suffix, receiverOwner });
  await confirmStep4(api, owner.token, projectId, step4.output, `${suffix}-final`);
  return step4.output;
}

test.describe('Entrada D · encargo → Mission Review → ciclo → decisión → portfolio (§15, §17–§23)', () => {
  test.beforeAll(async () => {
    await ensurePortfolioLead();
    api = await pwRequest.newContext({ baseURL: BASE });
    admin = await login(api, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test.afterAll(async () => {
    await api.dispose();
    await prisma.$disconnect();
  });

  test('el ciclo completo converge: Step 0–4 → Decision Package → la decisión sube al portfolio (§17, §23)', async () => {
    const owner = await registerAndLogin(api, 'd-cycle');
    const { projectId } = await assignedInitiative(owner, `cycle-${Date.now()}`);
    const output = await runCycle(owner, projectId, 'scaled', 'd-cycle');
    expect(output.decisionPackage).toBeTruthy();
    // Iniciativa ligada a un Reto: el owner no cierra, presenta. La decisión es corporativa (§23).
    const state = await getOk(api, owner.token, `/api/v1/projects/${projectId}/adaptive-core`);
    expect(state.progressSignal.finalState).toBe('presented');
    const meta = await getOk(api, admin.token, `/api/v1/portfolio/initiatives/${projectId}/meta`);
    expect(meta.progressSignal.challengeCoverage.status).toBe('ready_for_decision');
  });

  test('el Decision Brief trae decisión, qué hicimos, qué ocurrió, aprendizajes, riesgos, qué no podemos afirmar y siguiente paso (§21)', async () => {
    const owner = await registerAndLogin(api, 'd-brief');
    const { projectId } = await assignedInitiative(owner, `brief-${Date.now()}`);
    const output = await runCycle(owner, projectId, 'closed_with_learning', 'd-brief');
    const text = JSON.stringify(output);
    for (const key of ['requestedDecision', 'execution', 'results', 'learnings', 'risks', 'unsupportedClaims', 'recommendation', 'nextStep']) {
      expect(text, key).toContain(`"${key}"`);
    }
  });

  test('el participante ve qué quiere mover el negocio y por qué en el Reto asignado (§15)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'd-view');
    const { challengeId } = await assignedInitiative(owner, `view-${Date.now()}`);
    await patchOk(api, admin.token, `/api/v1/portfolio/challenges/${challengeId}`, { visibleToParticipants: true, openCallStatus: 'activa' });
    await browserLogin(page, owner.email, owner.password);
    await page.goto(`/retos/${challengeId}`);
    await expect(page.getByText(/Que se quiere mover/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Por que importa ahora/i)).toBeVisible();
  });

  test('el encargo muestra qué se sabe, qué está abierto, restricciones y qué decisión futura necesita evidencia (§15, Core §14.1)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'd-envelope');
    const { challengeId } = await assignedInitiative(owner, `env-${Date.now()}`);
    await patchOk(api, admin.token, `/api/v1/portfolio/challenges/${challengeId}`, {
      visibleToParticipants: true,
      openCallStatus: 'activa',
      knownFacts: 'El 40% de las solicitudes son repetidas',
      openQuestions: 'No sabemos si el canal digital reduce costo',
      constraints: 'Sin tocar el contrato con el proveedor actual',
      expectedDecision: 'Escalar o no el autoservicio',
    } as Record<string, unknown>);
    await browserLogin(page, owner.email, owner.password);
    await page.goto(`/retos/${challengeId}`);
    for (const label of [/Qu[eé] se sabe/i, /Qu[eé] est[aá] abierto/i, /Restricciones/i, /Qu[eé] decisi[oó]n/i]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('Mission Review antes de empezar: Start no abre directamente Step 0 (§18)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'd-mission');
    const { projectId, challengeId } = await assignedInitiative(owner, `mission-${Date.now()}`);
    // Envelope del Reto (Core §14.1): con esto Mission Review deja de mostrar "Sin definir".
    await patchOk(api, admin.token, `/api/v1/portfolio/challenges/${challengeId}`, {
      constraints: 'Sin tocar el contrato con el proveedor actual',
      dependencies: 'Integración con el CRM',
      expectedDecision: 'Escalar o no el autoservicio a todas las sucursales',
      openQuestions: 'No sabemos si el canal digital reduce costo',
    });
    await browserLogin(page, owner.email, owner.password);
    await page.goto(`/initiatives/${projectId}/overview`);
    await page.getByRole('button', { name: /Revisar mi misi[oó]n y empezar/i }).click();
    await expect(page).toHaveURL(/\/initiatives\/[^/]+\/mission/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /¿Qu[eé] estoy asumiendo exactamente\?/ })).toBeVisible();
    for (const label of [/Qu[eé] quiere mover/i, /Contexto heredado/i, /Restricciones/i, /Capacidad/i, /Dependencias/i, /Qui[eé]n puede ayudar/i, /Qu[eé] decisi[oó]n/i]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 15_000 });
    }
    // Lo heredado del Reto llega a la pantalla (incluido el envelope, Ola 2), y recién desde acá se abre Step 0.
    await expect(page.getByText(/Bajar el costo por solicitud de 14.20 a 10.00/)).toBeVisible();
    for (const inherited of [
      'Sin tocar el contrato con el proveedor actual',
      'Integración con el CRM',
      'Escalar o no el autoservicio a todas las sucursales',
      'No sabemos si el canal digital reduce costo',
    ]) {
      await expect(page.getByText(inherited)).toBeVisible();
    }
    await page.getByRole('button', { name: /Asumir y empezar Step 0/ }).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/step\/0/, { timeout: 15_000 });
  });

  test('los Steps se presentan como preguntas de progreso (§19)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'd-steps');
    const { projectId } = await assignedInitiative(owner, `steps-${Date.now()}`);
    await browserLogin(page, owner.email, owner.password);
    await page.goto(`/projects/${projectId}`);
    for (const question of [
      /¿Qu[eé] es razonable intentar ahora\?/i,
      /¿Qu[eé] sabemos realmente\?/i,
      /¿Qu[eé] podemos poner frente a la realidad/i,
      /¿Qu[eé] ocurri[oó] realmente\?/i,
      /¿Qu[eé] decisi[oó]n est[aá] suficientemente sustentada\?/i,
    ]) {
      await expect(page.getByText(question).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('el Decision Brief incluye alternativas y qué podemos sostener (§21)', async () => {
    const owner = await registerAndLogin(api, 'd-brief2');
    const { projectId } = await assignedInitiative(owner, `brief2-${Date.now()}`);
    const output = await runCycle(owner, projectId, 'closed_with_learning', 'd-brief2');
    // Las alternativas vienen de CP-2.2 (support/steps.ts): la apuesta y el respaldo.
    expect(output.alternatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Prototipo manual', role: 'selected' }),
        expect.objectContaining({ name: 'No hacer nada', role: 'backup' }),
      ]),
    );
    expect(output.sustainableClaims.length).toBeGreaterThan(0);
    for (const claim of output.sustainableClaims) {
      expect(claim.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  test('la continuidad admite pivotear, buscar capacidad y benefit tracking como rutas propias (§22, Core §26)', async () => {
    // Independientes: el owner cierra el ciclo (una ligada a Reto termina en `presented`).
    for (const finalState of ['pivoted', 'seeking_capability', 'benefit_tracking']) {
      const owner = await registerAndLogin(api, `d-${finalState}`);
      const projectId = await createFromInitialReview(api, owner.token, `Quiero validar si un portal reduce llamadas repetidas (${finalState}).`);
      await runCycle(owner, projectId, finalState, `d-${finalState}`);
      // progressSignal.finalState es la proyección de ciclo de vida (completed/presented); la ruta
      // de continuidad queda en el output confirmado de Step 4.
      const state = await getOk(api, owner.token, `/api/v1/projects/${projectId}/adaptive-core`);
      const step4 = state.stepOutputs.find((item: { step: number; status: string }) => item.step === 4 && item.status === 'confirmed');
      expect(step4?.output.finalState, finalState).toBe(finalState);
    }
  });

  async function decideOnPortfolio(owner: Session, projectId: string, outcome: string, rationale: string) {
    // La governance la crea el flujo real: el admin creó Frente y Reto, así que es su owner y
    // queda como Portfolio Lead de la iniciativa (initiative-governance.ts). No se siembra nada.
    const governance = await getOk(api, admin.token, `/api/v1/portfolio/initiatives/${projectId}/governance`);
    expect(governance).toMatchObject({ mode: 'portfolio_governed', portfolioLeadUserId: admin.userId });
    const request = await postOk(api, owner.token, `/api/v1/projects/${projectId}/adaptive-core/decision-requests`, { idempotencyKey: `${projectId}-request` });
    // La readiness real decide qué es legítimo: con la evidencia del piloto sembrado, escalar no
    // está listo (impacto y riesgo insuficientes), seguir experimentando y cerrar sí.
    const readiness = await getOk(api, admin.token, `/api/v1/projects/${projectId}/adaptive-core/decision-readiness?decisionType=${outcome}`);
    return postOk(api, admin.token, `/api/v1/projects/${projectId}/adaptive-core/decision-requests/${request.id}/decide`, {
      idempotencyKey: `${projectId}-decide`,
      outcome,
      rationale,
      acceptedConditionCodes: (readiness.conditions ?? []).map((condition: { code: string }) => condition.code),
    });
  }

  test('la decisión corporativa vuelve al portfolio: cobertura del Reto, siguiente acción y aprendizaje (§23)', async ({ page }) => {
    const owner = await registerAndLogin(api, 'd-return');
    const { projectId, challengeId } = await assignedInitiative(owner, `return-${Date.now()}`);
    await runCycle(owner, projectId, 'scaled', 'd-return');
    const before = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId }, select: { title: true, whatWeWantToMove: true } });

    const decision = await decideOnPortfolio(owner, projectId, 'continue_experimenting', 'Queda una pregunta de aprendizaje: si el ahorro se sostiene en sucursales grandes.');

    const learning = await prisma.portfolioLearning.findUniqueOrThrow({ where: { decisionId: decision.id } });
    expect(learning).toMatchObject({ projectId, challengeId, outcome: 'continue_experimenting', coverageAfter: 'cobertura_parcial', suggestedReformulation: null });
    const after = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId }, select: { coverageStatus: true, title: true, whatWeWantToMove: true } });
    expect(after.coverageStatus).toBe('cobertura_parcial');
    // Core §30: sólo cambia la proyección de cobertura, no el texto del Reto.
    expect({ title: after.title, whatWeWantToMove: after.whatWeWantToMove }).toEqual(before);

    const meta = await getOk(api, admin.token, `/api/v1/portfolio/initiatives/${projectId}/meta`);
    expect(meta.nextActionRecommended).toBe('Abrir un nuevo ciclo con la incertidumbre que quedó abierta.');
    const reading = await getOk(api, admin.token, `/api/v1/portfolio/challenges/${challengeId}/coverage-reading`);
    expect(reading.decisions).toEqual([expect.objectContaining({ projectId, outcome: 'continue_experimenting' })]);

    // El portfolio lo muestra en el inicio.
    await uiLoginLead(page);
    await page.goto('/portfolio/inicio');
    const panel = page.getByRole('region', { name: 'Lo que aprendió el portfolio' });
    await expect(panel.getByTestId('portfolio-learning').filter({ hasText: /E2E Job D return-\d+ Iniciativa/ }).first()).toContainText('Seguir experimentando');
  });

  test('el Portfolio Lead de una iniciativa se puede reasignar, y sólo él decide (§23)', async () => {
    const owner = await registerAndLogin(api, 'd-gov');
    const otherLead = await registerAndLogin(api, 'd-gov-lead');
    const { projectId } = await assignedInitiative(owner, `gov-${Date.now()}`);
    const res = await api.put(`/api/v1/portfolio/initiatives/${projectId}/governance`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { portfolioLeadUserId: otherLead.userId },
      failOnStatusCode: false,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const governance = await getOk(api, admin.token, `/api/v1/portfolio/initiatives/${projectId}/governance`);
    expect(governance.portfolioLeadUserId).toBe(otherLead.userId);
    // Un participante sin portfolio:write no puede reasignarse la autoridad.
    const forbidden = await api.put(`/api/v1/portfolio/initiatives/${projectId}/governance`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { portfolioLeadUserId: owner.userId },
      failOnStatusCode: false,
    });
    expect(forbidden.status()).toBe(403);
  });

  test('cerrar con aprendizaje sin otra iniciativa activa sugiere reformular el Reto, sin reescribirlo (§23, Core §30)', async () => {
    const owner = await registerAndLogin(api, 'd-close');
    const { projectId, challengeId } = await assignedInitiative(owner, `close-${Date.now()}`);
    await runCycle(owner, projectId, 'scaled', 'd-close');
    const decision = await decideOnPortfolio(owner, projectId, 'close_with_learning', 'El piloto no movió el costo; cerramos con lo aprendido.');
    const learning = await prisma.portfolioLearning.findUniqueOrThrow({ where: { decisionId: decision.id } });
    expect(learning.coverageAfter).toBe('reformular');
    expect(learning.suggestedReformulation).toMatch(/reformularse/);
    const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId }, select: { coverageStatus: true, whatWeWantToMove: true } });
    expect(challenge).toEqual({ coverageStatus: 'reformular', whatWeWantToMove: 'Bajar el costo por solicitud de 14.20 a 10.00' });
  });
});
