import { PrismaClient } from '@prisma/client';
import { expect, request as pwRequest, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import * as XLSX from 'xlsx';
import axe from 'axe-core';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';
const mailpitURL = process.env.E2E_MAILPIT_URL ?? '';

type Lead = Awaited<ReturnType<typeof registerLead>>;
type CanonicalChallenge = { challengeId: string; briefId?: string; briefVersionId?: string };

function bearer(token: string) { return { Authorization: `Bearer ${token}` }; }
function accessToken(body: any): string { return body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? ''; }

async function registerLead(api: APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}-${label}`;
  const email = `kan232-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-232 ${label}`, role: 'participante' },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const organization = await prisma.organization.create({
    data: { name: `KAN-232 ${label} ${stamp}`, slug: `kan232-${stamp}` },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: organization.id, isActive: true },
  });
  await prisma.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'owner' } });
  await prisma.organizationPortfolioAccessGrant.createMany({
    data: ['portfolio:read', 'portfolio:write'].map((capability) => ({ userId, organizationId: organization.id, capability })),
  });
  const login = await api.post('/api/v1/auth/login', { data: { email, password } });
  expect(login.status(), await login.text()).toBe(200);
  return { email, password, userId, organizationId: organization.id, token: accessToken(await login.json()), stamp };
}

async function registerViewer(api: APIRequestContext, label: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}-${label}`;
  const email = `kan232-viewer-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `KAN-232 viewer ${label}`, role: 'participante' },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const userId = (await registration.json()).data.user.id as string;
  const login = await api.post('/api/v1/auth/login', { data: { email, password } });
  expect(login.status(), await login.text()).toBe(200);
  return { email, password, userId, token: accessToken(await login.json()) };
}

async function grantPortfolioReadInOrganization(
  api: APIRequestContext,
  viewer: Awaited<ReturnType<typeof registerViewer>>,
  organizationId: string,
) {
  await prisma.user.update({
    where: { id: viewer.userId },
    data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId, isActive: true },
  });
  await prisma.organizationMember.create({ data: { userId: viewer.userId, organizationId, role: 'member' } });
  await prisma.organizationPortfolioAccessGrant.create({
    data: { userId: viewer.userId, organizationId, capability: 'portfolio:read' },
  });
  const login = await api.post('/api/v1/auth/login', { data: { email: viewer.email, password: viewer.password } });
  expect(login.status(), await login.text()).toBe(200);
  return accessToken(await login.json());
}

async function loginUi(page: Page, lead: Pick<Lead, 'email' | 'password'>) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(lead.email);
  await page.locator('input[type="password"]').fill(lead.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/portfolio\/inicio/, { timeout: 20_000 });
}

async function loginParticipantUi(page: Page, participant: { email: string; password: string }) {
  await page.goto('/auth');
  await page.getByPlaceholder('tu@empresa.com').fill(participant.email);
  await page.locator('input[type="password"]').fill(participant.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });
}

async function assertWcagAA(page: Page, selector: string) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async (target) => {
    const root = document.querySelector(target);
    if (!root) return [{ id: 'missing-target', impact: 'critical', nodes: 1 }];
    const result = await (window as typeof window & { axe: typeof axe }).axe.run(root, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      nodes: item.nodes.map((node) => ({ target: node.target, html: node.html, summary: node.failureSummary })),
    }));
  }, selector);
  expect(violations).toEqual([]);
}

async function captureReleaseViewports(page: Page, testInfo: TestInfo, prefix: string) {
  for (const [name, width, height] of [['mobile', 375, 812], ['tablet', 768, 1024], ['desktop', 1440, 1000]] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${prefix}-${name}-${width}.png`), fullPage: true });
  }
}

