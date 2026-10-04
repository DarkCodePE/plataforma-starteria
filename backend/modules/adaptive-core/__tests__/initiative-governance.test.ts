import { describe, expect, it } from 'vitest';
import { governanceForChallengeInitiative } from '../initiative-governance';

describe('governanceForChallengeInitiative', () => {
  it('el owner del Reto gobierna la iniciativa', () => {
    expect(governanceForChallengeInitiative({ ownerId: 'lead-reto', strategicFront: { ownerId: 'lead-frente' } }))
      .toEqual({ mode: 'portfolio_governed', portfolioLeadUserId: 'lead-reto' });
  });

  it('sin owner del Reto, hereda el del Frente', () => {
    expect(governanceForChallengeInitiative({ ownerId: null, strategicFront: { ownerId: 'lead-frente' } }).portfolioLeadUserId).toBe('lead-frente');
  });

  it('sin ninguno queda portfolio_governed sin lead asignado', () => {
    expect(governanceForChallengeInitiative({})).toEqual({ mode: 'portfolio_governed', portfolioLeadUserId: null });
  });
});
