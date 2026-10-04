/* ------------------------------------------------------------------ */
/*  portfolioService.ts - Service layer for Portfolio Lead operations  */
/* ------------------------------------------------------------------ */

import api from './api';
import type {
  StrategicFront,
  CreateStrategicFrontInput,
  Challenge,
  CreateChallengeInput,
  ChallengeActivationMode,
  StakeholderStatus,
  InvitationStatus,
  SquadRole,
  Initiative,
  InitiativeOverlap,
  ExecutiveOutput,
  PortfolioDecisionOutcome,
} from '../portfolio/PortfolioLeadContext';

// ---------- Response shape from backend ----------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------- Backend raw shapes (snake_case may differ) ----------
// We treat the backend responses as the same shape as our types
// since the backend for portfolio was designed alongside the frontend types.
// Add adapters here if naming diverges in the future.

// ── Strategic Fronts ──────────────────────────────────────────────

/** List all strategic fronts. */
export async function listStrategicFronts(): Promise<StrategicFront[]> {
  const { data } = await api.get<ApiResponse<StrategicFront[]>>('/portfolio/strategic-fronts');
  return data.data;
}

/** Create a new strategic front. */
export async function createStrategicFront(input: CreateStrategicFrontInput): Promise<StrategicFront> {
  const { data } = await api.post<ApiResponse<StrategicFront>>('/portfolio/strategic-fronts', input);
  return data.data;
}

/** Update an existing strategic front (partial). */
export async function updateStrategicFront(
  id: string,
  input: Partial<CreateStrategicFrontInput>,
): Promise<StrategicFront> {
  const { data } = await api.patch<ApiResponse<StrategicFront>>(
    `/portfolio/strategic-fronts/${id}`,
    input,
  );
  return data.data;
}

/** Delete a strategic front. */
export async function deleteStrategicFront(id: string): Promise<void> {
  await api.delete(`/portfolio/strategic-fronts/${id}`);
}

// ── Challenges ────────────────────────────────────────────────────

/** List challenges belonging to a strategic front. */
export async function listChallenges(frontId: string): Promise<Challenge[]> {
  const { data } = await api.get<ApiResponse<Challenge[]>>(
    `/portfolio/strategic-fronts/${frontId}/challenges`,
  );
  return data.data;
}

/** Create a challenge under a strategic front. */
export async function createChallenge(
  frontId: string,
  input: CreateChallengeInput,
): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/strategic-fronts/${frontId}/challenges`,
    input,
  );
  return data.data;
}

/** Update a challenge (partial). */
export async function updateChallenge(
  id: string,
  input: Partial<Challenge>,
): Promise<Challenge> {
  const { data } = await api.patch<ApiResponse<Challenge>>(
    `/portfolio/challenges/${id}`,
    input,
  );
  return data.data;
}

/** Add an invitation to a challenge's selectedPeople list. */
export async function addInvitation(
  challengeId: string,
  value: string,
): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/invitations`,
    { value },
  );
  return data.data;
}

/** Update the status of a specific invitation. */
export async function updateInvitation(
  challengeId: string,
  invId: string,
  status: InvitationStatus,
): Promise<Challenge> {
  const { data } = await api.patch<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/invitations/${invId}`,
    { status },
  );
  return data.data;
}

/** Add a member to a challenge's assignedSquad. */
export async function addSquadMember(
  challengeId: string,
  value: string,
  role: SquadRole,
): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/squad`,
    { value, role },
  );
  return data.data;
}

