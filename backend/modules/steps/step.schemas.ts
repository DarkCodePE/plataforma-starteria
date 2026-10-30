import { z } from 'zod/v3';

export const stepParams = z.object({
  projectId: z.string().uuid(),
  number: z.coerce.number().int().min(1).max(4),
});

export const updateStepStatusSchema = z.object({
  status: z.enum([
    'No iniciado', 'En progreso', 'Enviado',
    'Feedback IA', 'Ajustado', 'Sesion experto pendiente',
    'Aprobado', 'Bloqueado',
  ]),
});

export const updateModuleSchema = z.object({
  status: z.enum([
    'Draft', 'En progreso', 'Completado', 'Bloqueado',
    'Enviado', 'Feedback IA', 'Ajustado', 'Aprobado',
  ]).optional(),
  data: z.record(z.unknown()).optional(),
});

/**
 * Per-step save schemas (TASK-010).
 *
 * Today Steps 2/3/4 store form data as opaque JSON blobs in `Step.stepData`
 * (polymorphic Json column already present in Prisma schema). We accept any
 * object shape but require an envelope with optional `_meta` + `formData` keys
 * matching the precedent set by Step 1 (Step1Page.tsx line ~506).
 *
 * TODO(SPEC-002): normalize step{2,3,4}FormData to typed columns for queryability
 * once the autofill agent settles on a stable contract. Until then we accept any
 * shape so the React form state can evolve without round-trip migrations.
 */
const stepEnvelope = z.object({
  _meta: z
    .object({
      version: z.number().int().nonnegative().optional(),
      lastSavedAt: z.string().optional(),
      lastSavedBy: z.string().optional(),
    })
    .partial()
    .optional(),
  formData: z.record(z.unknown()).optional(),
}).passthrough();

export const saveStep1DataSchema = stepEnvelope;
export const saveStep2DataSchema = stepEnvelope;
export const saveStep3DataSchema = stepEnvelope;
export const saveStep4DataSchema = stepEnvelope;

/** Generic, used by the controller as a runtime dispatch table. */
export const saveStepDataSchemaByNumber: Record<number, z.ZodTypeAny> = {
  1: saveStep1DataSchema,
  2: saveStep2DataSchema,
  3: saveStep3DataSchema,
  4: saveStep4DataSchema,
};

/** Legacy schema kept for back-compat — accepts any record. */
export const saveStepDataSchema = z.record(z.unknown());

export const submitAiReviewSchema = z.object({
  stepNumber: z.number().int().min(1).max(4).optional(),
});

export const requestSessionSchema = z.object({
  preferredDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type UpdateStepStatusInput = z.infer<typeof updateStepStatusSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
