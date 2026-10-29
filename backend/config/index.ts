import path from 'path';
import dotenv from 'dotenv';
import { starteriaPathConversionConfig } from './starteria-path-conversion';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: false });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET ?? '';
const databaseUrl = process.env.DATABASE_URL ?? '';
const portfolioEntryRuntimeMode = process.env.PORTFOLIO_ENTRY_RUNTIME_MODE || 'live';
if (portfolioEntryRuntimeMode !== 'live' && portfolioEntryRuntimeMode !== 'deterministic') {
  throw new Error('PORTFOLIO_ENTRY_RUNTIME_MODE must be live or deterministic');
}
// ADR-032: quién clasifica entry_state e intent en Portfolio Entry. `llm` deja todo como antes.
const portfolioEntryClassifier = process.env.PORTFOLIO_ENTRY_CLASSIFIER || 'llm';
if (portfolioEntryClassifier !== 'llm' && portfolioEntryClassifier !== 'jev') {
  throw new Error('PORTFOLIO_ENTRY_CLASSIFIER must be llm or jev');
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function nonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function commaSeparatedEnv(name: string): string[] {
  return (process.env[name] || '').split(',').map((value) => value.trim()).filter(Boolean);
}

function booleanEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function durationMsEnv(name: string, fallback: string): number {
  const raw = process.env[name] || fallback;
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(raw.trim());
  if (!match) throw new Error(`${name} must use ms, s, m, h or d units`);
  const factor = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  const result = Number(match[1]) * factor;
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error(`${name} must be a positive duration`);
  return result;
}

function productionSecret(name: string, value: string): void {
  if (nodeEnv !== 'production') return;
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  const hasMinimumDiversity = new Set(trimmed).size >= 8;
  if (trimmed.length < 32 || !hasMinimumDiversity || ['change-me', 'do-not-use', 'replace_with', 'whatever'].some((marker) => normalized.includes(marker))) {
    throw new Error(`${name} must be a non-placeholder, non-repetitive secret of at least 32 characters in production`);
  }
}

const handoffEmailTransportMode = process.env.HANDOFF_EMAIL_TRANSPORT_MODE || 'disabled';
if (!['disabled', 'sandbox', 'pilot'].includes(handoffEmailTransportMode)) {
  throw new Error('HANDOFF_EMAIL_TRANSPORT_MODE must be disabled, sandbox or pilot');
}

if (!jwtSecret) {
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[config] JWT_SECRET not set — using insecure fallback (development only)');
}

if (!databaseUrl) {
  if (nodeEnv === 'production') {
    throw new Error('DATABASE_URL is required in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[config] DATABASE_URL not set');
}

const bridgeSharedSecret = process.env.BRIDGE_SHARED_SECRET ?? '';
const aiServiceToken = process.env.AI_SERVICE_TOKEN ?? '';
const billingWebhookSecret = process.env.BILLING_WEBHOOK_SECRET ?? '';
const pilotCodeSecret = process.env.PILOT_CODE_SECRET ?? (nodeEnv === 'production' ? '' : 'dev-insecure-pilot-code-secret-do-not-use');
productionSecret('JWT_SECRET', jwtSecret);
productionSecret('BRIDGE_SHARED_SECRET', bridgeSharedSecret);
productionSecret('AI_SERVICE_TOKEN', aiServiceToken);
productionSecret('BILLING_WEBHOOK_SECRET', billingWebhookSecret);
productionSecret('PILOT_CODE_SECRET', pilotCodeSecret);

if (nodeEnv === 'production' && new Set([jwtSecret, bridgeSharedSecret, aiServiceToken, billingWebhookSecret, pilotCodeSecret]).size !== 5) {
  throw new Error('Production secrets must be independent values');
}

const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '8h';
const jwtRefreshTtlMs = durationMsEnv('JWT_REFRESH_EXPIRES_IN', '8h');
const handoffInvitationMinTtlHours = positiveIntegerEnv('HANDOFF_INVITATION_MIN_TTL_HOURS', 1);
const handoffInvitationMaxTtlHours = positiveIntegerEnv('HANDOFF_INVITATION_MAX_TTL_HOURS', 168);
const handoffInvitationTtlHours = positiveIntegerEnv('HANDOFF_INVITATION_TTL_HOURS', 24);
if (handoffInvitationMinTtlHours > handoffInvitationTtlHours || handoffInvitationTtlHours > handoffInvitationMaxTtlHours) {
  throw new Error('HANDOFF_INVITATION_TTL_HOURS must be within the configured min/max TTL');
}

export const config = {
  starteriaPathConversion: starteriaPathConversionConfig,
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl,
  jwtSecret: jwtSecret || 'dev-insecure-fallback-do-not-use-in-prod',
  pilotCodeSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn,
  jwtRefreshTtlMs,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
  // TODO(ADR-011): Replace shared-secret with HMAC-SHA256 signing + timestamp + replay protection per TASK-007 full spec.
  // V1 bridge auth: simple shared secret exchanged via X-Internal-Token header.
  bridgeSharedSecret: bridgeSharedSecret || 'dev-bridge-secret-do-not-use-in-prod',
  // TASK-006: alias used by the initiative-pdfs module for the ai-service hand-off
  // (the AI client sends this in `X-Internal-Token` until TASK-007 swaps to HMAC).
  aiServiceToken: aiServiceToken || 'dev-shared-secret-change-me',
  aiWebhooksEnabled: booleanEnv('AI_WEBHOOKS_ENABLED'),
  // TASK-006 / SPEC-002 V1: PDFs are persisted on the local filesystem under this directory.
  // TODO(ADR-007): swap LocalDiskPdfStorage for an S3PresignedStorage implementation.
  localStorageDir: process.env.LOCAL_STORAGE_DIR || './storage',
  // OAuth: GIS (Google Identity Services) audience. Backend uses google-auth-library
  // to verify ID tokens against this client id. Empty string = Google login disabled.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  // PRD-005 / ADR-020: entitlement enforcement flag. Default OFF → shadow mode
  // (usage is METERED but never BLOCKED), so we collect real usage distributions
  // before turning the paywall on. Set BILLING_ENFORCEMENT_ENABLED=true to enforce.
  billingEnforcementEnabled: process.env.BILLING_ENFORCEMENT_ENABLED === 'true',
  // ADR-021: shared secret for the internal billing webhook receiver
  // (POST /api/v1/internal/billing/webhooks/:provider). Same auth class as the
  // ai-service webhook (ADR-013). Per-provider signature verification layers on top.
  billingWebhookSecret: billingWebhookSecret || 'dev-billing-secret-do-not-use-in-prod',
  billingWebhooksEnabled: booleanEnv('BILLING_WEBHOOKS_ENABLED'),
  // SPEC-003 / issue #54: SMTP transport for the pilot-lead notification email.
  // No SMTP_HOST → mailer disabled (dev/test default): the notifier degrades to a
  // non-PII log line instead of sending.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.PILOT_LEAD_NOTIFY_FROM || '',
  },
  // Public invitation links are intentionally independent from browser CORS.
  // External pilot mode validates this as public HTTPS before creating a token.
  handoffInvitationBaseUrl: process.env.HANDOFF_INVITATION_PUBLIC_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  handoffEmail: {
    mode: handoffEmailTransportMode as 'disabled' | 'sandbox' | 'pilot',
    pilotEnabled: process.env.HANDOFF_EMAIL_PILOT_ENABLED === 'true',
    verifiedSender: process.env.HANDOFF_EMAIL_PILOT_VERIFIED_FROM || '',
    replyTo: process.env.HANDOFF_EMAIL_REPLY_TO || '',
    recipientAllowlist: commaSeparatedEnv('HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST'),
    organizationAllowlist: commaSeparatedEnv('HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST'),
    actorAllowlist: commaSeparatedEnv('HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST'),
    maxSendsPerWindow: positiveIntegerEnv('HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW', 2),
    windowSeconds: positiveIntegerEnv('HANDOFF_EMAIL_PILOT_WINDOW_SECONDS', 3600),
    minIntervalSeconds: nonNegativeIntegerEnv('HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS', 30),
    invitationTtlHours: handoffInvitationTtlHours,
    invitationMinTtlHours: handoffInvitationMinTtlHours,
    invitationMaxTtlHours: handoffInvitationMaxTtlHours,
    maxBatchSize: positiveIntegerEnv('HANDOFF_EMAIL_MAX_BATCH_SIZE', 25),
  },
  pilotLeadEmailEnabled: booleanEnv('PILOT_LEAD_EMAIL_ENABLED'),
  // Comma-separated recipient(s) notified when a new pilot lead is captured.
  pilotLeadNotifyTo: (process.env.PILOT_LEAD_NOTIFY_TO || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  // Phase 6E: public pre-canonical Portfolio Entry sessions. This is a product
  // TTL, distinct from the short TTLs used by persistence tests.
  portfolioEntrySessionTtlSeconds: positiveIntegerEnv('PORTFOLIO_ENTRY_SESSION_TTL_SECONDS', 86400),
  // Phase 6E: HTTP/application idempotency retention for costly public
  // Portfolio Entry operations. Kept separate from semantic session state.
  portfolioEntryIdempotencyTtlSeconds: positiveIntegerEnv('PORTFOLIO_ENTRY_IDEMPOTENCY_TTL_SECONDS', 86400),
  portfolioEntryCriticalHandoffMaxMs: positiveIntegerEnv('PORTFOLIO_ENTRY_CRITICAL_HANDOFF_MAX_MS', 180000),
  portfolioEntryRuntimeMode,
  portfolioEntryClassifier,
  trustProxyHops: nonNegativeIntegerEnv('TRUST_PROXY_HOPS', 0),
} as const;
