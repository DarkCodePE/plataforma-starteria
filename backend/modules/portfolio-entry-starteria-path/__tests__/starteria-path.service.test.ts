import { describe, expect, it, vi } from 'vitest';
import { PortfolioEntrySessionError } from '../../portfolio-entry-sessions/application/portfolio-entry-session-errors';
import {
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
  type PortfolioEntryCriticalHandoffCurrentness,
  type PortfolioEntryCriticalHandoffRecord,
} from '../../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import type { CriticalHandoffProjection } from '../../portfolio-entry/presentation/critical-handoff-projection';
import {
  BUSINESS_CAPABILITY_BOUNDARY_VERSION,
  STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION,
  projectStarteriaPath,
} from '../../portfolio-entry/presentation/starteria-path-projection';
import type {
  ConfirmedCurrentCriticalHandoffInput,
  StarteriaPathProjection,
  StarteriaPathVersions,
} from '../../portfolio-entry/domain/starteria-path.types';
import {
  StarteriaPathError,
  StarteriaPathService,
  type StarteriaPathServiceDependencies,
} from '../application/starteria-path.service';

const sessionId = 'session-125b';
const ownerUserId = 'owner-125b';
const sourceId = 'critical-handoff-1';
const currentContextRevision = 4;

const projectionVersions: StarteriaPathVersions = {
  schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
  projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
  businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
};

