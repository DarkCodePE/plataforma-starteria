import type { PortfolioEntryHandoff, PortfolioEntrySessionDto } from './types';

const paths: Record<string, string> = {
  'desired_outcome': 'desired_outcome.value',
  'understood_need': 'understanding.value',
  'understanding': 'understanding.value',
  'decision_to_enable': 'decision_to_enable.value',
  'known_context': 'known_context',
  'recommended_approach': 'recommended_approach.description',
};

function approvedValue(session: PortfolioEntrySessionDto, field: string): boolean {
  const confirmation = session.confirmation;
  const path = paths[field] ?? field;
  return Boolean(confirmation?.acceptedFields.includes(field) || confirmation?.acceptedFields.includes(path)
    || (field === 'understood_need' && confirmation?.acceptedFields.includes('understanding'))
    || Object.keys(confirmation?.correctedFields ?? {}).some((key) => key === field || key === path || key.startsWith(`${field}.`)));
}

function valueAt(handoff: PortfolioEntryHandoff, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, handoff);
}

function stringify(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string' && value.value.trim()) return value.value.trim();
  if (value && typeof value === 'object' && 'description' in value && typeof value.description === 'string' && value.description.trim()) return value.description.trim();
  return undefined;
}

export function serializeConfirmedBriefMarkdown(session: PortfolioEntrySessionDto): { filename: string; markdown: string } {
  const handoff = session.handoff?.handoff;
  if (session.lifecycleStatus !== 'CONFIRMED' || session.confirmation?.status !== 'CONFIRMED' || !handoff) {
    throw new Error('Only a confirmed Brief can be exported.');
  }
  const corrected = session.confirmation.correctedFields;
  const sections = ['# Brief confirmado', ''];
  const add = (heading: string, field: string, path = paths[field] ?? field) => {
    if (!approvedValue(session, field)) return;
    const result = stringify(corrected[field] ?? corrected[path] ?? valueAt(handoff, path));
    if (result) sections.push(`## ${heading}`, '', result, '');
  };
  add('Qué quiero lograr', 'desired_outcome');
  add('Situación y entendimiento', 'understood_need');
  add('Decisión a preparar', 'decision_to_enable');
  if (approvedValue(session, 'known_context')) {
    const context = corrected.known_context ?? handoff.known_context;
    const lines = Array.isArray(context)
      ? context.map((item) => item && typeof item === 'object' ? `${String((item as { key?: unknown }).key ?? '')}: ${String((item as { value?: unknown }).value ?? '')}`.trim().replace(/^:\s*/, '') : String(item)).filter(Boolean)
      : [stringify(context)].filter((item): item is string => Boolean(item));
    if (lines.length) sections.push('## Contexto conocido', '', ...lines.map((line) => `- ${line}`), '');
  }
  add('Hipótesis de enfoque aceptada o corregida', 'recommended_approach');
  const open = [...handoff.unresolved_context.map((item) => item.description), ...handoff.evidence_or_clarity_needed.map((item) => item.value)];
  if (open.length) sections.push('## Preguntas y contexto aún abierto', '', ...open.map((item) => `- ${item}`), '');
  return { filename: `starteria-brief-r${session.revision}.md`, markdown: sections.join('\n').trimEnd() + '\n' };
}
