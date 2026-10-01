const stringOrNumber = {
  anyOf: [{ type: 'string' }, { type: 'number' }],
} as const;

const unknownValueSchema: JsonSchema = {
  anyOf: [
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'null' },
    { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] } },
  ],
};

export type JsonSchema = {
  type?: string;
  enum?: readonly string[];
  const?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  additionalProperties?: false;
  items?: JsonSchema;
  anyOf?: readonly JsonSchema[];
  oneOf?: readonly JsonSchema[];
  minLength?: number;
  minimum?: number;
  maximum?: number;
  maxItems?: number;
};

export type ProviderSchemaUnionBranchFailure = {
  path: string;
  reason: 'missing_type';
};

const intentEnum = [
  'strategic_goal',
  'portfolio_alignment',
  'portfolio_tracking',
  'portfolio_prioritization',
  'portfolio_reporting',
  'portfolio_governance',
  'initiative_governance',
  'unknown',
] as const;

const frameEnum = [
  'strategy_first',
  'portfolio_first',
  'initiative_first',
  'solution_first',
  'problem_first',
  'opportunity_first',
  'decision_first',
  'reporting_first',
  'unknown',
] as const;

const originEnum = [
  'USER_DECLARED',
  'EXTRACTED_FROM_USER_TEXT',
  'AI_INFERRED',
  'AI_SUGGESTED',
] as const;

function objectSchema(properties: Record<string, JsonSchema>, required = Object.keys(properties)): JsonSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

function nullable(schema: JsonSchema): JsonSchema {
  if (schema.anyOf) return { anyOf: [...schema.anyOf, { type: 'null' }] };
  return { anyOf: [schema, { type: 'null' }] };
}

function arrayOf(items: JsonSchema, maxItems?: number): JsonSchema {
  return maxItems === undefined ? { type: 'array', items } : { type: 'array', items, maxItems };
}

const provenanceEntrySchema = objectSchema({
  path: { type: 'string' },
  origin: { type: 'string', enum: originEnum },
  review_disposition: {
    type: 'string',
    enum: ['UNREVIEWED', 'USER_CONFIRMED', 'USER_REJECTED', 'SUPERSEDED'],
  },
  source_text: nullable({ type: 'string' }),
});

const extractedContextSchema = objectSchema({
  goal: nullable(unknownValueSchema),
  metric: nullable(unknownValueSchema),
  target: nullable(unknownValueSchema),
  baseline: nullable(unknownValueSchema),
  horizon: nullable(unknownValueSchema),
  problem: nullable(unknownValueSchema),
  opportunity: nullable(unknownValueSchema),
  solution: nullable(unknownValueSchema),
  portfolio_size: nullable(unknownValueSchema),
  initiatives_mentioned: nullable(unknownValueSchema),
  decision_need: nullable(unknownValueSchema),
  reporting_need: nullable(unknownValueSchema),
  constraints: nullable(unknownValueSchema),
});

const analysisContextIssueSchema = objectSchema({
  description: { type: 'string' },
  path: nullable({ type: 'string' }),
  expected: nullable(unknownValueSchema),
  actual: nullable(unknownValueSchema),
});

const analysisContextItemSchema = {
  anyOf: [{ type: 'string' }, analysisContextIssueSchema],
} as const satisfies JsonSchema;

const reverseAlignmentSchema = objectSchema({
  required: { type: 'boolean' },
  subject_type: nullable({ type: 'string', enum: ['solution', 'initiative', 'unknown'] }),
  subject: nullable({ type: 'string' }),
  connection_state: nullable({ type: 'string', enum: ['not_required', 'partial', 'required', 'insufficient_input'] }),
  present_links: nullable(arrayOf({ type: 'string' })),
  missing_links: nullable(arrayOf({ type: 'string' })),
  ambiguities: nullable(arrayOf(analysisContextItemSchema)),
  suggested_focus: nullable({ type: 'string' }),
  provenance: nullable(arrayOf(provenanceEntrySchema)),
  activation_reason: nullable({
    type: 'string',
    enum: [
      'initial_solution_or_initiative',
      'late_solution_detected',
      'late_initiative_detected',
      'existing_subject_reassessment',
    ],
  }),
  status: nullable({ type: 'string', enum: ['not_required', 'partial', 'required', 'insufficient_input'] }),
});

