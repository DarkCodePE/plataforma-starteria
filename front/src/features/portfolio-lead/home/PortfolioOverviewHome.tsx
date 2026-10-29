import React from 'react';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CheckSquare, Gauge, Sparkles } from 'lucide-react';
import type { PortfolioHomeReadModel } from '../../../app/services/portfolioService';

type Props = {
  model: PortfolioHomeReadModel;
  onOpenCopilot: () => void;
  onOpenAdditionalFront: () => void;
  openingAdditionalFront?: boolean;
  copilotAvailable?: boolean;
};

type OverviewItem = { key: string; title: string; detail: string };

export function PortfolioOverviewHome({
  model,
  onOpenCopilot,
  onOpenAdditionalFront,
  openingAdditionalFront = false,
  copilotAvailable = false,
}: Props) {
  const fronts = model.strategicUnits ?? [];
  const linkedInitiatives = fronts.flatMap((front) => front.challenges.flatMap((challenge) => challenge.initiatives));
  const independentInitiatives = model.independentInitiatives ?? [];
  const initiatives = [...linkedInitiatives, ...independentInitiatives];
  const assignments = model.handoffAssignments ?? [];
  const challengeAssignments = assignments.filter((assignment) => assignment.targetKind === 'CHALLENGE');
  const activeFront = fronts[0] ?? null;
  const observations = activeFront?.metricObservations ?? [];
  const latestObservation = observations.length > 0 ? observations[observations.length - 1] : null;
  const handoffAttention = assignments.flatMap<OverviewItem>((assignment) => {
    if (assignment.deliveryStatus === 'failed') {
      return [{ key: assignment.assignmentId, title: 'Error al enviar', detail: assignmentDetail(assignment) }];
    }
    if (assignment.handoffState === 'CREATED') {
      return [{ key: assignment.assignmentId, title: 'Pendiente de envío', detail: assignmentDetail(assignment) }];
    }
    if (assignment.handoffState === 'REJECTED' && !assignment.portfolioResponse) {
      return [{
        key: assignment.assignmentId,
        title: 'Rechazo pendiente de respuesta',
        detail: `${assignmentDetail(assignment)} · requiere una decisión del Portfolio Lead antes de reasignar.`,
      }];
    }
    return [];
  });
  const projectedAttention = model.attention.map((item) => ({
    key: `${item.entity.type}-${item.entity.id}-${item.summary}`,
    title: item.summary,
    detail: item.reason ?? item.suggestedAction ?? 'Sin contexto adicional registrado.',
  }));
  const actionableCount = handoffAttention.length + model.attention.length + model.pendingDecisions.length;
  const sentCount = assignments.filter((item) => ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'STARTED'].includes(item.handoffState)).length;
  const viewedCount = assignments.filter((item) => item.handoffState === 'VIEWED').length;
  const unavailableSegments = Object.entries(model.availability ?? {})
    .filter(([, value]) => value === 'unavailable')
    .map(([key]) => key);
  const whatWeSee = `${initiatives.length} ${initiatives.length === 1 ? 'Project canónico' : 'Projects canónicos'} en ${fronts.length} ${fronts.length === 1 ? 'frente' : 'frentes'} y ${assignments.length} ${assignments.length === 1 ? 'Assignment' : 'Assignments'} persistidos.`;
  const whatIsMissing = unavailableSegments.length > 0
    ? `${unavailableSegments.length} bloque${unavailableSegments.length === 1 ? '' : 's'} de lectura no disponibles; el resto del Overview conserva sus datos.`
    : observations.length === 0
      ? 'No hay lecturas KPI canónicas fechadas, con unidad y fuente; no se calcula tendencia ni distancia a meta.'
      : 'No hay gaps técnicos detectados en la lectura KPI disponible.';
  const nextIntervention = handoffAttention[0]?.title
    ?? model.pendingDecisions[0]?.requestedDecision
    ?? model.attention[0]?.summary
    ?? 'No hay una intervención persistida pendiente ahora.';

  return <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 lg:px-8" data-testid="portfolio-overview-home">
    <header data-testid="portfolio-overview-header" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7 lg:flex lg:items-center lg:justify-between lg:gap-6">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Portfolio Overview</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">¿Qué necesita tu atención para mover el negocio?</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Una lectura ejecutiva de objetivo, frentes, retos, Projects, encargos y decisiones persistidas.</p>
      </div>
      <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:mt-0 lg:shrink-0">
        <button type="button" disabled={openingAdditionalFront} onClick={onOpenAdditionalFront} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:opacity-60 sm:w-auto">
          <span aria-hidden="true">+</span>{openingAdditionalFront ? 'Abriendo…' : 'Crear nuevo frente estratégico'}<ArrowRight aria-hidden="true" size={16} />
        </button>
        {copilotAvailable ? <button type="button" onClick={onOpenCopilot} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-800 sm:w-auto"><Sparkles size={17} />Abrir Copilot de portafolio</button> : null}
      </div>
    </header>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-label="Objetivo y señal">
      <article className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm md:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">Objetivo estratégico</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight">{model.availability?.strategicUnits === 'unavailable' ? 'Objetivo temporalmente no disponible' : activeFront?.desiredOutcome ?? 'Sin objetivo estratégico confirmado'}</h2>
        <p className="mt-2 text-xs font-semibold text-violet-200">{activeFront ? `Frente: ${activeFront.strategicFront.name}${fronts.length > 1 ? ` · ${fronts.length} frentes visibles` : ''}` : 'Sin frente canónico en alcance'}</p>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{model.portfolioReading.summary ?? 'Todavía no hay una lectura publicada. La estructura canónica sigue disponible debajo.'}</p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2"><Gauge size={18} className="text-violet-700" /><h2 className="font-semibold text-slate-950">Indicador y seguimiento</h2></div>
        <p className="mt-3 text-lg font-semibold text-slate-950">{activeFront?.signal ?? 'Sin indicador confirmado'}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricField label="Baseline declarado" value={activeFront?.baseline} />
          <MetricField label="Meta declarada" value={activeFront?.target} />
          <MetricField label="Horizonte" value={activeFront?.horizon} />
          <MetricField label="Última lectura" value={latestObservation ? `${latestObservation.value} ${latestObservation.unit}` : null} field="latest-observation" />
        </dl>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MetricField label="Distancia a meta" value={null} />
          <MetricField label="Fuente de configuración" value={activeFront?.metricSource ?? null} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">{latestObservation ? `Lectura del ${formatDate(latestObservation.observedAt)} · fuente ${latestObservation.source}.` : 'Sin serie canónica fechada, unidad y fuente; no se muestra gráfico.'}</p>
      </article>
    </section>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen del portafolio">
      <Counter icon={<BriefcaseBusiness size={18} />} label="Projects canónicos" value={initiatives.length} dataMetric="canonical-projects" detail={`${linkedInitiatives.length} vinculados · ${independentInitiatives.length} independientes`} />
      <Counter icon={<CheckSquare size={18} />} label="Assignments" value={assignments.length} dataMetric="assignments" detail={`${sentCount} procesadas · ${viewedCount} con enlace abierto`} />
      <Counter icon={<AlertTriangle size={18} />} label="Alertas o decisiones" value={actionableCount} dataMetric="actionable" detail="Intervenciones y decisiones persistidas" />
    </section>

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Atención y decisiones">
      <OverviewList title="Requiere intervención" icon={<AlertTriangle size={18} />} empty="No hay intervenciones persistidas que requieran atención ahora." items={[...handoffAttention, ...projectedAttention].slice(0, 5)} />
      <OverviewList title="Decisiones del portafolio" icon={<CheckSquare size={18} />} empty="No hay decisiones pendientes persistidas." items={model.pendingDecisions.slice(0, 5).map((item) => ({ key: item.requestId, title: item.requestedDecision ?? 'Decisión por resolver', detail: `Project ${item.initiativeId} · ${item.status ?? 'estado desconocido'}` }))} />
    </section>

    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3 md:p-7" aria-label="Lectura consultiva Startería">
      <ConsultativeBlock title="Qué vemos" text={whatWeSee} />
      <ConsultativeBlock title="Qué falta" text={whatIsMissing} />
      <ConsultativeBlock title="Próxima intervención" text={nextIntervention} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7" aria-label="Capacidad, tiempo y recursos">
      <h2 className="font-semibold text-slate-950">Capacidad, tiempo y recursos</h2>
      {model.availability?.capacity === 'unavailable' ? <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">No disponible: no pudimos recuperar la lectura de capacidad.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricField label="Capacidad observada" value={model.capacity ? `${model.capacity.totalActiveInitiatives} ${model.capacity.totalActiveInitiatives === 1 ? 'iniciativa activa' : 'iniciativas activas'}` : null} />
        <MetricField label="Horas observadas" value={null} />
        <MetricField label="Coste observado" value={null} />
      </div>}
      {model.capacity ? <><p className="mt-3 text-xs leading-5 text-slate-500">{model.capacity.note}</p>{model.capacity.signals.length > 0 ? <ul className="mt-3 space-y-2 text-sm text-slate-700">{model.capacity.signals.slice(0, 3).map((signal) => <li key={`${signal.kind}-${signal.frontId}-${signal.challengeId ?? ''}`} className="rounded-lg bg-slate-50 px-3 py-2">{signal.message}</li>)}</ul> : null}</> : null}
      <p className="mt-3 text-xs text-slate-500">{model.learningsUnavailable ? 'Los aprendizajes de decisiones no están disponibles.' : `${model.learnings.length} aprendizajes persistidos disponibles.`}</p>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7" aria-labelledby="portfolio-map-title">
      <div>
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Portafolio en contexto</p><h2 id="portfolio-map-title" className="mt-1 text-xl font-semibold text-slate-950">Objetivo → Frente → Reto → Initiative / Encargo</h2></div>
      </div>
      {model.availability?.strategicUnits === 'unavailable' ? <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No pudimos recuperar la proyección de frentes ahora. El resto del Overview sigue disponible.</p> : fronts.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">Todavía no hay frentes canónicos en tu alcance.</p> : <div className="mt-5 grid gap-4">{fronts.map((front) => <article key={front.strategicFront.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Frente estratégico</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{front.strategicFront.name}</h3><a className="mt-2 inline-flex text-xs font-semibold text-violet-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={`/portfolio/frentes-estrategicos?frontId=${encodeURIComponent(front.strategicFront.id)}`}>Ver frente {front.strategicFront.name}</a></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{front.initiativeSummary.total} {front.initiativeSummary.total === 1 ? 'iniciativa' : 'iniciativas'}</span></div>
        <div className="mt-4 grid gap-3">{front.challenges.map((challenge) => {
          const challengeHandoffs = assignments.filter((assignment) => assignment.challengeRef === challenge.id && assignment.targetKind === 'CHALLENGE');
          return <div key={challenge.id} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reto</p><h4 className="mt-1 font-semibold text-slate-950">{challenge.title}</h4></div><a href={`/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`} className="text-xs font-semibold text-violet-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Ver reto {challenge.title}</a></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-semibold text-slate-500">Iniciativas canónicas</p>{challenge.initiatives.length ? <ul className="mt-1 space-y-2 text-sm text-slate-800">{challenge.initiatives.map((initiative) => {
            const initiativeHandoff = assignments.find((assignment) => assignment.initiativeRef === initiative.initiativeId);
            return <li key={initiative.initiativeId} className="rounded-md bg-slate-50 px-2.5 py-2"><a href={`/portfolio/iniciativas?initiativeId=${encodeURIComponent(initiative.initiativeId)}`} className="font-semibold text-violet-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Abrir iniciativa {initiative.title ?? initiative.initiativeId}</a><p className="mt-1 text-xs text-slate-600">Project: {initiative.currentExecutionState.projectStatus ?? 'estado no disponible'} · Handoff: {initiativeHandoff ? assignmentStatusLabel(initiativeHandoff) : 'sin Assignment vinculado'}</p></li>;
          })}</ul> : <p className="mt-1 text-sm text-slate-500">Ninguna todavía</p>}</div><div><p className="text-xs font-semibold text-slate-500">Encargos del reto</p>{challengeHandoffs.length ? <ul className="mt-1 space-y-2 text-xs text-slate-700">{challengeHandoffs.map((assignment) => <li key={assignment.assignmentId} className="rounded-md bg-slate-50 px-2.5 py-2"><span className="font-semibold">{assignmentStatusLabel(assignment)}</span><br />Assignment {assignment.assignmentId}{assignment.briefVersionId ? ` · BriefVersion ${assignment.briefVersionId}` : ''}</li>)}</ul> : <p className="mt-1 text-sm text-slate-500">0 encargos del reto</p>}<p className="mt-2 text-xs text-slate-500">{challengeHandoffs.length} {challengeHandoffs.length === 1 ? 'encargo del reto' : 'encargos del reto'} · no cuentan como iniciativas</p></div></div></div>;
        })}</div>
      </article>)}</div>}
      {challengeAssignments.length > 0 ? <p className="mt-4 text-xs leading-5 text-slate-500">Los encargos CHALLENGE permanecen vinculados al reto hasta que exista una iniciativa canónica resultante.</p> : null}
      {independentInitiatives.length > 0 ? <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5" aria-labelledby="independent-initiatives-title">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Sin frente o reto principal</p>
        <h3 id="independent-initiatives-title" className="mt-1 text-lg font-semibold text-slate-950">Iniciativas independientes</h3>
        <p className="mt-1 text-sm text-slate-600">Projects de tu organización que conservan identidad propia sin heredar un reto ficticio.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{independentInitiatives.map((initiative) => <li key={initiative.initiativeId} className="rounded-lg border border-slate-200 bg-white p-3">
          <a href={`/portfolio/iniciativas?initiativeId=${encodeURIComponent(initiative.initiativeId)}`} className="font-semibold text-violet-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Abrir iniciativa {initiative.title ?? initiative.initiativeId}</a>
          <p className="mt-1 text-xs text-slate-600">Project: {initiative.currentExecutionState.projectStatus ?? 'estado no disponible'} · sin vinculación estratégica inventada</p>
        </li>)}</ul>
      </section> : null}
    </section>
  </div>;
}

