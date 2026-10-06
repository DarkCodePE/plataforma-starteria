import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CircleCheck,
  FileText,
  LayoutGrid,
  Lock,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { useApp } from '../context/AppContext';
import { ConceptMap } from '../components/landing/ConceptMap';
import { StarteriaMark } from '../components/landing/StarteriaMark';
import { StarteriaProductPreview } from '../components/landing/StarteriaProductPreview';
import { PUBLIC_LANDING_CONFIG } from '../config/publicLanding';
import '../components/landing/landing.css';

const NAV_LINKS = [
  { href: '#vista-producto', label: 'Producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#metodologia', label: 'Metodología' },
  { href: '#confianza', label: 'Confianza' },
];

const QUICK_BENEFITS: { label: string; Icon: LucideIcon }[] = [
  { label: 'Más claridad en menos tiempo', Icon: Zap },
  { label: 'Equipos alineados de verdad', Icon: Users },
  { label: 'Decisiones con evidencia', Icon: BarChart3 },
];

const VALUE_FLOW: { title: string; description: string; Icon: LucideIcon }[] = [
  {
    title: 'Define la meta',
    description: 'Convierte una intención en un objetivo claro y accionable.',
    Icon: Target,
  },
  {
    title: 'Alinea el trabajo',
    description: 'Conecta iniciativas, personas y recursos.',
    Icon: LayoutGrid,
  },
  {
    title: 'Hazlas realidad',
    description: 'Ejecuta con visibilidad, colaboración y evidencia.',
    Icon: Users,
  },
  {
    title: 'Decide',
    description: 'Visualiza opciones y toma decisiones con contexto.',
    Icon: BarChart3,
  },
];

const TODAY_FRAGMENTED: { label: string; Icon: LucideIcon }[] = [
  { label: 'Objetivos aislados', Icon: Target },
  { label: 'Equipos desconectados', Icon: Users },
  { label: 'Contexto perdido', Icon: LayoutGrid },
  { label: 'Decisiones tardías', Icon: CircleCheck },
];

const WITH_STARTERIA: { label: string; Icon: LucideIcon }[] = [
  { label: 'Foco compartido', Icon: Target },
  { label: 'Trabajo coordinado', Icon: Users },
  { label: 'Evidencia conectada', Icon: BarChart3 },
  { label: 'Decisiones trazables', Icon: CircleCheck },
];

const START_PATH = [
  {
    stage: 'Entrada pública',
    title: 'Cuéntanos qué quieres mover',
    body: 'Describe tu objetivo o tu situación con tus palabras. No necesitas tenerlo todo resuelto para empezar.',
    tags: ['Texto libre', 'Contexto incompleto vale'],
  },
  {
    stage: 'Primera lectura',
    title: 'Recibe una lectura ordenada',
    body: 'Starteria ordena lo que contaste: qué está claro, qué falta aclarar y por dónde conviene seguir.',
    tags: ['Pública', 'Revisable'],
  },
  {
    stage: 'Trabajo formal',
    title: 'Formaliza con tu equipo',
    body: 'Cuando decides continuar, la lectura se convierte en iniciativas, equipos y evidencia dentro de la plataforma.',
    tags: ['Revisión humana', 'Trazable'],
  },
];

const TRUST_PRINCIPLES: { title: string; detail: string; Icon: LucideIcon }[] = [
  {
    title: 'Puedes empezar con contexto incompleto.',
    detail: 'No necesitas tener todo resuelto para comenzar.',
    Icon: ShieldCheck,
  },
  {
    title: 'Nada se convierte en trabajo formal sin revisión.',
    detail: 'Tú mantienes el control en todo momento.',
    Icon: FileText,
  },
  {
    title: 'La IA estructura y propone; las decisiones siguen siendo humanas.',
    detail: 'Tu experiencia y criterio son insustituibles.',
    Icon: UserRound,
  },
  {
    title: 'Tu entrada pública no crea iniciativas automáticamente.',
    detail: 'Tú decides qué se formaliza y qué avanza.',
    Icon: Lock,
  },
];

