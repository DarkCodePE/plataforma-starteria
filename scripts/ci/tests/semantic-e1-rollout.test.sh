#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
cd_workflow="$repo_root/.github/workflows/cd.yml"
kill_switch="$repo_root/.github/workflows/semantic-e1-kill-switch.yml"
secret_sync="$repo_root/scripts/ci/sync-backend-secret.sh"
env_example="$repo_root/backend/.env.example"
deployment="$repo_root/k8s/backend-deployment.yaml"
prod_smoke="$repo_root/scripts/ci/semantic-e1-prod-smoke.sh"
provider_smoke="$repo_root/backend/scripts/semantic-e1-live-smoke.ts"

[[ -f "$kill_switch" ]]
[[ -f "$prod_smoke" ]]

grep -q '^name: Semantic E1 Kill Switch$' "$kill_switch"
grep -q '^  workflow_dispatch:$' "$kill_switch"
if grep -Eq '^  (push|pull_request|schedule):' "$kill_switch"; then
  echo 'Semantic E1 kill switch must remain workflow_dispatch-only' >&2
  exit 1
fi
grep -q '^  group: starteria-production$' "$kill_switch"
grep -q '^    environment: production$' "$kill_switch"
grep -q 'refs/heads/main' "$kill_switch"
grep -q 'DEACTIVATE_SEMANTIC_E1' "$kill_switch"
grep -Fq 'SEMANTIC_E1_ENABLED=false' "$kill_switch"
grep -Fq '.release.flags.SEMANTIC_E1_ENABLED' "$kill_switch"
if grep -Eqi '(^|[^a-z])activate([^a-z]|$)|allowlist|prisma|migrate|set image|kubectl (apply|patch|delete|scale)' "$kill_switch"; then
  echo 'Kill switch must only deactivate E1 and must not touch data, images or pilot scope' >&2
  exit 1
fi

grep -Fq "SEMANTIC_E1_ENABLED: \${{ vars.SEMANTIC_E1_ENABLED || 'false' }}" "$cd_workflow"
grep -q '^  semantic-e1-provider-preflight:$' "$cd_workflow"
grep -Fq "SEMANTIC_E1_MAX_OUTPUT_TOKENS: '1200'" "$cd_workflow"
grep -q -- '--semantic-e1-enabled "$SEMANTIC_E1_ENABLED"' "$cd_workflow"
grep -q 'backend/scripts/semantic-e1-live-smoke.ts' "$cd_workflow"
grep -Fq 'NODE_PATH: ${{ github.workspace }}/front/node_modules' "$cd_workflow"
grep -Fq 'run: bash scripts/ci/semantic-e1-prod-smoke.sh' "$cd_workflow"
grep -Fq 'trap report_failure ERR' "$prod_smoke"
grep -Fq 'event: "semantic_e1_prod_smoke_failed"' "$prod_smoke"
grep -Fq "failure_stage='first_turn_transport'" "$prod_smoke"
grep -Fq "failure_stage='first_turn_contract'" "$prod_smoke"
grep -Fq "failure_stage='second_turn_transport'" "$prod_smoke"
grep -Fq "failure_stage='second_turn_contract'" "$prod_smoke"
grep -q 'Fail closed after unsuccessful Semantic E1 smoke' "$cd_workflow"
grep -Fq "steps.rollout.outcome == 'failure'" "$cd_workflow"
grep -Fq "steps.rollout.outcome == 'cancelled'" "$cd_workflow"
if grep -q 'SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST' "$cd_workflow"; then
  echo 'CD must not depend on the retired pilot allowlist' >&2
  exit 1
fi
if grep -Fq 'SEMANTIC_E1_ENABLED=false \' "$cd_workflow"; then
  echo 'CD must not force Semantic E1 off during every rollout' >&2
  exit 1
fi

grep -Fq 'async function main(): Promise<void>' "$provider_smoke"
grep -Fq 'void main().catch' "$provider_smoke"

! grep -q 'SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST' "$secret_sync"
! grep -q 'SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST' "$env_example"
! grep -q 'SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST' "$deployment"
grep -q '^SEMANTIC_E1_ENABLED=false$' "$env_example"
grep -q "SEMANTIC_E1_ENABLED: bool(values\['semantic-e1-enabled'\]" "$repo_root/scripts/ci/generate-release-manifest.mjs"
grep -q 'SEMANTIC_E1_ENABLED: false' "$repo_root/scripts/ci/generate-release-manifest.mjs"

