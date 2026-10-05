// Aislamiento organizacional del portafolio: precondición para correr el E2E Job-Driven en
// producción con un usuario y una organización dedicados (docs/e2e-job-driven/prod-dedicated-user.md).
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { BASE, getOk, login, postOk, registerAndLogin, type Session } from '../support/api';
import { LEAD_EMAIL, LEAD_PASSWORD, prisma } from '../support/portfolio-lead';

// Organización alternativa que siembra prisma/seed.e2e.ts (E2E_OTHER_ORG_ID).
const OTHER_ORG_ID = 'org-e2e-other';

let api: APIRequestContext;
let lead: Session;
let other: Session;

test.describe('Portafolio aislado por organización', () => {
  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE });
    lead = await login(api, LEAD_EMAIL, LEAD_PASSWORD);
    // Un Portfolio Lead de OTRA organización: es quien no debe ver los frentes del primero.
    other = await registerAndLogin(api, 'other-org-lead');
    await prisma.user.update({ where: { id: other.userId }, data: { role: 'portfolio_lead', roles: ['portfolio_lead'], organizationId: OTHER_ORG_ID } });
    other = await login(api, other.email, other.password);
  });

  test.afterAll(async () => {
    await prisma.strategicFront.deleteMany({ where: { name: { startsWith: 'E2E Org Isolation ' } } });
    await api.dispose();
    await prisma.$disconnect();
  });

  test('un frente nuevo queda en la organización de quien lo crea y no se ve desde otra', async () => {
    const name = `E2E Org Isolation ${Date.now()}`;
    const front = await postOk(api, lead.token, '/api/v1/portfolio/strategic-fronts', { name });
    const leadUser = await prisma.user.findUniqueOrThrow({ where: { email: LEAD_EMAIL }, select: { organizationId: true } });
    expect(front.organizationId).toBe(leadUser.organizationId);

    const leadFronts = await getOk(api, lead.token, '/api/v1/portfolio/strategic-fronts');
    expect(leadFronts.map((f: { name: string }) => f.name)).toContain(name);

    const otherRes = await api.get('/api/v1/portfolio/strategic-fronts', { headers: { Authorization: `Bearer ${other.token}` }, failOnStatusCode: false });
    expect(otherRes.ok(), await otherRes.text()).toBeTruthy();
    const otherFronts = (await otherRes.json()).data as Array<{ name: string }>;
    expect(otherFronts.map((f) => f.name)).not.toContain(name);

    const otherHome = await getOk(api, other.token, '/api/v1/portfolio/home');
    expect(JSON.stringify(otherHome)).not.toContain(name);
    const otherCapacity = await getOk(api, other.token, '/api/v1/portfolio/capacity');
    expect(JSON.stringify(otherCapacity)).not.toContain(name);
    // Y su propio Portfolio Home sí lo muestra.
    expect(JSON.stringify(await getOk(api, lead.token, '/api/v1/portfolio/home'))).toContain(name);
  });
});
