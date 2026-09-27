import type { PrismaClient } from '@prisma/client';

export type StrategicFramingPromotionSummary = {
  promotionId: string;
  challengeCandidateId: string;
  challengeId: string;
  challengeTitle: string | null;
  strategicFrontId: string;
  status: string;
  promotedAt: string;
};

export class StrategicFramingPromotionReadService {
  constructor(private readonly prisma: PrismaClient) {}

  async listForState(stateId: string): Promise<StrategicFramingPromotionSummary[]> {
    const rows = await (this.prisma as any).strategicFramingPromotion.findMany({
      where: { stateId },
      select: { id: true, challengeCandidateId: true, challengeId: true, strategicFrontId: true, status: true, promotedAt: true },
      orderBy: { promotedAt: 'asc' },
    });
    const challengeIds = [...new Set(rows.map((row: any) => row.challengeId))];
    const challenges = challengeIds.length === 0
      ? []
      : await (this.prisma as any).challenge.findMany({
        where: { id: { in: challengeIds } },
        select: { id: true, title: true },
      });
    const challengeById = new Map<string, { id: string; title: string | null }>(challenges.map((challenge: any) => [challenge.id, challenge]));

    return rows.map((row: any) => ({
      promotionId: row.id,
      challengeCandidateId: row.challengeCandidateId,
      challengeId: row.challengeId,
      challengeTitle: challengeById.get(row.challengeId)?.title ?? null,
      strategicFrontId: row.strategicFrontId,
      status: String(row.status).toLowerCase(),
      promotedAt: new Date(row.promotedAt).toISOString(),
    }));
  }
}
