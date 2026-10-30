import { z } from 'zod/v3';

export type CopilotRuntimeConfig = {
  enabled: boolean;
  writeEnabled: boolean;
  createStrategicFrontEnabled: boolean;
  allowedOrganizationIds: string[];
  assessmentAdapter: 'deterministic' | 'unavailable';
  executionStaleAfterSeconds: number;
  reconciliationEnabled: boolean;
  reconciliationIntervalSeconds: number;
  rateLimitMessage: number;
  rateLimitExecution: number;
  maxMessageLength: number;
  maxPayloadBytes: number;
};

const booleanEnv = z.string().optional().transform((value) => value === 'true');
const positiveIntEnv = (defaultValue: number) =>
  z.string()
    .optional()
    .transform((value) => {
      if (!value) return defaultValue;
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
    });

const adapterSchema = z
  .enum(['deterministic'])
  .optional()
  .transform((value) => value ?? 'unavailable');

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getCopilotRuntimeConfig(env: NodeJS.ProcessEnv = process.env): CopilotRuntimeConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const parsed = z.object({
    COPILOT_ENABLED: booleanEnv,
    COPILOT_WRITE_ENABLED: booleanEnv,
    COPILOT_CREATE_STRATEGIC_FRONT_ENABLED: booleanEnv,
    COPILOT_ASSESSMENT_ADAPTER: adapterSchema,
    COPILOT_EXECUTION_STALE_AFTER_SECONDS: positiveIntEnv(15 * 60),
    COPILOT_RECONCILIATION_ENABLED: booleanEnv,
    COPILOT_RECONCILIATION_INTERVAL_SECONDS: positiveIntEnv(60),
    COPILOT_RATE_LIMIT_MESSAGE: positiveIntEnv(30),
    COPILOT_RATE_LIMIT_EXECUTION: positiveIntEnv(10),
    COPILOT_MAX_MESSAGE_LENGTH: positiveIntEnv(20_000),
    COPILOT_MAX_PAYLOAD_BYTES: positiveIntEnv(12_000),
  }).parse(env);

  const testDefaultsEnabled = nodeEnv === 'test';
  const enabled = parsed.COPILOT_ENABLED || testDefaultsEnabled;
  const writeEnabled = enabled && (parsed.COPILOT_WRITE_ENABLED || testDefaultsEnabled);
  const createStrategicFrontEnabled = writeEnabled && (parsed.COPILOT_CREATE_STRATEGIC_FRONT_ENABLED || testDefaultsEnabled);
  const allowedOrganizationIds = parseCsv(env.COPILOT_ALLOWED_ORGANIZATION_IDS);
  const productionDeterministic = nodeEnv === 'production' && parsed.COPILOT_ASSESSMENT_ADAPTER === 'deterministic';

  return {
    enabled,
    writeEnabled,
    createStrategicFrontEnabled: productionDeterministic ? false : createStrategicFrontEnabled,
    allowedOrganizationIds,
    assessmentAdapter: productionDeterministic ? 'unavailable' : parsed.COPILOT_ASSESSMENT_ADAPTER,
    executionStaleAfterSeconds: parsed.COPILOT_EXECUTION_STALE_AFTER_SECONDS,
    reconciliationEnabled: parsed.COPILOT_RECONCILIATION_ENABLED || testDefaultsEnabled,
    reconciliationIntervalSeconds: parsed.COPILOT_RECONCILIATION_INTERVAL_SECONDS,
    rateLimitMessage: parsed.COPILOT_RATE_LIMIT_MESSAGE,
    rateLimitExecution: parsed.COPILOT_RATE_LIMIT_EXECUTION,
    maxMessageLength: parsed.COPILOT_MAX_MESSAGE_LENGTH,
    maxPayloadBytes: parsed.COPILOT_MAX_PAYLOAD_BYTES,
  };
}

export function isOrganizationAllowed(config: CopilotRuntimeConfig, organizationId: string): boolean {
  if (config.allowedOrganizationIds.length === 0) {
    return process.env.NODE_ENV !== 'production';
  }
  return config.allowedOrganizationIds.includes(organizationId);
}
