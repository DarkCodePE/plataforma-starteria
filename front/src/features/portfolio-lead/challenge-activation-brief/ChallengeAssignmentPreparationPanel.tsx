import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, FileText, LockKeyhole, Pencil } from 'lucide-react';
import { createIdempotencyKey } from '../../portfolio-entry/public/idempotency';
import type { ChallengeAssignmentTarget } from './ChallengeActivationBriefPanel';
import {
  createChallengeHandoffAssignment,
  getActivationBrief,
  linkImportedInitiative,
  listAssignableInitiatives,
  listChallengeHandoffAssignments,
  registerImportedInitiative,
  sendHandoffInvitationBatch,
  updateChallengeHandoffAssignment,
  type ActivationBriefVersion,
  type AssignableInitiatives,
  type HandoffAssignment,
  type HandoffAssignmentMember,
  type ImportedInitiativeRecord,
  type HandoffDeliveryBatch,
} from './challengeActivationBriefClient';

type Props = { target: ChallengeAssignmentTarget; onBack?: () => void; onExitToPortfolio?: () => void; onCompleteSetup?: () => Promise<void> };
type EditorPhase = 'edit' | 'review';
type TargetKind = 'EXISTING_INITIATIVE' | 'CHALLENGE';
type Editor = {
  assignmentId: string | null; expectedVersion: number | null; targetKind: TargetKind; initiativeId: string;
  attachBrief: boolean; owner: string; collaborators: [string, string]; contextNote: string; phase: EditorPhase;
};
type DocumentaryReview = { record: ImportedInitiativeRecord; decision: 'review' | 'register' | 'link'; projectId: string };

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100';
const emptyInitiatives: AssignableInitiatives = { canonicalInitiatives: [], importedRecords: [], otherImportedRecords: [] };

function newEditor(): Editor { return { assignmentId: null, expectedVersion: null, targetKind: 'CHALLENGE', initiativeId: '', attachBrief: true, owner: '', collaborators: ['', ''], contextNote: '', phase: 'edit' }; }
function isEmptyNewEditor(editor: Editor): boolean {
  return !editor.assignmentId && editor.phase === 'edit' && editor.targetKind === 'CHALLENGE' && !editor.initiativeId
    && !editor.owner && editor.collaborators.every((item) => !item) && !editor.contextNote;
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown, fallback: string): string { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function normalizedEmail(value: string): string { return value.trim().toLowerCase(); }
function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function blocksInitiativeAvailability(assignment: HandoffAssignment): boolean {
  if (assignment.state === 'REVOKED' || assignment.state === 'EXPIRED') return false;
  if (assignment.state === 'REJECTED') return !assignment.portfolioResponse?.trim();
  return true;
}
function displayRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(displayRefs).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string, unknown>;
  const preferred = ['label', 'name', 'title', 'source', 'sourceId', 'url', 'id']
    .map((key) => item[key])
    .find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof preferred === 'string' ? [preferred.trim()] : [];
}

