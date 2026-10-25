import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import { config } from '../../../config';
import { hashRefreshToken } from '../../auth/token.service';
import type { HandoffAssignment, HandoffAssignmentRepository, HandoffAssignmentState } from '../domain/portfolio-handoff-assignment.types';
import { HANDOFF_DELIVERY_OUTCOME_UNKNOWN, HANDOFF_DELIVERY_RESERVATION } from '../domain/portfolio-handoff-invitation.types';
import type { HandoffDeliveryAttempt, HandoffDeliveryAttemptRepository, HandoffInvitationAccessRepository } from '../domain/portfolio-handoff-invitation.types';
import type { DurableHandoffEventPort } from './portfolio-handoff-semantic-event.projector';

export type HandoffInvitationDeliveryPort = {
  send(input: { to: string; subject: string; text: string; html: string }): Promise<{ delivered: boolean; providerMessageRef?: string }>;
};

export type SendHandoffInvitationInput = {
  assignmentId: string;
  idempotencyKey: string;
  expiresAt?: Date | null;
  title?: string;
  whyItMatters?: string;
  requestFingerprint?: string;
};

type HandoffDeliveryResult = {
  state: HandoffAssignmentState;
  attemptStatus: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'IDEMPOTENT';
  providerMessageRef: string | null;
  errorCategory: string | null;
};

export class PortfolioHandoffDeliveryService {
  constructor(
    private readonly assignments: HandoffAssignmentRepository,
    private readonly access: HandoffInvitationAccessRepository,
    private readonly attempts: HandoffDeliveryAttemptRepository,
    private readonly delivery: HandoffInvitationDeliveryPort,
    private readonly events?: DurableHandoffEventPort,
    private readonly now: () => Date = () => new Date(),
    private readonly reservationTtlMs = 30_000,
  ) {}

