import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { AdaptiveCheckpointWorkspace } from '../AdaptiveCheckpointWorkspace';
import type { AdaptiveInitiativeCore, AdaptiveQuestion, StepCheckpoint } from '../../domain/types';

const question: AdaptiveQuestion = {
  id: 'q-owner',
  checkpointId: 'cp-0-1',
  checkpointKey: 'CP-0.1',
  prompt: 'Quien debe validar esta iniciativa?',
  purpose: 'Identificar responsable',
  clarifiesVariable: 'owner_and_actor_required',
  priority: 'must',
  answerType: 'owner',
  reason: 'Sin responsable no se puede adaptar el siguiente paso.',
  source: 'critical_missing',
  allowsUnknown: false,
  optional: false,
};

const checkpoint: StepCheckpoint = {
  id: 'cp-0-1',
  step: 0,
  code: 'CP-0.1',
  title: 'Validar punto de partida',
  purpose: 'Aclarar la informacion minima antes de generar el Brief.',
  status: 'ready',
  outputKey: 'confirmStep0Brief',
  completionCriteria: ['Responsable identificado'],
  questions: [question],
  gates: [],
};

const core: AdaptiveInitiativeCore = {
  schemaVersion: 'PRD-03-v0.4',
  masterContext: {
    id: 'ctx-1',
    version: 1,
    routeType: 'explore_validate',
    depthLevel: 'standard',
    maturity: 'idea',
    knownFacts: [],
    assumptions: [],
    missingCriticalInformation: [],
    risks: [],
    decisions: [],
    contextSnapshots: [],
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  stepConfigurations: [{
    id: 'cfg-0',
    step: 0,
    version: 1,
    visibleName: 'Step 0',
    stablePurpose: 'Inicio',
    objective: 'Ordenar el punto de partida',
    expectedOutput: 'Brief adaptativo',
    routeType: 'explore_validate',
    depthLevel: 'standard',
    checkpoints: [checkpoint],
    closureCriteria: ['Brief confirmado'],
    generatedAt: '2026-08-04T00:00:00.000Z',
    generatedBy: 'deterministic_fallback',
  }],
  activeStepConfigurationId: 'cfg-0',
  progressSignal: {
    id: 'signal-1',
    step: 0,
    checkpointCode: 'CP-0.1',
    checkpointTitle: 'Validar punto de partida',
    health: 'attention',
    hypothesis: 'Falta responsable',
    evidence: '',
    evidenceStrength: 'weak',
    blocker: '',
    actorRequired: '',
    nextAction: 'Responder checkpoint',
    upcomingDecision: '',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
  activeCheckpoint: null,
  auditEvents: [],
};

describe('AdaptiveCheckpointWorkspace', () => {
  it('prioritizes checkpoint questions and sends answers before confirmation', () => {
    const onConfirmCheckpoint = vi.fn();
    render(
      <AdaptiveCheckpointWorkspace
        core={core}
        step={0}
        checkpoint={checkpoint}
        questions={[question]}
        onConfirmCheckpoint={onConfirmCheckpoint}
      />,
    );

    expect(screen.getByRole('region', { name: 'Workspace adaptativo del checkpoint' })).toBeInTheDocument();
    expect(screen.getByText('Preguntas mínimas para avanzar')).toBeInTheDocument();
    expect(screen.getByText('Quien debe validar esta iniciativa?')).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: /Confirmar checkpoint/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Quien debe validar esta iniciativa?'), {
      target: { value: 'La directora de operaciones' },
    });
    fireEvent.click(confirm);

    expect(onConfirmCheckpoint).toHaveBeenCalledWith({
      owner_and_actor_required: 'La directora de operaciones',
    }, undefined);
  });

  it('muestra prioridad, ruta y output en lenguaje claro, sin claves internas', () => {
    render(
      <AdaptiveCheckpointWorkspace core={core} step={0} checkpoint={{ ...checkpoint, outputKey: 'InitiativeFraming' }} questions={[question]} />,
    );

    expect(screen.getByText('Imprescindible')).toBeInTheDocument();
    expect(screen.getByText('Explorar y validar')).toBeInTheDocument();
    expect(screen.getByText('Profundidad: Estándar')).toBeInTheDocument();
    expect(screen.getByText(/Lo que estás construyendo: Encuadre de la iniciativa/)).toBeInTheDocument();
    expect(screen.queryByText(/Variable:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fuente:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^must$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/InitiativeFraming/)).not.toBeInTheDocument();
  });

  it('en sólo lectura muestra las respuestas pero no las deja editar ni confirmar', () => {
    const onConfirmCheckpoint = vi.fn();
    render(
      <AdaptiveCheckpointWorkspace
        core={core}
        step={0}
        checkpoint={checkpoint}
        questions={[question]}
        initialResponses={{ owner_and_actor_required: 'La directora de operaciones' }}
        readOnly
        onConfirmCheckpoint={onConfirmCheckpoint}
        onConfirmOutput={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Quien debe validar esta iniciativa?')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Quien debe validar esta iniciativa?')).toHaveValue('La directora de operaciones');
    expect(screen.queryByRole('button', { name: /Confirmar checkpoint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar resultado del Step/i })).not.toBeInTheDocument();
  });

  it('sends the persisted CP-1.3 truth binding shape', () => {
    const onConfirmCheckpoint = vi.fn();
    const cp13: StepCheckpoint = {
      ...checkpoint,
      id: 'cp-1-3',
      step: 1,
      code: 'CP-1.3',
      title: 'Capturar y analizar evidencia',
    };
    const cp13Core: AdaptiveInitiativeCore = {
      ...core,
      activeStepConfigurationId: 'cfg-1',
      stepConfigurations: [{ ...core.stepConfigurations[0], id: 'cfg-1', step: 1, checkpoints: [cp13] }],
      truthClaims: [{ id: 'claim-real', statement: 'La hipotesis persistida', verificationState: 'supported' }],
      evidence: [{ id: 'evidence-real', name: 'Entrevista persistida', truthStatus: 'supports', targetClaimId: 'claim-real', sourceRefId: 'source-real' }],
      sourceRefs: [{ id: 'source-real', sourceType: 'USER_INPUT', reference: 'Entrevista 01' }],
    };

    render(
      <AdaptiveCheckpointWorkspace
        core={cp13Core}
        step={1}
        checkpoint={cp13}
        questions={[]}
        onConfirmCheckpoint={onConfirmCheckpoint}
      />,
    );

    fireEvent.change(screen.getByLabelText('Claim'), { target: { value: 'claim-real' } });
    const evidenceSelect = screen.getByLabelText('Evidence');
    const sourceSelect = screen.getByLabelText('SourceRef');
    Object.defineProperty(evidenceSelect, 'selectedOptions', { value: [{ value: 'evidence-real' }] });
    Object.defineProperty(sourceSelect, 'selectedOptions', { value: [{ value: 'source-real' }] });
    fireEvent.change(evidenceSelect);
    fireEvent.change(sourceSelect);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar checkpoint/i }));

    expect(onConfirmCheckpoint).toHaveBeenCalledWith({}, {
      claimId: 'claim-real',
      evidenceIds: ['evidence-real'],
      sourceRefIds: ['source-real'],
    });
  });

  it('does not enable CP-1.3 without a real claim, evidence and source reference', () => {
    const onConfirmCheckpoint = vi.fn();
    const cp13: StepCheckpoint = { ...checkpoint, step: 1, code: 'CP-1.3' };
    render(
      <AdaptiveCheckpointWorkspace
        core={{ ...core, stepConfigurations: [{ ...core.stepConfigurations[0], step: 1, checkpoints: [cp13] }] }}
        step={1}
        checkpoint={cp13}
        questions={[]}
        onConfirmCheckpoint={onConfirmCheckpoint}
      />,
    );

    expect(screen.getByRole('button', { name: /Confirmar checkpoint/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/No hay evidencia persistente suficiente/i);
    expect(screen.queryByRole('button', { name: /Registrar|Guardar|Validar soporte/i })).not.toBeInTheDocument();
    expect(onConfirmCheckpoint).not.toHaveBeenCalled();
  });
});

