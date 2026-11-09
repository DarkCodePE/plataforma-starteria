import api, { parseApiError } from '../../../app/services/api';

export type PortfolioAttentionStatus = 'open' | 'acknowledged' | 'resolved' | 'cancelled';
export type PortfolioAttentionAction = 'acknowledge' | 'assign' | 'respond' | 'escalate' | 'resolve' | 'cancel' | 'reopen';
export type PortfolioAttentionEvent = {
  id: string; actorId: string; action: string;
  beforeStatus: PortfolioAttentionStatus | null; afterStatus: PortfolioAttentionStatus;
  previousOwnerId: string | null; nextOwnerId: string | null;
  note: string | null; createdAt: string;
};
export type PortfolioAttention = {
  id: string; projectId: string; category: string; reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: PortfolioAttentionStatus; ownerId: string | null; version: number;
  exitCondition: string; nextAction: string; resolutionNote: string | null;
  updatedAt: string; events: PortfolioAttentionEvent[];
};
export type CreateAttention = {
  category: string; reason: string; exitCondition: string; nextAction: string;
  severity: PortfolioAttention['severity']; ownerId?: string | null;
};
export type AttentionCommand = {
  action: PortfolioAttentionAction;
  expectedVersion: number;
  assigneeId?: string;
  note?: string;
};

type Envelope<T> = { success: boolean; data: T };
const route = (projectId: string) => `/portfolio/initiatives/${encodeURIComponent(projectId)}/attention-items`;

export async function listPortfolioAttention(projectId: string): Promise<PortfolioAttention[]> {
  const { data } = await api.get<Envelope<PortfolioAttention[]>>(route(projectId));
  return data.data;
}
export async function createPortfolioAttention(projectId: string, input: CreateAttention, key: string): Promise<PortfolioAttention> {
  const { data } = await api.post<Envelope<PortfolioAttention>>(route(projectId), input, {
    headers: { 'Idempotency-Key': key },
  });
  return data.data;
}
export async function actOnPortfolioAttention(projectId: string, attentionId: string, input: AttentionCommand, key: string): Promise<PortfolioAttention> {
  const { data } = await api.post<Envelope<PortfolioAttention>>(
    `${route(projectId)}/${encodeURIComponent(attentionId)}/actions`, input,
    { headers: { 'Idempotency-Key': key } },
  );
  return data.data;
}
export function attentionError(error: unknown): string {
  return parseApiError(error).message;
}
