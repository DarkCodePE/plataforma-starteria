import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../modules/auth/password.service';

const databaseUrl = process.env.PL06B_ACCEPTANCE_DATABASE_URL;
const credentialPath = process.env.PL06B_ACCEPTANCE_CREDENTIAL_PATH;
const frontendUrl = process.env.PL06B_ACCEPTANCE_FRONTEND_URL ?? 'http://127.0.0.1:5178';
if (!databaseUrl || !credentialPath) throw new Error('PL06B acceptance runtime variables are required');

async function main(): Promise<void> {
 const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
 const email = 'pl06b-lead@starteria.test';
 const password = `PL06B-${randomBytes(18).toString('base64url')}!`;
 try {
  await prisma.user.update({ where: { id: 'pl06b-e2e-lead' }, data: { passwordHash: await hashPassword(password) } });
  await prisma.portfolioHandoffAssignment.deleteMany({ where: { id: 'kan171-zero-assignment' } });
  await prisma.portfolioOrganizationMaterialization.deleteMany({ where: { id: 'kan171-zero-materialization' } });
  await prisma.portfolioOrganizationProposal.deleteMany({ where: { id: 'kan171-zero-proposal' } });
  await prisma.portfolioBootstrapSession.deleteMany({ where: { id: 'kan171-zero-session' } });
  await prisma.challenge.deleteMany({ where: { id: 'kan171-zero-challenge' } });
  await prisma.strategicFront.update({
    where: { id: 'pl06b-e2e-front' },
    data: {
      name: 'PL06B Front',
      strategicObjective: 'Reducir la fricción de activación con una experiencia guiada',
    },
  });
  await prisma.challenge.update({
    where: { id: 'pl06b-e2e-challenge' },
    data: { title: 'Reducir fricción de activación' },
  });
  await prisma.user.upsert({
    where: { id: 'pl06b-e2e-existing-owner' },
    update: { organizationId: 'pl06b-e2e-org', email: 'pl06b-existing-owner@starteria.test' },
    create: { id: 'pl06b-e2e-existing-owner', email: 'pl06b-existing-owner@starteria.test', name: 'PL06B Existing Owner', initials: 'EO', skills: [], organizationId: 'pl06b-e2e-org', role: 'colaborador', roles: ['colaborador'] },
  });
  await prisma.portfolioHandoffAssignment.deleteMany({
    where: {
      organizationId: 'pl06b-e2e-org',
      OR: [
        { initiativeId: 'pl06b-simplification-canonical-project' },
        { invitedEmailNormalized: { startsWith: 'pl06b-simplified-' } },
      ],
    },
  });
  const projectId = 'pl06b-e2e-canonical-project';
  await prisma.project.upsert({
    where: { id: projectId },
    update: { name: 'Onboarding guiado canónico', organizationId: 'pl06b-e2e-org', ownerId: 'pl06b-e2e-existing-owner' },
    create: { id: projectId, name: 'Onboarding guiado canónico', description: 'Iniciativa existente vinculada al reto para aceptación PL-06B.', organizationId: 'pl06b-e2e-org', ownerId: 'pl06b-e2e-existing-owner', activationStatus: 'OWNER_CONFIRMED', retrospectiveAssessmentStatus: 'ASSESSED' },
  });
  await prisma.initiativePortfolioMeta.upsert({
    where: { projectId_challengeId: { projectId, challengeId: 'pl06b-e2e-challenge' } },
    update: { strategicFrontId: 'pl06b-e2e-front' },
    create: { id: 'pl06b-e2e-canonical-meta', projectId, challengeId: 'pl06b-e2e-challenge', strategicFrontId: 'pl06b-e2e-front', teamOwner: 'pl06b-existing-owner@starteria.test' },
  });
  const simplificationProjectId = 'pl06b-simplification-canonical-project';
  await prisma.project.upsert({
    where: { id: simplificationProjectId },
    update: { name: 'Recuperación temprana canónica', organizationId: 'pl06b-e2e-org', ownerId: 'pl06b-e2e-existing-owner' },
    create: {
      id: simplificationProjectId,
      name: 'Recuperación temprana canónica',
      description: 'Iniciativa elegible para validar el formulario principal simplificado.',
      organizationId: 'pl06b-e2e-org',
      ownerId: 'pl06b-e2e-existing-owner',
      activationStatus: 'OWNER_CONFIRMED',
      retrospectiveAssessmentStatus: 'ASSESSED',
    },
  });
  await prisma.initiativePortfolioMeta.upsert({
    where: { projectId_challengeId: { projectId: simplificationProjectId, challengeId: 'pl06b-e2e-challenge' } },
    update: { strategicFrontId: 'pl06b-e2e-front' },
    create: {
      id: 'pl06b-simplification-canonical-meta',
      projectId: simplificationProjectId,
      challengeId: 'pl06b-e2e-challenge',
      strategicFrontId: 'pl06b-e2e-front',
      teamOwner: 'pl06b-existing-owner@starteria.test',
    },
  });

  const emptyChallengeId = 'pl06b-simplification-empty-challenge';
  await prisma.challenge.upsert({
    where: { id: emptyChallengeId },
    update: { title: 'Reto sin iniciativas canónicas elegibles' },
    create: {
      id: emptyChallengeId,
      strategicFrontId: 'pl06b-e2e-front',
      title: 'Reto sin iniciativas canónicas elegibles',
      description: 'Fixture desechable para comprobar la modalidad de reto sin Projects.',
    },
  });
  await prisma.challengeActivationBrief.upsert({
    where: { id: 'pl06b-simplification-empty-brief' },
    update: {},
    create: {
      id: 'pl06b-simplification-empty-brief',
      organizationId: 'pl06b-e2e-org',
      challengeId: emptyChallengeId,
      createdByActorId: 'pl06b-e2e-lead',
    },
  });
  await prisma.challengeActivationBriefVersion.upsert({
    where: { id: 'pl06b-simplification-empty-brief-v1' },
    update: {},
    create: {
      id: 'pl06b-simplification-empty-brief-v1',
      organizationId: 'pl06b-e2e-org',
      briefId: 'pl06b-simplification-empty-brief',
      challengeId: emptyChallengeId,
      versionNumber: 1,
      status: 'CONFIRMED',
      intent: 'Preparar un encargo de reto sin iniciativa existente.',
      scope: 'Validar el estado sin destinos canónicos elegibles.',
      strategicContextRefs: {},
      inheritedContext: {},
      constraintsSnapshot: [],
      knownGaps: [],
      sourceRefs: [],
      provenance: { source: 'PL06B_SIMPLIFICATION_E2E' },
      createdByActorId: 'pl06b-e2e-lead',
      confirmedByActorId: 'pl06b-e2e-lead',
      confirmedAt: new Date(),
    },
  });
  const extraId = 'pl06b-e2e-assignment-4';
  if (!await prisma.portfolioHandoffAssignment.findUnique({ where: { id: extraId } })) {
    const recipient = 'pl06b-recipient-4@starteria.test';
    await prisma.portfolioHandoffAssignment.create({ data: {
      id: extraId, organizationId: 'pl06b-e2e-org', challengeId: 'pl06b-e2e-challenge', targetKind: 'CHALLENGE', briefVersionId: 'pl06b-e2e-brief-v1',
      contextNote: 'Segundo encargo preparado para comprobar seleccion parcial.', invitedEmailNormalized: recipient, createdByActorId: 'pl06b-e2e-lead',
      members: { create: [{ identityKey: recipient, emailNormalized: recipient, role: 'OWNER' }] },
    } });
  }
  const existingAssignmentId = 'pl06b-e2e-assignment-existing';
  if (!await prisma.portfolioHandoffAssignment.findUnique({ where: { id: existingAssignmentId } })) {
    const recipient = 'pl06b-existing-owner@starteria.test';
    await prisma.portfolioHandoffAssignment.create({ data: {
      id: existingAssignmentId, organizationId: 'pl06b-e2e-org', challengeId: 'pl06b-e2e-challenge', targetKind: 'EXISTING_INITIATIVE', initiativeId: projectId, briefVersionId: 'pl06b-e2e-brief-v1',
      contextNote: 'Continuar la iniciativa canónica sin crear Project ni Steps.', invitedEmailNormalized: recipient, createdByActorId: 'pl06b-e2e-lead',
      members: { create: [{ identityKey: recipient, emailNormalized: recipient, role: 'OWNER' }] },
    } });
  }
  // KAN-180 browser acceptance starts with one real SMTP-processed Assignment.
  // The browser creates one more SENT and two CREATED so the closing scenario is exactly 2 + 2.
  await prisma.portfolioHandoffAssignment.deleteMany({
    where: {
      organizationId: 'pl06b-e2e-org',
      OR: [
        { id: { in: ['pl06b-e2e-assignment-1', 'pl06b-e2e-assignment-3', extraId, existingAssignmentId] } },
        { invitedEmailNormalized: { startsWith: 'kan171-visual-' } },
        { invitedEmailNormalized: { startsWith: 'kan180-created-' } },
      ],
    },
  });
  await prisma.portfolioHandoffAssignment.update({
    where: { id: 'pl06b-e2e-assignment-2' },
    data: { state: 'SENT', viewedAt: null },
  });
  await prisma.portfolioHandoffProjection.update({
    where: { assignmentId: 'pl06b-e2e-assignment-2' },
    data: { organizationId: 'pl06b-e2e-org', handoffState: 'SENT', lastMaterialEvent: 'invitation_sent', generatedAt: new Date() },
  });
  const sessionId = 'pl06b-e2e-bootstrap';
  const proposalId = 'pl06b-e2e-organization-proposal';
  await prisma.portfolioBootstrapSession.upsert({ where: { id: sessionId }, update: { status: 'reading_published', bootstrapPhase: 'B5_FIRST_READING', organizationId: 'pl06b-e2e-org', setupCompletedAt: null, setupCompletedByActorId: null, setupCompletionIdempotencyKey: null }, create: { id: sessionId, userId: 'pl06b-e2e-lead', organizationId: 'pl06b-e2e-org', status: 'reading_published', bootstrapPhase: 'B5_FIRST_READING', existingWorkStatus: 'has_work' } });
  await prisma.portfolioAnchor.upsert({ where: { bootstrapSessionId: sessionId }, update: {}, create: { bootstrapSessionId: sessionId, outcomeStatement: 'Reducir friccion de activacion', contextSummary: 'Contexto de aceptacion PL-06B', decisionToEnable: 'Priorizar la primera barrera', status: 'anchor_confirmed', sourceRefs: [], provenanceStatus: 'user_confirmed', confirmedBy: 'pl06b-e2e-lead', confirmedAt: new Date() } });
  const payload = { summary: 'Estructura confirmada para aceptacion PL-06B.', fronts: [{ candidateId: 'pl06b-front-candidate', name: 'PL06B Front', focus: 'Activacion', rationale: 'Aceptacion aislada', coverage: '1 de 1', challenges: [{ candidateId: 'pl06b-challenge-candidate', title: 'Reducir friccion de activacion', problem: 'Existe friccion.', rationale: 'Permite decidir.', relatedInitiativeIds: [], evidence: [], gaps: [], overlaps: [] }] }], crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [] };
  await prisma.portfolioOrganizationProposal.upsert({ where: { id: proposalId }, update: { status: 'materialized', payload }, create: { id: proposalId, bootstrapSessionId: sessionId, organizationId: 'pl06b-e2e-org', version: 1, status: 'materialized', sourceVersion: 'pl06b-e2e-source-v1', payloadHash: 'pl06b-e2e-payload', payload, sourceRefs: [], provenance: { source: 'PL06B_E2E' }, reviewedBy: 'pl06b-e2e-lead' } });
  await prisma.portfolioOrganizationMaterialization.upsert({ where: { proposalId }, update: {}, create: { id: 'pl06b-e2e-materialization', proposalId, bootstrapSessionId: sessionId, organizationId: 'pl06b-e2e-org', proposalVersion: 1, approvalFingerprint: 'pl06b-e2e-approved', idempotencyKey: 'pl06b-e2e-materialize', canonicalMappings: { fronts: [{ candidateId: 'pl06b-front-candidate', canonicalId: 'pl06b-e2e-front' }], challenges: [{ candidateId: 'pl06b-challenge-candidate', canonicalId: 'pl06b-e2e-challenge' }] }, confirmedBy: 'pl06b-e2e-lead' } });
  await mkdir(dirname(credentialPath), { recursive: true });
  await writeFile(credentialPath, `URL=${frontendUrl}\nEMAIL=${email}\nPASSWORD=${password}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`Acceptance identity prepared; credentials stored at ${credentialPath}\n`);
 } finally {
   await prisma.$disconnect();
 }
}

void main();
