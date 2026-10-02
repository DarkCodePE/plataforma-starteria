import api from '../../../app/services/api';

export interface FirstValueP3Request {
  sessionId: string;
  requestId: string;
  p2Confirmed: true;
  goal: string;
  context?: string;
  initiatives: Array<{
    itemId: string;
    name: string;
    description?: string;
  }>;
  clarifications?: Array<{
    id: string;
    affectedItemIds: string[];
    answer: string;
  }>;
}

export interface FirstValueP3Result {
  sessionId: string;
  requestId: string;
  analysisId: string;
  relationships: Array<{
    itemId: string;
    disposition: 'DIRECT_CONTRIBUTION' | 'NEEDS_CONTEXT' | 'POSSIBLE_OTHER_PRIORITY';
    rationale: string;
    evidenceRefs: string[];
    inferred: boolean;
  }>;
  clarifications: Array<{
    id: string;
    affectedItemIds: string[];
    question: string;
    reason: string;
  }>;
  summary: {
    analyzedItemCount: number;
    counts: Record<'DIRECT_CONTRIBUTION' | 'NEEDS_CONTEXT' | 'POSSIBLE_OTHER_PRIORITY', number>;
    exceptionFirstNarrative: string;
  };
  provenance: unknown;
  resultState: 'PROVISIONAL';
}

/** Calls the dedicated KAN-86 endpoint through the authenticated platform API client. */
export async function analyzeFirstValueP3(input: FirstValueP3Request): Promise<FirstValueP3Result> {
  const response = await api.post<{ success: true; data: FirstValueP3Result }>('/first-value/p3/analyze', input);
  return response.data.data;
}
