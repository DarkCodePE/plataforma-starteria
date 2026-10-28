const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const axe = require('axe-core');

const baseUrl = process.env.MVP_LITE01_BASE_URL || 'http://127.0.0.1:5186';
const jwtSecret = 'mvp-lite01-local-secret';
const output = path.resolve(__dirname, '../../artifacts/mvp-lite01');
const screenshots = path.join(output, 'screenshots');

const identities = {
  kan178: { sub: 'kan178-owner', email: 'kan178-owner@starteria.test', role: 'participante', roles: ['participante'] },
  step0: { sub: 'mvp-lite01-owner', email: 'mvp-lite01.owner@starteria.test', role: 'participante', roles: ['participante'] },
  scenarioB: { sub: 'data02-owner-b', email: 'data02.owner@starteria.test', role: 'participante', roles: ['participante'] },
  outsider: { sub: 'data02-other-tenant', email: 'data02.other@starteria.test', role: 'viewer', roles: ['viewer'] },
};

function token(identity) {
  return jwt.sign(identity, jwtSecret, { expiresIn: '30m', issuer: 'starteria-api', audience: 'starteria-dashboard' });
}

async function authenticatedContext(browser, identity, viewport) {
  const context = await browser.newContext({ viewport });
  const accessToken = token(identity);
  await context.route('**/api/v1/auth/refresh', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { accessToken } }),
  }));
  return context;
}

