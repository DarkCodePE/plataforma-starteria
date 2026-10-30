import { describe, expect, it, vi } from 'vitest';
import {
  assertProjectTeamAccess,
  requireProjectTeamAccess,
  type ProjectTeamNeed,
} from '../project-team-access';

const check = (
  platformRole: string,
  teamRole: string | null,
  need: ProjectTeamNeed,
  options: { isAssignedPortfolioLead?: boolean; isAssignedMentor?: boolean; sameOrganization?: boolean; teamStatus?: string } = {},
) => {
  try {
    assertProjectTeamAccess({
      platformRole,
      teamRole,
      teamStatus: options.teamStatus ?? (teamRole ? 'ACTIVE' : null),
      isAssignedPortfolioLead: options.isAssignedPortfolioLead ?? false,
      isAssignedMentor: options.isAssignedMentor ?? false,
      sameOrganization: options.sameOrganization ?? true,
      need,
    });
    return 'ok';
  } catch (err) {
    return (err as { code: string }).code;
  }
};

describe('assertProjectTeamAccess', () => {
  it.each([
    ['OWNER', 'read', 'ok'], ['OWNER', 'write', 'ok'], ['OWNER', 'manage', 'ok'],
    ['EDITOR', 'read', 'ok'], ['EDITOR', 'write', 'ok'], ['EDITOR', 'manage', 'PROJECT_OWNER_REQUIRED'],
    ['VIEWER', 'read', 'ok'], ['VIEWER', 'write', 'PROJECT_TEAM_ROLE_REQUIRED'], ['VIEWER', 'manage', 'PROJECT_OWNER_REQUIRED'],
  ] as const)('%s in the team, %s -> %s', (teamRole, need, expected) => {
    expect(check('participante', teamRole, need)).toBe(expected);
  });

  it('does not let a platform role elevate a team role', () => {
    expect(check('sponsor', 'VIEWER', 'write')).toBe('PROJECT_TEAM_ROLE_REQUIRED');
  });

  it('lets the assigned Portfolio Lead read but never write team work', () => {
    expect(check('portfolio_lead', null, 'read', { isAssignedPortfolioLead: true })).toBe('ok');
    expect(check('portfolio_lead', null, 'write', { isAssignedPortfolioLead: true })).toBe('PROJECT_TEAM_ACCESS_REQUIRED');
    expect(check('participante', null, 'read')).toBe('PROJECT_ACCESS_DENIED');
  });

  it('keeps a pending invite outside corporate Project data', () => {
    expect(check('participante', 'EDITOR', 'read', { teamStatus: 'PENDING' })).toBe('TEAM_MEMBERSHIP_INACTIVE');
    expect(check('participante', 'EDITOR', 'write', { teamStatus: 'PENDING' })).toBe('TEAM_MEMBERSHIP_INACTIVE');
  });

  it('requires a same-tenant assignment for mentors', () => {
    expect(check('mentor', null, 'read')).toBe('PROJECT_ACCESS_DENIED');
    expect(check('mentor', null, 'write', { isAssignedMentor: true })).toBe('ok');
    expect(check('mentor', null, 'manage', { isAssignedMentor: true })).toBe('PROJECT_OWNER_REQUIRED');
    expect(check('mentor', null, 'read', { isAssignedMentor: true, sameOrganization: false })).toBe('PROJECT_NOT_FOUND');
  });

  it('limits admin to its canonical tenant', () => {
    expect(check('admin', null, 'manage')).toBe('ok');
    expect(check('admin', null, 'read', { sameOrganization: false })).toBe('PROJECT_NOT_FOUND');
  });
});

describe('requireProjectTeamAccess', () => {
  const prisma = (input: {
    teamRole?: string | null;
    teamStatus?: string;
    projectOrganizationId?: string | null;
    userOrganizationId?: string | null;
    assignedMentor?: boolean;
    assignedLead?: boolean;
  } = {}) => ({
    project: { findUnique: vi.fn().mockResolvedValue({ organizationId: input.projectOrganizationId ?? 'org-a' }) },
    user: { findUnique: vi.fn().mockResolvedValue({ organizationId: input.userOrganizationId ?? 'org-a' }) },
    teamMember: { findFirst: vi.fn().mockResolvedValue(input.teamRole ? { role: input.teamRole, status: input.teamStatus ?? 'ACTIVE' } : null) },
    initiativeGovernance: { findUnique: vi.fn().mockResolvedValue(input.assignedLead ? { portfolioLeadUserId: 'u1' } : null) },
    mentorSession: { findFirst: vi.fn().mockResolvedValue(input.assignedMentor ? { id: 'ms-1' } : null) },
  }) as any;

  const run = async (db: any, need: ProjectTeamNeed, role = 'participante', param = 'id') => {
    const next = vi.fn();
    await requireProjectTeamAccess(db, need, param)(
      { params: { [param]: 'p1' }, user: { id: 'u1', role } } as any,
      {} as any,
      next,
    );
    return next.mock.calls[0]?.[0];
  };

  it('checks canonical tenant and active team role for the route Project', async () => {
    const db = prisma({ teamRole: 'EDITOR' });
    expect(await run(db, 'write', 'participante', 'projectId')).toBeUndefined();
    expect(db.project.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' }, select: { organizationId: true } });
    expect(db.teamMember.findFirst).toHaveBeenCalledWith({ where: { projectId: 'p1', userId: 'u1' }, select: { role: true, status: true } });
  });

  it('returns a generic not-found for a cross-tenant Project', async () => {
    await expect(run(prisma({ teamRole: 'OWNER', userOrganizationId: 'org-b' }), 'read'))
      .resolves.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('allows only an explicitly assigned mentor', async () => {
    expect(await run(prisma({ assignedMentor: true }), 'write', 'mentor')).toBeUndefined();
    await expect(run(prisma(), 'write', 'mentor')).resolves.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('passes role errors to next instead of throwing', async () => {
    await expect(run(prisma({ teamRole: 'VIEWER' }), 'manage')).resolves.toMatchObject({ code: 'PROJECT_OWNER_REQUIRED' });
  });
});
