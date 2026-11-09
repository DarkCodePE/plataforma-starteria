import { describe, expect, it } from 'vitest';
import { buildGoalQuestionPlan } from '../portfolio-bootstrap-goal-question-planner';

const baseAnchor = {
  id: 'anchor-1', version: 3, status: 'anchor_insufficient',
  outcomeStatement: 'Resultado de negocio por definir',
  contextSummary: null, decisionToEnable: null,
  businessSignalStatus: 'unknown', businessSignalValue: null,
  sourceRefs: [],
};

const confirmedE1 = {
  id: 'review-1', status: 'confirmed', version: 4,
  effectiveContext: {
    situation: {
      value: 'Somos una cafetería de cuatro personas. Nunca hemos probado los pedidos a oficinas.',
      provenance: 'user_declared', sourceRef: { kind: 'user_input' },
    },
  },
};

describe('KAN-253 — E2 question-planning contract (read-only)', () => {
  it('asks about business outcome from an E1-confirmed narrative, not the missing area or pilot', () => {
    const result = buildGoalQuestionPlan({
      sessionId: 'session-1', anchor: baseAnchor, contextReview: confirmedE1,
    });
    expect(result).toMatchObject({
      mode: 'deterministic_preview',
      anchorVersion: 3,
      contextReviewVersion: 4,
      status: 'question_required',
      activeQuestion: {
        field: 'outcomeStatement',
        resolves: ['business_outcome'],
        provenance: [{ kind: 'confirmed_context', reviewId: 'review-1', reviewVersion: 4, fieldPath: 'situation' }],
      },
    });
    expect(result.activeQuestion?.recap).toContain('cafetería');
    expect(result.activeQuestion?.question).not.toMatch(/departamento|piloto/i);
    expect(JSON.stringify(result)).not.toContain('20 pedidos');
  });

  it('does not treat draft E1 or unconfirmed model facts as a confirmed reference', () => {
    const result = buildGoalQuestionPlan({
      sessionId: 'session-1', anchor: baseAnchor,
      contextReview: { ...confirmedE1, status: 'draft' },
    });
    expect(result.contextReviewVersion).toBeNull();
    expect(result.activeQuestion?.provenance).toEqual([]);
    expect(result.activeQuestion?.recap).not.toContain('cafetería');
  });

  it('uses the next material missing decision rather than reprompting outcome or pilot for an MVP', () => {
    const result = buildGoalQuestionPlan({
      sessionId: 'session-2',
      anchor: {
        ...baseAnchor,
        outcomeStatement: 'Aumentar uso del portal de pedidos de la distribuidora.',
        contextSummary: 'MVP disponible, logs de uso y pedidos paralelos por WhatsApp.',
      },
      contextReview: null,
    });
    expect(result.activeQuestion).toMatchObject({ field: 'decisionToEnable', resolves: ['decision_to_enable'] });
    expect(result.activeQuestion?.recap).toContain('MVP disponible');
    expect(result.activeQuestion?.question).not.toContain('¿Ya habéis probado');
  });

  it('prioritizes a missing decision over repeating previously confirmed E1 context for a corporate case', () => {
    const result = buildGoalQuestionPlan({
      sessionId: 'session-3',
      anchor: {
        ...baseAnchor, outcomeStatement: 'Reducir abandono en onboarding B2B.',
      },
      contextReview: {
        ...confirmedE1,
        effectiveContext: { situation: { value: 'Soporte y producto de una empresa grande reportan dificultades de activación.' } },
      },
    });
    expect(result.activeQuestion?.field).toBe('decisionToEnable');
  });

  it('does not create a KPI or goal when the person explicitly said unknown', () => {
    const result = buildGoalQuestionPlan({
      sessionId: 'session-4',
      anchor: {
        ...baseAnchor,
        sourceRefs: { objectiveConversation: { unknownFields: ['outcomeStatement', 'businessSignalValue'] } },
      },
      contextReview: null,
    });
    expect(result.status).toBe('review_required_with_unknowns');
    expect(result.activeQuestion?.field).toBe('contextSummary');
    expect(result.unknownFields).toEqual(['outcomeStatement', 'businessSignalValue']);
    expect(JSON.stringify(result)).not.toMatch(/20 pedidos|30 %/i);
  });

  it('offers review but does not confirm the Anchor when enough fields exist', () => {
    const result = buildGoalQuestionPlan({
      sessionId: 'session-5',
      anchor: {
        ...baseAnchor, status: 'anchor_sufficient',
        outcomeStatement: 'Validar nuevos servicios.',
        contextSummary: 'Sin iniciativas en curso.',
        decisionToEnable: 'Decidir si conviene probar una oferta.',
        businessSignalStatus: 'suggested', businessSignalValue: 'Solicitudes observadas.',
      },
      contextReview: confirmedE1,
    });
    expect(result.status).toBe('ready_for_human_review');
    expect(result.activeQuestion).toBeNull();
    expect(result.mode).toBe('deterministic_preview');
  });

  it('blocks suggestion on conflicting or already confirmed Anchor without any write', () => {
    for (const status of ['anchor_conflicting', 'anchor_confirmed']) {
      const result = buildGoalQuestionPlan({
        sessionId: 'session-6', anchor: { ...baseAnchor, status }, contextReview: confirmedE1,
      });
      expect(result.status).toBe('blocked');
      expect(result.activeQuestion).toBeNull();
    }
  });

  it('provides a targeted follow-up for an unresolved measurement definition', () => {
    const result = buildGoalQuestionPlan({
      sessionId: 'session-7',
      anchor: {
        ...baseAnchor,
        outcomeStatement: 'Mejorar conversión.',
        decisionToEnable: 'Decidir qué etapa priorizar.',
        businessSignalValue: 'Leads convertidos',
        sourceRefs: { objectiveConversation: { pendingClarification: 'businessSignalMeasure' } },
      },
      contextReview: null,
    });
    expect(result.activeQuestion).toMatchObject({ field: 'businessSignalValue', resolves: ['business_signal_measure'] });
    expect(result.activeQuestion?.question).toMatch(/número|porcentaje/i);
  });
});
