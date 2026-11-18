import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  GitBranchPlus,
  Lightbulb,
  Target,
  type LucideIcon,
} from 'lucide-react';

type StageId = 'alinear' | 'desarrollar' | 'aprender';

type Stage = {
  id: StageId;
  number: string;
  name: string;
  headline: string;
  description: string;
  action: string;
  output: string;
  impact: string;
  Icon: LucideIcon;
};

const STAGES: Stage[] = [
  {
    id: 'alinear',
    number: '01',
    name: 'Enfocar',
    headline: 'Primero, saber qué resultado importa.',
    description: 'El equipo conecta la necesidad con un objetivo observable y revisa qué iniciativas pueden contribuir.',
    action: 'Aclarar el resultado, revisar el contexto y comparar alternativas.',
    output: 'Objetivo y prioridades revisables.',
    impact: 'Menos tiempo perdido trabajando sobre metas ambiguas.',
    Icon: Target,
  },
  {
    id: 'desarrollar',
    number: '02',
    name: 'Desarrollar',
    headline: 'Después, convertir el foco en trabajo que avanza.',
    description: 'Cada iniciativa tiene un responsable, un siguiente paso y las preguntas o evidencias que necesita resolver.',
    action: 'Guiar el trabajo con asistencia de IA contextual y seguimiento de bloqueos.',
    output: 'Iniciativas y evidencias conectadas al objetivo.',
    impact: 'Menos fricción para coordinar, revisar y avanzar.',
    Icon: GitBranchPlus,
  },
  {
    id: 'aprender',
    number: '03',
    name: 'Aprender',
    headline: 'Por último, no empezar de cero en la siguiente iniciativa.',
    description: 'Lo observado se registra con su fuente. El equipo lo revisa, prepara decisiones y puede reutilizar lo aprendido.',
    action: 'Conectar resultados y decisiones con nuevas oportunidades, sin dar por confirmadas las inferencias.',
    output: 'Decisión preparada y aprendizaje trazable.',
    impact: 'Más capacidad para aprovechar el conocimiento ya generado.',
    Icon: BrainCircuit,
  },
];

const INITIATIVES = [
  { title: 'Clasificar solicitudes', subtitle: 'Reducir tareas manuales', mark: '01' },
  { title: 'Simplificar derivaciones', subtitle: 'Reducir esperas entre áreas', mark: '02' },
];

