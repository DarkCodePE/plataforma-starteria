import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../auth.service';
import { hashRefreshToken, verifyAccessToken } from '../token.service';

const enabled = process.env.KAN190_DB_E2E === '1';
const databaseUrl = process.env.E2E_DATABASE_URL;

if (enabled) {
  const parsed = databaseUrl ? new URL(databaseUrl) : null;
  const databaseName = parsed?.pathname.replace(/^\//, '');
  if (!parsed || databaseName !== 'starteria_e2e' || !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('KAN-190 requires disposable local PostgreSQL database starteria_e2e.');
  }
}

const suite = enabled ? describe.sequential : describe.skip;
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
const service = new AuthService(prisma);
const ids = {
  userA: 'kan190-refresh-user-a',
  userB: 'kan190-refresh-user-b',
  familyA: 'kan190-refresh-family-a',
  familyB: 'kan190-refresh-family-b',
};

const rawA = crypto.randomBytes(64).toString('hex');
const rawB = crypto.randomBytes(64).toString('hex');

async function cleanup(): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId: { in: [ids.userA, ids.userB] } } });
  await prisma.refreshTokenFamily.deleteMany({ where: { userId: { in: [ids.userA, ids.userB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB] } } });
}

async function seedToken(input: { userId: string; family: string; raw: string; expiresAt?: Date }): Promise<void> {
  await prisma.refreshTokenFamily.upsert({
    where: { id: input.family },
    update: {},
    create: { id: input.family, userId: input.userId },
  });
  await prisma.refreshToken.create({
    data: {
      userId: input.userId,
      family: input.family,
      tokenHash: hashRefreshToken(input.raw),
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000),
    },
  });
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function servicePausedBeforeSuccessor(): {
  service: AuthService;
  successorReached: Promise<void>;
  releaseSuccessor: () => void;
} {
  const reached = deferred();
  const release = deferred();
  let paused = false;
  const intercepted = new Proxy(prisma as any, {
    get(target, property) {
      if (property !== '$transaction') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (run: (tx: any) => Promise<unknown>, options?: unknown) => target.$transaction(async (tx: any) => {
        const txProxy = new Proxy(tx, {
          get(transaction, transactionProperty) {
            if (transactionProperty !== 'refreshToken') return Reflect.get(transaction, transactionProperty, transaction);
            return new Proxy(transaction.refreshToken, {
              get(delegate, delegateProperty) {
                const value = Reflect.get(delegate, delegateProperty, delegate);
                if (delegateProperty !== 'create') return typeof value === 'function' ? value.bind(delegate) : value;
                return async (args: unknown) => {
                  if (!paused) {
                    paused = true;
                    reached.resolve();
                    await release.promise;
                  }
                  return value.call(delegate, args);
                };
              },
            });
          },
        });
        return run(txProxy);
      }, options);
    },
  });
  return {
    service: new AuthService(intercepted),
    successorReached: reached.promise,
    releaseSuccessor: release.resolve,
  };
}

