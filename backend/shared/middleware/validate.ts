import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod/v3';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = req[target];
    const result = schema.safeParse(data);
    if (!result.success) {
      next(result.error);
      return;
    }
    req[target] = result.data;
    next();
  };
}
