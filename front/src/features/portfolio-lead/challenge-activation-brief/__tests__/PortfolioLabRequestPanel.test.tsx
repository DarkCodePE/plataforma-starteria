import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const briefApi = vi.hoisted(() => ({
  getActivationBrief: vi.fn(),
  listChallengeHandoffAssignments: vi.fn(),
  listAssignableInitiatives: vi.fn(),
  registerImportedInitiative: vi.fn(),
  linkImportedInitiative: vi.fn(),
  createChallengeHandoffAssignment: vi.fn(),
  updateChallengeHandoffAssignment: vi.fn(),
  sendHandoffInvitationBatch: vi.fn(),
}));
const labApi = vi.hoisted(() => ({
  listPortfolioLabRequests: vi.fn(),
  createPortfolioLabRequest: vi.fn(),
  retryPortfolioLabNotification: vi.fn(),
}));

vi.mock('../challengeActivationBriefClient', () => briefApi);
vi.mock('../portfolioLabRequestClient', () => labApi);

import { ChallengeAssignmentPreparationPanel } from '../ChallengeAssignmentPreparationPanel';

const target = { challengeId: 'challenge-1', briefId: 'brief-a', briefVersionId: 'version-5', challengeName: 'Reducir fricción' };
const version = {
  id: 'version-5', versionNumber: 5, status: 'CONFIRMED' as const,
  intent: 'Reducir la principal barrera de activación.', scope: 'Contrastar onboarding y diagnóstico.',
  strategicContextRefs: { objective: 'Mejorar activación' },
  inheritedContext: { expectedDeliverable: 'Recomendación priorizada con evidencia.', decisionToEnable: 'Elegir la primera barrera.' },
  constraintsSnapshot: ['Revisión legal'], knownGaps: ['Falta línea base'], sourceRefs: ['Importación Q3'], provenance: { source: 'PL05_COPILOT' },
  createdAt: '2026-11-07T00:00:00.000Z', confirmedAt: '2026-11-07T01:00:00.000Z',
};
const request = (overrides: Record<string, unknown> = {}) => ({
  id: 'lab-request-1', organizationId: 'org-1', challengeId: target.challengeId, briefId: target.briefId,
  briefVersionId: target.briefVersionId, requesterId: 'user-1', consentAt: '2026-11-07T02:00:00.000Z',
  consentPurpose: 'Solicito apoyo para convertir este Brief en una activación viable.', status: 'REQUESTED',
  notificationStatus: 'NOTIFIED', providerMessageRef: 'smtp-accepted', lastNotificationError: null,
  terminalAt: null, version: 1, createdAt: '2026-11-07T02:00:00.000Z', updatedAt: '2026-11-07T02:00:00.000Z',
  ...overrides,
});

function renderPanel(onCompleteSetup?: () => Promise<void>) {
  return render(<ChallengeAssignmentPreparationPanel target={target} onCompleteSetup={onCompleteSetup} />);
}

