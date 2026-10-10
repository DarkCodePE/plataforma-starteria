import { z } from 'zod';

const versionsSchema = z.object({
  pathSchemaVersion: z.literal('starteria-path-dto-v0.1'),
  projectionVersion: z.literal('starteria-path-projection-v0.1'),
  businessCapabilityBoundaryVersion: z.literal('business-capability-boundary-v0.1'),
}).strict();

const sourceBindingSchema = z.object({
  criticalHandoffId: z.string().min(1),
  criticalHandoffVersion: z.number().int().min(1),
  sourceContextRevision: z.number().int().min(0),
  current: z.literal(true),
  confirmed: z.literal(true),
  projectionVersion: z.literal('starteria-path-projection-v0.1'),
  businessCapabilityBoundaryVersion: z.literal('business-capability-boundary-v0.1'),
  pathSchemaVersion: z.literal('starteria-path-dto-v0.1'),
}).strict();

const firstMovementSchema = z.object({
  movement: z.string(),
  whyNow: z.string(),
  whatItMayClarify: z.string(),
  boundary: z.string(),
}).strict();

const valueBridgeSchema = z.object({
  currentState: z.string(),
  starteriaContribution: z.array(z.object({
    statement: z.string(),
    capabilityClass: z.enum(['CAN_DO', 'CAN_SUPPORT']),
    availabilityState: z.literal('REQUIRES_IMPLEMENTATION'),
  }).strict()),
  tangibleOutcome: z.object({
    statement: z.string(),
    observableArtifact: z.string(),
  }).strict(),
  remainingDependency: z.array(z.object({
    statement: z.string(),
    dependencyType: z.string(),
  }).strict()),
}).strict();

const capabilityPathSchema = z.array(z.object({
  capabilityType: z.string(),
  statement: z.string(),
  whyRelevant: z.string(),
}).strict());

const dependenciesSchema = z.array(z.object({
  dependencyType: z.string(),
  statement: z.string(),
  whyItMatters: z.string(),
}).strict());

const supportedDtoSchema = z.object({
  experienceState: z.enum(['SUPPORTED', 'BOUNDED']),
  starteriaPathStatus: z.enum(['SUPPORTED', 'BOUNDED']),
  valueBridge: valueBridgeSchema,
  capabilityPath: capabilityPathSchema,
  dependencies: dependenciesSchema,
  firstSupportedMovement: firstMovementSchema.nullable(),
  boundaryStatement: z.string(),
  sourceBinding: sourceBindingSchema,
  versions: versionsSchema,
}).strict();

const unavailableDtoSchema = z.object({
  experienceState: z.enum([
    'STALE',
    'UNAVAILABLE_UNCONFIRMED',
    'UNAVAILABLE_INSUFFICIENT_BASIS',
    'UNAVAILABLE_INVALID',
  ]),
  boundaryStatement: z.string(),
  sourceBinding: sourceBindingSchema.optional(),
  versions: versionsSchema,
}).strict();

export const starteriaPathDtoSchema = z.union([supportedDtoSchema, unavailableDtoSchema]);

export type StarteriaPathSupportedDto = z.infer<typeof supportedDtoSchema>;
export type StarteriaPathUnavailableDto = z.infer<typeof unavailableDtoSchema>;
export type StarteriaPathDto = z.infer<typeof starteriaPathDtoSchema>;

export function parseStarteriaPathDto(value: unknown): StarteriaPathDto | null {
  const result = starteriaPathDtoSchema.safeParse(value);
  return result.success ? result.data : null;
}

export class StarteriaPathInvalidResponseError extends Error {
  constructor() {
    super('Starteria Path response was invalid.');
    this.name = 'StarteriaPathInvalidResponseError';
  }
}
