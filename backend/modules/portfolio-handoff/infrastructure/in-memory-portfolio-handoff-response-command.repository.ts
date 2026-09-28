import { randomUUID } from 'node:crypto';
import type { HandoffResponseCommand, HandoffResponseCommandRepository } from '../domain/portfolio-handoff-assignment.types';

export class InMemoryPortfolioHandoffResponseCommandRepository implements HandoffResponseCommandRepository {
  private readonly commands: HandoffResponseCommand[] = [];
  async findByIdempotencyKey(input: { assignmentId: string; type: HandoffResponseCommand['type']; idempotencyKey: string }): Promise<HandoffResponseCommand | null> {
    return this.commands.find((c) => c.assignmentId === input.assignmentId && c.type === input.type && c.idempotencyKey === input.idempotencyKey) ?? null;
  }
  async create(input: Omit<HandoffResponseCommand, 'id'>): Promise<HandoffResponseCommand> { const command = { ...input, id: randomUUID() }; this.commands.push(command); return command; }
}
