const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const string = { type: 'string', minLength: 1, pattern: '\\S' } as const;
const plainString = { type: 'string' } as const;
const nullableString = { anyOf: [string, { type: 'null' }] } as const;
const enumString = (values: readonly string[]) => ({ type: 'string', enum: values });
const array = (items: unknown, minItems?: number) => ({
  type: 'array',
  items,
  ...(minItems === undefined ? {} : { minItems }),
});
const nullable = (schema: unknown) => ({ anyOf: [schema, { type: 'null' }] });

const roles = ['FACT', 'INTERPRETATION', 'PROPOSAL', 'UNKNOWN'] as const;
const origins = ['USER_DECLARED', 'EXTRACTED_FROM_USER_TEXT', 'AI_INFERRED', 'AI_SUGGESTED'] as const;
const reviewDispositions = ['UNREVIEWED', 'USER_CONFIRMED', 'USER_REJECTED', 'SUPERSEDED'] as const;
const sourceRef = string;

const claim = object({
  statement: string,
  support: array(sourceRef),
  epistemic_role: enumString(roles),
});

const materialTension = {
  anyOf: [
    object({
      statement: string,
      status: { type: 'string', enum: ['supported'] },
      support: array(sourceRef, 1),
      why_it_matters: string,
      affected_decision: string,
    }),
    object({
      statement: string,
      status: { type: 'string', enum: ['unresolved'] },
      support: array(sourceRef),
      why_it_matters: string,
      affected_decision: string,
    }),
  ],
};

const situationModel = object({
  desired_change: nullable(claim),
  current_situation: array(claim),
  existing_work_or_assets: array(claim),
  decision_to_enable: nullable(claim),
  known_evidence: array(claim),
  constraints: array(claim),
  actors_and_authority: array(claim),
  dependencies: array(claim),
  uncertainties: array(claim),
  time_pressure: array(claim),
  existing_alternatives: array(claim),
  material_tensions: array(materialTension),
}, [
  'desired_change',
  'current_situation',
  'existing_work_or_assets',
  'decision_to_enable',
  'known_evidence',
  'constraints',
  'actors_and_authority',
  'dependencies',
  'uncertainties',
  'time_pressure',
  'existing_alternatives',
  'material_tensions',
]);

const supportedInsight = object({
  statement: string,
  support: array(sourceRef, 1),
  novelty_type: enumString([
    'relationship_made_explicit',
    'tension_made_explicit',
    'decision_structure_clarified',
    'sequence_dependency_exposed',
  ]),
  epistemic_role: { type: 'string', enum: ['INTERPRETATION'] },
  status: { type: 'string', enum: ['supported'] },
});

const unsupportedInsight = object({
  statement: { type: 'null' },
  support: { ...array(sourceRef), maxItems: 0 },
  novelty_type: { type: 'string', enum: ['no_supported_insight'] },
  epistemic_role: { type: 'string', enum: ['INTERPRETATION'] },
  status: { type: 'string', enum: ['no_supported_insight'] },
});

const decisionFrame = {
  anyOf: [
    object({
      status: { type: 'string', enum: ['framed'] },
      decision_to_prepare: string,
      decision_authority: string,
      materially_distinct_paths: array(string),
      distinguishing_conditions: array(string),
      timing_or_constraints: array(string),
      unresolved_basis: array(string),
    }),
    object({
      status: { type: 'string', enum: ['not_yet_identifiable'] },
      decision_to_prepare: { type: 'null' },
      decision_authority: string,
      materially_distinct_paths: array(string),
      distinguishing_conditions: array(string),
      timing_or_constraints: array(string),
      unresolved_basis: array(string),
    }),
  ],
};

const usableNow = object({
  item: string,
  how_it_can_help: string,
  source_refs: array(sourceRef, 1),
  provenance_refs: array(string, 1),
});

const impactDimensions = [
  'situation_reading',
  'decision_frame',
  'material_tension',
  'first_movement',
  'critical_dependency',
  'material_risk',
  'ability_to_act_now',
  'starteria_continuation_shape',
] as const;

const decisionChangingUnknown = object({
  uncertainty: string,
  why_it_matters: string,
  current_evidence: nullable(array(sourceRef)),
  resolution_mode: string,
  related_decision: string,
  impact_dimensions: array(enumString(impactDimensions), 1),
});

const firstMovement = object({
  movement: string,
  why_now: string,
  existing_assets_used: array(string),
  what_it_may_clarify: string,
  decision_supported: string,
  boundary: string,
  epistemic_role: { type: 'string', enum: ['PROPOSAL'] },
});

const provenance = object({
  id: string,
  claim_ref: string,
  origin: enumString(origins),
  review_disposition: enumString(reviewDispositions),
  source_refs: array(sourceRef, 1),
  source_path: nullableString,
  source_text: nullable(plainString),
  recorded_at: nullable(plainString),
});

/** Strict provider JSON Schema dedicated to Skill 05; analysis_turn keeps its own schema. */
export const criticalSituationSynthesisProviderSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...object({
    basis_status: enumString(['sufficient', 'partial', 'insufficient_basis']),
    situation_model: situationModel,
    reasoning_metadata: object({
      selected_lenses: array(enumString([
        'priority / allocation',
        'diagnosis',
        'evidence / learning',
        'sequencing',
        'dependencies',
        'governance',
        'capacity',
        'risk',
        'alignment',
        'system design',
      ])),
    }),
    situation_insight: { anyOf: [supportedInsight, unsupportedInsight] },
    material_tensions: array(materialTension),
    decision_frame: decisionFrame,
    usable_now: array(usableNow),
    decision_changing_unknowns: array(decisionChangingUnknown),
    candidate_first_movement: nullable(firstMovement),
    uncertainty_statement: nullableString,
    provenance: array(provenance),
  }, [
    'basis_status',
    'situation_model',
    'reasoning_metadata',
    'situation_insight',
    'material_tensions',
    'decision_frame',
    'usable_now',
    'decision_changing_unknowns',
    'candidate_first_movement',
    'uncertainty_statement',
    'provenance',
  ]),
} as const;
