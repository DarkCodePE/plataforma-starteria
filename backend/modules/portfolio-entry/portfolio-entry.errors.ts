import { AppError } from '../../shared/errors/AppError';
import { LiveModelExecutionError } from '../portfolio-entry-runtime/model/live-model-error';
import { PortfolioEntryRuntimeConfigurationError } from '../portfolio-entry-runtime/handoff/handoff-materializer';
import { PortfolioEntrySessionError } from '../portfolio-entry-sessions/application/portfolio-entry-session-errors';

export class PortfolioEntryApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PortfolioEntryApiError';
  }

  static missingPublicToken(): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_PUBLIC_TOKEN_REQUIRED', 'Portfolio Entry public access token is required.');
  }

  static briefResolution(code: string): PortfolioEntryApiError {
    return new PortfolioEntryApiError(`PORTFOLIO_ENTRY_BRIEF_${code}`, 'No se pudo resolver el Brief confirmado.');
  }

  static missingIdempotencyKey(): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }

  static forbiddenOwner(): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_OWNER_FORBIDDEN', 'Portfolio Entry session belongs to another owner.');
  }

  static idempotencyConflict(): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_IDEMPOTENCY_CONFLICT', 'Idempotency-Key was reused with a different payload.');
  }

  static idempotencyInProgress(): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_IDEMPOTENCY_IN_PROGRESS', 'This Portfolio Entry operation is already in progress.');
  }

  static invalidConfirmation(message = 'Solo puedes confirmar o corregir contexto propio de esta entrada.'): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_CONFIRMATION_FIELD_INVALID', message);
  }

  static providerFailure(): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_MODEL_PROVIDER_FAILURE', 'Portfolio Entry model execution failed.');
  }

  static schemaFailure(): PortfolioEntryApiError {
    return new PortfolioEntryApiError('PORTFOLIO_ENTRY_MODEL_SCHEMA_FAILURE', 'Portfolio Entry model response could not be applied.');
  }
}

export function mapPortfolioEntryError(err: unknown): AppError | unknown {
  if (err instanceof AppError) return err;
  if (err instanceof PortfolioEntrySessionError) {
    if (err.code === 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND') {
      return AppError.notFound('Portfolio Entry session', err.code);
    }
    if (err.code === 'PORTFOLIO_ENTRY_SESSION_UNAUTHORIZED') {
      return AppError.unauthorized('No autorizado.', err.code);
    }
    if (err.code === 'PORTFOLIO_ENTRY_SESSION_EXPIRED') {
      return new AppError(410, 'La sesion de Portfolio Entry expiro.', err.code);
    }
    if (err.code === 'PORTFOLIO_ENTRY_SESSION_CONFLICT') {
      return AppError.conflict('La sesion cambio antes de aplicar la operacion.', err.code);
    }
    if (
      err.code === 'PORTFOLIO_ENTRY_SESSION_INVALID_TRANSITION' ||
      err.code === 'PORTFOLIO_ENTRY_SESSION_INVALID_OWNERSHIP_CLAIM'
    ) {
      return AppError.conflict('La operacion no es compatible con el estado actual de la sesion.', err.code);
    }
  }
  if (err instanceof PortfolioEntryApiError) {
    if (err.code === 'PORTFOLIO_ENTRY_BRIEF_NOT_FOUND' || err.code === 'PORTFOLIO_ENTRY_BRIEF_UNAUTHORIZED') return new AppError(404, 'No se pudo resolver el Brief confirmado.', 'PORTFOLIO_ENTRY_BRIEF_NOT_FOUND');
    if (err.code === 'PORTFOLIO_ENTRY_BRIEF_ABANDONED' || err.code === 'PORTFOLIO_ENTRY_BRIEF_EXPIRED') return new AppError(410, 'El Brief confirmado ya no está disponible.', err.code);
    if (err.code === 'PORTFOLIO_ENTRY_BRIEF_NOT_CONFIRMED') return AppError.conflict('El Brief no está confirmado.', err.code);
    if (err.code === 'PORTFOLIO_ENTRY_BRIEF_REVISION_MISMATCH' || err.code === 'PORTFOLIO_ENTRY_BRIEF_INVALID_HANDOFF' || err.code === 'PORTFOLIO_ENTRY_BRIEF_INVALID_CONFIRMATION') return AppError.conflict('La identidad del Brief confirmado ya no coincide.', err.code);
    if (err.code === 'PORTFOLIO_ENTRY_OWNER_FORBIDDEN') return AppError.forbidden('No autorizado.', err.code);
    if (err.code === 'PORTFOLIO_ENTRY_PUBLIC_TOKEN_REQUIRED') return AppError.unauthorized('No autorizado.', err.code);
    if (err.code === 'PORTFOLIO_ENTRY_IDEMPOTENCY_KEY_REQUIRED') return AppError.badRequest('Idempotency-Key requerido.', err.code);
    if (
      err.code === 'PORTFOLIO_ENTRY_IDEMPOTENCY_CONFLICT' ||
      err.code === 'PORTFOLIO_ENTRY_IDEMPOTENCY_IN_PROGRESS'
    ) {
      return AppError.conflict('La clave de idempotencia no puede reutilizarse para esta operacion.', err.code);
    }
    if (err.code === 'PORTFOLIO_ENTRY_CONFIRMATION_FIELD_INVALID') {
      return AppError.badRequest(err.message, err.code);
    }
    if (err.code === 'PORTFOLIO_ENTRY_MODEL_PROVIDER_FAILURE') {
      return new AppError(503, 'No pudimos procesar la respuesta de IA en este momento.', err.code);
    }
    if (err.code === 'PORTFOLIO_ENTRY_MODEL_SCHEMA_FAILURE') {
      return new AppError(502, 'La respuesta de IA no cumple el contrato esperado.', err.code);
    }
  }
  if (err instanceof LiveModelExecutionError) {
    const failureCode = err.result.error_type === 'SCHEMA_ERROR'
      ? 'PORTFOLIO_ENTRY_MODEL_SCHEMA_FAILURE'
      : 'PORTFOLIO_ENTRY_MODEL_PROVIDER_FAILURE';
    return mapPortfolioEntryError(new PortfolioEntryApiError(failureCode, 'Portfolio Entry model execution failed.'));
  }
  if (err instanceof PortfolioEntryRuntimeConfigurationError) {
    return mapPortfolioEntryError(PortfolioEntryApiError.providerFailure());
  }
  return err;
}
