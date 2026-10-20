import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PortfolioHandoffResponseService, noopHandoffEventPort } from '../application/portfolio-handoff-response.service';
import { PortfolioHandoffReconstructionService } from '../application/portfolio-handoff-reconstruction.service';
import { PrismaPortfolioHandoffAssignmentRepository } from '../infrastructure/prisma-portfolio-handoff-assignment.repository';
import { PrismaPortfolioHandoffInvitationRepository } from '../infrastructure/prisma-portfolio-handoff-invitation.repository';
import { PrismaPortfolioHandoffResponseCommandRepository } from '../infrastructure/prisma-portfolio-handoff-response-command.repository';
import { PrismaPortfolioHandoffAtomicCommandRepository } from '../infrastructure/prisma-portfolio-handoff-atomic-command.repository';
import { InitialReviewService } from '../../initial-review/initial-review.service';
import { MockInitialReviewGenerator } from '../../initial-review/mock-generator';
import { RouteConfirmationService } from '../../initial-review/route-confirmation.service';
import { ProjectService } from '../../projects/project.service';

const describeP6Persistence = process.env.P6_PERSISTENCE_E2E === '1' ? describe : describe.skip;
const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55433/starteria_e2e';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const ids = {
  portfolio: 'p6-runtime-portfolio',
  owner: 'p6-runtime-owner',
  front: 'p6-runtime-front',
  challenge: 'p6-runtime-challenge',
  routeAAssignment: 'p6-runtime-assignment-a',
  routeBAssignment: 'p6-runtime-assignment-b',
};
const owner = { id: ids.owner, email: 'p6-runtime-owner@starteria.test' };

async function upsertUser(id: string, email: string, name: string, role: 'participante' | 'portfolio_lead') {
  return prisma.user.upsert({
    where: { id },
    update: { email, name, role, roles: [role], initials: name.slice(0, 2), skills: [] },
    create: { id, email, name, role, roles: [role], initials: name.slice(0, 2), skills: [] },
  });
}

