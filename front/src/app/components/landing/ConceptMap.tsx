import type { CSSProperties } from 'react';
import {
  BarChart3,
  CircleCheck,
  Crosshair,
  FileText,
  LayoutGrid,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { StarteriaMark } from './StarteriaMark';

type MapNode = { label: string; Icon: LucideIcon; tone: string; dot: string };

// The diagram is drawn in a 600×380 box; node rows sit on these vertical centers.
const ROW_Y = [62, 146, 234, 318];
const HUB_Y = [166, 182, 198, 214];

const INPUTS: MapNode[] = [
  { label: 'Objetivos', Icon: Target, tone: 'text-brand-primary bg-brand-primary-subtle', dot: '#4F46E5' },
  { label: 'Necesidades', Icon: FileText, tone: 'text-[#7C3AED] bg-[#F5F3FF]', dot: '#7C3AED' },
  { label: 'Iniciativas', Icon: LayoutGrid, tone: 'text-[#0D9488] bg-[#ECFDF5]', dot: '#0D9488' },
  { label: 'Equipos', Icon: Users, tone: 'text-brand-primary bg-brand-primary-subtle', dot: '#4F46E5' },
];

const OUTPUTS: MapNode[] = [
  { label: 'Foco', Icon: Crosshair, tone: 'text-[#0891B2] bg-[#ECFEFF]', dot: '#0891B2' },
  { label: 'Coordinación', Icon: Users, tone: 'text-[#7C3AED] bg-[#F5F3FF]', dot: '#7C3AED' },
  { label: 'Evidencia', Icon: BarChart3, tone: 'text-[#0D9488] bg-[#ECFDF5]', dot: '#0D9488' },
  { label: 'Decisión', Icon: CircleCheck, tone: 'text-brand-primary bg-brand-primary-subtle', dot: '#4F46E5' },
];

const inputPath = (index: number) =>
  `M170 ${ROW_Y[index]} C 200 ${ROW_Y[index]}, 192 ${HUB_Y[index]}, 222 ${HUB_Y[index]}`;
const outputPath = (index: number) =>
  `M378 ${HUB_Y[index]} C 408 ${HUB_Y[index]}, 400 ${ROW_Y[index]}, 430 ${ROW_Y[index]}`;

const rowStyle = (index: number) => ({ '--y': `${(ROW_Y[index] / 380) * 100}%` }) as CSSProperties;

export function ConceptMap() {
  return (
    <section aria-labelledby="concept-map-title" className="relative min-w-0">
      <h2 id="concept-map-title" className="sr-only">
        Modelo conceptual de Starteria
      </h2>

      <div
        aria-hidden="true"
        className="landing-dots pointer-events-none absolute -right-4 top-6 hidden h-28 w-28 opacity-60 sm:block"
      />
      <div
        aria-hidden="true"
        className="landing-dots pointer-events-none absolute -left-6 bottom-2 hidden h-20 w-24 opacity-50 sm:block"
      />

      <p aria-hidden="true" className="landing-hand mb-1 hidden -rotate-3 pl-[30%] text-xl text-[#5D6585] sm:block">
        De la intención…
        <svg viewBox="0 0 40 34" aria-hidden="true" fill="none" className="ml-1 inline-block h-8 w-9 translate-y-2 text-[#5D6585]">
          <path d="M4 6c14-4 26 2 26 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="m25 16 5 5 4-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </p>

      <div className="relative grid gap-3 sm:block sm:aspect-[600/380]">
        <svg
          viewBox="0 0 600 380"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
          fill="none"
        >
          {INPUTS.map((node, index) => (
            <g key={node.label}>
              <path d={inputPath(index)} stroke="#C7D2FE" strokeWidth="1.5" pathLength={1} className="landing-draw" />
              <path d={inputPath(index)} stroke={node.dot} strokeWidth="1.5" strokeLinecap="round" className="landing-flow" opacity="0.7" />
              <circle cx="170" cy={ROW_Y[index]} r="4" fill={node.dot} />
              <circle cx="222" cy={HUB_Y[index]} r="3" fill="#4F46E5" />
            </g>
          ))}
          {OUTPUTS.map((node, index) => (
            <g key={node.label}>
              <path d={outputPath(index)} stroke="#C7D2FE" strokeWidth="1.5" pathLength={1} className="landing-draw" />
              <path d={outputPath(index)} stroke={node.dot} strokeWidth="1.5" strokeLinecap="round" className="landing-flow landing-flow-out" opacity="0.7" />
              <circle cx="378" cy={HUB_Y[index]} r="3" fill="#4F46E5" />
              <circle cx="430" cy={ROW_Y[index]} r="4" fill={node.dot} />
            </g>
          ))}
        </svg>

        <ul aria-label="Contexto que conecta" className="grid grid-cols-2 gap-2 sm:absolute sm:inset-0 sm:block">
          {INPUTS.map((node, index) => (
            <MapNodeItem key={node.label} node={node} style={rowStyle(index)} side="left" />
          ))}
        </ul>

        <MobileJoin />

        <div className="landing-card-raised landing-pop flex flex-col items-center justify-center rounded-2xl px-4 py-5 text-center sm:absolute sm:left-[37%] sm:top-1/2 sm:w-[26%] sm:-translate-y-1/2 sm:py-6">
          <StarteriaMark className="h-12 w-12" />
          <p className="mt-2 text-lg font-semibold tracking-tight text-[#0D1333]">Starteria</p>
          <p className="mt-1 text-[11px] leading-4 text-[#5D6585]">Contexto. Trabajo. Decisiones.</p>
        </div>

        <MobileJoin out />

        <ul aria-label="Lectura compartida" className="grid grid-cols-2 gap-2 sm:absolute sm:inset-0 sm:block">
          {OUTPUTS.map((node, index) => (
            <MapNodeItem key={node.label} node={node} style={rowStyle(index)} side="right" />
          ))}
        </ul>
      </div>

      <p aria-hidden="true" className="landing-hand mt-1 hidden rotate-[-4deg] pl-[58%] text-xl text-[#5D6585] sm:block">
        <svg viewBox="0 0 40 34" aria-hidden="true" fill="none" className="mr-1 inline-block h-8 w-9 -translate-y-2 text-[#5D6585]">
          <path d="M34 28C18 30 8 22 9 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="m4 13 5-5 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        …a resultados reales.
      </p>
    </section>
  );
}

// Below sm the map stacks; these short joins keep the flow visible between the groups.
function MobileJoin({ out = false }: { out?: boolean }) {
  const paths = out
    ? ['M50 0 C 50 14, 25 10, 25 28', 'M50 0 C 50 14, 75 10, 75 28']
    : ['M25 0 C 25 18, 50 14, 50 28', 'M75 0 C 75 18, 50 14, 50 28'];
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" fill="none" className="-my-1 h-7 w-full sm:hidden">
      {paths.map((d) => (
        <path key={d} d={d} stroke="#6366F1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="landing-flow" opacity="0.7" />
      ))}
    </svg>
  );
}

function MapNodeItem({
  node,
  style,
  side,
}: {
  node: MapNode;
  style: CSSProperties;
  side: 'left' | 'right';
}) {
  const { label, Icon, tone } = node;
  return (
    <li
      style={style}
      className={`landing-card flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 sm:absolute sm:top-[var(--y)] sm:w-[28.3%] sm:-translate-y-1/2 ${
        side === 'left' ? 'sm:left-0' : 'sm:right-0'
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon aria-hidden="true" size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0 truncate text-[13px] font-medium text-[#0D1333]">{label}</span>
    </li>
  );
}