async function createAnchoredSession(api: APIRequestContext, lead: Lead) {
  const auth = bearer(lead.token);
  const direct = await api.post('/api/v1/portfolio-bootstrap/sessions/direct', { headers: auth, data: {} });
  expect([200, 201]).toContain(direct.status());
  const sessionId = (await direct.json()).data.bootstrapSession.id as string;
  const anchor = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`, {
    headers: auth,
    data: {
      contextSummary: 'Contexto empresarial confirmado para la certificación G5.',
      outcomeStatement: 'Mover activación con decisiones trazables.',
      decisionToEnable: 'Elegir el siguiente encargo con evidencia.',
      businessSignalStatus: 'confirmed',
      businessSignalValue: 'Activación a 30 días.',
    },
  });
  expect(anchor.status(), await anchor.text()).toBe(200);
  const anchorVersion = (await anchor.json()).data.anchor.version as number;
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, {
    headers: auth, data: { expectedVersion: anchorVersion },
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return sessionId;
}

async function materializeOrganization(
  api: APIRequestContext,
  lead: Lead,
  sessionId: string,
  challengeCount: number,
  relatedInitiativeIds: string[][] = [],
  ungroupedInitiativeIds: string[] = [],
) {
  const auth = bearer(lead.token);
  if (relatedInitiativeIds.flat().length > 0 || ungroupedInitiativeIds.length > 0) {
    const analyzed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/analyze`, {
      headers: { ...auth, 'Idempotency-Key': `kan232-analysis-${lead.stamp}` }, data: {},
    });
    expect(analyzed.status(), await analyzed.text()).toBe(200);
    const mutations = (await analyzed.json()).data.proposedMutations as Array<{ id: string; status: string }>;
    expect(mutations.length).toBeGreaterThan(0);
    const reviewed = await api.post(
      `/api/v1/portfolio-bootstrap/sessions/${sessionId}/proposed-mutations/${mutations[0].id}/reject`,
      {
        headers: auth,
        data: { reviewNote: 'Disposición humana G5: conservar la evidencia sin aplicar esta propuesta automática.' },
      },
    );
    expect(reviewed.status(), await reviewed.text()).toBe(200);
    expect((await reviewed.json()).data.mutation).toMatchObject({ id: mutations[0].id, status: 'rejected' });
    expect(await prisma.portfolioBootstrapProposedMutation.count({
      where: { id: mutations[0].id, bootstrapSessionId: sessionId, status: 'rejected', reviewedBy: lead.userId },
    })).toBe(1);
  }
  const eligibility = await api.get(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/e5-eligibility`, { headers: auth });
  expect(eligibility.status(), await eligibility.text()).toBe(200);
  expect((await eligibility.json()).data.allowed).toBe(true);

  const frontCandidateId = `front-${lead.stamp}`;
  const proposalChallenges = Array.from({ length: challengeCount }, (_, index) => ({
    candidateId: `challenge-${lead.stamp}-${index}`,
    title: `Reto G5 ${index + 1} ${lead.stamp}`,
    problem: `Decisión selectiva ${index + 1} pendiente.`,
    rationale: 'Permite activar sólo el trabajo pertinente.',
    relatedInitiativeIds: relatedInitiativeIds[index] ?? [],
    evidence: [],
    gaps: ['Falta observar impacto real.'],
    overlaps: [],
  }));
  const saved = await api.put(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/organization-proposal`, {
    headers: auth,
    data: {
      expectedVersion: 0,
      payload: {
        summary: 'Organización G5 confirmada.',
        fronts: [{
          candidateId: frontCandidateId,
          name: `Frente G5 ${lead.stamp}`,
          focus: 'Mover activación con decisiones trazables.',
          rationale: 'Un único frente inicial.',
          coverage: `${relatedInitiativeIds.flat().length} iniciativas`,
          challenges: proposalChallenges,
        }],
        crossCuttingInitiativeIds: [],
        outsideObjectiveInitiativeIds: [],
        ungroupedInitiativeIds,
      },
    },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  const proposalVersion = (await saved.json()).data.version as number;
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/organization-proposal/confirm`, {
    headers: { ...auth, 'Idempotency-Key': `kan232-materialize-${lead.stamp}` },
    data: { proposalVersion },
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  const mappings = (await confirmed.json()).data.materialization.canonicalMappings as {
    fronts: Array<{ candidateId: string; canonicalId: string }>;
    challenges: Array<{ candidateId: string; canonicalId: string; relatedInitiativeIds: string[] }>;
    specialDestinations: { ungroupedInitiativeIds: string[] };
  };
  expect(mappings.challenges).toHaveLength(challengeCount);
  expect(mappings.specialDestinations.ungroupedInitiativeIds).toEqual(ungroupedInitiativeIds);
  return {
    frontId: mappings.fronts[0].canonicalId,
    challenges: proposalChallenges.map((candidate) => ({
      challengeId: mappings.challenges.find((mapping) => mapping.candidateId === candidate.candidateId)!.canonicalId,
    })),
  };
}

async function confirmBrief(api: APIRequestContext, lead: Lead, challenge: CanonicalChallenge, suffix: string) {
  const auth = bearer(lead.token);
  const created = await api.post(`/api/v1/portfolio/challenges/${challenge.challengeId}/activation-briefs`, {
    headers: { ...auth, 'Idempotency-Key': `kan232-brief-${lead.stamp}-${suffix}` },
    data: {
      intent: `Validar intervención ${suffix} sin inventar impacto.`,
      scope: 'Contrastar evidencia y decidir el siguiente movimiento.',
      strategicContextRefs: { objective: 'Mover activación con decisiones trazables.' },
      inheritedContext: {
        challengeProblem: `Decisión ${suffix} pendiente.`,
        expectedDeliverable: 'Recomendación humana con evidencia.',
        decisionToEnable: 'Elegir el siguiente encargo.',
      },
      constraintsSnapshot: ['Mantener confirmación humana.'],
      knownGaps: ['Falta impacto observado.'],
      sourceRefs: [{ source: 'KAN-232 E2E' }],
      provenance: { source: 'PL05_COPILOT', actorId: lead.userId },
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const brief = (await created.json()).data.brief;
  const briefVersionId = brief.versions[0].id as string;
  const confirmed = await api.post(`/api/v1/portfolio/activation-brief-versions/${briefVersionId}/confirm`, {
    headers: { ...auth, 'Idempotency-Key': `kan232-confirm-${lead.stamp}-${suffix}` }, data: {},
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  return { challengeId: challenge.challengeId, briefId: brief.id as string, briefVersionId };
}

async function createLabRequest(api: APIRequestContext, lead: Lead, brief: Required<CanonicalChallenge>, suffix: string) {
  const body = {
    challengeId: brief.challengeId,
    briefId: brief.briefId,
    briefVersionId: brief.briefVersionId,
    consentAccepted: true,
    consentPurpose: 'Compartir este Brief confirmado para solicitar contacto humano de Startería Lab.',
  };
  const headers = { ...bearer(lead.token), 'Idempotency-Key': `kan232-lab-${lead.stamp}-${suffix}` };
  const [first, replay] = await Promise.all([
    api.post('/api/v1/portfolio-lab/requests', { headers, data: body }),
    api.post('/api/v1/portfolio-lab/requests', { headers, data: body }),
  ]);
  expect([200, 201]).toContain(first.status());
  expect([200, 201]).toContain(replay.status());
  const firstBody = await first.json();
  const replayBody = await replay.json();
  expect(replayBody.data.request.id).toBe(firstBody.data.request.id);
  const requestId = firstBody.data.request.id as string;
  expect(await prisma.portfolioLabRequest.count({
    where: { organizationId: lead.organizationId, challengeId: brief.challengeId, briefVersionId: brief.briefVersionId },
  })).toBe(1);
  const persisted = await prisma.portfolioLabRequest.findUniqueOrThrow({ where: { id: requestId } });
  expect(persisted.notificationStatus).toBe('NOTIFIED');
  expect(persisted.providerMessageRef).toBeTruthy();
  await waitForMailpit([requestId]);
  return requestId;
}

async function waitForMailpit(needles: string[]): Promise<string> {
  if (!mailpitURL) throw new Error('E2E_MAILPIT_URL is required; simulated delivery evidence is not accepted.');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const listing = await fetch(`${mailpitURL}/api/v1/messages?limit=100`);
    if (listing.ok) {
      const body = await listing.json() as { messages?: Array<Record<string, unknown>>; Messages?: Array<Record<string, unknown>> };
      for (const summary of body.messages ?? body.Messages ?? []) {
        const id = summary.ID ?? summary.Id ?? summary.id;
        if (!id) continue;
        const detail = await fetch(`${mailpitURL}/api/v1/message/${encodeURIComponent(String(id))}`);
        if (!detail.ok) continue;
        const serialized = JSON.stringify(await detail.json());
        if (needles.every((needle) => serialized.toLowerCase().includes(needle.toLowerCase()))) return serialized;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Mailpit did not capture evidence containing: ${needles.join(', ')}`);
}

