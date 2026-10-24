import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { usePortfolioLead } from '../../features/portfolio-lead';
import { PortfolioBootstrapHome, usePortfolioBootstrap } from '../../features/portfolio-lead/bootstrap';
import { completePortfolioSetup, openAdditionalPortfolioFrontSetup } from '../../features/portfolio-lead/bootstrap/services/portfolioBootstrapClient';
import type { ChallengeAssignmentTarget } from '../../features/portfolio-lead/challenge-activation-brief/ChallengeActivationBriefPanel';
import { PortfolioOverviewHome } from '../../features/portfolio-lead/home/PortfolioOverviewHome';
import { PortfolioCopilotDrawer } from '../../features/copilot';
import { PortfolioSetupHomeArrivalPage } from '../../features/portfolio-entry/home/PortfolioSetupHomeArrivalPage';
import { portfolioSetupArrivalIdentity } from '../../features/portfolio-entry/home/portfolioSetupArrivalIdentity';
import { usePortfolioHomeEntryContext } from '../../features/portfolio-entry/home/usePortfolioHomeEntryContext';
import { PortfolioLeadBreadcrumbs } from '../components/portfolio/PortfolioLeadPageElements';
import { getPortfolioHome, type PortfolioHomeReadModel } from '../services/portfolioService';
import { isPortfolioCopilotEnabled } from '../services/featureFlags';

export function PortfolioLeadHomePage() {
  const location = useLocation();
  if (portfolioSetupArrivalIdentity(location.pathname, location.search).present) return <PortfolioSetupHomeArrivalPage />;
  return <OrdinaryPortfolioLeadHomePage />;
}

function OrdinaryPortfolioLeadHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const portfolioState = usePortfolioLead();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [home, setHome] = useState<PortfolioHomeReadModel | null>(null);
  const [homeStatus, setHomeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [homeError, setHomeError] = useState<string | null>(null);
  const [openingAdditionalFront, setOpeningAdditionalFront] = useState(false);
  const additionalFrontIntentRef = useRef<string | null>(null);
  const copilotAvailable = isPortfolioCopilotEnabled();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const entryContinuationId = params.get('portfolioEntryContinuationId');
  const additionalFrontRequested = params.get('setup') === 'additional-front';
  const setupSessionId = params.get('bootstrapSessionId');
  const assignmentTarget = useMemo<ChallengeAssignmentTarget | null>(() => {
    const challengeId = params.get('challengeId');
    const briefId = params.get('briefId');
    const briefVersionId = params.get('briefVersionId');
    if (params.get('stage') !== 'assignment' || !challengeId || !briefId || !briefVersionId) return null;
    return { challengeId, briefId, briefVersionId, challengeName: params.get('challengeName') ?? 'Reto confirmado' };
  }, [params]);
  const entryContext = usePortfolioHomeEntryContext(entryContinuationId);
  const bootstrap = usePortfolioBootstrap(
    entryContinuationId ? (entryContext.status === 'ready' ? entryContinuationId : null) : setupSessionId,
    'legacy',
    entryContinuationId ? 'continuation' : setupSessionId ? 'session' : additionalFrontRequested ? 'direct' : 'resume',
  );

  const loadHome = useCallback(async () => {
    setHomeStatus('loading');
    setHomeError(null);
    try {
      setHome(await getPortfolioHome());
      setHomeStatus('ready');
    } catch (error) {
      setHomeStatus('error');
      setHomeError(error instanceof Error ? error.message : 'No pudimos recuperar el Portfolio Overview.');
    }
  }, []);
  useEffect(() => { void loadHome(); }, [loadHome]);

  const openAssignment = (target: ChallengeAssignmentTarget) => {
    const next = new URLSearchParams(location.search);
    next.set('stage', 'assignment');
    next.set('challengeId', target.challengeId);
    next.set('briefId', target.briefId);
    next.set('briefVersionId', target.briefVersionId);
    next.set('challengeName', target.challengeName);
    navigate(`${location.pathname}?${next.toString()}`);
  };
  const finishSetup = async () => {
    const sessionId = bootstrap.data?.bootstrapSession.id;
    if (!sessionId) throw new Error('No encontramos el contexto que quieres finalizar.');
    await completePortfolioSetup(sessionId);
    await bootstrap.retry();
    await loadHome();
    navigate('/portfolio/inicio', { replace: true });
  };
  const openAdditionalFront = async () => {
    setOpeningAdditionalFront(true);
    setHomeError(null);
    try {
      const intentKey = additionalFrontIntentRef.current ?? `portfolio-additional-front:${globalThis.crypto.randomUUID()}`;
      additionalFrontIntentRef.current = intentKey;
      const opened = await openAdditionalPortfolioFrontSetup(intentKey);
      additionalFrontIntentRef.current = null;
      navigate(`/portfolio/inicio?setup=additional-front&bootstrapSessionId=${encodeURIComponent(opened.bootstrapSession.id)}`);
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : 'No pudimos abrir otro contexto de frente.');
    } finally {
      setOpeningAdditionalFront(false);
    }
  };

  const explicitSetupRoute = Boolean(entryContinuationId || additionalFrontRequested || setupSessionId || assignmentTarget);
  const setupCompleted = Boolean(bootstrap.data?.bootstrapSession.setupCompletedAt);
  const showSetup = explicitSetupRoute || bootstrap.status !== 'ready' || !setupCompleted;

  if (showSetup) {
    return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      {entryContinuationId ? <>
        <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Inicio' }]} />
        <PortfolioEntryArrivalPanel context={entryContext.data} status={entryContext.status} error={entryContext.error} />
      </> : null}
      <PortfolioBootstrapHome
        data={bootstrap.data} status={bootstrap.status} error={bootstrap.error} onRetry={bootstrap.retry}
        onUpdateAnchor={bootstrap.updateAnchor} onConfirmAnchor={bootstrap.confirmAnchor}
        onPasteWorkItems={bootstrap.pasteWorkItems} onUploadImportFile={bootstrap.uploadImportFile}
        onCommitImportBatch={bootstrap.commitImportBatch} onAddManualWorkItem={bootstrap.addManualWorkItem}
        onDeclareNoExistingWork={bootstrap.declareNoExistingWork} onUpdateWorkItem={bootstrap.updateWorkItem}
        onRemoveWorkItem={bootstrap.removeWorkItem} onAnalyzeWorkItems={bootstrap.analyzeWorkItems}
        onConfirmProposedMutation={bootstrap.confirmProposedMutation} onReopenProposedMutationReview={bootstrap.reopenProposedMutationReview}
        onCorrectProposedMutation={bootstrap.correctProposedMutation} onRejectProposedMutation={bootstrap.rejectProposedMutation}
        onLeaveProposedMutationPending={bootstrap.leaveProposedMutationPending} onPublishFirstReading={bootstrap.publishFirstReading}
        analysisStatus={bootstrap.analysisStatus} analysisError={bootstrap.analysisError}
        publishStatus={bootstrap.publishStatus} publishError={bootstrap.publishError}
        importStatus={bootstrap.importStatus} importError={bootstrap.importError} activeImport={bootstrap.activeImport}
        organizationProposal={bootstrap.organizationProposal} organizationStatus={bootstrap.organizationStatus}
        organizationError={bootstrap.organizationError} onSaveOrganizationProposal={bootstrap.saveOrganizationProposal}
        onConfirmOrganizationProposal={bootstrap.confirmOrganizationProposal} onNavigate={navigate}
        initialAssignmentTarget={assignmentTarget} onOpenAssignment={openAssignment} onCompleteSetup={finishSetup}
      />
    </div>;
  }

  if (homeStatus === 'loading') return <main className="mx-auto max-w-[1500px] p-6" aria-live="polite"><p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-800">Recuperando Portfolio Overview…</p></main>;
  if (homeStatus === 'error' || !home) return <main className="mx-auto max-w-[1500px] p-6"><section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><h1 className="font-semibold">No pudimos recuperar Portfolio Overview</h1><p className="mt-1 text-sm">{homeError ?? 'La lectura no está disponible ahora.'}</p><button type="button" onClick={() => void loadHome()} className="mt-4 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold">Reintentar</button></section></main>;

  return <>
    <PortfolioOverviewHome model={home} onOpenCopilot={() => setCopilotOpen(true)} onOpenAdditionalFront={() => void openAdditionalFront()} openingAdditionalFront={openingAdditionalFront} copilotAvailable={copilotAvailable} />
    {homeError ? <p role="alert" className="mx-auto mb-4 max-w-[1500px] px-6 text-sm text-rose-800">{homeError}</p> : null}
    {copilotAvailable ? <PortfolioCopilotDrawer open={copilotOpen} onOpenChange={setCopilotOpen} onPortfolioRefresh={portfolioState.refreshPortfolioData} /> : null}
  </>;
}

