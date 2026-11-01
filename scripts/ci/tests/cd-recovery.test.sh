#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
validator="$repo_root/scripts/ci/validate-production-secrets.sh"
syncer="$repo_root/scripts/ci/sync-backend-secret.sh"
waiter="$repo_root/scripts/ci/wait-for-http-health.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

export STARTERIA_JWT_SECRET='jwt-A7f9!qL2-sM4_vN6+xP8&zR0*bcD-2026'
export STARTERIA_BRIDGE_SHARED_SECRET='bridge-B8g0@rM3-tN5_vP7+xQ9&za1*-2026'
export STARTERIA_AI_SERVICE_TOKEN='ai-C9h1#sN4-vP6_xQ8+yR0*zb2@Lm7!Qx-2026'
export STARTERIA_BILLING_WEBHOOK_SECRET='billing-D0j2-tP5_xQ7+yR9*zA1@bc3#-2026'
export STARTERIA_PILOT_CODE_SECRET='pilot-E1k3%uQ6&yR8*zA0@bc2#de4$-2026'

bash "$validator" >/dev/null

export BILLING_WEBHOOKS_ENABLED=false
saved_billing=$STARTERIA_BILLING_WEBHOOK_SECRET
unset STARTERIA_BILLING_WEBHOOK_SECRET
bash "$validator" >/dev/null
export BILLING_WEBHOOKS_ENABLED=true
if bash "$validator" >/dev/null 2>&1; then
  echo 'validator accepted missing billing secret with webhooks enabled' >&2
  exit 1
fi
export STARTERIA_BILLING_WEBHOOK_SECRET=$saved_billing
bash "$validator" >/dev/null
export BILLING_WEBHOOKS_ENABLED=false

saved_pilot=$STARTERIA_PILOT_CODE_SECRET
unset STARTERIA_PILOT_CODE_SECRET
if bash "$validator" >/dev/null 2>&1; then
  echo 'validator accepted a missing pilot secret' >&2
  exit 1
fi
export STARTERIA_PILOT_CODE_SECRET=$saved_pilot

export STARTERIA_PILOT_CODE_SECRET=$STARTERIA_BILLING_WEBHOOK_SECRET
# An unused billing key does not participate in the disabled-webhooks security contract.
bash "$validator" >/dev/null
export BILLING_WEBHOOKS_ENABLED=true
if bash "$validator" >/dev/null 2>&1; then
  echo 'validator accepted dependent billing and pilot secrets with webhooks enabled' >&2
  exit 1
fi
export BILLING_WEBHOOKS_ENABLED=false
export STARTERIA_PILOT_CODE_SECRET=$saved_pilot

export STARTERIA_PILOT_CODE_SECRET='xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
if bash "$validator" >/dev/null 2>&1; then
  echo 'validator accepted a repetitive pilot secret' >&2
  exit 1
fi
export STARTERIA_PILOT_CODE_SECRET=$saved_pilot

export BILLING_WEBHOOKS_ENABLED=true
export STARTERIA_BILLING_WEBHOOK_SECRET='REPLACE_WITH_SECRET-0123456789-abcdef'
if bash "$validator" >/dev/null 2>&1; then
  echo 'validator accepted a placeholder billing secret' >&2
  exit 1
fi
export STARTERIA_BILLING_WEBHOOK_SECRET=$saved_billing

export STARTERIA_BILLING_WEBHOOK_SECRET=" $saved_billing "
if bash "$validator" >/dev/null 2>&1; then
  echo 'validator accepted leading or trailing whitespace' >&2
  exit 1
fi
export STARTERIA_BILLING_WEBHOOK_SECRET=$saved_billing
export BILLING_WEBHOOKS_ENABLED=false

