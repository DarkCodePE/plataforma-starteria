import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Eye, FileText, FileUp, MessageSquareText, Pencil, Plus, RotateCw, Send, Sparkles, Trash2, Users } from 'lucide-react';
import { projectBootstrapHome } from '../projection/bootstrapHomeProjection';
import type {
  ManualPortfolioBootstrapWorkItemInput,
  PortfolioBootstrapAnchor,
  PortfolioBootstrapImportBatch,
  PortfolioBootstrapImportMapping,
  PortfolioOrganizationPayload,
  PortfolioOrganizationProposal,
  PortfolioBootstrapResponse,
  UpdatePortfolioBootstrapAnchorInput,
  UpdatePortfolioBootstrapWorkItemInput,
} from '../services/portfolioBootstrapClient';
import { suggestPortfolioObjective } from '../services/portfolioObjectiveCopilotClient';
import { ChallengeActivationBriefPanel, type ChallengeAssignmentTarget, type ChallengeBriefInheritedContext } from '../../challenge-activation-brief/ChallengeActivationBriefPanel';
import { ChallengeAssignmentPreparationPanel } from '../../challenge-activation-brief/ChallengeAssignmentPreparationPanel';
import { listActivationBriefs, type ActivationBrief } from '../../challenge-activation-brief/challengeActivationBriefClient';

export function PortfolioBootstrapHome({
  data,
  status,
  error,
  onRetry,
  onUpdateAnchor,
  onConfirmAnchor,
  onPasteWorkItems,
  onUploadImportFile = async () => undefined,
  onCommitImportBatch = async () => undefined,
  onAddManualWorkItem,
  onDeclareNoExistingWork,
  onUpdateWorkItem,
  onRemoveWorkItem,
  onAnalyzeWorkItems,
  onConfirmProposedMutation,
  onReopenProposedMutationReview = async () => undefined,
  onCorrectProposedMutation,
  onRejectProposedMutation,
  onLeaveProposedMutationPending,
  onPublishFirstReading,
  analysisStatus,
  analysisError,
  publishStatus,
  publishError,
  importStatus,
  importError,
  activeImport,
  organizationProposal = null,
  organizationStatus = 'idle',
  organizationError = null,
  onSaveOrganizationProposal,
  onConfirmOrganizationProposal,
  onNavigate,
  initialAssignmentTarget = null,
  onOpenAssignment,
}: {
  data: PortfolioBootstrapResponse | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  analysisStatus?: 'idle' | 'processing' | 'error';
  analysisError?: string | null;
  onRetry: () => void;
  onUpdateAnchor: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
  onConfirmAnchor: () => Promise<void>;
  onPasteWorkItems: (text: string) => Promise<void>;
  onUploadImportFile?: (file: File) => Promise<void>;
  onCommitImportBatch?: (batch: PortfolioBootstrapImportBatch, mapping: PortfolioBootstrapImportMapping) => Promise<void>;
  onAddManualWorkItem: (input: ManualPortfolioBootstrapWorkItemInput) => Promise<void>;
  onDeclareNoExistingWork: () => Promise<void>;
  onUpdateWorkItem: (workItemId: string, input: UpdatePortfolioBootstrapWorkItemInput) => Promise<void>;
  onRemoveWorkItem: (workItemId: string) => Promise<void>;
  onAnalyzeWorkItems: () => Promise<void>;
  onConfirmProposedMutation: (mutationId: string) => Promise<void>;
  onReopenProposedMutationReview?: (mutationId: string, reviewNote?: string) => Promise<void>;
  onCorrectProposedMutation: (mutationId: string, proposedValue: unknown, reviewNote?: string) => Promise<void>;
  onRejectProposedMutation: (mutationId: string, reviewNote?: string) => Promise<void>;
  onLeaveProposedMutationPending: (mutationId: string, reviewNote?: string) => Promise<void>;
  onPublishFirstReading: () => Promise<void>;
  publishStatus?: 'idle' | 'processing' | 'error';
  publishError?: string | null;
  importStatus?: 'idle' | 'uploading' | 'committing' | 'error';
  importError?: string | null;
  activeImport?: PortfolioBootstrapImportBatch | null;
  organizationProposal?: PortfolioOrganizationProposal | null;
  organizationStatus?: 'idle' | 'loading' | 'saving' | 'confirming' | 'error';
  organizationError?: string | null;
  onSaveOrganizationProposal?: (input: { version: number; payload: PortfolioOrganizationPayload }) => Promise<PortfolioOrganizationProposal>;
  onConfirmOrganizationProposal?: (input: { version: number }) => Promise<PortfolioOrganizationProposal>;
  /** Human navigation only; canonical PL-04 writes use the explicit confirmation command. */
  onNavigate?: (path: string) => void;
  initialAssignmentTarget?: ChallengeAssignmentTarget | null;
  onOpenAssignment?: (target: ChallengeAssignmentTarget) => void;
}) {
  const projection = useMemo(() => data ? projectBootstrapHome(data) : null, [data]);

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
        <p className="text-sm font-semibold text-slate-900">Cargando contexto de Portfolio...</p>
        <p className="mt-1 text-sm text-slate-600">Estamos recuperando el punto de partida persistido.</p>
      </section>
    );
  }

  if (status === 'error' || !projection) {
    return (
      <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <div>
            <h2 className="text-base font-semibold">No pudimos cargar el Bootstrap de Portfolio</h2>
            <p className="mt-1 text-sm">{error ?? 'El contexto de entrada no esta disponible ahora.'}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              <RotateCw size={16} />
              Reintentar
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (projection.homeState === 'HOME_D' || projection.homeState === 'HOME_E') {
    return <PortfolioFirstReading projection={projection} onNavigate={onNavigate} />;
  }

  return (
    <PortfolioCopilotWorkspace
      projection={projection}
      onUpdateAnchor={onUpdateAnchor}
      onConfirmAnchor={onConfirmAnchor}
      onPasteWorkItems={onPasteWorkItems}
      onUploadImportFile={onUploadImportFile}
      onCommitImportBatch={onCommitImportBatch}
      onAddManualWorkItem={onAddManualWorkItem}
      onDeclareNoExistingWork={onDeclareNoExistingWork}
      onUpdateWorkItem={onUpdateWorkItem}
      onRemoveWorkItem={onRemoveWorkItem}
      onAnalyzeWorkItems={onAnalyzeWorkItems}
      onConfirmProposedMutation={onConfirmProposedMutation}
      onReopenProposedMutationReview={onReopenProposedMutationReview}
      onCorrectProposedMutation={onCorrectProposedMutation}
      onRejectProposedMutation={onRejectProposedMutation}
      onLeaveProposedMutationPending={onLeaveProposedMutationPending}
      onPublishFirstReading={onPublishFirstReading}
      analysisStatus={analysisStatus ?? 'idle'}
      analysisError={analysisError ?? null}
      publishStatus={publishStatus ?? 'idle'}
      publishError={publishError ?? null}
      importStatus={importStatus ?? 'idle'}
      importError={importError ?? null}
      activeImport={activeImport ?? projection.importBatches[0] ?? null}
      organizationProposal={organizationProposal}
      organizationStatus={organizationStatus}
      organizationError={organizationError}
      onSaveOrganizationProposal={onSaveOrganizationProposal}
      onConfirmOrganizationProposal={onConfirmOrganizationProposal}
      onNavigate={onNavigate}
      initialAssignmentTarget={initialAssignmentTarget}
      onOpenAssignment={onOpenAssignment}
    />
  );
}

const FROZEN_SETUP_STAGES = [
  'Contexto',
  'Objetivo',
  'Incorporación',
  'Análisis',
  'Organización',
  'Briefs',
  'Asignación',
] as const;

type BootstrapProjection = NonNullable<ReturnType<typeof projectBootstrapHome>>;

/**
 * The frozen v1.0 experience is intentionally a conversation-led workspace.
 * This component changes composition only: every command below continues to use
 * the persisted Bootstrap, Brief and P6 handoff capabilities already in place.
 */
function PortfolioCopilotWorkspace({
  projection,
  onUpdateAnchor,
  onConfirmAnchor,
  onPasteWorkItems,
  onUploadImportFile,
  onCommitImportBatch,
  onAddManualWorkItem,
  onDeclareNoExistingWork,
  onUpdateWorkItem,
  onRemoveWorkItem,
  onAnalyzeWorkItems,
  onConfirmProposedMutation,
  onReopenProposedMutationReview,
  onCorrectProposedMutation,
  onRejectProposedMutation,
  onLeaveProposedMutationPending,
  onPublishFirstReading,
  analysisStatus,
  analysisError,
  publishStatus,
  publishError,
  importStatus,
  importError,
  activeImport,
  organizationProposal,
  organizationStatus,
  organizationError,
  onSaveOrganizationProposal,
  onConfirmOrganizationProposal,
  onNavigate,
  initialAssignmentTarget,
  onOpenAssignment,
}: {
  projection: BootstrapProjection;
  onUpdateAnchor: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
  onConfirmAnchor: () => Promise<void>;
  onPasteWorkItems: (text: string) => Promise<void>;
  onUploadImportFile: (file: File) => Promise<void>;
  onCommitImportBatch: (batch: PortfolioBootstrapImportBatch, mapping: PortfolioBootstrapImportMapping) => Promise<void>;
  onAddManualWorkItem: (input: ManualPortfolioBootstrapWorkItemInput) => Promise<void>;
  onDeclareNoExistingWork: () => Promise<void>;
  onUpdateWorkItem: (workItemId: string, input: UpdatePortfolioBootstrapWorkItemInput) => Promise<void>;
  onRemoveWorkItem: (workItemId: string) => Promise<void>;
  onAnalyzeWorkItems: () => Promise<void>;
  onConfirmProposedMutation: (mutationId: string) => Promise<void>;
  onReopenProposedMutationReview: (mutationId: string, reviewNote?: string) => Promise<void>;
  onCorrectProposedMutation: (mutationId: string, proposedValue: unknown, reviewNote?: string) => Promise<void>;
  onRejectProposedMutation: (mutationId: string, reviewNote?: string) => Promise<void>;
  onLeaveProposedMutationPending: (mutationId: string, reviewNote?: string) => Promise<void>;
  onPublishFirstReading: () => Promise<void>;
  analysisStatus: 'idle' | 'processing' | 'error';
  analysisError: string | null;
  publishStatus: 'idle' | 'processing' | 'error';
  publishError: string | null;
  importStatus: 'idle' | 'uploading' | 'committing' | 'error';
  importError: string | null;
  activeImport: PortfolioBootstrapImportBatch | null;
  organizationProposal: PortfolioOrganizationProposal | null;
  organizationStatus: 'idle' | 'loading' | 'saving' | 'confirming' | 'error';
  organizationError: string | null;
  onSaveOrganizationProposal?: (input: { version: number; payload: PortfolioOrganizationPayload }) => Promise<PortfolioOrganizationProposal>;
  onConfirmOrganizationProposal?: (input: { version: number }) => Promise<PortfolioOrganizationProposal>;
  onNavigate?: (path: string) => void;
  initialAssignmentTarget: ChallengeAssignmentTarget | null;
  onOpenAssignment?: (target: ChallengeAssignmentTarget) => void;
}) {
  const [selectedStage, setSelectedStage] = useState<number | null>(initialAssignmentTarget ? 6 : null);
  const [assignmentTarget, setAssignmentTarget] = useState<ChallengeAssignmentTarget | null>(initialAssignmentTarget);
  const [confirmedOrganization, setConfirmedOrganization] = useState<PortfolioOrganizationProposal | null>(
    organizationProposal?.materialization ? organizationProposal : null,
  );
  const [briefConfirmedChallengeIds, setBriefConfirmedChallengeIds] = useState<Set<string>>(new Set());
  const handleBriefConfirmationChange = useCallback((challengeId: string, confirmed: boolean) => {
    setBriefConfirmedChallengeIds((current) => {
      if (current.has(challengeId) === confirmed) return current;
      const next = new Set(current);
      if (confirmed) next.add(challengeId); else next.delete(challengeId);
      return next;
    });
  }, []);
  const inferredStage = frozenStageFrom(projection);
  const organizationIsMaterialized = Boolean(confirmedOrganization?.materialization ?? organizationProposal?.materialization);
  const hasAnalysisHardBlocker = projection.analysisSummary.hardBlockingNow > 0 && !organizationIsMaterialized;
  const lastAvailableStage = hasAnalysisHardBlocker ? 3 : assignmentTarget ? 6 : 5;
  const requestedStage = selectedStage ?? inferredStage;
  const stage = hasAnalysisHardBlocker && requestedStage > 3 ? 3 : requestedStage;
  const selectStage = (nextStage: number) => {
    if (nextStage > lastAvailableStage) return;
    setSelectedStage(nextStage);
  };
  useEffect(() => {
    if (organizationProposal?.materialization) {
      setConfirmedOrganization(organizationProposal);
      setSelectedStage(5);
    }
  }, [organizationProposal?.materialization?.id]);
  useEffect(() => {
    if (!initialAssignmentTarget) return;
    setAssignmentTarget(initialAssignmentTarget);
    setSelectedStage(6);
  }, [initialAssignmentTarget?.briefVersionId]);
  const openAssignment = useCallback((target: ChallengeAssignmentTarget) => {
    setAssignmentTarget(target);
    setSelectedStage(6);
    onOpenAssignment?.(target);
  }, [onOpenAssignment]);

  const runtimePanel = (
    <PortfolioBootstrapWorkIntake
      projection={projection}
      onPasteWorkItems={onPasteWorkItems}
      onUploadImportFile={onUploadImportFile}
      onCommitImportBatch={onCommitImportBatch}
      onAddManualWorkItem={onAddManualWorkItem}
      onDeclareNoExistingWork={onDeclareNoExistingWork}
      onUpdateWorkItem={onUpdateWorkItem}
      onRemoveWorkItem={onRemoveWorkItem}
      onAnalyzeWorkItems={onAnalyzeWorkItems}
      onConfirmProposedMutation={onConfirmProposedMutation}
      onReopenProposedMutationReview={onReopenProposedMutationReview}
      onCorrectProposedMutation={onCorrectProposedMutation}
      onRejectProposedMutation={onRejectProposedMutation}
      onLeaveProposedMutationPending={onLeaveProposedMutationPending}
      onPublishFirstReading={onPublishFirstReading}
      analysisStatus={analysisStatus}
      analysisError={analysisError}
      publishStatus={publishStatus}
      publishError={publishError}
      importStatus={importStatus}
      importError={importError}
      activeImport={activeImport}
      onContinueToOrganization={() => setSelectedStage(4)}
    />
  );

  return (
    <section className="space-y-5" data-testid="portfolio-bootstrap-home-a" data-frozen-composition="copilot-first">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:px-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Configurar con Copilot · {stage + 1} de 7</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{frozenStageTitle(stage)}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Copilot construye contigo; las fuentes, inferencias y confirmaciones quedan diferenciadas. No necesitas completar formularios en paralelo.</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
        <main className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Conversación con Copilot">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-800"><Sparkles size={18} /></span>
              <div><h2 className="text-base font-semibold text-slate-950">Conversación con Copilot</h2><p className="text-sm text-slate-500">Tu espacio principal para construir el portafolio</p></div>
            </div>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">Guía interactiva</span>
          </div>
          <div className="space-y-5 bg-slate-50/60 px-5 py-6 md:px-7">
            {stage === 0 ? <FrozenContextConversation anchor={projection.anchor} onSave={onUpdateAnchor} /> : null}
            {stage === 1 ? <FrozenObjectiveConversation projection={projection} onSave={onUpdateAnchor} onConfirm={onConfirmAnchor} /> : null}
            {stage === 2 ? <FrozenChatStage eyebrow="Incorporar iniciativas" title="¿Qué iniciativas existentes quieres que revisemos?" help="Puedes subir un archivo, pegar una lista o continuar sin iniciativas. No hay una respuesta obligatoria.">{runtimePanel}</FrozenChatStage> : null}
            {stage === 3 ? <FrozenChatStage eyebrow="Análisis explicable" title="¿Qué está contribuyendo, qué se solapa y qué requiere revisión?" help="Cada lectura conserva su fuente, evidencia, vacíos y estado de revisión humana.">{runtimePanel}</FrozenChatStage> : null}
            {stage === 4 ? <FrozenOrganizationStage projection={projection} proposal={organizationProposal} status={organizationStatus} error={organizationError} onSave={onSaveOrganizationProposal} onConfirm={onConfirmOrganizationProposal} onComplete={(confirmed) => { setConfirmedOrganization(confirmed); setSelectedStage(5); }} /> : null}
            {stage === 5 ? <FrozenBriefStage projection={projection} confirmedOrganization={confirmedOrganization} onBriefConfirmationChange={handleBriefConfirmationChange} onContinueToAssignment={openAssignment} /> : null}
            {stage === 6 && assignmentTarget ? <FrozenAssignmentStage target={assignmentTarget} /> : null}
          </div>
        </main>
        <FrozenProgress stage={stage} onSelect={selectStage} blockedAfterStage={lastAvailableStage} />
      </div>
    </section>
  );
}

function FrozenContextConversation({ anchor, onSave }: { anchor: PortfolioBootstrapAnchor; onSave: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void> }) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const hasContext = Boolean(anchor.contextSummary?.trim());
  return <>
    <AssistantBubble>Si ya acordaron trabajar el objetivo con <b>Portfolio Lead</b>, pega el prompt elaborado a partir del Decision Brief externo. <b>Ese diagnóstico no se repite aquí.</b> Lo usaremos como contexto inicial y podrás corregir cualquier interpretación.</AssistantBubble>
    {hasContext ? <UserBubble>{anchor.contextSummary}</UserBubble> : null}
    <FocusedQuestion eyebrow="Punto de partida" title="¿Qué quieres lograr con Startería?" help="Pega el texto de referencia. No necesitas conocer qué son frentes, retos o Steps." />
    <form className="rounded-xl border border-slate-200 bg-white p-4" onSubmit={async (event) => {
      event.preventDefault(); const text = answer.trim(); if (!text) return; setSaving(true);
      const prior = anchor.sourceRefs && typeof anchor.sourceRefs === 'object' && !Array.isArray(anchor.sourceRefs) ? anchor.sourceRefs as Record<string, unknown> : { priorSourceRefs: anchor.sourceRefs };
      try { await onSave({ contextSummary: anchor.contextSummary?.trim() || text, sourceRefs: { ...prior, externalContext: { kind: 'external_decision_brief_prompt', disposition: 'user_declared_source', text, recordedAt: new Date().toISOString(), reviewStatus: 'provisional' } } }); setAnswer(''); } finally { setSaving(false); }
    }}>
      <label className="text-sm font-semibold text-slate-800">Tu respuesta al Copilot<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} placeholder="Pega aquí el prompt elaborado fuera de Startería…" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950" /></label>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setAnswer('Quiero recuperar el contexto acordado y preparar decisiones de continuidad sin repetir el diagnóstico externo.')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Usar una guía de redacción</button><button type="submit" disabled={saving || !answer.trim()} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Send size={15} />{saving ? 'Guardando…' : 'Continuar la conversación'}</button></div>
      <p className="mt-3 text-xs text-slate-500">El contexto queda como fuente declarada y provisional; no es una decisión ni un diagnóstico revalidado.</p>
    </form>
  </>;
}

function FrozenObjectiveConversation({ projection, onSave, onConfirm }: { projection: BootstrapProjection; onSave: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>; onConfirm: () => Promise<void> }) {
  const anchor = projection.anchor;
  return <>
    <AssistantBubble>He recibido tu contexto inicial. No voy a inventar KPIs o causas. <b>Conversaremos para aclarar el resultado de negocio, su contexto y la decisión que necesitas tomar.</b> Si algo no lo sabes, quedará pendiente.</AssistantBubble>
    {anchor.contextSummary ? <UserBubble>{anchor.contextSummary}</UserBubble> : null}
    <FocusedQuestion eyebrow="Alinear con negocio" title="Primero entendamos el objetivo, antes de diseñar trabajo" help="Una conversación breve para construir una ficha estratégica útil; no un formulario de ocho campos." />
    <ObjectiveConversation anchor={anchor} onSave={onSave} canConfirm={projection.canConfirm} onConfirm={onConfirm} />
  </>;
}

