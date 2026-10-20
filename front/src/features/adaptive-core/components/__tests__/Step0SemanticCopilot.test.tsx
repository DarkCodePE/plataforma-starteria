import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Step0SemanticCopilot } from '../Step0SemanticCopilot';
import { getStep0SemanticState, processStep0SemanticInput } from '../../services/adaptiveCoreService';

vi.mock('../../services/adaptiveCoreService', () => ({
  getStep0SemanticState: vi.fn(),
  processStep0SemanticInput: vi.fn(),
}));

const state = {
  card: {
    cardVersion: 2,
    inheritedContext: { routeType: 'reconstruct_existing' },
    fields: { objective: { value: 'Reducir retrabajo', kind: 'declared_fact', origin: 'inherited', sourceRefIds: [], version: 0 } },
    claims: [], unknowns: [{ field: 'scope', reason: 'Pendiente' }], contradictions: [], sources: [], hardGaps: ['missing:scope'], softGaps: [],
    sufficiency: { sufficient: false, criticalRequirements: ['objective'], hardGaps: ['missing:scope'], softGaps: [], reason: 'Falta alcance.' },
    requiresReview: false,
    checkpoint: { state: 'not_ready', humanConfirmationRequired: true, openItems: ['missing:scope'] },
    handoff: null,
    lastIntervention: 'ask' as const,
    lastDelta: { operation: 'mark_unknown', field: 'scope' as const, reason: 'Pendiente.' },
  },
  outputVersion: 2,
  inheritedContext: { routeType: 'reconstruct_existing' },
  sourceRefs: [],
};

describe('Step0SemanticCopilot', () => {
  it('renders recovered Card state and sends a proposed semantic input, not a checkpoint approval', async () => {
    vi.mocked(getStep0SemanticState).mockResolvedValue(state as any);
    vi.mocked(processStep0SemanticInput).mockResolvedValue(state as any);
    render(<Step0SemanticCopilot projectId="p1" />);
    expect(await screen.findByText('Reducir retrabajo')).toBeInTheDocument();
    expect(screen.getByText('Desconocido')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Aporte al Copilot de Step 0'), { target: { value: 'Equipo comercial.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Proponer actualización de Card' }));
    await waitFor(() => expect(processStep0SemanticInput).toHaveBeenCalledWith('p1', expect.objectContaining({ content: 'Equipo comercial.', fieldHint: 'objective' })));
    expect(screen.queryByText(/confirmar el checkpoint/i)).not.toBeInTheDocument();
  });

  it('keeps the interaction read-only for a viewer', async () => {
    vi.mocked(getStep0SemanticState).mockResolvedValue(state as any);
    render(<Step0SemanticCopilot projectId="p1" readOnly />);
    const input = await screen.findByLabelText('Aporte al Copilot de Step 0');
    expect(input).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Proponer actualización de Card' })).not.toBeInTheDocument();
  });
});
