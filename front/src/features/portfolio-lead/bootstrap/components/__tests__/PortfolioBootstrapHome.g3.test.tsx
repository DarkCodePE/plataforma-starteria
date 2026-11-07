import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../../../tests/setup-jsdom';
import { makeBootstrap, makeBootstrapWithProposedMutations } from '../../testing/bootstrapFixtures';
import { PortfolioBootstrapHome } from '../PortfolioBootstrapHome';

function props(overrides: Record<string, unknown> = {}) {
  return {
    data: makeBootstrap('anchor_confirmed'),
    status: 'ready' as const,
    error: null,
    onRetry: vi.fn(),
    onUpdateAnchor: vi.fn().mockResolvedValue(undefined),
    onConfirmAnchor: vi.fn().mockResolvedValue(undefined),
    onPasteWorkItems: vi.fn().mockResolvedValue(undefined),
    onUploadImportFile: vi.fn().mockResolvedValue(undefined),
    onCommitImportBatch: vi.fn().mockResolvedValue(undefined),
    onAddManualWorkItem: vi.fn().mockResolvedValue(undefined),
    onDeclareNoExistingWork: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkItem: vi.fn().mockResolvedValue(undefined),
    onRemoveWorkItem: vi.fn().mockResolvedValue(undefined),
    onAnalyzeWorkItems: vi.fn().mockResolvedValue(undefined),
    onConfirmProposedMutation: vi.fn().mockResolvedValue(undefined),
    onReopenProposedMutationReview: vi.fn().mockResolvedValue(undefined),
    onCorrectProposedMutation: vi.fn().mockResolvedValue(undefined),
    onRejectProposedMutation: vi.fn().mockResolvedValue(undefined),
    onLeaveProposedMutationPending: vi.fn().mockResolvedValue(undefined),
    onPublishFirstReading: vi.fn().mockResolvedValue(undefined),
    analysisStatus: 'idle' as const,
    analysisError: null,
    publishStatus: 'idle' as const,
    publishError: null,
    importStatus: 'idle' as const,
    importError: null,
    activeImport: null,
    ...overrides,
  };
}

function dataWithInitiatives(count: number) {
  const data = makeBootstrapWithProposedMutations();
  const seed = data.workItems[0];
  data.workItems = Array.from({ length: count }, (_, index) => ({
    ...seed,
    id: `g3-work-${index + 1}`,
    rawLabel: `Iniciativa G3 ${index + 1}`,
    proposedName: `Iniciativa G3 ${index + 1}`,
    sourceRefs: { sourceType: 'pasted_text', rawInput: `Iniciativa G3 ${index + 1}` },
  }));
  data.strategicConnections = data.workItems.map((item, index) => ({
    id: `g3-connection-${index + 1}`,
    bootstrapSessionId: data.bootstrapSession.id,
    workItemId: item.id,
    anchorId: data.anchor!.id,
    sourceMutationId: `g3-mutation-${index + 1}`,
    status: 'confirmed_alignment' as const,
    rationale: 'Relación confirmada por el Portfolio Lead.',
    provenanceStatus: 'user_confirmed' as const,
    sourceRefs: { source: 'g3-fixture' },
    confirmedBy: 'user-1',
    confirmedAt: '2026-11-07T09:00:00.000Z',
    createdAt: '2026-11-07T09:00:00.000Z',
    updatedAt: '2026-11-07T09:00:00.000Z',
  }));
  return data;
}

function proposalFor(data: ReturnType<typeof dataWithInitiatives>, placements: {
  related: string[];
  crossCutting?: string[];
  outside?: string[];
  ungrouped?: string[];
}) {
  return {
    id: 'g3-proposal',
    version: 4,
    status: 'reviewed',
    sourceVersion: 'g3-source-v4',
    sourceRefs: [],
    provenance: { reviewAuthority: 'PORTFOLIO_LEAD' },
    reviewedBy: 'user-1',
    reviewedAt: '2026-11-07T09:00:00.000Z',
    materialization: null,
    payload: {
      summary: `Organización revisable de ${data.workItems.length} iniciativas.`,
      fronts: [{
        candidateId: 'g3-front-1',
        name: 'Adopción sostenible',
        focus: 'Reducir abandono en onboarding B2B',
        rationale: 'Un único resultado empresarial organiza este setup inicial.',
        coverage: `${placements.related.length} de ${data.workItems.length} iniciativas revisadas`,
        challenges: [{
          candidateId: 'g3-challenge-1',
          title: 'Reducir barreras de activación',
          problem: 'No sabemos qué fricciones explican el abandono.',
          rationale: 'Permite decidir qué barrera atender primero.',
          relatedInitiativeIds: placements.related,
          evidence: ['Revisión del Portfolio Lead'],
          gaps: ['Falta comparar cohortes'],
          overlaps: [],
        }],
      }],
      crossCuttingInitiativeIds: placements.crossCutting ?? [],
      outsideObjectiveInitiativeIds: placements.outside ?? [],
      ungroupedInitiativeIds: placements.ungrouped ?? [],
    },
  };
}

