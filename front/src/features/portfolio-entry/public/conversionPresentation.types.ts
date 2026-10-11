import { z } from 'zod';

// Transport validation only; commercial availability is normalized by the server.
const safeExternalHref = z.string().max(2048).refine((href) => {
  try {
    if (!/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9/_-]+$/.test(href)) return false;
    const url = new URL(href);
    return url.protocol === 'https:' && url.href === href
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && url.hostname.includes('.') && !/^[\d.]+$/.test(url.hostname)
      && !/(^|\.)(localhost|local|internal|invalid|test|example)$/.test(url.hostname)
      && !/(^|\.)example\.(com|org|net)$/.test(url.hostname);
  } catch { return false; }
});

export const CONVERSION_COPY = {
  DEMO: {
    label: 'Solicitar una demo',
    availabilityDisclosure: 'Abre un destino externo para solicitar una demo. Abrirlo no confirma una reserva ni concede acceso al producto.',
  },
  EARLY_ACCESS: {
    label: 'Solicitar acceso anticipado',
    availabilityDisclosure: 'Abre un destino externo para solicitar acceso anticipado limitado. La solicitud no garantiza acceso, admisión a un piloto, incorporación ni respuesta.',
  },
} as const;

const destinationFields = {
  status: z.literal('VERIFIED_ACTIVE'),
  destinationKind: z.literal('EXTERNAL'),
  href: safeExternalHref,
  contextSharingSupported: z.literal(false),
};
const demoExternal = z.object({
  ...destinationFields, type: z.literal('DEMO'),
  label: z.literal(CONVERSION_COPY.DEMO.label),
  availabilityDisclosure: z.literal(CONVERSION_COPY.DEMO.availabilityDisclosure),
}).strict();
const earlyAccessExternal = z.object({
  ...destinationFields, type: z.literal('EARLY_ACCESS'),
  label: z.literal(CONVERSION_COPY.EARLY_ACCESS.label),
  availabilityDisclosure: z.literal(CONVERSION_COPY.EARLY_ACCESS.availabilityDisclosure),
}).strict();
const firstPartyFields = {
  status: z.literal('VERIFIED_ACTIVE'),
  destinationKind: z.literal('FIRST_PARTY'),
  contextSharingSupported: z.literal(true),
};
const demoFirstParty = z.object({
  ...firstPartyFields, type: z.literal('DEMO'),
  label: z.literal(CONVERSION_COPY.DEMO.label),
  availabilityDisclosure: z.literal('Envía una solicitud de contacto para una posible demostración. No reserva una cita.'),
}).strict();
const earlyAccessFirstParty = z.object({
  ...firstPartyFields, type: z.literal('EARLY_ACCESS'),
  label: z.literal(CONVERSION_COPY.EARLY_ACCESS.label),
  availabilityDisclosure: z.literal('Envía una solicitud de interés en acceso anticipado. No garantiza acceso.'),
}).strict();
const demo = z.union([demoExternal, demoFirstParty]);
const earlyAccess = z.union([earlyAccessExternal, earlyAccessFirstParty]);
const verifiedVersion = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

// Tuples enforce exact state/action correspondence, uniqueness and bounded order.
// Order is stable, not commercial ranking: both actions are presented as peers.
export const conversionPresentationSchema = z.discriminatedUnion('availability', [
  z.object({
    availability: z.literal('NO_VERIFIED_DESTINATION'),
    conversionConfigVersion: verifiedVersion.nullable(),
    destinations: z.tuple([]).rest(z.never()),
  }).strict(),
  z.object({
    availability: z.literal('DEMO_ONLY'), conversionConfigVersion: verifiedVersion,
    destinations: z.tuple([demo]).rest(z.never()),
  }).strict(),
  z.object({
    availability: z.literal('EARLY_ACCESS_ONLY'), conversionConfigVersion: verifiedVersion,
    destinations: z.tuple([earlyAccess]).rest(z.never()),
  }).strict(),
  z.object({
    availability: z.literal('EARLY_ACCESS_AND_DEMO'), conversionConfigVersion: verifiedVersion,
    destinations: z.tuple([demo, earlyAccess]).rest(z.never()),
  }).strict(),
]);

export type ConversionPresentation = z.infer<typeof conversionPresentationSchema>;
export const conversionDestinationHrefSchema = safeExternalHref;

