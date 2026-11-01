import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({
  default: { config: () => ({ parsed: {} }) },
  config: () => ({ parsed: {} }),
}));

describe('production backend startup contract', () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...original,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://synthetic:synthetic@clone.invalid:5432/synthetic',
      JWT_SECRET: 'jwt-A7f9!qL2#sM4@vN6$xP8&zR0*bcD-2026',
      BRIDGE_SHARED_SECRET: 'bridge-B8g0@rM3#tN5$vP7%xQ9&za1*-2026',
      AI_SERVICE_TOKEN: 'ai-C9h1#sN4$vP6%xQ8&yR0*zb2@Lm7!Qx-2026',
      BILLING_WEBHOOK_SECRET: 'billing-D0j2$tP5%xQ7&yR9*zA1@bc3#-2026',
      BILLING_WEBHOOKS_ENABLED: 'false',
      PILOT_CODE_SECRET: 'pilot-E1k3%uQ6&yR8*zA0@bc2#de4$-2026',
    };
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('serves health with independent synthetic production secrets', async () => {
    const { createApp } = await import('../app');
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('serves health without billing secret when billing webhooks are disabled', async () => {
    delete process.env.BILLING_WEBHOOK_SECRET;
    const { createApp } = await import('../app');
    expect((await request(createApp()).get('/api/health')).status).toBe(200);
    expect((await request(createApp()).post('/api/v1/internal/billing/webhooks/manual')).status).toBe(404);
  });

  it('starts the explicit private preview with deterministic runtime and sandbox mail', async () => {
    Object.assign(process.env, {
      STARTERIA_PRIVATE_PREVIEW_ENABLED: 'true',
      PORTFOLIO_ENTRY_RUNTIME_MODE: 'deterministic',
      BILLING_ENFORCEMENT_ENABLED: 'false',
      AI_WEBHOOKS_ENABLED: 'false',
      HANDOFF_EMAIL_TRANSPORT_MODE: 'sandbox',
      HANDOFF_EMAIL_PILOT_ENABLED: 'false',
      SMTP_HOST: 'mailpit',
      PILOT_LEAD_NOTIFY_FROM: 'Starteria Sandbox <sandbox@starteria.test>',
      DATABASE_URL: 'postgresql://preview:test@postgres:5432/starteria_preview',
      CORS_ORIGIN: 'https://preview.example.test',
      HANDOFF_INVITATION_PUBLIC_BASE_URL: 'https://preview.example.test',
    });

    const { createApp } = await import('../app');
    expect((await request(createApp()).get('/api/health')).status).toBe(200);
    const { configuredLiveUnderstandingSynthesizer } = await import('../modules/portfolio-entry/portfolio-entry.router');
    expect(await configuredLiveUnderstandingSynthesizer().synthesize({} as never)).toBeNull();
  });

  it('still rejects deterministic production runtime outside the explicit private preview', async () => {
    process.env.PORTFOLIO_ENTRY_RUNTIME_MODE = 'deterministic';
    delete process.env.STARTERIA_PRIVATE_PREVIEW_ENABLED;
    await expect(import('../app')).rejects.toThrow(/deterministic is not allowed in production/);
  });

  it('fails when webhooks are enabled but the billing secret is absent', async () => {
    process.env.BILLING_WEBHOOKS_ENABLED = 'true';
    delete process.env.BILLING_WEBHOOK_SECRET;
    await expect(import('../app')).rejects.toThrow(/BILLING_WEBHOOK_SECRET/);
  });

  it('fails before startup when PILOT_CODE_SECRET is missing', async () => {
    delete process.env.PILOT_CODE_SECRET;

    await expect(import('../app')).rejects.toThrow(/PILOT_CODE_SECRET/);
  });
});
