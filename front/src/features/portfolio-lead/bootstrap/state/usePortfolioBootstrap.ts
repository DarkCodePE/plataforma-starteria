import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addManualPortfolioBootstrapWorkItem,
  analyzePortfolioBootstrapWork,
  commitPortfolioBootstrapImport,
  confirmPortfolioBootstrapAnchor,
  confirmPortfolioOrganizationProposal,
  confirmPortfolioBootstrapProposedMutation,
  correctPortfolioBootstrapProposedMutation,
  createOrReuseDirectPortfolioBootstrapSession,
  createOrReusePortfolioBootstrapSession,
  createOrReusePortfolioSetupBootstrapSession,
  declareNoExistingPortfolioBootstrapWork,
  getCurrentPortfolioBootstrapSession,
  getPortfolioBootstrapSession,
  getPortfolioOrganizationProposal,
  leavePortfolioBootstrapProposedMutationPending,
  pastePortfolioBootstrapWorkItems,
  PortfolioBootstrapClientError,
  publishPortfolioBootstrapFirstReading,
  reopenPortfolioBootstrapProposedMutationReview as reopenPortfolioBootstrapProposedMutationReviewClient,
  rejectPortfolioBootstrapProposedMutation,
  removePortfolioBootstrapWorkItem,
  type PortfolioBootstrapResponse,
  type PortfolioBootstrapImportBatch,
  type PortfolioBootstrapImportMapping,
  type ManualPortfolioBootstrapWorkItemInput,
  type PortfolioOrganizationPayload,
  type PortfolioOrganizationProposal,
  type UpdatePortfolioBootstrapAnchorInput,
  type UpdatePortfolioBootstrapWorkItemInput,
  updatePortfolioBootstrapAnchor,
  updatePortfolioBootstrapImportMapping,
  updatePortfolioBootstrapWorkItem,
  uploadPortfolioBootstrapImport,
  savePortfolioOrganizationProposal,
} from '../services/portfolioBootstrapClient';

export type PortfolioBootstrapLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type PortfolioBootstrapAnalysisStatus = 'idle' | 'processing' | 'error';
export type PortfolioBootstrapPublishStatus = 'idle' | 'processing' | 'error';
export type PortfolioBootstrapImportStatus = 'idle' | 'uploading' | 'committing' | 'error';

