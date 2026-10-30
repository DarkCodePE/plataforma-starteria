import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod/v3';
import { AppError } from '../../../shared/errors/AppError';
import { logger } from '../../../shared/utils/logger';
import { mailer, type Mailer } from '../../../shared/mail/mailer';
import { parseCriticalHandoffLifecycle, parseCriticalHandoffPayload, PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { BUSINESS_CAPABILITY_BOUNDARY_VERSION, STARTERIA_PATH_PROJECTION_VERSION } from '../../portfolio-entry/domain/starteria-path.types';
import { STARTERIA_PATH_DTO_SCHEMA_VERSION } from '../presentation/starteria-path.dto';
import { readConversionPresentation, type ConversionConfigReader } from './conversion-presentation.service';
import type { ConversionDestination } from '../presentation/conversion-presentation.dto';

const cleanOptional = (max: number) => z.string().max(max)
  .refine((value) => !/[\x00-\x1f\x7f]/.test(value))
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .refine((value) => value.length > 0);
const email = z.string().max(254).refine((value) => !/[\x00-\x1f\x7f]/.test(value))
  .transform((value) => value.trim()).pipe(z.string().email().max(254))
  .transform((value) => {
    const at = value.lastIndexOf('@');
    return `${value.slice(0, at)}@${value.slice(at + 1).toLowerCase()}`;
  });

export const conversionSubmissionSchema = z.object({
  destinationType: z.enum(['DEMO', 'EARLY_ACCESS']),
  purpose: z.enum(['DEMO_REQUEST', 'EARLY_ACCESS_REQUEST']),
  destinationConfigVersion: z.number().int().positive(),
  sourceBinding: z.object({
    criticalHandoffId: z.string().min(1).max(128),
    criticalHandoffVersion: z.number().int().positive(),
    sourceContextRevision: z.number().int().nonnegative(),
    projectionVersion: z.literal(STARTERIA_PATH_PROJECTION_VERSION),
    businessCapabilityBoundaryVersion: z.literal(BUSINESS_CAPABILITY_BOUNDARY_VERSION),
    pathSchemaVersion: z.literal(STARTERIA_PATH_DTO_SCHEMA_VERSION),
  }).strict(),
  email,
  name: cleanOptional(120).optional(),
  organization: cleanOptional(160).optional(),
  contextSharingMode: z.enum(['NO_ENTRY_CONTEXT_SHARED', 'SHARE_CONTEXT_WITH_CONVERSION']),
  explicitContextConsent: z.literal(true).optional(),
  decisionInViewPreview: z.string().min(1).max(4000).optional(),
  idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9:_-]*$/),
}).strict().superRefine((value, context) => {
  if ((value.destinationType === 'DEMO' && value.purpose !== 'DEMO_REQUEST')
    || (value.destinationType === 'EARLY_ACCESS' && value.purpose !== 'EARLY_ACCESS_REQUEST')) {
    context.addIssue({ code: 'custom', path: ['purpose'], message: 'Purpose does not match destination.' });
  }
  if (value.contextSharingMode === 'SHARE_CONTEXT_WITH_CONVERSION' && value.explicitContextConsent !== true) {
    context.addIssue({ code: 'custom', path: ['explicitContextConsent'], message: 'Explicit consent required.' });
  }
  if (value.contextSharingMode === 'NO_ENTRY_CONTEXT_SHARED'
    && (value.explicitContextConsent !== undefined || value.decisionInViewPreview !== undefined)) {
    context.addIssue({ code: 'custom', path: ['contextSharingMode'], message: 'No context may be attached.' });
  }
});
export type ConversionSubmissionRequest = z.infer<typeof conversionSubmissionSchema>;

export type ConversionReceipt = Readonly<{
  submissionId: string;
  destinationType: 'DEMO' | 'EARLY_ACCESS';
  purpose: 'DEMO_REQUEST' | 'EARLY_ACCESS_REQUEST';
  submittedAt: string;
  receiptStatus: 'RECEIVED';
  contextShared: boolean;
  idempotentReplay: boolean;
}>;

