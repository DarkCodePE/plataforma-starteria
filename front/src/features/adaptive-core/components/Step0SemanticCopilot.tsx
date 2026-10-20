import React, { useEffect, useState } from 'react';
import {
  getStep0SemanticState,
  processStep0SemanticInput,
  type Step0SemanticField,
  type Step0SemanticState,
} from '../services/adaptiveCoreService';

const FIELD_LABEL: Record<Step0SemanticField, string> = {
  objective: 'Resultado esperado',
  scope: 'Alcance inicial',
  owner: 'Responsable',
  priorityHypothesis: 'Hipótesis prioritaria',
  decisionCriteria: 'Criterio de decisión',
};

function requestKey(projectId: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `step0-semantic-${projectId}-${crypto.randomUUID()}`
    : `step0-semantic-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** P7 interaction surface. It is a working conversation backed by a structured Card. */
export function Step0SemanticCopilot({ projectId, readOnly = false }: { projectId: string; readOnly?: boolean }) {
  const [state, setState] = useState<Step0SemanticState | null>(null);
  const [content, setContent] = useState('');
  const [fieldHint, setFieldHint] = useState<Step0SemanticField>('objective');
  const [sourceReference, setSourceReference] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const unknowns = state?.card.unknowns ?? [];
  const contradictions = state?.card.contradictions ?? [];

  useEffect(() => {
    let cancelled = false;
    getStep0SemanticState(projectId)
      .then(next => {
        if (!cancelled) {
          setState(next);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('No pudimos recuperar la Card de Step 0. No se modificó el estado existente.');
          setStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const submit = async () => {
    if (!content.trim() || readOnly) return;
    setStatus('saving');
    setError(null);
    try {
      const next = await processStep0SemanticInput(projectId, {
        idempotencyKey: requestKey(projectId),
        content,
        fieldHint,
        newSource: sourceReference.trim() ? { reference: sourceReference.trim() } : undefined,
      });
      setState(next);
      setContent('');
      setSourceReference('');
      setStatus('ready');
    } catch (reason: any) {
      setError(reason?.response?.data?.error?.message ?? 'El Copilot no pudo interpretar el aporte. La Card previa se conserva; puedes reintentar.');
      setStatus('error');
    }
  };

  return (
    <section aria-label="Copilot y Card viva de Step 0" className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Copilot de Step 0</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">Construimos el encuadre, no un formulario por turnos</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">La conversación propone cambios. La Card conserva el estado estructurado, su origen y lo que todavía falta.</p>
        </div>
        {state && <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">Card v{state.card.cardVersion}</span>}
      </div>

      {status === 'loading' && <p role="status" className="mt-4 text-sm text-slate-600">Recuperando contexto heredado y Card vigente…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

      {state && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div className="rounded-lg border border-white bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversación de trabajo</p>
            <label className="mt-3 block text-sm font-medium text-slate-800">
              Quiero aportar sobre
              <select aria-label="Variable de Step 0" value={fieldHint} disabled={readOnly || status === 'saving'} onChange={event => setFieldHint(event.target.value as Step0SemanticField)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm">
                {Object.entries(FIELD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-800">
              Aporte
              <textarea aria-label="Aporte al Copilot de Step 0" value={content} disabled={readOnly || status === 'saving'} onChange={event => setContent(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Describe lo que sabes; puedes decir «No sé» si falta información." />
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-800">
              Fuente opcional
              <input aria-label="Nueva fuente de Step 0" value={sourceReference} disabled={readOnly || status === 'saving'} onChange={event => setSourceReference(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="Ej.: entrevista con responsable de ventas" />
            </label>
            {!readOnly && <button type="button" disabled={!content.trim() || status === 'saving'} onClick={() => void submit()} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{status === 'saving' ? 'Interpretando…' : 'Proponer actualización de Card'}</button>}
            <p className="mt-3 text-xs text-slate-500">Una fuente queda registrada como fuente; no se valida automáticamente como evidencia.</p>
          </div>

          <aside aria-label="Card viva de Step 0" className="rounded-lg border border-indigo-100 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Card viva</p>
            <dl className="mt-3 space-y-3 text-sm">
              {Object.entries(FIELD_LABEL).map(([field, label]) => {
                const value = state.card.fields[field as Step0SemanticField];
                return <div key={field}><dt className="font-medium text-slate-700">{label}</dt><dd className="mt-0.5 text-slate-600">{value ? value.value : unknowns.some(item => item.field === field) ? 'Desconocido' : 'Pendiente'}</dd></div>;
              })}
            </dl>
            {contradictions.length > 0 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">Hay contradicciones abiertas: se conserva la historia y se requiere revisión.</p>}
            <p className="mt-3 text-xs text-slate-600">{state.card.sufficiency.reason}</p>
            {state.card.checkpoint.state === 'ready_for_human_confirmation' && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">Lista para revisión humana. Confirmar el checkpoint sigue siendo una acción humana separada.</p>}
          </aside>
        </div>
      )}
    </section>
  );
}
