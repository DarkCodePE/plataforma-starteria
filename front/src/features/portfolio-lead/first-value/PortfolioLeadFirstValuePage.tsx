import React, { useEffect, useMemo, useState } from 'react';
import { usePortfolioHomeEntryContext } from '../../portfolio-entry/home/usePortfolioHomeEntryContext';
import { ArrowRight, Check, ChevronDown, ClipboardPaste, Sparkles } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../app/components/ui/card';
import { Textarea } from '../../../app/components/ui/textarea';
import { PortfolioCopilotDrawer } from '../../copilot';
import { NOVAGROWTH_EXPANDED_READING, NOVAGROWTH_EXPANDED_WORK_INPUT, NOVAGROWTH_READING, NOVAGROWTH_WORK_INPUT, analyzeNovaGrowth, type FirstValueReading } from './novaGrowthFixture';
import { trackPortfolioSetupEvent } from './prototypeInstrumentation';

type Stage = 'empty' | 'goal' | 'intent-review' | 'work' | 'work-refined' | 'processing' | 'processing-refined' | 'work-review' | 'value' | 'global-confirmation' | 'next-slice';
type RelationshipOverride = 'direct' | 'other-priority';
type ExceptionReviewState = { override?: RelationshipOverride; context?: string; deferred?: boolean };

const GUIDE = [
  'Define qué quieres conseguir',
  'Añade el trabajo que ya existe',
  'Revisa cómo se relaciona',
  'Confirma responsables',
  'Empieza a dar seguimiento',
];

const EMPTY_FIRST_VALUE_READING: FirstValueReading = {
  detectedGoal: 'el objetivo que compartiste',
  horizon: 'por concretar',
  initiatives: [],
  owners: [],
  groups: [],
  signals: [],
};

export function PortfolioLeadFirstValuePage({ firstName = '', continuationId = null }: { firstName?: string; continuationId?: string | null }) {
  const [stage, setStage] = useState<Stage>('empty');
  const [goal, setGoal] = useState('');
  const [work, setWork] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [reading, setReading] = useState<FirstValueReading | null>(null);
  const [clarification, setClarification] = useState('');
  const [clarificationDraft, setClarificationDraft] = useState('');
  const [exceptionReviewState, setExceptionReviewState] = useState<Record<string, ExceptionReviewState>>({});
  const [clarificationImpact, setClarificationImpact] = useState<{ initiativeIds: string[]; override: RelationshipOverride } | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const entryContext = usePortfolioHomeEntryContext(continuationId);

  const guideStep = stage === 'value' || stage === 'global-confirmation' || stage === 'next-slice' ? 2 : 1;
  const isSetup = stage !== 'empty';

  const startSetup = () => {
    trackPortfolioSetupEvent('portfolio_setup_started');
    const inheritedGoal = entryContext.data?.arrival.desiredOutcome || entryContext.data?.arrival.understoodNeed;
    const inheritedWork = entryContext.data?.arrival.existingWork;
    if (inheritedGoal) setGoal(inheritedGoal);
    if (inheritedWork) setWork(inheritedWork);
    setStage(inheritedGoal ? 'intent-review' : 'goal');
  };
  const useNovaGrowth = () => setWork(NOVAGROWTH_WORK_INPUT);
  const submitGoal = () => {
    if (goal.trim()) {
      trackPortfolioSetupEvent('portfolio_goal_submitted');
      setStage('intent-review');
    }
  };
  const processWork = (workToAnalyze = work) => {
    if (!workToAnalyze.trim()) return;
    trackPortfolioSetupEvent('portfolio_existing_work_submitted');
    setStage('processing-refined');
    window.setTimeout(() => {
      setReading(detectWorkForCheckpoint(goal, workToAnalyze));
      setStage('work-review');
    }, 250);
  };
  const confirmWork = () => {
    if (!work.trim() || work.includes('No tengo nada organizado')) {
      setReading({ ...EMPTY_FIRST_VALUE_READING, detectedGoal: goal || EMPTY_FIRST_VALUE_READING.detectedGoal });
      setStage('value');
      return;
    }
    setStage('processing-refined');
    window.setTimeout(() => {
      const detected = detectWorkForCheckpoint(goal, work);
      const analyzed = analyzeNovaGrowth(goal, work);
      const detectedIds = new Set(detected.initiatives.map(item => item.id));
      const groups = analyzed.groups.map(group => ({ ...group, initiativeIds: group.initiativeIds.filter(id => detectedIds.has(id)) })).filter(group => group.initiativeIds.length > 0);
      const signals = analyzed.signals.filter(signal => signal.id === 'distribution' || (signal.id === 'ownership' && detected.initiatives.some(item => !item.owner)) || (signal.id === 'dependency' && countDependencies(work) > 0));
      setReading({ ...analyzed, detectedGoal: detected.detectedGoal, initiatives: detected.initiatives, owners: detected.owners, groups, signals });
      setStage('value');
    }, 250);
  };
  const saveWorkCorrection = () => setReading(detectWorkForCheckpoint(goal, work));
  const saveGroupedClarification = (value: string, initiativeIds: string[]) => {
    setClarification(value);
    const override = classifyGroupedClarification(value);
    if (!override) {
      setClarificationImpact(null);
      return;
    }
    setExceptionReviewState(current => ({
      ...current,
      ...Object.fromEntries(initiativeIds.map(id => [id, { ...current[id], override }])),
    }));
    setClarificationImpact({ initiativeIds, override });
  };
  const updateExceptionReview = (initiativeId: string, update: ExceptionReviewState) => {
    setExceptionReviewState(current => ({ ...current, [initiativeId]: { ...current[initiativeId], ...update } }));
  };

  const readingToShow = useMemo(() => reading ?? NOVAGROWTH_READING, [reading]);

  useEffect(() => {
    if (stage === 'value') trackPortfolioSetupEvent('portfolio_first_value_rendered');
  }, [stage]);

  return (
    <div className="min-h-screen bg-[#f7f7f3] px-4 py-8 text-slate-950 sm:px-6 lg:px-10" data-testid="portfolio-lead-first-value">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Startería · Portfolio Lead</p>
            <p className="mt-2 text-sm text-slate-600">Tu espacio de trabajo</p>
          </div>
          {isSetup ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Preparando mi espacio</span> : null}
        </header>

        {stage === 'empty' ? <RefinedEmptyState firstName={firstName} onStart={startSetup} onOpenCopilot={() => setCopilotOpen(true)} entryContext={entryContext} /> : null}
        {isSetup && stage !== 'value' && stage !== 'next-slice' ? (
          <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
            <SetupGuide activeStep={guideStep} />
            <section aria-live="polite">
        {stage === 'goal' ? <RefinedGoalStep value={goal} additionalContext={additionalContext} onChange={setGoal} onAdditionalContextChange={setAdditionalContext} onContinue={submitGoal} /> : null}
              {stage === 'intent-review' ? <IntentCheckpoint goal={goal} additionalContext={additionalContext} onAdjust={() => setStage('goal')} onContinue={() => setStage('work-refined')} /> : null}
              {stage === 'work' ? <ExistingWorkStep value={work} onChange={setWork} onUseFixture={useNovaGrowth} onUseExpandedFixture={() => setWork(NOVAGROWTH_EXPANDED_WORK_INPUT)} onProcess={processWork} onContinueWithoutWork={() => { setWork('No tengo nada organizado todavía.'); window.setTimeout(processWork, 0); }} /> : null}
              {stage === 'work-refined' ? <RefinedExistingWorkStep value={work} inherited={Boolean(entryContext.data?.arrival.existingWork)} onChange={setWork} onUseFixture={useNovaGrowth} onUseExpandedFixture={() => setWork(NOVAGROWTH_EXPANDED_WORK_INPUT)} onProcess={() => processWork()} onContinueWithoutWork={() => { const emptyWork = 'No tengo nada organizado todavía.'; setWork(emptyWork); processWork(emptyWork); }} /> : null}
              {stage === 'processing-refined' ? <RefinedProcessingState /> : null}
              {stage === 'work-review' && reading ? <WorkCheckpoint reading={reading} work={work} dependencies={countDependencies(work)} onChangeWork={setWork} onAdjust={() => setStage('work-refined')} onConfirm={confirmWork} onSave={saveWorkCorrection} /> : null}
              {stage === 'processing' ? <ProcessingState /> : null}
            </section>
          </div>
        ) : null}
        {stage === 'value' ? (
          <div className="space-y-8" aria-live="polite">
            <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
              <SetupGuide activeStep={guideStep} />
              <RefinedFirstValue reading={readingToShow} clarification={clarification} clarificationDraft={clarificationDraft} exceptionReviewState={exceptionReviewState} clarificationImpact={clarificationImpact} onClarificationDraftChange={setClarificationDraft} onSaveClarification={saveGroupedClarification} onSkipClarification={() => setClarificationDraft('')} onUpdateException={updateExceptionReview} onReview={() => { trackPortfolioSetupEvent('portfolio_relationship_review_clicked'); setStage('global-confirmation'); }} onCorrect={() => { trackPortfolioSetupEvent('portfolio_interpretation_corrected'); setStage('goal'); }} />
            </div>
          </div>
        ) : null}
        {stage === 'next-slice' ? <NextSliceBoundary onBack={() => setStage('value')} /> : null}
        {stage === 'global-confirmation' ? <GlobalReadingConfirmation reading={readingToShow} clarification={clarification} exceptionReviewState={exceptionReviewState} onConfirm={() => setStage('next-slice')} onAdjust={() => setStage('value')} /> : null}
      </div>
      <PortfolioCopilotDrawer open={copilotOpen} onOpenChange={setCopilotOpen} setupMode />
    </div>
  );
}

