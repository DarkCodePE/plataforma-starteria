import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../tests/setup-jsdom';
import {
  parseApiError,
  setAccessToken,
  getAccessToken,
  initAuth,
  isPublicPath,
  rememberPostAuthDestination,
  consumePostAuthDestination,
} from '../api';

/**
 * Build a synthetic axios-shaped error with isAxiosError=true so that
 * `axios.isAxiosError(...)` recognises it (axios checks the flag).
 */
function makeAxiosError(opts: {
  response?: { status: number; data: unknown };
  message?: string;
}): AxiosError {
  const err = new Error(opts.message ?? 'AxiosError') as unknown as AxiosError;
  (err as unknown as { isAxiosError: boolean }).isAxiosError = true;
  if (opts.response) {
    (err as unknown as { response: unknown }).response = {
      status: opts.response.status,
      data: opts.response.data,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
  }
  return err;
}

describe('parseApiError', () => {
  it('returns NETWORK_ERROR when axios error has no response', () => {
    const err = makeAxiosError({});
    const parsed = parseApiError(err);
    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.message).toMatch(/conectar/i);
    expect(parsed.hint).toBeDefined();
  });

  it('extracts canonical envelope with code + message', () => {
    const err = makeAxiosError({
      response: {
        status: 400,
        data: {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña inválidos',
            field: 'email',
            hint: 'Verifica tus datos',
            requestId: 'req-1',
          },
        },
      },
    });
    const parsed = parseApiError(err);
    expect(parsed.code).toBe('INVALID_CREDENTIALS');
    expect(parsed.message).toBe('Email o contraseña inválidos');
    expect(parsed.field).toBe('email');
    expect(parsed.hint).toBe('Verifica tus datos');
    expect(parsed.requestId).toBe('req-1');
  });

  it('preserves retryAfterSeconds and details when present in envelope', () => {
    const err = makeAxiosError({
      response: {
        status: 429,
        data: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            retryAfterSeconds: 30,
            details: [{ field: 'ip', code: 'TOO_FAST', message: 'slow down' }],
          },
        },
      },
    });
    const parsed = parseApiError(err);
    expect(parsed.code).toBe('RATE_LIMITED');
    expect(parsed.retryAfterSeconds).toBe(30);
    expect(parsed.details).toHaveLength(1);
    expect(parsed.details?.[0].field).toBe('ip');
  });

  it('falls back to top-level requestId if envelope has none', () => {
    const err = makeAxiosError({
      response: {
        status: 400,
        data: {
          requestId: 'top-level-req',
          error: { code: 'X', message: 'm' },
        },
      },
    });
    const parsed = parseApiError(err);
    expect(parsed.requestId).toBe('top-level-req');
  });

  it('returns INTERNAL_ERROR for 5xx without envelope', () => {
    const err = makeAxiosError({
      response: { status: 500, data: {} },
    });
    const parsed = parseApiError(err);
    expect(parsed.code).toBe('INTERNAL_ERROR');
  });

  it('returns UNKNOWN with response message when envelope is missing', () => {
    const err = makeAxiosError({
      response: { status: 400, data: { message: 'bad input' } },
    });
    const parsed = parseApiError(err);
    expect(parsed.code).toBe('UNKNOWN');
    expect(parsed.message).toBe('bad input');
  });

  it('returns UNKNOWN generic message when no message available', () => {
    const err = makeAxiosError({
      response: { status: 418, data: {} },
    });
    const parsed = parseApiError(err);
    expect(parsed.code).toBe('UNKNOWN');
    expect(parsed.message).toMatch(/Algo salió mal/);
  });

  it('treats a plain Error (no .response) as NETWORK_ERROR', () => {
    // The current implementation falls through to the "axiosErr && !axiosErr.response"
    // branch for any truthy err without a `response`, since the unsafe cast still
    // preserves the original object. That keeps the UX consistent: anything that
    // looks like a transport failure is reported as NETWORK_ERROR.
    const parsed = parseApiError(new Error('boom'));
    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.message).toMatch(/conectar/i);
  });

  it('returns UNKNOWN for null / undefined inputs (falsy axiosErr branch)', () => {
    const parsedNull = parseApiError(null);
    expect(parsedNull.code).toBe('UNKNOWN');
    const parsedUndef = parseApiError(undefined);
    expect(parsedUndef.code).toBe('UNKNOWN');
    expect(parsedUndef.message).toMatch(/Algo salió mal/);
  });
});

