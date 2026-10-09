import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../tests/setup-jsdom';
import {
  chooseGuidedExploration,
  confirmPortfolioEntryCriticalHandoff,
  continuePortfolioEntryToPortfolio,
  createPortfolioEntrySession,
  getPortfolioEntryCriticalHandoff,
  getPortfolioEntrySession,
  materializePortfolioEntryCriticalHandoff,
  normalizePortfolioEntryApiError,
  submitPortfolioEntryMessage,
} from '../portfolioEntryPublicService';
import type { PortfolioEntryLiveUnderstanding, PortfolioEntrySessionDto } from '../types';
import { createIdempotencyKey } from '../idempotency';

function makeSession(overrides: Partial<PortfolioEntrySessionDto> = {}): PortfolioEntrySessionDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    lifecycleStatus: 'ENTRY_CAPTURED',
    executionStatus: 'ACTIVE',
    revision: 0,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ownership: { state: 'ANONYMOUS' },
    conversation: [],
    clarification: {
      interactionMode: 'quick_clarification',
      quickQuestionBudget: 3,
      quickQuestionsAsked: 0,
      explorationRound: 0,
      questionsAskedCurrentRound: 0,
      previousQuestions: [],
      answeredGaps: [],
    },
    semanticProjection: {},
    nextAction: 'submit_message',
    ...overrides,
  };
}

