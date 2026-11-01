import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ChevronDown, Compass, MessageCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import type { StepReasoningClient, StepReasoningSession, StepReasoningStepNumber, StepReasoningTurn } from '../domain/types';
import type { StepReasoningMissionContext } from '../domain/missionContext';
import { httpStepReasoningClient } from '../services/stepReasoningClient';
import type { AdaptiveInitiativeCore } from '../../adaptive-core/domain/types';
import { getAuthoritativeActiveStep } from '../../adaptive-core/domain/adaptiveAuthority';
import { StepProgressPanel } from '../../initiative-continuity/components/ContinuityExperience';
import { getConfirmedStepOutput, getStepMission } from '../../initiative-continuity/domain/stepPresentation';

export type { StepReasoningMissionContext } from '../domain/missionContext';

interface Props {
  projectId: string;
  step?: StepReasoningStepNumber;
  missionContext?: StepReasoningMissionContext;
  core?: AdaptiveInitiativeCore | null;
  onReviewCheckpoint?: () => void;
  readOnly?: boolean;
  client?: StepReasoningClient;
  createClientTurnId?: () => string;
}

function upsertTurn(turns: StepReasoningTurn[], turn: StepReasoningTurn): StepReasoningTurn[] {
  const index = turns.findIndex(item => item.clientTurnId === turn.clientTurnId);
  if (index === -1) return [...turns, turn];
  return turns.map((item, itemIndex) => itemIndex === index ? turn : item);
}

function isLimitedFallback(turn: StepReasoningTurn): boolean {
  return turn.executionMode === 'limited_fallback';
}

const HISTORY_BOTTOM_THRESHOLD_PX = 48;

function isHistoryNearBottom(history: HTMLDivElement): boolean {
  return history.scrollHeight - history.scrollTop - history.clientHeight <= HISTORY_BOTTOM_THRESHOLD_PX;
}

const STEP_PROMPTS: Record<StepReasoningStepNumber, readonly [string, string]> = {
  0: ['¿Qué falta aclarar?', '¿Qué decisión preparamos?'],
  1: ['¿Qué sabemos realmente?', '¿Qué evidencia falta?'],
  2: ['¿Qué probamos primero?', '¿Cómo medimos el resultado?'],
  3: ['¿Qué observamos?', '¿Qué aprendimos?'],
  4: ['¿Qué recomendaremos?', '¿Qué riesgos quedan?'],
};