const questionItemSchema = objectSchema({
  id: { type: 'string' },
  question: { type: 'string' },
  question_type: nullable({
    type: 'string',
    enum: ['clarification', 'disambiguation', 'critical_gap', 'reverse_alignment', 'guided_deepening'],
  }),
  reason_to_ask: { type: 'string' },
  resolves: arrayOf({ type: 'string' }),
  priority: { type: 'number', minimum: 1, maximum: 3 },
  expected_answer_type: { type: 'string' },
});

const questionPlanSchema = objectSchema({
  questions: arrayOf(questionItemSchema, 3),
  question_count: { type: 'number', minimum: 0, maximum: 3 },
  stop_reason: nullable({
    type: 'string',
    enum: [
      'sufficient_context',
      'budget_unavailable',
      'noncritical_gaps_only',
      'exploration_goal_satisfied',
      'later_stage_detail',
      'step_boundary',
      'no_supported_question',
    ],
  }),
  unresolved_but_noncritical: nullable(arrayOf(analysisContextItemSchema)),
  status: nullable({ type: 'string', enum: ['questions_required', 'no_questions_required', 'insufficient_input'] }),
});

const portfolioEntryAnalysisProperties: Record<string, JsonSchema> = {
  entry_id: { type: 'string' },
  analysis_version: { type: 'string' },
  primary_intent: { type: 'string', enum: intentEnum },
  secondary_intents: arrayOf({ type: 'string', enum: intentEnum }),
  initial_entry_state: { type: 'string', enum: frameEnum },
  current_frame: { type: 'string', enum: frameEnum },
  extracted_context: extractedContextSchema,
  ambiguities: arrayOf(analysisContextItemSchema),
  contradictions: arrayOf(analysisContextItemSchema),
  reverse_alignment: reverseAlignmentSchema,
  provenance: arrayOf(provenanceEntrySchema),
  status: { type: 'string', enum: ['pending', 'ready', 'insufficient_input', 'failed', 'superseded'] },
};

export const portfolioEntryTurnProviderJsonSchema = objectSchema({
  analysis: objectSchema(portfolioEntryAnalysisProperties),
  question_plan: questionPlanSchema,
});

// ADR-032: con Jev como clasificador, el LLM no puede devolver la clasificación.
export const CLASSIFICATION_FIELDS = ['primary_intent', 'secondary_intents', 'initial_entry_state', 'current_frame'] as const;

export const portfolioEntryTurnWithoutClassificationProviderJsonSchema = objectSchema({
  analysis: objectSchema(Object.fromEntries(
    Object.entries(portfolioEntryAnalysisProperties).filter(([key]) => !(CLASSIFICATION_FIELDS as readonly string[]).includes(key)),
  )),
  question_plan: questionPlanSchema,
});

const handoffProvenanceSchema = objectSchema({
  origin: { type: 'string', enum: originEnum },
  source_path: nullable({ type: 'string' }),
  source_text: nullable({ type: 'string' }),
});

const provenancedTextSchema = objectSchema({
  value: { type: 'string', minLength: 1 },
  provenance: nullable(handoffProvenanceSchema),
});

const suggestedApproachSchema = objectSchema({
  description: { type: 'string', minLength: 1 },
  rationale: nullable({ type: 'string', minLength: 1 }),
  assumption: nullable({ type: 'string', minLength: 1 }),
  origin: { type: 'string', const: 'AI_SUGGESTED' },
  review_disposition: { type: 'string', const: 'UNREVIEWED' },
  provenance: nullable(arrayOf(handoffProvenanceSchema)),
});

const knownContextItemSchema = objectSchema({
  key: { type: 'string', minLength: 1 },
  value: { type: 'string', minLength: 1 },
  provenance: nullable(handoffProvenanceSchema),
});

const unresolvedContextItemSchema = objectSchema({
  gap_id: { type: 'string', minLength: 1 },
  description: { type: 'string', minLength: 1 },
  provenance: nullable(handoffProvenanceSchema),
});

