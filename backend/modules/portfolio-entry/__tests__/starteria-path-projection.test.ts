import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BUSINESS_CAPABILITY_BOUNDARY_VERSION,
  STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION,
  projectStarteriaPath,
  type ConfirmedCurrentCriticalHandoffInput,
  type StarteriaPathVersions,
} from '../presentation/starteria-path-projection';
import type { StarteriaPathDependencyCategory } from '../domain/starteria-path.types';

const versions: StarteriaPathVersions = {
  schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
  projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
  businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
};

function makeInput(
  overrides: Partial<ConfirmedCurrentCriticalHandoffInput> = {},
): ConfirmedCurrentCriticalHandoffInput {
  return {
    artifactId: 'critical-handoff-17',
    artifactVersion: 3,
    sourceContextRevision: 9,
    conclusionStatus: 'supported',
    finalReading: 'The supplied evidence reaches the review after its decision point.',
    decisionInView: 'Which evidence should inform the review?',
    usableNow: [],
    decisionChangingUnknowns: [],
    ...overrides,
  };
}

function expectNoPath(
  projection: ReturnType<typeof projectStarteriaPath>,
  status: 'unavailable_insufficient_basis' | 'unavailable_invalid',
) {
  expect(projection.pathStatus).toBe(status);
  expect(projection).not.toHaveProperty('valueBridge');
  expect(projection).not.toHaveProperty('capabilityPath');
  expect(projection).not.toHaveProperty('dependencies');
  expect(projection).not.toHaveProperty('firstSupportedMovement');
}

