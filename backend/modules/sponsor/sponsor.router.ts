import { Router } from 'express';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validate';
import { createCheckpointSchema, respondCheckpointSchema } from './sponsor.schemas';
import {
  createCheckpoint,
  respondToCheckpoint,
  skipCheckpoint,
  getCheckpoint,
  listProjectCheckpoints,
} from './sponsor.controller';
import { prisma } from '../../shared/db/prisma';
import { AppError } from '../../shared/errors/AppError';
import { requireProjectTeamAccess } from '../projects/project-team-access';

const router = Router();
const canReadProject = requireProjectTeamAccess(prisma, 'read', 'projectId');

const resolveCheckpointReadAccess = async (req: any, res: any, next: any) => {
  try {
    const checkpoint = await prisma.sponsorCheckpoint.findUnique({
      where: { id: req.params.id },
      select: { projectId: true, sponsorId: true },
    });
    if (!checkpoint) throw AppError.notFound('Checkpoint', 'CHECKPOINT_NOT_FOUND');
    if (checkpoint.sponsorId === req.user!.id) {
      req.projectAuthority = { projectId: checkpoint.projectId, effectiveRole: 'sponsor', need: 'read' };
      return next();
    }
    req.params.projectId = checkpoint.projectId;
    return canReadProject(req, res, next);
  } catch (err) {
    next(err);
  }
};

// All routes require authentication
router.use(authenticate);

// Create checkpoint (admin only)
router.post(
  '/checkpoints',
  requirePermission('sponsor:manage'),
  validate(createCheckpointSchema),
  createCheckpoint,
);

// Get checkpoint details (any authenticated user with project access)
router.get('/checkpoints/:id', resolveCheckpointReadAccess, getCheckpoint);

// Sponsor responds to checkpoint
router.patch(
  '/checkpoints/:id/respond',
  requirePermission('sponsor:decide'),
  validate(respondCheckpointSchema),
  respondToCheckpoint,
);

// Admin skips checkpoint
router.patch(
  '/checkpoints/:id/skip',
  requirePermission('sponsor:manage'),
  skipCheckpoint,
);

// List checkpoints for a project
router.get('/projects/:projectId/checkpoints', canReadProject, listProjectCheckpoints);

export { router as sponsorRouter };
