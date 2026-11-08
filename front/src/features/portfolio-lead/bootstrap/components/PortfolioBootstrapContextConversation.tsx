import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  PortfolioBootstrapCompanyContextSource,
  PortfolioBootstrapContextField,
  PortfolioBootstrapContextPayload,
  PortfolioBootstrapContextReview,
  PortfolioBootstrapContextProjection,
  PortfolioBootstrapContextProposal,
} from '../services/portfolioBootstrapContextClient';
import { createEmptyPortfolioBootstrapContext, getPortfolioBootstrapContextProposals } from '../services/portfolioBootstrapContextClient';
import type { PortfolioBootstrapSemanticSnapshot } from '../services/portfolioBootstrapSemanticClient';
import type { PortfolioBootstrapContextStatus } from '../state/usePortfolioBootstrapContext';
import type { PortfolioBootstrapSemanticStatus } from '../state/usePortfolioBootstrapSemantic';
import { PortfolioBootstrapSemanticConversation } from './PortfolioBootstrapSemanticConversation';

type ContextField = 'situation' | 'area' | 'stakeholder' | 'pilotExperience';
type ContextDisposition = 'unknown' | 'not_applicable';
type GuidedQuestion = { field: ContextField | null; title: string; help: string };

export type PortfolioBootstrapSemanticController = {
  snapshot: PortfolioBootstrapSemanticSnapshot | null;
  status: PortfolioBootstrapSemanticStatus;
  error: string | null;
  pendingInputText: string | null;
  submit: (inputText: string) => Promise<unknown>;
  retry: () => Promise<unknown>;
};

const FIELD_LABELS: Record<ContextField, string> = {
  situation: 'Situación actual',
  area: 'Área o proceso',
  stakeholder: 'Personas implicadas',
  pilotExperience: 'Experiencia previa o piloto',
};
const DISPOSITION_PREFIX = 'context-disposition:';
const CONTEXT_FIELDS: ContextField[] = ['situation', 'area', 'stakeholder', 'pilotExperience'];

function dispositionMarker(field: ContextField, disposition: ContextDisposition): string {
  return `${DISPOSITION_PREFIX}${field}:${disposition}`;
}

function markerForField(value: string, field: ContextField): ContextDisposition | null {
  if (value === dispositionMarker(field, 'unknown')) return 'unknown';
  if (value === dispositionMarker(field, 'not_applicable')) return 'not_applicable';
  return null;
}

function fieldDisposition(context: PortfolioBootstrapContextPayload, field: ContextField): ContextDisposition | null {
  for (const gap of context.gaps) {
    const disposition = markerForField(gap, field);
    if (disposition) return disposition;
  }
  return null;
}

function fieldResolved(context: PortfolioBootstrapContextPayload, field: ContextField): boolean {
  return Boolean(context[field].value?.trim()) || fieldDisposition(context, field) !== null;
}

function withoutFieldDisposition(gaps: string[], field: ContextField): string[] {
  return gaps.filter((gap) => markerForField(gap, field) === null);
}

function userGaps(gaps: string[]): string[] {
  return gaps.filter((gap) => !gap.startsWith(DISPOSITION_PREFIX));
}

function dispositionGaps(gaps: string[]): string[] {
  return gaps.filter((gap) => gap.startsWith(DISPOSITION_PREFIX));
}

function usesFormalOrganizationLanguage(situation: string): boolean {
  return /\b(empresa|departamento|área|proceso(?:s)? formal(?:es)?|operaciones corporativas)\b/i.test(situation);
}

function usesSmallBusinessLanguage(situation: string): boolean {
  return /\b(cafetería|cafeteria|tienda|local|microempresa|negocio pequeño|autónom[oa]|taller|restaurante)\b/i.test(situation);
}

