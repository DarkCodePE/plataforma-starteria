import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../../../../app/context/AppContext';
import type { AdaptiveInitiativeCore } from '../../../adaptive-core/domain/types';
import { ContinuityOverview, ContinuityStepWorkspace, HistoricalStepContinuity, StepProgressPanel } from '../ContinuityExperience';

const project = {
  id: 'kan178-project-ready', name: 'Iniciativa operativa KAN-178', description: 'Mejorar la continuidad operativa',
  currentStep: 2, status: 'En progreso', step0Status: 'Completado', mentorCredits: 3,
  steps: [], team: [], evidence: [], createdAt: '', lastModified: '',
} as unknown as Project;

const core = {
  schemaVersion: 'PRD-03-v0.4',
  cycle: { id: 'cycle-1', currentStep: 2, status: 'active' },
  masterContext: {
    id: 'context-1', version: 1, routeType: 'explore_validate', depthLevel: 'standard', maturity: 'in_execution',
    knownFacts: [], assumptions: [], missingCriticalInformation: [], risks: [], decisions: [], contextSnapshots: [], createdAt: '',
    challengeSnapshot: { id: 'challenge-1', title: 'Reducir la fricción del handoff' },
  },
  stepConfigurations: [{
    id: 'step2-v1', step: 2, version: 1, visibleName: 'Preparar una prueba', stablePurpose: '', objective: 'Preparar una apuesta validable',
    expectedOutput: 'Apuesta validable', routeType: 'explore_validate', depthLevel: 'standard', checkpoints: [], closureCriteria: [], generatedAt: '', generatedBy: 'deterministic_fallback',
  }],
  activeStepConfigurationId: 'step2-v1',
  progressSignal: { id: 'signal-1', step: 2, checkpointCode: '', checkpointTitle: '', health: 'attention', hypothesis: '', evidence: '', evidenceStrength: 'none', blocker: '', actorRequired: '', nextAction: 'Preparar el entregable y su medición', upcomingDecision: '', updatedAt: '' },
  activeCheckpoint: null, checkpointInstances: [], confirmedResponses: {}, evidence: [], sourceRefs: [], truthClaims: [], stepOutputs: [], auditEvents: [],
} as unknown as AdaptiveInitiativeCore;

