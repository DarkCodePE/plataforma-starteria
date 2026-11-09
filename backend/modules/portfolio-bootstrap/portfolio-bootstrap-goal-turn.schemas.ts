import { z } from 'zod/v3';

/**
 * The client records only its own literal answer and the exact server-issued
 * B1 question ID. It cannot submit extracted facts or confirm the Anchor.
 */
export const portfolioBootstrapGoalTurnBodySchema = z.object({
  expectedVersion: z.number().int().min(0).max(10_000),
  expectedAnchorVersion: z.number().int().positive(),
  expectedContextReviewVersion: z.number().int().positive().nullable(),
  questionId: z.string().trim().min(1).max(240),
  inputText: z.string().trim().min(1).max(2_000),
  disposition: z.enum(['user_declared', 'unknown', 'not_applicable', 'retracted']),
  supersedesTurnId: z.string().trim().min(1).max(240).nullable().default(null),
}).strict().superRefine((turn, context) => {
  const normalizedInput = turn.inputText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (turn.disposition === 'unknown' && !/\b(no (?:lo )?se|desconozco|aun no|todavia no|no tengo claro)\b/i.test(normalizedInput)) {
    context.addIssue({
      code: 'custom', path: ['inputText'],
      message: 'Una respuesta marcada como desconocida debe declararlo explícitamente.',
    });
  }
  if (turn.disposition === 'not_applicable' && !/\b(no aplica|no corresponde|no es aplicable)\b/i.test(turn.inputText)) {
    context.addIssue({
      code: 'custom', path: ['inputText'],
      message: 'No aplicable requiere una declaración explícita.',
    });
  }
  if (turn.disposition === 'retracted' && !turn.supersedesTurnId) {
    context.addIssue({
      code: 'custom', path: ['supersedesTurnId'],
      message: 'Una retractación debe señalar el turno que corrige.',
    });
  }
});

export type PortfolioBootstrapGoalTurnBody = z.infer<typeof portfolioBootstrapGoalTurnBodySchema>;


/** B4-C2D: all current provisional turns must receive an explicit human decision. */
export const portfolioGoalCheckpointSchema = z.object({
  expectedAnchorVersion: z.number().int().positive(),
  expectedLedgerVersion: z.number().int().positive(),
  expectedContextReviewVersion: z.number().int().positive(),
  decisions: z.array(z.object({
    turnId: z.string().trim().min(1).max(240),
    action: z.enum(['accept', 'reject']),
  }).strict()).min(1).max(30),
}).strict().superRefine((value, ctx) => {
  const ids = value.decisions.map((decision) => decision.turnId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({
    code: 'custom', path: ['decisions'], message: 'No puede decidirse dos veces sobre la misma respuesta.',
  });
});
export type PortfolioGoalCheckpoint = z.infer<typeof portfolioGoalCheckpointSchema>;
