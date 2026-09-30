import api, { parseApiError } from '../../../app/services/api';

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
    /** Optional work excerpt supplied by Portfolio Entry when available. */
    existingWork?: string | null;
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
