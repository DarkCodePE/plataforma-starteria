import { z } from 'zod/v3';
import type { StructuredModelAdapter } from '../portfolio-entry-runtime/model/structured-model-adapter';
import type { E2ConversationContext } from './portfolio-bootstrap-e2-conversation-context';

/**
 * KAN-253 B4-B: semantic E2 question candidate, read-only.
 * This component does not write GoalTurns, update Anchor or advance E3.
 * The separate authenticated caller must establish tenant/owner access first.
 */
const fields = ['outcomeStatement', 'contextSummary', 'decisionToEnable', 'businessSignalValue'] as const;
const fieldSchema = z.enum(fields);
const evidenceSchema = z.object({
  kind: z.enum(['confirmed_e1', 'anchor_draft', 'goal_turn']),
  id: z.string().min(1).max(240),
  quote: z.string().min(1).max(500),
}).strict();
export const e2SemanticQuestionCandidateSchema = z.object({
  status: z.enum(['question_required', 'ready_for_human_review', 'insufficient_context']),
  question: z.object({
    field: fieldSchema,
    text: z.string().trim().min(8).max(650),
    recap: z.string().trim().min(1).max(600),
    reasonToAsk: z.string().trim().min(1).max(400),
    resolves: z.array(z.string().trim().min(1).max(100)).min(1).max(3),
    evidence: z.array(evidenceSchema).max(4),
  }).nullable(),
  reason: z.string().trim().min(1).max(500),
}).strict().superRefine((value, ctx) => {
  if ((value.status === 'question_required') !== (value.question !== null)) {
    ctx.addIssue({ code: 'custom', path: ['question'], message: 'Question/status mismatch.' });
  }
});
export type E2SemanticQuestionCandidate = z.infer<typeof e2SemanticQuestionCandidateSchema>;

export const E2_SEMANTIC_QUESTION_SYSTEM_PROMPT = `Eres el asistente de definición de Objetivo E2 de Startería.
Devuelve únicamente JSON que cumpla el schema. Este NO es E1 ni un Step.
Distingue contexto E1 confirmado, Anchor en borrador y turnos provisionales.
Nunca inventes KPIs, metas, baselines, resultados, causas, fuentes ni decisiones.
No repitas lo ya declarado ni preguntes para completar campos sin necesidad.
Si hay suficiente claridad, marca ready_for_human_review y no generes pregunta.
Si falta información crítica, pregunta una sola cosa comprensible que reduzca esa incertidumbre.
Una respuesta unknown es incertidumbre declarada, no un hecho.
Nunca afirmes haber confirmado un objetivo o haber iniciado E3/Steps.
Cada cita debe referirse a un ID y fragmento literal presente en el contexto recibido.
No atribuyas conocimiento confirmado a una respuesta provisional.`;

export type E2CandidateContext = E2ConversationContext;
export type E2CandidateOutcome = {
  status: 'candidate' | 'fallback_required';
  candidate: E2SemanticQuestionCandidate | null;
  reason: string;
};

function evidenceIndex(context: E2CandidateContext): Map<string, string> {
  const index = new Map<string, string>();
  if (context.confirmedE1) index.set('confirmed_e1:' + context.confirmedE1.reviewId, context.confirmedE1.situation);
  for (const field of fields) {
    const value = context.anchorDraft[field];
    if (value) index.set('anchor_draft:' + field, value);
  }
  for (const turn of context.activeProvisional) {
    if (turn.reviewStatus !== 'stale_anchor') index.set('goal_turn:' + turn.turnId, turn.literalAnswer);
  }
  return index;
}

export function validateE2CandidateEvidence(
  candidate: E2SemanticQuestionCandidate,
  context: E2CandidateContext,
): boolean {
  const allowed = evidenceIndex(context);
  return (candidate.question?.evidence ?? []).every((reference) => {
    const literal = allowed.get(reference.kind + ':' + reference.id);
    return Boolean(literal && literal.includes(reference.quote));
  });
}

export async function proposeE2SemanticQuestion(input: {
  context: E2CandidateContext;
  model: StructuredModelAdapter;
  remainingQuestionBudget: number;
  requestId: string;
}): Promise<E2CandidateOutcome> {
  const budget = Math.max(0, Math.min(3, Math.floor(input.remainingQuestionBudget)));
  if (budget === 0) return {
    status: 'candidate',
    candidate: { status: 'ready_for_human_review', question: null, reason: 'Se alcanzó el límite de aclaraciones; corresponde una revisión humana.' },
    reason: 'budget_exhausted',
  };
  const context = input.context;
  const userPayload = {
    confirmedE1: context.confirmedE1,
    anchorDraft: context.anchorDraft,
    anchorVersion: context.anchorVersion,
    ledgerVersion: context.ledgerVersion,
    currentAnswers: context.activeProvisional,
    remainingQuestionBudget: budget,
  };
  try {
    const result = await input.model.generate({
      systemPrompt: E2_SEMANTIC_QUESTION_SYSTEM_PROMPT,
      userPayload,
      outputSchema: e2SemanticQuestionCandidateSchema,
      metadata: { provider: 'configured', model: 'configured', seed_support: 'not_requested' },
      limits: { maxOutputTokens: 650 },
      call: { call_id: input.requestId, purpose: 'portfolio_e2_question_candidate', turn_index: context.ledgerVersion + 1 },
    });
    if (!result.validated_output) return { status: 'fallback_required', candidate: null, reason: 'invalid_model_output' };
    const parsed = e2SemanticQuestionCandidateSchema.safeParse(result.validated_output);
    if (!parsed.success || !validateE2CandidateEvidence(parsed.data, context)) {
      return { status: 'fallback_required', candidate: null, reason: 'invalid_schema_or_evidence' };
    }
    return { status: 'candidate', candidate: parsed.data, reason: 'provisional_read_only' };
  } catch {
    return { status: 'fallback_required', candidate: null, reason: 'model_unavailable' };
  }
}