describe('portfolioEntryPublicService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anonymous session and returns the public access credential', async () => {
    server.use(
      http.post('*/public/portfolio-entry/sessions', async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ sourceMetadata: { channel: 'public_start_frontend' } });
        return HttpResponse.json({
          success: true,
          data: { session: makeSession(), publicAccessToken: 'entry-token' },
        }, { status: 201 });
      }),
    );

    await expect(createPortfolioEntrySession()).resolves.toMatchObject({
      publicAccessToken: 'entry-token',
      session: { id: '11111111-1111-4111-8111-111111111111' },
    });
  });

  it('sends anonymous token in header, never in the URL', async () => {
    server.use(
      http.get('*/public/portfolio-entry/sessions/:sessionId', ({ request }) => {
        const url = new URL(request.url);
        expect(url.search).not.toContain('entry-token');
        expect(url.pathname).not.toContain('entry-token');
        expect(request.headers.get('X-Starteria-Entry-Token')).toBe('entry-token');
        return HttpResponse.json({ success: true, data: makeSession() });
      }),
    );

    await getPortfolioEntrySession('11111111-1111-4111-8111-111111111111', 'entry-token');
  });

  it('loads only the safe Critical Handoff DTO from its dedicated endpoint', async () => {
    server.use(
      http.get('*/public/portfolio-entry/sessions/:sessionId/critical-handoff', ({ request, params }) => {
        expect(params.sessionId).toBe('11111111-1111-4111-8111-111111111111');
        expect(new URL(request.url).pathname).toContain('/critical-handoff');
        expect(new URL(request.url).search).not.toContain('entry-token');
        expect(request.headers.get('X-Starteria-Entry-Token')).toBe('entry-token');
        return HttpResponse.json({
          success: true,
          data: {
            id: 'artifact-1',
            version: 3,
            schemaVersion: 'critical-handoff-projection-v0.1',
            sourceContextRevision: 7,
            sourceTurnId: 'turn-9',
            claim_ref: 'private-claim-ref',
            route_ranking: ['private-route'],
            candidate_first_movement: { raw: 'private movement object' },
            state: 'current',
            confirmationState: 'provisional',
            confirmedAt: null,
            projection: {
              conclusionStatus: 'bounded',
              finalReading: 'El comité necesita comparar capacidad y urgencia antes de priorizar.',
              decisionInView: 'Qué iniciativas reciben capacidad durante este ciclo.',
              usableNow: [{ item: 'Datos de capacidad', howItCanHelp: 'Permiten acotar opciones.' }],
              decisionChangingUnknowns: [{ uncertainty: 'Falta confirmar una fecha.', whyItMatters: 'Puede cambiar la secuencia.' }],
              firstMovement: {
                movement: 'Revisar el corte de capacidad actual.',
                whyNow: 'Ese corte ya existe.',
                whatItMayClarify: 'Qué opciones caben en el ciclo.',
                boundary: 'No decide prioridades por sí solo.',
                existingAssetsUsed: ['Informe de capacidad'],
              },
              reasoning_metadata: { private: true },
            },
            selected_lenses: ['private-lens'],
            provenance: [{ source_ref: 'private-ref' }],
            source_refs: ['private-source-ref'],
            claim_refs: ['private-claim-ref'],
            prompt_metadata: { prompt: 'private prompt metadata' },
            model_metadata: { model: 'private-model' },
            provider_metadata: { provider: 'private-provider' },
            raw_synthesis: { prompt: 'private prompt' },
            starteria_path: ['private path'],
            recommended_approach: 'private recommendation',
            recommended_cta: 'private CTA',
          },
        });
      }),
    );

    const artifact = await getPortfolioEntryCriticalHandoff('11111111-1111-4111-8111-111111111111', 'entry-token');

    expect(artifact).toEqual({
      id: 'artifact-1',
      version: 3,
      sourceContextRevision: 7,
      state: 'current',
      confirmationState: 'provisional',
      confirmedAt: null,
      projection: {
        conclusionStatus: 'bounded',
        finalReading: 'El comité necesita comparar capacidad y urgencia antes de priorizar.',
        decisionInView: 'Qué iniciativas reciben capacidad durante este ciclo.',
        usableNow: [{ item: 'Datos de capacidad', howItCanHelp: 'Permiten acotar opciones.' }],
        decisionChangingUnknowns: [{ uncertainty: 'Falta confirmar una fecha.', whyItMatters: 'Puede cambiar la secuencia.' }],
        firstMovement: {
          movement: 'Revisar el corte de capacidad actual.',
          whyNow: 'Ese corte ya existe.',
          whatItMayClarify: 'Qué opciones caben en el ciclo.',
          boundary: 'No decide prioridades por sí solo.',
          existingAssetsUsed: ['Informe de capacidad'],
        },
      },
    });
    expect(Object.keys(artifact ?? {})).toEqual(['id', 'version', 'sourceContextRevision', 'state', 'confirmationState', 'confirmedAt', 'projection']);
    expect(JSON.stringify(artifact)).not.toMatch(/sourceTurnId|schemaVersion|selected_lenses|reasoning_metadata|provenance|source_refs|claim_ref|prompt_metadata|model_metadata|provider_metadata|candidate_first_movement|route_ranking|raw_synthesis|starteria_path|recommended_approach|recommended_cta/i);
  });

  it('uses the explicit current materialization endpoint and returns only its allowlisted contract', async () => {
    server.use(http.post('*/public/portfolio-entry/sessions/:sessionId/critical-handoff', async ({ request, params }) => {
      expect(params.sessionId).toBe('11111111-1111-4111-8111-111111111111');
      expect(request.headers.get('X-Starteria-Entry-Token')).toBe('entry-token');
      expect(request.headers.get('Idempotency-Key')).toBe('critical-materialization-1');
      expect(await request.json()).toEqual({ expectedRevision: 8 });
      return HttpResponse.json({ success: true, data: {
        sessionRevision: 9,
        criticalHandoff: {
          id: 'artifact-current',
          version: 2,
          sourceContextRevision: 5,
          state: 'current',
          confirmationState: 'provisional',
          confirmedAt: null,
          projection: {
            conclusionStatus: 'supported',
            finalReading: 'Lectura permitida.',
            decisionInView: 'Decisión en vista.',
            usableNow: [],
            decisionChangingUnknowns: [],
            firstMovement: { movement: 'Un paso', whyNow: 'Ahora', whatItMayClarify: 'Una duda', boundary: 'Provisional', existingAssetsUsed: [] },
          },
          provenance: ['private provenance'],
          recommended_approach: 'legacy recommendation',
          starteria_path: ['legacy path'],
          recommended_cta: 'legacy CTA',
          selected_lenses: ['private lens'],
          reasoning_metadata: { private: true },
          raw_synthesis: { private: true },
          confirmedByUserId: 'private-user-id',
        },
      } });
    }));

    const response = await materializePortfolioEntryCriticalHandoff(
      '11111111-1111-4111-8111-111111111111',
      'entry-token',
      { expectedRevision: 8, idempotencyKey: 'critical-materialization-1' },
    );

    expect(response.sessionRevision).toBe(9);
    expect(response.criticalHandoff).toMatchObject({
      id: 'artifact-current',
      version: 2,
      sourceContextRevision: 5,
      state: 'current',
      confirmationState: 'provisional',
      confirmedAt: null,
    });
    expect(JSON.stringify(response)).not.toMatch(/provenance|recommended_approach|starteria_path|recommended_cta|selected_lenses|reasoning_metadata|raw_synthesis|confirmedByUserId/i);
  });

  it('posts only explicit artifact identity and currentness expectations to the dedicated confirmation endpoint', async () => {
    const confirmedAt = '2026-10-09T12:00:00.000Z';
    server.use(http.post('*/public/portfolio-entry/sessions/:sessionId/critical-handoff/:artifactId/confirmation', async ({ request, params }) => {
      expect(params.sessionId).toBe('11111111-1111-4111-8111-111111111111');
      expect(params.artifactId).toBe('artifact-1');
      expect(request.headers.get('Idempotency-Key')).toBe('critical-confirm-key');
      expect(request.headers.get('X-Starteria-Entry-Token')).toBeNull();
      expect(await request.json()).toEqual({ action: 'confirm', expectedArtifactVersion: 3, expectedContextRevision: 7 });
      return HttpResponse.json({ success: true, data: {
        id: 'artifact-1', version: 3, sourceContextRevision: 7, state: 'current',
        confirmationState: 'confirmed', confirmedAt,
        projection: {
          conclusionStatus: 'supported', finalReading: 'Lectura segura.', decisionInView: null,
          usableNow: [], decisionChangingUnknowns: [], firstMovement: null,
          reasoning_metadata: { private: true },
        },
        acceptedFields: ['private legacy structure'], provenance: [{ source: 'private' }],
      } });
    }));

    await expect(confirmPortfolioEntryCriticalHandoff('11111111-1111-4111-8111-111111111111', {
      artifactId: 'artifact-1', expectedArtifactVersion: 3, expectedContextRevision: 7, idempotencyKey: 'critical-confirm-key',
    })).resolves.toMatchObject({
      id: 'artifact-1', version: 3, sourceContextRevision: 7, state: 'current',
      confirmationState: 'confirmed', confirmedAt,
      projection: { finalReading: 'Lectura segura.' },
    });
  });

  it('treats a missing Critical Handoff as absent without reading legacy handoff data', async () => {
    server.use(http.get('*/public/portfolio-entry/sessions/:sessionId/critical-handoff', () => HttpResponse.json({
      success: false,
      error: { code: 'NOT_FOUND' },
    }, { status: 404 })));

    await expect(getPortfolioEntryCriticalHandoff('11111111-1111-4111-8111-111111111111', 'entry-token')).resolves.toBeNull();
  });

  it('uses authenticated transport for Critical Handoff reads after claim', async () => {
    server.use(http.get('*/public/portfolio-entry/sessions/:sessionId/critical-handoff', ({ request }) => {
      expect(request.headers.get('X-Starteria-Entry-Token')).toBeNull();
      return HttpResponse.json({
        success: true,
        data: {
          id: 'claimed-artifact',
          version: 2,
          sourceContextRevision: 8,
          state: 'current',
          confirmationState: 'confirmed',
          confirmedAt: '2026-10-09T12:00:00.000Z',
          projection: {
            conclusionStatus: 'supported',
            finalReading: 'La lectura se conserva.',
            decisionInView: null,
            usableNow: [],
            decisionChangingUnknowns: [],
            firstMovement: null,
          },
        },
      });
    }));

    await expect(getPortfolioEntryCriticalHandoff('11111111-1111-4111-8111-111111111111')).resolves.toMatchObject({
      state: 'current',
    });
  });

  it('returns reason_to_ask unchanged on the question DTO', async () => {
    const reason = 'Puede cambiar la decisión que necesitas preparar.';
    server.use(http.get('*/public/portfolio-entry/sessions/:sessionId', () => HttpResponse.json({
      success: true,
      data: makeSession({
        conversation: [{
          id: 'turn-1', turnIndex: 0, userInput: 'Necesito priorizar.', matchedQuestionIds: [], respondedResolves: [],
          createdAt: new Date().toISOString(),
          emittedQuestions: [{
            id: 'q-1', question: '¿Qué decisión necesitas habilitar?', reason_to_ask: reason, resolves: [],
            turn_index: 0, interaction_mode: 'quick_clarification', asked_at_budget_remaining: 3,
          }],
        }],
      }),
    })));

    const session = await getPortfolioEntrySession('11111111-1111-4111-8111-111111111111', 'entry-token');
    expect(session.conversation[0]?.emittedQuestions[0]?.reason_to_ask).toBe(reason);
  });

  it('sends expectedRevision and a stable Idempotency-Key supplied by the caller', async () => {
    const key = 'stable-key-1';
    server.use(
      http.post('*/public/portfolio-entry/sessions/:sessionId/messages', async ({ request }) => {
        const body = await request.json();
        expect(request.headers.get('X-Starteria-Entry-Token')).toBe('entry-token');
        expect(request.headers.get('Idempotency-Key')).toBe(key);
        expect(body).toEqual({ expectedRevision: 4, message: 'Respuesta natural del usuario' });
        return HttpResponse.json({ success: true, data: makeSession({ revision: 5, nextAction: 'generate_handoff' }) });
      }),
    );

    await submitPortfolioEntryMessage('11111111-1111-4111-8111-111111111111', 'entry-token', {
      expectedRevision: 4,
      idempotencyKey: key,
      message: 'Respuesta natural del usuario',
    });
  });

  it('sends explicit correction intent without inferring a matched question', async () => {
    server.use(
      http.post('*/public/portfolio-entry/sessions/:sessionId/messages', async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        expect(request.headers.get('Idempotency-Key')).toBe('correction-key');
        expect(body).toEqual({
          expectedRevision: 7,
          message: 'La lectura no refleja lo que quise decir sobre esta iniciativa.',
          intent: 'correction',
        });
        expect(body).not.toHaveProperty('matchedQuestionIds');
        return HttpResponse.json({ success: true, data: makeSession({ revision: 8, nextAction: 'answer_clarification' }) });
      }),
    );

    await submitPortfolioEntryMessage('11111111-1111-4111-8111-111111111111', 'entry-token', {
      expectedRevision: 7,
      idempotencyKey: 'correction-key',
      message: 'La lectura no refleja lo que quise decir sobre esta iniciativa.',
      intent: 'correction',
    });
  });

  it('submits correction context for a claimed session through authenticated transport', async () => {
    server.use(
      http.post('*/public/portfolio-entry/sessions/:sessionId/messages', async ({ request }) => {
        const body = await request.json();
        expect(request.headers.get('X-Starteria-Entry-Token')).toBeNull();
        expect(request.headers.get('Idempotency-Key')).toBe('claimed-correction-key');
        expect(body).toEqual({
          expectedRevision: 12,
          message: 'El espacio disponible depende de otra fecha.',
          intent: 'correction',
        });
        return HttpResponse.json({ success: true, data: makeSession({ revision: 13, nextAction: 'answer_clarification' }) });
      }),
    );

    await submitPortfolioEntryMessage('11111111-1111-4111-8111-111111111111', undefined, {
      expectedRevision: 12,
      idempotencyKey: 'claimed-correction-key',
      message: 'El espacio disponible depende de otra fecha.',
      intent: 'correction',
    });
  });

  it('returns the safe liveUnderstanding field from the successful message response', async () => {
    const liveUnderstanding: PortfolioEntryLiveUnderstanding = {
      state: 'supported_reading',
      reading: 'La validación depende del acceso autorizado a los datos.',
      decision: { decisionToPrepare: 'Si continuar con la validación en esta iniciativa.' },
      decisionChangingUnknowns: [],
    };
    server.use(
      http.post('*/public/portfolio-entry/sessions/:sessionId/messages', () => HttpResponse.json({
        success: true,
        data: makeSession({ revision: 3, nextAction: 'answer_clarification', liveUnderstanding }),
      })),
    );

    const response = await submitPortfolioEntryMessage('11111111-1111-4111-8111-111111111111', 'entry-token', {
      expectedRevision: 2,
      idempotencyKey: 'safe-live-understanding-key',
      message: 'El permiso cambia cuándo podemos probarlo.',
    });

    expect(response.liveUnderstanding).toEqual(liveUnderstanding);
  });

  it('uses the Guided Exploration endpoint for accept/provisional-route choice', async () => {
    server.use(
      http.post('*/public/portfolio-entry/sessions/:sessionId/guided-exploration', async ({ request }) => {
        const body = await request.json();
        expect(request.headers.get('Idempotency-Key')).toBe('guided-key');
        expect(body).toEqual({ expectedRevision: 2, choice: 'provisional_route' });
        return HttpResponse.json({ success: true, data: makeSession({ revision: 3, lifecycleStatus: 'CLARIFYING' }) });
      }),
    );

    await chooseGuidedExploration('11111111-1111-4111-8111-111111111111', 'entry-token', {
      expectedRevision: 2,
      idempotencyKey: 'guided-key',
      choice: 'provisional_route',
    });
  });

  it('continues a claimed session to Portfolio with expectedRevision and Idempotency-Key only', async () => {
    server.use(
      http.post('*/public/portfolio-entry/sessions/:sessionId/continue-portfolio', async ({ request, params }) => {
        const url = new URL(request.url);
        const body = await request.json() as Record<string, unknown>;
        expect(params.sessionId).toBe('11111111-1111-4111-8111-111111111111');
        expect(url.search).not.toContain('entry-token');
        expect(request.headers.get('X-Starteria-Entry-Token')).toBeNull();
        expect(request.headers.get('Idempotency-Key')).toBe('convert-key');
        expect(body).toEqual({ expectedRevision: 8 });
        expect(body).not.toHaveProperty('ownerUserId');
        expect(body).not.toHaveProperty('projectId');
        return HttpResponse.json({
          success: true,
          data: {
            continuationId: 'continuation-1',
            sessionId: '11111111-1111-4111-8111-111111111111',
            status: 'CONTINUED',
            destinationRoute: '/portfolio/setup',
            continuedAt: new Date().toISOString(),
            portfolioScope: { kind: 'scoped_portfolio_grant', userId: 'user-1', organizationId: 'org-1' },
            context: {},
          },
        });
      }),
    );

    await expect(continuePortfolioEntryToPortfolio('11111111-1111-4111-8111-111111111111', {
      expectedRevision: 8,
      idempotencyKey: 'convert-key',
    })).resolves.toMatchObject({
      status: 'CONTINUED',
      destinationRoute: '/portfolio/setup',
    });
  });

  it('maps stale revision conflicts to conflict without automatic replay', () => {
    const err = {
      isAxiosError: true,
      response: { status: 409, headers: {}, data: { success: false } },
    };

    expect(normalizePortfolioEntryApiError(err).kind).toBe('conflict');
  });

  it('can generate and reuse one key for a logical retry', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1' as `${string}-${string}-${string}-${string}-${string}`);
    const stableKey = createIdempotencyKey('portfolio-entry:message');

    expect(stableKey).toBe('portfolio-entry:message:uuid-1');
    expect([stableKey, stableKey]).toEqual(['portfolio-entry:message:uuid-1', 'portfolio-entry:message:uuid-1']);
  });
});