type Accepted = { receipt: ConversionReceipt; notification?: { to: string; email: string } };

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function verifiedReceiver(readConfig: ConversionConfigReader, type: 'DEMO' | 'EARLY_ACCESS', expectedVersion: number) {
  const presentation = readConversionPresentation(readConfig);
  if (presentation.conversionConfigVersion === null) {
    throw new AppError(503, 'Esta solicitud no está disponible.', 'CONVERSION_DESTINATION_UNAVAILABLE');
  }
  if (presentation.conversionConfigVersion !== expectedVersion) {
    throw AppError.conflict('La disponibilidad de esta solicitud cambió.', 'CONVERSION_CONFIG_CHANGED');
  }
  const destination = (presentation.destinations as readonly ConversionDestination[]).find((item) => item.type === type);
  if (!destination || destination.destinationKind !== 'FIRST_PARTY') {
    throw new AppError(503, 'Esta solicitud no está disponible.', 'CONVERSION_DESTINATION_UNAVAILABLE');
  }
  // The normalized presentation is not a receiver credential. Validate the
  // accountable mailbox independently from the same server-owned config.
  const raw = readConfig() as { commercialOwner?: unknown };
  const owner = z.string().trim().email().max(254).safeParse(raw?.commercialOwner);
  if (!owner.success) throw new AppError(503, 'Esta solicitud no está disponible.', 'CONVERSION_DESTINATION_UNAVAILABLE');
  return { owner: owner.data, signature: hash({ version: expectedVersion, destination, owner: owner.data }) };
}

