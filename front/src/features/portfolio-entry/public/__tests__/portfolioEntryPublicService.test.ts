import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../tests/setup-jsdom';
import {
  chooseGuidedExploration,
  continuePortfolioEntryToPortfolio,
  createPortfolioEntrySession,
  getPortfolioEntrySession,
  normalizePortfolioEntryApiError,
  submitPortfolioEntryMessage,
} from '../portfolioEntryPublicService';
import type { PortfolioEntrySessionDto } from '../types';
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
