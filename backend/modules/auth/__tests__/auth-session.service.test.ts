import { describe, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../auth-session.service';

function makePrisma(findFirst = vi.fn()) {
  return { refreshToken: { findFirst } } as any;
}

describe('modules/auth/auth-session.service', () => {
  it('accepts an active family for the owning actor', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'rotated-family-row' });
    const service = new AuthSessionService(makePrisma(findFirst));

    await expect(service.isAuthSessionActive({
      actorUserId: 'user-1',
      authSessionId: 'family-1',
    })).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        family: 'family-1',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      }),
    }));
  });

  it('rejects a revoked or expired family with no active row', async () => {
    const service = new AuthSessionService(makePrisma(vi.fn().mockResolvedValue(null)));

    await expect(service.isAuthSessionActive({
      actorUserId: 'user-1',
      authSessionId: 'family-1',
    })).resolves.toBe(false);
  });

  it('rejects a family presented for the wrong actor', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new AuthSessionService(makePrisma(findFirst));

    await expect(service.isAuthSessionActive({
      actorUserId: 'user-2',
      authSessionId: 'family-owned-by-user-1',
    })).resolves.toBe(false);

    expect(findFirst.mock.calls[0][0].where.userId).toBe('user-2');
  });

  it('rejects absent identity instead of falling back to userId', async () => {
    const findFirst = vi.fn();
    const service = new AuthSessionService(makePrisma(findFirst));

    await expect(service.isAuthSessionActive({
      actorUserId: 'user-1',
      authSessionId: '',
    })).resolves.toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
