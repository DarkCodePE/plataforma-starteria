import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Canonical Auth/Error envelope (v1) shared with the backend.
 * Body shape on failure: { success: false, error: AuthError }.
 */
export type AuthErrorField = 'email' | 'password' | 'name' | string;

export interface AuthErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface AuthError {
  code: string;
  message: string;
  field?: AuthErrorField;
  hint?: string;
  retryAfterSeconds?: number;
  details?: AuthErrorDetail[];
  requestId?: string;
}

export type ApiErrorBody = AuthError;

interface ApiErrorEnvelope {
  success?: false;
  error?: Partial<AuthError> & { message?: string };
  requestId?: string;
}

/**
 * Normaliza cualquier error proveniente de axios (o desconocido) a la
 * envoltura canónica `AuthError`. No lanza: siempre devuelve un objeto.
 */
export function parseApiError(err: unknown): AuthError {
  // Axios error shape — preferimos detectarlo via isAxiosError cuando esté disponible.
  const axiosErr =
    typeof (axios as unknown as { isAxiosError?: (e: unknown) => boolean }).isAxiosError ===
      'function' && (axios as unknown as { isAxiosError: (e: unknown) => boolean }).isAxiosError(err)
      ? (err as AxiosError<ApiErrorEnvelope>)
      : (err as AxiosError<ApiErrorEnvelope> | undefined);

  // 1) Sin response => problema de red / CORS / servidor caído.
  if (axiosErr && !axiosErr.response) {
    return {
      code: 'NETWORK_ERROR',
      message: 'No pudimos conectar con el servidor.',
      hint: 'Revisa tu conexión e inténtalo de nuevo.',
    };
  }

  if (axiosErr && axiosErr.response) {
    const { status, data } = axiosErr.response;
    const envelopeError = data?.error;

    // 2) Envelope canónica del backend.
    if (envelopeError && typeof envelopeError === 'object' && envelopeError.code && envelopeError.message) {
      const requestId = envelopeError.requestId ?? data?.requestId;
      return {
        code: envelopeError.code,
        message: envelopeError.message,
        ...(envelopeError.field ? { field: envelopeError.field } : {}),
        ...(envelopeError.hint ? { hint: envelopeError.hint } : {}),
        ...(typeof envelopeError.retryAfterSeconds === 'number'
          ? { retryAfterSeconds: envelopeError.retryAfterSeconds }
          : {}),
        ...(Array.isArray(envelopeError.details) ? { details: envelopeError.details } : {}),
        ...(requestId ? { requestId } : {}),
      };
    }

    // 3) 5xx sin envelope => error genérico de servidor.
    if (status === 401) {
      return {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Correo o contraseña incorrectos.',
        hint: 'Verifica tus datos. Si todavía no tienes cuenta, regístrate primero.',
      };
    }

    if (status >= 500) {
      return {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
      };
    }

    // 4) Otro error con response pero sin envelope reconocible.
    const fallbackMessage =
      (typeof (data as unknown as { message?: string })?.message === 'string'
        ? (data as unknown as { message?: string }).message!
        : null) ?? 'Algo salió mal. Vuelve a intentar.';
    return {
      code: 'UNKNOWN',
      message: fallbackMessage,
    };
  }

  // 5) No es axios error: cualquier otra cosa.
  const maybeMessage = (err as { message?: unknown })?.message;
  return {
    code: 'UNKNOWN',
    message: typeof maybeMessage === 'string' ? maybeMessage : 'Algo salió mal. Vuelve a intentar.',
  };
}

/**
 * Rutas públicas (landing, auth y flujo público anónimo, ADR-019): un 401 en
 * estas rutas NO debe expulsar al visitante hacia /auth — la página decide qué
 * mostrar sin sesión. Solo las rutas protegidas redirigen al login.
 */
const PUBLIC_PATH_PREFIXES = ['/auth', '/public'];

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

// In-memory token store (never persisted to sessionStorage)
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// A refresh token is single-use. Multiple startup callers must share one
// rotation; otherwise the second call can receive 401 and wipe a valid session.
let initAuthInFlight: Promise<void> | null = null;

export function initAuth(): Promise<void> {
  if (initAuthInFlight) return initAuthInFlight;
  const tokenAtStart = accessToken;
  const operation = (async () => {
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      // Never overwrite a successful explicit login that completed meanwhile.
      if (accessToken === tokenAtStart) accessToken = data.data.accessToken;
    } catch {
      // A missing/invalid refresh cookie still requires a new login. Do not
      // discard a newer token created by a concurrent explicit login.
      if (accessToken === tokenAtStart) accessToken = null;
    }
  })();
  initAuthInFlight = operation.finally(() => { initAuthInFlight = null; });
  return initAuthInFlight;
}

// Restore only an existing project/Step path after the user signs in again.
// Never persist tokens or allow external/attacker-controlled redirect URLs.
const POST_AUTH_DESTINATION = 'starteria.auth.returnTo';
const SAFE_PROJECT_PATH = /^\\/projects\\/c[a-z0-9]{20,30}(?:\\/step\\/[0-4])?$/i;

export function rememberPostAuthDestination(path: string): void {
  if (typeof window !== 'undefined' && SAFE_PROJECT_PATH.test(path)) {
    window.sessionStorage.setItem(POST_AUTH_DESTINATION, path);
  }
}

export function consumePostAuthDestination(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = window.sessionStorage.getItem(POST_AUTH_DESTINATION);
  window.sessionStorage.removeItem(POST_AUTH_DESTINATION);
  return stored && SAFE_PROJECT_PATH.test(stored) ? stored : null;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: handle 401 and refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken = data.data.accessToken;
        accessToken = newToken;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        accessToken = null;
        if (typeof window !== 'undefined' && !isPublicPath(window.location.pathname)) {
          rememberPostAuthDestination(window.location.pathname);
          window.location.href = '/auth';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