export function usePortfolioBootstrap(
  portfolioEntryContinuationId: string | null,
  mode: 'legacy' | '114F' = 'legacy',
  entryMode: 'continuation' | 'direct' | 'resume' | 'disabled' = 'continuation',
) {
  const [data, setData] = useState<PortfolioBootstrapResponse | null>(null);
  const [status, setStatus] = useState<PortfolioBootstrapLoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<PortfolioBootstrapAnalysisStatus>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<PortfolioBootstrapPublishStatus>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<PortfolioBootstrapImportStatus>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [activeImport, setActiveImport] = useState<PortfolioBootstrapImportBatch | null>(null);
  const [organizationProposal, setOrganizationProposal] = useState<PortfolioOrganizationProposal | null>(null);
  const [organizationStatus, setOrganizationStatus] = useState<'idle' | 'loading' | 'saving' | 'confirming' | 'error'>('idle');
  const [organizationError, setOrganizationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (entryMode === 'disabled' || (!portfolioEntryContinuationId && entryMode !== 'direct' && entryMode !== 'resume')) {
      setData(null);
      setStatus('idle');
      setError(null);
      setAnalysisStatus('idle');
      setAnalysisError(null);
      setPublishStatus('idle');
      setPublishError(null);
      setImportStatus('idle');
      setImportError(null);
      setActiveImport(null);
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const result = entryMode === 'resume'
        ? await getCurrentPortfolioBootstrapSession()
        : entryMode === 'direct'
        ? data?.bootstrapSession?.id
          ? await getPortfolioBootstrapSession(data.bootstrapSession.id)
          : await createOrReuseDirectPortfolioBootstrapSession()
        : mode === '114F'
        ? await createOrReusePortfolioSetupBootstrapSession(portfolioEntryContinuationId)
        : data?.bootstrapSession?.id
        ? await getPortfolioBootstrapSession(data.bootstrapSession.id)
        : await createOrReusePortfolioBootstrapSession(portfolioEntryContinuationId);
      setData(result);
      setStatus('ready');
    } catch (err) {
      if (mode === '114F') setData(null);
      setStatus('error');
      setError(err instanceof PortfolioBootstrapClientError
        ? err.apiError.message
        : 'No pudimos cargar el Bootstrap de Portfolio.');
    }
  }, [portfolioEntryContinuationId, data?.bootstrapSession?.id, entryMode, mode]);

  useEffect(() => {
    let cancelled = false;
    if (entryMode === 'disabled' || (!portfolioEntryContinuationId && entryMode !== 'direct' && entryMode !== 'resume')) {
      setData(null);
      setStatus('idle');
      setError(null);
      setAnalysisStatus('idle');
      setAnalysisError(null);
      setPublishStatus('idle');
      setPublishError(null);
      setImportStatus('idle');
      setImportError(null);
      setActiveImport(null);
      return () => {
        cancelled = true;
      };
    }

    setStatus('loading');
    setError(null);
    (entryMode === 'resume'
      ? getCurrentPortfolioBootstrapSession()
      : entryMode === 'direct'
      ? createOrReuseDirectPortfolioBootstrapSession()
      : mode === '114F'
        ? createOrReusePortfolioSetupBootstrapSession(portfolioEntryContinuationId!)
        : createOrReusePortfolioBootstrapSession(portfolioEntryContinuationId!))
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (mode === '114F') setData(null);
          setStatus('error');
          setError(err instanceof PortfolioBootstrapClientError
            ? err.apiError.message
            : 'No pudimos cargar el Bootstrap de Portfolio.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [portfolioEntryContinuationId, entryMode, mode]);

  useEffect(() => {
    let cancelled = false;
    const sessionId = data?.bootstrapSession.id;
    if (!sessionId) {
      setOrganizationProposal(null);
      setOrganizationStatus('idle');
      setOrganizationError(null);
      return () => { cancelled = true; };
    }
    setOrganizationStatus('loading');
    getPortfolioOrganizationProposal(sessionId)
      .then((proposal) => {
        if (!cancelled) {
          setOrganizationProposal(proposal);
          setOrganizationStatus('idle');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setOrganizationStatus('error');
          setOrganizationError(err instanceof PortfolioBootstrapClientError ? err.apiError.message : 'No pudimos recuperar la propuesta de organización.');
        }
      });
    return () => { cancelled = true; };
  }, [data?.bootstrapSession.id]);

  const updateAnchor = useCallback(async (input: UpdatePortfolioBootstrapAnchorInput) => {
    if (!data?.bootstrapSession.id) return;
    const result = await updatePortfolioBootstrapAnchor(data.bootstrapSession.id, input);
    setData(result);
  }, [data?.bootstrapSession.id]);

  const confirmAnchor = useCallback(async () => {
    if (!data?.bootstrapSession.id) return;
    const result = await confirmPortfolioBootstrapAnchor(data.bootstrapSession.id);
    setData(result);
  }, [data?.bootstrapSession.id]);

  const mergeWorkItems = useCallback((result: {
    existingWorkStatus: PortfolioBootstrapResponse['bootstrapSession']['existingWorkStatus'];
    items: PortfolioBootstrapResponse['workItems'];
  }) => {
    setData((current) => current ? ({
      ...current,
      bootstrapSession: {
        ...current.bootstrapSession,
        status: result.existingWorkStatus === 'unknown' ? current.bootstrapSession.status : 'awaiting_structuring',
        bootstrapPhase: result.existingWorkStatus === 'unknown' ? current.bootstrapSession.bootstrapPhase : 'B3_PROVISIONAL_STRUCTURING',
        existingWorkStatus: result.existingWorkStatus,
      },
      workItems: result.items,
    }) : current);
  }, []);

  const pasteWorkItems = useCallback(async (text: string) => {
    if (!data?.bootstrapSession.id) return;
    const result = await pastePortfolioBootstrapWorkItems(data.bootstrapSession.id, text);
    mergeWorkItems(result);
  }, [data?.bootstrapSession.id, mergeWorkItems]);

  const reloadCurrentSession = useCallback(async () => {
    if (!data?.bootstrapSession.id) return;
    const result = await getPortfolioBootstrapSession(data.bootstrapSession.id);
    setData(result);
  }, [data?.bootstrapSession.id]);

  const uploadImportFile = useCallback(async (file: File) => {
    if (!data?.bootstrapSession.id) return;
    setImportStatus('uploading');
    setImportError(null);
    try {
      const batch = await uploadPortfolioBootstrapImport(data.bootstrapSession.id, file);
      setActiveImport(batch);
      setData((current) => current ? ({
        ...current,
        importBatches: [batch, ...(current.importBatches ?? []).filter((item) => item.id !== batch.id)],
      }) : current);
      setImportStatus('idle');
    } catch (err) {
      setImportStatus('error');
      setImportError(err instanceof PortfolioBootstrapClientError
        ? err.apiError.message
        : 'No pudimos leer el archivo.');
    }
  }, [data?.bootstrapSession.id]);

  const commitImportBatch = useCallback(async (batch: PortfolioBootstrapImportBatch, confirmedMapping: PortfolioBootstrapImportMapping) => {
    if (!data?.bootstrapSession.id) return;
    setImportStatus('committing');
    setImportError(null);
    try {
      const readyBatch = await updatePortfolioBootstrapImportMapping(data.bootstrapSession.id, batch.id, confirmedMapping);
      await commitPortfolioBootstrapImport(data.bootstrapSession.id, readyBatch, confirmedMapping);
      await reloadCurrentSession();
      setActiveImport(null);
      setImportStatus('idle');
    } catch (err) {
      setImportStatus('error');
      setImportError(err instanceof PortfolioBootstrapClientError
        ? err.apiError.message
        : 'No pudimos importar el archivo.');
    }
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const addManualWorkItem = useCallback(async (input: ManualPortfolioBootstrapWorkItemInput) => {
    if (!data?.bootstrapSession.id) return;
    const result = await addManualPortfolioBootstrapWorkItem(data.bootstrapSession.id, input);
    mergeWorkItems(result);
  }, [data?.bootstrapSession.id, mergeWorkItems]);

  const declareNoExistingWork = useCallback(async () => {
    if (!data?.bootstrapSession.id) return;
    const result = await declareNoExistingPortfolioBootstrapWork(data.bootstrapSession.id);
    mergeWorkItems(result);
  }, [data?.bootstrapSession.id, mergeWorkItems]);

  const updateWorkItem = useCallback(async (workItemId: string, input: UpdatePortfolioBootstrapWorkItemInput) => {
    if (!data?.bootstrapSession.id) return;
    const result = await updatePortfolioBootstrapWorkItem(data.bootstrapSession.id, workItemId, input);
    mergeWorkItems(result);
  }, [data?.bootstrapSession.id, mergeWorkItems]);

  const removeWorkItem = useCallback(async (workItemId: string) => {
    if (!data?.bootstrapSession.id) return;
    const result = await removePortfolioBootstrapWorkItem(data.bootstrapSession.id, workItemId);
    mergeWorkItems(result);
  }, [data?.bootstrapSession.id, mergeWorkItems]);

  const analyzeWorkItems = useCallback(async () => {
    if (!data?.bootstrapSession.id) return;
    setAnalysisStatus('processing');
    setAnalysisError(null);
    try {
      await analyzePortfolioBootstrapWork(data.bootstrapSession.id);
      await reloadCurrentSession();
      setAnalysisStatus('idle');
    } catch (err) {
      setAnalysisStatus('error');
      setAnalysisError(err instanceof PortfolioBootstrapClientError
        ? err.apiError.message
        : 'No pudimos analizar el trabajo detectado.');
    }
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const confirmProposedMutation = useCallback(async (mutationId: string) => {
    if (!data?.bootstrapSession.id) return;
    await confirmPortfolioBootstrapProposedMutation(data.bootstrapSession.id, mutationId);
    await reloadCurrentSession();
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const reopenProposedMutationReview = useCallback(async (mutationId: string, reviewNote?: string) => {
    if (!data?.bootstrapSession.id) return;
    await reopenPortfolioBootstrapProposedMutationReviewClient(data.bootstrapSession.id, mutationId, reviewNote);
    await reloadCurrentSession();
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const correctProposedMutation = useCallback(async (mutationId: string, proposedValue: unknown, reviewNote?: string) => {
    if (!data?.bootstrapSession.id) return;
    await correctPortfolioBootstrapProposedMutation(data.bootstrapSession.id, mutationId, proposedValue, reviewNote);
    await reloadCurrentSession();
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const rejectProposedMutation = useCallback(async (mutationId: string, reviewNote?: string) => {
    if (!data?.bootstrapSession.id) return;
    await rejectPortfolioBootstrapProposedMutation(data.bootstrapSession.id, mutationId, reviewNote);
    await reloadCurrentSession();
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const leaveProposedMutationPending = useCallback(async (mutationId: string, reviewNote?: string) => {
    if (!data?.bootstrapSession.id) return;
    await leavePortfolioBootstrapProposedMutationPending(data.bootstrapSession.id, mutationId, reviewNote);
    await reloadCurrentSession();
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const publishFirstReading = useCallback(async () => {
    if (!data?.bootstrapSession.id) return;
    setPublishStatus('processing');
    setPublishError(null);
    try {
      await publishPortfolioBootstrapFirstReading(data.bootstrapSession.id);
      await reloadCurrentSession();
      setPublishStatus('idle');
    } catch (err) {
      setPublishStatus('error');
      setPublishError(err instanceof PortfolioBootstrapClientError
        ? err.apiError.message
        : 'No pudimos generar la primera lectura del portafolio.');
    }
  }, [data?.bootstrapSession.id, reloadCurrentSession]);

  const saveOrganizationProposal = useCallback(async (input: { version: number; payload: PortfolioOrganizationPayload }) => {
    if (!data?.bootstrapSession.id) throw new Error('Bootstrap session unavailable');
    setOrganizationStatus('saving');
    setOrganizationError(null);
    try {
      const saved = await savePortfolioOrganizationProposal(data.bootstrapSession.id, input.version, input.payload);
      setOrganizationProposal(saved);
      setOrganizationStatus('idle');
      return saved;
    } catch (err) {
      setOrganizationStatus('error');
      setOrganizationError(err instanceof PortfolioBootstrapClientError ? err.apiError.message : 'No pudimos guardar la revisión.');
      throw err;
    }
  }, [data?.bootstrapSession.id]);

  const confirmOrganizationProposal = useCallback(async (input: { version: number }) => {
    if (!data?.bootstrapSession.id) throw new Error('Bootstrap session unavailable');
    setOrganizationStatus('confirming');
    setOrganizationError(null);
    try {
      const confirmed = await confirmPortfolioOrganizationProposal(data.bootstrapSession.id, input.version);
      setOrganizationProposal(confirmed);
      setOrganizationStatus('idle');
      return confirmed;
    } catch (err) {
      setOrganizationStatus('error');
      setOrganizationError(err instanceof PortfolioBootstrapClientError ? err.apiError.message : 'No pudimos confirmar la organización.');
      throw err;
    }
  }, [data?.bootstrapSession.id]);

  return useMemo(() => ({
    analysisError,
    analysisStatus,
    analyzeWorkItems,
    confirmProposedMutation,
    reopenProposedMutationReview,
    correctProposedMutation,
    data,
    status,
    error,
    retry: load,
    updateAnchor,
    confirmAnchor,
    pasteWorkItems,
    uploadImportFile,
    commitImportBatch,
    activeImport,
    importStatus,
    importError,
    addManualWorkItem,
    declareNoExistingWork,
    updateWorkItem,
    removeWorkItem,
    rejectProposedMutation,
    leaveProposedMutationPending,
    publishFirstReading,
    publishStatus,
    publishError,
    organizationProposal,
    organizationStatus,
    organizationError,
    saveOrganizationProposal,
    confirmOrganizationProposal,
  }), [
    addManualWorkItem,
    analysisError,
    analysisStatus,
    analyzeWorkItems,
    confirmAnchor,
    confirmProposedMutation,
    reopenProposedMutationReview,
    correctProposedMutation,
    data,
    declareNoExistingWork,
    error,
    activeImport,
    load,
    commitImportBatch,
    pasteWorkItems,
    importError,
    importStatus,
    removeWorkItem,
    rejectProposedMutation,
    leaveProposedMutationPending,
    publishFirstReading,
    publishStatus,
    publishError,
    organizationProposal,
    organizationStatus,
    organizationError,
    saveOrganizationProposal,
    confirmOrganizationProposal,
    status,
    updateAnchor,
    updateWorkItem,
    uploadImportFile,
  ]);
}
