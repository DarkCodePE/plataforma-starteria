import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortfolioBootstrap } from '../usePortfolioBootstrap';
import { makeBootstrap } from '../../testing/bootstrapFixtures';

const createOrReuse = vi.fn();
const createDirect = vi.fn();
const getCurrent = vi.fn();
const createFromPortfolioSetup = vi.fn();
const getSession = vi.fn();
const updateAnchor = vi.fn();
const confirmAnchor = vi.fn();
const pasteWorkItems = vi.fn();
const addManualWorkItem = vi.fn();
const declareNoExistingWork = vi.fn();
const updateWorkItem = vi.fn();
const removeWorkItem = vi.fn();
const analyzeWork = vi.fn();
const confirmMutation = vi.fn();
const correctMutation = vi.fn();
const rejectMutation = vi.fn();
const leavePendingMutation = vi.fn();
const publishReading = vi.fn();
const getOrganizationProposal = vi.fn();
const saveOrganizationProposal = vi.fn();
const confirmOrganizationProposal = vi.fn();

vi.mock('../../services/portfolioBootstrapClient', () => ({
  createOrReuseDirectPortfolioBootstrapSession: (...args: unknown[]) => createDirect(...args),
  getCurrentPortfolioBootstrapSession: (...args: unknown[]) => getCurrent(...args),
  createOrReusePortfolioBootstrapSession: (...args: unknown[]) => createOrReuse(...args),
  createOrReusePortfolioSetupBootstrapSession: (...args: unknown[]) => createFromPortfolioSetup(...args),
  getPortfolioBootstrapSession: (...args: unknown[]) => getSession(...args),
  updatePortfolioBootstrapAnchor: (...args: unknown[]) => updateAnchor(...args),
  confirmPortfolioBootstrapAnchor: (...args: unknown[]) => confirmAnchor(...args),
  pastePortfolioBootstrapWorkItems: (...args: unknown[]) => pasteWorkItems(...args),
  addManualPortfolioBootstrapWorkItem: (...args: unknown[]) => addManualWorkItem(...args),
  declareNoExistingPortfolioBootstrapWork: (...args: unknown[]) => declareNoExistingWork(...args),
  updatePortfolioBootstrapWorkItem: (...args: unknown[]) => updateWorkItem(...args),
  removePortfolioBootstrapWorkItem: (...args: unknown[]) => removeWorkItem(...args),
  analyzePortfolioBootstrapWork: (...args: unknown[]) => analyzeWork(...args),
  confirmPortfolioBootstrapProposedMutation: (...args: unknown[]) => confirmMutation(...args),
  correctPortfolioBootstrapProposedMutation: (...args: unknown[]) => correctMutation(...args),
  rejectPortfolioBootstrapProposedMutation: (...args: unknown[]) => rejectMutation(...args),
  leavePortfolioBootstrapProposedMutationPending: (...args: unknown[]) => leavePendingMutation(...args),
  publishPortfolioBootstrapFirstReading: (...args: unknown[]) => publishReading(...args),
  getPortfolioOrganizationProposal: (...args: unknown[]) => getOrganizationProposal(...args),
  savePortfolioOrganizationProposal: (...args: unknown[]) => saveOrganizationProposal(...args),
  confirmPortfolioOrganizationProposal: (...args: unknown[]) => confirmOrganizationProposal(...args),
  PortfolioBootstrapClientError: class PortfolioBootstrapClientError extends Error {
    apiError = { message: this.message };
  },
}));