export function guidedContextQuestion(
  context: PortfolioBootstrapContextPayload,
  state: { hasPendingCorrection?: boolean } = {},
): GuidedQuestion {
  if (state.hasPendingCorrection) {
    return {
      field: null,
      title: '¿Qué quieres corregir antes de reconfirmar?',
      help: 'Abre la síntesis, ajusta sólo lo necesario y vuelve a confirmar. La versión confirmada seguirá vigente mientras tanto.',
    };
  }
  if (!fieldResolved(context, 'situation')) {
    return {
      field: 'situation',
      title: 'Cuéntame qué está ocurriendo',
      help: 'Lo preguntamos para entender el punto de partida, sin inferir causas, métricas ni capacidades que no hayas declarado.',
    };
  }

  const situation = context.situation.value?.trim() ?? '';
  if (!fieldResolved(context, 'area')) {
    if (usesSmallBusinessLanguage(situation) && !usesFormalOrganizationLanguage(situation)) {
      return {
        field: 'area',
        title: '¿En qué parte de la actividad ocurre?',
        help: 'Lo preguntamos para entender dónde ocurre el cambio sin asumir que existe un área o departamento formal.',
      };
    }
    return {
      field: 'area',
      title: '¿En qué área o proceso ocurre?',
      help: 'Lo preguntamos para ubicar el cambio en la operación que ya has descrito; no hace falta inventar una estructura.',
    };
  }

  if (!fieldResolved(context, 'stakeholder')) {
    if (usesSmallBusinessLanguage(situation) && !usesFormalOrganizationLanguage(situation)) {
      return {
        field: 'stakeholder',
        title: '¿Quién atendería este cambio y quién compraría?',
        help: 'Lo preguntamos para distinguir quién participa y quién recibe el valor, sin asumir que ya existe un equipo.',
      };
    }
    return {
      field: 'stakeholder',
      title: '¿Quién participa y quién recibe el impacto?',
      help: 'Lo preguntamos para identificar actores reales; nombra sólo personas, clientes o funciones que conozcas.',
    };
  }

  if (!fieldResolved(context, 'pilotExperience')) {
    return {
      field: 'pilotExperience',
      title: '¿Habéis probado algo parecido?',
      help: 'Lo preguntamos para no repetir un intento anterior. Si no hubo prueba, puedes decirlo o marcar que no aplica.',
    };
  }

  return {
    field: null,
    title: 'Ya podemos revisar el contexto',
    help: 'Comprueba la síntesis y su procedencia. Los desconocidos pueden permanecer abiertos y no bloquean la revisión.',
  };
}

const declared = (value: string): PortfolioBootstrapContextField => value.trim()
  ? { value: value.trim(), provenance: 'user_declared', sourceRef: { kind: 'user_input' } }
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

function dispositionLabel(context: PortfolioBootstrapContextPayload, field: ContextField): string | null {
  const disposition = fieldDisposition(context, field);
  if (disposition === 'not_applicable') return 'No aplica en este caso';
  if (disposition === 'unknown') return 'Todavía no lo sabemos';
  return null;
}

