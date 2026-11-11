#!/usr/bin/env bash
set -Eeuo pipefail

: "${RELEASE_MANIFEST:?RELEASE_MANIFEST is required}"

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$repo_root"

source_sha=$(node -p "require(process.argv[1]).sourceSha" "$RELEASE_MANIFEST")
backend_image=$(node -p "require(process.argv[1]).images.backend" "$RELEASE_MANIFEST")
frontend_image=$(node -p "require(process.argv[1]).images.frontend" "$RELEASE_MANIFEST")
ai_image=$(node -p "require(process.argv[1]).images.aiService" "$RELEASE_MANIFEST")

[[ "$source_sha" =~ ^[a-f0-9]{40}$ ]] || { echo '::error::Invalid manifest source SHA'; exit 1; }
for image in "$backend_image" "$frontend_image" "$ai_image"; do
  [[ "$image" =~ @sha256:[a-f0-9]{64}$ ]] || { echo "::error::Mutable image reference: $image"; exit 1; }
done

suffix=$(printf '%s' "${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}" | tr -cd 'a-zA-Z0-9-')
prefix="starteria-parity-$suffix"
[[ "$prefix" =~ ^starteria-parity-[a-zA-Z0-9-]+$ ]] || { echo '::error::Unsafe parity resource prefix'; exit 1; }
network="$prefix"
postgres_container="$prefix-postgres"
mailpit_container="$prefix-mailpit"
ai_container="$prefix-ai"
backend_container="$prefix-backend"
frontend_container="$prefix-frontend"
runtime_dir=$(mktemp -d)
evidence_dir="$repo_root/front/test-results/release-parity-runtime"