export function StarteriaInteractiveStory() {
  const [stageId, setStageId] = useState<StageId>('alinear');
  const active = STAGES.find((stage) => stage.id === stageId)!;

  return (
    <section
      id="en-accion"
      aria-labelledby="landing-story-title"
      className="scroll-mt-24 bg-[#F4F6FB] px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Startería en acción
          </p>
          <h2 id="landing-story-title" className="landing-display mt-4 text-3xl font-semibold leading-[1.09] text-[#0D1333] sm:text-[2.75rem]">
            Así se convierte un objetivo en iniciativas que aprenden unas de otras.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#5D6585]">
            Explora un caso para ver qué hace tu equipo dentro de Startería y qué obtiene en cada momento.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[26px] border border-[#343959] bg-[#13182F] text-white shadow-[0_26px_60px_-30px_rgb(13_19_51/0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1B213D] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2">
              <div aria-hidden="true" className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFB2A6]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FFD99F]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#92DEC6]" />
              </div>
              <span className="ml-2 text-xs font-medium text-[#CFD3ED]">Vista de trabajo · Startería</span>
            </div>
            <span className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-[#C8CCE7]">Caso ilustrativo · datos ficticios</span>
          </div>

          <div role="tablist" aria-label="Etapas del trabajo con Startería" className="grid grid-cols-3 gap-2 border-b border-white/10 p-3 sm:gap-3 sm:p-5">
            {STAGES.map((step) => {
              const selected = step.id === stageId;
              const Icon = step.Icon;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  id={'starteria-stage-' + step.id}
                  aria-selected={selected}
                  aria-controls="starteria-stage-panel"
                  onClick={() => setStageId(step.id)}
                  className={[
                    'flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors sm:justify-start sm:px-4 sm:text-sm',
                    selected
                      ? 'border-[#8B86FF] bg-[#383B77] text-white'
                      : 'border-white/10 bg-[#202640] text-[#BCC4E2] hover:border-white/30 hover:text-white',
                  ].join(' ')}
                >
                  <Icon aria-hidden="true" size={17} className="shrink-0" />
                  <span className="hidden sm:inline text-[11px] opacity-70">{step.number}</span>
                  {step.name}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id="starteria-stage-panel"
            aria-labelledby={'starteria-stage-' + active.id}
            className="grid gap-6 p-4 sm:p-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.78fr)] lg:gap-8"
          >
            <div className="min-w-0 rounded-2xl border border-white/10 bg-[#181E35] p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#AAA8FF]">Ejemplo · Operaciones</p>
                <span className="text-[11px] text-[#AAB2D1]">Conexiones de negocio</span>
              </div>

              <div className={[
                'mt-5 rounded-xl border p-4 transition-colors',
                stageId === 'alinear' ? 'border-[#938EFF] bg-[#333565]' : 'border-[#444C6B] bg-[#202942]',
              ].join(' ')}>
                <div className="flex items-center gap-2 text-[#C6C6FF]">
                  <Target aria-hidden="true" size={17} />
                  <span className="text-xs font-semibold">Objetivo de negocio</span>
                </div>
                <p className="mt-2 text-base font-semibold text-white sm:text-lg">Reducir tiempos de respuesta a clientes</p>
                <p className="mt-1 text-xs text-[#CBD1EA]">Métrica y horizonte por confirmar con el equipo</p>
              </div>

              <div className="flex items-center justify-center py-2 text-[#8D91D0]" aria-hidden="true">
                <ArrowDown size={20} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {INITIATIVES.map((initiative, index) => (
                  <div
                    key={initiative.mark}
                    className={[
                      'min-w-0 rounded-xl border p-4 transition-colors',
                      stageId === 'desarrollar' ? 'border-[#7B8CFF] bg-[#2B3761]' : 'border-[#46516F] bg-[#222C45]',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 text-xs text-[#BEC8ED]">
                      <GitBranchPlus aria-hidden="true" size={15} />
                      <span>Iniciativa {index + 1}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">{initiative.title}</p>
                    <p className="mt-1 text-xs text-[#C2CAE4]">{initiative.subtitle}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center py-2 text-[#8D91D0]" aria-hidden="true">
                <ArrowDown size={20} />
              </div>

              <div className={[
                'rounded-xl border p-4 transition-colors',
                stageId === 'aprender' ? 'border-[#63B7AF] bg-[#1A494F]' : 'border-[#456570] bg-[#213945]',
              ].join(' ')}>
                <div className="flex items-center gap-2 text-[#A6E9E0]">
                  <ClipboardCheck aria-hidden="true" size={17} />
                  <span className="text-xs font-semibold">Evidencia, decisión y aprendizaje</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">
                  {stageId === 'alinear' && 'Definir qué debe comprobarse antes de elegir una ruta.'}
                  {stageId === 'desarrollar' && 'Documentar avances, bloqueos y señales observadas.'}
                  {stageId === 'aprender' && 'Revisar hallazgos y reutilizar conocimiento en nuevas iniciativas.'}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-[#B6BEDD]">
                <Lightbulb aria-hidden="true" size={16} className="shrink-0 text-[#BFC4FF]" />
                El conocimiento confirmado puede volver a orientar nuevos ciclos.
                <ArrowRight aria-hidden="true" size={15} className="shrink-0" />
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-center gap-5" aria-live="polite">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAA8FF]">
                  {active.number} / 03 · {active.name}
                </p>
                <h3 className="landing-display mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{active.headline}</h3>
                <p className="mt-4 text-sm leading-7 text-[#C3CBE4]">{active.description}</p>
              </div>
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.05] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#B7B3FF]">Qué hace tu equipo</p>
                <p className="text-sm leading-6 text-white">{active.action}</p>
                <div className="border-t border-white/10 pt-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-[#A5E2D9]">
                    <CheckCircle2 aria-hidden="true" size={16} /> Qué obtiene
                  </p>
                  <p className="mt-1.5 text-sm text-[#E3F4F2]">{active.output}</p>
                </div>
              </div>
              <div className="rounded-xl bg-[#E4E7FF] p-5 text-[#171D44]">
                <p className="text-xs font-bold uppercase tracking-wide text-[#3B41A0]">Impacto que buscamos habilitar</p>
                <p className="mt-2 text-base font-semibold leading-6">{active.impact}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#67708C]">
          Demostración conceptual: no utiliza datos reales, no ejecuta análisis y no representa resultados garantizados.
          Las decisiones siguen siendo humanas.
        </p>
      </div>
    </section>
  );
}
