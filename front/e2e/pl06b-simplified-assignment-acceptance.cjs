const { readFile, mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const mailpitApi = process.env.PL06B_MAILPIT_API || 'http://127.0.0.1:8027/api/v1';
const inbox = () => fetch(`${mailpitApi}/messages`).then((response) => response.json());

async function main() {
  const credentialPath = process.env.PL06B_ACCEPTANCE_CREDENTIAL_PATH;
  if (!credentialPath) throw new Error('PL06B_ACCEPTANCE_CREDENTIAL_PATH is required');
  const credentials = Object.fromEntries(
    (await readFile(credentialPath, 'utf8')).trim().split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
  const output = path.resolve(__dirname, '../../artifacts/KAN-163/pl06b-simplified-assignment');
  await mkdir(output, { recursive: true });
  const runId = Date.now().toString(36);
  const existingRecipient = 'pl06b-existing-owner@starteria.test';
  const challengeRecipient = `pl06b-simplified-${runId}@starteria.test`;
  const mainTarget = `${credentials.URL}/portfolio/inicio?stage=assignment&challengeId=pl06b-e2e-challenge&briefId=pl06b-e2e-brief&briefVersionId=pl06b-e2e-brief-v1&challengeName=${encodeURIComponent('Reducir friccion de activacion')}`;
  const emptyTarget = `${credentials.URL}/portfolio/inicio?stage=assignment&challengeId=pl06b-simplification-empty-challenge&briefId=pl06b-simplification-empty-brief&briefVersionId=pl06b-simplification-empty-brief-v1&challengeName=${encodeURIComponent('Reto sin iniciativas canónicas elegibles')}`;
  const evidence = {
    mainTarget,
    emptyTarget,
    checks: [],
    screenshots: [],
    assignmentIds: [],
    mailpit: {},
  };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('handoff-assignments')) console.log(`[browser-request] ${request.method()} ${pathname}`);
  });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.includes('handoff-assignments')) console.log(`[browser-response] ${response.status()} ${response.request().method()} ${pathname}`);
  });
  page.on('requestfailed', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('handoff-assignments')) console.log(`[browser-request-failed] ${request.method()} ${pathname} ${request.failure()?.errorText ?? 'unknown'}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`[browser-console-error] ${message.text()}`);
  });
  const screenshot = async (name) => {
    await page.screenshot({ path: path.join(output, name), fullPage: true });
    evidence.screenshots.push(name);
  };

  try {
    await page.goto(`${credentials.URL}/auth`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(credentials.EMAIL);
    await page.locator('input[type="password"]').fill(credentials.PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
    evidence.checks.push('login');

    const mailBeforeSave = (await inbox()).total;
    await page.goto(mainTarget, { waitUntil: 'networkidle' });
    await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
    await page.getByRole('heading', { name: 'Asigna responsables para abordar este reto' }).waitFor();
    await page.getByRole('button', { name: '+ Asignar responsable' }).click();
    await page.getByRole('heading', { name: 'Define este encargo' }).waitFor();
    await page.getByText('Quedan 1 iniciativas disponibles para asignar. Puedes dejarlas para después', { exact: true }).waitFor();
    if (!(await page.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }).isEnabled())) {
      throw new Error('Existing initiative mode is unexpectedly disabled with an eligible canonical Project');
    }
    evidence.checks.push('primary-form-and-canonical-count');
    await screenshot('01-desktop-primary-form-one-eligible.png');

    await page.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }).click();
    await page.getByLabel('Iniciativa a continuar').selectOption('pl06b-simplification-canonical-project');
    await page.getByLabel('Contexto específico del encargo').fill('Continuar la iniciativa canónica desde el encargo preparado.');
    await page.getByRole('button', { name: 'Revisar asignación' }).click();
    await page.getByRole('heading', { name: 'Revisa este encargo' }).waitFor();
    await screenshot('02-desktop-review-existing-initiative.png');
    const existingCreateResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/v1\/portfolio\/challenges\/[^/]+\/handoff-assignments$/.test(new URL(response.url()).pathname));
    await page.getByRole('button', { name: 'Guardar asignación' }).click();
    const existingPayload = await (await existingCreateResponse).json();
    evidence.assignmentIds.push((existingPayload.data?.assignment ?? existingPayload.assignment).id);
    await page.getByText('Quedan 0 iniciativas disponibles para asignar. Puedes dejarlas para después', { exact: true }).waitFor();
    evidence.checks.push('existing-initiative-created-and-count-decremented');

    await page.getByRole('button', { name: '+ Asignar responsable' }).click();
    await page.getByLabel('Persona responsable').fill(challengeRecipient);
    await page.getByLabel('Colaborador 1').fill(`collab-${runId}@starteria.test`);
    await page.getByLabel('Contexto específico del encargo').fill('Proponer una iniciativa nueva para este reto.');
    await page.getByRole('button', { name: 'Revisar asignación' }).click();
    const challengeCreateResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/v1\/portfolio\/challenges\/[^/]+\/handoff-assignments$/.test(new URL(response.url()).pathname));
    await page.getByRole('button', { name: 'Guardar asignación' }).click();
    const challengePayload = await (await challengeCreateResponse).json();
    evidence.assignmentIds.push((challengePayload.data?.assignment ?? challengePayload.assignment).id);
    await page.getByText(challengeRecipient, { exact: true }).waitFor();
    await page.getByText('Quedan 0 iniciativas disponibles para asignar. Puedes dejarlas para después', { exact: true }).waitFor();
    evidence.checks.push('challenge-created-without-consuming-project-count');
    await screenshot('03-desktop-both-assignments-prepared.png');

    const mailAfterSave = (await inbox()).total;
    if (mailAfterSave !== mailBeforeSave) throw new Error('Saving an Assignment sent an email');
    evidence.mailpit.saveBefore = mailBeforeSave;
    evidence.mailpit.saveAfter = mailAfterSave;
    evidence.checks.push('save-does-not-send');

    await page.getByRole('button', { name: `Editar asignación para ${challengeRecipient}` }).click();
    await page.getByRole('heading', { name: 'Edita este encargo' }).waitFor();
    if (await page.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }).isEnabled()) {
      throw new Error('Editing allowed immutable targetKind to change');
    }
    await page.getByText('La modalidad de una asignación guardada no se puede cambiar.', { exact: true }).first().waitFor();
    await page.getByLabel('Contexto específico del encargo').fill('Cambio que debe descartarse al cancelar.');
    await screenshot('04-desktop-edit-immutable-target.png');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(challengeRecipient, { exact: true }).waitFor();
    if (await page.getByText(challengeRecipient, { exact: true }).count() !== 1) throw new Error('Re-entry duplicated the prepared Assignment');
    if (await page.getByText('Proponer una iniciativa nueva para este reto.', { exact: true }).count() !== 1) throw new Error('Cancel persisted the discarded edit');
    evidence.checks.push('edit-cancel-reentry-without-duplicates');

    const existingPreparedCard = page.getByText('Continuar una iniciativa existente · Recuperación temprana canónica', { exact: true }).locator('xpath=ancestor::article[1]');
    await existingPreparedCard.getByRole('checkbox', { name: `Seleccionar invitación para ${existingRecipient}` }).check();
    await page.getByRole('checkbox', { name: `Seleccionar invitación para ${challengeRecipient}` }).check();
    await page.getByRole('button', { name: 'Revisar y enviar seleccionados (2)' }).click();
    await page.getByRole('heading', { name: 'Revisa antes de enviar' }).waitFor();
    await screenshot('05-desktop-explicit-send-review.png');
    const mailBeforeSend = (await inbox()).total;
    await page.getByRole('button', { name: 'Confirmar envío de 2 invitaciones' }).click();
    await page.getByText('2 procesadas por SMTP', { exact: true }).waitFor({ timeout: 15000 });
    await screenshot('06-desktop-explicit-send-result.png');
    const mailAfterSend = await inbox();
    if (mailAfterSend.total !== mailBeforeSend + 2) throw new Error('Explicit confirmation did not create exactly two sandbox messages');
    evidence.mailpit.explicitSendBefore = mailBeforeSend;
    evidence.mailpit.explicitSendAfter = mailAfterSend.total;
    evidence.checks.push('explicit-send-only-and-result-per-assignment');

    await page.getByRole('button', { name: 'Ver seguimiento' }).click();
    await page.getByRole('heading', { name: 'Asignaciones preparadas' }).waitFor();
    await page.getByText('Envío procesado', { exact: true }).first().waitFor();
    evidence.checks.push('persisted-smtp-state');

    await page.goto(emptyTarget, { waitUntil: 'networkidle' });
    await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: '+ Asignar responsable' }).click();
    if (await page.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }).isEnabled()) {
      throw new Error('Existing initiative mode is enabled without canonical Projects');
    }
    await page.getByText('No hay iniciativas disponibles para asignar en este reto.', { exact: true }).waitFor();
    if (await page.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }).isChecked()) throw new Error('Challenge mode is unavailable without initiatives');
    evidence.checks.push('no-canonical-project-helper-and-challenge-mode');
    await screenshot('07-desktop-no-eligible-initiative.png');
    await page.getByLabel('Persona responsable').fill(`keyboard-${runId}@starteria.test`);
    await page.getByRole('button', { name: 'Revisar asignación' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Revisa este encargo' }).waitFor();
    await page.getByRole('button', { name: 'Editar encargo' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '+ Asignar responsable' }).waitFor();
    evidence.checks.push('keyboard-review-edit-cancel');

    for (const [width, height, name, target] of [
      [390, 844, '08-mobile-390-primary-form.png', mainTarget],
      [360, 800, '09-mobile-360-no-eligible.png', emptyTarget],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(target, { waitUntil: 'networkidle' });
      await page.getByTestId('pl06a-assignment-preparation').waitFor({ timeout: 20000 });
      await screenshot(name);
    }
    evidence.checks.push('desktop-and-mobile');
    await writeFile(path.join(output, 'pl06b-simplified-evidence.json'), JSON.stringify(evidence, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
