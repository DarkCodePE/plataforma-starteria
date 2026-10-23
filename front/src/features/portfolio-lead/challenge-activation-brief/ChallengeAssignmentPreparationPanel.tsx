import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, FileText, LockKeyhole, Pencil, Plus, Users } from 'lucide-react';
import { createIdempotencyKey } from '../../portfolio-entry/public/idempotency';
import type { ChallengeAssignmentTarget } from './ChallengeActivationBriefPanel';
import {
  createChallengeHandoffAssignment,
  getActivationBrief,
  linkImportedInitiative,
  listAssignableInitiatives,
  listChallengeHandoffAssignments,
  registerImportedInitiative,
  updateChallengeHandoffAssignment,
  type ActivationBriefVersion,
  type AssignableInitiatives,
  type HandoffAssignment,
  type HandoffAssignmentMember,
  type ImportedInitiativeRecord,
} from './challengeActivationBriefClient';

type Props = { target: ChallengeAssignmentTarget; onBack?: () => void };
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
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown, fallback: string): string { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function normalizedEmail(value: string): string { return value.trim().toLowerCase(); }
function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
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

export function ChallengeAssignmentPreparationPanel({ target, onBack }: Props) {
  const [version, setVersion] = useState<ActivationBriefVersion | null>(null);
  const [assignments, setAssignments] = useState<HandoffAssignment[]>([]);
  const [initiatives, setInitiatives] = useState<AssignableInitiatives>(emptyInitiatives);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reviewTray, setReviewTray] = useState(false);
  const [documentaryReview, setDocumentaryReview] = useState<DocumentaryReview | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const commandKey = useRef(createIdempotencyKey(`pl06a:prepare:${target.challengeId}:${target.briefVersionId}`));
  const incorporationKey = useRef(createIdempotencyKey(`adr009:canonicalize:${target.challengeId}`));

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

  const people = useMemo(() => editor ? [normalizedEmail(editor.owner), ...editor.collaborators.map(normalizedEmail)].filter(Boolean) : [], [editor]);
  const members = useMemo<HandoffAssignmentMember[]>(() => people.map((email, index) => ({ identityKey: email, emailNormalized: email, role: index === 0 ? 'OWNER' : 'EXECUTOR' })), [people]);
  const preparedAssignments = useMemo(() => assignments.filter((item) => item.state === 'CREATED'), [assignments]);
  const assignedInitiativeIds = useMemo(() => new Set(assignments
    .filter((item) => item.targetKind === 'EXISTING_INITIATIVE' && item.initiativeId && !['REJECTED', 'REVOKED', 'EXPIRED'].includes(item.state))
    .map((item) => item.initiativeId!)), [assignments]);
  const unassignedCanonicalCount = useMemo(() => initiatives.canonicalInitiatives
    .filter((initiative) => !assignedInitiativeIds.has(initiative.id)).length, [assignedInitiativeIds, initiatives.canonicalInitiatives]);
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
  const review = () => {
    if (!editor) return;
    if (editor.targetKind === 'EXISTING_INITIATIVE' && !editor.initiativeId) return setError('Elige una iniciativa canónica vinculada a este reto.');
    if (!validEmail(people[0] ?? '')) return setError('Indica un email válido para la persona responsable.');
    if (people.some((email) => !validEmail(email))) return setError('Revisa los emails de colaboradores antes de continuar.');
    if (new Set(people).size !== people.length) return setError('Cada persona debe aparecer una sola vez en el equipo.');
    setError(null); setEditor({ ...editor, phase: 'review' });
  };
  const save = async () => {
    if (!editor) return;
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
      setEditor(null); setReviewTray(false); setStatus('ready');
    } catch (value) { setError(value instanceof Error ? value.message : 'No pudimos guardar la asignación.'); setStatus('ready'); }
  };
  const edit = (assignment: HandoffAssignment) => {
    const owner = assignment.members.find((member) => member.role === 'OWNER');
    const collaborators = assignment.members.filter((member) => member.role === 'EXECUTOR');
    setEditor({ assignmentId: assignment.id, expectedVersion: assignment.version, targetKind: assignment.targetKind, initiativeId: assignment.initiativeId ?? '', attachBrief: Boolean(assignment.briefVersionId), owner: owner?.emailNormalized ?? assignment.invitedEmailNormalized, collaborators: [collaborators[0]?.emailNormalized ?? '', collaborators[1]?.emailNormalized ?? ''], contextNote: assignment.contextNote ?? '', phase: 'edit' });
    setError(null); setReviewTray(false); commandKey.current = createIdempotencyKey(`pl06a:update:${assignment.id}:${assignment.version}`);
  };

  if (status === 'loading') return <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite"><p className="font-semibold text-slate-900">Recuperando los encargos preparados…</p></section>;
  if (status === 'error' || !version) return <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900"><div className="flex gap-2"><AlertCircle className="mt-0.5 shrink-0" size={18} /><p>{error}</p></div>{onBack ? <button type="button" onClick={onBack} className="mt-4 inline-flex items-center gap-2 font-semibold"><ArrowLeft size={16} />Volver al Brief</button> : null}</section>;

  return <section className="space-y-5" data-testid="pl06a-assignment-preparation" data-brief-version-id={version.id}>
    <div className="flex items-start gap-3"><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800"><Users size={16} /></span><div className="max-w-3xl rounded-2xl rounded-tl-sm border border-violet-100 bg-white px-4 py-3 text-sm leading-6 text-slate-800">El Brief está confirmado. Puedes preparar varios encargos independientes, revisarlos y volver más tarde. <b>Guardar no envía invitaciones ni inicia trabajo.</b></div></div>
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-labelledby="pl06a-title">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">PL-06A · Preparar asignaciones</p>
      <h2 id="pl06a-title" className="mt-1 text-2xl font-semibold text-slate-950">Prepara las asignaciones de este reto</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Asigna responsables a iniciativas existentes o encarga una nueva propuesta. Puedes dejar otras para después y volver sin perder los encargos ya preparados.</p>
      <p className="mt-3 max-w-3xl rounded-xl bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-950"><b>Cada encargo es independiente:</b> tiene una persona responsable por encargo y hasta dos colaboradores opcionales.</p>
      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-violet-950" role="status" aria-live="polite">{unassignedCanonicalCount} {unassignedCanonicalCount === 1 ? 'iniciativa asignable sin encargo' : 'iniciativas asignables sin encargo'}</p>
          <p id="add-assignment-help" className="mt-1 text-xs leading-5 text-violet-800">{editor ? 'Termina o cancela la acción abierta antes de preparar otro encargo.' : 'Elige una iniciativa existente o encarga una nueva propuesta. Guardar no envía invitaciones.'}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" disabled={Boolean(editor)} aria-describedby="add-assignment-help" onClick={() => { setReviewTray(false); setEditor(newEditor()); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"><Plus size={16} />{preparedAssignments.length || editor ? 'Agregar otra asignación' : 'Agregar asignación'}</button>
          {preparedAssignments.length && !editor ? <button type="button" onClick={() => setReviewTray(true)} className="rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-950">Revisar bandeja</button> : null}
        </div>
      </div>
      {!initiatives.canonicalInitiatives.length ? <p id="existing-initiative-unavailable" className="sr-only">No hay iniciativas canónicas vinculadas y asignables. Los registros importados requieren revisión humana antes de poder asignarse como iniciativas.</p> : null}

      {editor ? <AssignmentEditor editor={editor} initiatives={initiatives} people={people} target={target} error={error} saving={status === 'saving'} documentaryReview={documentaryReview} onChange={changeEditor} onSelectInitiative={selectInitiative} onReviewDocumentary={(record) => { setDocumentaryReview({ record, decision: 'review', projectId: '' }); incorporationKey.current = createIdempotencyKey(`adr009:canonicalize:${target.challengeId}:${record.id}`); setError(null); }} onChangeDocumentary={setDocumentaryReview} onConfirmDocumentary={confirmDocumentaryInitiative} onReview={review} onSave={save} onCancel={() => { setEditor(null); setDocumentaryReview(null); setError(null); }} /> : null}

      {preparedAssignments.length ? <PreparedTray assignments={preparedAssignments} onEdit={edit} /> : <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">Aún no hay encargos preparados. Puedes añadir uno ahora o volver más tarde, sin enviar nada.</p>}
      {reviewTray ? <TrayReview assignments={preparedAssignments} onClose={() => setReviewTray(false)} /> : null}
      <DocumentaryInitiativesSummary initiatives={initiatives} />
      <BriefSummary target={target} version={version} inherited={inherited} />
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
        <p className="mt-1 truncate text-sm text-slate-700">{target.challengeName}</p>
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

function PreparedTray({ assignments, onEdit }: { assignments: HandoffAssignment[]; onEdit: (assignment: HandoffAssignment) => void }) {
  return <section className="mt-6" aria-label="Bandeja de asignaciones"><div className="flex items-center gap-2 text-slate-950"><CheckCircle2 className="text-emerald-700" size={19} /><h3 className="text-lg font-semibold">Asignaciones preparadas</h3></div><p className="mt-1 text-sm text-slate-600">Cada tarjeta es un encargo independiente y puede tener una persona responsable diferente.</p><div className="mt-3 grid gap-3">{assignments.map((assignment) => { const owner = assignment.members.find((member) => member.role === 'OWNER'); const email = owner?.emailNormalized ?? assignment.invitedEmailNormalized; return <article key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">{assignment.targetKind === 'EXISTING_INITIATIVE' ? `Continuar una iniciativa existente · ${assignment.initiative?.name ?? 'Iniciativa vinculada'}` : 'Proponer una nueva iniciativa'}</p><p className="mt-2 text-xs font-semibold text-slate-500">Persona responsable</p><p className="mt-0.5 break-words font-semibold text-slate-950">{email}</p><p className="mt-1 text-sm text-slate-600">{assignment.members.filter((item) => item.role === 'EXECUTOR').length} colaboradores opcionales</p></div><div className="flex flex-col items-end gap-2"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Preparada, aún no enviada</span>{assignment.state === 'CREATED' ? <button type="button" aria-label={`Editar asignación para ${email}`} onClick={() => onEdit(assignment)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"><Pencil size={14} />Editar</button> : null}</div></div>{assignment.contextNote ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{assignment.contextNote}</p> : null}<details className="mt-3 text-xs text-slate-500"><summary className="w-fit cursor-pointer font-medium">Datos de trazabilidad</summary><p className="mt-1">Assignment <span className="break-all">{assignment.id}</span> · versión {assignment.version}</p></details></article>; })}</div></section>;
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
  const canContinueExisting = initiatives.canonicalInitiatives.length > 0 || initiatives.importedRecords.length > 0;
  const selectedInitiative = initiatives.canonicalInitiatives.find((item) => item.id === editor.initiativeId);
  const assignmentDetailsVisible = editor.targetKind === 'CHALLENGE' || Boolean(editor.initiativeId);
  return <section className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-5" aria-label="Editar asignación">
    {editor.phase === 'edit' ? <>
      <h3 className="text-lg font-semibold text-slate-950">{editor.assignmentId ? 'Edita este encargo' : editor.targetKind === 'EXISTING_INITIATIVE' && editor.initiativeId ? 'Asigna responsable y equipo' : editor.targetKind === 'EXISTING_INITIATIVE' ? 'Elige una iniciativa existente' : 'Define este encargo'}</h3>
      <p className="mt-1 text-sm text-slate-700">Elige qué recibirá esta persona. Este encargo tendrá su propio responsable, equipo y contexto.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button type="button" aria-label="Proponer una nueva iniciativa" disabled={lockedTarget} onClick={() => { onChangeDocumentary(null); onChange({ targetKind: 'CHALLENGE', initiativeId: '', attachBrief: true }); }} className={`rounded-xl border p-4 text-left ${editor.targetKind === 'CHALLENGE' ? 'border-violet-700 bg-violet-800 text-white' : 'border-violet-200 bg-white text-slate-900'} disabled:opacity-60`}><span className="block text-sm font-semibold">Proponer una nueva iniciativa</span><span className={`mt-1 block text-xs leading-5 ${editor.targetKind === 'CHALLENGE' ? 'text-violet-100' : 'text-slate-600'}`}>La persona recibirá el reto y este Brief para proponer cómo abordarlo.</span></button>
        <button type="button" aria-label="Continuar una iniciativa existente" aria-describedby={!canContinueExisting ? 'existing-initiative-unavailable' : undefined} disabled={lockedTarget || !canContinueExisting} onClick={() => onChange({ targetKind: 'EXISTING_INITIATIVE', initiativeId: '', owner: '', attachBrief: false })} className={`rounded-xl border p-4 text-left ${editor.targetKind === 'EXISTING_INITIATIVE' ? 'border-violet-700 bg-violet-800 text-white' : 'border-violet-200 bg-white text-slate-900'} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500`}><span className="block text-sm font-semibold">Continuar una iniciativa existente</span><span className={`mt-1 block text-xs leading-5 ${editor.targetKind === 'EXISTING_INITIATIVE' ? 'text-violet-100' : 'text-slate-600'}`}>{canContinueExisting ? 'Elige una iniciativa canónica o revisa un registro documental relacionado.' : 'No hay iniciativas ni registros relacionados disponibles.'}</span></button>
      </div>
      {editor.targetKind === 'EXISTING_INITIATIVE' ? <div className="mt-4 space-y-4">
        {documentaryReview ? <DocumentaryInitiativeReview review={documentaryReview} canonicalInitiatives={initiatives.canonicalInitiatives} saving={saving} onChange={onChangeDocumentary} onConfirm={onConfirmDocumentary} /> : <>
          {initiatives.canonicalInitiatives.length ? <label className="text-sm font-semibold text-slate-950">Iniciativa a continuar<select aria-label="Iniciativa a continuar" disabled={lockedTarget} value={editor.initiativeId} onChange={(event) => onSelectInitiative(event.target.value)} className={inputClass}><option value="">Selecciona una iniciativa</option>{initiatives.canonicalInitiatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          {initiatives.importedRecords.length && !editor.initiativeId ? <div className="rounded-xl border border-amber-200 bg-white p-4"><p className="text-sm font-semibold text-slate-950">Iniciativas identificadas en documentos</p><p className="mt-1 text-xs leading-5 text-slate-600">Revisa identidad y procedencia antes de vincular o incorporar. Abrir esta revisión no escribe datos.</p><div className="mt-3 grid gap-2">{initiatives.importedRecords.map((record) => <button key={record.id} type="button" onClick={() => onReviewDocumentary(record)} aria-label={`Revisar iniciativa documental ${record.label}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-semibold text-slate-900 hover:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500">{record.label}<span className="mt-1 block text-xs font-normal text-slate-600">{record.sourceLabel ?? 'Fuente documental del portafolio'}</span></button>)}</div></div> : null}
        </>}
        {editor.initiativeId ? <><p className="text-xs text-slate-600">Iniciativa válida y vinculada a este reto.</p>{selectedInitiative?.activationStatus === 'OWNER_PENDING' ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><b>Responsable operativo pendiente.</b> La persona indicada abajo será destinataria prevista del encargo; todavía no es owner aceptado del Project.</p> : null}<label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" aria-label="Adjuntar también este Brief confirmado" checked={editor.attachBrief} onChange={(event) => onChange({ attachBrief: event.target.checked })} />Adjuntar también este Brief confirmado (opcional)</label></> : null}
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

function TrayReview({ assignments, onClose }: { assignments: HandoffAssignment[]; onClose: () => void }) { return <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="text-lg font-semibold text-emerald-950">Bandeja lista para revisión humana</h3><p className="mt-1 text-sm text-emerald-900">Hay {assignments.length} {assignments.length === 1 ? 'asignación preparada' : 'asignaciones preparadas'}. Puedes seguir editándolas; el envío no está disponible en esta etapa.</p><button type="button" onClick={onClose} className="mt-4 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-950">Volver a la bandeja</button></section>; }
function BriefField({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">{label}</p><p className="mt-1 text-sm leading-6 text-emerald-950">{value}</p></div>; }
function EmailField({ label, help, value, onChange, required = false }: { label: string; help: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="text-sm font-semibold text-slate-950">{label}<span className="mt-1 block text-xs font-normal leading-5 text-slate-600">{help}</span><input type="email" required={required} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder="persona@organizacion.com" className={inputClass} /></label>; }
function ReviewField({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-violet-200 bg-white p-3"><dt className="text-xs font-bold uppercase tracking-wide text-violet-700">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-900">{value}</dd></div>; }
