/**
 * route-confirmation.service.test.ts — IR-B4 (ADR-025, RB-IR-017/018).
 *
 * Fija la lógica de confirm-route con mocks: idempotencia, reuso de createProject sin
 * modificarlo, finalización atómica y liberación del claim ante fallo de creación.
 */
import { describe, it, expect, vi } from 'vitest';
import { RouteConfirmationService } from '../route-confirmation.service';

vi.mock('../../adaptive-core/adaptive-core.service', () => ({
  AdaptiveCoreService: vi.fn().mockImplementation(() => ({
    ensureInitialized: vi.fn(async () => ({})),
  })),
}));

const SNAPSHOT = {
  id: 'snap1',
  version: 1,
  selectedChallengeType: 'correccion',
  understandingSummary: 'contexto',
  informationReadiness: 'low',
  improvedProposal: { suggestedName: 'Mi iniciativa', improvedDescription: 'desc', initialFocus: 'f', expectedImpact: 'i', nextRecommendedStep: 'Step 0' },
  strategicQuestions: [{ id: 'q1', status: 'unanswered' }],
  critique: { mainRisk: 'riesgo' },
};

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    initialReview: {
      findUnique: vi.fn(async () => ({ id: 'rev1', ownerId: 'u1', status: 'generated', challengeId: null })),
      update: vi.fn(async () => ({})),
    },
    initialReviewSnapshot: { findFirst: vi.fn(async () => SNAPSHOT) },
    routeConfirmation: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'rc1', ...data })),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    project: { update: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
    ...overrides,
  } as any;
}

function fakeProjects(createImpl?: any) {
  return { createProject: vi.fn(createImpl ?? (async () => ({ id: 'proj1' }))) } as any;
}

describe('RouteConfirmationService.confirmRoute (IR-B4)', () => {
  it('crea la iniciativa (reusa createProject) y finaliza confirmación + review + prefill', async () => {
    const prisma = makePrisma();
    const projects = fakeProjects();
    const svc = new RouteConfirmationService(prisma, projects);

    const res = await svc.confirmRoute('rev1', 'u1');

    expect(projects.createProject).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Mi iniciativa' }));
    expect(res.initiativeId).toBe('proj1');
    expect(res.overviewUrl).toBe('/initiatives/proj1/overview');
    // finaliza: origin + snapshot + step0Data
    const projUpdate = prisma.project.update.mock.calls[0][0].data;
    expect(projUpdate.origin).toBe('from_initial_review');
    expect(projUpdate.initialReviewSnapshotId).toBe('snap1');
    expect(projUpdate.step0Data.suggestedName).toBe('Mi iniciativa');
    expect(projUpdate.step0Data.challengeType).toBe('correction'); // canónico
    expect(projUpdate.step0Data.adaptiveCore.schemaVersion).toBe('PRD-03-v0.4');
    expect(projUpdate.step0Data.adaptiveCore.progressSignal.checkpointCode).toBe('CP-0.1');
    expect(prisma.routeConfirmation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdProjectId: 'proj1', status: 'initiative_created' }) }));
    expect(prisma.initialReview.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'converted_to_initiative' } }));
  });

  it('es IDEMPOTENTE: si ya hay Project, devuelve el mismo y NO llama createProject (RB-IR-018)', async () => {
    const prisma = makePrisma({ routeConfirmation: { findUnique: vi.fn(async () => ({ id: 'rc1', createdProjectId: 'projX', status: 'initiative_created' })) } });
    const projects = fakeProjects();
    const svc = new RouteConfirmationService(prisma, projects);

    const res = await svc.confirmRoute('rev1', 'u1');
    expect(res.initiativeId).toBe('projX');
    expect(projects.createProject).not.toHaveBeenCalled();
  });

  it('rechaza a quien no es el dueño de la revisión', async () => {
    const prisma = makePrisma({ initialReview: { findUnique: vi.fn(async () => ({ id: 'rev1', ownerId: 'other', challengeId: null })) } });
    const svc = new RouteConfirmationService(prisma, fakeProjects());
    await expect(svc.confirmRoute('rev1', 'u1')).rejects.toMatchObject({ code: 'INITIAL_REVIEW_FORBIDDEN' });
  });

  it('sin snapshot no hay ruta que confirmar', async () => {
    const prisma = makePrisma({ initialReviewSnapshot: { findFirst: vi.fn(async () => null) } });
    const svc = new RouteConfirmationService(prisma, fakeProjects());
    await expect(svc.confirmRoute('rev1', 'u1')).rejects.toMatchObject({ code: 'NO_SNAPSHOT_TO_CONFIRM' });
  });

  it('si createProject falla, libera el claim (borra la confirmación) para permitir reintento', async () => {
    const prisma = makePrisma();
    const projects = fakeProjects(async () => { throw new Error('db down'); });
    const svc = new RouteConfirmationService(prisma, projects);

    await expect(svc.confirmRoute('rev1', 'u1')).rejects.toMatchObject({ code: 'INITIATIVE_CREATE_FAILED' });
    expect(prisma.routeConfirmation.delete).toHaveBeenCalledWith({ where: { id: 'rc1' } });
  });
});

