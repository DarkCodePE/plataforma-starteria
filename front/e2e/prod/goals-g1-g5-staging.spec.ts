import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { auth, browserLogin, login, type Session } from '../support/api';

const BASE = process.env.E2E_PROD_BASE_URL ?? '';
const MAILPIT = process.env.E2E_STAGING_MAILPIT_URL ?? '';
const SOURCE_SHA = process.env.E2E_STAGING_SOURCE_SHA ?? '';
const LEAD_EMAIL = process.env.E2E_PROD_LEAD_EMAIL ?? 'e2e-lead@starteria.test';
const PARTICIPANT_EMAIL = process.env.E2E_PROD_PARTICIPANT_EMAIL ?? 'e2e-participante@starteria.test';
const LEAD_PASSWORD = process.env.E2E_PROD_LEAD_PASSWORD ?? '';
const PARTICIPANT_PASSWORD = process.env.E2E_PROD_PARTICIPANT_PASSWORD ?? '';

type ChallengeRef = { challengeId: string; briefId?: string; briefVersionId?: string };
type Scenario = { id: 'A' | 'B' | 'C'; stamp: string; sessionId: string };

test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let lead: Session;
let participant: Session;
const scenarioSessionIds = new Set<string>();

function assertRuntimeContract() {
  if (!BASE || !MAILPIT || !LEAD_PASSWORD || !PARTICIPANT_PASSWORD) {
    throw new Error('staging goal certification requires base URL, Mailpit and both authenticated actors');
  }
  const base = new URL(BASE);
  const mailpit = new URL(MAILPIT);
  if (base.protocol !== 'https:' || /(^|\.)starter-ia\.com$/i.test(base.hostname)) {
    throw new Error('staging goal certification refuses the production URL');
  }
  if (!['127.0.0.1', 'localhost'].includes(mailpit.hostname)) {
    throw new Error('Mailpit must be reached through the isolated local port-forward');
  }
  if (!/^[0-9a-f]{40}$/i.test(SOURCE_SHA)) throw new Error('a full source SHA is required');
}

test.beforeAll(async () => {
  assertRuntimeContract();
  api = await playwrightRequest.newContext({ baseURL: BASE });
  lead = await login(api, LEAD_EMAIL, LEAD_PASSWORD);
  participant = await login(api, PARTICIPANT_EMAIL, PARTICIPANT_PASSWORD);
});

test.beforeEach(async ({}, testInfo) => {
  testInfo.annotations.push(
    { type: 'source_sha', description: SOURCE_SHA },
    { type: 'environment', description: 'starteria-e2e' },
  );
});

test.afterAll(async () => {
  await api?.dispose();
});

const contextPayload = (scenario: string) => ({
  situation: {
    value: `Contexto sintético ${scenario} confinado a starteria-e2e.`,
    provenance: 'user_declared',
    sourceRef: { kind: 'user_input' },
  },
  area: { value: null, provenance: 'unknown' },
  stakeholder: { value: null, provenance: 'unknown' },
  pilotExperience: { value: null, provenance: 'unknown' },
  constraints: [],
  assumptions: [],
  gaps: [],
});

async function command(
  method: 'get' | 'post' | 'patch' | 'put',
  url: string,
  options: { token?: string; key?: string; data?: Record<string, unknown> } = {},
) {
  const response = await api[method](url, {
    headers: {
      ...(options.token ? auth(options.token) : {}),
      ...(options.key ? { 'Idempotency-Key': options.key } : {}),
    },
    ...(options.data ? { data: options.data } : {}),
    failOnStatusCode: false,
  });
  expect(response.ok(), `${method.toUpperCase()} ${url}: ${await response.text()}`).toBeTruthy();
  return (await response.json()).data;
}

