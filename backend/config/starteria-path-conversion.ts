// Server-owned product facts. A configuration change requires product verification
// of the receiving flow, interaction, audience and disclosure, plus a version bump.
// No destination has been operationally verified in the governed baseline.
// Do not inherit VITE_DEMO_BOOKING_URL or reuse PilotLead as Early Access.
export type ConversionConfigFacts = Readonly<{
  version: number;
  approvedExternalDestinations: readonly Readonly<{ type: 'DEMO' | 'EARLY_ACCESS'; href: string }>[];
  destinations: readonly Readonly<{
    type: 'DEMO' | 'EARLY_ACCESS';
    status: 'UNVERIFIED' | 'DISABLED' | 'VERIFIED_ACTIVE';
    destinationKind: 'EXTERNAL';
    href?: string;
    contextSharingSupported: false;
  }>[];
}>;

export const starteriaPathConversionConfig: ConversionConfigFacts = Object.freeze({
  version: 1,
  approvedExternalDestinations: Object.freeze([]),
  destinations: Object.freeze([]),
});

