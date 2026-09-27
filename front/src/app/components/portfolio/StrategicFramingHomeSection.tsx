import React from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { StrategicFramingHomeState } from '../../services/portfolioService';

type Props = {
  state: StrategicFramingHomeState | null;
  loading?: boolean;
  onRetry?: () => void;
  onNavigate?: (path: string) => void;
};

export function StrategicFramingHomeSection({ state, loading = false, onRetry, onNavigate }: Props) {
  if (loading || !state) {
    return (
      <section aria-labelledby="strategic-framing-home-title" className="rounded-ds-lg border border-border-default bg-surface-default p-5 md:p-6">
        <Badge variant="neutral">Lectura estratégica</Badge>
        <h2 id="strategic-framing-home-title" className="mt-3 text-xl font-semibold text-text-primary">Lectura estratégica</h2>
        <p className="mt-2 text-sm text-text-secondary">Cargando la lectura estratégica del portafolio…</p>
      </section>
    );
  }

  switch (state.status) {
    case 'available':
      return <AvailableState projection={state.projection} onNavigate={onNavigate} />;
    case 'empty':
      return <StateCard title="Todavía no hay una lectura estratégica estructurada." description="Cuando empieces a conectar frentes, retos e iniciativas, Starteria podrá mostrarte cobertura, gaps y decisiones." />;
    case 'no_context':
      return <StateCard title="No hay un contexto de portafolio activo para esta sesión." description="La lectura estratégica aparecerá cuando exista un contexto autorizado." />;
    case 'context_selection_required':
      return <StateCard title="Tienes acceso a más de un espacio." description="Selecciona el portafolio que quieres consultar." action={<Button type="button" variant="secondary" onClick={() => undefined}>Seleccionar espacio</Button>} />;
    case 'not_authorized':
      return <StateCard title="Tu acceso a este portafolio cambió." description="Selecciona otro espacio disponible o solicita acceso." />;
    case 'unavailable':
      return <StateCard title="No pudimos cargar esta lectura ahora." description="La información principal del Home sigue disponible." action={<Button type="button" variant="secondary" onClick={onRetry}><RefreshCw aria-hidden="true" />Reintentar</Button>} />;
    default:
      return assertNever(state);
  }
}

function AvailableState({ projection, onNavigate }: { projection: Extract<StrategicFramingHomeState, { status: 'available' }>['projection']; onNavigate?: (path: string) => void }) {
  return (
    <section aria-labelledby="strategic-framing-home-title" className="rounded-ds-lg border border-border-default bg-surface-default p-5 md:p-6">
      <Badge variant="neutral">Lectura estratégica</Badge>
      <h2 id="strategic-framing-home-title" className="mt-3 text-xl font-semibold text-text-primary">¿Qué está ocurriendo estratégicamente?</h2>
      <p className="mt-2 text-sm text-text-secondary">Una lectura gobernada del foco, la cobertura y las decisiones que requieren revisión.</p>
      <div className="mt-5 rounded-ds-md border border-border-default bg-background-subtle p-4">
        <p className="text-sm text-text-secondary">{projection.totalStateCount} lecturas estratégicas disponibles{projection.hasMore ? ' y hay más por revisar.' : '.'}</p>
      </div>
      <div className="mt-5 space-y-3">
        {projection.items.map(item => (
          <div key={item.stateId} className="rounded-ds-md border border-border-default bg-background-subtle p-4">
            <p className="text-sm font-semibold text-text-primary">{item.intendedMovement ?? 'Movimiento estratégico en revisión'}</p>
            <dl className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-3">
              <div><dt className="text-xs text-text-muted">A atender ahora</dt><dd>{item.prioritization.addressNow}</dd></div>
              <div><dt className="text-xs text-text-muted">Candidaturas confirmadas</dt><dd>{item.structuring.confirmedCandidates}</dd></div>
              <div><dt className="text-xs text-text-muted">Sin promover</dt><dd>{item.structuring.unpromotedCandidates}</dd></div>
            </dl>
            {onNavigate ? <Button type="button" variant="link" size="sm" className="mt-2 px-0" onClick={() => onNavigate(item.workspaceHref)}>Abrir lectura <ArrowRight aria-hidden="true" /></Button> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function StateCard({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <section aria-labelledby="strategic-framing-home-title" className="rounded-ds-lg border border-border-default bg-surface-default p-5 md:p-6"><Badge variant="neutral">Lectura estratégica</Badge><h2 id="strategic-framing-home-title" className="mt-3 text-xl font-semibold text-text-primary">{title}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</section>;
}

function assertNever(value: never): never { throw new Error(`Unhandled Strategic Framing state: ${JSON.stringify(value)}`); }
