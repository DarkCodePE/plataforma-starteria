import { z } from 'zod/v3';

export const createInitialReviewSchema = z.object({
  originalInput: z.string().trim().min(40, 'Agrega un poco mas de contexto para revisar tu propuesta.').max(8000),
  addedContext: z.array(z.string().max(8000)).max(20).optional(),
  sourceFileIds: z.array(z.string().max(120)).max(20).optional(),
  challengeId: z.string().max(120).optional(),
  companyContext: z.object({
    companyId: z.string().min(1),
    areaId: z.string().min(1).optional(),
  }).optional(),
});
export type CreateInitialReviewInput = z.infer<typeof createInitialReviewSchema>;

// ADR-026 v2: refinables por focusSection (excluye 'routePreview' canónica y 'questions'
// para no borrar respuestas). Debe coincidir con SnapshotSectionId de snapshot-diff.ts.
export const REFINABLE_SECTIONS = ['understanding', 'challengeType', 'critique', 'improvedProposal'] as const;

export const addContextSchema = z.object({
  context: z.string().trim().min(1, 'Falta el contexto a agregar.').max(8000),
  focusSection: z.enum(REFINABLE_SECTIONS).optional(),
});
export type AddContextInput = z.infer<typeof addContextSchema>;

export const confirmRouteSchema = z.object({
  snapshotId: z.string().max(120).optional(),
});
export type ConfirmRouteInput = z.infer<typeof confirmRouteSchema>;

export const strategicAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        id: z.string().min(1),
        answer: z.string().max(2000).optional(),
        unknown: z.boolean().optional(),
      }),
    )
    .min(1, 'Envia al menos una respuesta.')
    .max(10),
});
export type StrategicAnswersInput = z.infer<typeof strategicAnswersSchema>;
