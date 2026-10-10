import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectHomePage } from '../ProjectHomePage';
import { Step0Page } from '../Step0Page';
import { Step1Page } from '../Step1Page';
import { Step2Page } from '../Step2Page';
import { Step3Page } from '../Step3Page';
import { Step4Page } from '../Step4Page';

const navigate = vi.fn();
vi.mock('react-router', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useNavigate: () => navigate,
}));

const getAdaptiveCore = vi.fn();
const confirmAdaptiveCheckpoint = vi.fn();
const confirmStep0Brief = vi.fn();
const confirmStep1Output = vi.fn();
const confirmStep2Output = vi.fn();
const confirmStep3Output = vi.fn();
const confirmStep4Output = vi.fn();
const getById = vi.fn();
vi.mock('../../../features/adaptive-core/services/adaptiveCoreService', async (importOriginal) => ({
  explainCheckpointError: (await importOriginal<typeof import('../../../features/adaptive-core/services/adaptiveCoreService')>()).explainCheckpointError,
  getAdaptiveCore: (id: string) => getAdaptiveCore(id),
  confirmAdaptiveCheckpoint: (...args: any[]) => confirmAdaptiveCheckpoint(...args),
  confirmStep0Brief: (...args: any[]) => confirmStep0Brief(...args),
  confirmStep1Output: (...args: any[]) => confirmStep1Output(...args),
  confirmStep2Output: (...args: any[]) => confirmStep2Output(...args),
  confirmStep3Output: (...args: any[]) => confirmStep3Output(...args),
  confirmStep4Output: (...args: any[]) => confirmStep4Output(...args),
}));

vi.mock('../../../features/adaptive-core/components', () => ({
  AdaptiveCheckpointWorkspace: ({ checkpoint, onConfirmCheckpoint, onConfirmOutput, error }: any) => (
    <div data-testid="adaptive-workspace">
      <span>{checkpoint?.checkpointKey ?? checkpoint?.code}</span>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => onConfirmCheckpoint?.({}, checkpoint?.checkpointKey === 'CP-1.3' ? { claimId: 'claim-real', evidenceIds: ['evidence-real'], sourceRefIds: ['source-real'] } : undefined)}>Confirmar checkpoint</button>
      {onConfirmOutput && <button type="button" onClick={() => onConfirmOutput()}>Confirmar output del Step</button>}
    </div>
  ),
  CriticalChangeReview: () => null,
}));

vi.mock('../../components/autofill/AutofillField', () => ({
  AutofillField: ({ children, value, onChange }: any) => children({ value, onChange, readOnly: false }),
}));

vi.mock('../../hooks/useAutosave', () => ({
  useAutosave: () => ({ status: 'idle', lastSavedAt: null, error: null }),
}));

vi.mock('../../hooks/usePdfAutofill', () => ({
  usePdfAutofill: () => ({ state: 'idle', files: [], upload: vi.fn(), reset: vi.fn() }),
}));

vi.mock('../../hooks/useStepData', () => ({
  useStepData: () => ({ data: null, isLoading: false, error: null }),
}));

vi.mock('../../services/stepService', () => ({
  getStepData: vi.fn().mockResolvedValue(null),
  saveStepData: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/featureFlags', () => ({
  isPdfAutofillEnabled: () => false,
}));

vi.mock('../../services/projectService', () => ({
  getById: (...args: any[]) => getById(...args),
}));

vi.mock('../../step0/step0Config', async () => {
  const actual = await vi.importActual<any>('../../step0/step0Config');
  return {
    ...actual,
    hasStep0Prefill: () => false,
    getStep0Prefill: () => null,
  };
});

const appState = {
  projects: [] as any[],
  projectsLoading: false,
  setCurrentProject: vi.fn(),
  updateProject: vi.fn(),
  updateStep0: vi.fn(),
  hydrateProjectStep0FromPrefill: vi.fn(),
  getProjectMember: vi.fn(() => null),
  canAccessProject: vi.fn(() => true),
  markSponsorInvitationSent: vi.fn(),
  acceptSponsorInvitation: vi.fn(),
  updateSponsorTouchpoint: vi.fn(),
  addSponsorComment: vi.fn(),
  user: { name: 'Ana', email: 'ana@example.com', role: 'owner' },
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => appState,
  enrichProject: (raw: any) => raw,
  createTeamMember: (email: string) => ({ id: email, email, name: email, role: 'Sponsor', status: 'Pendiente', initials: 'SP' }),
}));

