import { describe, expect, it } from 'vitest';
import {
  linkImportedInitiativeBodySchema,
  registerImportedInitiativeBodySchema,
} from '../challenge-activation-brief.schemas';

const checkpoint = {
  expectedWorkItemUpdatedAt: '2026-10-23T08:00:00.000Z',
  identityConfirmed: true,
  alignmentConfirmed: true,
};

describe('ADR-009 imported initiative command schemas', () => {
  it('accepts explicit REGISTER_EXISTING confirmation and bounded overrides', () => {
    expect(registerImportedInitiativeBodySchema.parse({
      ...checkpoint,
      name: 'Onboarding guiado',
      description: 'Trabajo preexistente documentado.',
    })).toEqual(expect.objectContaining(checkpoint));
  });

  it('requires both human confirmations and a source version', () => {
    expect(() => registerImportedInitiativeBodySchema.parse({
      ...checkpoint,
      alignmentConfirmed: false,
    })).toThrow();
    expect(() => registerImportedInitiativeBodySchema.parse({
      identityConfirmed: true,
      alignmentConfirmed: true,
    })).toThrow();
  });

  it('requires a canonical Project for LINK_EXISTING', () => {
    expect(linkImportedInitiativeBodySchema.parse({ ...checkpoint, projectId: 'project-1' })).toEqual(expect.objectContaining({ projectId: 'project-1' }));
    expect(() => linkImportedInitiativeBodySchema.parse(checkpoint)).toThrow();
  });
});
