const { readFile, mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const credentialPath = process.env.KAN180_ACCEPTANCE_CREDENTIAL_PATH;
  if (!credentialPath) throw new Error('KAN180_ACCEPTANCE_CREDENTIAL_PATH is required');
  const credentials = Object.fromEntries(
    (await readFile(credentialPath, 'utf8')).trim().split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
  const output = path.resolve(process.env.KAN180_NEW_FRONT_OUTPUT || path.resolve(__dirname, '../../artifacts/KAN-180/new-front-fix'));
  const mailpitApi = process.env.KAN180_MAILPIT_API || 'http://127.0.0.1:8030/api/v1';
  await mkdir(output, { recursive: true });

  const evidence = {
    url: `${credentials.URL}/portfolio/inicio`,
    checks: [], screenshots: [], sessionIds: {}, mailpit: {}, consoleErrors: [], failedResponses: [],
  };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const additionalFrontResponses = [];
  page.on('console', (message) => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
  page.on('response', async (response) => {
    const pathname = new URL(response.url()).pathname;
    if (response.status() >= 400) evidence.failedResponses.push({ status: response.status(), path: pathname });
    if (pathname.endsWith('/portfolio-bootstrap/sessions/additional-front') && response.ok()) {
      const body = await response.json();
      additionalFrontResponses.push(body.data.bootstrapSession.id);
    }
  });
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(output, name), fullPage: true });
    evidence.screenshots.push(name);
  };
  const inboxTotal = async () => (await (await fetch(`${mailpitApi}/messages`)).json()).total;
  const assertNoOverflow = async (label) => {
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
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
    await page.getByRole('button', { name: 'Crear nuevo frente estratégico', exact: true }).waitFor();
  };
  const assertFreshScope = async () => {
    await page.getByText('Configurar con Copilot · 1 de 7', { exact: true }).waitFor({ timeout: 20000 });
    await page.getByRole('heading', { name: 'Empecemos con el contexto' }).waitFor();
    await page.getByTestId('organizational-context-reference').waitFor();
    if (await page.getByText('Revisado o completado', { exact: true }).count()) {
      throw new Error('El scope nuevo heredó checks completados');
    }
  };

  try {
    await login();
    await page.goto(`${credentials.URL}/portfolio/inicio`, { waitUntil: 'networkidle' });
    await waitForOverview();
    const mailBefore = await inboxTotal();
    evidence.mailpit.before = mailBefore;

    const header = page.getByTestId('portfolio-overview-header');
    const cta = header.getByRole('button', { name: 'Crear nuevo frente estratégico', exact: true });
    if (await page.getByRole('button', { name: 'Crear nuevo frente estratégico', exact: true }).count() !== 1) {
      throw new Error('El Overview no tiene exactamente un CTA primario de nuevo frente');
    }
    const desktopBox = await cta.boundingBox();
    if (!desktopBox || desktopBox.y + desktopBox.height > 1000) throw new Error('El CTA no está visible en el primer viewport desktop');
    await screenshot('01-overview-header-cta-desktop-1440.png');
    evidence.checks.push('cta-unico-en-header-desktop-sin-scroll');

    await cta.evaluate((element) => { element.click(); element.click(); });
    await assertFreshScope();
    await page.waitForTimeout(600);
    const newSessionId = new URL(page.url()).searchParams.get('bootstrapSessionId');
    if (!newSessionId) throw new Error('La creación no devolvió bootstrapSessionId');
    evidence.sessionIds.newScopeAtOneOfSeven = newSessionId;
    const firstIntentIds = additionalFrontResponses.slice();
    if (new Set(firstIntentIds).size !== 1) throw new Error(`El doble clic creó IDs distintos: ${JSON.stringify(firstIntentIds)}`);
    await screenshot('02-new-scope-1-of-7-desktop-1440.png');
    evidence.checks.push('nuevo-scope-real-1-de-7-sin-checks-heredados');
    evidence.checks.push('doble-clic-misma-intencion-maximo-un-id');

    await page.reload({ waitUntil: 'networkidle' });
    await assertFreshScope();
    if (new URL(page.url()).searchParams.get('bootstrapSessionId') !== newSessionId) throw new Error('Reload cambió el scope nuevo');
    evidence.checks.push('reload-conserva-scope-y-progreso-real');

    await page.getByLabel('Tu respuesta al Copilot').fill('Contexto confirmado para este frente durante la aceptación KAN-180.');
    await page.getByRole('button', { name: 'Continuar la conversación' }).click();
    await page.getByText('Configurar con Copilot · 2 de 7', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Confirmar este punto de partida y continuar' }).click();
    await page.getByText('Configurar con Copilot · 3 de 7', { exact: true }).waitFor({ timeout: 15000 });
    evidence.sessionIds.progressedDraftAtThreeOfSeven = newSessionId;
    await screenshot('03-existing-draft-3-of-7.png');

    await page.goto(`${credentials.URL}/portfolio/inicio`, { waitUntil: 'networkidle' });
    await waitForOverview();
    const responseCountBeforeNewIntent = additionalFrontResponses.length;
    await page.getByRole('button', { name: 'Crear nuevo frente estratégico', exact: true }).click();
    await assertFreshScope();
    const deliberateNewSessionId = new URL(page.url()).searchParams.get('bootstrapSessionId');
    if (!deliberateNewSessionId || deliberateNewSessionId === newSessionId) throw new Error('Un nuevo clic deliberado no creó otro scope');
    if (additionalFrontResponses.length <= responseCountBeforeNewIntent) throw new Error('No se observó la segunda operación de creación');
    evidence.sessionIds.secondDeliberateScope = deliberateNewSessionId;
    evidence.checks.push('nuevo-clic-deliberado-crea-scope-distinto');

    await page.goto(`${credentials.URL}/portfolio/inicio?setup=additional-front&bootstrapSessionId=${encodeURIComponent(newSessionId)}`, { waitUntil: 'networkidle' });
    await page.getByText('Configurar con Copilot · 3 de 7', { exact: true }).waitFor({ timeout: 20000 });
    if (new URL(page.url()).searchParams.get('bootstrapSessionId') !== newSessionId) throw new Error('La reentrada cambió el ID del draft');
    evidence.checks.push('reentrada-mismo-draft-conserva-3-de-7');

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL((url) => url.pathname.includes('/auth'), { timeout: 15000 });
    await login();
    await page.goto(`${credentials.URL}/portfolio/inicio?setup=additional-front&bootstrapSessionId=${encodeURIComponent(newSessionId)}`, { waitUntil: 'networkidle' });
    await page.getByText('Configurar con Copilot · 3 de 7', { exact: true }).waitFor({ timeout: 20000 });
    if (new URL(page.url()).searchParams.get('bootstrapSessionId') !== newSessionId) throw new Error('La reautenticación cambió el ID del draft');
    evidence.checks.push('logout-login-reanuda-mismo-draft-en-3-de-7');

    for (const [width, height, name] of [
      [768, 1024, '04-overview-header-cta-tablet-768.png'],
      [390, 844, '05-overview-header-cta-mobile-390.png'],
      [360, 800, '06-overview-header-cta-mobile-360.png'],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${credentials.URL}/portfolio/inicio`, { waitUntil: 'networkidle' });
      await waitForOverview();
      await assertNoOverflow(`Overview ${width}x${height}`);
      const box = await page.getByTestId('portfolio-overview-header').getByRole('button', { name: 'Crear nuevo frente estratégico', exact: true }).boundingBox();
      if (!box || box.y + box.height > height) throw new Error(`CTA fuera del primer viewport en ${width}x${height}`);
      await screenshot(name);
    }
    evidence.checks.push('responsive-768-390-360-sin-overflow');

    const keyboardCta = page.getByTestId('portfolio-overview-header').getByRole('button', { name: 'Crear nuevo frente estratégico', exact: true });
    await keyboardCta.focus();
    await page.keyboard.press('Enter');
    await assertFreshScope();
    const keyboardSessionId = new URL(page.url()).searchParams.get('bootstrapSessionId');
    if (!keyboardSessionId || keyboardSessionId === newSessionId || keyboardSessionId === deliberateNewSessionId) {
      throw new Error('La activación por teclado no creó un scope nuevo independiente');
    }
    evidence.sessionIds.keyboardScope = keyboardSessionId;
    evidence.checks.push('creacion-por-teclado-abre-scope-distinto-en-1-de-7');

    const mailAfterOpening = await inboxTotal();
    evidence.mailpit.afterOpening = mailAfterOpening;
    if (mailAfterOpening !== mailBefore) throw new Error(`Abrir/reanudar scopes envió correo: ${mailBefore} -> ${mailAfterOpening}`);
    evidence.checks.push('cero-correos-por-abrir-o-reanudar');

    const runId = Date.now().toString(36);
    const secondFrontName = `Frente KAN-180 ${runId}`;
    const completedScope = await page.evaluate(async ({ sessionId, runId, secondFrontName }) => {
      const refresh = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!refresh.ok) throw new Error(`Refresh para cierre respondió ${refresh.status}`);
      const accessToken = (await refresh.json()).data?.accessToken;
      if (!accessToken) throw new Error('Refresh para cierre no devolvió token');
      const api = async (pathname, { method = 'GET', body, key } = {}) => {
        const response = await fetch(`/api/v1${pathname}`, {
          method,
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(key ? { 'Idempotency-Key': key } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(`${method} ${pathname} respondió ${response.status}: ${JSON.stringify(payload)}`);
        return payload.data;
      };

      await api(`/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
        method: 'PATCH',
        body: { contextSummary: `Contexto confirmado para el segundo cierre KAN-180 ${runId}.` },
      });
      await api(`/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, { method: 'POST', body: {} });
      const work = await api(`/portfolio-bootstrap/sessions/${sessionId}/work-items/manual`, {
        method: 'POST',
        key: `kan180-second-work-${sessionId}`,
        body: { label: `Trabajo segundo frente ${runId}`, purpose: 'Validar el cierre end-to-end del nuevo scope.', currentStateHint: 'active' },
      });
      const workItemId = work.items?.[work.items.length - 1]?.id;
      if (!workItemId) throw new Error('La incorporación no devolvió el work item canónico');
      const analysis = await api(`/portfolio-bootstrap/sessions/${sessionId}/analyze`, {
        method: 'POST', key: `kan180-second-analysis-${sessionId}`, body: {},
      });
      if (!analysis.analysisRunId || !analysis.proposedMutations?.length) {
        throw new Error('El análisis B3 no devolvió una ejecución y propuestas revisables');
      }
      for (const mutation of analysis.proposedMutations) {
        if (mutation.targetType === 'strategic_connection') {
          await api(`/portfolio-bootstrap/sessions/${sessionId}/proposed-mutations/${mutation.id}/confirm`, {
            method: 'POST', body: {},
          });
        } else {
          await api(`/portfolio-bootstrap/sessions/${sessionId}/proposed-mutations/${mutation.id}/reject`, {
            method: 'POST', body: { reviewNote: 'Revisada explícitamente durante la aceptación KAN-180.' },
          });
        }
      }
      const reviewed = await api(`/portfolio-bootstrap/sessions/${sessionId}`);
      if (reviewed.bootstrapSession?.bootstrapPhase !== 'B5_FIRST_READING'
        || reviewed.bootstrapSession?.status !== 'awaiting_first_reading') {
        throw new Error(`La revisión no alcanzó B5: ${JSON.stringify(reviewed.bootstrapSession)}`);
      }
      const published = await api(`/portfolio-bootstrap/sessions/${sessionId}/readings`, {
        method: 'POST', key: `kan180-second-reading-${sessionId}`, body: {},
      });
      if (!published.reading?.id || published.reading?.version !== 1) {
        throw new Error('La primera lectura del segundo scope no quedó publicada como versión 1');
      }
      const organizationPayload = {
        summary: 'Segundo frente revisado y confirmado durante la aceptación KAN-180.',
        fronts: [{
          candidateId: `front-${runId}`,
          name: secondFrontName,
          focus: 'Validar que un scope nuevo conserva progreso y cierre propios.',
          rationale: 'Se materializa de forma explícita tras revisar el segundo scope.',
          coverage: '1 de 1 iniciativa revisada',
          challenges: [{
            candidateId: `challenge-${runId}`,
            title: `Reto KAN-180 ${runId}`,
            problem: 'Comprobar la continuidad de un frente creado desde 1/7.',
            rationale: 'Permite validar el cierre sin alterar el frente histórico.',
            relatedInitiativeIds: [workItemId],
            evidence: ['El scope nació en B1 sin confirmaciones heredadas.'],
            gaps: [],
            overlaps: [],
          }],
        }],
        crossCuttingInitiativeIds: [],
        outsideObjectiveInitiativeIds: [],
        ungroupedInitiativeIds: [],
      };
      const proposal = await api(`/portfolio-bootstrap/sessions/${sessionId}/organization-proposal`, {
        method: 'PUT', body: { expectedVersion: 0, payload: organizationPayload },
      });
      const materialized = await api(`/portfolio-bootstrap/sessions/${sessionId}/organization-proposal/confirm`, {
        method: 'POST', key: `kan180-second-materialize-${sessionId}`, body: { proposalVersion: proposal.version },
      });
      const frontId = materialized.materialization?.canonicalMappings?.fronts?.[0]?.canonicalId;
      const challengeId = materialized.materialization?.canonicalMappings?.challenges?.[0]?.canonicalId;
      if (!frontId || !challengeId) throw new Error('La materialización no devolvió Front/Challenge canónicos');

      const briefResult = await api(`/portfolio/challenges/${challengeId}/activation-briefs`, {
        method: 'POST',
        key: `kan180-second-brief-${sessionId}`,
        body: {
          intent: 'Validar el segundo frente y su continuidad independiente.',
          scope: 'El nuevo frente creado durante KAN-180.',
          strategicContextRefs: { objective: 'Validar continuidad por scope', challengeId },
          inheritedContext: {
            challengeProblem: 'El frente debe conservar su avance real.',
            expectedDeliverable: 'Confirmación del cierre contextual.',
            decisionToEnable: 'Aceptar el nuevo frente sin afectar el histórico.',
            horizon: null,
          },
          constraintsSnapshot: ['No alterar el frente histórico'],
          knownGaps: [],
          sourceRefs: [{ source: 'KAN-180 HVA' }],
          provenance: { source: 'PORTFOLIO_LEAD_ACCEPTANCE' },
        },
      });
      const brief = briefResult.brief;
      const version = brief?.versions?.[0];
      if (!brief?.id || !version?.id) throw new Error('No se creó la versión de Brief del segundo frente');
      await api(`/portfolio/activation-brief-versions/${version.id}/confirm`, {
        method: 'POST', key: `kan180-second-brief-confirm-${sessionId}`, body: {},
      });
      const recipient = `kan180-second-${runId}@starteria.test`;
      const assignmentResult = await api(`/portfolio/challenges/${challengeId}/handoff-assignments`, {
        method: 'POST',
        key: `kan180-second-assignment-${sessionId}`,
        body: {
          targetKind: 'CHALLENGE', initiativeId: null, briefId: brief.id, briefVersionId: version.id,
          contextNote: 'Confirmar el segundo cierre KAN-180.', invitedEmailNormalized: recipient,
          members: [{ identityKey: recipient, emailNormalized: recipient, role: 'OWNER' }],
        },
      });
      const assignmentId = assignmentResult.assignment?.id;
      if (!assignmentId) throw new Error('No se creó la Assignment del segundo frente');
      await api(`/portfolio/handoff-assignments/${assignmentId}/invitation`, {
        method: 'POST', key: `kan180-second-send-${sessionId}`, body: {},
      });
      const completion = await api(`/portfolio-bootstrap/sessions/${sessionId}/complete-setup`, {
        method: 'POST', key: `portfolio-setup-complete:${sessionId}`, body: { confirmed: true },
      });
      const persisted = await api(`/portfolio-bootstrap/sessions/${sessionId}`);
      if (!persisted.bootstrapSession?.setupCompletedAt) throw new Error('El segundo scope no quedó cerrado en DB');
      if (persisted.bootstrapSession?.bootstrapPhase !== 'B5_FIRST_READING'
        || persisted.bootstrapSession?.status !== 'reading_published') {
        throw new Error(`El segundo scope no terminó realmente en B5/reading_published: ${JSON.stringify(persisted.bootstrapSession)}`);
      }
      return {
        sessionId,
        analysisRunId: analysis.analysisRunId,
        readingId: published.reading.id,
        readingVersion: published.reading.version,
        bootstrapPhase: persisted.bootstrapSession.bootstrapPhase,
        status: persisted.bootstrapSession.status,
        frontId,
        challengeId,
        briefId: brief.id,
        briefVersionId: version.id,
        assignmentId,
        completion,
      };
    }, { sessionId: keyboardSessionId, runId, secondFrontName });
    evidence.completedSecondScope = completedScope;
    evidence.sessionIds.completedSecondScope = keyboardSessionId;
    const mailAfterCompletion = await inboxTotal();
    evidence.mailpit.afterExplicitSecondFrontSend = mailAfterCompletion;
    if (mailAfterCompletion !== mailAfterOpening + 1) {
      throw new Error(`El cierre explícito del segundo frente no envió exactamente un correo: ${mailAfterOpening} -> ${mailAfterCompletion}`);
    }
    evidence.checks.push('segundo-scope-recorre-analisis-revision-lectura-y-cierra-7-de-7');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${credentials.URL}/portfolio/inicio`, { waitUntil: 'networkidle' });
    await waitForOverview();
    await page.getByText('PL06B Front', { exact: true }).first().waitFor();
    await page.getByText(secondFrontName, { exact: true }).first().waitFor({ timeout: 20000 });
    await screenshot('07-overview-multi-front-after-second-close.png');
    evidence.checks.push('overview-multi-frente-conserva-historico-y-muestra-segundo-cierre');

    const relevantFailures = evidence.failedResponses.filter((item) => item.path.startsWith('/api/')
      && !(item.path === '/api/v1/auth/refresh' && item.status === 401));
    const relevantConsoleErrors = evidence.consoleErrors.filter((message) => !message.includes('status of 401 (Unauthorized)'));
    if (relevantFailures.length) throw new Error(`Fallaron peticiones API: ${JSON.stringify(relevantFailures)}`);
    if (relevantConsoleErrors.length) throw new Error(`La consola contiene errores: ${JSON.stringify(relevantConsoleErrors)}`);
    evidence.checks.push('sin-errores-api-ni-consola-relevantes');

    await writeFile(path.join(output, 'kan180-new-front-fix-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(`KAN180 new-front evidence: ${output}`);
    console.log(`checks=${evidence.checks.length} screenshots=${evidence.screenshots.length} new=${newSessionId} second=${deliberateNewSessionId}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
