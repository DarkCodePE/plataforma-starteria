import { describe, expect, it, vi } from 'vitest';
import { StrategicFramingPromotionReadService } from '../strategic-framing.promotion-read.service';

function makePrisma(promotions: any[]) {
  return {
    strategicFramingPromotion: { findMany: vi.fn().mockResolvedValue(promotions) },
    challenge: { findMany: vi.fn().mockResolvedValue([{ id: 'challenge-1', title: 'Challenge one' }]), findUnique: vi.fn() },
  } as any;
}

describe('StrategicFramingPromotionReadService', () => {
  it('returns an empty list without a Challenge query for zero promotions', async () => {
    const prisma = makePrisma([]);
    await expect(new StrategicFramingPromotionReadService(prisma).listForState('state-1')).resolves.toEqual([]);
    expect(prisma.strategicFramingPromotion.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.challenge.findMany).not.toHaveBeenCalled();
    expect(prisma.challenge.findUnique).not.toHaveBeenCalled();
  });

  it('uses one batched Challenge read for one promotion', async () => {
    const prisma = makePrisma([{ id: 'promotion-1', challengeCandidateId: 'candidate-1', challengeId: 'challenge-1', strategicFrontId: 'front-1', status: 'COMPLETED', promotedAt: '2026-09-27T10:00:00.000Z' }]);
    await expect(new StrategicFramingPromotionReadService(prisma).listForState('state-1')).resolves.toMatchObject([{ promotionId: 'promotion-1', challengeTitle: 'Challenge one' }]);
    expect(prisma.challenge.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.challenge.findMany).toHaveBeenCalledWith({ where: { id: { in: ['challenge-1'] } }, select: { id: true, title: true } });
    expect(prisma.challenge.findUnique).not.toHaveBeenCalled();
  });

  it('uses one batched Challenge read, preserves order, and keeps unresolved references null', async () => {
    const promotions = [
      { id: 'promotion-1', challengeCandidateId: 'candidate-1', challengeId: 'challenge-1', strategicFrontId: 'front-1', status: 'COMPLETED', promotedAt: '2026-09-27T10:00:00.000Z' },
      { id: 'promotion-2', challengeCandidateId: 'candidate-2', challengeId: 'missing-challenge', strategicFrontId: 'front-2', status: 'COMPLETED', promotedAt: '2026-09-27T11:00:00.000Z' },
      { id: 'promotion-3', challengeCandidateId: 'candidate-3', challengeId: 'challenge-1', strategicFrontId: 'front-1', status: 'COMPLETED', promotedAt: '2026-09-27T12:00:00.000Z' },
    ];
    const prisma = makePrisma(promotions);
    const result = await new StrategicFramingPromotionReadService(prisma).listForState('state-1');
    expect(result.map(item => item.promotionId)).toEqual(['promotion-1', 'promotion-2', 'promotion-3']);
    expect(result.map(item => item.challengeTitle)).toEqual(['Challenge one', null, 'Challenge one']);
    expect(prisma.challenge.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.challenge.findMany).toHaveBeenCalledWith({ where: { id: { in: ['challenge-1', 'missing-challenge'] } }, select: { id: true, title: true } });
    expect(prisma.challenge.findUnique).not.toHaveBeenCalled();
  });
});
