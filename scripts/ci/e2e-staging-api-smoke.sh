#!/usr/bin/env bash
# Authenticated API smoke for the isolated, publicly reachable P12 environment.
set -euo pipefail

base="${E2E_PROD_BASE_URL:-}"
email="${E2E_PROD_LEAD_EMAIL:-e2e-lead@starteria.test}"
: "${E2E_PROD_LEAD_PASSWORD:?E2E_PROD_LEAD_PASSWORD is required}"

node -e '
  const u = new URL(process.argv[1]);
  const host = u.hostname.toLowerCase();
  const privateHost = host === "localhost" || host === "127.0.0.1"
    || host === "starter-ia.com" || host.endsWith(".starter-ia.com")
    || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (u.protocol !== "https:" || u.username || u.password || privateHost) process.exit(1);
' "$base" || { echo "::error::refusing production URL or unsafe staging URL" >&2; exit 1; }
base="${base%/}"

health=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$base/api/health")
[[ "$health" == 200 ]] || { echo "::error::staging health returned $health" >&2; exit 1; }

body=$(jq -nc --arg email "$email" --arg password "$E2E_PROD_LEAD_PASSWORD" '{email:$email,password:$password}')
response=$(curl -sS --max-time 20 -w '\n%{http_code}' -H 'Content-Type: application/json' -d "$body" "$base/api/v1/auth/login")
status=$(tail -n1 <<<"$response")
[[ "$status" == 200 ]] || { echo "::error::synthetic lead login returned $status" >&2; exit 1; }
token=$(head -n -1 <<<"$response" | jq -er '.data.accessToken // .data.tokens.accessToken')
echo "::add-mask::$token"

me=$(curl -sS --max-time 20 -H "Authorization: Bearer $token" "$base/api/v1/auth/me")
jq -e '
  (.data.user // .data // .user // .) as $u
  | (($u.roles // [$u.role]) | index("portfolio_lead")) != null
  and (($u.permissions // []) | index("portfolio:read")) != null
  and (($u.permissions // []) | index("portfolio:write")) != null
' <<<"$me" >/dev/null || { echo "::error::synthetic lead lacks effective portfolio access" >&2; exit 1; }

failed=0
for endpoint in \
  /api/v1/portfolio/strategic-fronts \
  /api/v1/portfolio/home \
  /api/v1/portfolio/capacity \
  /api/v1/projects; do
  code=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$base$endpoint")
  echo "$code $endpoint"
  [[ "$code" == 200 ]] || failed=1
done
[[ "$failed" == 0 ]] || { echo "::error::one or more staging API reads failed" >&2; exit 1; }

echo "isolated E2E staging API smoke passed"
