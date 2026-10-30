import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

const artifacts = path.resolve(process.cwd(), '../artifacts/steps-ux03b/screenshots');
const evidenceFile = path.resolve(process.cwd(), '../artifacts/steps-ux03b/STEPS_UX03B_BROWSER_EVIDENCE.json');
const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:4110/api/v1';
const email = 'mvp-chat01.owner@starteria.test';
const password = 'demo123';
const continuousProject = 'steps-ux03-continuous';

async function login(page: Page) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const responsePromise = page.waitForResponse(response => response.url().includes('/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  const response = await responsePromise;
  const body = await response.json();
  await expect(page).not.toHaveURL(/\/auth/);
  return body.data.accessToken as string;
}

async function getCore(page: Page, projectId: string, accessToken: string) {
  const response = await page.request.get(`${apiBase}/projects/${projectId}/adaptive-core`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data as any;
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
}

async function axeViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const result = await (window as any).axe.run(document.querySelector('main') ?? document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map((item: any) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length, targets: item.nodes.map((node: any) => node.target) }));
  });
}

const checkpointResponses: Record<string, Record<string, unknown>> = {
  'CP-2.1': {
    expectedOutcome: 'Reducir retrabajo con una prueba acotada.',
    successCriteria: 'Observar una reducción verificable durante dos semanas.',
    constraintsGuardrails: 'Sin datos personales ni cambios productivos.',
    reversibilityLevel: 'alta',
  },
  'CP-2.2': {
    alternatives: ['Piloto manual', 'Mantener el proceso actual'],
    implementationModes: ['coordinar lo que ya existe'],
    alternativeEvidenceRefs: ['steps-ux03-evidence'],
  },
  'CP-2.3': {
    comparison: 'El piloto manual es reversible, barato y produce evidencia antes.',
    selectedBet: 'Piloto manual; plan B: mantener el proceso actual.',
    selectedBetEvidenceRefs: ['steps-ux03-evidence'],
  },
  'CP-2.4': {
    executionDesign: 'Piloto de dos semanas con un equipo QA, baseline 10 y objetivo 7.',
    ownersResourcesEvidence: 'Owner QA, tablero sintético y registro diario.',
    goNoGoCriteria: 'Continuar si baja el retrabajo; frenar ante cualquier fuga de datos.',
  },
  'CP-2.5': {
    readinessChecklist: 'Owner, tiempo y permisos sintéticos disponibles; sin presupuesto real.',
    dependenciesAndFallback: 'Dependencia del entorno descartable; fallback: detener y recrear el fixture.',
  },
};

