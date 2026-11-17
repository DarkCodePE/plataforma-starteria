import type { ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Code2,
  Compass,
  FileCheck2,
  Layers3,
  Lightbulb,
  ShieldCheck,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { useApp } from '../context/AppContext';
import { StarteriaMark } from '../components/landing/StarteriaMark';
import { StarteriaProductPreview } from '../components/landing/StarteriaProductPreview';
import { PUBLIC_LANDING_CONFIG } from '../config/publicLanding';
import '../components/landing/landing.css';

const NAV_LINKS = [
  { href: '#desafios', label: 'Desafíos' },
  { href: '#soluciones', label: 'Soluciones' },
  { href: '#como-trabajamos', label: 'Cómo trabajamos' },
  { href: '#casos', label: 'Casos de uso' },
];

const CHALLENGES: { title: string; description: string; Icon: LucideIcon }[] = [
  {
    title: 'Hay iniciativas, pero no está claro qué aportan.',
    description: 'Ideas, proyectos y reportes dispersos impiden ver qué avanza, qué está bloqueado y qué merece atención.',
    Icon: Layers3,
  },
  {
    title: 'Existe una oportunidad, pero no la capacidad para desarrollarla.',
    description: 'El equipo detecta mejoras o productos posibles, pero depende de recursos técnicos que no están disponibles.',
    Icon: Code2,
  },
  {
    title: 'Se apuesta por soluciones antes de comprobar su valor.',
    description: 'Se invierte tiempo y presupuesto sin suficiente claridad sobre qué problema resolver o qué señal observar.',
    Icon: Lightbulb,
  },
  {
    title: 'El avance no se convierte en una decisión.',
    description: 'Las reuniones muestran actividad, pero cuesta conectar evidencia, responsables y el siguiente paso.',
    Icon: BarChart3,
  },
];

const PROCESS: { title: string; description: string }[] = [
  {
    title: 'Entender',
    description: 'Partimos de tu contexto, problema u oportunidad. Aclaramos qué necesita cambiar y por qué.',
  },
  {
    title: 'Enfocar',
    description: 'Definimos la iniciativa o intervención y las evidencias necesarias para orientarla.',
  },
  {
    title: 'Desarrollar',
    description: 'Activamos el trabajo con tus equipos o abordamos la implementación tecnológica según el alcance.',
  },
  {
    title: 'Aprender y decidir',
    description: 'Conectamos los resultados observados con la decisión de continuar, ajustar, escalar o cerrar.',
  },
];

const USE_CASES = [
  {
    label: 'Empresa con un problema operativo',
    title: 'Automatizar sin comprar tecnología a ciegas.',
    description: 'Aterrizar una fricción, definir una intervención y desarrollar un flujo o MVP cuando exista una apuesta justificable.',
  },
  {
    label: 'Equipo con varias iniciativas',
    title: 'Saber qué está avanzando y qué requiere decisión.',
    description: 'Ordenar trabajo existente, conectar objetivos, detectar bloqueos y preparar una lectura ejecutiva.',
  },
  {
    label: 'Organización explorando crecimiento',
    title: 'Probar una oportunidad antes de escalar.',
    description: 'Estructurar una hipótesis, reunir evidencia y decidir qué merece más inversión o desarrollo.',
  },
];

const eyebrow = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#4F46E5]';
const sectionTitle = 'landing-display text-3xl font-semibold leading-[1.08] text-[#0D1333] sm:text-[2.75rem]';
const sectionLead = 'mt-5 max-w-2xl text-base leading-7 text-[#5D6585]';

function DemoLink({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <a
      href={PUBLIC_LANDING_CONFIG.demoBookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export function LandingPage() {
  const { isAuthenticated } = useApp();

  return (
    <div className="landing-root min-h-screen">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-[#0D1333]"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 border-b border-[#E4E7F5] bg-[#FBFCFF]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold text-[#0D1333]">
            <StarteriaMark />
            Starteria
          </Link>
          <nav aria-label="Navegación principal" className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-[#3B4466] hover:text-[#4F46E5]">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to={isAuthenticated ? '/dashboard' : '/auth'}>
                {isAuthenticated ? 'Ir al panel' : 'Iniciar sesión'}
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-lg">
              <a href={PUBLIC_LANDING_CONFIG.demoBookingUrl} target="_blank" rel="noopener noreferrer">Hablemos <ArrowUpRight aria-hidden="true" size={15} /></a>
            </Button>
          </div>
        </div>
      </header>

      <main id="contenido">
        <section className="relative overflow-hidden bg-[#111329] text-white" aria-labelledby="landing-hero-title">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[38rem] w-[38rem] rounded-full bg-[#5745D6]/30 blur-[110px]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-24 h-[30rem] w-[30rem] rounded-full bg-[#0891B2]/15 blur-[110px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.98fr)] lg:gap-14 lg:px-8 lg:py-28">
            <div className="landing-pop">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ABA6FF]">
                Starteria · Estrategia, plataforma y desarrollo tecnológico
              </p>
              <h1 id="landing-hero-title" className="landing-display mt-6 max-w-3xl text-4xl font-semibold leading-[1.04] sm:text-6xl lg:text-[4.1rem]">
                De una necesidad de negocio a una <span className="text-[#AAA4FF]">solución que genera valor.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#E4E6F6]">
                Combinamos estrategia, ejecución tecnológica e inteligencia artificial para ayudar a tu empresa a identificar oportunidades, desarrollar soluciones y dar seguimiento a sus resultados.
              </p>
              <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 rounded-xl bg-white px-6 text-[#151630] hover:bg-[#EDEBFF]">
                  <a href={PUBLIC_LANDING_CONFIG.demoBookingUrl} target="_blank" rel="noopener noreferrer">Hablemos de tu desafío <ArrowUpRight aria-hidden="true" size={17} /></a>
                </Button>
                <a href="#soluciones" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10">
                  Explorar soluciones <ArrowRight aria-hidden="true" size={16} />
                </a>
              </div>
              <p className="mt-5 text-sm leading-6 text-[#BEC1DE]">Podemos comenzar desde un problema, una oportunidad o un proyecto que ya está en marcha.</p>
            </div>
            <SystemIllustration />
          </div>
        </section>

        <section id="desafios" className="scroll-mt-24 bg-[#FBFCFF] px-4 py-20 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="desafios-title">
          <div className="mx-auto max-w-7xl">
            <p className={eyebrow}>El punto de partida</p>
            <h2 id="desafios-title" className={sectionTitle + ' mt-4 max-w-3xl'}>
              Las oportunidades no se pierden por falta de ideas.
            </h2>
            <p className={sectionLead}>Muchas empresas ya saben qué quieren mejorar. El reto es pasar de la intención a un trabajo que avance y permita comprobar su contribución.</p>
            <div className="mt-11 grid gap-4 md:grid-cols-2">
              {CHALLENGES.map(({ title, description, Icon }) => (
                <article key={title} className="landing-card rounded-2xl p-6 sm:p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF1FF] text-[#4F46E5]">
                    <Icon aria-hidden="true" size={22} />
                  </span>
                  <h3 className="mt-6 max-w-md text-xl font-semibold leading-snug text-[#0D1333]">{title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-[#5D6585]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="soluciones" className="scroll-mt-24 border-y border-[#E4E7F5] bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="soluciones-title">
          <div className="mx-auto max-w-7xl">
            <p className={eyebrow}>Una propuesta, distintas formas de trabajar</p>
            <h2 id="soluciones-title" className={sectionTitle + ' mt-4 max-w-3xl'}>
              Lo que necesitas para pasar de la oportunidad a la ejecución.
            </h2>
            <p className={sectionLead}>Puedes abordar una iniciativa con Starteria Platform, solicitar desarrollo tecnológico con Starteria Fab o combinar ambas capacidades.</p>

            <div className="mt-11 grid gap-5 lg:grid-cols-2">
              <article className="relative overflow-hidden rounded-3xl border border-[#DADCF1] bg-[#F6F7FF] p-7 sm:p-9">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E2E5FF] text-[#4F46E5]"><Layers3 aria-hidden="true" /></span>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#4F46E5]">Starteria Platform</p>
                </div>
                <h3 className="landing-display mt-7 max-w-md text-3xl font-semibold leading-tight text-[#0D1333]">Haz que tus iniciativas tengan dirección y seguimiento.</h3>
                <p className="mt-4 leading-7 text-[#475075]">Estructura problemas y oportunidades, activa trabajo, conecta evidencia y prepara decisiones con tu equipo.</p>
                <ul className="mt-7 space-y-3 text-sm text-[#293251]">
                  <Benefit>Contexto y prioridades conectadas</Benefit>
                  <Benefit>Iniciativas, responsables y bloqueos visibles</Benefit>
                  <Benefit>Evidencia y seguimiento de decisiones</Benefit>
                </ul>
              </article>
              <article className="relative overflow-hidden rounded-3xl border border-[#2B3055] bg-[#181C37] p-7 text-white sm:p-9">
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-12 h-56 w-56 rounded-full bg-[#4F46E5]/25 blur-3xl" />
                <div className="relative flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#333862] text-[#B9B3FF]"><Code2 aria-hidden="true" /></span>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#B9B3FF]">Starteria Fab</p>
                </div>
                <h3 className="landing-display relative mt-7 max-w-md text-3xl font-semibold leading-tight">De la propuesta al software que puedes probar.</h3>
                <p className="relative mt-4 leading-7 text-[#D5D9EF]">Capacidad de ingeniería de software asistida por agentes para construir, revisar y probar soluciones con control humano.</p>
                <ul className="relative mt-7 space-y-3 text-sm text-[#EFF0FB]">
                  <Benefit>Prototipos, MVPs y automatizaciones según alcance</Benefit>
                  <Benefit>Desarrollo con revisión técnica y pruebas</Benefit>
                  <Benefit>Entrega trazable y evolución por iteraciones</Benefit>
                </ul>
              </article>
            </div>
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#DFE2F2] bg-[#FBFCFF] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-widest text-[#4F46E5]">Servicio integrado</p>
                <h3 className="mt-2 text-xl font-semibold text-[#0D1333]">Platform aporta la trazabilidad. Fab aporta capacidad de construcción.</h3>
                <p className="mt-2 text-sm leading-6 text-[#5D6585]">La integración completa está en evolución: el alcance y los compromisos de cada proyecto se acuerdan antes de empezar.</p>
              </div>
              <DemoLink className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#4F46E5] hover:underline">
                Cuéntanos qué necesitas <ArrowUpRight aria-hidden="true" size={16}/>
              </DemoLink>
            </div>
          </div>
        </section>

        <section id="como-trabajamos" className="scroll-mt-24 bg-[#F5F7FC] px-4 py-20 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="proceso-title">
          <div className="mx-auto max-w-7xl">
            <p className={eyebrow}>Cómo trabajamos</p>
            <h2 id="proceso-title" className={sectionTitle + ' mt-4 max-w-3xl'}>De la primera conversación a una decisión sustentada.</h2>
            <p className={sectionLead}>La ruta se adapta a tu situación: no todas las empresas necesitan una plataforma completa ni todos los desafíos requieren desarrollar software.</p>
            <ol className="mt-11 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Proceso de colaboración">
              {PROCESS.map((step, index) => (
                <li key={step.title} className="landing-card rounded-2xl p-6">
                  <span className="text-xs font-semibold tracking-widest text-[#4F46E5]">{String(index + 1).padStart(2, '0')} / 04</span>
                  <h3 className="mt-8 text-xl font-semibold text-[#0D1333]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5D6585]">{step.description}</p>
                </li>
              ))}
            </ol>
            <StarteriaProductPreview />
          </div>
        </section>

        <section id="casos" className="scroll-mt-24 bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="casos-title">
          <div className="mx-auto max-w-7xl">
            <p className={eyebrow}>Ejemplos de aplicación</p>
            <h2 id="casos-title" className={sectionTitle + ' mt-4 max-w-3xl'}>Un punto de partida diferente. Una ruta adecuada a cada desafío.</h2>
            <p className={sectionLead}>Situaciones ilustrativas para entender dónde Starteria puede ayudar. No son casos de clientes ni resultados verificados.</p>
            <div className="mt-11 grid gap-5 lg:grid-cols-3">
              {USE_CASES.map((item) => (
                <article key={item.title} className="rounded-2xl border border-[#E2E5F1] bg-[#FBFCFF] p-7">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5]">{item.label}</p>
                  <h3 className="mt-5 text-xl font-semibold leading-snug text-[#0D1333]">{item.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#5D6585]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="confianza" className="scroll-mt-24 border-t border-[#E4E7F5] bg-[#FBFCFF] px-4 py-20 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="confianza-title">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
            <div>
              <p className={eyebrow}>Tecnología con criterio</p>
              <h2 id="confianza-title" className={sectionTitle + ' mt-4'}>La IA ayuda a avanzar. La responsabilidad sigue siendo humana.</h2>
              <p className={sectionLead}>Starteria puede apoyar análisis, estructura, desarrollo y seguimiento. La evidencia externa, las decisiones de negocio y las aprobaciones siguen dependiendo de las personas autorizadas.</p>
            </div>
            <div className="grid gap-3">
              <TrustItem icon={Compass} title="Partimos del negocio" body="No asumimos que la primera idea o tecnología propuesta sea necesariamente la solución correcta." />
              <TrustItem icon={ShieldCheck} title="Validaciones y revisión" body="El trabajo técnico puede incluir comprobaciones automáticas y revisión humana, según el alcance contratado." />
              <TrustItem icon={FileCheck2} title="Evidencia trazable" body="Separamos lo observado de las hipótesis y las recomendaciones antes de una decisión." />
            </div>
          </div>
        </section>

        <section aria-labelledby="landing-closing-title" className="bg-[#111329] px-4 py-20 text-white sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#AAA4FF]">Empecemos por lo importante</p>
              <h2 id="landing-closing-title" className="landing-display mt-4 text-3xl font-semibold leading-tight sm:text-5xl">¿Qué necesita cambiar en tu negocio?</h2>
              <p className="mt-5 text-base leading-7 text-[#D8DBEF]">Cuéntanos el desafío. Evaluemos si conviene enfocarlo, desarrollar una solución, ordenar iniciativas o combinar estos caminos.</p>
            </div>
            <Button asChild size="lg" className="h-12 shrink-0 rounded-xl bg-white px-7 text-[#151630] hover:bg-[#EDEBFF]">
              <a href={PUBLIC_LANDING_CONFIG.demoBookingUrl} target="_blank" rel="noopener noreferrer">Hablemos de tu desafío <ArrowUpRight aria-hidden="true" size={17} /></a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E4E7F5] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-[#0D1333]"><StarteriaMark />Starteria</Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#5D6585]">De necesidades y oportunidades a iniciativas, tecnología y decisiones con evidencia.</p>
          </div>
          <nav aria-label="Navegación del pie de página" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#3B4466]">
            <a href="#soluciones" className="hover:text-[#4F46E5]">Soluciones</a>
            <a href="#como-trabajamos" className="hover:text-[#4F46E5]">Cómo trabajamos</a>
            <DemoLink className="hover:text-[#4F46E5]">Conversemos</DemoLink>
            <Link to={isAuthenticated ? '/dashboard' : '/auth'} className="hover:text-[#4F46E5]">{isAuthenticated ? 'Ir al panel' : 'Acceder'}</Link>
          </nav>
        </div>
        <p className="border-t border-[#E4E7F5] px-4 py-5 text-center text-xs text-[#5D6585]">© Starteria. Las decisiones siguen siendo de las personas.</p>
      </footer>
    </div>
  );
}

function Benefit({ children }: { children: ReactNode }) {
  return <li className="flex items-start gap-2.5"><CheckCircle2 aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-[#7C76F5]" />{children}</li>;
}

function SystemIllustration() {
  return (
    <figure aria-label="Modelo ilustrativo de Starteria Platform y Fab" className="landing-pop relative rounded-3xl border border-white/20 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-sm sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#BDBAFF]">Una misma necesidad, varias capacidades</span>
        <span className="h-2 w-2 rounded-full bg-[#72D2BE]" aria-hidden="true" />
      </div>
      <div className="mt-6 rounded-xl border border-white/15 bg-[#0F1226] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#AAA4FF]">Punto de partida</p>
        <p className="mt-2 text-lg font-medium text-white">Problema · Oportunidad · Iniciativa existente</p>
        <p className="mt-2 text-xs leading-5 text-[#B9BFDB]">El trabajo comienza desde tu contexto real.</p>
      </div>
      <div className="mx-auto h-7 w-px bg-gradient-to-b from-[#aaa4ff] to-transparent" aria-hidden="true" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#8C88DD]/30 bg-[#2D2B59] p-5">
          <Layers3 size={23} className="text-[#BDBAFF]" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-white">Platform</h3>
          <p className="mt-2 text-sm leading-6 text-[#CED1F5]">Contexto, iniciativas, evidencia y decisiones</p>
        </div>
        <div className="rounded-xl border border-[#4C9FBB]/30 bg-[#16384C] p-5">
          <Code2 size={23} className="text-[#8AD3E8]" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-white">Fab</h3>
          <p className="mt-2 text-sm leading-6 text-[#C5E2ED]">Construcción, pruebas y entrega tecnológica</p>
        </div>
      </div>
      <div className="mx-auto h-7 w-px bg-gradient-to-b from-[#aaa4ff] to-transparent" aria-hidden="true" />
      <div className="flex items-start gap-3 rounded-xl border border-[#72D2BE]/25 bg-[#18373E] p-5">
        <Target size={23} className="mt-0.5 shrink-0 text-[#72D2BE]" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold text-white">Trabajo verificable y siguiente decisión</p>
          <p className="mt-1 text-sm leading-6 text-[#C4E4E3]">Entregables, resultados observados y continuidad acordada.</p>
        </div>
      </div>
      <figcaption className="mt-5 text-xs leading-5 text-[#B9BFDB]">
        Modelo conceptual, no una integración autónoma certificada. La intervención depende del alcance definido con cada empresa.
      </figcaption>
    </figure>
  );
}

function TrustItem({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article className="landing-card flex gap-4 rounded-xl p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF1FF] text-[#4F46E5]"><Icon aria-hidden="true" size={21}/></span>
      <div>
        <h3 className="text-base font-semibold text-[#0D1333]">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-[#5D6585]">{body}</p>
      </div>
    </article>
  );
}
