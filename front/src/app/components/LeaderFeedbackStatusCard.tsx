import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Copy, MessageSquare, Send, X } from 'lucide-react';
import type { LeaderFeedbackStatus, Project, Step0Data } from '../context/AppContext';

const STATUS_OPTIONS: Array<{ value: LeaderFeedbackStatus; label: string; formLabel: string }> = [
  { value: 'pending', label: 'Feedback pendiente', formLabel: 'Todavía no la compartí' },
  { value: 'proposal_sent', label: 'Propuesta enviada', formLabel: 'Ya la envié' },
  { value: 'meeting_scheduled', label: 'Reunión pactada', formLabel: 'Tengo reunión pactada' },
  { value: 'feedback_received', label: 'Feedback recibido', formLabel: 'Recibí feedback' },
  { value: 'approved_to_investigate', label: 'Aprobado para investigar', formLabel: 'Recibí aprobación para investigar' },
  { value: 'aligned_with_conditions', label: 'Alineado con condiciones', formLabel: 'Me pidieron ajustar la propuesta' },
  { value: 'not_prioritized', label: 'No priorizado por ahora', formLabel: 'No fue priorizada por ahora' },
  { value: 'not_applicable', label: 'No aplica / justificado', formLabel: 'No aplica / justificado' },
];

const DECISION_OPTIONS = ['Avanzar a investigación', 'Ajustar enfoque antes de investigar', 'Buscar más respaldo', 'Buscar otro sponsor', 'Pausar por ahora', 'Sin decisión todavía', 'No aplica'];
const EVIDENCE_OPTIONS = ['Nota', 'Minuta', 'Correo', 'Link', 'Archivo', 'Captura'];
const IMPORTED_OPTIONS = ['Ya fue aprobada para investigar', 'Fue conversada informalmente', 'Tiene observaciones pendientes', 'No fue conversada todavía', 'Desconocido / por confirmar', 'No aplica / justificado'];

type Variant = 'step0' | 'step1' | 'step2' | 'step3' | 'step4';

function getStatusLabel(status?: LeaderFeedbackStatus) {
  return STATUS_OPTIONS.find(option => option.value === status)?.label ?? 'Feedback pendiente';
}

function pending(value?: string) {
  return value?.trim() || 'Sin definir todavía';
}

function buildProposal(step0?: Partial<Step0Data>) {
  return `Propuesta de iniciativa para tu líder

Nombre: ${pending(step0?.initiativeTitle)}
Qué se quiere mover: ${pending(step0?.quePasaQueQuieres)}
Por qué importa ahora: ${pending(step0?.whyNowText)}
A quién impacta: ${pending(step0?.impactWho || step0?.impacta?.join(', '))}
Señales actuales: ${pending(step0?.currentEvidence || step0?.evidenceType)}
Decisión que se busca: ${pending(step0?.decisionRequested)}
Próximo paso recomendado: ${pending(step0?.validationSignal || 'Buscar evidencia en Step 1.')}`;
}

