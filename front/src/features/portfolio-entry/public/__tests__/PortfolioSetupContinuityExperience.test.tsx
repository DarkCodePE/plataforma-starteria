import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioSetupContinuityExperience } from '../PortfolioSetupContinuityExperience';
import type { PortfolioSetupContinuityRead } from '../portfolioSetupContinuity.types';
import type { StarteriaPathSupportedDto } from '../starteriaPath.types';

const mocks = vi.hoisted(() => ({
  read: vi.fn(), write: vi.fn(), claimed: vi.fn(), code: vi.fn(), status: vi.fn(), key: vi.fn(),
}));
vi.mock('../portfolioSetupContinuity.client', () => ({
  getPortfolioSetupContinuity: mocks.read, continuePortfolioSetup: mocks.write,
  portfolioSetupErrorCode: mocks.code, portfolioSetupHttpStatus: mocks.status,
}));
vi.mock('../portfolioEntryPublicService', () => ({ getClaimedPortfolioEntrySession: mocks.claimed }));
vi.mock('../idempotency', () => ({ createIdempotencyKey: mocks.key }));

const sessionId = 'session-1';
const source = {
  sessionId, contextRevision: 2, criticalHandoffId: 'handoff-1', criticalHandoffVersion: 1,
  criticalHandoffSchemaVersion: 'critical-v1', confirmedAt: '2026-10-12T10:00:00.000Z',
};
const scopeA = { organizationId: 'org-a', name: 'Organización Alfa' };
const scopeB = { organizationId: 'org-b', name: 'Organización Beta' };
const path = {
  experienceState: 'SUPPORTED',
  sourceBinding: {
    criticalHandoffId: 'handoff-1', criticalHandoffVersion: 1, sourceContextRevision: 2,
    current: true, confirmed: true, projectionVersion: 'starteria-path-projection-v0.1',
    pathSchemaVersion: 'starteria-path-dto-v0.2', businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
  },
  valueBridge: { starteriaContribution: [{ statement: 'Ordenar lo que ya sabemos.' }] },
  boundaryStatement: 'Las decisiones siguen siendo humanas.',
} as unknown as StarteriaPathSupportedDto;

function dto(status: PortfolioSetupContinuityRead['status'], overrides: Partial<PortfolioSetupContinuityRead> = {}): PortfolioSetupContinuityRead {
  return {
    dtoVersion: 'portfolio-setup-continuity-read-v0.1', status, sourceBinding: source,
    scopeState: 'NONE', portfolioAccess: { portfolioRead: false }, openItems: [],
    carriedContext: { criticalReading: 'Tu situación confirmada.', truthClass: 'CONFIRMED_REPRESENTATION' },
    ...overrides,
  };
}
const ready = () => dto('READY_AUTHORIZED_SCOPE', {
  scopeState: 'ONE', authorizedScopes: [scopeA], currentScope: scopeA,
  portfolioAccess: { portfolioRead: true, checkedAt: '2026-10-12T10:00:00.000Z' },
});
const select = () => dto('SELECT_SCOPE', {
  scopeState: 'MULTIPLE', authorizedScopes: [scopeA, scopeB],
});
const success = {
  dtoVersion: 'portfolio-setup-continuity-write-v0.1', snapshotId: 'snapshot-1', snapshotGeneration: 1,
  snapshotState: 'CURRENT', sessionRevision: 8, sourceBinding: source,
  continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 },
  organizationScopeId: 'org-a', nextAuthorizedSurface: 'PORTFOLIO_HOME_BOOTSTRAP',
  currentness: 'REVALIDATED_AT_WRITE', createdAt: '2026-10-12T10:01:00.000Z',
};
const review = vi.fn();
const restart = vi.fn();
function mount() {
  return render(<PortfolioSetupContinuityExperience sessionId={sessionId} path={path}
    onReviewSource={review} onStartNewEntry={restart} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.claimed.mockResolvedValue({ id: sessionId, ownership: { state: 'CLAIMED' }, revision: 7 });
  mocks.read.mockResolvedValue(ready());
  mocks.write.mockResolvedValue(success);
  mocks.code.mockReturnValue(undefined);
  mocks.status.mockReturnValue(undefined);
  let keyCount = 0;
  mocks.key.mockImplementation(() => `key-${++keyCount}`);
});

