import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, CircleHelp, ClipboardPaste, Sparkles } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../app/components/ui/card';
import { Textarea } from '../../../app/components/ui/textarea';
import { NOVAGROWTH_READING, NOVAGROWTH_WORK_INPUT, analyzeNovaGrowth, type FirstValueReading } from './novaGrowthFixture';

type Stage = 'empty' | 'goal' | 'work' | 'processing' | 'value' | 'next-slice';

const GUIDE = [
  'Define qué quieres conseguir',
  'Añade el trabajo que ya existe',
  'Revisa cómo se relaciona',
  'Confirma responsables',
  'Empieza a dar seguimiento',
];

export function PortfolioLeadFirstValuePage() {
  const [stage, setStage] = useState<Stage>('empty');
  const [goal, setGoal] = useState('');
  const [work, setWork] = useState('');
  const [reading, setReading] = useState<FirstValueReading | null>(null);

  const guideStep = stage === 'value' || stage === 'next-slice' ? 2 : 1;
  const isSetup = stage !== 'empty';

  const startSetup = () => setStage('goal');
  const useNovaGrowth = () => setWork(NOVAGROWTH_WORK_INPUT);
  const submitGoal = () => {
    if (goal.trim()) setStage('work');
  };
  const processWork = () => {
    if (!work.trim()) return;
    setStage('processing');
    window.setTimeout(() => {
      setReading(analyzeNovaGrowth(goal, work));
      setStage('value');
    }, 250);
  };

  const readingToShow = useMemo(() => reading ?? NOVAGROWTH_READING, [reading]);

  return (
    <main className="min-h-screen bg-[#f7f7f3] px-4 py-8 text-slate-950 sm:px-6 lg:px-10" data-testid="portfolio-lead-first-value">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Startería · Portfolio Lead</p>
            <p className="mt-2 text-sm text-slate-600">Portfolio Monitoring · prototipo Slice A</p>
          </div>
          {isSetup ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Preparando mi espacio</span> : null}
        </header>

        {stage === 'empty' ? <EmptyState onStart={startSetup} /> : null}
        {isSetup && stage !== 'value' && stage !== 'next-slice' ? (
          <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
            <SetupGuide activeStep={guideStep} />
            <section aria-live="polite">
              {stage === 'goal' ? <GoalStep value={goal} onChange={setGoal} onContinue={submitGoal} /> : null}
              {stage === 'work' ? <ExistingWorkStep value={work} onChange={setWork} onUseFixture={useNovaGrowth} onProcess={processWork} /> : null}
              {stage === 'processing' ? <ProcessingState /> : null}
            </section>
          </div>
        ) : null}
        {stage === 'value' ? (
          <div className="space-y-8" aria-live="polite">
            <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
              <SetupGuide activeStep={guideStep} />
              <FirstValue reading={readingToShow} onReview={() => setStage('next-slice')} onCorrect={() => setStage('goal')} />
            </div>
          </div>
        ) : null}
        {stage === 'next-slice' ? <NextSlicePlaceholder onBack={() => setStage('value')} /> : null}
      </div>
    </main>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-14 shadow-sm sm:px-12" data-testid="first-visit-empty">
      <div className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold text-amber-700">Primera visita</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Organiza tus iniciativas alrededor de lo que quieres conseguir.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Empieza por lo que quieres conseguir. Después puedes incorporar las iniciativas y el trabajo que ya tienes.</p>
        <Button className="mt-8" size="lg" onClick={onStart}>Preparar mi espacio <ArrowRight /></Button>
        <div className="mt-10 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>¿Ya vienes con una iniciativa concreta?</span>
          <button type="button" className="font-semibold text-slate-800 underline underline-offset-4">Empezar una iniciativa</button>
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><CircleHelp size={16} /> ¿No sabes por dónde empezar? Puedes contárselo a Startería.</p>
      </div>
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
  return <Card data-testid="goal-step"><CardHeader><p className="text-sm font-semibold text-amber-700">Paso 1 · Intención estratégica</p><CardTitle className="text-2xl">¿Qué quieres conseguir o tener bajo control?</CardTitle><CardDescription>Cuéntalo con tus palabras. No necesitas preparar un KPI ni una estructura antes de empezar.</CardDescription></CardHeader><CardContent><label htmlFor="portfolio-goal" className="sr-only">Qué quieres conseguir o tener bajo control</label><Textarea id="portfolio-goal" value={value} onChange={event => onChange(event.target.value)} placeholder="Dirección quiere conseguir 200 nuevas ventas B2B este trimestre..." rows={7} /><div className="mt-5 flex justify-end"><Button onClick={onContinue} disabled={!value.trim()}>Continuar <ArrowRight /></Button></div></CardContent></Card>;
}

function ExistingWorkStep({ value, onChange, onUseFixture, onProcess }: { value: string; onChange: (value: string) => void; onUseFixture: () => void; onProcess: () => void }) {
  return <Card data-testid="existing-work-step"><CardHeader><p className="text-sm font-semibold text-amber-700">Paso 2 · Contexto existente</p><CardTitle className="text-2xl">Ahora añade el trabajo que ya existe relacionado con esto.</CardTitle><CardDescription>No necesitas ordenarlo antes. Puedes pegar texto desordenado y Startería lo organizará para una primera lectura.</CardDescription></CardHeader><CardContent><label htmlFor="portfolio-existing-work" className="text-sm font-semibold text-slate-800">Pega información existente</label><Textarea id="portfolio-existing-work" className="mt-2" value={value} onChange={event => onChange(event.target.value)} placeholder="Nombres de iniciativas, responsables, notas, dependencias..." rows={9} /><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" onClick={onUseFixture} data-testid="use-novagrowth-fixture"><Sparkles />Usar ejemplo NovaGrowth</Button><Button type="button" variant="outline" disabled><ClipboardPaste />Subir información</Button><span className="text-xs text-slate-500">Fixture disponible solo para prototipo/dev/test.</span></div><div className="mt-6 flex justify-end"><Button onClick={onProcess} disabled={!value.trim()} data-testid="process-existing-work">Ayúdame a ordenar esto <ArrowRight /></Button></div></CardContent></Card>;
}

function ProcessingState() {
  return <Card data-testid="processing-state" aria-live="polite"><CardHeader><p className="text-sm font-semibold text-amber-700">Procesando contexto</p><CardTitle className="text-2xl">Startería está organizando tu contexto</CardTitle><CardDescription>Esta lectura es una simulación determinista del prototipo.</CardDescription></CardHeader><CardContent><div className="space-y-3 text-sm text-slate-700">{['Entendiendo qué quieres conseguir', 'Identificando trabajo existente', 'Buscando relaciones entre iniciativas', 'Detectando información por revisar', 'Preparando una primera lectura'].map(item => <div key={item} className="flex items-center gap-3"><span className="size-2 rounded-full bg-amber-500" />{item}</div>)}</div></CardContent></Card>;
}

function FirstValue({ reading, onReview, onCorrect }: { reading: FirstValueReading; onReview: () => void; onCorrect: () => void }) {
  const [openRationale, setOpenRationale] = useState<string | null>(null);
  return <section className="space-y-6" data-testid="first-analytical-value"><div><p className="text-sm font-semibold text-amber-700">First Analytical Value</p><h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">Lo que entendió Startería</h1><p className="mt-3 max-w-3xl text-lg leading-8 text-slate-700">Quieres entender cómo el trabajo existente está ayudando a conseguir <strong>{reading.detectedGoal}</strong> durante <strong>{reading.horizon}</strong> y dónde necesitas intervenir.</p><p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Declarado por ti · Basado en lo que añadiste</p></div><Card className="border-amber-200 bg-amber-50/50"><CardHeader><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Lectura Startería</p><CardTitle className="text-2xl">Parece haber tres formas principales en las que el trabajo está intentando mover el objetivo.</CardTitle><CardDescription>Propuesta Startería · no es una estructura confirmada</CardDescription></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3">{reading.groups.map(group => <Card key={group.id} className="bg-white"><CardHeader className="p-5"><CardTitle className="text-base">{group.label}</CardTitle><CardDescription>{group.initiativeIds.length} iniciativas</CardDescription></CardHeader><CardContent className="p-5 pt-0"><p className="text-sm text-slate-600">{group.initiativeIds.map(id => reading.initiatives.find(item => item.id === id)?.name).join(' · ')}</p><button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-800 underline underline-offset-4" onClick={() => setOpenRationale(openRationale === group.id ? null : group.id)} aria-expanded={openRationale === group.id}>¿Por qué? <ChevronDown size={15} /></button>{openRationale === group.id ? <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600" data-testid={`rationale-${group.id}`}>{group.rationale}<span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lectura Startería · basada en lo que añadiste</span></p> : null}</CardContent></Card>)}</div></CardContent></Card><div className="grid gap-6 lg:grid-cols-[1fr_280px]"><Card><CardHeader><CardTitle className="text-xl">Contexto detectado</CardTitle><CardDescription>Información encontrada en lo que añadiste.</CardDescription></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meta declarada</dt><dd className="mt-1 font-semibold">{reading.detectedGoal} · {reading.horizon}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trabajo detectado</dt><dd className="mt-1 font-semibold" data-testid="initiative-count">{reading.initiatives.length} iniciativas</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsables mencionados</dt><dd className="mt-1 font-semibold" data-testid="owner-count">{reading.owners.length}</dd></div></dl><p className="mt-5 text-sm text-slate-600">Por revisar: <strong>2</strong> · <span className="text-xs font-semibold uppercase tracking-wide">Encontrado en la información</span></p></CardContent></Card><Card><CardHeader><CardTitle className="text-xl">Qué merece revisar</CardTitle><CardDescription>Máximo tres señales iniciales.</CardDescription></CardHeader><CardContent className="space-y-4" data-testid="review-signals">{reading.signals.slice(0, 3).map(signal => <div key={signal.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-sm font-semibold">{signal.label}</p><p className="mt-1 text-sm leading-6 text-slate-600">{signal.detail}</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{signal.provenance}</p></div>)}</CardContent></Card></div><Card><CardHeader><CardTitle className="text-xl">Trabajo detectado</CardTitle><CardDescription>Inventario de apoyo · no sustituye la lectura.</CardDescription></CardHeader><CardContent><ul className="grid gap-3 sm:grid-cols-2">{reading.initiatives.map(item => <li key={item.id} className="rounded-lg border border-slate-200 p-3"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p><p className="mt-2 text-xs text-slate-500">{item.owner ? `Responsable mencionado: ${item.owner}` : 'Sin owner claro'} · Encontrado en la información</p></li>)}</ul></CardContent></Card><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6"><Button variant="outline" onClick={onCorrect}>Corregir lo que entendió Startería</Button><Button onClick={onReview} data-testid="relationship-review-cta">Revisar cómo se relaciona <ArrowRight /></Button></div></section>;
}

function NextSlicePlaceholder({ onBack }: { onBack: () => void }) {
  return <section className="mx-auto max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm" data-testid="next-slice-placeholder"><p className="text-sm font-semibold text-amber-700">NEXT_SLICE_PLACEHOLDER</p><h1 className="mt-3 text-3xl font-semibold">La revisión de relaciones pertenece al siguiente slice.</h1><p className="mt-4 text-slate-600">Slice A termina aquí. No se han implementado aún la Relationship Review, ownership ni monitoring.</p><Button className="mt-8" variant="outline" onClick={onBack}>Volver a la primera lectura</Button></section>;
}
