import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ImportedInitiativeCanonicalizationService } from '../imported-initiative-canonicalization.service';

const suite = process.env.ADR009_E2E === '1' ? describe.sequential : describe.skip;
const prisma = new PrismaClient(process.env.E2E_DATABASE_URL
  ? { datasources: { db: { url: process.env.E2E_DATABASE_URL } } }
  : undefined);

const ids = {
  organization: 'adr009-org', otherOrganization: 'adr009-other-org',
  lead: 'adr009-lead', owner: 'adr009-owner', otherLead: 'adr009-other-lead',
  session: 'adr009-session', otherSession: 'adr009-other-session',
  workRegister: 'adr009-work-register', workLink: 'adr009-work-link', otherWork: 'adr009-other-work',
  challenge: 'adr009-challenge', front: 'adr009-front', existingProject: 'adr009-existing-project',
};

suite('ADR-009 canonical documentary initiative persistence', () => {
  const service = new ImportedInitiativeCanonicalizationService(prisma);
  let registerVersion = '';
  let linkVersion = '';

  beforeAll(async () => {
    await prisma.organization.createMany({ data: [
      { id: ids.organization, name: 'ADR009 Disposable', slug: ids.organization },
      { id: ids.otherOrganization, name: 'ADR009 Other', slug: ids.otherOrganization },
    ] });
    await prisma.user.createMany({ data: [
      { id: ids.lead, email: 'adr009-lead@starteria.test', name: 'ADR009 Lead', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'AL', skills: [], organizationId: ids.organization },
      { id: ids.owner, email: 'adr009-owner@starteria.test', name: 'Existing Owner', role: 'participante', roles: ['participante'], initials: 'EO', skills: [], organizationId: ids.organization },
      { id: ids.otherLead, email: 'adr009-other@starteria.test', name: 'Other Lead', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'OL', skills: [], organizationId: ids.otherOrganization },
    ] });
    await prisma.portfolioBootstrapSession.createMany({ data: [
      { id: ids.session, userId: ids.lead, organizationId: ids.organization, existingWorkStatus: 'has_work' },
      { id: ids.otherSession, userId: ids.otherLead, organizationId: ids.otherOrganization, existingWorkStatus: 'has_work' },
    ] });
    const source = await prisma.portfolioBootstrapWorkIntakeSource.create({ data: { bootstrapSessionId: ids.session, sourceType: 'manual_entry', rawInput: 'ADR009', requestHash: 'adr009-source', createdBy: ids.lead } });
    const otherSource = await prisma.portfolioBootstrapWorkIntakeSource.create({ data: { bootstrapSessionId: ids.otherSession, sourceType: 'manual_entry', rawInput: 'Other', requestHash: 'adr009-other-source', createdBy: ids.otherLead } });
    await prisma.portfolioBootstrapWorkItem.createMany({ data: [
      { id: ids.workRegister, bootstrapSessionId: ids.session, sourceId: source.id, rawLabel: 'Onboarding guiado', proposedPurpose: 'Reducir abandono.', sourceType: 'manual_entry', sourceRefs: { row: 1 }, createdBy: ids.lead },
      { id: ids.workLink, bootstrapSessionId: ids.session, sourceId: source.id, rawLabel: 'Evidence for existing', sourceType: 'manual_entry', sourceRefs: { row: 2 }, createdBy: ids.lead },
      { id: ids.otherWork, bootstrapSessionId: ids.otherSession, sourceId: otherSource.id, rawLabel: 'Cross tenant', sourceType: 'manual_entry', sourceRefs: { row: 1 }, createdBy: ids.otherLead },
    ] });
    const records = await prisma.portfolioBootstrapWorkItem.findMany({ where: { id: { in: [ids.workRegister, ids.workLink] } } });
    registerVersion = records.find((item) => item.id === ids.workRegister)!.updatedAt.toISOString();
    linkVersion = records.find((item) => item.id === ids.workLink)!.updatedAt.toISOString();
    await prisma.strategicFront.create({ data: { id: ids.front, name: 'ADR009 Front', organizationId: ids.organization } });
    await prisma.challenge.create({ data: { id: ids.challenge, strategicFrontId: ids.front, title: 'Reduce activation friction' } });
    const proposal = await prisma.portfolioOrganizationProposal.create({ data: { bootstrapSessionId: ids.session, organizationId: ids.organization, version: 1, status: 'materialized', sourceVersion: 'adr009', payloadHash: 'adr009', payload: {}, sourceRefs: {}, provenance: { source: 'HUMAN_CONFIRMED' }, reviewedBy: ids.lead } });
    await prisma.portfolioOrganizationMaterialization.create({ data: { proposalId: proposal.id, bootstrapSessionId: ids.session, organizationId: ids.organization, proposalVersion: 1, approvalFingerprint: 'adr009-approval', idempotencyKey: 'adr009-materialization', canonicalMappings: { challenges: [{ canonicalId: ids.challenge, relatedInitiativeIds: [ids.workRegister, ids.workLink] }], specialDestinations: {} }, confirmedBy: ids.lead } });
    await prisma.project.create({ data: { id: ids.existingProject, name: 'Existing canonical initiative', ownerId: ids.owner, organizationId: ids.organization, currentStep: 2, status: 'IN_PROGRESS' } });
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it('registers atomically with owner pending, no Steps and stable IDs across concurrent/re-keyed retries', async () => {
    const invitationsBefore = await prisma.portfolioHandoffInvitation.count();
    const input = {
      organizationId: ids.organization, challengeId: ids.challenge, workItemId: ids.workRegister,
      mode: 'REGISTER_EXISTING' as const, expectedWorkItemUpdatedAt: registerVersion,
      identityConfirmed: true as const, alignmentConfirmed: true as const,
      actorId: ids.lead, idempotencyKey: 'adr009-register-1',
    };
    const concurrent = await Promise.all([service.execute(input), service.execute(input)]);
    expect(concurrent[0].project.id).toBe(concurrent[1].project.id);
    const differentKey = await service.execute({ ...input, idempotencyKey: 'adr009-register-2' });
    expect(differentKey.project.id).toBe(concurrent[0].project.id);
    expect(differentKey.link.id).toBe(concurrent[0].link.id);

    const project = await prisma.project.findUniqueOrThrow({ where: { id: concurrent[0].project.id }, include: { steps: true, teamMembers: true, initiativeCycles: true, portfolioMeta: true } });
    expect(project).toMatchObject({ organizationId: ids.organization, ownerId: null, origin: 'imported', activationStatus: 'OWNER_PENDING', retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT' });
    expect(project.steps).toHaveLength(0);
    expect(project.teamMembers).toHaveLength(0);
    expect(project.initiativeCycles).toHaveLength(0);
    expect(project.portfolioMeta).toEqual([expect.objectContaining({ challengeId: ids.challenge, status: 'pending_retroactive_assessment', currentStep: null })]);
    expect(await prisma.portfolioHandoffInvitation.count()).toBe(invitationsBefore);
    expect(await prisma.portfolioImportedInitiativeLink.count({ where: { workItemId: ids.workRegister, status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { initiativeId: project.id } })).toBe(0);
    expect(await prisma.portfolioHandoffInvitation.count()).toBe(invitationsBefore);

    await expect(service.execute({ ...input, idempotencyKey: 'adr009-register-conflict', name: 'Changed identity' }))
      .rejects.toMatchObject({ code: 'IMPORTED_INITIATIVE_CORRESPONDENCE_CONFLICT', statusCode: 409 });
  });

  it('links an existing same-tenant Project without changing owner, Steps or progress', async () => {
    const invitationsBefore = await prisma.portfolioHandoffInvitation.count();
    const before = await prisma.project.findUniqueOrThrow({ where: { id: ids.existingProject }, include: { steps: true } });
    const result = await service.execute({
      organizationId: ids.organization, challengeId: ids.challenge, workItemId: ids.workLink,
      mode: 'LINK_EXISTING', projectId: ids.existingProject, expectedWorkItemUpdatedAt: linkVersion,
      identityConfirmed: true, alignmentConfirmed: true, actorId: ids.lead, idempotencyKey: 'adr009-link-1',
    });
    expect(result.project.id).toBe(ids.existingProject);
    const after = await prisma.project.findUniqueOrThrow({ where: { id: ids.existingProject }, include: { steps: true } });
    expect(after.ownerId).toBe(before.ownerId);
    expect(after.currentStep).toBe(before.currentStep);
    expect(after.status).toBe(before.status);
    expect(after.steps).toEqual(before.steps);
    expect(await prisma.initiativePortfolioMeta.count({ where: { projectId: ids.existingProject, challengeId: ids.challenge } })).toBe(1);
    expect(await prisma.portfolioHandoffInvitation.count()).toBe(invitationsBefore);
  });

  it('rejects stale source state, unconfirmed alignment and cross-tenant references without partial writes', async () => {
    await expect(service.execute({
      organizationId: ids.organization, challengeId: ids.challenge, workItemId: ids.otherWork,
      mode: 'REGISTER_EXISTING', expectedWorkItemUpdatedAt: new Date().toISOString(), identityConfirmed: true,
      alignmentConfirmed: true, actorId: ids.lead, idempotencyKey: 'adr009-cross-tenant',
    })).rejects.toMatchObject({ code: 'IMPORTED_INITIATIVE_NOT_FOUND' });
    await expect(service.execute({
      organizationId: ids.organization, challengeId: ids.challenge, workItemId: ids.workRegister,
      mode: 'REGISTER_EXISTING', expectedWorkItemUpdatedAt: '2020-01-01T00:00:00.000Z', identityConfirmed: true,
      alignmentConfirmed: true, actorId: ids.lead, idempotencyKey: 'adr009-stale',
    })).rejects.toMatchObject({ code: 'IMPORTED_INITIATIVE_SOURCE_VERSION_CONFLICT' });
    expect(await prisma.portfolioImportedInitiativeLink.count({ where: { idempotencyKey: { in: ['adr009-cross-tenant', 'adr009-stale'] } } })).toBe(0);
  });
});
