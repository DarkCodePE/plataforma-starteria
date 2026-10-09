/**
 * DashboardPage.test.tsx — "Mis iniciativas" para el Portfolio Lead.
 *
 * El lead no es del equipo de las iniciativas que sigue (las crea el participante), así que
 * su workspace sale vacío: no debe titularse como el del sponsor ni invitarlo a crear una
 * iniciativa desde Step 0, sino llevarlo a Portafolio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));

let role = 'portfolio_lead';
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    projects: [],
    projectsLoading: false,
    setCurrentProject: vi.fn(),
    user: { id: 'u1', email: 'lead@test', role },
    getProjectMember: () => null,
    acceptSponsorInvitation: vi.fn(),
  }),
}));
vi.mock('../../portfolio/PortfolioLeadContext', () => ({
  usePortfolioLead: () => ({ challenges: [], strategicFronts: [], initiatives: [] }),
}));

describe('DashboardPage — Portfolio Lead', () => {
  beforeEach(() => {
    navigate.mockReset();
    role = 'portfolio_lead';
  });

  it('se titula "Mis iniciativas", no "Iniciativas con sponsor"', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mis iniciativas');
    expect(screen.queryByText('Iniciativas con sponsor')).not.toBeInTheDocument();
  });

  it('el vacío lo lleva a las iniciativas del portafolio, no a crear desde Step 0', () => {
    render(<DashboardPage />);
    expect(screen.getByText('No formas parte del equipo de ninguna iniciativa')).toBeInTheDocument();
    expect(screen.queryByText(/Crea tu primera iniciativa/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver iniciativas del portafolio/ }));
    expect(navigate).toHaveBeenCalledWith('/portfolio/iniciativas');
  });

  it('el sponsor conserva su título', () => {
    role = 'sponsor';
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Iniciativas con sponsor');
  });
});
