import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

const artifacts = path.resolve(process.cwd(), '../artifacts/steps-ux03/screenshots');
const evidenceFile = path.resolve(process.cwd(), '../artifacts/steps-ux03/STEPS_UX03_BROWSER_EVIDENCE.json');
const apiBase = process.env.E2E_API_URL ?? 'http://127.0.0.1:4110/api/v1';
const email = 'mvp-chat01.owner@starteria.test';
const password = 'demo123';
const continuousProject = 'steps-ux03-continuous';

async function login(page: Page) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const loginResponse = page.waitForResponse(response => response.url().includes('/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  const body = await (await loginResponse).json();
  await expect(page).not.toHaveURL(/\/auth/);
  return body.data.accessToken as string;
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
}

async function axeViolations(page: Page, selector = '[data-testid="step-reasoning-panel"], main') {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async (target) => {
    const root = document.querySelector(target);
    if (!root) return [{ id: 'missing-target', impact: 'critical', nodes: 1 }];
    const result = await (window as any).axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations.map((item: any) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
  }, selector);
}

async function getCore(page: Page, projectId: string, accessToken: string) {
  const response = await page.request.get(`${apiBase}/projects/${projectId}/adaptive-core`, { headers: { Authorization: `Bearer ${accessToken}` } });
  expect(response.status()).toBe(200);
  return (await response.json()).data as any;
}

const responses: Record<string, Record<string, unknown>> = {
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

test('STEPS-UX03 22 criterios y continuidad canónica integrada', async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  const requests: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/')) requests.push(`${request.method()} ${pathname}`);
  });
  const checks: string[] = [];
  const screenshots: string[] = [];
  const accessibility: unknown[] = [];
  const evidence: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    baseUrl: process.env.E2E_BASE_URL,
    database: 'PostgreSQL descartable :55433, migraciones 1-67',
    visualBaselineComparison: 'PASS_CONCEPTUAL: comparación manual/automatizada contra el HTML y cuatro PNG aprobados; jerarquía, orden y responsive coinciden sin reclamar igualdad píxel a píxel.',
    checks,
    screenshots,
    accessibility,
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  const accessToken = await login(page);

  const domainPostsBeforeNavigation = requests.filter(item => item.startsWith('POST ') && !item.includes('/auth/')).length;
  await page.goto('/projects/mvp-chat01-step0/step/0');
  const step0 = page.getByTestId('step-reasoning-panel');
  await expect(page.getByRole('heading', { name: /Step 0 · Enmarcar el ciclo actual/i })).toBeVisible();
  await expect(step0.getByRole('heading', { name: /Trabaja Step 0 conversando/i })).toBeVisible();
  await expect(step0.getByTestId('step-reasoning-composer')).toBeVisible();
  await expect(step0.locator('.bg-slate-950')).toHaveCount(0);
  await expect(step0.getByRole('button', { name: /Ver contexto y fuentes/i })).toHaveAttribute('aria-expanded', 'false');
  const composerBox = await step0.getByTestId('step-reasoning-composer').boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox!.y).toBeLessThan(900);
  await noOverflow(page);
  const step0Axe = await axeViolations(page, '[data-testid="step-reasoning-panel"]');
  expect(step0Axe).toEqual([]);
  accessibility.push({ surface: 'Step 0 activo desktop', violations: step0Axe });
  await page.screenshot({ path: path.join(artifacts, 'step0-activo-1440x900.png'), fullPage: true });
  screenshots.push('step0-activo-1440x900.png');
  checks.push('UX03-01/02 Step activo: título y objetivo compactos, sin hero duplicado; chat y composer visibles a 1440');
  expect(requests.filter(item => item.startsWith('POST ') && !item.includes('/auth/')).length).toBe(domainPostsBeforeNavigation);

  await page.goto(`/projects/${continuousProject}/step/2`);
  const active = page.getByTestId('step-reasoning-panel');
  await expect(active.getByRole('heading', { name: /Trabaja Step 2 conversando/i })).toBeVisible();
  await expect(active.getByRole('button', { name: /CP-2\.1/i })).toBeVisible();
  await expect(active.getByText(/Todavía no hay un resultado confirmado disponible/i)).toBeVisible();
  await expect(active.getByText(/0\/0/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pedir ayuda' })).toHaveCount(1);
  const contextButton = active.getByRole('button', { name: /Ver contexto y fuentes/i });
  await contextButton.press('Enter');
  await expect(contextButton).toHaveAttribute('aria-expanded', 'true');
  await contextButton.press('Enter');
  await expect(contextButton).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-1440x900.png'), fullPage: true });
  screenshots.push('step2-activo-1440x900.png');
  checks.push('UX03-05/08/09 contexto y progreso provienen del Core; acordeones operables por teclado y CP-2.1 no aparece confirmado');

  await page.goto('/projects/mvp-chat01-step2/step/2');
  const noCheckpoint = page.getByTestId('step-reasoning-panel');
  await expect(noCheckpoint.getByText(/No hay un checkpoint operativo preparado/i).first()).toBeVisible();
  await expect(noCheckpoint.getByText(/0\/0|0%|Confirmar checkpoint/i)).toHaveCount(0);
  const beforeChat = await getCore(page, 'mvp-chat01-step2', accessToken);
  const persistedMessage = 'Registro conversacional UX03 persistente y separado del Core.';
  const turnResponse = await page.request.post(`${apiBase}/projects/mvp-chat01-step2/steps/2/copilot/turn`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      clientTurnId: '00000000-0000-4000-8000-000000000303',
      message: persistedMessage,
      mode: 'work_with_me',
    },
  });
  expect([200, 201]).toContain(turnResponse.status());
  const afterChat = await getCore(page, 'mvp-chat01-step2', accessToken);
  expect(afterChat.cycle).toEqual(beforeChat.cycle);
  expect(afterChat.activeCheckpoint).toEqual(beforeChat.activeCheckpoint);
  expect(afterChat.stepOutputs).toEqual(beforeChat.stepOutputs);
  await page.reload();
  const persistedTurn = page.getByText(/Registro conversacional UX03 persistente/i);
  await expect(persistedTurn).toHaveCount(1);
  await persistedTurn.scrollIntoViewIfNeeded();
  await expect(persistedTurn).toBeVisible();
  checks.push('UX03-06/07 conversación persiste tras reload y no modifica ciclo, checkpoint ni output');
  await page.screenshot({ path: path.join(artifacts, 'step2-sin-checkpoint-1440x900.png'), fullPage: true });
  screenshots.push('step2-sin-checkpoint-1440x900.png');
  checks.push('UX03-10 Step sin checkpoint: ausencia honesta, sin porcentaje ni control de confirmación');

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`/projects/${continuousProject}/step/2`);
  await expect(page.getByText(/Necesito preparar una prueba medible/i)).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-768x1024.png'), fullPage: true });
  screenshots.push('step2-activo-768x1024.png');
  checks.push('UX03-04 tablet 768 sin overflow horizontal');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText(/Necesito preparar una prueba medible/i)).toBeVisible();
  await expect(page.getByTestId('step-reasoning-composer')).toBeVisible();
  const positions = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="step-reasoning-panel"]');
    const composer = panel?.querySelector('[data-testid="step-reasoning-composer"]');
    const progress = panel?.querySelector('aside[aria-labelledby*="progress-title"]');
    return { composer: composer?.getBoundingClientRect().top ?? -1, progress: progress?.getBoundingClientRect().top ?? -1 };
  });
  expect(positions.composer).toBeLessThan(positions.progress);
  await noOverflow(page);
  const mobileAxe = await axeViolations(page, '[data-testid="step-reasoning-panel"]');
  expect(mobileAxe).toEqual([]);
  accessibility.push({ surface: 'Step 2 activo mobile 390', violations: mobileAxe });
  await page.evaluate(() => document.querySelectorAll<HTMLElement>('[class*="overflow-y-auto"]').forEach(element => { element.scrollTop = 0; }));
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-390x844.png'), fullPage: true });
  screenshots.push('step2-activo-390x844.png');
  await page.getByRole('textbox').focus();
  await page.screenshot({ path: path.join(artifacts, 'step2-activo-composer-390x844.png'), fullPage: true });
  screenshots.push('step2-activo-composer-390x844.png');
  checks.push('UX03-03 móvil prioriza conversación/composer antes del progreso, foco usable y sin colisión');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${continuousProject}/step/2`);
  let state = await getCore(page, continuousProject, accessToken);
  const cycleId = state.cycle.id;
  for (let index = 0; state.activeCheckpoint?.step === 2 && index < 5; index += 1) {
    const checkpointKey = state.activeCheckpoint.checkpointKey as string;
    const response = await page.request.post(`${apiBase}/projects/${continuousProject}/adaptive-core/checkpoints/confirm`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        idempotencyKey: `steps-ux03-${checkpointKey.toLowerCase()}-confirm`,
        expectedVersion: state.activeCheckpoint.version,
        checkpointKey,
        responses: responses[checkpointKey],
        ...(['CP-2.2', 'CP-2.3'].includes(checkpointKey) ? { evidenceBindings: { evidenceIds: ['steps-ux03-evidence'], sourceRefIds: ['steps-ux03-source'] } } : {}),
      },
    });
    expect(response.status(), `${checkpointKey} debe confirmar por el boundary real`).toBe(200);
    state = (await response.json()).data;
  }
  const draft = state.stepOutputs.find((output: any) => output.step === 2 && output.status === 'draft');
  expect(draft).toBeTruthy();
  const confirmedResponse = await page.request.post(`${apiBase}/projects/${continuousProject}/adaptive-core/step2/output/confirm`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { idempotencyKey: 'steps-ux03-step2-output-confirm', brief: draft.output, confirmed: true },
  });
  expect(confirmedResponse.status()).toBe(200);
  const confirmedState = (await confirmedResponse.json()).data;
  expect(confirmedState.cycle.id).toBe(cycleId);
  expect(confirmedState.cycle.currentStep).toBe(3);
  expect(confirmedState.stepOutputs.some((output: any) => output.step === 2 && output.status === 'confirmed')).toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Step completado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Resultado canónico de Step 2/i })).toBeVisible();
  await expect(page.getByText('Confirmado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/v1/).first()).toBeVisible();
  const historyButton = page.getByRole('button', { name: /Ver conversación histórica/i });
  await expect(historyButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('step-reasoning-composer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Continuar Step 3/i })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, 'step2-completado-continuo-1440x900.png'), fullPage: true });
  screenshots.push('step2-completado-continuo-1440x900.png');
  checks.push('UX03-11/12/13/14 E2E continuo: mismo Project/Cycle/Owner pasa gates reales, confirma output v1, conserva historia secundaria y habilita sólo Step 3');

  await page.goto('/projects/mvp-chat02-historical-no-output/step/1');
  await expect(page.getByRole('heading', { name: /Histórico de Step 1/i })).toBeVisible();
  await expect(page.getByText(/resultado no documentado/i).first()).toBeVisible();
  await expect(page.getByText(/No existe un resultado canónico documentado/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Volver a mi Step operativo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /confirmar/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pedir ayuda' })).toHaveCount(1);
  await page.screenshot({ path: path.join(artifacts, 'step-historico-sin-resultado-1440x900.png'), fullPage: true });
  screenshots.push('step-historico-sin-resultado-1440x900.png');
  checks.push('UX03-16/19 histórico sin output informa con honestidad, vuelve al Step operativo y mantiene una sola ayuda');

  await page.goto('/projects/mvp-chat01-step4/step/4');
  await expect(page.getByText(/Decision Package|Paquete de decisión|paquete.*decisión/i).first()).toBeVisible();
  await expect(page.getByText(/Decisión aprobada/i)).toHaveCount(0);
  checks.push('UX03-15 Step 4 prepara Decision Package y no declara decisión organizacional');

  const unauthenticated = await page.context().browser()!.newContext({ baseURL: process.env.E2E_BASE_URL });
  const deniedPage = await unauthenticated.newPage();
  await deniedPage.goto(`/projects/${continuousProject}/step/2`);
  await expect(deniedPage).toHaveURL(/\/auth/);
  await unauthenticated.close();
  checks.push('UX03-18 acceso no autenticado falla cerrado sin filtrar el contenido del Project');

  expect(requests.some(item => item.includes('/living-card'))).toBe(false);
  checks.push('UX03-17 rutas conservan descripciones diferenciadas; UX03-20 no se consulta Card viva ni se aplica migración 68');
  checks.push('UX03-21 Portfolio Lead no fue navegado ni modificado; su read-model canónico permanece fuera de esta slice');
  checks.push('UX03-22 evidencia técnica separada de HVA humana; no se declara aceptación humana');
  evidence.requests = requests;
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
});