  async sendHandoffInvitation(input: SendHandoffInvitationInput): Promise<HandoffDeliveryResult> {
    if (!input.idempotencyKey.trim()) throw AppError.badRequest('Idempotency key requerida', 'HANDOFF_IDEMPOTENCY_REQUIRED');
    const requestFingerprint = input.requestFingerprint ?? fingerprintDeliveryRequest(input);
    const existingAttempt = await this.attempts.findByIdempotencyKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey });
    if (existingAttempt) {
      if (existingAttempt.requestFingerprint !== requestFingerprint) {
        throw AppError.conflict('La clave de idempotencia ya se utilizo con otro contenido', 'HANDOFF_IDEMPOTENCY_CONFLICT');
      }
      return this.replayExistingAttempt(input.assignmentId, requestFingerprint, existingAttempt);
    }

    const foundIntent = await this.attempts.findByDeliveryIntent({ assignmentId: input.assignmentId, requestFingerprint });
    if (foundIntent) {
      // Confirmed failures bind the retry key atomically with their CAS claim.
      // Every path that only replays an existing outcome binds first.
      const existingIntent = foundIntent.status === 'FAILED' && foundIntent.errorCategory !== HANDOFF_DELIVERY_RESERVATION
        ? foundIntent
        : await this.attempts.bindIdempotencyKey({
          assignmentId: input.assignmentId,
          idempotencyKey: input.idempotencyKey,
          attemptId: foundIntent.id,
        });
      if (existingIntent.requestFingerprint !== requestFingerprint) {
        throw AppError.conflict('La clave de idempotencia ya se utilizo con otro contenido', 'HANDOFF_IDEMPOTENCY_CONFLICT');
      }
      // Pre-fencing reservations were persisted as FAILED without an owner or
      // lease. Their provider outcome cannot be reconstructed, so they must be
      // quarantined instead of entering the confirmed-failure retry path.
      if (existingIntent.errorCategory === HANDOFF_DELIVERY_RESERVATION) {
        return this.replayExistingAttempt(input.assignmentId, requestFingerprint, existingIntent);
      }
      if (existingIntent.status !== 'FAILED') {
        return this.replayExistingAttempt(input.assignmentId, requestFingerprint, existingIntent);
      }
      const assignment = await this.requireCreatedAssignment(input.assignmentId);
      const claimedAt = this.now();
      const claimed = await this.attempts.claimConfirmedFailure({
        attemptId: existingIntent.id,
        expectedGeneration: existingIntent.executionGeneration,
        executionOwnerId: randomUUID(),
        idempotencyKey: input.idempotencyKey,
        attemptedAt: claimedAt,
        leaseUntil: new Date(claimedAt.getTime() + this.reservationTtlMs),
      });
      if (!claimed.claimed) {
        const keyedAttempt = await this.attempts.findByIdempotencyKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey });
        if (keyedAttempt && keyedAttempt.requestFingerprint !== requestFingerprint) {
          throw AppError.conflict('La clave de idempotencia ya se utilizo con otro contenido', 'HANDOFF_IDEMPOTENCY_CONFLICT');
        }
        return this.replayExistingAttempt(input.assignmentId, requestFingerprint, keyedAttempt ?? claimed.attempt);
      }
      await this.access.revokeForAssignment(assignment.id);
      return this.deliverReserved(input, assignment, claimed.attempt);
    }

    const assignment = await this.requireCreatedAssignment(input.assignmentId);

    const reservedAt = this.now();
    const reservation = await this.attempts.reserve({
      assignmentId: assignment.id,
      channel: 'EMAIL',
      status: 'UNKNOWN',
      attemptedAt: reservedAt,
      providerMessageRef: null,
      errorCategory: HANDOFF_DELIVERY_RESERVATION,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
      executionGeneration: 1,
      executionOwnerId: randomUUID(),
      leaseUntil: new Date(reservedAt.getTime() + this.reservationTtlMs),
    });
    if (!reservation.reserved) {
      return this.replayExistingAttempt(input.assignmentId, requestFingerprint, reservation.attempt);
    }

    return this.deliverReserved(input, assignment, reservation.attempt);
  }

  private async deliverReserved(input: SendHandoffInvitationInput, assignment: HandoffAssignment, reservedAttempt: HandoffDeliveryAttempt): Promise<HandoffDeliveryResult> {
    const token = randomBytes(32).toString('hex');
    await this.access.create({ assignmentId: assignment.id, tokenHash: hashRefreshToken(token), expiresAt: input.expiresAt ?? null });
    const message = renderInvitationEmail(assignment, token, input.title, input.whyItMatters);
    let result: { delivered: boolean; providerMessageRef?: string };
    try {
      result = await this.delivery.send({ to: assignment.invitedEmailNormalized, ...message });
    } catch {
      const completedAt = this.now();
      const completion = await this.attempts.completeOwned({
        attemptId: reservedAttempt.id,
        executionGeneration: reservedAttempt.executionGeneration,
        executionOwnerId: reservedAttempt.executionOwnerId!,
        status: 'UNKNOWN',
        attemptedAt: completedAt,
        providerMessageRef: null,
        errorCategory: HANDOFF_DELIVERY_OUTCOME_UNKNOWN,
      });
      const durableAttempt = completion.completed
        ? completion.attempt
        : await this.attempts.markExpiredUnknown({ attemptId: reservedAttempt.id, observedAt: completedAt });
      return {
        state: assignment.state,
        attemptStatus: 'UNKNOWN',
        providerMessageRef: durableAttempt.providerMessageRef,
        errorCategory: HANDOFF_DELIVERY_OUTCOME_UNKNOWN,
      };
    }

    const providerMessageRef = result.providerMessageRef ?? null;
    if (!result.delivered) {
      const completion = await this.attempts.completeOwned({
        attemptId: reservedAttempt.id,
        executionGeneration: reservedAttempt.executionGeneration,
        executionOwnerId: reservedAttempt.executionOwnerId!,
        status: 'FAILED',
        attemptedAt: this.now(),
        providerMessageRef,
        errorCategory: 'MAILER_DISABLED',
      });
      if (!completion.completed) {
        const durableAttempt = await this.attempts.markExpiredUnknown({ attemptId: reservedAttempt.id, observedAt: this.now() });
        return { state: assignment.state, attemptStatus: 'UNKNOWN', providerMessageRef: durableAttempt.providerMessageRef, errorCategory: HANDOFF_DELIVERY_OUTCOME_UNKNOWN };
      }
      await this.access.revokeForAssignment(assignment.id);
      return { state: assignment.state, attemptStatus: 'FAILED', providerMessageRef, errorCategory: 'MAILER_DISABLED' };
    }

    const completedAt = this.now();
    const completion = await this.attempts.completeOwned({
      attemptId: reservedAttempt.id,
      executionGeneration: reservedAttempt.executionGeneration,
      executionOwnerId: reservedAttempt.executionOwnerId!,
      status: 'SUCCEEDED',
      attemptedAt: completedAt,
      providerMessageRef,
      errorCategory: null,
    });
    if (!completion.completed) {
      const durableAttempt = await this.attempts.markExpiredUnknown({ attemptId: reservedAttempt.id, observedAt: this.now() });
      return { state: assignment.state, attemptStatus: 'UNKNOWN', providerMessageRef: durableAttempt.providerMessageRef, errorCategory: HANDOFF_DELIVERY_OUTCOME_UNKNOWN };
    }
    const transitioned = assignment.state === 'CREATED'
      ? await this.assignments.transitionState({ assignmentId: assignment.id, from: ['CREATED'], to: 'SENT' })
      : assignment;
    const finalAssignment = transitioned ?? assignment;
    if (this.events) await this.events.publish({ type: 'invitation_sent', assignmentId: finalAssignment.id, version: finalAssignment.version, actorId: finalAssignment.createdByActorId, occurredAt: this.now(), interactionChannel: 'api', payload: { targetKind: finalAssignment.targetKind, initiativeId: finalAssignment.initiativeId } });
    return { state: finalAssignment.state, attemptStatus: 'SUCCEEDED', providerMessageRef, errorCategory: null };
  }

  private async replayExistingAttempt(
    assignmentId: string,
    requestFingerprint: string,
    initial: HandoffDeliveryAttempt | null,
  ): Promise<HandoffDeliveryResult> {
    if (!initial) throw new Error('Existing delivery attempt is required');
    if (initial.requestFingerprint !== requestFingerprint) {
      throw AppError.conflict('La clave de idempotencia ya se utilizo con otro contenido', 'HANDOFF_IDEMPOTENCY_CONFLICT');
    }
    let attempt = initial;
    for (let index = 0; attempt.errorCategory === HANDOFF_DELIVERY_RESERVATION && attempt.leaseUntil && attempt.leaseUntil.getTime() > this.now().getTime() && index < 500; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      attempt = await this.attempts.findByDeliveryIntent({ assignmentId, requestFingerprint }) ?? attempt;
    }
    if (attempt.errorCategory === HANDOFF_DELIVERY_RESERVATION) {
      if (attempt.leaseUntil && attempt.leaseUntil.getTime() > this.now().getTime()) {
        throw AppError.conflict('El envio con esta clave sigue en proceso', 'HANDOFF_DELIVERY_IN_PROGRESS');
      }
      attempt = await this.attempts.markExpiredUnknown({ attemptId: attempt.id, observedAt: this.now() });
    }
    if (attempt.status === 'SUCCEEDED') {
      const assignment = await this.requireAssignment(assignmentId);
      if (assignment.state === 'CREATED') {
        await this.assignments.transitionState({ assignmentId, from: ['CREATED'], to: 'SENT' });
      }
      return { state: (await this.requireAssignment(assignmentId)).state, attemptStatus: 'IDEMPOTENT', providerMessageRef: attempt.providerMessageRef, errorCategory: null };
    }
    if (attempt.status === 'UNKNOWN') {
      return { state: (await this.requireAssignment(assignmentId)).state, attemptStatus: 'UNKNOWN', providerMessageRef: attempt.providerMessageRef, errorCategory: HANDOFF_DELIVERY_OUTCOME_UNKNOWN };
    }
    return { state: (await this.requireAssignment(assignmentId)).state, attemptStatus: 'FAILED', providerMessageRef: attempt.providerMessageRef, errorCategory: attempt.errorCategory };
  }

  async markHandoffInvitationViewed(token: string): Promise<{ state: HandoffAssignmentState }> {
    const access = await this.access.findByTokenHash(hashRefreshToken(token));
    if (!access) throw AppError.notFound('Invitacion', 'HANDOFF_INVITATION_INVALID');
    const assignment = await this.requireAssignment(access.assignmentId);
    if (access.revokedAt || assignment.state === 'REVOKED') throw AppError.conflict('La invitacion fue revocada', 'HANDOFF_INVITATION_REVOKED');
    if (access.expiresAt && access.expiresAt.getTime() <= Date.now()) {
      await this.assignments.transitionState({ assignmentId: assignment.id, from: ['CREATED', 'SENT', 'VIEWED'], to: 'EXPIRED' });
      throw AppError.conflict('La invitacion expiro', 'HANDOFF_INVITATION_EXPIRED');
    }
    if (assignment.state === 'SENT') await this.assignments.transitionState({ assignmentId: assignment.id, from: ['SENT'], to: 'VIEWED' });
    const viewed = await this.requireAssignment(assignment.id);
    if (this.events) await this.events.publish({ type: 'invitation_viewed', assignmentId: viewed.id, version: viewed.version, actorId: null, occurredAt: new Date(), interactionChannel: 'web', payload: { targetKind: viewed.targetKind, initiativeId: viewed.initiativeId } });
    return { state: viewed.state };
  }

  async revokeHandoffInvitation(assignmentId: string): Promise<HandoffAssignment> {
    const assignment = await this.requireAssignment(assignmentId);
    if (!(['CREATED', 'SENT', 'VIEWED'] as HandoffAssignmentState[]).includes(assignment.state)) {
      throw AppError.conflict('La invitacion ya no puede revocarse', 'HANDOFF_INVITATION_NOT_REVOKABLE');
    }
    const revoked = await this.assignments.transitionState({ assignmentId, from: ['CREATED', 'SENT', 'VIEWED'], to: 'REVOKED' });
    await this.access.revokeForAssignment(assignmentId);
    return revoked ?? { ...assignment, state: 'REVOKED' };
  }

  private async requireAssignment(id: string): Promise<HandoffAssignment> {
    const assignment = await this.assignments.findById(id);
    if (!assignment) throw AppError.notFound('Asignacion', 'HANDOFF_ASSIGNMENT_NOT_FOUND');
    return assignment;
  }

  private async requireCreatedAssignment(id: string): Promise<HandoffAssignment> {
    const assignment = await this.requireAssignment(id);
    if (assignment.state !== 'CREATED') {
      throw AppError.conflict('La invitacion ya no puede enviarse', 'HANDOFF_INVITATION_NOT_SENDABLE');
    }
    return assignment;
  }
}

