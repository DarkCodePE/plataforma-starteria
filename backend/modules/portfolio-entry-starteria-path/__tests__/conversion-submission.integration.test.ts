import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { ConversionSubmissionService, conversionSubmissionSchema } from '../application/conversion-submission.service';

const describeIntegration = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
let sessionId: string | null = null;

async function seedOwnedSource() {
  const session = await prisma.portfolioEntrySession.create({ data: {
    ownerUserId: 'test-owner', ownershipState: 'CLAIMED', rawEntry: '', entryOrigin: 'public_start',
    interactionMode: 'test', semanticState: {}, questionBudget: {},
    contractVersion: 'portfolio-entry-contract-v0.1', runtimeVersion: 'portfolio-entry-runtime-v0.2',
    schemaVersion: 'portfolio-entry-schema-v0.2', lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  } });
  sessionId = session.id;
  const handoff = await prisma.portfolioEntryCriticalHandoff.create({ data: {
    sessionId, artifactVersion: 1, schemaVersion: 'critical-handoff-projection-v0.1',
    sourceContextRevision: 0, confirmationState: 'confirmed', confirmedAt: new Date(),
    confirmedByUserId: 'test-owner', payload: {
      conclusionStatus: 'supported', finalReading: 'A supported reading', decisionInView: 'A decision in view',
      usableNow: [], decisionChangingUnknowns: [], firstMovement: null,
    },
  } });
  return { session, handoff };
}

function verifiedDemoConfig() {
  return { version: 9, commercialOwner: 'commercial@example.org', approvedExternalDestinations: [],
    destinations: [{ type: 'DEMO' as const, status: 'VERIFIED_ACTIVE' as const,
      destinationKind: 'FIRST_PARTY' as const, receiver: 'CONVERSION_SUBMISSION_V1' as const,
      contextSharingSupported: true as const }],
  };
}

