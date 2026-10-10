import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Lock, Send, CheckCircle2, X, Plus,
  Calendar, Paperclip, Link, Upload, AlertCircle, Clock, Target,
  FileText, Sparkles, Edit2, BookOpen, Layers, FlaskConical,
  TrendingUp, Users, MapPin, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { enrichProject, type Project, useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { FeedbackIAPanel } from '../components/FeedbackIAPanel';
import { AutosaveIndicator, useAutosave } from '../components/AutosaveIndicator';
import { useStepData } from '../hooks/useStepData';
import * as stepService from '../services/stepService';
import { getById } from '../services/projectService';
import { LeaderFeedbackStatusCard } from '../components/LeaderFeedbackStatusCard';
import type { AdaptiveInitiativeCore } from '../../features/adaptive-core/domain/types';
import { canNavigateToAdaptiveStep, latestAdaptiveStepOutput } from '../../features/adaptive-core/domain/adaptiveAuthority';
import { AdaptiveCheckpointWorkspace } from '../../features/adaptive-core/components';
import { confirmAdaptiveCheckpoint, explainCheckpointError, confirmStep3Output, getAdaptiveCore } from '../../features/adaptive-core/services/adaptiveCoreService';

type ModuleId = 'A' | 'B' | 'C';
type GoNoGoDecision = 'Go' | 'Iterar' | 'No-Go' | 'Pivote' | null;

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Componente {
  id: string; nombre: string; proposito: string; canal: string;
  owner: string; link: string; dod: string; estado: 'Pendiente' | 'Listo';
}
interface ExperimentFormatGuide {
  queEs: string;
  cuandoConviene: string;
  aprendizaje: string;
  evidencia: string;
  ejemplo: string;
  nota?: string;
}
interface LaunchChecklistItem {
  id: string;
  titulo: string;
  nota: string;
  responsable: string;
  estado: 'pendiente' | 'listo';
  origen: 'sugerida' | 'personalizada';
}
interface InstrumentacionRow {
  id: string;
  dato: string;
  lineaBase: string;
  metricaExito: string;
  fuente: string;
  comoCapturar: string;
  dondeCapturar: string;
  responsable: string;
  evidenciaEsperada: string;
  frecuencia: string;
  estado: 'pendiente' | 'listo';
}
interface EventoBitacora {
  id: string; fecha: string; hora: string; accion: string; responsable: string; nota: string;
}
interface MallaItem {
  id: string; tipo: 'idea' | 'critica' | 'pregunta' | 'hipotesis';
  descripcion: string; evidencia: string; severidad: 'bajo' | 'medio' | 'alto' | '';
}
interface EvidenciaItem {
  id: string; tipo: 'Archivo' | 'Link' | 'Nota'; descripcion: string; fecha: string;
}
type CycleDecision = 'mantener' | 'iterar' | 'pivotear' | 'detener' | '';
interface TestCycle {
  id: string;
  nombre: string;
  estado: string;
  queValidamos: string;
  metricaPrincipal: string;
  criterioDecision: string;
  contextoPrueba: string;
  versionProbada: string;
  evidencias: EvidenciaItem[];
  bitacora: EventoBitacora[];
  hallazgos: MallaItem[];
  resultadoEsperado: string;
  resultadoObservado: string;
  aprendizaje: string;
  decision: CycleDecision;
  decisionJustificacion: string;
  siguientePaso: string;
  siguienteCambio: string;
  siguienteMetodo: string;
  siguienteCuando: string;
}
interface DeckSlide { titulo: string; bullets: string[] }

const PREP_ITEMS = [
  'Tener el formulario de Google Forms configurado y compartido con TI',
  'Definir los 5 participantes del piloto (empleados que ingresan la próxima semana)',
  'Acordar con TI el proceso de respuesta en menos de 24 horas',
  'Preparar encuesta de 3 preguntas para el empleado el día 3',
];
const FORMATOS_EXP = ['Formulario', 'Landing', 'WhatsApp', 'Prototipo', 'Concierge', 'Piloto operativo'];
const FORMATO_GUIDES: Record<string, ExperimentFormatGuide> = {
  Formulario: {
    queEs: 'Un formulario simple para recoger solicitudes, respuestas o información ordenada.',
    cuandoConviene: 'Cuando quieres validar si las personas completarían un pedido o dejarían datos.',
    aprendizaje: 'Entender interés, intención o calidad de la información que entregan.',
    evidencia: 'Respuestas enviadas, tasa de completitud y tiempos de respuesta.',
    ejemplo: 'Un formulario para centralizar pedidos de acceso a TI.',
    nota: 'Úsalo cuando necesites una forma clara y rápida de capturar datos sin construir un sistema.',
  },
  Landing: {
    queEs: 'Una página simple que explica la propuesta y busca una acción de interés.',
    cuandoConviene: 'Cuando quieres validar si la propuesta llama la atención antes de construirla.',
    aprendizaje: 'Medir interés inicial, clics, registros o intención.',
    evidencia: 'Visitas, clics, registros y conversiones.',
    ejemplo: 'Una página que presenta un nuevo servicio interno y mide cuántos se anotan.',
    nota: 'Úsalo cuando quieras ver si el mensaje engancha antes de invertir más tiempo.',
  },
  WhatsApp: {
    queEs: 'Una interacción manual o semiautomática usando mensajes.',
    cuandoConviene: 'Cuando quieres probar rápido una comunicación o atención sin construir sistema.',
    aprendizaje: 'Entender dudas, tiempos de respuesta, aceptación y fricciones.',
    evidencia: 'Mensajes, tiempos, respuestas, capturas y seguimiento.',
    ejemplo: 'Atender solicitudes por WhatsApp para validar si ese canal reduce fricción.',
    nota: 'Úsalo cuando la conversación directa sea la forma más simple de probar la hipótesis.',
  },
  Prototipo: {
    queEs: 'Una simulación de la solución para mostrar cómo funcionaría.',
    cuandoConviene: 'Cuando necesitas que alguien vea, pruebe o reaccione a una experiencia futura.',
    aprendizaje: 'Validar comprensión, utilidad percibida y puntos de fricción.',
    evidencia: 'Feedback, observaciones, grabaciones y notas de prueba.',
    ejemplo: 'Un flujo clickeable de onboarding antes de desarrollarlo.',
    nota: 'Úsalo cuando aún no conviene construir la solución real, pero sí mostrar la experiencia.',
  },
  Concierge: {
    queEs: 'Una prueba donde el servicio se hace manualmente detrás de escena.',
    cuandoConviene: 'Cuando quieres validar valor sin construir toda la operación o tecnología.',
    aprendizaje: 'Saber si la propuesta resuelve algo importante antes de automatizarla.',
    evidencia: 'Casos atendidos, tiempos, satisfacción y problemas manuales.',
    ejemplo: 'Resolver manualmente una solicitud como si el sistema ya existiera.',
    nota: 'Úsalo cuando quieres probar el valor real con poco esfuerzo técnico.',
  },
  'Piloto operativo': {
    queEs: 'Una prueba en contexto real, con personas reales y condiciones cercanas a la operación.',
    cuandoConviene: 'Cuando ya tienes suficiente claridad para ejecutar una prueba pequeña en vivo.',
    aprendizaje: 'Ver si funciona en la realidad y si cumple la meta esperada.',
    evidencia: 'Resultados operativos, tiempos, errores y cumplimiento de meta.',
    ejemplo: 'Probar el nuevo flujo con 5 personas de una sede durante una semana.',
    nota: 'Úsalo cuando ya no solo quieres reacción, sino ver ejecución real.',
  },
};
const IA_SUGERENCIAS_NEXT = [
  { titulo: 'Iterar rápido', objetivo: 'Resolver el cuello de botella de accesos especiales sin rediseñar el formulario.', cambio: 'Agregar un campo "tipo de acceso especial" + flujo de escalado a TI Senior.', evidencia: 'Medir tiempo de resolución de casos especiales en 3 nuevos empleados.', duracion: '1 semana' },
  { titulo: 'Complementar con 2da validación', objetivo: 'Confirmar que el NPS >70 se mantiene con una muestra mayor.', cambio: 'Ampliar piloto a 10 empleados con diversidad de perfiles y áreas.', evidencia: 'Encuesta NPS + entrevista breve (5 min) con 3 participantes.', duracion: '2 semanas' },
  { titulo: 'Pivote parcial de canal', objetivo: 'Probar si WhatsApp reduce el tiempo de respuesta vs el formulario.', cambio: 'Reemplazar formulario por bot de WhatsApp (Respond.io) para el 50% de los casos.', evidencia: 'Comparar tiempos formulario vs WhatsApp en el siguiente ciclo.', duracion: '2 semanas' },
];
// ── Helper components ─────────────────────────────────────────────────────────
const createInitialTestCycle = (hipotesis: string = ''): TestCycle => ({
  id: 'testeo-1',
  nombre: 'Testeo 1',
  estado: '',
  queValidamos: hipotesis,
  metricaPrincipal: '',
  criterioDecision: '',
  contextoPrueba: '',
  versionProbada: '',
  evidencias: [],
  bitacora: [],
  hallazgos: [],
  resultadoEsperado: '',
  resultadoObservado: '',
  aprendizaje: '',
  decision: '',
  decisionJustificacion: '',
  siguientePaso: '',
  siguienteCambio: '',
  siguienteMetodo: '',
  siguienteCuando: '',
});

const MODULE_A_BASE_INSTRUMENTACION: InstrumentacionRow[] = [];

const createChecklistItem = (partial?: Partial<LaunchChecklistItem>): LaunchChecklistItem => ({
  id: partial?.id ?? `check-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
  titulo: partial?.titulo ?? '',
  nota: partial?.nota ?? '',
  responsable: partial?.responsable ?? '',
  estado: partial?.estado ?? 'pendiente',
  origen: partial?.origen ?? 'personalizada',
});

const createInstrumentationRow = (partial?: Partial<InstrumentacionRow>): InstrumentacionRow => ({
  id: partial?.id ?? `inst-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
  dato: partial?.dato ?? '',
  lineaBase: partial?.lineaBase ?? '',
  metricaExito: partial?.metricaExito ?? '',
  fuente: partial?.fuente ?? '',
  comoCapturar: partial?.comoCapturar ?? '',
  dondeCapturar: partial?.dondeCapturar ?? '',
  responsable: partial?.responsable ?? '',
  evidenciaEsperada: partial?.evidenciaEsperada ?? '',
  frecuencia: partial?.frecuencia ?? '',
  estado: partial?.estado ?? 'pendiente',
});

const inferFormatFromExperiment = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('whatsapp')) return 'WhatsApp';
  if (lower.includes('landing')) return 'Landing';
  if (lower.includes('prototipo') || lower.includes('clickeable')) return 'Prototipo';
  if (lower.includes('concierge')) return 'Concierge';
  if (lower.includes('piloto')) return 'Piloto operativo';
  if (lower.includes('formulario') || lower.includes('forms')) return 'Formulario';
  return '';
};

