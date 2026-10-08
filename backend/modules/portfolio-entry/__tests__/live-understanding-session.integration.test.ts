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
import { InMemoryPortfolioEntrySessionRepository } from '../../portfolio-entry-sessions/infrastructure/in-memory-portfolio-entry-session.repository';
import type { PortfolioEntryLiveUnderstandingSynthesisRequest, PortfolioEntryLiveUnderstandingSynthesizer } from '../application/portfolio-entry-experimental-session.service';
import { InMemoryPortfolioEntryIdempotencyRepository } from '../infrastructure/in-memory-portfolio-entry-idempotency.repository';
import { buildPortfolioEntryRouter } from '../portfolio-entry.router';

const base = '/api/v1/public/portfolio-entry';

describe('Portfolio Entry Live Understanding session integration', () => {
  it('invokes synthesis exactly once after a successful user turn', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app } = makeApp(synthesizer);

    const turn = await submitTurn(app);

    expect(turn.status).toBe(200);
    expect(synthesizer.calls).toHaveLength(1);
    expect(synthesizer.calls[0].sessionRevision).toBe(turn.body.data.revision);
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

  it('does not rerun synthesis for checkpoint selection or page load', async () => {
    const synthesizer = new FakeSynthesizer(() => supportedSynthesis());
    const { app } = makeApp(synthesizer);
    const turn = await submitTurn(app);

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
    expect(read.body.data).not.toHaveProperty('liveUnderstanding');
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
    expect(adapter.calls).toHaveLength(2);
    expect(synthesizer.calls).toHaveLength(2);
  });

  it('rejects stale corrections after checkpoint advancement and does not reopen a final handoff', async () => {
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
    await request(app)
      .post(`${base}/sessions/${created.sessionId}/messages`)
      .set('X-Starteria-Entry-Token', created.token)
      .set('Idempotency-Key', 'correction-after-handoff')
      .send({ expectedRevision: handoff.body.data.revision, intent: 'correction', message: 'No reabrir un handoff materializado.' })
      .expect(409);
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
