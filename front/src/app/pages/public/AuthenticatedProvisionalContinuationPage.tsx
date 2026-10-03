import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CheckCircle2, PencilLine } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useApp } from '../../context/AppContext';
import {
  getAuthenticatedProvisionalContinuation,
  confirmAuthenticatedProvisionalContinuation,
  getPortfolioEntryContexts,
  continuePortfolioEntryToPortfolio,
  normalizePortfolioEntryApiError,
} from '../../../features/portfolio-entry/public/portfolioEntryPublicService';
import { createIdempotencyKey } from '../../../features/portfolio-entry/public/idempotency';
import { readClaimedPortfolioEntrySession } from '../../../features/portfolio-entry/public/storage';
import { saveClaimedPortfolioEntrySession } from '../../../features/portfolio-entry/public/storage';
import { portfolioEntryBriefIdentityFromSession } from '../../../features/portfolio-entry/public/continuationIdentity';
import type { PortfolioEntryContextResolution, PortfolioEntrySessionDto } from '../../../features/portfolio-entry/public/types';

function displayText(value: { value: string } | 'unresolved' | undefined): string {
  if (!value || value === 'unresolved') return 'Todavía necesitamos aclararlo.';
  return value.value;
}

type StrategicReviewDraft = Record<string, string>;

const STRATEGIC_READING_FIELDS = [
  { key: 'understood_need', label: 'Qué entendió Starteria' },
  { key: 'desired_outcome', label: 'Resultado deseado' },
  { key: 'decision_to_enable', label: 'Decisión que buscas habilitar' },
  { key: 'known_context', label: 'Contexto conocido (una clave: valor por línea)' },
  { key: 'unresolved_context', label: 'Puntos que siguen sin resolverse (uno por línea)' },
  { key: 'evidence_or_clarity_needed', label: 'Evidencia o claridad que hace falta (una por línea)' },
] as const;

function strategicReviewValues(session: PortfolioEntrySessionDto): StrategicReviewDraft {
  const handoff = session.handoff?.handoff;
  if (!handoff) return {};
  return {
    understood_need: handoff.understanding.value,
    desired_outcome: handoff.desired_outcome.value,
    decision_to_enable: handoff.decision_to_enable === 'unresolved' ? '' : handoff.decision_to_enable.value,
    known_context: handoff.known_context.map((item) => `${item.key}: ${item.value}`).join('\n'),
    unresolved_context: handoff.unresolved_context.map((item) => item.description).join('\n'),
    evidence_or_clarity_needed: handoff.evidence_or_clarity_needed.map((item) => item.value).join('\n'),
  };
}

