import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth.service';

function prismaFor(storedToken: Record<string, unknown>) {
  const prisma = {
    refreshToken: {
      findUnique: vi.fn(async () => storedToken),
      update: vi.fn(async () => storedToken),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: { data: unknown }) => data),
    },
    refreshTokenFamily: {
      findUnique: vi.fn(async () => ({ revokedAt: null })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: { data: unknown }) => data),
    },
    $queryRaw: vi.fn(async () => [{ id: 'family-1' }]),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma));
  return prisma;
}

const activeToken = () => ({
  id: 'rt-1', tokenHash: 'hash', userId: 'user-1', family: 'family-1', generation: 0, revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { id: 'user-1', email: 'owner@example.test', role: 'participante', roles: ['participante'], cohortId: null, isActive: true },
});

describe('AuthService refresh security', () => {
  it('consumes the exact token generation with a transactional compare-and-set', async () => {
    const prisma = prismaFor(activeToken());
    const service = new AuthService(prisma as never);

    await service.refreshTokens('opaque-refresh');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'rt-1',
        tokenHash: expect.any(String),
        generation: 0,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ family: 'family-1', generation: 1, userId: 'user-1' }),
    });
  });

  it('revokes the token family and denies refresh for a deactivated user', async () => {
    const stored = activeToken();
    stored.user.isActive = false;
    const prisma = prismaFor(stored);
    const service = new AuthService(prisma as never);

    await expect(service.refreshTokens('opaque-refresh')).rejects.toMatchObject({ code: 'AUTH_WAITLISTED' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { family: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('does not revoke the winning successor for an immediate concurrent replay', async () => {
    const stored = { ...activeToken(), revokedAt: new Date() };
    const prisma = prismaFor(stored);
    const service = new AuthService(prisma as never);

    await expect(service.refreshTokens('opaque-refresh')).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_REUSED' });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('contains the active family when a revoked token is replayed after the concurrency grace window', async () => {
    const stored = { ...activeToken(), revokedAt: new Date(Date.now() - 10_000) };
    const prisma = prismaFor(stored);
    const service = new AuthService(prisma as never);

    await expect(service.refreshTokens('stolen-refresh')).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_REUSED' });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { family: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('persists the same eight-hour TTL used by the refresh cookie policy', async () => {
    const prisma = prismaFor(activeToken());
    const service = new AuthService(prisma as never);
    const before = Date.now();
    await service.refreshTokens('opaque-refresh');
    const after = Date.now();
    const created = prisma.refreshToken.create.mock.calls[0][0] as { data: { expiresAt: Date } };
    expect(created.data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 8 * 60 * 60 * 1000);
    expect(created.data.expiresAt.getTime()).toBeLessThanOrEqual(after + 8 * 60 * 60 * 1000);
  });
});