async function createTeamAssignment(
  api: APIRequestContext,
  lead: Lead,
  brief: Required<CanonicalChallenge>,
  outcome: 'accept' | 'reject',
  suffix: string,
) {
  const recipient = await registerViewer(api, `team-${suffix}`);
  const invitedEmail = recipient.email;
  const response = await api.post(`/api/v1/portfolio/challenges/${brief.challengeId}/handoff-assignments`, {
    headers: { ...bearer(lead.token), 'Idempotency-Key': `kan232-assignment-${lead.stamp}-${suffix}` },
    data: {
      targetKind: 'CHALLENGE', briefId: brief.briefId, briefVersionId: brief.briefVersionId,
      contextNote: 'Encargo trazable G5.', invitedEmailNormalized: invitedEmail,
      members: [{ identityKey: invitedEmail, emailNormalized: invitedEmail, role: 'OWNER' }],
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const assignment = (await response.json()).data.assignment;
  const stale = await api.patch(`/api/v1/portfolio/handoff-assignments/${assignment.id}/preparation`, {
    headers: { ...bearer(lead.token), 'Idempotency-Key': `kan232-stale-${lead.stamp}-${suffix}` },
    data: {
      expectedVersion: 999,
      contextNote: 'Intento stale que no debe aplicar.',
      invitedEmailNormalized: invitedEmail,
      members: [{ identityKey: invitedEmail, emailNormalized: invitedEmail, role: 'OWNER' }],
    },
    failOnStatusCode: false,
  });
  expect(stale.status()).toBe(409);
  const sent = await api.post('/api/v1/portfolio/handoff-assignments/batch/invitations', {
    headers: { ...bearer(lead.token), 'Idempotency-Key': `kan232-team-send-${lead.stamp}-${suffix}` },
    data: { challengeId: brief.challengeId, items: [{ assignmentId: assignment.id, expectedVersion: assignment.version }], retryOfBatchId: null },
  });
  expect(sent.status(), await sent.text()).toBe(200);
  expect((await sent.json()).data).toMatchObject({
    status: 'COMPLETED', succeededCount: 1,
    results: [expect.objectContaining({ assignmentId: assignment.id, status: 'SUCCEEDED', state: 'SENT' })],
  });
  const serializedMail = await waitForMailpit([invitedEmail, brief.briefVersionId]);
  const invitationToken = serializedMail.match(/\/handoff\/invitations\/([a-f0-9]{64})/i)?.[1];
  expect(invitationToken).toBeTruthy();
  const durableAttempt = await prisma.portfolioHandoffDeliveryAttempt.findFirstOrThrow({
    where: { assignmentId: assignment.id }, orderBy: { attemptedAt: 'desc' },
  });
  expect(durableAttempt).toMatchObject({ status: 'SUCCEEDED', errorCategory: null });
  expect(durableAttempt.providerMessageRef).toBeTruthy();
  const claimed = await api.post('/api/v1/public/handoff-invitations/claim', {
    headers: bearer(recipient.token), data: { token: invitationToken! },
  });
  expect(claimed.status(), await claimed.text()).toBe(200);
  const claimData = (await claimed.json()).data;
  expect(claimData.identityClaimStatus).toBe('MATCHED');
  const responseHeaders = {
    ...bearer(recipient.token),
    'Idempotency-Key': `kan232-${outcome}-${lead.stamp}-${suffix}`,
  };
  const transition = outcome === 'accept'
    ? await api.post(`/api/v1/handoff/assignments/${assignment.id}/accept`, {
      headers: responseHeaders, data: { expectedVersion: claimData.version },
    })
    : await api.post(`/api/v1/handoff/assignments/${assignment.id}/reject`, {
      headers: responseHeaders, data: { expectedVersion: claimData.version, reason: 'No hay capacidad disponible.' },
    });
  expect(transition.status(), await transition.text()).toBe(200);
  const transitioned = (await transition.json()).data;
  expect(transitioned.state).toBe(outcome === 'accept' ? 'ACCEPTED' : 'REJECTED');
  if (outcome === 'accept') {
    expect(transitioned.initiativeId).toBeNull();
    expect(await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: assignment.id } }))
      .toMatchObject({ state: 'ACCEPTED', targetKind: 'CHALLENGE', initiativeId: null });
  }
  return assignment.id as string;
}

