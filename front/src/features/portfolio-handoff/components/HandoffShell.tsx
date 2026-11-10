import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LockKeyhole, MessageCircle, Users } from 'lucide-react';
import { Badge } from '../../../app/components/ui/badge';
import { Button } from '../../../app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../app/components/ui/dialog';
import { PageHeader } from '../../../app/components/design-system/patterns/PageHeader';
import { ContextSummary } from '../../../app/components/design-system/patterns/ContextSummary';
import { parseApiError } from '../../../app/services/api';
import type { HandoffInvitationPreview } from '../services/handoffInvitationService';

type ShellState = 'invitation' | 'accepted' | 'started' | 'rejected' | 'terminal';

export type HandoffShellProps = {
  preview: HandoffInvitationPreview;
  onAccept: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  acceptBusy?: boolean;
  responseError?: string | null;
  onStart?: () => Promise<void>;
  startBusy?: boolean;
  onChangeAccount?: () => void | Promise<void>;
};

function shellState(preview: HandoffInvitationPreview): ShellState {
  if (preview.state === 'STARTED') return 'started';
  if (preview.state === 'ACCEPTED') return 'accepted';
  if (preview.state === 'REJECTED') return 'rejected';
  if (['EXPIRED', 'REVOKED'].includes(preview.state) || preview.identityClaimStatus === 'INVALID_INVITATION' || preview.identityClaimStatus === 'EXPIRED' || preview.identityClaimStatus === 'REVOKED') return 'terminal';
  return 'invitation';
}

