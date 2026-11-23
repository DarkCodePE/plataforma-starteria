import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type PerspectiveId = 'strategy' | 'execution' | 'results';

type Perspective = {
  id: PerspectiveId;
  number: string;
  label: string;
  summary: string;
  title: string;
  tag: string;
  content: ReactNode;
};

function StrategyContent() {
  return (
    <div className="landing-stage-grid">
      <div className="landing-story-visual landing-strategy-tree">
        <div className="landing-objective-card">
          <small>Objetivo del negocio · Ejemplo</small>
          <strong>Mejorar la experiencia de nuestros clientes</strong>
          <span>KPI de negocio: satisfacción del cliente · Línea base por confirmar</span>
        </div>
        <div className="landing-tree-branch" />
        <div className="landing-initiatives">
          <div className="landing-initiative landing-initiative--featured"><small>Iniciativa A</small><b>Reducir las esperas</b><em>Prioridad a revisar</em></div>
          <div className="landing-initiative"><small>Iniciativa B</small><b>Simplificar solicitudes</b><em>En evaluación</em></div>
          <div className="landing-initiative"><small>Iniciativa C</small><b>Comunicar mejor</b><em>En curso</em></div>
        </div>
        <div className="landing-decision-mini"><b>Coordinación:</b> conecta retos, compara impacto/esfuerzo y prepara el encargo para una persona responsable.</div>
      </div>
      <div className="landing-story-text">
        <span className="landing-eyebrow">Perspectiva 1 · Qué merece avanzar</span>
        <h4>El trabajo comienza en el negocio, no en una lista de tareas.</h4>
        <p>Startería ayuda a convertir objetivos amplios en retos medibles y a revisar qué iniciativas existentes o nuevas podrían contribuir a ellos.</p>
        <p>La persona que coordina el portafolio puede asignar una iniciativa con contexto, métrica, alcance y responsables definidos.</p>
        <div className="landing-gain">↗ Beneficio: prioridades más claras y una conexión visible entre cada iniciativa y el objetivo.</div>
      </div>
    </div>
  );
}

function ExecutionContent() {
  return (
    <div className="landing-stage-grid">
      <div className="landing-story-visual">
        <div className="landing-handoff-card">
          <span>Brief para aceptar · Iniciativa A</span>
          <b>Comprobar cómo reducir las esperas</b>
          <small>Métrica propia: tiempo de respuesta · Línea base y meta por acordar</small>
        </div>
        <div className="landing-role-strip">
          <div><strong>Responsable</strong><em>Desarrolla y documenta</em></div>
          <div><strong>Coordinación</strong><em>Prioriza y desbloquea</em></div>
          <div><strong>Referente del negocio</strong><em>Aporta contexto y respaldo</em></div>
        </div>
        <div className="landing-stepper" aria-label="Momentos simplificados de ejecución">
          <span>Alinear</span><span className="is-active">Investigar</span><span>Diseñar</span><span>Probar</span>
        </div>
        <div className="landing-help-card">
          <b>Guía de Startería en este momento</b>
          <span>Antes de construir una solución, comprueba dónde surge la espera. Si necesitas datos o permisos, pide apoyo a la persona adecuada.</span>
        </div>
        <div className="landing-fab-routes">
          <div><b>Con el equipo</b><small>Investigación, prototipo y experimentación guiados</small></div>
          <div><b>Con Fab</b><small>Desarrollo de software cuando se necesita capacidad técnica</small></div>
        </div>
      </div>
      <div className="landing-story-text">
        <span className="landing-eyebrow">Perspectiva 2 · Cómo se ejecuta</span>
        <h4>Autonomía para avanzar. Ayuda cuando hace falta.</h4>
        <p>La persona responsable acepta un brief claro. Startería orienta próximos pasos, evidencias, apoyos puntuales y revisiones según el alcance y los recursos de la iniciativa.</p>
        <p>Coordinación observa checkpoints y necesidades de apoyo, sin reemplazar al equipo ejecutor ni aprobar automáticamente sus decisiones.</p>
        <div className="landing-gain">✓ Beneficio: menos incertidumbre y colaboración más efectiva durante la ejecución.</div>
      </div>
    </div>
  );
}

