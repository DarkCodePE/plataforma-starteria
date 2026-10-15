/**
 * ResilientInitialReviewGenerator — CC-02 (épico company-context-real-ai).
 *
 * Envuelve el generador real (AiInitialCritiqueService) y ante CUALQUIER fallo
 * (BridgeError timeout/503/breaker abierto, INITIAL_REVIEW_AI_MALFORMED, etc.)
 * degrada al mock determinista en vez de dejar la review en `failed` con
 * INITIAL_REVIEW_GEN_FAILED. El mock es §25-compliant por construcción y ya
 * consume companyContext, así que el usuario sigue viendo salida coherente.
 *
 * La degradación NUNCA es silenciosa: se emite un warn estructurado greppeable
 * ("initial-review AI fallback") para detectar un ai-service roto en prod.
 * Para depurar sin red de seguridad usa INITIAL_REVIEW_AI=real-strict.
 */
import type { GenerateInput, GeneratedReview, InitialReviewGenerator } from './initial-review.types';
import { logger } from '../../shared/utils/logger';

export class ResilientInitialReviewGenerator implements InitialReviewGenerator {
  constructor(
    private readonly primary: InitialReviewGenerator,
    private readonly fallback: InitialReviewGenerator,
  ) {}

  async generate(input: GenerateInput): Promise<GeneratedReview> {
    try {
      return await this.primary.generate(input);
    } catch (err) {
      const e = err as { code?: string; requestId?: string; message?: string };
      // pino: el objeto de metadatos va PRIMERO (logger.warn(obj, msg)).
      logger.warn(
        { code: e?.code ?? 'UNKNOWN', requestId: e?.requestId, cause: e?.message },
        'initial-review AI fallback: degradando al generador mock',
      );
      // La plantilla queda marcada como respaldo, no como análisis (F-07).
      return { ...(await this.fallback.generate(input)), generationMode: 'fallback' };
    }
  }
}
