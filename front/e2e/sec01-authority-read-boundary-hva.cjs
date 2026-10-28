const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');

const output = path.resolve(__dirname, '../../artifacts/mvp-sec01/hva');
const baseUrl = process.env.SEC01_HVA_BASE_URL || 'http://127.0.0.1:5184';
const projectId = 'sec01-project-a';
const token = jwt.sign(
  {
    sub: 'sec01-owner-a',
    email: 'sec01-owner-a@starteria.test',
    role: 'participante',
    roles: ['participante'],
  },
  'sec01-disposable-jwt-secret-only-for-tests',
  { expiresIn: '15m', issuer: 'starteria-api', audience: 'starteria-dashboard' },
);

async function main() {
  await mkdir(output, { recursive: true });
  const evidence = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    database: 'disposable PostgreSQL on localhost:55438',
    projectId,
    screenshots: [],
    apiFailures: [],
    consoleErrors: [],
    unexpectedMutations: [],
    checks: [],
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('favicon')) evidence.consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/') && response.status() >= 400 && url.pathname !== '/api/v1/auth/refresh') {
        evidence.apiFailures.push({ status: response.status(), path: url.pathname });
      }
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && url.pathname !== '/api/v1/auth/refresh') {
        evidence.unexpectedMutations.push({ method: request.method(), path: url.pathname });
      }
    });
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { accessToken: token } }),
    }));

    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${baseUrl}/projects/${projectId}`, { waitUntil: 'networkidle' });
      await page.locator('#continuity-title').waitFor({ timeout: 20000 });
      const size = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (size.scrollWidth > size.clientWidth) throw new Error(`Horizontal overflow at ${width}x${height}: ${JSON.stringify(size)}`);
      const file = `sec01-project-owner-${width}.png`;
      await page.screenshot({ path: path.join(output, file), fullPage: true });
      evidence.screenshots.push(file);
      evidence.checks.push(`owner overview renders without horizontal overflow at ${width}x${height}`);
    }
    if (evidence.apiFailures.length || evidence.consoleErrors.length || evidence.unexpectedMutations.length) {
      throw new Error(JSON.stringify({
        apiFailures: evidence.apiFailures,
        consoleErrors: evidence.consoleErrors,
        unexpectedMutations: evidence.unexpectedMutations,
      }));
    }
    evidence.checks.push('navigation emitted no mutating API request and no content API/console error');
    await context.close();
  } finally {
    await browser.close();
    await writeFile(path.join(output, 'sec01-hva-evidence.json'), JSON.stringify(evidence, null, 2));
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