const extractBaselineFromHypothesis = (text: string) => {
  const match = text.match(/de\s+([^.,]+?)\s+a\s+/i);
  return match?.[1]?.trim() ?? '';
};

const extractSuccessMetric = (text: string) => {
  const thresholdMatch = text.match(/Umbral[^:]*:\s*(.+)$/i);
  if (thresholdMatch?.[1]) return thresholdMatch[1].trim();
  const targetMatch = text.match(/a\s+([^.,]+(?:\d+%[^.,]*)?)/i);
  return targetMatch?.[1]?.trim() ?? '';
};

const buildSuggestedChecklist = ({
  formato,
  componentes,
  logistica,
  instrumentacion,
}: {
  formato: string;
  componentes: Componente[];
  logistica: { donde: string; cuando: string; duracion: string; quienDispara: string; contingencia: string };
  instrumentacion: InstrumentacionRow[];
}) => {
  const suggestions: Array<Partial<LaunchChecklistItem>> = [];

  if (formato === 'Formulario') {
    suggestions.push(
      {
        titulo: 'Validar que el formulario esté activo y accesible',
        nota: 'Asegúrate de que abra bien, se pueda completar y no tenga campos bloqueados.',
        responsable: componentes.find(item => item.canal.toLowerCase().includes('form'))?.owner ?? '',
      },
      {
        titulo: 'Confirmar a quiénes incluirás en la prueba',
        nota: 'Deja claros los participantes que sí entran en este experimento.',
        responsable: '',
      },
    );
  }

  if (formato === 'WhatsApp') {
    suggestions.push(
      {
        titulo: 'Confirmar quién responderá los mensajes durante la prueba',
        nota: 'Evita dejar conversaciones sin atención o sin seguimiento.',
        responsable: '',
      },
      {
        titulo: 'Definir cómo guardarás capturas o conversaciones clave',
        nota: 'Deja claro qué evidencia conservarás y dónde la subirás.',
        responsable: '',
      },
    );
  }

  if (formato === 'Prototipo') {
    suggestions.push({
      titulo: 'Validar que el prototipo cubra el flujo que vas a mostrar',
      nota: 'No necesitas simular todo; solo lo necesario para observar reacción y fricciones.',
      responsable: componentes.find(item => item.nombre.toLowerCase().includes('prototipo'))?.owner ?? '',
    });
  }

  if (formato === 'Concierge') {
    suggestions.push({
      titulo: 'Confirmar quién hará manualmente el servicio detrás de escena',
      nota: 'La ejecución manual debe estar coordinada para que la experiencia no se rompa.',
      responsable: '',
    });
  }

  if (formato === 'Piloto operativo') {
    suggestions.push({
      titulo: 'Alinear la operación mínima para correr la prueba en vivo',
      nota: 'Define qué equipo sostendrá la prueba y qué condición debe cumplirse para arrancar.',
      responsable: logistica.quienDispara,
    });
  }

  componentes
    .filter(item => item.estado !== 'Listo')
    .forEach(item => {
      suggestions.push({
        titulo: `Dejar listo: ${item.nombre}`,
        nota: item.dod || item.proposito,
        responsable: item.owner,
      });
    });

  if (logistica.quienDispara.trim()) {
    suggestions.push({
      titulo: 'Confirmar quién dispara el experimento y cómo avisa al equipo',
      nota: `Hoy aparece como referencia: ${logistica.quienDispara.trim()}.`,
      responsable: logistica.quienDispara.trim(),
    });
  }

  if (logistica.contingencia.trim()) {
    suggestions.push({
      titulo: 'Acordar qué harás si la prueba se traba',
      nota: `Ruta de contingencia definida: ${logistica.contingencia.trim()}.`,
      responsable: '',
    });
  }

  if (instrumentacion.length > 0) {
    suggestions.push({
      titulo: 'Confirmar cómo se capturará la evidencia del experimento',
      nota: 'Revisa que cada señal tenga responsable y un lugar claro de registro.',
      responsable: instrumentacion.find(item => item.responsable.trim())?.responsable ?? '',
    });
  }

  const unique = suggestions.filter((item, index, array) =>
    item.titulo && array.findIndex(current => current.titulo === item.titulo) === index
  );

  return unique.map(item => createChecklistItem({
    ...item,
    origen: 'sugerida',
  }));
};

