/**
 * ChallengeCoverageReadingPanel — el Reto como unidad de cobertura.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §13. Sólo lectura sobre
 * GET /portfolio/challenges/:id/coverage-reading.
 */
import React, { useEffect, useState } from 'react';
import { getChallengeCoverageReading, type ChallengeCoverageReading } from '../../../../app/services/portfolioService';
import { DECISION_OUTCOME_LABEL } from './PortfolioLearningsPanel';

function Row({ question, answer, tone = 'slate' }: { question: string; answer: React.ReactNode; tone?: 'slate' | 'amber' | 'emerald' }) {
  const color = tone === 'amber' ? 'text-amber-800' : tone === 'emerald' ? 'text-emerald-800' : 'text-slate-800';
  return (
    <div className="grid gap-1 border-t border-slate-100 py-2.5 first:border-t-0 md:grid-cols-[minmax(0,14rem)_1fr] md:gap-4">
      <dt className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{question}</dt>
      <dd className={`text-sm ${color}`}>{answer}</dd>
    </div>
  );
}

export function ChallengeCoverageReadingPanel({ challengeId }: { challengeId: string }) {
  const [reading, setReading] = useState<ChallengeCoverageReading | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getChallengeCoverageReading(challengeId)
      .then((data) => !cancelled && setReading(data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Lectura de cobertura del reto">
      <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Lectura de cobertura</p>
      {error ? <p role="alert" className="mt-2 text-sm text-rose-700">No pudimos leer la cobertura de este reto.</p> : null}
      {!reading && !error ? <p role="status" className="mt-2 text-sm text-slate-500">Leyendo cobertura…</p> : null}
      {reading ? (
        <dl className="mt-2">
          <Row
            question="¿Hay trabajo abordándolo?"
            answer={reading.hasWork ? `Sí, ${reading.initiatives.length} iniciativa(s).` : 'No, ninguna iniciativa todavía.'}
            tone={reading.hasWork ? 'slate' : 'amber'}
          />
          <Row question="¿Qué sigue sin respuesta?" answer={reading.uncovered ?? 'Todo el reto tiene al menos una iniciativa.'} tone={reading.uncovered ? 'amber' : 'slate'} />
          <Row
            question="¿Varias iniciativas sobre lo mismo?"
            answer={reading.overlaps.length === 0 ? 'Sin solapamientos registrados.' : reading.overlaps.map((overlap) => `${overlap.level} → ${overlap.recommendation}`).join(' · ')}
            tone={reading.overlaps.some((overlap) => overlap.level !== 'bajo') ? 'amber' : 'slate'}
          />
          <Row
            question="¿Dependencia común?"
            answer={reading.commonDependencies.length > 0 ? reading.commonDependencies.join(' · ') : 'Ninguna detectada.'}
          />
          <Row
            question="¿Qué evidencia tenemos como conjunto?"
            answer={`Contribución alta ${reading.aggregateEvidence.contributionByLevel.alto}, media ${reading.aggregateEvidence.contributionByLevel.medio}, baja ${reading.aggregateEvidence.contributionByLevel.bajo} · ${reading.aggregateEvidence.partialSignals} con señal parcial · ${reading.aggregateEvidence.withRecommendation} con recomendación`}
          />
          <Row
            question="¿Necesitamos más capacidad?"
            answer={reading.needsMoreCapacity.value ? reading.needsMoreCapacity.reasons.join(' ') : 'No por ahora.'}
            tone={reading.needsMoreCapacity.value ? 'amber' : 'slate'}
          />
          <Row
            question="¿Estamos listos para decidir?"
            answer={`${reading.readyToDecide.value ? 'Sí.' : 'Todavía no.'} ${reading.readyToDecide.reasons.join(' ')}`}
            tone={reading.readyToDecide.value ? 'emerald' : 'slate'}
          />
          <Row
            question="¿Qué decisiones ya se tomaron?"
            answer={
              reading.decisions && reading.decisions.length > 0
                ? reading.decisions.map((decision) => `${DECISION_OUTCOME_LABEL[decision.outcome] ?? decision.outcome}${decision.learning ? `: ${decision.learning}` : ''}`).join(' · ')
                : 'Ninguna todavía.'
            }
          />
        </dl>
      ) : null}
    </section>
  );
}