describe('access token store', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it('stores and retrieves a token in memory', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('abc.def.ghi');
    expect(getAccessToken()).toBe('abc.def.ghi');
  });

  it('clears token when set to null', () => {
    setAccessToken('xx');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe('initAuth', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('stores accessToken on successful refresh', async () => {
    // Spy directly on axios.post (initAuth uses bare axios, not the api instance)
    const spy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { data: { accessToken: 'fresh-token' } },
    } as unknown as never);
    await initAuth();
    expect(getAccessToken()).toBe('fresh-token');
    spy.mockRestore();
  });

  it('leaves token null on refresh failure', async () => {
    const spy = vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('nope'));
    setAccessToken('existing');
    await initAuth();
    expect(getAccessToken()).toBeNull();
    spy.mockRestore();
  });
});

describe('KAN-204 authentication recovery', () => {
  beforeEach(() => setAccessToken(null));

  it('reuses a single boot refresh for simultaneous startup calls', async () => {
    let finish!: (value: unknown) => void;
    const pending = new Promise(resolve => { finish = resolve; });
    const spy = vi.spyOn(axios, 'post').mockReturnValueOnce(pending as never);

    const first = initAuth();
    const second = initAuth();
    expect(first).toBe(second);
    expect(spy).toHaveBeenCalledTimes(1);

    finish({ data: { data: { accessToken: 'fresh-singleflight' } } });
    await Promise.all([first, second]);
    expect(getAccessToken()).toBe('fresh-singleflight');
    spy.mockRestore();
  });

  it('never discards a login token when boot refresh fails concurrently', async () => {
    let rejectRefresh!: (error: unknown) => void;
    const pending = new Promise((_resolve, reject) => { rejectRefresh = reject; });
    const spy = vi.spyOn(axios, 'post').mockReturnValueOnce(pending as never);

    const boot = initAuth();
    setAccessToken('explicit-new-login-token');
    rejectRefresh(new Error('refresh cookie unavailable'));
    await boot;
    expect(getAccessToken()).toBe('explicit-new-login-token');
    spy.mockRestore();
  });

  it('preserves only safe project/Step destinations and consumes them once', () => {
    const stepPath = '/projects/cmvbhaq3100cdfb01n822nxtr/step/0';
    rememberPostAuthDestination(stepPath);
    expect(consumePostAuthDestination()).toBe(stepPath);
    expect(consumePostAuthDestination()).toBeNull();

    rememberPostAuthDestination('https://attacker.example/');
    expect(consumePostAuthDestination()).toBeNull();
    rememberPostAuthDestination('//attacker.example/');
    expect(consumePostAuthDestination()).toBeNull();
    rememberPostAuthDestination('/auth?next=https://attacker.example/');
    expect(consumePostAuthDestination()).toBeNull();
  });
});

// MSW import sanity: ensures the test file pulls in handlers utility without
// registering any (handlers are scoped per test elsewhere).
describe('msw handlers shape', () => {
  it('http and HttpResponse are available', () => {
    expect(typeof http.get).toBe('function');
    expect(typeof HttpResponse.json).toBe('function');
  });
});

describe('isPublicPath', () => {
  it('treats landing, auth and public flow as public', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/auth')).toBe(true);
    expect(isPublicPath('/auth/continue/draft-1')).toBe(true);
    expect(isPublicPath('/public')).toBe(true);
    expect(isPublicPath('/public/start')).toBe(true);
    expect(isPublicPath('/public/draft/d1/edit')).toBe(true);
  });

  it('treats app routes as protected', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(isPublicPath('/projects/p1')).toBe(false);
    expect(isPublicPath('/portfolio/inicio')).toBe(false);
    // Prefix must match a full segment, not a substring.
    expect(isPublicPath('/authors')).toBe(false);
    expect(isPublicPath('/publicidad')).toBe(false);
  });
});

