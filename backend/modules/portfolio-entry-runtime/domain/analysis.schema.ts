import { z } from 'zod/v3';

export const portfolioEntryIntentV2Schema = z.enum([
  'strategic_goal',
  'portfolio_alignment',
  'portfolio_tracking',
  'portfolio_prioritization',
  'portfolio_reporting',
  'portfolio_governance',
  'initiative_governance',
  'unknown',
]);

export const portfolioEntryFrameV2Schema = z.enum([
  'strategy_first',
  'portfolio_first',
  'initiative_first',
  'solution_first',
  'problem_first',
  'opportunity_first',
  'decision_first',
  'reporting_first',
  'unknown',
]);

export const portfolioEntryAnalysisStatusV2Schema = z.enum([
  'pending',
  'ready',
  'insufficient_input',
  'failed',
  'superseded',
]);

export const provenanceOriginV2Schema = z.enum([
  'USER_DECLARED',
  'EXTRACTED_FROM_USER_TEXT',
  'AI_INFERRED',
  'AI_SUGGESTED',
]);

export const reviewDispositionV2Schema = z.enum([
  'UNREVIEWED',
  'USER_CONFIRMED',
  'USER_REJECTED',
  'SUPERSEDED',
]);

export const provenanceEntryV2Schema = z.object({
  path: z.string(),
  origin: provenanceOriginV2Schema,
  review_disposition: reviewDispositionV2Schema,
  source_text: z.string().optional(),
});

export const reverseAlignmentV2Schema = z.object({
  required: z.boolean(),
  subject_type: z.enum(['solution', 'initiative', 'unknown']).optional(),
  subject: z.string().nullable().optional(),
  connection_state: z.enum(['not_required', 'partial', 'required', 'insufficient_input']).optional(),
  present_links: z.array(z.string()).optional(),
  missing_links: z.array(z.string()).optional(),
  ambiguities: z.array(z.unknown()).optional(),
  suggested_focus: z.string().nullable().optional(),
  provenance: z.unknown().optional(),
  activation_reason: z.enum([
    'initial_solution_or_initiative',
    'late_solution_detected',
    'late_initiative_detected',
    'existing_subject_reassessment',
  ]).optional(),
  status: z.enum(['not_required', 'partial', 'required', 'insufficient_input']).optional(),
});

export const questionItemV2Schema = z.object({
  id: z.string(),
  question: z.string(),
  question_type: z.enum([
    'clarification',
    'disambiguation',
    'critical_gap',
    'reverse_alignment',
    'guided_deepening',
  ]).optional(),
  reason_to_ask: z.string(),
  resolves: z.array(z.string()),
  priority: z.number().int().min(1).max(3),
  expected_answer_type: z.string(),
});

export const questionPlanV2Schema = z.object({
  // The persisted contract remains an array for legacy history. Productive
  // turns are normalized to one question by the session runtime.
  questions: z.array(questionItemV2Schema).max(3),
  question_count: z.number().int().min(0).max(3),
  stop_reason: z.enum([
    'sufficient_context',
    'budget_unavailable',
    'noncritical_gaps_only',
    'exploration_goal_satisfied',
    'later_stage_detail',
    'step_boundary',
    'no_supported_question',
  ]).optional(),
  unresolved_but_noncritical: z.array(z.unknown()).optional(),
  status: z.enum(['questions_required', 'no_questions_required', 'insufficient_input']).optional(),
});

export const portfolioEntryAnalysisV2Schema = z.object({
  entry_id: z.string(),
  analysis_version: z.string(),
  primary_intent: portfolioEntryIntentV2Schema,
  secondary_intents: z.array(portfolioEntryIntentV2Schema),
  initial_entry_state: portfolioEntryFrameV2Schema,
  current_frame: portfolioEntryFrameV2Schema,
  extracted_context: z.record(z.unknown()),
  ambiguities: z.array(z.unknown()),
  contradictions: z.array(z.unknown()),
  reverse_alignment: reverseAlignmentV2Schema,
  provenance: z.unknown(),
  status: portfolioEntryAnalysisStatusV2Schema,
});

export type PortfolioEntryAnalysisV2 = z.infer<typeof portfolioEntryAnalysisV2Schema>;
export type QuestionPlanV2 = z.infer<typeof questionPlanV2Schema>;
