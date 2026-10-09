/**
 * workspaces.ts — las dos superficies de Starteria y cómo se elige entre ellas (ADR-029).
 *
 * Antes la zona se IMPONÍA: `AppLayout` redirigía a /portfolio a todo usuario cuyo rol
 * primario fuera `portfolio_lead`, y quien fuera las dos cosas quedaba encerrado.
 * Ahora la zona se ELIGE, y las opciones salen de los permisos.
 */
import { can, type Permission } from './permissions';

export type WorkspaceId = 'iniciativas' | 'portafolio';

export interface Workspace {
  id: WorkspaceId;
  label: string;
  path: string;
  /**
   * Permiso que da acceso a la zona. `null` = disponible para todo autenticado.
   */
  permission: Permission | null;
}

export const WORKSPACES: readonly Workspace[] = [
  {
    id: 'iniciativas',
    label: 'Mis iniciativas',
    path: '/dashboard',
    /**
     * SIN permiso a propósito: es la zona por defecto de la plataforma.
     *
     * Gatearla con `project:own` dejaría a mentor y sponsor SIN NINGUNA zona — no
     * tienen ese permiso ni `portfolio:read`, pero hoy viven bajo `AppLayout` y su
     * navegación no debe cambiar. Lo que este ADR arregla es el encierro en
     * portafolio, no a quién se le da el workspace.
     */
    permission: null,
  },
  {
    id: 'portafolio',
    label: 'Portafolio',
    path: '/portfolio/inicio',
    permission: 'portfolio:read',
  },
];

const CLAVE_ULTIMA_ZONA = 'starteria.workspace';

type UsuarioConPermisos = { permissions?: readonly string[] | null } | null | undefined;

/** Las zonas a las que este usuario puede entrar, en orden estable. */
export function availableWorkspaces(user: UsuarioConPermisos): Workspace[] {
  return WORKSPACES.filter((w) => w.permission === null || can(user, w.permission));
}

/**
 * ¿Se muestra el switcher? Sólo si hay algo entre lo que elegir.
 *
 * Quien pertenece a una sola superficie no ve UI nueva y su experiencia no cambia
 * en absoluto — que es la mitad silenciosa de este cambio.
 */
export function shouldShowSwitcher(user: UsuarioConPermisos): boolean {
  return availableWorkspaces(user).length > 1;
}

/** Recuerda la zona elegida. Un fallo de storage no debe romper la navegación. */
export function rememberWorkspace(id: WorkspaceId): void {
  try {
    window.localStorage.setItem(CLAVE_ULTIMA_ZONA, id);
  } catch {
    // Modo privado o storage lleno: se pierde la preferencia, no la navegación.
  }
}

/**
 * La zona con la que arranca el usuario: la última que usó, si aún puede entrar.
 *
 * Degrada SIEMPRE a una zona permitida. Un `localStorage` con basura, o que apunte
 * a una zona a la que ya no tiene acceso (porque le retiraron el rol), no puede
 * dejar a nadie sin navegación — que es el modo en que un switcher se convierte
 * en una jaula nueva.
 */
export function resolveInitialWorkspace(user: UsuarioConPermisos): Workspace {
  const disponibles = availableWorkspaces(user);
  // Sin preferencia, quien entra a portafolio pero no es dueño de iniciativas arranca en
  // portafolio: no está en el equipo de ninguna, y "Mis iniciativas" le saldría vacío.
  const portafolio = disponibles.find((w) => w.id === 'portafolio');
  const fallback =
    (portafolio && !can(user, 'project:own') ? portafolio : disponibles[0]) ?? WORKSPACES[0];

  let guardada: string | null = null;
  try {
    guardada = window.localStorage.getItem(CLAVE_ULTIMA_ZONA);
  } catch {
    return fallback;
  }

  return disponibles.find((w) => w.id === guardada) ?? fallback;
}