function assignmentStatusLabel(assignment: PortfolioHomeReadModel['handoffAssignments'][number]): string {
  if (assignment.deliveryStatus === 'failed') return 'Falló el envío';
  const labels: Record<string, string> = {
    CREATED: 'Pendiente de envío', SENT: 'Procesada por SMTP', VIEWED: 'Enlace abierto',
    ACCEPTED: 'Aceptada', REJECTED: 'Rechazada', REVOKED: 'Revocada', EXPIRED: 'Expirada', STARTED: 'Iniciada',
  };
  return labels[assignment.handoffState] ?? assignment.handoffState;
}

function assignmentDetail(assignment: PortfolioHomeReadModel['handoffAssignments'][number]): string {
  const target = assignment.targetKind === 'CHALLENGE' ? 'Reto' : 'Iniciativa';
  return `${target} · Assignment ${assignment.assignmentId}${assignment.briefVersionId ? ` · BriefVersion ${assignment.briefVersionId}` : ''}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}

function MetricField({ label, value, field }: { label: string; value: string | null | undefined; field?: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd data-field={field} className="mt-1 text-sm font-semibold text-slate-950">{value ?? 'Sin datos'}</dd></div>;
}

function Counter({ icon, label, value, detail, dataMetric }: { icon: React.ReactNode; label: string; value: number; detail: string; dataMetric: string }) {
  return <article className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-800">{icon}</span><div><p data-metric={dataMetric} className="text-2xl font-semibold text-slate-950">{value}</p><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></article>;
}

function OverviewList({ title, icon, empty, items }: { title: string; icon: React.ReactNode; empty: string; items: OverviewItem[] }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-slate-950">{icon}<h2 className="font-semibold">{title}</h2></div>{items.length ? <ul className="mt-3 divide-y divide-slate-100">{items.map((item) => <li key={item.key} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p></li>)}</ul> : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{empty}</p>}</section>;
}

function ConsultativeBlock({ title, text }: { title: string; text: string }) {
  return <article><h2 className="text-sm font-semibold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>;
}
