import React, { useMemo, useState } from 'react';
import { Filter, FolderKanban, Search, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { InitiativeExecutiveDetailDrawer } from '../components/portfolio/InitiativeExecutiveDetailDrawer';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import {
  challengeExecutiveSummary,
  challengeStatusLabel,
  challengeTypeLabel,
  initiativeStatusLabel,
  portfolioDecisionLabel,
} from '../portfolio/portfolioLeadCopy';
import {
  PortfolioLeadBreadcrumbs,
  PortfolioLeadEmptyState,
} from '../components/portfolio/PortfolioLeadPageElements';
import type { ChallengeStatus } from '../../features/portfolio-lead';
import { getInitiativeStepProgress } from '../../features/portfolio-lead/domain/rules';

type InitiativeItem = ReturnType<typeof usePortfolioLead>['initiatives'][number];

type PortfolioActionType =
  | 'meeting_requested'
  | 'team_message_sent'
  | 'sponsor_escalated'
  | 'area_support_requested'
  | 'unblock_marked_resolved';

type SelectablePortfolioActionType = Exclude<PortfolioActionType, 'unblock_marked_resolved'>;

const actionLabels: Record<PortfolioActionType, string> = {
  meeting_requested: 'Reunión solicitada',
  team_message_sent: 'Mensaje enviado al equipo',
  sponsor_escalated: 'Escalamiento al sponsor',
  area_support_requested: 'Apoyo solicitado a un área',
  unblock_marked_resolved: 'Bloqueo marcado como resuelto',
};

function getActionLabel(type?: string) {
  if (!type) return 'Acción registrada';
  return actionLabels[type as PortfolioActionType] ?? 'Acción registrada';
}

type InfoCardProps = {
  label: string;
  value?: React.ReactNode;
  helper?: string;
};

function InfoCard({ label, value, helper }: InfoCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <div className="mt-2 text-base font-semibold text-slate-950">
        {value ?? 'No definido'}
      </div>
      {helper ? (
        <p className="mt-2 text-sm text-slate-500">{helper}</p>
      ) : null}
    </div>
  );
}

// El backend escribe `closed` (ADR-030); `cerrada` queda como deletreo legacy de lectura.
function isClosedInitiative(initiative: InitiativeItem): boolean {
  return initiative.status === 'closed' || initiative.status === 'cerrada';
}

// Avance = Steps completados de 5. "Step 4" en curso es 4/5 (80%); recién cuando el Step 4
// está confirmado (la iniciativa quedó presentada o lista para decisión) son 5/5. Antes una
// iniciativa con Step 4 terminado mostraba "5/5 · 90%" (2026-10-08). El criterio vive en
// getInitiativeStepProgress para que el reto y este listado no se contradigan (2026-10-10).
export function getInitiativeProgress(initiative: InitiativeItem): { completed: number; percent: number } {
  return getInitiativeStepProgress(initiative);
}

