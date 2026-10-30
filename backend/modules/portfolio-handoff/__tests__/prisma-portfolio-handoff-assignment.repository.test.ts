import { describe, expect, it, vi } from 'vitest';
import { PrismaPortfolioHandoffAssignmentRepository } from '../infrastructure/prisma-portfolio-handoff-assignment.repository';

describe('PrismaPortfolioHandoffAssignmentRepository tenant compatibility', () => {
  it.each([
    ['p12r1-http-org', 'legacy-p12-project'],
    ['p6-runtime-org', 'legacy-p6-project'],
  ])('does not infer canonical Project tenancy from orphan reference %s', async (orphanOrganizationId, projectId) => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: projectId,
          organizationId: null,
          owner: { organizationId: orphanOrganizationId },
          portfolioMeta: [{ challengeId: 'legacy-challenge' }],
        }),
      },
    };
    const repository = new PrismaPortfolioHandoffAssignmentRepository(prisma as any);

    await expect(repository.findInitiative(projectId)).resolves.toEqual({
      id: projectId,
      organizationId: null,
      challengeIds: ['legacy-challenge'],
    });
  });

  it('returns the explicit canonical organization for a migrated Project', async () => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: 'canonical-project', organizationId: 'org-canonical', portfolioMeta: [] }),
      },
    };
    const repository = new PrismaPortfolioHandoffAssignmentRepository(prisma as any);

    await expect(repository.findInitiative('canonical-project')).resolves.toMatchObject({ organizationId: 'org-canonical' });
  });
});
