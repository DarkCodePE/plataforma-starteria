#!/usr/bin/env bash
# Authenticated, read-only smoke against the isolated E2E staging target.
# Unlike prod-api-smoke.sh, a target URL is mandatory: this script has no production fallback.
set -euo pipefail

: "${E2E_PROD_BASE_URL:?E2E_PROD_BASE_URL is required}"
: "${E2E_PROD_LEAD_PASSWORD:?E2E_PROD_LEAD_PASSWORD is required}"

base="${E2E_PROD_BASE_URL%/}"
email="${E2E_PROD_LEAD_EMAIL:-e2e-lead@starteria.test}"
[[ "$base" == https://* ]] || { echo "E2E_PROD_BASE_URL must use https" >&2; exit 2; }

body=$(jq -nc --arg e "$email" --arg p "$E2E_PROD_LEAD_PASSWORD" '{email:$e,password:$p}')
resp=$(curl -sS --max-time 20 -w '\n%{http_code}' -H 'Content-Type: application/json' -d "$body" "$base/api/v1/auth/login")
code=$(tail -n1 <<<"$resp")
[ "$code" = 200 ] || { echo "::error::staging E2E lead login returned $code"; exit 1; }
token=$(head -n -1 <<<"$resp" | jq -er '.data.accessToken') || { echo "::error::login response lacks accessToken"; exit 1; }
echo "::add-mask::$token"

failed=0
for path in /api/v1/portfolio/strategic-fronts /api/v1/portfolio/home /api/v1/portfolio/capacity /api/v1/projects; do
  code=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$base$path")
  echo "$code $path"
  [ "$code" = 200 ] || failed=1
done
[ "$failed" = 0 ] || { echo "::error::one or more staging portfolio endpoints did not return 200"; exit 1; }
