import { ArrowRight, GitBranch, Layers3, LogIn, ShieldCheck, Target } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useApp } from '../context/AppContext';
import { PortfolioEntryExperience } from '../../features/portfolio-entry/public';

const PLATFORM_PATH = ['Estrategia / necesidad', 'Iniciativas', 'Evidencia + avance', 'Decisiones'];

const PROBLEMS = [
  {
    title: 'Muchas iniciativas, poca lectura de negocio',
    body: 'El trabajo existe, pero cuesta ver que prioridad mueve, que falta y que decision necesita habilitar.',
  },
  {
    title: 'Actividad sin suficiente soporte para decidir',
    body: 'Los equipos avanzan, reportan y ajustan, pero la evidencia no siempre queda conectada con una decision clara.',
  },
  {
    title: 'Portafolio, retos y ejecucion desconectados',
    body: 'Las conversaciones pasan entre comites, equipos y documentos sin una estructura comun para comparar y aprender.',
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Explicas lo que necesitas mover',
    body: 'Empiezas con lenguaje natural: una prioridad, una duda, un bloqueo, una iniciativa o una decision pendiente.',
  },
  {
    title: 'Starteria estructura el contexto',
    body: 'La plataforma separa lo declarado, lo inferido y lo que todavia requiere aclaracion antes de formalizar trabajo.',
  },
  {
    title: 'Aparecen gaps, retos y caminos',
    body: 'La lectura ayuda a identificar donde falta foco, evidencia o conexion entre iniciativas y prioridades.',
  },
  {
    title: 'Preparas decisiones con mas claridad',
    body: 'El resultado orienta el siguiente movimiento sin convertir la IA en autoridad de decision.',
  },
];

const IMPACT_CUES = [
  {
    label: 'Atencion',
    title: 'Que requiere foco ahora',
    body: 'Separa urgencia, incertidumbre y decision pendiente sin convertirlo en una alerta de peligro.',
  },
  {
    label: 'Evidencia',
    title: 'Que falta para sostener una decision',
    body: 'Distingue actividad de prueba util para continuar, ajustar, pausar o escalar.',
  },
  {
    label: 'Alineacion',
    title: 'Como se conecta el trabajo',
    body: 'Relaciona prioridades, retos e iniciativas para que el portafolio sea mas legible.',
  },
  {
    label: 'Decision',
    title: 'Que movimiento se habilita',
    body: 'Ayuda a preparar conversaciones donde las personas deciden con mas claridad.',
  },
];

