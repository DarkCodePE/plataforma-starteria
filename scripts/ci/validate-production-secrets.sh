#!/usr/bin/env bash
set -euo pipefail

secret_names=(
  STARTERIA_JWT_SECRET
  STARTERIA_BRIDGE_SHARED_SECRET
  STARTERIA_AI_SERVICE_TOKEN
)

# Optional in GitHub: the CD can reuse/bootstrap this key in the Kubernetes
# Secret. An explicitly supplied value remains subject to full validation.
if [[ -n "${STARTERIA_PILOT_CODE_SECRET-}" ]]; then
  secret_names+=(STARTERIA_PILOT_CODE_SECRET)
fi

billing_webhooks_enabled="${BILLING_WEBHOOKS_ENABLED:-false}"
case "$billing_webhooks_enabled" in
  true) secret_names+=(STARTERIA_BILLING_WEBHOOK_SECRET) ;;
  false) ;;
  *) echo '::error::BILLING_WEBHOOKS_ENABLED must be true or false'; exit 1 ;;
esac

failed=0
for name in "${secret_names[@]}"; do
  value="${!name-}"
  if [[ -z "$value" || "$value" =~ ^[[:space:]]+$ ]]; then
    echo "::error::Missing required production secret: $name"
    failed=1
    continue
  fi

  trimmed=$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ "$trimmed" != "$value" ]]; then
    echo "::error::$name must not contain leading or trailing whitespace"
    failed=1
  fi
  lower=$(printf '%s' "$trimmed" | tr '[:upper:]' '[:lower:]')
  unique_count=$(printf '%s' "$trimmed" | fold -w1 | sort -u | wc -l | tr -d '[:space:]')
  if (( ${#trimmed} < 32 || unique_count < 8 )); then
    echo "::error::$name must be at least 32 characters and contain at least 8 distinct characters"
    failed=1
  fi
  for marker in change-me do-not-use replace_with whatever; do
    if [[ "$lower" == *"$marker"* ]]; then
      echo "::error::$name contains a forbidden placeholder marker"
      failed=1
    fi
  done
done

for ((left = 0; left < ${#secret_names[@]}; left++)); do
  for ((right = left + 1; right < ${#secret_names[@]}; right++)); do
    left_name="${secret_names[$left]}"
    right_name="${secret_names[$right]}"
    if [[ -n "${!left_name-}" && "${!left_name}" == "${!right_name-}" ]]; then
      echo "::error::$left_name and $right_name must be independent values"
      failed=1
    fi
  done
done

if (( failed != 0 )); then
  exit 1
fi

echo 'Production secret contract validated (values redacted).'
