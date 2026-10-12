import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useApp } from '../../../app/context/AppContext';
import { PortfolioSetupArrivalError, readPortfolioSetupHomeArrival,
  type PortfolioSetupHomeArrival } from './portfolioSetupHomeArrivalClient';

const ArrivalContext = createContext<{ data: PortfolioSetupHomeArrival; revalidate: () => void } | null>(null);

export function usePortfolioSetupArrival() {
  const value = useContext(ArrivalContext);
  if (!value) throw new Error('Portfolio Setup arrival requires its consumer gate');
  return value;
}

export function PortfolioSetupArrivalGate({ snapshotId, invalid }: { snapshotId: string | null; invalid: boolean }) {
  const { isAuthenticated, authLoading } = useApp();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error';
    data: PortfolioSetupHomeArrival | null; error: PortfolioSetupArrivalError | null }>(
    { status: 'loading', data: null, error: null });
  const revalidate = useCallback(() => {
    setState({ status: 'loading', data: null, error: null });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/auth', { replace: true }); return; }
    if (invalid || !snapshotId) {
      setState({ status: 'error', data: null, error: new PortfolioSetupArrivalError('INVALID_ARRIVAL_IDENTITY', 400) });
      return;
    }
    let active = true;
    setState({ status: 'loading', data: null, error: null });
    readPortfolioSetupHomeArrival(snapshotId).then((data) => {
      if (active) setState({ status: 'ready', data, error: null });
    }).catch((error: unknown) => {
      if (active) setState({ status: 'error', data: null,
        error: error instanceof PortfolioSetupArrivalError ? error : new PortfolioSetupArrivalError('VALIDATION_FAILED', undefined) });
    });
    return () => { active = false; };
  }, [attempt, authLoading, invalid, isAuthenticated, navigate, snapshotId]);

  if (authLoading || !isAuthenticated) return null;
  if (state.status === 'loading') return (
    <main className="mx-auto max-w-3xl p-5 sm:p-8" role="status" data-testid="portfolio-setup-arrival-loading">
      Verificando tu acceso y la lectura actual del Portfolio…
    </main>
  );
  if (state.status === 'error' || !state.data) {
    const code = state.error?.code ?? 'VALIDATION_FAILED';
    const sourceChanged = code === 'PORTFOLIO_SETUP_ARRIVAL_STALE_SOURCE' || code === 'PORTFOLIO_SETUP_ARRIVAL_PROFILE_CONFLICT';
    const revoked = code === 'PORTFOLIO_SETUP_ARRIVAL_SCOPE_REVOKED';
    const retryable = code === 'PORTFOLIO_SETUP_ARRIVAL_SCOPE_VALIDATION_FAILED' || code === 'NETWORK_ERROR'
      || code === 'VALIDATION_FAILED';
    return (
      <main className="mx-auto max-w-3xl min-w-0 p-5 sm:p-8" role="alert" data-testid="portfolio-setup-arrival-denied">
        <h1 className="text-xl font-semibold">No podemos abrir este Portfolio ahora</h1>
        <p className="mt-3 break-words text-sm">
          {sourceChanged ? 'La lectura de origen cambió. Revisa la entrada actual antes de continuar.'
            : revoked ? 'El acceso a este espacio ya no está disponible.'
              : retryable ? 'No pudimos completar la validación. Puedes reintentar.'
                : 'No encontramos una continuidad válida para esta sesión.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {retryable && <button type="button" onClick={revalidate}>Reintentar validación</button>}
          {sourceChanged && <button type="button" onClick={() => navigate('/public/start')}>Revisar lectura actual</button>}
          {!retryable && !sourceChanged && <button type="button" onClick={() => navigate('/public/start')}>Volver a Entrada</button>}
        </div>
      </main>
    );
  }
  return (
    <ArrivalContext.Provider value={{ data: state.data, revalidate }}>
      <div data-testid="portfolio-setup-arrival-layout" className="flex h-screen min-w-0 overflow-hidden bg-[#f5f4ef]">
        <main className="min-w-0 flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </ArrivalContext.Provider>
  );
}
