import { z } from 'zod';
import {
  CONVERSION_COPY, conversionDestinationHrefSchema, conversionPresentationSchema,
  type ConversionPresentation,
} from '../presentation/conversion-presentation.dto';

export type ConversionConfigReader = () => unknown;

const destinationType = z.enum(['DEMO', 'EARLY_ACCESS']);
const configSchema = z.object({
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  approvedExternalDestinations: z.array(z.object({
    type: destinationType,
    href: conversionDestinationHrefSchema,
  }).strict()).max(2),
  // Read identities first so an inactive/invalid duplicate cannot be silently ignored.
  // Every destination is strictly validated below before any public field is emitted.
  destinations: z.array(z.object({ type: destinationType }).passthrough()).max(2),
}).strict();

const destinationSchema = z.object({
  type: destinationType,
  status: z.enum(['UNVERIFIED', 'DISABLED', 'VERIFIED_ACTIVE']),
  destinationKind: z.literal('EXTERNAL'),
  href: conversionDestinationHrefSchema.optional(),
  contextSharingSupported: z.literal(false),
}).strict();

function unavailable(version: number | null = null): ConversionPresentation {
  return { availability: 'NO_VERIFIED_DESTINATION', conversionConfigVersion: version, destinations: [] };
}

// No source/session/reasoning arguments, I/O, URL probing, persistence or logging.
export function readConversionPresentation(readConfig: ConversionConfigReader = () => undefined): ConversionPresentation {
  try {
    const parsed = configSchema.safeParse(readConfig());
    if (!parsed.success) return unavailable();
    const config = parsed.data;
    if (new Set(config.destinations.map((destination) => destination.type)).size !== config.destinations.length) {
      return unavailable(config.version);
    }
    const destinations = config.destinations.flatMap((candidate) => {
      const result = destinationSchema.safeParse(candidate);
      if (!result.success) return [];
      const destination = result.data;
      if (destination.status !== 'VERIFIED_ACTIVE' || !destination.href) return [];
      const approved = config.approvedExternalDestinations.some(
        (entry) => entry.type === destination.type && entry.href === destination.href,
      );
      if (!approved) return [];
      return [{
        type: destination.type, status: destination.status,
        destinationKind: destination.destinationKind, href: destination.href,
        contextSharingSupported: false as const, ...CONVERSION_COPY[destination.type],
      }];
    });
    destinations.sort((a, b) => a.type === b.type ? 0 : a.type === 'DEMO' ? -1 : 1);
    const availability = destinations.length === 2 ? 'EARLY_ACCESS_AND_DEMO'
      : destinations[0]?.type === 'DEMO' ? 'DEMO_ONLY'
        : destinations[0]?.type === 'EARLY_ACCESS' ? 'EARLY_ACCESS_ONLY'
          : 'NO_VERIFIED_DESTINATION';
    const result = conversionPresentationSchema.safeParse({
      availability, conversionConfigVersion: config.version, destinations,
    });
    return result.success ? result.data : unavailable(config.version);
  } catch {
    // Commercial configuration failure must not invalidate the semantic Path.
    return unavailable();
  }
}

