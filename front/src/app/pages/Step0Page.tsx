import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, ChevronRight, Copy, CreditCard, Download, Loader2, Sparkles, X } from 'lucide-react';
import { enrichProject, useApp } from '../context/AppContext';
import { getProjectAccess } from '../authz/projectAccess';
import { ReadOnlyNotice } from '../components/ReadOnlyNotice';
import { depthLevelLabel, outputLabel, routeTypeLabel } from '../../features/adaptive-core/domain/adaptiveLabels';
import { MentorVirtualPanel } from '../components/MentorVirtualPanel';
import { MentorSupportModal } from '../components/MentorSupportModal';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';
import { LeaderFeedbackStatusCard } from '../components/LeaderFeedbackStatusCard';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import {
  CLARITY_OPTIONS,
  CONTRIBUTION_OPTIONS,
  EVIDENCE_TYPE_OPTIONS,
  FRAME_OPTIONS,
  PRIMARY_OBJECTIVE_OPTIONS,
  buildInheritedChallengeContext,
  getConsequenceHelper,
  getDynamicDescriptionLabel,
  getRequiredFieldKeys,
  getStep0Mode,
  isFilled,
  normalizeStep0Data,
  syncLegacyFields,
} from '../step0/step0Config';
import type { Project, Step0Data } from '../context/AppContext';
import { getStep0Prefill, hasStep0Prefill } from '../../features/public-start/services/publicStep0PrefillService';
import { AdaptiveCheckpointWorkspace } from '../../features/adaptive-core/components';
import {
  getActiveStepConfiguration,
  materializeQuestionsForCheckpoint,
} from '../../features/adaptive-core/domain/adaptiveCore';

import type { AdaptiveInitiativeCore } from '../../features/adaptive-core/domain/types';

import {
  mergeCheckpointResponses,
  projectCheckpointResponsesToFields,
} from '../../features/adaptive-core/domain/checkpointResponses';
import { canNavigateToAdaptiveStep } from '../../features/adaptive-core/domain/adaptiveAuthority';
import { confirmAdaptiveCheckpoint, explainCheckpointError, confirmStep0Brief, getAdaptiveCore } from '../../features/adaptive-core/services/adaptiveCoreService';
import { AutofillField } from '../components/autofill/AutofillField';
import { CHALLENGE_TYPE_LABELS, type ChallengeType, type InitialReviewArtifact } from '../../features/initial-review/domain/types';
import { getById } from '../services/projectService';

type ModuleId = 'start' | 'impact' | 'decision';
type AdaptiveCoreLoadState = 'loading' | 'loaded' | 'error';
type ModuleState = 'No iniciado' | 'En progreso' | 'Listo' | 'Necesita ajuste';

const MODULE_ORDER: ModuleId[] = ['start', 'impact', 'decision'];
const MODULE_TITLES: Record<ModuleId, string> = {
  start: 'Punto de partida',
  impact: 'Impacto y urgencia',
  decision: 'Apoyo y decisión',
};

/**
 * PRD-03 §6 (Zona 3): un Step se presenta como UNA jerarquia, no como dos.
 *
 * Los tres modulos historicos de Step 0 corresponden uno a uno con los checkpoints del
 * catalogo adaptativo, asi que cada modulo se pliega dentro de su checkpoint en vez de
 * vivir como una seccion paralela con su propio contador de avance.
 */
const CHECKPOINT_TO_MODULE: Record<string, ModuleId> = {
  'CP-0.1': 'start',
  'CP-0.2': 'impact',
  'CP-0.3': 'decision',
};

const MODULE_DESCRIPTIONS: Record<ModuleId, string> = {
  start: 'Define desde dónde nace la iniciativa y cómo quieres enmarcarla.',
  impact: 'Explica qué está pasando, a quién afecta y por qué conviene moverlo ahora.',
  decision: 'Define qué señales existen hoy, quién debe escucharlo y qué decisión buscas.',
};

/**
 * Solo lo que el motor de checkpoints NO pregunta. `primaryObjective`, `quePasaQueQuieres`,
 * `impactWho`, `whyNowText`, `evidenceType`, `quienEscuchar` y `decisionRequested` pasaron
 * al catalogo de `checkpoint-planner`, asi que el formulario ya no puede exigirlos: quien
 * decide si el Step puede cerrar es el checkpoint.
 */
const MODULE_REQUIRED: Record<ModuleId, Array<keyof Step0Data>> = {
  start: ['initiativeTitle', 'initiativeFrame'],
  impact: [],
  decision: [],
};

/**
 * Proyeccion checkpoint → formulario legacy de Step 0.
 *
 * `legacyStep0Seed` mapea en la direccion contraria usando cadenas de fallback
 * (`form.a || form.b || form.c`), asi que la inversa es ambigua: aqui se escribe solo
 * el campo PRIMARIO de cada cadena, que es el unico determinista. Las secciones legacy
 * pasan a ser una vista del recorrido adaptativo en vez de una segunda captura.
 */
const CHECKPOINT_VARIABLE_TO_STEP0_FIELD: Record<string, keyof Step0Data> = {
  objective: 'quePasaQueQuieres',
  scope: 'specificChallengePart',
  owner_and_actor_required: 'quienEscuchar',
  priorityHypothesis: 'validationSignal',
  decisionCriteria: 'decisionRequested',
  currentEvidence: 'currentEvidence',
  adoption: 'sponsorInterestReason',
  outcome: 'impactWho',
  // Variables que el planificador incorporo al absorber el formulario estatico.
  whyNow: 'whyNowText',
  availableEvidence: 'currentEvidence',
};

const FIELD_LABELS: Partial<Record<keyof Step0Data, string>> = {
  initiativeTitle: 'Nombre de la iniciativa',
  initiativeFrame: 'Tipo de iniciativa',
  primaryObjective: 'Objetivo de negocio',
  quePasaQueQuieres: 'Qué está pasando hoy',
  impactWho: 'A quién impacta',
  whyNowText: 'Por qué importa ahora',
  evidenceType: 'Señales actuales',
  quienEscuchar: 'Primer interlocutor',
  decisionRequested: 'Decisión buscada',
};

const IA_FEEDBACK = {
  claro: [
    'La iniciativa ya conecta con una prioridad de negocio.',
    'La decisión que buscas empieza a quedar clara.',
    'El siguiente paso hacia Step 1 se entiende mejor.',
  ],
  faltaPrecisar: [
    'Falta indicar qué señales existen hoy.',
    'Falta explicar qué confirmarás en Step 1.',
    'Falta concretar qué decisión quieres pedir.',
  ],
  preguntas: [
    '¿Qué señal haría que valga la pena investigar más?',
    '¿Qué líder o área puede destrabar la conversación?',
    '¿Qué información no deberíamos inventar todavía?',
  ],
  siguienteAccion: 'Ordena la redacción sin agregar datos, métricas, evidencia, entrevistas ni sponsors que no hayas mencionado.',
};

const IMPACT_OPTIONS = ['Clientes', 'Equipo interno', 'Área comercial', 'Operaciones', 'Atención o soporte', 'Tecnología', 'Finanzas', 'Liderazgo', 'Otro'];
const URGENCY_OPTIONS = ['Está generando demoras', 'Está aumentando costos', 'Está afectando clientes', 'Está frenando ventas', 'Está generando retrabajo', 'Hay presión del negocio', 'Hay riesgo operativo o legal', 'Hay una oportunidad que puede perderse'];
const SUPPORT_OPTIONS = ['Acceso a datos', 'Tiempo con usuarios o equipos internos', 'Sponsor', 'Aprobación para investigar', 'Prioridad en agenda', 'Apoyo de tecnología', 'Presupuesto inicial', 'Dueño del proceso', 'Feedback de un líder', 'Otro'];
const DECISION_OPTIONS = ['Aprobación para investigar', 'Feedback para enfocar mejor', 'Acceso a información', 'Conectar con stakeholders clave', 'Priorizar la iniciativa', 'Definir si vale la pena continuar', 'Conseguir sponsor'];

const ALIGNMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente de conversación' },
  { value: 'scheduled', label: 'Reunión pactada' },
  { value: 'feedback_received', label: 'Feedback recibido' },
  { value: 'aligned', label: 'Alineado para investigar' },
  { value: 'aligned_with_observations', label: 'Alineado con observaciones' },
  { value: 'not_aligned', label: 'No alineado todavía' },
  { value: 'unknown', label: 'Desconocido / por confirmar' },
] as const;
const ALIGNMENT_DECISION_OPTIONS = ['Avanzar a investigación', 'Ajustar enfoque antes de investigar', 'Buscar más respaldo', 'Buscar otro sponsor', 'Pausar por ahora', 'No hubo decisión todavía'];
const ALIGNMENT_EVIDENCE_OPTIONS = ['Nota', 'Minuta', 'Correo', 'Link', 'Archivo', 'Captura'];
const IMPORT_ALIGNMENT_OPTIONS = ['Ya fue alineada con líder/sponsor', 'Fue conversada informalmente', 'No fue alineada todavía', 'No aplica', 'Desconocido / por confirmar'];
const STEP0_ADAPTIVE_CONFIRMATION_ERROR = 'Step 0 aún no está confirmado en Adaptive Core.';

type AlignmentStatus = NonNullable<Step0Data['alignmentStatus']>;

