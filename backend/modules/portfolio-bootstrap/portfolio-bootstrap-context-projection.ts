import { canonicalContextHash } from './portfolio-bootstrap-context.service';

// KAN-247: this is a read-only projection, NOT a ContextReview write or a
// canonical/AI-confirmed claim. It consumes only historical, persisted inputs.
export type ContextProposalSourceRef =
  | { kind: 'context_narrative_quote'; reviewId: string; reviewVersion: number; fieldPath: 'situation'; quote: string }
  | { kind: 'semantic_fact_quote'; turnId: string; semanticVersion: number; quote: string };

export type ContextProjectionProposal = {
  id: string;
  targetField: 'pilotExperience';
  value: string;
  status: 'UNREVIEWED';
  sourceKind: 'persisted_user_narrative' | 'semantic_fact';
  sourceRef: ContextProposalSourceRef;
};

type CandidateReview = {
  id: string;
  sessionId: string;
  version: number;
  draft: {
    situation: { value: string | null; provenance?: string; sourceRef?: { kind: string } };
    pilotExperience: { value: string | null };
    gaps: string[];
  };
};
type CandidateSemantic = {
  state: {
    dispositions?: Array<{ conceptId: string; disposition: string }>;
    factLedger: Array<{
      conceptId: string;
      value: unknown;
      provenance: string;
      status: string;
      turnId: string;
      semanticVersion: number;
      evidenceRefs: Array<{ kind: string; quote?: string }>;
    }>;
  } | null;
  turns: Array<{ id: string; inputText: string }>;
};

export type ContextProjectionResult = {
  reviewVersion: number | null;
  proposals: ContextProjectionProposal[];
};

function explicitNoPilotQuote(input: string): string | null {
  // Deliberately narrow: not a Spanish-language semantic classifier.
  // Ambiguity, hedging and other declared pilot work must not be suppressed.
  const clauses = input.split(/(?<=[.!?])\s+|\n/).map((part) => part.trim()).filter(Boolean);
  const negative = clauses.filter((clause) => /^(?:nunca|no)\s+hemos\s+probado\s+\S/i.test(clause));
  if (negative.length !== 1) return null;
  const clause = negative[0];
  if (/^(?:nunca|no)\s+hemos\s+probado\s+que\b/i.test(clause)) return null;
  if (/\b(?:pero|aunque)\s+(?:sí|si)\s+(?:que\s+)?hemos\s+probado\b/i.test(input)) return null;
  if (clauses.some((part) => part !== clause
    && /\b(?:sí\s+|si\s+)?hemos\s+probado\b/i.test(part)
    && !/^(?:nunca|no)\s+hemos\s+probado\b/i.test(part))) return null;
  return clause.length <= 1_000 ? clause : null;
}

function proposal(
  sessionId: string,
  value: string,
  sourceKind: ContextProjectionProposal['sourceKind'],
  sourceRef: ContextProposalSourceRef,
): ContextProjectionProposal {
  return {
    id: canonicalContextHash({ sessionId, value, sourceKind, sourceRef }).slice(0, 32),
    targetField: 'pilotExperience',
    value,
    status: 'UNREVIEWED',
    sourceKind,
    sourceRef,
  };
}

/**
 * For flag OFF, recognizes only an unambiguous first-person literal negative
 * in the persisted situation field. For flag ON, consumes previously verified
 * semantic facts with an exact quote in their own persisted turn.
 *
 * This function cannot confirm a field, persist a proposal, or advance E2.
 */
export function buildContextProjection(input: {
  review: CandidateReview | null;
  semantic?: CandidateSemantic | null;
}): ContextProjectionResult {
  const review = input.review;
  if (!review) return { reviewVersion: null, proposals: [] };
  const output = (proposals: ContextProjectionProposal[]): ContextProjectionResult => ({
    reviewVersion: review.version, proposals,
  });

  if (review.draft.pilotExperience.value?.trim() || review.draft.gaps.some((gap) => (
    gap === 'context-disposition:pilotExperience:unknown'
    || gap === 'context-disposition:pilotExperience:not_applicable'
  ))) return output([]);

  const situation = review.draft.situation.value ?? '';
  const narrativeQuote = review.draft.situation.provenance === 'user_declared'
    && review.draft.situation.sourceRef?.kind === 'user_input'
    ? explicitNoPilotQuote(situation)
    : null;
  if (narrativeQuote) return output([proposal(
    review.sessionId, narrativeQuote, 'persisted_user_narrative',
    { kind: 'context_narrative_quote', reviewId: review.id, reviewVersion: review.version, fieldPath: 'situation', quote: narrativeQuote },
  )]);

  const semantic = input.semantic;
  if (!semantic?.state) return output([]);
  if (semantic.state.dispositions?.some((item) => item.conceptId === 'pilot_experience'
    && (item.disposition === 'unknown' || item.disposition === 'not_applicable'))) return output([]);
  const relevant = semantic.state.factLedger.filter((fact) => fact.conceptId === 'pilot_experience'
    && fact.status !== 'retracted' && fact.provenance === 'user_declared');
  // Distinct or conflicting readings should be clarified, never silently chosen.
  if (relevant.length !== 1) return output([]);
  const fact = relevant[0];
  const evidence = fact.evidenceRefs.filter((ref) => ref.kind === 'user_input' && typeof ref.quote === 'string');
  if (evidence.length !== 1) return output([]);
  const quote = evidence[0].quote!;
  const turn = semantic.turns.find((candidate) => candidate.id === fact.turnId);
  if (!turn || !turn.inputText.includes(quote) || explicitNoPilotQuote(quote) !== quote) return output([]);
  return output([proposal(
    review.sessionId, quote, 'semantic_fact',
    { kind: 'semantic_fact_quote', turnId: fact.turnId, semanticVersion: fact.semanticVersion, quote },
  )]);
}
