import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PortfolioEntryExperience } from '../PortfolioEntryExperience';
import { serializeConfirmedBriefMarkdown } from '../portfolioEntryBriefExport';
import type { PortfolioEntryCriticalHandoffDto, PortfolioEntryHandoff, PortfolioEntrySessionDto } from '../types';
import type { StarteriaPathSupportedDto } from '../starteriaPath.types';
import {
  readPendingPortfolioEntryClaim,
  readClaimedPortfolioEntryBriefIdentity,
  markCriticalHandoffReviewSession,
  saveCriticalHandoffMaterializationAttempt,
  saveClaimedPortfolioEntrySession,
  savePortfolioEntryCurrentSession,
} from '../storage';

const serviceMocks = vi.hoisted(() => ({
  authState: { authLoading: false },
  createPortfolioEntrySession: vi.fn(),
  getPortfolioEntrySession: vi.fn(),
  getPortfolioEntryCriticalHandoff: vi.fn(),
  getPortfolioEntryCriticalHandoffGeneration: vi.fn(),
  getPortfolioEntryStarteriaPath: vi.fn(),
  getPortfolioEntryHandoff: vi.fn(),
  getClaimedPortfolioEntrySession: vi.fn(),
  submitPortfolioEntryMessage: vi.fn(),
  chooseGuidedExploration: vi.fn(),
  materializePortfolioEntryCriticalHandoff: vi.fn(),
  materializePortfolioEntryHandoff: vi.fn(),
  confirmPortfolioEntryCriticalHandoff: vi.fn(),
  correctPortfolioEntryHandoff: vi.fn(),
  confirmPortfolioEntryHandoff: vi.fn(),
  continuePortfolioEntryToPortfolio: vi.fn(),
  convertPortfolioEntrySession: vi.fn(),
  abandonPortfolioEntrySession: vi.fn(),
  normalizePortfolioEntryApiError: vi.fn((err: { kind?: string; status?: number }) => ({
    kind: err.kind ?? 'network',
    status: err.status,
  })),
}));

const navigateSpy = vi.hoisted(() => vi.fn());

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock('../portfolioEntryPublicService', () => serviceMocks);

vi.mock('../../../../app/context/AppContext', () => ({
  useApp: () => serviceMocks.authState,
}));

vi.mock('../analytics', () => ({
  trackPortfolioEntryEvent: vi.fn(),
}));

function renderExperience() {
  return render(
    <MemoryRouter>
      <PortfolioEntryExperience />
    </MemoryRouter>,
  );
}

function makeHandoff(overrides: Partial<PortfolioEntryHandoff> = {}): PortfolioEntryHandoff {
  return {
    understanding: {
      value: 'El usuario necesita ordenar varias iniciativas antes del comite.',
      provenance: { origin: 'AI_INFERRED' },
    },
    desired_outcome: {
      value: 'Llegar con una lectura clara de foco y decisiones pendientes.',
      provenance: { origin: 'AI_INFERRED' },
    },
    decision_to_enable: {
      value: 'Decidir que iniciativas requieren continuidad o ajuste.',
      provenance: { origin: 'AI_INFERRED' },
    },
    recommended_approach: {
      description: 'Separar primero claridad de objetivo, iniciativas activas e incertidumbre.',
      rationale: 'AsÃƒÂ­ la decisiÃƒÂ³n parte del portfolio real y no de trabajo nuevo sin foco.',
      assumption: 'La actividad y la evidencia disponibles permiten comparar las iniciativas.',
      origin: 'AI_SUGGESTED',
      review_disposition: 'UNREVIEWED',
    },
    alternative_approaches: [{
      description: 'Empezar por la decisiÃƒÂ³n mÃƒÂ¡s prÃƒÂ³xima si el tiempo del comitÃƒÂ© es limitado.',
      rationale: 'Reduce el alcance inicial, pero deja fuera parte del portfolio.',
      origin: 'AI_SUGGESTED',
      review_disposition: 'UNREVIEWED',
    }],
    known_context: [],
    unresolved_context: [{ gap_id: 'gap-1', description: 'Aun falta confirmar la metrica principal.' }],
    gap_resolution_map: [{
      gap_id: 'gap-1',
      gap_description: 'Aun falta confirmar la metrica principal.',
      resolution_type: 'REQUIRES_EXTERNAL_EVIDENCE',
      resolution_stage: 'PORTFOLIO',
    }],
    evidence_or_clarity_needed: [{ value: 'Metrica o senal de exito pendiente.' }],
    starteria_path: [{ action: 'structure', description: 'Estructurar las iniciativas y sus seÃƒÂ±ales relevantes.' }],
    recommended_cta: 'Crear una lectura revisada antes de pasar a una cuenta.',
    provenance_summary: [],
    handoff_status: 'ready_with_uncertainty',
    ...overrides,
  };
}

function makeSession(overrides: Partial<PortfolioEntrySessionDto> = {}): PortfolioEntrySessionDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    handoffExperience: 'none',
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

function makeCriticalHandoff(overrides: Partial<PortfolioEntryCriticalHandoffDto> = {}): PortfolioEntryCriticalHandoffDto {
  return {
    id: 'critical-artifact-1',
    version: 3,
    sourceContextRevision: 7,
    state: 'current',
    confirmationState: 'provisional',
    confirmedAt: null,
    projection: {
      conclusionStatus: 'supported',
      finalReading: 'El comité necesita comparar capacidad y urgencia antes de priorizar.',
      decisionInView: 'Qué iniciativas reciben capacidad durante este ciclo.',
      usableNow: [{ item: 'Datos de capacidad', howItCanHelp: 'Permiten acotar opciones.' }],
      decisionChangingUnknowns: [{ uncertainty: 'Falta confirmar una fecha.', whyItMatters: 'Puede cambiar la secuencia.' }],
      firstMovement: {
        movement: 'Revisar el corte de capacidad actual.',
        whyNow: 'Ese corte ya existe.',
        whatItMayClarify: 'Qué opciones caben en el ciclo.',
        boundary: 'No decide prioridades por sí solo.',
      },
    },
    ...overrides,
  };
}

function makeSupportedStarteriaPath(): StarteriaPathSupportedDto {
  return {
    conversionPresentation: { availability: 'NO_VERIFIED_DESTINATION', conversionConfigVersion: 1, destinations: [] },
    experienceState: 'SUPPORTED',
    starteriaPathStatus: 'SUPPORTED',
    valueBridge: {
      currentState: 'La decisión aún requiere comparar capacidad y urgencia.',
      starteriaContribution: [{
        statement: 'Starteria podría ordenar la información ya compartida.',
        capabilityClass: 'CAN_SUPPORT',
        availabilityState: 'REQUIRES_IMPLEMENTATION',
      }],
      tangibleOutcome: {
        statement: 'Una lectura estructurada que se pueda revisar.',
        observableArtifact: 'Vista con evidencia y dudas visibles.',
      },
      remainingDependency: [],
    },
    capabilityPath: [],
    dependencies: [],
    firstSupportedMovement: null,
    boundaryStatement: 'La organización conserva la decisión.',
    sourceBinding: {
      criticalHandoffId: 'critical-artifact-1',
      criticalHandoffVersion: 3,
      sourceContextRevision: 7,
      current: true,
      confirmed: true,
      projectionVersion: 'starteria-path-projection-v0.1',
      businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
      pathSchemaVersion: 'starteria-path-dto-v0.2',
    },
    versions: {
      pathSchemaVersion: 'starteria-path-dto-v0.2',
      projectionVersion: 'starteria-path-projection-v0.1',
      businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
    },
  };
}

function withLiveUnderstanding(session: PortfolioEntrySessionDto, liveUnderstanding: unknown): PortfolioEntrySessionDto {
  return { ...session, liveUnderstanding } as unknown as PortfolioEntrySessionDto;
}

function supportedLiveUnderstanding(reading: string) {
  return {
    state: 'supported_reading',
    reading,
    tensions: [],
    decision: { decisionToPrepare: 'Qué conviene aclarar a continuación.' },
    decisionChangingUnknowns: [],
  };
}

function sessionWithQuestion(): PortfolioEntrySessionDto {
  return makeSession({
    lifecycleStatus: 'CLARIFYING',
    revision: 1,
    nextAction: 'answer_clarification',
    conversation: [
      {
        id: 'turn-1',
        turnIndex: 0,
        userInput: 'Necesito ordenar mis iniciativas para comite.',
        respondedResolves: [],
        createdAt: new Date().toISOString(),
        emittedQuestions: [
          {
            id: 'q-1',
            question: 'Que decision necesitas habilitar con esta lectura?',
            reason_to_ask: 'Puede cambiar la decisión que necesitas preparar.',
            resolves: ['decision_need'],
            turn_index: 0,
            interaction_mode: 'quick_clarification',
            asked_at_budget_remaining: 2,
          },
        ],
      },
    ],
    clarification: {
      interactionMode: 'quick_clarification',
      quickQuestionBudget: 3,
      quickQuestionsAsked: 1,
      explorationRound: 0,
      questionsAskedCurrentRound: 1,
      previousQuestions: [],
      answeredGaps: [],
    },
  });
}

function sessionWithHandoff(overrides: Partial<PortfolioEntrySessionDto> = {}): PortfolioEntrySessionDto {
  return makeSession({
    lifecycleStatus: 'HANDOFF_READY',
    revision: 3,
    nextAction: 'review_handoff',
    handoffExperience: 'legacy',
    ...overrides,
  });
}

function explicitLegacyHandoffSession(overrides: Partial<PortfolioEntrySessionDto> = {}): PortfolioEntrySessionDto {
  return {
    ...sessionWithHandoff(overrides),
    handoff: {
      id: 'handoff-1',
      version: 1,
      status: 'ready_with_uncertainty',
      reviewDisposition: 'UNREVIEWED',
      handoff: makeHandoff(),
      createdAt: new Date().toISOString(),
    },
  };
}

