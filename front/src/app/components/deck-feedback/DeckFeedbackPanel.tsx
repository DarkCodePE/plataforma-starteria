import React, { useEffect, useRef, useState } from 'react';
import { analyzeDeck, listDeckFeedback, type DeckFeedback } from '../../services/deckFeedbackService';

// Feedback IA del deck del Step 4. Antes mostraba un texto fijo sin leer el archivo; ahora sube el
// PDF y la IA lo contrasta con lo que el equipo confirmó en Steps 0–3. Cada análisis cuesta un
// crédito de mentor; si la IA no responde, no se cobra.

const ERROR_COPY: Record<string, string> = {
  NO_MENTOR_CREDITS: 'No quedan créditos de mentor. Pide más al Portfolio Lead.',
  DECK_FEEDBACK_UNAVAILABLE: 'No pudimos analizar el deck. No se descontó ningún crédito; vuelve a intentarlo en unos minutos.',
  PDF_MIME_INVALID: 'El archivo no es un PDF. Exporta la presentación como PDF.',
  PDF_TOO_LARGE: 'El PDF pesa más de 50 MB.',
  PDF_EMPTY: 'El archivo está vacío.',
};

function errorMessage(err: unknown): string {
  const error = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response?.data?.error;
  return (error?.code && ERROR_COPY[error.code]) || error?.message || 'No pudimos analizar el deck.';
}

function List({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={`${tone} text-xs mb-1`} style={{ fontWeight: 700 }}>{title}</p>
      <ul className="list-disc pl-4 space-y-1 text-slate-600">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export function DeckFeedbackPanel({
  projectId,
  canEdit,
  mentorCredits,
  onAnalyzed,
  onFeedbackChange,
}: {
  projectId: string;
  canEdit: boolean;
  mentorCredits?: number;
  /** Después de un análisis: se descontó un crédito. */
  onAnalyzed?: () => void;
  /** El último análisis (o null), para el checklist y el resumen del Step 4. */
  onFeedbackChange?: (feedback: DeckFeedback | null) => void;
}) {
  const [feedback, setFeedback] = useState<DeckFeedback | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listDeckFeedback(projectId)
      .then((items) => { if (!cancelled) setFeedback(items[0] ?? null); })
      .catch(() => { if (!cancelled) setFeedback(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => { onFeedbackChange?.(feedback); }, [feedback, onFeedbackChange]);

  const noCredits = mentorCredits !== undefined && mentorCredits <= 0;

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      setFeedback(await analyzeDeck(projectId, file));
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onAnalyzed?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const result = feedback?.result;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
        {canEdit ? (
          <>
            <label className="block text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }} htmlFor="deck-feedback-file">
              PDF de la presentación
            </label>
            <input
              id="deck-feedback-file"
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm"
            />
            <button
              onClick={analyze}
              disabled={!file || analyzing || noCredits}
              className="mt-3 w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontWeight: 500 }}
            >
              {analyzing ? 'Analizando el deck…' : 'Analizar con IA (1 crédito)'}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              {noCredits
                ? 'No quedan créditos de mentor. Pide más al Portfolio Lead.'
                : 'La IA lee el deck contra lo que confirmaste en Steps 0–3. Si no responde, no se descuenta el crédito.'}
            </p>
            {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
          </>
        ) : (
          <p className="text-sm text-slate-500">El equipo de la iniciativa sube el deck y lo analiza; acá ves el último resultado.</p>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-3" style={{ fontWeight: 600 }}>
          Feedback IA{feedback ? ` · ${feedback.fileName}` : ''}
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : result ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">{result.summary}</p>
            {result.deckTruncated && <p className="text-xs text-amber-700">El deck es largo: se leyó sólo la primera parte.</p>}
            <List title="Qué está bien" tone="text-emerald-700" items={result.goodPoints} />
            <List title="Qué falta" tone="text-amber-700" items={result.missing} />
            <List
              title="Lo que el análisis no respalda"
              tone="text-rose-700"
              items={result.unsupportedClaims.map((item) => `${item.claim} — ${item.why}`)}
            />
            <List title="Contradicciones con lo decidido" tone="text-rose-700" items={result.inconsistencies} />
            <div>
              <p className="text-indigo-700 text-xs mb-1" style={{ fontWeight: 700 }}>Siguiente acción recomendada</p>
              <p className="text-slate-600">{result.nextAction}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Sube el PDF para revisar si el deck cuenta lo que el análisis respalda: evidencia, decisión y pedido final.
          </p>
        )}
      </div>
    </div>
  );
}
