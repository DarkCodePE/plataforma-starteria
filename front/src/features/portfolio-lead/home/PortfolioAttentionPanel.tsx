import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  actOnPortfolioAttention, attentionError, createPortfolioAttention, listPortfolioAttention,
  type PortfolioAttention, type PortfolioAttentionAction, type CreateAttention,
} from './portfolioAttentionClient';

type Assignee = { id: string; label: string };

const stateNames: Record<PortfolioAttention['status'], string> = {
  open: 'Abierta', acknowledged: 'Reconocida', resolved: 'Resuelta', cancelled: 'Cancelada',
};
const actionNames: Record<PortfolioAttentionAction, string> = {
  acknowledge: 'Reconocer', assign: 'Asignar responsable', respond: 'Responder',
  escalate: 'Escalar', resolve: 'Resolver', cancel: 'Cancelar', reopen: 'Reabrir',
};
const actions: PortfolioAttentionAction[] = [
  'acknowledge', 'assign', 'respond', 'escalate', 'resolve', 'cancel', 'reopen',
];
const requiresNote = (action: PortfolioAttentionAction) =>
  ['respond', 'escalate', 'resolve', 'cancel', 'reopen'].includes(action);
const requiresAssignee = (action: PortfolioAttentionAction) =>
  action === 'assign' || action === 'escalate';
