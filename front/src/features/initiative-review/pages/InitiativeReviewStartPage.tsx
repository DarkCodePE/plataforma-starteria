/**
 * InitiativeReviewStartPage - entrada previa al Step 0.
 * Crea la revision inicial via API real y navega al resultado guiado.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SelectedCompanyContext } from '../../../app/components/company-context/CompanyContextSelector';
import { InitiativeComposer } from '../components/InitiativeComposer';
import { createReview } from '../services/initiativeReviewClient';
import { trackInitialReviewEvent } from '../services/initialReviewTelemetry';

export function InitiativeReviewStartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handoffAssignmentId = searchParams.get('handoffAssignmentId') ?? undefined;
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyCompanyMessage, setEmptyCompanyMessage] = useState<string | null>(null);
  const [companyContext, setCompanyContext] = useState<SelectedCompanyContext | null>(null);

  const canSubmit = input.trim().length >= 40 && !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setEmptyCompanyMessage(companyContext?.companyId ? null : 'Puedes continuar sin empresa. El analisis tendra un enfoque mas general.');
    try {
      trackInitialReviewEvent('initial_review_started', { source: 'initiatives_new' });
      const review = handoffAssignmentId
        ? await createReview(input.trim(), [], companyContext, handoffAssignmentId)
        : await createReview(input.trim(), [], companyContext);
      trackInitialReviewEvent('initial_review_generated', {
        reviewId: review.id,
        snapshotId: review.snapshot?.id,
        snapshotVersion: review.snapshot?.version,
        contextCount: 0,
        hasCompanyContext: Boolean(companyContext?.companyId),
      });
      navigate(`/initiatives/review/${review.id}`);
    } catch {
      setError('No pudimos iniciar la revision. Intenta nuevamente.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">¿Qué iniciativa quieres ordenar?</h1>
      <p className="mt-2 text-sm text-slate-500">
        Describe una idea, problema, oportunidad o proyecto. Starteria lo revisará y te ayudará a convertirlo en una ruta clara.
      </p>

      <InitiativeComposer
        value={input}
        onChange={setInput}
        companyContext={companyContext}
        onCompanyContextChange={(next) => {
          setCompanyContext(next);
          if (next?.companyId) setEmptyCompanyMessage(null);
        }}
        onSubmit={onSubmit}
        busy={busy}
        error={error}
        emptyCompanyMessage={emptyCompanyMessage}
      />
    </div>
  );
}
