import { RequestHandler, Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  keyFn: (req: Request) => string,
): RequestHandler {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent unbounded memory growth
  const CLEANUP_INTERVAL = 60_000;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Escape hatch SOLO para test/e2e, opt-in explícito por env. `run-e2e.ts` ya
    // exportaba AUTH_RATE_LIMIT_DISABLED pero NADIE la leía: la variable estaba
    // muerta y el limitador seguía activo, así que la suite e2e caía con 429 en
    // cuanto pasaba de ~10 logins en la ventana.
    //
    // Mismo patrón que AUTH_DISABLE_WAITLIST (auth.service.ts): NO se puede gatear
    // por NODE_ENV, porque el stack e2e corre con NODE_ENV=production. La seguridad
    // es que esta variable sencillamente no se define en el entorno productivo real.
    if (process.env.AUTH_RATE_LIMIT_DISABLED === 'true') {
      next();
      return;
    }

    const key = keyFn(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', String(retryAfter));
      next(AppError.rateLimited(retryAfter));
      return;
    }

    next();
  };
}

/**
 * Login rate limiter: 5 attempts per minute per IP.
 * On limit, emits AUTH_RATE_LIMITED via the canonical error envelope.
 */
export const loginLimiter: RequestHandler = createRateLimiter(
  60_000,
  5,
  (req) => req.ip || req.socket.remoteAddress || 'unknown',
);

// Per-email limiter: defends against IP rotation / IPv6 evasion (security review BLOCK #2).
// Must run AFTER `validate(...)` so `req.body.email` is the parsed/normalized value.
const emailKey = (prefix: string) => (req: Request): string => {
  const raw = (req.body?.email ?? '').toString().trim().toLowerCase();
  return raw ? `${prefix}:${raw}` : `${prefix}:anon:${req.ip || 'unknown'}`;
};

/**
 * Login per-email limiter: 10 attempts per 15 minutes per email.
 * Complements the IP-based loginLimiter.
 */
export const loginEmailLimiter: RequestHandler = createRateLimiter(
  15 * 60_000,
  10,
  emailKey('login'),
);

/**
 * Register per-email limiter: 5 attempts per 15 minutes per email.
 * Prevents enumeration spam and registration retry abuse.
 */
export const registerEmailLimiter: RequestHandler = createRateLimiter(
  15 * 60_000,
  5,
  emailKey('register'),
);

/**
 * Google sign-in limiter: 10 attempts per minute per IP.
 * No per-email limiter is needed for /auth/google because forging a valid ID
 * token requires Google's private signing key. IP-only is sufficient against
 * spamming the verification endpoint.
 */
export const googleLimiter: RequestHandler = createRateLimiter(
  60_000,
  10,
  (req) => req.ip || req.socket.remoteAddress || 'unknown',
);

/** Refresh limiter: caps anonymous cookie rotation attempts per trusted client IP. */
export const refreshLimiter: RequestHandler = createRateLimiter(
  15 * 60_000,
  10,
  (req) => req.ip || req.socket.remoteAddress || 'unknown',
);

/**
 * API rate limiter: 100 requests per minute per user (or IP if unauthenticated).
 * On limit, emits AUTH_RATE_LIMITED via the canonical error envelope.
 */
export const apiLimiter: RequestHandler = createRateLimiter(
  60_000,
  100,
  (req) => (req as any).user?.sub || req.ip || req.socket.remoteAddress || 'unknown',
);
