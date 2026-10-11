import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Button } from '../../../app/components/ui/button';
import { createIdempotencyKey } from './idempotency';
import { normalizePortfolioEntryApiError, submitPortfolioEntryConversion } from './portfolioEntryPublicService';
import type { StarteriaPathSupportedDto } from './starteriaPath.types';
import { trackStarteriaPathEvent } from './analytics';

type Destination = StarteriaPathSupportedDto['conversionPresentation']['destinations'][number];

export function ConversionSubmissionForm({
  sessionId, path, destination, decisionInView, onPathRefresh,
}: {
  sessionId: string;
  path: StarteriaPathSupportedDto;
  destination: Destination;
  decisionInView: string | null;
  onPathRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [shareContext, setShareContext] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'retryable' | 'stale' | 'unavailable'>('idle');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const optInTrackedRef = useRef(false);
  const declinedTrackedRef = useRef(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const actionContainerRef = useRef<HTMLSpanElement | null>(null);
  const restoreFocusRef = useRef(false);
  const resetKey = () => { keyRef.current = null; if (state === 'retryable') setState('idle'); };

  useEffect(() => {
    if (open && state === 'idle') emailRef.current?.focus();
    if (!open && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      actionContainerRef.current?.querySelector('button')?.focus();
    }
  }, [open, state]);

  if (state === 'unavailable') {
    return <div role="status" data-testid="conversion-destination-unavailable">
      <p>Esta solicitud ya no está disponible. Revisa la información actual.</p>
      <Button type="button" variant="outline" onClick={onPathRefresh}>Actualizar</Button>
    </div>;
  }
  if (state === 'stale') {
    return <div role="status" data-testid="conversion-submission-stale">
      <p>La lectura o la solicitud cambió. Revísala antes de volver a enviar.</p>
      <Button type="button" variant="outline" onClick={onPathRefresh}>Revisar lectura</Button>
    </div>;
  }
  if (state === 'success') {
    return <p role="status" data-testid="conversion-submission-success">Recibimos tu solicitud. Referencia: {receiptId}</p>;
  }
  if (!open) {
    return <span ref={actionContainerRef}><Button type="button" variant="outline" onClick={() => {
      trackStarteriaPathEvent(destination.type === 'DEMO' ? 'demo_clicked' : 'early_access_clicked',
        { destinationType: destination.type, availabilityState: path.conversionPresentation.availability });
      setOpen(true);
    }}>{destination.label}</Button></span>;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === 'submitting' || !email.trim()) return;
    if (!shareContext && decisionInView && !declinedTrackedRef.current) {
      declinedTrackedRef.current = true;
      trackStarteriaPathEvent('context_share_declined', { destinationType: destination.type, contextShared: false });
    }
    const key = keyRef.current ?? createIdempotencyKey('conversion-submission');
    keyRef.current = key;
    setState('submitting');
    try {
      const { current: _current, confirmed: _confirmed, ...sourceBinding } = path.sourceBinding;
      const result = await submitPortfolioEntryConversion(sessionId, {
        destinationType: destination.type,
        purpose: destination.type === 'DEMO' ? 'DEMO_REQUEST' : 'EARLY_ACCESS_REQUEST',
        destinationConfigVersion: path.conversionPresentation.conversionConfigVersion!,
        sourceBinding,
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(organization.trim() ? { organization: organization.trim() } : {}),
        contextSharingMode: shareContext ? 'SHARE_CONTEXT_WITH_CONVERSION' : 'NO_ENTRY_CONTEXT_SHARED',
        ...(shareContext ? { explicitContextConsent: true as const } : {}),
        ...(shareContext && decisionInView ? { decisionInViewPreview: decisionInView } : {}),
        idempotencyKey: key,
      });
      setReceiptId(result.submissionId);
      setState('success');
      trackStarteriaPathEvent('conversion_submitted', {
        destinationType: destination.type, contextShared: result.contextShared,
        idempotentReplay: result.idempotentReplay, resultCategory: result.receiptStatus,
      });
    } catch (error) {
      const normalized = normalizePortfolioEntryApiError(error);
      const responseCode = axios.isAxiosError(error)
        ? (error.response?.data as { error?: { code?: unknown } } | undefined)?.error?.code
        : (error as { code?: unknown } | null)?.code;
      if (responseCode === 'CONVERSION_DESTINATION_UNAVAILABLE') setState('unavailable');
      else if (normalized.kind === 'conflict' || normalized.kind === 'expired') setState('stale');
      else setState('retryable');
    }
  };

  return <form onSubmit={(event) => void submit(event)} className="space-y-3" data-testid={`conversion-submission-form-${destination.type}`}>
    <p className="text-sm text-text-secondary">{destination.type === 'DEMO'
      ? 'Usaremos tu correo para responder a tu solicitud de una posible demostración. Enviarla no reserva una cita.'
      : 'Usaremos tu correo para responder a tu interés en acceso anticipado. Enviarla no garantiza acceso.'}</p>
    <label className="block text-sm text-text-primary">Correo electrónico *
      <input ref={emailRef} type="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); resetKey(); }}
        className="mt-1 block w-full rounded border border-border-default bg-surface-default p-2" />
    </label>
    <label className="block text-sm text-text-primary">Nombre (opcional)
      <input type="text" maxLength={120} value={name} onChange={(event) => { setName(event.target.value); resetKey(); }}
        className="mt-1 block w-full rounded border border-border-default bg-surface-default p-2" />
    </label>
    <label className="block text-sm text-text-primary">Organización (opcional)
      <input type="text" maxLength={160} value={organization} onChange={(event) => { setOrganization(event.target.value); resetKey(); }}
        className="mt-1 block w-full rounded border border-border-default bg-surface-default p-2" />
    </label>
    <p className="text-sm text-text-secondary">De forma predeterminada, Starteria enviará solo tu solicitud de contacto.</p>
    {decisionInView ? <div className="space-y-2 text-sm text-text-primary">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={shareContext} onChange={(event) => {
          setShareContext(event.target.checked);
          resetKey();
          if (event.target.checked && !optInTrackedRef.current) {
            optInTrackedRef.current = true;
            trackStarteriaPathEvent('context_share_opt_in', { destinationType: destination.type, contextShared: true });
          }
        }} />
        Compartir también el contexto actual de la decisión para ayudar a entender mi solicitud.
      </label>
      <p>Si eliges compartirlo, se incluirá exactamente este contexto:</p>
      <blockquote className="border-l-2 border-border-default pl-3 whitespace-pre-wrap break-words">{decisionInView}</blockquote>
    </div> : null}
    {state === 'retryable' ? <p role="alert">No pudimos registrar la solicitud. Inténtalo de nuevo.</p> : null}
    <div className="flex gap-2">
      <Button type="submit" disabled={state === 'submitting'}>{state === 'submitting'
        ? <span role="status" aria-live="polite">Enviando…</span> : 'Enviar solicitud'}</Button>
      <Button type="button" variant="ghost" disabled={state === 'submitting'} onClick={() => {
        restoreFocusRef.current = true;
        setOpen(false); setShareContext(false); resetKey();
      }}>Cancelar</Button>
    </div>
  </form>;
}
