import { describe, expect, it } from 'vitest';
import { parseStarteriaPathDto } from '../starteriaPath.types';
import { CONVERSION_COPY } from '../conversionPresentation.types';

const versions = {
  pathSchemaVersion: 'starteria-path-dto-v0.2',
  projectionVersion: 'starteria-path-projection-v0.1',
  businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
};
const demo = {
  type: 'DEMO', status: 'VERIFIED_ACTIVE', destinationKind: 'EXTERNAL',
  href: 'https://calendly.com/starteria/demo', contextSharingSupported: false, ...CONVERSION_COPY.DEMO,
};
const presentation = { availability: 'DEMO_ONLY', conversionConfigVersion: 1, destinations: [demo] };
const path = {
  experienceState: 'SUPPORTED', starteriaPathStatus: 'SUPPORTED',
  valueBridge: { currentState: 'Lectura', starteriaContribution: [],
    tangibleOutcome: { statement: 'Resultado tangible', observableArtifact: 'Lectura revisable' }, remainingDependency: [] },
  capabilityPath: [], dependencies: [], firstSupportedMovement: null, boundaryStatement: 'Límite',
  sourceBinding: { criticalHandoffId: 'handoff-1', criticalHandoffVersion: 1, sourceContextRevision: 0,
    current: true, confirmed: true, ...versions },
  versions, conversionPresentation: presentation,
};

describe('125D strict frontend DTO boundary', () => {
  it('accepts the explicitly versioned DTO and rejects old or mismatched versions', () => {
    expect(parseStarteriaPathDto(path)).toEqual(path);
    for (const location of ['versions', 'sourceBinding'] as const) {
      expect(parseStarteriaPathDto({ ...path, [location]: { ...path[location], pathSchemaVersion: 'starteria-path-dto-v0.1' } })).toBeNull();
    }
    expect(parseStarteriaPathDto({ ...path, conversionPresentation: undefined })).toBeNull();
  });

  it('rejects extra, contradictory or unsafe commercial presentation rather than stripping it', () => {
    const invalid = [
      { ...presentation, availability: 'NO_VERIFIED_DESTINATION' },
      { ...presentation, availability: 'EARLY_ACCESS_ONLY' },
      { ...presentation, availability: 'EARLY_ACCESS_AND_DEMO' },
      { ...presentation, destinations: [] },
      { ...presentation, destinations: [demo, demo] },
      { ...presentation, conversionConfigVersion: null },
      ...['submissionStatus', 'consentStatus', 'conversionIntentId', 'pii', 'internalConfigName'].map((key) => ({ ...presentation, [key]: 'private' })),
      ...[
        { status: 'UNVERIFIED' }, { href: 'javascript:alert(1)' }, { href: 'data:text/html,x' },
        { href: '/portfolio/setup' }, { href: 'https://calendly.com/starteria/demo?context=private' },
        { href: 'https://user:secret@calendly.com/starteria/demo' },
        { label: 'Entrar a Starteria' }, { availabilityDisclosure: 'Reserva confirmada' },
        { contextSharingSupported: true }, { providerCredentials: 'private' },
      ].map((patch) => ({ ...presentation, destinations: [{ ...demo, ...patch }] })),
    ];
    for (const conversionPresentation of invalid) expect(parseStarteriaPathDto({ ...path, conversionPresentation })).toBeNull();
    expect(parseStarteriaPathDto({ ...path, conversionIntentId: 'private' })).toBeNull();
  });

  it.each(['STALE', 'UNAVAILABLE_UNCONFIRMED', 'UNAVAILABLE_INSUFFICIENT_BASIS', 'UNAVAILABLE_INVALID'])('keeps %s free of commercial fields', (experienceState) => {
    const unavailable = { experienceState, boundaryStatement: 'No disponible', versions };
    expect(parseStarteriaPathDto(unavailable)).toEqual(unavailable);
    expect(parseStarteriaPathDto({ ...unavailable, conversionPresentation: presentation })).toBeNull();
  });
});
