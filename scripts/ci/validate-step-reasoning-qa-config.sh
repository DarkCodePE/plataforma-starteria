#!/usr/bin/env bash
set -euo pipefail

enabled="${STEP_REASONING_COPILOT_ENABLED:-false}"
emergency_disabled="${STEP_REASONING_COPILOT_EMERGENCY_DISABLED:-false}"
provider_mode="${STEP_REASONING_PROVIDER_MODE:-qa_stub}"

for pair in "STEP_REASONING_COPILOT_ENABLED:$enabled" "STEP_REASONING_COPILOT_EMERGENCY_DISABLED:$emergency_disabled"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  case "$value" in
    true|false) ;;
    *) echo "::error::$name must be true or false"; exit 1 ;;
  esac
done

# KAN-204 explicitly prohibits real LLM providers for this QA exposure.
[[ "$provider_mode" == 'qa_stub' ]] || {
  echo '::error::STEP_REASONING_PROVIDER_MODE must remain qa_stub until independent LLM controls are approved'
  exit 1
}

echo 'Step reasoning code-driven QA configuration validated (provider=qa_stub).'
