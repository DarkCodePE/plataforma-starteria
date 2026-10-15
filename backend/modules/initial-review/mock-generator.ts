/**
 * MockInitialReviewGenerator — generador determinista para IR-B2 (ADR-025).
 *
 * Permite que el flujo create→snapshot funcione end-to-end SIN IA real, para poder
 * verificar el service y las APIs de forma determinista. IR-B3 lo sustituye por el
 * generador real (ai-service). NO llama a ningún modelo; deriva la salida del input.
 *
 * Respeta los guardrails del PRD §25 por construcción: no declara validación, no
 * aprueba Step 0, no inventa evidencia (missingEvidence queda vacío).
 */
import type {
  GenerateInput,
  GeneratedReview,
  InitialReviewGenerator,
  CanonicalChallengeType,
} from './initial-review.types';
import { canonicalRoute } from './route-preview';

/** Heurística determinista de tipo de reto a partir de palabras del input. */
function classify(text: string): CanonicalChallengeType {
  const t = text.toLowerCase();
  if (/\b(oportunidad|crecer|crecimiento|adopci|conversi|ventas|expansi|mercado)\b/.test(t)) return 'growth';
  if (/\b(incertidumbre|explorar|no s[eé]|investigar|validar si|hip[oó]tesis|descubrir)\b/.test(t)) return 'exploration';
  return 'correction';
}

export class MockInitialReviewGenerator implements InitialReviewGenerator {
  async generate(input: GenerateInput): Promise<GeneratedReview> {
    const companyContext = (input.companyContext && typeof input.companyContext === 'object' ? input.companyContext : {}) as any;
    const companyName = companyContext.company?.name ?? '';
    const contextLevel = companyContext.contextLevelLabel ?? companyContext.contextLevel ?? '';
    const missing = Array.isArray(companyContext.missing) ? companyContext.missing.slice(0, 3).join(', ') : '';
    const base = [input.originalInput, ...(input.addedContext ?? []), companyName, contextLevel].join(' ').trim();
    const type = classify(base);
    const firstWords = input.originalInput.trim().split(/\s+/).slice(0, 8).join(' ');

    const reasonByType: Record<CanonicalChallengeType, string> = {
      correction: 'Tu propuesta busca reducir una fricción operativa existente.',
      growth: 'Tu propuesta busca capturar una oportunidad de crecimiento o adopción.',
      exploration: 'Tu propuesta busca reducir incertidumbre antes de decidir avanzar.',
    };

    return {
      generationMode: 'deterministic',
      understandingSummary: `Entiendo que quieres ordenar: "${firstWords}${input.originalInput.trim().split(/\s+/).length > 8 ? '…' : ''}".`,
      suggestedChallengeType: type,
      challengeTypeReason: reasonByType[type],
      informationReadiness: base.length > 220 ? 'medium' : 'low',
      critique: {
        solid: 'La propuesta aborda una necesidad concreta.',
        weak: missing ? `Todavía falta completar contexto de empresa: ${missing}.` : 'Todavía falta precisar frecuencia, alcance e impacto.',
        risky: companyName ? `El riesgo principal es proponer algo que no encaje con la realidad operativa de ${companyName}.` : 'Podrías saltar a una solución antes de entender el problema real.',
        recommendedAdjustment: companyName
          ? `Antes de diseñar, valida actores, permisos y recursos usando el contexto disponible de ${companyName}.`
          : 'Antes de diseñar, delimita proceso, actores y señal de éxito.',
        mainRisk: 'Solución prematura sin evidencia del problema.',
        missingEvidence: [], // guardrail §25: no inventamos evidencia
      },
      strategicQuestions: [
        { id: 'q1', question: '¿Dónde debería empezar esta iniciativa?', options: ['Toda la empresa', 'Un área', 'Un proceso específico', 'No lo sé aún'], allowsUnknown: true, answerType: 'single_choice', status: 'unanswered', shouldCarryToStep0: true },
        { id: 'q2', question: '¿Qué señal demostraría que vale la pena avanzar?', options: ['Menos tiempo', 'Menos errores', 'Más adopción', 'Más conversión', 'No lo sé aún'], allowsUnknown: true, answerType: 'single_choice', status: 'unanswered', shouldCarryToStep0: true },
        { id: 'q3', question: '¿Quién debería apoyar o aprobar esto?', options: ['Mi jefe', 'Sponsor', 'Área operativa', 'Cliente', 'No lo sé aún'], allowsUnknown: true, answerType: 'single_choice', status: 'unanswered', shouldCarryToStep0: true },
      ],
      improvedProposal: {
        suggestedName: firstWords.length > 3 ? firstWords.replace(/^./, (c) => c.toUpperCase()) : 'Iniciativa sin nombre',
        improvedDescription: `${input.originalInput.trim()} — comenzando por delimitar dónde se rompe el proceso actual, qué actores intervienen y qué señal demostraría mejora.`,
        initialFocus: companyName ? `Proceso o área más afectada en ${companyName}.` : 'Proceso o área más afectada.',
        expectedImpact: 'Menor tiempo, menor retrabajo, mayor trazabilidad.',
        nextRecommendedStep: 'Completar Step 0 para aterrizar alcance, actores, sponsor y restricciones.',
      },
      routePreview: canonicalRoute(),
    };
  }
}
