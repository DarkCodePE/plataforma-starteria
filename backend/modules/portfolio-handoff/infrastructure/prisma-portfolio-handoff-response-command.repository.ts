import type { PrismaClient } from '@prisma/client';
import type { HandoffResponseCommand, HandoffResponseCommandRepository } from '../domain/portfolio-handoff-assignment.types';

export class PrismaPortfolioHandoffResponseCommandRepository implements HandoffResponseCommandRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findByIdempotencyKey(input: { assignmentId: string; type: HandoffResponseCommand['type']; idempotencyKey: string }): Promise<HandoffResponseCommand | null> {
    const row = await (this.prisma as any).portfolioHandoffResponseCommand.findUnique({ where: { assignmentId_type_idempotencyKey: input } });
    return row ? map(row) : null;
  }
  async create(input: Omit<HandoffResponseCommand, 'id'>): Promise<HandoffResponseCommand> { return map(await (this.prisma as any).portfolioHandoffResponseCommand.create({ data: input })); }
}
function map(row: any): HandoffResponseCommand { return { ...row }; }
