import type { Prisma } from '@prisma/client';
import type { PortfolioSetupHomeArrivalDto } from '../portfolio-entry-continuation/portfolio-setup-home-arrival.service';
import type { DerivedPortfolioAnchor } from './portfolio-anchor-derivation';

/** A 114F transfer provides a working anchor, never approved organizational strategy. */
export function derivePortfolioAnchorFromPortfolioSetup(input: {
  id: string; sessionId: string;
  carriedContext: PortfolioSetupHomeArrivalDto['carriedContext'];
  openItems: PortfolioSetupHomeArrivalDto['openItems'];
}): DerivedPortfolioAnchor {
  const context = input.carriedContext;
  const reading = context?.criticalReading ?? context?.confirmedRepresentation;
  return {
    outcomeStatement: reading?.text ?? 'Lectura de Portfolio pendiente de revisión',
    contextSummary: context?.knownContext?.map((field) => field.text).join('; ') || null,
    decisionToEnable: context?.decisionFrame?.text ?? null,
    businessSignalStatus: 'unknown', businessSignalValue: null,
    status: 'anchor_provisional', provenanceStatus: 'extracted',
    sourceRefs: {
      source: 'PORTFOLIO_SETUP_114F_V1', continuationId: input.id,
      portfolioEntrySessionId: input.sessionId,
      fields: {
        outcomeStatement: reading ?? null,
        contextSummary: context?.knownContext ?? [],
        decisionToEnable: context?.decisionFrame ?? null,
        firstMoveSuggestion: context?.firstMoveSuggestion ?? null,
      },
      openItems: input.openItems,
      reviewRequired: true,
    } as Prisma.InputJsonValue,
  };
}