async function completeSetup(api: APIRequestContext, lead: Lead, sessionId: string, expectedRoute: 'TEAM_SENT' | 'LAB_NOTIFIED' | 'BOTH') {
  const headers = { ...bearer(lead.token), 'Idempotency-Key': `kan232-complete-${lead.stamp}` };
  const first = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/complete-setup`, {
    headers, data: { confirmed: true },
  });
  expect(first.status(), await first.text()).toBe(200);
  expect((await first.json()).data.completionRoute).toBe(expectedRoute);
  const replay = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/complete-setup`, {
    headers, data: { confirmed: true },
  });
  expect(replay.status(), await replay.text()).toBe(200);
  expect((await replay.json()).data.completionRoute).toBe(expectedRoute);
}

async function importRows(api: APIRequestContext, lead: Lead, sessionId: string, kind: 'csv' | 'xlsx', rows: string[]) {
  const headers = bearer(lead.token);
  let content: Buffer;
  let fileName: string;
  let fileType: string;
  if (kind === 'csv') {
    const csv = ['Work,Owner,Status,Purpose,Signal,Notes', ...rows.map((label, index) =>
      `${label},Owner ${index + 1},Candidate,Propósito ${index + 1},,Revisión humana pendiente`)].join('\n');
    content = Buffer.from(csv);
    fileName = `kan232-${lead.stamp}.csv`;
    fileType = 'text/csv';
  } else {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Work', 'Owner', 'Status', 'Purpose', 'Signal', 'Notes'],
      ...rows.map((label, index) => [label, `Owner ${index + 1}`, 'Candidate', `Propósito ${index + 1}`, '', 'Revisión humana pendiente']),
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Portfolio');
    content = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
    fileName = `kan232-${lead.stamp}.xlsx`;
    fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  const uploaded = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/imports`, {
    headers,
    data: { fileName, fileType, fileSize: content.length, contentBase64: content.toString('base64') },
  });
  expect(uploaded.status(), await uploaded.text()).toBe(200);
  const importId = (await uploaded.json()).data.id as string;
  const mapped = await api.patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/imports/${importId}/mapping`, {
    headers,
    data: { confirmedMapping: { label: 'Work', owner: 'Owner', state: 'Status', purpose: 'Purpose', signal: 'Signal', notes: 'Notes' } },
  });
  expect(mapped.status(), await mapped.text()).toBe(200);
  const commitHeaders = { ...headers, 'Idempotency-Key': `kan232-import-${lead.stamp}-${kind}` };
  const committed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/imports/${importId}/commit`, {
    headers: commitHeaders, data: {},
  });
  expect(committed.status(), await committed.text()).toBe(200);
  const replay = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/imports/${importId}/commit`, {
    headers: commitHeaders, data: {},
  });
  expect(replay.status(), await replay.text()).toBe(200);
  expect((await replay.json()).data.workItems).toHaveLength(rows.length);
}

