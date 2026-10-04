/**
 * CopilotIntentModes — "¿Qué necesitas ahora?" (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §20).
 * Tres entradas por intención; la respuesta la calcula el backend desde el estado de la iniciativa,
 * así que es la misma en cualquier canal.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { getCopilotMode, type CopilotIntentMode, type CopilotModeResponse } from '../services/adaptiveCoreService';
import api from '../../../app/services/api';

const MODES: Array<{ mode: CopilotIntentMode; label: string; hint: string }> = [
  { mode: 'orient', label: 'Orientarme', hint: 'No sé qué necesito hacer ahora.' },
  { mode: 'work_with_me', label: 'Trabajar conmigo', hint: 'Sé más o menos qué hacer; ayúdame a hacerlo bien.' },
  { mode: 'unblock', label: 'Desbloquearme', hint: 'Sé qué debería hacer, pero algo me lo impide.' },
];

export function CopilotIntentModes({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [response, setResponse] = useState<CopilotModeResponse | null>(null);
  const [loading, setLoading] = useState<CopilotIntentMode | null>(null);
  const [error, setError] = useState(false);
  const [helpSent, setHelpSent] = useState(false);

  // Desbloquearme usa el pedido de ayuda al mentor que ya existe (POST /projects/:id/help).
  const requestHelp = async (detail: string) => {
    try {
      await api.post(`/projects/${projectId}/help`, { subject: 'Necesito ayuda para destrabar la iniciativa', message: detail.slice(0, 2000) });
      setHelpSent(true);
    } catch {
      setError(true);
    }
  };

  const ask = async (mode: CopilotIntentMode) => {
    setLoading(mode);
    setError(false);
    try {
      setResponse(await getCopilotMode(projectId, mode));
    } catch {
      setError(true);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4" aria-label="Copilot de la iniciativa">
      <p className="text-sm font-semibold text-slate-900">¿Qué necesitas ahora?</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {MODES.map(({ mode, label, hint }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={response?.mode === mode}
            disabled={loading !== null}
            onClick={() => ask(mode)}
            className="rounded-xl border border-indigo-200 bg-white p-3 text-left hover:bg-indigo-50 disabled:opacity-60"
          >
            <span className="block text-sm font-semibold text-indigo-900">{label}</span>
            <span className="block text-xs text-slate-500">{hint}</span>
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">No pudimos responder ahora. Intenta de nuevo.</p> : null}
      {response ? (
        <div className="mt-3 rounded-xl bg-white p-3" data-testid="copilot-mode-response" data-mode={response.mode}>
          <p className="text-sm font-semibold text-slate-900">{response.title}</p>
          <p className="mt-1 text-sm text-slate-700">{response.answer}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {response.actions.map((action) => (
              <button
                key={action.target}
                type="button"
                onClick={() => (action.target === 'help_request' ? requestHelp(response.answer) : navigate(action.target))}
                disabled={action.target === 'help_request' && helpSent}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          {helpSent ? <p className="mt-2 text-xs text-emerald-700">Le avisamos a tu mentor.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
