import { describe, expect, it } from 'vitest';
import {
  confirmPortfolioBootstrapContextBodySchema,
  savePortfolioBootstrapContextDraftBodySchema,
} from '../portfolio-bootstrap.schemas';

const field = (value: string | null, provenance = 'user_declared') => ({
  value,
  provenance,
  ...(provenance === 'user_declared' ? { sourceRef: { kind: 'user_input' } } : {}),
});

const context = {
  situation: field('Situation'),
  area: field(null, 'unknown'),
  stakeholder: field('Operations'),
  pilotExperience: field('One pilot'),
  constraints: [field('Budget')],
  assumptions: [field('Sponsor available')],
  gaps: ['Baseline metric'],
};

describe('portfolio bootstrap E1 context schemas', () => {
  it('accepts the strict additive draft contract without Company context', () => {
    expect(savePortfolioBootstrapContextDraftBodySchema.parse({
      expectedVersion: 0,
      context,
      sourceCompanyContext: null,
    })).toEqual({ expectedVersion: 0, context, sourceCompanyContext: null });
  });

  it('rejects unknown values carrying content or a source and rejects extra fields', () => {
    expect(() => savePortfolioBootstrapContextDraftBodySchema.parse({
      expectedVersion: 0,
      context: { ...context, area: { value: 'hidden', provenance: 'unknown' } },
      sourceCompanyContext: null,
    })).toThrow();
    expect(() => savePortfolioBootstrapContextDraftBodySchema.parse({
      expectedVersion: 0, context, sourceCompanyContext: null, unexpected: true,
    })).toThrow();
  });

  it('requires complete source-extracted provenance and bounds collections', () => {
    expect(() => savePortfolioBootstrapContextDraftBodySchema.parse({
      expectedVersion: 0,
      context: {
        ...context,
        situation: {
          value: 'From Company', provenance: 'source_extracted',
          sourceRef: { kind: 'company_context_entry', dimension: 'IDENTITY', fieldKey: 'purpose' },
        },
      },
      sourceCompanyContext: { companyId: 'company-1', versionId: 'version-1', versionNumber: 1 },
    })).toThrow();
    expect(() => savePortfolioBootstrapContextDraftBodySchema.parse({
      expectedVersion: 0, context: { ...context, gaps: Array.from({ length: 51 }, (_, i) => `gap-${i}`) },
      sourceCompanyContext: null,
    })).toThrow();
  });

  it('requires a positive current version for confirmation', () => {
    expect(confirmPortfolioBootstrapContextBodySchema.parse({ expectedVersion: 1 })).toEqual({ expectedVersion: 1 });
    expect(() => confirmPortfolioBootstrapContextBodySchema.parse({ expectedVersion: 0 })).toThrow();
  });

  it('keeps Copilot provenance even when its optional reference is absent', () => {
    expect(savePortfolioBootstrapContextDraftBodySchema.parse({
      expectedVersion: 0,
      context: { ...context, situation: { value: 'Hypothesis', provenance: 'copilot_inferred' } },
      sourceCompanyContext: null,
    }).context?.situation?.provenance).toBe('copilot_inferred');
  });
});
