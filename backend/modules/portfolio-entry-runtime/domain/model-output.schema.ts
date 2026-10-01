import { z } from 'zod';
import { portfolioEntryAnalysisV2Schema, questionPlanV2Schema } from './analysis.schema';

export const portfolioEntryTurnOutputV2Schema = z.object({
  analysis: portfolioEntryAnalysisV2Schema,
  question_plan: questionPlanV2Schema,
}).strict();

export type PortfolioEntryTurnOutputV2 = z.infer<typeof portfolioEntryTurnOutputV2Schema>;

// ADR-032: salida del LLM cuando Jev clasifica. La clasificación se completa después.
export const portfolioEntryTurnOutputWithoutClassificationSchema = z.object({
  analysis: portfolioEntryAnalysisV2Schema.omit({
    primary_intent: true, secondary_intents: true, initial_entry_state: true, current_frame: true,
  }),
  question_plan: questionPlanV2Schema,
}).strict();