dump_runtime_evidence() {
  mkdir -p "$evidence_dir"
  for container in "$frontend_container" "$backend_container" "$ai_container" "$mailpit_container" "$postgres_container"; do
    if docker inspect "$container" >/dev/null 2>&1; then
      docker logs "$container" > "$evidence_dir/$container.log" 2>&1 || true
      docker inspect "$container" | jq '[.[] | {Name, Config: {Image: .Config.Image, Labels: .Config.Labels}, State: {Status: .State.Status, ExitCode: .State.ExitCode, Health: .State.Health}, NetworkSettings: {Networks: .NetworkSettings.Networks, Ports: .NetworkSettings.Ports}}]' \
        > "$evidence_dir/$container.inspect.json" 2>&1 || true
    fi
  done
  cp "$runtime_dir"/*.json "$evidence_dir"/ 2>/dev/null || true
}

cleanup() {
  status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "::error::Release parity failed; runtime evidence saved under front/test-results/release-parity-runtime"
    dump_runtime_evidence
  fi
  docker rm -f "$frontend_container" "$backend_container" "$ai_container" "$mailpit_container" "$postgres_container" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf -- "$runtime_dir"
  return "$status"
}
trap cleanup EXIT

docker network create "$network" >/dev/null
docker run -d --name "$postgres_container" --network "$network" \
  -p 127.0.0.1:55433:5432 \
  -e POSTGRES_DB=postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  docker.io/library/postgres:16-alpine >/dev/null
docker run -d --name "$mailpit_container" --network "$network" --network-alias mailpit \
  -p 127.0.0.1:11025:1025 -p 127.0.0.1:18025:8025 \
  axllent/mailpit:v1.27.10@sha256:b1f1be18af530d939a11ee8820b379e0c88eeec204d904bfad68862adced3a5a >/dev/null

for _ in $(seq 1 60); do
  docker exec "$postgres_container" pg_isready -U postgres -d postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$postgres_container" pg_isready -U postgres -d postgres >/dev/null

export E2E_DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:55433/postgres
export E2E_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55433/starteria_e2e
export DATABASE_URL=$E2E_DATABASE_URL
(
  cd front
  npm run db:e2e:provision
  npm run db:e2e:migrate
)

docker pull "$backend_image" >/dev/null
docker pull "$frontend_image" >/dev/null
docker pull "$ai_image" >/dev/null

for image in "$backend_image" "$frontend_image" "$ai_image"; do
  revision=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")
  [[ "$revision" == "$source_sha" ]] || { echo "::error::Image revision mismatch for $image"; exit 1; }
done

docker run -d --name "$ai_container" --network "$network" -p 127.0.0.1:48001:8001 \
  -e ENVIRONMENT=test -e OPENROUTER_API_KEY=parity-not-a-secret -e JEV_API_KEY=parity-not-a-secret \
  "$ai_image" >/dev/null

docker run -d --name "$backend_container" --network "$network" --network-alias starteria-backend \
  -p 127.0.0.1:4100:3001 \
  -e NODE_ENV=production -e PORT=3001 \
  -e AUTH_DISABLE_WAITLIST=true -e AUTH_RATE_LIMIT_DISABLED=true \
  -e DATABASE_URL=postgresql://postgres:postgres@"$postgres_container":5432/starteria_e2e \
  -e JWT_SECRET='parity-JWT-2026-A1!b2@C3#d4$E5%f6&G7' \
  -e BRIDGE_SHARED_SECRET='parity-BRIDGE-2026-H8!i9@J0#k1$L2%m3' \
  -e AI_SERVICE_TOKEN='parity-AI-2026-N4!o5@P6#q7$R8%s9' \
  -e PILOT_CODE_SECRET='parity-PILOT-2026-T0!u1@V2#w3$X4%y5' \
  -e CORS_ORIGIN=http://127.0.0.1:5176 \
  -e AI_SERVICE_URL=http://"$ai_container":8001 \
  -e PORTFOLIO_ENTRY_RUNTIME_MODE=live \
  -e SEMANTIC_E1_ENABLED=false \
  -e PORTFOLIO_GOAL_E2_LEDGER_ENABLED=false \
  -e PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED=false \
  -e PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED=false \
  -e HANDOFF_EMAIL_TRANSPORT_MODE=sandbox \
  -e HANDOFF_EMAIL_PILOT_ENABLED=false \
  -e HANDOFF_INVITATION_PUBLIC_BASE_URL=http://127.0.0.1:5176 \
  -e SMTP_HOST=mailpit -e SMTP_PORT=1025 -e SMTP_SECURE=false \
  -e PILOT_LEAD_NOTIFY_FROM=sandbox@starteria.test \
  "$backend_image" >/dev/null

docker run -d --name "$frontend_container" --network "$network" \
  -p 127.0.0.1:5176:80 "$frontend_image" >/dev/null

bash scripts/ci/wait-for-http-health.sh http://127.0.0.1:4100/api/health 60 1
bash scripts/ci/wait-for-http-health.sh http://127.0.0.1:5176/release.json 60 1
bash scripts/ci/wait-for-http-health.sh http://127.0.0.1:48001/health 60 1

curl --fail --silent http://127.0.0.1:5176/release.json > "$runtime_dir/frontend-release.json"
curl --fail --silent http://127.0.0.1:4100/api/health > "$runtime_dir/backend-health.json"
curl --fail --silent http://127.0.0.1:48001/health > "$runtime_dir/ai-health.json"
node - "$RELEASE_MANIFEST" "$runtime_dir/frontend-release.json" "$runtime_dir/backend-health.json" "$runtime_dir/ai-health.json" <<'NODE'
const fs = require('node:fs');
const [manifestPath, frontPath, backPath, aiPath] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const front = JSON.parse(fs.readFileSync(frontPath, 'utf8'));
const back = JSON.parse(fs.readFileSync(backPath, 'utf8'));
const ai = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
if (front.sourceSha !== manifest.sourceSha) throw new Error('frontend SHA mismatch');
if (back.release?.sourceSha !== manifest.sourceSha) throw new Error('backend SHA mismatch');
if (ai.release?.sourceSha !== manifest.sourceSha) throw new Error('ai-service SHA mismatch');
for (const [name, value] of Object.entries(manifest.flags.frontend)) {
  if (front.flags?.[name] !== value) throw new Error(`frontend flag mismatch: ${name}`);
}
for (const [name, value] of Object.entries(manifest.flags.backend)) {
  if (name.startsWith('HANDOFF_EMAIL_')) continue;
  if (back.release.flags?.[name] !== value) throw new Error(`backend flag mismatch: ${name}`);
}
if (back.release.flags?.HANDOFF_EMAIL_TRANSPORT_MODE !== manifest.e2e.testOverrides.HANDOFF_EMAIL_TRANSPORT_MODE) {
  throw new Error('undeclared Handoff transport override');
}
if (back.release.flags?.HANDOFF_EMAIL_PILOT_ENABLED !== manifest.e2e.testOverrides.HANDOFF_EMAIL_PILOT_ENABLED) {
  throw new Error('undeclared Handoff pilot override');
}
NODE

(
  cd front
  E2E_BASE_URL=http://127.0.0.1:5176 \
  E2E_BACKEND_URL=http://127.0.0.1:4100 \
  E2E_MAILPIT_URL=http://127.0.0.1:18025 \
  E2E_WITH_MAILPIT=true \
  HANDOFF_EMAIL_TRANSPORT_MODE=sandbox \
  SEMANTIC_E1_ENABLED=false \
  DATABASE_URL="$E2E_DATABASE_URL" \
  npx playwright test \
    e2e/kan232-g5-home-final.spec.ts \
    e2e/kan254-owner-handoff-acceptance.spec.ts \
    --workers=1 \
    --retries=0
)

echo "Release parity E2E passed for $source_sha"
