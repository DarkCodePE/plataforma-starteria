import { describe, expect, it } from 'vitest';
import {
  findObjectSchemasWithoutClosedAdditionalProperties,
  findUnionBranchesWithoutType,
} from '../../portfolio-entry-runtime/model/provider-json-schemas';
import { portfolioBootstrapSemanticProviderJsonSchema } from '../portfolio-bootstrap-semantic-provider-schema';

describe('Portfolio Bootstrap semantic E1 provider JSON Schema', () => {
  it('keeps every object closed and every union branch typed for strict structured output', () => {
    expect(findObjectSchemasWithoutClosedAdditionalProperties(portfolioBootstrapSemanticProviderJsonSchema)).toEqual([]);
    expect(findUnionBranchesWithoutType(portfolioBootstrapSemanticProviderJsonSchema)).toEqual([]);
  });

  it('requires the complete E1 shape and represents absence with required nullable fields', () => {
    const root = portfolioBootstrapSemanticProviderJsonSchema;
    expect(root.type).toBe('object');
    expect(root.required).toEqual([
      'facts',
      'hypotheses',
      'dispositions',
      'questionPlan',
      'synthesis',
      'readyForHumanReview',
      'reason',
    ]);
    expect(root.properties.questionPlan.anyOf?.map((branch) => branch.type)).toEqual(['object', 'null']);
    expect(root.properties.synthesis.anyOf?.map((branch) => branch.type)).toEqual(['object', 'null']);
  });

  it('couples each fact provenance to its governed evidence-reference variants', () => {
    const fact = portfolioBootstrapSemanticProviderJsonSchema.properties.facts.items;
    const [declared, extracted] = fact.anyOf;

    expect(declared.properties.provenance.enum).toEqual(['user_declared']);
    expect(declared.properties.evidenceRefs.items.properties.kind.enum).toEqual(['user_input']);
    expect(extracted.properties.provenance.enum).toEqual(['source_extracted']);
    expect(extracted.properties.evidenceRefs.items.anyOf?.map((branch) => branch.properties.kind.enum[0])).toEqual([
      'context_review_field',
      'company_context_entry',
    ]);
  });
});
