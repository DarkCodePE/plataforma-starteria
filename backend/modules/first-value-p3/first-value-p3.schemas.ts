import { z } from 'zod';

const id = z.string().trim().min(1).max(120);
const text = (max: number) => z.string().trim().min(1).max(max);

export const firstValueP3InputSchema = z.object({
  sessionId: id,
  requestId: id,
  p2Confirmed: z.boolean(),
  goal: text(4000),
  context: text(4000).optional(),
  initiatives: z.array(z.object({
    itemId: id,
    name: text(500),
    description: text(4000).optional(),
    declaredOwnerMention: text(300).optional(),
    declaredDependencies: z.array(text(500)).max(30).optional(),
  }).strict()).min(1).max(100),
  clarifications: z.array(z.object({
    id,
    affectedItemIds: z.array(id).min(1).max(100),
    answer: text(2000),
  }).strict()).max(100).optional(),
}).strict().superRefine((input, ctx) => {
  const ids = input.initiatives.map((item) => item.itemId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['initiatives'], message: 'Los itemId deben ser únicos.' });
  }
  const clarificationIds = input.clarifications?.map((clarification) => clarification.id) ?? [];
  if (new Set(clarificationIds).size !== clarificationIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clarifications'], message: 'Los IDs de aclaración deben ser únicos.' });
  }
  const submittedIds = new Set(ids);
  input.clarifications?.forEach((clarification, index) => {
    if (!clarification.affectedItemIds.every((itemId) => submittedIds.has(itemId))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clarifications', index, 'affectedItemIds'], message: 'La aclaración debe apuntar a iniciativas enviadas.' });
    }
  });
  const secretKeys = /^(authorization|password|passwd|token|accessToken|refreshToken|apiKey|secret|credential)$/i;
  const credentialValue = /(?:\bBearer\s+[A-Za-z0-9._~-]{12,}|\bsk-[A-Za-z0-9_-]{16,}|\bAKIA[0-9A-Z]{16}\b|\b(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+)/i;
  const visit = (value: unknown, path: (string | number)[] = []) => {
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, [...path, index]));
    else if (typeof value === 'string' && credentialValue.test(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'No se permiten credenciales en el payload.' });
    else if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) {
        if (secretKeys.test(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, key], message: 'No se permiten credenciales en el payload.' });
        visit(nested, [...path, key]);
      }
    }
  };
  visit(input);
});

export type FirstValueP3Input = z.infer<typeof firstValueP3InputSchema>;
export const P3_DISPOSITIONS = ['DIRECT_CONTRIBUTION', 'NEEDS_CONTEXT', 'POSSIBLE_OTHER_PRIORITY'] as const;
