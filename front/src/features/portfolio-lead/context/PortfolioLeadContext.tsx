import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../app/context/AppContext';
import * as portfolioService from '../../../app/services/portfolioService';
import {
  adaptStrategicFront,
  adaptChallenge,
  adaptInitiative,
  toBackendStrategicFront,
  toBackendChallenge,
  toBackendInitiativeMeta,
} from '../domain/adapters';
import {
  buildChallengeActivationMessageDraft,
  buildDefaultActivationInputs,
  buildDecisionRecommendation,
  buildExecutiveOutput,
  buildSeededChallengeInitiatives,
  deriveChallengeActivationRecommendation,
  patchChallenge,
  syncChallengeSummaries,
} from '../domain/actions';
import {
  DEFAULT_CHALLENGES,
  DEFAULT_EXECUTIVE_OUTPUTS,
  DEFAULT_INITIATIVES,
  DEFAULT_INITIATIVE_OVERLAPS,
  DEFAULT_PORTFOLIO_DECISIONS,
  DEFAULT_STRATEGIC_FRONTS,
} from '../domain/mockData';
import {
  getDecisionsByInitiativeId,
  getExecutiveOutputByInitiativeId,
  getFrontById,
} from '../domain/selectors';
import type {
  Challenge,
  ChallengeActivationMode,
  CreateChallengeInput,
  CreateStrategicFrontInput,
  ExecutiveOutput,
  ExecutiveOutputStatus,
  InitiativeEditableMeta,
  InvitationStatus,
  Initiative,
  InitiativeOverlap,
  PortfolioDecisionItem,
  PortfolioDecisionOutcome,
  PortfolioLeadContextValue,
  SquadRole,
  StakeholderStatus,
  StrategicFront,
  StrategicFrontStatus,
} from '../domain/types';

type WithId = { id: string };

/**
 * #104 — optimistic CREATE. The temp row is already in state; once the backend confirms,
 * swap it for the real (finalized) row; on failure, drop it. Keeps the handler synchronous
 * (callers still get the temp object immediately).
 */
function persistCreate<Raw, T extends WithId>(
  tempId: string,
  call: () => Promise<Raw>,
  finalize: (raw: Raw) => T,
  setList: React.Dispatch<React.SetStateAction<T[]>>,
  label: string,
): void {
  call()
    .then((raw) => setList((prev) => prev.map((it) => (it.id === tempId ? finalize(raw) : it))))
    .catch((err) => {
      setList((prev) => prev.filter((it) => it.id !== tempId));
      // eslint-disable-next-line no-console
      console.error(`[portfolio] create ${label} failed — reverted`, err);
    });
}

/**
 * #104 — optimistic UPDATE. State is already mutated; on backend failure, restore the
 * pre-change snapshot.
 */
function persistUpdate<T>(
  call: () => Promise<unknown>,
  snapshot: T[],
  setList: React.Dispatch<React.SetStateAction<T[]>>,
  label: string,
): void {
  call().catch((err) => {
    setList(snapshot);
    // eslint-disable-next-line no-console
    console.error(`[portfolio] update ${label} failed — reverted`, err);
  });
}

/**
 * #104 — reconcile a backend-confirmed Challenge into a list, preserving the front-only
 * computed fields the backend doesn't store (activationInputs/recommendation/draft).
 */
function reconcileChallenge(prev: Challenge[], challengeId: string, raw: unknown): Challenge[] {
  return prev.map((c) =>
    c.id === challengeId
      // MVP-P0-02: ya NO se preservan a mano activationInputs/RecommendationNote/MessageDraft.
      // Ese override existia porque adaptChallenge los pisaba con defaults; ahora los lee del
      // backend, y mantenerlo haria justo lo contrario de lo que hace falta — ignorar lo que
      // el servidor acaba de confirmar.
      ? adaptChallenge(raw as Record<string, unknown>)
      : c,
  );
}

