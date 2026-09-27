import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';
import {
  getHomeCommandCenterModel,
  getPortfolioHomeExperienceModel,
  PortfolioAttentionList,
  PortfolioSummaryCards,
  usePortfolioLead,
} from '../../features/portfolio-lead';
import { Badge } from '../components/ui/badge';
import {
  ContextSummary,
  EmptyState,
  InlineInsight,
  NextAction,
  PageHeader,
} from '../components/design-system/patterns';
import { PortfolioLeadBreadcrumbs } from '../components/portfolio/PortfolioLeadPageElements';
import {
  RecentActivitySection,
  StrategicObjectivesOverview,
} from '../components/portfolio/PortfolioLeadHomeExperience';
import { PortfolioCopilotDrawer, PortfolioCopilotLauncher } from '../../features/copilot';
import { isPortfolioCopilotEnabled } from '../services/featureFlags';
import { PortfolioBootstrapHome, usePortfolioBootstrap } from '../../features/portfolio-lead/bootstrap';
import { createOrReuseStrategicFramingFromSource } from '../../features/portfolio-lead/strategic-framing/service';
import { usePortfolioHome } from '../hooks/usePortfolioHome';
import { StrategicFramingHomeSection } from '../components/portfolio/StrategicFramingHomeSection';

export function PortfolioLeadHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const portfolioState = usePortfolioLead();
  const [copilotOpen, setCopilotOpen] = useState(false);

  const entryContinuationId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('portfolioEntryContinuationId');
  }, [location.search]);
  const bootstrap = usePortfolioBootstrap(entryContinuationId);
  const home = usePortfolioHome(!entryContinuationId);

  const firstName = 'Ana';

  const model = useMemo(
    () => getPortfolioHomeExperienceModel(portfolioState, firstName),
    [portfolioState],
  );

  const commandCenter = useMemo(() => getHomeCommandCenterModel(portfolioState), [portfolioState]);

  const showPortfolioCopilot = isPortfolioCopilotEnabled();
  const handleAction = (actionId: string) => {
    navigate(actionId);
  };

  if (entryContinuationId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
        <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Inicio' }]} />
        <PortfolioBootstrapHome
          data={bootstrap.data}
          status={bootstrap.status}
          error={bootstrap.error}
          onRetry={bootstrap.retry}
          onUpdateAnchor={bootstrap.updateAnchor}
          onConfirmAnchor={bootstrap.confirmAnchor}
          onPasteWorkItems={bootstrap.pasteWorkItems}
          onUploadImportFile={bootstrap.uploadImportFile}
          onCommitImportBatch={bootstrap.commitImportBatch}
          onAddManualWorkItem={bootstrap.addManualWorkItem}
          onDeclareNoExistingWork={bootstrap.declareNoExistingWork}
          onUpdateWorkItem={bootstrap.updateWorkItem}
          onRemoveWorkItem={bootstrap.removeWorkItem}
          onAnalyzeWorkItems={bootstrap.analyzeWorkItems}
          onConfirmProposedMutation={bootstrap.confirmProposedMutation}
          onCorrectProposedMutation={bootstrap.correctProposedMutation}
          onRejectProposedMutation={bootstrap.rejectProposedMutation}
          onLeaveProposedMutationPending={bootstrap.leaveProposedMutationPending}
          onPublishFirstReading={bootstrap.publishFirstReading}
          onContinueToStrategicFraming={async () => {
            if (!bootstrap.data?.bootstrapSession.id) return;
            const result = await createOrReuseStrategicFramingFromSource({ sourceMode: 'public_entry', bootstrapSessionId: bootstrap.data.bootstrapSession.id });
            navigate(result.workspacePath);
          }}
          analysisStatus={bootstrap.analysisStatus}
          analysisError={bootstrap.analysisError}
          publishStatus={bootstrap.publishStatus}
          publishError={bootstrap.publishError}
          importStatus={bootstrap.importStatus}
          importError={bootstrap.importError}
          activeImport={bootstrap.activeImport}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Inicio' }]} />

      <PageHeader
        eyebrow="Portfolio Home"
        title="¿Qué requiere atención hoy?"
        description={commandCenter.header.supportingLine}
        metadata={[
          { label: 'Frentes activos', value: commandCenter.summary.activeFronts },
          { label: 'Bloqueos', value: commandCenter.summary.blockedInitiatives },
          { label: 'Decisiones pendientes', value: commandCenter.summary.pendingDecisions },
        ]}
        primaryAction={{ id: '/portfolio/frentes-estrategicos', label: 'Crear nuevo frente' }}
        secondaryActions={[
          { id: '/portfolio/iniciar?mode=import', label: 'Importar iniciativas', tone: 'secondary' },
        ]}
        onAction={handleAction}
        density="compact"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <main className="space-y-6">
          <ContextSummary
            title="Resumen ejecutivo"
            description="Indicadores agregados para leer foco, carga y decisiones sin convertir Home en un tablero de métricas ficticias."
            density="compact"
            items={[
              { label: 'Frentes', value: `${commandCenter.summary.activeFronts} activos de ${commandCenter.summary.fronts}` },
              { label: 'Retos', value: `${commandCenter.summary.activeChallenges} activos de ${commandCenter.summary.challenges}` },
              { label: 'Iniciativas', value: `${commandCenter.summary.activeInitiatives} en curso de ${commandCenter.summary.initiatives}` },
              { label: 'Decisiones', value: `${commandCenter.summary.pendingDecisions} pendientes` },
            ]}
          />

          <StrategicFramingHomeSection
            state={home.data?.strategicFraming ?? null}
            loading={home.loading}
            onRetry={() => void home.refetch()}
            onNavigate={navigate}
          />

          {commandCenter.emptyState ? (
            <EmptyState
              eyebrow="Portafolio en arranque"
              title={commandCenter.emptyState.title}
              description={commandCenter.emptyState.description}
              primaryAction={{
                id: commandCenter.emptyState.actionPath,
                label: commandCenter.emptyState.actionLabel,
                ariaLabel: commandCenter.emptyState.actionLabel,
              }}
              onAction={handleAction}
            />
          ) : null}

          <section className="rounded-ds-lg border border-border-default bg-surface-default p-5 md:p-6">
            <div className="mb-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">Requires attention</Badge>
                <span className="text-sm text-text-muted">Estado visible en la UI estructurada</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-text-primary">Requiere atención</h2>
            </div>
            <div className="divide-y divide-border-default">
              <PortfolioAttentionList
                alerts={commandCenter.alerts}
                fallbackAction={commandCenter.nextAction}
                onNavigate={path => navigate(path)}
              />
            </div>
          </section>

          <NextAction
            eyebrow="Siguiente acción"
            title={commandCenter.nextAction.label}
            description={commandCenter.nextAction.description}
            context={
              <dl className="grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <dt className="font-medium text-text-muted">Contexto</dt>
                  <dd>{commandCenter.nextAction.contextLabel ?? 'Portafolio completo'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text-muted">Impacto</dt>
                  <dd>{commandCenter.nextAction.impactLabel ?? 'Mantiene foco ejecutivo.'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-text-muted">Riesgo</dt>
                  <dd>{commandCenter.nextAction.riskLabel ?? 'El portafolio puede perder ritmo.'}</dd>
                </div>
              </dl>
            }
            primaryAction={{
              id: commandCenter.nextAction.path ?? '/portfolio/inicio',
              label: commandCenter.nextAction.ctaLabel ?? commandCenter.nextAction.label,
              ariaLabel: commandCenter.nextAction.ctaLabel ?? commandCenter.nextAction.label,
            }}
            onAction={handleAction}
          />

          <section className="rounded-ds-lg border border-border-default bg-surface-default p-5 md:p-6">
            <div className="mb-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={commandCenter.pendingDecisions.length > 0 ? 'warning' : 'neutral'}>
                  Human action
                </Badge>
                <span className="text-sm text-text-muted">{commandCenter.pendingDecisions.length} pendientes</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-text-primary">Decisiones pendientes</h2>
            </div>
            <div className="space-y-3">
              {commandCenter.pendingDecisions.length === 0 ? (
                <p className="rounded-ds-md border border-dashed border-border-default bg-background-subtle p-4 text-sm text-text-secondary">
                  No hay decisiones pendientes ahora. La atención puede mantenerse sobre cobertura, activación y seguimiento.
                </p>
              ) : commandCenter.pendingDecisions.slice(0, 4).map(item => (
                <ContextSummary
                  key={item.id}
                  density="compact"
                  items={[
                    {
                      label: 'Decisión requerida',
                      value: item.initiativeName,
                      metadata: item.evidenceSummary,
                      action: { id: item.actionPath, label: item.actionLabel, ariaLabel: item.actionLabel },
                    },
                    { label: 'Contexto', value: `${item.frontName} / ${item.challengeName}`, metadata: item.suggestedRoute },
                  ]}
                  onAction={handleAction}
                  className="bg-background-subtle"
                />
              ))}
            </div>
          </section>

          <StrategicObjectivesOverview overview={model.strategicOverview} onNavigate={path => navigate(path)} />

          <section className="rounded-ds-lg border border-border-default bg-surface-default p-6 md:p-7">
            <div className="max-w-3xl">
              <Badge variant="neutral">Secondary context</Badge>
              <h2 className="mt-3 text-xl font-semibold text-text-primary">Resumen secundario del portafolio</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Indicadores agregados para complementar la lectura por frente estratégico.
              </p>
            </div>

            <PortfolioSummaryCards items={model.summaryCards} />
          </section>

          <RecentActivitySection items={model.recentActivity} />
        </main>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <InlineInsight
            title="Starteria"
            rationale={[
              'La atención principal permanece en la lista estructurada.',
              'Este panel solo orienta y explica; no decide por el Portfolio Lead.',
            ]}
          >
            {commandCenter.alerts.length > 0
              ? 'Empieza por los elementos de atención visibles en el workspace. Los bloqueos y decisiones no dependen de abrir Copilot.'
              : 'No hay señales críticas visibles ahora. Mantén seguimiento sobre cobertura, decisiones y frentes activos.'}
          </InlineInsight>

          {showPortfolioCopilot && (
            <div className="rounded-ds-md border border-border-default bg-surface-default p-4">
              <div className="flex items-start gap-3">
                <Sparkles aria-hidden="true" className="mt-1 size-4 text-brand-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">Copilot contextual</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Usa la lectura existente para orientar el siguiente movimiento sin reemplazar la cola de atención.
                  </p>
                  <div className="mt-3">
                    <PortfolioCopilotLauncher onClick={() => setCopilotOpen(true)} />
                  </div>
                </div>
              </div>
              {copilotOpen && (
                <PortfolioCopilotDrawer
                  open={copilotOpen}
                  onOpenChange={setCopilotOpen}
                  onPortfolioRefresh={portfolioState.refreshPortfolioData}
                />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
