import { Button } from '../../../app/components/ui/button';
import type { StarteriaPathDto, StarteriaPathSupportedDto } from './starteriaPath.types';

export type StarteriaPathRequestState = 'loading' | 'ready' | 'missing' | 'invalid' | 'error';

type StarteriaPathExperienceProps = {
  requestState: StarteriaPathRequestState;
  errorRecovery?: 'reauthenticate' | 'retry';
  path?: StarteriaPathDto;
  onRetry: () => void;
};

function LoadingState() {
  return (
    <section
      className="mx-auto max-w-3xl min-w-0 rounded-ds-lg border border-border-default bg-surface-default p-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="starteria-path-loading"
    >
      <p className="text-sm leading-6 text-text-secondary">Cargando cómo puede ayudarte Starteria…</p>
    </section>
  );
}

function RecoveryState({
  requestState,
  errorRecovery,
  onRetry,
}: Pick<StarteriaPathExperienceProps, 'requestState' | 'errorRecovery' | 'onRetry'>) {
  const copy = requestState === 'missing'
    ? {
      title: 'No hay una lectura confirmada disponible para mostrar esta experiencia.',
      message: 'La información necesaria para continuar no está disponible ahora.',
    }
    : requestState === 'error' && errorRecovery === 'reauthenticate'
      ? {
        title: 'No pudimos verificar el acceso a esta lectura.',
        message: 'Vuelve a autenticarte para consultar esta experiencia.',
      }
    : requestState === 'invalid'
      ? {
        title: 'No pudimos validar esta lectura. Intenta cargarla de nuevo.',
        message: 'No mostraremos una experiencia basada en información que no pudimos validar.',
      }
      : {
        title: 'No pudimos cargar esta experiencia. Puedes intentarlo de nuevo.',
        message: 'La lectura sigue en esta página; vuelve a intentarlo cuando quieras.',
      };

  return (
    <section
      className="mx-auto max-w-3xl min-w-0 space-y-3 rounded-ds-lg border border-status-feedback-warning-border bg-status-feedback-warning-surface p-5"
      role="status"
      aria-live="polite"
      aria-labelledby="starteria-path-recovery-title"
      data-testid={`starteria-path-${requestState}`}
    >
      <div className="space-y-2">
        <h2 id="starteria-path-recovery-title" className="text-lg font-semibold text-status-feedback-warning-text">
          {copy.title}
        </h2>
        <p className="break-words text-sm leading-6 text-status-feedback-warning-text">{copy.message}</p>
      </div>
      {requestState === 'error' && errorRecovery === 'reauthenticate' ? null : requestState === 'missing' ? null : (
        <Button type="button" variant="outline" onClick={onRetry}>Intentar de nuevo</Button>
      )}
    </section>
  );
}

function UnavailableState({ state }: { state: Extract<StarteriaPathDto['experienceState'], 'STALE' | 'UNAVAILABLE_UNCONFIRMED' | 'UNAVAILABLE_INSUFFICIENT_BASIS' | 'UNAVAILABLE_INVALID'> }) {
  const message = state === 'UNAVAILABLE_INSUFFICIENT_BASIS'
    ? 'Todavía no hay base suficiente para mostrar cómo Starteria podría ayudarte sin inventar una recomendación.'
    : state === 'UNAVAILABLE_UNCONFIRMED'
      ? 'La lectura todavía necesita confirmación antes de continuar.'
      : state === 'STALE'
        ? 'La situación cambió desde la última lectura. Revísala antes de continuar.'
        : 'No pudimos validar esta lectura. Intenta cargarla de nuevo.';

  return (
    <section
      className="mx-auto max-w-3xl min-w-0 rounded-ds-lg border border-status-feedback-warning-border bg-status-feedback-warning-surface p-5"
      role="status"
      aria-live="polite"
      aria-labelledby="starteria-path-unavailable-title"
      data-testid={`starteria-path-${state.toLowerCase()}`}
    >
      <h2 id="starteria-path-unavailable-title" className="text-lg font-semibold text-status-feedback-warning-text">
        {message}
      </h2>
    </section>
  );
}

function ValueSection({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="min-w-0" data-testid={testId}>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <div className="mt-3 min-w-0 space-y-2 text-sm leading-6 text-text-secondary">{children}</div>
    </section>
  );
}

