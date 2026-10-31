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
  BILLING_WEBHOOK_SECRET
  PILOT_CODE_SECRET
  PORTFOLIO_ENTRY_API_KEY
  JEV_API_KEY
  GOOGLE_CLIENT_ID
)
for name in "${required[@]}"; do
  [[ -n "${!name-}" ]] || { echo "::error::Missing backend secret input: $name"; exit 1; }
done

# Create only when definitively absent. Authorization or transport errors from
# the read fail closed instead of being misclassified as a missing Secret.
existing_secret=$("$kubectl_bin" -n "$namespace" get secret "$secret_name" --ignore-not-found -o name)
if [[ -z "$existing_secret" ]]; then
  "$kubectl_bin" -n "$namespace" create secret generic "$secret_name" >/dev/null
fi

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
      BILLING_WEBHOOK_SECRET: encoded("BILLING_WEBHOOK_SECRET"),
      PILOT_CODE_SECRET: encoded("PILOT_CODE_SECRET"),
      PORTFOLIO_ENTRY_API_KEY: encoded("PORTFOLIO_ENTRY_API_KEY"),
      PORTFOLIO_ENTRY_PROVIDER: ("openai_responses" | @base64),
      PORTFOLIO_ENTRY_MODEL: ("openai/gpt-5.6-luna" | @base64),
      PORTFOLIO_ENTRY_BASE_URL: ("https://openrouter.ai/api/v1" | @base64),
      JEV_API_KEY: encoded("JEV_API_KEY"),
      PORTFOLIO_ENTRY_CLASSIFIER: ("jev" | @base64),
      GOOGLE_CLIENT_ID: encoded("GOOGLE_CLIENT_ID")
    }
    + optional("SMTP_HOST")
    + optional("SMTP_USER")
    + optional("SMTP_PASS")
    + optional("PILOT_LEAD_NOTIFY_FROM"))
  }
' | "$kubectl_bin" -n "$namespace" patch secret "$secret_name" --type=merge --patch-file=/dev/stdin >/dev/null

echo "Backend Secret managed keys synchronized; unrelated keys preserved."
