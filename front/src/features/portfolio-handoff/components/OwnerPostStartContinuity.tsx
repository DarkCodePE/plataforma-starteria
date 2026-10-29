import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, LockKeyhole } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';
import type {
  HandoffBriefVersion,
  HandoffOwnerContinuity,
} from '../services/handoffInvitationService';

type Props = {
  continuity: HandoffOwnerContinuity;
  onOpenWorkspace: (path: string) => void;
};

const REASON_COPY = {
  OPERATIONAL_ACCESS_REQUIRED: 'Tu acceso operativo a esta iniciativa todavÃ­a no estÃ¡ materializado.',
  OWNER_ACTIVATION_REQUIRED: 'La iniciativa conserva un responsable operativo pendiente de confirmar.',
  RETROSPECTIVE_ASSESSMENT_REQUIRED: 'La evaluaciÃ³n retrospectiva de esta iniciativa todavÃ­a estÃ¡ pendiente.',
  STEPS_NOT_MATERIALIZED: 'La iniciativa todavÃ­a no tiene Steps persistidos.',
  OPERATIONAL_STATE_UNRESOLVED: 'El estado operativo de Steps todavÃ­a no coincide con el avance registrado de la iniciativa.',
} as const;

export function OwnerPostStartContinuity({ continuity, onOpenWorkspace }: Props) {
  if (continuity.outcome === 'ACCESS_DENIED') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <section role="alert" className="rounded-ds-lg border border-status-error-border bg-status-error-surface p-6">
          <AlertCircle aria-hidden="true" className="size-6 text-status-error-icon" />
          <h1 className="mt-4 text-xl font-semibold text-text-primary">No pudimos validar tu acceso a este encargo</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Vuelve a abrir el enlace con la misma identidad que aceptÃ³ y comenzÃ³ la asignaciÃ³n.</p>
        </section>
      </main>
    );
  }

  const brief = <BriefVersionSummary briefVersion={continuity.briefVersion} />;

  if (continuity.outcome === 'EXISTING_READY') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="rounded-ds-lg border border-brand-primary/30 bg-brand-primary-subtle p-6 sm:p-8">
          <CheckCircle2 aria-hidden="true" className="size-7 text-brand-primary" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-primary">Encargo iniciado</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">ContinÃºa tu iniciativa</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">Tu acceso y los Steps existentes estÃ¡n disponibles. EntrarÃ¡s primero en el Overview, nunca directamente en un Step.</p>
        </header>
        <section className="mt-5 rounded-ds-lg border border-border-default bg-surface-default p-6" aria-labelledby="continuity-project-title">
          <h2 id="continuity-project-title" className="text-lg font-semibold text-text-primary">{continuity.project.name}</h2>
          <p className="mt-2 text-sm text-text-secondary">Estado real Â· Step {continuity.project.currentStep} Â· {continuity.project.stepCount} Steps persistidos</p>
          <p className="mt-2 text-sm text-text-secondary">Reto: {continuity.challenge.title}</p>
          {brief}
          {continuity.contextNote && <p className="mt-4 rounded-ds-sm bg-surface-subtle p-3 text-sm text-text-secondary"><span className="font-semibold text-text-primary">Contexto del encargo:</span> {continuity.contextNote}</p>}
          <div className="mt-6 flex justify-end">
            <Button type="button" variant="primary" onClick={() => onOpenWorkspace(continuity.project.workspacePath)}>
              Abrir Overview de la iniciativa <ArrowRight aria-hidden="true" className="ml-2 size-4" />
            </Button>
          </div>
        </section>
        <AssignmentReference assignmentId={continuity.assignmentId} />
      </main>
    );
  }

  if (continuity.outcome === 'EXISTING_ACTIVATION_REQUIRED') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="rounded-ds-lg border border-status-warning-border bg-status-warning-surface p-6 sm:p-8">
          <LockKeyhole aria-hidden="true" className="size-7 text-status-warning-icon" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-status-warning-text">Encargo iniciado Â· acceso protegido</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">La iniciativa necesita activaciÃ³n antes de continuar</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">Starteria conservÃ³ el encargo, pero no concederÃ¡ acceso ni inventarÃ¡ Steps hasta que se resuelvan las condiciones operativas.</p>
        </header>
        <section className="mt-5 rounded-ds-lg border border-border-default bg-surface-default p-6">
          <h2 className="text-lg font-semibold text-text-primary">{continuity.project.name}</h2>
          <p className="mt-2 text-sm text-text-secondary">Reto: {continuity.challenge.title}</p>
          {brief}
          <ul className="mt-5 space-y-3">
            {continuity.reasons.map((reason) => <li key={reason} className="flex gap-3 text-sm leading-6 text-text-secondary"><LockKeyhole aria-hidden="true" className="mt-1 size-4 shrink-0 text-status-warning-icon" />{REASON_COPY[reason]}</li>)}
          </ul>
          <p className="mt-5 text-sm font-medium text-text-primary">El Portfolio Lead debe resolver la activaciÃ³n o el acceso fuera del comando Start.</p>
        </section>
        <AssignmentReference assignmentId={continuity.assignmentId} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="rounded-ds-lg border border-brand-primary/30 bg-brand-primary-subtle p-6 sm:p-8">
        <ClipboardList aria-hidden="true" className="size-7 text-brand-primary" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-primary">Encargo iniciado Â· formulaciÃ³n pendiente</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">Formula una iniciativa para este reto</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">El reto y su Brief confirmado estÃ¡n vinculados a tu encargo. La iniciativa debe crearse despuÃ©s mediante una decisiÃ³n humana y un comando independiente.</p>
      </header>
      <section className="mt-5 rounded-ds-lg border border-border-default bg-surface-default p-6">
        <h2 className="text-lg font-semibold text-text-primary">{continuity.challenge.title}</h2>
        {brief}
        {continuity.contextNote && <p className="mt-4 rounded-ds-sm bg-surface-subtle p-3 text-sm text-text-secondary"><span className="font-semibold text-text-primary">Contexto del encargo:</span> {continuity.contextNote}</p>}
        <p className="mt-5 text-sm leading-6 text-text-secondary">Este inicio no ha creado una iniciativa ni Steps. La acciÃ³n de formulaciÃ³n queda pendiente de la autoridad contractual downstream.</p>
      </section>
      <AssignmentReference assignmentId={continuity.assignmentId} />
    </main>
  );
}

function BriefVersionSummary({ briefVersion }: { briefVersion: HandoffBriefVersion | null }) {
  if (!briefVersion) return <p className="mt-4 text-sm text-status-warning-text">El encargo histÃ³rico no expone una BriefVersion confirmada.</p>;
  return (
    <div className="mt-4 rounded-ds-sm border border-border-default bg-surface-subtle p-4 text-sm">
      <p className="font-semibold text-text-primary">Brief confirmado Â· versiÃ³n {briefVersion.versionNumber}</p>
      {briefVersion.intent && <p className="mt-2 text-text-secondary"><span className="font-medium text-text-primary">Objetivo:</span> {briefVersion.intent}</p>}
      {briefVersion.scope && <p className="mt-1 text-text-secondary"><span className="font-medium text-text-primary">Alcance:</span> {briefVersion.scope}</p>}
      <p className="mt-2 text-xs text-text-muted">Referencia inmutable: {briefVersion.id}</p>
    </div>
  );
}

function AssignmentReference({ assignmentId }: { assignmentId: string }) {
  return <p className="mt-4 text-xs text-text-muted">Assignment: {assignmentId}</p>;
}

