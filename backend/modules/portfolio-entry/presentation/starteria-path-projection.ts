import { z } from 'zod';
import {
  BUSINESS_CAPABILITY_BOUNDARY_VERSION,
  STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION,
  type ConfirmedCurrentCriticalHandoffInput,
  type StarteriaPathCapabilityNode,
  type StarteriaPathCapabilityType,
  type StarteriaPathContribution,
  type StarteriaPathDependency,
  type StarteriaPathFirstSupportedMovement,
  type StarteriaPathProjection,
  type StarteriaPathRemainingDependency,
  type StarteriaPathSourceBinding,
  type StarteriaPathVersions,
} from '../domain/starteria-path.types';

export {
  BUSINESS_CAPABILITY_BOUNDARY_VERSION,
  STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION,
} from '../domain/starteria-path.types';
export type {
  ConfirmedCurrentCriticalHandoffInput,
  StarteriaPathProjection,
  StarteriaPathVersions,
} from '../domain/starteria-path.types';

const CURRENT_VERSIONS: StarteriaPathVersions = {
  schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
  projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
  businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
};

const pathVersionsSchema = z.object({
  schemaVersion: z.literal(STARTERIA_PATH_SCHEMA_VERSION),
  projectionVersion: z.literal(STARTERIA_PATH_PROJECTION_VERSION),
  businessCapabilityBoundaryVersion: z.literal(BUSINESS_CAPABILITY_BOUNDARY_VERSION),
}).strict();

const nonBlankSourceText = z.string().refine((value) => value.trim().length > 0);

const firstMovementSchema = z.object({
  movement: nonBlankSourceText,
  whyNow: nonBlankSourceText,
  whatItMayClarify: nonBlankSourceText,
  boundary: nonBlankSourceText,
}).strict();

const confirmedCurrentCriticalHandoffSchema = z.object({
  artifactId: z.string().min(1).max(128).refine((value) => value.trim().length > 0),
  artifactVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  sourceContextRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  conclusionStatus: z.enum(['supported', 'bounded', 'insufficient_basis']),
  finalReading: nonBlankSourceText.nullable(),
  decisionInView: nonBlankSourceText.nullable(),
  usableNow: z.array(z.object({
    item: nonBlankSourceText,
    howItCanHelp: nonBlankSourceText,
  }).strict()),
  decisionChangingUnknowns: z.array(z.object({
    uncertainty: nonBlankSourceText,
    whyItMatters: nonBlankSourceText,
  }).strict()),
  firstMovement: firstMovementSchema.nullable().optional(),
}).strict().superRefine((input, context) => {
  const firstMovement = input.firstMovement ?? null;
  if (input.conclusionStatus === 'insufficient_basis') {
    if (input.finalReading !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['finalReading'],
        message: 'Insufficient basis cannot contain a final reading.',
      });
    }
    if (firstMovement !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['firstMovement'],
        message: 'Insufficient basis cannot contain a first movement.',
      });
    }
  } else if (input.finalReading === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['finalReading'],
      message: 'Supported conclusions require a final reading.',
    });
  }
});

const BOUNDARY_STATEMENT =
  'This projection prepares a view for human decision support; it does not make the decision or establish external evidence.';
const INSUFFICIENT_BOUNDARY_STATEMENT =
  'The confirmed reading does not provide enough basis for a contextual Path.';
const INVALID_BOUNDARY_STATEMENT =
  'No Path is projected from an invalid Critical Handoff input.';
// Availability describes the current 114E surface only; it is not business reasoning.
// Exposing an API in 125B does not prove that surface exists. Promotion requires
// verified 114E surface evidence and an explicitly versioned semantic change.
const CAPABILITY_AVAILABILITY = 'REQUIRES_IMPLEMENTATION' as const;

