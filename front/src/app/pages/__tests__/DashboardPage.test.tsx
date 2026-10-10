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
let platformRole: string | undefined;
let projects: unknown[] = [];
vi.mock('../../context/AppContext', async (importOriginal) => ({
  isSameTeamMember: (await importOriginal<typeof import('../../context/AppContext')>()).isSameTeamMember,
  useApp: () => ({
    projects,
    projectsLoading: false,
    setCurrentProject: vi.fn(),
    user: { id: 'u1', email: 'lead@test', role, platformRole },
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
    projects = [];
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

// La tabla legacy `Step` no la actualiza el flujo adaptativo: las filas quedan en BLOCKED aunque
// la iniciativa esté decidida. La tarjeta lee el meta de portafolio, como Portafolio.
const legacySteps = [1, 2, 3, 4].map(number => ({ number, name: `Step ${number}`, status: number === 1 ? 'No iniciado' : 'Bloqueado', progress: 0, modules: [] }));
const decidedInitiative = (meta: Record<string, unknown>) => ({
  id: 'p1',
  name: '[E2E-PROD] Iniciativa',
  status: 'En progreso',
  currentStep: 4,
  step0Status: 'Completado',
  steps: legacySteps,
  team: [{ id: 'm1' }, { id: 'm2' }],
  sponsorTouchpoints: [],
  lastModified: new Date().toISOString(),
  portfolioMeta: [meta],
});

describe('DashboardPage — tarjeta de una iniciativa adaptativa', () => {
  beforeEach(() => {
    role = 'portfolio_lead';
  });

  it('decidida: Cerrada al 100%, sin "módulos bloqueados"', () => {
    projects = [decidedInitiative({ status: 'closed', currentStep: 'Step 4', readyForDecision: false })];
    render(<DashboardPage />);
    expect(screen.getByText('Cerrada')).toBeInTheDocument();
    expect(screen.getByText('Decisión registrada')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText(/bloquead/i)).not.toBeInTheDocument();
    expect(screen.getByText('2 miembros')).toBeInTheDocument();
  });

  it('lista para decisión: 100% y Steps 0–4 completos', () => {
    projects = [decidedInitiative({ status: 'lista_para_decision', currentStep: 'Step 4', readyForDecision: true })];
    render(<DashboardPage />);
    expect(screen.getByText('Lista para decisión')).toBeInTheDocument();
    expect(screen.getByText('Steps 0–4 completos')).toBeInTheDocument();
    expect(screen.queryByText(/bloquead/i)).not.toBeInTheDocument();
  });

  it('en Step 2 con un bloqueo real, muestra ese bloqueo', () => {
    projects = [decidedInitiative({ status: 'en_step_2', currentStep: 'Step 2', mainBlocker: 'Falta acceso a datos' })];
    render(<DashboardPage />);
    expect(screen.getByText('Step 2 en progreso')).toBeInTheDocument();
    expect(screen.getByText('Bloqueo: Falta acceso a datos')).toBeInTheDocument();
  });
});

describe('DashboardPage — miembro reconocido por userId', () => {
  it('un participante ve la iniciativa aunque el equipo venga sin email (lista de /projects)', () => {
    role = 'owner';
    projects = [{ ...decidedInitiative({ status: 'en_step_0', currentStep: 'Step 0' }), team: [{ id: 't1', userId: 'u1', email: '', role: 'Editor', status: 'Activo' }] }];
    render(<DashboardPage />);
    expect(screen.getAllByText('[E2E-PROD] Iniciativa').length).toBeGreaterThan(0);
  });

  it('no muestra iniciativas de las que no es miembro', () => {
    role = 'owner';
    projects = [{ ...decidedInitiative({ status: 'en_step_0' }), team: [{ id: 't1', userId: 'otro', email: '', role: 'Owner', status: 'Activo' }] }];
    render(<DashboardPage />);
    expect(screen.queryByText('[E2E-PROD] Iniciativa')).not.toBeInTheDocument();
  });
});

describe('DashboardPage — sponsor', () => {
  it('ve la iniciativa que patrocina (fila propia marcada como Sponsor por enrichProject)', () => {
    role = 'sponsor';
    projects = [{ ...decidedInitiative({ status: 'en_step_1', currentStep: 'Step 1' }), team: [{ id: 't1', userId: 'u1', email: '', role: 'Sponsor', status: 'Activo' }] }];
    render(<DashboardPage />);
    expect(screen.getAllByText('[E2E-PROD] Iniciativa').length).toBeGreaterThan(0);
  });
});

// El rol de plataforma `viewer` entra como `owner`, pero no se le ofrece crear ni importar.
// El backend hoy sí se lo permite (POST /projects 201): eso es decisión de producto.
describe('DashboardPage — rol de plataforma viewer', () => {
  beforeEach(() => {
    role = 'owner';
    projects = [];
  });

  it('el viewer no ve "Crear iniciativa" ni "Crear mi primera iniciativa" ni importar', () => {
    platformRole = 'viewer';
    render(<DashboardPage />);
    expect(screen.queryByRole('button', { name: /Crear iniciativa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Crear mi primera iniciativa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Importar iniciativa existente/ })).not.toBeInTheDocument();
    expect(screen.getByText('Todavía no te sumaron a ninguna iniciativa')).toBeInTheDocument();
    platformRole = undefined;
  });

  it('el participante sigue viendo cómo crear su primera iniciativa', () => {
    platformRole = 'participante';
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /Crear mi primera iniciativa/ })).toBeInTheDocument();
    platformRole = undefined;
  });
});
