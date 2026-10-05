import { Fragment } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  LogIn,
  Network,
  Rocket,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { useApp } from '../context/AppContext';
import { StarteriaProductPreview } from '../components/landing/StarteriaProductPreview';
import { PUBLIC_LANDING_CONFIG } from '../config/publicLanding';

const VALUE_FLOW = [
  { title: 'Define la meta', Icon: Target },
  { title: 'Alinea el trabajo', Icon: Network },
  { title: 'Hazlas realidad', Icon: Rocket },
  { title: 'Decide', Icon: Scale },
];

const QUICK_BENEFITS = [
  'Más claridad en menos tiempo',
  'Equipos alineados',
  'Decisiones con evidencia',
];

const TODAY_FRAGMENTED = [
  'Objetivos aislados',
  'Equipos desconectados',
  'Contexto perdido',
  'Decisiones tardías',
];

const WITH_STARTERIA = [
  'Foco compartido',
  'Trabajo coordinado',
  'Evidencia conectada',
  'Decisiones trazables',
];

const TRUST_PRINCIPLES = [
  'Puedes empezar con contexto incompleto.',
  'Nada se convierte en trabajo formal sin revisión.',
  'La IA estructura y propone; las decisiones siguen siendo humanas.',
  'Tu entrada pública no crea iniciativas ni lanza trabajo automáticamente.',
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="shrink-0 rounded-sm text-xl font-semibold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30"
          >
            Starteria
          </Link>

          <nav
            className="hidden items-center gap-5 lg:flex xl:gap-7"
            aria-label="Navegación principal"
          >
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

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to={isAuthenticated ? '/dashboard' : '/auth'}>
                <LogIn aria-hidden="true" size={15} />
                {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
              </Link>
            </Button>
            <Button asChild size="sm">
              <a
                href={PUBLIC_LANDING_CONFIG.demoBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Reservar demo
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="contenido">
        <section
          aria-labelledby="landing-hero-title"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
        >
          <div className="grid min-w-0 items-center gap-9 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] xl:gap-12">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary sm:text-sm">
                De la estrategia al impacto real
              </p>
              <h1
                id="landing-hero-title"
                className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-text-primary sm:text-5xl lg:text-6xl"
              >
                Haz que la estrategia se haga realidad.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
                Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base sm:leading-7">
                Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.
              </p>
              <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button asChild>
                  <a
                    href={PUBLIC_LANDING_CONFIG.demoBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Reservar demo
                    <ArrowRight aria-hidden="true" size={16} />
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/public/start">
                    Quiero alinear mi objetivo primero
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </Button>
              </div>
            </div>

            <ConceptMap />
          </div>
        </section>

        <section
          aria-labelledby="quick-benefits-title"
          className="border-y border-border-default bg-surface-default"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="quick-benefits-title" className="sr-only">
              Beneficios rápidos
            </h2>
            <ul className="grid gap-0 divide-y divide-border-default py-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {QUICK_BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-center gap-3 py-4 text-sm font-semibold text-text-primary sm:justify-center sm:px-4 sm:py-5 sm:text-base"
                >
                  <CheckCircle2 aria-hidden="true" className="shrink-0 text-brand-primary" size={18} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="como-funciona"
          aria-labelledby="value-flow-title"
          className="scroll-mt-24 bg-background-default"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                Cómo te ayuda Starteria
              </p>
              <h2
                id="value-flow-title"
                className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl"
              >
                De una meta a una decisión compartida.
              </h2>
            </div>

            <ol
              role="group"
              aria-label="Flujo conceptual de valor"
              className="mt-8 grid gap-3 lg:grid-cols-4 lg:gap-8"
            >
              {VALUE_FLOW.map(({ title, Icon }, index) => (
                <li
                  key={title}
                  className="relative flex min-w-0 flex-col items-start rounded-ds-lg border border-border-default bg-surface-default px-5 py-5 sm:flex-row sm:items-center sm:gap-4 lg:flex-col lg:items-start lg:gap-3 lg:px-5 lg:py-6"
                >
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-brand-primary">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <Icon aria-hidden="true" className="text-brand-primary" size={22} />
                  </div>
                  <h3 className="mt-3 text-base font-semibold leading-6 text-text-primary sm:mt-0 lg:mt-1">
                    {title}
                  </h3>
                  {index < VALUE_FLOW.length - 1 ? (
                    <>
                      <ArrowDown
                        aria-hidden="true"
                        className="mt-3 self-center text-brand-primary lg:hidden"
                        size={18}
                      />
                      <ArrowRight
                        aria-hidden="true"
                        className="absolute right-[-27px] top-1/2 z-10 hidden -translate-y-1/2 text-brand-primary lg:block"
                        size={18}
                      />
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <StarteriaProductPreview />

        <StrategyExecutionGap />

        <section
          id="confianza"
          aria-labelledby="confianza-title"
          className="scroll-mt-24 bg-background-default"
        >
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                Por qué confiar
              </p>
              <h2
                id="confianza-title"
                className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl"
              >
                Starteria estructura tu contexto sin sustituir tu criterio.
              </h2>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                La plataforma está diseñada para ayudarte a pensar mejor antes de formalizar trabajo, no para decidir por ti.
              </p>
            </div>

            <ul className="divide-y divide-border-default border-y border-border-default">
              {TRUST_PRINCIPLES.map((principle) => (
                <li
                  key={principle}
                  className="flex items-start gap-3 py-4 text-sm leading-6 text-text-primary sm:py-5"
                >
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-brand-primary"
                    size={18}
                  />
                  <span>{principle}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <LandingClosingCta />
      </main>

      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}

function ConceptMap() {
  return (
    <section
      aria-labelledby="concept-map-title"
      className="min-w-0 rounded-ds-lg border border-border-default bg-surface-default p-4 shadow-elevation-none sm:p-6"
    >
      <h2 id="concept-map-title" className="sr-only">
        Modelo conceptual de Starteria
      </h2>
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
        <ConceptList title="Contexto que conecta" items={['Objetivos', 'Necesidades', 'Iniciativas', 'Equipos']} />
        <div className="flex items-center justify-center gap-2 sm:flex-col sm:gap-3">
          <ArrowRight
            aria-hidden="true"
            className="rotate-90 text-brand-primary sm:rotate-0"
            size={20}
          />
          <div className="rounded-ds-md bg-text-primary px-4 py-3 text-center text-text-inverse sm:px-5">
            <p className="text-base font-semibold">Starteria</p>
            <p className="mt-1 text-xs leading-5 text-text-inverse/80">
              Contexto. Trabajo. Decisiones.
            </p>
          </div>
          <ArrowRight
            aria-hidden="true"
            className="rotate-90 text-brand-primary sm:rotate-0"
            size={20}
          />
        </div>
        <ConceptList title="Lectura compartida" items={['Foco', 'Coordinación', 'Evidencia', 'Decisión']} />
      </div>
    </section>
  );
}

function ConceptList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {title}
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-1">
        {items.map((item) => (
          <li
            key={item}
            className="flex min-w-0 items-center gap-2 rounded-ds-md bg-background-subtle px-3 py-2 text-sm font-medium leading-5 text-text-primary"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StrategyExecutionGap() {
  return (
    <section
      id="brecha"
      aria-labelledby="brecha-title"
      className="scroll-mt-24 border-y border-border-default bg-surface-default"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
            Estrategia y ejecución
          </p>
          <h2
            id="brecha-title"
            className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl"
          >
            La brecha entre estrategia y ejecución
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch md:gap-5">
          <GapList title="Hoy: fragmentado" items={TODAY_FRAGMENTED} />

          <div className="flex items-center justify-center gap-3 py-1 md:flex-col md:py-0">
            <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-border-strong md:h-8 md:min-w-0 md:w-px md:flex-none" />
            <span className="whitespace-nowrap rounded-full border border-brand-primary/30 bg-background-subtle px-4 py-2 text-sm font-semibold text-brand-primary">
              La brecha
            </span>
            <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-border-strong md:h-8 md:min-w-0 md:w-px md:flex-none" />
          </div>

          <GapList title="Con Starteria: conectado" items={WITH_STARTERIA} connected />
        </div>
      </div>
    </section>
  );
}

function GapList({
  title,
  items,
  connected = false,
}: {
  title: string;
  items: string[];
  connected?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-ds-lg border border-border-default bg-background-default p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex min-w-0 items-start gap-3 text-sm leading-6 text-text-secondary">
            <span
              aria-hidden="true"
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-brand-primary' : 'bg-border-strong'}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LandingClosingCta() {
  return (
    <section
      aria-labelledby="landing-closing-title"
      className="border-y border-border-default bg-background-subtle"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-12 sm:px-6 sm:py-14 md:flex-row md:items-center md:justify-between lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
            Empieza aquí
          </p>
          <h2
            id="landing-closing-title"
            className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl"
          >
            Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.
          </h2>
        </div>
        <Button asChild variant="secondary" className="shrink-0">
          <Link to="/public/start">
            Analizar mi situación
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function LandingFooter({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <footer className="border-t border-border-default bg-background-default">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link to="/" className="w-fit text-sm font-semibold text-text-primary">
          Starteria
        </Link>
        <nav
          aria-label="Navegación del pie de página"
          className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-text-secondary"
        >
          <a href="#como-funciona" className="hover:text-text-primary">Cómo funciona</a>
          <a href="#vista-producto" className="hover:text-text-primary">Producto</a>
          <a href="#confianza" className="hover:text-text-primary">Confianza</a>
          <Link to={isAuthenticated ? '/dashboard' : '/auth'} className="hover:text-text-primary">
            {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