async function beginScenario(id: Scenario['id']): Promise<Scenario> {
  const stamp = `kan236-${id.toLowerCase()}-${Date.now()}`;
  const opened = await command('post', id === 'A'
    ? '/api/v1/portfolio-bootstrap/sessions/direct'
    : '/api/v1/portfolio-bootstrap/sessions/additional-front', {
    token: lead.token,
    ...(id === 'A' ? {} : { key: `${stamp}-additional-front` }),
    data: {},
  });
  const sessionId = opened.bootstrapSession.id as string;
  expect(scenarioSessionIds.has(sessionId), `scenario ${id} must use a fresh re-entry session`).toBe(false);
  scenarioSessionIds.add(sessionId);
  const draft = await command('put', `/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/draft`, {
    token: lead.token,
    key: `${stamp}-context-draft`,
    data: { expectedVersion: 0, context: contextPayload(id), sourceCompanyContext: null },
  });
  expect(draft.version).toBe(1);
  const confirmedContext = await command('post', `/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/confirm`, {
    token: lead.token,
    key: `${stamp}-context-confirm`,
    data: { expectedVersion: 1 },
  });
  expect(confirmedContext.status).toBe('confirmed');

  const updatedAnchor = await command('patch', `/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
    token: lead.token,
    data: {
      contextSummary: `G1 ${id}: contexto empresarial confirmado.`,
      outcomeStatement: `G2 ${id}: mover activación con decisiones trazables.`,
      decisionToEnable: 'Priorizar y decidir el siguiente encargo.',
      businessSignalStatus: 'confirmed',
      businessSignalValue: 'Señal de activación a 30 días.',
    },
  });
  await command('post', `/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, {
    token: lead.token,
    data: { expectedVersion: updatedAnchor.anchor.version },
  });
  return { id, stamp, sessionId };
}

async function analyzeAndReview(scenario: Scenario) {
  const analyzed = await command('post', `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/analyze`, {
    token: lead.token,
    key: `${scenario.stamp}-analysis`,
    data: {},
  });
  expect(analyzed.proposedMutations.length).toBeGreaterThan(0);
  const first = analyzed.proposedMutations[0];
  const rejected = await command(
    'post',
    `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/proposed-mutations/${first.id}/reject`,
    {
      token: lead.token,
      data: { reviewNote: 'Disposición humana: conservar evidencia sin aplicar la propuesta automática.' },
    },
  );
  expect(rejected.mutation.status).toBe('rejected');
}

async function materializeOrganization(
  scenario: Scenario,
  relatedInitiativeIds: string[][],
  ungroupedInitiativeIds: string[],
  expectedEligibilityReason: 'NO_EXISTING_WORK_ELIGIBLE' | 'ANALYZED_WORK_ELIGIBLE',
) {
  const eligibility = await command(
    'get',
    `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/e5-eligibility`,
    { token: lead.token },
  );
  expect(eligibility.allowed).toBe(true);
  expect(eligibility.reasonCodes).toContain(expectedEligibilityReason);

  const candidateIds = relatedInitiativeIds.map((_, index) => `${scenario.stamp}-challenge-${index + 1}`);
  const proposal = await command(
    'put',
    `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/organization-proposal`,
    {
      token: lead.token,
      data: {
        expectedVersion: 0,
        payload: {
          summary: `Organización humana G3 escenario ${scenario.id}.`,
          fronts: [{
            candidateId: `${scenario.stamp}-front`,
            name: `[E2E-STAGING] Frente ${scenario.stamp}`,
            focus: 'Mover activación con decisiones trazables.',
            rationale: 'Un único frente inicial revisado por una persona.',
            coverage: `${relatedInitiativeIds.flat().length} trabajos`,
            challenges: candidateIds.map((candidateId, index) => ({
              candidateId,
              title: `[E2E-STAGING] Reto ${scenario.stamp}-${index + 1}`,
              problem: `Decisión ${index + 1} pendiente.`,
              rationale: 'Activación selectiva y trazable.',
              relatedInitiativeIds: relatedInitiativeIds[index],
              evidence: [],
              gaps: ['Impacto aún no observado.'],
              overlaps: [],
            })),
          }],
          crossCuttingInitiativeIds: [],
          outsideObjectiveInitiativeIds: [],
          ungroupedInitiativeIds,
        },
      },
    },
  );
  const confirmed = await command(
    'post',
    `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/organization-proposal/confirm`,
    {
      token: lead.token,
      key: `${scenario.stamp}-materialize`,
      data: { proposalVersion: proposal.version },
    },
  );
  const mappings = confirmed.materialization.canonicalMappings;
  expect(mappings.fronts).toHaveLength(1);
  expect(mappings.challenges).toHaveLength(candidateIds.length);
  expect(mappings.specialDestinations.ungroupedInitiativeIds).toEqual(ungroupedInitiativeIds);
  return candidateIds.map((candidateId) => ({
    challengeId: mappings.challenges.find((entry: { candidateId: string }) => entry.candidateId === candidateId).canonicalId as string,
  }));
}

