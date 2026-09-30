import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortfolioLeadFirstValuePage } from '../PortfolioLeadFirstValuePage';
import { getPortfolioSetupEvents, resetPortfolioSetupEvents } from '../prototypeInstrumentation';

function enterGoal() {
  fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));
  fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), { target: { value: '200 nuevas ventas B2B en Q4' } });
  fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
}

function enterNovaGrowth() {
  enterGoal();
  fireEvent.click(screen.getByRole('button', { name: /Usar ejemplo NovaGrowth/i }));
  fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));
}

describe('PortfolioLeadFirstValuePage', () => {
  it('reconciles every detected initiative, including the expanded reading', async () => {
    render(<PortfolioLeadFirstValuePage />);
    enterGoal();
    fireEvent.click(screen.getByTestId('use-novagrowth-expanded-fixture'));
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    expect(screen.getByText(/24 iniciativas detectadas están contabilizadas aquí/)).toBeInTheDocument();
    expect(screen.getAllByTestId('initiative-relationship-row')).toHaveLength(24);
    expect(screen.getAllByText('Posible mejor encaje').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Revisar cómo se relaciona/i })).toBeVisible();
  });

  it('emits the local first-value events without an analytics provider', async () => {
    resetPortfolioSetupEvents();
    render(<PortfolioLeadFirstValuePage />);
    enterNovaGrowth();
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /¿Por qué las agrupé así/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Ajustar esta lectura/i }));
    const names = getPortfolioSetupEvents().map(event => event.name);
    expect(names).toEqual(expect.arrayContaining(['portfolio_setup_started', 'portfolio_goal_submitted', 'portfolio_existing_work_submitted', 'portfolio_first_value_rendered', 'portfolio_interpretation_corrected']));
  });

  it('guides a Portfolio Lead from first visit through the narrative reading', async () => {
    render(<PortfolioLeadFirstValuePage />);
    expect(screen.getByRole('button', { name: /Preparar mi espacio/i })).toBeInTheDocument();
    enterNovaGrowth();
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    expect(screen.getByTestId('initiative-count')).toHaveTextContent('7 iniciativas');
    expect(screen.getByText('Esto es lo que entendí')).toBeInTheDocument();
    expect(screen.getByText('Así parece repartirse el trabajo')).toBeInTheDocument();
    expect(screen.getByText('Qué merece revisar')).toBeInTheDocument();
    expect(screen.getByText('Cómo se relacionan tus iniciativas con el objetivo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar cómo se relaciona/i })).toBeInTheDocument();
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
    expect(screen.getByText(/Añade lo que ya existe alrededor de este objetivo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /No tengo nada organizado todavía/i }));
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    expect(screen.getByText('0 iniciativas detectadas')).toBeInTheDocument();
  });

  it('shows provenance once and ends at a clean boundary before P4', async () => {
    render(<PortfolioLeadFirstValuePage />);
    enterNovaGrowth();
    await waitFor(() => expect(screen.getByTestId('first-value-narrative')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /¿Por qué las agrupé así/i })[0]);
    expect(screen.getByTestId('rationale-generate-opportunities')).toBeInTheDocument();
    expect(screen.getAllByText(/Basado en lo que compartiste/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/alignment score|porcentaje|ranking/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Revisar cómo se relaciona/i }));
    expect(screen.getByTestId('relationship-review-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Ya completaste la primera parte/i)).toBeInTheDocument();
    expect(screen.queryByText(/NEXT_SLICE_PLACEHOLDER|siguiente slice/i)).not.toBeInTheDocument();
  });
});
