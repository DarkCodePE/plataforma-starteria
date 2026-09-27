import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioContextSelector } from '../PortfolioContextSelector';
import { getPortfolioContext, selectPortfolioContext } from '../../../services/portfolioService';

vi.mock('../../../services/portfolioService', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../services/portfolioService')>()),
  getPortfolioContext: vi.fn(),
  selectPortfolioContext: vi.fn(),
}));

const context = {
  status: 'context_selection_required' as const,
  options: [
    { organizationId: 'org-a', name: 'ACME' },
    { organizationId: 'org-b', name: 'Empresa Beta' },
  ],
};

describe('PortfolioContextSelector SF-7B.3B', () => {
  it('opens with server-authorized options and selects through the API', async () => {
    vi.mocked(getPortfolioContext).mockResolvedValue(context);
    vi.mocked(selectPortfolioContext).mockResolvedValue({ status: 'available', current: context.options[1], options: context.options });
    const onSelected = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioContextSelector context={context} required onSelected={onSelected} />);

    fireEvent.click(screen.getByRole('button', { name: /seleccionar espacio/i }));
    expect(await screen.findByRole('option', { name: 'Empresa Beta' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Empresa Beta' }));

    await waitFor(() => expect(selectPortfolioContext).toHaveBeenCalledWith('org-b'));
    expect(onSelected).toHaveBeenCalledOnce();
  });

  it('does not change Home before the server selection succeeds', async () => {
    let resolveSelection: ((value: typeof context) => void) | undefined;
    vi.mocked(getPortfolioContext).mockResolvedValue(context);
    vi.mocked(selectPortfolioContext).mockImplementation(() => new Promise(resolve => { resolveSelection = resolve; }));
    const onSelected = vi.fn();
    render(<PortfolioContextSelector context={context} required onSelected={onSelected} />);

    fireEvent.click(screen.getByRole('button', { name: /seleccionar espacio/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Empresa Beta' }));
    expect(onSelected).not.toHaveBeenCalled();
    resolveSelection?.(context);
    await waitFor(() => expect(onSelected).toHaveBeenCalledOnce());
  });

  it('localizes forbidden selection failure', async () => {
    vi.mocked(getPortfolioContext).mockResolvedValue(context);
    vi.mocked(selectPortfolioContext).mockRejectedValue({ response: { status: 403 } });
    render(<PortfolioContextSelector context={context} required onSelected={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /seleccionar espacio/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Empresa Beta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya no tienes acceso a este espacio.');
  });
});