export function HandoffShell({ preview, onAccept, onReject, acceptBusy = false, responseError, onStart, startBusy = false, onChangeAccount }: HandoffShellProps) {
  const state = shellState(preview);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const matched = preview.identityClaimStatus === 'MATCHED';
  const canRespond = matched && state === 'invitation' && ['SENT', 'VIEWED'].includes(preview.state);
  const isChallenge = preview.targetKind === 'CHALLENGE';
  const context = preview.canonicalContext;
  const title = context ? `Encargo: ${context.initiative?.name ?? context.challenge.title}` : 'Encargo recibido';
  const typeLabel = isChallenge ? 'Encargo sobre reto' : 'Encargo sobre iniciativa existente';
  const inheritedProblem = recordText(preview.briefVersion?.inheritedContext, 'challengeProblem');
  const expectedDeliverable = recordText(preview.briefVersion?.inheritedContext, 'expectedDeliverable') ?? context?.challenge.successCriteria ?? null;
  const strategicObjective = context?.strategicFront?.strategicObjective ?? recordText(preview.briefVersion?.strategicContextRefs, 'objective');
  const restrictions = joinKnown([
    context?.strategicFront?.constraints,
    context?.challenge.constraints,
    displayUnknown(preview.briefVersion?.constraintsSnapshot),
  ]);
  const knownGaps = displayUnknown(preview.briefVersion?.knownGaps);

  async function submitReject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Indica por qué no puedes asumir esta asignación.');
      return;
    }
    setReasonError(null);
    setRejectError(null);
    setRejectBusy(true);
    try {
      await onReject(trimmed);
      setRejectOpen(false);
      setReason('');
    } catch (error) {
      setRejectError(parseApiError(error).message);
    } finally {
      setRejectBusy(false);
    }
  }

  const status = state === 'started' ? <Badge role="status" aria-live="polite" variant="success" data-testid="handoff-status">Trabajo iniciado</Badge>
    : state === 'accepted' ? <Badge role="status" aria-live="polite" variant="success" data-testid="handoff-status">Aceptada</Badge>
    : state === 'rejected' ? <Badge role="status" aria-live="polite" variant="destructive" data-testid="handoff-status">Rechazada</Badge>
      : state === 'terminal' ? <Badge role="status" aria-live="polite" variant="neutral" data-testid="handoff-status">No disponible</Badge>
        : <Badge role="status" aria-live="polite" variant="info" data-testid="handoff-status">Pendiente de respuesta</Badge>;

  return (
    <main data-testid="handoff-shell" className="min-h-screen bg-background-subtle px-4 py-6 text-text-primary sm:px-6 md:py-10">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center gap-2 px-1 text-sm font-semibold text-brand-primary" aria-label="Starteria">
          <span className="grid size-8 place-items-center rounded-full bg-brand-primary text-text-inverse"><LockKeyhole aria-hidden="true" className="size-4" /></span>
          Starteria
        </div>
        <PageHeader
          eyebrow={typeLabel}
          title={title}
          status={status}
          description={state === 'invitation' ? 'Revisa el encargo y decide si quieres asumirlo como Initiative Owner.' : state === 'accepted' ? 'Este es el contexto de activación que queda disponible antes de empezar.' : state === 'started' ? 'El inicio de este encargo quedó registrado.' : state === 'rejected' ? 'Tu respuesta quedó registrada en el mismo encargo.' : 'No podemos ofrecer acciones para esta invitación.'}
          density="comfortable"
        />

        {responseError && <div role="alert" className="rounded-ds-md border border-status-error-border bg-status-error-surface p-4 text-sm text-status-error-text"><AlertCircle aria-hidden="true" className="mr-2 inline size-4" />{responseError}</div>}
        {!matched && state === 'invitation' && <div role="status" className="flex flex-col gap-3 rounded-ds-md border border-border-default bg-surface-default p-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between"><span>Esta cuenta no coincide con la identidad invitada. Usa la cuenta correcta para responder.</span>{onChangeAccount && <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => void onChangeAccount()}>Cambiar de cuenta</Button>}</div>}

        <ContextSummary title="Contexto del encargo" description={isChallenge ? 'El encargo está vinculado a un reto y no crea una iniciativa.' : 'El encargo conserva la identidad de la iniciativa existente.'} items={[
          { label: 'Frente estratégico', value: context?.strategicFront?.name ?? 'No informado' },
          { label: 'Reto', value: context?.challenge.title ?? 'No informado' },
          { label: 'Iniciativa', value: isChallenge ? 'No existe una iniciativa asociada' : context?.initiative?.name ?? 'No informado' },
          { label: 'Tipo de encargo', value: typeLabel },
        ]} />

        {preview.briefVersion && <section data-testid="handoff-brief-version" className="rounded-ds-md border border-border-default bg-surface-default p-5" aria-labelledby="handoff-brief-title">
          <h2 id="handoff-brief-title" className="text-base font-semibold">Brief confirmado · versión {preview.briefVersion.versionNumber}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary"><span className="font-medium text-text-primary">Objetivo del Brief:</span> {preview.briefVersion.intent ?? 'No informado'}</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary"><span className="font-medium text-text-primary">Alcance:</span> {preview.briefVersion.scope ?? 'No informado'}</p>
          <p className="mt-3 text-xs text-text-muted">Referencia inmutable: {preview.briefVersion.id}</p>
        </section>}

        <section className="grid gap-5 md:grid-cols-2">
          <section className="rounded-ds-md border border-border-default bg-surface-default p-5" aria-labelledby="handoff-context-title">
            <h2 id="handoff-context-title" className="text-base font-semibold">Objetivo y contexto</h2>
            <Definition label="Objetivo estratégico" value={strategicObjective} />
            <Definition label="Objetivo del reto" value={context?.challenge.objective ?? context?.challenge.whatWeWantToMove} />
            <Definition label="Contexto heredado" value={inheritedProblem ?? context?.challenge.description} />
            <Definition label="Contexto específico del encargo" value={context?.assignmentContextNote} />
          </section>
          <section className="rounded-ds-md border border-border-default bg-surface-default p-5" aria-labelledby="handoff-expected-title">
            <h2 id="handoff-expected-title" className="text-base font-semibold">Resultado y límites</h2>
            <Definition label="Resultado esperado" value={expectedDeliverable} />
            <Definition label="Restricciones" value={restrictions} />
            <Definition label="Horizonte" value={context?.strategicFront?.horizon} />
            <Definition label="Información pendiente" value={knownGaps} />
          </section>
        </section>

        <section className="rounded-ds-md border border-border-default bg-surface-default p-5" aria-labelledby="handoff-people-title">
          <h2 id="handoff-people-title" className="text-base font-semibold">Responsables</h2>
          <div className="mt-3 grid gap-4 text-sm text-text-secondary md:grid-cols-2">
            <p><Clock3 aria-hidden="true" className="mr-2 inline size-4 text-brand-primary" /><span className="font-medium text-text-primary">Emite:</span> {context ? `${context.sender.name} · ${context.sender.email}` : 'No informado'}</p>
            <div><p className="font-medium text-text-primary"><Users aria-hidden="true" className="mr-2 inline size-4 text-brand-primary" />Equipo del encargo</p>{context?.members.length ? <ul className="mt-2 space-y-1">{context.members.map((member) => <li key={`${member.role}-${member.identityKey}`}>{member.role}: {member.displayName ?? member.label ?? member.emailNormalized ?? 'No informado'}</li>)}</ul> : <p className="mt-2">No informado</p>}</div>
          </div>
        </section>

        {preview.briefVersion && <details className="rounded-ds-md border border-border-default bg-surface-default p-5">
          <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Ver procedencia del Brief</summary>
          <div className="mt-4 space-y-2 text-sm text-text-secondary"><Definition label="Fuentes" value={displayUnknown(preview.briefVersion.sourceRefs)} /><Definition label="Procedencia" value={displayUnknown(preview.briefVersion.provenance)} /></div>
        </details>}

        {state === 'accepted' && <section className="rounded-ds-md border border-brand-primary/30 bg-brand-primary-subtle p-5" aria-labelledby="handoff-start-title">
          <h2 id="handoff-start-title" className="text-base font-semibold">Cuando decidas empezar</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{isChallenge ? 'Al empezar, Starteria registrará el inicio del trabajo sobre este reto y continuarás en el flujo correspondiente para desarrollarlo.' : 'Al empezar, Starteria registrará el inicio de este encargo y continuarás en la experiencia de desarrollo correspondiente.'}</p>
        </section>}

        {state === 'rejected' && <section className="rounded-ds-md border border-status-warning-border bg-status-warning-surface p-5" aria-labelledby="handoff-rejected-title">
          <h2 id="handoff-rejected-title" className="text-base font-semibold"><CheckCircle2 aria-hidden="true" className="mr-2 inline size-5" />Has rechazado esta asignación</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Tu motivo quedó registrado y el Portfolio Lead podrá revisarlo.</p>
          {preview.rejectionReason && <blockquote className="mt-4 border-l-2 border-status-warning-border pl-4 text-sm text-text-primary">{preview.rejectionReason}</blockquote>}
          {preview.portfolioResponse && <div className="mt-4 flex gap-2 text-sm text-text-secondary"><MessageCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p><span className="font-semibold text-text-primary">Respuesta del Portfolio Lead:</span> {preview.portfolioResponse}</p></div>}
        </section>}

        {state === 'started' && <section role="status" className="rounded-ds-md border border-brand-primary/30 bg-brand-primary-subtle p-5" aria-labelledby="handoff-started-title">
          <h2 id="handoff-started-title" className="text-base font-semibold">Trabajo iniciado</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">El inicio de este encargo quedó registrado. Esta pantalla no define el siguiente destino de trabajo.</p>
        </section>}

        {state === 'terminal' && <section role="status" className="rounded-ds-md border border-border-default bg-surface-default p-5 text-sm text-text-secondary">Esta invitación ya no está disponible. No se puede aceptar ni rechazar.</section>}

        <div className="flex flex-col gap-3 border-t border-border-default pt-5 sm:flex-row sm:items-center sm:justify-end">
          {canRespond && <>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(true)}>Rechazar</Button>
            <Button type="button" variant="primary" loading={acceptBusy} onClick={() => void onAccept()}>Aceptar asignación</Button>
          </>}
          {state === 'accepted' && <Button type="button" variant="primary" loading={startBusy} disabled={!onStart} onClick={() => { if (onStart) void onStart(); }} aria-label="Empezar">Empezar</Button>}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!rejectBusy) setRejectOpen(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar asignación</DialogTitle><DialogDescription>El Portfolio Lead verá el motivo para poder revisarlo. El encargo no se reasignará automáticamente.</DialogDescription></DialogHeader>
          <div>
            <label htmlFor="handoff-rejection-reason" className="text-sm font-medium">Motivo del rechazo</label>
            <textarea id="handoff-rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? 'handoff-rejection-error' : undefined} className="mt-2 min-h-28 w-full rounded-ds-sm border border-border-default bg-surface-default p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring" />
            {reasonError && <p id="handoff-rejection-error" role="alert" className="mt-2 text-sm text-status-error-text">{reasonError}</p>}
            {rejectError && <p role="alert" className="mt-2 text-sm text-status-error-text">{rejectError}</p>}
          </div>
          <DialogFooter><Button type="button" variant="outline" disabled={rejectBusy} onClick={() => setRejectOpen(false)}>Cancelar</Button><Button type="button" variant="destructive" loading={rejectBusy} onClick={() => void submitReject()}>Confirmar rechazo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Definition({ label, value }: { label: string; value: string | null | undefined }) {
  return <p className="mt-2 text-sm leading-6 text-text-secondary"><span className="font-medium text-text-primary">{label}:</span> {value?.trim() || 'No informado'}</p>;
}

function recordText(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function displayUnknown(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const items = value.map(displayUnknown).filter((item): item is string => Boolean(item));
    return items.length ? items.join(' · ') : null;
  }
  if (value && typeof value === 'object') {
    const items = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => { const rendered = displayUnknown(item); return rendered ? `${key}: ${rendered}` : null; })
      .filter((item): item is string => Boolean(item));
    return items.length ? items.join(' · ') : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function joinKnown(values: Array<string | null | undefined>): string | null {
  const unique = [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
  return unique.length ? unique.join(' · ') : null;
}
