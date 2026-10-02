import { randomUUID } from 'node:crypto';
import { callAiService, BridgeError } from '../ai/bridge.service';
import { logger } from '../../shared/utils/logger';
import { firstValueP3InputSchema, P3_DISPOSITIONS, type FirstValueP3Input } from './first-value-p3.schemas';

export class P3Error extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'P3Error';
  }
}

export interface P3Caller { userId: string; role: string }
export interface P3Provider { analyze(input: FirstValueP3Input, caller?: P3Caller): Promise<unknown> }

export class FirstValueP3Provider implements P3Provider {
  async analyze(input: FirstValueP3Input, caller?: P3Caller): Promise<unknown> {
    return callAiService('POST', '/api/v1/ai/first-value/p3/analyze', input, {
      requestId: input.requestId,
      userClaims: caller ? { userId: caller.userId, role: caller.role } : undefined,
      costCapUsd: '0.0500',
      timeoutMs: 30_000,
      maxRetries: 1,
    });
  }
}

type ModelRelationship = { itemId: string; disposition: string; rationale: string; evidenceRefs: string[]; inferred: true };
type ModelClarification = { id: string; affectedItemIds: string[]; question: string; reason: string };

export class FirstValueP3Service {
  constructor(private readonly provider: P3Provider = new FirstValueP3Provider()) {}

  async analyze(raw: unknown, caller?: P3Caller) {
    const parsed = firstValueP3InputSchema.safeParse(raw);
    if (!parsed.success) throw new P3Error('P3_INVALID_INPUT', 'La solicitud P3 no es válida.', 400);
    const input = parsed.data;
    if (!input.p2Confirmed) throw new P3Error('P3_INPUT_NOT_CONFIRMED', 'Confirma el trabajo existente antes de analizar.', 409);

    const startedAt = Date.now();
    try {
      const rawResult = await this.provider.analyze(input, caller);
      const result = this.validateResult(rawResult, input);
      const counts = { NEEDS_CONTEXT: 0, POSSIBLE_OTHER_PRIORITY: 0, DIRECT_CONTRIBUTION: 0 };
      for (const relationship of result.relationships) counts[relationship.disposition as keyof typeof counts]++;
      const analysisId = randomUUID();
      logger.info({ requestId: input.requestId, durationMs: Date.now() - startedAt, resultStatus: 'PROVISIONAL', dispositionCounts: counts, clarificationCount: result.clarifications.length, processorId: result.processorId }, 'First Value P3 analysis completed');
      return {
        sessionId: input.sessionId,
        requestId: input.requestId,
        analysisId,
        relationships: result.relationships,
        clarifications: result.clarifications,
        summary: { analyzedItemCount: result.relationships.length, counts, exceptionFirstNarrative: result.summary },
        provenance: {
          sessionId: input.sessionId,
          requestId: input.requestId,
          analysisId,
          contractVersion: 'first-value-p3-v0.1',
          processorId: result.processorId,
          sources: [
            { ref: 'goal', sourceType: 'USER_DECLARED_CONFIRMED' },
            ...(input.context ? [{ ref: 'context', sourceType: 'USER_DECLARED_CONFIRMED' }] : []),
            ...input.initiatives.map((item) => ({ ref: `initiative:${item.itemId}`, sourceType: 'USER_DECLARED_CONFIRMED' })),
            ...(input.clarifications ?? []).map((item) => ({ ref: `clarification:${item.id}`, sourceType: 'USER_CLARIFICATION' })),
          ],
          inference: 'AI_INFERENCE',
        },
        resultState: 'PROVISIONAL' as const,
      };
    } catch (error) {
      const mapped = this.mapError(error);
      logger.warn({ requestId: input.requestId, durationMs: Date.now() - startedAt, resultStatus: mapped.code }, 'First Value P3 analysis failed');
      throw mapped;
    }
  }