describe('Starteria Path deterministic projection', () => {
  it('projects a supported Critical Handoff as a supported Path', () => {
    const input = makeInput();
    const projection = projectStarteriaPath(input, versions);

    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');
    expect(projection.valueBridge.currentState).toBe(input.finalReading);
    expect(projection.sourceBinding).toEqual({
      artifactId: input.artifactId,
      artifactVersion: input.artifactVersion,
      sourceContextRevision: input.sourceContextRevision,
    });
  });

  it('projects a bounded Critical Handoff as a bounded Path', () => {
    const projection = projectStarteriaPath(makeInput({ conclusionStatus: 'bounded' }), versions);

    expect(projection.pathStatus).toBe('bounded');
  });

  it('returns deeply equal semantic output for the same source and versions', () => {
    const input = makeInput({
      usableNow: [{ item: 'The existing review.', howItCanHelp: 'It provides the current comparison point.' }],
      decisionChangingUnknowns: [{
        uncertainty: 'When the external signal will arrive.',
        whyItMatters: 'Its timing may change what can be prepared for the review.',
      }],
    });

    expect(projectStarteriaPath(input, versions)).toStrictEqual(projectStarteriaPath(input, versions));
  });

  it('does not synthesize an immediate action or first movement when 114D has none', () => {
    const projection = projectStarteriaPath(makeInput(), versions);

    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');
    expect(projection.firstSupportedMovement).toBeNull();
    expect(projection.valueBridge.immediateNextAction).toBeNull();
  });

  it('copies a present first movement exactly within the bounded field allowlist', () => {
    const firstMovement = {
      movement: 'Review the existing evidence before the decision point.',
      whyNow: 'The review is already scheduled.',
      whatItMayClarify: 'Which options remain supported by current evidence.',
      boundary: 'It does not make the decision for the person.',
    };
    const projection = projectStarteriaPath(makeInput({
      conclusionStatus: 'bounded',
      firstMovement,
    }), versions);

    expect(projection.pathStatus).toBe('bounded');
    if (projection.pathStatus !== 'bounded') throw new Error('Expected a bounded Path.');
    expect(projection.firstSupportedMovement).toEqual(firstMovement);
    expect(Object.keys(projection.firstSupportedMovement ?? {}).sort()).toEqual([
      'boundary',
      'movement',
      'whatItMayClarify',
      'whyNow',
    ]);
    expect(projection.valueBridge.immediateNextAction).toEqual(firstMovement);
  });

  it('keeps generic decision-changing unknowns visible without inventing a dependency category', () => {
    const unknown = {
      uncertainty: 'When the external signal will arrive.',
      whyItMatters: 'Its timing may change what can be prepared for the review.',
    };
    const projection = projectStarteriaPath(makeInput({
      conclusionStatus: 'bounded',
      decisionChangingUnknowns: [unknown],
    }), versions);

    expect(projection.pathStatus).toBe('bounded');
    if (projection.pathStatus !== 'bounded') throw new Error('Expected a bounded Path.');
    expect(projection.dependencies).toEqual([]);
    expect(projection.valueBridge.remainingDependencies).toEqual([{
      statement: unknown.uncertainty,
      whyItMatters: unknown.whyItMatters,
      sourceBasis: 'DECISION_CHANGING_UNKNOWN',
    }]);
    expect(projection.capabilityPath.map(({ capabilityType }) => capabilityType)).toContain('GUIDE_OR_TRACK_UNCERTAINTY');
    expect(projection.valueBridge.remainingDependencies[0]).not.toHaveProperty('provider');
    expect(projection.valueBridge.remainingDependencies[0]).not.toHaveProperty('whatStarteriaCanDoOnceAvailable');
  });

  it.each([
    'STARTERIA_CAN_HELP_STRUCTURE',
    'REQUIRES_ORGANIZATIONAL_INPUT',
    'REQUIRES_EXTERNAL_EVIDENCE',
  ] as const)('does not infer %s from a generic 114D unknown', (category) => {
    const projection = projectStarteriaPath(makeInput({
      decisionChangingUnknowns: [{
        uncertainty: 'When the external signal will arrive.',
        whyItMatters: 'Its timing may change what can be prepared for the review.',
      }],
    }), versions);

    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');
    expect(projection.dependencies.map(({ category: actual }) => actual)).not.toContain(category);
    expect(projection.valueBridge.remainingDependencies[0]).toMatchObject({
      statement: 'When the external signal will arrive.',
      whyItMatters: 'Its timing may change what can be prepared for the review.',
    });
  });

  it('exposes only the KAN-123 dependency category allowlist and no UNCLASSIFIED category', () => {
    expectTypeOf<StarteriaPathDependencyCategory>().toEqualTypeOf<
      | 'STARTERIA_CAN_HELP_STRUCTURE'
      | 'REQUIRES_ORGANIZATIONAL_INPUT'
      | 'REQUIRES_EXTERNAL_EVIDENCE'
    >();

    const projection = projectStarteriaPath(makeInput({
      decisionChangingUnknowns: [{
        uncertainty: 'When the external signal will arrive.',
        whyItMatters: 'Its timing may change what can be prepared for the review.',
      }],
    }), versions);
    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');

    const allowed = new Set<StarteriaPathDependencyCategory>([
      'STARTERIA_CAN_HELP_STRUCTURE',
      'REQUIRES_ORGANIZATIONAL_INPUT',
      'REQUIRES_EXTERNAL_EVIDENCE',
    ]);
    expect(projection.dependencies.every(({ category }) => allowed.has(category))).toBe(true);
    expect(JSON.stringify(projection)).not.toContain('UNCLASSIFIED');
  });

  it('keeps capability availability at the current 114E surface state', () => {
    const projection = projectStarteriaPath(makeInput(), versions);
    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');

    // Exposing an API in 125B alone is not verified evidence for the 114E surface.
    // Promotion requires verified surface evidence and a versioned semantic change.
    expect(projection.capabilityPath.every(({ availabilityState }) =>
      availabilityState === 'REQUIRES_IMPLEMENTATION',
    )).toBe(true);
    expect(projection.valueBridge.starteriaContribution.every(({ availabilityState }) =>
      availabilityState === 'REQUIRES_IMPLEMENTATION',
    )).toBe(true);
    expect(projection.valueBridge.tangibleOutcome.availabilityState).toBe('REQUIRES_IMPLEMENTATION');
    expect(JSON.stringify(projection)).not.toContain('CURRENTLY_EVIDENCED');
  });

  it('maps usable-now material to source-backed visibility and structure nodes', () => {
    const usable = {
      item: 'The existing review.',
      howItCanHelp: 'It provides the current comparison point.',
    };
    const projection = projectStarteriaPath(makeInput({ usableNow: [usable] }), versions);

    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');
    expect(projection.capabilityPath.filter(({ capabilityType }) =>
      capabilityType === 'MAKE_VISIBLE' || capabilityType === 'STRUCTURE',
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilityType: 'MAKE_VISIBLE',
        contextualStatement: usable.item,
        whyItMattersHere: usable.howItCanHelp,
        sourceBasis: 'USABLE_NOW',
        capabilityClass: 'CAN_DO',
      }),
      expect.objectContaining({
        capabilityType: 'STRUCTURE',
        contextualStatement: usable.item,
        whyItMattersHere: usable.howItCanHelp,
        sourceBasis: 'USABLE_NOW',
        capabilityClass: 'CAN_DO',
      }),
    ]));
  });

  it('enables PREPARE_DECISION only when decisionInView is present', () => {
    const decision = 'Which evidence should inform the review?';
    const projection = projectStarteriaPath(makeInput({ decisionInView: decision }), versions);

    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');
    expect(projection.capabilityPath).toContainEqual(expect.objectContaining({
      capabilityType: 'PREPARE_DECISION',
      contextualStatement: decision,
      sourceBasis: 'DECISION_IN_VIEW',
      capabilityClass: 'CAN_SUPPORT',
    }));
  });

  it('does not generate business-result guarantees or prescriptive claims', () => {
    const serialized = JSON.stringify(projectStarteriaPath(makeInput(), versions));

    expect(serialized).not.toMatch(/will reduce churn|guarantees?\s+(?:a\s+)?roi|best initiative|correct strategy|execute this plan|create portfolio|go to portfolio setup/i);
  });

  it('rejects legacy handoff fields and never echoes them into the projection', () => {
    const legacyInput = {
      ...makeInput(),
      starteria_path: { actions: ['legacy'] },
      recommended_approach: 'legacy recommendation',
      recommended_cta: 'legacy CTA',
      alternative_approaches: ['legacy alternative'],
      suggestedRoute: '/portfolio/setup',
    };
    const projection = projectStarteriaPath(
      legacyInput as unknown as ConfirmedCurrentCriticalHandoffInput,
      versions,
    );

    expectNoPath(projection, 'unavailable_invalid');
    expect(JSON.stringify(projection)).not.toMatch(/starteria_path|recommended_approach|recommended_cta|alternative_approaches|suggestedRoute/i);
  });

  it('never emits 114F, Core, Steps, route, CTA, or conversion fields', () => {
    const projection = projectStarteriaPath(makeInput(), versions);
    const forbiddenKeys = new Set([
      'organization',
      'strategicFront',
      'challenge',
      'initiative',
      'step',
      'experiment',
      'scoring',
      'ranking',
      'budget',
      'threshold',
      'continue-portfolio',
      'portfolio/setup',
      'route',
      'destination',
      'cta',
      'conversion',
      'selected_lenses',
      'reasoning_metadata',
      'provenance',
      'provider',
      'model',
      'session',
    ]);
    const keys: string[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value !== null && typeof value === 'object') {
        Object.entries(value).forEach(([key, nested]) => {
          keys.push(key);
          visit(nested);
        });
      }
    };
    visit(projection);

    expect(keys.filter((key) => forbiddenKeys.has(key))).toEqual([]);
    expect(JSON.stringify(projection)).not.toMatch(/\/portfolio\/setup|continue-portfolio|recommended_cta|suggestedRoute/i);
  });

  it('uses only allowlisted semantic source basis values', () => {
    const projection = projectStarteriaPath(makeInput({
      decisionInView: 'Which evidence should inform the review?',
      usableNow: [{ item: 'The existing review.', howItCanHelp: 'It provides the current comparison point.' }],
      decisionChangingUnknowns: [{
        uncertainty: 'When the external signal will arrive.',
        whyItMatters: 'Its timing may change what can be prepared for the review.',
      }],
      firstMovement: {
        movement: 'Review the existing evidence.',
        whyNow: 'The review is scheduled.',
        whatItMayClarify: 'Which evidence can inform the review.',
        boundary: 'It does not decide for the person.',
      },
    }), versions);

    expect(projection.pathStatus).toBe('supported');
    if (projection.pathStatus !== 'supported') throw new Error('Expected a supported Path.');
    const allowed = new Set([
      'FINAL_READING',
      'DECISION_IN_VIEW',
      'USABLE_NOW',
      'DECISION_CHANGING_UNKNOWN',
      'FIRST_MOVEMENT',
    ]);
    const actual = [
      ...projection.capabilityPath.map(({ sourceBasis }) => sourceBasis),
      ...projection.dependencies.map(({ sourceBasis }) => sourceBasis),
    ];

    expect(actual.length).toBeGreaterThan(0);
    expect(actual.every((sourceBasis) => allowed.has(sourceBasis))).toBe(true);
  });

  it('carries explicit schema, projection, and boundary versions', () => {
    const projection = projectStarteriaPath(makeInput(), versions);

    expect(projection.versions).toEqual({
      schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
      projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
      businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
    });
  });

  it.each([
    ['missing supported reading', { finalReading: null }],
    ['empty supported reading', { finalReading: '   ' }],
    ['malformed first movement', { firstMovement: { movement: 'Review evidence.' } }],
  ])('fails closed for %s', (_description, overrides) => {
    const projection = projectStarteriaPath(
      { ...makeInput(), ...overrides } as unknown as ConfirmedCurrentCriticalHandoffInput,
      versions,
    );

    expectNoPath(projection, 'unavailable_invalid');
  });

  it('does not create a Path for insufficient basis', () => {
    const projection = projectStarteriaPath(makeInput({
      conclusionStatus: 'insufficient_basis',
      finalReading: null,
      firstMovement: null,
    }), versions);

    expectNoPath(projection, 'unavailable_insufficient_basis');
  });

  it('fails closed when insufficient basis carries a reading or movement', () => {
    const projection = projectStarteriaPath(makeInput({
      conclusionStatus: 'insufficient_basis',
      finalReading: 'A reading without sufficient basis.',
      firstMovement: {
        movement: 'Review the material.',
        whyNow: 'The review is scheduled.',
        whatItMayClarify: 'What can be considered.',
        boundary: 'It does not decide for the person.',
      },
    }), versions);

    expectNoPath(projection, 'unavailable_invalid');
  });
});
