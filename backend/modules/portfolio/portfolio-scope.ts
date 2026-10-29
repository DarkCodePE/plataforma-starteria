/**
 * Alcance organizacional de las lecturas de portafolio.
 *
 * Las listas de portafolio (frentes, Portfolio Home, capacidad, aprendizajes) no filtraban por
 * organización: un Portfolio Lead veía los frentes de todas las organizaciones. Este módulo define
 * qué organizaciones puede leer una persona:
 *
 * - `admin` de plataforma: todas.
 * - con acceso de portafolio (`portfolio:read`, p. ej. portfolio_lead): su organización primaria
 *   (`User.organizationId`, ADR-022), las organizaciones donde es miembro (`OrganizationMember`) y
 *   las que le dieron acceso de portafolio (`OrganizationPortfolioAccessGrant`).
 * - sin acceso de portafolio (participante, colaborador, mentor…): las mismas organizaciones,
 *   resueltas igual. Antes recibían alcance global (deuda #161) porque estas rutas GET alimentan
 *   la bandeja de retos del participante; eso exponía los frentes de todas las organizaciones a
 *   cualquier cuenta (auditoría E2E F-01). La bandeja sigue funcionando con los retos de su
 *   organización y los frentes sin organización.
 *
 * Un frente sin organización falla cerrado. Los datos legacy requieren reconciliación explícita;
 * no se publican implícitamente a todos los tenants.
 */
import { logger } from '../../shared/utils/logger';

export interface PortfolioScope {
  all: boolean;
  organizationIds: string[];
}

type ScopeUser = { id: string; role?: string | null; organizationId?: string | null; permissions?: ReadonlySet<string> };

export async function resolvePortfolioScope(prisma: any, user: ScopeUser): Promise<PortfolioScope> {
  if (user.role === 'admin') return { all: true, organizationIds: [] };
  // Sin cliente (p. ej. un servicio de prueba) no hay organizaciones que leer: el alcance queda
  // vacío —sólo frentes sin organización—, nunca abierto.
  if (!prisma) return { all: false, organizationIds: [] };
  // Cada fuente de organizaciones es opcional: si una consulta falla (p. ej. la tabla de grants
  // no existe en una base cuyo schema no se sincronizó), se ignora esa fuente y se sigue con las
  // demás. Un alcance más chico es preferible a un 500 en todo el portafolio.
  const safe = async (label: string, run: () => Promise<any> | undefined): Promise<any> => {
    try {
      return (await run()) ?? null;
    } catch (err) {
      logger.warn({ err, source: label, userId: user.id }, '[portfolio-scope] fuente de organizaciones no disponible');
      return null;
    }
  };
  const [record, memberships, grants] = await Promise.all([
    user.organizationId !== undefined
      ? Promise.resolve({ organizationId: user.organizationId })
      : safe('user', () => prisma.user?.findUnique?.({ where: { id: user.id }, select: { organizationId: true } })),
    safe('organizationMember', () => prisma.organizationMember?.findMany?.({ where: { userId: user.id }, select: { organizationId: true } })),
    safe('organizationPortfolioAccessGrant', () => prisma.organizationPortfolioAccessGrant?.findMany?.({ where: { userId: user.id }, select: { organizationId: true } })),
  ]);
  const ids = new Set<string>();
  if (record?.organizationId) ids.add(record.organizationId);
  for (const row of [...(memberships ?? []), ...(grants ?? [])]) if (row?.organizationId) ids.add(row.organizationId);
  return { all: false, organizationIds: [...ids] };
}

/**
 * Write scope is intentionally narrower than read scope. A secondary membership
 * may grant visibility, but mutation requires a target-scoped `portfolio:write`
 * grant. The primary organization remains the default tenant for a platform
 * Portfolio Lead; admin keeps the explicit platform bypass.
 */
export async function resolvePortfolioWriteScope(prisma: any, user: ScopeUser): Promise<PortfolioScope> {
  if (user.role === 'admin') return { all: true, organizationIds: [] };
  if (!prisma) return { all: false, organizationIds: [] };
  const record = user.organizationId !== undefined
    ? { organizationId: user.organizationId }
    : await prisma.user?.findUnique?.({ where: { id: user.id }, select: { organizationId: true } });
  const grants = await prisma.organizationPortfolioAccessGrant?.findMany?.({
    where: { userId: user.id, capability: 'portfolio:write' },
    select: { organizationId: true },
  }) ?? [];
  const ids = new Set<string>();
  if (record?.organizationId) ids.add(record.organizationId);
  for (const grant of grants) if (grant?.organizationId) ids.add(grant.organizationId);
  return { all: false, organizationIds: [...ids] };
}

/** `where` de Prisma para StrategicFront dentro del alcance. */
export function frontScopeWhere(scope: PortfolioScope): Record<string, unknown> {
  if (scope.all) return {};
  return { organizationId: { in: scope.organizationIds } };
}

/** Organización por defecto de un frente nuevo: la primaria de quien lo crea. */
export async function defaultOrganizationId(prisma: any, userId: string | undefined): Promise<string | null> {
  if (!userId || !prisma) return null;
  const record = await prisma.user?.findUnique?.({ where: { id: userId }, select: { organizationId: true } });
  return record?.organizationId ?? null;
}
