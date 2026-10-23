import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const suite = process.env.P12_R1_BRIEF_PERSISTENCE_E2E === '1' ? describe : describe.skip;
const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55433/starteria_e2e';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const ids = { lead: 'p12r1-brief-lead', owner: 'p12r1-brief-owner', front: 'p12r1-brief-front', challenge: 'p12r1-brief-challenge', otherFront: 'p12r1-brief-other-front', otherChallenge: 'p12r1-brief-other-challenge', otherTenantFront: 'p12r1-brief-other-tenant-front', otherTenantChallenge: 'p12r1-brief-other-tenant-challenge', brief: 'p12r1-brief', version: 'p12r1-brief-v1', versionTwo: 'p12r1-brief-v2', draftVersion: 'p12r1-brief-v3-draft', otherTenantBrief: 'p12r1-brief-other-tenant', otherTenantVersion: 'p12r1-brief-other-tenant-v1', assignment: 'p12r1-brief-assignment', assignmentB: 'p12r1-brief-assignment-b' };

async function cleanup() {
  await prisma.portfolioHandoffAssignment.deleteMany({ where: { id: { startsWith: 'p12r1-brief-' } } });
  await prisma.challengeActivationBriefVersion.deleteMany({ where: { id: { startsWith: 'p12r1-brief-' } } });
  await prisma.challengeActivationBrief.deleteMany({ where: { OR: [{ id: ids.brief }, { id: { startsWith: 'p12r1-brief-' } }] } });
}

