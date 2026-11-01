import { describe, expect, it, vi } from 'vitest';
import { StepReasoningService } from '../service';

const context = {
  schemaVersion: 'step-reasoning-context.v2' as const,
  project: { id: 'project-1', organizationId: 'org-qa', name: 'Proyecto sintético', description: null, status: 'DRAFT' },
  cycle: { id: 'cycle-1', cycleNumber: 1, currentStep: 0, status: 'active' },
  step: { number: 0 as const, stableFunction: 'Aclarar el marco.', configVersion: 1, routeType: 'explore_validate', depthLevel: 'standard' },
  checkpoint: { key: 'CP-0.1', title: 'Enmarcar', status: 'in_progress', questions: [] },
  mandate: 'Aclarar el problema',
  masterContext: {},
  confirmedResponses: {},
  previousConfirmedOutputs: [],
  evidenceInventory: [],
  sourceInventory: [],
  truthInventory: [],
  allowedOperations: ['reason', 'suggest'] as const,
  sourceContextHash: `sha256:${'a'.repeat(64)}`,
};

function harness(model = 'openrouter:test/model', providerMode: 'live_llm' | 'qa_stub' = 'live_llm') {
  const sessions: any[] = [];
  const turns: any[] = [];
  const repository = {
    findSession: vi.fn(async () => sessions[0] ?? null),
    createSession: vi.fn(async (input: any) => {
      const row = { id: 'session-1', ...input, createdAt: new Date(), updatedAt: new Date() };
      sessions.push(row);
      return row;
    }),
    listTurns: vi.fn(async () => turns),
    claimTurn: vi.fn(async (input: any) => {
      const existing = turns.find((turn) => turn.clientTurnId === input.clientTurnId);
      if (existing) return { turn: existing, claimed: false };
      const turn = { id: 'turn-1', status: 'PENDING', createdAt: new Date(), ...input };
      turns.push(turn);
      return { turn, claimed: true };
    }),
    completeTurn: vi.fn(async (id: string, result: any) => {
      const turn = turns.find((item) => item.id === id);
      Object.assign(turn, { status: 'SUCCEEDED', ...result, completedAt: new Date() });
      return turn;
    }),
    failTurn: vi.fn(async (id: string, result: any) => {
      const turn = turns.find((item) => item.id === id);
      Object.assign(turn, { status: 'FAILED', ...result, completedAt: new Date() });
      return turn;
    }),
  };
  const bridge = {
    callAiService: vi.fn(async () => ({
      message: 'Primero aclaremos dónde ocurre el retrabajo.',
      nextInteraction: { kind: 'ask', question: '¿En qué parte del proceso ocurre?' },
      known: ['Existe retrabajo.'], unknown: ['Frecuencia.'], contradictions: [],
      suggestions: [{ field: 'problemStatement', proposedValue: 'Retrabajo operativo', rationale: 'Síntesis del input.', status: 'UNREVIEWED', sourceRefs: ['user.turn'] }],
      warnings: ['Sin evidencia de frecuencia.'], isReadyForHumanReview: false,
      model, promptVersion: 'steps/reasoning/v0.1', promptHash: 'sha256:test',
    })),
  };
  const contextBuilder = { build: vi.fn(async () => context) };
  return { repository, bridge, contextBuilder, service: new StepReasoningService(contextBuilder as any, repository as any, bridge as any, providerMode) };
}

const actor = { id: 'user-1', role: 'participante' as const };
const input = { clientTurnId: '2d034bae-50df-4e1c-823d-1f63d654a9e8', message: 'Hay retrabajo, pero no sé todavía dónde medir.', mode: 'work_with_me' as const };

