import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import type {
  PortfolioBootstrapAnchor,
  PortfolioGoalQuestionPlan,
  PortfolioGoalTurn,
  PortfolioGoalTurnSnapshot,
  UpdatePortfolioBootstrapAnchorInput,
} from '../services/portfolioBootstrapClient';
import {
  getPortfolioBootstrapGoalQuestionPlan,
  getPortfolioBootstrapGoalTurns,
  submitPortfolioBootstrapGoalTurn,
} from '../services/portfolioBootstrapClient';
import {
  createGoalLedgerAnchorProposal,
  isGoalLedgerTurnAccepted,
} from './goal-ledger-anchor-proposal';

type Props = {
  anchor: PortfolioBootstrapAnchor;
  canConfirm: boolean;
  onSave: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
  onConfirm: () => Promise<void>;
  onUseGuided: () => void;
};

type InteractionState = 'loading' | 'ready' | 'error';
type GoalDisposition = 'user_declared' | 'unknown' | 'not_applicable';

function toError(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message : 'No pudimos recuperar la conversación. No hemos creado respuestas nuevas.';
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function legacyAnswerTexts(sourceRefs: unknown): string[] {
  const previous = record(record(sourceRefs).objectiveConversation).turns;
  if (!Array.isArray(previous)) return [];
  return previous.flatMap((item) => {
    const entry = record(item);
    const value = entry.value;
    // A newly accepted ledger receipt also exists in sourceRefs for legacy compatibility.
    // Do not mislabel it as a pre-ledger historical response.
    return !entry.ledgerTurnId && typeof value === 'string' && value.trim() ? [value.slice(0, 2_000)] : [];
  });
}
type GoalField = 'outcomeStatement' | 'contextSummary' | 'decisionToEnable' | 'businessSignalValue';
const goalFieldLabels: Record<GoalField, string> = {
  outcomeStatement: 'Resultado esperado',
  contextSummary: 'Contexto',
  decisionToEnable: 'Decisión a habilitar',
  businessSignalValue: 'KPI o señal',
};

function pendingChangePreview(anchor: PortfolioBootstrapAnchor, turn: PortfolioGoalTurn) {
  if (!Object.prototype.hasOwnProperty.call(goalFieldLabels, turn.field)) {
    throw new Error('El campo propuesto no corresponde a un objetivo revisable.');
  }
  const field = turn.field as GoalField;
  const current = anchor[field]?.trim() || 'Sin definir';
  const unknown = turn.disposition === 'unknown' || turn.disposition === 'not_applicable';
  const proposed = unknown && field === 'outcomeStatement'
    ? current
    : unknown ? 'Se registrará como pendiente / desconocido' : turn.inputText;
  return { label: goalFieldLabels[field], current, proposed, unknown };
}

function shownDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'fecha no disponible'
    : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PortfolioGoalLedgerConversation({ anchor, canConfirm, onSave, onConfirm, onUseGuided }: Props) {
  const [plan, setPlan] = useState<PortfolioGoalQuestionPlan | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioGoalTurnSnapshot | null>(null);
  const [loadStatus, setLoadStatus] = useState<InteractionState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [disposition, setDisposition] = useState<GoalDisposition>('user_declared');
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editingPending, setEditingPending] = useState(false);
  const [incorporatedLocally, setIncorporatedLocally] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingKeyRef = useRef<string | null>(null);
  const lockRef = useRef(false);

  const reload = useCallback(async () => {
    setLoadStatus('loading');
    setError(null);
    try {
      const [nextPlan, nextTurns] = await Promise.all([
        getPortfolioBootstrapGoalQuestionPlan(anchor.bootstrapSessionId),
        getPortfolioBootstrapGoalTurns(anchor.bootstrapSessionId),
      ]);
      if (nextPlan.sessionId !== anchor.bootstrapSessionId || nextPlan.anchorVersion !== anchor.version) {
        throw new Error('El objetivo cambió mientras recuperábamos la conversación. Vuelve a cargar la vista.');
      }
      setPlan(nextPlan);
      setSnapshot(nextTurns);
      setLoadStatus('ready');
    } catch (cause) {
      setLoadStatus('error');
      setError(toError(cause));
    }
  }, [anchor.bootstrapSessionId, anchor.version]);

  useEffect(() => { void reload(); }, [reload]);

  const turns = snapshot?.turns ?? [];
  const latest = turns.at(-1) ?? null;
  const superseded = new Set(turns.flatMap((turn) => turn.supersedesTurnId ? [turn.supersedesTurnId] : []));
  const isAccepted = (turn: PortfolioGoalTurn) =>
    isGoalLedgerTurnAccepted(anchor.sourceRefs, turn.id) || incorporatedLocally.includes(turn.id);
  const pending = [...turns].reverse().find((turn) =>
    turn.anchorVersion === anchor.version && !isAccepted(turn) && !superseded.has(turn.id) && turn.disposition !== 'retracted') ?? null;
  const stalePending = turns.find((turn) =>
    turn.anchorVersion !== anchor.version && !isAccepted(turn) && !superseded.has(turn.id) && turn.disposition !== 'retracted') ?? null;
  const activeQuestion = plan?.activeQuestion ?? null;
  const awaitingAnchorRefresh = Boolean(latest && latest.anchorVersion === anchor.version && isAccepted(latest));
  const busy = submitting || applying || confirming || loadStatus !== 'ready';
  const legacy = legacyAnswerTexts(anchor.sourceRefs);
  const canWrite = Boolean(activeQuestion && !pending && !stalePending && !awaitingAnchorRefresh && !busy && plan?.status !== 'blocked');
  const isCorrecting = Boolean(pending && editingPending);

  async function saveTurn(event: React.FormEvent) {
    event.preventDefault();
    if (lockRef.current || !activeQuestion || !snapshot || !plan || !answer.trim()
      || !canWrite && !isCorrecting) return;
    lockRef.current = true;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const prior = [...snapshot.turns].reverse().find((turn) => turn.questionId === activeQuestion.id);
    const stableKey = pendingKeyRef.current ?? (
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID() : `e2-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    pendingKeyRef.current = stableKey;
    try {
      const result = await submitPortfolioBootstrapGoalTurn(
        anchor.bootstrapSessionId,
        {
          expectedVersion: snapshot.version,
          expectedAnchorVersion: anchor.version,
          expectedContextReviewVersion: plan.contextReviewVersion,
          questionId: activeQuestion.id,
          inputText: answer.trim(),
          disposition,
          supersedesTurnId: prior?.id ?? null,
        },
        stableKey,
      );
      setSnapshot((current) => ({
        version: result.version,
        turns: current?.turns.some((turn) => turn.id === result.turn.id)
          ? current.turns : [...(current?.turns ?? []), result.turn],
      }));
      setAnswer('');
      setDisposition('user_declared');
      setEditingPending(false);
      pendingKeyRef.current = null;
      setNotice('Respuesta guardada como provisional. Revisa si quieres incorporarla al borrador.');
    } catch (cause) {
      setError(toError(cause));
      // Keep exact input and idempotency key for the explicit retry action.
    } finally {
      lockRef.current = false;
      setSubmitting(false);
    }
  }

  async function incorporate(turn: PortfolioGoalTurn) {
    if (lockRef.current || isAccepted(turn)) return;
    lockRef.current = true;
    setApplying(true);
    setError(null);
    try {
      const proposal = createGoalLedgerAnchorProposal(anchor, turn);
      await onSave(proposal);
      setIncorporatedLocally((ids) => [...ids, turn.id]);
      setNotice('Incorporado al borrador por tu decisión. El objetivo sigue sin confirmarse.');
    } catch (cause) {
      setError(toError(cause));
    } finally {
      lockRef.current = false;
      setApplying(false);
    }
  }

  async function confirm() {
    if (lockRef.current || !canConfirm || pending || stalePending) return;
    lockRef.current = true;
    setConfirming(true);
    setError(null);
    try { await onConfirm(); }
    catch (cause) { setError(toError(cause)); }
    finally { lockRef.current = false; setConfirming(false); }
  }

  return (
    <section data-testid="portfolio-goal-ledger-conversation" className="grid gap-4 rounded-2xl border border-[#e4e7f0] bg-[#f7f7fc] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.82fr)]">
      <div className="min-w-0 space-y-4">
        <header>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#6446c0]">E2 · Objetivo del negocio</p>
          <h2 className="mt-1 text-lg font-semibold text-[#182246]">Conversación con registro verificable</h2>
          <p className="mt-1 text-sm text-[#6c7695]">Recuperamos tus respuestas. Cada una se guarda provisionalmente y solo se incorpora al borrador cuando tú lo decides.</p>
        </header>
        {loadStatus === 'loading' ? <p role="status" className="rounded-xl bg-white p-4 text-sm text-[#6c7695]">Recuperando conversación y pregunta vigente…</p> : null}
        {loadStatus === 'error' ? (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void reload()} className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Reintentar lectura</button>
              <button type="button" onClick={onUseGuided} className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Usar preparación guiada</button>
            </div>
          </div>
        ) : null}
        {loadStatus === 'ready' ? (
          <>
            <section role="region" aria-label="Historial de respuestas E2" className="space-y-3">
              {turns.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#d9dceb] bg-white p-4 text-sm text-[#6c7695]">Aún no hay turnos en este registro. Las respuestas antiguas se mantienen aparte.</p>
              ) : turns.map((turn) => (
                <article key={turn.id} className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#ede8fd] p-4 text-sm text-[#182246]">
                  <p className="whitespace-pre-wrap">{turn.inputText}</p>
                  <p className="mt-2 text-xs text-[#6446c0]">
                    {turn.disposition === 'unknown' ? 'Desconocido declarado' : turn.disposition === 'not_applicable' ? 'No aplicable' : turn.disposition === 'retracted' ? 'Respuesta retractada' : 'Declarado por ti'}
                    {' · '}{shownDate(turn.createdAt)} · versión {turn.version}
                    {turn.supersedesTurnId ? ' · corrige una respuesta anterior' : ''}
                  </p>
                  <p className="mt-1 text-xs text-[#6c7695]">{isAccepted(turn) ? 'Incorporada al borrador por decisión humana' : 'Registro provisional, no confirmado'}</p>
                </article>
              ))}
            </section>
            {legacy.length > 0 ? (
              <details className="rounded-xl border border-[#dce1ee] bg-white p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-[#493297]">Respuestas anteriores a este modo</summary>
                <p className="mt-2 text-xs text-[#6c7695]">Registro histórico del Anchor; no se ha migrado ni atribuido al nuevo ledger.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[#182246]">
                  {legacy.map((value, i) => <li key={i}>{value}</li>)}
                </ul>
              </details>
            ) : null}
            {activeQuestion ? (
              <section aria-label="Pregunta de Objetivo" className="rounded-2xl border border-[#decfff] border-l-[3px] border-l-[#7b59d3] bg-[#f5f0ff] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#6446c0]">Siguiente pregunta</p>
                <p className="mt-2 text-sm text-[#493297]">{activeQuestion.recap}</p>
                <h3 className="mt-2 text-lg font-semibold text-[#182246]">{activeQuestion.question}</h3>
                <p className="mt-2 text-sm text-[#6d6097]">Para qué: {activeQuestion.reasonToAsk}</p>
                {activeQuestion.provenance.length > 0 ? (
                  <details className="mt-3 text-xs text-[#493297]">
                    <summary className="cursor-pointer font-semibold">Ver evidencia del contexto E1</summary>
                    {activeQuestion.provenance.map((source) => (
                      <p key={source.reviewId} className="mt-2">
                        Cita de contexto confirmado v{source.reviewVersion}: «{source.quote}»
                      </p>
                    ))}
                  </details>
                ) : null}
              </section>
            ) : (
              <div role="status" className="rounded-xl bg-white p-4 text-sm text-[#6c7695]">
                {plan?.reason ?? 'La ficha está pendiente de revisión humana.'}
              </div>
            )}
            {pending && !isAccepted(pending) && !editingPending ? (
              <section className="rounded-xl border border-[#d9caff] bg-white p-4">
                <h3 className="font-semibold text-[#182246]">Respuesta guardada, pendiente de revisión</h3>
                <p className="mt-2 text-sm text-[#6c7695]">No se ha modificado el objetivo. Puedes incorporarla o corregirla antes de seguir.</p>
                {(() => {
                  const change = pendingChangePreview(anchor, pending);
                  return (
                    <div className="mt-3 rounded-lg border border-[#e4e7f0] bg-[#fbfcff] p-3" aria-label="Vista previa de cambios al objetivo">
                      <p className="text-xs font-semibold text-[#493297]">Antes de incorporar · {change.label}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-[#6c7695]">Valor actual</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#182246]">{change.current}</p>
                        </div>
                        <div className="rounded-lg bg-[#f5f0ff] p-3">
                          <p className="text-xs font-semibold text-[#493297]">Después de incorporar</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#182246]">{change.proposed}</p>
                        </div>
                      </div>
                      {change.unknown ? (
                        <p className="mt-2 text-xs text-[#6c7695]">
                          Esta respuesta conserva explícitamente la incertidumbre. No inventa un valor de negocio ni confirma el objetivo.
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-[#6c7695]">
                        Incorporar modifica solo el borrador de este campo. Confirmar el objetivo es una decisión posterior.
                      </p>
                    </div>
                  );
                })()}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void incorporate(pending)}
                    className="rounded-lg bg-[#6446c0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    Incorporar al borrador
                  </button>
                  <button type="button" disabled={busy} onClick={() => {
                    setEditingPending(true);
                    setAnswer(pending.inputText);
                    setDisposition(pending.disposition === 'unknown' ? 'unknown' : pending.disposition === 'not_applicable' ? 'not_applicable' : 'user_declared');
                    pendingKeyRef.current = null;
                  }} className="rounded-lg border border-[#d9caff] bg-white px-3 py-2 text-sm font-semibold text-[#493297]">
                    Corregir respuesta
                  </button>
                </div>
              </section>
            ) : null}
            {latest && isAccepted(latest) ? (
              <p role="status" className="rounded-xl border border-[#ceeae0] bg-[#eaf7f2] p-3 text-sm font-semibold text-[#276b56]">Respuesta ya incorporada</p>
            ) : null}
            {stalePending ? (
              <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Una respuesta pendiente pertenece a otra versión del objetivo. No se incorporará automáticamente. Recarga y revisa los cambios antes de continuar.
              </div>
            ) : null}
            {activeQuestion && (canWrite || isCorrecting) ? (
              <form onSubmit={(event) => void saveTurn(event)} className="space-y-3 rounded-xl border border-[#e4e7f0] bg-white p-4">
                <label className="block text-sm font-semibold text-[#182246]">
                  Tu respuesta de Objetivo
                  <textarea value={answer} maxLength={2_000} rows={3} disabled={busy}
                    onChange={(event) => { setAnswer(event.target.value); pendingKeyRef.current = null; }}
                    placeholder="Describe lo que quieres conseguir; puedes dejar algo como desconocido"
                    className="mt-2 w-full rounded-lg border border-[#dbe0ef] px-3 py-2 font-normal disabled:opacity-50" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => { setAnswer('No lo sé todavía.'); setDisposition('unknown'); pendingKeyRef.current = null; }}
                    className="rounded-lg border border-[#d9caff] px-3 py-2 text-xs font-semibold text-[#493297]">No lo sé todavía</button>
                  <button type="button" disabled={busy} onClick={() => { setAnswer('No aplica a este negocio.'); setDisposition('not_applicable'); pendingKeyRef.current = null; }}
                    className="rounded-lg border border-[#d9caff] px-3 py-2 text-xs font-semibold text-[#493297]">No aplica</button>
                  <button type="button" disabled={busy} onClick={() => { setDisposition('user_declared'); pendingKeyRef.current = null; }}
                    className="rounded-lg border border-[#dce1ee] px-3 py-2 text-xs font-semibold text-[#586582]">Respuesta propia</button>
                </div>
                {isCorrecting ? (
                  <button type="button" disabled={busy} onClick={() => {
                    setEditingPending(false);
                    setAnswer('');
                    setDisposition('user_declared');
                    pendingKeyRef.current = null;
                  }} className="rounded-lg border border-[#dce1ee] bg-white px-3 py-2 text-xs font-semibold text-[#586582]">
                    Cancelar corrección
                  </button>
                ) : null}
                <p className="text-xs text-[#6c7695]">Tipo: {disposition === 'unknown' ? 'desconocido' : disposition === 'not_applicable' ? 'no aplicable' : 'declaración propia'}. Guardar aquí no confirma ni actualiza automáticamente el Anchor.</p>
                <button type="submit" disabled={busy || !answer.trim()} className="rounded-lg bg-[#6446c0] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {submitting ? 'Guardando…' : 'Guardar respuesta provisional'}
                </button>
              </form>
            ) : null}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-[#ceeae0] bg-[#eaf7f2] p-3 text-sm text-[#276b56]">{notice}</p>}
          </>
        ) : null}
      </div>
      <aside className="min-w-0 space-y-3 rounded-xl border border-[#e4e7f0] bg-white p-4" aria-label="Ficha provisional de E2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#6446c0]">Ficha estratégica · provisional</p>
        <h3 className="text-lg font-semibold text-[#182246]">Lo que estamos construyendo</h3>
        <dl className="space-y-3 text-sm">
          {[
            ['Resultado', anchor.outcomeStatement],
            ['Contexto', anchor.contextSummary],
            ['Decisión', anchor.decisionToEnable],
            ['KPI / señal', anchor.businessSignalValue],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-[#e4e7f0] pb-2">
              <dt className="font-semibold text-[#586582]">{label}</dt>
              <dd className="mt-1 text-[#182246]">{value?.trim() || 'Por confirmar'}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-[#6c7695]">
          {snapshot?.turns.length ?? 0} respuestas registradas en el nuevo ledger.
          No se infieren metas, costes ni resultados.
        </p>
        {canConfirm && !pending && !stalePending ? (
          <button type="button" onClick={() => void confirm()} disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#182246] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <CheckCircle2 size={16} /> {confirming ? 'Confirmando…' : 'Confirmar objetivo y continuar'} <ArrowRight size={16} />
          </button>
        ) : <p className="text-xs text-[#6c7695]">La confirmación humana solo estará disponible cuando la ficha sea suficiente y no existan respuestas pendientes.</p>}
        {loadStatus === 'ready' ? (
          <button type="button" onClick={onUseGuided} className="inline-flex items-center gap-2 text-xs font-semibold text-[#493297]">
            <RotateCcw size={14} /> Usar preparación guiada
          </button>
        ) : null}
      </aside>
    </section>
  );
}
