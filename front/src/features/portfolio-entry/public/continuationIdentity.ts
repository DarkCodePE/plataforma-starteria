import type { PortfolioEntryBriefIdentity, PortfolioEntrySessionDto } from './types';

export function isPortfolioEntryBriefIdentity(value: unknown): value is PortfolioEntryBriefIdentity {
  if (!value || typeof value !== 'object') return false;
  const identity = value as Partial<PortfolioEntryBriefIdentity>;
  return identity.source === 'portfolio_entry'
    && typeof identity.sessionId === 'string' && identity.sessionId.length > 0
    && Number.isInteger(identity.sessionRevision) && (identity.sessionRevision ?? -1) >= 0
    && typeof identity.handoffId === 'string' && identity.handoffId.length > 0
    && Number.isInteger(identity.handoffVersion) && (identity.handoffVersion ?? 0) > 0
    && typeof identity.confirmationId === 'string' && identity.confirmationId.length > 0
    && Number.isInteger(identity.confirmationVersion) && (identity.confirmationVersion ?? 0) > 0;
}

/** Extracts only an explicitly confirmed Brief identity from an authorized DTO. */
export function portfolioEntryBriefIdentityFromSession(
  session: PortfolioEntrySessionDto,
): PortfolioEntryBriefIdentity | null {
  const handoff = session.handoff;
  const confirmation = session.confirmation;
  if (session.lifecycleStatus !== 'CONFIRMED'
    || !Number.isInteger(session.revision) || session.revision < 0
    || !handoff?.id || !Number.isInteger(handoff.version) || handoff.version <= 0
    || confirmation?.status !== 'CONFIRMED'
    || !confirmation.id || !Number.isInteger(confirmation.version) || confirmation.version <= 0) return null;

  return {
    source: 'portfolio_entry',
    sessionId: session.id,
    sessionRevision: session.revision,
    handoffId: handoff.id,
    handoffVersion: handoff.version,
    confirmationId: confirmation.id,
    confirmationVersion: confirmation.version,
  };
}

/** Uses the backend claim revision and rejects a claim response that changes the confirmed Brief identity. */
export function portfolioEntryClaimIdentity(
  claimResponse: PortfolioEntrySessionDto,
  pendingIdentity?: PortfolioEntryBriefIdentity,
): PortfolioEntryBriefIdentity | null {
  const claimedIdentity = portfolioEntryBriefIdentityFromSession(claimResponse);
  if (pendingIdentity) {
    if (pendingIdentity.sessionId !== claimResponse.id
      || claimResponse.lifecycleStatus !== 'CONFIRMED'
      || claimResponse.confirmation?.status !== 'CONFIRMED'
      || claimResponse.handoff?.id !== pendingIdentity.handoffId
      || claimResponse.handoff.version !== pendingIdentity.handoffVersion
      || claimResponse.confirmation.id !== pendingIdentity.confirmationId
      || claimResponse.confirmation.version !== pendingIdentity.confirmationVersion) return null;
    if (claimedIdentity && (
      pendingIdentity.confirmationId !== claimedIdentity.confirmationId
      || pendingIdentity.confirmationVersion !== claimedIdentity.confirmationVersion
    )) return null;
    return { ...pendingIdentity, sessionRevision: claimResponse.revision };
  }
  return claimedIdentity;
}
