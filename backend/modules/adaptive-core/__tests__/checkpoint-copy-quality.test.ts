/**
 * Calidad del texto que ve la persona en los checkpoints de Steps 0–4 (catálogo fijo):
 * preguntas, el "por qué" debajo de cada una, títulos, objetivos y criterios de cierre.
 *
 * No juzga si la pregunta es buena: atrapa lo que ya se coló a producción
 * ("Que sourceRefs respaldan…", "Elige decision: iterate, repeat_test…", 11 cosas en una sola
 * pregunta, palabras sin tilde).
 */
import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { DECISION_CHOICES, EVIDENCE_CLASSIFICATION_CHOICES, FINAL_STATE_CHOICES, matchChoice } from '../answer-choices';

const CHECKPOINT_KEYS = [
  'CP-0.1', 'CP-0.2', 'CP-0.3',
  'CP-1.1', 'CP-1.2', 'CP-1.3', 'CP-1.4',
  'CP-2.1', 'CP-2.2', 'CP-2.3', 'CP-2.4', 'CP-2.5',
  'CP-3.1', 'CP-3.2', 'CP-3.3', 'CP-3.4', 'CP-3.5',
  'CP-4.1', 'CP-4.2', 'CP-4.3', 'CP-4.4', 'CP-4.5',
];

// Contexto con todo lo que activa preguntas opcionales (empresa, reto, readiness, CP-3.5).
const MASTER_CONTEXT = {
  routeType: 'explore_validate',
  challengeType: 'correction',
  challengeSnapshot: { id: 'ch-1' },
  companySnapshot: { coverage: 80, sources: ['company-1'], restrictions: ['datos sensibles'] },
  risks: ['riesgo alto'],
  step3Output: { decision: { decision: 'scale_pilot' } },
};

const service = new AdaptiveCoreService({} as any) as any;

type Text = { where: string; text: string };

function visibleTexts(): Text[] {
  const texts: Text[] = [];
  for (const key of CHECKPOINT_KEYS) {
    for (const question of service.buildStaticQuestions(key, 1, MASTER_CONTEXT, [])) {
      texts.push({ where: `${key} pregunta`, text: question.prompt });
      texts.push({ where: `${key} por qué`, text: question.reason });
    }
  }
  for (const step of [1, 2, 3, 4]) {
    const config = service.buildStepConfiguration(step, 1, MASTER_CONTEXT);
    texts.push({ where: `Step ${step} nombre`, text: config.visibleName });
    texts.push({ where: `Step ${step} objetivo`, text: config.objective });
    for (const checkpoint of config.checkpoints) {
      texts.push({ where: `${checkpoint.code} título`, text: checkpoint.title });
      for (const criterion of checkpoint.completionCriteria) texts.push({ where: `${checkpoint.code} criterio`, text: criterion });
    }
  }
  return texts;
}

// Identificadores internos: camelCase (sourceRefs, nextAction), snake_case (weak_signal) o
// códigos de checkpoint (CP-3.1).
const INTERNAL_ID = /\b[a-z]+[A-Z]\w*\b|\b[a-z]+_[a-z_]+\b|\bCP-\d/;

// Palabras que en el catálogo aparecían sin tilde. Se buscan como palabra entera.
const UNACCENTED = [
  'decision', 'hipotesis', 'metrica', 'metricas', 'ejecucion', 'diseno', 'disenar', 'senal', 'proximo',
  'interpretacion', 'comparacion', 'seleccion', 'sintesis', 'contribucion', 'operacion', 'iteracion',
  'adopcion', 'documentacion', 'tecnologia', 'lider', 'area', 'informacion', 'validacion', 'accion',
  'aprobacion', 'intencion', 'estrategica', 'explicita', 'critico', 'critica', 'minimo', 'vacios',
  'implementacion', 'confirmacion', 'restriccion', 'que', 'cual', 'quien', 'como', 'cuales', 'quienes',
];
// "que"/"como" sin tilde son correctas fuera de una pregunta; sólo se marcan tras "¿".
const QUESTION_WORDS = new Set(['que', 'cual', 'quien', 'como', 'cuales', 'quienes']);

