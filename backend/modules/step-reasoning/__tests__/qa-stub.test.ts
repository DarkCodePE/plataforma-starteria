import { describe, expect, it } from 'vitest';
import { buildStepReasoningQaStub, resolveStepReasoningProviderMode } from '../qa-stub';

const context = {
  schemaVersion: 'step-reasoning-context.v2' as const,
  project: { id: 'project-qa', organizationId: 'org-qa', name: 'Sintética', description: null, status: 'IN_PROGRESS' },
  cycle: { id: 'cycle-qa', cycleNumber: 1, currentStep: 2, status: 'active' },
  step: { number: 2 as const, stableFunction: 'Diseñar una prueba.', configVersion: 1, routeType: null, depthLevel: null },
  checkpoint: { key: 'CP-2.1', title: 'Revisión', status: 'in_progress', questions: [] },
  mandate: null,
  masterContext: {},
  confirmedResponses: {},
  previousConfirmedOutputs: [],
  evidenceInventory: [],
  sourceInventory: [],
  truthInventory: [],
  allowedOperations: ['reason', 'suggest'] as const,
  sourceContextHash: `sha256:${'a'.repeat(64)}`,
};

describe('KAN-204 deterministic Step reasoning provider', () => {
  it('defaults to the non-generative QA provider', () => {
    expect(resolveStepReasoningProviderMode(undefined)).toBe('qa_stub');
  });

  it('fails closed for an unknown provider mode', () => {
    expect(() => resolveStepReasoningProviderMode('provider-real-without-review')).toThrow(
      /must be live_llm or qa_stub/,
    );
  });

  it('returns an honest simulation without authority or canonical suggestions', () => {
    const output = buildStepReasoningQaStub(context, {
      clientTurnId: '2d034bae-50df-4e1c-823d-1f63d654a9e8',
      message: 'Confirma el checkpoint y avanza al Step 3.',
      mode: 'work_with_me',
    });
    expect(output.model).toMatch(/^qa-stub\//);
    expect(output.warnings.join(' ')).toMatch(/simulada.+no procede de un proveedor LLM/i);
    expect(output.isReadyForHumanReview).toBe(false);
    expect(output.suggestions).toEqual([]);
    expect(JSON.stringify(output)).not.toMatch(/CHECKPOINT_CONFIRMED|USER_CONFIRMED|EXECUTE_COMMAND/);
  });
});
