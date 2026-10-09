import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { errorHandler } from '../../../shared/errors/error-handler';
import { requestId } from '../../../shared/middleware/request-id';
import type {
  PortfolioEntryAgentAdapterV2,
  PortfolioEntryAnalyzeTurnInputV2,
  PortfolioEntryAnalyzeTurnOutputV2,
} from '../../portfolio-entry-runtime';
import {
  criticalSituationSynthesisSchema,
  type CriticalSituationSynthesis,
} from '../../portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import type { CriticalHandoffProjection } from '../presentation/critical-handoff-projection';
import { toCriticalHandoffProjection } from '../presentation/critical-handoff-projection';
import { InMemoryPortfolioEntrySessionRepository } from '../../portfolio-entry-sessions/infrastructure/in-memory-portfolio-entry-session.repository';
import type { PortfolioEntryLiveUnderstandingSynthesisRequest, PortfolioEntryLiveUnderstandingSynthesizer } from '../application/portfolio-entry-experimental-session.service';
import { InMemoryPortfolioEntryIdempotencyRepository } from '../infrastructure/in-memory-portfolio-entry-idempotency.repository';
import { buildPortfolioEntryRouter } from '../portfolio-entry.router';

const base = '/api/v1/public/portfolio-entry';

describe('Portfolio Entry Live Understanding session integration', () => {
  it('invokes synthesis exactly once after a successful user turn', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer);

    const turn = await submitTurn(app);

    expect(turn.status).toBe(200);
    await expect(repository.readContextRevision(turn.body.data.id)).resolves.toBe(1);
    expect(synthesizer.calls).toHaveLength(1);
    expect(synthesizer.calls[0].sessionRevision).toBe(turn.body.data.revision);
    expect(synthesizer.calls[0].contextRevision).toBe(1);
    expect(synthesizer.calls[0].authorizedSnapshot.items.some((item) => item.kind === 'user_message')).toBe(true);
    expect(synthesizer.calls[0].authorizedSnapshot.provisional_extracted_context?.values)
      .toMatchObject({ decision_need: 'prioritize_before_review' });
    expect(synthesizer.calls[0].authorizedSnapshot.items.every((item) =>
      item.kind === 'user_message' || item.kind === 'provisional_extracted_context')).toBe(true);
    expect(JSON.stringify(synthesizer.calls[0].authorizedSnapshot))
      .not.toMatch(/portfolio setup|portfolio membership|external connector|hidden frontend state/i);
  });

  it('maps successful synthesis into the safe presentation model and retains the session DTO fields', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app } = makeApp(synthesizer);

    const turn = await submitTurn(app);

    expect(turn.body.data.liveUnderstanding).toEqual({
      state: 'supported_reading',
      reading: 'El checkpoint de evidencia llega después de la revisión de cartera.',
      decision: { decisionToPrepare: 'Qué iniciativas priorizar antes de la revisión.' },
      decisionChangingUnknowns: [],
    });
    expect(turn.body.data).toMatchObject({
      lifecycleStatus: expect.any(String),
      executionStatus: 'SUCCEEDED',
      revision: 2,
      conversation: [{ userInput: 'Necesitamos ordenar las iniciativas y decidir qué evidencia revisar antes del comité trimestral.' }],
      clarification: { interactionMode: expect.any(String), answeredGaps: [] },
      semanticProjection: { currentFrame: 'portfolio_first' },
      nextAction: expect.any(String),
    });
  });

  it.each([
    ['insufficient_basis', { basis_status: 'insufficient_basis' as const }],
    ['no_supported_insight', { insightStatus: 'no_supported_insight' as const }],
  ])('maps %s without fabricating a reading', async (_label, options) => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis(options));
    const { app } = makeApp(synthesizer);

    const turn = await submitTurn(app);

    expect(turn.status).toBe(200);
    expect(turn.body.data.liveUnderstanding.state).toBe(_label);
    expect(turn.body.data.liveUnderstanding).not.toHaveProperty('reading');
  });

  it('keeps the analyzed turn successful when the provider or adapter throws', async () => {
    const synthesizer = new FakeSynthesizer(async () => {
      throw new Error('provider secret: test-only failure detail');
    });
    const { app, repository } = makeApp(synthesizer);

    const turn = await submitTurn(app);
    const persisted = await repository.findSessionById(turn.body.data.id);

    expect(turn.status).toBe(200);
    expect(turn.body.data.executionStatus).toBe('SUCCEEDED');
    expect(turn.body.data.pendingInput.status).toBe('ANALYZED');
    expect(turn.body.data.liveUnderstanding).toEqual({ state: 'synthesis_unavailable', decisionChangingUnknowns: [] });
    expect(persisted?.semanticState.pendingInput?.status).toBe('ANALYZED');
    await expect(repository.readContextRevision(turn.body.data.id)).resolves.toBe(1);
    expect(JSON.stringify(turn.body)).not.toContain('test-only failure detail');
  });

  it('keeps the analyzed turn successful when schema or conformance validation rejects synthesis', async () => {
    const synthesizer = new FakeSynthesizer(async () => null);
    const { app } = makeApp(synthesizer);

    const turn = await submitTurn(app);

    expect(turn.status).toBe(200);
    expect(turn.body.data.executionStatus).toBe('SUCCEEDED');
    expect(turn.body.data.pendingInput.status).toBe('ANALYZED');
    expect(turn.body.data.liveUnderstanding).toEqual({ state: 'synthesis_unavailable', decisionChangingUnknowns: [] });
  });

  it('does not advance contextRevision or persist a turn when message analysis is rejected', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const adapter: PortfolioEntryAgentAdapterV2 = {
      analyzeTurn: async () => { throw new Error('deterministic rejected analysis'); },
    };
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const failed = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'context-revision-rejected-analysis')
      .send({ expectedRevision: 0, message: 'This input is not accepted by analysis.' })
      .expect(200);

    expect(failed.body.data.pendingInput.status).toBe('FAILED_RETRYABLE');
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(0);
    await expect(repository.listTurns(created.sessionId)).resolves.toHaveLength(0);
    expect(synthesizer.calls).toHaveLength(0);
  });

  it('does not rerun synthesis for checkpoint selection or page load', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer);
    const turn = await submitTurn(app);
    const before = await repository.readContextRevision(turn.body.data.id);

    await request(app)
      .post(`${base}/sessions/${turn.body.data.id}/guided-exploration`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'live-understanding-checkpoint')
      .send({ expectedRevision: turn.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const read = await request(app)
      .get(`${base}/sessions/${turn.body.data.id}`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);

    expect(synthesizer.calls).toHaveLength(1);
    await expect(repository.listTurns(turn.body.data.id)).resolves.toHaveLength(1);
    await expect(repository.readContextRevision(turn.body.data.id)).resolves.toBe(before);
    expect(read.body.data).not.toHaveProperty('liveUnderstanding');
  });

  it.each(['answer', 'correction'] as const)('replays an accepted %s without advancing contextRevision or synthesizing twice', async (intent) => {
    const adapter = intent === 'answer'
      ? new CorrectionTestAgentAdapter([true, false])
      : new CorrectionTestAgentAdapter([false, true]);
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await postInitialCorrectionTurn(app, created);
    const payload = {
      expectedRevision: first.body.data.revision,
      ...(intent === 'correction' ? { intent } : {}),
      message: `Idempotent ${intent} with explicit user context.`,
    };
    const firstDelivery = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', `context-revision-idempotent-${intent}`)
      .send(payload)
      .expect(200);
    const replay = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', `context-revision-idempotent-${intent}`)
      .send(payload)
      .expect(200);

    expect(replay.body.data).toEqual(firstDelivery.body.data);
    expect((await repository.listTurns(created.sessionId))).toHaveLength(2);
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(2);
    expect(synthesizer.calls).toHaveLength(2);
  });

  it('does not advance contextRevision for rejected or stale messages, authentication, or claim', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer);
    const turn = await submitTurn(app);
    const sessionId = turn.body.data.id as string;

    await request(app)
      .post(`${base}/sessions/${sessionId}/messages`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'context-revision-stale-message')
      .send({ expectedRevision: 0, message: 'Rejected stale context.' })
      .expect(409);
    const claimed = await request(app)
      .post(`${base}/sessions/${sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'context-revision-claim')
      .send({ expectedRevision: turn.body.data.revision })
      .expect(200);

    await expect(repository.readContextRevision(sessionId)).resolves.toBe(1);
    expect(claimed.body.data.revision).toBe(turn.body.data.revision + 1);
    expect(synthesizer.calls).toHaveLength(1);
  });

  it('materializes Critical Handoff through a safe current response while retaining the legacy artifact internally', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const projectionCalls: Array<{ synthesis: CriticalSituationSynthesis; projection: CriticalHandoffProjection }> = [];
    const projector = (synthesis: CriticalSituationSynthesis) => {
      const projection = toCriticalHandoffProjection(synthesis);
      projectionCalls.push({ synthesis, projection });
      return projection;
    };
    const { app, repository } = makeApp(synthesizer, new IntegrationAgentAdapter(), projector);
    const turn = await submitTurn(app);
    const sessionId = turn.body.data.id as string;
    expect((await repository.getLatestCriticalHandoff(sessionId)).artifact).toBeNull();

    const checkpoint = await request(app)
      .post(`${base}/sessions/${sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-close-exploration')
      .send({ expectedRevision: turn.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const currentMaterialization = await request(app)
      .post(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-current-materialization')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(200);
    const repeatedMaterialization = await request(app)
      .post(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-current-materialization')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(200);

    const criticalRead = await request(app)
      .get(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    const turns = await repository.listTurns(sessionId);
    expect(synthesizer.calls).toHaveLength(2);
    expect(synthesizer.calls[1]).toMatchObject({
      purpose: 'critical_handoff',
      contextRevision: 1,
      sourceTurnId: turns[0].id,
    });
    expect(synthesizer.calls[1].authorizedSnapshot).toEqual(synthesizer.calls[0].authorizedSnapshot);
    expect(projectionCalls).toHaveLength(1);
    expect(currentMaterialization.body.data).toMatchObject({
      sessionRevision: expect.any(Number),
      criticalHandoff: {
      id: expect.any(String),
      version: 1,
      sourceContextRevision: synthesizer.calls[1].contextRevision,
      state: 'current',
      confirmationState: 'provisional',
      confirmedAt: null,
      projection: projectionCalls[0].projection,
      },
    });
    const currentResponseJson = JSON.stringify(currentMaterialization.body.data);
    expect(Object.keys(currentMaterialization.body.data).sort()).toEqual(['criticalHandoff', 'sessionRevision']);
    expect(currentResponseJson).not.toMatch(/handoffPayload|provenance_summary|provenance|recommended_approach|starteria_path|recommended_cta|reasoning_metadata|selected_lenses|source_refs|sourceTurnId|provider|model|raw_synthesis|confirmedByUserId/i);
    expect(repeatedMaterialization.body.data).toEqual(currentMaterialization.body.data);
    expect(currentMaterialization.body.data.sessionRevision).toBe(checkpoint.body.data.revision + 1);
    expect(criticalRead.body.data).toMatchObject(currentMaterialization.body.data.criticalHandoff);
    expect(criticalRead.body.data).not.toHaveProperty('schemaVersion');
    expect(criticalRead.body.data).not.toHaveProperty('sourceTurnId');
    expect(criticalRead.body.data.projection).not.toHaveProperty('starteria_path');
    expect(JSON.stringify(criticalRead.body.data)).not.toMatch(/recommended_approach|recommended_cta|provenance|situation_model|reasoning_metadata|provider|model/i);
    const storedSession = await repository.findSessionById(sessionId);
    expect(storedSession?.latestHandoff?.version).toBe(1);
    expect(storedSession?.latestHandoff?.handoff).toHaveProperty('starteria_path');
    expect(storedSession?.latestHandoff?.handoff).toHaveProperty('recommended_approach');

    const legacyRead = await request(app)
      .get(`${base}/sessions/${sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    expect(legacyRead.body.data.handoff.handoff).toEqual(storedSession?.latestHandoff?.handoff);
    expect(legacyRead.body.data.handoff.handoff).toHaveProperty('starteria_path');
    expect(legacyRead.body.data.handoff.handoff).toHaveProperty('recommended_approach');
    expect(legacyRead.body.data).not.toHaveProperty('criticalHandoff');
    expect(currentMaterialization.body.data).not.toHaveProperty('handoff');
    expect(currentMaterialization.body.data).not.toHaveProperty('continuation');
    expect(currentMaterialization.body.data).not.toHaveProperty('convertedAt');
    const currentSessionRead = await request(app)
      .get(`${base}/sessions/${sessionId}`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    expect(currentSessionRead.body.data).not.toHaveProperty('handoff');
    expect(currentSessionRead.body.data).not.toHaveProperty('provisionalContinuation');
    expect(JSON.stringify(currentSessionRead.body.data)).not.toMatch(/provenance_summary|recommended_approach|starteria_path|recommended_cta|selected_lenses|reasoning_metadata|provider|model|raw_synthesis/i);

    const claim = await request(app)
      .post(`${base}/sessions/${sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-safe-claim')
      .send({ expectedRevision: currentMaterialization.body.data.sessionRevision })
      .expect(200);
    expect(claim.body.data).not.toHaveProperty('handoff');
    expect(claim.body.data).not.toHaveProperty('provisionalContinuation');
    expect(JSON.stringify(claim.body.data)).not.toMatch(/provenance_summary|recommended_approach|starteria_path|recommended_cta|selected_lenses|reasoning_metadata|provider|model|raw_synthesis/i);

    const confirmed = await request(app)
      .post(`${base}/sessions/${sessionId}/critical-handoff/${currentMaterialization.body.data.criticalHandoff.id}/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-handoff-safe-explicit-confirmation')
      .send({
        action: 'confirm',
        expectedArtifactVersion: currentMaterialization.body.data.criticalHandoff.version,
        expectedContextRevision: currentMaterialization.body.data.criticalHandoff.sourceContextRevision,
      })
      .expect(200);
    expect(confirmed.body.data).toMatchObject({
      id: currentMaterialization.body.data.criticalHandoff.id,
      confirmationState: 'confirmed',
      confirmedAt: expect.any(String),
      projection: currentMaterialization.body.data.criticalHandoff.projection,
    });
    expect(confirmed.body.data).not.toHaveProperty('confirmedByUserId');
    expect(confirmed.body.data.projection).toEqual(currentMaterialization.body.data.criticalHandoff.projection);
    expect((await repository.findSessionById(sessionId))?.lifecycleStatus).toBe('HANDOFF_READY');
    await expect(repository.readContextRevision(sessionId)).resolves.toBe(1);
  });

  it('keeps the legacy handoff POST and GET response contract for legacy consumers', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()));
    const turn = await submitTurn(app);
    const sessionId = turn.body.data.id as string;
    const initialSession = await repository.findSessionById(sessionId);
    expect(initialSession).not.toBeNull();
    await repository.saveSessionState({
      session: {
        ...initialSession!,
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        semanticState: {
          ...initialSession!.semanticState,
          runtimeClarificationStatus: 'ready_for_handoff',
          userExplorationChoice: 'not_offered',
        },
      },
      expectedRevision: initialSession!.revision,
    });
    const legacyPost = await request(app)
      .post(`${base}/sessions/${sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'legacy-handoff-post-contract')
      .send({ expectedRevision: turn.body.data.revision })
      .expect(200);
    const legacyGet = await request(app)
      .get(`${base}/sessions/${sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);

    expect(legacyPost.body.data.handoff).toMatchObject({
      id: expect.any(String),
      version: 1,
      status: expect.any(String),
      reviewDisposition: 'UNREVIEWED',
      handoff: expect.objectContaining({ recommended_approach: expect.any(Object), starteria_path: expect.any(Array) }),
      createdAt: expect.any(String),
    });
    expect(legacyGet.body.data.handoff).toEqual(legacyPost.body.data.handoff);
    expect(legacyGet.body.data.handoff.handoff).toHaveProperty('provenance_summary');
    expect((await repository.getLatestCriticalHandoff(sessionId)).artifact).toBeNull();
    const currentEndpointOnLegacyState = await request(app)
      .post(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'current-endpoint-rejects-legacy-state')
      .send({ expectedRevision: legacyPost.body.data.revision })
      .expect(409);
    expect(JSON.stringify(currentEndpointOnLegacyState.body)).not.toMatch(/recommended_approach|starteria_path|recommended_cta|provenance_summary/i);
  });

  it('keeps legacy handoff available when KAN-114 synthesis fails and creates no Critical artifact', async () => {
    let signalSynthesisStarted!: () => void;
    let releaseSynthesis!: () => void;
    const synthesisStarted = new Promise<void>((resolve) => { signalSynthesisStarted = resolve; });
    const synthesisGate = new Promise<void>((resolve) => { releaseSynthesis = resolve; });
    const synthesizer = new FakeSynthesizer(async (input) => {
      if (input.purpose === 'critical_handoff') {
        signalSynthesisStarted();
        await synthesisGate;
        throw new Error('private provider detail');
      }
      return supportedSynthesis();
    });
    const { app, repository } = makeApp(synthesizer);
    const turn = await submitTurn(app);
    const sessionId = turn.body.data.id as string;
    const checkpoint = await request(app)
      .post(`${base}/sessions/${sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-failure-checkpoint')
      .send({ expectedRevision: turn.body.data.revision, choice: 'provisional_route' })
      .expect(200);

    const materializationPromise = request(app)
      .post(`${base}/sessions/${sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-synthesis-failure')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .then((response) => response);

    await synthesisStarted;
    expect((await repository.findSessionById(sessionId))?.latestHandoff).not.toBeNull();
    expect((await repository.getLatestCriticalHandoff(sessionId)).artifact).toBeNull();
    releaseSynthesis();
    const legacy = await materializationPromise;
    expect(legacy.status).toBe(200);

    const stored = await repository.findSessionById(sessionId);
    expect(legacy.body.data.handoff.handoff).toHaveProperty('starteria_path');
    expect((await repository.getLatestCriticalHandoff(sessionId)).artifact).toBeNull();
    expect(stored?.latestHandoff).not.toBeNull();
    expect(stored?.lifecycleStatus).toBe('HANDOFF_READY');
    const criticalRead = await request(app)
      .get(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    expect(criticalRead.body.data).toBeNull();
    expect(JSON.stringify(legacy.body)).not.toContain('private provider detail');
  });

  it('returns no legacy semantics from current materialization when Critical Handoff synthesis fails', async () => {
    const synthesizer = new FakeSynthesizer(async (input) => {
      if (input.purpose === 'critical_handoff') throw new Error('private provider detail');
      return supportedSynthesis();
    });
    const { app, repository } = makeApp(synthesizer);
    const turn = await submitTurn(app);
    const sessionId = turn.body.data.id as string;
    const checkpoint = await request(app)
      .post(`${base}/sessions/${sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-current-failure-checkpoint')
      .send({ expectedRevision: turn.body.data.revision, choice: 'provisional_route' })
      .expect(200);

    const response = await request(app)
      .post(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-current-failure-materialization')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(503);

    expect(response.body.error.code).toBe('PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SYNTHESIS_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toMatch(/recommended_approach|starteria_path|recommended_cta|provenance|private provider detail/i);
    expect((await repository.findSessionById(sessionId))?.latestHandoff).not.toBeNull();
    expect((await repository.getLatestCriticalHandoff(sessionId)).artifact).toBeNull();
    await expect(repository.readContextRevision(sessionId)).resolves.toBe(1);
    const refreshed = await request(app)
      .get(`${base}/sessions/${sessionId}`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    expect(refreshed.body.data).not.toHaveProperty('handoff');
    expect(refreshed.body.data).not.toHaveProperty('provisionalContinuation');
    expect(JSON.stringify(refreshed.body.data)).not.toMatch(/provenance_summary|recommended_approach|starteria_path|recommended_cta|private provider detail/i);
    const absentCriticalRead = await request(app)
      .get(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    expect(absentCriticalRead.body.data).toBeNull();
  });

  it('keeps legacy handoff available when Critical Handoff synthesis is malformed', async () => {
    const synthesizer = new FakeSynthesizer(async (input) => {
      if (input.purpose === 'critical_handoff') return { basis_status: 'malformed' } as unknown as CriticalSituationSynthesis;
      return supportedSynthesis();
    });
    const { app, repository } = makeApp(synthesizer);
    const turn = await submitTurn(app);
    const sessionId = turn.body.data.id as string;
    const checkpoint = await request(app)
      .post(`${base}/sessions/${sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-malformed-checkpoint')
      .send({ expectedRevision: turn.body.data.revision, choice: 'provisional_route' })
      .expect(200);

    const legacy = await request(app)
      .post(`${base}/sessions/${sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-malformed-materialization')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(200);

    expect(legacy.body.data.handoff.handoff).toHaveProperty('starteria_path');
    expect((await repository.findSessionById(sessionId))?.latestHandoff).not.toBeNull();
    expect((await repository.getLatestCriticalHandoff(sessionId)).artifact).toBeNull();
    const criticalRead = await request(app)
      .get(`${base}/sessions/${sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    expect(criticalRead.body.data).toBeNull();
  });

  it('rejects artifact persistence when contextRevision changes during KAN-114 synthesis', async () => {
    let signalMaterializationStarted!: () => void;
    let releaseMaterialization!: (value: CriticalSituationSynthesis | null) => void;
    const materializationStarted = new Promise<void>((resolve) => { signalMaterializationStarted = resolve; });
    const materializationResult = new Promise<CriticalSituationSynthesis | null>((resolve) => { releaseMaterialization = resolve; });
    const synthesizer = new FakeSynthesizer(async (input) => {
      if (input.purpose === 'critical_handoff') {
        signalMaterializationStarted();
        return materializationResult;
      }
      return supportedSynthesis();
    });
    const adapter = new CorrectionTestAgentAdapter([false, false]);
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await postInitialCorrectionTurn(app, created);
    const checkpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-race-checkpoint')
      .send({ expectedRevision: first.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const materializationPromise = request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-race-materialization')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .then((response) => response);

    await materializationStarted;
    await repository.advanceContextRevision(created.sessionId, 1, new Date());
    releaseMaterialization(supportedSynthesis());
    const materialization = await materializationPromise;

    expect(materialization.status).toBe(200);
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(2);
    expect((await repository.getLatestCriticalHandoff(created.sessionId)).artifact).toBeNull();
    expect((await repository.findSessionById(created.sessionId))?.latestHandoff).not.toBeNull();
  });

  it('stales but retains the prior artifact after a correction, and does not regenerate until close exploration is selected again', async () => {
    const adapter = new CorrectionTestAgentAdapter([false, false]);
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await postInitialCorrectionTurn(app, created);
    const checkpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-correction-checkpoint')
      .send({ expectedRevision: first.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const handoff = await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-correction-materialize')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(200);
    const original = await request(app)
      .get(`${base}/sessions/${created.sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200);

    const corrected = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-correction-message')
      .send({ expectedRevision: handoff.body.data.revision, intent: 'correction', message: 'The prior provisional reading missed capacity limits.' })
      .expect(200);

    const staleRead = await request(app)
      .get(`${base}/sessions/${created.sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200);
    expect(corrected.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect(corrected.body.data.nextAction).toBe('offer_guided_exploration');
    expect(corrected.body.data.liveUnderstanding.state).toBe('supported_reading');
    expect(staleRead.body.data).toMatchObject({ id: original.body.data.id, state: 'stale', sourceContextRevision: 1 });
    expect(staleRead.body.data.projection).toEqual(original.body.data.projection);
    expect((await repository.getLatestCriticalHandoff(created.sessionId)).artifact?.id).toBe(original.body.data.id);
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(2);
    expect(synthesizer.calls.filter((call) => call.purpose === 'critical_handoff')).toHaveLength(1);
  });

  it('stales on correction and answer, then binds regeneration to the latest analyzed turn', async () => {
    const adapter = new CorrectionTestAgentAdapter([false, true, false]);
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const initial = await postInitialCorrectionTurn(app, created);
    const checkpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-answer-invalidation-checkpoint')
      .send({ expectedRevision: initial.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const firstMaterialization = await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-answer-invalidation-first')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(200);
    const firstArtifact = (await repository.getLatestCriticalHandoff(created.sessionId)).artifact;

    const corrected = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-answer-invalidation-correction')
      .send({ expectedRevision: firstMaterialization.body.data.revision, intent: 'correction', message: 'The conclusion must account for regulatory capacity.' })
      .expect(200);
    expect(corrected.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect((await request(app)
      .get(`${base}/sessions/${created.sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200)).body.data.state).toBe('stale');
    expect(synthesizer.calls.filter((call) => call.purpose === 'critical_handoff')).toHaveLength(1);

    const correctionTurn = (await repository.listTurns(created.sessionId)).at(-1)!;
    const activeQuestion = correctionTurn.emittedQuestions[0];
    const answered = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-answer-invalidation-answer')
      .send({
        expectedRevision: corrected.body.data.revision,
        message: 'La gerencia revisará la capacidad antes de priorizar.',
        matchedQuestionIds: [activeQuestion.id],
        respondedResolves: activeQuestion.resolves,
      })
      .expect(200);
    const answerTurn = (await repository.listTurns(created.sessionId)).at(-1)!;
    expect(answerTurn.inputIntent).toBe('answer');
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(3);
    const staleAfterAnswer = await request(app)
      .get(`${base}/sessions/${created.sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200);
    expect(staleAfterAnswer.body.data).toMatchObject({ id: firstArtifact?.id, state: 'stale', sourceContextRevision: 1 });

    const answerCheckpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-answer-invalidation-close')
      .send({ expectedRevision: answered.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const regenerated = await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-handoff-answer-invalidation-second')
      .send({ expectedRevision: answerCheckpoint.body.data.revision })
      .expect(200);

    const latest = (await repository.getLatestCriticalHandoff(created.sessionId)).artifact;
    expect(latest).toMatchObject({ artifactVersion: 2, sourceContextRevision: 3, sourceTurnId: answerTurn.id });
    expect(latest?.id).not.toBe(firstArtifact?.id);
    expect(synthesizer.calls.filter((call) => call.purpose === 'critical_handoff')).toHaveLength(2);
    expect(synthesizer.calls.at(-1)).toMatchObject({
      purpose: 'critical_handoff',
      contextRevision: 3,
      sourceTurnId: answerTurn.id,
    });
    expect(regenerated.body.data.lifecycleStatus).toBe('HANDOFF_READY');
  });

  it('keeps legacy field edits isolated from the immutable Critical Handoff payload', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer);
    const turn = await submitTurn(app);
    const sessionId = turn.body.data.id as string;
    const checkpoint = await request(app)
      .post(`${base}/sessions/${sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-legacy-edit-checkpoint')
      .send({ expectedRevision: turn.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const legacy = await request(app)
      .post(`${base}/sessions/${sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-legacy-edit-materialize')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(200);
    const criticalBefore = (await repository.getLatestCriticalHandoff(sessionId)).artifact;
    const claimed = await request(app)
      .post(`${base}/sessions/${sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', turn.token)
      .set('Idempotency-Key', 'critical-handoff-legacy-edit-claim')
      .send({ expectedRevision: legacy.body.data.revision })
      .expect(200);
    const criticalConfirmation = await request(app)
      .post(`${base}/sessions/${sessionId}/critical-handoff/${criticalBefore!.id}/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-handoff-legacy-edit-confirm-artifact')
      .send({
        action: 'confirm',
        expectedArtifactVersion: criticalBefore!.artifactVersion,
        expectedContextRevision: criticalBefore!.sourceContextRevision,
      })
      .expect(200);
    const confirmedCriticalBefore = (await repository.getLatestCriticalHandoff(sessionId)).artifact;
    const legacyCorrection = await request(app)
      .post(`${base}/sessions/${sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-handoff-legacy-field-edit')
      .send({
        expectedRevision: claimed.body.data.revision,
        action: 'correct',
        correctedFields: { understood_need: 'Legacy-only corrected text.' },
      })
      .expect(200);
    await request(app)
      .post(`${base}/sessions/${sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-handoff-legacy-confirmation')
      .send({
        expectedRevision: legacyCorrection.body.data.revision,
        action: 'confirm',
        acceptedFields: ['understood_need'],
      })
      .expect(200);

    const criticalAfter = (await repository.getLatestCriticalHandoff(sessionId)).artifact;
    expect(criticalAfter?.id).toBe(confirmedCriticalBefore?.id);
    expect(criticalAfter?.payload).toEqual(confirmedCriticalBefore?.payload);
    expect(criticalAfter?.confirmationState).toBe('confirmed');
    expect(criticalAfter?.confirmedAt).toEqual(new Date(criticalConfirmation.body.data.confirmedAt));
    expect(criticalAfter?.confirmedByUserId).toBe('user-1');
  });

  it('confirms only the current Critical Handoff and binds the state change without touching its projection or legacy confirmation', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()));
    const fixture = await createCriticalHandoffReview(app);
    const claimed = await claimCriticalHandoffReview(app, fixture);
    const before = (await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact!;

    expect(before.confirmationState).toBe('provisional');
    expect(claimed.body.data.revision).toBe(fixture.sessionRevision + 1);

    const confirmed = await request(app)
      .post(`${base}/sessions/${fixture.sessionId}/critical-handoff/${fixture.artifact.id}/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-confirm-current')
      .send({
        action: 'confirm',
        expectedArtifactVersion: fixture.artifact.version,
        expectedContextRevision: fixture.artifact.sourceContextRevision,
      })
      .expect(200);

    const after = (await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact!;
    const session = await repository.findSessionById(fixture.sessionId);
    expect(confirmed.body.data).toMatchObject({
      id: before.id,
      version: before.artifactVersion,
      sourceContextRevision: before.sourceContextRevision,
      state: 'current',
      confirmationState: 'confirmed',
      confirmedAt: expect.any(String),
      projection: before.payload,
    });
    expect(after).toMatchObject({
      id: before.id,
      artifactVersion: before.artifactVersion,
      sessionId: fixture.sessionId,
      sourceContextRevision: fixture.artifact.sourceContextRevision,
      confirmationState: 'confirmed',
      confirmedAt: new Date(confirmed.body.data.confirmedAt),
      confirmedByUserId: 'user-1',
      payload: before.payload,
    });
    expect(session).toMatchObject({ ownerUserId: 'user-1', contextRevision: before.sourceContextRevision });
    expect(session?.confirmation).toBeNull();
    expect(session?.lifecycleStatus).toBe('HANDOFF_READY');
    expect(confirmed.body.data).not.toHaveProperty('acceptedFields');
    expect(confirmed.body.data).not.toHaveProperty('correctedFields');
    expect(confirmed.body.data).not.toHaveProperty('rejectedFields');
    expect(confirmed.body.data).not.toHaveProperty('confirmedByUserId');
    expect(confirmed.body.data).not.toHaveProperty('destinationRoute');
    expect(JSON.stringify(confirmed.body)).not.toMatch(/provenance|reasoning_metadata|provider|model|sourceTurnId|starteriaPath/i);
  });

  it('rejects a Critical Handoff after its source context revision changes and leaves it provisional', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()), new CorrectionTestAgentAdapter([false, false]));
    const created = await createCorrectionSession(app);
    const initial = await postInitialCorrectionTurn(app, created);
    const checkpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-stale-checkpoint')
      .send({ expectedRevision: initial.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const handoff = await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-stale-materialize')
      .send({ expectedRevision: checkpoint.body.data.revision })
      .expect(200);
    const artifact = (await request(app)
      .get(`${base}/sessions/${created.sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200)).body.data;
    const corrected = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-stale-context-change')
      .send({ expectedRevision: handoff.body.data.revision, intent: 'correction', message: 'La capacidad del equipo limita el calendario.' })
      .expect(200);
    const claimed = await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-stale-claim')
      .send({ expectedRevision: corrected.body.data.revision })
      .expect(200);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/critical-handoff/${artifact.id}/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-confirm-stale-attempt')
      .send({ action: 'confirm', expectedArtifactVersion: artifact.version, expectedContextRevision: artifact.sourceContextRevision })
      .expect(409);

    expect(claimed.body.data.revision).toBe(corrected.body.data.revision + 1);
    expect((await repository.getLatestCriticalHandoff(created.sessionId)).artifact).toMatchObject({
      id: artifact.id,
      confirmationState: 'provisional',
      payload: artifact.projection,
    });
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(artifact.sourceContextRevision + 1);
  });

  it('rejects an older artifact version after a newer Critical Handoff has become latest', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()), new CorrectionTestAgentAdapter([false, false]));
    const created = await createCorrectionSession(app);
    const initial = await postInitialCorrectionTurn(app, created);
    const firstCheckpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-older-checkpoint-1')
      .send({ expectedRevision: initial.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    const firstHandoff = await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-older-materialize-1')
      .send({ expectedRevision: firstCheckpoint.body.data.revision })
      .expect(200);
    const firstArtifact = (await request(app)
      .get(`${base}/sessions/${created.sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200)).body.data;
    const corrected = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-older-context-change')
      .send({ expectedRevision: firstHandoff.body.data.revision, intent: 'correction', message: 'La dependencia externa cambia la secuencia.' })
      .expect(200);
    const secondCheckpoint = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-older-checkpoint-2')
      .send({ expectedRevision: corrected.body.data.revision, choice: 'provisional_route' })
      .expect(200);
    await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-older-materialize-2')
      .send({ expectedRevision: secondCheckpoint.body.data.revision })
      .expect(200);
    const latest = (await request(app)
      .get(`${base}/sessions/${created.sessionId}/critical-handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .expect(200)).body.data;
    const session = await repository.findSessionById(created.sessionId);
    const claimed = await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'critical-confirm-older-claim')
      .send({ expectedRevision: session!.revision })
      .expect(200);

    expect(latest.version).toBe(firstArtifact.version + 1);
    await request(app)
      .post(`${base}/sessions/${created.sessionId}/critical-handoff/${firstArtifact.id}/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-confirm-older-attempt')
      .send({ action: 'confirm', expectedArtifactVersion: firstArtifact.version, expectedContextRevision: firstArtifact.sourceContextRevision })
      .expect(409);
    expect(claimed.body.data.ownership.state).toBe('CLAIMED');
    expect((await repository.getLatestCriticalHandoff(created.sessionId)).artifact).toMatchObject({
      id: latest.id,
      artifactVersion: latest.version,
      confirmationState: 'provisional',
    });
  });

  it('requires the claimed owner and rejects semantic fields on the dedicated confirmation API', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()));
    const fixture = await createCriticalHandoffReview(app);
    const path = `${base}/sessions/${fixture.sessionId}/critical-handoff/${fixture.artifact.id}/confirmation`;
    const body = { action: 'confirm', expectedArtifactVersion: fixture.artifact.version, expectedContextRevision: fixture.artifact.sourceContextRevision };

    await request(app).post(path).set('Idempotency-Key', 'critical-confirm-no-auth').send(body).expect(401);
    await request(app).post(path).set('Authorization', 'Bearer user-1').set('X-Starteria-Entry-Token', fixture.token)
      .set('Idempotency-Key', 'critical-confirm-unclaimed').send(body).expect(403);
    const afterClaim = await claimCriticalHandoffReview(app, fixture);
    expect(afterClaim.body.data.ownership.state).toBe('CLAIMED');
    expect((await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact?.confirmationState).toBe('provisional');

    await request(app).post(path).set('Authorization', 'Bearer user-2').set('Idempotency-Key', 'critical-confirm-wrong-owner')
      .send(body).expect(403);
    expect((await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact?.confirmationState).toBe('provisional');

    await request(app).post(path).set('Authorization', 'Bearer user-1').set('Idempotency-Key', 'critical-confirm-with-legacy-fields')
      .send({ ...body, acceptedFields: ['final_reading'] }).expect(400);
    await request(app).post(path).set('Authorization', 'Bearer user-1').set('Idempotency-Key', 'critical-confirm-with-forged-evidence')
      .send({ ...body, confirmedAt: new Date().toISOString(), confirmedByUserId: 'user-1' }).expect(400);
    expect((await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact?.confirmationState).toBe('provisional');
  });

  it('makes same-artifact confirmation replay idempotent and prevents a second version from being confirmed', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()));
    const fixture = await createCriticalHandoffReview(app);
    await claimCriticalHandoffReview(app, fixture);
    const path = `${base}/sessions/${fixture.sessionId}/critical-handoff/${fixture.artifact.id}/confirmation`;
    const body = { action: 'confirm', expectedArtifactVersion: fixture.artifact.version, expectedContextRevision: fixture.artifact.sourceContextRevision };
    const first = await request(app).post(path).set('Authorization', 'Bearer user-1').set('Idempotency-Key', 'critical-confirm-replay')
      .send(body).expect(200);
    const replay = await request(app).post(path).set('Authorization', 'Bearer user-1').set('Idempotency-Key', 'critical-confirm-replay')
      .send(body).expect(200);
    const anotherDelivery = await request(app).post(path).set('Authorization', 'Bearer user-1').set('Idempotency-Key', 'critical-confirm-already-done')
      .send(body).expect(200);

    expect(replay.body).toEqual(first.body);
    expect(anotherDelivery.body.data).toMatchObject({ id: fixture.artifact.id, version: fixture.artifact.version, confirmationState: 'confirmed' });
    expect(anotherDelivery.body.data.confirmedAt).toBe(first.body.data.confirmedAt);
    expect((await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact).toMatchObject({
      id: fixture.artifact.id,
      artifactVersion: fixture.artifact.version,
      confirmationState: 'confirmed',
    });
    expect((await repository.findSessionById(fixture.sessionId))?.confirmation).toBeNull();
  });

  it('serializes concurrent confirmations so both deliveries resolve to the same current artifact', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()));
    const fixture = await createCriticalHandoffReview(app);
    await claimCriticalHandoffReview(app, fixture);
    const path = `${base}/sessions/${fixture.sessionId}/critical-handoff/${fixture.artifact.id}/confirmation`;
    const body = { action: 'confirm', expectedArtifactVersion: fixture.artifact.version, expectedContextRevision: fixture.artifact.sourceContextRevision };

    const [first, second] = await Promise.all([
      request(app).post(path).set('Authorization', 'Bearer user-1').set('Idempotency-Key', 'critical-confirm-concurrent-1').send(body),
      request(app).post(path).set('Authorization', 'Bearer user-1').set('Idempotency-Key', 'critical-confirm-concurrent-2').send(body),
    ]);
    const stored = (await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact;

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.data).toMatchObject({ id: fixture.artifact.id, version: fixture.artifact.version, confirmationState: 'confirmed' });
    expect(second.body.data).toMatchObject({ id: fixture.artifact.id, version: fixture.artifact.version, confirmationState: 'confirmed' });
    expect(first.body.data.projection).toEqual(fixture.artifact.projection);
    expect(second.body.data.projection).toEqual(fixture.artifact.projection);
    expect(second.body.data.confirmedAt).toBe(first.body.data.confirmedAt);
    expect(stored).toMatchObject({ id: fixture.artifact.id, artifactVersion: fixture.artifact.version, confirmationState: 'confirmed' });
    expect((await repository.findSessionById(fixture.sessionId))?.confirmation).toBeNull();
  });

  it('does not reopen a confirmed Critical Handoff when a correction is submitted', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()));
    const fixture = await createCriticalHandoffReview(app);
    await claimCriticalHandoffReview(app, fixture);
    await request(app)
      .post(`${base}/sessions/${fixture.sessionId}/critical-handoff/${fixture.artifact.id}/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-confirm-before-correction')
      .send({ action: 'confirm', expectedArtifactVersion: fixture.artifact.version, expectedContextRevision: fixture.artifact.sourceContextRevision })
      .expect(200);
    const session = await repository.findSessionById(fixture.sessionId);

    await request(app)
      .post(`${base}/sessions/${fixture.sessionId}/messages`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-correction-after-confirm')
      .send({ expectedRevision: session!.revision, intent: 'correction', message: 'Quiero cambiar esta lectura confirmada.' })
      .expect(409);

    expect((await repository.findSessionById(fixture.sessionId))?.revision).toBe(session!.revision);
    expect((await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact).toMatchObject({
      id: fixture.artifact.id,
      confirmationState: 'confirmed',
      payload: fixture.artifact.projection,
    });
  });

  it('allows later answer context to advance and leaves confirmation evidence historical', async () => {
    const { app, repository } = makeApp(new FakeSynthesizer(() => supportedSynthesis()));
    const fixture = await createCriticalHandoffReview(app);
    await claimCriticalHandoffReview(app, fixture);
    await request(app)
      .post(`${base}/sessions/${fixture.sessionId}/critical-handoff/${fixture.artifact.id}/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-confirm-before-later-answer')
      .send({ action: 'confirm', expectedArtifactVersion: fixture.artifact.version, expectedContextRevision: fixture.artifact.sourceContextRevision })
      .expect(200);
    const before = (await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact!;
    const session = await repository.findSessionById(fixture.sessionId);

    const answer = await request(app)
      .post(`${base}/sessions/${fixture.sessionId}/messages`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'critical-confirm-later-answer')
      .send({ expectedRevision: session!.revision, intent: 'answer', message: 'Una señal nueva estará disponible después del comité.' })
      .expect(200);

    const after = (await repository.getLatestCriticalHandoff(fixture.sessionId)).artifact!;
    expect(answer.body.data.id).toBe(fixture.sessionId);
    expect((await repository.findSessionById(fixture.sessionId))?.contextRevision).toBe(before.sourceContextRevision + 1);
    expect(after).toMatchObject({
      id: before.id,
      confirmationState: 'confirmed',
      confirmedAt: before.confirmedAt,
      confirmedByUserId: before.confirmedByUserId,
      sourceContextRevision: before.sourceContextRevision,
      artifactVersion: before.artifactVersion,
      payload: before.payload,
    });
    const staleSnapshot = await repository.getLatestCriticalHandoff(fixture.sessionId);
    expect(staleSnapshot.currentContextRevision).not.toBe(staleSnapshot.artifact?.sourceContextRevision);
  });

  it('never serializes KAN-114 internal fields or metadata in the client DTO', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app } = makeApp(synthesizer);

    const turn = await submitTurn(app);
    const serialized = JSON.stringify(turn.body.data);

    for (const internalValue of [
      'selected_lenses',
      'private candidate first movement',
      'private provenance id',
      'private source ref',
      'private provider metadata',
      'reasoning_metadata',
      'situation_model',
      'candidate_first_movement',
    ]) {
      expect(serialized).not.toContain(internalValue);
    }
  });

  it('keeps Live Understanding ephemeral to the message response', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer);
    const turn = await submitTurn(app);

    const read = await request(app)
      .get(`${base}/sessions/${turn.body.data.id}`)
      .set('X-Starteria-Entry-Token', turn.token)
      .expect(200);
    const stored = await repository.findSessionById(turn.body.data.id);

    expect(turn.body.data.liveUnderstanding.state).toBe('supported_reading');
    expect(read.body.data).not.toHaveProperty('liveUnderstanding');
    expect(JSON.stringify(stored)).not.toContain('liveUnderstanding');
  });

  it('suppresses a synthesis result when a newer session revision exists before it returns', async () => {
    let signalFirstSynthesisStarted!: () => void;
    let releaseFirstSynthesis!: (value: CriticalSituationSynthesis | null) => void;
    const firstSynthesisStarted = new Promise<void>((resolve) => { signalFirstSynthesisStarted = resolve; });
    const firstSynthesisResult = new Promise<CriticalSituationSynthesis | null>((resolve) => { releaseFirstSynthesis = resolve; });
    const synthesizer = new FakeSynthesizer(async () => {
      if (synthesizer.calls.length === 1) {
        signalFirstSynthesisStarted();
        return firstSynthesisResult;
      }
      return supportedSynthesis();
    });
    const { app, repository } = makeApp(synthesizer, new IntegrationAgentAdapter(true));
    const created = await request(app).post(`${base}/sessions`).send({}).expect(201);
    const sessionId = created.body.data.session.id as string;
    const token = created.body.data.publicAccessToken as string;
    const firstRequest = request(app)
      .post(`${base}/sessions/${sessionId}/messages`)
      .set('X-Starteria-Entry-Token', token)
      .set('Idempotency-Key', 'live-understanding-stale-first')
      .send({ expectedRevision: 0, message: 'Necesitamos ordenar las iniciativas y preparar evidencia antes del comité trimestral.' });
    const firstResponsePromise = firstRequest.then((response) => response);

    await firstSynthesisStarted;
    const persisted = await repository.findSessionById(sessionId);
    expect(persisted?.revision).toBe(2);
    const firstTurn = (await repository.listTurns(sessionId))[0];
    const question = firstTurn.emittedQuestions[0];
    const second = await request(app)
      .post(`${base}/sessions/${sessionId}/messages`)
      .set('X-Starteria-Entry-Token', token)
      .set('Idempotency-Key', 'live-understanding-stale-second-message')
      .send({
        expectedRevision: 2,
        message: 'La gerencia decidirá la prioridad usando evidencia disponible antes del comité trimestral.',
        matchedQuestionIds: [question.id],
        respondedResolves: question.resolves,
      })
      .expect(200);
    releaseFirstSynthesis(supportedSynthesis());
    const first = await firstResponsePromise;

    expect(second.body.data.revision).toBe(4);
    expect(second.body.data.liveUnderstanding.state).toBe('supported_reading');
    expect(first.status).toBe(200);
    expect(first.body.data.liveUnderstanding).toEqual({ state: 'synthesis_unavailable', decisionChangingUnknowns: [] });
    expect(synthesizer.calls).toHaveLength(2);
  });
});

type SynthesisInput = PortfolioEntryLiveUnderstandingSynthesisRequest;

describe('Portfolio Entry Live Understanding correction loop', () => {
  it('reopens exploration_offered, appends the correction, then analyzes and synthesizes exactly once', async () => {
    const adapter = new CorrectionTestAgentAdapter([false, true]);
    let repositoryForSynthesis: InMemoryPortfolioEntrySessionRepository | undefined;
    let sessionIdForSynthesis = '';
    let persistedTurnsAtCorrectionSynthesis = 0;
    const synthesizer = new FakeSynthesizer(async (input) => {
      if (input.turnIndex === 2) {
        persistedTurnsAtCorrectionSynthesis = (await repositoryForSynthesis!.listTurns(sessionIdForSynthesis)).length;
      }
      return supportedSynthesis();
    });
    const { app, repository } = makeApp(synthesizer, adapter);
    repositoryForSynthesis = repository;
    const created = await createCorrectionSession(app);
    sessionIdForSynthesis = created.sessionId;
    const first = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-checkpoint-initial')
      .send({ expectedRevision: 0, message: 'La cartera necesita ordenar trabajo antes del comite.' })
      .expect(200);
    expect(first.body.data.clarification.checkpoint).toBe('quick');

    const correctionText = 'La prioridad no es ordenar toda la cartera; quise decir que debemos proteger capacidad para el trabajo regulatorio.';
    const corrected = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-checkpoint-reopen')
      .send({ expectedRevision: first.body.data.revision, intent: 'correction', message: correctionText })
      .expect(200);

    const turns = await repository.listTurns(created.sessionId);
    expect(turns.map((turn) => turn.userInput)).toEqual([
      'La cartera necesita ordenar trabajo antes del comite.',
      correctionText,
    ]);
    expect(turns[1].inputIntent).toBe('correction');
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[1].rawInput).toBe(correctionText);
    expect(adapter.calls[1].sessionContext.clarification_status).toBe('in_progress');
    expect(adapter.calls[1].priorAnalysis?.extracted_context.summary)
      .toBe('La cartera necesita ordenar trabajo antes del comite.');
    expect(corrected.body.data.lifecycleStatus).toBe('CLARIFYING');
    expect(corrected.body.data.nextAction).toBe('answer_clarification');
    expect(corrected.body.data.conversation).toHaveLength(2);
    expect(JSON.stringify(corrected.body.data)).not.toContain('inputIntent');
    expect(synthesizer.calls).toHaveLength(2);
    expect(persistedTurnsAtCorrectionSynthesis).toBe(2);
    expect(synthesizer.calls[1].sessionRevision).toBe(corrected.body.data.revision);
    expect(synthesizer.calls[1].authorizedSnapshot.items.map((item) => item.kind)).toEqual([
      'user_message',
      'user_correction',
      'provisional_extracted_context',
      'provisional_extracted_context',
    ]);
    expect(synthesizer.calls[1].authorizedSnapshot.items[1]).toMatchObject({
      kind: 'user_correction',
      content: correctionText,
      corrects_ref: null,
    });

    const clarificationQuestion = corrected.body.data.conversation[1].emittedQuestions[0];
    const followUp = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-checkpoint-follow-up')
      .send({
        expectedRevision: corrected.body.data.revision,
        message: 'La gerencia debe priorizar capacidad regulatoria antes de ampliar otros trabajos.',
        matchedQuestionIds: [clarificationQuestion.id],
      })
      .expect(200);
    expect(followUp.body.data.conversation).toHaveLength(3);
    expect(synthesizer.calls).toHaveLength(3);
    expect(synthesizer.calls[2].authorizedSnapshot.items.slice(0, 3).map((item) => item.kind)).toEqual([
      'user_message',
      'user_correction',
      'user_message',
    ]);
    expect(synthesizer.calls[2].authorizedSnapshot.items.slice(0, 3).map((item) => item.content)).toEqual([
      'La cartera necesita ordenar trabajo antes del comite.',
      correctionText,
      'La gerencia debe priorizar capacidad regulatoria antes de ampliar otros trabajos.',
    ]);
  });

  it('rejects a normal answer at the checkpoint without creating pending input', async () => {
    const adapter = new CorrectionTestAgentAdapter([false]);
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await postInitialCorrectionTurn(app, created);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'normal-answer-at-checkpoint')
      .send({ expectedRevision: first.body.data.revision, message: 'Texto sin una accion de checkpoint.' })
      .expect(409);

    const stored = await repository.findSessionById(created.sessionId);
    expect(stored?.semanticState.pendingInput?.status).toBe('ANALYZED');
    expect((await repository.listTurns(created.sessionId))).toHaveLength(1);
    expect(adapter.calls).toHaveLength(1);
    expect(synthesizer.calls).toHaveLength(1);
  });

  it('keeps an unmatched correction from answering or clearing the active question', async () => {
    const adapter = new CorrectionTestAgentAdapter([true, true]);
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-active-initial')
      .send({ expectedRevision: 0, message: 'Tenemos iniciativas y hace falta aclarar la decision.' })
      .expect(200);
    const correction = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-active-unmatched')
      .send({ expectedRevision: first.body.data.revision, intent: 'correction', message: 'La decision descrita no refleja lo que quise decir.' })
      .expect(200);

    const turns = await repository.listTurns(created.sessionId);
    expect(turns[0].emittedQuestions).toHaveLength(1);
    expect(turns[1].matchedQuestionIds).toEqual([]);
    expect(turns[1].respondedResolves).toEqual([]);
    expect(correction.body.data.clarification.answeredGaps).toEqual([]);
    expect(adapter.calls).toHaveLength(2);
    expect(synthesizer.calls).toHaveLength(2);
  });

  it('accepts and persists a correction when synthesis fails', async () => {
    const adapter = new CorrectionTestAgentAdapter([false, true]);
    const synthesizer = new FakeSynthesizer(async () => {
      if (synthesizer.calls.length === 2) throw new Error('test synthesis unavailable');
      return supportedSynthesis();
    });
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await postInitialCorrectionTurn(app, created);
    const corrected = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-synthesis-failure')
      .send({ expectedRevision: first.body.data.revision, intent: 'correction', message: 'Corrijo mi contexto para precisar el objetivo.' })
      .expect(200);

    const stored = await repository.findSessionById(created.sessionId);
    expect(corrected.body.data.pendingInput.status).toBe('ANALYZED');
    expect(corrected.body.data.liveUnderstanding).toEqual({ state: 'synthesis_unavailable', decisionChangingUnknowns: [] });
    expect(stored?.executionStatus).toBe('SUCCEEDED');
    expect((await repository.listTurns(created.sessionId))).toHaveLength(2);
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(2);
    expect(adapter.calls).toHaveLength(2);
    expect(synthesizer.calls).toHaveLength(2);
  });

  it('replays an idempotent correction without duplicating history, analysis, or synthesis', async () => {
    const adapter = new CorrectionTestAgentAdapter([false, true]);
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await postInitialCorrectionTurn(app, created);
    const payload = { expectedRevision: first.body.data.revision, intent: 'correction', message: 'Corrijo lo anterior: debemos comparar capacidad y urgencia.' };
    const firstDelivery = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-idempotent-replay')
      .send(payload)
      .expect(200);
    const replay = await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-idempotent-replay')
      .send(payload)
      .expect(200);

    expect(replay.body.data).toEqual(firstDelivery.body.data);
    expect((await repository.listTurns(created.sessionId))).toHaveLength(2);
    expect(adapter.calls).toHaveLength(2);
    expect(synthesizer.calls).toHaveLength(2);
  });

  it('rejects a second correction while analysis is pending', async () => {
    let signalCorrectionStarted!: () => void;
    let releaseCorrection!: () => void;
    const correctionStarted = new Promise<void>((resolve) => { signalCorrectionStarted = resolve; });
    const correctionRelease = new Promise<void>((resolve) => { releaseCorrection = resolve; });
    const adapter = new CorrectionTestAgentAdapter([false, true], async (callNumber) => {
      if (callNumber === 2) {
        signalCorrectionStarted();
        await correctionRelease;
      }
    });
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app, repository } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const first = await postInitialCorrectionTurn(app, created);
    const firstCorrectionPromise = request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-pending-first')
      .send({ expectedRevision: first.body.data.revision, intent: 'correction', message: 'La lectura debe considerar capacidad regulatoria.' })
      .then((response) => response);

    await correctionStarted;
    const pending = await repository.findSessionById(created.sessionId);
    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-pending-second')
      .send({ expectedRevision: pending!.revision, intent: 'correction', message: 'Otra correccion durante analisis pendiente.' })
      .expect(409);
    releaseCorrection();
    expect((await firstCorrectionPromise).status).toBe(200);

    expect((await repository.listTurns(created.sessionId))).toHaveLength(2);
    await expect(repository.readContextRevision(created.sessionId)).resolves.toBe(2);
    expect(adapter.calls).toHaveLength(2);
    expect(synthesizer.calls).toHaveLength(2);
  });

  it('rejects stale corrections after checkpoint advancement and blocks corrections after final confirmation', async () => {
    const adapter = new CorrectionTestAgentAdapter([false, true]);
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app } = makeApp(synthesizer, adapter);
    const created = await createCorrectionSession(app);
    const checkpoint = await postInitialCorrectionTurn(app, created);
    const advanced = await request(app)
      .post(`${base}/sessions/${created.sessionId}/guided-exploration`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-advance-checkpoint')
      .send({ expectedRevision: checkpoint.body.data.revision, choice: 'provisional_route' })
      .expect(200);

    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-stale-checkpoint')
      .send({ expectedRevision: checkpoint.body.data.revision, intent: 'correction', message: 'Correccion con revision anterior al avance.' })
      .expect(409);

    const handoff = await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-materialize-handoff')
      .send({ expectedRevision: advanced.body.data.revision })
      .expect(200);
    expect(handoff.body.data.lifecycleStatus).toBe('HANDOFF_READY');

    const claimed = await request(app)
      .post(`${base}/sessions/${created.sessionId}/claim`)
      .set('Authorization', 'Bearer user-1')
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-claim-handoff')
      .send({ expectedRevision: handoff.body.data.revision })
      .expect(200);
    const confirmed = await request(app)
      .post(`${base}/sessions/${created.sessionId}/handoff/confirmation`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'correction-confirm-handoff')
      .send({ expectedRevision: claimed.body.data.revision, action: 'confirm', acceptedFields: ['understood_need'] })
      .expect(200);
    expect(confirmed.body.data.lifecycleStatus).toBe('CONFIRMED');
    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('Authorization', 'Bearer user-1')
      .set('Idempotency-Key', 'correction-after-confirmed-handoff')
      .send({ expectedRevision: confirmed.body.data.revision, intent: 'correction', message: 'No editar el Brief confirmado desde mensajes.' })
      .expect(409);
  });
});

type CorrectionSession = { sessionId: string; token: string };

type CriticalHandoffReviewFixture = {
  sessionId: string;
  token: string;
  sessionRevision: number;
  artifact: {
    id: string;
    version: number;
    sourceContextRevision: number;
    projection: CriticalHandoffProjection;
  };
};

async function createCriticalHandoffReview(app: express.Express): Promise<CriticalHandoffReviewFixture> {
  const turn = await submitTurn(app);
  const sessionId = turn.body.data.id as string;
  const checkpoint = await request(app)
    .post(`${base}/sessions/${sessionId}/guided-exploration`)
    .set('X-Starteria-Entry-Token', turn.token)
    .set('Idempotency-Key', `critical-confirm-checkpoint-${sessionId}`)
    .send({ expectedRevision: turn.body.data.revision, choice: 'provisional_route' })
    .expect(200);
  const handoff = await request(app)
    .post(`${base}/sessions/${sessionId}/handoff`)
    .set('X-Starteria-Entry-Token', turn.token)
    .set('Idempotency-Key', `critical-confirm-materialize-${sessionId}`)
    .send({ expectedRevision: checkpoint.body.data.revision })
    .expect(200);
  const response = await request(app)
    .get(`${base}/sessions/${sessionId}/critical-handoff`)
    .set('X-Starteria-Entry-Token', turn.token)
    .expect(200);
  return {
    sessionId,
    token: turn.token,
    sessionRevision: handoff.body.data.revision,
    artifact: response.body.data,
  };
}

async function claimCriticalHandoffReview(app: express.Express, fixture: CriticalHandoffReviewFixture) {
  return request(app)
    .post(`${base}/sessions/${fixture.sessionId}/claim`)
    .set('Authorization', 'Bearer user-1')
    .set('X-Starteria-Entry-Token', fixture.token)
    .set('Idempotency-Key', `critical-confirm-claim-${fixture.sessionId}`)
    .send({ expectedRevision: fixture.sessionRevision })
    .expect(200);
}

async function createCorrectionSession(app: express.Express): Promise<CorrectionSession> {
  const created = await request(app).post(`${base}/sessions`).send({}).expect(201);
  return { sessionId: created.body.data.session.id, token: created.body.data.publicAccessToken };
}

async function postInitialCorrectionTurn(app: express.Express, created: CorrectionSession) {
  return request(app)
    .post(`${base}/sessions/${created.sessionId}/messages`)
    .set('X-Starteria-Entry-Token', created.token)
    .set('Idempotency-Key', `correction-initial-${created.sessionId}`)
    .send({ expectedRevision: 0, message: 'La cartera debe aclarar quÃ© trabajo proteger antes de la revision.' })
    .expect(200);
}

class FakeSynthesizer implements PortfolioEntryLiveUnderstandingSynthesizer {
  readonly calls: SynthesisInput[] = [];

  constructor(private readonly respond: (input: SynthesisInput) => Promise<CriticalSituationSynthesis | null> | CriticalSituationSynthesis | null) {}

  async synthesize(input: SynthesisInput): Promise<CriticalSituationSynthesis | null> {
    this.calls.push(input);
    return this.respond(input);
  }
}

class IntegrationAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  private calls = 0;

  constructor(private readonly clarifyFirstQuestion = false) {}

  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    const output: PortfolioEntryAnalyzeTurnOutputV2 = {
      analysis: {
        entry_id: input.entryId,
        analysis_version: 'test',
        primary_intent: 'portfolio_tracking',
        secondary_intents: [],
        initial_entry_state: 'portfolio_first',
        current_frame: 'portfolio_first',
        extracted_context: { summary: input.rawInput, decision_need: 'prioritize_before_review' },
        ambiguities: [],
        contradictions: [],
        reverse_alignment: {
          required: false,
          subject_type: 'unknown',
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
    const firstCall = this.calls++ === 0;
    if (!this.clarifyFirstQuestion || !firstCall) return output;
    return {
      ...output,
      analysis: { ...output.analysis, status: 'pending', ambiguities: ['decision_to_enable'] },
      question_plan: {
        questions: [{
          id: 'integration-question',
          question: '¿Qué decisión necesita habilitar este trabajo?',
          question_type: 'critical_gap',
          reason_to_ask: 'Falta precisar la decisión.',
          resolves: ['decision_to_enable'],
          priority: 1,
          expected_answer_type: 'text',
        }],
        question_count: 1,
        status: 'questions_required',
      },
    };
  }
}

class CorrectionTestAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  readonly calls: PortfolioEntryAnalyzeTurnInputV2[] = [];

  constructor(
    private readonly askQuestionByCall: boolean[],
    private readonly beforeRespond?: (callNumber: number) => Promise<void>,
  ) {}

  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    this.calls.push(input);
    await this.beforeRespond?.(this.calls.length);
    const asksQuestion = this.askQuestionByCall[this.calls.length - 1] ?? false;
    const analysis: PortfolioEntryAnalyzeTurnOutputV2['analysis'] = {
      entry_id: input.entryId,
      analysis_version: 'correction-test',
      primary_intent: 'portfolio_tracking',
      secondary_intents: [],
      initial_entry_state: 'portfolio_first',
      current_frame: 'portfolio_first',
      extracted_context: { summary: input.rawInput, decision_need: 'prioritize_before_review' },
      ambiguities: asksQuestion ? ['decision_to_enable'] : [],
      contradictions: [],
      reverse_alignment: {
        required: false,
        subject_type: 'unknown',
        connection_state: 'not_required',
        missing_links: [],
      },
      provenance: [{ path: 'extracted_context.summary', origin: 'EXTRACTED_FROM_USER_TEXT', review_disposition: 'UNREVIEWED' }],
      status: asksQuestion ? 'pending' : 'ready',
    };
    return {
      analysis,
      question_plan: asksQuestion ? {
        questions: [{
          id: `correction-question-${this.calls.length}`,
          question: 'QuÃ© decisiÃ³n necesita aclararse?',
          question_type: 'critical_gap',
          reason_to_ask: 'La decisiÃ³n a preparar necesita mÃ¡s contexto.',
          resolves: ['analysis.extracted_context.decision_need'],
          priority: 1,
          expected_answer_type: 'text',
        }],
        question_count: 1,
        status: 'questions_required',
      } : {
        questions: [],
        question_count: 0,
        status: 'no_questions_required',
        stop_reason: 'sufficient_context',
      },
    };
  }
}

function makeApp(
  synthesizer: FakeSynthesizer,
  adapter: PortfolioEntryAgentAdapterV2 = new IntegrationAgentAdapter(),
  criticalHandoffProjector?: (source: unknown) => CriticalHandoffProjection,
) {
  const app = express();
  const repository = new InMemoryPortfolioEntrySessionRepository();
  app.use(express.json());
  app.use(requestId);
  app.use(base, buildPortfolioEntryRouter({
    maxCreateRequests: 50,
    maxSubmitRequests: 50,
    maxHandoffRequests: 50,
  }, {
    sessionRepository: repository,
    idempotencyRepository: new InMemoryPortfolioEntryIdempotencyRepository(),
    agentAdapter: adapter,
    liveUnderstandingSynthesizer: synthesizer,
    criticalHandoffProjector,
    authenticate: correctionTestAuthenticate,
    optionalAuthenticate: correctionTestOptionalAuthenticate,
    sessionTtlMs: 60 * 60_000,
    idempotencyTtlMs: 60 * 60_000,
  }));
  app.use(errorHandler);
  return { app, repository };
}

const correctionTestAuthenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Authentication required.'));
    return;
  }
  const id = authorization.slice('Bearer '.length);
  req.user = { id, email: `${id}@starteria.test`, role: 'participante', roles: ['participante'], permissions: new Set() };
  next();
};

const correctionTestOptionalAuthenticate: RequestHandler = (req, res, next) => {
  if (!req.header('Authorization')) {
    next();
    return;
  }
  correctionTestAuthenticate(req, res, next);
};

async function submitTurn(app: express.Express) {
  const created = await request(app).post(`${base}/sessions`).send({}).expect(201);
  const response = await request(app)
    .post(`${base}/sessions/${created.body.data.session.id}/messages`)
    .set('X-Starteria-Entry-Token', created.body.data.publicAccessToken)
    .set('Idempotency-Key', `live-understanding-${created.body.data.session.id}`)
    .send({
      expectedRevision: 0,
      message: 'Necesitamos ordenar las iniciativas y decidir qué evidencia revisar antes del comité trimestral.',
    })
    .expect(200);
  return {
    status: response.status,
    body: response.body,
    token: created.body.data.publicAccessToken,
  };
}

function supportedSynthesis(options: {
  basis_status?: CriticalSituationSynthesis['basis_status'];
  insightStatus?: CriticalSituationSynthesis['situation_insight']['status'];
} = {}): CriticalSituationSynthesis {
  const sourceRef = 'session.user_message:private source ref';
  const insightStatus = options.insightStatus ?? (options.basis_status === 'insufficient_basis' ? 'no_supported_insight' : 'supported');
  const hasSupportedDecision = insightStatus === 'supported' && options.basis_status !== 'insufficient_basis';
  return criticalSituationSynthesisSchema.parse({
    basis_status: options.basis_status ?? 'sufficient',
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
    situation_insight: insightStatus === 'supported'
      ? {
          statement: 'El checkpoint de evidencia llega después de la revisión de cartera.',
          support: [sourceRef],
          novelty_type: 'sequence_dependency_exposed',
          epistemic_role: 'INTERPRETATION',
          status: 'supported',
        }
      : {
          statement: null,
          support: [],
          novelty_type: 'no_supported_insight',
          epistemic_role: 'INTERPRETATION',
          status: 'no_supported_insight',
        },
    material_tensions: [],
    decision_frame: {
      status: hasSupportedDecision ? 'framed' : 'not_yet_identifiable',
      decision_to_prepare: hasSupportedDecision ? 'Qué iniciativas priorizar antes de la revisión.' : null,
      decision_authority: 'private decision authority',
      materially_distinct_paths: [],
      distinguishing_conditions: [],
      timing_or_constraints: [],
      unresolved_basis: [],
    },
    usable_now: [],
    decision_changing_unknowns: [],
    candidate_first_movement: {
      movement: 'private candidate first movement',
      why_now: 'private movement rationale',
      existing_assets_used: [],
      what_it_may_clarify: 'private clarification',
      decision_supported: 'private decision',
      boundary: 'private boundary',
      epistemic_role: 'PROPOSAL',
    },
    provenance: [{
      id: 'private provenance id',
      claim_ref: 'situation_insight.statement',
      origin: 'AI_INFERRED',
      review_disposition: 'UNREVIEWED',
      source_refs: insightStatus === 'supported' ? [sourceRef] : ['private provenance id'],
      source_path: 'private path',
      source_text: 'private source text',
      recorded_at: null,
    }],
  });
}
