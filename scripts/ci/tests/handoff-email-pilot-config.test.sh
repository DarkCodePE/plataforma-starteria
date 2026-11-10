#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
validator="$repo_root/scripts/ci/validate-handoff-email-pilot-config.sh"

fail() {
  echo "$1" >&2
  exit 1
}

run_validator() {
  env -i PATH="$PATH" \
    HANDOFF_EMAIL_TRANSPORT_MODE="${HANDOFF_EMAIL_TRANSPORT_MODE-}" \
    HANDOFF_EMAIL_PILOT_ENABLED="${HANDOFF_EMAIL_PILOT_ENABLED-}" \
    SMTP_HOST="${SMTP_HOST-}" \
    SMTP_USER="${SMTP_USER-}" \
    SMTP_PASS="${SMTP_PASS-}" \
    PILOT_LEAD_NOTIFY_FROM="${PILOT_LEAD_NOTIFY_FROM-}" \
    HANDOFF_EMAIL_PILOT_VERIFIED_FROM="${HANDOFF_EMAIL_PILOT_VERIFIED_FROM-}" \
    HANDOFF_EMAIL_REPLY_TO="${HANDOFF_EMAIL_REPLY_TO-}" \
    HANDOFF_INVITATION_PUBLIC_BASE_URL="${HANDOFF_INVITATION_PUBLIC_BASE_URL-}" \
    HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST="${HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST-}" \
    HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST="${HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST-}" \
    HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST="${HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST-}" \
    HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW="${HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW-}" \
    HANDOFF_EMAIL_PILOT_WINDOW_SECONDS="${HANDOFF_EMAIL_PILOT_WINDOW_SECONDS-}" \
    HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS="${HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS-}" \
    HANDOFF_INVITATION_TTL_HOURS="${HANDOFF_INVITATION_TTL_HOURS-}" \
    E2E_PROD_OWNER_EMAIL="${E2E_PROD_OWNER_EMAIL-}" \
    E2E_PROD_LEAD_ACTOR_ID="${E2E_PROD_LEAD_ACTOR_ID-}" \
    PRODUCTION_BASE_URL="https://starter-ia.com" \
    bash "$validator"
}

unset HANDOFF_EMAIL_TRANSPORT_MODE HANDOFF_EMAIL_PILOT_ENABLED
output=$(run_validator) || fail 'disabled-by-default configuration was rejected'
[[ "$output" == *'mode=disabled'* ]] || fail 'disabled result did not report the safe mode'

export HANDOFF_EMAIL_TRANSPORT_MODE=disabled HANDOFF_EMAIL_PILOT_ENABLED=true
run_validator >/dev/null 2>&1 && fail 'disabled mode accepted an enabled pilot kill switch'

export HANDOFF_EMAIL_TRANSPORT_MODE=sandbox HANDOFF_EMAIL_PILOT_ENABLED=false
run_validator >/dev/null 2>&1 && fail 'production validator accepted sandbox mode'

export HANDOFF_EMAIL_TRANSPORT_MODE=pilot HANDOFF_EMAIL_PILOT_ENABLED=true
run_validator >/dev/null 2>&1 && fail 'pilot mode accepted missing credentials and allowlists'

export SMTP_HOST=smtp.provider.example SMTP_USER=synthetic-user SMTP_PASS=synthetic-password
export PILOT_LEAD_NOTIFY_FROM='Starteria <pilot@starteria.example>'
export HANDOFF_EMAIL_PILOT_VERIFIED_FROM=pilot@starteria.example
export HANDOFF_EMAIL_REPLY_TO=support@starteria.example
export HANDOFF_INVITATION_PUBLIC_BASE_URL=https://starter-ia.com
export HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST='authorized.owner@pilot-mail.org'
export HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST='org-e2e-prod'
export HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST='lead-user-id'
export HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW=1
export HANDOFF_EMAIL_PILOT_WINDOW_SECONDS=3600
export HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS=60
export HANDOFF_INVITATION_TTL_HOURS=24
export E2E_PROD_OWNER_EMAIL=authorized.owner@pilot-mail.org
export E2E_PROD_LEAD_ACTOR_ID=lead-user-id

output=$(run_validator) || fail 'complete restricted pilot configuration was rejected'
[[ "$output" == *'mode=pilot'* ]] || fail 'pilot result did not report the armed mode'
[[ "$output" != *'authorized.owner'* && "$output" != *'lead-user-id'* && "$output" != *'smtp.provider'* ]] \
  || fail 'validator output exposed protected configuration'

export SMTP_HOST=mailpit:1025
run_validator >/dev/null 2>&1 && fail 'pilot accepted a local Mailpit SMTP host'
export SMTP_HOST=smtp.provider.example

export E2E_PROD_OWNER_EMAIL=other.owner@pilot-mail.org
run_validator >/dev/null 2>&1 && fail 'pilot accepted an owner outside the recipient allowlist'
export E2E_PROD_OWNER_EMAIL=authorized.owner@pilot-mail.org

export E2E_PROD_LEAD_ACTOR_ID=other-lead-id
run_validator >/dev/null 2>&1 && fail 'pilot accepted a lead outside the actor allowlist'
export E2E_PROD_LEAD_ACTOR_ID=lead-user-id

export HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST='authorized.owner@pilot-mail.org,customer@example.org'
run_validator >/dev/null 2>&1 && fail 'pilot accepted an additional recipient'
export HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST='authorized.owner@pilot-mail.org'

export HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST='org-e2e-prod,customer-org'
run_validator >/dev/null 2>&1 && fail 'pilot accepted an additional organization'
export HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST='org-e2e-prod'

export HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST='lead-user-id,other-user-id'
run_validator >/dev/null 2>&1 && fail 'pilot accepted an additional actor'
export HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST='lead-user-id'

export HANDOFF_INVITATION_PUBLIC_BASE_URL=https://other.example.test
run_validator >/dev/null 2>&1 && fail 'pilot accepted an invitation origin different from production'

workflow="$repo_root/.github/workflows/cd.yml"
syncer="$repo_root/scripts/ci/sync-backend-secret.sh"
grep -q '^  handoff-email-config:' "$workflow" || fail 'CD is missing the pre-publication Handoff configuration job'
grep -Eq 'needs: \[[^]]*handoff-email-config[^]]*\]' "$workflow" \
  || fail 'image publication is not gated by Handoff configuration validation'
# Literal workflow source assertion; no shell expansion is intended here.
# shellcheck disable=SC2016
grep -q '"$REF" == refs/heads/main' "$workflow" \
  || fail 'CD orchestration is not restricted to the current main workflow definition'
grep -q 'bash control-plane/scripts/ci/validate-handoff-email-pilot-config.sh' "$workflow" \
  || fail 'pre-publication Handoff validation does not use the current control plane'
grep -q 'bash .cd-control-plane/scripts/ci/validate-handoff-email-pilot-config.sh' "$workflow" \
  || fail 'pre-sync Handoff validation does not use the current control plane'
grep -q 'bash .cd-control-plane/scripts/ci/sync-backend-secret.sh' "$workflow" \
  || fail 'production secret synchronization does not use the current control plane'
for name in \
  HANDOFF_EMAIL_TRANSPORT_MODE HANDOFF_EMAIL_PILOT_ENABLED HANDOFF_INVITATION_PUBLIC_BASE_URL \
  HANDOFF_EMAIL_PILOT_VERIFIED_FROM HANDOFF_EMAIL_REPLY_TO HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST \
  HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST; do
  grep -q "$name" "$syncer" || fail "backend secret synchronization is missing $name"
done

echo 'handoff email pilot configuration tests passed'
