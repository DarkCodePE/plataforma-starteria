import { createHash } from 'node:crypto';
import type { StepReasoningContext } from './context-builder';
import type { StepReasoningAiResponse, StepReasoningTurnInput } from './step-reasoning.schemas';

export type StepReasoningProviderMode = 'live_llm' | 'qa_stub';

export function resolveStepReasoningProviderMode(
  value = process.env.STEP_REASONING_PROVIDER_MODE,
): StepReasoningProviderMode {
  if (!value || value === 'qa_stub') return 'qa_stub';
  if (value === 'live_llm') return 'live_llm';
  throw new Error('STEP_REASONING_PROVIDER_MODE must be live_llm or qa_stub.');
}

const NEXT_QUESTION: Record<number, string> = {
  0: '¿Qué condición observable necesitas aclarar antes de revisar el checkpoint?',
  1: '¿Qué evidencia distinguiría un hecho confirmado de una hipótesis?',
  2: '¿Qué señal mínima permitiría evaluar la prueba sin anticipar su resultado?',
  3: '¿Qué observación verificable conviene registrar antes de extraer un aprendizaje?',
  4: '¿Qué riesgo debe quedar explícito antes de elevar la recomendación a decisión humana?',
};

/**
 * Deterministic, non-generative response for the code-authorized persisted QA identity.
 * It never derives canonical values, proposes mutations or confirms a checkpoint.
 */
export function buildStepReasoningQaStub(
  context: StepReasoningContext,
  input: StepReasoningTurnInput,
): StepReasoningAiResponse {
  const fingerprint = createHash('sha256')
    .update(`${context.step.number}:${context.sourceContextHash}:${input.mode}`)
    .digest('hex');

  return {
    message: `Simulación QA: he registrado tu aportación para Step ${context.step.number}. El estado canónico y el checkpoint no han cambiado.`,
    nextInteraction: {
      kind: 'ask',
      question: NEXT_QUESTION[context.step.number] ?? '¿Qué falta comprobar antes de la revisión humana?',
    },
    known: ['Existe una aportación sintética pendiente de revisión humana.'],
    unknown: ['El contenido no se considera confirmado hasta revisarlo en el checkpoint oficial.'],
    contradictions: [],
    suggestions: [],
    warnings: ['Respuesta simulada y determinista de QA; no procede de un proveedor LLM.'],
    isReadyForHumanReview: false,
    model: 'qa-stub/kan-204-step-reasoning',
    promptVersion: 'steps/reasoning/v0.1',
    promptHash: `sha256:${fingerprint}`,
    providerRunId: null,
    tokensUsed: 0,
    costUsd: 0,
    latencyMs: 0,
  };
}
