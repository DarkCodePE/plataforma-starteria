import React from 'react';
import { Download, FileText, X } from 'lucide-react';
import type { Initiative, PortfolioDecisionOutcome } from '../../portfolio/PortfolioLeadContext';
import {
  DecisionRecommendationPanel,
  DeliverablesList,
  ExecutiveStepTimeline,
  InfoCard,
  InitiativeStatusBadge,
} from './InitiativeExecutiveComponents';
import { InitiativeTeamPanel } from '../../../features/portfolio-lead/components/cards/InitiativeTeamPanel';

type Props = {
  initiative: Initiative | null;
  frontName: string;
  challengeName: string;
  recommendation: PortfolioDecisionOutcome;
  executiveOutputId?: string | null;
  alertSummary?: {
    label: string;
    whatHappens: string;
    whyItMatters: string;
    suggestedAction: string;
    expectedResponsible: string;
    ctaLabel: string;
    risk: string;
  };
  onPrimaryAlertAction?: () => void;
  onOpenExecutiveOutput?: () => void;
  onClose: () => void;
};

export function InitiativeExecutiveDetailDrawer({
  initiative,
  frontName,
  challengeName,
  recommendation,
  executiveOutputId,
  alertSummary,
  onPrimaryAlertAction,
  onOpenExecutiveOutput,
  onClose,
}: Props) {
  if (!initiative) return null;

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-[#f7f5ef] shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>DETALLE EJECUTIVO</p>
              <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{initiative.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{initiative.executiveSummary}</p>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <InitiativeStatusBadge status={initiative.status} />
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{initiative.currentStep}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoCard label="Frente" value={frontName} />
              <InfoCard label="Reto" value={challengeName} />
              <InfoCard label="Owner" value={initiative.teamOwner} />
              <InfoCard label="Equipo" value={initiative.teamMembers.length > 0 ? initiative.teamMembers.join(', ') : initiative.teamLabel || 'Sin equipo visible'} />
              <InfoCard label="Mentor" value={initiative.mentor || 'Sin mentor asignado'} />
              <InfoCard label="Sponsor touchpoint" value={initiative.sponsorTouchpoint || 'No aplica por ahora'} />
              <InfoCard label="Estado" value={initiative.status.replaceAll('_', ' ')} />
              <InfoCard label="Step actual" value={initiative.currentStep} />
              <InfoCard label="Última actividad" value={initiative.lastActivity} />
            </div>
          </section>

          {/* El roster real (TeamMember) con gestión para quien tiene portfolio:write; la tarjeta
              "Equipo" de arriba es el cache de nombres de meta y puede ir atrasada. */}
          <InitiativeTeamPanel projectId={initiative.projectId} challengeId={initiative.challengeId} initiativeName={initiative.name} />

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>CONTEXTO DE PORTAFOLIO</p>
            <h3 className="mt-2 text-lg text-slate-950" style={{ fontWeight: 700 }}>Qué iniciativa es y qué métrica intenta mover</h3>
            <p className="mt-2 text-sm text-slate-600">
              Esta vista resume el contexto padre y la señal principal de la iniciativa antes de entrar al detalle operativo.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoCard label="Frente estratégico" value={frontName} />
              <InfoCard label="Reto asociado" value={challengeName} />
              <InfoCard label="Métrica principal" value={initiative.mainMetric} />
              <InfoCard label="Contribución" value={initiative.hypothesisCovered || 'Sin contribución visible'} />
              <InfoCard label="Avance de la iniciativa" value={`${initiative.stepsTimeline.filter(item => item.state === 'completado').length}/5 pasos completados`} />
              <InfoCard label="Última actualización" value={initiative.lastActivity} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>LÍNEA DE AVANCE</p>
            <h3 className="mt-2 text-lg text-slate-950" style={{ fontWeight: 700 }}>Qué se logró y qué falta por step</h3>
            <div className="mt-4">
              <ExecutiveStepTimeline initiative={initiative} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>EVIDENCIA Y ENTREGABLES</p>
                <h3 className="mt-2 text-lg text-slate-950" style={{ fontWeight: 700 }}>Resumen útil para leer antes de decidir</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadText(`${initiative.id}-resumen-ejecutivo.txt`, `${initiative.name}\n\n${initiative.executiveSummary}\n\n${initiative.signalSummary}\n\n${initiative.nextActionRecommended}`)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  style={{ fontWeight: 600 }}
                >
                  <Download size={14} className="mr-2 inline-flex" />
                  Descargar resumen ejecutivo
                </button>
                <button
                  onClick={() => downloadText(`${initiative.id}-resumen-experimento.txt`, `${initiative.name}\n\n${initiative.experimentSummary}\n\nEntregables:\n${initiative.deliverables.map(item => `- ${item.title}: ${item.note}`).join('\n')}`)}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                  style={{ fontWeight: 600 }}
                >
                  <Download size={14} className="mr-2 inline-flex" />
                  Descargar resumen del experimento
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoCard label="Resumen del experimento" value={initiative.experimentSummary} />
              <InfoCard label="Señal principal" value={initiative.signalSummary} />
              <InfoCard label="Comentario IA resumido" value={initiative.aiCommentSummary} />
              <InfoCard label="Comentario mentor resumido" value={initiative.mentorCommentSummary} />
            </div>

            <div className="mt-5">
              <DeliverablesList initiative={initiative} />
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-[#faf8f2] p-4">
              <div className="flex items-center gap-2 text-slate-700">
                <FileText size={16} />
                <p className="text-sm" style={{ fontWeight: 700 }}>Ver entregables y comentarios</p>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Esta vista resume lo relevante para Portfolio Lead sin mandarte al workspace operativo del participante.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>LECTURA PARA DECISIÓN</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoCard label="Bloqueo principal" value={initiative.mainBlocker || 'Sin bloqueo visible'} />
              <InfoCard label="Siguiente paso sugerido" value={initiative.nextActionRecommended} />
            </div>
            <div className="mt-4">
              <DecisionRecommendationPanel
                recommendation={recommendation}
                reason={initiative.decisionRecommendationReason}
                evidence={`${initiative.signalSummary} ${initiative.aiCommentSummary}`}
              />
            </div>
            {onOpenExecutiveOutput ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={onOpenExecutiveOutput}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                  style={{ fontWeight: 600 }}
                >
                  {executiveOutputId ? 'Ver salida ejecutiva' : 'Preparar salida ejecutiva'}
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>ALERTAS Y ACCIONES</p>
            <h3 className="mt-2 text-lg text-slate-950" style={{ fontWeight: 700 }}>Qué hacer ahora</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoCard label="Estado de alerta" value={alertSummary?.label ?? 'Sin alertas activas'} />
              <InfoCard label="Qué está pasando" value={alertSummary?.whatHappens ?? initiative.mainAlert ?? 'La iniciativa avanza sin fricción visible.'} />
              <InfoCard label="Acción sugerida" value={alertSummary?.suggestedAction ?? initiative.nextActionRecommended} />
              <InfoCard label="Por qué importa" value={alertSummary?.whyItMatters ?? initiative.decisionRecommendationReason} />
              <InfoCard label="Riesgo si no se actúa" value={alertSummary?.risk ?? initiative.mainBlocker ?? 'La iniciativa puede perder tracción.'} />
              <InfoCard label="Responsable esperado" value={alertSummary?.expectedResponsible ?? initiative.teamOwner} />
            </div>
            {onPrimaryAlertAction && alertSummary ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={onPrimaryAlertAction}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                  style={{ fontWeight: 600 }}
                >
                  {alertSummary.ctaLabel}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
