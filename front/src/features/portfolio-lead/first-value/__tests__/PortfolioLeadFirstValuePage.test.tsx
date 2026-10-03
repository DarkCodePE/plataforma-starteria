import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PortfolioLeadFirstValuePage } from '../PortfolioLeadFirstValuePage';
import { analyzeFirstValueP3 } from '../firstValueP3Service';
import { getConfirmedBrief } from '../confirmedBriefClient';
import { readClaimedPortfolioEntryBriefIdentity } from '../../../portfolio-entry/public/storage';

vi.mock('../firstValueP3Service', () => ({ analyzeFirstValueP3: vi.fn() }));
vi.mock('../confirmedBriefClient', () => ({ getConfirmedBrief: vi.fn() }));
vi.mock('../../../portfolio-entry/public/storage', () => ({ readClaimedPortfolioEntryBriefIdentity: vi.fn(() => null) }));

const resultFor = (items: Array<{ itemId: string; name: string }>) => ({
  sessionId: 'session-1', requestId: 'request-1', analysisId: 'analysis-1', resultState: 'PROVISIONAL',
  summary: { analyzedItemCount: items.length, counts: { DIRECT_CONTRIBUTION: 1, NEEDS_CONTEXT: items.length - 1, POSSIBLE_OTHER_PRIORITY: 0 }, exceptionFirstNarrative: 'Hay excepciones que revisar.' },
  relationships: items.map((item, index) => ({
    itemId: item.itemId, disposition: index === 0 ? 'DIRECT_CONTRIBUTION' : 'NEEDS_CONTEXT',
    rationale: `La información sobre ${item.name} necesita contexto.`, evidenceRefs: ['work'], clarificationCouldChangeReading: index > 0,
  })),
  clarifications: items.length > 1 ? [{ id: 'question-1', affectedItemIds: items.slice(1).map(item => item.itemId), question: `¿Cómo se relacionan ${items.slice(1).map(item => item.name).join(' y ')} con este objetivo?`, reason: 'La prioridad puede cambiar la lectura.' }] : [],
  provenance: [],
});

const installResult = (names: string[]) => vi.mocked(analyzeFirstValueP3).mockResolvedValue(
  resultFor(names.map((name, index) => ({ itemId: `item-${index + 1}`, name }))) as never,
);

const startP1 = () => {
  render(<PortfolioLeadFirstValuePage />);
  fireEvent.change(screen.getByLabelText(/qué quieres conseguir/i), { target: { value: 'Aumentar ventas B2B en Q4' } });
  fireEvent.change(screen.getByLabelText(/contexto adicional/i), { target: { value: 'Mercado europeo' } });
  fireEvent.click(screen.getByRole('button', { name: /mostrar lo que entendió/i }));
};

const confirmP1AndP2 = (work = ['Pricing Pilot', 'Checkout Optimizer', 'CRM Follow-up']) => {
  startP1();
  expect(screen.getByTestId('p1-confirmed-summary')).toHaveTextContent('Aumentar ventas B2B en Q4');
  fireEvent.click(screen.getByRole('button', { name: /está bien, continuar/i }));
  expect(screen.getByTestId('p2-existing-work-checkpoint')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/trabajo existente/i), { target: { value: work.join('\n') } });
  fireEvent.click(screen.getByRole('button', { name: /mostrar trabajo detectado/i }));
  expect(screen.getByTestId('p2-existing-work-checkpoint')).toHaveTextContent(work[0]);
};

