/**
 * AuthPage.password.test.tsx — regresión del `minLength` del campo de contraseña.
 *
 * El input llevaba `minLength={8}` en los DOS modos. Ocho caracteres es una regla de
 * REGISTRO (`registerSchema`); el login del backend acepta cualquier longitud
 * (`loginSchema`: `password.min(1)`). Aplicarla al login hacía que el navegador
 * bloqueara el submit antes de llegar a la API, así que ninguna cuenta con contraseña
 * corta podía entrar — incluidas las cuentas demo que esta misma página ofrece como
 * atajo, con `demo123` (7 caracteres).
 *
 * El fallo era invisible desde la API: por curl el login funcionaba.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthPage } from '../AuthPage';

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    login: authMocks.login,
    register: authMocks.register,
    googleSignIn: vi.fn(),
    isAuthenticated: false,
    user: null,
    createProjectFromPublicDraft: vi.fn(),
  }),
}));

vi.mock('../../components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));

vi.mock('../../../features/public-start/services/publicPilotLeadService', () => ({
  getPendingPilotClaim: () => null,
}));

const passwordInput = () =>
  document.querySelector('input[type="password"]') as HTMLInputElement | null;

/** Cambia a registro pulsando el enlace de la propia página, sin tocar estado interno. */
function switchToRegister() {
  const link = screen.getAllByText(/reg(í|i)strate|crear cuenta/i)[0];
  fireEvent.click(link);
}

describe('AuthPage — minLength del campo de contraseña', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Se afirma sobre `minLength`, no sobre `checkValidity()`: jsdom sólo aplica la
  // restricción de longitud cuando el valor está "sucio" por edición real del usuario,
  // así que `checkValidity()` aquí devuelve true en ambos modos y no distinguiría nada.
  // `minLength` es el atributo que el navegador de verdad usa para bloquear el submit.

  it('en LOGIN no impone longitud mínima: `demo123` (7) debe poder enviarse', () => {
    render(<AuthPage />);

    const input = passwordInput();
    expect(input, 'no se encontró el campo de contraseña').toBeTruthy();
    // Atributo ausente ⇒ la propiedad DOM vale -1.
    expect(input!.minLength).toBe(-1);
    expect(input!.hasAttribute('minlength')).toBe(false);
  });

  it('en REGISTRO sí la impone: la regla de 8 caracteres se conserva', () => {
    render(<AuthPage />);
    switchToRegister();

    const input = passwordInput();
    expect(input!.minLength).toBe(8);
  });
  it('abre el flujo de registro desde el login', () => {
    render(<AuthPage />);

    switchToRegister();

    expect(screen.getByRole('heading', { name: /crea tu cuenta/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ana/i)).toBeInTheDocument();
  });

  it('oculta cuentas demo en produccion aunque exista override local persistido', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_DEMO_DATA', 'false');
    window.localStorage.setItem('starteria.demo.enabled', 'true');

    render(<AuthPage />);

    expect(screen.queryByText(/CUENTAS DEMO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/demo123/i)).not.toBeInTheDocument();
  });

  it('muestra cuentas demo solo con el flag explicito de entorno', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_DEMO_DATA', 'true');

    render(<AuthPage />);

    expect(screen.getByText(/CUENTAS DEMO/i)).toBeInTheDocument();
    expect(screen.getByText(/participante@starteria\.io/i)).toBeInTheDocument();
  });

  it('recupera una invitación pendiente tras registrar una cuenta activa sin tokens', async () => {
    window.sessionStorage.setItem('starteria.handoff.pendingInvitation', 'token-owner');
    authMocks.register.mockResolvedValue({ success: true, waitlisted: true, waitlistedEmail: 'owner@example.test' });
    authMocks.login.mockResolvedValue({ success: true });
    render(<AuthPage />);
    switchToRegister();

    fireEvent.change(screen.getByPlaceholderText(/Ana/i), { target: { value: 'Owner Nueva' } });
    fireEvent.change(screen.getByPlaceholderText('tu@empresa.com'), { target: { value: 'owner@example.test' } });
    fireEvent.change(passwordInput()!, { target: { value: 'E2eTest!1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(authMocks.login).toHaveBeenCalledWith('owner@example.test', 'E2eTest!1234'));
    expect(screen.queryByRole('heading', { name: /lista de espera/i })).not.toBeInTheDocument();
  });
});
