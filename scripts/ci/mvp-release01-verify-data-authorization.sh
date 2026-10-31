#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_ACTOR:?GITHUB_ACTOR is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${AUTHORIZATION_ISSUE:?AUTHORIZATION_ISSUE is required}"
: "${AUTHORIZATION_REF:?AUTHORIZATION_REF is required}"
: "${DATA_APPROVER_LOGIN:?DATA_APPROVER_LOGIN is required}"
: "${RECIPIENT_CERT_SHA256:?RECIPIENT_CERT_SHA256 is required}"

CURL_BIN="${CURL_BIN:-curl}"
JQ_BIN="${JQ_BIN:-jq}"
api_url="${GITHUB_API_URL:-https://api.github.com}"

[[ "$AUTHORIZATION_ISSUE" =~ ^[1-9][0-9]*$ ]] || { echo '::error::Authorization issue must be numeric.' >&2; exit 1; }
[[ "$AUTHORIZATION_REF" =~ ^MVPREL01-[A-Z0-9][A-Z0-9-]{5,63}$ ]] \
  || { echo '::error::Authorization reference must match MVPREL01-*.' >&2; exit 1; }
[[ "$RECIPIENT_CERT_SHA256" =~ ^[a-f0-9]{64}$ ]] || { echo '::error::Invalid recipient fingerprint.' >&2; exit 1; }
[[ "${GITHUB_ACTOR,,}" != "${DATA_APPROVER_LOGIN,,}" ]] \
  || { echo '::error::The operator and data approver must be different GitHub identities.' >&2; exit 1; }

work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT
issue_json="$work_dir/issue.json"
comments_json="$work_dir/comments.json"

api_get() {
  local path=$1
  local output=$2
  "$CURL_BIN" --fail-with-body --silent --show-error \
    --header "Authorization: Bearer $GITHUB_TOKEN" \
    --header 'Accept: application/vnd.github+json' \
    --header 'X-GitHub-Api-Version: 2022-11-28' \
    --output "$output" \
    "$api_url/repos/$GITHUB_REPOSITORY/$path"
}

api_get "issues/$AUTHORIZATION_ISSUE" "$issue_json"
api_get "issues/$AUTHORIZATION_ISSUE/comments?per_page=100" "$comments_json"

"$JQ_BIN" -e '.state == "open" and (has("pull_request") | not)' "$issue_json" >/dev/null \
  || { echo '::error::Authorization must reference an open issue, not a pull request.' >&2; exit 1; }

# jq variables below are intentionally expanded by jq.
# shellcheck disable=SC2016
match=$("$JQ_BIN" -c \
  --arg approver "${DATA_APPROVER_LOGIN,,}" \
  --arg ref "$AUTHORIZATION_REF" \
  --arg operator "${GITHUB_ACTOR,,}" \
  --arg sha "$GITHUB_SHA" \
  --arg cert "$RECIPIENT_CERT_SHA256" '
    [ .[]
      | select((.user.login | ascii_downcase) == $approver)
      | . as $comment
      | (try (.body | fromjson) catch null) as $approval
      | select($approval != null)
      | select($approval.schema == "starteria.mvp-release01.data-copy-authorization.v1")
      | select($approval.approved == true)
      | select($approval.authorization_ref == $ref)
      | select(($approval.operator | ascii_downcase) == $operator)
      | select($approval.purpose == "MVP_RELEASE_01_PRODUCTION_CLONE_REHEARSAL")
      | select($approval.source_database == "starteria_db")
      | select($approval.channel == "GITHUB_ACTIONS_ENCRYPTED_ARTIFACT")
      | select($approval.retention_hours == 24)
      | select($approval.destruction_required == true)
      | select($approval.source_sha == $sha)
      | select($approval.recipient_certificate_sha256 == $cert)
      | select(($approval.valid_until_utc | type) == "string")
      | {comment_id: $comment.id, valid_until_utc: $approval.valid_until_utc}
    ] | last // empty
  ' "$comments_json")

[[ -n "$match" ]] || { echo '::error::No matching structured approval from the configured data approver.' >&2; exit 1; }
comment_id=$("$JQ_BIN" -r '.comment_id' <<<"$match")
valid_until=$("$JQ_BIN" -r '.valid_until_utc' <<<"$match")
valid_until_epoch=$(date -u -d "$valid_until" +%s 2>/dev/null) \
  || { echo '::error::Approval valid_until_utc is invalid.' >&2; exit 1; }
now_epoch=$(date -u +%s)
(( valid_until_epoch > now_epoch )) || { echo '::error::Data-copy approval has expired.' >&2; exit 1; }
(( valid_until_epoch <= now_epoch + 86400 )) \
  || { echo '::error::Data-copy approval window must not exceed 24 hours.' >&2; exit 1; }

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'comment_id=%s\n' "$comment_id" >> "$GITHUB_OUTPUT"
  printf 'valid_until_utc=%s\n' "$valid_until" >> "$GITHUB_OUTPUT"
fi
echo "Structured data-owner approval verified; comment ID: $comment_id"
