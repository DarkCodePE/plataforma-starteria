import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { errorHandler } from '../../../shared/errors/error-handler';
import { requestId } from '../../../shared/middleware/request-id';
import type {
  ModelExecutionResult,
  PortfolioEntryAgentAdapterV2,
  PortfolioEntryAnalyzeTurnInputV2,
  PortfolioEntryAnalyzeTurnOutputV2,
} from '../../portfolio-entry-runtime';
import {
  criticalSituationSynthesisSchema,
  type CriticalSituationSynthesis,
} from '../../portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import { LiveModelExecutionError } from '../../portfolio-entry-runtime/model/live-model-error';
import { hashPublicAccessToken } from '../../portfolio-entry-sessions/application/portfolio-entry-session.service';
import type { PortfolioEntryModelExecutionRecord } from '../../portfolio-entry-sessions/observability/portfolio-entry-execution-metadata';
import { InMemoryPortfolioEntrySessionRepository } from '../../portfolio-entry-sessions/infrastructure/in-memory-portfolio-entry-session.repository';
import { InMemoryPortfolioEntryIdempotencyRepository } from '../infrastructure/in-memory-portfolio-entry-idempotency.repository';
import type { PortfolioEntryIdempotencyRepository } from '../application/portfolio-entry-idempotency.repository';
import { buildPortfolioEntryRouter } from '../portfolio-entry.router';

const base = '/api/v1/public/portfolio-entry';
const legacyCompatibilityRepositories = new WeakMap<express.Express, InMemoryPortfolioEntrySessionRepository>();

