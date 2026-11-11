#!/usr/bin/env bash
set -Eeuo pipefail

: "${RELEASE_MANIFEST:?RELEASE_MANIFEST is required}"
NAMESPACE=${NAMESPACE:-starteria}
PRODUCTION_BASE_URL=${PRODUCTION_BASE_URL:-https://starter-ia.com}

source_sha=$(node -p "require(process.argv[1]).sourceSha" "$RELEASE_MANIFEST")

for svc in backend frontend ai-service; do
  manifest_key=$svc
  [[ "$svc" == ai-service ]] && manifest_key=aiService
  expected_image=$(node -p "require(process.argv[1]).images[process.argv[2]]" "$RELEASE_MANIFEST" "$manifest_key")
  actual_spec=$(kubectl -n "$NAMESPACE" get "deployment/starteria-$svc" \
    -o "jsonpath={.spec.template.spec.containers[?(@.name=='$svc')].image}")
  [[ "$actual_spec" == "$expected_image" ]] \
    || { echo "::error::$svc deployment spec is not pinned to the certified digest"; exit 1; }
  pods_match=false
  for _ in $(seq 1 12); do
    pod_specs=$(kubectl -n "$NAMESPACE" get pods -l "app=starteria-$svc" \
      -o "jsonpath={range .items[*]}{.metadata.name}{'='}{.spec.containers[?(@.name=='$svc')].image}{'\n'}{end}")
    [[ -n "$pod_specs" ]] || { sleep 5; continue; }
    pods_match=true
    while IFS='=' read -r pod image; do
      if [[ -z "$pod" || "$image" != "$expected_image" ]]; then pods_match=false; break; fi
    done <<< "$pod_specs"
    [[ "$pods_match" == true ]] && break
    sleep 5
  done
  [[ "$pods_match" == true ]] \
    || { echo "::error::$svc has a pod outside the certified image reference after rollout"; exit 1; }
  actual_ids=$(kubectl -n "$NAMESPACE" get pods -l "app=starteria-$svc" \
    -o "jsonpath={range .items[*]}{range .status.containerStatuses[?(@.name=='$svc')]}{.imageID}{'\n'}{end}{end}")
  [[ -n "$actual_ids" ]] || { echo "::error::No runtime imageID found for $svc"; exit 1; }
  printf '%s runtime imageID(s): %s\n' "$svc" "$actual_ids"
done

runtime_dir=$(mktemp -d)
trap 'rm -rf -- "$runtime_dir"' EXIT
curl --fail --silent --show-error "$PRODUCTION_BASE_URL/release.json" > "$runtime_dir/frontend.json"
curl --fail --silent --show-error "$PRODUCTION_BASE_URL/api/health" > "$runtime_dir/backend.json"
kubectl -n "$NAMESPACE" exec deployment/starteria-ai-service -- \
  python -c "import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen('http://127.0.0.1:8001/health'))))" \
  > "$runtime_dir/ai.json"

node - "$RELEASE_MANIFEST" "$runtime_dir/frontend.json" "$runtime_dir/backend.json" "$runtime_dir/ai.json" <<'NODE'
const fs = require('node:fs');
const [manifestPath, frontPath, backPath, aiPath] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const front = JSON.parse(fs.readFileSync(frontPath, 'utf8'));
const back = JSON.parse(fs.readFileSync(backPath, 'utf8'));
const ai = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
for (const [service, actual] of [['frontend', front.sourceSha], ['backend', back.release?.sourceSha], ['ai-service', ai.release?.sourceSha]]) {
  if (actual !== manifest.sourceSha) throw new Error(`${service} runtime SHA mismatch`);
}
for (const [name, expected] of Object.entries(manifest.flags.frontend)) {
  if (front.flags?.[name] !== expected) throw new Error(`frontend runtime flag mismatch: ${name}`);
}
for (const [name, expected] of Object.entries(manifest.flags.backend)) {
  if (back.release?.flags?.[name] !== expected) throw new Error(`backend runtime flag mismatch: ${name}`);
}
NODE

echo "Deployed release verified: $source_sha"
