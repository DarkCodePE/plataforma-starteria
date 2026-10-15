// Auditoría E2E F-07: una revisión hecha con la plantilla no debe parecer un análisis de IA.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationModeNotice } from '../pages/InitiativeReviewResultPage';

describe('GenerationModeNotice', () => {
  it('avisa cuando el modelo falló y se usó la plantilla', () => {
    render(<GenerationModeNotice mode="fallback" />);
    expect(screen.getByTestId('generation-mode-notice')).toHaveTextContent('el análisis con IA no respondió');
  });

  it('avisa cuando la IA no está activa', () => {
    render(<GenerationModeNotice mode="deterministic" />);
    expect(screen.getByTestId('generation-mode-notice')).toHaveTextContent('sin análisis con IA');
  });

  it('no muestra nada para un análisis real ni para snapshots viejos', () => {
    const { container, rerender } = render(<GenerationModeNotice mode="ai" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<GenerationModeNotice mode={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
