export type CriticalHandoffGenerationStatus = 'GENERATING' | 'READY' | 'FAILED';
export type CriticalHandoffGenerationFailureClass =
  | 'provider_authentication' | 'provider_timeout' | 'provider_failure' | 'empty_output'
  | 'schema_invalid' | 'projection_failure' | 'persistence_failure' | 'revision_conflict' | 'stale';

export type CriticalHandoffGeneration = {
  id: string;
  sessionId: string;
  sourceContextRevision: number;
  expectedSessionRevision: number;
  status: CriticalHandoffGenerationStatus;
  failureClass: CriticalHandoffGenerationFailureClass | null;
  attempt: number;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClaimCriticalHandoffGenerationInput = {
  sessionId: string;
  sourceContextRevision: number;
  expectedSessionRevision: number;
  now: Date;
  maxDurationMs: number;
};

export interface CriticalHandoffGenerationRepository {
  find(sessionId: string, sourceContextRevision: number, now: Date, maxDurationMs: number): Promise<CriticalHandoffGeneration | null>;
  findLatest(sessionId: string, now: Date, maxDurationMs: number): Promise<CriticalHandoffGeneration | null>;
  claim(input: ClaimCriticalHandoffGenerationInput): Promise<{ generation: CriticalHandoffGeneration; claimed: boolean }>;
  markReady(sessionId: string, sourceContextRevision: number, attempt: number, now: Date): Promise<void>;
  markFailed(sessionId: string, sourceContextRevision: number, attempt: number, failureClass: CriticalHandoffGenerationFailureClass, now: Date): Promise<void>;
}
