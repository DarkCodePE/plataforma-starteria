import { randomBytes } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import { config } from '../../../config';
import { hashRefreshToken } from '../../auth/token.service';
import type { HandoffAssignment, HandoffAssignmentRepository, HandoffAssignmentState } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffDeliveryAttemptRepository, HandoffInvitationAccessRepository } from '../domain/portfolio-handoff-invitation.types';

export type HandoffInvitationDeliveryPort = {
  send(input: { to: string; subject: string; text: string; html: string }): Promise<{ delivered: boolean; providerMessageRef?: string }>;
};

export type SendHandoffInvitationInput = {
  assignmentId: string;
  idempotencyKey: string;
  expiresAt?: Date | null;
  title?: string;
  whyItMatters?: string;
};

export class PortfolioHandoffDeliveryService {
  constructor(
    private readonly assignments: HandoffAssignmentRepository,
    private readonly access: HandoffInvitationAccessRepository,
    private readonly attempts: HandoffDeliveryAttemptRepository,
    private readonly delivery: HandoffInvitationDeliveryPort,
  ) {}

  async sendHandoffInvitation(input: SendHandoffInvitationInput): Promise<{ state: HandoffAssignmentState; attemptStatus: 'SUCCEEDED' | 'FAILED' | 'IDEMPOTENT' }> {
    if (!input.idempotencyKey.trim()) throw AppError.badRequest('Idempotency key requerida', 'HANDOFF_IDEMPOTENCY_REQUIRED');
    const existingAttempt = await this.attempts.findByIdempotencyKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey });
    if (existingAttempt) return { state: (await this.requireAssignment(input.assignmentId)).state, attemptStatus: 'IDEMPOTENT' };

    const assignment = await this.requireAssignment(input.assignmentId);
    if (!(['CREATED', 'SENT', 'VIEWED'] as HandoffAssignmentState[]).includes(assignment.state)) {
      throw AppError.conflict('La invitacion ya no puede enviarse', 'HANDOFF_INVITATION_NOT_SENDABLE');
    }

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

    await this.attempts.create({ assignmentId: assignment.id, channel: 'EMAIL', status: delivered ? 'SUCCEEDED' : 'FAILED', attemptedAt: new Date(), providerMessageRef, errorCategory, idempotencyKey: input.idempotencyKey });
    if (!delivered) return { state: assignment.state, attemptStatus: 'FAILED' };

    const transitioned = assignment.state === 'CREATED'
      ? await this.assignments.transitionState({ assignmentId: assignment.id, from: ['CREATED'], to: 'SENT' })
      : assignment;
    return { state: transitioned?.state ?? assignment.state, attemptStatus: 'SUCCEEDED' };
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
    return { state: (await this.requireAssignment(assignment.id)).state };
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
}

export function renderInvitationEmail(assignment: HandoffAssignment, token: string, title = 'Una asignacion de Starteria', whyItMatters?: string): { subject: string; text: string; html: string } {
  const url = `${config.handoffInvitationBaseUrl.replace(/\/$/, '')}/handoff/invitations/${encodeURIComponent(token)}`;
  const context = whyItMatters?.trim() ? `\n\n${whyItMatters.trim()}` : '';
  const text = `Starteria\n\nTe han invitado a revisar una asignación\n\n${title}${context}\n\nRevisar asignación: ${url}\n\nAl abrir Starteria podrás revisar el contexto antes de decidir.`;
  const escapedTitle = escapeHtml(title);
  const escapedUrl = escapeHtml(url);
  return { subject: 'Te han invitado a revisar una asignación', text, html: `<p><strong>Starteria</strong></p><p>Te han invitado a revisar una asignación</p><p>${escapedTitle}</p><p><a href="${escapedUrl}">Revisar asignación</a></p><p>Al abrir Starteria podrás revisar el contexto antes de decidir.</p>` };
}

function classifyDeliveryError(error: unknown): string {
  if (error instanceof Error && /timeout/i.test(error.message)) return 'TIMEOUT';
  if (error instanceof Error && /auth|credential/i.test(error.message)) return 'PROVIDER_AUTH';
  return 'PROVIDER_FAILURE';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}
