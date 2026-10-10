/**
 * InitiativeOverviewPage.test.tsx — IR-F2 (ADR-025, PRD §12, AC-OV-001..008).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InitiativeOverviewPage } from '../InitiativeOverviewPage';

const navigate = vi.fn();
vi.mock('react-router', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useNavigate: () => navigate,
}));

const getById = vi.fn();
vi.mock('../../services/projectService', () => ({
  getById: (id: string) => getById(id),
}));

const getAdaptiveCore = vi.fn();
vi.mock('../../../features/adaptive-core/services/adaptiveCoreService', () => ({
  getAdaptiveCore: (id: string) => getAdaptiveCore(id),
}));

const PROJECT = {
  id: 'p1',
  name: 'Optimización de aprobación de compras',
  status: 'DRAFT',
  step0Status: 'NOT_STARTED',
  step0Data: {
    source: 'initial_review',
    challengeType: 'correction',
    mainRisk: 'Solución prematura sin evidencia.',
    contextInitial: 'Reducir demoras en aprobaciones.',
    pendingQuestions: [{ id: 'q1' }, { id: 'q2' }],
  },
};

const SERVER_CORE = {
  schemaVersion: 'PRD-03-v0.4',
  masterContext: {
    id: 'mc1',
    version: 1,
    routeType: 'server_route',
    depthLevel: 'server_depth',
    maturity: 'draft',
    knownFacts: [],
    assumptions: [],
    missingCriticalInformation: [],
    risks: [],
    decisions: [],
    contextSnapshots: [],
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  activeStepConfigurationId: 'cfg-0',
  activeCheckpoint: {
    id: 'cp-server',
    step: 0,
    checkpointKey: 'CP-SERVER',
    status: 'ready',
    sequence: 1,
    questions: [],
    configurationId: 'cfg-0',
  },
  progressSignal: {
    id: 'sig1',
    step: 0,
    checkpointCode: 'CP-SERVER',
    checkpointTitle: 'Checkpoint persistido',
    health: 'healthy',
    hypothesis: '',
    evidence: '',
    evidenceStrength: 'weak',
    blocker: '',
    actorRequired: '',
    nextAction: 'Continuar desde backend.',
    upcomingDecision: '',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
  stepConfigurations: [
    {
      id: 'cfg-0',
      step: 0,
      version: 1,
      visibleName: 'Configuracion persistida backend',
      stablePurpose: 'Persistida',
      objective: 'Usar solo estado backend.',
      expectedOutput: 'Brief server',
      routeType: 'server_route',
      depthLevel: 'server_depth',
      generatedAt: '2026-08-04T00:00:00.000Z',
      generatedBy: 'backend',
      closureCriteria: [],
      checkpoints: [
        {
          id: 'cp-server',
          step: 0,
          code: 'CP-SERVER',
          title: 'Checkpoint persistido',
          purpose: 'Validar desde backend.',
          status: 'ready',
          outputKey: 'Brief',
          completionCriteria: [],
          questions: [],
          gates: [],
        },
      ],
    },
  ],
  checkpointInstances: [],
  stepOutputs: [],
  auditEvents: [],
};

describe('InitiativeOverviewPage (IR-F2)', () => {
  beforeEach(() => {
    navigate.mockReset();
    getById.mockReset();
    getById.mockResolvedValue(PROJECT);
    getAdaptiveCore.mockReset();
    getAdaptiveCore.mockResolvedValue(SERVER_CORE);
  });

  it('muestra la iniciativa en Draft con el mapa Step 0–4 (Step 0 activo, 1–4 bloqueados)', async () => {
    render(<InitiativeOverviewPage />);

    expect(await screen.findByText(/Estado: Draft/i)).toBeInTheDocument();
    expect(screen.getByText(PROJECT.name)).toBeInTheDocument();

    // AC-OV-003/004: Step 0 activo, 1–4 bloqueados.
    expect(screen.getByTestId('overview-step-0')).toHaveAttribute('data-state', 'active');
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByTestId(`overview-step-${n}`)).toHaveAttribute('data-state', 'locked');
    }
  });

  it('muestra el resumen de la revisión inicial (AC-OV-005)', async () => {
    render(<InitiativeOverviewPage />);
    expect(await screen.findByText(/Corrección/)).toBeInTheDocument(); // challengeType mapeado
    expect(screen.getByText(/Solución prematura/)).toBeInTheDocument(); // riesgo principal
    expect(screen.getByText(/2 pasan al Step 0/)).toBeInTheDocument(); // preguntas pendientes
  });

  // AC-OV-006 navegaba directo a Step 0; el E2E Job-Driven §18 lo reemplaza: Start pasa por
  // Mission Review y es esa pantalla la que abre Step 0.
  it('el CTA lleva a Mission Review, no directo a Step 0 (§18)', async () => {
    render(<InitiativeOverviewPage />);
    const cta = await screen.findByRole('button', { name: /Revisar mi misi[oó]n y empezar/i });
    fireEvent.click(cta);
    expect(navigate).toHaveBeenCalledWith('/initiatives/p1/mission');
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/0');
  });

  // El overview reflejaba siempre "Draft · Step 0 activo" aunque la iniciativa hubiera avanzado:
  // lo encontró la auditoría del Portfolio Lead en producción (2026-10-08).
  it('refleja el avance del core: Steps previos completos y el actual activo', async () => {
    getAdaptiveCore.mockResolvedValue({ ...SERVER_CORE, progressSignal: { ...SERVER_CORE.progressSignal, step: 2 } });
    render(<InitiativeOverviewPage />);

    expect(await screen.findByText(/Estado: En curso · Step 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/Estado: Draft/i)).not.toBeInTheDocument();
    for (const n of [0, 1]) expect(screen.getByTestId(`overview-step-${n}`)).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('overview-step-2')).toHaveAttribute('data-state', 'active');
    for (const n of [3, 4]) expect(screen.getByTestId(`overview-step-${n}`)).toHaveAttribute('data-state', 'locked');
    fireEvent.click(screen.getByRole('button', { name: /Continuar en Step 2/i }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1/step/2');
  });

  it('con Step 4 presentado muestra Steps 0–4 completos y lista para decisión', async () => {
    getAdaptiveCore.mockResolvedValue({
      ...SERVER_CORE,
      progressSignal: { ...SERVER_CORE.progressSignal, step: 4, health: 'ready_for_decision' },
    });
    render(<InitiativeOverviewPage />);

    expect(await screen.findByText(/Estado: Lista para decisión/i)).toBeInTheDocument();
    for (const n of [0, 1, 2, 3, 4]) expect(screen.getByTestId(`overview-step-${n}`)).toHaveAttribute('data-state', 'done');
    expect(screen.queryByRole('button', { name: /Revisar mi misi[oó]n y empezar/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver Step 4/i }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1/step/4');
  });

  it('muestra un error si no se puede cargar la iniciativa', async () => {
    getById.mockRejectedValueOnce(new Error('boom'));
    render(<InitiativeOverviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos cargar/i);
  });

  it('usa el Adaptive Core persistido como fuente visible cuando backend carga', async () => {
    render(<InitiativeOverviewPage />);

    expect(await screen.findByText('Configuracion persistida backend')).toBeInTheDocument();
    expect(screen.getAllByText(/CP-SERVER/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Continuar desde backend/)).toBeInTheDocument();
  });

  it('no muestra checkpoint activo reconstruido si falla backend Adaptive', async () => {
    getAdaptiveCore.mockRejectedValueOnce(new Error('backend down'));
    render(<InitiativeOverviewPage />);

    expect(await screen.findByText('Estado adaptativo no disponible')).toBeInTheDocument();
    expect(screen.queryByText(/CP-0\.1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Siguiente acción:/i)).not.toBeInTheDocument();
  });

  it('permite reintentar y vuelve a usar el core server como autoridad', async () => {
    getAdaptiveCore
      .mockRejectedValueOnce(new Error('backend down'))
      .mockResolvedValueOnce(SERVER_CORE);
    render(<InitiativeOverviewPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/i }));

    await waitFor(() => expect(screen.getByText('Configuracion persistida backend')).toBeInTheDocument());
    expect(screen.getAllByText(/CP-SERVER/).length).toBeGreaterThan(0);
  });
});
