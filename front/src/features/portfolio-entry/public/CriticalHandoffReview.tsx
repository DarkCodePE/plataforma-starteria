import { useEffect } from 'react';
import { ArrowRight, Check, PencilLine } from 'lucide-react';
import { Badge } from '../../../app/components/ui/badge';
import { Button } from '../../../app/components/ui/button';
import { Textarea } from '../../../app/components/ui/textarea';
import type { PortfolioEntryCriticalHandoffDto } from './types';

export type CriticalHandoffReviewState = 'loading' | 'current' | 'stale' | 'conflict' | 'absent' | 'error';

type CriticalHandoffReviewProps = {
  state: CriticalHandoffReviewState;
  artifact?: PortfolioEntryCriticalHandoffDto;
  correctionOpen: boolean;
  correctionDraft: string;
  pending: boolean;
  canContinue: boolean;
  canConfirm: boolean;
  onCorrectionDraftChange: (value: string) => void;
  onBeginCorrection: () => void;
  onCancelCorrection: () => void;
  onSubmitCorrection: () => void;
  onContinue: () => void;
  onConfirm: () => void;
  onRetry: () => void;
};

function ReviewAction({
  canContinue,
  canConfirm,
  pending,
  onBeginCorrection,
  onContinue,
  onConfirm,
}: Pick<CriticalHandoffReviewProps, 'canContinue' | 'canConfirm' | 'pending' | 'onBeginCorrection' | 'onContinue' | 'onConfirm'>) {
  return (
    <section className="flex min-w-0 flex-col gap-3 border-t border-border-default pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Acciones sobre la lectura" data-testid="critical-handoff-review-actions">
      <Button type="button" variant="outline" onClick={onBeginCorrection} disabled={pending}>
        <PencilLine size={16} />
        Esto no refleja suficientemente mi situación
      </Button>
      {canConfirm ? (
        <Button type="button" onClick={onConfirm} disabled={pending} data-testid="critical-handoff-confirm-button">
          {pending ? 'Confirmando lectura…' : 'Confirmar esta lectura'} <Check size={16} />
        </Button>
      ) : canContinue ? (
        <Button type="button" onClick={onContinue} disabled={pending}>
          Iniciar sesión para confirmar esta lectura <ArrowRight size={16} />
        </Button>
      ) : (
        <p className="max-w-sm text-sm leading-6 text-text-secondary" role="status">
          Esta lectura ya está vinculada a tu cuenta.
        </p>
      )}
    </section>
  );
}

function CorrectionForm({
  correctionDraft,
  pending,
  onCorrectionDraftChange,
  onCancelCorrection,
  onSubmitCorrection,
}: Pick<CriticalHandoffReviewProps, 'correctionDraft' | 'pending' | 'onCorrectionDraftChange' | 'onCancelCorrection' | 'onSubmitCorrection'>) {
  useEffect(() => {
    document.getElementById('critical-handoff-correction-message')?.focus();
  }, []);

  return (
    <section className="mx-auto max-w-3xl min-w-0 space-y-4 rounded-ds-lg border border-border-default bg-surface-default p-4 shadow-sm sm:p-6" data-testid="critical-handoff-correction">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">Volvamos a aclarar tu situación</h1>
        <p className="text-sm leading-6 text-text-secondary">
          Cuéntanos qué parte no refleja suficientemente lo que estás viviendo. Tu mensaje vuelve al ciclo de aclaración; esta lectura no se edita directamente.
        </p>
      </div>
      <form
        className="space-y-3"
        aria-label="Aclarar la situación"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitCorrection();
        }}
      >
        <label htmlFor="critical-handoff-correction-message" className="block space-y-2 text-sm font-semibold text-text-primary">
          ¿Qué deberíamos entender mejor?
          <Textarea
            id="critical-handoff-correction-message"
            name="correctionMessage"
            value={correctionDraft}
            onChange={(event) => onCorrectionDraftChange(event.target.value)}
            rows={4}
            disabled={pending}
            aria-describedby="critical-handoff-correction-help"
            className="min-h-28 w-full resize-y bg-background-subtle text-sm font-normal leading-6"
          />
        </label>
        <p id="critical-handoff-correction-help" className="text-xs leading-5 text-text-muted">
          La corrección se añadirá como contexto nuevo y la lectura anterior dejará de estar vigente.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={pending || !correctionDraft.trim()}>
            {pending ? 'Volviendo a aclarar…' : 'Volver a aclarar'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelCorrection} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="mx-auto max-w-3xl rounded-ds-lg border border-border-default bg-surface-default p-5" role="status" aria-live="polite" aria-busy="true" data-testid="critical-handoff-loading">
      <p className="text-sm leading-6 text-text-secondary">Cargando la lectura final…</p>
    </section>
  );
}

