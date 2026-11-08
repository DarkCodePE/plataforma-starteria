import { z } from 'zod/v3';

const conceptIdSchema = z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_.-]*$/);

const userInputEvidenceSchema = z.object({
  kind: z.literal('user_input'),
  quote: z.string().trim().min(1).max(2_000),
}).strict();

const contextReviewEvidenceSchema = z.object({
  kind: z.literal('context_review_field'),
  reviewVersion: z.number().int().positive(),
  fieldPath: z.string().trim().min(1).max(240),
}).strict();

const companyEvidenceSchema = z.object({
  kind: z.literal('company_context_entry'),
  companyId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  entryFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const portfolioBootstrapSemanticEvidenceRefSchema = z.discriminatedUnion('kind', [
  userInputEvidenceSchema,
  contextReviewEvidenceSchema,
  companyEvidenceSchema,
]);

export const portfolioBootstrapSemanticFactSchema = z.object({
  conceptId: conceptIdSchema,
  value: z.unknown().refine((value) => value !== undefined, 'El hecho requiere un valor.'),
  provenance: z.enum(['user_declared', 'source_extracted']),
  evidenceRefs: z.array(portfolioBootstrapSemanticEvidenceRefSchema).min(1).max(20),
  confidence: z.number().min(0).max(1),
  status: z.enum(['observed', 'confirmed', 'retracted']),
}).strict();

export const portfolioBootstrapSemanticHypothesisSchema = z.object({
  hypothesisId: z.string().trim().min(1).max(120),
  statement: z.string().trim().min(1).max(2_000),
  provenance: z.enum(['copilot_inferred', 'copilot_suggested']),
  supportConceptIds: z.array(conceptIdSchema).max(50),
  confidence: z.number().min(0).max(1),
  status: z.enum(['proposed', 'accepted', 'rejected']),
}).strict();

export const portfolioBootstrapSemanticDispositionSchema = z.object({
  conceptId: conceptIdSchema,
  disposition: z.enum(['unknown', 'not_applicable']),
  provenance: z.literal('user_declared'),
  evidenceRefs: z.array(userInputEvidenceSchema).min(1).max(20),
}).strict();

export const portfolioBootstrapSemanticQuestionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  recap: z.string().trim().min(1).max(1_000),
  question: z.string().trim().min(1).max(1_000),
  reasonToAsk: z.string().trim().min(1).max(1_000),
  resolves: z.array(conceptIdSchema).min(1).max(20),
}).strict();

export const portfolioBootstrapSemanticConvergenceSchema = z.object({
  status: z.enum([
    'question_required',
    'ready_for_human_review',
    'user_chose_review_with_unknowns',
    'budget_checkpoint',
    'provider_retryable_failure',
    'safety_stop',
  ]),
  reason: z.string().trim().min(1).max(2_000),
}).strict();

export const portfolioBootstrapSemanticQuestionBudgetSchema = z.object({
  limit: z.number().int().positive().max(100).nullable(),
  used: z.number().int().min(0).max(100),
}).strict().refine((budget) => budget.limit === null || budget.used <= budget.limit, {
  message: 'El presupuesto usado no puede superar el límite configurado.',
});

export const portfolioBootstrapSemanticExecutionSchema = z.object({
  provider: z.string().trim().min(1).max(120).nullable(),
  model: z.string().trim().min(1).max(240).nullable(),
  durationMs: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  retryCount: z.number().int().min(0).max(10),
  fallbackUsed: z.boolean(),
}).strict().refine((execution) => execution.totalTokens === execution.inputTokens + execution.outputTokens, {
  message: 'totalTokens debe ser la suma de inputTokens y outputTokens.',
});

export const portfolioBootstrapSemanticErrorSchema = z.object({
  code: z.string().trim().min(1).max(120),
  retryable: z.boolean(),
}).strict();

export const portfolioBootstrapSemanticTurnRequestSchema = z.object({
  expectedVersion: z.number().int().min(0),
  inputText: z.string().trim().min(1).max(20_000),
  answeredQuestionId: z.string().trim().min(1).max(120).nullable().default(null),
}).strict();

