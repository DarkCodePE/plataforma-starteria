import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';
import { AdaptiveCoreService } from '../adaptive-core/adaptive-core.service';
import { DEFAULT_STEPS } from '../projects/project.service';
import { PortfolioEntryApiError } from '../portfolio-entry/portfolio-entry.errors';
import type { PortfolioEntryIdempotencyRepository } from '../portfolio-entry/application/portfolio-entry-idempotency.repository';
import type { PortfolioEntrySession } from '../portfolio-entry-sessions/domain/portfolio-entry-session.types';
import {
  mapPortfolioEntryToCanonicalProject,
  PORTFOLIO_ENTRY_CONVERSION_MAPPING_VERSION,
  PortfolioEntryConversionMappingError,
} from './portfolio-entry-conversion.mapper';

export type PortfolioEntryConversionResultDto = {
  conversionId: string;
  sessionId: string;
  projectId: string;
  status: 'CONVERTED';
  destinationRoute: string;
  convertedAt: string;
};

export type ConvertPortfolioEntryInput = {
  sessionId: string;
  expectedRevision: number;
  authenticatedUserId: string;
  idempotencyKey?: string;
  requestId?: string;
};

type PortfolioEntryConversionServiceOptions = {
  adaptiveCoreFactory?: (prisma: PrismaClient) => Pick<AdaptiveCoreService, 'ensureInitialized'>;
  afterProjectCreated?: (context: { projectId: string; sessionId: string }) => Promise<void> | void;
};

const IDEMPOTENCY_OPERATION = 'convert_session';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const ADAPTIVE_STATUS_READY = 'INITIALIZED';
const ADAPTIVE_STATUS_FAILED = 'FAILED_RETRYABLE';

