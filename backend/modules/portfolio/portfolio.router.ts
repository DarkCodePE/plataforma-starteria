import { AppError } from '../../shared/errors/AppError';
import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioHomeReadService } from './portfolio-home.read-service';
import { ChallengeSplitService } from './challenge-split.service';
import { ChallengeCoverageReadService } from './challenge-coverage.read-service';
import { PortfolioCapacityReadService } from './portfolio-capacity.read-service';
import { resolvePortfolioScope } from './portfolio-scope';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { validate } from '../../shared/middleware/validate';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { requireEntitlement } from '../billing/entitlement.middleware';
import {
  createStrategicFrontSchema,
  updateStrategicFrontSchema,
  createChallengeSchema,
  updateChallengeSchema,
  addInvitationSchema,
  updateInvitationSchema,
  addSquadMemberSchema,
  updateSquadMemberSchema,
  addChallengeTeamMemberSchema,
  updateChallengeTeamMemberSchema,
  upsertInitiativeTeamMemberSchema,
  upsertInitiativeMetaSchema,
  createOverlapSchema,
  createExecutiveOutputSchema,
  updateExecutiveOutputSchema,
  confirmChallengeSplitSchema,
  assignInitiativeGovernanceSchema,
} from './portfolio.schemas';

const service = new PortfolioService(prisma);
const homeReadService = new PortfolioHomeReadService(prisma);
const controller = new PortfolioController(service, homeReadService);
const challengeSplit = new ChallengeSplitService(prisma);
const challengeCoverage = new ChallengeCoverageReadService(prisma);
const portfolioCapacity = new PortfolioCapacityReadService(prisma);

export const portfolioRouter = Router();

portfolioRouter.use(authenticate);

// PH-2: read-only consolidated Portfolio Home composition.
portfolioRouter.get('/home', controller.getHome);

// ADR-028: las escrituras son `admin` + `portfolio_lead`. `mentor` las tenía por no
// existir el rol correcto, no por decisión de producto; se le retiran aquí.
//
// Las lecturas se quedan SIN gate a propósito: `AppLayout` llama a
// `GET /initiatives/:projectId/meta` para todo usuario autenticado, así que cerrarlas
// rompería a los participantes. Deuda declarada en el `scope_out` de la feature.

// ─── Strategic Fronts ─────────────────────────────────────────────────────────
portfolioRouter.get('/strategic-fronts', controller.listStrategicFronts);

portfolioRouter.post(
  '/strategic-fronts',
  requirePermission('portfolio:write'),
  validate(createStrategicFrontSchema),
  controller.createStrategicFront,
);

portfolioRouter.patch(
  '/strategic-fronts/:id',
  requirePermission('portfolio:write'),
  validate(updateStrategicFrontSchema),
  controller.updateStrategicFront,
);

portfolioRouter.delete(
  '/strategic-fronts/:id',
  requirePermission('portfolio:write'),
  controller.deleteStrategicFront,
);

// ─── Challenges ───────────────────────────────────────────────────────────────
portfolioRouter.get(
  '/strategic-fronts/:frontId/challenges',
  controller.listChallenges,
);

portfolioRouter.post(
  '/strategic-fronts/:frontId/challenges',
  requirePermission('portfolio:write'),
  validate(createChallengeSchema),
  controller.createChallenge,
);

portfolioRouter.patch(
  '/challenges/:id',
  requirePermission('portfolio:write'),
  validate(updateChallengeSchema),
  controller.updateChallenge,
);

// ─── Challenge Actions ────────────────────────────────────────────────────────
portfolioRouter.post(
  '/challenges/:id/activate-open-call',
  requirePermission('portfolio:write'),
  controller.activateOpenCall,
);

portfolioRouter.post(
  '/challenges/:id/publish',
  requirePermission('portfolio:write'),
  controller.publishChallenge,
);

// ─── Invitations ──────────────────────────────────────────────────────────────
portfolioRouter.post(
  '/challenges/:id/invitations',
  requirePermission('portfolio:write'),
  validate(addInvitationSchema),
  controller.addInvitation,
);

portfolioRouter.patch(
  '/challenges/:id/invitations/:invId',
  requirePermission('portfolio:write'),
  validate(updateInvitationSchema),
  controller.updateInvitation,
);

// ─── Squad Members ────────────────────────────────────────────────────────────
portfolioRouter.post(
  '/challenges/:id/squad',
  requirePermission('portfolio:write'),
  validate(addSquadMemberSchema),
  controller.addSquadMember,
);

portfolioRouter.patch(
  '/challenges/:id/squad/:memberId',
  requirePermission('portfolio:write'),
  validate(updateSquadMemberSchema),
  controller.updateSquadMember,
);

// ─── Challenge Team Members (ADR-023) ───────────────────────────────────────────
portfolioRouter.get(
  '/challenges/:challengeId/team',
  controller.listChallengeTeam,
);

portfolioRouter.post(
  '/challenges/:challengeId/team',
  requirePermission('portfolio:write'),
  validate(addChallengeTeamMemberSchema),
  controller.addChallengeTeamMember,
);

portfolioRouter.patch(
  '/challenges/:challengeId/team/:memberId',
  requirePermission('portfolio:write'),
  validate(updateChallengeTeamMemberSchema),
  controller.updateChallengeTeamMember,
);

portfolioRouter.delete(
  '/challenges/:challengeId/team/:memberId',
  requirePermission('portfolio:write'),
  controller.removeChallengeTeamMember,
);

