const object = <T extends Record<string, unknown>>(properties: T) => ({
  type: 'object' as const,
  properties,
  required: Object.keys(properties),
  additionalProperties: false as const,
});

const array = <T>(items: T, bounds: { minItems?: number; maxItems?: number } = {}) => ({
  type: 'array' as const,
  items,
  ...(bounds.minItems === undefined ? {} : { minItems: bounds.minItems }),
  ...(bounds.maxItems === undefined ? {} : { maxItems: bounds.maxItems }),
});

const nullable = <T>(schema: T) => ({
  anyOf: [schema, { type: 'null' as const }],
});

const string = { type: 'string' as const };
const conceptId = { type: 'string' as const, pattern: '^[a-z][a-z0-9_.-]*$' };

const userInputEvidence = object({
  kind: { type: 'string' as const, enum: ['user_input'] as const },
  quote: string,
});

const contextReviewEvidence = object({
  kind: { type: 'string' as const, enum: ['context_review_field'] as const },
  reviewVersion: { type: 'integer' as const, minimum: 1 },
  fieldPath: string,
});

const companyContextEvidence = object({
  kind: { type: 'string' as const, enum: ['company_context_entry'] as const },
  companyId: string,
  versionId: string,
  entryFingerprint: { type: 'string' as const, pattern: '^[a-f0-9]{64}$' },
});

// E1 facts are atomic evidence values. The existing Zod contract remains authoritative
// and intentionally broader; this transport schema only constrains model-generated values
// to the representations currently consumed by Portfolio Bootstrap.
const scalarValue = {
  anyOf: [
    { type: 'string' as const },
    { type: 'number' as const },
    { type: 'boolean' as const },
    { type: 'null' as const },
  ],
};

const factValue = {
  anyOf: [
    ...scalarValue.anyOf,
    array(scalarValue),
    object({ kind: string }),
  ],
};

const factBase = {
  conceptId,
  value: factValue,
  confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
  status: { type: 'string' as const, enum: ['observed', 'confirmed', 'retracted'] as const },
};

const fact = {
  anyOf: [
    object({
      ...factBase,
      provenance: { type: 'string' as const, enum: ['user_declared'] as const },
      evidenceRefs: array(userInputEvidence, { minItems: 1, maxItems: 20 }),
    }),
    object({
      ...factBase,
      provenance: { type: 'string' as const, enum: ['source_extracted'] as const },
      evidenceRefs: array({
        anyOf: [contextReviewEvidence, companyContextEvidence],
      }, { minItems: 1, maxItems: 20 }),
    }),
  ] as const,
};

const hypothesis = object({
  hypothesisId: string,
  statement: string,
  provenance: { type: 'string' as const, enum: ['copilot_inferred', 'copilot_suggested'] as const },
  supportConceptIds: array(conceptId, { maxItems: 50 }),
  confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
  status: { type: 'string' as const, enum: ['proposed'] as const },
});

const disposition = object({
  conceptId,
  disposition: { type: 'string' as const, enum: ['unknown', 'not_applicable'] as const },
  provenance: { type: 'string' as const, enum: ['user_declared'] as const },
  evidenceRefs: array(userInputEvidence, { minItems: 1, maxItems: 20 }),
});

const questionPlan = object({
  question: string,
  reasonToAsk: string,
  resolves: array(conceptId, { minItems: 1, maxItems: 20 }),
});

const landingSynthesis = object({
  summary: string,
  situation: string,
  intention: string,
  mainUncertainty: string,
  directionForE2: string,
  evidenceConceptIds: array(conceptId, { minItems: 1, maxItems: 50 }),
});

/** Strict provider schema for Portfolio Bootstrap E1; Zod remains the authoritative validator. */
export const portfolioBootstrapSemanticProviderJsonSchema = {
  ...object({
    facts: array(fact, { maxItems: 100 }),
    hypotheses: array(hypothesis, { maxItems: 100 }),
    dispositions: array(disposition, { maxItems: 100 }),
    questionPlan: nullable(questionPlan),
    synthesis: nullable(landingSynthesis),
    readyForHumanReview: { type: 'boolean' as const },
    reason: string,
  }),
} as const;
