import type { PortfolioEntryBriefIdentity } from '../../portfolio-entry/public/types';

export type ConfirmedBrief = {
  source: 'portfolio_entry'; sessionId: string; revision: number; handoffId: string; handoffVersion: number;
  confirmationId: string; confirmationVersion: number;
  brief: { rawEntry?: string; handoff: Record<string, unknown>; confirmation: {
    status: 'CONFIRMED'; acceptedFields: string[]; correctedFields: Record<string, unknown>; rejectedFields: string[];
  } };
};

export type StrategicIntentProjection = {
  goal?: string; situation?: string; decisionToEnable?: string; knownContext?: string;
  approachHypothesis?: string; openQuestions: string[]; provenance: PortfolioEntryBriefIdentity;
};

const fields = ['desired_outcome', 'understanding', 'understood_need', 'decision_to_enable', 'known_context', 'unresolved_context', 'evidence_or_clarity_needed', 'recommended_approach'];
const nonempty = (value: unknown): string | undefined => {
  const text = typeof value === 'string'
    ? value
    : value && typeof value === 'object' && 'value' in value && typeof value.value === 'string'
      ? value.value
      : undefined;
  return text?.trim() || undefined;
};

export function projectStrategicIntent(brief: ConfirmedBrief): StrategicIntentProjection {
  const { handoff, confirmation } = brief.brief;
  const accepted = new Set(confirmation.acceptedFields);
  const rejected = new Set(confirmation.rejectedFields);
  for (const key of fields) if ((accepted.has(key) && rejected.has(key)) || (key in confirmation.correctedFields && rejected.has(key))) throw new Error('INVALID_CONFIRMATION_FOR_D2');
  const value = (key: string): unknown => key in confirmation.correctedFields ? confirmation.correctedFields[key] : accepted.has(key) ? handoff[key] : undefined;
  const questions = [value('unresolved_context'), value('evidence_or_clarity_needed')].flatMap(v => Array.isArray(v) ? v : [v]).map(nonempty).filter((v): v is string => !!v);
  const uniqueQuestions = [...new Set(questions)];
  return {
    goal: nonempty(value('desired_outcome')),
    situation: nonempty(value('understanding') ?? value('understood_need')),
    decisionToEnable: nonempty(value('decision_to_enable')),
    knownContext: nonempty(value('known_context')),
    approachHypothesis: nonempty(value('recommended_approach')),
    openQuestions: uniqueQuestions,
    provenance: { source: brief.source, sessionId: brief.sessionId, sessionRevision: brief.revision, handoffId: brief.handoffId, handoffVersion: brief.handoffVersion, confirmationId: brief.confirmationId, confirmationVersion: brief.confirmationVersion },
  };
}

export function serializeStrategicContext(p: StrategicIntentProjection): string {
  const lines: string[] = [];
  if (p.situation) lines.push(`Situación actual:\n${p.situation}`);
  if (p.decisionToEnable) lines.push(`Decisión que quiero preparar:\n${p.decisionToEnable}`);
  if (p.knownContext) lines.push(`Contexto conocido:\n${p.knownContext}`);
  if (p.approachHypothesis) lines.push(`Una vía que merece explorar:\n${p.approachHypothesis}`);
  if (p.openQuestions.length) lines.push(`Todavía necesito aclarar:\n${p.openQuestions.map(q => `- ${q}`).join('\n')}`);
  return lines.join('\n\n');
}
