import api from '../../../app/services/api';
import type { StepReasoningClient, StepReasoningSessionView, StepReasoningTurnResult } from '../domain/types';

interface Envelope<T> { success: boolean; data: T }

export interface StepReasoningEligibility {
  enabled: boolean;
  mode: 'qa_stub' | null;
}

export async function getStepReasoningEligibility(): Promise<StepReasoningEligibility> {
  const { data } = await api.get<Envelope<StepReasoningEligibility>>('/projects/step-reasoning/eligibility');
  return data.data;
}

export const httpStepReasoningClient: StepReasoningClient = {
  async getSession(projectId, stepNumber): Promise<StepReasoningSessionView> {
    const { data } = await api.get<Envelope<StepReasoningSessionView>>(`/projects/${projectId}/steps/${stepNumber}/copilot/session`);
    return data.data;
  },
  async sendTurn(projectId, stepNumber, input): Promise<StepReasoningTurnResult> {
    const { data } = await api.post<Envelope<StepReasoningTurnResult>>(`/projects/${projectId}/steps/${stepNumber}/copilot/turn`, input, {
      headers: { 'Idempotency-Key': input.clientTurnId },
    });
    return data.data;
  },
};