describe('MVP-LITE-01 continuidad y Steps simplificados', () => {
  it('muestra identidad, reto, Step del ciclo y un CTA principal', () => {
    const onOpenStep = vi.fn();
    render(<ContinuityOverview project={project} core={core} state="loaded" onRetry={vi.fn()} onOpenStep={onOpenStep} />);
    expect(screen.getByText(/Reto: Reducir la fricción del handoff/)).toBeInTheDocument();
    expect(screen.getByText('Step actual: 2')).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /continuar step 2/i });
    fireEvent.click(cta);
    expect(onOpenStep).toHaveBeenCalledWith(2);
  });

  it('usa cycle.currentStep aunque otras proyecciones diverjan', () => {
    const divergent = { ...core, cycle: { id: 'cycle-1', currentStep: 1 }, progressSignal: { ...core.progressSignal, step: 2 } } as unknown as AdaptiveInitiativeCore;
    render(<ContinuityOverview project={project} core={divergent} state="loaded" onRetry={vi.fn()} onOpenStep={vi.fn()} />);
    expect(screen.getByText('Step actual: 1')).toBeInTheDocument();
  });

  it('etiqueta anteriores sin output con el texto contractual exacto', () => {
    render(<ContinuityOverview project={project} core={core} state="loaded" onRetry={vi.fn()} onOpenStep={vi.fn()} />);
    expect(screen.getAllByText('anterior en el recorrido · resultado no documentado')).toHaveLength(2);
    expect(screen.queryByText('Confirmado por una persona')).not.toBeInTheDocument();
  });

  it('ignora borradores como resultado recuperable', () => {
    const withDraft = { ...core, stepOutputs: [{ step: 0, status: 'draft', version: 4, output: { summary: 'No canónico' } }] } as unknown as AdaptiveInitiativeCore;
    render(<ContinuityOverview project={project} core={withDraft} state="loaded" onRetry={vi.fn()} onOpenStep={vi.fn()} />);
    expect(screen.queryByText('No canónico')).not.toBeInTheDocument();
    expect(screen.getAllByText('anterior en el recorrido · resultado no documentado')).toHaveLength(2);
  });

  it('abre un output confirmado con versión y procedencia reales', () => {
    const withOutput = { ...core, stepOutputs: [{ step: 0, status: 'confirmed', version: 3, source: 'Adaptive Core', confirmedAt: '2026-10-25T12:00:00.000Z', output: { decisionFrame: 'Priorizar activación' } }] } as unknown as AdaptiveInitiativeCore;
    render(<ContinuityOverview project={project} core={withOutput} state="loaded" onRetry={vi.fn()} onOpenStep={vi.fn()} />);
    fireEvent.click(screen.getByText('Ver resultado del Step'));
    expect(screen.getByText('Priorizar activación')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('Origen: Adaptive Core')).toBeInTheDocument();
  });

  it('no presenta 0/0 ni porcentaje cuando no hay checkpoints', () => {
    render(<StepProgressPanel core={core} step={2} />);
    expect(screen.getByText(/La revisión de este Step aún no está preparada/)).toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('calcula progreso sólo con checkpoints reales y check sólo para completed', () => {
    const checkpoints = [
      { id: 'cp1', code: 'CP-2.1', title: 'Entregable', purpose: '', status: 'completed', outputKey: 'a', completionCriteria: [], questions: [], gates: [] },
      { id: 'cp2', code: 'CP-2.2', title: 'Medición', purpose: '', status: 'in_progress', outputKey: 'b', completionCriteria: [], questions: [], gates: [] },
      { id: 'cp3', code: 'CP-2.3', title: 'Readiness', purpose: '', status: 'locked', outputKey: 'c', completionCriteria: [], questions: [], gates: [] },
    ];
    const withProgress = { ...core, stepConfigurations: [{ ...core.stepConfigurations[0], checkpoints }], activeCheckpoint: { id: 'cp2-instance', step: 2, checkpointKey: 'CP-2.2', status: 'in_progress', sequence: 2, version: 0, questions: [], configurationId: 'step2-v1' } } as unknown as AdaptiveInitiativeCore;
    render(<StepProgressPanel core={withProgress} step={2} onReviewCheckpoint={vi.fn()} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Confirmado')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Revisar checkpoint' })).toBeInTheDocument();
  });

  it('presenta misión route-aware y guía de plataforma sin Copilot ficticio', () => {
    const reconstruct = { ...core, masterContext: { ...core.masterContext, routeType: 'reconstruct_existing' }, stepConfigurations: [{ ...core.stepConfigurations[0], routeType: 'reconstruct_existing' }] } as unknown as AdaptiveInitiativeCore;
    render(<ContinuityStepWorkspace projectName={project.name} step={2} core={reconstruct} state="loaded" onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getAllByText(/estado real reconstruido/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Guía de plataforma · no es un Copilot LLM/i)).toBeInTheDocument();
    expect(screen.queryByText(/Copilot especializado/i)).not.toBeInTheDocument();
  });

  it('muestra checkpoint ausente y revisión no disponible sin crear controles', () => {
    render(<ContinuityStepWorkspace projectName={project.name} step={2} core={core} state="loaded" onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getAllByText(/La revisión de este Step aún no está preparada/)).toHaveLength(1);
    expect(screen.queryByText(/La revisión oficial no está disponible/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Revisión oficial del checkpoint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/0\/0|0%/)).not.toBeInTheDocument();
  });

  it('ofrece una sola entrada de ayuda y ningún envío simulado', () => {
    render(<ContinuityStepWorkspace projectName={project.name} step={2} core={core} state="loaded" onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Pedir ayuda' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir ayuda' }));
    expect(screen.getByRole('dialog', { name: /qué necesitas resolver/i })).toBeInTheDocument();
    expect(screen.getByText(/No hay un canal persistente verificado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar consulta/i })).not.toBeInTheDocument();
  });

  it('mantiene el Step histórico en sólo lectura y sin sesión retroactiva', () => {
    render(<HistoricalStepContinuity projectName={project.name} step={1} operationalStep={2} core={core} state="loaded" onRetry={vi.fn()} onBack={vi.fn()} onReturnOperational={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Histórico de Step 1/i })).toBeInTheDocument();
    expect(screen.getByText('anterior en el recorrido · resultado no documentado')).toBeInTheDocument();
    expect(screen.getByText(/no lo reabre ni crea una sesión/i)).toBeInTheDocument();
    expect(screen.getByText(/No existe un resultado canónico documentado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver a mi Step actual/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('historical-no-output-notice')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
  });

  it('vincula el título histórico a sourceConfigurationId y no a una versión nueva', () => {
    const versioned = { ...core, stepConfigurations: [{ ...core.stepConfigurations[0], id: 'step1-v1', step: 1, version: 1, expectedOutput: 'Resultado original' }, { ...core.stepConfigurations[0], id: 'step1-v2', step: 1, version: 2, expectedOutput: 'Resultado redefinido' }], stepOutputs: [{ step: 1, status: 'confirmed', version: 1, sourceConfigurationId: 'step1-v1', output: { decision: 'Continuar' } }] } as unknown as AdaptiveInitiativeCore;
    render(<HistoricalStepContinuity projectName={project.name} step={1} operationalStep={2} core={versioned} state="loaded" onRetry={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Ver resultado del Step'));
    expect(screen.getByText('Resultado original')).toBeInTheDocument();
    expect(screen.queryByText('Resultado redefinido')).not.toBeInTheDocument();
  });

  it('CHAT-02 renders collapsed result sections with explicit ARIA state', () => {
    const checkpoints = [
      { id: 'cp1', code: 'CP-2.1', title: 'Entregable', purpose: '', status: 'completed', outputKey: 'a', completionCriteria: [], questions: [], gates: [] },
      { id: 'cp2', code: 'CP-2.2', title: 'Medicion', purpose: '', status: 'in_progress', outputKey: 'b', completionCriteria: [], questions: [], gates: [] },
    ];
    const configured = { ...core, stepConfigurations: [{ ...core.stepConfigurations[0], checkpoints }] } as unknown as AdaptiveInitiativeCore;
    render(<StepProgressPanel core={configured} step={2} />);

    const trigger = screen.getByRole('button', { name: /CP-2\.1.*Entregable/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls');
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toHaveAttribute('hidden');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)).not.toHaveAttribute('hidden');
  });

  it('CHAT-02 distinguishes a completed Step and only offers Core-enabled continuity', () => {
    const completed = {
      ...core,
      cycle: { id: 'cycle-1', currentStep: 3, status: 'active' },
      activeStepConfigurationId: 'step3-v1',
      stepConfigurations: [...core.stepConfigurations, { ...core.stepConfigurations[0], id: 'step3-v1', step: 3, visibleName: 'Ejecutar y aprender', expectedOutput: 'Aprendizaje trazable', checkpoints: [{ id: 'cp3', code: 'CP-3.1', title: 'Ejecución', status: 'in_progress' }] }],
      stepOutputs: [{ step: 2, status: 'confirmed', version: 4, source: 'Adaptive Core', confirmedAt: '2026-10-28T08:30:00.000Z', output: { solution: 'Piloto acotado', measurementPlan: 'Comparar baseline y resultado' } }],
    } as unknown as AdaptiveInitiativeCore;
    const onContinueNext = vi.fn();
    render(<ContinuityStepWorkspace projectName={project.name} step={2} core={completed} state="loaded" onRetry={vi.fn()} onBack={vi.fn()} onContinueNext={onContinueNext}><div>Editor que no debe mostrarse</div></ContinuityStepWorkspace>);

    expect(screen.getByRole('heading', { name: 'Step 2 completado' })).toBeInTheDocument();
    expect(screen.queryByText(/Qué vas a lograr/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CP-3\.1/)).not.toBeInTheDocument();
    expect(screen.queryByText('Aprendizaje trazable')).not.toBeInTheDocument();
    expect(screen.queryByText('Editor que no debe mostrarse')).not.toBeInTheDocument();
    const next = screen.getByRole('button', { name: /Continuar Step 3/i });
    fireEvent.click(next);
    expect(onContinueNext).toHaveBeenCalledOnce();
  });
});
