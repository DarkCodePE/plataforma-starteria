import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? '';
const parsed = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.port !== '55433' || parsed.pathname !== '/starteria_e2e') {
  throw new Error('MVP-CHAT-02 verification refuses to run outside localhost:55433/starteria_e2e.');
}

const prisma = new PrismaClient();
const projects = ['mvp-chat01-step0', 'mvp-chat01-step2', 'mvp-chat01-step4', 'mvp-chat02-step2-completed', 'mvp-chat02-historical-no-output'];
const api = 'http://127.0.0.1:4106/api/v1';

async function snapshot() {
  return {
    cycles: await prisma.initiativeCycle.count({ where: { projectId: { in: projects } } }),
    checkpoints: await prisma.adaptiveCheckpointInstance.count({ where: { projectId: { in: projects } } }),
    outputs: await prisma.adaptiveStepOutput.count({ where: { projectId: { in: projects } } }),
    truthClaims: await prisma.truthClaim.count({ where: { projectId: { in: projects } } }),
    evidence: await prisma.evidence.count({ where: { projectId: { in: projects } } }),
    adaptiveEvents: await prisma.adaptiveAdaptationEvent.count({ where: { projectId: { in: projects } } }),
    sessions: await prisma.stepReasoningSession.count({ where: { projectId: { in: projects } } }),
    turns: await prisma.stepReasoningTurn.count({ where: { session: { projectId: { in: projects } } } }),
  };
}

async function main() {
  const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`;
  assert.equal(migrations.length, 67);
  assert.equal(migrations.some(item => item.migration_name === '20261027120000_ai03a_step_living_card'), false);

  const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'mvp-chat01.owner@starteria.test', password: 'demo123' }) });
  assert.equal(login.status, 200);
  const loginBody = await login.json() as any;
  const token = loginBody.data.accessToken;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const before = await snapshot();
  const portfolioBeforeResponse = await fetch(`${api}/portfolio/home`, { headers });
  assert.equal(portfolioBeforeResponse.status, 200);
  const portfolioBeforeBody = await portfolioBeforeResponse.json() as any;
  const portfolioOutputBefore = portfolioBeforeBody.data.strategicUnits.flatMap((unit: any) => unit.challenges).flatMap((challenge: any) => challenge.initiatives).find((item: any) => item.initiativeId === 'mvp-chat02-step2-completed')?.lastConfirmedOutput;

  const activeTurnPayload = { clientTurnId: '00000000-0000-4000-8000-000000000399', message: 'Verifica que conversar no confirma el Core.', mode: 'work_with_me' };
  const activeTurn = await fetch(`${api}/projects/mvp-chat01-step2/steps/2/copilot/turn`, { method: 'POST', headers, body: JSON.stringify(activeTurnPayload) });
  assert.equal(activeTurn.status, 201);
  const activeTurnBody = await activeTurn.json() as any;
  const activeReplay = await fetch(`${api}/projects/mvp-chat01-step2/steps/2/copilot/turn`, { method: 'POST', headers, body: JSON.stringify(activeTurnPayload) });
  assert.equal(activeReplay.status, 200);
  const activeReplayBody = await activeReplay.json() as any;
  assert.equal(activeReplayBody.data.idempotentReplay, true);
  assert.equal(activeReplayBody.data.turn.id, activeTurnBody.data.turn.id);

  const completedHistory = await fetch(`${api}/projects/mvp-chat02-step2-completed/steps/2/copilot/session`, { headers });
  assert.equal(completedHistory.status, 200);
  const completedBody = await completedHistory.json() as any;
  assert.equal(completedBody.data.turns.length, 1);

  const undocumentedHistory = await fetch(`${api}/projects/mvp-chat02-historical-no-output/steps/1/copilot/session`, { headers });
  assert.equal(undocumentedHistory.status, 200);

  const rejectedWrite = await fetch(`${api}/projects/mvp-chat02-step2-completed/steps/2/copilot/turn`, {
    method: 'POST', headers,
    body: JSON.stringify({ clientTurnId: '00000000-0000-4000-8000-000000000299', message: 'Este intento histórico debe rechazarse.', mode: 'work_with_me' }),
  });
  assert.equal(rejectedWrite.status, 409);
  const rejectedBody = await rejectedWrite.json() as any;
  assert.equal(rejectedBody.error.code, 'STEP_REASONING_STEP_CONFLICT');

  const portfolio = await fetch(`${api}/portfolio/home`, { headers });
  assert.equal(portfolio.status, 200);
  const portfolioBody = await portfolio.json() as any;
  const initiative = portfolioBody.data.strategicUnits.flatMap((unit: any) => unit.challenges).flatMap((challenge: any) => challenge.initiatives).find((item: any) => item.initiativeId === 'mvp-chat02-step2-completed');
  assert.deepEqual(initiative.lastConfirmedOutput, {
    id: 'mvp-chat02-step2-completed-output-2', cycleId: 'mvp-chat02-step2-completed-cycle', stepNumber: 2, version: 1,
    status: 'confirmed', outputKey: 'step2.execution-ready', sourceConfigurationId: 'mvp-chat02-step2-completed-config-2',
    confirmedAt: '2026-10-28T08:30:00.000Z', updatedAt: initiative.lastConfirmedOutput.updatedAt,
  });
  assert.deepEqual(initiative.lastConfirmedOutput, portfolioOutputBefore);

  const after = await snapshot();
  const coreBefore = { cycles: before.cycles, checkpoints: before.checkpoints, outputs: before.outputs, truthClaims: before.truthClaims, evidence: before.evidence, adaptiveEvents: before.adaptiveEvents };
  const coreAfter = { cycles: after.cycles, checkpoints: after.checkpoints, outputs: after.outputs, truthClaims: after.truthClaims, evidence: after.evidence, adaptiveEvents: after.adaptiveEvents };
  assert.deepEqual(coreAfter, coreBefore);
  assert.equal(after.sessions, before.sessions);
  assert.equal(after.turns, before.turns + 1);
  const evidence = { generatedAt: new Date().toISOString(), database: `${parsed.hostname}:${parsed.port}${parsed.pathname}`, migrations: { applied: migrations.length, migration68Applied: false }, before, after, coreBefore, coreAfter, http: { activeTurnCreated: activeTurn.status, activeTurnReplay: activeReplay.status, activeTurnReplayReusedId: activeReplayBody.data.turn.id === activeTurnBody.data.turn.id, historicalCompletedGet: completedHistory.status, historicalWithoutOutputGet: undocumentedHistory.status, historicalPostRejected: rejectedWrite.status, historicalPostCode: rejectedBody.error.code, portfolioGet: portfolio.status }, portfolioOutputBefore, portfolioLastConfirmedOutput: initiative.lastConfirmedOutput };
  writeFileSync(path.resolve(process.cwd(), '../artifacts/mvp-chat02/MVP_CHAT02_POSTGRES_HTTP_EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(evidence, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