/** Update the role of a squad member. */
export async function updateSquadMember(
  challengeId: string,
  memberId: string,
  role: SquadRole,
): Promise<Challenge> {
  const { data } = await api.patch<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/squad/${memberId}`,
    { role },
  );
  return data.data;
}

// ── Challenge Team (ADR-023, unified reto-scoped team) ─────────────

export interface ChallengeTeamMemberDto {
  id: string;
  challengeId: string;
  userId: string | null;
  label: string | null;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  status: 'ACTIVE' | 'PENDING';
  user?: { id: string; name: string; email: string; initials: string } | null;
}

/** List the reto's unified team (ADR-023). */
export async function listChallengeTeam(challengeId: string): Promise<ChallengeTeamMemberDto[]> {
  const { data } = await api.get<ApiResponse<ChallengeTeamMemberDto[]>>(
    `/portfolio/challenges/${challengeId}/team`,
  );
  return data.data;
}

/** Add a member to the reto team (userId or free-text label). */
export async function addChallengeTeamMember(
  challengeId: string,
  input: { userId?: string; label?: string; role?: 'OWNER' | 'EDITOR' | 'VIEWER'; status?: 'ACTIVE' | 'PENDING' },
): Promise<ChallengeTeamMemberDto> {
  const { data } = await api.post<ApiResponse<ChallengeTeamMemberDto>>(
    `/portfolio/challenges/${challengeId}/team`,
    input,
  );
  return data.data;
}

/** Update a reto team member's role/status/label. */
export async function updateChallengeTeamMember(
  challengeId: string,
  memberId: string,
  input: { role?: 'OWNER' | 'EDITOR' | 'VIEWER'; status?: 'ACTIVE' | 'PENDING'; label?: string },
): Promise<ChallengeTeamMemberDto> {
  const { data } = await api.patch<ApiResponse<ChallengeTeamMemberDto>>(
    `/portfolio/challenges/${challengeId}/team/${memberId}`,
    input,
  );
  return data.data;
}

/** Remove a member from the reto team. */
export async function removeChallengeTeamMember(challengeId: string, memberId: string): Promise<{ id: string }> {
  const { data } = await api.delete<ApiResponse<{ id: string }>>(
    `/portfolio/challenges/${challengeId}/team/${memberId}`,
  );
  return data.data;
}

// ── Initiative team (resolution + per-iniciativa override, #110/#114) ──

/** Resolve the effective team of an iniciativa (inherited + overrides). */
export async function getInitiativeTeam(projectId: string): Promise<unknown> {
  const { data } = await api.get<ApiResponse<unknown>>(`/portfolio/initiatives/${projectId}/team`);
  return data.data;
}

/** Add/override a member on an iniciativa's team. */
export async function upsertInitiativeTeamMember(
  projectId: string,
  userId: string,
  input: { role?: 'OWNER' | 'EDITOR' | 'VIEWER'; status?: 'ACTIVE' | 'PENDING'; modulePermissions?: string[] },
): Promise<unknown> {
  const { data } = await api.put<ApiResponse<unknown>>(
    `/portfolio/initiatives/${projectId}/team/${userId}`,
    input,
  );
  return data.data;
}

/** Remove a member from an iniciativa's team. */
export async function removeInitiativeTeamMember(projectId: string, userId: string): Promise<unknown> {
  const { data } = await api.delete<ApiResponse<unknown>>(
    `/portfolio/initiatives/${projectId}/team/${userId}`,
  );
  return data.data;
}

/** Activate the open call for a challenge. */
export async function activateOpenCall(challengeId: string): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/activate-open-call`,
  );
  return data.data;
}

