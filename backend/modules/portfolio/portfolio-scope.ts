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
 * - sin acceso de portafolio (participante, colaborador, mentor…): sin cambios. Esas mismas rutas GET
 *   alimentan la bandeja de retos del participante (ParticipantChallengeDetailPage filtra después
 *   los publicados), y filtrarlas rompería las convocatorias abiertas. Es la deuda declarada de
 *   ADR-028/029, Issue #161: se cierra con un endpoint de participante, no acá.
 *
 * Transición: un frente **sin organización** (datos anteriores a este cambio) sigue visible para
 * cualquiera con acceso al portafolio, igual que antes. Así nadie pierde datos al desplegar; lo que
 * se crea desde ahora queda en la organización de quien lo crea y deja de verse fuera de ella.
 */
export interface PortfolioScope {
  all: boolean;
  organizationIds: string[];
}

type ScopeUser = { id: string; role?: string | null; organizationId?: string | null; permissions?: ReadonlySet<string> };

export async function resolvePortfolioScope(prisma: any, user: ScopeUser): Promise<PortfolioScope> {
  if (user.role === 'admin') return { all: true, organizationIds: [] };
  if (user.permissions && !user.permissions.has('portfolio:read')) return { all: true, organizationIds: [] };
  // Sin cliente (p. ej. un servicio de prueba) no hay organizaciones que leer: el alcance queda
  // vacío —sólo frentes sin organización—, nunca abierto.
  if (!prisma) return { all: false, organizationIds: [] };
  const [record, memberships, grants] = await Promise.all([
    user.organizationId !== undefined
      ? Promise.resolve({ organizationId: user.organizationId })
      : prisma.user?.findUnique?.({ where: { id: user.id }, select: { organizationId: true } }),
    prisma.organizationMember?.findMany?.({ where: { userId: user.id }, select: { organizationId: true } }) ?? [],
    prisma.organizationPortfolioAccessGrant?.findMany?.({ where: { userId: user.id }, select: { organizationId: true } }) ?? [],
  ]);
  const ids = new Set<string>();
  if (record?.organizationId) ids.add(record.organizationId);
  for (const row of [...(memberships ?? []), ...(grants ?? [])]) if (row?.organizationId) ids.add(row.organizationId);
  return { all: false, organizationIds: [...ids] };
}

/** `where` de Prisma para StrategicFront dentro del alcance (incluye los frentes sin organización). */
export function frontScopeWhere(scope: PortfolioScope): Record<string, unknown> {
  if (scope.all) return {};
  return { OR: [{ organizationId: { in: scope.organizationIds } }, { organizationId: null }] };
}

/** Organización por defecto de un frente nuevo: la primaria de quien lo crea. */
export async function defaultOrganizationId(prisma: any, userId: string | undefined): Promise<string | null> {
  if (!userId || !prisma) return null;
  const record = await prisma.user?.findUnique?.({ where: { id: userId }, select: { organizationId: true } });
  return record?.organizationId ?? null;
}
