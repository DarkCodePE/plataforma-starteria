import { AppError } from '../../shared/errors/AppError';
import { createHash } from 'node:crypto';
import type { Role } from '../../shared/types/user.types';
import { defaultAiBridge, type AiBridge } from '../ai/bridge.service';
import { logCopilotEvent } from '../copilot/observability/copilot-logger';
import type { StepContextBuilder, StepReasoningContext, StepReasoningStepNumber } from './context-builder';
import type { SessionKey, StepReasoningRepositoryLike } from './repository';
import { stepReasoningAiResponseSchema, type StepReasoningTurnInput } from './step-reasoning.schemas';

const AI_PATH = '/api/v1/ai/steps/reason-turn';

function projectRef(projectId: string): string {
  return `sha256:${createHash('sha256').update(projectId).digest('hex').slice(0, 16)}`;
}

export interface StepReasoningActor {
  id: string;
  role: Role;
}

function sessionKey(context: StepReasoningContext, actorId: string): SessionKey {
  return {
    organizationId: context.project.organizationId,
    projectId: context.project.id,
    cycleId: context.cycle.id,
    stepNumber: context.step.number,
    createdById: actorId,
  };
}

function outputOf(turn: any): unknown {
  return turn?.structuredOutputJson ?? turn?.structuredOutput ?? null;
}

function publicTurn(turn: any) {
  return {
    id: turn.id,
    clientTurnId: turn.clientTurnId,
    inputText: turn.inputText,
    assistantText: turn.assistantText ?? null,
    status: turn.status,
    executionMode: turn.executionMode ?? null,
    errorCode: turn.errorCode ?? null,
    structuredOutput: outputOf(turn),
    sourceContextHash: turn.sourceContextHash,
    requestId: turn.requestId,
    createdAt: turn.createdAt,
    completedAt: turn.completedAt ?? null,
  };
}

