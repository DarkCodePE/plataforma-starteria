/**
 * ChallengeSplitSuggestionPanel — el Copilot sugiere separar un Frente en espacios de intervención.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §8–§11 y §26:
 *   detectar señal → explicar por qué → mostrar beneficio → proponer estructura → mostrar impacto → pedir confirmación.
 * La sugerencia queda AI_SUGGESTED / UNREVIEWED hasta que la persona elige qué retos crear.
 */
import React, { useState } from 'react';
import {
  confirmChallengeSplit,
  suggestChallengeSplit,
  type ChallengeSplitSuggestion,
} from '../../../../app/services/portfolioService';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; suggestion: ChallengeSplitSuggestion }
  | { kind: 'confirmed'; titles: string[] };

export function ChallengeSplitSuggestionPanel({ frontId, onConfirmed }: { frontId: string; onConfirmed?: () => void }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const analyze = async () => {
    setState({ kind: 'loading' });
    try {
      const suggestion = await suggestChallengeSplit(frontId);
      setSelected(new Set(suggestion.proposedChallenges.map((challenge) => challenge.title)));
      setState({ kind: 'ready', suggestion });
    } catch {
      setState({ kind: 'error', message: 'No pudimos analizar el frente. Intenta nuevamente.' });
    }
  };

  const confirm = async (suggestion: ChallengeSplitSuggestion) => {
    const chosen = suggestion.proposedChallenges.filter((challenge) => selected.has(challenge.title));
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      const created = await confirmChallengeSplit(frontId, chosen.map(({ title, whatWeWantToMove }) => ({ title, whatWeWantToMove })));
      setState({ kind: 'confirmed', titles: created.map((challenge) => challenge.title) });
      onConfirmed?.();
    } catch {
      setState({ kind: 'error', message: 'No pudimos crear los retos. Nada se guardó.' });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (title: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  return (
    <section className="rounded-3xl border border-violet-200 bg-violet-50/50 p-5" aria-label="Espacios de intervención">
      <p className="text-xs text-violet-700" style={{ fontWeight: 700 }}>ESPACIOS DE INTERVENCIÓN</p>
      <p className="mt-1 text-sm text-slate-700">
        ¿Conviene separar este frente en retos? Starteria revisa si hay partes del resultado con problemas, owners o señales
        distintas. Nada se crea sin tu confirmación.
      </p>

      {state.kind === 'idle' || state.kind === 'error' ? (
        <>
          {state.kind === 'error' ? <p role="alert" className="mt-3 text-sm text-rose-700">{state.message}</p> : null}
          <button
            type="button"
            onClick={analyze}
            className="mt-4 rounded-2xl bg-violet-700 px-4 py-2.5 text-sm text-white hover:bg-violet-800"
            style={{ fontWeight: 700 }}
          >
            Analizar si conviene separar
          </button>
        </>
      ) : null}

      {state.kind === 'loading' ? <p role="status" className="mt-4 text-sm text-slate-500">Analizando el frente…</p> : null}

      {state.kind === 'confirmed' ? (
        <p className="mt-4 text-sm text-emerald-800">
          Creaste {state.titles.length} reto(s) en borrador: {state.titles.join(', ')}.
        </p>
      ) : null}

      {state.kind === 'ready' ? (
        <div className="mt-4 space-y-4" data-testid="challenge-split-suggestion" data-recommendation={state.suggestion.recommendation}>
          <span className="inline-flex rounded-full border border-violet-300 bg-white px-2.5 py-0.5 text-[11px] text-violet-800">
            Sugerencia de IA · sin revisar
          </span>

          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Qué observó</p>
            <p className="mt-1 text-sm text-slate-800">{state.suggestion.observed}</p>
          </div>

          {state.suggestion.recommendation === 'no_split' ? (
            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>No parece necesario crear otro reto.</p>
          ) : (
            <>
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Por qué separar</p>
                <p className="mt-1 text-sm text-slate-800">{state.suggestion.whySplit}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Qué beneficio produce</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {state.suggestion.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                </ul>
              </div>
              <fieldset>
                <legend className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Qué estructura propone</legend>
                <div className="mt-2 space-y-2">
                  {state.suggestion.proposedChallenges.map((challenge) => (
                    <label key={challenge.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(challenge.title)}
                        onChange={() => toggle(challenge.title)}
                      />
                      <span>
                        <span className="block text-sm text-slate-900" style={{ fontWeight: 600 }}>Reto sugerido: {challenge.title}</span>
                        <span className="block text-xs text-slate-500">{challenge.rationale}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {state.suggestion.impact ? (
                <div>
                  <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Impacto</p>
                  <p className="mt-1 text-sm text-slate-700">{state.suggestion.impact.note}</p>
                </div>
              ) : null}
            </>
          )}

          <p className="text-xs text-slate-500">{state.suggestion.stillInference}</p>

          {state.suggestion.recommendation === 'split' ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || selected.size === 0}
                onClick={() => confirm(state.suggestion)}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                style={{ fontWeight: 700 }}
              >
                Confirmar y crear {selected.size} reto(s)
              </button>
              <button
                type="button"
                onClick={() => setState({ kind: 'idle' })}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                style={{ fontWeight: 700 }}
              >
                Descartar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