export function PortfolioBootstrapContextConversation({
  operationScope,
  review,
  status,
  error,
  onSaveDraft,
  onConfirm,
  onRetry,
  onContinue,
  semantic,
  enableContextProjection = false,
}: {
  operationScope: string;
  review: PortfolioBootstrapContextReview | null;
  status: PortfolioBootstrapContextStatus;
  error: string | null;
  onSaveDraft: (context: PortfolioBootstrapContextPayload, sourceCompanyContext: PortfolioBootstrapCompanyContextSource | null) => Promise<unknown>;
  onConfirm: () => Promise<unknown>;
  onRetry: () => Promise<unknown>;
  onContinue: () => void;
  semantic?: PortfolioBootstrapSemanticController;
  enableContextProjection?: boolean;
}) {
  const persistedDraft = review?.draft ?? createEmptyPortfolioBootstrapContext();
  const [draft, setDraft] = useState<PortfolioBootstrapContextPayload>(persistedDraft);
  const [answer, setAnswer] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const disclosureRef = useRef<HTMLButtonElement>(null);
  const operationEpoch = useRef(0);
  const [projection, setProjection] = useState<PortfolioBootstrapContextProjection | null>(null);
  const [projectionError, setProjectionError] = useState(false);
  const [rejectedProposalId, setRejectedProposalId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(persistedDraft);
    setDirty(false);
  }, [operationScope, review?.id, review?.version]);
  useEffect(() => {
    operationEpoch.current += 1;
    setAnswer('');
    setSummaryOpen(false);
    setLocalBusy(false);
    setLocalError(null);
  }, [operationScope]);
  useEffect(() => {
    if (summaryOpen) summaryRef.current?.focus();
  }, [summaryOpen]);
  useEffect(() => {
    let active = true;
    setProjection(null);
    setProjectionError(false);
    setRejectedProposalId(null);
    if (!enableContextProjection || !review?.draft.situation.value) return () => { active = false; };
    void getPortfolioBootstrapContextProposals(operationScope).then((result) => {
      if (active) setProjection(result);
    }).catch(() => {
      if (active) setProjectionError(true);
    });
    return () => { active = false; };
  }, [operationScope, review?.id, review?.version, semantic?.snapshot?.state?.version, enableContextProjection]);

  const question = useMemo(
    () => guidedContextQuestion(draft, { hasPendingCorrection: review?.hasPendingCorrection }),
    [draft, review?.hasPendingCorrection],
  );
  const projectedPilot = projection && review && projection.reviewVersion === review.version
    ? projection.proposals.find((item) => item.targetField === 'pilotExperience') ?? null
    : null;
  const proposalToReview = projectedPilot?.id === rejectedProposalId ? null : projectedPilot;
  const awaitingPilotProjection = Boolean(enableContextProjection && review?.draft.situation.value
    && question.field === 'pilotExperience' && !projectionError && projection?.reviewVersion !== review?.version);
  const busy = localBusy || status === 'saving' || status === 'confirming' || status === 'loading';
  const sourceCompany = review?.draftSourceCompanyContext ?? review?.sourceCompanyContext ?? null;

  const replaceField = (current: PortfolioBootstrapContextPayload, field: ContextField, value: string): PortfolioBootstrapContextPayload => ({
    ...current,
    [field]: declared(value),
    gaps: withoutFieldDisposition(current.gaps, field),
  });
  const markField = (current: PortfolioBootstrapContextPayload, field: ContextField, disposition: ContextDisposition): PortfolioBootstrapContextPayload => ({
    ...current,
    [field]: { value: null, provenance: 'unknown' },
    gaps: [...withoutFieldDisposition(current.gaps, field), dispositionMarker(field, disposition)],
  });
  const updateField = (field: ContextField, value: string) => {
    setDraft((current) => replaceField(current, field, value));
    setDirty(true);
    setLocalError(null);
  };
  const updateListField = (field: 'constraints' | 'assumptions', value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value.split('\n').filter((item) => item.trim()).map(declared),
    }));
    setDirty(true);
    setLocalError(null);
  };
  const run = async (operation: () => Promise<unknown>, onSuccess?: () => void): Promise<boolean> => {
    const epoch = operationEpoch.current;
    setLocalBusy(true);
    setLocalError(null);
    try {
      await operation();
      if (epoch !== operationEpoch.current) return false;
      onSuccess?.();
      return true;
    } catch (caught) {
      if (epoch !== operationEpoch.current) return false;
      setLocalError(caught instanceof Error ? caught.message : 'No pudimos completar la operación.');
      return false;
    } finally {
      if (epoch === operationEpoch.current) setLocalBusy(false);
    }
  };
  const saveConversationTurn = async (next: PortfolioBootstrapContextPayload) => {
    await run(() => onSaveDraft(next, sourceCompany), () => {
      setDraft(next);
      setDirty(false);
      setAnswer('');
    });
  };
  const saveAnswer = async () => {
    if (!question.field || !answer.trim() || busy) return;
    await saveConversationTurn(replaceField(draft, question.field, answer));
  };
  const acceptPilotProposal = async (proposal: PortfolioBootstrapContextProposal) => {
    if (busy) return;
    const next: PortfolioBootstrapContextPayload = {
      ...draft,
      pilotExperience: {
        value: proposal.value,
        provenance: 'user_declared',
        sourceRef: proposal.sourceRef,
      },
      gaps: withoutFieldDisposition(draft.gaps, 'pilotExperience'),
    };
    // Human acceptance is explicit; this remains a draft until confirmContext.
    await saveConversationTurn(next);
  };
  const saveDisposition = async (disposition: ContextDisposition) => {
    if (!question.field || busy) return;
    await saveConversationTurn(markField(draft, question.field, disposition));
  };
  const toggleSummary = () => {
    if (summaryOpen) {
      setSummaryOpen(false);
      disclosureRef.current?.focus();
      return;
    }
    setSummaryOpen(true);
  };
  const updateGaps = (value: string) => {
    setDraft((current) => ({
      ...current,
      gaps: [...dispositionGaps(current.gaps), ...value.split('\n').filter((item) => item.trim())],
    }));
    setDirty(true);
    setLocalError(null);
  };
  const saveSummary = () => run(
    () => onSaveDraft(draft, sourceCompany),
    () => setDirty(false),
  );

  if (semantic && semantic.snapshot?.enabled !== false) {
    return (
      <PortfolioBootstrapSemanticConversation
        snapshot={semantic.snapshot}
        status={semantic.status}
        error={semantic.error}
        pendingInputText={semantic.pendingInputText}
        onSubmit={semantic.submit}
        onRetry={semantic.retry}
      >
        <SemanticContextReviewPanel
          operationScope={operationScope}
          review={review}
          status={status}
          error={error}
          onSaveDraft={onSaveDraft}
          onConfirm={onConfirm}
          onRetry={onRetry}
          onContinue={onContinue}
          proposal={proposalToReview}
        />
      </PortfolioBootstrapSemanticConversation>
    );
  }

  return (
    <div className="space-y-5" data-testid="portfolio-context-conversation" aria-busy={busy}>
      {review ? (
        <section aria-label="Origen del contexto guardado" data-testid="portfolio-context-source"
          className="rounded-xl border border-[#e4e7f0] bg-[#fbfcff] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f3eefc] px-2 py-1 text-xs font-bold text-[#493297]">Borrador recuperado</span>
            <span className="text-xs font-medium text-[#6c7695]">Versión {review.version}</span>
            {review.updatedAt && !Number.isNaN(Date.parse(review.updatedAt)) ? (
              <span className="text-xs text-[#6c7695]">Actualizado {new Date(review.updatedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-[#6c7695]">
            Esta información pertenece al contexto guardado de este espacio. No presupone un diagnóstico externo,
            una conversación reciente ni una confirmación de los datos.
            {review.draft.situation.sourceRef?.kind === 'user_input'
              ? ' El origen disponible identifica una entrada de usuario, pero no un turno histórico individual.'
              : ''}
          </p>
        </section>
      ) : null}
      {draft.situation.value ? (
        <div className="flex justify-end" data-testid="portfolio-context-stored-statement">
          <div className="max-h-40 max-w-[90%] overflow-auto rounded-2xl rounded-tr-sm bg-[#ede8fd] px-4 py-3 text-sm leading-6 text-[#182246]">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#6446c0]">Situación guardada · no es un historial de chat</p>
            <p>{draft.situation.value}</p>
          </div>
        </div>
      ) : null}
      {busy ? (
        <p role="status" className="rounded-lg border border-violet-100 bg-white p-3 text-sm font-medium text-violet-950">
          {status === 'loading'
            ? 'Cargando el contexto empresarial…'
            : status === 'confirming'
              ? 'Confirmando el contexto…'
              : 'Guardando el contexto…'}
        </p>
      ) : null}

      <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Contexto empresarial</p>
        <h3 className="mt-2 text-lg font-semibold text-violet-950">
          {awaitingPilotProjection ? 'Revisando lo que ya compartiste…'
            : proposalToReview && question.field === 'pilotExperience' ? 'Esto ya aparece en lo que contaste'
            : question.title}
        </h3>
        <p className="mt-1 text-sm text-violet-900">{awaitingPilotProjection
          ? 'Comprobamos primero si el relato ya incluye una respuesta para no repetirla.'
          : proposalToReview && question.field === 'pilotExperience'
            ? 'Esta es una propuesta respaldada por una cita. Puedes aceptarla o corregirla, y confirmarás el contexto después.'
            : question.help}</p>
        {awaitingPilotProjection ? (
          <p role="status" className="mt-3 text-sm text-violet-900">Verificando declaraciones previas…</p>
        ) : proposalToReview && question.field === 'pilotExperience' ? (
          <div className="mt-4 rounded-lg border border-violet-200 bg-white p-4">
            <p className="text-sm text-slate-800">{proposalToReview.sourceRef.quote}</p>
            <p className="mt-2 text-xs text-slate-500">Provisional · fuente histórica versionada · pendiente de revisión</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void acceptPilotProposal(proposalToReview)}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Sí, conservar esta información
              </button>
              <button type="button" disabled={busy} onClick={() => setRejectedProposalId(proposalToReview.id)}
                className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900">
                Prefiero corregirla
              </button>
            </div>
          </div>
        ) : question.field ? (
          <>
            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Tu respuesta
              <textarea disabled={busy} value={answer} onChange={(event) => setAnswer(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-950 disabled:opacity-60" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy || !answer.trim()} onClick={() => void saveAnswer()} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar y continuar</button>
              <button type="button" disabled={busy} onClick={() => void saveDisposition('unknown')} className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 disabled:opacity-50">Todavía no lo sé</button>
              <button type="button" disabled={busy} onClick={() => void saveDisposition('not_applicable')} className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 disabled:opacity-50">No aplica en este caso</button>
            </div>
          </>
        ) : null}
        <button ref={disclosureRef} type="button" aria-expanded={summaryOpen} aria-controls="portfolio-context-summary" onClick={toggleSummary} className="mt-4 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900">
          {summaryOpen ? 'Ocultar síntesis' : 'Revisar contexto'}
        </button>
      </section>

      {review?.hasPendingCorrection && review.confirmedSnapshot ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Corrección pendiente de reconfirmación</h3>
          <p className="mt-1 text-sm text-amber-900">El contexto confirmado continúa vigente hasta reconfirmar.</p>
          {review.confirmedSnapshot.situation.value ? <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-800">{review.confirmedSnapshot.situation.value}</p> : null}
        </section>
      ) : null}

      {summaryOpen ? (
        <section ref={summaryRef} id="portfolio-context-summary" role="region" aria-label="Síntesis editable del contexto" tabIndex={-1} className="rounded-xl border border-slate-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold text-slate-950">Síntesis editable</h3><p className="text-sm text-slate-600">Revisa lo declarado. Los desconocidos y «no aplica» quedan registrados sin convertirse en hechos.</p></div>
            {review?.effectiveSourceCompanyContext ? <p className="text-xs font-semibold text-slate-600">Versión {review.effectiveSourceCompanyContext.versionNumber} de Company Context</p> : null}
          </div>
          {review?.sourceOutdated ? <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Existe una versión Company más reciente. La fuente confirmada no se sustituirá sin tu revisión.</p> : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {CONTEXT_FIELDS.map((field) => (
              <div key={field}>
                <label htmlFor={`portfolio-context-${field}`} className="text-sm font-semibold text-slate-800">{FIELD_LABELS[field]}</label>
                <textarea disabled={busy} id={`portfolio-context-${field}`} value={fieldValue(draft[field])} onChange={(event) => updateField(field, event.target.value)} rows={field === 'situation' ? 3 : 2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950 disabled:opacity-60" />
                <span className="mt-1 block text-xs font-medium text-slate-500">{dispositionLabel(draft, field) ?? provenanceLabel(draft[field])}</span>
              </div>
            ))}
            <label className="text-sm font-semibold text-slate-800 md:col-span-2">
              Vacíos por resolver
              <textarea disabled={busy} value={userGaps(draft.gaps).join('\n')} onChange={(event) => updateGaps(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-950 disabled:opacity-60" />
            </label>
            {(['constraints', 'assumptions'] as const).map((field) => (
              <div key={field}>
                <label htmlFor={`portfolio-context-${field}`} className="text-sm font-semibold text-slate-800">{field === 'constraints' ? 'Restricciones conocidas' : 'Supuestos por validar'}</label>
                <textarea id={`portfolio-context-${field}`} disabled={busy} value={draft[field].map((item) => item.value ?? '').join('\n')} onChange={(event) => updateListField(field, event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950" />
                <span className="mt-1 block text-xs font-medium text-slate-500">{draft[field].length ? [...new Set(draft[field].map(provenanceLabel))].join(' · ') : 'Desconocido'}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy || !dirty} onClick={() => void saveSummary()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">Guardar ajustes</button>
            {review?.status === 'draft' ? <button type="button" disabled={busy || dirty} onClick={() => void run(onConfirm)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Estoy de acuerdo, confirmar contexto</button> : null}
            {review?.status === 'confirmed' ? <p role="status" className="self-center text-sm font-semibold text-emerald-800">Contexto confirmado</p> : null}
          </div>
          {dirty ? <p className="mt-2 text-sm font-medium text-amber-800">Guarda los ajustes antes de confirmar.</p> : null}
        </section>
      ) : null}

      {(localError || error) ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>{localError ?? error}</p>
          <button type="button" onClick={() => void run(onRetry)} className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold">Reintentar operación</button>
        </div>
      ) : null}

      {review?.effectiveContext ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-950">El contexto confirmado está persistido. Continuar abre el objetivo; no crea trabajo ni omite guardas posteriores.</p>
          <button type="button" disabled={busy} onClick={onContinue} className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Estoy de acuerdo, continuar al objetivo</button>
        </section>
      ) : null}
    </div>
  );
}

function SemanticContextReviewPanel({
  proposal,
  operationScope,
  review,
  status,
  error,
  onSaveDraft,
  onConfirm,
  onRetry,
  onContinue,
}: {
  proposal?: PortfolioBootstrapContextProposal | null;
  operationScope: string;
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
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const epoch = useRef(0);
  const sourceCompany = review?.draftSourceCompanyContext ?? review?.sourceCompanyContext ?? null;
  const contextBusy = busy || status === 'loading' || status === 'saving' || status === 'confirming';

  useEffect(() => {
    setDraft(persistedDraft);
    setDirty(false);
    setLocalError(null);
  }, [operationScope, review?.id, review?.version]);

  useEffect(() => {
    epoch.current += 1;
    setBusy(false);
  }, [operationScope]);

  const updateField = (field: ContextField, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value.trim()
        ? { value, provenance: 'user_declared', sourceRef: { kind: 'user_input' } }
        : { value: null, provenance: 'unknown' },
      gaps: withoutFieldDisposition(current.gaps, field),
    }));
    setDirty(true);
    setLocalError(null);
  };

  const updateList = (field: 'constraints' | 'assumptions', value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value.split('\n').map((item) => item.trim()).filter(Boolean).map(declared),
    }));
    setDirty(true);
    setLocalError(null);
  };

  const run = async (operation: () => Promise<unknown>, after?: () => void) => {
    const operationEpoch = epoch.current;
    setBusy(true);
    setLocalError(null);
    try {
      await operation();
      if (operationEpoch === epoch.current) after?.();
    } catch (caught) {
      if (operationEpoch === epoch.current) {
        setLocalError(caught instanceof Error ? caught.message : 'No pudimos completar la revisión.');
      }
    } finally {
      if (operationEpoch === epoch.current) setBusy(false);
    }
  };

  return (
    <section role="region" aria-label="Síntesis canónica editable" className="rounded-xl border border-slate-300 bg-white p-4">
      <h3 className="font-semibold text-slate-950">Síntesis canónica editable</h3>
      <p className="mt-1 text-sm text-slate-600">
        Revisa y redacta el ContextReview. Starteria no convierte automáticamente conceptos del ledger en estos campos.
      </p>
      {proposal && !draft.pilotExperience.value ? (
        <section aria-label="Propuesta de experiencia previa" className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
          <p className="font-semibold text-violet-950">Posible información ya declarada</p>
          <p className="mt-1 text-sm text-violet-900">{proposal.sourceRef.quote}</p>
          <p className="mt-1 text-xs text-violet-800">Propuesta sin confirmar · fuente versionada</p>
          <button type="button" disabled={contextBusy} className="mt-2 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => {
              setDraft((current) => ({
                ...current,
                pilotExperience: { value: proposal.value, provenance: 'user_declared', sourceRef: proposal.sourceRef },
                gaps: withoutFieldDisposition(current.gaps, 'pilotExperience'),
              }));
              setDirty(true);
            }}>Incorporar a mi borrador</button>
        </section>
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {CONTEXT_FIELDS.map((field) => (
          <label key={field} className="text-sm font-semibold text-slate-800">
            {FIELD_LABELS[field]}
            <textarea
              disabled={contextBusy}
              value={fieldValue(draft[field])}
              onChange={(event) => updateField(field, event.target.value)}
              rows={field === 'situation' ? 3 : 2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-950 disabled:opacity-60"
            />
          </label>
        ))}
        <label className="text-sm font-semibold text-slate-800">
          Restricciones conocidas
          <textarea disabled={contextBusy} value={draft.constraints.map(fieldValue).join('\n')} onChange={(event) => updateList('constraints', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-950 disabled:opacity-60" />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Hipótesis aceptadas o supuestos por validar
          <textarea disabled={contextBusy} value={draft.assumptions.map(fieldValue).join('\n')} onChange={(event) => updateList('assumptions', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-950 disabled:opacity-60" />
        </label>
        <label className="text-sm font-semibold text-slate-800 md:col-span-2">
          Pendientes explícitos
          <textarea disabled={contextBusy} value={userGaps(draft.gaps).join('\n')} onChange={(event) => {
            setDraft((current) => ({ ...current, gaps: [...dispositionGaps(current.gaps), ...event.target.value.split('\n').map((item) => item.trim()).filter(Boolean)] }));
            setDirty(true);
            setLocalError(null);
          }} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-950 disabled:opacity-60" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={contextBusy || !dirty} onClick={() => void run(() => onSaveDraft(draft, sourceCompany), () => setDirty(false))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">
          Guardar síntesis editable
        </button>
        {review?.status === 'draft' ? (
          <button type="button" disabled={contextBusy || dirty} onClick={() => void run(onConfirm)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Confirmar contexto revisado
          </button>
        ) : null}
        {review?.status === 'confirmed' ? <p role="status" className="self-center text-sm font-semibold text-emerald-800">Contexto confirmado por una persona</p> : null}
      </div>

      {(localError || error) ? (
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>{localError ?? error}</p>
          <button type="button" onClick={() => void run(onRetry)} className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold">Reintentar revisión</button>
        </div>
      ) : null}

      {review?.effectiveContext ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-950">La confirmación persistida habilita E2; la convergencia semántica por sí sola no lo hace.</p>
          <button type="button" disabled={contextBusy} onClick={onContinue} className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Continuar al objetivo</button>
        </div>
      ) : null}
    </section>
  );
}
