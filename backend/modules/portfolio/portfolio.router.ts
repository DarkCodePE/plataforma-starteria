import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioHomeReadService } from './portfolio-home.read-service';
import { validate } from '../../shared/middleware/validate';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { requireEntitlement } from '../billing/entitlement.middleware';
import { createPortfolioContextAuthorityService } from '../../shared/portfolio-context/portfolio-context-authority.service';
import { StrategicFramingHomeProjectionService } from '../strategic-framing/strategic-framing.home-projection.service';
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
} from './portfolio.schemas';

const service = new PortfolioService(prisma);
const homeReadService = new PortfolioHomeReadService(prisma, new StrategicFramingHomeProjectionService(prisma));
const controller = new PortfolioController(service, homeReadService, createPortfolioContextAuthorityService(prisma));

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
