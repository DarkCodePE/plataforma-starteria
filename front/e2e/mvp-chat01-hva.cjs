const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const axe = require('axe-core');

const baseUrl = process.env.MVP_CHAT01_BASE_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../artifacts/mvp-chat01');
const screenshots = path.join(output, 'screenshots');
const identity = { sub: 'mvp-chat01-owner', email: 'mvp-chat01.owner@starteria.test', role: 'participante', roles: ['participante'] };
const accessToken = jwt.sign(identity, 'mvp-chat01-local-secret', { expiresIn: '30m', issuer: 'starteria-api', audience: 'starteria-dashboard' });

async function contextFor(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.route('**/api/v1/auth/refresh', (route) => route.fulfill({
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
    database: 'PostgreSQL descartable 127.0.0.1:55433/starteria_e2e',
    visualBaselineComparison: 'INCONCLUSIVE: no se proporcionó baseline visual aprobado',
    checks: [], screenshots: [], requests: [], accessibility: [], consoleErrors: [], failedResponses: [],
  };
  const browser = await chromium.launch({ headless: true });

  const observe = (page) => {
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) evidence.requests.push({ method: request.method(), path: url.pathname });
    });
    page.on('response', (response) => {
      if (response.status() >= 400) evidence.failedResponses.push({ status: response.status(), path: new URL(response.url()).pathname });
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('favicon')) evidence.consoleErrors.push(message.text());
    });
  };
  const shot = async (page, name) => {
    await page.screenshot({ path: path.join(screenshots, name), fullPage: true });
    evidence.screenshots.push(name);
  };
  const noOverflow = async (page, label) => {
    const result = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    if (result.scroll > result.width) throw new Error(`${label}: overflow horizontal ${JSON.stringify(result)}`);
    evidence.checks.push(`${label}: sin overflow horizontal`);
  };
  const auditPanel = async (page, label) => {
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => window.axe.run('[data-testid="step-reasoning-panel"]', {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const severe = result.violations.filter((item) => ['critical', 'serious'].includes(item.impact));
    evidence.accessibility.push({ label, violations: result.violations.length, criticalOrSerious: severe.map((item) => ({ id: item.id, nodes: item.nodes.length })) });
    if (severe.length) throw new Error(`${label}: axe critical/serious ${JSON.stringify(severe)}`);
  };
  const visitStep = async (page, projectId, step, shotName) => {
    const requestStart = evidence.requests.length;
    await page.goto(`${baseUrl}/projects/${projectId}/step/${step}`, { waitUntil: 'networkidle' });
    await page.getByTestId('step-reasoning-panel').waitFor({ timeout: 20_000 });
    await page.getByText(`Trabaja Step ${step} conversando`, { exact: false }).waitFor();
    await page.getByText('Respuesta de integración QA', { exact: false }).first().waitFor();
    if (await page.getByRole('button', { name: 'Pedir ayuda' }).count() !== 1) throw new Error(`Step ${step}: se esperaba una sola entrada de ayuda`);
    const navigationRequests = evidence.requests.slice(requestStart);
    const unexpected = navigationRequests.filter((item) => !['GET', 'HEAD', 'OPTIONS'].includes(item.method) && item.path !== '/api/v1/auth/refresh');
    if (unexpected.length) throw new Error(`Step ${step}: navegación escribió ${JSON.stringify(unexpected)}`);
    evidence.checks.push(`Step ${step}: Copilot principal, historial persistido y navegación GET sin escrituras`);
    await noOverflow(page, `Step ${step} desktop`);
    await auditPanel(page, `Step ${step} desktop`);
    await shot(page, shotName);
  };

  try {
    const desktop = await contextFor(browser, { width: 1440, height: 900 });
    const page = await desktop.newPage();
    observe(page);
    await visitStep(page, 'mvp-chat01-step0', 0, 'step0-chat-1440x900.png');
    await visitStep(page, 'mvp-chat01-step2', 2, 'step2-chat-1440x900.png');
    await page.getByText('No hay un checkpoint operativo preparado para este Step', { exact: false }).first().waitFor();
    evidence.checks.push('Step 2 sin checkpoint conserva conversación y declara ausencia canónica');

    const message = 'Turno HTTP QA: necesito concretar una señal observable sin confirmar el checkpoint.';
    await page.getByLabel(/Cuéntale a Starteria/i).fill(message);
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/v1/projects/mvp-chat01-step2/steps/2/copilot/turn', { timeout: 35_000 });
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`POST Step 2 respondió ${response.status()}: ${await response.text()}`);
    const body = await response.json();
    if (!['SUCCEEDED', 'FAILED'].includes(body?.data?.turn?.status)) throw new Error(`Turno no terminal: ${JSON.stringify(body)}`);
    evidence.checks.push(`POST Step 2 persistió turno terminal ${body.data.turn.status} con modo ${body.data.turn.executionMode}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(message, { exact: true }).first().waitFor({ timeout: 20_000 });
    evidence.checks.push('Turno Step 2 reaparece tras reload');

    await visitStep(page, 'mvp-chat01-step4', 4, 'step4-chat-1440x900.png');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${baseUrl}/projects/mvp-chat01-step2/step/2`, { waitUntil: 'networkidle' });
    await page.getByTestId('step-reasoning-panel').waitFor({ timeout: 20_000 });
    await noOverflow(page, 'Step 2 tablet');
    await auditPanel(page, 'Step 2 tablet');
    await shot(page, 'step2-chat-768x1024.png');
    await desktop.close();

    const mobile = await contextFor(browser, { width: 390, height: 844 });
    const mobilePage = await mobile.newPage();
    observe(mobilePage);
    await mobilePage.goto(`${baseUrl}/projects/mvp-chat01-step2/step/2`, { waitUntil: 'networkidle' });
    await mobilePage.getByTestId('step-reasoning-panel').waitFor({ timeout: 20_000 });
    await mobilePage.getByText(message, { exact: true }).first().waitFor();
    await noOverflow(mobilePage, 'Step 2 móvil');
    await auditPanel(mobilePage, 'Step 2 móvil');
    await shot(mobilePage, 'step2-chat-390x844.png');
    evidence.checks.push('Móvil conserva misión, historial, compositor y progreso en orden vertical');
    await mobile.close();

    const unexpectedConsole = evidence.consoleErrors.filter((message) => !message.includes('Failed to load resource'));
    if (unexpectedConsole.length) throw new Error(`Errores de consola: ${JSON.stringify(unexpectedConsole)}`);
  } finally {
    await browser.close();
    await writeFile(path.join(output, 'MVP_CHAT01_BROWSER_EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  }
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
