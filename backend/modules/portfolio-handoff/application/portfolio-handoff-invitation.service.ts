import { randomBytes } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import { hashRefreshToken } from '../../auth/token.service';
import type { HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type {
  HandoffIdentityClaimResult,
  HandoffInvitationDependencies,
  HandoffInvitationPreview,
} from '../domain/portfolio-handoff-invitation.types';

export type HandoffAuthenticatedIdentity = { id: string; email: string };

export class PortfolioHandoffInvitationService {
  constructor(private readonly dependencies: HandoffInvitationDependencies) {}

  async issueInvitationToken(assignmentId: string, expiresAt: Date | null = null): Promise<string> {
    const assignment = await this.dependencies.assignments.findById(assignmentId);
    if (!assignment) throw AppError.notFound('Invitacion', 'HANDOFF_INVITATION_NOT_FOUND');
    if (assignment.state === 'REVOKED' || assignment.state === 'EXPIRED') throw AppError.conflict('La invitacion ya no esta activa', 'HANDOFF_INVITATION_NOT_ACTIVE');

    const token = randomBytes(32).toString('hex');
    await this.dependencies.access.create({ assignmentId, tokenHash: hashRefreshToken(token), expiresAt });
    return token;
  }

  async readInvitationByToken(token: string, identity?: HandoffAuthenticatedIdentity): Promise<HandoffInvitationPreview> {
    const { assignment } = await this.resolve(token);
    return this.preview(assignment, identity?.email);
  }

  async claimInvitedIdentity(token: string, identity: HandoffAuthenticatedIdentity): Promise<HandoffIdentityClaimResult> {
    const access = await this.dependencies.access.findByTokenHash(hashRefreshToken(token));
    if (!access) return this.invalid('INVALID_INVITATION');
    if (access.revokedAt) return this.invalid('REVOKED');
    const accessExpired = Boolean(access.expiresAt && access.expiresAt.getTime() <= Date.now());

    const assignment = await this.dependencies.assignments.findById(access.assignmentId);
    if (!assignment) return this.invalid('INVALID_INVITATION');
    if (assignment.state === 'REVOKED') return this.invalid('REVOKED');
    if (assignment.state === 'EXPIRED') return this.invalid('EXPIRED');
    if (accessExpired) {
      await this.dependencies.assignments.transitionState({ assignmentId: assignment.id, from: ['CREATED', 'SENT', 'VIEWED'], to: 'EXPIRED' });
      return this.invalid('EXPIRED');
    }

    if (access.claimedByUserId && access.claimedByUserId !== identity.id) {
      return { ...this.preview(assignment, identity.email), identityClaimStatus: 'MISMATCH' };
    }

    const normalizedEmail = normalizeEmail(identity.email);
    if (normalizedEmail !== normalizeEmail(assignment.invitedEmailNormalized)) {
      return { ...this.preview(assignment, identity.email), identityClaimStatus: 'MISMATCH' };
    }

    const alreadyAssociated = assignment.members.some((member) => member.userId === identity.id);
    if (!alreadyAssociated) {
      const associated = await this.dependencies.assignments.associateInvitedIdentity({
        assignmentId: assignment.id,
        userId: identity.id,
        emailNormalized: normalizedEmail,
        identityRef: assignment.invitedIdentityRef,
      });
      if (!associated) return this.invalid('INVALID_INVITATION');
    }

    if (!access.claimedByUserId) await this.dependencies.access.markClaimed({ accessId: access.id, userId: identity.id });

    return { ...this.preview(assignment, identity.email), identityClaimStatus: 'MATCHED' };
  }

  private async resolve(token: string): Promise<{ assignment: HandoffAssignment }> {
    const access = await this.dependencies.access.findByTokenHash(hashRefreshToken(token));
    if (!access || access.revokedAt) throw AppError.notFound('Invitacion', 'HANDOFF_INVITATION_INVALID');
    if (access.expiresAt && access.expiresAt.getTime() <= Date.now()) throw AppError.notFound('Invitacion', 'HANDOFF_INVITATION_EXPIRED');
    const assignment = await this.dependencies.assignments.findById(access.assignmentId);
    if (!assignment) throw AppError.notFound('Invitacion', 'HANDOFF_INVITATION_INVALID');
    if (assignment.state === 'REVOKED') throw AppError.conflict('La invitacion fue revocada', 'HANDOFF_INVITATION_REVOKED');
    if (assignment.state === 'EXPIRED') throw AppError.conflict('La invitacion expiro', 'HANDOFF_INVITATION_EXPIRED');
    return { assignment };
  }

  private preview(assignment: HandoffAssignment, email?: string): HandoffInvitationPreview {
    const normalized = email ? normalizeEmail(email) : null;
    const invited = normalizeEmail(assignment.invitedEmailNormalized);
    return {
      assignmentId: assignment.id,
      targetKind: assignment.targetKind,
      challengeId: assignment.challengeId,
      initiativeId: assignment.initiativeId ?? null,
      authenticationRequired: true,
      identityClaimStatus: normalized ? (normalized === invited ? 'MATCHED' : 'MISMATCH') : 'UNAUTHENTICATED',
    };
  }

  private invalid(status: 'INVALID_INVITATION' | 'EXPIRED' | 'REVOKED'): HandoffIdentityClaimResult {
    return { assignmentId: '', targetKind: 'CHALLENGE', challengeId: '', initiativeId: null, authenticationRequired: true, identityClaimStatus: status };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
