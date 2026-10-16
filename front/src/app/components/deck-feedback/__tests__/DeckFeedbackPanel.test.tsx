// Feedback IA del Step 4: antes mostraba un texto fijo sin leer el archivo. Ahora sube el PDF y
// muestra lo que la IA encontró contra el análisis de la iniciativa.
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const listDeckFeedback = vi.fn();
const analyzeDeck = vi.fn();
vi.mock('../../../services/deckFeedbackService', () => ({
  listDeckFeedback: (...args: unknown[]) => listDeckFeedback(...args),
  analyzeDeck: (...args: unknown[]) => analyzeDeck(...args),
}));

import { DeckFeedbackPanel } from '../DeckFeedbackPanel';

const FEEDBACK = {
  id: 'fb-1',
  pdfId: 'pdf-1',
  fileName: 'cierre.pdf',
  createdAt: '2026-10-16T00:00:00Z',
  result: {
    summary: 'El deck cuenta la decisión de escalar.',
    goodPoints: ['El pedido está en la última diapositiva'],
    missing: ['La campaña de descuentos que contamina el resultado'],
    unsupportedClaims: [{ claim: 'Las ventas subieron 30%', why: 'El análisis registra 14%' }],
    inconsistencies: [],
    nextAction: 'Corregir la cifra de ventas.',
    pages: 6,
    extractedChars: 1200,
    deckTruncated: false,
  },
};

const pdf = () => new File(['%PDF-1.4'], 'cierre.pdf', { type: 'application/pdf' });

describe('DeckFeedbackPanel', () => {
  beforeEach(() => {
    listDeckFeedback.mockReset().mockResolvedValue([]);
    analyzeDeck.mockReset();
  });

  it('sube el PDF y muestra lo que el análisis no respalda', async () => {
    analyzeDeck.mockResolvedValue(FEEDBACK);
    const onAnalyzed = vi.fn();
    render(<DeckFeedbackPanel projectId="p1" canEdit mentorCredits={3} onAnalyzed={onAnalyzed} />);

    fireEvent.change(screen.getByLabelText('PDF de la presentación'), { target: { files: [pdf()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Analizar con IA (1 crédito)' }));

    expect(await screen.findByText('Las ventas subieron 30% — El análisis registra 14%')).toBeInTheDocument();
    expect(screen.getByText('La campaña de descuentos que contamina el resultado')).toBeInTheDocument();
    expect(analyzeDeck).toHaveBeenCalledWith('p1', expect.any(File));
    expect(onAnalyzed).toHaveBeenCalledOnce();
  });

  it('muestra el último análisis guardado', async () => {
    listDeckFeedback.mockResolvedValue([FEEDBACK]);
    render(<DeckFeedbackPanel projectId="p1" canEdit={false} />);
    expect(await screen.findByText('El deck cuenta la decisión de escalar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Analizar/ })).not.toBeInTheDocument();
  });

  it('si la IA no responde avisa que no se cobró', async () => {
    analyzeDeck.mockRejectedValue({ response: { data: { error: { code: 'DECK_FEEDBACK_UNAVAILABLE', message: 'x' } } } });
    const onAnalyzed = vi.fn();
    render(<DeckFeedbackPanel projectId="p1" canEdit mentorCredits={3} onAnalyzed={onAnalyzed} />);

    fireEvent.change(screen.getByLabelText('PDF de la presentación'), { target: { files: [pdf()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Analizar con IA (1 crédito)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se descontó ningún crédito');
    expect(onAnalyzed).not.toHaveBeenCalled();
  });

  it('sin créditos no deja analizar', async () => {
    render(<DeckFeedbackPanel projectId="p1" canEdit mentorCredits={0} />);
    fireEvent.change(screen.getByLabelText('PDF de la presentación'), { target: { files: [pdf()] } });
    await waitFor(() => expect(listDeckFeedback).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Analizar con IA (1 crédito)' })).toBeDisabled();
    expect(screen.getByText(/No quedan créditos de mentor/)).toBeInTheDocument();
  });
});
