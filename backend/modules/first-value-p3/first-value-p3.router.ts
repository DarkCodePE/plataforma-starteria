import { Router, type RequestHandler } from 'express';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { FirstValueP3Controller } from './first-value-p3.controller';
import { FirstValueP3Service, firstValueP3Service } from './first-value-p3.service';

export interface FirstValueP3RouterDeps {
  authenticate?: RequestHandler;
  service?: FirstValueP3Service;
}

export function buildFirstValueP3Router(deps: FirstValueP3RouterDeps = {}): Router {
  const router = Router();
  const controller = new FirstValueP3Controller(deps.service ?? firstValueP3Service);
  router.post('/first-value/p3/analyze', deps.authenticate ?? authenticate, requirePermission('portfolio:read'), controller.analyze);
  return router;
}

export const firstValueP3Router = buildFirstValueP3Router();
