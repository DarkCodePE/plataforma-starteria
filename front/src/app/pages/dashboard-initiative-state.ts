/**
 * Estado de una iniciativa para las tarjetas de "Mis iniciativas".
 *
 * El flujo adaptativo (Steps 0–4) no actualiza la tabla legacy `Step`: sus filas quedan en
 * NOT_STARTED/BLOCKED aunque la iniciativa esté decidida. Lo que sí se mantiene al día es
 * InitiativePortfolioMeta (paso actual, lista para decisión, cerrada tras la decisión), que es
 * lo que lee Portafolio. Si la iniciativa tiene meta, la tarjeta usa eso; si no, queda el
 * cálculo legacy.
 */

export type AdaptiveCardState =
  | { kind: 'closed'; step: 4 }
  | { kind: 'ready_for_decision'; step: 4 }
  | { kind: 'in_step'; step: number; blocker: string | null };

interface PortfolioMetaLike {
  status?: string | null;
  currentStep?: string | null;
  readyForDecision?: boolean | null;
  mainBlocker?: string | null;
}

export function getAdaptiveCardState(project: object): AdaptiveCardState | null {
  // `portfolioMeta` viene del backend (projectInclude) y no está en el tipo local de Project.
  const metas = (project as { portfolioMeta?: unknown }).portfolioMeta;
  const meta = (Array.isArray(metas) ? metas[0] : null) as PortfolioMetaLike | null;
  if (!meta) return null;
  // `closed` es el deletreo canónico (ADR-030); `cerrada` queda como lectura legacy.
  if (meta.status === 'closed' || meta.status === 'cerrada') return { kind: 'closed', step: 4 };
  if (meta.readyForDecision || meta.status === 'lista_para_decision') return { kind: 'ready_for_decision', step: 4 };
  const fromCurrent = Number(meta.currentStep?.match(/\d/)?.[0]);
  const fromStatus = Number(meta.status?.match(/^en_step_(\d)$/)?.[1]);
  const step = Number.isInteger(fromCurrent) ? fromCurrent : Number.isInteger(fromStatus) ? fromStatus : 0;
  const blocker = meta.mainBlocker?.trim() || null;
  return { kind: 'in_step', step, blocker };
}

/** Mismo criterio que Portafolio: cada Step completo suma 20%; lista o cerrada es 100%. */
export function getAdaptiveProgress(state: AdaptiveCardState): number {
  return state.kind === 'in_step' ? state.step * 20 : 100;
}

export function getAdaptiveStatusLabel(state: AdaptiveCardState): string {
  if (state.kind === 'closed') return 'Cerrada';
  if (state.kind === 'ready_for_decision') return 'Lista para decisión';
  return 'En progreso';
}

export function getAdaptiveStepLabel(state: AdaptiveCardState): string {
  if (state.kind === 'closed') return 'Decisión registrada';
  if (state.kind === 'ready_for_decision') return 'Steps 0–4 completos';
  return `Step ${state.step} en progreso`;
}

/** Estado de cada segmento Step 1–4 de la tarjeta, en el vocabulario de los chips. */
export function getAdaptiveSegmentStatus(state: AdaptiveCardState, stepNumber: number): 'Aprobado' | 'En progreso' | 'No iniciado' {
  if (state.kind !== 'in_step' || stepNumber < state.step) return 'Aprobado';
  return stepNumber === state.step ? 'En progreso' : 'No iniciado';
}
