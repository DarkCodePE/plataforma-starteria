import api, { parseApiError, type AuthError } from '../../../app/services/api';
import type { PrioritizationRecommendationResult, PromotionSummary, StrategicFramingChallengeStructuringState, StrategicFramingDraft, StrategicFramingPromotionResponse, StrategicFramingState, StrategicLensSuggestionResult } from './types';

type Envelope<T> = { success: true; data: T };
export type StrategicFramingCorrection = Partial<StrategicFramingDraft> & { expectedVersion: number; reason?: string | null };

export async function getStrategicFramingState(stateId: string): Promise<StrategicFramingState> {
  try {
    const { data } = await api.get<Envelope<StrategicFramingState>>(`/strategic-framing/states/${encodeURIComponent(stateId)}`);
    return data.data;
  } catch (error) { throw parseApiError(error); }
}

export async function updateStrategicFramingState(stateId: string, correction: StrategicFramingCorrection): Promise<StrategicFramingState> {
  try {
    const { data } = await api.patch<Envelope<StrategicFramingState>>(`/strategic-framing/states/${encodeURIComponent(stateId)}`, correction);
    return data.data;
  } catch (error) { throw parseApiError(error); }
}

export async function getStrategicFramingLensSuggestions(stateId: string): Promise<StrategicLensSuggestionResult> {
  try {
    const { data } = await api.get<Envelope<StrategicLensSuggestionResult>>(`/strategic-framing/states/${encodeURIComponent(stateId)}/lens-suggestions`);
    return data.data;
  } catch (error) { throw parseApiError(error); }
}

export async function getStrategicFramingPrioritizationRecommendations(stateId: string): Promise<PrioritizationRecommendationResult> {
  try { const { data } = await api.get<Envelope<PrioritizationRecommendationResult>>(`/strategic-framing/states/${encodeURIComponent(stateId)}/prioritization-recommendations`); return data.data; } catch (error) { throw parseApiError(error); }
}

export type PrioritizationReviewBody = { expectedVersion: number; focusSlots?: number | null; focusRationale?: string | null; decisions?: Array<{ candidateId: string; disposition: 'address_now' | 'observe' | 'discard'; rationale?: string | null; recommendationSnapshot: PrioritizationRecommendationResult['recommendations'][number]['recommendationSnapshot'] }>; reason?: string | null };
export async function reviewStrategicFramingPrioritization(stateId: string, body: PrioritizationReviewBody): Promise<StrategicFramingState> {
  try { const { data } = await api.post<Envelope<StrategicFramingState>>(`/strategic-framing/states/${encodeURIComponent(stateId)}/prioritization-review`, body); return data.data; } catch (error) { throw parseApiError(error); }
}

export type ChallengeStructureReviewBody = { expectedVersion: number; groups: Array<Omit<StrategicFramingChallengeStructuringState['candidates'][number], 'challengeCandidateId' | 'confirmedByUserId' | 'confirmedAt' | 'createdFromStateVersion'> & { challengeCandidateId?: string }>; reason?: string | null };
export async function reviewStrategicFramingChallengeStructure(stateId: string, body: ChallengeStructureReviewBody): Promise<StrategicFramingState> {
  try { const { data } = await api.post<Envelope<StrategicFramingState>>(`/strategic-framing/states/${encodeURIComponent(stateId)}/challenge-structure-review`, body); return data.data; } catch (error) { throw parseApiError(error); }
}

export async function getStrategicFramingPromotions(stateId: string): Promise<PromotionSummary[]> {
  try { const { data } = await api.get<Envelope<PromotionSummary[]>>(`/strategic-framing/states/${encodeURIComponent(stateId)}/promotions`); return data.data; } catch (error) { throw parseApiError(error); }
}

export type PromoteStrategicFramingChallengeBody = { challengeCandidateId: string; expectedVersion: number; strategicFrontId: string; title: string; statement: string; type: 'correccion' | 'crecimiento' | 'exploracion'; objective?: string | null; whyNow?: string | null; successCriteria?: string | null; rationale?: string | null };
export async function promoteStrategicFramingChallenge(stateId: string, body: Omit<PromoteStrategicFramingChallengeBody, 'challengeCandidateId'> & { challengeCandidateId: string }): Promise<StrategicFramingPromotionResponse> {
  try { const { data } = await api.post<Envelope<StrategicFramingPromotionResponse>>(`/strategic-framing/states/${encodeURIComponent(stateId)}/promotions`, body); return data.data; } catch (error) { throw parseApiError(error); }
}

export type StrategicFramingEntryInput =
  | { sourceMode: 'public_entry'; bootstrapSessionId: string }
  | { sourceMode: 'enterprise_direct'; intendedMovement: string; whyItMatters?: string | null; movementSignalValue?: string | null; decisionToEnable?: string | null }
  | { sourceMode: 'existing_portfolio'; sourceType: 'strategic_front' | 'challenge' | 'initiative'; sourceId: string };

export type StrategicFramingEntryResult = {
  state: StrategicFramingState;
  reused: boolean;
  sourceMode: StrategicFramingEntryInput['sourceMode'];
  workspacePath: string;
};

export async function createOrReuseStrategicFramingFromSource(input: StrategicFramingEntryInput, idempotencyKey?: string): Promise<StrategicFramingEntryResult> {
  try {
    const { data } = await api.post<Envelope<StrategicFramingEntryResult>>('/strategic-framing/states/from-source', input, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined);
    return data.data;
  } catch (error) { throw parseApiError(error); }
}

export type StrategicFramingError = AuthError;
