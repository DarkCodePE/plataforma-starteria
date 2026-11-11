#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
cd "$repo_root"

fail() {
  echo "release-parity contract: $*" >&2
  exit 1
}

require_text() {
  local file=$1
  local pattern=$2
  grep -Fq -- "$pattern" "$file" || fail "$file is missing: $pattern"
}

require_text .github/workflows/ci.yml 'release_source_sha:'
require_text .github/workflows/ci.yml 'ref: ${{ inputs.release_source_sha || github.sha }}'

require_text Dockerfile.frontend 'ARG STARTERIA_RELEASE_SHA'
require_text Dockerfile.frontend 'org.opencontainers.image.revision=$STARTERIA_RELEASE_SHA'
require_text Dockerfile.frontend '/usr/share/nginx/html/release.json'
require_text Dockerfile.backend 'ARG STARTERIA_RELEASE_SHA'
require_text Dockerfile.backend 'org.opencontainers.image.revision=$STARTERIA_RELEASE_SHA'
require_text ai-service/Dockerfile 'ARG STARTERIA_RELEASE_SHA'
require_text ai-service/Dockerfile 'org.opencontainers.image.revision=$STARTERIA_RELEASE_SHA'

require_text .github/workflows/cd.yml 'name: Generate immutable release manifest'
require_text .github/workflows/cd.yml 'name: Release parity E2E on immutable images'
require_text .github/workflows/cd.yml 'scripts/ci/run-release-parity-e2e.sh'
require_text .github/workflows/cd.yml 'starteria-backend@${BACKEND_DIGEST}'
require_text .github/workflows/cd.yml 'starteria-frontend@${FRONTEND_DIGEST}'
require_text .github/workflows/cd.yml 'starteria-ai-service@${AI_SERVICE_DIGEST}'
require_text .github/workflows/cd.yml 'PROD_UX_FAIL'
require_text scripts/ci/run-release-parity-e2e.sh '--network-alias mailpit'
require_text scripts/ci/run-release-parity-e2e.sh '--retries=0'
require_text scripts/ci/run-release-parity-e2e.sh 'release-parity-runtime'

for file in \
  scripts/ci/generate-release-manifest.mjs \
  scripts/ci/verify-release-manifest.mjs \
  scripts/ci/run-release-parity-e2e.sh; do
  [[ -f "$file" ]] || fail "missing $file"
done

tmp_dir=$(mktemp -d)
trap 'rm -rf -- "$tmp_dir"' EXIT
sha=17b3e4934d3fa58adbffc398222101b621b0c8bb
digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

node scripts/ci/generate-release-manifest.mjs \
  --output "$tmp_dir/release-manifest.json" \
  --source-sha "$sha" \
  --backend-image "example/starteria-backend@$digest" \
  --frontend-image "example/starteria-frontend@$digest" \
  --ai-service-image "example/starteria-ai-service@$digest" \
  --google-login-enabled true

node scripts/ci/verify-release-manifest.mjs \
  --manifest "$tmp_dir/release-manifest.json" \
  --source-sha "$sha" \
  --backend-image "example/starteria-backend@$digest" \
  --frontend-image "example/starteria-frontend@$digest" \
  --ai-service-image "example/starteria-ai-service@$digest"

node - "$tmp_dir/release-manifest.json" <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (manifest.schema !== 'starteria.release-manifest.v1') throw new Error('wrong schema');
if (!Array.isArray(manifest.migrations.inventory) || manifest.migrations.inventory.length < 1) {
  throw new Error('release manifest must enumerate required schema migrations');
}
if (manifest.migrations.requiredForRelease.length !== 2) throw new Error('release must bind exactly two migrations');
if (manifest.flags.frontend.VITE_PORTFOLIO_GOAL_E2_LEDGER_UI_ENABLED !== false) {
  throw new Error('experimental frontend E2 flag must remain off');
}
if (manifest.flags.frontend.VITE_GOOGLE_LOGIN_ENABLED !== true) throw new Error('Google login parity missing');
if (manifest.flags.backend.PORTFOLIO_GOAL_E2_LEDGER_ENABLED !== false) {
  throw new Error('experimental backend E2 flag must remain off');
}
if (manifest.flags.backend.HANDOFF_EMAIL_TRANSPORT_MODE !== 'disabled') {
  throw new Error('productive email transport must remain disabled');
}
if (!manifest.e2e.approvedSuites.includes('kan232-g5-home-final')) {
  throw new Error('E1-E7 suite missing');
}
if (!manifest.e2e.approvedSuites.includes('kan254-owner-handoff-acceptance')) {
  throw new Error('Owner Handoff suite missing');
}
if (manifest.e2e.testOverrides.HANDOFF_EMAIL_PILOT_ENABLED !== false) {
  throw new Error('isolated gate must keep the productive email pilot disabled');
}
NODE

echo 'release-parity contract: PASS'