export function StepReasoningPanel({
  projectId,
  step = 0,
  missionContext,
  core = null,
  onReviewCheckpoint,
  readOnly,
  client = httpStepReasoningClient,
  createClientTurnId = () => crypto.randomUUID(),
}: Props) {
  const [session, setSession] = useState<StepReasoningSession | null>(null);
  const [turns, setTurns] = useState<StepReasoningTurn[]>([]);
  const [cycleId, setCycleId] = useState<string>();
  const [contextHash, setContextHash] = useState<string>();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missionExpanded, setMissionExpanded] = useState(false);
  const [howExpanded, setHowExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [hasNewerTurns, setHasNewerTurns] = useState(false);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const stickHistoryToBottomRef = useRef(true);
  const historyScrollTopRef = useRef(0);
  const historyFrameRef = useRef<number | null>(null);
  const operationalStep = getAuthoritativeActiveStep(core);
  const historical = operationalStep != null && operationalStep > step;
  const completed = Boolean(getConfirmedStepOutput(core, step)) && (historical || step === 4);
  const effectiveReadOnly = Boolean(readOnly || historical || completed);

  useEffect(() => {
    let cancelled = false;
    stickHistoryToBottomRef.current = true;
    historyScrollTopRef.current = 0;
    setHasNewerTurns(false);
    setLoading(true);
    client.getSession(projectId, step)
      .then(view => {
        if (cancelled) return;
        setSession(view.session);
        setTurns(view.turns);
        setCycleId(view.context?.cycleId ?? view.session?.cycleId);
        setContextHash(view.context?.contextHash ?? view.session?.contextHash);
      })
      .catch(() => { if (!cancelled) setError('No pudimos recuperar esta conversación. Puedes volver a intentarlo recargando la página.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client, projectId, step]);

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history || ((completed || historical) && !historyExpanded)) return;

    if (historyFrameRef.current != null) window.cancelAnimationFrame(historyFrameRef.current);
    historyFrameRef.current = window.requestAnimationFrame(() => {
      historyFrameRef.current = null;
      const currentHistory = historyRef.current;
      if (!currentHistory) return;

      if (stickHistoryToBottomRef.current) {
        const latestPosition = Math.max(0, currentHistory.scrollHeight - currentHistory.clientHeight);
        currentHistory.scrollTop = latestPosition;
        historyScrollTopRef.current = latestPosition;
        setHasNewerTurns(false);
        return;
      }

      const preservedPosition = Math.min(
        historyScrollTopRef.current,
        Math.max(0, currentHistory.scrollHeight - currentHistory.clientHeight),
      );
      currentHistory.scrollTop = preservedPosition;
      historyScrollTopRef.current = preservedPosition;
      setHasNewerTurns(true);
    });

    return () => {
      if (historyFrameRef.current != null) {
        window.cancelAnimationFrame(historyFrameRef.current);
        historyFrameRef.current = null;
      }
    };
  }, [completed, historical, historyExpanded, loading, turns]);

  const latestQuestion = useMemo(() => {
    const latestTurn = turns.at(-1);
    if (!latestTurn || isLimitedFallback(latestTurn)) return undefined;
    const output = latestTurn.structuredOutput as any;
    return output?.nextInteraction?.question as string | undefined;
  }, [turns]);

  const send = async (clientTurnId: string, text: string, retryFailed = false) => {
    if (effectiveReadOnly) return;
    setSending(true);
    setError(null);
    try {
      const result = await client.sendTurn(projectId, step, {
        sessionId: session?.id,
        clientTurnId,
        expectedCycleId: cycleId,
        expectedContextHash: contextHash,
        message: text,
        mode: 'work_with_me',
        retryFailed,
      });
      setSession(result.session);
      setCycleId(result.session.cycleId);
      setContextHash(result.session.contextHash);
      setTurns(previous => upsertTurn(previous, result.turn));
      if (result.turn.status === 'FAILED') {
        setError('No pudimos generar una respuesta. Tu mensaje quedó guardado y el checkpoint no cambió.');
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error?.message ?? 'No pudimos enviar el mensaje. El texto sigue aquí para que puedas reintentarlo.');
    } finally {
      setSending(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending || effectiveReadOnly) return;
    const id = createClientTurnId();
    setTurns(previous => [...previous, { id, clientTurnId: id, inputText: text, assistantText: null, status: 'PENDING', executionMode: null }]);
    setMessage('');
    await send(id, text);
  };

  const initiativeName = missionContext?.initiativeName?.trim() || 'Tu iniciativa';
  const contextLabel = missionContext?.contextLabel?.trim() || 'Contexto inicial disponible';
  const mission = missionContext?.mission?.trim();
  const missionSource = missionContext?.missionSource?.trim();
  const businessOutcome = missionContext?.businessOutcome?.trim();
  const cycleObjective = missionContext?.cycleObjective?.trim();
  const step0Method = missionContext?.step0Method?.trim();
  const nextFocus = missionContext?.nextFocus?.trim();
  const stepMission = getStepMission(core, step);
  const questionSuggestions = STEP_PROMPTS[step];

  const focusComposer = () => {
    const composer = composerInputRef.current;
    if (!composer) return;
    // The mobile shortcut must bring the real text field into the *usable*
    // viewport, rather than only moving focus behind the fixed checkpoint bar.
    composer.focus();
    if (typeof composer.scrollIntoView === 'function') {
      composer.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  };

  const selectPrompt = (suggestion: string) => {
    setMessage(suggestion);
    focusComposer();
  };

  const handleHistoryScroll = () => {
    const history = historyRef.current;
    if (!history) return;
    historyScrollTopRef.current = history.scrollTop;
    const nearBottom = isHistoryNearBottom(history);
    stickHistoryToBottomRef.current = nearBottom;
    if (nearBottom) setHasNewerTurns(false);
  };

  const moveHistoryToLatest = () => {
    const history = historyRef.current;
    if (!history) return;
    const latestPosition = Math.max(0, history.scrollHeight - history.clientHeight);
    stickHistoryToBottomRef.current = true;
    history.scrollTop = latestPosition;
    historyScrollTopRef.current = latestPosition;
    setHasNewerTurns(false);
    history.focus({ preventScroll: true });
  };

  return (
    <section data-testid="step-reasoning-panel" aria-labelledby="step-reasoning-title" className="border-b border-slate-200 bg-slate-50/80 px-3 pb-5 sm:px-5 sm:pb-6">
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white">
          <div className="min-w-0 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">
              <Compass aria-hidden="true" size={15} />
              Contexto del Step
            </div>
            <button
              type="button"
              aria-expanded={missionExpanded}
              aria-controls="step-reasoning-mission-detail"
              onClick={() => setMissionExpanded(expanded => !expanded)}
              className="mt-1 flex min-h-11 w-full items-center justify-between rounded-lg py-2 text-left text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span className="min-w-0"><span className="block">Ver contexto y fuentes</span><span className="block truncate text-xs font-normal text-slate-500"><span>{initiativeName}</span> · {step === 0 ? contextLabel : `Step ${step} · ${stepMission.visibleName}`}</span></span>
              <ChevronDown aria-hidden="true" size={18} className={`transition-transform ${missionExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div
            id="step-reasoning-mission-detail"
            hidden={!missionExpanded}
            className="grid gap-4 border-t border-slate-100 bg-slate-50 px-4 pb-5 pt-4 text-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-3"
          >
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Fuente</p>
              <p className="mt-1 leading-relaxed text-slate-700">{missionSource || 'Adaptive Core persistido'}</p>
            </div>
            {mission ? <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Contexto de la iniciativa</p>
              <p className="mt-1 leading-relaxed text-slate-700">{mission}</p>
            </div> : null}
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-700">Ruta {(stepMission.routeType ?? 'no informada').replaceAll('_', ' ')}</span>
              <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-700">Profundidad {stepMission.depthLevel ?? 'no informada'}</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Resultado de negocio que se busca mover</p>
              <p className="mt-1.5 leading-relaxed text-slate-800">{businessOutcome || mission || stepMission.goal}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Objetivo de este ciclo</p>
              <p className="mt-1.5 leading-relaxed text-slate-800">{cycleObjective || stepMission.expectedOutput}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Qué haremos en Step {step}</p>
              <p className="mt-1.5 leading-relaxed text-slate-800">{step0Method || stepMission.goal}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Siguiente foco</p>
              <p className="mt-1.5 leading-relaxed text-slate-700">{nextFocus || stepMission.nextAction}</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-indigo-600">
                <MessageCircle aria-hidden="true" size={15} />
                Copiloto de iniciativa · QA
              </div>
              <h2 id="step-reasoning-title" className="mt-1 text-xl font-bold text-slate-950">{historical && !completed ? `Histórico de Step ${step}` : completed ? (step === 4 ? 'Paquete preparado para decisión' : 'Resultado de Step confirmado') : 'Conversa con Startería'}</h2>
              {historical || completed ? <p className="mt-1 text-sm font-semibold text-slate-600">{completed ? `${step === 4 ? 'Paquete preparado para decisión' : 'Step completado'} · conversación histórica secundaria y de sólo lectura.` : 'No hay resultado canónico documentado; consultar no reabre el Step.'}</p> : <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">Comparte lo que sabes y lo que aún no puedes afirmar. La conversación prepara tu revisión; no confirma checkpoints ni cambia el progreso.</p>}
              {!effectiveReadOnly ? <button type="button" aria-controls="step-reasoning-composer-input" onClick={focusComposer} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:hidden">Escribir a Startería</button> : null}
            </div>
            {!effectiveReadOnly ? <span className="inline-flex min-h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
              Sugerencias por revisar
            </span> : null}
          </div>

          {step === 4 ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><strong>Resultado esperado: Decision Package.</strong> Prepara una recomendación para la autoridad humana; no equivale a una decisión organizacional aprobada.</p> : null}

          <div className={completed || historical ? 'mt-4 grid gap-4' : 'mt-4 grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(17rem,3fr)]'}>
            {completed ? <aside aria-label="Resultado canónico del Step">
              <StepProgressPanel
                core={core}
                step={step}
                onReviewCheckpoint={onReviewCheckpoint}
                readOnly={effectiveReadOnly}
                resultFirst
              />
            </aside> : null}
            <div className={completed || historical ? 'min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4' : 'min-w-0'}>
              {historical && !completed ? <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-950">anterior en el recorrido · resultado no documentado</p><p className="mt-1 text-sm leading-6 text-amber-900">No se reconstruye un output desde mensajes, avance legacy ni navegación.</p></div> : null}
              {completed || historical ? <button type="button" aria-expanded={historyExpanded} aria-controls="step-reasoning-history" onClick={() => setHistoryExpanded(value => !value)} className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left text-sm font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><span>{turns.length > 0 ? 'Ver conversación histórica' : 'Conversación histórica sin mensajes'}</span><ChevronDown aria-hidden="true" size={18} className={`transition-transform ${historyExpanded ? 'rotate-180' : ''}`} /></button> : null}
              <div id="step-reasoning-history" hidden={(completed || historical) && !historyExpanded}>
              <div
                id="step-reasoning-turns"
                ref={historyRef}
                role="log"
                tabIndex={0}
                aria-live="polite"
                aria-relevant="additions text"
                aria-label="Historial de conversación"
                onScroll={handleHistoryScroll}
                className={effectiveReadOnly
                  ? 'h-[clamp(12rem,34dvh,20rem)] space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-slate-50 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:h-[clamp(16rem,38dvh,24rem)] sm:p-4 lg:h-[clamp(20rem,42dvh,26rem)]'
                  : 'h-[clamp(7rem,16dvh,10rem)] space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-slate-50 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:h-[clamp(8rem,16dvh,11rem)] sm:p-4 lg:h-[clamp(9rem,16dvh,12rem)]'}
              >
                {loading && <p className="text-sm text-slate-500">Recuperando la conversación guardada…</p>}
                {!loading && turns.length === 0 && (
                  <div className="max-w-2xl py-5">
                    <p className="text-sm font-semibold text-slate-800">Empieza por una situación concreta.</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">Puedes contar qué quieres mover, qué evidencia tienes o qué todavía no sabes.</p>
                  </div>
                )}
                {turns.map(turn => {
                  const limitedFallback = isLimitedFallback(turn);
                  return (
                    <div key={turn.clientTurnId} className="space-y-2.5">
                      <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3 text-sm leading-relaxed text-white sm:max-w-[78%]">{turn.inputText}</div>
                      <div className="max-w-[96%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 sm:max-w-[84%]">
                        {turn.status === 'PENDING'
                          ? 'Preparando una respuesta con el contexto autorizado…'
                          : limitedFallback
                            ? 'No pudimos generar una respuesta ahora. Tu mensaje quedó guardado y nada cambió en el checkpoint.'
                            : turn.assistantText}
                        {limitedFallback && <p className="mt-2 text-xs font-bold text-amber-700">Respuesta no generada · puedes reintentar</p>}
                        {turn.executionMode === 'qa_stub' && <p className="mt-2 text-xs font-bold text-violet-700">Respuesta de integración QA · no es razonamiento de un LLM</p>}
                        {(turn.structuredOutput?.suggestions ?? []).map((suggestion, index) => (
                          <div key={`${turn.id}-suggestion-${index}`} className="mt-3 border-l-2 border-amber-300 bg-amber-50 px-3 py-2.5">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Pendiente de revisión humana</p>
                            <p className="mt-1 text-sm text-slate-800">{suggestion.proposedValue}</p>
                          </div>
                        ))}
                        {turn.status === 'FAILED' && !effectiveReadOnly && (
                          <button type="button" disabled={sending} onClick={() => void send(turn.clientTurnId, turn.inputText, true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 disabled:opacity-50">
                            <RotateCcw aria-hidden="true" size={14} /> Reintentar mensaje
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasNewerTurns && !((completed || historical) && !historyExpanded) ? <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  aria-controls="step-reasoning-turns"
                  onClick={moveHistoryToLatest}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-800 shadow-sm hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <ArrowDown aria-hidden="true" size={15} /> Ir al mensaje más reciente
                </button>
              </div> : null}

              {latestQuestion && <p className="mt-3 border-l-2 border-indigo-300 pl-3 text-sm font-medium text-indigo-900">Siguiente pregunta sugerida: {latestQuestion}</p>}
              {error && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}

              {!effectiveReadOnly ? <form data-testid="step-reasoning-composer" onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-slate-800">
                  Cuéntale a Starteria qué sabes o qué te genera duda
                  <textarea id="step-reasoning-composer-input" ref={composerInputRef} value={message} onChange={event => setMessage(event.target.value)} rows={2} maxLength={8000} disabled={sending} className="min-h-20 scroll-mb-28 resize-y rounded-2xl border border-slate-300 px-4 py-3 font-normal text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100" placeholder="Ej.: Sabemos que hay retrabajo, pero todavía no sabemos en qué parte medirlo." />
                </label>
                <button type="submit" disabled={sending || !message.trim()} className="min-h-12 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50">
                  {sending ? 'Enviando…' : 'Enviar mensaje'}
                </button>
              </form> : <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Conversación en sólo lectura. Tu permiso actual no permite enviar ni reintentar mensajes.</p>}

              {/* Prompts remain available, but writing takes priority over choosing one. */}
              {!effectiveReadOnly && <div className="mt-4" aria-label="Preguntas sugeridas para el Copilot">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Puedes empezar por</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {questionSuggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => selectPrompt(suggestion)}
                      disabled={sending}
                      className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-indigo-800 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>}
              </div>
            </div>

            {historical || completed ? null : <aside aria-label="Cómo avanzar desde la conversación" className="space-y-3 border-t border-slate-200 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3">
                <button type="button" aria-expanded={howExpanded} aria-controls="step-reasoning-how" onClick={() => setHowExpanded(value => !value)} className="flex min-h-11 w-full items-center justify-between py-2 text-left text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                  Cómo funciona <ChevronDown aria-hidden="true" size={16} className={`transition-transform ${howExpanded ? 'rotate-180' : ''}`} />
                </button>
                <ol id="step-reasoning-how" hidden={!howExpanded} className="space-y-3 border-t border-slate-200 pb-3 pt-3 text-xs leading-relaxed text-slate-600">
                  <li><span className="font-bold text-indigo-700">Conversar:</span> guarda mensajes y sugerencias; no cambia el checkpoint.</li>
                  <li><span className="font-bold text-slate-900">Revisar:</span> lleva al workspace canónico sin confirmar.</li>
                  <li><span className="inline-flex items-center gap-1 font-bold text-emerald-800"><ShieldCheck aria-hidden="true" size={14} />Confirmar:</span> requiere el control canónico y una acción humana.</li>
                </ol>
              </div>
              <StepProgressPanel
                core={core}
                step={step}
                onReviewCheckpoint={onReviewCheckpoint}
                readOnly={effectiveReadOnly}
              />
            </aside>}
          </div>
        </div>
      </div>
    </section>
  );
}
