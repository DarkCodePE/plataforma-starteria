import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthenticatedProvisionalContinuationPage } from '../AuthenticatedProvisionalContinuationPage';

const serviceMocks = vi.hoisted(() => ({
  getAuthenticatedProvisionalContinuation: vi.fn(),
  confirmAuthenticatedProvisionalContinuation: vi.fn(),
  correctAuthenticatedProvisionalContinuation: vi.fn(),
  getPortfolioEntryContexts: vi.fn(),
  continuePortfolioEntryToPortfolio: vi.fn(),
  normalizePortfolioEntryApiError: vi.fn((err: { message?: string }) => ({ message: err.message ?? 'Error' })),
}));
const storageMocks = vi.hoisted(() => ({
  readClaimedPortfolioEntrySession: vi.fn(() => ({ sessionId: 'session-1' })),
  saveClaimedPortfolioEntrySession: vi.fn(),
}));
const navigateSpy = vi.hoisted(() => vi.fn());

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateSpy };
});
vi.mock('../../../context/AppContext', () => ({
  useApp: () => ({ isAuthenticated: true, authLoading: false }),
}));
vi.mock('../../../../features/portfolio-entry/public/portfolioEntryPublicService', () => serviceMocks);
vi.mock('../../../../features/portfolio-entry/public/storage', () => storageMocks);

const continuation = {
  id: 'session-1',
  lifecycleStatus: 'CONFIRMED',
  executionStatus: 'COMPLETED',
  revision: 5,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  ownership: { state: 'CLAIMED', ownerUserId: 'user-1' },
  conversation: [],
  clarification: {
    interactionMode: 'quick_clarification',
    quickQuestionBudget: 3,
    quickQuestionsAsked: 1,
    explorationRound: 0,
    questionsAskedCurrentRound: 0,
    previousQuestions: [],
    answeredGaps: [],
  },
  semanticProjection: {},
  nextAction: 'claim_or_close',
  handoff: { id: 'handoff-1', version: 2, sessionId: 'session-1', revision: 5, handoff: {
    understanding: { value: 'Ordenar las iniciativas antes del comité.' },
    desired_outcome: { value: 'Llegar con una decisión clara.' },
    decision_to_enable: { value: 'Elegir prioridades.' },
    known_context: [{ key: 'prioridad', value: 'foco trimestral' }],
    unresolved_context: [{ description: 'Qué criterios usará el comité.' }],
    evidence_or_clarity_needed: [{ value: 'Datos de avance.' }],
    recommended_approach: { description: 'Comparar las iniciativas.' },
  } },
  confirmation: { id: 'confirmation-1', version: 3, status: 'CONFIRMED', acceptedFields: [], correctedFields: {}, rejectedFields: [] },
  provisionalContinuation: {
    state: 'AUTHENTICATED_PROVISIONAL_CONTINUATION',
    sessionId: 'session-1',
    handoff: { id: 'handoff-1', version: 1 },
    revision: 5,
    ownerUserId: 'user-1',
    access: { portfolio: 'PROVISIONAL_ONLY', organizationScope: 'ORGANIZATIONAL_UNKNOWN', canonicalEntityCreation: false },
    payload: {
      rawPublicContext: 'Tenemos iniciativas que necesitan foco.',
      understoodNeed: { value: 'Ordenar las iniciativas antes del comité.' },
      desiredOutcome: { value: 'Llegar con una decisión clara.' },
      knownContext: [{ key: 'prioridad', value: 'foco trimestral' }],
      provenance: [{ origin: 'AI_INFERRED' }],
      currentOpenItems: [{ value: 'Qué criterios usará el comité.' }],
      laterWorkItems: [{ action: 'prepare_decision', description: 'Preparar la decisión.' }],
      organizationalUnknowns: [{ gap_id: 'owner', description: 'Falta confirmar quién decide.' }],
      continuationSummary: { description: 'Seguir ordenando el contexto.' },
      selectedMaterialGap: { gap_id: 'owner', description: 'Falta confirmar quién decide.' },
      decisionMetadata: {
        decisionToEnable: 'unresolved',
        handoffStatus: 'ready_with_uncertainty',
        starteriaPath: [],
        conversionEligible: false,
        initiativeProfileSelected: false,
      },
    },
  },
};

