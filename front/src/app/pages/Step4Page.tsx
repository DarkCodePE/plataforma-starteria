import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Lock,
  Mail,
  MessageSquare,
  Mic,
  MoveRight,
  Paperclip,
  Play,
  Presentation,
  Sparkles,
  Target,
  Users,
  Video,
} from 'lucide-react';
import { enrichProject, type Project, useApp } from '../context/AppContext';
import { getProjectAccess } from '../authz/projectAccess';
import { ReadOnlyNotice } from '../components/ReadOnlyNotice';
import { StatusChip } from '../components/StatusChip';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';
import { ApprovalGateBanner } from '../components/autofill/ApprovalGateBanner';
import { isPdfAutofillEnabled } from '../services/featureFlags';
import * as stepService from '../services/stepService';
import { getById } from '../services/projectService';
import { LeaderFeedbackStatusCard } from '../components/LeaderFeedbackStatusCard';
import { AdaptiveCheckpointWorkspace } from '../../features/adaptive-core/components';
import { confirmAdaptiveCheckpoint, explainCheckpointError, confirmStep4Output, getAdaptiveCore } from '../../features/adaptive-core/services/adaptiveCoreService';
import { canNavigateToAdaptiveStep } from '../../features/adaptive-core/domain/adaptiveAuthority';

type ModuleId = 'overview' | 'A' | 'B' | 'C';
type Audiencia =
  | 'Sponsor'
  | 'Gerencia'
  | 'Comite'
  | 'Equipo operativo'
  | 'Area duena';
type MeetingGoal =
  | 'Pedir aprobacion'
  | 'Pedir recursos'
  | 'Alinear responsables'
  | 'Definir siguiente experimento'
  | 'Compartir aprendizajes';
type DecisionValue = 'Go' | 'Iterar' | 'Pivote' | 'No-Go' | null;
type ClosureType =
  | 'Implementar / mantener'
  | 'Iterar'
  | 'Pivotear'
  | 'Solo aprendizajes';
type MeetingOutcome =
  | 'Aprobar implementacion'
  | 'Aprobar siguiente experimento'
  | 'Alinear ownership'
  | 'Escalar a sponsor o comite'
  | 'Cerrar con aprendizajes';
type PresentationKey =
  | 'problem'
  | 'urgency'
  | 'evidence'
  | 'proposal'
  | 'solutionComponents'
  | 'usageFlow'
  | 'tests'
  | 'results'
  | 'recommendation'
  | 'orgNeeds'
  | 'orgRisks'
  | 'nextStep';
type MentorDecision =
  | 'Pendiente'
  | 'Aprobado para presentar'
  | 'Ajustar antes de presentar'
  | 'Reensayar'
  | 'No listo aun';
type NextStepType =
  | 'Reunion con sponsor'
  | 'Presentacion a gerencia'
  | 'Demo Day'
  | 'Solo dejar recomendacion / aprendizajes';
type MeetingStatus = 'Pendiente' | 'Invitado' | 'Agendado' | 'Confirmado';
type PdfState = 'none' | 'uploaded' | 'analyzed';

interface DemoItem {
  id: string;
  type: 'Link demo' | 'Video' | 'Capturas' | 'Registro de uso';
  url: string;
  proof: string;
  supports: string;
  usedIn: string;
}

interface EvidenceItem {
  id: string;
  title: string;
  source: string;
  selected: boolean;
  proves: string;
  supportsDecision: string;
  usedIn: string;
}

interface PlanRow {
  id: string;
  stage: string;
  activity: string;
  owner: string;
  area: string;
  timing: string;
  dependency: string;
  expectedResult: string;
}

const AUDIENCES: Audiencia[] = [
  'Sponsor',
  'Gerencia',
  'Comite',
  'Equipo operativo',
  'Area duena',
];

const MEETING_GOALS: MeetingGoal[] = [
  'Pedir aprobacion',
  'Pedir recursos',
  'Alinear responsables',
  'Definir siguiente experimento',
  'Compartir aprendizajes',
];

const CLOSURE_TYPES: ClosureType[] = [
  'Implementar / mantener',
  'Iterar',
  'Pivotear',
  'Solo aprendizajes',
];

const MEETING_OUTCOMES: MeetingOutcome[] = [
  'Aprobar implementacion',
  'Aprobar siguiente experimento',
  'Alinear ownership',
  'Escalar a sponsor o comite',
  'Cerrar con aprendizajes',
];

const DECISION_VALUES: Exclude<DecisionValue, null>[] = ['Go', 'Iterar', 'Pivote', 'No-Go'];

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

const PRESENTATION_SECTIONS: Array<{
  key: PresentationKey;
  title: string;
  help: string;
}> = [
  {
    key: 'problem',
    title: '1. Problema / oportunidad',
    help: 'Explica el problema validado y a quien afecta. Debe poder entenderse sin contexto previo.',
  },
  {
    key: 'urgency',
    title: '2. Por que importa ahora',
    help: 'Conecta el problema con negocio, operacion o experiencia del usuario.',
  },
  {
    key: 'evidence',
    title: '3. Evidencia y datos de impacto',
    help: 'Resume la evidencia principal y los datos que sostienen tu mensaje.',
  },
  {
    key: 'proposal',
    title: '4. Que propusimos / que disenamos',
    help: 'Describe la apuesta del equipo y por que valia la pena probarla.',
  },
  {
    key: 'solutionComponents',
    title: '5. Componentes clave de la solucion',
    help: 'Enumera lo minimo que la organizacion debe entender para decidir.',
  },
  {
    key: 'usageFlow',
    title: '6. Como se usa / como funciona',
    help: 'Describe el flujo de uso para que la demo tenga sentido.',
  },
  {
    key: 'tests',
    title: '7. Que probamos',
    help: 'Aclara alcance, muestra, criterio de exito y forma de validar.',
  },
  {
    key: 'results',
    title: '8. Que resultados o aprendizajes obtuvimos',
    help: 'Muestra resultados y tambien lo que no funciono.',
  },
  {
    key: 'recommendation',
    title: '9. Que recomendamos ahora',
    help: 'Conecta hallazgos, decision y recomendacion ejecutiva.',
  },
  {
    key: 'orgNeeds',
    title: '10. Que necesitamos de la organizacion',
    help: 'Pide recursos, owners o habilitadores de forma concreta.',
  },
  {
    key: 'orgRisks',
    title: '11. Riesgos o consideraciones organizacionales',
    help: 'Explica que podria frenar la implementacion o la siguiente validacion.',
  },
  {
    key: 'nextStep',
    title: '12. Proximo paso concreto',
    help: 'Cierra con una accion puntual, fecha y responsable esperado.',
  },
];

const DEFAULT_PRESENTATION: Record<PresentationKey, string> = {
  problem:
    'El alta de accesos para nuevos ingresos tarda entre 7 y 21 dias porque RRHH y TI operan con solicitudes dispersas y sin SLA visible.',
  urgency:
    'Hoy esto retrasa la incorporacion, genera horas manuales de seguimiento y deja una primera experiencia pobre para la persona que ingresa.',
  evidence:
    'En Steps 1 a 3 confirmamos el problema con entrevistas, tiempos reales y un piloto con 5 casos; 4 de 5 se resolvieron en menos de 24 horas.',
  proposal:
    'Propusimos un flujo unico de solicitud con formulario digital, trazabilidad compartida y un disparador claro para TI.',
  solutionComponents:
    'La solucion combina formulario unico, hoja de seguimiento visible, responsables definidos y criterio para separar casos especiales.',
  usageFlow:
    'RRHH activa la solicitud, TI recibe el requerimiento estandarizado y el equipo hace seguimiento con una sola fuente de verdad.',
  tests:
    'Probamos el flujo en un piloto controlado con 5 ingresos, midiendo tiempo de activacion, fricciones y percepcion del usuario.',
  results:
    'El piloto alcanzo 80% de casos resueltos en menos de 24 horas. El principal aprendizaje fue que los casos especiales requieren un camino aparte.',
  recommendation:
    'Recomendamos pasar a una implementacion acotada con reglas claras para casos especiales y responsables por area.',
  orgNeeds:
    'Necesitamos owner operativo, acuerdo de servicio con TI y tiempo de coordinacion con RRHH para escalar sin perder trazabilidad.',
  orgRisks:
    'Si no se define un owner y un manejo de excepciones, la iniciativa puede verse bien en el deck pero trabarse en operacion.',
  nextStep:
    'Cerrar validacion final con mentor, alinear sponsor y confirmar la reunion donde se movera la decision.',
};

const DEFAULT_EVIDENCE: EvidenceItem[] = [];

const DEFAULT_DEMOS: DemoItem[] = [];

const IMPLEMENTATION_ROWS: PlanRow[] = [];

const ITERATION_ROWS: PlanRow[] = [];

const PIVOT_ROWS: PlanRow[] = [];

const LEARNING_ROWS: PlanRow[] = [
  {
    id: 'lr-1',
    stage: 'Aprendizaje',
    activity: 'Documentar que no funciono y que condiciones faltaron para sostener la propuesta.',
    owner: 'Equipo del proyecto',
    area: 'Proyecto',
    timing: 'Semana 1',
    dependency: 'Cierre con mentor',
    expectedResult: 'Aprendizajes utiles para el area.',
  },
  {
    id: 'lr-2',
    stage: 'Recomendacion',
    activity: 'Definir senales que deberian activar una futura reactivacion.',
    owner: 'Sponsor',
    area: 'Negocio',
    timing: 'Semana 2',
    dependency: 'Revision final de resultados',
    expectedResult: 'Decision cerrada con criterio claro.',
  },
];

const PRACTICE_ITEMS = [
  'Se entiende el problema sin contexto previo.',
  'La evidencia aparece de forma natural y no como lista aislada.',
  'La decision final esta clara.',
  'El pedido final esta claro.',
  'Se entiende que necesita la organizacion para avanzar.',
  'La presentacion cabe en el tiempo esperado.',
  'Se nota impacto en negocio, operacion o usuario.',
  'Se entiende quien deberia hacerse cargo del siguiente paso.',
];

function mapDecisionToClosure(decision: DecisionValue): ClosureType {
  if (decision === 'Go') return 'Implementar / mantener';
  if (decision === 'Iterar') return 'Iterar';
  if (decision === 'Pivote') return 'Pivotear';
  return 'Solo aprendizajes';
}

function getDecisionSummary(decision: DecisionValue): string {
  if (decision === 'Go') return 'Mantener / implementar';
  if (decision === 'Iterar') return 'Iterar';
  if (decision === 'Pivote') return 'Pivotear';
  if (decision === 'No-Go') return 'Solo aprendizajes';
  return 'Pendiente';
}

function inferStatus(done: boolean, partial: boolean): string {
  if (done) return 'Completado';
  if (partial) return 'En progreso';
  return 'Pendiente';
}

function formatAdaptiveJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

function latestStepOutput(core: any, step: number, status?: string) {
  const outputs = Array.isArray(core?.stepOutputs) ? core.stepOutputs : [];
  return outputs
    .filter((item: any) => Number(item.step ?? item.stepNumber) === step)
    .filter((item: any) => !status || item.status === status)
    .sort((a: any, b: any) => Number(b.version ?? 0) - Number(a.version ?? 0))[0] ?? null;
}

// Rutas de continuidad (Core §26, E2E Job-Driven §22) en lenguaje de la persona.
const FINAL_STATE_LABEL: Record<string, string> = {
  completed: 'Implementar',
  transferred: 'Transferir',
  scaled: 'Escalar',
  integrated_to_roadmap: 'Integrar al roadmap',
  closed_with_learning: 'Cerrar con aprendizaje',
  paused: 'Pausar',
  new_iteration_required: 'Iterar (nuevo ciclo)',
  pivoted: 'Pivotear',
  seeking_capability: 'Buscar capacidad, sponsor o socio',
  benefit_tracking: 'Seguimiento de beneficios',
  presented: 'Presentada al portfolio',
};

function finalStateLabel(value: unknown) {
  const key = String(value ?? '');
  return key ? FINAL_STATE_LABEL[key] ?? key : 'Pendiente';
}

const ALTERNATIVE_ROLE_LABEL: Record<string, string> = { selected: 'apuesta', backup: 'respaldo', considered: 'considerada' };

function joinOrPending(items: string[], empty: string) {
  return items.length > 0 ? items.join(' · ') : empty;
}

