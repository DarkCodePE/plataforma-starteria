// El Portfolio Lead asignado en InitiativeGovernance ve la iniciativa que va a decidir (§23),
// pero no la edita: escribir sigue siendo del equipo. "Abrir iniciativa" en
// /portfolio/iniciativas fallaba con "No pudimos cargar el proyecto." (2026-10-08).
import { describe, expect, it, vi } from 'vitest';
import { ProjectService } from '../project.service';

function makePrisma(governance: { portfolioLeadUserId: string | null } | null) {
  const project = { id: 'p1', status: 'IN_PROGRESS', teamMembers: [{ userId: 'owner-1' }], steps: [], evidence: [] };
  return {
    project: { findUnique: vi.fn().mockResolvedValue(project), update: vi.fn().mockResolvedValue(project) },
    initiativeGovernance: { findUnique: vi.fn().mockResolvedValue(governance) },
    initiativePortfolioMeta: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;
}

describe('ProjectService — lectura del Portfolio Lead asignado', () => {
  it('el lead asignado lee la iniciativa sin ser miembro', async () => {
    const service = new ProjectService(makePrisma({ portfolioLeadUserId: 'lead-1' }));
    await expect(service.getProjectForRead('p1', 'lead-1', 'portfolio_lead')).resolves.toMatchObject({ id: 'p1' });
  });

  it('otro Portfolio Lead no la lee', async () => {
    const service = new ProjectService(makePrisma({ portfolioLeadUserId: 'lead-1' }));
    await expect(service.getProjectForRead('p1', 'lead-2', 'portfolio_lead')).rejects.toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
  });

  it('el lead asignado no edita: getProject (usado por las escrituras) sigue exigiendo membresía', async () => {
    const service = new ProjectService(makePrisma({ portfolioLeadUserId: 'lead-1' }));
    await expect(service.updateStep0('p1', 'lead-1', 'portfolio_lead', {} as any)).rejects.toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
  });
});