/**
 * #104 — optimistic challenge-scoped mutation (squad, invitations, activation). The
 * backend endpoint returns the updated Challenge; on success we reconcile (adopting real
 * nested ids), on failure we restore the snapshot.
 */
function persistChallengeMutation(
  challengeId: string,
  call: () => Promise<unknown>,
  snapshot: Challenge[],
  setChallenges: React.Dispatch<React.SetStateAction<Challenge[]>>,
  label: string,
): void {
  call()
    .then((raw) => setChallenges((prev) => reconcileChallenge(prev, challengeId, raw)))
    .catch((err) => {
      setChallenges(snapshot);
      // eslint-disable-next-line no-console
      console.error(`[portfolio] ${label} failed — reverted`, err);
    });
}

const PortfolioLeadContext = createContext<PortfolioLeadContextValue | null>(null);

export function PortfolioLeadProvider({
  children,
  enableDemoData = false,
}: {
  children: ReactNode;
  enableDemoData?: boolean;
}) {
  const [strategicFronts, setStrategicFronts] = useState<StrategicFront[]>(() => enableDemoData ? DEFAULT_STRATEGIC_FRONTS : []);
  const [challenges, setChallenges] = useState<Challenge[]>(() => enableDemoData ? DEFAULT_CHALLENGES : []);
  const [initiatives, setInitiatives] = useState<Initiative[]>(() => enableDemoData ? DEFAULT_INITIATIVES : []);
  const [initiativeOverlaps, setInitiativeOverlaps] = useState<InitiativeOverlap[]>(() => enableDemoData ? DEFAULT_INITIATIVE_OVERLAPS : []);
  const [portfolioDecisions, setPortfolioDecisions] = useState<PortfolioDecisionItem[]>(() => enableDemoData ? DEFAULT_PORTFOLIO_DECISIONS : []);
  const [executiveOutputs, setExecutiveOutputs] = useState<ExecutiveOutput[]>(() => enableDemoData ? DEFAULT_EXECUTIVE_OUTPUTS : []);
  const [portfolioDataStatus, setPortfolioDataStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    enableDemoData ? 'ready' : 'idle',
  );

  useEffect(() => {
    if (!enableDemoData) {
      setStrategicFronts([]);
      setChallenges([]);
      setInitiatives([]);
      setInitiativeOverlaps([]);
      setPortfolioDecisions([]);
      setExecutiveOutputs([]);
      return;
    }

    setStrategicFronts(DEFAULT_STRATEGIC_FRONTS);
    setChallenges(DEFAULT_CHALLENGES);
    setInitiatives(DEFAULT_INITIATIVES);
    setInitiativeOverlaps(DEFAULT_INITIATIVE_OVERLAPS);
    setPortfolioDecisions(DEFAULT_PORTFOLIO_DECISIONS);
    setExecutiveOutputs(DEFAULT_EXECUTIVE_OUTPUTS);
  }, [enableDemoData]);

  // El provider monta global en RootLayout (también en la landing pública):
  // solo hidrata con sesión resuelta y autenticada — un visitante anónimo no
  // debe disparar llamadas autenticadas (401 → refresh → redirect a /auth).
  const { isAuthenticated, authLoading } = useApp();

  // #100: hydrate the read path from the real backend (frentes → retos → iniciativas).
  // The mock fixtures above are the initial/fallback state, kept if the API is empty or
  // unreachable so local dev still works. Mutations remain local for now (follow-up).
  const refreshPortfolioData = useCallback(async () => {
    setPortfolioDataStatus('loading');
    const rawFronts = await portfolioService.listStrategicFronts();
    if (!rawFronts || rawFronts.length === 0) {
      setPortfolioDataStatus('ready');
      return;
    }
    const fronts = rawFronts.map(adaptStrategicFront);
    const challengesByFront = await Promise.all(
      fronts.map((f) => portfolioService.listChallenges(f.id)),
    );
    const allChallenges = challengesByFront.flat().map(adaptChallenge);
    const initiativesByChallenge = await Promise.all(
      allChallenges.map((c) => portfolioService.listInitiatives(c.id)),
    );
    const allInitiatives = initiativesByChallenge.flat().map(adaptInitiative);
    setStrategicFronts(fronts);
    setChallenges(allChallenges);
    setInitiatives(allInitiatives);
    setPortfolioDataStatus('ready');
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshPortfolioData();
        if (cancelled) return;
      } catch (err) {
        setPortfolioDataStatus('error');
        if (!cancelled && !enableDemoData) {
          setStrategicFronts([]);
          setChallenges([]);
          setInitiatives([]);
        }
        // eslint-disable-next-line no-console
        console.error('[portfolio] backend truth unavailable; not substituting mock data', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, refreshPortfolioData]);

  const value = useMemo<PortfolioLeadContextValue>(() => ({
    strategicFronts,
    challenges,
    initiatives,
    initiativeOverlaps,
    portfolioDecisions,
    executiveOutputs,
    portfolioDataStatus,
    refreshPortfolioData,
    createStrategicFront: input => {
      const front: StrategicFront = {
        id: `front-${Date.now()}`,
        ...input,
        createdAt: new Date().toISOString().split('T')[0],
        lastUpdatedAt: new Date().toISOString().split('T')[0],
        challengeCount: 0,
        initiativeCount: 0,
      };

      setStrategicFronts(prev => [front, ...prev]);
      persistCreate(
        front.id,
        () => portfolioService.createStrategicFront(toBackendStrategicFront(input) as CreateStrategicFrontInput),
        (raw) => raw,
        setStrategicFronts,
        'strategic-front',
      );
      return front;
    },
    updateStrategicFront: (frontId, input) => {
      const snapshot = strategicFronts;
      setStrategicFronts(prev => prev.map(front => (
        front.id === frontId
          ? { ...front, ...input, lastUpdatedAt: new Date().toISOString().split('T')[0] }
          : front
      )));
      persistUpdate(
        () => portfolioService.updateStrategicFront(frontId, toBackendStrategicFront(input)),
        snapshot,
        setStrategicFronts,
        'strategic-front',
      );
    },
    updateStrategicFrontStatus: (frontId, status) => {
      const snapshot = strategicFronts;
      setStrategicFronts(prev => prev.map(front => (
        front.id === frontId
          ? { ...front, status, lastUpdatedAt: new Date().toISOString().split('T')[0] }
          : front
      )));
      persistUpdate(
        () => portfolioService.updateStrategicFront(frontId, toBackendStrategicFront({ status })),
        snapshot,
        setStrategicFronts,
        'strategic-front-status',
      );
    },
    createChallenge: input => {
      const challenge: Challenge = {
        id: `challenge-${Date.now()}`,
        ...input,
        createdAt: new Date().toISOString().split('T')[0],
        lastUpdatedAt: new Date().toISOString().split('T')[0],
        challengeOwnerStatus: input.challengeOwnerStatus ?? (input.status === 'draft' ? 'definido' : 'confirmado'),
        sponsorStatus: input.sponsorStatus ?? (input.sponsorName ? 'notificado' : 'definido'),
        openCallStatus: 'inactiva',
        selectedPeople: [],
        assignedSquad: [],
        initiativeCount: 0,
        coverageStatus: 'sin_cobertura',
        visibleToParticipants: false,
        publicationNotes: 'Todavia no esta visible para participantes.',
        activationInputs: {
          ...buildDefaultActivationInputs(input.sponsorStatus ?? 'definido'),
          ...input.activationInputs,
        },
        activationRecommendationNote: '',
        activationMessageDraft: '',
      };

      const front = getFrontById(strategicFronts, input.strategicFrontId);
      const recommendation = deriveChallengeActivationRecommendation(challenge, front);
      challenge.activationRecommendationNote = recommendation.justification;
      challenge.activationMessageDraft = buildChallengeActivationMessageDraft(challenge, recommendation, front);

      setChallenges(prev => [challenge, ...prev]);
      setStrategicFronts(prev =>
        prev.map(front =>
          front.id === input.strategicFrontId ? { ...front, challengeCount: front.challengeCount + 1 } : front,
        ),
      );
      persistCreate(
        challenge.id,
        () => portfolioService.createChallenge(input.strategicFrontId, toBackendChallenge(input) as CreateChallengeInput),
        (raw) => ({
          ...raw,
          activationInputs: challenge.activationInputs,
          activationRecommendationNote: challenge.activationRecommendationNote,
          activationMessageDraft: challenge.activationMessageDraft,
        }),
        setChallenges,
        'challenge',
      );
      return challenge;
    },
    updateChallenge: (challengeId, input) => {
      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          ...input,
          lastUpdatedAt: new Date().toISOString().split('T')[0],
        })),
      );
      persistUpdate(
        () => portfolioService.updateChallenge(challengeId, toBackendChallenge(input)),
        snapshot,
        setChallenges,
        'challenge',
      );
    },
    updateChallengeActivationMode: (challengeId, mode) => {
      const snapshot = challenges;
      const current = challenges.find(c => c.id === challengeId);
      const nextStatus = mode === 'mantener_en_definicion'
        ? 'draft'
        : current?.status === 'draft'
          ? 'listo_para_activar'
          : current?.status;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          activationMode: mode,
          status: mode === 'mantener_en_definicion'
            ? 'draft'
            : challenge.status === 'draft'
              ? 'listo_para_activar'
              : challenge.status,
          lastUpdatedAt: new Date().toISOString().split('T')[0],
        })),
      );
      persistUpdate(
        () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ activationMode: mode, status: nextStatus })),
        snapshot,
        setChallenges,
        'activation-mode',
      );
    },
    updateChallengeActivationInputs: (challengeId, input) => {
      const snapshot = challenges;
      const current = challenges.find(c => c.id === challengeId);
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => {
          const front = getFrontById(strategicFronts, challenge.strategicFrontId);
          const updated = {
            ...challenge,
            activationInputs: {
              ...challenge.activationInputs,
              ...input,
            },
          };
          const recommendation = deriveChallengeActivationRecommendation(updated, front);
          return {
            ...updated,
            activationRecommendationNote: challenge.activationRecommendationNote || recommendation.justification,
            activationMessageDraft: challenge.activationMessageDraft || buildChallengeActivationMessageDraft(updated, recommendation, front),
            lastUpdatedAt: new Date().toISOString().split('T')[0],
          };
        }),
      );
      // MVP-P0-02: se persiste el objeto COMPLETO (no el parche), porque la columna es un
      // Json que se reemplaza entero y zod exige los 9 ejes.
      if (current) {
        const merged = { ...current.activationInputs, ...input };
        persistChallengeMutation(
          challengeId,
          () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ activationInputs: merged })),
          snapshot,
          setChallenges,
          'updateChallengeActivationInputs',
        );
      }
    },
    updateChallengeStakeholderStatus: (challengeId, stakeholder, status) => {
      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          [stakeholder]: status,
          activationInputs: {
            ...challenge.activationInputs,
            sponsorStatus: stakeholder === 'sponsorStatus' ? status : challenge.activationInputs.sponsorStatus,
          },
          status: ['draft', 'listo_para_activar'].includes(challenge.status) ? 'listo_para_activar' : challenge.status,
        })),
      );
      persistUpdate(
        () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ [stakeholder]: status })),
        snapshot,
        setChallenges,
        'stakeholder-status',
      );
    },
    acceptChallengeActivationRecommendation: challengeId => {
      const snapshot = challenges;
      const current = challenges.find(c => c.id === challengeId);
      const recFront = current ? getFrontById(strategicFronts, current.strategicFrontId) : null;
      const rec = current ? deriveChallengeActivationRecommendation(current, recFront) : null;
      const nextStatus = current?.status === 'draft' ? 'listo_para_activar' : current?.status;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => {
          const front = getFrontById(strategicFronts, challenge.strategicFrontId);
          const recommendation = deriveChallengeActivationRecommendation(challenge, front);
          return {
            ...challenge,
            activationMode: recommendation.recommendedMode,
            activationRecommendationNote: recommendation.justification,
            activationMessageDraft: buildChallengeActivationMessageDraft(challenge, recommendation, front),
            status: challenge.status === 'draft' ? 'listo_para_activar' : challenge.status,
            lastUpdatedAt: new Date().toISOString().split('T')[0],
          };
        }),
      );
      if (rec) {
        persistUpdate(
          () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ activationMode: rec.recommendedMode, status: nextStatus })),
          snapshot,
          setChallenges,
          'accept-recommendation',
        );
      }
    },
    updateChallengeActivationRecommendationNote: (challengeId, note) => {
      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          activationRecommendationNote: note,
          lastUpdatedAt: new Date().toISOString().split('T')[0],
        })),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ activationRecommendationNote: note })),
        snapshot,
        setChallenges,
        'updateChallengeActivationRecommendationNote',
      );
    },
    updateChallengeActivationMessageDraft: (challengeId, draft) => {
      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          activationMessageDraft: draft,
          lastUpdatedAt: new Date().toISOString().split('T')[0],
        })),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ activationMessageDraft: draft })),
        snapshot,
        setChallenges,
        'updateChallengeActivationMessageDraft',
      );
    },
    activateOpenCall: challengeId => {
      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          openCallStatus: 'activa',
          status: 'activo_interno',
          publicationNotes: 'La convocatoria ya puede prepararse para publicacion.',
        })),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.activateOpenCall(challengeId),
        snapshot,
        setChallenges,
        'activateOpenCall',
      );
    },
    addSelectedPerson: (challengeId, value) => {
      const normalized = value.trim();
      if (!normalized) return;

      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          selectedPeople: [
            ...challenge.selectedPeople,
            {
              id: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              value: normalized,
              status: 'pendiente',
            },
          ],
          status: 'activo_interno',
          publicationNotes: 'Ya hay personas objetivo, pero aun falta publicar la invitacion.',
        })),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.addInvitation(challengeId, normalized),
        snapshot,
        setChallenges,
        'addInvitation',
      );
    },
    updateSelectedPersonStatus: (challengeId, invitationId, status) => {
      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          selectedPeople: challenge.selectedPeople.map(person =>
            person.id === invitationId ? { ...person, status } : person,
          ),
          status: challenge.visibleToParticipants ? challenge.status : 'activo_interno',
        })),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.updateInvitation(challengeId, invitationId, status),
        snapshot,
        setChallenges,
        'updateInvitation',
      );
    },
    addSquadMember: (challengeId, value, role) => {
      const normalized = value.trim();
      if (!normalized) return;

      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          assignedSquad: [
            ...challenge.assignedSquad,
            {
              id: `squad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              value: normalized,
              role,
            },
          ],
          status: 'activo_interno',
          publicationNotes: 'El squad ya esta definido internamente.',
        })),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.addSquadMember(challengeId, normalized, role),
        snapshot,
        setChallenges,
        'addSquadMember',
      );
    },
    updateSquadMemberRole: (challengeId, memberId, role) => {
      const snapshot = challenges;
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          assignedSquad: challenge.assignedSquad.map(member =>
            member.id === memberId ? { ...member, role } : member,
          ),
        })),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.updateSquadMember(challengeId, memberId, role),
        snapshot,
        setChallenges,
        'updateSquadMember',
      );
    },
    confirmAssignedSquad: challengeId => {
      const snapshot = challenges;
      const current = challenges.find(c => c.id === challengeId);
      const nextStatus = (current?.assignedSquad.length ?? 0) > 0 ? 'activo_interno' : 'listo_para_activar';
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          status: challenge.assignedSquad.length > 0 ? 'activo_interno' : 'listo_para_activar',
          publicationNotes: challenge.assignedSquad.length > 0
            ? 'El reto ya quedo activado internamente con squad asignado.'
            : challenge.publicationNotes,
        })),
      );
      persistUpdate(
        () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ status: nextStatus })),
        snapshot,
        setChallenges,
        'confirm-squad',
      );
    },
    activateChallenge: challengeId => {
      const snapshot = challenges;
      const current = challenges.find(c => c.id === challengeId);
      const canActivate = !!current && !!current.challengeOwner.trim() && current.challengeOwnerStatus === 'confirmado';
      const isPublishedMode = !!current && (current.activationMode === 'convocatoria_abierta' || current.activationMode === 'personas_seleccionadas' || current.activationMode === 'innovacion_abierta_partner_externo');
      const nextStatus = isPublishedMode ? 'recibiendo_iniciativas' : 'activo_interno';
      setChallenges(prev =>
        patchChallenge(prev, challengeId, challenge => {
          if (!challenge.challengeOwner.trim() || challenge.challengeOwnerStatus !== 'confirmado') {
            return {
              ...challenge,
              publicationNotes: 'Falta challenge owner confirmado para activar el reto.',
            };
          }

          const activationMode = challenge.activationMode;
          const isPublishedMode = activationMode === 'convocatoria_abierta' || activationMode === 'personas_seleccionadas' || activationMode === 'innovacion_abierta_partner_externo';

          return {
            ...challenge,
            visibleToParticipants: isPublishedMode,
            lastPublishedAt: isPublishedMode ? new Date().toISOString().split('T')[0] : challenge.lastPublishedAt,
            publicationNotes: challenge.sponsorStatus === 'confirmado'
              ? 'El reto ya quedo activado con sponsor confirmado.'
              : 'El reto se activo sin sponsor confirmado. Conviene monitorear riesgo de destrabe.',
            status: isPublishedMode ? 'recibiendo_iniciativas' : 'activo_interno',
          };
        }),
      );
      if (canActivate) {
        persistUpdate(
          () => portfolioService.updateChallenge(challengeId, toBackendChallenge({ visibleToParticipants: isPublishedMode, status: nextStatus })),
          snapshot,
          setChallenges,
          'activate-challenge',
        );
      }
    },
    publishChallenge: challengeId => {
      const snapshot = challenges;
      setChallenges(prev =>
        syncChallengeSummaries(
          patchChallenge(prev, challengeId, challenge => ({
            ...challenge,
            visibleToParticipants: true,
            publicationNotes:
              challenge.activationMode === 'convocatoria_abierta'
                ? 'Visible para participantes como reto abierto.'
                : challenge.activationMode === 'personas_seleccionadas'
                  ? 'Visible solo para participantes invitados.'
                  : 'Visible para el squad asignado como reto ya publicado.',
            lastPublishedAt: new Date().toISOString().split('T')[0],
            status: 'publicado',
          })),
          initiatives,
        ),
      );
      persistChallengeMutation(
        challengeId,
        () => portfolioService.publishChallenge(challengeId),
        snapshot,
        setChallenges,
        'publishChallenge',
      );
    },
    loadChallengeCoverageDemo: challengeId => {
      const challenge = challenges.find(item => item.id === challengeId);
      if (!challenge) return;
      const front = getFrontById(strategicFronts, challenge.strategicFrontId);
      if (!front) return;
      const existing = initiatives.some(item => item.challengeId === challengeId);
      if (existing) return;

      const seeded = buildSeededChallengeInitiatives(challenge, front);
      const updatedInitiatives = [...seeded, ...initiatives];
      setInitiatives(updatedInitiatives);
      setPortfolioDecisions(prev => [...seeded.map(buildDecisionRecommendation), ...prev]);
      setChallenges(prev => syncChallengeSummaries(prev, updatedInitiatives));
      setStrategicFronts(prev =>
        prev.map(current =>
          current.id === front.id ? { ...current, initiativeCount: current.initiativeCount + seeded.length } : current,
        ),
      );
      setInitiativeOverlaps(prev => [...prev]);
    },
    createExecutiveOutput: (initiativeId, recommendation) => {
      const existing = getExecutiveOutputByInitiativeId(executiveOutputs, initiativeId);
      if (existing) return existing;

      const initiative = initiatives.find(item => item.id === initiativeId);
      if (!initiative) return null;
      const challenge = challenges.find(item => item.id === initiative.challengeId);
      if (!challenge) return null;

      const created = buildExecutiveOutput(
        initiative,
        challenge,
        recommendation,
        getDecisionsByInitiativeId(portfolioDecisions, initiativeId)[0]?.summary,
      );

      setExecutiveOutputs(prev => [created, ...prev]);
      persistCreate(
        created.id,
        () => portfolioService.createExecutiveOutput(challenge.id, {
          projectId: initiative.projectId ?? initiative.id,
          recommendation,
        }),
        (raw) => ({ ...created, id: (raw as { id?: string }).id ?? created.id }),
        setExecutiveOutputs,
        'executive-output',
      );
      return created;
    },
    updateExecutiveOutputStatus: (outputId, status) => {
      const snapshot = executiveOutputs;
      setExecutiveOutputs(prev =>
        prev.map(item =>
          item.id === outputId
            ? {
                ...item,
                status,
                timeline: [
                  ...item.timeline.slice(0, 2),
                  { label: `Estado actual: ${status.replaceAll('_', ' ')}`, note: 'La salida ejecutiva ya registro un nuevo hito post-decision.' },
                ],
              }
            : item,
        ),
      );
      persistUpdate(
        () => portfolioService.updateExecutiveOutput(outputId, { status }),
        snapshot,
        setExecutiveOutputs,
        'executive-output-status',
      );
    },
    // ADR-024 (#114): persist a portfolio lead's edits to an iniciativa's tracking
    // fields. Was local-only before — mutations were lost on refresh. Optimistic update
    // + rollback on failure (persistUpdate). Only reto-linked iniciativas (with a
    // challengeId) can persist; the backend needs it to locate InitiativePortfolioMeta.
    updateInitiativeMeta: (projectId: string, input: InitiativeEditableMeta) => {
      const snapshot = initiatives;
      const target = initiatives.find(it => it.projectId === projectId || it.id === projectId);
      if (!target) return;

      setInitiatives(prev =>
        prev.map(it => (it.projectId === projectId || it.id === projectId) ? { ...it, ...input } : it),
      );

      if (!target.challengeId) return; // unlinked iniciativa: optimistic-only, nothing to persist
      persistUpdate(
        () => portfolioService.upsertInitiativeMeta(
          projectId,
          toBackendInitiativeMeta(target.challengeId, input) as Parameters<typeof portfolioService.upsertInitiativeMeta>[1],
        ),
        snapshot,
        setInitiatives,
        'initiative-meta',
      );
    },
  }), [challenges, executiveOutputs, initiativeOverlaps, initiatives, portfolioDecisions, refreshPortfolioData, strategicFronts]);

  return <PortfolioLeadContext.Provider value={value}>{children}</PortfolioLeadContext.Provider>;
}

export function usePortfolioLead() {
  const context = useContext(PortfolioLeadContext);
  if (!context) throw new Error('usePortfolioLead must be used within PortfolioLeadProvider');
  return context;
}

export type {
  Challenge,
  ChallengeActivationMode,
  ChallengeCoverageStatus,
  ChallengeStatus,
  ChallengeType,
  CreateChallengeInput,
  CreateStrategicFrontInput,
  ExecutiveOutput,
  ExecutiveOutputStatus,
  Initiative,
  InitiativeOverlap,
  InitiativePortfolioStatus,
  InitiativeStep,
  InitiativeStepProgressState,
  InvitationStatus,
  PortfolioAlert,
  PortfolioDecision,
  PortfolioDecisionItem,
  PortfolioDecisionOutcome,
  PortfolioInitiative,
  PortfolioLeadContextValue,
  PortfolioLeadState,
  PortfolioLeadSummary,
  SquadRole,
  StakeholderStatus,
  StrategicFront,
  StrategicFrontPriority,
  StrategicFrontStatus,
} from '../domain/types';
