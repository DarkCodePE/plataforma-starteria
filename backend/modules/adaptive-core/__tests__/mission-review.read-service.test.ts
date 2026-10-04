import { describe, expect, it, vi } from 'vitest';
import { MissionReviewReadService } from '../mission-review.read-service';

function makePrisma(project: any) {
  return { project: { findUnique: vi.fn().mockResolvedValue(project) } } as any;
}

function project(overrides: any = {}) {
  return {
    id: 'p1',
    name: 'Autoservicio sucursales',
    ownerId: 'owner',
    step0Data: {
      contextInitial: 'El 40% de las solicitudes son repetidas',
      expectedImpact: 'Bajar el costo por solicitud',
      mainRisk: 'El canal digital puede subir reclamos',
      decisionRequested: 'Escalar o no el autoservicio',
      pendingQuestions: [{ question: '¿Qué sucursales participan?' }, 'Presupuesto disponible'],
    },
    teamMembers: [
      { userId: 'owner', user: { name: 'Owner' } },
      { userId: 'u2', user: { name: 'Analista' } },
    ],
    portfolioMeta: [],
    ...overrides,
  };
}

const assigned = {
  portfolioMeta: [
    {
      mentor: 'Mentora',
      mainBlocker: 'Acceso a datos del CRM',
      hypothesisCovered: null,
      challenge: {
        id: 'c1',
        title: 'Reducir costo de atención',
        whatWeWantToMove: 'Bajar el costo por solicitud de 14.20 a 10.00',
        whyNow: 'El presupuesto depende de esta mejora',
        successCriteria: 'Costo bajo 12.00 en el piloto',
        challengeOwner: 'Gerencia de Operaciones',
        activationInputs: { timeAvailable: 'acotado', internalCapacity: 'media' },
        challengeTeam: [{ user: null, label: 'Equipo CX' }],
        strategicFront: {
          id: 'f1',
          name: 'Eficiencia operativa',
          strategicObjective: 'Reducir el costo de atención sin deteriorar calidad',
          mainKpi: 'Costo por solicitud',
          target: '10.00',
          horizon: '12 meses',
        },
      },
    },
  ],
};

describe('MissionReviewReadService', () => {
  it('reúne lo heredado del Reto y el Frente para una iniciativa asignada (§18, Core §14.1)', async () => {
    const view = await new MissionReviewReadService(makePrisma(project(assigned))).get('p1', 'owner', 'participante');

    expect(view.independent).toBe(false);
    expect(view.whatToMove).toBe('Bajar el costo por solicitud de 14.20 a 10.00');
    expect(view.inheritedContext.strategicFront).toMatchObject({ name: 'Eficiencia operativa', kpi: 'Costo por solicitud', horizon: '12 meses' });
    expect(view.inheritedContext.challenge).toMatchObject({ title: 'Reducir costo de atención', whyNow: 'El presupuesto depende de esta mejora' });
    expect(view.expectedContribution).toBe('Costo bajo 12.00 en el piloto');
    expect(view.capacity).toEqual(['Tiempo disponible: acotado', 'Capacidad interna: media']);
    expect(view.dependencies).toEqual(['Acceso a datos del CRM']);
    expect(view.whoCanHelp).toEqual(['Analista', 'Equipo CX', 'Gerencia de Operaciones', 'Mentora']);
    expect(view.decisionToEnable).toBe('Escalar o no el autoservicio');
    expect(view.constraints).toEqual(['El canal digital puede subir reclamos']);
    expect(view.openQuestions).toEqual(['¿Qué sucursales participan?', 'Presupuesto disponible']);
  });

  it('una iniciativa independiente no inventa Frente ni Reto (§16)', async () => {
    const view = await new MissionReviewReadService(makePrisma(project())).get('p1', 'owner', 'participante');

    expect(view.independent).toBe(true);
    expect(view.inheritedContext.strategicFront).toBeNull();
    expect(view.inheritedContext.challenge).toBeNull();
    expect(view.capacity).toEqual([]);
    expect(view.expectedContribution).toBe('Bajar el costo por solicitud');
  });

  it('niega el acceso a quien no es del equipo', async () => {
    const service = new MissionReviewReadService(makePrisma(project()));
    await expect(service.get('p1', 'stranger', 'participante')).rejects.toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
  });

  it('responde 404 si el proyecto no existe', async () => {
    const service = new MissionReviewReadService(makePrisma(null));
    await expect(service.get('missing', 'owner', 'participante')).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});
