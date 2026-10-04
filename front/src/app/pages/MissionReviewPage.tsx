/**
 * MissionReviewPage — "¿Qué estoy asumiendo exactamente?" (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §18).
 *
 * Va entre el overview de la iniciativa y Step 0: Start no abre directamente un formulario
 * de Step 0. Sólo lectura sobre GET /projects/:id/mission-review; lo que falta se muestra
 * como "Sin definir" en vez de ocultarse, porque saber qué falta es parte de asumir el mandato.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getMissionReview, type MissionReview } from '../../features/adaptive-core/services/adaptiveCoreService';
import { STEP_PROGRESS_QUESTION } from '../../features/adaptive-core/domain/adaptiveCore';

const UNDEFINED_COPY = 'Sin definir';

function Field({ label, value }: { label: string; value: string | null | string[] }) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="mission-review-field">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 text-sm text-slate-800">
        {items.length === 0 ? (
          <span className="text-slate-400">{UNDEFINED_COPY}</span>
        ) : items.length === 1 ? (
          items[0]
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

/**
 * Contexto de Aplicación (E2E Job-Driven §16): dónde pretende generar valor la iniciativa. Opcional;
 * no prueba alineamiento con ninguna estrategia de esa organización.
 */
export function ApplicationContextCard({ review }: { review: Pick<MissionReview, 'applicationContext' | 'independent'> }) {
  const context = review.applicationContext;
  if (!context && !review.independent) return null;
  return (
    <section className="mt-6 rounded-lg border border-sky-200 bg-sky-50 p-4" aria-label="Contexto de aplicación">
      <h2 className="text-sm font-semibold text-sky-900">Contexto de aplicación</h2>
      {context ? (
        <>
          <p className="mt-1 text-sm text-sky-900">
            {context.companyName}
            {context.area ? ` · ${context.area}` : ''}
          </p>
          {context.restrictions.length > 0 ? (
            <p className="mt-2 text-sm text-sky-900">Restricciones de la organización: {context.restrictions.join(' · ')}</p>
          ) : null}
          {context.actors.length > 0 ? <p className="mt-1 text-sm text-sky-900">Actores: {context.actors.join(' · ')}</p> : null}
          {context.lowCoverage ? (
            <p className="mt-2 text-xs text-sky-800">
              El contexto de la organización todavía es parcial ({context.coverage}%). Se completa a medida que avanzas.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-sky-900">
          Todavía no elegiste en qué organización quieres generar valor. No es obligatorio: puedes agregarlo cuando lo tengas claro.
        </p>
      )}
      <p className="mt-2 text-xs text-sky-700">Es contexto para tu iniciativa, no una alineación con la estrategia de esa organización.</p>
    </section>
  );
}

function inheritedLines(review: MissionReview): string[] {
  const { strategicFront, challenge, initiativeContext } = review.inheritedContext;
  return [
    strategicFront &&
      [`Frente: ${strategicFront.name}`, strategicFront.kpi && `KPI ${strategicFront.kpi}`, strategicFront.target && `meta ${strategicFront.target}`, strategicFront.horizon]
        .filter(Boolean)
        .join(' · '),
    challenge && [`Reto: ${challenge.title}`, challenge.whyNow].filter(Boolean).join(' — '),
    initiativeContext,
  ].filter((line): line is string => Boolean(line));
}

export function MissionReviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState<MissionReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    getMissionReview(projectId)
      .then((data) => !cancelled && setReview(data))
      .catch(() => !cancelled && setError('No pudimos cargar lo que asume esta iniciativa. Intenta nuevamente.'));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) return <div role="alert" className="p-8 text-red-600">{error}</div>;
  if (!review) return <div role="status" className="p-8 text-slate-500">Cargando tu misión…</div>;

  const inherited = inheritedLines(review);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Antes de empezar</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">¿Qué estoy asumiendo exactamente?</h1>
        <p className="mt-2 text-sm text-slate-600">
          {review.initiativeName}
          {review.independent ? ' · iniciativa independiente' : ''}
        </p>
        <p className="mt-3 max-w-prose text-sm text-slate-500">
          Revisa qué te toca mover y con qué cuentas. Lo que aparece como “{UNDEFINED_COPY}” es algo que conviene aclarar
          antes o durante el primer paso.
        </p>
      </header>

      <dl className="mt-6 grid gap-3 md:grid-cols-2">
        <Field label="Qué quiere mover" value={review.whatToMove} />
        <Field label={review.independent ? 'Contexto de partida' : 'Contexto heredado'} value={inherited} />
        <Field label="Contribución esperada" value={review.expectedContribution} />
        <Field label="Restricciones" value={review.constraints} />
        <Field label="Capacidad" value={review.capacity} />
        <Field label="Dependencias" value={review.dependencies} />
        <Field label="Quién puede ayudar" value={review.whoCanHelp} />
        <Field label="Qué decisión debo ayudar a habilitar" value={review.decisionToEnable} />
      </dl>

      <ApplicationContextCard review={review} />

      {review.openQuestions.length > 0 && (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Preguntas abiertas que llegan al primer paso</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {review.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}/step/0`)}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Asumir y empezar Step 0
        </button>
        <span className="text-sm text-slate-500">{STEP_PROGRESS_QUESTION[0]}</span>
        <button
          type="button"
          onClick={() => navigate(`/initiatives/${projectId}/overview`)}
          className="ml-auto text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
