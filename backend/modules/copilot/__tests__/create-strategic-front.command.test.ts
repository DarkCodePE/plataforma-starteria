import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { CreateStrategicFrontCommandHandler } from '../commands/create-strategic-front.command';

describe('CreateStrategicFrontCommandHandler', () => {
  afterEach(() => {
    delete process.env.COPILOT_DRY_RUN_FAILURE_INJECTION_ENABLED;
    delete process.env.COPILOT_DRY_RUN_PORTFOLIO_FAILURE_MODE;
  });

  it('construye payload Portfolio compatible y devuelve resultado estructurado', async () => {
    const service = {
      createStrategicFront: vi.fn(async (input) => ({
        id: 'front1',
        name: input.name,
        organizationId: input.organizationId,
      })),
    } as unknown as PortfolioService;
    const handler = new CreateStrategicFrontCommandHandler(service);

    const result = await handler.execute({
      organizationId: 'org1',
      name: 'Eficiencia operativa',
      objective: 'Reducir tiempos de ciclo',
      mainKpi: 'Tiempo de ciclo',
      baseline: '10 dias',
      target: '5 dias',
      horizon: 'Q4',
      sponsor: 'Operaciones',
      priority: 'Alta',
      createdBy: 'user1',
    });

    expect(service.createStrategicFront).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Eficiencia operativa',
        strategicObjective: 'Reducir tiempos de ciclo',
        mainKpi: 'Tiempo de ciclo',
        organizationId: 'org1',
        ownerId: 'user1',
        priority: 'Alta',
      }),
      { organizationId: 'org1', actorUserId: 'user1' },
    );
    expect(result).toMatchObject({
      success: true,
      commandType: 'CreateStrategicFrontCommand',
      createdObjects: [{ type: 'StrategicFront', id: 'front1', label: 'Eficiencia operativa' }],
    });
    expect(result.projectionLinks[0]).toMatchObject({
      objectType: 'StrategicFront',
      objectId: 'front1',
    });
  });

  it('rechaza payload incompatible antes de llamar Portfolio', async () => {
    const service = {
      createStrategicFront: vi.fn(),
    } as unknown as PortfolioService;
    const handler = new CreateStrategicFrontCommandHandler(service);

    await expect(handler.execute({
      organizationId: 'org1',
      name: 'A',
      createdBy: 'user1',
    })).rejects.toMatchObject({ code: 'DOMAIN_VALIDATION_FAILED' });
    expect(service.createStrategicFront).not.toHaveBeenCalled();
  });

  it('simula fallo dry run antes de crear StrategicFront solo cuando esta habilitado', async () => {
    process.env.COPILOT_DRY_RUN_FAILURE_INJECTION_ENABLED = 'true';
    process.env.COPILOT_DRY_RUN_PORTFOLIO_FAILURE_MODE = 'before_create';
    const service = {
      createStrategicFront: vi.fn(),
    } as unknown as PortfolioService;
    const handler = new CreateStrategicFrontCommandHandler(service);

    await expect(handler.execute({
      organizationId: 'org1',
      name: 'Fallo controlado',
      objective: 'Validar error seguro',
      mainKpi: 'errores',
      baseline: '0',
      target: '0',
      horizon: '1 mes',
      sponsor: 'Soporte',
      priority: 'Alta',
      createdBy: 'user1',
    })).rejects.toMatchObject({ code: 'COMMAND_EXECUTION_FAILED' });
    expect(service.createStrategicFront).not.toHaveBeenCalled();
  });

  it('rechaza failure injection en produccion', async () => {
    process.env.COPILOT_DRY_RUN_FAILURE_INJECTION_ENABLED = 'true';
    process.env.COPILOT_DRY_RUN_PORTFOLIO_FAILURE_MODE = 'before_create';
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const service = {
      createStrategicFront: vi.fn(),
    } as unknown as PortfolioService;
    const handler = new CreateStrategicFrontCommandHandler(service);

    await expect(handler.execute({
      organizationId: 'org1',
      name: 'Fallo controlado',
      objective: 'Validar error seguro',
      mainKpi: 'errores',
      baseline: '0',
      target: '0',
      horizon: '1 mes',
      sponsor: 'Soporte',
      priority: 'Alta',
      createdBy: 'user1',
    })).rejects.toMatchObject({ code: 'DRY_RUN_FAILURE_INJECTION_FORBIDDEN' });
    expect(service.createStrategicFront).not.toHaveBeenCalled();
    process.env.NODE_ENV = previousNodeEnv;
  });
});
