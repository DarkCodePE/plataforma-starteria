import React from 'react';
import { PortfolioBootstrapHome, usePortfolioBootstrap } from '../../portfolio-lead/bootstrap';
import { usePortfolioSetupArrival } from './PortfolioSetupArrivalGate';
import type { PortfolioSetupHomeArrival } from './portfolioSetupHomeArrivalClient';

type Field = NonNullable<PortfolioSetupHomeArrival['carriedContext']>['criticalReading'];

function CarriedField({ label, field }: { label: string; field: Field }) {
  if (!field) return null;
  const truth = field.truthClass === 'CONFIRMED_REPRESENTATION'
    ? 'Representación confirmada por la persona; requiere revisión organizacional para decisiones oficiales.'
    : field.truthClass === 'ORGANIZATIONAL_AUTHORITY_REQUIRED'
      ? 'Requiere autoridad organizacional antes de usarlo como decisión.'
      : 'Contexto provisional de la persona; no es verdad organizacional aprobada.';
  return (
    <div className="min-w-0 rounded-ds-md border border-border-default p-4">
      <h3 className="font-semibold text-text-primary">{label}</h3>
      <p className="mt-2 break-words text-sm text-text-secondary">{field.text}</p>
      <p className="mt-2 text-xs text-text-muted">{truth} Fuente: {field.sourceRef}.</p>
    </div>
  );
}

export function PortfolioSetupHomeArrivalPage() {
  const { data, revalidate } = usePortfolioSetupArrival();
  const bootstrap = usePortfolioBootstrap(data.snapshotId, '114F');
  if (bootstrap.status === 'error') return (
    <section className="mx-auto max-w-3xl min-w-0 p-5 sm:p-8" role="alert" data-testid="portfolio-setup-bootstrap-error">
      <h1 className="text-xl font-semibold">No pudimos validar el Bootstrap de Portfolio</h1>
      <p className="mt-2 text-sm">El acceso y la fuente se comprobarán de nuevo antes de mostrar el contexto.</p>
      <button type="button" className="mt-4" onClick={revalidate}>Revalidar y reintentar</button>
    </section>
  );
  const context = data.carriedContext;
  return (
    <div className="mx-auto max-w-5xl min-w-0 space-y-6 p-5 sm:p-8" data-testid="portfolio-setup-home-arrival">
      <header className="min-w-0">
        <p className="text-sm text-text-muted">Portfolio Home · continuidad de Entrada</p>
        <h1 className="mt-1 break-words text-2xl font-semibold text-text-primary">Continuar en {data.organization.name}</h1>
        <p className="mt-2 text-sm text-text-secondary">Retomamos la lectura confirmada como representación. Las decisiones organizacionales siguen pendientes de su propia validación.</p>
      </header>
      <section className="min-w-0 space-y-3" aria-label="Contexto traído desde Entrada">
        <CarriedField label="Lectura crítica" field={context?.criticalReading} />
        <CarriedField label="Marco de decisión" field={context?.decisionFrame} />
        <CarriedField label="Representación confirmada" field={context?.confirmedRepresentation} />
        {context?.knownContext?.map((field, index) => <CarriedField key={`${field.sourceRef}:${index}`}
          label="Contexto conocido" field={field} />)}
        <CarriedField label="Primer movimiento sugerido, pendiente de revisión" field={context?.firstMoveSuggestion} />
        {data.openItems.length > 0 && <div className="min-w-0 rounded-ds-md border border-border-default p-4">
          <h2 className="font-semibold">Pendientes por revisar</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {data.openItems.map((item, index) => <li className="break-words" key={`${item.sourceRef}:${index}`}>{item.description}</li>)}
          </ul>
        </div>}
      </section>
      <PortfolioBootstrapHome
        data={bootstrap.data} status={bootstrap.status} error={bootstrap.error}
        onRetry={revalidate} onUpdateAnchor={bootstrap.updateAnchor} onConfirmAnchor={bootstrap.confirmAnchor}
        onPasteWorkItems={bootstrap.pasteWorkItems} onUploadImportFile={bootstrap.uploadImportFile}
        onCommitImportBatch={bootstrap.commitImportBatch} onAddManualWorkItem={bootstrap.addManualWorkItem}
        onDeclareNoExistingWork={bootstrap.declareNoExistingWork} onUpdateWorkItem={bootstrap.updateWorkItem}
        onRemoveWorkItem={bootstrap.removeWorkItem} onAnalyzeWorkItems={bootstrap.analyzeWorkItems}
        onConfirmProposedMutation={bootstrap.confirmProposedMutation}
        onCorrectProposedMutation={bootstrap.correctProposedMutation}
        onRejectProposedMutation={bootstrap.rejectProposedMutation}
        onLeaveProposedMutationPending={bootstrap.leaveProposedMutationPending}
        onPublishFirstReading={bootstrap.publishFirstReading}
        analysisStatus={bootstrap.analysisStatus} analysisError={bootstrap.analysisError}
        publishStatus={bootstrap.publishStatus} publishError={bootstrap.publishError}
        importStatus={bootstrap.importStatus} importError={bootstrap.importError} activeImport={bootstrap.activeImport}
      />
    </div>
  );
}