// Inglés de producto que la persona no tiene por qué entender.
const ENGLISH_JARGON = /\b(owner|baseline|guardrails?|deadline|backup|rollback|readiness|rationale|output|decision maker|go\/no-go|build|buy|partner|hard gate|quick wins?|one-pager|business case|pilot report|handoff|routeType)\b/i;

const MAX_LIST_ITEMS = 6;

describe('texto de los checkpoints (Steps 0–4)', () => {
  const texts = visibleTexts();

  it('recorre todo el catálogo', () => {
    expect(texts.length).toBeGreaterThan(120);
  });

  it('no muestra identificadores internos', () => {
    const offenders = texts.filter(({ text }) => INTERNAL_ID.test(text));
    expect(offenders).toEqual([]);
  });

  it('no usa jerga en inglés', () => {
    const offenders = texts.filter(({ text }) => ENGLISH_JARGON.test(text));
    expect(offenders).toEqual([]);
  });

  it('lleva tildes', () => {
    const offenders = texts.filter(({ text }) => {
      const words: string[] = text.toLowerCase().match(/¿?[a-záéíóúñü]+/g) ?? [];
      return words.some((word) => {
        const bare = word.replace('¿', '');
        if (!UNACCENTED.includes(bare)) return false;
        return QUESTION_WORDS.has(bare) ? word.startsWith('¿') : true;
      });
    });
    expect(offenders).toEqual([]);
  });

  it('las preguntas abren con ¿ y cierran con ?', () => {
    const offenders = texts.filter(({ text }) => (text.includes('?') && !text.includes('¿')) || (text.includes('¿') && !text.includes('?')));
    expect(offenders).toEqual([]);
  });

  // Las opciones para elegir una ("Por ejemplo: iterar, pivotear…") no cuentan: no son cosas que
  // haya que responder a la vez.
  it(`ninguna pregunta pide más de ${MAX_LIST_ITEMS} cosas a la vez`, () => {
    const offenders = texts
      .filter(({ where }) => where.endsWith('pregunta'))
      .filter(({ text }) => text.split('Por ejemplo:')[0].split(',').length > MAX_LIST_ITEMS);
    expect(offenders).toEqual([]);
  });
});

describe('respuestas de opción en español', () => {
  it('entiende la decisión del Step 3 escrita como se ofrece en la pregunta', () => {
    expect(matchChoice('Pivotear hacia el canal digital', DECISION_CHOICES)).toBe('pivot');
    expect(matchChoice('escalar el piloto a 3 regiones', DECISION_CHOICES)).toBe('scale_pilot');
    expect(matchChoice('Cerrar con aprendizaje', DECISION_CHOICES)).toBe('close_with_learning');
    expect(matchChoice('Integrar al roadmap', DECISION_CHOICES)).toBe('integrate_to_roadmap');
    expect(matchChoice('repetir la prueba con más usuarios', DECISION_CHOICES)).toBe('repeat_test');
    expect(matchChoice('scale_pilot', DECISION_CHOICES)).toBe('scale_pilot');
    expect(matchChoice('no sé todavía', DECISION_CHOICES)).toBeNull();
  });

  it('entiende el estado final y la clasificación de evidencia', () => {
    expect(matchChoice('Cerrada con aprendizaje', FINAL_STATE_CHOICES)).toBe('closed_with_learning');
    expect(matchChoice('en nueva iteración', FINAL_STATE_CHOICES)).toBe('new_iteration_required');
    expect(matchChoice('Apoya la hipótesis', EVIDENCE_CLASSIFICATION_CHOICES)).toBe('supports');
    expect(matchChoice('señal débil', EVIDENCE_CLASSIFICATION_CHOICES)).toBe('weak_signal');
    expect(matchChoice('contradicts', EVIDENCE_CLASSIFICATION_CHOICES)).toBe('contradicts');
  });

  it('la decisión en español activa la preparación para operar (CP-3.5) y el estado final', () => {
    expect(service.shouldActivateOperationalReadiness({}, [{ decision: 'Escalar el piloto' }])).toBe(true);
    expect(service.shouldActivateOperationalReadiness({}, [{ decision: 'Pausar' }])).toBe(false);
    expect(service.normalizeFinalState('Pivotear')).toBe('pivoted');
    expect(service.normalizeFinalState('transferida al área de operaciones')).toBe('transferred');
    expect(service.normalizeFinalState('benefit_tracking')).toBe('benefit_tracking');
  });
});
