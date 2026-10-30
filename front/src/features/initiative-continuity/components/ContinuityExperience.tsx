import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Circle, HelpCircle, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { Project } from '../../../app/context/AppContext';
import type { AdaptiveInitiativeCore } from '../../adaptive-core/domain/types';
import { getAuthoritativeActiveStep } from '../../adaptive-core/domain/adaptiveAuthority';
import { getConfirmedStepOutput, getStepCheckpointProgress, getStepMission, STEP_NAMES, type StepNumber } from '../domain/stepPresentation';

type LoadState = 'loading' | 'loaded' | 'error';

function outputSource(output: Record<string, unknown> | null) {
  if (!output) return 'Procedencia no informada';
  const explicitSource = output.source ?? output.generatedBy ?? output.createdBy;
  if (explicitSource) return String(explicitSource);
  if (output.sourceConfigurationId) return `Configuración ${String(output.sourceConfigurationId)}`;
  return 'Procedencia no informada';
}

function outputVersion(output: Record<string, unknown> | null) {
  return output?.version ? `v${String(output.version)}` : 'Versión no informada';
}

function outputDate(output: Record<string, unknown> | null) {
  const value = output?.confirmedAt ?? output?.updatedAt ?? output?.createdAt;
  if (!value) return 'Fecha no informada';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function readableOutput(output: Record<string, unknown> | null): Array<[string, string]> {
  if (!output) return [];
  const candidate = output.output && typeof output.output === 'object' ? output.output as Record<string, unknown> : output;
  return Object.entries(candidate)
    .filter(([key, value]) => !['id', 'projectId', 'cycleId', 'configurationId', 'sourceConfigurationId', 'createdAt', 'updatedAt', 'confirmedAt', 'status', 'version', 'source', 'generatedBy', 'createdBy', 'step', 'stepNumber', 'requiresReview'].includes(key)
      && value != null
      && value !== ''
      && (!Array.isArray(value) || value.length > 0)
      && (typeof value !== 'object' || Array.isArray(value) || Object.keys(value as Record<string, unknown>).length > 0))
    .slice(0, 8)
    .map(([key, value]) => [key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' '), typeof value === 'string' ? value : JSON.stringify(value)]);
}

function confirmedOutputSummary(output: Record<string, unknown>) {
  const candidate = output.output && typeof output.output === 'object' ? output.output as Record<string, unknown> : output;
  const scalar = Object.values(candidate).find(value => typeof value === 'string' && value.trim().length > 0) as string | undefined;
  if (scalar) return scalar;
  const fieldCount = readableOutput(output).length;
  return fieldCount > 0 ? `Resultado confirmado con ${fieldCount} apartados canónicos.` : null;
}