export class ConversionSubmissionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly readConfig: ConversionConfigReader,
    private readonly transport: Mailer = mailer,
  ) {}

  async submit(sessionId: string, ownerUserId: string, input: ConversionSubmissionRequest): Promise<ConversionReceipt> {
    let result: Accepted | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await this.db.$transaction(async (tx) => {
        // This is the same serialization row used by Critical Handoff confirmation
        // and session revision advances. It prevents source changes during submit.
        const locked = await tx.$queryRaw<Array<{
          id: string; ownerUserId: string | null; ownershipState: string;
          contextRevision: number; expiresAt: Date; expiredAt: Date | null;
        }>>(Prisma.sql`
          SELECT "id", "ownerUserId", "ownershipState", "contextRevision", "expiresAt", "expiredAt"
          FROM "PortfolioEntrySession" WHERE "id" = ${sessionId} FOR UPDATE
        `);
        const session = locked[0];
        if (!session || session.ownershipState !== 'CLAIMED' || session.ownerUserId !== ownerUserId) {
          throw AppError.notFound('Portfolio Entry session', 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND');
        }
        if (session.expiredAt || session.expiresAt <= new Date()) {
          throw AppError.conflict('La sesión ya no está disponible.', 'CONVERSION_SOURCE_STALE');
        }
        const source = await tx.portfolioEntryCriticalHandoff.findFirst({
          where: { sessionId }, orderBy: { artifactVersion: 'desc' },
        });
        if (!source || source.id !== input.sourceBinding.criticalHandoffId
          || source.artifactVersion !== input.sourceBinding.criticalHandoffVersion
          || source.sourceContextRevision !== input.sourceBinding.sourceContextRevision
          || session.contextRevision !== source.sourceContextRevision
          || source.confirmationState !== 'confirmed'
          || source.schemaVersion !== PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION) {
          throw AppError.conflict('La lectura cambió. Revísala antes de enviar.', 'CONVERSION_SOURCE_STALE');
        }
        try {
          parseCriticalHandoffLifecycle(source.confirmationState, source.confirmedAt, source.confirmedByUserId);
        } catch {
          throw AppError.conflict('La lectura no está disponible.', 'CONVERSION_SOURCE_STALE');
        }
        const parsed = (() => {
          try { return parseCriticalHandoffPayload(source.schemaVersion, source.payload); }
          catch { throw AppError.conflict('La lectura no está disponible.', 'CONVERSION_SOURCE_STALE'); }
        })();
        if (parsed.conclusionStatus === 'insufficient_basis') {
          throw AppError.conflict('La lectura no está disponible.', 'CONVERSION_SOURCE_STALE');
        }
        // Keep the exact text that the person saw and opted to share.
        const decision = parsed.decisionInView?.trim() ? parsed.decisionInView : null;
        if (input.contextSharingMode === 'SHARE_CONTEXT_WITH_CONVERSION'
          && (input.decisionInViewPreview ?? null) !== decision) {
          throw AppError.conflict('El contexto cambió. Revísalo antes de enviar.', 'CONVERSION_CONSENT_STALE');
        }
        const sharedDecisionInView = input.contextSharingMode === 'SHARE_CONTEXT_WITH_CONVERSION' ? decision : null;
        const initialReceiver = verifiedReceiver(this.readConfig, input.destinationType, input.destinationConfigVersion);
        const currentReceiver = verifiedReceiver(this.readConfig, input.destinationType, input.destinationConfigVersion);
        if (currentReceiver.signature !== initialReceiver.signature) {
          throw AppError.conflict('La disponibilidad de esta solicitud cambió.', 'CONVERSION_CONFIG_CHANGED');
        }
        const keyHash = hash(input.idempotencyKey);
        const fingerprint = hash({
          destinationType: input.destinationType, purpose: input.purpose,
          email: input.email, name: input.name ?? null, organization: input.organization ?? null,
          contextSharingMode: input.contextSharingMode, sharedDecisionInView,
          sourceBinding: input.sourceBinding, destinationConfigVersion: input.destinationConfigVersion,
        });
        const existing = await tx.portfolioEntryConversionSubmission.findUnique({
          where: { sessionId_destinationType_idempotencyKeyHash: {
            sessionId, destinationType: input.destinationType, idempotencyKeyHash: keyHash,
          } },
        });
        if (existing) {
          if (existing.requestFingerprint !== fingerprint) {
            throw AppError.conflict('La clave ya se usó para otra solicitud.', 'CONVERSION_IDEMPOTENCY_CONFLICT');
          }
          return { receipt: receipt(existing, true) };
        }
        const confirmedReceiver = verifiedReceiver(this.readConfig, input.destinationType, input.destinationConfigVersion);
        if (confirmedReceiver.signature !== initialReceiver.signature) {
          throw AppError.conflict('La disponibilidad de esta solicitud cambió.', 'CONVERSION_CONFIG_CHANGED');
        }
        const created = await tx.portfolioEntryConversionSubmission.create({ data: {
          sessionId, destinationType: input.destinationType, purpose: input.purpose,
          destinationConfigVersion: input.destinationConfigVersion,
          contactEmail: input.email, contactName: input.name ?? null, organization: input.organization ?? null,
          contextSharingMode: input.contextSharingMode,
          consentedAt: input.contextSharingMode === 'SHARE_CONTEXT_WITH_CONVERSION' ? new Date() : null,
          sharedDecisionInView,
          criticalHandoffId: source.id, criticalHandoffVersion: source.artifactVersion,
          sourceContextRevision: source.sourceContextRevision,
          projectionVersion: input.sourceBinding.projectionVersion,
          businessCapabilityBoundaryVersion: input.sourceBinding.businessCapabilityBoundaryVersion,
          pathSchemaVersion: input.sourceBinding.pathSchemaVersion,
          consentScopeVersion: input.contextSharingMode === 'SHARE_CONTEXT_WITH_CONVERSION'
            ? 'DECISION_IN_VIEW_V1' : null,
          idempotencyKeyHash: keyHash, requestFingerprint: fingerprint,
          // No production-valid retention duration has been approved.
          expiresAt: null,
        } });
        return { receipt: receipt(created, false), notification: { to: currentReceiver.owner, email: input.email } };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        // PostgreSQL may abort the waiting serializable transaction after the
        // first submit commits. Retry against the current source and key.
        if (attempt < 2 && isRetryableTransactionError(error)) continue;
        if (error instanceof AppError) throw error;
        // Avoid logging Prisma errors: query metadata may contain submitted PII.
        logger.error({ result: 'persistence_failed' }, 'Conversion submission failed');
        throw new AppError(503, 'No pudimos registrar la solicitud.', 'CONVERSION_SUBMISSION_FAILED');
      }
    }
    if (!result) throw new AppError(503, 'No pudimos registrar la solicitud.', 'CONVERSION_SUBMISSION_FAILED');
    if (result.notification) {
      try {
        if (this.transport.enabled) {
          await this.transport.send({
            to: result.notification.to,
            subject: 'Nueva solicitud Starteria',
            text: `Solicitud: ${result.receipt.submissionId}\nDestino: ${result.receipt.destinationType}\nCorreo: ${result.notification.email}`,
          });
        } else {
          logger.warn({ submissionId: result.receipt.submissionId }, 'Conversion notification unavailable');
        }
      } catch {
        logger.warn({ submissionId: result.receipt.submissionId }, 'Conversion notification failed');
      }
    }
    return result.receipt;
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2034' || error.code === 'P2002');
}

function receipt(row: {
  id: string; destinationType: string; purpose: string; submittedAt: Date; sharedDecisionInView: string | null;
}, idempotentReplay: boolean): ConversionReceipt {
  return {
    submissionId: row.id,
    destinationType: row.destinationType as ConversionReceipt['destinationType'],
    purpose: row.purpose as ConversionReceipt['purpose'],
    submittedAt: row.submittedAt.toISOString(),
    receiptStatus: 'RECEIVED',
    contextShared: row.sharedDecisionInView !== null,
    idempotentReplay,
  };
}
