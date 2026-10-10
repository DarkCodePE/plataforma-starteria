export const STARTERIA_PATH_SCHEMA_VERSION = 'starteria-path-v0.1' as const;
export const STARTERIA_PATH_PROJECTION_VERSION = 'starteria-path-projection-v0.1' as const;
export const BUSINESS_CAPABILITY_BOUNDARY_VERSION = 'business-capability-boundary-v0.1' as const;

export type StarteriaPathStatus =
  | 'supported'
  | 'bounded'
  | 'unavailable_insufficient_basis'
  | 'unavailable_invalid';

export type CriticalHandoffConclusionStatus = 'supported' | 'bounded' | 'insufficient_basis';

export type ConfirmedCurrentCriticalHandoffUsableNow = Readonly<{
  item: string;
  howItCanHelp: string;
}>;

export type ConfirmedCurrentCriticalHandoffDecisionChangingUnknown = Readonly<{
  uncertainty: string;
  whyItMatters: string;
}>;

export type ConfirmedCurrentCriticalHandoffFirstMovement = Readonly<{
  movement: string;
  whyNow: string;
  whatItMayClarify: string;
  boundary: string;
}>;

/**
 * A narrow 114D input. It intentionally contains no session, legacy handoff,
 * reasoning, provenance, provider, or conversation fields.
 */
export type ConfirmedCurrentCriticalHandoffInput = Readonly<{
  artifactId: string;
  artifactVersion: number;
  sourceContextRevision: number;
  conclusionStatus: CriticalHandoffConclusionStatus;
  finalReading: string | null;
  decisionInView: string | null;
  usableNow: readonly ConfirmedCurrentCriticalHandoffUsableNow[];
  decisionChangingUnknowns: readonly ConfirmedCurrentCriticalHandoffDecisionChangingUnknown[];
  firstMovement?: ConfirmedCurrentCriticalHandoffFirstMovement | null;
}>;

export type StarteriaPathVersions = Readonly<{
  schemaVersion: typeof STARTERIA_PATH_SCHEMA_VERSION;
  projectionVersion: typeof STARTERIA_PATH_PROJECTION_VERSION;
  businessCapabilityBoundaryVersion: typeof BUSINESS_CAPABILITY_BOUNDARY_VERSION;
}>;

export type StarteriaPathSourceBasis =
  | 'FINAL_READING'
  | 'DECISION_IN_VIEW'
  | 'USABLE_NOW'
  | 'DECISION_CHANGING_UNKNOWN'
  | 'FIRST_MOVEMENT';

export type BusinessCapabilityClass =
  | 'CAN_DO'
  | 'CAN_SUPPORT'
  | 'REQUIRES_ORGANIZATIONAL_INPUT'
  | 'REQUIRES_EXTERNAL_EVIDENCE'
  | 'CANNOT_PROMISE';

export type PositiveStarteriaCapabilityClass = 'CAN_DO' | 'CAN_SUPPORT';

// This is the current 114E semantic/product surface availability, not business reasoning.
// A 125B API alone cannot promote it to CURRENTLY_EVIDENCED; promotion requires
// verified 114E surface evidence and an explicitly versioned semantic change.
export type StarteriaCapabilityAvailabilityState = 'REQUIRES_IMPLEMENTATION';

export type StarteriaPathCapabilityType =
  | 'STRUCTURE'
  | 'MAKE_VISIBLE'
  | 'SYSTEMATIZE'
  | 'GUIDE_OR_TRACK_UNCERTAINTY'
  | 'PREPARE_DECISION'
  | 'SUPPORTED_FIRST_MOVEMENT';

export type StarteriaPathCapabilityNode = Readonly<{
  capabilityType: StarteriaPathCapabilityType;
  contextualStatement: string;
  whyItMattersHere: string;
  sourceBasis: StarteriaPathSourceBasis;
  capabilityClass: PositiveStarteriaCapabilityClass;
  availabilityState: StarteriaCapabilityAvailabilityState;
}>;

export type StarteriaPathDependencyCategory =
  | 'STARTERIA_CAN_HELP_STRUCTURE'
  | 'REQUIRES_ORGANIZATIONAL_INPUT'
  | 'REQUIRES_EXTERNAL_EVIDENCE';

/** A visible 114D unknown whose dependency category is not established by its source. */
export type StarteriaPathRemainingDependency = Readonly<{
  statement: string;
  whyItMatters: string;
  sourceBasis: 'DECISION_CHANGING_UNKNOWN';
}>;

export type StarteriaPathDependency = Readonly<{
  statement: string;
  whyItMatters: string;
  category: StarteriaPathDependencyCategory;
  sourceBasis: 'DECISION_CHANGING_UNKNOWN';
}>;

export type StarteriaPathFirstSupportedMovement = Readonly<{
  movement: string;
  whyNow: string;
  whatItMayClarify: string;
  boundary: string;
}>;

export type StarteriaPathContribution = Readonly<{
  statement: string;
  capabilityClass: PositiveStarteriaCapabilityClass;
  availabilityState: StarteriaCapabilityAvailabilityState;
}>;

export type StarteriaPathTangibleOutcome = Readonly<{
  statement: string;
  observableArtifact: string;
  capabilityClass: 'CAN_DO';
  availabilityState: StarteriaCapabilityAvailabilityState;
}>;

export type StarteriaPathValueBridge = Readonly<{
  currentState: string;
  starteriaContribution: readonly StarteriaPathContribution[];
  tangibleOutcome: StarteriaPathTangibleOutcome;
  remainingDependencies: readonly StarteriaPathRemainingDependency[];
  immediateNextAction: StarteriaPathFirstSupportedMovement | null;
}>;

export type StarteriaPathSourceBinding = Readonly<{
  artifactId: string;
  artifactVersion: number;
  sourceContextRevision: number;
}>;

export type StarteriaPathProjectionVersions = StarteriaPathVersions;

export type StarteriaPathAvailableProjection = Readonly<{
  pathStatus: 'supported' | 'bounded';
  valueBridge: StarteriaPathValueBridge;
  capabilityPath: readonly StarteriaPathCapabilityNode[];
  dependencies: readonly StarteriaPathDependency[];
  firstSupportedMovement: StarteriaPathFirstSupportedMovement | null;
  boundaryStatement: string;
  sourceBinding: StarteriaPathSourceBinding;
  versions: StarteriaPathVersions;
}>;

export type StarteriaPathUnavailableProjection = Readonly<{
  pathStatus: 'unavailable_insufficient_basis' | 'unavailable_invalid';
  boundaryStatement: string;
  sourceBinding: StarteriaPathSourceBinding | null;
  versions: StarteriaPathVersions;
}>;

export type StarteriaPathProjection =
  | StarteriaPathAvailableProjection
  | StarteriaPathUnavailableProjection;
