/**
 * InitiativeOverviewPage — IR-F2 (ADR-025, PRD §12).
 *
 * Pantalla de transición POST-confirmación: tras aceptar la ruta, el usuario aterriza
 * aquí (no en Step 0). Confirma que la iniciativa fue creada (Draft), muestra el mapa
 * Step 0–4 (Step 0 activo, 1–4 bloqueados), un resumen de la revisión inicial (desde
 * el prefill en step0Data) y el CTA que lleva a Mission Review (/initiatives/:id/mission),
 * que es la que abre Step 0.
 *
 * Independiente del scaffold de #122: lee el Project real vía projectService.getById
 * (que consume la API verificada IR-B2/B4). No aprueba Step 0 (AC-OV-008).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getById } from '../services/projectService';
import { trackInitialReviewEvent } from '../../features/initiative-review/services/initialReviewTelemetry';
import { getActiveStepConfiguration } from '../../features/adaptive-core/domain/adaptiveCore';
import type { AdaptiveInitiativeCore } from '../../features/adaptive-core/domain/types';
import { getAdaptiveCore } from '../../features/adaptive-core/services/adaptiveCoreService';

const ROUTE_STEPS = [
  { n: 0, name: 'Ordenar contexto' },
  { n: 1, name: 'Definir y validar foco' },
  { n: 2, name: 'Diseñar apuesta' },
  { n: 3, name: 'Probar y aprender' },
  { n: 4, name: 'Presentar propuesta' },
];

const CHALLENGE_TYPE_LABEL: Record<string, string> = {
  correction: 'Corrección',
  growth: 'Crecimiento',
  exploration: 'Exploración',
};

type AdaptiveCoreLoadState = 'loading' | 'loaded' | 'error';

export function InitiativeOverviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any | null>(null);
  const [serverAdaptiveCore, setServerAdaptiveCore] = useState<AdaptiveInitiativeCore | null>(null);
  const [adaptiveCoreStatus, setAdaptiveCoreStatus] = useState<AdaptiveCoreLoadState>('loading');
  const [adaptiveCoreError, setAdaptiveCoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInitialReview, setShowInitialReview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;
    (async () => {
      try {
        const p = await getById(projectId);
        if (!cancelled) {
          setProject(p);
          const snapshotId = typeof p?.initialReviewSnapshotId === 'string' ? p.initialReviewSnapshotId : undefined;
          trackInitialReviewEvent('initiative_overview_opened', {
            initiativeId: projectId,
            snapshotId,
          });
        }
      } catch {
        if (!cancelled) setError('No pudimos cargar tu iniciativa. Intenta nuevamente.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadAdaptiveCore = React.useCallback(() => {
    if (!projectId || !project) return undefined;
    let cancelled = false;
    setAdaptiveCoreStatus('loading');
    setAdaptiveCoreError(null);
    setServerAdaptiveCore(null);
    getAdaptiveCore(projectId)
      .then(core => {
        if (!cancelled) {
          setServerAdaptiveCore(core);
          setAdaptiveCoreStatus('loaded');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerAdaptiveCore(null);
          setAdaptiveCoreStatus('error');
          setAdaptiveCoreError('Estado adaptativo no disponible. No pudimos cargar la ruta persistida desde backend.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, project]);

  useEffect(() => {
    const cleanup = loadAdaptiveCore();
    return cleanup;
  }, [loadAdaptiveCore]);

  const retryAdaptiveCore = () => {
    void loadAdaptiveCore();
  };

  if (loading) {
    return <div role="status" className="p-8 text-slate-500">Cargando tu iniciativa…</div>;
  }
  if (error || !project) {
    return <div role="alert" className="p-8 text-red-600">{error ?? 'Iniciativa no encontrada.'}</div>;
  }

  const prefill = (project.step0Data ?? {}) as Record<string, any>;
  const pending = Array.isArray(prefill.pendingQuestions) ? prefill.pendingQuestions : [];
  const challengeType = typeof prefill.challengeType === 'string' ? prefill.challengeType : undefined;
  const adaptiveCore = adaptiveCoreStatus === 'loaded' ? serverAdaptiveCore : null;
  const activeConfiguration = adaptiveCore ? getActiveStepConfiguration(adaptiveCore) : null;
  const progressSignal = adaptiveCore?.progressSignal;
  // El avance sale del core del servidor; sin core se muestra como recién creada.
  const currentStep = progressSignal?.step ?? 0;
  const readyForDecision = progressSignal?.health === 'ready_for_decision';
  const started = currentStep > 0 || readyForDecision;
  const statusLabel = readyForDecision ? 'Lista para decisión' : started ? `En curso · Step ${currentStep}` : 'Draft';
  const stepState = (n: number) => (n < currentStep || readyForDecision ? 'done' : n === currentStep ? 'active' : 'locked');

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          {readyForDecision ? 'Tu iniciativa está lista para decisión' : started ? 'Tu iniciativa está en curso' : 'Tu iniciativa está lista para empezar'}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-slate-700">
          <span className="font-medium">{project.name}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Estado: {statusLabel}
          </span>
        </p>
        {!started && (
          <p className="mt-3 max-w-prose text-sm text-slate-500">
            Starteria ya revisó tu propuesta y preparó una ruta inicial. El siguiente paso es completar el
            Step 0 para aterrizar contexto, alcance, actores y condiciones reales.
          </p>
        )}
      </header>

      <section aria-label="Ruta Step 0–4" className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ruta Step 0–4</h2>
        <ol className="mt-3 grid gap-2">
          {ROUTE_STEPS.map((s) => {
            const state = stepState(s.n);
            return (
              <li
                key={s.n}
                data-testid={`overview-step-${s.n}`}
                data-state={state}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                  state === 'active' ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : state === 'done' ? 'border-slate-200 bg-white text-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span>
                  <span className="font-semibold">Step {s.n}</span> — {s.name}
                </span>
                <span className="text-xs font-medium">{state === 'done' ? 'Completo' : state === 'active' ? 'Activo' : 'Bloqueado'}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-slate-400">
          Cada step se desbloqueará cuando completes el paso anterior con los mínimos necesarios.
        </p>
      </section>

      <section aria-label="Configuracion adaptativa" className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configuracion adaptativa</p>
        {adaptiveCoreStatus === 'loading' && (
          <div role="status" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Cargando estado adaptativo persistido...
          </div>
        )}
        {adaptiveCoreStatus === 'error' && (
          <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Estado adaptativo no disponible</p>
            <p className="mt-1 text-sm text-amber-800">
              {adaptiveCoreError} La ruta, checkpoints y desbloqueos se mantienen bloqueados hasta recuperar el estado persistido.
            </p>
            <button
              type="button"
              onClick={retryAdaptiveCore}
              className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Reintentar
            </button>
          </div>
        )}
        {adaptiveCore && activeConfiguration && progressSignal && (
          <>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{activeConfiguration.visibleName}</h2>
            <p className="mt-2 text-sm text-slate-600">{activeConfiguration.objective}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Ruta</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{adaptiveCore.masterContext.routeType.replaceAll('_', ' ')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Profundidad</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{adaptiveCore.masterContext.depthLevel}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Output esperado</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{activeConfiguration.expectedOutput}</p>
              </div>
            </div>
            <ol className="mt-4 grid gap-2">
              {activeConfiguration.checkpoints.map(checkpoint => (
                <li key={checkpoint.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{checkpoint.code} - {checkpoint.title}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{checkpoint.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{checkpoint.purpose}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Senal ejecutiva inicial</p>
              <p className="mt-2 text-sm text-amber-900">
                {progressSignal.checkpointCode}: {progressSignal.checkpointTitle}. Siguiente accion: {progressSignal.nextAction}
              </p>
            </div>
          </>
        )}
      </section>

      {adaptiveCore && !adaptiveCore.masterContext.challengeSnapshot ? (
        // Iniciativa independiente (§16): sin Frente ni Reto, el contexto es la organización donde
        // quiere generar valor. Opcional.
        <section aria-label="Contexto de aplicación" className="mt-6 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <h2 className="text-sm font-semibold text-sky-900">Contexto de aplicación</h2>
          <p className="mt-1 text-sm text-sky-900">
            {adaptiveCore.masterContext.companySnapshot
              ? `${adaptiveCore.masterContext.companySnapshot.name}${adaptiveCore.masterContext.companySnapshot.area ? ` · ${adaptiveCore.masterContext.companySnapshot.area}` : ''}`
              : 'Iniciativa independiente: todavía sin organización elegida. Puedes sumarla cuando la tengas clara.'}
          </p>
        </section>
      ) : null}

      <section aria-label="Resumen de revisión inicial" className="mt-6 grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Resumen de la revisión inicial</h2>
        {challengeType && (
          <p className="text-sm text-slate-700">
            <span className="font-medium">Tipo de reto:</span> {CHALLENGE_TYPE_LABEL[challengeType] ?? challengeType}
          </p>
        )}
        {prefill.mainRisk && (
          <p className="text-sm text-slate-700">
            <span className="font-medium">Riesgo principal:</span> {prefill.mainRisk}
          </p>
        )}
        {prefill.contextInitial && (
          <p className="text-sm text-slate-700">
            <span className="font-medium">Contexto:</span> {prefill.contextInitial}
          </p>
        )}
        {pending.length > 0 && (
          <p className="text-sm text-slate-700">
            <span className="font-medium">Preguntas pendientes:</span> {pending.length} pasan al Step 0.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <button
          type="button"
          onClick={() => setShowInitialReview((open) => !open)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {showInitialReview ? 'Ocultar revisión inicial' : 'Ver revisión inicial'}
        </button>
        {showInitialReview && (
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            {prefill.suggestedName && <p><span className="font-medium">Nombre sugerido:</span> {prefill.suggestedName}</p>}
            {prefill.initialFocus && <p><span className="font-medium">Foco inicial:</span> {prefill.initialFocus}</p>}
            {prefill.expectedImpact && <p><span className="font-medium">Impacto esperado:</span> {prefill.expectedImpact}</p>}
            {prefill.nextRecommendedStep && <p><span className="font-medium">Siguiente paso recomendado:</span> {prefill.nextRecommendedStep}</p>}
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        {started ? (
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/step/${currentStep}`)}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {readyForDecision ? `Ver Step ${currentStep}` : `Continuar en Step ${currentStep}`}
          </button>
        ) : (
        <button
          type="button"
          onClick={() => {
            trackInitialReviewEvent('step0_started_from_overview', {
              initiativeId: projectId,
              snapshotId: project.initialReviewSnapshotId,
            });
            // §18 del E2E Job-Driven: Start pasa por Mission Review, que es la que abre Step 0.
            navigate(`/initiatives/${projectId}/mission`);
          }}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Revisar mi misión y empezar
        </button>
        )}
      </div>
    </div>
  );
}