describe('PortfolioEntryExperience', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    serviceMocks.authState.authLoading = false;
    serviceMocks.getPortfolioEntryCriticalHandoff.mockReset();
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(null);
    serviceMocks.getPortfolioEntryCriticalHandoffGeneration.mockReset();
    serviceMocks.getPortfolioEntryCriticalHandoffGeneration.mockResolvedValue(null);
    serviceMocks.getPortfolioEntryStarteriaPath.mockReset();
    serviceMocks.getPortfolioEntryHandoff.mockReset();
    serviceMocks.getPortfolioEntryHandoff.mockImplementation(async (sessionId: string) =>
      explicitLegacyHandoffSession({ id: sessionId }));
    navigateSpy.mockClear();
    vi.clearAllMocks();
  });

  it('shows the approved value promise only before a public first message', () => {
    render(<MemoryRouter><PortfolioEntryExperience showPublicPromise /></MemoryRouter>);

    expect(screen.getByTestId('portfolio-entry-pre-entry-promise')).toHaveTextContent('Encuentra por dónde empezar con lo que necesitas resolver');
    expect(screen.getByTestId('portfolio-entry-pre-entry-promise')).toHaveTextContent('propuesta provisional con sus incertidumbres');
    expect(screen.getByLabelText('¿Qué necesitas resolver, conseguir o entender?')).toBeInTheDocument();
    expect(screen.getByText('Puedes expresarlo con tus palabras.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analizar mi situación/i })).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-pre-entry-promise')).toHaveTextContent('hasta tres preguntas');
    expect(screen.getByTestId('portfolio-entry-pre-entry-promise')).not.toHaveTextContent('portafolio');
  });

  it.each(['synthesis_unavailable', 'no_supported_insight', 'insufficient_basis'] as const)(
    'recovers three confirmed answers and an honest %s checkpoint using GET only', async (state) => {
      const sessionId = '11111111-1111-4111-8111-111111111111';
      savePortfolioEntryCurrentSession({ sessionId, credential: 'entry-token' });
      const turns = Array.from({ length: 4 }, (_, index) => ({
        id: `turn-${index}`, turnIndex: index, userInput: `Texto ${index}`,
        emittedQuestions: [], matchedQuestionIds: index ? [`q-${index}`] : [],
        respondedResolves: [], createdAt: new Date().toISOString(),
      }));
      serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(makeSession({
        revision: 7, lifecycleStatus: 'CLARIFYING', nextAction: 'offer_guided_exploration',
        conversation: turns, clarification: { ...makeSession().clarification, quickQuestionsAsked: 3, checkpoint: 'quick' },
      }), { state, decisionChangingUnknowns: [] }));

      renderExperience();

      const recovery = await screen.findByTestId('portfolio-entry-recovery-status');
      expect(recovery).toHaveTextContent('3 respuestas');
      expect(recovery).toHaveTextContent('revisión 7');
      expect(recovery).toHaveTextContent('lectura');
      expect(screen.queryByTestId('critical-handoff-correction')).not.toBeInTheDocument();
      expect(screen.queryByText(/Ya tengo suficiente claridad/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ver mi propuesta de abordaje' })).toBeInTheDocument();
      expect(serviceMocks.getPortfolioEntrySession).toHaveBeenCalledTimes(1);
      expect(serviceMocks.submitPortfolioEntryMessage).not.toHaveBeenCalled();
      expect(serviceMocks.chooseGuidedExploration).not.toHaveBeenCalled();
    },
  );

  it('rehydrates after 409 without losing the draft or inventing a saved answer', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    savePortfolioEntryCurrentSession({ sessionId, credential: 'entry-token' });
    const initial = sessionWithQuestion();
    const latest = { ...initial, revision: 3 };
    serviceMocks.getPortfolioEntrySession.mockResolvedValueOnce(initial).mockResolvedValueOnce(latest);
    serviceMocks.submitPortfolioEntryMessage.mockRejectedValue({ kind: 'conflict', status: 409 });
    renderExperience();
    const answer = await screen.findByRole('textbox', { name: 'Tu respuesta' });
    fireEvent.change(answer, { target: { value: 'Mi respuesta sin reenviar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    await waitFor(() => expect(screen.getByTestId('portfolio-entry-recovery-status')).toHaveTextContent('revisión 3'));
    expect(answer).toHaveValue('Mi respuesta sin reenviar');
    expect(screen.getByTestId('portfolio-entry-recovery-status')).toHaveTextContent('No puedo verificar');
    expect(screen.queryByTestId('critical-handoff-correction')).not.toBeInTheDocument();
    expect(serviceMocks.getPortfolioEntrySession).toHaveBeenCalledTimes(2);
    expect(serviceMocks.submitPortfolioEntryMessage).toHaveBeenCalledTimes(1);
  });

  it('uses a supported decision as contextual goal and keeps answer actions before the one full reading', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const session = sessionWithQuestion();
    const understanding = supportedLiveUnderstanding('La lectura sustentada completa permanece disponible.');
    understanding.decision.decisionToPrepare = 'Decidir qué iniciativas comparar antes del comité.';
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(session, understanding));

    render(<MemoryRouter><PortfolioEntryExperience showPublicPromise /></MemoryRouter>);

    const goal = await screen.findByTestId('portfolio-entry-contextual-goal');
    expect(goal).toHaveAttribute('data-source', 'supported_reading.decision');
    expect(goal).toHaveTextContent('Decidir qué iniciativas comparar antes del comité.');
    expect(screen.queryByTestId('portfolio-entry-pre-entry-promise')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-active-question-reason')).toHaveTextContent('Puede cambiar la decisión que necesitas preparar.');
    const panel = screen.getByTestId('portfolio-entry-conversation-panel');
    const question = within(panel).getByTestId('portfolio-entry-active-question');
    const answer = within(panel).getByLabelText('Tu respuesta');
    const action = within(panel).getByRole('button', { name: /enviar respuesta/i });
    const reading = within(panel).getByTestId('portfolio-entry-live-understanding');
    expect(question.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(answer.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(action.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(panel).getAllByTestId('portfolio-entry-live-understanding')).toHaveLength(1);
  });

  it.each(['no_supported_insight', 'insufficient_basis', 'synthesis_unavailable'] as const)(
    'omits an unsupported contextual goal for an explicit portfolio need in %s', async (state) => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const session = sessionWithQuestion();
    session.conversation[0]!.userInput = 'Tengo 27 iniciativas y necesito decidir cuáles financiar o pausar antes del comité.';
    session.semanticProjection.understanding = { value: 'Un inventario extraído no es un objetivo.', source: 'latestAnalysis.extracted_context' };
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(session, {
      state,
      decision: { decisionToPrepare: 'Objetivo no sustentado que no debe salir.' },
      decisionChangingUnknowns: [{ uncertainty: 'Falta confirmar el criterio.', whyItMatters: 'Puede cambiar la decisión.' }],
    }));

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-active-question-text')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-contextual-goal')).not.toBeInTheDocument();
    expect(screen.queryByText(/Todavía no tengo claro qué necesitas resolver/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Objetivo no sustentado que no debe salir.')).not.toBeInTheDocument();
    expect(screen.queryByText('Un inventario extraído no es un objetivo.')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-active-question-reason')).toHaveTextContent('Puede cambiar la decisión que necesitas preparar.');
    if (state === 'no_supported_insight') {
      expect(screen.getByTestId('portfolio-entry-live-understanding')).toHaveTextContent('Falta confirmar el criterio. Puede cambiar la decisión.');
    }
    expect(screen.queryByRole('button', { name: /esto no refleja lo que quise decir/i })).not.toBeInTheDocument();
  });

  it('waits for auth hydration before recovering a claimed session', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    saveClaimedPortfolioEntrySession({ sessionId });
    serviceMocks.authState.authLoading = true;
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED',
      revision: 9,
      ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      confirmation: { id: 'confirmation-1', version: 1, status: 'CONFIRMED', acceptedFields: ['understanding'], correctedFields: {}, rejectedFields: [], createdAt: new Date().toISOString() },
    }));

    const view = renderExperience();

    expect(serviceMocks.getClaimedPortfolioEntrySession).not.toHaveBeenCalled();
    act(() => {
      serviceMocks.authState.authLoading = false;
      view.rerender(
        <MemoryRouter>
          <PortfolioEntryExperience />
        </MemoryRouter>,
      );
    });

    expect(serviceMocks.getClaimedPortfolioEntrySession).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('portfolio-entry-confirmed-brief-actions')).toBeInTheDocument();
    expect(serviceMocks.getClaimedPortfolioEntrySession).toHaveBeenCalledTimes(1);
    expect(serviceMocks.getClaimedPortfolioEntrySession).toHaveBeenCalledWith(sessionId);
  });

  it('recovers the claimed Brief before a stale anonymous current-session credential', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    savePortfolioEntryCurrentSession({ sessionId, credential: 'stale-anonymous-credential' });
    saveClaimedPortfolioEntrySession({ sessionId });
    serviceMocks.getPortfolioEntrySession.mockRejectedValue({ kind: 'expired', status: 410 });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED',
      revision: 9,
      ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      confirmation: { id: 'confirmation-1', version: 1, status: 'CONFIRMED', acceptedFields: ['understanding'], correctedFields: {}, rejectedFields: [], createdAt: new Date().toISOString() },
    }));

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-confirmed-brief-actions')).toBeInTheDocument();
    expect(serviceMocks.getClaimedPortfolioEntrySession).toHaveBeenCalledWith(sessionId);
    expect(serviceMocks.getPortfolioEntrySession).not.toHaveBeenCalled();
  });

  it('exports only confirmed handoff fields and never substitutes rawEntry', () => {
    const session = explicitLegacyHandoffSession({
      lifecycleStatus: 'CONFIRMED',
      revision: 17,
      confirmation: {
        id: 'confirmation-1', version: 1, status: 'CONFIRMED',
        acceptedFields: ['desired_outcome', 'understanding', 'decision_to_enable'],
        correctedFields: {}, rejectedFields: [], createdAt: new Date().toISOString(),
      },
    });
    const exported = serializeConfirmedBriefMarkdown(session);
    expect(exported.filename).toBe('starteria-brief-r17.md');
    expect(exported.markdown).toContain('Qué quiero lograr');
    expect(exported.markdown).toContain('Situación y entendimiento');
    expect(exported.markdown).toContain('Decisión a preparar');
    expect(exported.markdown).not.toContain('Propuesta de Starteria');
    expect(exported.markdown).not.toContain('rawEntry');
    expect(() => serializeConfirmedBriefMarkdown(makeSession({ lifecycleStatus: 'HANDOFF_READY' }))).toThrow(/confirmed Brief/i);
  });

  it('requires explicit confirmation before delete and then abandons the confirmed Brief', async () => {
    saveClaimedPortfolioEntrySession({ sessionId: '11111111-1111-4111-8111-111111111111' });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED', revision: 8, ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      confirmation: { id: 'confirmation-1', version: 1, status: 'CONFIRMED', acceptedFields: ['understanding'], correctedFields: {}, rejectedFields: [], createdAt: new Date().toISOString() },
    }));
    serviceMocks.abandonPortfolioEntrySession.mockResolvedValue({ sessionId: '11111111-1111-4111-8111-111111111111', lifecycleStatus: 'ABANDONED', revision: 9 });
    renderExperience();
    await waitFor(() => expect(serviceMocks.getPortfolioEntryHandoff).toHaveBeenCalled());
    const actions = await screen.findByTestId('portfolio-entry-confirmed-brief-actions');
    fireEvent.click(within(actions).getByRole('button', { name: 'Eliminar' }));
    expect(serviceMocks.abandonPortfolioEntrySession).not.toHaveBeenCalled();
    fireEvent.click(within(actions).getByRole('button', { name: 'Sí, eliminar' }));
    await screen.findByText('Lectura eliminada');
    expect(serviceMocks.abandonPortfolioEntrySession).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', expect.objectContaining({ expectedRevision: 8 }));
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();
  });

  it('downloads a confirmed Markdown Brief without calling lifecycle or Portfolio mutation services', async () => {
    saveClaimedPortfolioEntrySession({ sessionId: '11111111-1111-4111-8111-111111111111' });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED', revision: 12, ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      confirmation: { id: 'confirmation-1', version: 1, status: 'CONFIRMED', acceptedFields: ['desired_outcome', 'understanding', 'decision_to_enable'], correctedFields: {}, rejectedFields: [], createdAt: new Date().toISOString() },
    }));
    const originalCreateUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const createUrl = vi.fn().mockReturnValue('blob:confirmed-brief');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderExperience();
    await waitFor(() => expect(serviceMocks.getPortfolioEntryHandoff).toHaveBeenCalled());
    const actions = await screen.findByTestId('portfolio-entry-confirmed-brief-actions');
    const downloadButton = within(actions).getByRole('button', { name: 'Descargar' });
    await waitFor(() => expect(downloadButton).toBeEnabled());
    fireEvent.click(downloadButton);
    expect(click).toHaveBeenCalledOnce();
    expect((createUrl.mock.calls[0][0] as Blob).type).toBe('text/markdown;charset=utf-8');
    expect(createUrl.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(serviceMocks.abandonPortfolioEntrySession).not.toHaveBeenCalled();
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('La Entry permanece sin cambios');
    if (originalCreateUrl) Object.defineProperty(URL, 'createObjectURL', originalCreateUrl);
    else delete (URL as typeof URL & { createObjectURL?: unknown }).createObjectURL;
    if (originalRevokeUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeUrl);
    else delete (URL as typeof URL & { revokeObjectURL?: unknown }).revokeObjectURL;
    click.mockRestore();
  });

  it('keeps public examples editable before explicit analysis', () => {
    renderExperience();

    fireEvent.click(screen.getByRole('button', { name: /tengo varias iniciativas/i }));

    const input = screen.getByLabelText(/necesitas conseguir/i);
    expect(input).toHaveValue('Tengo varias iniciativas y necesito entender cuales realmente contribuyen a nuestros objetivos.');

    fireEvent.change(input, {
      target: { value: 'Necesito ordenar iniciativas para decidir que sigue.' },
    });

    expect(input).toHaveValue('Necesito ordenar iniciativas para decidir que sigue.');
    expect(serviceMocks.createPortfolioEntrySession).not.toHaveBeenCalled();
  });

  it('creates a session, submits the first message and renders quick clarification from backend DTO', async () => {
    serviceMocks.createPortfolioEntrySession.mockResolvedValue({
      session: makeSession(),
      publicAccessToken: 'entry-token',
    });
    serviceMocks.submitPortfolioEntryMessage.mockResolvedValue(sessionWithQuestion());

    renderExperience();

    fireEvent.change(screen.getByLabelText(/necesitas conseguir/i), {
      target: { value: 'Necesito ordenar mis iniciativas antes del comite de direccion.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analizar mi situ/i }));
    await screen.findByText(/Aclaraci.*breve/i);
    const clarificationLabel = await screen.findByText('Una pregunta para avanzar');
    const currentClarification = within(clarificationLabel.parentElement as HTMLElement);
    expect(await currentClarification.findByText(/que decision necesitas habilitar/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Progreso de aclaración')).not.toBeInTheDocument();
    expect(screen.queryByText(/Aclaración 1 de hasta 3/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('portfolio-entry-quick-question-budget-note')).toHaveLength(1);
    expect(screen.getByTestId('portfolio-entry-quick-question-budget-note')).toHaveTextContent(
      'La aclaración inicial puede requerir hasta tres preguntas, solo si aportan valor. Si después se ofrece profundizar, tú decides; esa exploración es aparte',
    );
    expect(currentClarification.getByTestId('portfolio-entry-active-question-reason')).toHaveTextContent(
      'Puede cambiar la decisión que necesitas preparar.',
    );
    expect(currentClarification.getAllByTestId('portfolio-entry-active-question-reason')).toHaveLength(1);
    expect(serviceMocks.submitPortfolioEntryMessage).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'entry-token',
      expect.objectContaining({
        expectedRevision: 0,
        message: 'Necesito ordenar mis iniciativas antes del comite de direccion.',
      }),
    );
  });

  it('answers clarification without calculating backend semantic fields', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithQuestion());
    serviceMocks.submitPortfolioEntryMessage.mockResolvedValue(makeSession({
      lifecycleStatus: 'CLARIFYING',
      revision: 2,
      nextAction: 'answer_clarification',
    }));

    renderExperience();

    fireEvent.change(await screen.findByLabelText(/tu respuesta/i), {
      target: { value: 'Necesito decidir que iniciativas mantener este trimestre.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar respuesta/i }));

    await waitFor(() => {
      expect(serviceMocks.submitPortfolioEntryMessage).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'entry-token',
        expect.objectContaining({
          matchedQuestionIds: ['q-1'],
        }),
      );
    });
  });

  it('uses only the current Quick question and keeps the one-time budget note out of later turns', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const thirdTurn = sessionWithQuestion();
    thirdTurn.clarification.quickQuestionsAsked = 3;
    thirdTurn.conversation.push({
      ...thirdTurn.conversation[0],
      id: 'turn-3',
      turnIndex: 2,
      userInput: 'Ahora hay evidencia adicional.',
      emittedQuestions: [{
        ...thirdTurn.conversation[0].emittedQuestions[0],
        id: 'q-3',
        question: '¿Quién puede confirmar la evidencia disponible?',
        reason_to_ask: 'Esto puede cambiar qué se puede concluir.',
        turn_index: 2,
      }],
    });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(thirdTurn);

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-active-question-text')).toHaveTextContent('¿Quién puede confirmar la evidencia disponible?');
    expect(screen.getByTestId('portfolio-entry-active-question-reason')).toHaveTextContent('Esto puede cambiar qué se puede concluir.');
    expect(screen.getByRole('textbox', { name: /tu respuesta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar respuesta/i })).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-quick-question-budget-note')).not.toBeInTheDocument();
    expect(screen.queryByText(/Aclaración 3 de hasta 3/i)).not.toBeInTheDocument();
  });

  it('keeps the active clarification as the main next action when basis is insufficient', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(sessionWithQuestion(), {
      state: 'insufficient_basis',
      decisionChangingUnknowns: [],
    }));

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-active-question')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /tu respuesta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar respuesta/i })).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-live-understanding'))
      .toHaveTextContent('Todavía falta contexto para ofrecer una lectura útil.');
  });

  it('does not invent an insight for “Queremos innovar más”', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const ambiguous = sessionWithQuestion();
    if (ambiguous.conversation[0]) ambiguous.conversation[0].userInput = 'Queremos innovar más.';
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(ambiguous, {
      state: 'no_supported_insight',
      decisionChangingUnknowns: [],
    }));

    renderExperience();

    const panel = await screen.findByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveTextContent(/todavía no tiene suficiente base para compartir una lectura útil/i);
    expect(panel).not.toHaveTextContent(/tensión|la decisión que parece|cartera|iniciativas/i);
    expect(screen.getByTestId('portfolio-entry-active-question-text')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /tu respuesta/i })).toBeInTheDocument();
  });

  it('hides the previous reading while a submitted answer is being synthesized', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(
      sessionWithQuestion(),
      supportedLiveUnderstanding('Lectura anterior que ya no debe parecer vigente.'),
    ));
    let resolveMessage: ((session: PortfolioEntrySessionDto) => void) | undefined;
    serviceMocks.submitPortfolioEntryMessage.mockImplementation(() => new Promise((resolve) => {
      resolveMessage = resolve;
    }));

    renderExperience();

    const answer = await screen.findByRole('textbox', { name: /tu respuesta/i });
    expect(screen.getByTestId('portfolio-entry-live-understanding'))
      .toHaveTextContent('Lectura anterior que ya no debe parecer vigente.');
    fireEvent.change(answer, { target: { value: 'La decisión depende de la capacidad que tengamos disponible.' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar respuesta/i }));

    expect(await screen.findByTestId('portfolio-entry-live-understanding'))
      .toHaveTextContent('Estamos actualizando esta lectura con tu mensaje.');
    expect(screen.queryByTestId('portfolio-entry-contextual-goal')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-active-question')).toBeInTheDocument();
    expect(screen.queryByText('Lectura anterior que ya no debe parecer vigente.')).not.toBeInTheDocument();

    await act(async () => {
      resolveMessage?.(withLiveUnderstanding(sessionWithQuestion(), supportedLiveUnderstanding('La nueva lectura refleja la capacidad disponible.')));
    });
    expect(await screen.findByText('La nueva lectura refleja la capacidad disponible.')).toBeInTheDocument();
  });

  it('submits a Live Understanding correction as user-authored intent and replaces the old reading from the response', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(
      sessionWithQuestion(),
      supportedLiveUnderstanding('Starteria entendió que hay que ordenar toda la cartera.'),
    ));
    const corrected = sessionWithQuestion();
    corrected.revision = 2;
    corrected.conversation = [
      ...corrected.conversation,
      {
        id: 'turn-correction',
        turnIndex: 1,
        userInput: 'La lectura no refleja lo que quise decir: me refiero a esta iniciativa.',
        emittedQuestions: [{
          id: 'q-corrected', question: '¿Qué resultado necesita validar esta iniciativa?', resolves: ['outcome'],
          turn_index: 1, interaction_mode: 'quick_clarification', asked_at_budget_remaining: 2,
        }],
        matchedQuestionIds: [], respondedResolves: [], createdAt: new Date().toISOString(),
      },
    ];
    serviceMocks.submitPortfolioEntryMessage.mockResolvedValue(withLiveUnderstanding(
      corrected,
      supportedLiveUnderstanding('En esta iniciativa, la validación depende del acceso a datos reales.'),
    ));

    renderExperience();

    fireEvent.click(await screen.findByRole('button', { name: /esto no refleja lo que quise decir/i }));
    expect(screen.queryByTestId('portfolio-entry-contextual-goal')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-active-question-reason')).toHaveTextContent('Puede cambiar la decisión que necesitas preparar.');
    const correction = screen.getByRole('textbox', { name: /tu corrección/i });
    fireEvent.change(correction, { target: { value: 'La lectura no refleja lo que quise decir: me refiero a esta iniciativa.' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar corrección/i }));

    expect(await screen.findByText('En esta iniciativa, la validación depende del acceso a datos reales.')).toBeInTheDocument();
    expect(screen.queryByText('Starteria entendió que hay que ordenar toda la cartera.')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-active-question-text'))
      .toHaveTextContent('¿Qué resultado necesita validar esta iniciativa?');
    expect(serviceMocks.submitPortfolioEntryMessage).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'entry-token',
      expect.objectContaining({
        expectedRevision: 1,
        intent: 'correction',
        message: 'La lectura no refleja lo que quise decir: me refiero a esta iniciativa.',
        idempotencyKey: expect.stringContaining('portfolio-entry:live-understanding-correction:'),
      }),
    );
    expect(serviceMocks.submitPortfolioEntryMessage.mock.calls[0]?.[2]).not.toHaveProperty('matchedQuestionIds');
  });

  it('reopens clarification after a checkpoint correction and removes the stale checkpoint choices', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const checkpoint = makeSession({
      lifecycleStatus: 'CLARIFYING', revision: 4, nextAction: 'offer_guided_exploration',
    });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(
      checkpoint,
      supportedLiveUnderstanding('La lectura actual del checkpoint.')),
    );
    const reopened = sessionWithQuestion();
    reopened.revision = 5;
    reopened.conversation = [{
      id: 'turn-reopened', turnIndex: 1,
      userInput: 'La lectura no refleja lo que quise decir.',
      emittedQuestions: [{
        id: 'q-reopened', question: '¿Qué aspecto de esta iniciativa quieres precisar?', resolves: ['situation'],
        turn_index: 1, interaction_mode: 'quick_clarification', asked_at_budget_remaining: 2,
      }],
      matchedQuestionIds: [], respondedResolves: [], createdAt: new Date().toISOString(),
    }];
    let resolveCorrection: ((session: PortfolioEntrySessionDto) => void) | undefined;
    serviceMocks.submitPortfolioEntryMessage.mockImplementation(() => new Promise((resolve) => {
      resolveCorrection = resolve;
    }));

    renderExperience();

    fireEvent.click(await screen.findByRole('button', { name: /esto no refleja lo que quise decir/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /tu corrección/i }), {
      target: { value: 'La lectura no refleja lo que quise decir.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar corrección/i }));

    expect(await screen.findByTestId('portfolio-entry-live-understanding'))
      .toHaveTextContent('Estamos actualizando esta lectura con tu mensaje.');
    expect(screen.queryByRole('button', { name: /ver mi propuesta de abordaje/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /seguir aterrizando mi necesidad/i })).not.toBeInTheDocument();

    await act(async () => {
      resolveCorrection?.(withLiveUnderstanding(reopened, supportedLiveUnderstanding('La lectura corregida para esta iniciativa.')));
    });

    expect(await screen.findByTestId('portfolio-entry-active-question-text'))
      .toHaveTextContent('¿Qué aspecto de esta iniciativa quieres precisar?');
    expect(screen.queryByText(/Ya tengo suficiente claridad para proponerte/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver mi propuesta de abordaje/i })).not.toBeInTheDocument();
    expect(screen.queryByText('La lectura actual del checkpoint.')).not.toBeInTheDocument();
    expect(screen.getByText('La lectura corregida para esta iniciativa.')).toBeInTheDocument();
  });

  it('does not render the Live Understanding surface inside the 114D handoff review', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(
      sessionWithHandoff(),
      supportedLiveUnderstanding('La lectura provisional que no debe invadir el handoff.'),
    ));

    renderExperience();

    expect(await screen.findByTestId('handoff-expanded-analysis')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-live-understanding')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /esto no refleja lo que quise decir/i })).not.toBeInTheDocument();
  });

  it('reveals the persisted conversation trace without exposing internal metadata', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(makeSession({
      lifecycleStatus: 'CLARIFYING',
      revision: 2,
      nextAction: 'answer_clarification',
      conversation: [
        {
          id: 'turn-1',
          turnIndex: 0,
          userInput: 'Tenemos 18 iniciativas y necesitamos decidir dÃƒÂ³nde concentrar seguimiento.',
          respondedResolves: [],
          createdAt: new Date().toISOString(),
          emittedQuestions: [{
            id: 'q-1',
            question: 'Ã‚Â¿QuÃƒÂ© decisiÃƒÂ³n necesita habilitar esta lectura?',
            resolves: ['decision_to_enable'],
            turn_index: 0,
            interaction_mode: 'quick_clarification',
            asked_at_budget_remaining: 3,
          }],
        },
        {
          id: 'turn-2',
          turnIndex: 1,
          userInput: 'Necesitamos decidir quÃƒÂ© iniciativas deben recibir seguimiento este trimestre.',
          respondedResolves: ['decision_to_enable'],
          createdAt: new Date().toISOString(),
          emittedQuestions: [],
        },
      ],
    }));

    renderExperience();

    expect(await screen.findByText('Tu contexto inicial')).toBeInTheDocument();
    expect(screen.queryByText('Lo que estamos aclarando ahora')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText(/Ver conversaci/i));
    const trace = within(screen.getByTestId('portfolio-entry-conversation-trace'));
    expect(trace.getByText(/Tenemos 18 iniciativas/)).toBeInTheDocument();
    expect(trace.getByText(/QuÃƒÂ© decisiÃƒÂ³n necesita habilitar/)).toBeInTheDocument();
    expect(trace.getByText(/quÃƒÂ© iniciativas deben recibir seguimiento/)).toBeInTheDocument();
    expect(screen.queryByText('q-1')).not.toBeInTheDocument();
    expect(screen.queryByText('decision_to_enable')).not.toBeInTheDocument();
  });

  it('renders Guided Exploration with explicit checkpoint choices', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(makeSession({
      lifecycleStatus: 'CLARIFYING',
      revision: 2,
      nextAction: 'offer_guided_exploration',
    }));
    serviceMocks.chooseGuidedExploration.mockResolvedValue(sessionWithQuestion());

    renderExperience();

    expect(await screen.findByRole('button', { name: /ver mi propuesta de abordaje/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /seguir aterrizando mi necesidad/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver mi lectura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /profundizar un poco mas/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /seguir aterrizando mi necesidad/i }));

    await waitFor(() => {
      expect(serviceMocks.chooseGuidedExploration).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'entry-token',
        expect.objectContaining({ expectedRevision: 2, choice: 'accept' }),
      );
    });
  });

  it('renders the second checkpoint without offering another Guided Exploration round', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(makeSession({
      lifecycleStatus: 'CLARIFYING',
      revision: 4,
      nextAction: 'offer_guided_exploration',
      clarification: {
        interactionMode: 'guided_exploration',
        quickQuestionBudget: 3,
        quickQuestionsAsked: 3,
        explorationRound: 1,
        questionsAskedCurrentRound: 2,
        previousQuestions: [],
        answeredGaps: [],
        checkpoint: 'guided',
      },
    }));
    serviceMocks.chooseGuidedExploration.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'HANDOFF_READY',
      revision: 5,
      nextAction: 'review_handoff',
    }));

    renderExperience();

    expect(await screen.findByText(/Puedes revisar una propuesta provisional con lo que compartiste/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver mi propuesta de abordaje/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /seguir aterrizando mi necesidad/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ver mi propuesta de abordaje/i }));
    await waitFor(() => {
      expect(serviceMocks.chooseGuidedExploration).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'entry-token',
        expect.objectContaining({ expectedRevision: 4, choice: 'provisional_route' }),
      );
    });
  });

  it('labels the active Guided Exploration question as deepening, not Quick Clarification', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const session = sessionWithQuestion();
    session.clarification = {
      ...session.clarification,
      interactionMode: 'guided_exploration',
      quickQuestionsAsked: 3,
      explorationRound: 1,
      questionsAskedCurrentRound: 1,
    };
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(session);

    renderExperience();
    expect((await screen.findAllByText(/Exploraci.*guiada/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Profundizando.*1 de hasta 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tu respuesta/i)).toBeInTheDocument();
  });

  it('does not render an answer composer when the backend has no active question', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(makeSession({
      lifecycleStatus: 'CLARIFYING',
      revision: 2,
      nextAction: 'answer_clarification',
      conversation: [
        {
          id: 'turn-0', turnIndex: 0, userInput: 'Tenemos varias iniciativas.', matchedQuestionIds: [],
          respondedResolves: [], createdAt: new Date().toISOString(),
          emittedQuestions: [{
            id: 'q-retired', question: '¿Qué decisión necesitas habilitar?', reason_to_ask: 'Explicación anterior.',
            resolves: [], turn_index: 0, interaction_mode: 'quick_clarification', asked_at_budget_remaining: 3,
          }],
        },
        {
          id: 'turn-1', turnIndex: 1, userInput: 'Ya respondí.', matchedQuestionIds: ['q-retired'],
          respondedResolves: [], createdAt: new Date().toISOString(), emittedQuestions: [],
        },
      ],
    }));

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-inconsistent-state')).toBeInTheDocument();
    expect(screen.queryByLabelText(/tu respuesta/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar respuesta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /no lo se todavia/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-active-question-reason')).not.toBeInTheDocument();
  });

  it('keeps one supported reading and the active question without rendering the extracted-field inventory', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithQuestion());
    const session = sessionWithQuestion();
    session.semanticProjection.understanding = {
      value: 'AsÃƒÂ­ estoy entendiendo lo que me dices: portafolio: 40 iniciativas; decisiÃƒÂ³n: priorizar esfuerzo. TambiÃƒÂ©n aparece situaciÃƒÂ³n: comitÃƒÂ© de negocio.',
      source: 'latestAnalysis.extracted_context',
    };
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(withLiveUnderstanding(session, supportedLiveUnderstanding('La conversación con dirección necesita una base común para comparar los reportes.')));

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-active-question')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-understanding')).not.toBeInTheDocument();
    expect(screen.queryByText(/portafolio: 40 iniciativas/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('portfolio-entry-live-understanding')).toHaveLength(1);
    expect(screen.getByTestId('portfolio-entry-live-understanding')).toHaveTextContent('La conversación con dirección necesita una base común');
    expect(screen.getByTestId('portfolio-entry-active-question')).toBeInTheDocument();
    expect(screen.getByLabelText(/tu respuesta/i)).toBeInTheDocument();
  });

  it('omits the synthesis block when the session has no structured understanding', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithQuestion());

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-active-question')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-understanding')).not.toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-live-understanding')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/tu respuesta/i)).toBeInTheDocument();
  });

  it.each([null, undefined, '', '   '])('hides an absent reason_to_ask (%s)', async (reason) => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const session = sessionWithQuestion();
    const question = session.conversation[0]?.emittedQuestions[0];
    if (question) question.reason_to_ask = reason as string | null | undefined;
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(session);

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-active-question')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-active-question-reason')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('portfolio-entry-active-question-text')).toHaveLength(1);
  });

  it('materializes current Critical Handoff through its safe endpoint and routes confirmation through identity only', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    savePortfolioEntryCurrentSession({ sessionId, credential: 'entry-token' });
    markCriticalHandoffReviewSession(sessionId);
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    }));
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());
    serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({
      sessionRevision: 3,
      criticalHandoff: makeCriticalHandoff(),
    });
    serviceMocks.confirmPortfolioEntryHandoff.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED',
      revision: 4,
      nextAction: 'claim_or_close',
      confirmation: {
        id: 'confirmation-1',
        version: 1,
        status: 'CONFIRMED',
        acceptedFields: ['understanding.value'],
        correctedFields: {},
        rejectedFields: [],
        confirmedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    }));

    renderExperience();
    expect(await screen.findByTestId('critical-handoff-review')).toBeInTheDocument();
    expect(screen.getByText('El comité necesita comparar capacidad y urgencia antes de priorizar.')).toBeInTheDocument();
    expect(screen.queryByTestId('handoff-starteria-path-expanded')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ruta sugerida|Cómo lo abordaría Starteria|Portfolio Setup/i)).not.toBeInTheDocument();
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);
    expect(serviceMocks.materializePortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.getPortfolioEntryCriticalHandoff).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'entry-token');
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff.mock.invocationCallOrder[0])
      .toBeLessThan(serviceMocks.getPortfolioEntryCriticalHandoff.mock.invocationCallOrder[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión para confirmar esta lectura' }));

    expect(navigateSpy).toHaveBeenCalledWith('/auth');
    expect(serviceMocks.confirmPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.correctPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();
    expect(readPendingPortfolioEntryClaim()).toEqual({
      sessionId: '11111111-1111-4111-8111-111111111111',
      credential: 'entry-token',
      criticalHandoffReview: true,
    });
    expect(readPendingPortfolioEntryClaim()).not.toHaveProperty('identity');
  });

  it('explicitly confirms the reviewed current artifact after claim and stays on the confirmed review', async () => {
    const claimed = sessionWithHandoff({
      lifecycleStatus: 'HANDOFF_READY',
      revision: 9,
      nextAction: 'claim_or_close',
      ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      handoffExperience: 'critical',
    });
    saveClaimedPortfolioEntrySession({ sessionId: claimed.id });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(claimed);
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());
    serviceMocks.confirmPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff({
      confirmationState: 'confirmed',
      confirmedAt: '2026-10-09T12:00:00.000Z',
    }));
    serviceMocks.getPortfolioEntryStarteriaPath.mockResolvedValue(makeSupportedStarteriaPath());

    renderExperience();

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar esta lectura' }));

    await waitFor(() => expect(serviceMocks.confirmPortfolioEntryCriticalHandoff).toHaveBeenCalledWith(
      claimed.id,
      expect.objectContaining({
        artifactId: 'critical-artifact-1',
        expectedArtifactVersion: 3,
        expectedContextRevision: 7,
        idempotencyKey: expect.any(String),
      }),
    ));
    expect(await screen.findByTestId('critical-handoff-confirmed')).toHaveTextContent(/representa suficientemente tu situaci[oó]n/i);
    expect(await screen.findByRole('heading', { name: 'Así puede ayudarte Starteria' })).toBeInTheDocument();
    expect(serviceMocks.getPortfolioEntryStarteriaPath).toHaveBeenCalledWith(claimed.id);
    expect(screen.getByText('Una lectura estructurada que se pueda revisar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar esta lectura' })).not.toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();
    expect(serviceMocks.confirmPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.correctPortfolioEntryHandoff).not.toHaveBeenCalled();
  });

  it.each([
    { status: 401, kind: 'unauthorized', requestState: 'error', message: 'No pudimos verificar el acceso a esta lectura.' },
    { status: 404, kind: 'not_found', requestState: 'missing', message: 'No hay una lectura confirmada disponible para mostrar esta experiencia.' },
    { status: 503, kind: 'unavailable', requestState: 'error', message: 'No pudimos cargar esta experiencia. Puedes intentarlo de nuevo.' },
  ])('handles Starteria Path API $status without presenting supported content', async ({ status, kind, requestState, message }) => {
    const claimed = sessionWithHandoff({
      lifecycleStatus: 'HANDOFF_READY',
      revision: 9,
      nextAction: 'claim_or_close',
      ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      handoffExperience: 'critical',
    });
    saveClaimedPortfolioEntrySession({ sessionId: claimed.id });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(claimed);
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff({ confirmationState: 'confirmed' }));
    serviceMocks.getPortfolioEntryStarteriaPath.mockRejectedValue({ status, kind });

    renderExperience();

    expect(await screen.findByTestId(`starteria-path-${requestState}`)).toHaveTextContent(message);
    expect(screen.queryByRole('heading', { name: 'Así puede ayudarte Starteria' })).not.toBeInTheDocument();
    expect(serviceMocks.getPortfolioEntryStarteriaPath).toHaveBeenCalledWith(claimed.id);
    expect(navigateSpy).not.toHaveBeenCalled();

    if (status === 401 || status === 404) {
      expect(screen.queryByRole('button', { name: 'Intentar de nuevo' })).not.toBeInTheDocument();
    } else {
      serviceMocks.getPortfolioEntryStarteriaPath.mockResolvedValueOnce(makeSupportedStarteriaPath());
      fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
      expect(await screen.findByRole('heading', { name: 'Así puede ayudarte Starteria' })).toBeInTheDocument();
      expect(serviceMocks.getPortfolioEntryStarteriaPath).toHaveBeenCalledTimes(2);
    }
  });

  it('shows a bounded stale conflict without navigating or selecting a continuation', async () => {
    const claimed = sessionWithHandoff({
      lifecycleStatus: 'HANDOFF_READY',
      revision: 9,
      nextAction: 'claim_or_close',
      ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      handoffExperience: 'critical',
    });
    saveClaimedPortfolioEntrySession({ sessionId: claimed.id });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(claimed);
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());
    serviceMocks.confirmPortfolioEntryCriticalHandoff.mockRejectedValue({ kind: 'conflict', status: 409 });

    renderExperience();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar esta lectura' }));

    expect(await screen.findByTestId('critical-handoff-conflict')).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();
    expect(serviceMocks.convertPortfolioEntrySession).not.toHaveBeenCalled();
  });

  it('does not fall back to legacy review when a newly materialized Critical Handoff is absent', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    savePortfolioEntryCurrentSession({ sessionId, credential: 'entry-token' });
    markCriticalHandoffReviewSession(sessionId);
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(makeSession({ nextAction: 'generate_handoff', revision: 2, handoffExperience: 'critical' }));
    serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({ sessionRevision: 3, criticalHandoff: makeCriticalHandoff() });
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(null);

    renderExperience();

    expect(await screen.findByTestId('critical-handoff-absent')).toBeInTheDocument();
    expect(screen.queryByTestId('handoff-expanded-analysis')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cómo lo abordaría Starteria|Ruta sugerida|Portfolio Setup/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a aclarar' })).toBeInTheDocument();
    expect(serviceMocks.getPortfolioEntryHandoff).not.toHaveBeenCalled();
  });

  it('returns Critical Handoff correction through the reasoning message lifecycle and does not edit projection fields', async () => {
    const reviewSession = sessionWithHandoff({ nextAction: 'review_handoff', revision: 4, handoffExperience: 'critical' });
    savePortfolioEntryCurrentSession({ sessionId: reviewSession.id, credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(reviewSession);
    serviceMocks.getPortfolioEntryCriticalHandoff
      .mockResolvedValueOnce(makeCriticalHandoff())
      .mockResolvedValueOnce({ ...makeCriticalHandoff(), state: 'stale' });
    serviceMocks.submitPortfolioEntryMessage.mockResolvedValue(makeSession({
      id: reviewSession.id,
      revision: 5,
      nextAction: 'answer_clarification',
      lifecycleStatus: 'CLARIFYING',
    }));

    renderExperience();

    expect(await screen.findByTestId('critical-handoff-review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Esto no refleja suficientemente mi situación' }));
    const correction = await screen.findByRole('textbox', { name: '¿Qué deberíamos entender mejor?' });
    expect(correction).toHaveFocus();
    fireEvent.change(correction, { target: { value: 'La capacidad disponible cambia antes del comité.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Volver a aclarar' }));

    await waitFor(() => expect(serviceMocks.submitPortfolioEntryMessage).toHaveBeenCalledWith(
      reviewSession.id,
      'entry-token',
      expect.objectContaining({
        expectedRevision: 4,
        message: 'La capacidad disponible cambia antes del comité.',
        intent: 'correction',
      }),
    ));
    expect(serviceMocks.correctPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.confirmPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();
    expect(serviceMocks.getPortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('critical-handoff-review')).not.toBeInTheDocument();
    expect(screen.getByText(/La lectura anterior ya no está vigente/)).toBeInTheDocument();
  });

  it('keeps a historical legacy session on the legacy review when no Critical Handoff exists', async () => {
    const historical = sessionWithHandoff({ nextAction: 'review_handoff' });
    savePortfolioEntryCurrentSession({ sessionId: historical.id, credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(historical);
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(null);

    renderExperience();

    expect(await screen.findByTestId('handoff-expanded-analysis')).toBeInTheDocument();
    expect(screen.getByTestId('handoff-starteria-path-expanded')).toBeInTheDocument();
    expect(screen.queryByTestId('critical-handoff-review')).not.toBeInTheDocument();
    expect(historical).not.toHaveProperty('handoff');
    expect(historical.handoffExperience).toBe('legacy');
    expect(serviceMocks.getPortfolioEntryHandoff).toHaveBeenCalledWith(historical.id, 'entry-token');
    expect(serviceMocks.getPortfolioEntryCriticalHandoff).not.toHaveBeenCalled();
  });

  it('preserves the session and retries handoff with the same revision and a fresh idempotency key', async () => {
    const eligible = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
    markCriticalHandoffReviewSession(eligible.id);
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
    serviceMocks.materializePortfolioEntryCriticalHandoff
      .mockRejectedValueOnce({ kind: 'timeout', status: 504 })
      .mockResolvedValueOnce({ sessionRevision: 3, criticalHandoff: makeCriticalHandoff() });
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

    renderExperience();

    expect(await screen.findByRole('button', { name: /reintentar conclusi.*n/i })).toBeInTheDocument();
    const firstCall = serviceMocks.materializePortfolioEntryCriticalHandoff.mock.calls[0];
    expect(firstCall[0]).toBe(eligible.id);
    expect(firstCall[2].expectedRevision).toBe(eligible.revision);

    fireEvent.click(screen.getByRole('button', { name: /reintentar conclusi.*n/i }));

    await waitFor(() => expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(2));
    const secondCall = serviceMocks.materializePortfolioEntryCriticalHandoff.mock.calls[1];
    expect(secondCall[0]).toBe(firstCall[0]);
    expect(secondCall[2].expectedRevision).toBe(firstCall[2].expectedRevision);
    expect(secondCall[2].idempotencyKey).not.toBe(firstCall[2].idempotencyKey);
    expect(await screen.findByTestId('critical-handoff-review')).toBeInTheDocument();
  });

  it('does not double-submit a handoff retry while the request is pending', async () => {
    const eligible = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
    markCriticalHandoffReviewSession(eligible.id);
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
    let resolveRetry!: (response: { sessionRevision: number; criticalHandoff: PortfolioEntryCriticalHandoffDto }) => void;
    serviceMocks.materializePortfolioEntryCriticalHandoff
      .mockRejectedValueOnce({ kind: 'unavailable', status: 503 })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve; }));
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

    renderExperience();

    const retry = await screen.findByRole('button', { name: /reintentar conclusi.*n/i });
    fireEvent.click(retry);
    await waitFor(() => expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: /reintentar conclusi.*n/i })).not.toBeInTheDocument();
    fireEvent.click(retry);
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(2);
    resolveRetry({ sessionRevision: 3, criticalHandoff: makeCriticalHandoff() });
    expect(await screen.findByTestId('critical-handoff-review')).toBeInTheDocument();
  });

  it('does not offer a retry action for non-retryable handoff errors', async () => {
    const eligible = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
    markCriticalHandoffReviewSession(eligible.id);
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
    serviceMocks.materializePortfolioEntryCriticalHandoff.mockRejectedValue({ kind: 'unauthorized', status: 401 });

    renderExperience();

    expect(await screen.findByText(/la sesi.*ya no es v.*lida/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar conclusi.*n/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /empezar de nuevo/i })).toBeInTheDocument();
  });

  it('rehydrates after a lost materialization response and does not replay the conclusion request', async () => {
    const eligible = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    const ready = makeSession({
      lifecycleStatus: 'HANDOFF_READY',
      revision: 3,
      nextAction: 'review_handoff',
      handoffExperience: 'critical',
    });
    savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession
      .mockResolvedValueOnce(eligible)
      .mockResolvedValueOnce(ready);
    serviceMocks.materializePortfolioEntryCriticalHandoff.mockRejectedValueOnce({ kind: 'unavailable', status: 503 });
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

    renderExperience();

    expect(await screen.findByTestId('critical-handoff-review')).toBeInTheDocument();
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);
    expect(serviceMocks.getPortfolioEntrySession).toHaveBeenCalledTimes(2);
    expect(serviceMocks.submitPortfolioEntryMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /reintentar conclusi.*n/i })).not.toBeInTheDocument();
  });

  it('shows an honest unknown state when rehydration after 503 cannot be verified', async () => {
    const eligible = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession
      .mockResolvedValueOnce(eligible)
      .mockRejectedValueOnce({ kind: 'unavailable', status: 503 });
    serviceMocks.materializePortfolioEntryCriticalHandoff.mockRejectedValueOnce({ kind: 'unavailable', status: 503 });

    renderExperience();

    expect(await screen.findByText(/no puedo verificar ahora qu.* parte/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comprobar estado/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar conclusi.*n/i })).not.toBeInTheDocument();
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);
    expect(serviceMocks.submitPortfolioEntryMessage).not.toHaveBeenCalled();
  });

  it('retries only the conclusion with the current revision after a materialization conflict', async () => {
    const stale = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    const current = { ...stale, revision: 3 };
    savePortfolioEntryCurrentSession({ sessionId: stale.id, credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(current);
    serviceMocks.materializePortfolioEntryCriticalHandoff
      .mockRejectedValueOnce({ kind: 'conflict', status: 409 })
      .mockResolvedValueOnce({ sessionRevision: 4, criticalHandoff: makeCriticalHandoff() });
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

    renderExperience();

    const retry = await screen.findByRole('button', { name: /reintentar conclusi.*n/i });
    expect(screen.getByText(/revisi.*n 3/i)).toBeInTheDocument();
    fireEvent.click(retry);

    await waitFor(() => expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(2));
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff.mock.calls[0][2].expectedRevision).toBe(2);
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff.mock.calls[1][2].expectedRevision).toBe(3);
    expect(serviceMocks.submitPortfolioEntryMessage).not.toHaveBeenCalled();
    expect(await screen.findByTestId('critical-handoff-review')).toBeInTheDocument();
  });

  it('does not auto-post again after a reload with a pending Critical Handoff attempt', async () => {
    const eligible = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 2,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
    saveCriticalHandoffMaterializationAttempt({ sessionId: eligible.id, revision: eligible.revision });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);

    renderExperience();

    expect(await screen.findByTestId('portfolio-entry-conclusion-failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar conclusi.*n/i })).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-entry-inconsistent-state')).not.toBeInTheDocument();
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.submitPortfolioEntryMessage).not.toHaveBeenCalled();
  });

  it('requires a manual conclusion retry with the authoritative revision after reload drift', async () => {
    const current = makeSession({
      lifecycleStatus: 'HANDOFF_ELIGIBLE',
      revision: 3,
      nextAction: 'generate_handoff',
      handoffExperience: 'critical',
    });
    savePortfolioEntryCurrentSession({ sessionId: current.id, credential: 'entry-token' });
    saveCriticalHandoffMaterializationAttempt({ sessionId: current.id, revision: 2 });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(current);
    serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({
      sessionRevision: 4,
      criticalHandoff: makeCriticalHandoff(),
    });
    serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

    renderExperience();

    const retry = await screen.findByRole('button', { name: /reintentar conclusi.*n/i });
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff).not.toHaveBeenCalled();
    fireEvent.click(retry);

    await waitFor(() => expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1));
    expect(serviceMocks.materializePortfolioEntryCriticalHandoff.mock.calls[0][2].expectedRevision).toBe(3);
    expect(serviceMocks.submitPortfolioEntryMessage).not.toHaveBeenCalled();
    expect(await screen.findByTestId('critical-handoff-review')).toBeInTheDocument();
  });

  it('routes public correction through authentication without persisting anonymously', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithHandoff());
    serviceMocks.correctPortfolioEntryHandoff.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'REVISIONS_REQUESTED',
      revision: 4,
      nextAction: 'claim_or_close',
      confirmation: {
        id: 'confirmation-1',
        version: 1,
        status: 'REVISIONS_REQUESTED',
        acceptedFields: [],
        correctedFields: { 'understanding.value': 'Correccion del usuario' },
        rejectedFields: [],
        createdAt: new Date().toISOString(),
      },
    }));

    renderExperience();

    fireEvent.click(await screen.findByRole('button', { name: /ajustar esta lectura/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/auth');
    expect(readPendingPortfolioEntryClaim()).toEqual({
      sessionId: '11111111-1111-4111-8111-111111111111',
      credential: 'entry-token',
    });
    expect(serviceMocks.confirmPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.correctPortfolioEntryHandoff).not.toHaveBeenCalled();
  });

  it('keeps deeper handoff material collapsed and reachable without changing the CTA', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const session = explicitLegacyHandoffSession();
    session.handoff!.handoff = makeHandoff({
      known_context: [{ key: 'Restricción', value: 'La capacidad del equipo es limitada.', provenance: { origin: 'USER_DECLARED' } }],
      unresolved_context: [
        { gap_id: 'gap-1', description: 'Primer pendiente visible.' },
        { gap_id: 'gap-2', description: 'Segundo pendiente visible.' },
        { gap_id: 'gap-3', description: 'Tercer pendiente visible.' },
        { gap_id: 'gap-4', description: 'Pendiente adicional para el análisis completo.' },
      ],
      evidence_or_clarity_needed: [],
      starteria_path: [
        { action: 'structure', description: 'Ordenar el contexto.' },
        { action: 'make_visible', description: 'Hacer visibles las señales.' },
        { action: 'compare_or_follow', description: 'Comparar alternativas.' },
        { action: 'resolve_gaps', description: 'Resolver pendientes.' },
        { action: 'prepare_decision', description: 'Preparar la decisión.' },
      ],
    });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({ id: session.id }));
    serviceMocks.getPortfolioEntryHandoff.mockResolvedValue(session);

    renderExperience();

    expect(await screen.findByText('Esto estoy entendiendo')).toBeVisible();
    expect(screen.getByText(/Pendiente adicional para el .*lisis completo/)).not.toBeVisible();
    expect(screen.getByTestId('handoff-starteria-path-expanded')).not.toBeVisible();
    expect(screen.getByRole('button', { name: /trabajarlo con starteria/i })).toBeVisible();

    fireEvent.click(screen.getByText(/Ver an.*lisis completo/));

    expect(screen.getByText(/Por qu.*llegamos a esta lectura/)).toBeVisible();
    expect(screen.getByText('Supuestos que estamos usando')).toBeVisible();
    expect(screen.getByText(/Contexto todav.*abierto/)).toBeVisible();
    expect(screen.getByText(/Pendiente adicional para el .*lisis completo/)).toBeVisible();
    expect(screen.getByText('Ruta completa en Starteria')).toBeVisible();
    expect(screen.getByTestId('handoff-starteria-path-expanded')).toBeVisible();
    expect(screen.getByTestId('handoff-provenance-detail')).toBeVisible();
    expect(screen.getByRole('button', { name: /trabajarlo con starteria/i })).toBeVisible();

    fireEvent.click(screen.getByText(/Ver an.*lisis completo/));
    expect(screen.getByText(/Pendiente adicional para el .*lisis completo/)).not.toBeVisible();
  });

  it('keeps an unresolved decision visible as uncertainty and renders a resolution-less gap safely', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    const session = explicitLegacyHandoffSession();
    session.handoff!.handoff = makeHandoff({
      decision_to_enable: 'unresolved',
      gap_resolution_map: [],
      alternative_approaches: [],
      starteria_path: [],
    });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({ id: session.id }));
    serviceMocks.getPortfolioEntryHandoff.mockResolvedValue(session);

    renderExperience();

    expect(await screen.findByText(/Pendiente de aclarar antes de decidir/i)).toBeInTheDocument();
    expect(screen.getByTestId('handoff-expanded-analysis')).toBeInTheDocument();
  });

  it('clears expired anonymous sessions and offers restart', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockRejectedValue({ kind: 'expired', status: 410 });

    renderExperience();

    expect(await screen.findByText(/la sesion expiro/i)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('starteria.portfolioEntry.current')).toBeNull();
  });

  it('shows three distinct decisions only for a confirmed Brief', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED',
      revision: 5,
      nextAction: 'claim_or_close',
      ownership: { state: 'ANONYMOUS' },
    }));

    renderExperience();

    const actions = await screen.findByTestId('portfolio-entry-confirmed-brief-actions');
    expect(within(actions).getAllByRole('button').map((button) => button.textContent)).toEqual(['Descargar', 'Eliminar', 'Trabajarlo con Starteria']);
  });

  it('does not confirm the handoff from the anonymous CTA', async () => {
    savePortfolioEntryCurrentSession({ sessionId: '11111111-1111-4111-8111-111111111111', credential: 'entry-token' });
    serviceMocks.getPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'HANDOFF_READY',
      revision: 4,
      ownership: { state: 'ANONYMOUS' },
    }));
    renderExperience();

    fireEvent.click(await screen.findByRole('button', { name: /trabajarlo con starteria/i }));

    expect(navigateSpy).toHaveBeenCalledWith('/auth');
    expect(readPendingPortfolioEntryClaim()).toEqual({
      sessionId: '11111111-1111-4111-8111-111111111111',
      credential: 'entry-token',
    });
    expect(serviceMocks.confirmPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.correctPortfolioEntryHandoff).not.toHaveBeenCalled();
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();
  });

  it('requires an explicit click to convert a claimed confirmed session and navigates to backend destination', async () => {
    saveClaimedPortfolioEntrySession({ sessionId: '11111111-1111-4111-8111-111111111111' });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED',
      revision: 8,
      nextAction: 'claim_or_close',
      ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      confirmation: { id: 'confirmation-1', version: 3, status: 'CONFIRMED', acceptedFields: [], correctedFields: {}, rejectedFields: [], createdAt: new Date().toISOString() },
    }));
    serviceMocks.continuePortfolioEntryToPortfolio.mockResolvedValue({
      continuationId: 'continuation-1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      status: 'CONTINUED',
      destinationRoute: '/portfolio/setup',
      continuedAt: new Date().toISOString(),
      portfolioScope: { kind: 'scoped_portfolio_grant', userId: 'user-1', organizationId: 'org-1' },
      context: {},
    });

    renderExperience();

    const cta = await screen.findByRole('button', { name: /trabajarlo con starteria/i });
    expect(serviceMocks.continuePortfolioEntryToPortfolio).not.toHaveBeenCalled();

    fireEvent.click(cta);

    await waitFor(() => {
      expect(serviceMocks.continuePortfolioEntryToPortfolio).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        expect.objectContaining({ expectedRevision: 8 }),
      );
    });
    expect(serviceMocks.continuePortfolioEntryToPortfolio.mock.calls[0][1]).not.toHaveProperty('ownerUserId');
    expect(serviceMocks.continuePortfolioEntryToPortfolio.mock.calls[0][1]).not.toHaveProperty('projectId');
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/portfolio/setup'));
    expect(window.sessionStorage.getItem('starteria.portfolioEntry.current')).toBeNull();
    expect(window.sessionStorage.getItem('starteria.portfolioEntry.pendingClaim')).toBeNull();
    expect(readClaimedPortfolioEntryBriefIdentity()).toEqual({
      source: 'portfolio_entry', sessionId: '11111111-1111-4111-8111-111111111111', sessionRevision: 8,
      handoffId: 'handoff-1', handoffVersion: 1, confirmationId: 'confirmation-1', confirmationVersion: 3,
    });
  });

  it('reuses the same conversion idempotency key when retrying after a server failure', async () => {
    saveClaimedPortfolioEntrySession({ sessionId: '11111111-1111-4111-8111-111111111111' });
    serviceMocks.getClaimedPortfolioEntrySession.mockResolvedValue(sessionWithHandoff({
      lifecycleStatus: 'CONFIRMED',
      revision: 8,
      nextAction: 'claim_or_close',
      ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
    }));
    serviceMocks.continuePortfolioEntryToPortfolio
      .mockRejectedValueOnce({ kind: 'server_error', status: 500 })
      .mockResolvedValueOnce({
        continuationId: 'continuation-1',
        sessionId: '11111111-1111-4111-8111-111111111111',
        status: 'CONTINUED',
        destinationRoute: '/portfolio/setup',
        continuedAt: new Date().toISOString(),
        portfolioScope: { kind: 'scoped_portfolio_grant', userId: 'user-1', organizationId: 'org-1' },
        context: {},
      });

    renderExperience();

    const cta = await screen.findByRole('button', { name: /trabajarlo con starteria/i });
    fireEvent.click(cta);

    expect(await screen.findByText(/continuidad Portfolio todavia/i)).toBeInTheDocument();
    const firstKey = serviceMocks.continuePortfolioEntryToPortfolio.mock.calls[0][1].idempotencyKey;

    fireEvent.click(screen.getByRole('button', { name: /trabajarlo con starteria/i }));

    await waitFor(() => expect(serviceMocks.continuePortfolioEntryToPortfolio).toHaveBeenCalledTimes(2));
    expect(serviceMocks.continuePortfolioEntryToPortfolio.mock.calls[1][1].idempotencyKey).toBe(firstKey);
    expect(navigateSpy).toHaveBeenCalledWith('/portfolio/setup');
  });

  it('recovers latest claimed session on conversion conflict without auto-resubmitting conversion', async () => {
    saveClaimedPortfolioEntrySession({ sessionId: '11111111-1111-4111-8111-111111111111' });
    serviceMocks.getClaimedPortfolioEntrySession
      .mockResolvedValueOnce(sessionWithHandoff({
        lifecycleStatus: 'CONFIRMED',
        revision: 8,
        nextAction: 'claim_or_close',
        ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      }))
      .mockResolvedValueOnce(sessionWithHandoff({
        lifecycleStatus: 'CONFIRMED',
        revision: 9,
        nextAction: 'claim_or_close',
        ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
      }));
    serviceMocks.continuePortfolioEntryToPortfolio.mockRejectedValue({ kind: 'conflict', status: 409 });

    renderExperience();

    fireEvent.click(await screen.findByRole('button', { name: /trabajarlo con starteria/i }));

    await waitFor(() => expect(serviceMocks.getClaimedPortfolioEntrySession).toHaveBeenCalledTimes(2));
    expect(serviceMocks.continuePortfolioEntryToPortfolio).toHaveBeenCalledTimes(1);
  });

  it('handles 202 async generation, polls until READY, and renders the critical handoff review', async () => {
    vi.useFakeTimers();
    try {
      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession
        .mockResolvedValueOnce(eligible)
        .mockResolvedValueOnce(makeSession({
          ...eligible,
          lifecycleStatus: 'HANDOFF_READY',
          revision: 3,
          nextAction: 'review_handoff',
        }));
      serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({
        kind: 'generating',
        sessionRevision: 2,
        generation: {
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        },
      });
      serviceMocks.getPortfolioEntryCriticalHandoffGeneration
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        })
        .mockResolvedValueOnce({
          status: 'READY',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          failureClass: null,
          retryable: false,
        });
      serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);

      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();
      expect(screen.getByText('Preparando tu conclusión provisional')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).toHaveBeenCalledTimes(3);

      expect(screen.getByTestId('critical-handoff-review')).toBeInTheDocument();
      expect(serviceMocks.getPortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles FAILED generation status, offers Reintentar conclusión, and retries on click', async () => {
    vi.useFakeTimers();
    try {
      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
      serviceMocks.materializePortfolioEntryCriticalHandoff
        .mockResolvedValueOnce({
          kind: 'generating',
          sessionRevision: 2,
          generation: {
            status: 'GENERATING',
            sourceContextRevision: 2,
            attempt: 1,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            failureClass: null,
            retryable: false,
          },
        })
        .mockResolvedValueOnce({
          kind: 'ready',
          sessionRevision: 3,
          criticalHandoff: makeCriticalHandoff(),
        });
      serviceMocks.getPortfolioEntryCriticalHandoffGeneration
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          status: 'FAILED',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          failureClass: 'provider_timeout',
          retryable: true,
        });
      serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(screen.getByTestId('portfolio-entry-conclusion-failed')).toBeInTheDocument();
      const retryButton = screen.getByRole('button', { name: 'Reintentar conclusión' });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(2);
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff.mock.calls[1][2].expectedRevision).toBe(2);
      expect(screen.getByTestId('critical-handoff-review')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out after 3 minutes since startedAt and allows Reintentar conclusión', async () => {
    vi.useFakeTimers();
    try {
      const startTime = new Date('2026-10-24T16:00:00.000Z');
      vi.setSystemTime(startTime);

      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
      serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({
        kind: 'generating',
        sessionRevision: 2,
        generation: {
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: startTime.toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        },
      });
      serviceMocks.getPortfolioEntryCriticalHandoffGeneration
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: startTime.toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        });

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(150_000);
      });
      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });

      expect(screen.getByTestId('portfolio-entry-conclusion-failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar conclusión' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes waiting on reload when generation is active without showing Reintentar', async () => {
    vi.useFakeTimers();
    try {
      const now = new Date('2026-10-24T16:00:00.000Z');
      vi.setSystemTime(now);

      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      saveCriticalHandoffMaterializationAttempt({ sessionId: eligible.id, revision: eligible.revision });

      serviceMocks.getPortfolioEntrySession
        .mockResolvedValueOnce(eligible)
        .mockResolvedValueOnce(makeSession({
          ...eligible,
          lifecycleStatus: 'HANDOFF_READY',
          revision: 3,
          nextAction: 'review_handoff',
        }));

      serviceMocks.getPortfolioEntryCriticalHandoffGeneration
        .mockResolvedValueOnce({
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date(now.getTime() - 20_000).toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        })
        .mockResolvedValueOnce({
          status: 'READY',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date(now.getTime() - 20_000).toISOString(),
          finishedAt: now.toISOString(),
          failureClass: null,
          retryable: false,
        });
      serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).not.toHaveBeenCalled();

      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();
      expect(screen.getByText('Preparando tu conclusión provisional')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(screen.getByTestId('critical-handoff-review')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleans up polling timers when unmounting during generation', async () => {
    vi.useFakeTimers();
    try {
      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
      serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({
        kind: 'generating',
        sessionRevision: 2,
        generation: {
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        },
      });

      const { unmount } = renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);

      serviceMocks.getPortfolioEntryCriticalHandoffGeneration.mockClear();

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops generation polling and resets isPollingGeneration when restart is triggered', async () => {
    vi.useFakeTimers();
    try {
      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
      serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({
        kind: 'generating',
        sessionRevision: 2,
        generation: {
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        },
      });

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();

      // Poll at 3s returns terminal 401 error
      serviceMocks.getPortfolioEntryCriticalHandoffGeneration.mockRejectedValueOnce({ status: 401, kind: 'unauthorized' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      const restartButton = screen.getByRole('button', { name: /empezar de nuevo/i });
      serviceMocks.getPortfolioEntryCriticalHandoffGeneration.mockClear();

      fireEvent.click(restartButton);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).not.toHaveBeenCalled();
      expect(screen.queryByTestId('portfolio-entry-conclusion-pending')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels generation polling if unmounted during mount recovery before polling starts', async () => {
    vi.useFakeTimers();
    try {
      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);

      let resolveGeneration!: (value: unknown) => void;
      serviceMocks.getPortfolioEntryCriticalHandoffGeneration.mockImplementation(
        () => new Promise((resolve) => { resolveGeneration = resolve; }),
      );

      const { unmount } = renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).toHaveBeenCalledTimes(1);

      unmount();

      await act(async () => {
        resolveGeneration({
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        });
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes waiting on reload without a stored attempt when /generation reports active GENERATING', async () => {
    vi.useFakeTimers();
    try {
      const now = new Date('2026-10-24T16:00:00.000Z');
      vi.setSystemTime(now);

      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      // Anonymous session in storage, BUT NO stored materialization attempt
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });

      serviceMocks.getPortfolioEntrySession
        .mockResolvedValueOnce(eligible)
        .mockResolvedValueOnce(makeSession({
          ...eligible,
          lifecycleStatus: 'HANDOFF_READY',
          revision: 3,
          nextAction: 'review_handoff',
        }));

      serviceMocks.getPortfolioEntryCriticalHandoffGeneration
        .mockResolvedValueOnce({
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date(now.getTime() - 25_000).toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        })
        .mockResolvedValueOnce({
          status: 'READY',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date(now.getTime() - 25_000).toISOString(),
          finishedAt: now.toISOString(),
          failureClass: null,
          retryable: false,
        });
      serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).not.toHaveBeenCalled();
      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(screen.getByTestId('critical-handoff-review')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries with backoff between 6 and 10 seconds without treating 429 as failure and renders on READY', async () => {
    vi.useFakeTimers();
    try {
      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession
        .mockResolvedValueOnce(eligible)
        .mockResolvedValueOnce(makeSession({
          ...eligible,
          lifecycleStatus: 'HANDOFF_READY',
          revision: 3,
          nextAction: 'review_handoff',
        }));
      serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValueOnce({
        kind: 'generating',
        sessionRevision: 2,
        generation: {
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        },
      });

      // Mount check returns null, 1st poll at 3s returns 429 with retryAfterSeconds 8, 2nd poll at 3s + 8s returns READY
      serviceMocks.getPortfolioEntryCriticalHandoffGeneration
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce({
          status: 429,
          kind: 'rate_limited',
          retryAfterSeconds: 8,
        })
        .mockResolvedValueOnce({
          status: 'READY',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          failureClass: null,
          retryable: false,
        });
      serviceMocks.getPortfolioEntryCriticalHandoff.mockResolvedValue(makeCriticalHandoff());

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(serviceMocks.getPortfolioEntryCriticalHandoffGeneration).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId('critical-handoff-review')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling and shows conclusion_failed_recoverable when 429 polls exceed 3 minutes from startedAt', async () => {
    vi.useFakeTimers();
    try {
      const startTime = new Date('2026-10-24T16:00:00.000Z');
      vi.setSystemTime(startTime);

      const eligible = makeSession({
        lifecycleStatus: 'HANDOFF_ELIGIBLE',
        revision: 2,
        nextAction: 'generate_handoff',
        handoffExperience: 'critical',
      });
      savePortfolioEntryCurrentSession({ sessionId: eligible.id, credential: 'entry-token' });
      serviceMocks.getPortfolioEntrySession.mockResolvedValue(eligible);
      serviceMocks.materializePortfolioEntryCriticalHandoff.mockResolvedValue({
        kind: 'generating',
        sessionRevision: 2,
        generation: {
          status: 'GENERATING',
          sourceContextRevision: 2,
          attempt: 1,
          startedAt: startTime.toISOString(),
          finishedAt: null,
          failureClass: null,
          retryable: false,
        },
      });

      serviceMocks.getPortfolioEntryCriticalHandoffGeneration
        .mockResolvedValueOnce(null)
        .mockRejectedValue({
          status: 429,
          kind: 'rate_limited',
          retryAfterSeconds: 6,
        });

      renderExperience();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(serviceMocks.materializePortfolioEntryCriticalHandoff).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(150_000);
      });
      expect(screen.getByTestId('portfolio-entry-conclusion-pending')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(35_000);
      });

      expect(screen.getByTestId('portfolio-entry-conclusion-failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar conclusión' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});


