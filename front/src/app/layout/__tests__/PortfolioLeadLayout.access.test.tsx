/**
 * PortfolioLeadLayout.access.test.tsx — quién puede ver la capa estratégica.
 *
 * El borde que fijaron estos tests en #156 (ADR-028) se conserva intacto: admin y
 * portfolio lead entran, los demás siguen fuera. Lo que cambió con ADR-029 es CÓMO
 * se decide — el guard pregunta por el permiso `portfolio:read`, no por el rol.
 *
 * REPARTO DE RESPONSABILIDAD: que `portfolio_lead` y `admin` TENGAN ese permiso lo
 * prueba el backend (`backend/shared/authz/__tests__/permissions.test.ts`), que es
 * donde vive la tabla de derivación. Aquí se prueba lo del frontend: dado el
 * permiso, se renderiza; sin él, se redirige. Duplicar la tabla en este archivo
 * repetiría el defecto que ADR-028 denunció.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioLeadLayout } from '../PortfolioLeadLayout';

const navigate = vi.fn();
let currentLocation = { pathname: '/portfolio/inicio', search: '' };
let scopedEntryContext: {
  data: unknown;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
} = { data: null, status: 'idle', error: null };
let scopedSetupAccess = { authorized: false, status: 'idle' as 'idle' | 'loading' | 'ready' | 'error' };
vi.mock('react-router', () => ({
  Outlet: () => <div data-testid="contenido-portafolio" />,
  useNavigate: () => navigate,
  useLocation: () => currentLocation,
}));

// Lo que el backend envía en el payload del usuario para cada rol (ADR-029).
// Es un espejo de la tabla real, sólo para armar el fixture — la tabla se prueba allí.
const PERMISOS_POR_ROL: Record<string, string[]> = {
  portfolio_lead: ['portfolio:read', 'portfolio:write'],
  admin: ['portfolio:read', 'portfolio:write', 'users:assign-roles', 'project:own'],
  owner: ['project:own'],
  mentor: ['mentor:panel'],
  sponsor: ['sponsor:decide'],
};

const sesion = (role: string) => ({ role, permissions: PERMISOS_POR_ROL[role] ?? [] });

let currentUser: { role: string; permissions: string[] } | null = sesion('portfolio_lead');
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    isAuthenticated: currentUser !== null,
    user: currentUser,
    logout: vi.fn(),
    setUserRole: vi.fn(),
  }),
}));

vi.mock('../../portfolio/PortfolioLeadContext', () => ({
  usePortfolioLead: () => ({ initiatives: [] }),
}));

vi.mock('../../../features/portfolio-entry/home/usePortfolioHomeEntryContext', () => ({
  usePortfolioHomeEntryContext: () => scopedEntryContext,
  useScopedFirstValueEntryAccess: () => scopedSetupAccess,
}));

const entra = () => screen.queryByTestId('contenido-portafolio') !== null;

describe('PortfolioLeadLayout — quién accede a /portfolio', () => {
  beforeEach(() => {
    navigate.mockReset();
    currentLocation = { pathname: '/portfolio/inicio', search: '' };
    scopedEntryContext = { data: null, status: 'idle', error: null };
    scopedSetupAccess = { authorized: false, status: 'idle' };
  });

  it('un portfolio_lead entra', () => {
    currentUser = sesion('portfolio_lead');
    render(<PortfolioLeadLayout />);
    expect(entra()).toBe(true);
  });

  it('un admin entra: el backend ya le autoriza las escrituras de portafolio', () => {
    currentUser = sesion('admin');
    render(<PortfolioLeadLayout />);
    expect(entra()).toBe(true);
    expect(navigate).not.toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it.each(['owner', 'mentor', 'sponsor'])('un %s sigue fuera, redirigido al dashboard', role => {
    currentUser = sesion(role);
    render(<PortfolioLeadLayout />);
    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('FV-02: un usuario sin portfolio:read no accede a First Value', () => {
    currentUser = sesion('owner');
    currentLocation = { pathname: '/portfolio/setup', search: '' };
    scopedSetupAccess = { authorized: false, status: 'error' };
    render(<PortfolioLeadLayout />);
    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('KAN-100: participante con continuation scoped vigente entra solo a /portfolio/setup', () => {
    currentUser = sesion('owner');
    currentLocation = { pathname: '/portfolio/setup', search: '' };
    scopedSetupAccess = { authorized: true, status: 'ready' };
    render(<PortfolioLeadLayout />);
    expect(entra()).toBe(true);
    expect(screen.getByTestId('scoped-portfolio-entry-layout')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it.each(['missing', 'stale', 'foreign', 'revoked'] as const)('KAN-100: %s scoped continuation stays denied at setup', () => {
    currentUser = sesion('owner');
    currentLocation = { pathname: '/portfolio/setup', search: '' };
    scopedSetupAccess = { authorized: false, status: 'error' };
    render(<PortfolioLeadLayout />);
    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('sin sesión va a /auth, no al dashboard', () => {
    currentUser = null;
    render(<PortfolioLeadLayout />);
    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/auth', { replace: true });
  });

  it('LAYOUT-SCOPE-02: un participante con contexto scoped autorizado entra solo al Home', () => {
    currentUser = sesion('owner');
    currentLocation = { pathname: '/portfolio/inicio', search: '?portfolioEntryContinuationId=cont-1' };
    scopedEntryContext = {
      data: { continuationId: 'cont-1', organization: { id: 'org-1', name: 'Organizacion E2E' } },
      status: 'ready',
      error: null,
    };

    render(<PortfolioLeadLayout />);

    expect(entra()).toBe(true);
    expect(screen.getByTestId('scoped-portfolio-entry-layout')).toBeInTheDocument();
    expect(screen.queryByText('Frentes estrategicos')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('LAYOUT-SCOPE-03: un participante sin continuation no entra al Portfolio', () => {
    currentUser = sesion('owner');
    render(<PortfolioLeadLayout />);

    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it.each([
    ['fake', 'error'],
    ['revoked', 'error'],
  ] as const)('LAYOUT-SCOPE-04/05: continuation %s denegada no entra', (continuationId, status) => {
    currentUser = sesion('owner');
    currentLocation = { pathname: '/portfolio/inicio', search: `?portfolioEntryContinuationId=${continuationId}` };
    scopedEntryContext = { data: null, status, error: 'No autorizado.' };

    render(<PortfolioLeadLayout />);

    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('LAYOUT-SCOPE-06: un continuation valido en otra ruta no habilita el Portfolio', () => {
    currentUser = sesion('owner');
    currentLocation = { pathname: '/portfolio/frentes-estrategicos', search: '?portfolioEntryContinuationId=cont-1' };
    scopedEntryContext = {
      data: { continuationId: 'cont-1', organization: { id: 'org-1', name: 'Organizacion E2E' } },
      status: 'ready',
      error: null,
    };

    render(<PortfolioLeadLayout />);

    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('LAYOUT-SCOPE-07: un query param sin contexto server-owned nunca habilita el acceso', () => {
    currentUser = sesion('owner');
    currentLocation = { pathname: '/portfolio/inicio', search: '?portfolioEntryContinuationId=fake' };
    scopedEntryContext = { data: null, status: 'ready', error: null };

    render(<PortfolioLeadLayout />);

    expect(entra()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
