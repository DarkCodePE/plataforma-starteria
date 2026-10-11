// Server-owned product facts. A configuration change requires product verification
// of the receiving flow, interaction, audience and disclosure, plus a version bump.
// No destination has been operationally verified in the governed baseline.
// Do not inherit VITE_DEMO_BOOKING_URL or reuse PilotLead as Early Access.
export type ConversionConfigFacts = Readonly<{
  version: number;
  commercialOwner?: string;
  approvedExternalDestinations: readonly Readonly<{ type: 'DEMO' | 'EARLY_ACCESS'; href: string }>[];
  destinations: readonly Readonly<({
    type: 'DEMO' | 'EARLY_ACCESS';
    status: 'UNVERIFIED' | 'DISABLED' | 'VERIFIED_ACTIVE';
    destinationKind: 'EXTERNAL';
    href?: string;
    contextSharingSupported: false;
  } | {
    type: 'DEMO' | 'EARLY_ACCESS';
    status: 'UNVERIFIED' | 'DISABLED' | 'VERIFIED_ACTIVE';
    destinationKind: 'FIRST_PARTY';
    receiver: 'CONVERSION_SUBMISSION_V1';
    contextSharingSupported: true;
  })>[];
}>;

export const starteriaPathConversionConfig: ConversionConfigFacts = Object.freeze({
  version: 1,
  commercialOwner: process.env.STARTERIA_COMMERCIAL_OWNER?.trim() || undefined,
  approvedExternalDestinations: Object.freeze([]),
  destinations: Object.freeze([]),
});