describe('KAN-227 Portfolio Lab UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    briefApi.getActivationBrief.mockResolvedValue({ id: target.briefId, challengeId: target.challengeId, organizationId: 'org-1', versions: [version] });
    briefApi.listChallengeHandoffAssignments.mockResolvedValue([]);
    briefApi.listAssignableInitiatives.mockResolvedValue({ canonicalInitiatives: [], importedRecords: [], otherImportedRecords: [] });
    labApi.listPortfolioLabRequests.mockResolvedValue([]);
  });

  it('LAB-UX01 mantiene Equipo y Startería Lab como vías coexistentes, no exclusivas', async () => {
    renderPanel();
    expect(await screen.findByRole('heading', { name: 'Asigna responsables para abordar este reto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activa este reto con tu equipo, Startería Lab o ambos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Asignar responsable' })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Solicitar acompañamiento de Startería Lab' })).toBeEnabled());
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('LAB-UX02 muestra la versión confirmada exacta y exige consentimiento antes del POST', async () => {
    const user = userEvent.setup();
    renderPanel();
    const trigger = await screen.findByRole('button', { name: 'Solicitar acompañamiento de Startería Lab' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'portfolio-lab-request-preview');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Vista previa de la solicitud a Startería Lab' })).toHaveFocus();
    expect(screen.getAllByText('Versión 5 · Confirmada e inmutable')).toHaveLength(2);
    expect(screen.getByText(version.intent)).toBeInTheDocument();
    expect(screen.getByText(version.scope)).toBeInTheDocument();
    expect(screen.getByText('Falta línea base')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar solicitud a Startería Lab' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /consiento compartir este Brief confirmado/i }));
    expect(screen.getByRole('button', { name: 'Enviar solicitud a Startería Lab' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('LAB-UX03 conserva una Idempotency-Key estable ante fallo y distingue creación de deduplicación', async () => {
    const user = userEvent.setup();
    labApi.createPortfolioLabRequest
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'No pudimos conectar con el servidor.' })
      .mockResolvedValueOnce({ request: request(), idempotent: true, deduplicated: false });
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Solicitar acompañamiento de Startería Lab' }));
    await user.click(screen.getByRole('checkbox', { name: /consiento compartir este Brief confirmado/i }));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud a Startería Lab' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar envío de la solicitud' }));
    await waitFor(() => expect(labApi.createPortfolioLabRequest).toHaveBeenCalledTimes(2));
    expect(labApi.createPortfolioLabRequest.mock.calls[0][1]).toBe(labApi.createPortfolioLabRequest.mock.calls[1][1]);
    expect(await screen.findByText('Solicitud recuperada sin duplicarla')).toHaveFocus();
  });

  it('LAB-UX04 cuenta 0/1/2/3 abiertas, no cuenta terminales y explica el 409 del límite', async () => {
    labApi.listPortfolioLabRequests.mockResolvedValue([
      request({ id: 'open-1', challengeId: 'other-1', briefVersionId: 'other-v1' }),
      request({ id: 'open-2', challengeId: 'other-2', briefVersionId: 'other-v2', status: 'CONTACT_PENDING' }),
      request({ id: 'closed', challengeId: 'other-3', briefVersionId: 'other-v3', status: 'CLOSED', terminalAt: '2026-11-07T04:00:00.000Z' }),
    ]);
    const user = userEvent.setup();
    labApi.createPortfolioLabRequest.mockRejectedValue({ code: 'PORTFOLIO_LAB_OPEN_LIMIT', message: 'La organización ya tiene 3 solicitudes abiertas a Startería Lab.' });
    const { unmount } = renderPanel();
    expect(await screen.findByText('Tus solicitudes abiertas: 2')).toBeInTheDocument();
    expect(screen.getByText('El máximo es 3 por organización. El servidor confirma el cupo organizacional al enviar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Solicitar acompañamiento de Startería Lab' }));
    await user.click(screen.getByRole('checkbox', { name: /consiento compartir este Brief confirmado/i }));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud a Startería Lab' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('3 solicitudes abiertas');
    unmount();
    labApi.listPortfolioLabRequests.mockResolvedValue([request({ id: 'a', challengeId: 'a' }), request({ id: 'b', challengeId: 'b' }), request({ id: 'c', challengeId: 'c' })]);
    renderPanel();
    expect(await screen.findByText('Tus solicitudes abiertas: 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar acompañamiento de Startería Lab' })).toBeDisabled();
  });

  it('LAB-UX05 separa solicitud persistida, notificación aceptada, pendiente y fallida sin exponer emails', async () => {
    labApi.listPortfolioLabRequests.mockResolvedValue([request({ id: 'accepted' })]);
    const { unmount } = renderPanel();
    expect(await screen.findByText('Solicitud registrada')).toBeInTheDocument();
    expect(screen.getByText('Notificación aceptada por el servidor')).toBeInTheDocument();
    unmount();
    labApi.listPortfolioLabRequests.mockResolvedValue([request({ id: 'pending', notificationStatus: 'PENDING', providerMessageRef: null })]);
    const pending = renderPanel();
    expect(await screen.findByText('Notificación pendiente')).toBeInTheDocument();
    pending.unmount();
    labApi.listPortfolioLabRequests.mockResolvedValue([request({ id: 'failed', notificationStatus: 'FAILED', providerMessageRef: null, lastNotificationError: 'SMTP_DOWN' })]);
    renderPanel();
    expect(await screen.findByText('Error al notificar')).toBeInTheDocument();
    expect(screen.queryByText(/@gmail\.com/i)).not.toBeInTheDocument();
  });

  it('LAB-UX06 reintenta sólo una notificación pendiente/fallida y conserva su key ante error de red', async () => {
    const user = userEvent.setup();
    labApi.listPortfolioLabRequests.mockResolvedValue([
      request({ notificationStatus: 'FAILED', providerMessageRef: null, lastNotificationError: 'SMTP_DOWN' }),
      request({ id: 'other-failed', challengeId: 'other-challenge', briefVersionId: 'other-version', notificationStatus: 'FAILED', providerMessageRef: null, lastNotificationError: 'SMTP_DOWN' }),
    ]);
    labApi.retryPortfolioLabNotification
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'No pudimos conectar con el servidor.' })
      .mockResolvedValueOnce({ request: request({ notificationStatus: 'NOTIFIED' }), idempotent: true });
    renderPanel();
    expect(await screen.findAllByRole('button', { name: 'Reintentar notificación' })).toHaveLength(1);
    expect(screen.getByText('1 solicitud tuya de otro Brief no se muestra en este seguimiento.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar notificación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    await user.click(screen.getByRole('button', { name: 'Reintentar notificación' }));
    await waitFor(() => expect(labApi.retryPortfolioLabNotification).toHaveBeenCalledTimes(2));
    expect(labApi.retryPortfolioLabNotification.mock.calls[0][1]).toBe(labApi.retryPortfolioLabNotification.mock.calls[1][1]);
    expect(labApi.retryPortfolioLabNotification.mock.calls[0][0]).toBe('lab-request-1');
    expect(await screen.findAllByText('Notificación aceptada por el servidor')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Reintentar notificación' })).not.toBeInTheDocument();
  });

  it('LAB-UX07 abre el Calendly exacto y deja claro que no registra una reserva', async () => {
    labApi.listPortfolioLabRequests.mockResolvedValue([request()]);
    renderPanel();
    const link = await screen.findByRole('link', { name: 'Abrir Calendly para proponer una reunión' });
    expect(link).toHaveAttribute('href', 'https://calendly.com/fabio-merino-97/new-meeting?month=2026-11');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Abrir Calendly no confirma ni registra una reunión en Startería.')).toBeInTheDocument();
    expect(labApi.createPortfolioLabRequest).not.toHaveBeenCalled();
  });

  it('LAB-UX08 preserva PL-06 y no crea Project, Assignment, Steps ni cierra el setup', async () => {
    renderPanel();
    expect(await screen.findByTestId('pl06a-assignment-preparation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Asignar responsable' })).toBeEnabled();
    expect(screen.getByText(/La solicitud Lab no crea asignaciones, proyectos ni Steps/i)).toBeInTheDocument();
    expect(briefApi.createChallengeHandoffAssignment).not.toHaveBeenCalled();
  });

  it('LAB-UX09 recupera seguimiento al reentrar sin duplicar la solicitud activa del Brief', async () => {
    labApi.listPortfolioLabRequests.mockResolvedValue([request()]);
    renderPanel();
    expect(await screen.findByText('Seguimiento de Startería Lab')).toBeInTheDocument();
    expect(screen.getByText('Tus solicitudes abiertas: 1')).toBeInTheDocument();
    expect(screen.getByText('Ya existe una solicitud activa para esta versión confirmada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar acompañamiento de Startería Lab' })).toBeDisabled();
    expect(labApi.createPortfolioLabRequest).not.toHaveBeenCalled();
  });

  it('G4-LAB01 offers an explicit Lab-only completion checkpoint only after real notification', async () => {
    const user = userEvent.setup();
    const onCompleteSetup = vi.fn().mockResolvedValue(undefined);
    labApi.listPortfolioLabRequests.mockResolvedValue([request()]);
    renderPanel(onCompleteSetup);

    const action = await screen.findByRole('button', { name: 'Finalizar configuración con Startería Lab' });
    await user.click(action);
    expect(screen.getByText(/contacto pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/no confirma una reunión/i)).toBeInTheDocument();
    expect(onCompleteSetup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sí, finalizar configuración' }));
    await waitFor(() => expect(onCompleteSetup).toHaveBeenCalledOnce());
  });

  it('G4-LAB02 keeps completion unavailable while notification is pending or failed', async () => {
    const onCompleteSetup = vi.fn().mockResolvedValue(undefined);
    labApi.listPortfolioLabRequests.mockResolvedValue([request({ notificationStatus: 'FAILED' })]);
    renderPanel(onCompleteSetup);

    expect(await screen.findByText('Error al notificar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Finalizar configuración con Startería Lab/i })).not.toBeInTheDocument();
    expect(onCompleteSetup).not.toHaveBeenCalled();
  });
});
