#!/usr/bin/env bash
set -Eeuo pipefail

: "${RECIPIENT_CERT_FILE:?RECIPIENT_CERT_FILE is required}"
: "${OUTPUT_FILE:?OUTPUT_FILE is required}"
: "${AUTHORIZATION_REF:?AUTHORIZATION_REF is required}"

KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
OPENSSL_BIN="${OPENSSL_BIN:-openssl}"
NAMESPACE="${NAMESPACE:-starteria}"
DATABASE_STATEFULSET="${DATABASE_STATEFULSET:-starteria-db}"

[[ "$OUTPUT_FILE" == *.p7m ]] || { echo '::error::Encrypted output must use the .p7m extension.' >&2; exit 1; }
[[ -s "$RECIPIENT_CERT_FILE" ]] || { echo '::error::Validated recipient certificate is unavailable.' >&2; exit 1; }
[[ "$AUTHORIZATION_REF" =~ ^MVPREL01-[A-Z0-9][A-Z0-9-]{5,63}$ ]] \
  || { echo '::error::Invalid authorization reference.' >&2; exit 1; }

umask 077
mkdir -p -- "$(dirname -- "$OUTPUT_FILE")"
temporary_file="${OUTPUT_FILE}.tmp"
ready=false
rm -f -- "$OUTPUT_FILE" "$temporary_file"

cleanup() {
  local status=$?
  rm -f -- "$temporary_file"
  if [[ "$ready" != true ]]; then
    rm -f -- "$OUTPUT_FILE"
  fi
  exit "$status"
}
trap cleanup EXIT

if ! "$KUBECTL_BIN" exec -n "$NAMESPACE" "statefulset/$DATABASE_STATEFULSET" -- \
    env PGAPPNAME=mvp-release01-backup-only \
      PGOPTIONS='-c default_transaction_read_only=on -c lock_timeout=5000' \
      pg_dump -U starteria -d starteria_db \
        --format=custom --no-owner --no-privileges \
  | "$OPENSSL_BIN" cms -encrypt -binary -stream -aes-256-cbc \
      -outform DER -out "$temporary_file" "$RECIPIENT_CERT_FILE"; then
  echo '::error::pg_dump stream or CMS encryption failed; no artifact is eligible for upload.' >&2
  exit 1
fi

[[ -s "$temporary_file" ]] || { echo '::error::Encrypted output is empty.' >&2; exit 1; }
"$OPENSSL_BIN" cms -cmsout -inform DER -in "$temporary_file" -noout >/dev/null
if [[ "$(head -c 5 "$temporary_file" || true)" == 'PGDMP' ]]; then
  echo '::error::Clear PostgreSQL custom-format header detected.' >&2
  exit 1
fi

mv -- "$temporary_file" "$OUTPUT_FILE"
chmod 600 "$OUTPUT_FILE"
encrypted_size=$(stat -c %s "$OUTPUT_FILE")
encrypted_sha256=$(sha256sum "$OUTPUT_FILE" | awk '{print $1}')
[[ "$encrypted_sha256" =~ ^[a-f0-9]{64}$ ]] || { echo '::error::Could not hash encrypted backup.' >&2; exit 1; }

ready=true
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'path=%s\n' "$OUTPUT_FILE"
    printf 'size=%s\n' "$encrypted_size"
    printf 'sha256=%s\n' "$encrypted_sha256"
  } >> "$GITHUB_OUTPUT"
fi
echo "Encrypted backup ready; size=$encrypted_size bytes sha256=$encrypted_sha256"
