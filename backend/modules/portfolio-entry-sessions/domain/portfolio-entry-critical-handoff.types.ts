import { z } from 'zod';
import type { CriticalHandoffProjection } from '../../portfolio-entry/presentation/critical-handoff-projection';

export const PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION = 'critical-handoff-projection-v0.1' as const;

export type PortfolioEntryCriticalHandoffValidationCode =
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'INVALID_PAYLOAD'
  | 'INVALID_CONFIRMATION_EVIDENCE';

export class PortfolioEntryCriticalHandoffValidationError extends Error {
  constructor(readonly code: PortfolioEntryCriticalHandoffValidationCode, message: string) {
    super(message);
    this.name = 'PortfolioEntryCriticalHandoffValidationError';
  }
}

const criticalHandoffPayloadV01Schema = z.object({
  conclusionStatus: z.enum(['supported', 'bounded', 'insufficient_basis']),
  finalReading: z.string().nullable(),
  decisionInView: z.string().nullable(),
  usableNow: z.array(z.object({
    item: z.string(),
    howItCanHelp: z.string(),
  }).strict()),
  decisionChangingUnknowns: z.array(z.object({
    uncertainty: z.string(),
    whyItMatters: z.string(),
  }).strict()),
  firstMovement: z.object({
    movement: z.string(),
    whyNow: z.string(),
    whatItMayClarify: z.string(),
    boundary: z.string(),
    existingAssetsUsed: z.array(z.string()).optional(),
  }).strict().nullable(),
}).strict().superRefine((payload, context) => {
  if (payload.conclusionStatus === 'insufficient_basis') {
    if (payload.finalReading !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['finalReading'], message: 'Insufficient basis cannot contain a final reading.' });
    }
    if (payload.firstMovement !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['firstMovement'], message: 'Insufficient basis cannot contain a first movement.' });
    }
  } else if (payload.finalReading === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['finalReading'], message: 'Supported conclusions require a final reading.' });
  }
});

export type CriticalHandoffPayload = CriticalHandoffProjection;
export type PortfolioEntryCriticalHandoffConfirmationState = 'provisional' | 'confirmed';

export type PortfolioEntryCriticalHandoffRecord = {
  id: string;
  sessionId: string;
  artifactVersion: number;
  schemaVersion: string;
  sourceContextRevision: number;
  sourceTurnId?: string;
  payload: CriticalHandoffPayload;
  confirmationState: PortfolioEntryCriticalHandoffConfirmationState;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePortfolioEntryCriticalHandoffInput = {
  sessionId: string;
  expectedSessionRevision?: number;
  sourceContextRevision: number;
  sourceTurnId?: string;
  payload: CriticalHandoffPayload;
};

export type ConfirmPortfolioEntryCriticalHandoffInput = {
  sessionId: string;
  artifactId: string;
  expectedArtifactVersion: number;
  expectedContextRevision: number;
  confirmingActorId: string;
  confirmedAt: Date;
};

export type PortfolioEntryCriticalHandoffLifecycle = {
  confirmationState: PortfolioEntryCriticalHandoffConfirmationState;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
};

export type PortfolioEntryCriticalHandoffCurrentness = {
  artifact: PortfolioEntryCriticalHandoffRecord;
  isCurrent: boolean;
};

export type PortfolioEntryCriticalHandoffLatestSnapshot = {
  artifact: PortfolioEntryCriticalHandoffRecord | null;
  currentContextRevision: number;
};

export function parseCriticalHandoffPayload(schemaVersion: string, payload: unknown): CriticalHandoffPayload {
  if (schemaVersion !== PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION) {
    throw new PortfolioEntryCriticalHandoffValidationError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `Unsupported persisted Critical Handoff schemaVersion: ${schemaVersion}`,
    );
  }

  const parsed = criticalHandoffPayloadV01Schema.safeParse(payload);
  if (!parsed.success) {
    throw new PortfolioEntryCriticalHandoffValidationError(
      'INVALID_PAYLOAD',
      `Invalid persisted Critical Handoff payload: ${parsed.error.message}`,
    );
  }

  // The runtime schema checks the complete strict object; this assertion restores
  // required keys because backend TypeScript compilation disables strictNullChecks.
  return parsed.data as CriticalHandoffProjection;
}

export function parseCriticalHandoffLifecycle(
  confirmationState: string,
  confirmedAt: Date | null,
  confirmedByUserId: string | null,
): PortfolioEntryCriticalHandoffLifecycle {
  if (confirmationState !== 'provisional' && confirmationState !== 'confirmed') {
    throw new Error(`Invalid persisted Critical Handoff confirmation state: ${confirmationState}`);
  }

  const evidenceIsValid = confirmationState === 'provisional'
    ? confirmedAt === null && confirmedByUserId === null
    : confirmedAt instanceof Date
      && Number.isFinite(confirmedAt.getTime())
      && typeof confirmedByUserId === 'string'
      && confirmedByUserId.trim().length > 0;

  if (!evidenceIsValid) {
    throw new PortfolioEntryCriticalHandoffValidationError(
      'INVALID_CONFIRMATION_EVIDENCE',
      'Invalid persisted Critical Handoff confirmation evidence.',
    );
  }

  return { confirmationState, confirmedAt, confirmedByUserId };
}

export function nextCriticalHandoffArtifactVersion(latestArtifactVersion?: number): number {
  if (latestArtifactVersion === undefined) return 1;
  if (!Number.isSafeInteger(latestArtifactVersion) || latestArtifactVersion < 1 || latestArtifactVersion >= 2_147_483_647) {
    throw new RangeError('Invalid or exhausted Critical Handoff artifactVersion.');
  }
  return latestArtifactVersion + 1;
}

export function isCriticalHandoffCurrent(
  artifact: PortfolioEntryCriticalHandoffRecord,
  latestArtifact: PortfolioEntryCriticalHandoffRecord | null,
  currentContextRevision: number,
): boolean {
  return latestArtifact?.id === artifact.id
    && artifact.sourceContextRevision === currentContextRevision;
}
