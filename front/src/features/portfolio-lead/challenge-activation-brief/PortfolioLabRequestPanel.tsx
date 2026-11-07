import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, FlaskConical, RefreshCw } from 'lucide-react';
import { createIdempotencyKey } from '../../portfolio-entry/public/idempotency';
import type { ChallengeAssignmentTarget } from './ChallengeActivationBriefPanel';
import type { ActivationBriefVersion } from './challengeActivationBriefClient';
import {
  createPortfolioLabRequest,
  listPortfolioLabRequests,
  retryPortfolioLabNotification,
  type PortfolioLabRequest,
} from './portfolioLabRequestClient';

const CALENDLY_URL = 'https://calendly.com/fabio-merino-97/new-meeting?month=2026-11';
const TERMINAL_STATUSES = new Set(['CLOSED', 'NOT_PROCEEDING', 'CANCELLED']);
const CONSENT_PURPOSE = 'Solicito apoyo para convertir este Brief confirmado en una activación viable.';

type Props = {
  target: ChallengeAssignmentTarget;
  version: ActivationBriefVersion;
  onCompleteSetup?: () => Promise<void>;
};

function isOpen(item: PortfolioLabRequest): boolean { return !TERMINAL_STATUSES.has(item.status); }
function errorMessage(value: unknown, fallback: string): string {
  const message = (value as { message?: unknown })?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
function values(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(values);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap(values);
}
function upsert(items: PortfolioLabRequest[], next: PortfolioLabRequest): PortfolioLabRequest[] {
  return [next, ...items.filter((item) => item.id !== next.id)];
}

export function PortfolioLabRequestPanel({ target, version, onCompleteSetup }: Props) {
  const [requests, setRequests] = useState<PortfolioLabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const createKey = useRef(createIdempotencyKey(`portfolio-lab:create:${target.challengeId}:${target.briefVersionId}`));
  const retryKeys = useRef(new Map<string, string>());
  const requestTrigger = useRef<HTMLButtonElement>(null);
  const previewRegion = useRef<HTMLElement>(null);
  const noticeRegion = useRef<HTMLParagraphElement>(null);
  const completionTrigger = useRef<HTMLButtonElement>(null);
  const completionConfirmation = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listPortfolioLabRequests()
      .then((items) => { if (active) setRequests(items); })
      .catch((value) => { if (active) setLoadError(errorMessage(value, 'No pudimos recuperar el seguimiento de Startería Lab.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openRequests = useMemo(() => requests.filter(isOpen), [requests]);
  const activeForBrief = useMemo(() => openRequests.find((item) => item.challengeId === target.challengeId && item.briefVersionId === target.briefVersionId), [openRequests, target.briefVersionId, target.challengeId]);
  const requestsForBrief = useMemo(() => requests.filter((item) => item.challengeId === target.challengeId && item.briefVersionId === target.briefVersionId), [requests, target.briefVersionId, target.challengeId]);
  const otherRequestCount = requests.length - requestsForBrief.length;
  const limitReached = openRequests.length >= 3;
  const gaps = values(version.knownGaps);
  const constraints = values(version.constraintsSnapshot);
  const canCompleteWithLab = activeForBrief?.notificationStatus === 'NOTIFIED' && isOpen(activeForBrief);

  useEffect(() => { if (expanded) previewRegion.current?.focus(); }, [expanded]);
  useEffect(() => { if (notice) noticeRegion.current?.focus(); }, [notice]);
  useEffect(() => { if (confirmingCompletion) completionConfirmation.current?.focus(); }, [confirmingCompletion]);

  const closePreview = () => {
    setExpanded(false);
    window.setTimeout(() => requestTrigger.current?.focus(), 0);
  };

  const cancelCompletion = () => {
    setConfirmingCompletion(false);
    window.setTimeout(() => completionTrigger.current?.focus(), 0);
  };

  const submit = async () => {
    if (!consent || activeForBrief || limitReached) return;
    setSubmitting(true); setError(null); setNotice(null);
    try {
      const result = await createPortfolioLabRequest({
        challengeId: target.challengeId,
        briefId: target.briefId,
        briefVersionId: target.briefVersionId,
        consentAccepted: true,
        consentPurpose: CONSENT_PURPOSE,
      }, createKey.current);
      setRequests((current) => upsert(current, result.request));
      setNotice(result.deduplicated ? 'Solicitud activa recuperada sin duplicarla' : result.idempotent ? 'Solicitud recuperada sin duplicarla' : 'Solicitud creada y guardada');
      setExpanded(false);
    } catch (value) {
      setError(errorMessage(value, 'No pudimos enviar la solicitud a Startería Lab.'));
    } finally { setSubmitting(false); }
  };

  const retryNotification = async (item: PortfolioLabRequest) => {
    let key = retryKeys.current.get(item.id);
    if (!key) {
      key = createIdempotencyKey(`portfolio-lab:notification-retry:${item.id}`);
      retryKeys.current.set(item.id, key);
    }
    setRetryingId(item.id); setError(null); setNotice(null);
    try {
      const result = await retryPortfolioLabNotification(item.id, key);
      setRequests((current) => upsert(current, result.request));
      retryKeys.current.delete(item.id);
      setNotice(result.request.notificationStatus === 'NOTIFIED' ? 'Notificación aceptada por el servidor' : 'El reintento quedó registrado; la notificación sigue pendiente.');
    } catch (value) {
      setError(errorMessage(value, 'No pudimos reintentar la notificación. La solicitud sigue guardada.'));
    } finally { setRetryingId(null); }
  };

  const completeWithLab = async () => {
    if (!onCompleteSetup || !canCompleteWithLab || completing) return;
    setCompleting(true);
    setCompletionError(null);
    try {
      await onCompleteSetup();
    } catch (value) {
      setCompletionError(errorMessage(value, 'No pudimos finalizar la configuración.'));
      setCompleting(false);
    }
  };

  return <article data-testid="portfolio-lab-request-panel" className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-5 shadow-sm md:p-6" aria-labelledby="portfolio-lab-title">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-800"><FlaskConical size={16} />Dos vías compatibles</p>
        <h2 id="portfolio-lab-title" className="mt-1 text-2xl font-semibold text-slate-950">Activa este reto con tu equipo, Startería Lab o ambos</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">Puedes seguir preparando responsables en PL-06 y, además, solicitar acompañamiento de Startería Lab sobre esta versión confirmada.</p>
      </div>
      <p className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-cyan-950 shadow-sm" aria-live="polite">{loading ? 'Recuperando solicitudes…' : `Tus solicitudes abiertas: ${openRequests.length}`}</p>
    </div>
    {!loading ? <p className="mt-2 text-xs text-slate-600">El máximo es 3 por organización. El servidor confirma el cupo organizacional al enviar.</p> : null}

    {activeForBrief ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-950">Ya existe una solicitud activa para esta versión confirmada.</p> : null}
    {limitReached && !activeForBrief ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">La organización alcanzó el máximo de 3 solicitudes abiertas. Cierra una con el equipo de Lab antes de crear otra.</p> : null}
    {loadError ? <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{loadError} PL-06 sigue disponible.</p> : null}

    <button ref={requestTrigger} type="button" aria-expanded={expanded} aria-controls="portfolio-lab-request-preview" disabled={loading || Boolean(loadError) || Boolean(activeForBrief) || limitReached} onClick={() => { setExpanded(true); setError(null); setNotice(null); }} className="mt-5 rounded-xl bg-cyan-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Solicitar acompañamiento de Startería Lab</button>

    {expanded ? <section ref={previewRegion} id="portfolio-lab-request-preview" tabIndex={-1} className="mt-5 rounded-xl border border-cyan-200 bg-white p-4 outline-none focus:ring-2 focus:ring-cyan-300" aria-label="Vista previa de la solicitud a Startería Lab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-950">Vista previa del Brief compartido</h3>
        <span className="text-xs font-bold text-emerald-800">Versión {version.versionNumber} · Confirmada e inmutable</span>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div><dt className="text-xs font-bold uppercase text-slate-500">Resultado esperado</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{version.intent || 'Sin resultado registrado.'}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-slate-500">Contexto de trabajo</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{version.scope || 'Sin contexto registrado.'}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-slate-500">Restricciones</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{constraints.length ? constraints.join(' · ') : 'Sin restricciones registradas.'}</dd></div>
        <div><dt className="text-xs font-bold uppercase text-slate-500">Vacíos conocidos</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{gaps.length ? gaps.join(' · ') : 'Sin vacíos registrados.'}</dd></div>
      </dl>
      <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-800" />
        <span><b>Consiento compartir este Brief confirmado con Startería Lab</b><span className="block text-xs text-slate-600">Finalidad: {CONSENT_PURPOSE}</span></span>
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!consent || submitting} onClick={() => void submit()} className="rounded-xl bg-cyan-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Enviando solicitud…' : 'Enviar solicitud a Startería Lab'}</button>
        <button type="button" disabled={submitting} onClick={closePreview} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Cancelar</button>
      </div>
    </section> : null}

    {error ? <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950"><AlertCircle className="mt-0.5 shrink-0" size={17} /><div><p>{error}</p>{expanded && consent ? <button type="button" disabled={submitting} onClick={() => void submit()} className="mt-2 font-semibold underline">Reintentar envío de la solicitud</button> : null}</div></div> : null}
    {notice ? <p ref={noticeRegion} tabIndex={-1} role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-300"><CheckCircle2 size={17} />{notice}</p> : null}

    {requestsForBrief.length ? <section className="mt-6" aria-labelledby="portfolio-lab-tracking-title">
      <h3 id="portfolio-lab-tracking-title" className="font-semibold text-slate-950">Seguimiento de Startería Lab</h3>
      <div className="mt-3 grid gap-3">{requestsForBrief.map((item) => <LabRequestCard key={item.id} item={item} retrying={retryingId === item.id} onRetry={() => void retryNotification(item)} />)}</div>
    </section> : null}
    {otherRequestCount ? <p className="mt-4 text-xs text-slate-600">{otherRequestCount} {otherRequestCount === 1 ? 'solicitud tuya de otro Brief no se muestra' : 'solicitudes tuyas de otros Briefs no se muestran'} en este seguimiento.</p> : null}

    {canCompleteWithLab && onCompleteSetup ? <section className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4" aria-label="Finalizar configuración con Startería Lab">
      <h3 className="font-semibold text-violet-950">Startería Lab habilita el cierre de esta configuración</h3>
      <p className="mt-1 text-sm leading-6 text-violet-900">Contacto pendiente: la notificación fue aceptada por el servidor. Esto no confirma una reunión, lectura humana ni aceptación del desarrollo.</p>
      <button ref={completionTrigger} type="button" aria-expanded={confirmingCompletion} aria-controls="portfolio-lab-completion-confirmation" onClick={() => setConfirmingCompletion(true)} className="mt-3 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Finalizar configuración con Startería Lab</button>
      {confirmingCompletion ? <div ref={completionConfirmation} id="portfolio-lab-completion-confirmation" tabIndex={-1} role="group" aria-label="Confirmar finalización Lab" className="mt-3 flex flex-wrap items-center gap-2 outline-none focus:ring-2 focus:ring-violet-300">
        <button type="button" disabled={completing} onClick={() => void completeWithLab()} className="rounded-lg bg-violet-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{completing ? 'Finalizando…' : 'Sí, finalizar configuración'}</button>
        <button type="button" disabled={completing} onClick={cancelCompletion} className="rounded-lg border border-violet-300 bg-white px-3 py-2.5 text-sm font-semibold text-violet-950">Seguir aquí</button>
      </div> : null}
      {completionError ? <p role="alert" className="mt-2 text-sm text-rose-800">{completionError}</p> : null}
    </section> : null}

    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
      <p>La solicitud Lab no crea asignaciones, proyectos ni Steps. Sólo una notificación realmente aceptada habilita el checkpoint humano de cierre; PL-06 se mantiene disponible.</p>
      <a href={CALENDLY_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-cyan-900 underline"><CalendarDays size={17} />Abrir Calendly para proponer una reunión</a>
      <p className="mt-1 text-xs text-slate-500">Abrir Calendly no confirma ni registra una reunión en Startería.</p>
    </div>
  </article>;
}

function LabRequestCard({ item, retrying, onRetry }: { item: PortfolioLabRequest; retrying: boolean; onRetry: () => void }) {
  const notification = item.notificationStatus === 'NOTIFIED'
    ? { label: 'Notificación aceptada por el servidor', color: 'bg-emerald-100 text-emerald-900' }
    : item.notificationStatus === 'PENDING'
      ? { label: 'Notificación pendiente', color: 'bg-amber-100 text-amber-950' }
      : { label: 'Error al notificar', color: 'bg-rose-100 text-rose-950' };
  return <article className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-semibold text-slate-950">Solicitud registrada</p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('es-ES')}</p></div>
      <div className="flex flex-wrap gap-2"><span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-950">{requestStatus(item.status)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${notification.color}`}>{notification.label}</span></div>
    </div>
    {item.notificationStatus !== 'NOTIFIED' && isOpen(item) ? <div className="mt-3"><p className="text-xs text-slate-600">La solicitud sigue guardada aunque la notificación no haya sido aceptada.</p><button type="button" disabled={retrying} onClick={onRetry} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"><RefreshCw size={14} />{retrying ? 'Reintentando…' : 'Reintentar notificación'}</button></div> : null}
    {item.status === 'MEETING_SCHEDULED' ? <p className="mt-3 text-xs font-medium text-violet-900">Reunión registrada por el equipo de Lab. Este estado no se infiere desde Calendly.</p> : null}
  </article>;
}

function requestStatus(status: PortfolioLabRequest['status']): string {
  return ({ REQUESTED: 'Solicitada', CONTACT_PENDING: 'Contacto pendiente', MEETING_SCHEDULED: 'Reunión registrada', UNDER_REVIEW: 'En revisión', CLOSED: 'Cerrada', NOT_PROCEEDING: 'No continúa', CANCELLED: 'Cancelada' } as Record<string, string>)[status] ?? status;
}
