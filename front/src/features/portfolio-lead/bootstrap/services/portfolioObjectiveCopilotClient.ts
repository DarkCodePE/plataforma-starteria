import api, { parseApiError } from '../../../../app/services/api';

type ApiResponse<T> = { success: boolean; data: T };

export type PortfolioObjectiveSuggestion = {
  suggestedValue: string;
  rationale: string;
  confidence: number;
};

/**
 * Reuses the authenticated, metered field-refinement bridge. The response is
 * deliberately only a suggestion: callers must keep it editable and must not
 * persist it until the Portfolio Lead explicitly incorporates it.
 */
export async function suggestPortfolioObjective(input: {
  currentValue: string;
  draftContext: Record<string, unknown>;
}): Promise<PortfolioObjectiveSuggestion> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioObjectiveSuggestion>>('/ai/refine-field', {
      field: 'portfolio_objective',
      currentValue: input.currentValue,
      draftContext: input.draftContext,
    });
    return data.data;
  } catch (error) {
    const parsed = parseApiError(error);
    throw new Error(parsed.message || 'No pudimos pedir una sugerencia ahora.');
  }
}
