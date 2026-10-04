import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../shared/middleware/validate';
import { reconstruct } from './reconstruction.service';

export const reconstructionSchema = z.object({
  name: z.string().min(2).max(200),
  summary: z.string().min(1).max(5000),
  goal: z.string().max(2000).optional(),
  evidence: z
    .array(z.object({ summary: z.string().min(1).max(1000), classification: z.enum(['supports', 'contradicts', 'insufficient']), source: z.string().max(500).optional() }))
    .max(50),
  decisionsTaken: z.array(z.string().min(1).max(1000)).max(20).optional(),
});

// E2E Job-Driven §14: lectura de reconstrucción. No persiste nada.
export const reconstructionRouter = Router();
reconstructionRouter.use(authenticate);
reconstructionRouter.post('/reconstruction', validate(reconstructionSchema), (req, res) => {
  res.json({ success: true, data: reconstruct(req.body) });
});
