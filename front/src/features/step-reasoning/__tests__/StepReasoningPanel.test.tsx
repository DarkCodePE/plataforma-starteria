import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepReasoningPanel } from '../components/StepReasoningPanel';
import type { AdaptiveInitiativeCore } from '../../adaptive-core/domain/types';

describe('StepReasoningPanel', () => {
  it('restores history and labels model suggestions as pending human review', async () => {
    const client = {
      getSession: vi.fn(async () => ({
        session: { id: 'session-1', contextHash: 'sha256:test', cycleId: 'cycle-1' },
        turns: [{
          id: 'turn-1', clientTurnId: '2d034bae-50df-4e1c-823d-1f63d654a9e8', inputText: 'Tengo retrabajo.',
          assistantText: 'Aclaremos dónde ocurre.', status: 'SUCCEEDED', executionMode: 'live_llm',
          structuredOutput: { suggestions: [{ field: 'problemStatement', proposedValue: 'Retrabajo operativo', status: 'UNREVIEWED' }] },
        }],
      })),
      sendTurn: vi.fn(),
    };
    render(
      <StepReasoningPanel
        projectId="project-1"
        client={client as any}
        missionContext={{
          initiativeName: 'Reducir retrabajo comercial',
          contextLabel: 'Contexto inicial disponible',
          mission: 'Comprender dónde comienza el retrabajo entre ventas y operaciones.',
          missionSource: 'Reto vinculado a esta iniciativa',
          businessOutcome: 'Reducir el coste de retrabajo.',
          cycleObjective: 'Delimitar una señal observable antes de decidir.',
          step0Method: 'Aclarar el alcance inicial, las condiciones y la decisión que este ciclo debe habilitar.',
          nextFocus: 'Identificar el primer traspaso con errores.',
        }}
      />,
    );
    expect(await screen.findByText('Tengo retrabajo.')).toBeInTheDocument();
    expect(screen.getByText('Aclaremos dónde ocurre.')).toBeInTheDocument();
    expect(screen.getByText('Reducir retrabajo comercial')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver contexto y fuentes/i }));
    expect(screen.getByText('Comprender dónde comienza el retrabajo entre ventas y operaciones.')).toBeInTheDocument();
    expect(screen.getByText(/Identificar el primer traspaso/i)).toBeInTheDocument();
    expect(screen.getByText(/Pendiente de revisión humana/i)).toBeInTheDocument();
    expect(screen.queryByText(/Card confirmada/i)).not.toBeInTheDocument();
  });

  it('sends a message and keeps the composer accessible without a fixed overlay', async () => {
    const client = {
      getSession: vi.fn(async () => ({ session: null, turns: [] })),
      sendTurn: vi.fn(async () => ({
        session: { id: 'session-1', contextHash: 'sha256:test', cycleId: 'cycle-1' },
        turn: { id: 'turn-1', clientTurnId: '2d034bae-50df-4e1c-823d-1f63d654a9e8', inputText: 'No lo sé aún.', assistantText: 'Podemos empezar por una señal observable.', status: 'SUCCEEDED', executionMode: 'live_llm' },
      })),
    };
    render(<StepReasoningPanel projectId="project-1" client={client as any} createClientTurnId={() => '2d034bae-50df-4e1c-823d-1f63d654a9e8'} />);
    const input = await screen.findByLabelText(/Cuéntale a Starteria/i);
    fireEvent.change(input, { target: { value: 'No lo sé aún.' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));
    await waitFor(() => expect(client.sendTurn).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Podemos empezar por una señal observable.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeVisible();
  });

  it('presents provider failure as a technical state without synthetic checkpoint guidance', async () => {
    const client = {
      getSession: vi.fn(async () => ({
        session: { id: 'session-1', contextHash: 'sha256:test', cycleId: 'cycle-1' },
        turns: [{
          id: 'turn-failed',
          clientTurnId: '7de8b171-0f9f-4b2e-9e5c-460abf83e1f1',
          inputText: 'Todavía no sé dónde medir.',
          assistantText: '¿Qué dato concreto te ayudaría a avanzar en CP-0.1?',
          status: 'FAILED',
          executionMode: 'limited_fallback',
          structuredOutput: { nextInteraction: { kind: 'ask', question: '¿Qué dato falta en CP-0.1?' } },
        }],
      })),
      sendTurn: vi.fn(),
    };

    render(<StepReasoningPanel projectId="project-1" client={client as any} />);

    expect(await screen.findByText(/No pudimos generar una respuesta ahora/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar mensaje/i })).toBeInTheDocument();
    expect(screen.queryByText(/CP-0\.1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LLM/i)).not.toBeInTheDocument();
  });

  it('exposes compact mobile context with explicit expanded state and controlled detail', async () => {
    const client = {
      getSession: vi.fn(async () => ({ session: null, turns: [] })),
      sendTurn: vi.fn(),
    };

    render(
      <StepReasoningPanel
        projectId="project-1"
        client={client as any}
        missionContext={{
          initiativeName: 'Reducir retrabajo comercial',
          contextLabel: 'Contexto inicial disponible',
          mission: 'Comprender dónde comienza el retrabajo.',
          missionSource: 'Descripción de la iniciativa',
          businessOutcome: null,
          cycleObjective: null,
          step0Method: 'Aclarar el alcance inicial y la decisión que este ciclo debe habilitar.',
          nextFocus: 'Identificar una señal observable.',
        }}
      />,
    );

    const disclosure = await screen.findByRole('button', { name: /Ver contexto y fuentes/i });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls', 'step-reasoning-mission-detail');

    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Resultado canónico del Step')).toBeInTheDocument();
    expect(screen.getByText('Descripción de la iniciativa')).toBeInTheDocument();
  });

  it('renders an operational Step 2 conversation and calls the Step-scoped API', async () => {
    const client = {
      getSession: vi.fn(async () => ({
        session: null,
        turns: [{
          id: 'turn-stub', clientTurnId: 'turn-stub', inputText: 'Necesito concretar la prueba.',
          assistantText: 'Respuesta determinista de integración.', status: 'SUCCEEDED', executionMode: 'qa_stub',
        }],
      })),
      sendTurn: vi.fn(),
    };
    const { container } = render(<StepReasoningPanel projectId="project-2" step={2} client={client as any} />);
    expect(await screen.findByText(/Conversa con Startería/i)).toBeInTheDocument();
    expect(screen.getByText(/Respuesta de integración QA/i)).toBeInTheDocument();
    expect(container.querySelector('.bg-slate-950')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver contexto y fuentes/i })).toHaveAttribute('aria-expanded', 'false');
    expect(client.getSession).toHaveBeenCalledWith('project-2', 2);
  });

  it('prioritizes writing before suggested prompts and focuses from the mobile shortcut', async () => {
    const client = {
      getSession: vi.fn(async () => ({ session: null, turns: [] })),
      sendTurn: vi.fn(),
    };
    render(<StepReasoningPanel projectId="project-compose" client={client as any} />);
    const composer = await screen.findByTestId('step-reasoning-composer');
    const suggestions = screen.getByTestId('step-reasoning-panel')
      .querySelector('[aria-label="Preguntas sugeridas para el Copilot"]');
    expect(suggestions).not.toBeNull();
    expect(composer.compareDocumentPosition(suggestions!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Escribir a Startería' }));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('keeps history visible but removes every write control in read-only mode', async () => {
    const client = {
      getSession: vi.fn(async () => ({
        session: null,
        turns: [{ id: 'turn-1', clientTurnId: 'turn-1', inputText: 'Dato previo', assistantText: 'Contexto previo', status: 'SUCCEEDED', executionMode: 'qa_stub' }],
      })),
      sendTurn: vi.fn(),
    };
    render(<StepReasoningPanel projectId="project-2" step={2} readOnly client={client as any} />);
    expect(await screen.findByText('Dato previo')).toBeInTheDocument();
    expect(screen.queryByTestId('step-reasoning-composer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar mensaje/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Conversación en sólo lectura/i)).toBeInTheDocument();
  });

  it('recovers completed Step history without exposing a composer', async () => {
    const client = {
      getSession: vi.fn(async () => ({
        session: { id: 'session-step2', contextHash: 'sha256:test', cycleId: 'cycle-1' },
        turns: [{ id: 'turn-1', clientTurnId: 'turn-1', inputText: 'Preparamos el piloto.', assistantText: 'Historial conservado.', status: 'SUCCEEDED', executionMode: 'qa_stub' }],
      })),
      sendTurn: vi.fn(),
    };
    const completed = {
      cycle: { id: 'cycle-1', currentStep: 3, status: 'active' },
      masterContext: { routeType: 'explore_validate', depthLevel: 'standard' },
      stepConfigurations: [{ id: 'step2-v1', step: 2, version: 1, routeType: 'explore_validate', depthLevel: 'standard', expectedOutput: 'Prueba preparada', checkpoints: [] }],
      activeStepConfigurationId: 'step3-v1', activeCheckpoint: null, checkpointInstances: [], stepOutputs: [{ step: 2, status: 'confirmed', version: 1, output: { summary: 'Piloto listo' } }],
    } as unknown as AdaptiveInitiativeCore;

    render(<StepReasoningPanel projectId="project-2" step={2} core={completed} client={client as any} />);

    expect(await screen.findByText('Historial conservado.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Qué conseguiste' })).toBeInTheDocument();
    expect(screen.getAllByText('Piloto listo')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Ver resultado del Step/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Ver conversación histórica/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('step-reasoning-composer')).not.toBeInTheDocument();
    expect(screen.queryByText(/Trabaja conversando|Qué vas a lograr/i)).not.toBeInTheDocument();
    expect(client.sendTurn).not.toHaveBeenCalled();
  });

  it.each([
    [0, '¿Qué falta aclarar?', '¿Qué decisión preparamos?'],
    [1, '¿Qué sabemos realmente?', '¿Qué evidencia falta?'],
    [2, '¿Qué probamos primero?', '¿Cómo medimos el resultado?'],
    [3, '¿Qué observamos?', '¿Qué aprendimos?'],
    [4, '¿Qué recomendaremos?', '¿Qué riesgos quedan?'],
  ] as const)('offers two concise Step %i prompts without repeating the mission', async (step, first, second) => {
    const client = {
      getSession: vi.fn(async () => ({ session: null, turns: [] })),
      sendTurn: vi.fn(),
    };

    render(<StepReasoningPanel projectId={`project-${step}`} step={step} client={client as any} />);

    const firstPrompt = await screen.findByRole('button', { name: first });
    expect(screen.getByRole('button', { name: second })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /\?$/ })).toHaveLength(2);

    fireEvent.click(firstPrompt);
    expect(screen.getByRole('textbox')).toHaveValue(first);
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(client.sendTurn).not.toHaveBeenCalled();
  });

  it('keeps the latest response visible when the reader was already at the end', async () => {
    let completeTurn!: (value: any) => void;
    const client = {
      getSession: vi.fn(async () => ({
        session: { id: 'session-1', contextHash: 'sha256:test', cycleId: 'cycle-1' },
        turns: [{ id: 'turn-1', clientTurnId: 'turn-1', inputText: 'Primer mensaje', assistantText: 'Primera respuesta', status: 'SUCCEEDED', executionMode: 'qa_stub' }],
      })),
      sendTurn: vi.fn(() => new Promise(resolve => { completeTurn = resolve; })),
    };
    render(<StepReasoningPanel projectId="project-scroll" step={2} client={client as any} createClientTurnId={() => '2d034bae-50df-4e1c-823d-1f63d654a9e8'} />);

    const history = await screen.findByRole('log', { name: 'Historial de conversación' });
    let scrollHeight = 1000;
    Object.defineProperty(history, 'clientHeight', { configurable: true, value: 320 });
    Object.defineProperty(history, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    history.scrollTop = 680;
    fireEvent.scroll(history);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nueva pregunta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    scrollHeight = 1200;
    await act(async () => completeTurn({
      session: { id: 'session-1', contextHash: 'sha256:test', cycleId: 'cycle-1' },
      turn: { id: 'turn-2', clientTurnId: '2d034bae-50df-4e1c-823d-1f63d654a9e8', inputText: 'Nueva pregunta', assistantText: 'Respuesta reciente', status: 'SUCCEEDED', executionMode: 'qa_stub' },
    }));

    await waitFor(() => expect(history.scrollTop).toBe(880));
    expect(screen.queryByRole('button', { name: 'Ir al mensaje más reciente' })).not.toBeInTheDocument();
  });

  it('preserves an older reading position and offers a keyboard-accessible return to the latest turn', async () => {
    let completeTurn!: (value: any) => void;
    const client = {
      getSession: vi.fn(async () => ({
        session: { id: 'session-1', contextHash: 'sha256:test', cycleId: 'cycle-1' },
        turns: [{ id: 'turn-1', clientTurnId: 'turn-1', inputText: 'Primer mensaje', assistantText: 'Primera respuesta', status: 'SUCCEEDED', executionMode: 'qa_stub' }],
      })),
      sendTurn: vi.fn(() => new Promise(resolve => { completeTurn = resolve; })),
    };
    render(<StepReasoningPanel projectId="project-scroll" step={2} client={client as any} createClientTurnId={() => '2d034bae-50df-4e1c-823d-1f63d654a9e8'} />);

    const history = await screen.findByRole('log', { name: 'Historial de conversación' });
    let scrollHeight = 1000;
    Object.defineProperty(history, 'clientHeight', { configurable: true, value: 320 });
    Object.defineProperty(history, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    history.scrollTop = 200;
    fireEvent.scroll(history);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nueva pregunta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    scrollHeight = 1200;
    await act(async () => completeTurn({
      session: { id: 'session-1', contextHash: 'sha256:test', cycleId: 'cycle-1' },
      turn: { id: 'turn-2', clientTurnId: '2d034bae-50df-4e1c-823d-1f63d654a9e8', inputText: 'Nueva pregunta', assistantText: 'Respuesta reciente', status: 'SUCCEEDED', executionMode: 'qa_stub' },
    }));

    const returnButton = await screen.findByRole('button', { name: 'Ir al mensaje más reciente' });
    expect(history.scrollTop).toBe(200);
    expect(returnButton).toHaveAttribute('aria-controls', 'step-reasoning-turns');
    returnButton.focus();
    fireEvent.keyDown(returnButton, { key: 'Enter' });
    fireEvent.click(returnButton);
    expect(history.scrollTop).toBe(880);
    expect(returnButton).not.toBeInTheDocument();
  });

  it('uses responsive viewport-bound history heights without changing the 70/30 workspace', async () => {
    const client = {
      getSession: vi.fn(async () => ({ session: null, turns: [] })),
      sendTurn: vi.fn(),
    };
    render(<StepReasoningPanel projectId="project-height" step={2} client={client as any} />);

    const history = await screen.findByRole('log', { name: 'Historial de conversación' });
    expect(history.className).toContain('h-[clamp(7rem,16dvh,10rem)]');
    expect(history.className).toContain('sm:h-[clamp(8rem,16dvh,11rem)]');
    expect(history.className).toContain('lg:h-[clamp(9rem,16dvh,12rem)]');
    expect(Array.from(screen.getByTestId('step-reasoning-panel').querySelectorAll('div')).some(element =>
      element.className.includes('xl:grid-cols-[minmax(0,7fr)_minmax(17rem,3fr)]'),
    )).toBe(true);
  });

  it('uses one mobile shortcut to focus the single existing composer', async () => {
    const client = {
      getSession: vi.fn(async () => ({ session: null, turns: [] })),
      sendTurn: vi.fn(),
    };
    render(<StepReasoningPanel projectId="project-mobile" step={2} client={client as any} />);

    const shortcut = await screen.findByRole('button', { name: 'Escribir a Startería' });
    fireEvent.click(shortcut);

    expect(screen.getAllByTestId('step-reasoning-composer')).toHaveLength(1);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(shortcut).toHaveAttribute('aria-controls', 'step-reasoning-composer-input');
  });
});
