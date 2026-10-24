import { randomUUID } from 'node:crypto';
import type {
  ClaimCriticalHandoffGenerationInput,
  CriticalHandoffGeneration,
  CriticalHandoffGenerationFailureClass,
  CriticalHandoffGenerationRepository,
} from '../application/critical-handoff-generation.repository';

export class InMemoryCriticalHandoffGenerationRepository implements CriticalHandoffGenerationRepository {
  private readonly generations = new Map<string, CriticalHandoffGeneration>();

  async find(sessionId: string, sourceContextRevision: number, now: Date, maxDurationMs: number) {
    const generation = this.generations.get(key(sessionId, sourceContextRevision));
    if (!generation) return null;
    if (generation.status === 'GENERATING' && now.getTime() - generation.startedAt.getTime() > maxDurationMs) {
      generation.status = 'FAILED';
      generation.failureClass = 'stale';
      generation.finishedAt = now;
      generation.updatedAt = now;
    }
    return clone(generation);
  }

  async findLatest(sessionId: string, now: Date, maxDurationMs: number) {
    const generation = [...this.generations.values()]
      .filter((item) => item.sessionId === sessionId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    if (!generation) return null;
    return this.find(sessionId, generation.sourceContextRevision, now, maxDurationMs);
  }

  async claim(input: ClaimCriticalHandoffGenerationInput) {
    const mapKey = key(input.sessionId, input.sourceContextRevision);
    let generation = this.generations.get(mapKey);
    if (generation?.status === 'GENERATING'
      && input.now.getTime() - generation.startedAt.getTime() > input.maxDurationMs) {
      generation.status = 'FAILED';
      generation.failureClass = 'stale';
      generation.finishedAt = input.now;
      generation.updatedAt = input.now;
    }
    if (generation?.status === 'GENERATING' || generation?.status === 'READY') {
      return { generation: clone(generation), claimed: false };
    }
    const claimed: CriticalHandoffGeneration = generation ? {
      ...generation,
      expectedSessionRevision: input.expectedSessionRevision,
      status: 'GENERATING', failureClass: null, attempt: generation.attempt + 1,
      startedAt: input.now, finishedAt: null, updatedAt: input.now,
    } : {
      id: randomUUID(), sessionId: input.sessionId, sourceContextRevision: input.sourceContextRevision,
      expectedSessionRevision: input.expectedSessionRevision, status: 'GENERATING', failureClass: null,
      attempt: 1, startedAt: input.now, finishedAt: null, createdAt: input.now, updatedAt: input.now,
    };
    this.generations.set(mapKey, claimed);
    return { generation: clone(claimed), claimed: true };
  }

  async markReady(sessionId: string, sourceContextRevision: number, attempt: number, now: Date) {
    const generation = this.generations.get(key(sessionId, sourceContextRevision));
    if (!generation || generation.status !== 'GENERATING' || generation.attempt !== attempt) return;
    generation.status = 'READY'; generation.failureClass = null; generation.finishedAt = now; generation.updatedAt = now;
  }

  async markFailed(sessionId: string, sourceContextRevision: number, attempt: number, failureClass: CriticalHandoffGenerationFailureClass, now: Date) {
    const generation = this.generations.get(key(sessionId, sourceContextRevision));
    if (!generation || generation.status !== 'GENERATING' || generation.attempt !== attempt) return;
    generation.status = 'FAILED'; generation.failureClass = failureClass; generation.finishedAt = now; generation.updatedAt = now;
  }
}

function key(sessionId: string, sourceContextRevision: number) { return `${sessionId}:${sourceContextRevision}`; }
function clone(generation: CriticalHandoffGeneration): CriticalHandoffGeneration {
  return { ...generation, startedAt: new Date(generation.startedAt), finishedAt: generation.finishedAt && new Date(generation.finishedAt), createdAt: new Date(generation.createdAt), updatedAt: new Date(generation.updatedAt) };
}
