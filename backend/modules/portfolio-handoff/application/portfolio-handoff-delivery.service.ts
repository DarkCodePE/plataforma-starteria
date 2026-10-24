import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import { config } from '../../../config';
import { hashRefreshToken } from '../../auth/token.service';
import type { HandoffAssignment, HandoffAssignmentRepository, HandoffAssignmentState } from '../domain/portfolio-handoff-assignment.types';
import { HANDOFF_DELIVERY_RESERVATION } from '../domain/portfolio-handoff-invitation.types';
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

  async sendHandoffInvitation(input: SendHandoffInvitationInput): Promise<{ state: HandoffAssignmentState; attemptStatus: 'SUCCEEDED' | 'FAILED' | 'IDEMPOTENT'; providerMessageRef: string | null; errorCategory: string | null }> {
    if (!input.idempotencyKey.trim()) throw AppError.badRequest('Idempotency key requerida', 'HANDOFF_IDEMPOTENCY_REQUIRED');
    const requestFingerprint = input.requestFingerprint ?? fingerprintDeliveryRequest(input);
    const existingAttempt = await this.attempts.findByIdempotencyKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey });
    if (existingAttempt) {
      if (existingAttempt.requestFingerprint !== requestFingerprint) {
        throw AppError.conflict('La clave de idempotencia ya se utilizo con otro contenido', 'HANDOFF_IDEMPOTENCY_CONFLICT');
      }
      if (existingAttempt.errorCategory !== HANDOFF_DELIVERY_RESERVATION) {
        return this.replayExistingAttempt(input.assignmentId, input.idempotencyKey, requestFingerprint, existingAttempt);
      }
      const reclaimedAt = this.now();
      const reclaimed = await this.attempts.reclaimReservation({
        attemptId: existingAttempt.id,
        staleBefore: new Date(reclaimedAt.getTime() - this.reservationTtlMs),
        attemptedAt: reclaimedAt,
      });
      if (!reclaimed.reclaimed) {
        return this.replayExistingAttempt(input.assignmentId, input.idempotencyKey, requestFingerprint, reclaimed.attempt);
      }
      const assignment = await this.requireSendableAssignment(input.assignmentId);
      if (assignment.state !== 'CREATED') {
        await this.attempts.complete({ attemptId: reclaimed.attempt.id, status: 'SUCCEEDED', attemptedAt: this.now(), providerMessageRef: reclaimed.attempt.providerMessageRef, errorCategory: null });
        return { state: assignment.state, attemptStatus: 'IDEMPOTENT', providerMessageRef: reclaimed.attempt.providerMessageRef, errorCategory: null };
      }
      await this.access.revokeForAssignment(assignment.id);
      return this.deliverReserved(input, assignment, reclaimed.attempt);
    }

    const assignment = await this.requireSendableAssignment(input.assignmentId);

    const reservation = await this.attempts.reserve({
      assignmentId: assignment.id,
      channel: 'EMAIL',
      status: 'FAILED',
      attemptedAt: this.now(),
      providerMessageRef: null,
      errorCategory: HANDOFF_DELIVERY_RESERVATION,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
    });
    if (!reservation.reserved) {
      return this.replayExistingAttempt(input.assignmentId, input.idempotencyKey, requestFingerprint, reservation.attempt);
    }

    return this.deliverReserved(input, assignment, reservation.attempt);
  }

  private async deliverReserved(input: SendHandoffInvitationInput, assignment: HandoffAssignment, reservedAttempt: HandoffDeliveryAttempt): Promise<{ state: HandoffAssignmentState; attemptStatus: 'SUCCEEDED' | 'FAILED'; providerMessageRef: string | null; errorCategory: string | null }> {
    const token = randomBytes(32).toString('hex');
    await this.access.create({ assignmentId: assignment.id, tokenHash: hashRefreshToken(token), expiresAt: input.expiresAt ?? null });
    const message = renderInvitationEmail(assignment, token, input.title, input.whyItMatters);
    let delivered = false;
    let errorCategory: string | null = null;
    let providerMessageRef: string | null = null;
    try {
      const result = await this.delivery.send({ to: assignment.invitedEmailNormalized, ...message });
      delivered = result.delivered;
      providerMessageRef = result.providerMessageRef ?? null;
      if (!delivered) errorCategory = 'MAILER_DISABLED';
    } catch (error) {
      errorCategory = classifyDeliveryError(error);
    }

    if (!delivered) {
      await this.attempts.complete({ attemptId: reservedAttempt.id, status: 'FAILED', attemptedAt: this.now(), providerMessageRef, errorCategory });
      await this.access.revokeForAssignment(assignment.id);
      return { state: assignment.state, attemptStatus: 'FAILED', providerMessageRef, errorCategory };
    }

    const transitioned = assignment.state === 'CREATED'
      ? await this.assignments.transitionState({ assignmentId: assignment.id, from: ['CREATED'], to: 'SENT' })
      : assignment;
    const finalAssignment = transitioned ?? assignment;
    if (this.events) await this.events.publish({ type: 'invitation_sent', assignmentId: finalAssignment.id, version: finalAssignment.version, actorId: finalAssignment.createdByActorId, occurredAt: this.now(), interactionChannel: 'api', payload: { targetKind: finalAssignment.targetKind, initiativeId: finalAssignment.initiativeId } });
    await this.attempts.complete({ attemptId: reservedAttempt.id, status: 'SUCCEEDED', attemptedAt: this.now(), providerMessageRef, errorCategory: null });
    return { state: finalAssignment.state, attemptStatus: 'SUCCEEDED', providerMessageRef, errorCategory: null };
  }

  private async replayExistingAttempt(
    assignmentId: string,
    idempotencyKey: string,
    requestFingerprint: string,
    initial: Awaited<ReturnType<HandoffDeliveryAttemptRepository['findByIdempotencyKey']>>,
  ): Promise<{ state: HandoffAssignmentState; attemptStatus: 'IDEMPOTENT'; providerMessageRef: string | null; errorCategory: string | null }> {
    if (!initial) throw new Error('Existing delivery attempt is required');
    if (initial.requestFingerprint !== requestFingerprint) {
      throw AppError.conflict('La clave de idempotencia ya se utilizo con otro contenido', 'HANDOFF_IDEMPOTENCY_CONFLICT');
    }
    let attempt = initial;
    for (let index = 0; attempt.errorCategory === HANDOFF_DELIVERY_RESERVATION && index < 500; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      attempt = await this.attempts.findByIdempotencyKey({ assignmentId, idempotencyKey }) ?? attempt;
    }
    if (attempt.errorCategory === HANDOFF_DELIVERY_RESERVATION) {
      throw AppError.conflict('El envio con esta clave sigue en proceso', 'HANDOFF_DELIVERY_IN_PROGRESS');
    }
    return { state: (await this.requireAssignment(assignmentId)).state, attemptStatus: 'IDEMPOTENT', providerMessageRef: attempt.providerMessageRef, errorCategory: attempt.errorCategory };
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

  private async requireSendableAssignment(id: string): Promise<HandoffAssignment> {
    const assignment = await this.requireAssignment(id);
    if (!(['CREATED', 'SENT', 'VIEWED'] as HandoffAssignmentState[]).includes(assignment.state)) {
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

function classifyDeliveryError(error: unknown): string {
  if (error instanceof Error && /timeout/i.test(error.message)) return 'TIMEOUT';
  if (error instanceof Error && /auth|credential/i.test(error.message)) return 'PROVIDER_AUTH';
  return 'PROVIDER_FAILURE';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}