test.describe('KAN-232 G5 authenticated PostgreSQL certification', () => {
  test.beforeAll(() => {
    expect(process.env.E2E_WITH_MAILPIT).toBe('true');
    expect(mailpitURL).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
    expect(process.env.HANDOFF_EMAIL_TRANSPORT_MODE).toBe('sandbox');
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('A · emprendedor sin iniciativas → E5 → Brief → Lab → Home, reentrada y aislamiento', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'scenario-a');
    const other = await registerLead(api, 'other-tenant');
    const viewer = await registerViewer(api, 'forbidden');
    const sessionId = await createAnchoredSession(api, lead);
    const noWork = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/work-items/none`, {
      headers: bearer(lead.token), data: {},
    });
    expect(noWork.status(), await noWork.text()).toBe(200);
    const structure = await materializeOrganization(api, lead, sessionId, 1);
    const brief = await confirmBrief(api, lead, structure.challenges[0], 'a');
    const requestId = await createLabRequest(api, lead, brief as Required<CanonicalChallenge>, 'a');
    await completeSetup(api, lead, sessionId, 'LAB_NOTIFIED');

    const crossTenant = await api.get('/api/v1/portfolio/home', { headers: bearer(other.token) });
    expect(crossTenant.status(), await crossTenant.text()).toBe(200);
    const crossBody = (await crossTenant.json()).data;
    expect(crossBody.briefs).toEqual([]);
    expect(crossBody.labRequests).toEqual([]);
    const hiddenRequest = await api.get(`/api/v1/portfolio-lab/requests/${requestId}`, {
      headers: bearer(other.token), failOnStatusCode: false,
    });
    expect(hiddenRequest.status()).toBe(404);
    const forbidden = await api.post('/api/v1/portfolio/strategic-fronts', {
      headers: bearer(viewer.token), data: { name: 'No autorizado' }, failOnStatusCode: false,
    });
    expect(forbidden.status()).toBe(403);
    const forbiddenHome = await api.get('/api/v1/portfolio/home', {
      headers: bearer(viewer.token), failOnStatusCode: false,
    });
    expect(forbiddenHome.status()).toBe(403);

    await loginUi(page, lead);
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('table', { name: 'Seguimiento operativo del portafolio' })).toBeVisible();
    await expect(page.getByText('Brief confirmado', { exact: true })).toBeVisible();
    await expect(page.getByText('Contacto pendiente', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-field="roi"]')).toHaveText('Sin datos');
    await expect(page.locator('[data-field="impact"]')).toHaveText('Sin datos');
    await assertWcagAA(page, '[data-testid="portfolio-overview-home"]');
    await page.screenshot({ path: testInfo.outputPath('A-emprendedor-sin-iniciativas-home.png'), fullPage: true });
    await page.reload();
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/auth/);
    await loginUi(page, lead);
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
    await api.dispose();
  });

  test('B · pyme con 3 iniciativas → un frente/dos Briefs → Equipo+Lab → tercero sin activar → Home', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'scenario-b');
    const sessionId = await createAnchoredSession(api, lead);
    const labels = ['Trabajo activado por equipo', 'Trabajo activado por Lab', 'Tercero sin activar'];
    for (const label of labels) {
      const added = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/work-items/manual`, {
        headers: bearer(lead.token), data: { label, purpose: `Propósito de ${label}`, currentStateHint: 'candidate' },
      });
      expect(added.status(), await added.text()).toBe(200);
    }
    const workItems = await prisma.portfolioBootstrapWorkItem.findMany({
      where: { bootstrapSessionId: sessionId }, orderBy: { createdAt: 'asc' },
    });
    expect(workItems).toHaveLength(3);
    const sameTenantLead = await registerViewer(api, 'same-tenant-lead');
    const sameTenantToken = await grantPortfolioReadInOrganization(api, sameTenantLead, lead.organizationId);
    const ownerScopedHome = await api.get('/api/v1/portfolio/home', { headers: bearer(sameTenantToken) });
    expect(ownerScopedHome.status(), await ownerScopedHome.text()).toBe(200);
    expect((await ownerScopedHome.json()).data.workItems).toEqual([]);
    const structure = await materializeOrganization(api, lead, sessionId, 2, [[workItems[0].id], [workItems[1].id]], [workItems[2].id]);
    const teamBrief = await confirmBrief(api, lead, structure.challenges[0], 'team');
    const labBrief = await confirmBrief(api, lead, structure.challenges[1], 'lab');
    const stepsBeforeAccept = await prisma.step.count();
    await createTeamAssignment(api, lead, teamBrief as Required<CanonicalChallenge>, 'accept', 'accepted');
    expect(await prisma.step.count()).toBe(stepsBeforeAccept);
    await createTeamAssignment(api, lead, labBrief as Required<CanonicalChallenge>, 'reject', 'rejected');
    const labRequestId = await createLabRequest(api, lead, labBrief as Required<CanonicalChallenge>, 'b');
    await completeSetup(api, lead, sessionId, 'BOTH');

    await loginUi(page, lead);
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Aceptada', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Rechazada', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Contacto pendiente', { exact: true }).first()).toBeVisible();
    const filter = page.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' });
    await filter.fill('Tercero sin activar');
    const table = page.getByRole('table', { name: 'Seguimiento operativo del portafolio' });
    await expect(table.getByRole('row', { name: /Tercero sin activar/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /Trabajo activado por equipo/ })).toHaveCount(0);
    await filter.clear();
    const detail = page.getByRole('button', { name: /Ver detalle de Tercero sin activar/ });
    await detail.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Ocultar detalle' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Fuente y procedencia:', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('B-pyme-reentrada-y-procedencia.png'), fullPage: true });
    await api.dispose();
  });

  test('C · corporate con 25 CSV/XLSX → revisión → un frente → Briefs selectivos → Home responsive', async ({ page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'scenario-c');
    const sessionId = await createAnchoredSession(api, lead);
    const csvRows = Array.from({ length: 13 }, (_, index) => `CSV trabajo ${index + 1}`);
    const xlsxRows = Array.from({ length: 12 }, (_, index) => `XLSX trabajo ${index + 14}`);
    await importRows(api, lead, sessionId, 'csv', csvRows);
    await importRows(api, lead, sessionId, 'xlsx', xlsxRows);
    const workItems = await prisma.portfolioBootstrapWorkItem.findMany({ where: { bootstrapSessionId: sessionId } });
    expect(workItems).toHaveLength(25);
    const before = {
      projects: await prisma.project.count({ where: { organizationId: lead.organizationId } }),
      assignments: await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId } }),
      steps: await prisma.step.count(),
    };
    const structure = await materializeOrganization(
      api, lead, sessionId, 2,
      [[workItems[0].id], [workItems[1].id]],
      workItems.slice(2).map((item) => item.id),
    );
    const selectedBrief = await confirmBrief(api, lead, structure.challenges[0], 'c-selected');
    await confirmBrief(api, lead, structure.challenges[1], 'c-second-selected');
    const requestId = await createLabRequest(api, lead, selectedBrief as Required<CanonicalChallenge>, 'c');
    await completeSetup(api, lead, sessionId, 'LAB_NOTIFIED');
    expect(await prisma.project.count({ where: { organizationId: lead.organizationId } })).toBe(before.projects);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId: lead.organizationId } })).toBe(before.assignments);
    expect(await prisma.step.count()).toBe(before.steps);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginUi(page, lead);
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('portfolio-operational-table-scroll')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Trabajo/Encargo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Destino/Owner' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Estado real' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Siguiente acción' })).toBeVisible();
    const filter = page.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' });
    await filter.fill('XLSX trabajo 25');
    await expect(page.getByRole('row', { name: /XLSX trabajo 25/ })).toBeVisible();
    await expect(page.getByText('0', { exact: true }).first()).toBeVisible();
    await assertWcagAA(page, '[data-testid="portfolio-overview-home"]');
    await page.screenshot({ path: testInfo.outputPath('C-corporate-home-390.png'), fullPage: true });
    await api.dispose();
  });

  test('D · iniciativa avanzada → recorrido humano continuo E1–E7 → SMTP sandbox Mailpit → aceptación sin iniciar Steps → reentrada', async ({ browser, page }, testInfo) => {
    const api = await pwRequest.newContext({ baseURL });
    const lead = await registerLead(api, 'scenario-d-advanced');
    const recipient = await registerViewer(api, 'advanced-owner');
    const project = await prisma.project.create({
      data: {
        name: 'Iniciativa canónica avanzada',
        description: 'Proyecto preexistente en Step 2; E7 no debe alterar su ejecución.',
        ownerId: lead.userId,
        organizationId: lead.organizationId,
        status: 'IN_PROGRESS',
        currentStep: 2,
        steps: {
          create: [
            { number: 1, name: 'Step 1 existente', status: 'APPROVED', progress: 100 },
            { number: 2, name: 'Step 2 existente', status: 'IN_PROGRESS', progress: 40 },
            { number: 3, name: 'Step 3 existente', status: 'BLOCKED', progress: 0 },
            { number: 4, name: 'Step 4 existente', status: 'BLOCKED', progress: 0 },
          ],
        },
      },
    });
    const before = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: {
        ownerId: true,
        currentStep: true,
        status: true,
        steps: { orderBy: { number: 'asc' }, select: { id: true, number: true, status: true, progress: true } },
      },
    });

    await loginUi(page, lead);
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Preparar nueva oportunidad' }).click();
    await expect(page.getByText('Configurar con Copilot · 1 de 7')).toBeVisible({ timeout: 20_000 });

    // E1 · contexto: la persona responde, revisa y confirma; Copilot no decide por ella.
    await page.getByLabel('Tu respuesta').fill(
      'Somos una pyme B2B de 12 personas. Nunca hemos probado una reasignación formal de iniciativas avanzadas.',
    );
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await page.getByRole('button', { name: 'No aplica en este caso' }).click();
    await page.getByLabel('Tu respuesta').fill(
      'La responsable sería la Portfolio Lead y la nueva owner debe revisar el encargo antes de aceptar.',
    );
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();
    await page.getByRole('button', { name: 'Sí, conservar esta información' }).click();
    await page.getByRole('button', { name: 'Revisar contexto' }).click();
    await page.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' }).click();
    await page.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' }).click();
    await page.screenshot({ path: testInfo.outputPath('D-E1-contexto-confirmado.png'), fullPage: true });

    // E2 · objetivo: el turno queda confirmado antes de incorporar trabajo existente.
    const objectiveConversation = page.getByTestId('portfolio-objective-conversation');
    for (const { prompt, answer } of [
      { prompt: /qué resultado de negocio quieres mover/i, answer: 'Conservar el avance de la iniciativa y transferir la responsabilidad con trazabilidad.' },
      { prompt: /qué contexto explica/i, answer: 'La iniciativa ya está en Step 2 y no debe reiniciarse al aceptar el encargo.' },
      { prompt: /qué te gustaría poder decidir mejor/i, answer: 'Decidir quién continúa el trabajo con el Brief confirmado como contexto.' },
    ]) {
      await expect(objectiveConversation.getByText(prompt)).toBeVisible();
      const response = objectiveConversation.getByLabel('Tu respuesta');
      await response.fill(answer);
      const send = objectiveConversation.getByRole('button', { name: 'Enviar respuesta' });
      await expect(send).toBeEnabled();
      const persisted = page.waitForResponse((candidate) => candidate.request().method() === 'PATCH'
        && /\/portfolio-bootstrap\/sessions\/[^/]+\/anchor$/.test(new URL(candidate.url()).pathname));
      await send.click();
      expect((await persisted).status()).toBe(200);
    }
    await expect(objectiveConversation.getByText(/cómo sabrás que el resultado está mejorando/i)).toBeVisible();
    const finalSave = page.waitForResponse((candidate) => candidate.request().method() === 'PATCH'
      && /\/portfolio-bootstrap\/sessions\/[^/]+\/anchor$/.test(new URL(candidate.url()).pathname));
    await objectiveConversation.getByRole('button', { name: /No lo s/i }).click();
    expect((await finalSave).status()).toBe(200);
    const confirmation = page.waitForResponse((candidate) => candidate.request().method() === 'POST'
      && /\/portfolio-bootstrap\/sessions\/[^/]+\/anchor\/confirm$/.test(new URL(candidate.url()).pathname));
    await page.getByRole('button', { name: 'Confirmar este punto de partida y continuar' }).click();
    expect((await confirmation).status()).toBe(200);

    const confirmedSession = await prisma.portfolioBootstrapSession.findFirstOrThrow({
      where: { userId: lead.userId }, include: { anchor: true },
    });
    const sessionId = confirmedSession.id;
    expect(confirmedSession).toMatchObject({ status: 'awaiting_work_intake', bootstrapPhase: 'B2_WORK_INTAKE' });
    expect(confirmedSession.anchor).toMatchObject({ status: 'anchor_confirmed', provenanceStatus: 'user_confirmed' });
    const continueToE3 = page.getByRole('button', { name: 'Continuar a Incorporación' });
    await expect(continueToE3).toBeVisible();
    await expect(continueToE3).toBeEnabled();
    await continueToE3.click();

    // E3 · incorporación: la iniciativa se registra desde la UX y conserva procedencia manual.
    const workIntake = page.getByTestId('portfolio-bootstrap-work-intake');
    await expect(workIntake).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: testInfo.outputPath('D-E3-incorporacion-persistida.png'), fullPage: true });
    await page.reload();
    await expect(workIntake).toBeVisible({ timeout: 20_000 });
    const reenteredSession = await prisma.portfolioBootstrapSession.findUniqueOrThrow({
      where: { id: sessionId }, include: { anchor: true },
    });
    expect(reenteredSession).toMatchObject({ status: 'awaiting_work_intake', bootstrapPhase: 'B2_WORK_INTAKE' });
    expect(reenteredSession.anchor).toMatchObject({ status: 'anchor_confirmed', provenanceStatus: 'user_confirmed' });
    await page.getByRole('button', { name: /A.adir manualmente/ }).click();
    await page.getByLabel(/Nombre o descripci.n breve/).fill('Iniciativa avanzada Step 2');
    await page.getByLabel(/Que intenta conseguir|Qu. intenta conseguir/).fill('Conservar el avance y reasignar con trazabilidad.');
    await page.getByRole('button', { name: 'Agregar trabajo' }).click();
    await page.getByRole('button', { name: 'Analizar 1 iniciativas' }).click();

    const sourceWorkItem = await prisma.portfolioBootstrapWorkItem.findFirstOrThrow({
      where: { bootstrapSessionId: sessionId, rawLabel: 'Iniciativa avanzada Step 2' },
    });
    expect(sourceWorkItem.sourceType).toBe('manual_entry');

    // E4 · análisis: la lectura provisional se abre y revisa antes de avanzar.
    const materialReview = page.getByTestId('portfolio-bootstrap-material-review');
    await expect(materialReview).toBeVisible({ timeout: 20_000 });
    await materialReview.getByRole('button', { name: 'Ver análisis' }).first().click();
    const analysisDialog = page.getByRole('dialog', { name: 'Análisis de Iniciativa avanzada Step 2' });
    await expect(analysisDialog).toContainText('Interpretación provisional — no decisión');
    await expect(analysisDialog).toContainText('Revisión/corrección del Portfolio Lead');
    await page.screenshot({ path: testInfo.outputPath('D-E4-analisis-revision-humana.png'), fullPage: true });
    await analysisDialog.getByRole('button', { name: 'Cerrar' }).click();
    await page.getByRole('button', { name: 'Continuar a organización' }).click();

    // E5 · organización: se confirma desde la propuesta revisable, sin crear ni arrancar Steps.
    const organizationProposal = page.getByTestId('portfolio-organization-proposal');
    await expect(organizationProposal).toBeVisible({ timeout: 20_000 });
    await expect(organizationProposal).toContainText('Objetivo → Frente estratégico → Reto → Iniciativas');
    await organizationProposal.getByRole('button', { name: 'Mover Iniciativa avanzada Step 2' }).click();
    const initiativeDestination = organizationProposal.getByLabel('Nuevo destino para Iniciativa avanzada Step 2');
    const challengeDestination = await initiativeDestination.locator('option').filter({ hasText: /^Reto 1 ·/ }).getAttribute('value');
    expect(challengeDestination).toBeTruthy();
    await initiativeDestination.selectOption(challengeDestination!);
    await expect(organizationProposal.locator('[data-testid^="organization-challenge-"]')).toContainText('Iniciativa avanzada Step 2');
    await page.screenshot({ path: testInfo.outputPath('D-E5-organizacion-revisable.png'), fullPage: true });
    await organizationProposal.getByRole('button', { name: 'Confirmar estructura estratégica' }).click();
    await expect(page.getByText('PL-05 · Briefs').first()).toBeVisible({ timeout: 20_000 });

    const materialization = await prisma.portfolioOrganizationMaterialization.findUniqueOrThrow({
      where: { bootstrapSessionId: sessionId },
    });
    const mappings = materialization.canonicalMappings as {
      fronts: Array<{ canonicalId: string }>;
      challenges: Array<{ canonicalId: string; relatedInitiativeIds: string[] }>;
    };
    expect(mappings.challenges[0].relatedInitiativeIds).toEqual([sourceWorkItem.id]);
    const structure = {
      frontId: mappings.fronts[0].canonicalId,
      challenges: [{ challengeId: mappings.challenges[0].canonicalId }],
    };
    await prisma.initiativePortfolioMeta.create({
      data: {
        projectId: project.id,
        challengeId: structure.challenges[0].challengeId,
        strategicFrontId: structure.frontId,
        teamOwner: lead.email,
        currentStep: 'Step 2',
        status: 'en_step_2',
      },
    });

    // E6 · Brief: borrador y versión confirmada se crean desde la UX.
    const briefBoundary = page.getByTestId('pl05-brief-boundary');
    await briefBoundary.getByRole('button', { name: 'Preparar primer Brief' }).click();
    const briefPanel = page.getByTestId('challenge-activation-brief-panel');
    await briefPanel.getByLabel('Qué buscamos conseguir').fill('Continuar la iniciativa avanzada sin reiniciar su ejecución.');
    await briefPanel.getByLabel('Qué esperamos que entregue').fill('Una continuidad asumida explícitamente, con contexto y procedencia verificables.');
    await briefPanel.getByRole('button', { name: 'Guardar borrador' }).click();
    await briefPanel.getByRole('button', { name: 'Confirmar esta versión' }).click();
    await expect(briefPanel.getByText('Versión 1 confirmada', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('D-E6-brief-confirmado.png'), fullPage: true });
    const persistedBriefRecord = await prisma.challengeActivationBrief.findFirstOrThrow({
      where: { challengeId: structure.challenges[0].challengeId },
      include: { versions: { where: { status: 'CONFIRMED' } } },
    });
    const confirmedBriefVersion = persistedBriefRecord.versions[0];
    expect(confirmedBriefVersion).toBeTruthy();
    const brief = { briefId: persistedBriefRecord.id, briefVersionId: confirmedBriefVersion.id };
    await briefPanel.getByRole('button', { name: 'Continuar a asignación' }).click();

    // E7 se alcanza por el control visible del Brief confirmado, no por una URL fabricada.
    const preparation = page.getByTestId('pl06a-assignment-preparation');
    await expect(preparation).toHaveAttribute('data-brief-version-id', brief.briefVersionId, { timeout: 20_000 });
    await preparation.getByRole('button', { name: '+ Asignar responsable' }).click();
    await preparation.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }).check();
    await preparation.getByLabel('Iniciativa a continuar').selectOption(project.id);
    await preparation.getByLabel('Persona responsable').fill(recipient.email);
    await preparation.getByLabel('Adjuntar también este Brief confirmado').check();
    await preparation.getByLabel('Contexto específico del encargo').fill('Continuar desde Step 2 después de revisar el Brief; aceptar no inicia el trabajo.');
    await preparation.getByRole('button', { name: 'Revisar asignación' }).click();
    await expect(preparation.getByRole('heading', { name: 'Revisa este encargo' })).toBeVisible();
    await preparation.getByRole('button', { name: 'Guardar asignación' }).click();
    await expect(preparation.getByText('Preparada, sin enviar', { exact: true })).toBeVisible();

    const assignment = await prisma.portfolioHandoffAssignment.findFirstOrThrow({
      where: { organizationId: lead.organizationId, initiativeId: project.id, briefVersionId: brief.briefVersionId },
      include: { members: true },
    });
    expect(assignment).toMatchObject({
      challengeId: structure.challenges[0].challengeId,
      targetKind: 'EXISTING_INITIATIVE',
      state: 'CREATED',
      invitedEmailNormalized: recipient.email,
      createdByActorId: lead.userId,
    });
    expect(assignment.members.filter((member) => member.role === 'OWNER')).toHaveLength(1);
    expect(await prisma.portfolioHandoffInvitation.count({ where: { assignmentId: assignment.id } })).toBe(0);
    expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: assignment.id } })).toBe(0);

    await preparation.getByRole('checkbox', { name: `Seleccionar invitación para ${recipient.email}` }).check();
    await preparation.getByRole('button', { name: 'Revisar y enviar seleccionados (1)' }).click();
    await expect(preparation.getByRole('region', { name: 'Revisión de invitaciones' })).toContainText(recipient.email);
    await assertWcagAA(page, '[data-testid="pl06a-assignment-preparation"]');
    await page.screenshot({ path: testInfo.outputPath('D-E7-revision-humana.png'), fullPage: true });
    await preparation.getByRole('button', { name: 'Confirmar envío de 1 invitación' }).click();
    await expect(preparation.getByText('Enviada (SMTP aceptado)', { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    const serializedMail = await waitForMailpit([recipient.email, brief.briefVersionId]);
    const invitationToken = serializedMail.match(/\/handoff\/invitations\/([a-f0-9]{64})/i)?.[1];
    expect(invitationToken).toBeTruthy();
    const sent = await prisma.portfolioHandoffAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
      include: { deliveryAttempts: true, invitations: true },
    });
    expect(sent.state).toBe('SENT');
    expect(sent.deliveryAttempts).toEqual([expect.objectContaining({ status: 'SUCCEEDED', errorCategory: null })]);
    expect(sent.deliveryAttempts[0].providerMessageRef).toBeTruthy();
    expect(sent.invitations).toHaveLength(1);

    const recipientContext = await browser.newContext();
    const recipientPage = await recipientContext.newPage();
    await loginParticipantUi(recipientPage, recipient);
    await recipientPage.goto(`/handoff/invitations/${invitationToken}`);
    await expect(recipientPage.getByTestId('handoff-shell')).toBeVisible({ timeout: 20_000 });
    await expect(recipientPage.getByTestId('handoff-status')).toHaveText(/Pendiente de respuesta/);
    await expect(recipientPage.getByRole('button', { name: 'Aceptar asignación' })).toBeVisible();
    await expect(recipientPage.getByRole('button', { name: 'Empezar' })).toHaveCount(0);
    await recipientPage.getByRole('button', { name: 'Aceptar asignación' }).click();
    await expect(recipientPage.getByTestId('handoff-status')).toHaveText('Aceptada');
    await expect(recipientPage.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    await recipientPage.screenshot({ path: testInfo.outputPath('D-destinatario-aceptada-sin-iniciar.png'), fullPage: true });

    const afterAcceptance = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: {
        ownerId: true,
        currentStep: true,
        status: true,
        steps: { orderBy: { number: 'asc' }, select: { id: true, number: true, status: true, progress: true } },
      },
    });
    expect(afterAcceptance).toEqual(before);
    expect(await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).toMatchObject({
      state: 'ACCEPTED',
      startedAt: null,
      startedBy: null,
      initiativeId: project.id,
      briefVersionId: brief.briefVersionId,
    });

    await page.goto('/portfolio/inicio');
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Aceptada', { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible({ timeout: 20_000 });
    expect(await prisma.portfolioHandoffAssignment.count({ where: { id: assignment.id } })).toBe(1);
    expect(await prisma.portfolioHandoffInvitation.count({ where: { assignmentId: assignment.id } })).toBe(1);
    expect(await prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignmentId: assignment.id } })).toBe(1);
    expect(await prisma.step.count({ where: { projectId: project.id } })).toBe(4);
    const persistedBrief = await prisma.challengeActivationBriefVersion.findUniqueOrThrow({ where: { id: brief.briefVersionId } });
    expect(persistedBrief).toMatchObject({
      challengeId: structure.challenges[0].challengeId,
      status: 'CONFIRMED',
      versionNumber: 1,
      confirmedByActorId: lead.userId,
    });
    expect(persistedBrief.provenance).toMatchObject({
      source: 'PL05_COPILOT',
      challengeId: structure.challenges[0].challengeId,
      inheritedFrom: 'PL04_CONFIRMED_ORGANIZATION',
    });
    expect(persistedBrief.createdByActorId).toBe(lead.userId);
    await captureReleaseViewports(page, testInfo, 'D-home-reentrada-aceptada');
    await recipientContext.close();
    await api.dispose();
  });
});
