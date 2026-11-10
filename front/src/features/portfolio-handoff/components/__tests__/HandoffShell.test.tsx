import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HandoffShell } from '../HandoffShell';
import type { HandoffInvitationPreview } from '../../services/handoffInvitationService';

function preview(overrides: Partial<HandoffInvitationPreview> = {}): HandoffInvitationPreview {
  return {
    assignmentId: 'assignment-1', targetKind: 'CHALLENGE', challengeId: 'challenge-1', initiativeId: null,
    briefVersion: null,
    state: 'SENT', version: 2, rejectionReason: null, portfolioResponse: null, acceptedAt: null, rejectedAt: null,
    authenticationRequired: true, identityClaimStatus: 'MATCHED', ...overrides,
  };
}

describe('HandoffShell', () => {
  it('uses the same shell for invitation and keeps Start hidden', () => {
    render(<HandoffShell preview={preview({
      briefVersion: {
        id: 'brief-version-7', versionNumber: 7, status: 'CONFIRMED',
        intent: 'Reducir el tiempo de activación', scope: 'Piloto sintético autorizado',
      },
    })} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByTestId('handoff-shell')).toBeInTheDocument();
    expect(screen.getByText('Brief confirmado · versión 7')).toBeInTheDocument();
    expect(screen.getByText(/Reducir el tiempo de activación/)).toBeInTheDocument();
    expect(screen.getByText(/Piloto sintético autorizado/)).toBeInTheDocument();
    expect(screen.getByText(/brief-version-7/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar asignación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Empezar/ })).not.toBeInTheDocument();
  });

  it('renders accepted overview with one non-executing Start CTA and no Accept', () => {
    const onAccept = vi.fn();
    render(<HandoffShell preview={preview({ state: 'ACCEPTED', version: 3 })} onAccept={onAccept} onReject={vi.fn()} />);
    expect(screen.getByTestId('handoff-shell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Aceptar asignación' })).not.toBeInTheDocument();
    expect(screen.getByText(/Al empezar, Starteria registrará el inicio/)).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('invokes Start once and exposes an accessible busy state while processing', async () => {
    const user = userEvent.setup();
    let resolveStart!: () => void;
    const onStart = vi.fn(() => new Promise<void>((resolve) => { resolveStart = resolve; }));
    const view = render(<HandoffShell preview={preview({ state: 'ACCEPTED', version: 3 })} onAccept={vi.fn()} onReject={vi.fn()} onStart={onStart} />);
    await user.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    view.rerender(<HandoffShell preview={preview({ state: 'ACCEPTED', version: 3 })} onAccept={vi.fn()} onReject={vi.fn()} onStart={onStart} startBusy />);
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveAttribute('aria-busy', 'true');
    resolveStart();
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
    expect(screen.getAllByText('Encargo sobre reto')).toHaveLength(2);
    expect(screen.getByText('El encargo está vinculado a un reto y no crea una iniciativa.')).toBeInTheDocument();
    expect(screen.queryByText(/Step 0|Step 1|progreso|Initiative existente/)).not.toBeInTheDocument();
  });

  it('renders canonical Owner context and never substitutes generic assignment copy', () => {
    render(<HandoffShell preview={preview({
      canonicalContext: {
        strategicFront: { id: 'front-1', name: 'Retención', strategicObjective: 'Reducir churn', horizon: 'Q2', constraints: 'Sin datos sensibles' },
        challenge: { id: 'challenge-1', title: 'Activación temprana', objective: 'Mejorar activación', description: 'Acompañar el primer uso', expectedDecision: 'Priorizar un piloto' },
        initiative: null,
        sender: { id: 'lead-1', name: 'Lucía Lead', email: 'lead@example.com' },
        members: [{ identityKey: 'owner@example.com', userId: 'owner-1', emailNormalized: 'owner@example.com', label: 'Owner principal', role: 'OWNER', displayName: 'Olga Owner' }],
        assignmentContextNote: 'Revisar el Brief antes de responder.',
      },
      briefVersion: {
        id: 'brief-v3', versionNumber: 3, status: 'CONFIRMED', intent: 'Validar la activación', scope: 'Piloto de 30 días',
        strategicContextRefs: { objective: 'Reducir churn' },
        inheritedContext: { challengeProblem: 'Las cuentas abandonan pronto', expectedDeliverable: 'Decisión documentada' },
        constraintsSnapshot: ['Sin PII'], knownGaps: ['Baseline pendiente'], sourceRefs: ['front-1'],
        provenance: { source: 'PL05_COPILOT' }, confirmedAt: '2026-11-10T08:00:00.000Z',
      },
    } as any)} onAccept={vi.fn()} onReject={vi.fn()} />);

    for (const value of ['Retención', 'Reducir churn', 'Activación temprana', 'Mejorar activación', 'Las cuentas abandonan pronto', 'Decisión documentada', 'Sin PII', 'Lucía Lead', 'Revisar el Brief antes de responder.']) {
      expect(screen.getAllByText(new RegExp(value)).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText('Reto vinculado a tu asignación')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tu participación ayuda a convertir este contexto/)).not.toBeInTheDocument();
  });

  it('offers an explicit account recovery action on identity mismatch', async () => {
    const user = userEvent.setup();
    const onChangeAccount = vi.fn();
    render(<HandoffShell preview={preview({ identityClaimStatus: 'MISMATCH' })} onAccept={vi.fn()} onReject={vi.fn()} onChangeAccount={onChangeAccount} />);
    await user.click(screen.getByRole('button', { name: 'Cambiar de cuenta' }));
    expect(onChangeAccount).toHaveBeenCalledTimes(1);
  });

  it('renders a bounded terminal state after Start with no downstream navigation', () => {
    render(<HandoffShell preview={preview({ state: 'STARTED', version: 4 })} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByTestId('handoff-status')).toHaveTextContent('Trabajo iniciado');
    expect(screen.queryByRole('button', { name: 'Aceptar asignación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empezar' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Step|Workspace|Iniciativa iniciada/)).not.toBeInTheDocument();
  });
});
