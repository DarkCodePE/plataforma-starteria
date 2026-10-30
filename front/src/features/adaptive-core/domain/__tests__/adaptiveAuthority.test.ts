import { describe, expect, it } from 'vitest';
import { canNavigateToAdaptiveStep, getAuthoritativeActiveStep, latestAdaptiveStepOutput } from '../adaptiveAuthority';
import type { AdaptiveInitiativeCore } from '../types';

const coreAt = (step: 0 | 1 | 2 | 3 | 4): AdaptiveInitiativeCore => ({
  schemaVersion: 'PRD-03-v0.4',
  masterContext: {
    id: 'mc',
    version: 1,
    routeType: 'explore_validate',
    depthLevel: 'standard',
    maturity: 'problem',
    knownFacts: [],
    assumptions: [],
    missingCriticalInformation: [],
    risks: [],
    decisions: [],
    contextSnapshots: [],
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  activeStepConfigurationId: `cfg-${step}`,
  progressSignal: {
    id: 'sig',
    step,
    checkpointCode: `CP-${step}.1`,
    checkpointTitle: `Checkpoint ${step}`,
    health: 'healthy',
    hypothesis: '',
    evidence: '',
    evidenceStrength: 'weak',
    blocker: '',
    actorRequired: '',
    nextAction: `Continuar Step ${step}.`,
    upcomingDecision: '',
    updatedAt: '2026-08-04T00:00:00.000Z',
  },
  activeCheckpoint: {
    id: `cp-${step}`,
    step,
    checkpointKey: `CP-${step}.1`,
    status: 'ready',
    sequence: 1,
    version: 0,
    questions: [],
    configurationId: `cfg-${step}`,
  },
  stepConfigurations: [0, 1, 2, 3, 4].map((item) => ({
    id: `cfg-${item}`,
    step: item as 0 | 1 | 2 | 3 | 4,
    version: 1,
    visibleName: `Step ${item}`,
    stablePurpose: `Step ${item}`,
    objective: `Objective ${item}`,
    expectedOutput: `Output ${item}`,
    routeType: 'explore_validate',
    depthLevel: 'standard',
    checkpoints: [],
    closureCriteria: [],
    generatedAt: '2026-08-04T00:00:00.000Z',
    generatedBy: 'deterministic_fallback',
  })),
  stepOutputs: [],
  auditEvents: [],
});

describe('adaptive authority helpers', () => {
  it('uses server active step as the navigation authority and ignores legacy state by construction', () => {
    const core = coreAt(2);

    expect(getAuthoritativeActiveStep(core)).toBe(2);
    expect(canNavigateToAdaptiveStep(core, 1)).toBe(true);
    expect(canNavigateToAdaptiveStep(core, 2)).toBe(true);
    expect(canNavigateToAdaptiveStep(core, 3)).toBe(false);
    expect(canNavigateToAdaptiveStep(core, 4)).toBe(false);
  });

  it('confirmed Step outputs authorize only the next step boundary', () => {
    const core = {
      ...coreAt(1),
      activeCheckpoint: null,
      progressSignal: { ...coreAt(1).progressSignal, step: 1 as const },
      stepOutputs: [
        { id: 'out-1', step: 1, status: 'confirmed', version: 1, output: { ok: true } },
      ],
    };

    expect(getAuthoritativeActiveStep(core)).toBe(2);
    expect(canNavigateToAdaptiveStep(core, 2)).toBe(true);
    expect(canNavigateToAdaptiveStep(core, 3)).toBe(false);
  });

  it('returns the latest draft output used before backend Step confirmation', () => {
    const core = {
      ...coreAt(4),
      stepOutputs: [
        { id: 'old', step: 4, status: 'draft', version: 1, output: { value: 'old' } },
        { id: 'new', step: 4, status: 'draft', version: 2, output: { value: 'new' } },
      ],
    };

    expect(latestAdaptiveStepOutput(core, 4, 'draft')?.id).toBe('new');
  });
});