async function confirmBrief(scenario: Scenario, challenge: ChallengeRef, suffix: string): Promise<Required<ChallengeRef>> {
  const created = await command('post', `/api/v1/portfolio/challenges/${challenge.challengeId}/activation-briefs`, {
    token: lead.token,
    key: `${scenario.stamp}-brief-${suffix}`,
    data: {
      intent: `Validar ${suffix} sin inventar impacto.`,
      scope: 'Contrastar evidencia y decidir el siguiente movimiento.',
      strategicContextRefs: { objective: 'Mover activación con decisiones trazables.' },
      inheritedContext: {
        challengeProblem: `Decisión ${suffix} pendiente.`,
        expectedDeliverable: 'Recomendación humana con evidencia.',
        decisionToEnable: 'Elegir el siguiente encargo.',
      },
      constraintsSnapshot: ['Mantener confirmación humana.'],
      knownGaps: ['Falta impacto observado.'],
      sourceRefs: [{ source: `KAN-236 ${scenario.id}` }],
      provenance: { source: 'PL05_COPILOT', actorId: lead.userId },
    },
  });
  const versionId = created.brief.versions[0].id as string;
  const confirmed = await command('post', `/api/v1/portfolio/activation-brief-versions/${versionId}/confirm`, {
    token: lead.token,
    key: `${scenario.stamp}-brief-confirm-${suffix}`,
    data: {},
  });
  expect(confirmed.version.status).toBe('CONFIRMED');
  return { challengeId: challenge.challengeId, briefId: created.brief.id, briefVersionId: versionId };
}

