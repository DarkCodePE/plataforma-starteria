import type { ZodSchema } from 'zod/v3';

export type CapabilityDefinition<Input = unknown, Output = unknown> = {
  id: string;
  version: number;
  ownerPrd: string;
  supportedIntents: string[];
  operation: string;
  requiredInputs: string[];
  optionalInputs: string[];
  requiredPermissions: string[];
  requiresConfirmation: boolean;
  commandType?: string;
  inputSchema: ZodSchema<Input>;
  outputSchema?: ZodSchema<Output>;
  resultProjection: string[];
};

export type CapabilityValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: 'INVALID_CAPABILITY_PAYLOAD'; message: string; details: unknown } };
