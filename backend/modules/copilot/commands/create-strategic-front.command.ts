import type { z } from 'zod/v3';
import { AppError } from '../../../shared/errors/AppError';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { createStrategicFrontSchema } from '../../portfolio/portfolio.schemas';
import {
  commandExecutionResultSchema,
  createStrategicFrontCapabilityPayloadSchema,
} from '../schemas/copilot.schemas';
import type { CommandExecutionResult } from '../domain/copilot.types';
import { CREATE_STRATEGIC_FRONT_COMMAND_TYPE } from '../application/capability-registry';
import { CopilotErrors } from '../domain/copilot.errors';
import {
  dryRunPortfolioCreateFailure,
  shouldFailPortfolioCreateBeforeCreate,
} from '../application/copilot-dry-run-failure-injection';

export const createStrategicFrontCommandSchema = createStrategicFrontCapabilityPayloadSchema.transform((payload) => ({
  name: payload.name,
  strategicObjective: payload.objective,
  mainKpi: payload.mainKpi,
  baseline: payload.baseline,
  target: payload.target,
  horizon: payload.horizon,
  sponsor: payload.sponsor,
  priority: payload.priority,
  organizationId: payload.organizationId,
  ownerId: payload.createdBy,
}));

export type CreateStrategicFrontCommand = z.input<typeof createStrategicFrontCommandSchema>;

export type StrategicFrontCommandOutput = {
  id: string;
  name: string;
  organizationId?: string | null;
};

export class CreateStrategicFrontCommandHandler {
  constructor(private readonly portfolioService: PortfolioService) {}

  async execute(command: CreateStrategicFrontCommand): Promise<CommandExecutionResult> {
    const parsedCommand = createStrategicFrontCommandSchema.safeParse(command);
    if (!parsedCommand.success) {
      throw CopilotErrors.domainValidationFailed('El comando CreateStrategicFront no cumple el contrato esperado.');
    }

    const portfolioInput = createStrategicFrontSchema.safeParse(parsedCommand.data);
    if (!portfolioInput.success) {
      throw CopilotErrors.domainValidationFailed('Portfolio rechazo el payload del frente estrategico.');
    }

    if (shouldFailPortfolioCreateBeforeCreate()) {
      throw dryRunPortfolioCreateFailure();
    }

    try {
      const front = await this.portfolioService.createStrategicFront(portfolioInput.data, {
        organizationId: parsedCommand.data.organizationId,
        actorUserId: parsedCommand.data.ownerId,
      }) as StrategicFrontCommandOutput;
      const result: CommandExecutionResult = {
        success: true,
        commandType: CREATE_STRATEGIC_FRONT_COMMAND_TYPE,
        createdObjects: [
          {
            type: 'StrategicFront',
            id: front.id,
            label: front.name,
          },
        ],
        updatedObjects: [],
        warnings: [],
        projectionLinks: [
          {
            label: 'Ver frente estrategico',
            href: `/portfolio/strategic-fronts/${front.id}`,
            objectType: 'StrategicFront',
            objectId: front.id,
          },
          {
            label: 'Abrir mapa estrategico',
            href: '/portfolio',
            objectType: 'StrategicFront',
            objectId: front.id,
          },
        ],
      };
      commandExecutionResultSchema.parse(result);
      return result;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw CopilotErrors.commandExecutionFailed('PortfolioService no pudo crear el frente estrategico.');
    }
  }
}
