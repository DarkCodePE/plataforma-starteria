/**
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §13.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChallengeCoverageReadingPanel } from '../ChallengeCoverageReadingPanel';

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
});
