import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HandoffShell } from '../HandoffShell';
import type { HandoffInvitationPreview } from '../../services/handoffInvitationService';

function preview(overrides: Partial<HandoffInvitationPreview> = {}): HandoffInvitationPreview {
  return {
    assignmentId: 'assignment-1', targetKind: 'CHALLENGE', challengeId: 'challenge-1', initiativeId: null,
    state: 'SENT', version: 2, rejectionReason: null, portfolioResponse: null, acceptedAt: null, rejectedAt: null,
    authenticationRequired: true, identityClaimStatus: 'MATCHED', ...overrides,
  };
}

describe('HandoffShell', () => {
  it('uses the same shell for invitation and keeps Start hidden', () => {
    render(<HandoffShell preview={preview()} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByTestId('handoff-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar asignación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Empezar/ })).not.toBeInTheDocument();
  });

  it('renders accepted overview with one non-executing Start CTA and no Accept', () => {
    const onAccept = vi.fn();
    render(<HandoffShell preview={preview({ state: 'ACCEPTED', version: 3 })} onAccept={onAccept} onReject={vi.fn()} />);
    expect(screen.getByTestId('handoff-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar (disponible en el siguiente paso)' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Aceptar asignación' })).not.toBeInTheDocument();
    expect(screen.getByText(/Al empezar, Starteria registrará el inicio/)).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('requires a material rejection reason and submits a trimmed reason', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn().mockResolvedValue(undefined);
    render(<HandoffShell preview={preview()} onAccept={vi.fn()} onReject={onReject} />);
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Indica por qué');
    await user.type(screen.getByLabelText('Motivo del rechazo'), '  No puedo asumirlo ahora  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar rechazo' }));
    expect(onReject).toHaveBeenCalledWith('No puedo asumirlo ahora');
  });

  it('keeps rejected state in the shell without response actions', () => {
    render(<HandoffShell preview={preview({ state: 'REJECTED', rejectionReason: 'No tengo disponibilidad', portfolioResponse: 'Lo revisaremos más adelante' })} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByTestId('handoff-shell')).toBeInTheDocument();
    expect(screen.getByText('Has rechazado esta asignación')).toBeInTheDocument();
    expect(screen.getByText('No tengo disponibilidad')).toBeInTheDocument();
    expect(screen.getByText('Lo revisaremos más adelante')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar asignación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Empezar/ })).not.toBeInTheDocument();
  });

  it('does not invent an Initiative for a Challenge assignment', () => {
    render(<HandoffShell preview={preview()} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getAllByText('Challenge Assignment')).toHaveLength(2);
    expect(screen.getByText('El encargo está vinculado a un reto. Todavía no existe una Initiative asociada.')).toBeInTheDocument();
    expect(screen.queryByText(/Step 0|Step 1|progreso|Initiative existente/)).not.toBeInTheDocument();
  });
});
