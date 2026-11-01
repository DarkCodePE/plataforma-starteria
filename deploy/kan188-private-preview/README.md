# KAN-187 private preview runbook

This is the recommended low-cost route for a private Starteria demo. It runs one
isolated Docker Compose project with PostgreSQL 16, the existing backend and
frontend, Mailpit, and Caddy-managed HTTPS. It does not use production data,
production secrets, external SMTP, billing, or a live model provider.

The deployment is intentionally blocked until an operator supplies a real,
non-production host and DNS name. No hostname is assigned by this repository.

## Operator prerequisites

- One Linux host dedicated to the preview: 4 GiB RAM, 2 vCPU minimum (4 vCPU
  recommended while building), and 20 GiB encrypted storage.
- Docker Engine with Compose v2, restricted SSH access, and inbound TCP 80/443.
- A non-production, DNS-only A record with exactly one IPv4 destination pointing
  directly to that host (no HTTP proxy), plus one fixed viewer egress IPv4 `/32`
  for the Caddy allow gate.
- Independent generated values for every `PREVIEW_*_SECRET`, database password,
  and synthetic-user password in `preview.env`. Keep the file outside Git with
  mode `0600`. Use URL-safe values (for example, `openssl rand -hex 32`) so the
  database URL and Docker Compose interpolation remain unambiguous.
- The exact source checkout approved for the demo. For KAN-187 the baseline is
  `2b60d2e43b9134b464f461c5e1c08c28dfbc61ec` plus the reviewed preview fix.

The stack reserves at most 2.25 GiB RAM and 3.5 CPU across steady services;
migration or provisioning adds a temporary 512 MiB/1 CPU container. One host,
one DNS record, and no managed Kubernetes, image registry, tunnel, or LLM API
are required.

## Preflight and launch

Create `preview.env` from `preview.env.example`, replace every placeholder, then
run from the repository root:

```bash
chmod 600 deploy/kan188-private-preview/preview.env
deploy/kan188-private-preview/preflight.sh deploy/kan188-private-preview/preview.env
docker compose --env-file deploy/kan188-private-preview/preview.env \
  -f deploy/kan188-private-preview/compose.yml build
docker compose --env-file deploy/kan188-private-preview/preview.env \
  -f deploy/kan188-private-preview/compose.yml up -d postgres mailpit
docker compose --env-file deploy/kan188-private-preview/preview.env \
  -f deploy/kan188-private-preview/compose.yml --profile operations run --rm migrate
docker compose --env-file deploy/kan188-private-preview/preview.env \
  -f deploy/kan188-private-preview/compose.yml --profile operations run --rm provision
docker compose --env-file deploy/kan188-private-preview/preview.env \
  -f deploy/kan188-private-preview/compose.yml up -d backend frontend caddy
```

The provisioning operation uses the existing synthetic E2E tenant and accounts
only. It never imports production data. Confirm the migration command reports
all canonical migrations before provisioning.

Verify from the authorized viewer network:

```bash
curl --fail --show-error --silent https://REPLACE_WITH_APPROVED_HOST/api/health
curl --fail --show-error --silent --output /dev/null https://REPLACE_WITH_APPROVED_HOST/
```

Verify that a request outside `PREVIEW_ALLOWED_CIDR` receives HTTP 403. Do not
replace `REPLACE_WITH_APPROVED_HOST` until the operator has supplied the actual
DNS name; the repository does not define one.

## Handoff inbox

Handoff uses only Mailpit on the private Docker network. Mailpit publishes no
host port; Caddy exposes its UI at `https://APPROVED_HOST/mailpit/` behind the
same HTTPS and viewer-CIDR gate as the application. The authorized demonstrator
retrieves the synthetic invitation there and follows its HTTPS link. No external
email is sent.

## GO / NO_GO

GO requires: reviewed commit, `KAN187_PREFLIGHT_GO`, successful image build,
canonical migrations on the empty preview database, synthetic provisioning,
healthy containers, valid HTTPS, 403 outside the CIDR, successful login for both
synthetic actors, Mailpit-only invitation delivery, and billing remaining off.

NO_GO applies if any prerequisite is absent; DNS/TLS does not match; the host or
secrets are shared with production; any email can leave Mailpit; a migration,
health check, or synthetic login fails; or the runtime requests a live provider.

After the authorized demo, destroy the isolated data and remove DNS:

```bash
docker compose --env-file deploy/kan188-private-preview/preview.env \
  -f deploy/kan188-private-preview/compose.yml down --volumes --remove-orphans
```

Delete `preview.env` through the operator's approved secret-destruction process.
