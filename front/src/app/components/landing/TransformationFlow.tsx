import { ArrowDown, ArrowRight } from 'lucide-react';

const inputs = [
  'Objetivos dispersos',
  'Iniciativas compitiendo',
  'Capacidad limitada',
];

const outputs = [
  'Claridad',
  'Capacidad de ejecución',
  'Aprendizaje reutilizable',
];

export function TransformationFlow() {
  return (
    <figure
      className="landing-transformation landing-pop"
      aria-label="Transformación conceptual de objetivos dispersos en claridad, ejecución y aprendizaje mediante Startería"
    >
      <div className="landing-transformation__column">
        <span className="landing-eyebrow">Lo que entra</span>
        <ul className="landing-transformation__list">
          {inputs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="landing-transformation__connector landing-flow" aria-hidden="true">
        <ArrowRight className="landing-transformation__arrow--desktop" />
        <ArrowDown className="landing-transformation__arrow--mobile" />
      </div>

      <div className="landing-transformation__hub">
        <span className="landing-transformation__hub-label">Startería</span>
        <strong>Un sistema para hacer avanzar iniciativas</strong>
        <span>Platform · IA · Fab</span>
      </div>

      <div className="landing-transformation__connector landing-flow" aria-hidden="true">
        <ArrowRight className="landing-transformation__arrow--desktop" />
        <ArrowDown className="landing-transformation__arrow--mobile" />
      </div>

      <div className="landing-transformation__column landing-transformation__column--output">
        <span className="landing-eyebrow">Lo que se construye</span>
        <ul className="landing-transformation__list">
          {outputs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
