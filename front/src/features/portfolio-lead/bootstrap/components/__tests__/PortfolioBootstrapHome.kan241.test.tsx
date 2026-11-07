import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioBootstrapHome } from '../PortfolioBootstrapHome';
import { makeBootstrap } from '../../testing/bootstrapFixtures';
import {
  createEmptyPortfolioBootstrapContext,
  type PortfolioBootstrapContextReview,
} from '../../services/portfolioBootstrapContextClient';

function confirmedContextReview(): PortfolioBootstrapContextReview {
  const context = {
    ...createEmptyPortfolioBootstrapContext(),
    situation: {
      value: 'Somos una cafetería y queremos probar desayunos para llevar para oficinas cercanas.',
      provenance: 'user_declared' as const,
      sourceRef: { kind: 'user_input' as const },
    },
    gaps: [
      'context-disposition:area:not_applicable',
      'context-disposition:stakeholder:unknown',
      'context-disposition:pilotExperience:not_applicable',
    ],
  };
  return {
    id: 'review-kan241',
    sessionId: 'bs-1',
    status: 'confirmed',
    version: 4,
    draft: context,
    confirmedSnapshot: context,
    effectiveContext: context,
    hasPendingCorrection: false,
    sourceCompanyContext: null,
    draftSourceCompanyContext: null,
    confirmedSourceCompanyContext: null,
    effectiveSourceCompanyContext: null,
    draftProvenance: [],
    confirmedProvenance: [],
    effectiveProvenance: [],
    sourceOutdated: false,
    confirmedBy: 'user-1',
    confirmedAt: '2026-11-07T12:00:00.000Z',
    createdAt: '2026-11-07T11:00:00.000Z',
    updatedAt: '2026-11-07T12:00:00.000Z',
  };
}

function props(overrides = {}) {
  const data = makeBootstrap('anchor_insufficient');
  data.bootstrapSession.id = 'bs-1';
  data.bootstrapSession.bootstrapPhase = 'B1_ANCHOR';
  data.anchor!.contextSummary = null;
  return {
    data,
    status: 'ready' as const,
    error: null,
    onRetry: vi.fn(),
    onUpdateAnchor: vi.fn().mockResolvedValue(undefined),
    onConfirmAnchor: vi.fn().mockResolvedValue(undefined),
    onPasteWorkItems: vi.fn().mockResolvedValue(undefined),
    onAddManualWorkItem: vi.fn().mockResolvedValue(undefined),
    onDeclareNoExistingWork: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkItem: vi.fn().mockResolvedValue(undefined),
    onRemoveWorkItem: vi.fn().mockResolvedValue(undefined),
    onAnalyzeWorkItems: vi.fn().mockResolvedValue(undefined),
    onConfirmProposedMutation: vi.fn().mockResolvedValue(undefined),
    onCorrectProposedMutation: vi.fn().mockResolvedValue(undefined),
    onRejectProposedMutation: vi.fn().mockResolvedValue(undefined),
    onLeaveProposedMutationPending: vi.fn().mockResolvedValue(undefined),
    onPublishFirstReading: vi.fn().mockResolvedValue(undefined),
    contextReview: confirmedContextReview(),
    contextStatus: 'ready' as const,
    contextError: null,
    onSaveContextDraft: vi.fn().mockResolvedValue(undefined),
    onConfirmContext: vi.fn().mockResolvedValue(undefined),
    onRetryContext: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('KAN-241 explicit E1 → E2 → E3 navigation', () => {
  it('CA06 keeps a direct session in E1 when it only has an unconfirmed anchor summary', () => {
    const input = props({ contextReview: null });
    input.data.sourceContinuation = null;
    input.data.bootstrapSession.sourceContinuationId = null;
    input.data.anchor!.status = 'anchor_sufficient';
    input.data.anchor!.contextSummary = 'Resumen heredado que todavía no fue confirmado en G1.';

    render(<PortfolioBootstrapHome {...input} />);

    expect(screen.getByTestId('portfolio-context-conversation')).toBeVisible();
    expect(screen.queryByTestId('portfolio-objective-conversation')).not.toBeInTheDocument();
  });

  it('CA09 preserves the objective step for an authenticated legacy continuation without a G1 review', () => {
    const input = props({ contextReview: null });
    input.data.anchor!.status = 'anchor_sufficient';
    input.data.anchor!.contextSummary = 'Contexto ya capturado por la continuación histórica.';

    render(<PortfolioBootstrapHome {...input} />);

    expect(screen.getByTestId('portfolio-objective-conversation')).toBeVisible();
    expect(screen.getByRole('button', { name: /Confirmar este punto de partida y continuar/i })).toBeEnabled();
  });

  it('CA06 derives real progress from confirmed E1 and labels retrospective review separately', async () => {
    const user = userEvent.setup();
    render(<PortfolioBootstrapHome {...props()} />);

    expect(screen.getByText('Configurar con Copilot · 2 de 7')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-objective-conversation')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Contexto Revisado o completado/i }));

    expect(screen.getByText('Revisando Contexto (Paso 1) · avance confirmado 2 de 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /3 Incorporación/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Estoy de acuerdo, continuar al objetivo' }));
    expect(screen.getByTestId('portfolio-objective-conversation')).toBeVisible();
  });

  it('CA06 exposes E3 only after the persisted E2 confirmation and keeps the explicit continuation', async () => {
    const user = userEvent.setup();
    const onConfirmAnchor = vi.fn().mockResolvedValue(undefined);
    const initial = props({ onConfirmAnchor });
    initial.data.anchor!.contextSummary = 'Contexto confirmado de la cafetería.';
    initial.data.anchor!.outcomeStatement = 'Validar desayunos para llevar sin ampliar el local.';
    initial.data.anchor!.decisionToEnable = 'Decidir si probar el servicio con oficinas cercanas.';
    initial.data.anchor!.businessSignalStatus = 'confirmed';
    initial.data.anchor!.businessSignalValue = 'Pedidos de desayuno para llevar.';
    initial.data.anchor!.status = 'anchor_sufficient';
    const { rerender } = render(<PortfolioBootstrapHome {...initial} />);

    await user.click(screen.getByRole('button', { name: /Confirmar este punto de partida y continuar/i }));
    await waitFor(() => expect(onConfirmAnchor).toHaveBeenCalledOnce());

    const confirmed = makeBootstrap('anchor_confirmed');
    confirmed.bootstrapSession.id = 'bs-1';
    rerender(<PortfolioBootstrapHome {...initial} data={confirmed} />);

    expect(screen.getByText('Revisando Objetivo (Paso 2) · avance confirmado 3 de 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar a Incorporación' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Continuar a Incorporación' }));
    expect(screen.getByTestId('portfolio-bootstrap-work-intake')).toBeVisible();
  });
});
