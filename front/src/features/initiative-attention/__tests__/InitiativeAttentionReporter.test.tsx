import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativeAttentionReporter } from '../InitiativeAttentionReporter';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('../../../app/services/api', () => ({
  default: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
  parseApiError: (error: unknown) => ({ message: error instanceof Error ? error.message : String(error) }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ data: { data: [] } });
  post.mockResolvedValue({ data: { data: { id: 'attention-1' } } });
});

describe('G04 initiative team attention reporter', () => {
  it('reads its own initiative alerts and does not create one on opening', async () => {
    render(<InitiativeAttentionReporter projectId="project-1" />);
    expect(await screen.findByText('No hay solicitudes registradas.')).toBeVisible();
    expect(get).toHaveBeenCalledWith('/projects/project-1/attention-items');
    expect(post).not.toHaveBeenCalled();
  });

  it('submits an explicit owner/editor blocker with idempotency and no Step mutation', async () => {
    const user = userEvent.setup();
    render(<InitiativeAttentionReporter projectId="project-1" />);
    await screen.findByText('No hay solicitudes registradas.');
    await user.click(screen.getByRole('button', { name: 'Comunicar un bloqueo' }));
    await user.type(screen.getByLabelText('Qué está bloqueando el trabajo'), 'Necesitamos una aprobación legal para usar estos datos.');
    await user.type(screen.getByLabelText('Qué debería ocurrir para resolverlo'), 'Recibir autorización escrita del área jurídica.');
    await user.type(screen.getByLabelText('Acción que propones'), 'Solicitar revisión al sponsor corporativo.');
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Enviar bloqueo a Portfolio Lead' }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post.mock.calls[0][0]).toBe('/projects/project-1/attention-items');
    expect(post.mock.calls[0][1]).toMatchObject({
      category: 'bloqueo', severity: 'medium',
      reason: 'Necesitamos una aprobación legal para usar estos datos.',
      nextAction: 'Solicitar revisión al sponsor corporativo.',
    });
    expect(typeof post.mock.calls[0][2].headers['Idempotency-Key']).toBe('string');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('displays persisted blocker status and the server access error', async () => {
    get.mockResolvedValueOnce({ data: { data: [{
      id: 'attention-1', reason: 'Integración bloqueada', category: 'bloqueo',
      severity: 'high', status: 'acknowledged', ownerId: null,
    }] } });
    const { rerender } = render(<InitiativeAttentionReporter projectId="project-1" />);
    expect(await screen.findByText('Integración bloqueada')).toBeVisible();
    get.mockRejectedValueOnce(new Error('No tienes permiso para consultar esta iniciativa.'));
    rerender(<InitiativeAttentionReporter projectId="project-2" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso');
  });
});
