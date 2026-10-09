import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import type { CriticalHandoffProjection } from '../../portfolio-entry/presentation/critical-handoff-projection';
import {
  isCriticalHandoffCurrent,
  nextCriticalHandoffArtifactVersion,
  parseCriticalHandoffPayload,
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
  type PortfolioEntryCriticalHandoffRecord,
} from '../domain/portfolio-entry-critical-handoff.types';
import { PortfolioEntrySessionService } from '../application/portfolio-entry-session.service';
import { InMemoryPortfolioEntrySessionRepository } from '../infrastructure/in-memory-portfolio-entry-session.repository';
import { PrismaPortfolioEntrySessionMapper } from '../infrastructure/prisma-portfolio-entry-session.mapper';

const payload: CriticalHandoffProjection = {
  conclusionStatus: 'bounded',
  finalReading: 'La evidencia disponible todavía limita la decisión.',
  decisionInView: 'Qué preparar antes del próximo checkpoint.',
  usableNow: [{ item: 'El análisis actual.', howItCanHelp: 'Permite preparar la comparación.' }],
  decisionChangingUnknowns: [{ uncertainty: 'Cuándo llega la nueva señal.', whyItMatters: 'Puede cambiar la secuencia.' }],
  firstMovement: {
    movement: 'Revisar el análisis actual.',
    whyNow: 'El checkpoint está próximo.',
    whatItMayClarify: 'Qué evidencia queda disponible.',
    boundary: 'No decide por la persona.',
    existingAssetsUsed: ['El análisis actual.'],
  },
};

