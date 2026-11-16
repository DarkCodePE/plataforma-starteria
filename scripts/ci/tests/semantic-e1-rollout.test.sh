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
grep -q 'scripts/ci/semantic-e1-prod-smoke.sh' "$cd_workflow"
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

echo 'Semantic E1 normal rollout contract PASS'