describe('StepReasoningService', () => {
  it('persists PENDING before one bridge call and returns the same result for the same clientTurnId', async () => {
    const h = harness();
    const first = await h.service.submitTurn('project-1', 0, actor, input, 'request-1');
    const second = await h.service.submitTurn('project-1', 0, actor, input, 'request-2');
    expect(first.turn.status).toBe('SUCCEEDED');
    expect(second.turn.assistantText).toBe(first.turn.assistantText);
    expect(h.repository.claimTurn).toHaveBeenCalledTimes(2);
    expect(h.bridge.callAiService).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a clientTurnId with different input', async () => {
    const h = harness();
    await h.service.submitTurn('project-1', 0, actor, input, 'request-1');
    await expect(h.service.submitTurn('project-1', 0, actor, { ...input, message: 'Otro mensaje' }, 'request-2'))
      .rejects.toMatchObject({ code: 'STEP_REASONING_IDEMPOTENCY_CONFLICT' });
  });

  it('rejects reuse of a clientTurnId with a different intent mode', async () => {
    const h = harness();
    await h.service.submitTurn('project-1', 0, actor, input, 'request-1');
    await expect(h.service.submitTurn('project-1', 0, actor, { ...input, mode: 'orient' }, 'request-2'))
      .rejects.toMatchObject({ code: 'STEP_REASONING_IDEMPOTENCY_CONFLICT' });
  });

  it('labels the deterministic integration provider honestly as qa_stub', async () => {
    const h = harness('qa-stub/step-reasoning-v1');
    const result = await h.service.submitTurn('project-1', 0, actor, input, 'request-1');
    expect(result.turn).toMatchObject({ status: 'SUCCEEDED', executionMode: 'qa_stub' });
  });

  it('uses the deterministic QA provider without contacting an LLM bridge', async () => {
    const h = harness('openrouter:must-not-run', 'qa_stub');
    const result = await h.service.submitTurn('project-1', 0, actor, input, 'request-1');
    expect(h.bridge.callAiService).not.toHaveBeenCalled();
    expect(result.turn).toMatchObject({
      status: 'SUCCEEDED',
      executionMode: 'qa_stub',
    });
    expect(h.repository.completeTurn).toHaveBeenCalledWith('turn-1', expect.objectContaining({
      providerModel: 'qa-stub/kan-204-step-reasoning',
      tokensUsed: 0,
      costUsd: 0,
    }));
    expect(result.turn.assistantText).toMatch(/Simulación QA/i);
    const structuredOutput = result.turn.structuredOutput as { warnings: string[] };
    expect(structuredOutput.warnings).toContain(
      'Respuesta simulada y determinista de QA; no procede de un proveedor LLM.',
    );
  });

  it('passes the requested operational Step to context and provider', async () => {
    const h = harness();
    h.contextBuilder.build.mockResolvedValue({
      ...context,
      cycle: { ...context.cycle, currentStep: 2 },
      step: { ...context.step, number: 2, stableFunction: 'Diseñar un entregable ejecutable.' },
      checkpoint: { key: null, title: null, status: null, questions: [] },
    } as any);
    await h.service.submitTurn('project-1', 2, actor, input, 'request-1');
    expect(h.contextBuilder.build).toHaveBeenCalledWith(expect.objectContaining({ stepNumber: 2 }), 'write');
    expect(h.bridge.callAiService).toHaveBeenCalledWith('POST', expect.any(String), expect.objectContaining({ stepNumber: 2 }), expect.any(Object));
  });

  it('stores an explicit limited fallback when the provider fails', async () => {
    const h = harness();
    h.bridge.callAiService.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'AI_UPSTREAM_TIMEOUT' }));
    const result = await h.service.submitTurn('project-1', 0, actor, input, 'request-1');
    expect(result.turn).toMatchObject({ status: 'FAILED', executionMode: 'limited_fallback', errorCode: 'AI_UPSTREAM_TIMEOUT' });
    expect(result.turn.assistantText).toMatch(/asistencia básica/i);
  });

  it('does not invoke the provider when context authorization fails', async () => {
    const h = harness();
    h.contextBuilder.build.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'PROJECT_ACCESS_DENIED' }));
    await expect(h.service.submitTurn('project-1', 0, actor, input, 'request-1')).rejects.toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
    expect(h.bridge.callAiService).not.toHaveBeenCalled();
  });
});
