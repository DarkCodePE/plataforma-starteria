import type { Request, Response, NextFunction } from 'express';
import {
  abandonBodySchema,
  claimBodySchema,
  criticalHandoffConfirmationBodySchema,
  criticalHandoffConfirmationParamsSchema,
  confirmedBriefIdentitySchema,
  confirmationBodySchema,
  createSessionBodySchema,
  guidedExplorationBodySchema,
  materializeHandoffBodySchema,
  sessionParamsSchema,
  submitMessageBodySchema,
} from './portfolio-entry.schemas';
import { mapPortfolioEntryError } from './portfolio-entry.errors';
import type { PortfolioEntryExperimentalSessionService } from './application/portfolio-entry-experimental-session.service';
import type { CriticalHandoffConfirmationBody } from './portfolio-entry.schemas';

export class PortfolioEntryController {
  constructor(private readonly service: PortfolioEntryExperimentalSessionService) {}

  resolveConfirmedBrief = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const identity = confirmedBriefIdentitySchema.parse(req.query);
      const data = await this.service.resolveConfirmedBrief(sessionId, identity, req.user ? { id: req.user.id } : undefined);
      res.json({ success: true, data });
    } catch (err) { next(mapPortfolioEntryError(err)); }
  };

  abandonSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const body = abandonBodySchema.parse(req.body);
      const data = await this.service.abandonConfirmedSession(sessionId, body.expectedRevision, {
        publicAccessToken: req.header('X-Starteria-Entry-Token'),
        principal: req.user ? { id: req.user.id } : undefined,
        idempotencyKey: req.header('Idempotency-Key'),
      });
      res.json({ success: true, data });
    } catch (err) { next(mapPortfolioEntryError(err)); }
  };

  createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createSessionBodySchema.parse(req.body ?? {});
      const data = await this.service.createAnonymousSession(body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  readSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const data = await this.service.readSession({
        sessionId,
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  readAuthenticatedProvisionalContinuation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const data = await this.service.readAuthenticatedProvisionalContinuation(
        sessionId,
        req.user ? { id: req.user.id } : undefined,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  submitMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const body = submitMessageBodySchema.parse(req.body);
      const data = await this.service.submitMessage(sessionId, body, {
        requestId: getRequestId(req),
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
        idempotencyKey: getIdempotencyKey(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  materializeHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const body = materializeHandoffBodySchema.parse(req.body);
      const data = await this.service.materializeHandoff(sessionId, body.expectedRevision, {
        requestId: getRequestId(req),
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
        idempotencyKey: getIdempotencyKey(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  guidedExploration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const body = guidedExplorationBodySchema.parse(req.body);
      const data = await this.service.chooseGuidedExploration(sessionId, body, {
        requestId: getRequestId(req),
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
        idempotencyKey: getIdempotencyKey(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  readHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const data = await this.service.readHandoff({
        sessionId,
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  readCriticalHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const data = await this.service.readCriticalHandoff({
        sessionId,
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  confirmCriticalHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, artifactId } = criticalHandoffConfirmationParamsSchema.parse(req.params);
      const body = criticalHandoffConfirmationBodySchema.parse(req.body) as CriticalHandoffConfirmationBody;
      const data = await this.service.confirmCriticalHandoff(sessionId, artifactId, {
        action: body.action,
        expectedArtifactVersion: body.expectedArtifactVersion,
        expectedContextRevision: body.expectedContextRevision,
      }, {
        requestId: getRequestId(req),
        principal: req.user ? { id: req.user.id } : undefined,
        idempotencyKey: getIdempotencyKey(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  confirmOrCorrectHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const body = confirmationBodySchema.parse(req.body);
      const data = await this.service.confirmOrCorrect(sessionId, body, {
        requestId: getRequestId(req),
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
        idempotencyKey: getIdempotencyKey(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  claim = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const body = claimBodySchema.parse(req.body);
      const data = await this.service.claim(sessionId, body.expectedRevision, {
        requestId: getRequestId(req),
        publicAccessToken: getPublicToken(req),
        principal: req.user ? { id: req.user.id } : undefined,
        idempotencyKey: getIdempotencyKey(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };
}

function getPublicToken(req: Request): string | undefined {
  const value = req.header('X-Starteria-Entry-Token');
  return value && value.trim() ? value.trim() : undefined;
}

function getIdempotencyKey(req: Request): string | undefined {
  const value = req.header('Idempotency-Key');
  return value && value.trim() ? value.trim() : undefined;
}

function getRequestId(req: Request): string {
  return (req as Request & { requestId?: string; id?: string }).requestId
    ?? (req as Request & { requestId?: string; id?: string }).id
    ?? 'unknown';
}
