#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
workflow="$repo_root/.github/workflows/semantic-e1-pilot-gate.yml"
cd_workflow="$repo_root/.github/workflows/cd.yml"
secret_sync="$repo_root/scripts/ci/sync-backend-secret.sh"
env_example="$repo_root/backend/.env.example"

[[ -f "$workflow" ]]
grep -q '^  workflow_dispatch:$' "$workflow"
if grep -Eq '^  (push|pull_request|schedule):' "$workflow"; then
  echo 'Semantic E1 pilot gate must remain workflow_dispatch-only' >&2
  exit 1
fi

grep -q '^  group: starteria-production$' "$workflow"
grep -q '^    environment: production$' "$workflow"
grep -q 'refs/heads/main' "$workflow"
grep -q 'ACTIVATE_E1_PILOT' "$workflow"
grep -q 'DEACTIVATE_E1_PILOT' "$workflow"
grep -q 'SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST' "$workflow"
grep -Fq 'SEMANTIC_E1_ENABLED="$desired"' "$workflow"
grep -Fq 'SEMANTIC_E1_ENABLED=false' "$workflow"
grep -Fq '.release.flags.SEMANTIC_E1_ENABLED' "$workflow"
grep -q 'Pilot gate must not change the backend image' "$workflow"

if grep -Eqi 'prisma|migrate|set image|kubectl (apply|patch|delete|scale)' "$workflow"; then
  echo 'Semantic E1 pilot gate must not touch schema, images or unrelated Kubernetes resources' >&2
  exit 1
fi

sync_step=$(awk '
  /- name: Sync Kubernetes secrets/ { capture=1 }
  capture { print }
  capture && /run: \|/ { exit }
' "$cd_workflow")
grep -Fq 'SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST: ${{ secrets.SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST }}' <<<"$sync_step"
grep -Fq 'SEMANTIC_E1_ENABLED=false' "$cd_workflow"
grep -Fq 'SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST: ((env.SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST // "") | @base64)' "$secret_sync"
grep -q '^SEMANTIC_E1_ENABLED=false$' "$env_example"
grep -q '^SEMANTIC_E1_PILOT_ORGANIZATION_ALLOWLIST=$' "$env_example"

echo 'Semantic E1 pilot gate contract PASS'