function submissionRequest(handoffId: string, changes: Record<string, unknown> = {}) {
  return conversionSubmissionSchema.parse({
    destinationType: 'DEMO', purpose: 'DEMO_REQUEST', destinationConfigVersion: 9,
    sourceBinding: { criticalHandoffId: handoffId, criticalHandoffVersion: 1, sourceContextRevision: 0,
      projectionVersion: 'starteria-path-projection-v0.1',
      businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1', pathSchemaVersion: 'starteria-path-dto-v0.2' },
    email: 'Person@Example.ORG', contextSharingMode: 'NO_ENTRY_CONTEXT_SHARED',
    idempotencyKey: 'integration-conversion-0001', ...changes,
  });
}

async function isolatedCounts() {
  const [organization, strategicFront, challenge, project, step, decision, pilotLead] = await Promise.all([
    prisma.organization.count(), prisma.strategicFront.count(), prisma.challenge.count(),
    prisma.project.count(), prisma.step.count(), prisma.decision.count(), prisma.pilotLead.count(),
  ]);
  return { organization, strategicFront, challenge, project, step, decision, pilotLead };
}

describeIntegration('125E conversion submission PostgreSQL boundary', () => {
  afterEach(async () => {
    if (!sessionId) return;
    await prisma.portfolioEntryConversionSubmission.deleteMany({ where: { sessionId } });
    await prisma.portfolioEntryCriticalHandoff.deleteMany({ where: { sessionId } });
    await prisma.portfolioEntrySession.delete({ where: { id: sessionId } });
    sessionId = null;
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('locks the owned source, persists one atomic receipt and replays the unique key', async () => {
    const { session, handoff } = await seedOwnedSource();
    const beforeCanonical = await isolatedCounts();
    const send = vi.fn(async () => true);
    const service = new ConversionSubmissionService(prisma, verifiedDemoConfig, { enabled: true, send });
    const request = submissionRequest(handoff.id, {
      contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION',
      explicitContextConsent: true, decisionInViewPreview: 'A decision in view',
    });
    const [first, replay] = await Promise.all([
      service.submit(session.id, 'test-owner', request),
      service.submit(session.id, 'test-owner', request),
    ]);
    expect([first.idempotentReplay, replay.idempotentReplay].sort()).toEqual([false, true]);
    expect(replay.submissionId).toBe(first.submissionId);
    expect(await prisma.portfolioEntryConversionSubmission.count({ where: { sessionId } })).toBe(1);
    const row = await prisma.portfolioEntryConversionSubmission.findUniqueOrThrow({ where: { id: first.submissionId } });
    expect(row).toMatchObject({ contactEmail: 'Person@example.org', purpose: 'DEMO_REQUEST',
      contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION', sharedDecisionInView: 'A decision in view',
      criticalHandoffId: handoff.id, sourceContextRevision: 0,
      projectionVersion: 'starteria-path-projection-v0.1',
      businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
      pathSchemaVersion: 'starteria-path-dto-v0.2', consentScopeVersion: 'DECISION_IN_VIEW_V1' });
    expect(row.consentedAt).toBeInstanceOf(Date);
    expect(row.expiresAt).toBeNull();
    expect(send).toHaveBeenCalledOnce();
    expect(await isolatedCounts()).toEqual(beforeCanonical);
    await expect(service.submit(session.id, 'test-owner', submissionRequest(handoff.id, {
      email: 'other@example.org', contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION',
      explicitContextConsent: true, decisionInViewPreview: 'A decision in view',
    }))).rejects.toMatchObject({ code: 'CONVERSION_IDEMPOTENCY_CONFLICT' });
    expect(await prisma.portfolioEntryConversionSubmission.count({ where: { sessionId } })).toBe(1);
  });

  it('stores no entry context by default and never copies a Path, raw reasoning or legacy lead', async () => {
    const { session, handoff } = await seedOwnedSource();
    const beforeCanonical = await isolatedCounts();
    const service = new ConversionSubmissionService(prisma, verifiedDemoConfig, { enabled: false, send: vi.fn() });
    const receipt = await service.submit(session.id, 'test-owner', submissionRequest(handoff.id));
    const row = await prisma.portfolioEntryConversionSubmission.findUniqueOrThrow({ where: { id: receipt.submissionId } });
    expect(row).toMatchObject({ contextSharingMode: 'NO_ENTRY_CONTEXT_SHARED',
      sharedDecisionInView: null, consentedAt: null, consentScopeVersion: null });
    expect(Object.keys(row)).not.toEqual(expect.arrayContaining([
      'rawConversation', 'rawCriticalHandoff', 'fullStarteriaPath', 'selected_lenses',
      'reasoningMetadata', 'provenance', 'modelId', 'providerId', 'phone', 'role', 'notes',
    ]));
    expect(await isolatedCounts()).toEqual(beforeCanonical);
  });

  it('rejects stale source and changed destination before any durable write', async () => {
    const { session, handoff } = await seedOwnedSource();
    const beforeCanonical = await isolatedCounts();
    const config = verifiedDemoConfig();
    const service = new ConversionSubmissionService(prisma, () => config, { enabled: false, send: vi.fn() });
    const request = submissionRequest(handoff.id);
    await prisma.portfolioEntrySession.update({ where: { id: session.id }, data: { contextRevision: 1 } });
    await expect(service.submit(session.id, 'test-owner', request))
      .rejects.toMatchObject({ code: 'CONVERSION_SOURCE_STALE' });
    expect(await prisma.portfolioEntryConversionSubmission.count({ where: { sessionId } })).toBe(0);
    await prisma.portfolioEntrySession.update({ where: { id: session.id }, data: { contextRevision: 0 } });
    config.destinations.length = 0;
    await expect(service.submit(session.id, 'test-owner', request))
      .rejects.toMatchObject({ code: 'CONVERSION_DESTINATION_UNAVAILABLE' });
    expect(await prisma.portfolioEntryConversionSubmission.count({ where: { sessionId } })).toBe(0);
    expect(await prisma.portfolioEntryCriticalHandoff.findUniqueOrThrow({ where: { id: handoff.id } }))
      .toMatchObject({ confirmationState: 'confirmed', sourceContextRevision: 0 });
    expect(await isolatedCounts()).toEqual(beforeCanonical);
  });
});
