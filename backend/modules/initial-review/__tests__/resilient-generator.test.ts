/**
 * resilient-generator.test.ts — CC-02 (épico company-context-real-ai).
 *
 * Fija la degradación: si el generador real falla (bridge caído, 503, salida
 * malformada), la review NO termina en INITIAL_REVIEW_GEN_FAILED — se responde
 * con el generador mock, y el fallo queda logueado con warn estructurado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResilientInitialReviewGenerator } from '../resilient-generator';
import { MockInitialReviewGenerator } from '../mock-generator';
import type { GeneratedReview, InitialReviewGenerator } from '../initial-review.types';
import { logger } from '../../../shared/utils/logger';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const FAKE_REVIEW = { understandingSummary: 'desde el primario' } as GeneratedReview;

function primaryThat(behavior: () => Promise<GeneratedReview>): InitialReviewGenerator {
  return { generate: vi.fn(behavior) };
}

describe('ResilientInitialReviewGenerator (CC-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passthrough: si el primario responde, devuelve su salida sin tocar el fallback', async () => {
    const primary = primaryThat(async () => FAKE_REVIEW);
    const fallback = primaryThat(async () => {
      throw new Error('no debería llamarse');
    });
    const out = await new ResilientInitialReviewGenerator(primary, fallback).generate({ originalInput: 'algo' });
    expect(out).toBe(FAKE_REVIEW);
    expect(fallback.generate).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fallback: si el primario lanza (ej. BridgeError 503), responde con el mock y loguea warn', async () => {
    const bridgeError = Object.assign(new Error('AI service unavailable'), {
      code: 'SERVICE_UNAVAILABLE',
      requestId: 'req-123',
    });
    const primary = primaryThat(async () => {
      throw bridgeError;
    });
    const gen = new ResilientInitialReviewGenerator(primary, new MockInitialReviewGenerator());

    const out = await gen.generate({
      originalInput: 'Necesito ordenar la gestión de proyectos',
      companyContext: { company: { name: 'Acme' }, contextLevelLabel: 'Contexto parcial' },
    });

    // Salida del mock, consciente del contexto de empresa (no un throw).
    expect(out.understandingSummary).toContain('Entiendo que quieres ordenar');
    expect(out.critique.risky).toContain('Acme');
    expect(out.routePreview.map((r) => r.step)).toEqual([0, 1, 2, 3, 4]);
    // pino: metadatos primero, mensaje después.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SERVICE_UNAVAILABLE', requestId: 'req-123' }),
      'initial-review AI fallback: degradando al generador mock',
    );
  });

  it('fallback también ante salida malformada del modelo (INITIAL_REVIEW_AI_MALFORMED)', async () => {
    const primary = primaryThat(async () => {
      throw Object.assign(new Error('malformed'), { code: 'INITIAL_REVIEW_AI_MALFORMED' });
    });
    const gen = new ResilientInitialReviewGenerator(primary, new MockInitialReviewGenerator());
    const out = await gen.generate({ originalInput: 'algo' });
    expect(out.understandingSummary).toBeTruthy();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('si el fallback también lanza, el error se propaga (la review sí queda failed)', async () => {
    const primary = primaryThat(async () => {
      throw new Error('primario roto');
    });
    const fallback = primaryThat(async () => {
      throw new Error('mock roto');
    });
    await expect(new ResilientInitialReviewGenerator(primary, fallback).generate({ originalInput: 'algo' })).rejects.toThrow(
      'mock roto',
    );
  });
});

// Auditoría E2E F-07: la plantilla de respaldo se presentaba igual que un análisis del modelo.
describe('ResilientInitialReviewGenerator — modo de generación (F-07)', () => {
  it('si el primario falla, la salida queda marcada como fallback', async () => {
    const primary = primaryThat(async () => { throw new Error('503'); });
    const out = await new ResilientInitialReviewGenerator(primary, new MockInitialReviewGenerator()).generate({ originalInput: 'Mejorar compras' });
    expect(out.generationMode).toBe('fallback');
  });

  it('la plantilla sola se marca deterministic', async () => {
    const out = await new MockInitialReviewGenerator().generate({ originalInput: 'Mejorar compras' });
    expect(out.generationMode).toBe('deterministic');
  });
});
