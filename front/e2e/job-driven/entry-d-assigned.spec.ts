// Entrada D — "Me han encargado abordar algo" y la convergencia hasta la decisión.
// doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §15, §17–§23.
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, BASE, browserLogin, createChallenge, createFromInitialReview, createFront, getOk, login, patchOk, postOk, registerAndLogin, type Session } from '../support/api';
import { GAP_TIMEOUT, gapTest } from '../support/gap';
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
    api = await pwRequest.newContext({ baseURL: BASE });
    admin = await login(api, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test.afterAll(async () => {
    await api.dispose();
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

  gapTest('G8', 'la decisión vuelve al portfolio: actualiza la cobertura del Reto, la lectura del Frente y deja aprendizaje (§23)', async () => {
    const owner = await registerAndLogin(api, 'd-return');
    const { projectId, challengeId, frontId } = await assignedInitiative(owner, `return-${Date.now()}`);
    await runCycle(owner, projectId, 'scaled', 'd-return');
    const challenges = await getOk(api, admin.token, `/api/v1/portfolio/strategic-fronts/${frontId}/challenges`);
    const challenge = challenges.find((c: { id: string }) => c.id === challengeId);
    expect(challenge.coverageStatus).not.toBe('sin_cobertura');
    expect(challenge.lastDecision ?? challenge.decisions?.[0]).toBeTruthy();
    const home = await getOk(api, admin.token, '/api/v1/portfolio/home');
    expect(JSON.stringify(home.learnings ?? [])).toContain(projectId);
  });
});