describe('usePortfolioBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDirect.mockResolvedValue(makeBootstrap('anchor_insufficient'));
    getCurrent.mockResolvedValue(makeBootstrap('anchor_confirmed'));
    createOrReuse.mockResolvedValue(makeBootstrap('anchor_sufficient'));
    createFromPortfolioSetup.mockResolvedValue(makeBootstrap('anchor_provisional'));
    getSession.mockResolvedValue(makeBootstrap('anchor_sufficient'));
    updateAnchor.mockResolvedValue(makeBootstrap('anchor_sufficient'));
    confirmAnchor.mockResolvedValue(makeBootstrap('anchor_confirmed'));
    pasteWorkItems.mockResolvedValue({
      sessionId: 'bs-1',
      existingWorkStatus: 'has_work',
      items: [{
        id: 'wi-1',
        bootstrapSessionId: 'bs-1',
        rawLabel: 'Nuevo onboarding digital',
        proposedName: 'Nuevo onboarding digital',
        proposedPurpose: null,
        sourceType: 'pasted_text',
        status: 'detected',
        currentStateHint: null,
        ownerCandidate: null,
        sourceRefs: {},
        createdBy: 'user-1',
        createdAt: '2026-09-14T10:01:00.000Z',
        updatedAt: '2026-09-14T10:01:00.000Z',
      }],
    });
    addManualWorkItem.mockResolvedValue({ sessionId: 'bs-1', existingWorkStatus: 'has_work', items: [] });
    declareNoExistingWork.mockResolvedValue({ sessionId: 'bs-1', existingWorkStatus: 'no_existing_work', items: [] });
    updateWorkItem.mockResolvedValue({ sessionId: 'bs-1', existingWorkStatus: 'has_work', items: [] });
    removeWorkItem.mockResolvedValue({ sessionId: 'bs-1', existingWorkStatus: 'has_work', items: [] });
    analyzeWork.mockResolvedValue({
      analysisRunId: 'run-1',
      proposedMutations: [],
      homeState: 'HOME_C',
    });
    confirmMutation.mockResolvedValue({});
    correctMutation.mockResolvedValue({});
    rejectMutation.mockResolvedValue({});
    leavePendingMutation.mockResolvedValue({});
    publishReading.mockResolvedValue({ reading: { id: 'reading-1' }, homeState: 'HOME_E' });
    getOrganizationProposal.mockResolvedValue(null);
  });

  it('creates or reuses BootstrapSession from continuation and survives remount reload', async () => {
    const first = renderHook(() => usePortfolioBootstrap('cont-1'));

    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const sessionId = first.result.current.data?.bootstrapSession.id;
    first.unmount();

    const second = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));

    expect(createOrReuse).toHaveBeenCalledTimes(2);
    expect(createOrReuse).toHaveBeenNthCalledWith(1, 'cont-1');
    expect(createOrReuse).toHaveBeenNthCalledWith(2, 'cont-1');
    expect(second.result.current.data?.bootstrapSession.id).toBe(sessionId);
  });

  it('opens a direct Bootstrap session for normal Portfolio Lead entry without a continuation query', async () => {
    const hook = renderHook(() => usePortfolioBootstrap(null, 'legacy', 'direct'));

    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(createDirect).toHaveBeenCalledOnce();
    expect(createOrReuse).not.toHaveBeenCalled();
  });

  it('resumes an existing workspace without creating a direct Bootstrap session', async () => {
    const hook = renderHook(() => usePortfolioBootstrap(null, 'legacy', 'resume'));

    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(getCurrent).toHaveBeenCalledOnce();
    expect(createDirect).not.toHaveBeenCalled();
  });

  it('creates the first direct workspace only when resume finds no materialized context', async () => {
    getCurrent.mockResolvedValueOnce(null);
    const hook = renderHook(() => usePortfolioBootstrap(null, 'legacy', 'resume'));

    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(getCurrent).toHaveBeenCalledOnce();
    expect(createDirect).toHaveBeenCalledOnce();
    expect(hook.result.current.data?.anchor?.status).toBe('anchor_insufficient');
  });

  it('loads the exact contextual session selected for an additional front', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('second-front-session', 'legacy', 'session'));

    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(getSession).toHaveBeenCalledWith('second-front-session');
    expect(createDirect).not.toHaveBeenCalled();
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('114F uses only the dedicated create/reuse path and revalidates on retry', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('snapshot-114f', '114F'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(createFromPortfolioSetup).toHaveBeenCalledWith('snapshot-114f');
    expect(createOrReuse).not.toHaveBeenCalled();
    await act(async () => { await hook.result.current.retry(); });
    expect(createFromPortfolioSetup).toHaveBeenCalledTimes(2);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('save updates anchor without confirming', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => {
      await hook.result.current.updateAnchor({ outcomeStatement: 'Reducir abandono corregido' });
    });

    expect(updateAnchor).toHaveBeenCalledWith('bs-1', { outcomeStatement: 'Reducir abandono corregido' });
    expect(confirmAnchor).not.toHaveBeenCalled();
  });

  it('explicit confirm waits for server response before replacing state', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => {
      await hook.result.current.confirmAnchor();
    });

    expect(confirmAnchor).toHaveBeenCalledWith('bs-1');
    expect(hook.result.current.data?.anchor?.status).toBe('anchor_confirmed');
  });

  it('persists pasted work into Bootstrap state after server response', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => {
      await hook.result.current.pasteWorkItems('Nuevo onboarding digital');
    });

    expect(pasteWorkItems).toHaveBeenCalledWith('bs-1', 'Nuevo onboarding digital');
    expect(hook.result.current.data?.bootstrapSession.existingWorkStatus).toBe('has_work');
    expect(hook.result.current.data?.bootstrapSession.bootstrapPhase).toBe('B3_PROVISIONAL_STRUCTURING');
    expect(hook.result.current.data?.workItems).toHaveLength(1);
  });

  it('persists explicit no-existing-work state after server response', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => {
      await hook.result.current.declareNoExistingWork();
    });

    expect(declareNoExistingWork).toHaveBeenCalledWith('bs-1');
    expect(hook.result.current.data?.bootstrapSession.existingWorkStatus).toBe('no_existing_work');
    expect(hook.result.current.data?.workItems).toHaveLength(0);
  });

  it('runs analysis and reloads persisted B4 session state', async () => {
    getSession.mockResolvedValueOnce({
      ...makeBootstrap('anchor_confirmed'),
      bootstrapSession: {
        ...makeBootstrap('anchor_confirmed').bootstrapSession,
        status: 'awaiting_material_review',
        bootstrapPhase: 'B4_MATERIAL_REVIEW',
        existingWorkStatus: 'has_work',
      },
      proposedMutations: [{
        id: 'pm-1',
        bootstrapSessionId: 'bs-1',
        analysisRunId: 'run-1',
        targetType: 'strategic_connection',
        targetId: 'wi-1',
        mutationType: 'create',
        currentValue: null,
        originalProposedValue: null,
        proposedValue: { status: 'alignment_unknown' },
        rationale: 'Pendiente',
        reviewNote: null,
        sourceRefs: {},
        provenanceStatus: 'ai_suggested',
        uncertainty: 'high',
        materiality: 'material',
        confirmationRequired: true,
        status: 'proposed',
        reviewedBy: null,
        reviewedAt: null,
        correctedBy: null,
        correctedAt: null,
        createdAt: '2026-09-14T10:02:00.000Z',
        updatedAt: '2026-09-14T10:02:00.000Z',
      }],
      latestAnalysisRun: {
        id: 'run-1',
        bootstrapSessionId: 'bs-1',
        status: 'completed',
        analyzerMode: 'deterministic',
        inputVersion: 'input-v1',
        outputVersion: 'portfolio-bootstrap-analysis-output-v0.1',
        error: null,
        createdBy: 'user-1',
        createdAt: '2026-09-14T10:02:00.000Z',
        completedAt: '2026-09-14T10:02:01.000Z',
      },
      strategicConnections: [],
      advancementConditions: [],
      latestReading: null,
    });
    const hook = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => {
      await hook.result.current.analyzeWorkItems();
    });

    expect(analyzeWork).toHaveBeenCalledWith('bs-1');
    expect(hook.result.current.data?.bootstrapSession.bootstrapPhase).toBe('B4_MATERIAL_REVIEW');
    expect(hook.result.current.data?.proposedMutations).toHaveLength(1);
    expect(hook.result.current.analysisStatus).toBe('idle');
  });

  it('reviews proposed mutations through explicit B4 actions and reloads', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => {
      await hook.result.current.confirmProposedMutation('pm-1');
      await hook.result.current.correctProposedMutation('pm-2', { status: 'partial_alignment' }, 'Ajuste humano');
      await hook.result.current.rejectProposedMutation('pm-3');
      await hook.result.current.leaveProposedMutationPending('pm-4');
    });

    expect(confirmMutation).toHaveBeenCalledWith('bs-1', 'pm-1');
    expect(correctMutation).toHaveBeenCalledWith('bs-1', 'pm-2', { status: 'partial_alignment' }, 'Ajuste humano');
    expect(rejectMutation).toHaveBeenCalledWith('bs-1', 'pm-3', undefined);
    expect(leavePendingMutation).toHaveBeenCalledWith('bs-1', 'pm-4', undefined);
    expect(getSession).toHaveBeenCalledTimes(4);
  });

  it('publishes first reading and reloads B5 published state', async () => {
    const hook = renderHook(() => usePortfolioBootstrap('cont-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => {
      await hook.result.current.publishFirstReading();
    });

    expect(publishReading).toHaveBeenCalledWith('bs-1');
    expect(getSession).toHaveBeenCalledOnce();
    expect(hook.result.current.publishStatus).toBe('idle');
  });
});
