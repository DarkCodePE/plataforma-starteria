const inputs = [
  { icon: '◈', title: 'Contexto', detail: 'Lo que sucede hoy' },
  { icon: '✧', title: 'Oportunidades', detail: 'Lo que puedes mejorar' },
  { icon: '⌁', title: 'Trabajo en curso', detail: 'Lo que ya existe' },
];

const outputs = [
  { icon: '✓', title: 'Foco', detail: 'Objetivos y prioridades' },
  { icon: '↗', title: 'Ejecución', detail: 'Trabajo acompañado' },
  { icon: '↻', title: 'Aprendizaje', detail: 'Mejores decisiones' },
];

export function TransformationFlow() {
  return (
    <figure
      className="landing-hero-art landing-hero-system-map landing-pop"
      role="img"
      aria-label="Contexto, oportunidades e iniciativas existentes se conectan mediante Startería, generando foco estratégico, ejecución acompañada y aprendizaje que regresa a nuevas iniciativas"
    >
      <span className="landing-diagram-intro">El sistema que conecta</span>
      <svg className="landing-system-wires" viewBox="0 0 1160 450" preserveAspectRatio="none" aria-hidden="true">
        <path className="landing-path-line landing-wire-moving" d="M305 135 C373 135 402 192 469 217" />
        <path className="landing-path-line landing-wire-moving" d="M305 225 C375 225 404 222 469 217" />
        <path className="landing-path-line landing-wire-moving" d="M305 315 C373 315 401 244 469 217" />
        <path className="landing-path-line landing-path-line--mint landing-wire-moving" d="M691 217 C758 190 789 135 855 135" />
        <path className="landing-path-line landing-path-line--mint landing-wire-moving" d="M691 217 C761 217 792 225 855 225" />
        <path className="landing-path-line landing-path-line--mint landing-wire-moving" d="M691 217 C758 245 789 315 855 315" />
        <path d="M930 364 C812 431 356 430 242 359" fill="none" stroke="#c6baf0" strokeWidth="2" strokeDasharray="5 8" opacity=".7" />
      </svg>

      <div className="landing-flow-list landing-flow-list--input">
        {inputs.map((item) => (
          <div className="landing-flow-node" key={item.title}>
            <span className="landing-flow-icon landing-flow-icon--source" aria-hidden="true">{item.icon}</span>
            <span className="landing-node-copy"><b>{item.title}</b><small>{item.detail}</small></span>
          </div>
        ))}
      </div>

      <div className="landing-flow-mobile-arrow" aria-hidden="true">↓</div>
      <div className="landing-flow-hub">
        <span className="landing-flow-logo" aria-hidden="true">✳</span>
        <strong>Startería</strong>
        <small>Conecta · Guía · Aprende</small>
      </div>
      <div className="landing-flow-mobile-arrow" aria-hidden="true">↓</div>

      <div className="landing-flow-list landing-flow-list--output">
        {outputs.map((item) => (
          <div className="landing-flow-node" key={item.title}>
            <span className="landing-flow-icon landing-flow-icon--outcome" aria-hidden="true">{item.icon}</span>
            <span className="landing-node-copy"><b>{item.title}</b><small>{item.detail}</small></span>
          </div>
        ))}
      </div>

      <div className="landing-loop-note">
        <span>Lo aprendido vuelve a orientar <strong>las próximas iniciativas</strong>.</span>
        <span className="landing-hero-micro"><span className="landing-pill-dot" /> Diseño conceptual</span>
      </div>
    </figure>
  );
}