suite('P12-R1 ADR-008 persistence constraints', () => {
  beforeAll(async () => {
    await cleanup();
    for (const [id, email, role] of [[ids.lead, 'p12r1-lead@starteria.test', 'portfolio_lead'], [ids.owner, 'p12r1-owner@starteria.test', 'participante']] as const) {
      await prisma.user.upsert({ where: { id }, update: { email, role, roles: [role], initials: 'P1', skills: [] }, create: { id, email, name: id, role, roles: [role], initials: 'P1', skills: [] } });
    }
    await prisma.strategicFront.upsert({ where: { id: ids.front }, update: { organizationId: 'p12r1-org-a' }, create: { id: ids.front, name: 'P12 R1 front', organizationId: 'p12r1-org-a' } });
    await prisma.strategicFront.upsert({ where: { id: ids.otherFront }, update: { organizationId: 'p12r1-org-a' }, create: { id: ids.otherFront, name: 'P12 R1 other front', organizationId: 'p12r1-org-a' } });
    await prisma.strategicFront.upsert({ where: { id: ids.otherTenantFront }, update: { organizationId: 'p12r1-org-b' }, create: { id: ids.otherTenantFront, name: 'P12 R1 other tenant front', organizationId: 'p12r1-org-b' } });
    await prisma.challenge.upsert({ where: { id: ids.challenge }, update: { strategicFrontId: ids.front, title: 'P12 R1 challenge' }, create: { id: ids.challenge, strategicFrontId: ids.front, title: 'P12 R1 challenge' } });
    await prisma.challenge.upsert({ where: { id: ids.otherChallenge }, update: { strategicFrontId: ids.otherFront, title: 'P12 R1 other challenge' }, create: { id: ids.otherChallenge, strategicFrontId: ids.otherFront, title: 'P12 R1 other challenge' } });
    await prisma.challenge.upsert({ where: { id: ids.otherTenantChallenge }, update: { strategicFrontId: ids.otherTenantFront, title: 'P12 R1 other tenant challenge' }, create: { id: ids.otherTenantChallenge, strategicFrontId: ids.otherTenantFront, title: 'P12 R1 other tenant challenge' } });
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('enforces tenant/challenge scope, immutable confirmation, and durable sent Assignment reference', async () => {
    await prisma.challengeActivationBrief.create({ data: { id: ids.brief, organizationId: 'p12r1-org-a', challengeId: ids.challenge, createdByActorId: ids.lead } });
    await prisma.challengeActivationBriefVersion.create({ data: { id: ids.version, organizationId: 'p12r1-org-a', briefId: ids.brief, challengeId: ids.challenge, versionNumber: 1, intent: 'Reduce response delay', scope: 'Pilot only', strategicContextRefs: ['front:p12r1'], inheritedContext: { known: true }, constraintsSnapshot: ['legal review'], knownGaps: ['baseline unknown'], sourceRefs: ['source:one'], provenance: { origin: 'USER_CONFIRMED' }, createdByActorId: ids.lead } });
    await expect(prisma.challengeActivationBriefVersion.update({ where: { id: ids.version }, data: { intent: 'Overwrite history' } })).rejects.toThrow();
    const confirmed = await prisma.challengeActivationBriefVersion.update({ where: { id: ids.version }, data: { status: 'CONFIRMED', confirmedByActorId: ids.lead, confirmedAt: new Date() } });
    expect(confirmed.status).toBe('CONFIRMED');
    await expect(prisma.challengeActivationBriefVersion.update({ where: { id: ids.version }, data: { scope: 'Overwrite confirmed' } })).rejects.toThrow();

    const assignment = await prisma.portfolioHandoffAssignment.create({ data: { id: ids.assignment, organizationId: 'p12r1-org-a', challengeId: ids.challenge, targetKind: 'CHALLENGE', briefVersionId: ids.version, invitedEmailNormalized: 'p12r1-owner@starteria.test', createdByActorId: ids.lead, state: 'SENT', members: { create: { identityKey: 'p12r1-owner@starteria.test', userId: ids.owner, emailNormalized: 'p12r1-owner@starteria.test', role: 'OWNER' } } }, include: { briefVersion: true } });
    expect(assignment.briefVersion?.id).toBe(ids.version);
    await expect(prisma.challengeActivationBriefVersion.delete({ where: { id: ids.version } })).rejects.toThrow();

    const versionTwo = await prisma.challengeActivationBriefVersion.create({ data: { id: ids.versionTwo, organizationId: 'p12r1-org-a', briefId: ids.brief, challengeId: ids.challenge, versionNumber: 2, status: 'DRAFT', intent: 'Refined outcome', scope: 'Pilot only', strategicContextRefs: [], inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: {}, createdByActorId: ids.lead } });
    const confirmedTwo = await prisma.challengeActivationBriefVersion.update({ where: { id: versionTwo.id }, data: { status: 'CONFIRMED', confirmedByActorId: ids.lead, confirmedAt: new Date() } });
    const assignmentB = await prisma.portfolioHandoffAssignment.create({ data: { id: ids.assignmentB, organizationId: 'p12r1-org-a', challengeId: ids.challenge, targetKind: 'CHALLENGE', briefVersionId: confirmedTwo.id, invitedEmailNormalized: 'p12r1-owner@starteria.test', createdByActorId: ids.lead, state: 'SENT' }, include: { briefVersion: true } });
    const assignmentAAfterVersionTwo = await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: ids.assignment }, include: { briefVersion: true } });
    expect(assignmentAAfterVersionTwo.briefVersion?.id).toBe(ids.version);
    expect(assignmentB.briefVersion?.id).toBe(ids.versionTwo);
  });

  it('rejects null, draft, cross-Challenge and cross-tenant Versions at the database boundary before Send', async () => {
    await expect(prisma.portfolioHandoffAssignment.create({ data: { id: 'p12r1-brief-null-send', organizationId: 'p12r1-org-a', challengeId: ids.challenge, targetKind: 'CHALLENGE', invitedEmailNormalized: 'p12r1-owner@starteria.test', createdByActorId: ids.lead, state: 'SENT' } })).rejects.toThrow();
    await prisma.challengeActivationBriefVersion.create({ data: { id: ids.draftVersion, organizationId: 'p12r1-org-a', briefId: ids.brief, challengeId: ids.challenge, versionNumber: 3, intent: 'Draft only', scope: null, strategicContextRefs: [], inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: {}, createdByActorId: ids.lead } });
    await expect(prisma.portfolioHandoffAssignment.create({ data: { id: 'p12r1-brief-draft-send', organizationId: 'p12r1-org-a', challengeId: ids.challenge, targetKind: 'CHALLENGE', briefVersionId: ids.draftVersion, invitedEmailNormalized: 'p12r1-owner@starteria.test', createdByActorId: ids.lead, state: 'SENT' } })).rejects.toThrow();
    await expect(prisma.portfolioHandoffAssignment.create({ data: { id: 'p12r1-brief-wrong-challenge', organizationId: 'p12r1-org-a', challengeId: ids.otherChallenge, targetKind: 'CHALLENGE', briefVersionId: ids.version, invitedEmailNormalized: 'p12r1-owner@starteria.test', createdByActorId: ids.lead, state: 'SENT' } })).rejects.toThrow();
    await expect(prisma.challengeActivationBrief.create({ data: { id: 'p12r1-brief-cross-tenant', organizationId: 'p12r1-org-b', challengeId: ids.challenge, createdByActorId: ids.lead } })).rejects.toThrow();
    await prisma.challengeActivationBrief.create({ data: { id: ids.otherTenantBrief, organizationId: 'p12r1-org-b', challengeId: ids.otherTenantChallenge, createdByActorId: ids.lead } });
    await prisma.challengeActivationBriefVersion.create({ data: { id: ids.otherTenantVersion, organizationId: 'p12r1-org-b', briefId: ids.otherTenantBrief, challengeId: ids.otherTenantChallenge, versionNumber: 1, status: 'CONFIRMED', intent: 'Other tenant', scope: null, strategicContextRefs: [], inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: {}, createdByActorId: ids.lead, confirmedByActorId: ids.lead, confirmedAt: new Date() } });
    await expect(prisma.portfolioHandoffAssignment.create({ data: { id: 'p12r1-brief-other-tenant-send', organizationId: 'p12r1-org-a', challengeId: ids.challenge, targetKind: 'CHALLENGE', briefVersionId: ids.otherTenantVersion, invitedEmailNormalized: 'p12r1-owner@starteria.test', createdByActorId: ids.lead, state: 'SENT' } })).rejects.toThrow();
    await expect(prisma.challengeActivationBriefVersion.create({ data: { id: 'p12r1-brief-out-of-sequence', organizationId: 'p12r1-org-a', briefId: ids.brief, challengeId: ids.challenge, versionNumber: 99, intent: null, scope: null, strategicContextRefs: [], inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: {}, createdByActorId: ids.lead } })).rejects.toThrow();
  });
});
