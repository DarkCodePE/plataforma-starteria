/**
 * portfolio.challenge-transitions.test.ts — ADR-030 (MVP-P1-01), nivel SERVICIO.
 *
 * `challenge-state-machine.test.ts` fija la tabla en abstracto. Esto comprueba lo que de
 * verdad importa para el usuario: que `PortfolioService` APLIQUE la tabla antes de escribir,
 * que rechace con 409 (no con un `as any` silencioso) y que persista `pausedFromStatus`.
 *
 * Se mockea Prisma en vez de golpear Postgres porque lo que se verifica es la DECISION del
 * servicio, no el motor: la aserción es sobre el `data` que se manda a `update`.
 */
import { describe, it, expect, vi } from 'vitest';
import { PortfolioService } from '../portfolio.service';
import { AppError } from '../../../shared/errors/AppError';

type ChallengeRow = { id: string; status: string; pausedFromStatus?: string | null };

function makeService(challenge: ChallengeRow) {
  const update = vi.fn().mockImplementation(({ data }: any) => ({ ...challenge, ...data }));
  const persisted = {
    ...challenge,
    strategicFrontId: 'front-a',
    strategicFront: { id: 'front-a', organizationId: 'org-a' },
  };
  const prisma: any = {
    $transaction: vi.fn(async (run: (tx: any) => Promise<unknown>) => run(prisma)),
    challenge: {
      findUnique: vi.fn().mockResolvedValue(persisted),
      update,
    },
  };
  return { service: new PortfolioService(prisma), update };
}

/** Captura el AppError para poder afirmar sobre statusCode y code. */
async function capture(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (err) {
    return err as AppError;
  }
  throw new Error('se esperaba un AppError y la llamada tuvo exito');
}

describe('ADR-030 · PortfolioService aplica la maquina de estados', () => {
  it('rechaza con 409 la transicion que motivo el ADR: cerrado → draft', async () => {
    const { service, update } = makeService({ id: 'c1', status: 'cerrado' });

    const err = await capture(() => service.updateChallenge('c1', { status: 'draft' } as any));

    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CHALLENGE_ILLEGAL_TRANSITION');
    // Lo importante: no llego a escribir. Antes `data: input as any` lo habria persistido.
    expect(update).not.toHaveBeenCalled();
  });

  it('deja pasar una transicion legal y la escribe', async () => {
    const { service, update } = makeService({ id: 'c1', status: 'draft' });

    await service.updateChallenge('c1', { status: 'listo_para_activar' } as any);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data.status).toBe('listo_para_activar');
  });

  it('al pausar persiste el estado del que se viene', async () => {
    const { service, update } = makeService({ id: 'c1', status: 'recibiendo_iniciativas' });

    await service.updateChallenge('c1', { status: 'pausado' } as any);

    expect(update.mock.calls[0][0].data.pausedFromStatus).toBe('recibiendo_iniciativas');
  });

  it('al reanudar vuelve al estado previo y limpia la memoria de la pausa', async () => {
    const { service, update } = makeService({
      id: 'c1',
      status: 'pausado',
      pausedFromStatus: 'recibiendo_iniciativas',
    });

    await service.updateChallenge('c1', { status: 'recibiendo_iniciativas' } as any);

    expect(update.mock.calls[0][0].data.pausedFromStatus).toBeNull();
  });

  it('no deja reanudar a un estado distinto del que se pauso', async () => {
    const { service, update } = makeService({
      id: 'c1',
      status: 'pausado',
      pausedFromStatus: 'activo_interno',
    });

    const err = await capture(() => service.updateChallenge('c1', { status: 'publicado' } as any));

    expect(err.statusCode).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it('un PATCH que NO trae status no se valida como transicion', async () => {
    // Un reto cerrado sigue pudiendo corregir su titulo: cerrar no es congelar el texto.
    const { service, update } = makeService({ id: 'c1', status: 'cerrado' });

    await service.updateChallenge('c1', { title: 'Titulo corregido' } as any);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data.pausedFromStatus).toBeUndefined();
  });

  it('activateOpenCall tampoco puede resucitar un reto cerrado', async () => {
    const { service, update } = makeService({ id: 'c1', status: 'cerrado' });

    const err = await capture(() => service.activateOpenCall('c1'));

    expect(err.statusCode).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it('publishChallenge respeta la tabla (draft no publica directo)', async () => {
    const { service, update } = makeService({ id: 'c1', status: 'draft' });

    const err = await capture(() => service.publishChallenge('c1'));

    expect(err.statusCode).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
});
