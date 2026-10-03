import api from '../../../app/services/api';
import type { PortfolioEntryBriefIdentity } from '../../portfolio-entry/public/types';
import type { ConfirmedBrief } from './strategicIntentProjection';

export async function getConfirmedBrief(identity: PortfolioEntryBriefIdentity): Promise<ConfirmedBrief> {
  const query = new URLSearchParams({ source: identity.source, sessionRevision: String(identity.sessionRevision), handoffId: identity.handoffId, handoffVersion: String(identity.handoffVersion), confirmationId: identity.confirmationId, confirmationVersion: String(identity.confirmationVersion) });
  const response = await api.get<{ success: boolean; data: ConfirmedBrief }>(`/public/portfolio-entry/sessions/${encodeURIComponent(identity.sessionId)}/confirmed-brief?${query.toString()}`);
  return response.data.data;
}
