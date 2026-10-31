#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
workflow="$repo_root/.github/workflows/mvp-release01-backup-only.yml"
cert_script="$repo_root/scripts/ci/mvp-release01-validate-recipient-cert.sh"
auth_script="$repo_root/scripts/ci/mvp-release01-verify-data-authorization.sh"
backup_script="$repo_root/scripts/ci/mvp-release01-backup-only.sh"
work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

expect_failure() {
  if "$@" >/dev/null 2>&1; then
    fail "command unexpectedly succeeded: $*"
  fi
}

grep -Eq '^  workflow_dispatch:' "$workflow" || fail 'workflow_dispatch trigger missing'
if grep -Eq '^  (push|pull_request|schedule):' "$workflow"; then
  fail 'automatic workflow trigger found'
fi
grep -Fq 'environment: production' "$workflow" || fail 'production environment missing'
grep -Fq 'group: starteria-production' "$workflow" || fail 'production concurrency group missing'
grep -Fq 'retention-days: 1' "$workflow" || fail 'one-day retention missing'
# This is a literal GitHub expression under test.
# shellcheck disable=SC2016
grep -Fq 'path: ${{ steps.backup.outputs.path }}' "$workflow" || fail 'artifact path is not fixed to backup output'
grep -Fq 'MVP_RELEASE01_BACKUP_RECIPIENT_CERT_B64' "$workflow" || fail 'recipient certificate secret missing'

if grep -Eiq 'migrate[[:space:]]+(deploy|resolve)|db[[:space:]]+push|kubectl[[:space:]]+apply|DELETE[[:space:]]+FROM|INSERT[[:space:]]+INTO|UPDATE[[:space:]]+[^=]' \
    "$workflow" "$backup_script"; then
  fail 'forbidden database or deployment mutation found'
fi
if grep -Eq -- '--file(=|[[:space:]])' "$backup_script"; then
  fail 'pg_dump must stream to stdout and must not create a remote file'
fi

openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
  -subj '/CN=starteria-release01-test' \
  -keyout "$work_dir/valid-key.pem" -out "$work_dir/valid-cert.pem" >/dev/null 2>&1
valid_b64=$(base64 -w0 "$work_dir/valid-cert.pem")
cert_output="$work_dir/cert-output"
RECIPIENT_CERT_B64="$valid_b64" \
CERTIFICATE_FILE="$work_dir/validated-cert.pem" \
GITHUB_OUTPUT="$cert_output" \
  "$cert_script" >/dev/null
cert_fingerprint=$(awk -F= '$1 == "sha256" {print $2}' "$cert_output")
[[ "$cert_fingerprint" =~ ^[a-f0-9]{64}$ ]] || fail 'certificate fingerprint missing'

expect_failure env -u RECIPIENT_CERT_B64 \
  CERTIFICATE_FILE="$work_dir/missing.pem" "$cert_script"
expect_failure env RECIPIENT_CERT_B64='not-base64!' \
  CERTIFICATE_FILE="$work_dir/invalid.pem" "$cert_script"
non_certificate_b64=$(printf 'valid base64 but not an X.509 certificate' | base64 -w0)
expect_failure env RECIPIENT_CERT_B64="$non_certificate_b64" \
  CERTIFICATE_FILE="$work_dir/not-a-certificate.pem" "$cert_script"

openssl req -new -newkey rsa:2048 -nodes -subj '/CN=expired-test' \
  -keyout "$work_dir/expired-key.pem" -out "$work_dir/expired.csr" >/dev/null 2>&1
openssl x509 -req -in "$work_dir/expired.csr" -signkey "$work_dir/expired-key.pem" \
  -days -1 -out "$work_dir/expired-cert.pem" >/dev/null 2>&1
expired_b64=$(base64 -w0 "$work_dir/expired-cert.pem")
expect_failure env RECIPIENT_CERT_B64="$expired_b64" \
  CERTIFICATE_FILE="$work_dir/expired-validated.pem" "$cert_script"

cat > "$work_dir/mock-kubectl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
case "${MOCK_KUBECTL_MODE:-success}" in
  success) printf 'PGDMPsynthetic-clear-stream-for-encryption-test' ;;
  fail) printf 'partial-stream'; exit 42 ;;
  *) exit 99 ;;
esac
MOCK
chmod +x "$work_dir/mock-kubectl"

AUTHORIZATION_REF=MVPREL01-TEST-0001 \
RECIPIENT_CERT_FILE="$work_dir/validated-cert.pem" \
OUTPUT_FILE="$work_dir/success.p7m" \
KUBECTL_BIN="$work_dir/mock-kubectl" \
  "$backup_script" >/dev/null
[[ -s "$work_dir/success.p7m" ]] || fail 'encrypted output missing'
openssl cms -cmsout -inform DER -in "$work_dir/success.p7m" -noout >/dev/null
if grep -aFq 'synthetic-clear-stream' "$work_dir/success.p7m"; then
  fail 'plaintext found in encrypted artifact'
fi

expect_failure env \
  AUTHORIZATION_REF=MVPREL01-TEST-0001 \
  RECIPIENT_CERT_FILE="$work_dir/validated-cert.pem" \
  OUTPUT_FILE="$work_dir/pgdump-failure.p7m" \
  KUBECTL_BIN="$work_dir/mock-kubectl" \
  MOCK_KUBECTL_MODE=fail \
  "$backup_script"
