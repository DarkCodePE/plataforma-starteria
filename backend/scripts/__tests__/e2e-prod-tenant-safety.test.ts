import { describe, expect, it } from 'vitest';
import { assertSafeE2eProdUserReuse, assertSyntheticCleanupProjects, protectedIdentityRef } from '../e2e-prod-tenant-safety';

describe('E2E production tenant identity safety', () => {
  it('allows a new identity and an identity already scoped only to the synthetic tenant', () => {
    expect(() => assertSafeE2eProdUserReuse(null, [], 'org-e2e-prod')).not.toThrow();
    expect(() => assertSafeE2eProdUserReuse(
      { id: 'user-1', organizationId: 'org-e2e-prod' },
      [{ organizationId: 'org-e2e-prod' }],
      'org-e2e-prod',
    )).not.toThrow();
  });

  it.each([
    [{ id: 'user-1', organizationId: 'customer-org' }, []],
    [{ id: 'user-1', organizationId: null }, []],
    [{ id: 'user-1', organizationId: 'org-e2e-prod' }, [{ organizationId: 'customer-org' }]],
  ])('rejects an existing identity that is not exclusively owned by the synthetic tenant', (user, memberships) => {
    expect(() => assertSafeE2eProdUserReuse(user, memberships, 'org-e2e-prod'))
      .toThrow(/refusing synthetic tenant takeover/i);
  });

  it('creates a stable non-PII reference for operator logs', () => {
    const ref = protectedIdentityRef('Authorized.Owner@pilot-mail.org');
    expect(ref).toMatch(/^identity:[a-f0-9]{12}$/);
    expect(ref).not.toContain('owner');
    expect(ref).toBe(protectedIdentityRef('authorized.owner@pilot-mail.org'));
  });

  it('allows cleanup only for explicitly prefixed synthetic projects', () => {
    expect(() => assertSyntheticCleanupProjects([
      { id: 'p1', name: '[E2E-PROD] 2026-11-10 brief' },
      { id: 'p2', name: '[E2E-SWARM] 2026-11-10 initiative' },
    ])).not.toThrow();
    expect(() => assertSyntheticCleanupProjects([
      { id: 'customer-project', name: 'Customer transformation' },
    ])).toThrow(/lack an approved synthetic prefix/i);
  });
});
