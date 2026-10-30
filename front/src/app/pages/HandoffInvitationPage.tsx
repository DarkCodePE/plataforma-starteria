import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseApiError } from '../services/api';
import { acceptHandoffAssignment, claimHandoffInvitation, readHandoffInvitation, rejectHandoffAssignment, resolvePostStartContinuity, savePendingHandoffInvitation, startAssignedWork, type HandoffInvitationPreview, type HandoffOwnerContinuity } from '../../features/portfolio-handoff/services/handoffInvitationService';
import { HandoffShell } from '../../features/portfolio-handoff/components/HandoffShell';
import { OwnerPostStartContinuity } from '../../features/portfolio-handoff/components/OwnerPostStartContinuity';
import { Button } from '../components/ui/button';

export function HandoffInvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();
  const [preview, setPreview] = useState<HandoffInvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const [continuity, setContinuity] = useState<HandoffOwnerContinuity | null>(null);
  const [continuityLoading, setContinuityLoading] = useState(false);
  const [continuityError, setContinuityError] = useState<string | null>(null);
  const [continuityRetry, setContinuityRetry] = useState(0);
  const claimedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    readHandoffInvitation(token).then(setPreview).catch((reason) => {
      const parsed = parseApiError(reason);
      setError(parsed.code === 'HANDOFF_INVITATION_EXPIRED' ? 'Esta invitación ya no está disponible porque expiró.' : parsed.code === 'HANDOFF_INVITATION_REVOKED' ? 'Esta invitación fue retirada por el Portfolio Lead.' : 'No encontramos esta invitación o ya no está disponible.');
    });
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !preview || claimedRef.current || ['EXPIRED', 'REVOKED'].includes(preview.state)) return;
    claimedRef.current = true;
    claimHandoffInvitation(token).then(setPreview).catch((reason) => setResponseError(parseApiError(reason).message));
  }, [isAuthenticated, preview, token]);

  useEffect(() => {
    if (!isAuthenticated || preview?.state !== 'STARTED' || preview.identityClaimStatus !== 'MATCHED' || !preview.assignmentId) return;
    let cancelled = false;
    setContinuityLoading(true);
    setContinuityError(null);
    resolvePostStartContinuity(preview.assignmentId)
      .then((result) => { if (!cancelled) setContinuity(result); })
      .catch((reason) => {
        if (cancelled) return;
        const parsed = parseApiError(reason);
        if (parsed.code === 'OWNER_CONTINUITY_ACCESS_DENIED') {
          setContinuity({ outcome: 'ACCESS_DENIED', assignmentId: preview.assignmentId });
        } else {
          setContinuityError('No pudimos recuperar la continuidad de este encargo. El inicio sigue registrado y puedes reintentar.');
        }
      })
      .finally(() => { if (!cancelled) setContinuityLoading(false); });
    return () => { cancelled = true; };
  }, [continuityRetry, isAuthenticated, preview?.assignmentId, preview?.identityClaimStatus, preview?.state]);

  if (error) return <section className="mx-auto mt-16 max-w-lg rounded-ds-lg border border-border-default bg-surface-default p-8 text-center"><AlertCircle className="mx-auto text-status-warning-icon" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold">Invitación no disponible</h1><p className="mt-2 text-sm text-text-secondary">{error}</p></section>;
  if (!preview) return <div role="status" aria-label="Cargando invitación"><Loader2 className="mx-auto mt-24 animate-spin text-brand-primary" aria-hidden="true" /></div>;

  const continueToAuth = () => { savePendingHandoffInvitation(token); navigate('/auth'); };
  if (!isAuthenticated && preview.identityClaimStatus === 'UNAUTHENTICATED') return <section className="mx-auto mt-16 max-w-lg rounded-ds-lg border border-border-default bg-surface-default p-8 text-center"><h1 className="text-2xl font-semibold">Te han invitado a asumir un encargo</h1><p className="mt-3 text-sm leading-6 text-text-secondary">Inicia sesión o regístrate para comprobar que esta invitación corresponde a tu identidad.</p><button type="button" onClick={continueToAuth} className="mt-7 rounded-ds-sm bg-brand-primary px-5 py-3 text-sm font-semibold text-text-inverse hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">Iniciar sesión o registrarme</button></section>;

  async function accept() {
    if (acceptBusy || !preview.assignmentId) return;
    setResponseError(null); setAcceptBusy(true);
    try { setPreview(await acceptHandoffAssignment(preview.assignmentId, preview.version)); } catch (reason) { setResponseError(parseApiError(reason).message); } finally { setAcceptBusy(false); }
  }

  async function reject(reason: string) {
    if (!preview.assignmentId) return;
    setResponseError(null); setPreview(await rejectHandoffAssignment(preview.assignmentId, reason, preview.version));
  }

  async function start() {
    if (startBusy || !preview.assignmentId) return;
    setResponseError(null); setStartBusy(true);
    try {
      const started = await startAssignedWork(preview.assignmentId, preview.version);
      setContinuity(null);
      setContinuityError(null);
      setContinuityLoading(true);
      setPreview(started);
    }
    catch (reason) { setResponseError(parseApiError(reason).message); }
    finally { setStartBusy(false); }
  }

  if (preview.state === 'STARTED' && preview.identityClaimStatus === 'MATCHED') {
    if (continuity) return <OwnerPostStartContinuity continuity={continuity} onOpenWorkspace={(path) => navigate(path)} />;
    if (continuityLoading) return <div role="status" className="mx-auto mt-24 flex max-w-lg items-center justify-center gap-3 text-sm text-text-secondary"><Loader2 className="size-5 animate-spin text-brand-primary" aria-hidden="true" />Preparando la continuidad de tu encargo…</div>;
    if (continuityError) return <section role="alert" className="mx-auto mt-16 max-w-lg rounded-ds-lg border border-status-error-border bg-status-error-surface p-8 text-center"><AlertCircle className="mx-auto text-status-error-icon" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold">No pudimos abrir tu espacio de continuidad</h1><p className="mt-2 text-sm text-text-secondary">{continuityError}</p><Button type="button" variant="outline" className="mt-5" onClick={() => { setContinuityError(null); setContinuityRetry((value) => value + 1); }}>Reintentar</Button></section>;
  }

  return <HandoffShell preview={preview} onAccept={accept} onReject={reject} acceptBusy={acceptBusy} responseError={responseError} onStart={start} startBusy={startBusy} />;
}