function UnavailableState({ state, onBeginCorrection, onRetry, pending }: Pick<CriticalHandoffReviewProps, 'state' | 'onBeginCorrection' | 'onRetry' | 'pending'>) {
  const isStale = state === 'stale';
  const isConflict = state === 'conflict';
  const isError = state === 'error';
  const title = isStale
    ? 'Esta lectura ya no está vigente'
    : isConflict
      ? 'La lectura cambió antes de confirmarse'
      : isError
        ? 'No pudimos cargar la lectura'
        : 'La lectura todavía no está disponible';
  const message = isStale
    ? 'Se incorporó contexto nuevo. La lectura anterior no se muestra como actual; podemos volver al ciclo de aclaración.'
    : isConflict
      ? 'La versión revisada ya no coincide con la actual. Carga la lectura vigente y revísala antes de confirmar.'
      : isError
        ? 'Puedes intentar cargarla de nuevo o volver a aclarar tu situación.'
        : 'No hay una lectura final disponible ahora. No usaremos una recomendación anterior como sustituto.';

  return (
    <section className="mx-auto max-w-3xl min-w-0 space-y-4 rounded-ds-lg border border-status-feedback-warning-border bg-status-feedback-warning-surface p-5" role="status" aria-live="polite" aria-labelledby="critical-handoff-unavailable-title" data-testid={`critical-handoff-${state}`}>
      <div className="space-y-2">
        <h1 id="critical-handoff-unavailable-title" className="text-xl font-semibold text-status-feedback-warning-text">{title}</h1>
        <p className="text-sm leading-6 text-status-feedback-warning-text">{message}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {!isConflict ? <Button type="button" onClick={onBeginCorrection} disabled={pending}>Volver a aclarar</Button> : null}
        {isError || isConflict ? <Button type="button" variant="outline" onClick={onRetry} disabled={pending}>Intentar de nuevo</Button> : null}
      </div>
    </section>
  );
}

