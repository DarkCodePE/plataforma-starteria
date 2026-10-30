const { readFile, mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const credentialPath = process.env.KAN180_ACCEPTANCE_CREDENTIAL_PATH || process.env.KAN171_ACCEPTANCE_CREDENTIAL_PATH;
  if (!credentialPath) throw new Error('KAN180_ACCEPTANCE_CREDENTIAL_PATH is required');
  const credentials = Object.fromEntries(
    (await readFile(credentialPath, 'utf8')).trim().split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
  const mailpitApi = process.env.KAN180_MAILPIT_API || process.env.KAN171_MAILPIT_API || 'http://127.0.0.1:8028/api/v1';
  const inbox = () => fetch(`${mailpitApi}/messages`).then((response) => response.json());
  const output = path.resolve(process.env.KAN180_ACCEPTANCE_OUTPUT || path.resolve(__dirname, '../../artifacts/KAN-180/portfolio-lead-integration'));
  await mkdir(output, { recursive: true });

  const runId = Date.now().toString(36);
  const recipient = `kan171-visual-${runId}@starteria.test`;
  const assignmentTarget = `${credentials.URL}/portfolio/inicio?stage=assignment&challengeId=pl06b-e2e-challenge&briefId=pl06b-e2e-brief&briefVersionId=pl06b-e2e-brief-v1&challengeName=${encodeURIComponent('Reducir fricción de activación')}`;
  const evidence = {
    url: `${credentials.URL}/portfolio/inicio`,
    checks: [],
    screenshots: [],
    mailpit: {},
    consoleErrors: [],
    failedResponses: [],
  };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) evidence.failedResponses.push({ status: response.status(), path: new URL(response.url()).pathname });
  });
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(output, name), fullPage: true });
    evidence.screenshots.push(name);
  };
  const assertNoHorizontalOverflow = async (label) => {
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    if (dimensions.scrollWidth > dimensions.clientWidth) throw new Error(`${label} tiene overflow horizontal: ${JSON.stringify(dimensions)}`);
  };
  const login = async () => {
    await page.goto(`${credentials.URL}/auth`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(credentials.EMAIL);
    await page.locator('input[type="password"]').fill(credentials.PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
  };
  const waitForOverview = async () => {
    await page.getByTestId('portfolio-overview-home').waitFor({ timeout: 20000 });
    await page.getByRole('heading', { name: '¿Qué necesita tu atención para mover el negocio?' }).waitFor();
    await page.getByText('PL06B Front', { exact: true }).waitFor();
    await page.locator('[data-field="latest-observation"]', { hasText: 'Sin datos' }).waitFor();
    await page.getByText('Sin serie canónica fechada, unidad y fuente; no se muestra gráfico.', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Qué vemos' }).waitFor();
    await page.getByRole('heading', { name: 'Qué falta' }).waitFor();
    await page.getByRole('heading', { name: 'Próxima intervención' }).waitFor();
    await page.getByRole('heading', { name: 'Capacidad, tiempo y recursos' }).waitFor();
  };

  const visitPortfolioRoute = async (pathname, heading) => {
    await page.goto(`${credentials.URL}${pathname}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(750);
    const bodyText = await page.locator('body').innerText();
    const normalizedBody = bodyText.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
    const normalizedHeading = heading.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
    if (!normalizedBody.includes(normalizedHeading)) throw new Error(`${pathname} no mostró ${heading}: ${bodyText.slice(0, 1200)}`);
    if (new URL(page.url()).pathname !== pathname) throw new Error(`La navegación no conservó ${pathname}`);
    await screenshot(`nav-${pathname.split('/').pop()}.png`);
    evidence.checks.push(`navegacion-${pathname.split('/').pop()}`);
  };

  try {
    await login();
    evidence.checks.push('login');

    const mailBeforeSave = (await inbox()).total;
    await page.goto(assignmentTarget, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    if (!await page.getByTestId('pl06a-assignment-preparation').count()) {
      await screenshot('00-diagnostico-ruta-assignment.png');
      throw new Error(`La ruta Assignment no mostró PL-06A: ${(await page.locator('body').innerText()).slice(0, 1800)}`);
    }
    await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: '+ Asignar responsable' }).click();
    await page.getByLabel('Persona responsable').fill(recipient);
    await page.getByLabel('Contexto específico del encargo').fill('Validación visual del cierre contextual KAN-171.');
    await page.getByRole('button', { name: 'Revisar asignación' }).click();
    await page.getByRole('button', { name: 'Guardar asignación' }).click();
    await page.getByText(recipient, { exact: true }).waitFor();
    await screenshot('01-configuracion-inicial-con-encargo-guardado.png');
    const mailAfterSave = (await inbox()).total;
    if (mailAfterSave !== mailBeforeSave) throw new Error('Guardar una Assignment envió un correo');
    evidence.mailpit.beforeSave = mailBeforeSave;
    evidence.mailpit.afterSave = mailAfterSave;
    evidence.checks.push('guardar-no-envia');

    await page.getByRole('checkbox', { name: `Seleccionar invitación para ${recipient}` }).check();
    await page.getByRole('button', { name: 'Revisar y enviar seleccionados (1)' }).click();
    const mailBeforeSend = (await inbox()).total;
    await page.getByRole('button', { name: 'Confirmar envío de 1 invitación' }).click();
    await page.getByText('1 envío procesado', { exact: true }).waitFor({ timeout: 15000 });
    await screenshot('02-despues-de-envio-sandbox.png');
    const mailAfterSend = (await inbox()).total;
    if (mailAfterSend !== mailBeforeSend + 1) throw new Error('La confirmación explícita no produjo exactamente un mensaje sandbox');
    evidence.mailpit.beforeSend = mailBeforeSend;
    evidence.mailpit.afterSend = mailAfterSend;
    evidence.checks.push('envio-solo-con-confirmacion-explicita');

    for (const [suffix, contextNote] of [
      ['a', 'Encargo guardado para validar el primer pendiente de envío.'],
      ['b', 'Encargo guardado para validar el segundo pendiente de envío.'],
    ]) {
      const preparedRecipient = `kan180-created-${suffix}-${runId}@starteria.test`;
      await page.getByRole('button', { name: '+ Asignar responsable' }).click();
      await page.getByLabel('Persona responsable').fill(preparedRecipient);
      await page.getByLabel('Contexto específico del encargo').fill(contextNote);
      await page.getByRole('button', { name: 'Revisar asignación' }).click();
      await page.getByRole('button', { name: 'Guardar asignación' }).click();
      await page.getByText(preparedRecipient, { exact: true }).waitFor();
    }
    const mailAfterPrepared = (await inbox()).total;
    if (mailAfterPrepared !== mailAfterSend) throw new Error('Guardar los dos encargos CREATED envió correo');
    evidence.mailpit.afterTwoCreated = mailAfterPrepared;
    evidence.checks.push('escenario-exacto-dos-sent-dos-created');

    const completionAction = page.getByRole('button', { name: 'Finalizar configuración y ver mi portafolio' });
    await completionAction.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('group', { name: 'Confirmar finalización' }).waitFor();
    if (await page.getByRole('button', { name: 'Finalizar configuración y ver mi portafolio' }).count()) throw new Error('El CTA de finalización quedó duplicado durante la confirmación');
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Sí, finalizar');
    await screenshot('03-confirmacion-humana-de-cierre.png');
    const mailBeforeCancel = (await inbox()).total;
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Seguir aquí');
    await page.keyboard.press('Enter');
    await completionAction.waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Finalizar configuración y ver mi portafolio');
    const mailAfterCancel = (await inbox()).total;
    if (mailAfterCancel !== mailBeforeCancel) throw new Error('Cancelar el cierre envió un correo adicional');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Sí, finalizar' }).waitFor();
    await page.setViewportSize({ width: 768, height: 1024 });
    await assertNoHorizontalOverflow('Confirmación tablet');
    await screenshot('03b-confirmacion-tablet-768.png');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow('Confirmación mobile');
    await screenshot('03c-confirmacion-mobile-390.png');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Sí, finalizar' }).focus();
    const mailBeforeCompletion = (await inbox()).total;
    await page.keyboard.press('Enter');
    await waitForOverview();
    if (new URL(page.url()).search) throw new Error('El cierre conservó parámetros del wizard en Inicio');
    const mailAfterCompletion = (await inbox()).total;
    if (mailAfterCompletion !== mailBeforeCompletion) throw new Error('Cerrar la configuración envió un correo adicional');
    evidence.mailpit.beforeCompletion = mailBeforeCompletion;
    evidence.mailpit.afterCompletion = mailAfterCompletion;
    evidence.mailpit.beforeCancel = mailBeforeCancel;
    evidence.mailpit.afterCancel = mailAfterCancel;
    evidence.checks.push('cierre-humano-persistido-no-envia');
    evidence.checks.push('confirmacion-y-cancelacion-por-teclado-sin-cta-duplicado');
    if (await page.getByRole('button', { name: /Abrir Copilot/i }).count()) throw new Error('Copilot apareció con su feature flag desactivada');
    const canonicalProjects = Number(await page.locator('[data-metric="canonical-projects"]').textContent());
    const projectedAssignments = Number(await page.locator('[data-metric="assignments"]').textContent());
    const persistedHome = await page.evaluate(async () => {
      const refreshResponse = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!refreshResponse.ok) throw new Error(`Refresh respondió ${refreshResponse.status}`);
      const refreshBody = await refreshResponse.json();
      const accessToken = refreshBody.data?.accessToken;
      if (!accessToken) throw new Error('Refresh no devolvió accessToken');
      const response = await fetch('/api/v1/portfolio/home', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`Portfolio Home respondió ${response.status}`);
      return (await response.json()).data;
    });
    const assignmentStates = persistedHome.handoffAssignments.reduce((counts, assignment) => {
      counts[assignment.handoffState] = (counts[assignment.handoffState] || 0) + 1;
      return counts;
    }, {});
    if (canonicalProjects !== 2) throw new Error('El contador de Projects canónicos no coincide con PostgreSQL');
    if (projectedAssignments !== 4) throw new Error(`El Overview no refleja exactamente 2 SENT + 2 CREATED: ${projectedAssignments} Assignments`);
    if (assignmentStates.SENT !== 2 || assignmentStates.CREATED !== 2) throw new Error(`Estados persistidos distintos de 2 SENT + 2 CREATED: ${JSON.stringify(assignmentStates)}`);
    evidence.overview = { canonicalProjects, projectedAssignments, assignmentStates, latestObservation: 'Sin datos' };
    evidence.checks.push('overview-ejecutivo-sin-kpi-inventado-y-contadores-canonicos');
    await screenshot('04-portfolio-overview-desktop-1440.png');

    await page.reload({ waitUntil: 'networkidle' });
    await waitForOverview();
    evidence.checks.push('reload-conserva-overview');

    const logout = page.getByRole('button', { name: 'Cerrar sesión' });
    if (await logout.count()) await logout.click();
    else {
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto(`${credentials.URL}/auth`, { waitUntil: 'networkidle' });
    }
    await login();
    await page.goto(`${credentials.URL}/portfolio/inicio`, { waitUntil: 'networkidle' });
    await waitForOverview();
    evidence.checks.push('logout-login-y-url-directa-conservan-overview');

    const newFront = page.getByRole('button', { name: 'Crear nuevo frente estratégico', exact: true });
    await newFront.focus();
    await page.keyboard.press('Enter');
    await page.getByText('Configurar con Copilot · 1 de 7', { exact: true }).waitFor({ timeout: 20000 });
    if (!await page.getByTestId('organizational-context-reference').count()) {
      await screenshot('05-diagnostico-segundo-frente.png');
      throw new Error(`El segundo frente no mostró el contexto organizacional como referencia: ${(await page.locator('body').innerText()).slice(0, 1800)}`);
    }
    await page.getByRole('heading', { name: 'Empecemos con el contexto' }).waitFor();
    if (await page.getByText('Revisado o completado', { exact: true }).count()) throw new Error('El scope nuevo heredó checks completados');
    if (!new URL(page.url()).searchParams.has('setup')) throw new Error('El segundo frente no abrió un scope explícito');
    await screenshot('05-segundo-frente-contextual-desktop.png');
    evidence.checks.push('segundo-frente-1-de-7-por-teclado-sin-reiniciar-el-primero');

    await page.goto(`${credentials.URL}/portfolio/inicio`, { waitUntil: 'networkidle' });
    await waitForOverview();
    await page.getByText('PL06B Front', { exact: true }).waitFor();
    evidence.checks.push('primer-frente-preservado-con-segundo-en-preparacion');

    await visitPortfolioRoute('/portfolio/frentes-estrategicos', 'Frentes estratégicos');
    await page.getByText('PL06B Front', { exact: true }).first().waitFor();
    await visitPortfolioRoute('/portfolio/retos', 'Retos');
    await page.getByText(/Reducir fricción de activación/i).first().waitFor();
    await visitPortfolioRoute('/portfolio/iniciativas', 'Iniciativas en seguimiento');
    await page.getByText(/Onboarding guiado canónico/i).first().waitFor();
    await visitPortfolioRoute('/portfolio/sponsors', 'Gestiona sponsors, challenge owners y mentores con contexto real');
    await visitPortfolioRoute('/portfolio/decisiones', 'Iniciativas terminadas y decisiones');
    evidence.checks.push('navegacion-portfolio-lead-completa-con-datos-reales');

    for (const [width, height, name] of [
      [768, 1024, '06-portfolio-overview-tablet-768.png'],
      [390, 844, '07-portfolio-overview-mobile-390.png'],
      [360, 800, '08-portfolio-overview-mobile-360.png'],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${credentials.URL}/portfolio/inicio`, { waitUntil: 'networkidle' });
      await waitForOverview();
      await assertNoHorizontalOverflow(`Portfolio Overview ${width}x${height}`);
      await screenshot(name);
    }
    evidence.checks.push('responsive-768-390-360');

    const relevantFailures = evidence.failedResponses.filter((item) => item.path.startsWith('/api/')
      && !(item.path === '/api/v1/auth/refresh' && item.status === 401));
    const relevantConsoleErrors = evidence.consoleErrors.filter((message) => !message.includes('status of 401 (Unauthorized)'));
    if (relevantFailures.length) throw new Error(`Fallaron peticiones API durante la navegación: ${JSON.stringify(relevantFailures)}`);
    if (relevantConsoleErrors.length) throw new Error(`La consola contiene errores: ${JSON.stringify(relevantConsoleErrors)}`);
    evidence.checks.push('sin-errores-consola-ni-http-api');
    await writeFile(path.join(output, 'kan180-portfolio-lead-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(`KAN180 visual acceptance evidence: ${output}`);
    console.log(`checks=${evidence.checks.length} screenshots=${evidence.screenshots.length} apiFailures=0 consoleErrors=0 expectedAuthRefresh401=${evidence.failedResponses.filter((item) => item.path === '/api/v1/auth/refresh' && item.status === 401).length}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
