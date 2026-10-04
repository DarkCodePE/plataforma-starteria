import api from '../../../app/services/api';
import type { AdaptiveInitiativeCore } from '../domain/types';

export interface TruthBinding {
  claimId: string;
  evidenceIds: string[];
  sourceRefIds: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export async function getAdaptiveCore(projectId: string): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.get<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core`);
  return data.data;
}

export async function confirmAdaptiveCheckpoint(
  projectId: string,
  input: {
    idempotencyKey: string;
    checkpointKey: string;
    responses: Record<string, unknown>;
    truthBindings?: TruthBinding;
  },
): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.post<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core/checkpoints/confirm`, input);
  return data.data;
}

export async function confirmStep0Brief(
  projectId: string,
  input: {
    idempotencyKey: string;
    brief: Record<string, unknown>;
    confirmed: boolean;
  },
): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.post<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core/step0/brief/confirm`, input);
  return data.data;
}

export async function confirmStep1Output(
  projectId: string,
  input: {
    idempotencyKey: string;
    brief: Record<string, unknown>;
    confirmed: boolean;
  },
): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.post<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core/step1/output/confirm`, input);
  return data.data;
}

export async function confirmStep2Output(
  projectId: string,
  input: {
    idempotencyKey: string;
    brief: Record<string, unknown>;
    confirmed: boolean;
  },
): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.post<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core/step2/output/confirm`, input);
  return data.data;
}

export async function confirmStep3Output(
  projectId: string,
  input: {
    idempotencyKey: string;
    brief: Record<string, unknown>;
    confirmed: boolean;
  },
): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.post<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core/step3/output/confirm`, input);
  return data.data;
}

export async function confirmStep4Output(
  projectId: string,
  input: {
    idempotencyKey: string;
    brief: Record<string, unknown>;
    confirmed: boolean;
  },
): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.post<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core/step4/output/confirm`, input);
  return data.data;
}

export async function registerCriticalChange(
  projectId: string,
  input: {
    idempotencyKey: string;
    field: 'scope' | 'company_or_area' | 'challenge_type' | 'route' | 'hypothesis' | 'target_date' | 'critical_restriction' | 'selected_bet';
    previousValue?: unknown;
    nextValue: unknown;
    reason?: string;
    confirmed: boolean;
    action?: 'update_route' | 'keep_previous_route' | 'split_phases' | 'back_and_edit';
  },
): Promise<AdaptiveInitiativeCore> {
  const { data } = await api.post<ApiResponse<AdaptiveInitiativeCore>>(`/projects/${projectId}/adaptive-core/critical-change`, input);
  return data.data;
}

/** Mission Review (§18): lectura de lo que la iniciativa hereda antes de empezar Step 0. */
export interface MissionReview {
  projectId: string;
  initiativeName: string;
  independent: boolean;
  whatToMove: string | null;
  inheritedContext: {
    strategicFront: { id: string; name: string; desiredResult: string | null; kpi: string | null; target: string | null; horizon: string | null } | null;
    challenge: { id: string; title: string; whyNow: string | null; successCriteria: string | null } | null;
    initiativeContext: string | null;
  };
  expectedContribution: string | null;
  constraints: string[];
  capacity: string[];
  dependencies: string[];
  whoCanHelp: string[];
  decisionToEnable: string | null;
  openQuestions: string[];
}

export async function getMissionReview(projectId: string): Promise<MissionReview> {
  const { data } = await api.get<ApiResponse<MissionReview>>(`/projects/${projectId}/mission-review`);
  return data.data;
}

/** Modos del Copilot por intención (E2E Job-Driven §20). Lectura del estado persistido. */
export type CopilotIntentMode = 'orient' | 'work_with_me' | 'unblock';
export interface CopilotModeResponse {
  mode: CopilotIntentMode;
  title: string;
  answer: string;
  actions: Array<{ label: string; target: string }>;
  sources: string[];
}

export async function getCopilotMode(projectId: string, mode: CopilotIntentMode): Promise<CopilotModeResponse> {
  const { data } = await api.get<ApiResponse<CopilotModeResponse>>(`/projects/${projectId}/copilot-mode/${mode}`);
  return data.data;
}