function EmptyState({ firstName, onStart, onOpenCopilot, entryContext }: { firstName: string; onStart: () => void; onOpenCopilot: () => void; entryContext: ReturnType<typeof usePortfolioHomeEntryContext> }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-14 shadow-sm sm:px-12" data-testid="first-visit-empty">
      <div className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold text-amber-700">Primera visita</p>
        <p className="text-base font-medium text-slate-700">Hola{firstName ? `, ${firstName}` : ''}.</p>
        <p className="mt-1 text-sm text-slate-500">Bienvenida a Startería.</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Organiza tus iniciativas alrededor de lo que quieres conseguir.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Empieza por lo que quieres conseguir. Después puedes incorporar las iniciativas y el trabajo que ya tienes.</p>
        {entryContext.status === 'loading' ? <p className="mt-5 text-sm text-slate-500" role="status">Recuperando el contexto que compartiste al entrar...</p> : null}
        {entryContext.status === 'ready' && entryContext.data ? <EntryContextSummary context={entryContext.data} /> : null}
        <Button className="mt-8" size="lg" onClick={onStart}>Preparar mi espacio <ArrowRight /></Button>
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Tu guía</p>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            {GUIDE.map((step) => <li key={step} className="flex items-center gap-2"><span className="text-slate-400">○</span>{step}</li>)}
          </ol>
        </div>
        <button type="button" onClick={onOpenCopilot} className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"><Sparkles size={16} /> Preguntar a Startería</button>
      </div>
    </section>
  );
}