suite('KAN-190 atomic refresh rotation with PostgreSQL', () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.user.createMany({
      data: [
        {
          id: ids.userA, email: 'kan190-a@starteria.test', name: 'KAN190 A', role: 'participante',
          roles: ['participante'], initials: 'KA', skills: [], organizationId: 'kan190-org-a', isActive: true,
        },
        {
          id: ids.userB, email: 'kan190-b@starteria.test', name: 'KAN190 B', role: 'participante',
          roles: ['participante'], initials: 'KB', skills: [], organizationId: 'kan190-org-b', isActive: true,
        },
      ],
    });
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: [ids.userA, ids.userB] } } });
    await prisma.refreshTokenFamily.deleteMany({ where: { userId: { in: [ids.userA, ids.userB] } } });
    await prisma.user.updateMany({
      where: { id: { in: [ids.userA, ids.userB] } },
      data: { isActive: true },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('allows exactly one of 24 simultaneous rotations and leaves one valid successor', async () => {
    const startedAt = Date.now();
    await seedToken({ userId: ids.userA, family: ids.familyA, raw: rawA });
    await seedToken({ userId: ids.userB, family: ids.familyB, raw: rawB });

    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const attempts = Array.from({ length: 24 }, async () => {
      await barrier;
      return service.refreshTokens(rawA);
    });
    release();

    const settled = await Promise.allSettled(attempts);
    const winners = settled.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.refreshTokens>>> => result.status === 'fulfilled');
    const losers = settled.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(23);
    expect(losers.every(({ reason }) => reason?.code === 'AUTH_REFRESH_TOKEN_REUSED')).toBe(true);

    const familyA = await prisma.refreshToken.findMany({ where: { family: ids.familyA }, orderBy: { generation: 'asc' } });
    const active = familyA.filter((token) => token.revokedAt === null);
    expect(familyA).toHaveLength(2);
    expect(active).toHaveLength(1);
    expect(familyA.map((token) => token.generation)).toEqual([0, 1]);
    expect(active[0].tokenHash).toBe(hashRefreshToken(winners[0].value.refreshToken));
    expect(active[0].expiresAt.getTime()).toBeGreaterThanOrEqual(startedAt + 8 * 60 * 60 * 1_000);
    expect(verifyAccessToken(winners[0].value.accessToken).sub).toBe(ids.userA);

    const untouchedB = await prisma.refreshToken.findMany({ where: { family: ids.familyB } });
    expect(untouchedB).toHaveLength(1);
    expect(untouchedB[0]).toMatchObject({ userId: ids.userB, revokedAt: null });

    await expect(service.refreshTokens(rawA)).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_REUSED' });
    await expect(prisma.refreshToken.findUniqueOrThrow({ where: { id: active[0].id } }))
      .resolves.toMatchObject({ revokedAt: null });

    const second = await service.refreshTokens(winners[0].value.refreshToken);
    const activeAfterSecondRotation = await prisma.refreshToken.findMany({
      where: { family: ids.familyA, revokedAt: null },
    });
    expect(activeAfterSecondRotation).toHaveLength(1);
    expect(activeAfterSecondRotation[0]).toMatchObject({
      generation: 2,
      tokenHash: hashRefreshToken(second.refreshToken),
    });
  });

  it('denies expired and disabled sessions without creating a successor', async () => {
    await seedToken({ userId: ids.userA, family: ids.familyA, raw: rawA, expiresAt: new Date(Date.now() - 1_000) });
    await expect(service.refreshTokens(rawA)).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_EXPIRED' });
    expect(await prisma.refreshToken.count({ where: { family: ids.familyA } })).toBe(1);

    await prisma.refreshToken.deleteMany({ where: { family: ids.familyA } });
    await prisma.refreshTokenFamily.delete({ where: { id: ids.familyA } });
    await seedToken({ userId: ids.userA, family: ids.familyA, raw: rawA });
    await prisma.user.update({ where: { id: ids.userA }, data: { isActive: false } });
    await expect(service.refreshTokens(rawA)).rejects.toMatchObject({ code: 'AUTH_WAITLISTED' });
    expect(await prisma.refreshToken.count({ where: { family: ids.familyA, revokedAt: null } })).toBe(0);
  });

  it('linearizes logout over a refresh that already consumed the parent but has not created its successor', async () => {
    await seedToken({ userId: ids.userA, family: ids.familyA, raw: rawA });
    const paused = servicePausedBeforeSuccessor();

    const refresh = paused.service.refreshTokens(rawA);
    await paused.successorReached;
    const logout = paused.service.logoutUser(rawA);
    await new Promise<void>((resolve) => setImmediate(resolve));
    paused.releaseSuccessor();

    const rotated = await refresh;
    await logout;

    expect(await prisma.refreshToken.count({ where: { family: ids.familyA, revokedAt: null } })).toBe(0);
    await expect(service.refreshTokens(rotated.refreshToken)).rejects.toMatchObject({
      code: 'AUTH_REFRESH_TOKEN_REUSED',
    });
  });

  it('keeps a durable family tombstone so a late successor cannot renew after logout completes', async () => {
    await seedToken({ userId: ids.userA, family: ids.familyA, raw: rawA });
    await service.logoutUser(rawA);

    const lateRaw = crypto.randomBytes(64).toString('hex');
    await prisma.refreshToken.create({
      data: {
        userId: ids.userA,
        family: ids.familyA,
        generation: 1,
        tokenHash: hashRefreshToken(lateRaw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(service.refreshTokens(lateRaw)).rejects.toMatchObject({
      code: 'AUTH_REFRESH_TOKEN_REUSED',
    });
    expect(await prisma.refreshToken.count({ where: { family: ids.familyA, revokedAt: null } })).toBe(0);
  });

  it('makes logout-first win at the shared PostgreSQL family lock', async () => {
    await seedToken({ userId: ids.userA, family: ids.familyA, raw: rawA });
    const locked = deferred();
    const release = deferred();
    const logoutFirst = new AuthService(prisma, {
      afterLogoutFamilyLock: async () => {
        locked.resolve();
        await release.promise;
      },
    });

    const logout = logoutFirst.logoutUser(rawA);
    await locked.promise;
    const refresh = service.refreshTokens(rawA);
    await new Promise<void>((resolve) => setImmediate(resolve));
    release.resolve();

    await logout;
    await expect(refresh).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_REUSED' });
    expect(await prisma.refreshToken.count({ where: { family: ids.familyA, revokedAt: null } })).toBe(0);
  });

  it('leaves zero usable successors after logout in a 24-request overlap', async () => {
    await seedToken({ userId: ids.userA, family: ids.familyA, raw: rawA });
    const start = deferred();
    const refreshes = Array.from({ length: 23 }, async () => {
      await start.promise;
      return service.refreshTokens(rawA);
    });
    const logout = (async () => {
      await start.promise;
      await service.logoutUser(rawA);
    })();
    start.resolve();

    const settled = await Promise.allSettled(refreshes);
    await logout;
    const issued = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value.refreshToken] : []);

    expect(issued.length).toBeLessThanOrEqual(1);
    expect(await prisma.refreshToken.count({ where: { family: ids.familyA, revokedAt: null } })).toBe(0);
    for (const successor of issued) {
      await expect(service.refreshTokens(successor)).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_REUSED' });
    }
  });
});