function hasText(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(item => hasText(item));
  return typeof value === 'string' && value.trim().length > 0;
}

function isStep0DataMissingPublicFields(data?: Partial<Step0Data>): boolean {
  if (!data) return true;
  return ![
    data.initiativeTitle,
    data.quePasaQueQuieres,
    data.whyNowText,
    data.impactWho,
    data.impacta,
  ].some(hasText);
}

function appendText(current: string | undefined, value: string) {
  if (!value) return current ?? '';
  const clean = (current ?? '').trim();
  if (!clean) return value;
  return clean.includes(value) ? clean : `${clean}; ${value}`;
}

function Field({ id, label, helper, highlight, children }: { id?: string; label: string; helper?: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div id={id} className={`space-y-2 rounded-2xl transition-colors ${highlight ? 'border border-orange-300 bg-orange-50 p-4 shadow-[0_0_0_4px_rgba(251,146,60,0.16)] ring-1 ring-orange-300' : ''}`}>
      {highlight && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] text-white" style={{ fontWeight: 800 }}>
          <AlertCircle size={12} /> Campo clave pendiente
        </div>
      )}
      <div>
        <p className={`text-sm ${highlight ? 'text-orange-950' : 'text-slate-900'}`} style={{ fontWeight: 700 }}>{label}</p>
        {helper && <p className={`mt-1 text-xs ${highlight ? 'text-orange-700' : 'text-slate-500'}`}>{helper}</p>}
      </div>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className ?? ''}`} />;
}

function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${props.className ?? ''}`} />;
}