const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary';
const sectionTitle = 'landing-display text-3xl font-semibold leading-[1.12] text-[#0D1333] sm:text-[2.5rem]';
const sectionLead = 'text-base leading-7 text-[#5D6585]';

export function LandingPage() {
  const { isAuthenticated } = useApp();

  return (
    <div className="landing-root min-h-screen">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-ds-sm focus:bg-surface-default focus:px-4 focus:py-3 focus:text-text-primary focus:shadow-elevation-overlay"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 border-b border-[#E4E7F5]/70 bg-[#FBFCFF]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-sm text-lg font-semibold tracking-tight text-[#0D1333] sm:text-xl"
          >
            <StarteriaMark />
            Starteria
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#3B4466] transition-colors hover:text-brand-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden h-9 rounded-lg px-4 sm:inline-flex">
              <Link to={isAuthenticated ? '/dashboard' : '/auth'}>
                {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 rounded-lg px-4 shadow-[0_6px_16px_-6px_rgb(79_70_229/0.6)]">
              <a href={PUBLIC_LANDING_CONFIG.demoBookingUrl} target="_blank" rel="noopener noreferrer">
                Reservar demo
                <ArrowRight aria-hidden="true" size={15} className="hidden sm:block" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="contenido">
        <section aria-labelledby="landing-hero-title" className="landing-wash relative scroll-mt-24 overflow-hidden">
          <div className="mx-auto grid max-w-7xl min-w-0 items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-20 lg:pt-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)] xl:gap-10">
            <div className="landing-pop min-w-0">
              <p className={eyebrow}>De la estrategia al impacto real</p>
              <h1
                id="landing-hero-title"
                className="landing-display mt-5 max-w-xl text-[2.6rem] font-semibold leading-[1.04] text-[#0D1333] sm:text-6xl"
              >
                Haz que la estrategia <span className="text-brand-primary">se haga realidad.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg font-medium leading-7 text-[#1B2147]">
                Conecta lo que tu empresa quiere mover con el trabajo, las personas y la evidencia necesarias para lograrlo.
              </p>
              <p className="mt-3 max-w-xl text-base leading-7 text-[#5D6585]">
                Starteria reduce silos, mantiene contexto y convierte avance en decisiones más claras.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 rounded-xl px-6 text-[15px] shadow-[0_10px_24px_-10px_rgb(79_70_229/0.7)]">
                  <a href={PUBLIC_LANDING_CONFIG.demoBookingUrl} target="_blank" rel="noopener noreferrer">
                    Reservar demo
                    <ArrowRight aria-hidden="true" size={16} />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl border-[#C7D2FE] px-6 text-[15px] text-brand-primary hover:border-brand-primary hover:bg-brand-primary-subtle hover:text-[#3730A3]"
                >
                  <Link to="/public/start">Quiero alinear mi objetivo primero</Link>
                </Button>
              </div>

              <section aria-labelledby="quick-benefits-title" className="mt-10">
                <h2 id="quick-benefits-title" className="sr-only">
                  Beneficios rápidos
                </h2>
                <ul className="grid gap-4 sm:grid-cols-3 sm:gap-3">
                  {QUICK_BENEFITS.map(({ label, Icon }) => (
                    <li key={label} className="flex items-center gap-3 text-[13px] font-medium leading-5 text-[#3B4466]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary shadow-[0_2px_8px_-2px_rgb(13_19_51/0.12)] ring-1 ring-[#E4E7F5]">
                        <Icon aria-hidden="true" size={17} />
                      </span>
                      <span className="max-w-[9.5rem]">{label}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <ConceptMap />
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="value-flow-title" className="scroll-mt-24 border-t border-[#E4E7F5]/80 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className={eyebrow}>Cómo funciona</p>
              <h2 id="value-flow-title" className={`${sectionTitle} mt-4`}>
                Cómo te ayuda Starteria
              </h2>
              <p className={`${sectionLead} mt-4`}>
                No se trata solo de ordenar. Starteria te ayuda a entender qué quieres mover, coordinar el trabajo y
                cerrar el ciclo con evidencia para decidir.
              </p>
            </div>

            <ol role="group" aria-label="Flujo conceptual de valor" className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {VALUE_FLOW.map(({ title, description, Icon }, index) => (
                <li key={title} className="relative min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#EEF2FF] to-[#E0E7FF] text-brand-primary ring-8 ring-[#F6F7FD]">
                      <Icon aria-hidden="true" size={26} strokeWidth={1.9} />
                    </span>
                    <span className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[#E4E7F5] bg-white px-2 text-xs font-semibold tabular-nums text-brand-primary">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {index < VALUE_FLOW.length - 1 ? (
                      <span aria-hidden="true" className="ml-1 hidden flex-1 items-center text-[#A5B4FC] lg:flex">
                        <span className="h-px flex-1 bg-[#C7D2FE]" />
                        <ArrowRight size={14} className="-ml-1" />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-5 border-l border-[#E4E7F5] pl-4">
                    <h3 className="text-base font-semibold text-[#0D1333]">{title}</h3>
                    <p className="mt-1.5 max-w-[16rem] text-sm leading-6 text-[#5D6585]">{description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <StarteriaProductPreview />
          </div>
        </section>

        <StrategyExecutionGap />

        <StartPath />

        <section id="confianza" aria-labelledby="confianza-title" className="scroll-mt-24 bg-[#F6F7FD]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10 lg:px-8 lg:py-24">
            <div>
              <p className={eyebrow}>Por qué confiar</p>
              <h2 id="confianza-title" className={`${sectionTitle} mt-4`}>
                Starteria estructura tu contexto sin sustituir tu criterio.
              </h2>
              <p className={`${sectionLead} mt-4 max-w-md`}>
                La plataforma está diseñada para ayudarte a pensar mejor antes de formalizar trabajo, no para decidir por
                ti.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {TRUST_PRINCIPLES.map(({ title, detail, Icon }) => (
                <li key={title} className="landing-card flex items-start gap-4 rounded-2xl p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary-subtle text-brand-primary">
                    <Icon aria-hidden="true" size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 text-[#0D1333]">{title}</p>
                    <p className="mt-1.5 text-[13px] leading-5 text-[#5D6585]">{detail}</p>
                  </div>
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

// The gap diagram is drawn in a 900×300 box; item rows sit on these vertical centers.
const GAP_ROW_Y = [76, 130, 184, 238];
const TANGLE = [
  'M300 76 C 372 76, 360 236, 412 190',
  'M300 130 C 380 130, 352 60, 412 116',
  'M300 184 C 366 184, 388 96, 412 162',
  'M300 238 C 376 238, 350 140, 412 140',
  'M300 76 C 350 116, 396 200, 412 214',
];

const gapRowStyle = (index: number) => ({ '--y': `${(GAP_ROW_Y[index] / 300) * 100}%` }) as CSSProperties;

function StrategyExecutionGap() {
  return (
    <section id="brecha" aria-labelledby="brecha-title" className="relative scroll-mt-24 overflow-hidden border-t border-[#E4E7F5]/80 bg-[#FBFCFF]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className={eyebrow}>La brecha que queremos cerrar</p>
          <h2 id="brecha-title" className={`${sectionTitle} mt-4`}>
            Entre la estrategia y la ejecución se pierde demasiado.
          </h2>
          <p className={`${sectionLead} mt-4`}>
            Buenas ideas, mucho trabajo y poco resultado. Starteria cierra esa brecha con contexto, conexión y evidencia.
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl lg:mt-20">
          <p
            aria-hidden="true"
            className="landing-hand absolute -right-4 -top-16 z-10 hidden rotate-[-6deg] text-2xl leading-6 text-[#5D6585] lg:block"
          >
            Mismo talento.
            <br />
            Mayor impacto.
            <svg viewBox="0 0 60 40" aria-hidden="true" fill="none" className="ml-auto mt-1 block h-10 w-14 text-[#5D6585]">
              <path d="M48 2c4 18-8 30-38 32" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="m16 28-6 6 7 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </p>

          <div className="relative grid gap-4 lg:block lg:aspect-[900/300]">
            <svg
              viewBox="0 0 900 300"
              aria-hidden="true"
              fill="none"
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            >
              {TANGLE.map((d) => (
                <path key={d} d={d} stroke="#FB7185" strokeWidth="1.25" opacity="0.55" />
              ))}
              {GAP_ROW_Y.map((y) => (
                <circle key={`l${y}`} cx="300" cy={y} r="3.5" fill="#FB7185" />
              ))}
              <line x1="450" y1="12" x2="450" y2="288" stroke="#CBD5E1" strokeDasharray="4 6" />
              {GAP_ROW_Y.map((y) => (
                <g key={`r${y}`}>
                  <path d={`M488 150 C 540 150, 528 ${y}, 600 ${y}`} stroke="#C7D2FE" strokeWidth="1.5" pathLength={1} className="landing-draw" />
                  <path d={`M488 150 C 540 150, 528 ${y}, 600 ${y}`} stroke="#6366F1" strokeWidth="1.5" className="landing-flow" opacity="0.65" />
                  <circle cx="600" cy={y} r="3.5" fill="#4F46E5" />
                </g>
              ))}
            </svg>

            <GapPanel title="Hoy: fragmentado" items={TODAY_FRAGMENTED} tone="fragmented" />

            <div className="flex items-center justify-center lg:absolute lg:inset-y-0 lg:left-1/2 lg:w-[12%] lg:-translate-x-1/2 lg:rounded-2xl lg:bg-gradient-to-b lg:from-white/0 lg:via-white lg:to-white/0 lg:shadow-[0_18px_40px_-24px_rgb(49_46_129/0.35)]">
              <span className="landing-card rounded-2xl px-5 py-3 text-center text-sm font-semibold leading-5 text-[#0D1333] lg:border-0 lg:bg-transparent lg:shadow-none">
                La
                <br className="hidden lg:block" /> brecha
              </span>
            </div>

            <GapPanel title="Con Starteria: conectado" items={WITH_STARTERIA} tone="connected" />
          </div>
        </div>
      </div>
    </section>
  );
}

function GapPanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: { label: string; Icon: LucideIcon }[];
  tone: 'fragmented' | 'connected';
}) {
  const fragmented = tone === 'fragmented';
  return (
    <section
      className={`relative min-w-0 rounded-2xl p-4 lg:absolute lg:inset-y-0 lg:w-[33.4%] lg:p-0 ${
        fragmented ? 'bg-[#FFF5F6] lg:left-0' : 'bg-[#F4F6FF] lg:right-0'
      }`}
    >
      <h3
        className={`text-sm font-semibold lg:absolute lg:left-4 lg:top-4 ${
          fragmented ? 'text-[#BE123C]' : 'text-brand-primary'
        }`}
      >
        {title}
      </h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:mt-0 lg:block">
        {items.map(({ label, Icon }, index) => (
          <li
            key={label}
            style={gapRowStyle(index)}
            className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#1B2147] shadow-[0_1px_2px_rgb(13_19_51/0.05)] ring-1 lg:absolute lg:top-[var(--y)] lg:-translate-y-1/2 ${
              fragmented ? 'ring-[#FFE4E8] lg:left-4 lg:right-6' : 'ring-[#E0E7FF] lg:left-6 lg:right-4'
            }`}
          >
            <Icon aria-hidden="true" size={16} className={fragmented ? 'shrink-0 text-[#E11D48]' : 'shrink-0 text-brand-primary'} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StartPath() {
  return (
    <section id="metodologia" aria-labelledby="metodologia-title" className="landing-wash scroll-mt-24 border-t border-[#E4E7F5]/80">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className={eyebrow}>Metodología</p>
            <h2 id="metodologia-title" className={`${sectionTitle} mt-4`}>
              Empiezas con lo que sabes y avanzas cuando decides.
            </h2>
          </div>
          <p className={`${sectionLead} max-w-sm`}>
            Tres momentos, una sola línea de contexto. Cada paso queda revisable antes de convertirse en trabajo.
          </p>
        </div>

        <ol className="relative mt-12 grid gap-5 lg:grid-cols-3">
          <span aria-hidden="true" className="absolute left-8 right-8 top-[22px] hidden h-px bg-gradient-to-r from-[#C7D2FE] via-[#A5B4FC] to-[#C7D2FE] lg:block" />
          {START_PATH.map((step, index) => (
            <li key={step.title} className="relative flex min-w-0 flex-col">
              <span className="relative z-10 inline-flex w-fit items-center gap-2 rounded-full border border-[#C7D2FE] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#3730A3]">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-primary" style={{ opacity: 0.4 + index * 0.3 }} />
                {step.stage}
              </span>
              <div className="landing-card mt-4 flex flex-1 flex-col rounded-2xl p-6">
                <h3 className="text-lg font-semibold tracking-tight text-[#0D1333]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5D6585]">{step.body}</p>
                <ul className="mt-5 flex flex-wrap gap-2 pt-1">
                  {step.tags.map((tag) => (
                    <li key={tag} className="rounded-md bg-[#F6F7FD] px-2.5 py-1 text-xs font-medium text-[#3B4466]">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold">
          <Link to="/public/start" className="inline-flex items-center gap-1.5 text-brand-primary hover:text-[#3730A3]">
            Empezar por la entrada pública
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
          <a
            href={PUBLIC_LANDING_CONFIG.demoBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#3B4466] hover:text-[#0D1333]"
          >
            Verlo con el equipo de Starteria
            <ArrowUpRight aria-hidden="true" size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}

function LandingClosingCta() {
  return (
    <section aria-labelledby="landing-closing-title" className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#EEF1FF] via-[#F4F6FF] to-[#EAF6FF] px-6 py-10 ring-1 ring-[#E0E7FF] sm:px-10 md:flex-row md:items-center md:justify-between lg:px-14 lg:py-12">
        <div aria-hidden="true" className="landing-dots pointer-events-none absolute -right-6 -top-6 h-32 w-48 opacity-40" />
        <div className="relative max-w-3xl">
          <p className={eyebrow}>De la idea al siguiente paso</p>
          <h2 id="landing-closing-title" className="landing-display mt-4 text-2xl font-semibold leading-tight text-[#0D1333] sm:text-[2rem]">
            Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.
          </h2>
          <p className="mt-3 text-base leading-7 text-[#5D6585]">
            La primera lectura es pública y revisable. El trabajo formal empieza cuando decides continuar.
          </p>
        </div>
        <div className="relative flex shrink-0 flex-col items-start gap-2 md:items-center">
          <Button asChild size="lg" className="h-12 rounded-xl px-6 text-[15px] shadow-[0_10px_24px_-10px_rgb(79_70_229/0.7)]">
            <Link to="/public/start">
              Analizar mi situación
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Button>
          <p className="text-xs text-[#5D6585]">Sin compromiso.</p>
        </div>
      </div>
    </section>
  );
}

function LandingFooter({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <footer className="border-t border-[#E4E7F5] bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] lg:px-8">
        <div>
          <Link to="/" className="flex w-fit items-center gap-2 text-lg font-semibold tracking-tight text-[#0D1333]">
            <StarteriaMark className="h-6 w-6" />
            Starteria
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-6 text-[#5D6585]">
            Contexto, trabajo y decisiones en un mismo lugar, para que la estrategia llegue a resultados.
          </p>
        </div>
        <nav aria-label="Navegación del pie de página" className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <FooterColumn title="Producto">
            <a href="#vista-producto">Caso ilustrativo</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#metodologia">Metodología</a>
          </FooterColumn>
          <FooterColumn title="Confianza">
            <a href="#confianza">Por qué confiar</a>
            <a href="#brecha">La brecha</a>
          </FooterColumn>
          <FooterColumn title="Empezar">
            <Link to="/public/start">Entrada pública</Link>
            <a href={PUBLIC_LANDING_CONFIG.demoBookingUrl} target="_blank" rel="noopener noreferrer">
              Agendar una demo
            </a>
            <Link to={isAuthenticated ? '/dashboard' : '/auth'}>{isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}</Link>
          </FooterColumn>
        </nav>
      </div>
      <div className="border-t border-[#E4E7F5]">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-[#5D6585] sm:px-6 lg:px-8">
          © Starteria. Las decisiones siguen siendo de las personas.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 [&>a]:w-fit [&>a]:text-[#3B4466] [&>a:hover]:text-brand-primary">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0D1333]">{title}</p>
      {children}
    </div>
  );
}
