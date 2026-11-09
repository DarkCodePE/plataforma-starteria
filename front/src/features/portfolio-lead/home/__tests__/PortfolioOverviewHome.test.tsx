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
  independentInitiatives: [],
  attention: [],
  pendingDecisions: [{ decisionId: null, requestId: 'decision-1', initiativeId: 'project-1', requestedDecision: 'Continuar', status: 'pending', recommendation: null, evidenceSummary: null, decisionAuthority: null, updatedAt: null }],
  recommendations: [],
  handoffAssignments: [{ assignmentId: 'assignment-challenge', targetKind: 'CHALLENGE', challengeRef: 'challenge-1', initiativeRef: null, initiativeOwnerRef: null, executionTeam: [], observers: [], handoffState: 'SENT', acceptedAt: null, rejectedAt: null, rejectionReason: null, portfolioResponse: null, startedAt: null, resultingInitiativeRef: null, lastMaterialEvent: 'sent', sourceEventRefs: [], projectionVersion: 1, generatedAt: '2026-10-24T08:00:00.000Z' }],
  labRequests: [],
  generatedAt: '2026-10-24T08:00:00.000Z', learnings: [], learningsUnavailable: false,
  availability: { strategicUnits: 'available', independentInitiatives: 'available', portfolioReading: 'available', handoffAssignments: 'available', learnings: 'available', capacity: 'available' },
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
    const operationalTable = screen.getByRole('table', { name: 'Seguimiento operativo del portafolio' });
    expect(within(operationalTable).getByText('Owner no disponible')).toBeInTheDocument();
    expect(within(operationalTable).queryByText('Owner canónico')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThanOrEqual(2);
  });

  it('G04 shows canonical Project owner from server data and filters by that owner, never inventing one', () => {
    const withOwners = {
      ...model,
      strategicUnits: model.strategicUnits.map((front) => ({
        ...front,
        challenges: front.challenges.map((challenge) => ({
          ...challenge,
          initiatives: challenge.initiatives.map((initiative) => ({
            ...initiative,
            owner: { id: 'owner-1', name: 'María Operaciones', source: 'canonical' as const },
          })),
        })),
      })),
      independentInitiatives: [{
        initiativeId: 'ind-1', title: 'Iniciativa sin owner verificado',
        owner: { id: 'owner-legacy', name: 'Persona inferida', source: 'legacy-derived' },
        strategicFrontId: null, challengeId: null,
        activationVisibility: 'initiative_exists',
        currentExecutionState: { projectStatus: 'DRAFT', step0Status: null, currentStep: null },
        blockers: [],
      }],
    };
    render(<PortfolioOverviewHome model={withOwners as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);
    const table = screen.getByRole('table', { name: 'Seguimiento operativo del portafolio' });
    expect(within(table).getByText('María Operaciones')).toBeVisible();
    expect(within(table).getByText('Owner no disponible')).toBeVisible();
    expect(within(table).queryByText('Persona inferida')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' }), { target: { value: 'María Operaciones' } });
    expect(within(table).getByText('Onboarding guiado')).toBeVisible();
    expect(within(table).queryByText('Iniciativa sin owner verificado')).not.toBeInTheDocument();
  });

  it('KAN-250 shows a resumable context card and only resumes when the user clicks', () => {
    const resume = vi.fn();
    render(<PortfolioOverviewHome
      model={model as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()}
      resumableStatus="ready"
      resumableSessions={[{
        sessionId: 'saved-1', title: 'Una cafetería quiere ampliar sus pedidos.',
        bootstrapPhase: 'B1_ANCHOR', status: 'awaiting_anchor_review',
        source: 'direct', createdAt: '2026-11-07T10:00:00.000Z',
        updatedAt: '2026-11-08T10:00:00.000Z',
        contextVersion: 3, contextUpdatedAt: '2026-11-08T12:00:00.000Z', contextStatus: 'draft',
      }]}
      onResumeSession={resume}
    />);
    expect(screen.getByRole('heading', { name: 'Preparaciones y conversaciones' })).toBeInTheDocument();
    expect(screen.getByText('Una cafetería quiere ampliar sus pedidos.')).toBeInTheDocument();
    expect(screen.getByText(/Borrador de contexto v3/i)).toBeInTheDocument();
    expect(resume).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retomar este espacio' }));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledWith('saved-1');
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

  it('shows independent same-organization Projects without inventing a front or challenge', () => {
    const withIndependent = {
      ...model,
      independentInitiatives: [{
        initiativeId: 'project-independent',
        title: 'Iniciativa independiente',
        strategicFrontId: null,
        challengeId: null,
        activationVisibility: 'initiative_active',
        currentExecutionState: { projectStatus: 'IN_PROGRESS', step0Status: 'COMPLETED', currentStep: 2 },
        blockers: [],
      }],
    };

    render(<PortfolioOverviewHome model={withIndependent as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Iniciativas independientes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir iniciativa Iniciativa independiente' }))
      .toHaveAttribute('href', '/portfolio/iniciativas?initiativeId=project-independent');
    expect(screen.getByText('2', { selector: '[data-metric="canonical-projects"]' })).toBeInTheDocument();
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

  it('labels Project progress as a dated read projection, not confirmed evidence', () => {
    render(<PortfolioOverviewHome model={model as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    expect(screen.getByText(/Step registrado: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Fuente: Project/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin actualización disponible/i)).toBeInTheDocument();
    expect(screen.getByText(/El avance no acredita un output ni evidencia confirmada/i)).toBeInTheDocument();
  });

  it('shows the latest canonical output with version, date and Step link', () => {
    const withOutput = structuredClone(model) as any;
    withOutput.strategicUnits[0].challenges[0].initiatives[0].lastConfirmedOutput = {
      id: 'output-step2-v4', cycleId: 'cycle-1', stepNumber: 2, version: 4, status: 'confirmed', outputKey: 'step2.execution-ready', sourceConfigurationId: 'step2-v4', confirmedAt: '2026-10-28T08:30:00.000Z', updatedAt: '2026-10-28T08:30:00.000Z',
    };

    render(<PortfolioOverviewHome model={withOutput} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    expect(screen.getByText(/Último resultado confirmado: Step 2/i)).toBeInTheDocument();
    expect(screen.getByText(/v4/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver resultado confirmado de Step 2/i })).toHaveAttribute('href', '/projects/project-1/step/2');
  });

  it('shows Starteria Lab as a separate factual request with contact pending, never as a confirmed meeting', () => {
    const withLab = {
      ...model,
      labRequests: [{
        requestId: 'lab-1', challengeId: 'challenge-1', briefVersionId: 'brief-version-1',
        status: 'REQUESTED', notificationStatus: 'NOTIFIED',
        createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-07T10:05:00.000Z',
      }],
    };

    render(<PortfolioOverviewHome model={withLab as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Startería Lab' })).toBeInTheDocument();
    expect(screen.getAllByText('Contacto pendiente').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Solicitud Lab lab-1/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/reunión confirmada/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Assignment lab-1/i)).not.toBeInTheDocument();
  });

  it('G5-CA01/CA04 renders the accessible operational table and filters provisional work without hiding its real state', () => {
    const g5Model = {
      ...model,
      workItems: [
        { workItemId: 'work-1', label: 'Onboarding guiado', purpose: 'Reducir fricción', sourceType: 'manual', status: 'confirmed_in_portfolio', currentStateHint: 'active', ownerCandidate: 'Operaciones', sourceRefs: { source: 'manual' }, actorId: 'lead-a', createdAt: '2026-11-07T08:00:00.000Z', updatedAt: '2026-11-07T08:05:00.000Z', bootstrapSessionId: 'session-a', linkedInitiativeId: 'project-1' },
        { workItemId: 'work-3', label: 'Tercera iniciativa sin activar', purpose: null, sourceType: 'csv', status: 'needs_review', currentStateHint: 'idea', ownerCandidate: null, sourceRefs: { file: 'portfolio.csv', row: 3 }, actorId: 'lead-a', createdAt: '2026-11-07T08:10:00.000Z', updatedAt: '2026-11-07T08:10:00.000Z', bootstrapSessionId: 'session-a', linkedInitiativeId: null },
      ],
      briefs: [{ briefVersionId: 'brief-v2', briefId: 'brief-1', challengeId: 'challenge-1', challengeTitle: 'Reducir fricción', versionNumber: 2, status: 'CONFIRMED', intent: 'Reducir fricción', scope: 'Activación', sourceRefs: { proposal: 'proposal-1' }, provenance: { status: 'user_confirmed' }, createdByActorId: 'lead-a', confirmedByActorId: 'lead-a', createdAt: '2026-11-07T09:10:00.000Z', confirmedAt: '2026-11-07T09:15:00.000Z' }],
      availability: { ...model.availability, workItems: 'available', briefs: 'available', labRequests: 'available' },
    };

    render(<PortfolioOverviewHome model={g5Model as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    const table = screen.getByRole('table', { name: 'Seguimiento operativo del portafolio' });
    for (const heading of ['Trabajo/Encargo', 'Destino/Owner', 'Estado real', 'Siguiente acción', 'Detalle']) {
      expect(within(table).getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(within(table).getByText('Brief v2')).toBeInTheDocument();
    expect(within(table).getByText('Necesita revisión')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' }), { target: { value: 'tercera' } });
    expect(within(table).getByText('Tercera iniciativa sin activar')).toBeInTheDocument();
    expect(within(table).queryByText('Onboarding guiado')).not.toBeInTheDocument();

    const details = within(table).getByRole('button', { name: 'Ver detalle de Tercera iniciativa sin activar' });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(within(table).getByText('lead-a')).toBeInTheDocument();
    expect(within(table).getByText('Fuente y procedencia:')).toBeInTheDocument();

    // G04: the searchbox promises owner/actor lookup, not only title and state.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' }), { target: { value: 'lead-a' } });
    expect(within(table).getByText('Tercera iniciativa sin activar')).toBeInTheDocument();
    expect(within(table).getByText('Onboarding guiado')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filtrar trabajo y encargos' }), { target: { value: 'unassigned-actor-not-present' } });
    expect(within(table).queryByText('Tercera iniciativa sin activar')).not.toBeInTheDocument();
  });

  it('G5-CA02/CA03 keeps sent, accepted, started, rejected and Lab notification as distinct factual rows', () => {
    const g5Model = {
      ...model,
      workItems: [], briefs: [],
      handoffAssignments: [
        { ...model.handoffAssignments[0], assignmentId: 'sent', handoffState: 'SENT', deliveryStatus: 'smtp_accepted', invitedEmail: 'sent@example.test', startedAt: null },
        { ...model.handoffAssignments[0], assignmentId: 'accepted', handoffState: 'ACCEPTED', deliveryStatus: 'smtp_accepted', invitedEmail: 'accepted@example.test', acceptedAt: '2026-11-07T10:00:00.000Z', startedAt: null },
        { ...model.handoffAssignments[0], assignmentId: 'started', handoffState: 'STARTED', deliveryStatus: 'smtp_accepted', invitedEmail: 'started@example.test', acceptedAt: '2026-11-07T10:00:00.000Z', startedAt: '2026-11-07T11:00:00.000Z' },
        { ...model.handoffAssignments[0], assignmentId: 'rejected', handoffState: 'REJECTED', deliveryStatus: 'smtp_accepted', invitedEmail: 'rejected@example.test', rejectedAt: '2026-11-07T10:30:00.000Z' },
      ],
      labRequests: [{ requestId: 'lab-failed', challengeId: 'challenge-1', briefVersionId: 'brief-v2', status: 'REQUESTED', notificationStatus: 'FAILED', requesterId: 'lead-a', createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-07T10:05:00.000Z' }],
      availability: { ...model.availability, workItems: 'available', briefs: 'available', labRequests: 'available' },
    };

    render(<PortfolioOverviewHome model={g5Model as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);

    const table = screen.getByRole('table', { name: 'Seguimiento operativo del portafolio' });
    expect(within(table).getByText('Procesada por SMTP')).toBeInTheDocument();
    expect(within(table).getByText('Aceptada')).toBeInTheDocument();
    expect(within(table).getByText('Iniciada')).toBeInTheDocument();
    expect(within(table).getByText('Rechazada')).toBeInTheDocument();
    expect(within(table).getByText('Error al notificar')).toBeInTheDocument();
    expect(within(table).queryByText(/software entregado/i)).not.toBeInTheDocument();
    expect(within(table).queryByText(/Step activo/i)).not.toBeInTheDocument();
  });

  it('G5-CA06 exposes missing KPI/ROI/impact as Sin datos instead of deriving values from work', () => {
    render(<PortfolioOverviewHome model={{ ...model, workItems: [], briefs: [] } as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);
    expect(screen.getByText('Sin datos', { selector: '[data-field="latest-observation"]' })).toBeInTheDocument();
    expect(screen.getByText('Sin datos', { selector: '[data-field="roi"]' })).toBeInTheDocument();
    expect(screen.getByText('Sin datos', { selector: '[data-field="impact"]' })).toBeInTheDocument();
    expect(screen.queryByText(/% completado/i)).not.toBeInTheDocument();
  });

  it('G5-CA07 preserves detected, pending, confirmed and rejected WorkItem states as factual labels and actions', () => {
    const workItems = [
      ['detected', 'Detectado', 'Revisar trabajo detectado'],
      ['needs_review', 'Necesita revisión', 'Completar revisión humana'],
      ['pending', 'Pendiente de decisión', 'Resolver revisión pendiente'],
      ['confirmed_in_portfolio', 'Confirmado en portafolio', 'Revisar destino confirmado'],
      ['rejected', 'Rechazado', 'Conservar trazabilidad'],
    ].map(([status, _label, _action], index) => ({
      workItemId: `work-${index}`, bootstrapSessionId: 'session-a', label: `Trabajo ${status}`,
      purpose: null, sourceType: 'manual', status, currentStateHint: null, ownerCandidate: null,
      sourceRefs: { source: 'manual' }, actorId: 'lead-a', linkedInitiativeId: index === 3 ? 'project-1' : null,
      createdAt: '2026-11-07T08:00:00.000Z', updatedAt: '2026-11-07T08:00:00.000Z',
    }));
    render(<PortfolioOverviewHome model={{ ...model, workItems, briefs: [] } as any} onOpenCopilot={vi.fn()} onOpenAdditionalFront={vi.fn()} />);
    const table = screen.getByRole('table', { name: 'Seguimiento operativo del portafolio' });
    for (const [_status, label, action] of [
      ['detected', 'Detectado', 'Revisar trabajo detectado'],
      ['needs_review', 'Necesita revisión', 'Completar revisión humana'],
      ['pending', 'Pendiente de decisión', 'Resolver revisión pendiente'],
      ['confirmed_in_portfolio', 'Confirmado en portafolio', 'Revisar destino confirmado'],
      ['rejected', 'Rechazado', 'Conservar trazabilidad'],
    ]) {
      expect(within(table).getByText(label)).toBeInTheDocument();
      expect(within(table).getByText(action)).toBeInTheDocument();
    }
  });
});
