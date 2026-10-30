import { describe, expect, it } from 'vitest';
import { z } from 'zod/v3';
import {
  CREATE_STRATEGIC_FRONT_CAPABILITY_ID,
  CREATE_STRATEGIC_FRONT_COMMAND_TYPE,
  CapabilityRegistry,
  createDefaultCapabilityRegistry,
  createStrategicFrontCapability,
} from '../application/capability-registry';

describe('CapabilityRegistry', () => {
  it('registra CreateStrategicFront', () => {
    const registry = createDefaultCapabilityRegistry();
    const capability = registry.getById(CREATE_STRATEGIC_FRONT_CAPABILITY_ID);

    expect(capability.ownerPrd).toBe('PRD-06');
    expect(capability.supportedIntents).toContain('create_strategic_front');
    expect(capability.operation).toBe('create');
    expect(capability.requiresConfirmation).toBe(true);
    expect(capability.commandType).toBe(CREATE_STRATEGIC_FRONT_COMMAND_TYPE);
    expect(capability.resultProjection).toContain('portfolio.home.strategic_map');
    expect(capability.resultProjection).toContain('portfolio.strategic_fronts.detail');
  });

  it('obtiene por ID y busca por intent', () => {
    const registry = createDefaultCapabilityRegistry();

    expect(registry.getById('CreateStrategicFront').id).toBe('CreateStrategicFront');
    expect(registry.findByIntent('create_strategic_front')).toHaveLength(1);
    expect(registry.findByIntent('import_existing_work')).toHaveLength(0);
  });

  it('rechaza capability duplicada', () => {
    const registry = new CapabilityRegistry([createStrategicFrontCapability]);

    expect(() => registry.register(createStrategicFrontCapability)).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_CAPABILITY' }),
    );
  });

  it('rechaza capability desconocida', () => {
    const registry = createDefaultCapabilityRegistry();

    expect(() => registry.getById('CreateChallenge')).toThrow(
      expect.objectContaining({ code: 'CAPABILITY_NOT_FOUND' }),
    );
  });

  it('valida payload correcto para CreateStrategicFront', () => {
    const registry = createDefaultCapabilityRegistry();
    const result = registry.validatePayload('CreateStrategicFront', {
      organizationId: 'org1',
      name: 'Eficiencia operativa',
      objective: 'Reducir tiempos de atencion.',
      mainKpi: 'Tiempo de ciclo',
      baseline: '10 dias',
      target: '5 dias',
      horizon: 'Q4',
      sponsor: 'Gerencia de Operaciones',
      priority: 'Media',
      createdBy: 'user1',
    });

    expect(result.success).toBe(true);
  });

  it('rechaza payload invalido y campos no persistibles', () => {
    const registry = createDefaultCapabilityRegistry();
    const result = registry.validatePayload('CreateStrategicFront', {
      organizationId: 'org1',
      name: 'A',
      createdBy: 'user1',
      sponsorId: 'not-supported',
    });

    expect(result.success).toBe(false);
  });

  it('impide IDs duplicados para capabilities custom', () => {
    const registry = new CapabilityRegistry();
    const definition = {
      ...createStrategicFrontCapability,
      inputSchema: z.object({ organizationId: z.string(), name: z.string(), createdBy: z.string() }),
    };

    registry.register(definition);
    expect(() => registry.register(definition)).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_CAPABILITY' }),
    );
  });
});
