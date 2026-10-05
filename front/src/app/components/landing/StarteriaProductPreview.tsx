import { ArrowDown, ArrowRight } from 'lucide-react';
import { Card } from '../ui/card';

const PREVIEW_STAGES: {
  title: string;
  label: string;
  description: string;
  details: string[];
  authorityNote?: string;
}[] = [
  {
    title: 'Meta',
    label: 'Meta hipotética',
    description: 'Mejorar la activación inicial del canal digital.',
    details: ['Una hipótesis ficticia para orientar la conversación.'],
  },
  {
    title: 'Alineación',
    label: 'Foco compartido',
    description: 'Experiencia digital · equipo ficticio',
    details: ['Rediseño onboarding', 'Automatización soporte'],
  },
  {
    title: 'Ejecución',
    label: 'Trabajo ilustrativo',
    description: 'Iniciativas, señales y dependencias relacionadas.',
    details: [
      'Tarea ficticia: revisar el primer acceso',
      'Bloqueo ficticio: dependencia de soporte por aclarar',
      'Documento ficticio: hipótesis de activación',
      'Evidencia ficticia: señales del primer acceso por revisar',
    ],
  },
  {
    title: 'Decisión',
    label: 'Revisión humana',
    description: '¿Qué alternativa merece una nueva revisión?',
    details: ['Invertir', 'Iterar', 'Pivotar', 'Cerrar'],
    authorityNote: 'La decisión sigue siendo de las personas.',
  },
];

export function StarteriaProductPreview() {
  return (
    <section
      id="vista-producto"
      aria-labelledby="starteria-product-preview-title"
      className="scroll-mt-24 border-y border-border-default bg-background-subtle py-10 sm:py-12 lg:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <figure aria-describedby="starteria-preview-disclaimer starteria-preview-provenance">
          <Card className="overflow-hidden gap-0 shadow-elevation-none">
            <header className="flex flex-col gap-4 border-b border-border-default bg-surface-default px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-primary">Starteria · ejemplo de lectura</p>
                <h2
                  id="starteria-product-preview-title"
                  className="mt-2 max-w-2xl text-xl font-semibold leading-7 text-text-primary sm:text-2xl"
                >
                  Meta → Alineación → Ejecución → Decisión
                </h2>
              </div>
              <div id="starteria-preview-disclaimer" className="max-w-sm sm:text-right">
                <p className="text-sm font-semibold text-text-primary">
                  Ejemplo ilustrativo · no es un análisis real
                </p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  Contenido, nombres, relaciones y estados ficticios.
                </p>
              </div>
            </header>

            <ol
              aria-label="Lectura ilustrativa del trabajo"
              className="grid gap-0 divide-y divide-border-default xl:grid-cols-4 xl:divide-x xl:divide-y-0"
            >
              {PREVIEW_STAGES.map((stage, index) => (
                <li key={stage.title} className="relative min-w-0 px-5 py-5 sm:px-7 sm:py-6 xl:px-5 xl:py-6">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-primary"
                    />
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-text-primary">{stage.title}</h3>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        {stage.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-text-primary">{stage.description}</p>
                      {stage.authorityNote ? (
                        <p className="mt-2 text-sm leading-6 text-text-secondary">{stage.authorityNote}</p>
                      ) : null}
                      <ul className="mt-3 space-y-2">
                        {stage.details.map((detail) => (
                          <li key={detail} className="text-sm leading-6 text-text-secondary">
                            {index === PREVIEW_STAGES.length - 1 ? (
                              <span className="inline-flex rounded-full border border-border-default px-3 py-1">
                                {detail}
                              </span>
                            ) : (
                              detail
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {index < PREVIEW_STAGES.length - 1 ? (
                    <div aria-hidden="true" className="mt-4 flex justify-center xl:absolute xl:right-[-10px] xl:top-1/2 xl:z-10 xl:mt-0 xl:-translate-y-1/2">
                      <ArrowDown className="text-brand-primary xl:hidden" size={18} />
                      <ArrowRight className="hidden bg-surface-default text-brand-primary xl:block" size={18} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
          <figcaption
            id="starteria-preview-provenance"
            className="mt-3 text-sm leading-6 text-text-secondary"
          >
            La preview muestra cómo organizar la lectura. No sustituye la revisión ni la decisión de
            las personas.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
