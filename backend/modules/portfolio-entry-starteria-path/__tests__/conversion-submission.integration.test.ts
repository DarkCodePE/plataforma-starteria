import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { ConversionSubmissionService, conversionSubmissionSchema } from '../application/conversion-submission.service';

const describeIntegration = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
let sessionId: string | null = null;

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
    const send = vi.fn(async () => true);
    const service = new ConversionSubmissionService(prisma, () => ({
      version: 9, commercialOwner: 'commercial@example.org', approvedExternalDestinations: [],
      destinations: [{ type: 'DEMO', status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY',
        receiver: 'CONVERSION_SUBMISSION_V1', contextSharingSupported: true }],
    }), { enabled: true, send });
    const request = conversionSubmissionSchema.parse({
      destinationType: 'DEMO', purpose: 'DEMO_REQUEST', destinationConfigVersion: 9,
      sourceBinding: { criticalHandoffId: handoff.id, criticalHandoffVersion: 1, sourceContextRevision: 0,
        projectionVersion: 'starteria-path-projection-v0.1',
        businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1', pathSchemaVersion: 'starteria-path-dto-v0.2' },
      email: 'Person@Example.ORG', contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION',
      explicitContextConsent: true, decisionInViewPreview: 'A decision in view',
      idempotencyKey: 'integration-conversion-0001',
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
  });
});
