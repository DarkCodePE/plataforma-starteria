import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyPortfolioBootstrapContext,
  type PortfolioBootstrapContextPayload,
  type PortfolioBootstrapContextReview,
} from '../../services/portfolioBootstrapContextClient';
import {
  guidedContextQuestion,
  PortfolioBootstrapContextConversation,
} from '../PortfolioBootstrapContextConversation';

const declared = (value: string) => ({
  value,
  provenance: 'user_declared' as const,
  sourceRef: { kind: 'user_input' as const },
});

function payload(overrides: Partial<PortfolioBootstrapContextPayload> = {}): PortfolioBootstrapContextPayload {
  return { ...createEmptyPortfolioBootstrapContext(), ...overrides };
}

function review(overrides: Partial<PortfolioBootstrapContextReview> = {}): PortfolioBootstrapContextReview {
  const draft = payload({
    situation: declared('Somos una cafetería y queremos probar desayunos para llevar para oficinas cercanas.'),
    gaps: ['context-disposition:area:not_applicable'],
  });
  return {
    id: 'review-kan241',
    sessionId: 'session-kan241',
    status: 'draft',
    version: 2,
    draft,
    confirmedSnapshot: null,
    effectiveContext: null,
    hasPendingCorrection: false,
    sourceCompanyContext: null,
    draftSourceCompanyContext: null,
    confirmedSourceCompanyContext: null,
    effectiveSourceCompanyContext: null,
    draftProvenance: [],
    confirmedProvenance: null,
    effectiveProvenance: null,
    sourceOutdated: false,
    confirmedBy: null,
    confirmedAt: null,
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function props(overrides: Partial<React.ComponentProps<typeof PortfolioBootstrapContextConversation>> = {}) {
  return {
    operationScope: 'session-kan241',
    review: null,
    status: 'ready' as const,
    error: null,
    onSaveDraft: vi.fn().mockResolvedValue(undefined),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onRetry: vi.fn().mockResolvedValue(undefined),
    onContinue: vi.fn(),
    ...overrides,
  };
}

describe('KAN-241 adaptive E1 context conversation', () => {
  it('CA01 adapts a concise follow-up to a cafeteria without inventing a formal department', () => {
    const question = guidedContextQuestion(payload({
      situation: declared('Somos una cafetería y queremos probar desayunos para llevar para oficinas cercanas.'),
    }));

    expect(question.title).toMatch(/parte de la actividad/i);
    expect(question.help).toMatch(/para entender dónde ocurre/i);
    expect(question.title).not.toMatch(/departamento/i);
  });

  it('CA02 keeps process vocabulary for a company that explicitly declares formal operations', () => {
    const question = guidedContextQuestion(payload({
      situation: declared('La empresa tiene procesos formales de ventas y operaciones; necesitamos reducir retrasos entre ambos.'),
    }));

    expect(question.title).toMatch(/área o proceso/i);
    expect(question.help).toMatch(/ubicar el cambio/i);
  });

  it('CA03 persists unknown and not-applicable intent and advances instead of repeating the field', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapContextConversation {...props({
      review: review({
        version: 1,
        draft: payload({ situation: declared('Somos una cafetería pequeña con pedidos para llevar.') }),
      }),
      onSaveDraft,
    })} />);

    await user.click(screen.getByRole('button', { name: 'No aplica en este caso' }));

    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      area: { value: null, provenance: 'unknown' },
      gaps: expect.arrayContaining(['context-disposition:area:not_applicable']),
    }), null));
    expect(screen.getByText(/quién atendería este cambio y quién compraría/i)).toBeInTheDocument();
    expect(screen.queryByText(/en qué parte de la actividad ocurre/i)).not.toBeInTheDocument();
  });

  it('CA04 saves every incorporated answer before moving on and never leaves it only in local state', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapContextConversation {...props({ onSaveDraft })} />);

    await user.type(screen.getByLabelText('Tu respuesta'), 'Somos una cafetería con dos años de actividad y queremos ofrecer desayunos para llevar.');
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));

    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      situation: declared('Somos una cafetería con dos años de actividad y queremos ofrecer desayunos para llevar.'),
    }), null));
    expect(screen.getByText(/parte de la actividad/i)).toBeInTheDocument();
  });

  it('CA05 keeps the editable synthesis folded until explicit review and explains persisted unknowns', async () => {
    const user = userEvent.setup();
    render(<PortfolioBootstrapContextConversation {...props({ review: review() })} />);

    const disclosure = screen.getByRole('button', { name: 'Revisar contexto' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls', 'portfolio-context-summary');
    expect(screen.queryByLabelText('Situación actual')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revisar contexto' }));

    expect(screen.getByRole('region', { name: 'Síntesis editable del contexto' })).toHaveFocus();
    expect(screen.getByLabelText('Situación actual')).toHaveValue('Somos una cafetería y queremos probar desayunos para llevar para oficinas cercanas.');
    expect(screen.getAllByText('No aplica en este caso').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' })).toBeEnabled();
  });

  it('CA07 makes timeout failure and retry visible without losing the drafted answer', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockRejectedValue(new Error('Tiempo de espera agotado al guardar.'));
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapContextConversation {...props({ onSaveDraft, onRetry })} />);

    await user.type(screen.getByLabelText('Tu respuesta'), 'Una respuesta que debe conservarse.');
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tiempo de espera agotado al guardar.');
    expect(screen.getByLabelText('Tu respuesta')).toHaveValue('Una respuesta que debe conservarse.');
    expect(screen.getByText(/Cuéntame qué está ocurriendo/i)).toBeInTheDocument();
    expect(screen.queryByText(/parte de la actividad/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar operación' }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledOnce());
  });

  it('CA04 blocks confirmation of dirty synthesis until the edited draft is persisted', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapContextConversation {...props({ review: review(), onSaveDraft, onConfirm })} />);

    await user.click(screen.getByRole('button', { name: 'Revisar contexto' }));
    fireEvent.change(screen.getByLabelText('Situación actual'), {
      target: { value: 'Corrección persistida antes de confirmar.' },
    });

    expect(screen.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' })).toBeDisabled();
    expect(screen.getByText(/guarda los ajustes antes de confirmar/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      situation: declared('Corrección persistida antes de confirmar.'),
    }), null));
    expect(screen.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Estoy de acuerdo, confirmar contexto' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
  });

  it('CA08 re-enters a confirmed partial context without repeating completed or declined questions', () => {
    const confirmed = review({
      status: 'confirmed',
      version: 4,
      confirmedSnapshot: review().draft,
      effectiveContext: review().draft,
      confirmedBy: 'user-1',
      confirmedAt: '2026-11-07T12:00:00.000Z',
    });
    render(<PortfolioBootstrapContextConversation {...props({ review: confirmed })} />);

    expect(screen.queryByText(/parte de la actividad/i)).not.toBeInTheDocument();
    expect(screen.getByText(/quién atendería este cambio y quién compraría/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' })).toBeEnabled();
  });

  it('CA08 ignores a late save callback from session A after the conversation changes to session B', async () => {
    const user = userEvent.setup();
    const pendingA = deferred<unknown>();
    const reviewB = review({
      id: 'review-b',
      sessionId: 'session-b',
      version: 1,
      draft: payload({
        situation: declared('Contexto exclusivo de la sesión B.'),
        gaps: ['context-disposition:area:not_applicable'],
      }),
    });
    const { rerender } = render(<PortfolioBootstrapContextConversation {...props({
      operationScope: 'session-a',
      onSaveDraft: vi.fn(() => pendingA.promise),
    })} />);

    await user.type(screen.getByLabelText('Tu respuesta'), 'Respuesta tardía de la sesión A.');
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(screen.getByTestId('portfolio-context-conversation')).toHaveAttribute('aria-busy', 'true');

    rerender(<PortfolioBootstrapContextConversation {...props({
      operationScope: 'session-b',
      review: reviewB,
    })} />);

    await waitFor(() => expect(screen.getByTestId('portfolio-context-conversation')).toHaveAttribute('aria-busy', 'false'));
    await user.click(screen.getByRole('button', { name: 'Revisar contexto' }));
    expect(screen.getByLabelText('Situación actual')).toHaveValue('Contexto exclusivo de la sesión B.');

    await act(async () => { pendingA.resolve(undefined); });

    expect(screen.getByLabelText('Situación actual')).toHaveValue('Contexto exclusivo de la sesión B.');
    expect(screen.queryByDisplayValue('Respuesta tardía de la sesión A.')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-context-conversation')).toHaveAttribute('aria-busy', 'false');
  });
});
