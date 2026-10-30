/**
 * E2E: portfolio-lead → participant steps integration (milestone #7) — API-level, real stack.
 *
 * Closes the architectural gap between the portfolio-lead domain
 * (frente → reto → iniciativa, InitiativePortfolioMeta) and the participant's
 * Steps flow. Validates end-to-end against the docker compose stack
 * (postgres + backend) the full chain:
 *
 *   1. A portfolio-lead (admin) builds a frente → reto and assigns a participant
 *      to the reto's unified team (ChallengeTeamMember, ADR-023).
 *   2. A creator creates the iniciativa FROM that reto (POST /projects + challengeId).
 *   3. The iniciativa MATERIALIZES a navigable project in the participant Steps flow:
 *      it exposes Step 0 + Steps 1..4 via GET /projects/:id, /:id/steps and
 *      /:id/steps/:n — Step 0 active, Step 1 NOT_STARTED and Steps 2..4 BLOCKED.
 *   4. The inherited reto team member can NAVIGATE the iniciativa's steps without
 *      re-capture (materialized TeamMember → access granted, project listed).
 *   5. Team + meta are INHERITED (shared) without re-capture: the initiative team
 *      resolves the reto member (inheritedFromChallenge=true) and the meta carries
 *      status=en_step_0 + the frente/reto breadcrumb (strategicFront name).
 *   6. The iniciativa is tracked under its reto for the portfolio dashboard
 *      (GET /portfolio/challenges/:id/initiatives).
 *
 * Requires: `npm run test:e2e`, que levanta el stack aislado y siembra su propio admin
 * (`prisma/seed.e2e.ts` → E2E_ADMIN_EMAIL). Antes esta spec pedía `admin@starteria.io`,
 * usuario del seed de DESARROLLO que no existe en ese stack: el login devolvía 401 y la
 * spec moría en el primer paso.
 */
import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.E2E_BASE_URL || 'http://localhost';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'portfolio-admin.e2e@starteria.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_USER_PASSWORD || 'demo123';

/** Decode the `sub` (user id) claim from a JWT without verifying it. */
function jwtSub(token: string): string {
  const part = token.split('.')[1];
  const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const payload = JSON.parse(json) as { sub?: string; userId?: string; id?: string };
  return payload.sub ?? payload.userId ?? payload.id ?? '';
}

function extractToken(body: any): string {
  return (
    body?.data?.tokens?.accessToken ??
    body?.data?.accessToken ??
    body?.tokens?.accessToken ??
    body?.accessToken ??
    ''
  );
}

async function login(api: APIRequestContext, email: string, password: string): Promise<{ token: string; userId: string }> {
  const res = await api.post('/api/v1/auth/login', { data: { email, password }, failOnStatusCode: false });
  expect(res.status(), `login ${email}: ${await res.text()}`).toBe(200);
  const token = extractToken(await res.json());
  expect(token, `no access token for ${email}`).toBeTruthy();
  return { token, userId: jwtSub(token) };
}

