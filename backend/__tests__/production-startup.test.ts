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

  it('fails before startup when BILLING_WEBHOOK_SECRET is missing', async () => {
    delete process.env.BILLING_WEBHOOK_SECRET;

    await expect(import('../app')).rejects.toThrow(/BILLING_WEBHOOK_SECRET/);
  });

  it('fails before startup when PILOT_CODE_SECRET is missing', async () => {
    delete process.env.PILOT_CODE_SECRET;

    await expect(import('../app')).rejects.toThrow(/PILOT_CODE_SECRET/);
  });
});
