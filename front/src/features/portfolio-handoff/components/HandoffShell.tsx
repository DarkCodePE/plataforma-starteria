import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LockKeyhole, MessageCircle, Users } from 'lucide-react';
import { Badge } from '../../../app/components/ui/badge';
import { Button } from '../../../app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../app/components/ui/dialog';
import { PageHeader } from '../../../app/components/design-system/patterns/PageHeader';
import { ContextSummary } from '../../../app/components/design-system/patterns/ContextSummary';
import { parseApiError } from '../../../app/services/api';
import type { HandoffInvitationPreview } from '../services/handoffInvitationService';

type ShellState = 'invitation' | 'accepted' | 'rejected' | 'terminal';

export type HandoffShellProps = {
  preview: HandoffInvitationPreview;
  onAccept: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  acceptBusy?: boolean;
  responseError?: string | null;
  onStart?: () => void;
};

function shellState(preview: HandoffInvitationPreview): ShellState {
  if (preview.state === 'ACCEPTED' || preview.state === 'STARTED') return 'accepted';
  if (preview.state === 'REJECTED') return 'rejected';
  if (['EXPIRED', 'REVOKED'].includes(preview.state) || preview.identityClaimStatus === 'INVALID_INVITATION' || preview.identityClaimStatus === 'EXPIRED' || preview.identityClaimStatus === 'REVOKED') return 'terminal';
  return 'invitation';
}

export function HandoffShell({ preview, onAccept, onReject, acceptBusy = false, responseError, onStart }: HandoffShellProps) {
  const state = shellState(preview);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const matched = preview.identityClaimStatus === 'MATCHED';
  const canRespond = matched && state === 'invitation' && ['SENT', 'VIEWED'].includes(preview.state);
  const isChallenge = preview.targetKind === 'CHALLENGE';
  const title = isChallenge ? 'Asignación para desarrollar un reto' : 'Asignación sobre una iniciativa';
  const typeLabel = isChallenge ? 'Challenge Assignment' : 'Initiative Assignment';

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

  const status = state === 'accepted' ? <Badge variant="success" data-testid="handoff-status">Aceptada</Badge>
    : state === 'rejected' ? <Badge variant="destructive" data-testid="handoff-status">Rechazada</Badge>
      : state === 'terminal' ? <Badge variant="neutral" data-testid="handoff-status">No disponible</Badge>
        : <Badge variant="info" data-testid="handoff-status">Pendiente de respuesta</Badge>;

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
          description={state === 'invitation' ? 'Revisa el encargo y decide si quieres asumirlo como Initiative Owner.' : state === 'accepted' ? 'Este es el contexto de activación que queda disponible antes de empezar.' : state === 'rejected' ? 'Tu respuesta quedó registrada en el mismo encargo.' : 'No podemos ofrecer acciones para esta invitación.'}
          density="comfortable"
        />

        {responseError && <div role="alert" className="rounded-ds-md border border-status-error-border bg-status-error-surface p-4 text-sm text-status-error-text"><AlertCircle aria-hidden="true" className="mr-2 inline size-4" />{responseError}</div>}
        {!matched && state === 'invitation' && <div role="status" className="rounded-ds-md border border-border-default bg-surface-default p-4 text-sm text-text-secondary">Esta cuenta no coincide con la identidad invitada. Usa la cuenta correcta para responder.</div>}

        <ContextSummary title="Qué recibiste" description={isChallenge ? 'El encargo está vinculado a un reto. Todavía no existe una Initiative asociada.' : 'El encargo conserva la identidad de la Initiative existente.'} items={[
          { label: isChallenge ? 'Reto asignado' : 'Iniciativa asignada', value: isChallenge ? 'Reto vinculado a tu asignación' : 'Initiative existente vinculada al reto' },
          { label: 'Tipo de encargo', value: typeLabel },
        ]} />

        <section className="grid gap-5 md:grid-cols-2">
          <section className="rounded-ds-md border border-border-default bg-surface-default p-5" aria-labelledby="handoff-why-title">
            <h2 id="handoff-why-title" className="text-base font-semibold">Por qué importa</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Tu participación ayuda a convertir este contexto en trabajo trazable, con una responsabilidad clara y apoyo disponible.</p>
          </section>
          <section className="rounded-ds-md border border-border-default bg-surface-default p-5" aria-labelledby="handoff-expected-title">
            <h2 id="handoff-expected-title" className="text-base font-semibold">Qué se espera de ti</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Asumir el encargo como Initiative Owner y revisar el contexto antes de decidir cuándo empezar.</p>
          </section>
        </section>

        <details className="rounded-ds-md border border-border-default bg-surface-default p-5">
          <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Ver marco y apoyo disponible</summary>
          <div className="mt-4 grid gap-4 text-sm text-text-secondary md:grid-cols-2">
            <p><Clock3 aria-hidden="true" className="mr-2 inline size-4 text-brand-primary" />El contexto se conserva para que puedas revisarlo antes de actuar.</p>
            <p><Users aria-hidden="true" className="mr-2 inline size-4 text-brand-primary" />El equipo y Portfolio Lead podrán acompañar el desarrollo del encargo.</p>
          </div>
        </details>

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

        {state === 'terminal' && <section role="status" className="rounded-ds-md border border-border-default bg-surface-default p-5 text-sm text-text-secondary">Esta invitación ya no está disponible. No se puede aceptar ni rechazar.</section>}

        <div className="flex flex-col gap-3 border-t border-border-default pt-5 sm:flex-row sm:items-center sm:justify-end">
          {canRespond && <>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(true)}>Rechazar</Button>
            <Button type="button" variant="primary" loading={acceptBusy} onClick={() => void onAccept()}>Aceptar asignación</Button>
          </>}
          {state === 'accepted' && <Button type="button" variant="primary" disabled={!onStart} onClick={onStart} aria-label="Empezar (disponible en el siguiente paso)">Empezar</Button>}
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