function CollapsibleSection({ title, children, tone = 'neutral', defaultOpen = false }: { title: string; children: ReactNode; tone?: 'neutral' | 'confirmed'; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const generatedId = useId();
  const contentId = `step-section-${generatedId.replaceAll(':', '')}`;
  const confirmed = tone === 'confirmed';
  return (
    <div className={`rounded-xl border ${confirmed ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(value => !value)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 ${confirmed ? 'text-emerald-900 focus-visible:ring-emerald-500' : 'text-slate-800 focus-visible:ring-indigo-500'}`}
      >
        <span>{title}</span>
        <ChevronDown aria-hidden="true" size={16} className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={contentId} hidden={!open} className={`border-t px-3 pb-3 pt-3 ${confirmed ? 'border-emerald-200' : 'border-slate-100'}`}>
        {children}
      </div>
    </div>
  );
}

function ConfirmedOutputDetails({ output, title, defaultOpen = false }: { output: Record<string, unknown>; title: string; defaultOpen?: boolean }) {
  const fields = readableOutput(output);
  return (
    <CollapsibleSection title="Ver resultado del Step" tone="confirmed" defaultOpen={defaultOpen}>
        <p className="text-sm font-bold text-slate-950">{title}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800">Confirmado por una persona</span>
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700">{outputVersion(output)}</span>
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700">Origen: {outputSource(output)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-600">Confirmado: {outputDate(output)}</p>
        <div className="mt-3 space-y-3">
          {fields.length > 0 ? fields.map(([label, value]) => <div key={label} className="rounded-lg bg-white p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm leading-6 text-slate-800">{value}</p></div>) : <p className="text-sm text-slate-700">El output confirmado no contiene campos presentables.</p>}
        </div>
    </CollapsibleSection>
  );
}

interface StepProgressPanelProps {
  core: AdaptiveInitiativeCore | null;
  step: StepNumber;
  onReviewCheckpoint?: () => void;
  readOnly?: boolean;
  resultFirst?: boolean;
}

export function StepProgressPanel({ core, step, onReviewCheckpoint, readOnly, resultFirst = false }: StepProgressPanelProps) {
  const progress = useMemo(() => getStepCheckpointProgress(core, step), [core, step]);
  const mission = useMemo(() => getStepMission(core, step), [core, step]);
  const output = useMemo(() => getConfirmedStepOutput(core, step), [core, step]);
  const checkpoint = core?.activeCheckpoint?.step === step ? core.activeCheckpoint : null;
  const outputSummary = output ? confirmedOutputSummary(output) : null;
  if (progress.percent === null && !checkpoint && !output) {
    return (
      <aside aria-label={`Estado operativo de Step ${step}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-sm sm:p-5">
        La revisión de este Step aún no está preparada. Puedes seguir conversando; todavía no puedes confirmar avances desde esta pantalla.
      </aside>
    );
  }
  if (resultFirst && output) {
    return (
      <aside aria-labelledby={`step-${step}-result-title`} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="sr-only">Step {step}</h2>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Resultado confirmado</p>
            <h2 id={`step-${step}-result-title`} className="mt-1 text-xl font-bold text-slate-950">Qué conseguiste</h2>
            {outputSummary ? <p className="mt-2 text-base font-semibold leading-6 text-slate-900">{outputSummary}</p> : null}
            <p className="mt-1 text-sm leading-6 text-slate-600">Resultado canónico de Step {step}, procedente del Adaptive Core. La conversación histórica no lo reemplaza.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Confirmado</span>
        </div>
        <div className="mt-4"><ConfirmedOutputDetails output={output} title={mission.expectedOutput} defaultOpen /></div>
      </aside>
    );
  }
  return (
    <aside aria-labelledby={`step-${step}-progress-title`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Tu avance</p><h2 id={`step-${step}-progress-title`} className="mt-1 text-base font-bold text-slate-950">Step {step}</h2></div>
        {progress.percent !== null ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{progress.completed}/{progress.total}</span> : <Circle aria-hidden="true" size={20} className="text-slate-400" />}
      </div>
      {progress.percent !== null ? <div className="mt-4" aria-label={`${progress.completed} de ${progress.total} checkpoints confirmados`}>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} /></div>
        <div className="mt-3 space-y-2">{progress.rows.map(row => <CollapsibleSection key={`${row.code}-${row.id}`} title={`${row.code} · ${row.title}`}><div className="flex items-start gap-2 text-xs leading-5 text-slate-700">{row.confirmed ? <CheckCircle2 aria-label="Confirmado" size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : row.active ? <Circle aria-label="En curso" size={16} className="mt-0.5 shrink-0 fill-indigo-100 text-indigo-600" /> : <Circle aria-label="Pendiente" size={16} className="mt-0.5 shrink-0 text-slate-400" />}<span>{row.confirmed ? 'Checkpoint confirmado por el Adaptive Core.' : row.active ? 'Checkpoint operativo en curso.' : 'Checkpoint pendiente.'}</span></div></CollapsibleSection>)}</div>
      </div> : <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">No hay un checkpoint operativo preparado para este Step. No se muestra un porcentaje ni se genera progreso al navegar.</div>}
      <div className="mt-4 border-t border-slate-100 pt-4">
        {checkpoint && onReviewCheckpoint ? <button type="button" onClick={onReviewCheckpoint} className="min-h-11 w-full rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Revisar checkpoint</button> : <p className="text-xs leading-5 text-slate-600">{readOnly && checkpoint ? 'Puedes consultar el checkpoint, pero no confirmarlo con tu permiso actual.' : 'Todavía no hay una revisión canónica disponible para este Step.'}</p>}
      </div>
      <div className="mt-4">{output ? <ConfirmedOutputDetails output={output} title={mission.expectedOutput} /> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3"><p className="text-sm font-bold text-slate-800">Todavía no hay un resultado confirmado disponible</p><p className="mt-1 text-xs leading-5 text-slate-600">El progreso y los borradores no sustituyen al AdaptiveStepOutput confirmado.</p></div>}</div>
    </aside>
  );
}

interface StepHelpDialogProps { open: boolean; onClose: () => void; onReviewCheckpoint?: () => void; onRefresh: () => void; }

export function StepHelpDialog({ open, onClose, onReviewCheckpoint, onRefresh }: StepHelpDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}><div role="dialog" aria-modal="true" aria-labelledby="step-help-title" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 p-5"><div><h2 id="step-help-title" className="text-lg font-bold text-slate-950">¿Qué necesitas resolver?</h2><p className="mt-1 text-sm text-slate-500">Sólo mostramos canales operativos en este entorno.</p></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar ayuda" className="min-h-11 min-w-11 rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><X aria-hidden="true" size={18} /></button></div><div className="space-y-3 p-5">{onReviewCheckpoint ? <button type="button" onClick={() => { onClose(); onReviewCheckpoint(); }} className="min-h-11 w-full rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><p className="text-sm font-bold text-indigo-900">Revisar el checkpoint o el bloqueo</p><p className="mt-1 text-xs leading-5 text-indigo-700">Abre la superficie canónica y conserva permisos, evidencias y gates.</p></button> : null}<button type="button" onClick={() => { onClose(); onRefresh(); }} className="min-h-11 w-full rounded-xl border border-slate-200 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><p className="text-sm font-bold text-slate-900">Recargar contexto persistido</p><p className="mt-1 text-xs leading-5 text-slate-600">Úsalo si el output o checkpoint acaba de cambiar.</p></button><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">Mentoría y sponsor</p><p className="mt-1 text-xs leading-5 text-slate-500">No hay un canal persistente verificado para estas solicitudes en la plataforma QA. No se ofrece un envío simulado.</p></div></div></div></div>;
}

interface ContinuityOverviewProps { project: Project; core: AdaptiveInitiativeCore | null; state: LoadState; error?: string | null; onRetry: () => void; onOpenStep: (step: StepNumber) => void; }

export function ContinuityOverview({ project, core, state, error, onRetry, onOpenStep }: ContinuityOverviewProps) {
  const currentStep = (getAuthoritativeActiveStep(core) ?? project.currentStep ?? 0) as StepNumber;
  const challenge = core?.masterContext?.challengeSnapshot;
  const portfolioChallenge = (project as Project & { portfolioMeta?: Array<{ challenge?: { title?: string | null; name?: string | null } | null }> }).portfolioMeta?.[0]?.challenge;
  const mission = challenge?.title || challenge?.objective || portfolioChallenge?.title || portfolioChallenge?.name || project.description || 'No hay un reto padre recuperable en el contexto actual.';
  const missionSource = challenge ? 'Adaptive Core' : portfolioChallenge ? 'vínculo Portfolio / Handoff persistido' : project.description ? 'descripción de la iniciativa' : 'sin fuente recuperable';
  const currentMission = getStepMission(core, currentStep);
  return <section id="project-journey" aria-labelledby="continuity-title" className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-5 py-5 md:px-7 md:py-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Tu iniciativa</p><h2 id="continuity-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{project.name}</h2><p className="mt-3 text-sm font-semibold leading-6 text-slate-800">Reto: {mission}</p><p className="mt-1 text-xs text-slate-500">Fuente: {missionSource}</p></div><button type="button" onClick={() => onOpenStep(currentStep)} disabled={state !== 'loaded'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Continuar Step {currentStep} <ArrowRight aria-hidden="true" size={16} /></button></div></div>
    <div className="px-5 py-5 md:px-7">{state !== 'loaded' ? <div role={state === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-4 ${state === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{state === 'loading' ? 'Recuperando el recorrido persistido…' : error || 'No pudimos recuperar el recorrido persistido.'}</p>{state === 'error' ? <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold"><RefreshCw aria-hidden="true" size={14} /> Reintentar</button> : null}</div></div> : <>
      <div className="grid grid-cols-5 gap-1" aria-label={`Progreso de la iniciativa. Step actual ${currentStep}`}>{([0, 1, 2, 3, 4] as StepNumber[]).map(step => { const prior = step < currentStep; const active = step === currentStep; const output = getConfirmedStepOutput(core, step); return <button key={step} type="button" data-documentation={output ? 'confirmed-output' : prior ? 'progress-only' : active ? 'active' : 'future'} onClick={() => step <= currentStep && onOpenStep(step)} disabled={step > currentStep} className="group min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"><span className={`mb-2 block h-1.5 rounded-full ${output ? 'bg-emerald-500' : prior ? 'bg-amber-400' : active ? 'bg-indigo-600' : 'bg-slate-200'}`} /><span className={`block text-[11px] font-bold ${output ? 'text-emerald-700' : prior ? 'text-amber-700' : active ? 'text-indigo-700' : 'text-slate-500'}`}>Step {step}</span><span className="hidden truncate text-xs text-slate-600 sm:block">{STEP_NAMES[step]}</span><span className="sr-only">{output ? 'Resultado confirmado' : prior ? 'Anterior en el recorrido; resultado no documentado' : active ? 'Step operativo actual' : 'Step futuro'}</span></button>; })}</div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-700">Step actual: {currentStep}</span><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Ruta: {(currentMission.routeType ?? 'no informada').replaceAll('_', ' ')}</span><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Profundidad: {currentMission.depthLevel ?? 'no informada'}</span></div>
      {currentStep > 0 ? <div className="mt-6"><h3 className="text-sm font-bold text-slate-900">Resultados anteriores</h3><p className="mt-1 text-xs leading-5 text-slate-600">El progreso no sustituye un output confirmado.</p><div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200">{([0, 1, 2, 3, 4] as StepNumber[]).filter(step => step < currentStep).map(step => { const output = getConfirmedStepOutput(core, step); const resultMission = getStepMission(core, step); return <div key={step} className="p-4"><div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${output ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{output ? <CheckCircle2 aria-label="Resultado confirmado" size={18} /> : <AlertCircle aria-label="Resultado no documentado" size={18} />}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-950">Step {step} · {STEP_NAMES[step]}</p>{output ? <div className="mt-2"><ConfirmedOutputDetails output={output} title={resultMission.expectedOutput} /></div> : <><p className="mt-1 text-xs font-semibold text-amber-800">anterior en el recorrido · resultado no documentado</p><button type="button" onClick={() => onOpenStep(step)} className="mt-2 min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Consultar Step {step}</button></>}</div></div></div>; })}</div></div> : null}
    </>}</div>
  </section>;
}

interface HistoricalStepContinuityProps { projectName: string; step: 0 | 1; operationalStep: number; core: AdaptiveInitiativeCore | null; state: LoadState; error?: string | null; notice?: string | null; onRetry: () => void; onBack: () => void; onReturnOperational?: () => void; }

export function HistoricalStepContinuity({ projectName, step, operationalStep, core, state, error, notice, onRetry, onBack, onReturnOperational }: HistoricalStepContinuityProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const output = getConfirmedStepOutput(core, step);
  const mission = getStepMission(core, step);
  const outputConfigurationId = typeof output?.sourceConfigurationId === 'string' ? output.sourceConfigurationId : null;
  const outputConfiguration = outputConfigurationId
    ? core?.stepConfigurations.find(configuration => configuration.id === outputConfigurationId)
    : null;
  const outputTitle = outputConfiguration?.expectedOutput ?? mission.expectedOutput;
  return <main className="min-h-full overflow-y-auto bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-5xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onBack} className="min-h-11 rounded-lg px-2 text-sm text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">← Volver al proyecto</button><button type="button" onClick={() => setHelpOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><HelpCircle aria-hidden="true" size={16} /> Pedir ayuda</button></div><header className="border-b border-slate-200 pb-5" aria-labelledby={`historical-step-${step}`}><p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Histórico consultable · sólo lectura</p><h1 id={`historical-step-${step}`} className="mt-2 text-2xl font-bold text-slate-950">Histórico de Step {step}</h1><p className="mt-1 text-sm text-slate-600">{projectName}</p></header><section className="mt-5" aria-label={`Estado histórico de Step ${step}`}>
    {state === 'loading' ? <p role="status" className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">Recuperando el histórico persistido…</p> : null}{state === 'error' ? <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{error || 'No pudimos recuperar el histórico persistido.'}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg bg-white px-3 py-2 font-bold ring-1 ring-rose-200">Reintentar</button></div> : null}{notice ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{notice}</p> : null}
    {state === 'loaded' ? <><div data-testid={!output ? 'historical-no-output-notice' : undefined} className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><p className="text-sm font-bold text-amber-950">anterior en el recorrido · resultado {output ? 'confirmado disponible' : 'no documentado'}</p><p className="mt-1 text-sm leading-6 text-slate-700">La iniciativa está operativamente en Step {operationalStep}. Consultar este Step no lo reabre ni crea una sesión; tampoco confirma nada retroactivamente.</p>{!output ? <><p className="mt-3 text-sm font-bold text-amber-950">No existe un resultado canónico documentado para este Step</p><p className="mt-1 text-sm leading-6 text-amber-900">No se reconstruye desde progreso legacy, formularios antiguos ni conversación, y no se marca como confirmado.</p></> : null}{onReturnOperational ? <button type="button" onClick={onReturnOperational} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Volver a mi Step actual <ArrowRight aria-hidden="true" size={16} /></button> : null}</div>{output ? <div className="mt-5"><ConfirmedOutputDetails output={output} title={outputTitle} defaultOpen /></div> : null}</> : null}</section></div><StepHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} onRefresh={onRetry} /></main>;
}

interface ContinuityStepWorkspaceProps { projectName: string; step: StepNumber; core: AdaptiveInitiativeCore | null; state: LoadState; error?: string | null; readOnly?: boolean; onRetry: () => void; onBack: () => void; onContinueNext?: () => void; copilot?: ReactNode; children?: ReactNode; }

export function ContinuityStepWorkspace({ projectName, step, core, state, error, readOnly, onRetry, onBack, onContinueNext, copilot, children }: ContinuityStepWorkspaceProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const mission = useMemo(() => getStepMission(core, step), [core, step]);
  const output = useMemo(() => getConfirmedStepOutput(core, step), [core, step]);
  const operationalStep = getAuthoritativeActiveStep(core);
  const historical = operationalStep != null && operationalStep > step;
  const completed = Boolean(output) && (historical || step === 4);
  const resolved = historical || completed;
  const effectiveReadOnly = Boolean(readOnly || resolved);
  const checkpoint = core?.activeCheckpoint?.step === step ? core.activeCheckpoint : null;
  const officialRef = useRef<HTMLElement>(null);
  const reviewCheckpoint = checkpoint ? () => officialRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined;
  return <main className="min-h-full overflow-y-auto bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onBack} className="min-h-11 rounded-lg px-2 text-sm text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">← Volver al proyecto</button><button type="button" onClick={() => setHelpOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><HelpCircle aria-hidden="true" size={16} /> Pedir ayuda</button></div>
    <header className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 md:p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">{projectName} · Step {step}</p>{resolved ? <><h1 className="mt-2 text-2xl font-bold text-slate-950">{completed ? (step === 4 ? 'Paquete preparado para decisión' : `Step ${step} completado`) : `Step ${step} histórico`}</h1>{completed ? <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Confirmado</span> : null}</> : <h1 className="mt-2 text-2xl font-bold text-slate-950">{mission.visibleName}</h1>}{resolved ? <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">{completed ? (step === 4 ? 'El paquete confirmado prepara una recomendación; la decisión organizacional sigue requiriendo autoridad humana explícita.' : 'El resultado confirmado se muestra primero. La conversación queda disponible como contexto histórico de sólo lectura.') : `La iniciativa continúa operativamente en Step ${operationalStep}; consultar este Step no altera el recorrido.`}</p> : <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700"><strong>Objetivo:</strong> {mission.goal}</p>}{historical && onContinueNext ? <button type="button" onClick={onContinueNext} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">Continuar Step {operationalStep}<ArrowRight aria-hidden="true" size={16} /></button> : null}</header>
    {copilot ?? <div className="grid gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(18rem,1fr)]"><section aria-labelledby={`step-${step}-guide-title`} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 bg-slate-950 p-5 text-white md:p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">Guía de plataforma · no es un Copilot LLM</p><h2 id={`step-${step}-guide-title`} className="mt-2 text-xl font-bold">Trabaja con el contexto canónico</h2><p className="mt-2 text-sm leading-6 text-slate-300">La guía explica el trabajo del Step; sólo la revisión oficial puede confirmar respuestas, outputs o avance.</p></div><div className="p-5 md:p-6">
      {state === 'loading' ? <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">Recuperando contexto persistido…</div> : null}
      {state === 'error' ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5"><p className="font-bold text-rose-950">No pudimos recuperar el contexto</p><p className="mt-1 text-sm leading-6 text-rose-800">{error || 'Error de recuperación del Adaptive Core.'}</p><button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-rose-800 ring-1 ring-rose-200"><RefreshCw aria-hidden="true" size={14} /> Reintentar</button></div> : null}
      {state === 'loaded' ? <div className="space-y-4"><div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Misión del Step</p><p className="mt-1 text-sm leading-6 text-slate-800">{mission.goal}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Entregable esperado</p><p className="mt-1 text-sm leading-6 text-slate-800">{mission.expectedOutput}</p></div>{checkpoint ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-2"><ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-emerald-700" /><div><p className="text-sm font-bold text-emerald-950">{checkpoint.checkpointKey} · {checkpoint.status}</p><p className="mt-1 text-sm leading-6 text-emerald-900">Revisa las preguntas y gates en la superficie oficial. Esta guía no responde por ti.</p></div></div></div> : null}</div> : null}
    </div></section><StepProgressPanel core={core} step={step} onReviewCheckpoint={reviewCheckpoint} readOnly={effectiveReadOnly} resultFirst={completed} /></div>}
    {!resolved && checkpoint ? <section ref={officialRef} id="official-checkpoint-workspace" className="mt-5 scroll-mt-4" aria-labelledby="official-title"><div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Gobernanza</p><h2 id="official-title" className="mt-1 text-lg font-bold text-slate-950">Revisión oficial del checkpoint</h2><p className="mt-1 text-sm text-slate-600">Única superficie autorizada para confirmar respuestas y outputs. {effectiveReadOnly ? 'Tu acceso es de sólo lectura.' : 'Las confirmaciones requieren una acción humana explícita.'}</p></div>{children}</section> : null}
  </div><StepHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} onReviewCheckpoint={reviewCheckpoint} onRefresh={onRetry} /></main>;
}