function fingerprintDeliveryRequest(input: SendHandoffInvitationInput): string {
  return createHash('sha256').update(JSON.stringify({
    assignmentId: input.assignmentId,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    title: input.title?.trim() ?? null,
    whyItMatters: input.whyItMatters?.trim() ?? null,
  })).digest('hex');
}

export function renderInvitationEmail(assignment: HandoffAssignment, token: string, title = 'Una asignacion de Starteria', whyItMatters?: string): { subject: string; text: string; html: string } {
  const url = `${config.handoffInvitationBaseUrl.replace(/\/$/, '')}/handoff/invitations/${encodeURIComponent(token)}`;
  const context = whyItMatters?.trim() ? `\n\n${whyItMatters.trim()}` : '';
  const text = `Starteria\n\nTe han invitado a revisar una asignación\n\nPara: ${assignment.invitedEmailNormalized}\n\n${title}${context}\n\nRevisar asignación: ${url}\n\nAl abrir Starteria podrás revisar el contexto antes de decidir.`;
  const escapedTitle = escapeHtml(title);
  const escapedUrl = escapeHtml(url);
  const escapedRecipient = escapeHtml(assignment.invitedEmailNormalized);
  const escapedContext = whyItMatters?.trim() ? `<p>${escapeHtml(whyItMatters.trim()).replace(/\n/g, '<br>')}</p>` : '';
  return { subject: 'Te han invitado a revisar una asignación', text, html: `<p><strong>Starteria</strong></p><p>Te han invitado a revisar una asignación</p><p><strong>Para:</strong> ${escapedRecipient}</p><p>${escapedTitle}</p>${escapedContext}<p><a href="${escapedUrl}">Revisar asignación</a></p><p>Al abrir Starteria podrás revisar el contexto antes de decidir.</p>` };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}
