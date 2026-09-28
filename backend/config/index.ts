import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: false });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET ?? '';
const databaseUrl = process.env.DATABASE_URL ?? '';
const portfolioEntryRuntimeMode = process.env.PORTFOLIO_ENTRY_RUNTIME_MODE || 'live';
if (portfolioEntryRuntimeMode !== 'live' && portfolioEntryRuntimeMode !== 'deterministic') {
  throw new Error('PORTFOLIO_ENTRY_RUNTIME_MODE must be live or deterministic');
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

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl,
  jwtSecret: jwtSecret || 'dev-insecure-fallback-do-not-use-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
  // TODO(ADR-011): Replace shared-secret with HMAC-SHA256 signing + timestamp + replay protection per TASK-007 full spec.
  // V1 bridge auth: simple shared secret exchanged via X-Internal-Token header.
  bridgeSharedSecret: process.env.BRIDGE_SHARED_SECRET || 'dev-bridge-secret-do-not-use-in-prod',
  // TASK-006: alias used by the initiative-pdfs module for the ai-service hand-off
  // (the AI client sends this in `X-Internal-Token` until TASK-007 swaps to HMAC).
  aiServiceToken: process.env.AI_SERVICE_TOKEN || process.env.BRIDGE_SHARED_SECRET || 'dev-shared-secret-change-me',
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
  billingWebhookSecret:
    process.env.BILLING_WEBHOOK_SECRET || process.env.BRIDGE_SHARED_SECRET || 'dev-billing-secret-do-not-use-in-prod',
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
  handoffInvitationBaseUrl: process.env.HANDOFF_INVITATION_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
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
  portfolioEntryRuntimeMode,
} as const;