const key = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID() : `g04-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateText = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-ES');
};

function AttentionCard({ item, assignees, refresh }: {
  item: PortfolioAttention; assignees: Assignee[]; refresh: () => Promise<void>;
}) {
  const closed = item.status === 'cancelled' || item.status === 'resolved';
  const available = closed ? actions.filter((a) => a === 'reopen')
    : actions.filter((a) => a !== 'reopen' && !(a === 'acknowledge' && item.status !== 'open'));
  const [action, setAction] = useState<PortfolioAttentionAction>(available[0] ?? 'respond');
  const [note, setNote] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const idemRef = useRef<string | null>(null);
  const chosen: PortfolioAttentionAction = available.includes(action) ? action : (available[0] ?? 'respond');
  const valid = chosen && (!requiresNote(chosen) || note.trim().length >= 8)
    && (!requiresAssignee(chosen) || Boolean(assigneeId));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (working || !chosen || !valid) return;
    setWorking(true); setError(null);
    const requestKey = idemRef.current ?? key();
    idemRef.current = requestKey;
    try {
      await actOnPortfolioAttention(item.projectId, item.id, {
        action: chosen, expectedVersion: item.version,
        ...(requiresAssignee(chosen) ? { assigneeId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }, requestKey);
      await refresh();
      idemRef.current = null;
      setNote('');
      setAssigneeId('');
    } catch (cause) {
      setError(`${attentionError(cause)} Actualiza la alerta si otra persona ya intervino.`);
    } finally { setWorking(false); }
  }
  return <article className="rounded-lg border border-slate-200 bg-white p-3 text-sm" data-testid="portfolio-attention-item">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-semibold text-slate-950">{item.reason}</p>
        <p className="mt-1 text-xs text-slate-600">{item.category} · severidad {item.severity} · versión {item.version}</p>
      </div>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">{stateNames[item.status]}</span>
    </div>
    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <div><dt className="font-semibold">Responsable asignado</dt><dd>{assignees.find((a) => a.id === item.ownerId)?.label ?? item.ownerId ?? 'Sin asignar'}</dd></div>
      <div><dt className="font-semibold">Siguiente acción</dt><dd>{item.nextAction}</dd></div>
      <div className="sm:col-span-2"><dt className="font-semibold">Condición para resolver</dt><dd>{item.exitCondition}</dd></div>
      {item.resolutionNote ? <div className="sm:col-span-2"><dt className="font-semibold">Resolución registrada</dt><dd>{item.resolutionNote}</dd></div> : null}
    </dl>
    <details className="mt-3 rounded-lg border border-slate-200 p-2">
      <summary className="cursor-pointer text-xs font-semibold text-violet-800">Historial · {item.events.length} eventos</summary>
      <ol className="mt-2 space-y-2 text-xs">
        {item.events.map((event) => <li key={event.id} className="rounded bg-slate-50 p-2">
          <p className="font-semibold">{event.action} · {dateText(event.createdAt)}</p>
          <p>Actor: {event.actorId} · {event.beforeStatus ?? 'Sin estado'} → {event.afterStatus}</p>
          {event.note ? <p className="mt-1 whitespace-pre-wrap">{event.note}</p> : null}
        </li>)}
      </ol>
    </details>
    <form className="mt-3 space-y-2 border-t border-slate-200 pt-3" onSubmit={(event) => void submit(event)}>
      <label className="block text-xs font-semibold">Acción de Portfolio Lead
        <select className="mt-1 w-full rounded border border-slate-300 p-2" value={chosen}
          disabled={working} onChange={(event) => { setAction(event.target.value as PortfolioAttentionAction); idemRef.current = null; }}>
          {available.map((value) => <option key={value} value={value}>{actionNames[value]}</option>)}
        </select>
      </label>
      {chosen && requiresAssignee(chosen) ? <label className="block text-xs font-semibold">Responsable verificado
        <select className="mt-1 w-full rounded border border-slate-300 p-2" value={assigneeId}
          disabled={working} onChange={(event) => { setAssigneeId(event.target.value); idemRef.current = null; }}>
          <option value="">Selecciona un responsable</option>
          {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.label}</option>)}
        </select>
      </label> : null}
      {chosen && requiresNote(chosen) ? <label className="block text-xs font-semibold">Motivo y evidencia de la acción
        <textarea className="mt-1 w-full rounded border border-slate-300 p-2" rows={2} maxLength={2000}
          value={note} disabled={working}
          onChange={(event) => { setNote(event.target.value); idemRef.current = null; }}
          placeholder="Explica la decisión y cómo se verificará" />
      </label> : null}
      {error ? <p role="alert" className="text-xs text-rose-800">{error}</p> : null}
      {requiresAssignee(chosen) && assignees.length === 0
        ? <p role="status" className="text-xs text-amber-800">No hay responsables verificados disponibles para esta acción.</p> : null}
      <button className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        type="submit" disabled={working || !valid}>
        {working ? 'Registrando…' : 'Registrar acción e historial'}
      </button>
    </form>
  </article>;
}

export function PortfolioAttentionPanel({ projectId, assignees }: {
  projectId: string; assignees: Assignee[];
}) {
  const [items, setItems] = useState<PortfolioAttention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CreateAttention>({
    category: 'bloqueo', reason: '', exitCondition: '', nextAction: '', severity: 'medium',
  });
  const createKeyRef = useRef<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listPortfolioAttention(projectId)); }
    catch (cause) { setError(attentionError(cause)); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void reload(); }, [reload]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (saving) return;
    const requestKey = createKeyRef.current ?? key();
    createKeyRef.current = requestKey;
    setSaving(true); setError(null);
    try {
      await createPortfolioAttention(projectId, draft, requestKey);
      await reload();
      createKeyRef.current = null;
      setCreating(false);
      setDraft({ category: 'bloqueo', reason: '', exitCondition: '', nextAction: '', severity: 'medium' });
    } catch (cause) { setError(attentionError(cause)); }
    finally { setSaving(false); }
  }
  const change = (field: keyof CreateAttention, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    createKeyRef.current = null;
  };
  return <section aria-label="Alertas y solicitudes de la iniciativa" className="mt-4 rounded-xl border border-violet-200 bg-violet-50/30 p-3 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold">Alertas y solicitudes</h3>
      <button type="button" className="rounded border border-violet-300 bg-white px-3 py-2 text-xs font-semibold"
        onClick={() => void reload()}>Actualizar estado</button>
    </div>
    <p className="mt-1 text-xs text-slate-600">Información persistida. Las acciones exigen permisos y quedan registradas; no activan Steps.</p>
    {loading ? <p role="status" className="mt-3 text-xs">Recuperando alertas…</p> : null}
    {error ? <p role="alert" className="mt-3 text-xs text-rose-800">{error}</p> : null}
    {!loading && items.length === 0 ? <p className="mt-3 text-xs text-slate-600">No hay alertas registradas para esta iniciativa.</p> : null}
    <div className="mt-3 grid gap-3">{items.map((item) =>
      <AttentionCard key={item.id} item={item} assignees={assignees} refresh={reload} />)}</div>
    <button type="button" className="mt-4 rounded border border-violet-300 bg-white px-3 py-2 text-xs font-semibold"
      onClick={() => setCreating((current) => !current)}>{creating ? 'Cancelar nueva alerta' : 'Registrar nueva alerta'}</button>
    {creating ? <form className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs"
      onSubmit={(event) => void create(event)}>
      <label className="font-semibold">Categoría
        <input className="mt-1 w-full rounded border border-slate-300 p-2" minLength={3} maxLength={80}
          value={draft.category} onChange={(event) => change('category', event.target.value)} required />
      </label>
      <label className="font-semibold">Qué ocurre
        <textarea className="mt-1 w-full rounded border border-slate-300 p-2" minLength={3} maxLength={2000}
          value={draft.reason} onChange={(event) => change('reason', event.target.value)} required />
      </label>
      <label className="font-semibold">Condición para resolver
        <textarea className="mt-1 w-full rounded border border-slate-300 p-2" minLength={3} maxLength={2000}
          value={draft.exitCondition} onChange={(event) => change('exitCondition', event.target.value)} required />
      </label>
      <label className="font-semibold">Siguiente acción
        <textarea className="mt-1 w-full rounded border border-slate-300 p-2" minLength={3} maxLength={2000}
          value={draft.nextAction} onChange={(event) => change('nextAction', event.target.value)} required />
      </label>
      <label className="font-semibold">Severidad
        <select className="mt-1 w-full rounded border border-slate-300 p-2" value={draft.severity}
          onChange={(event) => change('severity', event.target.value)}>
          <option value="low">Baja</option><option value="medium">Media</option>
          <option value="high">Alta</option><option value="critical">Crítica</option>
        </select>
      </label>
      <button type="submit" disabled={saving} className="rounded-lg bg-violet-700 px-3 py-2 font-semibold text-white disabled:opacity-40">
        {saving ? 'Registrando…' : 'Crear alerta con historial'}
      </button>
    </form> : null}
  </section>;
}
