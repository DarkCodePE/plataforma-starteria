import type { PrismaClient } from '@prisma/client';
import type {
  PortfolioContextSelectionRecord,
} from './portfolio-context.types';

type SelectionDb = Pick<PrismaClient, 'portfolioContextSelection'>;

export type SetPortfolioContextSelectionInput = {
  authSessionId: string;
  actorUserId: string;
  organizationId: string;
};

export type InvalidatePortfolioContextSelectionInput = {
  authSessionId: string;
  reason: string;
};

export class PortfolioContextSelectionStore {
  constructor(private readonly prisma: SelectionDb) {}

  async getActiveSelection(authSessionId: string): Promise<PortfolioContextSelectionRecord | null> {
    if (!authSessionId) return null;
    return this.prisma.portfolioContextSelection.findFirst({
      where: { authSessionId, invalidatedAt: null },
      select: {
        authSessionId: true,
        actorUserId: true,
        organizationId: true,
        selectedAt: true,
        updatedAt: true,
        invalidatedAt: true,
        invalidationReason: true,
      },
    });
  }

  async hasInvalidatedSelection(authSessionId: string): Promise<boolean> {
    if (!authSessionId) return false;
    const selection = await this.prisma.portfolioContextSelection.findUnique({
      where: { authSessionId },
      select: { invalidatedAt: true },
    });
    return Boolean(selection?.invalidatedAt);
  }

  async setSelection(input: SetPortfolioContextSelectionInput): Promise<void> {
    await this.prisma.portfolioContextSelection.upsert({
      where: { authSessionId: input.authSessionId },
      create: {
        authSessionId: input.authSessionId,
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
      },
      update: {
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        selectedAt: new Date(),
        invalidatedAt: null,
        invalidationReason: null,
      },
    });
  }

  async invalidateSelection(input: InvalidatePortfolioContextSelectionInput): Promise<void> {
    await this.prisma.portfolioContextSelection.updateMany({
      where: { authSessionId: input.authSessionId, invalidatedAt: null },
      data: { invalidatedAt: new Date(), invalidationReason: input.reason },
    });
  }

  async clearSelection(authSessionId: string): Promise<void> {
    if (!authSessionId) return;
    await this.prisma.portfolioContextSelection.deleteMany({ where: { authSessionId } });
  }
}
