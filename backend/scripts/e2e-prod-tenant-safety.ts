import { createHash } from 'node:crypto';

type ExistingSyntheticUser = { id: string; organizationId: string | null } | null;
type ExistingMembership = { organizationId: string };
type CleanupProject = { id: string; name: string };

export function assertSafeE2eProdUserReuse(
  existing: ExistingSyntheticUser,
  memberships: ExistingMembership[],
  targetOrganizationId: string,
): void {
  if (!existing) return;
  const exclusivelyTargeted = existing.organizationId === targetOrganizationId
    && memberships.every((membership) => membership.organizationId === targetOrganizationId);
  if (!exclusivelyTargeted) {
    throw new Error('Refusing synthetic tenant takeover: existing identity is not exclusively scoped to org-e2e-prod.');
  }
}

export function protectedIdentityRef(email: string): string {
  const digest = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
  return `identity:${digest}`;
}

export function assertSyntheticCleanupProjects(projects: CleanupProject[]): void {
  const unsafe = projects.filter((project) => !project.name.startsWith('[E2E-PROD] ')
    && !project.name.startsWith('[E2E-SWARM] '));
  if (unsafe.length > 0) {
    throw new Error(`Refusing production cleanup: ${unsafe.length} project(s) lack an approved synthetic prefix.`);
  }
}