function buildStep4ReviewSummary(output: any) {
  const brief = output?.audienceBrief ?? {};
  const transfer = output?.transferOrClosure ?? {};
  const coverage = output?.challengeCoverage ?? {};
  const artifacts = output?.decisionPackage?.artifacts;
  return [
    { label: 'Output', value: output?.outputKey ?? 'Pendiente' },
    { label: 'Audiencia', value: brief.primaryAudience ?? 'Pendiente' },
    { label: 'Decision solicitada', value: brief.requestedDecision ?? transfer.finalDecision ?? 'Pendiente' },
    { label: 'Recomendacion', value: output?.recommendation ?? 'Pendiente' },
    { label: 'Estado final', value: finalStateLabel(output?.finalState) },
    // Decision Brief §21: qué podemos sostener, qué no, y qué otras salidas había.
    {
      label: 'Lo que podemos sostener',
      value: joinOrPending((output?.sustainableClaims ?? []).map((claim: any) => claim.text), 'Sin claims con evidencia'),
    },
    {
      label: 'Lo que no podemos afirmar',
      value: joinOrPending(brief.unsupportedClaims ?? [], 'Nada marcado'),
    },
    {
      label: 'Alternativas',
      value: joinOrPending(
        (output?.alternatives ?? []).map((alt: any) => `${alt.name} (${ALTERNATIVE_ROLE_LABEL[alt.role] ?? alt.role})`),
        'Sin alternativas registradas',
      ),
    },
    { label: 'Owner futuro', value: transfer.receiverOwner || transfer.owner || 'Pendiente' },
    { label: 'Handoff', value: transfer.status ?? 'Pendiente' },
    { label: 'Cobertura reto', value: coverage.status ?? 'Sin cobertura' },
    { label: 'Artefactos', value: Array.isArray(artifacts) ? `${artifacts.length}` : '0' },
  ];
}