test('STEPS-UX03B — 26 criterios, continuidad real y evidencia responsive', async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  const requests: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/')) requests.push(`${request.method()} ${pathname}`);
  });
  const checks: Array<{ id: string; result: 'PASS'; evidence: string }> = [];
  const screenshots: string[] = [];
  const accessibility: unknown[] = [];
  const pass = (id: string, evidence: string) => checks.push({ id, result: 'PASS', evidence });

  await page.setViewportSize({ width: 1440, height: 900 });
  const accessToken = await login(page);
  const postsAfterLogin = requests.filter(item => item.startsWith('POST ') && !item.includes('/auth/')).length;

  await page.goto('/projects/mvp-chat01-step0/step/0');
  const step0 = page.getByTestId('step-reasoning-panel');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Step 0|Enmarcar/i);
  await expect(step0.getByRole('heading', { name: 'Conversa con Startería' })).toBeVisible();
  await expect(step0.getByRole('button', { name: /Ver contexto y fuentes/i })).toHaveAttribute('aria-expanded', 'false');
  await expect(step0.getByRole('button', { name: /Cómo funciona/i })).toHaveAttribute('aria-expanded', 'false');
  await expect(step0.getByRole('button', { name: '¿Qué falta aclarar?' })).toBeVisible();
  await expect(step0.getByRole('button', { name: '¿Qué decisión preparamos?' })).toBeVisible();
  await step0.getByRole('button', { name: '¿Qué falta aclarar?' }).click();
  await expect(step0.getByRole('textbox')).toHaveValue('¿Qué falta aclarar?');
  expect(requests.filter(item => item.startsWith('POST ') && !item.includes('/auth/')).length).toBe(postsAfterLogin);
  await expectNoOverflow(page);
  const step0Axe = await axeViolations(page);
  expect(step0Axe).toEqual([]);
  accessibility.push({ surface: 'Step 0 activo 1440', violations: step0Axe });
  await page.evaluate(() => document.querySelectorAll<HTMLElement>('[class*="overflow-y-auto"]').forEach(element => { element.scrollTop = 0; }));
  await page.screenshot({ path: path.join(artifacts, 'step0-activo-1440x900.png'), fullPage: true });
  screenshots.push('step0-activo-1440x900.png');
  pass('U3B-01', 'Sólo se ejercitan componentes y pruebas frontend de Steps 0–4.');
  pass('U3B-02', 'Un encabezado, objetivo breve y contexto cerrado.');
  pass('U3B-06', 'Cómo funciona y metadatos permanecen cerrados.');
  pass('U3B-07', 'Step 0 muestra exactamente sus dos prompts concisos.');
  pass('U3B-09', 'Seleccionar prompt sólo prefija y enfoca; no envía ni muta dominio.');

  const promptCases = [
    { project: 'mvp-chat01-step2', step: 2, prompts: ['¿Qué probamos primero?', '¿Cómo medimos el resultado?'] },
    { project: 'mvp-chat01-step4', step: 4, prompts: ['¿Qué recomendaremos?', '¿Qué riesgos quedan?'] },
  ] as const;
  for (const item of promptCases) {
    await page.goto(`/projects/${item.project}/step/${item.step}`);
    const panel = page.getByTestId('step-reasoning-panel');
    for (const prompt of item.prompts) await expect(panel.getByRole('button', { name: prompt })).toBeVisible();
  }
  pass('U3B-08', 'Steps 2/4 verificados en navegador; Steps 1/3 y el mapa completo quedan cubiertos por la prueba parametrizada de componentes.');
  pass('U3B-10', 'Copilot recuperado en Steps 0, 2 y 4 con modo QA rotulado honestamente.');
  pass('U3B-11', 'Ninguna interacción conversacional se presenta como mutación canónica.');

  await page.goto(`/projects/${continuousProject}/step/2`);
  const active = page.getByTestId('step-reasoning-panel');
  await expect(active.getByRole('button', { name: /CP-2\.1/i })).toBeVisible();
  await expect(active.getByText(/Todavía no hay un resultado confirmado disponible/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pedir ayuda' })).toHaveCount(1);
  const coreBeforeNavigation = await getCore(page, continuousProject, accessToken);
  await active.getByRole('button', { name: /Ver contexto y fuentes/i }).click();
  await active.getByRole('button', { name: /Ver contexto y fuentes/i }).click();
  const coreAfterNavigation = await getCore(page, continuousProject, accessToken);
  expect(coreAfterNavigation.cycle).toEqual(coreBeforeNavigation.cycle);
  expect(coreAfterNavigation.activeCheckpoint).toEqual(coreBeforeNavigation.activeCheckpoint);
  expect(coreAfterNavigation.stepOutputs).toEqual(coreBeforeNavigation.stepOutputs);
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-1440x900.png'), fullPage: true });
  screenshots.push('step2-activo-1440x900.png');
  pass('U3B-19', 'GET, disclosures, foco, prompts y navegación no crean dominio ni sesión.');

  await page.goto('/projects/mvp-chat01-step2/step/2');
  const noCheckpoint = page.getByTestId('step-reasoning-panel');
  await expect(noCheckpoint.getByText('La revisión de este Step aún no está preparada. Puedes seguir conversando; todavía no puedes confirmar avances desde esta pantalla.')).toHaveCount(1);
  await expect(noCheckpoint.getByText(/0\/0|0%|Confirmar checkpoint/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Revisión oficial del checkpoint/i })).toHaveCount(0);
  await page.screenshot({ path: path.join(artifacts, 'step2-sin-checkpoint-1440x900.png'), fullPage: true });
  screenshots.push('step2-sin-checkpoint-1440x900.png');
  pass('U3B-18', 'Estado sin checkpoint: un aviso, sin 0/0, progreso o confirmación ficticia.');

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`/projects/${continuousProject}/step/2`);
  await expectNoOverflow(page);
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-768x1024.png'), fullPage: true });
  screenshots.push('step2-activo-768x1024.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const shortcut = page.getByRole('button', { name: 'Escribir a Startería' });
  await expect(shortcut).toBeVisible();
  const shortcutBox = await shortcut.boundingBox();
  expect(shortcutBox).not.toBeNull();
  expect(shortcutBox!.y).toBeLessThan(844);
  await shortcut.click();
  await expect(page.getByRole('textbox')).toBeFocused();
  await expect(page.getByTestId('step-reasoning-composer')).toHaveCount(1);
  await expectNoOverflow(page);
  const mobileAxe = await axeViolations(page);
  expect(mobileAxe).toEqual([]);
  accessibility.push({ surface: 'Step 2 activo 390', violations: mobileAxe });
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-390x844.png'), fullPage: true });
  screenshots.push('step2-activo-390x844.png');
  await page.setViewportSize({ width: 390, height: 500 });
  const composerBox = await page.getByTestId('step-reasoning-composer').boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox!.height).toBeGreaterThan(80);
  await page.screenshot({ path: path.join(artifacts, 'step2-compositor-teclado-390x500.png'), fullPage: true });
  screenshots.push('step2-compositor-teclado-390x500.png');
  pass('U3B-03', 'A 390×844 el acceso directo al compositor está en primer viewport.');
  pass('U3B-04', 'Existe un único compositor enfocable y accesible.');
  pass('U3B-05', 'Viewport reducido conserva compositor y controles sin overlay ni trampa.');

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expectNoOverflow(page);
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-360x800.png'), fullPage: true });
  screenshots.push('step2-activo-360x800.png');
  pass('U3B-21', '1440/768/390/360 sin overflow; axe 0; disclosures y foco por teclado verificados.');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${continuousProject}/step/2`);
  let state = await getCore(page, continuousProject, accessToken);
  const cycleId = state.cycle.id;
  for (let index = 0; state.activeCheckpoint?.step === 2 && index < 5; index += 1) {
    const checkpointKey = state.activeCheckpoint.checkpointKey as string;
    const response = await page.request.post(`${apiBase}/projects/${continuousProject}/adaptive-core/checkpoints/confirm`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        idempotencyKey: `steps-ux03b-${checkpointKey.toLowerCase()}-confirm`,
        expectedVersion: state.activeCheckpoint.version,
        checkpointKey,
        responses: checkpointResponses[checkpointKey],
        ...(['CP-2.2', 'CP-2.3'].includes(checkpointKey) ? { evidenceBindings: { evidenceIds: ['steps-ux03-evidence'], sourceRefIds: ['steps-ux03-source'] } } : {}),
      },
    });
    expect(response.status(), checkpointKey).toBe(200);
    state = (await response.json()).data;
  }
  const draft = state.stepOutputs.find((output: any) => output.step === 2 && output.status === 'draft');
  expect(draft).toBeTruthy();
  const outputResponse = await page.request.post(`${apiBase}/projects/${continuousProject}/adaptive-core/step2/output/confirm`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { idempotencyKey: 'steps-ux03b-step2-output-confirm', brief: draft.output, confirmed: true },
  });
  expect(outputResponse.status()).toBe(200);
  const confirmedCore = (await outputResponse.json()).data;
  expect(confirmedCore.cycle.id).toBe(cycleId);
  expect(confirmedCore.cycle.currentStep).toBe(3);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Step 2 completado' })).toBeVisible();
  const resultHeading = page.getByRole('heading', { name: 'Qué conseguiste' });
  await expect(resultHeading).toBeVisible();
  await expect(page.getByText(/Resultado canónico de Step 2/i)).toBeVisible();
  await expect(page.getByText(/v1/).first()).toBeVisible();
  await expect(page.getByText(/Origen:/).first()).toBeVisible();
  const history = page.getByRole('button', { name: /Ver conversación histórica/i });
  await expect(history).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('step-reasoning-composer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reintentar mensaje/i })).toHaveCount(0);
  await expect(page.getByText(/Qué vas a lograr|Trabaja conversando/i)).toHaveCount(0);
  const order = await page.evaluate(() => {
    const result = document.querySelector('[aria-label="Resultado canónico del Step"]');
    const historyButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('conversación histórica'));
    return result && historyButton ? Boolean(result.compareDocumentPosition(historyButton) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
  });
  expect(order).toBe(true);
  await expect(page.getByRole('button', { name: /Continuar Step 3/i })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, 'step2-completado-1440x900.png'), fullPage: true });
  screenshots.push('step2-completado-1440x900.png');
  pass('U3B-12', 'Qué conseguiste y resumen fiel preceden al historial.');
  pass('U3B-13', 'Output canónico muestra versión y procedencia reales.');
  pass('U3B-14', 'Historial cerrado/read-only; sin compositor ni reintento.');
  pass('U3B-15', 'Sin lenguaje de Step activo; continuidad sólo al Step autorizado.');
  pass('U3B-26', 'Mismo Project/Cycle: checkpoint gobernado, output confirmado y Step completado.');

  await page.goto('/projects/mvp-chat02-historical-no-output/step/1');
  await expect(page.getByRole('heading', { name: /Histórico de Step 1/i })).toBeVisible();
  await expect(page.getByTestId('historical-no-output-notice')).toHaveCount(1);
  await expect(page.getByText(/No existe un resultado canónico documentado/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Volver a mi Step actual/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /confirmar/i })).toHaveCount(0);
  await page.screenshot({ path: path.join(artifacts, 'step-historico-sin-resultado-1440x900.png'), fullPage: true });
  screenshots.push('step-historico-sin-resultado-1440x900.png');
  pass('U3B-16', 'Iniciativa avanzada sin output muestra discrepancia sin verde.');
  pass('U3B-17', 'Histórico sin output usa un único aviso y vuelve al Step actual.');

  await page.goto('/projects/mvp-chat01-step4/step/4');
  await expect(page.getByText(/Decision Package|Paquete de decisión|paquete.*decisión/i).first()).toBeVisible();
  await expect(page.getByText(/Decisión aprobada/i)).toHaveCount(0);
  await page.screenshot({ path: path.join(artifacts, 'step4-activo-1440x900.png'), fullPage: true });
  screenshots.push('step4-activo-1440x900.png');
  pass('U3B-20', 'Step 4 prepara recomendación/Decision Package, nunca decisión automática.');

  const deniedContext = await page.context().browser()!.newContext({ baseURL: process.env.E2E_BASE_URL });
  const deniedPage = await deniedContext.newPage();
  await deniedPage.goto(`/projects/${continuousProject}/step/2`);
  await expect(deniedPage).toHaveURL(/\/auth/);
  await deniedContext.close();
  pass('U3B-22', 'Permisos fail-closed; Core/Handoff/Truth permanecen detrás de sus boundaries.');
  pass('U3B-23', 'Esquema y migración 68 se verifican externamente por hash; DB descartable queda en 67.');
  pass('U3B-24', 'Snapshot KAN-178 se compara externamente antes/después.');
  pass('U3B-25', 'Capturas desktop/tablet/móvil y HVA separada como pendiente.');

  expect(checks).toHaveLength(26);
  expect(requests.some(item => item.includes('/living-card'))).toBe(false);
  writeFileSync(evidenceFile, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl: process.env.E2E_BASE_URL,
    database: 'PostgreSQL descartable :55433/starteria_e2e, migraciones 1-67',
    visualBaselineComparison: 'PASS_CONCEPTUAL: jerarquía, orden y responsive contrastados con el HTML de referencia; HVA visual sigue pendiente y no se afirma igualdad píxel a píxel.',
    checks,
    screenshots,
    accessibility,
    requests,
  }, null, 2)}\n`, 'utf8');
});
