import fs from 'node:fs';
import path from 'node:path';
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { ADMIN_EMAIL, ADMIN_PASSWORD, auth, browserLogin, login, registerAndLogin, type Session } from './support/api';

const MAILPIT = process.env.KAN186_MAILPIT_URL;
const ARTIFACT_ROOT = path.resolve(process.cwd(), '..', 'artifacts', 'KAN-186', 'continuous');
const BRIEF_INTENT = 'Reducir el tiempo de activación sin perder trazabilidad';
const BRIEF_SCOPE = 'Piloto sintético autorizado para Portfolio Lead y Steps';

type Fixture = {
  lead: Session;
  owner: Session;
  assignmentId: string;
  briefVersionId: string;
  challengeId: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  invitationUrl: string;
  before: { projects: number; steps: number };
};

type HttpEvidence = { method: string; path: string; status: number };

test.describe.configure({ mode: 'serial' });

function requireMailpit(): string {
  if (!MAILPIT) throw new Error('KAN186_MAILPIT_URL is required; skipped E2E evidence is not accepted.');
  return MAILPIT;
}

async function command(api: APIRequestContext, token: string, url: string, key: string, data: Record<string, unknown>) {
  const response = await api.post(url, {
    headers: { ...auth(token), 'Idempotency-Key': key },
    data,
    failOnStatusCode: false,
  });
  expect(response.ok(), `${url}: ${await response.text()}`).toBeTruthy();
  return (await response.json()).data;
}

