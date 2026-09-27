import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../google.service', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

import { AuthService } from '../auth.service';
import { hashRefreshToken } from '../token.service';

function makePrisma() {
  return {
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('AuthService session identity issuance', () => {
  it('issues a new family and matching sid for an independent login', async () => {
    const prisma = makePrisma();
    const service = new AuthService(prisma);
    const tokens = await (service as any).issueTokenPair(
      'user-1', 'user@example.com', 'participante', ['participante'], null,
    );
    const payload = jwt.decode(tokens.accessToken) as Record<string, unknown>;

    expect(payload.sid).toBe(prisma.refreshToken.create.mock.calls[0][0].data.family);
    expect(payload.sid).toEqual(expect.any(String));
  });

  it('preserves the existing family during refresh rotation', async () => {
    const prisma = makePrisma();
    const service = new AuthService(prisma);
    const tokens = await (service as any).issueTokenPair(
      'user-1', 'user@example.com', 'participante', ['participante'], null, 'family-1',
    );
    const payload = jwt.decode(tokens.accessToken) as Record<string, unknown>;

    expect(payload.sid).toBe('family-1');
    expect(prisma.refreshToken.create.mock.calls[0][0].data.family).toBe('family-1');
  });

  it('preserves the family through the public refresh rotation flow', async () => {
    const prisma = makePrisma();
    const rawRefreshToken = 'refresh-token-1';
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-row-1',
      tokenHash: hashRefreshToken(rawRefreshToken),
      userId: 'user-1',
      family: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'participante',
        roles: ['participante'],
        cohortId: null,
      },
    });
    const service = new AuthService(prisma);

    const tokens = await service.refreshTokens(rawRefreshToken);
    const payload = jwt.decode(tokens.accessToken) as Record<string, unknown>;

    expect(payload.sid).toBe('family-1');
    expect(prisma.refreshToken.create.mock.calls[0][0].data.family).toBe('family-1');
  });

  it('creates distinct families for separate logins by the same user', async () => {
    const prisma = makePrisma();
    const service = new AuthService(prisma);
    const first = await (service as any).issueTokenPair(
      'user-1', 'user@example.com', 'participante', ['participante'], null,
    );
    const second = await (service as any).issueTokenPair(
      'user-1', 'user@example.com', 'participante', ['participante'], null,
    );

    expect((jwt.decode(first.accessToken) as any).sid)
      .not.toBe((jwt.decode(second.accessToken) as any).sid);
  });
});
