import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioOverviewHome } from '../PortfolioOverviewHome';

const model = {
  portfolioReading: { summary: 'La activación concentra la atención.', strategicUnitCount: 1, activeInitiativeCount: 1, pendingActivationCount: 1, blockerCount: 0, pendingDecisionCount: 1, coverageGapCount: null, evidenceGapCount: null, homeState: 'HOME_E', generatedAt: '2026-10-24T08:00:00.000Z', source: 'portfolio_reading' as const },
  governance: { portfolioLead: null, sponsors: [], challengeOwners: [], initiativeOwners: [], decisionAuthorities: [] },
  strategicUnits: [{
    strategicFront: { id: 'front-1', name: 'Adopción sostenible', status: 'active', priority: 'high' },
    desiredOutcome: 'Reducir abandono', signal: 'Tasa de abandono', baseline: '38 %', target: '20 %', horizon: 'Q4 2026', metricObservations: [], metricSource: 'StrategicFront',
    challenges: [{ id: 'challenge-1', title: 'Reducir fricción', status: 'published', owner: null, invitations: [], initiatives: [{
      initiativeId: 'project-1', title: 'Onboarding guiado', strategicFrontId: 'front-1', challengeId: 'challenge-1', alignmentState: null, owner: null,
      currentExecutionState: { projectStatus: 'IN_PROGRESS', step0Status: null, currentStep: 1 }, activationVisibility: 'initiative_active', blockers: [], evidenceSummary: null,
      contributionSummary: { expected: null, observed: null, attributed: null, derivationSource: 'unavailable' as const }, decisionSummary: null, updatedAt: null,
    }], activationVisibility: 'initiative_exists' as const }],
    initiativeSummary: { total: 1, activeExecution: 1, pendingActivation: 1 }, attentionSummary: { total: 0, blockers: 0 }, nextGovernanceAction: null,
  }],
  attention: [],
  pendingDecisions: [{ decisionId: null, requestId: 'decision-1', initiativeId: 'project-1', requestedDecision: 'Continuar', status: 'pending', recommendation: null, evidenceSummary: null, decisionAuthority: null, updatedAt: null }],
  recommendations: [],
  handoffAssignments: [{ assignmentId: 'assignment-challenge', targetKind: 'CHALLENGE', challengeRef: 'challenge-1', initiativeRef: null, initiativeOwnerRef: null, executionTeam: [], observers: [], handoffState: 'SENT', acceptedAt: null, rejectedAt: null, rejectionReason: null, portfolioResponse: null, startedAt: null, resultingInitiativeRef: null, lastMaterialEvent: 'sent', sourceEventRefs: [], projectionVersion: 1, generatedAt: '2026-10-24T08:00:00.000Z' }],
  generatedAt: '2026-10-24T08:00:00.000Z', learnings: [], learningsUnavailable: false,
  availability: { strategicUnits: 'available', portfolioReading: 'available', handoffAssignments: 'available', learnings: 'available', capacity: 'available' },
  capacity: { unit: 'active_initiatives', totalActiveInitiatives: 1, fronts: [], signals: [], note: 'Capacidad medida en iniciativas activas.' },
};

describe('PortfolioOverviewHome', () => {
  it('renders real hierarchy and keeps Challenge assignments separate from initiatives without inventing KPI values', () => {
    render(<PortfolioOverviewHome model={model as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '¿Qué necesita tu atención para mover el negocio?' })).toBeInTheDocument();
    expect(screen.getByText('Reducir abandono')).toBeInTheDocument();
    expect(screen.getByText('Tasa de abandono')).toBeInTheDocument();
    expect(screen.getByText('38 %')).toBeInTheDocument();
    expect(screen.getByText('20 %')).toBeInTheDocument();
    expect(screen.getByText('Q4 2026')).toBeInTheDocument();
    expect(screen.getByText('Sin datos', { selector: '[data-field="latest-observation"]' })).toBeInTheDocument();
    expect(screen.getByText(/1 encargo del reto/i)).toBeInTheDocument();
    expect(screen.getByText('1', { selector: '[data-metric="canonical-projects"]' })).toBeInTheDocument();
    expect(screen.getByText('1', { selector: '[data-metric="assignments"]' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver reto Reducir fricción/i })).toHaveAttribute('href', '/portfolio/retos?challengeId=challenge-1');
    expect(screen.getByRole('link', { name: /Abrir iniciativa Onboarding guiado/i })).toHaveAttribute('href', '/portfolio/iniciativas?initiativeId=project-1');
    expect(screen.getByRole('heading', { name: 'Qué vemos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Qué falta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Próxima intervención' })).toBeInTheDocument();
    expect(screen.getByText('1 iniciativa activa', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThanOrEqual(2);
  });

  it('opens another contextual front from an explicit action', () => {
    const onOpenAdditionalFront = vi.fn();
    render(<PortfolioOverviewHome model={model as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={onOpenAdditionalFront} />);
    const header = screen.getByTestId('portfolio-overview-header');
    const action = within(header).getByRole('button', { name: 'Crear nuevo frente estratégico' });
    expect(screen.getAllByRole('button', { name: 'Crear nuevo frente estratégico' })).toHaveLength(1);
    fireEvent.click(action);
    expect(onOpenAdditionalFront).toHaveBeenCalledOnce();
  });

  it('uses the approved assignment labels in Portfolio Overview attention', () => {
    const withPendingDelivery = {
      ...model,
      handoffAssignments: [
        { ...model.handoffAssignments[0], assignmentId: 'assignment-pending', handoffState: 'CREATED', deliveryStatus: 'not_sent' },
        { ...model.handoffAssignments[0], assignmentId: 'assignment-failed', handoffState: 'CREATED', deliveryStatus: 'failed' },
      ],
    };

    render(<PortfolioOverviewHome model={withPendingDelivery as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    expect(screen.getAllByText('Pendiente de envío').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Error al enviar').length).toBeGreaterThan(0);
    expect(screen.queryByText('Encargo guardado sin enviar')).not.toBeInTheDocument();
    expect(screen.queryByText('Invitación fallida')).not.toBeInTheDocument();
  });

  it('surfaces a rejected assignment without Portfolio response as a human decision', () => {
    const rejected = {
      ...model,
      handoffAssignments: [{
        ...model.handoffAssignments[0],
        assignmentId: 'assignment-rejected',
        handoffState: 'REJECTED',
        rejectedAt: '2026-10-24T09:00:00.000Z',
        portfolioResponse: null,
        deliveryStatus: 'smtp_accepted',
      }],
    };

    render(<PortfolioOverviewHome model={rejected as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    expect(screen.getAllByText('Rechazo pendiente de respuesta').length).toBeGreaterThan(0);
    expect(screen.getByText(/requiere una decisión del Portfolio Lead/i)).toBeInTheDocument();
  });

  it('shows Copilot only when the real feature is available', () => {
    const onOpenCopilot = vi.fn();
    const { rerender } = render(<PortfolioOverviewHome model={model as any} onOpenCopilot={onOpenCopilot} onOpenAdditionalFront={vi.fn()} copilotAvailable={false} />);
    expect(screen.queryByRole('button', { name: /Abrir Copilot/i })).not.toBeInTheDocument();

    rerender(<PortfolioOverviewHome model={model as any} onOpenCopilot={onOpenCopilot} onOpenAdditionalFront={vi.fn()} copilotAvailable />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir Copilot/i }));
    expect(onOpenCopilot).toHaveBeenCalledOnce();
  });
});