function hasImportMetadata(project: Project) {
  const record = project as unknown as { origin?: string; source?: string; metadata?: Record<string, unknown>; importMetadata?: unknown };
  return record.origin === 'imported'
    || record.origin === 'linked_existing'
    || record.source === 'imported'
    || Boolean(record.importMetadata)
    || Boolean(record.metadata?.imported)
    || Boolean(record.metadata?.import);
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

export function LeaderFeedbackStatusCard({
  project,
  updateProject,
  variant = 'step0',
  compact = false,
  stronger = false,
  proposalStep0,
}: {
  project: Project;
  /** Datos para armar la propuesta, si difieren de lo guardado (p. ej. respuestas confirmadas del Step 0). */
  proposalStep0?: Partial<Step0Data>;
  updateProject: (id: string, updates: Partial<Project>) => void;
  variant?: Variant;
  compact?: boolean;
  stronger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const step0 = project.step0Data ?? {};
  const status = step0.leaderFeedbackStatus ?? 'pending';
  const statusLabel = getStatusLabel(status);
  const imported = hasImportMetadata(project);
  const proposal = useMemo(() => buildProposal(proposalStep0 ?? step0), [proposalStep0, step0]);

  const updateFeedback = (updates: Partial<Step0Data>) => {
    updateProject(project.id, {
      step0Data: {
        ...step0,
        ...updates,
      },
    });
  };

  const pendingTextByStep: Record<Variant, string> = {
    step0: 'Tu propuesta ya está lista para compartir. Puedes seguir avanzando, pero registra feedback cuando lo recibas para ajustar el foco de la iniciativa.',
    step1: 'Puedes validar el foco, pero recuerda registrar feedback del líder cuando lo tengas. Esto ayudará a enfocar qué evidencia buscar primero.',
    step2: 'Antes de diseñar experimentos, conviene revisar si tu líder dejó condiciones, restricciones o prioridades.',
    step3: 'Cuando tengas resultados, compara aprendizajes con las expectativas o comentarios del líder.',
    step4: 'Esta iniciativa está por cerrarse, pero aún no tiene feedback, respaldo o justificación registrada. Para una salida ejecutiva más sólida, registra al menos una conversación, comentario, decisión o justificación.',
  };

  const tone = stronger && status === 'pending' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white';
  const badgeTone = status === 'pending'
    ? 'bg-amber-100 text-amber-700'
    : status === 'approved_to_investigate' || status === 'feedback_received'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-indigo-100 text-indigo-700';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-indigo-600 shadow-sm"><MessageSquare size={18} /></div>
          <div>
            <h3 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>
              {imported ? 'Feedback o respaldo previo' : 'Feedback y respaldo del líder'}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {imported
                ? 'Esta iniciativa puede haber sido conversada antes de entrar a Starteria. Registra si ya tuvo feedback, respaldo, aprobación o condiciones de un líder.'
                : status === 'meeting_scheduled'
                  ? 'Ya existe una conversación pactada. Registra el resultado cuando ocurra.'
                  : status === 'feedback_received' || status === 'approved_to_investigate' || status === 'aligned_with_conditions'
                    ? 'Este feedback queda como contexto para enfocar la validación y las decisiones siguientes.'
                    : pendingTextByStep[variant]}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${badgeTone}`} style={{ fontWeight: 700 }}>{statusLabel}</span>
      </div>

      {status === 'meeting_scheduled' && (
        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
          <p><span className="text-slate-400">Con quién:</span> {pending(step0.leaderFeedbackPerson)}</p>
          <p><span className="text-slate-400">Fecha:</span> {pending(step0.leaderFeedbackDate)}</p>
          <p><span className="text-slate-400">Tema:</span> {pending(step0.leaderFeedbackTopic || step0.decisionRequested)}</p>
        </div>
      )}

      {(status === 'feedback_received' || status === 'approved_to_investigate' || status === 'aligned_with_conditions' || status === 'not_prioritized' || status === 'not_applicable') && (
        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p><span className="text-slate-400">Persona / rol:</span> {pending([step0.leaderFeedbackPerson, step0.leaderFeedbackRoleArea].filter(Boolean).join(' · '))}</p>
          <p><span className="text-slate-400">Decisión inicial:</span> {pending(step0.leaderFeedbackInitialDecision)}</p>
          <p className="md:col-span-2"><span className="text-slate-400">Comentario principal:</span> {pending(step0.leaderFeedbackComment)}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setOpen(true)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs text-white" style={{ fontWeight: 700 }}>
          {status === 'pending' ? 'Registrar feedback' : status === 'meeting_scheduled' ? 'Registrar resultado' : 'Agregar nuevo feedback'}
        </button>
        <button onClick={() => copyText(proposal)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" style={{ fontWeight: 700 }}><Copy size={13} className="mr-1 inline" />Copiar propuesta</button>
        <button onClick={() => setShowProposal(prev => !prev)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" style={{ fontWeight: 700 }}>Ver propuesta para líder</button>
        {variant === 'step4' && status === 'pending' && (
          <>
            <button onClick={() => updateFeedback({ leaderFeedbackStatus: 'pending', leaderFeedbackClosedPending: true })} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-700" style={{ fontWeight: 700 }}>Cerrar con alineación pendiente</button>
            <button onClick={() => updateFeedback({ leaderFeedbackStatus: 'not_applicable', leaderFeedbackInitialDecision: 'No aplica' })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" style={{ fontWeight: 700 }}>Marcar como no aplica / justificado</button>
          </>
        )}
      </div>

      {showProposal && (
        <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{proposal}</pre>
      )}

      {step0.leaderFeedbackClosedPending && status === 'pending' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-3 text-sm text-amber-800">
          Esta recomendación aún no tiene feedback o respaldo registrado de líder/sponsor.
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base text-slate-900" style={{ fontWeight: 700 }}>Registrar feedback del líder</h2>
                <p className="mt-1 text-sm text-slate-500">Registra comentarios, recomendaciones, condiciones o decisiones recibidas después de compartir tu propuesta.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>

            <div className="mt-5 space-y-4">
              {imported && (
                <Field label="Feedback o respaldo previo">
                  <Quick values={step0.leaderFeedbackTopic ? [step0.leaderFeedbackTopic] : []} options={IMPORTED_OPTIONS} onChange={value => updateFeedback({ leaderFeedbackTopic: value })} />
                </Field>
              )}
              <Field label="Estado de conversación">
                <div className="grid gap-2 sm:grid-cols-2">
                  {STATUS_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateFeedback({ leaderFeedbackStatus: option.value })}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm ${status === option.value ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                      style={{ fontWeight: 600 }}
                    >
                      {option.formLabel}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="¿Con quién la conversaste o conversarás?">
                  <Input value={step0.leaderFeedbackPerson ?? ''} onChange={value => updateFeedback({ leaderFeedbackPerson: value })} placeholder="Ej. Gerente de Operaciones, líder de TI, sponsor del área..." />
                </Field>
                <Field label="Cargo o área">
                  <Input value={step0.leaderFeedbackRoleArea ?? ''} onChange={value => updateFeedback({ leaderFeedbackRoleArea: value })} placeholder="Ej. Operaciones, Comercial, TI, Gerencia General..." />
                </Field>
              </div>
              <Field label="Fecha de reunión o conversación">
                <input type="date" value={step0.leaderFeedbackDate ?? ''} onChange={event => updateFeedback({ leaderFeedbackDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
              <Field label="Feedback, recomendación u observación">
                <textarea rows={4} value={step0.leaderFeedbackComment ?? ''} onChange={event => updateFeedback({ leaderFeedbackComment: event.target.value })} placeholder="Resume qué te dijeron, qué dudas aparecieron, qué condición dejaron o qué deberías considerar." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
              <Field label="Decisión inicial">
                <Quick values={step0.leaderFeedbackInitialDecision ? [step0.leaderFeedbackInitialDecision] : []} options={DECISION_OPTIONS} onChange={value => updateFeedback({ leaderFeedbackInitialDecision: value })} />
              </Field>
              <Field label="Evidencia opcional" helper="Para MVP puedes dejar una nota, resumen o link. No hace falta subir archivo real.">
                <Quick values={step0.leaderFeedbackEvidenceType ? [step0.leaderFeedbackEvidenceType] : []} options={EVIDENCE_OPTIONS} onChange={value => updateFeedback({ leaderFeedbackEvidenceType: value })} />
                <textarea rows={3} value={step0.leaderFeedbackEvidenceNote ?? ''} onChange={event => updateFeedback({ leaderFeedbackEvidenceNote: event.target.value })} placeholder="Pega una nota, minuta, link o referencia." className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600" style={{ fontWeight: 600 }}>Cerrar</button>
              <button onClick={() => setOpen(false)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white" style={{ fontWeight: 600 }}><CheckCircle2 size={14} className="mr-2 inline" />Guardar feedback</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{label}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />;
}

function Quick({ values, options, onChange }: { values: string[]; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const selected = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-1.5 text-xs ${selected ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}
            style={{ fontWeight: 600 }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
