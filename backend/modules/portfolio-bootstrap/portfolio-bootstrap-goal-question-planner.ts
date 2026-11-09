/**
 * KAN-253 B1 — Provisional, pure, read-only question plan for E2 Objective.
 *
 * This is not generative inference and cannot confirm an Anchor or advance E3.
 * A later, separately governed semantic adapter may replace its question
 * selection, but must preserve source evidence and the human decision gate.
 */

export type GoalField = 'outcomeStatement' | 'contextSummary' | 'decisionToEnable' | 'businessSignalValue';
export type GoalPlanStatus =
  | 'question_required'
  | 'review_required_with_unknowns'
  | 'ready_for_human_review'
  | 'blocked';
export type GoalQuestionEvidence = {
  kind: 'confirmed_context';
  reviewId: string;
  reviewVersion: number;
  fieldPath: 'situation';
  quote: string;
};
export type GoalQuestionPlan = {
  mode: 'deterministic_preview';
  sessionId: string;
  anchorVersion: number;
  contextReviewVersion: number | null;
  status: GoalPlanStatus;
  activeQuestion: null | {
    id: string;
    field: GoalField;
    question: string;
    recap: string;
    reasonToAsk: string;
    resolves: string[];
    provenance: GoalQuestionEvidence[];
  };
  unknownFields: GoalField[];
  reason: string;
};

export type GoalPlanAnchor = {
  id: string;
  version: number;
  status: string;
  outcomeStatement: string | null;
  contextSummary: string | null;
  decisionToEnable: string | null;
  businessSignalStatus: string;
  businessSignalValue: string | null;
  sourceRefs: unknown;
};

export type GoalPlanContextReview = {
  id: string;
  status: 'draft' | 'confirmed';
  version: number;
  effectiveContext: {
    situation?: { value?: string | null };
  } | null;
};

const fields: GoalField[] = ['outcomeStatement', 'contextSummary', 'decisionToEnable', 'businessSignalValue'];
const definitions: Record<GoalField, { resolves: string[]; question: string; reason: string }> = {
  outcomeStatement: {
    resolves: ['business_outcome'],
    question: '¿Qué resultado concreto del negocio te gustaría mejorar o validar, sin decidir todavía la solución?',
    reason: 'Necesitamos una dirección de negocio antes de proponer un experimento o una iniciativa.',
  },
  contextSummary: {
    resolves: ['business_context'],
    question: '¿Qué información de tu situación explica por qué merece atención este objetivo ahora?',
    reason: 'Conectar la oportunidad con el contexto permite dimensionar el esfuerzo sin asumir causas o recursos.',
  },
  decisionToEnable: {
    resolves: ['decision_to_enable'],
    question: '¿Qué decisión quieres poder tomar cuando tengas evidencia de esta oportunidad?',
    reason: 'Definir la decisión evita probar tecnología o acciones que no muevan el objetivo.',
  },
  businessSignalValue: {
    resolves: ['business_signal'],
    question: '¿Qué señal observable te ayudaría a distinguir si avanzas? Puedes dejarla pendiente.',
    reason: 'Una señal ayuda a aprender sin presentar un KPI, meta o beneficio no demostrado.',
  },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function clean(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function hasOutcome(value: string | null): boolean {
  const normalized = clean(value).toLowerCase();
  return Boolean(normalized) && !['resultado de negocio por definir', 'portfolio intent pending clarification'].includes(normalized);
}

function unknownFields(sourceRefs: unknown): GoalField[] {
  const raw = record(record(sourceRefs).objectiveConversation).unknownFields;
  return Array.isArray(raw) ? fields.filter((field) => raw.includes(field)) : [];
}

function confirmedSituation(review: GoalPlanContextReview | null): { quote: string; evidence: GoalQuestionEvidence } | null {
  if (review?.status !== 'confirmed' || !review.effectiveContext) return null;
  const quote = clean(review.effectiveContext.situation?.value);
  if (!quote) return null;
  return {
    quote: quote.slice(0, 2_000),
    evidence: {
      kind: 'confirmed_context',
      reviewId: review.id,
      reviewVersion: review.version,
      fieldPath: 'situation',
      quote: quote.slice(0, 2_000),
    },
  };
}

export function buildGoalQuestionPlan(input: {
  sessionId: string;
  anchor: GoalPlanAnchor;
  contextReview: GoalPlanContextReview | null;
}): GoalQuestionPlan {
  const { sessionId, anchor, contextReview } = input;
  const source = confirmedSituation(contextReview);
  const unknown = unknownFields(anchor.sourceRefs);
  const base = {
    mode: 'deterministic_preview' as const,
    sessionId,
    anchorVersion: anchor.version,
    contextReviewVersion: source ? contextReview!.version : null,
    unknownFields: unknown,
  };

  if (anchor.status === 'anchor_confirmed' || anchor.status === 'anchor_conflicting') {
    return {
      ...base,
      status: 'blocked',
      activeQuestion: null,
      reason: 'La confirmación o el conflicto requiere una revisión humana; no se genera otra pregunta.',
    };
  }

  const meta = record(record(anchor.sourceRefs).objectiveConversation);
  const pendingMeasure = meta.pendingClarification === 'businessSignalMeasure'
    && !unknown.includes('businessSignalValue');
  const need: GoalField[] = [];
  if (!hasOutcome(anchor.outcomeStatement) && !unknown.includes('outcomeStatement')) need.push('outcomeStatement');
  // Prioritize a decision before restating known E1 context, but never copy it
  // silently into the Anchor: the person must still accept the E2 summary.
  const ordered: GoalField[] = source
    ? ['decisionToEnable', 'contextSummary', 'businessSignalValue']
    : ['contextSummary', 'decisionToEnable', 'businessSignalValue'];
  for (const field of ordered) {
    const missing = field === 'businessSignalValue'
      ? !clean(anchor.businessSignalValue)
      : !clean(anchor[field]);
    if (missing && !unknown.includes(field)) need.push(field);
  }

  const field = pendingMeasure ? 'businessSignalValue' : need[0] ?? null;
  if (!field) {
    return {
      ...base,
      status: unknown.length ? 'review_required_with_unknowns' : 'ready_for_human_review',
      activeQuestion: null,
      reason: unknown.length
        ? 'Quedan incertidumbres declaradas para revisión; el sistema no las convierte en hechos.'
        : 'Los datos disponibles permiten mostrar una ficha para revisión; solo la persona puede confirmar el Anchor.',
    };
  }

  const definition = pendingMeasure ? {
    resolves: ['business_signal_measure'],
    question: '¿Para esta señal te resulta más útil seguir un número de casos o una proporción con denominador?',
    reason: 'Precisar la unidad evita atribuir significado a una conversión que todavía no se ha definido.',
  } : definitions[field];

  const recapSource = source?.quote || clean(anchor.contextSummary);
  const recap = recapSource
    ? `Contexto disponible: ${recapSource.slice(0, 180)}${recapSource.length > 180 ? '…' : ''}`
    : 'Todavía estamos aclarando el objetivo sin dar por ciertos datos no aportados.';
  return {
    ...base,
    status: unknown.length ? 'review_required_with_unknowns' : 'question_required',
    activeQuestion: {
      id: `goal-preview-${anchor.id}-v${anchor.version}-${pendingMeasure ? 'measure' : field}`,
      field,
      question: definition.question,
      reasonToAsk: definition.reason,
      resolves: definition.resolves,
      recap,
      provenance: source ? [source.evidence] : [],
    },
    reason: 'Pregunta de revisión propuesta a partir de campos pendientes y contexto E1 confirmado; no es inferencia de un modelo.',
  };
}
