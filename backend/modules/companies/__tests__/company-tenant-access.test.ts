import { describe, expect, it, vi } from 'vitest';
import { CompanyService } from '../company.service';

const organizationCompany = {
  id: 'company-a',
  organizationId: 'org-a',
  ownerUserId: null,
  scope: 'ORGANIZATION',
  deletedAt: null,
  memberships: [],
};

function prisma(actorOrganizationId: string) {
  const db: any = {
    company: {
      findUnique: vi.fn().mockResolvedValue(organizationCompany),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: actorOrganizationId }),
    },
    companyMembership: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  };
  return db;
}

describe('CompanyService tenant and child-resource guards', () => {
  it('allows an admin only inside the canonical organization', async () => {
    await expect(new CompanyService(prisma('org-a')).get({ id: 'admin-a', role: 'admin' }, 'company-a'))
      .resolves.toMatchObject({ id: 'company-a' });
    await expect(new CompanyService(prisma('org-b')).get({ id: 'admin-b', role: 'admin' }, 'company-a'))
      .rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
  });

  it('does not let a child membership id escape the company in the route', async () => {
    const db = prisma('org-a');
    await expect(new CompanyService(db).updateMembership(
      { id: 'admin-a', role: 'admin' },
      'company-a',
      'membership-from-company-b',
      { role: 'VIEWER', status: 'APPROVED' } as any,
    )).rejects.toMatchObject({ code: 'COMPANY_MEMBERSHIP_NOT_FOUND' });
    expect(db.companyMembership.update).not.toHaveBeenCalled();
  });
});
