import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, HelpCircle, Lock, RefreshCw } from 'lucide-react';
import type { AdaptiveGate, AdaptiveInitiativeCore, AdaptiveQuestion, StepCheckpoint, StepConfiguration } from '../domain/types';
import type { TruthBinding } from '../services/adaptiveCoreService';
import { depthLevelLabel, outputLabel, questionPriorityLabel, routeTypeLabel } from '../domain/adaptiveLabels';

type ActiveCheckpoint = StepCheckpoint | NonNullable<AdaptiveInitiativeCore['activeCheckpoint']>;
export interface AdaptiveCheckpointWorkspaceProps {
  core: AdaptiveInitiativeCore;
  step: 0 | 1 | 2 | 3 | 4;
  checkpoint: ActiveCheckpoint | null | undefined;
  questions: AdaptiveQuestion[];
  initialResponses?: Record<string, unknown>;
  outputPreview?: Record<string, unknown> | null;
  outputConfirmed?: boolean;
  saving?: boolean;
  error?: string | null;
  /**
   * El workspace se monta dentro de una seccion que ya declara codigo, titulo y proposito
   * del checkpoint (Step 0). En ese caso su propia cabecera seria una repeticion.
   */
  embedded?: boolean;
  /**
   * Sólo lectura (Viewer, Sponsor, Portfolio Lead que revisa): las respuestas se ven pero no se
   * editan y no se ofrecen las confirmaciones, que el backend rechazaría con 403.
   */
  readOnly?: boolean;
  onConfirmCheckpoint?: (responses: Record<string, unknown>, truthBindings?: TruthBinding) => void | Promise<void>;
  onConfirmOutput?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

function checkpointCode(checkpoint: ActiveCheckpoint | null | undefined) {
  if (!checkpoint) return 'Checkpoint pendiente';
  return 'checkpointKey' in checkpoint ? checkpoint.checkpointKey : checkpoint.code;
}

function checkpointTitle(checkpoint: ActiveCheckpoint | null | undefined, fallback?: string) {
  if (!checkpoint) return 'Aún no hay checkpoint activo';
  return 'title' in checkpoint ? checkpoint.title : fallback ?? checkpoint.checkpointKey;
}

function checkpointPurpose(checkpoint: ActiveCheckpoint | null | undefined, fallback: string) {
  if (!checkpoint) return fallback;
  return 'purpose' in checkpoint ? checkpoint.purpose : fallback;
}

function checkpointOutputKey(checkpoint: ActiveCheckpoint | null | undefined, fallback: string) {
  if (!checkpoint) return fallback;
  return 'outputKey' in checkpoint ? checkpoint.outputKey : checkpointCode(checkpoint);
}

function checkpointCriteria(checkpoint: ActiveCheckpoint | null | undefined) {
  return checkpoint && 'completionCriteria' in checkpoint ? checkpoint.completionCriteria : [];
}

function checkpointGates(checkpoint: ActiveCheckpoint | null | undefined): AdaptiveGate[] {
  return checkpoint && 'gates' in checkpoint ? checkpoint.gates : [];
}

function activeConfiguration(core: AdaptiveInitiativeCore, step: 0 | 1 | 2 | 3 | 4): StepConfiguration | undefined {
  const active = core.stepConfigurations.find(config =>
    config.id === core.activeStepConfigurationId && config.step === step,
  );
  if (active) return active;
  return core.stepConfigurations
    .filter(config => config.step === step)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
}

function responseKey(question: AdaptiveQuestion) {
  return question.clarifiesVariable || question.id;
}

function normalizeInitialResponses(questions: AdaptiveQuestion[], initialResponses?: Record<string, unknown>) {
  return questions.reduce<Record<string, string>>((acc, question) => {
    const key = responseKey(question);
    const value = initialResponses?.[key] ?? initialResponses?.[question.id];
    acc[key] = typeof value === 'string' ? value : value == null ? '' : String(value);
    return acc;
  }, {});
}

function unansweredRequired(questions: AdaptiveQuestion[], responses: Record<string, string>, unknowns: Record<string, boolean>) {
  return questions.filter(question => {
    if (question.optional || question.priority === 'could') return false;
    const key = responseKey(question);
    if (question.allowsUnknown && unknowns[key]) return false;
    return !responses[key]?.trim();
  });
}

export function AdaptiveCheckpointWorkspace({
  core,
  step,
  checkpoint,
  questions,
  initialResponses,
  outputPreview,
  outputConfirmed,
  saving = false,
  error,
  embedded = false,
  readOnly = false,
  onConfirmCheckpoint,
  onConfirmOutput,
  onRefresh,
}: AdaptiveCheckpointWorkspaceProps) {
  const config = activeConfiguration(core, step);
  const [responses, setResponses] = useState<Record<string, string>>(() => normalizeInitialResponses(questions, initialResponses));
  const [unknowns, setUnknowns] = useState<Record<string, boolean>>({});
  const [selectedClaimId, setSelectedClaimId] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [selectedSourceRefIds, setSelectedSourceRefIds] = useState<string[]>([]);
  const initialResponseSignature = JSON.stringify(initialResponses ?? {});
  const questionSignature = JSON.stringify(questions.map(question => ({ id: question.id, prompt: question.prompt, prefilledFrom: question.prefilledFrom })));

  useEffect(() => {
    setResponses(normalizeInitialResponses(questions, initialResponses));
    setUnknowns({});
    setSelectedClaimId('');
    setSelectedEvidenceIds([]);
    setSelectedSourceRefIds([]);
  // El objeto de prefill puede cambiar de identidad en cada render del Step.
  // Solo reiniciamos las respuestas cuando cambia su contenido real o el checkpoint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionSignature, initialResponseSignature]);
  const missing = useMemo(() => unansweredRequired(questions, responses, unknowns), [questions, responses, unknowns]);
  const code = checkpointCode(checkpoint);
  const configuredCheckpoint = config?.checkpoints.find(item => item.code === code);
  const purpose = checkpointPurpose(checkpoint, configuredCheckpoint?.purpose ?? config?.objective ?? core.progressSignal?.nextAction ?? 'Completa este checkpoint para avanzar.');
  const criteria = checkpointCriteria(checkpoint).length ? checkpointCriteria(checkpoint) : configuredCheckpoint?.completionCriteria ?? [];
  const gates = checkpointGates(checkpoint).length ? checkpointGates(checkpoint) : configuredCheckpoint?.gates ?? [];
  const canConfirmCheckpoint = Boolean(!readOnly && onConfirmCheckpoint && checkpoint && missing.length === 0 && !saving);
  // Si el contexto ya subido resuelve todas las variables del checkpoint, no tiene sentido
  // pedir de nuevo lo mismo: se presenta como resuelto, con lo usado a la vista, para que
  // la persona valide en vez de rellenar.
  const resolvedByContext = questions.length > 0 && questions.every(question => Boolean(question.prefilledFrom));
  const outputReady = Boolean(outputPreview);
  // The backend does not expose policy metadata in the Core response yet. CP-1.3
  // is the only current validated-support policy and is detected from its contract key.
  const requiresTruthBinding = code === 'CP-1.3';
  const claims = core.truthClaims ?? [];
  const evidence = core.evidence ?? [];
  const sourceRefs = core.sourceRefs ?? [];
  const selectedClaim = claims.find(claim => claim.id === selectedClaimId);
  const selectedEvidence = evidence.filter(item => selectedEvidenceIds.includes(item.id));
  const selectedSources = sourceRefs.filter(item => selectedSourceRefIds.includes(item.id));
  const binding: TruthBinding | undefined = requiresTruthBinding && selectedClaimId && selectedEvidenceIds.length > 0 && selectedSourceRefIds.length > 0
    ? { claimId: selectedClaimId, evidenceIds: selectedEvidenceIds, sourceRefIds: selectedSourceRefIds }
    : undefined;
  const bindingValid = !requiresTruthBinding || Boolean(
    binding &&
    selectedClaim &&
    selectedEvidence.length === selectedEvidenceIds.length &&
    selectedSources.length === selectedSourceRefIds.length &&
    selectedEvidence.every(item => item.targetClaimId === selectedClaimId && item.sourceRefId && selectedSourceRefIds.includes(item.sourceRefId)),
  );
  const canConfirm = canConfirmCheckpoint && bindingValid;

  const configuredCheckpoints = config?.checkpoints ?? [];
  const completedCheckpoints = (core.checkpointInstances ?? []).filter(instance =>
    instance.step === step && instance.status === 'completed',
  ).length;

  const payload = () => questions.reduce<Record<string, unknown>>((acc, question) => {
    const key = responseKey(question);
    acc[key] = unknowns[key] ? 'No lo sé aún' : responses[key]?.trim() ?? '';
    return acc;
  }, {});

  return (
    <section
      className={embedded ? 'overflow-hidden rounded-2xl border border-indigo-100 bg-white' : 'mb-6 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm'}
      aria-label="Workspace adaptativo del checkpoint"
    >
      <div className={embedded ? 'border-b border-indigo-100 bg-indigo-50/50 px-5 py-4' : 'border-b border-indigo-100 bg-indigo-50 px-5 py-5'}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              {/* Embebido, el codigo ya lo declara la cabecera de la seccion. */}
              {!embedded && (
                <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs text-white" style={{ fontWeight: 800 }}>
                  {code}
                </span>
              )}
              <span className="rounded-full bg-white px-3 py-1 text-xs text-indigo-700 ring-1 ring-indigo-100" style={{ fontWeight: 700 }}>
                {routeTypeLabel(config?.routeType ?? core.masterContext?.routeType)}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-indigo-100" style={{ fontWeight: 700 }}>
                Profundidad: {depthLevelLabel(config?.depthLevel ?? core.masterContext?.depthLevel)}
              </span>
            </div>
            {!embedded && (
              <h2 className="mt-3 text-xl text-slate-950" style={{ fontWeight: 850 }}>
                {checkpointTitle(checkpoint, configuredCheckpoint?.title)}
              </h2>
            )}
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{purpose}</p>
            <p className="mt-2 text-sm text-indigo-900" style={{ fontWeight: 700 }}>
              Lo que estás construyendo: {outputLabel(checkpointOutputKey(checkpoint, configuredCheckpoint?.outputKey ?? config?.expectedOutput ?? ''))}
            </p>
            {configuredCheckpoints.length > 0 && (
              <p className="mt-2 text-xs text-indigo-700" style={{ fontWeight: 700 }}>
                Progreso: {completedCheckpoints}/{configuredCheckpoints.length} checkpoints confirmados
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-100"
                style={{ fontWeight: 700 }}
              >
                <RefreshCw size={13} /> Recargar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5">
          {resolvedByContext ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900" style={{ fontWeight: 800 }}>
                Este checkpoint ya queda resuelto con la información que subiste
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                No hace falta responder nada nuevo. Revisa abajo lo que usamos y confirma si es correcto.
              </p>
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-950" style={{ fontWeight: 800 }}>Preguntas mínimas para avanzar</p>
                <p className="mt-1 text-xs text-slate-500">Responde solo lo necesario para este checkpoint. Si te falta información y la pregunta lo permite, déjalo indicado.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600" style={{ fontWeight: 700 }}>
                {questions.length} preguntas / {missing.length} pendientes
              </span>
            </div>
          )}

          {questions.length > 0 ? (
            <div className="space-y-3">
              {questions.map((question, index) => {
                const key = responseKey(question);
                const unknown = Boolean(unknowns[key]);
                return (
                  <div key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-3xl">
                        <p className="text-xs uppercase text-slate-400" style={{ fontWeight: 800 }}>Pregunta {index + 1}</p>
                        <label htmlFor={`adaptive-question-${question.id}`} className="mt-1 block text-sm text-slate-950" style={{ fontWeight: 800 }}>
                          {question.prompt}
                        </label>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{question.reason}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${question.priority === 'must' ? 'bg-rose-50 text-rose-700' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`} style={{ fontWeight: 700 }}>
                        {questionPriorityLabel(question.priority)}
                      </span>
                    </div>
                    <textarea
                      id={`adaptive-question-${question.id}`}
                      value={responses[key] ?? ''}
                      onChange={(event) => setResponses(prev => ({ ...prev, [key]: event.target.value }))}
                      disabled={unknown || saving}
                      readOnly={readOnly}
                      rows={3}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                      placeholder={question.answerType === 'owner' ? 'Nombre, rol o área responsable' : 'Respuesta breve con la mejor información disponible'}
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      {/* Fuente y variable son claves internas del Core: no se muestran a la persona. */}
                      <span />
                      {question.allowsUnknown && !readOnly && (
                        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={unknown}
                            onChange={(event) => setUnknowns(prev => ({ ...prev, [key]: event.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          No lo sé aún
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Este checkpoint todavía no tiene preguntas. Recarga o confirma el resultado del paso anterior.
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onConfirmCheckpoint && !readOnly && (
              <button
                type="button"
                onClick={() => void onConfirmCheckpoint?.(payload(), binding)}
                disabled={!canConfirm}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                style={{ fontWeight: 800 }}
              >
                <CheckCircle2 size={16} /> {saving ? 'Confirmando...' : resolvedByContext ? 'Validar y cerrar este checkpoint' : 'Confirmar checkpoint'}
              </button>
            )}
            {onConfirmOutput && !readOnly && (
              <button
                type="button"
                onClick={() => void onConfirmOutput()}
                disabled={!outputReady || outputConfirmed || saving}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ fontWeight: 800 }}
              >
                <ClipboardList size={16} /> {outputConfirmed ? 'Resultado confirmado' : 'Confirmar resultado del Step'}
              </button>
            )}
            {missing.length > 0 && !readOnly && (
              <p className="text-xs text-slate-500">Completa las preguntas imprescindibles o marca "No lo sé aún" cuando esté permitido.</p>
            )}
          </div>

          {requiresTruthBinding && !readOnly && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Vinculacion de evidencia persistente">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-amber-950" style={{ fontWeight: 800 }}>Evidencia vinculada</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">Selecciona entidades persistidas. El checkpoint no acepta texto libre como sustituto de Claim, Evidence o SourceRef.</p>
                </div>
                <span className="text-xs text-amber-900" style={{ fontWeight: 700 }}>{selectedEvidenceIds.length} evidencias / {selectedSourceRefIds.length} fuentes</span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <label className="text-xs text-slate-700">
                  Claim
                  <select value={selectedClaimId} onChange={event => setSelectedClaimId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
                    <option value="">Selecciona un claim</option>
                    {claims.map(claim => <option key={claim.id} value={claim.id}>{claim.statement}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-700">
                  Evidence
                  <select multiple value={selectedEvidenceIds} onChange={event => setSelectedEvidenceIds(Array.from(event.target.selectedOptions, option => option.value))} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
                    {evidence.filter(item => !selectedClaimId || item.targetClaimId === selectedClaimId).map(item => <option key={item.id} value={item.id}>{item.name ?? item.id} · {item.truthStatus ?? 'sin estado'}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-700">
                  SourceRef
                  <select multiple value={selectedSourceRefIds} onChange={event => setSelectedSourceRefIds(Array.from(event.target.selectedOptions, option => option.value))} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
                    {sourceRefs.map(source => <option key={source.id} value={source.id}>{source.reference}</option>)}
                  </select>
                </label>
              </div>
              {(claims.length === 0 || evidence.length === 0 || sourceRefs.length === 0) && (
                <p className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900" role="status">
                  No hay evidencia persistente suficiente para validar este checkpoint.
                </p>
              )}
              {selectedClaim && <p className="mt-3 text-xs text-slate-600">Claim seleccionado: {selectedClaim.statement}</p>}
              <p className={`mt-3 text-xs ${bindingValid ? 'text-emerald-700' : 'text-amber-900'}`} style={{ fontWeight: 700 }}>
                {bindingValid ? 'Binding listo para enviar al backend.' : 'Falta un Claim, Evidence y SourceRef compatibles.'}
              </p>
            </div>
          )}
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase text-slate-400" style={{ fontWeight: 800 }}>Por qué importa</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{config?.objective ?? core.progressSignal?.hypothesis ?? purpose}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400" style={{ fontWeight: 800 }}>Criterios de cierre</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {(criteria.length ? criteria : config?.closureCriteria ?? []).slice(0, 5).map(item => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {gates.length > 0 && (
              <div>
                <p className="text-xs uppercase text-slate-400" style={{ fontWeight: 800 }}>Gates</p>
                <div className="mt-2 space-y-2">
                  {gates.map(gate => (
                    <div key={gate.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs text-amber-900" style={{ fontWeight: 800 }}>{gate.label}</p>
                      <p className="mt-1 text-xs text-amber-800">{gate.resolution}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {outputPreview && (
              <div className="rounded-xl border border-emerald-200 bg-white p-3">
                <p className="text-xs uppercase text-emerald-700" style={{ fontWeight: 800 }}>Resultado en construcción</p>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                  {JSON.stringify(outputPreview, null, 2)}
                </pre>
              </div>
            )}
            {!checkpoint && (
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <Lock size={15} className="mt-0.5 shrink-0" />
                <span>Este Step queda bloqueado hasta confirmar el resultado del Step anterior.</span>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-white p-3 text-xs text-indigo-800">
              <HelpCircle size={14} className="mt-0.5 shrink-0" />
              <span>El checkpoint decide qué información mínima necesita Starteria para adaptar el siguiente tramo del recorrido.</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
