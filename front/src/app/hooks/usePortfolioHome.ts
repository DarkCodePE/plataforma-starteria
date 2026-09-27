import { useCallback, useEffect, useState } from 'react';
import { getPortfolioHome, type PortfolioHomeResponse } from '../services/portfolioService';

export function usePortfolioHome(enabled = true) {
  const [data, setData] = useState<PortfolioHomeResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPortfolioHome());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);

  return { data, loading, error, refetch };
}