  private validateResult(raw: unknown, input: FirstValueP3Input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new P3Error('P3_INVALID_ANALYSIS', 'El análisis recibido no es válido.', 502);
    const candidate = raw as Record<string, unknown>;
    const relationships = candidate.relationships;
    const clarifications = candidate.clarifications;
    const summary = candidate.summary;
    const processorId = candidate.processorId;
    const invalid = () => new P3Error('P3_INVALID_ANALYSIS', 'El análisis recibido está incompleto o no es válido.', 502);
    const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
    if (!Array.isArray(relationships) || relationships.length !== input.initiatives.length || !Array.isArray(clarifications) || clarifications.length > 20 || !bounded(summary, 2000) || !bounded(processorId, 160) || Object.keys(candidate).some((key) => !['relationships', 'clarifications', 'summary', 'processorId'].includes(key))) throw invalid();

    const inputIds = new Set(input.initiatives.map((item) => item.itemId));
    const relationshipIds = new Set<string>();
    const evidenceRefs = new Set(['goal', ...(input.context ? ['context'] : []), ...input.initiatives.map((item) => `initiative:${item.itemId}`), ...(input.clarifications ?? []).map((item) => `clarification:${item.id}`)]);

    const cleanRelationships: ModelRelationship[] = relationships.map((item) => {
      if (!item || typeof item !== 'object') throw invalid();
      const rel = item as Record<string, unknown>;
      if (typeof rel.itemId !== 'string' || !inputIds.has(rel.itemId) || relationshipIds.has(rel.itemId)) throw invalid();
      relationshipIds.add(rel.itemId);
      if (typeof rel.disposition !== 'string' || !(P3_DISPOSITIONS as readonly string[]).includes(rel.disposition)) throw invalid();
      if (!bounded(rel.rationale, 1000) || !Array.isArray(rel.evidenceRefs) || rel.evidenceRefs.length === 0 || !rel.evidenceRefs.every((ref) => typeof ref === 'string' && evidenceRefs.has(ref)) || Object.keys(rel).some((key) => !['itemId', 'disposition', 'rationale', 'evidenceRefs'].includes(key))) throw invalid();
      return { itemId: rel.itemId, disposition: rel.disposition, rationale: rel.rationale.trim(), evidenceRefs: rel.evidenceRefs as string[], inferred: true };
    });
    if (relationshipIds.size !== inputIds.size) throw invalid();

    const cleanClarifications: ModelClarification[] = clarifications.map((item) => {
      if (!item || typeof item !== 'object') throw invalid();
      const q = item as Record<string, unknown>;
      if (!bounded(q.id, 120) || !Array.isArray(q.affectedItemIds) || !q.affectedItemIds.length || q.affectedItemIds.length > input.initiatives.length || new Set(q.affectedItemIds).size !== q.affectedItemIds.length || !q.affectedItemIds.every((id) => typeof id === 'string' && inputIds.has(id)) || !bounded(q.question, 1000) || !bounded(q.reason, 500) || Object.keys(q).some((key) => !['id', 'affectedItemIds', 'question', 'reason'].includes(key))) throw invalid();
      const selected = input.initiatives.filter((initiative) => (q.affectedItemIds as string[]).includes(initiative.itemId));
      if (!selected.every((initiative) => q.question!.toString().toLocaleLowerCase().includes(initiative.itemId.toLocaleLowerCase()) || q.question!.toString().toLocaleLowerCase().includes(initiative.name.toLocaleLowerCase()))) throw invalid();
      return { id: q.id, affectedItemIds: [...new Set(q.affectedItemIds as string[])], question: q.question.trim(), reason: q.reason.trim() };
    });
    return { relationships: cleanRelationships, clarifications: cleanClarifications, summary: summary.trim(), processorId };
  }

  private mapError(error: unknown): P3Error {
    if (error instanceof P3Error) return error;
    if (error instanceof BridgeError) {
      if (error.code === 'AI_UPSTREAM_TIMEOUT') return new P3Error('P3_PROCESSOR_TIMEOUT', 'El análisis tardó demasiado. Puedes intentarlo de nuevo.', 504);
      if (error.code === 'AI_INVALID_INPUT') return new P3Error('P3_INVALID_ANALYSIS', 'El análisis recibido está incompleto o no es válido.', 502);
      return new P3Error('P3_PROCESSOR_UNAVAILABLE', 'El procesador no está disponible. Puedes intentarlo de nuevo.', 503);
    }
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: unknown }).code);
      if (code === 'AI_UPSTREAM_TIMEOUT') return new P3Error('P3_PROCESSOR_TIMEOUT', 'El análisis tardó demasiado. Puedes intentarlo de nuevo.', 504);
      if (code === 'AI_INVALID_INPUT') return new P3Error('P3_INVALID_ANALYSIS', 'El análisis recibido está incompleto o no es válido.', 502);
    }
    return new P3Error('P3_PROCESSOR_UNAVAILABLE', 'El procesador no está disponible. Puedes intentarlo de nuevo.', 503);
  }
}

export const firstValueP3Service = new FirstValueP3Service();