describe('StarteriaPathService', () => {
  it('projects an owned, current, confirmed, supported Critical Handoff', async () => {
    const harness = makeHarness();

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('SUPPORTED');
    if (!('valueBridge' in result)) throw new Error('Supported path DTO did not include its value bridge.');
    expect(result.starteriaPathStatus).toBe('SUPPORTED');
    expect(result.valueBridge.currentState).toBe('The review arrives after the decision checkpoint.');
    expect(result.sourceBinding).toMatchObject({
      criticalHandoffId: sourceId,
      criticalHandoffVersion: 2,
      sourceContextRevision: currentContextRevision,
      current: true,
      confirmed: true,
    });
    expect(harness.projector).toHaveBeenCalledTimes(1);
  });

  it('returns a bounded Path for a bounded current confirmed source', async () => {
    const harness = makeHarness({ payload: makePayload('bounded') });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('BOUNDED');
    if (!('starteriaPathStatus' in result)) throw new Error('Bounded path DTO omitted its path status.');
    expect(result.starteriaPathStatus).toBe('BOUNDED');
  });

  it('returns insufficient basis without Path or first movement fields', async () => {
    const harness = makeHarness({ payload: makePayload('insufficient_basis') });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('UNAVAILABLE_INSUFFICIENT_BASIS');
    expect(result).not.toHaveProperty('valueBridge');
    expect(result).not.toHaveProperty('capabilityPath');
    expect(result).not.toHaveProperty('dependencies');
    expect(result).not.toHaveProperty('firstSupportedMovement');
    expect(result).not.toHaveProperty('conversion');
    expect(result.sourceBinding).toMatchObject({ current: true, confirmed: true });
    expect(harness.projector).toHaveBeenCalledTimes(1);
  });

  it('maps a missing Critical Handoff to an explicit missing error without projection', async () => {
    const harness = makeHarness({ currentness: null });

    await expect(harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId }))
      .rejects.toMatchObject({ code: 'STARTERIA_PATH_HANDOFF_NOT_FOUND' });
    expect(harness.projector).not.toHaveBeenCalled();
  });

  it('returns unavailable for a current but unconfirmed source without projection', async () => {
    const harness = makeHarness({ confirmationState: 'provisional' });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('UNAVAILABLE_UNCONFIRMED');
    expect(result).not.toHaveProperty('valueBridge');
    expect(result).not.toHaveProperty('capabilityPath');
    expect(result).not.toHaveProperty('sourceBinding');
    expect(harness.projector).not.toHaveBeenCalled();
  });

  it('returns stale when source context revision differs from the owned session', async () => {
    const harness = makeHarness({ sourceContextRevision: currentContextRevision - 1 });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('STALE');
    expect(result).not.toHaveProperty('valueBridge');
    expect(result).not.toHaveProperty('sourceBinding');
    expect(harness.projector).not.toHaveBeenCalled();
  });

  it('returns stale when the dedicated source reader reports a latest artifact mismatch', async () => {
    const harness = makeHarness({ isCurrent: false });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('STALE');
    expect(harness.projector).not.toHaveBeenCalled();
  });

  it('returns invalid for an unsupported Critical Handoff schema version', async () => {
    const harness = makeHarness({ schemaVersion: 'critical-handoff-projection-v99' });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('UNAVAILABLE_INVALID');
    expect(result).not.toHaveProperty('valueBridge');
    expect(harness.projector).not.toHaveBeenCalled();
  });

  it('returns invalid for malformed Critical Handoff payloads without exposing parser details', async () => {
    const malformedPayload = { ...makePayload('supported'), reasoning_metadata: { selected_lenses: ['private'] } } as unknown as CriticalHandoffProjection;
    const harness = makeHarness({ payload: malformedPayload });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('UNAVAILABLE_INVALID');
    expect(JSON.stringify(result)).not.toMatch(/reasoning_metadata|selected_lenses|private/i);
    expect(harness.projector).not.toHaveBeenCalled();
  });

  it('denies a mismatched authenticated owner before loading Critical Handoff', async () => {
    const harness = makeHarness();

    await expect(harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId: 'other-user' }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_UNAUTHORIZED' });
    expect(harness.getLatestCriticalHandoff).not.toHaveBeenCalled();
    expect(harness.projector).not.toHaveBeenCalled();
  });

  it('denies an unclaimed session when ownership is required', async () => {
    const harness = makeHarness({ ownershipError: PortfolioEntrySessionError.unauthorized() });

    await expect(harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_UNAUTHORIZED' });
    expect(harness.getLatestCriticalHandoff).not.toHaveBeenCalled();
  });

  it('returns identical semantic DTOs for repeated reads of the same source', async () => {
    const harness = makeHarness();

    const first = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });
    const second = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(second).toEqual(first);
  });

  it('serializes only allowlisted Path fields and excludes legacy/reasoning metadata', async () => {
    const harness = makeHarness();

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });
    const serialized = JSON.stringify(result);

    expect(Object.keys(result).sort()).toEqual([
      'boundaryStatement', 'capabilityPath', 'dependencies', 'experienceState', 'firstSupportedMovement',
      'sourceBinding', 'starteriaPathStatus', 'valueBridge', 'versions',
    ].sort());
    expect(serialized).not.toMatch(/starteria_path|recommended_approach|recommended_cta|alternative_approaches|suggestedRoute/i);
    expect(serialized).not.toMatch(/selected_lenses|reasoning_metadata|provider|model|provenance|sourceTurnId|confirmedByUserId/i);
    expect(serialized).not.toMatch(/conversion|href|consent/i);
  });

  it('does not expose Core, Steps, or continuation fields', async () => {
    const harness = makeHarness();

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result).not.toHaveProperty('core');
    expect(result).not.toHaveProperty('steps');
    expect(result).not.toHaveProperty('initiative');
    expect(result).not.toHaveProperty('continuation');
  });

  it('maps an invalid projector result to an unavailable state', async () => {
    const invalidProjection: StarteriaPathProjection = {
      pathStatus: 'unavailable_invalid',
      boundaryStatement: 'No Path is projected from an invalid Critical Handoff input.',
      sourceBinding: null,
      versions: projectionVersions,
    };
    const harness = makeHarness({ projectorResult: invalidProjection });

    const result = await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    expect(result.experienceState).toBe('UNAVAILABLE_INVALID');
    expect(result).not.toHaveProperty('capabilityPath');
  });

  it('does not convert projector exceptions into a supported Path', async () => {
    const harness = makeHarness({ projectorError: new Error('private provider detail') });

    const result = harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });
    await expect(result).rejects.toBeInstanceOf(StarteriaPathError);
    await expect(result).rejects.toMatchObject({
      code: 'STARTERIA_PATH_PROJECTION_FAILED',
      message: 'Starteria Path could not be projected.',
    });
  });

  it('maps unexpected source reads to a generic server error without leaking details', async () => {
    const harness = makeHarness({ sourceReadError: new Error('private database detail') });

    const result = harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });

    await expect(result).rejects.toMatchObject({
      code: 'STARTERIA_PATH_READ_FAILED',
      message: 'Starteria Path could not be read.',
    });
  });

  it('calls the projector only after ownership, latest/current, confirmation and schema gates pass', async () => {
    const blockedCases: Array<Parameters<typeof makeHarness>[0]> = [
      { currentness: null },
      { confirmationState: 'provisional' },
      { isCurrent: false },
      { sourceContextRevision: currentContextRevision - 1 },
      { schemaVersion: 'unsupported' },
    ];

    for (const scenario of blockedCases) {
      const harness = makeHarness(scenario);
      await harness.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId }).catch(() => undefined);
      expect(harness.projector).not.toHaveBeenCalled();
    }
  });
});