function SectionCard({
  title,
  description,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
              {title}
            </h2>
            {badge}
          </div>
          {description ? (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
        {label}
      </label>
      {help ? <p className="text-xs text-slate-400 mb-1.5">{help}</p> : null}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />
    </div>
  );
}

export function Step4Page() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects, projectsLoading, updateProject, user } = useApp();
  const contextProject = projects.find((item) => item.id === projectId);
  const [fetchedProject, setFetchedProject] = useState<Project | null>(null);
  const [projectFetching, setProjectFetching] = useState(false);
  const [projectFetchError, setProjectFetchError] = useState(false);
  const project = contextProject ?? fetchedProject;
  // Viewer, Sponsor o Portfolio Lead que revisa: ven el Step, no lo confirman (el backend responde 403).
  const { canEdit, readOnlyReason } = getProjectAccess(user, project);

  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [audience, setAudience] = useState<Audiencia>('Sponsor');
  const [meetingGoal, setMeetingGoal] = useState<MeetingGoal>('Pedir aprobacion');
  const [decision, setDecision] = useState<DecisionValue>('Go');
  const [closureType, setClosureType] = useState<ClosureType>('Implementar / mantener');
  const [meetingOutcome, setMeetingOutcome] =
    useState<MeetingOutcome>('Aprobar implementacion');

  const [presentation, setPresentation] =
    useState<Record<PresentationKey, string>>(DEFAULT_PRESENTATION);
  const [evidences, setEvidences] = useState<EvidenceItem[]>(DEFAULT_EVIDENCE);
  const [demos, setDemos] = useState<DemoItem[]>(DEFAULT_DEMOS);
  const [newDemo, setNewDemo] = useState<Omit<DemoItem, 'id'>>({
    type: 'Link demo',
    url: '',
    proof: '',
    supports: '',
    usedIn: '',
  });

  const [pdfState, setPdfState] = useState<PdfState>('uploaded');
  const [pdfName, setPdfName] = useState('Presentacion-impacto-v1.pdf');
  const [pdfFeedbackReady, setPdfFeedbackReady] = useState(false);

  const [orgContext, setOrgContext] = useState({
    culture: 'TI pide definiciones claras de ownership antes de adoptar cambios operativos.',
    affectedAreas: 'RRHH, TI y lideres de area que reciben nuevos ingresos.',
    dependencies: 'Alineacion con TI para tiempos de respuesta y manejo de casos especiales.',
    risks: 'Si no se distingue el flujo estandar del especial, el resultado se degrada rapido.',
    requirements: 'Owner del flujo, acuerdos de servicio y seguimiento semanal las primeras 4 semanas.',
  });

  const [implementationPlan, setImplementationPlan] =
    useState<PlanRow[]>(IMPLEMENTATION_ROWS);
  const [iterationPlan, setIterationPlan] = useState<PlanRow[]>(ITERATION_ROWS);
  const [pivotPlan, setPivotPlan] = useState<PlanRow[]>(PIVOT_ROWS);
  const [learningPlan, setLearningPlan] = useState<PlanRow[]>(LEARNING_ROWS);
  const [iterateWhatToAdjust, setIterateWhatToAdjust] = useState(
    'Ajustar el manejo de casos especiales antes de escalar.'
  );
  const [iterateNextExperiment, setIterateNextExperiment] = useState(
    'Nuevo piloto con 3 casos especiales y criterio de exito mas estricto.'
  );
  const [iterateDecisionRule, setIterateDecisionRule] = useState(
    'Si 100% de casos especiales se resuelven en 24 horas o menos, volver a presentar para implementacion.'
  );
  const [pivotWhatStops, setPivotWhatStops] = useState(
    'Se deja la idea de un flujo unico para todos los casos.'
  );
  const [pivotNewDirection, setPivotNewDirection] = useState(
    'Nueva direccion: separar flujo estandar y flujo de excepciones.'
  );
  const [pivotHypothesis, setPivotHypothesis] = useState(
    'Si tratamos accesos especiales como carril propio, podemos recuperar consistencia sin frenar el alta estandar.'
  );
  const [pivotReturnCondition, setPivotReturnCondition] = useState(
    'Volver a presentar cuando exista evidencia de 3 casos especiales resueltos con nuevo flujo.'
  );
  const [learningSummary, setLearningSummary] = useState(
    'Aprendimos que la propuesta funciona para casos estandar, pero no debe escalar sin manejo claro de excepciones.'
  );
  const [learningDoNotRepeat, setLearningDoNotRepeat] = useState(
    'No repetir pilotos sin owner formal ni criterio de excepciones definido.'
  );
  const [learningSignals, setLearningSignals] = useState(
    'Reactivar si TI confirma SLA y el volumen de ingresos especiales justifica un flujo dedicado.'
  );

  const [practiceChecks, setPracticeChecks] = useState<boolean[]>(
    PRACTICE_ITEMS.map((_, index) => index < 3)
  );
  const [talkTrack, setTalkTrack] = useState(
    'Detectamos un problema concreto en el alta de accesos. Lo validamos, probamos una solucion simple y obtuvimos evidencia suficiente para pedir una decision clara. Hoy necesitamos definir si avanzamos con una implementacion acotada y quien patrocinara el siguiente paso.'
  );
  const [mentorStatus, setMentorStatus] = useState<MentorDecision>('Pendiente');
  const [mentorFeedback, setMentorFeedback] = useState('');
  const [mentorReviewer, setMentorReviewer] = useState('');
  const [mentorReviewDate, setMentorReviewDate] = useState('');

  const [nextStepType, setNextStepType] = useState<NextStepType | ''>('');
  const [inviteSubject, setInviteSubject] = useState('');
  const [inviteBody, setInviteBody] = useState('');
  const [inviteSummary, setInviteSummary] = useState('');
  const [inviteRecipients, setInviteRecipients] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingOwner, setMeetingOwner] = useState('');
  const [meetingRole, setMeetingRole] = useState('');
  const [meetingObjective, setMeetingObjective] = useState('');
  const [meetingStatus, setMeetingStatus] = useState<MeetingStatus>('Pendiente');
  const [stepFinalized, setStepFinalized] = useState(false);
  const [executiveDecisionReady, setExecutiveDecisionReady] = useState(false);
  const [showFinalizeInitiativeConfirm, setShowFinalizeInitiativeConfirm] = useState(false);
  const [showPracticeGuide, setShowPracticeGuide] = useState(false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [pitchAudioName, setPitchAudioName] = useState('');
  const [pitchVideoName, setPitchVideoName] = useState('');
  const [pitchVideoLink, setPitchVideoLink] = useState('');
  const [pitchAnalysisReady, setPitchAnalysisReady] = useState(false);
  const [adaptiveCore, setAdaptiveCore] = useState<any | null>(null);
  const [adaptiveCoreLoading, setAdaptiveCoreLoading] = useState(false);
  const [adaptiveCoreError, setAdaptiveCoreError] = useState('');
  const [adaptiveOutputJson, setAdaptiveOutputJson] = useState('');
  const [adaptiveOutputError, setAdaptiveOutputError] = useState('');
  const [adaptiveConfirming, setAdaptiveConfirming] = useState(false);

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
    return () => { cancelled = true; };
  }, [contextProject, projectId, projectsLoading, user]);

  // ── TASK-010: hydrate Step 4 state from backend on mount ─────────────────────
  // Falls back silently to existing defaults when nothing is persisted, so the
  // empty-state UX is preserved.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await stepService.getStepData(projectId, 4);
        if (cancelled || !stored || typeof stored !== 'object') return;
        const formData = (stored as { formData?: Record<string, unknown> }).formData;
        if (!formData) return;
        if (typeof formData.audience === 'string') setAudience(formData.audience as Audiencia);
        if (isOneOf(MEETING_GOALS, formData.meetingGoal)) setMeetingGoal(formData.meetingGoal);
        if (isOneOf(DECISION_VALUES, formData.decision)) setDecision(formData.decision);
        if (typeof formData.closureType === 'string') setClosureType(formData.closureType as typeof closureType);
        if (isOneOf(MEETING_OUTCOMES, formData.meetingOutcome)) setMeetingOutcome(formData.meetingOutcome);
        if (formData.presentation && typeof formData.presentation === 'object')
          setPresentation(formData.presentation as typeof presentation);
        if (Array.isArray(formData.evidences)) setEvidences(formData.evidences as typeof evidences);
        if (Array.isArray(formData.demos)) setDemos(formData.demos as typeof demos);
        if (formData.implementationPlan && typeof formData.implementationPlan === 'object')
          setImplementationPlan(formData.implementationPlan as typeof implementationPlan);
        if (formData.iterationPlan && typeof formData.iterationPlan === 'object')
          setIterationPlan(formData.iterationPlan as typeof iterationPlan);
        if (formData.pivotPlan && typeof formData.pivotPlan === 'object')
          setPivotPlan(formData.pivotPlan as typeof pivotPlan);
        if (formData.learningPlan && typeof formData.learningPlan === 'object')
          setLearningPlan(formData.learningPlan as typeof learningPlan);
        if (formData.practiceChecks && typeof formData.practiceChecks === 'object')
          setPracticeChecks(formData.practiceChecks as typeof practiceChecks);
        if (typeof formData.mentorStatus === 'string') setMentorStatus(formData.mentorStatus as typeof mentorStatus);
        if (typeof formData.nextStepType === 'string') setNextStepType(formData.nextStepType as typeof nextStepType);
        if (typeof formData.inviteSubject === 'string') setInviteSubject(formData.inviteSubject);
        if (typeof formData.inviteBody === 'string') setInviteBody(formData.inviteBody);
        if (typeof formData.meetingStatus === 'string') setMeetingStatus(formData.meetingStatus as MeetingStatus);
        if (typeof formData.stepFinalized === 'boolean') setStepFinalized(formData.stepFinalized);
        if (typeof formData.executiveDecisionReady === 'boolean')
          setExecutiveDecisionReady(formData.executiveDecisionReady);
      } catch {
        // 404 / auth — keep defaults silently.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setAdaptiveCoreLoading(true);
    setAdaptiveCoreError('');
    getAdaptiveCore(projectId)
      .then((core) => {
        if (!cancelled) setAdaptiveCore(core);
      })
      .catch(() => {
        if (!cancelled) setAdaptiveCoreError('No pudimos cargar el cierre adaptativo desde backend.');
      })
      .finally(() => {
        if (!cancelled) setAdaptiveCoreLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const adaptiveStep4Draft = useMemo(() => latestStepOutput(adaptiveCore, 4, 'draft'), [adaptiveCore]);
  const adaptiveStep4Confirmed = useMemo(() => latestStepOutput(adaptiveCore, 4, 'confirmed'), [adaptiveCore]);
  const adaptiveStep3Confirmed = useMemo(() => latestStepOutput(adaptiveCore, 3, 'confirmed'), [adaptiveCore]);
  const adaptiveActiveCheckpoint = adaptiveCore?.activeCheckpoint ?? null;
  const adaptiveStep4Output = adaptiveStep4Draft?.output ?? adaptiveStep4Confirmed?.output ?? null;
  const adaptiveSummary = useMemo(() => buildStep4ReviewSummary(adaptiveStep4Output), [adaptiveStep4Output]);
  const adaptiveReadyForReview = Boolean(adaptiveStep4Draft?.output);
  const adaptiveAlreadyConfirmed = Boolean(adaptiveStep4Confirmed);
  const adaptiveStep4Available = Boolean(adaptiveCore && (adaptiveActiveCheckpoint?.step === 4 || adaptiveStep4Draft || adaptiveStep4Confirmed));

  useEffect(() => {
    if (adaptiveStep4Output) {
      setAdaptiveOutputJson(formatAdaptiveJson(adaptiveStep4Output));
      setAdaptiveOutputError('');
    }
  }, [adaptiveStep4Draft?.id, adaptiveStep4Confirmed?.id]);

  // ── Autosave (TASK-010) ─────────────────────────────────────────────────────
  const step4FormData = {
    audience,
    meetingGoal,
    decision,
    closureType,
    meetingOutcome,
    presentation,
    evidences,
    demos,
    implementationPlan,
    iterationPlan,
    pivotPlan,
    learningPlan,
    practiceChecks,
    mentorStatus,
    nextStepType,
    inviteSubject,
    inviteBody,
    meetingStatus,
    stepFinalized,
    executiveDecisionReady,
  };

  const autosaveFn = useCallback(
    async (data: typeof step4FormData) => {
      if (!projectId) return;
      await stepService.saveStepData(projectId, 4, {
        _meta: { version: 1, lastSavedAt: new Date().toISOString(), lastSavedBy: 'user' },
        formData: data,
      });
    },
    [projectId],
  );

  const { state: saveState } = useAutosave({
    data: step4FormData,
    saveFn: autosaveFn,
    delay: 2000,
    // Sólo quien puede escribir guarda: el Portfolio Lead asignado lee la iniciativa sin ser del
    // equipo y el backend le rechaza el PUT (step.access.ts).
    enabled: !!projectId && (!!contextProject || user?.role === 'admin' || user?.role === 'mentor'),
  });

  if (!project && (projectsLoading || projectFetching)) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Cargando proyecto...</p>
      </div>
    );
  }

  if (!project && projectFetchError) {
    return (
      <div className="p-6">
        <p className="text-slate-500">No pudimos cargar el proyecto.</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Proyecto no encontrado.</p>
      </div>
    );
  }

  if (adaptiveCoreLoading) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Lock size={24} className="text-slate-400" />
        </div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>
          Cargando estado adaptativo
        </h2>
        <p className="text-sm text-slate-500">
          Validando con backend si Step 4 esta disponible.
        </p>
      </div>
    );
  }

  if (adaptiveCoreError || !canNavigateToAdaptiveStep(adaptiveCore, 4)) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Lock size={24} className="text-slate-400" />
        </div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>
          Step 4 bloqueado
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {adaptiveCoreError || 'El backend Adaptive Core todavia no habilita Step 4.'}
        </p>
        <div className="flex justify-center gap-2">
          {adaptiveCoreError ? (
            <button
              onClick={() => {
                if (!projectId) return;
                setAdaptiveCoreLoading(true);
                setAdaptiveCoreError('');
                getAdaptiveCore(projectId)
                  .then(core => setAdaptiveCore(core))
                  .catch(() => setAdaptiveCoreError('No pudimos cargar el cierre adaptativo desde backend.'))
                  .finally(() => setAdaptiveCoreLoading(false));
              }}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Reintentar
            </button>
          ) : null}
          <button
            onClick={() => navigate(`/projects/${projectId}/step/3`)}
            className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Ir al Step 3
          </button>
        </div>
      </div>
    );
  }

  const selectedEvidenceCount = evidences.filter((item) => item.selected).length;
  const filledPresentationCount = PRESENTATION_SECTIONS.filter(
    ({ key }) => presentation[key].trim().length >= 40
  ).length;
  const presentationReady =
    filledPresentationCount >= 9 &&
    selectedEvidenceCount >= 1 &&
    demos.length >= 1 &&
    pdfFeedbackReady;
  const demoReady = demos.length >= 1 && selectedEvidenceCount >= 1;

  const currentPlanRows =
    closureType === 'Implementar / mantener'
      ? implementationPlan
      : closureType === 'Iterar'
        ? iterationPlan
        : closureType === 'Pivotear'
          ? pivotPlan
          : learningPlan;

  const planReady =
    currentPlanRows.some(
      (row) =>
        row.activity.trim().length > 10 && row.owner.trim().length > 2 && row.expectedResult.trim().length > 10
    ) &&
    (closureType !== 'Iterar' || iterateDecisionRule.trim().length > 20) &&
    (closureType !== 'Pivotear' || pivotHypothesis.trim().length > 20) &&
    (closureType !== 'Solo aprendizajes' || learningSummary.trim().length > 20);

  const practiceReady =
    practiceChecks.filter(Boolean).length >= 6 && talkTrack.trim().length >= 120;
  const mentorReviewed = mentorStatus !== 'Pendiente';
  const mentorApproved = mentorStatus === 'Aprobado para presentar';
  const nextStepTypeSelected = !!nextStepType;
  const inviteReady =
    nextStepTypeSelected &&
    inviteSubject.trim().length > 10 &&
    inviteBody.trim().length > 40 &&
    inviteRecipients.trim().length > 5 &&
    meetingOwner.trim().length > 2 &&
    meetingObjective.trim().length > 20 &&
    meetingStatus !== 'Pendiente';
  const stepCanBeFinalized =
    presentationReady && planReady && mentorReviewed && nextStepTypeSelected;
  const mandatoryChecks = [
    presentationReady,
    demoReady,
    planReady,
    practiceReady,
    mentorReviewed,
    inviteReady,
  ];
  const stepReady = mandatoryChecks.every(Boolean) && stepFinalized;
  const initiativeCanBeFinalized = stepReady && executiveDecisionReady;
  const isProjectClosed = project.status === 'Finalizado';
  const stepStatus = stepFinalized ? 'Completado' : 'En progreso';

  const modules = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: BookOpen,
      completed: mandatoryChecks.filter(Boolean).length >= 2,
    },
    {
      id: 'A' as const,
      label: 'A · Presentacion de impacto',
      icon: Presentation,
      completed: presentationReady,
    },
    {
      id: 'B' as const,
      label: 'B · Plan de implementacion',
      icon: ClipboardList,
      completed: planReady,
    },
    {
      id: 'C' as const,
      label: 'C · Practica, validacion y activacion',
      icon: Mic,
      completed: stepFinalized,
    },
  ];

  const outputCards = [
    {
      title: 'Presentacion de impacto',
      module: 'A' as const,
      status: inferStatus(presentationReady, filledPresentationCount > 0),
      missing: presentationReady
        ? 'Lista para presentar.'
        : `Faltan ${Math.max(0, 9 - filledPresentationCount)} bloques clave o cerrar revision del PDF.`,
      cta: 'Ir al modulo A',
    },
    {
      title: 'Demo / evidencia de uso',
      module: 'A' as const,
      status: inferStatus(demoReady, selectedEvidenceCount > 0 || demos.length > 0),
      missing: demoReady
        ? 'Evidencia integrada al relato.'
        : 'Selecciona evidencia clave y deja al menos una demo o prueba de uso.',
      cta: 'Completar evidencia',
    },
    {
      title: 'Plan accionable',
      module: 'B' as const,
      status: inferStatus(planReady, currentPlanRows.length > 0),
      missing: planReady
        ? `Plan coherente con ${closureType.toLowerCase()}.`
        : 'Todavia falta dejar responsables, dependencias y resultado esperado.',
      cta: 'Definir plan',
    },
    {
      title: 'Siguiente paso organizacional definido',
      module: 'C' as const,
      status: inferStatus(stepFinalized, nextStepTypeSelected || inviteReady),
      missing:
        stepFinalized
          ? `${nextStepType || 'Siguiente paso'} listo con estado ${meetingStatus.toLowerCase()}.`
          : 'Falta definir el siguiente paso real y cerrar el Step 4 de forma explicita.',
      cta: 'Cerrar paso final',
    },
  ];

  const closureChecklist = [
    {
      title: 'Mensaje adaptado a la audiencia',
      why: 'Evita una presentacion generica y te ayuda a pedir la decision correcta.',
      done: !!audience && !!meetingGoal,
      required: true,
      module: 'overview' as const,
    },
    {
      title: 'Evidencia conectada con hallazgo y decision',
      why: 'La evidencia debe explicar por que recomiendas ese camino.',
      done: demoReady,
      required: true,
      module: 'A' as const,
    },
    {
      title: 'Presentacion lista',
      why: 'Sin una presentacion clara, la reunion no mueve una decision real.',
      done: presentationReady,
      required: true,
      module: 'A' as const,
    },
    {
      title: 'Plan listo segun decision',
      why: 'La organizacion necesita ver que pasa despues de decir que si, iterar o cerrar.',
      done: planReady,
      required: true,
      module: 'B' as const,
    },
    {
      title: 'Practica realizada',
      why: 'El ensayo te ayuda a ordenar el mensaje y detectar huecos antes de presentar.',
      done: practiceReady,
      required: true,
      module: 'C' as const,
    },
    {
      title: 'Mentor valido el cierre',
      why: 'El mentor es el gate final de calidad antes de ir con sponsor o encargado.',
      done: mentorReviewed,
      required: true,
      module: 'C' as const,
    },
    {
      title: 'Siguiente paso organizacional definido',
      why: 'El cierre del step termina cuando ya existe un siguiente paso real hacia la decision del negocio.',
      done: stepFinalized,
      required: true,
      module: 'C' as const,
    },
    {
      title: 'PDF revisado con IA',
      why: 'Te ayuda a detectar incoherencias narrativas antes de la reunion.',
      done: pdfFeedbackReady,
      required: false,
      module: 'A' as const,
    },
  ];

  const applyDecision = (value: DecisionValue) => {
    setDecision(value);
    setClosureType(mapDecisionToClosure(value));
  };

  const updatePlanRow = (
    setter: React.Dispatch<React.SetStateAction<PlanRow[]>>,
    id: string,
    field: keyof PlanRow,
    value: string
  ) => {
    setter((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addPlanRow = () => {
    const newRow: PlanRow = {
      id: `row-${Date.now()}`,
      stage:
        closureType === 'Implementar / mantener'
          ? 'Nueva etapa'
          : closureType === 'Iterar'
            ? 'Nuevo ajuste'
            : closureType === 'Pivotear'
              ? 'Nuevo movimiento'
              : 'Nuevo aprendizaje',
      activity: '',
      owner: '',
      area: '',
      timing: '',
      dependency: '',
      expectedResult: '',
    };
    if (closureType === 'Implementar / mantener') {
      setImplementationPlan((rows) => [...rows, newRow]);
    } else if (closureType === 'Iterar') {
      setIterationPlan((rows) => [...rows, newRow]);
    } else if (closureType === 'Pivotear') {
      setPivotPlan((rows) => [...rows, newRow]);
    } else {
      setLearningPlan((rows) => [...rows, newRow]);
    }
  };

  const generatePlanDraft = () => {
    if (closureType === 'Implementar / mantener') {
      setImplementationPlan(IMPLEMENTATION_ROWS);
    } else if (closureType === 'Iterar') {
      setIterationPlan(ITERATION_ROWS);
    } else if (closureType === 'Pivotear') {
      setPivotPlan(PIVOT_ROWS);
    } else {
      setLearningPlan(LEARNING_ROWS);
    }
    toast.success('Borrador sugerido por IA aplicado. Puedes editarlo completo.');
  };

  const addDemo = () => {
    if (!newDemo.proof.trim() || !newDemo.supports.trim()) {
      toast.error('Completa que demuestra y que decision soporta la demo.');
      return;
    }
    setDemos((items) => [...items, { ...newDemo, id: `demo-${Date.now()}` }]);
    setNewDemo({
      type: 'Link demo',
      url: '',
      proof: '',
      supports: '',
      usedIn: '',
    });
    toast.success('Demo agregada al relato de impacto.');
  };

  const buildPlanRowsText = () =>
    currentPlanRows
      .map(
        (row) =>
          `${row.stage} | ${row.activity} | ${row.owner} | ${row.area} | ${row.timing} | ${row.dependency} | ${row.expectedResult}`
      )
      .join('\n');

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('No se pudo copiar automaticamente. Intenta de nuevo desde un navegador con permisos.');
    }
  };

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePlanPdfExport = () => {
    const planWindow = window.open('', '_blank', 'width=980,height=760');
    if (!planWindow) {
      toast.error('No se pudo abrir la vista de impresion del plan.');
      return;
    }
    planWindow.document.write(`
      <html>
        <head>
          <title>Plan Step 4</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 22px; margin-bottom: 8px; }
            p { font-size: 13px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; vertical-align: top; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Plan de Step 4</h1>
          <p>Modo: ${closureType}</p>
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Actividad</th>
                <th>Responsable</th>
                <th>Area</th>
                <th>Fecha o tramo</th>
                <th>Dependencia</th>
                <th>Resultado esperado</th>
              </tr>
            </thead>
            <tbody>
              ${currentPlanRows
                .map(
                  (row) => `
                    <tr>
                      <td>${row.stage}</td>
                      <td>${row.activity}</td>
                      <td>${row.owner}</td>
                      <td>${row.area}</td>
                      <td>${row.timing}</td>
                      <td>${row.dependency}</td>
                      <td>${row.expectedResult}</td>
                    </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    planWindow.document.close();
    planWindow.focus();
    planWindow.print();
    toast.success('Se abrio una vista imprimible para guardar el plan como PDF.');
  };

  const buildFinalSummary = () => `Starteria - cierre ejecutivo

Problema:
${presentation.problem}

Hipotesis / solucion:
${presentation.proposal}

Experimento:
${presentation.tests}

Resultados / aprendizajes:
${presentation.results}

Presentacion:
${pdfName || 'No registrada'}

Plan:
${buildPlanRowsText()}

Decision tomada:
${getDecisionSummary(decision)}

Resultado que quieres mover:
${meetingOutcome}

Siguiente paso organizacional:
${nextStepType || 'Pendiente'}

Estado organizacional:
${meetingStatus}

Mentor:
${mentorStatus} - ${mentorReviewer}

Instancia objetivo:
${meetingOwner} / ${meetingRole}
`;

  const handlePrepareInvitation = () => {
    copyText(
      `Asunto: ${inviteSubject}\n\nPara: ${inviteRecipients}\n\nResumen: ${inviteSummary}\n\nObjetivo: ${meetingObjective}\n\n${inviteBody}`,
      'Borrador completo listo para copiar.'
    );
  };

  const handleSendInvitation = () => {
    if (!inviteRecipients.trim()) {
      toast.error('Primero define a quien invitar.');
      return;
    }
    const mailto = `mailto:${encodeURIComponent(inviteRecipients)}?subject=${encodeURIComponent(inviteSubject)}&body=${encodeURIComponent(`${inviteSummary}\n\nObjetivo: ${meetingObjective}\n\n${inviteBody}`)}`;
    window.location.href = mailto;
    if (meetingStatus === 'Pendiente') {
      setMeetingStatus('Invitado');
    }
    toast.success('Se abrio tu cliente de correo. Si no existe backend, este es el envio honesto disponible.');
  };

  const confirmAdaptiveStep4Output = async () => {
    if (!projectId || !adaptiveStep4Draft) {
      toast.error('Primero completa CP-4.1 a CP-4.5 para generar un output de Step 4.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(adaptiveOutputJson);
    } catch {
      setAdaptiveOutputError('El output editado debe ser JSON valido.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setAdaptiveOutputError('El output confirmado debe ser un objeto JSON.');
      return;
    }

    setAdaptiveConfirming(true);
    setAdaptiveOutputError('');
    try {
      const nextCore = await confirmStep4Output(projectId, {
        idempotencyKey: `${projectId}-step4-output-v${adaptiveStep4Draft.version ?? 'latest'}-ui-confirm`,
        brief: parsed as Record<string, unknown>,
        confirmed: true,
      });
      setAdaptiveCore(nextCore);
      const refreshedCore = await getAdaptiveCore(projectId);
      setAdaptiveCore(refreshedCore);
      setStepFinalized(true);
      setExecutiveDecisionReady(true);
      toast.success('Output adaptativo de Step 4 confirmado.');
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'No pudimos confirmar el output de Step 4.';
      setAdaptiveOutputError(message);
      toast.error(message);
    } finally {
      setAdaptiveConfirming(false);
    }
  };

  const confirmAdaptiveStep4Checkpoint = async (responses: Record<string, unknown>) => {
    if (!projectId || !adaptiveActiveCheckpoint || adaptiveActiveCheckpoint.step !== 4) return;
    setAdaptiveConfirming(true);
    setAdaptiveOutputError('');
    try {
      const nextCore = await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `${projectId}-${adaptiveActiveCheckpoint.checkpointKey}-${Date.now()}-ui-confirm`,
        checkpointKey: adaptiveActiveCheckpoint.checkpointKey,
        responses,
      });
      setAdaptiveCore(nextCore);
      toast.success('Checkpoint adaptativo confirmado.');
    } catch (error: any) {
      const { message, core } = await explainCheckpointError(projectId, error, 'No pudimos confirmar el checkpoint adaptativo.');
      if (core) setAdaptiveCore(core);
      setAdaptiveOutputError(message);
      toast.error(message);
    } finally {
      setAdaptiveConfirming(false);
    }
  };

  const mobileTabs = (
    <div className="flex gap-1 mb-5 md:hidden overflow-x-auto pb-1">
      {modules.map((module) => (
        <button
          key={module.id}
          onClick={() => setActiveModule(module.id)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${
            activeModule === module.id
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-200 text-slate-500'
          }`}
          style={{ fontWeight: activeModule === module.id ? 600 : 400 }}
        >
          {module.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-full md:grid md:grid-cols-[232px_minmax(0,1fr)] min-[1440px]:grid-cols-[244px_minmax(0,1fr)] min-[1680px]:grid-cols-[256px_minmax(0,1fr)]">
      <div className="hidden md:flex min-h-0 flex-col border-r border-slate-200 bg-white p-3 gap-1">
        <div className="px-2 py-2 mb-1">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <div className="flex items-center gap-2 mt-2">
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
              Step 4
            </h2>
            <StatusChip status={stepStatus} size="sm" />
          </div>
          <p className="text-xs text-slate-500">
            Cerrar la iniciativa y moverla a decision
          </p>
          <p className="text-xs text-indigo-600 mt-1">{audience}</p>
          <p className="text-xs text-emerald-600">{getDecisionSummary(decision)}</p>
        </div>
        <div className="px-2 mb-1">
          <p className="text-xs text-slate-400" style={{ fontWeight: 600 }}>
            MODULOS
          </p>
        </div>
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => setActiveModule(module.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors text-left ${
              activeModule === module.id
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
            style={{ fontWeight: activeModule === module.id ? 600 : 400 }}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                module.completed
                  ? 'bg-emerald-500'
                  : activeModule === module.id
                    ? 'bg-indigo-400'
                    : 'bg-slate-300'
              }`}
            />
            <span className="truncate">{module.label}</span>
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <AutosaveIndicator state={saveState} />
        </div>
      </div>

      <div className="min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1420px] px-5 py-6 min-[1440px]:max-w-[1520px] min-[1440px]:px-6 min-[1680px]:max-w-[1640px] min-[1680px]:px-8">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
          >
            <ArrowLeft size={14} /> Volver
          </button>

          {mobileTabs}

          <ReadOnlyNotice reason={readOnlyReason} className="mb-5" />

          <div className="mb-5">
            <LeaderFeedbackStatusCard project={project} updateProject={updateProject} variant="step4" compact stronger />
          </div>

          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-5 text-xs text-emerald-700">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span>
              <span style={{ fontWeight: 600 }}>Step 3 aprobado.</span> Ya puedes
              cerrar la iniciativa con una presentacion, un plan y una convocatoria real.
            </span>
          </div>

          {/* US-017 Approval gate — only when the autofill feature flag is on. */}
          {isPdfAutofillEnabled() && projectId && (
            <div className="mb-5">
              <ApprovalGateBanner initiativeId={projectId} />
            </div>
          )}

          {adaptiveCore && (
            <AdaptiveCheckpointWorkspace
              readOnly={!canEdit}
              core={adaptiveCore}
              step={4}
              checkpoint={adaptiveActiveCheckpoint}
              questions={adaptiveActiveCheckpoint?.step === 4 ? adaptiveActiveCheckpoint.questions ?? [] : []}
              outputPreview={adaptiveStep4Output}
              outputConfirmed={adaptiveAlreadyConfirmed}
              saving={adaptiveCoreLoading || adaptiveConfirming}
              error={adaptiveCoreError || adaptiveOutputError || null}
              onConfirmCheckpoint={adaptiveActiveCheckpoint?.step === 4 ? confirmAdaptiveStep4Checkpoint : undefined}
              onConfirmOutput={adaptiveStep4Draft ? confirmAdaptiveStep4Output : undefined}
              onRefresh={() => {
                if (!projectId) return;
                setAdaptiveCoreLoading(true);
                getAdaptiveCore(projectId)
                  .then((core) => {
                    setAdaptiveCore(core);
                    setAdaptiveCoreError('');
                  })
                  .catch(() => setAdaptiveCoreError('No pudimos recargar el cierre adaptativo.'))
                  .finally(() => setAdaptiveCoreLoading(false));
              }}
            />
          )}

          {!adaptiveCore && (adaptiveCoreLoading || adaptiveCoreError) && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {adaptiveCoreLoading ? 'Cargando Adaptive Core...' : adaptiveCoreError}
            </div>
          )}

          <div className="hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>
                    Cierre adaptativo backend
                  </p>
                  <StatusChip
                    status={
                      adaptiveAlreadyConfirmed
                        ? 'Confirmado'
                        : adaptiveReadyForReview
                          ? 'Listo para revisar'
                          : adaptiveActiveCheckpoint?.checkpointKey ?? 'Pendiente'
                    }
                    size="sm"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Fuente autoritativa para CP-4.1 a CP-4.5, output final, Portfolio Lead y cobertura del reto.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!projectId) return;
                  setAdaptiveCoreLoading(true);
                  getAdaptiveCore(projectId)
                    .then((core) => {
                      setAdaptiveCore(core);
                      setAdaptiveCoreError('');
                    })
                    .catch(() => setAdaptiveCoreError('No pudimos recargar el cierre adaptativo.'))
                    .finally(() => setAdaptiveCoreLoading(false));
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                style={{ fontWeight: 600 }}
              >
                <Sparkles size={13} /> Recargar backend
              </button>
            </div>

            <div className="p-5 space-y-4">
              {adaptiveCoreLoading ? (
                <p className="text-sm text-slate-500">Cargando Adaptive Core...</p>
              ) : adaptiveCoreError ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{adaptiveCoreError}</span>
                </div>
              ) : null}

              {adaptiveStep4Available ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>Checkpoint</p>
                      <p className="mt-1 text-sm text-slate-800">
                        {adaptiveActiveCheckpoint?.checkpointKey ?? (adaptiveAlreadyConfirmed ? 'closed' : 'Sin checkpoint activo')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>Step 3 confirmado</p>
                      <p className="mt-1 text-sm text-slate-800">{adaptiveStep3Confirmed ? 'Si' : 'Pendiente'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>Estado final</p>
                      <p className="mt-1 text-sm text-slate-800">
                        {finalStateLabel(adaptiveStep4Output?.finalState ?? adaptiveCore?.progressSignal?.finalState)}
                      </p>
                    </div>
                  </div>

                  {adaptiveStep4Output ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-1 space-y-2">
                        {adaptiveSummary.map((item) => (
                          <div key={item.label} className="rounded-xl border border-slate-200 p-3">
                            <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>{item.label}</p>
                            <p className="mt-1 text-sm text-slate-800 break-words">{String(item.value || 'Pendiente')}</p>
                          </div>
                        ))}
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 600 }}>
                          Output editable antes de confirmar
                        </label>
                        <textarea
                          value={adaptiveOutputJson}
                          onChange={(event) => setAdaptiveOutputJson(event.target.value)}
                          disabled={adaptiveAlreadyConfirmed}
                          rows={18}
                          className="w-full rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                        />
                        {adaptiveOutputError ? (
                          <p className="mt-2 text-xs text-red-600">{adaptiveOutputError}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={confirmAdaptiveStep4Output}
                            disabled={!adaptiveReadyForReview || adaptiveAlreadyConfirmed || adaptiveConfirming}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 transition-colors"
                            style={{ fontWeight: 600 }}
                          >
                            <CheckCircle2 size={15} />
                            {adaptiveConfirming ? 'Confirmando...' : adaptiveAlreadyConfirmed ? 'Output confirmado' : 'Confirmar output Step 4'}
                          </button>
                          <p className="text-xs text-slate-400">
                            La confirmacion actualiza InitiativeMasterContext, Portfolio Lead, cobertura y estado final.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Completa los checkpoints CP-4.1 a CP-4.5 desde el flujo adaptativo para generar el output final revisable.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Step 4 adaptativo aun no esta configurado. Confirma el output de Step 3 para desbloquear CP-4.1.
                </div>
              )}
            </div>
          </div>

          {/* Sólo lectura: los módulos se ven pero sus controles quedan deshabilitados. */}
          <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
          {activeModule === 'overview' ? (
            <div className="space-y-5">
              <div className="border border-slate-200 rounded-2xl p-5 bg-white">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>
                    Step 4 - Cerrar la iniciativa y moverla a decision
                  </h1>
                  <StatusChip status={stepStatus} size="sm" />
                </div>
                <p className="text-sm text-slate-500">
                  Aqui transformaras lo validado en una presentacion de impacto,
                  un plan accionable y una convocatoria real a sponsor o encargado.
                </p>
              </div>

              <SectionCard
                title="Resumen ejecutivo de entrada"
                description="Esta es la base que viene de Steps 1 a 3 para construir el cierre."
                icon={FileText}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Problema validado',
                      value:
                        'El alta de accesos para nuevos ingresos era lenta, dependia de correos dispersos y no tenia una trazabilidad compartida.',
                    },
                    {
                      label: 'Hipotesis / apuesta',
                      value:
                        'Un flujo unico y visible podia reducir tiempos de activacion y bajar la carga manual de seguimiento.',
                    },
                    {
                      label: 'Que se probo',
                      value:
                        'Un piloto con 5 ingresos usando formulario digital, hoja de seguimiento y coordinacion acotada con TI.',
                    },
                    {
                      label: 'Resultados / aprendizajes',
                      value:
                        'Se logro 80% de casos en menos de 24 horas; los casos especiales siguen necesitando manejo diferenciado.',
                    },
                    {
                      label: 'Decision actual',
                      value: getDecisionSummary(decision),
                    },
                  ].map((item) => (
                    <div key={item.label} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>
                        {item.label}
                      </p>
                      <p className="text-sm text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Configuracion de cierre"
                description="Define para quien es la reunion, que decision buscas mover y que tipo de cierre corresponde."
                icon={Target}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>
                      Audiencia principal
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {AUDIENCES.map((item) => (
                        <button
                          key={item}
                          onClick={() => setAudience(item)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            audience === item
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                          }`}
                          style={{ fontWeight: audience === item ? 600 : 400 }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>
                      Objetivo de la reunion
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MEETING_GOALS.map((item) => (
                        <button
                          key={item}
                          onClick={() => setMeetingGoal(item)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            meetingGoal === item
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                          }`}
                          style={{ fontWeight: meetingGoal === item ? 600 : 400 }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>
                      Decision tomada
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Mantener / implementar', value: 'Go' as const },
                        { label: 'Iterar', value: 'Iterar' as const },
                        { label: 'Pivotear', value: 'Pivote' as const },
                        { label: 'Solo aprendizajes', value: 'No-Go' as const },
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() => applyDecision(item.value)}
                          className={`px-3 py-1.5 rounded-full text-xs border-2 transition-colors ${
                            decision === item.value
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
                          }`}
                          style={{ fontWeight: decision === item.value ? 600 : 400 }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>
                      Resultado que quieres mover en la reunion
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MEETING_OUTCOMES.map((item) => (
                        <button
                          key={item}
                          onClick={() => setMeetingOutcome(item)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            meetingOutcome === item
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                          }`}
                          style={{ fontWeight: meetingOutcome === item ? 600 : 400 }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      La decision del proyecto sigue teniendo una sola fuente de verdad arriba. Aqui solo defines que resultado quieres mover en la reunion.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Outputs finales del step"
                description="Cada output muestra estado, que falta y el modulo donde se completa."
                icon={Presentation}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {outputCards.map((card) => (
                    <div key={card.title} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm text-slate-800 flex-1" style={{ fontWeight: 600 }}>
                          {card.title}
                        </p>
                        <StatusChip status={card.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{card.missing}</p>
                      <button
                        onClick={() => setActiveModule(card.module)}
                        className="w-full flex items-center justify-center gap-2 text-xs bg-white border border-slate-200 hover:bg-slate-100 rounded-xl py-2 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        {card.cta} <ChevronRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Checklist de cierre"
                description="Cada item explica por que importa y te lleva al espacio correcto."
                icon={CheckCircle2}
              >
                <div className="space-y-3">
                  {closureChecklist.map((item) => (
                    <div key={item.title} className="border border-slate-200 rounded-xl p-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-5 h-5 rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                            item.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {item.done ? '✓' : '·'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                              {item.title}
                            </p>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full ${
                                item.required
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                              style={{ fontWeight: 600 }}
                            >
                              {item.required ? 'Obligatorio' : 'Recomendado'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{item.why}</p>
                        </div>
                        <button
                          onClick={() => setActiveModule(item.module)}
                          className="shrink-0 text-xs text-indigo-600 hover:text-indigo-700"
                          style={{ fontWeight: 600 }}
                        >
                          Ir ahora
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Orden sugerido"
                description="Este step ya no mezcla todo: aqui tienes la secuencia recomendada."
                icon={MoveRight}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {[
                    {
                      step: '1',
                      title: 'Arma la presentacion',
                      description: 'Define mensaje, evidencia, demo y deck.',
                      module: 'A' as const,
                    },
                    {
                      step: '2',
                      title: 'Define el plan',
                      description: 'Traduce la decision en acciones y responsables.',
                      module: 'B' as const,
                    },
                    {
                      step: '3',
                      title: 'Practica y valida',
                      description: 'Ensaya, ajusta y pasa el gate del mentor.',
                      module: 'C' as const,
                    },
                    {
                      step: '4',
                      title: 'Invita y agenda',
                      description: 'Cierra con una convocatoria real a sponsor o Demo Day.',
                      module: 'C' as const,
                    },
                  ].map((item) => (
                    <button
                      key={item.step}
                      onClick={() => setActiveModule(item.module)}
                      className="text-left border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      <span className="text-xs text-indigo-600" style={{ fontWeight: 700 }}>
                        Paso {item.step}
                      </span>
                      <p className="text-sm text-slate-800 mt-1" style={{ fontWeight: 600 }}>
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                    </button>
                  ))}
                </div>
              </SectionCard>

              {stepFinalized ? (
                <SectionCard
                  title="Cierre organizacional"
                  description="El Overview ya refleja como sale la iniciativa de Step 4."
                  icon={CheckCircle2}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>
                        Siguiente paso organizacional definido
                      </p>
                      <p className="text-sm text-slate-800">{nextStepType || 'Pendiente'}</p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>
                        Estado actual
                      </p>
                      <p className="text-sm text-slate-800">{meetingStatus}</p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>
                        Resultado que buscas mover
                      </p>
                      <p className="text-sm text-slate-800">{meetingOutcome}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => setActiveModule('C')}
                      className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      Revisar cierre
                    </button>
                    <button
                      onClick={() => downloadTextFile('starteria-cierre-ejecutivo.txt', buildFinalSummary())}
                      className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-2"
                      style={{ fontWeight: 500 }}
                    >
                      <Download size={12} /> Descargar cierre ejecutivo
                    </button>
                  </div>
                </SectionCard>
              ) : null}
            </div>
          ) : null}

          {activeModule === 'A' ? (
            <div className="space-y-5">
              <div className="border border-slate-200 rounded-2xl p-5 bg-white">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>
                    A · Presentacion de impacto
                  </h1>
                  <StatusChip
                    status={presentationReady ? 'Completado' : 'En progreso'}
                    size="sm"
                  />
                </div>
                <p className="text-sm text-slate-500">
                  Aqui preparas el contenido real de la presentacion, con evidencia
                  al servicio del relato y un pedido final listo para decision.
                </p>
              </div>

              <SectionCard
                title="Datos base del relato"
                description="Ancla visible para que no pierdas el foco del cierre."
                icon={Target}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Audiencia', value: audience },
                    { label: 'Objetivo', value: meetingGoal },
                    { label: 'Decision tomada', value: getDecisionSummary(decision) },
                    { label: 'Enfoque del cierre', value: closureType },
                  ].map((item) => (
                    <div key={item.label} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>
                        {item.label}
                      </p>
                      <p className="text-sm text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Estructura guiada de la presentacion"
                description="Cada bloque explica que escribir y para que sirve."
                icon={Presentation}
                badge={
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>
                    {filledPresentationCount}/12 listos
                  </span>
                }
              >
                <div className="space-y-4">
                  {PRESENTATION_SECTIONS.map((section) => (
                    <TextArea
                      key={section.key}
                      label={section.title}
                      help={section.help}
                      value={presentation[section.key]}
                      onChange={(value) =>
                        setPresentation((current) => ({ ...current, [section.key]: value }))
                      }
                      placeholder="Escribe aqui el contenido que ira a tu presentacion."
                      rows={3}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Evidencia al servicio del relato"
                description="Selecciona solo la evidencia que realmente ayuda a sostener la decision."
                icon={Paperclip}
              >
                <div className="space-y-3">
                  {evidences.map((item) => (
                    <div
                      key={item.id}
                      className={`border rounded-xl p-4 transition-colors ${
                        item.selected ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(event) =>
                            setEvidences((current) =>
                              current.map((evidence) =>
                                evidence.id === item.id
                                  ? { ...evidence, selected: event.target.checked }
                                  : evidence
                              )
                            )
                          }
                          className="w-4 h-4 mt-1 accent-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                              {item.title}
                            </p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
                              {item.source}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            <TextInput
                              label="Que demuestra"
                              value={item.proves}
                              onChange={(value) =>
                                setEvidences((current) =>
                                  current.map((evidence) =>
                                    evidence.id === item.id ? { ...evidence, proves: value } : evidence
                                  )
                                )
                              }
                              placeholder="Describe el hallazgo que prueba."
                            />
                            <TextInput
                              label="Que decision soporta"
                              value={item.supportsDecision}
                              onChange={(value) =>
                                setEvidences((current) =>
                                  current.map((evidence) =>
                                    evidence.id === item.id
                                      ? { ...evidence, supportsDecision: value }
                                      : evidence
                                  )
                                )
                              }
                              placeholder="Ej. Implementar / mantener"
                            />
                            <TextInput
                              label="Donde se usa en la presentacion"
                              value={item.usedIn}
                              onChange={(value) =>
                                setEvidences((current) =>
                                  current.map((evidence) =>
                                    evidence.id === item.id ? { ...evidence, usedIn: value } : evidence
                                  )
                                )
                              }
                              placeholder="Ej. Resultados"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Demo / evidencia de uso"
                description="La demo fortalece la credibilidad de la propuesta."
                icon={Play}
              >
                <div className="space-y-4">
                  {demos.map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" style={{ fontWeight: 600 }}>
                          {item.type}
                        </span>
                        <span className="text-xs text-indigo-600">{item.url || 'Sin link cargado'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600">
                        <p>
                          <span style={{ fontWeight: 600 }}>Que demuestra:</span> {item.proof}
                        </p>
                        <p>
                          <span style={{ fontWeight: 600 }}>Decision que refuerza:</span> {item.supports}
                        </p>
                        <p>
                          <span style={{ fontWeight: 600 }}>Parte del deck:</span> {item.usedIn}
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="border border-dashed border-slate-300 rounded-xl p-4">
                    <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>
                      Agregar nueva demo o evidencia de uso
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <TextInput
                        label="Tipo"
                        value={newDemo.type}
                        onChange={(value) =>
                          setNewDemo((current) => ({
                            ...current,
                            type: value as DemoItem['type'],
                          }))
                        }
                        placeholder="Link demo / Video / Capturas / Registro de uso"
                      />
                      <TextInput
                        label="Link o referencia"
                        value={newDemo.url}
                        onChange={(value) => setNewDemo((current) => ({ ...current, url: value }))}
                        placeholder="https://... o nombre de archivo"
                      />
                      <TextInput
                        label="Que demuestra"
                        value={newDemo.proof}
                        onChange={(value) =>
                          setNewDemo((current) => ({ ...current, proof: value }))
                        }
                        placeholder="Ej. Que el flujo se puede completar sin ayuda."
                      />
                      <TextInput
                        label="Que decision soporta"
                        value={newDemo.supports}
                        onChange={(value) =>
                          setNewDemo((current) => ({ ...current, supports: value }))
                        }
                        placeholder="Ej. Implementar / mantener"
                      />
                      <div className="md:col-span-2">
                        <TextInput
                          label="En que parte de la presentacion se usa"
                          value={newDemo.usedIn}
                          onChange={(value) =>
                            setNewDemo((current) => ({ ...current, usedIn: value }))
                          }
                          placeholder="Ej. Como funciona / resultados"
                        />
                      </div>
                    </div>
                    <button
                      onClick={addDemo}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      Agregar demo
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Deck PDF y analisis con IA"
                description="Aqui se registra el entregable del modulo A."
                icon={FileText}
                badge={<StatusChip status={pdfState === 'analyzed' ? 'Completado' : 'Pendiente'} size="sm" />}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <TextInput
                      label="Nombre del PDF"
                      value={pdfName}
                      onChange={setPdfName}
                      placeholder="Presentacion-impacto-v1.pdf"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setPdfState('uploaded');
                          toast.success('PDF registrado en el modulo A.');
                        }}
                        className="flex-1 border border-slate-200 bg-white hover:bg-slate-100 rounded-xl py-2 text-sm transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        Registrar PDF
                      </button>
                      <button
                        onClick={() => {
                          if (!pdfName.trim()) {
                            toast.error('Primero registra el nombre del PDF.');
                            return;
                          }
                          setPdfState('analyzed');
                          setPdfFeedbackReady(true);
                          toast.success('Analisis IA completado para el deck.');
                        }}
                        className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2 text-sm transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        Analizar con IA
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-3" style={{ fontWeight: 600 }}>
                      Feedback IA
                    </p>
                    {pdfFeedbackReady ? (
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-emerald-700 text-xs mb-1" style={{ fontWeight: 700 }}>
                            Que esta bien
                          </p>
                          <p className="text-slate-600">
                            La historia conecta problema, evidencia, decision y pedido final de forma consistente.
                          </p>
                        </div>
                        <div>
                          <p className="text-amber-700 text-xs mb-1" style={{ fontWeight: 700 }}>
                            Que falta
                          </p>
                          <p className="text-slate-600">
                            Explicitar mejor como se resolveran los casos especiales y quien tomara ownership.
                          </p>
                        </div>
                        <div>
                          <p className="text-indigo-700 text-xs mb-1" style={{ fontWeight: 700 }}>
                            Siguiente accion recomendada
                          </p>
                          <p className="text-slate-600">
                            Ajusta la parte de riesgos organizacionales y asegurate de que el pedido final este en la ultima diapositiva.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Analiza el PDF para revisar claridad, coherencia narrativa, solidez de evidencia y consistencia entre hallazgos, decision y pedido final.
                      </p>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Contexto organizacional"
                description="Mantiene la propuesta realista y conecta naturalmente con el modulo B."
                icon={Building2}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TextArea
                    label="Cultura / resistencias"
                    value={orgContext.culture}
                    onChange={(value) =>
                      setOrgContext((current) => ({ ...current, culture: value }))
                    }
                    placeholder="Describe resistencias o sensibilidades organizacionales."
                  />
                  <TextArea
                    label="Areas afectadas"
                    value={orgContext.affectedAreas}
                    onChange={(value) =>
                      setOrgContext((current) => ({ ...current, affectedAreas: value }))
                    }
                    placeholder="Indica que areas se veran impactadas."
                  />
                  <TextArea
                    label="Dependencias"
                    value={orgContext.dependencies}
                    onChange={(value) =>
                      setOrgContext((current) => ({ ...current, dependencies: value }))
                    }
                    placeholder="Alineaciones o dependencias necesarias."
                  />
                  <TextArea
                    label="Riesgos"
                    value={orgContext.risks}
                    onChange={(value) =>
                      setOrgContext((current) => ({ ...current, risks: value }))
                    }
                    placeholder="Que puede bloquear el avance."
                  />
                  <div className="md:col-span-2">
                    <TextArea
                      label="Requerimientos"
                      value={orgContext.requirements}
                      onChange={(value) =>
                        setOrgContext((current) => ({ ...current, requirements: value }))
                      }
                      placeholder="Recursos, owners o habilitadores necesarios."
                    />
                  </div>
                </div>
              </SectionCard>

              <div className="flex gap-3">
                <button
                  onClick={() => toast.success('Modulo A guardado.')}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setActiveModule('B')}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                  style={{ fontWeight: 500 }}
                >
                  Siguiente: plan de implementacion <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}

          {activeModule === 'B' ? (
            <div className="space-y-5">
              <div className="border border-slate-200 rounded-2xl p-5 bg-white">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>
                    B · Plan de implementacion
                  </h1>
                  <StatusChip status={planReady ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">
                  Traduce la decision tomada en un plan claro, editable y realista.
                </p>
              </div>

              <SectionCard
                title="Modo del plan"
                description="El plan se adapta a la decision tomada, pero todo sigue siendo editable."
                icon={ClipboardList}
              >
                <div className="flex flex-wrap gap-2 mb-4">
                  {CLOSURE_TYPES.map((item) => (
                    <button
                      key={item}
                      onClick={() => setClosureType(item)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        closureType === item
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                      style={{ fontWeight: closureType === item ? 600 : 400 }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <Sparkles size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-indigo-800" style={{ fontWeight: 600 }}>
                      IA como asistente, no como reemplazo
                    </p>
                    <p className="text-xs text-indigo-600 mt-1">
                      Puedes generar un borrador inicial y luego editar actividades, responsables, fechas y dependencias.
                    </p>
                  </div>
                  <button
                    onClick={generatePlanDraft}
                    className="shrink-0 text-xs bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl px-3 py-2 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Generar borrador con IA
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="Salida util del plan"
                description="Estas acciones te permiten reutilizar el plan fuera del sistema para la sustentacion."
                icon={Download}
              >
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      copyText(
                        `Etapa | Actividad | Responsable | Area | Fecha o tramo | Dependencia | Resultado esperado\n${buildPlanRowsText()}`,
                        'Tabla del plan copiada.'
                      )
                    }
                    className="inline-flex items-center gap-2 text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Copy size={12} /> Copiar tabla
                  </button>
                  <button
                    onClick={handlePlanPdfExport}
                    className="inline-flex items-center gap-2 text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Download size={12} /> Descargar PDF
                  </button>
                  <button
                    onClick={() =>
                      copyText(
                        currentPlanRows
                          .map(
                            (row) =>
                              `- ${row.stage}: ${row.activity}. Responsable: ${row.owner}. Resultado esperado: ${row.expectedResult}.`
                          )
                          .join('\n'),
                        'Resumen del plan copiado para slides.'
                      )
                    }
                    className="inline-flex items-center gap-2 text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Copy size={12} /> Copiar para slides
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  El PDF usa una vista imprimible del navegador para que puedas guardarlo como archivo si no existe exportador nativo.
                </p>
              </SectionCard>

              {closureType === 'Implementar / mantener' ? (
                <SectionCard
                  title="Plan 0-30 / 31-60 / 61-90 dias"
                  description="Muestra fases, actividades, responsables, dependencias y resultado esperado."
                  icon={Calendar}
                >
                  <div className="overflow-x-auto">
                    <div className="min-w-[920px]">
                      <div className="grid grid-cols-7 gap-2 px-2 pb-2 text-[11px] text-slate-500" style={{ fontWeight: 700 }}>
                        <span>Etapa</span>
                        <span>Actividad</span>
                        <span>Responsable</span>
                        <span>Area duena</span>
                        <span>Fecha o tramo</span>
                        <span>Dependencia</span>
                        <span>Resultado esperado</span>
                      </div>
                      <div className="space-y-2">
                        {implementationPlan.map((row) => (
                          <div key={row.id} className="grid grid-cols-7 gap-2">
                            {(
                              ['stage', 'activity', 'owner', 'area', 'timing', 'dependency', 'expectedResult'] as Array<keyof PlanRow>
                            ).map((field) => (
                              <input
                                key={field}
                                value={row[field]}
                                onChange={(event) =>
                                  updatePlanRow(setImplementationPlan, row.id, field, event.target.value)
                                }
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={addPlanRow}
                    className="mt-3 text-xs text-indigo-600 hover:text-indigo-700"
                    style={{ fontWeight: 600 }}
                  >
                    Agregar actividad
                  </button>
                </SectionCard>
              ) : null}

              {closureType === 'Iterar' ? (
                <div className="space-y-5">
                  <SectionCard
                    title="Definicion de la iteracion"
                    description="Aclara que se ajusta, que se volvera a validar y cual es la regla para decidir el siguiente paso."
                    icon={Target}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <TextArea label="Que parte se ajusta" value={iterateWhatToAdjust} onChange={setIterateWhatToAdjust} placeholder="Explica que se corrige." />
                      <TextArea label="Nuevo experimento o validacion" value={iterateNextExperiment} onChange={setIterateNextExperiment} placeholder="Describe la siguiente prueba." />
                      <div className="md:col-span-2">
                        <TextArea label="Criterio para decidir el siguiente paso" value={iterateDecisionRule} onChange={setIterateDecisionRule} placeholder="Explica bajo que criterio volverias a presentar." />
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard title="Vista del plan" description="Tabla simple para entender actividad, responsable, fecha y resultado esperado." icon={Calendar}>
                    <div className="space-y-2">
                      {iterationPlan.map((row) => (
                        <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                          {(
                            ['stage', 'activity', 'owner', 'timing', 'dependency', 'expectedResult'] as Array<keyof PlanRow>
                          ).map((field) => (
                            <input
                              key={field}
                              value={row[field]}
                              onChange={(event) =>
                                updatePlanRow(setIterationPlan, row.id, field, event.target.value)
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <button onClick={addPlanRow} className="mt-3 text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
                      Agregar actividad
                    </button>
                  </SectionCard>
                </div>
              ) : null}

              {closureType === 'Pivotear' ? (
                <div className="space-y-5">
                  <SectionCard title="Plantilla de pivote" description="Aclara que se deja, que cambia y bajo que condicion volveria a presentarse." icon={AlertTriangle}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <TextArea label="Que se deja" value={pivotWhatStops} onChange={setPivotWhatStops} placeholder="Explica que ya no se hara." />
                      <TextArea label="Nueva direccion" value={pivotNewDirection} onChange={setPivotNewDirection} placeholder="Describe hacia donde cambia la iniciativa." />
                      <TextArea label="Siguiente hipotesis a validar" value={pivotHypothesis} onChange={setPivotHypothesis} placeholder="Escribe la nueva hipotesis." />
                      <TextArea label="Condiciones para volver a presentar" value={pivotReturnCondition} onChange={setPivotReturnCondition} placeholder="Que deberia pasar antes de volver a reunion." />
                    </div>
                  </SectionCard>
                  <SectionCard title="Vista del plan" description="Timeline simple para ownership, dependencia y resultado esperado." icon={Calendar}>
                    <div className="space-y-2">
                      {pivotPlan.map((row) => (
                        <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                          {(
                            ['stage', 'activity', 'owner', 'timing', 'dependency', 'expectedResult'] as Array<keyof PlanRow>
                          ).map((field) => (
                            <input
                              key={field}
                              value={row[field]}
                              onChange={(event) =>
                                updatePlanRow(setPivotPlan, row.id, field, event.target.value)
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <button onClick={addPlanRow} className="mt-3 text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
                      Agregar actividad
                    </button>
                  </SectionCard>
                </div>
              ) : null}

              {closureType === 'Solo aprendizajes' ? (
                <div className="space-y-5">
                  <SectionCard title="Cierre por aprendizajes" description="Organiza lo que se aprendio, lo que no funciono y que senales justificarian reactivar la iniciativa." icon={BookOpen}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <TextArea label="Que aprendimos" value={learningSummary} onChange={setLearningSummary} placeholder="Resume el aprendizaje principal." />
                      <TextArea label="Que no deberiamos repetir" value={learningDoNotRepeat} onChange={setLearningDoNotRepeat} placeholder="Deja claro que errores evitar." />
                      <TextArea label="Senales para una futura reactivacion" value={learningSignals} onChange={setLearningSignals} placeholder="Describe que deberia cambiar para retomarlo." />
                    </div>
                  </SectionCard>
                  <SectionCard title="Vista del plan" description="Tambien los aprendizajes deben quedar accionables para el area." icon={Calendar}>
                    <div className="space-y-2">
                      {learningPlan.map((row) => (
                        <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                          {(
                            ['stage', 'activity', 'owner', 'timing', 'dependency', 'expectedResult'] as Array<keyof PlanRow>
                          ).map((field) => (
                            <input
                              key={field}
                              value={row[field]}
                              onChange={(event) =>
                                updatePlanRow(setLearningPlan, row.id, field, event.target.value)
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <button onClick={addPlanRow} className="mt-3 text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
                      Agregar actividad
                    </button>
                  </SectionCard>
                </div>
              ) : null}

              <SectionCard title="Output del modulo B" description="Este output debe quedar listo para presentar y reutilizar en el deck." icon={CheckCircle2}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-slate-600">
                    {planReady
                      ? `Tu plan ya esta listo y es coherente con la decision de ${closureType.toLowerCase()}.`
                      : 'Todavia falta aterrizar actividad, owner y resultado esperado para que el plan sea presentable.'}
                  </p>
                  <StatusChip status={planReady ? 'Completado' : 'Pendiente'} size="sm" />
                </div>
              </SectionCard>

              <div className="flex gap-3">
                <button onClick={() => toast.success('Modulo B guardado.')} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Guardar
                </button>
                <button onClick={() => setActiveModule('C')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2" style={{ fontWeight: 500 }}>
                  Siguiente: practica y convocatoria <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}

          {activeModule === 'C' ? (
            <div className="space-y-5">
              <div className="border border-slate-200 rounded-2xl p-5 bg-white">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>
                    C · Practica, validacion y activacion
                  </h1>
                  <StatusChip status={practiceReady && mentorReviewed && inviteReady ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">
                  Asegura que llegues listo a presentar, pases la validacion final del mentor y cierres con una convocatoria real.
                </p>
              </div>

              <SectionCard title="Checklist de ensayo" description="Evalua cosas reales antes de salir a la reunion final." icon={ClipboardList} badge={<span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>{practiceChecks.filter(Boolean).length}/{PRACTICE_ITEMS.length}</span>}>
                <div className="space-y-2">
                  {PRACTICE_ITEMS.map((item, index) => (
                    <label key={item} className="flex items-start gap-3 border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={practiceChecks[index]}
                        onChange={(event) =>
                          setPracticeChecks((current) =>
                            current.map((value, itemIndex) => (itemIndex === index ? event.target.checked : value))
                          )
                        }
                        className="w-4 h-4 mt-0.5 accent-emerald-600"
                      />
                      <span className={`text-sm ${practiceChecks[index] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item}</span>
                    </label>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Practica guiada" description="Este espacio no es solo un textarea: te ayuda a ensayar mejor." icon={Mic}>
                <TextArea label="Talk track" value={talkTrack} onChange={setTalkTrack} placeholder="Escribe el guion breve que usaras para abrir y cerrar la presentacion." rows={6} />
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => {
                      setTalkTrack('Tenemos evidencia de que el problema es real, una solucion probada y una recomendacion concreta. Hoy buscamos definir el siguiente paso viable con responsables y condiciones claras para avanzar.');
                      toast.success('Talk track sugerido listo para editar.');
                    }}
                    className="text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-3 py-2 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Generar talk track
                  </button>
                  <button onClick={() => setShowPracticeGuide((current) => !current)} className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors" style={{ fontWeight: 500 }}>
                    Ayudas para practicar
                  </button>
                  <button onClick={() => setShowFeedbackPanel((current) => !current)} className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors" style={{ fontWeight: 500 }}>
                    Solicitar feedback
                  </button>
                </div>
                {showPracticeGuide ? (
                  <div className="mt-4 rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-800 mb-2" style={{ fontWeight: 600 }}>
                          Estructura sugerida del pitch
                        </p>
                        <ul className="space-y-1 text-slate-600">
                          <li>1. Problema claro</li>
                          <li>2. Que se probo</li>
                          <li>3. Que evidencia se obtuvo</li>
                          <li>4. Que decision recomiendas</li>
                          <li>5. Que necesitas de la organizacion</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-slate-800 mb-2" style={{ fontWeight: 600 }}>
                          Recordatorios utiles
                        </p>
                        <ul className="space-y-1 text-slate-600">
                          <li>Duracion esperada: 60 a 90 segundos.</li>
                          <li>No leas el guion literal; usa ideas clave.</li>
                          <li>Conecta evidencia con pedido final.</li>
                          <li>Evita explicar de mas el metodo si la audiencia es ejecutiva.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-slate-800 mb-2" style={{ fontWeight: 600 }}>
                          Errores comunes
                        </p>
                        <ul className="space-y-1 text-slate-600">
                          <li>Hablar de la solucion antes del problema.</li>
                          <li>Mostrar evidencia sin decir que decision soporta.</li>
                          <li>Cerrar sin un pedido concreto.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-slate-800 mb-2" style={{ fontWeight: 600 }}>
                          Preguntas posibles de sponsor o encargado
                        </p>
                        <ul className="space-y-1 text-slate-600">
                          <li>Que riesgo organizacional ves para implementarlo?</li>
                          <li>Quien deberia ser owner del siguiente paso?</li>
                          <li>Que pasaria si no hacemos nada?</li>
                          <li>Que necesitas exactamente para avanzar?</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
                {showFeedbackPanel ? (
                  <div className="mt-4 rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-800 mb-2" style={{ fontWeight: 600 }}>
                          Solicitar revision del mentor
                        </p>
                        <p className="text-xs text-slate-500 mb-3">
                          Usa este espacio para preparar la revision humana final del pitch.
                        </p>
                        <button
                          onClick={() => {
                            setMentorStatus('Ajustar antes de presentar');
                            toast.success('Se dejo lista la solicitud de revision para el mentor.');
                          }}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          Preparar solicitud para mentor
                        </button>
                      </div>
                      <div>
                        <p className="text-sm text-slate-800 mb-2" style={{ fontWeight: 600 }}>
                          Analisis IA del pitch
                        </p>
                        <p className="text-xs text-slate-500 mb-3">
                          La IA puede revisar claridad, evidencia, pedido final y duracion aproximada del pitch.
                        </p>
                        <button
                          onClick={() => {
                            setPitchAnalysisReady(true);
                            toast.success('Analisis IA del pitch disponible.');
                          }}
                          className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          Pedir analisis IA
                        </button>
                      </div>
                    </div>
                    {pitchAnalysisReady ? (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-3">
                          <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>
                            Que esta bien
                          </p>
                          <p className="text-emerald-900">El pitch abre con un problema claro y cierra con una decision concreta.</p>
                        </div>
                        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                          <p className="text-xs text-amber-700 mb-1" style={{ fontWeight: 700 }}>
                            Que falta
                          </p>
                          <p className="text-amber-900">Todavia puedes reforzar el uso de evidencia y nombrar mejor el owner del siguiente paso.</p>
                        </div>
                        <div className="border border-slate-200 bg-white rounded-xl p-3">
                          <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>
                            Pedido final
                          </p>
                          <p className="text-slate-700">Haz explicito que decision esperas de la reunion.</p>
                        </div>
                        <div className="border border-slate-200 bg-white rounded-xl p-3">
                          <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>
                            Duracion aproximada
                          </p>
                          <p className="text-slate-700">El pitch actual se ve cercano al rango recomendado de 60 a 90 segundos.</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard title="Pitch grabado" description="Te permite dejar evidencia del pitch aunque no tengas una revision sincronica con mentor." icon={Video}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <TextInput label="Audio del pitch" value={pitchAudioName} onChange={setPitchAudioName} placeholder="Nombre del archivo o referencia" />
                  <TextInput label="Video del pitch" value={pitchVideoName} onChange={setPitchVideoName} placeholder="Nombre del archivo o referencia" />
                  <TextInput label="Link del video" value={pitchVideoLink} onChange={setPitchVideoLink} placeholder="https://..." />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => {
                      if (!pitchAudioName.trim() && !pitchVideoName.trim() && !pitchVideoLink.trim()) {
                        toast.error('Carga al menos un audio, video o link del pitch.');
                        return;
                      }
                      setPitchAnalysisReady(true);
                      toast.success('Pitch registrado para revision IA o mentor.');
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Registrar pitch
                  </button>
                  <button
                    onClick={() => {
                      if (!pitchAudioName.trim() && !pitchVideoName.trim() && !pitchVideoLink.trim()) {
                        toast.error('Primero registra un audio, video o link.');
                        return;
                      }
                      setPitchAnalysisReady(true);
                      toast.success('La IA ya puede usar este material como apoyo de evaluacion.');
                    }}
                    className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Analizar pitch con IA
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Esta capa es apoyo operativo. La validacion humana del mentor puede seguir siendo obligatoria segun negocio.
                </p>
              </SectionCard>

              <SectionCard title="Validacion final del mentor" description="Este es el gate final del step. Debe quedar visible si puedes presentar o no." icon={Users} badge={<StatusChip status={mentorReviewed ? 'En progreso' : 'Pendiente'} size="sm" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>
                      Resultado de la revision
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Aprobado para presentar',
                        'Ajustar antes de presentar',
                        'Reensayar',
                        'No listo aun',
                      ].map((item) => (
                        <button
                          key={item}
                          onClick={() => setMentorStatus(item as MentorDecision)}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            mentorStatus === item
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}
                          style={{ fontWeight: mentorStatus === item ? 600 : 400 }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      <TextInput label="Mentor" value={mentorReviewer} onChange={setMentorReviewer} placeholder="Nombre del mentor" />
                      <TextInput label="Fecha de revision" value={mentorReviewDate} onChange={setMentorReviewDate} placeholder="AAAA-MM-DD" />
                    </div>
                  </div>
                  <TextArea label="Feedback del mentor" value={mentorFeedback} onChange={setMentorFeedback} placeholder="Registra que esta bien, que falta y que recomienda hacer ahora." rows={6} />
                </div>
                <div className={`mt-4 rounded-xl p-3 text-sm ${
                  mentorApproved
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                    : 'bg-amber-50 border border-amber-100 text-amber-700'
                }`}>
                  {mentorApproved
                    ? 'Mentor aprobado: ya puedes cerrar con convocatoria real.'
                    : 'El step no se considera realmente cerrado hasta dejar visible el resultado de mentor.'}
                </div>
              </SectionCard>

              <SectionCard title="Siguiente paso organizacional" description="Aqui defines como la iniciativa sale del sandbox hacia una decision real. Este es el ultimo paso del Step 4." icon={Mail}>
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>
                      Secuencia de cierre
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {[
                        {
                          step: '1',
                          title: 'Elegir tipo de cierre',
                          done: nextStepTypeSelected,
                        },
                        {
                          step: '2',
                          title: 'Preparar borrador de convocatoria',
                          done: inviteSubject.trim().length > 10 && inviteBody.trim().length > 40,
                        },
                        {
                          step: '3',
                          title: 'Registrar siguiente paso real',
                          done: meetingOwner.trim().length > 2 && meetingStatus !== 'Pendiente',
                        },
                        {
                          step: '4',
                          title: 'Finalizar Step 4',
                          done: stepFinalized,
                        },
                      ].map((item) => (
                        <div key={item.step} className="border border-slate-200 rounded-xl p-3 bg-white">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-indigo-600" style={{ fontWeight: 700 }}>
                              Paso {item.step}
                            </span>
                            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${item.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              {item.done ? '✓' : '·'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{item.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>
                      Como se movera esta decision
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        'Reunion con sponsor',
                        'Presentacion a gerencia',
                        'Demo Day',
                        'Solo dejar recomendacion / aprendizajes',
                      ] as NextStepType[]).map((item) => (
                      <button
                        key={item}
                        onClick={() => setNextStepType(item)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          nextStepType === item
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                        style={{ fontWeight: nextStepType === item ? 600 : 400 }}
                      >
                        {item}
                      </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Elige el canal segun el tipo de decision: 1:1 para destrabar rapido, gerencia/comite para aprobacion formal, Demo Day para visibilidad o aprendizajes documentados para un cierre sin reunion.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TextInput label="Asunto" value={inviteSubject} onChange={setInviteSubject} placeholder="Asunto del correo" />
                    <TextInput label="A quien invitar" value={inviteRecipients} onChange={setInviteRecipients} placeholder="Correos o nombres" />
                    <TextArea label="Resumen breve del logro" value={inviteSummary} onChange={setInviteSummary} placeholder="Resume el logro principal" />
                    <TextArea label="Objetivo de la reunion" value={meetingObjective} onChange={setMeetingObjective} placeholder="Explica la decision que buscas mover" />
                    <div className="md:col-span-2">
                      <TextArea label="Cuerpo editable" value={inviteBody} onChange={setInviteBody} placeholder="Escribe el correo base de Starteria" rows={5} />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <p className="text-sm text-slate-800 mb-3" style={{ fontWeight: 600 }}>
                      Registro de reunion
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <TextInput label="Fecha tentativa o confirmada" value={meetingDate} onChange={setMeetingDate} placeholder="AAAA-MM-DD" />
                      <TextInput label="Sponsor / encargado" value={meetingOwner} onChange={setMeetingOwner} placeholder="Nombre" />
                      <TextInput label="Rol o area" value={meetingRole} onChange={setMeetingRole} placeholder="Rol o area" />
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
                          Estado
                        </label>
                        <select
                          value={meetingStatus}
                          onChange={(event) => setMeetingStatus(event.target.value as MeetingStatus)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {(['Pendiente', 'Invitado', 'Agendado', 'Confirmado'] as MeetingStatus[]).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={handlePrepareInvitation} className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-2" style={{ fontWeight: 500 }}>
                      <MessageSquare size={12} /> Preparar invitacion
                    </button>
                    <button
                      onClick={handleSendInvitation}
                      className="text-xs border border-slate-200 bg-white hover:bg-slate-100 rounded-xl px-3 py-2 transition-colors inline-flex items-center gap-2"
                      style={{ fontWeight: 500 }}
                    >
                      <Mail size={12} /> Enviar invitacion
                    </button>
                    <button
                      onClick={() => {
                        if (!adaptiveAlreadyConfirmed) {
                          toast.error('Primero confirma el output de Step 4 en Adaptive Core.');
                          return;
                        }
                        if (!stepCanBeFinalized) {
                          toast.error('Todavia faltan minimos reales para finalizar Step 4.');
                          return;
                        }
                        setStepFinalized(true);
                        if (meetingStatus === 'Pendiente') {
                          setMeetingStatus('Invitado');
                        }
                        toast.success('Step 4 finalizado y siguiente paso definido.');
                      }}
                      disabled={!stepCanBeFinalized || !adaptiveAlreadyConfirmed}
                      className={`text-xs rounded-xl px-3 py-2 transition-colors ${
                        stepCanBeFinalized && adaptiveAlreadyConfirmed
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      Finalizar y dejar siguiente paso definido
                    </button>
                  </div>

                  {!stepCanBeFinalized ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs text-amber-800 mb-1" style={{ fontWeight: 700 }}>
                        Antes de finalizar
                      </p>
                      <div className="space-y-1 text-xs text-amber-700">
                        {!presentationReady ? <p>Completa suficientemente la presentacion de impacto.</p> : null}
                        {!planReady ? <p>Define el plan segun la decision tomada.</p> : null}
                        {!mentorReviewed ? <p>Registra la validacion final del mentor.</p> : null}
                        {!nextStepTypeSelected ? <p>Elige el tipo de cierre organizacional.</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {stepFinalized ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <StatusChip status="Completado" size="sm" />
                        <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>
                          Step 4 cerrado
                        </p>
                      </div>
                      <p className="text-sm text-emerald-700 mb-3">
                        La iniciativa ya tiene un siguiente paso organizacional definido y puede salir del sandbox hacia una decision real.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-emerald-900">
                        <p><span style={{ fontWeight: 600 }}>Presentacion:</span> lista para presentar</p>
                        <p><span style={{ fontWeight: 600 }}>Plan:</span> definido segun {closureType.toLowerCase()}</p>
                        <p><span style={{ fontWeight: 600 }}>Mentor:</span> {mentorStatus}</p>
                        <p><span style={{ fontWeight: 600 }}>Siguiente paso:</span> {nextStepType}</p>
                        <p><span style={{ fontWeight: 600 }}>Estado:</span> {meetingStatus}</p>
                        <p><span style={{ fontWeight: 600 }}>Responsable / destinatario:</span> {meetingOwner}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard title="Cierre del Step 4" description="Distingue minimos obligatorios de recomendaciones extra." icon={CheckCircle2}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 700 }}>
                      Obligatorio
                    </p>
                    <div className="space-y-2">
                      {[
                        ['Presentacion con contenido suficiente', presentationReady],
                        ['Demo o evidencia cargada', demoReady],
                        ['Plan definido segun decision', planReady],
                        ['Practica realizada', practiceReady],
                        ['Mentor reviso', mentorReviewed],
                        ['Tipo de cierre organizacional seleccionado', nextStepTypeSelected],
                        ['Step 4 finalizado con siguiente paso definido', stepFinalized],
                      ].map(([label, done]) => (
                        <div key={String(label)} className="flex items-center gap-2 text-sm">
                          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {done ? '✓' : '·'}
                          </span>
                          <span className={done ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 700 }}>
                      Recomendado
                    </p>
                    <div className="space-y-2">
                      {[
                        ['PDF analizado con IA', pdfFeedbackReady],
                        ['Mentor aprobo para presentar', mentorApproved],
                        ['Reunion confirmada', meetingStatus === 'Confirmado'],
                      ].map(([label, done]) => (
                        <div key={String(label)} className="flex items-center gap-2 text-sm">
                          <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {done ? '✓' : '·'}
                          </span>
                          <span className={done ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={`mt-4 rounded-xl p-4 ${
                  stepReady
                    ? 'bg-emerald-50 border border-emerald-100'
                    : 'bg-amber-50 border border-amber-100'
                }`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusChip status={stepReady ? 'Completado' : 'Pendiente'} size="sm" />
                    <p className={`text-sm ${stepReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {stepReady
                        ? 'El step ya esta listo como cierre ejecutivo y accionable.'
                        : 'Todavia faltan minimos reales antes de cerrar este step.'}
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Cierre ejecutivo de la iniciativa" description="Este es el cierre fuerte del proyecto para dejarlo listo para decision ejecutiva." icon={Download}>
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <StatusChip status={executiveDecisionReady ? 'Completado' : 'Pendiente'} size="sm" />
                      <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                        Estado del cierre ejecutivo
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      Marca primero la iniciativa como lista para decision ejecutiva. Cuando ya tengas la decision confirmada y el siguiente paso acordado, finaliza la iniciativa para dejar registro del cierre.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className={`px-2 py-1 rounded-full ${executiveDecisionReady ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        Preparada para decidir
                      </span>
                      <span className={`px-2 py-1 rounded-full ${isProjectClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        Iniciativa {isProjectClosed ? 'finalizada' : 'abierta'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (!adaptiveAlreadyConfirmed) {
                          toast.error('Primero confirma el output de Step 4 en Adaptive Core.');
                          return;
                        }
                        if (!stepFinalized) {
                          toast.error('Primero finaliza Step 4 y deja el siguiente paso definido.');
                          return;
                        }
                        setExecutiveDecisionReady(true);
                        toast.success('Iniciativa marcada como lista para decision ejecutiva.');
                      }}
                      disabled={!stepFinalized || !adaptiveAlreadyConfirmed}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
                        stepFinalized && adaptiveAlreadyConfirmed
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      <CheckCircle2 size={14} /> Marcar listo para decision ejecutiva
                    </button>
                    <button
                      onClick={() => {
                        if (!adaptiveAlreadyConfirmed) {
                          toast.error('Primero confirma el output de Step 4 en Adaptive Core.');
                          return;
                        }
                        if (!initiativeCanBeFinalized) {
                          toast.error('Primero deja la iniciativa lista para decision ejecutiva antes de finalizarla.');
                          return;
                        }
                        setShowFinalizeInitiativeConfirm(true);
                      }}
                      disabled={!initiativeCanBeFinalized || !adaptiveAlreadyConfirmed || isProjectClosed}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
                        initiativeCanBeFinalized && adaptiveAlreadyConfirmed && !isProjectClosed
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-emerald-50 text-emerald-300 border border-emerald-100 cursor-not-allowed'
                      }`}
                      style={{ fontWeight: 700 }}
                    >
                      <CheckCircle2 size={14} /> Finalizar iniciativa
                    </button>
                    <button
                      onClick={() => downloadTextFile('starteria-cierre-ejecutivo.txt', buildFinalSummary())}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Download size={14} /> Descargar resumen final
                    </button>
                    <button
                      onClick={() => copyText(buildFinalSummary(), 'Resumen ejecutivo copiado.')}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Copy size={14} /> Copiar resumen
                    </button>
                  </div>

                  {!initiativeCanBeFinalized ? (
                    <p className="text-xs text-slate-500">
                      {executiveDecisionReady
                        ? 'Cuando la decision quede confirmada y el siguiente paso acordado, podras finalizar la iniciativa.'
                        : 'El boton final se habilita cuando el Step 4 ya este completo y la iniciativa quede marcada como lista para decision ejecutiva.'}
                    </p>
                  ) : null}
                  {initiativeCanBeFinalized && !isProjectClosed ? (
                    <p className="text-xs text-slate-500">
                      Cuando ya tengas la decision confirmada y el siguiente paso acordado, finaliza la iniciativa para dejar registro del cierre.
                    </p>
                  ) : null}

                  <div className={`rounded-xl p-4 ${
                    isProjectClosed
                      ? 'bg-emerald-50 border border-emerald-100'
                      : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <StatusChip status={isProjectClosed ? 'Finalizado' : 'Pendiente'} size="sm" />
                      <StatusChip status={project.status} size="sm" />
                      <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                        Resumen general de cierre
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                      <p><span style={{ fontWeight: 600 }}>Problema:</span> {presentation.problem}</p>
                      <p><span style={{ fontWeight: 600 }}>Hipotesis / solucion:</span> {presentation.proposal}</p>
                      <p><span style={{ fontWeight: 600 }}>Experimento:</span> {presentation.tests}</p>
                      <p><span style={{ fontWeight: 600 }}>Resultados:</span> {presentation.results}</p>
                      <p><span style={{ fontWeight: 600 }}>Decision tomada:</span> {getDecisionSummary(decision)}</p>
                      <p><span style={{ fontWeight: 600 }}>Resultado a mover:</span> {meetingOutcome}</p>
                      <p><span style={{ fontWeight: 600 }}>Plan:</span> {closureType}</p>
                      <p><span style={{ fontWeight: 600 }}>Mentor:</span> {mentorStatus}</p>
                      <p><span style={{ fontWeight: 600 }}>Siguiente paso:</span> {nextStepType || 'Pendiente'}</p>
                      <p><span style={{ fontWeight: 600 }}>Instancia objetivo:</span> {meetingOwner}</p>
                      <p><span style={{ fontWeight: 600 }}>Estado organizacional:</span> {meetingStatus}</p>
                      <p><span style={{ fontWeight: 600 }}>Presentacion:</span> {pdfName}</p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {showFinalizeInitiativeConfirm ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
                  <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h3 className="text-base text-slate-900" style={{ fontWeight: 700 }}>
                        Finalizar iniciativa
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Esto dejará registrada la iniciativa como cerrada y lista como cierre final del proyecto.
                      </p>
                    </div>
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <StatusChip status={project.status} size="sm" />
                        <span>Estado actual del proyecto</span>
                      </div>
                    </div>
                    <div className="px-5 pb-5 flex gap-3">
                      <button
                        onClick={() => setShowFinalizeInitiativeConfirm(false)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2.5 text-sm text-slate-600 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (!projectId) return;
                          if (!adaptiveAlreadyConfirmed) {
                            toast.error('Primero confirma el output de Step 4 en Adaptive Core.');
                            return;
                          }
                          const updatedSteps = project.steps.map((step) =>
                            step.number === 4
                              ? { ...step, status: 'Aprobado' as const, progress: 100 }
                              : step
                          );
                          updateProject(projectId, {
                            status: 'Finalizado',
                            steps: updatedSteps,
                          });
                          setShowFinalizeInitiativeConfirm(false);
                          toast.success('La iniciativa fue finalizada correctamente.');
                        }}
                        className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm text-white transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        Confirmar cierre
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          </fieldset>
        </div>
      </div>
    </div>
  );
}
