import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../app/components/ui/button';
import { createIdempotencyKey } from './idempotency';
import { getClaimedPortfolioEntrySession } from './portfolioEntryPublicService';
import {
  continuePortfolioSetup, getPortfolioSetupContinuity, portfolioSetupErrorCode, portfolioSetupHttpStatus,
} from './portfolioSetupContinuity.client';
import type { PortfolioSetupContinuityRead, PortfolioSetupContinueResponse } from './portfolioSetupContinuity.types';
import type { StarteriaPathSupportedDto } from './starteriaPath.types';

type UiState = PortfolioSetupContinuityRead['status'] | 'LOADING_CONTEXT' | 'CONTINUATION_READY';
type Intent = { fingerprint: string; key: string };
type Props = {
  sessionId: string;
  path: StarteriaPathSupportedDto;
  onReviewSource: () => void;
  onStartNewEntry: () => void;
};

const sourceFingerprint = (dto: PortfolioSetupContinuityRead) => JSON.stringify(dto.sourceBinding);

export function PortfolioSetupContinuityExperience({ sessionId, path, onReviewSource, onStartNewEntry }: Props) {
  const [state, setState] = useState<UiState>('LOADING_CONTEXT');
  const [read, setRead] = useState<PortfolioSetupContinuityRead | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [success, setSuccess] = useState<PortfolioSetupContinueResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const intent = useRef<Intent | null>(null);
  const previousSource = useRef<string | null>(null);

  const reload = useCallback(async (reviewAfterConflict = false) => {
    const sequence = ++requestSequence.current;
    setState('LOADING_CONTEXT');
    setNotice(null);
    try {
      const [dto, session] = await Promise.all([
        getPortfolioSetupContinuity(sessionId), getClaimedPortfolioEntrySession(sessionId),
      ]);
      if (sequence !== requestSequence.current) return;
      if (session.id !== sessionId || session.ownership.state !== 'CLAIMED'
        || !Number.isSafeInteger(session.revision) || session.revision < 0) throw new Error('Invalid owned session');
      const fingerprint = sourceFingerprint(dto);
      if (previousSource.current !== null && previousSource.current !== fingerprint) {
        intent.current = null;
        setSelectedId(null);
      }
      previousSource.current = fingerprint;
      setRevision(session.revision);
      setRead(dto);
      setSuccess(null);
      setSelectedId((current) => dto.authorizedScopes?.some((scope) => scope.organizationId === current) ? current : null);
      const binding = dto.sourceBinding;
      const pathCurrent = binding && binding.sessionId === sessionId
        && path.sourceBinding.current && path.sourceBinding.confirmed
        && path.sourceBinding.criticalHandoffId === binding.criticalHandoffId
        && path.sourceBinding.criticalHandoffVersion === binding.criticalHandoffVersion
        && path.sourceBinding.sourceContextRevision === binding.contextRevision;
      setState(binding && !pathCurrent ? 'STALE_SOURCE' : dto.status);
      if (reviewAfterConflict) {
        intent.current = null;
        setSelectedId(null);
        setNotice('El contexto o el acceso cambió. Revisa esta información antes de continuar.');
      }
    } catch {
      if (sequence !== requestSequence.current) return;
      setRead(null);
      setRevision(null);
      setState('ERROR');
    }
  }, [sessionId, path]);

  useEffect(() => {
    void reload();
    return () => { requestSequence.current += 1; };
  }, [reload]);

  const choose = (organizationId: string) => {
    if (!read?.authorizedScopes?.some((scope) => scope.organizationId === organizationId)) return;
    if (selectedId !== organizationId) intent.current = null;
    setSelectedId(organizationId);
  };

  const continueNow = async () => {
    if (pending || revision === null || !read?.sourceBinding
      || !['READY_AUTHORIZED_SCOPE', 'SELECT_SCOPE'].includes(state)) return;
    const scope = state === 'READY_AUTHORIZED_SCOPE' ? read.currentScope
      : read.authorizedScopes?.find((item) => item.organizationId === selectedId);
    if (!scope) return;
    const source = read.sourceBinding;
    const pathBinding = path.sourceBinding;
    if (pathBinding.criticalHandoffId !== source.criticalHandoffId
      || pathBinding.criticalHandoffVersion !== source.criticalHandoffVersion
      || pathBinding.sourceContextRevision !== source.contextRevision) {
      intent.current = null;
      setState('STALE_SOURCE');
      return;
    }
    const sourceBinding = {
      ...source,
      starteriaPath: {
        projectionVersion: pathBinding.projectionVersion,
        schemaVersion: pathBinding.pathSchemaVersion,
        boundaryVersion: pathBinding.businessCapabilityBoundaryVersion,
        criticalHandoffId: pathBinding.criticalHandoffId,
        criticalHandoffVersion: pathBinding.criticalHandoffVersion,
        sourceContextRevision: pathBinding.sourceContextRevision,
      },
    };
    const request = {
      expectedSessionRevision: revision,
      sourceBinding,
      ...(state === 'SELECT_SCOPE' || (read.authorizedScopes?.length ?? 0) > 1
        ? { organizationId: scope.organizationId } : {}),
    };
    const fingerprint = JSON.stringify({ sourceBinding, scope: scope.organizationId });
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, key: createIdempotencyKey('portfolio-setup-continuity') };
    }
    setPending(true);
    setNotice(null);
    try {
      const result = await continuePortfolioSetup(sessionId, request, intent.current.key);
      if (result.organizationScopeId !== scope.organizationId) throw new Error('Unexpected scope in response');
      setSuccess(result);
      setState('CONTINUATION_READY');
    } catch (error) {
      const code = portfolioSetupErrorCode(error);
      const status = portfolioSetupHttpStatus(error);
      if (code === 'STALE_SOURCE' || code === 'UNSUPPORTED_SOURCE_VERSION') {
        intent.current = null;
        await reload(true);
      } else if (code === 'PROFILE_CONFLICT') {
        intent.current = null;
        setState('PROFILE_CONFLICT');
      } else if (code === 'SCOPE_VALIDATION_FAILED') {
        intent.current = null;
        setState('SCOPE_VALIDATION_FAILED');
      } else if (code === 'NO_AUTHORIZED_SCOPE' || code === 'SCOPE_NOT_AUTHORIZED'
        || code === 'SCOPE_SELECTION_REQUIRED' || code === 'STALE_SESSION_REVISION'
        || code === 'IDEMPOTENCY_CONFLICT' || status === 409 || status === 403) {
        intent.current = null;
        await reload(true);
      } else if (status === 401 || status === 404) {
        intent.current = null;
        setRead(null);
        setState('ERROR');
        setNotice('No pudimos verificar tu sesión. Vuelve a iniciar sesión o empieza una lectura nueva.');
      } else {
        // A network failure may have happened after commit. Keep the exact logical intent and key.
        setNotice('No pudimos confirmar el resultado. Puedes reintentar con el mismo contexto.');
      }
    } finally {
      setPending(false);
    }
  };

  if (state === 'LOADING_CONTEXT') return (
    <section className="mx-auto max-w-3xl min-w-0 rounded-ds-lg border border-border-default bg-surface-default p-5" role="status" aria-live="polite" aria-busy="true" data-testid="portfolio-setup-loading">
      <h2 className="text-xl font-semibold text-text-primary">Recuperando tu contexto</h2>
      <p className="mt-2 text-sm text-text-secondary">Starteria está comprobando lo que ya confirmaste y dónde puede continuar.</p>
    </section>
  );

  const scope = state === 'CONTINUATION_READY'
    ? read?.authorizedScopes?.find((item) => item.organizationId === success?.organizationScopeId)
    : read?.currentScope;
  return (
    <section className="mx-auto max-w-3xl min-w-0 space-y-5 rounded-ds-lg border border-border-default bg-surface-default p-5 sm:p-7" data-testid="portfolio-setup-continuity" aria-labelledby="portfolio-setup-heading">
      <div>
        <p className="text-sm font-medium text-text-secondary">Continuidad de tu lectura</p>
        <h2 id="portfolio-setup-heading" className="mt-1 text-xl font-semibold text-text-primary">Retomamos lo que ya entendimos</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Tu trabajo de entrada sigue disponible mientras comprobamos cómo puede continuar.</p>
      </div>
      {read?.carriedContext && state !== 'STALE_SOURCE' ? (
        <div className="min-w-0 rounded-ds-md border border-border-default p-4">
          <h3 className="font-semibold text-text-primary">Esto es lo que confirmaste que representa tu situación</h3>
          {read.carriedContext.criticalReading && <p className="mt-2 break-words text-sm leading-6 text-text-secondary">{read.carriedContext.criticalReading}</p>}
          {read.carriedContext.decisionInView && <p className="mt-2 break-words text-sm leading-6 text-text-secondary">Decisión en vista: {read.carriedContext.decisionInView}</p>}
          <p className="mt-2 text-xs text-text-secondary">Es una representación de tu contexto; aún no establece una verdad organizacional.</p>
        </div>
      ) : null}
      {read && state !== 'STALE_SOURCE' && (
        <div className="min-w-0 rounded-ds-md border border-border-default p-4">
          <h3 className="font-semibold text-text-primary">Cómo puede ayudar Starteria ahora</h3>
          <p className="mt-2 break-words text-sm leading-6 text-text-secondary">{path.valueBridge.starteriaContribution[0]?.statement || path.boundaryStatement}</p>
          <p className="mt-2 text-xs text-text-secondary">{path.boundaryStatement}</p>
        </div>
      )}
      {read?.openItems.length && state !== 'STALE_SOURCE' ? (
        <div className="min-w-0">
          <h3 className="font-semibold text-text-primary">Esto aún necesita validación o contexto</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {read.openItems.slice(0, 3).map((item, index) => <li className="break-words" key={`${item.sourceRef}:${index}`}>{item.description}</li>)}
          </ul>
        </div>
      ) : null}
      <div aria-live="polite" role="status" className="space-y-3 text-sm leading-6 text-text-secondary">
        {notice && <p>{notice}</p>}
        {state === 'READY_PROVISIONAL' && <p>Tu avance está guardado. Aún no hay un espacio de portafolio al que puedas acceder con esta sesión. No hiciste nada mal; podrás volver a comprobarlo más adelante.</p>}
        {state === 'NO_AUTHORIZED_SCOPE' && <p>Tu contexto propio sigue guardado. Ya no encontramos un espacio de portafolio accesible para continuar. No hiciste nada mal.</p>}
        {state === 'SCOPE_VALIDATION_FAILED' && <p>Starteria no pudo verificar tus espacios de portafolio ahora mismo. Vuelve a intentarlo.</p>}
        {state === 'STALE_SOURCE' && <p>La lectura que confirmó este camino cambió. Revisa la lectura actual antes de continuar.</p>}
        {state === 'PROFILE_CONFLICT' && <p>Esta sesión no puede continuar con seguridad en el recorrido actual. Si es una sesión anterior, puedes comenzar una lectura nueva sin reparar ni cambiar tu perfil automáticamente.</p>}
        {state === 'BLOCKED_AUTHORITY' && <p>Tu contexto propio está conservado. Falta una autorización organizacional necesaria para esa acción; Starteria no puede realizarla todavía.</p>}
        {state === 'ERROR' && <p>No pudimos recuperar esta continuidad. Puedes reintentar con la misma sesión.</p>}
        {state === 'READY_AUTHORIZED_SCOPE' && scope && <p>Podemos preparar la continuidad en <strong>{scope.name}</strong>. El acceso se comprobará de nuevo al continuar.</p>}
        {state === 'CONTINUATION_READY' && <p>La continuidad quedó preparada{scope ? ` para ${scope.name}` : ''}. Tu contexto podrá seguir sin repetir el trabajo de entrada. El siguiente paso será continuar al portafolio cuando ese acceso esté disponible.</p>}
      </div>
      {state === 'SELECT_SCOPE' && (
        <fieldset className="min-w-0 space-y-2">
          <legend className="font-semibold text-text-primary">Elige dónde continuar</legend>
          <p className="text-sm text-text-secondary">Selecciona uno de los espacios a los que tienes acceso ahora.</p>
          {read?.authorizedScopes?.map((item) => (
            <label key={item.organizationId} className="flex min-w-0 cursor-pointer items-start gap-3 rounded-ds-md border border-border-default p-3 focus-within:ring-2 focus-within:ring-primary">
              <input type="radio" name="portfolio-setup-scope" value={item.organizationId}
                checked={selectedId === item.organizationId} onChange={() => choose(item.organizationId)} className="mt-1" />
              <span className="min-w-0 break-words text-sm text-text-primary">{item.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-3">
        {(state === 'READY_AUTHORIZED_SCOPE' || state === 'SELECT_SCOPE') && (
          <Button type="button" onClick={() => void continueNow()} disabled={pending || (state === 'SELECT_SCOPE' && !selectedId)}>
            {pending ? 'Preparando continuidad…' : 'Continuar con este contexto'}
          </Button>
        )}
        {['READY_PROVISIONAL', 'NO_AUTHORIZED_SCOPE', 'SCOPE_VALIDATION_FAILED', 'ERROR'].includes(state)
          && <Button type="button" variant="outline" onClick={() => void reload()} disabled={pending}>Volver a comprobar</Button>}
        {state === 'STALE_SOURCE' && <Button type="button" variant="outline" onClick={onReviewSource}>Revisar lectura actual</Button>}
        {state === 'PROFILE_CONFLICT' && <Button type="button" variant="outline" onClick={onStartNewEntry}>Empezar una lectura nueva</Button>}
      </div>
    </section>
  );
}
