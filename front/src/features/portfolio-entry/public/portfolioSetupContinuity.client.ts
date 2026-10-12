import axios from 'axios';
import api from '../../../app/services/api';
import {
  portfolioSetupContinuityReadSchema, portfolioSetupContinueRequestSchema, portfolioSetupContinueResponseSchema,
  type PortfolioSetupContinuityRead, type PortfolioSetupContinueRequest, type PortfolioSetupContinueResponse,
} from './portfolioSetupContinuity.types';

const endpoint = (sessionId: string) =>
  `/public/portfolio-entry/sessions/${encodeURIComponent(sessionId)}/portfolio-setup-continuity`;

export class PortfolioSetupInvalidResponseError extends Error {
  constructor() { super('Invalid Portfolio Setup continuity response'); }
}

export function parsePortfolioSetupRead(value: unknown): PortfolioSetupContinuityRead {
  const result = portfolioSetupContinuityReadSchema.safeParse(value);
  if (!result.success) throw new PortfolioSetupInvalidResponseError();
  return result.data;
}

export async function getPortfolioSetupContinuity(sessionId: string): Promise<PortfolioSetupContinuityRead> {
  const response = await api.get<unknown>(endpoint(sessionId));
  const envelope = response.data;
  if (!envelope || typeof envelope !== 'object' || !('success' in envelope) || envelope.success !== true
    || !('data' in envelope)) throw new PortfolioSetupInvalidResponseError();
  return parsePortfolioSetupRead(envelope.data);
}

export async function continuePortfolioSetup(
  sessionId: string, input: PortfolioSetupContinueRequest, idempotencyKey: string,
): Promise<PortfolioSetupContinueResponse> {
  const body = portfolioSetupContinueRequestSchema.parse(input);
  const response = await api.post<unknown>(`${endpoint(sessionId)}/continue`, body,
    { headers: { 'Idempotency-Key': idempotencyKey } });
  const envelope = response.data;
  if (!envelope || typeof envelope !== 'object' || !('success' in envelope) || envelope.success !== true
    || !('data' in envelope)) throw new PortfolioSetupInvalidResponseError();
  const parsed = portfolioSetupContinueResponseSchema.safeParse(envelope.data);
  if (!parsed.success) throw new PortfolioSetupInvalidResponseError();
  return parsed.data;
}

export function portfolioSetupErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const body: unknown = error.response?.data;
  if (!body || typeof body !== 'object' || !('error' in body)) return undefined;
  const detail = body.error;
  return detail && typeof detail === 'object' && 'code' in detail && typeof detail.code === 'string'
    ? detail.code : undefined;
}

export function portfolioSetupHttpStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}
