import { describe, expect, it, vi } from 'vitest';
import { ChallengeSplitService, parseParts } from '../challenge-split.service';

function makePrisma(front: any) {
  const create = vi.fn((args: any) => ({ id: `new-${args.data.title}`, ...args.data }));
  return {
    prisma: {
      strategicFront: { findUnique: vi.fn().mockResolvedValue(front) },
      challenge: { create },
      $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
    } as any,
    create,
  };
}

function front(overrides: any = {}) {
  return {
    id: 'f1',
    name: 'Adopción pyme',
    strategicObjective: 'Aumentar adopción del producto en clientes pyme',
    description: null,
    whyNow: null,
    constraints: null,
    challenges: [],
    ...overrides,
  };
}

describe('parseParts', () => {
  it('extrae las partes que el texto enumera', () => {
    expect(parseParts('Las iniciativas atacan dos momentos distintos: onboarding y uso recurrente.')).toEqual(['onboarding', 'uso recurrente']);
    expect(parseParts('Tres segmentos: retail, banca e industria')).toEqual(['retail', 'banca', 'industria']);
    expect(parseParts('Aumentar adopción en pymes')).toEqual([]);
  });
});

describe('ChallengeSplitService.suggest (§8–§11)', () => {
  it('propone separar cuando hay partes distintas y explica qué observó, por qué, beneficio, estructura e impacto', async () => {
    const { prisma, create } = makePrisma(
      front({ description: 'Las iniciativas atacan dos momentos distintos: onboarding y uso recurrente, con owners y KPIs diferentes.' }),
    );
    const suggestion = await new ChallengeSplitService(prisma).suggest('f1');

    expect(suggestion).toMatchObject({ recommendation: 'split', provenance: 'AI_SUGGESTED', reviewStatus: 'UNREVIEWED' });
    expect(suggestion.observed).toContain('onboarding');
    expect(suggestion.whySplit).toContain('owners');
    expect(suggestion.benefits.length).toBeGreaterThan(0);
    expect(suggestion.proposedChallenges.map((c) => c.title)).toEqual(['Onboarding', 'Uso recurrente']);
    expect(suggestion.impact).toMatchObject({ challengesToCreate: 2, initiativesMoved: 0 });
    expect(suggestion.signals.map((s) => s.id)).toEqual(expect.arrayContaining(['distinct_problems', 'different_owners', 'different_kpis', 'broad_result']));
    // §26: nunca crear Reto automáticamente.
    expect(create).not.toHaveBeenCalled();
  });

  it('dice que no hace falta otro Reto cuando el frente es un único resultado (§10)', async () => {
    const { prisma } = makePrisma(front({ challenges: [{ title: 'Reducir abandono', overlaps: [], initiativeMetas: [] }] }));
    const suggestion = await new ChallengeSplitService(prisma).suggest('f1');
    expect(suggestion.recommendation).toBe('no_split');
    expect(suggestion.observed).toContain('ya tiene 1 reto');
    expect(suggestion.proposedChallenges).toEqual([]);
  });

  it('no vuelve a proponer partes que ya son retos', async () => {
    const { prisma } = makePrisma(
      front({
        description: 'Dos momentos distintos: onboarding y uso recurrente.',
        challenges: [{ title: 'Mejorar onboarding', overlaps: [], initiativeMetas: [] }],
      }),
    );
    const suggestion = await new ChallengeSplitService(prisma).suggest('f1');
    expect(suggestion.recommendation).toBe('no_split');
  });

  it('404 si el frente no existe', async () => {
    const { prisma } = makePrisma(null);
    await expect(new ChallengeSplitService(prisma).suggest('nope')).rejects.toMatchObject({ code: 'FRONT_NOT_FOUND' });
  });
});

describe('ChallengeSplitService.confirm (§26)', () => {
  it('crea sólo los retos confirmados, como borrador bajo el frente', async () => {
    const { prisma, create } = makePrisma({ id: 'f1' });
    const created = await new ChallengeSplitService(prisma).confirm('f1', [{ title: 'Onboarding', whatWeWantToMove: 'Reducir abandono' }]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(created[0]).toMatchObject({ strategicFrontId: 'f1', title: 'Onboarding', whatWeWantToMove: 'Reducir abandono' });
  });
});
