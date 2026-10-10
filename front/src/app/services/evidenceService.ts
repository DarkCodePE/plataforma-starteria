/* evidenceService.ts — evidencias de una iniciativa (/projects/:id/evidence). */
import api from './api';
import type { Evidence } from '../context/AppContext';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface CreateEvidenceInput {
  name: string;
  type: Evidence['type'];
  size?: string;
  url?: string;
  stepRef: number;
}

/** Sube la evidencia; el backend la registra a nombre de quien llama. */
export async function create(projectId: string, input: CreateEvidenceInput): Promise<{ id: string }> {
  const { data } = await api.post<ApiResponse<{ id: string }>>(`/projects/${projectId}/evidence`, input);
  return data.data;
}