export function ChallengeAssignmentPreparationPanel({ target, onBack, onExitToPortfolio, onCompleteSetup }: Props) {
  const [version, setVersion] = useState<ActivationBriefVersion | null>(null);
  const [assignments, setAssignments] = useState<HandoffAssignment[]>([]);
  const [initiatives, setInitiatives] = useState<AssignableInitiatives>(emptyInitiatives);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reviewTray, setReviewTray] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deliveryBatch, setDeliveryBatch] = useState<HandoffDeliveryBatch | null>(null);
  const [sending, setSending] = useState(false);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [exitPrompt, setExitPrompt] = useState(false);
  const [documentaryReview, setDocumentaryReview] = useState<DocumentaryReview | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const commandKey = useRef(createIdempotencyKey(`pl06a:prepare:${target.challengeId}:${target.briefVersionId}`));
  const incorporationKey = useRef(createIdempotencyKey(`adr009:canonicalize:${target.challengeId}`));
  const deliveryKey = useRef(createIdempotencyKey(`pl06b:send:${target.challengeId}`));
  const editorRegion = useRef<HTMLDivElement>(null);
  const trackingRegion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading'); setError(null);
    void Promise.all([getActivationBrief(target.briefId), listChallengeHandoffAssignments(target.challengeId), listAssignableInitiatives(target.challengeId)])
      .then(([brief, recovered, assignable]) => {
        if (!active) return;
        const exactVersion = brief.versions.find((item) => item.id === target.briefVersionId) ?? null;
        if (brief.id !== target.briefId || brief.challengeId !== target.challengeId || exactVersion?.status !== 'CONFIRMED') throw new Error('La identidad solicitada no coincide con el Brief confirmado de este reto. Vuelve al Brief y continúa desde su versión confirmada.');
        setVersion(exactVersion);
        setAssignments([...new Map(recovered.map((item) => [item.id, item])).values()]);
        setInitiatives({ ...assignable, otherImportedRecords: assignable.otherImportedRecords ?? [] });
        setStatus('ready');
      })
      .catch((value) => { if (active) { setError(value instanceof Error ? value.message : 'No pudimos recuperar los encargos.'); setStatus('error'); } });
    return () => { active = false; };
  }, [target.briefId, target.briefVersionId, target.challengeId]);

  useEffect(() => {
    if (!editor || isEmptyNewEditor(editor)) return;
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [editor]);

  const people = useMemo(() => editor ? [normalizedEmail(editor.owner), ...editor.collaborators.map(normalizedEmail)].filter(Boolean) : [], [editor]);
  const members = useMemo<HandoffAssignmentMember[]>(() => people.map((email, index) => ({ identityKey: email, emailNormalized: email, role: index === 0 ? 'OWNER' : 'EXECUTOR' })), [people]);
  const preparedAssignments = useMemo(() => assignments.filter((item) => item.state === 'CREATED'), [assignments]);
  const assignedInitiativeIds = useMemo(() => new Set(assignments
    .filter((item) => item.targetKind === 'EXISTING_INITIATIVE' && item.initiativeId && blocksInitiativeAvailability(item))
    .map((item) => item.initiativeId!)), [assignments]);
  const unassignedCanonicalCount = useMemo(() => initiatives.canonicalInitiatives
    .filter((initiative) => !assignedInitiativeIds.has(initiative.id)).length, [assignedInitiativeIds, initiatives.canonicalInitiatives]);
  const eligibleCanonicalInitiatives = useMemo(() => initiatives.canonicalInitiatives
    .filter((initiative) => !assignedInitiativeIds.has(initiative.id)), [assignedInitiativeIds, initiatives.canonicalInitiatives]);
  const initiativesForEditor = useMemo<AssignableInitiatives>(() => ({
    ...initiatives,
    canonicalInitiatives: editor?.assignmentId && editor.targetKind === 'EXISTING_INITIATIVE'
      ? initiatives.canonicalInitiatives.filter((initiative) => initiative.id === editor.initiativeId)
      : eligibleCanonicalInitiatives,
    importedRecords: [],
  }), [editor?.assignmentId, editor?.initiativeId, editor?.targetKind, eligibleCanonicalInitiatives, initiatives]);
  const editorHasChanges = Boolean(editor && !isEmptyNewEditor(editor));
  const inherited = record(version?.inheritedContext);

  const changeEditor = (change: Partial<Editor>) => { setEditor((current) => current ? { ...current, ...change, phase: 'edit' } : current); setError(null); commandKey.current = createIdempotencyKey(`pl06a:prepare:${target.challengeId}:${target.briefVersionId}`); };
  const selectInitiative = (initiativeId: string) => {
    const selected = initiatives.canonicalInitiatives.find((item) => item.id === initiativeId);
    setDocumentaryReview(null);
    changeEditor({ initiativeId, owner: selected?.ownerEmail ?? '', attachBrief: false });
  };
  const confirmDocumentaryInitiative = async () => {
    if (!editor || !documentaryReview || !documentaryReview.record.sourceVersion) return;
    setStatus('saving'); setError(null);
    try {
      const checkpoint = {
        expectedWorkItemUpdatedAt: documentaryReview.record.sourceVersion,
        identityConfirmed: true as const,
        alignmentConfirmed: true as const,
      };
      const result = documentaryReview.decision === 'register'
        ? await registerImportedInitiative(target.challengeId, documentaryReview.record.id, {
          ...checkpoint,
          name: documentaryReview.record.label,
          description: documentaryReview.record.purpose ?? null,
        }, incorporationKey.current)
        : await linkImportedInitiative(target.challengeId, documentaryReview.record.id, {
          ...checkpoint,
          projectId: documentaryReview.projectId,
        }, incorporationKey.current);
      setInitiatives((current) => ({
        ...current,
        canonicalInitiatives: [...new Map([...current.canonicalInitiatives, result.project].map((item) => [item.id, item])).values()],
        importedRecords: current.importedRecords.filter((item) => item.id !== documentaryReview.record.id),
      }));
      setEditor((current) => current ? {
        ...current,
        targetKind: 'EXISTING_INITIATIVE',
        initiativeId: result.project.id,
        owner: result.project.ownerEmail ?? '',
        contextNote: current.contextNote || documentaryReview.record.purpose || '',
        attachBrief: false,
        phase: 'edit',
      } : current);
      setDocumentaryReview(null);
      setStatus('ready');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'No pudimos incorporar la iniciativa documental.');
      setStatus('ready');
    }
  };
  const editorValidationError = () => {
    if (!editor) return 'No hay un encargo abierto.';
    if (editor.targetKind === 'EXISTING_INITIATIVE' && !editor.initiativeId) return 'Elige una iniciativa canónica vinculada a este reto.';
    if (!validEmail(people[0] ?? '')) return 'Indica un email válido para la persona responsable.';
    if (people.some((email) => !validEmail(email))) return 'Revisa los emails de colaboradores antes de continuar.';
    if (new Set(people).size !== people.length) return 'Cada persona debe aparecer una sola vez en el equipo.';
    return null;
  };
  const review = () => {
    if (!editor) return;
    const validationError = editorValidationError();
    if (validationError) return setError(validationError);
    setError(null); setEditor({ ...editor, phase: 'review' });
  };
  const leavePortfolio = () => {
    if (onExitToPortfolio) onExitToPortfolio();
    else window.location.assign('/portfolio/inicio');
  };
  const save = async (exitAfterSave = false) => {
    if (!editor) return false;
    const validationError = editorValidationError();
    if (validationError) { setError(validationError); setExitPrompt(false); return false; }
    setStatus('saving'); setError(null);
    try {
      const result = editor.assignmentId
        ? await updateChallengeHandoffAssignment(editor.assignmentId, { expectedVersion: editor.expectedVersion!, contextNote: editor.contextNote || null, invitedEmailNormalized: people[0], members }, commandKey.current)
        : await createChallengeHandoffAssignment(target.challengeId, {
          targetKind: editor.targetKind,
          initiativeId: editor.targetKind === 'EXISTING_INITIATIVE' ? editor.initiativeId : null,
          briefId: editor.targetKind === 'CHALLENGE' || editor.attachBrief ? target.briefId : null,
          briefVersionId: editor.targetKind === 'CHALLENGE' || editor.attachBrief ? target.briefVersionId : null,
          contextNote: editor.contextNote,
          invitedEmailNormalized: people[0], members,
        }, commandKey.current);
      setAssignments((current) => editor.assignmentId
        ? current.map((item) => item.id === result.assignment.id ? result.assignment : item)
        : [...current.filter((item) => item.id !== result.assignment.id), result.assignment]);
      setEditor(null); setEditorNotice(null); setExitPrompt(false); setReviewTray(false); setStatus('ready');
      if (exitAfterSave) leavePortfolio();
      return true;
    } catch (value) { setError(value instanceof Error ? value.message : 'No pudimos guardar la asignación.'); setStatus('ready'); setExitPrompt(false); return false; }
  };
  const edit = (assignment: HandoffAssignment) => {
    const owner = assignment.members.find((member) => member.role === 'OWNER');
    const collaborators = assignment.members.filter((member) => member.role === 'EXECUTOR');
    setEditor({ assignmentId: assignment.id, expectedVersion: assignment.version, targetKind: assignment.targetKind, initiativeId: assignment.initiativeId ?? '', attachBrief: Boolean(assignment.briefVersionId), owner: owner?.emailNormalized ?? assignment.invitedEmailNormalized, collaborators: [collaborators[0]?.emailNormalized ?? '', collaborators[1]?.emailNormalized ?? ''], contextNote: assignment.contextNote ?? '', phase: 'edit' });
    setError(null); setEditorNotice(null); setReviewTray(false); commandKey.current = createIdempotencyKey(`pl06a:update:${assignment.id}:${assignment.version}`);
  };
  const focusEditor = () => window.setTimeout(() => {
    editorRegion.current?.focus();
    editorRegion.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, 0);
  const requestEdit = (assignment: HandoffAssignment) => {
    if (editor) {
      setEditorNotice('Termina o cancela el encargo abierto antes de editar otro. Tu borrador actual sigue intacto.');
      focusEditor();
      return;
    }
    edit(assignment);
    focusEditor();
  };
  const requestExit = () => {
    if (editorHasChanges) { setExitPrompt(true); focusEditor(); }
    else leavePortfolio();
  };
  const viewTracking = () => {
    trackingRegion.current?.focus();
    trackingRegion.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const toggleSelected = (assignmentId: string) => setSelectedIds((current) => current.includes(assignmentId) ? current.filter((id) => id !== assignmentId) : [...current, assignmentId]);
  const sendSelected = async (retryOfBatchId?: string) => {
    const selected = assignments.filter((assignment) => selectedIds.includes(assignment.id));
    if (!selected.length) return;
    setSending(true); setError(null);
    try {
      const batch = retryOfBatchId
        ? await sendHandoffInvitationBatch(target.challengeId, selected.map((assignment) => ({ assignmentId: assignment.id, expectedVersion: assignment.version })), deliveryKey.current, retryOfBatchId)
        : await sendHandoffInvitationBatch(target.challengeId, selected.map((assignment) => ({ assignmentId: assignment.id, expectedVersion: assignment.version })), deliveryKey.current);
      setDeliveryBatch(batch);
      setAssignments((current) => current.map((assignment) => {
        const result = batch.results.find((item) => item.assignmentId === assignment.id);
        return result && result.status !== 'FAILED' ? { ...assignment, state: result.state || 'SENT', version: assignment.version + (result.state === 'SENT' ? 1 : 0) } : assignment;
      }));
      setSelectedIds(batch.results.filter((item) => item.status === 'FAILED').map((item) => item.assignmentId));
      setReviewTray(false);
    } catch (value) { setError(value instanceof Error ? value.message : 'No pudimos enviar las invitaciones.'); }
    finally { setSending(false); }
  };

  if (status === 'loading') return <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite"><p className="font-semibold text-slate-900">Recuperando los encargos preparados…</p></section>;
  if (status === 'error' || !version) return <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900"><div className="flex gap-2"><AlertCircle className="mt-0.5 shrink-0" size={18} /><p>{error}</p></div>{onBack ? <button type="button" onClick={onBack} className="mt-4 inline-flex items-center gap-2 font-semibold"><ArrowLeft size={16} />Volver al Brief</button> : null}</section>;

  return <section className="space-y-5" data-testid="pl06a-assignment-preparation" data-brief-version-id={version.id}>
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-labelledby="pl06a-title">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Asignaciones</p>
      <h2 id="pl06a-title" className="mt-1 text-2xl font-semibold text-slate-950">Asigna responsables para abordar este reto</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Puedes asignar a alguien el reto para que proponga su propia iniciativa, o asignarle una iniciativa existente. No necesitas asignarlas todas ahora.</p>

      {!editor ? <button type="button" onClick={() => { setEditor(newEditor()); setEditorNotice(null); setError(null); window.setTimeout(focusEditor, 0); }} className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">+ Asignar responsable</button> : null}

      {editor ? <div ref={editorRegion} tabIndex={-1} className="scroll-mt-4 outline-none">{editorNotice ? <p role="alert" className="mt-4 text-sm font-medium leading-6 text-amber-900"><b>Hay otro encargo abierto.</b> {editorNotice}</p> : null}<AssignmentEditor editor={editor} initiatives={initiativesForEditor} people={people} target={target} error={error} saving={status === 'saving'} documentaryReview={documentaryReview} onChange={changeEditor} onSelectInitiative={selectInitiative} onReviewDocumentary={(record) => { setDocumentaryReview({ record, decision: 'review', projectId: '' }); incorporationKey.current = createIdempotencyKey(`adr009:canonicalize:${target.challengeId}:${record.id}`); setError(null); }} onChangeDocumentary={setDocumentaryReview} onConfirmDocumentary={confirmDocumentaryInitiative} onReview={review} onSave={() => void save()} onCancel={() => { setEditor(null); setEditorNotice(null); setExitPrompt(false); setDocumentaryReview(null); setError(null); }} /></div> : null}

      <p className="mt-4 text-sm text-slate-600" role="status" aria-live="polite">Quedan {unassignedCanonicalCount} iniciativas disponibles para asignar. Puedes dejarlas para después</p>
      {preparedAssignments.length ? <div className="mt-4"><button type="button" disabled={!selectedIds.length} onClick={() => setReviewTray(true)} className="rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-950 disabled:cursor-not-allowed disabled:opacity-50">Revisar y enviar seleccionados ({selectedIds.length})</button></div> : null}

      {assignments.length ? !reviewTray && <div ref={trackingRegion} tabIndex={-1} className="scroll-mt-4 outline-none"><PreparedTray assignments={assignments} selectedIds={selectedIds} onToggle={toggleSelected} onEdit={requestEdit} /><AssignmentStateGuide /></div> : <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">Aún no hay encargos preparados. Puedes añadir uno ahora o volver más tarde, sin enviar nada.</p>}
      {reviewTray ? <><TrayReview assignments={assignments.filter((assignment) => selectedIds.includes(assignment.id))} target={target} version={version} sending={sending} onConfirm={() => void sendSelected()} onClose={() => setReviewTray(false)} /><div className="sr-only" aria-label="Colaboradores seleccionados">{assignments.filter((assignment) => selectedIds.includes(assignment.id)).flatMap((assignment) => assignment.members.filter((member) => member.role === 'EXECUTOR')).map((member) => <span key={member.identityKey}>{member.emailNormalized ?? member.label ?? member.identityKey}</span>)}</div></> : null}
      {deliveryBatch ? <DeliveryResult batch={deliveryBatch} assignments={assignments} onExit={requestExit} onCompleteSetup={onCompleteSetup} onViewTracking={viewTracking} onRetry={deliveryBatch.failedCount || deliveryBatch.results.some((item) => item.status === 'FAILED') ? () => { deliveryKey.current = createIdempotencyKey(`pl06b:retry:${deliveryBatch.id}`); void sendSelected(deliveryBatch.id); } : undefined} /> : null}
      {error && !editor ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p> : null}
      <BriefSummary target={target} version={version} inherited={inherited} />
      {!deliveryBatch ? <FlowCompletion onExit={requestExit} onViewTracking={assignments.length ? viewTracking : undefined} /> : null}
      {exitPrompt && editor ? <ExitPrompt editor={editor} saving={status === 'saving'} onSaveAndExit={() => void save(true)} onDiscardAndExit={() => { setEditor(null); setEditorNotice(null); setExitPrompt(false); leavePortfolio(); }} onContinue={() => setExitPrompt(false)} /> : null}
    </article>
  </section>;
}

function DocumentaryInitiativesSummary({ initiatives }: { initiatives: AssignableInitiatives }) {
  const relatedCount = initiatives.importedRecords.length;
  const otherCount = initiatives.otherImportedRecords.length;
  if (!relatedCount && !otherCount) return null;
  return <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
    <summary className="cursor-pointer font-semibold text-slate-900">Información sobre iniciativas documentales</summary>
    <div className="mt-3 space-y-2 leading-6">
      {relatedCount ? <p>{relatedCount} {relatedCount === 1 ? 'iniciativa relacionada identificada' : 'iniciativas relacionadas identificadas'} en documentos, por incorporar.</p> : null}
      {otherCount ? <p>{otherCount} {otherCount === 1 ? 'registro adicional está clasificado' : 'registros adicionales están clasificados'} como transversales, fuera del objetivo o sin agrupar; no se cuentan como relacionados ni asignables.</p> : null}
      <p>Los registros documentales solo serán asignables cuando exista un Project y una InitiativePortfolioMeta válidos. Esta pantalla no crea Projects automáticamente.</p>
    </div>
  </details>;
}

function BriefSummary({ target, version, inherited }: { target: ChallengeAssignmentTarget; version: ActivationBriefVersion; inherited: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const sources = displayRefs(version.sourceRefs);
  const provenance = displayRefs(version.provenance);
  return <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50" aria-label="Información del Brief confirmado">
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-slate-950"><FileText size={18} className="shrink-0 text-emerald-700" /><h3 className="font-semibold">Información que compartiremos con el equipo</h3></div>
        <p className="mt-1 truncate text-sm text-slate-700">Reto: {target.challengeName}</p>
        <details className="mt-1 text-xs text-slate-500"><summary className="w-fit cursor-pointer font-medium">Datos de trazabilidad</summary><p className="mt-1"><span className="block">Reto <span className="break-all">{target.challengeId}</span></span><span className="mt-1 block">Brief <span className="break-all">{target.briefId}</span></span></p></details>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800"><LockKeyhole size={14} />Versión {version.versionNumber} · Confirmada e inmutable</span>
        <button type="button" aria-expanded={expanded} aria-controls="confirmed-brief-content" onClick={() => setExpanded((current) => !current)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">{expanded ? 'Ocultar contenido del Brief' : 'Ver contenido del Brief'}<ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
      </div>
    </div>
    {expanded ? <div id="confirmed-brief-content" className="border-t border-slate-200 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-2"><BriefField label="Resultado esperado" value={text(version.intent, 'Sin resultado registrado.')} /><BriefField label="Decisión que debe habilitar" value={text(inherited.decisionToEnable, 'Sin decisión registrada.')} /><BriefField label="Qué recibirá el equipo" value={text(inherited.expectedDeliverable, 'Sin entregable registrado.')} /><BriefField label="Contexto de trabajo" value={text(version.scope, 'Sin contexto registrado.')} /></div>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2"><BriefField label="Fuentes" value={sources.length ? sources.join(' · ') : 'Sin fuentes registradas.'} /><BriefField label="Trazabilidad" value={provenance.length ? provenance.join(' · ') : 'Sin trazabilidad adicional registrada.'} /></div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Contenido de solo lectura. Esta vista conserva exactamente la versión confirmada; cualquier cambio requiere una nueva versión del Brief.</p>
    </div> : null}
  </section>;
}

function PreparedTray({ assignments, selectedIds, onToggle, onEdit }: { assignments: HandoffAssignment[]; selectedIds: string[]; onToggle: (assignmentId: string) => void; onEdit: (assignment: HandoffAssignment) => void }) {
  return <section className="mt-6" aria-label="Bandeja de asignaciones"><div className="flex items-center gap-2 text-slate-950"><CheckCircle2 className="text-emerald-700" size={19} /><h3 className="text-lg font-semibold">Asignaciones preparadas</h3></div><p className="mt-1 text-sm text-slate-600">Selecciona solo los encargos que quieres enviar. Guardar y enviar siguen siendo acciones separadas.</p><div className="mt-3 grid gap-3">{assignments.map((assignment) => { const owner = assignment.members.find((member) => member.role === 'OWNER'); const email = owner?.emailNormalized ?? assignment.invitedEmailNormalized; return <article key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3">{assignment.state === 'CREATED' ? <input type="checkbox" aria-label={`Seleccionar invitación para ${email}`} checked={selectedIds.includes(assignment.id)} onChange={() => onToggle(assignment.id)} className="mt-1 h-4 w-4 accent-violet-700" /> : null}<div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">{assignment.targetKind === 'EXISTING_INITIATIVE' ? `Continuar una iniciativa existente · ${assignment.initiative?.name ?? 'Iniciativa vinculada'}` : 'Proponer una nueva iniciativa'}</p><p className="mt-2 text-xs font-semibold text-slate-500">Persona responsable</p><p className="mt-0.5 break-words font-semibold text-slate-950">{email}</p><p className="mt-1 text-sm text-slate-600">{assignment.members.filter((item) => item.role === 'EXECUTOR').length} colaboradores opcionales</p></div></div><div className="flex flex-col items-end gap-2"><AssignmentStateBadge assignment={assignment} />{assignment.state === 'CREATED' ? <button type="button" aria-label={`Editar asignación para ${email}`} onClick={() => onEdit(assignment)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"><Pencil size={14} />Editar</button> : null}</div></div>{assignment.contextNote ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{assignment.contextNote}</p> : null}<details className="mt-3 text-xs text-slate-500"><summary className="w-fit cursor-pointer font-medium">Datos de trazabilidad</summary><p className="mt-1">Assignment <span className="break-all">{assignment.id}</span> · versión {assignment.version}</p></details></article>; })}</div></section>;
}

function AssignmentStateBadge({ assignment }: { assignment: HandoffAssignment }) {
  const failed = assignment.deliveryAttempts?.[0]?.status === 'FAILED';
  const label = failed ? 'Error al enviar' : ({ CREATED: 'Pendiente de envío', SENT: 'Envío procesado', VIEWED: 'Enlace abierto', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada' } as Record<string, string>)[assignment.state] ?? assignment.state;
  const evidenceAt = failed ? assignment.deliveryAttempts?.[0]?.attemptedAt
    : assignment.state === 'SENT' ? assignment.sentAt
      : assignment.state === 'VIEWED' ? assignment.viewedAt
        : assignment.state === 'ACCEPTED' ? assignment.acceptedAt
          : assignment.state === 'REJECTED' ? assignment.rejectedAt : assignment.createdAt;
  const color = failed || assignment.state === 'REJECTED' ? 'bg-rose-100 text-rose-900'
    : assignment.state === 'CREATED' ? 'bg-amber-100 text-amber-900'
      : assignment.state === 'SENT' ? 'bg-sky-100 text-sky-900'
        : assignment.state === 'VIEWED' ? 'bg-violet-100 text-violet-900' : 'bg-emerald-100 text-emerald-900';
  return <div className="text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{label}</span>{evidenceAt ? <p className="mt-1 text-[11px] text-slate-500">Registrada {formatEvidenceTime(evidenceAt)}</p> : null}</div>;
}

function AssignmentStateGuide() {
  return <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="assignment-state-guide-title">
    <h4 id="assignment-state-guide-title" className="text-sm font-semibold text-slate-950">Qué significa cada estado</h4>
    <ul className="mt-2 grid gap-2 text-xs leading-5 text-slate-700 md:grid-cols-2">
      <li><b>Pendiente de envío:</b> asignación guardada; aún no se invitó a nadie.</li>
      <li><b>Envío procesado:</b> el servidor aceptó el mensaje; no acredita entrega externa ni apertura.</li>
      <li><b>Enlace abierto:</b> se abrió el enlace seguro; no equivale a aceptación.</li>
      <li><b>Aceptada o rechazada:</b> existe una respuesta explícita del destinatario persistida en backend.</li>
      <li><b>Error al enviar:</b> falló el intento de delivery; la asignación no pasa a un estado terminal.</li>
    </ul>
  </section>;
}

function FlowCompletion({ onExit, onViewTracking }: { onExit: () => void; onViewTracking?: () => void }) {
  return <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4 shadow-sm" aria-label="Finalizar preparación">
    <h3 className="font-semibold text-slate-950">Termina cuando quieras</h3>
    <p className="mt-1 text-sm leading-6 text-slate-600">Guardar y salir nunca envía invitaciones ni finaliza esta configuración. El envío solo ocurre después de revisar y confirmar los encargos seleccionados.</p>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onExit} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Guardar y salir</button>{onViewTracking ? <button type="button" onClick={onViewTracking} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Ver seguimiento</button> : null}</div>
  </section>;
}

function ExitPrompt({ editor, saving, onSaveAndExit, onDiscardAndExit, onContinue }: { editor: Editor; saving: boolean; onSaveAndExit: () => void; onDiscardAndExit: () => void; onContinue: () => void }) {
  return <section role="dialog" aria-modal="true" aria-labelledby="exit-prompt-title" className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
    <h3 id="exit-prompt-title" className="font-semibold text-amber-950">Tienes un encargo sin guardar</h3>
    <p className="mt-1 text-sm leading-6 text-amber-900">Puedes guardarlo antes de volver, descartar conscientemente este borrador o seguir editando. Ninguna opción envía invitaciones.</p>
    <p className="mt-2 text-xs text-amber-900">Destinatario actual: <b>{editor.owner || 'sin indicar'}</b></p>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={onSaveAndExit} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar este encargo y volver'}</button><button type="button" disabled={saving} onClick={onContinue} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Seguir editando</button><button type="button" disabled={saving} onClick={onDiscardAndExit} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-800">Descartar borrador y volver</button></div>
  </section>;
}

function formatEvidenceTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function AssignmentEditor({ editor, initiatives, people, target, error, saving, documentaryReview, onChange, onSelectInitiative, onReviewDocumentary, onChangeDocumentary, onConfirmDocumentary, onReview, onSave, onCancel }: {
  editor: Editor; initiatives: AssignableInitiatives; people: string[]; target: ChallengeAssignmentTarget;
  error: string | null; saving: boolean; documentaryReview: DocumentaryReview | null;
  onChange: (change: Partial<Editor>) => void; onSelectInitiative: (id: string) => void;
  onReviewDocumentary: (record: ImportedInitiativeRecord) => void;
  onChangeDocumentary: (review: DocumentaryReview | null) => void;
  onConfirmDocumentary: () => void; onReview: () => void; onSave: () => void; onCancel: () => void;
}) {
  const lockedTarget = Boolean(editor.assignmentId);
  const canContinueExisting = initiatives.canonicalInitiatives.length > 0;
  const selectedInitiative = initiatives.canonicalInitiatives.find((item) => item.id === editor.initiativeId);
  const assignmentDetailsVisible = editor.targetKind === 'CHALLENGE' || Boolean(editor.initiativeId);
  return <section className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-5" aria-label="Editar asignación">
    {editor.phase === 'edit' ? <>
      <h3 className="text-lg font-semibold text-slate-950">{editor.assignmentId ? 'Edita este encargo' : editor.targetKind === 'EXISTING_INITIATIVE' && editor.initiativeId ? 'Asigna responsable y equipo' : editor.targetKind === 'EXISTING_INITIATIVE' ? 'Elige una iniciativa existente' : 'Define este encargo'}</h3>
      <p className="mt-1 text-sm text-slate-700">Elige qué recibirá esta persona. Este encargo tendrá su propio responsable, equipo y contexto.</p>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-violet-200 bg-white p-4 text-sm text-slate-900">
        <input type="checkbox" aria-label="Asignarle una iniciativa existente" checked={editor.targetKind === 'EXISTING_INITIATIVE'} disabled={lockedTarget || (!canContinueExisting && editor.targetKind !== 'EXISTING_INITIATIVE')} onChange={(event) => { onChangeDocumentary(null); onChange(event.target.checked ? { targetKind: 'EXISTING_INITIATIVE', initiativeId: '', owner: '', attachBrief: false } : { targetKind: 'CHALLENGE', initiativeId: '', attachBrief: true }); }} className="mt-0.5 h-4 w-4 accent-violet-700" />
        <span><b>Asignarle una iniciativa existente</b><span className="mt-1 block text-xs font-normal leading-5 text-slate-600">{lockedTarget ? 'La modalidad de una asignación guardada no se puede cambiar.' : canContinueExisting ? 'Activa esta opción para elegir una iniciativa canónica vinculada y disponible.' : 'No hay iniciativas disponibles para asignar en este reto.'}</span></span>
      </label>
      {editor.targetKind === 'EXISTING_INITIATIVE' ? <div className="mt-4 space-y-4">
        {documentaryReview ? <DocumentaryInitiativeReview review={documentaryReview} canonicalInitiatives={initiatives.canonicalInitiatives} saving={saving} onChange={onChangeDocumentary} onConfirm={onConfirmDocumentary} /> : <>
          {initiatives.canonicalInitiatives.length ? <label className="text-sm font-semibold text-slate-950">Iniciativa a continuar<select aria-label="Iniciativa a continuar" disabled={lockedTarget} value={editor.initiativeId} onChange={(event) => onSelectInitiative(event.target.value)} className={inputClass}><option value="">Selecciona una iniciativa</option>{initiatives.canonicalInitiatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
        </>}
        {editor.initiativeId ? <><p className="text-xs text-slate-600">Iniciativa válida y vinculada a este reto.</p>{selectedInitiative?.activationStatus === 'OWNER_PENDING' ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><b>Responsable operativo pendiente.</b> La persona indicada abajo será destinataria prevista del encargo; todavía no es owner aceptado del Project.</p> : null}</> : null}
      </div> : <p className="mt-3 text-sm text-slate-700">La persona recibirá el reto y la versión confirmada del Brief para proponer una iniciativa posteriormente.</p>}
      {assignmentDetailsVisible ? <>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><EmailField label="Persona responsable" help="Una única persona será responsable de este encargo." value={editor.owner} onChange={(owner) => onChange({ owner })} required /><EmailField label="Colaborador 1" help="Opcional · participará en este encargo." value={editor.collaborators[0]} onChange={(value) => onChange({ collaborators: [value, editor.collaborators[1]] })} /><EmailField label="Colaborador 2" help="Opcional · máximo dos colaboradores en este encargo." value={editor.collaborators[1]} onChange={(value) => onChange({ collaborators: [editor.collaborators[0], value] })} /></div>
        <label className="mt-4 block text-sm font-semibold text-slate-950">Contexto específico del encargo<span className="mt-1 block text-xs font-normal leading-5 text-slate-600">Aclara qué debe atender esta persona sin cambiar el Brief ni inventar hechos.</span><textarea aria-label="Contexto específico del encargo" value={editor.contextNote} onChange={(event) => onChange({ contextNote: event.target.value })} rows={3} placeholder="Ejemplo: contrasta primero la fricción observada en onboarding." className={inputClass} /></label>
      </> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Cancelar</button>{assignmentDetailsVisible ? <button type="button" onClick={onReview} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Revisar asignación</button> : null}</div>
    </> : <>
      <h3 className="text-lg font-semibold text-slate-950">Revisa este encargo</h3><p className="mt-1 text-sm leading-6 text-slate-700"><b>Al guardar quedará preparada, aún no enviada.</b> No enviaremos invitaciones ni iniciaremos trabajo desde esta pantalla.</p><dl className="mt-4 grid gap-3 md:grid-cols-2"><ReviewField label="Modalidad" value={editor.targetKind === 'CHALLENGE' ? 'Proponer una nueva iniciativa' : initiatives.canonicalInitiatives.find((item) => item.id === editor.initiativeId)?.name ?? editor.initiativeId} /><ReviewField label="Persona responsable" value={people[0]} />{people.slice(1).map((email, index) => <ReviewField key={email} label={`Colaborador ${index + 1}`} value={email} />)}<ReviewField label="Brief" value={editor.targetKind === 'CHALLENGE' || editor.attachBrief ? `Versión confirmada ${target.briefVersionId}` : 'No adjunto a este encargo'} /></dl>{editor.contextNote ? <p className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-700">{editor.contextNote}</p> : null}{error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}<div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => onChange({ phase: 'edit' })} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Editar encargo</button><button type="button" disabled={saving} onClick={onSave} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : editor.assignmentId ? 'Guardar cambios' : 'Guardar asignación'}</button></div>
    </>}
  </section>;
}

function DocumentaryInitiativeReview({ review, canonicalInitiatives, saving, onChange, onConfirm }: { review: DocumentaryReview; canonicalInitiatives: AssignableInitiatives['canonicalInitiatives']; saving: boolean; onChange: (review: DocumentaryReview | null) => void; onConfirm: () => void }) {
  const refs = Array.isArray(review.record.sourceRefs) ? review.record.sourceRefs.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const value = item as Record<string, unknown>;
      if (value.sheet && value.row) return `${String(value.sheet)}, fila ${String(value.row)}`;
    }
    return displayRefs(item).join(' · ');
  }).filter(Boolean) : displayRefs(review.record.sourceRefs);
  const confirmable = review.decision === 'register' || (review.decision === 'link' && review.projectId);
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Revisión de iniciativa documental">
    <h4 className="text-base font-semibold text-slate-950">{review.record.label}</h4>
    {review.record.purpose ? <p className="mt-2 text-sm leading-6 text-slate-700">{review.record.purpose}</p> : null}
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><ReviewField label="Fuente" value={review.record.sourceLabel ?? 'Fuente documental del portafolio'} /><ReviewField label="Referencia" value={refs.length ? refs.join(' · ') : 'Referencia preservada en el vínculo'} /></dl>
    {review.decision === 'review' ? <><p className="mt-4 text-sm text-slate-700">Confirma cómo corresponde esta evidencia con una Initiative canónica. Ninguna opción crea Steps ni asigna owner operativo.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onChange({ ...review, decision: 'register' })} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Incorporar como iniciativa existente</button><button type="button" disabled={!canonicalInitiatives.length} onClick={() => onChange({ ...review, decision: 'link' })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50">Vincular a iniciativa existente</button><button type="button" onClick={() => onChange(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700">Volver</button></div></> : <>
      <p className="mt-4 rounded-lg bg-white p-3 text-sm leading-6 text-slate-800">{review.decision === 'register' ? 'Confirmas que este registro representa una iniciativa preexistente. Se creará un Project con responsable operativo pendiente, evaluación retroactiva pendiente y cero Steps.' : 'Confirmas que esta evidencia corresponde al Project elegido y está alineada explícitamente con este reto. El Project no se modificará.'}</p>
      {review.decision === 'link' ? <label className="mt-3 block text-sm font-semibold text-slate-950">Project canónico<select aria-label="Project canónico para vincular" value={review.projectId} onChange={(event) => onChange({ ...review, projectId: event.target.value })} className={inputClass}><option value="">Selecciona un Project</option>{canonicalInitiatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={saving || !confirmable} onClick={onConfirm} className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Confirmando…' : review.decision === 'register' ? 'Confirmar incorporación' : 'Confirmar vínculo'}</button><button type="button" disabled={saving} onClick={() => onChange({ ...review, decision: 'review', projectId: '' })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">Cambiar decisión</button></div>
    </>}
  </section>;
}

function TrayReview({ assignments, target, version, sending, onConfirm, onClose }: { assignments: HandoffAssignment[]; target: ChallengeAssignmentTarget; version: ActivationBriefVersion; sending: boolean; onConfirm: () => void; onClose: () => void }) {
  return <section className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-5" aria-label="Revisión de invitaciones"><h3 className="text-lg font-semibold text-violet-950">Revisa antes de enviar</h3><p className="mt-1 text-sm text-violet-900">Se enviarán {assignments.length} de forma explícita. Los demás encargos permanecerán preparados.</p><div className="mt-4 grid gap-3">{assignments.map((assignment) => { const collaborators = assignment.members.filter((member) => member.role === 'EXECUTOR'); return <article key={assignment.id} className="rounded-xl border border-violet-200 bg-white p-4"><p className="font-semibold text-slate-950">{assignment.targetKind === 'EXISTING_INITIATIVE' ? assignment.initiative?.name ?? 'Iniciativa vinculada' : target.challengeName}</p><p className="mt-1 text-sm text-slate-700">Destinatario: {assignment.invitedEmailNormalized}</p>{collaborators.length ? <p className="mt-1 text-sm text-slate-700">Colaboradores: {collaborators.map((member) => member.emailNormalized ?? member.label ?? member.identityKey).join(' · ')}</p> : <p className="mt-1 text-sm text-slate-500">Sin colaboradores</p>}<p className="mt-2 text-sm font-semibold text-violet-900">{assignment.briefVersionId ? `Versión ${assignment.briefVersion?.versionNumber ?? version.versionNumber} · Confirmada` : 'Sin Brief adjunto'}</p>{assignment.contextNote ? <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{assignment.contextNote}</p> : null}</article>; })}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={sending} onClick={onConfirm} className="rounded-lg bg-violet-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Enviando…' : `Confirmar envío de ${assignments.length} ${assignments.length === 1 ? 'invitación' : 'invitaciones'}`}</button><button type="button" disabled={sending} onClick={onClose} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-950">Volver sin enviar</button></div></section>;
}

function DeliveryResult({ batch, assignments, onRetry, onExit, onViewTracking, onCompleteSetup }: { batch: HandoffDeliveryBatch; assignments: HandoffAssignment[]; onRetry?: () => void; onExit: () => void; onViewTracking: () => void; onCompleteSetup?: () => Promise<void> }) {
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const completionAction = useRef<HTMLButtonElement>(null);
  const confirmAction = useRef<HTMLButtonElement>(null);
  const sent = batch.succeededCount ?? batch.results.filter((item) => item.status !== 'FAILED').length;
  const failed = batch.failedCount ?? batch.results.filter((item) => item.status === 'FAILED').length;
  const processedIds = new Set(batch.results.map((item) => item.assignmentId));
  const notSent = assignments.filter((item) => item.state === 'CREATED' && !processedIds.has(item.id)).length;
  const openCompletion = () => {
    setConfirmingCompletion(true);
    window.setTimeout(() => confirmAction.current?.focus(), 0);
  };
  const keepWorking = () => {
    setConfirmingCompletion(false);
    setCompletionError(null);
    window.setTimeout(() => completionAction.current?.focus(), 0);
  };
  const completeSetup = async () => {
    if (!onCompleteSetup || completing) return;
    setCompleting(true);
    setCompletionError(null);
    try {
      await onCompleteSetup();
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : 'No pudimos finalizar la configuración.');
      setCompleting(false);
    }
  };
  return <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
    <h3 className="font-semibold text-slate-950">Tus asignaciones están listas para seguimiento</h3>
    <p className="mt-1 text-sm text-slate-700">Las invitaciones procesadas quedaron registradas. Si todavía tienes iniciativas o encargos pendientes, podrás asignarlos o enviarlos más adelante.</p>
    <p className="mt-2 text-sm text-slate-700">{sent} invitaciones procesadas; {notSent} encargos sin enviar; {failed} con error.</p>
    <div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">{sent} {sent === 1 ? 'envío procesado' : 'envíos procesados'}</span>{failed ? <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-900">{failed} {failed === 1 ? 'error al enviar' : 'errores al enviar'}</span> : null}<span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-800">{notSent} sin enviar</span></div>
    <p className="mt-2 text-xs leading-5 text-slate-600">“Envío procesado” significa que el servidor aceptó el mensaje. No acredita entrega externa, apertura ni aceptación.</p>
    <ul className="mt-3 grid gap-2">{batch.results.map((result) => { const assignment = assignments.find((item) => item.id === result.assignmentId); return <li key={result.assignmentId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm"><b>{assignment?.invitedEmailNormalized ?? result.assignmentId}</b><span className={`ml-2 font-semibold ${result.status === 'FAILED' ? 'text-rose-800' : 'text-emerald-800'}`}>{result.status === 'FAILED' ? 'Error al enviar' : 'Envío procesado'}</span>{result.errorCategory ? <span className="mt-1 block text-xs text-slate-600">Motivo técnico: {result.errorCategory}</span> : null}</li>; })}</ul>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {onRetry ? <button type="button" onClick={onRetry} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">Reintentar solo fallidas</button> : null}
      <button type="button" onClick={onViewTracking} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">Ver seguimiento</button>
      {sent > 0 && onCompleteSetup ? confirmingCompletion ? <div role="group" aria-label="Confirmar finalización" className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3"><span className="text-sm text-violet-950"><b>¿Finalizar esta configuración?</b> Lo pendiente quedará guardado y no se enviarán correos.</span><button ref={confirmAction} type="button" disabled={completing} onClick={() => void completeSetup()} className="rounded-lg bg-violet-800 px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-800 disabled:opacity-60">{completing ? 'Finalizando…' : 'Sí, finalizar'}</button><button type="button" disabled={completing} onClick={keepWorking} className="rounded-lg border border-violet-300 bg-white px-3 py-2.5 text-sm font-semibold text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-800">Seguir aquí</button></div> : <button ref={completionAction} type="button" onClick={openCompletion} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950">Finalizar configuración y ver mi portafolio</button> : <button type="button" onClick={onExit} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950">Guardar y salir</button>}
    </div>
    {completionError ? <p role="alert" className="mt-2 text-sm text-rose-800">{completionError}</p> : null}
  </section>;
}
function BriefField({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">{label}</p><p className="mt-1 text-sm leading-6 text-emerald-950">{value}</p></div>; }
function EmailField({ label, help, value, onChange, required = false }: { label: string; help: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="text-sm font-semibold text-slate-950">{label}<span className="mt-1 block text-xs font-normal leading-5 text-slate-600">{help}</span><input type="email" required={required} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder="persona@organizacion.com" className={inputClass} /></label>; }
function ReviewField({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-violet-200 bg-white p-3"><dt className="text-xs font-bold uppercase tracking-wide text-violet-700">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-900">{value}</dd></div>; }
