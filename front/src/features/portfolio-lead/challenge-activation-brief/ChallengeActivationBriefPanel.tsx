import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, FileText, History, LockKeyhole, PencilLine, Sparkles } from 'lucide-react';
import {
  type ActivationBrief,
  type ActivationBriefVersion,
  type BriefInput,
  confirmActivationBriefVersion,
  createActivationBrief,
  createActivationBriefVersion,
  getActivationBrief,
  listActivationBriefs,
} from './challengeActivationBriefClient';

export type ChallengeBriefInheritedContext = {
  objective: string;
  frontName: string;
  frontFocus: string;
  challengeProblem: string;
  businessSignal: string | null;
  decisionToEnable: string | null;
  relatedInitiatives: string[];
  knownFacts: string[];
  unknowns: string[];
  constraints: string[];
  sourceRefs: string[];
  horizon: string | null;
};

type Props = {
  challengeId: string;
  challengeName: string;
  /** Exact canonical Brief to recover. `null` starts a separate Brief; undefined preserves the secondary-page fallback. */
  briefId?: string | null;
  inherited?: ChallengeBriefInheritedContext;
  onConfirmationChange?: (confirmed: boolean) => void;
  onVersionStateChange?: (state: { briefId: string | null; hasConfirmedVersion: boolean; latestVersionStatus: 'DRAFT' | 'CONFIRMED' | null }) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Compatibility input for the secondary Challenge page while Copilot is the primary PL-05 route. */
  inheritedContext?: string;
  constraints?: string;
  knownGaps?: string;
  sourceRefs?: string[];
};

type EditableBrief = {
  intent: string;
  scope: string;
  expectedDeliverable: string;
  decisionToEnable: string;
  horizon: string;
  constraints: string;
  unknowns: string;
};

const textareaClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal leading-6 text-slate-900 shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600';

function fallbackInherited(props: Props): ChallengeBriefInheritedContext {
  return props.inherited ?? {
    objective: props.inheritedContext?.trim() || 'Objetivo estratégico asociado al reto.',
    frontName: 'Frente estratégico confirmado',
    frontFocus: props.inheritedContext?.trim() || 'Contexto heredado de Portfolio.',
    challengeProblem: props.challengeName,
    businessSignal: null,
    decisionToEnable: null,
    relatedInitiatives: [],
    knownFacts: props.inheritedContext?.trim() ? [props.inheritedContext.trim()] : [],
    unknowns: props.knownGaps?.trim() ? [props.knownGaps.trim()] : [],
    constraints: props.constraints?.trim() ? [props.constraints.trim()] : [],
    sourceRefs: props.sourceRefs ?? [],
    horizon: null,
  };
}