function SupportedPath({ path }: { path: StarteriaPathSupportedDto }) {
  const bounded = path.experienceState === 'BOUNDED';

  return (
    <section
      className="mx-auto max-w-3xl min-w-0 space-y-4"
      role="region"
      aria-labelledby="starteria-path-title"
      data-testid="starteria-path-supported"
    >
      <header className="space-y-2">
        <h2 id="starteria-path-title" aria-live="polite" className="text-2xl font-semibold tracking-tight text-text-primary">
          Así puede ayudarte Starteria
        </h2>
        {bounded ? (
          <p className="text-sm leading-6 text-status-feedback-warning-text" role="status">
            La lectura mantiene incertidumbres que podrían cambiar la decisión.
          </p>
        ) : null}
      </header>

      <div className="space-y-3 border-l-2 border-brand-primary/20 pl-3 sm:pl-4" data-testid="starteria-path-value-bridge">
        <ValueSection title="Dónde estás ahora" testId="starteria-path-current-state">
          <p className="whitespace-pre-wrap break-words text-text-primary">{path.valueBridge.currentState}</p>
        </ValueSection>

        <ValueSection title="En qué puede ayudarte Starteria" testId="starteria-path-contribution">
          <ul className="space-y-2">
            {path.valueBridge.starteriaContribution.map((item, index) => (
              <li key={`${item.statement}-${index}`} className="whitespace-pre-wrap break-words text-text-primary">
                {item.statement}
              </li>
            ))}
          </ul>
          {path.valueBridge.starteriaContribution.length > 0 ? (
            <p className="text-xs leading-5 text-text-secondary">Esta ayuda requiere implementación antes de estar disponible.</p>
          ) : null}
        </ValueSection>

        <ValueSection title="Qué podría quedar para revisar" testId="starteria-path-tangible-outcome">
          <p className="whitespace-pre-wrap break-words text-text-primary">{path.valueBridge.tangibleOutcome.statement}</p>
          <p className="whitespace-pre-wrap break-words">{path.valueBridge.tangibleOutcome.observableArtifact}</p>
          <p className="text-xs leading-5 text-text-secondary">
            Esto describe una ayuda y un artefacto que podrían quedar disponibles; no garantiza un resultado de negocio.
          </p>
        </ValueSection>

        {path.valueBridge.remainingDependency.length > 0 ? (
          <ValueSection title="Qué sigue pendiente" testId="starteria-path-remaining-dependency">
            <ul className="space-y-2">
              {path.valueBridge.remainingDependency.map((item, index) => (
                <li key={`${item.statement}-${index}`} className="whitespace-pre-wrap break-words text-text-primary">
                  {item.statement}
                </li>
              ))}
            </ul>
          </ValueSection>
        ) : null}
      </div>

      {path.capabilityPath.length > 0 ? (
        <section
          className="min-w-0 space-y-3 border-t border-border-default pt-4"
          aria-labelledby="starteria-path-capabilities-title"
          data-testid="starteria-path-capabilities"
        >
          <h3 id="starteria-path-capabilities-title" className="text-base font-semibold text-text-primary">
            En tu caso, Starteria podría ayudarte a…
          </h3>
          <ul className="space-y-4">
            {path.capabilityPath.map((node, index) => (
              <li key={`${node.statement}-${index}`} className="min-w-0 space-y-1">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{node.statement}</p>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{node.whyRelevant}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {path.dependencies.length > 0 ? (
        <ValueSection title="Dependencias que siguen abiertas" testId="starteria-path-dependencies">
          <ul className="space-y-3">
            {path.dependencies.map((dependency, index) => (
              <li key={`${dependency.statement}-${index}`} className="min-w-0 space-y-1">
                <p className="whitespace-pre-wrap break-words text-text-primary">{dependency.statement}</p>
                <p className="whitespace-pre-wrap break-words">{dependency.whyItMatters}</p>
              </li>
            ))}
          </ul>
        </ValueSection>
      ) : null}

      {path.firstSupportedMovement ? (
        <ValueSection title="Un primer movimiento posible" testId="starteria-path-first-movement">
          <p className="whitespace-pre-wrap break-words text-text-primary">{path.firstSupportedMovement.movement}</p>
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold text-text-primary">Por qué podría ser oportuno</dt>
              <dd className="whitespace-pre-wrap break-words">{path.firstSupportedMovement.whyNow}</dd>
            </div>
            <div>
              <dt className="font-semibold text-text-primary">Qué podría ayudar a aclarar</dt>
              <dd className="whitespace-pre-wrap break-words">{path.firstSupportedMovement.whatItMayClarify}</dd>
            </div>
            <div>
              <dt className="font-semibold text-text-primary">Hasta dónde llega</dt>
              <dd className="whitespace-pre-wrap break-words">{path.firstSupportedMovement.boundary}</dd>
            </div>
          </dl>
        </ValueSection>
      ) : null}

      {path.boundaryStatement.trim() ? (
        <aside className="min-w-0 border-l-2 border-status-feedback-warning-border pl-4" role="note" data-testid="starteria-path-boundary">
          <h3 className="text-sm font-semibold text-status-feedback-warning-text">El límite de esta lectura</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-status-feedback-warning-text">{path.boundaryStatement}</p>
        </aside>
      ) : null}
    </section>
  );
}

export function StarteriaPathExperience({ requestState, errorRecovery, path, onRetry }: StarteriaPathExperienceProps) {
  if (requestState === 'loading') return <LoadingState />;
  if (requestState === 'missing' || requestState === 'invalid' || requestState === 'error') {
    return <RecoveryState requestState={requestState} errorRecovery={errorRecovery} onRetry={onRetry} />;
  }
  if (!path) return <RecoveryState requestState="invalid" onRetry={onRetry} />;

  if (path.experienceState === 'SUPPORTED' || path.experienceState === 'BOUNDED') {
    return <SupportedPath path={path} />;
  }
  return <UnavailableState state={path.experienceState} />;
}
