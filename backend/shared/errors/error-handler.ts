import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod/v3';
import { AppError } from './AppError';
import { logger } from '../utils/logger';
import {
  ApiErrorBody,
  ApiErrorDetail,
  ApiErrorEnvelope,
  ApiResponse,
} from '../types/api.types';

/**
 * Map a single Zod issue to a ValidationError detail.
 * Heuristics:
 *   email + invalid_string  → AUTH_EMAIL_INVALID
 *   password + too_small    → AUTH_PASSWORD_TOO_SHORT
 *   password + invalid_string + regex(/A-Z/) → AUTH_PASSWORD_NO_UPPER
 *   password + invalid_string + regex(/a-z/) → AUTH_PASSWORD_NO_LOWER
 *   password + invalid_string + regex(/0-9/) → AUTH_PASSWORD_NO_DIGIT
 *   name + too_small        → AUTH_NAME_TOO_SHORT
 *   name + too_big          → AUTH_NAME_TOO_LONG
 *   fallback                → VALIDATION_FIELD_INVALID
 */
function mapZodIssue(issue: ZodIssue): ApiErrorDetail {
  const field = issue.path.length ? issue.path.map(String).join('.') : '';
  const top = String(issue.path[0] ?? '');
  const code = issue.code;
  const message = issue.message;

  let detailCode = 'VALIDATION_FIELD_INVALID';

  if (top === 'email' && code === 'invalid_string') {
    detailCode = 'AUTH_EMAIL_INVALID';
  } else if (top === 'password' && code === 'too_small') {
    detailCode = 'AUTH_PASSWORD_TOO_SHORT';
  } else if (top === 'password' && code === 'invalid_string') {
    // Inspect the regex to determine which character class is missing.
    // ZodIssue for regex carries `validation: 'regex'` and the regex source
    // is not part of the issue, so we map by the human message which is
    // configured in auth.schemas.ts.
    const lowered = message.toLowerCase();
    if (lowered.includes('mayuscula')) {
      detailCode = 'AUTH_PASSWORD_NO_UPPER';
    } else if (lowered.includes('minuscula')) {
      detailCode = 'AUTH_PASSWORD_NO_LOWER';
    } else if (lowered.includes('numero')) {
      detailCode = 'AUTH_PASSWORD_NO_DIGIT';
    }
  } else if (top === 'name' && code === 'too_small') {
    detailCode = 'AUTH_NAME_TOO_SHORT';
  } else if (top === 'name' && code === 'too_big') {
    detailCode = 'AUTH_NAME_TOO_LONG';
  }

  return { field, code: detailCode, message };
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

function getRequestId(req: Request): string | undefined {
  // request-id middleware sets req.requestId; some integrations use req.id.
  const r = req as Request & { requestId?: string; id?: string };
  return r.requestId ?? r.id;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction,
): void {
  const requestId = getRequestId(req);

  if (err instanceof AppError) {
    if (err.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }

    const body: ApiErrorBody = omitUndefined({
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message,
      field: err.field,
      hint: err.hint,
      retryAfterSeconds: err.retryAfterSeconds,
      details: err.details,
      requestId,
    }) as ApiErrorBody;

    const envelope: ApiErrorEnvelope = { success: false, error: body };
    res.status(err.statusCode).json(envelope);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.errors.map(mapZodIssue);
    const body: ApiErrorBody = omitUndefined({
      code: 'VALIDATION_ERROR',
      message: 'Revisa los datos ingresados.',
      details,
      requestId,
    }) as ApiErrorBody;

    const envelope: ApiErrorEnvelope = { success: false, error: body };
    res.status(400).json(envelope);
    return;
  }

  // Non-AppError: log and emit a generic envelope. Never log password/PII bodies.
  logger.error({ err, requestId }, 'Unhandled error');

  const body: ApiErrorBody = omitUndefined({
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor.',
    requestId,
  }) as ApiErrorBody;

  const envelope: ApiErrorEnvelope = { success: false, error: body };
  res.status(500).json(envelope);
}