describe('Critical Handoff persistence boundary', () => {
  it('accepts provisional lifecycle only without confirmation evidence', () => {
    expect(() => mapCriticalHandoff({
      confirmationState: 'provisional',
      confirmedAt: null,
      confirmedByUserId: null,
    })).not.toThrow();
  });

  it('accepts confirmed lifecycle only with actor and timestamp evidence', () => {
    expect(() => mapCriticalHandoff({
      confirmationState: 'confirmed',
      confirmedAt: new Date('2026-10-09T10:05:00.000Z'),
      confirmedByUserId: 'user-1',
    })).not.toThrow();
  });

  it.each([
    ['confirmed without actor', { confirmationState: 'confirmed', confirmedAt: new Date('2026-10-09T10:05:00.000Z'), confirmedByUserId: null }],
    ['confirmed without timestamp', { confirmationState: 'confirmed', confirmedAt: null, confirmedByUserId: 'user-1' }],
    ['provisional with actor', { confirmationState: 'provisional', confirmedAt: null, confirmedByUserId: 'user-1' }],
    ['provisional with timestamp', { confirmationState: 'provisional', confirmedAt: new Date('2026-10-09T10:05:00.000Z'), confirmedByUserId: null }],
  ])('rejects malformed lifecycle: %s', (_description, lifecycle) => {
    expect(() => mapCriticalHandoff(lifecycle)).toThrow(/Invalid persisted Critical Handoff confirmation evidence/);
  });

  it('parses only the versioned public projection payload', () => {
    expect(parseCriticalHandoffPayload(PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, payload)).toEqual(payload);
    expect(() => parseCriticalHandoffPayload(PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, {
      ...payload,
      situation_model: { private: true },
    })).toThrow();
    expect(() => parseCriticalHandoffPayload(PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, {
      ...payload,
      firstMovement: { ...payload.firstMovement, epistemic_role: 'PROPOSAL' },
    })).toThrow();
    expect(() => parseCriticalHandoffPayload('critical-handoff-projection-v9.0', payload)).toThrow();
  });

  it('rejects malformed persisted JSON when mapping a stored artifact', () => {
    expect(() => new PrismaPortfolioEntrySessionMapper().toCriticalHandoff({
      id: 'critical-handoff-1',
      sessionId: 'session-1',
      artifactVersion: 1,
      schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
      sourceContextRevision: 0,
      sourceTurnId: null,
      payload: { unexpected: true } as Prisma.JsonObject,
      confirmationState: 'provisional',
      confirmedAt: null,
      confirmedByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })).toThrow(/Invalid persisted Critical Handoff payload/);
  });

  it('allocates artifact versions independently of session revision', () => {
    expect(nextCriticalHandoffArtifactVersion()).toBe(1);
    expect(nextCriticalHandoffArtifactVersion(1)).toBe(2);
    expect(nextCriticalHandoffArtifactVersion(8)).toBe(9);
  });

  it('is current only when it is latest and matches the current context revision', () => {
    const artifact = makeArtifact('handoff-1', 1, 4);
    const latest = makeArtifact('handoff-2', 2, 4);

    expect(isCriticalHandoffCurrent(artifact, artifact, 4)).toBe(true);
    expect(isCriticalHandoffCurrent(artifact, latest, 4)).toBe(false);
    expect(isCriticalHandoffCurrent(latest, latest, 5)).toBe(false);
  });

  it('rejects internal synthesis metadata at the typed session service boundary', async () => {
    const repository = new InMemoryPortfolioEntrySessionRepository();
    const service = new PortfolioEntrySessionService(repository, {
      ttlMs: 60_000,
      versioning: {
        contractVersion: 'portfolio-entry-contract-v0.1',
        runtimeVersion: 'portfolio-entry-runtime-v0.2',
        schemaVersion: 'portfolio-entry-schema-v0.2',
      },
    });
    const { session } = await service.createAnonymousSession({ rawEntry: 'Entrada', entryOrigin: 'public_start' });
    const unsafePayload = { ...payload, reasoning_metadata: { selected_lenses: ['private'] } } as CriticalHandoffProjection;

    await expect(service.createCriticalHandoff({
      sessionId: session.id,
      sourceContextRevision: 0,
      payload: unsafePayload,
    })).rejects.toThrow();
    await expect(service.getLatestCriticalHandoff(session.id)).resolves.toBeNull();
  });

  it('advances contextRevision only through its explicit primitive and leaves general revision alone', async () => {
    const repository = new InMemoryPortfolioEntrySessionRepository();
    const service = new PortfolioEntrySessionService(repository, {
      ttlMs: 60_000,
      versioning: {
        contractVersion: 'portfolio-entry-contract-v0.1',
        runtimeVersion: 'portfolio-entry-runtime-v0.2',
        schemaVersion: 'portfolio-entry-schema-v0.2',
      },
    });
    const { session } = await service.createAnonymousSession({ rawEntry: 'Entrada', entryOrigin: 'public_start' });

    await expect(service.readContextRevision(session.id)).resolves.toBe(0);
    await expect(service.advanceContextRevision(session.id, 0)).resolves.toBe(1);
    await expect(repository.findSessionById(session.id)).resolves.toMatchObject({ revision: 0, contextRevision: 1 });
    await expect(service.advanceContextRevision(session.id, 0)).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });
});

function makeArtifact(id: string, artifactVersion: number, sourceContextRevision: number): PortfolioEntryCriticalHandoffRecord {
  return {
    id,
    sessionId: 'session-1',
    artifactVersion,
    schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
    sourceContextRevision,
    sourceTurnId: undefined,
    payload,
    confirmationState: 'provisional',
    confirmedAt: null,
    confirmedByUserId: null,
    createdAt: new Date('2026-10-09T10:00:00.000Z'),
    updatedAt: new Date('2026-10-09T10:00:00.000Z'),
  };
}

function mapCriticalHandoff(lifecycle: {
  confirmationState: string;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
}) {
  return new PrismaPortfolioEntrySessionMapper().toCriticalHandoff({
    id: 'critical-handoff-lifecycle',
    sessionId: 'session-1',
    artifactVersion: 1,
    schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
    sourceContextRevision: 0,
    sourceTurnId: null,
    payload,
    ...lifecycle,
    createdAt: new Date('2026-10-09T10:00:00.000Z'),
    updatedAt: new Date('2026-10-09T10:00:00.000Z'),
  } as never);
}
