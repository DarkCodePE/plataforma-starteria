#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
validator="$repo_root/scripts/ci/validate-step-reasoning-qa-config.sh"

expect_fail() {
  if env "$@" bash "$validator" >/dev/null 2>&1; then
    echo "expected validation failure: $*" >&2
    exit 1
  fi
}

env STEP_REASONING_COPILOT_ENABLED=false STEP_REASONING_PROVIDER_MODE=qa_stub bash "$validator" >/dev/null
env STEP_REASONING_COPILOT_ENABLED=true STEP_REASONING_QA_USER_IDS=synthetic-e2e-user STEP_REASONING_PROVIDER_MODE=qa_stub bash "$validator" >/dev/null
expect_fail STEP_REASONING_COPILOT_ENABLED=true STEP_REASONING_PROVIDER_MODE=qa_stub
expect_fail STEP_REASONING_COPILOT_ENABLED=true STEP_REASONING_QA_USER_IDS=synthetic-e2e-user,second-user STEP_REASONING_PROVIDER_MODE=qa_stub
expect_fail STEP_REASONING_COPILOT_ENABLED=true STEP_REASONING_QA_USER_IDS=synthetic-e2e-user STEP_REASONING_PROVIDER_MODE=live_llm
expect_fail STEP_REASONING_COPILOT_ENABLED=unexpected STEP_REASONING_QA_USER_IDS=synthetic-e2e-user STEP_REASONING_PROVIDER_MODE=qa_stub

grep -q '^ARG VITE_STEP_REASONING_COPILOT_ENABLED=false$' "$repo_root/Dockerfile.frontend"
grep -q '^ARG VITE_STEP_REASONING_QA_USER_IDS=$' "$repo_root/Dockerfile.frontend"
grep -q 'VITE_STEP_REASONING_COPILOT_ENABLED=' "$repo_root/.github/workflows/cd.yml"
grep -q 'VITE_STEP_REASONING_QA_USER_IDS=' "$repo_root/.github/workflows/cd.yml"
grep -q 'starteria-step-reasoning-qa' "$repo_root/.github/workflows/cd.yml"
grep -q -- '--from=configmap/starteria-step-reasoning-qa' "$repo_root/.github/workflows/cd.yml"
grep -q 'STEP_REASONING_PROVIDER_MODE.*qa_stub' "$repo_root/.github/workflows/cd.yml"

if grep -Eq 'STEP_REASONING_PROVIDER_MODE.*live_llm|OPENROUTER.*STEP_REASONING' "$repo_root/.github/workflows/cd.yml"; then
  echo 'CD must not activate a real Step reasoning provider' >&2
  exit 1
fi

echo 'KAN-204 CD/flag contract PASS'
