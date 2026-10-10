import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { validate } from '../../shared/middleware/validate';
import { createEvidenceSchema, updateEvidenceStatusSchema } from './evidence.schemas';

import { authenticate } from '../auth/auth.middleware';
import { requireProjectTeamAccess } from '../projects/project-team-access';
const service = new EvidenceService(prisma);
const controller = new EvidenceController(service);

export const evidenceRouter = Router();

evidenceRouter.use(authenticate);
// Antes no había chequeo de proyecto: cualquier usuario autenticado leía o borraba evidencias ajenas.
// Leer es del equipo (y del Portfolio Lead asignado); subir, verificar y borrar, del OWNER o EDITOR.
const canRead = requireProjectTeamAccess(prisma, 'read', 'projectId');
const canWrite = requireProjectTeamAccess(prisma, 'write', 'projectId');

evidenceRouter.get('/:projectId/evidence', canRead, controller.list);
evidenceRouter.post('/:projectId/evidence', canWrite, validate(createEvidenceSchema), controller.create);
evidenceRouter.patch(
  '/:projectId/evidence/:id',
  canWrite,
  validate(updateEvidenceStatusSchema),
  controller.updateStatus
);
evidenceRouter.delete('/:projectId/evidence/:id', canWrite, controller.delete);
