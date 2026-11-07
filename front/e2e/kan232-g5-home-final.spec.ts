import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5176';
const labRecipients = ['fabio.merino.97@gmail.com', 'orlandokuanb@gmail.com'];

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
  const confirmed = await api.post(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor/confirm`, {
    headers: auth, data: {},
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
  return requestId;
}

async function acceptLabNotification(lead: Lead, requestId: string, suffix: string) {
  await prisma.portfolioLabNotificationAttempt.create({
    data: {
      requestId,
      actorId: lead.userId,
      idempotencyKeyHash: `kan232-accepted-${lead.stamp}-${suffix}`,
      payloadHash: `kan232-payload-${lead.stamp}-${suffix}`,
      status: 'ACCEPTED',
      acceptedRecipients: labRecipients,
      providerMessageRef: `kan232-smtp-${lead.stamp}-${suffix}`,
      completedAt: new Date(),
    },
  });
  await prisma.portfolioLabRequest.update({
    where: { id: requestId },
    data: { notificationStatus: 'NOTIFIED', providerMessageRef: `kan232-smtp-${lead.stamp}-${suffix}`, lastNotificationError: null },
  });
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
  await prisma.portfolioHandoffDeliveryAttempt.create({
    // External SMTP is intentionally the sole fixture boundary in this browser journey.
    // PL-06 delivery regressions certify the invitation command, transport receipt and
    // idempotency; from here G5 consumes the resulting durable SMTP_ACCEPTED/SENT state.
    data: {
      assignmentId: assignment.id,
      status: 'SUCCEEDED',
      providerMessageRef: `kan232-team-smtp-${lead.stamp}-${suffix}`,
      idempotencyKey: `kan232-team-send-${lead.stamp}-${suffix}`,
      requestFingerprint: `kan232-team-fingerprint-${lead.stamp}-${suffix}`,
    },
  });
  await prisma.portfolioHandoffAssignment.update({
    where: { id: assignment.id },
    data: {
      state: 'SENT', sentAt: new Date(), version: { increment: 1 },
    },
  });
  await prisma.portfolioHandoffProjection.update({
    where: { assignmentId: assignment.id },
    data: {
      handoffState: 'SENT', lastMaterialEvent: 'invitation_sent',
      projectionVersion: { increment: 1 }, generatedAt: new Date(),
    },
  });
  const invitationToken = `kan232-invitation-${lead.stamp}-${suffix}`;
  await prisma.portfolioHandoffInvitation.create({
    data: {
      assignmentId: assignment.id,
      tokenHash: createHash('sha256').update(invitationToken).digest('hex'),
    },
  });
  const claimed = await api.post('/api/v1/public/handoff-invitations/claim', {
    headers: bearer(recipient.token), data: { token: invitationToken },
  });
  expect(claimed.status(), await claimed.text()).toBe(200);
  expect((await claimed.json()).data.identityClaimStatus).toBe('MATCHED');
  const responseHeaders = {
    ...bearer(recipient.token),
    'Idempotency-Key': `kan232-${outcome}-${lead.stamp}-${suffix}`,
  };
  const transition = outcome === 'accept'
    ? await api.post(`/api/v1/handoff/assignments/${assignment.id}/accept`, {
      headers: responseHeaders, data: { expectedVersion: 2 },
    })
    : await api.post(`/api/v1/handoff/assignments/${assignment.id}/reject`, {
      headers: responseHeaders, data: { expectedVersion: 2, reason: 'No hay capacidad disponible.' },
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
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('A · 0 trabajo → E5 → Brief → Lab → Home, reentrada y aislamiento', async ({ page }) => {
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
    const failedOrPending = await prisma.portfolioLabRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(failedOrPending.notificationStatus).toBe('FAILED');
    const retryHeaders = { ...bearer(lead.token), 'Idempotency-Key': `kan232-retry-${lead.stamp}` };
    const retry = await api.post(`/api/v1/portfolio-lab/requests/${requestId}/notification-retry`, {
      headers: retryHeaders, data: {},
    });
    expect(retry.status(), await retry.text()).toBe(200);
    const replayedRetry = await api.post(`/api/v1/portfolio-lab/requests/${requestId}/notification-retry`, {
      headers: retryHeaders, data: {},
    });
    expect(replayedRetry.status(), await replayedRetry.text()).toBe(200);
    expect((await replayedRetry.json()).data.idempotent).toBe(true);
    await acceptLabNotification(lead, requestId, 'a');
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
    await page.reload();
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/auth/);
    await loginUi(page, lead);
    await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
    await api.dispose();
  });

  test('B · 3 iniciativas → un frente/dos Briefs → Equipo+Lab → tercero sin activar → Home', async ({ page }) => {
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
    await acceptLabNotification(lead, labRequestId, 'b');
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
    await api.dispose();
  });

  test('C · 25 CSV/XLSX → revisión → un frente → Briefs selectivos → Home responsive', async ({ page }) => {
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
    await acceptLabNotification(lead, requestId, 'c');
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
    await api.dispose();
  });
});