describe('KAN-223 G3 — matrix 0/1/3/25 and selective Briefs', () => {
  beforeEach(() => {
    server.use(http.get('/api/v1/portfolio-bootstrap/sessions/:sessionId/e5-eligibility', () => HttpResponse.json({
      success: true,
      data: { allowed: true, reasonCodes: ['ANALYZED_WORK_ELIGIBLE'], blockers: [], snapshotVersion: 'g3-eligibility-v1' },
    })));
    server.use(http.get('/api/v1/portfolio/challenges/:challengeId/activation-briefs', () => HttpResponse.json({ success: true, data: [] })));
  });

  it('CA-G3-00: 0 iniciativas reaches one reviewable front without inventing WorkItems or AnalysisRun, while E6 remains closed', async () => {
    const data = makeBootstrap('anchor_confirmed');
    data.bootstrapSession.status = 'awaiting_structuring';
    data.bootstrapSession.bootstrapPhase = 'B3_PROVISIONAL_STRUCTURING';
    data.bootstrapSession.existingWorkStatus = 'no_existing_work';
    const input = props({ data });

    render(<PortfolioBootstrapHome {...input as any} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar sin iniciativas' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sin iniciativas' }));

    expect(screen.getAllByText('FRENTE ESTRATÉGICO PROPUESTO')).toHaveLength(1);
    expect(screen.getAllByText('RETO PROPUESTO')).toHaveLength(1);
    expect(screen.getAllByText('0 iniciativas', { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /6 Briefs/i })).toBeDisabled();
    expect(input.onAnalyzeWorkItems).not.toHaveBeenCalled();
    expect(data.workItems).toHaveLength(0);
    expect(data.latestAnalysisRun).toBeNull();
  });

  it('CA-G3-01: 1 iniciativa proposes one initial front and one pertinent challenge without redundant hierarchy', async () => {
    const data = dataWithInitiatives(1);
    render(<PortfolioBootstrapHome {...props({ data }) as any} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar a organización' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a organización' }));

    expect(screen.getAllByText('FRENTE ESTRATÉGICO PROPUESTO')).toHaveLength(1);
    expect(screen.getAllByText('RETO PROPUESTO')).toHaveLength(1);
    expect(screen.getByTestId('portfolio-organization-cascade')).toHaveTextContent('Iniciativa G3 1');
    expect(screen.getByText('1 iniciativa', { exact: true })).toBeInTheDocument();
  });

  it('CA-G3-03: 3 iniciativas preserve related, cross-cutting and outside placements through human review', async () => {
    const data = dataWithInitiatives(3);
    const organizationProposal = proposalFor(data, {
      related: ['g3-work-1'],
      crossCutting: ['g3-work-2'],
      outside: ['g3-work-3'],
    });
    const save = vi.fn().mockResolvedValue({ ...organizationProposal, version: 5 });
    render(<PortfolioBootstrapHome {...props({ data, organizationProposal, onSaveOrganizationProposal: save, onConfirmOrganizationProposal: vi.fn() }) as any} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar a organización' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a organización' }));

    expect(screen.getByTestId('portfolio-organization-cascade')).toHaveTextContent('Iniciativa G3 1');
    expect(within(screen.getByRole('heading', { name: 'Apoyo transversal' }).closest('section')!).getByText('Iniciativa G3 2')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Fuera del objetivo actual' }).closest('section')!).getByText('Iniciativa G3 3')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Editar frente estratégico'));
    fireEvent.change(screen.getByLabelText('Nombre del frente estratégico'), { target: { value: 'Adopción sostenible revisada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar después' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      version: 4,
      payload: expect.objectContaining({
        crossCuttingInitiativeIds: ['g3-work-2'],
        outsideObjectiveInitiativeIds: ['g3-work-3'],
      }),
    })));
  });

  it('CA-G3-25: 25 registros keep one initial front and expose one selective Brief action without mass creation', async () => {
    const data = dataWithInitiatives(25);
    const reviewed = proposalFor(data, {
      related: data.workItems.slice(0, 20).map((item) => item.id),
      crossCutting: data.workItems.slice(20, 22).map((item) => item.id),
      outside: data.workItems.slice(22, 24).map((item) => item.id),
      ungrouped: [data.workItems[24].id],
    });
    const organizationProposal = {
      ...reviewed,
      status: 'materialized',
      materialization: {
        id: 'g3-materialization-25',
        proposalVersion: reviewed.version,
        canonicalMappings: {
          fronts: [{ candidateId: 'g3-front-1', canonicalId: 'canonical-front-g3' }],
          challenges: [{ candidateId: 'g3-challenge-1', canonicalId: 'canonical-challenge-g3', relatedInitiativeIds: reviewed.payload.fronts[0].challenges[0].relatedInitiativeIds }],
          specialDestinations: {
            crossCuttingInitiativeIds: reviewed.payload.crossCuttingInitiativeIds,
            outsideObjectiveInitiativeIds: reviewed.payload.outsideObjectiveInitiativeIds,
            ungroupedInitiativeIds: reviewed.payload.ungroupedInitiativeIds,
          },
        },
        confirmedBy: 'user-1',
        confirmedAt: '2026-11-07T09:10:00.000Z',
      },
    };
    let listCalls = 0;
    let createCalls = 0;
    server.use(
      http.get('/api/v1/portfolio/challenges/canonical-challenge-g3/activation-briefs', () => {
        listCalls += 1;
        return HttpResponse.json({ success: true, data: [] });
      }),
      http.post('/api/v1/portfolio/challenges/canonical-challenge-g3/activation-briefs', () => {
        createCalls += 1;
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    render(<PortfolioBootstrapHome {...props({ data, organizationProposal }) as any} />);

    expect(await screen.findByText('Todavía no preparaste un Brief para este reto.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Preparar primer Brief' })).toHaveLength(1);
    expect(screen.getByText(/25 registros de trabajo siguen disponibles como contexto/)).toBeInTheDocument();
    expect(listCalls).toBe(1);
    expect(createCalls).toBe(0);
  });
});
