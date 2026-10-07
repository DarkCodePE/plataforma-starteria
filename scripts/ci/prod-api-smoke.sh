#!/usr/bin/env bash
# Smoke con sesión contra la API de producción, con el Portfolio Lead dedicado de E2E
# (docs/e2e-job-driven/prod-dedicated-user.md). Sólo GET; no escribe nada.
#
# Existe porque /api/health no toca la base: del 2026-09-25 al 2026-10-07 dio 200 mientras el
# portafolio respondía 500.
#
# Requiere E2E_PROD_LEAD_PASSWORD. Opcionales: E2E_PROD_LEAD_EMAIL, E2E_PROD_BASE_URL.
set -euo pipefail

base="${E2E_PROD_BASE_URL:-https://starter-ia.com}"
email="${E2E_PROD_LEAD_EMAIL:-e2e-lead@starteria.test}"
: "${E2E_PROD_LEAD_PASSWORD:?E2E_PROD_LEAD_PASSWORD requerida}"

body=$(jq -nc --arg e "$email" --arg p "$E2E_PROD_LEAD_PASSWORD" '{email:$e,password:$p}')
resp=$(curl -sS --max-time 20 -w '\n%{http_code}' -H 'Content-Type: application/json' -d "$body" "$base/api/v1/auth/login")
code=$(tail -n1 <<<"$resp")
[ "$code" = 200 ] || { echo "::error::login del usuario E2E respondió $code"; exit 1; }
token=$(head -n -1 <<<"$resp" | jq -er '.data.accessToken') || { echo "::error::login sin accessToken (¿usuario en waitlist?)"; exit 1; }
echo "::add-mask::$token"

failed=0
for path in /api/v1/portfolio/strategic-fronts /api/v1/portfolio/home /api/v1/portfolio/capacity /api/v1/projects; do
  code=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$base$path")
  echo "$code $path"
  [ "$code" = 200 ] || failed=1
done
[ "$failed" = 0 ] || { echo "::error::algún endpoint de portafolio no respondió 200"; exit 1; }
