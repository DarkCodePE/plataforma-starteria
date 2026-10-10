// /api/v1/projects/:projectId/steps* no verificaba acceso al proyecto: cualquier usuario autenticado
// con el id leía y sobrescribía los Steps de otro. Lo encontró la auditoría del Portfolio Lead en
// producción (2026-10-08): abrir Step 4 de una iniciativa ajena disparó el autosave y se guardó.
// Regla, igual que ProjectService.getProject: el equipo lee y escribe; el Portfolio Lead asignado
// en InitiativeGovernance sólo lee (§23); admin y mentor siguen como estaban.
import { describe, expect, it, vi } from 'vitest';
import { requireStepProjectAccess } from '../step.access';

function makePrisma({ member = false, teamRole = 'EDITOR', leadUserId = null as string | null } = {}) {
  return {
    teamMember: { findFirst: vi.fn().mockResolvedValue(member ? { role: teamRole } : null) },
    initiativeGovernance: { findUnique: vi.fn().mockResolvedValue(leadUserId ? { portfolioLeadUserId: leadUserId } : null) },
  } as any;
}

async function run(prisma: any, method: string, user: { id: string; role: string }) {
  const next = vi.fn();
  await requireStepProjectAccess(prisma)({ method, params: { projectId: 'p1' }, user } as any, {} as any, next);
  return next.mock.calls[0]?.[0];
}

describe('requireStepProjectAccess', () => {
  it('un miembro del equipo lee y escribe', async () => {
    expect(await run(makePrisma({ member: true }), 'GET', { id: 'u1', role: 'participante' })).toBeUndefined();
    expect(await run(makePrisma({ member: true }), 'PUT', { id: 'u1', role: 'participante' })).toBeUndefined();
  });

  // Swarm de roles en producción (2026-10-10): un VIEWER guardaba Steps.
  it('un VIEWER del equipo lee pero no escribe', async () => {
    const prisma = makePrisma({ member: true, teamRole: 'VIEWER' });
    expect(await run(prisma, 'GET', { id: 'u1', role: 'sponsor' })).toBeUndefined();
    expect(await run(prisma, 'PUT', { id: 'u1', role: 'sponsor' })).toMatchObject({ code: 'PROJECT_TEAM_ROLE_REQUIRED' });
  });

  it('un usuario ajeno no lee ni escribe', async () => {
    expect(await run(makePrisma(), 'GET', { id: 'u2', role: 'participante' })).toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
    expect(await run(makePrisma(), 'PUT', { id: 'u2', role: 'participante' })).toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
  });

  it('el Portfolio Lead asignado lee pero no escribe', async () => {
    const prisma = makePrisma({ leadUserId: 'lead-1' });
    expect(await run(prisma, 'GET', { id: 'lead-1', role: 'portfolio_lead' })).toBeUndefined();
    expect(await run(prisma, 'PUT', { id: 'lead-1', role: 'portfolio_lead' })).toMatchObject({ code: 'PROJECT_TEAM_ACCESS_REQUIRED' });
    expect(await run(prisma, 'PATCH', { id: 'lead-1', role: 'portfolio_lead' })).toMatchObject({ code: 'PROJECT_TEAM_ACCESS_REQUIRED' });
  });

  it('otro Portfolio Lead no lee', async () => {
    expect(await run(makePrisma({ leadUserId: 'lead-1' }), 'GET', { id: 'lead-2', role: 'portfolio_lead' })).toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
  });

  it('admin y mentor pasan sin consultar membresía, como en getProject', async () => {
    const prisma = makePrisma();
    expect(await run(prisma, 'PUT', { id: 'a1', role: 'admin' })).toBeUndefined();
    expect(await run(prisma, 'POST', { id: 'm1', role: 'mentor' })).toBeUndefined();
    expect(prisma.teamMember.findFirst).not.toHaveBeenCalled();
  });
});
