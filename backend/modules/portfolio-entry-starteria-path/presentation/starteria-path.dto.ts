import { z } from 'zod';
import {
  BUSINESS_CAPABILITY_BOUNDARY_VERSION,
  STARTERIA_PATH_PROJECTION_VERSION,
} from '../../portfolio-entry/domain/starteria-path.types';

export const STARTERIA_PATH_DTO_SCHEMA_VERSION = 'starteria-path-dto-v0.1' as const;

export const STARTERIA_PATH_PUBLIC_VERSIONS = {
  pathSchemaVersion: STARTERIA_PATH_DTO_SCHEMA_VERSION,
  projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
  businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
} as const;

const versionsSchema = z.object({
  pathSchemaVersion: z.literal(STARTERIA_PATH_DTO_SCHEMA_VERSION),
  projectionVersion: z.literal(STARTERIA_PATH_PROJECTION_VERSION),
  businessCapabilityBoundaryVersion: z.literal(BUSINESS_CAPABILITY_BOUNDARY_VERSION),
}).strict();

const sourceBindingSchema = z.object({
  criticalHandoffId: z.string().min(1),
  criticalHandoffVersion: z.number().int().min(1),
  sourceContextRevision: z.number().int().min(0),
  current: z.literal(true),
  confirmed: z.literal(true),
  projectionVersion: z.literal(STARTERIA_PATH_PROJECTION_VERSION),
  businessCapabilityBoundaryVersion: z.literal(BUSINESS_CAPABILITY_BOUNDARY_VERSION),
  pathSchemaVersion: z.literal(STARTERIA_PATH_DTO_SCHEMA_VERSION),
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

const starteriaPathDtoSchema = z.union([supportedDtoSchema, unavailableDtoSchema]);

export type StarteriaPathPublicVersions = z.infer<typeof versionsSchema>;
export type StarteriaPathSourceBindingDto = z.infer<typeof sourceBindingSchema>;
export type StarteriaPathSupportedDto = z.infer<typeof supportedDtoSchema>;
export type StarteriaPathUnavailableDto = z.infer<typeof unavailableDtoSchema>;
export type StarteriaPathDto = z.infer<typeof starteriaPathDtoSchema>;

export function parseStarteriaPathDto(value: unknown): StarteriaPathDto | null {
  const parsed = starteriaPathDtoSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
