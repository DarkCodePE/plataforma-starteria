import type { PortfolioBootstrapAnchor, PortfolioGoalTurn } from '../services/portfolioBootstrapClient';
import { isGoalLedgerTurnResolved } from './goal-ledger-anchor-proposal';

/** Read-only representation of the four business fields, not a confirmation or write command. */
export const goalReviewFields = [
  { key: 'outcomeStatement', label: 'Resultado esperado' },
  { key: 'contextSummary', label: 'Situación y contexto' },
  { key: 'decisionToEnable', label: 'Decisión que queremos habilitar' },
  { key: 'businessSignalValue', label: 'Señal o indicador' },
] as const;

export type GoalReviewRow = {
  key: (typeof goalReviewFields)[number]['key'];
  label: string;
  current: string;
  proposed: string | null;
  status: 'pending_review' | 'already_in_draft' | 'missing' | 'outdated_response';
  disposition: PortfolioGoalTurn['disposition'] | null;
  turnId: string | null;
};

export function buildGoalReviewRows(anchor: PortfolioBootstrapAnchor, turns: PortfolioGoalTurn[]): GoalReviewRow[] {
  const superseded = new Set(turns.flatMap((turn) => turn.supersedesTurnId ? [turn.supersedesTurnId] : []));
  const currentTurns = [...turns].filter((turn) => !superseded.has(turn.id) && turn.disposition !== 'retracted')
    .sort((a, b) => b.version - a.version);
  return goalReviewFields.map(({ key, label }) => {
    const current = anchor[key]?.trim() || '';
    const candidate = currentTurns.find((turn) => turn.field === key && !isGoalLedgerTurnResolved(anchor.sourceRefs, turn.id)) ?? null;
    const pending = candidate && candidate.anchorVersion === anchor.version;
    const isUnknown = candidate?.disposition === 'unknown' || candidate?.disposition === 'not_applicable';
    return {
      key, label,
      current: current || 'Por definir',
      proposed: pending ? (isUnknown
        ? key === 'outcomeStatement'
          ? 'Conservar resultado actual; registrar incertidumbre'
          : 'Registrar como desconocido o no aplicable'
        : candidate.inputText) : null,
      status: pending ? 'pending_review' : candidate ? 'outdated_response' : current ? 'already_in_draft' : 'missing',
      disposition: candidate?.disposition ?? null,
      turnId: candidate?.id ?? null,
    };
  });
}
