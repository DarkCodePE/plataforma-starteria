import { ArrowDown, ArrowRight, Check, Settings2, Target, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const TEAM_INITIALS = ['AR', 'LM', 'JC'];

const EXECUTION_SIGNALS = [
  { label: '12 tareas en curso', dot: 'bg-[#16A34A]' },
  { label: '3 bloqueos', dot: 'bg-[#DC2626]' },
  { label: 'Documentos compartidos', dot: 'bg-brand-primary' },
];

const DECISION_OPTIONS = [
  { label: 'Invertir', tone: 'bg-[#ECFDF5] text-[#047857]' },
  { label: 'Iterar', tone: 'bg-brand-primary-subtle text-[#3730A3]' },
  { label: 'Pivotar', tone: 'bg-[#FFF7ED] text-[#9A3412]' },
  { label: 'Cerrar', tone: 'bg-[#F1F5F9] text-[#334155]' },
];

export function StarteriaProductPreview() {
  return (
    <figure
      id="vista-producto"
      aria-describedby="starteria-preview-provenance"
      className="landing-card mt-12 scroll-mt-24 rounded-2xl p-4 sm:p-6 lg:mt-14"
    >
      <section aria-labelledby="starteria-product-preview-title">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <ul className="flex flex-wrap gap-2 text-xs font-medium">
              <li className="rounded-full bg-brand-primary-subtle px-3 py-1 text-[#3730A3]">
                Ejemplo de cómo se vería en Starteria
              </li>
              <li className="rounded-full border border-[#E4E7F5] px-3 py-1 text-[#5D6585]">Caso ilustrativo</li>
            </ul>
            <h3
              id="starteria-product-preview-title"
              className="landing-display mt-4 text-xl font-semibold leading-7 text-[#0D1333] sm:text-2xl"
            >
              Reducir 30% el tiempo operativo
            </h3>
          </div>
          <p className="text-sm text-[#5D6585] sm:pt-1.5 sm:text-right">
            De un objetivo a una decisión, paso a paso.
          </p>
        </header>

        <ol
          aria-label="Lectura ilustrativa del trabajo"
          className="mt-5 grid gap-7 lg:grid-cols-[repeat(4,minmax(0,1fr))] lg:gap-8"
        >
          <Stage title="Meta" icon={<Target size={16} />} iconTone="text-brand-primary bg-brand-primary-subtle">
            <p>Copilot ayuda a aclarar la meta y los criterios de éxito.</p>
            <p className="mt-3 rounded-lg bg-[#F6F7FD] px-3 py-2.5 text-[13px] leading-5 text-[#3B4466]">
              “Reducir 30% el tiempo operativo en 6 meses”
            </p>
          </Stage>

          <Stage title="Alineación" icon={<Users size={16} />} iconTone="text-[#7C3AED] bg-[#F5F3FF]">
            <p>5 iniciativas conectadas, equipos y dependencias.</p>
            <div className="mt-4 flex items-center" aria-label="Personas del equipo ilustrativo">
              {TEAM_INITIALS.map((initials, index) => (
                <span
                  key={initials}
                  className={`-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white first:ml-0 ${
                    ['bg-[#4F46E5]', 'bg-[#0D9488]', 'bg-[#7C3AED]'][index]
                  }`}
                >
                  {initials}
                </span>
              ))}
              <span className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand-primary-subtle text-xs font-semibold text-[#3730A3]">
                +2
              </span>
            </div>
          </Stage>

          <Stage title="Ejecución" icon={<Settings2 size={16} />} iconTone="text-brand-primary bg-brand-primary-subtle">
            <p>Trabajo, colaboración, evidencia y bloqueos.</p>
            <ul className="mt-3 space-y-1.5 rounded-lg bg-[#F6F7FD] px-3 py-2.5 text-[13px] text-[#3B4466]">
              {EXECUTION_SIGNALS.map((signal) => (
                <li key={signal.label} className="flex items-center gap-2">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${signal.dot}`} />
                  {signal.label}
                </li>
              ))}
            </ul>
          </Stage>

          <Stage title="Decisión" icon={<Check size={16} strokeWidth={2.5} />} iconTone="text-white bg-[#0D9488]" last>
            <p>Brief de decisión listo.</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-[13px] font-medium">
              {DECISION_OPTIONS.map((option) => (
                <li key={option.label} className={`rounded-full px-3 py-1.5 text-center ${option.tone}`}>
                  {option.label}
                </li>
              ))}
            </ul>
          </Stage>
        </ol>
      </section>

      <figcaption id="starteria-preview-provenance" className="mt-5 border-t border-[#E4E7F5] pt-4 text-sm text-[#5D6585]">
        Caso ilustrativo con datos ficticios. La decisión sigue siendo de las personas.
      </figcaption>
    </figure>
  );
}

function Stage({
  title,
  icon,
  iconTone,
  last = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  iconTone: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="relative min-w-0 rounded-xl border border-[#E4E7F5] bg-white p-4 text-sm leading-6 text-[#5D6585]">
      <h4 className="flex items-center gap-2.5 text-[15px] font-semibold text-[#0D1333]">
        <span aria-hidden="true" className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconTone}`}>
          {icon}
        </span>
        {title}
      </h4>
      <div className="mt-3">{children}</div>
      {last ? null : (
        <span aria-hidden="true" className="absolute left-1/2 top-full z-10 mt-1.5 flex -translate-x-1/2 lg:mt-0 text-brand-primary lg:left-full lg:top-1/2 lg:translate-x-[10px] lg:-translate-y-1/2">
          <ArrowDown size={16} className="lg:hidden" />
          <ArrowRight size={16} className="hidden lg:block" />
        </span>
      )}
    </li>
  );
}