export const portfolioBootstrapSemanticTurnInputSchema = z.object({
  expectedVersion: z.number().int().min(0),
  inputText: z.string().trim().min(1).max(20_000),
  status: z.enum(['completed', 'failed_retryable', 'failed_terminal']),
  facts: z.array(portfolioBootstrapSemanticFactSchema).max(100),
  hypotheses: z.array(portfolioBootstrapSemanticHypothesisSchema).max(100),
  dispositions: z.array(portfolioBootstrapSemanticDispositionSchema).max(100).default([]),
  answeredGaps: z.array(conceptIdSchema).max(100),
  answeredQuestionId: z.string().trim().min(1).max(120).nullable(),
  emittedQuestion: portfolioBootstrapSemanticQuestionSchema.nullable(),
  convergence: portfolioBootstrapSemanticConvergenceSchema,
  questionBudget: portfolioBootstrapSemanticQuestionBudgetSchema,
  error: portfolioBootstrapSemanticErrorSchema.nullable(),
  execution: portfolioBootstrapSemanticExecutionSchema,
}).strict().superRefine((turn, context) => {
  const normalizedInput = normalizeEvidence(turn.inputText);
  for (const [factIndex, fact] of turn.facts.entries()) {
    const incompatibleEvidence = fact.evidenceRefs.findIndex((ref) => fact.provenance === 'user_declared'
      ? ref.kind !== 'user_input'
      : ref.kind === 'user_input');
    if (incompatibleEvidence >= 0) {
      context.addIssue({
        code: 'custom',
        path: ['facts', factIndex, 'evidenceRefs', incompatibleEvidence],
        message: 'La procedencia del hecho no coincide con el tipo de evidencia.',
      });
    }
    for (const [refIndex, ref] of fact.evidenceRefs.entries()) {
      if (ref.kind === 'user_input' && !normalizedInput.includes(normalizeEvidence(ref.quote))) {
        context.addIssue({
          code: 'custom',
          path: ['facts', factIndex, 'evidenceRefs', refIndex, 'quote'],
          message: 'La evidencia declarada no aparece en el input del turno.',
        });
      }
    }
  }
  for (const [dispositionIndex, disposition] of turn.dispositions.entries()) {
    for (const [refIndex, ref] of disposition.evidenceRefs.entries()) {
      if (!normalizedInput.includes(normalizeEvidence(ref.quote))) {
        context.addIssue({
          code: 'custom',
          path: ['dispositions', dispositionIndex, 'evidenceRefs', refIndex, 'quote'],
          message: 'La evidencia declarada para la disposición no aparece en el input del turno.',
        });
      }
    }
  }
  const isFailure = turn.status !== 'completed';
  if (isFailure && (turn.facts.length || turn.hypotheses.length || turn.dispositions.length
    || turn.answeredGaps.length || turn.emittedQuestion)) {
    context.addIssue({ code: 'custom', message: 'Un turno fallido no puede producir estado semántico.' });
  }
  if (turn.status === 'failed_retryable' && (!turn.error?.retryable || turn.convergence.status !== 'provider_retryable_failure')) {
    context.addIssue({ code: 'custom', message: 'El fallo retryable requiere error retryable y convergencia de proveedor.' });
  }
  if (turn.status === 'failed_terminal' && (!turn.error || turn.error.retryable)) {
    context.addIssue({ code: 'custom', message: 'El fallo terminal requiere un error no retryable.' });
  }
  if (turn.status === 'failed_terminal' && turn.convergence.status !== 'safety_stop') {
    context.addIssue({ code: 'custom', message: 'El fallo terminal sólo puede converger en safety_stop.' });
  }
  if (turn.status === 'completed' && turn.error) {
    context.addIssue({ code: 'custom', path: ['error'], message: 'Un turno completado no contiene error.' });
  }
  if (turn.status === 'completed' && ['provider_retryable_failure', 'safety_stop'].includes(turn.convergence.status)) {
    context.addIssue({ code: 'custom', message: 'Un turno completado no puede declarar convergencia de fallo.' });
  }
  if (turn.emittedQuestion && turn.convergence.status !== 'question_required') {
    context.addIssue({ code: 'custom', message: 'Sólo question_required puede emitir una pregunta.' });
  }
  if (!turn.emittedQuestion && turn.convergence.status === 'question_required') {
    context.addIssue({ code: 'custom', message: 'question_required requiere exactamente una pregunta activa.' });
  }
});

export type PortfolioBootstrapSemanticTurnInput = z.infer<typeof portfolioBootstrapSemanticTurnInputSchema>;
export type PortfolioBootstrapSemanticFact = z.infer<typeof portfolioBootstrapSemanticFactSchema>;
export type PortfolioBootstrapSemanticHypothesis = z.infer<typeof portfolioBootstrapSemanticHypothesisSchema>;
export type PortfolioBootstrapSemanticDisposition = z.infer<typeof portfolioBootstrapSemanticDispositionSchema>;
export type PortfolioBootstrapSemanticQuestion = z.infer<typeof portfolioBootstrapSemanticQuestionSchema>;
export type PortfolioBootstrapSemanticConvergence = z.infer<typeof portfolioBootstrapSemanticConvergenceSchema>;
export type PortfolioBootstrapSemanticQuestionBudget = z.infer<typeof portfolioBootstrapSemanticQuestionBudgetSchema>;

export function semanticE1Enabled(env: { SEMANTIC_E1_ENABLED?: string } = process.env): boolean {
  return env.SEMANTIC_E1_ENABLED?.trim().toLowerCase() === 'true';
}

function normalizeEvidence(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