async function registerAndLogin(api: APIRequestContext, tag: string): Promise<{ token: string; userId: string; email: string }> {
  const stamp = Date.now() + Math.floor(Math.random() * 100000);
  const email = `e2e-psi-${tag}-${stamp}@starteria.test`;
  const password = 'E2eTest!1234';
  const reg = await api.post('/api/v1/auth/register', {
    data: { email, password, name: `E2E ${tag} ${stamp}`, role: 'participante' },
    failOnStatusCode: false,
  });
  expect([200, 201, 409], `register ${email}: ${reg.status()}`).toContain(reg.status());
  const { token, userId } = await login(api, email, password);
  return { token, userId, email };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

test.describe('portfolio-lead → participant steps integration (milestone #7, real stack)', () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE });
  });
  test.afterAll(async () => {
    await api.dispose();
  });

  test('iniciativa from a reto is a navigable steps project sharing team + meta without re-capture', async () => {
    const admin = await login(api, ADMIN_EMAIL, ADMIN_PASSWORD);
    const creator = await registerAndLogin(api, 'creator');
    const member = await registerAndLogin(api, 'member');
    const stamp = Date.now();

    // Registration deliberately gives each synthetic user its own canonical tenant.
    // This scenario exercises same-organization inheritance, so align only this
    // disposable fixture before crossing the fail-closed Portfolio boundary.
    const prisma = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });
    try {
      const adminUser = await prisma.user.findUniqueOrThrow({
        where: { id: admin.userId },
        select: { organizationId: true },
      });
      expect(adminUser.organizationId, 'seeded Portfolio Lead must have a canonical tenant').toBeTruthy();
      await prisma.user.updateMany({
        where: { id: { in: [creator.userId, member.userId] } },
        data: { organizationId: adminUser.organizationId },
      });
    } finally {
      await prisma.$disconnect();
    }

    // ── 1. Portfolio-lead builds frente → reto and staffs the reto team ───────────
    const fRes = await api.post('/api/v1/portfolio/strategic-fronts', {
      headers: auth(admin.token),
      data: { name: `E2E Frente PSI ${stamp}` },
      failOnStatusCode: false,
    });
    expect(fRes.ok(), `create front: ${await fRes.text()}`).toBeTruthy();
    const frontId = (await fRes.json()).data.id as string;

    const cRes = await api.post(`/api/v1/portfolio/strategic-fronts/${frontId}/challenges`, {
      headers: auth(admin.token),
      data: { title: `E2E Reto PSI ${stamp}` },
      failOnStatusCode: false,
    });
    expect(cRes.ok(), `create reto: ${await cRes.text()}`).toBeTruthy();
    const challengeId = (await cRes.json()).data.id as string;

    const tRes = await api.post(`/api/v1/portfolio/challenges/${challengeId}/team`, {
      headers: auth(admin.token),
      data: { userId: member.userId, role: 'EDITOR' },
      failOnStatusCode: false,
    });
    expect(tRes.status(), `add reto team member: ${await tRes.text()}`).toBe(201);

    // ── 2. Creator creates the iniciativa FROM the reto ──────────────────────────
    const pRes = await api.post('/api/v1/projects', {
      headers: auth(creator.token),
      data: {
        name: `E2E Iniciativa PSI ${stamp}`,
        challengeLink: { challengeId, createdFrom: 'challenge' },
      },
      failOnStatusCode: false,
    });
    expect(pRes.ok(), `create iniciativa: ${await pRes.text()}`).toBeTruthy();
    const projectId = (await pRes.json()).data.id as string;

    // ── 3. The iniciativa is a NAVIGABLE steps project for the creator ───────────
    const projRes = await api.get(`/api/v1/projects/${projectId}`, { headers: auth(creator.token) });
    expect(projRes.ok(), `creator get project: ${await projRes.text()}`).toBeTruthy();
    const project = (await projRes.json()).data;
    expect(project.currentStep).toBe(0);
    expect(project.step0Status).toBe('IN_PROGRESS');

    // Steps 1..4 materialized: Step 1 open (NOT_STARTED), 2..4 BLOCKED.
    const stepsRes = await api.get(`/api/v1/projects/${projectId}/steps`, { headers: auth(creator.token) });
    expect(stepsRes.ok(), `creator get steps: ${await stepsRes.text()}`).toBeTruthy();
    const steps = (await stepsRes.json()).data as Array<{ number: number; name: string; status: string; modules: any[] }>;
    expect(steps.map((s) => s.number).sort()).toEqual([1, 2, 3, 4]);
    const s1 = steps.find((s) => s.number === 1)!;
    expect(s1.status).toBe('NOT_STARTED');
    expect(s1.modules.length).toBeGreaterThan(0);
    for (const n of [2, 3, 4]) {
      expect(steps.find((s) => s.number === n)!.status, `step ${n} must start BLOCKED`).toBe('BLOCKED');
    }

    // Direct step navigation (Step 0 portal + Step 1 detail) works.
    const step0Res = await api.get(`/api/v1/projects/${projectId}/step0`, { headers: auth(creator.token) });
    expect(step0Res.ok(), `creator get step0: ${await step0Res.text()}`).toBeTruthy();
    const step1Res = await api.get(`/api/v1/projects/${projectId}/steps/1`, { headers: auth(creator.token) });
    expect(step1Res.ok(), `creator get step 1: ${await step1Res.text()}`).toBeTruthy();
    expect((await step1Res.json()).data.number).toBe(1);

    // Listed in the creator's own project list.
    const listCreator = await api.get('/api/v1/projects', { headers: auth(creator.token) });
    expect(((await listCreator.json()).data as any[]).some((p) => p.id === projectId)).toBe(true);

    // ── 4. The INHERITED reto member navigates the steps WITHOUT re-capture ──────
    // Materialized TeamMember → the member sees + can open the iniciativa steps.
    const listMember = await api.get('/api/v1/projects', { headers: auth(member.token) });
    expect(
      ((await listMember.json()).data as any[]).some((p) => p.id === projectId),
      'inherited member must see the iniciativa in their project list (no re-capture)',
    ).toBe(true);

    const memberProj = await api.get(`/api/v1/projects/${projectId}`, { headers: auth(member.token) });
    expect(memberProj.ok(), `inherited member get project (access granted): ${await memberProj.text()}`).toBeTruthy();
    const memberStep1 = await api.get(`/api/v1/projects/${projectId}/steps/1`, { headers: auth(member.token) });
    expect(memberStep1.ok(), `inherited member navigate step 1: ${await memberStep1.text()}`).toBeTruthy();

    // ── 5. Team + meta are SHARED (inherited), not re-captured ────────────────────
    const teamRes = await api.get(`/api/v1/portfolio/initiatives/${projectId}/team`, { headers: auth(admin.token) });
    expect(teamRes.ok(), `resolve team: ${await teamRes.text()}`).toBeTruthy();
    const team = (await teamRes.json()).data as {
      members: Array<{ userId: string; role: string; inheritedFromChallenge: boolean }>;
      owner: string;
      inheritedCount: number;
    };
    expect(team.owner).toBe(creator.userId);
    const memberRow = team.members.find((m) => m.userId === member.userId)!;
    expect(memberRow.role).toBe('EDITOR');
    expect(memberRow.inheritedFromChallenge).toBe(true);
    expect(team.inheritedCount).toBe(1);

    const metaRes = await api.get(`/api/v1/portfolio/initiatives/${projectId}/meta`, { headers: auth(admin.token) });
    expect(metaRes.ok(), `get meta: ${await metaRes.text()}`).toBeTruthy();
    const meta = (await metaRes.json()).data;
    expect(meta.status, 'iniciativa starts at Step 0 for portfolio tracking').toBe('en_step_0');
    expect(meta.challenge.id).toBe(challengeId);
    // Breadcrumb inherited without re-capture: the frente name flows through the reto.
    expect(meta.challenge.strategicFront?.name).toBe(`E2E Frente PSI ${stamp}`);

    // ── 6. Tracked under its reto for the portfolio dashboard ────────────────────
    const initRes = await api.get(`/api/v1/portfolio/challenges/${challengeId}/initiatives`, { headers: auth(admin.token) });
    expect(initRes.ok(), `list reto initiatives: ${await initRes.text()}`).toBeTruthy();
    const inits = (await initRes.json()).data as Array<{ project: { id: string; currentStep: number } }>;
    const tracked = inits.find((i) => i.project.id === projectId)!;
    expect(tracked, 'iniciativa must be tracked under its reto').toBeTruthy();
    expect(tracked.project.currentStep).toBe(0);
  });
});