async function createAssignment(input: { id: string; targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE'; initiativeId?: string | null }) {
  return prisma.portfolioHandoffAssignment.create({
    data: {
      id: input.id,
      organizationId: 'p6-runtime-org',
      portfolioScopeRef: 'p6-runtime-portfolio-scope',
      challengeId: ids.challenge,
      targetKind: input.targetKind,
      initiativeId: input.initiativeId ?? null,
      invitedEmailNormalized: owner.email,
      createdByActorId: ids.portfolio,
      state: 'SENT',
      members: { create: { identityKey: owner.email, emailNormalized: owner.email, userId: owner.id, label: 'P6 owner', role: 'OWNER' } },
      invitations: { create: { tokenHash: `p6-token-${input.id}`, claimedByUserId: owner.id, claimedAt: new Date() } },
    },
    include: { members: true },
  });
}

function responseService() {
  const assignments = new PrismaPortfolioHandoffAssignmentRepository(prisma);
  return new PortfolioHandoffResponseService(
    assignments,
    new PrismaPortfolioHandoffInvitationRepository(prisma),
    new PrismaPortfolioHandoffResponseCommandRepository(prisma),
    noopHandoffEventPort,
    () => new Date('2026-10-20T12:00:00.000Z'),
    new PrismaPortfolioHandoffAtomicCommandRepository(prisma),
  );
}

async function acceptAndStart(assignmentId: string) {
  const service = responseService();
  const accepted = await service.acceptHandoffAssignment({ assignmentId, actor: owner, expectedVersion: 1, idempotencyKey: `${assignmentId}-accept` });
  const acceptedReplay = await service.acceptHandoffAssignment({ assignmentId, actor: owner, expectedVersion: 1, idempotencyKey: `${assignmentId}-accept` });
  expect(acceptedReplay).toMatchObject({ id: assignmentId, state: 'ACCEPTED', version: accepted.version });
  const started = await service.startAssignedWork({ assignmentId, actor: owner, expectedVersion: accepted.version, idempotencyKey: `${assignmentId}-start` });
  const startedReplay = await service.startAssignedWork({ assignmentId, actor: owner, expectedVersion: accepted.version, idempotencyKey: `${assignmentId}-start` });
  expect(startedReplay).toMatchObject({ id: assignmentId, state: 'STARTED', version: started.version });
  return started;
}

describeP6Persistence('P6 post-Start persistence boundary', () => {
  beforeAll(async () => {
    await prisma.portfolioHandoffAssignment.deleteMany({ where: { id: { in: [ids.routeAAssignment, ids.routeBAssignment] } } });
    await prisma.initialReview.deleteMany({ where: { ownerId: ids.owner } });
    await prisma.project.deleteMany({ where: { ownerId: ids.owner } });
    await upsertUser(ids.portfolio, 'p6-runtime-portfolio@starteria.test', 'P6 Portfolio', 'portfolio_lead');
    await upsertUser(ids.owner, owner.email, 'P6 Owner', 'participante');
    await prisma.strategicFront.upsert({
      where: { id: ids.front },
      update: { constraints: 'No modificar datos personales sin aprobación.', mainKpi: 'Tiempo de resolución', target: 'Reducir 20%' },
      create: { id: ids.front, name: 'P6 Front', organizationId: 'p6-runtime-org', constraints: 'No modificar datos personales sin aprobación.', mainKpi: 'Tiempo de resolución', target: 'Reducir 20%' },
    });
    await prisma.challenge.upsert({
      where: { id: ids.challenge },
      update: { constraints: 'No desplegar sin revisión legal.', dependencies: 'Equipo legal', expectedDecision: 'Autorizar piloto', knownFacts: 'El proceso tarda 12 días.' },
      create: { id: ids.challenge, strategicFrontId: ids.front, title: 'P6 Challenge', constraints: 'No desplegar sin revisión legal.', dependencies: 'Equipo legal', expectedDecision: 'Autorizar piloto', knownFacts: 'El proceso tarda 12 días.' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Route A persists Accept/Start exactly once, creates no Initiative before confirmation, and links exactly one confirmed Initiative with the inherited mandate', async () => {
    await createAssignment({ id: ids.routeAAssignment, targetKind: 'CHALLENGE' });
    const started = await acceptAndStart(ids.routeAAssignment);
    expect(started.initiativeId).toBeNull();
    expect(await prisma.project.count({ where: { ownerId: owner.id } })).toBe(0);
    expect(await prisma.portfolioHandoffResponseCommand.count({ where: { assignmentId: ids.routeAAssignment, type: 'ACCEPT' } })).toBe(1);
    expect(await prisma.portfolioHandoffResponseCommand.count({ where: { assignmentId: ids.routeAAssignment, type: 'START' } })).toBe(1);

    const reviewService = new InitialReviewService(prisma, new MockInitialReviewGenerator());
    const review = await reviewService.createReview(owner.id, { originalInput: 'Reducir la espera del proceso sin desplegar cambios no revisados.', handoffAssignmentId: ids.routeAAssignment });
    const reviewReplay = await reviewService.createReview(owner.id, { originalInput: 'ignored on replay', handoffAssignmentId: ids.routeAAssignment });
    expect(reviewReplay.id).toBe(review.id);
    expect(await prisma.initialReview.count({ where: { handoffAssignmentId: ids.routeAAssignment } })).toBe(1);

    const confirmation = new RouteConfirmationService(prisma, new ProjectService(prisma));
    const first = await confirmation.confirmRoute(review.id, owner.id);
    const replay = await confirmation.confirmRoute(review.id, owner.id);
    expect(replay.initiativeId).toBe(first.initiativeId);

    const [assignment, project, routeConfirmation] = await Promise.all([
      prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: ids.routeAAssignment } }),
      prisma.project.findUniqueOrThrow({ where: { id: first.initiativeId } }),
      prisma.routeConfirmation.findUniqueOrThrow({ where: { reviewId: review.id } }),
    ]);
    expect(assignment.initiativeId).toBe(first.initiativeId);
    expect(routeConfirmation.createdProjectId).toBe(first.initiativeId);
    expect(await prisma.project.count({ where: { initialReviewSnapshotId: project.initialReviewSnapshotId } })).toBe(1);
    const step0Data = project.step0Data as any;
    expect(step0Data?.adaptiveCore?.masterContext?.contextSnapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'challenge', challengeId: ids.challenge, strategicFrontId: ids.front, constraints: expect.arrayContaining(['No desplegar sin revisión legal.', 'No modificar datos personales sin aprobación.']) }),
    ]));
  });

  it('Route B keeps the existing Initiative ID, recovers persisted history read-only, and leaves continuity review required without a safe active Core state', async () => {
    const projects = new ProjectService(prisma);
    const existing = await projects.createProject(owner.id, { name: 'P6 Existing Initiative', description: 'Existing work' }, 'participante');
    const source = await prisma.sourceRef.create({ data: { projectId: existing.id, sourceType: 'USER_INPUT', reference: 'P6 existing source', originActorId: owner.id } });
    await prisma.evidence.create({ data: { projectId: existing.id, ownerId: owner.id, name: 'P6 evidence', type: 'OTHER', stepRef: 0, sourceRefId: source.id } });
    await prisma.truthClaim.create({ data: { projectId: existing.id, subjectType: 'initiative', claimType: 'fact', statement: 'P6 history survives', createdById: owner.id } });
    await createAssignment({ id: ids.routeBAssignment, targetKind: 'EXISTING_INITIATIVE', initiativeId: existing.id });
    await acceptAndStart(ids.routeBAssignment);

    const before = await prisma.project.findUniqueOrThrow({ where: { id: existing.id } });
    const reconstruction = new PortfolioHandoffReconstructionService(prisma, new PrismaPortfolioHandoffAssignmentRepository(prisma), new ProjectService(prisma));
    const result = await reconstruction.readExistingInitiative({ assignmentId: ids.routeBAssignment, actor: { id: owner.id, role: 'participante' } });
    const after = await prisma.project.findUniqueOrThrow({ where: { id: existing.id } });
    expect(result).toMatchObject({ initiativeId: existing.id, continuityState: 'CONTINUITY_REVIEW_REQUIRED', recovered: { sourceRefs: 1, evidence: 1, claims: 1 } });
    expect(result.gaps.some((gap) => gap.code === 'ACTIVE_CORE_STATE_UNAVAILABLE')).toBe(true);
    expect(after).toMatchObject({ id: before.id, createdAt: before.createdAt, lastModified: before.lastModified });
    expect(await prisma.project.count({ where: { ownerId: owner.id, name: 'P6 Existing Initiative' } })).toBe(1);
  });

  it('Route C confirms one independent Initiative without Front or Challenge references', async () => {
    const review = await new InitialReviewService(prisma, new MockInitialReviewGenerator()).createReview(owner.id, {
      originalInput: 'Explorar una mejora independiente sin contexto corporativo.',
    });
    const confirmation = new RouteConfirmationService(prisma, new ProjectService(prisma));
    const first = await confirmation.confirmRoute(review.id, owner.id);
    const replay = await confirmation.confirmRoute(review.id, owner.id);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: first.initiativeId }, include: { portfolioMeta: true } });
    expect(replay.initiativeId).toBe(first.initiativeId);
    expect(project.portfolioMeta).toHaveLength(0);
    expect((project.step0Data as any)?.adaptiveCore?.masterContext?.contextSnapshots ?? []).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: 'challenge' })]));
  });
});