const contributionCopy: Readonly<Record<StarteriaPathCapabilityType, Readonly<{
  statement: string;
  capabilityClass: 'CAN_DO' | 'CAN_SUPPORT';
}>>> = {
  MAKE_VISIBLE: {
    statement: 'Make supplied information visible.',
    capabilityClass: 'CAN_DO',
  },
  STRUCTURE: {
    statement: 'Structure supplied information for inspection.',
    capabilityClass: 'CAN_DO',
  },
  SYSTEMATIZE: {
    statement: 'Systematize supplied information.',
    capabilityClass: 'CAN_DO',
  },
  GUIDE_OR_TRACK_UNCERTAINTY: {
    statement: 'Help keep decision-changing uncertainty in view.',
    capabilityClass: 'CAN_SUPPORT',
  },
  PREPARE_DECISION: {
    statement: 'Help prepare the stated decision for human review.',
    capabilityClass: 'CAN_SUPPORT',
  },
  SUPPORTED_FIRST_MOVEMENT: {
    statement: 'Present the supported movement for consideration.',
    capabilityClass: 'CAN_SUPPORT',
  },
};

function sourceBinding(input: ConfirmedCurrentCriticalHandoffInput): StarteriaPathSourceBinding {
  return {
    artifactId: input.artifactId,
    artifactVersion: input.artifactVersion,
    sourceContextRevision: input.sourceContextRevision,
  };
}

function unavailable(
  pathStatus: 'unavailable_insufficient_basis' | 'unavailable_invalid',
  boundaryStatement: string,
  versions: StarteriaPathVersions = CURRENT_VERSIONS,
  binding: StarteriaPathSourceBinding | null = null,
): StarteriaPathProjection {
  return {
    pathStatus,
    boundaryStatement,
    sourceBinding: binding,
    versions: { ...versions },
  };
}

function addCapability(
  nodes: StarteriaPathCapabilityNode[],
  capabilityType: StarteriaPathCapabilityType,
  contextualStatement: string,
  whyItMattersHere: string,
  sourceBasis: StarteriaPathCapabilityNode['sourceBasis'],
): void {
  nodes.push({
    capabilityType,
    contextualStatement,
    whyItMattersHere,
    sourceBasis,
    capabilityClass: contributionCopy[capabilityType].capabilityClass,
    availabilityState: CAPABILITY_AVAILABILITY,
  });
}

function firstSupportedMovement(
  input: ConfirmedCurrentCriticalHandoffInput,
): StarteriaPathFirstSupportedMovement | null {
  if (input.firstMovement == null) return null;
  return {
    movement: input.firstMovement.movement,
    whyNow: input.firstMovement.whyNow,
    whatItMayClarify: input.firstMovement.whatItMayClarify,
    boundary: input.firstMovement.boundary,
  };
}

function buildCapabilityPath(
  input: ConfirmedCurrentCriticalHandoffInput,
): StarteriaPathCapabilityNode[] {
  const nodes: StarteriaPathCapabilityNode[] = [];

  for (const usable of input.usableNow) {
    addCapability(nodes, 'MAKE_VISIBLE', usable.item, usable.howItCanHelp, 'USABLE_NOW');
    addCapability(nodes, 'STRUCTURE', usable.item, usable.howItCanHelp, 'USABLE_NOW');
  }

  if (input.decisionInView !== null) {
    addCapability(
      nodes,
      'PREPARE_DECISION',
      input.decisionInView,
      'Keeps this stated decision in view without making it.',
      'DECISION_IN_VIEW',
    );
  }

  for (const unknown of input.decisionChangingUnknowns) {
    addCapability(
      nodes,
      'GUIDE_OR_TRACK_UNCERTAINTY',
      unknown.uncertainty,
      unknown.whyItMatters,
      'DECISION_CHANGING_UNKNOWN',
    );
  }

  const movement = firstSupportedMovement(input);
  if (movement !== null) {
    addCapability(
      nodes,
      'SUPPORTED_FIRST_MOVEMENT',
      movement.movement,
      movement.whyNow,
      'FIRST_MOVEMENT',
    );
  }

  return nodes;
}

function buildDependencies(
  input: ConfirmedCurrentCriticalHandoffInput,
): StarteriaPathDependency[] {
  // This 114D input has no explicit dependency classification. An unknown alone
  // does not prove organizational input, external evidence, or Starteria structure.
  // Keep generic unknowns visible in valueBridge without adding them to dependencies.
  void input;
  return [];
}

