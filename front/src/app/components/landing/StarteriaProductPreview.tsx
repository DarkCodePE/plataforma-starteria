import { Card } from '../ui/card';

const INITIATIVES = [
  'Rediseño onboarding',
  'Automatización soporte',
  'Nuevo flujo de activación',
];

export function StarteriaProductPreview() {
  return (
    <section
      id="vista-producto"
      aria-labelledby="starteria-product-preview-title"
      className="scroll-mt-24 bg-background-subtle py-8 sm:py-10 lg:py-12"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <figure aria-describedby="starteria-preview-disclaimer starteria-preview-provenance">
          <Card className="overflow-hidden gap-0 shadow-elevation-none">
            <header className="flex flex-col gap-3 bg-text-primary px-5 py-4 text-text-inverse sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <p className="text-sm font-semibold">Starteria</p>
                <h2
                  id="starteria-product-preview-title"
                  className="mt-1 max-w-xl text-base font-semibold leading-6 text-text-inverse sm:text-lg"
                >
                  Así puede verse el trabajo cuando está conectado
                </h2>
                <p className="mt-1 text-sm text-text-inverse/80">Lectura de prioridad</p>
              </div>
              <div
                id="starteria-preview-disclaimer"
                className="max-w-xl sm:text-right"
              >
                <p className="text-sm font-semibold">
                  Ejemplo ilustrativo · no es un análisis real
                </p>
                <p className="mt-1 text-sm text-text-inverse/80">
                  Contenido, nombres, relaciones y estados ficticios.
                </p>
              </div>
            </header>

            <div className="divide-y divide-border-default">
              <div className="grid gap-2 px-5 py-5 sm:px-7 md:grid-cols-[180px_1fr] md:items-center">
                <p className="text-sm font-medium text-text-secondary">Prioridad</p>
                <p className="text-lg font-semibold leading-snug text-text-primary sm:text-xl">
                  Mejorar adopción del canal digital
                </p>
              </div>

              <div className="grid gap-4 px-5 py-5 sm:px-7 md:grid-cols-[180px_1fr]">
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary">
                    Relaciones de trabajo
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    De la prioridad a las iniciativas
                  </p>
                </div>
                <div className="space-y-4 border-l border-border-strong pl-4">
                  <dl className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                        Frente
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-text-primary">
                        Experiencia digital
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                        Reto
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-text-primary">
                        Facilitar la activación inicial
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <h4 className="text-xs font-medium uppercase tracking-wide text-text-muted">
                      Iniciativas
                    </h4>
                    <ul className="mt-2 space-y-2 border-l border-border-strong pl-4">
                      {INITIATIVES.map((initiative) => (
                        <li
                          key={initiative}
                          className="text-sm font-medium leading-6 text-text-primary"
                        >
                          {initiative}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary">
                    Señales y evidencia
                  </h3>
                  <ul className="mt-3 space-y-3">
                    <li className="text-sm leading-6 text-text-primary">
                      <span className="font-semibold">Señal a revisar:</span>{' '}
                      uso después del primer acceso
                    </li>
                    <li className="text-sm leading-6 text-text-primary">
                      <span className="font-semibold">Evidencia pendiente:</span>{' '}
                      qué facilita la activación inicial
                    </li>
                  </ul>
                </div>
                <div className="border-l-2 border-border-strong pl-4">
                  <h3 className="text-sm font-semibold text-text-secondary">
                    Atención por revisar
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-text-primary">
                    Bloqueo ilustrativo: dependencia de soporte por aclarar
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    Gap de evidencia: falta entender qué ocurre después del primer acceso
                  </p>
                </div>
              </div>

              <div className="grid gap-2 border-l-4 border-brand-primary bg-background-subtle px-5 py-5 sm:px-7 md:grid-cols-[180px_1fr] md:items-center">
                <h3 className="text-sm font-semibold text-text-secondary">
                  Decisión a preparar
                </h3>
                <div>
                  <p className="text-base font-semibold leading-6 text-text-primary">
                    ¿Continuar, ajustar o pausar la prueba?
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    La decisión sigue siendo de las personas.
                  </p>
                </div>
              </div>
            </div>
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
