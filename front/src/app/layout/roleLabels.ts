/**
 * roleLabels.ts — la etiqueta que se muestra del rol de plataforma (sidebar, perfil).
 *
 * `User.role` colapsa `participante`, `colaborador` y `viewer` en `owner` para los permisos de
 * pantalla, así que un viewer aparecía como "Participante". La etiqueta sale de
 * `User.platformRole` (el rol tal como lo manda el backend) mientras el rol interno siga siendo
 * `owner`; si el selector demo cambió el rol interno, manda ese.
 */
import type { User } from '../context/AppContext';

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Participante',
  mentor: 'Mentor',
  admin: 'Administrador',
  sponsor: 'Sponsor',
  portfolio_lead: 'Portfolio Lead',
};

const PLATFORM_ROLE_LABELS: Record<string, string> = {
  participante: 'Participante',
  colaborador: 'Colaborador',
  viewer: 'Lector',
};

export function userRoleLabel(user: Pick<User, 'role' | 'platformRole'> | null | undefined): string {
  const role = user?.role ?? 'owner';
  if (role === 'owner' && user?.platformRole && PLATFORM_ROLE_LABELS[user.platformRole]) {
    return PLATFORM_ROLE_LABELS[user.platformRole];
  }
  return ROLE_LABELS[role] ?? ROLE_LABELS.owner;
}
