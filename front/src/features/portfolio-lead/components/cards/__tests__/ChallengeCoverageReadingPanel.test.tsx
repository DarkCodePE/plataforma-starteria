/**
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §13.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChallengeCoverageReadingPanel, uncoveredAnswer } from '../ChallengeCoverageReadingPanel';

const getChallengeCoverageReading = vi.fn();
vi.mock('../../../../../app/services/portfolioService', () => ({
  getChallengeCoverageReading: (id: string) => getChallengeCoverageReading(id),
}));

describe('ChallengeCoverageReadingPanel', () => {
  it('responde las preguntas de §13 sobre el reto', async () => {
    getChallengeCoverageReading.mockResolvedValue({
      challengeId: 'c1',
      coverageStatus: 'sin_cobertura',
      hasWork: false,
      initiatives: [],
      overlaps: [],
      aggregateEvidence: { contributionByLevel: { bajo: 0, medio: 0, alto: 0 }, partialSignals: 0, withRecommendation: 0 },
      commonDependencies: ['Integración CRM'],
      needsMoreCapacity: { value: true, reasons: ['Ninguna iniciativa está abordando este reto.'] },
      readyToDecide: { value: false, reasons: ['Todavía no hay trabajo que evaluar.'] },
      uncovered: 'Bajar el abandono',
    });
    render(<ChallengeCoverageReadingPanel challengeId="c1" />);
    expect(await screen.findByText('No, ninguna iniciativa todavía.')).toBeInTheDocument();
    expect(screen.getByText('Bajar el abandono')).toBeInTheDocument();
    expect(screen.getByText('Integración CRM')).toBeInTheDocument();
    expect(screen.getByText('Ninguna iniciativa está abordando este reto.')).toBeInTheDocument();
    expect(screen.getByText(/Todavía no\. Todavía no hay trabajo que evaluar\./)).toBeInTheDocument();
    expect(getChallengeCoverageReading).toHaveBeenCalledWith('c1');
  });

  it('con iniciativas y cobertura parcial no afirma que el reto está todo cubierto', async () => {
    getChallengeCoverageReading.mockResolvedValue({
      challengeId: 'c1',
      coverageStatus: 'cobertura_parcial',
      hasWork: true,
      initiatives: [{ projectId: 'p1', name: 'Iniciativa 1', status: 'en_step_0', currentStep: 'Step 0', readyForDecision: false, estimatedContribution: 'bajo', blocker: null }],
      overlaps: [],
      aggregateEvidence: { contributionByLevel: { bajo: 1, medio: 0, alto: 0 }, partialSignals: 0, withRecommendation: 0 },
      commonDependencies: [],
      needsMoreCapacity: { value: false, reasons: [] },
      readyToDecide: { value: false, reasons: ['Ninguna iniciativa llegó a decisión todavía.'] },
      uncovered: null,
    });
    render(<ChallengeCoverageReadingPanel challengeId="c1" />);
    expect(await screen.findByText('Cobertura parcial')).toBeInTheDocument();
    expect(screen.getByText('El reto ya tiene iniciativas, pero ninguna resolvió todavía su parte central.')).toBeInTheDocument();
    expect(screen.queryByText(/Todo el reto tiene al menos una iniciativa/)).not.toBeInTheDocument();
    expect(screen.queryByText('Sin cobertura')).not.toBeInTheDocument();
  });
});

describe('uncoveredAnswer', () => {
  it('sólo dice "nada visible" cuando la cobertura es suficiente', () => {
    expect(uncoveredAnswer({ uncovered: null, coverageStatus: 'cobertura_suficiente' })).toBe('Nada visible: la cobertura del reto es suficiente.');
    expect(uncoveredAnswer({ uncovered: 'Bajar el abandono', coverageStatus: 'sin_cobertura' })).toBe('Bajar el abandono');
  });
});
