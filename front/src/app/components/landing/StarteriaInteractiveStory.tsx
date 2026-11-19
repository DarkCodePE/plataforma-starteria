import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import {
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CircleDot,
  Code2,
  GitBranch,
  Layers3,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

type StageId = 'clarificar' | 'conectar' | 'ejecutar' | 'aprender';

export const STARTERIA_FAB_REVEAL_EVENT = 'starteria:reveal-fab';

type Stage = {
  id: StageId;
  number: string;
  label: string;
  headline: string;
  description: string;
};

const stages: Stage[] = [
  {
    id: 'clarificar',
    number: '01',
    label: 'Clarificar',
    headline: 'Convertir una necesidad en un objetivo observable.',
    description: 'El equipo alinea el problema, el resultado esperado y las señales que permitirán evaluar avance.',
  },
  {
    id: 'conectar',
    number: '02',
    label: 'Conectar',
    headline: 'Comparar iniciativas y hacer explícitas las prioridades.',
    description: 'Las iniciativas dejan de competir en conversaciones aisladas y se conectan con objetivos y criterios compartidos.',
  },
  {
    id: 'ejecutar',
    number: '03',
    label: 'Ejecutar',
    headline: 'Elegir cómo desarrollar la iniciativa sin perder continuidad.',
    description: '¿Tu equipo tiene una iniciativa, pero no dispone de tiempo o capacidad técnica para desarrollarla? Puede avanzar con el equipo o sumar la capacidad de Fab.',
  },
  {
    id: 'aprender',
    number: '04',
    label: 'Aprender',
    headline: 'Lo aprendido vuelve a orientar nuevas iniciativas.',
    description: 'Evidencias, decisiones y resultados permanecen conectados para que el conocimiento no empiece de cero.',
  },
];

function ClarifyVisual() {
  return (
    <div className="story-canvas__body">
      <div className="story-objective">
        <span className="story-objective__icon"><Target aria-hidden="true" /></span>
        <div>
          <span className="story-label">Objetivo de negocio</span>
          <strong>Reducir el tiempo de respuesta al cliente</strong>
        </div>
      </div>
      <div className="story-signal-grid">
        <div><CircleDot aria-hidden="true" /><span>Señal observable</span><strong>Tiempo hasta resolución</strong></div>
        <div><Users aria-hidden="true" /><span>Equipo implicado</span><strong>Operaciones + Producto</strong></div>
      </div>
      <div className="story-assist"><Sparkles aria-hidden="true" /><span>La asistencia de IA ayuda a detectar supuestos y preguntas pendientes.</span></div>
    </div>
  );
}

function ConnectVisual() {
  return (
    <div className="story-canvas__body">
      <div className="story-priority-head">
        <span>Iniciativas conectadas</span>
        <span>Prioridad</span>
      </div>
      {[
        ['Rediseñar el circuito de soporte', 'Alta'],
        ['Automatizar clasificación inicial', 'Alta'],
        ['Ampliar canales de contacto', 'Explorar'],
      ].map(([initiative, priority], index) => (
        <div className="story-priority-row" key={initiative}>
          <span className="story-priority-row__index">0{index + 1}</span>
          <span>{initiative}</span>
          <strong>{priority}</strong>
        </div>
      ))}
      <div className="story-connection"><GitBranch aria-hidden="true" /><span>Las prioridades conservan su vínculo con el objetivo y los criterios acordados.</span></div>
    </div>
  );
}

function ExecuteVisual() {
  return (
    <div className="story-canvas__body story-execution">
      <div className="story-route-split" aria-label="Dos rutas de ejecución posibles">
        <div className="story-route">
          <span className="story-route__icon"><Users aria-hidden="true" /></span>
          <span className="story-label">Ruta 1</span>
          <strong>Con el equipo</strong>
          <p>Desarrollo guiado por la plataforma, asistencia contextual de IA y revisión humana.</p>
          <ul>
            <li><Check aria-hidden="true" />Criterios y próximos pasos visibles</li>
            <li><Check aria-hidden="true" />Evidencia vinculada al trabajo</li>
          </ul>
        </div>
        <div className="story-route story-route--fab">
          <span className="story-route__icon"><Code2 aria-hidden="true" /></span>
          <span className="story-label">Ruta 2</span>
          <strong>Con Startería Fab</strong>
          <p>Una fábrica de software asistida por agentes que puede ayudar a implementar, revisar y probar soluciones.</p>
          <ul>
            <li><Check aria-hidden="true" />Apoyo para implementar y revisar</li>
            <li><Check aria-hidden="true" />Pruebas como parte del desarrollo</li>
          </ul>
          <a href="https://darkcodepe.github.io/sw-factory/" target="_blank" rel="noopener noreferrer">
            Conocer Startería Fab <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="story-convergence landing-flow">
        <Layers3 aria-hidden="true" />
        <div><strong>Evidencia, resultado y continuidad</strong><span>Ambas rutas vuelven a la misma historia de la iniciativa.</span></div>
      </div>
      <p className="story-disclaimer">Fab es una capacidad complementaria. No implica una integración automática certificada entre Platform y Fab.</p>
    </div>
  );
}

function LearnVisual() {
  return (
    <div className="story-canvas__body">
      <div className="story-learning">
        <div className="story-learning__source"><BookOpenCheck aria-hidden="true" /><span>Iniciativa desarrollada</span><strong>Decisión y evidencia</strong></div>
        <div className="story-learning__line landing-flow" aria-hidden="true" />
        <div className="story-learning__reuse">
          <span className="story-label">Conocimiento disponible</span>
          <strong>Qué funcionó, qué cambió y por qué</strong>
          <p>Una nueva iniciativa puede partir de esa evidencia en lugar de reconstruir el contexto.</p>
        </div>
      </div>
    </div>
  );
}

const visuals: Record<StageId, () => ReactElement> = {
  clarificar: ClarifyVisual,
  conectar: ConnectVisual,
  ejecutar: ExecuteVisual,
  aprender: LearnVisual,
};

export function StarteriaInteractiveStory() {
  const [activeId, setActiveId] = useState<StageId>('clarificar');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = stages.findIndex((stage) => stage.id === activeId);
  const activeStage = stages[activeIndex];
  const ActiveVisual = visuals[activeId];

  useEffect(() => {
    const revealFab = () => setActiveId('ejecutar');
    const revealFabFromHash = () => {
      if (window.location.hash === '#fab') revealFab();
    };

    revealFabFromHash();
    window.addEventListener('hashchange', revealFabFromHash);
    window.addEventListener(STARTERIA_FAB_REVEAL_EVENT, revealFab);
    return () => {
      window.removeEventListener('hashchange', revealFabFromHash);
      window.removeEventListener(STARTERIA_FAB_REVEAL_EVENT, revealFab);
    };
  }, []);

  function selectAndFocus(index: number) {
    const nextIndex = (index + stages.length) % stages.length;
    setActiveId(stages[nextIndex].id);
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
      selectAndFocus(stages.length - 1);
    }
  }

  return (
    <section className="landing-section landing-story" id="en-accion" aria-labelledby="story-title">
      <div className="landing-shell">
        <span id="fab" className="landing-anchor" aria-hidden="true" />
        <div className="landing-section-heading">
          <div>
            <span className="landing-kicker">Startería en acción</span>
            <h2 id="story-title">Una iniciativa. Cuatro momentos para hacerla avanzar.</h2>
          </div>
          <p>Un mismo hilo conecta intención, ejecución, evidencia y aprendizaje. Explora cada momento.</p>
        </div>

        <div className="story-stage">
          <div className="story-tabs" role="tablist" aria-label="Etapas del desarrollo de una iniciativa">
            {stages.map((stage, index) => {
              const selected = stage.id === activeId;
              return (
                <button
                  key={stage.id}
                  ref={(node) => { tabRefs.current[index] = node; }}
                  type="button"
                  role="tab"
                  id={`story-tab-${stage.id}`}
                  aria-controls="story-panel"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(stage.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                >
                  <span>{stage.number}</span>
                  <strong>{stage.label}</strong>
                </button>
              );
            })}
          </div>

          <div
            className="story-panel"
            role="tabpanel"
            id="story-panel"
            aria-labelledby={`story-tab-${activeId}`}
            tabIndex={0}
          >
            <div className="story-panel__copy" key={`${activeId}-copy`}>
              <span className="landing-eyebrow">{activeStage.number} · {activeStage.label}</span>
              <h3>{activeStage.headline}</h3>
              <p>{activeStage.description}</p>
            </div>
            <div className="story-canvas" key={activeId}>
              <div className="story-canvas__topbar">
                <span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></span>
                <span>Iniciativa · Experiencia de soporte</span>
                <span>Ejemplo</span>
              </div>
              <ActiveVisual />
            </div>
          </div>
          <p className="story-fiction-note">Demostración conceptual con información ficticia. No representa datos de una organización real.</p>
        </div>
      </div>
    </section>
  );
}
