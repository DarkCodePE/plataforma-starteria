import { AppError } from '../../shared/errors/AppError';

export function assertPortfolioBootstrapSessionActive(session: { status?: string | null }): void {
  if (session.status === 'abandoned') {
    throw AppError.conflict(
      'Esta preparación fue descartada y ya no puede retomarse ni modificarse. Crea un objetivo nuevo para empezar desde cero.',
      'PORTFOLIO_BOOTSTRAP_SESSION_ABANDONED',
    );
  }
}