test_failure_diagnostics() {
  local scenario="$1"
  local expected_exit="$2"
  local expected_stage="$3"
  local expected_code="$4"
  local case_dir="$test_root/$scenario"
  local output="$case_dir/output.txt"
  local calls="$case_dir/calls.txt"
  mkdir -p "$case_dir"

  set +e
  PATH="$mock_bin:$PATH" \
    MOCK_SCENARIO="$scenario" MOCK_CALL_LOG="$calls" \
    E2E_PROD_BASE_URL='https://semantic-smoke.invalid' \
    E2E_PROD_LEAD_PASSWORD='PASSWORD_SENTINEL' \
    bash "$prod_smoke" >"$output" 2>&1
  local actual_exit=$?
  set -e

  [[ "$actual_exit" -eq "$expected_exit" ]] || {
    echo "Expected exit $expected_exit for $scenario, got $actual_exit" >&2
    cat "$output" >&2
    return 1
  }

  local diagnostic
  diagnostic=$(grep -F '{"event":"semantic_e1_prod_smoke_failed"' "$output")
  [[ $(printf '%s\n' "$diagnostic" | wc -l) -eq 1 ]]
  jq -e --arg stage "$expected_stage" --arg code "$expected_code" '
    .event == "semantic_e1_prod_smoke_failed"
    and .stage == $stage
    and .apiCode == $code
    and ((keys - [
      "apiCode", "enabled", "event", "factsCount", "hasMainUncertainty",
      "hasNextStep", "hasStartingPoint", "model", "provider",
      "semanticVersion", "stage", "totalTokens", "turnStatus"
    ]) | length == 0)
  ' >/dev/null <<<"$diagnostic"

  if grep -Eq 'ACCESS_TOKEN_SENTINEL|INPUT_TEXT_SENTINEL|MESSAGE_SENTINEL|PASSWORD_SENTINEL' "$output"; then
    echo "Semantic E1 diagnostics exposed a sensitive sentinel for $scenario" >&2
    cat "$output" >&2
    return 1
  fi

  [[ $(grep -Fc '/abandon' "$calls") -eq 1 ]] || {
    echo "Semantic E1 cleanup must abandon exactly one session for $scenario" >&2
    cat "$calls" >&2
    return 1
  }
}

if command -v jq >/dev/null 2>&1; then
  test_root=$(mktemp -d)
  mock_bin="$test_root/bin"
  mkdir -p "$mock_bin"
  trap 'rm -rf "$test_root"' EXIT

  cat >"$mock_bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -euo pipefail
url="${!#}"
printf '%s\n' "$url" >>"$MOCK_CALL_LOG"

case "$url" in
  */api/v1/auth/login)
    printf '%s\n' '{"data":{"accessToken":"synthetic-test-token"}}'
    ;;
  */api/v1/portfolio-bootstrap/sessions/direct)
    printf '%s\n' '{"data":{"bootstrapSession":{"id":"synthetic-session"}}}'
    ;;
  */context/semantic/turns)
    if [[ "$MOCK_SCENARIO" == transport_failure ]]; then
      printf '%s\n' '{"error":{"code":"provider_unavailable","message":"MESSAGE_SENTINEL"},"accessToken":"ACCESS_TOKEN_SENTINEL","inputText":"INPUT_TEXT_SENTINEL","password":"PASSWORD_SENTINEL"}'
      exit 22
    fi
    printf '%s\n' '{"data":{"turn":{"status":"failed_retryable","error":{"code":"semantic_output_invalid","message":"MESSAGE_SENTINEL"},"execution":{"provider":"openai_responses","model":"synthetic-model","totalTokens":321},"facts":[],"hypotheses":[],"emittedQuestion":null,"convergence":{"synthesis":null}},"state":{"version":1}},"accessToken":"ACCESS_TOKEN_SENTINEL","inputText":"INPUT_TEXT_SENTINEL","password":"PASSWORD_SENTINEL"}'
    ;;
  */context/semantic)
    printf '%s\n' '{"data":{"enabled":true,"state":null}}'
    ;;
  */abandon)
    printf '%s\n' '{"data":{"status":"abandoned"}}'
    ;;
  *)
    printf 'Unexpected mock curl URL: %s\n' "$url" >&2
    exit 64
    ;;
esac
MOCK_CURL
  chmod +x "$mock_bin/curl"

  test_failure_diagnostics transport_failure 22 first_turn_transport provider_unavailable
  test_failure_diagnostics contract_failure 1 first_turn_contract semantic_output_invalid
elif [[ "${CI:-}" == true ]]; then
  echo 'jq is required for Semantic E1 behavioral rollout tests in CI' >&2
  exit 1
else
  echo 'jq unavailable; Semantic E1 behavioral rollout tests skipped outside CI' >&2
fi

echo 'Semantic E1 normal rollout contract PASS'
