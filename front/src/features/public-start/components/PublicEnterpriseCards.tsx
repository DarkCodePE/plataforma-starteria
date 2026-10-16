import React from 'react';
import { BarChart3, Building2, Calendar } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';

const ENTERPRISE_CARDS = [
  {
    title: 'Dar trazabilidad a mi portafolio de iniciativas',
    icon: BarChart3,
  },
  {
    title: 'Alinear objetivos estratégicos, retos e iniciativas',
    icon: Building2,
  },
];

export function PublicEnterpriseCards() {
  return (
    <section className="mx-auto max-w-4xl rounded-ds-lg border border-border-default bg-surface-default/75 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            ¿Quieres usar Starteria para una empresa o equipo?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Coordina retos, iniciativas y decisiones sin perder el hilo entre equipos.
          </p>
        </div>
        <Button
          type="button"
          className="h-auto min-h-11 w-full min-w-0 flex-wrap whitespace-normal break-words px-3 py-2 text-center sm:w-auto sm:shrink"
        >
          <Calendar size={15} />
          Agendar demo enterprise
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {ENTERPRISE_CARDS.map(card => (
          <div key={card.title} className="rounded-ds-md border border-border-default bg-background-subtle p-3">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-ds-sm bg-surface-default text-brand-primary shadow-sm ring-1 ring-border-default">
              <card.icon size={17} />
            </div>
            <p className="text-sm font-semibold text-text-primary">{card.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
