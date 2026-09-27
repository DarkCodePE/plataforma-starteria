import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPortfolioHome } from '../../services/portfolioService';
import { usePortfolioHome } from '../usePortfolioHome';

vi.mock('../../services/portfolioService', async importOriginal => ({
  ...(await importOriginal<typeof import('../../services/portfolioService')>()),
  getPortfolioHome: vi.fn(),
}));

describe('usePortfolioHome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('FE-SF-07 retries through the existing Home refetch', async () => {
    vi.mocked(getPortfolioHome).mockResolvedValue({ strategicFraming: { status: 'unavailable' }, portfolioReading: null, governance: null, strategicUnits: [], attention: [], pendingDecisions: [], recommendations: [], generatedAt: '' });
    const { result } = renderHook(() => usePortfolioHome());
    await waitFor(() => expect(getPortfolioHome).toHaveBeenCalledTimes(1));
    await result.current.refetch();
    expect(getPortfolioHome).toHaveBeenCalledTimes(2);
  });

  it('FE-SF-08 makes no Strategic Framing request and can be disabled for Bootstrap Home', async () => {
    const { result } = renderHook(() => usePortfolioHome(false));
    expect(result.current.loading).toBe(false);
    expect(getPortfolioHome).not.toHaveBeenCalled();
  });
});
