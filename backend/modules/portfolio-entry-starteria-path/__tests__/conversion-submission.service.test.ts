import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Mailer } from '../../../shared/mail/mailer';
import { logger } from '../../../shared/utils/logger';
import { ConversionSubmissionService, conversionSubmissionSchema } from '../application/conversion-submission.service';

const sourceBinding = {
  criticalHandoffId: 'critical-1', criticalHandoffVersion: 1, sourceContextRevision: 3,
  projectionVersion: 'starteria-path-projection-v0.1',
  businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
  pathSchemaVersion: 'starteria-path-dto-v0.2',
} as const;
const request = {
  destinationType: 'DEMO', purpose: 'DEMO_REQUEST', destinationConfigVersion: 2,
  sourceBinding, email: 'Person@Example.ORG', contextSharingMode: 'NO_ENTRY_CONTEXT_SHARED',
  idempotencyKey: 'conversion-test-key-0001',
} as const;
const payload = {
  conclusionStatus: 'supported', finalReading: 'A current reading', decisionInView: 'Decide the next review.',
  usableNow: [], decisionChangingUnknowns: [], firstMovement: null,
};

function fixture(type: 'DEMO' | 'EARLY_ACCESS' = 'DEMO') {
  const rows: Array<Record<string, unknown>> = [];
  const session = {
    id: 'session-1', ownerUserId: 'user-1', ownershipState: 'CLAIMED', contextRevision: 3,
    expiresAt: new Date(Date.now() + 60_000), expiredAt: null as Date | null,
  };
  const source = {
    id: 'critical-1', sessionId: 'session-1', artifactVersion: 1, sourceContextRevision: 3,
    schemaVersion: 'critical-handoff-projection-v0.1', confirmationState: 'confirmed',
    confirmedAt: new Date(), confirmedByUserId: 'user-1', payload,
  };
  const config = {
    version: 2, commercialOwner: 'commercial@example.org', approvedExternalDestinations: [],
    destinations: [{ type, status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY',
      receiver: 'CONVERSION_SUBMISSION_V1', contextSharingSupported: true }],
  };
  let failCreate = false;
  const tx = {
    $queryRaw: vi.fn(async () => session.id ? [session] : []),
    portfolioEntryCriticalHandoff: { findFirst: vi.fn(async () => source) },
    portfolioEntryConversionSubmission: {
      findUnique: vi.fn(async ({ where }: { where: { sessionId_destinationType_idempotencyKeyHash: { idempotencyKeyHash: string } } }) =>
        rows.find((row) => row.idempotencyKeyHash === where.sessionId_destinationType_idempotencyKeyHash.idempotencyKeyHash) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (failCreate) throw new Error('private database email');
        const row = { id: 'submission-1', submittedAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
    },
  };
  const db = { $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)) } as unknown as PrismaClient;
  const transport: Mailer = { enabled: true, send: vi.fn(async () => true) };
  const service = new ConversionSubmissionService(db, () => config, transport);
  return { rows, session, source, config, tx, db, transport, service, setFailCreate: () => { failCreate = true; } };
}