function ResultsContent() {
  return (
    <div className="landing-stage-grid">
      <div className="landing-story-visual">
        <div className="landing-result-metrics">
          <div><small>Inicio</small><b>48 h</b></div>
          <div><small>Meta</small><b>24 h</b></div>
          <div className="is-result"><small>Piloto</small><b>30 h</b></div>
        </div>
        <div className="landing-result-bridge"><strong>18 horas menos respecto al inicio.</strong> Mejora observada en este caso ficticio; la meta no se alcanzó y todavía hace falta revisar costes, calidad y condiciones.</div>
        <div className="landing-decision-options"><span>Iterar</span><span>Escalar</span><span>Pivotar</span><span>Invertir</span><span>Cerrar</span></div>
        <div className="landing-memory-row"><span aria-hidden="true">↻</span><div><b>Aprendizaje reutilizable</b> La evidencia, los bloqueos y la decisión confirmada vuelven al portafolio para orientar nuevas iniciativas.</div></div>
      </div>
      <div className="landing-story-text">
        <span className="landing-eyebrow">Perspectiva 3 · Qué aprendimos</span>
        <h4>Completar tareas no es lo mismo que generar valor.</h4>
        <p>El equipo compara resultados con el punto de partida, documenta lo que encontró y presenta alternativas. La decisión corresponde a quienes tienen autoridad en la organización.</p>
        <p>La estrategia incorpora los hallazgos confirmados y utiliza esa información cuando aparecen nuevas iniciativas relacionadas.</p>
        <div className="landing-gain">↻ Beneficio: mejores decisiones y menos pérdida de conocimiento entre ciclos.</div>
      </div>
    </div>
  );
}

const perspectives: Perspective[] = [
  { id: 'strategy', number: '01', label: 'Estrategia', summary: 'Qué priorizar y por qué', title: 'De un objetivo a iniciativas con propósito.', tag: 'Coordinación estratégica', content: <StrategyContent /> },
  { id: 'execution', number: '02', label: 'Ejecución', summary: 'Cómo avanzar y quién ayuda', title: 'Del encargo al trabajo guiado.', tag: 'Responsable + equipo + apoyos', content: <ExecutionContent /> },
  { id: 'results', number: '03', label: 'Resultados', summary: 'Qué decidimos después', title: 'La evidencia regresa a la estrategia.', tag: 'Resultados y decisiones', content: <ResultsContent /> },
];

export function StarteriaInteractiveStory() {
  const [activeId, setActiveId] = useState<PerspectiveId>('strategy');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectAndFocus(index: number) {
    const nextIndex = (index + perspectives.length) % perspectives.length;
    setActiveId(perspectives[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectAndFocus(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectAndFocus(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectAndFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectAndFocus(perspectives.length - 1);
    }
  }

  return (
    <section className="landing-section landing-section--tint" id="como-funciona" aria-labelledby="landing-work-title">
      <div className="landing-shell">
        <header className="landing-section-head">
          <span className="landing-eyebrow">Startería en acción</span>
          <h2 id="landing-work-title">La estrategia no se queda en una presentación.</h2>
          <p>Sigue una misma iniciativa desde el objetivo de negocio hasta su resultado. Cambia de perspectiva para descubrir qué recibe cada equipo y cómo el aprendizaje vuelve al portafolio.</p>
        </header>

        <div className="landing-journey">
          <div className="landing-journey-bar">
            <span><i aria-hidden="true"><b /><b /><b /></i> Ejemplo ilustrativo · Experiencia de clientes</span>
            <small>No son datos ni automatizaciones reales</small>
          </div>
          <div className="landing-journey-tabs" role="tablist" aria-label="Perspectivas del trabajo en Startería">
            {perspectives.map((perspective, index) => {
              const selected = perspective.id === activeId;
              return (
                <button
                  key={perspective.id}
                  ref={(node) => { tabRefs.current[index] = node; }}
                  type="button"
                  role="tab"
                  id={`landing-tab-${perspective.id}`}
                  aria-controls={`landing-panel-${perspective.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(perspective.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                >
                  <span>{perspective.number}</span>
                  <span><strong>{perspective.label}</strong><small>{perspective.summary}</small></span>
                </button>
              );
            })}
          </div>

          {perspectives.map((perspective) => (
            <div
              key={perspective.id}
              className="landing-journey-panel"
              id={`landing-panel-${perspective.id}`}
              role="tabpanel"
              aria-labelledby={`landing-tab-${perspective.id}`}
              tabIndex={0}
              hidden={activeId !== perspective.id}
            >
              <div className="landing-panel-top"><h3>{perspective.title}</h3><span>{perspective.tag}</span></div>
              {perspective.content}
            </div>
          ))}
        </div>
        <p className="landing-section-note">Los escenarios, cifras, decisiones e interfaces anteriores son ilustrativos. El KPI estratégico de satisfacción y la métrica operativa de tiempo de respuesta son distintos; su relación debe validarse con evidencia.</p>
      </div>
    </section>
  );
}