describe('Authenticated provisional continuation page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getAuthenticatedProvisionalContinuation.mockResolvedValue(continuation);
    serviceMocks.confirmAuthenticatedProvisionalContinuation.mockResolvedValue(continuation);
    serviceMocks.correctAuthenticatedProvisionalContinuation.mockResolvedValue(continuation);
    serviceMocks.getPortfolioEntryContexts.mockResolvedValue({
      sessionId: 'session-1',
      revision: 5,
      contexts: [{ organizationId: 'org-1', name: 'Organización autorizada' }],
    });
    serviceMocks.continuePortfolioEntryToPortfolio.mockResolvedValue({ destinationRoute: '/portfolio/inicio' });
  });

  it('renders the same claimed session without internal terminology or restart intake', async () => {
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Esto es lo que entendimos' })).toBeTruthy();
    expect(screen.getAllByTestId('understood-need')[0]?.textContent).toContain('Ordenar las iniciativas');
    expect(screen.getByTestId('unresolved_context').textContent).toContain('criterios');
    expect(screen.getByText(/No necesitas empezar de nuevo/)).toBeTruthy();
    expect(screen.queryByText(/AUTHENTICATED_PROVISIONAL_CONTINUATION|Decision Readiness|CURRENT|LATER|provenance|canonical/i)).toBeNull();
    expect(serviceMocks.getAuthenticatedProvisionalContinuation).toHaveBeenCalledWith('session-1');
    await waitFor(() => expect(screen.queryByText(/reinicia|empezar una nueva entrada/i)).toBeNull());
  });

  it('lets the owner confirm the displayed interpretation', async () => {
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Incluir como hipótesis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar esta lectura y continuar/i }));
    await waitFor(() => expect(serviceMocks.confirmAuthenticatedProvisionalContinuation).toHaveBeenCalledWith(
      'session-1', expect.objectContaining({ expectedRevision: 5, acceptedFields: expect.arrayContaining(['understood_need', 'desired_outcome', 'decision_to_enable', 'known_context', 'unresolved_context', 'evidence_or_clarity_needed', 'recommended_approach']) }),
    ));
    await waitFor(() => expect(storageMocks.saveClaimedPortfolioEntrySession).toHaveBeenCalledWith({
      source: 'portfolio_entry', sessionId: 'session-1', sessionRevision: 5,
      handoffId: 'handoff-1', handoffVersion: 2, confirmationId: 'confirmation-1', confirmationVersion: 3,
    }));
    expect(serviceMocks.continuePortfolioEntryToPortfolio.mock.invocationCallOrder[0]).toBeGreaterThan(
      storageMocks.saveClaimedPortfolioEntrySession.mock.invocationCallOrder[0]!,
    );
  });

  it('lets the owner correct user-owned fields and renders the saved value', async () => {
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Ajustar lectura/i }));
    fireEvent.change(screen.getAllByLabelText('Qué entendió Starteria')[0]!, { target: { value: 'La necesidad corregida.' } });
    fireEvent.click(screen.getByRole('button', { name: /Ajustar/i }));
    fireEvent.change(screen.getByLabelText('Hipótesis ajustada'), { target: { value: 'Empezar por las prioridades.' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar esta lectura y continuar/i }));
    await waitFor(() => expect(serviceMocks.confirmAuthenticatedProvisionalContinuation).toHaveBeenCalledWith(
      'session-1', expect.objectContaining({ correctedFields: expect.objectContaining({ understood_need: 'La necesidad corregida.', recommended_approach: 'Empezar por las prioridades.' }) }),
    ));
    const submitted = serviceMocks.confirmAuthenticatedProvisionalContinuation.mock.calls.at(-1)?.[1];
    expect(submitted?.acceptedFields).not.toContain('understood_need');
  });

  it('records omission of the recommended approach as a separate rejection', async () => {
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /No incluir/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar esta lectura y continuar/i }));
    await waitFor(() => expect(serviceMocks.confirmAuthenticatedProvisionalContinuation).toHaveBeenCalled());
    const submitted = serviceMocks.confirmAuthenticatedProvisionalContinuation.mock.calls.at(-1)?.[1];
    expect(submitted?.acceptedFields).not.toContain('recommended_approach');
    expect(submitted?.correctedFields).not.toHaveProperty('recommended_approach');
    expect(submitted?.rejectedFields).toContain('recommended_approach');
  });

  it('CTX-UI-01/04/08 renders the safe no-context state without restarting intake', async () => {
    serviceMocks.getPortfolioEntryContexts.mockResolvedValue({ sessionId: 'session-1', revision: 5, contexts: [] });
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    expect(await screen.findByTestId('no-authorized-context')).toHaveTextContent('Tu avance está guardado');
    expect(screen.getAllByTestId('understood-need')[0]).toHaveTextContent('Ordenar las iniciativas');
    expect(screen.getByText(/No necesitas empezar de nuevo/)).toBeTruthy();
    expect(screen.queryByText(/OrganizationPortfolioAccessGrant|portfolio:read|tenant|provenance/i)).toBeNull();
  });

  it('CTX-UI-02/03/04 requires explicit selection for multiple authorized contexts', async () => {
    serviceMocks.getPortfolioEntryContexts.mockResolvedValue({
      sessionId: 'session-1', revision: 5,
      contexts: [{ organizationId: 'org-1', name: 'Primera organización' }, { organizationId: 'org-2', name: 'Segunda organización' }],
    });
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    expect(await screen.findByRole('radio', { name: 'Primera organización' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Segunda organización' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Confirmar esta lectura y continuar/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Segunda organización' }));
    fireEvent.click(screen.getByRole('button', { name: /Incluir como hipótesis/i }));
    expect(screen.getByRole('button', { name: /Confirmar esta lectura y continuar/i })).not.toBeDisabled();
  });
});