const gapResolutionProvenanceSchema = objectSchema({
  origin: { type: 'string', enum: originEnum },
  source_path: nullable({ type: 'string' }),
  source_text: nullable({ type: 'string' }),
});

const gapResolutionSchema = objectSchema({
  gap_id: { type: 'string', minLength: 1 },
  gap_description: { type: 'string', minLength: 1 },
  resolution_type: {
    type: 'string',
    enum: [
      'STARTERIA_CAN_STRUCTURE',
      'STARTERIA_CAN_GUIDE',
      'STARTERIA_CAN_TRACK',
      'REQUIRES_ORGANIZATIONAL_INPUT',
      'REQUIRES_EXTERNAL_EVIDENCE',
      'OUT_OF_SCOPE',
    ],
  },
  starteria_capability: nullable({ type: 'string' }),
  resolution_stage: {
    type: 'string',
    enum: ['PORTFOLIO', 'INITIATIVE_SETUP', 'STEP_0', 'STEP_1', 'STEP_2', 'STEP_3', 'STEP_4', 'EXTERNAL'],
  },
  provenance: nullable(gapResolutionProvenanceSchema),
});

const starteriaPathItemSchema = objectSchema({
  action: {
    type: 'string',
    enum: ['structure', 'make_visible', 'compare_or_follow', 'resolve_gaps', 'prepare_decision'],
  },
  description: { type: 'string', minLength: 1 },
});

export const portfolioEntryHandoffProviderJsonSchema = objectSchema({
  understanding: provenancedTextSchema,
  desired_outcome: provenancedTextSchema,
  decision_to_enable: { anyOf: [provenancedTextSchema, { type: 'string', const: 'unresolved' }] },
  recommended_approach: nullable(suggestedApproachSchema),
  alternative_approaches: arrayOf(suggestedApproachSchema),
  known_context: arrayOf(knownContextItemSchema),
  unresolved_context: arrayOf(unresolvedContextItemSchema),
  gap_resolution_map: arrayOf(gapResolutionSchema),
  evidence_or_clarity_needed: arrayOf(provenancedTextSchema),
  starteria_path: arrayOf(starteriaPathItemSchema),
  recommended_cta: { type: 'string', minLength: 1 },
  provenance_summary: arrayOf(handoffProvenanceSchema),
  handoff_status: { type: 'string', enum: ['ready', 'ready_with_uncertainty', 'insufficient_input'] },
});

export function findObjectSchemasWithoutClosedAdditionalProperties(schema: unknown): string[] {
  const failures: string[] = [];
  visitJsonSchema(schema, '$', (node, path) => {
    if (node.type === 'object' && node.additionalProperties !== false) {
      failures.push(path);
    }
  });
  return failures;
}

export function findUnionBranchesWithoutType(schema: unknown): ProviderSchemaUnionBranchFailure[] {
  const failures: ProviderSchemaUnionBranchFailure[] = [];
  visitJsonSchema(schema, '$', (node, path) => {
    for (const unionKeyword of ['anyOf', 'oneOf'] as const) {
      const branches = node[unionKeyword];
      if (!branches) continue;
      branches.forEach((branch, index) => {
        if (branch && typeof branch === 'object' && !branch.type) {
          failures.push({ path: `${path}.${unionKeyword}.${index}`, reason: 'missing_type' });
        }
      });
    }
  });
  return failures;
}

export function visitJsonSchema(
  schema: unknown,
  path: string,
  visitor: (node: JsonSchema, path: string) => void,
): void {
  if (!schema || typeof schema !== 'object') return;
  const node = schema as JsonSchema;
  visitor(node, path);

  if (node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      visitJsonSchema(child, `${path}.properties.${key}`, visitor);
    }
  }
  if (node.items) visitJsonSchema(node.items, `${path}.items`, visitor);
  if (node.anyOf) {
    node.anyOf.forEach((child, index) => visitJsonSchema(child, `${path}.anyOf.${index}`, visitor));
  }
  if ((node as JsonSchema & { oneOf?: readonly JsonSchema[] }).oneOf) {
    (node as JsonSchema & { oneOf?: readonly JsonSchema[] }).oneOf?.forEach((child, index) => visitJsonSchema(child, `${path}.oneOf.${index}`, visitor));
  }
}
