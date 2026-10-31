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
      | select(($approval.clone_destroy_by_utc | type) == "string")
      | {
          comment_id: $comment.id,
          created_at_utc: $comment.created_at,
          updated_at_utc: $comment.updated_at,
          valid_until_utc: $approval.valid_until_utc,
          clone_destroy_by_utc: $approval.clone_destroy_by_utc
        }
    ] | last // empty
  ' "$comments_json")

[[ -n "$match" ]] || { echo '::error::No matching structured approval from the configured data approver.' >&2; exit 1; }
comment_id=$("$JQ_BIN" -r '.comment_id' <<<"$match")
created_at=$("$JQ_BIN" -r '.created_at_utc' <<<"$match")
updated_at=$("$JQ_BIN" -r '.updated_at_utc' <<<"$match")
valid_until=$("$JQ_BIN" -r '.valid_until_utc' <<<"$match")
clone_destroy_by=$("$JQ_BIN" -r '.clone_destroy_by_utc' <<<"$match")
utc_pattern='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
[[ "$created_at" =~ $utc_pattern && "$updated_at" =~ $utc_pattern ]] \
  || { echo '::error::Authorization comment timestamps are invalid.' >&2; exit 1; }
[[ "$valid_until" =~ $utc_pattern ]] \
  || { echo '::error::Approval valid_until_utc must be an explicit UTC timestamp.' >&2; exit 1; }
[[ "$clone_destroy_by" =~ $utc_pattern ]] \
  || { echo '::error::clone_destroy_by_utc must be an explicit UTC timestamp.' >&2; exit 1; }
[[ "$created_at" == "$updated_at" ]] \
  || { echo '::error::Edited authorization comments are invalid; post a new approval comment.' >&2; exit 1; }
created_at_epoch=$(date -u -d "$created_at" +%s 2>/dev/null) \
  || { echo '::error::Authorization comment created_at is invalid.' >&2; exit 1; }
valid_until_epoch=$(date -u -d "$valid_until" +%s 2>/dev/null) \
  || { echo '::error::Approval valid_until_utc is invalid.' >&2; exit 1; }
clone_destroy_by_epoch=$(date -u -d "$clone_destroy_by" +%s 2>/dev/null) \
  || { echo '::error::clone_destroy_by_utc is invalid.' >&2; exit 1; }
now_epoch=$(date -u +%s)
(( created_at_epoch <= now_epoch )) || { echo '::error::Authorization comment creation time is in the future.' >&2; exit 1; }
(( valid_until_epoch > now_epoch )) || { echo '::error::Data-copy approval has expired.' >&2; exit 1; }
(( valid_until_epoch <= created_at_epoch + 86400 )) \
  || { echo '::error::Data-copy approval may remain valid for at most 24 hours from comment creation.' >&2; exit 1; }
(( clone_destroy_by_epoch > now_epoch )) \
  || { echo '::error::Approved clone destruction deadline has passed.' >&2; exit 1; }
(( clone_destroy_by_epoch <= created_at_epoch + 259200 )) \
  || { echo '::error::Approved clone retention may not exceed 72 hours from comment creation.' >&2; exit 1; }

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'comment_id=%s\n' "$comment_id"
    printf 'created_at_utc=%s\n' "$created_at"
    printf 'valid_until_utc=%s\n' "$valid_until"
    printf 'clone_destroy_by_utc=%s\n' "$clone_destroy_by"
  } >> "$GITHUB_OUTPUT"
fi
echo "Structured data-owner approval verified; comment ID: $comment_id"
