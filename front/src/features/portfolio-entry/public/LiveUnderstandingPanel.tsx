import React, { useEffect } from 'react';
import { ArrowRight, PencilLine } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';
import { Textarea } from '../../../app/components/ui/textarea';
import type { PortfolioEntryLiveUnderstanding } from './types';

export type LiveUnderstandingUiState =
  | 'hidden'
  | 'synthesizing'
  | 'supported_reading'
  | 'no_supported_insight'
  | 'insufficient_basis'
  | 'synthesis_unavailable'
  | 'correcting';

export function getLiveUnderstandingUiState({
  viewModel,
  updating = false,
  correctionOpen = false,
}: {
  viewModel?: PortfolioEntryLiveUnderstanding;
  updating?: boolean;
  correctionOpen?: boolean;
}): LiveUnderstandingUiState {
  if (updating) return 'synthesizing';
  if (correctionOpen) return 'correcting';
  if (!viewModel) return 'hidden';
  return viewModel.state;
}

type LiveUnderstandingPanelProps = {
  viewModel?: PortfolioEntryLiveUnderstanding;
  updating?: boolean;
  correctionOpen?: boolean;
  correctionDraft?: string;
  disabled?: boolean;
  onBeginCorrection: () => void;
  onCorrectionDraftChange: (value: string) => void;
  onCancelCorrection: () => void;
  onSubmitCorrection: () => void;
};

function safeUnknowns(viewModel: PortfolioEntryLiveUnderstanding) {
  return viewModel.decisionChangingUnknowns ?? [];
}

function SupportedReading({ viewModel }: { viewModel: PortfolioEntryLiveUnderstanding }) {
  return (
    <div className="space-y-4 break-words" data-testid="portfolio-entry-live-understanding-content">
      {viewModel.reading?.trim() ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{viewModel.reading}</p>
      ) : null}

      {viewModel.tensions?.length ? (
        <section className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Lo que puede estar en juego</h3>
          {viewModel.tensions.map((tension, index) => (
            <div key={index} className="space-y-1">
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{tension.statement}</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                Esto importa porque {tension.whyItMatters}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {viewModel.decision?.decisionToPrepare.trim() ? (
        <section className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-text-primary">La decisión que parece estar en juego</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">
            {viewModel.decision.decisionToPrepare}
          </p>
        </section>
      ) : null}

      {safeUnknowns(viewModel).length ? (
        <section className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Qué todavía podría cambiar esta lectura</h3>
          <div className="space-y-3">
            {safeUnknowns(viewModel).map((unknown, index) => (
              <p key={index} className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                {unknown.uncertainty} {unknown.whyItMatters}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PresentationContent({ viewModel }: { viewModel: PortfolioEntryLiveUnderstanding }) {
  if (viewModel.state === 'insufficient_basis') {
    return (
      <p className="text-sm leading-6 text-text-secondary" data-testid="portfolio-entry-live-understanding-insufficient">
        Todavía falta contexto para ofrecer una lectura útil.
      </p>
    );
  }

  if (viewModel.state === 'no_supported_insight') {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-secondary" data-testid="portfolio-entry-live-understanding-no-insight">
          Por ahora Starteria todavía no tiene suficiente base para compartir una lectura útil de la situación.
        </p>
        {safeUnknowns(viewModel).length ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">Qué todavía podría aclararse</h3>
            <div className="space-y-3">
              {safeUnknowns(viewModel).map((unknown, index) => (
                <p key={index} className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                  {unknown.uncertainty} {unknown.whyItMatters}
                </p>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (viewModel.state === 'synthesis_unavailable') {
    return (
      <p className="text-sm leading-6 text-text-secondary" data-testid="portfolio-entry-live-understanding-unavailable">
        Tu mensaje se recibió. La aclaración puede continuar.
      </p>
    );
  }

  return <SupportedReading viewModel={viewModel} />;
}

export function LiveUnderstandingPanel({
  viewModel,
  updating = false,
  correctionOpen = false,
  correctionDraft = '',
  disabled = false,
  onBeginCorrection,
  onCorrectionDraftChange,
  onCancelCorrection,
  onSubmitCorrection,
}: LiveUnderstandingPanelProps) {
  const uiState = getLiveUnderstandingUiState({ viewModel, updating, correctionOpen });

  useEffect(() => {
    if (!correctionOpen) return;
    document.getElementById('portfolio-entry-live-understanding-correction')?.focus();
  }, [correctionOpen]);

  if (uiState === 'hidden') return null;

  const correctionReference = correctionOpen && viewModel ? (
    <div
      className="rounded-ds-md border border-status-feedback-warning-border bg-status-feedback-warning-surface p-4"
      data-testid="portfolio-entry-live-understanding-correction-reference"
      aria-label="Lectura anterior en corrección"
    >
      <p className="mb-3 text-xs font-semibold text-status-feedback-warning-text">Lectura que estás corrigiendo</p>
      <PresentationContent viewModel={viewModel} />
    </div>
  ) : null;

  const canCorrect = Boolean(viewModel && viewModel.state !== 'synthesis_unavailable');
  const showResult = Boolean(viewModel) && !updating && !correctionOpen;

  return (
    <section
      className="min-w-0 rounded-ds-lg border border-brand-primary/20 bg-brand-primary/[0.035] p-4 shadow-sm sm:p-5"
      data-testid="portfolio-entry-live-understanding"
      aria-labelledby="portfolio-entry-live-understanding-title"
      aria-busy={updating}
    >
      <header className="mb-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Lectura provisional</p>
        <h2 id="portfolio-entry-live-understanding-title" className="text-base font-semibold leading-6 text-text-primary">
          Esto es lo que Starteria está entendiendo hasta ahora
        </h2>
      </header>

      {updating ? (
        <p role="status" aria-live="polite" className="mb-4 text-sm leading-6 text-text-secondary">
          Estamos actualizando esta lectura con tu mensaje.
        </p>
      ) : null}

      {showResult && viewModel ? <PresentationContent viewModel={viewModel} /> : null}
      {correctionReference}

      {correctionOpen ? (
        <form
          className="mt-4 space-y-3"
          aria-label="Corregir la lectura de Starteria"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitCorrection();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="portfolio-entry-live-understanding-correction" className="block text-sm font-semibold text-text-primary">
              Tu corrección
            </label>
            <Textarea
              id="portfolio-entry-live-understanding-correction"
              name="liveUnderstandingCorrection"
              value={correctionDraft}
              onChange={(event) => onCorrectionDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  onSubmitCorrection();
                }
              }}
              rows={3}
              className="min-h-24 resize-y bg-surface-default text-sm leading-6"
              aria-describedby="portfolio-entry-live-understanding-correction-help"
              disabled={disabled || updating}
            />
            <p id="portfolio-entry-live-understanding-correction-help" className="text-xs leading-5 text-text-muted">
              Este texto es tuyo y se usará para corregir la lectura.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={disabled || updating || !correctionDraft.trim()}>
              {updating ? 'Actualizando lectura…' : 'Enviar corrección'}
              {!updating ? <ArrowRight size={16} /> : null}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancelCorrection} disabled={disabled || updating}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-3 border-t border-border-default/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-text-muted">
            Es una lectura provisional; no es una conclusión ni una recomendación y puede cambiar con más contexto.
          </p>
          {canCorrect ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBeginCorrection}
              disabled={disabled || updating}
            >
              <PencilLine size={15} />
              Esto no refleja lo que quise decir
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
