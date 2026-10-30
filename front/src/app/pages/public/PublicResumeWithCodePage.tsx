import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import {
  issuePilotClaim,
  setPendingPilotClaim,
  trackPilotInterestEvent,
} from '../../../features/public-start/services/publicPilotLeadService';

const PILOT_CODE_REGEX = /^ST-PILOT-[A-F0-9]{64}$/;

/**
 * Public "continue with your code" entry (ADR-018): the applicant types the
 * high-entropy `ST-PILOT-…` bearer from their confirmation email. On success we mint a
 * single-use claim token, stash it, and route to /auth — after they sign in /
 * sign up, the claim is consumed to create their project and land them in the
 * workspace. The email is never exposed to the client.
 */
export function PublicResumeWithCodePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = code.trim().toUpperCase();
  const isValid = PILOT_CODE_REGEX.test(normalized);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    setError(null);
    try {
      const info = await issuePilotClaim(normalized);
      setPendingPilotClaim(info);
      trackPilotInterestEvent('pilot_interest_started', { source: 'resume_code' });
      // Hand off to auth; the post-auth step consumes the claim → /projects/:id.
      navigate('/auth');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('No encontramos ese código. Copia el código completo del correo y vuelve a intentar.');
      } else if (axios.isAxiosError(err) && (err.response?.status === 400 || err.response?.status === 422)) {
        setError('El código no tiene el formato esperado. Copia el código completo del correo.');
      } else if (axios.isAxiosError(err) && err.response?.status === 410) {
        setError('Tu código expiró. Escríbenos para reactivar tu postulación.');
      } else {
        setError('No pudimos continuar tu iniciativa ahora mismo. Inténtalo de nuevo en un momento.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <KeyRound size={22} />
      </div>
      <h1 className="text-center text-2xl text-slate-950" style={{ fontWeight: 850 }}>
        Continúa tu iniciativa
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-500">
        Ingresa el código de postulación que te enviamos por correo para retomar tu propuesta donde la dejaste.
      </p>

      <form onSubmit={handleSubmit} className="mt-7">
        <label htmlFor="pilot-code" className="block text-sm text-slate-700" style={{ fontWeight: 700 }}>
          Código de postulación
        </label>
        <input
          id="pilot-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoFocus
          placeholder="ST-PILOT-…"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm uppercase tracking-wide text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />

        {error && (
          <p className="mt-3 flex items-start gap-2 text-sm text-rose-600">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          style={{ fontWeight: 850 }}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Recuperando…
            </>
          ) : (
            <>
              <ArrowRight size={15} />
              Continuar
            </>
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate('/public/start')}
        className="mx-auto mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        <ArrowLeft size={14} />
        Empezar una propuesta nueva
      </button>
    </section>
  );
}
