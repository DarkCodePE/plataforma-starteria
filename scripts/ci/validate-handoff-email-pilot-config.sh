#!/usr/bin/env bash
set -euo pipefail

error() {
  echo "::error::$1" >&2
  exit 1
}

value() {
  local name="$1"
  printf '%s' "${!name-}"
}

require_value() {
  local name="$1" current trimmed
  current=$(value "$name")
  [[ -n "$current" ]] || error "Missing required Handoff pilot setting: $name"
  trimmed=$(printf '%s' "$current" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [[ "$current" == "$trimmed" ]] || error "$name must not contain leading or trailing whitespace"
  printf '%s' "$current"
}

normalize_mailbox() {
  local raw="$1" mailbox
  mailbox=$(printf '%s' "$raw" | sed -E 's/.*<([^<>]+)>[[:space:]]*$/\1/' | tr '[:upper:]' '[:lower:]')
  [[ "$mailbox" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || return 1
  printf '%s' "$mailbox"
}

csv_is_singleton() {
  local csv="$1" expected="$2" item
  IFS=',' read -r -a items <<<"$csv"
  [[ "${#items[@]}" -eq 1 ]] || return 1
  for item in "${items[@]}"; do
    item=$(printf '%s' "$item" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')
    [[ "$item" == "${expected,,}" ]] && return 0
  done
  return 1
}

positive_integer() {
  local name="$1" current
  current=$(require_value "$name")
  [[ "$current" =~ ^[0-9]+$ && "$current" -ge 1 ]] || error "$name must be a positive integer"
  printf '%s' "$current"
}

non_negative_integer() {
  local name="$1" current
  current=$(require_value "$name")
  [[ "$current" =~ ^[0-9]+$ ]] || error "$name must be a non-negative integer"
  printf '%s' "$current"
}

mode="${HANDOFF_EMAIL_TRANSPORT_MODE:-disabled}"
pilot_enabled="${HANDOFF_EMAIL_PILOT_ENABLED:-false}"
case "$pilot_enabled" in true|false) ;; *) error 'HANDOFF_EMAIL_PILOT_ENABLED must be true or false' ;; esac

case "$mode" in
  disabled)
    [[ "$pilot_enabled" == false ]] || error 'Pilot kill switch must remain false while transport mode is disabled'
    echo 'Handoff email production gate: mode=disabled; no external delivery authorized.'
    exit 0
    ;;
  sandbox)
    error 'Sandbox/Mailpit transport is not valid for the production environment'
    ;;
  pilot) ;;
  *) error 'HANDOFF_EMAIL_TRANSPORT_MODE must be disabled or pilot in production' ;;
esac

[[ "$pilot_enabled" == true ]] || error 'Pilot mode requires the independent pilot kill switch'

smtp_host=$(require_value SMTP_HOST)
require_value SMTP_USER >/dev/null
require_value SMTP_PASS >/dev/null
sender_raw=$(require_value PILOT_LEAD_NOTIFY_FROM)
verified_raw=$(require_value HANDOFF_EMAIL_PILOT_VERIFIED_FROM)
reply_to_raw=$(require_value HANDOFF_EMAIL_REPLY_TO)
public_base_url=$(require_value HANDOFF_INVITATION_PUBLIC_BASE_URL)
recipient_allowlist=$(require_value HANDOFF_EMAIL_PILOT_RECIPIENT_ALLOWLIST)
organization_allowlist=$(require_value HANDOFF_EMAIL_PILOT_ORGANIZATION_ALLOWLIST)
actor_allowlist=$(require_value HANDOFF_EMAIL_PILOT_ACTOR_ALLOWLIST)
owner_email_raw=$(require_value E2E_PROD_OWNER_EMAIL)
lead_actor_id=$(require_value E2E_PROD_LEAD_ACTOR_ID)

case "${smtp_host,,}" in
  localhost|localhost:*|127.*|::1|mailpit|mailpit:*|host.docker.internal|host.docker.internal:*)
    error 'Pilot SMTP host must be external'
    ;;
esac

sender=$(normalize_mailbox "$sender_raw") || error 'PILOT_LEAD_NOTIFY_FROM must contain a valid mailbox'
verified_sender=$(normalize_mailbox "$verified_raw") || error 'HANDOFF_EMAIL_PILOT_VERIFIED_FROM must be a valid mailbox'
reply_to=$(normalize_mailbox "$reply_to_raw") || error 'HANDOFF_EMAIL_REPLY_TO must be a valid mailbox'
owner_email=$(normalize_mailbox "$owner_email_raw") || error 'E2E_PROD_OWNER_EMAIL must be a valid mailbox'

[[ "$sender" == "$verified_sender" ]] || error 'Configured sender must exactly match the verified sender mailbox'
case "${sender##*@}" in gmail.com|googlemail.com|outlook.com|hotmail.com|live.com|yahoo.com) error 'Pilot sender must use an organizational mailbox' ;; esac
case "${reply_to##*@}" in gmail.com|googlemail.com|outlook.com|hotmail.com|live.com|yahoo.com) error 'Pilot reply-to must use an organizational mailbox' ;; esac
case "${owner_email##*@}" in starteria.test|*.test|*.invalid|*.localhost|*.example) error 'E2E_PROD_OWNER_EMAIL must be an externally deliverable authorized mailbox' ;; esac

production_base_url="${PRODUCTION_BASE_URL:-https://starter-ia.com}"
[[ "${public_base_url%/}" == "${production_base_url%/}" ]] \
  || error 'Handoff invitation URL must exactly match the approved production origin'
[[ "$public_base_url" == https://* ]] || error 'Handoff invitation URL must use HTTPS'

csv_is_singleton "$recipient_allowlist" "$owner_email" || error 'Recipient allowlist must contain only the authorized Owner mailbox'
csv_is_singleton "$organization_allowlist" 'org-e2e-prod' || error 'Organization allowlist must contain only the synthetic production tenant'
csv_is_singleton "$actor_allowlist" "$lead_actor_id" || error 'Actor allowlist must contain only the authorized Portfolio Lead actor'

max_sends=$(positive_integer HANDOFF_EMAIL_PILOT_MAX_SENDS_PER_WINDOW)
window_seconds=$(positive_integer HANDOFF_EMAIL_PILOT_WINDOW_SECONDS)
min_interval=$(non_negative_integer HANDOFF_EMAIL_PILOT_MIN_INTERVAL_SECONDS)
ttl_hours=$(positive_integer HANDOFF_INVITATION_TTL_HOURS)
[[ "$max_sends" -le 2 ]] || error 'Pilot send window must allow at most two sends'
[[ "$window_seconds" -ge 60 ]] || error 'Pilot send window must be at least 60 seconds'
[[ "$min_interval" -ge 30 ]] || error 'Pilot sends must be separated by at least 30 seconds'
[[ "$ttl_hours" -le 168 ]] || error 'Pilot invitation TTL must not exceed 168 hours'

echo 'Handoff email production gate: mode=pilot; restricted sender, origin, tenant, actor and recipient checks passed.'
