import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CheckSquare, Gauge, Sparkles } from 'lucide-react';
import type { PortfolioHomeReadModel } from '../../../app/services/portfolioService';
import type { PortfolioResumableSession } from '../bootstrap/services/portfolioBootstrapClient';

type Props = {
  model: PortfolioHomeReadModel;
  onOpenCopilot: () => void;
  onOpenAdditionalFront: () => void;
  openingAdditionalFront?: boolean;
  copilotAvailable?: boolean;
  onStartOpportunity?: () => void;
  startingOpportunity?: boolean;
  resumableSessions?: PortfolioResumableSession[];
  resumableStatus?: 'loading' | 'ready' | 'error';
  resumableError?: string | null;
  onRetryResumable?: () => void;
  onResumeSession?: (sessionId: string) => void;
};

type OverviewItem = { key: string; title: string; detail: string };
type OperationalRow = {
  key: string;
  title: string;
  destination: string;
  status: string;
  nextAction: string;
  actor: string | null;
  provenance: unknown;
  evidence: string;
  updatedAt: string | null;
};

export function PortfolioOverviewHome({
  model,
  onOpenCopilot,
  onOpenAdditionalFront,
  openingAdditionalFront = false,
  copilotAvailable = false,
  onStartOpportunity,
  startingOpportunity = false,
  resumableSessions = [],
  resumableStatus = 'ready',
  resumableError = null,
  onRetryResumable,
  onResumeSession,
}: Props) {
  const fronts = model.strategicUnits ?? [];
  const linkedInitiatives = fronts.flatMap((front) => front.challenges.flatMap((challenge) => challenge.initiatives));
  const independentInitiatives = model.independentInitiatives ?? [];
  const initiatives = [...linkedInitiatives, ...independentInitiatives];
  const assignments = model.handoffAssignments ?? [];
  const labRequests = model.labRequests ?? [];
  const [operationalFilter, setOperationalFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const operationalRows = useMemo(() => buildOperationalRows(model, initiatives), [model, initiatives]);
  const visibleOperationalRows = operationalRows.filter((row) => {
    const needle = operationalFilter.trim().toLocaleLowerCase('es');
    return needle.length === 0 || [row.title, row.destination, row.status, row.nextAction]
      .some((value) => value.toLocaleLowerCase('es').includes(needle));
  });
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
    <header data-testid="portfolio-overview-header" className="rounded-2xl border border-[#e4e7f0] bg-white p-5 shadow-sm md:p-7 lg:flex lg:items-center lg:justify-between lg:gap-6">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Portfolio Overview</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">¿Qué necesita tu atención para mover el negocio?</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Una lectura ejecutiva de objetivo, frentes, retos, Projects, encargos y decisiones persistidas.</p>
      </div>
      <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:mt-0 lg:shrink-0">
        {fronts.length > 0 ? (
          <button type="button" disabled={openingAdditionalFront} onClick={onOpenAdditionalFront} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171b36] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 sm:w-auto">
            <span aria-hidden="true">+</span>{openingAdditionalFront ? 'Abriendo…' : 'Crear nuevo frente estratégico'}<ArrowRight aria-hidden="true" size={16} />
          </button>
        ) : resumableStatus === 'ready' && resumableSessions.length === 0 && onStartOpportunity ? (
          <button type="button" disabled={startingOpportunity} onClick={onStartOpportunity} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6446c0] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 sm:w-auto">
            <Sparkles size={17} />{startingOpportunity ? 'Abriendo…' : 'Preparar nueva oportunidad'}<ArrowRight aria-hidden="true" size={16}/>
          </button>
        ) : null}
        {copilotAvailable ? <button type="button" onClick={onOpenCopilot} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-800 sm:w-auto"><Sparkles size={17} />Abrir Copilot de portafolio</button> : null}
      </div>
    </header>

    <section aria-label="Procesos en curso" data-testid="portfolio-resumable-workspaces" className="rounded-2xl border border-[#e4e7f0] bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#6446c0]">Tu espacio de trabajo</p>
          <h2 className="mt-1 text-lg font-semibold text-[#182246]">Preparaciones y conversaciones</h2>
          <p className="mt-1 text-sm text-[#6c7695]">Retoma donde lo dejaste. Abrir Inicio no crea ni modifica ninguna iniciativa.</p>
        </div>
        <span className="rounded-full bg-[#f3eefc] px-3 py-1.5 text-xs font-bold text-[#493297]">
          {resumableStatus === 'ready' ? `${resumableSessions.length} en preparación` : 'Comprobando'}
        </span>
      </div>
      {resumableStatus === 'loading' ? (
        <p role="status" className="mt-5 rounded-xl bg-[#f6f7fc] p-4 text-sm text-[#6c7695]">Recuperando tus procesos guardados…</p>
      ) : resumableStatus === 'error' ? (
        <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{resumableError ?? 'No se pudieron recuperar tus procesos.'} No se ha creado otro espacio.</p>
          {onRetryResumable ? <button type="button" onClick={onRetryResumable} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">Reintentar consulta</button> : null}
        </div>
      ) : resumableSessions.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#cdd5e7] bg-[#fbfcff] p-5">
          <p className="font-semibold text-[#182246]">No hay preparaciones pendientes</p>
          <p className="mt-1 text-sm text-[#6c7695]">Cuando inicies una conversación o un nuevo espacio desde aquí, podrás regresar y continuar sin perder su contexto.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {resumableSessions.map((session) => (
            <article key={session.sessionId} className="rounded-xl border border-[#decfff] bg-[#f9f6ff] p-4" data-testid="portfolio-resumable-session">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#e8ddff] px-2 py-1 text-[11px] font-bold text-[#493297]">En progreso</span>
                <span className="text-xs text-[#6c7695]">{resumablePhaseName(session.bootstrapPhase)}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-[#182246]">{session.title}</h3>
              <p className="mt-2 text-xs text-[#6c7695]">
                {session.source === 'entry_continuation' ? 'Continuación desde entrada anterior' : 'Iniciado desde Portfolio Lead'}
                {' · '}Sesión creada {resumeDateLabel(session.createdAt)}
              </p>
              <p className="mt-1 text-xs text-[#6c7695]">
                {session.contextVersion
                  ? `Borrador de contexto v${session.contextVersion} · actualizado ${resumeDateLabel(session.contextUpdatedAt ?? session.updatedAt)}`
                  : `Sesión actualizada ${resumeDateLabel(session.updatedAt)}`}
                {' · '}La información pendiente se revisará antes de confirmar.
              </p>
              <button type="button" onClick={() => onResumeSession?.(session.sessionId)} disabled={!onResumeSession}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6446c0] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                Retomar este espacio <ArrowRight aria-hidden="true" size={16}/>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>

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
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <MetricField label="Distancia a meta" value={null} />
          <MetricField label="Fuente de configuración" value={activeFront?.metricSource ?? null} />
        </dl>
        <p className="mt-3 text-xs leading-5 text-slate-500">{latestObservation ? `Lectura del ${formatDate(latestObservation.observedAt)} · fuente ${latestObservation.source}.` : 'Sin serie canónica fechada, unidad y fuente; no se muestra gráfico.'}</p>
      </article>
    </section>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen del portafolio">
      <Counter icon={<BriefcaseBusiness size={18} />} label="Projects canónicos" value={initiatives.length} dataMetric="canonical-projects" detail={`${linkedInitiatives.length} vinculados · ${independentInitiatives.length} independientes`} />
      <Counter icon={<CheckSquare size={18} />} label="Assignments" value={assignments.length} dataMetric="assignments" detail={`${sentCount} procesadas · ${viewedCount} con enlace abierto`} />
      <Counter icon={<AlertTriangle size={18} />} label="Alertas o decisiones" value={actionableCount} dataMetric="actionable" detail="Intervenciones y decisiones persistidas" />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7" aria-labelledby="portfolio-operational-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Seguimiento real</p>
          <h2 id="portfolio-operational-title" className="mt-1 text-xl font-semibold text-slate-950">Trabajo y encargos</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Estados leídos de sus fuentes gobernadas; ninguna fila activa un Step ni acredita impacto.</p>
        </div>
        <label className="text-sm font-semibold text-slate-800">
          Filtrar trabajo y encargos
          <input type="search" value={operationalFilter} onChange={(event) => setOperationalFilter(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-950 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200 sm:w-72" placeholder="Nombre, owner o estado" />
        </label>
      </div>
      {(model.availability?.workItems === 'unavailable' || model.availability?.briefs === 'unavailable') ? <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Parte del seguimiento no está disponible. Las filas visibles conservan su estado real.</p> : null}
      <div className="mt-4 overflow-x-auto" data-testid="portfolio-operational-table-scroll">
        <table className="min-w-[900px] w-full border-collapse text-left text-sm" aria-label="Seguimiento operativo del portafolio">
          <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Trabajo/Encargo</th><th className="px-3 py-3">Destino/Owner</th><th className="px-3 py-3">Estado real</th><th className="px-3 py-3">Siguiente acción</th><th className="px-3 py-3">Detalle</th></tr></thead>
          <tbody>{visibleOperationalRows.map((row) => {
            const expanded = expandedRow === row.key;
            const detailId = `portfolio-operational-detail-${row.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            return <React.Fragment key={row.key}>
              <tr className="border-b border-slate-100 align-top last:border-0"><th scope="row" className="px-3 py-3 font-semibold text-slate-950">{row.title}</th><td className="px-3 py-3 text-slate-700">{row.destination}</td><td className="px-3 py-3"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">{row.status}</span></td><td className="px-3 py-3 text-slate-700">{row.nextAction}</td><td className="px-3 py-3"><button type="button" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedRow(expanded ? null : row.key)} className="min-h-11 rounded-lg px-2 font-semibold text-violet-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{expanded ? 'Ocultar detalle' : `Ver detalle de ${row.title}`}</button></td></tr>
              {expanded ? <tr id={detailId} className="border-b border-slate-200 bg-slate-50"><td colSpan={5} className="px-4 py-4 text-xs leading-5 text-slate-700"><div className="grid gap-1 sm:grid-cols-2"><p><strong>Actor:</strong> {row.actor ?? 'Sin datos'}</p><p><strong>Actualizado:</strong> {row.updatedAt ? formatDate(row.updatedAt) : 'Sin datos'}</p><p><strong>Fuente y procedencia:</strong> {formatTrace(row.provenance)}</p><p><strong>Evidencia/eventos:</strong> {row.evidence}</p><p><strong>Permiso:</strong> lectura del portafolio de la organización</p><p><strong>Siguiente paso:</strong> {row.nextAction}</p></div></td></tr> : null}
            </React.Fragment>;
          })}</tbody>
        </table>
        {visibleOperationalRows.length === 0 ? <p role="status" className="py-6 text-center text-sm text-slate-600">No hay filas que coincidan con el filtro.</p> : null}
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-2" aria-label="Atención y decisiones">
      <OverviewList title="Requiere intervención" icon={<AlertTriangle size={18} />} empty="No hay intervenciones persistidas que requieran atención ahora." items={[...handoffAttention, ...projectedAttention].slice(0, 5)} />
      <OverviewList title="Decisiones del portafolio" icon={<CheckSquare size={18} />} empty="No hay decisiones pendientes persistidas." items={model.pendingDecisions.slice(0, 5).map((item) => ({ key: item.requestId, title: item.requestedDecision ?? 'Decisión por resolver', detail: `Project ${item.initiativeId} · ${item.status ?? 'estado desconocido'}` }))} />
    </section>

    {model.availability?.labRequests === 'unavailable' ? <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">No pudimos recuperar el seguimiento de Startería Lab. El resto del Overview sigue disponible.</section> : labRequests.length > 0 ? <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm md:p-6" aria-labelledby="portfolio-lab-overview-title">
      <h2 id="portfolio-lab-overview-title" className="font-semibold text-slate-950">Startería Lab</h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">Solicitudes humanas separadas de Assignments, Projects y Steps. Su estado no acredita una reunión salvo que el equipo de Lab la registre expresamente.</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">{labRequests.map((item) => <li key={item.requestId} className="rounded-xl border border-cyan-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold text-slate-950">Solicitud Lab {item.requestId}</p><span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-950">{labRequestStatusLabel(item)}</span></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Reto {item.challengeId} · BriefVersion {item.briefVersionId}</p>
        <p className="mt-1 text-xs text-slate-500">Actualizada {formatDate(item.updatedAt)}</p>
      </li>)}</ul>
    </section> : null}

    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3 md:p-7" aria-label="Lectura consultiva Startería">
      <ConsultativeBlock title="Qué vemos" text={whatWeSee} />
      <ConsultativeBlock title="Qué falta" text={whatIsMissing} />
      <ConsultativeBlock title="Próxima intervención" text={nextIntervention} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7" aria-label="Capacidad, tiempo y recursos">
      <h2 className="font-semibold text-slate-950">Capacidad, tiempo y recursos</h2>
      {model.availability?.capacity === 'unavailable' ? <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">No disponible: no pudimos recuperar la lectura de capacidad.</p> : <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricField label="Capacidad observada" value={model.capacity ? `${model.capacity.totalActiveInitiatives} ${model.capacity.totalActiveInitiatives === 1 ? 'iniciativa activa' : 'iniciativas activas'}` : null} />
        <MetricField label="Horas observadas" value={null} />
        <MetricField label="Coste observado" value={null} />
        <MetricField label="ROI observado" value={null} field="roi" />
        <MetricField label="Impacto observado" value={null} field="impact" />
      </dl>}
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
            const confirmedOutput = initiative.lastConfirmedOutput;
            return <li key={initiative.initiativeId} className="rounded-md bg-slate-50 px-2.5 py-2"><a href={`/portfolio/iniciativas?initiativeId=${encodeURIComponent(initiative.initiativeId)}`} className="font-semibold text-violet-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Abrir iniciativa {initiative.title ?? initiative.initiativeId}</a><p className="mt-1 text-xs text-slate-600">Project: {initiative.currentExecutionState.projectStatus ?? 'estado no disponible'} · Handoff: {initiativeHandoff ? assignmentStatusLabel(initiativeHandoff) : 'sin Assignment vinculado'}</p><p className="mt-1 text-xs text-slate-600">Step registrado: {initiative.currentExecutionState.currentStep ?? 'sin dato'} · Fuente: Project · {initiative.updatedAt ? `actualizado ${formatDate(initiative.updatedAt)}` : 'Sin actualización disponible'}</p>{confirmedOutput ? <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-950"><p className="font-bold">Último resultado confirmado: Step {confirmedOutput.stepNumber}</p><p className="mt-1">v{confirmedOutput.version} · {confirmedOutput.outputKey} · {confirmedOutput.confirmedAt ? formatDate(confirmedOutput.confirmedAt) : 'fecha no disponible'}</p><a href={`/projects/${encodeURIComponent(initiative.initiativeId)}/step/${confirmedOutput.stepNumber}`} className="mt-2 inline-flex min-h-11 items-center font-bold text-emerald-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Ver resultado confirmado de Step {confirmedOutput.stepNumber}</a></div> : <p className="mt-1 text-xs leading-5 text-amber-800">El avance no acredita un output ni evidencia confirmada.</p>}</li>;
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

function resumablePhaseName(phase: string): string {
  const names: Record<string, string> = {
    B0_CONTINUE: 'Punto de partida',
    B1_ANCHOR: 'Contexto y objetivo',
    B2_WORK_INTAKE: 'Incorporar trabajo',
    B3_PROVISIONAL_STRUCTURING: 'Análisis en preparación',
    B4_MATERIAL_REVIEW: 'Revisión de propuestas',
    B5_FIRST_READING: 'Primera lectura',
  };
  return names[phase] ?? 'Preparación en curso';
}

function resumeDateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'sin fecha verificable'
    : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildOperationalRows(model: PortfolioHomeReadModel, initiatives: Array<PortfolioHomeReadModel['strategicUnits'][number]['challenges'][number]['initiatives'][number] | PortfolioHomeReadModel['independentInitiatives'][number]>): OperationalRow[] {
  const workRows: OperationalRow[] = (model.workItems ?? []).map((item) => ({
    key: `work-${item.workItemId}`,
    title: item.label,
    destination: item.linkedInitiativeId ? `Iniciativa ${item.linkedInitiativeId}` : item.ownerCandidate ?? 'Sin owner confirmado',
    status: workItemStatusLabel(item.status),
    nextAction: workItemNextAction(item.status),
    actor: item.actorId,
    provenance: item.sourceRefs,
    evidence: `${item.sourceType} · WorkItem ${item.workItemId} · estado ${item.status}`,
    updatedAt: item.updatedAt,
  }));
  const briefRows: OperationalRow[] = (model.briefs ?? []).map((brief) => ({
    key: `brief-${brief.briefVersionId}`,
    title: `Brief v${brief.versionNumber}`,
    destination: brief.challengeTitle ?? `Reto ${brief.challengeId}`,
    status: brief.status === 'CONFIRMED' ? 'Brief confirmado' : 'Brief en borrador',
    nextAction: brief.status === 'CONFIRMED' ? 'Elegir Equipo y/o Startería Lab' : 'Confirmar Brief',
    actor: brief.confirmedByActorId ?? brief.createdByActorId,
    provenance: { sourceRefs: brief.sourceRefs, provenance: brief.provenance },
    evidence: `BriefVersion ${brief.briefVersionId} · estado ${brief.status}`,
    updatedAt: brief.confirmedAt ?? brief.createdAt,
  }));
  const assignmentRows: OperationalRow[] = (model.handoffAssignments ?? []).map((assignment) => ({
    key: `assignment-${assignment.assignmentId}`,
    title: `Assignment ${assignment.assignmentId}`,
    destination: assignment.invitedEmail ?? (assignment.initiativeRef ? `Iniciativa ${assignment.initiativeRef}` : `Reto ${assignment.challengeRef}`),
    status: assignmentStatusLabel(assignment),
    nextAction: assignmentNextAction(assignment),
    actor: null,
    provenance: assignment.sourceEventRefs ?? [],
    evidence: assignment.lastMaterialEvent ?? `Assignment ${assignment.assignmentId}`,
    updatedAt: assignment.startedAt ?? assignment.acceptedAt ?? assignment.rejectedAt ?? assignment.latestDeliveryAttemptAt ?? assignment.generatedAt ?? null,
  }));
  const initiativeRows: OperationalRow[] = initiatives.map((initiative) => ({
    key: `initiative-${initiative.initiativeId}`,
    title: initiative.title ?? `Iniciativa ${initiative.initiativeId}`,
    destination: 'Owner canónico',
    status: initiative.activationVisibility === 'initiative_active' ? 'Iniciativa iniciada' : 'Iniciativa canónica',
    nextAction: 'Abrir Initiative Overview',
    actor: null,
    provenance: { source: 'Project', initiativeId: initiative.initiativeId },
    evidence: initiative.currentExecutionState.currentStep == null ? 'Sin Step registrado' : `Step registrado ${initiative.currentExecutionState.currentStep}; no implica evidencia confirmada`,
    updatedAt: 'updatedAt' in initiative ? initiative.updatedAt ?? null : null,
  }));
  const labRows: OperationalRow[] = (model.labRequests ?? []).map((request) => ({
    key: `lab-${request.requestId}`,
    title: `Solicitud Lab ${request.requestId}`,
    destination: `Reto ${request.challengeId}`,
    status: labRequestStatusLabel(request),
    nextAction: request.notificationStatus === 'FAILED' ? 'Reintentar notificación' : request.status === 'MEETING_SCHEDULED' ? 'Dar seguimiento a la reunión registrada' : 'Esperar contacto humano',
    actor: null,
    provenance: { briefVersionId: request.briefVersionId },
    evidence: `Solicitud persistida · notificación ${request.notificationStatus}`,
    updatedAt: request.updatedAt,
  }));
  return [...workRows, ...briefRows, ...assignmentRows, ...initiativeRows, ...labRows];
}

function workItemStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'detected': return 'Detectado';
    case 'needs_review': return 'Necesita revisión';
    case 'pending': return 'Pendiente de decisión';
    case 'confirmed_in_portfolio': return 'Confirmado en portafolio';
    case 'rejected': return 'Rechazado';
    default: return status;
  }
}

function workItemNextAction(status: string): string {
  switch (status.toLowerCase()) {
    case 'detected': return 'Revisar trabajo detectado';
    case 'needs_review': return 'Completar revisión humana';
    case 'pending': return 'Resolver revisión pendiente';
    case 'confirmed_in_portfolio': return 'Revisar destino confirmado';
    case 'rejected': return 'Conservar trazabilidad';
    default: return 'Revisar estado';
  }
}

function assignmentNextAction(assignment: PortfolioHomeReadModel['handoffAssignments'][number]): string {
  if (assignment.deliveryStatus === 'failed') return 'Reintentar envío';
  const actions: Record<string, string> = {
    CREATED: 'Revisar y enviar', SENT: 'Esperar respuesta', VIEWED: 'Esperar respuesta',
    ACCEPTED: 'Iniciar de forma explícita', STARTED: 'Abrir Initiative Overview',
    REJECTED: 'Responder o reasignar', REVOKED: 'Revisar revocación', EXPIRED: 'Revisar expiración',
  };
  return actions[assignment.handoffState] ?? 'Revisar estado';
}

function formatTrace(value: unknown): string {
  if (value == null) return 'Sin datos';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return 'No serializable'; }
}

function assignmentStatusLabel(assignment: PortfolioHomeReadModel['handoffAssignments'][number]): string {
  if (assignment.deliveryStatus === 'failed') return 'Falló el envío';
  const labels: Record<string, string> = {
    CREATED: 'Pendiente de envío', SENT: 'Procesada por SMTP', VIEWED: 'Enlace abierto',
    ACCEPTED: 'Aceptada', REJECTED: 'Rechazada', REVOKED: 'Revocada', EXPIRED: 'Expirada', STARTED: 'Iniciada',
  };
  return labels[assignment.handoffState] ?? assignment.handoffState;
}

function labRequestStatusLabel(item: NonNullable<PortfolioHomeReadModel['labRequests']>[number]): string {
  if (item.status === 'MEETING_SCHEDULED') return 'Reunión registrada';
  if (['CLOSED', 'NOT_PROCEEDING', 'CANCELLED'].includes(item.status)) {
    return ({ CLOSED: 'Cerrada', NOT_PROCEEDING: 'No continúa', CANCELLED: 'Cancelada' } as Record<string, string>)[item.status];
  }
  if (item.notificationStatus === 'NOTIFIED') return 'Contacto pendiente';
  if (item.notificationStatus === 'FAILED') return 'Error al notificar';
  return 'Notificación pendiente';
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
