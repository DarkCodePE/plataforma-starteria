import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversionSubmissionForm } from '../ConversionSubmissionForm';
import type { StarteriaPathSupportedDto } from '../starteriaPath.types';

const service = vi.hoisted(() => ({
  submit: vi.fn(),
  normalize: vi.fn((error: { kind: string }) => error),
}));
vi.mock('../portfolioEntryPublicService', async (importOriginal) => ({
  ...await importOriginal<object>(),
  submitPortfolioEntryConversion: service.submit,
  normalizePortfolioEntryApiError: service.normalize,
}));

function renderForm(type: 'DEMO' | 'EARLY_ACCESS' = 'DEMO', decisionInView: string | null = 'Decidir el próximo punto de revisión.') {
  const destination = type === 'DEMO'
    ? { type, status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY', contextSharingSupported: true,
      label: 'Solicitar una demo', availabilityDisclosure: 'Envía una solicitud de contacto para una posible demostración. No reserva una cita.' }
    : { type, status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY', contextSharingSupported: true,
      label: 'Solicitar acceso anticipado', availabilityDisclosure: 'Envía una solicitud de interés en acceso anticipado. No garantiza acceso.' };
  const path = {
    conversionPresentation: { availability: type === 'DEMO' ? 'DEMO_ONLY' : 'EARLY_ACCESS_ONLY',
      conversionConfigVersion: 2, destinations: [destination] },
    sourceBinding: { criticalHandoffId: 'critical-1', criticalHandoffVersion: 1, sourceContextRevision: 3,
      current: true, confirmed: true, projectionVersion: 'starteria-path-projection-v0.1',
      businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1', pathSchemaVersion: 'starteria-path-dto-v0.2' },
  } as StarteriaPathSupportedDto;
  const onPathRefresh = vi.fn();
  render(<ConversionSubmissionForm sessionId="session-1" path={path} destination={destination as never}
    decisionInView={decisionInView} onPathRefresh={onPathRefresh} />);
  return { onPathRefresh };
}

describe('125E bounded submission form', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('records bounded click, consent choice and accepted receipt without contact data', async () => {
    const events: Array<Record<string, unknown>> = [];
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer = events;
    service.submit.mockResolvedValue({ submissionId: 'private-receipt', receiptStatus: 'RECEIVED',
      destinationType: 'DEMO', contextShared: false, idempotentReplay: false });
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Solicitar una demo' }));
    await user.type(screen.getByLabelText(/Correo electr/i), 'person@example.org');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await screen.findByTestId('conversion-submission-success');
    expect(events.map((item) => item.event)).toEqual([
      'demo_clicked', 'context_share_opt_in', 'context_share_declined', 'conversion_submitted',
    ]);
    expect(events.find((item) => item.event === 'conversion_submitted')).toEqual({
      event: 'conversion_submitted', destinationType: 'DEMO', contextShared: false,
      idempotentReplay: false, resultCategory: 'RECEIVED',
    });
    expect(JSON.stringify(events)).not.toMatch(/person@example.org|private-receipt|Decidir el pr/i);
  });

  it('moves keyboard focus into the inline form and restores it after cancel', async () => {
    const user = userEvent.setup();
    renderForm();
    const action = screen.getByRole('button', { name: 'Solicitar una demo' });
    action.focus();
    await user.click(action);
    expect(screen.getByRole('textbox', { name: /Correo electr/i })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Solicitar una demo' })).toHaveFocus();
  });

  it.each(['DEMO', 'EARLY_ACCESS'] as const)('requires email and keeps context sharing off for %s', async (type) => {
    const user = userEvent.setup();
    service.submit.mockResolvedValue({ submissionId: 'receipt-1', receiptStatus: 'RECEIVED' });
    renderForm(type);
    await user.click(screen.getByRole('button', { name: type === 'DEMO' ? 'Solicitar una demo' : 'Solicitar acceso anticipado' }));
    expect(screen.getByLabelText(/Correo electrónico/)).toBeRequired();
    expect(screen.getByLabelText(/Nombre/)).not.toBeRequired();
    expect(screen.getByLabelText(/Organización/)).not.toBeRequired();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByText(/Compartir también el contexto actual/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(service.submit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Correo electrónico/), 'person@example.org');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(service.submit).toHaveBeenCalledWith('session-1', expect.objectContaining({
      destinationType: type, purpose: type === 'DEMO' ? 'DEMO_REQUEST' : 'EARLY_ACCESS_REQUEST',
      email: 'person@example.org', contextSharingMode: 'NO_ENTRY_CONTEXT_SHARED',
    }));
    expect(service.submit.mock.calls[0][1]).not.toHaveProperty('decisionInViewPreview');
    expect(await screen.findByTestId('conversion-submission-success')).toHaveTextContent('Recibimos tu solicitud');
    expect(document.body.innerHTML).not.toMatch(/\/portfolio\/setup|continue-portfolio|acceso aprobado|demo reservada/i);
  });

  it('shares only the previewed decision after explicit opt-in', async () => {
    const user = userEvent.setup();
    service.submit.mockResolvedValue({ submissionId: 'receipt-2', receiptStatus: 'RECEIVED' });
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Solicitar una demo' }));
    expect(screen.getByText('Decidir el próximo punto de revisión.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Correo electrónico/), 'person@example.org');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(service.submit.mock.calls[0][1]).toMatchObject({
      contextSharingMode: 'SHARE_CONTEXT_WITH_CONVERSION', explicitContextConsent: true,
      decisionInViewPreview: 'Decidir el próximo punto de revisión.',
    });
  });

  it('shows bounded recovery for stale and unavailable results', async () => {
    const user = userEvent.setup();
    const { onPathRefresh } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Solicitar una demo' }));
    await user.type(screen.getByLabelText(/Correo electrónico/), 'person@example.org');
    service.submit.mockRejectedValueOnce({ kind: 'conflict' });
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(await screen.findByTestId('conversion-submission-stale')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar lectura' }));
    expect(onPathRefresh).toHaveBeenCalledOnce();
  });

  it('hides the form when a destination becomes unavailable', async () => {
    const user = userEvent.setup();
    renderForm('EARLY_ACCESS');
    await user.click(screen.getByRole('button', { name: 'Solicitar acceso anticipado' }));
    await user.type(screen.getByLabelText(/Correo electrónico/), 'person@example.org');
    service.submit.mockRejectedValueOnce({ kind: 'unavailable', code: 'CONVERSION_DESTINATION_UNAVAILABLE' });
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(await screen.findByTestId('conversion-destination-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('conversion-submission-success')).not.toBeInTheDocument();
  });
});
