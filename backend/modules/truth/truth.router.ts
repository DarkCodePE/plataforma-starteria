import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validate';
import { TruthController } from './truth.controller';
import { TruthService } from './truth.service';
import {
  attentionItemSchema,
  claimSchema,
  evidenceSchema,
  impactAssertionSchema,
  impactTransitionSchema,
  resolveAttentionItemSchema,
  sourceRefSchema,
  validationCommandSchema,
} from './truth.schemas';
import { requireProjectCapability, requireProjectTeamAccess } from '../projects/project-team-access';

const service = new TruthService(prisma);
const controller = new TruthController(service);

export const truthRouter = Router();

truthRouter.use(authenticate);

const bodyProjectWrite = requireProjectTeamAccess(prisma, 'write', (req) => req.body?.projectId);
const pathProjectRead = requireProjectTeamAccess(prisma, 'read', 'projectId');
const pathProjectWrite = requireProjectTeamAccess(prisma, 'write', 'projectId');
const validationProjectAuthority = requireProjectCapability(
  prisma,
  (req) => req.body?.result === 'unvalidated' ? 'initiative:write' : 'truth:validate-method',
  (req) => req.body?.projectId,
);

// Global SourceRefs remain an internal/domain possibility, but the public HTTP command must
// always be anchored to a canonical Project. A session alone is not tenant authority.
truthRouter.post('/source-refs', validate(sourceRefSchema), bodyProjectWrite, controller.createSourceRef);
truthRouter.post('/claims', validate(claimSchema), bodyProjectWrite, controller.createClaim);
truthRouter.post('/evidence', validate(evidenceSchema), bodyProjectWrite, controller.attachEvidence);
truthRouter.post('/validations', validate(validationCommandSchema), validationProjectAuthority, controller.recordValidation);
truthRouter.get('/projects/:projectId/claims/:claimId/readiness', pathProjectRead, controller.getClaimReadiness);
truthRouter.post('/attention-items', validate(attentionItemSchema), bodyProjectWrite, controller.createAttentionItem);
truthRouter.get('/projects/:projectId/attention-items', pathProjectRead, controller.listAttentionItems);
truthRouter.patch(
  '/projects/:projectId/attention-items/:id/resolve',
  pathProjectWrite,
  validate(resolveAttentionItemSchema),
  controller.resolveAttentionItem,
);
truthRouter.post('/impact-assertions', validate(impactAssertionSchema), bodyProjectWrite, controller.createImpactAssertion);
truthRouter.patch(
  '/projects/:projectId/impact-assertions/:id/transition',
  pathProjectWrite,
  validate(impactTransitionSchema),
  controller.transitionImpact,
);
