import React, { useCallback, useEffect, useRef, useState } from 'react';
import api, { parseApiError } from '../../app/services/api';

type TeamAttention = {
  id: string; reason: string; category: string; status: 'open' | 'acknowledged' | 'resolved' | 'cancelled';
  severity: 'low' | 'medium' | 'high' | 'critical'; ownerId: string | null; updatedAt: string;
  events?: Array<{ id: string; actorId: string; action: string; note: string | null; createdAt: string }>;
  resolutionNote?: string | null;
};
type Input = {
  category: string; reason: string; exitCondition: string; nextAction: string;
  severity: TeamAttention['severity'];
};
type Envelope<T> = { success: boolean; data: T };
const path = (id: string) => `/projects/${encodeURIComponent(id)}/attention-items`;
const makeKey = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `g04-team-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function InitiativeAttentionReporter({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<TeamAttention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Input>({
    category: 'bloqueo', reason: '', exitCondition: '', nextAction: '', severity: 'medium',
  });
  const keyRef = useRef<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get<Envelope<TeamAttention[]>>(path(projectId));
      setItems(data.data);
    } catch (cause) { setError(parseApiError(cause).message); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void reload(); }, [reload]);
  const update = (field: keyof Input, value: string) => {
    keyRef.current = null;
    setDraft((state) => ({ ...state, [field]: value }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return;
    const key = keyRef.current ?? makeKey();
    keyRef.current = key;
    setError(null); setSaving(true);
    try {
      await api.post(path(projectId), draft, { headers: { 'Idempotency-Key': key } });
      await reload();
      keyRef.current = null;
      setDraft({ category: 'bloqueo', reason: '', exitCondition: '', nextAction: '', severity: 'medium' });
      setFormOpen(false);
    } catch (cause) { setError(parseApiError(cause).message); }
    finally { setSaving(false); }
  };
  return <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5" aria-label="Solicitudes y bloqueos de mi iniciativa">
    <h2 className="text-base font-semibold text-amber-950">Solicitudes y bloqueos</h2>
    <p className="mt-1 text-sm text-amber-900">Comparte un bloqueo verificable. Portfolio Lead podrá responder y registrar su resolución. Enviar este aviso no cambia el estado de tus Steps.</p>
    {loading ? <p role="status" className="mt-2 text-sm">Recuperando solicitudes…</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p> : null}
    {!loading && items.length === 0 ? <p className="mt-2 text-sm text-amber-900">No hay solicitudes registradas.</p> : null}
    <ul className="mt-3 space-y-2">{items.map((item) =>
      <li key={item.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
        <p className="font-semibold text-slate-950">{item.reason}</p>
        <p className="mt-1 text-xs text-slate-600">{item.category} · {item.severity} · {item.status}</p>
        {item.resolutionNote ? <p className="mt-2 text-xs text-slate-700"><strong>Resolución:</strong> {item.resolutionNote}</p> : null}
        {item.events?.length ? <details className="mt-2 rounded-lg border border-amber-200 p-2">
          <summary className="cursor-pointer text-xs font-semibold">Ver respuestas e historial · {item.events.length} eventos</summary>
          <ol className="mt-2 space-y-1 text-xs">{item.events.map((event) => (
            <li key={event.id}>
              <span className="font-semibold">{event.action}</span> · {event.actorId}
              {event.note ? <p className="whitespace-pre-wrap">{event.note}</p> : null}
            </li>
          ))}</ol>
        </details> : null}
      </li>)}</ul>
    <button type="button" className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900"
      onClick={() => setFormOpen((open) => !open)}>{formOpen ? 'Cancelar aviso' : 'Comunicar un bloqueo'}</button>
    {formOpen ? <form onSubmit={(event) => void submit(event)} className="mt-3 grid gap-3 rounded-lg bg-white p-3 text-sm">
      <label className="font-semibold">Categoría
        <input required minLength={3} maxLength={80} className="mt-1 w-full rounded border border-slate-300 p-2"
          value={draft.category} onChange={(event) => update('category', event.target.value)} />
      </label>
      <label className="font-semibold">Qué está bloqueando el trabajo
        <textarea required minLength={3} maxLength={2000} className="mt-1 w-full rounded border border-slate-300 p-2"
          value={draft.reason} onChange={(event) => update('reason', event.target.value)} />
      </label>
      <label className="font-semibold">Qué debería ocurrir para resolverlo
        <textarea required minLength={3} maxLength={2000} className="mt-1 w-full rounded border border-slate-300 p-2"
          value={draft.exitCondition} onChange={(event) => update('exitCondition', event.target.value)} />
      </label>
      <label className="font-semibold">Acción que propones
        <textarea required minLength={3} maxLength={2000} className="mt-1 w-full rounded border border-slate-300 p-2"
          value={draft.nextAction} onChange={(event) => update('nextAction', event.target.value)} />
      </label>
      <label className="font-semibold">Prioridad del bloqueo
        <select className="mt-1 w-full rounded border border-slate-300 p-2" value={draft.severity}
          onChange={(event) => update('severity', event.target.value)}>
          <option value="low">Baja</option><option value="medium">Media</option>
          <option value="high">Alta</option><option value="critical">Crítica</option>
        </select>
      </label>
      <button type="submit" disabled={saving} className="rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {saving ? 'Registrando…' : 'Enviar bloqueo a Portfolio Lead'}
      </button>
    </form> : null}
  </section>;
}