describe('First Value P1–P3 runtime', () => {
  beforeEach(() => { vi.mocked(analyzeFirstValueP3).mockReset(); vi.mocked(getConfirmedBrief).mockReset(); vi.mocked(readClaimedPortfolioEntryBriefIdentity).mockReturnValue(null); });
  afterEach(() => cleanup());

  it('FV-03/04: muestra el checkpoint P1 y ajustar mantiene objetivo y contexto', () => {
    startP1();
    expect(screen.getByTestId('p1-confirmed-summary')).toHaveTextContent('Mercado europeo');
    fireEvent.click(screen.getByRole('button', { name: /ajustar intención/i }));
    expect(screen.getByLabelText(/qué quieres conseguir/i)).toHaveValue('Aumentar ventas B2B en Q4');
    expect(screen.getByLabelText(/contexto adicional/i)).toHaveValue('Mercado europeo');
  });

  it('mantiene setup vacío cuando no hay continuación y no llama D1', () => {
    render(<PortfolioLeadFirstValuePage />);
    expect(screen.getByLabelText(/qué quieres conseguir/i)).toHaveValue('');
    expect(getConfirmedBrief).not.toHaveBeenCalled();
  });

  it('consume identidad completa, hidrata una vez y conserva edición local', async () => {
    vi.mocked(readClaimedPortfolioEntryBriefIdentity).mockReturnValue({ source: 'portfolio_entry', sessionId: 's1', sessionRevision: 7, handoffId: 'h1', handoffVersion: 2, confirmationId: 'c1', confirmationVersion: 3 });
    vi.mocked(getConfirmedBrief).mockResolvedValue({ source: 'portfolio_entry', sessionId: 's1', revision: 7, handoffId: 'h1', handoffVersion: 2, confirmationId: 'c1', confirmationVersion: 3, brief: { rawEntry: 'do not use', handoff: { desired_outcome: 'Goal', understanding: 'Situation' }, confirmation: { status: 'CONFIRMED', acceptedFields: ['desired_outcome', 'understanding'], correctedFields: {}, rejectedFields: [] } } });
    render(<PortfolioLeadFirstValuePage />);
    await waitFor(() => expect(screen.getByLabelText(/qué quieres conseguir/i)).toHaveValue('Goal'));
    expect(screen.getByLabelText(/contexto adicional/i)).toHaveValue('Situación actual:\nSituation');
    fireEvent.change(screen.getByLabelText(/qué quieres conseguir/i), { target: { value: 'My edit' } });
    expect(getConfirmedBrief).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getConfirmedBrief).mock.calls[0][0]).toMatchObject({ sessionId: 's1', sessionRevision: 7, handoffId: 'h1', confirmationId: 'c1' });
    expect(screen.queryByText(/do not use/i)).not.toBeInTheDocument();
  });

  it('mantiene el composer bloqueado durante D1 y reintenta mismo identity después de error de red', async () => {
    vi.mocked(readClaimedPortfolioEntryBriefIdentity).mockReturnValue({ source: 'portfolio_entry', sessionId: 's1', sessionRevision: 7, handoffId: 'h1', handoffVersion: 2, confirmationId: 'c1', confirmationVersion: 3 });
    vi.mocked(getConfirmedBrief).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ source: 'portfolio_entry', sessionId: 's1', revision: 7, handoffId: 'h1', handoffVersion: 2, confirmationId: 'c1', confirmationVersion: 3, brief: { handoff: { desired_outcome: 'Goal' }, confirmation: { status: 'CONFIRMED', acceptedFields: ['desired_outcome'], correctedFields: {}, rejectedFields: [] } } });
    render(<PortfolioLeadFirstValuePage />);
    expect(screen.queryByLabelText(/qué quieres conseguir/i)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(screen.getByLabelText(/qué quieres conseguir/i)).toHaveValue('Goal'));
    expect(getConfirmedBrief).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, /inicia sesión de nuevo/i],
    [404, /no está disponible/i],
    [409, /quedó desactualizada/i],
    [410, /fue abandonada o venció/i],
  ])('expone D1 %s sin fallback y conserva la identidad exacta para retry', async (status, message) => {
    const identity = { source: 'portfolio_entry' as const, sessionId: 's1', sessionRevision: 7, handoffId: 'h1', handoffVersion: 2, confirmationId: 'c1', confirmationVersion: 3 };
    vi.mocked(readClaimedPortfolioEntryBriefIdentity).mockReturnValue(identity);
    vi.mocked(getConfirmedBrief).mockRejectedValueOnce({ response: { status } }).mockResolvedValueOnce({ source: 'portfolio_entry', sessionId: 's1', revision: 7, handoffId: 'h1', handoffVersion: 2, confirmationId: 'c1', confirmationVersion: 3, brief: { rawEntry: 'must not appear', handoff: { desired_outcome: 'Confirmed goal' }, confirmation: { status: 'CONFIRMED', acceptedFields: ['desired_outcome'], correctedFields: {}, rejectedFields: [] } } });
    render(<PortfolioLeadFirstValuePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByLabelText(/qué quieres conseguir/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(screen.getByLabelText(/qué quieres conseguir/i)).toHaveValue('Confirmed goal'));
    expect(getConfirmedBrief).toHaveBeenNthCalledWith(1, identity);
    expect(getConfirmedBrief).toHaveBeenNthCalledWith(2, identity);
    expect(screen.queryByText('must not appear')).not.toBeInTheDocument();
  });

  it('FV-05/06: P2 es un checkpoint y ajustar su lista conserva el P1 confirmado', () => {
    confirmP1AndP2();
    fireEvent.click(screen.getByRole('button', { name: /ajustar lista/i }));
    expect(screen.getByTestId('p1-confirmed-summary')).toHaveTextContent('Aumentar ventas B2B en Q4');
    expect(screen.getByLabelText(/trabajo existente/i)).toHaveValue('Pricing Pilot\nCheckout Optimizer\nCRM Follow-up');
  });

  it('FV-07/08: no solicita análisis antes de confirmar P2 y llama P3 tras esa confirmación', async () => {
    installResult(['Pricing Pilot']);
    confirmP1AndP2(['Pricing Pilot']);
    expect(analyzeFirstValueP3).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    await waitFor(() => expect(analyzeFirstValueP3).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(analyzeFirstValueP3).mock.calls[0][0];
    expect(payload).toMatchObject({
      p2Confirmed: true, goal: 'Aumentar ventas B2B en Q4', context: 'Mercado europeo',
      initiatives: [{ itemId: expect.any(String), name: 'Pricing Pilot' }],
    });
    expect(Object.keys(payload).sort()).toEqual(['context', 'goal', 'initiatives', 'p2Confirmed', 'requestId', 'sessionId']);
  });

  it('envía las correcciones compartidas de P2 como contexto confirmado, sin atribuirlas a cada iniciativa', async () => {
    installResult(['Pricing Pilot']);
    startP1();
    fireEvent.click(screen.getByRole('button', { name: /está bien, continuar/i }));
    fireEvent.change(screen.getByLabelText(/trabajo existente/i), { target: { value: 'Pricing Pilot' } });
    fireEvent.change(screen.getByLabelText(/correcciones o contexto del trabajo/i), { target: { value: 'El sponsor confirmó que se centra en retención.' } });
    fireEvent.click(screen.getByRole('button', { name: /mostrar trabajo detectado/i }));
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    await waitFor(() => expect(analyzeFirstValueP3).toHaveBeenCalledTimes(1));
    expect(vi.mocked(analyzeFirstValueP3).mock.calls[0][0]).toMatchObject({
      context: 'Mercado europeo\nEl sponsor confirmó que se centra en retención.',
      initiatives: [{ itemId: 'item-1', name: 'Pricing Pilot' }],
    });
    expect(vi.mocked(analyzeFirstValueP3).mock.calls[0][0].initiatives[0]).not.toHaveProperty('description');
  });

  it('FV-09: muestra estado processing mientras espera P3', async () => {
    vi.mocked(analyzeFirstValueP3).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return resultFor([{ itemId: 'item-1', name: 'Pricing Pilot' }]) as never;
    });
    confirmP1AndP2(['Pricing Pilot']);
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/analizando/i);
    await screen.findByTestId('p3-result');
  });

  it('FV-10/11: error preserva P1/P2 y retry conserva la sesión', async () => {
    vi.mocked(analyzeFirstValueP3).mockRejectedValueOnce(new Error('P3 no disponible')).mockResolvedValueOnce(resultFor([{ itemId: 'item-1', name: 'Pricing Pilot' }]) as never);
    confirmP1AndP2(['Pricing Pilot']);
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo analizar/i);
    expect(screen.getByTestId('p1-confirmed-summary')).toHaveTextContent('Aumentar ventas B2B en Q4');
    expect(screen.getByTestId('p2-confirmed-summary')).toHaveTextContent('Pricing Pilot');
    fireEvent.click(screen.getByRole('button', { name: /intentar de nuevo/i }));
    await screen.findByTestId('p3-result');
    expect(analyzeFirstValueP3).toHaveBeenCalledTimes(2);
    expect(vi.mocked(analyzeFirstValueP3).mock.calls[0][0].sessionId).toBe(vi.mocked(analyzeFirstValueP3).mock.calls[1][0].sessionId);
  });

  it('FV-12: input relevante invalida resultado y no conserva una lectura obsoleta', async () => {
    installResult(['Pricing Pilot']);
    confirmP1AndP2(['Pricing Pilot']);
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    await screen.findByTestId('p3-result');
    fireEvent.click(screen.getByRole('button', { name: /ajustar lista/i }));
    fireEvent.change(screen.getByLabelText(/trabajo existente/i), { target: { value: 'Pricing Pilot\nNuevo CRM' } });
    expect(screen.queryByTestId('p3-result')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/trabajo existente/i)).toHaveValue('Pricing Pilot\nNuevo CRM');
  });

  it('FV-12: descarta una respuesta P3 tardía después de invalidar el análisis', async () => {
    let resolvePending!: (value: Awaited<ReturnType<typeof analyzeFirstValueP3>>) => void;
    let deferredSettled = false;
    const pending = new Promise<Awaited<ReturnType<typeof analyzeFirstValueP3>>>(resolve => {
      resolvePending = value => { deferredSettled = true; resolve(value); };
    });
    vi.mocked(analyzeFirstValueP3).mockReturnValue(pending);
    const view = render(<PortfolioLeadFirstValuePage />);
    try {
      fireEvent.change(screen.getByLabelText(/qué quieres conseguir/i), { target: { value: 'Aumentar ventas B2B en Q4' } });
      fireEvent.change(screen.getByLabelText(/contexto adicional/i), { target: { value: 'Mercado europeo' } });
      fireEvent.click(screen.getByRole('button', { name: /mostrar lo que entendió/i }));
      fireEvent.click(screen.getByRole('button', { name: /está bien, continuar/i }));
      fireEvent.change(screen.getByLabelText(/trabajo existente/i), { target: { value: 'Pricing Pilot' } });
      fireEvent.click(screen.getByRole('button', { name: /mostrar trabajo detectado/i }));
      fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
      expect(analyzeFirstValueP3).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('p3-processing')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /ajustar lista/i }));
      fireEvent.change(screen.getByLabelText(/trabajo existente/i), { target: { value: 'Pricing Pilot\nNuevo CRM' } });
      expect(analyzeFirstValueP3).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolvePending(resultFor([{ itemId: 'item-1', name: 'Pricing Pilot' }]) as never);
        await Promise.resolve();
      });
      expect(screen.queryByTestId('p3-result')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/trabajo existente/i)).toHaveValue('Pricing Pilot\nNuevo CRM');
      expect(screen.getByTestId('p1-confirmed-summary')).toHaveTextContent('Aumentar ventas B2B en Q4');
      expect(screen.queryByTestId('p3-processing')).not.toBeInTheDocument();
    } finally {
      if (!deferredSettled) {
        await act(async () => {
          resolvePending(resultFor([{ itemId: 'item-1', name: 'Pricing Pilot' }]) as never);
          await Promise.resolve();
        });
      }
      view.unmount();
      vi.restoreAllMocks();
      vi.clearAllMocks();
    }
  });

  it('FV-13/14: la aclaración agrupada nombra varias iniciativas y acepta una respuesta común', async () => {
    installResult(['Pricing Pilot', 'Checkout Optimizer', 'CRM Follow-up']);
    confirmP1AndP2();
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    const question = await screen.findByTestId('p3-clarification-question-1');
    expect(question).toHaveTextContent('Checkout Optimizer');
    expect(question).toHaveTextContent('CRM Follow-up');
    fireEvent.change(within(question).getByRole('textbox'), { target: { value: 'Todas apoyan la adquisición B2B.' } });
    fireEvent.click(within(question).getByRole('button', { name: /guardar aclaración/i }));
    await waitFor(() => expect(analyzeFirstValueP3).toHaveBeenCalledTimes(2));
    expect(vi.mocked(analyzeFirstValueP3).mock.calls[1][0].clarifications).toEqual([
      expect.objectContaining({ affectedItemIds: [vi.mocked(analyzeFirstValueP3).mock.calls[0][0].initiatives[1].itemId, vi.mocked(analyzeFirstValueP3).mock.calls[0][0].initiatives[2].itemId], answer: 'Todas apoyan la adquisición B2B.' }),
    ]);
  });

  it('FV-15/16/17: prioriza excepciones, colapsa portafolios grandes y no exige revisar relaciones claras', async () => {
    const work = Array.from({ length: 24 }, (_, index) => `Iniciativa ${index + 1}`);
    installResult(work);
    confirmP1AndP2(work);
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    const result = await screen.findByTestId('p3-result');
    expect(within(result).getByTestId('p3-exception-summary')).toBeInTheDocument();
    expect(within(result).getAllByTestId(/p3-exception-item-/)).toHaveLength(23);
    expect(within(result).queryByTestId('p3-all-initiatives-full-list')).not.toBeInTheDocument();
    expect(within(result).queryByRole('button', { name: /confirmar iniciativa 1/i })).not.toBeInTheDocument();
    expect(within(result).getByText('Contribuyen directamente')).toBeInTheDocument();
  });

  it('FV-18/19: confirmación global valida solo lectura provisional y no ejecuta otra operación', async () => {
    installResult(['Pricing Pilot']);
    confirmP1AndP2(['Pricing Pilot']);
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    await screen.findByTestId('p3-result');
    fireEvent.click(screen.getByRole('button', { name: /confirmar esta lectura/i }));
    expect(screen.getByTestId('global-reading-confirmed')).toHaveTextContent(/confirmado por ti/i);
    expect(analyzeFirstValueP3).toHaveBeenCalledTimes(1);
  });

  it('permite continuar sin responder una aclaración y confirma solo la lectura provisional', async () => {
    installResult(['Pricing Pilot', 'Checkout Optimizer']);
    confirmP1AndP2(['Pricing Pilot', 'Checkout Optimizer']);
    fireEvent.click(screen.getByRole('button', { name: /sí, esto representa mi trabajo/i }));
    await screen.findByTestId('p3-clarification-question-1');
    fireEvent.click(screen.getByRole('button', { name: /continuar sin responder/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar esta lectura/i }));
    expect(screen.getByTestId('global-reading-confirmed')).toBeInTheDocument();
    expect(analyzeFirstValueP3).toHaveBeenCalledTimes(1);
  });

  it('FV-20/21/22: exige submit explícito y no presenta score, fixture ni datos D1', () => {
    render(<PortfolioLeadFirstValuePage />);
    expect(screen.queryByTestId('use-novagrowth-fixture')).not.toBeInTheDocument();
    expect(screen.queryByText(/alignment score|reasignación automática/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/restaurar contexto de Portfolio Entry/i)).not.toBeInTheDocument();
    expect(analyzeFirstValueP3).not.toHaveBeenCalled();
  });
});