function proposalFrom(context: ChallengeBriefInheritedContext, challengeName: string): EditableBrief {
  return {
    intent: `Explorar el reto «${challengeName}» y definir qué necesita el equipo para contribuir a ${context.objective}.`,
    scope: context.relatedInitiatives.length > 0
      ? `${context.relatedInitiatives.length} iniciativas relacionadas aportan contexto: ${context.relatedInitiatives.join(', ')}. No implica ejecutar todas.`
      : `Partir del reto confirmado «${challengeName}» sin asumir trabajo previo adicional.`,
    expectedDeliverable: 'Una propuesta razonada que explique qué conviene hacer y qué evidencia la sustenta.',
    decisionToEnable: context.decisionToEnable?.trim() || 'Pendiente de definir',
    horizon: context.horizon ?? '',
    constraints: context.constraints.join('\n'),
    unknowns: context.unknowns.join('\n'),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function editableFromVersion(version: ActivationBriefVersion, proposal: EditableBrief): EditableBrief {
  const inherited = objectValue(version.inheritedContext);
  return {
    intent: version.intent ?? proposal.intent,
    scope: version.scope ?? proposal.scope,
    expectedDeliverable: typeof inherited.expectedDeliverable === 'string' ? inherited.expectedDeliverable : proposal.expectedDeliverable,
    decisionToEnable: typeof inherited.decisionToEnable === 'string' ? inherited.decisionToEnable : proposal.decisionToEnable,
    horizon: typeof inherited.horizon === 'string' ? inherited.horizon : proposal.horizon,
    constraints: stringArray(version.constraintsSnapshot).join('\n'),
    unknowns: stringArray(version.knownGaps).join('\n'),
  };
}

function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export function ChallengeActivationBriefPanel(props: Props) {
  const inheritedFingerprint = JSON.stringify(fallbackInherited(props));
  const inherited = useMemo(
    () => JSON.parse(inheritedFingerprint) as ChallengeBriefInheritedContext,
    [inheritedFingerprint],
  );
  const initialProposal = useMemo(() => proposalFrom(inherited, props.challengeName), [inherited, props.challengeName]);
  const [brief, setBrief] = useState<ActivationBrief | null>(null);
  const [version, setVersion] = useState<ActivationBriefVersion | null>(null);
  const [draft, setDraft] = useState<EditableBrief>(initialProposal);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingConfirmed, setEditingConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedOperation, setLastFailedOperation] = useState<'save' | 'confirm' | null>(null);
  const operationKeys = useRef(new Map<string, string>());

  const versions = brief?.versions ?? [];
  const current = version ?? versions.at(-1) ?? null;
  const hasConfirmedVersion = versions.some((item) => item.status === 'CONFIRMED') || current?.status === 'CONFIRMED';
  const isReadOnly = current?.status === 'CONFIRMED' && !editingConfirmed;
  const requiredComplete = Boolean(draft.intent.trim() && draft.scope.trim() && draft.expectedDeliverable.trim() && draft.decisionToEnable.trim());

  const keyFor = (operation: string) => {
    const previous = operationKeys.current.get(operation);
    if (previous) return previous;
    const key = crypto.randomUUID();
    operationKeys.current.set(operation, key);
    return key;
  };
  const resetKeysAfterEdit = () => {
    operationKeys.current.delete('create');
    if (brief) operationKeys.current.delete(`version:${brief.id}`);
  };

  const payload = (): BriefInput => ({
    intent: draft.intent.trim(),
    scope: draft.scope.trim(),
    strategicContextRefs: {
      objective: inherited.objective,
      frontName: inherited.frontName,
      frontFocus: inherited.frontFocus,
      challengeId: props.challengeId,
      challengeName: props.challengeName,
      businessSignal: inherited.businessSignal,
      relatedInitiatives: inherited.relatedInitiatives,
    },
    inheritedContext: {
      objective: inherited.objective,
      challengeProblem: inherited.challengeProblem,
      knownFacts: inherited.knownFacts,
      expectedDeliverable: draft.expectedDeliverable.trim(),
      decisionToEnable: draft.decisionToEnable.trim(),
      horizon: draft.horizon.trim() || null,
    },
    constraintsSnapshot: lines(draft.constraints),
    knownGaps: lines(draft.unknowns),
    sourceRefs: inherited.sourceRefs,
    provenance: {
      source: 'PL05_COPILOT',
      challengeId: props.challengeId,
      inheritedFrom: 'PL04_CONFIRMED_ORGANIZATION',
      fieldOrigins: {
        objective: 'CONFIRMED_CONTEXT', challengeProblem: 'CONFIRMED_CONTEXT',
        knownFacts: 'SOURCE_DERIVED', intent: 'AI_PROPOSAL_HUMAN_EDITABLE',
        scope: 'AI_PROPOSAL_HUMAN_EDITABLE', expectedDeliverable: 'AI_PROPOSAL_HUMAN_EDITABLE',
        decisionToEnable: inherited.decisionToEnable ? 'CONFIRMED_CONTEXT' : 'AI_PROPOSAL_HUMAN_EDITABLE',
        unknowns: 'CARRIED_FORWARD',
      },
    },
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    const recovery = props.briefId === null
      ? Promise.resolve<ActivationBrief | null>(null)
      : props.briefId
        ? getActivationBrief(props.briefId)
        : listActivationBriefs(props.challengeId).then((items) => items[0] ?? null);
    void recovery
      .then((recovered) => {
        if (!active) return;
        const recoveredVersion = recovered?.versions.at(-1) ?? null;
        setBrief(recovered);
        setVersion(recoveredVersion);
        setDraft(recoveredVersion ? editableFromVersion(recoveredVersion, initialProposal) : initialProposal);
        setEditingConfirmed(false);
        setDirty(false);
        props.onDirtyChange?.(false);
        const hasConfirmed = Boolean(recovered?.versions.some((item) => item.status === 'CONFIRMED'));
        props.onConfirmationChange?.(hasConfirmed);
        props.onVersionStateChange?.({ briefId: recovered?.id ?? null, hasConfirmedVersion: hasConfirmed, latestVersionStatus: recoveredVersion?.status ?? null });
      })
      .catch((value) => setError(value instanceof Error ? value.message : 'No se pudo recuperar el Brief.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialProposal, props.briefId, props.challengeId]);

  const change = (field: keyof EditableBrief, value: string) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setDirty(true);
    props.onDirtyChange?.(true);
    setError(null);
    setLastFailedOperation(null);
    resetKeysAfterEdit();
  };

  const saveDraft = async () => {
    if (!requiredComplete) return;
    setBusy(true); setError(null); setLastFailedOperation(null);
    try {
      if (!brief) {
        const result = await createActivationBrief(props.challengeId, payload(), keyFor('create'));
        setBrief(result.brief);
        const created = result.brief.versions.at(-1) ?? null;
        setVersion(created);
        props.onVersionStateChange?.({ briefId: result.brief.id, hasConfirmedVersion: false, latestVersionStatus: created?.status ?? null });
      } else {
        const result = await createActivationBriefVersion(brief.id, payload(), keyFor(`version:${brief.id}`));
        setVersion(result.version);
        setBrief((existing) => existing ? { ...existing, versions: [...existing.versions, result.version] } : existing);
        props.onVersionStateChange?.({ briefId: brief.id, hasConfirmedVersion, latestVersionStatus: result.version.status });
      }
      setDirty(false); setEditingConfirmed(false); props.onDirtyChange?.(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo guardar el borrador.');
      setLastFailedOperation('save');
    } finally { setBusy(false); }
  };

  const confirmCurrent = async () => {
    if (!current || current.status !== 'DRAFT' || dirty) return;
    setBusy(true); setError(null); setLastFailedOperation(null);
    try {
      const result = await confirmActivationBriefVersion(current.id, keyFor(`confirm:${current.id}`));
      setVersion(result.version);
      setBrief((existing) => existing ? { ...existing, versions: existing.versions.map((item) => item.id === result.version.id ? result.version : item) } : existing);
      props.onConfirmationChange?.(true);
      props.onVersionStateChange?.({ briefId: brief?.id ?? props.briefId ?? null, hasConfirmedVersion: true, latestVersionStatus: 'CONFIRMED' });
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No se pudo confirmar la versión.');
      setLastFailedOperation('confirm');
    } finally { setBusy(false); }
  };

  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-live="polite"><p className="text-sm font-semibold text-slate-800">Recuperando contexto y versiones del Brief...</p></section>;

  const statusLabel = editingConfirmed
    ? 'Nueva versión sin guardar'
    : !current
      ? 'Propuesta sin guardar'
      : current.status === 'CONFIRMED'
        ? `Versión ${current.versionNumber} confirmada`
        : `Borrador guardado · Versión ${current.versionNumber}`;
  const statusStyle = current?.status === 'CONFIRMED' && !editingConfirmed
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : current?.status === 'DRAFT'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-violet-200 bg-violet-50 text-violet-800';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="challenge-activation-brief-panel" data-brief-id={brief?.id ?? props.briefId ?? 'new'}>
      <header className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-emerald-50 px-5 py-6 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-700">PL-05 · Antes de asignar</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Prepara el Brief que recibirá tu equipo</h3>
            <p className="mt-3 text-sm leading-6 text-slate-700">Ya definiste el objetivo del negocio y confirmaste el reto. Antes de invitar o asignar a las personas que lo abordarán, prepara un encargo claro: qué se busca, qué sabemos, qué esperas que entreguen y qué decisión permitirá tomar su trabajo.</p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusStyle}`}>{statusLabel}</span>
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm font-medium text-slate-700"><LockKeyhole className="mt-0.5 shrink-0 text-slate-500" size={16} />Confirmar este Brief todavía no asigna personas ni inicia trabajo.</p>
      </header>

      <div className="space-y-5 bg-slate-50/60 p-4 md:p-6">
        <details className="group rounded-xl border border-slate-200 bg-white" aria-label="Contexto heredado">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 marker:content-none md:px-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Lo que Startería ya recuperó</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">Objetivo y reto confirmados · {inherited.relatedInitiatives.length} {inherited.relatedInitiatives.length === 1 ? 'iniciativa relacionada' : 'iniciativas relacionadas'} · {inherited.sourceRefs.length} {inherited.sourceRefs.length === 1 ? 'fuente' : 'fuentes'}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Ábrelo para revisar procedencia, señales, límites y lo que aún falta aclarar.</p>
            </div>
            <ChevronDown className="mt-1 shrink-0 text-slate-500 transition-transform group-open:rotate-180" size={18} aria-hidden="true" />
          </summary>
          <div className="grid gap-3 border-t border-slate-200 px-4 py-4 md:grid-cols-2 md:px-5">
            <ContextBlock label="Objetivo confirmado" tone="emerald"><p>{inherited.objective}</p><p className="mt-1 text-slate-600">Frente: {inherited.frontName}</p></ContextBlock>
            <ContextBlock label="Reto confirmado" tone="emerald"><p>{inherited.challengeProblem}</p></ContextBlock>
            <ContextBlock label="Contexto disponible" tone="slate">
              {inherited.knownFacts.length > 0 ? <List items={inherited.knownFacts} /> : <p>No hay antecedentes adicionales registrados.</p>}
              {inherited.relatedInitiatives.length > 0 ? <p className="mt-2"><b>{inherited.relatedInitiatives.length} iniciativas relacionadas</b> aportan contexto; no son una instrucción de ejecutarlas todas.</p> : null}
            </ContextBlock>
            <ContextBlock label="Fuentes recuperadas" tone="blue">{inherited.sourceRefs.length > 0 ? <><List items={inherited.sourceRefs} /><p className="mt-2 text-xs">Fuente declarada o importada; Startería no la verificó externamente.</p></> : <p>No hay una fuente adicional registrada para mostrar.</p>}</ContextBlock>
            <ContextBlock label="Qué falta aclarar" tone="amber">{inherited.unknowns.length > 0 ? <List items={inherited.unknowns} /> : <p>No hay vacíos críticos registrados en el contexto heredado; esto no significa que todo esté resuelto.</p>}</ContextBlock>
            <ContextBlock label="Límites conocidos" tone="slate">{inherited.constraints.length > 0 ? <List items={inherited.constraints} /> : <p>No hay restricciones registradas todavía.</p>}</ContextBlock>
            {inherited.businessSignal ? <ContextBlock label="Señal confirmada" tone="slate"><p>{inherited.businessSignal}</p></ContextBlock> : null}
          </div>
        </details>

        <article className="rounded-xl border border-slate-200 bg-white px-4 py-5 md:px-7 md:py-6" aria-labelledby="brief-document-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center gap-2 text-violet-800"><Sparkles size={17} /><p className="text-xs font-bold uppercase tracking-[0.14em]">{isReadOnly ? 'Confirmado por Portfolio Lead' : 'Startería sugiere · tú decides'}</p></div>
              <h4 id="brief-document-title" className="mt-2 text-xl font-semibold text-slate-950">Brief del reto</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">Léelo como el encargo que recibirá el equipo. Puedes ajustar la propuesta antes de guardarla y confirmarla.</p>
            </div>
          </div>

          {!brief ? <p role="status" className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-950">Estás revisando una propuesta sin guardar; aún no existe un Brief guardado.</p> : null}

          <div className="mt-5 space-y-5">
            <BriefSection label="Qué reto vamos a abordar" help="El desafío confirmado que recibirá el equipo." value={props.challengeName} marker="Confirmado" />

            {isReadOnly ? <BriefSection label="Qué buscamos conseguir" help="El resultado que esperamos que este encargo ayude a conseguir." value={draft.intent} /> : <BriefField label="Qué buscamos conseguir" help="El resultado que esperamos que este encargo ayude a conseguir." value={draft.intent} onChange={(value) => change('intent', value)} rows={3} />}
            {isReadOnly ? <BriefSection label="Qué necesita saber el equipo" help="Antecedentes y trabajo ya hecho para evitar empezar desde cero." value={draft.scope} /> : <BriefField label="Qué necesita saber el equipo" help="Antecedentes y trabajo ya hecho para evitar empezar desde cero." value={draft.scope} onChange={(value) => change('scope', value)} rows={3} />}
            {inherited.relatedInitiatives.length > 0 ? <p className="-mt-2 border-l-2 border-slate-300 pl-3 text-xs leading-5 text-slate-600">Las iniciativas relacionadas son contexto disponible. Este Brief no solicita ejecutar las {inherited.relatedInitiatives.length}.</p> : null}

            <div className="grid gap-5 md:grid-cols-2">
              {isReadOnly ? <BriefSection label="Qué esperamos que entregue" help="Qué información, propuesta o evidencia deberá devolver el equipo." value={draft.expectedDeliverable} /> : <BriefField label="Qué esperamos que entregue" help="Qué información, propuesta o evidencia deberá devolver el equipo." value={draft.expectedDeliverable} onChange={(value) => change('expectedDeliverable', value)} rows={4} />}
              {isReadOnly ? <BriefSection label="Qué podremos decidir con ese trabajo" help="Por ejemplo: si conviene probar, ajustar el enfoque o continuar investigando." value={draft.decisionToEnable} /> : <BriefField label="Qué podremos decidir con ese trabajo" help="Por ejemplo: si conviene probar, ajustar el enfoque o continuar investigando." value={draft.decisionToEnable} onChange={(value) => change('decisionToEnable', value)} rows={4} />}
            </div>

            <div className="grid gap-5 border-t border-slate-200 pt-5 md:grid-cols-2">
              {isReadOnly ? <BriefSection label="Límites que debemos respetar" help="Tiempo, presupuesto, personas, datos, dependencias o políticas, solo si existen." value={draft.constraints} empty="No se registraron límites." /> : <BriefField label="Límites que debemos respetar" help="Tiempo, presupuesto, personas, datos, dependencias o políticas, solo si existen." value={draft.constraints} onChange={(value) => change('constraints', value)} rows={3} optional placeholder="No hay límites registrados todavía" />}
              {isReadOnly ? <BriefSection label="Qué necesitamos aclarar todavía" help="Información incierta o supuestos que el equipo deberá contrastar." value={draft.unknowns} empty="No se registraron pendientes." /> : <BriefField label="Qué necesitamos aclarar todavía" help="Información incierta o supuestos que el equipo deberá contrastar." value={draft.unknowns} onChange={(value) => change('unknowns', value)} rows={3} optional placeholder="No hay información incierta registrada todavía" />}
            </div>
            {isReadOnly ? <BriefSection label="Plazo u horizonte" help="Cuándo sería útil contar con el resultado." value={draft.horizon} empty="No se registró un horizonte." /> : <BriefField label="Plazo u horizonte" help="Cuándo sería útil contar con el resultado." value={draft.horizon} onChange={(value) => change('horizon', value)} rows={2} optional placeholder="No hay un plazo sustentado por ahora" />}
          </div>

          {!requiredComplete ? <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertCircle className="mt-0.5 shrink-0" size={17} />Completa resultado, alcance, entregable y decisión antes de guardar.</p> : null}
          {dirty && current ? <p role="status" className="mt-4 text-sm font-medium text-amber-800">Tienes cambios sin guardar. La confirmación seguirá apuntando a la última versión persistida.</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            {!brief ? <button type="button" disabled={busy || !requiredComplete} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><FileText size={16} />{lastFailedOperation === 'save' ? 'Reintentar guardar borrador' : 'Guardar borrador'}</button> : current?.status === 'DRAFT' || editingConfirmed ? <><button type="button" disabled={busy || !requiredComplete || !dirty} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"><PencilLine size={16} />Guardar nueva versión borrador</button>{current?.status === 'DRAFT' ? <button type="button" disabled={busy || dirty || !requiredComplete} onClick={confirmCurrent} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><CheckCircle2 size={16} />{lastFailedOperation === 'confirm' ? 'Reintentar confirmar esta versión' : 'Confirmar esta versión'}</button> : null}</> : <><span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><LockKeyhole size={16} />Esta versión quedó confirmada e inmutable</span><button type="button" disabled={busy} onClick={() => { setEditingConfirmed(true); setDirty(false); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"><PencilLine size={16} />Revisar en nueva versión</button></>}
          </div>

          {brief ? <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600"><History size={16} /><span><b className="text-slate-900">{versions.length} {versions.length === 1 ? 'versión conservada' : 'versiones conservadas'}</b>. Cada guardado añade historia; nunca sobrescribe una versión anterior.</span></div> : null}
          {current?.status === 'CONFIRMED' && brief ? <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Brief confirmado</p><h4 className="mt-1 font-semibold text-emerald-950">Versión confirmada e inmutable</h4><p className="mt-1 text-sm leading-6 text-emerald-900">El contexto de activación queda preparado para el siguiente checkpoint humano.</p></section> : null}
        </article>
      </div>
    </section>
  );
}

function BriefField({ label, help, value, onChange, rows, optional = false, placeholder }: { label: string; help: string; value: string; onChange: (value: string) => void; rows: number; optional?: boolean; placeholder?: string }) {
  return <label className="block text-sm font-semibold text-slate-950">{label}{optional ? <span className="ml-1 font-normal text-slate-500">· si existe</span> : null}<span className="mt-1 block text-xs font-normal leading-5 text-slate-600">{help}</span><textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={textareaClass} placeholder={placeholder} /></label>;
}

function BriefSection({ label, help, value, empty = 'Sin información registrada.', marker }: { label: string; help: string; value: string; empty?: string; marker?: string }) {
  return <section><div className="flex flex-wrap items-center gap-2"><h5 className="text-sm font-semibold text-slate-950">{label}</h5>{marker ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{marker}</span> : null}</div><p className="mt-1 text-xs leading-5 text-slate-600">{help}</p><p className={`mt-2 whitespace-pre-line text-sm leading-6 ${value.trim() ? 'text-slate-800' : 'italic text-slate-500'}`}>{value.trim() || empty}</p></section>;
}

function ContextBlock({ label, tone, children }: { label: string; tone: 'emerald' | 'blue' | 'amber' | 'slate'; children: React.ReactNode }) {
  const styles = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950', blue: 'border-blue-200 bg-blue-50 text-blue-950', amber: 'border-amber-200 bg-amber-50 text-amber-950', slate: 'border-slate-200 bg-white text-slate-800' };
  return <section className={`rounded-lg border p-3 text-sm leading-5 ${styles[tone]}`}><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] opacity-75">{label}</p>{children}</section>;
}

function List({ items }: { items: string[] }) {
  return <ul className="space-y-1">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">·</span><span>{item}</span></li>)}</ul>;
}
