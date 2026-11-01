#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly COMPOSE_FILE="${SCRIPT_DIR}/compose.yml"
readonly ENV_FILE="${1:-${SCRIPT_DIR}/preview.env}"

fail() {
  printf 'KAN187_PREFLIGHT_NO_GO: %s\n' "$1" >&2
  exit 1
}

env_value() {
  local key="$1"
  awk -F= -v wanted="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 == wanted {
      sub(/^[^=]*=/, "");
      print;
      exit;
    }
  ' "$ENV_FILE"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

require_value() {
  local key="$1"
  local value
  value="$(env_value "$key")"
  [[ -n "$value" ]] || fail "$key is missing"
  [[ ! "$value" =~ (REPLACE_WITH|example\.invalid) ]] || fail "$key still contains a placeholder"
  printf '%s' "$value"
}

valid_ipv4() {
  local address="$1"
  local octet
  local -a octets
  IFS='.' read -r -a octets <<<"$address"
  (( ${#octets[@]} == 4 )) || return 1
  for octet in "${octets[@]}"; do
    [[ "$octet" =~ ^[0-9]{1,3}$ ]] || return 1
    (( 10#$octet <= 255 )) || return 1
  done
}

public_ipv4() {
  local address="$1"
  local -a octets
  IFS='.' read -r -a octets <<<"$address"
  local first=$((10#${octets[0]}))
  local second=$((10#${octets[1]}))
  local third=$((10#${octets[2]}))
  (( first != 0 && first != 10 && first != 127 && first < 224 )) || return 1
  ! (( first == 100 && second >= 64 && second <= 127 )) || return 1
  ! (( first == 169 && second == 254 )) || return 1
  ! (( first == 172 && second >= 16 && second <= 31 )) || return 1
  ! (( first == 192 && second == 168 )) || return 1
  ! (( first == 192 && second == 0 && third == 2 )) || return 1
  ! (( first == 198 && (second == 18 || second == 19) )) || return 1
  ! (( first == 198 && second == 51 && third == 100 )) || return 1
  ! (( first == 203 && second == 0 && third == 113 )) || return 1
}

[[ -f "$ENV_FILE" ]] || fail "environment file not found: $ENV_FILE"
require_command docker
require_command getent
require_command awk
require_command grep
require_command id
require_command stat

[[ ! -L "$ENV_FILE" ]] || fail 'preview.env must not be a symbolic link'
env_mode="$(stat -c '%a' "$ENV_FILE")"
[[ "$env_mode" == '600' ]] || fail 'preview.env permissions must be 0600'
env_owner="$(stat -c '%u' "$ENV_FILE")"
[[ "$env_owner" == "$(id -u)" ]] || fail 'preview.env must be owned by the current operator'

docker info >/dev/null 2>&1 || fail 'Docker daemon is unavailable'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is unavailable'

host="$(require_value PREVIEW_HOST)"
expected_ipv4="$(require_value PREVIEW_EXPECTED_IPV4)"
allowed_cidr="$(require_value PREVIEW_ALLOWED_CIDR)"
[[ "$host" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$ ]] || fail 'PREVIEW_HOST must be a DNS hostname'
[[ "$host" != 'starter-ia.com' && "$host" != 'www.starter-ia.com' ]] || fail 'production hostname is forbidden'
valid_ipv4 "$expected_ipv4" || fail 'PREVIEW_EXPECTED_IPV4 must be an IPv4 address'
public_ipv4 "$expected_ipv4" || fail 'PREVIEW_EXPECTED_IPV4 must be a public IPv4 address'
[[ "$allowed_cidr" =~ ^([^/]+)/32$ ]] || fail 'PREVIEW_ALLOWED_CIDR must authorize exactly one public IPv4 (/32)'
allowed_ipv4="${BASH_REMATCH[1]}"
valid_ipv4 "$allowed_ipv4" || fail 'PREVIEW_ALLOWED_CIDR must contain a valid IPv4 address'
public_ipv4 "$allowed_ipv4" || fail 'PREVIEW_ALLOWED_CIDR must contain a public IPv4 address'
[[ "$allowed_cidr" != '192.0.2.1/32' ]] || fail 'PREVIEW_ALLOWED_CIDR still contains the documentation address'

mapfile -t resolved_ipv4 < <(getent ahostsv4 "$host" | awk '{ print $1 }' | awk '!seen[$0]++')
(( ${#resolved_ipv4[@]} == 1 )) || fail 'PREVIEW_HOST must resolve to exactly one IPv4 address'
[[ "${resolved_ipv4[0]}" == "$expected_ipv4" ]] || fail 'PREVIEW_HOST does not resolve exclusively to PREVIEW_EXPECTED_IPV4'

secret_keys=(
  PREVIEW_DB_PASSWORD
  PREVIEW_JWT_SECRET
  PREVIEW_BRIDGE_SHARED_SECRET
  PREVIEW_AI_SERVICE_TOKEN
  PREVIEW_BILLING_WEBHOOK_SECRET
  PREVIEW_PILOT_CODE_SECRET
)
secret_values=()
for key in "${secret_keys[@]}"; do
  value="$(require_value "$key")"
  (( ${#value} >= 32 )) || fail "$key must contain at least 32 characters"
  secret_values+=("$value")
done

password_keys=(PREVIEW_LEAD_PASSWORD PREVIEW_OWNER_PASSWORD PREVIEW_MEMBER_PASSWORD)
password_values=()
for key in "${password_keys[@]}"; do
  value="$(require_value "$key")"
  (( ${#value} >= 12 )) || fail "$key must contain at least 12 characters"
  password_values+=("$value")
done
sensitive_values=("${secret_values[@]}" "${password_values[@]}")
for ((i = 0; i < ${#sensitive_values[@]}; i++)); do
  for ((j = i + 1; j < ${#sensitive_values[@]}; j++)); do
    [[ "${sensitive_values[$i]}" != "${sensitive_values[$j]}" ]] || fail 'all preview secrets and synthetic passwords must be independent'
  done
done
unset secret_values password_values sensitive_values value

[[ "$(require_value HANDOFF_EMAIL_TRANSPORT_MODE)" == 'sandbox' ]] || fail 'Handoff email must use the Mailpit sandbox'
[[ "$(require_value HANDOFF_EMAIL_PILOT_ENABLED)" == 'false' ]] || fail 'external pilot email must remain disabled'
[[ "$(require_value SMTP_HOST)" == 'mailpit' ]] || fail 'SMTP must point only to the private Mailpit service'

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet \
  || fail 'Docker Compose configuration is invalid'

mem_total="$(docker info --format '{{.MemTotal}}')"
[[ "$mem_total" =~ ^[0-9]+$ ]] || fail 'could not read Docker memory capacity'
(( mem_total >= 3221225472 )) || fail 'Docker requires at least 3 GiB of available capacity'

printf 'KAN187_PREFLIGHT_GO host=%s expected_ipv4=%s ingress_cidr_configured=true billing=false external_email=false runtime=deterministic\n' \
  "$host" "$expected_ipv4"
