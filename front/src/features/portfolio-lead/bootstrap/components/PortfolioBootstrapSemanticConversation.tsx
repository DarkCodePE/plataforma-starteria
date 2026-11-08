import { useEffect, useState, type ReactNode } from 'react';
import type { PortfolioBootstrapSemanticSnapshot } from '../services/portfolioBootstrapSemanticClient';
import type { PortfolioBootstrapSemanticStatus } from '../state/usePortfolioBootstrapSemantic';

export type PortfolioBootstrapSemanticConversationProps = {
  snapshot: PortfolioBootstrapSemanticSnapshot | null;
  status: PortfolioBootstrapSemanticStatus;
  error: string | null;
  pendingInputText: string | null;
  onSubmit: (inputText: string) => Promise<unknown>;
  onRetry: () => Promise<unknown>;
  children?: ReactNode;
};

function conceptLabel(conceptId: string): string {
  return conceptId.replace(/[._-]+/g, ' ');
}

function factValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'Sin valor declarado';
  try { return JSON.stringify(value); } catch { return 'Valor estructurado'; }
}

function evidenceLabel(kind: 'user_input' | 'context_review_field' | 'company_context_entry'): string {
  if (kind === 'user_input') return 'declarado por la persona';
  if (kind === 'context_review_field') return 'ContextReview confirmado';
  return 'Company Context publicado';
}

export function PortfolioBootstrapSemanticConversation({
  snapshot,
  status,
  error,
  pendingInputText,
  onSubmit,
  onRetry,
  children,
}: PortfolioBootstrapSemanticConversationProps) {
  const [inputText, setInputText] = useState(pendingInputText ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const state = snapshot?.state ?? null;
  const busy = status === 'loading' || status === 'submitting' || status === 'processing';
  const submissionBlocked = busy || status === 'error';
  const reviewConvergence = state && !state.activeQuestion && status !== 'error'
    && state.convergence.status !== 'provider_retryable_failure'
    && state.convergence.status !== 'safety_stop';

  useEffect(() => {
    if (pendingInputText !== null) setInputText(pendingInputText);
  }, [pendingInputText]);

  const submit = async () => {
    const value = inputText.trim();
    if (!value || busy) return;
    setLocalError(null);
    try {
      await onSubmit(value);
      setInputText('');
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos enviar la respuesta.');
    }
  };

  const retry = async () => {
    try {
      await onRetry();
      setLocalError(null);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos reintentar la respuesta.');
    }
  };

  return (
    <div className="space-y-5" data-testid="portfolio-semantic-conversation" aria-busy={busy}>
      <section aria-label="Historial de conversación" className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Contexto empresarial · Copilot</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Construyamos el contexto desde tu relato</h3>
          <p className="mt-1 text-sm text-slate-600">Starteria conserva la historia y pregunta sólo por la siguiente incertidumbre material.</p>
        </div>
        {snapshot?.turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            <article className="ml-auto max-w-[90%] rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
              <p>{turn.inputText}</p>
              <p className="mt-2 text-xs text-slate-300">Fuente: declarado por la persona</p>
            </article>
            {turn.emittedQuestion && turn.emittedQuestion.id !== state?.activeQuestion?.id ? (
              <article className="max-w-[92%] rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
                <p>{turn.emittedQuestion.recap}</p>
                <p className="mt-2 font-semibold">{turn.emittedQuestion.question}</p>
                <p className="mt-2 text-xs">Para qué: {turn.emittedQuestion.reasonToAsk}</p>
              </article>
            ) : null}
          </div>
        ))}
      </section>

      {state?.activeQuestion ? (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-4" aria-label="Pregunta activa">
          <p className="text-sm text-violet-950">{state.activeQuestion.recap}</p>
          <h3 className="mt-2 text-lg font-semibold text-violet-950">{state.activeQuestion.question}</h3>
          <p className="mt-2 text-sm text-violet-900"><span className="font-semibold">Para qué:</span> {state.activeQuestion.reasonToAsk}</p>
        </section>
      ) : reviewConvergence ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Convergencia semántica">
          <h3 className="font-semibold text-emerald-950">El contexto está listo para revisión humana</h3>
          <p className="mt-1 text-sm text-emerald-900">{state.convergence.reason}</p>
        </section>
      ) : null}

      {(status === 'loading' || status === 'processing' || status === 'submitting') ? (
        <p role="status" className="rounded-lg border border-violet-200 bg-white p-3 text-sm font-medium text-violet-950">
          {status === 'loading'
            ? 'Recuperando la conversación persistida…'
            : status === 'processing'
              ? 'Starteria sigue procesando el turno persistido…'
              : 'Entendiendo tu situación…'}
        </p>
      ) : null}

      <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3">
        <label className="block text-sm font-semibold text-slate-800">
          Tu respuesta
          <textarea
            value={inputText}
            maxLength={20_000}
            disabled={submissionBlocked}
            onChange={(event) => setInputText(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-950 disabled:opacity-60"
          />
        </label>
        <button type="submit" disabled={submissionBlocked || !inputText.trim()} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Enviar respuesta
        </button>
      </form>

      <section role="region" aria-label="Hechos observados" className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-950">Hechos observados</h3>
        <p className="mt-1 text-sm text-slate-600">Sólo aparecen afirmaciones con evidencia persistida.</p>
        {state?.factLedger.some((fact) => fact.status !== 'retracted') ? (
          <ul className="mt-3 space-y-3">
            {state.factLedger.filter((fact) => fact.status !== 'retracted').map((fact) => (
              <li key={`${fact.turnId}:${fact.conceptId}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{conceptLabel(fact.conceptId)}: {factValue(fact.value)}</p>
                <p className="mt-1 text-xs text-slate-600">Fuente: {fact.evidenceRefs.map((ref) => evidenceLabel(ref.kind)).join(' · ')}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-slate-600">Aún no hay hechos observados.</p>}
      </section>

      {state?.dispositions.length ? (
        <section aria-label="Desconocidos y no aplicables" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Desconocidos y no aplicables</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {state.dispositions.map((item) => (
              <li key={`${item.turnId}:${item.conceptId}`}>
                {item.disposition === 'unknown' ? 'Todavía no conocido' : 'No aplica'}: {conceptLabel(item.conceptId)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state?.hypotheses.length ? (
        <section aria-label="Hipótesis por revisar" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="font-semibold text-indigo-950">Hipótesis por revisar</h3>
          <ul className="mt-2 space-y-2 text-sm text-indigo-950">
            {state.hypotheses.map((hypothesis) => <li key={hypothesis.hypothesisId}>{hypothesis.statement}</li>)}
          </ul>
        </section>
      ) : null}

      {children}

      {(localError || error) ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>{error ?? localError}</p>
          <button type="button" onClick={() => void retry()} className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold">
            Reintentar el mismo turno
          </button>
        </div>
      ) : null}
    </div>
  );
}
