import { describe, expect, it } from 'vitest';
import { starteriaPathConversionConfig } from '../../../config/starteria-path-conversion';
import { readConversionPresentation } from '../application/conversion-presentation.service';
import { conversionPresentationSchema } from '../presentation/conversion-presentation.dto';

// Synthetic, non-operational test facts. These do not verify or activate destinations.
const demoHref = 'https://calendly.com/starteria/demo-request';
const earlyHref = 'https://calendly.com/starteria/early-access-request';
function facts(types: string[] = ['DEMO']) {
  return {
    version: 7,
    approvedExternalDestinations: types.map((type) => ({ type, href: type === 'DEMO' ? demoHref : earlyHref })),
    destinations: types.map((type) => ({
      type, status: 'VERIFIED_ACTIVE', destinationKind: 'EXTERNAL',
      href: type === 'DEMO' ? demoHref : earlyHref, contextSharingSupported: false,
    })),
  };
}

describe('125D server-owned conversion facts', () => {
  it('defaults absent config and the governed baseline to no verified destination', () => {
    for (const input of [undefined, null, {}, starteriaPathConversionConfig]) {
      expect(readConversionPresentation(() => input)).toMatchObject({
        availability: 'NO_VERIFIED_DESTINATION', destinations: [],
      });
    }
  });

  it.each([undefined, null, true, 'true', 'UNVERIFIED', 'DISABLED'])('does not treat a URL as verification: %s', (status) => {
    const config = facts();
    const input = { ...config, destinations: [{ ...config.destinations[0], status }] };
    expect(readConversionPresentation(() => input).availability).toBe('NO_VERIFIED_DESTINATION');
  });

  it.each([
    [[], 'NO_VERIFIED_DESTINATION'], [['DEMO'], 'DEMO_ONLY'],
    [['EARLY_ACCESS'], 'EARLY_ACCESS_ONLY'], [['EARLY_ACCESS', 'DEMO'], 'EARLY_ACCESS_AND_DEMO'],
  ])('normalizes %j into a strict public DTO', (types, availability) => {
    const result = readConversionPresentation(() => facts(types));
    expect(result.availability).toBe(availability);
    expect(result.conversionConfigVersion).toBe(7);
    expect(conversionPresentationSchema.parse(result)).toEqual(result);
    expect(result.destinations.map((destination) => destination.type)).toEqual([...types].sort());
  });

  it.each([
    'javascript:alert(1)', 'data:text/html,secret', 'http://calendly.com/starteria/demo-request',
    '//calendly.com/starteria/demo-request', '/portfolio/setup', '/auth/continue/123',
    'https://user:secret@calendly.com/starteria/demo-request',
    'https://calendly.com/starteria/demo-request?redirect=https://evil.com',
    'https://calendly.com/starteria/demo-request?context=private',
    'https://calendly.com/starteria/demo-request#secret',
    'https://calendly.com:8443/starteria/demo-request',
    'https://calendly.com/starteria/%2e%2e/redirect',
    'https://calendly.com/starteria/../redirect',
    'https://calendly.com\\@evil.com/path',
    'https://127.0.0.1/path', 'https://localhost/path', 'https://example.com/placeholder',
    'https://company.test/placeholder', ' https://calendly.com/starteria/demo-request',
  ])('rejects unsafe or unsupported URL even when explicitly marked verified: %s', (href) => {
    const config = facts();
    config.destinations[0].href = href;
    // Even an allowlist entry cannot bypass the URL policy.
    config.approvedExternalDestinations[0].href = href;
    const result = readConversionPresentation(() => config);
    expect(result.availability).toBe('NO_VERIFIED_DESTINATION');
    expect(JSON.stringify(result)).not.toContain(href);
  });

  it('requires an exact, type-bound approved URL, not just a trusted hostname', () => {
    for (const href of ['https://calendly.com/attacker/redirect', 'https://calendly.com.evil.com/starteria/demo-request']) {
      const config = facts();
      config.destinations[0].href = href;
      expect(readConversionPresentation(() => config).availability).toBe('NO_VERIFIED_DESTINATION');
    }
    const config = facts();
    config.approvedExternalDestinations[0].type = 'EARLY_ACCESS';
    expect(readConversionPresentation(() => config).availability).toBe('NO_VERIFIED_DESTINATION');
  });

  it('does not discard a verified Demo when Early Access is unverified', () => {
    const config = facts(['DEMO', 'EARLY_ACCESS']);
    config.destinations[1].status = 'UNVERIFIED';
    expect(readConversionPresentation(() => config).availability).toBe('DEMO_ONLY');
  });

  it.each(['DISABLED', 'UNVERIFIED'])('fails closed for contradictory duplicate types with %s in either order', (status) => {
    const config = facts();
    const active = config.destinations[0];
    const inactive = { ...active, status };
    for (const destinations of [[active, inactive], [inactive, active]]) {
      expect(readConversionPresentation(() => ({ ...config, destinations }))).toEqual({
        availability: 'NO_VERIFIED_DESTINATION', conversionConfigVersion: 7, destinations: [],
      });
    }
  });

  it('fails closed for duplicate destinations, malformed config and reader exceptions without leaking details', () => {
    const duplicate = facts(['DEMO', 'DEMO']);
    for (const config of [duplicate, { ...facts(), secret: 'private' }, { ...facts(), version: 0 }]) {
      const result = readConversionPresentation(() => config);
      expect(result.availability).toBe('NO_VERIFIED_DESTINATION');
      expect(JSON.stringify(result)).not.toContain('private');
    }
    expect(readConversionPresentation(() => { throw new Error('provider secret'); })).toEqual({
      availability: 'NO_VERIFIED_DESTINATION', conversionConfigVersion: null, destinations: [],
    });
  });

  it('keeps unsupported internal routes and context sharing disabled', () => {
    const config = facts();
    for (const patch of [{ destinationKind: 'INTERNAL' }, { contextSharingSupported: true }]) {
      expect(readConversionPresentation(() => ({ ...config, destinations: [{ ...config.destinations[0], ...patch }] })).availability)
        .toBe('NO_VERIFIED_DESTINATION');
    }
  });

  it('rejects contradictory, unsafe and extra commercial fields', () => {
    const schema = conversionPresentationSchema;
    const valid = readConversionPresentation(() => facts());
    const destination = valid.destinations[0];
    const invalid = [
      { ...valid, availability: 'NO_VERIFIED_DESTINATION' },
      { ...valid, availability: 'EARLY_ACCESS_ONLY' },
      { ...valid, availability: 'EARLY_ACCESS_AND_DEMO' },
      { ...valid, destinations: [] },
      { ...valid, destinations: [destination, destination] },
      { ...valid, conversionConfigVersion: null },
      ...['submissionStatus', 'consentStatus', 'conversionIntentId', 'pii', 'internalConfigName'].map((field) => ({ ...valid, [field]: 'private' })),
      ...[
        { status: 'UNVERIFIED' }, { href: 'javascript:alert(1)' }, { label: 'Entrar a Starteria' },
        { availabilityDisclosure: 'Tu reserva está confirmada' }, { providerCredentials: 'secret' },
        { contextSharingSupported: true }, { destinationKind: 'INTERNAL' },
      ].map((patch) => ({ ...valid, destinations: [{ ...destination, ...patch }] })),
    ];
    for (const candidate of invalid) expect(schema.safeParse(candidate).success).toBe(false);
  });
});
