import { PrismaClient } from '@prisma/client';

export interface AuthSessionActivityInput {
  actorUserId: string;
  authSessionId: string;
}

/**
 * Session-sensitive validation for access-token consumers.
 *
 * A refresh family is active when it still has at least one unrevoked,
 * unexpired refresh-token row for the same actor. Individual rotated rows are
 * revoked as part of normal rotation, so checking every historical row would
 * incorrectly reject a still-active family.
 */
export class AuthSessionService {
  constructor(private readonly prisma: PrismaClient) {}

  async isAuthSessionActive({
    actorUserId,
    authSessionId,
  }: AuthSessionActivityInput): Promise<boolean> {
    if (!actorUserId || !authSessionId) return false;

    const activeToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId: actorUserId,
        family: authSessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return Boolean(activeToken);
  }
}
