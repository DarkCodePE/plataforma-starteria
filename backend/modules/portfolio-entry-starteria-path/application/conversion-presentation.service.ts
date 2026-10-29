import { z } from 'zod/v3';
import {
  CONVERSION_COPY, conversionDestinationHrefSchema, conversionPresentationSchema,
  type ConversionPresentation,
  type ConversionDestination,
} from '../presentation/conversion-presentation.dto';

export type ConversionConfigReader = () => unknown;

const destinationType = z.enum(['DEMO', 'EARLY_ACCESS']);
const configSchema = z.object({
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  commercialOwner: z.string().optional(),
  approvedExternalDestinations: z.array(z.object({
    type: destinationType,
    href: conversionDestinationHrefSchema,
  }).strict()).max(2),
  // Read identities first so an inactive/invalid duplicate cannot be silently ignored.
  // Every destination is strictly validated below before any public field is emitted.
  destinations: z.array(z.object({ type: destinationType }).passthrough()).max(2),
}).strict();

const externalDestinationSchema = z.object({
  type: destinationType,
  status: z.enum(['UNVERIFIED', 'DISABLED', 'VERIFIED_ACTIVE']),
  destinationKind: z.literal('EXTERNAL'),
  href: conversionDestinationHrefSchema.optional(),
  contextSharingSupported: z.literal(false),
}).strict();
const firstPartyDestinationSchema = z.object({
  type: destinationType,
  status: z.enum(['UNVERIFIED', 'DISABLED', 'VERIFIED_ACTIVE']),
  destinationKind: z.literal('FIRST_PARTY'),
  receiver: z.literal('CONVERSION_SUBMISSION_V1'),
  contextSharingSupported: z.literal(true),
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
    const validOwner = z.string().trim().email().max(254).safeParse(config.commercialOwner);
    const destinations: ConversionDestination[] = validOwner.success ? config.destinations.flatMap((candidate): ConversionDestination[] => {
      const external = externalDestinationSchema.safeParse(candidate);
      if (external.success) {
        const destination = external.data;
        if (destination.status !== 'VERIFIED_ACTIVE' || !destination.href) return [];
        const approved = config.approvedExternalDestinations.some(
          (entry) => entry.type === destination.type && entry.href === destination.href,
        );
        if (!approved) return [];
        return destination.type === 'DEMO'
          ? [{ type: 'DEMO', status: destination.status, destinationKind: destination.destinationKind,
            href: destination.href, contextSharingSupported: false, ...CONVERSION_COPY.DEMO }]
          : [{ type: 'EARLY_ACCESS', status: destination.status, destinationKind: destination.destinationKind,
            href: destination.href, contextSharingSupported: false, ...CONVERSION_COPY.EARLY_ACCESS }];
      }
      const firstParty = firstPartyDestinationSchema.safeParse(candidate);
      if (!firstParty.success || firstParty.data.status !== 'VERIFIED_ACTIVE') return [];
      const { type, status, destinationKind, contextSharingSupported } = firstParty.data;
      return type === 'DEMO'
        ? [{ type, status, destinationKind, contextSharingSupported,
          label: CONVERSION_COPY.DEMO.label,
          availabilityDisclosure: 'Envía una solicitud de contacto para una posible demostración. No reserva una cita.' }]
        : [{ type, status, destinationKind, contextSharingSupported,
          label: CONVERSION_COPY.EARLY_ACCESS.label,
          availabilityDisclosure: 'Envía una solicitud de interés en acceso anticipado. No garantiza acceso.' }];
    }) : [];
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

