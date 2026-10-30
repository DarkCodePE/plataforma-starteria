import { describe, expect, it } from 'vitest';
import type { Project } from '../../../../app/context/AppContext';
import type { AdaptiveInitiativeCore } from '../types';
import {
  buildAdaptiveJourney,
  getCurrentAdaptiveJourneyStep,
  resolveAuthoritativeAdaptiveCore,
  resolveLegacyAdaptivePreview,
} from '../adaptiveJourney';

const project = {
  id: 'p1',
  name: 'Flujo legacy',
  description: 'Descripcion legacy',
  status: 'Draft',
  currentStep: 1,
  step0Status: 'Completado',
  step0Data: {},
  steps: [
    { number: 1, name: 'Claridad estatica', status: 'En progreso', progress: 25, modules: [] },
    { number: 2, name: 'Diseno estatico', status: 'Bloqueado', progress: 0, modules: [] },
    { number: 3, name: 'Prueba estatica', status: 'Bloqueado', progress: 0, modules: [] },
    { number: 4, name: 'Historia estatica', status: 'Bloqueado', progress: 0, modules: [] },
  ],
  team: [],
  evidence: [],
} as Project;

const adaptiveCore = {
  schemaVersion: 'PRD-03-v0.4',
  masterContext: {
    id: 'mc1',
    version: 1,
    routeType: 'implement_handoff',
    depthLevel: 'extended',
    maturity: 'solution_proposed',
    knownFacts: [],
    assumptions: [],
    missingCriticalInformation: [],
    risks: [],
    decisions: [],
    contextSnapshots: [],
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  activeStepConfigurationId: 'cfg-1',
  activeCheckpoint: {
    id: 'cp1',
    step: 1,
    checkpointKey: 'CP-1.1',
    status: 'ready',
    sequence: 1,
    version: 0,
    questions: [],
    configurationId: 'cfg-1',
  },
  progressSignal: {
    id: 'sig1',
    step: 1,
    checkpointCode: 'CP-1.1',
    checkpointTitle: 'Confirmar adopcion',
    health: 'attention',
    hypothesis: 'La adopcion depende del owner operativo.',
    evidence: 'PDF de rollout',
    evidenceStrength: 'weak',
    blocker: '',
    actorRequired: 'Owner de iniciativa',
    nextAction: 'Resolver CP-1.1 con evidencia del rollout.',
    upcomingDecision: 'Decidir transferencia operativa.',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
  stepConfigurations: [
    {
      id: 'cfg-0',
      step: 0,
      version: 1,
      visibleName: 'Confirmar mandato y condiciones',
      stablePurpose: 'Alinear informacion subida.',
      objective: 'Usar el PDF como base del contrato de validacion.',
      expectedOutput: 'Implementation Brief',
      routeType: 'implement_handoff',
      depthLevel: 'extended',
      generatedAt: '2026-08-04T00:00:00.000Z',
      generatedBy: 'deterministic_fallback',
      closureCriteria: [],
      checkpoints: [],
    },
    {
      id: 'cfg-1',
      step: 1,
      version: 1,
      visibleName: 'Establecer baseline de adopcion',
      stablePurpose: 'Medir readiness real antes de ejecutar.',
      objective: 'Separar supuestos de adopcion y restricciones de operacion.',
      expectedOutput: 'Readiness Baseline + Adoption Conditions',
      routeType: 'implement_handoff',
      depthLevel: 'extended',
      generatedAt: '2026-08-04T00:00:00.000Z',
      generatedBy: 'deterministic_fallback',
      closureCriteria: [],
      checkpoints: [
        {
          id: 'cp-1-1',
          step: 1,
          code: 'CP-1.1',
          title: 'Confirmar adopcion',
          purpose: 'Validar condiciones reales.',
          status: 'ready',
          outputKey: 'AdoptionBaseline',
          completionCriteria: [],
          questions: [
            {
              id: 'q1',
              checkpointId: 'CP-1.1',
              prompt: 'Quien opera esto despues del piloto?',
              purpose: 'Confirmar owner.',
              clarifiesVariable: 'owner',
              priority: 'must',
              answerType: 'owner',
              reason: 'Sin owner no hay handoff.',
              source: 'method_catalog',
              allowsUnknown: false,
              optional: false,
            },
          ],
          gates: [],
        },
      ],
    },
  ],
  checkpointInstances: [],
  stepOutputs: [],
  auditEvents: [],
} satisfies AdaptiveInitiativeCore;

describe('adaptiveJourney', () => {
  it('uses Adaptive Core as the visible journey source instead of legacy static step names', () => {
    const journey = buildAdaptiveJourney(project, adaptiveCore, () => true);
    const current = getCurrentAdaptiveJourneyStep(journey);

    expect(current.step).toBe(1);
    expect(current.title).toBe('Establecer baseline de adopcion');
    expect(current.nextAction).toBe('Resolver CP-1.1 con evidencia del rollout.');
    expect(current.routeType).toBe('implement_handoff');
    expect(current.depthLevel).toBe('extended');
    expect(current.questionsCount).toBe(1);
    expect(current.title).not.toBe('Claridad estatica');
  });

  it('keeps authoritative Adaptive Core null when backend state is unavailable', () => {
    expect(resolveAuthoritativeAdaptiveCore(null)).toBeNull();
    expect(resolveAuthoritativeAdaptiveCore(undefined)).toBeNull();
  });

  it('keeps legacy builders available only through the explicit non-authoritative preview wrapper', () => {
    const preview = resolveLegacyAdaptivePreview(project);

    expect(preview.schemaVersion).toBe('PRD-03-v0.4');
    expect(preview.masterContext.id).toContain(project.id);
    expect(resolveAuthoritativeAdaptiveCore(preview)).toBe(preview);
  });
});