describe('api axios instance — request/response interceptors', () => {
  beforeEach(() => {
    setAccessToken(null);
    server.resetHandlers();
  });

  it('attaches Authorization header when an access token is set', async () => {
    setAccessToken('hello-token');
    const seen: string[] = [];
    server.use(
      http.get('*/projects', ({ request }) => {
        const auth = request.headers.get('Authorization');
        if (auth) seen.push(auth);
        return HttpResponse.json({ success: true, data: [] });
      }),
    );
    // Lazy-load module to ensure default api uses the same setAccessToken
    const { default: api } = await import('../api');
    await api.get('/projects');
    expect(seen[0]).toBe('Bearer hello-token');
  });

  it('on 401 refreshes the token and replays the original request', async () => {
    let projectsCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get('*/projects', ({ request }) => {
        projectsCalls += 1;
        const auth = request.headers.get('Authorization');
        // First call has no token (or stale) -> 401
        // Second call carries the new token -> success
        if (projectsCalls === 1) {
          return HttpResponse.json(
            { success: false, error: { code: 'UNAUTHENTICATED', message: 'no token' } },
            { status: 401 },
          );
        }
        if (auth === 'Bearer rotated-token') {
          return HttpResponse.json({ success: true, data: ['ok'] });
        }
        return HttpResponse.json({ success: false }, { status: 500 });
      }),
      http.post('*/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json({ success: true, data: { accessToken: 'rotated-token' } });
      }),
    );

    const { default: api } = await import('../api');
    const res = await api.get('/projects');
    expect(refreshCalls).toBe(1);
    expect(projectsCalls).toBe(2);
    expect(res.data.data).toEqual(['ok']);
    expect(getAccessToken()).toBe('rotated-token');
  });

  it('rejects when refresh itself fails (does not loop)', async () => {
    server.use(
      http.get('*/projects', () => {
        return HttpResponse.json(
          { success: false, error: { code: 'UNAUTHENTICATED', message: 'no token' } },
          { status: 401 },
        );
      }),
      http.post('*/auth/refresh', () => {
        return HttpResponse.json({ success: false }, { status: 401 });
      }),
    );

    // Pretend we are already on /auth so the interceptor does not redirect us.
    const orig = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...orig, pathname: '/auth' },
      writable: true,
      configurable: true,
    });

    const { default: api } = await import('../api');
    await expect(api.get('/projects')).rejects.toBeDefined();
    expect(getAccessToken()).toBeNull();

    Object.defineProperty(window, 'location', {
      value: orig,
      writable: true,
      configurable: true,
    });
  });

  it('does NOT redirect to /auth when refresh fails on a public route (landing)', async () => {
    server.use(
      http.get('*/portfolio/strategic-fronts', () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHENTICATED', message: 'no token' } },
          { status: 401 },
        ),
      ),
      http.post('*/auth/refresh', () =>
        HttpResponse.json({ success: false }, { status: 401 }),
      ),
    );

    const orig = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...orig, pathname: '/', href: 'http://localhost/' },
      writable: true,
      configurable: true,
    });

    const { default: api } = await import('../api');
    await expect(api.get('/portfolio/strategic-fronts')).rejects.toBeDefined();
    expect(window.location.href).toBe('http://localhost/');

    Object.defineProperty(window, 'location', {
      value: orig,
      writable: true,
      configurable: true,
    });
  });

  it('redirects to /auth when refresh fails on a protected route', async () => {
    server.use(
      http.get('*/projects', () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHENTICATED', message: 'no token' } },
          { status: 401 },
        ),
      ),
      http.post('*/auth/refresh', () =>
        HttpResponse.json({ success: false }, { status: 401 }),
      ),
    );

    const orig = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...orig, pathname: '/dashboard', href: 'http://localhost/dashboard' },
      writable: true,
      configurable: true,
    });

    const { default: api } = await import('../api');
    await expect(api.get('/projects')).rejects.toBeDefined();
    expect(window.location.href).toBe('/auth');

    Object.defineProperty(window, 'location', {
      value: orig,
      writable: true,
      configurable: true,
    });
  });
});