async function waitForMailpit(needles: string[]) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const listingResponse = await fetch(`${MAILPIT}/api/v1/messages?limit=100`);
    if (listingResponse.ok) {
      const listing = await listingResponse.json() as {
        messages?: Array<Record<string, unknown>>;
        Messages?: Array<Record<string, unknown>>;
      };
      for (const summary of listing.messages ?? listing.Messages ?? []) {
        const id = summary.ID ?? summary.Id ?? summary.id;
        if (!id) continue;
        const detailResponse = await fetch(`${MAILPIT}/api/v1/message/${encodeURIComponent(String(id))}`);
        if (!detailResponse.ok) continue;
        const serialized = JSON.stringify(await detailResponse.json()).toLowerCase();
        if (needles.every((needle) => serialized.includes(needle.toLowerCase()))) return serialized;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Mailpit did not capture evidence containing: ${needles.join(', ')}`);
}

async function createLabRequest(scenario: Scenario, brief: Required<ChallengeRef>, suffix: string) {
  const payload = {
    challengeId: brief.challengeId,
    briefId: brief.briefId,
    briefVersionId: brief.briefVersionId,
    consentAccepted: true,
    consentPurpose: 'Compartir este Brief confirmado para solicitar contacto humano de Startería Lab.',
  };
  const key = `${scenario.stamp}-lab-${suffix}`;
  const created = await command('post', '/api/v1/portfolio-lab/requests', {
    token: lead.token,
    key,
    data: payload,
  });
  const replay = await command('post', '/api/v1/portfolio-lab/requests', {
    token: lead.token,
    key,
    data: payload,
  });
  expect(replay.request.id).toBe(created.request.id);
  expect(created.request.notificationStatus).toBe('NOTIFIED');
  await waitForMailpit([created.request.id]);
  return created.request.id as string;
}

async function createTeamDelivery(scenario: Scenario, brief: Required<ChallengeRef>) {
  const prepared = await command(
    'post',
    `/api/v1/portfolio/challenges/${brief.challengeId}/handoff-assignments`,
    {
      token: lead.token,
      key: `${scenario.stamp}-team-prepare`,
      data: {
        targetKind: 'CHALLENGE',
        briefId: brief.briefId,
        briefVersionId: brief.briefVersionId,
        contextNote: `Encargo Equipo ${scenario.stamp}.`,
        invitedEmailNormalized: PARTICIPANT_EMAIL,
        members: [{ identityKey: PARTICIPANT_EMAIL, emailNormalized: PARTICIPANT_EMAIL, role: 'OWNER' }],
      },
    },
  );
  const delivered = await command(
    'post',
    `/api/v1/portfolio/handoff-assignments/${prepared.assignment.id}/invitation`,
    { token: lead.token, key: `${scenario.stamp}-team-send`, data: {} },
  );
  expect(delivered).toMatchObject({ state: 'SENT', attemptStatus: 'SUCCEEDED' });
  await waitForMailpit([PARTICIPANT_EMAIL, brief.briefVersionId]);
  return prepared.assignment.id as string;
}

async function completeSetup(scenario: Scenario, route: 'LAB_NOTIFIED' | 'BOTH') {
  const key = `${scenario.stamp}-complete`;
  const first = await command(
    'post',
    `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/complete-setup`,
    { token: lead.token, key, data: { confirmed: true } },
  );
  const replay = await command(
    'post',
    `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/complete-setup`,
    { token: lead.token, key, data: { confirmed: true } },
  );
  expect(first.completionRoute).toBe(route);
  expect(replay.completionRoute).toBe(route);
}

async function addManualWork(scenario: Scenario, labels: string[]) {
  const ids: string[] = [];
  for (const [index, label] of labels.entries()) {
    const result = await command(
      'post',
      `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/work-items/manual`,
      {
        token: lead.token,
        key: `${scenario.stamp}-manual-${index}`,
        data: { label, purpose: `Decidir activación de ${label}`, currentStateHint: 'candidate' },
      },
    );
    ids.push(result.items.find((item: { rawLabel: string }) => item.rawLabel === label).id);
  }
  return ids;
}

async function importRows(scenario: Scenario, kind: 'csv' | 'xlsx', labels: string[]) {
  let content: Buffer;
  let fileName: string;
  let fileType: string;
  if (kind === 'csv') {
    content = Buffer.from([
      'Work,Owner,Status,Purpose,Signal,Notes',
      ...labels.map((label, index) => `${label},Owner ${index + 1},Candidate,Decidir ${label},,Revisión humana pendiente`),
    ].join('\n'));
    fileName = `${scenario.stamp}.csv`;
    fileType = 'text/csv';
  } else {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Work', 'Owner', 'Status', 'Purpose', 'Signal', 'Notes'],
      ...labels.map((label, index) => [label, `Owner ${index + 1}`, 'Candidate', `Decidir ${label}`, '', 'Revisión humana pendiente']),
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Portfolio');
    content = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
    fileName = `${scenario.stamp}.xlsx`;
    fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  const uploaded = await command('post', `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/imports`, {
    token: lead.token,
    data: { fileName, fileType, fileSize: content.length, contentBase64: content.toString('base64') },
  });
  await command('patch', `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/imports/${uploaded.id}/mapping`, {
    token: lead.token,
    data: {
      confirmedMapping: {
        label: 'Work', owner: 'Owner', state: 'Status', purpose: 'Purpose', signal: 'Signal', notes: 'Notes',
      },
    },
  });
  const committed = await command(
    'post',
    `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/imports/${uploaded.id}/commit`,
    { token: lead.token, key: `${scenario.stamp}-import-${kind}`, data: {} },
  );
  expect(committed.workItems).toHaveLength(labels.length);
  return committed.workItems.map((item: { id: string }) => item.id as string);
}

async function openHome(page: Page) {
  await browserLogin(page, LEAD_EMAIL, LEAD_PASSWORD);
  await page.goto('/portfolio/inicio');
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('table', { name: 'Seguimiento operativo del portafolio' })).toBeVisible();
}

test('A · G1-G5 · 0 trabajo → E5 → Brief → Lab/Mailpit → Home', async ({ page }) => {
  const scenario = await beginScenario('A');
  await command('post', `/api/v1/portfolio-bootstrap/sessions/${scenario.sessionId}/work-items/none`, {
    token: lead.token,
    data: {},
  });
  const [challenge] = await materializeOrganization(scenario, [[]], [], 'NO_EXISTING_WORK_ELIGIBLE');
  const brief = await confirmBrief(scenario, challenge, 'lab');
  await createLabRequest(scenario, brief, 'lab');
  await completeSetup(scenario, 'LAB_NOTIFIED');

  const home = await command('get', '/api/v1/portfolio/home', { token: lead.token });
  expect(home.briefs).toEqual(expect.arrayContaining([expect.objectContaining({ briefVersionId: brief.briefVersionId })]));
  expect(home.labRequests).toEqual(expect.arrayContaining([expect.objectContaining({ notificationStatus: 'NOTIFIED' })]));
  const forbidden = await api.get('/api/v1/portfolio/home', { headers: auth(participant.token), failOnStatusCode: false });
  expect(forbidden.status()).toBe(403);

  await openHome(page);
  await expect(page.getByText('Brief confirmado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Contacto pendiente', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
});

test('B · G1-G5 · 3 iniciativas → revisión → 1 frente/2 Briefs → Equipo+Lab → Home', async ({ page }) => {
  const scenario = await beginScenario('B');
  const labels = [
    `${scenario.stamp} Equipo`,
    `${scenario.stamp} Lab`,
    `${scenario.stamp} tercero sin activar`,
  ];
  const workIds = await addManualWork(scenario, labels);
  await analyzeAndReview(scenario);
  const challenges = await materializeOrganization(
    scenario,
    [[workIds[0]], [workIds[1]]],
    [workIds[2]],
    'ANALYZED_WORK_ELIGIBLE',
  );
  const teamBrief = await confirmBrief(scenario, challenges[0], 'team');
  const labBrief = await confirmBrief(scenario, challenges[1], 'lab');
  await createTeamDelivery(scenario, teamBrief);
  await createLabRequest(scenario, labBrief, 'lab');
  await completeSetup(scenario, 'BOTH');

  await openHome(page);
  const filter = page.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' });
  await filter.fill(labels[2]);
  await expect(page.getByRole('row', { name: new RegExp(labels[2]) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(labels[0]) })).toHaveCount(0);
  await filter.clear();
  await expect(page.getByText('Procesada por SMTP', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Contacto pendiente', { exact: true }).first()).toBeVisible();
});

test('C · G1-G5 · 25 CSV/XLSX → revisión → 1 frente → Briefs selectivos → Home responsive', async ({ page }) => {
  const scenario = await beginScenario('C');
  const csvLabels = Array.from({ length: 13 }, (_, index) => `${scenario.stamp} CSV ${index + 1}`);
  const xlsxLabels = Array.from({ length: 12 }, (_, index) => `${scenario.stamp} XLSX ${index + 14}`);
  const workIds = [
    ...await importRows(scenario, 'csv', csvLabels),
    ...await importRows(scenario, 'xlsx', xlsxLabels),
  ];
  expect(workIds).toHaveLength(25);
  await analyzeAndReview(scenario);
  const challenges = await materializeOrganization(
    scenario,
    [[workIds[0]], [workIds[1]]],
    workIds.slice(2),
    'ANALYZED_WORK_ELIGIBLE',
  );
  const selected = await confirmBrief(scenario, challenges[0], 'selected-1');
  await confirmBrief(scenario, challenges[1], 'selected-2');
  await createLabRequest(scenario, selected, 'lab');
  await completeSetup(scenario, 'LAB_NOTIFIED');

  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  await expect(page.getByTestId('portfolio-operational-table-scroll')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Trabajo/Encargo' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Destino/Owner' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Estado real' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Siguiente acción' })).toBeVisible();
  const filter = page.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' });
  await filter.fill(xlsxLabels[11]);
  await expect(page.getByRole('row', { name: new RegExp(xlsxLabels[11]) })).toBeVisible();
});
