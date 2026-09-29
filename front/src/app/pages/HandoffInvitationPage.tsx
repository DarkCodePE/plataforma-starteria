import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { claimHandoffInvitation, readHandoffInvitation, savePendingHandoffInvitation } from '../../features/portfolio-handoff/services/handoffInvitationService';

export function HandoffInvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof readHandoffInvitation>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const claimedRef = useRef(false);

  useEffect(() => { if (token) readHandoffInvitation(token).then(setPreview).catch(() => setError('No encontramos esta invitación o ya no está disponible.')); }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !preview || claiming || claimedRef.current) return;
    claimedRef.current = true;
    setClaiming(true);
    claimHandoffInvitation(token).then(setPreview).catch(() => setError('No pudimos verificar tu identidad.')).finally(() => setClaiming(false));
  }, [isAuthenticated, preview, token, claiming]);

  if (error) return <section className="mx-auto mt-16 max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center"><AlertCircle className="mx-auto text-amber-600" /><h1 className="mt-4 text-xl font-bold text-slate-950">Invitación no disponible</h1><p className="mt-2 text-sm text-slate-500">{error}</p></section>;
  if (!preview) return <Loader2 className="mx-auto mt-24 animate-spin text-indigo-600" />;

  const continueToAuth = () => { savePendingHandoffInvitation(token); navigate('/auth'); };
  return <section className="mx-auto mt-16 max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
    <LockKeyhole className="mx-auto text-indigo-600" />
    <h1 className="mt-4 text-2xl font-bold text-slate-950">Te han invitado a continuar</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">Esta invitación requiere una cuenta Starteria. Tras iniciar sesión verificaremos que tu identidad coincida con la persona invitada.</p>
    {preview.identityClaimStatus === 'MISMATCH' && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Esta cuenta no coincide con la identidad invitada.</p>}
    {preview.identityClaimStatus === 'MATCHED' && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Identidad verificada. La invitación está lista para el siguiente paso.</p>}
    {preview.identityClaimStatus === 'UNAUTHENTICATED' && <button type="button" onClick={continueToAuth} className="mt-7 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">Iniciar sesión o registrarme</button>}
  </section>;
}
