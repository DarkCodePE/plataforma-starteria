#!/usr/bin/env bash
set -euo pipefail

namespace="${NAMESPACE:-starteria}"
secret_name="${BACKEND_SECRET_NAME:-starteria-backend-secrets}"
kubectl_bin="${KUBECTL_BIN:-kubectl}"

required=(
  DATABASE_URL
  JWT_SECRET
  AI_SERVICE_TOKEN
  BRIDGE_SHARED_SECRET
  PORTFOLIO_ENTRY_API_KEY
  JEV_API_KEY
  GOOGLE_CLIENT_ID
)
billing_webhooks_enabled="${BILLING_WEBHOOKS_ENABLED:-false}"
handoff_email_transport_mode="${HANDOFF_EMAIL_TRANSPORT_MODE:-disabled}"
handoff_email_pilot_enabled="${HANDOFF_EMAIL_PILOT_ENABLED:-false}"
case "$billing_webhooks_enabled" in
  true) required+=(BILLING_WEBHOOK_SECRET) ;;
  false) ;;
  *) echo '::error::BILLING_WEBHOOKS_ENABLED must be true or false'; exit 1 ;;
esac
case "$handoff_email_transport_mode" in
  disabled|pilot) ;;
  *) echo '::error::HANDOFF_EMAIL_TRANSPORT_MODE must be disabled or pilot in production'; exit 1 ;;
esac
case "$handoff_email_pilot_enabled" in
  true|false) ;;
  *) echo '::error::HANDOFF_EMAIL_PILOT_ENABLED must be true or false'; exit 1 ;;
esac
if [[ "$handoff_email_transport_mode" == disabled && "$handoff_email_pilot_enabled" != false ]]; then
  echo '::error::Handoff email pilot kill switch must be false while transport is disabled'
  exit 1
fi
export HANDOFF_EMAIL_TRANSPORT_MODE="$handoff_email_transport_mode"
export HANDOFF_EMAIL_PILOT_ENABLED="$handoff_email_pilot_enabled"
export HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW="${HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW:-2}"
export HANDOFF_EMAIL_PILOT_WINDOW_SECONDS="${HANDOFF_EMAIL_PILOT_WINDOW_SECONDS:-3600}"
export HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS="${HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS:-30}"
export HANDOFF_INVITATION_TTL_HOURS="${HANDOFF_INVITATION_TTL_HOURS:-24}"

for name in "${required[@]}"; do
  [[ -n "${!name-}" ]] || { echo "::error::Missing backend secret input: $name"; exit 1; }
done

# Create only when definitively absent. Authorization or transport errors from
# the read fail closed instead of being misclassified as a missing Secret.
existing_secret=$("$kubectl_bin" -n "$namespace" get secret "$secret_name" --ignore-not-found -o name)
if [[ -z "$existing_secret" ]]; then
  "$kubectl_bin" -n "$namespace" create secret generic "$secret_name" >/dev/null
fi

# Pilot bearers are HMAC-derived and must survive app restarts, deploys and
# idempotent resubmissions. Prefer the cluster's persisted value. A GitHub
# environment secret is optional, but may never silently rotate an existing key.
provided_pilot_code_secret="${PILOT_CODE_SECRET:-}"
cluster_pilot_code_secret=''
if [[ -n "$existing_secret" ]]; then
  existing_pilot_code_b64=$("$kubectl_bin" -n "$namespace" get secret "$secret_name" -o json | jq -er '(.data // {}).PILOT_CODE_SECRET // ""')
  if [[ -n "$existing_pilot_code_b64" ]]; then
    if ! cluster_pilot_code_secret="$(printf '%s' "$existing_pilot_code_b64" | base64 --decode)"; then
      echo '::error::Existing Kubernetes PILOT_CODE_SECRET cannot be decoded; refusing secret rotation' >&2
      exit 1
    fi
  fi
fi

if [[ -n "$cluster_pilot_code_secret" && -n "$provided_pilot_code_secret" && "$cluster_pilot_code_secret" != "$provided_pilot_code_secret" ]]; then
  echo '::error::GitHub pilot secret differs from Kubernetes; rotate explicitly in a separate approved operation' >&2
  exit 1
fi
if [[ -n "$cluster_pilot_code_secret" ]]; then
  PILOT_CODE_SECRET="$cluster_pilot_code_secret"
elif [[ -n "$provided_pilot_code_secret" ]]; then
  PILOT_CODE_SECRET="$provided_pilot_code_secret"
else
  command -v openssl >/dev/null 2>&1 || { echo '::error::openssl is required to bootstrap PILOT_CODE_SECRET' >&2; exit 1; }
  PILOT_CODE_SECRET="$(openssl rand -hex 32)" || { echo '::error::Unable to generate PILOT_CODE_SECRET' >&2; exit 1; }
