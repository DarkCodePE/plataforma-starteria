import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Plus, X, Sparkles, Lock, Send, Calendar,
  CheckCircle2, AlertCircle, Lightbulb, Target, ChevronDown, MessageSquare, HelpCircle, Clock, User,
} from 'lucide-react';
import { enrichProject, type Project, useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import { EvidenceUploader } from '../components/EvidenceUploader';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';
import { StepWorkspaceShell } from '../components/layout/StepWorkspaceShell';
import * as stepService from '../services/stepService';
import { getById } from '../services/projectService';
import { LeaderFeedbackStatusCard } from '../components/LeaderFeedbackStatusCard';
import type { AdaptiveInitiativeCore } from '../../features/adaptive-core/domain/types';
import { canNavigateToAdaptiveStep, latestAdaptiveStepOutput } from '../../features/adaptive-core/domain/adaptiveAuthority';
import { AdaptiveCheckpointWorkspace } from '../../features/adaptive-core/components';
import { confirmAdaptiveCheckpoint, confirmStep2Output, getAdaptiveCore } from '../../features/adaptive-core/services/adaptiveCoreService';

type ModuleId = 'A' | 'B' | 'C' | 'D';

interface Idea { id: string; text: string; cluster?: string }
interface Participant { id: string; name: string }

interface Finalista {
  id: string;
  ideaId: string;
  text: string;
  cluster: string;
  deseable: number;
  viable: number;
  factible: number;
  impacto: number;
  esfuerzo: number;
  razon: string;
  checks: { hmw: boolean; pronto: boolean; diferente: boolean };
}

interface HmwOption {
  id: string;
  text: string;
  why: string;
  source: 'ai' | 'custom';
}

interface ExperimentRoute {
  id: string;
  label: string;
  why: string;
  thisWeek: string;
  keepSimple: string;
  alternatives: string[];
  optionalTools: string[];
  hypothesis: string;
  experiment: string;
  metric: string;
  threshold: string;
}

const EXPERIMENT_FOCUS_OPTIONS = [
  'Que las personas entienden la propuesta',
  'Que las personas usarian la solucion',
  'Que la solucion ahorra tiempo o pasos',
  'Que el flujo ordena mejor la informacion',
  'Que una alerta, recordatorio o seguimiento si ayuda',
  'Que el cambio genera impacto observable',
  'Aun no estoy seguro',
] as const;

const PROTOTYPE_COMFORT_OPTIONS = [
  'Prefiero empezar con algo manual y simple',
  'Puedo armar una prueba visual o guiada',
  'Ya use herramientas sencillas antes',
  'Me siento listo para algo funcional basico',
] as const;

const PROTOTYPE_AUTONOMY_OPTIONS = [
  'Necesito probar sin depender de otra area',
  'Puedo coordinar con una o dos personas',
  'Tengo apoyo para algo un poco mas armado',
] as const;

const PROTOTYPE_FIRST_VERSION_OPTIONS = [
  'Una simulacion manual asistida',
  'Un formulario con registro simple',
  'Una demo visual o mockup',
  'Algo funcional sencillo',
] as const;

const cleanSentence = (value?: string, fallback = 'Sin definir') => {
  const text = value?.trim();
  if (!text) return fallback;
  return text;
};

const trimForCard = (value: string, limit = 140) =>
  value.length <= limit ? value : `${value.slice(0, limit).trim()}...`;

const getExperimentRoute = (
  focus: string,
  comfort: string,
  autonomy: string,
  firstVersion: string,
  selectedIdeaText: string,
): ExperimentRoute => {
  const ideaBase = selectedIdeaText.trim() || 'tu idea finalista';
  const focusLower = focus.toLowerCase();
  const prefersManual = comfort.includes('manual') || autonomy.includes('sin depender') || firstVersion.includes('manual');
  const prefersVisual = comfort.includes('visual') || firstVersion.includes('mockup');
  const hasSimpleTools = comfort.includes('herramientas') || firstVersion.includes('formulario');
  const feelsFunctional = comfort.includes('funcional') || firstVersion.includes('funcional');
  const canAutomate = feelsFunctional && !autonomy.includes('sin depender') && /alerta|recordatorio|seguimiento|flujo/i.test(focusLower);

  if (canAutomate) {
    return {
      id: 'automation',
      label: 'Automatizacion basica',
      why: 'Tu punto de partida ya permite probar un flujo sencillo con una accion automatizada, sin construir algo grande desde el dia uno.',
      thisWeek: 'Puedes validar si la alerta o el seguimiento realmente activa la accion esperada en pocos casos reales.',
      keepSimple: 'No necesitas integrar todo el proceso. Basta con una automatizacion basica sobre un caso acotado.',
      alternatives: ['Formulario + registro simple', 'Demo visual o mockup'],
      optionalTools: ['Forms o Sheets', 'Make, Zapier o n8n', 'Bitacora compartida'],
      hypothesis: `Si activamos una alerta o seguimiento simple alrededor de ${ideaBase.toLowerCase()}, entonces veremos una mejor respuesta inicial porque el recordatorio llega en el momento correcto.`,
      experiment: 'Montar una alerta o disparador simple sobre pocos casos y comparar si cambia la respuesta o el seguimiento.',
      metric: 'Porcentaje de casos que responden o completan la accion esperada con el apoyo del recordatorio.',
      threshold: 'Ver una mejora clara en al menos 3 de 5 casos iniciales.',
    };
  }

  if (feelsFunctional) {
    return {
      id: 'functional',
      label: 'Algo funcional simple',
      why: 'Ya tienes base para probar una version corta de la solucion sin depender de algo complejo o definitivo.',
      thisWeek: 'Puedes validar si el flujo funciona de punta a punta en un caso controlado y con pocos usuarios.',
      keepSimple: 'No busques una solucion completa. Enfocate en un recorrido minimo que deje ver si vale la pena avanzar.',
      alternatives: ['Formulario + registro simple', 'Prueba manual asistida'],
      optionalTools: ['Forms o Notion', 'Sheets', 'Herramienta interna sencilla'],
      hypothesis: `Si armamos una version funcional simple de ${ideaBase.toLowerCase()}, entonces podremos observar si el flujo realmente resuelve la friccion principal.`,
      experiment: 'Probar una version minima con pocos casos reales y registrar fricciones, tiempos y decisiones.',
      metric: 'Cantidad de casos que completan el flujo sin retrabajos importantes.',
      threshold: 'Lograr que la mayoria de los casos piloteados complete el flujo con pocas correcciones.',
    };
  }

  if (prefersVisual) {
    return {
      id: 'visual',
      label: 'Demo visual o mockup',
      why: 'Esta ruta te permite mostrar la propuesta con claridad antes de invertir tiempo en operarla o construirla.',
      thisWeek: 'Puedes validar si las personas entienden la propuesta, el recorrido y el valor esperado.',
      keepSimple: 'Una demo conversada ya puede darte señales utiles. No hace falta tener algo funcionando para aprender.',
      alternatives: ['Prueba manual asistida', 'Formulario + registro simple'],
      optionalTools: ['Figma, Canva o Slides', 'Guion de demo', 'Capturas o storyboard'],
      hypothesis: `Si mostramos una version visual de ${ideaBase.toLowerCase()}, entonces las personas entenderan mejor la propuesta y podran reaccionar con mas claridad.`,
      experiment: 'Preparar una demo breve, recorrerla con 3 a 5 personas y observar dudas, comprension y reaccion.',
      metric: 'Nivel de comprension del flujo y claridad del valor percibido por quienes ven la demo.',
      threshold: 'Que la mayoria pueda explicar con sus palabras para que sirve y donde ayuda.',
    };
  }

  if (hasSimpleTools) {
    return {
      id: 'form',
      label: 'Formulario + registro simple',
      why: 'Tienes condiciones para probar el valor con una estructura ligera y trazable, sin construir un sistema completo.',
      thisWeek: 'Puedes observar si la gente usa la solucion, deja datos utiles o completa el flujo minimo esperado.',
      keepSimple: 'Empieza por capturar informacion y registrar la respuesta. Lo importante es validar la senal, no sofisticar el formato.',
      alternatives: ['Prueba manual asistida', 'Demo visual o mockup'],
      optionalTools: ['Google Forms', 'Sheets', 'Notion o bitacora compartida'],
      hypothesis: `Si habilitamos un formulario simple para ${ideaBase.toLowerCase()}, entonces podremos validar si las personas entienden y usan la propuesta.`,
      experiment: 'Lanzar un formulario o registro simple con pocos casos y seguir manualmente el resultado.',
      metric: 'Cantidad de respuestas utiles, uso inicial y fricciones detectadas en el recorrido.',
      threshold: 'Conseguir suficientes casos para detectar patron de uso y mejoras prioritarias.',
    };
  }

  return {
    id: 'manual',
    label: 'Prueba manual asistida',
    why: 'Es la forma mas liviana y segura de aprender rapido cuando todavia no quieres depender de tecnologia ni de otra area.',
    thisWeek: 'Puedes validar si la propuesta ayuda de verdad, aunque hoy la ejecutes en manual y con acompanamiento cercano.',
    keepSimple: 'No necesitas construir nada grande. Simular el servicio o el flujo tambien cuenta como experimento.',
    alternatives: ['Demo visual o mockup', 'Formulario + registro simple'],
    optionalTools: ['Plantilla o hoja compartida', 'Bitacora simple', 'Guion de prueba'],
    hypothesis: `Si probamos ${ideaBase.toLowerCase()} de forma manual y asistida, entonces sabremos si genera valor real antes de pasar a algo mas armado.`,
    experiment: 'Simular el flujo con pocos casos reales, acompanando paso a paso y registrando lo que ocurre.',
    metric: 'Senales de comprension, uso o mejora observable en los primeros casos.',
    threshold: 'Ver una reaccion positiva o una mejora clara en al menos 3 casos iniciales.',
  };
};

export function Step2Page() {
  const { projectId } = useParams();
  const { projects, projectsLoading, setCurrentProject, updateProject, user } = useApp();
  const navigate = useNavigate();
  const contextProject = projects.find(p => p.id === projectId);
  const [fetchedProject, setFetchedProject] = useState<Project | null>(null);
  const [projectFetching, setProjectFetching] = useState(false);
  const [projectFetchError, setProjectFetchError] = useState(false);
  const project = contextProject ?? fetchedProject;
  const step = project?.steps.find(s => s.number === 2);

  const [activeModule, setActiveModule] = useState<ModuleId>('A');
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [sessionBooked, setSessionBooked] = useState(false);
  const [mentorDate, setMentorDate] = useState('');
  const [mentorTime, setMentorTime] = useState('');
  const [mentorNotes, setMentorNotes] = useState('');
  const [adaptiveCore, setAdaptiveCore] = useState<AdaptiveInitiativeCore | null>(null);
  const [adaptiveCoreStatus, setAdaptiveCoreStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [adaptiveAuthorityError, setAdaptiveAuthorityError] = useState<string | null>(null);
  const [adaptiveTransitionSaving, setAdaptiveTransitionSaving] = useState(false);

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

  // HMW helpers
  const [showHelpA, setShowHelpA] = useState(false);
  const [hmwManualChecks, setHmwManualChecks] = useState({ roles: false, variedad: false });
  const [hmwIAFeedback, setHmwIAFeedback] = useState<null | { ok: boolean; msg: string; tips: string[] }>(null);
  const [hmwIALoading, setHmwIALoading] = useState(false);
  const [showMentorHMW, setShowMentorHMW] = useState(false);
  const [selectedHmwOptionId, setSelectedHmwOptionId] = useState('custom');
  const [customHmwDraft, setCustomHmwDraft] = useState('');
  const [expertCommentDraft, setExpertCommentDraft] = useState('');
  const [experimentExpertComment, setExperimentExpertComment] = useState('');

  // Module B helpers
  const [showReglas, setShowReglas] = useState(false);
  const [activeRonda, setActiveRonda] = useState(1);
  const [iaBLoading, setIaBLoading] = useState(false);
  const [iaBDisparadores, setIaBDisparadores] = useState<string[] | null>(null);
  const [showInspiración, setShowInspiración] = useState(false);
  const [inspiracion, setInspiracion] = useState({ sector: '', link: '', queHacen: '', queCopias: '' });
  const [newIdeaCluster, setNewIdeaCluster] = useState('');
  const [showGroupView, setShowGroupView] = useState(false);
  const [editingIdeaCluster, setEditingIdeaCluster] = useState<string | null>(null);
  const [showIdeasCreativas, setShowIdeasCreativas] = useState(false);
  const [activeVoterId, setActiveVoterId] = useState<string>('self');
  const [ideaSelections, setIdeaSelections] = useState<Record<string, string[]>>({ self: [] });
  const [extraParticipants, setExtraParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [tieDecisionMode, setTieDecisionMode] = useState<'single' | 'combine'>('single');
  const [landedIdeaText, setLandedIdeaText] = useState('');
  const [ideaLandingChecks, setIdeaLandingChecks] = useState({
    recursosMinimos: false,
    pruebaLigera: false,
    versionSimple: false,
  });

  // Module C helpers
  const [cPaso, setCPaso] = useState<1 | 2>(2);
  const [cIaFinalistasLoading, setCIaFinalistasLoading] = useState(false);
  const [cIaComparacionLoading, setCIaComparacionLoading] = useState(false);
  const [cRazonGana, setCRazonGana] = useState('');
  const [cQueProbamos, setCQueProbamos] = useState('');
  const [finalistas, setFinalistas] = useState<Finalista[]>([]);

  const [hmw, setHmw] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState('');

  const [shortlist, setShortlist] = useState<{ id: string; text: string; d: number; v: number; f: number; total: number; justificacion: string }[]>([]);
  const [selectedIdea, setSelectedIdea] = useState('');

  const [solutionCard, setSolutionCard] = useState({
    problema: '',
    usuario: '',
    propuesta: '',
    diferenciador: '',
    hipotesis: '',
    supuestos: '',
  });

  const [testCard, setTestCard] = useState({
    hipotesis: '',
    queTestan: '',
    conQuien: '',
    dondeCuando: '',
    metodo: '',
    metrica: '',
    pasos: [] as string[],
    riesgos: '',
    evidencia: '',
  });

  const [experimentCard, setExperimentCard] = useState({
    name: '',
    problem: '',
    hypothesis: '',
    decision: '',
    expectedOutcome: '',
    minimumMechanism: '',
    tool: '',
    context: '',
    actors: '',
    metric: '',
    evidenceQuant: '',
    evidenceQual: '',
  });
  const [experimentAiLoading, setExperimentAiLoading] = useState(false);
  const [experimentFocus, setExperimentFocus] = useState<string>(EXPERIMENT_FOCUS_OPTIONS[1]);
  const [prototypeComfort, setPrototypeComfort] = useState<string>(PROTOTYPE_COMFORT_OPTIONS[0]);
  const [prototypeAutonomy, setPrototypeAutonomy] = useState<string>(PROTOTYPE_AUTONOMY_OPTIONS[0]);
  const [prototypeFirstVersion, setPrototypeFirstVersion] = useState<string>(PROTOTYPE_FIRST_VERSION_OPTIONS[0]);

  // ── TASK-010: hydrate from backend on mount; mirror Step 1's persistence pattern ─
  // Pull stepData once; if it has a `formData` envelope written by an earlier
  // session, rehydrate the local state. Falls back silently to the existing
  // default fixtures when nothing is persisted (preserves the empty state).
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await stepService.getStepData(projectId, 2);
        if (cancelled || !stored || typeof stored !== 'object') return;
        const formData = (stored as { formData?: Record<string, unknown> }).formData;
        if (!formData) return;
        if (typeof formData.hmw === 'string') setHmw(formData.hmw);
        if (Array.isArray(formData.ideas)) setIdeas(formData.ideas as Idea[]);
        if (Array.isArray(formData.shortlist)) setShortlist(formData.shortlist as typeof shortlist);
        if (formData.solutionCard && typeof formData.solutionCard === 'object')
          setSolutionCard(formData.solutionCard as typeof solutionCard);
        if (formData.testCard && typeof formData.testCard === 'object')
          setTestCard(formData.testCard as typeof testCard);
        if (formData.experimentCard && typeof formData.experimentCard === 'object')
          setExperimentCard(formData.experimentCard as typeof experimentCard);
        if (typeof formData.experimentFocus === 'string') setExperimentFocus(formData.experimentFocus);
        if (typeof formData.prototypeComfort === 'string') setPrototypeComfort(formData.prototypeComfort);
        if (typeof formData.prototypeAutonomy === 'string') setPrototypeAutonomy(formData.prototypeAutonomy);
        if (typeof formData.prototypeFirstVersion === 'string') setPrototypeFirstVersion(formData.prototypeFirstVersion);
      } catch {
        // 404 or auth error — keep defaults silently; AutosaveIndicator will reflect future writes.
      }
    })();
    return () => { cancelled = true; };
    // We only want to hydrate on project change, not on every state mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Single object passed through to useAutosave so the hook gets a stable
  // `data` reference shape (matches Step 1's pattern in Step1Page.tsx).
  const step2FormData = {
    hmw,
    ideas,
    shortlist,
    solutionCard,
    testCard,
    experimentCard,
    experimentFocus,
    prototypeComfort,
    prototypeAutonomy,
    prototypeFirstVersion,
  };

  const autosaveFn = useCallback(
    async (data: typeof step2FormData) => {
      if (!projectId) return;
      await stepService.saveStepData(projectId, 2, {
        _meta: { version: 1, lastSavedAt: new Date().toISOString(), lastSavedBy: 'user' },
        formData: data,
      });
    },
    [projectId],
  );

  const { state: saveState } = useAutosave({
    data: step2FormData,
    saveFn: autosaveFn,
    delay: 2000,
    // Sólo quien puede escribir guarda: el Portfolio Lead asignado lee la iniciativa sin ser del
    // equipo y el backend le rechaza el PUT (step.access.ts).
    enabled: !!projectId && (!!contextProject || user?.role === 'admin' || user?.role === 'mentor'),
  });

  const loadAdaptiveCore = useCallback(async () => {
    if (!projectId) return null;
    setAdaptiveCoreStatus('loading');
    setAdaptiveAuthorityError(null);
    try {
      const core = await getAdaptiveCore(projectId);
      setAdaptiveCore(core);
      setAdaptiveCoreStatus('loaded');
      return core;
    } catch (err: any) {
      setAdaptiveCore(null);
      setAdaptiveCoreStatus('error');
      setAdaptiveAuthorityError(err?.response?.data?.error?.message ?? err?.message ?? 'No pudimos cargar el estado adaptativo persistido.');
      return null;
    }
  }, [projectId]);

  useEffect(() => {
    void loadAdaptiveCore();
  }, [loadAdaptiveCore]);

  const confirmStep2Transition = async () => {
    if (!projectId || !project) return;
    setAdaptiveTransitionSaving(true);
    setAdaptiveAuthorityError(null);
    try {
      const draft = latestAdaptiveStepOutput(adaptiveCore, 2, 'draft');
      await confirmStep2Output(projectId, {
        idempotencyKey: `${projectId}-step2-output-${draft?.id ?? 'ui'}-confirm`,
        brief: draft?.output ?? step2FormData,
        confirmed: true,
      });
      const refreshedCore = await loadAdaptiveCore();
      if (!refreshedCore || !canNavigateToAdaptiveStep(refreshedCore, 3)) {
        throw new Error('El backend confirmó Step 2, pero Step 3 todavía no aparece activo en el estado adaptativo persistido.');
      }
      const updatedSteps = project.steps.map(s => {
        if (s.number === 2) return { ...s, status: 'Aprobado' as const, progress: 100 };
        if (s.number === 3) return { ...s, status: s.status === 'Bloqueado' ? 'En progreso' as const : s.status };
        return s;
      });
      updateProject(projectId, { steps: updatedSteps, status: 'En progreso' });
      setShowMentorModal(false);
      setSessionBooked(true);
      toast.success('Step 2 confirmado en Adaptive Core.', {
        description: 'Step 3 ya esta disponible desde el estado persistido.',
        duration: 3000,
      });
      navigate(`/projects/${projectId}/step/3`);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message ?? err?.message ?? 'No pudimos confirmar Step 2 en Adaptive Core.';
      setAdaptiveAuthorityError(message);
      toast.error(message);
    } finally {
      setAdaptiveTransitionSaving(false);
    }
  };

  const confirmAdaptiveStep2Checkpoint = async (responses: Record<string, unknown>, truthBindings?: { claimId: string; evidenceIds: string[]; sourceRefIds: string[] }) => {
    if (!projectId || !adaptiveCore?.activeCheckpoint || adaptiveCore.activeCheckpoint.step !== 2) return;
    setAdaptiveTransitionSaving(true);
    setAdaptiveAuthorityError(null);
    try {
      const nextCore = await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `${projectId}-${adaptiveCore.activeCheckpoint.checkpointKey}-${Date.now()}-ui-confirm`,
        checkpointKey: adaptiveCore.activeCheckpoint.checkpointKey,
        responses,
        truthBindings,
      });
      setAdaptiveCore(nextCore);
    } catch (error: any) {
      setAdaptiveAuthorityError(error?.response?.data?.error?.message ?? error?.message ?? 'No pudimos confirmar el checkpoint adaptativo.');
    } finally {
      setAdaptiveTransitionSaving(false);
    }
  };

  const adaptiveStep2Allowed = adaptiveCoreStatus === 'loaded' && canNavigateToAdaptiveStep(adaptiveCore, 2);

  const baseParticipants: Participant[] = (project?.team?.length ?? 0) > 1
    ? project!.team.map(member => ({ id: member.id, name: member.name }))
    : [{ id: 'self', name: 'Tu' }];
  const teamParticipants: Participant[] = [...baseParticipants, ...extraParticipants];
  const selectionMap = teamParticipants.reduce<Record<string, string[]>>((acc, participant) => {
    acc[participant.id] = ideaSelections[participant.id] || [];
    return acc;
  }, {});
  const individualMode = teamParticipants.length === 1;
  const currentVoterId = teamParticipants.some(participant => participant.id === activeVoterId)
    ? activeVoterId
    : teamParticipants[0]?.id || 'self';

  const toggleIdeaVote = (participantId: string, ideaId: string) => {
    setIdeaSelections(prev => {
      const current = prev[participantId] || [];
      const exists = current.includes(ideaId);
      if (exists) {
        return { ...prev, [participantId]: current.filter(id => id !== ideaId) };
      }
      if (current.length >= 3) return prev;
      return { ...prev, [participantId]: [...current, ideaId] };
    });
  };

  const assignIdeaRank = (participantId: string, ideaId: string, rankIndex: number) => {
    setIdeaSelections(prev => {
      const current = [...(prev[participantId] || [])];
      const withoutIdea = current.filter(id => id !== ideaId);
      const next = [...withoutIdea];
      next[rankIndex] = ideaId;
      const compact = next.filter(Boolean);
      return { ...prev, [participantId]: compact.slice(0, 3) };
    });
  };

  const addVotingParticipant = () => {
    const cleanName = newParticipantName.trim();
    if (!cleanName) return;

    const alreadyExists = [...baseParticipants, ...extraParticipants].some(participant =>
      participant.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (alreadyExists) {
      toast.error('Ese integrante ya aparece en la votacion.');
      return;
    }

    const id = `extra-${Date.now()}`;
    setExtraParticipants(prev => [...prev, { id, name: cleanName }]);
    setIdeaSelections(prev => ({ ...prev, [id]: [] }));
    setActiveVoterId(id);
    setNewParticipantName('');
  };

  const selectFinalIdeaBase = (ideaId: string) => {
    if (selectedIdea !== ideaId) setLandedIdeaText('');
    setSelectedIdea(ideaId);
  };

  const challengeAnchor = {
    title: cleanSentence(project?.step0Data?.quePasaQueQuieres?.split('.').shift(), 'Problema validado del Step 1'),
    summary: cleanSentence(project?.step0Data?.quePasaQueQuieres, 'Todavia falta una descripcion breve del problema validado.'),
    impact: cleanSentence(project?.step0Data?.impacto3meses?.replace(/_/g, ' '), 'Impacto principal pendiente de precisar'),
    affected: project?.step0Data?.impacta?.length ? project.step0Data.impacta.join(', ') : 'Personas o equipos afectados por confirmar',
    area: cleanSentence(project?.step0Data?.rolArea, 'Area o equipo por confirmar'),
    redLine: project?.step0Data?.respaldo === 'datos'
      ? 'No comprometer datos sensibles ni accesos.'
      : 'Respetar la linea roja principal definida en Step 1.',
  };
  const hmwRestriction = challengeAnchor.redLine.toLowerCase().replace(/^no\s+/, '').replace(/\.$/, '');

  const hmwOptions = useMemo<HmwOption[]>(() => [
    {
      id: 'ai-1',
      text: `¿Cómo podríamos reducir ${challengeAnchor.summary.toLowerCase()}, para ${challengeAnchor.affected.toLowerCase()}, sin ${hmwRestriction}?`,
      why: 'Sirve si quieres enfocar el HMW en la mejora principal sin perder la restriccion clave.',
      source: 'ai',
    },
    {
      id: 'ai-2',
      text: `¿Cómo podríamos mejorar la experiencia de ${challengeAnchor.affected.toLowerCase()} frente a ${challengeAnchor.title.toLowerCase()}, sin ${hmwRestriction}?`,
      why: 'Sirve si quieres abrir ideas centradas en quien vive el problema directamente.',
      source: 'ai',
    },
    {
      id: 'ai-3',
      text: `¿Cómo podríamos abordar ${challengeAnchor.title.toLowerCase()} en ${challengeAnchor.area.toLowerCase()}, para lograr un impacto en ${challengeAnchor.impact.toLowerCase()}, sin ${hmwRestriction}?`,
      why: 'Sirve si quieres que el HMW conecte con el area afectada y el impacto esperado.',
      source: 'ai',
    },
    {
      id: 'custom',
      text: customHmwDraft.trim(),
      why: 'Tu propio HMW puede quedar activo si se conecta bien con el problema validado.',
      source: 'custom',
    },
  ], [challengeAnchor.affected, challengeAnchor.area, challengeAnchor.impact, challengeAnchor.summary, challengeAnchor.title, customHmwDraft, hmwRestriction]);

  const selectedHmwOption = hmwOptions.find(option => option.id === selectedHmwOptionId) || hmwOptions[0];

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

  if (!project || !step) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Proyecto no encontrado.</p>
      </div>
    );
  }

  // ── HMW live checks ──────────────────────────────────────────────────────────
  if (adaptiveCoreStatus === 'loading') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Cargando estado adaptativo</h2>
        <p className="text-sm text-slate-500">Validando con backend si Step 2 esta disponible.</p>
      </div>
    );
  }
  if (adaptiveCoreStatus === 'error' || !adaptiveStep2Allowed) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Step 2 bloqueado</h2>
        <p className="text-sm text-slate-500 mb-4">
          {adaptiveCoreStatus === 'error'
            ? adaptiveAuthorityError
            : 'El backend Adaptive Core todavia no habilita Step 2.'}
        </p>
        <div className="flex justify-center gap-2">
          {adaptiveCoreStatus === 'error' ? (
            <button onClick={() => void loadAdaptiveCore()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
              Reintentar
            </button>
          ) : null}
          <button onClick={() => navigate(`/projects/${projectId}/step/1`)} className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
            Ir al Step 1
          </button>
        </div>
      </div>
    );
  }

  const adaptiveStep2Checkpoint = adaptiveCore?.activeCheckpoint?.step === 2 ? adaptiveCore.activeCheckpoint : null;
  const adaptiveStep2Draft = latestAdaptiveStepOutput(adaptiveCore, 2, 'draft');
  const adaptiveStep2Confirmed = Boolean(latestAdaptiveStepOutput(adaptiveCore, 2, 'confirmed'));
  return (
    <main className="min-h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => navigate(`/projects/${projectId}`)} className="mb-5 text-sm text-slate-500 hover:text-slate-800">Volver al proyecto</button>
        <AdaptiveCheckpointWorkspace
          core={adaptiveCore!}
          step={2}
          checkpoint={adaptiveStep2Checkpoint}
          questions={adaptiveStep2Checkpoint?.questions ?? []}
          initialResponses={{ ...adaptiveCore?.confirmedResponses, ...(adaptiveCore?.activeCheckpoint?.responses ?? {}) }}
          outputPreview={adaptiveStep2Draft?.output ?? null}
          outputConfirmed={adaptiveStep2Confirmed}
          saving={adaptiveTransitionSaving}
          error={adaptiveAuthorityError}
          onConfirmCheckpoint={adaptiveStep2Checkpoint ? confirmAdaptiveStep2Checkpoint : undefined}
          onConfirmOutput={adaptiveStep2Draft ? confirmStep2Transition : undefined}
          onRefresh={() => void loadAdaptiveCore()}
        />
      </div>
    </main>
  );

  const hmwChecks = {
    starts: /^¿?(c|C)(ó|o)mo podr(í|i)amos/i.test(hmw.trim()),
    noSolucion: !/(app\b|chatbot|automatizar|sistema\b|crear\b|plataforma\b|herramienta\b|portal\b|\bbot\b)/i.test(hmw),
    tieneRestriccion: /\bsin\b/i.test(hmw),
    tieneRol: hmwManualChecks.roles,
    tieneVariedad: hmwManualChecks.variedad,
  };
  const hmwChecksPassed = Object.values(hmwChecks).filter(Boolean).length;
  const hmwListo = hmwChecksPassed >= 4;

  const hmwAlerts: string[] = [];
  if (hmw.trim().length > 10) {
    if (!hmwChecks.starts)
      hmwAlerts.push('Tu pregunta no empieza con "¿Cómo podríamos…?". Eso la diferencia de una tarea o solución y abre el espacio de ideas.');
    if (!hmwChecks.noSolucion)
      hmwAlerts.push('Parece que ya hay una solución en la pregunta (app, sistema, automatizar…). Describe el resultado que buscas, no cómo lograrlo.');
    if (hmwChecks.starts && !hmwChecks.tieneRestriccion && hmw.trim().split(' ').length > 8)
      hmwAlerts.push('La pregunta no menciona qué no se puede romper. Considera agregar "sin [línea roja]" para acotar el espacio de ideas.');
  }

  const handleHmwIA = () => {
    setHmwIALoading(true);
    setTimeout(() => {
      const currentHmw = selectedHmwOptionId === 'custom' ? customHmwDraft : hmw;
      const issues: string[] = [];
      if (!hmwChecks.starts) issues.push('Empieza con "¿Cómo podríamos…?" para que sea una pregunta de ideas, no una tarea.');
      if (!hmwChecks.noSolucion) issues.push('Quita la solución de la pregunta. Describe el resultado que buscas, no el medio.');
      if (!hmwChecks.tieneRestriccion) issues.push('Considera agregar una restricción con "sin [línea roja]" para acotar el espacio.');
      setHmwIAFeedback(
        issues.length === 0
          ? { ok: true, msg: 'Tu HMW tiene buena forma para pasar al módulo de ideas.', tips: ['Revisa que nombre a quien afecta y que no cierre demasiado pronto el espacio de solución.', 'Si quieres, puedes tomar otra sugerencia IA o refinar esta misma redacción.'] }
          : { ok: false, msg: `Este HMW todavía puede mejorar antes de pasar a ideación: "${trimForCard(currentHmw, 90)}"`, tips: issues }
      );
      setHmwIALoading(false);
    }, 1600);
  };

  const selectHmwOption = (option: HmwOption) => {
    setSelectedHmwOptionId(option.id);
    setHmw(option.text);
    setHmwIAFeedback(null);
  };

  const applyGeneratedSuggestions = () => {
    const nextOption = hmwOptions.find(option => option.id === 'ai-1');
    if (!nextOption) return;
    selectHmwOption(nextOption);
    setHmwIAFeedback({
      ok: true,
      msg: 'La IA te propone tres HMW para elegir o usar como base.',
      tips: [
        'Selecciona el que mejor conecte con el problema validado.',
        'Si ninguno te convence, crea tu propio HMW y dejalo como activo.',
      ],
    });
  };

  // ── Module C handlers ────────────────────────────────────────────────────────
  const addFinalista = (idea: Idea) => {
    if (finalistas.some(f => f.ideaId === idea.id) || finalistas.length >= 5) return;
    setFinalistas(p => [...p, {
      id: Date.now().toString(),
      ideaId: idea.id,
      text: idea.text,
      cluster: idea.cluster || 'Sin grupo',
      deseable: 3, viable: 3, factible: 3, impacto: 3, esfuerzo: 3,
      razon: '',
      checks: { hmw: false, pronto: false, diferente: false },
    }]);
  };

  const removeFinalista = (id: string) => {
    const removed = finalistas.find(f => f.id === id);
    setFinalistas(p => p.filter(f => f.id !== id));
    if (removed && selectedIdea === removed.ideaId) setSelectedIdea('');
  };

  const updateFinalistaScore = (id: string, key: 'deseable' | 'viable' | 'factible' | 'impacto' | 'esfuerzo', value: number) => {
    setFinalistas(p => p.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const updateFinalistaCheck = (id: string, key: 'hmw' | 'pronto' | 'diferente', value: boolean) => {
    setFinalistas(p => p.map(f => f.id === id ? { ...f, checks: { ...f.checks, [key]: value } } : f));
  };

  const handleIaCFinalistas = () => {
    setCIaFinalistasLoading(true);
    setTimeout(() => {
      const byCluster: Record<string, Idea[]> = {};
      ideas.forEach(idea => {
        if (idea.cluster) {
          if (!byCluster[idea.cluster]) byCluster[idea.cluster] = [];
          byCluster[idea.cluster].push(idea);
        }
      });
      const picked: Idea[] = [];
      Object.values(byCluster).forEach(clusterIdeas => {
        clusterIdeas.slice(0, 2).forEach(idea => { if (picked.length < 5) picked.push(idea); });
      });
      setFinalistas(picked.map((idea, i) => ({
        id: `ia-f-${Date.now()}-${i}`,
        ideaId: idea.id,
        text: idea.text,
        cluster: idea.cluster || 'Sin grupo',
        deseable: 3, viable: 3, factible: 3, impacto: 3, esfuerzo: 3,
        razon: '',
        checks: { hmw: false, pronto: false, diferente: false },
      })));
      setCIaFinalistasLoading(false);
    }, 1800);
  };

  const handleIaCComparacion = () => {
    setCIaComparacionLoading(true);
    const reasons = [
      'Suposición: TI puede implementar en 2 semanas. Pregunta: ¿quién es el dueño del proceso?',
      'Suposición: los accesos estándar cubren el 80% de casos. Pregunta: ¿TI tiene perfiles predefinidos?',
      'Suposición: el equipo adoptará el cambio. Pregunta: ¿cuánto tardaría la capacitación inicial?',
    ];
    setTimeout(() => {
      setFinalistas(prev => prev.map((f, i) => ({
        ...f,
        deseable: [5, 5, 4][i] ?? 3,
        viable:   [4, 3, 5][i] ?? 3,
        factible: [4, 2, 4][i] ?? 3,
        impacto:  [4, 5, 4][i] ?? 3,
        esfuerzo: [4, 2, 4][i] ?? 3,
        razon: reasons[i % reasons.length],
      })));
      setCIaComparacionLoading(false);
    }, 1800);
  };

  // ── Module B computed ─────────────────────────────────────────────────────────
  const uniqueClusters = [...new Set(ideas.filter(i => i.cluster).map(i => i.cluster as string))];
  const ideaVoteSummary = ideas.map(idea => ({
    ...idea,
    votes: teamParticipants.reduce((total, participant) => total + ((selectionMap[participant.id] || []).includes(idea.id) ? 1 : 0), 0),
  })).sort((left, right) => right.votes - left.votes);
  const topIdeas = ideaVoteSummary.filter(item => item.votes > 0).slice(0, 3);
  const highestVoteCount = topIdeas[0]?.votes || 0;
  const tiedIdeas = highestVoteCount > 0 ? topIdeas.filter(item => item.votes === highestVoteCount) : [];
  const hasTie = tiedIdeas.length > 1;
  const currentSelections = selectionMap[currentVoterId] || [];
  const currentTopIdeas = currentSelections.map(ideaId => ideas.find(idea => idea.id === ideaId)).filter(Boolean) as Idea[];
  const currentSelectionMissing = Math.max(0, 3 - currentSelections.length);
  const teamCompletedCount = teamParticipants.filter(participant => (selectionMap[participant.id] || []).length === 3).length;
  const participantStatuses = teamParticipants.map(participant => {
    const selectedCount = (selectionMap[participant.id] || []).length;
    const status = selectedCount === 3 ? 'completo' : selectedCount > 0 ? 'en_curso' : 'pendiente';
    return {
      ...participant,
      selectedCount,
      status,
      topIdeas: (selectionMap[participant.id] || [])
        .map(ideaId => ideas.find(idea => idea.id === ideaId)?.text)
        .filter(Boolean) as string[],
    };
  });
  const currentVoterName = participantStatuses.find(participant => participant.id === currentVoterId)?.name || 'Integrante';
  const votesStarted = participantStatuses.some(participant => participant.selectedCount > 0);
  const votesThreshold = individualMode ? 1 : Math.max(1, Math.ceil(teamParticipants.length / 2));
  const phase2Unlocked = individualMode
    ? currentSelections.length === 3
    : teamCompletedCount >= votesThreshold;
  const phase3Unlocked = phase2Unlocked && topIdeas.length > 0;
  const currentFlowPhase: 1 | 2 | 3 = phase3Unlocked && selectedIdea ? 3 : phase2Unlocked ? 2 : 1;
  const selectedIdeaText = ideas.find(idea => idea.id === selectedIdea)?.text || '';
  const landingChecksComplete = Object.values(ideaLandingChecks).filter(Boolean).length >= 2;
  const ideaNeedsLanding = /robot|ia\b|app\b|plataforma|automatiz|integraci|sistema/i.test(selectedIdeaText);
  const landedIdeaReady = Boolean(
    selectedIdea &&
    (ideaNeedsLanding || !landingChecksComplete ? landedIdeaText.trim().length > 0 : true),
  );
  const moduloBListo = ideas.length >= 10
    && teamParticipants.every(participant => (selectionMap[participant.id] || []).length === 3)
    && Boolean(selectedIdea)
    && landedIdeaReady;
  const ideasProgressMsg =
    ideas.length === 0 ? 'Escribe tu primera idea para arrancar.' :
    ideas.length < 5   ? `Vas bien — te faltan ${10 - ideas.length} ideas para el mínimo.` :
    ideas.length < 10  ? `¡Buen ritmo! Te faltan ${10 - ideas.length} para el mínimo de 10.` :
    ideas.length < 15  ? '¡Mínimo cumplido! ¿Puedes llegar a 15?' :
                         '¡Excelente variedad! Ya puedes pasar a elegir tus mejores ideas.';

  const experimentRoute = getExperimentRoute(
    experimentFocus,
    prototypeComfort,
    prototypeAutonomy,
    prototypeFirstVersion,
    selectedIdeaText,
  );
  const recommendationReady = Boolean(
    experimentFocus.trim()
    && prototypeComfort.trim()
    && prototypeAutonomy.trim()
    && prototypeFirstVersion.trim()
  );
  const experimentBridgeProgress = [
    experimentFocus,
    prototypeComfort,
    prototypeAutonomy,
    prototypeFirstVersion,
  ].filter(value => value.trim().length > 0).length;
  const completedExperimentSteps = testCard.pasos.filter(step => step.trim().length > 0).length;
  const moduleCReady = Boolean(
    selectedIdea
    && experimentCard.name.trim()
    && experimentCard.problem.trim()
    && experimentCard.hypothesis.trim()
    && experimentCard.decision.trim()
    && experimentCard.expectedOutcome.trim()
    && experimentCard.minimumMechanism.trim()
    && experimentCard.tool.trim()
    && experimentCard.context.trim()
    && experimentCard.actors.trim()
    && experimentCard.metric.trim()
    && experimentCard.evidenceQuant.trim()
    && experimentCard.evidenceQual.trim()
    && completedExperimentSteps >= 5
    && completedExperimentSteps <= 8
  );

  const handleIaB = () => {
    setIaBLoading(true);
    setTimeout(() => {
      setIaBDisparadores([
        '¿Qué harías si tienes que resolver esto mañana con lo que ya tienes?',
        '¿Qué podrías quitar del proceso actual sin que cambie nada importante?',
        '¿Qué podrías unir que hoy está separado en dos pasos o dos personas?',
        '¿Qué pasaría si inviertes el orden? (el empleado pide, no TI aprueba)',
        '¿Cómo lo resolvería un servicio de delivery que promete en 30 minutos?',
        '¿Qué puede gestionar el propio empleado, sin depender de TI?',
        '¿Y si el acceso llegara antes de que el empleado llegue?',
        '¿Cómo lo haría alguien que procesa miles de solicitudes por día?',
        '¿Qué harías si no puedes gastar ni un peso más?',
        '¿Cómo simplificarías este proceso a 3 pasos máximo?',
      ]);
      setIaBLoading(false);
    }, 1800);
  };

  const handleIaExperimentGuide = () => {
    setExperimentAiLoading(true);
    setTimeout(() => {
      const ideaBase = selectedIdeaText || 'la idea elegida';
      setExperimentCard(prev => ({
        ...prev,
        minimumMechanism: prev.minimumMechanism.trim() || `Una version minima de ${ideaBase.toLowerCase()} que pueda activarse con pocos pasos y sin desarrollo pesado.`,
        tool: prev.tool.trim() || 'Formulario simple + seguimiento manual en Sheets',
        context: prev.context.trim() || 'Prueba piloto con pocos casos reales durante una semana, en un momento controlado del proceso.',
        metric: prev.metric.trim() || 'Senal clara de adopcion o reduccion de friccion en al menos 3 casos iniciales.',
      }));
      setExperimentAiLoading(false);
    }, 1400);
  };

  const applyExperimentRouteSuggestion = () => {
    setExperimentCard(prev => ({
      ...prev,
      hypothesis: prev.hypothesis.trim() || experimentRoute.hypothesis,
      minimumMechanism: prev.minimumMechanism.trim() || experimentRoute.experiment,
      tool: prev.tool.trim() || experimentRoute.optionalTools.join(' · '),
      metric: prev.metric.trim() || `${experimentRoute.metric} Umbral inicial: ${experimentRoute.threshold}`,
    }));
    setTestCard(prev => ({
      ...prev,
      hipotesis: prev.hipotesis.trim() || experimentRoute.hypothesis,
      queTestan: prev.queTestan.trim() || experimentRoute.experiment,
      metodo: prev.metodo.trim() || experimentRoute.label,
      metrica: prev.metrica.trim() || `${experimentRoute.metric} Umbral inicial: ${experimentRoute.threshold}`,
    }));
    toast.success('Llevamos esta recomendacion como borrador a tu Card de experimento.');
  };

  const modules = [
    { id: 'A' as ModuleId, label: 'A · HMW', completed: hmwListo },
    { id: 'B' as ModuleId, label: 'B · Ideas', completed: moduloBListo },
    { id: 'C' as ModuleId, label: 'C · Cards de experimentación', completed: moduleCReady },
  ];

  const mobileBackButton = (
    <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
      <ArrowLeft size={14} /> Volver al proyecto
    </button>
  );

  return (
    <>
    <StepWorkspaceShell
      railWidth="standard"
      variant="base"
      rail={
        <>
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <h2 className="text-sm text-slate-900 mt-2" style={{ fontWeight: 600 }}>Step 2</h2>
          <p className="text-xs text-slate-500">Diseñar solución</p>
        </div>
        {modules.map(mod => (
          <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${activeModule === mod.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`} style={{ fontWeight: activeModule === mod.id ? 600 : 400 }}>
            {mod.completed ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <span className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />}
            {mod.label}
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <AutosaveIndicator state={saveState} />
        </div>
        </>
      }
    >
        {mobileBackButton}
          <div className="mb-5">
            <LeaderFeedbackStatusCard project={project} updateProject={updateProject} variant="step2" compact />
          </div>
          {activeModule !== 'A' && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-5 text-xs text-indigo-700">
              <p style={{ fontWeight: 600 }}>Ancla del reto validado</p>
              <p className="mt-1">{trimForCard(challengeAnchor.summary, 150)}</p>
              <p className="mt-0.5 text-indigo-500">Impacto: {challengeAnchor.impact} · Afecta a: {challengeAnchor.affected}</p>
              <p className="mt-0.5 text-indigo-500">Línea roja: {challengeAnchor.redLine} · Área: {challengeAnchor.area}</p>
            </div>
          )}

          {/* Module A: HMW */}
          {activeModule === 'A' && (
            <div className="space-y-5">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo A · HMW — ¿Cómo podríamos?</h1>
                    <StatusChip status={hmwListo ? 'Completado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-2xl">
                    Ya validaste el reto. Ahora conviértelo en una pregunta útil para abrir ideas con foco, antes de elegir cualquier solución.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500" style={{ fontWeight: 700 }}>Reto validado del Step 1</p>
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{challengeAnchor.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{trimForCard(challengeAnchor.summary, 180)}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] text-slate-500" style={{ fontWeight: 700 }}>Impacto</p>
                    <p className="text-sm text-slate-700 mt-1">{challengeAnchor.impact}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] text-slate-500" style={{ fontWeight: 700 }}>A quién afecta</p>
                    <p className="text-sm text-slate-700 mt-1">{challengeAnchor.affected}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] text-slate-500" style={{ fontWeight: 700 }}>Área implicada</p>
                    <p className="text-sm text-slate-700 mt-1">{challengeAnchor.area}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[11px] text-slate-500" style={{ fontWeight: 700 }}>Línea roja</p>
                    <p className="text-sm text-slate-700 mt-1">{challengeAnchor.redLine}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-indigo-500" />
                  <p className="text-sm text-indigo-900" style={{ fontWeight: 700 }}>Tu tarea ahora</p>
                </div>
                <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>
                  Convierte este reto en una pregunta que abra soluciones con foco.
                </p>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  Aquí no eliges una solución todavía. Un buen HMW abre una pregunta útil para explorar opciones sin cerrarte demasiado pronto.
                </p>
                <p className="text-xs text-indigo-700">
                  Plantilla simple: <span className="text-indigo-900">“¿Cómo podríamos [mejorar algo] para [quién], sin [restricción o línea roja]?”</span>
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => setShowHelpA(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 hover:bg-slate-100 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    <HelpCircle size={14} className="text-slate-400" />
                    Antes de cerrar tu HMW, revisa esto
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showHelpA ? 'rotate-180' : ''}`} />
                </button>
                {showHelpA && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100">
                    <ul className="space-y-2">
                      {[
                        'No metas la solucion dentro de la pregunta.',
                        'Nombra con claridad que reto o mejora quieres abordar.',
                        'Deja claro a quien afecta directamente.',
                        'Incluye la linea roja principal o restriccion clave.',
                        'Busca una pregunta que abra posibilidades, no una sola respuesta obvia.',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                          <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{i + 1}</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Opciones sugeridas de HMW</p>
                    <p className="text-xs text-slate-500 mt-1">Elige una de estas 3 sugerencias IA o crea tu propio HMW y déjalo como activo.</p>
                  </div>
                  <button
                    onClick={applyGeneratedSuggestions}
                    disabled={hmwIALoading}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                    style={{ fontWeight: 500 }}
                  >
                    <Sparkles size={11} /> Generar sugerencias con IA
                  </button>
                </div>

                <div className="grid gap-3">
                  {hmwOptions.filter(option => option.source === 'ai').map(option => {
                    const isActive = selectedHmwOptionId === option.id || hmw === option.text;
                    return (
                      <button
                        key={option.id}
                        onClick={() => selectHmwOption(option)}
                        className={`text-left rounded-2xl border p-4 transition-colors ${isActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-sm ${isActive ? 'text-indigo-900' : 'text-slate-800'}`} style={{ fontWeight: 700 }}>{option.text}</p>
                            <p className={`text-xs mt-2 ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>{option.why}</p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`} style={{ fontWeight: 700 }}>
                            {isActive ? 'HMW activo' : 'Seleccionar'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Crear mi propio HMW</p>
                    <p className="text-xs text-slate-500 mt-1">Si prefieres otra redacción, escríbela aquí y también podrá quedar como HMW activo.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedHmwOptionId('custom');
                      setHmw(customHmwDraft);
                      setHmwIAFeedback(null);
                    }}
                    disabled={!customHmwDraft.trim()}
                    className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    style={{ fontWeight: 600 }}
                  >
                    Dejar como HMW activo
                  </button>
                </div>
                <textarea
                  value={customHmwDraft}
                  onChange={e => {
                    const value = e.target.value;
                    setCustomHmwDraft(value);
                    if (selectedHmwOptionId === 'custom') setHmw(value);
                    setHmwIAFeedback(null);
                  }}
                  rows={3}
                  placeholder="Ej. ¿Cómo podríamos reducir el tiempo que espera un empleado nuevo para tener sus accesos, sin comprometer la seguridad del sistema?"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none focus:bg-white transition-all"
                />
                <p className="text-xs text-slate-400">
                  Plantilla simple: <span className="text-slate-600">“¿Cómo podríamos [mejorar algo] para [quién], sin [restricción o línea roja]?”</span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>HMW seleccionado</p>
                    <p className="text-xs text-slate-500 mt-1">Este es el output del módulo: una sola pregunta guía, clara y conectada al problema validado.</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${hmwListo ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 700 }}>
                    {hmwListo ? 'Listo para pasar a ideación' : 'Todavía necesita ajuste'}
                  </span>
                </div>
                <div className="rounded-xl border border-white bg-white p-4">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    {hmw || 'Selecciona una sugerencia o escribe tu propio HMW para dejarlo activo.'}
                  </p>
                </div>
              </div>

              {/* ── Checklist live ── */}
              {hmw.trim().length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Recomendaciones para cerrar un buen HMW</p>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {/* Auto-checks */}
                    {([
                      { key: 'starts', label: 'Empieza con "¿Cómo podríamos…?"', passed: hmwChecks.starts },
                      { key: 'noSol', label: 'No menciona una solución específica (app, bot, sistema…)', passed: hmwChecks.noSolucion },
                      { key: 'restriccion', label: 'Incluye una restricción o línea roja, ej. "sin [algo]"', passed: hmwChecks.tieneRestriccion },
                    ] as const).map(check => (
                      <div key={check.key} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${check.passed ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          {check.passed
                            ? <CheckCircle2 size={10} className="text-emerald-600" />
                            : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                        </div>
                        <p className={`text-xs transition-colors ${check.passed ? 'text-slate-700' : 'text-slate-400'}`}>{check.label}</p>
                        {check.passed && <span className="text-xs text-emerald-500 ml-auto">✓</span>}
                      </div>
                    ))}
                    {/* Manual checks */}
                    {([
                      { key: 'roles' as const, label: 'Nombra a quién le pasa el problema (rol o persona afectada)' },
                      { key: 'variedad' as const, label: 'Permite sacar ideas muy distintas, no una sola respuesta obvia' },
                    ]).map(check => (
                      <div key={check.key} className="flex items-center gap-2.5">
                        <button
                          onClick={() => setHmwManualChecks(p => ({ ...p, [check.key]: !p[check.key] }))}
                          className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${hmwManualChecks[check.key] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white hover:border-indigo-300'}`}
                        >
                          {hmwManualChecks[check.key] && <span className="text-white text-xs">✓</span>}
                        </button>
                        <p
                          className={`text-xs cursor-pointer transition-colors ${hmwManualChecks[check.key] ? 'text-slate-700' : 'text-slate-400'}`}
                          onClick={() => setHmwManualChecks(p => ({ ...p, [check.key]: !p[check.key] }))}
                        >
                          {check.label} <span className="text-slate-300" style={{ fontWeight: 400 }}>(tú decides)</span>
                        </p>
                        {hmwManualChecks[check.key] && <span className="text-xs text-emerald-500 ml-auto">✓</span>}
                      </div>
                    ))}
                    {/* Progress bar */}
                    <div className="pt-2 mt-1 border-t border-slate-100 flex items-center gap-2.5">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`w-5 h-1.5 rounded-full transition-colors ${i < hmwChecksPassed ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        {hmwChecksPassed}/5{' '}
                        {hmwListo
                          ? <span className="text-emerald-600" style={{ fontWeight: 600 }}>¡Lista para avanzar!</span>
                          : <span className="text-slate-400">criterios cumplidos</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Alertas suaves ── */}
              {hmw.trim().length > 15 && hmwAlerts.length > 0 && (
                <div className="space-y-2">
                  {hmwAlerts.map((alert, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Ojo: </span>{alert}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── IA Feedback ── */}
              {hmwIAFeedback && (
                <div className={`border rounded-xl p-4 ${hmwIAFeedback.ok ? 'border-emerald-200 bg-emerald-50' : 'border-violet-200 bg-violet-50'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <Sparkles size={13} className={`shrink-0 mt-0.5 ${hmwIAFeedback.ok ? 'text-emerald-500' : 'text-violet-500'}`} />
                    <p className={`text-xs ${hmwIAFeedback.ok ? 'text-emerald-800' : 'text-violet-800'}`} style={{ fontWeight: 600 }}>
                      {hmwIAFeedback.ok ? '¡Tu pregunta tiene buena forma!' : 'La IA tiene sugerencias para mejorarla:'}
                    </p>
                  </div>
                  <p className={`text-xs mb-2 ml-5 ${hmwIAFeedback.ok ? 'text-emerald-700' : 'text-violet-700'}`}>{hmwIAFeedback.msg}</p>
                  {hmwIAFeedback.tips.length > 0 && (
                    <ul className="ml-5 space-y-1">
                      {hmwIAFeedback.tips.map((tip, i) => (
                        <li key={i} className={`text-xs flex items-start gap-1.5 ${hmwIAFeedback.ok ? 'text-emerald-700' : 'text-violet-700'}`}>
                          <span className="shrink-0 mt-0.5">·</span> {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ── Acciones: IA + Experto ── */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleHmwIA}
                  disabled={!hmw.trim() || hmwIALoading}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {hmwIALoading
                    ? <><span className="animate-spin inline-block">⟳</span> Refinando…</>
                    : <><Sparkles size={11} /> Mejorar este HMW con IA</>}
                </button>
                <button
                  onClick={() => setShowMentorHMW(true)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-700 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <MessageSquare size={11} /> Pedir feedback a un experto
                </button>
              </div>
              <div className="flex gap-4">
                <p className="text-xs text-slate-400">✨ La IA puede sugerir opciones o ayudarte a refinar la redacción del HMW activo.</p>
                <p className="text-xs text-slate-400">🧑‍🏫 Pide feedback experto para validar si el HMW realmente enfoca bien el reto.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Comentarios del experto sobre el HMW</p>
                    <p className="text-xs text-slate-500 mt-1">Si ya pediste feedback, aquí puede quedar visible la observación del experto sobre el HMW seleccionado.</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600" style={{ fontWeight: 600 }}>
                    {expertCommentDraft.trim() ? 'Comentario registrado' : 'Espacio disponible'}
                  </span>
                </div>
                <textarea
                  value={expertCommentDraft}
                  onChange={e => setExpertCommentDraft(e.target.value)}
                  rows={3}
                  placeholder="Ej. El HMW conecta bien con el problema, pero conviene explicitar mejor a quién afecta."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* ── CTA ── */}
              {!hmwListo && hmw.trim().length > 0 && (
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <AlertCircle size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500">
                    Necesitas cumplir al menos 4 de 5 criterios para avanzar. Toca los checkboxes manuales si ya los verificaste.
                  </p>
                </div>
              )}
              <button
                onClick={() => setActiveModule('B')}
                disabled={!hmwListo}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${hmwListo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={{ fontWeight: 500 }}
              >
                {hmwListo
                  ? <>HMW seleccionado → Pasar a generar ideas <ChevronRight size={15} /></>
                  : <><Lock size={14} /> Completa los criterios para avanzar</>}
              </button>
            </div>
          )}

          {/* Module B: Generación de ideas */}
          {activeModule === 'B' && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Modulo B · Ideas</h1>
                  <StatusChip status={moduloBListo ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">
                  Genera ideas a partir del HMW activo, elige las mas prometedoras y aterriza una sola propuesta para pasar al siguiente modulo.
                </p>
              </div>
              <div className="border-2 border-indigo-300 bg-indigo-50 rounded-2xl p-4">
                <p className="text-xs text-indigo-500 mb-2" style={{ fontWeight: 600 }}>HMW ACTIVO</p>
                <p className="text-base text-indigo-900" style={{ fontWeight: 600, lineHeight: '1.5' }}>
                  {hmw || '(Completa el Modulo A para ver aqui la pregunta activa.)'}
                </p>
                <p className="text-xs text-indigo-700 mt-2">
                  Esta pregunta sigue guiando la generacion y la seleccion de ideas dentro del modulo.
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Agrega una idea</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={newIdea}
                    onChange={e => setNewIdea(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newIdea.trim()) {
                        setIdeas(p => [...p, { id: Date.now().toString(), text: newIdea.trim() }]);
                        setNewIdea('');
                      }
                    }}
                    placeholder="Ej. Formulario unico para pedir accesos antes del primer dia"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      if (newIdea.trim()) {
                        setIdeas(p => [...p, { id: Date.now().toString(), text: newIdea.trim() }]);
                        setNewIdea('');
                      }
                    }}
                    className="bg-indigo-600 text-white rounded-xl px-3 py-2.5 hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="text-xs text-slate-400">Primero busca cantidad y variedad. Luego elige las ideas con mas potencial.</p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowReglas(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors">
                  <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Antes de elegir tus ideas, considera esto</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showReglas ? 'rotate-180' : ''}`} />
                </button>
                {showReglas && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100">
                    <ul className="space-y-2">
                      {[
                        'No te quedes con la primera idea obvia; busca rutas distintas.',
                        'Redacta cada idea de forma concreta para compararla mejor.',
                        'Prioriza ideas que respondan al HMW sin depender de una implementacion gigante.',
                        'Si una idea suena ambiciosa, piensa tambien su version mas simple.',
                      ].map((rule, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowIdeasCreativas(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
                >
                  <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    Ideas mas creativas
                    <span className="text-xs text-slate-400 ml-2" style={{ fontWeight: 400 }}>(opcional para destrabar)</span>
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showIdeasCreativas ? 'rotate-180' : ''}`} />
                </button>
                {showIdeasCreativas && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-500">Si ya ves ideas repetidas, usa uno de estos empujes para abrir mas posibilidades.</p>
                    {[
                      { prompt: 'Que podrias resolver manana con lo que ya tienes?', example: 'Usar un formulario simple y una alerta automatica.' },
                      { prompt: 'Que parte del proceso actual podrias quitar o unir?', example: 'Dejar una sola solicitud y una sola aprobacion.' },
                      { prompt: 'Como se veria una version manual o no-code de esta idea?', example: 'Probarlo sin desarrollo grande antes de invertir mas.' },
                    ].map((item, index) => (
                      <div key={index} className="p-3 rounded-xl border bg-slate-50 border-slate-100">
                        <p className="text-xs text-slate-700 mb-1" style={{ fontWeight: 600 }}>{item.prompt}</p>
                        <p className="text-xs text-slate-500">Ej. {item.example}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={handleIaB}
                  disabled={iaBLoading}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {iaBLoading
                    ? <><span className="animate-spin inline-block">...</span> Buscando enfoques...</>
                    : <><Sparkles size={11} /> IA: destrabarme con enfoques</>}
                </button>
                <p className="text-xs text-slate-400 mt-1">La IA te propone caminos para ampliar opciones. La decision sigue siendo del equipo.</p>
              </div>

              {iaBDisparadores && (
                <div className="border border-violet-200 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-violet-500" />
                      <p className="text-xs text-violet-800" style={{ fontWeight: 600 }}>Enfoques sugeridos por IA</p>
                    </div>
                    <button onClick={() => setIaBDisparadores(null)}>
                      <X size={13} className="text-violet-400 hover:text-violet-600" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {iaBDisparadores.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-start gap-2 p-2.5 bg-white border border-violet-100 rounded-xl">
                        <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-500 text-xs flex items-center justify-center shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{index + 1}</span>
                        <p className="text-xs text-slate-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                ideas.length >= 10 ? 'bg-emerald-50 border-emerald-100' :
                ideas.length >= 5 ? 'bg-amber-50 border-amber-100' :
                'bg-slate-50 border-slate-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  ideas.length >= 10 ? 'bg-emerald-100 text-emerald-700' :
                  ideas.length >= 5 ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-200 text-slate-500'
                }`} style={{ fontWeight: 700 }}>
                  {ideas.length}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${ideas.length >= 10 ? 'text-emerald-700' : ideas.length >= 5 ? 'text-amber-700' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
                    {ideasProgressMsg}
                  </p>
                  <div className="flex gap-0.5 mt-1.5">
                    {Array.from({ length: 15 }).map((_, index) => (
                      <div key={index} className={`h-1.5 rounded-full flex-1 transition-colors ${
                        index < ideas.length
                          ? ideas.length >= 10 ? 'bg-emerald-400' : 'bg-amber-400'
                          : 'bg-slate-200'
                      }`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Flujo progresivo del modulo</p>
                    <p className="text-xs text-slate-500 mt-1">Primero vota una persona a la vez. Luego revisan el consolidado del equipo. Al final aterrizan una sola idea.</p>
                  </div>
                  <div className="text-xs text-slate-500 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5" style={{ fontWeight: 600 }}>
                    Fase actual: {currentFlowPhase === 1 ? 'Votacion individual' : currentFlowPhase === 2 ? 'Coincidencias del equipo' : 'Idea final'}
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className={`rounded-2xl border p-4 ${currentFlowPhase === 1 ? 'border-indigo-300 bg-indigo-50' : currentFlowPhase > 1 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${currentFlowPhase === 1 ? 'bg-indigo-600 text-white' : currentFlowPhase > 1 ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-400'}`} style={{ fontWeight: 700 }}>
                        {currentFlowPhase > 1 ? 'OK' : '1'}
                      </span>
                      <div>
                        <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Votacion individual</p>
                        <p className="text-xs text-slate-600 mt-1">Cada integrante completa su top 3 y se ve con claridad quien esta votando ahora.</p>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-2xl border p-4 ${currentFlowPhase === 2 ? 'border-indigo-300 bg-indigo-50' : currentFlowPhase > 2 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${currentFlowPhase === 2 ? 'bg-indigo-600 text-white' : currentFlowPhase > 2 ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-400'}`} style={{ fontWeight: 700 }}>
                        {currentFlowPhase > 2 ? 'OK' : '2'}
                      </span>
                      <div>
                        <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Coincidencias del equipo</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {phase2Unlocked
                            ? 'Ya puedes revisar el consolidado y detectar la idea que va liderando.'
                            : individualMode
                            ? 'Se habilita cuando completes tu top 3.'
                            : `Se habilita cuando al menos ${votesThreshold} integrante${votesThreshold === 1 ? '' : 's'} complete${votesThreshold === 1 ? '' : 'n'} su top 3.`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-2xl border p-4 ${currentFlowPhase === 3 ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${currentFlowPhase === 3 ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-400'}`} style={{ fontWeight: 700 }}>
                        3
                      </span>
                      <div>
                        <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Idea final</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {phase3Unlocked
                            ? 'Ya puedes elegir la idea base y aterrizarla para pasar al siguiente modulo.'
                            : 'Aparece despues del consolidado, cuando ya hay base suficiente para decidir.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="border-2 border-indigo-200 rounded-3xl p-5 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div>
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 700 }}>FASE 1</p>
                        <p className="text-lg text-slate-900" style={{ fontWeight: 700 }}>Votacion individual</p>
                        <p className="text-sm text-slate-500 mt-1">En esta fase solo importa completar el top 3 de cada integrante. El consolidado y la idea final aparecen despues.</p>
                      </div>
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                        <p className="text-xs text-indigo-700" style={{ fontWeight: 700 }}>{teamCompletedCount}/{teamParticipants.length} completos</p>
                        <p className="text-[11px] text-indigo-500 mt-0.5">Un integrante activo a la vez</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Integrantes y estado de votacion</p>
                        <p className="text-xs text-slate-500">Selecciona a quien esta votando ahora para registrar su top 3.</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <input
                          value={newParticipantName}
                          onChange={e => setNewParticipantName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addVotingParticipant();
                            }
                          }}
                          placeholder="Agregar integrante"
                          className="flex-1 min-w-[220px] border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                        />
                        <button
                          onClick={addVotingParticipant}
                          disabled={!newParticipantName.trim()}
                          className="px-3 py-2.5 rounded-xl text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          style={{ fontWeight: 600 }}
                        >
                          <Plus size={13} className="inline mr-1" /> Agregar integrante
                        </button>
                      </div>
                      <div className="space-y-3">
                        {participantStatuses.map(participant => {
                          const isActive = currentVoterId === participant.id;
                          const statusTone =
                            participant.status === 'completo'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : participant.status === 'en_curso'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-slate-200 bg-slate-50 text-slate-700';
                          const indicatorTone =
                            participant.status === 'completo'
                              ? 'bg-emerald-600 text-white'
                              : participant.status === 'en_curso'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-300 text-slate-700';

                          return (
                            <button
                              key={participant.id}
                              onClick={() => setActiveVoterId(participant.id)}
                              className={`w-full text-left rounded-2xl border p-4 transition-colors ${isActive ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={`text-base ${isActive ? 'text-indigo-900' : 'text-slate-900'}`} style={{ fontWeight: 700 }}>{participant.name}</p>
                                    {isActive && (
                                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-600 text-white" style={{ fontWeight: 700 }}>
                                        Votando ahora
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-500 mt-1">{participant.selectedCount}/3 votos registrados</p>
                                </div>
                                <div className={`rounded-2xl border px-3 py-2 ${statusTone}`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${indicatorTone}`} style={{ fontWeight: 700 }}>
                                      {participant.status === 'completo' ? '✓' : participant.status === 'en_curso' ? '•' : '...'}
                                    </span>
                                    <div>
                                      <p className="text-xs" style={{ fontWeight: 700 }}>
                                        {participant.status === 'completo' ? 'Completo' : participant.status === 'en_curso' ? 'En curso' : 'Pendiente'}
                                      </p>
                                      <p className="text-[11px] opacity-80">
                                        {participant.status === 'completo'
                                          ? 'Ya termino su votacion'
                                          : participant.status === 'en_curso'
                                          ? 'Ya empezo, aun le faltan votos'
                                          : 'Todavia no registra votos'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 700 }}>
                              Votacion activa
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Aqui completas el top 3 de {currentVoterName}.</p>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-200" style={{ fontWeight: 700 }}>
                            {currentSelections.length}/3
                          </span>
                        </div>

                        <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2.5 mb-3">
                          <p className="text-xs text-indigo-700" style={{ fontWeight: 700 }}>
                            {currentVoterName} esta registrando sus votos ahora
                          </p>
                        </div>

                        <div className="space-y-2">
                          {['Top 1', 'Top 2', 'Top 3'].map((label, index) => (
                            <div key={label} className="rounded-2xl border border-white/70 bg-white px-3 py-3">
                              <p className="text-[11px] text-indigo-500 mb-1" style={{ fontWeight: 700 }}>{label}</p>
                              <p className={`${currentTopIdeas[index] ? 'text-slate-800' : 'text-slate-400'} text-sm`} style={{ fontWeight: 600 }}>
                                {currentTopIdeas[index]?.text || 'Aun sin elegir'}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className={`mt-3 rounded-2xl border px-3 py-3 ${currentSelectionMissing === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                          <p className={`text-sm ${currentSelectionMissing === 0 ? 'text-emerald-700' : 'text-amber-700'}`} style={{ fontWeight: 700 }}>
                            {currentSelectionMissing === 0 ? 'Top 3 completo.' : `Faltan ${currentSelectionMissing} seleccion${currentSelectionMissing === 1 ? '' : 'es'} para cerrar esta votacion.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="border border-slate-200 rounded-2xl p-4 bg-white">
                        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                          <div>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 700 }}>Ideas disponibles</p>
                            <p className="text-xs text-slate-500 mt-1">Asigna `Top 1`, `Top 2` y `Top 3` para {currentVoterName}. Aqui la tarea principal es votar.</p>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600" style={{ fontWeight: 600 }}>
                            {ideas.length} idea{ideas.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="space-y-2">
                      {ideas.map((idea, index) => {
                        const selectedByCurrent = (selectionMap[currentVoterId] || []).includes(idea.id);
                        return (
                          <div key={idea.id} className={`border rounded-2xl p-3 transition-colors ${
                            selectedByCurrent ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white'
                          }`}>
                            <div className="flex items-start gap-3">
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center shrink-0 mt-0.5" style={{ fontWeight: 700 }}>
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-800">{idea.text}</p>
                                {selectedByCurrent && (
                                  <p className="text-xs text-indigo-600 mt-2" style={{ fontWeight: 600 }}>
                                    Esta idea ya forma parte del top 3 de {currentVoterName}.
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => setIdeas(prev => prev.filter(item => item.id !== idea.id))}
                                className="text-slate-300 hover:text-red-400 transition-colors"
                              >
                                <X size={13} />
                              </button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-3">
                              <button
                                onClick={() => assignIdeaRank(currentVoterId, idea.id, 0)}
                                className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                                  currentSelections[0] === idea.id
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                                style={{ fontWeight: 700 }}
                              >
                                {currentSelections[0] === idea.id ? 'Top 1 ✓' : 'Top 1'}
                              </button>
                              <button
                                onClick={() => assignIdeaRank(currentVoterId, idea.id, 1)}
                                className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                                  currentSelections[1] === idea.id
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                                style={{ fontWeight: 700 }}
                              >
                                {currentSelections[1] === idea.id ? 'Top 2 ✓' : 'Top 2'}
                              </button>
                              <button
                                onClick={() => assignIdeaRank(currentVoterId, idea.id, 2)}
                                className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                                  currentSelections[2] === idea.id
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                                style={{ fontWeight: 700 }}
                              >
                                {currentSelections[2] === idea.id ? 'Top 3 ✓' : 'Top 3'}
                              </button>
                              {selectedByCurrent && (
                                <button
                                  onClick={() => toggleIdeaVote(currentVoterId, idea.id)}
                                  className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
                                  style={{ fontWeight: 600 }}
                                >
                                  Quitar del top 3
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                        {ideas.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl mt-3">
                            Tus ideas apareceran aqui. Empieza con una primera propuesta y sigue ampliando opciones.
                          </div>
                        )}
                      </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowInspiración(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
                    >
                      <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>
                        Inspiracion de otros sectores
                        <span className="text-xs text-slate-400 ml-2" style={{ fontWeight: 400 }}>(opcional)</span>
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${showInspiración ? 'rotate-180' : ''}`} />
                    </button>
                    {showInspiración && (
                      <div className="px-4 py-4 bg-white border-t border-slate-100 space-y-3">
                        <p className="text-xs text-slate-500">Usalo solo si necesitas otro referente para enriquecer una idea. No bloquea el avance.</p>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Sector</label>
                          <select value={inspiracion.sector} onChange={e => setInspiracion(p => ({ ...p, sector: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Elige un sector...</option>
                            {['Delivery / Logistica', 'Salud / Hospitales', 'Banca / Finanzas', 'Aeropuertos / Transporte', 'Retail / Supermercados', 'Educacion', 'Otro'].map(option => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Link de ejemplo</label>
                          <input value={inspiracion.link} onChange={e => setInspiracion(p => ({ ...p, link: e.target.value }))} placeholder="https://..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Que podrias adaptar</label>
                          <textarea value={inspiracion.queCopias} onChange={e => setInspiracion(p => ({ ...p, queCopias: e.target.value }))} rows={2} placeholder="La idea que vale la pena traer a este reto es..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                        </div>
                      </div>
                    )}
                  </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {phase2Unlocked ? (
                    <div className="border border-slate-200 rounded-2xl p-4 bg-white">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>2. Coincidencias del equipo</p>
                        <p className="text-xs text-slate-500">
                          {individualMode
                            ? 'Aqui veras las ideas con mayor preferencia dentro de tu propia seleccion.'
                            : 'Revisen donde se concentra la preferencia antes de bajar a una sola idea.'}
                        </p>
                      </div>
                      {!individualMode && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600" style={{ fontWeight: 600 }}>
                          {teamCompletedCount}/{teamParticipants.length} listos
                        </span>
                      )}
                    </div>

                    {!individualMode && (
                      <div className="space-y-2 mb-4">
                        <p className="text-xs text-slate-500">Avance del equipo</p>
                        <div className="space-y-2">
                          {participantStatuses.map(participant => (
                            <div key={participant.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                              <div>
                                <p className="text-xs text-slate-700" style={{ fontWeight: 700 }}>{participant.name}</p>
                                <p className="text-xs text-slate-500">{participant.selectedCount}/3 votos</p>
                              </div>
                              <span className={`text-[11px] px-2 py-1 rounded-full border ${
                                participant.status === 'completo'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : participant.status === 'en_curso'
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 bg-white text-slate-500'
                              }`} style={{ fontWeight: 700 }}>
                                {participant.status === 'completo' ? 'Completo' : participant.status === 'en_curso' ? 'En curso' : 'Pendiente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {topIdeas.length > 0 ? topIdeas.map((idea, index) => (
                        <div key={idea.id} className={`border rounded-xl p-3 ${
                          index === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>
                                {index === 0 ? 'Mayor coincidencia' : `${index + 1}. Siguiente preferencia`}
                              </p>
                              <p className="text-sm text-slate-800">{idea.text}</p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700" style={{ fontWeight: 700 }}>
                              {idea.votes} voto{idea.votes !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="mt-3">
                            <button
                              onClick={() => selectFinalIdeaBase(idea.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${selectedIdea === idea.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}
                              style={{ fontWeight: 600 }}
                            >
                              {selectedIdea === idea.id ? 'Idea base activa' : 'Usar como idea base'}
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                          Cuando empiecen a marcar sus top 3, aqui veras la idea con mayor preferencia.
                        </div>
                      )}
                    </div>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>FASE 2</p>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Coincidencias del equipo</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Todavia no toma protagonismo. Primero completa la votacion individual y luego aqui veras el ranking, quienes votaron, quienes faltan y la idea que lidera.
                      </p>
                    </div>
                  )}

                  {phase2Unlocked && hasTie && (
                    <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 space-y-3">
                      <div>
                        <p className="text-sm text-amber-800" style={{ fontWeight: 600 }}>Hay empate entre ideas compatibles</p>
                        <p className="text-xs text-amber-700 mt-1">Resuelvan primero si conviene elegir una sola idea o combinar lo mejor de las empatadas antes de aterrizar la final.</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {([
                          { value: 'single', label: 'Elegir una sola idea' },
                          { value: 'combine', label: 'Combinar ideas compatibles' },
                        ] as const).map(option => (
                          <button
                            key={option.value}
                            onClick={() => setTieDecisionMode(option.value)}
                            className={`px-3 py-2 rounded-xl text-xs border transition-colors ${
                              tieDecisionMode === option.value
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                            }`}
                            style={{ fontWeight: 600 }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {tiedIdeas.map(idea => (
                          <button
                            key={idea.id}
                            onClick={() => selectFinalIdeaBase(idea.id)}
                            className={`w-full text-left border rounded-xl px-3 py-2 transition-colors ${
                              selectedIdea === idea.id ? 'border-indigo-300 bg-white' : 'border-amber-200 bg-amber-50 hover:bg-white'
                            }`}
                          >
                            <p className="text-sm text-slate-800">{idea.text}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {phase3Unlocked ? (
                    <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                      <div>
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 700 }}>FASE 3</p>
                        <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Idea final y aterrizaje</p>
                        <p className="text-xs text-slate-500 mt-1">Aqui dejas clara la idea base elegida y la version aterrizada que realmente pasara al siguiente modulo.</p>
                      </div>

                      {selectedIdea ? (
                        <>
                          <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-3">
                            <p className="text-xs text-indigo-500 mb-1" style={{ fontWeight: 600 }}>IDEA BASE ELEGIDA</p>
                            <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>{selectedIdeaText}</p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Checklist de viabilidad y factibilidad</p>
                            {([
                              { key: 'recursosMinimos' as const, label: 'Se puede ejecutar con recursos minimos o apoyo liviano.' },
                              { key: 'pruebaLigera' as const, label: 'Se puede probar sin depender de una implementacion grande.' },
                              { key: 'versionSimple' as const, label: 'Se puede aterrizar a una version simple, manual o no-code.' },
                            ]).map(item => (
                              <label key={item.key} className="flex items-start gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ideaLandingChecks[item.key]}
                                  onChange={e => setIdeaLandingChecks(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                  className="mt-0.5 w-4 h-4 accent-indigo-600"
                                />
                                <span className="text-xs text-slate-700">{item.label}</span>
                              </label>
                            ))}
                          </div>

                          {(ideaNeedsLanding || !landingChecksComplete || tieDecisionMode === 'combine') && (
                            <div>
                              <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
                                Version aterrizada que pasara al siguiente modulo
                              </label>
                              <textarea
                                value={landedIdeaText}
                                onChange={e => setLandedIdeaText(e.target.value)}
                                rows={4}
                                placeholder={tieDecisionMode === 'combine'
                                  ? 'Escribe una sola propuesta que combine lo mejor de las ideas empatadas en una version ejecutable.'
                                  : 'Reescribe la idea en una version mas viable, simple y facil de probar.'}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              />
                              <p className="text-xs text-slate-400 mt-1">
                                Mantiene la idea base, pero deja clara la version ejecutable que el equipo quiere probar.
                              </p>
                            </div>
                          )}

                          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                            <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 600 }}>OUTPUT DEL MODULO</p>
                            <p className="text-sm text-emerald-900" style={{ fontWeight: 600 }}>
                              {landedIdeaText.trim() || selectedIdeaText}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                          Elige una idea base desde el consolidado para activar el cierre de esta fase.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>FASE 3</p>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Idea final y aterrizaje</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Esta fase aparece despues del consolidado. Asi la idea final no compite visualmente con la votacion inicial.
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-slate-700 mb-1" style={{ fontWeight: 500 }}>
                      Evidencias del proceso <span className="text-slate-400 text-xs" style={{ fontWeight: 400 }}>(opcional)</span>
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      Si quieres dejar trazabilidad del ejercicio, sube una foto o comparte un link con el trabajo del equipo.
                    </p>
                    <EvidenceUploader />
                  </div>
                </div>
              </div>

              {!moduloBListo && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Para avanzar necesitas:</p>
                  {[
                    { ok: ideas.length >= 10, label: ideas.length >= 10 ? '10+ ideas registradas.' : `${ideas.length}/10 ideas. Sigue ampliando opciones.` },
                    {
                      ok: teamParticipants.every(participant => (selectionMap[participant.id] || []).length === 3),
                      label: teamParticipants.every(participant => (selectionMap[participant.id] || []).length === 3)
                        ? (individualMode ? 'Ya elegiste tus 3 favoritas.' : 'Todo el equipo ya eligio sus 3 favoritas.')
                        : (individualMode ? `Te faltan ${3 - (selectionMap[currentVoterId] || []).length} seleccion${3 - (selectionMap[currentVoterId] || []).length === 1 ? '' : 'es'} para tu top 3.` : 'Todavia falta que el equipo complete sus selecciones.')
                    },
                    { ok: Boolean(selectedIdea), label: selectedIdea ? 'Ya hay una idea final elegida.' : 'Elige una idea final para cerrar el modulo.' },
                    {
                      ok: landedIdeaReady,
                      label: landedIdeaReady
                        ? 'La idea final ya quedo aterrizada.'
                        : 'Aterriza la idea final con una version mas viable y facil de probar.'
                    },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        {item.ok ? <CheckCircle2 size={10} className="text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                      </div>
                      <p className={`text-xs ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  if (selectedIdea && landedIdeaText.trim()) {
                    setIdeas(prev => prev.map(idea => (
                      idea.id === selectedIdea
                        ? { ...idea, text: landedIdeaText.trim() }
                        : idea
                    )));
                  }
                  setActiveModule('C');
                }}
                disabled={!moduloBListo}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${moduloBListo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={{ fontWeight: 500 }}
              >
                {moduloBListo
                  ? <>Idea aterrizada lista para pasar al siguiente modulo <ChevronRight size={15} /></>
                  : <><Lock size={14} /> Completa la seleccion y aterriza una idea para avanzar</>}
              </button>
            </div>
          )}
          {false && activeModule === 'B' && (
            <div className="space-y-5">

              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo B · Generación de ideas</h1>
                  <StatusChip status={moduloBListo ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">
                  Escribe todas las ideas que se te ocurran. No filtres todavía — la meta es cantidad.
                </p>
              </div>

              {/* HMW card — prominente */}
              <div className="border-2 border-indigo-300 bg-indigo-50 rounded-2xl p-4">
                <p className="text-xs text-indigo-400 mb-2" style={{ fontWeight: 600 }}>RESPONDE ESTA PREGUNTA CON IDEAS:</p>
                <p className="text-base text-indigo-900" style={{ fontWeight: 600, lineHeight: '1.5' }}>
                  {hmw || '(Tu pregunta guía aparece aquí una vez que la completes en el Módulo A)'}
                </p>
              </div>

              {/* Input — acción principal */}
              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Agrega una idea</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={newIdea}
                    onChange={e => setNewIdea(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newIdea.trim()) {
                        setIdeas(p => [...p, { id: Date.now().toString(), text: newIdea.trim(), cluster: newIdeaCluster || undefined }]);
                        setNewIdea('');
                      }
                    }}
                    placeholder="Ej. Pedir accesos con un formulario desde el primer día"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      if (newIdea.trim()) {
                        setIdeas(p => [...p, { id: Date.now().toString(), text: newIdea.trim(), cluster: newIdeaCluster || undefined }]);
                        setNewIdea('');
                      }
                    }}
                    className="bg-indigo-600 text-white rounded-xl px-3 py-2.5 hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-slate-400">1 idea = 1 línea corta. Presiona Enter para agregar.</p>
                  <span className="text-slate-200 hidden sm:inline">·</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Grupo (opcional):</span>
                    <input
                      list="clusters-datalist"
                      value={newIdeaCluster}
                      onChange={e => setNewIdeaCluster(e.target.value)}
                      placeholder="Digital, Proceso…"
                      className="w-32 border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <datalist id="clusters-datalist">
                      {uniqueClusters.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Acuerdos del ejercicio (colapsable) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowReglas(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors">
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    <span>📋</span> Acuerdos del ejercicio
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showReglas ? 'rotate-180' : ''}`} />
                </button>
                {showReglas && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100">
                    <ul className="space-y-2">
                      {[
                        'Escribe una idea por línea, en menos de 15 palabras.',
                        'Cantidad primero: no descartes nada todavía.',
                        'Si tienes 3 ideas parecidas, busca un camino diferente.',
                        'Si una idea sale muy loca, escríbela igual y luego agrega una versión posible.',
                      ].map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="text-indigo-400 shrink-0 mt-0.5">·</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Bloque opcional: Ideas más creativas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowIdeasCreativas(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    <span>💡</span> Ideas más creativas
                    <span className="text-xs text-slate-400" style={{ fontWeight: 400 }}>(para destrabar)</span>
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showIdeasCreativas ? 'rotate-180' : ''}`} />
                </button>
                {showIdeasCreativas && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-500">Si ya tienes ideas similares y quieres explorar otros caminos, prueba alguno de estos enfoques:</p>
                    {[
                      { prueba: '¿Qué harías mañana con lo que ya tienes?', ej: '"Usar el formulario de Google que ya tenemos para pedir accesos desde el día 1"', ironman: false },
                      { prueba: '¿Qué podrías quitar, unir o invertir del proceso actual?', ej: '"Quitar el correo informal y reemplazarlo con una pantalla única de solicitud"', ironman: false },
                      { prueba: '¿Cómo lo resolvería alguien que no sabe nada del proceso?', ej: '"Una persona nueva hace la solicitud sola, sin pedirle ayuda a nadie"', ironman: false },
                      { prueba: '¿Cómo lo haría Iron Man? (y luego aterrízalo)', ej: '"Iron Man lo automatizaría todo → yo puedo automatizar solo la notificación a TI"', ironman: true },
                    ].map((enfoque, i) => (
                      <div key={i} className={`p-3 rounded-xl border ${enfoque.ironman ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                        <p className={`text-xs mb-1.5 ${enfoque.ironman ? 'text-amber-800' : 'text-slate-700'}`}>
                          <span style={{ fontWeight: 600 }}>Prueba así:</span> {enfoque.prueba}
                        </p>
                        <p className={`text-xs italic ${enfoque.ironman ? 'text-amber-600' : 'text-slate-400'}`}>
                          Ej. {enfoque.ej}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* IA: destrabarme */}
              <div>
                <button
                  onClick={handleIaB}
                  disabled={iaBLoading}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {iaBLoading
                    ? <><span className="animate-spin inline-block">⟳</span> Buscando enfoques…</>
                    : <><Sparkles size={11} /> IA: destrabarme (dame enfoques)</>}
                </button>
                <p className="text-xs text-slate-400 mt-1">Te doy enfoques y ejemplos. Tú escribes tus ideas.</p>
              </div>

              {/* Panel IA */}
              {iaBDisparadores && (
                <div className="border border-violet-200 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-violet-500" />
                      <p className="text-xs text-violet-800" style={{ fontWeight: 600 }}>Enfoques para destrabar</p>
                    </div>
                    <button onClick={() => setIaBDisparadores(null)}>
                      <X size={13} className="text-violet-400 hover:text-violet-600" />
                    </button>
                  </div>
                  <p className="text-xs text-violet-600 mb-3">Elige 1 o 2 que te resuenen y escribe al menos 1 idea para cada uno:</p>
                  <div className="space-y-1.5">
                    {iaBDisparadores.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-white border border-violet-100 rounded-xl">
                        <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-500 text-xs flex items-center justify-center shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{i + 1}</span>
                        <p className="text-xs text-slate-700">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progreso */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                ideas.length >= 10 ? 'bg-emerald-50 border-emerald-100' :
                ideas.length >= 5  ? 'bg-amber-50 border-amber-100' :
                                     'bg-slate-50 border-slate-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  ideas.length >= 10 ? 'bg-emerald-100 text-emerald-700' :
                  ideas.length >= 5  ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'
                }`} style={{ fontWeight: 700 }}>
                  {ideas.length}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${ideas.length >= 10 ? 'text-emerald-700' : ideas.length >= 5 ? 'text-amber-700' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
                    {ideasProgressMsg}
                  </p>
                  <div className="flex gap-0.5 mt-1.5">
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full flex-1 transition-colors ${
                        i < ideas.length
                          ? ideas.length >= 10 ? 'bg-emerald-400' : 'bg-amber-400'
                          : 'bg-slate-200'
                      }`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Lista de ideas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Ideas registradas <span className="text-slate-400">({ideas.length})</span></p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowGroupView(false)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${!showGroupView ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                      style={{ fontWeight: !showGroupView ? 600 : 400 }}
                    >Lista</button>
                    <button
                      onClick={() => setShowGroupView(true)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${showGroupView ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                      style={{ fontWeight: showGroupView ? 600 : 400 }}
                    >Por grupos</button>
                  </div>
                </div>

                {!showGroupView && (
                  <div className="space-y-2">
                    {ideas.map((idea, i) => (
                      <div key={idea.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl group">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-xs flex items-center justify-center shrink-0" style={{ fontWeight: 600 }}>{i + 1}</span>
                        <p className="flex-1 text-sm text-slate-700">{idea.text}</p>
                        {editingIdeaCluster === idea.id ? (
                          <input
                            autoFocus
                            list="clusters-datalist-edit"
                            defaultValue={idea.cluster || ''}
                            onBlur={e => {
                              setIdeas(p => p.map(id => id.id === idea.id ? { ...id, cluster: e.target.value || undefined } : id));
                              setEditingIdeaCluster(null);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            className="text-xs border border-indigo-300 rounded-lg px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingIdeaCluster(idea.id)}
                            className={`text-xs px-2 py-0.5 rounded-full transition-colors shrink-0 ${idea.cluster ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                          >
                            {idea.cluster || '+ grupo'}
                          </button>
                        )}
                        <datalist id="clusters-datalist-edit">
                          {uniqueClusters.map(c => <option key={c} value={c} />)}
                        </datalist>
                        <button onClick={() => setIdeas(p => p.filter(id => id.id !== idea.id))} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={13} className="text-slate-300 hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                    {ideas.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        Tus ideas aparecerán aquí. Empieza escribiendo arriba.
                      </div>
                    )}
                  </div>
                )}

                {showGroupView && (
                  <div className="space-y-4">
                    {uniqueClusters.length === 0 && ideas.length > 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        Asigna un grupo a tus ideas haciendo clic en "+ grupo" en cada tarjeta.
                      </div>
                    )}
                    {uniqueClusters.map(cluster => (
                      <div key={cluster}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full" style={{ fontWeight: 600 }}>{cluster}</span>
                          <span className="text-xs text-slate-400">{ideas.filter(i => i.cluster === cluster).length} idea{ideas.filter(i => i.cluster === cluster).length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-indigo-100">
                          {ideas.filter(i => i.cluster === cluster).map(idea => (
                            <p key={idea.id} className="text-sm text-slate-700 py-1">{idea.text}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                    {ideas.filter(i => !i.cluster).length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full" style={{ fontWeight: 600 }}>Sin grupo</span>
                          <span className="text-xs text-slate-400">{ideas.filter(i => !i.cluster).length}</span>
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-slate-100">
                          {ideas.filter(i => !i.cluster).map(idea => (
                            <p key={idea.id} className="text-sm text-slate-700 py-1">{idea.text}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {ideas.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        Agrega ideas primero, luego asígnales un grupo.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Agrupación en grupos */}
              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Grupos de ideas</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${uniqueClusters.length >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                    {uniqueClusters.length}/3 mínimo
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Agrupa las ideas que se parezcan y ponle un nombre a cada grupo. Haz clic en "+ grupo" en cada idea para asignarla.</p>
                {uniqueClusters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {uniqueClusters.map(c => (
                      <div key={c} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                        <span className="text-xs text-indigo-700" style={{ fontWeight: 500 }}>{c}</span>
                        <span className="text-xs text-indigo-400">· {ideas.filter(i => i.cluster === c).length}</span>
                      </div>
                    ))}
                  </div>
                )}
                {uniqueClusters.length < 3 && ideas.length >= 5 && (
                  <p className="text-xs text-amber-600 mt-2">Asigna grupos a tus ideas hasta tener mínimo 3 grupos distintos.</p>
                )}
              </div>

              {/* Opcional: Inspiración de otros sectores */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowInspiración(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700" style={{ fontWeight: 500 }}>
                    🌍 Inspiración de otros sectores
                    <span className="text-xs text-slate-400" style={{ fontWeight: 400 }}>(opcional — no bloquea)</span>
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showInspiración ? 'rotate-180' : ''}`} />
                </button>
                {showInspiración && (
                  <div className="px-4 py-4 bg-white border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-500">Elige un sector, encuentra un ejemplo y escribe qué te llevas. No es obligatorio, pero puede destrabar ideas nuevas.</p>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>1. Elige un sector</label>
                      <select value={inspiracion.sector} onChange={e => setInspiracion(p => ({ ...p, sector: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Elige un sector...</option>
                        {['Delivery / Logística', 'Salud / Hospitales', 'Banca / Finanzas', 'Aeropuertos / Transporte', 'Retail / Supermercados', 'Educación', 'Otro'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>2. Link de ejemplo (opcional)</label>
                      <input value={inspiracion.link} onChange={e => setInspiracion(p => ({ ...p, link: e.target.value }))} placeholder="https://..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>3. ¿Qué hacen ellos?</label>
                      <textarea value={inspiracion.queHacen} onChange={e => setInspiracion(p => ({ ...p, queHacen: e.target.value }))} rows={2} placeholder="Describe en 1–2 líneas cómo resuelven el problema..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>4. ¿Qué te copiás o adaptás?</label>
                      <textarea value={inspiracion.queCopias} onChange={e => setInspiracion(p => ({ ...p, queCopias: e.target.value }))} rows={2} placeholder="La idea que me llevo para mi reto es..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* Evidencias (recomendado) */}
              <div>
                <p className="text-sm text-slate-700 mb-1" style={{ fontWeight: 500 }}>
                  Evidencias del proceso{' '}
                  <span className="text-slate-400 text-xs" style={{ fontWeight: 400 }}>(recomendado)</span>
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  Sube o pega algo que muestre cómo trabajaste: foto de tu lista, captura de los grupos, o link a un doc/Figma/Miro. No es obligatorio, pero ayuda al mentor a entender tu proceso.
                </p>
                <EvidenceUploader />
              </div>

              {/* Checklist de avance */}
              {!moduloBListo && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Para avanzar necesitas:</p>
                  {[
                    { ok: ideas.length >= 10, label: ideas.length >= 10 ? '10+ ideas registradas ✓' : `${ideas.length}/10 ideas — te faltan ${10 - ideas.length}` },
                    { ok: uniqueClusters.length >= 3, label: uniqueClusters.length >= 3 ? '3+ grupos creados ✓' : `${uniqueClusters.length}/3 grupos — asigna grupos a tus ideas` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        {item.ok ? <CheckCircle2 size={10} className="text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                      </div>
                      <p className={`text-xs ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={() => setActiveModule('C')}
                disabled={!moduloBListo}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${moduloBListo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                style={{ fontWeight: 500 }}
              >
                {moduloBListo
                  ? <>Módulo B listo → Elegir la mejor idea <ChevronRight size={15} /></>
                  : <><Lock size={14} /> Completa ideas y grupos para avanzar</>}
              </button>
            </div>
          )}

          {/* Module C: Elegir la idea a experimentar */}
          {activeModule === 'C' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo C · Cards de experimentación</h1>
                  <StatusChip status={moduleCReady ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">
                  Convierte la idea elegida en un experimento pequeño, claro y medible. Primero aterrizas una ruta viable para probarla y luego dejas lista la Card con qué validar, cómo hacerlo y qué evidencia guardar.
                </p>
              </div>

              {selectedIdea ? (
                <div className="border-2 border-indigo-200 bg-indigo-50 rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="text-xs text-indigo-500 mb-1" style={{ fontWeight: 700 }}>IDEA SELECCIONADA</p>
                    <p className="text-base text-indigo-900" style={{ fontWeight: 600 }}>{selectedIdeaText}</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-white/70 border border-indigo-100 rounded-xl p-3">
                      <p className="text-xs text-indigo-500 mb-1" style={{ fontWeight: 700 }}>Por qué fue elegida</p>
                      <p className="text-sm text-slate-700">{cRazonGana.trim() || 'Todavía falta justificar por qué esta idea merece pasar a experimento.'}</p>
                    </div>
                    <div className="bg-white/70 border border-indigo-100 rounded-xl p-3">
                      <p className="text-xs text-indigo-500 mb-1" style={{ fontWeight: 700 }}>Qué se busca probar primero</p>
                      <p className="text-sm text-slate-700">{cQueProbamos.trim() || 'Define primero en Módulo B qué parte de la idea quieres probar.'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-indigo-700">
                    <span className="px-2.5 py-1 rounded-full bg-white border border-indigo-100">HMW activo: {trimForCard(hmw, 90)}</span>
                    <span className="px-2.5 py-1 rounded-full bg-white border border-indigo-100">Línea roja: {challengeAnchor.redLine}</span>
                  </div>
                </div>
              ) : (
                <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4">
                  <p className="text-sm text-amber-800" style={{ fontWeight: 600 }}>Primero necesitas una idea elegida</p>
                  <p className="text-xs text-amber-700 mt-1">Vuelve al Módulo B, elige una sola idea y aterrízala antes de construir la Card de experimentación.</p>
                  <button
                    onClick={() => setActiveModule('B')}
                    className="mt-3 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Volver al Módulo B <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {selectedIdea && (
                <>
                  <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-200 mb-3" style={{ fontWeight: 600 }}>
                          <Lightbulb size={12} />
                          Nuevo bloque UX
                        </div>
                        <h2 className="text-lg text-slate-900" style={{ fontWeight: 700 }}>Aterriza tu experimento</h2>
                        <p className="text-sm text-slate-500 mt-2">
                          No necesitas saber tecnologia para empezar. Aqui traducimos tu idea finalista a una forma de prueba viable, clara y accionable para esta semana.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" style={{ fontWeight: 600 }}>
                        {experimentBridgeProgress}/4 definiciones base
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
                      <div className="space-y-5">
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                          <div>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>1. Que necesitas validar primero para avanzar</p>
                            <p className="text-xs text-slate-500 mt-1">Empieza por la duda mas importante. La herramienta viene despues.</p>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {EXPERIMENT_FOCUS_OPTIONS.map(option => {
                              const active = experimentFocus === option;
                              return (
                                <button
                                  key={option}
                                  onClick={() => setExperimentFocus(option)}
                                  className={`text-left rounded-xl border px-3 py-3 text-sm transition-colors ${active ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                                  style={{ fontWeight: active ? 600 : 500 }}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                          <div>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>2. Que tan lejos puedes llegar hoy con tu primer prototipo</p>
                            <p className="text-xs text-slate-500 mt-1">No es una evaluacion. Solo nos ayuda a recomendarte una ruta realista segun tu punto de partida.</p>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Que tan comodo te sientes creando algo digital</p>
                              <div className="flex flex-wrap gap-2">
                                {PROTOTYPE_COMFORT_OPTIONS.map(option => {
                                  const active = prototypeComfort === option;
                                  return (
                                    <button
                                      key={option}
                                      onClick={() => setPrototypeComfort(option)}
                                      className={`px-3 py-2 rounded-full text-xs border transition-colors ${active ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                      style={{ fontWeight: 600 }}
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Cuanta autonomia necesitas para probar</p>
                              <div className="flex flex-wrap gap-2">
                                {PROTOTYPE_AUTONOMY_OPTIONS.map(option => {
                                  const active = prototypeAutonomy === option;
                                  return (
                                    <button
                                      key={option}
                                      onClick={() => setPrototypeAutonomy(option)}
                                      className={`px-3 py-2 rounded-full text-xs border transition-colors ${active ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                      style={{ fontWeight: 600 }}
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Que primera version si sientes capaz de hacer</p>
                              <div className="flex flex-wrap gap-2">
                                {PROTOTYPE_FIRST_VERSION_OPTIONS.map(option => {
                                  const active = prototypeFirstVersion === option;
                                  return (
                                    <button
                                      key={option}
                                      onClick={() => setPrototypeFirstVersion(option)}
                                      className={`px-3 py-2 rounded-full text-xs border transition-colors ${active ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                      style={{ fontWeight: 600 }}
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-white border border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="bg-emerald-600 px-4 py-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs text-emerald-100" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>RUTA RECOMENDADA</p>
                                <p className="text-white text-base mt-0.5" style={{ fontWeight: 700 }}>{experimentRoute.label}</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-white/95 border border-emerald-100 text-emerald-700 text-xs" style={{ fontWeight: 700 }}>
                                {recommendationReady ? 'Lista para usar' : 'En construccion'}
                              </span>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div>
                              <p className="text-xs text-emerald-700" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>POR QUE SE RECOMIENDA</p>
                              <p className="text-sm text-slate-700 mt-1">{experimentRoute.why}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                              <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700, letterSpacing: '0.03em' }}>QUE PODRIAS VALIDAR ESTA SEMANA</p>
                              <p className="text-sm text-slate-700">{experimentRoute.thisWeek}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700, letterSpacing: '0.03em' }}>POR QUE NO NECESITAS EMPEZAR COMPLEJO</p>
                              <p className="text-sm text-slate-700">{experimentRoute.keepSimple}</p>
                            </div>
                            <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-3">
                              <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700, letterSpacing: '0.03em' }}>SENAL DE SALIDA</p>
                              <p className="text-sm text-slate-700">Ya tienes una ruta orientadora para convertir esta idea en una prueba concreta sin arrancar con algo complejo.</p>
                            </div>
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                          <div>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Otras rutas posibles</p>
                            <p className="text-xs text-slate-500 mt-1">Si cambia tu contexto, estas tambien podrian servirte sin abrumar el arranque.</p>
                          </div>
                          <div className="space-y-2">
                            {experimentRoute.alternatives.map(option => (
                              <div key={option} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{option}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                          <div>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Herramientas opcionales</p>
                            <p className="text-xs text-slate-500 mt-1">Primero importa validar valor. Las herramientas son solo ejemplos para hacerlo mas facil.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {experimentRoute.optionalTools.map(tool => (
                              <span key={tool} className="px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600" style={{ fontWeight: 600 }}>
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>Hipotesis mas riesgosa a validar</p>
                          <p className="text-xs text-indigo-700 mt-1">La IA propone un borrador inicial. Tu ajustas la redaccion y esa version final queda lista para la Card de experimentacion.</p>
                        </div>
                        <button
                          onClick={applyExperimentRouteSuggestion}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-sm transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          Usar esta sugerencia como base <ChevronRight size={14} />
                        </button>
                      </div>
                      <div className="rounded-xl border border-indigo-100 bg-white/90 p-4 space-y-3">
                        <div>
                          <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 700, letterSpacing: '0.03em' }}>BORRADOR SUGERIDO POR IA</p>
                          <p className="text-sm text-slate-700">{experimentRoute.hypothesis}</p>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3 text-sm">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>Experimento sugerido</p>
                            <p className="text-slate-700">{experimentRoute.experiment}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>Metrica sugerida</p>
                            <p className="text-slate-700">{experimentRoute.metric}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>Umbral inicial</p>
                            <p className="text-slate-700">{experimentRoute.threshold}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-5">
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                      <div>
                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Que vas a probar</p>
                        <p className="text-xs text-slate-500 mt-1">Aterriza la idea en una ficha MVP clara: qué problema atiende, cuál es la hipótesis crítica y qué decisión te ayudará a tomar.</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Nombre del MVP o experimento</label>
                          <input
                            value={experimentCard.name}
                            onChange={e => setExperimentCard(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ej. MVP formulario unificado de accesos"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Problema u oportunidad que busca atender</label>
                          <input
                            value={experimentCard.problem}
                            onChange={e => setExperimentCard(prev => ({ ...prev, problem: e.target.value }))}
                            placeholder="Ej. El alta de accesos es lenta y poco trazable."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Hipótesis más riesgosa a validar</label>
                          <p className="text-xs text-slate-500">Ajusta aquí la versión final que irá a la card. Si te sirve, puedes partir del borrador sugerido por IA y editarlo con tu propio criterio.</p>
                        </div>
                        <textarea
                          value={experimentCard.hypothesis}
                          onChange={e => setExperimentCard(prev => ({ ...prev, hypothesis: e.target.value }))}
                          rows={3}
                          placeholder="Si [usuario] usa/interactúa con [mecanismo mínimo], entonces [resultado esperado], porque [supuesto principal]."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700, letterSpacing: '0.03em' }}>VERSIÓN FINAL LISTA PARA LA CARD</p>
                          <p className="text-sm text-slate-700">
                            {experimentCard.hypothesis || 'Todavía no defines la hipótesis final.'}
                          </p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Decisión que este MVP ayudará a tomar</label>
                          <textarea
                            value={experimentCard.decision}
                            onChange={e => setExperimentCard(prev => ({ ...prev, decision: e.target.value }))}
                            rows={3}
                            placeholder="Ej. Decidir si escalar, iterar, cambiar el formato o detener la iniciativa."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Comportamiento o resultado esperado</label>
                          <textarea
                            value={experimentCard.expectedOutcome}
                            onChange={e => setExperimentCard(prev => ({ ...prev, expectedOutcome: e.target.value }))}
                            rows={3}
                            placeholder="Ej. Menos errores, mayor velocidad, mejor trazabilidad o mayor adopción."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Como lo vas a probar</p>
                          <p className="text-xs text-slate-500 mt-1">Define la pieza mínima, la herramienta, el contexto y los actores para correr una prueba pequeña y ejecutable.</p>
                        </div>
                        <button
                          onClick={handleIaExperimentGuide}
                          disabled={experimentAiLoading}
                          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                          style={{ fontWeight: 500 }}
                        >
                          {experimentAiLoading
                            ? <><span className="animate-spin inline-block">...</span> Sugiriendo...</>
                            : <><Sparkles size={11} /> IA: sugerir mecanismo y herramienta</>}
                        </button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Mecanismo mínimo</label>
                          <textarea
                            value={experimentCard.minimumMechanism}
                            onChange={e => setExperimentCard(prev => ({ ...prev, minimumMechanism: e.target.value }))}
                            rows={3}
                            placeholder="Ej. Un formulario, una landing, una demo guiada o una versión manual del servicio."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Herramienta o formato de prueba</label>
                          <textarea
                            value={experimentCard.tool}
                            onChange={e => setExperimentCard(prev => ({ ...prev, tool: e.target.value }))}
                            rows={3}
                            placeholder="Ej. WhatsApp, QR, landing, formulario, piloto manual, chatbot simple, one pager, Make o n8n."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Contexto de prueba</label>
                          <textarea
                            value={experimentCard.context}
                            onChange={e => setExperimentCard(prev => ({ ...prev, context: e.target.value }))}
                            rows={4}
                            placeholder="Incluye lugar, momento del proceso, duración estimada y cantidad de usuarios o casos."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Usuarios y actores involucrados</label>
                          <textarea
                            value={experimentCard.actors}
                            onChange={e => setExperimentCard(prev => ({ ...prev, actors: e.target.value }))}
                            rows={4}
                            placeholder="Usuario principal, actores relevantes, quién facilita y quién podría bloquear."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Pasos mínimos para montar el experimento</p>
                            <p className="text-xs text-slate-500">Deja una secuencia simple de 5 a 8 pasos. La ejecución detallada quedará para el siguiente step.</p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full ${completedExperimentSteps >= 5 && completedExperimentSteps <= 8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                            {completedExperimentSteps}/8 pasos
                          </span>
                        </div>
                        <div className="space-y-2">
                          {testCard.pasos.map((step, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center shrink-0" style={{ fontWeight: 700 }}>{index + 1}</span>
                              <input
                                value={step}
                                onChange={e => {
                                  const nextSteps = [...testCard.pasos];
                                  nextSteps[index] = e.target.value;
                                  setTestCard(prev => ({ ...prev, pasos: nextSteps }));
                                }}
                                placeholder={`Paso ${index + 1}`}
                                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              {testCard.pasos.length > 5 && (
                                <button
                                  onClick={() => setTestCard(prev => ({ ...prev, pasos: prev.pasos.filter((_, stepIndex) => stepIndex !== index) }))}
                                  className="text-slate-300 hover:text-red-400 transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {testCard.pasos.length < 8 && (
                          <button
                            onClick={() => setTestCard(prev => ({ ...prev, pasos: [...prev.pasos, ''] }))}
                            className="inline-flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus size={13} /> Agregar paso
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                      <div>
                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Como sabras si funciono</p>
                        <p className="text-xs text-slate-500 mt-1">Aquí dejas la señal que vas a medir y la evidencia que recogerás para evaluar si vale la pena seguir.</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Métrica de éxito</label>
                          <textarea
                            value={experimentCard.metric}
                            onChange={e => setExperimentCard(prev => ({ ...prev, metric: e.target.value }))}
                            rows={3}
                            placeholder="Ej. porcentaje de adopción, reducción de errores, tiempo promedio o señal de comprensión."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Riesgos y límites</label>
                          <textarea
                            value={testCard.riesgos}
                            onChange={e => setTestCard(prev => ({ ...prev, riesgos: e.target.value }))}
                            rows={3}
                            placeholder="Ej. seguridad, operación, experiencia cliente, reputación o cumplimiento."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                          <p className="text-xs text-indigo-500 mt-2">Línea roja principal: {challengeAnchor.redLine}</p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Evidencia cuantitativa</label>
                          <textarea
                            value={experimentCard.evidenceQuant}
                            onChange={e => setExperimentCard(prev => ({ ...prev, evidenceQuant: e.target.value }))}
                            rows={3}
                            placeholder="Ej. tiempos, volumen, porcentaje de uso, errores o conversiones."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 600 }}>Evidencia cualitativa</label>
                          <textarea
                            value={experimentCard.evidenceQual}
                            onChange={e => setExperimentCard(prev => ({ ...prev, evidenceQual: e.target.value }))}
                            rows={3}
                            placeholder="Ej. comentarios, notas de observación, citas, capturas o feedback breve."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4 space-y-3">
                    <div>
                      <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>FICHA RESUMEN DEL MVP</p>
                      <p className="text-sm text-emerald-900" style={{ fontWeight: 600 }}>{experimentCard.name || 'Nombre pendiente'}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-white/70 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>Problema u oportunidad</p>
                        <p className="text-sm text-slate-700">{experimentCard.problem || 'Pendiente de definir'}</p>
                      </div>
                      <div className="bg-white/70 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>Hipótesis crítica</p>
                        <p className="text-sm text-slate-700">{experimentCard.hypothesis || 'Pendiente de definir'}</p>
                      </div>
                      <div className="bg-white/70 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>Decisión que ayudará a tomar</p>
                        <p className="text-sm text-slate-700">{experimentCard.decision || 'Pendiente de definir'}</p>
                      </div>
                      <div className="bg-white/70 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>Mecanismo y herramienta</p>
                        <p className="text-sm text-slate-700">{experimentCard.minimumMechanism || 'Pendiente'}{experimentCard.tool ? ` · ${experimentCard.tool}` : ''}</p>
                      </div>
                      <div className="bg-white/70 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>Contexto y actores</p>
                        <p className="text-sm text-slate-700">{experimentCard.context || 'Pendiente de definir'}</p>
                        <p className="text-xs text-slate-500 mt-1">{experimentCard.actors || 'Actores pendientes de definir'}</p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-white/70 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>Métrica de éxito</p>
                        <p className="text-sm text-slate-700">{experimentCard.metric || 'Pendiente de definir'}</p>
                      </div>
                      <div className="bg-white/70 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs text-emerald-700 mb-1" style={{ fontWeight: 700 }}>Evidencia a recoger</p>
                        <p className="text-sm text-slate-700">{experimentCard.evidenceQuant || 'Pendiente'}{experimentCard.evidenceQual ? ` · ${experimentCard.evidenceQual}` : ''}</p>
                      </div>
                    </div>
                  </div>

                  {!moduleCReady && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Para dejar la Card lista necesitas:</p>
                      {[
                        { ok: !!selectedIdea, label: selectedIdea ? 'La idea elegida ya está conectada.' : 'Primero elige una idea en el módulo anterior.' },
                        { ok: !!experimentCard.name.trim() && !!experimentCard.problem.trim(), label: experimentCard.name.trim() && experimentCard.problem.trim() ? 'Nombre y problema del MVP definidos.' : 'Completa nombre del MVP y problema que atiende.' },
                        { ok: !!experimentCard.hypothesis.trim() && !!experimentCard.decision.trim() && !!experimentCard.expectedOutcome.trim(), label: experimentCard.hypothesis.trim() && experimentCard.decision.trim() && experimentCard.expectedOutcome.trim() ? 'Hipótesis crítica, decisión y resultado esperado definidos.' : 'Completa hipótesis, decisión y resultado esperado.' },
                        { ok: !!experimentCard.minimumMechanism.trim() && !!experimentCard.tool.trim() && !!experimentCard.context.trim() && !!experimentCard.actors.trim(), label: experimentCard.minimumMechanism.trim() && experimentCard.tool.trim() && experimentCard.context.trim() && experimentCard.actors.trim() ? 'Mecanismo, herramienta, contexto y actores ya están claros.' : 'Completa mecanismo mínimo, herramienta, contexto y actores.' },
                        { ok: completedExperimentSteps >= 5 && completedExperimentSteps <= 8, label: completedExperimentSteps >= 5 && completedExperimentSteps <= 8 ? 'Paso a paso completo.' : `Necesitas entre 5 y 8 pasos. Hoy tienes ${completedExperimentSteps}.` },
                        { ok: !!experimentCard.metric.trim() && !!experimentCard.evidenceQuant.trim() && !!experimentCard.evidenceQual.trim() && !!testCard.riesgos.trim(), label: experimentCard.metric.trim() && experimentCard.evidenceQuant.trim() && experimentCard.evidenceQual.trim() && testCard.riesgos.trim() ? 'Métrica, riesgos y evidencia definidos.' : 'Completa métrica, riesgos y evidencia cuantitativa/cualitativa.' },
                      ].map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            {item.ok ? <CheckCircle2 size={10} className="text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                          </div>
                          <p className={`text-xs ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
                    <div>
                      <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Revisión de la Card</p>
                      <p className="text-xs text-slate-500 mt-1">Usa IA para revisar la coherencia de la card y deja espacio para observaciones del experto sobre el experimento.</p>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => setShowSendModal(true)}
                        disabled={!moduleCReady}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors ${moduleCReady ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        style={{ fontWeight: 500 }}
                      >
                        <Send size={14} /> Evaluar Card con IA
                      </button>
                      <button
                        onClick={() => setShowMentorModal(true)}
                        disabled={!moduleCReady}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors ${moduleCReady ? 'border border-amber-200 text-amber-700 hover:bg-amber-50' : 'border border-slate-200 text-slate-400 cursor-not-allowed'}`}
                        style={{ fontWeight: 500 }}
                      >
                        <Calendar size={14} /> Pedir revisión de experto
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 600 }}>Comentarios del experto sobre la Card</label>
                      <textarea
                        value={experimentExpertComment}
                        onChange={e => setExperimentExpertComment(e.target.value)}
                        rows={3}
                        placeholder="Ej. La hipótesis está bien enfocada, pero conviene simplificar el método o precisar mejor la evidencia."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    {hasFeedback && (
                      <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                        <Sparkles className="mx-auto text-slate-400 mb-2" size={24} />
                        <p className="text-sm text-slate-600 mb-1" style={{ fontWeight: 600 }}>Aún no hay análisis IA</p>
                        <p className="text-xs text-slate-500">Solicita la revisión IA para obtener feedback del experimento.</p>
                      </div>
                    )}

                    {hasFeedback && (
                      sessionBooked ? (
                        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <CheckCircle2 size={15} className="text-emerald-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>Revisión del experto agendada</p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800" style={{ fontWeight: 600 }}>Step 2 listo</span>
                              </div>
                              <p className="text-xs text-emerald-600 mt-1">La Card quedó lista para pasar a revisión final del step.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                          <p className="text-sm text-amber-800" style={{ fontWeight: 600 }}>Falta la revisión del experto</p>
                          <p className="text-xs text-amber-600 mt-1">Cuando la IA la vea consistente, agenda o registra la revisión experta para cerrar el Step 2.</p>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {false && activeModule === 'C' && (
            <div className="space-y-5">

              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo C · Elegir la idea a experimentar</h1>
                  <StatusChip status={selectedIdea && cRazonGana.trim() && cQueProbamos.trim() ? 'Completado' : 'En progreso'} size="sm" />
                </div>
                <p className="text-sm text-slate-500">De las ideas que generaste, elige 3–5 finalistas y quédate con 1 para experimentar.</p>
              </div>

              {/* HMW reference */}
              <div className="border border-indigo-100 bg-indigo-50 rounded-xl p-3">
                <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600 }}>PREGUNTA GUÍA:</p>
                <p className="text-xs text-indigo-800 italic">"{hmw}"</p>
              </div>

              {/* Paso tabs */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {[
                  { n: 1 as const, label: 'Paso 1 · Armar finalistas' },
                  { n: 2 as const, label: 'Paso 2 · Comparar y elegir' },
                ].map(paso => {
                  const blocked = paso.n === 2 && finalistas.length < 3;
                  return (
                    <button
                      key={paso.n}
                      onClick={() => { if (!blocked) setCPaso(paso.n); }}
                      className={`flex-1 py-2.5 text-xs transition-colors ${cPaso === paso.n ? 'bg-indigo-600 text-white' : blocked ? 'bg-white text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      style={{ fontWeight: cPaso === paso.n ? 600 : 400 }}
                    >
                      {paso.label}
                      {paso.n === 2 && finalistas.length < 3 && <span className="ml-1 opacity-60">🔒</span>}
                    </button>
                  );
                })}
              </div>

              {/* ═══ PASO 1: Armar finalistas ═══ */}
              {cPaso === 1 && (
                <div className="space-y-4">

                  {/* Counter + IA */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${finalistas.length >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                      {finalistas.length}/5 finalistas (mínimo 3)
                    </span>
                    <button
                      onClick={handleIaCFinalistas}
                      disabled={cIaFinalistasLoading || ideas.length === 0}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                      style={{ fontWeight: 500 }}
                    >
                      {cIaFinalistasLoading
                        ? <><span className="animate-spin">⟳</span> Analizando…</>
                        : <><Sparkles size={11} /> IA: ayúdame a armar finalistas</>}
                    </button>
                  </div>
                  {cIaFinalistasLoading && (
                    <p className="text-xs text-violet-500">La IA priorizará variedad de grupos y respeto de líneas rojas. No inventa ideas nuevas.</p>
                  )}

                  {/* Ideas por cluster */}
                  {uniqueClusters.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">Elige ideas de los grupos que generaste. Intenta incluir al menos 1 de cada grupo:</p>
                      {uniqueClusters.map(cluster => (
                        <div key={cluster} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full" style={{ fontWeight: 600 }}>{cluster}</span>
                            <span className="text-xs text-slate-400">{ideas.filter(i => i.cluster === cluster).length} ideas</span>
                          </div>
                          <div className="divide-y divide-slate-50">
                            {ideas.filter(i => i.cluster === cluster).map(idea => {
                              const isAdded = finalistas.some(f => f.ideaId === idea.id);
                              const isFull = !isAdded && finalistas.length >= 5;
                              return (
                                <div key={idea.id} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isAdded ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
                                  <p className="flex-1 text-xs text-slate-700">{idea.text}</p>
                                  <button
                                    onClick={() => addFinalista(idea)}
                                    disabled={isAdded || isFull}
                                    className={`shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors ${isAdded ? 'text-indigo-600 bg-indigo-100' : isFull ? 'text-slate-300 bg-slate-100 cursor-not-allowed' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'}`}
                                    style={{ fontWeight: 500 }}
                                  >
                                    {isAdded ? '✓ Agregada' : '+ Finalista'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      Primero completa el Módulo B con ideas agrupadas en mínimo 3 grupos.
                    </div>
                  )}

                  {/* Finalistas actuales */}
                  {finalistas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Tus finalistas ({finalistas.length})</p>
                      {finalistas.map((f, i) => (
                        <div key={f.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                          <div className="flex items-start gap-2 mb-2.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{f.text}</p>
                              <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded mt-0.5 inline-block">Viene del grupo: {f.cluster}</span>
                            </div>
                            <button onClick={() => removeFinalista(f.id)}>
                              <X size={13} className="text-slate-300 hover:text-red-400" />
                            </button>
                          </div>
                          <div className="space-y-1.5 pl-7">
                            {([
                              { key: 'hmw' as const, label: 'Responde el HMW y no rompe líneas rojas' },
                              { key: 'pronto' as const, label: 'Se puede probar pronto (pocas dependencias)' },
                              { key: 'diferente' as const, label: 'Es diferente a las otras finalistas' },
                            ]).map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={f.checks[key]}
                                  onChange={e => updateFinalistaCheck(f.id, key, e.target.checked)}
                                  className="w-3.5 h-3.5 accent-indigo-600"
                                />
                                <span className={`text-xs ${f.checks[key] ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Paso 1 */}
                  <button
                    onClick={() => setCPaso(2)}
                    disabled={finalistas.length < 3}
                    className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${finalistas.length >= 3 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    style={{ fontWeight: 500 }}
                  >
                    {finalistas.length >= 3
                      ? <>Tengo mis finalistas → Comparar y elegir <ChevronRight size={15} /></>
                      : <><Lock size={14} /> Necesitas {3 - finalistas.length} finalista{3 - finalistas.length !== 1 ? 's' : ''} más para continuar</>}
                  </button>
                </div>
              )}

              {/* ═══ PASO 2: Comparar y elegir ═══ */}
              {cPaso === 2 && (
                <div className="space-y-5">

                  {/* Criteria legend */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Evalúa cada finalista del 1 al 5 en estos criterios:</p>
                    <div className="space-y-1">
                      {[
                        { key: 'D', label: 'Deseable', desc: '¿A alguien le importa de verdad?' },
                        { key: 'V', label: 'Viable', desc: '¿Tiene sentido para el negocio/reglas y tiene dueño?' },
                        { key: 'F', label: 'Factible', desc: '¿Lo podemos probar pronto con lo que ya tenemos?' },
                        { key: 'I', label: 'Impacto', desc: 'Si funciona, ¿cuánto mejora el reto?' },
                        { key: 'E', label: 'Esfuerzo', desc: '¿Qué tan pesado es probarlo? (5 = fácil, 1 = muy pesado)' },
                      ].map(c => (
                        <div key={c.key} className="flex items-baseline gap-2">
                          <span className="text-xs w-16 text-indigo-600 shrink-0" style={{ fontWeight: 600 }}>{c.label}</span>
                          <span className="text-xs text-slate-500">{c.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* IA comparar */}
                  <div>
                    <button
                      onClick={handleIaCComparacion}
                      disabled={cIaComparacionLoading}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50"
                      style={{ fontWeight: 500 }}
                    >
                      {cIaComparacionLoading
                        ? <><span className="animate-spin">⟳</span> Analizando…</>
                        : <><Sparkles size={11} /> IA: comparar ideas con criterio</>}
                    </button>
                    <p className="text-xs text-slate-400 mt-1">La IA propone puntajes con sus razones. Tú los editas y confirmas antes de elegir.</p>
                  </div>

                  {/* Scoring cards */}
                  <div className="space-y-4">
                    {finalistas.map((f, i) => {
                      const total = f.deseable + f.viable + f.factible + f.impacto + f.esfuerzo;
                      const isSelected = selectedIdea === f.ideaId;
                      return (
                        <div key={f.id} className={`border-2 rounded-xl overflow-hidden transition-colors ${isSelected ? 'border-indigo-400' : 'border-slate-200'}`}>
                          {/* Header */}
                          <div className={`px-4 py-3 flex items-start gap-3 ${isSelected ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`} style={{ fontWeight: 700 }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{f.text}</p>
                              <p className="text-xs text-slate-400 mt-0.5">Viene del grupo: <span style={{ fontWeight: 500 }} className="text-slate-600">{f.cluster}</span></p>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-lg shrink-0 ${total >= 20 ? 'bg-emerald-100 text-emerald-700' : total >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`} style={{ fontWeight: 700 }}>
                              {total}/25
                            </div>
                          </div>

                          {/* Scoring grid */}
                          <div className="px-4 py-3 bg-white space-y-2.5">
                            {(['deseable', 'viable', 'factible', 'impacto', 'esfuerzo'] as const).map(key => {
                              const labels = { deseable: 'Deseable', viable: 'Viable', factible: 'Factible', impacto: 'Impacto', esfuerzo: 'Esfuerzo' };
                              return (
                                <div key={key} className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 w-14 shrink-0">{labels[key]}</span>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(n => (
                                      <button
                                        key={n}
                                        onClick={() => updateFinalistaScore(f.id, key, n)}
                                        className={`w-7 h-7 rounded-lg text-xs transition-colors ${f[key] === n ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'}`}
                                        style={{ fontWeight: f[key] === n ? 700 : 400 }}
                                      >
                                        {n}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Razón / suposición IA */}
                            {f.razon && (
                              <div className="flex items-start gap-2 p-2.5 bg-violet-50 border border-violet-100 rounded-xl">
                                <Sparkles size={10} className="text-violet-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-violet-700">{f.razon}</p>
                              </div>
                            )}

                            {/* Elegir */}
                            <button
                              onClick={() => setSelectedIdea(f.ideaId)}
                              className={`w-full py-2 rounded-xl text-xs transition-colors mt-1 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent'}`}
                              style={{ fontWeight: isSelected ? 600 : 500 }}
                            >
                              {isSelected ? '✓ Elegida como la idea a experimentar' : 'Elegir esta idea'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resultado final */}
                  {selectedIdea && (
                    <div className="border-2 border-emerald-300 bg-emerald-50 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-emerald-600 mb-0.5" style={{ fontWeight: 600 }}>IDEA SELECCIONADA:</p>
                          <p className="text-sm text-emerald-900" style={{ fontWeight: 600 }}>
                            {finalistas.find(f => f.ideaId === selectedIdea)?.text}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Por qué gana <span className="text-slate-400" style={{ fontWeight: 400 }}>(1–2 líneas)</span></label>
                        <textarea
                          value={cRazonGana}
                          onChange={e => setCRazonGana(e.target.value)}
                          rows={2}
                          placeholder="Ej. Es la opción con mejor balance entre impacto y esfuerzo, y no depende de sistemas externos."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Qué vamos a probar primero <span className="text-slate-400" style={{ fontWeight: 400 }}>(1 línea)</span></label>
                        <input
                          value={cQueProbamos}
                          onChange={e => setCQueProbamos(e.target.value)}
                          placeholder="Ej. Formulario en Google Forms con notificación automática a TI"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Checklist de avance */}
                  {!(selectedIdea && cRazonGana.trim() && cQueProbamos.trim()) && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Para avanzar necesitas:</p>
                      {[
                        { ok: !!selectedIdea, label: selectedIdea ? 'Idea elegida ✓' : 'Selecciona una idea como ganadora' },
                        { ok: !!cRazonGana.trim(), label: cRazonGana.trim() ? '"Por qué gana" completo ✓' : 'Escribe por qué gana esta idea' },
                        { ok: !!cQueProbamos.trim(), label: cQueProbamos.trim() ? '"Qué vamos a probar" completo ✓' : 'Escribe qué van a probar primero' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.ok ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            {item.ok ? <CheckCircle2 size={10} className="text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />}
                          </div>
                          <p className={`text-xs ${item.ok ? 'text-emerald-700' : 'text-slate-400'}`}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={() => setActiveModule('D')}
                    disabled={!selectedIdea || !cRazonGana.trim() || !cQueProbamos.trim()}
                    className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${selectedIdea && cRazonGana.trim() && cQueProbamos.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    style={{ fontWeight: 500 }}
                  >
                    {selectedIdea && cRazonGana.trim() && cQueProbamos.trim()
                      ? <>Módulo C listo → Documentar la solución <ChevronRight size={15} /></>
                      : <><Lock size={14} /> {!selectedIdea ? 'Elige una idea para avanzar' : 'Completa los campos de la idea seleccionada'}</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Module D: Cards */}
          {activeModule === 'D' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Módulo D: Solution & Test Cards</h1>
                <p className="text-sm text-slate-500">Define la Solution Card y la Test Card para la idea seleccionada.</p>
              </div>

              {/* Solution Card */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target size={16} className="text-indigo-500" />
                  <h2 className="text-base text-slate-900" style={{ fontWeight: 600 }}>Solution Card</h2>
                </div>
                <div className="space-y-3">
                  {([ ['problema', 'Problema que resuelve'], ['usuario', 'Usuario objetivo'], ['propuesta', 'Propuesta de solución'], ['diferenciador', 'Diferenciador clave'], ['hipotesis', 'Hipótesis de valor'], ['supuestos', 'Supuestos clave'] ] as const).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                      <textarea value={solutionCard[field]} onChange={e => setSolutionCard(p => ({ ...p, [field]: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Card */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={16} className="text-violet-500" />
                  <h2 className="text-base text-slate-900" style={{ fontWeight: 600 }}>Test Card (experimento)</h2>
                </div>
                <div className="space-y-3">
                  {([ ['hipotesis', 'Hipótesis a testear'], ['queTestan', 'Qué vas a testear'], ['conQuien', 'Con quién'], ['dondeCuando', 'Dónde y cuándo'], ['metodo', 'Método'], ['metrica', 'Métrica y umbral de éxito'], ['riesgos', 'Riesgos y límites'], ['evidencia', 'Evidencia a capturar'] ] as const).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                      <textarea value={testCard[field]} onChange={e => setTestCard(p => ({ ...p, [field]: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Pasos del experimento (5–8)</label>
                    <div className="space-y-2">
                      {testCard.pasos.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs flex items-center justify-center shrink-0" style={{ fontWeight: 700 }}>{i + 1}</span>
                          <input value={p} onChange={e => { const np = [...testCard.pasos]; np[i] = e.target.value; setTestCard(prev => ({ ...prev, pasos: np })); }} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <button onClick={() => setShowSendModal(true)} className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors" style={{ fontWeight: 500 }}>
                  <Send size={15} /> Enviar a revisión IA
                </button>
              </div>

              {hasFeedback && (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                  <Sparkles className="mx-auto text-slate-400 mb-2" size={24} />
                  <p className="text-sm text-slate-600 mb-1" style={{ fontWeight: 600 }}>Aún no hay análisis IA</p>
                  <p className="text-xs text-slate-500">Solicita la revisión IA para obtener feedback del Step 2.</p>
                </div>
              )}

              {hasFeedback && (
                sessionBooked ? (
                  /* ── Estado post-agendar ── */
                  <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-emerald-800" style={{ fontWeight: 600 }}>Sesión agendada</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800" style={{ fontWeight: 600 }}>Aprobado</span>
                        </div>
                        <p className="text-xs text-emerald-600 mt-0.5">Step 2 confirmado por Adaptive Core.</p>
                        {mentorDate && (
                          <p className="text-xs text-emerald-600 mt-1">
                            <Clock size={10} className="inline mr-1" />{mentorDate}{mentorTime ? ` · ${mentorTime}` : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (canNavigateToAdaptiveStep(adaptiveCore, 3)) navigate(`/projects/${projectId}/step/3`);
                        }}
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        Ir al Step 3 <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Estado pendiente ── */
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                    <p className="text-sm text-amber-800 mb-1" style={{ fontWeight: 600 }}>Sesión con experto obligatoria</p>
                    <p className="text-xs text-amber-600 mb-3">Agenda la sesión con tu mentor. El Step 3 se habilita solo si Adaptive Core confirma el cierre de Step 2.</p>
                    <button
                      onClick={() => setShowMentorModal(true)}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Calendar size={14} /> Agendar sesión con mentor
                    </button>
                    {adaptiveAuthorityError ? <p className="text-xs text-amber-700 mt-2">{adaptiveAuthorityError}</p> : null}
                  </div>
                )
              )}
            </div>
          )}
    </StepWorkspaceShell>
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Evaluar Card de experimentación con IA</h3>
            <p className="text-sm text-slate-500 mb-4">La IA revisará la hipótesis, el test, la métrica, los pasos, los riesgos y la evidencia definida para tu experimento.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => { setShowSendModal(false); setTimeout(() => setHasFeedback(true), 1500); }} className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm hover:bg-violet-700 transition-colors" style={{ fontWeight: 500 }}>
                Evaluar con IA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agendar sesión con mentor */}
      {showMentorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agendar sesión con mentor</h3>
                <p className="text-xs text-slate-500 mt-0.5">Selecciona fecha y hora. El avance requiere confirmación backend.</p>
              </div>
              <button onClick={() => setShowMentorModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Fecha */}
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
                  <Calendar size={12} className="inline mr-1.5 text-slate-400" />Fecha
                </label>
                <input
                  type="date"
                  value={mentorDate}
                  onChange={e => setMentorDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
                  <Clock size={12} className="inline mr-1.5 text-slate-400" />Hora
                </label>
                <select
                  value={mentorTime}
                  onChange={e => setMentorTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar hora...</option>
                  {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].map(h => (
                    <option key={h} value={h}>{h} hrs</option>
                  ))}
                </select>
              </div>

              {/* Mentor */}
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
                  <User size={12} className="inline mr-1.5 text-slate-400" />Mentor
                </label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Ana García · Innovación & Procesos</option>
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Notas <span className="text-slate-400" style={{ fontWeight: 400 }}>(opcional)</span></label>
                <textarea
                  value={mentorNotes}
                  onChange={e => setMentorNotes(e.target.value)}
                  rows={2}
                  placeholder="Contexto o preguntas para la sesión..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <AlertCircle size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-600">
                  <span style={{ fontWeight: 600 }}>Autoridad Adaptive:</span> confirmar la sesión no desbloquea Step 3 por sí sola. El backend debe confirmar el output de Step 2.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setShowMentorModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors"
                style={{ fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmStep2Transition()}
                disabled={!mentorDate || !mentorTime || adaptiveTransitionSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors"
                style={{ fontWeight: 500 }}
              >
                {adaptiveTransitionSaving ? 'Confirmando...' : 'Confirmar con backend'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mentor HMW modal */}
      {showMentorHMW && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Pedir feedback a un experto</h3>
              <button onClick={() => setShowMentorHMW(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-3">Comparte tu pregunta con el mentor para afinar el foco antes de generar ideas.</p>
            {hmw.trim() ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
                <p className="text-xs text-indigo-400 mb-1" style={{ fontWeight: 600 }}>TU PREGUNTA ACTUAL</p>
                <p className="text-sm text-indigo-800 italic">"{hmw}"</p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-slate-400 italic">Todavía no escribiste tu pregunta.</p>
              </div>
            )}
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
              <p className="text-xs text-amber-700">
                <span style={{ fontWeight: 600 }}>Próximo paso:</span> Copia tu pregunta y compártela con tu mentor en la sesión agendada o por el canal de comunicación del programa.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { navigator.clipboard.writeText(hmw); }} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
                Copiar pregunta
              </button>
              <button onClick={() => setShowMentorHMW(false)} className="flex-1 bg-slate-800 text-white rounded-xl py-2.5 text-sm hover:bg-slate-900 transition-colors" style={{ fontWeight: 500 }}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