describe('114F Portfolio Setup continuity', () => {
  it('shows a neutral loading state before any scope response', () => {
    mocks.read.mockReturnValue(new Promise(() => undefined));
    mount();
    expect(screen.getByTestId('portfolio-setup-loading')).toHaveTextContent('Recuperando tu contexto');
    expect(screen.queryByText(scopeA.name)).not.toBeInTheDocument();
  });

  it.each([
    ['READY_PROVISIONAL', 'Tu avance está guardado'],
    ['NO_AUTHORIZED_SCOPE', 'Ya no encontramos un espacio'],
    ['SCOPE_VALIDATION_FAILED', 'no pudo verificar tus espacios'],
    ['STALE_SOURCE', 'lectura que confirmó este camino cambió'],
    ['PROFILE_CONFLICT', 'no puede continuar con seguridad'],
    ['BLOCKED_AUTHORITY', 'Falta una autorización organizacional'],
    ['ERROR', 'No pudimos recuperar esta continuidad'],
  ] as const)('renders %s safely', async (status, message) => {
    mocks.read.mockResolvedValue(dto(status));
    mount();
    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar con este contexto' })).not.toBeInTheDocument();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('shows one authorized scope without redundant selection and omits organizationId on POST', async () => {
    mount();
    expect(await screen.findByText(scopeA.name)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
    const [id, request, key] = mocks.write.mock.calls[0];
    expect(id).toBe(sessionId);
    expect(key).toBe('key-1');
    expect(request).toEqual({ expectedSessionRevision: 7, sourceBinding: {
      ...source, starteriaPath: {
        projectionVersion: path.sourceBinding.projectionVersion,
        schemaVersion: path.sourceBinding.pathSchemaVersion,
        boundaryVersion: path.sourceBinding.businessCapabilityBoundaryVersion,
        criticalHandoffId: source.criticalHandoffId,
        criticalHandoffVersion: source.criticalHandoffVersion,
        sourceContextRevision: source.contextRevision,
      },
    } });
    expect(Object.keys(request)).toEqual(['expectedSessionRevision', 'sourceBinding']);
    expect(await screen.findByText(/La continuidad quedó preparada/)).toBeInTheDocument();
    const portfolioAction = screen.getByRole('link', { name: 'Continuar al portafolio' });
    expect(portfolioAction).toHaveAttribute('href', '/portfolio/inicio?portfolioSetupContinuationId=snapshot-1');
    expect(portfolioAction.getAttribute('href')).not.toContain('org-a');
    expect(window.location.pathname).not.toBe('/portfolio/inicio');
  });

  it('requires explicit selection among only server scopes', async () => {
    mocks.read.mockResolvedValue(select());
    mocks.write.mockResolvedValue({ ...success, organizationScopeId: 'org-b' });
    mount();
    const group = await screen.findByRole('group', { name: 'Elige dónde continuar' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText('Organización Gamma')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con este contexto' })).toBeDisabled();
    fireEvent.click(within(group).getByRole('radio', { name: scopeB.name }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
    expect(mocks.write.mock.calls[0][1].organizationId).toBe('org-b');
  });

  it('sends the revalidated current snapshot scope when other scopes also exist', async () => {
    mocks.read.mockResolvedValue(dto('READY_AUTHORIZED_SCOPE', {
      scopeState: 'MULTIPLE', authorizedScopes: [scopeA, scopeB], currentScope: scopeB,
      portfolioAccess: { portfolioRead: true },
    }));
    mocks.write.mockResolvedValue({ ...success, organizationScopeId: 'org-b' });
    mount();
    expect(await screen.findByText(scopeB.name)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
    expect(mocks.write.mock.calls[0][1].organizationId).toBe('org-b');
  });

  it('reuses the same key after an uncertain network failure', async () => {
    mocks.write.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(success);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con este contexto' }));
    await screen.findByText(/No pudimos confirmar el resultado/);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(2));
    expect(mocks.write.mock.calls[0][2]).toBe(mocks.write.mock.calls[1][2]);
  });

  it('creates a new key after a material scope change', async () => {
    mocks.read.mockResolvedValue(select());
    mocks.write.mockRejectedValue(new Error('network'));
    mount();
    fireEvent.click(await screen.findByRole('radio', { name: scopeA.name }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await screen.findByText(/No pudimos confirmar el resultado/);
    fireEvent.click(screen.getByRole('radio', { name: scopeB.name }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(2));
    expect(mocks.write.mock.calls.map((call) => call[2])).toEqual(['key-1', 'key-2']);
  });

  it('refreshes GET after POST scope conflict and asks for a new review', async () => {
    mocks.code.mockReturnValue('SCOPE_NOT_AUTHORIZED');
    mocks.write.mockRejectedValue(new Error('conflict'));
    mocks.read.mockResolvedValueOnce(ready()).mockResolvedValueOnce(dto('NO_AUTHORIZED_SCOPE'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Ya no encontramos un espacio/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar con este contexto' })).not.toBeInTheDocument();
  });

  it('does not POST a stale path and offers review', async () => {
    mocks.read.mockResolvedValue(dto('STALE_SOURCE'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar lectura actual' }));
    expect(review).toHaveBeenCalledTimes(1);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('retries technical scope resolution with GET', async () => {
    mocks.read.mockResolvedValueOnce(dto('SCOPE_VALIDATION_FAILED')).mockResolvedValueOnce(ready());
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a comprobar' }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(scopeA.name)).toBeInTheDocument();
  });

  it('clears selection and idempotency after GET changes the source binding', async () => {
    const nextSource = { ...source, contextRevision: 3, criticalHandoffId: 'handoff-2', confirmedAt: '2026-10-12T11:00:00.000Z' };
    const nextPath = { ...path, sourceBinding: {
      ...path.sourceBinding, criticalHandoffId: 'handoff-2', sourceContextRevision: 3,
    } } as StarteriaPathSupportedDto;
    mocks.read.mockResolvedValueOnce(select()).mockResolvedValueOnce(dto('SELECT_SCOPE', {
      sourceBinding: nextSource, scopeState: 'MULTIPLE', authorizedScopes: [scopeA, scopeB],
      carriedContext: { criticalReading: 'Lectura actual B.', truthClass: 'CONFIRMED_REPRESENTATION' },
    }));
    mocks.write.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      ...success, sourceBinding: nextSource, organizationScopeId: 'org-b',
    });
    const view = mount();
    fireEvent.click(await screen.findByRole('radio', { name: scopeA.name }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await screen.findByText(/No pudimos confirmar el resultado/);
    view.rerender(<PortfolioSetupContinuityExperience sessionId={sessionId} path={nextPath}
      onReviewSource={review} onStartNewEntry={restart} />);
    expect(await screen.findByText('Lectura actual B.')).toBeInTheDocument();
    expect(screen.queryByText(/Tu situaci/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: scopeA.name })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Continuar con este contexto' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: scopeB.name }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(2));
    expect(mocks.write.mock.calls.map((call) => call[2])).toEqual(['key-1', 'key-2']);
    expect(mocks.write.mock.calls[1][1].sourceBinding.criticalHandoffId).toBe('handoff-2');
  });

  it('uses recovered GET state after a stale POST and requires a fresh key', async () => {
    const nextSource = { ...source, confirmedAt: '2026-10-12T11:00:00.000Z' };
    mocks.read.mockResolvedValueOnce(ready()).mockResolvedValueOnce(dto('READY_AUTHORIZED_SCOPE', {
      sourceBinding: nextSource, scopeState: 'ONE', authorizedScopes: [scopeA], currentScope: scopeA,
      portfolioAccess: { portfolioRead: true },
    }));
    mocks.write.mockRejectedValueOnce(new Error('stale')).mockResolvedValueOnce({ ...success, sourceBinding: nextSource });
    mocks.code.mockReturnValue('STALE_SOURCE');
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con este contexto' }));
    expect(await screen.findByText(/El contexto o el acceso cambi/)).toBeInTheDocument();
    expect(screen.getByText(scopeA.name)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con este contexto' }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(2));
    expect(mocks.write.mock.calls.map((call) => call[2])).toEqual(['key-1', 'key-2']);
  });
  it('offers the existing new Entry action for a profile conflict', async () => {
    mocks.read.mockResolvedValue(dto('PROFILE_CONFLICT'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar una lectura nueva' }));
    expect(restart).toHaveBeenCalledTimes(1);
  });
});