function InitiativeActionDrawer({
  initiative,
  frontName,
  challengeName,
  uiState,
  presetAction,
  onClose,
  onSubmit,
}: {
  initiative: InitiativeItem | null;
  frontName: string;
  challengeName: string;
  uiState: InitiativeUiState;
  presetAction?: PortfolioActionType;
  onClose: () => void;
  onSubmit: (result: { message: string; actionRecord: PortfolioActionRecord; nextStatus: InitiativeUiStatus; lastTeamMessage: string }) => void;
}) {
  const [selectedAction, setSelectedAction] = useState<SelectablePortfolioActionType>(
    presetAction && presetAction !== 'unblock_marked_resolved' ? presetAction : 'meeting_requested',
  );
  const [note, setNote] = useState('');
  const [participants, setParticipants] = useState('');
  const [dateTentative, setDateTentative] = useState('');
  const [motivo, setMotivo] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [areaResponsable, setAreaResponsable] = useState('TI');
  const [responsableSugerido, setResponsableSugerido] = useState(uiState.pendingResponsible);

  React.useEffect(() => {
    setSelectedAction(presetAction && presetAction !== 'unblock_marked_resolved' ? presetAction : 'meeting_requested');
  }, [presetAction]);

  const initiativeName = initiative?.name ?? 'Iniciativa sin nombre';
  const initiativeOwner = initiative?.teamOwner ?? uiState.pendingResponsible ?? 'Owner pendiente';
  const initiativeSponsor = (initiative as { sponsor?: string; sponsorTouchpoint?: string } | null)?.sponsor?.trim()
    || initiative?.sponsorTouchpoint?.trim()
    || 'Sponsor pendiente';
  const initiativeChallengeOwner = (initiative as { challengeOwner?: string } | null)?.challengeOwner?.trim()
    || uiState.pendingResponsible
    || 'Challenge owner pendiente';
  const initiativeBlocker = (initiative as { blocker?: string; mainBlocker?: string } | null)?.blocker?.trim()
    || initiative?.mainBlocker?.trim()
    || uiState.blockingReason
    || 'Bloqueo no definido';
  const initiativeMessage = (initiative as { teamMessage?: string; mainAlert?: string } | null)?.teamMessage?.trim()
    || initiative?.mainAlert?.trim()
    || uiState.lastTeamMessage
    || 'Sin mensaje reciente del equipo';
  const safeFrontName = frontName || 'Frente no definido';
  const safeChallengeName = challengeName || 'Reto no definido';
  const selectedActionLabel = getActionLabel(selectedAction);

  if (!initiative) return null;

  const actionMeta: Record<SelectablePortfolioActionType, { label: string; description: string; button: string }> = {
    meeting_requested: {
      label: 'Generar reunión',
      description: 'Agenda una reunión con el equipo y los responsables del desbloqueo.',
      button: 'Generar reunión',
    },
    team_message_sent: {
      label: 'Enviar mensaje al equipo',
      description: 'Responde al equipo y deja registrada la orientación.',
      button: 'Enviar mensaje',
    },
    sponsor_escalated: {
      label: 'Escalar al sponsor',
      description: 'Pide apoyo directo al sponsor para destrabar la decisión o recurso.',
      button: 'Escalar al sponsor',
    },
    area_support_requested: {
      label: 'Solicitar apoyo a un área',
      description: 'Registra una solicitud hacia TI, Legal, Operaciones u otra área.',
      button: 'Registrar solicitud',
    },
  };

  const actionDefaults: Record<SelectablePortfolioActionType, string> = {
    meeting_requested: `Hola equipo, agendemos una reunión para destrabar el bloqueo identificado en la iniciativa ${initiativeName}. El objetivo es definir responsable, siguiente paso y fecha de cierre del bloqueo.`,
    team_message_sent: `Gracias por levantar el bloqueo. Voy a apoyar coordinando con ${responsableSugerido || 'el responsable asignado'}. Por favor confirmen qué información necesitan para avanzar y cuál sería el impacto si no se destraba esta semana.`,
    sponsor_escalated: `La iniciativa ${initiativeName} está bloqueada por ${initiativeBlocker}. Se requiere apoyo del sponsor para destrabar la coordinación con ${responsableSugerido || 'el área responsable'} y evitar pérdida de tracción.`,
    area_support_requested: `Se requiere apoyo de ${areaResponsable} para destrabar la iniciativa ${initiativeName}. El equipo necesita ${motivo || 'la validación pendiente'} para continuar con el step actual.`,
  };

  const actionParticipants = {
    meeting_requested: participants || [initiativeOwner, initiativeChallengeOwner, initiativeSponsor !== 'Sponsor pendiente' ? 'Sponsor' : null].filter(Boolean).join(', '),
    team_message_sent: participants || initiativeOwner,
    sponsor_escalated: participants || [initiativeOwner, 'Sponsor'].join(', '),
    area_support_requested: participants || areaResponsable,
  };

  const handleSubmit = () => {
    const labelByType = getActionLabel(selectedAction);
    const record: PortfolioActionRecord = {
      id: globalThis.crypto?.randomUUID?.() ?? `action-${Date.now()}`,
      initiativeId: initiative.id,
      challengeId: initiative.challengeId,
      frontId: initiative.strategicFrontId,
      type: selectedAction,
      label: labelByType,
      createdAt: 'Hoy',
      createdBy: 'Valeria Castro',
      message: note.trim() || actionDefaults[selectedAction],
      participants: actionParticipants[selectedAction].split(',').map(item => item.trim()).filter(Boolean),
      status: 'pending_response',
    };

    onSubmit({
      message: 'Acción registrada. La iniciativa pasó a desbloqueo en proceso.',
      actionRecord: record,
      nextStatus: 'unblock_in_progress',
      lastTeamMessage: note.trim() || actionDefaults[selectedAction],
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>GESTIONAR BLOQUEO</p>
              <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{initiativeName}</h2>
              <p className="mt-2 text-sm text-slate-600">Registra una acción para destrabar esta iniciativa y dar seguimiento al equipo.</p>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <section className="rounded-3xl border border-slate-200 bg-[#faf8f2] p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>RESUMEN DEL BLOQUEO</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <InfoCard label="Iniciativa" value={initiativeName} />
              <InfoCard label="Equipo / owner" value={initiativeOwner} />
              <InfoCard label="Reto asociado" value={safeChallengeName} />
              <InfoCard label="Frente estratégico" value={safeFrontName} />
              <InfoCard label="Bloqueo detectado" value={initiativeBlocker} />
              <InfoCard label="Responsable esperado" value={initiativeChallengeOwner} />
            </div>
            <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Último mensaje del equipo</p>
              <p className="mt-2 text-sm text-slate-700">{initiativeMessage}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>TIPO DE ACCIÓN</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Object.entries(actionMeta).map(([value, meta]) => {
                const isActive = selectedAction === value;
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedAction(value as SelectablePortfolioActionType)}
                    className={`rounded-3xl border p-4 text-left ${isActive ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}
                  >
                    <p className="text-sm text-slate-950" style={{ fontWeight: 700 }}>{meta.label}</p>
                    <p className="mt-2 text-sm text-slate-600">{meta.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            {selectedAction === 'meeting_requested' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Participantes sugeridos</span>
                  <input value={participants} onChange={event => setParticipants(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={`${initiativeOwner}, ${initiativeChallengeOwner}, Sponsor`} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Fecha tentativa</span>
                  <input value={dateTentative} onChange={event => setDateTentative(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder="Hoy, mañana o una fecha tentativa" />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Motivo de la reunión</span>
                  <input value={motivo} onChange={event => setMotivo(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder="Destrabar soporte, alinear siguiente paso, definir responsable" />
                </label>
              </div>
            ) : null}

            {selectedAction === 'team_message_sent' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Destinatarios</span>
                  <input value={destinatario} onChange={event => setDestinatario(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={initiativeOwner} />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Mensaje sugerido editable</span>
                  <textarea value={note} onChange={event => setNote(event.target.value)} rows={5} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={actionDefaults.team_message_sent} />
                </label>
              </div>
            ) : null}

            {selectedAction === 'sponsor_escalated' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Sponsor actual</span>
                  <input value={destinatario} onChange={event => setDestinatario(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder="Roberto Jiménez" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Motivo de escalamiento</span>
                  <input value={motivo} onChange={event => setMotivo(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={initiativeBlocker} />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Mensaje editable</span>
                  <textarea value={note} onChange={event => setNote(event.target.value)} rows={5} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={actionDefaults.sponsor_escalated} />
                </label>
              </div>
            ) : null}

            {selectedAction === 'area_support_requested' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Área responsable</span>
                  <input value={areaResponsable} onChange={event => setAreaResponsable(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder="TI, Legal, Operaciones" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Responsable sugerido</span>
                  <input value={responsableSugerido} onChange={event => setResponsableSugerido(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={initiativeChallengeOwner} />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Solicitud editable</span>
                  <textarea value={note} onChange={event => setNote(event.target.value)} rows={5} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900" placeholder={actionDefaults.area_support_requested} />
                </label>
              </div>
            ) : null}

          </section>

          <div className="flex flex-wrap gap-2">
            <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={handleSubmit} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
              {selectedActionLabel}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            La acción se registra en la UI como seguimiento ejecutivo. El estado pasa a desbloqueo en proceso hasta que luego se confirme la resolución.
          </p>
        </div>
      </div>
    </div>
  );
}

function InitiativeFollowUpDrawer({
  initiative,
  frontName,
  challengeName,
  uiState,
  onClose,
  onRegisterAction,
  onResolve,
}: {
  initiative: InitiativeItem | null;
  frontName: string;
  challengeName: string;
  uiState: InitiativeUiState;
  onClose: () => void;
  onRegisterAction: () => void;
  onResolve: () => void;
}) {
  if (!initiative) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>SEGUIMIENTO DEL DESBLOQUEO</p>
              <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{initiative.name}</h2>
              <p className="mt-2 text-sm text-slate-600">Revisa la acción registrada y confirma si el bloqueo ya puede marcarse como resuelto.</p>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <section className="rounded-3xl border border-slate-200 bg-[#faf8f2] p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoCard label="Última acción registrada" value={uiState.lastAction?.label ?? 'Sin acción registrada'} />
              <InfoCard label="Responsable pendiente" value={uiState.pendingResponsible} />
              <InfoCard label="Mensaje enviado" value={uiState.lastAction?.message ?? uiState.lastTeamMessage} />
              <InfoCard label="Estado actual" value="Desbloqueo en proceso" />
              <InfoCard label="Fecha de registro" value={uiState.lastAction?.createdAt ?? 'Hoy'} />
              <InfoCard label="Próxima acción sugerida" value="Esperar respuesta o registrar nueva acción si no avanza." />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>PARTICIPANTES</p>
            <p className="mt-2 text-sm text-slate-700">{uiState.lastAction?.participants.join(', ') || 'Portfolio Lead, sponsor, challenge owner y área responsable si aplica.'}</p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>SEGUIMIENTO DEL DESBLOQUEO</p>
            <p className="mt-2 text-sm text-slate-700">
              {uiState.actions.length > 0
                ? `${uiState.actions[0].label} · esperando respuesta de ${uiState.pendingResponsible}.`
                : 'Sin acciones adicionales registradas todavía.'}
            </p>
            <div className="mt-4 space-y-3">
              {uiState.actions.slice(0, 3).map(action => (
                <div key={action.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{action.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{action.createdAt} · {action.createdBy}</p>
                  <p className="mt-2 text-sm text-slate-600">{action.message}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button onClick={onRegisterAction} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
              Registrar nueva acción
            </button>
            <button onClick={onResolve} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" style={{ fontWeight: 600 }}>
              Marcar bloqueo como resuelto
            </button>
            <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitiativeAttentionState(initiative: InitiativeItem, alerts: string[]) {
  if (initiative.status === 'bloqueada' || alerts.some(item => item.includes('Bloqueo'))) return 'Tiene bloqueos';
  if (initiative.status === 'lista_para_decision' || initiative.readyForDecision) return 'Lista para decisión';
  if (isClosedInitiative(initiative)) return 'Cerrada';
  if (alerts.length > 0 || initiative.mainAlert.trim()) return 'Requiere atención';
  return 'Seguimiento normal';
}

function getAttentionTone(state: string) {
  if (state === 'Tiene bloqueos') return 'rose';
  if (state === 'Lista para decisión') return 'violet';
  if (state === 'Requiere atención') return 'amber';
  if (state === 'Cerrada') return 'slate';
  return 'emerald';
}

function buildInitiativeAlerts(
  initiative: InitiativeItem,
  overlaps: ReturnType<typeof usePortfolioLead>['initiativeOverlaps'],
) {
  const alerts: string[] = [];
  if (initiative.status === 'bloqueada') alerts.push('Bloqueo activo');
  if (initiative.blockedDays >= 14) alerts.push('Demora alta');
  if (!initiative.mentor.trim()) alerts.push('Sin mentor');
  if (initiative.requiresSponsor && !initiative.sponsorTouchpoint.trim()) alerts.push('Requiere sponsor touchpoint');
  if (initiative.deliverables.length === 0) alerts.push('Sin evidencia suficiente');
  if (initiative.readyForDecision) alerts.push('Lista para decisión');
  if (initiative.mainAlert.trim()) alerts.push(initiative.mainAlert);
  if (overlaps.some(item => item.initiativeAId === initiative.id || item.initiativeBId === initiative.id)) alerts.push('Posible solapamiento');
  return alerts;
}

type InitiativeActionFilter =
  | 'all'
  | 'requires_action'
  | 'blocked'
  | 'no_response'
  | 'delay_high'
  | 'incomplete_info'
  | 'decision_ready'
  | 'normal'
  | 'closed';

type InitiativeAlertKind =
  | 'blocker'
  | 'sponsor_no_response'
  | 'owner_no_response'
  | 'delay_high'
  | 'vague_information'
  | 'decision_ready'
  | 'no_alert';

type InitiativeActionKind =
  | 'resolver_bloqueo'
  | 'generar_reunion'
  | 'enviar_mensaje'
  | 'escalar_sponsor'
  | 'solicitar_respuesta'
  | 'pedir_actualizacion'
  | 'solicitar_claridad';

type InitiativeUiStatus = 'blocked' | 'unblock_in_progress' | 'unblock_resolved' | 'active' | 'decision_ready' | 'closed';

type PortfolioActionRecord = {
  id: string;
  initiativeId: string;
  challengeId: string;
  frontId: string;
  type: PortfolioActionType;
  label: string;
  createdAt: string;
  createdBy: string;
  message: string;
  participants: string[];
  status: 'pending_response' | 'sent' | 'resolved';
};

type InitiativeUiState = {
  status: InitiativeUiStatus;
  blockingReason: string;
  pendingResponsible: string;
  lastTeamMessage: string;
  lastAction?: PortfolioActionRecord | null;
  actions: PortfolioActionRecord[];
};

type ActiveInitiativeModal =
  | {
      initiativeId: string;
      mode: 'manage_block';
      preset?: PortfolioActionType;
    }
  | {
      initiativeId: string;
      mode: 'followup';
    }
  | null;

type InitiativeAttentionModel = {
  kind: InitiativeAlertKind;
  filter: InitiativeActionFilter;
  score: number;
  label: string;
  whatHappens: string;
  whyItMatters: string;
  suggestedAction: string;
  expectedResponsible: string;
  ctaLabel: string;
  tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'violet';
  actionKind: InitiativeActionKind | 'none';
};

function buildInitialInitiativeUiState(
  initiative: InitiativeItem,
  challenge: ReturnType<typeof usePortfolioLead>['challenges'][number] | null,
): InitiativeUiState {
  const blocked = initiative.status === 'bloqueada' || initiative.blockedDays >= 14;
  const decisionReady = !isClosedInitiative(initiative)
    && (initiative.readyForDecision || initiative.currentStep === 'Step 4' || initiative.status === 'lista_para_decision');
  return {
    status: blocked
      ? 'blocked'
      : decisionReady
        ? 'decision_ready'
        : isClosedInitiative(initiative)
          ? 'closed'
          : 'active',
    blockingReason: initiative.mainBlocker || initiative.mainAlert || 'Sin bloqueo visible',
    pendingResponsible: challenge?.challengeOwnerStatus === 'confirmado'
      ? challenge.challengeOwnerName || initiative.teamOwner
      : initiative.teamOwner,
    lastTeamMessage: initiative.mainAlert || initiative.signalSummary || 'Sin mensaje reciente.',
    lastAction: null,
    actions: [],
  };
}

type InitiativeRow = {
  initiative: InitiativeItem;
  challenge: ReturnType<typeof usePortfolioLead>['challenges'][number] | null;
  front: ReturnType<typeof usePortfolioLead>['strategicFronts'][number] | null;
  alerts: string[];
  attention: InitiativeAttentionModel;
  progress: number;
  progressLabel: string;
  commentsCount: number;
  evidenceCount: number;
  teamLabel: string;
  ownerLabel: string;
  mentorLabel: string;
  metricName: string;
  baseline: string;
  currentValue: string;
  targetValue: string;
  horizon: string;
  decisionLabel: string | null;
  nextAction: string;
  canDecision: boolean;
  canReport: boolean;
};

const ACTION_FILTER_OPTIONS: Array<{ value: InitiativeActionFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'requires_action', label: 'Requieren acción' },
  { value: 'blocked', label: 'Bloqueadas' },
  { value: 'no_response', label: 'Sin respuesta' },
  { value: 'delay_high', label: 'Demora alta' },
  { value: 'incomplete_info', label: 'Información incompleta' },
  { value: 'decision_ready', label: 'Listas para decisión' },
  { value: 'normal', label: 'En curso normal' },
  { value: 'closed', label: 'Cerradas' },
];

function getActionFilterLabel(value: InitiativeActionFilter) {
  return ACTION_FILTER_OPTIONS.find(item => item.value === value)?.label ?? 'Todas';
}

const DECISION_READY_ATTENTION: InitiativeAttentionModel = {
  kind: 'decision_ready',
  filter: 'decision_ready',
  score: 60,
  label: 'Lista para decisión',
  whatHappens: 'La iniciativa ya tiene señal suficiente para una revisión ejecutiva.',
  whyItMatters: 'La evidencia ya puede convertirse en una decisión, un reporte o un siguiente paso claro.',
  suggestedAction: 'Generar reporte y llevarla a decisión con el contexto del reto y el frente.',
  expectedResponsible: 'Portfolio Lead',
  ctaLabel: 'Generar reporte',
  tone: 'violet',
  actionKind: 'none',
};

export function getInitiativeAttentionModel(
  initiative: InitiativeItem,
  challenge: ReturnType<typeof usePortfolioLead>['challenges'][number] | null,
  uiState: InitiativeUiState | null = null,
): InitiativeAttentionModel {
  // Decidida: el backend la cierra al registrar la decisión. Sale de cualquier alerta.
  if (isClosedInitiative(initiative)) {
    return {
      kind: 'no_alert',
      filter: 'closed',
      score: 10,
      label: 'Cerrada',
      whatHappens: 'La iniciativa ya terminó su ciclo visible.',
      whyItMatters: 'Sirve como referencia para reporte y lectura de cierre.',
      suggestedAction: 'Revisar el resumen y usarla como evidencia para reporte.',
      expectedResponsible: 'Portfolio Lead',
      ctaLabel: 'Ver detalle',
      tone: 'slate',
      actionKind: 'none',
    };
  }

  if (uiState?.status === 'unblock_in_progress') {
    const lastAction = uiState.lastAction;
    return {
      kind: 'blocker',
      filter: 'blocked',
      score: 95,
      label: 'Desbloqueo en proceso',
      whatHappens: lastAction ? `${lastAction.label} · esperando respuesta.` : 'Portfolio Lead registró una acción para destrabar esta iniciativa.',
      whyItMatters: 'Ya existe una intervención, pero todavía no se confirma la resolución del bloqueo.',
      suggestedAction: 'Esperar respuesta del responsable o registrar una nueva acción si no avanza.',
      expectedResponsible: uiState.pendingResponsible || challenge?.challengeOwnerName || initiative.teamOwner,
      ctaLabel: 'Ver seguimiento',
      tone: 'amber',
      actionKind: 'none',
    };
  }

  if (uiState?.status === 'unblock_resolved') {
    return {
      kind: 'no_alert',
      filter: 'normal',
      score: 20,
      label: 'Bloqueo resuelto',
      whatHappens: 'El bloqueo fue marcado como resuelto y la iniciativa puede continuar seguimiento.',
      whyItMatters: 'La iniciativa vuelve a avanzar con tracción visible.',
      suggestedAction: 'Mantener seguimiento del avance y abrir detalle si cambia el contexto.',
      expectedResponsible: uiState.pendingResponsible || challenge?.challengeOwnerName || initiative.teamOwner,
      ctaLabel: 'Ver detalle',
      tone: 'emerald',
      actionKind: 'none',
    };
  }

  if (uiState?.status === 'decision_ready') {
    return DECISION_READY_ATTENTION;
  }

  const sponsorPending = !challenge || challenge.sponsorStatus !== 'confirmado' || !initiative.sponsorTouchpoint.trim();
  const ownerPending = !challenge || challenge.challengeOwnerStatus !== 'confirmado' || !initiative.teamOwner.trim();
  const hasEvidenceGap = initiative.deliverables.length === 0 || initiative.partialSignal || !initiative.signalSummary.trim();
  const isDecisionReady = initiative.readyForDecision || initiative.status === 'lista_para_decision';
  // Step 4 en curso todavía no está presentado: cuenta como lista sólo si no hay otra alerta.
  const reachedStep4 = initiative.currentStep === 'Step 4';
  const hasDelay = initiative.blockedDays >= 14;
  const hasBlocker = initiative.status === 'bloqueada' || /bloque|fricci|tecnic|integraci|soporte/i.test(initiative.mainBlocker || initiative.mainAlert);

  if (hasBlocker) {
    return {
      kind: 'blocker',
      filter: 'blocked',
      score: 100,
      label: 'Bloqueo activo',
      whatHappens: initiative.mainBlocker || initiative.mainAlert || 'La iniciativa tiene una fricción visible.',
      whyItMatters: 'La iniciativa no puede seguir avanzando sin destrabe.',
      suggestedAction: 'Escalar soporte con el sponsor o reasignar el responsable de integración.',
      expectedResponsible: 'Sponsor / TI / Challenge owner',
      ctaLabel: 'Resolver bloqueo',
      tone: 'rose',
      actionKind: 'resolver_bloqueo',
    };
  }

  // Lista para decisión confirmada por backend gana a las alertas de sponsor y owner: quien
  // decide es el Portfolio Lead, y marcarla "Sin respuesta" la sacaba de "Listas para decisión".
  if (isDecisionReady) {
    return DECISION_READY_ATTENTION;
  }

  if (sponsorPending) {
    return {
      kind: 'sponsor_no_response',
      filter: 'no_response',
      score: 90,
      label: 'Sponsor sin respuesta',
      whatHappens: initiative.sponsorTouchpoint.trim()
        ? 'El sponsor todavía no confirma el siguiente paso.'
        : 'El equipo aún no recibe validación visible del sponsor.',
      whyItMatters: 'Sin respuesta del sponsor, la iniciativa pierde tracción y respaldo ejecutivo.',
      suggestedAction: 'Registrar escalamiento y dejar un mensaje claro para obtener respuesta.',
      expectedResponsible: 'Sponsor',
      ctaLabel: 'Escalar a sponsor',
      tone: 'rose',
      actionKind: 'escalar_sponsor',
    };
  }

  if (ownerPending) {
    return {
      kind: 'owner_no_response',
      filter: 'no_response',
      score: 85,
      label: 'Challenge owner sin respuesta',
      whatHappens: 'El reto o la iniciativa todavía necesita una respuesta clara del challenge owner.',
      whyItMatters: 'Sin quien responda por la definición del reto, el equipo no puede seguir con claridad.',
      suggestedAction: 'Solicitar respuesta y confirmar el responsable que debe destrabar el avance.',
      expectedResponsible: 'Challenge owner',
      ctaLabel: 'Solicitar respuesta',
      tone: 'amber',
      actionKind: 'solicitar_respuesta',
    };
  }

  if (hasDelay) {
    return {
      kind: 'delay_high',
      filter: 'delay_high',
      score: 80,
      label: 'Demora alta',
      whatHappens: `La iniciativa lleva ${initiative.blockedDays} días con avance más lento del esperado.`,
      whyItMatters: 'La demora puede quitar ritmo al equipo y atrasar la lectura ejecutiva.',
      suggestedAction: 'Pedir una actualización y confirmar el siguiente hito con fecha concreta.',
      expectedResponsible: initiative.teamOwner || 'Equipo responsable',
      ctaLabel: 'Pedir actualización',
      tone: 'amber',
      actionKind: 'pedir_actualizacion',
    };
  }

  if (hasEvidenceGap) {
    return {
      kind: 'vague_information',
      filter: 'incomplete_info',
      score: 70,
      label: 'Información incompleta',
      whatHappens: 'La evidencia todavía no permite leer con claridad si la iniciativa debe avanzar o corregirse.',
      whyItMatters: 'Sin información suficiente, el Portfolio Lead no puede decidir con confianza.',
      suggestedAction: 'Solicitar claridad y revisar qué evidencia falta antes de seguir.',
      expectedResponsible: initiative.teamOwner || 'Equipo responsable',
      ctaLabel: 'Solicitar claridad',
      tone: 'amber',
      actionKind: 'solicitar_claridad',
    };
  }

  if (reachedStep4) {
    return DECISION_READY_ATTENTION;
  }


  return {
    kind: 'no_alert',
    filter: 'normal',
    score: 30,
    label: 'Sin alertas activas',
    whatHappens: 'La iniciativa avanza dentro del tiempo esperado.',
    whyItMatters: 'Mantiene tracción sin necesitar intervención inmediata.',
    suggestedAction: 'Seguir monitoreando y abrir detalle solo si cambia el contexto.',
    expectedResponsible: initiative.teamOwner || 'Equipo responsable',
    ctaLabel: 'Ver detalle',
    tone: 'emerald',
    actionKind: 'none',
  };
}

function matchesActionFilter(model: InitiativeAttentionModel, filter: InitiativeActionFilter) {
  if (filter === 'all') return true;
  if (filter === 'requires_action') return ['blocked', 'no_response', 'delay_high', 'incomplete_info', 'decision_ready'].includes(model.filter);
  return model.filter === filter;
}

function StatusChip({ tone, children }: { tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'violet'; children: React.ReactNode }) {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${classes[tone]}`} style={{ fontWeight: 600 }}>
      {children}
    </span>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}

export function PortfolioLeadInitiativesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeModal, setActiveModal] = useState<ActiveInitiativeModal>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [initiativeUiState, setInitiativeUiState] = useState<Record<string, InitiativeUiState>>({});
  const {
    strategicFronts,
    challenges,
    initiatives,
    initiativeOverlaps,
    portfolioDecisions,
    executiveOutputs,
    createExecutiveOutput,
  } = usePortfolioLead();

  const challengeId = searchParams.get('challengeId') ?? '';
  const frontId = searchParams.get('frontId') ?? '';
  const initiativeId = searchParams.get('initiativeId') ?? '';
  const search = searchParams.get('search') ?? '';
  const ownerFilter = searchParams.get('owner') ?? 'all';
  const actionFilterParam = searchParams.get('action') ?? 'all';
  const actionFilter = ACTION_FILTER_OPTIONS.some(item => item.value === actionFilterParam)
    ? actionFilterParam as InitiativeActionFilter
    : 'all';

  const selectedInitiative = initiatives.find(item => item.id === initiativeId) ?? null;
  const selectedChallenge = challenges.find(item => item.id === challengeId)
    ?? (selectedInitiative ? challenges.find(item => item.id === selectedInitiative.challengeId) ?? null : null);
  const selectedFront = strategicFronts.find(item => item.id === frontId)
    ?? (selectedChallenge ? strategicFronts.find(item => item.id === selectedChallenge.strategicFrontId) ?? null : null)
    ?? (selectedInitiative ? strategicFronts.find(item => item.id === selectedInitiative.strategicFrontId) ?? null : null)
    ?? null;

  const uiStateById = useMemo(() => {
    const next: Record<string, InitiativeUiState> = { ...initiativeUiState };
    initiatives.forEach(item => {
      if (!next[item.id]) {
        next[item.id] = buildInitialInitiativeUiState(
          item,
          challenges.find(challenge => challenge.id === item.challengeId) ?? null,
        );
      }
    });
    return next;
  }, [challenges, initiativeUiState, initiatives]);

  const visibleChallenges = useMemo(() => {
    if (selectedFront) return challenges.filter(item => item.strategicFrontId === selectedFront.id);
    return challenges;
  }, [challenges, selectedFront]);

  const ownerOptions = useMemo(() => {
    const values = initiatives.flatMap(item => {
      const owners = [item.teamOwner, item.teamLabel, ...item.teamMembers].map(value => value.trim()).filter(Boolean);
      return owners;
    });
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [initiatives]);

  const scopedInitiativeRows = useMemo<InitiativeRow[]>(() => {
    const query = search.trim().toLowerCase();

    return initiatives
      .filter(item => (selectedChallenge ? item.challengeId === selectedChallenge.id : true))
      .filter(item => (selectedFront && !selectedChallenge ? item.strategicFrontId === selectedFront.id : true))
      .filter(item => (ownerFilter !== 'all' ? [item.teamOwner, item.teamLabel, ...item.teamMembers].some(value => value.trim() === ownerFilter) : true))
      .filter(item => {
        if (!query) return true;
        const challenge = challenges.find(ch => ch.id === item.challengeId);
        const front = strategicFronts.find(fr => fr.id === item.strategicFrontId);
        return [
          item.name,
          item.executiveSummary,
          item.teamOwner,
          item.teamLabel,
          item.mentor,
          item.mainMetric,
          challenge?.name ?? '',
          front?.name ?? '',
        ].join(' ').toLowerCase().includes(query);
      })
      .map(item => {
        const challenge = challenges.find(ch => ch.id === item.challengeId) ?? null;
        const front = strategicFronts.find(fr => fr.id === item.strategicFrontId) ?? null;
        const alerts = buildInitiativeAlerts(item, initiativeOverlaps);
        const attention = getInitiativeAttentionModel(item, challenge);
        const { completed: completedSteps, percent: progress } = getInitiativeProgress(item);
        const progressLabel = completedSteps === 5
          ? `Steps 0–4 completos · ${progress}%`
          : `En ${item.currentStep} · ${completedSteps}/5 Steps completos · ${progress}%`;
        const commentsCount = [item.aiCommentSummary, item.mentorCommentSummary, item.sponsorTouchpoint].filter(Boolean).length;
        const metricName = item.mainMetric || challenge?.successCriteria || 'Métrica no definida';
        const baseline = front?.baseline ?? 'Sin baseline visible';
        const currentValue = challenge?.currentMetricValue ?? 'Sin lectura visible';
        const targetValue = front?.target ?? 'Meta no definida';
        const horizon = challenge?.horizon ?? front?.horizon ?? 'Horizonte no definido';
        const evidenceCount = item.deliverables.length;
        const decision = portfolioDecisions.find(decisionItem => decisionItem.initiativeId === item.id) ?? null;
        const canDecision = item.readyForDecision || item.status === 'lista_para_decision';
        const canReport = isClosedInitiative(item) || item.currentStep === 'Step 4' || canDecision;
        const nextAction = challenge ? challengeExecutiveSummary(challenge, initiatives).nextAction : 'Mantener lectura ejecutiva del portafolio.';

        return {
          initiative: item,
          challenge,
          front,
          alerts,
          attention,
          progress,
          progressLabel,
          commentsCount,
          evidenceCount,
          teamLabel: item.teamMembers.length > 0 ? item.teamMembers.join(', ') : item.teamLabel || 'Sin equipo visible',
          ownerLabel: item.teamOwner,
          mentorLabel: item.mentor || 'Sin mentor asignado',
          metricName,
          baseline,
          currentValue,
          targetValue,
          horizon,
          decisionLabel: decision ? portfolioDecisionLabel(decision.recommendation) : null,
          nextAction,
          canDecision,
          canReport,
        };
      })
      .sort((a, b) => b.attention.score - a.attention.score || b.progress - a.progress || a.initiative.name.localeCompare(b.initiative.name));
  }, [
    challenges,
    initiatives,
    initiativeOverlaps,
    portfolioDecisions,
    ownerFilter,
    search,
    selectedChallenge,
    selectedFront,
    strategicFronts,
  ]);

  const visibleInitiatives = useMemo(
    () => scopedInitiativeRows.filter(row => matchesActionFilter(row.attention, actionFilter)),
    [actionFilter, scopedInitiativeRows],
  );

  const activeInitiative = visibleInitiatives.find(item => item.initiative.id === initiativeId)?.initiative
    ?? selectedInitiative
    ?? null;
  const activeInitiativeChallenge = activeInitiative
    ? challenges.find(item => item.id === activeInitiative.challengeId) ?? null
    : null;
  const activeInitiativeAttentionModel = activeInitiative
    ? getInitiativeAttentionModel(activeInitiative, activeInitiativeChallenge, uiStateById[activeInitiative.id] ?? null)
    : null;

  const contextSummary = useMemo(() => {
    const actionRequired = scopedInitiativeRows.filter(row => row.attention.filter !== 'normal' && row.attention.filter !== 'closed').length;
    const blocked = scopedInitiativeRows.filter(row => row.attention.filter === 'blocked').length;
    const noResponse = scopedInitiativeRows.filter(row => row.attention.filter === 'no_response').length;
    const ready = scopedInitiativeRows.filter(row => row.attention.filter === 'decision_ready').length;
    const normal = scopedInitiativeRows.filter(row => row.attention.filter === 'normal').length;
    return {
      actionRequired,
      blocked,
      noResponse,
      ready,
      normal,
    };
  }, [scopedInitiativeRows]);

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    navigate(`/portfolio/iniciativas?${next.toString()}`);
  };

  const clearFilters = () => navigate('/portfolio/iniciativas');

  const pageHasAnyData = initiatives.length > 0;
  const updateInitiativeState = (initiativeIdToUpdate: string, updater: (current: InitiativeUiState) => InitiativeUiState) => {
    setInitiativeUiState(prev => {
      const baseInitiative = initiatives.find(item => item.id === initiativeIdToUpdate);
      if (!baseInitiative) {
        return prev;
      }
      const current = prev[initiativeIdToUpdate] ?? buildInitialInitiativeUiState(
        baseInitiative,
        challenges.find(challenge => challenge.id === baseInitiative.challengeId) ?? null,
      );
      return {
        ...prev,
        [initiativeIdToUpdate]: updater(current),
      };
    });
  };

  function openInitiativeActionDrawer(
    initiativeIdToOpen: string,
    defaultAction: PortfolioActionType = 'meeting_requested',
  ) {
    setActiveModal({
      initiativeId: initiativeIdToOpen,
      mode: 'manage_block',
      preset: defaultAction,
    });
  }

  function getAttentionActionPreset(actionKind: InitiativeActionKind | 'none'): PortfolioActionType {
    switch (actionKind) {
      case 'resolver_bloqueo':
      case 'generar_reunion':
        return 'meeting_requested';
      case 'enviar_mensaje':
      case 'solicitar_respuesta':
        return 'team_message_sent';
      case 'escalar_sponsor':
        return 'sponsor_escalated';
      case 'pedir_actualizacion':
        return 'meeting_requested';
      case 'solicitar_claridad':
        return 'area_support_requested';
      default:
        return 'meeting_requested';
    }
  }

  const hasContextFilters = Boolean(frontId || challengeId || initiativeId || search.trim() || actionFilter !== 'all' || ownerFilter !== 'all');
  const contextLine = selectedChallenge
    ? `Mostrando iniciativas del frente ${selectedFront?.name ?? 'sin frente'} · Reto ${selectedChallenge.name}`
    : selectedFront
      ? `Mostrando iniciativas del frente ${selectedFront.name}`
      : hasContextFilters
        ? 'Mostrando iniciativas filtradas del portafolio.'
        : 'Mostrando todas las iniciativas del portafolio.';

  if (!pageHasAnyData) {
    return (
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Iniciativas' }]} />
        <PortfolioLeadEmptyState
          title="Aún no hay iniciativas asociadas al portafolio."
          description="Las iniciativas aparecerán aquí cuando un reto activo reciba propuestas o cuando vincules una iniciativa existente a un reto."
          primaryAction={{ label: 'Ir a Retos', onClick: () => navigate('/portfolio/retos') }}
          secondaryAction={{ label: 'Ir a Frentes estratégicos', onClick: () => navigate('/portfolio/frentes-estrategicos') }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Iniciativas' }]} />

      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f7f3e4_0%,#ffffff_55%,#eef3ea_100%)] p-6 md:p-8">
        <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>INICIATIVAS</p>
        <h1 className="mt-2 text-3xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          Iniciativas en seguimiento
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Detecta bloqueos, demoras y alertas de los equipos para intervenir antes de que una iniciativa pierda tracción.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{contextLine}</p>
          {hasContextFilters ? (
            <button
              onClick={clearFilters}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              style={{ fontWeight: 600 }}
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>

      {actionFeedback ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionFeedback}
        </div>
      ) : null}

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <FolderKanban size={16} className="text-slate-700" />
          <h2 className="text-lg text-slate-950" style={{ fontWeight: 700 }}>Prioridades de acción</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Iniciativas que necesitan intervención antes de las que avanzan sin alerta.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat label="Requieren acción" value={`${contextSummary.actionRequired}`} hint="Necesitan intervención" />
          <MiniStat label="Bloqueadas" value={`${contextSummary.blocked}`} hint="Sin avance posible" />
          <MiniStat label="Sin respuesta" value={`${contextSummary.noResponse}`} hint="Piden seguimiento" />
          <MiniStat label="Listas para decisión" value={`${contextSummary.ready}`} hint="Ya tienen evidencia" />
          <MiniStat label="En curso normal" value={`${contextSummary.normal}`} hint="Siguen avanzando" />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-700" />
          <h2 className="text-lg text-slate-950" style={{ fontWeight: 700 }}>Filtrar iniciativas</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Encuentra rápido iniciativas por urgencia, frente, reto o responsable.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {ACTION_FILTER_OPTIONS.map(option => {
            const active = option.value === actionFilter;
            return (
              <button
                key={option.value}
                onClick={() => updateQuery({ action: option.value === 'all' ? null : option.value, initiativeId: null })}
                className={`rounded-full border px-4 py-2 text-sm ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                style={{ fontWeight: 600 }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Buscar</span>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search size={16} className="text-slate-400" />
              <input
                value={search}
                onChange={event => updateQuery({ search: event.target.value || null })}
                placeholder="Buscar por iniciativa, reto, frente, owner o mentor"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Frente estratégico</span>
            <select
              value={frontId || 'all'}
              onChange={event => updateQuery({ frontId: event.target.value === 'all' ? null : event.target.value, challengeId: null, initiativeId: null })}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {strategicFronts.map(front => (
                <option key={front.id} value={front.id}>{front.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Reto</span>
            <select
              value={challengeId || 'all'}
              onChange={event => updateQuery({ challengeId: event.target.value === 'all' ? null : event.target.value, initiativeId: null })}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {visibleChallenges.map(challenge => (
                <option key={challenge.id} value={challenge.id}>{challenge.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Owner / responsable</span>
            <select
              value={ownerFilter}
              onChange={event => updateQuery({ owner: event.target.value === 'all' ? null : event.target.value, initiativeId: null })}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="all">Todos</option>
              {ownerOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              style={{ fontWeight: 600 }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>INICIATIVAS PRIORIZADAS</p>
            <h2 className="mt-1 text-xl text-slate-950" style={{ fontWeight: 700 }}>Listado operativo</h2>
            <p className="mt-2 text-sm text-slate-500">
              {actionFilter === 'blocked'
                ? 'Primero ves las iniciativas bloqueadas para actuar sobre ellas.'
                : actionFilter === 'no_response'
                  ? 'Primero ves las iniciativas que necesitan respuesta de sponsor o challenge owner.'
                  : actionFilter === 'decision_ready'
                    ? 'Primero ves las iniciativas listas para decisión ejecutiva.'
                    : 'Primero ves las iniciativas que requieren atención antes que las que ya avanzan sin alerta.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {visibleInitiatives.length} resultados
          </div>
        </div>

        {visibleInitiatives.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-[#faf8f2] px-6 py-10">
            <p className="text-lg text-slate-900" style={{ fontWeight: 700 }}>
              No hay iniciativas con estos filtros.
            </p>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Limpia el filtro para volver a ver todas las iniciativas o vuelve al reto/frente para leerlas con contexto.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={clearFilters} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
                Ver todas las iniciativas
              </button>
              <button onClick={() => navigate('/portfolio/retos')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
                Ir a Retos
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {visibleInitiatives.map(row => {
              const { initiative, challenge, front } = row;
              const uiState = uiStateById[initiative.id] ?? buildInitialInitiativeUiState(initiative, challenge);
              const displayAttention = getInitiativeAttentionModel(initiative, challenge, uiState);
              const mainActionLabel = displayAttention.label === 'Bloqueo activo'
                ? 'Resolver bloqueo'
                : displayAttention.label === 'Desbloqueo en proceso'
                  ? 'Ver seguimiento'
                  : displayAttention.ctaLabel;
              return (
                <InitiativeCard
                  key={initiative.id}
                  initiative={initiative}
                  frontName={front?.name ?? 'Frente no definido'}
                  challengeName={challenge?.name ?? 'Reto no definido'}
                  challengeType={challenge ? challengeTypeLabel(challenge.challengeType) : 'Sin clasificar'}
                  challengeStatus={challenge ? challengeStatusLabel(challenge.status as ChallengeStatus) : 'Estado no definido'}
                  progress={row.progress}
                  progressLabel={row.progressLabel}
                  attentionState={displayAttention.label}
                  attentionTone={displayAttention.tone}
                  alerts={row.alerts}
                  commentsCount={row.commentsCount}
                  evidenceCount={row.evidenceCount}
                  teamLabel={row.teamLabel}
                  ownerLabel={row.ownerLabel}
                  mentorLabel={row.mentorLabel}
                  metricName={row.metricName}
                  baseline={row.baseline}
                  currentValue={row.currentValue}
                  targetValue={row.targetValue}
                  horizon={row.horizon}
                  decisionLabel={row.decisionLabel}
                  nextAction={row.nextAction}
                  canDecision={row.canDecision}
                  canReport={row.canReport}
                  alertSummary={displayAttention}
                  initiativeUiState={uiState}
                  actionLabel={mainActionLabel}
                  onOpenAttentionAction={() => {
                    if (displayAttention.ctaLabel === 'Generar reporte') {
                      navigate(`/portfolio/reportes?initiativeId=${encodeURIComponent(initiative.id)}&challengeId=${encodeURIComponent(challenge?.id ?? initiative.challengeId)}&frontId=${encodeURIComponent(front?.id ?? initiative.strategicFrontId)}`);
                      return;
                    }

                    if (displayAttention.label === 'Desbloqueo en proceso') {
                      setActiveModal({ initiativeId: initiative.id, mode: 'followup' });
                      return;
                    }

                    if (displayAttention.actionKind === 'none') {
                      updateQuery({
                        challengeId: challenge?.id ?? null,
                        frontId: front?.id ?? null,
                        initiativeId: initiative.id,
                      });
                      return;
                    }

                    openInitiativeActionDrawer(initiative.id, getAttentionActionPreset(displayAttention.actionKind));
                  }}
                  onOpenMeetingAction={() => openInitiativeActionDrawer(initiative.id, 'meeting_requested')}
                  onOpenReplyMessageAction={() => openInitiativeActionDrawer(initiative.id, 'team_message_sent')}
                  onOpenFollowUpAction={() => setActiveModal({ initiativeId: initiative.id, mode: 'followup' })}
                  onOpenDetail={() => updateQuery({
                    challengeId: challenge?.id ?? null,
                    frontId: front?.id ?? null,
                    initiativeId: initiative.id,
                  })}
                  onOpenDecision={row.canDecision ? () => navigate(`/portfolio/decisiones?initiativeId=${encodeURIComponent(initiative.id)}&challengeId=${encodeURIComponent(challenge?.id ?? initiative.challengeId)}&frontId=${encodeURIComponent(front?.id ?? initiative.strategicFrontId)}`) : null}
                  onOpenReport={row.canReport ? () => navigate(`/portfolio/reportes?initiativeId=${encodeURIComponent(initiative.id)}&challengeId=${encodeURIComponent(challenge?.id ?? initiative.challengeId)}&frontId=${encodeURIComponent(front?.id ?? initiative.strategicFrontId)}`) : null}
                  onOpenCore={initiative.projectId ? () => navigate(`/initiatives/${encodeURIComponent(initiative.projectId!)}/overview`) : null}
                  onOpenInitiative={initiative.projectId
                    ? () => navigate(`/projects/${encodeURIComponent(initiative.projectId!)}/step/${initiative.currentStep.match(/\d/)?.[0] ?? '0'}`)
                    : null}
                />
              );
            })}
          </div>
        )}
      </section>

      {activeInitiative ? (
        <InitiativeExecutiveDetailDrawer
          initiative={activeInitiative}
          frontName={strategicFronts.find(item => item.id === activeInitiative.strategicFrontId)?.name ?? 'Frente no definido'}
          challengeName={challenges.find(item => item.id === activeInitiative.challengeId)?.name ?? 'Reto no definido'}
          recommendation={portfolioDecisions.find(item => item.initiativeId === activeInitiative.id)?.recommendation ?? 'iterar_desde_otro_angulo'}
          executiveOutputId={executiveOutputs.find(item => item.initiativeId === activeInitiative.id)?.id ?? null}
          alertSummary={activeInitiativeAttentionModel ? {
            label: activeInitiativeAttentionModel.label,
            whatHappens: activeInitiativeAttentionModel.whatHappens,
            whyItMatters: activeInitiativeAttentionModel.whyItMatters,
            suggestedAction: activeInitiativeAttentionModel.suggestedAction,
            expectedResponsible: activeInitiativeAttentionModel.expectedResponsible,
            ctaLabel: activeInitiativeAttentionModel.ctaLabel,
            risk: activeInitiative.mainBlocker || activeInitiative.mainAlert || activeInitiative.nextActionRecommended,
          } : undefined}
          onPrimaryAlertAction={
            activeInitiativeAttentionModel?.ctaLabel === 'Generar reporte'
              ? () => navigate(`/portfolio/reportes?initiativeId=${encodeURIComponent(activeInitiative.id)}&challengeId=${encodeURIComponent(activeInitiative.challengeId)}&frontId=${encodeURIComponent(activeInitiative.strategicFrontId)}`)
              : activeInitiativeAttentionModel?.actionKind && activeInitiativeAttentionModel.actionKind !== 'none'
                ? () => openInitiativeActionDrawer(activeInitiative.id, getAttentionActionPreset(activeInitiativeAttentionModel.actionKind))
                : undefined
          }
          onOpenExecutiveOutput={() => {
            const existingOutput = executiveOutputs.find(item => item.initiativeId === activeInitiative.id);
            const output = existingOutput ?? createExecutiveOutput(
              activeInitiative.id,
              portfolioDecisions.find(item => item.initiativeId === activeInitiative.id)?.recommendation ?? 'iterar_desde_otro_angulo',
            );
            if (!output) return;
            navigate(`/portfolio/salida-ejecutiva?outputId=${encodeURIComponent(output.id)}`);
          }}
          onClose={() => updateQuery({ initiativeId: null })}
        />
      ) : null}

      {activeModal && activeModal.mode === 'manage_block' ? (
        <InitiativeActionDrawer
          initiative={initiatives.find(item => item.id === activeModal.initiativeId) ?? null}
          frontName={strategicFronts.find(item => item.id === (initiatives.find(item => item.id === activeModal.initiativeId)?.strategicFrontId ?? ''))?.name ?? 'Frente no definido'}
          challengeName={challenges.find(item => item.id === (initiatives.find(item => item.id === activeModal.initiativeId)?.challengeId ?? ''))?.name ?? 'Reto no definido'}
          uiState={uiStateById[activeModal.initiativeId] ?? buildInitialInitiativeUiState(initiatives.find(item => item.id === activeModal.initiativeId) ?? initiatives[0], challenges.find(item => item.id === (initiatives.find(item => item.id === activeModal.initiativeId)?.challengeId ?? '')) ?? null)}
          presetAction={activeModal.preset}
          onClose={() => setActiveModal(null)}
          onSubmit={({ message, actionRecord, nextStatus, lastTeamMessage }) => {
            setActionFeedback(message);
            updateInitiativeState(actionRecord.initiativeId, current => ({
              ...current,
              status: nextStatus,
              lastAction: actionRecord,
              lastTeamMessage,
              actions: [actionRecord, ...current.actions].slice(0, 8),
            }));
            setActiveModal(null);
          }}
        />
      ) : null}

      {activeModal && activeModal.mode === 'followup' ? (
        <InitiativeFollowUpDrawer
          initiative={initiatives.find(item => item.id === activeModal.initiativeId) ?? null}
          frontName={strategicFronts.find(item => item.id === (initiatives.find(item => item.id === activeModal.initiativeId)?.strategicFrontId ?? ''))?.name ?? 'Frente no definido'}
          challengeName={challenges.find(item => item.id === (initiatives.find(item => item.id === activeModal.initiativeId)?.challengeId ?? ''))?.name ?? 'Reto no definido'}
          uiState={uiStateById[activeModal.initiativeId] ?? buildInitialInitiativeUiState(initiatives.find(item => item.id === activeModal.initiativeId) ?? initiatives[0], challenges.find(item => item.id === (initiatives.find(item => item.id === activeModal.initiativeId)?.challengeId ?? '')) ?? null)}
          onClose={() => setActiveModal(null)}
          onRegisterAction={() => setActiveModal({ initiativeId: activeModal.initiativeId, mode: 'manage_block', preset: 'meeting_requested' })}
          onResolve={() => {
            const currentInitiative = initiatives.find(item => item.id === activeModal.initiativeId) ?? null;
            const resolvedRecord: PortfolioActionRecord = {
              id: `action-${Date.now()}`,
              initiativeId: activeModal.initiativeId,
              challengeId: currentInitiative?.challengeId ?? '',
              frontId: currentInitiative?.strategicFrontId ?? '',
              type: 'unblock_marked_resolved',
              label: 'Bloqueo marcado como resuelto',
              createdAt: 'Hoy',
              createdBy: 'Valeria Castro',
              message: 'El bloqueo fue marcado como resuelto desde seguimiento.',
              participants: ['Portfolio Lead'],
              status: 'resolved',
            };
            updateInitiativeState(activeModal.initiativeId, current => ({
              ...current,
              status: 'unblock_resolved',
              lastAction: resolvedRecord,
              actions: [resolvedRecord, ...current.actions].slice(0, 8),
            }));
            setActionFeedback('Bloqueo marcado como resuelto.');
            setActiveModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function InitiativeCard({
  initiative,
  frontName,
  challengeName,
  challengeType,
  challengeStatus,
  progress,
  progressLabel,
  attentionState,
  attentionTone,
  alerts,
  commentsCount,
  evidenceCount,
  teamLabel,
  ownerLabel,
  mentorLabel,
  metricName,
  baseline,
  currentValue,
  targetValue,
  horizon,
  decisionLabel,
  nextAction,
  canDecision,
  canReport,
  alertSummary,
  initiativeUiState,
  actionLabel,
  onOpenDetail,
  onOpenAttentionAction,
  onOpenMeetingAction,
  onOpenReplyMessageAction,
  onOpenFollowUpAction,
  onOpenDecision,
  onOpenReport,
  onOpenCore,
  onOpenInitiative,
}: {
  initiative: InitiativeItem;
  frontName: string;
  challengeName: string;
  challengeType: string;
  challengeStatus: string;
  progress: number;
  progressLabel: string;
  attentionState: string;
  attentionTone: 'slate' | 'emerald' | 'amber' | 'rose' | 'violet';
  alerts: string[];
  commentsCount: number;
  evidenceCount: number;
  teamLabel: string;
  ownerLabel: string;
  mentorLabel: string;
  metricName: string;
  baseline: string;
  currentValue: string;
  targetValue: string;
  horizon: string;
  decisionLabel: string | null;
  nextAction: string;
  canDecision: boolean;
  canReport: boolean;
  alertSummary: InitiativeAttentionModel;
  initiativeUiState: InitiativeUiState;
  actionLabel: string;
  onOpenDetail: () => void;
  onOpenAttentionAction: () => void;
  onOpenMeetingAction: () => void;
  onOpenReplyMessageAction: () => void;
  onOpenFollowUpAction: () => void;
  onOpenDecision: (() => void) | null;
  onOpenReport: (() => void) | null;
  onOpenCore: (() => void) | null;
  onOpenInitiative: (() => void) | null;
}) {
  const toneClasses: Record<'slate' | 'emerald' | 'amber' | 'rose' | 'violet', string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };

  const alertTone = (alert: string): 'slate' | 'emerald' | 'amber' | 'rose' | 'violet' => {
    if (alert === 'Bloqueo activo' || alert === 'Sin mentor' || alert === 'Demora alta') return 'rose';
    if (alert === 'Lista para decisión' || alert === 'Requiere sponsor touchpoint') return 'violet';
    if (alert === 'Sin evidencia suficiente') return 'amber';
    return 'slate';
  };

  const alertChips = alerts.length > 0 ? alerts : ['Sin alertas activas'];
  const ownerLine = `Owner: ${ownerLabel} · Sponsor: ${initiative.sponsorTouchpoint?.trim() ? initiative.sponsorTouchpoint : 'Sponsor pendiente'} · Challenge owner: ${initiative.teamOwner}`;
  const contextChips = [
    `Frente: ${frontName}`,
    `Reto: ${challengeName}`,
    initiative.currentStep,
    `Tipo: ${challengeType}`,
  ];

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={alertSummary.tone}>{alertSummary.label}</StatusChip>
            <StatusChip tone="slate">{initiativeStatusLabel(initiative.status)}</StatusChip>
          </div>
          <h3 className="mt-3 text-lg text-slate-950" style={{ fontWeight: 700 }}>{initiative.name}</h3>
          <p className="mt-2 text-sm text-slate-600">{initiative.executiveSummary.split('. ')[0] || initiative.executiveSummary}</p>
          <p className="mt-3 text-sm text-slate-500">{ownerLine}</p>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500">Actualización</p>
          <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{initiative.lastActivity}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {contextChips.map(chip => (
          <StatusChip key={chip} tone="slate">
            {chip}
          </StatusChip>
        ))}
      </div>

      {initiativeUiState.status === 'blocked' ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs text-rose-700" style={{ fontWeight: 700 }}>Mensaje reciente del equipo</p>
          <p className="mt-2 text-sm text-rose-800">{initiativeUiState.lastTeamMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onOpenMeetingAction} className="rounded-2xl bg-rose-600 px-3 py-2 text-xs text-white" style={{ fontWeight: 600 }}>
              Generar reunión
            </button>
            <button onClick={onOpenReplyMessageAction} className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs text-rose-700" style={{ fontWeight: 600 }}>
              Responder mensaje
            </button>
          </div>
        </div>
      ) : null}

      {initiativeUiState.status === 'unblock_in_progress' ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-700" style={{ fontWeight: 700 }}>Seguimiento del desbloqueo</p>
          <p className="mt-2 text-sm text-amber-800">
            {initiativeUiState.lastAction?.label ?? 'Acción registrada'} · esperando respuesta de {initiativeUiState.pendingResponsible}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onOpenFollowUpAction} className="rounded-2xl bg-amber-500 px-3 py-2 text-xs text-white" style={{ fontWeight: 600 }}>
              Ver seguimiento
            </button>
            <button onClick={onOpenMeetingAction} className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-700" style={{ fontWeight: 600 }}>
              Registrar nueva acción
            </button>
          </div>
        </div>
      ) : null}

      {initiativeUiState.status === 'unblock_resolved' ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700" style={{ fontWeight: 700 }}>Estado actualizado</p>
          <p className="mt-2 text-sm text-emerald-800">El bloqueo fue marcado como resuelto. La iniciativa puede continuar seguimiento.</p>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Avance operativo</p>
            <p className="mt-1 text-sm text-slate-900" style={{ fontWeight: 700 }}>{progressLabel}</p>
          </div>
          <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{progress}%</p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-slate-900" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-600">{metricName} · Baseline {baseline} · Actual {currentValue} · Meta {targetValue} · {horizon}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={onOpenDetail} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
          Ver detalle
        </button>
        {attentionState === 'Tiene bloqueos' ? (
          <button onClick={onOpenAttentionAction} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
            {actionLabel}
          </button>
        ) : attentionState === 'Lista para decisión' ? (
          <button onClick={onOpenAttentionAction} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
            {actionLabel}
          </button>
        ) : attentionState === 'Requiere atención' ? (
          <button onClick={onOpenAttentionAction} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
            {actionLabel}
          </button>
        ) : (
          <button onClick={onOpenAttentionAction} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
            {actionLabel}
          </button>
        )}
        {onOpenDecision ? (
          <button onClick={onOpenDecision} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
            Revisar decisión
          </button>
        ) : null}
        {/* Si la acción principal ya es "Generar reporte", no se repite el botón. */}
        {onOpenReport && actionLabel !== 'Generar reporte' ? (
          <button onClick={onOpenReport} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
            Generar reporte
          </button>
        ) : null}
        {onOpenCore ? (
          <button onClick={onOpenCore} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
            Abrir flujo Step 0–4
          </button>
        ) : null}
        {onOpenInitiative ? (
          <button onClick={onOpenInitiative} className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700" style={{ fontWeight: 600 }} data-testid="open-initiative">
            Abrir iniciativa
          </button>
        ) : null}
      </div>

      <div className={`mt-5 rounded-2xl border p-4 ${toneClasses[alertSummary.tone]}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs" style={{ fontWeight: 700 }}>Qué requiere atención</p>
            <p className="mt-1 text-sm">{alertSummary.label}</p>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs ${toneClasses[attentionTone]}`} style={{ fontWeight: 600 }}>{attentionState}</div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Qué pasa</p>
            <p className="mt-1 text-sm text-slate-700">{alertSummary.whatHappens}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Acción sugerida</p>
            <p className="mt-1 text-sm text-slate-700">{alertSummary.suggestedAction}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Responsable esperado</p>
            <p className="mt-1 text-sm text-slate-700">{alertSummary.expectedResponsible}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onOpenAttentionAction} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white" style={{ fontWeight: 600 }}>
            {alertSummary.ctaLabel}
          </button>
          {canReport ? (
            <button onClick={onOpenReport ?? undefined} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
              Generar reporte
            </button>
          ) : null}
          <button onClick={onOpenDetail} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" style={{ fontWeight: 600 }}>
            Ver detalle
          </button>
        </div>
      </div>

      <details className="group mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="list-none cursor-pointer select-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Detalle ejecutivo</p>
              <p className="mt-1 text-xs text-slate-500">Contexto, alertas, actividad reciente y lectura de Portfolio Lead.</p>
            </div>
            <span className="text-xs text-slate-500 group-open:hidden">Ver más</span>
            <span className="text-xs text-slate-500 hidden group-open:inline">Ocultar</span>
          </div>
        </summary>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>LECTURA EJECUTIVA</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <MiniStat label="Frente" value={frontName} hint="Padre estratégico visible" />
              <MiniStat label="Reto" value={challengeName} hint="Problema u oportunidad que enmarca la iniciativa" />
              <MiniStat label="Qué está avanzando" value={initiative.readyForDecision ? 'Ya puede pasar a decisión' : initiative.status === 'bloqueada' ? 'Tiene fricción visible' : 'Está moviendo trabajo'} hint="Lectura breve para Portfolio Lead" />
              <MiniStat label="Qué falta" value={initiative.deliverables.length > 0 ? 'Completar evidencia y cierre' : 'Construir evidencia suficiente'} hint="Antes de escalar o reportar" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>BLOQUEOS Y ALERTAS</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {alertChips.map(alert => (
                <StatusChip key={alert} tone={alertTone(alert)}>
                  {alert}
                </StatusChip>
              ))}
            </div>
          </section>
        </div>
      </details>
    </article>
  );
}

