import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../app/components/ui/card';
import { Textarea } from '../../../app/components/ui/textarea';
import {
  analyzeFirstValueP3,
  type FirstValueP3Request,
  type FirstValueP3Result,
} from './firstValueP3Service';
import { getConfirmedBrief } from './confirmedBriefClient';
import { projectStrategicIntent, serializeStrategicContext } from './strategicIntentProjection';
import { readClaimedPortfolioEntryBriefIdentity } from '../../portfolio-entry/public/storage';

type P3State = 'idle' | 'processing' | 'ready' | 'needs_clarification' | 'error';
type WorkItem = { itemId: string; name: string };

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `fv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
    if (response?.data?.error?.message) return response.data.error.message;
  }
  return 'No se pudo analizar el trabajo ahora. Tu objetivo y la lista siguen guardados en esta sesión.';
}

const dispositionLabels = {
  DIRECT_CONTRIBUTION: 'Contribuye directamente',
  NEEDS_CONTEXT: 'Necesita más contexto',
  POSSIBLE_OTHER_PRIORITY: 'Podría responder mejor a otra prioridad',
} as const;

export function PortfolioLeadFirstValuePage() {
  const continuationIdentity = useRef(readClaimedPortfolioEntryBriefIdentity());
  const [hydration, setHydration] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [hydrationError, setHydrationError] = useState('');
  const hydrated = useRef(false);
  const edited = useRef(false);
  const sessionId = useRef(createId());
  const requestSequence = useRef(0);
  const itemIds = useRef(new Map<string, string>());
  const [stage, setStage] = useState<'intent' | 'p1' | 'work' | 'p2' | 'p3'>('intent');
  const [goal, setGoal] = useState('');
  const [context, setContext] = useState('');
  const [workText, setWorkText] = useState('');
  const [workCorrections, setWorkCorrections] = useState('');
  const [confirmedWork, setConfirmedWork] = useState<WorkItem[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<FirstValueP3Request['clarifications']>([]);
  const [p3State, setP3State] = useState<P3State>('idle');
  const [result, setResult] = useState<FirstValueP3Result | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [exceptionsOpen, setExceptionsOpen] = useState(true);
  const [globalConfirmed, setGlobalConfirmed] = useState(false);
  const [unansweredClarifications, setUnansweredClarifications] = useState<string[]>([]);

  const hydrateContinuation = async () => {
    const identity = continuationIdentity.current;
    if (!identity || hydrated.current) return;
    setHydration('loading');
    setHydrationError('');
    try {
      const brief = await getConfirmedBrief(identity);
      const projection = projectStrategicIntent(brief);
      if (!projection.goal) throw new Error('No encontramos un objetivo confirmado en esta entrada.');
      if (!edited.current && !hydrated.current) {
        setGoal(projection.goal);
        setContext(serializeStrategicContext(projection));
      }
      hydrated.current = true;
      setHydration('ready');
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setHydrationError(status === 404 ? 'Esta entrada confirmada no está disponible.' : status === 409 ? 'La identidad de esta entrada quedó desactualizada.' : status === 410 ? 'Esta entrada fue abandonada o venció.' : status === 401 ? 'Inicia sesión de nuevo para recuperar esta entrada.' : getErrorMessage(error));
      setHydration('error');
    }
  };

  useEffect(() => {
    if (!continuationIdentity.current) { setHydration('ready'); return; }
    void hydrateContinuation();
  }, []);

  const invalidateAnalysis = () => {
    requestSequence.current += 1;
    setResult(null);
    setGlobalConfirmed(false);
    setUnansweredClarifications([]);
    setErrorMessage('');
    setP3State('idle');
  };

  const adjustIntent = () => {
    invalidateAnalysis();
    setStage('intent');
  };

  const enterWork = () => {
    setStage('work');
  };

  const updateWorkText = (value: string) => {
    invalidateAnalysis();
    setWorkText(value);
    setStage('work');
  };

  const getConfirmedItems = () => workText.split(/\r?\n/).map(name => name.trim()).filter(Boolean).map(name => {
    let itemId = itemIds.current.get(name.toLocaleLowerCase());
    if (!itemId) {
      itemId = `item-${itemIds.current.size + 1}`;
      itemIds.current.set(name.toLocaleLowerCase(), itemId);
    }
    return { itemId, name, ...(workCorrections.trim() ? { description: workCorrections.trim() } : {}) };
  });

  const submitAnalysis = async (answers = clarificationAnswers, work = confirmedWork) => {
    if (!goal.trim() || work.length === 0) return;
    const sequence = ++requestSequence.current;
    setP3State('processing');
    setErrorMessage('');
    setResult(null);
      setGlobalConfirmed(false);
      setUnansweredClarifications([]);
    setStage('p3');
    const payload: FirstValueP3Request = {
      sessionId: sessionId.current,
      requestId: createId(),
      p2Confirmed: true,
      goal: goal.trim(),
      ...([context.trim(), workCorrections.trim()].filter(Boolean).length
        ? { context: [context.trim(), workCorrections.trim()].filter(Boolean).join('\n') }
        : {}),
      initiatives: work.map(item => ({
        itemId: item.itemId,
        name: item.name,
      })),
      ...(answers?.length ? { clarifications: answers } : {}),
    };
    try {
      const nextResult = await analyzeFirstValueP3(payload);
      if (sequence !== requestSequence.current) return;
      setResult(nextResult);
      setP3State(nextResult.clarifications.length ? 'needs_clarification' : 'ready');
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setErrorMessage(getErrorMessage(error));
      setP3State('error');
    }
  };

  const confirmP2 = () => {
    const items = getConfirmedItems();
    if (!items.length) return;
    setConfirmedWork(items);
    setClarificationAnswers([]);
    setGlobalConfirmed(false);
    void submitAnalysis([], items);
  };

  const saveClarification = (questionId: string, affectedItemIds: string[], answer: string) => {
    if (!answer.trim()) return;
    const next = [...(clarificationAnswers ?? []).filter(item => item.id !== questionId), {
      id: questionId,
      affectedItemIds,
      answer: answer.trim(),
    }];
    setClarificationAnswers(next);
    void submitAnalysis(next);
  };

  const changeIntent = (setter: (value: string) => void, value: string) => {
    invalidateAnalysis();
    setter(value);
  };

  return (
    <main className="min-h-full bg-[#f7f7f3] px-4 py-8 text-slate-950 sm:px-6 lg:px-10" data-testid="portfolio-lead-first-value">
      <div className="mx-auto max-w-5xl space-y-6">
        {continuationIdentity.current && hydration !== 'ready' ? <Card data-testid="d2-hydration-state"><CardContent className="space-y-3 py-6">{hydration === 'loading' ? <p role="status">Recuperando tu intención confirmada…</p> : <><p role="alert">{hydrationError}</p><Button variant="outline" onClick={() => void hydrateContinuation()}>Reintentar</Button></>}</CardContent></Card> : null}
        {(!continuationIdentity.current || hydration === 'ready') ? <>
        <header>
          <p className="text-sm font-medium text-slate-600">Portfolio Lead · First Value</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Organiza el trabajo alrededor de lo que quieres conseguir</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Primero revisamos tu objetivo, después el trabajo que ya existe y solo entonces Startería prepara una lectura provisional.</p>
        </header>

        <Card data-testid="p1-intent-section">
          <CardHeader>
            <p className="text-sm font-semibold text-amber-700">P1 · Tu intención</p>
            <CardTitle className="text-xl">¿Qué quieres conseguir o tener bajo control?</CardTitle>
            <CardDescription>Cuéntalo con tus palabras. El análisis empieza únicamente después de que confirmes también el trabajo existente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stage === 'intent' ? <>
              <label htmlFor="first-value-goal" className="block text-sm font-medium">Qué quieres conseguir</label>
              <Textarea id="first-value-goal" value={goal} onChange={event => { edited.current = true; changeIntent(setGoal, event.target.value); }} rows={3} />
              <label htmlFor="first-value-context" className="block text-sm font-medium">Contexto adicional (opcional)</label>
              <Textarea id="first-value-context" value={context} onChange={event => { edited.current = true; changeIntent(setContext, event.target.value); }} rows={2} />
              <Button onClick={() => setStage('p1')} disabled={!goal.trim()}>Mostrar lo que entendió <ArrowRight /></Button>
            </> : <>
              <div data-testid="p1-confirmed-summary" className="rounded-lg border border-slate-200 bg-white p-4">
                <p><span className="font-medium">Objetivo:</span> {goal}</p>
                {context.trim() ? <p className="mt-2 text-sm text-slate-600"><span className="font-medium">Contexto:</span> {context}</p> : null}
              </div>
              {stage === 'p1' ? <div data-testid="p1-intent-checkpoint" className="flex flex-wrap gap-3">
                <Button onClick={enterWork}>Está bien, continuar</Button>
                <Button variant="outline" onClick={adjustIntent}>Ajustar intención</Button>
              </div> : <Button variant="outline" onClick={adjustIntent}>Ajustar intención</Button>}
            </>}
          </CardContent>
        </Card>

        {stage !== 'intent' && <Card data-testid="p2-existing-work-checkpoint">
          <CardHeader>
            <p className="text-sm font-semibold text-amber-700">P2 · Trabajo existente</p>
            <CardTitle className="text-xl">¿Qué iniciativas o trabajo ya está en marcha?</CardTitle>
            <CardDescription>Añade una iniciativa por línea. Revisarás esta lista antes de confirmar el trabajo para el análisis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stage === 'work' ? <>
              <label htmlFor="first-value-work" className="block text-sm font-medium">Trabajo existente</label>
              <Textarea id="first-value-work" aria-label="Trabajo existente" value={workText} onChange={event => updateWorkText(event.target.value)} rows={6} placeholder={'Pricing Pilot\nCRM Follow-up'} />
              <label htmlFor="first-value-corrections" className="block text-sm font-medium">Correcciones o contexto del trabajo (opcional)</label>
              <Textarea id="first-value-corrections" value={workCorrections} onChange={event => { invalidateAnalysis(); setWorkCorrections(event.target.value); }} rows={2} />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setStage('p2')} disabled={!workText.trim()}>Mostrar trabajo detectado <ArrowRight /></Button>
                <Button variant="outline" onClick={adjustIntent}>Ajustar intención</Button>
              </div>
            </> : stage === 'p2' ? <>
              <div data-testid="p2-work-summary" className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-2 text-sm font-medium">Trabajo que entendí de tu lista</p>
                <ul className="list-inside list-disc space-y-1 text-sm">{getConfirmedItems().map(item => <li key={item.itemId}>{item.name}</li>)}</ul>
                {workCorrections.trim() ? <p className="mt-3 text-sm text-slate-600">Nota: {workCorrections}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={confirmP2}>Sí, esto representa mi trabajo</Button>
                <Button variant="outline" onClick={() => setStage('work')}>Ajustar lista</Button>
                <Button variant="outline" onClick={() => { setWorkText(value => `${value.trim()}\n`); setStage('work'); }}>Añadir algo más</Button>
              </div>
            </> : stage === 'p3' && confirmedWork.length ? <>
              <div data-testid="p2-confirmed-summary" className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="font-medium">Trabajo confirmado por ti</p>
                <p className="mt-1 text-sm text-slate-600">{confirmedWork.map(item => item.name).join(' · ')}</p>
              </div>
              <Button variant="outline" onClick={() => { invalidateAnalysis(); setStage('work'); }}>Ajustar lista</Button>
            </> : null}
          </CardContent>
        </Card>}

        {stage === 'p3' ? <section aria-live="polite" className="space-y-4">
          {p3State === 'processing' ? <Card data-testid="p3-processing"><CardContent className="flex items-center gap-3 py-6"><span className="size-3 animate-pulse rounded-full bg-amber-500" /><p role="status">Analizando el trabajo confirmado…</p></CardContent></Card> : null}
          {p3State === 'error' ? <Card><CardContent className="space-y-3 py-6"><p role="alert">{errorMessage}</p><p className="text-sm text-slate-600">Tu objetivo, contexto y trabajo confirmado se mantienen en esta sesión.</p><Button onClick={() => void submitAnalysis()}><RefreshCw /> Intentar de nuevo</Button></CardContent></Card> : null}
          {result ? <P3Reading
            result={result}
            items={confirmedWork}
            state={p3State}
            exceptionsOpen={exceptionsOpen}
            onToggleExceptions={() => setExceptionsOpen(value => !value)}
            onClarification={saveClarification}
            onContinueWithoutAnswer={id => setUnansweredClarifications(current => current.includes(id) ? current : [...current, id])}
            onConfirm={() => setGlobalConfirmed(true)}
            globalConfirmed={globalConfirmed}
            unansweredClarifications={unansweredClarifications}
          /> : null}
          {p3State === 'idle' ? <p className="text-sm text-slate-600">La lectura anterior ya no está vigente. Confirma de nuevo el trabajo para analizar los cambios.</p> : null}
        </section> : null}
        </> : null}
      </div>
    </main>
  );
}

function P3Reading({
  result, items, state, exceptionsOpen, onToggleExceptions, onClarification, onContinueWithoutAnswer, onConfirm, globalConfirmed, unansweredClarifications,
}: {
  result: FirstValueP3Result;
  items: WorkItem[];
  state: P3State;
  exceptionsOpen: boolean;
  onToggleExceptions: () => void;
  onClarification: (questionId: string, affectedItemIds: string[], answer: string) => void;
  onContinueWithoutAnswer: (questionId: string) => void;
  onConfirm: () => void;
  globalConfirmed: boolean;
  unansweredClarifications: string[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const itemById = new Map(items.map(item => [item.itemId, item]));
  const relationships = result.relationships.map(relationship => ({ ...relationship, item: itemById.get(relationship.itemId) }))
    .filter(item => item.item);
  const exceptions = relationships.filter(item => item.disposition !== 'DIRECT_CONTRIBUTION');
  const directs = relationships.length - exceptions.length;

  return <div data-testid="p3-result" className="space-y-5">
    <Card className="border-indigo-200">
      <CardHeader>
        <p className="flex items-center gap-2 text-sm font-medium text-indigo-700"><Sparkles size={16} /> Startería propone · lectura provisional</p>
        <CardTitle className="text-xl">Así parece repartirse el trabajo</CardTitle>
        <CardDescription>{result.summary.exceptionFirstNarrative}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div><p className="text-2xl font-semibold">{directs}</p><p className="text-sm text-slate-600">Contribuyen directamente</p></div>
        <div><p className="text-2xl font-semibold">{result.summary.counts.NEEDS_CONTEXT}</p><p className="text-sm text-slate-600">Necesitan más contexto</p></div>
        <div><p className="text-2xl font-semibold">{result.summary.counts.POSSIBLE_OTHER_PRIORITY}</p><p className="text-sm text-slate-600">Podrían responder mejor a otra prioridad</p></div>
      </CardContent>
    </Card>

    <Card data-testid="p3-exception-summary">
      <CardHeader>
        <CardTitle className="text-lg">Qué merece revisar</CardTitle>
        <CardDescription>{exceptions.length} iniciativas necesitan atención. Las relaciones claras no requieren confirmación individual.</CardDescription>
        <Button variant="outline" onClick={onToggleExceptions} aria-expanded={exceptionsOpen}>
          {exceptionsOpen ? 'Ocultar excepciones' : `Revisar ${exceptions.length} excepciones`}
        </Button>
      </CardHeader>
      {exceptionsOpen ? <CardContent className="space-y-3">
        {exceptions.map(relationship => <details key={relationship.itemId} data-testid={`p3-exception-item-${relationship.itemId}`} className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer font-medium">{relationship.item?.name} · {dispositionLabels[relationship.disposition]}</summary>
          <p className="mt-3 text-sm text-slate-600">{relationship.rationale}</p>
        </details>)}
      </CardContent> : null}
    </Card>

    {result.clarifications.map(question => <Card key={question.id} data-testid={`p3-clarification-${question.id}`}>
      <CardHeader>
        <CardTitle className="text-lg">Tengo una duda sobre {question.affectedItemIds.length} iniciativas</CardTitle>
        <CardDescription>{question.affectedItemIds.map(id => itemById.get(id)?.name).filter(Boolean).join(' · ')}</CardDescription>
        <p className="text-sm leading-6 text-slate-700">{question.question}</p>
        <p className="text-sm text-slate-500">{question.reason}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm font-medium" htmlFor={`answer-${question.id}`}>Tu aclaración para estas iniciativas</label>
        <Textarea id={`answer-${question.id}`} value={answers[question.id] ?? ''} onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))} />
        <Button onClick={() => onClarification(question.id, question.affectedItemIds, answers[question.id] ?? '')} disabled={!(answers[question.id] ?? '').trim()}>Guardar aclaración</Button>
        <Button variant="outline" onClick={() => onContinueWithoutAnswer(question.id)}>Continuar sin responder</Button>
      </CardContent>
    </Card>)}

    {state !== 'needs_clarification' || result.clarifications.every(question => unansweredClarifications.includes(question.id)) ? <Card className="border-slate-200">
      <CardHeader><CardTitle className="text-lg">Confirma la lectura en conjunto</CardTitle><CardDescription>Esta confirmación valida cómo Startería entendió el trabajo durante esta sesión. No crea ni modifica estructura de portafolio.</CardDescription></CardHeader>
      <CardContent>{globalConfirmed ? <p data-testid="global-reading-confirmed" className="flex items-center gap-2 text-sm text-slate-700"><Check size={16} /> Confirmado por ti para esta sesión.</p> : <Button onClick={onConfirm}>Confirmar esta lectura</Button>}</CardContent>
    </Card> : <p className="text-sm text-slate-600">Responde la aclaración o continúa sin responder para validar la lectura provisional.</p>}
  </div>;
}