async function invitationUrlFromMailpit(ownerEmail: string, assignmentId: string): Promise<string> {
  const mailpit = requireMailpit();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const listingResponse = await fetch(`${mailpit}/api/v1/messages?limit=50`);
    if (listingResponse.ok) {
      const listing = await listingResponse.json() as { messages?: Array<Record<string, unknown>>; Messages?: Array<Record<string, unknown>> };
      for (const summary of listing.messages ?? listing.Messages ?? []) {
        const id = summary.ID ?? summary.Id ?? summary.id;
        if (!id) continue;
        const detailResponse = await fetch(`${mailpit}/api/v1/message/${encodeURIComponent(String(id))}`);
        if (!detailResponse.ok) continue;
        const serialized = JSON.stringify(await detailResponse.json());
        if (!serialized.toLowerCase().includes(ownerEmail.toLowerCase())) continue;
        const invitationUrl = serialized.match(/https?:\/\/[^"'<>\\\s]+\/handoff\/invitations\/[^"'<>\\\s]+/i)?.[0];
        if (invitationUrl) return invitationUrl.replace(/\\u0026/g, '&');
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Mailpit did not capture the synthetic invitation for ${assignmentId}.`);
}

async function prepareFixture(api: APIRequestContext, prisma: PrismaClient, viewport: string): Promise<Fixture> {
  const stamp = `${viewport}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const lead = await login(api, ADMIN_EMAIL, ADMIN_PASSWORD);
  const owner = await registerAndLogin(api, `kan186-${stamp}`);
  const leadUser = await prisma.user.findUniqueOrThrow({ where: { id: lead.userId }, select: { organizationId: true } });
  expect(leadUser.organizationId, 'Portfolio Lead must belong to a canonical organization').toBeTruthy();
  const organizationId = leadUser.organizationId!;
  await prisma.user.update({ where: { id: owner.userId }, data: { organizationId } });
  await prisma.organizationMember.create({ data: { organizationId, userId: owner.userId, role: 'member' } });

  const front = await prisma.strategicFront.create({
    data: { organizationId, name: `[KAN-186 ${viewport}] Frente sintético`, strategicObjective: 'Validar continuidad real del MVP' },
  });
  const challenge = await prisma.challenge.create({
    data: { strategicFrontId: front.id, title: `[KAN-186 ${viewport}] Reducir fricción de activación` },
  });
  const brief = await prisma.challengeActivationBrief.create({
    data: { organizationId, challengeId: challenge.id, createdByActorId: lead.userId },
  });
  const briefVersion = await prisma.challengeActivationBriefVersion.create({
    data: {
      organizationId, briefId: brief.id, challengeId: challenge.id, versionNumber: 1, status: 'CONFIRMED',
      intent: BRIEF_INTENT, scope: BRIEF_SCOPE, strategicContextRefs: {}, inheritedContext: {}, constraintsSnapshot: [],
      knownGaps: [], sourceRefs: [], provenance: { source: 'KAN-186-browser-e2e', synthetic: true },
      createdByActorId: lead.userId, confirmedByActorId: lead.userId, confirmedAt: new Date(),
    },
  });
  const projectName = `[KAN-186 ${viewport}] Iniciativa sintética Step 2`;
  const project = await prisma.project.create({
    data: {
      name: projectName, organizationId, ownerId: owner.userId, status: 'IN_PROGRESS', currentStep: 2,
      step0Status: 'COMPLETED', activationStatus: 'OWNER_CONFIRMED', retrospectiveAssessmentStatus: 'ASSESSED',
      portfolioMeta: { create: { challengeId: challenge.id, strategicFrontId: front.id } },
      teamMembers: { create: { userId: owner.userId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } },
      steps: { create: [1, 2, 3, 4].map((number) => ({
        number, name: `Step ${number}`, status: number === 1 ? 'APPROVED' : number === 2 ? 'IN_PROGRESS' : 'BLOCKED',
        progress: number === 1 ? 100 : 0,
      })) },
    },
  });
  await prisma.initiativeCycle.create({
    data: {
      projectId: project.id, cycleNumber: 1, startStep: 0, currentStep: 2, status: 'active',
      stepStates: { create: [
        { stepNumber: 0, state: 'confirmed' }, { stepNumber: 1, state: 'confirmed' }, { stepNumber: 2, state: 'active' },
      ] },
      stepConfigurations: { create: {
        projectId: project.id, stepNumber: 2, version: 1, status: 'active', routeType: 'explore_validate', depthLevel: 'standard', maturity: 'execution',
        configurationJson: { step: 2, visibleName: 'Diseñar apuesta y experimento', stablePurpose: 'Continuar desde el estado real', shortTitle: 'Diseñar apuesta', description: 'Continuar desde el estado real', objective: 'Retomar trabajo persistido', expectedOutput: 'Apuesta validable', nextAction: 'Continuar Step 2', checkpoints: [] },
        sourceContextJson: {},
      } },
      progressSignals: { create: {
        projectId: project.id, stepNumber: 2, health: 'in_progress',
        signalJson: { step: 2, health: 'in_progress', summary: 'Continuar Step 2', nextAction: 'Continuar Step 2' },
      } },
    },
  });
  const prepared = await command(api, lead.token, `/api/v1/portfolio/challenges/${challenge.id}/handoff-assignments`, `kan186-${stamp}-prepare`, {
    targetKind: 'EXISTING_INITIATIVE', initiativeId: project.id, briefId: brief.id, briefVersionId: briefVersion.id,
    contextNote: 'Continuar el Project legítimo sin reiniciar Steps.', invitedEmailNormalized: owner.email,
    members: [{ identityKey: owner.email, emailNormalized: owner.email, userId: owner.userId, role: 'OWNER' }],
  });
  const assignment = prepared.assignment as { id: string; state: string };
  expect(assignment.state).toBe('CREATED');
  await prisma.portfolioBootstrapSession.create({
    data: {
      userId: lead.userId, organizationId, status: 'reading_published', bootstrapPhase: 'B5_FIRST_READING',
      existingWorkStatus: 'has_work', setupCompletedAt: new Date(), setupCompletedByActorId: lead.userId,
      setupCompletionIdempotencyKey: `kan186-${stamp}-setup-complete`,
    },
  });
  const before = {
    projects: await prisma.project.count({ where: { organizationId } }),
    steps: await prisma.step.count({ where: { project: { organizationId } } }),
  };
  const delivered = await command(api, lead.token, `/api/v1/portfolio/handoff-assignments/${assignment.id}/invitation`, `kan186-${stamp}-delivery`, {});
  expect(delivered).toMatchObject({ state: 'SENT', attemptStatus: 'SUCCEEDED' });
  const invitationUrl = await invitationUrlFromMailpit(owner.email, assignment.id);
  return {
    lead, owner, assignmentId: assignment.id, briefVersionId: briefVersion.id, challengeId: challenge.id,
    projectId: project.id, projectName, organizationId, invitationUrl, before,
  };
}

function recordHttp(page: Page, evidence: HttpEvidence[]) {
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (/handoff|portfolio\/home|\/projects\//.test(pathname)) {
      evidence.push({ method: response.request().method(), path: pathname, status: response.status() });
    }
  });
}

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  test(`${viewport.name}: SENT → Claim → Accept → Start → Step 2 → Portfolio Overview`, async ({ browser }) => {
    requireMailpit();
    const databaseUrl = process.env.E2E_DATABASE_URL;
    if (!databaseUrl) throw new Error('E2E_DATABASE_URL is required for disposable PostgreSQL evidence.');
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    const api = await playwrightRequest.newContext({ baseURL: process.env.E2E_BASE_URL });
    const outputDir = path.join(ARTIFACT_ROOT, viewport.name);
    fs.mkdirSync(outputDir, { recursive: true });
    const evidence: HttpEvidence[] = [];
    try {
      const fixture = await prepareFixture(api, prisma, viewport.name);
      const leadContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const ownerContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const leadPage = await leadContext.newPage();
      let ownerPage = await ownerContext.newPage();
      recordHttp(leadPage, evidence);
      recordHttp(ownerPage, evidence);

      await browserLogin(leadPage, fixture.lead.email, fixture.lead.password);
      await browserLogin(ownerPage, fixture.owner.email, fixture.owner.password);

      const mailPage = await ownerContext.newPage();
      await mailPage.goto(requireMailpit(), { waitUntil: 'networkidle' });
      await mailPage.getByText(`To: ${fixture.owner.email}`, { exact: true }).click();
      const reviewLink = mailPage.frameLocator('iframe').getByRole('link', { name: 'Revisar invitación' });
      await expect(reviewLink).toHaveAttribute('href', fixture.invitationUrl);
      await mailPage.screenshot({ path: path.join(outputDir, '00-mailpit-invitation.png'), fullPage: true });
      const invitationPagePromise = ownerContext.waitForEvent('page');
      await reviewLink.click();
      const invitationPage = await invitationPagePromise;
      recordHttp(invitationPage, evidence);
      await invitationPage.waitForLoadState('networkidle');
      await ownerPage.close();
      await mailPage.close();
      ownerPage = invitationPage;

      await expect(ownerPage.getByTestId('handoff-shell')).toBeVisible();
      await expect(ownerPage.getByTestId('handoff-status')).toHaveText(/Pendiente de respuesta/);
      await expect(ownerPage.getByTestId('handoff-brief-version')).toContainText('Brief confirmado · versión 1');
      await expect(ownerPage.getByTestId('handoff-brief-version')).toContainText(BRIEF_INTENT);
      await expect(ownerPage.getByTestId('handoff-brief-version')).toContainText(BRIEF_SCOPE);
      await expect(ownerPage.getByTestId('handoff-brief-version')).toContainText(fixture.briefVersionId);
      await expect(ownerPage.getByRole('button', { name: 'Aceptar asignación' })).toBeVisible();
      await expect(ownerPage.getByRole('button', { name: 'Empezar' })).toHaveCount(0);
      await ownerPage.screenshot({ path: path.join(outputDir, '01-claimed-brief-review.png'), fullPage: true });

      await ownerPage.getByRole('button', { name: 'Aceptar asignación' }).click();
      await expect(ownerPage.getByTestId('handoff-status')).toHaveText('Aceptada');
      await expect(ownerPage.getByRole('heading', { name: 'Cuando decidas empezar' })).toBeVisible();
      await expect(ownerPage.getByRole('button', { name: 'Empezar' })).toBeEnabled();
      await ownerPage.screenshot({ path: path.join(outputDir, '02-activation-overview.png'), fullPage: true });

      const startButton = ownerPage.getByRole('button', { name: 'Empezar' });
      await startButton.scrollIntoViewIfNeeded();
      const startResponse = ownerPage.waitForResponse((response) => response.request().method() === 'POST'
        && new URL(response.url()).pathname === `/api/v1/handoff/assignments/${fixture.assignmentId}/start`);
      await startButton.click();
      expect((await startResponse).status()).toBe(200);
      await expect(ownerPage.getByRole('heading', { name: 'Continúa tu iniciativa' })).toBeVisible();
      await expect(ownerPage.getByText('Brief confirmado · versión 1')).toBeVisible();
      await expect(ownerPage.getByText(fixture.projectName)).toBeVisible();
      await expect(ownerPage.getByText(/Estado real · Step 2 · 4 Steps persistidos/)).toBeVisible();
      await ownerPage.screenshot({ path: path.join(outputDir, '03-existing-ready.png'), fullPage: true });

      await ownerPage.getByRole('button', { name: /Abrir Overview/ }).click();
      await expect(ownerPage).toHaveURL(new RegExp(`/projects/${fixture.projectId}$`));
      await expect(ownerPage.getByText(/Step actual:\s*2/i)).toBeVisible();
      expect(new URL(ownerPage.url()).pathname).not.toMatch(/\/step\/\d+$/);
      await ownerPage.screenshot({ path: path.join(outputDir, '04-project-overview-step-2.png'), fullPage: true });

      await ownerPage.goto(fixture.invitationUrl, { waitUntil: 'networkidle' });
      await expect(ownerPage.getByRole('heading', { name: 'Continúa tu iniciativa' })).toBeVisible();
      await expect(ownerPage.getByText(fixture.projectName)).toBeVisible();

      await leadPage.goto('/portfolio/inicio', { waitUntil: 'networkidle' });
      await expect(leadPage.getByTestId('portfolio-overview-home')).toBeVisible();
      const initiativeItem = leadPage.getByRole('listitem').filter({ hasText: fixture.projectName });
      await expect(initiativeItem).toBeVisible();
      await expect(initiativeItem.getByText(/Handoff:\s*Iniciada/)).toBeVisible();
      await expect(initiativeItem.getByText(/Step registrado:\s*2/)).toBeVisible();
      await leadPage.screenshot({ path: path.join(outputDir, '05-portfolio-overview-projection.png'), fullPage: true });

      const assignment = await prisma.portfolioHandoffAssignment.findUniqueOrThrow({
        where: { id: fixture.assignmentId },
        select: { state: true, acceptedBy: true, startedBy: true, initiativeId: true, organizationId: true, invitations: { select: { claimedByUserId: true } } },
      });
      expect(assignment).toMatchObject({
        state: 'STARTED', acceptedBy: fixture.owner.userId, startedBy: fixture.owner.userId,
        initiativeId: fixture.projectId, organizationId: fixture.organizationId,
      });
      expect(assignment.invitations).toHaveLength(1);
      expect(assignment.invitations[0].claimedByUserId).toBe(fixture.owner.userId);
      await expect(Promise.all([
        prisma.project.count({ where: { organizationId: fixture.organizationId } }),
        prisma.step.count({ where: { project: { organizationId: fixture.organizationId } } }),
      ])).resolves.toEqual([fixture.before.projects, fixture.before.steps]);
      const operational = await prisma.project.findUniqueOrThrow({
        where: { id: fixture.projectId },
        select: { currentStep: true, ownerId: true, steps: { orderBy: { number: 'asc' }, select: { number: true, status: true } } },
      });
      expect(operational).toMatchObject({
        currentStep: 2, ownerId: fixture.owner.userId,
        steps: [{ number: 1, status: 'APPROVED' }, { number: 2, status: 'IN_PROGRESS' }, { number: 3, status: 'BLOCKED' }, { number: 4, status: 'BLOCKED' }],
      });

      const requiredPaths = [
        '/api/v1/public/handoff-invitations/claim',
        `/api/v1/handoff/assignments/${fixture.assignmentId}/accept`,
        `/api/v1/handoff/assignments/${fixture.assignmentId}/start`,
        `/api/v1/handoff/assignments/${fixture.assignmentId}/post-start-continuity`,
      ];
      for (const requiredPath of requiredPaths) {
        expect(evidence.some((item) => item.path === requiredPath && item.status === 200), `missing HTTP 200 evidence for ${requiredPath}`).toBe(true);
      }
      expect(evidence.filter((item) => item.status >= 400)).toEqual([]);
      fs.writeFileSync(path.join(outputDir, 'http-evidence.json'), `${JSON.stringify({ viewport, assignmentId: fixture.assignmentId, projectId: fixture.projectId, synthetic: true, responses: evidence }, null, 2)}\n`);
      await leadContext.close();
      await ownerContext.close();
    } finally {
      await api.dispose();
      await prisma.$disconnect();
    }
  });
}
