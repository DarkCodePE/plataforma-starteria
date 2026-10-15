/**
 * Auditoría E2E F-17 (NEEDS_EVIDENCE): pérdida de rol, revocación y reasignación del lead
 * nunca se probaron como recorrido. Este test cambia el estado del equipo paso a paso sobre un
 * mismo "DB" en memoria y comprueba en cada transición quién puede leer, escribir y decidir,
 * con las mismas piezas que usan las rutas: requireProjectTeamAccess y DecisionAuthorityResolver.
 */
import { describe, expect, it } from 'vitest';
import { requireProjectTeamAccess } from '../project-team-access';
import { DecisionAuthorityResolver } from '../../adaptive-core/decision-authority.resolver';

type Member = { userId: string; role: 'OWNER' | 'EDITOR' | 'VIEWER'; status: 'ACTIVE' | 'PENDING' };

function world() {
  const state = {
    team: [
      { userId: 'owner', role: 'OWNER', status: 'ACTIVE' },
      { userId: 'editor', role: 'EDITOR', status: 'ACTIVE' },
      { userId: 'invitee', role: 'EDITOR', status: 'PENDING' },
    ] as Member[],
    governance: { mode: 'portfolio_governed', portfolioLeadUserId: 'lead-1' } as { mode: string; portfolioLeadUserId: string | null },
  };
  const prisma: any = {
    teamMember: { findFirst: async ({ where }: any) => state.team.find((m) => m.userId === where.userId) ?? null },
    initiativeGovernance: { findUnique: async () => state.governance },
  };
  return { state, prisma };
}

async function access(prisma: any, userId: string, need: 'read' | 'write' | 'manage', role = 'participante'): Promise<string> {
  const guard = requireProjectTeamAccess(prisma, need);
  let outcome = 'allowed';
  await guard({ params: { id: 'p1' }, user: { id: userId, role } } as any, {} as any, (err?: any) => { if (err) outcome = err.code; });
  return outcome;
}

function canDecide(state: ReturnType<typeof world>['state'], userId: string, purpose: 'methodological_decision' | 'portfolio_review' = 'portfolio_review') {
  return new DecisionAuthorityResolver().evaluate({
    projectId: 'p1', cycleId: 'c1', decisionType: 'scale', authorityPurpose: purpose,
    governanceMode: state.governance.mode as any,
    initiativeOwnerId: 'owner',
    portfolioLeadUserId: state.governance.portfolioLeadUserId,
    currentUserId: userId,
    currentUserIsInitiativeOwner: userId === 'owner',
    currentUserIsAssignedPortfolioLead: state.governance.portfolioLeadUserId === userId,
    currentUserIsActiveTeamMember: state.team.some((m) => m.userId === userId && m.status === 'ACTIVE'),
    hasExplicitGovernanceConfig: true,
  }).currentUserCanDecide;
}

describe('revocación y reasignación como recorrido (F-17)', () => {
  it('un editor removido pierde lectura y escritura en el acto', async () => {
    const { state, prisma } = world();
    expect(await access(prisma, 'editor', 'write')).toBe('allowed');

    state.team = state.team.filter((m) => m.userId !== 'editor');

    expect(await access(prisma, 'editor', 'read')).toBe('PROJECT_ACCESS_DENIED');
    expect(await access(prisma, 'editor', 'write')).toBe('PROJECT_ACCESS_DENIED');
  });

  it('degradar a VIEWER deja leer pero ya no escribir ni gestionar', async () => {
    const { state, prisma } = world();
    state.team.find((m) => m.userId === 'editor')!.role = 'VIEWER';
    expect(await access(prisma, 'editor', 'read')).toBe('allowed');
    expect(await access(prisma, 'editor', 'write')).toBe('PROJECT_TEAM_ROLE_REQUIRED');
    expect(await access(prisma, 'editor', 'manage')).toBe('PROJECT_OWNER_REQUIRED');
  });

  it('una invitación pendiente lee pero no escribe hasta aceptarse; aceptada, escribe', async () => {
    const { state, prisma } = world();
    expect(await access(prisma, 'invitee', 'write')).toBe('TEAM_INVITATION_PENDING');
    state.team.find((m) => m.userId === 'invitee')!.status = 'ACTIVE';
    expect(await access(prisma, 'invitee', 'write')).toBe('allowed');
  });

  it('reasignar el Portfolio Lead: el anterior pierde lectura y decisión; el nuevo las gana', async () => {
    const { state, prisma } = world();
    expect(await access(prisma, 'lead-1', 'read')).toBe('allowed');
    expect(canDecide(state, 'lead-1')).toBe(true);

    state.governance.portfolioLeadUserId = 'lead-2';

    expect(await access(prisma, 'lead-1', 'read')).toBe('PROJECT_ACCESS_DENIED');
    expect(canDecide(state, 'lead-1')).toBe(false);
    expect(await access(prisma, 'lead-2', 'read')).toBe('allowed');
    expect(canDecide(state, 'lead-2')).toBe(true);
  });

  it('el lead asignado nunca escribe el trabajo del equipo, ni antes ni después de reasignarlo', async () => {
    const { state, prisma } = world();
    expect(await access(prisma, 'lead-1', 'write')).toBe('PROJECT_TEAM_ACCESS_REQUIRED');
    state.governance.portfolioLeadUserId = 'lead-2';
    expect(await access(prisma, 'lead-2', 'write')).toBe('PROJECT_TEAM_ACCESS_REQUIRED');
  });

  it('quitar el lead sin reemplazo deja la decisión de portafolio sin autoridad, no en manos del owner', () => {
    const { state } = world();
    state.governance.portfolioLeadUserId = null;
    expect(canDecide(state, 'owner')).toBe(false);
    expect(canDecide(state, 'lead-1')).toBe(false);
  });

  it('en una iniciativa gobernada por el owner, sólo el owner decide; un editor no', () => {
    const { state } = world();
    state.governance.mode = 'owner_governed';
    expect(canDecide(state, 'owner', 'methodological_decision')).toBe(true);
    expect(canDecide(state, 'editor', 'methodological_decision')).toBe(false);
  });
});
