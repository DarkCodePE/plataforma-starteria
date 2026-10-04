import { ArrowRight, GitBranch, Layers3, LogIn, ShieldCheck, Target } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useApp } from '../context/AppContext';
const VALUE_FLOW = ['Define la meta', 'Alinea el trabajo', 'Hazlas realidad', 'Decide'];

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
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f8fafc_100%)] text-slate-950">
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
              Haz que la estrategia se haga realidad.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.
            </p>
            <Button type="button" className="mt-6" onClick={() => navigate('/auth')}>
              Ya tengo claro qué quiero mover<ArrowRight size={16} />
            </Button>
          </div>

          <PlatformStructure />
        </section>

        <section aria-labelledby="portfolio-entry-heading" className="border-y border-slate-200/70 bg-white/80">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start lg:px-8">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase text-indigo-700">Una opción si aún buscas claridad</p>
              <h2 id="portfolio-entry-heading" className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                Aclara qué quieres conseguir antes de decidir qué hacer.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Prepara una lectura inicial de lo que quieres lograr, por qué importa, qué ocurre y qué decisión necesitas preparar. El punto de partida es una hipótesis; podrás ver qué falta aclarar.
              </p>
              <Button type="button" variant="secondary" className="mt-5" onClick={() => navigate('/public/start')}>
                Quiero alinear mi objetivo primero<ArrowRight size={16} />
              </Button>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 md:p-6">
              <p className="text-sm font-semibold text-slate-900">Una lectura estratégica provisional</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ordena qué quieres lograr, para qué, qué está pasando, qué parece estar en juego, qué decisión preparar, por dónde podrías empezar y qué necesitas aclarar.
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">No genera un plan definitivo, un portfolio ni iniciativas automáticamente.</p>
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
                De la meta a una decisión mejor preparada.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Un flujo conceptual para conectar intención, trabajo y aprendizaje continuo.
              </p>
            </div>
            <div aria-label="Flujo conceptual de valor" className="grid gap-3 sm:grid-cols-4">
              {VALUE_FLOW.map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <p className="min-h-14 flex-1 rounded-[18px] border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900">{step}</p>
                  {index < VALUE_FLOW.length - 1 ? <ArrowRight aria-hidden="true" size={16} className="hidden shrink-0 text-slate-400 sm:block" /> : null}
                </div>
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
                ¿Ya sabes qué quieres mover?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Entra a Starteria y conecta ese objetivo con el trabajo de tu equipo.
              </p>
            </div>
            <Button type="button" onClick={() => navigate('/auth')}>
              Ir a Starteria<ArrowRight size={16} />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function PlatformStructure() {
  return (
    <div aria-label="Modelo conceptual de Starteria" className="mt-8 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:p-6">
      <p className="text-xs font-semibold uppercase text-indigo-700">Modelo conceptual · ilustrativo</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">Una forma de ver cómo se conectan los elementos del trabajo, sin analizar al visitante ni mostrar datos reales.</p>
      <div className="mt-5 grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
          {['Objetivos', 'Necesidades', 'Iniciativas', 'Equipos'].map((label) => (
            <li key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800">{label}</li>
          ))}
        </ul>
        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
          <ArrowRight aria-hidden="true" size={18} className="rotate-90 md:rotate-0" />
          <span className="rounded-2xl bg-slate-950 px-5 py-4 text-center text-sm font-semibold text-white">
            Starteria
            <span className="mt-1 block text-xs font-normal text-slate-300">Contexto. Trabajo. Decisiones.</span>
          </span>
          <ArrowRight aria-hidden="true" size={18} className="rotate-90 md:rotate-0" />
        </div>
        <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
          {['Foco', 'Coordinación', 'Evidencia', 'Decisión'].map((label) => (
            <li key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800">{label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