function FrozenChatStage({ eyebrow, title, help, children }: { eyebrow: string; title: string; help: string; children: React.ReactNode }) { return <><AssistantBubble>Seguimos con la información disponible. No convertiré una fuente o inferencia en una decisión confirmada.</AssistantBubble><FocusedQuestion eyebrow={eyebrow} title={title} help={help} />{children}</>; }
function FrozenOrganizationStage({
  projection, proposal, status, error, onSave, onConfirm, onComplete,
}: {
  projection: BootstrapProjection;
  proposal: PortfolioOrganizationProposal | null;
  status: 'idle' | 'loading' | 'saving' | 'confirming' | 'error';
  error: string | null;
  onSave?: (input: { version: number; payload: PortfolioOrganizationPayload }) => Promise<PortfolioOrganizationProposal>;
  onConfirm?: (input: { version: number }) => Promise<PortfolioOrganizationProposal>;
  onComplete: (proposal: PortfolioOrganizationProposal) => void;
}) {
  const suggested = useMemo(
    () => normalizeOrganizationPayload(proposal?.payload ?? buildOrganizationProposal(projection), projection.workItems.map((item) => item.id)),
    [proposal?.id, proposal?.version, projection],
  );
  const [draft, setDraft] = useState<PortfolioOrganizationPayload>(suggested);
  const [current, setCurrent] = useState<PortfolioOrganizationProposal | null>(proposal);
  const [dirty, setDirty] = useState(!proposal);
  const [localError, setLocalError] = useState<string | null>(null);
  const [movingInitiativeId, setMovingInitiativeId] = useState<string | null>(null);
  const [splitReview, setSplitReview] = useState<{ frontId: string; challengeId: string; suggestionVisible: boolean } | null>(null);
  const [challengeReview, setChallengeReview] = useState<{ frontId: string; challengeId: string } | null>(null);
  const [optOutReviewOpen, setOptOutReviewOpen] = useState(false);
  const [proposalBeforeOptOut, setProposalBeforeOptOut] = useState<PortfolioOrganizationPayload | null>(null);
  const mutationLockedRef = useRef(false);
  const [operationLocked, setOperationLocked] = useState(false);
  useEffect(() => {
    setDraft(suggested);
    setCurrent(proposal);
    setDirty(!proposal);
    setProposalBeforeOptOut(null);
  }, [proposal?.id, proposal?.version, suggested]);
  const workById = new Map(projection.workItems.map((item) => [item.id, item]));
  const workItemIds = projection.workItems.map((item) => item.id);
  const organizationOptedOut = isOrganizationOptedOut(draft, workItemIds);
  const reviewLocked = operationLocked || status === 'saving' || status === 'confirming';
  const challengeOptions = draft.fronts.flatMap((front) => front.challenges).map((challenge, index) => ({
    value: challenge.candidateId, label: `Reto ${index + 1} · ${challenge.title}`,
  }));
  const destinationOptions = [
    ...challengeOptions,
    { value: 'cross-cutting', label: 'Apoyo transversal' },
    { value: 'ungrouped', label: 'Sin agrupar' },
    { value: 'outside', label: 'Fuera del objetivo actual' },
  ];
  const challengeOrdinal = new Map(challengeOptions.map((option, index) => [option.value, index + 1]));
  const placementFor = (workItemId: string) => {
    if (draft.outsideObjectiveInitiativeIds.includes(workItemId)) return 'outside';
    if (draft.ungroupedInitiativeIds.includes(workItemId)) return 'ungrouped';
    if (draft.crossCuttingInitiativeIds.includes(workItemId)) return 'cross-cutting';
    return draft.fronts.flatMap((front) => front.challenges).find((challenge) => challenge.relatedInitiativeIds.includes(workItemId))?.candidateId ?? 'ungrouped';
  };
  const mutate = (updater: (value: PortfolioOrganizationPayload) => PortfolioOrganizationPayload) => {
    if (mutationLockedRef.current || status === 'saving' || status === 'confirming') return;
    setDraft((value) => updater(value)); setDirty(true); setLocalError(null);
  };
  const chooseNotToOrganize = () => {
    setProposalBeforeOptOut(draft);
    mutate((value) => optOutOrganization(value, workItemIds));
  };
  const resumeOrganizationReview = () => {
    mutate(() => proposalBeforeOptOut ?? buildOrganizationProposal(projection));
    setProposalBeforeOptOut(null);
  };
  const placeInitiative = (workItemId: string, placement: string) => mutate((value) => ({
    ...value,
    outsideObjectiveInitiativeIds: placement === 'outside' ? unique([...value.outsideObjectiveInitiativeIds, workItemId]) : value.outsideObjectiveInitiativeIds.filter((id) => id !== workItemId),
    ungroupedInitiativeIds: placement === 'ungrouped' ? unique([...value.ungroupedInitiativeIds, workItemId]) : value.ungroupedInitiativeIds.filter((id) => id !== workItemId),
    crossCuttingInitiativeIds: placement === 'cross-cutting' ? unique([...value.crossCuttingInitiativeIds, workItemId]) : value.crossCuttingInitiativeIds.filter((id) => id !== workItemId),
    fronts: value.fronts.map((front) => ({ ...front, challenges: front.challenges.map((challenge) => ({
      ...challenge,
      relatedInitiativeIds: challenge.candidateId === placement ? unique([...challenge.relatedInitiativeIds, workItemId]) : challenge.relatedInitiativeIds.filter((id) => id !== workItemId),
    })) })),
  }));
  const persistDraft = async (payload: PortfolioOrganizationPayload) => {
    if (!onSave) throw new Error('La persistencia de la revisión no está disponible.');
    const saved = await onSave({ version: current?.version ?? 0, payload });
    const savedReview = { ...saved, payload: saved.payload ?? payload };
    setCurrent(savedReview);
    setDirty(false);
    return savedReview;
  };
  const save = async () => {
    if (reviewLocked) return;
    mutationLockedRef.current = true;
    setOperationLocked(true);
    setLocalError(null);
    try {
      await persistDraft(draft);
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'No pudimos guardar la revisión.'); }
    finally { mutationLockedRef.current = false; setOperationLocked(false); }
  };
  const confirm = async () => {
    if (!onConfirm) return setLocalError('La confirmación no está disponible.');
    if (organizationOptedOut) return setLocalError('Has elegido no organizar todavía. Puedes guardar esta decisión y volver más adelante.');
    if (reviewLocked) return;
    mutationLockedRef.current = true;
    setOperationLocked(true);
    const reviewToConfirm = draft;
    try {
      setLocalError(null);
      const persisted = dirty || !current ? await persistDraft(reviewToConfirm) : current;
      const confirmed = await onConfirm({ version: persisted.version });
      const materialized = { ...confirmed, payload: confirmed.payload ?? reviewToConfirm };
      setCurrent(materialized);
      onComplete(materialized);
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'No pudimos confirmar la organización.'); }
    finally { mutationLockedRef.current = false; setOperationLocked(false); }
  };
  const reviewNeedsSaving = dirty || !current;
  const confirmationUnavailableReason = organizationOptedOut
    ? 'Has elegido no organizar todavía. Guarda esta revisión para continuar después; no se creará ninguna estructura canónica.'
    : !onConfirm
    ? 'La confirmación no está disponible en esta sesión.'
    : reviewNeedsSaving && !onSave
      ? 'Tienes cambios sin guardar, pero el guardado no está disponible en esta sesión.'
      : null;
  const insightFor = (
    id: string,
    placement: 'challenge' | 'cross-cutting' | 'ungrouped' | 'outside',
    overlaps: string[] = [],
    relatedIds: string[] = [],
  ) => organizationInitiativeInsight(id, projection, placement, overlaps, relatedIds);
  return <>
    <AssistantBubble>Startería propone una forma de ordenar las iniciativas para que puedas comparar el trabajo alrededor del objetivo. <b>Nada se convierte en estructura del Portfolio hasta que revises y confirmes la propuesta.</b></AssistantBubble>
    <OrganizationStageIntro />
    <section className="space-y-6 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm md:p-6" data-testid="portfolio-organization-proposal" aria-busy={reviewLocked}>
      <fieldset disabled={reviewLocked} className="m-0 min-w-0 space-y-6 border-0 p-0">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-800">Propuesta de organización · revisable</p>
        <h3 className="mt-2 max-w-3xl text-xl font-semibold tracking-tight text-slate-950">{draft.summary}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">La lectura va del resultado de negocio a los problemas que conviene resolver y, después, al trabajo que ya existe. Puedes cambiar cualquier agrupación antes de confirmar.</p>
      </div>

      <div className="space-y-6" data-testid="portfolio-organization-cascade">
        {organizationOptedOut ? <OrganizationOptOutState onResume={resumeOrganizationReview} /> : draft.fronts.map((front, frontIndex) => <article key={front.candidateId} className="relative overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/40" data-testid={`organization-front-${front.candidateId}`}>
          <div className="border-b border-violet-200 bg-gradient-to-br from-violet-100/80 via-white to-white p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <p className="text-xs font-extrabold tracking-[0.14em] text-violet-800">FRENTE ESTRATÉGICO PROPUESTO</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{front.name}</h3>
              </div>
              <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-bold text-violet-800">Cobertura · {front.coverage}</span>
            </div>
            <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-violet-100 bg-violet-100 md:grid-cols-2">
              <OrganizationDefinition label="Resultado de negocio" value={front.focus} />
              <OrganizationDefinition label="KPI / señal" value={projection.anchor.businessSignalValue ?? 'Por confirmar'} />
              <OrganizationDefinition label="Decisión que ayuda a tomar" value={projection.anchor.decisionToEnable ?? 'Por confirmar'} />
              <OrganizationDefinition label="Por qué conviene organizarlo así" value={front.rationale} />
            </dl>
            <details className="mt-4 rounded-lg border border-violet-200 bg-white/80 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-violet-900">Editar frente estratégico</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">Nombre del frente estratégico<input aria-label="Nombre del frente estratégico" value={front.name} onChange={(event) => mutate((value) => updateFront(value, front.candidateId, { name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
                <label className="text-sm font-semibold text-slate-800">Resultado / foco que organiza<textarea aria-label="Foco del frente estratégico" value={front.focus} onChange={(event) => mutate((value) => updateFront(value, front.candidateId, { focus: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
              </div>
            </details>
          </div>

          <div className="space-y-4 p-4 md:p-6">
            <FrontChallengeTransition challengeCount={front.challenges.length} />
            {front.challenges.map((challenge, challengeIndex) => <section key={challenge.candidateId} className="ml-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:ml-8 md:p-5" data-testid={`organization-challenge-${challenge.candidateId}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <p className="text-xs font-extrabold tracking-[0.14em] text-sky-800">RETO PROPUESTO</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><h4 className="text-lg font-semibold text-slate-950">{challenge.title}</h4><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">{initiativeCountLabel(challenge.relatedInitiativeIds.length)}</span></div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Reto {challengeOrdinal.get(challenge.candidateId)}</p>
                </div>
                <button type="button" aria-label={`Revisar propuesta: ${challenge.title}`} onClick={() => setChallengeReview({ frontId: front.candidateId, challengeId: challenge.candidateId })} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-50">Revisar propuesta</button>
              </div>
              <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                <OrganizationDefinition label="Problema o incertidumbre" value={challenge.problem} compact />
                <OrganizationDefinition label="Decisión que ayuda a tomar" value={challengeDecision(challenge)} compact />
                <OrganizationDefinition label="Por qué estas iniciativas están juntas" value={challengeGroupingRationale(challenge)} compact />
              </dl>
              <SpecificOverlapSummary comparisons={specificChallengeComparisons(challenge, workById)} />
              <div className="mt-5 border-l-2 border-sky-200 pl-3 md:pl-5">
                <p className="text-xs font-extrabold tracking-[0.14em] text-slate-600">INICIATIVAS EN ESTE RETO</p>
                <InitiativePlacementList
                  ids={challenge.relatedInitiativeIds}
                  workById={workById}
                  movingInitiativeId={movingInitiativeId}
                  destinationOptions={destinationOptions}
                  placementFor={placementFor}
                  insightFor={(id) => insightFor(id, 'challenge', challenge.overlaps, challenge.relatedInitiativeIds)}
                  onMoveStart={setMovingInitiativeId}
                  onMove={(id, destination) => { placeInitiative(id, destination); setMovingInitiativeId(null); }}
                  empty="Este reto no tiene iniciativas. Puedes combinarlo o dejarlo como hipótesis durante la revisión."
                />
              </div>
              <ChallengeGapSignal gaps={challenge.gaps} />
              <ChallengeClosingSummary challenge={challenge} projection={projection} />
            </section>)}
            {frontIndex === 0 && draft.fronts.length === 1 ? <p className="ml-3 text-xs leading-5 text-slate-600 md:ml-8">Se propone un solo frente porque las iniciativas incluidas persiguen el mismo resultado. Los retos sólo deben separar problemas o decisiones realmente distintos.</p> : null}
          </div>
        </article>)}
      </div>

      <section className="space-y-3 border-t border-slate-200 pt-6" aria-labelledby="other-destinations-heading">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Otros destinos posibles</p><h3 id="other-destinations-heading" className="mt-1 text-lg font-semibold text-slate-950">El trabajo no tiene que encajar a la fuerza</h3><p className="mt-1 text-sm text-slate-600">Estas opciones también forman parte de la propuesta y conservan la trazabilidad de cada movimiento.</p></div>
        <OrganizationBucket title="Apoyo transversal" description="Contribuyen a varios retos sin pertenecer exclusivamente a uno." ids={draft.crossCuttingInitiativeIds} workById={workById} movingInitiativeId={movingInitiativeId} destinationOptions={destinationOptions} placementFor={placementFor} insightFor={(id) => insightFor(id, 'cross-cutting')} onMoveStart={setMovingInitiativeId} onMove={(id, destination) => { placeInitiative(id, destination); setMovingInitiativeId(null); }} empty="Ninguna iniciativa está marcada como apoyo transversal." />
        <OrganizationBucket title="Sin agrupar" description="Permanecen disponibles mientras falta información o no encajan todavía en un problema común." ids={draft.ungroupedInitiativeIds} workById={workById} movingInitiativeId={movingInitiativeId} destinationOptions={destinationOptions} placementFor={placementFor} insightFor={(id) => insightFor(id, 'ungrouped')} onMoveStart={setMovingInitiativeId} onMove={(id, destination) => { placeInitiative(id, destination); setMovingInitiativeId(null); }} empty="Ninguna iniciativa queda sin agrupar." />
        <OrganizationBucket title="Fuera del objetivo actual" description="Se conservan en Portfolio, pero no forman parte de este objetivo por ahora." ids={draft.outsideObjectiveInitiativeIds} workById={workById} movingInitiativeId={movingInitiativeId} destinationOptions={destinationOptions} placementFor={placementFor} insightFor={(id) => insightFor(id, 'outside')} onMoveStart={setMovingInitiativeId} onMove={(id, destination) => { placeInitiative(id, destination); setMovingInitiativeId(null); }} empty="Ninguna iniciativa se mantiene fuera del objetivo." />
      </section>
      {splitReview ? <ChallengeSplitReview
        challenge={draft.fronts.find((front) => front.candidateId === splitReview.frontId)?.challenges.find((challenge) => challenge.candidateId === splitReview.challengeId) ?? null}
        suggestionVisible={splitReview.suggestionVisible}
        onSuggest={() => setSplitReview((value) => value ? { ...value, suggestionVisible: true } : value)}
        onCreate={() => {
          mutate((value) => splitChallenge(value, splitReview.frontId, splitReview.challengeId));
          setSplitReview(null);
        }}
        onCancel={() => setSplitReview(null)}
      /> : null}
      {challengeReview ? <ChallengeProposalReview
        key={`${challengeReview.frontId}-${challengeReview.challengeId}`}
        front={draft.fronts.find((front) => front.candidateId === challengeReview.frontId) ?? null}
        challenge={draft.fronts.find((front) => front.candidateId === challengeReview.frontId)?.challenges.find((challenge) => challenge.candidateId === challengeReview.challengeId) ?? null}
        projection={projection}
        onEdit={(patch) => {
          mutate((value) => updateChallenge(value, challengeReview.frontId, challengeReview.challengeId, patch));
          setChallengeReview(null);
        }}
        onAdd={(input) => {
          mutate((value) => addChallengeCandidate(value, challengeReview.frontId, input, workItemIds));
          setChallengeReview(null);
        }}
        onSplit={() => {
          setSplitReview({ frontId: challengeReview.frontId, challengeId: challengeReview.challengeId, suggestionVisible: false });
          setChallengeReview(null);
        }}
        onMerge={(targetChallengeId) => {
          mutate((value) => mergeChallengeInto(value, challengeReview.frontId, challengeReview.challengeId, targetChallengeId));
          setChallengeReview(null);
        }}
        onRemove={(disposition, targetChallengeId) => {
          mutate((value) => removeChallengeCandidate(value, challengeReview.frontId, challengeReview.challengeId, disposition, targetChallengeId, workItemIds));
          setChallengeReview(null);
        }}
        onUngroupChallenge={() => {
          mutate((value) => moveChallengeInitiativesToUngrouped(value, challengeReview.frontId, challengeReview.challengeId));
          setChallengeReview(null);
        }}
        onOptOut={() => {
          chooseNotToOrganize();
          setChallengeReview(null);
        }}
        onClose={() => setChallengeReview(null)}
      /> : null}
      {optOutReviewOpen ? <OrganizationOptOutReview
        onConfirm={() => {
          chooseNotToOrganize();
          setOptOutReviewOpen(false);
        }}
        onCancel={() => setOptOutReviewOpen(false)}
      /> : null}
      {(localError || error) ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{localError || error}</p> : null}
      <OrganizationValueExplainer onOptOut={() => setOptOutReviewOpen(true)} />
      <OrganizationConfirmationSummary draft={draft} reviewNeedsSaving={reviewNeedsSaving} unavailableReason={confirmationUnavailableReason} optedOut={organizationOptedOut} />
      <div className="flex flex-wrap gap-2"><button type="button" onClick={save} disabled={!dirty || !onSave || reviewLocked} className="rounded-lg border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-950 disabled:opacity-50">{reviewLocked && status !== 'confirming' ? 'Guardando…' : 'Guardar y continuar después'}</button><button type="button" aria-describedby="organization-confirmation-state" onClick={confirm} disabled={Boolean(confirmationUnavailableReason) || reviewLocked} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{status === 'confirming' ? 'Confirmando…' : reviewLocked ? 'Guardando revisión…' : 'Confirmar estructura estratégica'}</button></div>
      </fieldset>
    </section>
  </>;
}

function OrganizationStageIntro() {
  return <section className="ml-0 overflow-hidden rounded-2xl border border-violet-200 bg-white md:ml-11" aria-labelledby="organization-stage-title">
    <div className="bg-violet-50 px-5 py-4 md:px-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-800">PL-04 · Organización propuesta</p><h3 id="organization-stage-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Define la estructura estratégica del objetivo</h3><p className="mt-2 text-sm leading-6 text-slate-700">Aquí estás definiendo la estructura estratégica con la que darás seguimiento al objetivo.</p></div>
    <div className="grid gap-px bg-slate-200 md:grid-cols-3">
      <OrganizationConcept step="01" title="Frente estratégico" description="El resultado de negocio que quieres mover." />
      <OrganizationConcept step="02" title="Reto" description="El problema o foco principal que conviene abordar dentro de ese frente." />
      <OrganizationConcept step="03" title="Iniciativas" description="Los trabajos existentes que aportan, se solapan o quedan fuera." />
    </div>
  </section>;
}

function OrganizationConcept({ step, title, description }: { step: string; title: string; description: string }) {
  return <div className="bg-white p-4 md:p-5"><p className="text-xs font-bold text-violet-700">{step}</p><p className="mt-1 text-sm font-semibold text-slate-950">{title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{description}</p></div>;
}

function OrganizationDefinition({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  if (compact) return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 leading-6 text-slate-700">{value}</dd></div>;
  return <div className="bg-white/90 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{value}</dd></div>;
}

function FrontChallengeTransition({ challengeCount }: { challengeCount: number }) {
  const challengeLabel = challengeCount === 1 ? '1 reto principal' : `${challengeCount} retos principales`;
  return <section className="ml-3 border-l-2 border-violet-300 py-1 pl-4 md:ml-8 md:pl-5" data-testid="front-challenge-transition">
    <p className="text-sm font-semibold text-slate-950">{`Dentro de este frente Startería identificó ${challengeLabel}.`}</p>
    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Separar retos hace visibles problemas o decisiones diferentes, permite comparar mejor las iniciativas y evita priorizarlas como si respondieran a la misma incertidumbre.</p>
    {challengeCount === 1 ? <p className="mt-2 text-sm leading-6 text-sky-950">Las iniciativas parecen concentrarse en un único problema principal; no hace falta dividirlo salvo que identifiques problemas o decisiones distintas.</p> : null}
    <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-bold tracking-wide text-slate-700">Objetivo → Frente estratégico → {challengeCount === 1 ? 'Reto' : 'Retos'} → Iniciativas</p>
  </section>;
}

function ChallengeSplitReview({
  challenge,
  suggestionVisible,
  onSuggest,
  onCreate,
  onCancel,
}: {
  challenge: PortfolioOrganizationPayload['fronts'][number]['challenges'][number] | null;
  suggestionVisible: boolean;
  onSuggest: () => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const total = challenge?.relatedInitiativeIds.length ?? 0;
  const firstCount = Math.ceil(total / 2);
  const secondCount = total - firstCount;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Revisar separación del reto">
    <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl md:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Decisión guiada</p><h3 className="mt-1 text-lg font-semibold text-slate-950">¿Cuándo puede tener sentido separar este reto?</h3></div><button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-600">Cerrar</button></div>
      <p className="mt-3 text-sm font-medium leading-6 text-slate-800">No necesitas crear más retos por completar estructura.</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">Puede valer la pena si:</p>
      <ul className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
        <li>• Las iniciativas intentan resolver problemas claramente distintos.</li>
        <li>• Requieren decisiones diferentes.</li>
        <li>• Requieren equipos o capacidades diferentes.</li>
        <li>• Una parte puede avanzar independientemente de la otra.</li>
        <li>• Existen grupos con evidencia o estado muy diferente.</li>
        <li>• Identificas una distinción que Startería no detectó.</li>
      </ul>
      <p className="mt-3 text-xs leading-5 text-slate-500">Abrir esta ayuda no modifica la propuesta. Crear un segundo reto sólo cambia el borrador revisable; nada se materializa antes de confirmar la estructura.</p>
      {suggestionVisible ? <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4" data-testid="challenge-split-preview"><p className="text-sm font-semibold text-sky-950">{`Vista previa: las ${total} iniciativas quedarían repartidas en grupos de ${firstCount} y ${secondCount}.`}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><p className="rounded-lg bg-white p-3 text-sm text-slate-700"><b>{challenge?.title}</b><br />{firstCount} iniciativas</p><p className="rounded-lg bg-white p-3 text-sm text-slate-700"><b>Segundo reto por precisar</b><br />{secondCount} iniciativas</p></div><p className="mt-3 text-xs leading-5 text-sky-900">La sugerencia sólo reparte el trabajo para facilitar la revisión. El nombre, el problema y las iniciativas del segundo reto siguen bajo decisión humana.</p></div> : null}
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onSuggest} className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-900">Proponer una separación</button><button type="button" onClick={onCreate} disabled={!challenge || total < 2} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Crear segundo reto</button><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancelar / volver sin cambios</button></div>
    </section>
  </div>;
}

type OrganizationChallenge = PortfolioOrganizationPayload['fronts'][number]['challenges'][number];
type ChallengeReviewMode = 'menu' | 'rationale' | 'edit' | 'add' | 'merge' | 'remove' | 'disagree';
type ChallengeRemovalDisposition = 'ungrouped' | 'move' | 'individual';
type AddChallengeInput = { title: string; problem: string; decision: string; relatedInitiativeIds: string[] };
const ORGANIZATION_OPT_OUT_SUMMARY = 'Organización pospuesta por decisión del Portfolio Lead.';

function ChallengeProposalReview({
  front,
  challenge,
  projection,
  onEdit,
  onAdd,
  onSplit,
  onMerge,
  onRemove,
  onUngroupChallenge,
  onOptOut,
  onClose,
}: {
  front: PortfolioOrganizationPayload['fronts'][number] | null;
  challenge: OrganizationChallenge | null;
  projection: BootstrapProjection;
  onEdit: (patch: Partial<OrganizationChallenge>) => void;
  onAdd: (input: AddChallengeInput) => void;
  onSplit: () => void;
  onMerge: (targetChallengeId: string) => void;
  onRemove: (disposition: ChallengeRemovalDisposition, targetChallengeId?: string) => void;
  onUngroupChallenge: () => void;
  onOptOut: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ChallengeReviewMode>('menu');
  const [title, setTitle] = useState(challenge?.title ?? '');
  const [problem, setProblem] = useState(challenge?.problem ?? '');
  const [decision, setDecision] = useState(challenge ? challengeDecision(challenge) : '');
  const [groupingRationale, setGroupingRationale] = useState(challenge ? challengeGroupingRationale(challenge) : '');
  const [newTitle, setNewTitle] = useState('');
  const [newProblem, setNewProblem] = useState('');
  const [newDecision, setNewDecision] = useState('');
  const [newRelatedIds, setNewRelatedIds] = useState<string[]>([]);
  const otherChallenges = front?.challenges.filter((candidate) => candidate.candidateId !== challenge?.candidateId) ?? [];
  const isOnlyChallenge = otherChallenges.length === 0;
  const [mergeTargetId, setMergeTargetId] = useState(otherChallenges[0]?.candidateId ?? '');
  const [removalDisposition, setRemovalDisposition] = useState<ChallengeRemovalDisposition | ''>('');
  const [removalTargetId, setRemovalTargetId] = useState(otherChallenges[0]?.candidateId ?? '');
  const [disagreement, setDisagreement] = useState('');
  if (!front || !challenge) return null;

  const workById = new Map(projection.workItems.map((item) => [item.id, item]));
  const initiativeNames = challenge.relatedInitiativeIds.map((id) => workById.get(id)?.proposedName ?? workById.get(id)?.rawLabel ?? id);
  const sourceLabels = unique(challenge.relatedInitiativeIds.map((id) => organizationSourceLabel(workById.get(id), projection.importBatches)));
  const goBack = () => setMode('menu');
  const executeDisagreement = () => {
    if (disagreement === 'incorrect-problem') setMode('edit');
    if (disagreement === 'multiple-problems') onSplit();
    if (disagreement === 'wrong-group') onUngroupChallenge();
    if (disagreement === 'missing-challenge') setMode('add');
    if (disagreement === 'not-now') onOptOut();
  };
  const disagreementAction = disagreement === 'incorrect-problem'
    ? 'Corregir el problema'
    : disagreement === 'multiple-problems'
      ? 'Revisar una separación'
      : disagreement === 'wrong-group'
        ? 'Dejar estas iniciativas sin agrupar'
        : disagreement === 'missing-challenge'
          ? 'Añadir el reto que falta'
          : disagreement === 'not-now'
            ? 'Mantener todo sin organizar'
            : 'Continuar';

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 md:p-6" role="dialog" aria-modal="true" aria-label="Revisar propuesta de reto">
    <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 md:px-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Propuesta abierta a debate</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{challenge.title}</h3><p className="mt-1 text-sm text-slate-600">Puedes cuestionar, completar o reorganizar esta propuesta antes de confirmar.</p></div>
        <button type="button" onClick={onClose} className="shrink-0 text-sm font-semibold text-slate-600">Cerrar</button>
      </header>
      <div className="p-5 md:p-6">
        {mode === 'menu' ? <div className="space-y-5">
          <div><h4 className="font-semibold text-slate-950">¿Qué quieres revisar?</h4><p className="mt-1 text-sm leading-6 text-slate-600">Nada se materializa mientras trabajas aquí. Todos los cambios afectan únicamente a la propuesta provisional.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ReviewAction label="Entender por qué Startería lo propone" description="Revisar el patrón, las fuentes, los vacíos y la decisión." onClick={() => setMode('rationale')} />
            <ReviewAction label="Editar reto" description="Corregir el nombre, el problema o la decisión." onClick={() => setMode('edit')} />
            <ReviewAction label="+ Añadir otro reto" description="Incorporar un problema que falta en la propuesta." onClick={() => setMode('add')} />
            <ReviewAction label="Separar en dos retos" description="Evaluar si aquí conviven problemas distintos." onClick={onSplit} />
            <ReviewAction label="Combinar con otro reto" description={otherChallenges.length > 0 ? 'Reunir dos propuestas que explican el mismo problema.' : 'Necesitas otro reto en la propuesta para combinarlos.'} onClick={() => setMode('merge')} disabled={otherChallenges.length === 0} />
            <ReviewAction label="Quitar este reto de la propuesta" description="Retirarlo sin borrar iniciativas ni fuentes." onClick={() => setMode('remove')} />
          </div>
          <button type="button" aria-label="No estoy de acuerdo con esta propuesta" onClick={() => setMode('disagree')} className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-950">No estoy de acuerdo con esta propuesta<span className="mt-1 block text-xs font-normal leading-5 text-amber-900">Explica qué no encaja y elige cómo quieres cambiar el borrador.</span></button>
        </div> : null}

        {mode === 'rationale' ? <div className="space-y-5">
          <ReviewBack onClick={goBack} />
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Explicación en lenguaje de negocio</p><h4 className="mt-1 text-lg font-semibold text-slate-950">Por qué Startería propone este reto</h4></div>
          <RationaleItem label="Patrón detectado" value={challengeGroupingRationale(challenge)} />
          <RationaleItem label="Iniciativas que sustentan la propuesta" value={initiativeNames.length > 0 ? initiativeNames.join(', ') : 'Todavía no hay iniciativas relacionadas.'} />
          {challenge.evidence.length > 0 ? <RationaleItem label="Evidencia disponible" value={challenge.evidence.join(' ')} /> : null}
          {sourceLabels.length > 0 ? <RationaleItem label="Procedencia" value={sourceLabels.join(', ')} /> : null}
          <RationaleItem label="Vacíos relevantes" value={challenge.gaps.length > 0 ? challenge.gaps.join(' ') : 'No se detectan vacíos críticos para organizar.'} />
          <RationaleItem label="Decisión que ayuda a tomar" value={challengeDecision(challenge)} />
          <RationaleItem label="Por qué tratarlo como un reto separado" value={`Permite decidir sobre “${challenge.problem}” sin mezclarlo con problemas que podrían requerir otra prioridad, evidencia o capacidad.`} />
        </div> : null}

        {mode === 'edit' ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onEdit({ title: title.trim(), problem: problem.trim(), rationale: composeChallengeRationale(groupingRationale, decision) }); }}>
          <ReviewBack onClick={goBack} />
          <div><h4 className="text-lg font-semibold text-slate-950">Editar reto</h4><p className="mt-1 text-sm text-slate-600">Corrige la interpretación de Startería con tus palabras.</p></div>
          <ReviewField label="Nombre del reto"><input aria-label="Nombre del reto" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></ReviewField>
          <ReviewField label="Problema o incertidumbre"><textarea aria-label="Problema o incertidumbre del reto" value={problem} onChange={(event) => setProblem(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></ReviewField>
          <ReviewField label="Decisión que ayuda a tomar"><textarea aria-label="Decisión que ayuda a tomar" value={decision} onChange={(event) => setDecision(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></ReviewField>
          <ReviewField label="Por qué conviene agrupar estas iniciativas"><textarea aria-label="Por qué conviene agrupar estas iniciativas" value={groupingRationale} onChange={(event) => setGroupingRationale(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></ReviewField>
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={!title.trim() || !problem.trim() || !decision.trim()} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Aplicar cambios al reto</button><button type="button" onClick={goBack} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Volver sin cambios</button></div>
        </form> : null}

        {mode === 'add' ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onAdd({ title: newTitle, problem: newProblem, decision: newDecision, relatedInitiativeIds: newRelatedIds }); }}>
          <ReviewBack onClick={goBack} />
          <div><h4 className="text-lg font-semibold text-slate-950">Añadir otro reto</h4><p className="mt-1 text-sm leading-6 text-slate-600">Añade una hipótesis que Startería no detectó. Seguirá siendo provisional hasta la confirmación final.</p></div>
          <ReviewField label="Nombre opcional"><input aria-label="Nombre del nuevo reto" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Si lo dejas vacío, usaremos una síntesis del problema" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></ReviewField>
          <ReviewField label="Problema o incertidumbre"><textarea aria-label="Problema o incertidumbre del nuevo reto" value={newProblem} onChange={(event) => setNewProblem(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></ReviewField>
          <ReviewField label="Decisión que ayudaría a tomar"><textarea aria-label="Decisión que ayudaría a tomar" value={newDecision} onChange={(event) => setNewDecision(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></ReviewField>
          <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-slate-800">Iniciativas relacionadas opcionales</legend><p className="mb-3 text-xs leading-5 text-slate-500">Si eliges una iniciativa, se moverá desde su ubicación actual a este nuevo reto sin perder procedencia ni análisis.</p><div className="grid gap-2 sm:grid-cols-2">{projection.workItems.map((item) => { const label = item.proposedName ?? item.rawLabel; return <label key={item.id} className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" aria-label={`Relacionar ${label}`} checked={newRelatedIds.includes(item.id)} onChange={(event) => setNewRelatedIds((ids) => event.target.checked ? unique([...ids, item.id]) : ids.filter((id) => id !== item.id))} className="mt-1" /><span>{label}</span></label>; })}</div></fieldset>
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">Puedes usar el problema y la decisión como guía de redacción; no necesitas imitar el lenguaje de Startería.</p>
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={!newProblem.trim() || !newDecision.trim()} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Añadir reto a la propuesta</button><button type="button" onClick={goBack} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button></div>
        </form> : null}

        {mode === 'merge' ? <div className="space-y-4">
          <ReviewBack onClick={goBack} />
          <div><h4 className="text-lg font-semibold text-slate-950">Combinar con otro reto</h4><p className="mt-1 text-sm leading-6 text-slate-600">Las iniciativas, fuentes, gaps y comparaciones de ambos retos se conservarán en una sola propuesta.</p></div>
          <ReviewField label="Reto de destino"><select aria-label="Reto con el que combinar" value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{otherChallenges.map((candidate) => <option key={candidate.candidateId} value={candidate.candidateId}>{candidate.title}</option>)}</select></ReviewField>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={!mergeTargetId} onClick={() => onMerge(mergeTargetId)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Combinar retos</button><button type="button" onClick={goBack} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button></div>
        </div> : null}

        {mode === 'remove' ? <div className="space-y-4">
          <ReviewBack onClick={goBack} />
          <div><h4 className="text-lg font-semibold text-slate-950">Quitar reto de la propuesta</h4><p className="mt-1 text-sm leading-6 text-slate-600">Esto retira únicamente el reto candidato. No se borrará ninguna iniciativa, fuente, procedencia ni análisis.</p>{isOnlyChallenge ? <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">Es el único reto de la propuesta. Si lo quitas, la organización quedará pausada y todas las iniciativas seguirán disponibles individualmente. No se creará estructura canónica y podrás volver a organizar más adelante.</p> : null}</div>
          {challenge.relatedInitiativeIds.length > 0 ? <fieldset className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><legend className="px-1 text-sm font-semibold text-amber-950">¿Qué quieres hacer con sus iniciativas?</legend><RemovalChoice value="ungrouped" selected={removalDisposition} onChange={setRemovalDisposition} label="Mantener iniciativas sin agrupar" /><RemovalChoice value="move" selected={removalDisposition} onChange={setRemovalDisposition} label="Mover a otro reto" disabled={otherChallenges.length === 0} /><RemovalChoice value="individual" selected={removalDisposition} onChange={setRemovalDisposition} label="Revisar individualmente" />{removalDisposition === 'move' ? <select aria-label="Reto de destino para las iniciativas" value={removalTargetId} onChange={(event) => setRemovalTargetId(event.target.value)} className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm">{otherChallenges.map((candidate) => <option key={candidate.candidateId} value={candidate.candidateId}>{candidate.title}</option>)}</select> : null}</fieldset> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Este reto no contiene iniciativas; puedes retirarlo sin afectar el resto de la propuesta.</p>}
          <div className="flex flex-wrap gap-2"><button type="button" disabled={challenge.relatedInitiativeIds.length > 0 && (!removalDisposition || (removalDisposition === 'move' && !removalTargetId))} onClick={() => onRemove(removalDisposition || 'ungrouped', removalTargetId || undefined)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isOnlyChallenge ? 'Quitar reto y dejar todo sin organizar' : 'Quitar reto'}</button><button type="button" onClick={goBack} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button></div>
        </div> : null}

        {mode === 'disagree' ? <div className="space-y-4">
          <ReviewBack onClick={goBack} />
          <div><h4 className="text-lg font-semibold text-slate-950">No estoy de acuerdo con esta propuesta</h4><p className="mt-1 text-sm leading-6 text-slate-600">Elige la razón que mejor explica tu objeción. Startería te llevará a una modificación concreta del borrador.</p></div>
          <fieldset className="space-y-3"><legend className="sr-only">Motivo del desacuerdo</legend>{[
            ['incorrect-problem', 'El problema planteado no es correcto.'],
            ['multiple-problems', 'Hay más de un problema.'],
            ['wrong-group', 'Estas iniciativas no deberían estar juntas.'],
            ['missing-challenge', 'Falta un reto que Startería no detectó.'],
            ['not-now', 'Prefiero no organizar todavía.'],
          ].map(([value, label]) => <label key={value} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-800"><input type="radio" name="challenge-disagreement" value={value} checked={disagreement === value} onChange={() => setDisagreement(value)} className="mt-1" /><span>{label}</span></label>)}</fieldset>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={!disagreement} onClick={executeDisagreement} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{disagreementAction}</button><button type="button" onClick={goBack} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button></div>
        </div> : null}
      </div>
    </section>
  </div>;
}

function ReviewAction({ label, description, onClick, disabled = false }: { label: string; description: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"><span className="block text-sm font-semibold text-slate-950">{label}</span><span className="mt-1 block text-xs font-normal leading-5 text-slate-600">{description}</span></button>;
}

function ReviewBack({ onClick }: { onClick: () => void }) {
  return <button type="button" aria-label="Volver a opciones de revisión" onClick={onClick} className="text-sm font-semibold text-violet-800">← Volver a opciones de revisión</button>;
}

function ReviewField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-800">{label}{children}</label>;
}

function RationaleItem({ label, value }: { label: string; value: string }) {
  return <section className="border-l-2 border-sky-200 pl-4"><h5 className="text-xs font-bold uppercase tracking-wide text-sky-800">{label}</h5><p className="mt-1 text-sm leading-6 text-slate-700">{value}</p></section>;
}

function RemovalChoice({ value, selected, onChange, label, disabled = false }: { value: ChallengeRemovalDisposition; selected: ChallengeRemovalDisposition | ''; onChange: (value: ChallengeRemovalDisposition) => void; label: string; disabled?: boolean }) {
  return <label className={`flex items-start gap-3 text-sm ${disabled ? 'text-slate-400' : 'text-amber-950'}`}><input type="radio" name="challenge-removal" value={value} checked={selected === value} disabled={disabled} onChange={() => onChange(value)} className="mt-1" /><span>{label}</span></label>;
}

function OrganizationOptOutReview({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Revisar decisión de no organizar">
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl md:p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Alternativa válida</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Prefiero no organizar todavía</h3><p className="mt-3 text-sm leading-6 text-slate-700">Las iniciativas permanecerán disponibles individualmente. No se pierde información ni se crea estructura canónica; tendrás menos claridad agregada sobre cobertura, solapamientos y prioridades, y podrás volver a organizar más adelante.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onConfirm} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Mantener iniciativas sin organizar</button><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar / volver sin cambios</button></div></section>
  </div>;
}

function OrganizationOptOutState({ onResume }: { onResume: () => void }) {
  return <section className="rounded-2xl border border-slate-300 bg-slate-50 p-5 md:p-6" data-testid="organization-opt-out-state"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Propuesta pausada por decisión humana</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Has decidido no organizar todavía</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Las iniciativas siguen accesibles individualmente y no se pierde información. No se creará ningún Frente ni Reto canónico. Puedes guardar esta revisión y volver cuando tenga sentido.</p><button type="button" onClick={onResume} className="mt-4 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900">Volver a revisar una organización</button></section>;
}

type SpecificComparison = { initiativeIds: string[]; names: string[]; rationale: string };

function specificChallengeComparisons(
  challenge: PortfolioOrganizationPayload['fronts'][number]['challenges'][number],
  workById: Map<string, BootstrapProjection['workItems'][number]>,
): SpecificComparison[] {
  const initiatives = challenge.relatedInitiativeIds.map((id) => ({ id, name: workById.get(id)?.proposedName ?? workById.get(id)?.rawLabel ?? id }));
  return challenge.overlaps.flatMap((rationale) => {
    const related = initiatives.filter((initiative) => rationale.toLocaleLowerCase().includes(initiative.name.toLocaleLowerCase()));
    return related.length >= 2 ? [{ initiativeIds: related.map((initiative) => initiative.id), names: related.map((initiative) => initiative.name), rationale }] : [];
  });
}

function SpecificOverlapSummary({ comparisons }: { comparisons: SpecificComparison[] }) {
  if (comparisons.length === 0) return null;
  return <section className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-3"><p className="text-xs font-bold uppercase tracking-wide text-sky-800">Comparaciones sugeridas</p><ul className="mt-2 space-y-2">{comparisons.map((comparison) => <li key={`${comparison.names.join('-')}-${comparison.rationale}`} className="text-sm text-slate-700"><b>{`Comparar ${comparison.names.join(' con ')}`}</b><p className="mt-0.5">{comparison.rationale} Es un posible solapamiento; no implica una duplicidad confirmada.</p></li>)}</ul></section>;
}

function ChallengeGapSignal({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">No se detectan vacíos críticos para organizar este reto.</p>;
  return <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3"><p className="text-sm font-semibold text-amber-950">Información pendiente que se conserva</p><ul className="mt-1 space-y-1 text-sm text-amber-900">{gaps.map((gap) => <li key={gap}>{gap} Puede afectar la comparación o priorización, pero no bloquea la organización.</li>)}</ul></section>;
}

function ChallengeClosingSummary({
  challenge,
  projection,
}: {
  challenge: PortfolioOrganizationPayload['fronts'][number]['challenges'][number];
  projection: BootstrapProjection;
}) {
  const workById = new Map(projection.workItems.map((item) => [item.id, item]));
  const insights = challenge.relatedInitiativeIds.map((id) => organizationInitiativeInsight(id, projection, 'challenge', challenge.overlaps, challenge.relatedInitiativeIds));
  const direct = insights.filter((insight) => insight.alignment === 'Relación directa con el objetivo').length;
  const partial = insights.filter((insight) => insight.alignment === 'Relación parcial con el objetivo').length;
  const enabling = insights.filter((insight) => insight.alignment === 'Función habilitadora').length;
  const outside = insights.filter((insight) => insight.alignment === 'Fuera del objetivo actual').length;
  const pending = insights.length - direct - partial - enabling - outside;
  const stages = [...new Set(insights.map((insight) => insight.maturity.toLocaleLowerCase()))].join(', ');
  const comparisons = specificChallengeComparisons(challenge, workById).length;
  return <section className="mt-5 border-t border-slate-200 pt-4" data-testid={`challenge-summary-${challenge.candidateId}`}><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Resumen del reto</p><p className="mt-2 text-sm font-semibold text-slate-900">{`${challenge.relatedInitiativeIds.length} iniciativas · ${direct} directas · ${partial} parciales · ${enabling} habilitadoras · ${outside} fuera · ${pending} por confirmar`}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-slate-100 px-2.5 py-1">{`Etapas documentales: ${stages || 'por confirmar'}`}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{`${comparisons} ${comparisons === 1 ? 'comparación específica' : 'comparaciones específicas'}`}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">0 vacíos críticos</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{`${challenge.gaps.length} pendientes conservados`}</span></div></section>;
}

function buildOrganizationProposal(projection: BootstrapProjection): PortfolioOrganizationPayload {
  const connections = new Map(projection.strategicConnections.map((connection) => [connection.workItemId, connection]));
  const outsideObjectiveInitiativeIds = projection.workItems.filter((item) => {
    const status = connections.get(item.id)?.status;
    return status === 'out_of_current_priority' || status === 'confirmed_misalignment';
  }).map((item) => item.id);
  const ungroupedInitiativeIds = projection.workItems.filter((item) => {
    const status = connections.get(item.id)?.status;
    return !status || status === 'alignment_unknown';
  }).map((item) => item.id);
  const relatedInitiativeIds = projection.workItems.map((item) => item.id)
    .filter((id) => !outsideObjectiveInitiativeIds.includes(id) && !ungroupedInitiativeIds.includes(id));
  const gaps = projection.advancementConditions.map((condition) => condition.statement).filter(Boolean);
  const count = projection.workItems.length;
  return {
    summary: `Startería propone esta organización a partir de las ${count} iniciativas revisadas.`,
    fronts: [{
      candidateId: `front-${projection.bootstrapSessionId}-1`,
      name: businessFrontName(projection.anchor.outcomeStatement),
      focus: projection.anchor.outcomeStatement,
      rationale: 'Reúne las iniciativas que persiguen el mismo resultado de negocio para poder comparar cobertura, prioridades y decisiones necesarias.',
      coverage: `${relatedInitiativeIds.length} de ${count} iniciativas revisadas`,
      challenges: [{
        candidateId: `challenge-${projection.bootstrapSessionId}-1`,
        title: 'Aclarar y remover las barreras para lograr el objetivo',
        problem: projection.anchor.decisionToEnable
          ? `Necesitamos resolver qué impide tomar esta decisión: ${projection.anchor.decisionToEnable}`
          : 'Necesitamos aclarar qué barreras explican la distancia entre las iniciativas actuales y el resultado esperado.',
        rationale: 'Estas iniciativas necesitan coordinar evidencia y decisiones sobre el mismo resultado; agruparlas permite comparar qué barrera atender primero sin asumir una solución.',
        relatedInitiativeIds,
        // Initiative names and descriptions are context, not evidence. Concrete
        // SourceRefs/evidence can be added during review without fabricating it.
        evidence: [],
        gaps,
        overlaps: relatedInitiativeIds.length > 1
          ? ['Varias iniciativas contribuyen al mismo resultado; revisa si duplican alcance, evidencia o medición.']
          : [],
      }],
    }],
    crossCuttingInitiativeIds: [],
    outsideObjectiveInitiativeIds,
    ungroupedInitiativeIds,
  };
}

function normalizeOrganizationPayload(payload: PortfolioOrganizationPayload, workItemIds: string[]): PortfolioOrganizationPayload {
  const crossCuttingInitiativeIds = payload.crossCuttingInitiativeIds ?? [];
  const assigned = new Set([
    ...payload.fronts.flatMap((front) => front.challenges.flatMap((challenge) => challenge.relatedInitiativeIds)),
    ...crossCuttingInitiativeIds,
    ...payload.outsideObjectiveInitiativeIds,
    ...payload.ungroupedInitiativeIds,
  ]);
  return {
    ...payload,
    crossCuttingInitiativeIds,
    ungroupedInitiativeIds: unique([
      ...payload.ungroupedInitiativeIds,
      ...workItemIds.filter((id) => !assigned.has(id)),
    ]),
  };
}

function businessFrontName(outcome: string): string {
  const normalized = outcome.trim().replace(/[.!?]+$/, '');
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77).trim()}…`;
}

function updateFront(payload: PortfolioOrganizationPayload, frontId: string, patch: Partial<PortfolioOrganizationPayload['fronts'][number]>): PortfolioOrganizationPayload {
  return { ...payload, fronts: payload.fronts.map((front) => front.candidateId === frontId ? { ...front, ...patch } : front) };
}

function updateChallenge(
  payload: PortfolioOrganizationPayload,
  frontId: string,
  challengeId: string,
  patch: Partial<PortfolioOrganizationPayload['fronts'][number]['challenges'][number]>,
): PortfolioOrganizationPayload {
  return updateFront(payload, frontId, {
    challenges: payload.fronts.find((front) => front.candidateId === frontId)?.challenges.map((challenge) => challenge.candidateId === challengeId ? { ...challenge, ...patch } : challenge) ?? [],
  });
}

function challengeDecision(challenge: OrganizationChallenge): string {
  const match = challenge.rationale.match(/(?:^|\n)Decisión:\s*(.+)$/i);
  return match?.[1]?.trim() || 'Qué respuesta priorizar y cómo coordinar la atención sobre este problema.';
}

function challengeGroupingRationale(challenge: OrganizationChallenge): string {
  return challenge.rationale.replace(/(?:^|\n)Decisión:\s*.+$/i, '').trim()
    || 'Estas iniciativas apuntan al mismo problema y conviene compararlas antes de priorizar.';
}

function composeChallengeRationale(groupingRationale: string, decision: string): string {
  return `${groupingRationale.trim()}\nDecisión: ${decision.trim()}`;
}

function addChallengeCandidate(
  payload: PortfolioOrganizationPayload,
  frontId: string,
  input: AddChallengeInput,
  workItemIds: string[],
): PortfolioOrganizationPayload {
  const front = payload.fronts.find((candidate) => candidate.candidateId === frontId);
  if (!front) return payload;
  const base = `${frontId.slice(0, 110)}-manual`;
  let suffix = front.challenges.length + 1;
  let candidateId = `${base}-${suffix}`;
  const existingIds = new Set(payload.fronts.flatMap((candidate) => candidate.challenges.map((challenge) => challenge.candidateId)));
  while (existingIds.has(candidateId)) { suffix += 1; candidateId = `${base}-${suffix}`; }
  const relatedInitiativeIds = unique(input.relatedInitiativeIds);
  const cleaned = clearInitiativePlacements(payload, relatedInitiativeIds);
  const challenge: OrganizationChallenge = {
    candidateId,
    title: input.title.trim() || summarizeChallengeTitle(input.problem),
    problem: input.problem.trim(),
    rationale: composeChallengeRationale('Propuesto por el Portfolio Lead para revisar un problema o decisión que no estaba representado.', input.decision),
    relatedInitiativeIds,
    evidence: [],
    gaps: [],
    overlaps: [],
  };
  const wasOptedOut = isOrganizationOptedOut(payload, workItemIds);
  return updateFront(cleaned, frontId, { challenges: wasOptedOut ? [challenge] : [...front.challenges.map((candidate) => cleaned.fronts.find((item) => item.candidateId === frontId)?.challenges.find((item) => item.candidateId === candidate.candidateId) ?? candidate), challenge] });
}

function summarizeChallengeTitle(problem: string): string {
  const normalized = problem.trim().replace(/[.!?]+$/, '');
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77).trim()}…`;
}

function clearInitiativePlacements(payload: PortfolioOrganizationPayload, ids: string[]): PortfolioOrganizationPayload {
  const moved = new Set(ids);
  return {
    ...payload,
    crossCuttingInitiativeIds: payload.crossCuttingInitiativeIds.filter((id) => !moved.has(id)),
    outsideObjectiveInitiativeIds: payload.outsideObjectiveInitiativeIds.filter((id) => !moved.has(id)),
    ungroupedInitiativeIds: payload.ungroupedInitiativeIds.filter((id) => !moved.has(id)),
    fronts: payload.fronts.map((front) => ({ ...front, challenges: front.challenges.map((challenge) => ({ ...challenge, relatedInitiativeIds: challenge.relatedInitiativeIds.filter((id) => !moved.has(id)) })) })),
  };
}

function splitChallenge(payload: PortfolioOrganizationPayload, frontId: string, challengeId: string): PortfolioOrganizationPayload {
  const front = payload.fronts.find((candidate) => candidate.candidateId === frontId);
  const challenge = front?.challenges.find((candidate) => candidate.candidateId === challengeId);
  if (!front || !challenge) return payload;
  const splitAt = Math.ceil(challenge.relatedInitiativeIds.length / 2);
  const retained = challenge.relatedInitiativeIds.slice(0, splitAt);
  const moved = challenge.relatedInitiativeIds.slice(splitAt);
  const copy = {
    ...challenge,
    candidateId: `${challenge.candidateId}-split-${front.challenges.length + 1}`,
    title: `${challenge.title} · segunda hipótesis`,
    relatedInitiativeIds: moved,
    rationale: 'Separado para que el Portfolio Lead pueda revisar una incertidumbre o decisión distinta.',
  };
  return updateFront(payload, frontId, { challenges: front.challenges.flatMap((candidate) => candidate.candidateId === challengeId ? [{ ...candidate, relatedInitiativeIds: retained }, copy] : [candidate]) });
}

function mergeChallengeInto(payload: PortfolioOrganizationPayload, frontId: string, challengeId: string, targetChallengeId: string): PortfolioOrganizationPayload {
  const front = payload.fronts.find((candidate) => candidate.candidateId === frontId);
  const current = front?.challenges.find((candidate) => candidate.candidateId === challengeId);
  const target = front?.challenges.find((candidate) => candidate.candidateId === targetChallengeId);
  if (!front || !current || !target || current.candidateId === target.candidateId) return payload;
  const merged = {
    ...target,
    relatedInitiativeIds: unique([...target.relatedInitiativeIds, ...current.relatedInitiativeIds]),
    evidence: unique([...target.evidence, ...current.evidence]),
    gaps: unique([...target.gaps, ...current.gaps]),
    overlaps: unique([...target.overlaps, ...current.overlaps]),
  };
  return updateFront(payload, frontId, { challenges: front.challenges.map((candidate) => candidate.candidateId === targetChallengeId ? merged : candidate).filter((candidate) => candidate.candidateId !== challengeId) });
}

function removeChallengeCandidate(
  payload: PortfolioOrganizationPayload,
  frontId: string,
  challengeId: string,
  disposition: ChallengeRemovalDisposition,
  targetChallengeId: string | undefined,
  workItemIds: string[],
): PortfolioOrganizationPayload {
  const front = payload.fronts.find((candidate) => candidate.candidateId === frontId);
  const challenge = front?.challenges.find((candidate) => candidate.candidateId === challengeId);
  if (!front || !challenge) return payload;
  if (front.challenges.length === 1) return optOutOrganization(payload, workItemIds);
  if (disposition === 'move' && targetChallengeId) return mergeChallengeInto(payload, frontId, challengeId, targetChallengeId);
  const withoutChallenge = updateFront(payload, frontId, { challenges: front.challenges.filter((candidate) => candidate.candidateId !== challengeId) });
  return { ...withoutChallenge, ungroupedInitiativeIds: unique([...withoutChallenge.ungroupedInitiativeIds, ...challenge.relatedInitiativeIds]) };
}

function moveChallengeInitiativesToUngrouped(payload: PortfolioOrganizationPayload, frontId: string, challengeId: string): PortfolioOrganizationPayload {
  const front = payload.fronts.find((candidate) => candidate.candidateId === frontId);
  const challenge = front?.challenges.find((candidate) => candidate.candidateId === challengeId);
  if (!front || !challenge) return payload;
  return {
    ...updateChallenge(payload, frontId, challengeId, { relatedInitiativeIds: [] }),
    ungroupedInitiativeIds: unique([...payload.ungroupedInitiativeIds, ...challenge.relatedInitiativeIds]),
  };
}

function optOutOrganization(payload: PortfolioOrganizationPayload, workItemIds: string[]): PortfolioOrganizationPayload {
  return {
    ...payload,
    summary: ORGANIZATION_OPT_OUT_SUMMARY,
    fronts: payload.fronts.map((front) => ({ ...front, challenges: front.challenges.map((challenge) => ({ ...challenge, relatedInitiativeIds: [] })) })),
    crossCuttingInitiativeIds: [],
    outsideObjectiveInitiativeIds: [],
    ungroupedInitiativeIds: unique(workItemIds),
  };
}

function isOrganizationOptedOut(payload: PortfolioOrganizationPayload, workItemIds: string[]): boolean {
  const ungrouped = new Set(payload.ungroupedInitiativeIds);
  return payload.summary === ORGANIZATION_OPT_OUT_SUMMARY
    && workItemIds.every((id) => ungrouped.has(id))
    && payload.crossCuttingInitiativeIds.length === 0
    && payload.outsideObjectiveInitiativeIds.length === 0
    && payload.fronts.every((front) => front.challenges.every((challenge) => challenge.relatedInitiativeIds.length === 0));
}

type InitiativeDestinationOption = { value: string; label: string };
type OrganizationInitiativeInsight = {
  alignment: string;
  maturity: string;
  owner?: string;
  source: string;
  comparison?: { label: string; rationale: string };
};

function InitiativePlacementList({
  ids, workById, movingInitiativeId, destinationOptions, placementFor, insightFor, onMoveStart, onMove, empty,
}: {
  ids: string[];
  workById: Map<string, BootstrapProjection['workItems'][number]>;
  movingInitiativeId: string | null;
  destinationOptions: InitiativeDestinationOption[];
  placementFor: (id: string) => string;
  insightFor: (id: string) => OrganizationInitiativeInsight;
  onMoveStart: (id: string | null) => void;
  onMove: (id: string, destination: string) => void;
  empty: string;
}) {
  if (ids.length === 0) return <p className="mt-2 text-sm text-slate-500">{empty}</p>;
  return <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">{ids.map((id) => {
    const label = workById.get(id)?.proposedName ?? workById.get(id)?.rawLabel ?? id;
    const insight = insightFor(id);
    const moving = movingInitiativeId === id;
    return <li key={id} className="py-3.5" data-testid={`organization-initiative-${id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{label}</p><span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">{insight.alignment}</span></div><button type="button" aria-expanded={moving} aria-label={`Mover ${label}`} onClick={() => onMoveStart(moving ? null : id)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-violet-800">Mover</button></div>
      <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600"><p>{insight.maturity === 'Etapa no determinada' ? <b className="text-slate-700">Etapa no determinada</b> : <><b className="text-slate-700">Etapa documental estimada:</b> {insight.maturity}</>}</p><p>Estimación basada en la información disponible. No significa que el Step esté aprobado.</p><p><b className="text-slate-700">Procedencia:</b> {insight.source}</p>{insight.owner ? <p><b className="text-slate-700">Responsable actual según fuente:</b> {insight.owner}</p> : null}</div>
      {insight.comparison ? <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs leading-5 text-sky-950"><p className="font-semibold">{insight.comparison.label}</p><p>{insight.comparison.rationale} Es una comparación sugerida; no implica una duplicidad confirmada.</p></div> : null}
      {moving ? <label className="mt-2 block text-xs font-semibold text-slate-700">Nuevo destino para {label}<select autoFocus aria-label={`Nuevo destino para ${label}`} value={placementFor(id)} onChange={(event) => onMove(id, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900">{destinationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
    </li>;
  })}</ul>;
}

function OrganizationBucket({
  title, description, ids, workById, movingInitiativeId, destinationOptions, placementFor, insightFor, onMoveStart, onMove, empty,
}: {
  title: string;
  description: string;
  ids: string[];
  workById: Map<string, BootstrapProjection['workItems'][number]>;
  movingInitiativeId: string | null;
  destinationOptions: InitiativeDestinationOption[];
  placementFor: (id: string) => string;
  insightFor: (id: string) => OrganizationInitiativeInsight;
  onMoveStart: (id: string | null) => void;
  onMove: (id: string, destination: string) => void;
  empty: string;
}) {
  return <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-slate-950">{title}</h4><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{initiativeCountLabel(ids.length)}</span></div><p className="mt-1 text-sm text-slate-600">{description}</p><InitiativePlacementList ids={ids} workById={workById} movingInitiativeId={movingInitiativeId} destinationOptions={destinationOptions} placementFor={placementFor} insightFor={insightFor} onMoveStart={onMoveStart} onMove={onMove} empty={empty} /></section>;
}

function organizationInitiativeInsight(
  id: string,
  projection: BootstrapProjection,
  placement: 'challenge' | 'cross-cutting' | 'ungrouped' | 'outside',
  overlaps: string[],
  relatedIds: string[],
): OrganizationInitiativeInsight {
  const item = projection.workItems.find((candidate) => candidate.id === id);
  const connection = projection.strategicConnections.find((candidate) => candidate.workItemId === id);
  const alignment = placement === 'outside'
    ? 'Fuera del objetivo actual'
    : placement === 'cross-cutting'
      ? 'Función habilitadora'
      : alignmentLabel(connection?.status);
  const workById = new Map(projection.workItems.map((candidate) => [candidate.id, candidate]));
  const comparison = specificChallengeComparisons({
    candidateId: 'comparison-only',
    title: '',
    problem: '',
    rationale: '',
    evidence: [],
    gaps: [],
    overlaps,
    relatedInitiativeIds: relatedIds,
  }, workById).find((candidate) => candidate.initiativeIds.includes(id));
  const otherNames = comparison?.initiativeIds
    .filter((initiativeId) => initiativeId !== id)
    .map((initiativeId) => workById.get(initiativeId)?.proposedName ?? workById.get(initiativeId)?.rawLabel ?? initiativeId);
  return {
    alignment,
    maturity: documentaryStageLabel(item),
    owner: item?.ownerCandidate?.trim() || undefined,
    source: organizationSourceLabel(item, projection.importBatches),
    comparison: comparison && otherNames?.length ? { label: `Comparar con ${otherNames.join(' y ')}`, rationale: comparison.rationale } : undefined,
  };
}

function alignmentLabel(status: BootstrapProjection['strategicConnections'][number]['status'] | undefined): string {
  if (status === 'confirmed_alignment') return 'Relación directa con el objetivo';
  if (status === 'partial_alignment') return 'Relación parcial con el objetivo';
  if (status === 'confirmed_misalignment' || status === 'out_of_current_priority') return 'Fuera del objetivo actual';
  return 'Relación por validar';
}

function documentaryStageLabel(item: BootstrapProjection['workItems'][number] | undefined): string {
  if (!item) return 'Etapa no determinada';
  const sourceText = [item.rawLabel, item.proposedName, item.proposedPurpose, JSON.stringify(item.sourceRefs ?? {})]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/validacion de resultados|resultados validados|medicion de resultados|impacto medido/.test(sourceText)) return 'Validación de resultados';
  if (/piloto|pilot|prueba|experimento/.test(sourceText)) return 'Prueba / piloto';
  if (/prototipo|prototype/.test(sourceText)) return 'Prototipo';
  if (/investigacion|research|discovery|descubrimiento|diagnostico/.test(sourceText)) return 'Investigación';
  if (/diseno|formulacion|conceptualizacion|definicion de solucion/.test(sourceText)) return 'Diseño / formulación';
  if (item.currentStateHint === 'idea' || item.currentStateHint === 'candidate') return 'Diseño / formulación';
  return 'Etapa no determinada';
}

function organizationSourceLabel(
  item: BootstrapProjection['workItems'][number] | undefined,
  importBatches: BootstrapProjection['importBatches'],
): string {
  if (!item) return 'Fuente por confirmar';
  if (item.sourceType === 'manual_entry') return 'Registro manual';
  if (item.sourceType === 'pasted_text') return 'Lista incorporada';
  if (item.sourceType === 'entry_context') return 'Contexto de entrada';
  if (item.sourceType === 'imported_file') {
    const refs = item.sourceRefs && typeof item.sourceRefs === 'object' && !Array.isArray(item.sourceRefs)
      ? item.sourceRefs as { importBatchId?: string }
      : null;
    return importBatches.find((batch) => batch.id === refs?.importBatchId)?.fileName ?? 'Archivo importado';
  }
  return 'Fuente conservada';
}

function initiativeCountLabel(count: number): string { return `${count} ${count === 1 ? 'iniciativa' : 'iniciativas'}`; }

function OrganizationValueExplainer({ onOptOut }: { onOptOut: () => void }) {
  return <section aria-labelledby="organization-value-heading" className="border-y border-slate-200 py-5" data-testid="portfolio-organization-value">
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-800">Antes de decidir</p>
      <h4 id="organization-value-heading" className="mt-1 text-base font-semibold text-slate-950">¿Qué aporta organizar estas iniciativas?</h4>
      <p className="mt-2 text-sm leading-6 text-slate-700">Agruparlas por áreas de enfoque y problemas comunes ayuda a comparar iniciativas que atacan el mismo problema, detectar posibles solapamientos, ver cobertura y gaps, priorizar dónde dedicar atención y capacidad, y preparar decisiones de Portfolio.</p>
    </div>
    <div className="mt-4 grid overflow-hidden rounded-xl border border-slate-200 md:grid-cols-2">
      <div className="bg-slate-50 p-4">
        <h5 className="font-semibold text-slate-900">Sin organizar</h5>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>Iniciativas aisladas</li>
          <li>Lectura más fragmentada</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-slate-600">Las iniciativas siguen disponibles individualmente y no se pierde información. Hay menos claridad agregada sobre cobertura, solapamientos y prioridades, pero puedes volver a organizarlas más adelante.</p>
      </div>
      <div className="border-t border-slate-200 bg-emerald-50/60 p-4 md:border-l md:border-t-0">
        <h5 className="flex items-center gap-2 font-semibold text-emerald-950"><CheckCircle2 aria-hidden="true" size={17} />Con organización</h5>
        <ul className="mt-2 space-y-1 text-sm text-emerald-950">
          <li>Iniciativas agrupadas por problema</li>
          <li>Cobertura y overlap visibles</li>
          <li>Decisiones más claras</li>
        </ul>
      </div>
    </div>
    <button type="button" onClick={onOptOut} className="mt-4 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4">Prefiero no organizar todavía</button>
  </section>;
}

function OrganizationConfirmationSummary({
  draft,
  reviewNeedsSaving,
  unavailableReason,
  optedOut,
}: {
  draft: PortfolioOrganizationPayload;
  reviewNeedsSaving: boolean;
  unavailableReason: string | null;
  optedOut: boolean;
}) {
  const challenges = draft.fronts.flatMap((front) => front.challenges);
  const aligned = unique([
    ...challenges.flatMap((challenge) => challenge.relatedInitiativeIds),
    ...draft.crossCuttingInitiativeIds,
  ]).length;
  const readyToConfirm = !reviewNeedsSaving && !unavailableReason;
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:p-5" aria-labelledby="organization-confirmation-summary" data-testid="organization-confirmation-summary">
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Cierre del paso</p>
    <h4 id="organization-confirmation-summary" className="mt-1 text-base font-semibold text-slate-950">{optedOut ? 'Organización pospuesta' : readyToConfirm ? 'Estructura estratégica lista para confirmar' : 'Lista para revisión final'}</h4>
    <p id="organization-confirmation-state" role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-amber-950">
      {unavailableReason ?? (reviewNeedsSaving
        ? 'Tienes cambios sin guardar. Puedes confirmar directamente: guardaremos esta revisión y confirmaremos exactamente esa versión.'
        : 'Revisión guardada. Ya puedes confirmar.')}
    </p>
    <p className="mt-2 text-sm font-semibold text-slate-800">{optedOut ? 'Objetivo → Iniciativas disponibles individualmente' : `Objetivo → Frente estratégico → ${challenges.length === 1 ? 'Reto' : 'Retos'} → Iniciativas`}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
      <OrganizationSummaryMetric value={optedOut ? 0 : draft.fronts.length} singular="frente" plural="frentes" />
      <OrganizationSummaryMetric value={optedOut ? 0 : challenges.length} singular="reto" plural="retos" />
      <OrganizationSummaryMetric value={aligned} singular="alineada" plural="alineadas" />
      <OrganizationSummaryMetric value={draft.outsideObjectiveInitiativeIds.length} singular="fuera del objetivo" plural="fuera del objetivo" />
      <OrganizationSummaryMetric value={draft.ungroupedInitiativeIds.length} singular="sin agrupar" plural="sin agrupar" />
    </div>
    <p className="mt-4 text-sm font-semibold leading-6 text-amber-950">{optedOut ? 'Guardar conserva esta decisión provisional para retomarla después.' : 'Confirmar refleja esta estructura en Portfolio.'}</p>
    <p className="text-sm leading-6 text-amber-950">{optedOut ? 'No se crea ningún Frente ni Reto canónico.' : 'No inicia iniciativas, no asigna equipos y no activa Steps.'}</p>
  </section>;
}

function OrganizationSummaryMetric({ value, singular, plural }: { value: number; singular: string; plural: string }) {
  return <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">{`${value} ${value === 1 ? singular : plural}`}</p>;
}

function unique(values: string[]): string[] { return [...new Set(values)]; }

function FrozenBriefStage({
  projection,
  confirmedOrganization,
  onBriefConfirmationChange,
  onContinueToAssignment,
}: {
  projection: BootstrapProjection;
  confirmedOrganization: PortfolioOrganizationProposal | null;
  onBriefConfirmationChange: (challengeId: string, confirmed: boolean) => void;
  onContinueToAssignment: (target: ChallengeAssignmentTarget) => void;
}) {
  const [selectedBrief, setSelectedBrief] = useState<{ challengeCandidateId: string; briefId: string | null } | null>(null);
  const [briefEditorDirty, setBriefEditorDirty] = useState<Record<string, boolean>>({});
  const [briefCollections, setBriefCollections] = useState<Record<string, { status: 'loading' | 'ready' | 'error'; briefs: ActivationBrief[] }>>({});
  const challengeEntries = useMemo(() => confirmedOrganization?.payload.fronts.flatMap((front) => front.challenges.map((challenge) => ({ front, challenge }))) ?? [], [confirmedOrganization]);

  const openBrief = (challengeCandidateId: string, briefId: string | null) => {
    const changesSelection = selectedBrief?.challengeCandidateId !== challengeCandidateId || selectedBrief.briefId !== briefId;
    if (changesSelection && selectedBrief && briefEditorDirty[selectedBrief.challengeCandidateId]) {
      const discard = window.confirm('Tienes cambios sin guardar. Si abres otro Brief, perderás esos cambios. ¿Quieres continuar?');
      if (!discard) return;
    }
    if (selectedBrief) setBriefEditorDirty((current) => ({ ...current, [selectedBrief.challengeCandidateId]: false }));
    setSelectedBrief({ challengeCandidateId, briefId });
  };

  const refreshChallengeBriefs = useCallback(async (challengeCandidateId: string, canonicalId: string) => {
    try {
      const briefs = await listActivationBriefs(canonicalId);
      setBriefCollections((current) => ({ ...current, [challengeCandidateId]: { status: 'ready', briefs } }));
      onBriefConfirmationChange(canonicalId, briefs.some((brief) => brief.versions.some((version) => version.status === 'CONFIRMED')));
    } catch {
      setBriefCollections((current) => ({ ...current, [challengeCandidateId]: { status: 'error', briefs: [] } }));
    }
  }, [onBriefConfirmationChange]);

  useEffect(() => {
    if (!confirmedOrganization?.materialization) return;
    let active = true;
    setSelectedBrief(null);
    setBriefEditorDirty({});
    setBriefCollections(Object.fromEntries(challengeEntries.map(({ challenge }) => [challenge.candidateId, { status: 'loading', briefs: [] }])));
    void Promise.all(challengeEntries.map(async ({ challenge }) => {
      const canonicalId = confirmedOrganization.materialization?.canonicalMappings.challenges.find((mapping) => mapping.candidateId === challenge.candidateId)?.canonicalId;
      if (!canonicalId) return { candidateId: challenge.candidateId, canonicalId: null, status: 'ready' as const, briefs: [] as ActivationBrief[] };
      try {
        const briefs = await listActivationBriefs(canonicalId);
        return { candidateId: challenge.candidateId, canonicalId, status: 'ready' as const, briefs };
      } catch {
        return { candidateId: challenge.candidateId, canonicalId, status: 'error' as const, briefs: [] as ActivationBrief[] };
      }
    })).then((results) => {
      if (!active) return;
      setBriefCollections(Object.fromEntries(results.map((result) => [result.candidateId, { status: result.status, briefs: result.briefs }])));
      results.forEach((result) => {
        if (result.canonicalId) onBriefConfirmationChange(result.canonicalId, result.briefs.some((brief) => brief.versions.some((version) => version.status === 'CONFIRMED')));
      });
    });
    return () => { active = false; };
  }, [challengeEntries, confirmedOrganization?.materialization?.id, onBriefConfirmationChange]);
  if (!confirmedOrganization?.materialization) return <><AssistantBubble>Los Briefs se preparan después de confirmar la estructura estratégica. Puedes volver a Organización sin perder la propuesta revisada.</AssistantBubble><FocusedQuestion eyebrow="PL-05 · Briefs" title="Confirma primero la estructura estratégica" help="No se crea ningún Brief, iniciativa o Step desde este límite." /></>;
  return <>
    <AssistantBubble>La organización confirmada ya está reflejada en Portfolio. Ya confirmamos el objetivo y el reto; ahora vamos a preparar el encargo que recibirá un equipo antes de invitarlo o asignarlo. <b>Startería recupera el contexto y propone; tú revisas, editas y decides qué versión confirmar.</b></AssistantBubble>
    <FocusedQuestion eyebrow="PL-05 · Briefs" title="Prepara el encargo antes de asignar personas" help="El Brief reúne qué se busca, qué sabemos, qué esperamos recibir y qué decisión permitirá tomar el trabajo. Guardar y confirmar son acciones distintas; ninguna asigna personas ni inicia trabajo." />
    <section className="rounded-xl border border-emerald-200 bg-white p-4 md:p-5" data-testid="pl05-brief-boundary">
      <div className="flex items-center gap-2"><FileText size={18} className="text-emerald-700" /><h3 className="font-semibold text-slate-950">Retos confirmados</h3></div>
      <p className="mt-2 text-sm text-slate-600">Elige un reto para preparar o recuperar su Brief sin salir del Copilot.</p>
      <ul className="mt-4 space-y-3">{challengeEntries.map(({ front, challenge }) => {
        const canonicalId = confirmedOrganization.materialization?.canonicalMappings.challenges.find((mapping) => mapping.candidateId === challenge.candidateId)?.canonicalId;
        const canPrepareBrief = Boolean(canonicalId);
        const conditionId = `brief-condition-${challenge.candidateId}`;
        const collection = briefCollections[challenge.candidateId] ?? { status: 'loading' as const, briefs: [] };
        const latestByBrief = collection.briefs.map((brief) => ({ brief, latest: brief.versions.at(-1) ?? null }));
        const confirmedCount = latestByBrief.filter(({ latest }) => latest?.status === 'CONFIRMED').length;
        const draftCount = latestByBrief.filter(({ latest }) => latest?.status === 'DRAFT').length;
        const relatedItems = challenge.relatedInitiativeIds.map((id) => projection.workItems.find((item) => item.id === id)).filter(Boolean) as BootstrapProjection['workItems'];
        const inherited: ChallengeBriefInheritedContext = {
          objective: projection.anchor.outcomeStatement,
          frontName: front.name,
          frontFocus: front.focus,
          challengeProblem: challenge.problem,
          businessSignal: projection.anchor.businessSignalValue,
          decisionToEnable: projection.anchor.decisionToEnable,
          relatedInitiatives: relatedItems.map((item) => item.proposedName ?? item.rawLabel),
          knownFacts: [`Reto confirmado dentro de ${front.name}.`, `${initiativeCountLabel(relatedItems.length)} quedaron relacionadas en la organización revisada.`],
          unknowns: challenge.gaps,
          constraints: [],
          sourceRefs: unique([...challenge.evidence, ...relatedItems.map((item) => organizationSourceLabel(item, projection.importBatches))]),
          horizon: null,
        };
        const selected = selectedBrief?.challengeCandidateId === challenge.candidateId ? selectedBrief : null;
        const reviewingUnsavedProposal = selected?.briefId === null;
        const summary = collection.status === 'loading'
          ? 'Recuperando Briefs...'
          : collection.status === 'error'
            ? 'No se pudo recuperar la colección de Briefs.'
            : collection.briefs.length === 0
              ? reviewingUnsavedProposal
                ? 'Estás revisando una propuesta sin guardar; aún no existe un Brief guardado.'
                : 'Todavía no preparaste un Brief para este reto.'
              : `${collection.briefs.length} ${collection.briefs.length === 1 ? 'Brief' : 'Briefs'} · ${confirmedCount} ${confirmedCount === 1 ? 'confirmado' : 'confirmados'} · ${draftCount} ${draftCount === 1 ? 'borrador' : 'borradores'}`;
        const prepareLabel = collection.status === 'ready' && collection.briefs.length === 0 ? 'Preparar primer Brief' : 'Preparar nuevo Brief';
        return (
          <li key={challenge.candidateId} data-canonical-id={canonicalId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Reto confirmado</p>
                <h3 className="mt-1 font-semibold text-slate-950">{challenge.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{initiativeCountLabel(challenge.relatedInitiativeIds.length)} relacionadas</p>
                <p className="mt-2 text-sm font-semibold text-slate-800" data-testid={`brief-summary-${challenge.candidateId}`}>{summary}</p>
              </div>
              <button type="button" disabled={!canPrepareBrief} aria-describedby={!canPrepareBrief ? conditionId : undefined} onClick={() => openBrief(challenge.candidateId, null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">{prepareLabel}</button>
            </div>
            {!canPrepareBrief ? <p id={conditionId} className="mt-3 text-sm text-amber-800">Falta la identidad canónica del reto. Vuelve a Organización y confirma la estructura antes de preparar el Brief.</p> : null}
            {latestByBrief.length > 0 ? (
              <ul className="mt-4 space-y-2" aria-label={`Briefs de ${challenge.title}`} data-testid={`brief-collection-${challenge.candidateId}`}>
                {latestByBrief.map(({ brief, latest }) => {
                  const identity = latest?.intent?.trim() || 'Brief sin título';
                  const isSelected = selected?.briefId === brief.id;
                  return (
                    <li key={brief.id} data-brief-id={brief.id} className={`rounded-lg border p-3 ${isSelected ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{identity}</p>
                          <p className="mt-1 text-xs text-slate-600">{latest ? `Versión ${latest.versionNumber} · ${latest.status === 'CONFIRMED' ? 'Confirmada' : 'Borrador'}` : 'Sin versiones'}</p>
                        </div>
                        <button type="button" aria-label={`Abrir Brief: ${identity}`} aria-pressed={isSelected} onClick={() => openBrief(challenge.candidateId, brief.id)} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">{isSelected ? 'Brief abierto' : 'Abrir Brief'}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {selected && canonicalId ? (
              <div className="mt-4">
                <ChallengeActivationBriefPanel
                  key={`${canonicalId}:${selected.briefId ?? 'new'}`}
                  challengeId={canonicalId}
                  challengeName={challenge.title}
                  briefId={selected.briefId}
                  inherited={inherited}
                  onDirtyChange={(dirty) => setBriefEditorDirty((current) => ({ ...current, [challenge.candidateId]: dirty }))}
                  onContinueToAssignment={onContinueToAssignment}
                  onVersionStateChange={({ briefId }) => {
                    if (briefId) setSelectedBrief({ challengeCandidateId: challenge.candidateId, briefId });
                    void refreshChallengeBriefs(challenge.candidateId, canonicalId);
                  }}
                />
              </div>
            ) : null}
          </li>
        );
      })}</ul>
      <p className="mt-4 text-xs leading-5 text-slate-500">{projection.workItems.length} registros de trabajo siguen disponibles como contexto. PL-05 no crea Assignment, Invitation, Initiative ni Step.</p>
    </section>
  </>;
}
function FrozenAssignmentStage({ target }: { target: ChallengeAssignmentTarget }) { return <ChallengeAssignmentPreparationPanel target={target} />; }
function AssistantBubble({ children }: { children: React.ReactNode }) { return <div className="flex items-start gap-3"><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800"><Sparkles size={15} /></span><div className="max-w-3xl rounded-2xl rounded-tl-sm border border-violet-100 bg-white px-4 py-3 text-sm leading-6 text-slate-800">{children}</div></div>; }
function UserBubble({ children }: { children: React.ReactNode }) { return <div className="ml-auto max-w-3xl rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm leading-6 text-white">{children}</div>; }
function FocusedQuestion({ eyebrow, title, help }: { eyebrow: string; title: string; help: string }) { return <section className="ml-0 rounded-xl border border-violet-200 bg-violet-50 p-4 md:ml-11"><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-800">{eyebrow}</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-700">{help}</p></section>; }
function FrozenProgress({ stage, onSelect, blockedAfterStage }: { stage: number; onSelect: (stage: number) => void; blockedAfterStage: number | null }) {
  const notes = ['Prompt de diagnóstico externo recibido', 'Conversación: resultado, contexto, señal, condiciones y decisión', 'Subir archivos, pegar iniciativas o continuar sin ellas', 'Comparar fuentes, detectar solapamientos y confirmar o posponer vínculos', 'Organizar retos cuando ayuden a orientar y coordinar', 'Preparar Brief de convocatoria o de iniciativa existente', 'Preparar encargos independientes; un responsable y hasta dos colaboradores por encargo'];
  return <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6" aria-label="Tu avance"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">Tu avance</h2><span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-800">{stage + 1} de 7</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-violet-600" style={{ width: `${((stage + 1) / 7) * 100}%` }} /></div><ol className="mt-5 space-y-3">{FROZEN_SETUP_STAGES.map((name, index) => { const blocked = blockedAfterStage !== null && index > blockedAfterStage; const blockedReason = index === 6 && blockedAfterStage === 5 ? 'Disponible al continuar desde una versión de Brief confirmada' : 'Bloqueado hasta resolver el punto crítico del análisis'; return <li key={name}><button type="button" disabled={blocked} onClick={() => onSelect(index)} className={`flex w-full gap-3 text-left ${blocked ? 'cursor-not-allowed text-slate-400' : index === stage ? 'text-slate-950' : 'text-slate-500'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${index < stage ? 'bg-emerald-100 text-emerald-700' : index === stage ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index < stage ? '✓' : index + 1}</span><span><b className="text-sm">{name}</b><small className="mt-0.5 block text-xs leading-4">{blocked ? blockedReason : index === stage ? notes[index] : index < stage ? 'Revisado o completado' : 'Todavía no necesario'}</small></span></button></li>; })}</ol><div className="mt-5 rounded-xl bg-violet-50 p-3 text-sm text-violet-950"><b>Lo importante ahora</b><p className="mt-1">{notes[stage]}</p></div><p className="mt-3 text-xs leading-5 text-slate-500">Los checks representan avance de configuración, no cumplimiento del objetivo de negocio.</p></aside>;
}
function frozenStageFrom(projection: BootstrapProjection): number { if (!projection.anchor.contextSummary?.trim()) return 0; if (projection.anchor.status !== 'anchor_confirmed') return 1; if (projection.existingWorkStatus === 'unknown') return 2; if (projection.existingWorkStatus === 'has_work' && (!projection.latestAnalysisRun || !projection.analysisSummary.materialReviewComplete)) return 3; return 4; }
function frozenStageTitle(stage: number): string { return ['Empecemos con el contexto', 'Conversemos para definir qué queremos lograr', '¿Qué está haciendo hoy tu organización?', 'Analizar evidencias y relaciones', 'Estructurar retos solo si ayudan', 'Convertir necesidades en encargos claros', 'Activar equipos y dar seguimiento'][stage] ?? 'Configurar con Copilot'; }

function PortfolioBootstrapHomeA({
  projection,
  onUpdateAnchor,
  onConfirmAnchor,
}: {
  projection: NonNullable<ReturnType<typeof projectBootstrapHome>>;
  onUpdateAnchor: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
  onConfirmAnchor: () => Promise<void>;
}) {
  const conflict = projection.anchor.status === 'anchor_conflicting';
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="portfolio-bootstrap-home-a">
      <BootstrapHeader
        eyebrow="Portfolio Bootstrap"
        title="Completemos el punto de partida del portfolio"
        status={projection.anchor.status}
        provenanceLabel={projection.provenanceLabel}
      />
      <AnchorSummary anchor={projection.anchor} />
      <ContextList title="Todavia falta aclarar" items={projection.missingContext} empty="No hay faltantes detectados." />
      <ContextRecoveryPanel anchor={projection.anchor} onSave={onUpdateAnchor} />
      <ObjectiveConversation anchor={projection.anchor} onSave={onUpdateAnchor} canConfirm={projection.canConfirm} onConfirm={onConfirmAnchor} />
      <PrimaryAction
        label={conflict ? 'Revisar contradiccion' : projection.canConfirm ? 'Confirmar punto de partida' : 'Ajustar Anchor'}
        description={projection.nextAction.reason}
        onClick={projection.canConfirm ? onConfirmAnchor : undefined}
        disabled={!projection.canConfirm && !conflict}
      />
    </section>
  );
}

function PortfolioBootstrapHomeB({
  projection,
  onUpdateAnchor,
  onConfirmAnchor,
  onOpenWorkIntake,
}: {
  projection: NonNullable<ReturnType<typeof projectBootstrapHome>>;
  onUpdateAnchor: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
  onConfirmAnchor: () => Promise<void>;
  onOpenWorkIntake: () => void;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm" data-testid="portfolio-bootstrap-home-b">
      <BootstrapHeader
        eyebrow="Ya tenemos un punto de partida"
        title={projection.anchor.outcomeStatement}
        status={projection.anchor.status}
        provenanceLabel={projection.provenanceLabel}
      />
      <AnchorSummary anchor={projection.anchor} />
      <ContextList title="Informacion conocida" items={projection.knownContext} empty="Aun no hay contexto adicional." />
      <ContextRecoveryPanel anchor={projection.anchor} onSave={onUpdateAnchor} />
      <ObjectiveConversation anchor={projection.anchor} onSave={onUpdateAnchor} canConfirm={projection.canConfirm} onConfirm={onConfirmAnchor} />
      {projection.anchor.status !== 'anchor_confirmed' ? (
        <button
          type="button"
          onClick={onConfirmAnchor}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
        >
          <CheckCircle2 size={16} />
          Confirmar punto de partida
        </button>
      ) : null}
      <PrimaryAction
        label="Incorporar trabajo existente"
        description="Conecta el trabajo que ya existe alrededor de esta prioridad."
        onClick={onOpenWorkIntake}
      />
    </section>
  );
}

function PortfolioBootstrapWorkIntake({
  projection,
  onPasteWorkItems,
  onUploadImportFile,
  onCommitImportBatch,
  onAddManualWorkItem,
  onDeclareNoExistingWork,
  onUpdateWorkItem,
  onRemoveWorkItem,
  onAnalyzeWorkItems,
  onConfirmProposedMutation,
  onReopenProposedMutationReview,
  onCorrectProposedMutation,
  onRejectProposedMutation,
  onLeaveProposedMutationPending,
  onPublishFirstReading,
  analysisStatus,
  analysisError,
  publishStatus,
  publishError,
  importStatus,
  importError,
  activeImport,
  onContinueToOrganization,
}: {
  projection: NonNullable<ReturnType<typeof projectBootstrapHome>>;
  onPasteWorkItems: (text: string) => Promise<void>;
  onUploadImportFile: (file: File) => Promise<void>;
  onCommitImportBatch: (batch: PortfolioBootstrapImportBatch, mapping: PortfolioBootstrapImportMapping) => Promise<void>;
  onAddManualWorkItem: (input: ManualPortfolioBootstrapWorkItemInput) => Promise<void>;
  onDeclareNoExistingWork: () => Promise<void>;
  onUpdateWorkItem: (workItemId: string, input: UpdatePortfolioBootstrapWorkItemInput) => Promise<void>;
  onRemoveWorkItem: (workItemId: string) => Promise<void>;
  onAnalyzeWorkItems: () => Promise<void>;
  onConfirmProposedMutation: (mutationId: string) => Promise<void>;
  onReopenProposedMutationReview: (mutationId: string, reviewNote?: string) => Promise<void>;
  onCorrectProposedMutation: (mutationId: string, proposedValue: unknown, reviewNote?: string) => Promise<void>;
  onRejectProposedMutation: (mutationId: string, reviewNote?: string) => Promise<void>;
  onLeaveProposedMutationPending: (mutationId: string, reviewNote?: string) => Promise<void>;
  onPublishFirstReading: () => Promise<void>;
  analysisStatus: 'idle' | 'processing' | 'error';
  analysisError: string | null;
  publishStatus: 'idle' | 'processing' | 'error';
  publishError: string | null;
  importStatus: 'idle' | 'uploading' | 'committing' | 'error';
  importError: string | null;
  activeImport: PortfolioBootstrapImportBatch | null;
  onContinueToOrganization: () => void;
}) {
  const [mode, setMode] = useState<'paste' | 'manual' | 'upload' | 'none'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [manual, setManual] = useState({ label: '', purpose: '', currentStateHint: 'unknown' });
  const [mappingDraft, setMappingDraft] = useState<PortfolioBootstrapImportMapping>({});
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [addMoreOpen, setAddMoreOpen] = useState(false);
  const hasItems = projection.workItems.length > 0;
  const noWork = projection.existingWorkStatus === 'no_existing_work';
  const hasProposals = projection.proposedMutations.some((mutation) => mutation.status === 'proposed' || mutation.status === 'reviewed');
  const analyzing = analysisStatus === 'processing';
  const publishing = publishStatus === 'processing';
  const analysisSurface = Boolean(projection.latestAnalysisRun && projection.proposedMutations.length > 0);

  // Finishing the analysis must land on its human-review surface.  It is not
  // merely a transition to the next setup stage.
  useEffect(() => {
    if (analysisSurface) setReviewOpen(true);
  }, [analysisSurface, projection.latestAnalysisRun?.id]);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="portfolio-bootstrap-work-intake">
      <BootstrapHeader
        eyebrow={analysisSurface ? 'Análisis revisable' : hasItems ? 'Incorporación revisable' : 'Portfolio Bootstrap'}
        title={analysisSurface ? `Lectura provisional de ${projection.workItems.length} iniciativas` : hasItems ? `${projection.workItems.length} iniciativas detectadas` : '¿Qué iniciativas existen hoy alrededor de este objetivo?'}
        status={projection.anchor.status}
        provenanceLabel={projection.provenanceLabel}
      />
      {analysisSurface ? <AnalysisInputReference projection={projection} onUpdateWorkItem={onUpdateWorkItem} onRemoveWorkItem={onRemoveWorkItem} /> : hasItems ? <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4" data-testid="portfolio-detected-initiatives-summary"><p className="text-sm font-semibold text-slate-950">Las iniciativas importadas son provisionales: puedes revisar sus datos fuente antes del análisis.</p><button type="button" onClick={() => setAddMoreOpen((open) => !open)} className="mt-3 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-950">{addMoreOpen ? 'Ocultar opciones para agregar' : 'Agregar más información'}</button></div> : <AnchorSummary anchor={projection.anchor} />}
      {(!analysisSurface && (!hasItems || addMoreOpen)) ? <>
      <div className="flex flex-wrap gap-2">
        <ModeButton label="Pegar una lista" active={mode === 'paste'} onClick={() => setMode('paste')} />
        <ModeButton label="Anadir manualmente" active={mode === 'manual'} onClick={() => setMode('manual')} />
        <ModeButton label="Subir PDF, Excel o CSV" active={mode === 'upload'} onClick={() => setMode('upload')} />
        <ModeButton label="Todavia no tenemos iniciativas" active={mode === 'none'} onClick={() => setMode('none')} />
      </div>

      {mode === 'paste' ? (
        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            await onPasteWorkItems(pasteText);
            setPasteText('');
            setSaving(false);
          }}
        >
          <label className="block text-sm font-semibold text-slate-700">
            Pega nombres de iniciativas, proyectos o trabajos que ya estan en marcha. Una linea por elemento funciona mejor.
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !pasteText.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus size={16} />
            {saving ? 'Agregando...' : 'Agregar trabajo'}
          </button>
        </form>
      ) : null}

      {mode === 'manual' ? (
        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            await onAddManualWorkItem({
              label: manual.label,
              purpose: manual.purpose || undefined,
              currentStateHint: manual.currentStateHint as ManualPortfolioBootstrapWorkItemInput['currentStateHint'],
            });
            setManual({ label: '', purpose: '', currentStateHint: 'unknown' });
            setSaving(false);
          }}
        >
          <input
            aria-label="Nombre o descripcion breve"
            value={manual.label}
            onChange={(event) => setManual({ ...manual, label: event.target.value })}
            placeholder="Nombre o descripcion breve"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <textarea
            aria-label="Que intenta conseguir"
            value={manual.purpose}
            onChange={(event) => setManual({ ...manual, purpose: event.target.value })}
            placeholder="Que intenta conseguir"
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <select
            aria-label="Estado aproximado"
            value={manual.currentStateHint}
            onChange={(event) => setManual({ ...manual, currentStateHint: event.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="unknown">No lo se</option>
            <option value="idea">Idea</option>
            <option value="candidate">Candidata</option>
            <option value="active">En marcha</option>
            <option value="paused">Pausada</option>
            <option value="completed">Terminada</option>
          </select>
          <button
            type="submit"
            disabled={saving || !manual.label.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus size={16} />
            {saving ? 'Agregando...' : 'Agregar trabajo'}
          </button>
        </form>
      ) : null}

      {mode === 'upload' ? (
        <ImportWorkItemsPanel
          activeImport={activeImport}
          importStatus={importStatus}
          importError={importError}
          mappingDraft={mappingDraft}
          onMappingChange={setMappingDraft}
          onUpload={async (file) => {
            setMappingDraft({});
            await onUploadImportFile(file);
          }}
          onCommit={async (batch, mapping) => {
            await onCommitImportBatch(batch, mapping);
            setMappingDraft({});
          }}
        />
      ) : null}

      {mode === 'none' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              await onDeclareNoExistingWork();
              setSaving(false);
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <CheckCircle2 size={16} />
            {saving ? 'Guardando...' : 'Todavia no tenemos iniciativas activas'}
          </button>
        </div>
      ) : null}
      </> : null}

      {!analysisSurface && noWork ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          Perfecto. Starteria puede conservar este punto de partida y ayudarte a decidir como abordar esta prioridad mas adelante.
        </div>
      ) : !analysisSurface ? (
        <WorkItemList items={projection.workItems} importBatches={projection.importBatches} onUpdateWorkItem={onUpdateWorkItem} onRemoveWorkItem={onRemoveWorkItem} />
      ) : null}

      {analyzing ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-950" aria-live="polite">
          Starteria esta organizando esta primera lectura.
        </div>
      ) : null}

      {analysisStatus === 'error' ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {analysisError ?? 'No pudimos analizar el trabajo detectado.'}
        </div>
      ) : null}

      {publishing ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-950" aria-live="polite">
          Starteria esta consolidando tu primera lectura del portafolio.
        </div>
      ) : null}

      {publishStatus === 'error' ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {publishError ?? 'No pudimos generar la primera lectura del portafolio.'}
        </div>
      ) : null}

      {projection.proposedMutations.length > 0 && !reviewOpen ? <ProposedStructureSummary projection={projection} /> : null}

      {reviewOpen ? (
        <MaterialReviewPanel
          projection={projection}
          onConfirm={onConfirmProposedMutation}
          onReopen={onReopenProposedMutationReview}
          onCorrect={onCorrectProposedMutation}
          onReject={onRejectProposedMutation}
          onLeavePending={onLeaveProposedMutationPending}
        />
      ) : null}

      {analysisSurface ? <AnalysisCompletionGate projection={projection} onContinue={onContinueToOrganization} /> : hasItems || noWork ? (
        <PrimaryAction
          label={hasProposals ? 'Revisar análisis y propuestas' : `Analizar ${projection.workItems.length} iniciativas`}
          description={hasProposals
            ? 'Pendiente de tu revision. La propuesta sigue siendo provisional.'
            : noWork
              ? 'No hay trabajo declarado para analizar en B3.'
              : 'Startería preparará una lectura revisable: alineamiento, evidencia, vacíos, posibles solapamientos y razones.'}
          disabled={noWork || analyzing}
          onClick={hasProposals ? () => setReviewOpen(true) : hasItems ? onAnalyzeWorkItems : undefined}
        />
      ) : null}
    </section>
  );
}

function ImportWorkItemsPanel({
  activeImport,
  importStatus,
  importError,
  mappingDraft,
  onMappingChange,
  onUpload,
  onCommit,
}: {
  activeImport: PortfolioBootstrapImportBatch | null;
  importStatus: 'idle' | 'uploading' | 'committing' | 'error';
  importError: string | null;
  mappingDraft: PortfolioBootstrapImportMapping;
  onMappingChange: (mapping: PortfolioBootstrapImportMapping) => void;
  onUpload: (file: File) => Promise<void>;
  onCommit: (batch: PortfolioBootstrapImportBatch, mapping: PortfolioBootstrapImportMapping) => Promise<void>;
}) {
  const batch = activeImport;
  const mapping = batch ? { ...batch.suggestedMapping, ...batch.confirmedMapping, ...mappingDraft } : mappingDraft;
  const busy = importStatus === 'uploading' || importStatus === 'committing';
  const [mappingReviewOpen, setMappingReviewOpen] = useState(false);
  const previewRows = batch?.previewRows.slice(0, 5) ?? [];
  const mappingFields: Array<{ key: keyof PortfolioBootstrapImportMapping; label: string; required?: boolean }> = [
    { key: 'label', label: 'Nombre', required: true },
    { key: 'owner', label: 'Responsable' },
    { key: 'state', label: 'Estado' },
    { key: 'purpose', label: 'Objetivo' },
    { key: 'signal', label: 'KPI / senal' },
    { key: 'notes', label: 'Notas' },
  ];
  const detectedMappings = mappingFields.filter((field) => Boolean(mapping[field.key]));
  const mappingIsSufficient = Boolean(mapping.label);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="portfolio-import-panel">
      <label className="block text-sm font-semibold text-slate-700">
        Sube un PDF, CSV o Excel con iniciativas, proyectos o trabajos existentes.
        <input
          aria-label="Subir PDF, Excel o CSV"
          type="file"
          accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = event.target.files?.[0];
            if (file) await onUpload(file);
            input.value = '';
          }}
          className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
      </label>

      {busy ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-950" aria-live="polite">
          {importStatus === 'uploading' ? 'Leyendo archivo...' : 'Importando elementos provisionales...'}
        </div>
      ) : null}

      {importStatus === 'error' ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {importError ?? 'No pudimos importar el archivo.'}
        </div>
      ) : null}

      {batch ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{batch.fileName}</p>
              <p className="text-slate-600">{batch.rowCount} filas detectadas{batch.sheetName ? ` en ${batch.sheetName}` : ''}.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              {batch.status === 'imported' ? 'Importado' : 'Preview provisional'}
            </span>
          </div>

          {batch.rawHeaders.length > 0 ? <section className="rounded-lg border border-violet-200 bg-violet-50/60 p-3" data-testid="portfolio-import-mapping-summary">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">Así interpretamos tu archivo</p><p className="mt-1 text-sm text-slate-600">Relacionamos las columnas del archivo con los datos provisionales de cada iniciativa. Los valores originales permanecen visibles en su trazabilidad.</p></div>{mappingIsSufficient ? <button type="button" onClick={() => setMappingReviewOpen((open) => !open)} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-950">{mappingReviewOpen ? 'Ocultar mapeo' : 'Revisar mapeo'}</button> : null}</div>
            <div className="mt-3 flex flex-wrap gap-2">{detectedMappings.map((field) => <span key={field.key} className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-950">{field.label} ← {mapping[field.key]}</span>)}</div>
            {!mappingIsSufficient ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-950">Necesitamos saber qué columna contiene el nombre de cada iniciativa para continuar.</p> : null}
          </section> : null}

          {batch.rawHeaders.length > 0 && (!mappingIsSufficient || mappingReviewOpen) ? <div className="grid gap-3 md:grid-cols-3" aria-label="Revisar mapeo de columnas">
            {mappingFields.map((field) => (
              <label key={field.key} className="text-xs font-semibold uppercase text-slate-500">
                {field.label}{field.required ? ' *' : ''}
                <select
                  value={mapping[field.key] ?? ''}
                  onChange={(event) => onMappingChange({ ...mappingDraft, [field.key]: event.target.value || null })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900"
                >
                  <option value="">Sin mapear</option>
                  {batch.rawHeaders.map((header) => (
                    <option key={`${field.key}-${header}`} value={header}>{header}</option>
                  ))}
                </select>
              </label>
            ))}
          </div> : null}

          {batch.rawHeaders.length > 0 ? <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Fila</th>
                  {batch.rawHeaders.map((header) => <th key={header} className="px-3 py-2 font-semibold">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {previewRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2 font-semibold">{row.rowNumber}</td>
                    {batch.rawHeaders.map((header) => <td key={`${row.rowNumber}-${header}`} className="px-3 py-2">{row.rawRow[header] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div> : null}

          {batch.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {batch.warnings.slice(0, 3).map((warning) => (
                <p key={`${warning.code}-${warning.rowNumber ?? warning.message}`}>{warning.rowNumber ? `Fila ${warning.rowNumber}: ` : ''}{warning.message}</p>
              ))}
            </div>
          ) : null}

          {batch.rawHeaders.length > 0 ? <button
            type="button"
            disabled={busy || !mapping.label || batch.status === 'imported'}
            onClick={() => onCommit(batch, mapping)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <FileUp size={16} />
            {batch.status === 'imported' ? 'Iniciativas incorporadas' : `Incorporar ${batch.rowCount} iniciativas`}
          </button> : null}
        </div>
      ) : null}
    </div>
  );
}

function PortfolioFirstReading({
  projection,
  onNavigate,
}: {
  projection: NonNullable<ReturnType<typeof projectBootstrapHome>>;
  onNavigate?: (path: string) => void;
}) {
  const reading = projection.latestReading;
  if (!reading) return null;
  const attentionItems = reading.primaryAttentionItems ?? [];
  const sourceSnapshot = reading.sourceSnapshot as {
    workItems?: Array<{ id: string }>;
    strategicConnections?: Array<{ id: string }>;
    advancementConditions?: Array<{ id: string }>;
    unresolvedProposals?: Array<{ id: string }>;
  } | null;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="portfolio-first-reading">
      <BootstrapHeader
        eyebrow={projection.homeState === 'HOME_E' ? 'Portfolio activo' : 'Portfolio inicial estructurado'}
        title="Primera lectura del portafolio"
        status={projection.anchor.status}
        provenanceLabel={`Lectura v${reading.version} publicada por Portfolio Lead`}
      />
      <AnchorSummary anchor={projection.anchor} />

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryField label="Trabajo identificado" value={`${reading.totalWorkItems} elementos`} />
        <SummaryField label="Conexiones confirmadas" value={String(reading.confirmedConnections)} />
        <SummaryField label="Con incertidumbre" value={String(reading.uncertainConnections)} />
        <SummaryField label="Atencion" value={String(attentionItems.filter((item) => item.severity !== 'info').length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReadingSection title="Que quieres mover" items={[projection.anchor.outcomeStatement, projection.anchor.contextSummary, projection.anchor.decisionToEnable].filter(Boolean) as string[]} />
        <ReadingSection title="Trabajo identificado" items={projection.workItems.map((item) => item.proposedName ?? item.rawLabel)} />
        <ReadingSection
          title="Como se conecta"
          items={[
            `${reading.confirmedConnections} relaciones confirmadas por revision humana.`,
            `${reading.uncertainConnections} relaciones o propuestas conservan incertidumbre visible.`,
            reading.confirmedMisalignmentCount > 0 ? `${reading.confirmedMisalignmentCount} relaciones cuestionadas.` : null,
          ].filter(Boolean) as string[]}
        />
        <ReadingSection
          title="Que falta"
          items={[
            reading.signalGapCount ? `${reading.signalGapCount} sin senal de negocio clara.` : null,
            reading.unresolvedDependencyCount ? `${reading.unresolvedDependencyCount} dependencias sin resolver.` : null,
            reading.decisionPathGapCount ? `${reading.decisionPathGapCount} rutas de decision poco claras.` : null,
            reading.requiredContextGapCount ? `${reading.requiredContextGapCount} contextos requeridos pendientes.` : null,
            reading.ownershipGapCount ? `${reading.ownershipGapCount} ownerships pendientes.` : null,
          ].filter(Boolean) as string[]}
          empty="No hay faltantes materiales publicados en esta lectura."
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-950">Requiere atencion</h2>
        </div>
        {attentionItems.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {attentionItems.map((item, index) => (
              <li key={`${item.type}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3" data-testid="portfolio-attention-item">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{item.statement}</p>
                    <p className="mt-2 text-xs text-slate-500">{item.whyItMatters}</p>
                  </div>
                  <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                    {item.severity}
                  </span>
                </div>
                {item.nextAction ? <p className="mt-2 text-xs font-semibold text-slate-600">{item.nextAction}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No hay atencion material publicada en esta lectura.</p>
        )}
      </div>

      <PrimaryAction
        label={reading.nextBestAction}
        description="Lectura versionada desde el Bootstrap revisado, sin crear objetos canonicos ni activar iniciativas."
      />

      {onNavigate ? (
        <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4" data-testid="portfolio-bootstrap-organization-handoff">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Siguiente momento: organización</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Revisa la estructura antes de activar trabajo</h2>
          <p className="mt-1 text-sm text-slate-700">
            La lectura conserva propuestas, cobertura y dudas. Crear o modificar Frentes y Retos sigue siendo una acción humana separada; no se crean objetos canónicos desde esta lectura.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate(`/portfolio/frentes-estrategicos?bootstrapSessionId=${encodeURIComponent(projection.bootstrapSessionId)}`)}
              className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
            >
              Organizar frentes y retos
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/portfolio/retos')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              Revisar retos existentes
            </button>
          </div>
        </section>
      ) : null}

      <details className="rounded-lg border border-slate-200 bg-white p-4" data-testid="portfolio-reading-provenance">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-950">
          <Eye size={16} />
          Ver trazabilidad de la lectura
        </summary>
        <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-2">
          <p>Anchor version: {reading.sourceAnchorVersion}</p>
          <p>Bootstrap hash: {reading.sourceBootstrapVersion.slice(0, 12)}</p>
          <p>Work items: {sourceSnapshot?.workItems?.length ?? 0}</p>
          <p>Conexiones: {sourceSnapshot?.strategicConnections?.length ?? 0}</p>
          <p>Condiciones: {sourceSnapshot?.advancementConditions?.length ?? 0}</p>
          <p>Pendientes: {sourceSnapshot?.unresolvedProposals?.length ?? 0}</p>
        </div>
      </details>
    </section>
  );
}

function ReadingSection({ title, items, empty = 'Pendiente' }: { title: string; items: string[]; empty?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      )}
    </div>
  );
}

function ProposedStructureSummary({ projection }: { projection: NonNullable<ReturnType<typeof projectBootstrapHome>> }) {
  const proposed = projection.proposedMutations.filter((mutation) => mutation.status === 'proposed');
  return (
    <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/70 p-4" data-testid="portfolio-bootstrap-proposed-structure">
      <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Pendiente de tu revision</p>
          <h2 className="text-base font-semibold text-slate-950">Primera lectura provisional</h2>
        </div>
        <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-900">
          {projection.latestAnalysisRun?.analyzerMode === 'real_ai' ? 'AI asistida' : 'Deterministica'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryField label="Propuestas" value={String(projection.analysisSummary.total)} />
        <SummaryField label="Conexiones" value={String(projection.analysisSummary.strategicConnections)} />
        <SummaryField label="Condiciones" value={String(projection.analysisSummary.advancementConditions)} />
        <SummaryField label="Atencion" value={String(projection.analysisSummary.attentionSignals + projection.analysisSummary.conflicts)} />
      </div>

      <ul className="space-y-2">
        {proposed.slice(0, 6).map((mutation) => (
          <li key={mutation.id} className="rounded-lg border border-indigo-100 bg-white p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">{proposalTitle(mutation)}</p>
                <p className="mt-1 text-sm text-slate-600">{proposalText(mutation)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
                  {mutation.provenanceStatus === 'ai_inferred' ? 'AI_INFERRED' : 'AI_SUGGESTED'}
                </span>
                <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
                  incertidumbre {mutation.uncertainty}
                </span>
              </div>
            </div>
            {mutation.rationale ? <p className="mt-2 text-xs text-slate-500">{mutation.rationale}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function WorkItemList({
  items,
  importBatches,
  onUpdateWorkItem,
  onRemoveWorkItem,
}: {
  items: NonNullable<ReturnType<typeof projectBootstrapHome>>['workItems'];
  importBatches: NonNullable<ReturnType<typeof projectBootstrapHome>>['importBatches'];
  onUpdateWorkItem: (workItemId: string, input: UpdatePortfolioBootstrapWorkItemInput) => Promise<void>;
  onRemoveWorkItem: (workItemId: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Aún no hay iniciativas provisionales agregadas.</p>;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">{items.length} iniciativas detectadas</h2>
      <p className="mt-1 text-sm text-slate-600">Cada fila conserva el archivo y los valores de origen. “Estado no declarado” no borra el valor original: indica que no pudo normalizarse.</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{item.proposedName ?? item.rawLabel}</p>
              {item.proposedPurpose ? <p className="mt-1 text-sm text-slate-600">{item.proposedPurpose}</p> : null}
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Provisional - {sourceTypeLabel(item.sourceType)} - {displayedItemState(item)}
              </p>
              {item.ownerCandidate ? <p className="mt-1 text-xs text-slate-600">Responsable: {item.ownerCandidate}</p> : <p className="mt-1 text-xs text-amber-800">Responsable: pendiente de identificar</p>}
              <ImportedItemTrace item={item} importBatches={importBatches} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const label = window.prompt('Nombre o descripcion breve', item.proposedName ?? item.rawLabel);
                  if (label?.trim()) void onUpdateWorkItem(item.id, { label });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => void onRemoveWorkItem(item.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Trash2 size={16} />
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalysisInputReference({
  projection,
  onUpdateWorkItem,
  onRemoveWorkItem,
}: {
  projection: NonNullable<ReturnType<typeof projectBootstrapHome>>;
  onUpdateWorkItem: (workItemId: string, input: UpdatePortfolioBootstrapWorkItemInput) => Promise<void>;
  onRemoveWorkItem: (workItemId: string) => Promise<void>;
}) {
  const latestFile = projection.importBatches[0]?.fileName;
  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="portfolio-analysis-input-reference"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fuente analizada</p><p className="mt-1 text-sm font-semibold text-slate-950">{latestFile ?? 'Iniciativas incorporadas durante la conversación'}</p><p className="mt-1 text-sm text-slate-600">{projection.workItems.length} iniciativas incorporadas. Sus fuentes y datos siguen disponibles sin competir con el análisis.</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-violet-800">Ver importación</summary><div className="mt-3"><WorkItemList items={projection.workItems} importBatches={projection.importBatches} onUpdateWorkItem={onUpdateWorkItem} onRemoveWorkItem={onRemoveWorkItem} /></div></details></section>;
}

function AnalysisCompletionGate({
  projection,
  onContinue,
}: {
  projection: NonNullable<ReturnType<typeof projectBootstrapHome>>;
  onContinue: () => void;
}) {
  const summary = projection.analysisSummary;
  const comparisonRequired = duplicateInitiativeCount(projection.workItems);
  const remaining = summary.reviewLater + summary.carryToBrief + summary.contextual;
  const hasHardBlocker = summary.hardBlockingNow > 0;
  const hardBlockers = projection.proposedMutations.filter((mutation) => (
    (mutation.status === 'proposed' || mutation.status === 'reviewed')
    && conditionSeverity(mutation) === 'blocking'
  ));
  const workItemsById = new Map(projection.workItems.map((item) => [item.id, item]));
  const reviewPending = () => document.getElementById('portfolio-analysis-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <section className={`rounded-xl border p-4 ${hasHardBlocker ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`} data-testid="portfolio-analysis-completion-gate"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Cierre de la lectura</p><h2 className="mt-1 text-base font-semibold text-slate-950">{hasHardBlocker ? 'Hay un bloqueo real antes de organizar' : 'Lectura suficiente para continuar'}</h2><div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2"><p><b>{summary.confirmed}</b> confirmadas</p><p><b>{summary.reviewLater + summary.carryToBrief + summary.contextual}</b> por revisar</p><p><b>{comparisonRequired}</b> comparación requerida</p><p><b>{summary.hardBlockingNow}</b> {summary.hardBlockingNow === 1 ? 'bloqueo real' : 'bloqueos reales'}</p></div>{hasHardBlocker ? <div className="mt-3 text-sm text-amber-950"><p>Estos puntos están marcados como <b>HARD_BLOCKING_NOW</b> y requieren una disposición antes de continuar:</p><ul className="mt-2 space-y-2">{hardBlockers.map((blocker) => { const item = blocker.targetId ? workItemsById.get(blocker.targetId) : null; return <li key={blocker.id} className="rounded-lg border border-amber-200 bg-white/70 p-3"><p className="font-semibold text-slate-950">{item ? `${item.proposedName ?? item.rawLabel} · ` : ''}{dimensionTitle(blocker)}</p><p className="mt-1">{proposalText(blocker)}</p><p className="mt-1 text-xs font-medium">Bloquea porque afecta la decisión de organización actual.</p>{blocker.rationale && blocker.rationale !== proposalText(blocker) ? <p className="mt-1 text-xs">Motivo registrado: {blocker.rationale}</p> : null}</li>; })}</ul></div> : <p className="mt-3 text-sm text-emerald-950">Quedan {remaining} aspectos pendientes. Puedes continuar; se conservarán con trazabilidad y volverán a aparecer cuando sean relevantes.</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={hasHardBlocker} onClick={onContinue} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">Continuar a organización</button><button type="button" onClick={reviewPending} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Revisar pendientes</button></div></section>;
}

function duplicateInitiativeCount(items: NonNullable<ReturnType<typeof projectBootstrapHome>>['workItems']): number {
  const frequencies = new Map<string, number>();
  for (const item of items) {
    const key = (item.proposedName ?? item.rawLabel).trim().toLocaleLowerCase();
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }
  return [...frequencies.values()].filter((count) => count > 1).reduce((total, count) => total + count, 0);
}

function ImportedItemTrace({ item, importBatches }: { item: NonNullable<ReturnType<typeof projectBootstrapHome>>['workItems'][number]; importBatches: NonNullable<ReturnType<typeof projectBootstrapHome>>['importBatches'] }) {
  if (item.sourceType !== 'imported_file' || !item.sourceRefs || typeof item.sourceRefs !== 'object' || Array.isArray(item.sourceRefs)) return null;
  const source = item.sourceRefs as { importBatchId?: string; rawRow?: Record<string, string>; sourceRefs?: { rawState?: string; signal?: string; notes?: string } };
  const batch = importBatches.find((candidate) => candidate.id === source.importBatchId);
  const mapping = batch ? { ...batch.suggestedMapping, ...batch.confirmedMapping } : {};
  const rawRow = source.rawRow ?? {};
  const mapped = [
    ['Nombre', mapping.label, item.proposedName ?? item.rawLabel],
    ['Responsable', mapping.owner, item.ownerCandidate],
    ['Estado', mapping.state, source.sourceRefs?.rawState ?? null],
    ['Objetivo', mapping.purpose, item.proposedPurpose],
    ['KPI / señal', mapping.signal, source.sourceRefs?.signal ?? null],
    ['Notas', mapping.notes, source.sourceRefs?.notes ?? null],
  ].filter(([, column, value]) => Boolean(column || value));
  return <details className="mt-2 text-xs text-slate-600" data-testid={`portfolio-import-trace-${item.id}`}><summary className="cursor-pointer font-semibold text-violet-800">Ver datos importados y trazabilidad</summary><div className="mt-2 grid gap-1 rounded-md border border-slate-200 bg-white p-2">{mapped.map(([label, column, value]) => <p key={String(label)}><b>{label}:</b> {column ? `columna “${column}” → ` : ''}{value || 'sin valor'}</p>)}{Object.entries(rawRow).filter(([header]) => !Object.values(mapping).includes(header)).map(([header, value]) => <p key={header}><b>{header}:</b> {value || 'sin valor'} <span className="text-slate-400">(conservado como dato fuente)</span></p>)}</div></details>;
}

function displayedItemState(item: NonNullable<ReturnType<typeof projectBootstrapHome>>['workItems'][number]): string {
  const source = item.sourceRefs;
  if (item.currentStateHint === 'unknown' && source && typeof source === 'object' && !Array.isArray(source)) {
    const sourceRefs = (source as { sourceRefs?: { rawState?: string } }).sourceRefs;
    if (sourceRefs?.rawState?.trim()) return `${sourceRefs.rawState} (estado importado; pendiente de normalizar)`;
  }
  return stateHintLabel(item.currentStateHint);
}

function MaterialReviewPanel({
  projection,
  onConfirm,
  onReopen,
  onCorrect,
  onReject,
  onLeavePending,
}: {
  projection: NonNullable<ReturnType<typeof projectBootstrapHome>>;
  onConfirm: (mutationId: string) => Promise<void>;
  onReopen: (mutationId: string, reviewNote?: string) => Promise<void>;
  onCorrect: (mutationId: string, proposedValue: unknown, reviewNote?: string) => Promise<void>;
  onReject: (mutationId: string, reviewNote?: string) => Promise<void>;
  onLeavePending: (mutationId: string, reviewNote?: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState('partial_alignment');
  const [correctionNote, setCorrectionNote] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<AnalysisCategory>('all');
  const groups = groupMutationsByWorkItem(projection);
  const workItemsById = new Map(projection.workItems.map((item) => [item.id, item]));
  const missingOwnerIds = new Set(projection.workItems.filter((item) => !item.ownerCandidate).map((item) => item.id));
  const duplicateLabels = new Set<string>();
  const namesSeen = new Set<string>();
  for (const item of projection.workItems) {
    const normalized = (item.proposedName ?? item.rawLabel).trim().toLocaleLowerCase();
    if (namesSeen.has(normalized)) duplicateLabels.add(normalized);
    namesSeen.add(normalized);
  }
  const outOfObjectiveIds = new Set(projection.proposedMutations.filter((mutation) => {
    const proposedValue = mutation.proposedValue as { status?: string } | null;
    return proposedValue?.status === 'confirmed_misalignment' || proposedValue?.status === 'out_of_current_priority';
  }).map((mutation) => mutation.targetId).filter((id): id is string => Boolean(id)));
  const evidenceIds = new Set(projection.proposedMutations.filter((mutation) => conditionType(mutation) === 'business_signal' || conditionType(mutation) === 'required_context').map((mutation) => mutation.targetId).filter((id): id is string => Boolean(id)));
  const relationIds = new Set(projection.proposedMutations.filter((mutation) => mutation.targetType === 'strategic_connection' && mutation.status !== 'confirmed').map((mutation) => mutation.targetId).filter((id): id is string => Boolean(id)));
  const blockingIds = new Set(projection.proposedMutations.filter((mutation) => conditionSeverity(mutation) === 'blocking').map((mutation) => mutation.targetId).filter((id): id is string => Boolean(id)));
  const overlapIds = new Set(projection.workItems.filter((item) => duplicateLabels.has((item.proposedName ?? item.rawLabel).trim().toLocaleLowerCase())).map((item) => item.id));
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const visibleGroups = groups.filter((group) => matchesAnalysisCategory(group.id, activeCategory, { evidenceIds, missingOwnerIds, relationIds, overlapIds, outOfObjectiveIds, blockingIds }));

  async function act(mutationId: string, action: () => Promise<void>) {
    setBusyId(mutationId);
    try {
      await action();
      setCorrectingId(null);
      setCorrectionNote('');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div id="portfolio-analysis-review" tabIndex={-1} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4" data-testid="portfolio-bootstrap-material-review">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Análisis revisable</p>
          <h2 className="text-base font-semibold text-slate-950">Startería encontró…</h2>
          <p className="mt-1 text-sm text-slate-600">
            Una primera lectura de tus iniciativas. La IA propone; tú confirmas, corriges o dejas cada vínculo pendiente.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
          {projection.analysisSummary.confirmed} confirmadas - {projection.analysisSummary.rejected} rechazadas - {projection.analysisSummary.pending} pendientes
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3" data-testid="portfolio-analysis-summary">
        <AnalysisSignal label="Iniciativas detectadas" value={String(projection.workItems.length)} detail="Importadas o escritas; cada una conserva fuente." />
        <AnalysisCategoryButton category="evidence" active={activeCategory} count={evidenceIds.size} label="Evidencia por validar" detail="No hay señal o contexto suficiente para sostener una conclusión." onClick={setActiveCategory} />
        <AnalysisCategoryButton category="owner" active={activeCategory} count={missingOwnerIds.size} label="Responsable pendiente" detail="La fuente no identifica una persona responsable." onClick={setActiveCategory} />
        <AnalysisCategoryButton category="relation" active={activeCategory} count={relationIds.size} label="Relación estratégica por revisar" detail="La IA propuso un vínculo; aún no es una decisión." onClick={setActiveCategory} />
        <AnalysisCategoryButton category="overlap" active={activeCategory} count={overlapIds.size} label="Posible solapamiento / comparación" detail="Nombres repetidos o similares: comparar antes de agrupar." onClick={setActiveCategory} />
        <AnalysisCategoryButton category="outside" active={activeCategory} count={outOfObjectiveIds.size} label="Fuera del objetivo" detail="Solo aparece cuando la lectura lo propone explícitamente." onClick={setActiveCategory} />
        <AnalysisCategoryButton category="blocker" active={activeCategory} count={blockingIds.size} label="Bloqueo real" detail="Solo dependencias marcadas como bloqueo del siguiente movimiento." onClick={setActiveCategory} />
      </div>
      <p className="text-sm text-slate-600">{activeCategory === 'all' ? 'Abre una iniciativa para revisar su lectura y decidir solo lo que afecta la decisión actual.' : `Mostrando iniciativas: ${analysisCategoryLabel(activeCategory)}.`} <button type="button" className="font-semibold text-violet-800 underline" onClick={() => setActiveCategory('all')}>Ver todas</button></p>
      <div className="space-y-3" data-testid="portfolio-analysis-initiative-cards">
        {visibleGroups.map((group) => <AnalysisCompactCard key={group.id} group={group} item={workItemsById.get(group.id)} onOpen={() => setSelectedGroupId(group.id)} />)}
      </div>
      {selectedGroup ? <AnalysisDetailDialog group={selectedGroup} item={workItemsById.get(selectedGroup.id)} importBatches={projection.importBatches} busyId={busyId} correctionStatus={correctionStatus} correctionNote={correctionNote} correctingId={correctingId} onClose={() => setSelectedGroupId(null)} onConfirm={(mutationId) => act(mutationId, () => onConfirm(mutationId))} onReopen={(mutationId) => act(mutationId, () => onReopen(mutationId))} onReject={(mutationId) => act(mutationId, () => onReject(mutationId))} onPending={(mutationId, note) => act(mutationId, () => onLeavePending(mutationId, note))} onBeginCorrection={(mutation) => { setCorrectingId(mutation.id); setCorrectionStatus(defaultCorrectionStatus(mutation)); }} onCorrectionStatus={setCorrectionStatus} onCorrectionNote={setCorrectionNote} onCorrect={(mutation) => { const currentValue = mutation.proposedValue as Record<string, unknown>; return act(mutation.id, () => onCorrect(mutation.id, { ...currentValue, status: correctionStatus, rationale: correctionNote || currentValue.rationale }, correctionNote || undefined)); }} /> : null}
    </div>
  );
}

function AnalysisSignal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-950">{value}</p><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p></div>;
}

type AnalysisCategory = 'all' | 'evidence' | 'owner' | 'relation' | 'overlap' | 'outside' | 'blocker';
type AnalysisCategoryTargets = {
  evidenceIds: Set<string>;
  missingOwnerIds: Set<string>;
  relationIds: Set<string>;
  overlapIds: Set<string>;
  outOfObjectiveIds: Set<string>;
  blockingIds: Set<string>;
};
type AnalysisGroup = ReturnType<typeof groupMutationsByWorkItem>[number];
type AnalysisItem = NonNullable<ReturnType<typeof projectBootstrapHome>>['workItems'][number];
type AnalysisMutation = NonNullable<ReturnType<typeof projectBootstrapHome>>['proposedMutations'][number];

function analysisCategoryLabel(category: AnalysisCategory): string {
  return ({
    all: 'todas las iniciativas',
    evidence: 'evidencia por validar',
    owner: 'responsable pendiente',
    relation: 'relación estratégica por revisar',
    overlap: 'posible solapamiento o comparación',
    outside: 'fuera del objetivo',
    blocker: 'bloqueo real',
  })[category];
}

function matchesAnalysisCategory(id: string, category: AnalysisCategory, targets: AnalysisCategoryTargets): boolean {
  if (category === 'all') return true;
  const targetByCategory: Record<Exclude<AnalysisCategory, 'all'>, Set<string>> = {
    evidence: targets.evidenceIds,
    owner: targets.missingOwnerIds,
    relation: targets.relationIds,
    overlap: targets.overlapIds,
    outside: targets.outOfObjectiveIds,
    blocker: targets.blockingIds,
  };
  return targetByCategory[category].has(id);
}

function AnalysisCategoryButton({
  category,
  active,
  count,
  label,
  detail,
  onClick,
}: {
  category: Exclude<AnalysisCategory, 'all'>;
  active: AnalysisCategory;
  count: number;
  label: string;
  detail: string;
  onClick: (category: AnalysisCategory) => void;
}) {
  return <button type="button" data-testid={`portfolio-analysis-category-${category}`} aria-pressed={active === category} onClick={() => onClick(category)} className={`rounded-lg border p-3 text-left transition ${active === category ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-slate-50 hover:border-violet-300'}`}><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-1 text-lg font-bold text-slate-950">{count}</p><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p><span className="mt-2 inline-block text-xs font-semibold text-violet-800">Ver iniciativas</span></button>;
}

function conditionType(mutation: AnalysisMutation): string | null {
  const value = mutation.proposedValue as { type?: string } | null;
  return value?.type ?? null;
}

function conditionSeverity(mutation: AnalysisMutation): string | null {
  const value = mutation.proposedValue as { severity?: string } | null;
  return value?.severity ?? null;
}

function dimensionTitle(mutation: AnalysisMutation): string {
  if (mutation.targetType === 'strategic_connection') return 'Relación estratégica';
  if (mutation.targetType === 'portfolio_anchor') return 'Objetivo y decisión a habilitar';
  const type = conditionType(mutation);
  const labels: Record<string, string> = {
    ownership_visibility: 'Responsable',
    business_signal: 'Evidencia o señal de negocio',
    required_context: 'Contexto por validar',
    critical_dependency: 'Dependencia',
    decision_path: 'Decisión a habilitar',
  };
  return labels[type ?? ''] ?? (mutation.targetType === 'work_item' ? 'Dato de la iniciativa' : 'Interpretación provisional');
}

function validationTiming(mutation: AnalysisMutation): { label: string; detail: string } {
  if (conditionSeverity(mutation) === 'blocking') return { label: 'HARD_BLOCKING_NOW', detail: 'Está marcada explícitamente como bloqueo de la decisión actual; requiere una disposición antes de organizar.' };
  if (['ownership_visibility', 'business_signal', 'required_context', 'critical_dependency'].includes(conditionType(mutation) ?? '')) return { label: 'CARRY_TO_BRIEF', detail: 'Conviene conservarlo para el responsable; no impide la lectura actual.' };
  if (mutation.targetType === 'strategic_connection') return { label: 'REVIEW_LATER / SOFT_GAP', detail: 'La relación puede seguir siendo provisional mientras organizas las iniciativas.' };
  return { label: 'CONTEXTUAL', detail: 'Aporta contexto, pero no cambia la decisión actual.' };
}

function AnalysisCompactCard({ group, item, onOpen }: { group: AnalysisGroup; item?: AnalysisItem; onOpen: () => void }) {
  const confirmed = group.mutations.some((mutation) => mutation.status === 'confirmed' && mutation.targetType === 'strategic_connection');
  const hasRelationToReview = group.mutations.some((mutation) => mutation.status !== 'confirmed' && mutation.targetType === 'strategic_connection');
  const mainWarning = group.mutations.find((mutation) => mutation.status !== 'confirmed');
  return <article data-testid={`portfolio-analysis-card-${group.id}`} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-sm font-semibold text-slate-950">{group.label}</h3><p className="mt-1 text-xs text-slate-600">{item ? `${sourceTypeLabel(item.sourceType)} · ${displayedItemState(item)}` : 'Lectura de portafolio'}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${confirmed ? 'bg-emerald-50 text-emerald-800' : hasRelationToReview ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{confirmed ? 'Vínculo confirmado' : hasRelationToReview ? 'Relación por revisar' : 'Lectura provisional'}</span></div><p className="mt-3 text-sm text-slate-700">{mainWarning ? `${dimensionTitle(mainWarning)}: ${proposalText(mainWarning)}` : 'No hay una interpretación pendiente para esta iniciativa.'}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{group.mutations.length} lectura{group.mutations.length === 1 ? '' : 's'} con trazabilidad</span><button type="button" onClick={onOpen} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50">Ver análisis</button></div></article>;
}

function AnalysisDetailDialog({
  group,
  item,
  importBatches,
  busyId,
  correctionStatus,
  correctionNote,
  correctingId,
  onClose,
  onConfirm,
  onReopen,
  onReject,
  onPending,
  onBeginCorrection,
  onCorrectionStatus,
  onCorrectionNote,
  onCorrect,
}: {
  group: AnalysisGroup;
  item?: AnalysisItem;
  importBatches: NonNullable<ReturnType<typeof projectBootstrapHome>>['importBatches'];
  busyId: string | null;
  correctionStatus: string;
  correctionNote: string;
  correctingId: string | null;
  onClose: () => void;
  onConfirm: (mutationId: string) => void;
  onReopen: (mutationId: string) => void;
  onReject: (mutationId: string) => void;
  onPending: (mutationId: string, note?: string) => void;
  onBeginCorrection: (mutation: AnalysisMutation) => void;
  onCorrectionStatus: (value: string) => void;
  onCorrectionNote: (value: string) => void;
  onCorrect: (mutation: AnalysisMutation) => void;
}) {
  const validations = group.mutations.filter((mutation) => mutation.status !== 'confirmed');
  return <div role="dialog" aria-modal="true" aria-label={`Análisis de ${group.label}`} className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-3 sm:items-center sm:justify-center"><section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-800">Lectura contextual</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{group.label}</h2></div><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Cerrar</button></div><div className="mt-5 space-y-4"><section className="rounded-lg border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Datos observados / extraídos</h3>{item ? <dl className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2"><div><dt className="font-semibold">Iniciativa</dt><dd>{item.proposedName ?? item.rawLabel}</dd></div><div><dt className="font-semibold">Responsable</dt><dd>{item.ownerCandidate || 'No identificado en la fuente'}</dd></div><div><dt className="font-semibold">Estado</dt><dd>{displayedItemState(item)}</dd></div><div><dt className="font-semibold">Objetivo declarado</dt><dd>{item.proposedPurpose || 'No declarado'}</dd></div></dl> : <p className="mt-2 text-sm text-slate-600">Esta lectura se refiere al objetivo del portafolio.</p>}</section><section className="rounded-lg border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Fuente y trazabilidad</h3>{item ? <AnalysisInitiativeSignals item={item} importBatches={importBatches} /> : <p className="mt-2 text-sm text-slate-600">Las propuestas conservan sus referencias de origen en cada lectura.</p>}</section><section className="rounded-lg border border-violet-100 bg-violet-50/50 p-4"><h3 className="font-semibold text-slate-950">Interpretación provisional — no decisión</h3><p className="mt-1 text-sm text-slate-700">Startería propone esta lectura; ninguna relación se vuelve canónica sin tu revisión.</p><ul className="mt-3 space-y-3">{group.mutations.map((mutation) => <li key={mutation.id} className="rounded-md border border-violet-100 bg-white p-3 text-sm text-slate-700"><p className="font-semibold text-slate-950">{dimensionTitle(mutation)}</p><p className="mt-1">{proposalText(mutation)}</p><p className="mt-2 text-xs text-slate-500">{mutation.rationale || 'Sin rationale adicional'} · {statusLabelForMutation(mutation.status)}</p></li>)}</ul></section><section className="rounded-lg border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Qué falta validar</h3>{validations.length ? <ul className="mt-2 space-y-2">{validations.map((mutation) => { const timing = validationTiming(mutation); return <li key={mutation.id} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700"><p className="font-semibold text-slate-950">{dimensionTitle(mutation)}</p><p className="mt-1">{proposalText(mutation)}</p><p className="mt-2 text-xs font-bold tracking-wide text-slate-600">{timing.label}</p><p className="mt-1 text-xs text-slate-600">{timing.detail}</p></li>; })}</ul> : <p className="mt-2 text-sm text-slate-600">No quedan validaciones abiertas en esta lectura. Puedes abrir una nueva revisión si cambia el contexto.</p>}</section><section className="rounded-lg border border-slate-200 p-4"><h3 className="font-semibold text-slate-950">Revisión/corrección del Portfolio Lead</h3><p className="mt-1 text-sm text-slate-600">Tus decisiones quedan registradas; revisar de nuevo nunca reescribe una confirmación anterior.</p><div className="mt-3 space-y-3">{group.mutations.map((mutation) => { const busy = busyId === mutation.id; const isConfirmed = mutation.status === 'confirmed'; const isRelation = mutation.targetType === 'strategic_connection'; return <div key={mutation.id} className="rounded-md border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-900">{dimensionTitle(mutation)}</p>{isConfirmed ? <div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{isRelation ? 'Vínculo confirmado' : 'Revisión confirmada'}</span><SmallActionButton label={isRelation ? 'Revisar vínculo' : 'Revisar conclusión'} action="reopen" disabled={busy} onClick={() => onReopen(mutation.id)} /></div> : <><div className="mt-2 flex flex-wrap gap-2"><SmallActionButton label="Dejar pendiente / sin vincular" action="pending" disabled={busy} onClick={() => onPending(mutation.id)} /><SmallActionButton label="Marcar para comparar" action="compare" disabled={busy} onClick={() => onPending(mutation.id, 'Marcada para comparación antes de confirmar un vínculo.')} /><SmallActionButton label={isRelation ? 'Confirmar vínculo revisado' : 'Confirmar revisión'} action="confirm" disabled={busy} onClick={() => onConfirm(mutation.id)} /><SmallActionButton label="Corregir" action="correct" disabled={busy} onClick={() => onBeginCorrection(mutation)} />{isRelation ? <SmallActionButton label="Retirar vínculo" action="reject" disabled={busy} onClick={() => onReject(mutation.id)} /> : null}</div>{correctingId === mutation.id ? <div className="mt-3 rounded-md bg-slate-50 p-3"><label className="block text-xs font-semibold text-slate-700">Lectura corregida<select value={correctionStatus} onChange={(event) => onCorrectionStatus(event.target.value)} className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm"><option value="partial_alignment">Alineamiento parcial</option><option value="confirmed_alignment">Alineamiento confirmado</option><option value="confirmed_misalignment">Fuera del objetivo</option><option value="out_of_current_priority">No es prioridad actual</option></select></label><label className="mt-2 block text-xs font-semibold text-slate-700">Corrección o rationale<textarea value={correctionNote} onChange={(event) => onCorrectionNote(event.target.value)} rows={2} className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm" /></label><div className="mt-2"><SmallActionButton label="Guardar corrección" action="save-correction" disabled={busy} onClick={() => onCorrect(mutation)} /></div></div> : null}</>}</div>; })}</div></section></div></section></div>;
}

function AnalysisInitiativeSignals({
  item,
  importBatches,
}: {
  item: NonNullable<ReturnType<typeof projectBootstrapHome>>['workItems'][number];
  importBatches: NonNullable<ReturnType<typeof projectBootstrapHome>>['importBatches'];
}) {
  return <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-xs text-slate-700" data-testid={`portfolio-analysis-initiative-${item.id}`}><p><b>Fuente y evidencia:</b> {sourceTypeLabel(item.sourceType)}{item.sourceRefs && typeof item.sourceRefs === 'object' ? ' · disponibles para revisar' : ' · sin detalle adicional'}</p><p className="mt-1"><b>Responsable:</b> {item.ownerCandidate || 'pendiente de identificar'}</p><p className="mt-1"><b>Estado:</b> {displayedItemState(item)}</p><ImportedItemTrace item={item} importBatches={importBatches} /></div>;
}

function SmallActionButton({
  label,
  action,
  disabled,
  onClick,
}: {
  label: string;
  action: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-review-action={action}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      {label}
    </button>
  );
}

function groupMutationsByWorkItem(projection: NonNullable<ReturnType<typeof projectBootstrapHome>>) {
  const workItemsById = new Map(projection.workItems.map((item) => [item.id, item]));
  const groups = new Map<string, {
    id: string;
    label: string;
    mutations: Array<NonNullable<ReturnType<typeof projectBootstrapHome>>['proposedMutations'][number] & { statusLabel?: string }>;
  }>();
  for (const mutation of projection.proposedMutations) {
    const key = mutation.targetId ?? 'portfolio';
    const item = mutation.targetId ? workItemsById.get(mutation.targetId) : null;
    const label = item ? item.proposedName ?? item.rawLabel : 'Portfolio Anchor';
    if (!groups.has(key)) groups.set(key, { id: key, label, mutations: [] });
    groups.get(key)?.mutations.push(mutation);
  }
  return [...groups.values()];
}

function defaultCorrectionStatus(mutation: NonNullable<ReturnType<typeof projectBootstrapHome>>['proposedMutations'][number]): string {
  const value = mutation.proposedValue as { status?: string } | null;
  return value?.status === 'probable_alignment' ? 'partial_alignment' : value?.status ?? 'partial_alignment';
}

function statusLabelForMutation(status: string): string {
  const labels: Record<string, string> = {
    proposed: 'Necesita tu confirmacion',
    reviewed: 'Revisada, pendiente de confirmacion si fue corregida',
    confirmed: 'Confirmada por Portfolio Lead',
    rejected: 'Rechazada',
    superseded: 'Reemplazada por analisis posterior',
    expired: 'Expirada',
  };
  return labels[status] ?? status;
}

function proposalTitle(
  mutation: NonNullable<ReturnType<typeof projectBootstrapHome>>['proposedMutations'][number],
): string {
  const labels: Record<string, string> = {
    strategic_connection: 'Conexion estrategica propuesta',
    advancement_condition: 'Condicion de avance propuesta',
    portfolio_anchor: 'Atencion sobre el Anchor',
    work_item: 'Ajuste provisional de trabajo',
  };
  return labels[mutation.targetType] ?? 'Propuesta provisional';
}

function proposalText(
  mutation: NonNullable<ReturnType<typeof projectBootstrapHome>>['proposedMutations'][number],
): string {
  const value = mutation.proposedValue as {
    status?: string;
    type?: string;
    statement?: string;
    severity?: string;
    conflict?: string;
  } | null;
  if (value?.statement) return value.statement;
  if (value?.conflict) return value.conflict;
  if (value?.status) return `Estado sugerido: ${value.status}`;
  if (value?.type) return `Tipo sugerido: ${value.type}`;
  return 'Propuesta pendiente de revision humana.';
}

function BootstrapHeader({
  eyebrow,
  title,
  status,
  provenanceLabel,
}: {
  eyebrow: string;
  title: string;
  status: PortfolioBootstrapAnchor['status'];
  provenanceLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          {statusLabel(status)}
        </span>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            <Eye size={14} />
            Procedencia
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg">
            {provenanceLabel}
          </div>
        </details>
      </div>
    </div>
  );
}

function AnchorSummary({ anchor }: { anchor: PortfolioBootstrapAnchor }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SummaryField label="Esto entendimos" value={anchor.outcomeStatement} />
      <SummaryField label="Contexto conocido" value={anchor.contextSummary} />
      <SummaryField label="Decision a habilitar" value={anchor.decisionToEnable} />
      <SummaryField label="Senal de negocio" value={anchor.businessSignalValue ?? signalLabel(anchor.businessSignalStatus)} />
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-900">{value || 'Pendiente'}</p>
    </div>
  );
}

function ContextList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      )}
    </div>
  );
}

function ContextRecoveryPanel({
  anchor,
  onSave,
}: {
  anchor: PortfolioBootstrapAnchor;
  onSave: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
}) {
  const [sourceText, setSourceText] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const saveSource = async () => {
    const text = sourceText.trim();
    if (!text) return;
    setSaving(true);
    setNotice(null);
    try {
      const prior = anchor.sourceRefs && typeof anchor.sourceRefs === 'object' && !Array.isArray(anchor.sourceRefs)
        ? anchor.sourceRefs as Record<string, unknown>
        : { priorSourceRefs: anchor.sourceRefs };
      await onSave({
        contextSummary: anchor.contextSummary?.trim() ? anchor.contextSummary : text,
        sourceRefs: {
          ...prior,
          externalContext: {
            kind: 'external_decision_brief_prompt',
            disposition: 'user_declared_source',
            text,
            recordedAt: new Date().toISOString(),
            reviewStatus: 'provisional',
          },
        },
      });
      setSourceText('');
      setNotice('El contexto se guardó como fuente declarada y sigue pendiente de revisión humana. No es un Decision Package ni una decisión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4" data-testid="portfolio-context-recovery">
      <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Contexto</p>
      <h2 className="mt-1 text-base font-semibold text-slate-950">Recupera un contexto existente</h2>
      <p className="mt-1 text-sm text-slate-700">
        Si llegas con un prompt o extracto de un Decision Brief externo, pégalo aquí. Se conserva como fuente declarada y se revisa antes de usarlo; Starteria no lo autoaprueba.
      </p>
      <label className="mt-3 block text-sm font-semibold text-slate-700">
        Prompt o extracto externo
        <textarea
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          rows={3}
          placeholder="Pega el contexto que quieres recuperar"
          className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={saving || !sourceText.trim()} onClick={() => void saveSource()} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-950 disabled:opacity-60">
          {saving ? 'Guardando fuente...' : 'Guardar fuente para revisión'}
        </button>
        <span className="text-xs text-slate-600">Procedencia: fuente declarada · estado: provisional</span>
      </div>
      {notice ? <p role="status" className="mt-3 rounded-lg border border-violet-100 bg-white p-3 text-sm text-violet-950">{notice}</p> : null}
    </section>
  );
}

type ObjectiveField = 'outcomeStatement' | 'contextSummary' | 'decisionToEnable' | 'businessSignalValue';

const objectiveQuestions: Record<ObjectiveField, { prompt: string; label: string; unknown: string }> = {
  outcomeStatement: {
    prompt: '¿Qué resultado de negocio quieres mover? Describe el cambio, no la solución.',
    label: 'Resultado esperado',
    unknown: 'Aún no conocemos el resultado de negocio.',
  },
  contextSummary: {
    prompt: '¿Qué contexto explica por qué este resultado importa ahora?',
    label: 'Contexto',
    unknown: 'El contexto material sigue siendo desconocido.',
  },
  decisionToEnable: {
    prompt: '¿Qué te gustaría poder decidir mejor cuando tengas más claridad sobre este objetivo?',
    label: 'Decisión a habilitar',
    unknown: 'Aún no sabemos qué decisión ayudaría a tomar este trabajo.',
  },
  businessSignalValue: {
    prompt: '¿Cómo sabrás que el resultado está mejorando? Si no lo sabes todavía, también está bien.',
    label: 'Señal de mejora',
    unknown: 'No hay KPI o señal confirmada todavía.',
  },
};

type ObjectiveConversationDisposition = 'user_declared' | 'ai_suggested' | 'unknown' | 'irrelevant' | 'clarification';
type ObjectiveConversationMeta = {
  unknownFields?: unknown;
  pendingClarification?: unknown;
  turns?: unknown;
  conditions?: unknown;
};

type ObjectiveQuestion = {
  key: ObjectiveField | 'businessSignalMeasure' | 'complete';
  field?: ObjectiveField;
  prompt: string;
  label: string;
  unknown: string;
  help?: string;
};

function objectiveConversationMeta(sourceRefs: unknown): ObjectiveConversationMeta {
  if (!sourceRefs || typeof sourceRefs !== 'object' || Array.isArray(sourceRefs)) return {};
  const objectiveConversation = (sourceRefs as Record<string, unknown>).objectiveConversation;
  return objectiveConversation && typeof objectiveConversation === 'object' && !Array.isArray(objectiveConversation)
    ? objectiveConversation as ObjectiveConversationMeta
    : {};
}

function unknownObjectiveFields(sourceRefs: unknown): ObjectiveField[] {
  const value = objectiveConversationMeta(sourceRefs).unknownFields;
  return Array.isArray(value) ? value.filter((field): field is ObjectiveField => field === 'outcomeStatement' || field === 'contextSummary' || field === 'decisionToEnable' || field === 'businessSignalValue') : [];
}

function nextObjectiveQuestion(anchor: PortfolioBootstrapAnchor): ObjectiveQuestion {
  const meta = objectiveConversationMeta(anchor.sourceRefs);
  if (meta.pendingClarification === 'businessSignalMeasure') {
    return {
      key: 'businessSignalMeasure',
      field: 'businessSignalValue',
      prompt: 'Entiendo que quieres observar la conversión de leads a clientes. ¿Te interesa seguir el número de conversiones o el porcentaje de leads que convierte?',
      label: 'Número o porcentaje de conversiones',
      unknown: 'Todavía no sabemos cómo se medirá la conversión.',
      help: 'Con una de las dos opciones basta por ahora.',
    };
  }

  const unknown = new Set(unknownObjectiveFields(anchor.sourceRefs));
  const field = (['outcomeStatement', 'contextSummary', 'decisionToEnable', 'businessSignalValue'] as ObjectiveField[]).find((candidate) => {
    if (unknown.has(candidate)) return false;
    if (candidate === 'outcomeStatement') return isPendingOutcome(anchor.outcomeStatement);
    return !anchor[candidate]?.trim();
  });
  if (!field) {
    return {
      key: 'complete',
      prompt: 'Ya tenemos un borrador revisable. Léelo y corrige cualquier matiz antes de confirmarlo.',
      label: 'Borrador completo',
      unknown: 'Has dejado explícitamente los vacíos relevantes para revisar más adelante.',
    };
  }
  return { key: field, field, ...objectiveQuestions[field] };
}

function objectiveAnswerLooksIrrelevant(value: string): boolean {
  return /\b(mi color|color favorito|pizza|fútbol|futbol|mi perro|mi gato)\b/i.test(value);
}

function isConversionWithoutMeasure(value: string): boolean {
  const normalized = value.toLowerCase();
  return /(lead|cliente|conversi[oó]n)/.test(normalized) && !/(porcentaje|%|tasa|n[uú]mero|cantidad|conteo)/.test(normalized);
}

function applyObjectivePatch(anchor: PortfolioBootstrapAnchor, input: UpdatePortfolioBootstrapAnchorInput): PortfolioBootstrapAnchor {
  return {
    ...anchor,
    ...input,
    outcomeStatement: input.outcomeStatement === undefined ? anchor.outcomeStatement : input.outcomeStatement,
    contextSummary: input.contextSummary === undefined ? anchor.contextSummary : input.contextSummary,
    decisionToEnable: input.decisionToEnable === undefined ? anchor.decisionToEnable : input.decisionToEnable,
    businessSignalValue: input.businessSignalValue === undefined ? anchor.businessSignalValue : input.businessSignalValue,
    businessSignalStatus: input.businessSignalStatus === undefined ? anchor.businessSignalStatus : input.businessSignalStatus,
    sourceRefs: input.sourceRefs === undefined ? anchor.sourceRefs : input.sourceRefs,
  };
}

function ObjectiveConversation({
  anchor,
  onSave,
  canConfirm,
  onConfirm,
}: {
  anchor: PortfolioBootstrapAnchor;
  onSave: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
  canConfirm: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ value: string; rationale: string } | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [answerOrigin, setAnswerOrigin] = useState<'user_declared' | 'ai_suggested'>('user_declared');
  const [draft, setDraft] = useState(anchor);
  const submittedAnswers = useRef(new Set<string>());
  useEffect(() => { setDraft(anchor); }, [anchor]);
  const question = nextObjectiveQuestion(draft);

  const saveAnswer = async (value: string, unknown = false, origin: 'user_declared' | 'ai_suggested' = 'user_declared') => {
    if (question.key === 'complete') return;
    const field = question.field!;
    const answerKey = `${question.key}:${value.trim().toLowerCase()}:${unknown ? 'unknown' : origin}`;
    if (submittedAnswers.current.has(answerKey)) {
      setNotice('Esta respuesta ya quedó registrada. Copilot continúa desde la siguiente incertidumbre.');
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      if (!unknown && question.key !== 'businessSignalMeasure' && objectiveAnswerLooksIrrelevant(value)) {
        const sourceRefs = objectiveConversationSourceRefs(draft.sourceRefs, field, value, 'irrelevant');
        submittedAnswers.current.add(answerKey);
        await onSave({ sourceRefs });
        setDraft((current) => applyObjectivePatch(current, { sourceRefs }));
        setNotice(`Lo que compartiste no parece describir ${question.label.toLowerCase()}. Cuéntame, con tus palabras, qué información de negocio te ayudaría a avanzar; si no la tienes, puedes indicar “No lo sé todavía”.`);
        return;
      }

      const needsMeasureClarification = !unknown && field === 'businessSignalValue' && question.key !== 'businessSignalMeasure' && isConversionWithoutMeasure(value);
      const signalValue = question.key === 'businessSignalMeasure' && draft.businessSignalValue
        ? `${draft.businessSignalValue} · medida: ${value}`
        : value;
      const sourceRefs = objectiveConversationSourceRefs(draft.sourceRefs, field, signalValue, unknown ? 'unknown' : origin, {
        pendingClarification: needsMeasureClarification ? 'businessSignalMeasure' : null,
      });
      const input: UpdatePortfolioBootstrapAnchorInput = { sourceRefs };
      if (field === 'outcomeStatement') {
        // The Anchor requires a textual primary outcome. An explicit unknown is
        // recorded in provenance while the initial placeholder remains visibly
        // insufficient; it is never promoted to a business claim.
        if (!unknown) input.outcomeStatement = value;
      } else if (field === 'contextSummary') {
        input.contextSummary = unknown ? null : value;
      } else if (field === 'decisionToEnable') {
        input.decisionToEnable = unknown ? null : value;
      } else {
        input.businessSignalStatus = unknown ? 'unknown' : 'suggested';
        input.businessSignalValue = unknown ? null : signalValue;
      }
      await onSave(input);
      submittedAnswers.current.add(answerKey);
      setDraft((current) => applyObjectivePatch(current, input));
      setAnswer('');
      setAnswerOrigin('user_declared');
      setSuggestion(null);
      setNotice(unknown
        ? `${question.unknown} Lo hemos dejado registrado y seguimos con lo que sí podemos aclarar.`
        : needsMeasureClarification
          ? 'He actualizado el borrador con esa señal. Para que sea útil, necesito precisar solo cómo la medirás.'
          : 'He actualizado el borrador con tu respuesta. Ahora seguimos con la siguiente pregunta que puede cambiar el trabajo.');
    } finally {
      setSaving(false);
    }
  };

  const requestSuggestion = async () => {
    const field = question.field;
    if (!field) return;
    const currentValue = answer.trim() || (field === 'outcomeStatement' ? '' : (draft[field] ?? ''));
    if (!currentValue.trim()) {
      setNotice('Escribe un borrador o comparte primero el contexto que quieres que Starteria ayude a redactar.');
      return;
    }
    setSuggestionStatus('loading');
    setNotice(null);
    try {
      const proposal = await suggestPortfolioObjective({
        currentValue,
        draftContext: {
          field,
          outcomeStatement: isPendingOutcome(draft.outcomeStatement) ? null : draft.outcomeStatement,
          contextSummary: draft.contextSummary,
          decisionToEnable: draft.decisionToEnable,
          businessSignalValue: draft.businessSignalValue,
        },
      });
      setSuggestion({ value: proposal.suggestedValue, rationale: proposal.rationale });
      setSuggestionStatus('idle');
    } catch (error) {
      setSuggestionStatus('error');
      setNotice(error instanceof Error ? error.message : 'No pudimos pedir una sugerencia ahora. Tu ficha no cambió.');
    }
  };

  return (
    <section className="grid gap-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]" data-testid="portfolio-objective-conversation">
      <div className="space-y-3" aria-label="Conversación de objetivo">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Copilot de Portfolio</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Construyamos el objetivo paso a paso</h2>
          <p className="mt-1 text-sm text-slate-700">Starteria recupera lo ya conocido, interpreta cada respuesta y pregunta solo por la siguiente incertidumbre material. No valida ni inventa datos.</p>
        </div>
        <div className="rounded-lg border border-sky-100 bg-white p-3 text-sm text-slate-800">
          <p className="font-semibold">Starteria</p>
          <p className="mt-1">{question.prompt}</p>{question.help ? <p className="mt-2 text-xs text-slate-600">{question.help}</p> : null}
        </div>
        {question.key !== 'complete' ? <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!answer.trim()) return;
            await saveAnswer(answer.trim(), false, answerOrigin);
          }}
        >
          <label className="block text-sm font-semibold text-slate-700">
            Tu respuesta
            <textarea
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                setAnswerOrigin('user_declared');
              }}
              rows={3}
              placeholder={question.label}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !answer.trim()} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Interpretando respuesta…' : 'Enviar respuesta'}
            </button>
            <button type="button" disabled={saving || suggestionStatus === 'loading'} onClick={() => void requestSuggestion()} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-950 disabled:opacity-60">
              {suggestionStatus === 'loading' ? 'Pidiendo sugerencia...' : 'Ayúdame a redactar'}
            </button>
            <button type="button" disabled={saving} onClick={() => void saveAnswer(question.unknown, true)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
              No lo sé todavía
            </button>
          </div>
        </form> : null}
        {suggestion ? (
          <div className="rounded-lg border border-sky-200 bg-white p-3 text-sm" data-testid="portfolio-objective-ai-suggestion">
            <p className="font-semibold text-sky-950">Sugerencia de Starteria</p>
            <p className="mt-1 text-slate-900">{suggestion.value}</p>
            <p className="mt-2 text-xs text-slate-600">Razón: {suggestion.rationale}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setAnswer(suggestion.value); setAnswerOrigin('ai_suggested'); }} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white">Usar sugerencia editable</button>
              <button type="button" onClick={() => setSuggestion(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Descartar</button>
            </div>
          </div>
        ) : null}
        {notice ? <p role="status" className="rounded-lg border border-sky-100 bg-white p-3 text-sm text-sky-950">{notice}</p> : null}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="portfolio-objective-card" aria-label="Borrador del objetivo">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lo que estamos construyendo</p>
        <h3 className="mt-1 text-base font-semibold text-slate-950">Borrador del objetivo</h3>
        <p className="mt-1 text-sm text-slate-600">Se actualiza al enviar cada respuesta y permanece revisable por la persona.</p>
        <dl className="mt-3 space-y-3 text-sm">
          <ObjectiveCardField label="Resultado" value={isPendingOutcome(draft.outcomeStatement) ? null : draft.outcomeStatement} />
          <ObjectiveCardField label="Contexto" value={draft.contextSummary} />
          <ObjectiveCardField label="KPI o señal" value={draft.businessSignalValue} />
          <ObjectiveCardField label="Condiciones" value={objectiveConversationMeta(draft.sourceRefs).conditions as string | undefined} />
          <ObjectiveCardField label="Decisión" value={draft.decisionToEnable} />
          <ObjectiveCardField label="Pendientes explícitos" value={unknownObjectiveFields(draft.sourceRefs).map((field) => objectiveQuestions[field].label).join(', ') || null} />
        </dl>
        <p className="mt-4 text-xs text-slate-600">Estado de revisión: {statusLabel(draft.status)}. Esta ficha no crea un frente, reto ni iniciativa.</p>
        {canConfirm ? <button type="button" onClick={() => void onConfirm()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 size={16} />Confirmar este punto de partida y continuar</button> : <p className="mt-4 text-sm text-slate-600">Podrás confirmarlo cuando el borrador tenga información suficiente o los vacíos estén declarados.</p>}
        <div className="mt-3"><AnchorEditor anchor={draft} onSave={onSave} /></div>
      </div>
    </section>
  );
}

function ObjectiveCardField({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="font-semibold text-slate-700">{label}</dt><dd className="mt-1 text-slate-900">{value?.trim() || 'Desconocido'}</dd></div>;
}

function isPendingOutcome(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  return !normalized || normalized === 'resultado de negocio por definir' || normalized === 'portfolio intent pending clarification';
}

function objectiveConversationSourceRefs(existing: unknown, field: ObjectiveField, value: string, disposition: ObjectiveConversationDisposition, options: { pendingClarification?: 'businessSignalMeasure' | null } = {}): unknown {
  const prior = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : { priorSourceRefs: existing };
  const previousConversation = objectiveConversationMeta(existing);
  const priorUnknown = unknownObjectiveFields(existing);
  const unknownFields = disposition === 'unknown'
    ? Array.from(new Set([...priorUnknown, field]))
    : priorUnknown.filter((candidate) => candidate !== field);
  const turn = { field, value, disposition, origin: 'PortfolioLead', recordedAt: new Date().toISOString() };
  const turns = Array.isArray(previousConversation.turns) ? previousConversation.turns.slice(-11) : [];
  return {
    ...prior,
    objectiveConversation: {
      ...previousConversation,
      field,
      value,
      disposition,
      origin: 'PortfolioLead',
      recordedAt: new Date().toISOString(),
      turns: [...turns, turn],
      unknownFields,
      pendingClarification: options.pendingClarification === undefined ? previousConversation.pendingClarification ?? null : options.pendingClarification,
    },
  };
}

function AnchorEditor({
  anchor,
  onSave,
}: {
  anchor: PortfolioBootstrapAnchor;
  onSave: (input: UpdatePortfolioBootstrapAnchorInput) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    outcomeStatement: anchor.outcomeStatement,
    contextSummary: anchor.contextSummary ?? '',
    decisionToEnable: anchor.decisionToEnable ?? '',
    businessSignalValue: anchor.businessSignalValue ?? '',
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        <Pencil size={16} />
        Editar Anchor
      </button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        await onSave({
          outcomeStatement: form.outcomeStatement,
          contextSummary: form.contextSummary || null,
          decisionToEnable: form.decisionToEnable || null,
          businessSignalValue: form.businessSignalValue || null,
        });
        setSaving(false);
        setEditing(false);
      }}
    >
      <EditorField label="Esto entendimos" value={form.outcomeStatement} onChange={(value) => setForm({ ...form, outcomeStatement: value })} />
      <EditorField label="Contexto conocido" value={form.contextSummary} onChange={(value) => setForm({ ...form, contextSummary: value })} />
      <EditorField label="Decision a habilitar" value={form.decisionToEnable} onChange={(value) => setForm({ ...form, decisionToEnable: value })} />
      <EditorField label="Senal de negocio" value={form.businessSignalValue} onChange={(value) => setForm({ ...form, businessSignalValue: value })} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar ajustes'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function EditorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
      />
    </label>
  );
}

function PrimaryAction({
  label,
  description,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-950">Siguiente accion</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <CheckCircle2 size={16} />
        {label}
      </button>
    </div>
  );
}

function sourceTypeLabel(sourceType: 'pasted_text' | 'manual_entry' | 'entry_context' | 'imported_file'): string {
  const labels = {
    pasted_text: 'pegado por usuario',
    manual_entry: 'agregado manualmente',
    entry_context: 'contexto de entrada',
    imported_file: 'importado desde archivo',
  };
  return labels[sourceType];
}

function stateHintLabel(stateHint: string | null): string {
  const labels: Record<string, string> = {
    idea: 'idea',
    candidate: 'candidata',
    active: 'en marcha',
    paused: 'pausada',
    completed: 'terminada',
    unknown: 'estado no declarado',
  };
  return labels[stateHint ?? 'unknown'] ?? 'estado no declarado';
}

function statusLabel(status: PortfolioBootstrapAnchor['status']): string {
  const labels: Record<PortfolioBootstrapAnchor['status'], string> = {
    anchor_insufficient: 'Pendiente',
    anchor_provisional: 'Provisional',
    anchor_sufficient: 'Suficiente, sin confirmar',
    anchor_confirmed: 'Confirmado',
    anchor_conflicting: 'Con conflicto',
  };
  return labels[status];
}

function signalLabel(status: PortfolioBootstrapAnchor['businessSignalStatus']): string {
  const labels: Record<PortfolioBootstrapAnchor['businessSignalStatus'], string> = {
    confirmed: 'Confirmada',
    proxy: 'Proxy disponible',
    suggested: 'Sugerida',
    unknown: 'Pendiente',
    conflicting: 'Con conflicto',
  };
  return labels[status];
}
