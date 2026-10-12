import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioLeadLayout } from '../PortfolioLeadLayout';
import { usePortfolioSetupArrival } from '../../../features/portfolio-entry/home/PortfolioSetupArrivalGate';
import { PortfolioSetupArrivalError } from '../../../features/portfolio-entry/home/portfolioSetupHomeArrivalClient';

const mocks = vi.hoisted(() => ({ read: vi.fn(), lead: vi.fn(), legacy: vi.fn() }));
vi.mock('../../../features/portfolio-entry/home/portfolioSetupHomeArrivalClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-entry/home/portfolioSetupHomeArrivalClient')>();
  return { ...actual, readPortfolioSetupHomeArrival: mocks.read };
});
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ isAuthenticated: true, authLoading: false,
  user: { role: 'portfolio_lead', permissions: ['portfolio:read'] } }) }));
vi.mock('../../portfolio/PortfolioLeadContext', () => ({ usePortfolioLead: () => mocks.lead() }));
vi.mock('../../../features/portfolio-entry/home/usePortfolioHomeEntryContext', () => ({
  usePortfolioHomeEntryContext: () => mocks.legacy(), useScopedFirstValueEntryAccess: () => ({ status: 'idle', authorized: false }),
}));

function Probe() {
  const { data } = usePortfolioSetupArrival();
  return <div data-testid="scoped-arrival">{data.organization.name}</div>;
}
function mount(path = '/portfolio/inicio?portfolioSetupContinuationId=snapshot-1') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/portfolio" element={<PortfolioLeadLayout />}><Route path="inicio" element={<Probe />} /></Route>
    <Route path="/public/start" element={<div>Entry</div>} />
  </Routes></MemoryRouter>);
}
const dto = { dtoVersion: 'portfolio-setup-home-arrival-v0.1', snapshotId: 'snapshot-1', snapshotGeneration: 1,
  sessionId: 'session-1', organization: { id: 'org-1', name: 'Safe tenant' },
  source: { contextRevision: 1, criticalHandoffId: 'handoff-1', criticalHandoffVersion: 1 },
  continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 }, carriedContext: null, openItems: [],
  currentness: 'REVALIDATED_AT_HOME_ARRIVAL', bootstrapEligible: true };

describe('114F Layout consumer gate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('holds tenant UI until server validation even when the user has global portfolio:read', async () => {
    let release!: (value: typeof dto) => void;
    mocks.read.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    mount();
    expect(screen.getByTestId('portfolio-setup-arrival-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('scoped-arrival')).not.toBeInTheDocument();
    expect(mocks.lead).not.toHaveBeenCalled();
    expect(mocks.legacy).not.toHaveBeenCalled();
    release(dto);
    expect(await screen.findByText('Safe tenant')).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledWith('snapshot-1');
  });

  it.each([
    ['PORTFOLIO_SETUP_ARRIVAL_SCOPE_REVOKED', 403],
    ['PORTFOLIO_SETUP_ARRIVAL_STALE_SOURCE', 409],
    ['PORTFOLIO_SETUP_ARRIVAL_NOT_FOUND', 404],
  ])('fails closed for %s with no tenant outlet', async (code, status) => {
    mocks.read.mockRejectedValue(new PortfolioSetupArrivalError(code, status));
    mount();
    expect(await screen.findByTestId('portfolio-setup-arrival-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('scoped-arrival')).not.toBeInTheDocument();
    expect(mocks.lead).not.toHaveBeenCalled();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });

  it('retries a technical resolver failure without mounting tenant UI first', async () => {
    mocks.read.mockRejectedValueOnce(new PortfolioSetupArrivalError('PORTFOLIO_SETUP_ARRIVAL_SCOPE_VALIDATION_FAILED', 503))
      .mockResolvedValueOnce(dto);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar validación' }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Safe tenant')).toBeInTheDocument();
  });

  it('rejects a mixed legacy and 114F identity without reading either endpoint', async () => {
    mount('/portfolio/inicio?portfolioSetupContinuationId=snapshot-1&portfolioEntryContinuationId=legacy-1');
    expect(await screen.findByTestId('portfolio-setup-arrival-denied')).toBeInTheDocument();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
});
