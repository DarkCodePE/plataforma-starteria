#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
workflow="$repo_root/.github/workflows/kan204-backend-env-hotfix.yml"

[[ -f "$workflow" ]]
grep -q '^  workflow_dispatch:$' "$workflow"
if grep -Eq '^  (push|pull_request|schedule):' "$workflow"; then
  echo 'KAN-204 recovery must remain workflow_dispatch-only' >&2
  exit 1
fi

grep -q '^  group: starteria-production$' "$workflow"
grep -q '^    environment: production$' "$workflow"
grep -q 'refs/heads/main' "$workflow"
grep -q 'REMOVE_STEP_REASONING_QA_USER_IDS_FROM_STARTERIA_BACKEND' "$workflow"
grep -q 'EXPECTED_IMAGE: orlandogtp/starteria-backend:main-09535d7' "$workflow"
grep -q 'Expected exactly one obsolete env reference' "$workflow"
grep -q 'ConfigMap now contains the key' "$workflow"
grep -Fq "set env \"deployment/\$DEPLOYMENT\" \"\${STALE_ENV_NAME}-\"" "$workflow"
grep -q 'Backend is not 1/1 Ready' "$workflow"
grep -q 'http://127.0.0.1:3001/api/health' "$workflow"
grep -q 'http://starteria-backend:3001/api/health' "$workflow"
grep -q 'http://127.0.0.1/api/health' "$workflow"
grep -q 'https://starter-ia.com/api/health' "$workflow"

if grep -Eqi 'prisma|migrate|database_url|rollout undo|set image|kubectl apply|kubectl patch|kubectl delete' "$workflow"; then
  echo 'KAN-204 recovery must not touch migrations, database credentials, images, rollback or unrelated resources' >&2
  exit 1
fi

write_commands=$(grep -Ec 'kubectl .*(set env|apply|patch|delete|rollout (restart|undo)|set image|scale)' "$workflow")
[[ "$write_commands" == "1" ]] || {
  echo "expected one Kubernetes write command, found $write_commands" >&2
  exit 1
}

echo 'KAN-204 backend env-reference hotfix contract PASS'
