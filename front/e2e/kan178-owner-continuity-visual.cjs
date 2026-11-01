const { readFile, mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function loadCredentials() {
  const credentialPath = process.env.KAN178_CREDENTIAL_PATH;
  if (!credentialPath) throw new Error('KAN178_CREDENTIAL_PATH is required');
  return Object.fromEntries(
    (await readFile(credentialPath, 'utf8')).trim().split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
}

async function login(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/v1/auth/login'));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const response = await responsePromise;
  if (response.status() !== 200) throw new Error(`Login failed with HTTP ${response.status()}`);
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
}

async function main() {
  const credentials = await loadCredentials();
  const baseUrl = process.env.KAN178_BASE_URL || 'http://127.0.0.1:5185';
  const output = path.resolve(__dirname, '../../artifacts/KAN-178/owner-continuity');
  await mkdir(output, { recursive: true });
  const evidence = { baseUrl, checks: [], screenshots: [], expectedAuthBootstrap401: [], consoleErrors: [], failedResponses: [] };
  const browser = await chromium.launch({ headless: true });

  const observe = (page, label) => {
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const sourcePath = message.location().url ? new URL(message.location().url).pathname : '';
      if (sourcePath === '/api/v1/auth/refresh' && message.text().includes('401')) return;
      evidence.consoleErrors.push({ label, message: message.text(), sourcePath });
    });
    page.on('response', (response) => {
      if (response.status() < 400) return;
      const pathName = new URL(response.url()).pathname;
      if (response.status() === 401 && pathName === '/api/v1/auth/refresh') {
        evidence.expectedAuthBootstrap401.push(label);
        return;
      }
      evidence.failedResponses.push({ label, status: response.status(), path: pathName });
    });
  };
  const capture = async (page, name) => {
    await page.screenshot({ path: path.join(output, name), fullPage: true });
    evidence.screenshots.push(name);
  };
  const assertNoOverflow = async (page, label) => {
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    if (dimensions.scrollWidth > dimensions.clientWidth) throw new Error(`${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
  };

  try {
    const leadContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const leadPage = await leadContext.newPage();
    observe(leadPage, 'portfolio-lead');
    await login(leadPage, baseUrl, credentials.KAN178_LEAD_EMAIL, credentials.KAN178_PASSWORD);
    if (!leadPage.url().includes('/portfolio')) throw new Error(`Portfolio Lead landed outside Portfolio surface: ${leadPage.url()}`);
    await leadPage.getByTestId('portfolio-overview-home').waitFor({ timeout: 15000 });
    await capture(leadPage, '00-portfolio-lead-independent-session.png');
    evidence.checks.push('independent-portfolio-lead-session');

    const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const ownerPage = await ownerContext.newPage();
    observe(ownerPage, 'owner-desktop');
    await login(ownerPage, baseUrl, credentials.KAN178_OWNER_EMAIL, credentials.KAN178_PASSWORD);
    evidence.checks.push('independent-owner-session');

    const readyUrl = `${baseUrl}/handoff/invitations/${encodeURIComponent(credentials.KAN178_READY_TOKEN)}`;
    await ownerPage.goto(readyUrl, { waitUntil: 'networkidle' });
    await ownerPage.getByRole('heading', { name: 'Continúa tu iniciativa' }).waitFor({ timeout: 15000 });
    await ownerPage.getByText('Brief confirmado · versión 1').waitFor();
    await ownerPage.getByText(/Estado real · Step 2 · 4 Steps persistidos/).waitFor();
    if (ownerPage.url().includes('/portfolio')) throw new Error('Owner was redirected to Portfolio Home');
    await assertNoOverflow(ownerPage, 'ready desktop');
    await capture(ownerPage, '01-existing-ready-desktop.png');
    evidence.checks.push('existing-ready-post-start');

    await ownerPage.getByRole('button', { name: /Abrir Overview de la iniciativa/ }).click();
    await ownerPage.waitForURL((url) => url.pathname === '/projects/kan178-project-ready', { timeout: 15000 });
    await ownerPage.getByText('Iniciativa operativa KAN-178', { exact: true }).first().waitFor({ timeout: 15000 });
    await ownerPage.getByText('¿Cómo quieres empezar tu iniciativa?').waitFor({ state: 'detached', timeout: 15000 });
    await ownerPage.getByText(/Step actual:\s*2/i).waitFor({ timeout: 15000 }).catch(async () => {
      await capture(ownerPage, '02b-existing-operational-overview-timeout.png');
      const bodyCopy = (await ownerPage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 700);
      throw new Error(`Operational Overview did not expose canonical Step actual 2; url=${ownerPage.url()} responses=${JSON.stringify(evidence.failedResponses)} body=${JSON.stringify(bodyCopy)}`);
    });
    await capture(ownerPage, '02-existing-operational-overview-desktop.png');
    if (/\/step\/\d+$/.test(new URL(ownerPage.url()).pathname)) throw new Error('Owner was redirected directly to a Step');
    evidence.checks.push('existing-overview-no-direct-step');

    await ownerPage.goto(readyUrl, { waitUntil: 'networkidle' });
    await ownerPage.getByRole('heading', { name: 'Continúa tu iniciativa' }).waitFor();
    evidence.checks.push('ready-reentry-stable');

    await ownerPage.goto(`${baseUrl}/handoff/invitations/${encodeURIComponent(credentials.KAN178_ACTIVATION_TOKEN)}`, { waitUntil: 'networkidle' });
    await ownerPage.getByRole('heading', { name: /necesita activación antes de continuar/i }).waitFor();
    await ownerPage.getByText(/todavía no tiene Steps persistidos/i).waitFor();
    if (await ownerPage.getByRole('button', { name: /Abrir Overview/i }).count()) throw new Error('Activation-required exposed an operational route');
    await capture(ownerPage, '03-existing-activation-required-desktop.png');
    evidence.checks.push('adr009-no-steps-activation-required');

    await ownerPage.goto(`${baseUrl}/handoff/invitations/${encodeURIComponent(credentials.KAN178_CHALLENGE_TOKEN)}`, { waitUntil: 'networkidle' });
    await ownerPage.getByRole('heading', { name: 'Formula una iniciativa para este reto' }).waitFor();
    await ownerPage.getByText(/no ha creado una iniciativa ni Steps/i).waitFor();
    if (await ownerPage.getByRole('button', { name: /Crear iniciativa/i }).count()) throw new Error('Challenge exposed an unauthorized create command');
    await capture(ownerPage, '04-challenge-formulation-required-desktop.png');
    evidence.checks.push('challenge-formulation-no-implicit-creation');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mobilePage = await mobileContext.newPage();
    observe(mobilePage, 'owner-mobile');
    await login(mobilePage, baseUrl, credentials.KAN178_OWNER_EMAIL, credentials.KAN178_PASSWORD);
    await mobilePage.goto(readyUrl, { waitUntil: 'networkidle' });
    await mobilePage.getByRole('heading', { name: 'Continúa tu iniciativa' }).waitFor();
    await assertNoOverflow(mobilePage, 'ready mobile');
    await capture(mobilePage, '05-existing-ready-mobile.png');
    await mobilePage.goto(`${baseUrl}/handoff/invitations/${encodeURIComponent(credentials.KAN178_CHALLENGE_TOKEN)}`, { waitUntil: 'networkidle' });
    await mobilePage.getByRole('heading', { name: 'Formula una iniciativa para este reto' }).waitFor();
    await assertNoOverflow(mobilePage, 'challenge mobile');
    await capture(mobilePage, '06-challenge-formulation-required-mobile.png');
    evidence.checks.push('responsive-no-overflow');

    await Promise.all([leadContext.close(), ownerContext.close(), mobileContext.close()]);
    await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(`KAN178_BROWSER_PASS checks=${evidence.checks.length} screenshots=${evidence.screenshots.length} failedResponses=${evidence.failedResponses.length} consoleErrors=${evidence.consoleErrors.length}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