export function AuthenticatedProvisionalContinuationPage() {
  const { isAuthenticated, authLoading } = useApp();
  const navigate = useNavigate();
  const [session, setSession] = useState<PortfolioEntrySessionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [understoodNeed, setUnderstoodNeed] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [strategicDraft, setStrategicDraft] = useState<StrategicReviewDraft>({});
  const [approachDecision, setApproachDecision] = useState<'include' | 'edit' | 'omit' | null>(null);
  const [approachDraft, setApproachDraft] = useState('');
  const [contexts, setContexts] = useState<PortfolioEntryContextResolution | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }
    const claimed = readClaimedPortfolioEntrySession();
    if (!claimed) {
      setError('No encontramos una entrada guardada en esta cuenta.');
      return;
    }
    let cancelled = false;
    Promise.all([
      getAuthenticatedProvisionalContinuation(claimed.sessionId),
      getPortfolioEntryContexts(claimed.sessionId),
    ])
      .then(([next, resolvedContexts]) => {
        if (!cancelled) {
          setSession(next);
          setContexts(resolvedContexts);
          if (resolvedContexts.contexts.length === 1) setSelectedOrganizationId(resolvedContexts.contexts[0]?.organizationId ?? null);
          setStrategicDraft(strategicReviewValues(next));
          setUnderstoodNeed(next.provisionalContinuation?.payload.understoodNeed.value ?? '');
          setDesiredOutcome(next.provisionalContinuation?.payload.desiredOutcome.value ?? '');
          setApproachDraft(next.handoff?.handoff.recommended_approach?.description ?? '');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(normalizePortfolioEntryApiError(err).message);
      });
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || (!session && !error)) {
    return <p className="py-16 text-center text-sm text-text-muted">Estamos recuperando lo que ya conversamos.</p>;
  }

  if (error || !session?.provisionalContinuation) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-2xl font-semibold text-text-primary">No pudimos recuperar tu entrada</h1>
          <p className="text-sm leading-6 text-text-secondary">{error ?? 'La información guardada todavía no está disponible.'}</p>
          <Button type="button" variant="outline" onClick={() => navigate('/public/start')}>Volver</Button>
        </CardContent>
      </Card>
    );
  }

  const continuation = session.provisionalContinuation;
  const { payload } = continuation;
  const handoff = session.handoff?.handoff;

  const saveConfirmation = async () => {
    if (!handoff) return;
    if (contexts?.contexts.length === 0) return;
    if (contexts && contexts.contexts.length > 1 && !selectedOrganizationId) {
      setError('Selecciona un espacio autorizado para continuar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (handoff.recommended_approach && !approachDecision) {
        setError('Decide si quieres incluir la propuesta de Starteria como hipótesis.');
        setSaving(false);
        return;
      }
      const original = strategicReviewValues(session);
      const acceptedFields = Object.entries(strategicDraft)
        .filter(([field, value]) => value.trim() && value.trim() === (original[field] ?? '').trim())
        .map(([field]) => field);
      const rejectedFields = Object.entries(original)
        .filter(([field, value]) => value.trim() && !(strategicDraft[field] ?? value).trim())
        .map(([field]) => field);
      const correctedFields: Record<string, unknown> = {};
      for (const [field, originalValue] of Object.entries(original)) {
        const currentValue = (strategicDraft[field] ?? originalValue).trim();
        if (currentValue && currentValue !== originalValue.trim()) correctedFields[field] = currentValue;
      }
      if (handoff.recommended_approach) {
        if (approachDecision === 'include') acceptedFields.push('recommended_approach');
        if (approachDecision === 'omit') rejectedFields.push('recommended_approach');
        if (approachDecision === 'edit' && approachDraft.trim()) correctedFields.recommended_approach = approachDraft.trim();
        if (approachDecision === 'edit' && !approachDraft.trim()) rejectedFields.push('recommended_approach');
      }
      const next = await confirmAuthenticatedProvisionalContinuation(continuation.sessionId, {
        expectedRevision: continuation.revision,
        idempotencyKey: createIdempotencyKey('portfolio-entry:confirmation'),
        acceptedFields,
        correctedFields,
        rejectedFields,
      });
      const identity = portfolioEntryBriefIdentityFromSession(next);
      if (identity) saveClaimedPortfolioEntrySession(identity);
      setSession(next);
      setEditing(false);
      const selected = await continuePortfolioEntryToPortfolio(continuation.sessionId, {
        expectedRevision: next.provisionalContinuation?.revision ?? continuation.revision,
        organizationId: selectedOrganizationId ?? undefined,
        idempotencyKey: createIdempotencyKey('portfolio-entry:context-selection'),
      });
      navigate(selected.destinationRoute);
    } catch (err) {
      setError(normalizePortfolioEntryApiError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="mx-auto max-w-3xl space-y-6 py-6" data-testid="authenticated-provisional-continuation">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Tu entrada guardada</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Esto es lo que entendimos</h1>
        <p className="text-base leading-7 text-text-secondary">Retomamos la misma conversación después de iniciar sesión. No necesitas empezar de nuevo.</p>
      </header>

      <Card data-testid="portfolio-context-selection">
        <CardHeader><CardTitle>Elige dónde continuar</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-6 text-sm leading-6 text-text-secondary">
          {contexts && contexts.contexts.length === 0 && <p data-testid="no-authorized-context">Tu avance está guardado. Antes de seguir necesitamos ubicar en qué espacio de tu organización corresponde trabajarlo.</p>}
          {contexts?.contexts.length === 1 && contexts.contexts[0] && <p data-testid="single-authorized-context">Continuaremos en <span className="font-semibold text-text-primary">{contexts.contexts[0].name}</span>.</p>}
          {contexts && contexts.contexts.length > 1 && <fieldset className="space-y-2" aria-label="Espacios autorizados">
            <legend>Selecciona un espacio para continuar:</legend>
            {contexts.contexts.map((context) => <label key={context.organizationId} className="flex cursor-pointer items-center gap-2 rounded-md border border-border-default p-3 text-text-primary">
              <input type="radio" name="portfolio-context" value={context.organizationId} checked={selectedOrganizationId === context.organizationId} onChange={() => setSelectedOrganizationId(context.organizationId)} />
              {context.name}
            </label>)}
          </fieldset>}
        </CardContent>
      </Card>

      <Card data-testid="strategic-intent-review">
        <CardHeader>
          <CardTitle>Confirma esta lectura</CardTitle>
          <p className="text-sm leading-6 text-text-secondary">Al confirmarla, aceptas este punto de partida. Los puntos abiertos siguen sin resolverse; la propuesta de Starteria requiere una decisión aparte.</p>
        </CardHeader>
        <CardContent className="space-y-4 pb-6 text-sm leading-6 text-text-secondary">
          {STRATEGIC_READING_FIELDS.map(({ key, label }) => (
            <label key={key} className="block space-y-2 text-text-primary">
              <span className="font-semibold">{label}</span>
              {editing ? (
                <textarea
                  aria-label={label}
                  className="min-h-20 w-full rounded-md border border-border-default p-3 font-normal"
                  value={strategicDraft[key] ?? ''}
                  onChange={(event) => setStrategicDraft((current) => ({ ...current, [key]: event.target.value }))}
                />
              ) : (
                <span className="block whitespace-pre-wrap font-normal" data-testid={key === 'understood_need' ? 'understood-need' : key === 'desired_outcome' ? 'desired-outcome' : key}>
                  {strategicDraft[key]?.trim() || 'No incluido en esta lectura.'}
                </span>
              )}
            </label>
          ))}
        </CardContent>
      </Card>

      {handoff?.recommended_approach ? (
        <Card data-testid="recommended-approach-review">
          <CardHeader><CardTitle>Propuesta de Starteria · hipótesis, no plan decidido</CardTitle></CardHeader>
          <CardContent className="space-y-3 pb-6 text-sm leading-6 text-text-secondary">
            <p>{handoff.recommended_approach.description}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={approachDecision === 'include' ? 'default' : 'outline'} onClick={() => setApproachDecision('include')} disabled={saving}>Incluir como hipótesis</Button>
              <Button type="button" variant={approachDecision === 'edit' ? 'default' : 'outline'} onClick={() => setApproachDecision('edit')} disabled={saving}>Ajustar</Button>
              <Button type="button" variant={approachDecision === 'omit' ? 'default' : 'outline'} onClick={() => setApproachDecision('omit')} disabled={saving}>No incluir</Button>
            </div>
            {approachDecision === 'edit' && (
              <label className="block space-y-2 text-text-primary">Hipótesis ajustada
                <textarea aria-label="Hipótesis ajustada" className="min-h-20 w-full rounded-md border border-border-default p-3 font-normal" value={approachDraft} onChange={(event) => setApproachDraft(event.target.value)} />
              </label>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="hidden">
        <CardHeader><CardTitle>Lo que quieres lograr</CardTitle></CardHeader>
        <CardContent className="space-y-4 pb-6 text-sm leading-6 text-text-secondary">
          {editing ? (
            <label className="block space-y-2 text-sm text-text-primary">Qué entendimos de tu necesidad
              <textarea aria-label="Qué entendió Starteria" className="min-h-24 w-full rounded-md border border-border-default p-3" value={understoodNeed} onChange={(event) => setUnderstoodNeed(event.target.value)} />
            </label>
          ) : <p data-testid="understood-need">{displayText(payload.understoodNeed)}</p>}
          <div>
            <p className="font-semibold text-text-primary">Resultado que buscas</p>
            {editing ? (
              <textarea aria-label="Resultado que buscas" className="mt-2 min-h-20 w-full rounded-md border border-border-default p-3" value={desiredOutcome} onChange={(event) => setDesiredOutcome(event.target.value)} />
            ) : <p data-testid="desired-outcome">{displayText(payload.desiredOutcome)}</p>}
          </div>
        </CardContent>
      </Card>

      {payload.knownContext.length > 0 && (
        <Card className="hidden">
          <CardHeader><CardTitle>Contexto útil que ya conocemos</CardTitle></CardHeader>
          <CardContent className="space-y-3 pb-6 text-sm text-text-secondary">
            {payload.knownContext.map((item) => <p key={item.key}><span className="font-semibold text-text-primary">{item.key}:</span> {item.value}</p>)}
          </CardContent>
        </Card>
      )}

      {(payload.currentOpenItems.length > 0 || payload.organizationalUnknowns.length > 0) && (
        <Card className="hidden">
          <CardHeader><CardTitle>Lo que todavía necesitamos resolver</CardTitle></CardHeader>
          <CardContent className="space-y-3 pb-6 text-sm leading-6 text-text-secondary">
            {payload.currentOpenItems.map((item, index) => <p key={`open-${index}`} data-testid="open-item">{displayText(item)}</p>)}
            {payload.organizationalUnknowns.map((item) => <p key={item.gap_id} data-testid="organizational-unknown">{item.description}</p>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Confirmación y continuidad</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-6 text-sm leading-6 text-text-secondary">
          <p>Confirma la lectura estratégica y decide por separado si quieres incluir la propuesta como hipótesis.</p>
        </CardContent>
        <div className="flex flex-wrap gap-3 border-t border-border-default px-6 py-4">
          {editing ? (
            <>
              <Button type="button" onClick={saveConfirmation} disabled={saving}>{saving ? 'Guardando…' : 'Confirmar esta lectura y continuar'}</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setEditing(true)}><PencilLine size={16} /> Ajustar lectura</Button>
              <Button type="button" onClick={saveConfirmation} disabled={saving || contexts?.contexts.length === 0 || (contexts && contexts.contexts.length > 1 && !selectedOrganizationId) || Boolean(handoff?.recommended_approach && !approachDecision)}>{saving ? 'Guardando…' : 'Confirmar esta lectura y continuar'} <ArrowRight size={16} /></Button>
            </>
          )}
        </div>
      </Card>

      <p className="flex items-center gap-2 text-xs text-text-muted"><CheckCircle2 size={14} /> Entrada recuperada: {continuation.sessionId}</p>
    </main>
  );
}