[[ ! -e "$work_dir/pgdump-failure.p7m" ]] || fail 'artifact survived pg_dump failure'

cat > "$work_dir/mock-openssl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == cms && "${2:-}" == -encrypt ]]; then
  exit 55
fi
exec "${REAL_OPENSSL:?}" "$@"
MOCK
chmod +x "$work_dir/mock-openssl"
expect_failure env \
  AUTHORIZATION_REF=MVPREL01-TEST-0001 \
  RECIPIENT_CERT_FILE="$work_dir/validated-cert.pem" \
  OUTPUT_FILE="$work_dir/encryption-failure.p7m" \
  KUBECTL_BIN="$work_dir/mock-kubectl" \
  OPENSSL_BIN="$work_dir/mock-openssl" \
  REAL_OPENSSL="$(command -v openssl)" \
  "$backup_script"
[[ ! -e "$work_dir/encryption-failure.p7m" ]] || fail 'artifact survived encryption failure'

expect_failure env -u GITHUB_TOKEN \
  GITHUB_REPOSITORY=DarkCodePE/plataforma-starteria \
  GITHUB_ACTOR=operator GITHUB_SHA=0123456789012345678901234567890123456789 \
  AUTHORIZATION_ISSUE=1 AUTHORIZATION_REF=MVPREL01-TEST-0001 \
  DATA_APPROVER_LOGIN=approver RECIPIENT_CERT_SHA256="$cert_fingerprint" \
  "$auth_script"

valid_until=$(date -u -d '+1 hour' '+%Y-%m-%dT%H:%M:%SZ')
cat > "$work_dir/issue.json" <<'JSON'
{"number":42,"state":"open","title":"Release 01 data-copy authorization"}
JSON
# jq variables below are intentionally expanded by jq.
# shellcheck disable=SC2016
jq -n \
  --arg valid_until "$valid_until" \
  --arg cert "$cert_fingerprint" '
  [{id: 9001, user: {login: "approver"}, body: ({
    schema: "starteria.mvp-release01.data-copy-authorization.v1",
    approved: true,
    authorization_ref: "MVPREL01-TEST-0001",
    operator: "operator",
    purpose: "MVP_RELEASE_01_PRODUCTION_CLONE_REHEARSAL",
    source_database: "starteria_db",
    channel: "GITHUB_ACTIONS_ENCRYPTED_ARTIFACT",
    retention_hours: 24,
    destruction_required: true,
    source_sha: "0123456789012345678901234567890123456789",
    recipient_certificate_sha256: $cert,
    valid_until_utc: $valid_until
  } | tojson)}]
' > "$work_dir/comments.json"

cat > "$work_dir/mock-curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
output=
url=
while (($#)); do
  case "$1" in
    --output) output=$2; shift 2 ;;
    http://*|https://*) url=$1; shift ;;
    *) shift ;;
  esac
done
[[ -n "$output" && -n "$url" ]]
if [[ "$url" == *'/comments?'* ]]; then
  cp "$MOCK_COMMENTS_JSON" "$output"
else
  cp "$MOCK_ISSUE_JSON" "$output"
fi
MOCK
chmod +x "$work_dir/mock-curl"

auth_output="$work_dir/auth-output"
GITHUB_TOKEN=test-token \
GITHUB_REPOSITORY=DarkCodePE/plataforma-starteria \
GITHUB_API_URL=https://example.invalid \
GITHUB_ACTOR=operator \
GITHUB_SHA=0123456789012345678901234567890123456789 \
AUTHORIZATION_ISSUE=42 \
AUTHORIZATION_REF=MVPREL01-TEST-0001 \
DATA_APPROVER_LOGIN=approver \
RECIPIENT_CERT_SHA256="$cert_fingerprint" \
CURL_BIN="$work_dir/mock-curl" \
MOCK_ISSUE_JSON="$work_dir/issue.json" \
MOCK_COMMENTS_JSON="$work_dir/comments.json" \
GITHUB_OUTPUT="$auth_output" \
  "$auth_script" >/dev/null
grep -Fqx 'comment_id=9001' "$auth_output" || fail 'structured authorization was not accepted'

printf '[]\n' > "$work_dir/no-comments.json"
expect_failure env \
  GITHUB_TOKEN=test-token \
  GITHUB_REPOSITORY=DarkCodePE/plataforma-starteria \
  GITHUB_API_URL=https://example.invalid \
  GITHUB_ACTOR=operator \
  GITHUB_SHA=0123456789012345678901234567890123456789 \
  AUTHORIZATION_ISSUE=42 \
  AUTHORIZATION_REF=MVPREL01-TEST-0001 \
  DATA_APPROVER_LOGIN=approver \
  RECIPIENT_CERT_SHA256="$cert_fingerprint" \
  CURL_BIN="$work_dir/mock-curl" \
  MOCK_ISSUE_JSON="$work_dir/issue.json" \
  MOCK_COMMENTS_JSON="$work_dir/no-comments.json" \
  "$auth_script"

echo 'MVP_RELEASE01_BACKUP_ONLY_TESTS_PASS'