function PortfolioEntryArrivalPanel({ context, status, error }: {
  context: ReturnType<typeof usePortfolioHomeEntryContext>['data'];
  status: ReturnType<typeof usePortfolioHomeEntryContext>['status'];
  error: string | null;
}) {
  if (status === 'loading') return <section className="rounded-xl border border-slate-200 bg-white p-5" aria-live="polite"><p className="text-sm font-semibold">Recuperando tu punto de partida…</p></section>;
  if (status === 'error' || !context) return <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">No pudimos abrir este espacio de Portfolio</h2><p className="mt-1 text-sm">{error ?? 'El enlace ya no está disponible.'}</p></section>;
  const { arrival } = context;
  return <section className="space-y-4 rounded-xl border border-violet-200 bg-white p-5" data-testid="portfolio-entry-arrival-panel"><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Llegaste desde Public Entry · {context.organization.name}</p><h1 className="text-2xl font-semibold">Tu punto de partida</h1><div className="grid gap-3 md:grid-cols-2"><ArrivalList title="Lo que ya está claro" items={[arrival.understoodNeed, arrival.desiredOutcome, ...arrival.confirmedContext].filter((item): item is string => Boolean(item))} empty="Todavía no hay elementos confirmados." /><ArrivalList title="Lo que falta resolver" items={[...arrival.openItems, ...arrival.organizationalUnknowns]} empty="No hay asuntos abiertos relevantes." /></div></section>;
}

function ArrivalList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div><h2 className="text-sm font-semibold text-slate-950">{title}</h2>{items.length ? <ul className="mt-2 space-y-2 text-sm text-slate-700">{items.slice(0, 5).map((item, index) => <li key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">{empty}</p>}</div>;
}