function CriticalHandoffContent({ artifact, ...props }: Omit<CriticalHandoffReviewProps, 'state' | 'artifact' | 'onRetry'> & { artifact: PortfolioEntryCriticalHandoffDto }) {
  const { projection } = artifact;
  const insufficient = projection.conclusionStatus === 'insufficient_basis';
  const confirmed = artifact.confirmationState === 'confirmed';

  if (props.correctionOpen && !confirmed) {
    return <CorrectionForm {...props} />;
  }

  if (artifact.state !== 'current') {
    return <UnavailableState state="stale" onBeginCorrection={props.onBeginCorrection} onRetry={() => undefined} pending={props.pending} />;
  }

  return (
    <section className="mx-auto max-w-3xl min-w-0 space-y-4" aria-labelledby="critical-handoff-review-title" data-testid="critical-handoff-review">
      <header className="space-y-3">
        <Badge variant={confirmed ? 'success' : projection.conclusionStatus === 'bounded' ? 'warning' : 'success'}>
          {confirmed ? 'Lectura confirmada' : insufficient ? 'Aún falta claridad' : projection.conclusionStatus === 'bounded' ? 'Lectura con incertidumbre' : 'Lectura final'}
        </Badge>
        <h1 id="critical-handoff-review-title" className="text-2xl font-semibold tracking-tight text-text-primary">Lo que entendimos al cerrar la exploración</h1>
        <p className="text-sm leading-6 text-text-secondary">
          {confirmed
            ? 'Esta es la lectura que confirmaste como representación suficiente de tu situación para continuar.'
            : 'Esta lectura es provisional. Al confirmarla, indicas que representa suficientemente tu situación para continuar. No significa que cada afirmación sea un hecho objetivo ni elige el camino que seguirás.'}
        </p>
      </header>

      {confirmed ? (
        <aside className="rounded-ds-md border border-status-feedback-success-border bg-status-feedback-success-surface p-4" role="status" data-testid="critical-handoff-confirmed">
          <p className="text-sm leading-6 text-status-feedback-success-text">Has confirmado que esta lectura representa suficientemente tu situación para continuar. No has validado cada afirmación como un hecho objetivo ni has elegido una ruta de Starteria.</p>
        </aside>
      ) : null}

      {projection.conclusionStatus === 'bounded' ? (
        <aside className="rounded-ds-md border border-status-feedback-warning-border bg-status-feedback-warning-surface p-4" role="status" data-testid="critical-handoff-bounded-notice">
          <p className="text-sm leading-6 text-status-feedback-warning-text">Hay incertidumbre importante que todavía podría cambiar la decisión.</p>
        </aside>
      ) : null}

      {insufficient ? (
        <section className="rounded-ds-lg border border-status-feedback-warning-border bg-status-feedback-warning-surface p-5" data-testid="critical-handoff-insufficient-basis">
          <h2 className="text-lg font-semibold text-status-feedback-warning-text">Todavía no hay base suficiente para cerrar con una conclusión</h2>
          <p className="mt-2 text-sm leading-6 text-status-feedback-warning-text">Podemos volver a aclarar tu situación. No mostraremos una lectura final hasta tener soporte suficiente.</p>
        </section>
      ) : projection.finalReading ? (
        <section className="min-w-0 rounded-ds-lg border border-border-default bg-surface-default p-5 shadow-sm sm:p-6" aria-labelledby="critical-handoff-final-reading-title" data-testid="critical-handoff-final-reading">
          <h2 id="critical-handoff-final-reading-title" className="text-base font-semibold text-text-primary">Lectura final</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-text-primary">{projection.finalReading}</p>
        </section>
      ) : null}

      {projection.decisionInView ? (
        <section className="min-w-0 rounded-ds-lg border border-border-default bg-surface-default p-5 shadow-sm sm:p-6" data-testid="critical-handoff-decision">
          <h2 className="text-base font-semibold text-text-primary">La decisión que tienes delante</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{projection.decisionInView}</p>
        </section>
      ) : null}

      {projection.usableNow.length > 0 ? (
        <section className="min-w-0 rounded-ds-lg border border-border-default bg-surface-default p-5 shadow-sm sm:p-6" data-testid="critical-handoff-usable-now">
          <h2 className="text-base font-semibold text-text-primary">Lo que ya puedes usar</h2>
          <ul className="mt-3 space-y-3">
            {projection.usableNow.map((entry, index) => (
              <li key={`${entry.item}-${index}`} className="min-w-0 break-words border-l-2 border-brand-primary/30 pl-3">
                <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{entry.item}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{entry.howItCanHelp}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {projection.decisionChangingUnknowns.length > 0 ? (
        <section className="min-w-0 rounded-ds-lg border border-border-default bg-surface-default p-5 shadow-sm sm:p-6" data-testid="critical-handoff-unknowns">
          <h2 className="text-base font-semibold text-text-primary">Qué podría cambiar la decisión</h2>
          <ul className="mt-3 space-y-3">
            {projection.decisionChangingUnknowns.map((unknown, index) => (
              <li key={`${unknown.uncertainty}-${index}`} className="min-w-0 break-words">
                <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{unknown.uncertainty}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">Esto importa porque {unknown.whyItMatters}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!insufficient && projection.firstMovement ? (
        <section className="min-w-0 rounded-ds-lg border border-brand-primary/20 bg-brand-primary/[0.035] p-5 shadow-sm sm:p-6" data-testid="critical-handoff-first-movement">
          <h2 className="text-base font-semibold text-text-primary">Un posible primer movimiento</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{projection.firstMovement.movement}</p>
          <dl className="mt-3 space-y-3 text-sm leading-6">
            <div><dt className="font-semibold text-text-primary">Por qué podría ser oportuno</dt><dd className="whitespace-pre-wrap break-words text-text-secondary">{projection.firstMovement.whyNow}</dd></div>
            <div><dt className="font-semibold text-text-primary">Qué podría ayudar a aclarar</dt><dd className="whitespace-pre-wrap break-words text-text-secondary">{projection.firstMovement.whatItMayClarify}</dd></div>
            <div><dt className="font-semibold text-text-primary">Hasta dónde llega</dt><dd className="whitespace-pre-wrap break-words text-text-secondary">{projection.firstMovement.boundary}</dd></div>
            {projection.firstMovement.existingAssetsUsed?.length ? (
              <div>
                <dt className="font-semibold text-text-primary">Activos que ya existen y pueden servir</dt>
                <dd><ul className="mt-1 list-disc space-y-1 pl-5 text-text-secondary">{projection.firstMovement.existingAssetsUsed.map((asset, index) => <li key={`${asset}-${index}`} className="whitespace-pre-wrap break-words">{asset}</li>)}</ul></dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {!confirmed && insufficient ? (
        <Button type="button" onClick={props.onBeginCorrection} disabled={props.pending}>Volver a aclarar</Button>
      ) : !confirmed ? (
        <ReviewAction
          canContinue={props.canContinue}
          canConfirm={props.canConfirm}
          pending={props.pending}
          onBeginCorrection={props.onBeginCorrection}
          onContinue={props.onContinue}
          onConfirm={props.onConfirm}
        />
      ) : null}
    </section>
  );
}

export function CriticalHandoffReview(props: CriticalHandoffReviewProps) {
  if (props.correctionOpen && props.artifact?.confirmationState !== 'confirmed') return <CorrectionForm {...props} />;
  if (props.state === 'loading') return <LoadingState />;
  if (props.state !== 'current' || !props.artifact) {
    return <UnavailableState {...props} />;
  }
  return <CriticalHandoffContent {...props} artifact={props.artifact} />;
}