vi.mock('../../portfolio/PortfolioLeadContext', () => ({
  usePortfolioLead: () => ({ challenges: [], strategicFronts: [] }),
}));

const project = {
  id: 'p1',
  name: 'Iniciativa backend authority',
  description: 'No debe usar fallback local.',
  status: 'Draft',
  currentStep: 1,
  step0Status: 'En progreso',
  step0Data: {
    initiativeTitle: 'Iniciativa backend authority',
    initiativeFrame: 'exploracion',
    primaryObjective: 'aprendizaje',
    quePasaQueQuieres: 'Validar problema',
    impactWho: 'Equipo',
    currentEvidence: 'Entrevistas',
    decisionRequested: 'Seguir',
  },
  steps: [
    { id: 's1', number: 1, name: 'Step 1 legacy', status: 'Bloqueado', progress: 0, modules: [] },
    { id: 's2', number: 2, name: 'Step 2 legacy', status: 'Bloqueado', progress: 0, modules: [] },
    { id: 's3', number: 3, name: 'Step 3 legacy', status: 'Bloqueado', progress: 0, modules: [] },
    { id: 's4', number: 4, name: 'Step 4 legacy', status: 'Bloqueado', progress: 0, modules: [] },
  ],
  team: [],
  evidence: [],
  createdAt: '2026-08-04T00:00:00.000Z',
  lastModified: '2026-08-04T00:00:00.000Z',
};

