/**
 * PortfolioCapacityPanel — "¿Dónde está puesta la capacidad?" (E2E Job-Driven §4/§24, Core §17).
 * Lectura: reparto de iniciativas activas por frente y señales para reasignar. La reasignación
 * la decide una persona; Starteria no mueve personas ni presupuesto.
 */
import React, { useEffect, useState } from 'react';
import { getPortfolioCapacity, type PortfolioCapacityReading } from '../../../../app/services/portfolioService';

export function PortfolioCapacityPanel() {
  const [reading, setReading] = useState<PortfolioCapacityReading | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPortfolioCapacity()
      .then((data) => !cancelled && setReading(data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-ds-lg border border-border-default bg-surface-default p-6 md:p-7" aria-label="Dónde está puesta la capacidad">
      <h2 className="text-xl font-semibold text-text-primary">¿Dónde está puesta la capacidad?</h2>
      <p className="mt-2 text-sm text-text-secondary">Iniciativas activas por frente, frente a su prioridad. Las señales son para decidir dónde reasignar.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-rose-700">No pudimos leer la capacidad del portafolio.</p> : null}
      {!reading && !error ? <p role="status" className="mt-4 text-sm text-slate-500">Cargando…</p> : null}
      {reading ? (
        <>
          <ul className="mt-4 space-y-2">
            {reading.fronts.map((front) => (
              <li key={front.frontId} className="flex items-center gap-3 text-sm" data-testid="capacity-front">
                <span className="w-48 truncate font-semibold text-slate-900">{front.name}</span>
                <span className="w-20 text-xs text-slate-500">Prioridad {front.priority.toLowerCase()}</span>
                <span className="h-2 flex-1 rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-2 rounded-full bg-indigo-500" style={{ width: `${Math.round(front.share * 100)}%` }} />
                </span>
                <span className="w-28 text-right text-xs text-slate-600">{front.activeInitiatives} iniciativa(s) activa(s)</span>
              </li>
            ))}
          </ul>
          {reading.signals.length > 0 ? (
            <ul className="mt-4 space-y-1">
              {reading.signals.map((signal) => (
                <li key={`${signal.kind}-${signal.challengeId ?? signal.frontId}`} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="capacity-signal">
                  {signal.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Sin señales de reasignación por ahora.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">{reading.note}</p>
        </>
      ) : null}
    </section>
  );
}