// Producción, 2026-10-10: un Step ya completado se veía vacío ("Aún no hay checkpoint activo",
// "0 preguntas" y "Este Step queda bloqueado…") en vez de mostrar lo que se confirmó.
describe('AdaptiveCheckpointWorkspace — Step completado', () => {
  const doneCore: AdaptiveInitiativeCore = {
    ...core,
    activeCheckpoint: null as any,
    checkpointInstances: [
      {
        id: 'i2', step: 0, checkpointKey: 'CP-0.2', title: 'Aterrizar condiciones', status: 'completed', sequence: 2,
        questions: [{ ...question, id: 'q-scope', prompt: '¿Cuál es el alcance?', clarifiesVariable: 'scope' }],
        responses: { scope: 'Equipo comercial' },
      },
      {
        id: 'i1', step: 0, checkpointKey: 'CP-0.1', title: 'Validar punto de partida', status: 'completed', sequence: 1,
        questions: [question, { ...question, id: 'q-ev', prompt: '¿Qué evidencia hay?', clarifiesVariable: 'evidenceItems' }],
        responses: { owner_and_actor_required: 'Owner comercial', evidenceItems: [{ summary: '8 de 10 casos con retrabajo' }, { summary: 'Métrica base' }] },
      },
      { id: 'i9', step: 1, checkpointKey: 'CP-1.1', title: 'Otro step', status: 'completed', sequence: 1, questions: [], responses: {} },
    ],
  };

  it('muestra cada checkpoint confirmado con sus respuestas, en orden', () => {
    render(<AdaptiveCheckpointWorkspace core={doneCore} step={0} checkpoint={null} questions={[]} outputConfirmed />);

    expect(screen.getByRole('heading', { name: 'Step 0 completado' })).toBeInTheDocument();
    expect(screen.getByText('Este Step está completo y su resultado quedó confirmado')).toBeInTheDocument();
    const titles = screen.getAllByText(/^CP-0\.\d · /).map(node => node.textContent);
    expect(titles).toEqual(['CP-0.1 · Validar punto de partida', 'CP-0.2 · Aterrizar condiciones']);
    expect(screen.getByText('Owner comercial')).toBeInTheDocument();
    expect(screen.getByText('8 de 10 casos con retrabajo · Métrica base')).toBeInTheDocument();
    expect(screen.getByText('Equipo comercial')).toBeInTheDocument();
    expect(screen.queryByText('CP-1.1 · Otro step')).not.toBeInTheDocument();
    expect(screen.queryByText(/Aún no hay checkpoint activo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/todavía no tiene preguntas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/queda bloqueado/)).not.toBeInTheDocument();
  });

  it('cuenta los checkpoints activados por contexto en el total (no muestra 2/1)', () => {
    // La configuración define sólo CP-0.1; CP-0.2 se activó aparte (como CP-3.5 en producción).
    render(<AdaptiveCheckpointWorkspace core={doneCore} step={0} checkpoint={null} questions={[]} outputConfirmed />);
    expect(screen.getByText('Progreso: 2/2 checkpoints confirmados')).toBeInTheDocument();
  });

  it('muestra el resultado del Step como texto legible, sin JSON ni metadatos', () => {
    const output = {
      createdAt: '2026-10-10T23:09:37.496Z',
      outputKey: 'Step4DecisionMemo',
      sourceRefs: ['crm-report'],
      narrative: {
        focus: { text: 'Reducir retrabajo comercial.', topic: 'focus', confidence: 'strong', sourceRefs: ['crm-report'] },
        risks: { text: '', topic: 'risks' },
      },
      decisionType: 'scale',
      alternatives: [{ title: 'Piloto ampliado' }, { title: 'Automatizar reporte' }],
      initiativeCompleted: true,
      lifecycleProjection: { stage: 'closed' },
    };
    render(<AdaptiveCheckpointWorkspace core={doneCore} step={0} checkpoint={null} questions={[]} outputPreview={output} outputConfirmed />);

    expect(screen.getByText('Resultado confirmado')).toBeInTheDocument();
    expect(screen.getByText('Narrativa')).toBeInTheDocument();
    expect(screen.getByText('Reducir retrabajo comercial.')).toBeInTheDocument();
    expect(screen.getByText('Tipo de decisión')).toBeInTheDocument();
    expect(screen.getByText('Piloto ampliado · Automatizar reporte')).toBeInTheDocument();
    expect(screen.getByText('Iniciativa completada').nextSibling).toHaveTextContent('Sí');
    expect(screen.queryByText(/createdAt|sourceRefs|crm-report|"focus"/)).not.toBeInTheDocument();
  });

  it('un Step sin checkpoints confirmados sigue mostrándose bloqueado', () => {
    render(<AdaptiveCheckpointWorkspace core={{ ...doneCore, checkpointInstances: [] }} step={2} checkpoint={null} questions={[]} />);
    expect(screen.getByText(/queda bloqueado/)).toBeInTheDocument();
    expect(screen.queryByText(/completado/)).not.toBeInTheDocument();
  });
});
