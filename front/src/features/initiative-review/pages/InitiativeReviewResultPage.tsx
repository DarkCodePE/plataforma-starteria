/**
 * InitiativeReviewResultPage - revisión guiada API-backed.
 * Muestra el snapshot real, permite responder preguntas/agregar contexto y confirma
 * la ruta para crear la iniciativa Draft antes de aterrizar en Overview.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  addContext,
  addDocument,
  confirmRoute,
  getReview,
  saveStrategicAnswers,
  type InitiativeReview,
} from '../services/initiativeReviewClient';
import { ReviewDocumentDropzone } from '../components/ReviewDocumentDropzone';
import { trackInitialReviewEvent } from '../services/initialReviewTelemetry';
import {
  UnderstandingSummaryCard,
  ChallengeTypeCard,
  CritiqueCard,
  QuestionsCard,
  ImprovedProposalCard,
  RoutePreviewCard,
  sectionAnchorId,
} from '../components/ReviewCards';
import type { ReviewSnapshot, SnapshotSectionId } from '../services/initiativeReviewClient';
import { AssistantPanel, type ChatMessage } from '../components/chat/AssistantPanel';
import {
  composeConversation,
  deriveAgenda,
  defaultMode,
  nextAction,
  SECTION_LABEL as SECTION_LABEL_UI,
  type AssistantMode,
} from '../services/assistantOrchestrator';
import { isInitiativeReviewChatEnabled } from '../../../app/featureFlags';

export function InitiativeReviewResultPage() {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState<InitiativeReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [contextText, setContextText] = useState('');
  const [addingContext, setAddingContext] = useState(false);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  // IRC-04: modo del chat (null = por defecto contextual) y dudas transitorias (no persistidas).
  const [chatMode, setChatMode] = useState<AssistantMode | null>(null);
  const [transientDoubts, setTransientDoubts] = useState<ChatMessage[]>([]);
  // IRC-05: secciones resaltadas tras la última regeneración (changedSections del backend).
  const [highlighted, setHighlighted] = useState<SnapshotSectionId[]>([]);
  // v2: sección enfocada para refinar (estado direccionable del "harness"). null = sin foco.
  const [focusedSection, setFocusedSection] = useState<SnapshotSectionId | null>(null);

  // IRC-05: al resaltar, desplaza el panel a la primera sección cambiada. Debe declararse
  // con el resto de hooks (antes de cualquier early return) para no violar reglas de hooks.
  useEffect(() => {
    if (highlighted.length === 0) return;
    const el = typeof document !== 'undefined' ? document.getElementById(sectionAnchorId(highlighted[0])) : null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);

  useEffect(() => {
    let cancelled = false;
    if (!reviewId) return;
    (async () => {
      try {
        const r = await getReview(reviewId);
        if (!cancelled) {
          setReview(r);
          if (r.snapshot) {
            trackInitialReviewEvent('initial_review_generated', {
              reviewId: r.id,
              snapshotId: r.snapshot.id,
              snapshotVersion: r.snapshot.version,
            });
            trackInitialReviewEvent('route_preview_viewed', {
              reviewId: r.id,
              snapshotId: r.snapshot.id,
              snapshotVersion: r.snapshot.version,
            });
          }
        }
      } catch {
        if (!cancelled) setError('No pudimos cargar la revisión.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const onAddContext = async () => {
    if (!reviewId || !contextText.trim() || addingContext) return;
    setAddingContext(true);
    setError(null);
    try {
      const next = await addContext(reviewId, contextText.trim());
      setReview(next);
      setContextText('');
      trackInitialReviewEvent('initial_review_context_added', {
        reviewId,
        snapshotId: next.snapshot?.id,
        snapshotVersion: next.snapshot?.version,
        contextCount: next.addedContext.length,
      });
    } catch {
      setError('No pudimos agregar ese contexto. Intenta nuevamente.');
    } finally {
      setAddingContext(false);
    }
  };

  const onAnswerQuestion = async (questionId: string, answer: string, unknown = false) => {
    if (!reviewId || answeringQuestionId) return;
    setAnsweringQuestionId(questionId);
    setError(null);
    try {
      const next = await saveStrategicAnswers(reviewId, [{ id: questionId, ...(unknown ? { unknown: true } : { answer }) }]);
      setReview(next);
      trackInitialReviewEvent('initial_review_question_answered', {
        reviewId,
        questionId,
        unknown,
        snapshotId: next.snapshot?.id,
        snapshotVersion: next.snapshot?.version,
      });
    } catch {
      setError('No pudimos guardar la respuesta. Intenta nuevamente.');
    } finally {
      setAnsweringQuestionId(null);
    }
  };

  const onConfirm = async () => {
    if (!reviewId || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmRoute(reviewId);
      trackInitialReviewEvent('route_confirmed', {
        reviewId,
        initiativeId: result.initiativeId,
        snapshotId: review?.snapshot?.id,
        snapshotVersion: review?.snapshot?.version,
      });
      trackInitialReviewEvent('initiative_created_from_route', {
        reviewId,
        initiativeId: result.initiativeId,
        snapshotId: review?.snapshot?.id,
        snapshotVersion: review?.snapshot?.version,
      });
      navigate(result.overviewUrl);
    } catch {
      trackInitialReviewEvent('route_confirm_failed', { reviewId });
      setError('No pudimos crear la iniciativa. Intenta nuevamente.');
      setConfirming(false);
    }
  };

  if (loading) return <div role="status" className="p-8 text-slate-500">Revisando tu propuesta...</div>;
  if (error && !review) return <div role="alert" className="p-8 text-red-600">{error}</div>;
  if (!review?.snapshot) return <div role="alert" className="p-8 text-red-600">La revisión aún no está lista.</div>;

  const snapshot = review.snapshot;
  const chatEnabled = isInitiativeReviewChatEnabled();

  // IRC-04: orquestador determinista. La agenda y los mensajes se derivan del review; cada
  // turno del usuario se traduce a add-context / strategic-answers según el modo.
  const agenda = deriveAgenda(review);
  const effectiveMode: AssistantMode = chatMode ?? defaultMode(agenda);

  // v2: seleccionar/deseleccionar una sección para refinarla desde el chat. Estado direccionable.
  const onRefineSection = (id: SnapshotSectionId) => {
    if (focusedSection === id) {
      setFocusedSection(null);
      setChatMode(null);
      return;
    }
    setFocusedSection(id);
    setChatMode('refine');
    const el = typeof document !== 'undefined' ? document.getElementById(sectionAnchorId(id)) : null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };

  const onChatSend = async (text: string) => {
    if (!reviewId || addingContext) return;
    const action = nextAction(effectiveMode, agenda, text, focusedSection);
    trackInitialReviewEvent('chat_message_sent', { reviewId, mode: effectiveMode }); // IRC-06

    // Las dudas se resuelven en cliente (catálogo), sin llamada a la API (ADR-026 dec. 2).
    if (action.type === 'doubt') {
      const stamp = `${transientDoubts.length}`;
      setTransientDoubts((prev) => [
        ...prev,
        { id: `doubt-u-${stamp}`, role: 'user', content: action.question },
        { id: `doubt-a-${stamp}`, role: 'assistant', content: action.answer },
      ]);
      return;
    }

    setAddingContext(true);
    setError(null);
    try {
      let next;
      if (action.type === 'answer') {
        next = await saveStrategicAnswers(reviewId, [{ id: action.questionId, answer: action.answer }]);
        trackInitialReviewEvent('initial_review_question_answered', { reviewId, questionId: action.questionId });
        trackInitialReviewEvent('chat_question_answered', { reviewId, questionId: action.questionId });
      } else if (action.type === 'answer_unknown') {
        next = await saveStrategicAnswers(reviewId, [{ id: action.questionId, unknown: true }]);
        trackInitialReviewEvent('initial_review_question_answered', { reviewId, questionId: action.questionId, unknown: true });
        trackInitialReviewEvent('chat_question_answered', { reviewId, questionId: action.questionId, unknown: true });
      } else if (action.type === 'refine_section') {
        // v2: refina SOLO la sección enfocada (el backend hace el splice determinista).
        next = await addContext(reviewId, action.text, action.sectionId);
        trackInitialReviewEvent('chat_context_added', { reviewId, snapshotVersion: next.snapshot?.version, contextCount: next.addedContext.length, mode: 'refine' });
      } else {
        next = await addContext(reviewId, action.text);
        trackInitialReviewEvent('initial_review_context_added', {
          reviewId,
          snapshotId: next.snapshot?.id,
          snapshotVersion: next.snapshot?.version,
          contextCount: next.addedContext.length,
        });
        trackInitialReviewEvent('chat_context_added', { reviewId, snapshotVersion: next.snapshot?.version, contextCount: next.addedContext.length });
      }
      setReview(next);
      const changed = next.changedSections ?? [];
      setHighlighted(changed); // IRC-05: resalta las cards que cambiaron
      if (changed.length > 0) {
        trackInitialReviewEvent('snapshot_diff_announced', { reviewId, snapshotVersion: next.snapshot?.version, changedCount: changed.length }); // IRC-06
      }
      setChatMode(null); // vuelve al modo por defecto contextual tras cada turno
      setFocusedSection(null); // v2: limpia el foco tras un turno exitoso
    } catch {
      setError('No pudimos procesar tu mensaje. Intenta nuevamente.');
      // IRC-05: el fallo también se muestra en el chat, con invitación a reintentar.
      setTransientDoubts((prev) => [
        ...prev,
        { id: `err-${prev.length}`, role: 'assistant', content: 'No pude actualizar tu iniciativa (puede ser una demora del servicio). Vuelve a enviar tu mensaje e intento de nuevo.' },
      ]);
    } finally {
      setAddingContext(false);
    }
  };

  // v2: subir un documento como contexto → el backend extrae el texto y regenera la iniciativa.
  const onDocumentUpload = async (file: File) => {
    if (!reviewId || addingContext) return;
    setAddingContext(true);
    setError(null);
    trackInitialReviewEvent('chat_message_sent', { reviewId, mode: 'document' });
    try {
      const next = await addDocument(reviewId, file);
      setReview(next);
      const changed = next.changedSections ?? [];
      setHighlighted(changed);
      trackInitialReviewEvent('chat_context_added', { reviewId, snapshotVersion: next.snapshot?.version, contextCount: next.addedContext.length, mode: 'document' });
      if (changed.length > 0) {
        trackInitialReviewEvent('snapshot_diff_announced', { reviewId, snapshotVersion: next.snapshot?.version, changedCount: changed.length });
      }
    } catch {
      setError('No pudimos procesar ese documento. Revisa el formato/tamaño e intenta de nuevo.');
      setTransientDoubts((prev) => [
        ...prev,
        { id: `docerr-${prev.length}`, role: 'assistant', content: 'No pude leer ese documento. Acepto PDF, Word (.docx) o texto (.txt/.md) de hasta 10 MB.' },
      ]);
    } finally {
      setAddingContext(false);
    }
  };

  const chatMessages: ChatMessage[] = composeConversation(review, transientDoubts);

  const MODE_LABEL: Record<AssistantMode, string> = { answer: 'Responder', context: 'Agregar contexto', doubt: 'Tengo una duda', refine: 'Refinar sección' };
  const MODE_PLACEHOLDER: Record<AssistantMode, string> = {
    answer: 'Escribe tu respuesta (o "no lo sé aún")…',
    context: 'Cuéntame qué falta: restricciones, recursos, alcance…',
    doubt: 'Pregúntame sobre el análisis o la ruta…',
    refine: focusedSection ? `¿Cómo mejoro «${SECTION_LABEL_UI[focusedSection]}»?` : 'Elige una sección con "Refinar"…',
  };
  // El modo 'refine' solo aparece cuando hay una sección enfocada (estado del harness).
  const availableModes: AssistantMode[] = focusedSection ? ['refine', 'answer', 'context', 'doubt'] : ['answer', 'context', 'doubt'];
  const modeToolbar = (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Modo de mensaje">
      {focusedSection && (
        <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
          Refinando: {SECTION_LABEL_UI[focusedSection]}
          <button type="button" data-testid="refine-cancel" onClick={() => { setFocusedSection(null); setChatMode(null); }} aria-label="Cancelar refinamiento" className="ml-0.5 text-indigo-500 hover:text-indigo-800">✕</button>
        </span>
      )}
      {availableModes.map((m) => {
        const disabledMode = m === 'answer' && !agenda.activeQuestion;
        const active = effectiveMode === m;
        return (
          <button
            key={m}
            type="button"
            data-testid={`chat-mode-${m}`}
            disabled={disabledMode}
            aria-pressed={active}
            onClick={() => setChatMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );

  // Contenido de la columna de la iniciativa (izquierda). La sección de "Agregar contexto"
  // por textarea se oculta cuando el chat está activo: el asistente cumple esa función.
  const snapshotColumn = (
    <>
      <div className="grid gap-4">
        <GenerationModeNotice mode={snapshot.generationMode} />
        <UnderstandingSummaryCard snapshot={snapshot} highlighted={highlighted.includes('understanding')} onRefine={onRefineSection} isFocused={focusedSection === 'understanding'} />
        <ChallengeTypeCard snapshot={snapshot} highlighted={highlighted.includes('challengeType')} onRefine={onRefineSection} isFocused={focusedSection === 'challengeType'} />
        <CritiqueCard snapshot={snapshot} highlighted={highlighted.includes('critique')} onRefine={onRefineSection} isFocused={focusedSection === 'critique'} />
        <QuestionsCard snapshot={snapshot} answeringQuestionId={answeringQuestionId} onAnswer={onAnswerQuestion} highlighted={highlighted.includes('questions')} />
        <ImprovedProposalCard snapshot={snapshot} highlighted={highlighted.includes('improvedProposal')} onRefine={onRefineSection} isFocused={focusedSection === 'improvedProposal'} />
        <RoutePreviewCard snapshot={snapshot} highlighted={highlighted.includes('routePreview')} />
      </div>

      {review.companyContext?.companyId && (
        <section className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="text-sm font-semibold text-indigo-900">Como influyo el contexto de tu empresa</h2>
          <p className="mt-2 text-sm text-indigo-800">
            Al confirmar esta ruta, Starteria creara un snapshot versionado del contexto de empresa seleccionado y lo usara para ajustar esfuerzo, riesgos, actores, indicadores, viabilidad y lenguaje de la iniciativa.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-indigo-800">
            <li>Informacion considerada: empresa seleccionada, area opcional, fuentes procesadas y version disponible al confirmar.</li>
            <li>Informacion faltante: aprobaciones internas, recursos disponibles y criterios de escalamiento si no han sido completados.</li>
            <li>La informacion agregada aqui no actualiza automaticamente el contexto de empresa.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setContextText('Agregar solo a este analisis: ')}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Agregar solo a este analisis
            </button>
            <a
              href="/companies"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Completar contexto de empresa
            </a>
          </div>
        </section>
      )}

      {!chatEnabled && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Agregar contexto antes de confirmar</h2>
          <p className="mt-2 text-sm text-slate-600">
            Si falta información clave, agrega restricciones, recursos, alcance o señales esperadas. Starteria regenerará el snapshot y mantendrá historial.
          </p>
          <textarea
            aria-label="Agregar contexto antes de confirmar"
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            rows={3}
            placeholder="Ejemplo: solo tenemos dos semanas, el equipo disponible es de operaciones y legal debe aprobar cambios."
            className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          <button
            type="button"
            onClick={onAddContext}
            disabled={!contextText.trim() || addingContext}
            className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addingContext ? 'Actualizando revisión...' : 'Actualizar revisión'}
          </button>
        </section>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={onConfirm}
        disabled={confirming}
        className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {confirming ? 'Creando tu iniciativa...' : 'Estoy de acuerdo con esta ruta'}
      </button>
    </>
  );

  const heading = (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-semibold text-slate-900">Revisemos tu iniciativa antes de empezar</h1>
      {chatEnabled && snapshot && (
        <span data-testid="snapshot-version" className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          Versión {snapshot.version}
        </span>
      )}
    </div>
  );

  // Flag OFF: layout de una columna (comportamiento actual, sin cambios).
  if (!chatEnabled) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        {heading}
        <div className="mt-6">{snapshotColumn}</div>
      </div>
    );
  }

  // Flag ON (ADR-026): asistente a la IZQUIERDA, iniciativa a la derecha. En <1024px el
  // chat se apila arriba y la iniciativa debajo (orden del DOM = orden del stack).
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      {heading}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        <div className="h-[70vh] lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
          <AssistantPanel
            messages={chatMessages}
            onSend={onChatSend}
            busy={addingContext}
            placeholder={MODE_PLACEHOLDER[effectiveMode]}
            toolbar={modeToolbar}
            footer={
              <div className="grid gap-2">
                <ReviewDocumentDropzone onUpload={onDocumentUpload} busy={addingContext} />
                <button
                  type="button"
                  data-testid="chat-confirm-route"
                  onClick={() => {
                    trackInitialReviewEvent('chat_confirm_route', { reviewId });
                    onConfirm();
                  }}
                  disabled={confirming}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
                    agenda.ready ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500/80 hover:bg-emerald-600'
                  }`}
                >
                  {confirming ? 'Creando tu iniciativa...' : agenda.ready ? 'Confirmar ruta y empezar' : 'Confirmar ruta (o sigue completando)'}
                </button>
              </div>
            }
          />
        </div>
        <div className="min-w-0">{snapshotColumn}</div>
      </div>
    </div>
  );
}

/**
 * Auditoría E2E F-07: si la revisión la armó la plantilla (el modelo falló o la IA no está
 * activa), se dice. Antes se presentaba igual que un análisis.
 */
export function GenerationModeNotice({ mode }: { mode?: ReviewSnapshot['generationMode'] }) {
  if (mode !== 'fallback' && mode !== 'deterministic') return null;
  return (
    <div role="note" data-testid="generation-mode-notice" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p style={{ fontWeight: 700 }}>
        {mode === 'fallback' ? 'Esta revisión es una versión básica: el análisis con IA no respondió.' : 'Esta revisión es una versión básica, sin análisis con IA.'}
      </p>
      <p className="mt-1">
        Ordena lo que escribiste con una plantilla; no evalúa tu caso en profundidad. {mode === 'fallback' ? 'Agrega contexto o vuelve a intentarlo en unos minutos para obtener el análisis completo.' : 'Úsala como punto de partida y complétala en el Step 0.'}
      </p>
    </div>
  );
}