async function main() {
  await mkdir(screenshots, { recursive: true });
  const evidence = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    database: 'postgresql://127.0.0.1:55437/starteria_e2e (disposable, migration 68 absent)',
    checks: [],
    screenshots: [],
    accessibility: [],
    requests: [],
    consoleErrors: [],
  };
  const browser = await chromium.launch({ headless: true });

  const expectText = async (page, text, label) => {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
    evidence.checks.push(label);
  };
  const expectNoText = async (page, text, label) => {
    if (await page.getByText(text, { exact: false }).count()) throw new Error(`${label}: texto inesperado "${text}"`);
    evidence.checks.push(label);
  };
  const noOverflow = async (page, label) => {
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (dimensions.scrollWidth > dimensions.clientWidth) throw new Error(`${label}: overflow ${JSON.stringify(dimensions)}`);
    evidence.checks.push(`${label}: sin overflow horizontal`);
  };
  const shot = async (page, name) => {
    const filename = `${name}.png`;
    await page.screenshot({ path: path.join(screenshots, filename), fullPage: true });
    evidence.screenshots.push(filename);
  };
  const audit = async (page, label) => {
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const severe = result.violations.filter(item => ['critical', 'serious'].includes(item.impact));
    const severeSummary = severe.map(item => ({
      id: item.id,
      impact: item.impact,
      nodes: item.nodes.length,
      targets: item.nodes.map(node => node.target),
    }));
    evidence.accessibility.push({ label, violations: result.violations.length, criticalOrSerious: severeSummary });
    if (severe.length) throw new Error(`${label}: axe critical/serious ${JSON.stringify(severeSummary)}`);
  };
  const track = (page, allowedMutations = []) => {
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon')) evidence.consoleErrors.push(message.text()); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/')) return;
      const record = { method: request.method(), path: url.pathname };
      evidence.requests.push(record);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(record.method)
        && record.path !== '/api/v1/auth/refresh'
        && !allowedMutations.some(item => item.method === record.method && item.path.test(record.path))) {
        throw new Error(`Mutación API inesperada durante navegación: ${record.method} ${record.path}`);
      }
    });
  };

  try {
    const kanContext = await authenticatedContext(browser, identities.kan178, { width: 1440, height: 900 });
    const kanPage = await kanContext.newPage();
    track(kanPage);
    await kanPage.goto(`${baseUrl}/projects/kan178-project-ready`, { waitUntil: 'networkidle' });
    await kanPage.locator('#continuity-title').waitFor({ timeout: 20_000 });
    await expectText(kanPage, 'Step actual: 2', 'Overview deriva el Step actual del Adaptive Core');
    await expectText(kanPage, 'anterior en el recorrido · resultado no documentado', 'Overview distingue avance de output ausente');
    if (await kanPage.getByRole('button', { name: /Continuar Step 2/i }).count() !== 1) throw new Error('Overview no tiene un único CTA principal');
    evidence.checks.push('Overview tiene un único CTA principal');
    await noOverflow(kanPage, 'Overview 1440x900');
    await audit(kanPage, 'Overview desktop');
    await shot(kanPage, 'overview-kan178-1440x900');

    await kanPage.setViewportSize({ width: 768, height: 1024 });
    await kanPage.reload({ waitUntil: 'networkidle' });
    await kanPage.locator('#continuity-title').waitFor({ timeout: 20_000 });
    await noOverflow(kanPage, 'Overview 768x1024');
    await shot(kanPage, 'overview-kan178-768x1024');

    await kanPage.setViewportSize({ width: 1440, height: 900 });
    await kanPage.goto(`${baseUrl}/projects/kan178-project-ready/step/2`, { waitUntil: 'networkidle' });
    await expectText(kanPage, 'Guía de plataforma · no es un Copilot LLM', 'Step 2 declara guía determinista y no finge LLM');
    await expectText(kanPage, 'No hay un checkpoint operativo preparado para este Step', 'Step 2 sin checkpoint termina en estado honesto');
    await expectNoText(kanPage, 'Copiloto de iniciativa · QA', 'Step 2 no muestra el Copilot de Step 0');
    await expectNoText(kanPage, '0/0', 'Step 2 no muestra porcentaje 0/0');
    await audit(kanPage, 'Step 2 desktop sin checkpoint');
    await shot(kanPage, 'step2-kan178-1440x900');

    await kanPage.setViewportSize({ width: 390, height: 844 });
    await kanPage.reload({ waitUntil: 'networkidle' });
    await noOverflow(kanPage, 'Step 2 390x844');
    await audit(kanPage, 'Step 2 móvil');
    await shot(kanPage, 'step2-kan178-390x844');
    await kanContext.close();

    const step0Context = await authenticatedContext(browser, identities.step0, { width: 1440, height: 900 });
    const step0Page = await step0Context.newPage();
    track(step0Page, [{ method: 'POST', path: /\/api\/v1\/projects\/mvp-lite01-step0\/steps\/0\/copilot\/turn$/ }]);
    await step0Page.goto(`${baseUrl}/projects/mvp-lite01-step0/step/0`, { waitUntil: 'networkidle' });
    await step0Page.getByTestId('step-reasoning-panel').waitFor({ timeout: 20_000 });
    await expectText(step0Page, 'Qué vas a lograr:', 'Step 0 muestra misión');
    await expectText(step0Page, 'Qué sigue:', 'Step 0 muestra siguiente foco');
    await expectText(step0Page, 'Copiloto de iniciativa · QA', 'Step 0 conserva el Copilot real');
    await expectText(step0Page, 'CP-0.1', 'Step 0 muestra checkpoint canónico');
    if (await step0Page.getByRole('button', { name: 'Pedir ayuda' }).count() !== 1) throw new Error('Step 0 debe tener una sola entrada de ayuda');
    evidence.checks.push('Step 0 tiene una sola entrada de ayuda');
    await audit(step0Page, 'Step 0 desktop');
    await shot(step0Page, 'step0-copilot-1440x900');

    const persistedMessage = 'La decisión es medir si reducimos a una sola revisión antes de activar la oportunidad.';
    await step0Page.getByPlaceholder(/Sabemos que hay retrabajo/i).fill(persistedMessage);
    const turnResponsePromise = step0Page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/v1/projects/mvp-lite01-step0/steps/0/copilot/turn', { timeout: 35_000 });
    await step0Page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await step0Page.getByText(persistedMessage, { exact: true }).first().waitFor({ timeout: 35_000 });
    const turnResponse = await turnResponsePromise;
    if (!turnResponse.ok()) throw new Error(`POST Copilot respondió ${turnResponse.status()}: ${await turnResponse.text()}`);
    const turnPayload = await turnResponse.json();
    if (!['SUCCEEDED', 'FAILED'].includes(turnPayload?.data?.turn?.status)) {
      throw new Error(`POST Copilot no devolvió un turno terminal: ${JSON.stringify(turnPayload)}`);
    }
    evidence.checks.push('Copilot persiste un turno mediante la API real en PostgreSQL descartable');
    await step0Page.reload({ waitUntil: 'networkidle' });
    await step0Page.getByText(persistedMessage, { exact: true }).first().waitFor({ timeout: 20_000 });
    evidence.checks.push('El turno reaparece tras reload');
    await step0Context.close();

    const reentryContext = await authenticatedContext(browser, identities.step0, { width: 390, height: 844 });
    const reentryPage = await reentryContext.newPage();
    track(reentryPage);
    await reentryPage.goto(`${baseUrl}/projects/mvp-lite01-step0/step/0`, { waitUntil: 'networkidle' });
    await reentryPage.getByText(persistedMessage, { exact: true }).first().waitFor({ timeout: 20_000 });
    evidence.checks.push('El turno reaparece en un contexto autenticado nuevo (logout/login equivalente)');
    await noOverflow(reentryPage, 'Step 0 390x844');
    await audit(reentryPage, 'Step 0 móvil reentrada');
    await shot(reentryPage, 'step0-copilot-reentry-390x844');
    await reentryContext.close();

    const bContext = await authenticatedContext(browser, identities.scenarioB, { width: 1440, height: 900 });
    const bPage = await bContext.newPage();
    track(bPage);
    await bPage.goto(`${baseUrl}/projects/data02-synthetic-canonical-b`, { waitUntil: 'networkidle' });
    await bPage.locator('#continuity-title').waitFor({ timeout: 20_000 });
    await bPage.getByText('Ver resultado del Step', { exact: true }).first().click();
    await expectText(bPage, 'Confirmado por una persona', 'Overview muestra sólo outputs canónicos confirmados');
    await expectText(bPage, 'v1', 'Output confirmado muestra versión');
    await bPage.goto(`${baseUrl}/projects/data02-synthetic-canonical-b/step/2`, { waitUntil: 'networkidle' });
    await expectText(bPage, 'CP-2.1', 'Step 2 muestra checkpoint materializado por transición canónica');
    await expectNoText(bPage, 'Copiloto de iniciativa · QA', 'Escenario B Step 2 no simula Copilot');
    await shot(bPage, 'step2-scenario-b-1440x900');
    await bContext.close();

    const outsiderContext = await authenticatedContext(browser, identities.outsider, { width: 1280, height: 800 });
    const outsiderPage = await outsiderContext.newPage();
    track(outsiderPage);
    await outsiderPage.goto(`${baseUrl}/projects/mvp-lite01-step0/step/0`, { waitUntil: 'networkidle' });
    await expectNoText(outsiderPage, 'Reducir el retrabajo de activación comercial', 'Actor de otro tenant no ve el proyecto');
    await expectNoText(outsiderPage, persistedMessage, 'Actor de otro tenant no ve la conversación');
    evidence.checks.push('Aislamiento browser cross-tenant fail-closed');
    await outsiderContext.close();

    const unexpectedConsole = evidence.consoleErrors.filter(message => !message.includes('Failed to load resource'));
    if (unexpectedConsole.length) throw new Error(`Errores de consola: ${JSON.stringify(unexpectedConsole)}`);
  } finally {
    await browser.close();
    await writeFile(path.join(output, 'MVP_LITE01_BROWSER_EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  }

  console.log(JSON.stringify(evidence, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
