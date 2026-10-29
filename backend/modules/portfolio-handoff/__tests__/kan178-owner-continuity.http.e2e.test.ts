import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { hashRefreshToken } from '../../auth/token.service';

const run = process.env.RUN_KAN178_DB_E2E === '1';
const prisma = new PrismaClient();
const app = createApp();
const password = process.env.KAN178_E2E_PASSWORD ?? 'kan178-disposable-only';
const token = 'kan178-owner-ready-invitation-token-0000000000000000000000000001';

const ids = {
  organization: 'kan178-org', otherOrganization: 'kan178-other-org',
  lead: 'kan178-lead', owner: 'kan178-owner', other: 'kan178-other-owner',
  front: 'kan178-front', challenge: 'kan178-challenge', brief: 'kan178-brief', briefVersion: 'kan178-brief-v1',
  readyProject: 'kan178-project-ready', activationProject: 'kan178-project-activation', otherProject: 'kan178-project-other-tenant',
  readyAssignment: 'kan178-assignment-ready', activationAssignment: 'kan178-assignment-activation',
  challengeAssignment: 'kan178-assignment-challenge', tenantMismatchAssignment: 'kan178-assignment-tenant-mismatch',
};

async function upsertUser(input: { id: string; email: string; role: 'portfolio_lead' | 'colaborador'; organizationId: string }) {
  const passwordHash = await bcrypt.hash(password, 4);
  return prisma.user.upsert({
    where: { id: input.id },
    update: { email: input.email, role: input.role, roles: [input.role], organizationId: input.organizationId, passwordHash, isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    create: { id: input.id, email: input.email, name: input.id, initials: 'K1', skills: ['KAN-178'], role: input.role, roles: [input.role], organizationId: input.organizationId, passwordHash, isActive: true },
  });
}

async function createStartedAssignment(input: { id: string; targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE'; initiativeId: string | null }) {
  await prisma.portfolioHandoffAssignment.create({
    data: {
      id: input.id, organizationId: ids.organization, challengeId: ids.challenge, targetKind: input.targetKind,
      initiativeId: input.initiativeId, briefVersionId: ids.briefVersion, contextNote: 'Contexto exacto KAN-178',
      invitedEmailNormalized: 'kan178-owner@starteria.test', createdByActorId: ids.lead,
      state: 'STARTED', version: 5, acceptedAt: new Date(), acceptedBy: ids.owner, startedAt: new Date(), startedBy: ids.owner,
      members: { create: [{ identityKey: 'kan178-owner@starteria.test', emailNormalized: 'kan178-owner@starteria.test', userId: ids.owner, role: 'OWNER' }] },
    },
  });
}

describe.skipIf(!run)('KAN-178 Owner continuity disposable HTTP E2E', () => {
  let leadAccessToken = '';
  let ownerAccessToken = '';

  beforeAll(async () => {
    await prisma.organization.createMany({ data: [
      { id: ids.organization, name: 'KAN-178 Org', slug: 'kan178-org', seatLimit: 8 },
      { id: ids.otherOrganization, name: 'KAN-178 Other Org', slug: 'kan178-other-org', seatLimit: 8 },
    ], skipDuplicates: true });
    await upsertUser({ id: ids.lead, email: 'kan178-lead@starteria.test', role: 'portfolio_lead', organizationId: ids.organization });
    await upsertUser({ id: ids.owner, email: 'kan178-owner@starteria.test', role: 'colaborador', organizationId: ids.organization });
    await upsertUser({ id: ids.other, email: 'kan178-other@starteria.test', role: 'colaborador', organizationId: ids.otherOrganization });
    await prisma.organizationMember.createMany({ data: [
      { organizationId: ids.organization, userId: ids.lead, role: 'admin' },
      { organizationId: ids.organization, userId: ids.owner, role: 'member' },
      { organizationId: ids.otherOrganization, userId: ids.other, role: 'member' },
    ], skipDuplicates: true });
    await prisma.strategicFront.create({ data: { id: ids.front, name: 'KAN-178 Front', organizationId: ids.organization } });
    await prisma.challenge.create({ data: { id: ids.challenge, strategicFrontId: ids.front, title: 'Reducir friccion de activacion' } });
    await prisma.challengeActivationBrief.create({ data: { id: ids.brief, organizationId: ids.organization, challengeId: ids.challenge, createdByActorId: ids.lead } });
    await prisma.challengeActivationBriefVersion.create({ data: {
      id: ids.briefVersion, organizationId: ids.organization, briefId: ids.brief, challengeId: ids.challenge,
      versionNumber: 1, status: 'CONFIRMED', intent: 'Reducir la friccion de activacion', scope: 'Primeros siete dias',
      strategicContextRefs: {}, inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: { source: 'KAN-178-E2E' },
      createdByActorId: ids.lead, confirmedByActorId: ids.lead, confirmedAt: new Date(),
    } });
    await prisma.project.create({ data: {
      id: ids.readyProject, name: 'Iniciativa operativa KAN-178', organizationId: ids.organization, ownerId: ids.owner,
      status: 'IN_PROGRESS', currentStep: 2, step0Status: 'COMPLETED', activationStatus: 'OWNER_CONFIRMED', retrospectiveAssessmentStatus: 'ASSESSED',
      portfolioMeta: { create: { id: 'kan178-ready-meta', challengeId: ids.challenge, strategicFrontId: ids.front } },
      teamMembers: { create: { id: 'kan178-ready-member', userId: ids.owner, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } },
      steps: { create: [1, 2, 3, 4].map((number) => ({ number, name: `Step ${number}`, status: number === 1 ? 'APPROVED' : number === 2 ? 'IN_PROGRESS' : 'BLOCKED', progress: number === 1 ? 100 : 0 })) },
    } });
    await prisma.initiativeCycle.create({ data: {
      id: 'kan178-ready-cycle', projectId: ids.readyProject, cycleNumber: 1, startStep: 0, currentStep: 2, status: 'active',
      stepStates: { create: [
        { id: 'kan178-ready-state-0', stepNumber: 0, state: 'confirmed' },
        { id: 'kan178-ready-state-1', stepNumber: 1, state: 'confirmed' },
        { id: 'kan178-ready-state-2', stepNumber: 2, state: 'active' },
      ] },
      stepConfigurations: { create: {
        id: 'kan178-ready-config-2', projectId: ids.readyProject, stepNumber: 2, version: 1,
        status: 'active', routeType: 'explore_validate', depthLevel: 'standard', maturity: 'execution',
        configurationJson: { step: 2, visibleName: 'DiseÃ±ar apuesta y experimento', stablePurpose: 'Continuar desde el estado real', shortTitle: 'DiseÃ±ar apuesta', description: 'Continuar desde el estado real', objective: 'Retomar trabajo persistido', expectedOutput: 'Apuesta validable', nextAction: 'Continuar Step 2', checkpoints: [] },
        sourceContextJson: {},
      } },
      progressSignals: { create: {
        id: 'kan178-ready-signal', projectId: ids.readyProject, stepNumber: 2, health: 'in_progress',
        signalJson: { step: 2, health: 'in_progress', summary: 'Continuar Step 2', nextAction: 'Continuar Step 2' },
      } },
    } });
    await prisma.project.create({ data: {
      id: ids.activationProject, name: 'Iniciativa ADR-009 sin activar', organizationId: ids.organization, origin: 'imported',
      activationStatus: 'OWNER_PENDING', retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT',
      portfolioMeta: { create: { id: 'kan178-activation-meta', challengeId: ids.challenge, strategicFrontId: ids.front, status: 'pending_retroactive_assessment' } },
    } });
    await prisma.project.create({ data: {
      id: ids.otherProject, name: 'Iniciativa otro tenant', organizationId: ids.otherOrganization, ownerId: ids.other,
      activationStatus: 'OWNER_CONFIRMED', retrospectiveAssessmentStatus: 'ASSESSED',
      portfolioMeta: { create: { id: 'kan178-other-meta', challengeId: ids.challenge, strategicFrontId: ids.front } },
      teamMembers: { create: { id: 'kan178-other-member', userId: ids.owner, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } },
      steps: { create: { number: 1, name: 'Step 1', status: 'IN_PROGRESS' } },
    } });
    await prisma.portfolioHandoffAssignment.create({ data: {
      id: ids.readyAssignment, organizationId: ids.organization, challengeId: ids.challenge, targetKind: 'EXISTING_INITIATIVE',
      initiativeId: ids.readyProject, briefVersionId: ids.briefVersion, contextNote: 'Continuar desde el estado real',
      invitedEmailNormalized: 'kan178-owner@starteria.test', createdByActorId: ids.lead, state: 'SENT', version: 2, sentAt: new Date(),
      members: { create: [{ identityKey: 'kan178-owner@starteria.test', emailNormalized: 'kan178-owner@starteria.test', role: 'OWNER' }] },
      invitations: { create: { id: 'kan178-ready-invitation', tokenHash: hashRefreshToken(token) } },
    } });
    await createStartedAssignment({ id: ids.activationAssignment, targetKind: 'EXISTING_INITIATIVE', initiativeId: ids.activationProject });
    await createStartedAssignment({ id: ids.challengeAssignment, targetKind: 'CHALLENGE', initiativeId: null });
    await createStartedAssignment({ id: ids.tenantMismatchAssignment, targetKind: 'EXISTING_INITIATIVE', initiativeId: ids.otherProject });

    const [leadLogin, ownerLogin] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: 'kan178-lead@starteria.test', password }),
      request(app).post('/api/v1/auth/login').send({ email: 'kan178-owner@starteria.test', password }),
    ]);
    expect(leadLogin.status).toBe(200);
    expect(ownerLogin.status).toBe(200);
    leadAccessToken = leadLogin.body.data.accessToken;
    ownerAccessToken = ownerLogin.body.data.accessToken;
    expect(leadAccessToken).not.toBe(ownerAccessToken);
  });

  it('traces Invitation -> Claim -> Accept -> Start -> EXISTING_READY and stable re-entry', async () => {
    const before = await prisma.project.findUniqueOrThrow({ where: { id: ids.readyProject }, select: { ownerId: true, _count: { select: { steps: true, teamMembers: true } } } });
    const viewed = await request(app).get(`/api/v1/public/handoff-invitations/${token}`);
    expect(viewed.status).toBe(200);
    expect(viewed.body.data).toMatchObject({ assignmentId: ids.readyAssignment, state: 'VIEWED' });

    const claimed = await request(app).post('/api/v1/public/handoff-invitations/claim').set('Authorization', `Bearer ${ownerAccessToken}`).send({ token });
    expect(claimed.status).toBe(200);
    expect(claimed.body.data).toMatchObject({ identityClaimStatus: 'MATCHED', state: 'VIEWED', version: 3 });

    const accepted = await request(app).post(`/api/v1/handoff/assignments/${ids.readyAssignment}/accept`).set('Authorization', `Bearer ${ownerAccessToken}`).set('Idempotency-Key', 'kan178-accept-1').send({ expectedVersion: 3 });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data).toMatchObject({ state: 'ACCEPTED', version: 4, briefVersion: { id: ids.briefVersion, versionNumber: 1 } });

    const started = await request(app).post(`/api/v1/handoff/assignments/${ids.readyAssignment}/start`).set('Authorization', `Bearer ${ownerAccessToken}`).set('Idempotency-Key', 'kan178-start-1').send({ expectedVersion: 4, idempotencyKey: 'kan178-start-1' });
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ state: 'STARTED', version: 5, initiativeId: ids.readyProject, briefVersion: { id: ids.briefVersion } });

    const first = await request(app).get(`/api/v1/handoff/assignments/${ids.readyAssignment}/post-start-continuity`).set('Authorization', `Bearer ${ownerAccessToken}`);
    const reentry = await request(app).get(`/api/v1/handoff/assignments/${ids.readyAssignment}/post-start-continuity`).set('Authorization', `Bearer ${ownerAccessToken}`);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ outcome: 'EXISTING_READY', assignmentId: ids.readyAssignment, briefVersion: { id: ids.briefVersion }, project: { id: ids.readyProject, currentStep: 2, operationalStep: 2, activeCheckpointStep: null, stepCount: 4, workspacePath: `/projects/${ids.readyProject}` } });
    expect(reentry.body.data).toEqual(first.body.data);

    const after = await prisma.project.findUniqueOrThrow({ where: { id: ids.readyProject }, select: { ownerId: true, _count: { select: { steps: true, teamMembers: true } } } });
    expect(after).toEqual(before);
  });

  it('separates activation, formulation, identity and tenant outcomes without creating domain state', async () => {
    const [projectsBefore, stepsBefore] = await Promise.all([prisma.project.count(), prisma.step.count()]);
    const activation = await request(app).get(`/api/v1/handoff/assignments/${ids.activationAssignment}/post-start-continuity`).set('Authorization', `Bearer ${ownerAccessToken}`);
    const formulation = await request(app).get(`/api/v1/handoff/assignments/${ids.challengeAssignment}/post-start-continuity`).set('Authorization', `Bearer ${ownerAccessToken}`);
    const wrongIdentity = await request(app).get(`/api/v1/handoff/assignments/${ids.readyAssignment}/post-start-continuity`).set('Authorization', `Bearer ${leadAccessToken}`);
    const wrongTenant = await request(app).get(`/api/v1/handoff/assignments/${ids.tenantMismatchAssignment}/post-start-continuity`).set('Authorization', `Bearer ${ownerAccessToken}`);

    expect(activation.status).toBe(200);
    expect(activation.body.data).toMatchObject({ outcome: 'EXISTING_ACTIVATION_REQUIRED', initiativeId: ids.activationProject, reasons: expect.arrayContaining(['OPERATIONAL_ACCESS_REQUIRED', 'OWNER_ACTIVATION_REQUIRED', 'RETROSPECTIVE_ASSESSMENT_REQUIRED', 'STEPS_NOT_MATERIALIZED', 'OPERATIONAL_STATE_UNRESOLVED']), project: { stepCount: 0, operationalStep: null, activeCheckpointStep: null } });
    expect(formulation.status).toBe(200);
    expect(formulation.body.data).toMatchObject({ outcome: 'CHALLENGE_FORMULATION_REQUIRED', initiativeId: null, challenge: { id: ids.challenge }, briefVersion: { id: ids.briefVersion } });
    expect(wrongIdentity.status).toBe(403);
    expect(wrongIdentity.body.error.code).toBe('OWNER_CONTINUITY_ACCESS_DENIED');
    expect(wrongTenant.status).toBe(403);
    expect(wrongTenant.body.error.code).toBe('OWNER_CONTINUITY_ACCESS_DENIED');
    await expect(Promise.all([prisma.project.count(), prisma.step.count()])).resolves.toEqual([projectsBefore, stepsBefore]);
  });
});

