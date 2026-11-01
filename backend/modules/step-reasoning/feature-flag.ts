import { AppError } from '../../shared/errors/AppError';
import { resolveStepReasoningProviderMode } from './qa-stub';
import type { PrismaClient } from '@prisma/client';
import { rolesForUser } from '../../shared/authz/permissions';

const E2E_PARTICIPANT_EMAIL = 'e2e-participante@starteria.test';
const E2E_PRODUCTION_ORGANIZATION_ID = 'org-e2e-prod';

type StepReasoningIdentityStore = Pick<PrismaClient, 'user' | 'organizationMember'>;

export type StepReasoningAuthenticatedIdentity = {
  id: string;
  email: string;
  role: string;
  roles?: readonly string[];
};

export type StepReasoningAuthorizedActor = {
  id: string;
  role: 'participante';
};

export type StepReasoningQaConfig = { enabled: boolean };

function parseBooleanFlag(name: string): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

export function validateStepReasoningRuntimeConfig(): StepReasoningQaConfig {
  const enabled = parseBooleanFlag('STEP_REASONING_COPILOT_ENABLED');
  const emergencyDisabled = parseBooleanFlag('STEP_REASONING_COPILOT_EMERGENCY_DISABLED');

  if (enabled && resolveStepReasoningProviderMode() !== 'qa_stub') {
    throw new Error('Step reasoning QA can only run with STEP_REASONING_PROVIDER_MODE=qa_stub.');
  }

  return { enabled: enabled && !emergencyDisabled };
}

/**
 * Server-side authorization boundary for KAN-204.
 * Eligibility is derived from the authenticated User.id and persisted identity.
 */
export class StepReasoningQaEligibility {
  constructor(private readonly store: StepReasoningIdentityStore) {}

  private async resolve(identity: StepReasoningAuthenticatedIdentity): Promise<StepReasoningAuthorizedActor | null> {
    if (!validateStepReasoningRuntimeConfig().enabled) return null;

    const claimRoles = identity.roles ?? [identity.role];
    if (
      identity.email.toLowerCase() !== E2E_PARTICIPANT_EMAIL
      || identity.role !== 'participante'
      || !claimRoles.includes('participante')
      || claimRoles.includes('admin')
    ) return null;

    const [user, memberships] = await Promise.all([
      this.store.user.findUnique({
        where: { id: identity.id },
        select: { email: true, role: true, roles: true, organizationId: true, isActive: true },
      }),
      this.store.organizationMember.findMany({
        where: { userId: identity.id, organizationId: E2E_PRODUCTION_ORGANIZATION_ID },
        select: { role: true },
        take: 2,
      }),
    ]);

    const effectiveRoles = user ? rolesForUser(user) : [];

    const eligible = user?.email.toLowerCase() === E2E_PARTICIPANT_EMAIL
      && user.email.toLowerCase() === identity.email.toLowerCase()
      && user.role === 'participante'
      && effectiveRoles.includes('participante')
      && !effectiveRoles.includes('admin')
      && user.organizationId === E2E_PRODUCTION_ORGANIZATION_ID
      && user.isActive === true
      && memberships.length === 1
      && memberships[0]?.role === 'member';

    return eligible ? { id: identity.id, role: 'participante' } : null;
  }

  async isEligible(identity: StepReasoningAuthenticatedIdentity): Promise<boolean> {
    return Boolean(await this.resolve(identity));
  }

  async authorize(identity: StepReasoningAuthenticatedIdentity): Promise<StepReasoningAuthorizedActor> {
    const config = validateStepReasoningRuntimeConfig();
    if (!config.enabled) {
      throw AppError.notFound('Funcionalidad', 'STEP_REASONING_DISABLED');
    }
    const actor = await this.resolve(identity);
    if (!actor) {
      throw AppError.forbidden(
        'Esta cuenta no está habilitada para el QA del razonador.',
        'STEP_REASONING_QA_ACCOUNT_REQUIRED',
      );
    }
    return actor;
  }
}
