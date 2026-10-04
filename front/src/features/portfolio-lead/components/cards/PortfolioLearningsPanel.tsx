/**
 * PortfolioLearningsPanel — "El portfolio aprende" (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §23–§24).
 * Muestra las últimas decisiones organizacionales y lo que dejaron en cada Reto: cómo cambió la
 * cobertura, el aprendizaje y la siguiente acción. Sólo lectura sobre GET /portfolio/home.
 */
import React, { useEffect, useState } from 'react';
import { listPortfolioLearnings, type PortfolioLearning } from '../../../../app/services/portfolioService';

export const DECISION_OUTCOME_LABEL: Record<string, string> = {
  implement: 'Implementar',
  scale: 'Escalar',
  continue_experimenting: 'Seguir experimentando',
  pause: 'Pausar',
  close_with_learning: 'Cerrar con aprendizaje',
};

export const COVERAGE_LABEL: Record<string, string> = {
  sin_cobertura: 'sin cobertura',
  cobertura_parcial: 'cobertura parcial',
  cobertura_suficiente: 'cobertura suficiente',
  reformular: 'a reformular',
  resuelto: 'resuelto',
  cerrar: 'a cerrar',
};

export function PortfolioLearningsPanel() {
  const [learnings, setLearnings] = useState<PortfolioLearning[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPortfolioLearnings()
      .then((data) => !cancelled && setLearnings(data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-ds-lg border border-border-default bg-surface-default p-6 md:p-7" aria-label="Lo que aprendió el portfolio">
      <h2 className="text-xl font-semibold text-text-primary">Lo que aprendió el portfolio</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Cada decisión vuelve a su reto y su frente: cómo cambió la cobertura, qué se aprendió y qué sigue.
      </p>
      {error ? <p role="alert" className="mt-4 text-sm text-rose-700">No pudimos cargar los aprendizajes.</p> : null}
      {!learnings && !error ? <p role="status" className="mt-4 text-sm text-slate-500">Cargando…</p> : null}
      {learnings && learnings.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Todavía no hay decisiones organizacionales registradas.</p>
      ) : null}
      {learnings && learnings.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {learnings.map((item) => (
            <li key={item.decisionId} className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="portfolio-learning">
              <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                {DECISION_OUTCOME_LABEL[item.outcome] ?? item.outcome} · {item.initiativeName ?? 'Iniciativa'}
                {item.challengeTitle ? <span className="text-slate-500"> — {item.challengeTitle}</span> : null}
              </p>
              {item.coverageBefore && item.coverageAfter ? (
                <p className="mt-1 text-xs text-slate-500">
                  Cobertura del reto: {COVERAGE_LABEL[item.coverageBefore] ?? item.coverageBefore} → {COVERAGE_LABEL[item.coverageAfter] ?? item.coverageAfter}
                </p>
              ) : null}
              {item.learning ? <p className="mt-2 text-sm text-slate-700">{item.learning}</p> : null}
              {item.nextAction ? <p className="mt-1 text-sm text-slate-600">Siguiente: {item.nextAction}</p> : null}
              {item.suggestedReformulation ? (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{item.suggestedReformulation}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