const serverCore = {
  schemaVersion: 'PRD-03-v0.4',
  masterContext: {
    id: 'mc1',
    version: 1,
    routeType: 'server_route',
    depthLevel: 'standard',
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
    checkpointKey: 'CP-0.1',
    status: 'ready',
    sequence: 1,
    questions: [],
    configurationId: 'cfg-0',
  },
  progressSignal: {
    id: 'sig1',
    step: 0,
    checkpointCode: 'CP-0.1',
    checkpointTitle: 'Server checkpoint',
    health: 'healthy',
    hypothesis: '',
    evidence: '',
    evidenceStrength: 'weak',
    blocker: '',
    actorRequired: '',
    nextAction: 'Accion server.',
    upcomingDecision: '',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
  stepConfigurations: [
    {
      id: 'cfg-0',
      step: 0,
      version: 1,
      visibleName: 'Step 0 server',
      stablePurpose: 'Server',
      objective: 'Server objective',
      expectedOutput: 'Server output',
      routeType: 'server_route',
      depthLevel: 'standard',
      generatedAt: '2026-08-04T00:00:00.000Z',
      generatedBy: 'backend',
      closureCriteria: [],
      checkpoints: [
        { id: 'cp-server', step: 0, code: 'CP-0.1', title: 'Server checkpoint', purpose: 'Server only', status: 'ready', outputKey: 'Brief', completionCriteria: [], questions: [], gates: [] },
      ],
    },
  ],
  checkpointInstances: [],
  stepOutputs: [],
  auditEvents: [],
};

const serverCoreAtStep = (step: 0 | 1 | 2 | 3 | 4, checkpointKey = `CP-${step}.1`) => ({
  ...serverCore,
  activeStepConfigurationId: `cfg-${step}`,
  activeCheckpoint: {
    id: `cp-${step}`,
    step,
    checkpointKey,
    status: 'ready',
    sequence: 1,
    questions: [],
    configurationId: `cfg-${step}`,
  },
  progressSignal: {
    ...serverCore.progressSignal,
    step,
    checkpointCode: checkpointKey,
    checkpointTitle: `Checkpoint Step ${step}`,
    nextAction: `Continuar Step ${step} desde backend.`,
  },
  stepConfigurations: [0, 1, 2, 3, 4].map((item) => ({
    id: `cfg-${item}`,
    step: item,
    version: 1,
    visibleName: `Step ${item} server`,
    stablePurpose: `Server step ${item}`,
    objective: `Server objective ${item}`,
    expectedOutput: `Server output ${item}`,
    routeType: 'server_route',
    depthLevel: 'standard',
    generatedAt: '2026-08-04T00:00:00.000Z',
    generatedBy: 'backend',
    closureCriteria: [],
    checkpoints: [
      { id: `cp-${item}`, step: item, code: `CP-${item}.1`, title: `Checkpoint Step ${item}`, purpose: 'Server only', status: item === step ? 'ready' : item < step ? 'completed' : 'locked', outputKey: `Step ${item}`, completionCriteria: [], questions: [], gates: [] },
    ],
  })),
  stepOutputs: Array.from({ length: step }, (_, index) => ({
    id: `out-${index}`,
    step: index,
    status: 'confirmed',
    version: 1,
    output: {},
  })),
});

const serverCoreStep0ReadyForBrief = (withDraft = true) => ({
  ...serverCore,
  activeStepConfigurationId: 'cfg-0',
  activeCheckpoint: null,
  progressSignal: {
    ...serverCore.progressSignal,
    step: 0,
    checkpointCode: 'CP-0.3',
    checkpointTitle: 'Definir que validar o decidir',
  },
  stepConfigurations: [
    {
      id: 'cfg-0',
      step: 0,
      version: 1,
      visibleName: 'Step 0 server',
      stablePurpose: 'Server',
      objective: 'Server objective',
      expectedOutput: 'Server output',
      routeType: 'server_route',
      depthLevel: 'standard',
      generatedAt: '2026-08-04T00:00:00.000Z',
      generatedBy: 'backend',
      closureCriteria: [],
      checkpoints: [
        { id: 'cp-01', step: 0, code: 'CP-0.1', title: 'Enmarcar la iniciativa', purpose: 'Server only', status: 'completed', outputKey: 'Brief', completionCriteria: [], questions: [], gates: [] },
        { id: 'cp-02', step: 0, code: 'CP-0.2', title: 'Aterrizar condiciones reales', purpose: 'Server only', status: 'completed', outputKey: 'Brief', completionCriteria: [], questions: [], gates: [] },
        { id: 'cp-03', step: 0, code: 'CP-0.3', title: 'Definir que validar o decidir', purpose: 'Server only', status: 'completed', outputKey: 'Brief', completionCriteria: [], questions: [], gates: [] },
      ],
    },
  ],
  checkpointInstances: [
    { id: 'cp-01', step: 0, checkpointKey: 'CP-0.1', status: 'completed', sequence: 1, questions: [], configurationId: 'cfg-0' },
    { id: 'cp-02', step: 0, checkpointKey: 'CP-0.2', status: 'completed', sequence: 2, questions: [], configurationId: 'cfg-0' },
    { id: 'cp-03', step: 0, checkpointKey: 'CP-0.3', status: 'completed', sequence: 3, questions: [], configurationId: 'cfg-0' },
  ],
  stepOutputs: withDraft
    ? [{ id: 'step0-draft', step: 0, status: 'draft', version: 1, output: { priorityHypothesis: 'H1', availableEvidence: [], actors: ['Owner'], decisionCriteria: 'D1' } }]
    : [],
});

async function showStep0AdvanceCta() {
  fireEvent.click(await screen.findByRole('button', { name: /Elaborar/i }));
  return screen.findAllByRole('button', { name: /Avanzar a Step 1/i });
}

describe('Adaptive authority in pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    appState.projects = [project];
    getAdaptiveCore.mockReset();
    confirmStep2Output.mockReset();
    confirmStep1Output.mockReset();
    confirmStep3Output.mockReset();
    confirmStep4Output.mockReset();
    confirmStep0Brief.mockReset();
    confirmAdaptiveCheckpoint.mockReset();
    getById.mockReset();
    getById.mockResolvedValue(project);
  });

  it('ProjectHome blocks operational Adaptive journey when backend core fails', async () => {
    getAdaptiveCore.mockRejectedValueOnce(new Error('down'));

    render(<ProjectHomePage />);

    expect(await screen.findByText(/No pudimos cargar el estado adaptativo persistido/i)).toBeInTheDocument();
    expect(screen.queryByText(/Step activo:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CP-0\.1/i)).not.toBeInTheDocument();
  });

  it('ProjectHome retry promotes loaded server core to authoritative journey', async () => {
    getAdaptiveCore.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(serverCore);

    render(<ProjectHomePage />);
    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/i }));

    await waitFor(() => expect(screen.getByText(/Step activo: 0/i)).toBeInTheDocument());
    expect(screen.getAllByText(/Accion server/i).length).toBeGreaterThan(0);
  });

  it('Step0 blocks Adaptive confirmation workspace when backend core fails', async () => {
    getAdaptiveCore.mockRejectedValueOnce(new Error('down'));

    render(<Step0Page />);

    expect(await screen.findByText(/Estado adaptativo no disponible/i)).toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-workspace')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar checkpoint/i })).not.toBeInTheDocument();
  });

  it('Step0 retry renders confirmation workspace only from server core', async () => {
    getAdaptiveCore.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(serverCore);

    render(<Step0Page />);
    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/i }));

    await waitFor(() => expect(screen.getByTestId('adaptive-workspace')).toBeInTheDocument());
    expect(screen.getAllByText('CP-0.1').length).toBeGreaterThan(0);
  });

  it('Step0 visible advance CTA confirms the Adaptive brief and waits before navigating', async () => {
    appState.projects = [{ ...project, step0Data: { ...project.step0Data, alignmentStatus: 'aligned' } }];
    getAdaptiveCore.mockResolvedValueOnce(serverCoreStep0ReadyForBrief());
    let resolveConfirm!: (core: any) => void;
    confirmStep0Brief.mockReturnValueOnce(new Promise(resolve => {
      resolveConfirm = resolve;
    }));

    render(<Step0Page />);
    const advanceButtons = await showStep0AdvanceCta();
    fireEvent.click(advanceButtons[0]);

    await waitFor(() => expect(confirmStep0Brief).toHaveBeenCalledTimes(1));
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/1');

    resolveConfirm(serverCoreAtStep(1, 'CP-1.1'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/projects/p1/step/1'));
  });

  it('Step0 does not navigate when the confirmed core does not expose CP-1.1', async () => {
    appState.projects = [{ ...project, step0Data: { ...project.step0Data, alignmentStatus: 'aligned' } }];
    getAdaptiveCore
      .mockResolvedValueOnce(serverCoreStep0ReadyForBrief())
      .mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.2'));
    confirmStep0Brief.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.2'));

    render(<Step0Page />);
    const advanceButtons = await showStep0AdvanceCta();
    fireEvent.click(advanceButtons[0]);

    await waitFor(() => expect(confirmStep0Brief).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getAllByText('Step 0 aún no está confirmado en Adaptive Core.').length).toBeGreaterThan(0),
    );
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/1');
  });

  it('Step0 does not navigate when there is no Adaptive Step 0 draft output', async () => {
    appState.projects = [{ ...project, step0Data: { ...project.step0Data, alignmentStatus: 'aligned' } }];
    getAdaptiveCore.mockResolvedValueOnce(serverCoreStep0ReadyForBrief(false));

    render(<Step0Page />);
    const advanceButtons = await showStep0AdvanceCta();
    fireEvent.click(advanceButtons[0]);

    await waitFor(() =>
      expect(screen.getAllByText('Step 0 aún no está confirmado en Adaptive Core.').length).toBeGreaterThan(0),
    );
    expect(confirmStep0Brief).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/1');
  });

  it('Step0 keeps pending feedback non-blocking and continues with Adaptive confirmation', async () => {
    getAdaptiveCore.mockResolvedValueOnce(serverCoreStep0ReadyForBrief());
    confirmStep0Brief.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.1'));

    render(<Step0Page />);
    const advanceButtons = await showStep0AdvanceCta();
    fireEvent.click(advanceButtons[0]);

    expect(await screen.findByText(/Feedback del sponsor pendiente/i)).toBeInTheDocument();
    const modalAdvanceButtons = screen.getAllByRole('button', { name: /^Avanzar a Step 1$/i });
    fireEvent.click(modalAdvanceButtons[modalAdvanceButtons.length - 1]);

    await waitFor(() => expect(confirmStep0Brief).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/projects/p1/step/1'));
  });

  it('Step0 does not expose direct Step 1 advance when Adaptive Core did not load', async () => {
    getAdaptiveCore.mockRejectedValueOnce(new Error('down'));

    render(<Step0Page />);

    expect(await screen.findByText(/Estado adaptativo no disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Avanzar a Step 1/i })).not.toBeInTheDocument();
    expect(confirmStep0Brief).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/1');
  });

  it('Step1 fetches the project by route id when AppContext does not have it', async () => {
    appState.projects = [];
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.1'));

    render(<Step1Page />);

    await waitFor(() => expect(getById).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText(/Proyecto o Step no encontrado/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/No pudimos cargar el proyecto/i)).not.toBeInTheDocument();
  });

  it('Step1 renders the Adaptive workspace and active checkpoint instead of legacy modules', async () => {
    getAdaptiveCore.mockResolvedValue(serverCoreAtStep(1, 'CP-1.1'));

    render(<Step1Page />);

    expect(await screen.findByTestId('adaptive-workspace')).toBeInTheDocument();
    expect(screen.getByText('CP-1.1')).toBeInTheDocument();
    expect(screen.queryByText(/Módulo A: Análisis inicial del problema/i)).not.toBeInTheDocument();
  });

  it('Step1 direct route shows an explicit Step 0 confirmation guard when core is still Step 0', async () => {
    getAdaptiveCore.mockResolvedValueOnce(serverCore);

    render(<Step1Page />);

    expect(await screen.findByText('Step 0 aún debe confirmarse antes de iniciar Step 1.')).toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-workspace')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Volver a Step 0/i }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1/step/0');
  });

  it('Step1 with CP-1.1 still renders the Adaptive workspace', async () => {
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.1'));

    render(<Step1Page />);

    expect(await screen.findByTestId('adaptive-workspace')).toBeInTheDocument();
    expect(screen.getByText('CP-1.1')).toBeInTheDocument();
    expect(screen.queryByText(/Step 0 aún debe confirmarse/i)).not.toBeInTheDocument();
  });

  it('Step1 confirms only the active checkpoint and renders the next one after Core reload', async () => {
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.1'));
    confirmAdaptiveCheckpoint.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.2'));

    render(<Step1Page />);
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar checkpoint/i }));

    await waitFor(() => expect(confirmAdaptiveCheckpoint).toHaveBeenCalledTimes(1));
    expect(confirmAdaptiveCheckpoint.mock.calls[0][1]).toMatchObject({ checkpointKey: 'CP-1.1' });
    expect(screen.getByText('CP-1.2')).toBeInTheDocument();
    expect(confirmAdaptiveCheckpoint).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ checkpointKey: 'CP-1.2' }));
  });

  it('Step1 completes checkpoints one at a time and confirms output before Step 2', async () => {
    const cp14Draft = {
      ...serverCoreAtStep(1, 'CP-1.4'),
      stepOutputs: [{ id: 'step1-draft', step: 1, status: 'draft', version: 1, output: { synthesis: 'draft' } }],
    };
    const step2Core = serverCoreAtStep(2, 'CP-2.1');
    getAdaptiveCore
      .mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.1'))
      .mockResolvedValueOnce(step2Core);
    confirmAdaptiveCheckpoint
      .mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.2'))
      .mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.3'))
      .mockResolvedValueOnce(cp14Draft)
      .mockResolvedValueOnce(cp14Draft);
    confirmStep1Output.mockResolvedValueOnce({});

    render(<Step1Page />);
    for (const expectedCheckpoint of ['CP-1.1', 'CP-1.2', 'CP-1.3', 'CP-1.4']) {
      expect(await screen.findByText(expectedCheckpoint)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Confirmar checkpoint/i }));
      await waitFor(() => expect(confirmAdaptiveCheckpoint).toHaveBeenCalledTimes(
        ['CP-1.1', 'CP-1.2', 'CP-1.3', 'CP-1.4'].indexOf(expectedCheckpoint) + 1,
      ));
    }

    expect(confirmAdaptiveCheckpoint).toHaveBeenCalledTimes(4);
    expect(confirmAdaptiveCheckpoint.mock.calls[2][1]).toMatchObject({
      checkpointKey: 'CP-1.3',
      truthBindings: {
        claimId: 'claim-real',
        evidenceIds: ['evidence-real'],
        sourceRefIds: ['source-real'],
      },
    });
    expect(screen.getByRole('button', { name: /Confirmar output del Step/i })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/2');

    fireEvent.click(screen.getByRole('button', { name: /Confirmar output del Step/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/projects/p1/step/2'));
    expect(confirmStep1Output).toHaveBeenCalledTimes(1);
  });

  it.each([
    'Claim sin soporte validado',
    'Contradiccion abierta',
    'Evidence o SourceRef incompatible',
  ])('keeps CP-1.3 active and exposes backend rejection: %s', async (message) => {
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.3'));
    confirmAdaptiveCheckpoint.mockRejectedValueOnce({ response: { data: { error: { message } } } });

    render(<Step1Page />);
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar checkpoint/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText('CP-1.3')).toBeInTheDocument();
    expect(confirmAdaptiveCheckpoint).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/2');
  });

  it('allows retrying CP-1.3 without creating duplicate truth entities', async () => {
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.3'));
    confirmAdaptiveCheckpoint.mockRejectedValueOnce(new Error('retryable gate')).mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.4'));

    render(<Step1Page />);
    const confirm = await screen.findByRole('button', { name: /Confirmar checkpoint/i });
    fireEvent.click(confirm);
    await screen.findByRole('alert');
    fireEvent.click(confirm);

    await waitFor(() => expect(confirmAdaptiveCheckpoint).toHaveBeenCalledTimes(2));
    expect(confirmAdaptiveCheckpoint.mock.calls[0][1]).toMatchObject({
      checkpointKey: 'CP-1.3',
      responses: {},
      truthBindings: { claimId: 'claim-real', evidenceIds: ['evidence-real'], sourceRefIds: ['source-real'] },
    });
    expect(confirmAdaptiveCheckpoint.mock.calls[1][1]).toMatchObject({
      checkpointKey: confirmAdaptiveCheckpoint.mock.calls[0][1].checkpointKey,
      responses: confirmAdaptiveCheckpoint.mock.calls[0][1].responses,
      truthBindings: confirmAdaptiveCheckpoint.mock.calls[0][1].truthBindings,
    });
  });

  it('Step2 and Step3 render the Adaptive workspace as their primary surface', async () => {
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(2, 'CP-2.1'));
    render(<Step2Page />);
    expect(await screen.findByTestId('adaptive-workspace')).toBeInTheDocument();
    expect(screen.getByText('CP-2.1')).toBeInTheDocument();
    expect(screen.queryByText(/Módulo A · HMW/i)).not.toBeInTheDocument();

    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(3, 'CP-3.1'));
    render(<Step3Page />);
    expect(await screen.findAllByTestId('adaptive-workspace')).not.toHaveLength(0);
    expect(screen.getByText('CP-3.1')).toBeInTheDocument();
    expect(screen.queryByText(/SUBMÓDULOS/i)).not.toBeInTheDocument();
  });

  it('Step2 fetches the project by route id when AppContext does not have it', async () => {
    appState.projects = [];
    getAdaptiveCore.mockResolvedValue(serverCoreAtStep(2, 'CP-2.1'));

    render(<Step2Page />);

    await waitFor(() => expect(getById).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText(/^Proyecto no encontrado\.$/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/No pudimos cargar el proyecto/i)).not.toBeInTheDocument();
  });

  it('Step3 fetches the project by route id when AppContext does not have it', async () => {
    appState.projects = [];
    getAdaptiveCore.mockResolvedValue(serverCoreAtStep(3, 'CP-3.1'));

    render(<Step3Page />);

    await waitFor(() => expect(getById).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText(/^Proyecto no encontrado\.$/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/No pudimos cargar el proyecto/i)).not.toBeInTheDocument();
  });

  it('Step4 fetches the project by route id when AppContext does not have it', async () => {
    appState.projects = [];
    getAdaptiveCore.mockResolvedValue(serverCoreAtStep(4, 'CP-4.1'));

    render(<Step4Page />);

    await waitFor(() => expect(getById).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText(/^Proyecto no encontrado\.$/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/No pudimos cargar el proyecto/i)).not.toBeInTheDocument();
  });

  it('shows a real load error once when route project hydration fails', async () => {
    appState.projects = [];
    getById.mockRejectedValueOnce(new Error('not found'));

    render(<Step1Page />);

    expect(await screen.findByText(/No pudimos cargar el proyecto/i)).toBeInTheDocument();
    expect(screen.queryByText(/Proyecto o Step no encontrado/i)).not.toBeInTheDocument();
    expect(getById).toHaveBeenCalledTimes(1);
  });

  it('prefers the AppContext project and does not fetch redundantly', async () => {
    appState.projects = [project];

    render(<Step1Page />);

    await waitFor(() => expect(screen.queryByText(/Proyecto o Step no encontrado/i)).not.toBeInTheDocument());
    expect(getById).not.toHaveBeenCalled();
  });

  it('ProjectHome does not allow Step 2 access from legacy approval when server core is still Step 1', async () => {
    appState.projects = [{
      ...project,
      step0Status: 'Completado',
      currentStep: 2,
      steps: [
        { id: 's1', number: 1, name: 'Step 1 legacy', status: 'Aprobado', progress: 100, modules: [] },
        { id: 's2', number: 2, name: 'Step 2 legacy', status: 'En progreso', progress: 10, modules: [] },
        { id: 's3', number: 3, name: 'Step 3 legacy', status: 'Bloqueado', progress: 0, modules: [] },
        { id: 's4', number: 4, name: 'Step 4 legacy', status: 'Bloqueado', progress: 0, modules: [] },
      ],
    }];
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(1, 'CP-1.3'));

    render(<ProjectHomePage />);

    await waitFor(() => expect(screen.getByText(/Step activo: 1/i)).toBeInTheDocument());
    fireEvent.click(screen.getAllByText(/Step 2: Step 2 server/i).at(-1)!);

    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/2');
  });

  it('ProjectHome allows Step 2 access from server core even when legacy state is stale', async () => {
    appState.projects = [{
      ...project,
      step0Status: 'Completado',
      currentStep: 1,
      steps: [
        { id: 's1', number: 1, name: 'Step 1 legacy', status: 'Bloqueado', progress: 0, modules: [] },
        { id: 's2', number: 2, name: 'Step 2 legacy', status: 'Bloqueado', progress: 0, modules: [] },
        { id: 's3', number: 3, name: 'Step 3 legacy', status: 'Bloqueado', progress: 0, modules: [] },
        { id: 's4', number: 4, name: 'Step 4 legacy', status: 'Bloqueado', progress: 0, modules: [] },
      ],
    }];
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(2, 'CP-2.1'));

    render(<ProjectHomePage />);

    await waitFor(() => expect(screen.getByText(/Step activo: 2/i)).toBeInTheDocument());
    fireEvent.click(screen.getAllByText(/Step 2: Step 2 server/i).at(-1)!);

    expect(navigate).toHaveBeenCalledWith('/projects/p1/step/2');
  });

  it('blocks direct Step 3 route when server core is still Step 2 even if legacy says Step 3 is available', async () => {
    appState.projects = [{
      ...project,
      step0Status: 'Completado',
      currentStep: 3,
      steps: [
        { id: 's1', number: 1, name: 'Step 1 legacy', status: 'Aprobado', progress: 100, modules: [] },
        { id: 's2', number: 2, name: 'Step 2 legacy', status: 'Aprobado', progress: 100, modules: [] },
        { id: 's3', number: 3, name: 'Step 3 legacy', status: 'En progreso', progress: 10, modules: [] },
        { id: 's4', number: 4, name: 'Step 4 legacy', status: 'Bloqueado', progress: 0, modules: [] },
      ],
    }];
    getAdaptiveCore.mockResolvedValueOnce(serverCoreAtStep(2, 'CP-2.3'));

    render(<Step3Page />);

    expect(await screen.findByText(/Step 3 bloqueado/i)).toBeInTheDocument();
    expect(screen.getByText(/El backend Adaptive Core todavia no habilita Step 3/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith('/projects/p1/step/4');
  });
});