fi
export PILOT_CODE_SECRET

pilot_trimmed=$(printf '%s' "$PILOT_CODE_SECRET" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
pilot_lower=$(printf '%s' "$pilot_trimmed" | tr '[:upper:]' '[:lower:]')
pilot_unique=$(printf '%s' "$pilot_trimmed" | fold -w1 | sort -u | wc -l | tr -d '[:space:]')
if [[ "$pilot_trimmed" != "$PILOT_CODE_SECRET" || ${#pilot_trimmed} -lt 32 || "$pilot_unique" -lt 8 || "$pilot_lower" == *change-me* || "$pilot_lower" == *do-not-use* || "$pilot_lower" == *replace_with* || "$pilot_lower" == *whatever* ]]; then
  echo '::error::PILOT_CODE_SECRET must be a non-placeholder, non-repetitive value of at least 32 characters' >&2
  exit 1
fi
for independent_name in JWT_SECRET AI_SERVICE_TOKEN BRIDGE_SHARED_SECRET; do
  if [[ "$PILOT_CODE_SECRET" == "${!independent_name}" ]]; then
    echo "::error::PILOT_CODE_SECRET must be independent of $independent_name" >&2
    exit 1
  fi
done
if [[ "$billing_webhooks_enabled" == true && "$PILOT_CODE_SECRET" == "$BILLING_WEBHOOK_SECRET" ]]; then
  echo '::error::PILOT_CODE_SECRET must be independent of the enabled billing secret' >&2
  exit 1
fi
unset pilot_trimmed pilot_lower pilot_unique cluster_pilot_code_secret provided_pilot_code_secret existing_pilot_code_b64

jq -n '
  def encoded($name): env[$name] | @base64;
  def optional($name):
    if ((env[$name] // "") | length) > 0
    then {($name): encoded($name)}
    else {}
    end;
  {
    data: ({
      DATABASE_URL: encoded("DATABASE_URL"),
      JWT_SECRET: encoded("JWT_SECRET"),
      AI_SERVICE_TOKEN: encoded("AI_SERVICE_TOKEN"),
      AI_SERVICE_URL: ("http://starteria-ai-service:8001" | @base64),
      BRIDGE_SHARED_SECRET: encoded("BRIDGE_SHARED_SECRET"),
      PILOT_CODE_SECRET: encoded("PILOT_CODE_SECRET"),
      BILLING_WEBHOOKS_ENABLED: (env.BILLING_WEBHOOKS_ENABLED // "false" | @base64),
      HANDOFF_EMAIL_TRANSPORT_MODE: encoded("HANDOFF_EMAIL_TRANSPORT_MODE"),
      HANDOFF_EMAIL_PILOT_ENABLED: encoded("HANDOFF_EMAIL_PILOT_ENABLED"),
      HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW: encoded("HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW"),
      HANDOFF_EMAIL_PILOT_WINDOW_SECONDS: encoded("HANDOFF_EMAIL_PILOT_WINDOW_SECONDS"),
      HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS: encoded("HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS"),
      HANDOFF_INVITATION_TTL_HOURS: encoded("HANDOFF_INVITATION_TTL_HOURS"),
      PORTFOLIO_ENTRY_API_KEY: encoded("PORTFOLIO_ENTRY_API_KEY"),
      PORTFOLIO_ENTRY_PROVIDER: ("openai_responses" | @base64),
      PORTFOLIO_ENTRY_MODEL: ("openai/gpt-5.6-luna" | @base64),
      PORTFOLIO_ENTRY_BASE_URL: ("https://openrouter.ai/api/v1" | @base64),
      JEV_API_KEY: encoded("JEV_API_KEY"),
      PORTFOLIO_ENTRY_CLASSIFIER: ("jev" | @base64),
      GOOGLE_CLIENT_ID: encoded("GOOGLE_CLIENT_ID")
    }
    + (if (env.BILLING_WEBHOOKS_ENABLED // "false") == "true" then {BILLING_WEBHOOK_SECRET: encoded("BILLING_WEBHOOK_SECRET")} else {} end)
    + optional("SMTP_HOST")
    + optional("SMTP_USER")
    + optional("SMTP_PASS")
    + optional("PILOT_LEAD_NOTIFY_FROM")
    + optional("HANDOFF_INVITATION_PUBLIC_BASE_URL")
    + optional("HANDOFF_EMAIL_PILOT_VERIFIED_FROM")
    + optional("HANDOFF_EMAIL_REPLY_TO")
    + optional("HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST")
    + optional("HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST")
    + optional("HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST"))
  }
' | "$kubectl_bin" -n "$namespace" patch secret "$secret_name" --type=merge --patch-file=/dev/stdin >/dev/null

echo "Backend Secret managed keys synchronized; unrelated keys preserved."
