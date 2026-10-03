import api, { parseApiError } from '../../../app/services/api';
import { readClaimedPortfolioEntryBriefIdentity } from '../public/storage';

export type PortfolioHomeEntryContext = {
  continuationId: string;
  sessionId: string;
  organization: { id: string; name: string };
  arrival: {
    understoodNeed: string | null;
    desiredOutcome: string | null;
    confirmedContext: string[];
    openItems: string[];
    laterWork: string[];
    organizationalUnknowns: string[];
    nextStep: string;
  };
};

export class PortfolioHomeEntryContextError extends Error {
  constructor(readonly apiError: ReturnType<typeof parseApiError>) {
    super(apiError.message);
  }
}

export async function readPortfolioHomeEntryContext(continuationId: string): Promise<PortfolioHomeEntryContext> {
  try {
    const { data } = await api.get<{ success: true; data: PortfolioHomeEntryContext }>(
      `/public/portfolio-entry/continuations/${encodeURIComponent(continuationId)}/home-context`,
    );
    return data.data;
  } catch (error) {
    throw new PortfolioHomeEntryContextError(parseApiError(error));
  }
}

export async function authorizeScopedFirstValueEntry(): Promise<boolean> {
  const identity = readClaimedPortfolioEntryBriefIdentity();
  if (!identity) return false;
  try {
    const { data } = await api.post<{ success: true; data: { continuationId: string } }>(
      '/public/portfolio-entry/continuations/scoped-first-value-access', identity,
    );
    return Boolean(data.data.continuationId);
  } catch {
    return false;
  }
}
