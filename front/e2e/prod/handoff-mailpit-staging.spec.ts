import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';
import { auth, getOk, login, postOk, type Session } from '../support/api';

const BASE = process.env.E2E_PROD_BASE_URL;
const MAILPIT = process.env.E2E_STAGING_MAILPIT_URL;
const LEAD = {
  email: process.env.E2E_PROD_LEAD_EMAIL ?? 'e2e-lead@starteria.test',
  password: process.env.E2E_PROD_LEAD_PASSWORD ?? '',
};
const PARTICIPANT = {
  email: process.env.E2E_PROD_PARTICIPANT_EMAIL ?? 'e2e-participante@starteria.test',
  password: process.env.E2E_PROD_PARTICIPANT_PASSWORD ?? '',
};

test.skip(!BASE || !MAILPIT || !LEAD.password || !PARTICIPANT.password,
  'This sandbox delivery journey runs only with the internal Mailpit port-forward.');
test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let lead: Session;
let participant: Session;
const created = { frontId: '', projectId: '' };

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({ baseURL: BASE });
  lead = await login(api, LEAD.email, LEAD.password);
  participant = await login(api, PARTICIPANT.email, PARTICIPANT.password);
});

test.afterAll(async () => {
  if (created.projectId) await api.delete(`/api/v1/projects/${created.projectId}`, { headers: auth(participant.token), failOnStatusCode: false });
  if (created.frontId) await api.delete(`/api/v1/portfolio/strategic-fronts/${created.frontId}`, { headers: auth(lead.token), failOnStatusCode: false });
  await api.dispose();
});

async function command(token: string, url: string, idempotencyKey: string, data: Record<string, unknown>) {
  const response = await api.post(url, {
    headers: { ...auth(token), 'Idempotency-Key': idempotencyKey },
    data,
    failOnStatusCode: false,
  });
  expect(response.ok(), `${url}: ${await response.text()}`).toBeTruthy();
  return (await response.json()).data;
}

async function invitationTokenFromMailpit(): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT}/api/v1/messages?limit=50`);
    if (response.ok) {
      const listing = await response.json() as { messages?: Array<Record<string, unknown>>; Messages?: Array<Record<string, unknown>> };
      const messages = listing.messages ?? listing.Messages ?? [];
      for (const summary of messages) {
        const id = summary.ID ?? summary.Id ?? summary.id;
        if (!id) continue;
        const detail = await fetch(`${MAILPIT}/api/v1/message/${encodeURIComponent(String(id))}`);
        if (!detail.ok) continue;
        const serialized = JSON.stringify(await detail.json());
        if (!serialized.toLowerCase().includes(PARTICIPANT.email.toLowerCase())) continue;
        const token = serialized.match(/\/handoff\/invitations\/([a-f0-9]{64})/i)?.[1];
        if (token) return token;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('Mailpit did not capture the synthetic Handoff invitation');
}

test('Mailpit delivery, recipient acceptance and continuity remain inside the synthetic tenant', async () => {
  const suffix = `mailpit-${Date.now()}`;
  const front = await postOk(api, lead.token, '/api/v1/portfolio/strategic-fronts', {
    name: `[E2E-STAGING] ${suffix} Front`,
    strategicObjective: 'Validate isolated Handoff continuity',
    constraints: 'Synthetic E2E data only',
  });
  created.frontId = front.id;

  const challenge = await postOk(api, lead.token, `/api/v1/portfolio/strategic-fronts/${front.id}/challenges`, {
    title: `[E2E-STAGING] ${suffix} Challenge`,
    whatWeWantToMove: 'Move one synthetic initiative into Step execution',
  });
  const project = await postOk(api, participant.token, '/api/v1/projects', {
    name: `[E2E-STAGING] ${suffix} Initiative`,
    challengeId: challenge.id,
  });
  created.projectId = project.id;

  const prepared = await command(
    lead.token,
    `/api/v1/portfolio/challenges/${challenge.id}/handoff-assignments`,
    `${suffix}-prepare`,
    {
      targetKind: 'EXISTING_INITIATIVE',
      initiativeId: project.id,
      briefId: null,
      briefVersionId: null,
      contextNote: 'Continue the synthetic initiative through the governed Steps flow.',
      invitedEmailNormalized: PARTICIPANT.email,
      members: [{ identityKey: PARTICIPANT.email, emailNormalized: PARTICIPANT.email, role: 'OWNER' }],
    },
  );
  const assignment = prepared.assignment;
  expect(assignment).toMatchObject({ targetKind: 'EXISTING_INITIATIVE', initiativeId: project.id, state: 'CREATED' });

  const delivered = await command(
    lead.token,
    `/api/v1/portfolio/handoff-assignments/${assignment.id}/invitation`,
    `${suffix}-deliver`,
    {},
  );
  expect(delivered).toMatchObject({ state: 'SENT', attemptStatus: 'SUCCEEDED' });

  const invitationToken = await invitationTokenFromMailpit();
  const claimed = await postOk(api, participant.token, '/api/v1/public/handoff-invitations/claim', { token: invitationToken });
  expect(claimed.identityClaimStatus).toBe('MATCHED');

  const accepted = await command(
    participant.token,
    `/api/v1/handoff/assignments/${assignment.id}/accept`,
    `${suffix}-accept`,
    { expectedVersion: claimed.version },
  );
  expect(accepted.state).toBe('ACCEPTED');

  const started = await command(
    participant.token,
    `/api/v1/handoff/assignments/${assignment.id}/start`,
    `${suffix}-start`,
    { expectedVersion: accepted.version, idempotencyKey: `${suffix}-start` },
  );
  expect(started.state).toBe('STARTED');

  const continuity = await getOk(api, participant.token, `/api/v1/handoff/assignments/${assignment.id}/post-start-continuity`);
  expect(['EXISTING_READY', 'EXISTING_ACTIVATION_REQUIRED']).toContain(continuity.outcome);
  expect(continuity.project.id).toBe(project.id);

  const adaptiveCore = await getOk(api, participant.token, `/api/v1/projects/${project.id}/adaptive-core`);
  expect(adaptiveCore).toBeTruthy();
});
