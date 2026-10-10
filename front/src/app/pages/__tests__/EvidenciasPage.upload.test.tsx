/**
 * Swarm de roles (2026-10-10): "Subir evidencia" sólo guardaba en el estado del navegador.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidenciasPage } from '../EvidenciasPage';

vi.mock('react-router', () => ({ useParams: () => ({ projectId: 'p1' }), useNavigate: () => vi.fn() }));

const updateProject = vi.fn();
const project = { id: 'p1', name: 'Iniciativa', evidence: [], team: [], steps: [], step0Data: {} };
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ projects: [project], updateProject, user: { id: 'u1', name: 'Ana' } }),
}));

const create = vi.fn();
vi.mock('../../services/evidenceService', () => ({ create: (...args: unknown[]) => create(...args) }));

async function pasteLink(url: string) {
  render(<EvidenciasPage />);
  fireEvent.click(screen.getByRole('button', { name: /Subir evidencia/ }));
  fireEvent.click(screen.getByRole('button', { name: /Pegar link/ }));
  fireEvent.change(screen.getByPlaceholderText(/drive\.google/), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
}

describe('EvidenciasPage — subir evidencia', () => {
  beforeEach(() => {
    updateProject.mockReset();
    create.mockReset();
  });

  it('la registra en el servidor y usa el id que devuelve', async () => {
    create.mockResolvedValue({ id: 'ev-server' });
    await pasteLink('https://example.com/informe');
    await waitFor(() => expect(updateProject).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'Link', url: 'https://example.com/informe', stepRef: 1 }));
    expect(updateProject.mock.calls[0][1].evidence[0].id).toBe('ev-server');
  });

  it('si el servidor la rechaza, avisa y no la muestra como subida', async () => {
    create.mockRejectedValue(new Error('Tu rol en el equipo es de sólo lectura.'));
    await pasteLink('https://example.com/informe');
    expect(await screen.findByRole('alert')).toHaveTextContent(/sólo lectura/);
    expect(updateProject).not.toHaveBeenCalled();
  });
});
