import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { can, type Permission } from '../../shared/authz/permissions';
import type {
  StrategicFramingChallengeStructuringState,
  StrategicFramingPrioritizationState,
  StrategicFramingProvisionalSourceMode,
} from './strategic-framing.types';
import type { AuthorizedPortfolioContext } from '../../shared/portfolio-context/portfolio-context.types';

export type StrategicFramingAttentionReason =
  | 'insufficient_framing'
  | 'blockers_present'
  | 'address_now_without_confirmed_candidate'
  | 'confirmed_candidate_not_promoted';

export type StrategicFramingHomeItem = {
  stateId: string;
  updatedAt: string;
  sourceMode: StrategicFramingProvisionalSourceMode;
  intendedMovement: string | null;
  sufficiency: {
    status: string;
    blockerCount: number;
  };
  prioritization: {
    addressNow: number;
    observe: number;
    discard: number;
    undecided: number;
    focusSlots: number | null;
  };
  structuring: {
    confirmedCandidates: number;
    unpromotedCandidates: number;
  };
  promotions: Array<{
    promotionId: string;
    challengeId: string;
    challengeTitle: string | null;
    strategicFrontId: string | null;
    strategicFrontName: string | null;
    challengeHref: string | null;
  }>;
  attention: {
    required: boolean;
    reasons: StrategicFramingAttentionReason[];
  };
  workspaceHref: string;
};

export type StrategicFramingHomeProjection =
  | {
      availability: 'available';
      totalStateCount: number;
      hasMore: boolean;
      items: StrategicFramingHomeItem[];
    }
  | {
      availability: 'unavailable';
      reason: 'read_failed';
    };

type Db = PrismaClient | any;
type StateRow = {
  id: string;
  sourceMode: StrategicFramingProvisionalSourceMode;
  intendedMovement: string | null;
  sufficiencyStatus: string;
  blockers: unknown;
  prioritizationState: unknown;
  challengeStructuringState: unknown;
  updatedAt: Date | string;
};

const HOME_LIMIT = 5;

export class StrategicFramingHomeProjectionService {
  constructor(private readonly prisma: PrismaClient) {}

  async getProjection(input: {
    actorUserId: string;
    organizationId: string | null;
    permissions: ReadonlySet<Permission>;
    authorizedContext?: AuthorizedPortfolioContext;
  }): Promise<StrategicFramingHomeProjection> {
    if (!input.actorUserId) throw AppError.unauthorized('No autorizado.', 'SF_HOME_AUTH_REQUIRED');
    const contextAuthorizesRead = input.authorizedContext
      && input.authorizedContext.actorUserId === input.actorUserId
      && input.authorizedContext.organizationId === input.organizationId;
    if (!can(input.permissions, 'portfolio:read') && !contextAuthorizesRead) {
      throw AppError.forbidden('No tienes permiso para acceder a este recurso.', 'SF_HOME_FORBIDDEN');
    }

    try {
      const db = this.prisma as Db;
      const where = { organizationId: input.organizationId };
      const [totalStateCount, states] = await Promise.all([
        db.strategicFramingProvisionalState.count({ where }),
        db.strategicFramingProvisionalState.findMany({
          where,
          select: {
            id: true,
            sourceMode: true,
            intendedMovement: true,
            sufficiencyStatus: true,
            blockers: true,
            prioritizationState: true,
            challengeStructuringState: true,
            updatedAt: true,
          },
        }),
      ]);

      const stateIds = states.map((state: StateRow) => state.id);
      const promotions = stateIds.length === 0
        ? []
        : await db.strategicFramingPromotion.findMany({
          where: { stateId: { in: stateIds } },
          select: { id: true, stateId: true, challengeCandidateId: true, challengeId: true, promotedAt: true },
          orderBy: { promotedAt: 'asc' },
        });

      const challengeIds = unique(promotions.map((promotion: any) => promotion.challengeId));
      const challenges = challengeIds.length === 0
        ? []
        : await db.challenge.findMany({
          where: { id: { in: challengeIds } },
          select: { id: true, title: true, strategicFrontId: true },
        });
      const frontIds = unique(challenges.map((challenge: any) => challenge.strategicFrontId));
      const fronts = frontIds.length === 0
        ? []
        : await db.strategicFront.findMany({
          where: { id: { in: frontIds } },
          select: { id: true, name: true },
        });

      const challengeById = new Map<string, any>(challenges.map((challenge: any) => [challenge.id, challenge] as [string, any]));
      const frontById = new Map<string, any>(fronts.map((front: any) => [front.id, front] as [string, any]));
      const promotionsByState = groupBy(promotions, (promotion: any) => promotion.stateId);
      const derived = states.map((state: StateRow) => this.mapState(state, promotionsByState.get(state.id) ?? [], challengeById, frontById));
      derived.sort(compareItems);
      const items = derived.slice(0, HOME_LIMIT);

      return { availability: 'available', totalStateCount, hasMore: totalStateCount > items.length, items };
    } catch (error) {
      if (error instanceof AppError) throw error;
      return { availability: 'unavailable', reason: 'read_failed' };
    }
  }

