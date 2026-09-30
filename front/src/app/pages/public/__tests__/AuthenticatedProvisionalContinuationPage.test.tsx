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
    expect(screen.getByTestId('understood-need').textContent).toContain('Ordenar las iniciativas');
    expect(screen.getByTestId('open-item').textContent).toContain('criterios');
    expect(screen.getByTestId('organizational-unknown').textContent).toContain('quién decide');
    expect(screen.getByTestId('later-work').textContent).toContain('preparación');
    expect(screen.getByText(/No necesitas empezar de nuevo/)).toBeTruthy();
    expect(screen.queryByText(/AUTHENTICATED_PROVISIONAL_CONTINUATION|Decision Readiness|CURRENT|LATER|provenance|canonical/i)).toBeNull();
    expect(serviceMocks.getAuthenticatedProvisionalContinuation).toHaveBeenCalledWith('session-1');
    await waitFor(() => expect(screen.queryByText(/reinicia|empezar una nueva entrada/i)).toBeNull());
  });

  it('lets the owner confirm the displayed interpretation', async () => {
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /está bien, continuar/i }));
    await waitFor(() => expect(serviceMocks.confirmAuthenticatedProvisionalContinuation).toHaveBeenCalledWith(
      'session-1', expect.objectContaining({ expectedRevision: 5 }),
    ));
    expect(navigateSpy).toHaveBeenCalledWith('/portfolio/setup');
  });

  it('lets the owner correct user-owned fields and renders the saved value', async () => {
    const corrected = structuredClone(continuation);
    corrected.provisionalContinuation.payload.understoodNeed.value = 'La necesidad corregida.';
    serviceMocks.correctAuthenticatedProvisionalContinuation.mockResolvedValue(corrected);
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /corregir/i }));
    fireEvent.change(screen.getByLabelText('Qué entendió Starteria'), { target: { value: 'La necesidad corregida.' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar corrección/i }));
    await waitFor(() => expect(serviceMocks.correctAuthenticatedProvisionalContinuation).toHaveBeenCalledWith(
      'session-1', expect.objectContaining({ correctedFields: expect.objectContaining({ understood_need: 'La necesidad corregida.' }) }),
    ));
    expect(await screen.findByTestId('understood-need')).toHaveTextContent('La necesidad corregida.');
  });

  it('CTX-UI-01/04/08 renders the safe no-context state without restarting intake', async () => {
    serviceMocks.getPortfolioEntryContexts.mockResolvedValue({ sessionId: 'session-1', revision: 5, contexts: [] });
    render(<MemoryRouter><AuthenticatedProvisionalContinuationPage /></MemoryRouter>);
    expect(await screen.findByTestId('no-authorized-context')).toHaveTextContent('Tu avance está guardado');
    expect(screen.getByTestId('understood-need')).toHaveTextContent('Ordenar las iniciativas');
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
    expect(screen.getByRole('button', { name: /Está bien, continuar/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Segunda organización' }));
    expect(screen.getByRole('button', { name: /Está bien, continuar/i })).not.toBeDisabled();
  });
});