function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | '';
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(option => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-white'}`}
            style={{ fontWeight: 600 }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function QuickPickGroup({ values, options, onChange }: { values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  const toggle = (option: string) => onChange(values.includes(option) ? values.filter(item => item !== option) : [...values, option]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const selected = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${selected ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}
            style={{ fontWeight: 600 }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function getOptionLabel(options: Array<{ value: string; label: string }>, value?: string) {
  return options.find(option => option.value === value)?.label ?? value ?? '';
}

function moduleCompletedCount(form: Step0Data, moduleId: ModuleId) {
  return MODULE_REQUIRED[moduleId].filter(key => isFilled(form[key])).length;
}

function getModuleState(form: Step0Data, moduleId: ModuleId): ModuleState {
  const done = moduleCompletedCount(form, moduleId);
  if (done === MODULE_REQUIRED[moduleId].length) return 'Listo';
  if (done > 0) return 'En progreso';
  return 'No iniciado';
}

function firstMissingInModule(form: Step0Data, moduleId: ModuleId) {
  return MODULE_REQUIRED[moduleId].find(key => !isFilled(form[key])) ?? null;
}

function buildModuleSummary(form: Step0Data, moduleId: ModuleId, projectName: string) {
  if (moduleId === 'start') {
    const title = form.initiativeTitle || projectName;
    const frame = getOptionLabel(FRAME_OPTIONS, form.initiativeFrame);
    const objective = getOptionLabel(PRIMARY_OBJECTIVE_OPTIONS, form.primaryObjective);
    return [title, frame, objective].filter(Boolean).join(' · ') || 'Falta definir tipo y objetivo de negocio.';
  }
  if (moduleId === 'impact') {
    if (!isFilled(form.quePasaQueQuieres) || !isFilled(form.whyNowText)) return 'Falta describir qué está pasando y por qué importa.';
    return [form.impactWho, form.whyNowText].filter(Boolean).join(' · ');
  }
  if (!isFilled(form.evidenceType) || !isFilled(form.quienEscuchar) || !isFilled(form.decisionRequested)) {
    return 'Falta definir señales, interlocutor y decisión buscada.';
  }
  return [getOptionLabel(EVIDENCE_TYPE_OPTIONS, form.evidenceType), form.quienEscuchar, form.decisionRequested].filter(Boolean).join(' · ');
}

function buildAlignmentOutput(form: Step0Data, summaryBlocks: Array<{ label: string; value: string }>) {
  const find = (label: string) => summaryBlocks.find(block => block.label === label)?.value ?? '';
  return [
    { title: '1. Resumen de la iniciativa', value: find('Qué quiere mover') },
    { title: '2. Encaje con negocio', value: getOptionLabel(PRIMARY_OBJECTIVE_OPTIONS, form.primaryObjective) || 'Falta conectar esto con una prioridad de negocio.' },
    { title: '3. Impacto esperado', value: find('A quién impacta') },
    { title: '4. Urgencia', value: `${find('Por qué importa')}${form.ifNotNowConsequence ? ` ${form.ifNotNowConsequence}` : ''}` },
    { title: '5. Señales actuales', value: find('Qué señales existen') },
    { title: '6. Decisión que se busca', value: find('Qué decisión busca') },
    { title: '7. Próximo paso hacia investigación', value: form.validationSignal || 'En Step 1 se definirá qué evidencia, fuente o conversación hay que buscar primero.' },
    { title: '8. Conexión con Step 1', value: 'El siguiente paso será buscar evidencia, fuentes, entrevistas, señales, datos y validación más profunda.' },
  ];
}

function pendingValue(value?: string) {
  const clean = value?.trim();
  return clean ? clean : '[pendiente por completar]';
}

function getExecutiveSections(form: Step0Data) {
  return [
    { title: 'Qué se quiere mover', value: pendingValue(form.quePasaQueQuieres || form.initiativeTitle) },
    { title: 'Por qué importa ahora', value: pendingValue(form.whyNowText) },
    { title: 'A quién impacta', value: pendingValue(form.impactWho || form.impacta?.join(', ')) },
    { title: 'Qué señales existen', value: pendingValue(getOptionLabel(EVIDENCE_TYPE_OPTIONS, form.evidenceType) || form.currentEvidence) },
    { title: 'Qué decisión se busca', value: pendingValue(form.decisionRequested) },
    { title: 'Qué debería validarse en Step 1', value: pendingValue(form.validationSignal || 'Buscar evidencia, fuentes, entrevistas, señales, datos y validación más profunda.') },
  ];
}

function getAlignmentLabel(value?: AlignmentStatus) {
  return ALIGNMENT_STATUS_OPTIONS.find(option => option.value === value)?.label ?? 'Pendiente de conversación';
}

function hasImportMetadata(project: unknown) {
  const record = project as { origin?: string; source?: string; metadata?: Record<string, unknown>; importMetadata?: unknown };
  return record.origin === 'imported'
    || record.origin === 'linked_existing'
    || record.source === 'imported'
    || Boolean(record.importMetadata)
    || Boolean(record.metadata?.imported)
    || Boolean(record.metadata?.import);
}

function buildPptPrompt(form: Step0Data) {
  return `Crea una presentación breve de 3 a 5 slides para presentar esta iniciativa a un líder o sponsor. La presentación debe ser ejecutiva, clara y orientada a decisión.

Contenido de la iniciativa:
- Nombre: ${pendingValue(form.initiativeTitle)}
- Qué se quiere mover: ${pendingValue(form.quePasaQueQuieres)}
- Por qué importa ahora: ${pendingValue(form.whyNowText)}
- A quién impacta: ${pendingValue(form.impactWho || form.impacta?.join(', '))}
- Señales actuales: ${pendingValue(getOptionLabel(EVIDENCE_TYPE_OPTIONS, form.evidenceType) || form.currentEvidence)}
- Decisión que se busca: ${pendingValue(form.decisionRequested)}
- Próximo paso recomendado: ${pendingValue(form.validationSignal || 'Validar en Step 1 con evidencia, fuentes, entrevistas y datos.')}

Estructura sugerida:
Slide 1: Contexto y oportunidad/problema
Slide 2: Impacto y urgencia
Slide 3: Señales iniciales y supuestos
Slide 4: Decisión solicitada
Slide 5: Próximo paso hacia validación`;
}

function buildLeaderMessage(form: Step0Data) {
  return `Hola [nombre], estoy ordenando una iniciativa sobre ${pendingValue(form.quePasaQueQuieres || form.initiativeTitle)}.
Creo que puede ser relevante porque ${pendingValue(form.whyNowText)} e impacta principalmente a ${pendingValue(form.impactWho || form.impacta?.join(', '))}.
Me gustaría compartirte una base inicial para recibir feedback y confirmar si vale la pena avanzar a una validación más profunda.
La decisión que busco por ahora es: ${pendingValue(form.decisionRequested)}.`;
}

function OptionalToggle({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
      {open ? '- Ocultar contexto adicional' : `+ ${label}`}
    </button>
  );
}

/**
 * Contenedor de un checkpoint del Step. Envuelve las preguntas minimas del catalogo y el
 * modulo historico que le corresponde, de modo que la persona ve una sola seccion con un
 * solo estado en vez de dos bloques compitiendo por el mismo dato.
 */
function CheckpointSection({
  code,
  title,
  sequence,
  status,
  isActive,
  children,
}: {
  code: string;
  title: string;
  sequence: number;
  status: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const completed = status === 'completed';
  const locked = status === 'locked';
  const tone = isActive
    ? 'border-indigo-300 ring-1 ring-indigo-100'
    : completed
      ? 'border-emerald-200'
      : 'border-slate-200';

  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${tone}`} aria-label={`${code} ${title}`}>
      <header className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${isActive ? 'border-indigo-100 bg-indigo-50' : completed ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs ${isActive ? 'bg-indigo-600 text-white' : completed ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
            style={{ fontWeight: 800 }}
          >
            {code}
          </span>
          <div>
            <p className="text-sm text-slate-950" style={{ fontWeight: 800 }}>
              {completed ? '✓ ' : ''}{title}
            </p>
            <p className="text-xs text-slate-500">Checkpoint {sequence} de 3</p>
          </div>
        </div>
        <span className={`text-xs ${isActive ? 'text-indigo-700' : completed ? 'text-emerald-700' : 'text-slate-400'}`} style={{ fontWeight: 700 }}>
          {isActive ? 'En curso' : completed ? 'Completado' : locked ? 'Se abre al cerrar el anterior' : 'Pendiente'}
        </span>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ModuleShell({
  moduleId,
  active,
  form,
  projectName,
  onOpen,
  children,
}: {
  moduleId: ModuleId;
  active: boolean;
  form: Step0Data;
  projectName: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const state = getModuleState(form, moduleId);
  const done = moduleCompletedCount(form, moduleId);
  const total = MODULE_REQUIRED[moduleId].length;
  const complete = state === 'Listo';

  if (!active) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${complete ? 'text-emerald-700' : 'text-slate-800'}`} style={{ fontWeight: 700 }}>
              {complete ? '✓' : '○'} {complete ? `${MODULE_TITLES[moduleId]} listo` : MODULE_TITLES[moduleId]}
            </p>
            <p className="mt-1 truncate text-sm text-slate-500">{buildModuleSummary(form, moduleId, projectName)}</p>
          </div>
          <button onClick={onOpen} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" style={{ fontWeight: 600 }}>
            {complete ? 'Editar' : 'Completar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-5 ring-1 ring-indigo-100">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* El estado lo posee el checkpoint que envuelve a este modulo (CheckpointSection).
              Mostrarlo aqui reintroducia dos contadores para el mismo tramo. */}
          <p className="text-xs uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>Complementa tu contexto</p>
          <h2 className="mt-1 text-base text-slate-900" style={{ fontWeight: 700 }}>{MODULE_TITLES[moduleId]}</h2>
          <p className="mt-1 text-sm text-slate-500">{MODULE_DESCRIPTIONS[moduleId]}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function Step0Page() {
  const { projectId } = useParams();
  const { projects, projectsLoading, updateProject, updateStep0, hydrateProjectStep0FromPrefill, user } = useApp();
  const { challenges, strategicFronts } = usePortfolioLead();
  const navigate = useNavigate();
  const contextProject = projects.find(item => item.id === projectId);
  const [fetchedProject, setFetchedProject] = useState<Project | null>(null);
  const [projectFetching, setProjectFetching] = useState(false);
  const [projectFetchError, setProjectFetchError] = useState(false);
  const project = contextProject ?? fetchedProject;
  // Viewer, Sponsor o Portfolio Lead que revisa: ven la iniciativa, no la editan (el backend
  // responde 403 a sus escrituras).
  const { canEdit, readOnlyReason } = getProjectAccess(user, project);
  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [copiedAction, setCopiedAction] = useState<'ppt' | 'leader' | null>(null);
  const [showLeaderMessage, setShowLeaderMessage] = useState(false);
  const [showProposalOnePager, setShowProposalOnePager] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [showPendingWarning, setShowPendingWarning] = useState(false);
  const [recoveredFromPublicDraft, setRecoveredFromPublicDraft] = useState(false);
  const [publicDraftCardDismissed, setPublicDraftCardDismissed] = useState(false);
  const [showInitialReviewOnePager, setShowInitialReviewOnePager] = useState(false);
  const [serverAdaptiveCore, setServerAdaptiveCore] = useState<AdaptiveInitiativeCore | null>(null);
  const [adaptiveCoreStatus, setAdaptiveCoreStatus] = useState<AdaptiveCoreLoadState>('loading');
  const [checkpointSaving, setCheckpointSaving] = useState(false);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('start');
  const [optionalOpen, setOptionalOpen] = useState<Record<ModuleId, boolean>>({ start: false, impact: false, decision: false });
  const [highlightField, setHighlightField] = useState<keyof Step0Data | null>(null);
  const moduleRefs = useRef<Record<ModuleId, HTMLDivElement | null>>({ start: null, impact: null, decision: null });
  const executiveCardRef = useRef<HTMLDivElement | null>(null);
  const alignmentCardRef = useRef<HTMLDivElement | null>(null);
  const projectForInit = project ?? {
    id: '',
    name: '',
    status: 'Draft' as const,
    currentStep: 1,
    step0Status: 'No iniciado' as const,
    mentorCredits: 0,
    steps: [],
    team: [],
    evidence: [],
    createdAt: '',
    lastModified: '',
  };
  const [form, setForm] = useState<Step0Data>(() => normalizeStep0Data(project?.step0Data, projectForInit, user?.name ?? '', user?.email ?? ''));
  const saveState = useAutosave({ data: form, saveFn: async () => undefined, enabled: false });

  useEffect(() => {
    let cancelled = false;
    if (!projectId || contextProject || projectsLoading) return;
    setProjectFetching(true);
    setProjectFetchError(false);
    getById(projectId)
      .then(loaded => {
        if (!cancelled) setFetchedProject(enrichProject(loaded, user));
      })
      .catch(() => {
        if (!cancelled) setProjectFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setProjectFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contextProject, projectId, projectsLoading, user]);

  useEffect(() => {
    if (!project) return;
    setForm(normalizeStep0Data(project.step0Data, project, user?.name ?? '', user?.email ?? ''));
  }, [project, user?.email, user?.name]);

  const loadAdaptiveCore = React.useCallback(() => {
    let cancelled = false;
    setServerAdaptiveCore(null);
    setAdaptiveCoreStatus('loading');
    setCheckpointError(null);
    if (!project?.id) return () => { cancelled = true; };
    getAdaptiveCore(project.id)
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
          setCheckpointError('Estado adaptativo no disponible. Reintenta para cargar checkpoints y habilitar confirmaciones.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  // El checkpoint manda: cuando el backend devuelve respuestas confirmadas, las secciones
  // legacy de Step 0 se hidratan desde ellas. Antes cada una capturaba el dato por su
  // cuenta, asi que el usuario respondia lo mismo dos veces y los dos contadores de
  // avance de la pagina podian contradecirse.
  useEffect(() => {
    if (!serverAdaptiveCore) return;
    const confirmed: Record<string, unknown> = {
      ...(serverAdaptiveCore.confirmedResponses ?? {}),
      ...(serverAdaptiveCore.activeCheckpoint?.responses ?? {}),
    };
    const projected = projectCheckpointResponsesToFields(confirmed, CHECKPOINT_VARIABLE_TO_STEP0_FIELD);
    if (projected.length === 0) return;
    setForm(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [field, value] of projected) {
        if (next[field] !== value) {
          (next as Record<string, unknown>)[field] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // `project` va en las dependencias a proposito: el efecto de arriba resetea el
    // formulario con normalizeStep0Data cada vez que cambia la identidad del proyecto, y
    // sin esto la proyeccion del checkpoint quedaba pisada. Al declararse despues, React
    // lo ejecuta despues del reset y el checkpoint vuelve a ganar.
  }, [serverAdaptiveCore, project]);

  useEffect(() => {
    const cleanup = loadAdaptiveCore();
    return cleanup;
  }, [loadAdaptiveCore]);

  const retryAdaptiveCore = () => {
    void loadAdaptiveCore();
  };

  useEffect(() => {
    if (!projectId || !project) return;
    if (!isStep0DataMissingPublicFields(project.step0Data)) return;
    const prefill = getStep0Prefill(projectId);
    if (!prefill) return;

    const projectWithPrefill = {
      ...project,
      currentStep: 0,
      step0Status: 'En progreso' as const,
      step0Data: prefill,
    };

    hydrateProjectStep0FromPrefill(projectId, prefill);
    setForm(normalizeStep0Data(prefill, projectWithPrefill, user?.name ?? '', user?.email ?? ''));
    setRecoveredFromPublicDraft(true);
  }, [hydrateProjectStep0FromPrefill, project, projectId, user?.email, user?.name]);

  if (!project) {
    if ((projectsLoading || projectFetching) && !projectFetchError) {
      return <div className="p-6 text-slate-500">Cargando Step 0...</div>;
    }
    return <div className="p-6 text-slate-500">Proyecto no encontrado.</div>;
  }

  const mode = form.mode ?? getStep0Mode(project);
  const inherited = buildInheritedChallengeContext(project, challenges, strategicFronts);
  // Solo los campos que siguen siendo del formulario. `getRequiredFieldKeys` todavia
  // enumera los 7 que pasaron al catalogo de checkpoints, y exigirlos aqui dejaria el Step
  // imposible de cerrar porque ya no tienen input.
  // Ya no queda ningun campo obligatorio en el formulario: todo lo pregunta el catalogo de
  // checkpoints. El avance se calcula mas abajo sobre los checkpoints cerrados; calcularlo
  // aqui daba 100% con el Step recien abierto, porque los dos campos residuales que
  // quedaban venian rellenos de la revision inicial.
  const requiredKeys: Array<keyof Step0Data> = [];
  const missing: Array<keyof Step0Data> = [];
  const readyBlocks = MODULE_ORDER.filter(moduleId => getModuleState(form, moduleId) === 'Listo').length;
  const descriptionLabel = getDynamicDescriptionLabel(form.initiativeFrame ?? '', mode);
  const consequenceHelper = getConsequenceHelper(form.primaryObjective ?? '');
  const shouldShowPublicDraftCard = !publicDraftCardDismissed && !!projectId && (recoveredFromPublicDraft || hasStep0Prefill(projectId));
  const nextMissing = missing[0] ?? null;
  const nextMissingModule = MODULE_ORDER.find(moduleId => nextMissing ? MODULE_REQUIRED[moduleId].includes(nextMissing) : false) ?? activeModule;
  const previewMissing = missing.slice(0, 3);
  const readyLabels = requiredKeys.filter(key => isFilled(form[key])).slice(0, 4);
  const executiveSections = getExecutiveSections(form);
  const alignmentStatus = form.alignmentStatus;
  const alignmentStatusLabel = getAlignmentLabel(alignmentStatus);
  const alignmentIsReady = alignmentStatus === 'aligned';
  const leaderFeedbackComplete = ['feedback_received', 'approved_to_investigate', 'aligned_with_conditions', 'not_prioritized', 'not_applicable'].includes(form.leaderFeedbackStatus ?? '');
  const alignmentHasContext = Boolean(alignmentStatus && alignmentStatus !== 'pending' && alignmentStatus !== 'unknown') || leaderFeedbackComplete;
  const feedbackReceived = Boolean(form.alignmentFeedback?.trim()) || alignmentStatus === 'feedback_received' || alignmentStatus === 'aligned_with_observations';
  const isImportedInitiative = hasImportMetadata(project);
  const publicDraftContext = project.publicDraftContext;
  const rawStep0Data = (project.step0Data ?? {}) as Record<string, any>;
  const nestedInitialReview = (project.step0Data as unknown as {
    initialReview?: {
      reviewId: string;
      challengeType?: ChallengeType;
      risk?: string;
      pendingQuestions?: string[];
      nextRecommendedStep?: string;
      artifact?: InitialReviewArtifact;
    };
  } | undefined)?.initialReview;
  const flatPendingQuestions = Array.isArray(rawStep0Data.pendingQuestions)
    ? rawStep0Data.pendingQuestions
        .map((question: unknown) => typeof question === 'string'
          ? question
          : typeof question === 'object' && question !== null
            ? String((question as { question?: unknown; text?: unknown; title?: unknown }).question
              ?? (question as { text?: unknown }).text
              ?? (question as { title?: unknown }).title
              ?? '')
            : '')
        .filter(Boolean)
    : [];
  const initialReviewMeta = nestedInitialReview ?? (
    rawStep0Data.source === 'initial_review' || rawStep0Data.initialReviewSnapshotId
      ? {
          reviewId: String(rawStep0Data.initialReviewSnapshotId ?? ''),
          challengeType: rawStep0Data.challengeType as ChallengeType | undefined,
          risk: typeof rawStep0Data.mainRisk === 'string' ? rawStep0Data.mainRisk : undefined,
          pendingQuestions: flatPendingQuestions,
          nextRecommendedStep: typeof rawStep0Data.nextRecommendedStep === 'string' ? rawStep0Data.nextRecommendedStep : undefined,
        }
      : undefined
  );
  const initialReviewArtifact = initialReviewMeta?.artifact ?? null;
const adaptiveCore =
  adaptiveCoreStatus === 'loaded'
    ? serverAdaptiveCore
    : null;

const activeConfiguration = adaptiveCore
  ? getActiveStepConfiguration(adaptiveCore)
  : null;

// La configuración visible de esta página siempre debe corresponder a Step 0.
// No usamos activeStepConfigurationId porque puede apuntar a un Step posterior
// si la iniciativa ya avanzó.
const step0Configuration = adaptiveCore
  ? (
      adaptiveCore.stepConfigurations
        .filter(config => config.step === 0)
        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
      ?? activeConfiguration
    )
  : null;

const stepOutputLabel =
  step0Configuration?.expectedOutput ? outputLabel(step0Configuration.expectedOutput) : 'resultado del Step 0';

const stepVisibleName =
  step0Configuration?.visibleName ?? 'Step 0';

const activeCheckpointFromServer =
  adaptiveCore?.activeCheckpoint ?? null;
  const configuredServerCheckpoint = activeCheckpointFromServer
    ? activeConfiguration?.checkpoints.find(checkpoint => checkpoint.code === activeCheckpointFromServer.checkpointKey)
    : null;
  const activeCheckpoint = activeCheckpointFromServer
    ? {
        ...(configuredServerCheckpoint ?? activeConfiguration?.checkpoints[0]),
        id: activeCheckpointFromServer.id,
        step: activeCheckpointFromServer.step,
        code: activeCheckpointFromServer.checkpointKey,
        status: activeCheckpointFromServer.status,
        questions: activeCheckpointFromServer.questions,
      }
    : null;

const activeCheckpointQuestions =
  adaptiveCore && activeCheckpoint
    ? (
        activeCheckpointFromServer?.questions
        ?? materializeQuestionsForCheckpoint(
          adaptiveCore,
          activeCheckpoint.code,
        )
      )
    : [];

// La UI puede proyectar el estado de todos los checkpoints,
// pero únicamente desde las instancias persistidas recibidas del backend.
const checkpointSections =
  adaptiveCore && step0Configuration
    ? (step0Configuration.checkpoints ?? []).map((checkpoint, index) => {
        const instance = (adaptiveCore.checkpointInstances ?? []).find(
          (item: any) =>
            item.checkpointKey === checkpoint.code &&
            item.step === 0,
        ) as { status?: string } | undefined;

        return {
          code: checkpoint.code,
          title: checkpoint.title,
          sequence: index + 1,
          status: instance?.status ?? 'locked',
          moduleId: CHECKPOINT_TO_MODULE[checkpoint.code],
          isActive: checkpoint.code === activeCheckpoint?.code,
        };
      })
    : [];

const completedCheckpoints =
  checkpointSections.filter(
    section => section.status === 'completed',
  ).length;

// El output solo se habilita cuando el recorrido persistido está cerrado.
const canSave =
  missing.length === 0 &&
  checkpointSections.length > 0 &&
  completedCheckpoints === checkpointSections.length;

const progress = checkpointSections.length
  ? Math.round(
      (completedCheckpoints / checkpointSections.length) * 100,
    )
  : 0;

const draftStep0Brief = (adaptiveCore?.stepOutputs ?? []).find(
  (output: any) =>
    output.step === 0 &&
    output.status === 'draft',
) as
  | { id?: string; output?: Record<string, unknown> }
  | undefined;
  const leaderMessage = buildLeaderMessage(form);
  const pptPrompt = buildPptPrompt(form);

  const analysisText = ['Propuesta de iniciativa para tu líder', ...executiveSections.map(block => `${block.title}: ${block.value}`)].join('\n');
  const setField = <K extends keyof Step0Data>(key: K, value: Step0Data[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (highlightField === key) setHighlightField(null);
  };

  const scrollToModule = (moduleId: ModuleId, field?: keyof Step0Data | null) => {
    setActiveModule(moduleId);
    setHighlightField(field ?? null);
    window.setTimeout(() => {
      moduleRefs.current[moduleId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (field) document.getElementById(`step0-${String(field)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const focusFirstBlock = () => {
    setPublicDraftCardDismissed(true);
    scrollToModule('start');
  };

  const openIA = () => {
    setShowIAPanel(true);
    setIaLoading(true);
    window.setTimeout(() => setIaLoading(false), 1200);
  };

  const persistStep0 = async (overrides: Partial<Step0Data> = {}) => {
    const nextForm = { ...form, ...(adaptiveCore ? { adaptiveCore } : {}), ...overrides };
    const syncedBase = syncLegacyFields({ ...nextForm, mode });
    const synced = initialReviewMeta
      ? ({ ...syncedBase, initialReview: initialReviewMeta } as Step0Data)
      : syncedBase;
    setSaving(true);
    await new Promise(resolve => window.setTimeout(resolve, 450));
    if ((synced.initiativeTitle ?? '').trim() && synced.initiativeTitle!.trim() !== project.name.trim()) {
      updateProject(project.id, { name: synced.initiativeTitle!.trim() });
    }
    updateStep0(project.id, synced, 'Completado');
    if (Object.keys(overrides).length > 0) {
      setForm(prev => ({ ...prev, ...overrides }));
    }
    setSaving(false);
    setSaved(true);
    setAnalysisState('done');
  };

  const runAnalysis = () => {
    if (!canSave) return;
    setAnalysisState('loading');
    window.setTimeout(() => setAnalysisState('done'), 900);
  };

  const step1IsActiveInAdaptiveCore = (core: AdaptiveInitiativeCore | null | undefined) => (
    Boolean(
      core
      && canNavigateToAdaptiveStep(core, 1)
      && core.activeCheckpoint?.step === 1
      && core.activeCheckpoint?.checkpointKey === 'CP-1.1',
    )
  );

  const confirmAdaptiveStep0AndNavigate = async (overrides: Partial<Step0Data> = {}) => {
    if (!canSave) return;
    setCheckpointError(null);
    if (!projectId || adaptiveCoreStatus !== 'loaded' || !adaptiveCore) {
      setCheckpointError(STEP0_ADAPTIVE_CONFIRMATION_ERROR);
      return;
    }
    if (!draftStep0Brief?.output) {
      setCheckpointError(STEP0_ADAPTIVE_CONFIRMATION_ERROR);
      return;
    }

    setCheckpointSaving(true);
    try {
      if (!saved || Object.keys(overrides).length > 0) await persistStep0(overrides);
      const confirmedCore = await confirmStep0Brief(projectId, {
        idempotencyKey: `step0-brief-${projectId}-${draftStep0Brief.id ?? 'draft'}`,
        brief: draftStep0Brief.output,
        confirmed: true,
      });
      setServerAdaptiveCore(confirmedCore);
      setAdaptiveCoreStatus('loaded');

      let authoritativeCore = confirmedCore;
      if (!step1IsActiveInAdaptiveCore(authoritativeCore)) {
        authoritativeCore = await getAdaptiveCore(projectId);
        setServerAdaptiveCore(authoritativeCore);
        setAdaptiveCoreStatus('loaded');
      }

      if (!step1IsActiveInAdaptiveCore(authoritativeCore)) {
        setCheckpointError(STEP0_ADAPTIVE_CONFIRMATION_ERROR);
        return;
      }

      navigate(`/projects/${project.id}/step/1`);
    } catch (err: any) {
      setCheckpointError(err?.response?.data?.error?.message ?? err?.message ?? STEP0_ADAPTIVE_CONFIRMATION_ERROR);
    } finally {
      setCheckpointSaving(false);
    }
  };

  const downloadSummary = () => {
    const blob = new Blob([analysisText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starteria-step0-${project.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyPptPrompt = async () => {
    await navigator.clipboard.writeText(pptPrompt);
    setCopiedAction('ppt');
    window.setTimeout(() => setCopiedAction(null), 1600);
  };

  const copyLeaderMessage = async () => {
    await navigator.clipboard.writeText(leaderMessage);
    setCopiedAction('leader');
    window.setTimeout(() => setCopiedAction(null), 1600);
  };

  const openAlignmentCard = () => {
    window.setTimeout(() => alignmentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const requestStep1Advance = () => {
    if (!alignmentHasContext && !alignmentIsReady) {
      setShowPendingWarning(true);
      return;
    }
    void confirmAdaptiveStep0AndNavigate();
  };

  /**
   * Semilla de MIGRACION, no fuente de verdad. Las iniciativas creadas antes del core
   * adaptativo solo tienen el formulario legacy de Step 0, asi que sus variables se
   * derivan de ahi la primera vez. En cuanto el checkpoint tiene una respuesta
   * confirmada para una variable, manda el checkpoint (ver `buildCheckpointResponses`).
   */
  const legacyStep0Seed = (): Record<string, unknown> => ({
    objective: form.quePasaQueQuieres || form.initiativeTitle || project.name,
    challengeType: initialReviewMeta?.challengeType ?? form.initiativeFrame,
    scope: form.specificChallengePart || form.visibleMoment || form.impactWho,
    owner_and_actor_required: form.quienEscuchar || form.alignmentPerson || form.leaderFeedbackPerson,
    company_constraints: form.currentEvidence || form.validationSignal,
    priorityHypothesis: form.validationSignal || form.decisionRequested || form.quePasaQueQuieres,
    decisionCriteria: form.decisionRequested || form.supportNeeded || 'Definir decisión de continuidad hacia Step 1.',
    availableEvidence: form.currentEvidence,
    currentEvidence: form.currentEvidence,
    adoption: form.sponsorInterestReason,
    outcome: form.impactWho,
    missingInformation: (activeCheckpointQuestions ?? []).filter(question => question.allowsUnknown).map(question => question.prompt).join('\n'),
  });

  /**
   * Respuestas confirmadas del recorrido adaptativo (PRD-03 §17): el backend las fusiona
   * en orden cronologico y las devuelve en `confirmedResponses`. Las del checkpoint
   * activo van encima por ser las mas recientes.
   */
  const confirmedCheckpointResponses: Record<string, unknown> = {
    ...(adaptiveCore?.confirmedResponses ?? {}),
    ...(activeCheckpointFromServer?.responses ?? {}),
  };

  /**
   * El checkpoint es la fuente de verdad; el formulario legacy solo rellena los huecos
   * que el recorrido todavia no respondio. Antes era al reves —se raspaba el formulario
   * en cada render— y por eso el mismo dato quedaba capturado dos veces.
   */
  const buildCheckpointResponses = (): Record<string, unknown> => {
    if (!adaptiveCore || !activeCheckpoint) return {};
    return mergeCheckpointResponses(confirmedCheckpointResponses, legacyStep0Seed());
  };

  const confirmActiveCheckpoint = async (workspaceResponses?: Record<string, unknown>) => {
    if (!projectId || !adaptiveCore || !activeCheckpoint) {
      setCheckpointError('Estado adaptativo no disponible. Reintenta antes de confirmar checkpoints.');
      return;
    }
    setCheckpointSaving(true);
    setCheckpointError(null);
    try {
      const core = await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `step0-${projectId}-${activeCheckpoint.code}-${Date.now()}`,
        checkpointKey: activeCheckpoint.code,
        responses: { ...buildCheckpointResponses(), ...(workspaceResponses ?? {}) },
      });
      setServerAdaptiveCore(core);
      setAdaptiveCoreStatus('loaded');
    } catch (err: any) {
      const { message, core } = await explainCheckpointError(projectId, err, 'No pudimos confirmar el checkpoint.');
      if (core) setServerAdaptiveCore(core);
      setCheckpointError(message);
    } finally {
      setCheckpointSaving(false);
    }
  };

  const confirmBriefAndGoToStep1 = async () => {
    await confirmAdaptiveStep0AndNavigate();
  };

  const handlePrimaryAction = async () => {
    if (analysisState === 'done') {
      setShowProposalOnePager(true);
      return;
    }
    const missingInActive = firstMissingInModule(form, activeModule);
    if (missingInActive) {
      scrollToModule(activeModule, missingInActive);
      return;
    }
    const currentIndex = MODULE_ORDER.indexOf(activeModule);
    const nextModule = MODULE_ORDER[currentIndex + 1];
    if (nextModule) {
      scrollToModule(nextModule, firstMissingInModule(form, nextModule));
      return;
    }
    await persistStep0();
  };

  const primaryLabel = (() => {
    if (analysisState === 'done') return `Ver ${stepOutputLabel}`;
    if (firstMissingInModule(form, activeModule)) return 'Continuar este bloque';
    if (activeModule === 'start') return 'Pasar a impacto y urgencia';
    if (activeModule === 'impact') return 'Pasar a apoyo y decisión';
    return `Elaborar ${stepOutputLabel}`;
  })();

  // Se define una sola vez y se monta dentro de la seccion del checkpoint activo, para que
  // las preguntas minimas y los campos del modulo vivan en el mismo bloque.
  const checkpointWorkspace = (
    <AdaptiveCheckpointWorkspace
      embedded
      readOnly={!canEdit}
      core={adaptiveCore}
      step={0}
      checkpoint={activeCheckpointFromServer ?? activeCheckpoint}
      questions={activeCheckpointQuestions}
      initialResponses={buildCheckpointResponses()}
      outputPreview={draftStep0Brief?.output ?? null}
      saving={checkpointSaving}
      error={checkpointError}
      onConfirmCheckpoint={canEdit ? confirmActiveCheckpoint : undefined}
      onConfirmOutput={canEdit && draftStep0Brief?.output ? confirmBriefAndGoToStep1 : undefined}
      onRefresh={() => {
        if (!projectId) return;
        getAdaptiveCore(projectId)
          .then(core => {
  setServerAdaptiveCore(core as AdaptiveInitiativeCore);
  setAdaptiveCoreStatus('loaded');
})
          .catch((err: any) => {
  setServerAdaptiveCore(null);
  setAdaptiveCoreStatus('error');
  setCheckpointError(
    err?.response?.data?.error?.message
      ?? err?.message
      ?? 'No pudimos recargar el checkpoint.',
  );
})
      }}
    />
  );

  const sectionFor = (moduleId: ModuleId) => checkpointSections.find(section => section.moduleId === moduleId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-100 bg-white px-5 pb-5 pt-6">
          <div className="mx-auto max-w-[1480px]">
            <button onClick={() => navigate(`/projects/${project.id}`)} className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700">
              <ArrowLeft size={14} /> Volver al proyecto
            </button>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700" style={{ fontWeight: 700 }}>PASO 0</span>
                  <span className="text-xs text-slate-400">{progress}% completado</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {mode === 'linked_to_challenge' ? 'Iniciativa dentro de reto' : 'Proyecto independiente'}
                  </span>
                </div>
                {/* El encabezado nombra el resultado del paso, no una consigna generica:
                    lo que se construye aqui es la hipotesis que Step 1 va a validar. */}
                <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>
                  En este espacio aterrizaremos tu objetivo inicial en una hipótesis a validar
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">
                  Completa estos {checkpointSections.length} checkpoints para llegar a ella.
                  Cada uno se arma con lo que ya nos contaste, así que solo te preguntamos lo que falta.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowMentorModal(true)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <Calendar size={14} /> Pedir ayuda a un mentor
                </button>
                <AutosaveIndicator state={saveState.state} />
              </div>
            </div>

            {/* La tira de modulos vivia aqui con su propio contador (`Listo · n/3`), en
                paralelo al del checkpoint. Ahora el recorrido se lee por checkpoints. */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {checkpointSections.map(section => (
                <button
                  key={section.code}
                  onClick={() => section.moduleId && scrollToModule(section.moduleId)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                    section.isActive
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                      : section.status === 'completed'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                  style={{ fontWeight: 700 }}
                >
                  {section.status === 'completed' ? '✓ ' : ''}{section.code} · {section.title}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-500">
                {completedCheckpoints}/{checkpointSections.length} checkpoints · Output: {stepOutputLabel}
              </span>
            </div>
          </div>
        </div>

        {readOnlyReason && (
          <div className="border-b border-slate-100 bg-white px-5 py-3">
            <ReadOnlyNotice reason={readOnlyReason} className="mx-auto max-w-[1480px]" />
          </div>
        )}

        {shouldShowPublicDraftCard && canEdit && (
          <div className="border-b border-indigo-100 bg-indigo-50/60 px-5 py-4">
            <div className="mx-auto max-w-[1480px] rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-indigo-600" />
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Contexto inicial de tu propuesta</p>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                      Puedes usarlo como base y ajustarlo en este paso. No necesitas evidencia perfecta todavía; eso viene en Step 1.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={focusFirstBlock} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" style={{ fontWeight: 600 }}>Editar</button>
                  <button onClick={() => setPublicDraftCardDismissed(true)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" style={{ fontWeight: 600 }}>Mantener original</button>
                  <button
                    onClick={() => {
                      if (publicDraftContext?.suggestedTitle) setField('initiativeTitle', publicDraftContext.suggestedTitle);
                      if (publicDraftContext?.suggestedSummary) setField('quePasaQueQuieres', publicDraftContext.suggestedSummary);
                      focusFirstBlock();
                    }}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white"
                    style={{ fontWeight: 600 }}
                  >
                    Aplicar versión sugerida
                  </button>
                </div>
              </div>
              {publicDraftContext && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Texto original</p>
                    <p className="mt-2 text-sm leading-5 text-slate-700">{publicDraftContext.originalText}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-500">Versión sugerida por Starteria</p>
                    <p className="mt-2 text-sm leading-5 text-slate-800">
                      {publicDraftContext.suggestedSummary || form.quePasaQueQuieres || 'Starteria no agregó datos nuevos; solo usó lo que escribiste como punto de partida.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {initialReviewMeta && (
          /* Antes era un bloque grande que empujaba los checkpoints fuera de pantalla. El
             valor real esta en el one-pager, asi que aqui queda solo una linea y el detalle
             se abre en modal. */
          <div className="border-b border-indigo-100 bg-indigo-50/60 px-5 py-2.5">
            <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-3">
              <CheckCircle2 size={15} className="shrink-0 text-indigo-600" />
              <p className="text-sm text-slate-700">
                Partimos de tu revisión inicial.
              </p>
              {initialReviewMeta.challengeType && (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-indigo-700 ring-1 ring-indigo-100" style={{ fontWeight: 700 }}>
                  {CHALLENGE_TYPE_LABELS[initialReviewMeta.challengeType]}
                </span>
              )}
              {initialReviewMeta.risk && (
                <span className="truncate text-xs text-amber-800" title={initialReviewMeta.risk}>
                  Riesgo a cuidar: {initialReviewMeta.risk}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowInitialReviewOnePager(true)}
                className="ml-auto rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                style={{ fontWeight: 700 }}
              >
                Ver one-pager inicial
              </button>
            </div>
          </div>
        )}

{!adaptiveCore && (
  <div className="border-b border-slate-200 bg-white px-5 py-5">
    <div className="mx-auto max-w-[1480px]">
      <div
        role={adaptiveCoreStatus === 'error' ? 'alert' : 'status'}
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <p className="font-semibold">
          Estado adaptativo no disponible
        </p>

        <p className="mt-1">
          {adaptiveCoreStatus === 'loading'
            ? 'Cargando checkpoints persistidos desde backend. Las confirmaciones quedan bloqueadas mientras carga.'
            : checkpointError
              ?? 'No pudimos cargar checkpoints persistidos. Las confirmaciones quedan bloqueadas.'}
        </p>

        {adaptiveCoreStatus === 'error' && (
          <button
            type="button"
            onClick={retryAdaptiveCore}
            className="mt-3 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm text-amber-900 hover:bg-amber-100"
            style={{ fontWeight: 800 }}
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  </div>
)}

{adaptiveCore && activeCheckpoint && (
        <div className="hidden">
          <div className="mx-auto max-w-[1480px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 800 }}>CHECKPOINT ACTIVO</p>
                <h2 className="mt-1 text-base text-slate-950" style={{ fontWeight: 800 }}>{activeCheckpoint.code} - {activeCheckpoint.title}</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">{activeCheckpoint.purpose}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Resultado</p>
                <p className="mt-1 text-sm text-slate-900" style={{ fontWeight: 700 }}>{outputLabel(activeCheckpoint.outputKey)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Ruta</p>
                <p className="mt-1 text-sm text-slate-900">{routeTypeLabel(adaptiveCore.masterContext.routeType)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Profundidad</p>
                <p className="mt-1 text-sm text-slate-900">{depthLevelLabel(adaptiveCore.masterContext.depthLevel)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Preguntas</p>
                <p className="mt-1 text-sm text-slate-900">{activeCheckpointQuestions.length} para este checkpoint</p>
              </div>
            </div>
            {activeCheckpointQuestions.length > 0 && (
              <div className="mt-4 grid gap-2">
                {activeCheckpointQuestions.slice(0, 3).map(question => (
                  <div key={question.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{question.prompt}</p>
                    <p className="mt-1 text-xs text-slate-500">{question.reason}</p>
                    {question.contextDerived && (
                      <p className="mt-1 text-xs text-amber-700">Deriva del contexto y debe confirmarse antes de tratarse como restricción.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {checkpointError && <p className="mt-3 text-sm text-rose-600">{checkpointError}</p>}
            {canEdit && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void confirmActiveCheckpoint()}
                disabled={checkpointSaving || activeCheckpoint.status === 'completed'}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                style={{ fontWeight: 700 }}
              >
                {checkpointSaving ? 'Confirmando...' : 'Confirmar checkpoint'}
              </button>
              {draftStep0Brief?.output && (
                <button
                  type="button"
                  onClick={confirmBriefAndGoToStep1}
                  disabled={checkpointSaving}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ fontWeight: 700 }}
                >
                  Confirmar Brief y configurar Step 1
                </button>
              )}
            </div>
            )}
            {draftStep0Brief?.output && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3">
                <p className="text-xs text-emerald-700" style={{ fontWeight: 800 }}>BRIEF STEP 0 EN REVISIÓN</p>
                <p className="mt-2 text-sm text-slate-700">Hipótesis: {String((draftStep0Brief.output as any).priorityHypothesis ?? 'Pendiente')}</p>
                <p className="mt-1 text-sm text-slate-700">Criterio de decisión: {String((draftStep0Brief.output as any).decisionCriteria ?? 'Pendiente')}</p>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="mx-auto grid max-w-[1480px] items-start gap-6 px-5 py-6 min-[1280px]:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {mode === 'linked_to_challenge' && inherited.items.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Contexto heredado del reto</h2>
                <p className="mt-1 text-sm text-slate-500">Este contexto viene del reto padre y se muestra solo como ancla.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {inherited.items.slice(0, 6).map(item => (
                    <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{item.label}</p>
                      <p className="mt-2 text-sm text-slate-800" style={{ fontWeight: 600 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={node => { moduleRefs.current.start = node; }}>
              <CheckpointSection
                code={sectionFor('start')?.code ?? 'CP-0.1'}
                title={sectionFor('start')?.title ?? 'Enmarcar la iniciativa'}
                sequence={sectionFor('start')?.sequence ?? 1}
                status={sectionFor('start')?.status ?? 'locked'}
                isActive={Boolean(sectionFor('start')?.isActive)}
              >
                {sectionFor('start')?.isActive && checkpointWorkspace}
              </CheckpointSection>
            </div>

            <div ref={node => { moduleRefs.current.impact = node; }}>
              <CheckpointSection
                code={sectionFor('impact')?.code ?? 'CP-0.2'}
                title={sectionFor('impact')?.title ?? 'Aterrizar condiciones reales'}
                sequence={sectionFor('impact')?.sequence ?? 2}
                status={sectionFor('impact')?.status ?? 'locked'}
                isActive={Boolean(sectionFor('impact')?.isActive)}
              >
                {sectionFor('impact')?.isActive && checkpointWorkspace}
              </CheckpointSection>
            </div>

            <div ref={node => { moduleRefs.current.decision = node; }}>
              <CheckpointSection
                code={sectionFor('decision')?.code ?? 'CP-0.3'}
                title={sectionFor('decision')?.title ?? 'Definir qué validar o decidir'}
                sequence={sectionFor('decision')?.sequence ?? 3}
                status={sectionFor('decision')?.status ?? 'locked'}
                isActive={Boolean(sectionFor('decision')?.isActive)}
              >
                {sectionFor('decision')?.isActive && checkpointWorkspace}
              </CheckpointSection>
            </div>

            {checkpointError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p style={{ fontWeight: 800 }}>{checkpointError}</p>
                <button
                  type="button"
                  onClick={retryAdaptiveCore}
                  className="mt-3 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm text-rose-700 hover:bg-rose-100"
                  style={{ fontWeight: 700 }}
                >
                  Recargar estado adaptativo
                </button>
              </div>
            )}

            {analysisState !== 'done' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Output de este paso</h2>
                <p className="mt-1 text-sm text-slate-500">Cuando completes los campos clave, podrás elaborar el output de este paso: {stepOutputLabel}.</p>
                {canEdit && (
                  <button onClick={runAnalysis} disabled={!canSave} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ fontWeight: 600 }}>
                    <Sparkles size={14} className="mr-2 inline" />Elaborar {stepOutputLabel}
                  </button>
                )}
              </div>
            )}

            {analysisState === 'loading' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                <Loader2 size={28} className="mx-auto mb-3 animate-spin text-indigo-500" />Elaborando {stepOutputLabel}...
              </div>
            )}

            {analysisState === 'done' && (
              <>
                <div ref={executiveCardRef} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-emerald-600" style={{ fontWeight: 700 }}>{stepOutputLabel}</p>
                      <h2 className="mt-1 text-lg text-slate-900" style={{ fontWeight: 700 }}>Ya tienes el output de este paso: {stepVisibleName}</h2>
                      <p className="mt-1 max-w-2xl text-sm text-slate-500">Úsala para conversar con tu jefe, gerente, sponsor o persona con poder de decisión mientras avanzas a buscar evidencia.</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700" style={{ fontWeight: 700 }}>Artefacto listo</span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      {executiveSections.map(section => (
                        <div key={section.title} className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 700 }}>{section.title}</p>
                          <p className="mt-2 text-sm text-slate-800">{section.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                    <p className="text-sm text-indigo-900" style={{ fontWeight: 700 }}>Tu iniciativa ya tiene base para abrir conversación</p>
                    <p className="mt-1 text-sm text-indigo-700">Ahora el siguiente paso es validar si el dolor, oportunidad o apuesta tiene respaldo real.</p>
                    <ul className="mt-3 grid gap-2 text-xs text-indigo-800 md:grid-cols-2">
                      <li>¿Qué tan frecuente o importante es este reto?</li>
                      <li>¿Quiénes lo viven directamente?</li>
                      <li>¿Qué datos o señales lo confirman?</li>
                      <li>¿Qué causa o hipótesis puede estar detrás?</li>
                      <li>¿Qué tan viable es avanzar?</li>
                    </ul>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => setShowProposalOnePager(true)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white" style={{ fontWeight: 600 }}>Ver propuesta</button>
                    {canEdit && <button onClick={requestStep1Advance} disabled={checkpointSaving} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60" style={{ fontWeight: 700 }}>Avanzar a Step 1</button>}
                    <button onClick={() => setShowPromptPreview(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600" style={{ fontWeight: 600 }}><Copy size={14} className="mr-2 inline" />Copiar prompt para PPT/Gamma</button>
                    <button onClick={downloadSummary} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600" style={{ fontWeight: 600 }}><Download size={14} className="mr-2 inline" />Descargar propuesta</button>
                    <button onClick={() => setShowLeaderMessage(prev => !prev)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600" style={{ fontWeight: 600 }}>Preparar mensaje para líder</button>
                  </div>

                  {showLeaderMessage && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Mensaje para líder</p>
                        <button onClick={copyLeaderMessage} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600" style={{ fontWeight: 600 }}>{copiedAction === 'leader' ? 'Copiado' : 'Copiar mensaje'}</button>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{leaderMessage}</p>
                    </div>
                  )}
                </div>

                <div ref={alignmentCardRef}>
                  <LeaderFeedbackStatusCard project={{ ...project, step0Data: form }} updateProject={(id, updates) => {
                    updateProject(id, updates);
                    if (updates.step0Data) setForm(prev => ({ ...prev, ...updates.step0Data }));
                  }} variant="step0" />
                </div>
                <div className="hidden rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base text-slate-900" style={{ fontWeight: 700 }}>
                        {isImportedInitiative ? 'Alineación previa de esta iniciativa' : 'Alineación con líder o sponsor'}
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm text-slate-500">
                        {isImportedInitiative
                          ? 'Esta iniciativa puede haber avanzado antes de entrar a Starteria. Registra si ya tuvo respaldo, feedback o revisión de un líder.'
                          : 'Registra si esta base ya fue conversada, enviada o revisada por una persona con poder de decisión.'}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600" style={{ fontWeight: 700 }}>{alignmentStatusLabel}</span>
                  </div>

                  {form.alignmentAdvancedPending && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Avanzaste a Step 1 con alineación pendiente.
                    </div>
                  )}

                  {isImportedInitiative && (
                    <div className="mt-5">
                      <p className="mb-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>Estado previo conocido</p>
                      <QuickPickGroup values={form.alignmentEvidenceType ? [form.alignmentEvidenceType] : []} options={IMPORT_ALIGNMENT_OPTIONS} onChange={values => setField('alignmentEvidenceType', values[values.length - 1] ?? '')} />
                    </div>
                  )}

                  <div className="mt-5 space-y-5">
                    <Field label="Estado de alineación">
                      <ChoiceGroup value={alignmentStatus ?? ''} options={[...ALIGNMENT_STATUS_OPTIONS]} onChange={value => setField('alignmentStatus', value)} />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="¿Con quién lo conversarás o conversaste?">
                        <Input value={form.alignmentPerson ?? ''} onChange={event => setField('alignmentPerson', event.target.value)} />
                      </Field>
                      <Field label="Cargo o área">
                        <Input value={form.alignmentRoleArea ?? ''} onChange={event => setField('alignmentRoleArea', event.target.value)} />
                      </Field>
                    </div>
                    <Field label="Fecha de conversación o reunión">
                      <Input type="date" value={form.alignmentDate ?? ''} onChange={event => setField('alignmentDate', event.target.value)} />
                    </Field>
                    <Field label="¿Qué feedback, observación o condición dejó?">
                      <Area rows={4} value={form.alignmentFeedback ?? ''} onChange={event => setField('alignmentFeedback', event.target.value)} />
                    </Field>
                    <Field label="¿Qué decisión inicial se obtuvo?">
                      <QuickPickGroup values={form.alignmentInitialDecision ? [form.alignmentInitialDecision] : []} options={ALIGNMENT_DECISION_OPTIONS} onChange={values => setField('alignmentInitialDecision', values[values.length - 1] ?? '')} />
                    </Field>
                    <Field label="Evidencia de conversación, opcional" helper="Puedes registrar una nota, minuta, correo, link, archivo o captura. No se exige subir evidencia en Step 0.">
                      <div className="space-y-3">
                        <QuickPickGroup values={form.alignmentEvidenceType && !IMPORT_ALIGNMENT_OPTIONS.includes(form.alignmentEvidenceType) ? [form.alignmentEvidenceType] : []} options={ALIGNMENT_EVIDENCE_OPTIONS} onChange={values => setField('alignmentEvidenceType', values[values.length - 1] ?? '')} />
                        <Area rows={3} value={form.alignmentEvidenceNote ?? ''} onChange={event => setField('alignmentEvidenceNote', event.target.value)} placeholder="Pega una nota, resumen o link si ya lo tienes." />
                      </div>
                    </Field>
                    <div className={canEdit ? 'flex flex-wrap gap-3' : 'hidden'}>
                      <button onClick={() => persistStep0()} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white" style={{ fontWeight: 600 }}>Guardar alineación</button>
                      <button onClick={requestStep1Advance} disabled={checkpointSaving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-60" style={{ fontWeight: 600 }}>Ir a Step 1 con este contexto</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="hidden min-[1280px]:block">
            <div className="sticky top-4 max-h-[calc(100vh-120px)] space-y-3 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{stepOutputLabel}</p>
                {analysisState === 'done' ? (
                  <>
                    <p className="mt-1 text-sm text-slate-500">Base lista. Compártela con tu líder o registra una conversación antes de avanzar a Step 1.</p>
                    <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">Base generada</span>
                        <span className="text-emerald-700" style={{ fontWeight: 700 }}>Lista</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">Feedback del líder</span>
                        <span className={alignmentIsReady ? 'text-emerald-700' : 'text-amber-700'} style={{ fontWeight: 700 }}>{alignmentStatusLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">Feedback</span>
                        <span className={feedbackReceived ? 'text-emerald-700' : 'text-slate-500'} style={{ fontWeight: 700 }}>{feedbackReceived ? 'Recibido' : 'Pendiente'}</span>
                      </div>
                    </div>
                    <button onClick={() => setShowProposalOnePager(true)} className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs text-white" style={{ fontWeight: 600 }}>
                      Ver propuesta
                    </button>
                  </>
                ) : (
                  <>
                    {/* El rail tenia su propio recuento de faltantes ("Te faltan N datos
                        clave", SIGUIENTE FALTANTE, LO QUE YA TENEMOS, Modulos listos n/3),
                        que contradecia al del checkpoint. Ahora refleja el recorrido. */}
                    <p className="mt-1 text-sm text-slate-500">
                      Se construye al cerrar los tres checkpoints de este paso.
                    </p>
                    <div className="mt-4 space-y-2">
                      {checkpointSections.map(section => (
                        <div key={section.code} className="flex items-start gap-2 text-xs">
                          <span className={section.status === 'completed' ? 'text-emerald-600' : section.isActive ? 'text-indigo-600' : 'text-slate-300'} style={{ fontWeight: 800 }}>
                            {section.status === 'completed' ? '✓' : section.isActive ? '▶' : '○'}
                          </span>
                          <span className={section.status === 'completed' ? 'text-emerald-700' : section.isActive ? 'text-indigo-800' : 'text-slate-500'}>
                            {section.code} · {section.title}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                        <span>Checkpoints cerrados</span>
                        <span className="text-indigo-600" style={{ fontWeight: 700 }}>{completedCheckpoints}/{checkpointSections.length}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${checkpointSections.length ? (completedCheckpoints / checkpointSections.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
              {canEdit && (
                <>
                  <button onClick={openIA} className="w-full rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-left text-sm text-violet-700 hover:bg-violet-100" style={{ fontWeight: 600 }}><Sparkles size={14} className="mr-2 inline" />Hacerlo más claro sin inventar</button>
                  <p className="text-xs text-slate-500">La IA puede mejorar redacción y estructura, pero no agregará evidencia que no hayas dado.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-3">
          {canEdit && (
          <button onClick={handlePrimaryAction} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ fontWeight: 600 }}>
            {saving ? 'Guardando...' : <>{primaryLabel} <ChevronRight size={14} className="ml-1 inline" /></>}
          </button>
          )}
          {canEdit && analysisState === 'done' && (
            <button onClick={requestStep1Advance} disabled={checkpointSaving} className="rounded-xl border border-indigo-200 px-4 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60" style={{ fontWeight: 700 }}>
              Avanzar a Step 1
            </button>
          )}
          {canEdit && <button onClick={openIA} className="rounded-xl border border-violet-200 px-4 py-2.5 text-sm text-violet-600" style={{ fontWeight: 600 }}><Sparkles size={14} className="mr-2 inline" />Hacerlo más claro sin inventar</button>}
          {/* PRD-03 §6 (Zona 4): un unico CTA contextual. El aviso "Te falta 1 campo clave"
              era un cuarto contador de faltantes; el que manda es el del checkpoint. */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {activeCheckpoint ? (
              <>
                <span style={{ fontWeight: 800 }}>{activeCheckpoint.code}</span>
                <span>{activeCheckpoint.title ?? ''}</span>
                <span className="text-slate-400">·</span>
                <span>{completedCheckpoints}/{checkpointSections.length} cerrados</span>
              </>
            ) : (
              <span style={{ fontWeight: 800 }}>Checkpoint bloqueado hasta cargar el estado adaptativo</span>
            )}
          </div>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            {project.mentorCredits !== undefined && <div className="flex items-center gap-1.5 text-xs text-slate-400"><CreditCard size={12} /><span>{project.mentorCredits} créditos disponibles</span></div>}
            <AutosaveIndicator state={saveState.state} />
          </div>
        </div>
      </div>

      {showProposalOnePager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-emerald-600" style={{ fontWeight: 800 }}>{stepOutputLabel}</p>
                <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 800 }}>{form.initiativeTitle || project.name}</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">One-pager para abrir conversación, pedir feedback y decidir si vale la pena investigar con más profundidad.</p>
              </div>
              <button onClick={() => setShowProposalOnePager(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar propuesta">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {executiveSections.map(section => (
                    <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 800 }}>{section.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-800">{section.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.8fr]">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-sm text-indigo-950" style={{ fontWeight: 800 }}>Conversación sugerida</p>
                  <p className="mt-2 text-sm leading-relaxed text-indigo-900">
                    Presenta la iniciativa como una hipótesis ordenada, no como una solución cerrada. Pide feedback sobre prioridad, restricciones y qué evidencia conviene buscar primero.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-950" style={{ fontWeight: 800 }}>Decisión que quieres abrir</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{pendingValue(form.decisionRequested)}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button onClick={() => setShowProposalOnePager(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600" style={{ fontWeight: 700 }}>Cerrar</button>
                <button onClick={() => { void navigator.clipboard.writeText(analysisText); }} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white" style={{ fontWeight: 700 }}><Copy size={14} className="mr-2 inline" />Copiar propuesta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPromptPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-[#151515] shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400" style={{ fontWeight: 800 }}>Vista previa del prompt</p>
                <h2 className="mt-1 text-base text-white" style={{ fontWeight: 800 }}>Prompt para PPT/Gamma/Canva</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyPptPrompt} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15" style={{ fontWeight: 700 }}>
                  <Copy size={14} className="mr-1 inline" />{copiedAction === 'ppt' ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={() => setShowPromptPreview(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white/10" aria-label="Cerrar prompt">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-7 text-white">{pptPrompt}</pre>
            </div>
          </div>
        </div>
      )}

      {showPendingWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-50 p-2 text-amber-600"><AlertCircle size={18} /></div>
              <div>
                <h2 className="text-base text-slate-900" style={{ fontWeight: 700 }}>Feedback del sponsor pendiente</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Puedes avanzar a Step 1 y seguir trabajando. Todavía no has registrado el resultado del feedback del sponsor o líder; cuando lo tengas, súbelo para ajustar la validación y mantener la iniciativa alineada al negocio.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button onClick={() => { setShowPendingWarning(false); openAlignmentCard(); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600" style={{ fontWeight: 600 }}>Registrar feedback ahora</button>
              <button onClick={() => { setShowPendingWarning(false); void confirmAdaptiveStep0AndNavigate({ alignmentStatus: 'pending', alignmentAdvancedPending: true, leaderFeedbackStatus: form.leaderFeedbackStatus ?? 'pending' }); }} disabled={checkpointSaving} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ fontWeight: 600 }}>Avanzar a Step 1</button>
            </div>
          </div>
        </div>
      )}

      {/* Sin artefacto, el boton navegaba a /initial-reviews/:id y esa ruta no existe en el
          router, asi que reventaba. Ahora siempre abre modal: con el one-pager si esta, y
          si no con lo que si tenemos de la revision inicial. */}
      {showInitialReviewOnePager && !initialReviewArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-indigo-500" style={{ fontWeight: 800 }}>Revisión inicial</p>
                <h2 className="mt-1 text-lg text-slate-950" style={{ fontWeight: 800 }}>{form.initiativeTitle || project.name}</h2>
              </div>
              <button onClick={() => setShowInitialReviewOnePager(false)} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[72vh] space-y-3 overflow-y-auto p-5">
              {initialReviewMeta?.challengeType && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Tipo de reto</p>
                  <p className="mt-2 text-sm text-slate-800">{CHALLENGE_TYPE_LABELS[initialReviewMeta.challengeType]}</p>
                </div>
              )}
              {initialReviewMeta?.risk && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-amber-600">Riesgo a cuidar</p>
                  <p className="mt-2 text-sm leading-5 text-amber-900">{initialReviewMeta.risk}</p>
                </div>
              )}
              {(initialReviewMeta?.pendingQuestions?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">Pendiente para completar</p>
                  <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-700">
                    {initialReviewMeta?.pendingQuestions?.map(question => <li key={question}>• {question}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">
                El one-pager completo no está disponible para esta iniciativa; esto es lo que quedó registrado en la revisión inicial.
              </p>
            </div>
          </div>
        </div>
      )}

      {showInitialReviewOnePager && initialReviewArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-indigo-500" style={{ fontWeight: 800 }}>One-pager inicial</p>
                <h2 className="mt-1 text-lg text-slate-950" style={{ fontWeight: 800 }}>{initialReviewArtifact.onePager.title}</h2>
                <p className="mt-1 text-sm text-slate-500">Este artefacto fue usado para crear la iniciativa. Step 0 sigue editable.</p>
              </div>
              <button onClick={() => setShowInitialReviewOnePager(false)} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Cerrar one-pager">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-5">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Que quiere mover', initialReviewArtifact.onePager.whatToMove],
                  ['Tipo de reto', CHALLENGE_TYPE_LABELS[initialReviewArtifact.onePager.challengeType]],
                  ['Por qué importa ahora', initialReviewArtifact.onePager.whyNow],
                  ['A quién impacta', initialReviewArtifact.onePager.impactedAudience],
                  ['Evidencia inicial disponible', initialReviewArtifact.onePager.initialEvidence],
                  ['Riesgo principal', initialReviewArtifact.onePager.mainRisk],
                  ['Ruta recomendada', initialReviewArtifact.onePager.recommendedRoute],
                  ['Siguiente paso', initialReviewArtifact.onePager.nextStep],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 800 }}>{label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.08em] text-amber-700" style={{ fontWeight: 800 }}>Preguntas pendientes</p>
                {initialReviewArtifact.onePager.pendingQuestions.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                    {initialReviewArtifact.onePager.pendingQuestions.map(question => <li key={question}>- {question}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-amber-900">Sin preguntas pendientes registradas.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <MentorVirtualPanel open={showIAPanel} onClose={() => setShowIAPanel(false)} context={`Paso 0 · ${stepOutputLabel}`} feedback={IA_FEEDBACK} loading={iaLoading} />
      {showMentorModal && <MentorSupportModal onClose={() => setShowMentorModal(false)} context={`Paso 0 · ${stepOutputLabel}`} mentorCredits={project.mentorCredits ?? 3} onOpenIA={() => { setShowMentorModal(false); openIA(); }} />}
    </div>
  );
}