// Auditoría E2E F-04: si fallaba la finalización, el proyecto quedaba creado y huérfano y cada
// reintento respondía ROUTE_CONFIRMATION_IN_PROGRESS para siempre.
describe('RouteConfirmationService — recuperación (F-04)', () => {
  it('si la finalización falla, el proyecto queda atado al claim y el reintento termina con el MISMO proyecto', async () => {
    // Como Prisma, las escrituras son perezosas: sólo se aplican al await o dentro de $transaction.
    const lazy = (run: () => unknown) => ({ run, then: (ok: any, ko: any) => Promise.resolve().then(run).then(ok, ko) });
    const claims: Record<string, any> = {};
    const prisma = makePrisma({
      routeConfirmation: {
        findUnique: vi.fn(async () => claims.rc1 ?? null),
        create: vi.fn(async ({ data }: any) => (claims.rc1 = { id: 'rc1', updatedAt: new Date(), ...data })),
        update: vi.fn(({ data }: any) => lazy(() => Object.assign(claims.rc1, data))),
        delete: vi.fn(async () => { delete claims.rc1; }),
      },
    });
    prisma.project.update = vi.fn(() => lazy(() => ({})));
    prisma.initialReview.update = vi.fn(() => lazy(() => ({})));
    let failFinalize = true;
    prisma.$transaction = vi.fn(async (ops: any[]) => {
      if (failFinalize) throw new Error('db blip');
      return ops.map((op) => op.run());
    });
    const projects = fakeProjects();
    const svc = new RouteConfirmationService(prisma, projects);

    await expect(svc.confirmRoute('rev1', 'u1')).rejects.toMatchObject({ code: 'INITIATIVE_FINALIZE_FAILED' });
    expect(claims.rc1).toMatchObject({ createdProjectId: 'proj1', status: 'confirmed' });

    failFinalize = false;
    const res = await svc.confirmRoute('rev1', 'u1');
    expect(res.initiativeId).toBe('proj1');
    expect(projects.createProject).toHaveBeenCalledTimes(1);
    expect(claims.rc1.status).toBe('initiative_created');
  });

  it('un claim pending sin proyecto y viejo (proceso caído) se libera y el reintento crea la iniciativa', async () => {
    const stale = { id: 'rc-old', reviewId: 'rev1', status: 'pending', createdProjectId: null, updatedAt: new Date(Date.now() - 10 * 60 * 1000) };
    const prisma = makePrisma();
    prisma.routeConfirmation.findUnique = vi.fn().mockResolvedValueOnce(stale).mockResolvedValue(null);
    const svc = new RouteConfirmationService(prisma, fakeProjects());

    const res = await svc.confirmRoute('rev1', 'u1');
    expect(prisma.routeConfirmation.delete).toHaveBeenCalledWith({ where: { id: 'rc-old' } });
    expect(res.initiativeId).toBe('proj1');
  });

  it('un claim pending reciente sigue respondiendo "en progreso" (carrera real)', async () => {
    const recent = { id: 'rc-new', status: 'pending', createdProjectId: null, updatedAt: new Date() };
    const prisma = makePrisma();
    prisma.routeConfirmation.findUnique = vi.fn(async () => recent);
    prisma.routeConfirmation.create = vi.fn(async () => { throw new Error('unique'); });
    const svc = new RouteConfirmationService(prisma, fakeProjects());
    await expect(svc.confirmRoute('rev1', 'u1')).rejects.toMatchObject({ code: 'ROUTE_CONFIRMATION_IN_PROGRESS' });
    expect(prisma.routeConfirmation.delete).not.toHaveBeenCalled();
  });
});
