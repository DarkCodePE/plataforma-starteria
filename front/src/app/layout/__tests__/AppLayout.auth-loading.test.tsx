/**
 * AppLayout.auth-loading.test.tsx — KAN-65 / KAN-67.
 *
 * Abrir o recargar una ruta del workspace (`/perfil`, `/admin/roles`, `/projects/:id/step/2`)
 * mandaba al usuario a `/auth` y de ahí al dashboard. El guard preguntaba `isAuthenticated`
 * mientras la sesión todavía se restauraba, y en ese instante la respuesta es "no".
 * `PortfolioLeadLayout` ya esperaba `authLoading`; por eso `/portfolio/*` no tenía el bug.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLayout } from '../AppLayout';

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  Outlet: () => <div data-testid="contenido-workspace" />,
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/perfil' }),
}));

let auth: { authLoading: boolean; user: unknown } = { authLoading: true, user: null };
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    authLoading: auth.authLoading,
    isAuthenticated: auth.user !== null,
    user: auth.user,
    logout: vi.fn(),
    setUserRole: vi.fn(),
    projects: [],
    canAccessProject: () => true,
  }),
}));

const admin = { role: 'admin', permissions: ['users:assign-roles', 'project:own'], initials: 'OK', name: 'Admin' };

describe('AppLayout — no redirige mientras se restaura la sesión (KAN-67)', () => {
  beforeEach(() => navigate.mockReset());

  it('con la sesión cargando no navega a /auth ni pinta el workspace', () => {
    auth = { authLoading: true, user: null };
    render(<AppLayout />);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('contenido-workspace')).toBeNull();
  });

  it('con la sesión restaurada se queda en la ruta pedida', () => {
    auth = { authLoading: false, user: admin };
    render(<AppLayout />);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('contenido-workspace')).toBeTruthy();
  });

  it('sin sesión, una vez terminada la carga, sí manda a /auth', () => {
    auth = { authLoading: false, user: null };
    render(<AppLayout />);
    expect(navigate).toHaveBeenCalledWith('/auth', { replace: true });
  });
});
