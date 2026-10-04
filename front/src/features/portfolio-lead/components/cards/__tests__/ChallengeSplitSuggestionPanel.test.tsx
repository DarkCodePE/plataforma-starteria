/**
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §8–§11, §26.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChallengeSplitSuggestionPanel } from '../ChallengeSplitSuggestionPanel';

const suggestChallengeSplit = vi.fn();
const confirmChallengeSplit = vi.fn();
vi.mock('../../../../../app/services/portfolioService', () => ({
  suggestChallengeSplit: (id: string) => suggestChallengeSplit(id),
  confirmChallengeSplit: (id: string, challenges: unknown) => confirmChallengeSplit(id, challenges),
}));

const SPLIT = {
  frontId: 'f1',
  recommendation: 'split',
  provenance: 'AI_SUGGESTED',
  reviewStatus: 'UNREVIEWED',
  observed: 'Tu frente atiende 2 partes distintas: onboarding, uso recurrente.',
  signals: [],
  whySplit: 'Separarlas permite evaluar cobertura y evidencia de forma distinta.',
  benefits: ['Claridad de ownership'],
  proposedChallenges: [
    { title: 'Onboarding', whatWeWantToMove: 'Adopción — en onboarding', rationale: 'r1' },
    { title: 'Uso recurrente', whatWeWantToMove: 'Adopción — en uso recurrente', rationale: 'r2' },
  ],
  impact: { challengesToCreate: 2, existingChallenges: 0, initiativesMoved: 0, note: 'Se crearían como borrador.' },
  stillInference: 'Es una inferencia.',
};

describe('ChallengeSplitSuggestionPanel', () => {
  beforeEach(() => {
    suggestChallengeSplit.mockReset();
    confirmChallengeSplit.mockReset();
  });

  it('explica qué observó, por qué, beneficio, estructura e impacto, sin crear nada', async () => {
    suggestChallengeSplit.mockResolvedValue(SPLIT);
    render(<ChallengeSplitSuggestionPanel frontId="f1" />);
    fireEvent.click(screen.getByRole('button', { name: /Analizar si conviene separar/ }));

    expect(await screen.findByText(/Sugerencia de IA · sin revisar/)).toBeInTheDocument();
    for (const label of ['Qué observó', 'Por qué separar', 'Qué beneficio produce', 'Qué estructura propone', 'Impacto']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Reto sugerido: Onboarding')).toBeInTheDocument();
    expect(confirmChallengeSplit).not.toHaveBeenCalled();
  });

  it('crea sólo los retos que la persona deja marcados', async () => {
    suggestChallengeSplit.mockResolvedValue(SPLIT);
    confirmChallengeSplit.mockResolvedValue([{ id: 'c1', title: 'Onboarding' }]);
    const onConfirmed = vi.fn();
    render(<ChallengeSplitSuggestionPanel frontId="f1" onConfirmed={onConfirmed} />);
    fireEvent.click(screen.getByRole('button', { name: /Analizar si conviene separar/ }));
    fireEvent.click(await screen.findByLabelText(/Reto sugerido: Uso recurrente/));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar y crear 1 reto/ }));

    expect(await screen.findByText(/Creaste 1 reto\(s\) en borrador: Onboarding/)).toBeInTheDocument();
    expect(confirmChallengeSplit).toHaveBeenCalledWith('f1', [{ title: 'Onboarding', whatWeWantToMove: 'Adopción — en onboarding' }]);
    expect(onConfirmed).toHaveBeenCalled();
  });

  it('puede decir que no hace falta otro reto (§10)', async () => {
    suggestChallengeSplit.mockResolvedValue({ ...SPLIT, recommendation: 'no_split', proposedChallenges: [], whySplit: null, benefits: [], impact: null, observed: 'El frente ya tiene 1 reto(s).' });
    render(<ChallengeSplitSuggestionPanel frontId="f1" />);
    fireEvent.click(screen.getByRole('button', { name: /Analizar si conviene separar/ }));
    expect(await screen.findByText('No parece necesario crear otro reto.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
  });
});
