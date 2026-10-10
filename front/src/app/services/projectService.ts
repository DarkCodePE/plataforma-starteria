/* ------------------------------------------------------------------ */
/*  projectService.ts - Service layer for project CRUD operations      */
/* ------------------------------------------------------------------ */

import api from './api';
import {
  adaptProject,
  adaptProjectToBackend,
  type BackendProject,
  type FrontendProject,
} from './project.adapter';

// ---------- Response shape from backend ----------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------- Step0 types ----------

export interface Step0Data {
  [key: string]: unknown;
}

// ---------- Service functions ----------

/** List all projects for the authenticated user. */
export async function list(): Promise<FrontendProject[]> {
  const { data } = await api.get<ApiResponse<BackendProject[]>>('/projects');
  return data.data.map(adaptProject);
}

/** Get a single project by ID (includes steps, modules, team, evidence). */
export async function getById(id: string): Promise<FrontendProject> {
  const { data } = await api.get<ApiResponse<BackendProject>>(`/projects/${id}`);
  return adaptProject(data.data);
}

/** Create a new project. */
export async function create(
  body: Record<string, unknown>,
): Promise<FrontendProject> {
  const { data } = await api.post<ApiResponse<BackendProject>>('/projects', body);
  return adaptProject(data.data);
}

/** Update a project (partial update). Adapts frontend enums to backend. */
export async function update(
  id: string,
  updates: Partial<FrontendProject>,
): Promise<FrontendProject> {
  const backendBody = adaptProjectToBackend(updates);
  const { data } = await api.patch<ApiResponse<BackendProject>>(
    `/projects/${id}`,
    backendBody,
  );
  return adaptProject(data.data);
}

/** Archive (soft-delete) a project. */
export async function archive(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

/** Get Step 0 data for a project. */
export async function getStep0(id: string): Promise<Step0Data> {
  const { data } = await api.get<ApiResponse<Step0Data>>(
    `/projects/${id}/step0`,
  );
  return data.data;
}

/** Update Step 0 data and status. */
export async function updateStep0(
  id: string,
  step0Data: Step0Data,
  status: string,
): Promise<Step0Data> {
  const { data } = await api.patch<ApiResponse<Step0Data>>(
    `/projects/${id}/step0`,
    { ...step0Data, status },
  );
  return data.data;
}

/** Update the position (order) of a project. */
export async function updatePosition(
  id: string,
  position: number,
): Promise<FrontendProject> {
  const { data } = await api.patch<ApiResponse<BackendProject>>(
    `/projects/${id}/position`,
    { position },
  );
  return adaptProject(data.data);
}

/** La persona invitada acepta su lugar en el equipo (PENDING → ACTIVE). */
export async function acceptTeamInvitation(projectId: string): Promise<void> {
  await api.post(`/projects/${projectId}/team/accept`, {});
}
