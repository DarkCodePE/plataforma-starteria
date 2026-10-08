import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, CheckCircle2, Lock, Send, Calendar, ChevronRight,
  AlertTriangle, Sparkles, Plus, X, AlertCircle, ChevronDown,
  MessageSquare, Copy, Target, FileText, ExternalLink, Info,
  Users, Trash2, BarChart2, HelpCircle, TrendingUp, Upload,
} from 'lucide-react';
import { MentorSupportModal } from '../components/MentorSupportModal';
import { enrichProject, type Project, useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import { EvidenceUploader } from '../components/EvidenceUploader';
import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { LeaderFeedbackStatusCard } from '../components/LeaderFeedbackStatusCard';
import { useAutosave } from '../hooks/useAutosave';
import { AutofillField } from '../components/autofill/AutofillField';
import * as stepService from '../services/stepService';
import { getById } from '../services/projectService';
import { Step1CaptureSynthesisModule } from '../components/step1-capture-synthesis/Step1CaptureSynthesisModule';
import { buildCaptureModuleContext, buildStep1ModuleViewModels, calculateStep1Progress, getStep1CaptureMissing } from '../components/step1-architecture/step1Completion';
import { normalizeCaptureSynthesisState, syncCaptureSynthesisWithResearch } from '../components/step1-architecture/step1Legacy';
import { STEP1_MODULES } from '../components/step1-architecture/step1ModuleConfig';
import { Step1ResearchModuleV2 } from '../components/step1-research-v2/Step1ResearchModuleV2';
import { buildInitialResearchV2State, buildResearchFrontSuggestions, buildResearchObjective } from '../components/step1-research-v2/researchObjectiveBuilder';
import { ResearchModuleAContext, Step1ResearchModuleV2State } from '../components/step1-research-v2/step1ResearchV2.types';
import { Step1CaptureLegacyRestrictions, Step1CaptureLegacySynthesis, Step1CaptureLegacyValidation, Step1ModuleId } from '../components/step1-architecture/step1Architecture.types';
import { confirmAdaptiveCheckpoint, confirmStep1Output, getAdaptiveCore } from '../../features/adaptive-core/services/adaptiveCoreService';
import { canNavigateToAdaptiveStep, latestAdaptiveStepOutput } from '../../features/adaptive-core/domain/adaptiveAuthority';
import type { AdaptiveInitiativeCore } from '../../features/adaptive-core/domain/types';
import { AdaptiveCheckpointWorkspace } from '../../features/adaptive-core/components';

type ModuleId = Step1ModuleId | 'D' | 'S';

interface ModuleASISData {
  casoReal: string;
  pasos: string[];
  quiebreIndex: number | null;
  quiebreDetalle: string;
  quiebre: string;
  consecuencia: string;
  consequenceTags: Array<'operativa' | 'economica' | 'humana' | 'estrategica'>;
  causaInmediata: string;
  evidenciaTipo: '' | 'dato' | 'ticket' | 'testimonio' | 'benchmark';
  evidenciaNota: string;
  alcance: '' | 'antes' | 'durante' | 'después' | 'transversal';
  corteAlcance: string;
}

interface TemaInvestigacion {
  id: string;
  titulo: string;
  preguntaClave: string;
  via: '' | 'entrevistas' | 'data' | 'ambas';
  perfilesIds: string[];
  fuente: string;
  preguntas: string[];
}

interface PerfilEntrevista {
  id: string;
  nombre: string;
  porQue: string;
  temas?: { id: string; texto: string; preguntas: string[] }[];
}

interface ModuleBData {
  objetivoGeneral: string;
  temas: TemaInvestigacion[];
  perfiles: PerfilEntrevista[];
  guiaGenerada: boolean;
  modalidad: '' | 'desk' | 'entrevistas' | 'ambas';
  deskTemas: string;
  objetivos: { texto: string; priorizado?: boolean }[];
  version: 'legacy' | 'v2';
  researchV2: Step1ResearchModuleV2State;
}

interface ModuleCData {
  // MUST 1 — Límites no negociables
  limitesChips: string[];
  limitesTexto: string;
  // MUST 2 — Dependencia crítica
  dependencia: string;
  dependenciaDueno: string;
  dependenciaProbabilidad: '' | 'baja' | 'media' | 'alta';
  // MUST 3 — Alternativa para pilotear
  alternativaPiloto: string;
  // Opcionales (colapsados)
  vistoBueno: string;
  capacidadReal: string;
}

interface FuenteD {
  id: string;
  tipo: '' | 'persona' | 'datos' | 'documento';
  rolNombre: string;
  porQue: string;
  queConfirmar: string;
}

interface EvidenciaD {
  id: string;
  tipo: '' | 'nota' | 'audio' | 'captura' | 'link' | 'reporte';
  nombre: string;
  queDemuestra: string;
}

interface ModuleDData {
  objetivos: string[];
  fuentes: FuenteD[];
  guiasGeneradas: boolean;
  evidencias: EvidenciaD[];
  decisionReto: '' | 'mantiene' | 'ajusta' | 'cambia';
  nuevaVersionReto: string;
  queAjusto: string[];
}

interface SintesisData {
  resumen: string;
  pivotCheck: '' | 'mantener' | 'acotar' | 'reformular' | 'cambiar';
  razonPivot: string;
  version: number;
}

interface EvidenciaA {
  id: string;
  tipo: '' | 'dato' | 'ticket' | 'testimonio' | 'benchmark' | 'observacion';
  desc: string;
  fuente: string;
}

interface Step1AiAnalysisState {
  generatedText: string;
  draftText: string;
  isEditing: boolean;
}


const STEP1_CONSEQUENCE_OPTIONS = [
  { id: 'operativa', label: 'Operativa' },
  { id: 'economica', label: 'Economica' },
  { id: 'humana', label: 'Humana' },
  { id: 'estrategica', label: 'Estrategica' },
] as const;

type Step1ConsequenceId = (typeof STEP1_CONSEQUENCE_OPTIONS)[number]['id'];

const normalizeStep1ConsequenceTags = (value: unknown): Step1ConsequenceId[] => {
  const validIds = new Set<Step1ConsequenceId>(STEP1_CONSEQUENCE_OPTIONS.map(option => option.id));
  const normalizedValues = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
    ? [value]
    : [];

  return normalizedValues.filter((item): item is Step1ConsequenceId =>
    typeof item === 'string' && validIds.has(item as Step1ConsequenceId),
  );
};

const STEP1_RESEARCH_MODULE_B_VERSION: 'legacy' | 'v2' = 'v2';

const buildResearchModuleAContext = (
  asisData: ModuleASISData,
  lecturaConsolidada: string,
  actoresProceso: string,
): ResearchModuleAContext => ({
  casoReal: asisData.casoReal,
  quiebre: asisData.quiebre,
  consecuencia: asisData.consecuencia,
  causaInmediata: asisData.causaInmediata,
  lecturaConsolidada,
  actoresProceso,
});

const syncLegacyModuleBFromV2 = (
  current: ModuleBData,
  researchV2: Step1ResearchModuleV2State,
): ModuleBData => {
  const selectedProfileMap = new Map<string, PerfilEntrevista>();

  researchV2.fronts.forEach(front => {
    front.sources
      .filter(source => source.type === 'perfil' && front.selectedSourceIds.includes(source.id))
      .forEach(source => {
        selectedProfileMap.set(source.id, {
          id: source.id,
          nombre: source.label,
          porQue: source.detail,
        });
      });
  });

  const temas = researchV2.fronts.map(front => ({
    id: front.id,
    titulo: front.title,
    preguntaClave: front.learningGoal,
    via: front.sourceMode === 'perfil' ? 'entrevistas' : front.sourceMode,
    perfilesIds: front.sources
      .filter(source => source.type === 'perfil' && front.selectedSourceIds.includes(source.id))
      .map(source => source.id),
    fuente: front.sources
      .filter(source => source.type === 'data' && front.selectedSourceIds.includes(source.id))
      .map(source => source.label)
      .join(', '),
    preguntas: front.guides.flatMap(guide => guide.questions).slice(0, 3),
  })) as TemaInvestigacion[];

  return {
    ...current,
    version: 'v2',
    researchV2,
    objetivoGeneral: researchV2.objective.draft,
    temas,
    perfiles: Array.from(selectedProfileMap.values()),
    guiaGenerada: researchV2.fronts.some(front => front.guides.length > 0),
  };
};


export function Step1Page() {
  const { projectId } = useParams();
  const { projects, projectsLoading, setCurrentProject, updateProject, user } = useApp();
  const navigate = useNavigate();

  const contextProject = projects.find(p => p.id === projectId);
  const [fetchedProject, setFetchedProject] = useState<Project | null>(null);
  const [projectFetching, setProjectFetching] = useState(false);
  const [projectFetchError, setProjectFetchError] = useState(false);
  const project = contextProject ?? fetchedProject;
  const step = project?.steps.find(s => s.number === 1);
  const step0 = project?.step0Data;

  const [activeModule, setActiveModule] = useState<ModuleId>('A');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sendingIA, setSendingIA] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [fichaCopyMsg, setFichaCopyMsg] = useState(false);
  const [showMentorOptions, setShowMentorOptions] = useState(false);
  const [adaptiveStep1Saving, setAdaptiveStep1Saving] = useState(false);
  const [adaptiveStep1Error, setAdaptiveStep1Error] = useState<string | null>(null);
  const [adaptiveCore, setAdaptiveCore] = useState<AdaptiveInitiativeCore | null>(null);
  const [adaptiveCoreStatus, setAdaptiveCoreStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const [iaLoadingB, setIaLoadingB] = useState(false);
  const [expandedTemaId, setExpandedTemaId] = useState<string | null>(null);
  const [expandedPerfilId, setExpandedPerfilId] = useState<string | null>(null);
  const [guiaVisible, setGuiaVisible] = useState(false);
  const [showOpcionalesC, setShowOpcionalesC] = useState(false);

  // Module data states
  const [asisData, setAsisData] = useState<ModuleASISData>({
    casoReal: '',
    pasos: [],
    quiebreIndex: null,
    quiebreDetalle: '',
    quiebre: '',
    consecuencia: '',
    causaInmediata: '',
    evidenciaTipo: '',
    evidenciaNota: '',
    alcance: '',
    corteAlcance: '',
    consequenceTags: [],
  });

  const [bData, setBData] = useState<ModuleBData>({
    objetivoGeneral: '',
    temas: [],
    perfiles: [],
    guiaGenerada: false,
    modalidad: '',
    deskTemas: '',
    objetivos: [],
    version: STEP1_RESEARCH_MODULE_B_VERSION,
    researchV2: buildInitialResearchV2State({
      casoReal: '',
      quiebre: '',
      consecuencia: '',
      causaInmediata: '',
      lecturaConsolidada: '',
      actoresProceso: '',
    }),
  });

  const [cData, setCData] = useState<ModuleCData>({
    limitesChips: [],
    limitesTexto: '',
    dependencia: '',
    dependenciaDueno: '',
    dependenciaProbabilidad: '',
    alternativaPiloto: '',
    vistoBueno: '',
    capacidadReal: '',
  });

  const [dData, setDData] = useState<ModuleDData>({
    objetivos: [],
    fuentes: [],
    guiasGeneradas: false,
    evidencias: [],
    decisionReto: '',
    nuevaVersionReto: '',
    queAjusto: [],
  });

  const [guiasPreguntas, setGuiasPreguntas] = useState<Record<string, string[]>>({});
  const [generandoGuia, setGenerandoGuia] = useState(false);

  const [sintesisData, setSintesisData] = useState<SintesisData>({
    resumen: '',
    pivotCheck: '',
    razonPivot: '',
    version: 1,
  });
  const [captureSynthesisData, setCaptureSynthesisData] = useState(() => normalizeCaptureSynthesisState({
    researchState: bData.researchV2,
    legacyRestrictions: cData,
    legacyValidation: dData,
    legacySynthesis: sintesisData,
  }));
  const [moduleAdjustments, setModuleAdjustments] = useState({ research: false, capture: false });

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

  const loadAdaptiveCore = useCallback(async () => {
    if (!projectId) return null;
    setAdaptiveCoreStatus('loading');
    setAdaptiveStep1Error(null);
    try {
      const core = await getAdaptiveCore(projectId);
      setAdaptiveCore(core);
      setAdaptiveCoreStatus('loaded');
      return core;
    } catch (error: any) {
      setAdaptiveCore(null);
      setAdaptiveCoreStatus('error');
      setAdaptiveStep1Error(error?.response?.data?.error?.message ?? error?.message ?? 'No pudimos cargar el estado adaptativo persistido.');
      return null;
    }
  }, [projectId]);

  useEffect(() => {
    void loadAdaptiveCore();
  }, [loadAdaptiveCore]);

  // ── Módulo A — nuevos estados (rediseño Step1A) ──────────────────────────
  const [step0Collapsed, setStep0Collapsed] = useState(false);
  const [actoresProceso, setActoresProceso] = useState('');
  const [momentoData, setMomentoData] = useState({ cuando: '', frecuencia: '', quienSufre: '', duracion: '' });
  const [evidenciasA, setEvidenciasA] = useState<EvidenciaA[]>([]);
  const [iaModAState, setIaModAState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [fichaConfirmada, setFichaConfirmada] = useState(false);
  const [aiAnalysisState, setAiAnalysisState] = useState<Step1AiAnalysisState>({
    generatedText: '',
    draftText: '',
    isEditing: false,
  });

  const addEvidenciaA = () =>
    setEvidenciasA(p => [...p, { id: Date.now().toString(), tipo: '', desc: '', fuente: '' }]);
  const updateEvidenciaA = (id: string, changes: Partial<EvidenciaA>) =>
    setEvidenciasA(p => p.map(e => e.id === id ? { ...e, ...changes } : e));
  const removeEvidenciaA = (id: string) =>
    setEvidenciasA(p => p.filter(e => e.id !== id));

  const nivelSustento: 'sin' | 'debil' | 'solido' = (() => {
    const count = evidenciasA.filter(e => e.desc.trim()).length;
    if (count === 0) return 'sin';
    if (count === 1) return 'debil';
    return 'solido';
  })();

  const bloque1Ok = asisData.casoReal.trim().length > 0 && asisData.pasos.filter(p => p.trim()).length >= 2;
  const bloque2Ok = asisData.quiebreIndex !== null;
  const legacyConsequenceTag = (asisData as ModuleASISData & { consequenceTag?: unknown }).consequenceTag;
  const selectedConsequenceTags = normalizeStep1ConsequenceTags(
    Array.isArray(asisData.consequenceTags) || typeof asisData.consequenceTags === 'string'
      ? asisData.consequenceTags
      : legacyConsequenceTag,
  );
  const selectedConsequenceLabels = STEP1_CONSEQUENCE_OPTIONS
    .filter(option => selectedConsequenceTags.includes(option.id))
    .map(option => option.label);
  const bloque3Ok = selectedConsequenceTags.length > 0 && asisData.consecuencia.trim().length > 0 && asisData.causaInmediata.trim().length > 0;
  const listoParaIA = bloque1Ok && bloque2Ok && bloque3Ok;

  // Lectura consolidada derivada del estado real — sin textos placeholder
  const lecturaConsolidada = (() => {
    const pasoQuiebre = asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex]
      ? asisData.pasos[asisData.quiebreIndex]
      : 'el paso identificado';
    const causaCorta = asisData.causaInmediata
      ? asisData.causaInmediata.split('.')[0].toLowerCase()
      : 'una causa operativa sin responsable claro';
    const consecuenciaCorta = asisData.consecuencia
      ? asisData.consecuencia.split('.')[0].toLowerCase()
      : 'un impacto directo en los involucrados';
    const procesoCorto = asisData.casoReal
      ? asisData.casoReal.split(' ').slice(0, 8).join(' ') + (asisData.casoReal.split(' ').length > 8 ? '…' : '')
      : 'el proceso descrito';
    const consequenceSummary = selectedConsequenceLabels.length > 0
      ? selectedConsequenceLabels.join(', ')
      : 'sin impactos marcados';
    const sustentoLabel = nivelSustento === 'solido'
      ? 'sólido'
      : nivelSustento === 'debil'
      ? 'inicial — suficiente para avanzar con cautela'
      : 'aún débil — conviene reforzarlo en el Módulo B';
    return `El reto ocurre en "${pasoQuiebre}" dentro del proceso: ${procesoCorto}. La causa directa es que ${causaCorta}. Como resultado, ${consecuenciaCorta}. Los impactos marcados son ${consequenceSummary}. El sustento disponible es ${sustentoLabel}.`;
  })();

  const researchModuleAContext = buildResearchModuleAContext(asisData, lecturaConsolidada, actoresProceso);

  // Temas prioritarios para investigar — derivados del contexto real del módulo
  const temasPrioritarios = [
    {
      n: 1,
      titulo: 'Magnitud real del problema',
      desc: `¿Cuántos casos exactos presentan retraso en "${asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex] ? asisData.pasos[asisData.quiebreIndex].toLowerCase() : 'el paso quiebre'}"? ¿Hay registros en sistema o se trabaja con estimaciones informales?`,
    },
    {
      n: 2,
      titulo: 'Tiempo y costo real por caso',
      desc: `¿Cuánto tarda en promedio resolver el quiebre, y cuántas horas-persona consume en ${actoresProceso ? actoresProceso.split(',')[0].trim() : 'los actores involucrados'}? ¿Existe algún cálculo o referencia de costo?`,
    },
    {
      n: 3,
      titulo: 'Variación del impacto entre perfiles',
      desc: `¿El problema afecta igual a todos los involucrados o hay perfiles que lo sufren de forma más crítica? Identificar esos segmentos ayudará a enfocar la acción.`,
    },
    {
      n: 4,
      titulo: 'Parches actuales y sus límites',
      desc: `¿Qué hacen hoy ${actoresProceso ? actoresProceso.split(',')[0].trim() : 'los actores'} para compensar el problema mientras existe? ¿Por qué esas soluciones improvisadas no resuelven el quiebre de fondo?`,
    },
  ];

  const analysisSignature = JSON.stringify({
    casoReal: asisData.casoReal,
    pasos: asisData.pasos,
    quiebreIndex: asisData.quiebreIndex,
    consecuencia: asisData.consecuencia,
    causaInmediata: asisData.causaInmediata,
    actoresProceso,
  });
  const researchSignature = JSON.stringify({
    objective: bData.researchV2.objective,
    fronts: bData.researchV2.fronts,
  });
  const captureSignature = JSON.stringify(captureSynthesisData);
  const analysisSignatureRef = useRef(analysisSignature);
  const researchSignatureRef = useRef(researchSignature);
  const captureSignatureRef = useRef(captureSignature);

  const moduloBIniciado =
    bData.researchV2.objective.draft.trim().length > 0 ||
    bData.researchV2.fronts.some(front => front.title.trim().length > 0 || front.selectedSourceIds.length > 0);
  const moduloCIniciado =
    captureSynthesisData.captures.some(capture => capture.notes.trim().length > 0 || capture.finding.trim().length > 0) ||
    captureSynthesisData.evidences.length > 0 ||
    captureSynthesisData.organizedInsights.some(item => item.trim().length > 0) ||
    captureSynthesisData.finalSummary.trim().length > 0 ||
    Boolean(captureSynthesisData.finalDecision);

  useEffect(() => {
    setCaptureSynthesisData(prev => syncCaptureSynthesisWithResearch(prev, bData.researchV2));
  }, [bData.researchV2]);

  useEffect(() => {
    if (analysisSignatureRef.current === analysisSignature) return;
    analysisSignatureRef.current = analysisSignature;
    setModuleAdjustments(prev => ({
      research: moduloBIniciado ? true : prev.research,
      capture: moduloCIniciado ? true : prev.capture,
    }));
  }, [analysisSignature, moduloBIniciado, moduloCIniciado]);

  useEffect(() => {
    if (researchSignatureRef.current === researchSignature) return;
    researchSignatureRef.current = researchSignature;
    setModuleAdjustments(prev => ({
      research: false,
      capture: moduloCIniciado ? true : prev.capture,
    }));
  }, [researchSignature, moduloCIniciado]);

  useEffect(() => {
    if (captureSignatureRef.current === captureSignature) return;
    captureSignatureRef.current = captureSignature;
    setModuleAdjustments(prev => ({ ...prev, capture: false }));
  }, [captureSignature]);

  const step1FormData = { asisData, evidenciasA, aiAnalysisState, bData, captureSynthesisData, moduleAdjustments };

  const autosaveFn = useCallback(async (data: typeof step1FormData) => {
    if (!projectId) return;
    await stepService.saveStepData(projectId, 1, {
      _meta: { version: 1, lastSavedAt: new Date().toISOString(), lastSavedBy: 'user' },
      formData: data,
    });
  }, [projectId]);

  const { state: saveState } = useAutosave({
    data: step1FormData,
    saveFn: autosaveFn,
    delay: 2000,
    // Sólo quien puede escribir guarda: el Portfolio Lead asignado lee la iniciativa sin ser del
    // equipo y el backend le rechaza el PUT (step.access.ts).
    enabled: !!projectId && (!!contextProject || user?.role === 'admin' || user?.role === 'mentor'),
  });

  // Hydrate from backend on mount; mirror Step 2's persistence pattern.
  // Pull stepData once; if it has a `formData` envelope written by an earlier
  // session, rehydrate the local state. Falls back silently to the empty
  // defaults when nothing is persisted (preserves the empty state).
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await stepService.getStepData(projectId, 1);
        if (cancelled || !stored || typeof stored !== 'object') return;
        const formData = (stored as { formData?: Record<string, unknown> }).formData;
        if (!formData) return;
        if (formData.asisData && typeof formData.asisData === 'object')
          setAsisData(formData.asisData as ModuleASISData);
        if (Array.isArray(formData.evidenciasA))
          setEvidenciasA(formData.evidenciasA as EvidenciaA[]);
        if (formData.aiAnalysisState && typeof formData.aiAnalysisState === 'object')
          setAiAnalysisState(formData.aiAnalysisState as Step1AiAnalysisState);
        if (formData.bData && typeof formData.bData === 'object')
          setBData(formData.bData as ModuleBData);
        if (formData.captureSynthesisData && typeof formData.captureSynthesisData === 'object')
          setCaptureSynthesisData(formData.captureSynthesisData as typeof captureSynthesisData);
        if (formData.moduleAdjustments && typeof formData.moduleAdjustments === 'object')
          setModuleAdjustments(formData.moduleAdjustments as typeof moduleAdjustments);
      } catch {
        // 404 or auth error — keep defaults silently; AutosaveIndicator will reflect future writes.
      }
    })();
    return () => { cancelled = true; };
    // We only want to hydrate on project change, not on every state mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const updateResearchV2 = (updater: (prev: Step1ResearchModuleV2State) => Step1ResearchModuleV2State) => {
    setBData(prev => {
      const nextResearchV2 = updater(prev.researchV2);
      return syncLegacyModuleBFromV2(prev, nextResearchV2);
    });
  };

  const confirmAdaptiveStep1Checkpoint = async (responses: Record<string, unknown>, truthBindings?: { claimId: string; evidenceIds: string[]; sourceRefIds: string[] }) => {
    if (!projectId || !adaptiveCore?.activeCheckpoint || adaptiveCore.activeCheckpoint.step !== 1) return;
    setAdaptiveStep1Saving(true);
    setAdaptiveStep1Error(null);
    try {
      const nextCore = await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `${projectId}-${adaptiveCore.activeCheckpoint.checkpointKey}-${Date.now()}-ui-confirm`,
        checkpointKey: adaptiveCore.activeCheckpoint.checkpointKey,
        responses,
        truthBindings,
      });
      setAdaptiveCore(nextCore);
    } catch (error: any) {
      setAdaptiveStep1Error(error?.response?.data?.error?.message ?? error?.message ?? 'No pudimos confirmar el checkpoint adaptativo.');
    } finally {
      setAdaptiveStep1Saving(false);
    }
  };

  const confirmAdaptiveStep1Output = async () => {
    if (!projectId || !adaptiveCore) return;
    const draft = latestAdaptiveStepOutput(adaptiveCore, 1, 'draft');
    if (!draft?.output) return;
    setAdaptiveStep1Saving(true);
    setAdaptiveStep1Error(null);
    try {
      await confirmStep1Output(projectId, {
        idempotencyKey: `${projectId}-step1-output-${draft.id ?? 'draft'}-confirm`,
        brief: draft.output,
        confirmed: true,
      });
      const refreshedCore = await loadAdaptiveCore();
      if (refreshedCore && canNavigateToAdaptiveStep(refreshedCore, 2)) {
        mirrorStep1AdaptiveSuccess();
        navigate(`/projects/${projectId}/step/2`);
      }
    } catch (error: any) {
      setAdaptiveStep1Error(error?.response?.data?.error?.message ?? error?.message ?? 'No pudimos confirmar el output de Step 1.');
    } finally {
      setAdaptiveStep1Saving(false);
    }
  };

  if (!project && (projectsLoading || projectFetching)) return <div className="p-6"><p className="text-slate-500">Cargando proyecto...</p></div>;
  if (!project && projectFetchError) return <div className="p-6"><p className="text-slate-500">No pudimos cargar el proyecto.</p></div>;
  if (!project || !step) return <div className="p-6"><p className="text-slate-500">Proyecto o Step no encontrado.</p></div>;

  if (adaptiveCoreStatus === 'loading') {
    return <div className="p-8 text-center"><p className="text-slate-500">Cargando estado adaptativo...</p></div>;
  }
  if (adaptiveCoreStatus === 'error' || !adaptiveCore) {
    return <div className="p-8 text-center"><p className="text-rose-700">{adaptiveStep1Error ?? 'No pudimos cargar Adaptive Core.'}</p><button type="button" onClick={() => void loadAdaptiveCore()} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">Reintentar</button></div>;
  }

  if (!canNavigateToAdaptiveStep(adaptiveCore, 1)) {
    return (
      <main className="min-h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6">
          <p className="text-sm text-amber-700" style={{ fontWeight: 800 }}>Step 1 bloqueado</p>
          <h1 className="mt-2 text-xl text-slate-950" style={{ fontWeight: 850 }}>Step 0 aún debe confirmarse antes de iniciar Step 1.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Confirma el output de Step 0 en Adaptive Core para que Startería configure CP-1.1 y habilite este paso.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/step/0`)}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700"
            style={{ fontWeight: 800 }}
          >
            Volver a Step 0
          </button>
        </div>
      </main>
    );
  }

  const adaptiveStep1Checkpoint = adaptiveCore.activeCheckpoint?.step === 1 ? adaptiveCore.activeCheckpoint : null;
  const adaptiveStep1Draft = latestAdaptiveStepOutput(adaptiveCore, 1, 'draft');
  const adaptiveStep1Confirmed = Boolean(latestAdaptiveStepOutput(adaptiveCore, 1, 'confirmed'));
  return (
    <main className="min-h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => navigate(`/projects/${projectId}`)} className="mb-5 text-sm text-slate-500 hover:text-slate-800">Volver al proyecto</button>
        <AdaptiveCheckpointWorkspace
          core={adaptiveCore}
          step={1}
          checkpoint={adaptiveStep1Checkpoint}
          questions={adaptiveStep1Checkpoint?.questions ?? []}
          initialResponses={{ ...adaptiveCore.confirmedResponses, ...(adaptiveCore.activeCheckpoint?.responses ?? {}) }}
          outputPreview={adaptiveStep1Draft?.output ?? null}
          outputConfirmed={adaptiveStep1Confirmed}
          saving={adaptiveStep1Saving}
          error={adaptiveStep1Error}
          onConfirmCheckpoint={adaptiveStep1Checkpoint ? confirmAdaptiveStep1Checkpoint : undefined}
          onConfirmOutput={adaptiveStep1Draft ? confirmAdaptiveStep1Output : undefined}
          onRefresh={() => void loadAdaptiveCore()}
        />
      </div>
    </main>
  );

  const semaforo = (() => {
    const limitesOk = cData.limitesChips.length > 0 || cData.limitesTexto.trim().length > 0;
    const dependenciaOk = cData.dependencia.trim().length > 0;
    const alternativaOk = cData.alternativaPiloto.trim().length > 0;
    // Rojo: hay dependencia pero no existe alternativa para pilotear
    if (dependenciaOk && !alternativaOk) return 'rojo';
    // Amarillo: prob alta sin dueño, o límites aún vacíos
    if (!limitesOk) return 'amarillo';
    if (dependenciaOk && cData.dependenciaProbabilidad === 'alta') return 'amarillo';
    if (dependenciaOk && !cData.dependenciaDueno.trim()) return 'amarillo';
    // Verde: los 3 MUST completos y riesgo controlado
    if (limitesOk && dependenciaOk && alternativaOk) return 'verde';
    return 'amarillo';
  })();

  const SEMAFORO_CONFIG_MAP: Record<string, { color: string; bg: string; dot: string; label: string; desc: string }> = {
    verde:    { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', label: '🟢 Verde — Listo para avanzar',    desc: 'Los 3 campos MUST están completos y los riesgos están bajo control. Puedes continuar al Módulo D.' },
    amarillo: { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-500',  label: '🟡 Amarillo — Revisar antes de continuar', desc: 'Hay una dependencia de probabilidad alta o falta el dueño. Define quién es responsable antes de avanzar.' },
    rojo:     { color: 'text-red-700',     bg: 'bg-red-50 border-red-200',        dot: 'bg-red-500',    label: '🔴 Rojo — Bloqueado',              desc: 'Tienes una dependencia registrada pero no definiste cómo pilotear sin ella. Sin alternativa, el diseño queda en el aire.' },
  };
  const semaforoConfig = SEMAFORO_CONFIG_MAP[semaforo] ?? {
    color: 'text-slate-700',
    bg: 'bg-slate-50 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Estado del semáforo',
    desc: 'No se pudo calcular el estado del semáforo con los datos actuales.',
  };

  // ── Módulo B helpers — defined before `modules` to avoid temporal dead zone ──

  const getModuloBMissing = () => {
    if (bData.version === 'v2') {
      const missing: string[] = [];
      if (!bData.researchV2.objective.draft.trim()) {
        missing.push('Define el objetivo general de investigacion');
      }

      const validFronts = bData.researchV2.fronts.filter(front =>
        front.title.trim() && front.whyItMatters.trim() && front.learningGoal.trim(),
      );
      if (validFronts.length < 3) {
        missing.push(`Define al menos 3 frentes de investigacion alineados (llevas ${validFronts.length})`);
      }

      const frontsWithoutSources = bData.researchV2.fronts.filter(front =>
        front.title.trim() && front.selectedSourceIds.length === 0,
      ).length;
      if (frontsWithoutSources > 0) {
        missing.push(`${frontsWithoutSources} frente(s) aun no tienen fuente seleccionada`);
      }

      const frontsWithoutGuides = bData.researchV2.fronts.filter(front => {
        if (!front.title.trim() || front.selectedSourceIds.length === 0) return false;
        return front.selectedSourceIds.some(sourceId => !front.guides.some(guide => guide.sourceId === sourceId));
      }).length;
      if (frontsWithoutGuides > 0) {
        missing.push(`${frontsWithoutGuides} frente(s) aun no tienen guia generada para todas sus fuentes`);
      }

      return missing;
    }

    const m: string[] = [];
    if (!bData.objetivoGeneral.trim()) m.push('Define el objetivo general de la investigación');
    const temasConTitulo = bData.temas.filter(t => t.titulo.trim()).length;
    if (temasConTitulo < 3) m.push(`Define al menos 3 frentes de investigación (llevas ${temasConTitulo})`);
    const temasSinVia = bData.temas.filter(t => t.titulo.trim() && !t.via).length;
    if (temasSinVia > 0) m.push(`${temasSinVia} frente(s) sin modalidad de captura definida`);
    const hayEntrevistas = bData.temas.some(t => (t.via === 'entrevistas' || t.via === 'ambas') && t.titulo.trim());
    if (hayEntrevistas && bData.perfiles.length === 0) m.push('Define al menos 1 perfil a entrevistar');
    const temasSinPerfil = bData.temas.filter(t => (t.via === 'entrevistas' || t.via === 'ambas') && t.titulo.trim() && t.perfilesIds.length === 0).length;
    if (temasSinPerfil > 0) m.push(`${temasSinPerfil} frente(s) por entrevistas sin perfil vinculado`);
    const temasSinFuente = bData.temas.filter(t => (t.via === 'data' || t.via === 'ambas') && t.titulo.trim() && !t.fuente.trim()).length;
    if (temasSinFuente > 0) m.push(`${temasSinFuente} frente(s) por data sin fuente definida`);
    return m;
  };

  const moduloBListo = () => getModuloBMissing().length === 0;

  const getModuloDMissing = () => {
    const m: string[] = [];
    const objetivosValidos = dData.objetivos.filter(o => o.trim()).length;
    if (objetivosValidos === 0) m.push('Al menos 1 objetivo definido (sección 1)');
    if (dData.fuentes.length === 0) m.push('Al menos 1 fuente a consultar (sección 2)');
    const evidenciasConEtiqueta = dData.evidencias.filter(e => e.queDemuestra.trim()).length;
    if (evidenciasConEtiqueta === 0) m.push('Sube al menos 1 evidencia con etiqueta (sección 4)');
    if (!dData.decisionReto) m.push('Decisión sobre el reto seleccionada (sección 5)');
    return m;
  };

  const moduloDListo = () => getModuloDMissing().length === 0;

  const modules: { id: ModuleId; label: string; shortName: string; unlocked: boolean; completed: boolean }[] = [
    { id: 'A', label: 'Módulo A: Análisis inicial', shortName: 'A · Análisis inicial', unlocked: true, completed: fichaConfirmada || (bloque1Ok && bloque2Ok && bloque3Ok) },
    { id: 'B', label: 'Módulo B: Investigación de campo', shortName: 'B · Investigación', unlocked: true, completed: moduloBListo() },
    { id: 'C', label: 'Módulo C: Restricciones', shortName: 'C · Restricciones', unlocked: true, completed: semaforo === 'verde' },
    { id: 'D', label: 'Módulo D: Actores y validación', shortName: 'D · Validación', unlocked: semaforo !== 'rojo', completed: moduloDListo() },
    { id: 'S', label: 'Síntesis + Revisión de rumbo', shortName: 'Síntesis', unlocked: false, completed: false },
  ];

  const openIAPanel = () => {
    setShowIAPanel(true);
    setIaLoading(true);
    setTimeout(() => setIaLoading(false), 1500);
  };

  const sendToIA = () => {
    setSendingIA(true);
    setTimeout(() => {
      if (projectId && project) {
        updateProject(projectId, {
          status: 'Sesión experto pendiente',
          steps: project.steps.map(item =>
            item.number === 1
              ? {
                  ...item,
                  status: 'Sesión experto pendiente',
                  progress: 100,
                  feedbackIA: {
                    status: 'Aprobado',
                    summary: 'La IA confirma que el Step 1 ya tiene base suficiente. Ahora falta la validacion final de mentor para habilitar el siguiente step.',
                    goodPoints: [],
                    missing: [],
                    actions: ['Define la via de validacion con mentor y consigue su aprobacion final del Step 1.'],
                    questions: [],
                    contradictions: [],
                    timestamp: new Date().toISOString(),
                  },
                  mentorSession: item.mentorSession?.result === 'Aprobado' ? item.mentorSession : null,
                }
              : item,
          ),
        });
      }
      setSendingIA(false);
      setHasFeedback(true);
      setShowFeedback(true);
    }, 2000);
  };

  const canSend = modules.slice(0, 4).every(m => m.completed) || true; // for demo
  const moduloACompletado = fichaConfirmada || (bloque1Ok && bloque2Ok && bloque3Ok);
  const moduloBCompletado = moduloBListo();
  const captureSynthesisMissing = getStep1CaptureMissing(captureSynthesisData);
  const moduloCCompletado = captureSynthesisMissing.length === 0;
  const captureModuleContext = buildCaptureModuleContext(
    lecturaConsolidada,
    bData.researchV2.objective.draft,
    bData.researchV2.fronts
      .filter(front => front.title.trim())
      .map(front => ({
        id: front.id,
        title: front.title,
        learningGoal: front.learningGoal,
        sourceLabels: front.sources
          .filter(source => front.selectedSourceIds.includes(source.id))
          .map(source => source.label),
        guideCount: front.guides.length,
      })),
  );
  const step1Modules = buildStep1ModuleViewModels({
    moduleDefinitions: STEP1_MODULES,
    analysisCompleted: moduloACompletado,
    researchCompleted: moduloBCompletado,
    captureCompleted: moduloCCompletado,
    researchNeedsAdjustment: moduleAdjustments.research,
    captureNeedsAdjustment: moduleAdjustments.capture,
  });
  const step1Progress = calculateStep1Progress(step1Modules);
  const canSendStep1 = step1Modules.every(module => module.completed);
  const step1FeedbackReady = Boolean(step?.feedbackIA?.status === 'Aprobado');
  const step1MentorApproved = Boolean(step?.mentorSession?.result === 'Aprobado');
  const step1MentorMode = step?.mentorSession?.mode;
  const mentorValidationPending = step1FeedbackReady && !step1MentorApproved;
  const step1ClosureState = !canSendStep1
    ? 'en_trabajo'
    : !step1FeedbackReady
    ? 'listo_revision_ia'
    : !step1MentorApproved
    ? 'listo_validacion_mentor'
    : 'aprobado_mentor';
  const reviewCtaLabel = !canSendStep1
    ? 'Completa los campos requeridos para avanzar'
    : !step1FeedbackReady
    ? 'Step 1 listo - Enviar a validacion IA'
    : step1MentorApproved
    ? 'Step 1 aprobado por mentor'
    : 'Gestionar validacion final de mentor';
  const reviewCtaHint = !canSendStep1
    ? ''
    : !step1FeedbackReady
    ? 'La IA revisa el cierre minimo del Step 1 antes de pasar a la validacion final.'
    : step1MentorApproved
    ? 'El Step 1 ya cuenta con validacion IA y aprobacion final de mentor.'
    : step1MentorMode === 'meeting'
    ? 'La validacion IA ya esta lista. Ahora falta la reunion y aprobacion final del mentor.'
    : step1MentorMode === 'async_review'
    ? 'La validacion IA ya esta lista. Ahora falta la aprobacion directa del mentor.'
    : 'La validacion IA ya esta lista. Elige la via de validacion final con mentor.';

  const openStep1Closure = () => {
    if (!canSendStep1) return;
    setShowSendModal(true);
  };

  const updateStep1MentorValidation = (
    updates: NonNullable<typeof step>['mentorSession'],
    stepStatus: 'Sesión experto pendiente' | 'Aprobado' | 'Ajustado' = 'Sesión experto pendiente',
  ) => {
    if (!projectId || !project) return;

    updateProject(projectId, {
      currentStep: project.currentStep,
      status: 'Sesión experto pendiente',
      steps: project.steps.map(item => {
        if (item.number === 1) {
          return {
            ...item,
            status: stepStatus === 'Aprobado' ? 'Sesión experto pendiente' : stepStatus,
            mentorSession: updates,
          };
        }

        return item;
      }),
    });
  };

  function mirrorStep1AdaptiveSuccess() {
    if (!projectId || !project) return;
    updateProject(projectId, {
      currentStep: Math.max(project.currentStep, 2),
      status: 'Paso aprobado',
      steps: project.steps.map(item => {
        if (item.number === 1) return { ...item, status: 'Aprobado' as const, progress: 100 };
        if (item.number === 2) return { ...item, status: item.status === 'Bloqueado' ? 'En progreso' as const : item.status };
        return item;
      }),
    });
  }

  const startMentorValidation = (mode: 'meeting' | 'async_review') => {
    const baseSession = {
      id: step?.mentorSession?.id || `step1-mentor-${Date.now()}`,
      mentor: step?.mentorSession?.mentor || 'Mentor asignado',
      mode,
      status: mode === 'meeting' ? 'Pendiente agendar' as const : 'Pendiente revisión' as const,
      comments: mode === 'meeting'
        ? 'Pendiente la reunion final de mentor para cerrar el Step 1.'
        : 'Pendiente la evaluacion y aprobacion directa del mentor.',
    };

    updateStep1MentorValidation(baseSession, 'Sesión experto pendiente');
    setShowSendModal(false);
    if (mode === 'meeting') {
      setShowSessionModal(true);
    }
  };

  const confirmAdaptiveStep1 = async () => {
    if (!projectId) return;
    setAdaptiveStep1Saving(true);
    setAdaptiveStep1Error(null);
    try {
      const baseKey = `step1-adaptive-${projectId}`;
      const mainHypothesis = bData.researchV2.objective.draft || sintesisData.resumen || lecturaConsolidada;
      await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `${baseKey}-cp11`,
        checkpointKey: 'CP-1.1',
        responses: {
          mainHypothesis,
          criticalAssumption: asisData.causaInmediata || 'Supuesto critico pendiente de profundizar.',
          learningQuestion: bData.researchV2.fronts[0]?.learningGoal || 'Que evidencia confirma el foco priorizado?',
          riskOfBeingWrong: asisData.consecuencia || 'Avanzar con un foco poco sustentado.',
          dependentDecision: sintesisData.pivotCheck || 'Definir apuesta de Step 2.',
        },
      });
      await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `${baseKey}-cp12`,
        checkpointKey: 'CP-1.2',
        responses: {
          methods: bData.researchV2.fronts.map(front => front.sourceMode).filter(Boolean),
          sourcesAndActors: bData.researchV2.fronts.flatMap(front => front.sources.filter(source => front.selectedSourceIds.includes(source.id)).map(source => source.label)),
          responsibleAndDates: cData.dependenciaDueno || actoresProceso || 'Owner de iniciativa',
          expectedEvidenceAndSufficiency: bData.researchV2.fronts.map(front => front.learningGoal).filter(Boolean).join('\n') || 'Evidencia suficiente para decidir foco.',
        },
      });
      const evidenceItems = [
        ...evidenciasA.map(item => ({
          id: item.id,
          type: item.tipo || 'observacion',
          summary: item.desc || item.fuente,
          classification: 'weak_signal',
          sourceRefs: [item.fuente || item.id],
        })),
        ...captureSynthesisData.evidences.map((item: any, index: number) => ({
          id: String(item.id ?? `capture-${index + 1}`),
          type: String(item.type ?? item.tipo ?? 'document'),
          summary: String(item.summary ?? item.name ?? item.nombre ?? item.finding ?? 'Evidencia capturada'),
          classification: String(item.classification ?? 'supports'),
          sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [String(item.sourceRef ?? item.id ?? `capture-${index + 1}`)],
        })),
      ].filter(item => item.summary.trim().length > 0);
      await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `${baseKey}-cp13`,
        checkpointKey: 'CP-1.3',
        responses: {
          evidenceItems: evidenceItems.length > 0 ? evidenceItems : [{ id: 'step1-ui-summary', summary: lecturaConsolidada, classification: 'context', sourceRefs: ['step1-ui'] }],
          evidenceClassifications: evidenceItems.map(item => item.classification),
          sourceRefs: evidenceItems.flatMap(item => item.sourceRefs),
        },
      });
      const core = await confirmAdaptiveCheckpoint(projectId, {
        idempotencyKey: `${baseKey}-cp14`,
        checkpointKey: 'CP-1.4',
        responses: {
          synthesis: captureSynthesisData.finalSummary || sintesisData.resumen || lecturaConsolidada,
          updatedFocusAndHypothesis: dData.nuevaVersionReto || mainHypothesis,
          continuityDecision: sintesisData.pivotCheck || 'avanzar_con_observaciones',
        },
      });
      const draft = (core.stepOutputs ?? []).find((output: any) => output.step === 1 && output.status === 'draft') as { id?: string; output?: Record<string, unknown> } | undefined;
      if (draft?.output) {
        await confirmStep1Output(projectId, {
          idempotencyKey: `${baseKey}-confirm-${draft.id ?? 'draft'}`,
          brief: draft.output,
          confirmed: true,
        });
      }
      const refreshedCore = await getAdaptiveCore(projectId);
      if (canNavigateToAdaptiveStep(refreshedCore, 2)) {
        mirrorStep1AdaptiveSuccess();
      } else {
        setAdaptiveStep1Error('El backend confirmó el Step 1, pero Step 2 todavía no aparece activo en el estado adaptativo persistido.');
      }
    } catch (err: any) {
      setAdaptiveStep1Error(err?.response?.data?.error?.message ?? err?.message ?? 'No pudimos confirmar el Step 1 adaptativo.');
    } finally {
      setAdaptiveStep1Saving(false);
    }
  };

  const registerMentorOutcome = (result: 'Aprobado' | 'Iterar') => {
    if (!step?.mentorSession) return;

    updateStep1MentorValidation(
      {
        ...step.mentorSession,
        status: 'Realizada',
        result,
        comments: result === 'Aprobado'
          ? 'El mentor valida que el problema, la evidencia y la decision del Step 1 permiten avanzar.'
          : 'El mentor pide ajustar el cierre del Step 1 antes de avanzar.',
      },
      result === 'Aprobado' ? 'Aprobado' : 'Ajustado',
    );
    if (result === 'Aprobado') {
      void confirmAdaptiveStep1();
    }
    setShowSendModal(false);
    setShowSessionModal(false);
  };

  const getModuloAMissing = () => {
    const m: string[] = [];
    if (!asisData.casoReal.trim()) m.push('Descripción del reto (Bloque 1)');
    if (asisData.pasos.filter(p => p.trim()).length < 2) m.push('Al menos 2 pasos del proceso (Bloque 1)');
    if (asisData.quiebreIndex === null) m.push('Paso quiebre seleccionado (Bloque 2)');
    if (!asisData.consecuencia.trim()) m.push('Consecuencia del reto (Bloque 3)');
    if (!asisData.causaInmediata.trim()) m.push('Causa inmediata (Bloque 3)');
    if (!fichaConfirmada) m.push('Analiza con IA y confirma la ficha consolidada');
    return m;
  };

  // ── Módulo B — CRUD helpers ────────────────────────────────────────────────

  const addTema = () => {
    const newId = Date.now().toString();
    setBData(p => ({
      ...p,
      temas: [...p.temas, { id: newId, titulo: '', preguntaClave: '', via: '', perfilesIds: [], fuente: '', preguntas: [''] }],
    }));
    setExpandedTemaId(newId);
  };

  const updateTema = (id: string, changes: Partial<TemaInvestigacion>) => {
    setBData(p => ({ ...p, temas: p.temas.map(t => t.id === id ? { ...t, ...changes } : t) }));
  };

  const removeTema = (id: string) => {
    setBData(p => ({ ...p, temas: p.temas.filter(t => t.id !== id) }));
  };

  const addPreguntaTema = (temaId: string) => {
    setBData(p => ({
      ...p,
      temas: p.temas.map(t => t.id === temaId && t.preguntas.length < 3 ? { ...t, preguntas: [...t.preguntas, ''] } : t),
    }));
  };

  const updatePreguntaTema = (temaId: string, idx: number, val: string) => {
    setBData(p => ({
      ...p,
      temas: p.temas.map(t => t.id === temaId ? { ...t, preguntas: t.preguntas.map((q, i) => i === idx ? val : q) } : t),
    }));
  };

  const removePreguntaTema = (temaId: string, idx: number) => {
    setBData(p => ({
      ...p,
      temas: p.temas.map(t => t.id === temaId ? { ...t, preguntas: t.preguntas.filter((_, i) => i !== idx) } : t),
    }));
  };

  const togglePerfilEnTema = (temaId: string, perfilId: string) => {
    setBData(p => ({
      ...p,
      temas: p.temas.map(t => {
        if (t.id !== temaId) return t;
        const hasIt = t.perfilesIds.includes(perfilId);
        return { ...t, perfilesIds: hasIt ? t.perfilesIds.filter(id => id !== perfilId) : [...t.perfilesIds, perfilId] };
      }),
    }));
  };

  const addPerfil = () => {
    const newId = Date.now().toString();
    setBData(p => ({
      ...p,
      perfiles: [...p.perfiles, { id: newId, nombre: '', porQue: '', temas: [] }],
    }));
    setExpandedPerfilId(newId);
  };

  const updatePerfil = (id: string, changes: Partial<PerfilEntrevista>) => {
    setBData(p => ({ ...p, perfiles: p.perfiles.map(pf => pf.id === id ? { ...pf, ...changes } : pf) }));
  };

  const removePerfil = (id: string) => {
    setBData(p => ({
      ...p,
      perfiles: p.perfiles.filter(pf => pf.id !== id),
      temas: p.temas.map(t => ({ ...t, perfilesIds: t.perfilesIds.filter(pid => pid !== id) })),
    }));
  };

  const sugerirObjetivoIA = () => {
    setIaLoadingB(true);
    setTimeout(() => {
      if (bData.version === 'v2') {
        updateResearchV2(prev => ({
          ...prev,
          objective: {
            ...buildResearchObjective(researchModuleAContext),
            draft: prev.objective.draft,
            suggestedDraft: buildResearchObjective(researchModuleAContext).suggestedDraft,
            status: 'revisar',
          },
        }));
        setIaLoadingB(false);
        return;
      }

      const pasoQuiebre = asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex]
        ? asisData.pasos[asisData.quiebreIndex]
        : 'el paso quiebre';
      setBData(p => ({
        ...p,
        objetivoGeneral: `Confirmar si el fallo en "${pasoQuiebre}" es una causa sistémica y cuantificable del problema, qué tan extendido está entre los afectados, y qué hace que los parches actuales no lo resuelvan de fondo.`,
      }));
      setIaLoadingB(false);
    }, 1400);
  };

  const sugerirTemasIA = () => {
    setIaLoadingB(true);
    setTimeout(() => {
      if (bData.version === 'v2') {
        updateResearchV2(prev => ({
          ...prev,
          fronts: buildResearchFrontSuggestions(researchModuleAContext),
        }));
        setIaLoadingB(false);
        return;
      }

      const pasoQ = asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex]
        ? asisData.pasos[asisData.quiebreIndex].toLowerCase()
        : 'el paso quiebre';
      const actor = actoresProceso ? actoresProceso.split(',')[0].trim() : 'los involucrados';
      setBData(p => ({
        ...p,
        temas: [
          { id: 't-ia-1', titulo: 'Magnitud real del problema', preguntaClave: `¿Qué tan frecuente ocurre el fallo en "${pasoQ}" y cuántos casos lo presentan?`, via: 'ambas', perfilesIds: p.perfiles.slice(0, 1).map(pf => pf.id), fuente: 'Registros internos, sistema de tickets, reportes históricos', preguntas: ['¿Con qué frecuencia ocurre?', '¿Afecta a todos los perfiles o solo a algunos?'] },
          { id: 't-ia-2', titulo: 'Tiempo y costo operativo por caso', preguntaClave: '¿Cuánto tiempo y dinero genera cada ocurrencia del problema?', via: 'data', perfilesIds: [], fuente: 'Datos de nómina, registros de tiempo, sistema de tickets', preguntas: [] },
          { id: 't-ia-3', titulo: 'Variación por perfil de afectado', preguntaClave: '¿El impacto es homogéneo o hay segmentos que lo viven de forma más crítica?', via: 'entrevistas', perfilesIds: p.perfiles.map(pf => pf.id), fuente: '', preguntas: ['¿Cómo afecta el problema en tu área?', '¿Qué intentaste para compensarlo?'] },
          { id: 't-ia-4', titulo: 'Parches actuales y sus límites', preguntaClave: `¿Qué hace hoy ${actor} para compensar el problema y por qué no lo resuelve?`, via: 'entrevistas', perfilesIds: p.perfiles.slice(0, 1).map(pf => pf.id), fuente: '', preguntas: ['¿Qué solución temporal usan hoy?', '¿Por qué esa solución no resuelve el problema de fondo?'] },
        ],
      }));
      setIaLoadingB(false);
    }, 1800);
  };

  const sugerirPerfilesIA = () => {
    setIaLoadingB(true);
    setTimeout(() => {
      const actoresArr = actoresProceso
        ? actoresProceso.split(',').map(a => a.trim()).slice(0, 3)
        : ['Responsable del proceso', 'Persona afectada', 'Decisor'];
      const perfilesSugeridos: PerfilEntrevista[] = actoresArr.map((actor, i) => ({
        id: `p-ia-${i + 1}`,
        nombre: actor,
        porQue: i === 0 ? 'Ejecuta el proceso y tiene visibilidad directa del quiebre' : i === 1 ? 'Sufre las consecuencias; puede cuantificar el impacto real' : 'Toma decisiones sobre priorización y recursos',
      }));
      setBData(p => ({ ...p, perfiles: perfilesSugeridos }));
      setIaLoadingB(false);
    }, 1600);
  };

  const generarGuiaIA = () => {
    setIaLoadingB(true);
    setTimeout(() => {
      setBData(p => ({ ...p, guiaGenerada: true }));
      setGuiaVisible(true);
      setIaLoadingB(false);
    }, 2000);
  };

  // ── Copiar Ficha consolidada ───────────────────────────────────────────────

  const handleCopiarFicha = () => {
    const pasoQuiebre = asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex]
      ? `Paso ${asisData.quiebreIndex + 1}: ${asisData.pasos[asisData.quiebreIndex]}`
      : '—';
    const evidencia = evidenciasA.filter(e => e.desc.trim()).map(e => `[${e.tipo || 'sin tipo'}] ${e.desc}`).join(' · ') || 'Sin evidencia registrada';
    const text = [
      `RESUMEN INICIAL DEL PROBLEMA — Step 1 · Módulo A`,
      ``,
      `SÍNTESIS: ${lecturaConsolidada}`,
      `QUIEBRE: ${pasoQuiebre}`,
      `ACTORES: ${actoresProceso || '—'}`,
      `CONSECUENCIA: ${asisData.consecuencia || '—'}`,
      `CAUSA INMEDIATA: ${asisData.causaInmediata || '—'}`,
      `EVIDENCIA: ${evidencia}`,
      `DIAGNÓSTICO IA: Claridad Alta · Importancia Media-alta · Sustento ${nivelSustento === 'solido' ? 'Sólido' : nivelSustento === 'debil' ? 'Inicial' : 'Débil'} · Coherente con Step 0`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setFichaCopyMsg(true);
    setTimeout(() => setFichaCopyMsg(false), 2000);
  };

  return (
    <div className="flex h-full">
      {/* Left module nav */}
      <div className="hidden md:flex w-52 flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <h2 className="text-sm text-slate-900 mt-2" style={{ fontWeight: 600 }}>Paso 1</h2>
          <p className="text-xs text-slate-500">Claridad en el desafío</p>
          <div className="mt-2"><ProgressBar value={step1Progress} size="sm" /></div>
        </div>

        {step1Modules.map(mod => (
          <button
            key={mod.id}
            onClick={() => mod.unlocked && setActiveModule(mod.id)}
            disabled={!mod.unlocked}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors text-left ${
              activeModule === mod.id ? 'bg-indigo-50 text-indigo-700' :
              mod.unlocked ? 'text-slate-600 hover:bg-slate-50' :
              'text-slate-300 cursor-not-allowed'
            }`}
            style={{ fontWeight: activeModule === mod.id ? 600 : 400 }}
          >
            {mod.status === 'requires_adjustment' ? (
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            ) : mod.completed ? (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            ) : !mod.unlocked ? (
              <Lock size={13} className="text-slate-300 shrink-0" />
            ) : (
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${activeModule === mod.id ? 'border-indigo-400' : 'border-slate-200'}`} />
            )}
            {mod.shortName}
          </button>
        ))}

        <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
          <AutosaveIndicator state={saveState} />
          <button
            onClick={openIAPanel}
            className="w-full flex items-center gap-1.5 text-xs text-violet-600 px-2 py-1.5 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Sparkles size={12} /> Mejorar con IA
          </button>
          {hasFeedback && (
            <button onClick={() => setShowFeedback(!showFeedback)} className="w-full flex items-center gap-1.5 text-xs text-violet-600 px-2 py-1.5 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors" style={{ fontWeight: 500 }}>
              <Sparkles size={12} /> Ver análisis IA
            </button>
          )}
          {/* Mentor con opciones */}
          <div className="relative">
            <button
              onClick={() => setShowMentorOptions(v => !v)}
              className="w-full flex items-center gap-1.5 text-xs text-slate-600 px-2 py-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <MessageSquare size={12} /> Mentor
              <ChevronDown size={10} className="ml-auto" />
            </button>
            {showMentorOptions && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Pedir ayuda (destrabe)
                </button>
                <button
                  onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Agendar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-5">
            <LeaderFeedbackStatusCard project={project} updateProject={updateProject} variant="step1" compact />
          </div>

          {/* Mobile back */}
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al proyecto
          </button>

          {/* ══════════════════════════════════════════════════════════════
              MODULE A: PROCESO ACTUAL
          ══════════════════════════════════════════════════════════════ */}
          {activeModule === 'A' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo A: Análisis inicial del problema</h1>
                    <StatusChip status={fichaConfirmada ? 'Completado' : bloque1Ok && bloque2Ok && bloque3Ok ? 'En progreso' : 'Pendiente'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500">Aquí vas a aterrizar mejor el reto que quieres abordar. Partiendo de lo que ya capturaste en el Step 0, vas a describir el proceso, ubicar el momento donde aparece la fricción y dejar clara su consecuencia o evidencia.</p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-4">
                <div className="max-w-2xl">
                  <p className="text-xs text-indigo-600 mb-2" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>ENTRADA AL MÓDULO</p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Este módulo profundiza lo que ya trajiste en el Step 0. La idea no es mapear un proceso perfecto, sino construir una primera versión clara y útil para entender mejor el problema antes de seguir.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { title: 'Dónde ocurre el reto', desc: 'Ubica el proceso y el tramo donde aparece la fricción.' },
                    { title: 'Cuándo se hace visible', desc: 'Señala el momento exacto en que algo se traba, se demora o se pierde.' },
                    { title: 'Qué evidencia deja', desc: 'Aclara la consecuencia y las señales que hoy sostienen el reto.' },
                  ].map((item, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm text-slate-800 mb-1" style={{ fontWeight: 600 }}>{item.title}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-800" style={{ fontWeight: 600 }}>No necesitas mapear el proceso perfecto.</p>
                  <p className="text-xs text-amber-700 mt-1">Queremos una primera versión clara y útil para entender mejor el problema antes de seguir.</p>
                </div>
              </div>

              {/* ── Progress 3 bloques ── */}
              <div className="flex items-center gap-1">
                {[
                  { label: '1 · Recorrido del proceso', ok: bloque1Ok },
                  { label: '2 · Momento del reto', ok: bloque2Ok },
                  { label: '3 · Consecuencia / Evidencia', ok: bloque3Ok },
                ].map((b, i) => (
                  <div key={i} className="flex-1 flex items-center gap-1.5">
                    {i > 0 && <div className="w-3 h-px bg-slate-200 shrink-0" />}
                    <div className={`flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg ${b.ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0 ${b.ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        {b.ok ? '✓' : String(i + 1)}
                      </span>
                      <span className={`text-xs truncate ${b.ok ? 'text-emerald-700' : 'text-slate-500'}`} style={{ fontWeight: b.ok ? 600 : 400 }}>{b.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Banner: Tu punto de partida (Step 0) — colapsable ── */}
              <div className={`rounded-xl border overflow-hidden ${step0?.quePasaQueQuieres ? 'border-indigo-200' : 'border-slate-200'}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setStep0Collapsed(v => !v)}
                  onKeyDown={e => e.key === 'Enter' && setStep0Collapsed(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer select-none ${step0?.quePasaQueQuieres ? 'bg-indigo-50' : 'bg-slate-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <Target size={13} className={step0?.quePasaQueQuieres ? 'text-indigo-500' : 'text-slate-400'} />
                    <div>
                      <p className={`text-xs ${step0?.quePasaQueQuieres ? 'text-indigo-700' : 'text-slate-600'}`} style={{ fontWeight: 700 }}>Esto es lo que ya trajiste del Step 0</p>
                      <p className="text-xs text-slate-500">Ahora vamos a profundizarlo en este módulo.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); navigate(`/projects/${projectId}/step/0`); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); navigate(`/projects/${projectId}/step/0`); } }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      <ExternalLink size={10} /> Ver Paso 0
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${step0Collapsed ? '' : 'rotate-180'}`} />
                  </div>
                </div>
                {!step0Collapsed && (
                  <div className="px-4 py-3 bg-white border-t border-indigo-100">
                    {step0?.quePasaQueQuieres ? (
                      <>
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 mb-3">
                          <p className="text-xs text-indigo-700" style={{ fontWeight: 600 }}>Punto de partida</p>
                          <p className="text-xs text-indigo-900 mt-1 italic">"{step0.quePasaQueQuieres}"</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                          {[
                            { label: 'Área afectada', value: step0.impacta?.join(', ') || '—' },
                            { label: 'Impacto (3 m)', value: step0.impacto3meses ? ({ ingresos: 'Pérdida de ingresos', costos: 'Costos y reprocesos', riesgo: 'Riesgo', cliente: 'Exp. del cliente', productividad: 'Productividad y clima', no_claro: 'Por definir', otro: 'Otro' } as Record<string,string>)[step0.impacto3meses] || '—' : '—' },
                            { label: 'Etapa del proceso', value: step0.parteProceso ? ({ antes: 'Antes', durante: 'Durante', despues: 'Después', transversal: 'Transversal', otra: 'Otra' } as Record<string,string>)[step0.parteProceso] || '—' : '—' },
                            { label: 'Respaldo', value: step0.respaldo ? ({ datos: 'Datos internos', testimonios: 'Testimonios', benchmark: 'Ref. externa', hipotesis: 'Hipótesis', otro: 'Otro' } as Record<string,string>)[step0.respaldo] || '—' : '—' },
                          ].map((row, i) => (
                            <div key={i}>
                              <p className="text-xs text-indigo-400" style={{ fontWeight: 600, letterSpacing: '0.03em' }}>{row.label.toUpperCase()}</p>
                              <p className="text-xs text-indigo-800 mt-0.5">{row.value}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-1">Step 0 aún no completado. <span className="text-amber-600" style={{ fontWeight: 600 }}>Completa el Paso 0 primero para anclar el reto.</span></p>
                    )}
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════
                  BLOQUE 1 · Recorrido del proceso
              ════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>1</span>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Cuéntanos el proceso donde aparece este reto</h2>
                  {bloque1Ok && <CheckCircle2 size={14} className="text-emerald-500 ml-auto shrink-0" />}
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-700">Describe el proceso real con tus palabras y ordénalo en pasos. No buscamos un flujograma perfecto, sino entender cómo ocurre hoy.</p>
                    <p className="text-xs text-slate-500">Empieza por el momento en que el proceso se activa y sigue la secuencia normal hasta donde aparece la fricción.</p>
                  </div>

                  {/* Descripción del proceso */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>
                      Cuéntalo con tus palabras <span className="text-red-500">*</span>
                    </label>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 italic mb-2">
                      <span style={{ fontWeight: 600 }} className="not-italic text-slate-600">Ej:</span> "En TechCorp, el proceso de incorporación dura 15–21 días. Durante ese tiempo el empleado no tiene accesos y no puede trabajar."
                    </div>
                    <div id="field-step1-asisData-casoReal">
                      <AutofillField
                        fieldPath="step1.asisData.casoReal"
                        initiativeId={projectId}
                        value={asisData.casoReal}
                        onChange={(v) => setAsisData(p => ({ ...p, casoReal: String(v ?? '') }))}
                        label="Caso real del proceso"
                      >
                        {({ value, onChange, readOnly }) => (
                          <textarea
                            value={String(value ?? '')}
                            onChange={e => onChange(e.target.value)}
                            readOnly={readOnly}
                            rows={3}
                            placeholder="Describe el proceso real: qué ocurre, quiénes participan, cuánto dura y cuál es el problema hoy."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                          />
                        )}
                      </AutofillField>
                    </div>
                  </div>

                  {/* Pasos del proceso */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-2" style={{ fontWeight: 500 }}>
                      Pasos del proceso (en orden) <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mb-2">Ordénalos como ocurren hoy. Eso nos ayudará a ubicar el punto exacto donde el reto se hace visible.</p>
                    <div className="space-y-2">
                      {asisData.pasos.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 600 }}>{i + 1}</span>
                          <input
                            value={p}
                            onChange={e => { const np = [...asisData.pasos]; np[i] = e.target.value; setAsisData(prev => ({ ...prev, pasos: np })); }}
                            placeholder={i === 0 ? 'Ej. Firma de contrato y documentos legales' : i === 1 ? 'Ej. Alta en sistemas de TI (accesos, correo)' : `Paso ${i + 1}…`}
                            className={`flex-1 border rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${asisData.quiebreIndex === i ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                          />
                          {asisData.pasos.length > 2 && (
                            <button
                              onClick={() => {
                                const np = asisData.pasos.filter((_, j) => j !== i);
                                const newIdx = asisData.quiebreIndex === i ? null : asisData.quiebreIndex !== null && asisData.quiebreIndex > i ? asisData.quiebreIndex - 1 : asisData.quiebreIndex;
                                setAsisData(prev => ({ ...prev, pasos: np, quiebreIndex: newIdx }));
                              }}
                              className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                            ><X size={14} /></button>
                          )}
                        </div>
                      ))}
                      {asisData.pasos.length < 8 && (
                        <button
                          onClick={() => setAsisData(p => ({ ...p, pasos: [...p.pasos, ''] }))}
                          className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 px-3 py-2 border border-dashed border-indigo-200 rounded-xl hover:border-indigo-400 transition-colors"
                          style={{ fontWeight: 500 }}
                        ><Plus size={12} /> Agregar paso</button>
                      )}
                    </div>
                  </div>

                  {/* Actores del proceso */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Quiénes participan en este proceso?</label>
                    <p className="text-xs text-slate-500 mb-1.5">Nombra a quienes intervienen en el flujo, aunque no todos sufran el problema de la misma manera.</p>
                    <input
                      value={actoresProceso}
                      onChange={e => setActoresProceso(e.target.value)}
                      placeholder="Ej. RRHH, TI, Área receptora, Empleado nuevo"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  {bloque1Ok && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>
                        {asisData.pasos.filter(p => p.trim()).length} pasos · {asisData.casoReal.slice(0, 50)}{asisData.casoReal.length > 50 ? '…' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════
                  BLOQUE 2 · ¿En qué momento ocurre el reto?
              ════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>2</span>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>¿En qué momento se hace visible el reto?</h2>
                  {bloque2Ok && <CheckCircle2 size={14} className="text-emerald-500 ml-auto shrink-0" />}
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-700">Ahora que ya describiste el recorrido, ubica el punto donde el problema se nota con más claridad.</p>
                    <p className="text-xs text-slate-500">Piensa en el momento exacto donde algo se traba, se demora, se pierde, se corrige o genera fricción.</p>
                  </div>

                  {/* Selector de quiebre */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-2" style={{ fontWeight: 500 }}>
                      ¿En qué paso se produce la falla principal? (el "quiebre") <span className="text-red-500">*</span>
                    </label>
                    {asisData.pasos.filter(p => p.trim()).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Completa al menos 2 pasos en el Bloque 1 primero.</p>
                    ) : (
                      <div id="field-step1-asisData-quiebre">
                        <AutofillField
                          fieldPath="step1.asisData.quiebre"
                          initiativeId={projectId}
                          value={asisData.quiebre}
                          onChange={(v) => setAsisData(p => ({ ...p, quiebre: String(v ?? '') }))}
                          label="Paso del quiebre"
                        >
                          {({ value, onChange, readOnly }) => {
                            // The proposed value is a string like "Paso N — <texto>".
                            // We highlight whichever button matches `value` (whether
                            // it came from the proposal or from a manual click).
                            const activeQuiebre = String(value ?? '');
                            return (
                              <div className="space-y-2">
                                {asisData.pasos.map((p, i) => p.trim() ? (() => {
                                  const buttonLabel = `Paso ${i + 1} — ${p}`;
                                  const selected = activeQuiebre === buttonLabel || asisData.quiebreIndex === i;
                                  return (
                                    <button key={i}
                                      type="button"
                                      disabled={readOnly}
                                      onClick={() => {
                                        setAsisData(prev => ({ ...prev, quiebreIndex: i }));
                                        onChange(buttonLabel);
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all ${selected ? 'border-red-400 bg-red-50 text-red-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'} ${readOnly ? 'opacity-90 cursor-default' : ''}`}
                                      style={{ fontWeight: selected ? 600 : 400 }}
                                    >
                                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${selected ? 'border-red-500 bg-red-500 text-white' : 'border-slate-300'}`} style={{ fontWeight: 700 }}>
                                        {selected ? '✗' : i + 1}
                                      </span>
                                      <span>{p}</span>
                                      {selected && <span className="ml-auto text-xs text-red-500 px-2 py-0.5 bg-red-100 rounded-full shrink-0">Aquí ocurre el reto</span>}
                                    </button>
                                  );
                                })() : null)}
                                {/* If the proposal text doesn't match any button label (the
                                    pasos array changed since extraction), show the proposed
                                    text inline so the founder can still read it before confirming. */}
                                {activeQuiebre && !asisData.pasos.some((p, i) => `Paso ${i + 1} — ${p}` === activeQuiebre) && (
                                  <p className="text-xs text-slate-500 italic px-2">
                                    Sugerencia IA: "{activeQuiebre}"
                                  </p>
                                )}
                              </div>
                            );
                          }}
                        </AutofillField>
                      </div>
                    )}
                  </div>

                  {/* Detalle del quiebre */}
                  {asisData.quiebreIndex !== null && (
                    <div>
                      <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>
                        ¿Qué pasa exactamente en ese momento? <span className="text-slate-400">(recomendado)</span>
                      </label>
                      <p className="text-xs text-slate-500 mb-2">Describe la fricción puntual. No hace falta explicar todo el proceso otra vez.</p>
                      <div id="field-step1-asisData-quiebreDetalle">
                        <AutofillField
                          fieldPath="step1.asisData.quiebreDetalle"
                          initiativeId={projectId}
                          value={asisData.quiebreDetalle}
                          onChange={(v) => setAsisData(p => ({ ...p, quiebreDetalle: String(v ?? '') }))}
                          label="Detalle del quiebre"
                        >
                          {({ value, onChange, readOnly }) => (
                            <textarea
                              value={String(value ?? '')}
                              onChange={e => onChange(e.target.value)}
                              readOnly={readOnly}
                              rows={2}
                              placeholder="Ej. El empleado espera 7–10 días porque TI no tiene priorización formal para estas solicitudes."
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                            />
                          )}
                        </AutofillField>
                      </div>
                    </div>
                  )}

                  {/* Grid 2×2: cuándo / frecuencia / quién / duración */}
                  <div>
                    <label className="block text-xs text-slate-600 mb-2" style={{ fontWeight: 500 }}>Acota el momento y alcance del reto</label>
                    <p className="text-xs text-slate-500 mb-3">Esto ayuda a entender si el problema pasa siempre, a quién afecta más y cuánto dura cuando aparece.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-slate-200 rounded-xl p-3 bg-white">
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 600 }}>🕐 ¿CUÁNDO ocurre?</p>
                        <select
                          value={momentoData.cuando}
                          onChange={e => setMomentoData(p => ({ ...p, cuando: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-slate-50"
                        >
                          <option value="">Seleccionar…</option>
                          <option value="siempre">Siempre que ocurre el proceso</option>
                          <option value="condicion">Solo bajo ciertas condiciones</option>
                          <option value="pico">En picos de demanda</option>
                          <option value="otro">Otro</option>
                        </select>
                        {momentoData.cuando === 'condicion' || momentoData.cuando === 'otro' ? (
                          <input className="w-full mt-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            placeholder="Especifica…" value={momentoData.cuando === 'otro' ? '' : ''}
                            onChange={e => setMomentoData(p => ({ ...p, cuando: e.target.value }))} />
                        ) : null}
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 bg-white">
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 600 }}>📊 FRECUENCIA estimada</p>
                        <select
                          value={momentoData.frecuencia}
                          onChange={e => setMomentoData(p => ({ ...p, frecuencia: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-slate-50"
                        >
                          <option value="">Seleccionar…</option>
                          <option value="diario">Diario</option>
                          <option value="semanal">Semanal</option>
                          <option value="mensual">Mensual</option>
                          <option value="evento">Por evento</option>
                        </select>
                        <input className="w-full mt-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="Ej. ~25 veces/mes"
                          value={momentoData.quienSufre}
                          onChange={e => setMomentoData(p => ({ ...p, quienSufre: e.target.value }))} />
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 bg-white">
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 600 }}>👥 ¿QUIÉN lo sufre más?</p>
                        <input
                          value={momentoData.quienSufre}
                          onChange={e => setMomentoData(p => ({ ...p, quienSufre: e.target.value }))}
                          placeholder={step0?.impacta?.join(', ') || 'Ej. Empleados nuevos'}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                        />
                        <p className="text-xs text-slate-400 mt-1">Puedes usar el mismo del Step 0 o ajustarlo.</p>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 bg-white">
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 600 }}>⏱ DURACIÓN del impacto</p>
                        <select
                          value={momentoData.duracion}
                          onChange={e => setMomentoData(p => ({ ...p, duracion: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-slate-50"
                        >
                          <option value="">Seleccionar…</option>
                          <option value="horas">Horas</option>
                          <option value="dias">Días</option>
                          <option value="semanas">Semanas</option>
                          <option value="meses">Meses</option>
                        </select>
                        <input className="w-full mt-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="Ej. 7–21 días promedio"
                          value={asisData.quiebreDetalle.slice(0, 30)}
                          readOnly />
                      </div>
                    </div>
                    {/* Resumen auto-generado */}
                    {(momentoData.cuando || momentoData.frecuencia) && (
                      <div className="mt-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <p className="text-xs text-indigo-700">
                          <span style={{ fontWeight: 600 }}>Resumen:</span> El reto ocurre{momentoData.cuando === 'siempre' ? ' siempre que' : momentoData.cuando ? ` bajo ciertas condiciones en` : ''} {asisData.quiebre ? `"${asisData.quiebre}"` : 'el paso seleccionado'}{momentoData.frecuencia ? ` · frecuencia ${momentoData.frecuencia}` : ''}{momentoData.quienSufre ? ` · afecta a ${momentoData.quienSufre}` : ''}.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════
                  BLOQUE 3 · Consecuencia / Causa / Evidencia
              ════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>3</span>
                  <h2 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>¿Qué consecuencia deja y qué evidencia tienes hoy?</h2>
                  {bloque3Ok && <CheckCircle2 size={14} className="text-emerald-500 ml-auto shrink-0" />}
                </div>
                <div className="p-4 space-y-5">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-700">Queremos entender qué pasa cuando este reto ocurre y qué señales te hacen pensar que vale la pena abordarlo.</p>
                    <p className="text-xs text-slate-500">Puede ser una consecuencia operativa, comercial, de experiencia, de riesgo o una evidencia como reclamos, tiempos, reprocesos, tickets o testimonios.</p>
                  </div>

                  {/* 3a. Consecuencia */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-1" style={{ fontWeight: 500 }}>
                      ¿Qué consecuencia tiene este reto? <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      Marca los impactos que hoy genera este reto. Puedes seleccionar más de uno si aplica.
                    </p>
                    <div id="field-step1-asisData-consequenceTags">
                      <AutofillField
                        fieldPath="step1.asisData.consequenceTags"
                        initiativeId={projectId}
                        value={selectedConsequenceTags}
                        onChange={(v) => setAsisData(prev => ({
                          ...prev,
                          consequenceTags: normalizeStep1ConsequenceTags(
                            Array.isArray(v) ? (v as string[]) : [],
                          ),
                        }))}
                        label="Categorías de consecuencia"
                      >
                        {({ value, onChange, readOnly }) => {
                          const activeTags: string[] = Array.isArray(value) ? (value as string[]) : [];
                          return (
                            <div className="flex gap-2 mb-3 flex-wrap" role="group" aria-label="Categorías de consecuencia">
                              {STEP1_CONSEQUENCE_OPTIONS.map(option => {
                                const selected = activeTags.includes(option.id);
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const nextTags = selected
                                        ? activeTags.filter(tag => tag !== option.id)
                                        : [...activeTags, option.id];
                                      onChange(nextTags);
                                    }}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'} ${readOnly ? 'opacity-90 cursor-default' : ''}`}
                                    style={{ fontWeight: 500 }}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        }}
                      </AutofillField>
                    </div>
                    <div id="field-step1-asisData-consecuencia">
                      <AutofillField
                        fieldPath="step1.asisData.consecuencia"
                        initiativeId={projectId}
                        value={asisData.consecuencia}
                        onChange={(v) => setAsisData(p => ({ ...p, consecuencia: String(v ?? '') }))}
                        label="Consecuencia del reto"
                      >
                        {({ value, onChange, readOnly }) => (
                          <textarea
                            value={String(value ?? '')}
                            onChange={e => onChange(e.target.value)}
                            readOnly={readOnly}
                            rows={2}
                            placeholder="Ej. El empleado no puede trabajar durante 7 a 10 dias, generando costos de productividad y frustracion."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                          />
                        )}
                      </AutofillField>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Describe el impacto concreto que deja el problema. No listes causas todavía.</p>
                  </div>

                  {/* 3b. Causa inmediata */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-1" style={{ fontWeight: 500 }}>
                      ¿Cuál es la causa inmediata? <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      <span style={{ fontWeight: 600 }}>Causa inmediata</span> = la razón directa por la que ocurre el quiebre. No la causa raíz, sino lo que lo dispara hoy.
                    </p>
                    <div id="field-step1-asisData-causaInmediata">
                      <AutofillField
                        fieldPath="step1.asisData.causaInmediata"
                        initiativeId={projectId}
                        value={asisData.causaInmediata}
                        onChange={(v) => setAsisData(p => ({ ...p, causaInmediata: String(v ?? '') }))}
                        label="Causa inmediata"
                      >
                        {({ value, onChange, readOnly }) => (
                          <textarea
                            value={String(value ?? '')}
                            onChange={e => onChange(e.target.value)}
                            readOnly={readOnly}
                            rows={2}
                            placeholder="Ej. TI recibe solicitudes por correo informal, sin priorización ni tiempo objetivo definido para onboarding."
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                          />
                        )}
                      </AutofillField>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">No llegues aún a la causa raíz. ¿Qué está fallando operativamente hoy?</p>
                  </div>

                  {/* 3c. Evidencias (multi-item) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                      <div>
                        <label className="block text-sm text-slate-700" style={{ fontWeight: 500 }}>Evidencia que sustenta este reto</label>
                        <p className="text-xs text-slate-500 mt-0.5">Aquí puedes dejar datos, señales o evidencia breve, y también subir archivos o links que respalden el problema.</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        nivelSustento === 'solido' ? 'bg-emerald-100 text-emerald-700' :
                        nivelSustento === 'debil' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`} style={{ fontWeight: 600 }}>
                        {nivelSustento === 'solido' ? 'Evidencia solida' : nivelSustento === 'debil' ? 'Evidencia inicial' : 'Sin evidencia'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>1. Escribe datos, numeros o evidencia cualitativa breve</p>
                        <p className="text-xs text-slate-400 mb-3">Registra aqui lo que ya sabes del problema, aunque todavia sea parcial.</p>
                        {nivelSustento === 'sin' && (
                          <p className="text-xs text-slate-400 italic mb-3">Sin evidencia ingresada todavia. La IA lo considerara en el nivel de sustento.</p>
                        )}
                        <div className="space-y-2">
                          {evidenciasA.map((ev) => (
                            <div key={ev.id} className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <select
                                  value={ev.tipo}
                                  onChange={e => updateEvidenciaA(ev.id, { tipo: e.target.value as EvidenciaA['tipo'] })}
                                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-slate-50"
                                >
                                  <option value="">Tipo de evidencia...</option>
                                  <option value="dato">Dato o numero</option>
                                  <option value="ticket">Ticket o incidente</option>
                                  <option value="testimonio">Testimonio breve</option>
                                  <option value="benchmark">Referencia externa</option>
                                  <option value="observacion">Observacion directa</option>
                                </select>
                                {evidenciasA.length > 1 && (
                                  <button onClick={() => removeEvidenciaA(ev.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0"><X size={14} /></button>
                                )}
                              </div>
                              <input
                                value={ev.desc}
                                onChange={e => updateEvidenciaA(ev.id, { desc: e.target.value })}
                                placeholder={
                                  ev.tipo === 'dato' ? 'Ej. 18 dias promedio segun registros de RRHH 2024' :
                                  ev.tipo === 'ticket' ? 'Ej. 47 tickets de sin accesos en el ultimo trimestre' :
                                  ev.tipo === 'testimonio' ? 'Ej. Una coordinadora reporta dos semanas sin accesos' :
                                  ev.tipo === 'benchmark' ? 'Ej. En Empresa X el proceso dura 2 dias con portal self-service' :
                                  'Describe que demuestra esta evidencia en una o dos lineas'
                                }
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              />
                              <input
                                value={ev.fuente}
                                onChange={e => updateEvidenciaA(ev.id, { fuente: e.target.value })}
                                placeholder="Fuente opcional: informe, sistema, persona o documento"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 transition-all bg-slate-50"
                              />
                            </div>
                          ))}
                        </div>
                        <button onClick={addEvidenciaA}
                          className="mt-3 flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 px-3 py-2 border border-dashed border-indigo-200 rounded-xl hover:border-indigo-400 transition-colors w-full justify-center"
                          style={{ fontWeight: 500 }}>
                          <Plus size={12} /> Agregar evidencia escrita
                        </button>
                      </div>
                      <div className="border-t border-slate-200 pt-4">
                        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>2. Tambien puedes subir archivos o pegar links</p>
                        <p className="text-xs text-slate-400 mb-3">Usa este espacio si ya tienes capturas, reportes, documentos o links que ayuden a sustentar el problema.</p>
                        <EvidenceUploader />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-2 border-violet-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-500" />
                    <p className="text-sm text-violet-800" style={{ fontWeight: 600 }}>Análisis inicial del problema con IA</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${iaModAState === 'done' ? 'bg-emerald-100 text-emerald-700' : iaModAState === 'loading' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-600'}`} style={{ fontWeight: 600 }}>
                      {iaModAState === 'done' ? 'Analizado' : iaModAState === 'loading' ? 'Analizando…' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-xs text-violet-400 italic w-full">La IA combina tu Step 0 + los 3 bloques de este módulo para evaluar el problema.</p>
                </div>

                <div className="p-4">
                  {iaModAState === 'idle' && (
                    <div className="text-center py-4">
                      {!listoParaIA && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
                          <p className="text-xs text-amber-700 mb-1" style={{ fontWeight: 600 }}>Para analizar, completa:</p>
                          {!bloque1Ok && <p className="text-xs text-amber-600">· Bloque 1: descripción del reto + al menos 2 pasos</p>}
                          {!bloque2Ok && <p className="text-xs text-amber-600">· Bloque 2: selecciona el paso quiebre</p>}
                          {!bloque3Ok && <p className="text-xs text-amber-600">· Bloque 3: consecuencia y causa inmediata</p>}
                        </div>
                      )}
                      <Sparkles size={24} className="text-violet-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 mb-1">Completa los 3 bloques y analiza el problema con IA.</p>
                      <p className="text-xs text-slate-400 mb-4">Recibirás 8 dimensiones: claridad, importancia, impacto, sustento, coherencia con Step 0, qué falta y si necesitas acotar.</p>
                      <button
                        disabled={!listoParaIA}
                        onClick={() => {
                          setIaModAState('loading');
                          setTimeout(() => {
                            setAiAnalysisState({
                              generatedText: lecturaConsolidada,
                              draftText: lecturaConsolidada,
                              isEditing: false,
                            });
                            setIaModAState('done');
                          }, 1800);
                        }}
                        className={`flex items-center gap-2 mx-auto text-sm px-6 py-2.5 rounded-xl transition-colors ${listoParaIA ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        style={{ fontWeight: 500 }}>
                        <Sparkles size={14} /> Analizar problema con IA
                      </button>
                    </div>
                  )}

                  {iaModAState === 'loading' && (
                    <div className="flex flex-col items-center py-8 gap-3">
                      <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                      <p className="text-sm text-slate-500">Analizando Step 0 + Módulo A…</p>
                      <p className="text-xs text-slate-400">Evaluando claridad, importancia estratégica, sustento y coherencia.</p>
                    </div>
                  )}

                  {iaModAState === 'done' && (
                    <div className="space-y-5">

                      {/* ── A. Resumen de claridad del problema ── */}
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-indigo-400 uppercase tracking-wide" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>Resumen de claridad del problema</span>
                          <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full" style={{ fontWeight: 600 }}>Módulo A · completado</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex flex-wrap gap-2">
                              {selectedConsequenceLabels.map(label => (
                                <span key={label} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>{label}</span>
                              ))}
                            </div>
                            <button
                              onClick={() => setAiAnalysisState(prev => ({ ...prev, isEditing: !prev.isEditing }))}
                              className="text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              {aiAnalysisState.isEditing ? 'Cerrar edicion' : 'Editar analisis'}
                            </button>
                          </div>
                          {!aiAnalysisState.isEditing ? (
                            <p className="text-sm text-indigo-900 leading-relaxed">{aiAnalysisState.draftText || lecturaConsolidada}</p>
                          ) : (
                            <div className="space-y-2">
                              <textarea
                                value={aiAnalysisState.draftText}
                                onChange={event => setAiAnalysisState(prev => ({ ...prev, draftText: event.target.value }))}
                                rows={5}
                                className="w-full border border-indigo-200 rounded-xl px-4 py-3 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              />
                              <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-indigo-700">
                                <p>{aiAnalysisState.generatedText && aiAnalysisState.generatedText !== aiAnalysisState.draftText ? 'Analisis ajustado manualmente sobre la base generada por IA.' : 'Puedes ajustar redaccion, agregar informacion o quitar lo que no aplique.'}</p>
                                <button
                                  onClick={() => setAiAnalysisState(prev => ({ ...prev, draftText: prev.generatedText || lecturaConsolidada, isEditing: false }))}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 bg-indigo-100 rounded-lg transition-colors"
                                  style={{ fontWeight: 500 }}
                                >
                                  Restaurar version IA
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── B. TEMAS PRIORITARIOS — sección hero ── */}
                      <div className="rounded-xl border-2 border-indigo-300 overflow-hidden">
                        <div className="bg-indigo-600 px-4 py-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <TrendingUp size={15} className="text-indigo-200" />
                            <p className="text-white text-sm" style={{ fontWeight: 700 }}>Temas prioritarios para investigar</p>
                          </div>
                          <p className="text-indigo-200 text-xs">Antes de avanzar al Módulo B, conviene clarificar estos puntos. Serán la base de lo que definas a continuación.</p>
                        </div>
                        <div className="bg-white divide-y divide-indigo-50">
                          {temasPrioritarios.map((tema) => (
                            <div key={tema.n} className="flex items-start gap-4 px-4 py-3.5">
                              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{tema.n}</span>
                              <div className="flex-1">
                                <p className="text-sm text-slate-800 mb-0.5" style={{ fontWeight: 600 }}>{tema.titulo}</p>
                                <p className="text-xs text-slate-500 leading-relaxed">{tema.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-indigo-50 border-t border-indigo-100 px-4 py-2.5 flex items-center gap-2">
                          <ChevronRight size={13} className="text-indigo-400" />
                          <p className="text-xs text-indigo-600" style={{ fontWeight: 500 }}>
                            En el <span style={{ fontWeight: 700 }}>Módulo B</span> definirás qué información capturar para responder estas preguntas.
                          </p>
                        </div>
                      </div>

                      {/* ── C. Diagnóstico secundario — 5 dimensiones ── */}
                      <div>
                        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide" style={{ fontWeight: 600, letterSpacing: '0.05em' }}>Diagnóstico del problema</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              label: 'Claridad',
                              chip: 'Alta',
                              chipBg: 'bg-emerald-100',
                              chipText: 'text-emerald-700',
                              desc: 'El quiebre operativo está bien acotado y la consecuencia es medible.',
                            },
                            {
                              label: 'Importancia estratégica',
                              chip: 'Media-alta',
                              chipBg: 'bg-amber-100',
                              chipText: 'text-amber-700',
                              desc: 'Impacta recurrentemente a todos los ingresos nuevos y escala con el crecimiento.',
                            },
                            {
                              label: 'Impacto estimado',
                              chip: 'Alto',
                              chipBg: 'bg-red-100',
                              chipText: 'text-red-700',
                              desc: 'Pérdida de productividad por días sin herramientas y carga adicional en los actores.',
                            },
                            {
                              label: 'Nivel de sustento',
                              chip: nivelSustento === 'solido' ? 'Sólido' : nivelSustento === 'debil' ? 'Inicial' : 'Débil',
                              chipBg: nivelSustento === 'solido' ? 'bg-emerald-100' : 'bg-amber-100',
                              chipText: nivelSustento === 'solido' ? 'text-emerald-700' : 'text-amber-700',
                              desc: nivelSustento === 'solido'
                                ? 'Tienes datos y testimonios que sustentan el problema.'
                                : 'Tienes señales claras. El Módulo B te ayudará a cuantificarlo mejor.',
                            },
                            {
                              label: 'Coherencia con Step 0',
                              chip: 'Coherente',
                              chipBg: 'bg-emerald-100',
                              chipText: 'text-emerald-700',
                              desc: 'El quiebre del Módulo A es una versión más acotada y operativa del reto planteado en el Step 0.',
                            },
                          ].map((d, i) => (
                            <div key={i} className={`border border-slate-200 rounded-xl p-3 bg-white ${i === 4 ? 'col-span-2' : ''}`}>
                              <p className="text-xs text-slate-400 mb-1.5" style={{ fontWeight: 600, letterSpacing: '0.03em' }}>{d.label.toUpperCase()}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${d.chipBg} ${d.chipText} mb-1.5 inline-block`} style={{ fontWeight: 700 }}>{d.chip}</span>
                              <p className="text-xs text-slate-500">{d.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── D. CTAs ── */}
                      {!fichaConfirmada ? (
                        <div className="pt-1 space-y-2">
                          <button
                            onClick={() => setFichaConfirmada(true)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                            style={{ fontWeight: 600 }}>
                            <CheckCircle2 size={15} /> Guardar este análisis y avanzar al Módulo B
                          </button>
                          <button
                            onClick={() => setIaModAState('idle')}
                            className="w-full border border-slate-200 text-slate-500 bg-white hover:bg-slate-50 rounded-xl py-2.5 text-sm transition-colors"
                            style={{ fontWeight: 500 }}>
                            Revisar mis respuestas antes de guardar
                          </button>
                          <p className="text-center text-xs text-slate-400">Este análisis es un punto de partida. Puedes ajustar tus respuestas si algo no encaja.</p>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                          <p className="text-xs text-emerald-700" style={{ fontWeight: 600 }}>Análisis guardado. El mentor lo revisará antes de que avances al Step 2.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════
                  FICHA CONSOLIDADA
              ═══════���════════════════════════════ */}
              {fichaConfirmada && (
                <div className="border-2 border-indigo-200 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 bg-indigo-600 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText size={14} className="text-indigo-200 shrink-0" />
                      <p className="text-sm text-white" style={{ fontWeight: 700 }}>Resumen inicial del problema</p>
                      <span className="text-xs px-2 py-0.5 bg-white/20 text-white rounded-full" style={{ fontWeight: 600 }}>Step 1 · Módulo A</span>
                    </div>
                    <button onClick={handleCopiarFicha} className="flex items-center gap-1.5 text-xs text-indigo-200 hover:text-white px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <Copy size={11} /> {fichaCopyMsg ? '¡Copiado!' : 'Copiar resumen'}
                    </button>
                  </div>

                  {/* Lectura consolidada — protagonista */}
                  <div className="px-4 py-4 bg-indigo-50 border-b border-indigo-100">
                    <p className="text-xs text-indigo-400 mb-1.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>SÍNTESIS DEL RETO</p>
                    <p className="text-sm text-indigo-900 leading-relaxed">{lecturaConsolidada}</p>
                  </div>

                  {/* Datos del módulo */}
                  <div className="divide-y divide-slate-100 bg-white">
                    {[
                      {
                        label: 'Quiebre identificado',
                        value: asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex]
                          ? `Paso ${asisData.quiebreIndex + 1}: ${asisData.pasos[asisData.quiebreIndex]}`
                          : '—',
                      },
                      { label: 'Actores del proceso', value: actoresProceso || '—' },
                      { label: 'Consecuencia principal', value: asisData.consecuencia || '—' },
                      { label: 'Causa inmediata', value: asisData.causaInmediata || '—' },
                      {
                        label: 'Evidencia disponible',
                        value: evidenciasA.filter(e => e.desc.trim()).length > 0
                          ? evidenciasA.filter(e => e.desc.trim()).map(e => `[${e.tipo || 'sin tipo'}] ${e.desc}`).join(' · ')
                          : 'Sin evidencia registrada aún',
                      },
                    ].map((row, i) => (
                      <div key={i} className="px-4 py-3 flex gap-4 items-start">
                        <p className="text-xs text-slate-400 shrink-0 w-36 pt-0.5" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>{row.label.toUpperCase()}</p>
                        <p className="text-xs text-slate-700 flex-1 leading-relaxed">{row.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Diagnóstico IA — fila compacta */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-slate-500" style={{ fontWeight: 600 }}>Diagnóstico IA:</span>
                    {[
                      { label: 'Claridad Alta', color: 'bg-emerald-100 text-emerald-700' },
                      { label: 'Importancia Media-alta', color: 'bg-amber-100 text-amber-700' },
                      { label: `Sustento ${nivelSustento === 'solido' ? 'Sólido' : nivelSustento === 'debil' ? 'Inicial' : 'Débil'}`, color: nivelSustento === 'solido' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700' },
                      { label: 'Coherente con Step 0', color: 'bg-indigo-100 text-indigo-700' },
                    ].map((chip, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${chip.color}`} style={{ fontWeight: 600 }}>{chip.label}</span>
                    ))}
                  </div>

                  {/* Temas prioritarios — compacto */}
                  <div className="px-4 py-3 border-t border-indigo-100 bg-indigo-50">
                    <p className="text-xs text-indigo-600 mb-2" style={{ fontWeight: 700 }}>Temas a investigar en el Módulo B</p>
                    <ul className="space-y-1">
                      {temasPrioritarios.map(t => (
                        <li key={t.n} className="flex items-start gap-2 text-xs text-indigo-800">
                          <span className="text-indigo-400 shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{t.n}.</span>
                          <span style={{ fontWeight: 500 }}>{t.titulo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-amber-700 px-2 py-0.5 bg-amber-100 rounded-full" style={{ fontWeight: 600 }}>⏳ Pendiente revisión del mentor</span>
                    <span className="text-xs text-slate-400">Tu mentor lo revisará antes de que avances al Step 2.</span>
                    <button onClick={() => setActiveModule('B')}
                      className="ml-auto flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
                      style={{ fontWeight: 600 }}>
                      Ir al Módulo B <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Gating check + Botón principal */}
              {(() => {
                const missing = getModuloAMissing();
                const listo = missing.length === 0;
                return (
                  <div className="space-y-3">
                    {!listo && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-500" />
                          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Completa estos campos para avanzar a Medición:</p>
                        </div>
                        <ul className="space-y-1">
                          {missing.map((m, i) => <li key={i} className="text-xs text-amber-700">· {m}</li>)}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => listo && setActiveModule('B')}
                      disabled={!listo}
                      className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${listo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {listo ? <>Módulo A listo → Ir a Medición <ChevronRight size={15} /></> : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODULE B: INVESTIGACIÓN DE CAMPO — nueva arquitectura
          ══════════════════════════════════════════════════════════════ */}
          {activeModule === 'B' && bData.version === 'v2' && (
            <Step1ResearchModuleV2
              context={researchModuleAContext}
              fichaConfirmada={fichaConfirmada}
              state={bData.researchV2}
              iaLoading={iaLoadingB}
              statusLabel={moduleAdjustments.research ? 'Requiere ajuste' : moduloBListo() ? 'Completado' : 'En progreso'}
              missing={getModuloBMissing()}
              onChange={updateResearchV2}
              onOpenIA={openIAPanel}
              onOpenMentor={() => setShowMentorModal(true)}
              onGoToModuleA={() => setActiveModule('A')}
              onNext={() => moduloBListo() && setActiveModule('C')}
            />
          )}

          {activeModule === 'B' && bData.version === 'legacy' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo B: Investigación de campo</h1>
                    <StatusChip status={moduloBListo() ? 'Completado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-xl">
                    Define <em>qué</em> necesitas entender, <em>desde qué ángulos</em> lo abordarás y <em>cómo</em> obtendrás la información para validar que el reto vale la pena resolver.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={openIAPanel} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Mejorar con IA
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Contexto IA ── */}
              <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 flex items-start gap-3">
                <Sparkles size={14} className="text-violet-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-violet-800 mb-1" style={{ fontWeight: 600 }}>Punto de partida: análisis del Módulo A</p>
                  <p className="text-xs text-violet-600 leading-relaxed">{lecturaConsolidada}</p>
                  {!fichaConfirmada && (
                    <button onClick={() => setActiveModule('A')} className="mt-2 flex items-center gap-1 text-xs text-violet-600 px-2.5 py-1 bg-violet-100 hover:bg-violet-200 rounded-lg border border-violet-200 transition-colors" style={{ fontWeight: 500 }}>
                      Completar Módulo A primero <ChevronRight size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════
                  SECCIÓN 1 — OBJETIVO GENERAL DE LA INVESTIGACIÓN
              ═══════════════════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>1</span>
                    <div>
                      <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>La gran pregunta que guía la investigación <span className="text-red-500">*</span></p>
                      <p className="text-xs text-slate-400">Una sola pregunta central — todos los frentes responderán a esta.</p>
                    </div>
                  </div>
                  <button
                    onClick={sugerirObjetivoIA}
                    disabled={iaLoadingB}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-colors disabled:opacity-50"
                    style={{ fontWeight: 500 }}
                  >
                    {iaLoadingB ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full" /> Generando…</> : <><Sparkles size={11} /> IA sugiere</>}
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    No es lo que vas a <em>hacer</em> — es lo que necesitas <span style={{ fontWeight: 600 }}>entender</span> al final de esta fase. Redáctalo como pregunta: ¿X es causa de Y? ¿X ocurre en Z contexto?
                  </p>
                  <textarea
                    value={bData.objetivoGeneral}
                    onChange={e => setBData(p => ({ ...p, objetivoGeneral: e.target.value }))}
                    rows={3}
                    placeholder="Ej. ¿El retraso en la asignación de accesos TI es una causa sistémica de la baja productividad en el onboarding, y afecta a la mayoría de los empleados nuevos?"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                  {bData.objetivoGeneral.trim() && (
                    <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <Target size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-indigo-700">
                        <span style={{ fontWeight: 600 }}>Este es el norte de tu investigación.</span>{' '}
                        Cada frente que definas abajo debe contribuir, directa o indirectamente, a responderla.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════
                  SECCIÓN 2 — FRENTES DE INVESTIGACIÓN
              ═══════════════════════════════════════════════════════ */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0 mt-0.5" style={{ fontWeight: 700 }}>2</span>
                    <div>
                      <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                        Frentes de investigación <span className="text-slate-400 text-xs ml-1">(mín. 3, máx. 5)</span> <span className="text-red-500">*</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Cada frente es un ángulo específico que debes explorar. Para cada uno, define de dónde vendrá la información.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={sugerirTemasIA}
                    disabled={iaLoadingB}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-colors disabled:opacity-50"
                    style={{ fontWeight: 500 }}
                  >
                    {iaLoadingB ? '⟳ Generando…' : <><Sparkles size={11} /> IA precarga frentes</>}
                  </button>
                </div>

                {/* Lista de frentes / empty state */}
                {bData.temas.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <FileText size={20} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 mb-3" style={{ fontWeight: 500 }}>Aún no definiste frentes de investigación.</p>
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={addTema} className="flex items-center gap-1.5 text-xs text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors" style={{ fontWeight: 500 }}>
                        <Plus size={11} /> Agregar primer frente
                      </button>
                      <button onClick={sugerirTemasIA} disabled={iaLoadingB} className="flex items-center gap-1.5 text-xs text-violet-600 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-colors disabled:opacity-50" style={{ fontWeight: 500 }}>
                        <Sparkles size={11} /> IA los genera
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bData.temas.map((tema, tIdx) => {
                      const isExpanded = expandedTemaId === tema.id;
                      const hayEntrevistas = tema.via === 'entrevistas' || tema.via === 'ambas';
                      const hayData = tema.via === 'data' || tema.via === 'ambas';
                      return (
                        <div key={tema.id} className={`border rounded-2xl bg-white overflow-hidden transition-all ${isExpanded ? 'border-indigo-200 shadow-sm' : 'border-slate-200'}`}>
                          {/* Card header — siempre visible, clickeable para expandir */}
                          <div
                            className={`px-4 py-3 flex items-center gap-3 cursor-pointer select-none ${isExpanded ? 'bg-indigo-50 border-b border-indigo-100' : 'hover:bg-slate-50'}`}
                            onClick={() => setExpandedTemaId(isExpanded ? null : tema.id)}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${isExpanded ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-600'}`} style={{ fontWeight: 700 }}>{tIdx + 1}</span>
                            <input
                              value={tema.titulo}
                              onChange={e => { e.stopPropagation(); updateTema(tema.id, { titulo: e.target.value }); }}
                              onClick={e => e.stopPropagation()}
                              placeholder="Nombre del frente · Ej. Magnitud real del problema"
                              className={`flex-1 text-sm bg-transparent border-0 focus:outline-none placeholder-slate-300 ${isExpanded ? 'text-indigo-900' : 'text-slate-800'}`}
                              style={{ fontWeight: tema.titulo ? 600 : 400 }}
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                              {tema.via ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${tema.via === 'entrevistas' ? 'bg-violet-100 text-violet-600' : tema.via === 'data' ? 'bg-sky-100 text-sky-600' : 'bg-teal-100 text-teal-600'}`} style={{ fontWeight: 500 }}>
                                  {tema.via === 'entrevistas' ? '🗣 Entrevistas' : tema.via === 'data' ? '📊 Data' : '🔄 Ambas'}
                                </span>
                              ) : tema.titulo.trim() ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600" style={{ fontWeight: 500 }}>Sin modalidad</span>
                              ) : null}
                              <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                              {bData.temas.length > 1 && (
                                <button onClick={e => { e.stopPropagation(); removeTema(tema.id); }} className="text-slate-300 hover:text-red-400 transition-colors ml-1">
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card body — expandible */}
                          {isExpanded && (
                            <div className="p-5 space-y-5">
                              {/* Pregunta clave */}
                              <div>
                                <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>¿Qué necesitas saber específicamente en este frente?</label>
                                <input
                                  value={tema.preguntaClave}
                                  onChange={e => updateTema(tema.id, { preguntaClave: e.target.value })}
                                  placeholder="Ej. ¿Qué tan frecuente ocurre el problema y cuántos empleados lo experimentan?"
                                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                                />
                              </div>

                              {/* Modalidad de captura — 3 opciones */}
                              <div>
                                <label className="text-xs text-slate-600 mb-2 block" style={{ fontWeight: 500 }}>¿Cómo obtendrás la información? <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-3 gap-2">
                                  {([
                                    { v: 'entrevistas', icon: '🗣', label: 'Entrevistas', sub: 'Personas', sel: 'border-violet-400 bg-violet-50' },
                                    { v: 'data', icon: '📊', label: 'Data / Docs', sub: 'Sistemas', sel: 'border-sky-400 bg-sky-50' },
                                    { v: 'ambas', icon: '🔄', label: 'Ambas', sub: 'Combinado', sel: 'border-teal-400 bg-teal-50' },
                                  ] as const).map(opt => (
                                    <button
                                      key={opt.v}
                                      onClick={() => updateTema(tema.id, { via: opt.v })}
                                      className={`flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border-2 transition-all ${tema.via === opt.v ? opt.sel : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                                    >
                                      <span className="text-base">{opt.icon}</span>
                                      <span className={`text-xs ${tema.via === opt.v ? 'text-slate-800' : 'text-slate-600'}`} style={{ fontWeight: tema.via === opt.v ? 600 : 400 }}>{opt.label}</span>
                                      <span className="text-xs text-slate-400">{opt.sub}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* ── Condicional: Entrevistas ── */}
                              {hayEntrevistas && (
                                <div className="border-l-2 border-violet-200 pl-4 space-y-4">
                                  {/* Perfiles vinculados */}
                                  <div>
                                    <label className="text-xs text-slate-600 mb-2 block" style={{ fontWeight: 500 }}>
                                      Perfiles que entrevistarás para este frente
                                      {tema.perfilesIds.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full text-xs">{tema.perfilesIds.length}</span>}
                                    </label>
                                    {bData.perfiles.length === 0 ? (
                                      <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                        <AlertCircle size={12} className="text-amber-500 shrink-0" />
                                        <p className="text-xs text-amber-700">Aún no definiste perfiles. Agrégalos en la <span style={{ fontWeight: 600 }}>Sección 3</span> de abajo, luego vincúlalos aquí.</p>
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {bData.perfiles.map(pf => {
                                          const linked = tema.perfilesIds.includes(pf.id);
                                          return (
                                            <button
                                              key={pf.id}
                                              onClick={() => togglePerfilEnTema(tema.id, pf.id)}
                                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${linked ? 'border-indigo-400 bg-indigo-100 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                                              style={{ fontWeight: linked ? 600 : 400 }}
                                            >
                                              {linked ? <CheckCircle2 size={11} /> : <span className="w-3 h-3 rounded-full border border-slate-300 inline-block shrink-0" />}
                                              {pf.nombre || 'Sin nombre'}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Preguntas del frente */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs text-slate-600" style={{ fontWeight: 500 }}>
                                        Preguntas clave{' '}
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${tema.preguntas.length >= 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{tema.preguntas.length}/3</span>
                                      </label>
                                      {tema.preguntas.length < 3 && (
                                        <button onClick={() => addPreguntaTema(tema.id)} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 transition-colors" style={{ fontWeight: 500 }}>
                                          <Plus size={10} /> Agregar
                                        </button>
                                      )}
                                    </div>
                                    {tema.preguntas.map((q, qIdx) => (
                                      <div key={qIdx} className="flex items-center gap-2">
                                        <span className="text-xs text-slate-300 w-5 shrink-0 text-center" style={{ fontWeight: 600 }}>P{qIdx + 1}</span>
                                        <input
                                          value={q}
                                          onChange={e => updatePreguntaTema(tema.id, qIdx, e.target.value)}
                                          placeholder="Ej. ¿Con qué frecuencia enfrentas este problema?"
                                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                                        />
                                        {tema.preguntas.length > 1 && (
                                          <button onClick={() => removePreguntaTema(tema.id, qIdx)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                                            <X size={12} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    {tema.preguntas.length >= 3 && (
                                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle size={10} /> Máx. 3 preguntas por frente. Mantén el foco.</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* ── Condicional: Data ── */}
                              {hayData && (
                                <div className="border-l-2 border-sky-200 pl-4">
                                  <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>
                                    Fuente concreta de datos <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    value={tema.fuente}
                                    onChange={e => updateTema(tema.id, { fuente: e.target.value })}
                                    placeholder="Ej. Registros de solicitudes TI, reportes de RRHH Q4 2024, sistema de tickets"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                                  />
                                  <p className="text-xs text-slate-400 mt-1.5">Sé específico/a: nombra el sistema, documento o reporte exacto donde buscarás los datos.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Agregar frente */}
                {bData.temas.length > 0 && bData.temas.length < 5 && (
                  <button onClick={addTema} className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 py-2.5 border border-dashed border-slate-200 hover:border-indigo-300 rounded-xl transition-all" style={{ fontWeight: 500 }}>
                    <Plus size={12} /> Agregar frente <span className="text-slate-400">({bData.temas.filter(t => t.titulo.trim()).length}/5 definidos)</span>
                  </button>
                )}

                {/* Progress feedback */}
                {bData.temas.length > 0 && bData.temas.filter(t => t.titulo.trim()).length < 3 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                    <AlertCircle size={12} className="text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">Define al menos 3 frentes para cubrir la investigación desde múltiples ángulos. Llevas {bData.temas.filter(t => t.titulo.trim()).length}.</p>
                  </div>
                )}
                {bData.temas.filter(t => t.titulo.trim()).length >= 3 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    <p className="text-xs text-emerald-700">
                      {bData.temas.filter(t => t.titulo.trim()).length} frentes definidos — buena cobertura para validar desde diferentes ángulos.
                    </p>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════
                  SECCIÓN 3 — PERFILES DE ENTREVISTA (pool global)
              ═══════════════════════════════════════════════════════ */}
              {(() => {
                const hayEntrevistasEnTemas = bData.temas.some(t => t.via === 'entrevistas' || t.via === 'ambas');
                return (
                  <div className={`border rounded-2xl overflow-hidden bg-white transition-opacity ${hayEntrevistasEnTemas ? 'border-slate-200' : 'border-slate-100 opacity-40 pointer-events-none'}`}>
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>3</span>
                        <div>
                          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                            Perfiles de entrevista {hayEntrevistasEnTemas && <span className="text-red-500">*</span>}
                          </p>
                          <p className="text-xs text-slate-400">
                            {hayEntrevistasEnTemas
                              ? 'Define las personas que entrevistarás y vincúlalas a los frentes correspondientes arriba.'
                              : 'Se habilitará cuando al menos un frente use entrevistas como modalidad.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={sugerirPerfilesIA} disabled={iaLoadingB} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-colors disabled:opacity-50" style={{ fontWeight: 500 }}>
                          {iaLoadingB ? '⟳' : <Sparkles size={11} />} IA sugiere
                        </button>
                        <button onClick={addPerfil} disabled={bData.perfiles.length >= 5} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors disabled:opacity-40" style={{ fontWeight: 500 }}>
                          <Plus size={11} /> Perfil
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      {bData.perfiles.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                          <Users size={20} className="text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-400 mb-3" style={{ fontWeight: 500 }}>Aún no definiste perfiles a entrevistar.</p>
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={addPerfil} className="flex items-center gap-1.5 text-xs text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors" style={{ fontWeight: 500 }}>
                              <Plus size={11} /> Agregar perfil
                            </button>
                            <button onClick={sugerirPerfilesIA} disabled={iaLoadingB} className="flex items-center gap-1.5 text-xs text-violet-600 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-colors disabled:opacity-50" style={{ fontWeight: 500 }}>
                              <Sparkles size={11} /> IA los sugiere
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bData.perfiles.map((perfil, pIdx) => {
                            const temasVinculados = bData.temas.filter(t => t.perfilesIds.includes(perfil.id));
                            return (
                              <div key={perfil.id} className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-xl bg-white hover:border-slate-300 transition-colors">
                                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0 mt-0.5" style={{ fontWeight: 700 }}>{pIdx + 1}</span>
                                <div className="flex-1 space-y-2 min-w-0">
                                  <input
                                    value={perfil.nombre}
                                    onChange={e => updatePerfil(perfil.id, { nombre: e.target.value })}
                                    placeholder="Nombre del perfil · Ej. Coordinadora de RRHH"
                                    className="w-full text-sm text-slate-800 bg-transparent border-0 focus:outline-none placeholder-slate-300"
                                    style={{ fontWeight: perfil.nombre ? 600 : 400 }}
                                  />
                                  <input
                                    value={perfil.porQue}
                                    onChange={e => updatePerfil(perfil.id, { porQue: e.target.value })}
                                    placeholder="¿Por qué esta persona puede aportar a la investigación?"
                                    className="w-full text-xs text-slate-500 bg-transparent border-0 focus:outline-none placeholder-slate-300"
                                  />
                                  {temasVinculados.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {temasVinculados.map(t => (
                                        <span key={t.id} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-full border border-indigo-100" style={{ fontWeight: 500 }}>
                                          {t.titulo || 'Frente sin título'}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button onClick={() => removePerfil(perfil.id)} className="text-slate-300 hover:text-red-400 transition-colors mt-1 shrink-0">
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ═══════════════════════════════════════════════════════
                  SECCIÓN 4 — GUÍA DE ENTREVISTA
              ═══════════════════════════════════════════════════════ */}
              {bData.temas.some(t => t.via === 'entrevistas' || t.via === 'ambas') && bData.perfiles.length > 0 && (
                <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>4</span>
                      <div>
                        <p className="text-sm text-indigo-800" style={{ fontWeight: 700 }}>Guía de entrevista</p>
                        <p className="text-xs text-indigo-500">Generada por frente y perfil a partir de lo que definiste arriba</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!bData.guiaGenerada ? (
                        <button
                          onClick={generarGuiaIA}
                          disabled={iaLoadingB || bData.perfiles.some(p => !p.nombre.trim())}
                          className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          style={{ fontWeight: 600 }}
                        >
                          {iaLoadingB ? '⟳ Generando guía…' : <><Sparkles size={11} /> Generar guía con IA</>}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setGuiaVisible(v => !v)} className="flex items-center gap-1 text-xs text-indigo-600 px-2.5 py-1.5 bg-white hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors" style={{ fontWeight: 500 }}>
                            <ChevronDown size={11} className={`transition-transform ${guiaVisible ? 'rotate-180' : ''}`} />
                            {guiaVisible ? 'Ocultar' : 'Ver guía'}
                          </button>
                          <button
                            onClick={() => {
                              const texto = bData.perfiles.map(pf => {
                                const temasDePerfil = bData.temas.filter(t => (t.via === 'entrevistas' || t.via === 'ambas') && t.perfilesIds.includes(pf.id));
                                const bloqueTemas = temasDePerfil.map(t => {
                                  const qs = t.preguntas.filter(q => q.trim()).map((q, i) => `  P${i + 1}. ${q}`).join('\n');
                                  return `  FRENTE: ${t.titulo}\n${qs}`;
                                }).join('\n\n');
                                return `PERFIL: ${pf.nombre}\nPOR QUÉ: ${pf.porQue}\n\n${bloqueTemas}`;
                              }).join('\n\n---\n\n');
                              navigator.clipboard.writeText(`GUÍA DE ENTREVISTA — Step 1 / Módulo B\n\nOBJETIVO GENERAL: ${bData.objetivoGeneral || '—'}\n\n${texto}`);
                            }}
                            className="flex items-center gap-1 text-xs text-indigo-600 px-2.5 py-1.5 bg-white hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Copy size={11} /> Copiar
                          </button>
                          <button onClick={() => setBData(p => ({ ...p, guiaGenerada: false }))} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 transition-colors">
                            Regenerar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vista de la guía */}
                  {bData.guiaGenerada && guiaVisible && (
                    <div className="p-5 space-y-6">
                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 600 }}>OBJETIVO QUE GUÍA TODAS LAS ENTREVISTAS</p>
                        <p className="text-xs text-indigo-800">{bData.objetivoGeneral || 'No definido'}</p>
                      </div>

                      {(() => {
                        const perfilesConTemas = bData.perfiles.filter(p =>
                          bData.temas.some(t => (t.via === 'entrevistas' || t.via === 'ambas') && t.perfilesIds.includes(p.id))
                        );
                        return perfilesConTemas.map((perfil, pIdx) => {
                          const temasDelPerfil = bData.temas.filter(t => (t.via === 'entrevistas' || t.via === 'ambas') && t.perfilesIds.includes(perfil.id));
                          return (
                            <div key={perfil.id}>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{pIdx + 1}</span>
                                <div>
                                  <p className="text-sm text-slate-800" style={{ fontWeight: 700 }}>{perfil.nombre || 'Sin nombre'}</p>
                                  {perfil.porQue && <p className="text-xs text-slate-400">{perfil.porQue}</p>}
                                </div>
                              </div>
                              <div className="pl-8 mb-3 p-3 bg-violet-50 border border-violet-100 rounded-xl">
                                <p className="text-xs text-violet-700 mb-1" style={{ fontWeight: 600 }}>✨ Intro sugerida por IA</p>
                                <p className="text-xs text-violet-600 italic">
                                  "Hola [nombre], estamos analizando {asisData.casoReal ? asisData.casoReal.split(' ').slice(0, 6).join(' ') + '…' : 'el proceso'} y me gustaría entender mejor tu experiencia. Esta conversación es exploratoria — no hay respuestas correctas ni incorrectas."
                                </p>
                              </div>
                              <div className="pl-8 space-y-3">
                                {temasDelPerfil.map((tema, tIdx) => (
                                  <div key={tema.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                      <span className="text-xs text-slate-400" style={{ fontWeight: 600 }}>Frente {tIdx + 1}</span>
                                      <span className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{tema.titulo || 'Sin título'}</span>
                                    </div>
                                    {tema.preguntaClave && (
                                      <div className="px-3 pt-2">
                                        <p className="text-xs text-indigo-500 italic">"{tema.preguntaClave}"</p>
                                      </div>
                                    )}
                                    <div className="p-3 space-y-1.5">
                                      {tema.preguntas.filter(q => q.trim()).map((q, qIdx) => (
                                        <div key={qIdx} className="flex items-start gap-2">
                                          <span className="text-xs text-indigo-400 shrink-0 mt-0.5" style={{ fontWeight: 600 }}>P{qIdx + 1}.</span>
                                          <p className="text-xs text-slate-700">{q}</p>
                                        </div>
                                      ))}
                                      {tema.preguntas.filter(q => q.trim()).length === 0 && (
                                        <p className="text-xs text-slate-300 italic">Sin preguntas definidas para este frente.</p>
                                      )}
                                      <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
                                        <span className="text-xs text-violet-400 shrink-0 mt-0.5" style={{ fontWeight: 600 }}>✨</span>
                                        <p className="text-xs text-violet-500 italic">¿Hay algo sobre {tema.titulo ? tema.titulo.toLowerCase() : 'este tema'} que yo debería saber y no te pregunté?</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {pIdx < perfilesConTemas.length - 1 && <div className="mt-5 border-t border-slate-100" />}
                            </div>
                          );
                        });
                      })()}

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 600 }}>CIERRE SUGERIDO</p>
                        <p className="text-xs text-slate-500 italic">"Muchas gracias por tu tiempo. Lo que me compartiste es muy valioso. ¿Estarías disponible para una conversación de seguimiento si surge alguna duda?"</p>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Esta guía es un punto de partida, no un guión rígido. Adapta el orden y el tono según cómo fluya la conversación. Los hallazgos y evidencias los registras en el <span style={{ fontWeight: 600 }}>Módulo D</span>.</p>
                      </div>
                    </div>
                  )}

                  {!bData.guiaGenerada && (
                    <div className="p-5 text-center">
                      <FileText size={24} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 mb-1" style={{ fontWeight: 500 }}>La guía se generará a partir de los frentes y perfiles que definiste</p>
                      <p className="text-xs text-slate-300">Organizada por perfil — verás qué frentes y preguntas abordar con cada persona.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Resumen del plan */}
              {(bData.objetivoGeneral.trim() || bData.temas.length > 0) && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs text-indigo-700 mb-2.5" style={{ fontWeight: 600 }}>📋 Resumen del plan de investigación — Módulo B</p>
                  <div className="space-y-1.5 text-xs text-indigo-600">
                    {bData.objetivoGeneral.trim() && (
                      <p><span style={{ fontWeight: 600 }}>Objetivo:</span> {bData.objetivoGeneral.slice(0, 90)}{bData.objetivoGeneral.length > 90 ? '…' : ''}</p>
                    )}
                    <p>
                      <span style={{ fontWeight: 600 }}>Frentes:</span>{' '}
                      {bData.temas.filter(t => t.titulo.trim()).length} definido(s) —{' '}
                      {[
                        bData.temas.some(t => t.via === 'entrevistas' || t.via === 'ambas') ? '🗣 entrevistas' : '',
                        bData.temas.some(t => t.via === 'data' || t.via === 'ambas') ? '📊 data' : '',
                      ].filter(Boolean).join(' + ') || 'sin modalidad definida'}
                    </p>
                    {bData.perfiles.length > 0 && (
                      <p><span style={{ fontWeight: 600 }}>Perfiles:</span> {bData.perfiles.map(p => p.nombre || 'Sin nombre').join(', ')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Gating */}
              {(() => {
                const missing = getModuloBMissing();
                const listo = missing.length === 0;
                return (
                  <div className="space-y-3">
                    {!listo && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-500" />
                          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Para avanzar a Restricciones, completa:</p>
                        </div>
                        <ul className="space-y-1">
                          {missing.map((m, i) => (
                            <li key={i} className="text-xs text-amber-700 flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => listo && setActiveModule('C')}
                      disabled={!listo}
                      className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${listo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {listo
                        ? <>Módulo B listo → Ir a Restricciones <ChevronRight size={15} /></>
                        : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
                    </button>
                  </div>
                );
              })()}

              {/* ════════════════════════════════════════
                  5. GUÍA DE ENTREVISTA (condicional)
              ════════════════════════════════════════ */}
              {(bData.modalidad === 'entrevistas' || bData.modalidad === 'ambas') && bData.perfiles.length > 0 && (
                <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-200 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-indigo-700" />
                      </div>
                      <div>
                        <p className="text-sm text-indigo-800" style={{ fontWeight: 700 }}>Guía de entrevista</p>
                        <p className="text-xs text-indigo-500">Generada a partir de los perfiles y temas definidos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!bData.guiaGenerada ? (
                        <button
                          onClick={generarGuiaIA}
                          disabled={iaLoadingB || bData.perfiles.some(p => !p.nombre.trim())}
                          className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ fontWeight: 600 }}
                        >
                          {iaLoadingB ? '⟳ Generando guía…' : <><Sparkles size={11} /> Generar guía con IA</>}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setGuiaVisible(v => !v)}
                            className="flex items-center gap-1 text-xs text-indigo-600 px-2.5 py-1.5 bg-white hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <ChevronDown size={11} className={`transition-transform ${guiaVisible ? 'rotate-180' : ''}`} />
                            {guiaVisible ? 'Ocultar' : 'Ver guía'}
                          </button>
                          <button
                            onClick={() => {
                              const guia = bData.perfiles.map(p => {
                                const temas = (p.temas || []).map(t => {
                                  const qs = t.preguntas.filter(q => q.trim()).map((q, i) => `  ${i + 1}. ${q}`).join('\n');
                                  return `  TEMA: ${t.texto}\n${qs}`;
                                }).join('\n\n');
                                return `PERFIL: ${p.nombre}\nPOR QUÉ: ${p.porQue}\n\n${temas}`;
                              }).join('\n\n---\n\n');
                              navigator.clipboard.writeText(`GUÍA DE ENTREVISTA — Step 1 / Módulo B\n\nOBJETIVO PRIORITARIO: ${bData.objetivos.find(o => o.priorizado)?.texto || '—'}\n\n${guia}`);
                            }}
                            className="flex items-center gap-1 text-xs text-indigo-600 px-2.5 py-1.5 bg-white hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Copy size={11} /> Copiar
                          </button>
                          <button
                            onClick={() => setBData(p => ({ ...p, guiaGenerada: false }))}
                            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 transition-colors"
                            style={{ fontWeight: 400 }}
                          >
                            Regenerar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vista previa de la guía */}
                  {bData.guiaGenerada && guiaVisible && (
                    <div className="p-5 space-y-5">
                      <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                        <p className="text-xs text-indigo-600 mb-1" style={{ fontWeight: 600 }}>OBJETIVO PRIORITARIO DE ESTA ENTREVISTA</p>
                        <p className="text-xs text-indigo-800">{bData.objetivos.find(o => o.priorizado)?.texto || 'No definido'}</p>
                      </div>

                      {bData.perfiles.map((perfil, pIdx) => (
                        <div key={perfil.id}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{pIdx + 1}</span>
                            <p className="text-sm text-slate-800" style={{ fontWeight: 700 }}>Perfil: {perfil.nombre || 'Sin nombre'}</p>
                          </div>
                          {perfil.porQue && (
                            <p className="text-xs text-slate-500 mb-3 pl-7">
                              <span style={{ fontWeight: 600 }}>Por qué entrevistarlo/a:</span> {perfil.porQue}
                            </p>
                          )}

                          {/* Contexto sugerido por IA */}
                          <div className="pl-7 mb-3 p-3 bg-violet-50 border border-violet-100 rounded-xl">
                            <p className="text-xs text-violet-700 mb-1" style={{ fontWeight: 600 }}>✨ Intro sugerida por IA</p>
                            <p className="text-xs text-violet-600 italic">
                              "Hola {perfil.nombre ? `[nombre]` : '[nombre]'}, estamos analizando el proceso de {asisData.casoReal ? asisData.casoReal.split(' ').slice(0, 5).join(' ') + '…' : 'la operación'} y quiero entender mejor tu experiencia. Esta conversación es de exploración — no hay respuestas correctas o incorrectas."
                            </p>
                          </div>

                          <div className="pl-7 space-y-3">
                            {(perfil.temas || []).map((tema, tIdx) => (
                              <div key={tema.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                                  <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Tema {tIdx + 1}: {tema.texto || 'Sin título'}</p>
                                </div>
                                <div className="p-3 space-y-1.5">
                                  {tema.preguntas.filter(q => q.trim()).map((q, qIdx) => (
                                    <div key={qIdx} className="flex items-start gap-2">
                                      <span className="text-xs text-indigo-400 shrink-0 mt-0.5" style={{ fontWeight: 600 }}>P{qIdx + 1}.</span>
                                      <p className="text-xs text-slate-700">{q}</p>
                                    </div>
                                  ))}
                                  {tema.preguntas.filter(q => q.trim()).length === 0 && (
                                    <p className="text-xs text-slate-300 italic">Sin preguntas definidas para este tema.</p>
                                  )}
                                  {/* Pregunta de cierre IA */}
                                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
                                    <span className="text-xs text-violet-400 shrink-0 mt-0.5" style={{ fontWeight: 600 }}>✨</span>
                                    <p className="text-xs text-violet-500 italic">¿Hay algo sobre {tema.texto ? tema.texto.toLowerCase() : 'este tema'} que yo debería saber y no te pregunté?</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {(!perfil.temas || perfil.temas.length === 0) && (
                              <p className="text-xs text-slate-300 italic">Este perfil no tiene temas definidos.</p>
                            )}
                          </div>

                          {pIdx < bData.perfiles.length - 1 && <div className="mt-4 border-t border-slate-100" />}
                        </div>
                      ))}

                      {/* Cierre de la entrevista */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 600 }}>CIERRE SUGERIDO</p>
                        <p className="text-xs text-slate-500 italic">"Muchas gracias por tu tiempo. Lo que me compartiste es muy valioso para el análisis. ¿Estarías dispuesto/a a una conversación de seguimiento si surge alguna duda puntual?"</p>
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Esta guía es un punto de partida, no un guión rígido. Adapta el orden y el tono según cómo fluya la conversación. Los resultados y evidencias los registras en el <span style={{ fontWeight: 600 }}>Módulo D</span>.</p>
                      </div>
                    </div>
                  )}

                  {/* Estado: no generada */}
                  {!bData.guiaGenerada && (
                    <div className="p-5 text-center">
                      <FileText size={24} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 mb-1" style={{ fontWeight: 500 }}>La guía se generará a partir de tus perfiles y temas</p>
                      <p className="text-xs text-slate-300">Completa al menos 1 perfil con nombre y 1 tema para habilitarla.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════
                  OUTPUT FINAL — RESUMEN MÓDULO B
              ════════════════════════════════════════ */}
              {bData.modalidad && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs text-indigo-700 mb-2.5" style={{ fontWeight: 600 }}>📋 Resumen del plan de investigación — Módulo B</p>
                  <div className="space-y-1.5 text-xs text-indigo-600">
                    <p>
                      <span style={{ fontWeight: 600 }}>Objetivo prioritario:</span>{' '}
                      {bData.objetivos.find(o => o.priorizado && o.texto.trim())?.texto || <span className="text-indigo-300 italic">Sin priorizar</span>}
                    </p>
                    <p>
                      <span style={{ fontWeight: 600 }}>Modalidad:</span>{' '}
                      {bData.modalidad === 'desk' ? '📊 Desk research (cuantitativo)' : bData.modalidad === 'entrevistas' ? '🗣 Entrevistas (cualitativo)' : '🔄 Ambas modalidades'}
                    </p>
                    {(bData.modalidad === 'desk' || bData.modalidad === 'ambas') && bData.deskTemas.trim() && (
                      <p>
                        <span style={{ fontWeight: 600 }}>Temas desk:</span>{' '}{bData.deskTemas.slice(0, 80)}{bData.deskTemas.length > 80 ? '…' : ''}
                      </p>
                    )}
                    {(bData.modalidad === 'entrevistas' || bData.modalidad === 'ambas') && (
                      <p>
                        <span style={{ fontWeight: 600 }}>Perfiles definidos:</span>{' '}
                        {bData.perfiles.length > 0 ? bData.perfiles.map(p => p.nombre || 'Sin nombre').join(', ') : <span className="text-indigo-300 italic">Ninguno</span>}
                      </p>
                    )}
                    <p>
                      <span style={{ fontWeight: 600 }}>Objetivos totales:</span>{' '}
                      {bData.objetivos.filter(o => o.texto.trim()).length} definido(s) · {bData.objetivos.some(o => o.priorizado && o.texto.trim()) ? '1 priorizado ✅' : <span className="text-amber-600">Ninguno priorizado ⚠️</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* Gating + botón */}
              {(() => {
                const missing = getModuloBMissing();
                const listo = missing.length === 0;
                return (
                  <div className="space-y-3">
                    {!listo && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-500" />
                          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Para avanzar a Restricciones, completa:</p>
                        </div>
                        <ul className="space-y-1">
                          {missing.map((m, i) => (
                            <li key={i} className="text-xs text-amber-700 flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => listo && setActiveModule('C')}
                      disabled={!listo}
                      className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${listo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {listo
                        ? <>Módulo B listo → Ir a Restricciones <ChevronRight size={15} /></>
                        : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODULE C: RESTRICCIONES — MVP ágil
          ══════════════════════════════════════════════════════════════ */}
          {activeModule === 'C' && (
            <Step1CaptureSynthesisModule
              context={captureModuleContext}
              state={captureSynthesisData}
              statusLabel={moduleAdjustments.capture ? 'Requiere ajuste' : moduloCCompletado ? 'Completado' : 'En progreso'}
              missing={captureSynthesisMissing}
              reviewCtaLabel={reviewCtaLabel}
              reviewCtaHint={reviewCtaHint}
              onChange={setCaptureSynthesisData}
              onOpenIA={openIAPanel}
              onOpenMentor={() => setShowMentorModal(true)}
              onOpenReview={openStep1Closure}
            />
          )}

          {activeModule === 'C' && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Cierre final del Step 1</p>
                  <p className="text-xs text-slate-500 mt-1">La narrativa de cierre es: evidencia y sintesis listas, validacion IA completada y aprobacion final de mentor antes de habilitar el siguiente step.</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  step1ClosureState === 'en_trabajo'
                    ? 'bg-slate-100 text-slate-700'
                    : step1ClosureState === 'listo_revision_ia'
                    ? 'bg-violet-100 text-violet-700'
                    : step1ClosureState === 'listo_validacion_mentor'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`} style={{ fontWeight: 700 }}>
                  {step1ClosureState === 'en_trabajo'
                    ? 'En trabajo'
                    : step1ClosureState === 'listo_revision_ia'
                    ? 'Listo para validacion IA'
                    : step1ClosureState === 'listo_validacion_mentor'
                    ? 'Listo para validacion de mentor'
                    : 'Aprobado por mentor'}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { label: '1. Investigacion y sintesis', done: canSendStep1, desc: 'El Modulo C ya tiene base minima para cerrar.' },
                  { label: '2. Validacion IA', done: step1FeedbackReady, desc: 'La IA deja el Step 1 listo para revision final.' },
                  { label: '3. Validacion de mentor', done: step1MentorApproved, desc: step1MentorMode === 'meeting' ? 'Cierre por reunion con mentor.' : step1MentorMode === 'async_review' ? 'Cierre por evaluacion directa del mentor.' : 'Elige la via de validacion final.' },
                  { label: '4. Habilitar Step 2', done: step1MentorApproved, desc: 'Solo se desbloquea cuando mentor aprueba.' },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border p-3 ${item.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-xs ${item.done ? 'text-emerald-700' : 'text-slate-700'}`} style={{ fontWeight: 700 }}>{item.label}</p>
                    <p className={`text-xs mt-1 ${item.done ? 'text-emerald-700' : 'text-slate-500'}`}>{item.desc}</p>
                  </div>
                ))}
              </div>

              {step1ClosureState === 'listo_validacion_mentor' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Validacion final de mentor pendiente</p>
                  <p className="text-sm text-amber-700">La validacion de mentor confirma que el problema quedo bien definido, que la evidencia es suficiente, que la decision tomada tiene sentido y que el equipo puede avanzar al siguiente step.</p>
                  <p className="text-xs text-amber-700">
                    {step1MentorMode === 'meeting'
                      ? 'Via elegida: reunion con mentor. Aun falta el ok final del mentor despues de la sesion.'
                      : step1MentorMode === 'async_review'
                      ? 'Via elegida: evaluacion directa del mentor. Aun falta su aprobacion final.'
                      : 'Aun falta elegir si el cierre se validara por reunion con mentor o por evaluacion directa.'}
                  </p>
                </div>
              )}

              {step1MentorApproved && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-800" style={{ fontWeight: 700 }}>Step 1 aprobado por mentor</p>
                  <p className="text-sm text-emerald-700 mt-1">La IA y el mentor ya validaron el cierre del Step 1. El siguiente step queda habilitado para continuar.</p>
                </div>
              )}

              {(adaptiveStep1Saving || adaptiveStep1Error) && (
                <div className={`rounded-xl border p-4 ${adaptiveStep1Error ? 'border-red-200 bg-red-50' : 'border-indigo-200 bg-indigo-50'}`}>
                  <p className={`text-xs ${adaptiveStep1Error ? 'text-red-800' : 'text-indigo-800'}`} style={{ fontWeight: 700 }}>
                    {adaptiveStep1Error ? 'Persistencia adaptativa pendiente' : 'Confirmando Step 1 adaptativo'}
                  </p>
                  <p className={`mt-1 text-sm ${adaptiveStep1Error ? 'text-red-700' : 'text-indigo-700'}`}>
                    {adaptiveStep1Error ?? 'Guardando output confirmado, configurando Step 2 y actualizando la senal de Portfolio Lead.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {false && activeModule === 'C' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo C: Restricciones</h1>
                    <StatusChip status={semaforo === 'verde' ? 'Completado' : semaforo === 'rojo' ? 'Bloqueado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-lg">
                    Define solo lo indispensable para evitar bloqueos. Esto nos ayuda a diseñar un piloto realista.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={openIAPanel} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Mejorar con IA
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SEMÁFORO — siempre visible arriba
              ════════════════════════════════════════ */}
              <div className={`border rounded-2xl p-4 ${semaforoConfig.bg}`}>
                <div className="flex items-start gap-3">
                  <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${semaforoConfig.dot}`} />
                  <div className="flex-1">
                    <p className={`text-sm ${semaforoConfig.color}`} style={{ fontWeight: 700 }}>{semaforoConfig.label}</p>
                    <p className={`text-xs mt-1 ${semaforoConfig.color}`} style={{ opacity: 0.85 }}>{semaforoConfig.desc}</p>

                    {/* Checklist de faltantes */}
                    {semaforo !== 'verde' && (() => {
                      const faltantes: { texto: string; accion?: () => void }[] = [];
                      if (cData.limitesChips.length === 0 && !cData.limitesTexto.trim())
                        faltantes.push({ texto: 'Define al menos 1 límite no negociable (campo 1)' });
                      if (!cData.dependencia.trim())
                        faltantes.push({ texto: 'Registra la dependencia crítica (campo 2)' });
                      if (cData.dependencia.trim() && !cData.dependenciaDueno.trim())
                        faltantes.push({ texto: 'Indica el dueño de la dependencia (campo 2)' });
                      if (cData.dependencia.trim() && !cData.alternativaPiloto.trim())
                        faltantes.push({ texto: 'Define cómo pilotar sin esa dependencia (campo 3) ← bloqueante' });
                      return faltantes.length > 0 ? (
                        <div className="mt-3 pt-3 border-t border-current/10">
                          <p className={`text-xs mb-1.5 ${semaforoConfig.color}`} style={{ fontWeight: 600 }}>Qué falta:</p>
                          <ul className="space-y-1">
                            {faltantes.map((f, i) => (
                              <li key={i} className={`text-xs flex items-start gap-1.5 ${semaforoConfig.color}`}>
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                {f.texto}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  MUST 1 — Límites no negociables
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>1</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                      Límites no negociables <span className="text-slate-400" style={{ fontWeight: 400 }}>(¿qué NO podemos hacer?)</span> <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Escribe 2–4 puntos. Si una idea cruza esto, se descarta automáticamente.</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Chips sugeridos */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>Selecciona los que apliquen:</p>
                    <div id="field-step1-cData-limitesChips">
                      <AutofillField
                        fieldPath="step1.cData.limitesChips"
                        initiativeId={projectId}
                        value={cData.limitesChips}
                        onChange={(v) => setCData(p => ({
                          ...p,
                          limitesChips: Array.isArray(v) ? (v as string[]) : [],
                        }))}
                        label="Límites del piloto"
                      >
                        {({ value, onChange, readOnly }) => {
                          const activeChips: string[] = Array.isArray(value) ? (value as string[]) : [];
                          return (
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Límites del piloto">
                              {[
                                'Datos sensibles',
                                'Legal / regulatorio',
                                'No interrumpir operación',
                                'Seguridad de la información',
                                'Presupuesto cero',
                                'Sin cambios en sistemas',
                              ].map(chip => {
                                const selected = activeChips.includes(chip);
                                return (
                                  <button
                                    key={chip}
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const nextChips = selected
                                        ? activeChips.filter(c => c !== chip)
                                        : [...activeChips, chip];
                                      onChange(nextChips);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${
                                      selected
                                        ? 'border-red-400 bg-red-50 text-red-700'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                    } ${readOnly ? 'opacity-90 cursor-default' : ''}`}
                                    style={{ fontWeight: selected ? 600 : 400 }}
                                  >
                                    {selected && <X size={10} className="text-red-400" />}
                                    {chip}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        }}
                      </AutofillField>
                    </div>
                  </div>

                  {/* Límites adicionales libres */}
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>¿Hay otros límites específicos de tu contexto?</label>
                    <textarea
                      value={cData.limitesTexto}
                      onChange={e => setCData(p => ({ ...p, limitesTexto: e.target.value }))}
                      rows={2}
                      placeholder="Ej. No involucrar contratistas externos en la fase de descubrimiento. No modificar flujos que afecten a clientes."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  {/* Confirmación */}
                  {(cData.limitesChips.length > 0 || cData.limitesTexto.trim()) && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <CheckCircle2 size={13} className="text-red-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-red-700">
                        <span style={{ fontWeight: 600 }}>Límites registrados:</span>{' '}
                        {[...cData.limitesChips, cData.limitesTexto.trim()].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  MUST 2 — Dependencia crítica
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>2</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                      Posible bloqueo <span className="text-slate-400" style={{ fontWeight: 400 }}>(dependencia crítica)</span> <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">¿De qué área o sistema dependes para que esto funcione?</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Dependencia + Dueño */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>¿De qué depende el piloto? <span className="text-red-400">*</span></label>
                      <div id="field-step1-cData-dependencia">
                        <AutofillField
                          fieldPath="step1.cData.dependencia"
                          initiativeId={projectId}
                          value={cData.dependencia}
                          onChange={(v) => setCData(p => ({ ...p, dependencia: String(v ?? '') }))}
                          label="Dependencia del piloto"
                        >
                          {({ value, onChange, readOnly }) => (
                            <input
                              value={String(value ?? '')}
                              onChange={e => onChange(e.target.value)}
                              readOnly={readOnly}
                              placeholder="Ej. Área de TI para gestionar accesos al sistema. API de nómina. Aprobación de legal."
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                          )}
                        </AutofillField>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>Dueño (área / rol)</label>
                      <input
                        value={cData.dependenciaDueno}
                        onChange={e => setCData(p => ({ ...p, dependenciaDueno: e.target.value }))}
                        placeholder="Ej. Gerente de TI, Legal, Finanzas"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>Probabilidad de demora</label>
                      <div className="flex gap-2">
                        {([
                          { v: 'baja',  label: 'Baja',  color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                          { v: 'media', label: 'Media', color: 'border-amber-300 bg-amber-50 text-amber-700' },
                          { v: 'alta',  label: 'Alta',  color: 'border-red-300 bg-red-50 text-red-700' },
                        ] as const).map(opt => (
                          <button
                            key={opt.v}
                            onClick={() => setCData(p => ({ ...p, dependenciaProbabilidad: opt.v }))}
                            className={`flex-1 py-2 rounded-xl border text-xs transition-all ${
                              cData.dependenciaProbabilidad === opt.v
                                ? opt.color
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                            style={{ fontWeight: cData.dependenciaProbabilidad === opt.v ? 600 : 400 }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Aviso si probabilidad alta */}
                  {cData.dependenciaProbabilidad === 'alta' && cData.dependencia.trim() && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Dependencia de riesgo alto.</span>{' '}
                        El semáforo se mantendrá en Amarillo hasta que definas una alternativa para pilotar (campo 3).
                        {!cData.dependenciaDueno.trim() && ' Además, falta el dueño.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  MUST 3 — Alternativa para pilotear
              ════════════════════════════════════════ */}
              <div className={`border rounded-2xl overflow-hidden bg-white ${cData.dependencia.trim() && !cData.alternativaPiloto.trim() ? 'border-red-300' : 'border-slate-200'}`}>
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>3</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                      Alternativa para pilotear sin esa dependencia <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">¿Cómo lo probamos en pequeño si la dependencia no está lista?</p>
                  </div>
                  {cData.dependencia.trim() && !cData.alternativaPiloto.trim() && (
                    <span className="text-xs text-red-500 px-2 py-1 bg-red-50 rounded-lg border border-red-200 shrink-0" style={{ fontWeight: 500 }}>Bloqueante</span>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <div id="field-step1-cData-alternativaPiloto">
                    <AutofillField
                      fieldPath="step1.cData.alternativaPiloto"
                      initiativeId={projectId}
                      value={cData.alternativaPiloto}
                      onChange={(v) => setCData(p => ({ ...p, alternativaPiloto: String(v ?? '') }))}
                      label="Alternativa para pilotear"
                    >
                      {({ value, onChange, readOnly }) => (
                        <textarea
                          value={String(value ?? '')}
                          onChange={e => onChange(e.target.value)}
                          readOnly={readOnly}
                          rows={3}
                          placeholder="Ej. Manual + registro en Excel compartido → formulario web simple → piloto con 10 casos antes de integrar el sistema."
                          className={`w-full border rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none ${cData.dependencia.trim() && !cData.alternativaPiloto.trim() ? 'border-red-200' : 'border-slate-200'}`}
                        />
                      )}
                    </AutofillField>
                  </div>
                  {/* Ejemplos rápidos */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-slate-400" style={{ fontWeight: 500 }}>Ejemplos:</span>
                    {[
                      'Manual + registro en hoja compartida',
                      'Formulario + Excel de seguimiento',
                      'Piloto con 10 casos primero',
                      'WhatsApp + checklist impreso',
                    ].map(ej => (
                      <button
                        key={ej}
                        onClick={() => setCData(p => ({ ...p, alternativaPiloto: p.alternativaPiloto ? `${p.alternativaPiloto}\n${ej}` : ej }))}
                        className="text-xs text-indigo-500 hover:text-indigo-700 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors"
                      >
                        + {ej}
                      </button>
                    ))}
                  </div>
                  {cData.alternativaPiloto.trim() && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-xs text-emerald-600" style={{ fontWeight: 500 }}>Alternativa registrada — el semáforo puede avanzar.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  OPCIONALES — colapsados por defecto
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowOpcionalesC(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600" style={{ fontWeight: 600 }}>Opcional <span className="text-slate-400" style={{ fontWeight: 400 }}>(si ya lo tienes claro)</span></span>
                    {(cData.vistoBueno.trim() || cData.capacidadReal.trim()) && (
                      <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded-full">
                        {[cData.vistoBueno.trim() && 'visto bueno', cData.capacidadReal.trim() && 'capacidad'].filter(Boolean).join(' · ')} completado
                      </span>
                    )}
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${showOpcionalesC ? 'rotate-180' : ''}`} />
                </button>
                {showOpcionalesC && (
                  <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-100">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>¿Quién daría el visto bueno para continuar? <span className="text-slate-400">(rol o nombre)</span></label>
                      <input
                        value={cData.vistoBueno}
                        onChange={e => setCData(p => ({ ...p, vistoBueno: e.target.value }))}
                        placeholder="Ej. Directora de RRHH, Comité de innovación, Gerente General"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                      <p className="text-xs text-slate-400 mt-1">No es requerido para avanzar, pero ayuda a anticipar el proceso de validación.</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontWeight: 500 }}>Capacidad disponible del equipo</label>
                      <input
                        value={cData.capacidadReal}
                        onChange={e => setCData(p => ({ ...p, capacidadReal: e.target.value }))}
                        placeholder="Ej. 2 personas de RRHH + 1 de TI, disponibles 20% de su tiempo."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                      <p className="text-xs text-slate-400 mt-1">Útil para dimensionar el alcance del piloto.</p>
                    </div>
                  </div>
                )}
              </div>

              <BannerPorDefinir
                title="Hard gate vs. Soft gate al enviar a revisión IA"
                question="¿El sistema debe bloquear completamente el envío si faltan campos, o solo mostrar advertencias y permitir enviar de todas formas? Definir criterio de 'mínimo aceptable' para revisión IA."
                context="conflict"
              />

              {/* ════════════════════════════════════════
                  BOTÓN DE AVANCE
              ══════════════════════════════════════��═ */}
              <button
                onClick={() => semaforo !== 'rojo' && setActiveModule('D')}
                disabled={semaforo === 'rojo'}
                className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${
                  semaforo === 'rojo'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : semaforo === 'amarillo'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                style={{ fontWeight: 500 }}
              >
                {semaforo === 'rojo'
                  ? <><Lock size={14} /> Define cómo pilotear sin la dependencia para continuar</>
                  : semaforo === 'amarillo'
                    ? <>Continuar de todas formas (Amarillo) — revisar antes de enviar <ChevronRight size={15} /></>
                    : <>Módulo C listo → Ir a Actores <ChevronRight size={15} /></>}
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              MODULE D: ACTORES Y VALIDACIÓN EN CAMPO
          ══════════════════════════════════════════════════════════════ */}
          {false && activeModule === 'D' && (
            <div className="space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Módulo D · Actores y validación en campo</h1>
                    <StatusChip status={moduloDListo() ? 'Completado' : 'En progreso'} size="sm" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-lg">
                    Busca evidencia real con personas y/o datos. Al final decidimos si el reto se mantiene o se ajusta.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={openIAPanel} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                    <Sparkles size={11} /> Mejorar con IA
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMentorOptions(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
                      <MessageSquare size={11} /> Mentor <ChevronDown size={10} />
                    </button>
                    {showMentorOptions && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                        <button onClick={() => { setShowMentorModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Pedir ayuda (destrabe)</button>
                        <button onClick={() => { setShowSessionModal(true); setShowMentorOptions(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors" style={{ fontWeight: 500 }}>Agendar sesión</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Mini-card: Reto actual (Solo lectura) ── */}
              {fichaConfirmada ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target size={13} className="text-indigo-400" />
                      <p className="text-xs text-indigo-600" style={{ fontWeight: 700 }}>Reto actual (del Módulo A)</p>
                      <span className="text-xs text-indigo-300 px-1.5 py-0.5 bg-white/60 rounded ml-1" style={{ fontWeight: 400 }}>Solo lectura</span>
                    </div>
                    <button onClick={() => setActiveModule('A')} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
                      <ExternalLink size={10} /> Ver Módulo A
                    </button>
                  </div>
                  <p className="text-xs text-indigo-800 mb-3" style={{ fontWeight: 500 }}>{lecturaConsolidada}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {asisData.quiebreIndex !== null && asisData.pasos[asisData.quiebreIndex] && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>DÓNDE OCURRE</p>
                        <p className="text-xs text-indigo-700">Paso {asisData.quiebreIndex + 1} — {asisData.pasos[asisData.quiebreIndex]}</p>
                      </div>
                    )}
                    {asisData.consecuencia && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>CONSECUENCIA</p>
                        <p className="text-xs text-indigo-700">{asisData.consecuencia.slice(0, 80)}{asisData.consecuencia.length > 80 ? '…' : ''}</p>
                      </div>
                    )}
                    {asisData.causaInmediata && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>CAUSA INMEDIATA</p>
                        <p className="text-xs text-indigo-700">{asisData.causaInmediata.slice(0, 80)}{asisData.causaInmediata.length > 80 ? '…' : ''}</p>
                      </div>
                    )}
                    {asisData.evidenciaNota && (
                      <div>
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>EVIDENCIA</p>
                        <p className="text-xs text-indigo-700">{asisData.evidenciaNota.slice(0, 70)}{asisData.evidenciaNota.length > 70 ? '…' : ''}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                  <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800 mb-2" style={{ fontWeight: 500 }}>
                      No hay reto definido en el Módulo A. Sin reto claro, no podemos validar en campo.
                    </p>
                    <button onClick={() => setActiveModule('A')} className="flex items-center gap-1 text-xs text-amber-700 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-200 transition-colors" style={{ fontWeight: 500 }}>
                      Ir al Módulo A <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════
                  SECCIÓN 1: OBJETIVOS
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>1) ¿Qué necesitas confirmar o entender mejor? <span className="text-red-500">*</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Objetivos concretos para validar si el reto es real, importante y acotado. Define entre 1 y 3.</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Chips sugeridos */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>Sugerencias rápidas <span className="text-slate-400" style={{ fontWeight: 400 }}>(toca para agregar):</span></p>
                    <div className="flex flex-wrap gap-2">
                      {['Confirmar impacto', 'Entender causa', 'Identificar decisor', 'Conocer parches actuales', 'Acotar alcance'].map(chip => {
                        const ya = dData.objetivos.some(o => o.toLowerCase().includes(chip.toLowerCase()));
                        const lleno = dData.objetivos.filter(o => o.trim()).length >= 3;
                        return (
                          <button
                            key={chip}
                            disabled={ya || lleno}
                            onClick={() => {
                              if (ya) return;
                              const vacioIdx = dData.objetivos.findIndex(o => !o.trim());
                              if (vacioIdx !== -1) {
                                const ng = [...dData.objetivos]; ng[vacioIdx] = chip;
                                setDData(p => ({ ...p, objetivos: ng }));
                              } else if (dData.objetivos.length < 3) {
                                setDData(p => ({ ...p, objetivos: [...p.objetivos, chip] }));
                              }
                            }}
                            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${ya ? 'border-indigo-300 bg-indigo-50 text-indigo-600 cursor-default' : lleno ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer'}`}
                            style={{ fontWeight: ya ? 600 : 400 }}
                          >
                            {ya && <CheckCircle2 size={10} className="text-indigo-500" />}
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lista editable */}
                  <div className="space-y-2">
                    {dData.objetivos.map((obj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{i + 1}</span>
                        <input
                          value={obj}
                          onChange={e => { const ng = [...dData.objetivos]; ng[i] = e.target.value; setDData(p => ({ ...p, objetivos: ng })); }}
                          placeholder="Ej. Confirmar si el equipo de RRHH usa parches para compensar el retraso…"
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                        {dData.objetivos.length > 1 && (
                          <button onClick={() => setDData(p => ({ ...p, objetivos: p.objetivos.filter((_, j) => j !== i) }))}>
                            <X size={13} className="text-slate-300 hover:text-red-400 transition-colors" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {dData.objetivos.length < 3 && (
                    <button
                      onClick={() => setDData(p => ({ ...p, objetivos: [...p.objetivos, ''] }))}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Plus size={12} /> Agregar objetivo
                    </button>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 2: FUENTES
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>2) ¿A quién o qué fuente necesitas consultar? <span className="text-red-500">*</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Puedes usar entrevistas, tickets, reportes o bases de datos. Lo importante es traer evidencia.</p>
                </div>
                <div className="p-5 space-y-3">
                  {dData.fuentes.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <Users size={20} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 mb-1" style={{ fontWeight: 500 }}>Sin fuentes todavía.</p>
                      <p className="text-xs text-slate-400">Agrega la primera fuente: persona, datos o documento.</p>
                    </div>
                  )}

                  {dData.fuentes.map((fuente, fi) => (
                    <div key={fuente.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs shrink-0" style={{ fontWeight: 700 }}>{fi + 1}</span>
                          <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Fuente {fi + 1}</p>
                        </div>
                        <button onClick={() => setDData(p => ({ ...p, fuentes: p.fuentes.filter(f => f.id !== fuente.id) }))}>
                          <Trash2 size={13} className="text-slate-300 hover:text-red-400 transition-colors" />
                        </button>
                      </div>

                      {/* Tipo de fuente */}
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 500 }}>Tipo de fuente</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['persona', 'datos', 'documento'] as const).map(tipo => (
                            <button
                              key={tipo}
                              onClick={() => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, tipo } : f) }))}
                              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs transition-colors ${fuente.tipo === tipo ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-white'}`}
                              style={{ fontWeight: fuente.tipo === tipo ? 600 : 400 }}
                            >
                              {tipo === 'persona' && <Users size={12} />}
                              {tipo === 'datos' && <BarChart2 size={12} />}
                              {tipo === 'documento' && <FileText size={12} />}
                              {tipo === 'persona' ? 'Persona' : tipo === 'datos' ? 'Datos' : 'Documento'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Rol / Nombre */}
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>
                          {fuente.tipo === 'persona' ? 'Rol / nombre' : fuente.tipo === 'datos' ? 'Sistema o fuente de datos' : 'Nombre del documento'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={fuente.rolNombre}
                          onChange={e => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, rolNombre: e.target.value } : f) }))}
                          placeholder={fuente.tipo === 'persona' ? 'Ej. Coordinadora de RRHH, Jefe de TI…' : fuente.tipo === 'datos' ? 'Ej. Dashboard RRHH, sistema SAP, Excel de gerencia…' : 'Ej. Reporte mensual de onboarding Q1 2025…'}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Por qué esta fuente</label>
                          <input
                            value={fuente.porQue}
                            onChange={e => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, porQue: e.target.value } : f) }))}
                            placeholder="Ej. Tiene el dato más cercano al quiebre…"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Qué quiero confirmar</label>
                          <input
                            value={fuente.queConfirmar}
                            onChange={e => setDData(p => ({ ...p, fuentes: p.fuentes.map(f => f.id === fuente.id ? { ...f, queConfirmar: e.target.value } : f) }))}
                            placeholder="Ej. Si el tiempo real de espera es 7–10 días…"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setDData(p => ({ ...p, fuentes: [...p.fuentes, { id: Date.now().toString(), tipo: '', rolNombre: '', porQue: '', queConfirmar: '' }] }))}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus size={12} /> Agregar fuente
                  </button>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 3: GUÍA DE PREGUNTAS
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>3) Guía de preguntas (según la fuente)</p>
                    <p className="text-xs text-slate-400 mt-0.5">La IA sugiere preguntas diferenciadas por tipo de fuente. Edítalas libremente antes de usar.</p>
                  </div>
                  <button
                    onClick={() => {
                      setGenerandoGuia(true);
                      setTimeout(() => {
                        const nuevasGuias: Record<string, string[]> = {};
                        dData.fuentes.forEach(f => {
                          if (f.tipo === 'persona') {
                            const esLider = ['jefe', 'gerente', 'director', 'líder', 'lider', 'coordinador'].some(kw => f.rolNombre.toLowerCase().includes(kw));
                            nuevasGuias[f.id] = esLider ? [
                              '¿Cómo describirías el impacto de este problema en tu área?',
                              '¿Qué tan urgente es resolverlo para el negocio en el próximo trimestre?',
                              '¿Cuántos casos aproximados ocurren por mes? ¿Tienes un registro?',
                              '¿Qué indicadores usas para saber si el proceso funciona bien?',
                              '¿Quién tiene la autoridad para aprobar cambios en este proceso?',
                              '¿Qué intentaron antes para solucionar esto y por qué no funcionó?',
                            ] : [
                              '¿Puedes contarme la última vez que te pasó esto? ¿Qué hiciste?',
                              '¿Cómo lo resuelves cuando ocurre? ¿Tienes algún workaround?',
                              '¿Con qué frecuencia pasa? ¿Cuánto tiempo te consume cuando ocurre?',
                              '¿Qué es lo que más te frustra del proceso actual?',
                              '¿A quién más afecta directamente cuando sucede?',
                              '¿Qué cambiaría para ti si esto estuviera resuelto?',
                              '¿Tienes algún registro o dato que muestre el problema?',
                            ];
                          } else if (f.tipo === 'datos') {
                            nuevasGuias[f.id] = [
                              '¿Cuántos casos del proceso se registran por mes o trimestre?',
                              '¿Existe un campo que capture el tiempo de espera o el punto de quiebre?',
                              '¿Cómo podríamos calcular el costo por caso no resuelto o retrasado?',
                              '¿Qué proxy podríamos usar si no existe el dato exacto?',
                              '¿Quién es el dueño del sistema y puede darnos acceso al dato?',
                            ];
                          } else {
                            nuevasGuias[f.id] = [
                              '¿Este documento tiene el dato exacto que necesitamos o es parcial?',
                              '¿Cuándo fue la última actualización de este reporte?',
                              '¿Qué tan representativa es la muestra del período analizado?',
                              '¿Hay otra fuente que complemente o valide este documento?',
                            ];
                          }
                        });
                        setGuiasPreguntas(nuevasGuias);
                        setGenerandoGuia(false);
                      }, 1800);
                    }}
                    disabled={dData.fuentes.length === 0 || generandoGuia}
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors disabled:opacity-50 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    {generandoGuia ? <><span className="animate-spin inline-block">⟳</span> Generando…</> : <><Sparkles size={11} /> Generar guía con IA</>}
                  </button>
                </div>
                <div className="p-5 space-y-5">
                  {dData.fuentes.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 italic">Agrega fuentes en la sección anterior para generar preguntas.</p>
                  ) : (
                    dData.fuentes.map(fuente => (
                      <div key={fuente.id}>
                        <div className="flex items-center gap-2 mb-2">
                          {fuente.tipo === 'persona' && <Users size={12} className="text-indigo-400" />}
                          {fuente.tipo === 'datos' && <BarChart2 size={12} className="text-violet-400" />}
                          {fuente.tipo === 'documento' && <FileText size={12} className="text-slate-400" />}
                          {!fuente.tipo && <span className="w-3 h-3 rounded-full bg-slate-200 inline-block shrink-0" />}
                          <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>
                            {fuente.rolNombre || `Fuente ${dData.fuentes.indexOf(fuente) + 1} (sin nombre)`}
                            {fuente.tipo && <span className="ml-1.5 text-slate-400" style={{ fontWeight: 400 }}>· {fuente.tipo === 'persona' ? 'Persona' : fuente.tipo === 'datos' ? 'Datos' : 'Documento'}</span>}
                          </p>
                        </div>
                        {guiasPreguntas[fuente.id] ? (
                          <div className="space-y-1.5 pl-4 border-l-2 border-indigo-100">
                            {guiasPreguntas[fuente.id].map((preg, pi) => (
                              <div key={pi} className="flex items-start gap-2">
                                <span className="text-slate-400 text-xs shrink-0 mt-1.5">{pi + 1}.</span>
                                <input
                                  value={preg}
                                  onChange={e => {
                                    const copia = { ...guiasPreguntas };
                                    copia[fuente.id] = [...copia[fuente.id]];
                                    copia[fuente.id][pi] = e.target.value;
                                    setGuiasPreguntas(copia);
                                  }}
                                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="pl-4 py-2 border-l-2 border-slate-100">
                            <p className="text-xs text-slate-400 italic">Sin preguntas generadas aún. Toca "Generar guía con IA" para obtenerlas.</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {dData.fuentes.length > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Guardarrail IA:</span> La IA sugiere preguntas, no inventa entrevistas ni datos. Los hallazgos los registras tú en la sección de evidencia.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 4: EVIDENCIA MÍNIMA
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
                    4) Sube evidencia de lo que encontraste <span className="text-slate-400 text-xs" style={{ fontWeight: 400 }}>(mínimo 2 si es posible)</span> <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ideal: 1 evidencia de voz (nota/testimonio) + 1 evidencia dura (dato/ticket/reporte). Si no hay dato exacto, permite proxy.
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  {dData.evidencias.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <Upload size={20} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 mb-1" style={{ fontWeight: 500 }}>Todavía no agregaste evidencia.</p>
                      <p className="text-xs text-slate-400">Agrega notas, testimonios, datos, capturas o reportes de lo que encontraste.</p>
                    </div>
                  )}

                  {dData.evidencias.map((ev, ei) => (
                    <div key={ev.id} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-600" style={{ fontWeight: 600 }}>Evidencia {ei + 1}</p>
                        <button onClick={() => setDData(p => ({ ...p, evidencias: p.evidencias.filter(e => e.id !== ev.id) }))}>
                          <Trash2 size={13} className="text-slate-300 hover:text-red-400 transition-colors" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>¿Qué es? <span className="text-red-500">*</span></label>
                        <div className="flex flex-wrap gap-2">
                          {(['nota', 'audio', 'captura', 'link', 'reporte'] as const).map(tipo => (
                            <button
                              key={tipo}
                              onClick={() => setDData(p => ({ ...p, evidencias: p.evidencias.map(e => e.id === ev.id ? { ...e, tipo } : e) }))}
                              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${ev.tipo === tipo ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                              style={{ fontWeight: ev.tipo === tipo ? 600 : 400 }}
                            >{tipo}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Nombre o descripción breve</label>
                        <input
                          value={ev.nombre}
                          onChange={e => setDData(p => ({ ...p, evidencias: p.evidencias.map(ev2 => ev2.id === ev.id ? { ...ev2, nombre: e.target.value } : ev2) }))}
                          placeholder="Ej. Testimonio de Coordinadora RRHH · Reunión 18 feb"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>¿Qué demuestra? <span className="text-red-500">*</span></label>
                        <input
                          value={ev.queDemuestra}
                          onChange={e => setDData(p => ({ ...p, evidencias: p.evidencias.map(ev2 => ev2.id === ev.id ? { ...ev2, queDemuestra: e.target.value } : ev2) }))}
                          placeholder="Ej. Confirma que el tiempo promedio es 8–10 días según registro de RRHH."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  ))}

                  {dData.evidencias.length === 1 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span style={{ fontWeight: 600 }}>Recomendación:</span> Tienes 1 evidencia. Lo ideal es tener 2 (1 de voz + 1 dura). Puedes avanzar con 1, pero el reto quedará menos fundamentado.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setDData(p => ({ ...p, evidencias: [...p.evidencias, { id: Date.now().toString(), tipo: '', nombre: '', queDemuestra: '' }] }))}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus size={12} /> Agregar evidencia
                  </button>
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 5: DECISIÓN SOBRE EL RETO
              ════════════════════════════════════════ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>5) Con lo aprendido, ¿qué pasa con el reto? <span className="text-red-500">*</span></p>
                  <p className="text-xs text-slate-400 mt-0.5">Basándote en la evidencia recopilada, decide si el reto sigue igual o necesita ajustarse.</p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="space-y-2">
                    {([
                      { v: 'mantiene', label: 'Se mantiene', desc: 'La evidencia confirma el reto tal como lo definimos. Seguimos adelante.', colorBorder: 'border-emerald-400', colorBg: 'bg-emerald-50', colorText: 'text-emerald-700', colorDot: 'border-emerald-500 bg-emerald-500' },
                      { v: 'ajusta', label: 'Se ajusta', desc: 'El reto sigue siendo válido, pero hay detalles que aclarar: alcance, causa o consecuencia.', colorBorder: 'border-amber-400', colorBg: 'bg-amber-50', colorText: 'text-amber-700', colorDot: 'border-amber-500 bg-amber-500' },
                      { v: 'cambia', label: 'Cambia', desc: 'La evidencia muestra que el reto original no era el correcto. Lo redefinimos.', colorBorder: 'border-red-400', colorBg: 'bg-red-50', colorText: 'text-red-700', colorDot: 'border-red-500 bg-red-500' },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setDData(p => ({ ...p, decisionReto: opt.v }))}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          dData.decisionReto === opt.v
                            ? `${opt.colorBorder} ${opt.colorBg}`
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${dData.decisionReto === opt.v ? opt.colorDot : 'border-slate-300'}`} />
                        <div>
                          <p className={`text-sm ${dData.decisionReto === opt.v ? opt.colorText : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{opt.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {(dData.decisionReto === 'ajusta' || dData.decisionReto === 'cambia') && (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Nueva versión del reto en 1 frase <span className="text-red-500">*</span></label>
                        <textarea
                          value={dData.nuevaVersionReto}
                          onChange={e => setDData(p => ({ ...p, nuevaVersionReto: e.target.value }))}
                          rows={2}
                          placeholder='Hoy [proceso] se rompe en [nuevo paso o causa], causando [nueva consecuencia].'
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>¿Qué cambió? <span className="text-slate-400" style={{ fontWeight: 400 }}>(selecciona lo que aplique)</span></label>
                        <div className="flex flex-wrap gap-2">
                          {(['Alcance', 'Causa', 'Consecuencia', 'Paso del proceso'] as const).map(item => {
                            const sel = dData.queAjusto.includes(item);
                            return (
                              <button
                                key={item}
                                onClick={() => setDData(p => ({
                                  ...p,
                                  queAjusto: sel ? p.queAjusto.filter(q => q !== item) : [...p.queAjusto, item]
                                }))}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sel ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                                style={{ fontWeight: sel ? 600 : 400 }}
                              >{item}</button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECCIÓN 6: RESUMEN GENERADO
              ════════════════════════════════════════ */}
              {dData.decisionReto && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Resumen generado — Módulo D</p>
                    <p className="text-xs text-slate-400 mt-0.5">Se actualiza automáticamente con lo que registraste.</p>
                  </div>
                  <div className="p-5 space-y-3">

                    {/* Métricas rápidas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                        <p className="text-xs text-indigo-400 mb-0.5" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>FUENTES CONSULTADAS</p>
                        <p className="text-lg text-indigo-800" style={{ fontWeight: 700 }}>{dData.fuentes.filter(f => f.rolNombre.trim()).length}</p>
                        <p className="text-xs text-indigo-500 mt-0.5">
                          {dData.fuentes.filter(f => f.tipo === 'persona').length} persona(s) · {dData.fuentes.filter(f => f.tipo !== 'persona' && f.tipo).length} dato(s)/doc
                        </p>
                      </div>
                      <div className={`border rounded-xl p-3 ${dData.decisionReto === 'mantiene' ? 'bg-emerald-50 border-emerald-100' : dData.decisionReto === 'ajusta' ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                        <p className={`text-xs mb-0.5 ${dData.decisionReto === 'mantiene' ? 'text-emerald-400' : dData.decisionReto === 'ajusta' ? 'text-amber-400' : 'text-red-400'}`} style={{ fontWeight: 600, letterSpacing: '0.04em' }}>DECISIÓN</p>
                        <p className={`text-sm ${dData.decisionReto === 'mantiene' ? 'text-emerald-800' : dData.decisionReto === 'ajusta' ? 'text-amber-800' : 'text-red-800'}`} style={{ fontWeight: 700 }}>
                          {dData.decisionReto === 'mantiene' ? '✓ Reto se mantiene' : dData.decisionReto === 'ajusta' ? '↻ Reto se ajusta' : '⟳ Reto cambia'}
                        </p>
                        {dData.queAjusto.length > 0 && (
                          <p className="text-xs text-amber-600 mt-0.5">{dData.queAjusto.join(', ')}</p>
                        )}
                      </div>
                    </div>

                    {/* Hallazgos */}
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>Hallazgos principales</p>
                      <ul className="space-y-1.5">
                        {dData.evidencias.filter(e => e.queDemuestra.trim()).slice(0, 3).map((ev, i) => (
                          <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                            <span className="text-indigo-400 shrink-0 mt-0.5">·</span>
                            <span>{ev.queDemuestra}</span>
                          </li>
                        ))}
                        {dData.evidencias.filter(e => e.queDemuestra.trim()).length === 0 && (
                          <li className="text-xs text-slate-400 italic">Agrega evidencia con "¿qué demuestra?" para ver los hallazgos aquí.</li>
                        )}
                      </ul>
                    </div>

                    {/* Señal de impacto */}
                    {dData.objetivos.filter(o => o.trim()).length > 0 && (
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <p className="text-xs text-indigo-500 mb-1.5" style={{ fontWeight: 600 }}>Señal de impacto</p>
                        <p className="text-xs text-indigo-700">
                          · {dData.objetivos.filter(o => o.trim())[0]} {dData.evidencias.length > 0 ? `— validado con ${dData.evidencias.length} evidencia(s)` : '(pendiente de validar con evidencia)'}
                        </p>
                      </div>
                    )}

                    {/* Reto final */}
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>Reto final en 1 frase</p>
                      <p className="text-xs text-slate-700" style={{ fontWeight: 500 }}>
                        {(dData.decisionReto === 'ajusta' || dData.decisionReto === 'cambia') && dData.nuevaVersionReto.trim()
                          ? `"${dData.nuevaVersionReto}"`
                          : asisData.casoReal.trim()
                            ? `"${asisData.casoReal}"`
                            : <span className="italic text-slate-400">Sin definir todavía.</span>
                        }
                      </p>
                    </div>

                    {/* Botones IA + Mentor */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={openIAPanel}
                        className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-3 py-2 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <Sparkles size={11} /> Mejorar con IA
                      </button>
                      <button
                        onClick={() => setShowMentorModal(true)}
                        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-700 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <MessageSquare size={11} /> Mentor
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Gating + CTA ── */}
              {(() => {
                const missing = getModuloDMissing();
                const listo = missing.length === 0;
                return (
                  <div className="space-y-3">
                    {!listo && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={14} className="text-amber-500" />
                          <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Completa estos campos para ir a Síntesis:</p>
                        </div>
                        <ul className="space-y-1">
                          {missing.map((m, i) => <li key={i} className="text-xs text-amber-700">· {m}</li>)}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => listo && setActiveModule('S')}
                      disabled={!listo}
                      className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${listo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      style={{ fontWeight: 500 }}
                    >
                      {listo ? <>Módulo D listo → Ir a Síntesis <ChevronRight size={15} /></> : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Module S: Síntesis + Pivot Check */}
          {false && activeModule === 'S' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>Síntesis y Pivot Check</h1>
                <p className="text-sm text-slate-500">Integra los aprendizajes de todos los módulos y decide si continúas, ajustas o replanteas el desafío.</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700 space-y-1">
                <p style={{ fontWeight: 600 }}>Ancla del desafío (de tus módulos anteriores):</p>
                <p><span style={{ fontWeight: 500 }}>Quiebre:</span> {asisData.quiebre || '—'}</p>
                <p><span style={{ fontWeight: 500 }}>Obj. investigación:</span> {bData.objetivos.find(o => o.priorizado)?.texto?.slice(0, 70) || '—'}</p>
                <p><span style={{ fontWeight: 500 }}>Visto bueno:</span> {cData.vistoBueno || '—'} · Semáforo: {semaforo}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                  Resumen integrado <span className="text-xs text-slate-400">(v{sintesisData.version})</span>
                </label>
                <textarea value={sintesisData.resumen} onChange={e => setSintesisData(p => ({ ...p, resumen: e.target.value }))} rows={5} placeholder="Integra en 3-5 oraciones: el proceso actual, el quiebre, el impacto medible, las restricciones y los actores clave. Debe ser coherente y sin contradicciones." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-2" style={{ fontWeight: 500 }}>Pivot Check obligatorio <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'mantener', label: 'Mantener', desc: 'El desafío es correcto, sigo adelante.' },
                    { v: 'acotar', label: 'Acotar', desc: 'Reduzco el alcance para hacerlo viable.' },
                    { v: 'reformular', label: 'Reformular', desc: 'Redefiní el problema con nueva información.' },
                    { v: 'cambiar', label: 'Cambiar', desc: 'El desafío original no es el correcto.' },
                  ] as const).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setSintesisData(p => ({ ...p, pivotCheck: opt.v }))}
                      className={`text-left px-3 py-3 rounded-xl border transition-colors ${sintesisData.pivotCheck === opt.v ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <p className={`text-sm ${sintesisData.pivotCheck === opt.v ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {sintesisData.pivotCheck && sintesisData.pivotCheck !== 'mantener' && (
                  <div className="mt-3">
                    <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Razón del cambio (breve)</label>
                    <input value={sintesisData.razonPivot} onChange={e => setSintesisData(p => ({ ...p, razonPivot: e.target.value }))} placeholder="¿Qué descubriste que te hizo tomar esta decisión?" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                )}
              </div>

              {/* Send to review */}
              <div className="border-t border-slate-200 pt-5">
                <button
                  onClick={() => setShowSendModal(true)}
                  disabled={!sintesisData.pivotCheck || !sintesisData.resumen.trim()}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <Send size={15} /> Enviar a revisión IA
                </button>
                {(!sintesisData.pivotCheck || !sintesisData.resumen.trim()) && (
                  <div className="flex items-center gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                    <AlertCircle size={12} />
                    <div>
                      <p style={{ fontWeight: 500 }}>Ver faltantes antes de enviar:</p>
                      {!sintesisData.resumen.trim() && <p>· Escribe el resumen integrado</p>}
                      {!sintesisData.pivotCheck && <p>· Selecciona tu Pivot Check</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* IA Feedback */}
              {hasFeedback && (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                  <Sparkles className="mx-auto text-slate-400 mb-2" size={24} />
                  <p className="text-sm text-slate-600 mb-1" style={{ fontWeight: 600 }}>Aún no hay feedback IA</p>
                  <p className="text-xs text-slate-500">Pulsa “Solicitar revisión IA” para obtener análisis del Step 1.</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Send to IA Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            {!step1FeedbackReady ? (
              <>
                <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>¿Listo para enviar a validación IA?</h3>
                <p className="text-sm text-slate-500 mb-4">La IA revisará todos los módulos del Step 1 y confirmará si el cierre tiene base suficiente antes de pasar a la validación final de mentor.</p>
                <div className="space-y-2 mb-5">
                  {step1Modules.map(m => (
                    <div key={m.id} className={`flex items-center gap-2 text-sm ${m.completed ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {m.completed ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {m.label}
                      {!m.completed && <span className="text-xs text-amber-500">incompleto</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
                    Cancelar
                  </button>
                  <button
                    onClick={() => { setShowSendModal(false); sendToIA(); }}
                    disabled={sendingIA || !canSendStep1}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50"
                    style={{ fontWeight: 500 }}
                  >
                    {sendingIA ? 'Enviando…' : 'Enviar a IA'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Validación final de mentor</h3>
                <p className="text-sm text-slate-500 mb-4">La IA ya dejó el Step 1 listo. Ahora falta la validación final del mentor para confirmar que el problema quedó bien definido, que la evidencia es suficiente y que el equipo puede avanzar al siguiente step.</p>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 mb-4">
                  <p className="text-xs text-slate-700" style={{ fontWeight: 700 }}>Estado actual del cierre</p>
                  <p className="text-sm text-slate-700">
                    {step1MentorApproved
                      ? 'Aprobado por mentor. El Step 2 ya puede habilitarse.'
                      : step1MentorMode === 'meeting'
                      ? 'Pendiente reunión y aprobación final del mentor.'
                      : step1MentorMode === 'async_review'
                      ? 'Pendiente evaluación y aprobación directa del mentor.'
                      : 'Falta elegir la vía de validación final con mentor.'}
                  </p>
                </div>

                {!step1MentorMode && !step1MentorApproved && (
                  <div className="space-y-3 mb-4">
                    <button onClick={() => startMentorValidation('meeting')} className="w-full text-left rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors">
                      <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Validar por reunión con mentor</p>
                      <p className="text-xs text-amber-700 mt-1">Usa esta vía si necesitan conversación, preguntas o validación conjunta antes de avanzar.</p>
                    </button>
                    <button onClick={() => startMentorValidation('async_review')} className="w-full text-left rounded-xl border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 transition-colors">
                      <p className="text-sm text-indigo-900" style={{ fontWeight: 700 }}>Enviar para evaluación directa</p>
                      <p className="text-xs text-indigo-700 mt-1">Usa esta vía si el mentor puede revisar y aprobar el cierre sin reunión.</p>
                    </button>
                  </div>
                )}

                {mentorValidationPending && (
                  <div className="space-y-3 mb-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-700" style={{ fontWeight: 700 }}>Vía elegida</p>
                      <p className="text-sm text-slate-800 mt-1">{step1MentorMode === 'meeting' ? 'Reunión con mentor' : 'Evaluación directa del mentor'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {step1MentorMode === 'meeting'
                          ? 'Queda visible que el Step 1 está pendiente de la sesión y del ok final del mentor.'
                          : 'Queda visible que el Step 1 está pendiente de revisión y aprobación directa del mentor.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => registerMentorOutcome('Iterar')} className="rounded-xl border border-slate-200 text-slate-700 py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
                        Requiere ajustes
                      </button>
                      <button onClick={() => registerMentorOutcome('Aprobado')} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                        Registrar aprobación
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={() => setShowSendModal(false)} className="w-full border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mentor modal */}
      {showMentorModal && (
        <MentorSupportModal
          onClose={() => setShowMentorModal(false)}
        />
      )}

      {/* Session modal (placeholder) */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Agendar sesión con mentor</h3>
            <p className="text-sm text-slate-500 mb-4">Esta reunión sirve para la validación final del Step 1: confirmar que el problema quedó claro, que la evidencia es suficiente y que el equipo puede avanzar.</p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Estado del cierre</p>
              <p className="text-sm text-amber-700 mt-1">El Step 1 queda listo para validación de mentor, pero el siguiente step seguirá bloqueado hasta registrar la aprobación final.</p>
            </div>
            <BannerPorDefinir title="Integración de agendamiento" question="¿Se usa Calendly, Google Calendar u otro sistema? Definir el flujo exacto de agendamiento." />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => setShowSessionModal(false)} className="border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
                Cerrar
              </button>
              <button onClick={() => registerMentorOutcome('Aprobado')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                Registrar aprobación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IA Panel (sticky) */}
      {showIAPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setShowIAPanel(false)} />
          <div className="w-full max-w-md bg-white border-l border-slate-200 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Análisis IA</h3>
              </div>
              <button onClick={() => setShowIAPanel(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {iaLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin" />
                <p className="text-sm text-slate-500">Analizando tu Módulo A…</p>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <Sparkles className="mx-auto text-slate-400 mb-2" size={24} />
                <p className="text-sm text-slate-600 mb-1" style={{ fontWeight: 600 }}>Aún no hay análisis IA</p>
                <p className="text-xs text-slate-500">Solicita la revisión IA para obtener feedback del Módulo A.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