export DATABASE_URL='postgresql://synthetic:synthetic@clone.invalid:5432/synthetic'
export JWT_SECRET=$STARTERIA_JWT_SECRET
export AI_SERVICE_TOKEN=$STARTERIA_AI_SERVICE_TOKEN
export BRIDGE_SHARED_SECRET=$STARTERIA_BRIDGE_SHARED_SECRET
export BILLING_WEBHOOK_SECRET=$STARTERIA_BILLING_WEBHOOK_SECRET
export PILOT_CODE_SECRET=$STARTERIA_PILOT_CODE_SECRET
export PORTFOLIO_ENTRY_API_KEY='synthetic-portfolio-key'
export JEV_API_KEY='synthetic-jev-key'
export GOOGLE_CLIENT_ID='synthetic-google-client'
export KUBECTL_CAPTURE_DIR=$tmp

cat > "$tmp/kubectl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *' get secret '* ]]; then
  printf 'secret/starteria-backend-secrets\n'
  exit 0
fi
if [[ " $* " == *' patch secret '* ]]; then
  cat > "$KUBECTL_CAPTURE_DIR/patch.json"
  exit 0
fi
echo "unexpected kubectl invocation" >&2
exit 1
EOF
chmod +x "$tmp/kubectl"
KUBECTL_BIN="$tmp/kubectl" bash "$syncer" >/dev/null

jq -e '.data.BILLING_WEBHOOKS_ENABLED == "ZmFsc2U=" and .data.PILOT_CODE_SECRET and (.data.BILLING_WEBHOOK_SECRET | not) and (.data.UNKNOWN_EXISTING_KEY | not)' "$tmp/patch.json" >/dev/null
export BILLING_WEBHOOKS_ENABLED=true
KUBECTL_BIN="$tmp/kubectl" bash "$syncer" >/dev/null
jq -e '.data.BILLING_WEBHOOK_SECRET and .data.BILLING_WEBHOOKS_ENABLED == "dHJ1ZQ=="' "$tmp/patch.json" >/dev/null
export BILLING_WEBHOOKS_ENABLED=false
merged=$(jq -n --slurpfile patch "$tmp/patch.json" '{data:{UNKNOWN_EXISTING_KEY:"cHJlc2VydmU="}} * $patch[0]')
printf '%s' "$merged" | jq -e '.data.UNKNOWN_EXISTING_KEY == "cHJlc2VydmU="' >/dev/null

cat > "$tmp/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
count=0
[[ ! -f "$KUBECTL_CAPTURE_DIR/curl-count" ]] || count=$(cat "$KUBECTL_CAPTURE_DIR/curl-count")
count=$((count + 1))
printf '%s' "$count" > "$KUBECTL_CAPTURE_DIR/curl-count"
if (( count < 3 )); then printf '503'; else printf '200'; fi
EOF
chmod +x "$tmp/curl"
CURL_BIN="$tmp/curl" SLEEP_BIN=true bash "$waiter" https://synthetic.invalid/health 3 0 >/dev/null
[[ $(cat "$tmp/curl-count") == 3 ]]

rm -f "$tmp/curl-count"
cat > "$tmp/curl" <<'EOF'
#!/usr/bin/env bash
printf '503'
EOF
chmod +x "$tmp/curl"
if CURL_BIN="$tmp/curl" SLEEP_BIN=true bash "$waiter" https://synthetic.invalid/health 2 0 >/dev/null 2>&1; then
  echo 'bounded health check accepted persistent 503' >&2
  exit 1
fi

grep -q 'STARTERIA_BILLING_WEBHOOK_SECRET' "$repo_root/.github/workflows/cd.yml"
grep -q 'STARTERIA_PILOT_CODE_SECRET' "$repo_root/.github/workflows/cd.yml"
grep -q 'startupProbe:' "$repo_root/k8s/backend-deployment.yaml"
grep -q 'readinessProbe:' "$repo_root/k8s/backend-deployment.yaml"
if grep -q 'Restore previous images on rollout failure' "$repo_root/.github/workflows/cd.yml"; then
  echo 'automatic image rollback is still present' >&2
  exit 1
fi

echo 'CD recovery guard tests passed.'