const TRUST_PRINCIPLES = [
  'Puedes empezar con contexto incompleto.',
  'Nada se convierte en trabajo formal sin revision.',
  'La IA estructura y propone; las decisiones siguen siendo humanas.',
  'Tu entrada publica no crea iniciativas ni lanza trabajo automaticamente.',
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.09),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f8fafc_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/82 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xl font-semibold tracking-tight text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30"
          >
            Starteria
          </button>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Navegacion principal">
            <a href="#problema" className="text-sm font-medium text-slate-600 hover:text-slate-950">
              Problema
            </a>
            <a href="#como-funciona" className="text-sm font-medium text-slate-600 hover:text-slate-950">
              Como funciona
            </a>
            <a href="#confianza" className="text-sm font-medium text-slate-600 hover:text-slate-950">
              Confianza
            </a>
          </nav>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/auth')}
          >
            <LogIn size={15} />
            {isAuthenticated ? 'Ir al panel' : 'Iniciar sesion'}
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 md:pb-14 md:pt-16 lg:px-8 lg:pb-16 lg:pt-20">
          <div className="max-w-4xl">
            <Badge variant="secondary" className="border-indigo-100 bg-white/80 text-slate-700 shadow-sm">
              Plataforma de decisiones para portafolios
            </Badge>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight text-slate-950 md:text-6xl">
              Convierte estrategia e iniciativas en decisiones sustentadas.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Starteria ayuda a estructurar qué quieres mover, convertirlo en iniciativas accionables, seguir evidencia y bloqueos, y preparar mejores decisiones.
            </p>
          </div>

          <PlatformStructure />
        </section>

        <section aria-labelledby="portfolio-entry-heading" className="border-y border-slate-200/70 bg-white/80">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start lg:px-8">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase text-indigo-700">Orientación opcional</p>
              <h2 id="portfolio-entry-heading" className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                ¿Todavía no tienes claro por dónde empezar?
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Esta orientación te ayuda a ordenar tu objetivo, necesidad, problema, oportunidad, iniciativa y decisión antes de elegir cómo continuar.
              </p>
            </div>
            <PortfolioEntryExperience
              variant="landing"
              recoverExisting={false}
              redirectAfterStart="/public/start"
            />
          </div>
        </section>

        <section className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 rounded-[30px] border border-slate-200/80 bg-white/72 p-4 shadow-sm shadow-slate-900/[0.03] backdrop-blur md:grid-cols-[0.8fr_1fr] md:p-5">
            <div className="rounded-[22px] bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase text-cyan-200">Del texto a la estructura</p>
              <p className="mt-3 text-xl font-semibold leading-tight">
                No es solo una respuesta de IA. Es una primera lectura para orientar atencion, evidencia y decision.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {['Prioridad desconectada', 'Evidencia insuficiente', 'Decision pendiente'].map((item) => (
                <div key={item} className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="h-1.5 w-10 rounded-full bg-indigo-500" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">{item}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Ejemplo ilustrativo de claridad operativa.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="problema" className="border-y border-slate-200/70 bg-white/78">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.68fr_1fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase text-indigo-700">Que resuelve</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                  El reto no es escribir mas. Es entender que merece atencion.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  El problema no suele ser falta de actividad. Suele ser falta de estructura para entender que mover, que evidencia mirar y que decision tomar.
                </p>
              </div>
              <div className="divide-y divide-slate-200 rounded-[26px] border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
                {PROBLEMS.map((item) => (
                  <article key={item.title} className="grid gap-3 p-5 md:grid-cols-[220px_1fr] md:p-6">
                    <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                    <p className="text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.74fr_1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase text-indigo-700">Como funciona</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Una lectura guiada, no una conversacion suelta.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                La entrada libre se convierte en una estructura revisable que ayuda a conectar portafolio, ejecucion y evidencia.
              </p>
            </div>
            <div className="grid gap-4">
              {HOW_IT_WORKS.map((item, index) => (
                <article key={item.title} className="grid gap-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:grid-cols-[56px_1fr]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/70 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.76fr_1fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase text-cyan-200">Que ayuda a mover</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Senales de claridad para mirar el portafolio con mas criterio.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Starteria hace visibles areas de atencion sin convertir ejemplos en datos reales ni reemplazar la decision humana.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPACT_CUES.map((item) => (
                <div key={item.label} className="rounded-[22px] border border-white/10 bg-white/7 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase text-cyan-200">{item.label}</span>
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                  </div>
                  <p className="mt-5 text-base font-semibold leading-6 text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="confianza" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.76fr_1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase text-indigo-700">Por que confiar</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Starteria estructura tu contexto sin sustituir tu criterio.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                La plataforma esta disenada para ayudarte a pensar mejor antes de formalizar trabajo, no para decidir por ti.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {TRUST_PRINCIPLES.map((item, index) => {
                const Icon = index % 2 === 0 ? ShieldCheck : Target;
                return (
                  <article key={item} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03]">
                    <Icon size={19} className="text-indigo-600" />
                    <p className="mt-4 text-sm font-semibold leading-6 text-slate-950">{item}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.04] md:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <Layers3 size={13} />
                  Plataforma estructurada
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <GitBranch size={13} />
                  De intencion a decision
                </Badge>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                La primera entrada es publica y revisable. El trabajo formal empieza solo cuando decides continuar.
              </p>
            </div>
            <Button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Analizar mi situacion
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function PlatformStructure() {
  return (
    <div aria-label="Cómo Starteria conecta el trabajo" className="mt-8 rounded-[24px] border border-slate-200/80 bg-white/75 p-4 shadow-sm shadow-slate-900/[0.03] backdrop-blur sm:p-5">
      <p className="text-xs font-semibold uppercase text-indigo-700">Cómo Starteria conecta el trabajo</p>
      <ol className="mt-4 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORM_PATH.map((item, index) => (
          <li key={item} className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-sm font-semibold text-slate-950">{item}</p>
            </div>
            {index < PLATFORM_PATH.length - 1 ? (
              <ArrowRight aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
