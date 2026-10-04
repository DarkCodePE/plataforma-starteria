import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Lock, CheckCircle2, ChevronRight, Users, AlertTriangle, User,
  FileText, Clock, History, X, ChevronDown, UserPlus,
  Sparkles, Calendar, MessageSquare, ClipboardList,
} from 'lucide-react';
import { createTeamMember, useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { MentorSupportModal } from '../components/MentorSupportModal';
import { MentorVirtualPanel } from '../components/MentorVirtualPanel';
import { PdfInitiativeUploader } from '../components/PdfInitiativeUploader';
import { InitiativeStartChooser } from '../components/InitiativeStartChooser';
import { usePdfAutofill } from '../hooks/usePdfAutofill';
import { isPdfAutofillEnabled } from '../services/featureFlags';
// Sparkles & CheckCircle2 already come from the lucide import at the top of
// this file; only Loader2 & AlertCircle are new here.
import { Loader2, AlertCircle } from 'lucide-react';
import type { Project, Step } from '../context/AppContext';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { buildInheritedChallengeContext, getStep0Mode, getSummaryBlocks, normalizeStep0Data } from '../step0/step0Config';
import { CHALLENGE_TYPE_LABELS, type ChallengeType, type InitialReviewArtifact } from '../../features/initial-review/domain/types';
import { getInitialReview } from '../../features/initial-review/services/initialReviewStorage';
import { buildInitialReviewArtifact } from '../../features/initial-review/services/initialReviewMappers';
import type { AdaptiveInitiativeCore } from '../../features/adaptive-core/domain/types';
import { buildAdaptiveJourney, getCurrentAdaptiveJourneyStep } from '../../features/adaptive-core/domain/adaptiveJourney';
import { canNavigateToAdaptiveStep } from '../../features/adaptive-core/domain/adaptiveAuthority';
import { getAdaptiveCore } from '../../features/adaptive-core/services/adaptiveCoreService';
import { STEP_PROGRESS_QUESTION } from '../../features/adaptive-core/domain/adaptiveCore';

const STEP_DESCRIPTIONS = [
  'Entiende el problema con claridad: documenta el proceso actual, mide el impacto y conoce a los actores involucrados.',
  'Diseña la solución: explora ideas, elige la mejor opción y crea las tarjetas de solución y prueba.',
  'Prueba en pequeño: ejecuta experimentos reales, registra métricas y aprende de cada iteración.',
  'Cuenta la historia: construye el relato de tu proyecto e impacto, listo para compartir y presentar.',
];

const BLOCK_REASONS: Record<string, string> = {
  '1': 'Completa tu base estrategica inicial para empezar con claridad.',
  '2': 'Para acceder al Paso 2, el Paso 1 debe estar aprobado por tu mentor.',
  '3': 'Para acceder al Paso 3, el Paso 2 debe estar aprobado por tu mentor.',
  '4': 'Para acceder al Paso 4, el Paso 3 debe estar aprobado por tu mentor.',
};

const TOUCHPOINT_LABELS = {
  step0: 'Step 0 · Alineamiento inicial',
  step2: 'Cierre Step 2 · Revisión estratégica',
  step4: 'Step 4 · Presentación final',
} as const;

const INTRO_STEP_SUMMARY = [
  { number: '0', title: 'Base inicial', description: 'Justifica la iniciativa con criterio.' },
  { number: '1', title: 'Claridad en el desafío', description: 'Entiende mejor el problema.' },
  { number: '2', title: 'Diseñar solución', description: 'Explora opciones y define una prueba.' },
  { number: '3', title: 'Probar en pequeño', description: 'Valida con evidencia antes de escalar.' },
  { number: '4', title: 'Presentar propuesta', description: 'Organiza aprendizajes y sustenta mejor.' },
] as const;

type ProjectStepOverviewStatus = 'current' | 'completed' | 'available' | 'locked' | 'review_pending' | 'blocked';
type AdaptiveCoreLoadState = 'loading' | 'loaded' | 'error';
type StepPreviewState = {
  selectedStepId: string | null;
  isOpen: boolean;
  source: 'card_click' | 'explore_button' | 'auto';
};
type InitialReviewArtifactTab = 'onePager' | 'conversation';
type PersonalizedStepStatus = 'active' | 'locked' | 'completed' | 'in_review' | 'pending';

interface PersonalizedStepRouteItem {
  step: 0 | 1 | 2 | 3 | 4;
  title: string;
  shortDescription: string;
  previewTitle: string;
  previewSubtitle: string;
  workItems: string[];
  whyItMatters: string;
  expectedOutputs: string[];
  requirementsToAdvance: string[];
  status: PersonalizedStepStatus;
  ctaLabel: string;
}

interface BuildPersonalizedStepRouteInput {
  initiative: Project;
  initialReviewSnapshot?: InitialReviewArtifact | null;
  challengeType?: ChallengeType;
  focus: string;
  evidence: string;
  risk: string;
  stepStatuses: Record<number, ProjectStepOverviewStatus>;
}

interface InitialReviewArtifactDrawerProps {
  artifact: InitialReviewArtifact;
  open: boolean;
  tab: InitialReviewArtifactTab;
  onTabChange: (tab: InitialReviewArtifactTab) => void;
  onClose: () => void;
}

const PROJECT_STEPS_OVERVIEW = [
  {
    step: 0,
    title: 'Base estratégica inicial',
    shortTitle: 'Base inicial',
    shortDescription: 'Ordena el punto de partida de tu iniciativa.',
    whatItSolves: 'Aclarar qué quieres mover, por qué importa ahora, a quién impacta y qué evidencia inicial tienes.',
    output: 'Card inicial de iniciativa lista para compartir o usar como base del Step 1.',
    requirements: 'Completar los campos clave de base, impacto y decisión.',
    ctaStart: 'Empezar Paso 0',
    ctaContinue: 'Continuar Paso 0',
  },
  {
    step: 1,
    title: 'Definir y validar el foco',
    shortTitle: 'Definir foco',
    shortDescription: 'Aterriza el problema, oportunidad o exploración con evidencia.',
    whatItSolves: 'Evitar avanzar con una iniciativa demasiado amplia, débil o basada solo en intuición.',
    output: 'Foco validado, evidencia inicial, actores involucrados, restricciones y criterio de éxito.',
    requirements: 'Tener una base inicial completa y empezar a buscar evidencia real.',
    ctaStart: 'Empezar Paso 1',
    ctaContinue: 'Continuar Paso 1',
  },
  {
    step: 2,
    title: 'Diseñar apuesta y experimento',
    shortTitle: 'Diseñar apuesta',
    shortDescription: 'Convierte el foco validado en una hipótesis y una prueba medible.',
    whatItSolves: 'Pasar de una idea general a una solución priorizada que pueda probarse en pequeño.',
    output: 'HMW, idea seleccionada, hipótesis, experimento, métrica y umbral Go/No-Go.',
    requirements: 'Tener el Step 1 aprobado para diseñar desde evidencia.',
    ctaStart: 'Empezar Paso 2',
    ctaContinue: 'Continuar Paso 2',
  },
  {
    step: 3,
    title: 'Ejecutar, aprender y decidir',
    shortTitle: 'Ejecutar prueba',
    shortDescription: 'Registra la prueba, evidencia y aprendizajes.',
    whatItSolves: 'Entender si la apuesta funcionó, qué señal apareció y qué decisión corresponde tomar.',
    output: 'Evidencia de ejecución, resultados contra métrica, aprendizajes y recomendación.',
    requirements: 'Tener el experimento diseñado y aprobado en Step 2.',
    ctaStart: 'Empezar Paso 3',
    ctaContinue: 'Continuar Paso 3',
  },
  {
    step: 4,
    title: 'Cerrar y presentar propuesta',
    shortTitle: 'Presentar',
    shortDescription: 'Convierte el aprendizaje en una historia clara para sponsor o comité.',
    whatItSolves: 'Preparar una salida ejecutiva defendible, con evidencia, recomendación y siguiente paso.',
    output: 'Narrativa final, evidencia seleccionada, decisión solicitada y plan de acción.',
    requirements: 'Tener aprendizajes y resultados del Step 3.',
    ctaStart: 'Empezar Paso 4',
    ctaContinue: 'Continuar Paso 4',
  },
] as const;

function getJourneySubtitle(step: number) {
  switch (step) {
    case 0:
      return 'Empieza ordenando la base inicial para avanzar con claridad.';
    case 1:
      return 'Ahora valida el foco antes de diseñar una solución.';
    case 2:
      return 'Convierte el foco validado en una apuesta testeable.';
    case 3:
      return 'Ejecuta la prueba, captura evidencia y decide.';
    case 4:
      return 'Prepara una propuesta clara para sponsor, comité o siguiente decisión.';
    default:
      return 'Sigue el recorrido paso a paso sin perder de vista qué viene después.';
  }
}

function normalizeRouteStatus(status: ProjectStepOverviewStatus): PersonalizedStepStatus {
  if (status === 'current' || status === 'available') return 'active';
  if (status === 'completed') return 'completed';
  if (status === 'review_pending') return 'in_review';
  if (status === 'blocked' || status === 'locked') return 'locked';
  return 'pending';
}

function getRouteFocus(input: BuildPersonalizedStepRouteInput) {
  const onePager = input.initialReviewSnapshot?.onePager;
  return {
    name: onePager?.title || input.initiative.name,
    focus: (onePager?.whatToMove || input.focus || input.initiative.description || input.initiative.name).trim(),
    evidence: (onePager?.initialEvidence || input.evidence || 'evidencia inicial pendiente de validar').trim(),
    risk: (onePager?.mainRisk || input.risk || 'avanzar con una definicion demasiado amplia').trim(),
    audience: (onePager?.impactedAudience || 'los usuarios o equipos afectados').trim(),
    pendingQuestions: onePager?.pendingQuestions?.slice(0, 3) ?? [],
    type: input.challengeType || onePager?.challengeType || 'exploration',
  };
}

function buildPersonalizedStepRoute(input: BuildPersonalizedStepRouteInput): PersonalizedStepRouteItem[] {
  const context = getRouteFocus(input);
  const blockedCopy = 'Este step se desbloqueara cuando completes el paso anterior con los minimos necesarios.';

  const byType: Record<ChallengeType, Record<0 | 1 | 2 | 3 | 4, Pick<PersonalizedStepRouteItem, 'shortDescription' | 'previewSubtitle' | 'workItems' | 'whyItMatters' | 'expectedOutputs' | 'requirementsToAdvance'>>> = {
    correction: {
      0: {
        shortDescription: `Ordena alcance, actores y condiciones de ${context.focus}.`,
        previewSubtitle: `Aterriza la friccion que quieres corregir antes de investigar o disenar.`,
        workItems: ['Alcance inicial de la friccion', `Actores afectados: ${context.audience}`, 'Evidencia disponible y senales faltantes'],
        whyItMatters: `Reduce el riesgo de tratar ${context.focus} como una solucion antes de entender la friccion real.`,
        expectedOutputs: ['Base inicial clara', 'Actores y contexto definidos', 'Pendientes para validar en Step 1'],
        requirementsToAdvance: ['Completar campos minimos de Step 0', 'Registrar evidencia inicial', 'Definir que decision necesitas'],
      },
      1: {
        shortDescription: `Valida si la friccion es real, frecuente y medible.`,
        previewSubtitle: `Confirma impacto, frecuencia y actores antes de proponer una mejora.`,
        workItems: ['Evidencia de la friccion', 'Frecuencia e impacto actual', 'Actores que viven el problema'],
        whyItMatters: `El principal riesgo es ${context.risk}. Step 1 evita avanzar solo con intuicion.`,
        expectedOutputs: ['Foco validado', 'Evidencia del dolor', 'Criterio de exito inicial'],
        requirementsToAdvance: [blockedCopy],
      },
      2: {
        shortDescription: `Convierte el foco validado en una apuesta testeable para reducir la friccion.`,
        previewSubtitle: `Disena una mejora acotada y medible.`,
        workItems: ['Hipotesis de mejora', 'Solucion o piloto pequeno', 'Metrica de reduccion de friccion'],
        whyItMatters: 'Ayuda a probar una correccion sin comprometer recursos grandes desde el inicio.',
        expectedOutputs: ['Apuesta priorizada', 'Experimento definido', 'Umbral Go/No-Go'],
        requirementsToAdvance: [blockedCopy],
      },
      3: {
        shortDescription: `Mide reduccion de error, tiempo, retrabajo o friccion en pequeno.`,
        previewSubtitle: `Ejecuta la prueba y captura evidencia real de mejora.`,
        workItems: ['Registro de ejecucion', 'Medicion antes/despues', 'Aprendizajes y efectos no esperados'],
        whyItMatters: `La evidencia disponible hoy es: ${context.evidence}. Step 3 busca convertirla en evidencia de resultado.`,
        expectedOutputs: ['Resultados de prueba', 'Evidencia de mejora', 'Decision de ajustar o escalar'],
        requirementsToAdvance: [blockedCopy],
      },
      4: {
        shortDescription: `Prepara una propuesta de implementacion o piloto formal.`,
        previewSubtitle: `Convierte la evidencia en una recomendacion clara para sponsor o comite.`,
        workItems: ['Narrativa del caso', 'Evidencia seleccionada', 'Riesgos y siguiente decision'],
        whyItMatters: 'Permite pedir apoyo con una historia defendible y conectada al impacto observado.',
        expectedOutputs: ['Propuesta ejecutiva', 'Recomendacion de implementacion', 'Plan siguiente'],
        requirementsToAdvance: [blockedCopy],
      },
    },
    growth: {
      0: {
        shortDescription: `Ordena la oportunidad, segmento y metrica de ${context.focus}.`,
        previewSubtitle: 'Aterriza que quieres mover y a quien impacta primero.',
        workItems: ['Oportunidad inicial', `Segmento o audiencia: ${context.audience}`, 'Senal de demanda o adopcion'],
        whyItMatters: `Ayuda a enfocar la oportunidad sin asumir que el crecimiento ya esta validado.`,
        expectedOutputs: ['Base inicial clara', 'Audiencia priorizada', 'Preguntas para validar demanda'],
        requirementsToAdvance: ['Completar campos minimos de Step 0', 'Definir audiencia afectada', 'Registrar evidencia inicial'],
      },
      1: {
        shortDescription: 'Valida oportunidad, segmento, demanda o adopcion.',
        previewSubtitle: 'Confirma si existe una senal real de crecimiento.',
        workItems: ['Comportamiento actual del segmento', 'Senales de demanda o adopcion', 'Barreras para crecer'],
        whyItMatters: `El riesgo a cuidar es ${context.risk}; Step 1 separa oportunidad real de deseo interno.`,
        expectedOutputs: ['Oportunidad validada', 'Segmento claro', 'Criterio de crecimiento'],
        requirementsToAdvance: [blockedCopy],
      },
      2: {
        shortDescription: 'Disena una apuesta de crecimiento concreta y medible.',
        previewSubtitle: 'Convierte el foco validado en una prueba de crecimiento.',
        workItems: ['Hipotesis de crecimiento', 'Palanca a probar', 'Metrica de traccion'],
        whyItMatters: 'Permite aprender que palanca mueve adopcion, conversion o uso.',
        expectedOutputs: ['Apuesta de crecimiento', 'Experimento definido', 'Metrica y umbral'],
        requirementsToAdvance: [blockedCopy],
      },
      3: {
        shortDescription: 'Mide senal de traccion en pequeno.',
        previewSubtitle: 'Ejecuta la prueba y observa si aparece cambio medible.',
        workItems: ['Resultados de traccion', 'Aprendizajes por segmento', 'Barreras observadas'],
        whyItMatters: `La evidencia inicial es ${context.evidence}; Step 3 busca validar si escala a comportamiento real.`,
        expectedOutputs: ['Evidencia de traccion', 'Lectura de resultados', 'Decision de ampliar o ajustar'],
        requirementsToAdvance: [blockedCopy],
      },
      4: {
        shortDescription: 'Prepara recomendacion comercial, expansion o roadmap.',
        previewSubtitle: 'Organiza el aprendizaje para decidir si invertir mas.',
        workItems: ['Caso de crecimiento', 'Evidencia y riesgos', 'Roadmap o recomendacion'],
        whyItMatters: 'Permite pedir recursos o priorizacion con evidencia de traccion.',
        expectedOutputs: ['Recomendacion ejecutiva', 'Plan de expansion o ajuste', 'Decision solicitada'],
        requirementsToAdvance: [blockedCopy],
      },
    },
    exploration: {
      0: {
        shortDescription: `Ordena incertidumbres, actores y condiciones de ${context.focus}.`,
        previewSubtitle: 'Aterriza que necesitas aprender antes de avanzar.',
        workItems: ['Incertidumbre principal', `Actores o audiencia: ${context.audience}`, 'Evidencia disponible y vacios'],
        whyItMatters: `El riesgo principal es ${context.risk}; Step 0 ayuda a no explorar demasiado amplio.`,
        expectedOutputs: ['Base inicial clara', 'Supuestos visibles', 'Preguntas para validar'],
        requirementsToAdvance: ['Completar campos minimos de Step 0', 'Definir que evidencia falta', 'Aclarar siguiente decision'],
      },
      1: {
        shortDescription: 'Valida incertidumbre, senales y supuestos criticos.',
        previewSubtitle: 'Convierte la duda inicial en preguntas validables.',
        workItems: ['Supuestos criticos', 'Senales de demanda o viabilidad', 'Evidencia que reduce incertidumbre'],
        whyItMatters: `Evita seguir explorando ${context.focus} sin senales reales.`,
        expectedOutputs: ['Pregunta de exploracion clara', 'Supuestos priorizados', 'Evidencia inicial'],
        requirementsToAdvance: [blockedCopy],
      },
      2: {
        shortDescription: 'Disena un experimento para aprender rapido.',
        previewSubtitle: 'Crea una prueba liviana antes de comprometer recursos grandes.',
        workItems: ['Hipotesis de aprendizaje', 'Experimento liviano', 'Criterio para decidir'],
        whyItMatters: 'Permite aprender con bajo costo antes de construir una solucion completa.',
        expectedOutputs: ['Experimento de aprendizaje', 'Metrica o senal esperada', 'Umbral de decision'],
        requirementsToAdvance: [blockedCopy],
      },
      3: {
        shortDescription: 'Reduce incertidumbre con evidencia.',
        previewSubtitle: 'Ejecuta la prueba y registra lo aprendido.',
        workItems: ['Resultados de la prueba', 'Aprendizajes clave', 'Incertidumbres restantes'],
        whyItMatters: `La evidencia inicial es ${context.evidence}; Step 3 busca convertirla en aprendizaje accionable.`,
        expectedOutputs: ['Evidencia de aprendizaje', 'Decision de seguir, pivotear o cerrar', 'Riesgos pendientes'],
        requirementsToAdvance: [blockedCopy],
      },
      4: {
        shortDescription: 'Decide si seguir explorando, pivotear o cerrar.',
        previewSubtitle: 'Prepara una recomendacion clara con lo aprendido.',
        workItems: ['Narrativa de aprendizaje', 'Evidencia relevante', 'Recomendacion de siguiente paso'],
        whyItMatters: 'Evita que la exploracion quede abierta sin decision.',
        expectedOutputs: ['Recomendacion ejecutiva', 'Decision solicitada', 'Plan siguiente o cierre'],
        requirementsToAdvance: [blockedCopy],
      },
    },
  };

  return PROJECT_STEPS_OVERVIEW.map(config => {
    const step = config.step as 0 | 1 | 2 | 3 | 4;
    const personalized = byType[context.type][step];
    const rawStatus = input.stepStatuses[step] ?? 'locked';
    const status = normalizeRouteStatus(rawStatus);
    const ctaLabel = step === 0
      ? rawStatus === 'current' ? 'Empezar Step 0' : rawStatus === 'completed' ? 'Ver Step 0' : 'Continuar Step 0'
      : status === 'locked' ? 'Preview' : rawStatus === 'completed' ? `Ver Step ${step}` : `Continuar Step ${step}`;

    return {
      step,
      title: config.shortTitle,
      shortDescription: personalized.shortDescription,
      previewTitle: `Step ${step}: ${config.title}`,
      previewSubtitle: personalized.previewSubtitle,
      workItems: personalized.workItems.slice(0, 5),
      whyItMatters: personalized.whyItMatters,
      expectedOutputs: personalized.expectedOutputs.slice(0, 5),
      requirementsToAdvance: personalized.requirementsToAdvance.slice(0, 5),
      status,
      ctaLabel,
    };
  });
}

const STEP_STATUS_COPY: Record<ProjectStepOverviewStatus, { label: string; badge: string; card: string; dot: string }> = {
  current: {
    label: 'Estás aquí',
    badge: 'bg-indigo-100 text-indigo-700',
    card: 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-100',
    dot: 'bg-indigo-600 text-white',
  },
  completed: {
    label: 'Completado',
    badge: 'bg-emerald-100 text-emerald-700',
    card: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-600 text-white',
  },
  available: {
    label: 'Disponible',
    badge: 'bg-slate-100 text-slate-700',
    card: 'border-slate-200 bg-white hover:border-indigo-200',
    dot: 'bg-white text-slate-700 border border-slate-200',
  },
  locked: {
    label: 'Bloqueado',
    badge: 'bg-slate-100 text-slate-500',
    card: 'border-slate-200 bg-slate-50',
    dot: 'bg-white text-slate-400 border border-slate-200',
  },
  review_pending: {
    label: 'Pendiente de validación',
    badge: 'bg-amber-100 text-amber-700',
    card: 'border-amber-200 bg-amber-50',
    dot: 'bg-amber-500 text-white',
  },
  blocked: {
    label: 'Bloqueado',
    badge: 'bg-red-100 text-red-700',
    card: 'border-red-200 bg-red-50',
    dot: 'bg-red-500 text-white',
  },
};

function InfoBlock({ title, items, tone }: { title: string; items: string[]; tone: 'indigo' | 'emerald' | 'amber' | 'slate' }) {
  const toneClasses = {
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-900',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-white text-slate-800',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-xs uppercase tracking-[0.08em]" style={{ fontWeight: 800 }}>{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map(item => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEP_PREVIEW_BASE: Record<number, {
  goal: string;
  asksFor: string[];
  expectedOutput: string[];
  prerequisite: string;
}> = {
  0: {
    goal: 'Ordenar el punto de partida antes de pedir tiempo, apoyo o avance.',
    asksFor: ['Qué quieres mover', 'Por qué importa ahora', 'A quién impacta', 'Qué evidencia o señal existe', 'Qué decisión o apoyo necesitas'],
    expectedOutput: ['Base inicial compartible', 'Contexto y alcance claros', 'Primer criterio para decidir si avanzar'],
    prerequisite: 'Puedes empezar este paso desde el overview.',
  },
  1: {
    goal: 'Definir y validar el foco real de la iniciativa antes de diseñar solución.',
    asksFor: ['Foco del reto', 'Evidencia disponible', 'Actores involucrados', 'Restricciones', 'Criterio de éxito'],
    expectedOutput: ['Foco validado', 'Mapa de evidencia y actores', 'Criterio de avance hacia solución'],
    prerequisite: 'Completa tu base inicial para desbloquear este paso.',
  },
  2: {
    goal: 'Convertir el foco validado en una apuesta clara y un experimento medible.',
    asksFor: ['Ideas de solución', 'Hipótesis', 'Métrica principal', 'Diseño del experimento', 'Umbral Go/No-Go'],
    expectedOutput: ['Apuesta priorizada', 'Experimento diseñado', 'Métrica y umbral de decisión'],
    prerequisite: 'Necesitas el Step 1 aprobado para diseñar desde evidencia.',
  },
  3: {
    goal: 'Ejecutar la prueba, capturar evidencia y decidir con aprendizaje real.',
    asksFor: ['Registro de ejecución', 'Resultados contra métrica', 'Evidencia observada', 'Aprendizajes', 'Decisión recomendada'],
    expectedOutput: ['Evidencia de ejecución', 'Lectura de resultados', 'Decisión de continuar, ajustar o cerrar'],
    prerequisite: 'Necesitas el experimento diseñado y aprobado en Step 2.',
  },
  4: {
    goal: 'Cerrar el aprendizaje y preparar una propuesta clara para sponsor o comité.',
    asksFor: ['Narrativa del caso', 'Evidencia seleccionada', 'Recomendación', 'Decisión solicitada', 'Plan siguiente'],
    expectedOutput: ['Historia ejecutiva', 'Recomendación defendible', 'Plan de acción o cierre'],
    prerequisite: 'Necesitas aprendizajes y resultados del Step 3.',
  },
};

const STEP_TYPE_ADAPTATION: Record<ChallengeType, Record<number, string[]>> = {
  correction: {
    0: ['Aterriza la fricción operativa que quieres corregir y el costo actual de dejarla igual.'],
    1: ['Define foco del problema, evidencia del dolor actual y restricciones operativas.'],
    2: ['Diseña una mejora acotada para reducir demora, error, retrabajo o fricción.'],
    3: ['Mide si la corrección reduce el dolor sin crear una carga nueva para el equipo.'],
    4: ['Presenta el problema corregido, la evidencia de mejora y el costo de escalar o no escalar.'],
  },
  growth: {
    0: ['Aclara la oportunidad a capturar, la métrica que quieres mover y el segmento afectado.'],
    1: ['Valida segmento, canal, comportamiento actual y señal de crecimiento más relevante.'],
    2: ['Diseña una apuesta para aumentar adopción, conversión, uso, ventas o retención.'],
    3: ['Observa si aparece señal de crecimiento y qué palanca parece explicar el cambio.'],
    4: ['Cuenta la oportunidad, la evidencia de tracción y la decisión para ampliar o ajustar.'],
  },
  exploration: {
    0: ['Declara qué incertidumbre quieres reducir y qué aprendizaje haría útil seguir.'],
    1: ['Define la pregunta de exploración, supuestos críticos y señales de demanda o viabilidad.'],
    2: ['Diseña una prueba liviana para aprender antes de comprometer recursos grandes.'],
    3: ['Evalúa qué aprendiste, qué sigue incierto y si conviene seguir, pivotear o cerrar.'],
    4: ['Presenta aprendizajes, evidencia disponible y recomendación para la siguiente decisión.'],
  },
};

function getStepPreviewModel(
  stepNumber: number,
  challengeType: ChallengeType | undefined,
  focus: string,
  evidence: string,
  risk: string,
) {
  const base = STEP_PREVIEW_BASE[stepNumber] ?? STEP_PREVIEW_BASE[0];
  const type = challengeType ?? 'exploration';
  const typeCopy = STEP_TYPE_ADAPTATION[type][stepNumber] ?? [];

  return {
    ...base,
    adapted: [
      `Tipo de reto detectado: ${CHALLENGE_TYPE_LABELS[type]}.`,
      focus ? `Foco actual: ${focus}.` : 'Foco actual: pendiente de precisar en Step 0.',
      ...typeCopy,
      evidence ? `Señal o evidencia relevante: ${evidence}.` : 'Señal o evidencia relevante: pendiente de validar.',
      risk ? `Riesgo a cuidar: ${risk}.` : 'Riesgo a cuidar: no asumir validación antes de generar evidencia.',
    ],
  };
}

function InitialReviewArtifactDrawer({
  artifact,
  open,
  tab,
  onTabChange,
  onClose,
}: InitialReviewArtifactDrawerProps) {
  if (!open) return null;

  const onePagerRows = [
    ['Nombre', artifact.onePager.title],
    ['Que quiere mover', artifact.onePager.whatToMove],
    ['Tipo de reto', CHALLENGE_TYPE_LABELS[artifact.onePager.challengeType]],
    ['Por que importa ahora', artifact.onePager.whyNow],
    ['A quien impacta', artifact.onePager.impactedAudience],
    ['Evidencia inicial disponible', artifact.onePager.initialEvidence],
    ['Riesgo principal', artifact.onePager.mainRisk],
    ['Ruta recomendada', artifact.onePager.recommendedRoute],
    ['Siguiente paso', artifact.onePager.nextStep],
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-indigo-500" style={{ fontWeight: 800 }}>Revision inicial</p>
              <h2 className="mt-1 text-lg text-slate-950" style={{ fontWeight: 800 }}>Artefacto guardado</h2>
              <p className="mt-1 text-sm text-slate-500">Usada para crear esta iniciativa.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onTabChange('onePager')}
              className={`rounded-full px-4 py-2 text-sm ${tab === 'onePager' ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              style={{ fontWeight: 800 }}
            >
              One-pager inicial
            </button>
            <button
              type="button"
              onClick={() => onTabChange('conversation')}
              className={`rounded-full px-4 py-2 text-sm ${tab === 'conversation' ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              style={{ fontWeight: 800 }}
            >
              Conversacion
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          {tab === 'onePager' ? (
            <div className="space-y-4">
              {onePagerRows.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400" style={{ fontWeight: 800 }}>{label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">{value || 'Pendiente'}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.08em] text-amber-700" style={{ fontWeight: 800 }}>Preguntas pendientes</p>
                {artifact.onePager.pendingQuestions.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                    {artifact.onePager.pendingQuestions.map(question => <li key={question}>- {question}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-amber-900">Sin preguntas pendientes registradas.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-sm text-indigo-950" style={{ fontWeight: 800 }}>Usada para crear esta iniciativa</p>
                <p className="mt-1 text-xs text-indigo-700">Creada el {new Date(artifact.createdAt).toLocaleString()}</p>
              </div>
              {artifact.conversation.map(message => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function ProjectHomePage() {
  const { projectId } = useParams();
  const { projects, setCurrentProject, user, updateProject, getProjectMember, canAccessProject, markSponsorInvitationSent, acceptSponsorInvitation, updateSponsorTouchpoint, addSponsorComment } = useApp();
  const { challenges, strategicFronts } = usePortfolioLead();
  const navigate = useNavigate();
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorModalContext, setMentorModalContext] = useState('');
  const [showIAPanel, setShowIAPanel] = useState(false);
  const [iaPanelContext, setIaPanelContext] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [alignmentCopied, setAlignmentCopied] = useState(false);
  const [stepPreview, setStepPreview] = useState<StepPreviewState>({ selectedStepId: null, isOpen: true, source: 'auto' });
  const [initialReviewArtifactOpen, setInitialReviewArtifactOpen] = useState(false);
  const [initialReviewArtifactTab, setInitialReviewArtifactTab] = useState<InitialReviewArtifactTab>('onePager');
  const [artifactDownloadReady, setArtifactDownloadReady] = useState(false);
  const [serverAdaptiveCore, setServerAdaptiveCore] = useState<AdaptiveInitiativeCore | null>(null);
  const [adaptiveCoreStatus, setAdaptiveCoreStatus] = useState<AdaptiveCoreLoadState>('loading');
  const [adaptiveCoreError, setAdaptiveCoreError] = useState<string | null>(null);

  const loadAdaptiveCore = React.useCallback(() => {
    let cancelled = false;
    setServerAdaptiveCore(null);
    setAdaptiveCoreStatus('loading');
    setAdaptiveCoreError(null);
    if (!projectId) return () => { cancelled = true; };
    getAdaptiveCore(projectId)
      .then((core) => {
        if (!cancelled) {
          setServerAdaptiveCore(core);
          setAdaptiveCoreStatus('loaded');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerAdaptiveCore(null);
          setAdaptiveCoreStatus('error');
          setAdaptiveCoreError('No pudimos cargar el estado adaptativo persistido.');
        }
      });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    const cleanup = loadAdaptiveCore();
    return cleanup;
  }, [loadAdaptiveCore]);

  const retryAdaptiveCore = () => {
    void loadAdaptiveCore();
  };

  const project = projects.find(p => p.id === projectId);
  if (!project) return (
    <div className="p-6 text-center">
      <p className="text-slate-500">Proyecto no encontrado.</p>
      <button onClick={() => navigate('/dashboard')} className="text-indigo-600 text-sm mt-2">← Volver al inicio</button>
    </div>
  );

  const projectMember = getProjectMember(project.id, user?.email);
  const isSponsorViewer = user?.role === 'sponsor';
  const sponsorInvitationSent = projectMember?.role === 'Sponsor' && projectMember.status === 'Enviado';
  const sponsorInvitationActive = projectMember?.role === 'Sponsor' && projectMember.status === 'Activo';

  if (!canAccessProject(project.id, 'overview')) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Acceso no habilitado</p>
          <p className="text-sm text-amber-700 mt-1">
            Esta iniciativa aún no está habilitada para tu perfil sponsor. Pide que envíen la invitación o vuelve cuando tu acceso sea aceptado.
          </p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 transition-colors">
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  // PDF auto-fill (PRD-002 / TASK-009). Hook is safe to call unconditionally — if the
  // feature flag is off, the card below doesn't render but the hook state stays inert.
  const autofillEnabled = isPdfAutofillEnabled();
  const autofill = usePdfAutofill(project.id);
  // Explicit "Procesar con IA" button instead of auto-triggering on upload.
  const [uploadedPdfIds, setUploadedPdfIds] = useState<string[]>([]);
  // Option C (first-run UX): on a brand-new initiative we present a "¿cómo
  // quieres empezar?" chooser instead of dumping the PDF uploader at the top.
  // `startMode` tracks the in-page choice; `isFirstRun` (computed below) gates
  // whether the chooser is shown at all.
  const [startMode, setStartMode] = useState<'choose' | 'upload'>('choose');

  const sponsorTouchpoints = project.sponsorTouchpoints ?? [];
  const sponsorComments = project.sponsorComments ?? [];
  const sponsorProgress = Math.round(
    (project.steps.reduce((acc, step) => acc + step.progress, 0) + (project.step0Status === 'Completado' ? 100 : project.step0Status === 'En progreso' ? 50 : 0)) /
      (project.steps.length + 1)
  );

  if (isSponsorViewer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Volver a iniciativas con sponsor
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusChip status={project.status} size="sm" />
                {projectMember?.role === 'Sponsor' && <StatusChip status={projectMember.status} size="sm" />}
              </div>
              <h1 className="text-2xl text-slate-900" style={{ fontWeight: 700 }}>{project.name}</h1>
              {project.description && <p className="text-sm text-slate-500 mt-1">{project.description}</p>}
            </div>
            <div className="min-w-[180px] rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="text-xs text-indigo-700" style={{ fontWeight: 600 }}>Progreso visible</p>
              <p className="text-2xl text-indigo-900 mt-1" style={{ fontWeight: 700 }}>{sponsorProgress}%</p>
              <p className="text-xs text-indigo-700 mt-1">Seguimiento ejecutivo de la iniciativa</p>
            </div>
          </div>

          {sponsorInvitationSent && (
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>Invitación lista para aceptar</p>
              <p className="text-xs text-indigo-700 mt-1">
                El equipo ya te convocó formalmente dentro de Startería. Acepta el acceso para dejar trazabilidad del seguimiento.
              </p>
              <button
                onClick={() => acceptSponsorInvitation(project.id)}
                className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
                style={{ fontWeight: 600 }}
              >
                Aceptar acceso sponsor
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className="text-indigo-600" />
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Alertas del sponsor</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Aquí ves qué iniciativa requiere atención, en qué hito ocurre y qué acción te toca tomar.
            </p>

            <div className="space-y-3">
              {sponsorTouchpoints.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{item.stageLabel} · {item.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.date ? `Fecha registrada: ${item.date}` : 'Sin fecha confirmada'} · Acción: {item.actionLabel}
                      </p>
                    </div>
                    <StatusChip status={item.status} size="sm" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setCommentDrafts(prev => ({ ...prev, [item.id]: prev[item.id] ?? '' }))}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-white transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Dejar comentario
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={16} className="text-indigo-600" />
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Comentarios del sponsor</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Tus comentarios quedan asociados al hito correspondiente para que el equipo entienda el contexto y la siguiente acción.
            </p>

            <div className="space-y-4">
              {sponsorTouchpoints.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{item.stageLabel} · {item.title}</p>
                  <div className="space-y-2 mt-3">
                    {sponsorComments.filter(comment => comment.touchpointId === item.id).map(comment => (
                      <div key={comment.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{comment.authorName} · {comment.createdAt}</p>
                        <p className="text-xs text-slate-600 mt-1">{comment.message}</p>
                      </div>
                    ))}
                    {sponsorComments.filter(comment => comment.touchpointId === item.id).length === 0 && (
                      <p className="text-xs text-slate-400">Todavía no dejaste comentarios en este hito.</p>
                    )}
                  </div>
                  <textarea
                    value={commentDrafts[item.id] ?? ''}
                    onChange={event => setCommentDrafts(prev => ({ ...prev, [item.id]: event.target.value }))}
                    placeholder={`Escribe tu comentario para ${TOUCHPOINT_LABELS[item.id]}.`}
                    rows={3}
                    className="mt-3 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        addSponsorComment(project.id, item.id, commentDrafts[item.id] ?? '');
                        setCommentDrafts(prev => ({ ...prev, [item.id]: '' }));
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Enviar comentario
                    </button>
                    <button
                      onClick={() => setCommentDrafts(prev => ({ ...prev, [item.id]: '' }))}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-white transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Access logic ──────────────────────────────────────────────────────────

  const canAccessStep = (stepNum: number) => {
    if (isSponsorViewer) return false;
    if (stepNum === 0) return true;
    if (adaptiveCoreStatus !== 'loaded' || !serverAdaptiveCore) return false;
    if (stepNum < 0 || stepNum > 4) return false;
    return canNavigateToAdaptiveStep(serverAdaptiveCore, stepNum as 0 | 1 | 2 | 3 | 4);
  };

  const handleStepClick = (step: Step) => {
    if (isSponsorViewer) return;
    if (!canAccessStep(step.number)) return;
    setCurrentProject(project);
    navigate(`/projects/${project.id}/step/${step.number}`);
  };

  const openMentorModal = (ctx: string) => {
    setMentorModalContext(ctx);
    setShowMentorModal(true);
  };

  const openIA = (ctx: string) => {
    setIaPanelContext(ctx);
    setShowIAPanel(true);
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const completedModules = project.steps.reduce(
    (acc, s) => acc + s.modules.filter(m => m.status === 'Completado' || m.status === 'Aprobado').length, 0
  );
  const totalModules = project.steps.reduce((acc, s) => acc + s.modules.length, 0);
  const overallProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const sponsorMembers = project.team.filter(member => member.role === 'Sponsor');
  const sponsorSlotsLeft = Math.max(0, 2 - sponsorMembers.length);
  const canManageSponsors = user?.role === 'owner' || user?.role === 'admin';
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const step0Complete = project.step0Status === 'Completado';
  // First-run = fresh initiative with nothing done yet → show the start chooser
  // (Option C) instead of the always-on PDF uploader banner.
  const isFirstRun = project.step0Status === 'No iniciado' && overallProgress === 0;
  const step0Mode = getStep0Mode(project);
  const step0Data = normalizeStep0Data(project.step0Data, project, user?.name ?? '', user?.email ?? '');
  const initialReviewMeta = (project.step0Data as unknown as {
    initialReview?: {
      reviewId: string;
      challengeType?: ChallengeType;
      risk?: string;
      pendingQuestions?: string[];
      nextRecommendedStep?: string;
      artifact?: InitialReviewArtifact;
    };
  } | undefined)?.initialReview;
  const initialReview = initialReviewMeta?.reviewId ? getInitialReview(initialReviewMeta.reviewId) : null;
  const initialReviewArtifact = initialReviewMeta?.artifact
    ?? (initialReview?.output ? buildInitialReviewArtifact(initialReview, project.id) : null);
  const inheritedStep0 = buildInheritedChallengeContext(project, challenges, strategicFronts);
  const step0SummaryBlocks = getSummaryBlocks(step0Data, inheritedStep0);
  const step0ContactHint = (
    step0Mode === 'linked_to_challenge'
      ? inheritedStep0.items.find(item => item.label === 'Owner del reto')?.value || inheritedStep0.items.find(item => item.label === 'Sponsor definido')?.value || ''
      : step0Data.quienEscuchar
  ).trim();
  const step0Touchpoint = (project.sponsorTouchpoints ?? []).find(item => item.id === 'step0');
  const primarySponsorMember = sponsorMembers[0];
  const step0ActionLabel =
    step0Complete
      ? 'Ver Paso 0'
      : project.step0Status === 'En progreso'
        ? 'Continuar Paso 0'
        : 'Empezar Paso 0';
  const alignmentState =
    !step0Complete
      ? 'Pendiente de base inicial'
      : step0Touchpoint?.status === 'Cerrado'
        ? 'Reunión realizada'
        : sponsorMembers.some(member => member.status === 'Enviado')
          ? 'Invitación enviada'
          : sponsorMembers.some(member => member.status === 'Pendiente')
            ? 'Invitación pendiente'
            : sponsorMembers.some(member => member.status === 'Activo') || !!step0ContactHint
              ? 'Destinatario definido'
              : 'Sin destinatario definido';
  const nextActionLabel = !step0Complete
    ? 'Empezar Paso 0'
    : alignmentState === 'Sin destinatario definido'
      ? 'Definir contacto de alineación'
      : 'Continuar con alineación';
  const sponsorSummaryLabel =
    sponsorMembers.length === 0
      ? 'Sin sponsor definido'
      : sponsorMembers.length === 1
        ? '1 sponsor asignado'
        : `${sponsorMembers.length} sponsors asignados`;
  const step0SummaryChips = [
    step0Mode === 'linked_to_challenge' ? 'Iniciativa dentro de reto' : 'Proyecto independiente',
    step0Data.initiativeFrame ? 'Framing definido' : null,
    step0Data.primaryObjective ? 'Objetivo principal definido' : null,
    step0Data.supportNeeded?.trim() ? 'Apoyo minimo definido' : null,
  ].filter(Boolean) as string[];
  const alignmentMessage = [
    `Proyecto: ${project.name}`,
    ...step0SummaryBlocks.slice(0, 6).map(block => `${block.label}: ${block.value}`),
    step0ContactHint ? `Contacto clave sugerido: ${step0ContactHint}` : null,
  ].filter(Boolean).join('\n');
  const adaptiveCore = adaptiveCoreStatus === 'loaded' ? serverAdaptiveCore : null;
  const adaptiveJourney = adaptiveCore
    ? buildAdaptiveJourney(project, adaptiveCore, (stepNumber) => {
      if (isSponsorViewer) return false;
      return stepNumber === 0 || canAccessStep(stepNumber);
    })
    : [];
  const currentAdaptiveJourneyStep = adaptiveJourney.length > 0 ? getCurrentAdaptiveJourneyStep(adaptiveJourney) : null;
  const currentJourneyStep = currentAdaptiveJourneyStep?.step ?? 0;
  const selectedStepNumber = stepPreview.selectedStepId ? Number(stepPreview.selectedStepId) : currentJourneyStep;
  const getStepOverviewState = (stepNumber: number) => {
    const adaptiveStep = adaptiveJourney.find(item => item.step === stepNumber) ?? null;
    const legacyConfig = PROJECT_STEPS_OVERVIEW.find(item => item.step === stepNumber) ?? PROJECT_STEPS_OVERVIEW[0];
    const config = {
      ...legacyConfig,
      title: adaptiveStep?.title ?? legacyConfig.title,
      shortTitle: adaptiveStep?.shortTitle ?? `Step ${stepNumber}`,
      shortDescription: adaptiveStep?.description ?? legacyConfig.shortDescription,
      whatItSolves: adaptiveStep?.objective ?? legacyConfig.whatItSolves,
      output: adaptiveStep?.expectedOutput ?? legacyConfig.output,
      requirements: adaptiveStep?.nextAction ?? 'Estado adaptativo pendiente de cargar desde backend.',
      ctaStart: stepNumber === 0 ? 'Empezar Step 0 adaptativo' : `Continuar Step ${stepNumber}`,
      ctaContinue: stepNumber === 0 ? 'Continuar Step 0 adaptativo' : `Continuar Step ${stepNumber}`,
    };
    const appStep = project.steps.find(item => item.number === stepNumber);
    let status: ProjectStepOverviewStatus = (adaptiveStep?.status as ProjectStepOverviewStatus | undefined) ?? 'locked';
    let lockReason = adaptiveStep?.nextAction
      ?? (adaptiveCoreStatus === 'loading'
        ? 'Cargando estado adaptativo persistido desde backend.'
        : 'Estado adaptativo no disponible. Reintenta para recuperar checkpoints, progreso y desbloqueos.');

    if (stepNumber === 0) {
      status = step0Complete ? 'completed' : 'current';
      lockReason = '';
    } else if (appStep?.status === 'Aprobado') {
      status = 'completed';
    } else if (appStep?.status === 'Enviado' || appStep?.status === 'Feedback IA' || appStep?.status === 'Sesión experto pendiente') {
      status = 'review_pending';
    } else if (appStep?.status === 'Bloqueado') {
      status = canAccessStep(stepNumber) ? 'blocked' : 'locked';
    } else if (canAccessStep(stepNumber)) {
      status = currentJourneyStep === stepNumber || appStep?.status === 'En progreso' ? 'current' : 'available';
    }
    status = (adaptiveStep?.status as ProjectStepOverviewStatus | undefined) ?? 'locked';
    lockReason = adaptiveStep?.nextAction ?? lockReason;

    const completedModules = stepNumber === 0
      ? step0Complete
        ? ['Base inicial completada', ...(step0SummaryChips.length ? step0SummaryChips : ['Contexto inicial ordenado'])]
        : []
      : adaptiveStep?.status === 'completed'
        ? [`${adaptiveStep.expectedOutput} confirmado`]
        : appStep?.modules.filter(module => module.status === 'Completado' || module.status === 'Aprobado').map(module => module.name) ?? [];
    const pendingModules = stepNumber === 0
      ? step0Complete
        ? step0Data.leaderFeedbackStatus && step0Data.leaderFeedbackStatus !== 'pending'
          ? []
          : ['Feedback del líder pendiente o por actualizar']
        : ['Completar base, impacto y decisión inicial']
      : adaptiveStep?.checkpointSummary.length
        ? adaptiveStep.checkpointSummary
        : appStep?.modules.filter(module => module.status !== 'Completado' && module.status !== 'Aprobado').map(module => module.name) ?? [];

    return {
      config,
      appStep,
      adaptiveStep,
      status,
      lockReason,
      completionBullets: completedModules,
      pendingBullets: pendingModules,
      canNavigate: adaptiveStep?.canNavigate ?? false,
    };
  };
  const journeySteps = (adaptiveJourney.length > 0 ? adaptiveJourney.map(item => item.step) : PROJECT_STEPS_OVERVIEW.map(item => item.step))
    .map(step => getStepOverviewState(step));
  const selectedStepOverview = getStepOverviewState(selectedStepNumber);
  const selectedStepStyle = STEP_STATUS_COPY[selectedStepOverview.status];
  const selectedStepIsComplete = selectedStepOverview.status === 'completed';
  const challengeTypeFromStep0 = initialReviewMeta?.challengeType
    ?? (step0Data.initiativeFrame === 'correccion'
      ? 'correction'
      : step0Data.initiativeFrame === 'crecimiento'
        ? 'growth'
        : step0Data.initiativeFrame === 'exploracion'
          ? 'exploration'
          : undefined);
  const initiativeFocus = (
    step0Data.quePasaQueQuieres
    || step0Data.initiativeTitle
    || initialReview?.output?.understandingSummary
    || project.description
    || project.name
  ).trim();
  const initiativeEvidence = (
    step0Data.currentEvidence
    || step0Data.validationSignal
    || initialReview?.answers?.evidence
    || ''
  ).trim();
  const initiativeRisk = (
    initialReviewMeta?.risk
    || initialReview?.output?.critique.risky
    || initialReview?.answers?.riskContext
    || ''
  ).trim();
  const selectedStepPreview = getStepPreviewModel(
    selectedStepNumber,
    challengeTypeFromStep0,
    initiativeFocus,
    initiativeEvidence,
    initiativeRisk,
  );
  const personalizedStepRoute = buildPersonalizedStepRoute({
    initiative: project,
    initialReviewSnapshot: initialReviewArtifact,
    challengeType: challengeTypeFromStep0,
    focus: initiativeFocus,
    evidence: initiativeEvidence,
    risk: initiativeRisk,
    stepStatuses: journeySteps.reduce<Record<number, ProjectStepOverviewStatus>>((acc, item) => {
      acc[item.config.step] = item.status;
      return acc;
    }, {}),
  });
  const selectedPersonalizedStep = {
    ...(personalizedStepRoute.find(item => item.step === selectedStepNumber) ?? personalizedStepRoute[0]),
    title: selectedStepOverview.adaptiveStep?.title ?? selectedStepOverview.config.title,
    shortDescription: selectedStepOverview.adaptiveStep?.description ?? selectedStepOverview.config.shortDescription,
    previewTitle: `Step ${selectedStepNumber}: ${selectedStepOverview.adaptiveStep?.title ?? selectedStepOverview.config.title}`,
    previewSubtitle: selectedStepOverview.adaptiveStep?.nextAction ?? selectedStepOverview.lockReason,
    workItems: selectedStepOverview.adaptiveStep?.checkpointSummary.length
      ? selectedStepOverview.adaptiveStep.checkpointSummary
      : [selectedStepOverview.adaptiveStep?.objective ?? selectedStepOverview.config.whatItSolves],
    whyItMatters: selectedStepOverview.adaptiveStep?.objective ?? selectedStepOverview.config.whatItSolves,
    expectedOutputs: [selectedStepOverview.adaptiveStep?.expectedOutput ?? selectedStepOverview.config.output],
    requirementsToAdvance: [
      selectedStepOverview.adaptiveStep?.activeCheckpointCode
        ? `${selectedStepOverview.adaptiveStep.activeCheckpointCode}: ${selectedStepOverview.adaptiveStep.activeCheckpointTitle ?? 'checkpoint activo'}`
        : selectedStepOverview.adaptiveStep?.nextAction ?? selectedStepOverview.lockReason,
      selectedStepOverview.adaptiveStep
        ? `${selectedStepOverview.adaptiveStep.questionsCount} preguntas materializadas para esta ruta`
        : 'Checkpoint persistido pendiente de cargar desde backend.',
    ],
    ctaLabel: selectedStepOverview.config.ctaContinue,
  };
  const selectedStepCta = selectedStepOverview.status === 'completed'
    ? `Editar Paso ${selectedStepNumber}`
    : selectedStepOverview.appStep?.status === 'En progreso' || project.step0Status === 'En progreso'
      ? selectedStepOverview.config.ctaContinue
      : selectedStepOverview.config.ctaStart;
  const navigateToJourneyStep = (stepNumber: number) => {
    if (isSponsorViewer) return;
    if (stepNumber === 0) {
      openStep0();
      return;
    }
    if (!canAccessStep(stepNumber)) return;
    setCurrentProject(project);
    navigate(`/projects/${project.id}/step/${stepNumber}`);
  };
  const addSponsor = () => {
    const email = sponsorEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSponsorError('Ingresa un correo válido para el sponsor.');
      return;
    }
    if (sponsorMembers.length >= 2) {
      setSponsorError('Esta iniciativa ya tiene el máximo de 2 sponsors.');
      return;
    }
    if (project.team.some(member => member.email.toLowerCase() === email)) {
      setSponsorError('Ese correo ya forma parte de la iniciativa.');
      return;
    }

    updateProject(project.id, { team: [...project.team, createTeamMember(email, 'Sponsor', 'Pendiente')] });
    setSponsorEmail('');
    setSponsorError(null);
  };

  const openStep0 = () => {
    setCurrentProject(project);
    navigate(`/projects/${project.id}/step/0`);
  };

  const openInitialReviewArtifact = (tab: InitialReviewArtifactTab) => {
    setInitialReviewArtifactTab(tab);
    setInitialReviewArtifactOpen(true);
  };

  const downloadInitialReviewOnePager = () => {
    if (!initialReviewArtifact) return;
    const onePager = initialReviewArtifact.onePager;
    const markdown = [
      `# ${onePager.title}`,
      '',
      `**Que quiere mover**`,
      onePager.whatToMove,
      '',
      `**Tipo de reto sugerido**`,
      CHALLENGE_TYPE_LABELS[onePager.challengeType],
      '',
      `**Por que importa ahora**`,
      onePager.whyNow,
      '',
      `**A quien impacta**`,
      onePager.impactedAudience,
      '',
      `**Evidencia inicial**`,
      onePager.initialEvidence,
      '',
      `**Riesgo principal**`,
      onePager.mainRisk,
      '',
      `**Preguntas pendientes**`,
      ...(onePager.pendingQuestions.length ? onePager.pendingQuestions.map(question => `- ${question}`) : ['- Sin preguntas pendientes registradas.']),
      '',
      `**Ruta recomendada**`,
      onePager.recommendedRoute,
      '',
      `**Siguiente paso**`,
      onePager.nextStep,
      '',
    ].join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${onePager.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'one-pager-inicial'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setArtifactDownloadReady(true);
    window.setTimeout(() => setArtifactDownloadReady(false), 2200);
  };

  const openAlignmentSection = () => {
    document.getElementById('alignment-next')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePrimaryAction = () => {
    if (!step0Complete) {
      openStep0();
      return;
    }
    openAlignmentSection();
  };

  const copyAlignmentSummary = async () => {
    await navigator.clipboard.writeText(alignmentMessage);
    setAlignmentCopied(true);
    window.setTimeout(() => setAlignmentCopied(false), 2000);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> Mis proyectos
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex-1 min-w-0 pr-4">
          <p className="mb-2 text-sm text-indigo-600" style={{ fontWeight: 600 }}>
            {firstName ? `${firstName}, bienvenida a tu iniciativa` : 'Bienvenida a tu iniciativa'}
          </p>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusChip status={project.status} />
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-500" style={{ fontWeight: 600 }}>
              {overallProgress}% de avance
            </span>
            {project.riskLevel === 'Alto' && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                <AlertTriangle size={10} /> Riesgo alto
              </span>
            )}
          </div>
          <h1 className="text-2xl text-slate-900" style={{ fontWeight: 700 }}>{project.name}</h1>
          {initialReviewMeta && <p className="mt-1 text-sm text-slate-500">Iniciativa creada desde una revision inicial. Empieza completando el Step 0.</p>}
          {/*
            Aquí vas a ordenar el contexto, diseñar una solución, probarla en pequeño y preparar una propuesta con mayor claridad. No necesitas tener todo resuelto desde el inicio.
          */}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {!isSponsorViewer && (
            <button
              onClick={() => navigate(`/projects/${project.id}/evidencias`)}
              className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <FileText size={14} /> Evidencias
            </button>
          )}
          <button
            onClick={() => setShowTeamModal(true)}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm transition-colors"
          >
            <Users size={14} /> Equipo
          </button>
        </div>
      </div>

      {initialReviewMeta && !isSponsorViewer && (
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-indigo-950" style={{ fontWeight: 800 }}>Tu one-pager inicial esta listo</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-800">
                Starteria guardo la primera lectura de tu iniciativa. Revisala o descargala antes de completar el Step 0.
              </p>
              <p className="mt-1 text-sm text-indigo-700">Step 0 usara esta base como punto de partida.</p>
            </div>
            <button
              type="button"
              onClick={openStep0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700"
              style={{ fontWeight: 800 }}
            >
              <ClipboardList size={15} /> Empezar Step 0
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-indigo-100 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-400">Tipo de reto</p>
              <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 800 }}>
                {CHALLENGE_TYPE_LABELS[initialReviewMeta.challengeType ?? initialReviewArtifact?.onePager.challengeType ?? 'exploration']}
              </p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-400">Riesgo principal</p>
              <p className="mt-2 text-sm leading-5 text-slate-700">{initialReviewMeta.risk || 'Definicion aun amplia o basada en intuicion.'}</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.08em] text-indigo-400">Pendientes clave</p>
              <p className="mt-2 text-sm leading-5 text-slate-700">
                {(initialReviewMeta.pendingQuestions?.length ?? 0) > 0
                  ? initialReviewMeta.pendingQuestions?.slice(0, 3).map(question => question.replace(/:.*$/, '')).join(', ')
                  : 'Validar senal real, usuario afectado y evidencia inicial.'}
              </p>
            </div>
          </div>
          {initialReviewArtifact && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => openInitialReviewArtifact('onePager')} className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50" style={{ fontWeight: 800 }}>Ver one-pager</button>
              <button
                type="button"
                onClick={downloadInitialReviewOnePager}
                className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
                style={{ fontWeight: 800 }}
              >
                Descargar
              </button>
              {artifactDownloadReady && <span className="self-center text-xs text-indigo-700">Descarga del one-pager preparada.</span>}
            </div>
          )}
        </div>
      )}

      {isSponsorViewer && (
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>Vista de seguimiento sponsor</p>
          <p className="text-xs text-indigo-700 mt-1">
            Aquí puedes seguir hitos, estado general y convocatorias. El contenido operativo de steps y evidencias queda protegido para este rol.
          </p>
          {sponsorInvitationSent && (
            <button
              onClick={() => acceptSponsorInvitation(project.id)}
              className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
              style={{ fontWeight: 600 }}
            >
              Aceptar acceso sponsor
            </button>
          )}
          {sponsorInvitationActive && (
            <p className="mt-3 text-xs text-indigo-700">Tu acceso sponsor ya está activo para esta iniciativa.</p>
          )}
        </div>
      )}

      <div className="hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="rounded-full bg-white px-3 py-1 text-xs text-indigo-700 border border-indigo-100" style={{ fontWeight: 600 }}>
            {step0Complete
              ? firstName ? `${firstName}, base inicial lista` : 'Base inicial lista'
              : firstName ? `${firstName}, bienvenida a tu iniciativa` : 'Bienvenida a tu iniciativa'}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 border border-slate-200" style={{ fontWeight: 600 }}>
            {step0Complete ? 'Siguiente hito: alineación' : overallProgress > 0 ? `${overallProgress}% de avance` : 'Primer ingreso'}
          </span>
        </div>
        <h2 className="text-2xl text-slate-900 max-w-3xl" style={{ fontWeight: 700 }}>
          {step0Complete
            ? step0Mode === 'linked_to_challenge'
              ? 'Ya tienes una base para justificar esta iniciativa dentro del reto. Ahora toca alinearla y continuar con el Paso 1.'
              : 'Ya tienes una base inicial. Ahora toca alinearla con la persona clave y continuar con el Paso 1.'
            : 'Convierte este proyecto en una iniciativa clara, probada y lista para presentar.'}
        </h2>
        <p className="text-sm text-slate-600 mt-3 max-w-3xl">
          {step0Complete
            ? step0Mode === 'linked_to_challenge'
              ? 'Ya ordenaste el aporte puntual de esta iniciativa dentro del reto, conectaste su justificacion con el contexto heredado y definiste el destrabe que necesitas.'
              : 'Ordenaste el contexto inicial, identificaste impacto y definiste el apoyo mínimo para mover la iniciativa. El siguiente hito es compartir esta base para destrabar el tramo que sigue.'
            : 'Aquí vas a ordenar el contexto, diseñar una solución, probarla en pequeño y preparar una propuesta con mayor claridad. No necesitas tener todo resuelto desde el inicio.'}
        </p>
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={handlePrimaryAction}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm text-white hover:bg-indigo-700 transition-colors"
            style={{ fontWeight: 600 }}
          >
            <ClipboardList size={16} /> {nextActionLabel}
          </button>
          <button
            onClick={() => document.getElementById('project-journey')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            style={{ fontWeight: 600 }}
          >
            <ChevronDown size={16} /> {step0Complete ? 'Ver recorrido' : 'Ver cómo funciona'}
          </button>
        </div>
      </div>

      {/* ─── Option C: first-run "¿cómo quieres empezar?" chooser ─── */}
      {isFirstRun && startMode === 'choose' && (
        <InitiativeStartChooser
          autofillEnabled={autofillEnabled}
          onChooseManual={openStep0}
          onChooseUpload={() => setStartMode('upload')}
        />
      )}

      {/* ─── PDF auto-fill (PRD-002 / SPEC-002) — gated by feature flag. On a
           first-run initiative it only appears once the user picks "Tengo un
           documento"; returning users keep direct access. ─── */}
      {autofillEnabled && (!isFirstRun || startMode === 'upload') && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 mb-6">
          {isFirstRun && startMode === 'upload' && (
            <button
              type="button"
              onClick={() => setStartMode('choose')}
              className="mb-3 inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors"
            >
              <ChevronRight size={13} className="rotate-180" /> Elegir otra forma de empezar
            </button>
          )}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                ¿Tienes un documento de tu iniciativa?
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                Sube un PDF (plan, propuesta, deck, investigación) y un agente IA
                intentará rellenar los campos de los Pasos 0–4 con tu evidencia.
                Tú revisas y confirmas cada campo antes de avanzar.
              </p>
            </div>
          </div>

          <PdfInitiativeUploader
            initiativeId={project.id}
            onUploadComplete={(pdfId) => {
              setUploadedPdfIds((prev) => (prev.includes(pdfId) ? prev : [...prev, pdfId]));
            }}
          />

          {uploadedPdfIds.length > 0 && autofill.status === 'idle' && (
            <button
              type="button"
              onClick={() => {
                const lastPdfId = uploadedPdfIds[uploadedPdfIds.length - 1];
                void autofill.startExtraction(lastPdfId, 'all');
              }}
              className="mt-3 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm transition-colors"
              style={{ fontWeight: 600 }}
              data-testid="autofill-process-button"
            >
              <Sparkles size={16} />
              Procesar con IA y rellenar Pasos
            </button>
          )}

          {autofill.status === 'running' && (
            <p className="mt-3 text-xs text-amber-700 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Extrayendo evidencia del PDF… (~30s)
            </p>
          )}
          {autofill.status === 'done' && (
            <p className="mt-3 text-xs text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              Listo: {autofill.proposals.length} campo(s) propuesto(s). Entra al Paso 0 para revisarlos.
            </p>
          )}
          {autofill.status === 'failed' && autofill.error && (
            <p className="mt-3 text-xs text-rose-700 flex items-center gap-1.5">
              <AlertCircle size={12} />
              {autofill.error.message}
            </p>
          )}
        </div>
      )}

      {sponsorMembers.length === 0 ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Sponsor</h3>
              <p className="mt-1 max-w-2xl text-xs text-slate-500">
                Puedes agregar una persona que acompañe momentos clave del proyecto y ayude a darle respaldo. No necesitas definirlo ahora.
              </p>
            </div>
            {canManageSponsors && (
              <div className="flex min-w-[280px] gap-2">
                <input
                  type="email"
                  value={sponsorEmail}
                  onChange={event => { setSponsorEmail(event.target.value); setSponsorError(null); }}
                  onKeyDown={event => event.key === 'Enter' && addSponsor()}
                  placeholder="sponsor@empresa.com"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={addSponsor} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700" style={{ fontWeight: 700 }}>
                  Agregar
                </button>
              </div>
            )}
          </div>
          {sponsorError && <p className="mt-2 text-xs text-red-600">{sponsorError}</p>}
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {sponsorMembers.map(member => (
            <button
              key={member.email}
              onClick={() => setShowTeamModal(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <User size={15} />
              </span>
              <span>
                <span className="block text-xs text-slate-900" style={{ fontWeight: 700 }}>{member.name}</span>
                <span className="block text-[11px] text-slate-500">Sponsor · {member.status}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-indigo-100 bg-white p-4">
        <p className="text-sm text-slate-950" style={{ fontWeight: 800 }}>Este es tu espacio de trabajo.</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Aqui vas a desarrollar paso a paso la ruta que definiste con Starteria, empezando por ordenar la base inicial de tu iniciativa.
        </p>
      </div>

      <div id="project-journey" className="rounded-2xl border border-slate-200 bg-white p-5 mb-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base text-slate-900" style={{ fontWeight: 700 }}>Recorrido del proyecto</h2>
            <p className="mt-1 text-sm text-slate-500">
              {currentAdaptiveJourneyStep?.nextAction
                ?? (adaptiveCoreStatus === 'loading'
                  ? 'Cargando estado adaptativo persistido desde backend.'
                  : 'Estado adaptativo no disponible. Reintenta para recuperar checkpoints, progreso y desbloqueos.')}
            </p>
          </div>
          {currentAdaptiveJourneyStep && (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700" style={{ fontWeight: 700 }}>
                Ruta {currentAdaptiveJourneyStep.routeType.replaceAll('_', ' ')}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700" style={{ fontWeight: 700 }}>
                Step activo: {currentJourneyStep}
              </span>
            </div>
          )}
        </div>
        {adaptiveCoreStatus !== 'loaded' && (
          <div
            role={adaptiveCoreStatus === 'error' ? 'alert' : 'status'}
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
          >
            {adaptiveCoreStatus === 'loading'
              ? 'Cargando Adaptive Core desde backend. La ruta queda bloqueada hasta recibir el estado persistido.'
              : adaptiveCoreError ?? 'Estado adaptativo no disponible.'}
            {adaptiveCoreStatus === 'error' && (
              <button
                type="button"
                onClick={retryAdaptiveCore}
                className="ml-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
                style={{ fontWeight: 700 }}
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          {journeySteps.map(({ config, status, canNavigate, adaptiveStep }) => {
            const style = STEP_STATUS_COPY[status];
            const selected = selectedStepNumber === config.step;
            return (
              <div
                key={config.step}
                onClick={() => {
                  setStepPreview({ selectedStepId: String(config.step), isOpen: true, source: 'card_click' });
                }}
                className={`min-h-[168px] rounded-2xl border p-4 text-left transition-all ${style.card} ${selected ? 'shadow-sm ring-2 ring-indigo-200' : ''}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs ${style.dot}`} style={{ fontWeight: 800 }}>
                    {status === 'completed' ? <CheckCircle2 size={16} /> : status === 'locked' || status === 'blocked' ? <Lock size={15} /> : config.step}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${style.badge}`} style={{ fontWeight: 700 }}>
                    {status === 'current' && config.step === 0 ? 'Comienza aquí' : style.label}
                  </span>
                </div>
                <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{adaptiveStep?.title ?? config.title}</p>
                <p className="mt-1 text-xs text-indigo-700" style={{ fontWeight: 600 }}>
                  {STEP_PROGRESS_QUESTION[config.step as 0 | 1 | 2 | 3 | 4]}
                </p>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{adaptiveStep?.nextAction ?? config.requirements}</p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {(adaptiveStep?.routeType ?? 'estado_persistido_pendiente').replaceAll('_', ' ')} · {adaptiveStep?.depthLevel ?? 'backend'} · {adaptiveStep?.questionsCount ?? 0} preguntas
                </p>
                <div className="mt-4 flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
                  {canNavigate && (status === 'current' || status === 'available') && (
                    <button
                      type="button"
                      onClick={() => navigateToJourneyStep(config.step)}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] text-white hover:bg-indigo-700"
                      style={{ fontWeight: 800 }}
                    >
                      {config.step === 0 ? 'Abrir Step 0 adaptativo' : `Abrir Step ${config.step}`}
                    </button>
                  )}
                  {canNavigate && status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => navigateToJourneyStep(config.step)}
                      className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-50"
                      style={{ fontWeight: 800 }}
                    >
                      Ver resumen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden mt-5">
          <div className={`rounded-2xl border p-5 ${selectedStepStyle.card}`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-3 py-1 text-xs ${selectedStepStyle.badge}`} style={{ fontWeight: 700 }}>
                  {selectedStepStyle.label}
                </span>
                <h3 className="mt-3 text-lg text-slate-900" style={{ fontWeight: 800 }}>
                  {selectedStepIsComplete ? `Paso ${selectedStepNumber} completado` : `Paso ${selectedStepNumber}: ${selectedStepOverview.config.title}`}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{selectedStepOverview.config.shortDescription}</p>
              </div>
              {selectedStepOverview.appStep?.progress ? (
                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200" style={{ fontWeight: 700 }}>
                  {selectedStepOverview.appStep.progress}% avance
                </span>
              ) : null}
            </div>

            {selectedStepIsComplete ? (
              <div className="grid gap-4 md:grid-cols-3">
                <InfoBlock title="Ya tienes" items={selectedStepOverview.completionBullets.length ? selectedStepOverview.completionBullets : ['Paso completado.']} tone="emerald" />
                <InfoBlock title="Todavía podrías mejorar" items={selectedStepOverview.pendingBullets.length ? selectedStepOverview.pendingBullets : ['No hay pendientes críticos detectados.']} tone="slate" />
                <InfoBlock title="Siguiente paso recomendado" items={[selectedStepNumber < 4 ? `Revisar el Paso ${selectedStepNumber + 1} y continuar el recorrido.` : 'Preparar el cierre ejecutivo y compartir la recomendación.']} tone="indigo" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <InfoBlock title="Qué vas a resolver" items={[selectedStepOverview.config.whatItSolves]} tone="indigo" />
                <InfoBlock title="Output esperado" items={[selectedStepOverview.config.output]} tone="slate" />
                <InfoBlock title="Para avanzar necesitas" items={[selectedStepOverview.status === 'locked' || selectedStepOverview.status === 'blocked' ? selectedStepOverview.lockReason || selectedStepOverview.config.requirements : selectedStepOverview.config.requirements]} tone={selectedStepOverview.status === 'locked' || selectedStepOverview.status === 'blocked' ? 'amber' : 'emerald'} />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {selectedStepOverview.canNavigate && selectedStepOverview.status !== 'locked' && selectedStepOverview.status !== 'blocked' ? (
                <button
                  onClick={() => navigateToJourneyStep(selectedStepNumber)}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700 transition-colors"
                  style={{ fontWeight: 700 }}
                >
                  <ClipboardList size={15} /> {selectedStepCta}
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
                  {selectedStepOverview.lockReason || 'Completa el paso anterior para desbloquearlo.'}
                </div>
              )}
              {selectedStepOverview.canNavigate && selectedStepOverview.status === 'completed' && (
                <button
                  onClick={() => navigateToJourneyStep(selectedStepNumber)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  style={{ fontWeight: 700 }}
                >
                  Ver resumen
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5">
          {stepPreview.isOpen ? (
            <div className={`rounded-2xl border p-5 ${selectedStepStyle.card}`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${selectedStepStyle.badge}`} style={{ fontWeight: 700 }}>
                      {selectedStepOverview.status === 'current' ? 'Estas aqui' : selectedStepStyle.label}
                    </span>
                    {(selectedStepOverview.status === 'locked' || selectedStepOverview.status === 'blocked') && (
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200" style={{ fontWeight: 700 }}>
                        Vista previa read-only
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-lg text-slate-900" style={{ fontWeight: 800 }}>
                    {selectedPersonalizedStep.previewTitle}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{selectedPersonalizedStep.previewSubtitle}</p>
                  {(selectedStepOverview.status === 'locked' || selectedStepOverview.status === 'blocked') && (
                    <p className="mt-2 inline-flex items-start gap-2 rounded-xl border border-amber-100 bg-white/70 px-3 py-2 text-xs text-amber-800">
                      <Lock size={12} className="mt-0.5 shrink-0" />
                      Este step se desbloqueara cuando completes el paso anterior con los minimos necesarios.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedStepOverview.appStep?.progress ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200" style={{ fontWeight: 700 }}>
                      {selectedStepOverview.appStep.progress}% avance
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setStepPreview(prev => ({ ...prev, isOpen: false }))}
                    className="rounded-full bg-white p-2 text-slate-400 ring-1 ring-slate-200 hover:text-slate-700"
                    aria-label="Cerrar vista previa"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Que vas a trabajar en este step" items={selectedPersonalizedStep.workItems} tone="indigo" />
                <InfoBlock title="Por que este step importa para tu iniciativa" items={[selectedPersonalizedStep.whyItMatters]} tone="slate" />
                <InfoBlock title="Output esperado" items={selectedPersonalizedStep.expectedOutputs} tone="emerald" />
                <InfoBlock
                  title="Para avanzar necesitas"
                  items={selectedPersonalizedStep.requirementsToAdvance}
                  tone={selectedStepOverview.status === 'locked' || selectedStepOverview.status === 'blocked' ? 'amber' : 'slate'}
                />
              </div>

              {selectedStepIsComplete && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoBlock title="Ya tienes" items={selectedStepOverview.completionBullets.length ? selectedStepOverview.completionBullets : ['Step completado.']} tone="emerald" />
                  <InfoBlock title="Todavía podrías revisar" items={selectedStepOverview.pendingBullets.length ? selectedStepOverview.pendingBullets : ['No hay pendientes críticos detectados.']} tone="slate" />
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {selectedStepOverview.canNavigate && selectedStepOverview.status !== 'locked' && selectedStepOverview.status !== 'blocked' ? (
                  <button
                    onClick={() => navigateToJourneyStep(selectedStepNumber)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700 transition-colors"
                    style={{ fontWeight: 700 }}
                  >
                    <ClipboardList size={15} /> {selectedStepIsComplete ? 'Ver detalle' : selectedPersonalizedStep.ctaLabel}
                  </button>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
                    Este step se desbloqueara cuando completes el paso anterior con los minimos necesarios.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setStepPreview({ selectedStepId: String(currentJourneyStep), isOpen: true, source: 'auto' })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  style={{ fontWeight: 700 }}
                >
                  Volver al step actual
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStepPreview(prev => ({ ...prev, isOpen: true }))}
              className="w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 hover:bg-white"
              style={{ fontWeight: 700 }}
            >
              Mostrar preview del step seleccionado
            </button>
          )}
        </div>
      </div>

      <div id="legacy-project-journey" className="hidden bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Recorrido del proyecto</h2>
            <p className="text-xs text-slate-500 mt-1">
              {step0Complete
                ? 'Ya completaste la base estrategica inicial. Ahora toca alinear esta base y continuar con el Paso 1.'
                : 'Empieza aqui. Completa la base estrategica inicial para desbloquear el Paso 1 y seguir avanzando por el recorrido completo.'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${step0Complete ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`} style={{ fontWeight: 600 }}>
            {step0Complete ? 'Base inicial completa' : 'Empieza aqui'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {INTRO_STEP_SUMMARY.map(step => (
            <div
              key={step.number}
              className={`rounded-2xl border p-4 ${
                step0Complete && step.number === '0'
                  ? 'border-emerald-200 bg-emerald-50'
                  : step0Complete && step.number === '1'
                  ? 'border-indigo-200 bg-indigo-50'
                  : step.number === '0'
                    ? 'border-indigo-200 bg-indigo-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                    step0Complete && step.number === '0'
                      ? 'bg-emerald-600 text-white'
                      : step0Complete && step.number === '1'
                        ? 'bg-indigo-600 text-white'
                      : step.number === '0'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                  style={{ fontWeight: 700 }}
                >
                  {step.number}
                </span>
                {step0Complete && step.number === '0' && (
                  <span className="text-[11px] text-emerald-700" style={{ fontWeight: 700 }}>Completado</span>
                )}
                {step0Complete && step.number === '1' && (
                  <span className="text-[11px] text-indigo-700" style={{ fontWeight: 700 }}>Siguiente</span>
                )}
                {!step0Complete && step.number === '0' && (
                  <span className="text-[11px] text-indigo-700" style={{ fontWeight: 700 }}>Empieza aquí</span>
                )}
              </div>
              <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{step.title}</p>
              <p className="text-xs text-slate-500 mt-1">{step.description}</p>
              {!step0Complete && step.number === '0' && (
                <button
                  onClick={openStep0}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs text-white hover:bg-indigo-700 transition-colors"
                  style={{ fontWeight: 700 }}
                >
                  <ClipboardList size={14} /> Empezar Paso 0
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="hidden grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 mb-6">
        <div className={`bg-white rounded-2xl border p-5 ${step0Complete ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-indigo-200 ring-1 ring-indigo-100'}`}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`px-2.5 py-1 text-xs rounded-full ${step0Complete ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`} style={{ fontWeight: 700 }}>
              {step0Complete ? 'Paso 0 completado' : 'Comienza aquí'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500" style={{ fontWeight: 600 }}>
              {project.step0Status}
            </span>
          </div>
          <h2 className="text-lg text-slate-900" style={{ fontWeight: 700 }}>
            {step0Complete
              ? step0Mode === 'linked_to_challenge'
                ? 'Ya tienes una base para justificar esta iniciativa dentro del reto'
                : 'Ya tienes una base inicial de tu iniciativa'
              : 'Paso 0: Base estrategica inicial'}
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {step0Complete
              ? step0Mode === 'linked_to_challenge'
                ? 'Ya conectaste esta iniciativa con el reto padre, aterrizaste por que merece atencion y definiste el destrabe que necesitas.'
                : 'Ordenaste el contexto inicial, identificaste impacto y definiste el apoyo mínimo para moverla.'
              : 'En 5–7 minutos vas a ordenar la base estrategica inicial de tu iniciativa. Esto te ayudará a avanzar con claridad y desbloquear el Paso 1.'}
          </p>

          {step0Complete ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {step0SummaryChips.map(chip => (
                <span key={chip} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>
                  {chip}
                </span>
              ))}
              {step0ContactHint && (
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 border border-slate-200" style={{ fontWeight: 600 }}>
                  {step0Mode === 'linked_to_challenge' ? `Actor clave heredado: ${step0ContactHint}` : `Contacto clave: ${step0ContactHint}`}
                </span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {[
                'qué quieres abordar',
                'por qué importa',
                'a quién impacta',
                'qué evidencia ya tienes',
              ].map(item => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{item}</p>
                </div>
              ))}
            </div>
          )}

          {!step0Complete && (
            <button
              onClick={openStep0}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm text-white hover:bg-indigo-700 transition-colors"
              style={{ fontWeight: 600 }}
            >
              <ClipboardList size={16} /> Empezar Paso 0
            </button>
          )}
        </div>

        <div id="alignment-next" className={`bg-white rounded-2xl border p-5 ${step0Complete ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                {step0Complete ? 'Siguiente hito: alineación' : 'Sponsor'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {step0Complete
                  ? step0Mode === 'linked_to_challenge'
                    ? 'La base inicial ya te permite conversar esta iniciativa dentro del reto y pedir el destrabe correcto.'
                    : 'La base inicial ya te da suficiente claridad para compartir la iniciativa y destrabar el siguiente tramo.'
                  : 'Es la persona que acompaña momentos clave del proyecto y ayuda a darle respaldo.'}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${step0Complete ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`} style={{ fontWeight: 600 }}>
              {step0Complete ? alignmentState : sponsorSummaryLabel}
            </span>
          </div>

          {step0Complete ? (
            <>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>
                  {alignmentState === 'Sin destinatario definido' && 'Todavía falta definir con quién abrir esta conversación.'}
                  {alignmentState === 'Destinatario definido' && 'Ya tienes una persona o actor clave identificado para abrir esta conversación.'}
                  {alignmentState === 'Invitación pendiente' && 'Ya hay un destinatario claro, pero aún falta registrar el envío de la invitación de alineación.'}
                  {alignmentState === 'Invitación enviada' && 'La invitación ya fue enviada. El siguiente paso es registrar cuando ocurra la alineación.'}
                  {alignmentState === 'Reunión realizada' && 'La alineación inicial ya quedó registrada. Ahora puedes continuar con el Paso 1 con mejor contexto compartido.'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {step0ContactHint
                    ? step0Mode === 'linked_to_challenge'
                      ? `Actor clave heredado para esta conversacion: ${step0ContactHint}`
                      : `Contacto clave definido en Paso 0: ${step0ContactHint}`
                    : sponsorMembers.length > 0
                      ? 'Puedes usar el sponsor ya asignado como base para esta conversación.'
                      : 'Si no tienes sponsor aún, deja explícito quién debería escuchar esto primero y registra la alineación cuando ocurra.'}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={copyAlignmentSummary}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  <ClipboardList size={15} /> {alignmentCopied ? 'Resumen copiado' : 'Copiar base para compartir'}
                </button>
                {canManageSponsors && primarySponsorMember?.status === 'Pendiente' && (
                  <button
                    onClick={() => markSponsorInvitationSent(project.id, primarySponsorMember.email)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    Registrar invitación enviada
                  </button>
                )}
                {canManageSponsors && step0Touchpoint && step0Touchpoint.status !== 'Cerrado' && alignmentState !== 'Sin destinatario definido' && (
                  <button
                    onClick={() => updateSponsorTouchpoint(project.id, 'step0', { status: 'Cerrado' })}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    Registrar reunión realizada
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-3">
                No hay envío automático real desde esta vista. Este botón te ayuda a copiar una base clara para compartirla por tu canal habitual.
              </p>

              <details className="mt-4 group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 600 }}>
                  Ver detalle de alineación
                  <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 space-y-3">
                  {canManageSponsors && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>ASIGNAR SPONSOR</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={sponsorEmail}
                          onChange={event => { setSponsorEmail(event.target.value); setSponsorError(null); }}
                          onKeyDown={event => event.key === 'Enter' && addSponsor()}
                          placeholder="sponsor@empresa.com"
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={addSponsor}
                          disabled={sponsorSlotsLeft === 0}
                          className="bg-indigo-600 text-white rounded-xl px-3 py-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <UserPlus size={15} />
                        </button>
                      </div>
                      {sponsorError && <p className="text-xs text-red-600 mt-2">{sponsorError}</p>}
                      {!sponsorError && sponsorSlotsLeft > 0 && (
                        <p className="text-xs text-slate-400 mt-2">
                          Si la persona ya tiene cuenta, verá esta iniciativa en su dashboard. Si no, quedará como invitación pendiente.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>
                No necesitas definirlo ahora.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Podrás hacerlo más adelante, cuando tengas mejor aterrizado el contexto.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Steps list ── */}
      <div className="hidden space-y-3 mb-6">

        {/* ── PASO 0 ── */}
        <div
          className={`bg-white rounded-2xl border transition-all ${
            project.step0Status !== 'Completado'
              ? 'border-indigo-200 ring-1 ring-indigo-100'
              : 'border-slate-200'
          } ${isSponsorViewer ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:border-indigo-200 hover:shadow-sm'}`}
          onClick={() => {
            if (isSponsorViewer) return;
            openStep0();
          }}
        >
          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                  project.step0Status === 'Completado'
                    ? 'bg-emerald-100 text-emerald-700'
                    : project.step0Status === 'En progreso'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-indigo-50 text-indigo-500'
                }`}
                style={{ fontWeight: 700 }}
              >
                {project.step0Status === 'Completado' ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <ClipboardList size={16} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                    Paso 0: Base estrategica inicial
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      project.step0Status === 'Completado'
                        ? 'bg-emerald-100 text-emerald-700'
                        : project.step0Status === 'En progreso'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {project.step0Status}
                  </span>
                  {project.step0Status !== 'Completado' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>
                      Empieza aquí
                    </span>
                  )}
                  {project.step0Status === 'Completado' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontWeight: 600 }}>
                      Base lista
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {project.step0Status === 'Completado'
                    ? step0Mode === 'linked_to_challenge'
                      ? 'Ya dejaste una base para justificar esta iniciativa dentro del reto y usarla como referencia antes de entrar al Paso 1.'
                      : 'Ya dejaste una base inicial lista para compartir y usar como referencia antes de entrar al Paso 1.'
                    : 'Ordena la base estrategica inicial en 5 a 7 minutos. Este paso te ayuda a entender que estas moviendo, por que importa y que necesitas aclarar antes de seguir.'}
                </p>

                {project.step0Status !== 'Completado' && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 mb-3">
                    <p className="text-xs text-indigo-900" style={{ fontWeight: 600 }}>
                      Comienza por aquí y luego se desbloquea el Paso 1.
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      No necesitas tener todas las respuestas hoy. Solo deja una primera base clara para avanzar con menos fricción.
                    </p>
                    <button
                      onClick={event => {
                        event.stopPropagation();
                        openStep0();
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-700 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      <ClipboardList size={14} /> {step0ActionLabel}
                    </button>
                  </div>
                )}

                {project.step0Status === 'Completado' && project.step0Data && (
                  <div className="flex flex-wrap gap-1.5">
                    {project.step0Data.origen && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        ✓ Origen
                      </span>
                    )}
                    {(project.step0Data.impacta?.length ?? 0) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        ✓ Impacta a {project.step0Data.impacta!.join(', ')}
                      </span>
                    )}
                    {project.step0Data.siMinimo && project.step0Data.siMinimo.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        ✓ Sí mínimo definido
                      </span>
                    )}
                  </div>
                )}
              </div>

              <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
            </div>
          </div>
        </div>

        {/* ── PASOS 1–4 ── */}
        {project.steps.map(step => {
          const adaptiveDetail = adaptiveJourney.find(item => item.step === step.number);
          const overviewState = getStepOverviewState(step.number);
          const accessible = overviewState.canNavigate;
          const isActive = adaptiveDetail?.status === 'current' || (step.status !== 'Aprobado' && step.status !== 'No iniciado' && step.status !== 'Bloqueado');
          const hasPendingSession = step.mentorSession?.status === 'Pendiente agendar';

          return (
            <div
              key={step.number}
              className={`bg-white rounded-2xl border transition-all ${
                accessible
                  ? 'border-slate-200 hover:border-indigo-200 hover:shadow-sm cursor-pointer'
                  : 'border-slate-100 opacity-60 cursor-default'
              } ${isActive ? 'ring-1 ring-indigo-200' : ''}`}
              onClick={() => handleStepClick(step)}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Step icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                      step.status === 'Aprobado' ? 'bg-emerald-100 text-emerald-700' :
                      isActive ? 'bg-indigo-100 text-indigo-700' :
                      !accessible ? 'bg-slate-100 text-slate-400' :
                      'bg-slate-100 text-slate-500'
                    }`}
                    style={{ fontWeight: 700 }}
                  >
                    {step.status === 'Aprobado' ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : !accessible ? (
                      <Lock size={16} />
                    ) : (
                      step.number
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                        Step {step.number}: {adaptiveDetail?.title ?? step.name}
                      </h3>
                      <StatusChip status={step.status} size="sm" />
                      {adaptiveDetail && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700" style={{ fontWeight: 600 }}>
                          {adaptiveDetail.activeCheckpointCode ?? adaptiveDetail.routeType.replaceAll('_', ' ')}
                        </span>
                      )}
                      {hasPendingSession && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full" style={{ fontWeight: 500 }}>
                          <Clock size={10} /> Sesión pendiente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{adaptiveDetail?.nextAction ?? STEP_DESCRIPTIONS[step.number - 1]}</p>

                    {/* Blocked message */}
                    {!accessible && (
                      <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5 mb-3">
                        <Lock size={11} className="text-slate-400 shrink-0 mt-0.5" />
                        <span>{adaptiveDetail?.nextAction ?? BLOCK_REASONS[step.number.toString()]}</span>
                      </div>
                    )}

                    {accessible && adaptiveDetail && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {adaptiveDetail.checkpointSummary.map(item => (
                          <span key={item} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Module pills */}
                    {accessible && !adaptiveDetail && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {step.modules.map(mod => (
                          <span
                            key={mod.id}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                              mod.status === 'Completado' || mod.status === 'Aprobado'
                                ? 'bg-emerald-50 text-emerald-700'
                                : mod.status === 'En progreso'
                                ? 'bg-blue-50 text-blue-700'
                                : mod.status === 'Bloqueado'
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-slate-50 text-slate-500'
                            }`}
                          >
                            {(mod.status === 'Completado' || mod.status === 'Aprobado') && <span>✓</span>}
                            {mod.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Progress */}
                    {accessible && ((adaptiveDetail?.progress ?? step.progress) > 0) && (
                      <ProgressBar value={adaptiveDetail?.progress ?? step.progress} size="sm" />
                    )}

                    {/* Mentor actions (accessible steps) */}
                    {accessible && (
                      <div className="flex gap-2 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openIA(`Paso ${step.number} · ${step.name}`)}
                          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <Sparkles size={11} /> Mejorar con IA
                        </button>
                        <button
                          onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <MessageSquare size={11} /> Pedir ayuda
                        </button>
                        {(hasPendingSession || step.status === 'Sesión experto pendiente') && (
                          <button
                            onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Calendar size={11} /> Agendar ahora
                          </button>
                        )}
                        {!hasPendingSession && step.status !== 'Sesión experto pendiente' && (
                          <button
                            onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Calendar size={11} /> Agendar sesión
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {accessible && (
                    <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
                  )}
                </div>
              </div>

              {/* Blocked CTA */}
              {!accessible && (
                <div className="px-5 pb-4">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setCurrentProject(project);
                      if (step.number === 1) {
                        navigate(`/projects/${project.id}/step/0`);
                      } else {
                        const prevStep = project.steps.find(s => s.number === step.number - 1);
                        if (prevStep) navigate(`/projects/${project.id}/step/${prevStep.number}`);
                      }
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    {step.number === 1
                      ? '→ Ir al Paso 0 para desbloquear'
                      : `→ Ir al Paso ${step.number - 1} para desbloquear`}
                  </button>
                </div>
              )}

              {/* Pending session warning */}
              {accessible && hasPendingSession && (
                <div className="mx-5 mb-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl" onClick={e => e.stopPropagation()}>
                  <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-800" style={{ fontWeight: 500 }}>
                      Sesión de validación pendiente
                    </p>
                    <p className="text-xs text-amber-600">
                      Sin sesión, el paso no se aprueba y no se desbloquea el siguiente.
                    </p>
                  </div>
                  <button
                    onClick={() => openMentorModal(`Paso ${step.number} · ${step.name}`)}
                    className="ml-auto shrink-0 text-xs text-amber-700 hover:text-amber-900 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Agendar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-200">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-400" />
            <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>Historial de cambios</span>
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
        {showHistory && (
          <div className="px-5 pb-5 space-y-3 border-t border-slate-100">
            {[
              { action: 'Módulo B completado', user: 'Ana Rodríguez', time: 'Hoy, 10:30 AM', paso: 'Paso 1' },
              { action: 'Evidencia "Dashboard_metricas.png" subida', user: 'Ana Rodríguez', time: 'Ayer, 4:15 PM', paso: 'Paso 1 · Módulo B' },
              { action: 'Módulo A completado', user: 'Miguel Torres', time: 'Hace 3 días', paso: 'Paso 1' },
              { action: 'Base estratégica inicial completada', user: 'Ana Rodríguez', time: '19 feb 2025', paso: 'Paso 0' },
              { action: 'Proyecto creado', user: 'Ana Rodríguez', time: '19 feb 2025', paso: '' },
            ].map((entry, i) => (
              <div key={i} className="flex items-start gap-3 pt-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">{entry.action}</p>
                  <p className="text-xs text-slate-400">
                    {entry.user} · {entry.time}{entry.paso && ` · ${entry.paso}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Team Modal ── */}
      {initialReviewArtifact && !isSponsorViewer && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base text-slate-950" style={{ fontWeight: 800 }}>Artefactos de la iniciativa</h2>
            <p className="mt-1 text-sm text-slate-500">Consulta los documentos, conversaciones y salidas generadas durante el avance.</p>
          </div>
          <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-slate-900" style={{ fontWeight: 800 }}>One-pager inicial</p>
                <p className="mt-1 text-xs text-slate-500">Origen: Revision inicial</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700" style={{ fontWeight: 800 }}>Guardado</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openInitialReviewArtifact('onePager')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" style={{ fontWeight: 800 }}>Ver</button>
                <button type="button" onClick={downloadInitialReviewOnePager} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" style={{ fontWeight: 800 }}>Descargar</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-slate-900" style={{ fontWeight: 800 }}>Conversacion inicial</p>
                <p className="mt-1 text-xs text-slate-500">Origen: Chat Starteria</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700" style={{ fontWeight: 800 }}>Guardada</span>
              <button type="button" onClick={() => openInitialReviewArtifact('conversation')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" style={{ fontWeight: 800 }}>Ver</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-slate-900" style={{ fontWeight: 800 }}>Resumen Step 0</p>
                <p className="mt-1 text-xs text-slate-500">Origen: Step 0</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${step0Complete ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`} style={{ fontWeight: 800 }}>
                {step0Complete ? 'Guardado' : 'Pendiente'}
              </span>
              <button
                type="button"
                onClick={openStep0}
                disabled={!step0Complete}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ fontWeight: 800 }}
              >
                {step0Complete ? 'Ver' : 'Pendiente'}
              </button>
            </div>
          </div>
          {artifactDownloadReady && <p className="mt-3 text-xs text-emerald-700">Descarga del one-pager preparada.</p>}
        </div>
      )}

      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Equipo del proyecto</h3>
              <button onClick={() => setShowTeamModal(false)}>
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {project.team.map(member => (
                <div key={member.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700" style={{ fontWeight: 700 }}>
                    {member.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{member.name}</p>
                    <p className="text-xs text-slate-400">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{member.role}</span>
                    <StatusChip status={member.status} size="sm" />
                  </div>
                </div>
              ))}
              {user?.role === 'owner' && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Invitar por correo…"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button className="bg-indigo-600 text-white rounded-xl px-3 py-2 hover:bg-indigo-700 transition-colors">
                      <UserPlus size={15} />
                    </button>
                  </div>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                <span style={{ fontWeight: 600 }}>Acceso a evidencias: </span>
                Solo los miembros activos pueden ver las evidencias del proyecto.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mentor Support Modal ── */}
      {showMentorModal && (
        <MentorSupportModal
          onClose={() => setShowMentorModal(false)}
          context={mentorModalContext}
          mentorCredits={project.mentorCredits ?? 3}
          onOpenIA={() => { setShowMentorModal(false); openIA(mentorModalContext); }}
        />
      )}

      {/* ── IA Panel ── */}
      <MentorVirtualPanel
        open={showIAPanel}
        onClose={() => setShowIAPanel(false)}
        context={iaPanelContext}
      />
      {initialReviewArtifact && (
        <InitialReviewArtifactDrawer
          artifact={initialReviewArtifact}
          open={initialReviewArtifactOpen}
          tab={initialReviewArtifactTab}
          onTabChange={setInitialReviewArtifactTab}
          onClose={() => setInitialReviewArtifactOpen(false)}
        />
      )}
    </div>
  );
}
