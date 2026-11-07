import api, { parseApiError } from '../../../app/services/api';

type Envelope<T> = { success: true; data: T };

export type PortfolioLabRequestStatus =
  | 'REQUESTED'
  | 'CONTACT_PENDING'
  | 'MEETING_SCHEDULED'
  | 'UNDER_REVIEW'
  | 'CLOSED'
  | 'NOT_PROCEEDING'
  | 'CANCELLED';

export type PortfolioLabNotificationStatus = 'PENDING' | 'FAILED' | 'NOTIFIED';

export type PortfolioLabRequest = {
  id: string;
  organizationId: string;
  challengeId: string;
  briefId: string;
  briefVersionId: string;
  requesterId: string;
  consentAt: string;
  consentPurpose: string;
  status: PortfolioLabRequestStatus;
  notificationStatus: PortfolioLabNotificationStatus;
  providerMessageRef: string | null;
  lastNotificationError: string | null;
  terminalAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePortfolioLabRequestInput = {
  challengeId: string;
  briefId: string;
  briefVersionId: string;
  consentAccepted: true;
  consentPurpose: string;
};

export type CreatePortfolioLabRequestResult = {
  request: PortfolioLabRequest;
  idempotent: boolean;
  deduplicated: boolean;
};

export async function listPortfolioLabRequests(): Promise<PortfolioLabRequest[]> {
  try {
    const { data } = await api.get<Envelope<PortfolioLabRequest[]>>('/portfolio-lab/requests');
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

export async function createPortfolioLabRequest(input: CreatePortfolioLabRequestInput, idempotencyKey: string): Promise<CreatePortfolioLabRequestResult> {
  try {
    const { data } = await api.post<Envelope<CreatePortfolioLabRequestResult>>('/portfolio-lab/requests', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

export async function retryPortfolioLabNotification(requestId: string, idempotencyKey: string): Promise<{ request: PortfolioLabRequest; idempotent: boolean }> {
  try {
    const { data } = await api.post<Envelope<{ request: PortfolioLabRequest; idempotent: boolean }>>(
      `/portfolio-lab/requests/${encodeURIComponent(requestId)}/notification-retry`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}