describe('Portfolio Entry Experimental Session API', () => {
  it('D1 resolves the exact owner-confirmed Brief with provenance and no session writes', async () => {
    const { app, repository } = makeApp();
    const fixture = await confirmedBriefFixture(app);
    const before = await repository.findSessionById(fixture.sessionId);
    const result = await request(app).get(confirmedBriefPath(fixture)).set('Authorization', 'Bearer user-1').expect(200);
    expect(result.body.data).toMatchObject({
      source: 'portfolio_entry', sessionId: fixture.sessionId, revision: fixture.sessionRevision,
      handoffId: fixture.handoffId, handoffVersion: fixture.handoffVersion,
      confirmationId: fixture.confirmationId, confirmationVersion: fixture.confirmationVersion,
      brief: { rawEntry: expect.any(String), handoff: expect.any(Object), confirmation: {
        status: 'CONFIRMED', acceptedFields: ['understood_need'], correctedFields: {}, rejectedFields: [],
      } },
    });
    const after = await repository.findSessionById(fixture.sessionId);
    expect(after?.revision).toBe(before?.revision);
    expect(after?.latestHandoff).toEqual(before?.latestHandoff);
    expect(after?.confirmation).toEqual(before?.confirmation);
  });

  it('D1 masks missing and foreign sessions and rejects stale or mismatched identities', async () => {
    const { app } = makeApp();
    const fixture = await confirmedBriefFixture(app);
    await request(app).get(confirmedBriefPath(fixture)).expect(401);
    const foreign = await request(app).get(confirmedBriefPath(fixture)).set('Authorization', 'Bearer user-2').expect(404);
    const missing = await request(app).get(confirmedBriefPath({ ...fixture, sessionId: '2c6735b4-bc30-4b53-9f52-03c83dc46f22' })).set('Authorization', 'Bearer user-1').expect(404);
    expect(foreign.body.error.code).toBe(missing.body.error.code);
    expect(JSON.stringify(foreign.body)).not.toContain(fixture.sessionId);
    await request(app).get(confirmedBriefPath({ ...fixture, sessionRevision: fixture.sessionRevision + 1 })).set('Authorization', 'Bearer user-1').expect(409);
    await request(app).get(confirmedBriefPath({ ...fixture, handoffVersion: fixture.handoffVersion + 1 })).set('Authorization', 'Bearer user-1').expect(409);
    await request(app).get(confirmedBriefPath({ ...fixture, confirmationVersion: fixture.confirmationVersion + 1 })).set('Authorization', 'Bearer user-1').expect(409);
    await request(app).get(confirmedBriefPath({ ...fixture, handoffId: 'different-handoff' })).set('Authorization', 'Bearer user-1').expect(409);
    await request(app).get(confirmedBriefPath({ ...fixture, confirmationId: 'different-confirmation' })).set('Authorization', 'Bearer user-1').expect(409);
  });

  it('D1 returns 410 for abandoned or expired and 409 for a not-confirmed session', async () => {
    const { app, repository } = makeApp();
    for (const lifecycleStatus of ['ABANDONED', 'EXPIRED'] as const) {
      const fixture = await confirmedBriefFixture(app);
      const current = await repository.findSessionById(fixture.sessionId);
      await repository.saveSessionState({
        session: {
          ...current!, lifecycleStatus,
          ...(lifecycleStatus === 'EXPIRED' ? { expiresAt: new Date(Date.now() - 1_000) } : {}),
          revision: current!.revision + 1,
        },
        expectedRevision: current!.revision,
      });
      await request(app).get(confirmedBriefPath(fixture)).set('Authorization', 'Bearer user-1').expect(410);
    }
    const ready = await legacyHandoffReadySession(app);
    const handoff = await request(app).post(`${base}/sessions/${ready.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', ready.token).set('Idempotency-Key', `d1-not-confirmed-handoff-${ready.sessionId}`)
      .send({ expectedRevision: ready.revision }).expect(200);
    await request(app).post(`${base}/sessions/${ready.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1').set('X-Starteria-Entry-Token', ready.token)
      .set('Idempotency-Key', `d1-not-confirmed-claim-${ready.sessionId}`)
      .send({ expectedRevision: handoff.body.data.revision }).expect(200);
    await request(app).get(confirmedBriefPath({
      sessionId: ready.sessionId, source: 'portfolio_entry', sessionRevision: handoff.body.data.revision,
      handoffId: handoff.body.data.handoff.id, handoffVersion: handoff.body.data.handoff.version,
      confirmationId: 'not-confirmed', confirmationVersion: 1,
    })).set('Authorization', 'Bearer user-1').expect(409);
  });

  it('abandons only a confirmed Brief, is idempotent, and makes D1 continuation identity unavailable', async () => {
    const { app, repository } = makeApp();
    const fixture = await confirmedBriefFixture(app);
    const before = await repository.findSessionById(fixture.sessionId);
    const path = `${base}/sessions/${fixture.sessionId}/abandon`;
    const first = await request(app).post(path).set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', `abandon-${fixture.sessionId}`).send({ expectedRevision: fixture.sessionRevision }).expect(200);
    expect(first.body.data).toMatchObject({ lifecycleStatus: 'ABANDONED', revision: fixture.sessionRevision + 1 });
    const second = await request(app).post(path).set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', `abandon-repeat-${fixture.sessionId}`).send({ expectedRevision: fixture.sessionRevision }).expect(200);
    expect(second.body.data).toEqual(first.body.data);
    const after = await repository.findSessionById(fixture.sessionId);
    expect(after?.lifecycleStatus).toBe('ABANDONED');
    expect(after?.revision).toBe(before!.revision + 1);
    await request(app).get(confirmedBriefPath(fixture)).set('Authorization', 'Bearer user-1').expect(410);
  });

  it('creates an anonymous session without a model call and returns the raw token once', async () => {
    const adapter = new FakeAgentAdapter();
    const { app, repository } = makeApp({ adapter });

    const res = await request(app).post(`${base}/sessions`).send({}).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.publicAccessToken).toHaveLength(64);
    expect(adapter.calls).toHaveLength(0);
    expect(res.body.data.session.revision).toBe(0);
    expect(res.body.data.session.conversation).toEqual([]);
    const stored = await repository.findSessionById(res.body.data.session.id);
    expect(stored?.rawEntry).toBe('');
    expect(stored?.publicAccessTokenHash).toBe(hashPublicAccessToken(res.body.data.publicAccessToken));
    expect(stored?.publicAccessTokenHash).not.toBe(res.body.data.publicAccessToken);

    const read = await request(app)
      .get(`${base}/sessions/${res.body.data.session.id}`)
      .set('X-Starteria-Entry-Token', res.body.data.publicAccessToken)
      .expect(200);
    expect(read.body.data.publicAccessToken).toBeUndefined();
  });

  it('rejects wrong or expired anonymous credentials', async () => {
    const { app, repository } = makeApp();
    const created = await createSession(app);

    await request(app)
      .get(`${base}/sessions/${created.sessionId}`)
      .set('X-Starteria-Entry-Token', 'wrong')
      .expect(401);

    const stored = await repository.findSessionById(created.sessionId);
    await repository.saveSessionState({
      session: {
        ...stored!,
        expiresAt: new Date(Date.now() - 1_000),
        revision: stored!.revision + 1,
      },
      expectedRevision: stored!.revision,
    });

    await request(app)
      .get(`${base}/sessions/${created.sessionId}`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(410);
  });

  it('submits the first message through Runtime, preserves semantic guardrails, and rejects stale revisions', async () => {
    const { app } = makeApp();
    const created = await createSession(app);

    const submitted = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'submit-1')
      .send({ expectedRevision: 0, message: 'Queremos ordenar iniciativas de experiencia cliente para decidir cuales financiar este trimestre.' })
      .expect(200);

    expect(submitted.body.data.revision).toBe(2);
    expect(submitted.body.data.conversation).toHaveLength(1);
    expect(submitted.body.data.clarification.quickQuestionsAsked).toBeLessThanOrEqual(3);
    expect(submitted.body.data.clarification.answeredGaps).toEqual([]);
    expect(submitted.body.data.conversation[0].respondedResolves).toEqual([]);
    expect(submitted.body.data.clarification.interactionMode).toBe('quick_clarification');

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'submit-stale')
      .send({ expectedRevision: 0, message: 'Otro intento con revision obsoleta.' })
      .expect(409);
  });

  it('keeps live quick clarification sessions open and accepts the next answer', async () => {
    const { app } = makeApp({ adapter: new ClarifyingThenReadyAdapter() });
    const created = await createSession(app);
    const firstMessage = 'Tenemos muchas iniciativas de Operaciones abiertas, con reclamos y retrabajo, pero todavia no sabemos que decision concreta necesita tomar la gerencia ni que criterios usar.';

    const first = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'clarify-live-like-1')
      .send({ expectedRevision: 0, message: firstMessage })
      .expect(200);

    expect(first.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect(first.body.data.lifecycleStatus).not.toBe('ABANDONED');
    expect(first.body.data.nextAction).toBe('answer_clarification');
    expect(first.body.data.clarification.quickQuestionsAsked).toBe(1);
    expect(first.body.data.conversation[0].emittedQuestions).toHaveLength(1);
    const governedReason = first.body.data.conversation[0].emittedQuestions[0].reason_to_ask;
    expect(typeof governedReason).toBe('string');
    expect(governedReason.length).toBeGreaterThan(0);

    const refreshed = await request(app)
      .get(`${base}/sessions/${created.sessionId}`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200);
    expect(refreshed.body.data.conversation[0].emittedQuestions[0].reason_to_ask).toBe(governedReason);

    const questionIds = first.body.data.conversation[0].emittedQuestions.map((question: { id: string }) => question.id);
    const resolves = first.body.data.conversation[0].emittedQuestions[0].resolves;
    const checkpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'clarify-live-like-2')
      .send({
        expectedRevision: first.body.data.revision,
        message: 'La gerencia debe decidir que tres iniciativas financiar primero. Usaremos impacto operativo, urgencia, riesgo y capacidad disponible como criterios.',
        matchedQuestionIds: [questionIds[0]],
        respondedResolves: resolves,
      })
      .expect(200);

    expect(checkpoint.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect(checkpoint.body.data.nextAction).toBe('offer_guided_exploration');
    expect(checkpoint.body.data.clarification.quickQuestionsAsked).toBeLessThanOrEqual(3);
    expect(checkpoint.body.data.conversation.at(-1).emittedQuestions).toEqual([]);
    expect(checkpoint.body.data.conversation[0].emittedQuestions[0]).not.toHaveProperty('reason_to_ask');

    const handoff = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'clarify-live-like-provisional')
      .send({ expectedRevision: checkpoint.body.data.revision, choice: 'provisional_route' })
      .expect(200);

    expect(handoff.body.data.lifecycleStatus).toBe('HANDOFF_ELIGIBLE');
    expect(handoff.body.data.nextAction).toBe('generate_handoff');
    expect(handoff.body.data.semanticProjection.initialEntryState).toBe('portfolio_first');
    expect(handoff.body.data.semanticProjection.currentFrame).toBe('portfolio_first');
  });

  it('offers Guided Exploration without automatic opt-in and accepts through the explicit HTTP contract', async () => {
    const adapter = new GuidedExplorationAdapter();
    const { app } = makeApp({ adapter });
    const offered = await offerGuidedExploration(app);

    expect(offered.response.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect(offered.response.body.data.nextAction).toBe('offer_guided_exploration');
    expect(offered.response.body.data.clarification.interactionMode).toBe('quick_clarification');
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[1].sessionContext.clarification_status).toBe('in_progress');

    const accepted = await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', offered.token)
      .set('Idempotency-Key', 'guided-accept-1')
      .send({ expectedRevision: offered.response.body.data.revision, choice: 'accept' })
      .expect(200);

    expect(accepted.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect(accepted.body.data.clarification.interactionMode).toBe('guided_exploration');
    expect(accepted.body.data.clarification.explorationRound).toBe(1);
    expect(accepted.body.data.clarification.quickQuestionsAsked).toBeLessThanOrEqual(3);
    expect(accepted.body.data.clarification.answeredGaps).toEqual(['analysis.extracted_context.decision_need']);
    expect(accepted.body.data.semanticProjection.currentFrame).toBe('portfolio_first');
    expect(adapter.calls).toHaveLength(3);
    expect(adapter.calls[2].sessionContext.clarification_status).toBe('guided_exploration');
    expect(adapter.calls[2].sessionContext.interaction_mode).toBe('guided_exploration');
    expect(adapter.calls[2].priorAnalysis?.extracted_context.summary).toBe(
      'Aun necesitamos seguir aclarando criterios, restricciones y decision final antes de ordenar el portafolio.',
    );
  });

  it('chooses a provisional route through Runtime and reaches handoff readiness', async () => {
    const adapter = new GuidedExplorationAdapter();
    const { app, repository } = makeApp({ adapter });
    const offered = await offerGuidedExploration(app);

    const provisional = await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', offered.token)
      .set('Idempotency-Key', 'guided-provisional-1')
      .send({ expectedRevision: offered.response.body.data.revision, choice: 'provisional_route' })
      .expect(200);

    expect(provisional.body.data.lifecycleStatus).toBe('HANDOFF_ELIGIBLE');
    expect(provisional.body.data.nextAction).toBe('generate_handoff');
    expect(adapter.calls).toHaveLength(2);
    const stored = await repository.findSessionById(offered.sessionId);
    expect(stored?.semanticState.runtimeClarificationStatus).toBe('ready_for_handoff');
    expect(stored?.semanticState.userExplorationChoice).toBe('provisional_route');
  });

  it('protects Guided Exploration choice with CAS, idempotency, credentials, expiry, owner auth, and lifecycle guards', async () => {
    const { app, repository } = makeApp({ adapter: new GuidedExplorationAdapter() });
    const offered = await offerGuidedExploration(app);
    const revision = offered.response.body.data.revision;
    const payload = { expectedRevision: revision, choice: 'accept' };

    await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', offered.token)
      .set('Idempotency-Key', 'guided-stale')
      .send({ ...payload, expectedRevision: revision - 1 })
      .expect(409);

    await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', 'wrong')
      .set('Idempotency-Key', 'guided-wrong-token')
      .send(payload)
      .expect(401);

    const first = await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', offered.token)
      .set('Idempotency-Key', 'guided-replay')
      .send(payload)
      .expect(200);
    const replay = await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', offered.token)
      .set('Idempotency-Key', 'guided-replay')
      .send(payload)
      .expect(200);
    expect(replay.body).toEqual(first.body);

    await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', offered.token)
      .set('Idempotency-Key', 'guided-replay')
      .send({ expectedRevision: revision, choice: 'provisional_route' })
      .expect(409);

    const invalid = await createSession(app);
    await request(app)
      .post(`${base}/sessions/${invalid.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', invalid.token)
      .set('Idempotency-Key', 'guided-invalid-lifecycle')
      .send({ expectedRevision: 0, choice: 'accept' })
      .expect(409);

    const expired = await offerGuidedExploration(app);
    const expiredStored = await repository.findSessionById(expired.sessionId);
    await repository.saveSessionState({
      session: {
        ...expiredStored!,
        expiresAt: new Date(Date.now() - 1_000),
        revision: expiredStored!.revision + 1,
      },
      expectedRevision: expiredStored!.revision,
    });
    await request(app)
      .post(`${base}/sessions/${expired.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', expired.token)
      .set('Idempotency-Key', 'guided-expired')
      .send({ expectedRevision: expiredStored!.revision + 1, choice: 'provisional_route' })
      .expect(410);
  });

  it('allows the claimed owner to choose Guided Exploration without the anonymous token', async () => {
    const { app } = makeApp({ adapter: new GuidedExplorationAdapter() });
    const offered = await offerGuidedExploration(app);
    const claimed = await request(app)
      .post(`${base}/sessions/${offered.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', offered.token)
      .set('Idempotency-Key', 'claim-before-guided')
      .send({ expectedRevision: offered.response.body.data.revision })
      .expect(200);

    const accepted = await request(app)
      .post(`${base}/sessions/${offered.sessionId}/guided-exploration`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'guided-owner-accept')
      .send({ expectedRevision: claimed.body.data.revision, choice: 'accept' })
      .expect(200);

    expect(accepted.body.data.ownership.state).toBe('CLAIMED');
    expect(accepted.body.data.clarification.interactionMode).toBe('guided_exploration');
  });

  it('persists requestedModel as internal execution metadata', async () => {
    const adapter = new ModelMetadataAdapter();
    const { app, repository } = makeApp({ adapter });
    const created = await createSession(app);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'metadata-requested-model')
      .send({ expectedRevision: 0, message: 'Necesitamos ordenar iniciativas comerciales para decidir foco y financiamiento trimestral.' })
      .expect(200);

    const executions = await repository.listModelExecutions(created.sessionId);
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({
      provider: 'openai_responses',
      requestedModel: 'gpt-5.6-luna',
      providerReportedModel: 'gpt-5.6-luna-2026-09-12',
    });
  });

  it('does not let execution metadata persistence failure corrupt a successful turn', async () => {
    const repository = new ExecutionFailsRepository();
    const { app } = makeApp({ adapter: new ModelMetadataAdapter(), repository });
    const created = await createSession(app);

    const response = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'metadata-fails-semantic-succeeds')
      .send({ expectedRevision: 0, message: 'Necesitamos ordenar iniciativas comerciales para decidir foco y financiamiento trimestral.' })
      .expect(200);

    expect(response.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect(response.body.data.nextAction).toBe('offer_guided_exploration');
    const stored = await repository.findSessionById(created.sessionId);
    expect(stored?.lifecycleStatus).toBe('CLARIFYING');
    expect(stored?.revision).toBe(2);
  });

  it('replays duplicate idempotent submits and rejects reused keys with different payloads', async () => {
    const { app } = makeApp();
    const created = await createSession(app);
    const payload = { expectedRevision: 0, message: 'Mensaje suficientemente largo para que exista una respuesta estable y reproducible.' };

    const first = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'same-submit')
      .send(payload)
      .expect(200);
    const replay = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'same-submit')
      .send(payload)
      .expect(200);
    expect(replay.body).toEqual(first.body);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'same-submit')
      .send({ ...payload, message: 'payload distinto' })
      .expect(409);
  });

  it('recovers a semantic commit when idempotency completion is interrupted', async () => {
    const idempotency = new CompleteFailsOnceRepository();
    const { app, repository } = makeApp({ idempotencyRepository: idempotency });
    const created = await createSession(app);
    const payload = { expectedRevision: 0, message: 'Mensaje suficientemente largo para recuperar el resultado persistido.' };

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'recover-submit')
      .send(payload)
      .expect(500);

    const retry = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'recover-submit')
      .send(payload)
      .expect(200);
    expect(retry.body.data.conversation).toHaveLength(1);
    expect((await repository.listTurns(created.sessionId))).toHaveLength(1);
  });

  it('keeps the received input when live composition is unavailable', async () => {
    const { app } = makeApp({ useDefaultAdapter: true });
    const created = await createSession(app);
    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'missing-live-provider')
      .send({ expectedRevision: 0, message: 'Mensaje de prueba para provider no configurado.' })
      .expect(200);
    expect((await request(app)
      .get(`${base}/sessions/${created.sessionId}`)
      .set('X-Starteria-Entry-Token', created.token)).body.data.pendingInput.status).toBe('FAILED_RETRYABLE');
  });

  it('keeps provider failure retryable without asking for the answer again', async () => {
    const adapter = new FailingAgentAdapter();
    const { app, repository } = makeApp({ adapter });
    const created = await createSession(app);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'provider-fails')
      .send({ expectedRevision: 0, message: 'Necesitamos ordenar el portafolio.' })
      .expect(200);

    const stored = await repository.findSessionById(created.sessionId);
    const executions = await repository.listModelExecutions(created.sessionId);
    expect(stored?.lifecycleStatus).toBe('ENTRY_CAPTURED');
    expect(stored?.revision).toBe(2);
    expect(stored?.semanticState.pendingInput?.value).toBe('Necesitamos ordenar el portafolio.');
    expect(stored?.semanticState.pendingInput?.status).toBe('FAILED_RETRYABLE');
    expect(executions).toHaveLength(1);
    expect(executions[0].technicalError).toBe('provider timeout');
  });

  it('retries the same persisted pending answer without duplicating the logical turn', async () => {
    const adapter = new FailOnceAgentAdapter();
    const { app, repository } = makeApp({ adapter });
    const created = await createSession(app);
    const message = 'Necesitamos ordenar el portafolio antes de decidir foco y financiamiento.';

    const failed = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'pending-fails-once')
      .send({ expectedRevision: 0, message })
      .expect(200);
    const pendingId = failed.body.data.pendingInput.id;
    expect(failed.body.data.revision).toBe(2);

    const retried = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'pending-retry-fresh-key')
      .send({ expectedRevision: failed.body.data.revision, message })
      .expect(200);

    expect(retried.body.data.conversation).toHaveLength(1);
    expect(retried.body.data.pendingInput.id).toBe(pendingId);
    expect(retried.body.data.pendingInput.status).toBe('ANALYZED');
    expect(retried.body.data.revision).toBe(4);
    expect((await repository.listTurns(created.sessionId))).toHaveLength(1);
    expect(adapter.calls).toHaveLength(2);
  });

  it('does not overwrite newer state when a valid model result loses the CAS race', async () => {
    const adapter = new FakeAgentAdapter();
    const { app, repository } = makeApp({ adapter });
    const created = await createSession(app);

    const [first, second] = await Promise.all([
      request(app)
        .post(`${base}/sessions/${created.sessionId}/messages`)
        .set('X-Starteria-Entry-Token', created.token)
        .set('Idempotency-Key', 'race-1')
        .send({ expectedRevision: 0, message: 'Primera version suficientemente larga para habilitar analisis.' }),
      request(app)
        .post(`${base}/sessions/${created.sessionId}/messages`)
        .set('X-Starteria-Entry-Token', created.token)
        .set('Idempotency-Key', 'race-2')
        .send({ expectedRevision: 0, message: 'Segunda version suficientemente larga para competir por CAS.' }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const turns = await repository.listTurns(created.sessionId);
    const stored = await repository.findSessionById(created.sessionId);
    expect(turns).toHaveLength(1);
    expect(stored?.revision).toBe(2);
  });

  it('materializes, reads, confirms, and corrects handoffs without exposing internals or conversion eligibility', async () => {
    const { app } = makeApp();
    const first = await legacyHandoffReadySession(app);

    const handoff = await request(app)
      .post(`${base}/sessions/${first.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', first.token)
      .set('Idempotency-Key', 'handoff-1')
      .send({ expectedRevision: first.revision })
      .expect(200);

    expect(handoff.body.data.handoff.reviewDisposition).toBe('UNREVIEWED');
    expect(handoff.body.data.handoff.handoff.recommended_approach.origin).toBe('AI_SUGGESTED');
    expect(JSON.stringify(handoff.body.data)).not.toContain('provider');
    expect(JSON.stringify(handoff.body.data)).not.toContain('publicAccessTokenHash');
    expect(handoff.body.data.lifecycleStatus).toBe('HANDOFF_READY');

    await request(app)
      .get(`${base}/sessions/${first.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', first.token)
      .expect(200);

    const firstClaim = await request(app)
      .post(`${base}/sessions/${first.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', first.token)
      .set('Idempotency-Key', 'confirm-claim-1')
      .send({ expectedRevision: handoff.body.data.revision })
      .expect(200);

    const confirmed = await request(app)
      .post(`${base}/sessions/${first.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'confirm-1')
      .send({ expectedRevision: firstClaim.body.data.revision, action: 'confirm', acceptedFields: ['understood_need'] })
      .expect(200);
    expect(confirmed.body.data.lifecycleStatus).toBe('CONFIRMED');
    expect(confirmed.body.data.confirmation.status).toBe('CONFIRMED');
    expect(confirmed.body.data.lifecycleStatus).not.toBe('CONVERSION_ELIGIBLE');

    const second = await legacyHandoffReadySession(app);
    const secondHandoff = await request(app)
      .post(`${base}/sessions/${second.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', second.token)
      .set('Idempotency-Key', 'handoff-2')
      .send({ expectedRevision: second.revision })
      .expect(200);
    const secondClaim = await request(app)
      .post(`${base}/sessions/${second.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', second.token)
      .set('Idempotency-Key', 'correct-claim-1')
      .send({ expectedRevision: secondHandoff.body.data.revision })
      .expect(200);
    const corrected = await request(app)
      .post(`${base}/sessions/${second.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'correct-1')
      .send({
        expectedRevision: secondClaim.body.data.revision,
        action: 'correct',
        correctedFields: { understood_need: 'Correccion humana' },
      })
      .expect(200);
    expect(corrected.body.data.lifecycleStatus).toBe('REVISIONS_REQUESTED');
    expect(corrected.body.data.confirmation.correctedFields.understood_need).toBe('Correccion humana');
    expect(secondHandoff.body.data.handoff.handoff.recommended_approach.origin).toBe('AI_SUGGESTED');

    const confirmedAfterCorrection = await request(app)
      .post(`${base}/sessions/${second.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'confirm-after-correct-1')
      .send({ expectedRevision: corrected.body.data.revision, action: 'confirm', acceptedFields: ['understood_need', 'desired_outcome', 'known_context'] })
      .expect(200);
    expect(confirmedAfterCorrection.body.data.lifecycleStatus).toBe('CONFIRMED');
    expect(confirmedAfterCorrection.body.data.lifecycleStatus).not.toBe('CONVERSION_ELIGIBLE');
  });

  it('claims anonymous sessions with auth, then requires the owner and rejects the anonymous token', async () => {
    const adapter = new FakeAgentAdapter();
    const { app } = makeApp({ adapter });
    const created = await createSession(app);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'claim-no-auth')
      .send({ expectedRevision: 0 })
      .expect(401);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'claim-no-token')
      .send({ expectedRevision: 0 })
      .expect(401);

    const claimed = await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'claim-ok')
      .send({ expectedRevision: 0 })
      .expect(200);
    expect(claimed.body.data.ownership.state).toBe('CLAIMED');
    expect(claimed.body.data.ownership.ownerUserId).toBe('user-1');
    expect(claimed.body.data.provisionalContinuation.state).toBe('AUTHENTICATED_PROVISIONAL_CONTINUATION');
    expect(claimed.body.data.provisionalContinuation.access.portfolio).toBe('PROVISIONAL_ONLY');
    expect(adapter.calls).toHaveLength(0);

    const continuation = await request(app)
      .get(`${base}/sessions/${created.sessionId}/provisional-continuation`)
      .set('Authorization', 'Bearer user-1')
      .expect(200);
    expect(continuation.body.data.id).toBe(created.sessionId);
    expect(continuation.body.data.provisionalContinuation.sessionId).toBe(created.sessionId);
    expect(continuation.body.data.provisionalContinuation.state).toBe('AUTHENTICATED_PROVISIONAL_CONTINUATION');
    expect(adapter.calls).toHaveLength(0);

    await request(app)
      .get(`${base}/sessions/${created.sessionId}/provisional-continuation`)
      .expect(401);
    await request(app)
      .get(`${base}/sessions/${created.sessionId}/provisional-continuation`)
      .set('Authorization', 'Bearer user-2')
      .expect(403);

    const retry = await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'claim-retry')
      .send({ expectedRevision: 0 })
      .expect(200);
    expect(retry.body.data.id).toBe(claimed.body.data.id);
    expect(retry.body.data.revision).toBe(claimed.body.data.revision);
    expect(retry.body.data.provisionalContinuation).toEqual(claimed.body.data.provisionalContinuation);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-2')
      .send({ expectedRevision: 0 })
      .expect(403);

    await request(app)
      .get(`${base}/sessions/${created.sessionId}`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(401);
    await request(app)
      .get(`${base}/sessions/${created.sessionId}`)
      .set('Authorization', 'Bearer user-2')
      .expect(403);
    await request(app)
      .get(`${base}/sessions/${created.sessionId}`)
      .set('Authorization', 'Bearer user-1')
      .expect(200);
  });

  it('rejects a stale claim revision without changing ownership', async () => {
    const { app, repository } = makeApp();
    const created = await createSession(app);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'claim-stale')
      .send({ expectedRevision: 9 })
      .expect(409);

    const stored = await repository.findSessionById(created.sessionId);
    expect(stored?.ownershipState).toBe('ANONYMOUS');
    expect(stored?.ownerUserId).toBeNull();
    expect(stored?.revision).toBe(0);
  });

  it('preserves the frozen handoff, provenance, open items, and organizational unknowns during claim', async () => {
    const adapter = new FakeAgentAdapter();
    const { app, repository } = makeApp({ adapter });
    const ready = await legacyHandoffReadySession(app);
    const handoff = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', ready.token)
      .set('Idempotency-Key', 'claim-handoff')
      .send({ expectedRevision: ready.revision })
      .expect(200);
    const claimedBeforeConfirm = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', ready.token)
      .set('Idempotency-Key', 'claim-before-confirm')
      .send({ expectedRevision: handoff.body.data.revision })
      .expect(200);
    const confirmed = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'claim-confirm')
      .send({ expectedRevision: claimedBeforeConfirm.body.data.revision, action: 'confirm', acceptedFields: ['understood_need'] })
      .expect(200);
    const callsBeforeClaim = adapter.calls.length;
    const storedBeforeClaim = await repository.findSessionById(ready.sessionId);

    const claimed = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', ready.token)
      .set('Idempotency-Key', 'claim-preserve')
      .send({ expectedRevision: confirmed.body.data.revision })
      .expect(200);
    const projection = claimed.body.data.provisionalContinuation;

    expect(adapter.calls).toHaveLength(callsBeforeClaim);
    expect(claimed.body.data.lifecycleStatus).toBe('CONFIRMED');
    expect(claimed.body.data.handoff).toEqual(confirmed.body.data.handoff);
    expect(claimed.body.data.confirmation).toEqual(confirmed.body.data.confirmation);
    expect(projection.handoff).toEqual({ id: confirmed.body.data.handoff.id, version: confirmed.body.data.handoff.version });
    expect(projection.payload.provenance).toEqual(confirmed.body.data.handoff.handoff.provenance_summary);
    expect(projection.payload.organizationalUnknowns).toEqual(confirmed.body.data.handoff.handoff.unresolved_context);
    expect(projection.payload.currentOpenItems).toEqual(confirmed.body.data.handoff.handoff.evidence_or_clarity_needed);
    expect(projection.payload.rawPublicContext).toBe(storedBeforeClaim?.rawEntry);
    expect(claimed.body.data.project).toBeUndefined();
    expect(claimed.body.data.initiative).toBeUndefined();
    expect(claimed.body.data.steps).toBeUndefined();

    const storedAfterClaim = await repository.findSessionById(ready.sessionId);
    expect(storedAfterClaim?.ownerUserId).toBe('user-1');
    expect(storedAfterClaim?.revision).toBe(confirmed.body.data.revision);
  });

  it('enforces authenticated owner confirmation, explicit user fields, CAS, idempotency and zero cognition', async () => {
    const adapter = new FakeAgentAdapter();
    const { app } = makeApp({ adapter });
    const ready = await legacyHandoffReadySession(app);
    const handoff = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', ready.token)
      .set('Idempotency-Key', 'conf-handoff')
      .send({ expectedRevision: ready.revision })
      .expect(200);
    const claimed = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', ready.token)
      .set('Idempotency-Key', 'conf-claim')
      .send({ expectedRevision: handoff.body.data.revision })
      .expect(200);
    const callsBefore = adapter.calls.length;

    await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
      .set('Idempotency-Key', 'anonymous-confirm')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm' })
      .expect(401);
    await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-2')
      .set('Idempotency-Key', 'cross-user-confirm')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm' })
      .expect(403);
    await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'authority-confirm')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm', acceptedFields: ['sponsor'] })
      .expect(400);

    const corrected = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'owner-correction')
      .send({
        expectedRevision: claimed.body.data.revision,
        action: 'correct',
        correctedFields: { understood_need: 'La necesidad propia corregida.' },
      })
      .expect(200);
    expect(corrected.body.data.provisionalContinuation.payload.understoodNeed.value).toBe('La necesidad propia corregida.');
    expect(corrected.body.data.provisionalContinuation.payload.understoodNeed.provenance.review_disposition).toBe('USER_CONFIRMED');
    expect(corrected.body.data.provisionalContinuation.payload.organizationalUnknowns).toHaveLength(1);
    expect(adapter.calls).toHaveLength(callsBefore);

    await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'stale-confirm')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm' })
      .expect(409);
    const repeated = await request(app)
      .post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'owner-correction')
      .send({
        expectedRevision: claimed.body.data.revision,
        action: 'correct',
        correctedFields: { understood_need: 'La necesidad propia corregida.' },
      })
      .expect(200);
    expect(repeated.body.data.revision).toBe(corrected.body.data.revision);
    expect(repeated.body.data.provisionalContinuation.payload.organizationalUnknowns).toHaveLength(1);
    expect(repeated.body.data.projectId).toBeUndefined();
    expect(repeated.body.data.initiativeId).toBeUndefined();
    expect(repeated.body.data.steps).toBeUndefined();
  });

  it('persists explicit Strategic Intent decisions, rejects contradictions, and exposes only stored confirmation through D1', async () => {
    const { app, repository } = makeApp();
    const ready = await legacyHandoffReadySession(app);
    const handoff = await request(app).post(`${base}/sessions/${ready.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', ready.token).set('Idempotency-Key', `intent-handoff-${ready.sessionId}`)
      .send({ expectedRevision: ready.revision }).expect(200);
    const claimed = await request(app).post(`${base}/sessions/${ready.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1').set('X-Starteria-Entry-Token', ready.token)
      .set('Idempotency-Key', `intent-claim-${ready.sessionId}`)
      .send({ expectedRevision: handoff.body.data.revision }).expect(200);
    const confirmationUrl = `${base}/sessions/${ready.sessionId}/handoff/confirmation`;
    const terminalReadingFields = [
      'understood_need', 'desired_outcome', 'decision_to_enable', 'known_context',
      'unresolved_context', 'evidence_or_clarity_needed',
    ];
    await request(app).post(confirmationUrl).set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'intent-contradiction')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm', acceptedFields: ['decision_to_enable'], rejectedFields: ['decision_to_enable'] })
      .expect(400);
    await request(app).post(confirmationUrl).set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'intent-correction-contradiction')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm', correctedFields: { decision_to_enable: 'Decision corregida' }, rejectedFields: ['decision_to_enable'] })
      .expect(400);
    await request(app).post(confirmationUrl).set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'intent-accepted-correction-contradiction')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm', acceptedFields: ['decision_to_enable'], correctedFields: { decision_to_enable: 'Decision corregida' } })
      .expect(400);
    const confirmed = await request(app).post(confirmationUrl).set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'intent-confirmation')
      .send({
        expectedRevision: claimed.body.data.revision,
        action: 'confirm',
        acceptedFields: terminalReadingFields.filter((field) => !['known_context', 'decision_to_enable', 'unresolved_context', 'evidence_or_clarity_needed'].includes(field)),
        rejectedFields: ['known_context'],
        correctedFields: {
          decision_to_enable: 'Preparar una decision de prioridad',
          unresolved_context: ['Validar capacidad disponible'],
          evidence_or_clarity_needed: ['Medir capacidad del equipo'],
          recommended_approach: 'Enfoque aceptado como hipotesis',
        },
      }).expect(200);
    expect(confirmed.body.data.confirmation.acceptedFields).toEqual(terminalReadingFields.filter((field) => !['known_context', 'decision_to_enable', 'unresolved_context', 'evidence_or_clarity_needed'].includes(field)));
    expect(confirmed.body.data.confirmation.acceptedFields).not.toContain('recommended_approach');
    expect(confirmed.body.data.confirmation.correctedFields).toMatchObject({
      decision_to_enable: 'Preparar una decision de prioridad',
      unresolved_context: ['Validar capacidad disponible'],
      evidence_or_clarity_needed: ['Medir capacidad del equipo'],
      recommended_approach: 'Enfoque aceptado como hipotesis',
    });

    const identity = {
      sessionId: ready.sessionId,
      source: 'portfolio_entry' as const,
      sessionRevision: confirmed.body.data.revision,
      handoffId: confirmed.body.data.handoff.id,
      handoffVersion: confirmed.body.data.handoff.version,
      confirmationId: confirmed.body.data.confirmation.id,
      confirmationVersion: confirmed.body.data.confirmation.version,
    };
    const before = await repository.findSessionById(ready.sessionId);
    const d1 = await request(app).get(confirmedBriefPath(identity)).set('Authorization', 'Bearer user-1').expect(200);
    expect(d1.body.data.brief.confirmation).toMatchObject({
      acceptedFields: terminalReadingFields.filter((field) => !['known_context', 'decision_to_enable', 'unresolved_context', 'evidence_or_clarity_needed'].includes(field)),
      correctedFields: confirmed.body.data.confirmation.correctedFields,
      rejectedFields: ['known_context'],
    });
    expect(d1.body.data.brief).not.toHaveProperty('strategicIntentProjection');
    const after = await repository.findSessionById(ready.sessionId);
    expect(after?.confirmation).toEqual(before?.confirmation);
    expect(after?.revision).toBe(before?.revision);
  });

  it('keeps legacy confirmations without new field states unconfirmed in D1', async () => {
    const { app } = makeApp();
    const fixture = await confirmedBriefFixture(app);
    const d1 = await request(app).get(confirmedBriefPath(fixture)).set('Authorization', 'Bearer user-1').expect(200);
    const confirmation = d1.body.data.brief.confirmation;
    expect(confirmation.acceptedFields).toEqual(['understood_need']);
    expect(confirmation.acceptedFields).not.toContain('decision_to_enable');
    expect(confirmation.correctedFields).not.toHaveProperty('recommended_approach');
    expect(confirmation.rejectedFields).not.toContain('unresolved_context');
  });

  it('supports required custom CORS headers and rate limits public operations', async () => {
    const { app } = makeApp({ options: { maxCreateRequests: 1, windowMs: 60_000 } });

    const cors = await request(app)
      .options(`${base}/sessions`)
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'X-Starteria-Entry-Token,Idempotency-Key')
      .expect(204);
    expect(cors.headers['access-control-allow-headers']).toContain('X-Starteria-Entry-Token');
    expect(cors.headers['access-control-allow-headers']).toContain('Idempotency-Key');

    await request(app).post(`${base}/sessions`).send({}).expect(201);
    await request(app).post(`${base}/sessions`).send({}).expect(429);
  });
});

function makeApp(input: {
  adapter?: PortfolioEntryAgentAdapterV2;
  useDefaultAdapter?: boolean;
  repository?: InMemoryPortfolioEntrySessionRepository;
  idempotencyRepository?: PortfolioEntryIdempotencyRepository;
  options?: Parameters<typeof buildPortfolioEntryRouter>[0];
} = {}) {
  const app = express();
  const repository = input.repository ?? new InMemoryPortfolioEntrySessionRepository();
  legacyCompatibilityRepositories.set(app, repository);
  app.use(express.json());
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, Idempotency-Key, X-Starteria-Entry-Token');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(requestId);
  app.use(base, buildPortfolioEntryRouter(input.options ?? { maxCreateRequests: 100, maxSubmitRequests: 100, maxHandoffRequests: 100 }, {
    sessionRepository: repository as never,
    idempotencyRepository: input.idempotencyRepository ?? new InMemoryPortfolioEntryIdempotencyRepository(),
    agentAdapter: input.useDefaultAdapter ? undefined : input.adapter ?? new FakeAgentAdapter(),
    liveUnderstandingSynthesizer: { synthesize: async () => routerTestSynthesis() },
    authenticate: fakeAuthenticate,
    optionalAuthenticate: fakeOptionalAuthenticate,
    sessionTtlMs: 60 * 60_000,
    idempotencyTtlMs: 60 * 60_000,
  }));
  app.use(errorHandler);
  return { app, repository };
}

function routerTestSynthesis(): CriticalSituationSynthesis {
  return criticalSituationSynthesisSchema.parse({
    basis_status: 'sufficient',
    situation_model: {
      desired_change: null,
      current_situation: [],
      existing_work_or_assets: [],
      decision_to_enable: null,
      known_evidence: [],
      constraints: [],
      actors_and_authority: [],
      dependencies: [],
      uncertainties: [],
      time_pressure: [],
      existing_alternatives: [],
      material_tensions: [],
    },
    reasoning_metadata: { selected_lenses: ['priority / allocation'] },
    situation_insight: {
      statement: 'La evidencia disponible llega después del checkpoint.',
      support: ['session.user_message:router-test'],
      novelty_type: 'sequence_dependency_exposed',
      epistemic_role: 'INTERPRETATION',
      status: 'supported',
    },
    material_tensions: [],
    decision_frame: {
      status: 'not_yet_identifiable',
      decision_to_prepare: null,
      decision_authority: 'responsable del checkpoint',
      materially_distinct_paths: [],
      distinguishing_conditions: [],
      timing_or_constraints: [],
      unresolved_basis: [],
    },
    usable_now: [],
    decision_changing_unknowns: [],
    candidate_first_movement: null,
    uncertainty_statement: null,
    provenance: [{
      id: 'router-private-provenance',
      claim_ref: 'situation_insight.statement',
      origin: 'AI_INFERRED',
      review_disposition: 'UNREVIEWED',
      source_refs: ['session.user_message:router-test'],
      source_path: null,
      source_text: null,
      recorded_at: null,
    }],
  });
}

class CompleteFailsOnceRepository extends InMemoryPortfolioEntryIdempotencyRepository implements PortfolioEntryIdempotencyRepository {
  private failed = false;

  override async complete(input: Parameters<PortfolioEntryIdempotencyRepository['complete']>[0]): ReturnType<PortfolioEntryIdempotencyRepository['complete']> {
    if (!this.failed) {
      this.failed = true;
      throw new Error('simulated response snapshot interruption');
    }
    return super.complete(input);
  }
}

class ExecutionFailsRepository extends InMemoryPortfolioEntrySessionRepository {
  override async appendModelExecution(_execution: PortfolioEntryModelExecutionRecord): Promise<PortfolioEntryModelExecutionRecord> {
    throw new Error('observability store unavailable');
  }
}

async function createSession(app: express.Express): Promise<{ sessionId: string; token: string }> {
  const res = await request(app).post(`${base}/sessions`).send({}).expect(201);
  return {
    sessionId: res.body.data.session.id,
    token: res.body.data.publicAccessToken,
  };
}

async function legacyHandoffReadySession(app: express.Express): Promise<{ sessionId: string; token: string; revision: number }> {
  const created = await createSession(app);
  const submitted = await request(app)
    .post(`${base}/sessions/${created.sessionId}/messages`)
    .set('X-Starteria-Entry-Token', created.token)
    .set('Idempotency-Key', `ready-${created.sessionId}`)
    .send({ expectedRevision: 0, message: 'Queremos ordenar el portafolio de iniciativas comerciales para decidir inversion y foco del trimestre.' })
    .expect(200);
  expect(submitted.body.data.lifecycleStatus).toBe('CLARIFYING');
  expect(submitted.body.data.nextAction).toBe('offer_guided_exploration');

  const provisional = await request(app)
    .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
    .set('X-Starteria-Entry-Token', created.token)
    .set('Idempotency-Key', `ready-provisional-${created.sessionId}`)
    .send({ expectedRevision: submitted.body.data.revision, choice: 'provisional_route' })
    .expect(200);
  expect(provisional.body.data.lifecycleStatus).toBe('HANDOFF_ELIGIBLE');
  expect(provisional.body.data.nextAction).toBe('generate_handoff');

  // The tests below exercise historical KEEP_COMPAT consumers. Seed the
  // pre-119 state explicitly after preparing the shared analysis fixture.
  const repository = legacyCompatibilityRepositories.get(app);
  const prepared = await repository?.findSessionById(created.sessionId);
  if (!repository || !prepared) throw new Error('Legacy compatibility session fixture was not initialized.');
  await repository.saveSessionState({
    session: {
      ...prepared,
      semanticState: { ...prepared.semanticState, userExplorationChoice: 'not_offered' },
    },
    expectedRevision: prepared.revision,
  });

  return { ...created, revision: provisional.body.data.revision };
}

type ConfirmedBriefIdentityFixture = {
  sessionId: string;
  source: 'portfolio_entry';
  sessionRevision: number;
  handoffId: string;
  handoffVersion: number;
  confirmationId: string;
  confirmationVersion: number;
};

async function confirmedBriefFixture(app: express.Express): Promise<ConfirmedBriefIdentityFixture> {
  const ready = await legacyHandoffReadySession(app);
  const handoff = await request(app).post(`${base}/sessions/${ready.sessionId}/handoff`)
    .set('X-Starteria-Entry-Token', ready.token).set('Idempotency-Key', `d1-handoff-${ready.sessionId}`)
    .send({ expectedRevision: ready.revision }).expect(200);
  const claimed = await request(app).post(`${base}/sessions/${ready.sessionId}/claim`)
    .set('Authorization', 'Bearer user-1').set('X-Starteria-Entry-Token', ready.token)
    .set('Idempotency-Key', `d1-claim-${ready.sessionId}`).send({ expectedRevision: handoff.body.data.revision }).expect(200);
  const confirmed = await request(app).post(`${base}/sessions/${ready.sessionId}/handoff/confirmation`)
    .set('Authorization', 'Bearer user-1').set('Idempotency-Key', `d1-confirm-${ready.sessionId}`)
    .send({ expectedRevision: claimed.body.data.revision, action: 'confirm', acceptedFields: ['understood_need'] }).expect(200);
  return {
    sessionId: ready.sessionId, source: 'portfolio_entry', sessionRevision: confirmed.body.data.revision,
    handoffId: confirmed.body.data.handoff.id, handoffVersion: confirmed.body.data.handoff.version,
    confirmationId: confirmed.body.data.confirmation.id, confirmationVersion: confirmed.body.data.confirmation.version,
  };
}

function confirmedBriefPath(identity: ConfirmedBriefIdentityFixture): string {
  const { sessionId, ...queryIdentity } = identity;
  return `${base}/sessions/${sessionId}/confirmed-brief?${new URLSearchParams(
    Object.entries(queryIdentity).map(([key, value]) => [key, String(value)]),
  )}`;
}

async function offerGuidedExploration(app: express.Express): Promise<{
  sessionId: string;
  token: string;
  response: request.Response;
}> {
  const created = await createSession(app);
  const first = await request(app)
    .post(`${base}/sessions/${created.sessionId}/messages`)
    .set('X-Starteria-Entry-Token', created.token)
    .set('Idempotency-Key', `guided-seed-${created.sessionId}`)
    .send({
      expectedRevision: 0,
      message: 'Tenemos demasiadas iniciativas operativas abiertas y necesitamos decidir que priorizar.',
    })
    .expect(200);

  const questionIds = first.body.data.conversation[0].emittedQuestions.map((question: { id: string }) => question.id);
  const resolves = first.body.data.conversation[0].emittedQuestions[0].resolves;
  const response = await request(app)
    .post(`${base}/sessions/${created.sessionId}/messages`)
    .set('X-Starteria-Entry-Token', created.token)
    .set('Idempotency-Key', `guided-offer-${created.sessionId}`)
    .send({
      expectedRevision: first.body.data.revision,
      message: 'Aun necesitamos seguir aclarando criterios, restricciones y decision final antes de ordenar el portafolio.',
      matchedQuestionIds: [questionIds[0]],
      respondedResolves: resolves,
    })
    .expect(200);
  return { ...created, response };
}

const fakeAuthenticate: RequestHandler = (req, _res, next) => {
  const auth = req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Autenticacion requerida'));
    return;
  }
  const id = auth.slice('Bearer '.length);
  req.user = {
    id,
    email: `${id}@starteria.test`,
    role: 'participante',
    roles: ['participante'],
    permissions: new Set(),
  };
  next();
};

const fakeOptionalAuthenticate: RequestHandler = (req, res, next) => {
  if (!req.header('Authorization')) {
    next();
    return;
  }
  fakeAuthenticate(req, res, next);
};

class FakeAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  calls: PortfolioEntryAnalyzeTurnInputV2[] = [];
  private lastResult: ModelExecutionResult<PortfolioEntryAnalyzeTurnOutputV2> | null = null;

  getLastModelExecutionResult(): ModelExecutionResult<PortfolioEntryAnalyzeTurnOutputV2> | null {
    return this.lastResult;
  }

  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    this.calls.push(input);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const output = makeAnalysisOutput(input);
    this.lastResult = {
      provider_raw: { redacted: true },
      parsed_output: output,
      validated_output: output,
      schema_errors: [],
      execution_metadata: {
        call_id: `call-${this.calls.length}`,
        purpose: 'analysis_turn',
        provider: 'test-provider',
        requested_model: 'test-model',
        model: 'test-model',
        duration_ms: 5,
        retry_count: 0,
        seed_support: 'not_requested',
      },
    };
    return output;
  }
}

class FailingAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    const result: ModelExecutionResult<PortfolioEntryAnalyzeTurnOutputV2> = {
      provider_raw: null,
      parsed_output: null,
      validated_output: null,
      schema_errors: [],
      technical_error: 'provider timeout',
      error_type: 'TECHNICAL_ERROR',
      execution_metadata: {
        call_id: 'failed-call',
        purpose: 'analysis_turn',
        provider: 'test-provider',
        requested_model: 'test-model',
        model: 'test-model',
        duration_ms: 1000,
        retry_count: 0,
        seed_support: 'not_requested',
      },
    };
    throw new LiveModelExecutionError('provider timeout', result);
  }
}

class FailOnceAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  calls: PortfolioEntryAnalyzeTurnInputV2[] = [];
  private failed = false;

  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    this.calls.push(input);
    if (!this.failed) {
      this.failed = true;
      const result: ModelExecutionResult<PortfolioEntryAnalyzeTurnOutputV2> = {
        provider_raw: null,
        parsed_output: null,
        validated_output: null,
        schema_errors: [],
        technical_error: 'provider timeout',
        error_type: 'TECHNICAL_ERROR',
        execution_metadata: {
          call_id: 'failed-once-call',
          purpose: 'analysis_turn',
          provider: 'test-provider',
          model: 'test-model',
          duration_ms: 1000,
          retry_count: 0,
          seed_support: 'not_requested',
        },
      };
      throw new LiveModelExecutionError('provider timeout', result);
    }
    return makeAnalysisOutput(input);
  }
}

class ClarifyingThenReadyAdapter implements PortfolioEntryAgentAdapterV2 {
  calls: PortfolioEntryAnalyzeTurnInputV2[] = [];

  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    this.calls.push(input);
    if (input.sessionContext.quick_questions_asked === 0) {
      return makeClarifyingOutput(input);
    }
    return makeReadyPortfolioOutput(input);
  }
}

class GuidedExplorationAdapter implements PortfolioEntryAgentAdapterV2 {
  calls: PortfolioEntryAnalyzeTurnInputV2[] = [];

  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    this.calls.push(input);
    if (input.sessionContext.interaction_mode === 'guided_exploration') {
      return makeGuidedExplorationOutput(input);
    }
    if (input.sessionContext.quick_questions_asked === 0) {
      return makeClarifyingOutput(input);
    }
    return makeNeedsGuidedExplorationOutput(input);
  }
}

class ModelMetadataAdapter implements PortfolioEntryAgentAdapterV2 {
  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    const output = makeAnalysisOutput(input);
    const modelExecution: ModelExecutionResult<PortfolioEntryAnalyzeTurnOutputV2> = {
      provider_raw: { redacted: true },
      parsed_output: output,
      validated_output: output,
      schema_errors: [],
      execution_metadata: {
        call_id: 'metadata-call-1',
        purpose: 'analysis_turn',
        provider: 'openai_responses',
        model: 'gpt-5.6-luna',
        provider_reported_model: 'gpt-5.6-luna-2026-09-12',
        duration_ms: 12,
        retry_count: 0,
        seed_support: 'not_requested',
      },
    };
    return { ...output, modelExecution };
  }
}

function makeAnalysisOutput(input: PortfolioEntryAnalyzeTurnInputV2): PortfolioEntryAnalyzeTurnOutputV2 {
  const ready = input.rawInput.length > 40;
  return {
    analysis: {
      entry_id: input.entryId,
      analysis_version: 'test',
      primary_intent: 'portfolio_tracking',
      secondary_intents: [],
      initial_entry_state: 'initiative_first',
      current_frame: ready ? 'portfolio_first' : 'initiative_first',
      extracted_context: { summary: input.rawInput },
      ambiguities: ready ? [] : ['decision_to_enable'],
      contradictions: [],
      reverse_alignment: {
        required: true,
        subject_type: 'initiative',
        subject: input.rawInput,
        connection_state: ready ? 'partial' : 'insufficient_input',
        missing_links: ready ? [] : ['decision_to_enable'],
      },
      provenance: [{ path: 'extracted_context.summary', origin: 'EXTRACTED_FROM_USER_TEXT', review_disposition: 'UNREVIEWED' }],
      status: ready ? 'ready' : 'insufficient_input',
    },
    question_plan: ready
      ? { questions: [], question_count: 0, status: 'no_questions_required', stop_reason: 'sufficient_context' }
      : {
          question_count: 1,
          status: 'questions_required',
          questions: [{
            id: 'q1',
            question: 'Que decision necesitas habilitar?',
            question_type: 'critical_gap',
            reason_to_ask: 'Falta decision posterior.',
            resolves: ['decision_to_enable'],
            priority: 1,
            expected_answer_type: 'decision',
          }],
        },
  };
}

function makeClarifyingOutput(input: PortfolioEntryAnalyzeTurnInputV2): PortfolioEntryAnalyzeTurnOutputV2 {
  return {
    analysis: {
      entry_id: input.entryId,
      analysis_version: 'test',
      primary_intent: 'portfolio_governance',
      secondary_intents: [],
      initial_entry_state: 'portfolio_first',
      current_frame: 'portfolio_first',
      extracted_context: { summary: input.rawInput },
      ambiguities: [
        'No se especifica la decision gerencial.',
        'No se cuantifican reclamos ni retrabajo.',
        'No se indican criterios de priorizacion.',
      ],
      contradictions: [],
      reverse_alignment: {
        required: false,
        subject_type: 'unknown',
        subject: null,
        connection_state: 'not_required',
        missing_links: [],
      },
      provenance: [{ path: 'extracted_context.summary', origin: 'EXTRACTED_FROM_USER_TEXT', review_disposition: 'UNREVIEWED' }],
      status: 'pending',
    },
    question_plan: {
      question_count: 3,
      status: 'questions_required',
      questions: [
        {
          id: 'q1',
          question: 'Que decision concreta debe tomar la gerencia?',
          question_type: 'critical_gap',
          reason_to_ask: 'Falta decision posterior.',
          resolves: ['analysis.extracted_context.decision_need'],
          priority: 1,
          expected_answer_type: 'decision',
        },
        {
          id: 'q2',
          question: 'Que indicadores muestran la magnitud de reclamos y retrabajo?',
          question_type: 'critical_gap',
          reason_to_ask: 'Falta baseline o senal de magnitud.',
          resolves: ['analysis.extracted_context.baseline', 'analysis.extracted_context.metric'],
          priority: 2,
          expected_answer_type: 'evidence',
        },
        {
          id: 'q3',
          question: 'Que criterios o restricciones debe considerar la gerencia?',
          question_type: 'clarification',
          reason_to_ask: 'Faltan criterios de priorizacion.',
          resolves: ['analysis.extracted_context.constraints', 'analysis.extracted_context.goal'],
          priority: 3,
          expected_answer_type: 'text',
        },
      ],
    },
  };
}

function makeReadyPortfolioOutput(input: PortfolioEntryAnalyzeTurnInputV2): PortfolioEntryAnalyzeTurnOutputV2 {
  return {
    analysis: {
      entry_id: input.entryId,
      analysis_version: 'test',
      primary_intent: 'portfolio_governance',
      secondary_intents: [],
      initial_entry_state: 'portfolio_first',
      current_frame: 'portfolio_first',
      extracted_context: { summary: input.rawInput, decision_need: 'prioritize_operational_portfolio' },
      ambiguities: [],
      contradictions: [],
      reverse_alignment: {
        required: false,
        subject_type: 'unknown',
        subject: null,
        connection_state: 'not_required',
        missing_links: [],
      },
      provenance: [{ path: 'extracted_context.summary', origin: 'EXTRACTED_FROM_USER_TEXT', review_disposition: 'UNREVIEWED' }],
      status: 'ready',
    },
    question_plan: {
      questions: [],
      question_count: 0,
      status: 'no_questions_required',
      stop_reason: 'sufficient_context',
    },
  };
}

function makeNeedsGuidedExplorationOutput(input: PortfolioEntryAnalyzeTurnInputV2): PortfolioEntryAnalyzeTurnOutputV2 {
  return {
    analysis: {
      entry_id: input.entryId,
      analysis_version: 'test',
      primary_intent: 'portfolio_governance',
      secondary_intents: ['portfolio_prioritization'],
      initial_entry_state: 'portfolio_first',
      current_frame: 'portfolio_first',
      extracted_context: { summary: input.rawInput, decision_need: 'prioritize_operational_portfolio' },
      ambiguities: ['Persisten criterios y restricciones por aclarar.'],
      contradictions: [],
      reverse_alignment: {
        required: false,
        subject_type: 'unknown',
        subject: null,
        connection_state: 'not_required',
        missing_links: [],
      },
      provenance: [{ path: 'extracted_context.summary', origin: 'EXTRACTED_FROM_USER_TEXT', review_disposition: 'UNREVIEWED' }],
      status: 'insufficient_input',
    },
    question_plan: {
      question_count: 0,
      status: 'questions_required',
      questions: [],
    },
  };
}

function makeGuidedExplorationOutput(input: PortfolioEntryAnalyzeTurnInputV2): PortfolioEntryAnalyzeTurnOutputV2 {
  return {
    analysis: {
      entry_id: input.entryId,
      analysis_version: 'test',
      primary_intent: 'portfolio_governance',
      secondary_intents: ['portfolio_prioritization'],
      initial_entry_state: 'portfolio_first',
      current_frame: 'portfolio_first',
      extracted_context: {
        summary: input.rawInput,
        decision_need: 'prioritize_operational_portfolio',
        exploration: 'accepted',
      },
      ambiguities: ['Falta seleccionar criterio dominante.'],
      contradictions: [],
      reverse_alignment: {
        required: false,
        subject_type: 'unknown',
        subject: null,
        connection_state: 'not_required',
        missing_links: [],
      },
      provenance: [{ path: 'extracted_context.exploration', origin: 'AI_INFERRED', review_disposition: 'UNREVIEWED' }],
      status: 'insufficient_input',
    },
    question_plan: {
      question_count: 1,
      status: 'questions_required',
      questions: [{
        id: 'guided-q2',
        question: 'Que criterio quieres usar primero para ordenar las iniciativas?',
        question_type: 'guided_deepening',
        reason_to_ask: 'El usuario acepto explorar con mas detalle antes del handoff.',
        resolves: ['analysis.extracted_context.constraints'],
        priority: 1,
        expected_answer_type: 'text',
      }],
    },
  };
}
