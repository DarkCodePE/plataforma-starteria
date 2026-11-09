import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioAttentionPanel } from '../PortfolioAttentionPanel';

const list = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const act = vi.hoisted(() => vi.fn());
vi.mock('../portfolioAttentionClient', () => ({
  listPortfolioAttention: (...args: unknown[]) => list(...args),
  createPortfolioAttention: (...args: unknown[]) => create(...args),
  actOnPortfolioAttention: (...args: unknown[]) => act(...args),
  attentionError: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

const open = {
  id: 'alert-1', projectId: 'project-1', category: 'dependencia',
  reason: 'La API del proveedor no responde.', severity: 'high',
  ownerId: 'owner-1', status: 'open', version: 2,
  exitCondition: 'La integración responde con éxito.', nextAction: 'Verificar la nueva versión.',
  resolutionNote: null, updatedAt: '2026-11-09T12:00:00.000Z',
  events: [{ id: 'event-1', actorId: 'lead-1', action: 'create',
    beforeStatus: null, afterStatus: 'open', previousOwnerId: null, nextOwnerId: 'owner-1',
    note: 'La API del proveedor no responde.', createdAt: '2026-11-09T12:00:00.000Z' }],
};
const assignees = [{ id: 'owner-1', label: 'Responsable de operaciones' }, { id: 'lead-1', label: 'Portfolio Lead' }];

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([open]);
  create.mockResolvedValue(open);
  act.mockResolvedValue({ ...open, status: 'resolved', version: 3 });
});

describe('G04 PortfolioAttentionPanel', () => {
  it('loads only persisted alerts and shows existing provenance', async () => {
    render(<PortfolioAttentionPanel projectId="project-1" assignees={assignees} />);
    const alert = await screen.findByTestId('portfolio-attention-item');
    expect(within(alert).getByText('La API del proveedor no responde.')).toBeVisible();
    expect(within(alert).getByText('Responsable de operaciones')).toBeVisible();
    expect(within(alert).getByText('Historial · 1 eventos')).toBeVisible();
    expect(list).toHaveBeenCalledWith('project-1');
    expect(create).not.toHaveBeenCalled();
    expect(act).not.toHaveBeenCalled();
  });

  it('does not write until an explicit human action and uses the server version', async () => {
    const user = userEvent.setup();
    render(<PortfolioAttentionPanel projectId="project-1" assignees={assignees} />);
    const alert = await screen.findByTestId('portfolio-attention-item');
    await user.selectOptions(within(alert).getByLabelText('Acción de Portfolio Lead'), 'resolve');
    expect(within(alert).getByRole('button', { name: 'Registrar acción e historial' })).toBeDisabled();
    await user.type(within(alert).getByLabelText('Motivo y evidencia de la acción'), 'Integración verificada con evidencia del proveedor.');
    expect(act).not.toHaveBeenCalled();
    list.mockResolvedValueOnce([{ ...open, status: 'resolved', version: 3, resolutionNote: 'Integración verificada con evidencia del proveedor.' }]);
    await user.click(within(alert).getByRole('button', { name: 'Registrar acción e historial' }));
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1));
    expect(act.mock.calls[0][0]).toBe('project-1');
    expect(act.mock.calls[0][1]).toBe('alert-1');
    expect(act.mock.calls[0][2]).toMatchObject({
      action: 'resolve', expectedVersion: 2, note: 'Integración verificada con evidencia del proveedor.',
    });
    expect(typeof act.mock.calls[0][3]).toBe('string');
    expect(await screen.findByText('Resuelta')).toBeVisible();
  });

  it('does not allow escalation without an available verified assignee', async () => {
    const user = userEvent.setup();
    render(<PortfolioAttentionPanel projectId="project-1" assignees={[]} />);
    const alert = await screen.findByTestId('portfolio-attention-item');
    await user.selectOptions(within(alert).getByLabelText('Acción de Portfolio Lead'), 'escalate');
    await user.type(within(alert).getByLabelText('Motivo y evidencia de la acción'), 'Dependencia requiere decisión del sponsor.');
    expect(within(alert).getByRole('button', { name: 'Registrar acción e historial' })).toBeDisabled();
    expect(within(alert).getByText(/No hay responsables verificados/)).toBeVisible();
    expect(act).not.toHaveBeenCalled();
  });

  it('creates an alert only after confirmation and supports an empty persisted list', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue([]);
    render(<PortfolioAttentionPanel projectId="project-1" assignees={assignees} />);
    expect(await screen.findByText('No hay alertas registradas para esta iniciativa.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Registrar nueva alerta' }));
    await user.type(screen.getByLabelText('Qué ocurre'), 'No tenemos respuesta legal.');
    await user.type(screen.getByLabelText('Condición para resolver'), 'Aprobación escrita de asesoría.');
    await user.type(screen.getByLabelText('Siguiente acción'), 'Solicitar revisión del documento.');
    expect(create).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Crear alerta con historial' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0]).toBe('project-1');
    expect(create.mock.calls[0][1]).toMatchObject({
      category: 'bloqueo', reason: 'No tenemos respuesta legal.',
      exitCondition: 'Aprobación escrita de asesoría.',
      nextAction: 'Solicitar revisión del documento.',
    });
  });
});