function publicSession(session: any) {
  return {
    id: session.id,
    projectId: session.projectId,
    cycleId: session.cycleId,
    stepNumber: session.stepNumber,
    contextHash: session.lastContextHash,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function fallback(context: StepReasoningContext) {
  const firstQuestion = context.checkpoint.questions.find((item: any) => typeof item?.text === 'string' || typeof item?.question === 'string') as any;
  const question = firstQuestion?.text ?? firstQuestion?.question ?? `¿Qué dato concreto te ayudaría a avanzar en Step ${context.step.number}?`;
  return {
    message: `Asistencia básica: el modelo no respondió. Tu mensaje quedó guardado y el estado canónico no cambió. ${question}`,
    nextInteraction: { kind: 'ask', question },
    known: [],
    unknown: ['La respuesta generativa no está disponible.'],
    contradictions: [],
    suggestions: [],
    warnings: ['Fallback limitado: no es una respuesta del LLM y no confirma ningún checkpoint.'],
    isReadyForHumanReview: false,
  };
}

function intentFingerprint(context: StepReasoningContext, input: StepReasoningTurnInput): string {
  const intent = {
    projectId: context.project.id,
    cycleId: context.cycle.id,
    stepNumber: context.step.number,
    contextHash: context.sourceContextHash,
    mode: input.mode,
    message: input.message,
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(intent)).digest('hex')}`;
}

function storedIntentFingerprint(turn: any): string | null {
  const value = turn?.contextSnapshotJson?.requestIntent?.fingerprint;
  return typeof value === 'string' ? value : null;
}

export class StepReasoningService {
  constructor(
    private readonly contextBuilder: Pick<StepContextBuilder, 'build'>,
    private readonly repository: StepReasoningRepositoryLike,
    private readonly bridge: AiBridge = defaultAiBridge,
  ) {}

  async loadSession(projectId: string, stepNumber: StepReasoningStepNumber, actor: StepReasoningActor) {
    const context = await this.contextBuilder.build({ projectId, actorId: actor.id, actorRole: actor.role, stepNumber }, 'read');
    const session = await this.repository.findSession(sessionKey(context, actor.id));
    const turns = session ? await this.repository.listTurns(session.id) : [];
    logCopilotEvent('info', {
      eventName: 'step_reasoning.session_loaded',
      organizationId: context.project.organizationId,
      userId: actor.id,
      conversationId: session?.id,
      resultStatus: session ? 'restored' : 'empty',
      details: { projectRef: projectRef(projectId), cycleId: context.cycle.id, stepNumber, contextHash: context.sourceContextHash },
    });
    return {
      session: session ? publicSession(session) : null,
      turns: turns.map(publicTurn),
      context: {
        cycleId: context.cycle.id,
        contextHash: context.sourceContextHash,
        step: context.step,
        checkpoint: context.checkpoint,
      },
    };
  }

  async submitTurn(projectId: string, stepNumber: StepReasoningStepNumber, actor: StepReasoningActor, input: StepReasoningTurnInput, requestId: string) {
    const startedAt = Date.now();
    const context = await this.contextBuilder.build({
      projectId,
      actorId: actor.id,
      actorRole: actor.role,
      expectedCycleId: input.expectedCycleId,
      stepNumber,
    }, 'write');
    if (input.expectedContextHash && input.expectedContextHash !== context.sourceContextHash) {
      throw AppError.conflict(`El contexto de Step ${stepNumber} cambió. Recarga antes de enviar.`, 'STEP_REASONING_CONTEXT_CONFLICT');
    }

    const key = sessionKey(context, actor.id);
    let session = await this.repository.findSession(key);
    if (!session) session = await this.repository.createSession({ ...key, lastContextHash: context.sourceContextHash });
    if (input.sessionId && input.sessionId !== session.id) {
      throw AppError.notFound('Sesión de razonamiento', 'STEP_REASONING_SESSION_NOT_FOUND');
    }

    const fingerprint = intentFingerprint(context, input);
    const claimInput = {
      sessionId: session.id,
      clientTurnId: input.clientTurnId,
      actorId: actor.id,
      inputText: input.message,
      sourceContextHash: context.sourceContextHash,
      contextSnapshotJson: { ...context, requestIntent: { mode: input.mode, fingerprint } },
      requestId,
    };
    let claimed = await this.repository.claimTurn(claimInput);
    if (!claimed.claimed) {
      const replayFingerprint = storedIntentFingerprint(claimed.turn);
      if (claimed.turn.inputText !== input.message || (replayFingerprint && replayFingerprint !== fingerprint)) {
        throw AppError.conflict('clientTurnId ya fue usado con otro mensaje.', 'STEP_REASONING_IDEMPOTENCY_CONFLICT');
      }
      if (input.retryFailed && claimed.turn.status === 'FAILED') {
        const reclaimed = await this.repository.reclaimFailedTurn(claimed.turn.id, {
          sourceContextHash: context.sourceContextHash,
          contextSnapshotJson: { ...context, requestIntent: { mode: input.mode, fingerprint } },
          requestId,
        });
        if (reclaimed) claimed = { turn: { ...claimed.turn, ...claimInput, status: 'PENDING' }, claimed: true };
      }
      if (!claimed.claimed) return { session: publicSession(session), turn: publicTurn(claimed.turn), idempotentReplay: true };
    }

    logCopilotEvent('info', {
      eventName: 'step_reasoning.turn_received', requestId, conversationId: session.id,
      organizationId: context.project.organizationId, userId: actor.id, idempotencyKey: input.clientTurnId,
      details: { projectRef: projectRef(projectId), cycleId: context.cycle.id, stepNumber, contextHash: context.sourceContextHash },
    });

    const history = (await this.repository.listTurns(session.id))
      .filter((turn) => turn.id !== claimed.turn.id && turn.status === 'SUCCEEDED')
      .slice(-12)
      .map((turn) => ({ user: turn.inputText, assistant: turn.assistantText }));

    try {
      logCopilotEvent('info', { eventName: 'step_reasoning.provider_started', requestId, conversationId: session.id, userId: actor.id });
      const raw = await this.bridge.callAiService('POST', AI_PATH, {
        projectId,
        cycleId: context.cycle.id,
        stepNumber,
        sourceContextHash: context.sourceContextHash,
        message: input.message,
        mode: input.mode,
        history,
        context,
      }, {
        requestId,
        userClaims: { userId: actor.id, role: actor.role, projectScope: [projectId] },
        costCapUsd: '0.0500',
        timeoutMs: 30_000,
        maxRetries: 0,
      });
      const response = stepReasoningAiResponseSchema.parse(raw);
      const completed = await this.repository.completeTurn(claimed.turn.id, {
        assistantText: response.message,
        structuredOutputJson: response,
        executionMode: response.model.startsWith('qa-stub/') ? 'qa_stub' : 'live_llm',
        providerModel: response.model,
        providerRunId: response.providerRunId ?? null,
        promptVersion: response.promptVersion,
        promptHash: response.promptHash,
        tokensUsed: response.tokensUsed ?? null,
        costUsd: response.costUsd ?? null,
        latencyMs: response.latencyMs ?? Date.now() - startedAt,
        errorCode: null,
      });
      logCopilotEvent('info', {
        eventName: 'step_reasoning.provider_completed', requestId, conversationId: session.id, userId: actor.id,
        durationMs: Date.now() - startedAt, resultStatus: 'SUCCEEDED',
        details: { model: response.model, promptVersion: response.promptVersion, tokensUsed: response.tokensUsed ?? null, costUsd: response.costUsd ?? null },
      });
      return { session: publicSession(session), turn: publicTurn(completed), idempotentReplay: false };
    } catch (error: any) {
      const errorCode = error?.code ?? (error?.name === 'ZodError' ? 'STEP_REASONING_SCHEMA_INVALID' : 'STEP_REASONING_PROVIDER_FAILED');
      const basic = fallback(context);
      const failed = await this.repository.failTurn(claimed.turn.id, {
        assistantText: basic.message,
        structuredOutputJson: basic,
        executionMode: 'limited_fallback',
        errorCode,
        latencyMs: Date.now() - startedAt,
      });
      logCopilotEvent('warn', {
        eventName: errorCode === 'STEP_REASONING_SCHEMA_INVALID' ? 'step_reasoning.schema_rejected' : 'step_reasoning.provider_failed',
        requestId, conversationId: session.id, userId: actor.id, durationMs: Date.now() - startedAt,
        resultStatus: 'FAILED', errorCode,
      });
      return { session: publicSession(session), turn: publicTurn(failed), idempotentReplay: false };
    }
  }
}

