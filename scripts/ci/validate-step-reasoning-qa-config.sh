#!/usr/bin/env bash
set -euo pipefail

enabled="${STEP_REASONING_COPILOT_ENABLED:-false}"
allowlist="${STEP_REASONING_QA_USER_IDS:-}"
provider_mode="${STEP_REASONING_PROVIDER_MODE:-qa_stub}"

case "$enabled" in
  true|false) ;;
  *) echo '::error::STEP_REASONING_COPILOT_ENABLED must be true or false'; exit 1 ;;
esac

# KAN-204 explicitly prohibits real LLM providers for this QA exposure.
[[ "$provider_mode" == 'qa_stub' ]] || {
  echo '::error::STEP_REASONING_PROVIDER_MODE must remain qa_stub until independent LLM controls are approved'
  exit 1
}

if [[ "$enabled" == 'true' ]]; then
  [[ -n "$allowlist" ]] || {
    echo '::error::STEP_REASONING_QA_USER_IDS is required when the QA experience is enabled'
    exit 1
  }
  [[ "$allowlist" != *' '* && "$allowlist" != *$'\t'* && "$allowlist" != *,* ]] || {
    echo '::error::KAN-204 permits exactly one synthetic QA user id without whitespace'
    exit 1
  }
  [[ "$allowlist" =~ ^[A-Za-z0-9_-]{3,128}$ ]] || {
    echo '::error::STEP_REASONING_QA_USER_IDS contains an invalid identifier'
    exit 1
  }
fi

echo 'Step reasoning QA configuration validated (identities redacted; provider=qa_stub).'
