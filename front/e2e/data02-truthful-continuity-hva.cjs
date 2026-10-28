const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');

const output = path.resolve(__dirname, '../../artifacts/mvp-data02/hva');
const jwtSecret = 'data02-local-secret';

function accessToken(identity) {
  return jwt.sign(identity, jwtSecret, {
    expiresIn: '15m',
    issuer: 'starteria-api',
    audience: 'starteria-dashboard',
  });
}

function normalized(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}

async function runScenario(browser, scenario, evidence) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const token = accessToken(scenario.identity);
  const record = { name: scenario.name, screenshots: [], checks: [], consoleErrors: [], failedApi: [], unexpectedMutations: [] };
  evidence.scenarios.push(record);

  page.on('console', (message) => {
    if (message.type() === 'error') record.consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).pathname.startsWith('/api/')) {
      record.failedApi.push({ status: response.status(), path: new URL(response.url()).pathname });
    }
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && url.pathname !== '/api/v1/auth/refresh') {
      record.unexpectedMutations.push({ method: request.method(), path: url.pathname });
    }
  });
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { accessToken: token } }),
    });
  });

  const expectBody = async (expression, label) => {
    const body = normalized(await page.locator('body').innerText());
    if (!expression(body)) throw new Error(`${scenario.name}: ${label}\n${body.slice(0, 2200)}`);
    record.checks.push(label);
  };
  const noOverflow = async (label) => {
    const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    if (size.scrollWidth > size.clientWidth) throw new Error(`${scenario.name}: overflow ${label} ${JSON.stringify(size)}`);
    record.checks.push(`sin overflow ${label}`);
  };
  const screenshot = async (name) => {
    const filename = `${scenario.name}-${name}.png`;
    await page.screenshot({ path: path.join(output, filename), fullPage: true });
    record.screenshots.push(filename);
  };

  await page.goto(`${scenario.baseUrl}/projects/${scenario.projectId}`, { waitUntil: 'networkidle' });
  try {
    await page.locator('#continuity-title').waitFor({ timeout: 20000 });
  } catch (error) {
    throw new Error(`${scenario.name}: no abrió Overview (${page.url()})\n${(await page.locator('body').innerText()).slice(0, 2200)}`, { cause: error });
  }
  if (scenario.hasOutputs) {
    await expectBody((body) => body.includes('confirmado por una persona') && body.includes('configuracion'), 'overview muestra outputs confirmados con procedencia');
  } else {
    await expectBody((body) => body.includes('avance registrado sin resultado documentado') && !body.includes('confirmado por una persona'), 'overview separa avance de output ausente');
  }
  await screenshot('overview-1440');

  for (const [width, height, suffix] of [[768, 1024, 'overview-768'], [390, 844, 'overview-390']]) {
    await page.setViewportSize({ width, height });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#continuity-title').waitFor({ timeout: 20000 });
    await noOverflow(`${width}x${height}`);
    await screenshot(suffix);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${scenario.baseUrl}/projects/${scenario.projectId}/step/0`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Histórico de Step 0/i }).waitFor({ timeout: 20000 });
  if (scenario.hasOutputs) {
    await expectBody((body) => body.includes('confirmado por una persona') && body.includes('v1') && body.includes('fecha:'), 'Step 0 histórico muestra output real, versión y fecha');
  } else {
    await expectBody((body) => body.includes('todavia no dispone del resultado documentado') && !body.includes('confirmado por una persona'), 'Step 0 histórico no inventa output ni confirmación');
  }
  await screenshot('step0-historico-1440');

  await page.goto(`${scenario.baseUrl}/projects/${scenario.projectId}/step/1`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Histórico de Step 1/i }).waitFor({ timeout: 20000 });
  if (scenario.hasOutputs) {
    await expectBody((body) => body.includes('confirmado por una persona') && body.includes('v1') && body.includes('fecha:'), 'Step 1 histórico muestra output real, versión y fecha');
  } else {
    await expectBody((body) => body.includes('todavia no dispone del resultado documentado') && !body.includes('confirmado por una persona'), 'Step 1 histórico no inventa output ni confirmación');
  }
  await screenshot('step1-historico-1440');

  await page.goto(`${scenario.baseUrl}/projects/${scenario.projectId}/step/2`, { waitUntil: 'networkidle' });
  await page.getByTestId('copilot-unavailable').waitFor({ timeout: 20000 });
  await expectBody((body) => body.includes('copilot especializado aun no disponible para step 2') && !body.includes('respuesta simulada'), 'Copilot Step 2 se declara no implementado');
  const checkpointState = await page.getByTestId('checkpoint-state').getAttribute('data-state');
  if (checkpointState !== scenario.checkpointState) throw new Error(`${scenario.name}: checkpoint ${checkpointState}, esperado ${scenario.checkpointState}`);
  record.checks.push(`checkpoint Step 2 ${checkpointState}`);
  if (scenario.checkpointState === 'missing') {
    await expectBody((body) => body.includes('no existe checkpoint activo') && !body.includes('cargando'), 'Step 2 sale de loading y declara checkpoint ausente');
  } else {
    await expectBody((body) => body.includes('cp-2.1') && body.includes('ready'), 'Step 2 muestra CP-2.1 materializado por transición canónica');
  }
  await screenshot('step2-1440');

  const relevantErrors = record.consoleErrors.filter((message) => !message.includes('favicon'));
  const relevantApi = record.failedApi.filter((item) => item.path !== '/api/v1/auth/refresh');
  if (relevantErrors.length || relevantApi.length || record.unexpectedMutations.length) {
    throw new Error(`${scenario.name}: errores runtime ${JSON.stringify({ relevantErrors, relevantApi, unexpectedMutations: record.unexpectedMutations })}`);
  }
  record.checks.push('sin errores de consola, HTTP de contenido ni requests API mutantes emitidos por navegación');
  await context.close();
}

async function main() {
  await mkdir(output, { recursive: true });
  const evidence = {
    generatedAt: new Date().toISOString(),
    note: 'Auth refresh intercepted with a locally signed access token; all project/Core content came from the disposable real backend and PostgreSQL.',
    scenarios: [],
  };
  const browser = await chromium.launch({ headless: true });
  try {
    await runScenario(browser, {
      name: 'scenario-a-clone',
      baseUrl: 'http://127.0.0.1:5183',
      projectId: 'kan178-project-ready',
      hasOutputs: false,
      checkpointState: 'missing',
      identity: { sub: 'kan178-owner', email: 'kan178-owner@starteria.test', role: 'participante', roles: ['participante'] },
    }, evidence);
    await runScenario(browser, {
      name: 'scenario-b-synthetic',
      baseUrl: 'http://127.0.0.1:5182',
      projectId: 'data02-synthetic-canonical-b',
      hasOutputs: true,
      checkpointState: 'active',
      identity: { sub: 'data02-owner-b', email: 'data02.owner@starteria.test', role: 'participante', roles: ['participante'] },
    }, evidence);
  } finally {
    await browser.close();
    await writeFile(path.join(output, 'data02-hva-evidence.json'), JSON.stringify(evidence, null, 2));
  }
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