export class PortfolioEntryConversionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly idempotencyRepository: PortfolioEntryIdempotencyRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly options: PortfolioEntryConversionServiceOptions = {},
  ) {}

  async convert(input: ConvertPortfolioEntryInput): Promise<PortfolioEntryConversionResultDto> {
    if (!input.authenticatedUserId) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONVERSION_AUTH_REQUIRED');
    if (!input.idempotencyKey) throw PortfolioEntryApiError.missingIdempotencyKey();

    const startedAt = Date.now();
    logger.info({
      requestId: input.requestId,
      sessionId: input.sessionId,
      userId: input.authenticatedUserId,
      expectedRevision: input.expectedRevision,
    }, 'portfolio_entry_conversion_started');

    const payload = { expectedRevision: input.expectedRevision };
    return this.withIdempotency(input, payload, async () => {
      const existing = await this.findConversion(input.sessionId);
      if (existing) {
        const result = await this.ensureAdaptiveCoreAndReturn(existing, input);
        logger.info({
          requestId: input.requestId,
          sessionId: input.sessionId,
          userId: input.authenticatedUserId,
          conversionId: result.conversionId,
          projectId: result.projectId,
          outcome: 'already_converted',
          duration: Date.now() - startedAt,
        }, 'portfolio_entry_conversion_completed');
        return result;
      }

      const result = await this.createConversion(input);
      await this.ensureAdaptiveCoreAndReturnById(result.conversionId, input);
      logger.info({
        requestId: input.requestId,
        sessionId: input.sessionId,
        userId: input.authenticatedUserId,
        conversionId: result.conversionId,
        projectId: result.projectId,
        outcome: 'converted',
        duration: Date.now() - startedAt,
      }, 'portfolio_entry_conversion_completed');
      return result;
    });
  }

  private async createConversion(input: ConvertPortfolioEntryInput): Promise<PortfolioEntryConversionResultDto> {
    try {
      const conversion = await this.prisma.$transaction(async (tx) => {
        const row = await tx.portfolioEntrySession.findUnique({ where: { id: input.sessionId } });
        if (!row) throw AppError.notFound('Portfolio Entry session', 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND');
        if (row.expiresAt <= this.now() || row.expiredAt || row.lifecycleStatus === 'EXPIRED') {
          throw new AppError(410, 'La sesion de Portfolio Entry expiro.', 'PORTFOLIO_ENTRY_SESSION_EXPIRED');
        }
        if (row.ownershipState !== 'CLAIMED' || !row.ownerUserId) {
          throw AppError.conflict('La sesion debe estar reclamada antes de convertir.', 'PORTFOLIO_ENTRY_CONVERSION_NOT_CLAIMED');
        }
        if (row.ownerUserId !== input.authenticatedUserId) {
          throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONVERSION_FORBIDDEN');
        }
        if (row.revision !== input.expectedRevision) {
          throw AppError.conflict('La sesion cambio antes de aplicar la conversion.', 'PORTFOLIO_ENTRY_SESSION_CONFLICT');
        }
        if (row.lifecycleStatus !== 'CONFIRMED' && row.lifecycleStatus !== 'CONVERSION_ELIGIBLE') {
          throw AppError.conflict('La sesion no esta lista para conversion.', 'PORTFOLIO_ENTRY_CONVERSION_NOT_CONFIRMED');
        }
        if (row.continuationProfile !== 'INITIATIVE_ENTRY') {
          throw AppError.conflict(
            row.continuationProfile === 'PORTFOLIO_LEAD_ENTRY'
              ? 'La sesion Portfolio debe continuar hacia Portfolio, no hacia Project.'
              : 'La sesion no tiene un perfil de conversion Initiative explicito.',
            'PORTFOLIO_ENTRY_PROJECT_CONVERSION_PROFILE_FORBIDDEN',
          );
        }

        const existing = await tx.portfolioEntryConversion.findUnique({ where: { sessionId: input.sessionId } });
        if (existing) return existing;

        const [handoff, confirmation] = await Promise.all([
          tx.portfolioEntryHandoff.findFirst({
            where: { sessionId: input.sessionId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          }),
          tx.portfolioEntryConfirmation.findFirst({
            where: { sessionId: input.sessionId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          }),
        ]);
        if (!handoff) throw AppError.conflict('La sesion no tiene handoff confirmado.', 'PORTFOLIO_ENTRY_CONVERSION_HANDOFF_REQUIRED');
        if (!confirmation || confirmation.status !== 'CONFIRMED') {
          throw AppError.conflict('La sesion no tiene confirmacion final.', 'PORTFOLIO_ENTRY_CONVERSION_CONFIRMATION_REQUIRED');
        }

        const domainSession = toDomainSession(row, handoff, confirmation);
        if (!isConversionSourceReady(domainSession)) {
          throw AppError.conflict('La sesion no cumple la politica de conversion.', 'PORTFOLIO_ENTRY_CONVERSION_NOT_ELIGIBLE');
        }

        const mapped = mapPortfolioEntryToCanonicalProject({
          session: domainSession,
          handoffId: handoff.id,
          confirmation: domainSession.confirmation!,
        });

        let currentRevision = row.revision;
        if (row.lifecycleStatus === 'CONFIRMED') {
          const eligible = await tx.portfolioEntrySession.updateMany({
            where: {
              id: input.sessionId,
              revision: currentRevision,
              ownerUserId: input.authenticatedUserId,
              ownershipState: 'CLAIMED',
              lifecycleStatus: 'CONFIRMED',
            },
            data: {
              lifecycleStatus: 'CONVERSION_ELIGIBLE',
              revision: { increment: 1 },
              updatedAt: this.now(),
              lastActivityAt: this.now(),
            },
          });
          if (eligible.count !== 1) {
            throw AppError.conflict('La sesion cambio antes de aplicar la conversion.', 'PORTFOLIO_ENTRY_SESSION_CONFLICT');
          }
          currentRevision += 1;
        }

        const project = await tx.project.create({
          data: {
            name: mapped.projectName,
            description: mapped.projectDescription,
            ownerId: input.authenticatedUserId,
            // Portfolio Entry conversion is a personal LEGACY_COMPAT path. A user's primary
            // organization is not authority to canonicalize this Project into a tenant.
            organizationId: null,
            status: 'DRAFT',
            currentStep: 0,
            step0Status: 'IN_PROGRESS',
            step0Data: mapped.step0Data as Prisma.InputJsonValue,
            mentorCredits: 3,
            riskLevel: 'LOW',
            origin: 'from_portfolio_entry',
            teamMembers: {
              create: {
                userId: input.authenticatedUserId,
                role: 'OWNER',
                status: 'ACTIVE',
              },
            },
            steps: {
              create: DEFAULT_STEPS.map((step) => ({
                number: step.number,
                name: step.name,
                status: 'BLOCKED',
                progress: 0,
                modules: {
                  create: step.modules.map((module) => ({
                    moduleId: module.id,
                    name: module.name,
                    status: 'BLOCKED',
                  })),
                },
              })),
            },
          },
        });
        await this.options.afterProjectCreated?.({ projectId: project.id, sessionId: input.sessionId });

        const created = await tx.portfolioEntryConversion.create({
          data: {
            sessionId: input.sessionId,
            projectId: project.id,
            handoffId: handoff.id,
            confirmationId: confirmation.id,
            convertedByUserId: input.authenticatedUserId,
            sourceSnapshot: mapped.sourceSnapshot as Prisma.InputJsonValue,
            mappingVersion: PORTFOLIO_ENTRY_CONVERSION_MAPPING_VERSION,
          },
        });

        const converted = await tx.portfolioEntrySession.updateMany({
          where: {
            id: input.sessionId,
            revision: currentRevision,
            ownerUserId: input.authenticatedUserId,
            ownershipState: 'CLAIMED',
            lifecycleStatus: 'CONVERSION_ELIGIBLE',
          },
          data: {
            lifecycleStatus: 'CONVERTED',
            revision: { increment: 1 },
            updatedAt: this.now(),
            lastActivityAt: this.now(),
          },
        });
        if (converted.count !== 1) {
          throw AppError.conflict('La sesion cambio antes de finalizar la conversion.', 'PORTFOLIO_ENTRY_SESSION_CONFLICT');
        }

        return created;
      });
      return toDto(conversion);
    } catch (err) {
      if (err instanceof PortfolioEntryConversionMappingError) {
        throw new AppError(422, err.message, 'PORTFOLIO_ENTRY_CONVERSION_MAPPING_INVALID');
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2002' || err.code === 'P2003')
      ) {
        const existing = await this.findConversion(input.sessionId);
        if (existing) return toDto(existing);
        throw AppError.conflict('La conversion no pudo aplicarse por conflicto de datos.', 'PORTFOLIO_ENTRY_CONVERSION_CONFLICT');
      }
      throw err;
    }
  }

  private async ensureAdaptiveCoreAndReturnById(conversionId: string, input: ConvertPortfolioEntryInput): Promise<PortfolioEntryConversionResultDto> {
    const conversion = await this.prisma.portfolioEntryConversion.findUnique({ where: { id: conversionId } });
    if (!conversion) throw AppError.notFound('Portfolio Entry conversion', 'PORTFOLIO_ENTRY_CONVERSION_NOT_FOUND');
    return this.ensureAdaptiveCoreAndReturn(conversion, input);
  }

  private async ensureAdaptiveCoreAndReturn(conversion: ConversionRow, input: ConvertPortfolioEntryInput): Promise<PortfolioEntryConversionResultDto> {
    if (conversion.convertedByUserId !== input.authenticatedUserId) {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONVERSION_FORBIDDEN');
    }
    if (conversion.adaptiveCoreInitializationStatus === ADAPTIVE_STATUS_READY) return toDto(conversion);

    try {
      const adaptiveCore = this.options.adaptiveCoreFactory?.(this.prisma) ?? new AdaptiveCoreService(this.prisma);
      await adaptiveCore.ensureInitialized(
        conversion.projectId,
        input.authenticatedUserId,
        'participante',
      );
      const updated = await this.prisma.portfolioEntryConversion.update({
        where: { id: conversion.id },
        data: {
          adaptiveCoreInitializationStatus: ADAPTIVE_STATUS_READY,
          adaptiveCoreInitializedAt: this.now(),
          adaptiveCoreInitializationError: Prisma.JsonNull,
        },
      });
      return toDto(updated);
    } catch (err) {
      await this.prisma.portfolioEntryConversion.update({
        where: { id: conversion.id },
        data: {
          adaptiveCoreInitializationStatus: ADAPTIVE_STATUS_FAILED,
          adaptiveCoreInitializationError: {
            message: err instanceof Error ? err.message : 'Unknown Adaptive Core initialization error',
          },
        },
      }).catch(() => undefined);
      throw AppError.internal('No pudimos inicializar el core adaptativo de la iniciativa.');
    }
  }

  private async withIdempotency(
    input: ConvertPortfolioEntryInput,
    payload: unknown,
    run: () => Promise<PortfolioEntryConversionResultDto>,
  ): Promise<PortfolioEntryConversionResultDto> {
    const now = this.now();
    const hash = createHash('sha256').update(stableJson(payload)).digest('hex');
    const existing = await this.idempotencyRepository.findActive(IDEMPOTENCY_OPERATION, input.sessionId, input.idempotencyKey!, now);
    if (existing) {
      if (existing.requestPayloadHash !== hash) throw PortfolioEntryApiError.idempotencyConflict();
      if (existing.status === 'COMPLETED') return existing.responseSnapshot as PortfolioEntryConversionResultDto;
      const conversion = await this.findConversion(input.sessionId);
      if (conversion) {
        const recovered = await this.ensureAdaptiveCoreAndReturn(conversion, input);
        await this.idempotencyRepository.complete({ id: existing.id, responseSnapshot: recovered });
        return recovered;
      }
      if (existing.status === 'IN_PROGRESS') throw PortfolioEntryApiError.idempotencyInProgress();
    }

    const record = existing?.status === 'FAILED'
      ? existing
      : await this.idempotencyRepository.create({
        operation: IDEMPOTENCY_OPERATION,
        scope: input.sessionId,
        sessionId: input.sessionId,
        idempotencyKey: input.idempotencyKey!,
        requestPayloadHash: hash,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      });
    if (record.requestPayloadHash !== hash) throw PortfolioEntryApiError.idempotencyConflict();

    try {
      const result = await run();
      await this.idempotencyRepository.complete({ id: record.id, responseSnapshot: result });
      return result;
    } catch (err) {
      await this.idempotencyRepository.markFailed(record.id);
      logger.error({
        requestId: input.requestId,
        sessionId: input.sessionId,
        userId: input.authenticatedUserId,
        expectedRevision: input.expectedRevision,
        err,
      }, 'portfolio_entry_conversion_failed');
      throw err;
    }
  }

  private async findConversion(sessionId: string): Promise<ConversionRow | null> {
    return this.prisma.portfolioEntryConversion.findUnique({ where: { sessionId } });
  }
}

function isConversionSourceReady(session: PortfolioEntrySession): boolean {
  return (
    (session.lifecycleStatus === 'CONFIRMED' || session.lifecycleStatus === 'CONVERSION_ELIGIBLE') &&
    session.confirmation?.status === 'CONFIRMED' &&
    Boolean(session.latestHandoff) &&
    !session.expiredAt
  );
}

type ConversionRow = {
  id: string;
  sessionId: string;
  projectId: string;
  convertedByUserId: string;
  adaptiveCoreInitializationStatus: string;
  convertedAt: Date;
};

function toDto(conversion: ConversionRow): PortfolioEntryConversionResultDto {
  return {
    conversionId: conversion.id,
    sessionId: conversion.sessionId,
    projectId: conversion.projectId,
    status: 'CONVERTED',
    destinationRoute: `/initiatives/${conversion.projectId}/overview`,
    convertedAt: conversion.convertedAt.toISOString(),
  };
}

function toDomainSession(row: any, handoff: any, confirmation: any): PortfolioEntrySession {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    publicAccessTokenHash: undefined,
    ownershipState: row.ownershipState,
    rawEntry: row.rawEntry,
    entryOrigin: row.entryOrigin,
    sourceMetadata: row.sourceMetadata ?? undefined,
    lifecycleStatus: row.lifecycleStatus,
    executionStatus: row.executionStatus,
    interactionMode: row.interactionMode,
    semanticState: row.semanticState,
    questionBudget: row.questionBudget,
    latestAnalysis: row.latestAnalysis,
    continuationProfile: row.continuationProfile ?? null,
    latestHandoff: {
      id: handoff.id,
      sessionId: handoff.sessionId,
      version: handoff.version,
      handoff: handoff.handoffPayload,
      sourceTurnId: handoff.sourceTurnId ?? undefined,
      status: handoff.handoffStatus,
      versioning: {
        schemaVersion: handoff.schemaVersion,
        runtimeVersion: handoff.runtimeVersion,
        contractVersion: row.contractVersion,
        promptManifestId: handoff.promptManifestId ?? undefined,
      },
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
    },
    confirmation: {
      id: confirmation.id,
      sessionId: confirmation.sessionId,
      handoffId: confirmation.handoffId,
      version: confirmation.version,
      status: confirmation.status,
      acceptedFields: confirmation.acceptedFields,
      correctedFields: confirmation.correctedFields,
      rejectedFields: confirmation.rejectedFields,
      notes: confirmation.notes ?? undefined,
      confirmedByUserId: confirmation.confirmedByUserId ?? undefined,
      confirmedAt: confirmation.confirmedAt ?? undefined,
      createdAt: confirmation.createdAt,
      updatedAt: confirmation.updatedAt,
    },
    versioning: {
      contractVersion: row.contractVersion,
      runtimeVersion: row.runtimeVersion,
      schemaVersion: row.schemaVersion,
      promptManifestId: row.promptManifestId ?? undefined,
    },
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastActivityAt: row.lastActivityAt,
    expiresAt: row.expiresAt,
    expiredAt: row.expiredAt,
  } as PortfolioEntrySession;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}
