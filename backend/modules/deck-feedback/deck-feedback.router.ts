/**
 * Feedback IA del deck del Step 4. Montado en `/api/v1/projects`.
 *
 *   POST /:projectId/deck-feedback  cuerpo = bytes del PDF (`Content-Type: application/pdf`),
 *                                   nombre en `X-File-Name` (URL-encoded), como /initiatives/:id/pdfs.
 *   GET  /:projectId/deck-feedback  los últimos análisis.
 *
 * Analizar es trabajo de la iniciativa (OWNER o EDITOR) y consume un crédito de mentor; leer el
 * resultado, del equipo y del Portfolio Lead asignado.
 */
import express, { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { config } from '../../config';
import { authenticate } from '../auth/auth.middleware';
import { requireEntitlement } from '../billing/entitlement.middleware';
import { requireProjectTeamAccess } from '../projects/project-team-access';
import { callAiService } from '../ai/bridge.service';
import { ALLOWED_PDF_MIME, LocalDiskPdfStorage, MAX_PDF_BYTES } from '../initiative-pdfs';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { AppError } from '../../shared/errors/AppError';
import { DeckFeedbackService, type DeckFeedbackAi, type DeckFeedbackResult } from './deck-feedback.service';

const ai: DeckFeedbackAi = {
  async analyze({ fileName, bytes, analysis, userId, role }) {
    const result = await callAiService(
      'POST',
      '/api/v1/ai/deck-feedback',
      { fileName, fileBase64: bytes.toString('base64'), analysis },
      { userClaims: { userId, role }, costCapUsd: '0.0800', timeoutMs: 120_000, maxRetries: 1 },
    );
    return result as DeckFeedbackResult;
  },
};

const service = new DeckFeedbackService(prisma, new LocalDiskPdfStorage(config.localStorageDir), ai);

export const deckFeedbackRouter = Router();

deckFeedbackRouter.use(authenticate);

deckFeedbackRouter.get('/:projectId/deck-feedback', requireProjectTeamAccess(prisma, 'read', 'projectId'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await service.list(req.params.projectId) });
  } catch (err) {
    next(err);
  }
});

deckFeedbackRouter.post(
  '/:projectId/deck-feedback',
  requireProjectTeamAccess(prisma, 'write', 'projectId'),
  requireEntitlement('mentor_credit'),
  express.raw({ type: ALLOWED_PDF_MIME, limit: MAX_PDF_BYTES }),
  async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        throw AppError.badRequest('Content-Type debe ser application/pdf.', 'PDF_MIME_INVALID');
      }
      const rawName = (req.headers['x-file-name'] || '').toString();
      let fileName = rawName;
      try {
        fileName = rawName ? decodeURIComponent(rawName) : '';
      } catch {
        // Nombre mal codificado: se usa uno sintético.
      }
      const user = (req as AuthenticatedRequest).user!;
      const data = await service.analyze({
        projectId: req.params.projectId,
        userId: user.id,
        role: user.role,
        fileName: fileName.slice(0, 255) || `deck-${Date.now()}.pdf`,
        bytes: req.body,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);
