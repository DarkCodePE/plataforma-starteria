import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StrategicFramingHomeSection } from '../StrategicFramingHomeSection';
import type { StrategicFramingHomeState } from '../../../services/portfolioService';

const available: StrategicFramingHomeState = {
  status: 'available',
  projection: {
    availability: 'available', totalStateCount: 1, hasMore: false,
    items: [{
      stateId: 'sf-1', updatedAt: '2026-09-27T00:00:00.000Z', sourceMode: 'enterprise_direct', intendedMovement: 'Mover conversión',
      sufficiency: { status: 'sufficient', blockerCount: 0 },
      prioritization: { addressNow: 1, observe: 0, discard: 0, undecided: 0, focusSlots: null },
      structuring: { confirmedCandidates: 1, unpromotedCandidates: 0 }, promotions: [],
      attention: { required: false, reasons: [] }, workspaceHref: '/portfolio/framing/sf-1',
    }],
  },
};

describe('StrategicFramingHomeSection SF-7B.3A', () => {
  it('FE-SF-01 renders the backend projection', () => {
    render(<StrategicFramingHomeSection state={available} />);
    expect(screen.getByRole('heading', { name: /qué está ocurriendo estratégicamente/i })).toBeInTheDocument();
    expect(screen.getByText('Mover conversión')).toBeInTheDocument();
  });

  it.each([
    ['empty', 'Todavía no hay una lectura estratégica estructurada.', /No pudimos cargar/i],
    ['no_context', 'No hay un contexto de portafolio activo para esta sesión.', /No hay iniciativas/i],
    ['context_selection_required', 'Tienes acceso a más de un espacio.', /No pudimos cargar/i],
    ['not_authorized', 'Tu acceso a este portafolio cambió.', /No pudimos cargar/i],
  ] as const)('renders %s without mislabeling it', (status, text, notExpected) => {
    render(<StrategicFramingHomeSection state={{ status } as StrategicFramingHomeState} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText(notExpected)).not.toBeInTheDocument();
  });

  it('FE-SF-06 keeps canonical Home available while unavailable is localized and retry is real', () => {
    const onRetry = vi.fn();
    render(<><h1>¿Qué requiere atención hoy?</h1><StrategicFramingHomeSection state={{ status: 'unavailable' }} onRetry={onRetry} /></>);
    expect(screen.getByRole('heading', { name: /qué requiere atención hoy/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not auto-select a context', () => {
    const onNavigate = vi.fn();
    render(<StrategicFramingHomeSection state={{ status: 'context_selection_required' }} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /seleccionar espacio/i }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('FE-SF-09 has no default empty fallback for unknown states', () => {
    expect(() => render(<StrategicFramingHomeSection state={{ status: 'future' } as never} />)).toThrow(/Unhandled Strategic Framing state/);
  });
});