function SectionCard({ title, icon: Icon, children, className = '' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <Icon size={14} className="text-slate-500" />
        <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{title}</p>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export function Step3Page() {
  const { projectId } = useParams();
  const { projects, projectsLoading, updateProject, user } = useApp();
  const navigate = useNavigate();
  const contextProject = projects.find(p => p.id === projectId);
  const [fetchedProject, setFetchedProject] = useState<Project | null>(null);
  const [projectFetching, setProjectFetching] = useState(false);
  const [projectFetchError, setProjectFetchError] = useState(false);
  const project = contextProject ?? fetchedProject;

  const { data: step2Raw } = useStepData<any>(projectId ?? '', 2);
  const testcard = useMemo(() => ({
    hipotesis: (step2Raw as any)?.hipotesis ?? '',
    experimento: (step2Raw as any)?.experimento ?? '',
    metrica: (step2Raw as any)?.metrica ?? '',
    evidencia: (step2Raw as any)?.evidencia ?? '',
  }), [step2Raw]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState<ModuleId>('A');

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE A STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [moduloACompleto, setModuloACompleto] = useState(false);

  // S3A_Formato
  const [formatoExp, setFormatoExp] = useState(inferFormatFromExperiment(testcard.experimento));

  // S3A_Componentes
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [showComponenteModal, setShowComponenteModal] = useState(false);
  const [nuevoComp, setNuevoComp] = useState<Omit<Componente, 'id'>>({
    nombre: '', proposito: '', canal: '', owner: '', link: '', dod: '', estado: 'Pendiente',
  });

  // S3A_Logistica
  const [logistica, setLogistica] = useState({
    donde: 'Piloto interno con empleados nuevos del área de Tecnología.',
    cuando: 'Semana del próximo ingreso de participantes.',
    duracion: '5 días hábiles.',
    quienDispara: 'Ana R. desde RRHH, coordinando con TI para la activación.',
    contingencia: 'Si TI no responde en el plazo acordado, escalar al líder de TI.',
  });

  // S3A_Instrumentacion
  const [instrumentacion, setInstrumentacion] = useState<InstrumentacionRow[]>(MODULE_A_BASE_INSTRUMENTACION);
  const [checklistItems, setChecklistItems] = useState<LaunchChecklistItem[]>([]);

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE B STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [testCycles, setTestCycles] = useState<TestCycle[]>([createInitialTestCycle(testcard.hipotesis)]);
  const [activeCycleId, setActiveCycleId] = useState('testeo-1');
  const [cycleAbiertoId, setCycleAbiertoId] = useState<string | null>('testeo-1');
  const [showAdjuntarOverlay, setShowAdjuntarOverlay] = useState(false);
  const [adjuntarTipo, setAdjuntarTipo] = useState<'archivo' | 'link' | null>(null);
  const [adjuntarDesc, setAdjuntarDesc] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [incidencias, setIncidencias] = useState('');

  // S3B_Bitacora
  const [showBitacoraModal, setShowBitacoraModal] = useState(false);
  const [nuevoBit, setNuevoBit] = useState({ fecha: '', hora: '', accion: '', responsable: '', nota: '' });

  // S3B_MallaReceptora
  const [showMallaModal, setShowMallaModal] = useState(false);
  const [nuevoMalla, setNuevoMalla] = useState<Omit<MallaItem, 'id'>>({ tipo: 'idea', descripcion: '', evidencia: '', severidad: '' });
  const [mallaSeccionAbierta, setMallaSeccionAbierta] = useState<string | null>('testeo-1:idea');

  // S3B_SiguienteIteracion
  const [showIANextOverlay, setShowIANextOverlay] = useState(false);
  const [iaNextLoading, setIaNextLoading] = useState(false);
  const [iaNextListo, setIaNextListo] = useState(false);
  const [iaNextSelected, setIaNextSelected] = useState<number | null>(null);

  const activeCycle = testCycles.find(cycle => cycle.id === activeCycleId) ?? testCycles[0];
  const allEvidencias = testCycles.flatMap(cycle => cycle.evidencias);
  const isCycleComplete = (cycle: TestCycle) =>
    cycle.evidencias.length >= 1 &&
    cycle.resultadoObservado.trim().length > 10 &&
    cycle.aprendizaje.trim().length > 10 &&
    cycle.decision !== '';
  const completedCyclesCount = testCycles.filter(isCycleComplete).length;
  const needsSecondCycle = completedCyclesCount < 2;
  const moduleBReady = completedCyclesCount >= 2;
  const evidencias = allEvidencias;
  const valorMedido = activeCycle?.resultadoObservado ?? '';
  const bitacora = activeCycle?.bitacora ?? [];
  const malla = activeCycle?.hallazgos ?? [];
  const sigIter = {
    quePunto: activeCycle?.siguientePaso ?? '',
    queCambia: activeCycle?.siguienteCambio ?? '',
    comoPrueba: activeCycle?.siguienteMetodo ?? '',
    cuando: activeCycle?.siguienteCuando ?? '',
  };

  useEffect(() => {
    if (checklistItems.length > 0) return;
    setChecklistItems(buildSuggestedChecklist({
      formato: formatoExp || 'Formulario',
      componentes,
      logistica,
      instrumentacion,
    }));
  }, [checklistItems.length, componentes, formatoExp, instrumentacion, logistica]);

  useEffect(() => {
    setInstrumentacion(current => {
      const hasSeededMetric = current.some(item => item.dato.trim().length > 0);
      if (hasSeededMetric) return current;
      return [
        createInstrumentationRow({
          dato: 'Tiempo entre el envío de la solicitud y la activación de accesos',
          lineaBase: extractBaselineFromHypothesis(testcard.hipotesis),
          metricaExito: extractSuccessMetric(testcard.metrica),
          fuente: 'Registro de solicitudes TI',
          comoCapturar: 'Comparando el momento de envío contra el momento de activación',
          dondeCapturar: 'Google Sheet del piloto',
          responsable: 'TI',
          evidenciaEsperada: testcard.evidencia,
          frecuencia: 'En cada caso',
        }),
      ];
    });
  }, []);

  const updateCycle = (cycleId: string, updater: (cycle: TestCycle) => TestCycle) => {
    setTestCycles(prev => prev.map(cycle => (cycle.id === cycleId ? updater(cycle) : cycle)));
  };

  const updateActiveCycle = (updater: (cycle: TestCycle) => TestCycle) => {
    if (!activeCycle) return;
    updateCycle(activeCycle.id, updater);
  };

  const addTestCycle = () => {
    const nextNumber = testCycles.length + 1;
    const previousCycle = testCycles[testCycles.length - 1];
    const newCycle: TestCycle = {
      id: `testeo-${nextNumber}`,
      nombre: `Testeo ${nextNumber}`,
      estado: 'Nuevo',
      queValidamos: previousCycle?.siguientePaso || previousCycle?.queValidamos || testcard.hipotesis,
      metricaPrincipal: previousCycle?.metricaPrincipal || 'Define la metrica principal de este ciclo',
      criterioDecision: previousCycle?.criterioDecision || 'Define el umbral para decidir si mantienes, iteras o pivoteas',
      contextoPrueba: previousCycle?.siguienteCuando || '',
      versionProbada: previousCycle?.siguienteCambio || 'Describe aqui el ajuste principal respecto al testeo anterior.',
      evidencias: [],
      bitacora: [],
      hallazgos: [],
      resultadoEsperado: previousCycle?.criterioDecision || '',
      resultadoObservado: '',
      aprendizaje: '',
      decision: '',
      decisionJustificacion: '',
      siguientePaso: '',
      siguienteCambio: '',
      siguienteMetodo: '',
      siguienteCuando: '',
    };

    setTestCycles(prev => [...prev, newCycle]);
    setActiveCycleId(newCycle.id);
    setCycleAbiertoId(newCycle.id);
    setMallaSeccionAbierta(`${newCycle.id}:idea`);
    toast.success(`${newCycle.nombre} agregado`);
  };

  const setValorMedido = (value: string) => {
    updateActiveCycle(cycle => ({ ...cycle, resultadoObservado: value, estado: 'Actualizado' }));
  };

  const setEvidencias = (updater: EvidenciaItem[] | ((prev: EvidenciaItem[]) => EvidenciaItem[])) => {
    updateActiveCycle(cycle => ({
      ...cycle,
      evidencias: typeof updater === 'function' ? updater(cycle.evidencias) : updater,
      estado: 'Actualizado',
    }));
  };

  const setBitacora = (updater: EventoBitacora[] | ((prev: EventoBitacora[]) => EventoBitacora[])) => {
    updateActiveCycle(cycle => ({
      ...cycle,
      bitacora: typeof updater === 'function' ? updater(cycle.bitacora) : updater,
      estado: 'Actualizado',
    }));
  };

  const setMalla = (updater: MallaItem[] | ((prev: MallaItem[]) => MallaItem[])) => {
    updateActiveCycle(cycle => ({
      ...cycle,
      hallazgos: typeof updater === 'function' ? updater(cycle.hallazgos) : updater,
      estado: 'Actualizado',
    }));
  };

  const setSigIter = (
    updater:
      | { quePunto: string; queCambia: string; comoPrueba: string; cuando: string }
      | ((prev: { quePunto: string; queCambia: string; comoPrueba: string; cuando: string }) => { quePunto: string; queCambia: string; comoPrueba: string; cuando: string })
  ) => {
    updateActiveCycle(cycle => {
      const next = typeof updater === 'function'
        ? updater({
            quePunto: cycle.siguientePaso,
            queCambia: cycle.siguienteCambio,
            comoPrueba: cycle.siguienteMetodo,
            cuando: cycle.siguienteCuando,
          })
        : updater;
      return {
        ...cycle,
        siguientePaso: next.quePunto,
        siguienteCambio: next.queCambia,
        siguienteMetodo: next.comoPrueba,
        siguienteCuando: next.cuando,
        estado: 'Actualizado',
      };
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE C STATE
  // ══════════════════════════════════════════════════════════════════════════
  const [comparisonPlan, setComparisonPlan] = useState([
    { label: 'Hipótesis', value: 'Trae aquí lo que esperabas validar para compararlo con el resultado real.' },
    { label: 'Señal esperada', value: 'Define qué señal debía aparecer para pensar que el experimento iba bien.' },
    { label: 'Muestra esperada', value: 'Aclara con quién o con cuántos casos pensabas probar.' },
    { label: 'Mecanismo de prueba', value: 'Resume el mecanismo o canal que planeabas poner en campo.' },
  ]);
  const [comparisonReality, setComparisonReality] = useState([
    { label: 'Resultado observado', value: 'Trae aquí lo que realmente pasó durante los testeos.' },
    { label: 'Lectura de la señal', value: 'Resume si la señal esperada apareció, quedó corta o fue mixta.' },
    { label: 'Muestra real', value: 'Aterriza qué casos, perfiles o usuarios sí participaron.' },
    { label: 'Observación clave', value: 'Escribe el cambio o fricción más importante que apareció en campo.' },
  ]);
  const [umbral] = useState('');
  const [resultado] = useState('');
  const [goNoGo, setGoNoGo] = useState<GoNoGoDecision>(null);
  const [aprendizajes, setAprendizajes] = useState([
    'Resume aquí el principal aprendizaje que dejó el contraste entre lo esperado y lo observado.',
    'Aclara qué parte del experimento funcionó bien y qué parte sigue necesitando ajuste.',
    'Escribe la señal más importante que te ayuda a tomar una decisión para el siguiente paso.',
  ]);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showS3MentorModal, setShowS3MentorModal] = useState(false);
  const [s3SessionBooked, setS3SessionBooked] = useState(false);
  const [s3MentorDate, setS3MentorDate] = useState('');
  const [s3MentorTime, setS3MentorTime] = useState('');
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

  // S3C_DiagnosticoIA
  const [editandoDiag, setEditandoDiag] = useState(false);
  const [diagnostico, setDiagnostico] = useState({
    senales: [
      'Escribe aquí las señales favorables que aparecen al comparar el plan con lo que pasó en campo.',
      'Incluye solo señales que realmente estén sustentadas por la evidencia recogida.',
    ],
    riesgos: [
      'Registra aquí las fricciones, riesgos o límites que hoy frenan el experimento.',
      'Incluye los puntos que podrían hacerte iterar, pivotear o detener la iniciativa.',
    ],
    queFalta: [
      'Aclara qué falta validar antes de escalar o cerrar la decisión con más confianza.',
      'Escribe qué información adicional necesitarías si la evidencia todavía no es suficiente.',
    ],
  });

  // S3C_RecomendacionIA
  const [showRefinarOverlay, setShowRefinarOverlay] = useState(false);
  const [refinarLoading, setRefinarLoading] = useState(false);
  const [refinarListo, setRefinarListo] = useState(false);

  // S3C_Pack_Step4
  const [showDeckOverlay, setShowDeckOverlay] = useState(false);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckAplicado, setDeckAplicado] = useState(false);
  const [deckSlides, setDeckSlides] = useState<DeckSlide[]>([]);

  // Overlay_S3_MentorComplete_Demo — gatillo visible siempre en S3C para aprobar Step 3 en demo
  const [showFinalizarDemo, setShowFinalizarDemo] = useState(false);

  // ── TASK-010: hydrate Step 3 state from backend on mount ─────────────────────
  // Mirrors Step 1's pattern. Falls back silently to the existing defaults
  // when nothing is persisted, so the empty-state UX is preserved.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await stepService.getStepData(projectId, 3);
        if (cancelled || !stored || typeof stored !== 'object') return;
        const formData = (stored as { formData?: Record<string, unknown> }).formData;
        if (!formData) return;
        if (Array.isArray(formData.checklistItems)) setChecklistItems(formData.checklistItems as LaunchChecklistItem[]);
        if (typeof formData.formatoExp === 'string') setFormatoExp(formData.formatoExp);
        if (Array.isArray(formData.componentes)) setComponentes(formData.componentes as Componente[]);
        if (formData.logistica && typeof formData.logistica === 'object') setLogistica(formData.logistica as typeof logistica);
        if (Array.isArray(formData.instrumentacion)) setInstrumentacion(formData.instrumentacion as InstrumentacionRow[]);
        if (Array.isArray(formData.testCycles)) setTestCycles(formData.testCycles as TestCycle[]);
        if (typeof formData.activeCycleId === 'string') setActiveCycleId(formData.activeCycleId);
        if (formData.goNoGo === 'Go' || formData.goNoGo === 'Iterar' || formData.goNoGo === 'No-Go' || formData.goNoGo === 'Pivote' || formData.goNoGo === null) {
          setGoNoGo(formData.goNoGo as GoNoGoDecision);
        }
        if (Array.isArray(formData.aprendizajes)) setAprendizajes(formData.aprendizajes as typeof aprendizajes);
        if (formData.diagnostico && typeof formData.diagnostico === 'object') setDiagnostico(formData.diagnostico as typeof diagnostico);
      } catch {
        // 404 / auth — keep defaults silently.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Autosave (TASK-010) ─────────────────────────────────────────────────────
  const step3FormData = {
    checklistItems,
    formatoExp,
    componentes,
    logistica,
    instrumentacion,
    testCycles,
    activeCycleId,
    goNoGo,
    aprendizajes,
    diagnostico,
  };

  const autosaveFn = useCallback(
    async (data: typeof step3FormData) => {
      if (!projectId) return;
      await stepService.saveStepData(projectId, 3, {
        _meta: { version: 1, lastSavedAt: new Date().toISOString(), lastSavedBy: 'user' },
        formData: data,
      });
    },
    [projectId],
  );

  const { state: saveState } = useAutosave({
    data: step3FormData,
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

  const confirmStep3Transition = async () => {
    if (!projectId || !project) return;
    setAdaptiveTransitionSaving(true);
    setAdaptiveAuthorityError(null);
    try {
      const draft = latestAdaptiveStepOutput(adaptiveCore, 3, 'draft');
      await confirmStep3Output(projectId, {
        idempotencyKey: `${projectId}-step3-output-${draft?.id ?? 'ui'}-confirm`,
        brief: draft?.output ?? step3FormData,
        confirmed: true,
      });
      const refreshedCore = await loadAdaptiveCore();
      if (!refreshedCore || !canNavigateToAdaptiveStep(refreshedCore, 4)) {
        throw new Error('El backend confirmó Step 3, pero Step 4 todavía no aparece activo en el estado adaptativo persistido.');
      }
      const updatedSteps = project.steps.map(s => {
        if (s.number === 3) return { ...s, status: 'Aprobado' as const, progress: 100 };
        if (s.number === 4) return { ...s, status: s.status === 'Bloqueado' ? 'En progreso' as const : s.status };
        return s;
      });
      updateProject(projectId, { steps: updatedSteps, status: 'En progreso' as const });
      setS3SessionBooked(true);
      setShowFinalizarDemo(false);
      setShowS3MentorModal(false);
      toast.success('Step 3 confirmado en Adaptive Core.', { description: 'Step 4 ya esta disponible desde el estado persistido.' });
      navigate(`/projects/${projectId}/step/4`);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message ?? err?.message ?? 'No pudimos confirmar Step 3 en Adaptive Core.';
      setAdaptiveAuthorityError(message);
      toast.error(message);
    } finally {
      setAdaptiveTransitionSaving(false);
    }
  };

  // ── Gate ─────────────────────────────────────────────────────────────────────
  if (!project && (projectsLoading || projectFetching)) return <div className="p-6"><p className="text-slate-500">Cargando proyecto...</p></div>;
  if (!project && projectFetchError) return <div className="p-6"><p className="text-slate-500">No pudimos cargar el proyecto.</p></div>;
  if (!project) return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;
  const confirmAdaptiveStep3Checkpoint = async (responses: Record<string, unknown>, truthBindings?: { claimId: string; evidenceIds: string[]; sourceRefIds: string[] }) => {
    if (!projectId || !adaptiveCore?.activeCheckpoint || adaptiveCore.activeCheckpoint.step !== 3) return;
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
      const { message, core } = await explainCheckpointError(projectId, error, 'No pudimos confirmar el checkpoint adaptativo.');
      if (core) setAdaptiveCore(core);
      setAdaptiveAuthorityError(message);
    } finally {
      setAdaptiveTransitionSaving(false);
    }
  };

  const adaptiveStep3Allowed = adaptiveCoreStatus === 'loaded' && canNavigateToAdaptiveStep(adaptiveCore, 3);
  if (adaptiveCoreStatus === 'loading') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Cargando estado adaptativo</h2>
        <p className="text-sm text-slate-500">Validando con backend si Step 3 esta disponible.</p>
      </div>
    );
  }
  if (adaptiveCoreStatus === 'error' || !adaptiveStep3Allowed) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Lock size={24} className="text-slate-400" /></div>
        <h2 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Step 3 bloqueado</h2>
        <p className="text-sm text-slate-500 mb-4">
          {adaptiveCoreStatus === 'error'
            ? adaptiveAuthorityError
            : 'El backend Adaptive Core todavia no habilita Step 3.'}
        </p>
        <div className="flex justify-center gap-2">
          {adaptiveCoreStatus === 'error' ? (
            <button onClick={() => void loadAdaptiveCore()} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>Reintentar</button>
          ) : null}
          <button onClick={() => navigate(`/projects/${projectId}/step/2`)} className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Ir al Step 2</button>
        </div>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const adaptiveStep3Checkpoint = adaptiveCore?.activeCheckpoint?.step === 3 ? adaptiveCore.activeCheckpoint : null;
  const adaptiveStep3Draft = latestAdaptiveStepOutput(adaptiveCore, 3, 'draft');
  const adaptiveStep3Confirmed = Boolean(latestAdaptiveStepOutput(adaptiveCore, 3, 'confirmed'));
  return (
    <main className="min-h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => navigate(`/projects/${projectId}`)} className="mb-5 text-sm text-slate-500 hover:text-slate-800">Volver al proyecto</button>
        <AdaptiveCheckpointWorkspace
          core={adaptiveCore!}
          step={3}
          checkpoint={adaptiveStep3Checkpoint}
          questions={adaptiveStep3Checkpoint?.questions ?? []}
          initialResponses={{ ...adaptiveCore?.confirmedResponses, ...(adaptiveCore?.activeCheckpoint?.responses ?? {}) }}
          outputPreview={adaptiveStep3Draft?.output ?? null}
          outputConfirmed={adaptiveStep3Confirmed}
          saving={adaptiveTransitionSaving}
          error={adaptiveAuthorityError}
          onConfirmCheckpoint={adaptiveStep3Checkpoint ? confirmAdaptiveStep3Checkpoint : undefined}
          onConfirmOutput={adaptiveStep3Draft ? confirmStep3Transition : undefined}
          onRefresh={() => void loadAdaptiveCore()}
        />
      </div>
    </main>
  );

  const modules: { id: ModuleId; label: string; completed: boolean }[] = [
    { id: 'A', label: 'A · Plan del experimento', completed: moduloACompleto },
    { id: 'B', label: 'B · Ejecutar y capturar', completed: moduleBReady },
    { id: 'C', label: 'C · Resultados y decisión', completed: !!goNoGo && hasFeedback },
  ];

  const formatoGuide = formatoExp ? FORMATO_GUIDES[formatoExp] : null;
  const checklistReadyCount = checklistItems.filter(item => item.estado === 'listo').length;
  const checklistPendingCount = checklistItems.length - checklistReadyCount;
  const instrumentationReadyCount = instrumentacion.filter(item => item.estado === 'listo').length;
  const moduleAReady = Boolean(formatoExp) && checklistReadyCount > 0 && instrumentacion.length > 0;

  const addEvidencia = () => {
    if (!adjuntarDesc.trim() || !adjuntarTipo || !activeCycle) return;
    updateActiveCycle(cycle => ({
      ...cycle,
      evidencias: [
        ...cycle.evidencias,
        {
          id: Date.now().toString(),
          tipo: adjuntarTipo === 'archivo' ? 'Archivo' : 'Link',
          descripcion: adjuntarDesc.trim(),
          fecha: new Date().toISOString().split('T')[0],
        },
      ],
      estado: 'Actualizado',
    }));
    setAdjuntarDesc(''); setAdjuntarTipo(null); setShowAdjuntarOverlay(false);
    toast.success('Evidencia adjuntada');
  };

  const addComponente = () => {
    if (!nuevoComp.nombre.trim()) return;
    setComponentes(p => [...p, { ...nuevoComp, id: Date.now().toString() }]);
    setNuevoComp({ nombre: '', proposito: '', canal: '', owner: '', link: '', dod: '', estado: 'Pendiente' });
    setShowComponenteModal(false);
    toast.success('Componente agregado');
  };

  const updateChecklistItem = (itemId: string, updates: Partial<LaunchChecklistItem>) => {
    setChecklistItems(prev => prev.map(item => (item.id === itemId ? { ...item, ...updates } : item)));
  };

  const addChecklistItem = () => {
    setChecklistItems(prev => [...prev, createChecklistItem({ titulo: '', origen: 'personalizada' })]);
  };

  const regenerateChecklistSuggestions = () => {
    const personalized = checklistItems.filter(item => item.origen === 'personalizada');
    const suggestions = buildSuggestedChecklist({ formato: formatoExp, componentes, logistica, instrumentacion });
    setChecklistItems([...suggestions, ...personalized]);
    toast.success('Sugerencias de alistamiento actualizadas');
  };

  const addInstrumentationRow = () => {
    setInstrumentacion(prev => [...prev, createInstrumentationRow()]);
  };

  const updateInstrumentationRow = (rowId: string, updates: Partial<InstrumentacionRow>) => {
    setInstrumentacion(prev => prev.map(row => (row.id === rowId ? { ...row, ...updates } : row)));
  };

  const addEventoBitacora = () => {
    if (!nuevoBit.accion.trim() || !activeCycle) return;
    updateActiveCycle(cycle => ({
      ...cycle,
      bitacora: [...cycle.bitacora, { ...nuevoBit, id: Date.now().toString() }],
      estado: 'Actualizado',
    }));
    setNuevoBit({ fecha: '', hora: '', accion: '', responsable: '', nota: '' });
    setShowBitacoraModal(false);
    toast.success('Evento registrado');
  };

  const addMallaItem = () => {
    if (!nuevoMalla.descripcion.trim() || !activeCycle) return;
    updateActiveCycle(cycle => ({
      ...cycle,
      hallazgos: [...cycle.hallazgos, { ...nuevoMalla, id: Date.now().toString() }],
      estado: 'Actualizado',
    }));
    setNuevoMalla({ tipo: 'idea', descripcion: '', evidencia: '', severidad: '' });
    setShowMallaModal(false);
    toast.success('Hallazgo registrado');
  };

  const applyIASugerencia = (idx: number) => {
    const s = IA_SUGERENCIAS_NEXT[idx];
    if (!activeCycle) return;
    updateActiveCycle(cycle => ({
      ...cycle,
      siguientePaso: s.objetivo,
      siguienteCambio: s.cambio,
      siguienteMetodo: s.evidencia,
      siguienteCuando: s.duracion,
      estado: 'Actualizado',
    }));
    setIaNextSelected(idx);
    setShowIANextOverlay(false);
    toast.success('Sugerencia aplicada a los campos');
  };

  const mallaByTipo = (cycleOrTipo: TestCycle | string, maybeTipo?: string) => {
    if (typeof cycleOrTipo === 'string') {
      return malla.filter(item => item.tipo === cycleOrTipo);
    }
    return cycleOrTipo.hallazgos.filter(item => item.tipo === maybeTipo);
  };
  const decisionOptions: { value: CycleDecision; label: string }[] = [
    { value: 'mantener', label: 'Mantener' },
    { value: 'iterar', label: 'Iterar' },
    { value: 'pivotear', label: 'Pivotear' },
    { value: 'detener', label: 'Detener' },
  ];
  const cycleStatusLabel = (cycle: TestCycle) => {
    if (cycle.decision) return `Decision: ${decisionOptions.find(option => option.value === cycle.decision)?.label ?? cycle.decision}`;
    if (cycle.evidencias.length > 0 || cycle.hallazgos.length > 0) return 'En curso';
    return cycle.estado || 'Pendiente';
  };
  const cleanVisibleText = (text: string) => text.replace(/\(Placeholder\)\s*/g, '').replace(/\s+/g, ' ').trim();
  const buildResultsFromTests = () => {
    const completedCycles = testCycles.filter(isCycleComplete);
    const baseCycle = completedCycles[0] ?? testCycles[0];
    const latestCycle = completedCycles[completedCycles.length - 1] ?? testCycles[testCycles.length - 1];
    const totalEvidence = testCycles.reduce((sum, cycle) => sum + cycle.evidencias.length, 0);
    const totalFindings = testCycles.reduce((sum, cycle) => sum + cycle.hallazgos.length, 0);
    const decisionsSeen = completedCycles.map(cycle => cycle.decision).filter(Boolean).join(' → ');

    setComparisonPlan([
      { label: 'Hipótesis', value: cleanVisibleText(baseCycle?.queValidamos || testcard.hipotesis) || 'Aún no hay una hipótesis clara registrada en los testeos.' },
      { label: 'Señal esperada', value: cleanVisibleText(baseCycle?.criterioDecision || umbral) || 'Aún no definiste la señal esperada para leer el resultado.' },
      { label: 'Muestra esperada', value: cleanVisibleText(baseCycle?.contextoPrueba || 'Revisa la muestra planeada desde el testeo inicial.') },
      { label: 'Mecanismo de prueba', value: cleanVisibleText(baseCycle?.versionProbada || testcard.experimento) || 'Aún no queda claro qué mecanismo pusiste a prueba.' },
    ]);

    setComparisonReality([
      { label: 'Resultado observado', value: cleanVisibleText(latestCycle?.resultadoObservado || 'Todavía no hay un resultado observado consolidado.') },
      { label: 'Lectura de la señal', value: cleanVisibleText(latestCycle?.decisionJustificacion || 'Todavía falta interpretar si la señal observada fue suficiente.') },
      { label: 'Muestra real', value: cleanVisibleText(latestCycle?.contextoPrueba || 'Todavía no queda clara la muestra real utilizada.') },
      { label: 'Observación clave', value: cleanVisibleText(latestCycle?.aprendizaje || 'Todavía falta sintetizar la observación más importante.') },
    ]);

    setDiagnostico({
      senales: [
        cleanVisibleText(latestCycle?.resultadoObservado || ''),
        totalEvidence > 0 ? `Ya reuniste ${totalEvidence} evidencias y ${totalFindings} hallazgos de campo para sustentar la lectura.` : 'Todavía falta reunir evidencia visible desde los testeos.',
      ].filter(Boolean),
      riesgos: [
        cleanVisibleText(latestCycle?.hallazgos.find(item => item.tipo === 'critica')?.descripcion || ''),
        completedCycles.length < 2 ? 'Todavía falta contraste entre al menos dos testeos completos.' : '',
      ].filter(Boolean),
      queFalta: [
        completedCycles.length < 2 ? 'Completa al menos dos testeos sólidos antes de cerrar conclusiones.' : '',
        latestCycle?.decision ? '' : 'Aún falta una decisión clara basada en la evidencia más reciente.',
      ].filter(Boolean),
    });

    setAprendizajes([
      cleanVisibleText(baseCycle?.aprendizaje || ''),
      cleanVisibleText(latestCycle?.aprendizaje || ''),
      decisionsSeen ? `La secuencia de decisiones observada hasta ahora fue: ${decisionsSeen}.` : 'Todavía falta definir una decisión clara basada en los resultados.',
    ].filter(Boolean));

    toast.success('Resultados del testeo traídos al módulo C');
  };

  const MALLA_SECCIONES = [
    { key: 'idea', label: 'Ideas interesantes observadas', color: 'emerald', icon: Sparkles },
    { key: 'critica', label: 'Críticas constructivas / fricciones', color: 'amber', icon: AlertCircle },
    { key: 'pregunta', label: 'Preguntas nuevas que surgieron', color: 'blue', icon: FileText },
    { key: 'hipotesis', label: 'Nuevas hipótesis / mejoras sugeridas', color: 'violet', icon: FlaskConical },
  ] as const;

  const colorMap = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    violet: 'bg-violet-50 border-violet-100 text-violet-700',
  };

  const severidadMap = { alto: 'bg-red-100 text-red-700', medio: 'bg-amber-100 text-amber-700', bajo: 'bg-slate-100 text-slate-500', '': '' };

  const recomendaciones: Record<string, { titulo: string; items: string[] }[]> = {
    Go: [
      { titulo: '🚀 Qué escalar', items: ['(Placeholder) Implementar el formulario para el 100% de los ingresos nuevos desde el próximo mes.', '(Placeholder) Automatizar la notificación a TI para eliminar el paso manual.'] },
      { titulo: '⚠️ Condiciones para escalar', items: ['(Placeholder) TI debe comprometerse formalmente con SLA de ≤24h.', '(Placeholder) El sheet de seguimiento debe ser mantenido por TI, no por RRHH.'] },
      { titulo: '🔴 Riesgos a monitorear', items: ['(Placeholder) Casos especiales pueden romper el SLA — definir flujo de escalado.', '(Placeholder) Si el volumen crece, el proceso manual de TI puede colapsar.'] },
    ],
    Iterar: [
      { titulo: '🔧 Qué ajustar', items: ['(Placeholder) Agregar campo "tipo de acceso especial" al formulario para que TI priorice.', '(Placeholder) Agregar confirmación visual al empleado al enviar el formulario.'] },
      { titulo: '🔄 Próximo re-test', items: ['(Placeholder) Nuevo piloto con 5 empleados más, incluyendo 2 con accesos especiales.', '(Placeholder) Medir si el campo adicional reduce el tiempo de resolución de casos especiales.'] },
      { titulo: '📊 Evidencia a capturar', items: ['(Placeholder) Tiempo de resolución separado por tipo de acceso (estándar vs especial).', '(Placeholder) NPS diferenciado entre perfiles.'] },
    ],
    'No-Go': [
      { titulo: '❌ Por qué no', items: ['(Placeholder) El proceso no cumplió consistentemente el umbral de ≤24h con la muestra actual.', '(Placeholder) La dependencia de TI sin SLA formal hace el proceso frágil.'] },
      { titulo: '📚 Qué aprendimos', items: ['(Placeholder) El formulario en sí funciona; el cuello de botella está en la capacidad de respuesta de TI.', '(Placeholder) Los empleados valoran la simplicidad del formulario — el canal no es el problema.'] },
      { titulo: '🚫 Qué no repetir', items: ['(Placeholder) No lanzar sin SLA formal de TI.', '(Placeholder) No pilotear en semanas de alto volumen de ingresos.'] },
    ],
    Pivote: [
      { titulo: '💡 Qué aprendizaje nos hace pivotar', items: ['(Placeholder) El formulario solo resuelve el canal de entrada; el problema real es la capacidad de respuesta de TI.', '(Placeholder) Los accesos especiales representan el 20% de los casos y generan el 80% de los retrasos.'] },
      { titulo: '🔀 Qué variable cambia', items: ['(Placeholder) Variable que cambia: propuesta → pasar de formulario a accesos pre-aprobados por perfil de cargo.', '(Placeholder) Mantener el canal (Google Forms) pero cambiar el modelo de respuesta (pre-aprobación vs respuesta manual).'] },
      { titulo: '✅ Qué mantener del experimento actual', items: ['(Placeholder) El formulario como interfaz de solicitud.', '(Placeholder) El sheet de seguimiento como herramienta de medición.', '(Placeholder) La colaboración con TI ya establecida.'] },
      { titulo: '🎯 Qué validar primero en siguiente ciclo', items: ['(Placeholder) Si TI puede definir y aprobar perfiles pre-aprobados en ≤1 semana.', '(Placeholder) Si los casos especiales se reducen con perfiles pre-aprobados (hipótesis: de 20% a ≤5%).'] },
    ],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-full">
      <div className="hidden md:flex md:w-[220px] min-[1440px]:w-[232px] min-[1680px]:w-[240px] flex-col border-r border-slate-200 bg-white p-3 gap-1 shrink-0">
        <div className="px-2 py-2 mb-1">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={12} /> Volver al proyecto
          </button>
          <div className="flex items-center gap-2 mt-2">
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Step 3</h2>
            <StatusChip status="En progreso" size="sm" />
          </div>
          <p className="text-xs text-slate-500">Probar en pequeño</p>
        </div>
        <div className="px-2 mb-1"><p className="text-xs text-slate-400" style={{ fontWeight: 600 }}>SUBMÓDULOS</p></div>
        {modules.map(m => (
          <button key={m.id} onClick={() => setActiveModule(m.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors text-left ${activeModule === m.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            style={{ fontWeight: activeModule === m.id ? 600 : 400 }}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${m.completed ? 'bg-emerald-500' : activeModule === m.id ? 'bg-indigo-400' : 'bg-slate-300'}`} />
            <span className="truncate">{m.label}</span>
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-slate-100"><AutosaveIndicator state={saveState} /></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 min-[1440px]:px-6 min-[1680px]:px-8">
        <div className="mx-auto w-full max-w-[1460px] min-[1440px]:max-w-[1560px] min-[1680px]:max-w-[1680px]">
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 min-[1280px]:grid-cols-[minmax(0,820px)_300px] min-[1440px]:grid-cols-[minmax(0,900px)_320px] min-[1680px]:grid-cols-[minmax(0,940px)_340px] min-[1680px]:gap-8">
            <div className="min-w-0">
              <button onClick={() => navigate(`/projects/${projectId}`)} className="flex md:hidden items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
                <ArrowLeft size={14} /> Volver al proyecto
              </button>
              <div className="flex gap-1 mb-5 md:hidden overflow-x-auto pb-1">
                {modules.map(m => (
                  <button key={m.id} onClick={() => setActiveModule(m.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${activeModule === m.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                    style={{ fontWeight: activeModule === m.id ? 600 : 400 }}>
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mb-5">
                <LeaderFeedbackStatusCard project={project} updateProject={updateProject} variant="step3" compact />
              </div>

              <div className="mb-5 min-[1280px]:hidden">
                <div className="border border-violet-100 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={13} className="text-violet-500" />
                    <p className="text-xs text-violet-700" style={{ fontWeight: 600 }}>Resumen del experimento · del Step 2</p>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Hipótesis', value: testcard.hipotesis },
                      { label: 'Experimento', value: testcard.experimento },
                      { label: 'Métrica + umbral go/no-go', value: testcard.metrica },
                      { label: 'Evidencia a capturar', value: testcard.evidencia },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-violet-500" style={{ fontWeight: 600 }}>{label}</p>
                        <p className="text-xs text-violet-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <aside className="hidden min-[1280px]:block min-w-0">
              <div className="sticky top-6">
                <div className="border border-violet-100 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={13} className="text-violet-500" />
                    <p className="text-xs text-violet-700" style={{ fontWeight: 600 }}>Resumen del experimento · del Step 2</p>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Hipótesis', value: testcard.hipotesis },
                      { label: 'Experimento', value: testcard.experimento },
                      { label: 'Métrica + umbral go/no-go', value: testcard.metrica },
                      { label: 'Evidencia a capturar', value: testcard.evidencia },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-violet-500" style={{ fontWeight: 600 }}>{label}</p>
                        <p className="text-xs text-violet-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Modal: Agregar componente (S3A) */}
      {showComponenteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agregar componente</h3>
              <button onClick={() => setShowComponenteModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {([
                { key: 'nombre', label: 'Nombre del componente', placeholder: 'Ej. Formulario de solicitud' },
                { key: 'proposito', label: 'Propósito', placeholder: 'Ej. Centralizar la solicitud de accesos' },
                { key: 'canal', label: 'Canal / Herramienta', placeholder: 'Ej. Google Forms' },
                { key: 'owner', label: 'Owner', placeholder: 'Ej. Ana R.' },
                { key: 'link', label: 'Link / Asset (opcional)', placeholder: 'https://...' },
                { key: 'dod', label: 'DoD — Definición de listo (1 línea)', placeholder: 'Ej. Todos los campos validados + notificación automática' },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>{label}</label>
                  <input value={nuevoComp[key]} onChange={e => setNuevoComp(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Estado</label>
                <div className="flex gap-2">
                  {(['Pendiente', 'Listo'] as const).map(s => (
                    <button key={s} onClick={() => setNuevoComp(p => ({ ...p, estado: s }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${nuevoComp.estado === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                      style={{ fontWeight: nuevoComp.estado === s ? 600 : 400 }}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowComponenteModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addComponente} disabled={!nuevoComp.nombre.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Guardar componente</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Adjuntar evidencia (S3B) */}
      {showAdjuntarOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Adjuntar evidencia</h3>
              <button onClick={() => { setShowAdjuntarOverlay(false); setAdjuntarTipo(null); setAdjuntarDesc(''); }}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {([{ key: 'archivo' as const, icon: Upload, label: 'Subir archivo' }, { key: 'link' as const, icon: Link, label: 'Pegar link' }]).map(({ key, icon: Icon, label }) => (
                  <button key={key} onClick={() => setAdjuntarTipo(key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${adjuntarTipo === key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Icon size={18} className={adjuntarTipo === key ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className={`text-xs ${adjuntarTipo === key ? 'text-indigo-700' : 'text-slate-500'}`} style={{ fontWeight: adjuntarTipo === key ? 600 : 400 }}>{label}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>{adjuntarTipo === 'link' ? 'URL o link' : 'Descripción'}</label>
                <input value={adjuntarDesc} onChange={e => setAdjuntarDesc(e.target.value)}
                  placeholder={adjuntarTipo === 'link' ? 'https://...' : 'Describe brevemente qué es...'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setShowAdjuntarOverlay(false); setAdjuntarTipo(null); setAdjuntarDesc(''); }} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addEvidencia} disabled={!adjuntarTipo || !adjuntarDesc.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Adjuntar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar evento en bitácora (S3B) */}
      {showBitacoraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Registrar evento</h3>
              <button onClick={() => setShowBitacoraModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Fecha</label>
                  <input type="date" value={nuevoBit.fecha} onChange={e => setNuevoBit(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Hora (opcional)</label>
                  <input type="time" value={nuevoBit.hora} onChange={e => setNuevoBit(p => ({ ...p, hora: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Acción ejecutada</label>
                <input value={nuevoBit.accion} onChange={e => setNuevoBit(p => ({ ...p, accion: e.target.value }))}
                  placeholder="Ej. Se envió formulario al empleado #3 (Luis M.)"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Responsable</label>
                <input value={nuevoBit.responsable} onChange={e => setNuevoBit(p => ({ ...p, responsable: e.target.value }))}
                  placeholder="Ej. Ana R."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Nota breve (opcional)</label>
                <input value={nuevoBit.nota} onChange={e => setNuevoBit(p => ({ ...p, nota: e.target.value }))}
                  placeholder="Ej. Sin incidencias, perfil estándar"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowBitacoraModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addEventoBitacora} disabled={!nuevoBit.accion.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Registrar evento</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar ítem malla receptora (S3B) */}
      {showMallaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Registrar aprendizaje de campo</h3>
              <button onClick={() => setShowMallaModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'idea' as const, label: '💡 Idea interesante' },
                    { key: 'critica' as const, label: '⚠️ Crítica / fricción' },
                    { key: 'pregunta' as const, label: '❓ Pregunta nueva' },
                    { key: 'hipotesis' as const, label: '🔬 Hipótesis / mejora' },
                  ]).map(({ key, label }) => (
                    <button key={key} onClick={() => setNuevoMalla(p => ({ ...p, tipo: key }))}
                      className={`px-3 py-2 rounded-xl text-xs border-2 transition-colors ${nuevoMalla.tipo === key ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      style={{ fontWeight: nuevoMalla.tipo === key ? 600 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Descripción</label>
                <textarea value={nuevoMalla.descripcion} onChange={e => setNuevoMalla(p => ({ ...p, descripcion: e.target.value }))}
                  rows={3} placeholder="Describe lo que observaste o aprendiste..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Evidencia asociada (opcional link)</label>
                <input value={nuevoMalla.evidencia} onChange={e => setNuevoMalla(p => ({ ...p, evidencia: e.target.value }))}
                  placeholder="https://... o descripción de la evidencia"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Severidad / impacto (opcional)</label>
                <div className="flex gap-2">
                  {(['alto', 'medio', 'bajo', ''] as const).map(s => (
                    <button key={s} onClick={() => setNuevoMalla(p => ({ ...p, severidad: s }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${nuevoMalla.severidad === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}
                      style={{ fontWeight: nuevoMalla.severidad === s ? 600 : 400 }}>
                      {s === '' ? 'Sin definir' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowMallaModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={addMallaItem} disabled={!nuevoMalla.descripcion.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: IA — Siguiente iteración (S3B) */}
      {showIANextOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Sugerencias IA — siguiente paso de experimentación</h3>
              </div>
              <button onClick={() => setShowIANextOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {iaNextLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Analizando evidencias y malla receptora…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-1">La IA analizó tus resultados y aprendizajes de campo. Elige la opción que mejor se ajusta a tu contexto:</p>
                  {IA_SUGERENCIAS_NEXT.map((s, i) => (
                    <div key={i} className={`border-2 rounded-xl p-4 transition-colors cursor-pointer ${iaNextSelected === i ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                      onClick={() => setIaNextSelected(i)}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`} style={{ fontWeight: 600 }}>
                            {i === 0 ? 'Iterar' : i === 1 ? 'Complementar' : 'Pivote parcial'}
                          </span>
                          <span className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{s.titulo}</span>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0 bg-slate-100 px-2 py-0.5 rounded-full">{s.duracion}</span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p><span style={{ fontWeight: 600 }}>Objetivo:</span> {s.objetivo}</p>
                        <p><span style={{ fontWeight: 600 }}>Cambio:</span> {s.cambio}</p>
                        <p><span style={{ fontWeight: 600 }}>Evidencia:</span> {s.evidencia}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!iaNextLoading && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowIANextOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
                <button onClick={() => iaNextSelected !== null && applyIASugerencia(iaNextSelected)}
                  disabled={iaNextSelected === null}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar sugerencia
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay: Refinar recomendación IA (S3C) */}
      {showRefinarOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Versiones de recomendación IA</h3>
              </div>
              <button onClick={() => setShowRefinarOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4">
              {refinarLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Generando variantes de recomendación…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 mb-2">3 variantes de recomendación según tu decisión <span style={{ fontWeight: 600 }}>"{goNoGo}"</span> y contexto:</p>
                  {[
                    { label: 'Conservadora', desc: '(Placeholder) Implementa el cambio con la muestra mínima necesaria para validar sin riesgo operativo. Prioriza estabilidad sobre velocidad.' },
                    { label: 'Balanceada', desc: '(Placeholder) Escala gradualmente: primero implementa el ajuste, mide 2 semanas y decide expansión. Equilibrio riesgo-velocidad.' },
                    { label: 'Acelerada', desc: '(Placeholder) Implementa el cambio completo en la próxima semana con todos los empleados nuevos. Maximiza aprendizaje rápido.' },
                  ].map((v, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer group">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{v.label}</p>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-indigo-600 hover:text-indigo-800 px-2 py-0.5 bg-indigo-100 rounded"
                          onClick={() => { setShowRefinarOverlay(false); toast.success(`Recomendación "${v.label}" aplicada`); }}
                          style={{ fontWeight: 500 }}>
                          Usar esta
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">{cleanVisibleText(v.desc)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!refinarLoading && (
              <div className="px-6 pb-5">
                <button onClick={() => setShowRefinarOverlay(false)} className="w-full border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay: Borrador de presentación IA (S3C) */}
      {showDeckOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Borrador de presentación — Step 4</h3>
              </div>
              <button onClick={() => setShowDeckOverlay(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {deckLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Generando estructura de láminas con IA…</p>
                </div>
              ) : deckSlides.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-sm text-slate-500 mb-3">Aún no generaste la historia. Pulsa "Generar deck" para empezar.</p>
                  <button onClick={() => setDeckLoading(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm">Generar deck</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 mb-3">
                    <span>ℹ️</span>
                    <span>Estructura de <span style={{ fontWeight: 600 }}>{deckSlides.length} láminas</span> generada en base a tu experimento. Revísala y ajústala antes de presentar.</span>
                  </div>
                  {deckSlides.map((slide, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 600 }}>Lámina {i + 1}</p>
                      <p className="text-sm text-slate-800 mb-2" style={{ fontWeight: 600 }}>{slide.titulo}</p>
                      <ul className="space-y-1">
                        {slide.bullets.map((b, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <span className="text-slate-300 shrink-0">·</span>{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!deckLoading && deckSlides.length > 0 && (
              <div className="flex gap-3 px-6 pb-5">
                <button onClick={() => setShowDeckOverlay(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
                <button onClick={() => { setDeckAplicado(true); setShowDeckOverlay(false); toast.success('Estructura aplicada a la card de Step 4'); }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                  Aplicar estructura
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Enviar a revisión IA */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="text-slate-900 mb-2" style={{ fontWeight: 600 }}>Enviar Step 3 a revisión IA</h3>
            <p className="text-sm text-slate-500 mb-4">Se enviará: Resultados · Evidencias · Malla de aprendizajes · Aprendizajes · Decisión: <span style={{ fontWeight: 600 }}>{goNoGo}</span></p>
            <div className="flex gap-3">
              <button onClick={() => setShowSendModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => { setShowSendModal(false); toast.success('Enviado a revisión IA'); setTimeout(() => setHasFeedback(true), 1200); }}
                className="flex-1 bg-violet-600 text-white rounded-xl py-2.5 text-sm hover:bg-violet-700 transition-colors" style={{ fontWeight: 500 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay_S3_MentorComplete_Demo ────────────────────────────────── */}
      {showFinalizarDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Sesión con mentor</h3>
                <p className="text-xs text-slate-500 mt-0.5">La aprobación requiere confirmación persistida de Adaptive Core.</p>
              </div>
              <button onClick={() => setShowFinalizarDemo(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Resumen del step */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>RESUMEN DEL STEP 3 PARA LA SESIÓN</p>
                {[
                  { label: 'Decisión tomada', value: goNoGo ?? 'Aún sin seleccionar' },
                  { label: 'Evidencias adjuntas', value: `${evidencias.length} evidencias registradas` },
                  { label: 'Aprendizajes', value: `${aprendizajes.length} aprendizajes documentados` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-2">
                    <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div><span className="text-xs text-slate-500">{label}: </span><span className="text-xs text-slate-700" style={{ fontWeight: 500 }}>{value}</span></div>
                  </div>
                ))}
              </div>
              {/* Mentor info placeholder */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-indigo-700 text-sm" style={{ fontWeight: 700 }}>AG</span>
                </div>
                <div>
                  <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>Ana García</p>
                  <p className="text-xs text-slate-400">Mentor · Innovación & Procesos</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full" style={{ fontWeight: 600 }}>Pendiente</span>
              </div>
              <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <AlertCircle size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-600">
                  <span style={{ fontWeight: 600 }}>Autoridad Adaptive:</span> el Step 4 solo se habilita si el backend confirma el output de Step 3.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowFinalizarDemo(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button
                onClick={() => {
                  void confirmStep3Transition();
                }}
                disabled={adaptiveTransitionSaving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}>
                <CheckCircle2 size={14} /> {adaptiveTransitionSaving ? 'Confirmando...' : 'Confirmar con backend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agendar sesión mentora Step 3 */}
      {showS3MentorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Agendar sesión con mentor</h3>
                <p className="text-xs text-slate-500 mt-0.5">Para cerrar el Step 3 y decidir el siguiente paso.</p>
              </div>
              <button onClick={() => setShowS3MentorModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}><Calendar size={11} className="inline mr-1 text-slate-400" />Fecha</label>
                  <input type="date" value={s3MentorDate} onChange={e => setS3MentorDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}><Clock size={11} className="inline mr-1 text-slate-400" />Hora</label>
                  <select value={s3MentorTime} onChange={e => setS3MentorTime(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Seleccionar…</option>
                    {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '17:00'].map(h => <option key={h} value={h}>{h} hrs</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Mentor</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Ana García · Innovación & Procesos</option>
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <AlertCircle size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-600"><span style={{ fontWeight: 600 }}>Autoridad Adaptive:</span> la sesión no desbloquea Step 4 por si sola; el backend debe confirmar el output de Step 3.</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowS3MentorModal(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>Cancelar</button>
              <button onClick={() => {
                void confirmStep3Transition();
              }}
                disabled={!s3MentorDate || !s3MentorTime || adaptiveTransitionSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
                {adaptiveTransitionSaving ? 'Confirmando...' : 'Confirmar con backend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
