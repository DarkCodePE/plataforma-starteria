import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_STRATEGIC_FRONTS } from '../../../features/portfolio-lead';
import { PortfolioLeadStrategicFrontsPage } from '../PortfolioLeadStrategicFrontsPage';

const navigateMock = vi.hoisted(() => vi.fn());
const openAdditionalFrontMock = vi.hoisted(() => vi.fn());
const usePortfolioLeadMock = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../features/portfolio-lead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-lead')>();
  return { ...actual, usePortfolioLead: () => usePortfolioLeadMock() };
});

vi.mock('../../../features/portfolio-lead/bootstrap/services/portfolioBootstrapClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-lead/bootstrap/services/portfolioBootstrapClient')>();
  return { ...actual, openAdditionalPortfolioFrontSetup: (...args: unknown[]) => openAdditionalFrontMock(...args) };
});

function portfolioLeadContext() {
  return {
    strategicFronts: DEFAULT_STRATEGIC_FRONTS,
    createStrategicFront: vi.fn(),
    updateStrategicFront: vi.fn(),
    updateStrategicFrontStatus: vi.fn(),
  };
}

describe('KAN-311 contextual Strategic Front creation', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    openAdditionalFrontMock.mockReset();
    usePortfolioLeadMock.mockReturnValue(portfolioLeadContext());
  });

  it('separates guided contextual creation from the existing manual drawer', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/portfolio/frentes-estrategicos']}><PortfolioLeadStrategicFrontsPage /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Crear frente estrategico' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear un frente estratégico' });
    expect(dialog).toHaveTextContent('Guiarme desde mi necesidad');
    expect(dialog).toHaveTextContent('Crear manualmente');

    await user.click(screen.getByRole('button', { name: 'Crear manualmente' }));
    expect(screen.getByRole('heading', { name: 'Crear frente estratégico' })).toBeInTheDocument();
    expect(openAdditionalFrontMock).not.toHaveBeenCalled();
  });

  it('traps focus, closes with Escape and restores focus to the creation trigger', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/portfolio/frentes-estrategicos']}><PortfolioLeadStrategicFrontsPage /></MemoryRouter>);

    const trigger = screen.getByRole('button', { name: 'Crear frente estrategico' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Crear un frente estratégico' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Crear un frente estratégico' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('opens a fresh contextual session and never mixes it with the existing front', async () => {
    const user = userEvent.setup();
    openAdditionalFrontMock.mockResolvedValue({ bootstrapSession: { id: 'bootstrap-new-front' } });
    render(<MemoryRouter initialEntries={['/portfolio/frentes-estrategicos']}><PortfolioLeadStrategicFrontsPage /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Crear frente estrategico' }));
    await user.click(screen.getByRole('button', { name: 'Guiarme desde mi necesidad' }));

    await waitFor(() => expect(openAdditionalFrontMock).toHaveBeenCalledWith(expect.stringMatching(/^portfolio-additional-front:/)));
    expect(navigateMock).toHaveBeenCalledWith('/portfolio/inicio?setup=additional-front&bootstrapSessionId=bootstrap-new-front');
    expect(screen.queryByText('Excelencia operativa')).toBeInTheDocument();
  });
});
