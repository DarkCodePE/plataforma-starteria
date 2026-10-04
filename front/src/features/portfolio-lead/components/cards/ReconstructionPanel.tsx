/**
 * ReconstructionPanel — "Ya existe mucho trabajo" (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §14).
 * La persona describe un piloto o iniciativa en curso y su evidencia; Starteria devuelve qué se puede
 * sostener, contradicciones, gaps y la siguiente incertidumbre, sin reiniciar el método.
 */
import React, { useState } from 'react';
import { reconstructExistingWork, type ReconstructionReading } from '../../../../app/services/portfolioService';

type EvidenceRow = { summary: string; classification: 'supports' | 'contradicts' | 'insufficient' };

const GATE_LABEL = { met: 'Se sostiene', partial: 'Parcial', missing: 'Falta' } as const;

export function ReconstructionPanel() {
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [evidence, setEvidence] = useState<EvidenceRow[]>([{ summary: '', classification: 'supports' }]);
  const [reading, setReading] = useState<ReconstructionReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateRow = (index: number, patch: Partial<EvidenceRow>) =>
    setEvidence((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      setReading(await reconstructExistingWork({ name, summary, evidence: evidence.filter((row) => row.summary.trim()) }));
    } catch {
      setError('No pudimos leer este trabajo. Revisa que tenga nombre y descripción.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" aria-label="Reconstruir trabajo existente">
      <label className="block text-sm font-semibold text-slate-800">
        Nombre del trabajo
        <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold text-slate-800">
        ¿Qué se hizo y dónde está hoy?
        <textarea className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800">Evidencia que ya tienen</legend>
        {evidence.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label={`Evidencia ${index + 1}`}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={row.summary}
              onChange={(e) => updateRow(index, { summary: e.target.value })}
            />
            <select
              aria-label={`Qué indica la evidencia ${index + 1}`}
              className="rounded-xl border border-slate-200 px-2 text-sm"
              value={row.classification}
              onChange={(e) => updateRow(index, { classification: e.target.value as EvidenceRow['classification'] })}
            >
              <option value="supports">A favor</option>
              <option value="contradicts">En contra</option>
              <option value="insufficient">No concluyente</option>
            </select>
          </div>
        ))}
        <button type="button" className="text-sm font-semibold text-slate-600" onClick={() => setEvidence((rows) => [...rows, { summary: '', classification: 'supports' }])}>
          + Agregar evidencia
        </button>
      </fieldset>
      <button
        type="button"
        disabled={loading || name.trim().length < 2 || !summary.trim()}
        onClick={submit}
        className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Leer qué podemos sostener
      </button>
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}

      {reading ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="reconstruction-reading">
          <p className="text-xs text-slate-500">Lectura sobre lo que declaraste: nada se valida ni se crea por importarlo.</p>
          <div>
            <p className="text-sm font-semibold text-slate-900">Lo que ya se puede sostener</p>
            {reading.sustainableClaims.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{reading.sustainableClaims.map((c) => <li key={c.claim}>{c.claim}</li>)}</ul>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Todavía nada con evidencia a favor.</p>
            )}
          </div>
          {reading.contradictions.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-amber-900">Contradicciones</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
                {reading.contradictions.map((c) => <li key={`${c.supports}|${c.contradicts}`}>{c.supports} ↔ {c.contradicts}</li>)}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="text-sm font-semibold text-slate-900">Dónde está cada paso</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {reading.gates.map((gate) => (
                <li key={gate.step}>Step {gate.step} · {gate.question} — <strong>{GATE_LABEL[gate.status]}</strong></li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-slate-900"><strong>Siguiente incertidumbre material:</strong> {reading.nextMaterialUncertainty}</p>
          <p className="text-sm text-slate-600">No hace falta empezar de cero: se retoma desde Step {reading.suggestedReentryStep}.</p>
        </section>
      ) : null}
    </div>
  );
}
