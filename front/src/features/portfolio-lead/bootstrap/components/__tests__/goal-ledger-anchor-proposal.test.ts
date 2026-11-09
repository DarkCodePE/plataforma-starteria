import { describe, expect, it } from 'vitest';
import { createGoalLedgerAnchorProposal, isGoalLedgerTurnAccepted } from '../goal-ledger-anchor-proposal';
import type { PortfolioBootstrapAnchor, PortfolioGoalTurn } from '../../services/portfolioBootstrapClient';

const anchor: PortfolioBootstrapAnchor = {
  id: 'anchor-1', bootstrapSessionId: 'session-1', version: 2,
  outcomeStatement: 'Resultado de negocio por definir',
  contextSummary: 'Cafetería pequeña', decisionToEnable: null,
  businessSignalStatus: 'unknown', businessSignalValue: null,
  status: 'anchor_insufficient', sourceRefs: {
    objectiveConversation: {
      unknownFields: ['decisionToEnable'],
      turns: [{ field: 'contextSummary', value: 'Cafetería pequeña', disposition: 'user_declared', origin: 'PortfolioLead', recordedAt: '2026-11-08T12:00:00.000Z' }],
    },
  },
  provenanceStatus: 'raw_entry', confirmedBy: null, confirmedAt: null,
  createdAt: '2026-11-08T12:00:00.000Z', updatedAt: '2026-11-08T12:00:00.000Z',
};
const turn: PortfolioGoalTurn = {
  id: 'turn-1', sessionId: 'session-1', version: 1, actorUserId: 'user-1',
  anchorVersion: 2, contextReviewVersion: 4,
  questionId: 'q-1', field: 'outcomeStatement',
  inputText: 'Validar pedidos a oficinas sin ampliar el local.',
  disposition: 'user_declared', supersedesTurnId: null,
  evidence: [{ kind: 'user_input', quote: 'Validar pedidos a oficinas sin ampliar el local.', status: 'provisional' }],
  createdAt: '2026-11-09T12:00:00.000Z',
};

describe('KAN-253 B3 E2 ledger → Anchor review-only projection', () => {
  it('adds exact source receipt while preserving prior responses, with no invented KPI', () => {
    const result = createGoalLedgerAnchorProposal(anchor, turn);
    expect(result.expectedVersion).toBe(anchor.version);
    expect(result.outcomeStatement).toBe(turn.inputText);
    expect(result.businessSignalValue).toBeUndefined();
    expect(result).not.toHaveProperty('decisionToEnable');
    expect(result.sourceRefs).toMatchObject({
      objectiveConversation: {
        goalLedgerAcceptedTurnIds: ['turn-1'],
        unknownFields: ['decisionToEnable'],
        turns: [
          expect.objectContaining({ value: 'Cafetería pequeña' }),
          expect.objectContaining({ value: turn.inputText, ledgerTurnId: 'turn-1', field: 'outcomeStatement' }),
        ],
      },
    });
    expect(isGoalLedgerTurnAccepted(anchor.sourceRefs, turn.id)).toBe(false);
    expect(isGoalLedgerTurnAccepted(result.sourceRefs, turn.id)).toBe(true);
  });

  it('preserves unknown as an explicit disposition, never as a business claim', () => {
    const unknown: PortfolioGoalTurn = { ...turn, id: 'turn-2', field: 'businessSignalValue',
      inputText: 'No lo sé todavía.', disposition: 'unknown' };
    const result = createGoalLedgerAnchorProposal(anchor, unknown);
    expect(result.businessSignalValue).toBeNull();
    expect(result.businessSignalStatus).toBe('unknown');
    expect(result.sourceRefs).toMatchObject({
      objectiveConversation: { unknownFields: expect.arrayContaining(['businessSignalValue']) },
    });
  });

  it('makes corrections append-only and recognizes an already accepted receipt after reload', () => {
    const acceptedAnchor: PortfolioBootstrapAnchor = {
      ...anchor, sourceRefs: createGoalLedgerAnchorProposal(anchor, turn).sourceRefs,
    };
    const corrected: PortfolioGoalTurn = {
      ...turn, id: 'turn-2', version: 2, supersedesTurnId: 'turn-1',
      inputText: 'Validar desayunos a oficinas cercanas.',
    };
    const result = createGoalLedgerAnchorProposal(acceptedAnchor, corrected);
    expect(result.sourceRefs).toMatchObject({
      objectiveConversation: {
        goalLedgerAcceptedTurnIds: ['turn-1', 'turn-2'],
        turns: expect.arrayContaining([expect.objectContaining({ ledgerTurnId: 'turn-1' }), expect.objectContaining({ ledgerTurnId: 'turn-2' })]),
      },
    });
  });

  it('does not accept retracted text or an incorrect session as an Anchor fact', () => {
    expect(() => createGoalLedgerAnchorProposal(anchor, { ...turn, disposition: 'retracted', supersedesTurnId: 'turn-old' }))
      .toThrow(/retractad/i);
    expect(() => createGoalLedgerAnchorProposal(anchor, { ...turn, sessionId: 'another-session' }))
      .toThrow(/sesión/i);
  });
});
