import api, { parseApiError } from '../../../app/services/api';
import { createIdempotencyKey } from '../../portfolio-entry/public/idempotency';

type Envelope<T> = { success: true; data: T };
export type ActivationBriefVersion = {
  id: string; versionNumber: number; status: 'DRAFT' | 'CONFIRMED'; intent: string | null; scope: string | null;
  strategicContextRefs: unknown; inheritedContext: unknown; constraintsSnapshot: unknown; knownGaps: unknown; sourceRefs: unknown; provenance: unknown;
  createdAt: string; confirmedAt: string | null;
};
export type ActivationBrief = { id: string; challengeId: string; organizationId: string; versions: ActivationBriefVersion[] };
export type BriefInput = { intent?: string | null; scope?: string | null; strategicContextRefs?: unknown; inheritedContext?: unknown; constraintsSnapshot?: unknown; knownGaps?: unknown; sourceRefs?: unknown; provenance?: unknown };

async function post<T>(path: string, body: unknown, idempotencyScope: string, idempotencyKey?: string): Promise<T> {
  try {
    const { data } = await api.post<Envelope<T>>(path, body, { headers: { 'Idempotency-Key': idempotencyKey ?? createIdempotencyKey(idempotencyScope) } });
    return data.data;
  } catch (error) { throw parseApiError(error); }
}

export async function createActivationBrief(challengeId: string, input: BriefInput, idempotencyKey?: string): Promise<{ brief: ActivationBrief; idempotent: boolean }> {
  return post(`/portfolio/challenges/${encodeURIComponent(challengeId)}/activation-briefs`, input, `activation-brief:create:${challengeId}`, idempotencyKey);
}
export async function listActivationBriefs(challengeId: string): Promise<ActivationBrief[]> {
  try { const { data } = await api.get<Envelope<ActivationBrief[]>>(`/portfolio/challenges/${encodeURIComponent(challengeId)}/activation-briefs`); return data.data; }
  catch (error) { throw parseApiError(error); }
}
export async function getActivationBrief(briefId: string): Promise<ActivationBrief> {
  try { const { data } = await api.get<Envelope<ActivationBrief>>(`/portfolio/activation-briefs/${encodeURIComponent(briefId)}`); return data.data; }
  catch (error) { throw parseApiError(error); }
}
export async function createActivationBriefVersion(briefId: string, input: BriefInput, idempotencyKey?: string): Promise<{ version: ActivationBriefVersion; idempotent: boolean }> {
  return post(`/portfolio/activation-briefs/${encodeURIComponent(briefId)}/versions`, input, `activation-brief:version:${briefId}`, idempotencyKey);
}
export async function confirmActivationBriefVersion(versionId: string, idempotencyKey?: string): Promise<{ version: ActivationBriefVersion; idempotent: boolean }> {
  return post(`/portfolio/activation-brief-versions/${encodeURIComponent(versionId)}/confirm`, {}, `activation-brief:confirm:${versionId}`, idempotencyKey);
}