function makeHarness(options: {
  currentness?: PortfolioEntryCriticalHandoffCurrentness | null;
  payload?: CriticalHandoffProjection;
  sourceContextRevision?: number;
  schemaVersion?: string;
  confirmationState?: 'provisional' | 'confirmed';
  isCurrent?: boolean;
  ownershipError?: Error;
  projectorResult?: StarteriaPathProjection;
  projectorError?: Error;
  sourceReadError?: Error;
} = {}) {
  const artifact = makeArtifact({
    payload: options.payload ?? makePayload('supported'),
    sourceContextRevision: options.sourceContextRevision ?? currentContextRevision,
    schemaVersion: options.schemaVersion ?? PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
    confirmationState: options.confirmationState ?? 'confirmed',
  });
  const currentness = options.currentness === undefined
    ? { artifact, isCurrent: options.isCurrent ?? true }
    : options.currentness;
  const getOwnedSessionContext = vi.fn(async (requestedSessionId: string, requestedOwnerUserId: string) => {
    if (options.ownershipError) throw options.ownershipError;
    if (requestedSessionId !== sessionId) throw PortfolioEntrySessionError.notFound();
    if (requestedOwnerUserId !== ownerUserId) throw PortfolioEntrySessionError.unauthorized();
    return { id: sessionId, contextRevision: currentContextRevision };
  });
  const getLatestCriticalHandoff = vi.fn(async (): Promise<PortfolioEntryCriticalHandoffCurrentness | null> => {
    if (options.sourceReadError) throw options.sourceReadError;
    return currentness;
  });
  const projector = vi.fn((input: ConfirmedCurrentCriticalHandoffInput): StarteriaPathProjection => {
    if (options.projectorError) throw options.projectorError;
    return options.projectorResult ?? projectStarteriaPath(input, projectionVersions);
  });
  const dependencies: StarteriaPathServiceDependencies = {
    getOwnedSessionContext,
    getLatestCriticalHandoff,
    projector,
  };

  return {
    service: new StarteriaPathService(dependencies),
    getOwnedSessionContext,
    getLatestCriticalHandoff,
    projector,
  };
}

function makeArtifact(overrides: Partial<PortfolioEntryCriticalHandoffRecord> = {}): PortfolioEntryCriticalHandoffRecord {
  return {
    id: sourceId,
    sessionId,
    artifactVersion: 2,
    schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
    sourceContextRevision: currentContextRevision,
    payload: makePayload('supported'),
    confirmationState: 'confirmed',
    confirmedAt: new Date('2026-10-10T12:00:00.000Z'),
    confirmedByUserId: ownerUserId,
    createdAt: new Date('2026-10-10T11:00:00.000Z'),
    updatedAt: new Date('2026-10-10T12:00:00.000Z'),
    ...overrides,
  };
}

function makePayload(conclusionStatus: CriticalHandoffProjection['conclusionStatus']): CriticalHandoffProjection {
  const insufficient = conclusionStatus === 'insufficient_basis';
  return {
    conclusionStatus,
    finalReading: insufficient ? null : 'The review arrives after the decision checkpoint.',
    decisionInView: insufficient ? null : 'Whether to adjust the next review checkpoint.',
    usableNow: insufficient ? [] : [{
      item: 'The current review schedule.',
      howItCanHelp: 'It provides a reference point for examining sequence.',
    }],
    decisionChangingUnknowns: insufficient ? [] : [{
      uncertainty: 'Whether the evidence can be prepared earlier.',
      whyItMatters: 'It may change the timing of the next review.',
    }],
    firstMovement: insufficient ? null : {
      movement: 'Compare the evidence arrival and review dates.',
      whyNow: 'The dates establish the observed sequence.',
      whatItMayClarify: 'Whether the checkpoint can use the evidence.',
      boundary: 'This comparison does not decide the business outcome.',
    },
  };
}
