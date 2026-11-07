import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { mailer, sendMailWithReceipt } from '../../shared/mail/mailer';

const LAB_RECIPIENTS = [
  'fabio.merino.97@gmail.com',
  'orlandokuanb@gmail.com',
] as const;

const TERMINAL_STATUSES = ['CLOSED', 'NOT_PROCEEDING', 'CANCELLED'] as const;
type TerminalStatus = typeof TERMINAL_STATUSES[number];

export interface PortfolioLabNotifier {
  readonly enabled: boolean;
  sendWithReceipt(message: {
    to: string[];
    subject: string;
    text: string;
  }): Promise<{ acceptedByTransport: boolean; providerMessageRef?: string }>;
}

export const defaultPortfolioLabNotifier: PortfolioLabNotifier = {
  get enabled() { return mailer.enabled; },
  sendWithReceipt: (message) => sendMailWithReceipt(message),
};

export interface CreatePortfolioLabRequestInput {
  organizationId: string;
  actorId: string;
  challengeId: string;
  briefId: string;
  briefVersionId: string;
  consentAccepted: boolean;
  consentPurpose: string;
  idempotencyKey: string;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stable(value: unknown): string {
  const normalize = (item: any): any => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      return Object.keys(item).sort().reduce((out: Record<string, unknown>, key) => {
        out[key] = normalize(item[key]);
        return out;
      }, {});
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

function requireIdempotencyKey(value: string): string {
  const key = value?.trim();
  if (!key) throw AppError.badRequest('Idempotency-Key requerida.', 'PORTFOLIO_LAB_IDEMPOTENCY_REQUIRED');
  return key;
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw lastError;
}

export class PortfolioLabRequestService {
  constructor(
    private readonly db: any,
    private readonly notifier: PortfolioLabNotifier = defaultPortfolioLabNotifier,
  ) {}

  async create(input: CreatePortfolioLabRequestInput) {
    if (!input.consentAccepted || !input.consentPurpose?.trim()) {
      throw AppError.badRequest(
        'Se requiere consentimiento explícito y su finalidad.',
        'PORTFOLIO_LAB_CONSENT_REQUIRED',
      );
    }
    const idempotencyKeyHash = digest(requireIdempotencyKey(input.idempotencyKey));
    const payloadHash = digest(stable({
      organizationId: input.organizationId,
      actorId: input.actorId,
      challengeId: input.challengeId,
      briefId: input.briefId,
      briefVersionId: input.briefVersionId,
      consentPurpose: input.consentPurpose.trim(),
    }));

    type PersistedCreate = {
      request: any;
      created: boolean;
      idempotent: boolean;
      deduplicated: boolean;
      attemptId: string | null;
    };
    const persisted = await withSerializableRetry<PersistedCreate>(() => this.db.$transaction(async (tx: any) => {
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${input.organizationId}, 226))
      `);

      const prior = await tx.portfolioLabRequest.findUnique({
        where: {
          organizationId_requesterId_idempotencyKeyHash: {
            organizationId: input.organizationId,
            requesterId: input.actorId,
            idempotencyKeyHash,
          },
        },
        include: { notificationAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (prior) {
        if (prior.payloadHash !== payloadHash) {
          throw AppError.conflict(
            'La Idempotency-Key ya fue utilizada con otro payload.',
            'PORTFOLIO_LAB_IDEMPOTENCY_CONFLICT',
          );
        }
        return { request: prior, created: false, idempotent: true, deduplicated: false, attemptId: null };
      }

      const version = await tx.challengeActivationBriefVersion.findUnique({
        where: { id: input.briefVersionId },
        select: { id: true, organizationId: true, challengeId: true, briefId: true, status: true },
      });
      if (!version
        || version.status !== 'CONFIRMED'
        || version.organizationId !== input.organizationId
        || version.challengeId !== input.challengeId
        || version.briefId !== input.briefId) {
        throw AppError.notFound('Brief confirmado', 'PORTFOLIO_LAB_CONFIRMED_BRIEF_NOT_FOUND');
      }

      const duplicate = await tx.portfolioLabRequest.findFirst({
        where: {
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          briefVersionId: input.briefVersionId,
          status: { notIn: [...TERMINAL_STATUSES] },
        },
        include: { notificationAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (duplicate) {
        return { request: duplicate, created: false, idempotent: false, deduplicated: true, attemptId: null };
      }

      const openCount = await tx.portfolioLabRequest.count({
        where: { organizationId: input.organizationId, status: { notIn: [...TERMINAL_STATUSES] } },
      });
      if (openCount >= 3) {
        throw AppError.conflict(
          'La organización ya tiene 3 solicitudes abiertas a Startería Lab.',
          'PORTFOLIO_LAB_OPEN_LIMIT',
        );
      }

      const request = await tx.portfolioLabRequest.create({
        data: {
          organizationId: input.organizationId,
          challengeId: input.challengeId,
          briefId: input.briefId,
          briefVersionId: input.briefVersionId,
          requesterId: input.actorId,
          consentAt: new Date(),
          consentPurpose: input.consentPurpose.trim(),
          idempotencyKeyHash,
          payloadHash,
          history: {
            create: {
              actorId: input.actorId,
              eventType: 'REQUEST_CREATED',
              toStatus: 'REQUESTED',
              metadata: { briefVersionId: input.briefVersionId, consentRecorded: true },
            },
          },
        },
      });
      const attempt = await tx.portfolioLabNotificationAttempt.create({
        data: {
          requestId: request.id,
          actorId: input.actorId,
          idempotencyKeyHash,
          payloadHash: digest(stable({ requestId: request.id, notification: 'INITIAL' })),
        },
      });
      return { request, created: true, idempotent: false, deduplicated: false, attemptId: attempt.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));

    if (!persisted.created) {
      return {
        request: persisted.request,
        idempotent: persisted.idempotent,
        deduplicated: persisted.deduplicated,
      };
    }

    const delivered = await this.deliverAttempt(persisted.request.id, persisted.attemptId!, input.actorId);
    return { request: delivered.request, idempotent: false, deduplicated: false };
  }

  async retryNotification(input: {
    organizationId: string;
    actorId: string;
    requestId: string;
    idempotencyKey: string;
  }) {
    const idempotencyKeyHash = digest(requireIdempotencyKey(input.idempotencyKey));
    const payloadHash = digest(stable({ requestId: input.requestId, command: 'RETRY_NOTIFICATION' }));
    type PreparedRetry = { request: any; attempt: any | null; created: boolean };
    const prepared = await withSerializableRetry<PreparedRetry>(() => this.db.$transaction(async (tx: any) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PortfolioLabRequest" WHERE "id" = ${input.requestId} FOR UPDATE`);
      const request = await tx.portfolioLabRequest.findFirst({
        where: { id: input.requestId, organizationId: input.organizationId },
      });
      if (!request) throw AppError.notFound('Solicitud Lab', 'PORTFOLIO_LAB_REQUEST_NOT_FOUND');
      const prior = await tx.portfolioLabNotificationAttempt.findUnique({
        where: { requestId_idempotencyKeyHash: { requestId: input.requestId, idempotencyKeyHash } },
      });
      if (prior) return { request, attempt: prior, created: false };
      if (request.notificationStatus === 'NOTIFIED') return { request, attempt: null, created: false };
      const attempt = await tx.portfolioLabNotificationAttempt.create({
        data: {
          requestId: input.requestId,
          actorId: input.actorId,
          idempotencyKeyHash,
          payloadHash,
        },
      });
      return { request, attempt, created: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));

    if (!prepared.created) return { request: prepared.request, idempotent: true };
    const delivered = await this.deliverAttempt(input.requestId, prepared.attempt.id, input.actorId);
    return { request: delivered.request, idempotent: false };
  }

  async transitionStatus(input: {
    organizationId: string;
    actorId: string;
    requestId: string;
    status: TerminalStatus;
    idempotencyKey: string;
  }) {
    requireIdempotencyKey(input.idempotencyKey);
    if (!TERMINAL_STATUSES.includes(input.status)) {
      throw AppError.badRequest('Transición Lab no permitida.', 'PORTFOLIO_LAB_STATUS_INVALID');
    }
    return withSerializableRetry<{ request: any; idempotent: boolean }>(() => this.db.$transaction(async (tx: any) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PortfolioLabRequest" WHERE "id" = ${input.requestId} FOR UPDATE`);
      const current = await tx.portfolioLabRequest.findFirst({
        where: { id: input.requestId, organizationId: input.organizationId },
      });
      if (!current) throw AppError.notFound('Solicitud Lab', 'PORTFOLIO_LAB_REQUEST_NOT_FOUND');
      if (current.status === input.status) return { request: current, idempotent: true };
      if (TERMINAL_STATUSES.includes(current.status)) {
        throw AppError.conflict('La solicitud Lab ya es terminal.', 'PORTFOLIO_LAB_ALREADY_TERMINAL');
      }
      const request = await tx.portfolioLabRequest.update({
        where: { id: current.id },
        data: { status: input.status, terminalAt: new Date(), version: { increment: 1 } },
      });
      await tx.portfolioLabRequestHistory.create({
        data: {
          requestId: current.id,
          actorId: input.actorId,
          eventType: 'STATUS_CHANGED',
          fromStatus: current.status,
          toStatus: input.status,
          metadata: { idempotencyKeyHash: digest(input.idempotencyKey.trim()) },
        },
      });
      return { request, idempotent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
  }

  async list(organizationId: string) {
    return this.db.portfolioLabRequest.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { notificationAttempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
  }

  async get(organizationId: string, requestId: string) {
    const request = await this.db.portfolioLabRequest.findFirst({
      where: { id: requestId, organizationId },
      include: {
        history: { orderBy: { createdAt: 'asc' } },
        notificationAttempts: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request) throw AppError.notFound('Solicitud Lab', 'PORTFOLIO_LAB_REQUEST_NOT_FOUND');
    return request;
  }

  private async deliverAttempt(requestId: string, attemptId: string, actorId: string) {
    const request = await this.db.portfolioLabRequest.findUnique({
      where: { id: requestId },
      include: { briefVersion: { select: { intent: true, scope: true } } },
    });
    if (!request) throw AppError.notFound('Solicitud Lab', 'PORTFOLIO_LAB_REQUEST_NOT_FOUND');

    if (!this.notifier.enabled) {
      return this.finishNotification(request, attemptId, actorId, {
        accepted: false,
        attemptStatus: 'DISABLED',
        errorCode: 'MAILER_DISABLED',
      });
    }

    try {
      const receipt = await this.notifier.sendWithReceipt({
        to: [...LAB_RECIPIENTS],
        subject: `Nueva solicitud Startería Lab para el reto ${request.challengeId}`,
        text: [
          'Se registró una solicitud de contacto humano para Startería Lab.',
          `Solicitud: ${request.id}`,
          `Organización: ${request.organizationId}`,
          `Reto: ${request.challengeId}`,
          `BriefVersion confirmada: ${request.briefVersionId}`,
          `Intención: ${request.briefVersion.intent ?? 'No indicada'}`,
          `Alcance: ${request.briefVersion.scope ?? 'No indicado'}`,
          'Este correo confirma únicamente aceptación del transporte; no confirma lectura ni reunión.',
        ].join('\n'),
      });
      if (!receipt.acceptedByTransport) {
        return this.finishNotification(request, attemptId, actorId, {
          accepted: false,
          attemptStatus: 'FAILED',
          errorCode: 'SMTP_NOT_ACCEPTED',
        });
      }
      return this.finishNotification(request, attemptId, actorId, {
        accepted: true,
        attemptStatus: 'ACCEPTED',
        providerMessageRef: receipt.providerMessageRef,
      });
    } catch {
      return this.finishNotification(request, attemptId, actorId, {
        accepted: false,
        attemptStatus: 'FAILED',
        errorCode: 'SMTP_EXCEPTION',
      });
    }
  }

  private async finishNotification(
    current: any,
    attemptId: string,
    actorId: string,
    result: {
      accepted: boolean;
      attemptStatus: 'ACCEPTED' | 'FAILED' | 'DISABLED';
      providerMessageRef?: string;
      errorCode?: string;
    },
  ) {
    return this.db.$transaction(async (tx: any) => {
      await tx.portfolioLabNotificationAttempt.update({
        where: { id: attemptId },
        data: {
          status: result.attemptStatus,
          providerMessageRef: result.providerMessageRef ?? null,
          errorCode: result.errorCode ?? null,
          completedAt: new Date(),
        },
      });
      const request = await tx.portfolioLabRequest.update({
        where: { id: current.id },
        data: {
          notificationStatus: result.accepted ? 'NOTIFIED' : 'FAILED',
          providerMessageRef: result.providerMessageRef ?? null,
          lastNotificationError: result.errorCode ?? null,
        },
      });
      await tx.portfolioLabRequestHistory.create({
        data: {
          requestId: current.id,
          actorId,
          eventType: result.accepted ? 'NOTIFICATION_ACCEPTED' : 'NOTIFICATION_FAILED',
          fromStatus: current.status,
          toStatus: current.status,
          metadata: {
            acceptedByTransport: result.accepted,
            providerMessageRef: result.providerMessageRef ?? null,
            errorCode: result.errorCode ?? null,
            humanReceiptConfirmed: false,
            meetingConfirmed: false,
          },
        },
      });
      return { request };
    });
  }
}
