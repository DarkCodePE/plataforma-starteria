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
    expect(compose).toContain('HANDOFF_EMAIL_TRANSPORT_MODE: ${HANDOFF_EMAIL_TRANSPORT_MODE:-sandbox}');
    expect(compose).toContain('HANDOFF_EMAIL_PILOT_ENABLED: ${HANDOFF_EMAIL_PILOT_ENABLED:-false}');
    expect(compose).toContain('PILOT_LEAD_EMAIL_ENABLED: "false"');
    expect(compose).toContain('AI_WEBHOOKS_ENABLED: "false"');
    expect(compose).toContain('BILLING_WEBHOOKS_ENABLED: "false"');
    expect(compose).toContain('BILLING_ENFORCEMENT_ENABLED: "false"');
    expect(compose).toContain('TRUST_PROXY_HOPS: "2"');
    expect(compose).toContain('STARTERIA_PRIVATE_PREVIEW_ENABLED: "true"');
    expect(compose).toContain('PORTFOLIO_ENTRY_RUNTIME_MODE: deterministic');
    expect(compose).toContain('PILOT_CODE_SECRET: ${PREVIEW_PILOT_CODE_SECRET:?set PREVIEW_PILOT_CODE_SECRET in preview.env}');
    expect(compose).toMatch(/postgres:16-alpine@sha256:[a-f0-9]{64}/);
    expect(compose).toMatch(/axllent\/mailpit:v[^@]+@sha256:[a-f0-9]{64}/);
    expect(compose).toMatch(/caddy:2\.10-alpine@sha256:[a-f0-9]{64}/);
  });

  it('keeps the sandbox inbox behind the same CIDR-gated HTTPS edge and provisions only synthetic users', () => {
    const compose = readFileSync(resolve(root, 'deploy/kan188-private-preview/compose.yml'), 'utf8');
    const caddy = readFileSync(resolve(root, 'deploy/kan188-private-preview/Caddyfile'), 'utf8');
    const mailpitBlock = compose.split('\n  mailpit:')[1]?.split('\n  migrate:')[0] ?? '';
    expect(mailpitBlock).toContain('MP_WEBROOT: /mailpit/');
    expect(mailpitBlock).not.toContain('ports:');
    expect(caddy).toContain('handle /mailpit/*');
    expect(caddy).toContain('reverse_proxy mailpit:8025');
    expect(compose).toContain('backend/scripts/e2e-prod-tenant.ts", "setup", "--apply"');
    expect(compose).toContain('E2E_PROD_LEAD_PASSWORD: ${PREVIEW_LEAD_PASSWORD:');
    expect(compose).toContain('E2E_PROD_PARTICIPANT_PASSWORD: ${PREVIEW_OWNER_PASSWORD:');
    expect(compose).toContain('E2E_PROD_MEMBER_PASSWORD: ${PREVIEW_MEMBER_PASSWORD:');
  });

  it('keeps the backend on the internal-only network', () => {
    const compose = readFileSync(resolve(root, 'deploy/kan188-private-preview/compose.yml'), 'utf8');
    const backendBlock = compose.split('\n  backend:')[1]?.split('\n  frontend:')[0] ?? '';
    expect(backendBlock).toContain('networks:');
    expect(backendBlock).toContain('private:');
    expect(backendBlock).not.toContain('outbound');
    expect(compose).toMatch(/private:\r?\n    internal: true/);
  });

  it('fails preflight before launch when isolation inputs are unsafe', () => {
    const preflight = readFileSync(resolve(root, 'deploy/kan188-private-preview/preflight.sh'), 'utf8');
    expect(preflight).toContain("[[ \"$host\" != 'starter-ia.com' && \"$host\" != 'www.starter-ia.com' ]]");
    expect(preflight).toContain("fail 'PREVIEW_HOST must resolve to exactly one IPv4 address'");
    expect(preflight).toContain("fail 'PREVIEW_HOST does not resolve exclusively to PREVIEW_EXPECTED_IPV4'");
    expect(preflight).toContain("fail 'PREVIEW_ALLOWED_CIDR must authorize exactly one public IPv4 (/32)'");
    expect(preflight).toContain("fail 'preview.env permissions must be 0600'");
    expect(preflight).toContain("fail 'all preview secrets and synthetic passwords must be independent'");
    expect(preflight).toContain("[[ \"$(require_value HANDOFF_EMAIL_TRANSPORT_MODE)\" == 'sandbox' ]]");
    expect(preflight).toContain("[[ \"$(require_value SMTP_HOST)\" == 'mailpit' ]]");
    expect(preflight).toContain('docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet');
  });
});
