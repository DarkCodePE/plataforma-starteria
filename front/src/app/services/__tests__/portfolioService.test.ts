import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../api', () => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return { default: { get, post, put, patch, delete: del } };
});

import api from '../api';
import * as svc from '../portfolioService';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.patch.mockReset();
  apiMock.delete.mockReset();
});

function ok<T>(data: T) {
  return { data: { success: true, data } };
}

describe('portfolioService — Strategic Fronts', () => {
  it('listStrategicFronts returns array', async () => {
    apiMock.get.mockResolvedValueOnce(ok([{ id: 'f1' }, { id: 'f2' }]));
    const result = await svc.listStrategicFronts();
    expect(apiMock.get).toHaveBeenCalledWith('/portfolio/strategic-fronts');
    expect(result).toHaveLength(2);
  });

  it('createStrategicFront posts payload', async () => {
    apiMock.post.mockResolvedValueOnce(ok({ id: 'f1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.createStrategicFront({ name: 'F1' } as any);
    expect(apiMock.post).toHaveBeenCalledWith(
      '/portfolio/strategic-fronts',
      { name: 'F1' },
    );
  });

  it('updateStrategicFront patches by id', async () => {
    apiMock.patch.mockResolvedValueOnce(ok({ id: 'f1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.updateStrategicFront('f1', { name: 'F1b' } as any);
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/portfolio/strategic-fronts/f1',
      { name: 'F1b' },
    );
  });

  it('deleteStrategicFront issues DELETE', async () => {
    apiMock.delete.mockResolvedValueOnce({ data: { success: true } });
    await svc.deleteStrategicFront('f1');
    expect(apiMock.delete).toHaveBeenCalledWith('/portfolio/strategic-fronts/f1');
  });
});

describe('portfolioService — Challenges', () => {
  it('listChallenges hits the front-scoped endpoint', async () => {
    apiMock.get.mockResolvedValueOnce(ok([{ id: 'c1' }]));
    await svc.listChallenges('f1');
    expect(apiMock.get).toHaveBeenCalledWith(
      '/portfolio/strategic-fronts/f1/challenges',
    );
  });

  it('createChallenge posts under the front', async () => {
    apiMock.post.mockResolvedValueOnce(ok({ id: 'c1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.createChallenge('f1', { title: 'T' } as any);
    expect(apiMock.post).toHaveBeenCalledWith(
      '/portfolio/strategic-fronts/f1/challenges',
      { title: 'T' },
    );
  });

  it('updateChallenge patches by id', async () => {
    apiMock.patch.mockResolvedValueOnce(ok({ id: 'c1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.updateChallenge('c1', { title: 'T2' } as any);
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/portfolio/challenges/c1',
      { title: 'T2' },
    );
  });

  it('addInvitation posts {value} to the invitations endpoint', async () => {
    apiMock.post.mockResolvedValueOnce(ok({ id: 'c1' }));
    await svc.addInvitation('c1', 'foo@bar.com');
    expect(apiMock.post).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/invitations',
      { value: 'foo@bar.com' },
    );
  });

  it('updateInvitation patches by invitation id', async () => {
    apiMock.patch.mockResolvedValueOnce(ok({ id: 'c1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.updateInvitation('c1', 'inv-1', 'accepted' as any);
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/invitations/inv-1',
      { status: 'accepted' },
    );
  });

  it('addSquadMember posts value+role', async () => {
    apiMock.post.mockResolvedValueOnce(ok({ id: 'c1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.addSquadMember('c1', 'u@x.com', 'lead' as any);
    expect(apiMock.post).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/squad',
      { value: 'u@x.com', role: 'lead' },
    );
  });

  it('updateSquadMember patches role', async () => {
    apiMock.patch.mockResolvedValueOnce(ok({ id: 'c1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.updateSquadMember('c1', 'm-1', 'mentor' as any);
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/squad/m-1',
      { role: 'mentor' },
    );
  });

  it('activateOpenCall posts to the activate endpoint', async () => {
    apiMock.post.mockResolvedValueOnce(ok({ id: 'c1' }));
    await svc.activateOpenCall('c1');
    expect(apiMock.post).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/activate-open-call',
    );
  });

  it('publishChallenge posts to the publish endpoint', async () => {
    apiMock.post.mockResolvedValueOnce(ok({ id: 'c1' }));
    await svc.publishChallenge('c1');
    expect(apiMock.post).toHaveBeenCalledWith('/portfolio/challenges/c1/publish');
  });
});

describe('portfolioService — Initiatives, Overlaps, Outputs', () => {
  it('listInitiatives hits the challenge-scoped endpoint', async () => {
    apiMock.get.mockResolvedValueOnce(ok([{ id: 'i1' }]));
    await svc.listInitiatives('c1');
    expect(apiMock.get).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/initiatives',
    );
  });

  it('upsertInitiativeMeta puts to /meta', async () => {
    apiMock.put.mockResolvedValueOnce(ok({ id: 'p1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.upsertInitiativeMeta('p1', { status: 'en_step_0' } as any);
    expect(apiMock.put).toHaveBeenCalledWith(
      '/portfolio/initiatives/p1/meta',
      { status: 'en_step_0' },
    );
  });

  it('listOverlaps + createOverlap', async () => {
    apiMock.get.mockResolvedValueOnce(ok([]));
    await svc.listOverlaps('c1');
    expect(apiMock.get).toHaveBeenCalledWith('/portfolio/challenges/c1/overlaps');

    apiMock.post.mockResolvedValueOnce(ok({ id: 'o1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.createOverlap('c1', { foo: 'bar' } as any);
    expect(apiMock.post).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/overlaps',
      { foo: 'bar' },
    );
  });

  it('listExecutiveOutputs + createExecutiveOutput + updateExecutiveOutput', async () => {
    apiMock.get.mockResolvedValueOnce(ok([]));
    await svc.listExecutiveOutputs('c1');
    expect(apiMock.get).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/executive-outputs',
    );

    apiMock.post.mockResolvedValueOnce(ok({ id: 'eo1' }));
    await svc.createExecutiveOutput('c1', {
      projectId: 'p1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recommendation: 'continue' as any,
    });
    expect(apiMock.post).toHaveBeenCalledWith(
      '/portfolio/challenges/c1/executive-outputs',
      { projectId: 'p1', recommendation: 'continue' },
    );

    apiMock.patch.mockResolvedValueOnce(ok({ id: 'eo1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.updateExecutiveOutput('eo1', { note: 'x' } as any);
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/portfolio/executive-outputs/eo1',
      { note: 'x' },
    );
  });

  it('updateSponsorData patches the project sponsor endpoint', async () => {
    apiMock.patch.mockResolvedValueOnce({ data: { success: true } });
    await svc.updateSponsorData('p1', { foo: 'bar' });
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/projects/p1/sponsor-data',
      { foo: 'bar' },
    );
  });
});

// Auditoría E2E F-12: un fallo leyendo aprendizajes no tiene que mostrarse como "no hay".
describe('listPortfolioLearnings', () => {
  it('devuelve los aprendizajes', async () => {
    (api.get as any).mockResolvedValueOnce({ data: { data: { learnings: [{ decisionId: 'd1' }], learningsUnavailable: false } } });
    await expect(svc.listPortfolioLearnings()).resolves.toEqual([{ decisionId: 'd1' }]);
  });

  it('si el servidor no pudo leerlos, falla en vez de devolver una lista vacía', async () => {
    (api.get as any).mockResolvedValueOnce({ data: { data: { learnings: [], learningsUnavailable: true } } });
    await expect(svc.listPortfolioLearnings()).rejects.toThrow('LEARNINGS_UNAVAILABLE');
  });
});
