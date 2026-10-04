/**
 * Modos del Copilot según la intención de la persona (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §20):
 *   Orientarme        — no sé qué necesito hacer ahora.
 *   Trabajar conmigo  — sé aproximadamente qué hacer; ayúdame a hacerlo bien.
 *   Desbloquearme     — sé qué debería hacer, pero algo me lo impide.
 *
 * La lógica vive en el backend y se calcula sólo desde el estado persistido del Adaptive Core, para
 * que cualquier canal (workspace, drawer, chat) dé la misma respuesta. Es una lectura: no confirma
 * checkpoints ni escribe nada. "Desbloquearme" ofrece el canal humano que ya existe:
 * POST /projects/:id/help (pedido de ayuda al mentor), que la UI dispara con confirmación.
 */
import { STEP_PROGRESS_QUESTION_BY_STEP } from './copilot-progress-questions';

export type CopilotIntentMode = 'orient' | 'work_with_me' | 'unblock';

export interface CopilotModeResponse {
  mode: CopilotIntentMode;
  title: string;
  answer: string;
  actions: Array<{ label: string; target: string }>;
  sources: string[];
}

type State = {
  activeCheckpoint?: {
    step?: number;
    checkpointKey?: string;
    title?: string;
    questions?: Array<{ prompt?: string; clarifiesVariable?: string; required?: boolean }> | null;
    responses?: Record<string, unknown>;
  } | null;
  progressSignal?: { step?: number; health?: string; nextAction?: string; blockers?: string[] } | null;
  masterContext?: { missingCriticalInformation?: string[]; risks?: string[] } | null;
};

export function resolveCopilotMode(projectId: string, mode: CopilotIntentMode, state: State): CopilotModeResponse {
  const step = Number(state.activeCheckpoint?.step ?? state.progressSignal?.step ?? 0) as 0 | 1 | 2 | 3 | 4;
  const question = STEP_PROGRESS_QUESTION_BY_STEP[step];
  const checkpoint = state.activeCheckpoint;
  const stepPath = `/projects/${projectId}/step/${step}`;

  if (mode === 'orient') {
    return {
      mode,
      title: 'Dónde estás y qué sigue',
      answer: [
        `Estás en el Step ${step}: ${question}`,
        state.progressSignal?.nextAction ? `Lo siguiente: ${state.progressSignal.nextAction}` : null,
      ].filter(Boolean).join(' '),
      actions: [{ label: `Ir al Step ${step}`, target: stepPath }],
      sources: ['progressSignal'],
    };
  }

  if (mode === 'work_with_me') {
    const answered = checkpoint?.responses ?? {};
    const isAnswered = (key?: string) => {
      const value = key ? answered[key] : undefined;
      return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
    };
    const pending = (Array.isArray(checkpoint?.questions) ? checkpoint!.questions! : [])
      .filter((q) => q.required !== false && !isAnswered(q.clarifiesVariable))
      .map((q) => q.prompt)
      .filter(Boolean) as string[];
    return {
      mode,
      title: checkpoint?.title ? `Trabajemos ${checkpoint.checkpointKey}: ${checkpoint.title}` : 'Trabajemos el paso actual',
      answer: pending.length > 0
        ? `Para cerrar este punto falta responder: ${pending.slice(0, 3).join(' · ')}`
        : 'Este punto no tiene preguntas obligatorias pendientes: revisa y confirma.',
      actions: [{ label: 'Abrir el checkpoint', target: stepPath }],
      sources: ['activeCheckpoint'],
    };
  }

  const blockers = [
    ...(state.progressSignal?.blockers ?? []),
    ...(state.masterContext?.missingCriticalInformation ?? []),
  ].filter(Boolean).slice(0, 3);
  return {
    mode,
    title: 'Qué te puede estar frenando',
    answer: blockers.length > 0
      ? `Lo que aparece como bloqueo o información crítica faltante: ${blockers.join(' · ')}. Si no lo puedes resolver solo, pide ayuda.`
      : 'No aparece un bloqueo registrado. Si algo te frena, cuéntalo y pide ayuda a tu mentor.',
    actions: [
      { label: 'Pedir ayuda al mentor', target: 'help_request' },
      { label: `Volver al Step ${step}`, target: stepPath },
    ],
    sources: ['progressSignal', 'masterContext'],
  };
}
