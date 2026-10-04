import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopilotIntentModes } from '../CopilotIntentModes';

const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));
const getCopilotMode = vi.fn();
vi.mock('../../services/adaptiveCoreService', () => ({ getCopilotMode: (p: string, m: string) => getCopilotMode(p, m) }));
const post = vi.fn().mockResolvedValue({});
vi.mock('../../../../app/services/api', () => ({ default: { post: (...args: unknown[]) => post(...args) } }));

describe('CopilotIntentModes (§20)', () => {
  it('ofrece los tres modos y muestra la respuesta del modo elegido', async () => {
    getCopilotMode.mockResolvedValue({ mode: 'orient', title: 'Dónde estás', answer: 'Estás en el Step 1: ¿Qué sabemos realmente?', actions: [{ label: 'Ir al Step 1', target: '/projects/p1/step/1' }], sources: [] });
    render(<CopilotIntentModes projectId="p1" />);
    for (const label of ['Orientarme', 'Trabajar conmigo', 'Desbloquearme']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: /Orientarme/ }));
    expect(await screen.findByTestId('copilot-mode-response')).toHaveTextContent('¿Qué sabemos realmente?');
    fireEvent.click(screen.getByRole('button', { name: 'Ir al Step 1' }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1/step/1');
    expect(getCopilotMode).toHaveBeenCalledWith('p1', 'orient');
  });

  it('Desbloquearme pide ayuda al mentor por la API existente', async () => {
    getCopilotMode.mockResolvedValue({ mode: 'unblock', title: 'Qué te frena', answer: 'Falta acceso al CRM', actions: [{ label: 'Pedir ayuda al mentor', target: 'help_request' }], sources: [] });
    render(<CopilotIntentModes projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /Desbloquearme/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir ayuda al mentor' }));
    expect(await screen.findByText('Le avisamos a tu mentor.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/projects/p1/help', expect.objectContaining({ message: 'Falta acceso al CRM' }));
  });
});
