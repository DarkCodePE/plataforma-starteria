const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { chromium } = require('playwright');
const path = require('node:path');

const mailpitApi = process.env.PL06B_MAILPIT_API || 'http://127.0.0.1:8027/api/v1';
const inbox = () => fetch(`${mailpitApi}/messages`).then((response) => response.json());

async function main() {
  const credentialsPath = process.env.PL06B_ACCEPTANCE_CREDENTIAL_PATH;
  if (!credentialsPath) throw new Error('PL06B_ACCEPTANCE_CREDENTIAL_PATH is required');
  const credentials = Object.fromEntries((await readFile(credentialsPath, 'utf8')).trim().split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)));
  const output = path.resolve(__dirname, '../../artifacts/KAN-163/pl06b-acceptance-closure');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const runId = Date.now().toString(36);
  const target = `${credentials.URL}/portfolio/inicio?stage=assignment&challengeId=pl06b-e2e-challenge&briefId=pl06b-e2e-brief&briefVersionId=pl06b-e2e-brief-v1&challengeName=${encodeURIComponent('Reducir friccion de activacion')}`;
  const evidence = { target, checks: [], screenshots: [], mailpit: {} };
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(output, name), fullPage: true });
    evidence.screenshots.push(name);
  };
  try {
    if (process.env.PL06B_RECIPIENT_ONLY === 'true') {
      const mailbox = await inbox();
      let invitationUrl = null;
      for (const item of mailbox.messages) {
        const message = await fetch(`${mailpitApi}/message/${item.ID}`).then((response) => response.json());
        if ((message.To || []).some((recipient) => !recipient.Address.endsWith('@starteria.test'))) continue;
        const match = JSON.stringify(message).match(/https?:\/\/[^"'<>\\\s]+\/handoff\/invitations\/[^"'<>\\\s]+/);
        if (match) { invitationUrl = match[0]; break; }
      }
      if (!invitationUrl) throw new Error('No sandbox invitation link found');
      await page.goto(invitationUrl, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Te han invitado a asumir un encargo' }).waitFor({ timeout: 15000 });
      await screenshot('pl06b-closure-recipient-link-opened.png');
      await page.goto(`${credentials.URL}/auth`, { waitUntil: 'networkidle' });
      await page.locator('input[type="email"]').fill(credentials.EMAIL);
      await page.locator('input[type="password"]').fill(credentials.PASSWORD);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
      await page.goto(target, { waitUntil: 'networkidle' });
      await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
      const viewedBadge = page.getByText('Vista', { exact: true }).first();
      await viewedBadge.waitFor();
      if (await page.getByText('Aceptada', { exact: true }).count() || await page.getByText('Rechazada', { exact: true }).count()) throw new Error('Opening the link inferred an explicit response');
      await viewedBadge.scrollIntoViewIfNeeded();
      await screenshot('pl06b-closure-desktop-viewed-not-accepted.png');
      const evidencePath = path.join(output, 'pl06b-closure-evidence.json');
      const existingEvidence = JSON.parse(await readFile(evidencePath, 'utf8'));
      if (!existingEvidence.checks.includes('recipient-link-opened-as-viewed-not-accepted')) existingEvidence.checks.push('recipient-link-opened-as-viewed-not-accepted');
      if (!existingEvidence.screenshots.includes('pl06b-closure-recipient-link-opened.png')) existingEvidence.screenshots.push('pl06b-closure-recipient-link-opened.png');
      if (!existingEvidence.screenshots.includes('pl06b-closure-desktop-viewed-not-accepted.png')) existingEvidence.screenshots.push('pl06b-closure-desktop-viewed-not-accepted.png');
      await writeFile(evidencePath, JSON.stringify(existingEvidence, null, 2));
      console.log('step=recipient-link-opened-without-response');
      return;
    }
    await page.goto(`${credentials.URL}/auth`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(credentials.EMAIL);
    await page.locator('input[type="password"]').fill(credentials.PASSWORD);
    page.on('request', (request) => {
      if (!request.url().includes('/api/v1/auth/login')) return;
      const posted = request.postDataJSON();
      console.log(`step=login-request emailMatch=${posted.email === credentials.EMAIL} passwordMatch=${posted.password === credentials.PASSWORD} passwordLength=${String(posted.password || '').length}`);
    });
    const loginResponsePromise = page.waitForResponse((response) => response.url().includes('/api/v1/auth/login'));
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const loginResponse = await loginResponsePromise;
    console.log(`step=login-response status=${loginResponse.status()}`);
    console.log('step=login-navigation');
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
    evidence.checks.push('login');

    await page.goto(target, { waitUntil: 'networkidle' });
    await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
    await page.getByRole('region', { name: 'Qué significa cada estado' }).waitFor();
    evidence.checks.push('assignment-reentry-and-state-semantics');
    await screenshot('pl06b-closure-desktop-initial.png');

    await page.getByRole('button', { name: /Agregar (otra )?asignación/ }).click();
    await page.getByLabel('Persona responsable').fill('pl06b-draft-protected@starteria.test');
    await page.getByRole('button', { name: 'Editar asignación para pl06b-recipient-3@starteria.test' }).click();
    await page.getByRole('alert').filter({ hasText: 'Hay otro encargo abierto' }).waitFor();
    if (await page.getByLabel('Persona responsable').inputValue() !== 'pl06b-draft-protected@starteria.test') throw new Error('Edit replaced an open draft');
    evidence.checks.push('edit-conflict-explained-and-draft-preserved');
    await screenshot('pl06b-closure-desktop-edit-conflict.png');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Editar asignación para pl06b-recipient-3@starteria.test' }).click();
    await page.getByRole('heading', { name: 'Edita este encargo' }).waitFor();
    evidence.checks.push('edit-created-opens');
    await screenshot('pl06b-closure-desktop-edit-open.png');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

    const mailBeforeSaveExit = (await inbox()).total;
    await page.getByRole('button', { name: /Agregar (otra )?asignación/ }).click();
    await page.getByLabel('Persona responsable').fill(`pl06b-save-only-${runId}@starteria.test`);
    await page.getByLabel('Contexto específico del encargo').fill('Guardar y finalizar sin enviar automáticamente.');
    await page.getByRole('button', { name: 'Guardar y volver al portafolio' }).click();
    await page.getByRole('heading', { name: 'Tienes un encargo sin guardar' }).waitFor();
    await screenshot('pl06b-closure-desktop-unsaved-guard.png');
    await page.getByRole('button', { name: 'Guardar este encargo y volver' }).click();
    console.log('step=save-return-navigation');
    await page.waitForURL((url) => url.pathname === '/portfolio/inicio' && !url.search, { timeout: 15000 });
    const mailAfterSaveExit = (await inbox()).total;
    if (mailAfterSaveExit !== mailBeforeSaveExit) throw new Error('Save and return sent an email implicitly');
    evidence.mailpit.saveAndReturnBefore = mailBeforeSaveExit;
    evidence.mailpit.saveAndReturnAfter = mailAfterSaveExit;
    evidence.checks.push('save-and-return-does-not-send');

    await page.goto(target, { waitUntil: 'networkidle' });
    await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
    await page.getByRole('checkbox', { name: 'Seleccionar invitación para pl06b-recipient-4@starteria.test' }).check();
    await page.getByRole('checkbox', { name: 'Seleccionar invitación para pl06b-existing-owner@starteria.test' }).check();
    await page.getByRole('button', { name: 'Revisar y enviar seleccionados (2)' }).click();
    await page.getByRole('heading', { name: 'Revisa antes de enviar' }).waitFor();
    await page.getByText('Onboarding guiado canónico', { exact: true }).waitFor();
    await page.getByText('Reducir friccion de activacion', { exact: true }).waitFor();
    evidence.checks.push('challenge-and-existing-initiative-review');
    await screenshot('pl06b-closure-desktop-review-both-modalities.png');

    const mailBeforeSend = (await inbox()).total;
    await page.getByRole('button', { name: 'Confirmar envío de 2 invitaciones' }).click();
    console.log('step=explicit-send-result');
    await page.getByText('2 procesadas por SMTP', { exact: true }).waitFor({ timeout: 15000 });
    evidence.checks.push('explicit-send-result-per-assignment');
    await screenshot('pl06b-closure-desktop-send-result.png');
    await page.getByRole('button', { name: 'Ver seguimiento' }).click();
    await page.getByRole('heading', { name: 'Asignaciones preparadas' }).waitFor();
    await screenshot('pl06b-closure-desktop-tracking.png');
    await page.getByRole('button', { name: 'Volver al portafolio' }).click();
    console.log('step=post-send-return-navigation');
    await page.waitForURL((url) => url.pathname === '/portfolio/inicio' && !url.search, { timeout: 15000 });
    evidence.checks.push('post-send-return-to-portfolio');

    const mailAfterSend = await inbox();
    if (mailAfterSend.total !== mailBeforeSend + 2) throw new Error('Expected exactly two sandbox messages from explicit confirmation');
    const newMessages = await Promise.all(mailAfterSend.messages.slice(0, 2).map((item) => fetch(`${mailpitApi}/message/${item.ID}`).then((response) => response.json())));
    const serialized = JSON.stringify(newMessages);
    if (!serialized.includes('Onboarding guiado canónico') || !serialized.includes('Reducir friccion de activacion')) throw new Error('SMTP messages do not cover both assignment modalities');
    if (newMessages.some((message) => (message.To || []).some((recipient) => !recipient.Address.endsWith('@starteria.test')))) throw new Error('Non-sandbox recipient detected');
    evidence.mailpit.explicitSendBefore = mailBeforeSend;
    evidence.mailpit.explicitSendAfter = mailAfterSend.total;
    evidence.checks.push('mailpit-both-modalities-sandbox-only');

    await page.goto(target, { waitUntil: 'networkidle' });
    await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
    evidence.checks.push('persisted-reentry');
    await screenshot('pl06b-closure-desktop-reentry.png');

    for (const [width, height, name] of [[768, 1024, 'pl06b-closure-tablet-768.png'], [390, 844, 'pl06b-closure-mobile-390.png'], [360, 800, 'pl06b-closure-mobile-360.png']]) {
      await page.setViewportSize({ width, height });
      await page.goto(target, { waitUntil: 'networkidle' });
      await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
      await page.getByText('Volver al portafolio', { exact: true }).last().scrollIntoViewIfNeeded();
      await screenshot(name);
    }
    evidence.checks.push('responsive-360-390-768-1440');
    await writeFile(path.join(output, 'pl06b-closure-evidence.json'), JSON.stringify(evidence, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
