import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortfolioLeadFirstValuePage } from '../PortfolioLeadFirstValuePage';
import { getPortfolioSetupEvents, resetPortfolioSetupEvents } from '../prototypeInstrumentation';

function enterGoal() {
  fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));
  fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), { target: { value: '200 nuevas ventas B2B en Q4' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
  fireEvent.click(screen.getByRole('button', { name: /Está bien, continuar/i }));
}

async function enterNovaGrowth() {
  enterGoal();
  fireEvent.click(screen.getByRole('button', { name: /Usar ejemplo NovaGrowth/i }));
  fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Sí, esto representa mi trabajo/i }));
}

describe('PortfolioLeadFirstValuePage', () => {
  it('reconciles every detected initiative, including the expanded reading', async () => {
    render(<PortfolioLeadFirstValuePage />);
    enterGoal();
    fireEvent.click(screen.getByTestId('use-novagrowth-expanded-fixture'));
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));
    expect(await screen.findByTestId('existing-work-checkpoint')).toBeInTheDocument();
    expect(screen.queryByTestId('first-value-narrative')).not.toBeInTheDocument();
    expect(screen.getByTestId('existing-work-checkpoint')).toHaveTextContent(/24\s+iniciativas/);
    fireEvent.click(screen.getByRole('button', { name: /Sí, esto representa mi trabajo/i }));
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    expect(screen.getByTestId('initiative-count')).toHaveTextContent('24 iniciativas detectadas');
    fireEvent.click(screen.getByRole('button', { name: /Revisar excepciones/i }));
    expect(screen.getAllByTestId('initiative-relationship-row')).toHaveLength(2);
    expect(screen.getAllByText('Podría responder mejor a otra prioridad').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Añadir contexto/i })[0]);
    fireEvent.change(screen.getByLabelText(/Contexto sobre/i), { target: { value: 'El equipo ya confirmó su relación con ventas.' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contexto/i }));
    expect(screen.getAllByRole('status').some(status => status.textContent?.includes('Contexto añadido: El equipo ya confirmó su relación con ventas.'))).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: /Marcar para revisar después/i })[0]);
    expect(screen.getAllByRole('status').some(status => status.textContent?.includes('Marcada para revisar después.'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Ver las 24 iniciativas/i }));
    expect(screen.getAllByTestId('initiative-relationship-row')).toHaveLength(24);
    expect(screen.queryByRole('button', { name: /Mantener en este objetivo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar con esta lectura/i })).toBeVisible();
  });

  it('emits the local first-value events without an analytics provider', async () => {
    resetPortfolioSetupEvents();
    render(<PortfolioLeadFirstValuePage />);
    await enterNovaGrowth();
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /¿Por qué las agrupé así/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Añadir contexto o corregir/i }));
    const names = getPortfolioSetupEvents().map(event => event.name);
    expect(names).toEqual(expect.arrayContaining(['portfolio_setup_started', 'portfolio_goal_submitted', 'portfolio_existing_work_submitted', 'portfolio_first_value_rendered', 'portfolio_interpretation_corrected']));
  });

  it('guides a Portfolio Lead from first visit through the narrative reading', async () => {
    render(<PortfolioLeadFirstValuePage />);
    expect(screen.getByRole('button', { name: /Preparar mi espacio/i })).toBeInTheDocument();
    await enterNovaGrowth();
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    expect(screen.getByTestId('initiative-count')).toHaveTextContent('7 iniciativas');
    expect(screen.getByText('Esto es lo que entendí')).toBeInTheDocument();
    expect(screen.getByText('Así parece repartirse el trabajo')).toBeInTheDocument();
    expect(screen.getByText('Qué merece revisar')).toBeInTheDocument();
    expect(screen.getByText('Cómo se relaciona el trabajo con el objetivo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Revisar excepciones/i }));
    expect(screen.getAllByText('Necesita más contexto').length).toBeGreaterThan(0);
    expect(screen.getByTestId('post-analysis-question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar con esta lectura/i })).toBeInTheDocument();
  });

  it('shows an intent checkpoint before the existing-work step', () => {
    render(<PortfolioLeadFirstValuePage />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));
    fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), { target: { value: '200 nuevas ventas B2B en Q4' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(screen.getByTestId('intent-checkpoint')).toHaveTextContent('200 nuevas ventas B2B en Q4');
    expect(screen.queryByTestId('existing-work-step')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ajustar/i }));
    expect(screen.getByLabelText(/Qué quieres conseguir/i)).toHaveValue('200 nuevas ventas B2B en Q4');
  });

  it('preserves the intent when the existing-work list is adjusted inline', async () => {
    render(<PortfolioLeadFirstValuePage />);
    enterGoal();
    fireEvent.click(screen.getByRole('button', { name: /Usar ejemplo NovaGrowth/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));
    expect(await screen.findByTestId('existing-work-checkpoint')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ajustar lista/i }));
    fireEvent.change(screen.getByLabelText(/Corrige o añade información/i), { target: { value: 'Pricing Pilot — prueba de pricing. Carlos.\nNueva iniciativa — ampliar ventas.' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    expect(screen.getByTestId('existing-work-checkpoint')).toBeInTheDocument();
    expect(screen.getByTestId('existing-work-checkpoint')).toHaveTextContent('2 iniciativas');
    expect(screen.getByTestId('existing-work-checkpoint')).toHaveTextContent('Nueva iniciativa');
    expect(screen.getByTestId('existing-work-checkpoint')).toHaveTextContent('200 nuevas ventas B2B en Q4');
    fireEvent.click(screen.getByRole('button', { name: /Sí, esto representa mi trabajo/i }));
    expect(await screen.findByTestId('first-value-narrative')).toBeInTheDocument();
    expect(screen.getByTestId('initiative-count')).toHaveTextContent('2 iniciativas detectadas');
    expect(screen.getByTestId('first-value-narrative')).toHaveTextContent('200 nuevas ventas B2B');
  });

  it('applies a grouped clarification to the current reading', async () => {
    render(<PortfolioLeadFirstValuePage />);
    await enterNovaGrowth();
    await screen.findByTestId('first-value-narrative');
    expect(screen.getByTestId('post-analysis-question')).toHaveTextContent('Pricing Pilot');
    expect(screen.getByTestId('post-analysis-question')).toHaveTextContent('Checkout Optimizer');
    fireEvent.change(screen.getByLabelText(/Tu aclaración/i), { target: { value: 'Las tres iniciativas forman parte del objetivo de ventas B2B.' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar aclaración/i }));

    expect(screen.getByTestId('reading-clarification')).toHaveTextContent('Las tres iniciativas forman parte del objetivo de ventas B2B.');
    fireEvent.click(screen.getByRole('button', { name: /Continuar con esta lectura/i }));
    expect(screen.getByTestId('global-reading-confirmation')).toHaveTextContent('Las tres iniciativas forman parte del objetivo de ventas B2B.');
  });

  it('personalizes the welcome and opens Copilot in first-time mode', async () => {
    render(<PortfolioLeadFirstValuePage firstName="Lucía" />);
    expect(screen.getByText('Hola, Lucía.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ayúdame a definir qué quiero conseguir/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a definir qué quiero conseguir/i }));
    expect(await screen.findByText(/Cuéntame qué quieres conseguir y te ayudo a ordenarlo/i)).toBeInTheDocument();
    expect(screen.getByText(/Soy el asistente de Startería/i)).toBeInTheDocument();
    expect(screen.queryByText(/Crear un reto/i)).not.toBeInTheDocument();
  });

  it('offers adaptive context and a no-file continuation path', async () => {
    render(<PortfolioLeadFirstValuePage />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));
    expect(screen.getByTestId('adaptive-context-checkpoint')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), { target: { value: 'Aumentar ventas B2B' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Está bien, continuar/i }));
    expect(screen.queryByText(/¿Quieres afinar esta lectura|me falta entender/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Añade lo que ya existe alrededor de este objetivo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /No tengo nada organizado todavía/i }));
    expect(await screen.findByTestId('existing-work-checkpoint')).toBeInTheDocument();
    expect(screen.getByTestId('existing-work-checkpoint')).toHaveTextContent('0 iniciativas');
    fireEvent.click(screen.getByRole('button', { name: /Sí, esto representa mi trabajo/i }));
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    expect(screen.getByTestId('initiative-count')).toHaveTextContent('0 iniciativas detectadas');
  });

  it('shows provenance once and ends at a clean boundary before P4', async () => {
    render(<PortfolioLeadFirstValuePage />);
    await enterNovaGrowth();
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /¿Por qué las agrupé así/i })[0]);
    expect(screen.getByTestId('rationale-generate-opportunities')).toBeInTheDocument();
    expect(screen.getAllByText(/Basado en lo que compartiste/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/alignment score|porcentaje|ranking/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar con esta lectura/i }));
    expect(screen.getByTestId('global-reading-confirmation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar lectura y continuar/i }));
    expect(screen.getByTestId('relationship-review-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Ya completaste la primera parte/i)).toBeInTheDocument();
    expect(screen.queryByText(/NEXT_SLICE_PLACEHOLDER|siguiente slice/i)).not.toBeInTheDocument();
  });
});