  private mapState(state: StateRow, statePromotions: any[], challengeById: Map<string, any>, frontById: Map<string, any>): StrategicFramingHomeItem {
    const prioritization = normalizePrioritization(state.prioritizationState);
    const structuring = normalizeStructuring(state.challengeStructuringState);
    const confirmedIds = new Set(structuring.candidates.map((candidate) => candidate.challengeCandidateId));
    const promotedIds = new Set(statePromotions.map((promotion) => promotion.challengeCandidateId));
    const attentionReasons: StrategicFramingAttentionReason[] = [];

    if (state.sufficiencyStatus !== 'sufficient') attentionReasons.push('insufficient_framing');
    if (arrayValue(state.blockers).length > 0) attentionReasons.push('blockers_present');

    const coveredAddressNow = new Set(structuring.candidates.flatMap((candidate) => candidate.sourceCandidateIds));
    if (prioritization.candidates.some((candidate) => candidate.humanDisposition === 'address_now' && !coveredAddressNow.has(candidate.candidateId))) {
      attentionReasons.push('address_now_without_confirmed_candidate');
    }
    if ([...confirmedIds].some((candidateId) => !promotedIds.has(candidateId))) attentionReasons.push('confirmed_candidate_not_promoted');

    return {
      stateId: state.id,
      updatedAt: toIso(state.updatedAt),
      sourceMode: state.sourceMode,
      intendedMovement: state.intendedMovement,
      sufficiency: { status: state.sufficiencyStatus, blockerCount: arrayValue(state.blockers).length },
      prioritization: {
        addressNow: countDisposition(prioritization, 'address_now'),
        observe: countDisposition(prioritization, 'observe'),
        discard: countDisposition(prioritization, 'discard'),
        undecided: countDisposition(prioritization, 'undecided'),
        focusSlots: prioritization.focusSlots,
      },
      structuring: { confirmedCandidates: structuring.candidates.length, unpromotedCandidates: [...confirmedIds].filter((candidateId) => !promotedIds.has(candidateId)).length },
      promotions: statePromotions.map((promotion) => {
        const challenge = challengeById.get(promotion.challengeId);
        const front = challenge ? frontById.get(challenge.strategicFrontId) : undefined;
        return {
          promotionId: promotion.id,
          challengeId: promotion.challengeId,
          challengeTitle: challenge?.title ?? null,
          strategicFrontId: challenge?.strategicFrontId ?? null,
          strategicFrontName: front?.name ?? null,
          challengeHref: challenge ? `/retos/${challenge.id}` : null,
        };
      }),
      attention: { required: attentionReasons.length > 0, reasons: attentionReasons },
      workspaceHref: `/portfolio/framing/${state.id}`,
    };
  }
}

function normalizePrioritization(value: unknown): StrategicFramingPrioritizationState {
  if (!value || typeof value !== 'object' || !Array.isArray((value as any).candidates)) return { schemaVersion: 1, nonCanonical: true, focusSlots: null, focusRationale: null, candidates: [] };
  return value as StrategicFramingPrioritizationState;
}

function normalizeStructuring(value: unknown): StrategicFramingChallengeStructuringState {
  if (!value || typeof value !== 'object' || !Array.isArray((value as any).candidates)) return { schemaVersion: 1, nonCanonical: true, candidates: [] };
  return value as StrategicFramingChallengeStructuringState;
}

function countDisposition(state: StrategicFramingPrioritizationState, disposition: 'address_now' | 'observe' | 'discard' | 'undecided'): number {
  return state.candidates.filter((candidate) => candidate.humanDisposition === disposition).length;
}

function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function unique(values: unknown[]): string[] { return [...new Set(values.filter((value): value is string => typeof value === 'string'))]; }
function groupBy(values: any[], key: (value: any) => string): Map<string, any[]> {
  const result = new Map<string, any[]>();
  for (const value of values) { const group = result.get(key(value)) ?? []; group.push(value); result.set(key(value), group); }
  return result;
}
function toIso(value: Date | string): string { return new Date(value).toISOString(); }
function compareItems(a: StrategicFramingHomeItem, b: StrategicFramingHomeItem): number {
  if (a.attention.required !== b.attention.required) return a.attention.required ? -1 : 1;
  const updated = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  return updated || a.stateId.localeCompare(b.stateId);
}
