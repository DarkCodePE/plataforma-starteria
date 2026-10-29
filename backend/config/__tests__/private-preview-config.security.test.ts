import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..');

describe('KAN-188 private preview hardening', () => {
  it('uses an edge CIDR gate without consuming the application Authorization header', () => {
    const caddy = readFileSync(resolve(root, 'deploy/kan188-private-preview/Caddyfile'), 'utf8');
    expect(caddy).toContain('remote_ip {$PREVIEW_ALLOWED_CIDR}');
    expect(caddy).not.toMatch(/basic_auth/i);
    expect(caddy).toContain('Content-Security-Policy');
    expect(caddy).toContain("frame-ancestors 'none'");
    expect(caddy).toContain('X-Frame-Options "DENY"');
    expect(caddy).toContain('Strict-Transport-Security');
  });

  it('keeps real/public mail and unused internal webhooks disabled', () => {
    const compose = readFileSync(resolve(root, 'deploy/kan188-private-preview/compose.yml'), 'utf8');
    expect(compose).toContain('HANDOFF_EMAIL_TRANSPORT_MODE: ${HANDOFF_EMAIL_TRANSPORT_MODE:-disabled}');
    expect(compose).toContain('HANDOFF_EMAIL_PILOT_ENABLED: ${HANDOFF_EMAIL_PILOT_ENABLED:-false}');
    expect(compose).toContain('PILOT_LEAD_EMAIL_ENABLED: "false"');
    expect(compose).toContain('AI_WEBHOOKS_ENABLED: "false"');
    expect(compose).toContain('BILLING_WEBHOOKS_ENABLED: "false"');
    expect(compose).toContain('TRUST_PROXY_HOPS: "2"');
    expect(compose).toContain('PILOT_CODE_SECRET: ${PREVIEW_PILOT_CODE_SECRET:?set PREVIEW_PILOT_CODE_SECRET in preview.env}');
    expect(compose).toMatch(/postgres:16-alpine@sha256:[a-f0-9]{64}/);
    expect(compose).toMatch(/axllent\/mailpit:v[^@]+@sha256:[a-f0-9]{64}/);
    expect(compose).toMatch(/caddy:2\.10-alpine@sha256:[a-f0-9]{64}/);
  });

  it('keeps the backend on the internal-only network', () => {
    const compose = readFileSync(resolve(root, 'deploy/kan188-private-preview/compose.yml'), 'utf8');
    const backendBlock = compose.split('\n  backend:')[1]?.split('\n  frontend:')[0] ?? '';
    expect(backendBlock).toContain('networks:');
    expect(backendBlock).toContain('private:');
    expect(backendBlock).not.toContain('outbound');
    expect(compose).toContain('private:\n    internal: true');
  });
});
