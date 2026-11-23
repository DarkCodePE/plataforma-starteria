import { Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { StarteriaInteractiveStory } from '../components/landing/StarteriaInteractiveStory';
import { TransformationFlow } from '../components/landing/TransformationFlow';
import { PUBLIC_LANDING_CONFIG } from '../config/publicLanding';
import '../components/landing/landing.css';

const bookingLinkProps = {
  href: PUBLIC_LANDING_CONFIG.demoBookingUrl,
  target: '_blank',
  rel: 'noopener noreferrer',
};

const navItems = [
  ['Cómo funciona', '#como-funciona'],
  ['Fab', '#fab'],
  ['Impacto', '#impacto'],
  ['Confianza', '#confianza'],
];

const impactItems = [
  ['◈', 'Foco', 'Objetivos y criterios más claros para comparar iniciativas y asignar esfuerzos.'],
  ['⌁', 'Coordinación', 'Roles, apoyos y checkpoints visibles en los momentos que importan.'],
  ['↗', 'Ejecución', 'Guía contextual para investigar, diseñar, probar y tomar el siguiente paso.'],
  ['↻', 'Aprendizaje', 'Hallazgos y decisiones trazables que pueden servir a iniciativas posteriores.'],
];

const faqItems = [
  ['¿Tengo que cambiar las herramientas que ya utilizo?', 'La propuesta busca aprovechar tu contexto, pero no todas las integraciones están disponibles hoy. Durante una evaluación debemos verificar las conexiones concretas, los permisos y el trabajo que sí puede realizarse desde Startería.'],
  ['¿Se compartirán mis datos con modelos de IA?', 'Antes de conectar datos corporativos deben acordarse permisos, origen, tratamiento y proveedores autorizados. No podemos presentar como certificados acuerdos, controles o modalidades de procesamiento que aún no se hayan comprobado.'],
  ['¿Puedo usar mis propios LLMs de confianza?', 'La ejecución con modelos autorizados por cada empresa es una dirección de producto. Fab documenta compatibilidad con diversos proveedores, pero no debe confundirse con una sincronización multicanal certificada de toda Startería Platform.'],
  ['¿Cómo sé si vamos bien?', 'Con objetivos e indicadores acordados, checkpoints, evidencias y resultados comparables. Terminar una actividad no prueba por sí solo que se haya conseguido impacto de negocio.'],
  ['¿Startería sustituye Jira o una herramienta de tareas?', 'Su valor propuesto es conectar objetivos, iniciativas, guía, evidencia y aprendizaje. No necesita plantearse como sustituto de todas las herramientas de gestión que ya existen en la organización.'],
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const existingDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const description = existingDescription ?? document.createElement('meta');
    const previousDescription = existingDescription?.content;

    document.title = 'Startería — De objetivos a iniciativas que avanzan y aprenden';
    description.name = 'description';
    description.content = 'Startería conecta objetivos, iniciativas, ejecución guiada y aprendizaje para decidir mejor qué merece avanzar.';
    if (!existingDescription) document.head.appendChild(description);

    return () => {
      document.title = previousTitle;
      if (existingDescription) existingDescription.content = previousDescription ?? '';
      else description.remove();
    };
  }, []);

  return (
    <div className="landing-root">
      <a className="landing-skip-link" href="#contenido">Saltar al contenido</a>
      <header className="landing-header">
        <div className="landing-shell landing-header-inner">
          <a className="landing-brand" href="#inicio" aria-label="Startería, volver al inicio">
            <span className="landing-brand-symbol" aria-hidden="true">✳</span>
            Startería
          </a>
          <nav className="landing-nav-links" aria-label="Navegación principal">
            {navItems.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <div className="landing-nav-actions">
            <a className="landing-conversation-link" href="#cta">Conversemos</a>
            <a className="landing-btn landing-header-cta" {...bookingLinkProps}>Solicitar demo <span aria-hidden="true">↗</span></a>
            <button
              type="button"
              className="landing-menu-button"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Navegación móvil">
            {navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
            <a {...bookingLinkProps} onClick={() => setMenuOpen(false)}>Solicitar demo</a>
          </nav>
        )}
      </header>

      <main id="contenido">
        <section className="landing-hero" id="inicio" aria-labelledby="hero-title">
          <div className="landing-shell landing-hero-inner">
            <div className="landing-hero-copy landing-pop">
              <span className="landing-eyebrow">Plataforma para democratizar la innovación</span>
              <h1 id="hero-title">
                Convierte objetivos de<br className="landing-hero-break--desktop" aria-hidden="true" />{' '}
                negocio en<br className="landing-hero-break--compact" aria-hidden="true" />{' '}
                iniciativas que<br className="landing-hero-break--desktop" aria-hidden="true" />{' '}
                <span>avanzan y<br className="landing-hero-break--compact" aria-hidden="true" /> aprenden.</span>
              </h1>
              <p className="landing-hero-lead">Startería conecta estrategia, personas y ejecución guiada para desarrollar iniciativas medibles y tomar decisiones con evidencia. Sin empezar de cero cada vez.</p>
              <div className="landing-hero-actions">
                <a className="landing-btn" {...bookingLinkProps}>Solicitar una demo <span aria-hidden="true">↗</span></a>
                <a className="landing-btn landing-btn--secondary" href="#como-funciona">Ver cómo funciona <span aria-hidden="true">↓</span></a>
              </div>
              <p className="landing-proofline"><strong>Una misma historia:</strong> del contexto de tu empresa al resultado de cada iniciativa y lo que aprende toda la organización.</p>
            </div>
            <TransformationFlow />
          </div>
        </section>

        <div className="landing-shell">
          <div className="landing-capability-rail" aria-label="Tres capacidades">
            <div><span>01</span><div><strong>Claridad estratégica</strong><small>Definir dónde concentrar esfuerzos y qué medir.</small></div></div>
            <div><span>02</span><div><strong>Ejecución acompañada</strong><small>Guiar a equipos y activar apoyos cuando hace falta.</small></div></div>
            <div><span>03</span><div><strong>Aprendizaje que permanece</strong><small>Conectar resultados con la siguiente decisión.</small></div></div>
          </div>
        </div>

        <StarteriaInteractiveStory />

        <section className="landing-section" id="impacto" aria-labelledby="landing-impact-title">
          <div className="landing-shell">
            <header className="landing-section-head">
              <span className="landing-eyebrow">Qué puede cambiar en tu negocio</span>
              <h2 id="landing-impact-title">Más capacidad para transformar. Menos esfuerzo perdido.</h2>
              <p>El valor no es acumular proyectos, sino avanzar con foco, detectar bloqueos antes y aprovechar lo que cada iniciativa enseña.</p>
            </header>
            <div className="landing-impact-grid">
              {impactItems.map(([glyph, title, copy]) => (
                <article className="landing-impact-item" key={title}>
                  <span aria-hidden="true">{glyph}</span><h3>{title}</h3><p>{copy}</p>
                </article>
              ))}
            </div>
            <p className="landing-section-note">Estas son hipótesis de impacto para evaluar con cada empresa; no equivalen a resultados, ahorros ni ROI garantizados.</p>
          </div>
        </section>

        <section className="landing-section landing-fab-section" id="fab" aria-labelledby="landing-fab-title">
          <div className="landing-shell landing-fab-layout">
            <div>
              <span className="landing-eyebrow">Cuando necesitas más capacidad técnica</span>
              <h2 id="landing-fab-title">Tu equipo marca el rumbo. Fab puede ayudar a construir.</h2>
              <p className="landing-section-intro">Si una iniciativa necesita software y el equipo no dispone de tiempo o capacidad de desarrollo, Startería Fab puede sumar ingeniería asistida por agentes con revisión humana.</p>
              <a className="landing-btn landing-btn--light" href="https://darkcodepe.github.io/sw-factory/" target="_blank" rel="noopener noreferrer">Explorar Startería Fab <span aria-hidden="true">↗</span></a>
              <p className="landing-section-note">Fab dispone de su propia herramienta técnica. Su integración automática con Platform no se presenta como certificada.</p>
            </div>
            <div className="landing-fab-scene" role="group" aria-label="Esquema de la capacidad técnica de Fab">
              <div className="landing-fab-scene-head"><b>fab · Ciclo de software</b><span>Ejemplo de flujo</span></div>
              <div className="landing-fab-checks">
                {[
                  ['✓', 'Encargo técnico definido', 'Alcance, objetivo, restricciones y revisión'],
                  ['✓', 'Agentes que implementan', 'Trabajan en cambios aislados en el repositorio'],
                  ['✓', 'Revisión y QA', 'Código, seguridad y pruebas según configuración'],
                  ['↗', 'Entrega técnica y decisión humana', 'El negocio contrasta el resultado y decide continuidad'],
                ].map(([icon, title, detail]) => (
                  <div key={title}><span aria-hidden="true">{icon}</span><div><b>{title}</b><small>{detail}</small></div></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="landing-audience" id="para-quien" aria-labelledby="landing-audience-title">
          <div className="landing-shell">
            <header className="landing-audience-head">
              <div><span className="landing-eyebrow">Un sistema · distintos puntos de partida</span><h2 id="landing-audience-title">Empieza donde estás.<br /><em>Avanza a tu manera.</em></h2></div>
              <p>Desde una mejora puntual hasta iniciativas entre distintas áreas, Startería adapta el acompañamiento a tus necesidades y recursos.</p>
            </header>
            <div className="landing-audience-layout">
              <article className="landing-audience-feature" aria-labelledby="landing-team-title">
                <div>
                  <span className="landing-audience-index">Equipos de innovación y transformación</span>
                  <h3 id="landing-team-title">Conecta más equipos.<br />Sin perder el foco.</h3>
                  <p>Alinea objetivos, coordina iniciativas entre áreas y convierte los avances en decisiones compartidas.</p>
                  <div className="landing-feature-terms" role="group" aria-label="Valores principales"><span>Prioridades visibles</span><span>Trabajo conectado</span><span>Aprendizajes compartidos</span></div>
                </div>
                <div className="landing-areas-scene" aria-label="Ejemplo ilustrativo: áreas colaborando alrededor de un objetivo compartido" role="img">
                  <div className="landing-area-pill landing-area-pill--a"><span aria-hidden="true">I</span> Innovación</div>
                  <div className="landing-area-pill landing-area-pill--b"><span aria-hidden="true">O</span> Operaciones</div>
                  <div className="landing-area-pill landing-area-pill--c"><span aria-hidden="true">T</span> Tecnología</div>
                  <svg viewBox="0 0 360 260" aria-hidden="true" preserveAspectRatio="none"><path d="M90 63 C160 65 117 128 180 128 M268 52 C210 65 247 123 180 128 M269 212 C210 187 245 139 180 128" fill="none" stroke="#B9ADF8" strokeWidth="2" strokeDasharray="5 7" /></svg>
                  <div className="landing-area-center"><small>Visión compartida</small><b>Objetivo + iniciativas</b><span>Evidencia para decidir</span></div>
                  <div className="landing-area-bottom">Un portafolio, distintos equipos</div>
                </div>
              </article>
              <div className="landing-audience-stack">
                <AudienceCard kind="small" label="Pequeños negocios" title={<>Una necesidad.<br />Una prueba concreta.</>} copy="Empieza con una mejora acotada y una ruta sencilla para comprobar si funciona." steps={['Necesidad', 'Prueba', 'Aprender']} />
                <AudienceCard kind="medium" label="Pymes en crecimiento" title={<>De la mejora<br />a una solución real.</>} copy="Ordena prioridades, prueba alternativas y suma capacidad de desarrollo cuando haga falta." steps={['Priorizar', 'Probar', 'Implementar']} />
              </div>
            </div>
            <p className="landing-audience-note">No son tres productos ni etapas obligatorias. Son distintas formas de empezar con Startería.</p>
          </div>
        </section>

        <section className="landing-section" id="confianza" aria-labelledby="landing-trust-title">
          <div className="landing-shell landing-faq-grid">
            <div><span className="landing-eyebrow">Preguntas importantes</span><h2 id="landing-trust-title">Tu contexto. Tus decisiones. Tu control.</h2><p className="landing-section-intro">Las preguntas sobre datos, herramientas e IA merecen respuestas específicas, no promesas generales.</p></div>
            <div className="landing-faq-list">
              {faqItems.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="landing-mission" id="proposito" aria-labelledby="landing-mission-title">
          <div className="landing-shell landing-mission-layout">
            <div className="landing-mission-copy">
              <span className="landing-eyebrow">Nuestro propósito</span>
              <h2 id="landing-mission-title">Que innovar no dependa de tener un gran equipo.</h2>
              <p>Queremos que más empresas puedan poner sus oportunidades a prueba, desarrollar soluciones y aprender de sus resultados, con orientación y criterio.</p>
              <div className="landing-mission-signature"><span aria-hidden="true" />Democratizar la innovación desde el hacer.</div>
            </div>
            <div className="landing-mission-poster" role="group" aria-label="Tres aspiraciones que impulsan el propósito de Startería">
              <div className="landing-poster-top"><span>Startería / Manifiesto</span><span>01 — 03</span></div>
              <ManifestRow number="01" title="Más personas que pueden proponer." detail="Sin necesitar una estructura compleja." />
              <ManifestRow number="02" title="Más equipos capaces de probar." detail="Con acompañamiento y foco." />
              <ManifestRow number="03" title="Más aprendizaje que permanece." detail="Para quienes vienen después." />
              <div className="landing-poster-foot">Probar <span>·</span> Aprender <span>·</span> Mejorar</div>
            </div>
          </div>
        </section>

        <section className="landing-conversion" id="cta" aria-labelledby="landing-conversion-title">
          <div className="landing-shell landing-conversion-layout">
            <div>
              <span className="landing-eyebrow">Empecemos por tu realidad</span>
              <h2 id="landing-conversion-title">¿Tienes una necesidad por resolver o una oportunidad por desarrollar?</h2>
              <p>Cuéntanos qué quieres conseguir, tanto si estás empezando como si ya tienes un equipo trabajando. Evaluemos si tiene sentido una demostración contextualizada o un piloto acordado.</p>
              <small>Conversación inicial, no acceso o piloto automático. ¿Te interesa ser early user? Podemos explicar las condiciones si el programa está disponible.</small>
            </div>
            <a className="landing-btn landing-btn--light" {...bookingLinkProps}>Solicitar una demo <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer-inner">
          <a className="landing-brand" href="#inicio"><span className="landing-brand-symbol" aria-hidden="true">✳</span>Startería</a>
          <p>De objetivos a iniciativas, decisiones y aprendizaje.</p>
          <nav aria-label="Navegación del pie de página"><a href="#como-funciona">Cómo funciona</a><a href="#fab">Fab</a><a href="#confianza">Confianza</a></nav>
        </div>
      </footer>
    </div>
  );
}

function AudienceCard({ kind, label, title, copy, steps }: { kind: 'small' | 'medium'; label: string; title: ReactNode; copy: string; steps: string[] }) {
  return (
    <article className={`landing-audience-card landing-audience-card--${kind}`}>
      <div className="landing-audience-card-heading"><span aria-hidden="true">{kind === 'small' ? '⌂' : '▦'}</span><span>{label}</span></div>
      <h3>{title}</h3><p>{copy}</p>
      <div className="landing-audience-steps" role="group" aria-label={steps.join(', ')}>{steps.map((step, index) => <span key={step}>{index > 0 && <i aria-hidden="true">→</i>}<b>{step}</b></span>)}</div>
    </article>
  );
}

function ManifestRow({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="landing-manifest-row"><span>{number}</span><div><strong>{title}</strong><small>{detail}</small></div><span aria-hidden="true">↗</span></div>;
}
