import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const db = new PrismaClient();

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const tokenFrom = (body: any) => body?.data?.tokens?.accessToken ?? body?.data?.accessToken ?? body?.tokens?.accessToken ?? body?.accessToken ?? '';

async function registerOwner(api: APIRequestContext, tag: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `p6-runtime-${tag}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const registration = await api.post('/api/v1/auth/register', { data: { email, password, name: `P6 ${tag}`, role: 'participante' }, failOnStatusCode: false });
  expect([200, 201], `register: ${await registration.text()}`).toContain(registration.status());
  const login = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(login.status(), `login: ${await login.text()}`).toBe(200);
  const token = tokenFrom(await login.json());
  expect(token).toBeTruthy();
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return { token, user };
}

async function fixtureChallenge(ownerId: string, suffix: string) {
  const portfolio = await db.user.findUniqueOrThrow({ where: { email: process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test' } });
  const front = await db.strategicFront.create({
    data: {
      name: `P6 Front ${suffix}`,
      organizationId: portfolio.organizationId,
      ownerId: portfolio.id,
      constraints: 'No modificar datos personales sin aprobación.',
      mainKpi: 'Tiempo de resolución',
      target: 'Reducir 20%',
    },
  });
  const challenge = await db.challenge.create({
    data: {
      strategicFrontId: front.id,
      title: `P6 Challenge ${suffix}`,
      knownFacts: 'El proceso tarda 12 días.',
      constraints: 'No desplegar sin revisión legal.',
      dependencies: 'Equipo legal',
      expectedDecision: 'Autorizar piloto',
    },
  });
  return { portfolio, front, challenge, ownerId };
}

async function createStartedAssignment(input: { ownerId: string; ownerEmail: string; portfolioId: string; organizationId: string | null; challengeId: string; targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE'; initiativeId?: string }) {
  return db.portfolioHandoffAssignment.create({
    data: {
      organizationId: input.organizationId,
      portfolioScopeRef: 'p6-runtime-scope',
      challengeId: input.challengeId,
      targetKind: input.targetKind,
      initiativeId: input.initiativeId ?? null,
      invitedEmailNormalized: input.ownerEmail,
      createdByActorId: input.portfolioId,
      state: 'SENT',
      members: { create: { identityKey: input.ownerEmail, emailNormalized: input.ownerEmail, userId: input.ownerId, label: 'P6 owner', role: 'OWNER' } },
      invitations: { create: { tokenHash: `p6-runtime-token-${Date.now()}-${Math.random()}`, claimedByUserId: input.ownerId, claimedAt: new Date() } },
    },
  });
}

async function acceptAndStart(api: APIRequestContext, token: string, assignmentId: string) {
  const acceptKey = `p6-accept-${assignmentId}`;
  const accept = await api.post(`/api/v1/handoff/assignments/${assignmentId}/accept`, { headers: { ...auth(token), 'Idempotency-Key': acceptKey }, data: { expectedVersion: 1 }, failOnStatusCode: false });
  expect(accept.status(), `accept: ${await accept.text()}`).toBe(200);
  const accepted = (await accept.json()).data;
  const acceptReplay = await api.post(`/api/v1/handoff/assignments/${assignmentId}/accept`, { headers: { ...auth(token), 'Idempotency-Key': acceptKey }, data: { expectedVersion: 1 }, failOnStatusCode: false });
  expect((await acceptReplay.json()).data.version).toBe(accepted.version);
  const startKey = `p6-start-${assignmentId}`;
  const start = await api.post(`/api/v1/handoff/assignments/${assignmentId}/start`, { headers: { ...auth(token), 'Idempotency-Key': startKey }, data: { expectedVersion: accepted.version, idempotencyKey: startKey }, failOnStatusCode: false });
  expect(start.status(), `start: ${await start.text()}`).toBe(200);
  const started = (await start.json()).data;
  const startReplay = await api.post(`/api/v1/handoff/assignments/${assignmentId}/start`, { headers: { ...auth(token), 'Idempotency-Key': startKey }, data: { expectedVersion: accepted.version, idempotencyKey: startKey }, failOnStatusCode: false });
  expect((await startReplay.json()).data.version).toBe(started.version);
  return started;
}

test.describe('P6 post-Start runtime boundary', () => {
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await pwRequest.newContext({ baseURL: BASE }); });
  test.afterAll(async () => { await api.dispose(); await db.$disconnect(); });

  test('Route A persists accept/start retries, creates exactly one Initiative only on confirmation, and snapshots mandate references', async () => {
    const owner = await registerOwner(api, 'route-a');
    const fixture = await fixtureChallenge(owner.user.id, 'route-a');
    const assignment = await createStartedAssignment({ ownerId: owner.user.id, ownerEmail: owner.user.email, portfolioId: fixture.portfolio.id, organizationId: fixture.portfolio.organizationId, challengeId: fixture.challenge.id, targetKind: 'CHALLENGE' });
    const started = await acceptAndStart(api, owner.token, assignment.id);
    expect(started.initiativeId).toBeNull();
    expect(await db.project.count({ where: { ownerId: owner.user.id } })).toBe(0);

    const reviewResponse = await api.post('/api/v1/initial-reviews', {
      headers: auth(owner.token),
      data: { originalInput: 'Reducir la espera sin desplegar cambios no revisados.', handoffAssignmentId: assignment.id },
      failOnStatusCode: false,
    });
    expect(reviewResponse.status(), `formulation: ${await reviewResponse.text()}`).toBe(201);
    const review = (await reviewResponse.json()).data;
    const confirm = await api.post(`/api/v1/initial-reviews/${review.id}/confirm-route`, { headers: auth(owner.token), data: {}, failOnStatusCode: false });
    expect(confirm.status(), `confirm: ${await confirm.text()}`).toBe(201);
    const initiativeId = (await confirm.json()).data.initiativeId as string;
    const confirmReplay = await api.post(`/api/v1/initial-reviews/${review.id}/confirm-route`, { headers: auth(owner.token), data: {}, failOnStatusCode: false });
    expect((await confirmReplay.json()).data.initiativeId).toBe(initiativeId);

    const [persistedAssignment, project, acceptCommands, startCommands] = await Promise.all([
      db.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: assignment.id } }),
      db.project.findUniqueOrThrow({ where: { id: initiativeId } }),
      db.portfolioHandoffResponseCommand.count({ where: { assignmentId: assignment.id, type: 'ACCEPT' } }),
      db.portfolioHandoffResponseCommand.count({ where: { assignmentId: assignment.id, type: 'START' } }),
    ]);
    expect(persistedAssignment.initiativeId).toBe(initiativeId);
    expect(acceptCommands).toBe(1);
    expect(startCommands).toBe(1);
    expect(await db.project.count({ where: { initialReviewSnapshotId: project.initialReviewSnapshotId } })).toBe(1);
    expect((project.step0Data as any).adaptiveCore.masterContext.contextSnapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ challengeId: fixture.challenge.id, strategicFrontId: fixture.front.id, constraints: expect.arrayContaining(['No desplegar sin revisión legal.', 'No modificar datos personales sin aprobación.']) }),
    ]));
  });

  test('Route B returns the same Initiative identity and persisted history without mutating it or selecting a Step', async () => {
    const owner = await registerOwner(api, 'route-b');
    const fixture = await fixtureChallenge(owner.user.id, 'route-b');
    const existing = await db.project.create({ data: { name: 'P6 existing', description: 'History must persist', ownerId: owner.user.id, teamMembers: { create: { userId: owner.user.id, role: 'OWNER', status: 'ACTIVE' } } } });
    const source = await db.sourceRef.create({ data: { projectId: existing.id, sourceType: 'USER_INPUT', reference: 'P6 source', originActorId: owner.user.id } });
    await db.evidence.create({ data: { projectId: existing.id, ownerId: owner.user.id, name: 'P6 evidence', type: 'OTHER', stepRef: 0, sourceRefId: source.id } });
    await db.truthClaim.create({ data: { projectId: existing.id, subjectType: 'initiative', claimType: 'fact', statement: 'History survives', createdById: owner.user.id } });
    const assignment = await createStartedAssignment({ ownerId: owner.user.id, ownerEmail: owner.user.email, portfolioId: fixture.portfolio.id, organizationId: fixture.portfolio.organizationId, challengeId: fixture.challenge.id, targetKind: 'EXISTING_INITIATIVE', initiativeId: existing.id });
    await acceptAndStart(api, owner.token, assignment.id);
    const before = await db.project.findUniqueOrThrow({ where: { id: existing.id } });
    const response = await api.get(`/api/v1/handoff/assignments/${assignment.id}/reconstruction`, { headers: auth(owner.token), failOnStatusCode: false });
    expect(response.status(), `reconstruction: ${await response.text()}`).toBe(200);
    expect((await response.json()).data).toMatchObject({ initiativeId: existing.id, continuityState: 'CONTINUITY_REVIEW_REQUIRED', recovered: { sourceRefs: 1, evidence: 1, claims: 1 } });
    const after = await db.project.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after).toMatchObject({ id: before.id, createdAt: before.createdAt, lastModified: before.lastModified });
    expect(await db.project.count({ where: { ownerId: owner.user.id, name: 'P6 existing' } })).toBe(1);
  });

  test('Route C confirms one independent Initiative with no fabricated Challenge or StrategicFront', async () => {
    const owner = await registerOwner(api, 'route-c');
    const reviewResponse = await api.post('/api/v1/initial-reviews', { headers: auth(owner.token), data: { originalInput: 'Explorar una mejora independiente sin contexto corporativo.' }, failOnStatusCode: false });
    expect(reviewResponse.status()).toBe(201);
    const review = (await reviewResponse.json()).data;
    const confirm = await api.post(`/api/v1/initial-reviews/${review.id}/confirm-route`, { headers: auth(owner.token), data: {}, failOnStatusCode: false });
    expect(confirm.status()).toBe(201);
    const initiativeId = (await confirm.json()).data.initiativeId as string;
    const replay = await api.post(`/api/v1/initial-reviews/${review.id}/confirm-route`, { headers: auth(owner.token), data: {}, failOnStatusCode: false });
    expect((await replay.json()).data.initiativeId).toBe(initiativeId);
    const project = await db.project.findUniqueOrThrow({ where: { id: initiativeId }, include: { portfolioMeta: true } });
    expect(project.portfolioMeta).toHaveLength(0);
    expect((project.step0Data as any).adaptiveCore.masterContext.contextSnapshots).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'challenge' })]));
  });
});
