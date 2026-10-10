import { z } from 'zod';
import { PLATFORM_ROLES } from '../../shared/types/user.types';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  skills: z.array(z.string()).optional(),
  initials: z.string().length(2).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  // Sponsor no es un rol de equipo: entra como VIEWER (ver UserService.inviteMember).
  role: z.enum(['Owner', 'Editor', 'Viewer', 'Sponsor']).default('Editor'),
  name: z.string().min(2).max(100).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['Owner', 'Editor', 'Viewer']),
});

/**
 * ADR-028: asignación de rol de PLATAFORMA (los siete de `PLATFORM_ROLES`).
 * No confundir con `updateMemberRoleSchema`, que es el rol de PROYECTO
 * (`Owner | Editor | Viewer`) y vive en otro eje.
 */
/**
 * ADR-029: acepta `role` (un rol, semántica de siempre) o `roles` (el conjunto).
 * `roles` es lo que permite dar portfolio_lead SIN quitar participante — con el
 * escalar era imposible de expresar. `role` se mantiene para no romper a ningún
 * cliente existente y se interpreta como el conjunto de un solo elemento.
 */
export const updatePlatformRoleSchema = z
  .object({
    role: z.enum(PLATFORM_ROLES).optional(),
    roles: z.array(z.enum(PLATFORM_ROLES)).min(1).optional(),
  })
  .refine((d) => d.role !== undefined || d.roles !== undefined, {
    message: 'Indica `role` (un rol) o `roles` (el conjunto de roles).',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePlatformRoleInput = z.infer<typeof updatePlatformRoleSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
