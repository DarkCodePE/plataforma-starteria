import { afterEach, describe, expect, it } from 'vitest';
import {
  StepReasoningQaEligibility,
  type StepReasoningAuthenticatedIdentity,
  validateStepReasoningRuntimeConfig,
} from '../feature-flag';

const target = {
  id: 'persisted-e2e-participant',
  email: 'e2e-participante@starteria.test',
  role: 'participante',
  roles: ['participante'],
  organizationId: 'org-e2e-prod',
  isActive: true,
};

const claims: StepReasoningAuthenticatedIdentity = {
  id: target.id,
  email: target.email,
  role: 'participante',
  roles: ['participante'],
};

function eligibility(
  record: typeof target | null = target,
  membershipRoles: string[] = ['member'],
) {
  return new StepReasoningQaEligibility({
    user: { findUnique: async ({ where }: any) => where.id === record?.id ? record : null },
    organizationMember: {
      findMany: async ({ where }: any) => (
        record
        && where.userId === record.id
        && where.organizationId === 'org-e2e-prod'
          ? membershipRoles.map(role => ({ role }))
          : []
      ),
    },
  } as any);
}

describe('Step reasoning code-driven E2E authorization', () => {
  const previousEnabled = process.env.STEP_REASONING_COPILOT_ENABLED;
  const previousEmergency = process.env.STEP_REASONING_COPILOT_EMERGENCY_DISABLED;
  const previousProvider = process.env.STEP_REASONING_PROVIDER_MODE;

  afterEach(() => {
    if (previousEnabled === undefined) delete process.env.STEP_REASONING_COPILOT_ENABLED;
    else process.env.STEP_REASONING_COPILOT_ENABLED = previousEnabled;
    if (previousEmergency === undefined) delete process.env.STEP_REASONING_COPILOT_EMERGENCY_DISABLED;
    else process.env.STEP_REASONING_COPILOT_EMERGENCY_DISABLED = previousEmergency;
    if (previousProvider === undefined) delete process.env.STEP_REASONING_PROVIDER_MODE;
    else process.env.STEP_REASONING_PROVIDER_MODE = previousProvider;
  });

  it('authorizes only matching authenticated and persisted identity plus canonical membership', async () => {
    process.env.STEP_REASONING_COPILOT_ENABLED = 'true';
    process.env.STEP_REASONING_PROVIDER_MODE = 'qa_stub';
    expect(await eligibility().isEligible(claims)).toBe(true);
    expect(await eligibility().isEligible({ ...claims, id: 'another-authenticated-user' })).toBe(false);
    expect(await eligibility().isEligible({ ...claims, email: 'another@starteria.test' })).toBe(false);
    expect(await eligibility({ ...target, email: 'another@starteria.test' }).isEligible({ ...claims, email: 'another@starteria.test' })).toBe(false);
    expect(await eligibility({ ...target, role: 'admin', roles: ['admin'] }).isEligible(claims)).toBe(false);
    expect(await eligibility({ ...target, roles: ['participante', 'portfolio_lead'] }).isEligible(claims)).toBe(true);
    expect(await eligibility({ ...target, roles: ['participante', 'admin'] }).isEligible(claims)).toBe(false);
    expect(await eligibility({ ...target, organizationId: 'another-org' }).isEligible(claims)).toBe(false);
    expect(await eligibility({ ...target, isActive: false }).isEligible(claims)).toBe(false);
  });

  it('rejects stale admin claims, revoked membership and elevated membership', async () => {
    process.env.STEP_REASONING_COPILOT_ENABLED = 'true';
    process.env.STEP_REASONING_PROVIDER_MODE = 'qa_stub';

    expect(await eligibility().isEligible({ ...claims, role: 'admin', roles: ['admin'] })).toBe(false);
    expect(await eligibility().isEligible({ ...claims, roles: ['participante', 'admin'] })).toBe(false);
    expect(await eligibility(target, []).isEligible(claims)).toBe(false);
    expect(await eligibility(target, ['admin']).isEligible(claims)).toBe(false);
    expect(await eligibility(target, ['member', 'admin']).isEligible(claims)).toBe(false);
    expect(await eligibility(target, ['member', 'member']).isEligible(claims)).toBe(false);
  });

  it('fails closed for the emergency switch and a live provider', async () => {
    process.env.STEP_REASONING_COPILOT_ENABLED = 'true';
    process.env.STEP_REASONING_PROVIDER_MODE = 'qa_stub';
    process.env.STEP_REASONING_COPILOT_EMERGENCY_DISABLED = 'true';
    expect(await eligibility().isEligible(claims)).toBe(false);

    process.env.STEP_REASONING_COPILOT_EMERGENCY_DISABLED = 'false';
    process.env.STEP_REASONING_PROVIDER_MODE = 'live_llm';
    expect(() => validateStepReasoningRuntimeConfig()).toThrow(/only run.*qa_stub/);
  });
});
