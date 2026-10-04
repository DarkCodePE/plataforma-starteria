import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReconstructionPanel } from '../ReconstructionPanel';

const reconstructExistingWork = vi.fn();
vi.mock('../../../../../app/services/portfolioService', () => ({ reconstructExistingWork: (input: unknown) => reconstructExistingWork(input) }));

describe('ReconstructionPanel (§14)', () => {
  it('envía lo declarado y muestra qué se sostiene, contradicciones y dónde retomar', async () => {
    reconstructExistingWork.mockResolvedValue({
      provenance: 'USER_DECLARED',
      restartFromStep0: false,
      sustainableClaims: [{ claim: 'Bajó 18% en A', evidence: [] }],
      availableEvidence: { supports: 1, contradicts: 1, insufficient: 0 },
      contradictions: [{ supports: 'Bajó 18% en A', contradicts: 'B sin cambios' }],
      gaps: [],
      gates: [{ step: 0, question: '¿Qué se buscaba mover?', status: 'partial' }],
      nextMaterialUncertainty: 'Explicar la diferencia entre A y B.',
      suggestedReentryStep: 0,
    });
    render(<ReconstructionPanel />);
    fireEvent.change(screen.getByLabelText('Nombre del trabajo'), { target: { value: 'Piloto' } });
    fireEvent.change(screen.getByLabelText(/Qué se hizo/), { target: { value: '4 meses en 2 sucursales' } });
    fireEvent.change(screen.getByLabelText('Evidencia 1'), { target: { value: 'Bajó 18% en A' } });
    fireEvent.click(screen.getByRole('button', { name: /Leer qué podemos sostener/ }));

    expect(await screen.findByTestId('reconstruction-reading')).toHaveTextContent('Bajó 18% en A ↔ B sin cambios');
    expect(screen.getByText(/se retoma desde Step 0/)).toBeInTheDocument();
    expect(reconstructExistingWork).toHaveBeenCalledWith({ name: 'Piloto', summary: '4 meses en 2 sucursales', evidence: [{ summary: 'Bajó 18% en A', classification: 'supports' }] });
  });
});