// ─── Initiative Team (resolution + per-iniciativa override, #110/#114) ───────────
portfolioRouter.get(
  '/initiatives/:projectId/team',
  controller.getInitiativeTeam,
);

portfolioRouter.put(
  '/initiatives/:projectId/team/:userId',
  requirePermission('portfolio:write'),
  validate(upsertInitiativeTeamMemberSchema),
  controller.upsertInitiativeTeamMember,
);

portfolioRouter.delete(
  '/initiatives/:projectId/team/:userId',
  requirePermission('portfolio:write'),
  controller.removeInitiativeTeamMember,
);

// ─── Initiatives ──────────────────────────────────────────────────────────────
portfolioRouter.get(
  '/challenges/:challengeId/initiatives',
  controller.listInitiatives,
);

portfolioRouter.get(
  '/initiatives/:projectId/meta',
  controller.getInitiativeMeta,
);

portfolioRouter.put(
  '/initiatives/:projectId/meta',
  requirePermission('portfolio:write'),
  validate(upsertInitiativeMetaSchema),
  controller.upsertInitiativeMeta,
);

// ─── E2E Job-Driven Ola 3 ─────────────────────────────────────────────────────
// §8–§11/§26: el Copilot sugiere desagregar un Frente. La sugerencia no escribe; `confirm`
// crea sólo los retos que la persona eligió.
portfolioRouter.post(
  '/strategic-fronts/:id/challenge-split-suggestion',
  requirePermission('portfolio:write'),
  async (req, res, next) => {
    try {
      res.json({ success: true, data: await challengeSplit.suggest(req.params.id) });
    } catch (err) {
      next(err);
    }
  },
);

portfolioRouter.post(
  '/strategic-fronts/:id/challenge-split-suggestion/confirm',
  requirePermission('portfolio:write'),
  validate(confirmChallengeSplitSchema),
  async (req, res, next) => {
    try {
      const data = await challengeSplit.confirm(req.params.id, (req as AuthenticatedRequest).body.challenges);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// Quién decide sobre una iniciativa de Reto. Las iniciativas nuevas lo heredan del owner del Reto
// o del Frente (initiative-governance.ts); esto permite asignarlo o cambiarlo explícitamente.
portfolioRouter.get('/initiatives/:projectId/governance', async (req, res, next) => {
  try {
    const governance = await prisma.initiativeGovernance.findUnique({
      where: { projectId: req.params.projectId },
      include: { portfolioLeadUser: { select: { id: true, name: true, email: true } } },
    });
    res.json({ success: true, data: governance ?? { projectId: req.params.projectId, mode: 'owner_governed', portfolioLeadUserId: null } });
  } catch (err) {
    next(err);
  }
});

portfolioRouter.put(
  '/initiatives/:projectId/governance',
  requirePermission('portfolio:write'),
  validate(assignInitiativeGovernanceSchema),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const { portfolioLeadUserId } = req.body as { portfolioLeadUserId: string | null };
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
      if (portfolioLeadUserId) {
        const lead = await prisma.user.findUnique({ where: { id: portfolioLeadUserId }, select: { id: true } });
        if (!lead) throw AppError.notFound('Usuario', 'USER_NOT_FOUND', { hint: 'El Portfolio Lead debe ser un usuario existente.' });
      }
      const data = await prisma.initiativeGovernance.upsert({
        where: { projectId },
        update: { mode: 'portfolio_governed', portfolioLeadUserId },
        create: { projectId, mode: 'portfolio_governed', portfolioLeadUserId },
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

// §4/§24 y Core §17: dónde está puesta la capacidad y señales de reasignación (sólo lectura).
portfolioRouter.get('/capacity', async (req, res, next) => {
  try {
    const scope = await resolvePortfolioScope(prisma, (req as AuthenticatedRequest).user!);
    res.json({ success: true, data: await portfolioCapacity.get(scope) });
  } catch (err) {
    next(err);
  }
});

// §13: lectura de cobertura del Reto como conjunto (sólo lectura).
portfolioRouter.get('/challenges/:challengeId/coverage-reading', async (req, res, next) => {
  try {
    res.json({ success: true, data: await challengeCoverage.get(req.params.challengeId) });
  } catch (err) {
    next(err);
  }
});

// ─── Overlaps ─────────────────────────────────────────────────────────────────
portfolioRouter.get(
  '/challenges/:challengeId/overlaps',
  controller.listOverlaps,
);

portfolioRouter.post(
  '/challenges/:challengeId/overlaps',
  requirePermission('portfolio:write'),
  validate(createOverlapSchema),
  controller.createOverlap,
);

// ─── Executive Outputs ────────────────────────────────────────────────────────
portfolioRouter.get(
  '/challenges/:challengeId/executive-outputs',
  controller.listExecutiveOutputs,
);

// PRD-005 / ADR-020: meter `exec_export` — the board-facing executive output is a
// high-value gated deliverable. Shadow mode by default.
portfolioRouter.post(
  '/challenges/:challengeId/executive-outputs',
  requirePermission('portfolio:write'),
  requireEntitlement('exec_export'),
  validate(createExecutiveOutputSchema),
  controller.createExecutiveOutput,
);

portfolioRouter.patch(
  '/executive-outputs/:id',
  requirePermission('portfolio:write'),
  validate(updateExecutiveOutputSchema),
  controller.updateExecutiveOutput,
);
