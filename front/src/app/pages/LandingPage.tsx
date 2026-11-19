import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleGauge,
  Link2,
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { STARTERIA_FAB_REVEAL_EVENT, StarteriaInteractiveStory } from '../components/landing/StarteriaInteractiveStory';
import { StarteriaMark } from '../components/landing/StarteriaMark';
import { TransformationFlow } from '../components/landing/TransformationFlow';
import { PUBLIC_LANDING_CONFIG } from '../config/publicLanding';
import '../components/landing/landing.css';

const impactItems = [
  { icon: Link2, label: 'Menos esfuerzo de coordinación', detail: 'Objetivos, trabajo y decisiones comparten contexto.' },
  { icon: CircleGauge, label: 'Mayor aprovechamiento de la capacidad de los equipos', detail: 'La capacidad se orienta a lo que más aporta.' },
  { icon: BookOpenCheck, label: 'Mejor conexión y reutilización del conocimiento', detail: 'La evidencia permanece disponible para lo siguiente.' },
  { icon: CheckCircle2, label: 'Decisiones con evidencia', detail: 'Cada avance deja señales que permiten decidir.' },
];

const frictionRows = [
  ['Prioridades discutidas en conversaciones separadas', 'Criterios y objetivos visibles para comparar'],
  ['Ejecución desconectada de la intención inicial', 'Trabajo y evidencia conectados a la iniciativa'],
  ['Aprendizajes repartidos entre documentos y personas', 'Decisiones y conocimiento disponibles para reutilizar'],
];

const bookingLinkProps = {
  href: PUBLIC_LANDING_CONFIG.demoBookingUrl,
  target: '_blank',
  rel: 'noopener noreferrer',
};

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const existingDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const description = existingDescription ?? document.createElement('meta');
    const previousDescription = existingDescription?.content;

    document.title = 'Startería — Haz que cada iniciativa aporte más';
    description.name = 'description';
    description.content = 'Conecta objetivos, equipos y conocimiento para desarrollar iniciativas con claridad, evidencia y capacidad de ejecución.';
    if (!existingDescription) document.head.appendChild(description);

    return () => {
      document.title = previousTitle;
      if (existingDescription) existingDescription.content = previousDescription ?? '';
      else description.remove();
    };
  }, []);

  function revealFab() {
    window.dispatchEvent(new Event(STARTERIA_FAB_REVEAL_EVENT));
  }

  return (
    <div className="landing-root">
      <a className="landing-skip-link" href="#contenido">Saltar al contenido</a>
      <header className="landing-header">
        <div className="landing-shell landing-header__inner">
          <a className="landing-brand" href="#inicio" aria-label="Startería, inicio">
            <StarteriaMark />
            <span>Startería</span>
          </a>
          <nav className="landing-nav landing-nav--desktop" aria-label="Navegación principal">
            <a href="#en-accion">Cómo funciona</a>
            <a href="#impacto">Impacto</a>
            <a href="#fab" onClick={revealFab}>Fab</a>
            <a href="#fricciones">Por qué Startería</a>
          </nav>
          <div className="landing-header__actions">
            <Link className="landing-login" to="/auth">Iniciar sesión</Link>
            <Button asChild size="lg" className="landing-header__cta">
              <a {...bookingLinkProps}>Explorar Startería para mi equipo</a>
            </Button>
            <button
              type="button"
              className="landing-menu-button"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Navegación móvil">
            {[
              ['Cómo funciona', '#en-accion'],
              ['Impacto', '#impacto'],
              ['Startería Fab', '#fab'],
              ['Por qué Startería', '#fricciones'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => {
                  if (href === '#fab') revealFab();
                  setMenuOpen(false);
                }}
              >
                {label}
              </a>
            ))}
            <Link to="/auth" onClick={() => setMenuOpen(false)}>Iniciar sesión</Link>
          </nav>
        )}
      </header>

      <main id="contenido">
        <section className="landing-hero" id="inicio" aria-labelledby="hero-title">
          <div className="landing-shell">
            <div className="landing-hero__copy landing-pop">
              <span className="landing-kicker">Plataforma de inteligencia y desarrollo de iniciativas</span>
              <h1 id="hero-title">Haz que cada iniciativa aporte más.</h1>
              <p className="landing-hero__lead">Conecta objetivos, equipos y conocimiento para desarrollar iniciativas con mayor claridad, menos fricción y decisiones respaldadas por evidencia.</p>
              <p className="landing-hero__system">Startería combina plataforma, asistencia de IA y capacidad tecnológica de Fab.</p>
              <div className="landing-hero__actions">
                <Button asChild size="lg"><a {...bookingLinkProps}>Explorar Startería para mi equipo <ArrowRight aria-hidden="true" /></a></Button>
                <Button asChild size="lg" variant="outline"><a href="#en-accion">Ver cómo funciona</a></Button>
              </div>
            </div>
            <TransformationFlow />
          </div>
        </section>

        <StarteriaInteractiveStory />

        <section className="landing-section landing-impact" id="impacto" aria-labelledby="impact-title">
          <div className="landing-shell" role="region" aria-label="Impacto empresarial">
            <div className="landing-section-heading landing-section-heading--compact">
              <div>
                <span className="landing-kicker">Impacto empresarial</span>
                <h2 id="impact-title">Más capacidad no significa más complejidad.</h2>
              </div>
              <p>Startería ayuda a que la capacidad existente trabaje con un contexto compartido.</p>
            </div>
            <div className="impact-rail">
              {impactItems.map(({ icon: Icon, label, detail }) => (
                <div className="impact-item" key={label}>
                  <Icon aria-hidden="true" />
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-friction" id="fricciones" aria-labelledby="friction-title">
          <div className="landing-shell" role="region" aria-label="Fricciones que Startería ayuda a reducir">
            <div className="landing-section-heading landing-section-heading--compact">
              <div>
                <span className="landing-kicker">Fricciones habituales</span>
                <h2 id="friction-title">Cuando el trabajo se desconecta, el valor se diluye.</h2>
              </div>
              <p>No faltan ideas. Falta continuidad entre lo que se quiere lograr, lo que se hace y lo que se aprende.</p>
            </div>
            <div className="friction-table">
              <div className="friction-table__head"><span>Hoy</span><span>Con Startería</span></div>
              {frictionRows.map(([before, after]) => (
                <div className="friction-table__row" key={before}>
                  <span>{before}</span>
                  <span><ArrowRight aria-hidden="true" />{after}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-conversion" aria-labelledby="conversion-title">
          <div className="landing-shell landing-conversion__inner">
            <div>
              <span className="landing-kicker">Una conversación concreta</span>
              <h2 id="conversion-title">¿Tienes una iniciativa que necesita ser escuchada o avanzar?</h2>
              <p>La primera reunión nos permite conocer la situación y explorar si conviene una demostración contextualizada o un piloto acordado.</p>
            </div>
            <Button asChild size="lg"><a {...bookingLinkProps}>Hablemos de tu iniciativa <ArrowRight aria-hidden="true" /></a></Button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__inner">
          <a className="landing-brand" href="#inicio" aria-label="Startería, volver al inicio"><StarteriaMark /><span>Startería</span></a>
          <p>Inteligencia y capacidad para desarrollar mejores iniciativas.</p>
          <nav aria-label="Navegación del pie de página">
            <a href="#en-accion">Cómo funciona</a>
            <a href="#impacto">Impacto</a>
            <Link to="/auth">Iniciar sesión</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
