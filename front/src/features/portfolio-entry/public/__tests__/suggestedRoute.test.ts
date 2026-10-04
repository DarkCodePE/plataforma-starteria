import { describe, expect, it } from 'vitest';
import { deriveSuggestedRoute } from '../suggestedRoute';
import type { PortfolioEntryHandoff } from '../types';

function handoff(overrides: Partial<PortfolioEntryHandoff> = {}): PortfolioEntryHandoff {
  return {
    understanding: { value: 'Quieren reducir abandono' },
    desired_outcome: { value: 'Menos abandono', provenance: { origin: 'EXTRACTED_FROM_USER_TEXT' } },
    decision_to_enable: { value: 'Qué iniciativas financiar' },
    alternative_approaches: [],
    known_context: [{ key: 'clientes', value: 'pymes' }],
    unresolved_context: [],
    gap_resolution_map: [],
    evidence_or_clarity_needed: [],
    starteria_path: [{ action: 'structure', description: 'Estructurar' }],
    recommended_cta: 'Continuar',
    provenance_summary: [],
    handoff_status: 'ready',
    ...overrides,
  };
}

describe('deriveSuggestedRoute (E2E Job-Driven §5)', () => {
  it('sin decisión ni contexto: todavía no activar trabajo', () => {
    expect(deriveSuggestedRoute(handoff({ handoff_status: 'insufficient_input' })).destination).toBe('not_now');
    expect(
      deriveSuggestedRoute(handoff({
        decision_to_enable: 'unresolved',
        desired_outcome: { value: 'ganar claridad', provenance: { origin: 'AI_INFERRED' as any } },
        unresolved_context: [{ gap_id: 'g', description: 'objetivo' }],
      })).title,
    ).toBe('Todavía no activar trabajo');
  });

  it('con dirección pero puntos abiertos: explorar', () => {
    expect(deriveSuggestedRoute(handoff({ handoff_status: 'ready_with_uncertainty' })).destination).toBe('explore');
    // La persona dijo qué quiere conseguir, aunque la decisión siga abierta.
    expect(deriveSuggestedRoute(handoff({ decision_to_enable: 'unresolved', unresolved_context: [{ gap_id: 'g', description: 'x' }] })).destination).toBe('explore');
  });

  it('cuando pide ver y comparar lo existente: análisis de portfolio', () => {
    expect(deriveSuggestedRoute(handoff({ starteria_path: [{ action: 'make_visible', description: 'Ver' }, { action: 'compare_or_follow', description: 'Comparar' }] })).destination).toBe('portfolio_analysis');
  });

  it('con decisión clara: ordenar el portafolio', () => {
    expect(deriveSuggestedRoute(handoff()).destination).toBe('portfolio_setup');
  });
});