function EntryContextSummary({ context }: { context: NonNullable<ReturnType<typeof usePortfolioHomeEntryContext>['data']> }) {
  const items = [context.arrival.understoodNeed, context.arrival.desiredOutcome, ...context.arrival.confirmedContext]
    .filter((item): item is string => Boolean(item));
  return (
    <section className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4" data-testid="portfolio-entry-setup-context">
      <p className="text-sm font-semibold text-slate-900">Trajimos el contexto que compartiste al entrar.</p>
      {items.length > 0 ? <ul className="mt-2 space-y-1 text-sm text-slate-700">{items.slice(0, 4).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Lo revisaremos contigo durante la preparación.</p>}
      <p className="mt-3 text-xs text-slate-500">Fuente: información compartida anteriormente · Startería no ha añadido datos nuevos.</p>
    </section>
  );
}

function SetupGuide({ activeStep }: { activeStep: number }) {
  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Tu guía de inicio" data-testid="setup-guide">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tu guía de inicio · {activeStep} de 5</p>
      <ol className="mt-5 space-y-4">
        {GUIDE.map((item, index) => {
          const complete = index < activeStep;
          return <li key={item} className="flex items-start gap-3 text-sm text-slate-700"><span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${complete ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 text-slate-400'}`}>{complete ? <Check size={12} /> : '○'}</span><span>{item}</span></li>;
        })}
      </ol>
    </aside>
  );
}

function GoalStep({ value, onChange, onContinue }: { value: string; onChange: (value: string) => void; onContinue: () => void }) {
  return <Card data-testid="goal-step"><CardHeader><p className="text-sm font-semibold text-amber-700">Paso 1 · Intención estratégica</p><h1 className="text-2xl font-semibold tracking-tight">¿Qué quieres conseguir o tener bajo control?</h1><CardDescription>Cuéntalo con tus palabras. No necesitas preparar un KPI ni una estructura antes de empezar.</CardDescription></CardHeader><CardContent><label htmlFor="portfolio-goal" className="sr-only">Qué quieres conseguir o tener bajo control</label><Textarea id="portfolio-goal" value={value} onChange={event => onChange(event.target.value)} placeholder="Dirección quiere conseguir 200 nuevas ventas B2B este trimestre..." rows={7} /><div className="mt-5 flex justify-end"><Button onClick={onContinue} disabled={!value.trim()}>Continuar <ArrowRight /></Button></div></CardContent></Card>;
}

function ExistingWorkStep({ value, onChange, onUseFixture, onUseExpandedFixture, onProcess }: { value: string; onChange: (value: string) => void; onUseFixture: () => void; onUseExpandedFixture: () => void; onProcess: () => void; onContinueWithoutWork?: () => void }) {
  return <Card data-testid="existing-work-step"><CardHeader><p className="text-sm font-semibold text-amber-700">Paso 2 · Contexto existente</p><h1 className="text-2xl font-semibold tracking-tight">Ahora añade el trabajo que ya existe relacionado con esto.</h1><CardDescription>No necesitas ordenarlo antes. Puedes pegar texto desordenado y Startería lo organizará para una primera lectura.</CardDescription></CardHeader><CardContent><label htmlFor="portfolio-existing-work" className="text-sm font-semibold text-slate-800">Pegar información</label><Textarea id="portfolio-existing-work" className="mt-2" value={value} onChange={event => onChange(event.target.value)} placeholder="Nombres de iniciativas, responsables, notas, dependencias..." rows={9} /><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" onClick={onUseFixture} data-testid="use-novagrowth-fixture"><Sparkles />Usar ejemplo NovaGrowth</Button><div className="inline-flex items-center gap-2 rounded-ds-sm border border-border-default bg-surface-default px-3 py-2 text-sm text-text-muted" role="note" aria-describedby="upload-not-available"><ClipboardPaste /><span>Subir información</span></div><span id="upload-not-available" className="text-xs text-slate-500">No disponible durante esta prueba.</span><button type="button" className="text-xs font-semibold text-slate-500 underline underline-offset-4" onClick={onUseExpandedFixture} data-testid="use-novagrowth-expanded-fixture">Usar NovaGrowthExpanded (dev/test)</button></div><div className="mt-6 flex justify-end"><Button onClick={onProcess} disabled={!value.trim()} data-testid="process-existing-work">Ayúdame a ordenar esto <ArrowRight /></Button></div></CardContent></Card>;
}

function ProcessingState() {
  return <Card data-testid="processing-state" aria-live="polite"><CardHeader><p className="text-sm font-semibold text-amber-700">Procesando contexto</p><h1 className="text-2xl font-semibold tracking-tight">Startería está organizando tu contexto</h1><CardDescription>Esta lectura es una simulación determinista del prototipo.</CardDescription></CardHeader><CardContent><div className="space-y-3 text-sm text-slate-700">{['Entendiendo qué quieres conseguir', 'Identificando trabajo existente', 'Buscando relaciones entre iniciativas', 'Detectando información por revisar', 'Preparando una primera lectura'].map(item => <div key={item} className="flex items-center gap-3"><span className="size-2 rounded-full bg-amber-500" />{item}</div>)}</div></CardContent></Card>;
}

function FirstValue({ reading, onReview, onCorrect }: { reading: FirstValueReading; onReview: () => void; onCorrect: () => void }) {
  const [openRationale, setOpenRationale] = useState<string | null>(null);
  const showInventory = reading.initiatives.length <= 7;
  const openRationaleFor = (groupId: string) => {
    const opening = openRationale !== groupId;
    if (opening) trackPortfolioSetupEvent('portfolio_rationale_opened');
    setOpenRationale(opening ? groupId : null);
  };
  const groupCountLabel = reading.groups.length === 3 ? 'tres' : String(reading.groups.length);
  return <section className="space-y-6" data-testid="first-analytical-value"><div><p className="text-sm font-semibold text-amber-700">First Analytical Value</p><h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">Lo que entendió Startería</h1><p className="mt-3 max-w-3xl text-lg leading-8 text-slate-700">Quieres entender cómo el trabajo existente está ayudando a conseguir <strong>{reading.detectedGoal}</strong> durante <strong>{reading.horizon}</strong> y dónde necesitas intervenir.</p><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Declarado por ti</p><p className="mt-1 text-sm text-slate-500">Meta interpretada a partir de lo que escribiste.</p></div><Card className="border-amber-200 bg-amber-50/50"><CardHeader><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Lectura Startería</p><CardTitle className="text-2xl">Parece haber {groupCountLabel} formas principales en las que el trabajo está intentando mover el objetivo.</CardTitle><CardDescription>Propuesta Startería · no es una estructura confirmada</CardDescription></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3">{reading.groups.map(group => <Card key={group.id} className="bg-white"><CardHeader className="p-5"><CardTitle className="text-base">{group.label}</CardTitle><CardDescription>{group.initiativeIds.length} iniciativas</CardDescription></CardHeader><CardContent className="p-5 pt-0"><p className="text-sm text-slate-600">{group.initiativeIds.slice(0, 5).map(id => reading.initiatives.find(item => item.id === id)?.name).join(' · ')}{group.initiativeIds.length > 5 ? ' · …' : ''}</p><button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-800 underline underline-offset-4" onClick={() => openRationaleFor(group.id)} aria-expanded={openRationale === group.id}>¿Por qué? <ChevronDown size={15} /></button>{openRationale === group.id ? <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600" data-testid={`rationale-${group.id}`}>{group.rationale}<span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lectura Startería · basada en lo que añadiste</span></p> : null}</CardContent></Card>)}</div></CardContent></Card><div className="grid gap-6 lg:grid-cols-[1fr_280px]"><Card><CardHeader><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Encontrado en tu información</p><CardTitle className="text-xl">Contexto detectado</CardTitle><CardDescription>Señales y resumen extraídos de lo que añadiste.</CardDescription></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meta detectada</dt><dd className="mt-1 font-semibold">{reading.detectedGoal} · {reading.horizon}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trabajo detectado</dt><dd className="mt-1 font-semibold" data-testid="initiative-count">{reading.initiatives.length} iniciativas</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsables mencionados</dt><dd className="mt-1 font-semibold" data-testid="owner-count">{reading.owners.length}</dd></div></dl><p className="mt-5 text-sm text-slate-600">Por revisar: <strong>2</strong></p></CardContent></Card><Card><CardHeader><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Encontrado en tu información</p><CardTitle className="text-xl">Qué merece revisar</CardTitle><CardDescription>Máximo tres señales iniciales.</CardDescription></CardHeader><CardContent className="space-y-4" data-testid="review-signals">{reading.signals.slice(0, 3).map(signal => <div key={signal.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-sm font-semibold">{signal.label}</p><p className="mt-1 text-sm leading-6 text-slate-600">{signal.detail}</p></div>)}</CardContent></Card></div>{showInventory ? <Card><CardHeader><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Encontrado en tu información</p><CardTitle className="text-xl">Trabajo detectado</CardTitle><CardDescription>Inventario de apoyo · no sustituye la lectura.</CardDescription></CardHeader><CardContent><ul className="grid gap-3 sm:grid-cols-2">{reading.initiatives.map(item => <li key={item.id} className="rounded-lg border border-slate-200 p-3"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p><p className="mt-2 text-xs text-slate-500">{item.owner ? `Responsable mencionado: ${item.owner}` : 'Sin owner claro'} · Encontrado en la información</p></li>)}</ul></CardContent></Card> : <Card data-testid="expanded-inventory-summary"><CardHeader><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Encontrado en tu información</p><CardTitle className="text-xl">Trabajo detectado</CardTitle><CardDescription>Resumen compacto para no convertir First Value en un inventario.</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">Se han detectado <strong>{reading.initiatives.length} iniciativas</strong>. El detalle se podrá explorar en una revisión posterior.</p></CardContent></Card>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6"><Button variant="outline" onClick={onCorrect}>Corregir lo que entendió Startería</Button><Button onClick={onReview} data-testid="relationship-review-cta">Revisar cómo se relaciona <ArrowRight /></Button></div></section>;
}

function NextSlicePlaceholder({ onBack }: { onBack: () => void }) {
  return <section className="mx-auto max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm" data-testid="next-slice-placeholder"><p className="text-sm font-semibold text-amber-700">NEXT_SLICE_PLACEHOLDER</p><h1 className="mt-3 text-3xl font-semibold">La revisión de relaciones pertenece al siguiente slice.</h1><p className="mt-4 text-slate-600">Slice A termina aquí. No se han implementado aún la Relationship Review, ownership ni monitoring.</p><Button className="mt-8" variant="outline" onClick={onBack}>Volver a la primera lectura</Button></section>;
}

function RefinedEmptyState({ firstName, onStart, onOpenCopilot, entryContext }: { firstName: string; onStart: () => void; onOpenCopilot: () => void; entryContext: ReturnType<typeof usePortfolioHomeEntryContext> }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-14 shadow-sm sm:px-12" data-testid="first-visit-empty">
      <div className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold text-amber-700">Primera visita</p>
        <p className="text-base font-medium text-slate-700">Hola{firstName ? `, ${firstName}` : ''}.</p>
        <p className="mt-1 text-sm text-slate-500">Bienvenido/a a Startería.</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Organiza tus iniciativas alrededor de lo que quieres conseguir.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Empieza por lo que quieres conseguir. Después puedes incorporar las iniciativas y el trabajo que ya tienes.</p>
        {entryContext.status === 'loading' ? <p className="mt-5 text-sm text-slate-500" role="status">Recuperando el contexto que compartiste al entrar...</p> : null}
        {entryContext.status === 'ready' && entryContext.data ? <EntryContextSummary context={entryContext.data} /> : null}
        <Button className="mt-8" size="lg" onClick={onStart}>Preparar mi espacio <ArrowRight /></Button>
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Tu guía</p>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            {GUIDE.map((step) => <li key={step} className="flex items-center gap-2"><span className="text-slate-400">○</span>{step}</li>)}
          </ol>
        </div>
        <button type="button" onClick={onOpenCopilot} className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950" data-testid="setup-copilot-entry">
          <Sparkles size={16} /> ¿No sabes por dónde empezar? <span className="underline underline-offset-4">Ayúdame a definir qué quiero conseguir</span>
        </button>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Te haré algunas preguntas para ayudarte a aclarar qué quieres conseguir y con qué información conviene empezar.</p>
      </div>
    </section>
  );
}

function RefinedGoalStep({ value, additionalContext, onChange, onAdditionalContextChange, onContinue }: { value: string; additionalContext: string; onChange: (value: string) => void; onAdditionalContextChange: (value: string) => void; onContinue: () => void }) {
  return (
    <Card data-testid="goal-step">
      <CardHeader>
        <p className="text-sm font-semibold text-amber-700">Paso 1 · Intención</p>
        <h1 className="text-2xl font-semibold tracking-tight">¿Qué quieres conseguir o tener bajo control?</h1>
        <CardDescription>Cuéntalo con tus palabras. No necesitas preparar un KPI ni una estructura antes de empezar.</CardDescription>
      </CardHeader>
      <CardContent>
        <label htmlFor="portfolio-goal" className="sr-only">Qué quieres conseguir o tener bajo control</label>
        <Textarea id="portfolio-goal" value={value} onChange={event => onChange(event.target.value)} placeholder="Dirección quiere conseguir 200 nuevas ventas B2B este trimestre..." rows={7} />
        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="adaptive-context-checkpoint">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">¿Quieres darme un poco más de contexto? <span className="font-normal text-slate-500">(opcional)</span></summary>
          <p className="mt-3 text-sm leading-6 text-slate-600">Si ya lo sabes, puedes contarme por ejemplo:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600"><li>de qué producto, área o proceso hablamos;</li><li>desde qué situación partes;</li><li>qué áreas están involucradas.</li></ul>
          <p className="mt-3 text-sm leading-6 text-slate-600">No necesitas tener todas las respuestas para continuar.</p>
          <label htmlFor="portfolio-additional-context" className="mt-4 block text-sm font-semibold text-slate-800">Contexto concreto (opcional)</label>
          <Textarea id="portfolio-additional-context" className="mt-2" value={additionalContext} onChange={event => onAdditionalContextChange(event.target.value)} placeholder="Añade solo lo que pueda cambiar la interpretación..." rows={3} />
        </details>
        <div className="mt-5 flex justify-end"><Button onClick={onContinue} disabled={!value.trim()}>Continuar <ArrowRight /></Button></div>
      </CardContent>
    </Card>
  );
}

function RefinedExistingWorkStep({ value, inherited, onChange, onUseFixture, onUseExpandedFixture, onProcess, onContinueWithoutWork }: { value: string; inherited: boolean; onChange: (value: string) => void; onUseFixture: () => void; onUseExpandedFixture: () => void; onProcess: () => void; onContinueWithoutWork: () => void }) {
  return (
    <Card data-testid="existing-work-step">
      <CardHeader>
        <p className="text-sm font-semibold text-amber-700">Paso 2 · Lo que ya existe</p>
        <h1 className="text-2xl font-semibold tracking-tight">Añade lo que ya existe alrededor de este objetivo</h1>
        <CardDescription>Puedes pegar una lista de iniciativas, notas de seguimiento, proyectos, responsables o cualquier información que ya uses. No tiene que estar ordenada.</CardDescription>
      </CardHeader>
      <CardContent>
        {inherited ? <p className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm leading-6 text-slate-700" data-testid="inherited-work-context">Ya encontramos parte del trabajo relacionado. Puedes revisarlo, añadir más información o continuar.</p> : null}
        <p className="text-sm font-semibold text-slate-800">Puedes incluir:</p>
        <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2"><li>· iniciativas o proyectos</li><li>· responsables</li><li>· notas de avance</li><li>· bloqueos o dependencias</li><li>· extractos de reportes</li></ul>
        <label htmlFor="portfolio-existing-work" className="mt-5 block text-sm font-semibold text-slate-800">Pegar o escribir lo que ya tienes</label>
        <Textarea id="portfolio-existing-work" className="mt-2" value={value} onChange={event => onChange(event.target.value)} placeholder="Pega aquí lo que ya utilizas para hacer seguimiento..." rows={9} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={onUseFixture} data-testid="use-novagrowth-fixture"><Sparkles />Usar ejemplo NovaGrowth</Button>
          <span className="inline-flex items-center rounded-ds-sm border border-border-default bg-surface-default px-3 py-2 text-sm text-text-muted" role="note">Subir archivo — Disponible próximamente</span>
          <button type="button" className="sr-only" onClick={onUseExpandedFixture} data-testid="use-novagrowth-expanded-fixture" aria-label="Cargar ejemplo ampliado">Cargar ejemplo ampliado</button>
        </div>
        <button type="button" onClick={onContinueWithoutWork} className="mt-4 text-sm font-semibold text-slate-600 underline underline-offset-4">No tengo nada organizado todavía</button>
        <div className="mt-6 flex justify-end"><Button onClick={onProcess} disabled={!value.trim()} data-testid="process-existing-work">Ayúdame a ordenar esto <ArrowRight /></Button></div>
      </CardContent>
    </Card>
  );
}

type RelationshipState = 'Relación clara' | 'Relación probable' | 'Por revisar' | 'Posible mejor encaje' | 'Sin contexto suficiente';

function relationshipFor(id: string, description: string): RelationshipState {
  if (id.includes('pricing') || description.toLowerCase().includes('pricing')) return 'Posible mejor encaje';
  if (id.includes('checkout') || id.includes('partner')) return 'Relación probable';
  if (id.startsWith('detected-')) return 'Sin contexto suficiente';
  if (!description.trim()) return 'Sin contexto suficiente';
  if (id.includes('retargeting') || id.includes('enablement')) return 'Por revisar';
  return 'Relación clara';
}

function classifyGroupedClarification(text: string): RelationshipOverride | null {
  if (/\b(?:todas|todos|las\s+tres|los\s+tres)\b.*\b(?:pertenecen|responden|son)\b.*\b(?:otra prioridad|prioridad distinta)\b/i.test(text)) return 'other-priority';
  if (/\b(?:todas|todos|las\s+tres|los\s+tres)\b.*\b(?:forman parte del (?:mismo )?objetivo|pertenecen al objetivo)\b/i.test(text)) return 'direct';
  return null;
}

function relationshipForSession(item: FirstValueReading['initiatives'][number], reviewState: ExceptionReviewState = {}): RelationshipState {
  if (reviewState.override === 'direct') return 'Relación clara';
  if (reviewState.override === 'other-priority') return 'Posible mejor encaje';
  return relationshipFor(item.id, `${item.name} ${item.description}`);
}

function relationshipExplanation(state: RelationshipState, name: string) {
  if (state === 'Posible mejor encaje') return `${name} puede contribuir al objetivo actual, pero parece responder más directamente a una necesidad de pricing o monetización.`;
  if (state === 'Relación probable') return 'La información disponible apunta a una contribución, aunque conviene confirmar el vínculo con el objetivo.';
  if (state === 'Por revisar') return 'Hay una conexión posible, pero hace falta revisar alcance, dependencia o responsabilidad.';
  if (state === 'Sin contexto suficiente') return 'Todavía no hay información suficiente para interpretar su relación.';
  return 'La información compartida describe una contribución directa al objetivo.';
}

function relationshipLabel(state: RelationshipState) {
  if (state === 'Relación clara') return 'Contribuye directamente';
  if (state === 'Posible mejor encaje') return 'Podría responder mejor a otra prioridad';
  return 'Necesita más contexto';
}

function signalWhy(signalId: string) {
  if (signalId.includes('concentration')) return 'Importa porque una parte relevante del trabajo puede depender de pocas iniciativas.';
  if (signalId.includes('owner')) return 'Importa porque una responsabilidad poco clara puede dificultar el seguimiento.';
  return 'Importa porque una dependencia puede afectar el avance aunque las iniciativas parezcan cubiertas.';
}

function RefinedProcessingState() {
  return <Card data-testid="processing-state" aria-live="polite"><CardHeader><p className="text-sm font-semibold text-amber-700">Preparando una primera lectura</p><h1 className="text-2xl font-semibold tracking-tight">Estoy ordenando lo que compartiste</h1><CardDescription>Estamos identificando el objetivo, el trabajo existente y lo que conviene revisar.</CardDescription></CardHeader><CardContent><div className="space-y-3 text-sm text-slate-700">{['Entendiendo qué quieres conseguir', 'Identificando el trabajo existente', 'Buscando relaciones que conviene revisar'].map(item => <div key={item} className="flex items-center gap-3"><span className="size-2 rounded-full bg-amber-500" />{item}</div>)}</div></CardContent></Card>;
}

function detectWorkForCheckpoint(goal: string, workInput: string): FirstValueReading {
  if (workInput.includes('No tengo nada organizado')) return { ...EMPTY_FIRST_VALUE_READING, detectedGoal: goal || EMPTY_FIRST_VALUE_READING.detectedGoal };
  const fixture = workInput.includes('NovaGrowthExpanded') ? NOVAGROWTH_EXPANDED_READING : NOVAGROWTH_READING;
  const originalWork = workInput.includes('NovaGrowthExpanded') ? NOVAGROWTH_EXPANDED_WORK_INPUT : NOVAGROWTH_WORK_INPUT;
  const initiatives: FirstValueReading['initiatives'] = [];
  const lines = workInput.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const known = fixture.initiatives.find(item => trimmed.startsWith(item.name));
    const parsedName = trimmed.match(/^(.+?)\s+[—–-]\s+(.+)$/)?.[1]?.trim();
    const name = known?.name ?? (parsedName && !/^(NovaGrowthExpanded|NovaGrowth)$/i.test(parsedName) ? parsedName : undefined);
    if (!name || initiatives.some(item => item.name === name)) continue;
    const ownerText = trimmed.match(/\.\s*([^.!?]+)\.$/)?.[1]?.trim();
    const originalLine = originalWork.split(/\r?\n/).find(original => original.trim().startsWith(name));
    const unchanged = trimmed === originalLine?.trim();
    const owner = unchanged ? known?.owner : /sin (?:owner|responsable)/i.test(ownerText ?? '') ? undefined : ownerText || known?.owner;
    initiatives.push({ id: known?.id ?? `detected-${initiatives.length + 1}`, name, description: known?.description ?? trimmed.slice(name.length).replace(/^\s*[—–-]\s*/, '').trim(), ...(owner ? { owner } : {}) });
  }
  return { ...fixture, detectedGoal: goal || fixture.detectedGoal, groups: [], signals: [], initiatives, owners: [...new Set(initiatives.flatMap(item => item.owner ? [item.owner] : []))] };
}

function countDependencies(workInput: string) {
  return workInput.split(/\r?\n/).filter(line => /depend|espera acceso|bloquead/i.test(line)).length;
}

function RefinedFirstValue({ reading, clarification, clarificationDraft, exceptionReviewState, clarificationImpact, onClarificationDraftChange, onSaveClarification, onSkipClarification, onUpdateException, onReview, onCorrect }: { reading: FirstValueReading; clarification: string; clarificationDraft: string; exceptionReviewState: Record<string, ExceptionReviewState>; clarificationImpact: { initiativeIds: string[]; override: RelationshipOverride } | null; onClarificationDraftChange: (value: string) => void; onSaveClarification: (value: string, initiativeIds: string[]) => void; onSkipClarification: () => void; onUpdateException: (id: string, update: ExceptionReviewState) => void; onReview: () => void; onCorrect: () => void }) {
  const [openRationale, setOpenRationale] = useState<string | null>(null);
  const [showAllInitiatives, setShowAllInitiatives] = useState(false);
  const [showExceptionReview, setShowExceptionReview] = useState(false);
  const relationship = (item: FirstValueReading['initiatives'][number]) => relationshipForSession(item, exceptionReviewState[item.id]);
  const exceptions = reading.initiatives.filter(item => relationship(item) !== 'Relación clara');
  const clearCount = reading.initiatives.length - exceptions.length;
  const initiativeRows = showAllInitiatives ? reading.initiatives : showExceptionReview ? exceptions : [];
  return (
    <section className="space-y-6" data-testid="first-value-narrative">
      {clarificationImpact ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" data-testid="clarification-impact">La aclaración actualizó la lectura de {clarificationImpact.initiativeIds.map(id => reading.initiatives.find(item => item.id === id)?.name).filter(Boolean).join(', ')}.</p> : null}
      <div><h1 className="max-w-3xl text-3xl font-semibold tracking-tight">Esto es lo que entendí</h1><p className="mt-3 max-w-3xl text-lg leading-8 text-slate-700">A partir de lo que compartiste, esta es una primera lectura de tu objetivo y del trabajo que ya existe.</p><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Basado en lo que compartiste</p></div>
      <Card><CardHeader><CardTitle className="text-xl">Contexto</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objetivo</dt><dd className="mt-1 font-semibold">{reading.detectedGoal}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horizonte</dt><dd className="mt-1 font-semibold">{reading.horizon}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto</dt><dd className="mt-1 text-sm leading-6 text-slate-700">El trabajo actual parece cubrir generación, seguimiento y conversión comercial.</dd></div></dl><p className="mt-4 text-sm text-slate-600" data-testid="initiative-count">{reading.initiatives.length} iniciativas detectadas</p>{clarification ? <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950" data-testid="reading-clarification"><strong>Tu aclaración:</strong> {clarification}</p> : null}</CardContent></Card>
      <Card className="border-amber-200 bg-amber-50/50"><CardHeader><CardTitle className="text-2xl">Así parece repartirse el trabajo</CardTitle><CardDescription>Esta es una propuesta de Startería. Puedes revisarla antes de convertirla en estructura del portafolio.</CardDescription></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3">{reading.groups.map(group => <Card key={group.id} className="bg-white"><CardHeader className="p-5"><CardTitle className="text-base">{group.label}</CardTitle><CardDescription>{group.initiativeIds.length} iniciativas</CardDescription></CardHeader><CardContent className="p-5 pt-0"><p className="text-sm text-slate-600">{group.initiativeIds.slice(0, 5).map(id => reading.initiatives.find(item => item.id === id)?.name).join(' · ')}{group.initiativeIds.length > 5 ? ' · …' : ''}</p><button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-800 underline underline-offset-4" onClick={() => setOpenRationale(openRationale === group.id ? null : group.id)} aria-expanded={openRationale === group.id}>¿Por qué las agrupé así? <ChevronDown size={15} /></button>{openRationale === group.id ? <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600" data-testid={`rationale-${group.id}`}>{group.rationale}</p> : null}</CardContent></Card>)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-xl">Qué merece revisar</CardTitle><CardDescription>Hasta tres señales para que puedas decidir qué mirar primero.</CardDescription></CardHeader><CardContent className="space-y-4" data-testid="review-signals">{reading.signals.slice(0, 3).map(signal => <div key={signal.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-sm font-semibold">{signal.label}</p><p className="mt-1 text-sm leading-6 text-slate-600">{signal.detail}</p><p className="mt-2 text-sm leading-6 text-slate-600"><strong>Por qué importa:</strong> {signalWhy(signal.id)}</p><p className="mt-1 text-sm leading-6 text-slate-600"><strong>Qué revisar:</strong> confirma el alcance y la responsabilidad antes de tomar una decisión.</p></div>)}</CardContent></Card>
      {exceptions.length > 1 ? <Card data-testid="post-analysis-question"><CardHeader><CardTitle className="text-xl">Tengo una duda sobre {exceptions.length} iniciativas</CardTitle><CardDescription>Una respuesta puede aclarar varias iniciativas a la vez.</CardDescription></CardHeader><CardContent><ul className="mb-3 list-inside list-disc text-sm text-slate-700">{exceptions.map(item => <li key={item.id}>{item.name}</li>)}</ul><p className="text-sm leading-6 text-slate-700">{exceptions.map(item => item.name).join(', ')}: ¿forman parte del mismo objetivo o alguna pertenece a otra prioridad?</p><label htmlFor="portfolio-clarification" className="mt-4 block text-sm font-semibold">Tu aclaración</label><Textarea id="portfolio-clarification" className="mt-2" value={clarificationDraft} onChange={event => onClarificationDraftChange(event.target.value)} placeholder="Escribe tu respuesta..." rows={3} /><div className="mt-3 flex flex-wrap gap-3"><Button disabled={!clarificationDraft.trim()} onClick={() => onSaveClarification(clarificationDraft.trim(), exceptions.map(item => item.id))}>Guardar aclaración</Button><Button variant="outline" onClick={onSkipClarification}>Continuar sin responder</Button></div>{clarification ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Aclaración incorporada a esta lectura: {clarification}</p> : null}{clarificationImpact ? <p className="mt-3 text-sm text-slate-700" data-testid="clarification-impact">La aclaración actualizó la lectura de {clarificationImpact.initiativeIds.map(id => reading.initiatives.find(item => item.id === id)?.name).filter(Boolean).join(', ')}.</p> : null}</CardContent></Card> : null}
      <Card data-testid="relationship-summary"><CardHeader><CardTitle className="text-xl">Cómo se relaciona el trabajo con el objetivo</CardTitle><CardDescription>Resumen primero; el detalle aparece cuando lo necesitas.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><SummaryMetric label="Contribuyen directamente" value={clearCount} /><SummaryMetric label="Necesitan más contexto" value={exceptions.filter(item => ['Por revisar', 'Sin contexto suficiente', 'Relación probable'].includes(relationship(item))).length} /><SummaryMetric label="Podrían responder mejor a otra prioridad" value={exceptions.filter(item => relationship(item) === 'Posible mejor encaje').length} /></div><p className="mt-4 text-sm leading-6 text-slate-600">{reading.initiatives.length} iniciativas analizadas. Las que contribuyen directamente no requieren acción individual.</p>{exceptions.length > 0 ? <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => { setShowExceptionReview(true); setShowAllInitiatives(false); }} data-testid="review-exceptions-cta">Revisar excepciones ({exceptions.length})</Button><Button variant="outline" onClick={() => setShowAllInitiatives(true)}>Ver las {reading.initiatives.length} iniciativas</Button></div> : null}</CardContent></Card>
      {(showAllInitiatives || showExceptionReview) ? <Card data-testid="exception-review"><CardHeader><CardTitle className="text-xl">{showAllInitiatives ? 'Detalle de iniciativas' : 'Excepciones que necesitan atención'}</CardTitle><CardDescription>{showAllInitiatives ? 'Vista completa bajo demanda.' : 'Revisión inline de las iniciativas que necesitan contexto.'}</CardDescription></CardHeader><CardContent><ul className="grid gap-3">{initiativeRows.map(item => { const state = relationship(item); return <ExceptionReviewRow key={item.id} item={item} state={state} reviewState={exceptionReviewState[item.id] ?? {}} showActions={showExceptionReview && !showAllInitiatives} onUpdate={update => onUpdateException(item.id, update)} />; })}</ul>{initiativeRows.length === 0 ? <p className="text-sm text-slate-600">No hay excepciones que revisar ahora.</p> : null}</CardContent></Card> : null}
      <div className="border-t border-slate-200 pt-6"><p className="mb-4 text-sm text-slate-600">La autoridad humana ocurre sobre esta lectura y su estructura, no iniciativa por iniciativa.</p><div className="flex flex-wrap items-center gap-3"><Button onClick={onReview} data-testid="relationship-review-cta">Continuar con esta lectura <ArrowRight /></Button><Button variant="outline" onClick={onCorrect}>Añadir contexto o corregir</Button></div></div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-600">{label}</p></div>;
}

function ExceptionReviewRow({ item, state, reviewState, showActions, onUpdate }: { item: FirstValueReading['initiatives'][number]; state: RelationshipState; reviewState: ExceptionReviewState; showActions: boolean; onUpdate: (update: ExceptionReviewState) => void }) {
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState('');
  return <li className="rounded-lg border border-slate-200 p-4" data-testid="initiative-relationship-row"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{item.name}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{relationshipLabel(state)}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{relationshipExplanation(state, item.name)}</p>{showActions ? <><div className="mt-3 flex flex-wrap gap-3 text-sm"><button type="button" className="font-semibold underline underline-offset-4" aria-expanded={showContext} onClick={() => setShowContext(!showContext)}>Añadir contexto</button><button type="button" className="font-semibold underline underline-offset-4" onClick={() => onUpdate({ override: 'direct' })}>Mantener en este objetivo</button><button type="button" className="font-semibold underline underline-offset-4" onClick={() => onUpdate({ deferred: true })}>Marcar para revisar después</button></div>{showContext ? <div className="mt-3"><label className="text-sm font-semibold" htmlFor={`exception-context-${item.id}`}>Contexto sobre {item.name}</label><Textarea id={`exception-context-${item.id}`} className="mt-2" value={context} onChange={event => setContext(event.target.value)} placeholder="Añade contexto breve..." rows={2} /><Button className="mt-2" disabled={!context.trim()} onClick={() => { onUpdate({ context: context.trim() }); setShowContext(false); }}>Guardar contexto</Button></div> : null}{reviewState.context ? <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950" role="status">Contexto guardado: {reviewState.context}</p> : null}{reviewState.deferred ? <p className="mt-3 text-sm text-slate-700" role="status">Marcada para revisar después.</p> : null}</> : null}</li>;
}

function IntentCheckpoint({ goal, additionalContext, onAdjust, onContinue }: { goal: string; additionalContext: string; onAdjust: () => void; onContinue: () => void }) {
  return <Card data-testid="intent-checkpoint"><CardHeader><CardTitle>Esto es lo que entendí</CardTitle><CardDescription>Revisa el objetivo antes de añadir el trabajo existente.</CardDescription></CardHeader><CardContent><p className="text-sm font-semibold text-slate-500">Objetivo</p><p className="mt-1 text-lg font-semibold">{goal}</p>{additionalContext.trim() ? <p className="mt-3 text-sm text-slate-700">Contexto: {additionalContext}</p> : null}<p className="mt-3 text-sm text-slate-500">El contexto adicional sigue siendo opcional.</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="outline" onClick={onAdjust}>Ajustar</Button><Button onClick={onContinue}>Está bien, continuar <ArrowRight /></Button></div></CardContent></Card>;
}

function WorkCheckpoint({ reading, work, dependencies, onChangeWork, onAdjust, onConfirm, onSave }: { reading: FirstValueReading; work: string; dependencies: number; onChangeWork: (value: string) => void; onAdjust: () => void; onConfirm: () => void; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  return <Card data-testid="existing-work-checkpoint"><CardHeader><CardTitle>Esto es lo que encontré</CardTitle><CardDescription>Confirma la lista antes de analizar cómo se relaciona con tu objetivo.</CardDescription></CardHeader><CardContent><p className="mb-4 text-sm text-slate-600"><strong>Objetivo:</strong> {reading.detectedGoal}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm"><p><strong>{reading.initiatives.length}</strong> iniciativas</p><p><strong>{reading.owners.length}</strong> responsables mencionados</p><p><strong>{reading.initiatives.filter(item => !item.owner).length}</strong> sin responsable claro</p><p><strong>{dependencies}</strong> dependencias relevantes</p></div><ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Iniciativas detectadas">{reading.initiatives.slice(0, 7).map(item => <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{item.name}{item.owner ? <span className="text-slate-500"> · {item.owner}</span> : null}</li>)}</ul>{reading.initiatives.length > 7 ? <p className="mt-2 text-sm text-slate-500">Y {reading.initiatives.length - 7} iniciativas más.</p> : null}{editing ? <div className="mt-5"><label htmlFor="work-review-edit" className="text-sm font-semibold">Corrige o añade información</label><Textarea id="work-review-edit" className="mt-2" rows={6} value={work} onChange={event => onChangeWork(event.target.value)} /><div className="mt-3 flex justify-end gap-3"><Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button><Button onClick={() => { setEditing(false); onSave(); }}>Guardar cambios</Button></div></div> : <div className="mt-6 flex flex-wrap gap-3"><Button onClick={onConfirm}>Sí, esto representa mi trabajo</Button><Button variant="outline" onClick={() => setEditing(true)}>Ajustar lista</Button><Button variant="outline" onClick={onAdjust}>Añadir algo más</Button></div>}</CardContent></Card>;
}

function GlobalReadingConfirmation({ reading, clarification, exceptionReviewState, onConfirm, onAdjust }: { reading: FirstValueReading; clarification: string; exceptionReviewState: Record<string, ExceptionReviewState>; onConfirm: () => void; onAdjust: () => void }) {
  const states = reading.initiatives.map(item => ({ item, state: relationshipForSession(item, exceptionReviewState[item.id]) }));
  const direct = states.filter(entry => entry.state === 'Relación clara').length;
  const otherPriority = states.filter(entry => entry.state === 'Posible mejor encaje').length;
  const needsContext = states.length - direct - otherPriority;
  const deferred = Object.values(exceptionReviewState).filter(value => value.deferred).length;
  const savedContexts = states.filter(entry => exceptionReviewState[entry.item.id]?.context);
  return <section className="mx-auto max-w-2xl rounded-3xl border border-slate-300 bg-white px-6 py-10 shadow-sm" data-testid="global-reading-confirmation"><h1 className="text-3xl font-semibold">Startería propone esta lectura</h1><p className="mt-4 text-slate-700">{direct} contribuyen directamente, {needsContext} necesitan más contexto y {otherPriority} podrían responder mejor a otra prioridad.</p>{clarification ? <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950"><strong>Tu aclaración:</strong> {clarification}</p> : null}{savedContexts.map(({ item }) => <p key={item.id} className="mt-2 text-sm text-slate-700">Contexto de {item.name}: {exceptionReviewState[item.id]?.context}</p>)}{deferred ? <p className="mt-2 text-sm text-slate-700" data-testid="deferred-count">{deferred} iniciativa(s) marcada(s) para revisar después.</p> : null}<p className="mt-3 text-sm text-slate-600">Puedes confirmar la lectura en conjunto o volver a ajustarla.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button onClick={onConfirm}>Confirmar lectura y continuar</Button><Button variant="outline" onClick={onAdjust}>Seguir ajustando</Button></div></section>;
}

function NextSliceBoundary({ onBack }: { onBack: () => void }) {
  return <section className="mx-auto max-w-2xl rounded-3xl border border-slate-300 bg-white px-6 py-14 text-center shadow-sm" data-testid="relationship-review-boundary"><h1 className="text-3xl font-semibold">Ya completaste la primera parte de esta experiencia.</h1><p className="mt-4 text-slate-600">Puedes volver a revisar la lectura inicial antes de continuar.</p><Button className="mt-8" variant="outline" onClick={onBack}>Volver a la primera lectura</Button></section>;
}