/** Publish a challenge so it becomes visible to participants. */
export async function publishChallenge(challengeId: string): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/publish`,
  );
  return data.data;
}

// ── Initiatives ───────────────────────────────────────────────────

/** List initiatives belonging to a challenge. */
export async function listInitiatives(challengeId: string): Promise<Initiative[]> {
  const { data } = await api.get<ApiResponse<Initiative[]>>(
    `/portfolio/challenges/${challengeId}/initiatives`,
  );
  return data.data;
}

/**
 * The portfolio link of a project (reto + frente), or null if the iniciativa is not
 * linked to a reto. Used by the Steps portal breadcrumb (#93).
 */
export interface InitiativeMeta {
  id: string;
  projectId: string;
  challengeId: string;
  status: string;
  challenge: {
    id: string;
    title: string;
    name: string | null;
    strategicFrontId: string;
    status: string;
    strategicFront: { id: string; name: string } | null;
  } | null;
}

/** Get the portfolio meta (reto + frente) for a project, or null if unlinked (#93). */
export async function getInitiativeMeta(projectId: string): Promise<InitiativeMeta | null> {
  const { data } = await api.get<ApiResponse<InitiativeMeta | null>>(
    `/portfolio/initiatives/${projectId}/meta`,
  );
  return data.data;
}

/** Upsert the portfolio meta for an initiative (project). */
export async function upsertInitiativeMeta(
  projectId: string,
  input: Partial<Initiative>,
): Promise<Initiative> {
  const { data } = await api.put<ApiResponse<Initiative>>(
    `/portfolio/initiatives/${projectId}/meta`,
    input,
  );
  return data.data;
}

// ── Overlaps ──────────────────────────────────────────────────────

/** List initiative overlaps for a challenge. */
export async function listOverlaps(challengeId: string): Promise<InitiativeOverlap[]> {
  const { data } = await api.get<ApiResponse<InitiativeOverlap[]>>(
    `/portfolio/challenges/${challengeId}/overlaps`,
  );
  return data.data;
}

/** Create an overlap record for a challenge. */
export async function createOverlap(
  challengeId: string,
  input: Omit<InitiativeOverlap, 'id' | 'challengeId'>,
): Promise<InitiativeOverlap> {
  const { data } = await api.post<ApiResponse<InitiativeOverlap>>(
    `/portfolio/challenges/${challengeId}/overlaps`,
    input,
  );
  return data.data;
}

// ── Executive Outputs ─────────────────────────────────────────────

/** List executive outputs for a challenge. */
export async function listExecutiveOutputs(challengeId: string): Promise<ExecutiveOutput[]> {
  const { data } = await api.get<ApiResponse<ExecutiveOutput[]>>(
    `/portfolio/challenges/${challengeId}/executive-outputs`,
  );
  return data.data;
}

/** Create an executive output for a challenge. */
export async function createExecutiveOutput(
  challengeId: string,
  input: Partial<ExecutiveOutput> & { projectId: string; recommendation: PortfolioDecisionOutcome },
): Promise<ExecutiveOutput> {
  const { data } = await api.post<ApiResponse<ExecutiveOutput>>(
    `/portfolio/challenges/${challengeId}/executive-outputs`,
    input,
  );
  return data.data;
}

/** Update an executive output (partial). */
export async function updateExecutiveOutput(
  id: string,
  input: Partial<ExecutiveOutput>,
): Promise<ExecutiveOutput> {
  const { data } = await api.patch<ApiResponse<ExecutiveOutput>>(
    `/portfolio/executive-outputs/${id}`,
    input,
  );
  return data.data;
}

// ── Project Sponsor Data ──────────────────────────────────────────

/** Update sponsor data for a project. */
export async function updateSponsorData(
  projectId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await api.patch(`/projects/${projectId}/sponsor-data`, input);
}

// Re-export activation mode and stakeholder status types for convenience
export type { ChallengeActivationMode, StakeholderStatus };

// ---------- E2E Job-Driven Ola 3 ----------

/** Sugerencia de desagregación de un Frente en Retos (§8–§11). No escribe nada. */
export interface ChallengeSplitSuggestion {
  frontId: string;
  recommendation: 'split' | 'no_split';
  provenance: 'AI_SUGGESTED';
  reviewStatus: 'UNREVIEWED';
  observed: string;
  signals: Array<{ id: string; description: string }>;
  whySplit: string | null;
  benefits: string[];
  proposedChallenges: Array<{ title: string; whatWeWantToMove: string; rationale: string }>;
  impact: { challengesToCreate: number; existingChallenges: number; initiativesMoved: number; note: string } | null;
  stillInference: string;
}

export async function suggestChallengeSplit(frontId: string): Promise<ChallengeSplitSuggestion> {
  const { data } = await api.post<ApiResponse<ChallengeSplitSuggestion>>(`/portfolio/strategic-fronts/${frontId}/challenge-split-suggestion`);
  return data.data;
}

/** Crea sólo los Retos que la persona confirmó (§26). */
export async function confirmChallengeSplit(
  frontId: string,
  challenges: Array<{ title: string; whatWeWantToMove?: string }>,
): Promise<Array<{ id: string; title: string }>> {
  const { data } = await api.post<ApiResponse<Array<{ id: string; title: string }>>>(
    `/portfolio/strategic-fronts/${frontId}/challenge-split-suggestion/confirm`,
    { challenges },
  );
  return data.data;
}

/** Lectura de cobertura del Reto como conjunto (§13). */
export interface ChallengeCoverageReading {
  challengeId: string;
  coverageStatus: string;
  hasWork: boolean;
  initiatives: Array<{ projectId: string; name: string; status: string; currentStep: string | null; readyForDecision: boolean; estimatedContribution: string; blocker: string | null }>;
  overlaps: Array<{ initiativeAId: string; initiativeBId: string; level: string; recommendation: string }>;
  aggregateEvidence: { contributionByLevel: Record<'bajo' | 'medio' | 'alto', number>; partialSignals: number; withRecommendation: number };
  commonDependencies: string[];
  needsMoreCapacity: { value: boolean; reasons: string[] };
  readyToDecide: { value: boolean; reasons: string[] };
  uncovered: string | null;
  decisions?: Array<{ projectId: string; outcome: string; learning: string | null; nextAction: string | null; suggestedReformulation: string | null; decidedAt: string }>;
}

export async function getChallengeCoverageReading(challengeId: string): Promise<ChallengeCoverageReading> {
  const { data } = await api.get<ApiResponse<ChallengeCoverageReading>>(`/portfolio/challenges/${challengeId}/coverage-reading`);
  return data.data;
}

// ---------- E2E Job-Driven Ola 6 ----------

/** Lectura de reconstrucción con gating retroactivo (§14). No persiste nada. */
export interface ReconstructionReading {
  provenance: 'USER_DECLARED';
  restartFromStep0: false;
  sustainableClaims: Array<{ claim: string; evidence: string[] }>;
  availableEvidence: { supports: number; contradicts: number; insufficient: number };
  contradictions: Array<{ supports: string; contradicts: string }>;
  gaps: Array<{ step: number; question: string }>;
  gates: Array<{ step: number; question: string; status: 'met' | 'partial' | 'missing' }>;
  nextMaterialUncertainty: string;
  suggestedReentryStep: number;
}

export async function reconstructExistingWork(input: {
  name: string;
  summary: string;
  goal?: string;
  evidence: Array<{ summary: string; classification: 'supports' | 'contradicts' | 'insufficient' }>;
}): Promise<ReconstructionReading> {
  const { data } = await api.post<ApiResponse<ReconstructionReading>>('/initiatives/reconstruction', input);
  return data.data;
}

/** Lectura de capacidad del portafolio (§4/§24, Core §17). Señales para decidir; no reasigna nada. */
export interface PortfolioCapacityReading {
  unit: 'active_initiatives';
  totalActiveInitiatives: number;
  fronts: Array<{
    frontId: string;
    name: string;
    priority: string;
    activeInitiatives: number;
    share: number;
    challenges: Array<{ challengeId: string; title: string; coverageStatus: string; activeInitiatives: number; blockedInitiatives: number; declaredInternalCapacity: string | null; requiresExternalCapability: boolean }>;
  }>;
  signals: Array<{ kind: string; frontId: string; challengeId?: string; message: string }>;
  note: string;
}

export async function getPortfolioCapacity(): Promise<PortfolioCapacityReading> {
  const { data } = await api.get<ApiResponse<PortfolioCapacityReading>>('/portfolio/capacity');
  return data.data;
}

/** §23: lo que el portfolio aprendió de las últimas decisiones (GET /portfolio/home → learnings). */
export interface PortfolioLearning {
  decisionId: string;
  projectId: string;
  initiativeName: string | null;
  challengeId: string | null;
  challengeTitle: string | null;
  strategicFrontId: string | null;
  outcome: string;
  learning: string | null;
  nextAction: string | null;
  coverageBefore: string | null;
  coverageAfter: string | null;
  suggestedReformulation: string | null;
  decidedAt: string;
}

export async function listPortfolioLearnings(): Promise<PortfolioLearning[]> {
  const { data } = await api.get<ApiResponse<{ learnings?: PortfolioLearning[] }>>('/portfolio/home');
  return data.data.learnings ?? [];
}
