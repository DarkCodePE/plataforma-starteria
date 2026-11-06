import { useEffect, useMemo, useState } from 'react';
import type {
  PortfolioBootstrapCompanyContextSource,
  PortfolioBootstrapContextField,
  PortfolioBootstrapContextPayload,
  PortfolioBootstrapContextReview,
} from '../services/portfolioBootstrapContextClient';
import { createEmptyPortfolioBootstrapContext } from '../services/portfolioBootstrapContextClient';
import type { PortfolioBootstrapContextStatus } from '../state/usePortfolioBootstrapContext';

type GuidedQuestion = { field: 'situation' | 'area' | 'stakeholder' | 'pilotExperience'; title: string; help: string };

const FIELD_LABELS: Record<GuidedQuestion['field'], string> = {
  situation: 'Situación actual',
  area: 'Área o proceso',
  stakeholder: 'Personas implicadas',
  pilotExperience: 'Experiencia previa o piloto',
};

export function guidedContextQuestion(
  context: PortfolioBootstrapContextPayload,
  state: { hasPendingCorrection?: boolean } = {},
): GuidedQuestion {
  if (state.hasPendingCorrection) {
    return { field: 'situation', title: '¿Qué quieres corregir antes de reconfirmar?', help: 'La versión confirmada seguirá vigente hasta que reconfirmes.' };
  }
  const situation = context.situation.value?.trim() ?? '';
  if (!situation) {
    return { field: 'situation', title: 'Cuéntame qué está ocurriendo', help: 'Describe lo que observas; si no lo sabes todavía, puede quedar como desconocido.' };
  }
  if (situation.length < 35) {
    return { field: 'situation', title: '¿Qué resultado concreto observas o necesitas cambiar?', help: 'No inferiremos causas ni métricas que no hayas declarado.' };
  }
  if (!context.area.value?.trim()) {
    return { field: 'area', title: '¿En qué área o proceso ocurre?', help: 'Puedes dejarlo como desconocido.' };
  }
  if (!context.stakeholder.value?.trim()) {
    return { field: 'stakeholder', title: '¿Quiénes están implicados o reciben el impacto?', help: 'Nombra sólo lo que conoces.' };
  }
  return { field: 'pilotExperience', title: '¿Ya habéis probado algo?', help: 'Una experiencia previa es opcional.' };
}

const declared = (value: string): PortfolioBootstrapContextField => value.trim()
  ? { value, provenance: 'user_declared', sourceRef: { kind: 'user_input' } }
  : { value: null, provenance: 'unknown' };

function provenanceLabel(field: PortfolioBootstrapContextField): string {
  switch (field.provenance) {
    case 'user_declared': return 'Declarado por ti';
    case 'source_extracted': return 'Extraído de una fuente';
    case 'copilot_inferred': return 'Inferencia por revisar';
    case 'copilot_suggested': return 'Sugerencia por revisar';
    default: return 'Desconocido';
  }
}

function fieldValue(field: PortfolioBootstrapContextField): string {
  return field.value ?? '';
}

export function PortfolioBootstrapContextConversation({
  review,
  status,
  error,
  onSaveDraft,
  onConfirm,
  onRetry,
  onContinue,
}: {
  review: PortfolioBootstrapContextReview | null;
  status: PortfolioBootstrapContextStatus;
  error: string | null;
  onSaveDraft: (context: PortfolioBootstrapContextPayload, sourceCompanyContext: PortfolioBootstrapCompanyContextSource | null) => Promise<unknown>;
  onConfirm: () => Promise<unknown>;
  onRetry: () => Promise<unknown>;
  onContinue: () => void;
}) {
  const persistedDraft = review?.draft ?? createEmptyPortfolioBootstrapContext();
  const [draft, setDraft] = useState<PortfolioBootstrapContextPayload>(persistedDraft);
  const [answer, setAnswer] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => setDraft(persistedDraft), [review?.id, review?.version]);
  const question = useMemo(
    () => guidedContextQuestion(draft, { hasPendingCorrection: review?.hasPendingCorrection }),
    [draft, review?.hasPendingCorrection],
  );
  const busy = status === 'saving' || status === 'confirming' || status === 'loading';
  const sourceCompany = review?.draftSourceCompanyContext ?? review?.sourceCompanyContext ?? null;

  const updateField = (field: GuidedQuestion['field'], value: string) => {
    setDraft((current) => ({ ...current, [field]: declared(value) }));
    setLocalError(null);
  };
  const run = async (operation: () => Promise<unknown>) => {
    setLocalError(null);
    try { await operation(); } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos completar la operación.');
    }
  };

  return (
    <div className="space-y-5" data-testid="portfolio-context-conversation">
      <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Contexto empresarial</p>
        <h3 className="mt-2 text-lg font-semibold text-violet-950">{question.title}</h3>
        <p className="mt-1 text-sm text-violet-900">{question.help}</p>
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Tu respuesta
          <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-950" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!answer.trim()} onClick={() => { updateField(question.field, answer); setAnswer(''); }} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Incorporar respuesta</button>
          <button type="button" onClick={() => { updateField(question.field, ''); setAnswer(''); }} className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900">No lo sé aún</button>
        </div>
      </section>

      {review?.hasPendingCorrection && review.confirmedSnapshot ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Corrección pendiente de reconfirmación</h3>
          <p className="mt-1 text-sm text-amber-900">El contexto confirmado continúa vigente hasta reconfirmar.</p>
          {review.confirmedSnapshot.situation.value ? <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-800">{review.confirmedSnapshot.situation.value}</p> : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold text-slate-950">Síntesis editable</h3><p className="text-sm text-slate-600">Revisa lo declarado y conserva como desconocido lo que falte.</p></div>
          {review?.effectiveSourceCompanyContext ? <p className="text-xs font-semibold text-slate-600">Versión {review.effectiveSourceCompanyContext.versionNumber} de Company Context</p> : null}
        </div>
        {review?.sourceOutdated ? <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Existe una versión Company más reciente. La fuente confirmada no se sustituirá sin tu revisión.</p> : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(['situation', 'area', 'stakeholder', 'pilotExperience'] as const).map((field) => (
            <div key={field}>
              <label htmlFor={`portfolio-context-${field}`} className="text-sm font-semibold text-slate-800">{FIELD_LABELS[field]}</label>
              <textarea id={`portfolio-context-${field}`} value={fieldValue(draft[field])} onChange={(event) => updateField(field, event.target.value)} rows={field === 'situation' ? 3 : 2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950" />
              <span className="mt-1 block text-xs font-medium text-slate-500">{provenanceLabel(draft[field])}</span>
            </div>
          ))}
          <label className="text-sm font-semibold text-slate-800 md:col-span-2">
            Vacíos por resolver
            <textarea value={draft.gaps.join('\n')} onChange={(event) => setDraft((current) => ({ ...current, gaps: event.target.value.split('\n').filter((value) => value.trim()) }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-950" />
          </label>
        </div>

        {(localError || error) ? (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p>{localError ?? error}</p>
            <button type="button" onClick={() => void run(onRetry)} className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold">Reintentar operación</button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void run(() => onSaveDraft(draft, sourceCompany))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Guardar síntesis</button>
          {review ? <button type="button" disabled={busy} onClick={() => void run(onConfirm)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar contexto</button> : null}
          {review?.effectiveContext ? <button type="button" onClick={onContinue} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Continuar al objetivo</button> : null}
        </div>
      </section>
    </div>
  );
}
