/**
 * AiInitialCritiqueService — IR-B3 (ADR-025, PRD §20/§25).
 *
 * Generador REAL de la revisión inicial: llama al ai-service vía el bridge canónico
 * (callAiService, ADR-011/013) y SANEA la salida según los guardrails del PRD §25/§8.
 * El caller se inyecta para poder testear sin red ni breaker.
 *
 * Guardrails aplicados (la IA orienta, no decide):
 *   - Ruta Step 0–4 FIJA: se ignora cualquier routePreview del modelo (§8, RB-IR-013).
 *   - Máximo 3 preguntas estratégicas (§11).
 *   - Tipo de reto coercido a {correction|growth|exploration}; inválido → exploration.
 *   - Lenguaje de validación/aprobación/escalamiento se neutraliza (§25).
 *   - No inventa evidencia: missingEvidence solo como "faltantes" (strings), acotado.
 *
 * El endpoint del ai-service es `POST /api/v1/ai/initial-review` (CC-01,
 * ai-service/agents/initial_reviewer.py). El router usa el mock por defecto;
 * INITIAL_REVIEW_AI=real activa este generador envuelto en
 * ResilientInitialReviewGenerator (fallback a mock, CC-02) y
 * INITIAL_REVIEW_AI=real-strict lo activa sin fallback (debug).
 */
import { callAiService } from '../ai/bridge.service';
import { AppError } from '../../shared/errors/AppError';
import { canonicalRoute } from './route-preview';
import {
  GenerateInput,
  GeneratedReview,
  InitialReviewGenerator,
  CanonicalChallengeType,
  InformationReadiness,
  StrategicQuestion,
  ExpertCritique,
  ImprovedProposal,
} from './initial-review.types';

export type InitialReviewAiCaller = (payload: { originalInput: string; addedContext?: string[]; companyContext?: unknown; focusSection?: string }) => Promise<unknown>;

const AI_PATH = '/api/v1/ai/initial-review';
const defaultCaller: InitialReviewAiCaller = (payload) =>
  callAiService('POST', AI_PATH, payload, { costCapUsd: '0.05', timeoutMs: 60_000 });

const VALID_TYPES: CanonicalChallengeType[] = ['correction', 'growth', 'exploration'];
const VALID_READINESS: InformationReadiness[] = ['very_low', 'low', 'medium', 'high'];
// §25: la IA no puede declarar validación/aprobación/escalamiento ni garantías.
const FORBIDDEN = /\b(validad[oa]s?|aprobad[oa]s?|escal[ae]r?|listo para producci[oó]n|garantiz\w*|100%\s*segur[oa])\b/gi;

export class AiInitialCritiqueService implements InitialReviewGenerator {
  constructor(private readonly call: InitialReviewAiCaller = defaultCaller) {}

  async generate(input: GenerateInput): Promise<GeneratedReview> {
    const raw = await this.call({ originalInput: input.originalInput, addedContext: input.addedContext, companyContext: input.companyContext, focusSection: input.focusSection });
    return this.applyGuardrails(raw);
  }

  private applyGuardrails(raw: unknown): GeneratedReview {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;

    const understandingSummary = this.str(o.understandingSummary);
    const proposal = this.coerceProposal(o.improvedProposal);
    if (!understandingSummary || !proposal.suggestedName) {
      throw AppError.badRequest('La revisión IA vino incompleta.', 'INITIAL_REVIEW_AI_MALFORMED', {
        hint: 'Intenta nuevamente.',
      });
    }

    return {
      generationMode: 'ai',
      understandingSummary: this.scrub(understandingSummary),
      suggestedChallengeType: this.coerceType(o.suggestedChallengeType),
      challengeTypeReason: this.scrub(this.str(o.challengeTypeReason) || 'Sugerido por el análisis del input.'),
      informationReadiness: VALID_READINESS.includes(o.informationReadiness) ? o.informationReadiness : undefined,
      critique: this.coerceCritique(o.critique),
      strategicQuestions: this.coerceQuestions(o.strategicQuestions),
      improvedProposal: proposal,
      routePreview: canonicalRoute(), // guardrail duro: ruta fija, se descarta la del modelo
    };
  }

  private coerceType(v: unknown): CanonicalChallengeType {
    // default seguro: 'exploration' (reducir incertidumbre) si el modelo devuelve algo inválido.
    return VALID_TYPES.includes(v as CanonicalChallengeType) ? (v as CanonicalChallengeType) : 'exploration';
  }

  private coerceProposal(v: any): ImprovedProposal {
    const p = v && typeof v === 'object' ? v : {};
    return {
      suggestedName: this.scrub(this.str(p.suggestedName)),
      improvedDescription: this.scrub(this.str(p.improvedDescription)),
      initialFocus: this.scrub(this.str(p.initialFocus)),
      expectedImpact: this.scrub(this.str(p.expectedImpact)),
      nextRecommendedStep: this.scrub(this.str(p.nextRecommendedStep) || 'Completar Step 0.'),
    };
  }

  private coerceCritique(v: any): ExpertCritique {
    const c = v && typeof v === 'object' ? v : {};
    return {
      solid: this.scrub(this.str(c.solid)),
      weak: this.scrub(this.str(c.weak)),
      risky: this.scrub(this.str(c.risky)),
      recommendedAdjustment: this.scrub(this.str(c.recommendedAdjustment)),
      mainRisk: c.mainRisk ? this.scrub(this.str(c.mainRisk)) : undefined,
      // §25: solo "faltantes" como texto, acotado; nunca afirmaciones de evidencia existente.
      missingEvidence: Array.isArray(c.missingEvidence)
        ? c.missingEvidence.slice(0, 5).map((x: any) => this.scrub(this.str(x))).filter(Boolean)
        : [],
    };
  }

  private coerceQuestions(v: any): StrategicQuestion[] {
    const arr = Array.isArray(v) ? v : [];
    return arr
      .slice(0, 3) // §11: máximo 3 preguntas antes de Step 0
      .map((q: any, i: number) => ({
        id: this.str(q?.id) || `q${i + 1}`,
        question: this.scrub(this.str(q?.question)),
        options: Array.isArray(q?.options) ? q.options.slice(0, 6).map((x: any) => this.str(x)).filter(Boolean) : [],
        allowsUnknown: true, // regla UX: siempre permitir "No lo sé aún"
        answerType: 'single_choice' as const,
        status: 'unanswered' as const,
        shouldCarryToStep0: true,
      }))
      .filter((q) => q.question);
  }

  private str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
  }
  private scrub(s: string): string {
    return s.replace(FORBIDDEN, '[revisar]');
  }
}
