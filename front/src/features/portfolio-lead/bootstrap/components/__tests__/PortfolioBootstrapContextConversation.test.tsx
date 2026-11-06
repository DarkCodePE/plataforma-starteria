import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyPortfolioBootstrapContext,
  type PortfolioBootstrapContextPayload,
  type PortfolioBootstrapContextReview,
} from '../../services/portfolioBootstrapContextClient';
import {
  guidedContextQuestion,
  PortfolioBootstrapContextConversation,
} from '../PortfolioBootstrapContextConversation';

const declared = (value: string) => ({ value, provenance: 'user_declared' as const, sourceRef: { kind: 'user_input' as const } });

function payload(overrides: Partial<PortfolioBootstrapContextPayload> = {}): PortfolioBootstrapContextPayload {
  return { ...createEmptyPortfolioBootstrapContext(), ...overrides };
}

function review(overrides: Partial<PortfolioBootstrapContextReview> = {}): PortfolioBootstrapContextReview {
  const confirmed = payload({ situation: declared('Contexto confirmado original') });
  return {
    id: 'review-1', sessionId: 'session-1', status: 'confirmed', version: 2,
    draft: confirmed, confirmedSnapshot: confirmed, effectiveContext: confirmed,
    hasPendingCorrection: false,
    sourceCompanyContext: null, draftSourceCompanyContext: null,
    confirmedSourceCompanyContext: null, effectiveSourceCompanyContext: null,
    draftProvenance: [], confirmedProvenance: [], effectiveProvenance: [], sourceOutdated: false,
    confirmedBy: 'user-1', confirmedAt: '2026-11-07T00:00:00.000Z',
    createdAt: '2026-11-07T00:00:00.000Z', updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  };
}

function props(overrides: Partial<React.ComponentProps<typeof PortfolioBootstrapContextConversation>> = {}) {
  return {
    review: null,
    status: 'ready' as const,
    error: null,
    onSaveDraft: vi.fn().mockResolvedValue(undefined),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onRetry: vi.fn().mockResolvedValue(undefined),
    onContinue: vi.fn(),
    ...overrides,
  };
}

describe('PortfolioBootstrapContextConversation', () => {
  it('CA01 chooses honest deterministic questions for clear, ambiguous, unknown and correction scenarios', () => {
    expect(guidedContextQuestion(payload()).title).toMatch(/cuéntame qué está ocurriendo/i);
    expect(guidedContextQuestion(payload({ situation: declared('Mejorar todo') })).title).toMatch(/resultado concreto/i);
    expect(guidedContextQuestion(payload({
      situation: declared('El abandono aumentó durante la activación y necesitamos entender dónde intervenir.'),
    })).title).toMatch(/área o proceso/i);
    expect(guidedContextQuestion(payload({ situation: declared('Borrador corregido') }), { hasPendingCorrection: true }).title)
      .toMatch(/qué quieres corregir/i);
  });

  it('CA01/CA02 captures a narrative, exposes unknowns and saves structured editable provenance', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapContextConversation {...props({ onSaveDraft })} />);

    expect(screen.getAllByText('Desconocido').length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText('Tu respuesta'), 'El abandono subió durante la activación de clientes nuevos.');
    await user.click(screen.getByRole('button', { name: 'Incorporar respuesta' }));
    expect(screen.getByLabelText('Situación actual')).toHaveValue('El abandono subió durante la activación de clientes nuevos.');
    expect(screen.getByText('Declarado por ti')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Área o proceso'), 'Operaciones');
    await user.type(screen.getByLabelText('Vacíos por resolver'), 'Falta confirmar la señal');
    await user.type(screen.getByLabelText('Restricciones conocidas'), 'Capacidad limitada');
    await user.type(screen.getByLabelText('Supuestos por validar'), 'El problema ocurre en móvil');
    await user.click(screen.getByRole('button', { name: 'Guardar síntesis' }));

    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      situation: declared('El abandono subió durante la activación de clientes nuevos.'),
      area: declared('Operaciones'),
      stakeholder: { value: null, provenance: 'unknown' },
      gaps: ['Falta confirmar la señal'],
      constraints: [declared('Capacidad limitada')],
      assumptions: [declared('El problema ocurre en móvil')],
    }), null);
  });

  it('CA04 shows corrected draft and frozen confirmed context simultaneously until reconfirmation', () => {
    const corrected = payload({ situation: declared('Borrador corregido pendiente') });
    render(<PortfolioBootstrapContextConversation {...props({ review: review({
      status: 'draft', version: 3, draft: corrected, hasPendingCorrection: true,
    }) })} />);

    expect(screen.getByText('Corrección pendiente de reconfirmación')).toBeInTheDocument();
    expect(screen.getByText('Contexto confirmado original')).toBeInTheDocument();
    expect(screen.getByLabelText('Situación actual')).toHaveValue('Borrador corregido pendiente');
  });

  it('CA04 requires explicit confirm and a separate continue action without auto-advancing E2', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onContinue = vi.fn();
    render(<PortfolioBootstrapContextConversation {...props({ review: review(), onConfirm, onContinue })} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar contexto' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continuar al objetivo' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('CA05 presents optional Company provenance and sourceOutdated without replacing the snapshot', () => {
    render(<PortfolioBootstrapContextConversation {...props({ review: review({
      sourceOutdated: true,
      effectiveSourceCompanyContext: { companyId: 'company-1', versionId: 'version-1', versionNumber: 1 },
    }) })} />);

    expect(screen.getByText(/versión 1 de Company Context/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/existe una versión Company más reciente/i);
    expect(screen.queryByLabelText(/company id/i)).not.toBeInTheDocument();
  });

  it('CA06 preserves local edits and exposes an accessible retry after a save error', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockRejectedValue(new Error('Conflicto de versión'));
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapContextConversation {...props({ onSaveDraft, onRetry })} />);

    await user.type(screen.getByLabelText('Situación actual'), 'Edición que no debe perderse');
    await user.click(screen.getByRole('button', { name: 'Guardar síntesis' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conflicto de versión');
    expect(screen.getByLabelText('Situación actual')).toHaveValue('Edición que no debe perderse');
    await user.click(screen.getByRole('button', { name: 'Reintentar operación' }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledOnce());
  });
});
