import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortfolioLeadFirstValuePage } from '../PortfolioLeadFirstValuePage';
import { getPortfolioSetupEvents, resetPortfolioSetupEvents } from '../prototypeInstrumentation';

describe('PortfolioLeadFirstValuePage', () => {
  it('keeps focused setup content legible for NovaGrowthExpanded without rendering 24 cards', async () => {
    render(<PortfolioLeadFirstValuePage />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));
    fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), { target: { value: '200 nuevas ventas B2B en Q4' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /NovaGrowthExpanded/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));

    await waitFor(() => expect(screen.getByTestId('first-analytical-value')).toBeInTheDocument());
    expect(screen.getByTestId('initiative-count')).toHaveTextContent('24 iniciativas');
    expect(screen.getByTestId('expanded-inventory-summary')).toBeInTheDocument();
    expect(screen.getByTestId('first-analytical-value').querySelectorAll('li')).toHaveLength(0);
    expect(screen.getByTestId('review-signals').querySelectorAll('div.border-b')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Revisar cómo se relaciona/i })).toBeVisible();
  });

  it('emits the local prototype events without an analytics provider', async () => {
    resetPortfolioSetupEvents();
    render(<PortfolioLeadFirstValuePage />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));
    fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), { target: { value: '200 nuevas ventas B2B en Q4' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Usar ejemplo NovaGrowth/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));
    await waitFor(() => expect(screen.getByTestId('first-analytical-value')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /¿Por qué/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Corregir lo que entendió/i }));
    const names = getPortfolioSetupEvents().map(event => event.name);
    expect(names).toEqual(expect.arrayContaining([
      'portfolio_setup_started',
      'portfolio_goal_submitted',
      'portfolio_existing_work_submitted',
      'portfolio_first_value_rendered',
      'portfolio_rationale_opened',
      'portfolio_interpretation_corrected',
    ]));
  });

  it('guides a Portfolio Lead from first visit to First Analytical Value', async () => {
    render(<PortfolioLeadFirstValuePage />);

    expect(screen.getByRole('button', { name: /Preparar mi espacio/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));

    fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), {
      target: { value: 'Dirección quiere conseguir 200 nuevas ventas B2B este trimestre.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    expect(screen.getByText(/Ahora añade el trabajo que ya existe/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Usar ejemplo NovaGrowth/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));

    await waitFor(() => expect(screen.getByTestId('first-analytical-value')).toBeInTheDocument());
    expect(screen.getByTestId('initiative-count')).toHaveTextContent('7 iniciativas');
    expect(screen.getByTestId('owner-count')).toHaveTextContent('5');
    expect(screen.getByText(/Parece haber tres formas principales/i)).toBeInTheDocument();
    expect(screen.getByTestId('review-signals').querySelectorAll('div.border-b')).toHaveLength(3);
    expect(screen.getByText(/Tu guía de inicio · 2 de 5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar cómo se relaciona/i })).toBeInTheDocument();
  });

  it('opens rationale, exposes provenance, and stops at the next-slice boundary', async () => {
    render(<PortfolioLeadFirstValuePage />);
    fireEvent.click(screen.getByRole('button', { name: /Preparar mi espacio/i }));
    fireEvent.change(screen.getByLabelText(/Qué quieres conseguir/i), { target: { value: '200 nuevas ventas B2B en Q4' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Usar ejemplo NovaGrowth/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a ordenar esto/i }));

    await waitFor(() => expect(screen.getByTestId('first-analytical-value')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /¿Por qué/i })[0]);
    expect(screen.getByTestId('rationale-generate-opportunities')).toBeInTheDocument();
    expect(screen.getAllByText(/Encontrado en la información/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Revisar cómo se relaciona/i }));
    expect(screen.getByTestId('next-slice-placeholder')).toBeInTheDocument();
    expect(screen.getByText(/no se han implementado aún la Relationship Review/i)).toBeInTheDocument();
  });
});
