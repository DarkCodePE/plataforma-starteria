/**
 * Ruta sugerida de la lectura inicial (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §5: el
 * resultado "no necesariamente es una Initiative"; puede ser Portfolio Setup, análisis de portfolio,
 * más exploración o no activar trabajo todavía).
 *
 * Es sólo una lectura derivada de campos que el handoff ya trae. No cambia el destino: según
 * PORTFOLIO_POST_ENTRY_CONTINUATION_CONTRACT §4 el destino lo fija el servidor, y ni `starteria_path`
 * ni el intent tienen autoridad para elegirlo. Tampoco agrega campos al handoff ni entry states
 * (PORTFOLIO_ENTRY_LOGIC_CONTRACT §10 y §22.1): eso queda como CONFLICT abierto.
 */
import type { PortfolioEntryHandoff } from './types';

export type SuggestedRouteDestination = 'not_now' | 'explore' | 'portfolio_analysis' | 'portfolio_setup';

export type SuggestedRoute = {
  destination: SuggestedRouteDestination;
  title: string;
  reason: string;
};

const PORTFOLIO_ACTIONS = new Set(['make_visible', 'compare_or_follow']);

export function deriveSuggestedRoute(handoff: PortfolioEntryHandoff): SuggestedRoute {
  const gaps = handoff.unresolved_context.length + handoff.evidence_or_clarity_needed.length;
  const decisionOpen = handoff.decision_to_enable === 'unresolved';
  const actions = handoff.starteria_path.map((step) => step.action);

  // §5: "no activar trabajo todavía" cuando no hay decisión que habilitar y lo que se busca
  // conseguir no lo dijo la persona (lo infirió Starteria): no hay mandato que movilizar.
  const outcomeOrigin = handoff.desired_outcome.provenance?.origin;
  const outcomeFromUser = outcomeOrigin === 'USER_DECLARED' || outcomeOrigin === 'EXTRACTED_FROM_USER_TEXT';
  if (handoff.handoff_status === 'insufficient_input' || (decisionOpen && !outcomeFromUser && gaps > 0)) {
    return {
      destination: 'not_now',
      title: 'Todavía no activar trabajo',
      reason: 'Todavía no aparece una decisión que habilitar ni contexto suficiente. Conviene aclarar qué quieres conseguir antes de movilizar personas o presupuesto.',
    };
  }
  if (decisionOpen || handoff.handoff_status === 'ready_with_uncertainty') {
    return {
      destination: 'explore',
      title: 'Explorar un poco más antes de estructurar',
      reason: 'Hay una dirección, pero quedan puntos abiertos que pueden cambiar qué conviene estructurar.',
    };
  }
  if (actions.some((action) => PORTFOLIO_ACTIONS.has(action)) && !actions.includes('structure')) {
    return {
      destination: 'portfolio_analysis',
      title: 'Leer el portafolio que ya existe',
      reason: 'Tu situación pide ver y comparar el trabajo en curso antes de crear estructura nueva.',
    };
  }
  return {
    destination: 'portfolio_setup',
    title: 'Ordenar el portafolio',
    reason: 'Hay una decisión clara que habilitar: el siguiente paso es estructurar qué trabajo la sostiene.',
  };
}
