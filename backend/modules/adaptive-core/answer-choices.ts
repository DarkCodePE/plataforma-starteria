/**
 * Respuestas de opción en lenguaje natural → código interno.
 *
 * Las preguntas de decisión (CP-3.4), estado final (CP-4.5) y clasificación de evidencia
 * (CP-1.3) se responden en texto libre. Antes la pregunta listaba los códigos en inglés y sólo
 * se entendía la respuesta si la persona escribía el código literal ("pivot"); ahora la pregunta
 * ofrece las opciones en español y acá se traducen. Un código exacto se sigue aceptando.
 */

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Devuelve el código de la opción que aparece primero en el texto. Ante dos opciones que
 * empiezan en el mismo lugar gana la más larga ("cerrar con aprendizaje" antes que "cerrar").
 * null si no reconoce ninguna.
 */
export function matchChoice(raw: unknown, aliases: Record<string, string>): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const text = normalize(raw);
  const codes = new Set(Object.values(aliases));
  const asCode = text.replace(/ /g, '_');
  if (codes.has(asCode)) return asCode;
  let best: { code: string; at: number; length: number } | null = null;
  for (const [alias, code] of Object.entries(aliases)) {
    const key = normalize(alias);
    const at = ` ${text} `.indexOf(` ${key}`);
    if (at < 0) continue;
    if (!best || at < best.at || (at === best.at && key.length > best.length)) best = { code, at, length: key.length };
  }
  return best?.code ?? null;
}

export const DECISION_CHOICES: Record<string, string> = {
  iterate: 'iterate',
  iterar: 'iterate',
  'repetir la prueba': 'repeat_test',
  repetir: 'repeat_test',
  'ampliar la muestra': 'expand_sample',
  ampliar: 'expand_sample',
  'cambiar el alcance': 'change_scope',
  'cambiar alcance': 'change_scope',
  pivotear: 'pivot',
  pivot: 'pivot',
  'escalar el piloto': 'scale_pilot',
  escalar: 'scale_pilot',
  'continuar la implementacion': 'continue_implementation',
  'continuar implementacion': 'continue_implementation',
  implementar: 'continue_implementation',
  transferir: 'transfer',
  'integrar al roadmap': 'integrate_to_roadmap',
  integrar: 'integrate_to_roadmap',
  pausar: 'pause',
  'cerrar con aprendizaje': 'close_with_learning',
  cerrar: 'close_with_learning',
  'reformular el reto': 'reformulate_challenge',
  reformular: 'reformulate_challenge',
  'buscar capacidad': 'seek_capability',
  'seguimiento de beneficios': 'benefit_tracking',
};

export const FINAL_STATE_CHOICES: Record<string, string> = {
  completada: 'completed',
  completado: 'completed',
  transferida: 'transferred',
  transferido: 'transferred',
  escalada: 'scaled',
  escalado: 'scaled',
  'integrada al roadmap': 'integrated_to_roadmap',
  integrada: 'integrated_to_roadmap',
  'cerrada con aprendizaje': 'closed_with_learning',
  cerrada: 'closed_with_learning',
  pausada: 'paused',
  pausado: 'paused',
  'en nueva iteracion': 'new_iteration_required',
  'nueva iteracion': 'new_iteration_required',
  pivoteada: 'pivoted',
  pivoteado: 'pivoted',
  'buscando capacidad': 'seeking_capability',
  'seguimiento de beneficios': 'benefit_tracking',
};

export const EVIDENCE_CLASSIFICATION_CHOICES: Record<string, string> = {
  apoya: 'supports',
  contradice: 'contradicts',
  'senal debil': 'weak_signal',
  'no alcanza': 'insufficient',
  insuficiente: 'insufficient',
  contexto: 'context',
  'duda nueva': 'new_uncertainty',
  'abre una duda': 'new_uncertainty',
  'nueva incertidumbre': 'new_uncertainty',
};
