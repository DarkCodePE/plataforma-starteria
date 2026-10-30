import { z } from 'zod/v3';

export const createEvidenceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['Imagen', 'PDF', 'Video', 'Link', 'Otro']),
  size: z.string().optional(),
  url: z.string().url().optional(),
  stepRef: z.number().int().min(1).max(4),
  moduleRef: z.string().optional(),
});

export const updateEvidenceStatusSchema = z.object({
  status: z.enum(['Subida', 'Verificada', 'Rechazada']),
});

export const evidenceParams = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
});

export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type UpdateEvidenceStatusInput = z.infer<typeof updateEvidenceStatusSchema>;
