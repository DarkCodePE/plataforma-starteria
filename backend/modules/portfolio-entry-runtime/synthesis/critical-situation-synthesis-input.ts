import { z } from 'zod';

const nonEmptyTextSchema = z.string().trim().min(1);

const userMessageSchema = z.object({
  id: nonEmptyTextSchema,
  text: nonEmptyTextSchema,
  turn_index: z.number().int().positive().optional(),
}).strict();

const userCorrectionSchema = z.object({
  id: nonEmptyTextSchema,
  text: nonEmptyTextSchema,
  corrects_ref: nonEmptyTextSchema.nullable().optional(),
  turn_index: z.number().int().positive().optional(),
}).strict();

const explicitlyProvidedContextSchema = z.object({
  ref: nonEmptyTextSchema,
  value: z.unknown(),
  provenance: z.unknown().optional(),
}).strict();

const authorizedInputSnapshotSchema = z.object({
  snapshot_id: nonEmptyTextSchema.nullable().optional(),
  captured_at: z.string().nullable().optional(),
}).strict();

export const criticalSituationSynthesisInputSchema = z.object({
  snapshot: authorizedInputSnapshotSchema.optional(),
  user_messages: z.array(userMessageSchema).default([]),
  user_corrections: z.array(userCorrectionSchema).default([]),
  explicitly_provided_context: z.array(explicitlyProvidedContextSchema).default([]),
  provisional_extracted_context: z.record(z.string(), z.unknown()).optional(),
  provisional_extracted_context_provenance: z.unknown().optional(),
  source_refs: z.array(nonEmptyTextSchema).default([]),
}).strict();

export type CriticalSituationSynthesisInput = z.input<typeof criticalSituationSynthesisInputSchema>;
export type CriticalSituationSynthesisInputSnapshot = z.infer<typeof criticalSituationSynthesisInputSchema>;

export type CriticalSituationSynthesisSnapshotItem = {
  ref: string;
  kind: 'user_message' | 'user_correction' | 'explicitly_provided_context' | 'provisional_extracted_context';
  content: unknown;
  corrects_ref?: string | null;
  provenance: unknown | null;
};

export type CriticalSituationSynthesisAuthorizedSnapshot = {
  snapshot_id: string | null;
  captured_at: string | null;
  source_refs: string[];
  items: CriticalSituationSynthesisSnapshotItem[];
  provisional_extracted_context: {
    values: Record<string, unknown>;
    provenance: unknown | null;
  } | null;
};

function provenanceForExtractedPath(rawProvenance: unknown, path: string): unknown | null {
  if (Array.isArray(rawProvenance)) {
    const exactPaths = new Set([path, `extracted_context.${path}`, `provisional_extracted_context.${path}`]);
    return rawProvenance.find((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const entryPath = (entry as Record<string, unknown>).path;
      return typeof entryPath === 'string' && exactPaths.has(entryPath);
    }) ?? null;
  }
  if (rawProvenance && typeof rawProvenance === 'object' && !Array.isArray(rawProvenance)) {
    const record = rawProvenance as Record<string, unknown>;
    const exact = record[path] ?? record[`extracted_context.${path}`] ?? record[`provisional_extracted_context.${path}`];
    return exact ?? null;
  }
  return null;
}

/**
 * Builds a narrow, allow-listed synthesis snapshot. This function accepts no
 * controller, planner, budget, handoff, connected-system, or organizational DB state.
 * Extracted values and their broad/unknown provenance are carried through verbatim;
 * neither receives an epistemic role here.
 */
export function normalizeCriticalSituationSynthesisInput(
  input: CriticalSituationSynthesisInput,
): CriticalSituationSynthesisAuthorizedSnapshot {
  const parsed = criticalSituationSynthesisInputSchema.parse(input);
  const sourceRefs = new Set(parsed.source_refs);
  const items: CriticalSituationSynthesisSnapshotItem[] = [];
  const orderedConversationItems: Array<{
    turnIndex: number;
    sourceOrder: number;
    item: CriticalSituationSynthesisSnapshotItem;
  }> = [];

  for (const [index, message] of parsed.user_messages.entries()) {
    const ref = `session.user_message:${message.id}`;
    sourceRefs.add(ref);
    orderedConversationItems.push({
      turnIndex: message.turn_index ?? index + 1,
      sourceOrder: index,
      item: {
        ref,
        kind: 'user_message',
        content: message.text,
        provenance: {
          origin: 'USER_DECLARED',
          review_disposition: 'UNREVIEWED',
        },
      },
    });
  }

  for (const [index, correction] of parsed.user_corrections.entries()) {
    const ref = `session.user_correction:${correction.id}`;
    sourceRefs.add(ref);
    orderedConversationItems.push({
      turnIndex: correction.turn_index ?? parsed.user_messages.length + index + 1,
      sourceOrder: parsed.user_messages.length + index,
      item: {
        ref,
        kind: 'user_correction',
        content: correction.text,
        corrects_ref: correction.corrects_ref,
        provenance: {
          origin: 'USER_DECLARED',
          review_disposition: 'UNREVIEWED',
        },
      },
    });
  }

  orderedConversationItems
    .sort((left, right) => left.turnIndex - right.turnIndex || left.sourceOrder - right.sourceOrder)
    .forEach(({ item }) => items.push(item));

  for (const context of parsed.explicitly_provided_context) {
    sourceRefs.add(context.ref);
    items.push({
      ref: context.ref,
      kind: 'explicitly_provided_context',
      content: context.value,
      provenance: context.provenance ?? null,
    });
  }

  for (const [path, value] of Object.entries(parsed.provisional_extracted_context ?? {})) {
    const ref = `provisional_extracted_context.${path}`;
    sourceRefs.add(ref);
    items.push({
      ref,
      kind: 'provisional_extracted_context',
      content: value,
      // Preserve only an explicitly path-scoped provenance record here. The full,
      // possibly broad provenance value remains on the snapshot below.
      provenance: provenanceForExtractedPath(parsed.provisional_extracted_context_provenance, path),
    });
  }

  return {
    snapshot_id: parsed.snapshot?.snapshot_id ?? null,
    captured_at: parsed.snapshot?.captured_at ?? null,
    source_refs: [...sourceRefs],
    items,
    provisional_extracted_context: parsed.provisional_extracted_context
      ? {
          values: parsed.provisional_extracted_context,
          provenance: parsed.provisional_extracted_context_provenance ?? null,
        }
      : null,
  };
}