function buildRemainingDependencies(
  input: ConfirmedCurrentCriticalHandoffInput,
): StarteriaPathRemainingDependency[] {
  return input.decisionChangingUnknowns.map((unknown) => ({
    statement: unknown.uncertainty,
    whyItMatters: unknown.whyItMatters,
    sourceBasis: 'DECISION_CHANGING_UNKNOWN',
  }));
}

function buildContributions(
  capabilityPath: readonly StarteriaPathCapabilityNode[],
): StarteriaPathContribution[] {
  const included = new Set<StarteriaPathCapabilityType>();
  const contributions: StarteriaPathContribution[] = [];
  for (const node of capabilityPath) {
    if (included.has(node.capabilityType)) continue;
    included.add(node.capabilityType);
    contributions.push({
      statement: contributionCopy[node.capabilityType].statement,
      capabilityClass: contributionCopy[node.capabilityType].capabilityClass,
      availabilityState: CAPABILITY_AVAILABILITY,
    });
  }
  return contributions;
}

function buildTangibleOutcome(
  input: ConfirmedCurrentCriticalHandoffInput,
): Readonly<{
  statement: string;
  observableArtifact: string;
  capabilityClass: 'CAN_DO';
  availabilityState: typeof CAPABILITY_AVAILABILITY;
}> {
  const visibleParts = ['the confirmed reading'];
  if (input.decisionInView !== null) visibleParts.push('the decision in view');
  if (input.usableNow.length > 0) visibleParts.push('the available information');
  if (input.decisionChangingUnknowns.length > 0) visibleParts.push('the decision-changing unknowns');
  if (input.firstMovement != null) visibleParts.push('the supported first movement');

  return {
    statement: 'An inspectable view of ' + visibleParts.join(', ') + '.',
    observableArtifact: 'A source-bound decision-support view.',
    capabilityClass: 'CAN_DO',
    availabilityState: CAPABILITY_AVAILABILITY,
  };
}

/**
 * Pure allowlisted projection from the dedicated current, confirmed 114D type.
 * Invalid input fails closed as an unavailable result with no Path fields.
 */
export function projectStarteriaPath(
  input: ConfirmedCurrentCriticalHandoffInput,
  versions: StarteriaPathVersions,
): StarteriaPathProjection {
  const parsedVersions = pathVersionsSchema.safeParse(versions);
  if (!parsedVersions.success) {
    return unavailable('unavailable_invalid', INVALID_BOUNDARY_STATEMENT);
  }

  const acceptedVersions = parsedVersions.data as StarteriaPathVersions;

  const parsedInput = confirmedCurrentCriticalHandoffSchema.safeParse(input);
  if (!parsedInput.success) {
    return unavailable('unavailable_invalid', INVALID_BOUNDARY_STATEMENT, acceptedVersions);
  }

  const source = parsedInput.data as ConfirmedCurrentCriticalHandoffInput;
  const binding = sourceBinding(source);
  if (source.conclusionStatus === 'insufficient_basis') {
    return unavailable(
      'unavailable_insufficient_basis',
      INSUFFICIENT_BOUNDARY_STATEMENT,
      acceptedVersions,
      binding,
    );
  }

  if (source.finalReading === null) {
    return unavailable('unavailable_invalid', INVALID_BOUNDARY_STATEMENT, acceptedVersions);
  }

  const capabilityPath = buildCapabilityPath(source);
  const dependencies = buildDependencies(source);
  const movement = firstSupportedMovement(source);
  const contributions = buildContributions(capabilityPath);

  return {
    pathStatus: source.conclusionStatus,
    valueBridge: {
      currentState: source.finalReading,
      starteriaContribution: contributions,
      tangibleOutcome: buildTangibleOutcome(source),
      remainingDependencies: buildRemainingDependencies(source),
      immediateNextAction: movement,
    },
    capabilityPath,
    dependencies,
    firstSupportedMovement: movement,
    boundaryStatement: BOUNDARY_STATEMENT,
    sourceBinding: binding,
    versions: { ...acceptedVersions },
  };
}