describe('125E first-party conversion submission', () => {
  it.each([
    ['DEMO', 'DEMO_REQUEST'], ['EARLY_ACCESS', 'EARLY_ACCESS_REQUEST'],
  ] as const)('accepts a verified %s request as one bounded receipt', async (destinationType, purpose) => {
    const f = fixture(destinationType);
    const result = await f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse({
      ...request, destinationType, purpose,
    }));
    expect(result).toMatchObject({ destinationType, purpose, receiptStatus: 'RECEIVED', contextShared: false });
    expect(result).not.toHaveProperty('contactEmail');
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]).toMatchObject({ contactEmail: 'Person@example.org', contextSharingMode: 'NO_ENTRY_CONTEXT_SHARED',
      sharedDecisionInView: null, consentedAt: null, expiresAt: null, criticalHandoffId: 'critical-1',
      criticalHandoffVersion: 1, sourceContextRevision: 3,
      projectionVersion: sourceBinding.projectionVersion,
      businessCapabilityBoundaryVersion: sourceBinding.businessCapabilityBoundaryVersion,
      pathSchemaVersion: sourceBinding.pathSchemaVersion, consentScopeVersion: null });
    expect(f.transport.send).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(f.transport.send).mock.calls)).not.toContain('Decide the next review.');
  });

  it('rejects disabled destination and missing accountable owner without a write', async () => {
    const f = fixture();
    f.config.destinations[0].status = 'DISABLED';
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ code: 'CONVERSION_DESTINATION_UNAVAILABLE' });
    f.config.destinations[0].status = 'VERIFIED_ACTIVE';
    f.config.commercialOwner = '';
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ code: 'CONVERSION_DESTINATION_UNAVAILABLE' });
    expect(f.rows).toHaveLength(0);
  });

  it('rejects the governed empty destination configuration without a write', async () => {
    const f = fixture();
    f.config.destinations.length = 0;
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ code: 'CONVERSION_DESTINATION_UNAVAILABLE' });
    expect(f.rows).toHaveLength(0);
  });

  it('masks wrong-owner, unclaimed and missing sessions identically', async () => {
    const f = fixture();
    await expect(f.service.submit('session-1', 'user-2', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ statusCode: 404, code: 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND' });
    f.session.ownershipState = 'ANONYMOUS';
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ statusCode: 404, code: 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND' });
    f.session.ownershipState = 'CLAIMED';
    f.session.id = '';
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ statusCode: 404, code: 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND' });
    expect(f.rows).toHaveLength(0);
  });

  it('rejects unconfirmed, stale, changed-revision and unsupported source', async () => {
    const f = fixture();
    for (const change of [
      () => { f.source.confirmationState = 'provisional'; },
      () => { f.source.confirmationState = 'confirmed'; f.source.artifactVersion = 2; },
      () => { f.source.artifactVersion = 1; f.session.contextRevision = 4; },
      () => { f.session.contextRevision = 3; f.source.schemaVersion = 'unsupported'; },
      () => { f.source.schemaVersion = 'critical-handoff-projection-v0.1'; f.source.confirmedByUserId = ''; },
    ]) {
      change();
      await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
        .rejects.toMatchObject({ code: 'CONVERSION_SOURCE_STALE' });
    }
    expect(f.rows).toHaveLength(0);
  });

  it('rejects changed config version and invalid strict input', async () => {
    const f = fixture();
    f.config.version = 3;
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ code: 'CONVERSION_CONFIG_CHANGED' });
    expect(f.rows).toHaveLength(0);
    for (const bad of [
      { ...request, purpose: 'EARLY_ACCESS_REQUEST' },
      { ...request, email: 'bad-email' },
      { ...request, name: '   ' },
      { ...request, organization: '   ' },
      { ...request, email: 'person@example.org\n' },
      { ...request, phone: '123' },
      { ...request, idempotencyKey: 'bad key' },
    ]) expect(conversionSubmissionSchema.safeParse(bad).success).toBe(false);
  });

  it('stores only the current decision with explicit previewed opt-in', async () => {
    const f = fixture();
    const input = conversionSubmissionSchema.parse({ ...request, contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION',
      explicitContextConsent: true, decisionInViewPreview: payload.decisionInView });
    await f.service.submit('session-1', 'user-1', input);
    expect(f.rows[0].sharedDecisionInView).toBe(payload.decisionInView);
    expect(f.rows[0].consentedAt).toBeInstanceOf(Date);
    expect(f.rows[0].consentScopeVersion).toBe('DECISION_IN_VIEW_V1');
    expect(Object.keys(f.rows[0])).not.toEqual(expect.arrayContaining(['rawConversation', 'provider', 'model', 'pathSnapshot', 'leadScore', 'salesStage']));
    expect(JSON.stringify(f.rows[0])).not.toMatch(/raw conversation|hidden reasoning|provenance|PilotLead|CRM/);
  });

  it('stores the exact decision text shown in the opt-in preview', async () => {
    const f = fixture();
    f.source.payload = { ...payload, decisionInView: ' Decide the next review. ' };
    const result = await f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse({
      ...request, contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION', explicitContextConsent: true,
      decisionInViewPreview: ' Decide the next review. ',
    }));
    expect(result.contextShared).toBe(true);
    expect(f.rows[0].sharedDecisionInView).toBe(' Decide the next review. ');
  });

  it('rejects a changed preview and a config change during submit without writing', async () => {
    const f = fixture();
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse({
      ...request, contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION', explicitContextConsent: true,
      decisionInViewPreview: 'Older decision',
    }))).rejects.toMatchObject({ code: 'CONVERSION_CONSENT_STALE' });
    let reads = 0;
    const service = new ConversionSubmissionService(f.db, () => {
      reads += 1;
      if (reads === 3) f.config.version = 3;
      return f.config;
    }, f.transport);
    await expect(service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ code: 'CONVERSION_CONFIG_CHANGED' });
    expect(f.rows).toHaveLength(0);
  });

  it('does not invent context when an explicit opt-in has no current decision', async () => {
    const f = fixture();
    f.source.payload = { ...payload, decisionInView: null };
    const result = await f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse({
      ...request, contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION', explicitContextConsent: true,
    }));
    expect(result.contextShared).toBe(false);
    expect(f.rows[0].sharedDecisionInView).toBeNull();
  });

  it('replays an identical key without a second row or notification and conflicts on changed request', async () => {
    const f = fixture();
    const input = conversionSubmissionSchema.parse(request);
    const first = await f.service.submit('session-1', 'user-1', input);
    const replay = await f.service.submit('session-1', 'user-1', input);
    expect(replay).toMatchObject({ submissionId: first.submissionId, idempotentReplay: true });
    expect(f.rows).toHaveLength(1);
    expect(f.transport.send).toHaveBeenCalledOnce();
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse({ ...request, email: 'other@example.org' })))
      .rejects.toMatchObject({ code: 'CONVERSION_IDEMPOTENCY_CONFLICT' });
    expect(f.rows).toHaveLength(1);
  });

  it('keeps persistence atomic on failure and accepts despite notification failure', async () => {
    const f = fixture();
    const errorLog = vi.spyOn(logger, 'error');
    const warningLog = vi.spyOn(logger, 'warn');
    f.setFailCreate();
    await expect(f.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request)))
      .rejects.toMatchObject({ code: 'CONVERSION_SUBMISSION_FAILED' });
    expect(f.rows).toHaveLength(0);
    const next = fixture();
    vi.mocked(next.transport.send).mockRejectedValueOnce(new Error('private email detail'));
    const result = await next.service.submit('session-1', 'user-1', conversionSubmissionSchema.parse(request));
    expect(result.receiptStatus).toBe('RECEIVED');
    expect(next.rows).toHaveLength(1);
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/Person@Example|private database email|Decide the next review/);
    expect(JSON.stringify(warningLog.mock.calls)).not.toMatch(/Person@Example|private email detail|Decide the next review/);
    errorLog.mockRestore();
    warningLog.mockRestore();
  });
});
