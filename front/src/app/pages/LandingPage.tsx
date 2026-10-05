import { ArrowDown, ArrowRight, LogIn, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useApp } from '../context/AppContext';
import { StarteriaProductPreview } from '../components/landing/StarteriaProductPreview';

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

const TRUST_PRINCIPLES = [
  'Puedes empezar con contexto incompleto.',
  'Nada se convierte en trabajo formal sin revision.',
  'La IA estructura y propone; las decisiones siguen siendo humanas.',
  'Tu entrada publica no crea iniciativas ni lanza trabajo automaticamente.',
];

export function LandingPage() {
  const { isAuthenticated } = useApp();

  return (
    <div className="min-h-screen bg-background-default text-text-primary">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-ds-sm focus:bg-surface-default focus:px-4 focus:py-3 focus:text-text-primary focus:shadow-elevation-overlay"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 border-b border-border-default bg-surface-default/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="rounded-sm text-xl font-semibold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30"
          >
            Starteria
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Navegación principal">
            <a href="#como-funciona" className="text-sm font-medium text-text-secondary hover:text-text-primary">
              Cómo funciona
            </a>
            <a href="#vista-producto" className="text-sm font-medium text-text-secondary hover:text-text-primary">
              Producto
            </a>
            <a href="#confianza" className="text-sm font-medium text-text-secondary hover:text-text-primary">
              Confianza
            </a>
          </nav>

          <Button asChild variant="secondary" size="sm">
            <Link to={isAuthenticated ? '/dashboard' : '/auth'}>
              <LogIn aria-hidden="true" size={15} />
              {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
            </Link>
          </Button>
        </div>
      </header>

      <main id="contenido">
        <section className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-5 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-7 lg:pt-10">
          <div className="max-w-4xl">
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-text-primary sm:text-5xl">
              Haz que la estrategia se haga realidad.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-text-secondary sm:text-lg">
              Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
              Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.
            </p>
            <Button asChild className="mt-5">
              <Link to="/auth">
                Ya tengo claro qué quiero mover
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </Button>
          </div>
        </section>

        <PlatformStructure />

        <StarteriaProductPreview />

        <section
          id="problema"
          aria-labelledby="problema-title"
          className="scroll-mt-24 border-y border-border-default bg-surface-default"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1fr)] lg:gap-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                  Qué resuelve
                </p>
                <h2 id="problema-title" className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl">
                  El reto no es escribir más. Es entender qué merece atención.
                </h2>
                <p className="mt-4 text-base leading-7 text-text-secondary">
                  El problema no suele ser falta de actividad. Suele ser falta de estructura para entender qué mover, qué evidencia mirar y qué decisión tomar.
                </p>
              </div>
              <div className="divide-y divide-border-default border-y border-border-default">
                {PROBLEMS.map((item) => (
                  <article key={item.title} className="grid gap-2 py-4 sm:grid-cols-[220px_1fr] sm:gap-5 sm:py-5">
                    <h3 className="text-base font-semibold leading-6 text-text-primary">{item.title}</h3>
                    <p className="text-sm leading-6 text-text-secondary">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="confianza"
          aria-labelledby="confianza-title"
          className="scroll-mt-24 bg-background-subtle"
        >
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                Por qué confiar
              </p>
              <h2 id="confianza-title" className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl">
                Starteria estructura tu contexto sin sustituir tu criterio.
              </h2>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                La plataforma está diseñada para ayudarte a pensar mejor antes de formalizar trabajo, no para decidir por ti.
              </p>
            </div>

            <ul className="divide-y divide-border-default border-y border-border-default">
              {TRUST_PRINCIPLES.map((principle) => (
                <li key={principle} className="flex items-start gap-3 py-4 text-sm leading-6 text-text-primary sm:py-5">
                  <ShieldCheck aria-hidden="true" className="mt-1 shrink-0 text-brand-primary" size={18} />
                  <span>{principle}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* El slot comercial sigue omitido hasta que existan destinos autorizados. */}
        <OptionalPortfolioEntry />
      </main>
      <LandingClosing isAuthenticated={isAuthenticated} />
    </div>
  );
}

function PlatformStructure() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="platform-structure-title"
      aria-label="Modelo conceptual de Starteria"
      className="scroll-mt-24 border-y border-border-default bg-surface-default"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
        <h2
          id="platform-structure-title"
          className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-text-primary sm:text-3xl"
        >
          De la meta a una decisión mejor preparada.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
          Un flujo conceptual para conectar intención, trabajo y aprendizaje continuo.
        </p>

        <div className="mt-5 grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] md:gap-4">
          <p className="text-sm font-medium leading-6 text-text-primary sm:text-base">
            Objetivos / Necesidades / Iniciativas / Equipos
          </p>
          <ArrowRight aria-hidden="true" className="mx-auto rotate-90 text-text-muted md:rotate-0" size={18} />
          <div className="rounded-ds-md bg-text-primary px-5 py-3 text-center text-sm font-semibold text-text-inverse">
            <span>Starteria</span>
            <span className="mt-1 block text-xs font-normal text-text-inverse/80">
              Contexto. Trabajo. Decisiones.
            </span>
          </div>
          <ArrowRight aria-hidden="true" className="mx-auto rotate-90 text-text-muted md:rotate-0" size={18} />
          <p className="text-sm font-medium leading-6 text-text-primary sm:text-base">
            Foco / Coordinación / Evidencia / Decisión
          </p>
        </div>

        <div
          id="flujo-valor"
          role="group"
          aria-label="Flujo conceptual de valor"
          className="mt-5 grid gap-2 border-t border-border-default pt-4 lg:grid-cols-4"
        >
          {VALUE_FLOW.map((step, index) => (
            <div
              key={step}
              className="grid gap-2 border-b border-border-default pb-2 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-3 lg:border-b-0 lg:pb-0"
            >
              <p className="flex-1 text-sm font-semibold leading-6 text-text-primary sm:text-base">
                {step}
              </p>
              {index < VALUE_FLOW.length - 1 ? (
                <>
                  <ArrowDown
                    aria-hidden="true"
                    className="mx-auto text-brand-primary lg:hidden"
                    size={16}
                  />
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden shrink-0 text-brand-primary lg:block"
                    size={16}
                  />
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OptionalPortfolioEntry() {
  return (
    <section
      aria-labelledby="portfolio-entry-heading"
      className="border-y border-border-default bg-surface-default"
    >
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start lg:px-8">
        <div className="max-w-xl">
          <Badge variant="neutral">Orientación opcional</Badge>
          <h2 id="portfolio-entry-heading" className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-text-primary sm:text-3xl">
            Aclara qué quieres conseguir antes de decidir qué hacer.
          </h2>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            Prepara una lectura inicial de lo que quieres lograr, por qué importa, qué ocurre y qué decisión necesitas preparar. El punto de partida es una hipótesis; podrás ver qué falta aclarar.
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/public/start">
              Quiero alinear mi objetivo primero
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </div>

        <div className="border-l-2 border-border-strong pl-4 sm:pl-5">
          <p className="text-sm font-semibold text-text-primary">
            Una lectura estratégica provisional
          </p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Ordena qué quieres lograr, para qué, qué está pasando, qué parece estar en juego, qué decisión preparar, por dónde podrías empezar y qué necesitas aclarar.
          </p>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            No genera un plan definitivo, un portfolio ni iniciativas automáticamente.
          </p>
        </div>
      </div>
    </section>
  );
}

function LandingClosing({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <footer className="border-t border-border-default bg-background-default">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link to="/" className="w-fit text-sm font-semibold text-text-primary">
          Starteria
        </Link>
        <Link
          to={isAuthenticated ? '/dashboard' : '/auth'}
          className="w-fit text-sm font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
        </Link>
      </div>
    </footer>
  );
}
